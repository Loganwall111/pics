/**
 * Scalar math helpers used across simulation hot paths.
 * Pure functions; no allocations; safe for per-frame use.
 */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function saturate(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  if (b === a) return 0;
  return (v - a) / (b - a);
}

/**
 * Frame-rate independent exponential smoothing.
 * `lambda` is the convergence rate per second (higher = snappier).
 * Numerically stable for tiny deltas (1 - e^-x ≈ x) and huge deltas (≤ 1).
 */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  if (dt <= 0) return a;
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

/** Shortest-arc angular damping (radians). */
export function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + (b - a === 0 ? 0 : diff) * (dt <= 0 ? 0 : 1 - Math.exp(-lambda * dt));
}

export function moveTowards(a: number, b: number, maxDelta: number): number {
  const d = b - a;
  if (Math.abs(d) <= maxDelta) return b;
  return a + Math.sign(d) * maxDelta;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = saturate(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

export function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

export function wrap(value: number, range: number): number {
  return ((value % range) + range) % range;
}

export function sign(v: number): number {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}
