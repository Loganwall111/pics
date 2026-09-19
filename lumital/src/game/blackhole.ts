/**
 * Black-hole optics — pure JS twin of the GLSL lensing shader (§blackhole).
 *
 * The shader integrates the Schwarzschild null-geodesic approximation
 * (units G=c=1, rs=1):  d²x/dλ² = −1.5 · h² · x / r⁵   with h = |x × v|
 * conserved. This module pins the SAME constants for gameplay decisions
 * (capture radius, disk zone) and is unit-tested; the shader implements the
 * identical equation in GLSL for rendering.
 */

/** Schwarzschild radius in world units (the lensing shader uses rs = 1 scaled). */
export const RS = 12;

/**
 * Photon capture: a ray with impact parameter b (in world units) is captured
 * when b < b_crit = (3√3/2) · rs ≈ 2.598 · rs (the photon sphere shadow).
 */
export function photonCaptured(impactParameter: number): boolean {
  const bCrit = ((3 * Math.sqrt(3)) / 2) * RS;
  return impactParameter < bCrit;
}

/** Photon-sphere radius (1.5 rs) — inner edge of the visible ring. */
export function photonSphere(): number {
  return 1.5 * RS;
}

/** Accretion disk inner/outer radii (ISCO = 3 rs for matter orbits). */
export function diskRadii(): { inner: number; outer: number } {
  return { inner: 3 * RS, outer: 8.5 * RS };
}

/**
 * Gravitational time-dilation factor √(1 − rs/r) at radius r (clamped to 0
 * inside the horizon) — used to slow the player's clock near the horizon.
 */
export function dilationFactor(r: number): number {
  if (r <= RS) return 0;
  return Math.sqrt(1 - RS / r);
}
