/**
 * Unit tests for orbital mechanics - deterministic reference values
 */
import { elementsToCartesian, cartesianToElements, solveKepler, REFERENCE_ORBITS } from '@/lib/orbital/kepler'

function approxEqual(a: number, b: number, tol = 1e-3): boolean {
  return Math.abs(a - b) < tol
}

export function testOrbitalConversion(): boolean {
  const iss = REFERENCE_ORBITS.ISS
  const cart = elementsToCartesian(iss)
  console.log('[Test] ISS cartesian:', cart)

  // Position should be roughly a for nu=0
  const rMag = Math.sqrt(cart.position.x ** 2 + cart.position.y ** 2 + cart.position.z ** 2)
  if (!approxEqual(rMag, iss.a * (1 - iss.e), 10)) {
    console.error(`ISS rMag mismatch: ${rMag} vs ${iss.a}`)
    return false
  }

  // Roundtrip
  const recovered = cartesianToElements(cart, iss.mu)
  if (!approxEqual(recovered.a, iss.a, 5)) {
    console.error(`Roundtrip a mismatch: ${recovered.a} vs ${iss.a}`)
    return false
  }

  return true
}

export function testKeplerSolver(): boolean {
  const M = 1.0
  const e = 0.1
  const E = solveKepler(M, e)
  const M_recovered = E - e * Math.sin(E)
  if (!approxEqual(M, M_recovered, 1e-6)) {
    console.error(`Kepler solver failed: M=${M}, E=${E}, M_rec=${M_recovered}`)
    return false
  }
  return true
}

// Run if executed directly
if (typeof window !== 'undefined') {
  console.log('[Tests] Orbital:', testOrbitalConversion() ? 'PASS' : 'FAIL')
  console.log('[Tests] Kepler:', testKeplerSolver() ? 'PASS' : 'FAIL')
}
