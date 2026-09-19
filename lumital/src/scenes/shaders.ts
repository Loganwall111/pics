/**
 * LUMITAL sky shaders (§worlds).
 *
 * Three skydome programs (all rendered on inverted spheres around the
 * camera):
 *  - BLACK HOLE: true gravitational lensing — per-pixel geodesic integration
 *    of d²x/dλ² = −1.5·h²·x/r⁵ (rs = u_rs), procedural starfield sampled
 *    along the bent ray, photon-ring brightening, Einstein-ring visible.
 *  - MENGER MAZE: periodic 3D Menger-sponge raymarch (4 iterations) as the
 *    impossible skyline of the labyrinth world.
 *  - PSYCHEDELIC: layered kaleidoscopic nebula (domain-warped fbm, hue
 *    rotation over time) for the Void.
 *
 * Uniform singletons are declared WITHOUT `as const` (frame loop mutates).
 * No backticks/backslash tricks inside the template literals (gate rule).
 */

export const SKY_VERTEX = /* glsl */ `
precision highp float;
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const BLACKHOLE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 u_holePos;     // world-space black hole centre
uniform float u_rs;         // Schwarzschild radius (world units)
uniform float u_time;
uniform vec3 u_diskColor;
uniform float u_camRadius;  // distance camera->hole (info only)

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 starfield(vec3 rd) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float sc = 18.0 * pow(2.2, float(i));
    vec3 q = rd * sc;
    vec3 cell = floor(q);
    float h = hash13(cell + float(i) * 17.0);
    vec3 fracPos = fract(q) - 0.5 - (vec3(h, h * h, h * h * h) - 0.5) * 0.6;
    float star = smoothstep(0.12, 0.0, length(fracPos)) * step(0.985 - float(i) * 0.02, h);
    col += star * mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.6), h) * (1.6 - float(i) * 0.4);
  }
  return col;
}

void main() {
  vec3 rd = normalize(vDir);
  vec3 pos = cameraPosition - u_holePos;   // integrate in hole-centred space
  vec3 vel = rd;

  float h2 = dot(cross(pos, vel), cross(pos, vel));
  vec3 col = vec3(0.0);
  float dt = 1.4;
  float diskHit = -1.0;

  for (int i = 0; i < 48; i++) {
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    if (r < u_rs) { col = vec3(0.0); break; }             // captured
    if (r > 900.0) break;                                  // escaped
    // Geodesic bend (units rs-scaled): a = -1.5 h^2 x / r^5
    vec3 acc = -1.5 * h2 * pos / (r2 * r2 * r);
    vel += acc * dt;
    vec3 prev = pos;
    pos += vel * dt;
    // Accretion disk crossing (equatorial plane y = 0)
    if (prev.y * pos.y < 0.0) {
      float t = prev.y / (prev.y - pos.y);
      vec3 hit = mix(prev, pos, t);
      float hr = length(hit.xz);
      if (hr > u_rs * 3.0 && hr < u_rs * 8.5) {
        float ang = atan(hit.z, hit.x);
        float spin = fract(ang / 6.2831 + u_time * 0.05);
        float bands = 0.55 + 0.45 * sin(hr * 0.9 - u_time * 1.4 + ang * 3.0);
        float heat = clamp(1.0 - (hr - u_rs * 3.0) / (u_rs * 5.5), 0.0, 1.0);
        // Relativistic-ish beaming: approaching side brighter.
        float beam = 0.6 + 0.9 * pow(max(0.0, dot(normalize(vel), vec3(hit.z, 0.0, -hit.x) / max(hr, 0.001))), 2.0);
        diskHit = 1.0;
        col = mix(col, u_diskColor * (0.35 + heat * 1.9) * bands * beam, 0.92);
      }
    }
  }

  // Photon ring: rays that loiter near r = 1.5 rs glow before escaping.
  float rr = length(pos);
  if (rr > u_rs && rr < 900.0 && col.r + col.g + col.b < 0.01) {
    col = starfield(normalize(vel));
  }
  float shadowEdge = smoothstep(u_rs * 2.4, u_rs * 3.4, length(cross(normalize(vDir), normalize(u_holePos - cameraPosition))) * u_camRadius / max(u_rs, 0.001));
  col += u_diskColor * (1.0 - shadowEdge) * 0.22;
  if (diskHit < 0.0 && col.r + col.g + col.b < 0.001) col = starfield(rd) * 0.4;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const MENGER_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float u_time;
uniform vec3 u_tintA;
uniform vec3 u_tintB;

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float menger(vec3 p) {
  float d = sdBox(p, vec3(1.0));
  float s = 1.0;
  for (int m = 0; m < 4; m++) {
    vec3 a = mod(p * s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0 * abs(a));
    float da = max(r.x, r.y);
    float db = max(r.y, r.z);
    float dc = max(r.z, r.x);
    float c = (min(da, min(db, dc)) - 1.0) / s;
    d = max(d, c);
  }
  return d;
}

void main() {
  vec3 rd = normalize(vDir);
  if (rd.y < 0.02) discard;
  vec3 ro = vec3(0.0, u_time * 0.02, u_time * 0.013);
  float t = 0.0;
  float glow = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = menger(p) * 0.35;
    if (d < 0.002) { glow = 1.0 - float(i) / 64.0; break; }
    t += max(d, 0.01);
    if (t > 6.0) break;
  }
  float fres = pow(1.0 - max(rd.y, 0.0), 3.0);
  vec3 col = mix(u_tintB, u_tintA, glow) * (glow * 1.2 + 0.05) + u_tintA * fres * 0.25;
  gl_FragColor = vec4(col, glow * 0.9 + fres * 0.3);
}
`;

