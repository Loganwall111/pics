/**
 * Procedural atmospheric sky (specification §11).
 *
 * Rendered on the inside of a camera-locked sphere (BackSide, depthWrite
 * off). Approximates in-scattering with an analytic gradient plus
 * Rayleigh-like vertical falloff and a Mie-like forward lobe around the sun,
 * a physically-motivated sun disc, and a hash-based star field at night.
 *
 * Numerical notes:
 *  - All gradient exponents are clamped; no division by zero is possible.
 *  - Colours arrive in the working (linear) space; the renderer's output
 *    encoding handles the final sRGB conversion.
 *
 * Uniform ownership: a single shared uniforms object created by SkyDome and
 * mutated per frame — the material is NEVER recreated at runtime.
 */

export const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vDirection;

void main() {
  // Object-space position of a camera-centred sphere IS the view direction.
  vDirection = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const SKY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float u_globalTime;
uniform vec3 u_sunDirection;
uniform vec3 u_sunColor;
uniform vec3 u_zenithColor;
uniform vec3 u_horizonColor;
uniform float u_rayleighStrength;
uniform float u_mieStrength;
uniform float u_nightFactor;
uniform float u_sunDiscSize; // cosine of the disc half-angle

varying vec3 vDirection;

// Stable 2D hash — no textures, deterministic across platforms.
float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

// 3-layer star grid; returns star intensity for a direction.
float starField(vec3 dir, float threshold) {
  vec3 p = dir * 220.0;
  vec3 cell = floor(p);
  float h = hash21(cell.xy + cell.z * 17.31);
  if (h < threshold) return 0.0;
  float twinkle = 0.75 + 0.25 * sin(u_globalTime * (1.5 + 3.0 * hash21(cell.zx)) + h * 60.0);
  return twinkle * smoothstep(threshold, threshold + 0.08, h);
}

void main() {
  vec3 dir = normalize(vDirection);
  float altitude = clamp(dir.y, -1.0, 1.0);

  // --- Rayleigh-like gradient ---------------------------------------------
  // Strongest scattering near the horizon: pow(1 - h, k) with k modulated by
  // u_rayleighStrength; max(h, 1e-4) keeps the exponent finite below the
  // horizon where the dome darkens toward the ground colour.
  float h = max(altitude, 0.0);
  float rayleigh = pow(1.0 - h, 2.2 + 3.0 * clamp(u_rayleighStrength, 0.0, 6.0));
  vec3 sky = mix(u_zenithColor, u_horizonColor, rayleigh);

  // Below the horizon fade to a darkened horizon colour (ground haze).
  float below = smoothstep(0.0, -0.28, altitude);
  sky = mix(sky, u_horizonColor * 0.28, below);

  // --- Mie-like forward lobe ----------------------------------------------
  float cosSun = dot(dir, normalize(u_sunDirection));
  float mu = max(cosSun, 0.0);
  float mie = pow(mu, 14.0) * clamp(u_mieStrength, 0.0, 4.0);
  float mieWide = pow(mu, 3.0) * clamp(u_mieStrength, 0.0, 4.0) * 0.35;
  sky += u_sunColor * (mie + mieWide) * (1.0 - below);

  // --- Sun disc ------------------------------------------------------------
  // smoothstep on the cosine gives a soft, anti-aliased limb.
  float disc = smoothstep(u_sunDiscSize, u_sunDiscSize * 1.25, cosSun);
  float discVis = smoothstep(-0.12, 0.02, u_sunDirection.y);
  sky += u_sunColor * disc * 12.0 * discVis * (1.0 - below);

  // --- Stars ---------------------------------------------------------------
  float night = clamp(u_nightFactor, 0.0, 1.0);
  if (night > 0.01) {
    float stars = starField(dir, 0.9975) * night * (1.0 - below) * 0.9;
    sky += vec3(stars);
  }

  // --- Dither to kill banding on smooth gradients --------------------------
  float dither = (hash21(gl_FragCoord.xy + u_globalTime) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(sky + dither, 1.0);
}
`;
