/**
 * Building facade material system (specification §14, §15, §23).
 *
 * Pipeline position: this EXTENDS the standard Three.js PBR material
 * (MeshStandardMaterial). Lighting/BRDF/tonemapping are untouched; we inject
 * photoreal facade shading (window frames, floor slabs, weathering grime),
 * window emission, and a view-dependent sky reflection on unlit glass — all
 * driven by instanced attributes, so per-window work runs entirely on the
 * GPU (no per-window CPU updates, no per-window meshes).
 *
 * Instanced attributes (added by City.tsx):
 *   aWindow : vec4(windowCols, windowRows, seed, litProbability)
 *
 * Uniforms (single shared object owned by City.tsx, mutated per frame §23):
 *   u_time              — global shader time
 *   u_emissiveIntensity — scaled by night factor on the CPU
 *   u_skyColor          — current zenith colour × daylight (reflection tint)
 *   u_fresnelStrength   — reflection strength of the glass
 */

export const WINDOW_UNIFORMS = {
  u_time: { value: 0 },
  u_emissiveIntensity: { value: 1.2 },
  u_skyColor: { value: { r: 0.4, g: 0.6, b: 0.9 } },
  u_fresnelStrength: { value: 0.55 },
} as const;

/** Injected before `void main()` in both shader stages. */
export const WINDOW_VERTEX_HEAD = /* glsl */ `
attribute vec4 aWindow;
varying vec3 vLocalPos;
varying vec3 vObjNormal;
varying vec4 vWindow;
`;

/** Injected at the end of the vertex main body (after begin_vertex). */
export const WINDOW_VERTEX_BODY = /* glsl */ `
// Recover the *unscaled* local-space extents from the instance matrix so the
// window grid can be computed in metres regardless of building size.
vec3 iScale = vec3(
  length(instanceMatrix[0].xyz),
  length(instanceMatrix[1].xyz),
  length(instanceMatrix[2].xyz)
);
vLocalPos = position * iScale;
vObjNormal = normal;
vWindow = aWindow;
`;

export const WINDOW_FRAGMENT_HEAD = /* glsl */ `
uniform float u_time;
uniform float u_emissiveIntensity;
uniform vec3 u_skyColor;
uniform float u_fresnelStrength;
varying vec3 vLocalPos;
varying vec3 vObjNormal;
varying vec4 vWindow;

float hash21w(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 41.31);
  return fract(p.x * p.y);
}

// Photoreal facade shading (§15): multiplier for diffuse colour — window
// frames, floor slabs, weathering grime and rain streaks under sills.
float facadeShade(vec3 localPos, vec3 objNormal, vec4 win) {
  float nY = abs(objNormal.y);
  if (nY >= 0.5 || win.x < 0.5 || win.y < 0.5) return 1.0;
  vec2 facade = abs(objNormal.x) > abs(objNormal.z) ? localPos.zy : localPos.xy;
  facade += vec2(win.z * 13.7, win.z * 7.3);
  vec2 cellF = facade * win.xy;
  vec2 id = floor(cellF);
  vec2 f = fract(cellF);
  // Frame: dark aluminium border around every pane.
  float frame = 1.0 - (step(0.20, f.x) * step(f.x, 0.82) * step(0.16, f.y) * step(f.y, 0.80));
  float shade = mix(0.42, 1.0, frame);
  // Floor slab band at the bottom of each cell.
  float slab = step(f.y, 0.13) * (1.0 - frame);
  shade *= mix(0.78, 1.0, slab);
  // Deterministic grime: large-scale weathering + occasional streaks.
  float grime = hash21w(floor(cellF * 0.11) + win.z);
  shade *= mix(0.86, 1.02, grime);
  float streak = smoothstep(0.35, 0.0, abs(f.x - 0.5)) * step(0.8, hash21w(id + 3.1)) * 0.06;
  shade -= streak;
  return shade;
}
`;

/** Injected after `color_fragment`: darkens frames/slabs/grime. */
export const WINDOW_FRAGMENT_SHADE = /* glsl */ `
{
  diffuseColor.rgb *= facadeShade(vLocalPos, vObjNormal, vWindow);
}
`;

/**
 * Injected after `emissivemap_fragment` (native `normal` + `vViewPosition`
 * are available there): window emission + sky reflection on unlit glass.
 */
export const WINDOW_FRAGMENT_BODY = /* glsl */ `
{
  float nY = abs(vObjNormal.y);
  if (nY < 0.5 && vWindow.x > 0.5 && vWindow.y > 0.5) {
    // Pick facade planar coordinates from the object-space normal.
    vec2 facade = abs(vObjNormal.x) > abs(vObjNormal.z)
      ? vLocalPos.zy
      : vLocalPos.xy;
    // Building-local origin: instances are unit boxes centred at 0.
    facade += vec2(vWindow.z * 13.7, vWindow.z * 7.3);
    vec2 grid = vWindow.xy;
    vec2 cellF = facade * grid;
    vec2 id = floor(cellF);
    vec2 f = fract(cellF);
    // Window pane occupies the centre of each cell (frame handled in shade).
    float pane = step(0.24, f.x) * step(f.x, 0.78)
               * step(0.20, f.y) * step(f.y, 0.76);
    if (pane > 0.5) {
      float h = hash21w(id + vWindow.z * 97.13);
      float lit = step(1.0 - clamp(vWindow.w, 0.0, 1.0), h);
      // Rare flickering cells (faulty neon / late workers).
      float flickerSeed = hash21w(id + vWindow.z + 3.71);
      float flicker = 0.7 + 0.3 * sin(u_time * (3.0 + 9.0 * flickerSeed) + h * 40.0);
      lit *= mix(1.0, step(0.45, flicker), step(0.93, flickerSeed));
      vec3 warm = vec3(1.0, 0.72, 0.42);
      vec3 cool = vec3(0.55, 0.85, 1.0);
      vec3 teal = vec3(0.35, 1.0, 0.85);
      float palette = hash21w(id + 11.7 + vWindow.z);
      vec3 windowColor = palette < 0.55 ? warm : (palette < 0.88 ? cool : teal);
      // Interior depth: lit panes are brighter near the ceiling of the room.
      float interior = mix(0.65, 1.0, f.y);
      // Floors above the median light less often — office schedule shape.
      float heightMask = smoothstep(0.0, 0.35, fract(facade.y * 0.02));
      totalEmissiveRadiance += windowColor * lit * u_emissiveIntensity
        * interior * (0.55 + 0.45 * heightMask);

      // Sky reflection on unlit glass: view-dependent fresnel lobe (this
      // EXTENDS the PBR material; the BRDF itself stays native, §14).
      vec3 vDir = normalize(vViewPosition);
      float fres = pow(1.0 - abs(dot(vDir, normal)), 2.2);
      float dayFactor = clamp(u_skyColor.r + u_skyColor.g + u_skyColor.b, 0.0, 3.0) / 3.0;
      totalEmissiveRadiance += u_skyColor * u_fresnelStrength * fres
        * (1.0 - lit) * dayFactor;
    }
  }
}
`;

/**
 * Shared uniform ownership (§23): every runtime-updated uniform lives in this
 * single object; materials bind (never copy) it in onBeforeCompile.
 */
export function makeWindowShaderUniformRefs(): WindowUniformRefs {
  return WINDOW_UNIFORMS;
}

export type WindowUniformRefs = {
  u_time: { value: number };
  u_emissiveIntensity: { value: number };
  u_skyColor: { value: { r: number; g: number; b: number } };
  u_fresnelStrength: { value: number };
};
