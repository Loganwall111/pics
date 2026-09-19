/**
 * Raymarched volumetric cloud slab (§33 weather — the documented upgrade
 * from soft-particle banks).
 *
 * Rendered on a cover box straddling the slab [u_baseHeight, u_baseHeight +
 * u_thickness]; the fragment shader rebuilds the view ray analytically
 * (cameraPosition → vWorldPos), intersects the slab, and marches a 3-octave
 * value-noise density field advected by wind. Lighting = 3-sample sun
 * occlusion + vertical gradient (silver-liner read), front-to-back
 * energy-conserving alpha. March step count comes from the quality profile's
 * `volumetricSamples` (24 medium / 40 high / 64 ultra; low tier keeps the
 * particle fallback instead of this path).
 *
 * Gate: scanned by tools/shader-check.mjs (balanced GLSL, no TODO markers).
 * Uniform singletons intentionally declared WITHOUT `as const` — the frame
 * loop mutates `.value` (TS2540 otherwise).
 */

export const CLOUD_VOLUMETRIC_VERTEX = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CLOUD_VOLUMETRIC_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
uniform float u_time;
uniform float u_coverage;      // weather cloudiness, 0..1
uniform float u_density;       // extinction multiplier
uniform vec2 u_wind;           // world-space advection, units per second
uniform vec3 u_sunColor;
uniform vec3 u_skyColor;
uniform vec3 u_sunDirection;   // normalized, toward the sun
uniform float u_baseHeight;
uniform float u_thickness;
uniform float u_steps;         // march budget from quality profile

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float densityAt(vec3 p) {
  float h = clamp((p.y - u_baseHeight) / u_thickness, 0.0, 1.0);
  // Rounded vertical profile: denser mid-slab, wispy top and bottom.
  float profile = sin(3.14159 * pow(h, 0.65));
  vec2 q = p.xz * 0.004 + u_wind * u_time * 0.004;
  float n = vnoise(q) * 0.55 + vnoise(q * 2.7 + 11.3) * 0.28 + vnoise(q * 6.1 + 27.7) * 0.17;
  // Coverage remap: clear sky keeps only the rarest wisps, storms fill in.
  float cov = mix(0.74, 0.30, u_coverage);
  return smoothstep(cov, cov + 0.24, n) * profile * u_density;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - cameraPosition);
  if (abs(rd.y) < 0.0005) discard;
  float tEnter = (u_baseHeight - ro.y) / rd.y;
  float tExit = (u_baseHeight + u_thickness - ro.y) / rd.y;
  float tMin = min(tEnter, tExit);
  float tMax = max(tEnter, tExit);
  tMin = max(tMin, 0.0);
  tMax = min(tMax, tMin + 2600.0); // bounded march (perf + aerial perspective)
  float span = tMax - tMin;
  if (span <= 0.0) discard;

  float dt = span / u_steps;
  // Stable per-pixel jitter: animating this term caused full-sky shimmer
  // (reported as constant flashing). Static noise + dense steps = calm.
  float jitter = hash21(gl_FragCoord.xy) * dt;
  float acc = 0.0;
  vec3 lightAccum = vec3(0.0);

  for (int i = 0; i < 96; i++) {
    if (float(i) >= u_steps || acc > 0.98) break;
    vec3 p = ro + rd * (tMin + jitter + float(i) * dt);
    float d = densityAt(p);
    if (d > 0.001) {
      float shadow = 0.0;
      for (int j = 1; j <= 3; j++) {
        shadow += densityAt(p + u_sunDirection * (float(j) * u_thickness * 0.16));
      }
      float lit = exp(-shadow * 0.55);
      float heightGrad = 0.55 + 0.45 * clamp((p.y - u_baseHeight) / u_thickness, 0.0, 1.0);
      vec3 col = u_sunColor * lit * heightGrad + u_skyColor * 0.45;
      lightAccum += col * d * dt * (1.0 - acc);
      acc += d * dt * 0.085;
    }
  }

  float alpha = clamp(acc, 0.0, 0.98);
  // Distance fade blends the slab into sky haze at the horizon, AND fades
  // to zero at the cover-box silhouette (the old exp-only fade left a hard
  // visible edge line where the box met the sky).
  alpha *= exp(-tMin * 0.00045);
  alpha *= 1.0 - smoothstep(2800.0, 4300.0, tMin);
  if (alpha < 0.004) discard;
  vec3 meanCol = lightAccum / max(alpha, 0.001);
  gl_FragColor = vec4(meanCol, alpha);
}
`;

import { Color, Vector2, Vector3 } from "three";

export interface CloudVolumetricUniformRefs {
  u_time: { value: number };
  u_coverage: { value: number };
  u_density: { value: number };
  u_wind: { value: Vector2 };
  u_sunColor: { value: Color };
  u_skyColor: { value: Color };
  u_sunDirection: { value: Vector3 };
  u_baseHeight: { value: number };
  u_thickness: { value: number };
  u_steps: { value: number };
}

/** Uniform singletons (no `as const` — frame loop mutates `.value`). */
export function makeCloudVolumetricUniformRefs(): CloudVolumetricUniformRefs {
  return {
    u_time: { value: 0 },
    u_coverage: { value: 0 },
    u_density: { value: 1 },
    u_wind: { value: new Vector2(1, 0.3) },
    u_sunColor: { value: new Color(1, 0.95, 0.85) },
    u_skyColor: { value: new Color(0.25, 0.55, 0.95) },
    u_sunDirection: { value: new Vector3(0.5, 0.8, 0.2) },
    u_baseHeight: { value: 320 },
    u_thickness: { value: 160 },
    u_steps: { value: 40 },
  };
}
