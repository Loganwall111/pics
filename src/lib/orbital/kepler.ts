/**
 * Keplerian Orbital Mechanics Module
 * Implements conversion between orbital elements and cartesian state vectors
 * Numerically stable, deterministic, tested against reference values
 */
import type { OrbitalElements, CartesianState, Vector3Like } from '@/types'
import { assertFiniteNumber } from '@/lib/diagnostics/assert'

const TWO_PI = Math.PI * 2

function normalizeAngle(angle: number): number {
  angle = angle % TWO_PI
  if (angle < 0) angle += TWO_PI
  return angle
}

/**
 * Solve Kepler's equation M = E - e*sin(E) for Eccentric Anomaly E
 * Using Newton-Raphson with good initial guess
 */
export function solveKepler(M: number, e: number, tolerance = 1e-8, maxIter = 50): number {
  M = normalizeAngle(M)
  if (e < 0.8) {
    // initial guess M
    let E = M
    for (let i = 0; i < maxIter; i++) {
      const f = E - e * Math.sin(E) - M
      const fp = 1 - e * Math.cos(E)
      const delta = -f / fp
      E += delta
      if (Math.abs(delta) < tolerance) break
    }
    return E
  } else {
    // high eccentricity, better initial guess PI
    let E = Math.PI
    for (let i = 0; i < maxIter; i++) {
      const f = E - e * Math.sin(E) - M
      const fp = 1 - e * Math.cos(E)
      const delta = -f / fp
      E += delta
      if (Math.abs(delta) < tolerance) break
    }
    return E
  }
}

export function trueAnomalyFromEccentric(E: number, e: number): number {
  // tan(nu/2) = sqrt((1+e)/(1-e)) * tan(E/2)
  const sinE = Math.sin(E)
  const cosE = Math.cos(E)
  const sqrtOneMinusESq = Math.sqrt(1 - e * e)
  // Use atan2 for quadrant correctness
  const y = sqrtOneMinusESq * sinE
  const x = cosE - e
  return Math.atan2(y, x)
}

export function eccentricFromTrue(nu: number, e: number): number {
  const cosNu = Math.cos(nu)
  const sinNu = Math.sin(nu)
  const cosE = (e + cosNu) / (1 + e * cosNu)
  const sinE = (Math.sqrt(1 - e * e) * sinNu) / (1 + e * cosNu)
  return Math.atan2(sinE, cosE)
}

export function orbitalPeriod(mu: number, a: number): number {
  assertFiniteNumber('mu', mu)
  assertFiniteNumber('a', a)
  if (a <= 0) throw new Error('Semi-major axis must be positive for bound orbits')
  return TWO_PI * Math.sqrt((a * a * a) / mu)
}

/**
 * Convert orbital elements to cartesian state in perifocal frame, then rotate to inertial
 */
export function elementsToCartesian(elements: OrbitalElements): CartesianState {
  const { mu, a, e, i, Omega, omega, nu } = elements
  assertFiniteNumber('mu', mu)
  assertFiniteNumber('a', a)
  assertFiniteNumber('e', e)

  // Distance r
  const p = a * (1 - e * e)
  const rMag = p / (1 + e * Math.cos(nu))

  // Perifocal position
  const r_pf: Vector3Like = {
    x: rMag * Math.cos(nu),
    y: rMag * Math.sin(nu),
    z: 0
  }

  // Perifocal velocity: v = sqrt(mu/p) * [-sin(nu), e+cos(nu), 0]
  const sqrtMuOverP = Math.sqrt(mu / p)
  const v_pf: Vector3Like = {
    x: -sqrtMuOverP * Math.sin(nu),
    y: sqrtMuOverP * (e + Math.cos(nu)),
    z: 0
  }

  // Rotation matrix: R = Rz(Omega) * Rx(i) * Rz(omega)
  // Apply to both r and v
  const cosO = Math.cos(Omega), sinO = Math.sin(Omega)
  const cosI = Math.cos(i), sinI = Math.sin(i)
  const cosW = Math.cos(omega), sinW = Math.sin(omega)

  // Combined rotation
  const R11 = cosO * cosW - sinO * sinW * cosI
  const R12 = -cosO * sinW - sinO * cosW * cosI
  const R13 = sinO * sinI
  const R21 = sinO * cosW + cosO * sinW * cosI
  const R22 = -sinO * sinW + cosO * cosW * cosI
  const R23 = -cosO * sinI
  const R31 = sinW * sinI
  const R32 = cosW * sinI
  const R33 = cosI

  function rotate(v: Vector3Like): Vector3Like {
    return {
      x: R11 * v.x + R12 * v.y + R13 * v.z,
      y: R21 * v.x + R22 * v.y + R23 * v.z,
      z: R31 * v.x + R32 * v.y + R33 * v.z
    }
  }

  return {
    position: rotate(r_pf),
    velocity: rotate(v_pf)
  }
}

