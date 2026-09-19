/**
 * GPU particle shaders (specification §21).
 *
 * Ambient particles: positions are generated once on the CPU (static buffer)
 * and drift entirely in the vertex shader by wrapping a hashed base position
 * around the camera — zero CPU cost per frame, unbounded time stability via
 * mod() on u_globalTime.
 *
 * Exhaust particles: ring-buffer updated on the CPU (small budget, pooled)
 * with per-particle life; the shader only interpolates fade and size.
 */

export const AMBIENT_PARTICLE_VERTEX = /* glsl */ `
precision highp float;

uniform float u_globalTime;
uniform vec3 u_cameraPos;
uniform vec3 u_boxSize;    // drift volume around the camera
uniform float u_pixelRatio;
uniform float u_size;

attribute float aSeed;

varying float vAlpha;

void main() {
  // Deterministic per-particle drift from its seed; wraps around the camera
  // so particles recycle seamlessly as the viewer moves.
  vec3 seedOffset = vec3(
    sin(aSeed * 12.9898 + u_globalTime * (0.11 + 0.07 * fract(aSeed * 7.31))),
    cos(aSeed * 78.233 + u_globalTime * (0.09 + 0.05 * fract(aSeed * 3.17))),
    sin(aSeed * 37.719 + u_globalTime * (0.13 + 0.06 * fract(aSeed * 5.71)))
  );
  vec3 world = position + seedOffset * u_boxSize * 0.5;
  // Wrap into a box centred on the camera.
  vec3 rel = mod(world - u_cameraPos + u_boxSize * 0.5, u_boxSize) - u_boxSize * 0.5;
  vec3 pos = u_cameraPos + rel;

  vec4 mv = viewMatrix * vec4(pos, 1.0);
  float dist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = u_size * u_pixelRatio * clamp(28.0 / max(dist, 1.0), 0.4, 2.2);

  // Fade with distance and near the wrap boundary to hide recycling.
  float edge = length(rel / (u_boxSize * 0.5));
  vAlpha = (1.0 - smoothstep(0.65, 1.0, edge)) * smoothstep(140.0, 40.0, dist);
}
`;

export const AMBIENT_PARTICLE_FRAGMENT = /* glsl */ `
precision mediump float;

uniform vec3 u_color;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.08, d) * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(u_color, alpha);
}
`;

export const EXHAUST_PARTICLE_VERTEX = /* glsl */ `
precision highp float;

uniform float u_pixelRatio;

attribute float aLife;   // 1 → 0 over particle lifetime
attribute float aSize;

varying float vLife;

void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = mix(2.6, 0.6, 1.0 - aLife);
  gl_PointSize = aSize * grow * u_pixelRatio * clamp(30.0 / max(length(mv.xyz), 1.0), 0.3, 3.0);
}
`;

export const EXHAUST_PARTICLE_FRAGMENT = /* glsl */ `
precision mediump float;

uniform vec3 u_colorHot;
uniform vec3 u_colorCool;

varying float vLife;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.05, d) * vLife;
  if (alpha < 0.004) discard;
  vec3 color = mix(u_colorCool, u_colorHot, vLife);
  gl_FragColor = vec4(color, alpha);
}
`;
