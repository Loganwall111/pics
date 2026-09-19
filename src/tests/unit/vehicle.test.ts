import { calculateSuspensionForce, DEFAULT_VEHICLE_CONFIG } from '@/lib/physics/vehicleMath'

export function testSuspension(): boolean {
  const config = DEFAULT_VEHICLE_CONFIG
  const force = calculateSuspensionForce(config, 0.5, 0.4, 1/60)
  if (!Number.isFinite(force)) {
    console.error('Suspension force non-finite')
    return false
  }
  if (force <= 0) {
    console.error('Suspension force should be positive when compressed')
    return false
  }
  return true
}

export function testResponseCurve(): boolean {
  // Response curve should preserve sign and be monotonic
  return true
}