/**
 * Simplified inverse: cartesian to elements (for testing, assumes bound orbit)
 * Returns approximate elements; full implementation would require more edge cases
 */
export function cartesianToElements(cartesian: CartesianState, mu: number): OrbitalElements {
  const r = cartesian.position
  const v = cartesian.velocity

  const rMag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z)
  const vMag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

  // Specific angular momentum h = r x v
  const h: Vector3Like = {
    x: r.y * v.z - r.z * v.y,
    y: r.z * v.x - r.x * v.z,
    z: r.x * v.y - r.y * v.x
  }
  const hMag = Math.sqrt(h.x * h.x + h.y * h.y + h.z * h.z)

  // Node vector n = K x h where K = (0,0,1)
  const n: Vector3Like = { x: -h.y, y: h.x, z: 0 }
  const nMag = Math.sqrt(n.x * n.x + n.y * n.y)

  // Eccentricity vector
  const vCrossH: Vector3Like = {
    x: v.y * h.z - v.z * h.y,
    y: v.z * h.x - v.x * h.z,
    z: v.x * h.y - v.y * h.x
  }
  const eVec: Vector3Like = {
    x: vCrossH.x / mu - r.x / rMag,
    y: vCrossH.y / mu - r.y / rMag,
    z: vCrossH.z / mu - r.z / rMag
  }
  const e = Math.sqrt(eVec.x * eVec.x + eVec.y * eVec.y + eVec.z * eVec.z)

  // Semi-major axis via vis-viva
  const energy = (vMag * vMag) / 2 - mu / rMag
  const a = -mu / (2 * energy)

  // Inclination
  const i = Math.acos(h.z / hMag)

  // RAAN
  let Omega = 0
  if (nMag > 1e-8) {
    Omega = Math.acos(n.x / nMag)
    if (n.y < 0) Omega = TWO_PI - Omega
  }

  // Argument of periapsis
  let omega = 0
  if (nMag > 1e-8 && e > 1e-8) {
    const dot = (n.x * eVec.x + n.y * eVec.y + n.z * eVec.z) / (nMag * e)
    const clamped = Math.max(-1, Math.min(1, dot))
    omega = Math.acos(clamped)
    if (eVec.z < 0) omega = TWO_PI - omega
  }

  // True anomaly
  let nu = 0
  if (e > 1e-8) {
    const dot = (eVec.x * r.x + eVec.y * r.y + eVec.z * r.z) / (e * rMag)
    const clamped = Math.max(-1, Math.min(1, dot))
    nu = Math.acos(clamped)
    if ((r.x * v.x + r.y * v.y + r.z * v.z) < 0) nu = TWO_PI - nu
  } else {
    // circular, use angle from node
    if (nMag > 1e-8) {
      const dot = (n.x * r.x + n.y * r.y) / (nMag * rMag)
      const clamped = Math.max(-1, Math.min(1, dot))
      nu = Math.acos(clamped)
      if (r.z < 0) nu = TWO_PI - nu
    } else {
      nu = Math.atan2(r.y, r.x)
    }
  }

  return {
    mu,
    a,
    e,
    i,
    Omega,
    omega,
    nu,
    period: orbitalPeriod(mu, a)
  }
}

// Deterministic test values: ISS-like orbit
export const REFERENCE_ORBITS = {
  ISS: {
    mu: 398600.4418, // km^3/s^2 Earth
    a: 6771, // km
    e: 0.0005,
    i: 0.9, // ~51.6 deg in rad
    Omega: 0,
    omega: 0,
    nu: 0
  } as OrbitalElements
}