export const PSYCHEDELIC_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float u_time;

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.103, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec3 n = mix(mix(mix(hash33(i).x, hash33(i + vec3(1,0,0)).x, f.x),
                mix(hash33(i + vec3(0,1,0)).x, hash33(i + vec3(1,1,0)).x, f.x), f.y),
             mix(mix(hash33(i + vec3(0,0,1)).x, hash33(i + vec3(1,0,1)).x, f.x),
                mix(hash33(i + vec3(0,1,1)).x, hash33(i + vec3(1,1,1)).x, f.x), f.y), f.z);
  return n;
}

vec3 hsv(float h, float s, float v) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return v - v * s * clamp(min(k, 4.0 - k), 0.0, 1.0);
}

void main() {
  vec3 rd = normalize(vDir);
  // Domain-warped fbm nebula with slow hue rotation.
  vec3 p = rd * 3.0;
  float w = noise3(p + u_time * 0.05);
  p += (hash33(p) - 0.5) * w * 2.0;
  float n = noise3(p * 1.7 + u_time * 0.03) * 0.6 + noise3(p * 3.9) * 0.4;
  float hue = fract(n * 0.9 + u_time * 0.012);
  vec3 col = hsv(hue, 0.75, 0.28 + 0.5 * n) + hsv(fract(hue + 0.5), 0.6, 0.12 * n);
  // Dimensional rift: a slow-breathing bright band.
  float rift = smoothstep(0.985, 0.999, sin(rd.x * 3.0 + u_time * 0.21) * sin(rd.y * 2.0 - u_time * 0.17));
  col += vec3(1.0, 0.9, 1.0) * rift * 0.8;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const LIQUID_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUvC;
varying vec3 vLocal;
void main() {
  vUvC = uv;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LIQUID_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUvC;
varying vec3 vLocal;
uniform float u_time;
uniform vec3 u_shallow;
uniform vec3 u_deep;

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.103, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash33(vec3(i, 7.0)).x;
  float b = hash33(vec3(i + vec2(1.0, 0.0), 7.0)).x;
  float c = hash33(vec3(i + vec2(0.0, 1.0), 7.0)).x;
  float d = hash33(vec3(i + vec2(1.0, 1.0), 7.0)).x;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  float r = length(vLocal.xy);
  float edge = 1.0 - smoothstep(3.9, 4.9, r);
  float ang = atan(vLocal.y, vLocal.x);
  vec2 swirl = vec2(cos(ang + u_time * 0.4), sin(ang + u_time * 0.4)) * 0.35;
  vec2 flow = swirl + vec2(u_time * 0.18, -u_time * 0.11);
  float n = noise2(vUvC * 9.0 + flow) * 0.6 + noise2(vUvC * 21.0 - flow * 1.6) * 0.4;
  float glints = smoothstep(0.78, 0.95, n);
  vec3 col = mix(u_deep, u_shallow, n * 0.85 + 0.1 * sin(u_time * 0.8 + vLocal.y * 2.0));
  col += vec3(0.85, 1.0, 0.9) * glints * 0.35;
  float alpha = 0.82 * edge + glints * 0.12;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
