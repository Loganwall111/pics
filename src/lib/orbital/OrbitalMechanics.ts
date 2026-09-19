/**
 * Keplerian orbital mechanics (specification §10).
 *
 * Classical two-body element ↔ state-vector conversions with a robust
 * Newton–Raphson solution of Kepler's transcendental equation. Units are
 * kilometres / seconds by convention; callers define the gravitational
 * parameter μ for their system (Earth, or the compact fictional system used
 * by the orbital scene).
 *
 * Reference frames are explicit: all vectors are expressed in the orbital
 * inertial frame (ECI-style: +Z is the reference pole, +X is the node-line
 * reference direction). Positions are positions, velocities are velocities —
 * never conflated with elements.
 */

export interface OrbitalElements {
  /** Semi-major axis (km). */
  a: number;
  /** Eccentricity (0 ≤ e < 1 for closed orbits). */
  e: number;
  /** Inclination (rad). */
  i: number;
  /** Longitude of ascending node Ω (rad). */
  raan: number;
  /** Argument of periapsis ω (rad). */
  argP: number;
  /** Mean anomaly at epoch M₀ (rad). */
  M0: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StateVector {
  position: Vec3; // km
  velocity: Vec3; // km/s
}

/** Gravitational parameters (km³/s²). */
export const MU_EARTH = 398600.4418;
export const MU_MOON = 4902.8001;
/** Fictional compact system star used by the orbital scene (documented). */
export const MU_AETHER = 5.0e6;

export function orbitalPeriod(a: number, mu: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / mu);
}

export function meanMotion(a: number, mu: number): number {
  return Math.sqrt(mu / (a * a * a));
}

/** Circular-orbit speed at radius r. */
export function circularSpeed(r: number, mu: number): number {
  return Math.sqrt(mu / r);
}

/** Vis-viva speed at radius r on an orbit with semi-major axis a. */
export function visVivaSpeed(a: number, r: number, mu: number): number {
  return Math.sqrt(mu * (2 / r - 1 / a));
}

/**
 * Solve Kepler's equation M = E − e·sin(E) for E.
 * Newton iteration with an analytically safe starting guess; convergence
 * tolerance 1e-12 rad. Valid for 0 ≤ e < 1.
 */
export function eccentricAnomalyFromMean(M: number, e: number): number {
  if (e < 0 || e >= 1) throw new RangeError(`eccentricity out of range: ${e}`);
  const m = normalizeAngle(M);
  let E = e < 0.8 ? m : Math.PI;
  for (let iter = 0; iter < 16; iter++) {
    const f = E - e * Math.sin(E) - m;
    const fp = 1 - e * Math.cos(E);
    const delta = f / fp;
    E -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return E;
}

export function trueAnomalyFromEccentric(E: number, e: number): number {
  return Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e);
}

export function eccentricFromTrueAnomaly(nu: number, e: number): number {
  return Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu));
}

export function meanFromEccentricAnomaly(E: number, e: number): number {
  return E - e * Math.sin(E);
}

/** Wrap an angle into [0, 2π). */
export function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

/**
 * Rotate a perifocal-frame vector into the inertial frame.
 * Combined rotation matrix for R3(−Ω)·R1(−i)·R3(−ω), folded analytically
 * (standard result, e.g. Vallado "Fundamentals of Astrodynamics", Alg. 9).
 */
export function perifocalToInertial(v: Vec3, raan: number, inc: number, argP: number): Vec3 {
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const cI = Math.cos(inc);
  const sI = Math.sin(inc);
  const cW = Math.cos(argP);
  const sW = Math.sin(argP);
  const r11 = cO * cW - sO * sW * cI;
  const r12 = -cO * sW - sO * cW * cI;
  const r21 = sO * cW + cO * sW * cI;
  const r22 = -sO * sW + cO * cW * cI;
  const r31 = sW * sI;
  const r32 = cW * sI;
  return {
    x: r11 * v.x + r12 * v.y,
    y: r21 * v.x + r22 * v.y,
    z: r31 * v.x + r32 * v.y,
  };
}

/** Orbital elements + true anomaly → Cartesian state vector. */
export function elementsToState(el: OrbitalElements, nu: number, mu: number): StateVector {
  const p = el.a * (1 - el.e * el.e);
  if (p <= 0) throw new RangeError("non-positive semi-latus rectum");
  const r = p / (1 + el.e * Math.cos(nu));
  const sqrtMuP = Math.sqrt(mu / p);
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);

  // Perifocal-frame state: x toward periapsis, z along angular momentum.
  const rPw: Vec3 = { x: r * cosNu, y: r * sinNu, z: 0 };
  const vPw: Vec3 = { x: -sqrtMuP * sinNu, y: sqrtMuP * (el.e + cosNu), z: 0 };

  return {
    position: perifocalToInertial(rPw, el.raan, el.i, el.argP),
    velocity: perifocalToInertial(vPw, el.raan, el.i, el.argP),
  };
}

/** Cartesian state vector → classical orbital elements. */
export function stateToElements(state: StateVector, mu: number): OrbitalElements {
  const { position: r, velocity: v } = state;
  const rMag = Math.hypot(r.x, r.y, r.z);
  if (rMag < 1e-9) throw new RangeError("stateToElements: zero position");
  const vMag = Math.hypot(v.x, v.y, v.z);

  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const hz = r.x * v.y - r.y * v.x;
  const hMag = Math.hypot(hx, hy, hz);
  if (hMag < 1e-9) throw new RangeError("stateToElements: degenerate orbit (h≈0)");

  // Eccentricity vector e = (v × h)/μ − r̂
  const ex = (v.y * hz - v.z * hy) / mu - r.x / rMag;
  const ey = (v.z * hx - v.x * hz) / mu - r.y / rMag;
  const ez = (v.x * hy - v.y * hx) / mu - r.z / rMag;
  const e = Math.hypot(ex, ey, ez);

  const energy = (vMag * vMag) / 2 - mu / rMag;
  const a = energy >= 0 ? Number.POSITIVE_INFINITY : -mu / (2 * energy);

  const i = Math.acos(clampUnit(hz / hMag));

  // Node vector n = k̂ × h = (−hy, hx, 0)
  const nx = -hy;
  const ny = hx;
  const nMag = Math.hypot(nx, ny);

  let raan = 0;
  let argP = 0;
  let nu = 0;
  if (nMag > 1e-9) {
    raan = normalizeAngle(Math.atan2(ny, nx));
    if (e > 1e-9) {
      argP = Math.acos(clampUnit((nx * ex + ny * ey) / (nMag * e)));
      if (ez < 0) argP = 2 * Math.PI - argP;
      nu = Math.acos(clampUnit((nx * r.x + ny * r.y) / (nMag * rMag)));
      if (r.z < 0) nu = 2 * Math.PI - nu;
    } else {
      argP = 0;
      // Circular + equatorial: ν is simply the inertial polar angle.
      nu = normalizeAngle(Math.atan2(r.y, r.x));
    }
  } else {
    // Equatorial orbit: node undefined; measure ω from the +X reference.
    raan = 0;
    if (e > 1e-9) {
      argP = normalizeAngle(Math.atan2(ez, ex));
      nu = Math.acos(clampUnit((ex * r.x + ey * r.y + ez * r.z) / (e * rMag)));
      if (hy > 0 ? r.y < 0 : r.y > 0) nu = 2 * Math.PI - nu;
    } else {
      argP = 0;
      nu = normalizeAngle(Math.atan2(r.y, r.x));
    }
  }

  const E = e > 1e-9 ? eccentricFromTrueAnomaly(nu, e) : nu;
  const M0 = meanFromEccentricAnomaly(E, e);

  return {
    a,
    e,
    i,
    raan,
    argP: normalizeAngle(argP),
    M0: normalizeAngle(M0),
  };
}

function clampUnit(v: number): number {
  return Math.min(1, Math.max(-1, v));
}

/**
 * Propagate elements forward by `t` seconds from epoch (M₀).
 * Returns the Cartesian state vector — analytic two-body propagation.
 */
export function propagate(el: OrbitalElements, tSeconds: number, mu: number): StateVector {
  const n = meanMotion(el.a, mu);
  const M = normalizeAngle(el.M0 + n * tSeconds);
  const E = eccentricAnomalyFromMean(M, el.e);
  const nu = trueAnomalyFromEccentric(E, el.e);
  return elementsToState(el, nu, mu);
}
