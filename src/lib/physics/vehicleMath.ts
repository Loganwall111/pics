/**
 * Vehicle Physics Math - Raycast vehicle controller without native Rapier vehicle API
 * Implements suspension, steering, longitudinal/lateral forces
 */
import type { VehicleConfig } from '@/types'

export interface WheelState {
  isGrounded: boolean
  hitPoint: { x: number; y: number; z: number } | null
  hitNormal: { x: number; y: number; z: number } | null
  compression: number // 0-1
  suspensionForce: number
  forwardSlip: number
  sidewaysSlip: number
}

export interface VehicleState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  linearVelocity: { x: number; y: number; z: number }
  angularVelocity: { x: number; y: number; z: number }
  steering: number
  engineForce: number
  brakeForce: number
  wheels: WheelState[]
}

export function calculateSuspensionForce(
  config: VehicleConfig,
  compression: number,
  prevCompression: number,
  deltaSeconds: number
): number {
  const displacement = config.suspensionRestLength * (1 - compression)
  const springForce = config.suspensionStiffness * displacement

  const velocity = prevCompression !== undefined ? (compression - prevCompression) / deltaSeconds : 0
  const dampingForce = config.suspensionDamping * velocity

  return springForce - dampingForce
}

export function calculateLongitudinalForce(
  engineForce: number,
  brakeForce: number,
  wheelState: WheelState,
  rollingResistance: number,
  velocityAlongForward: number
): number {
  if (!wheelState.isGrounded) return 0

  let force = engineForce

  // Rolling resistance opposes motion
  force -= Math.sign(velocityAlongForward) * rollingResistance * Math.abs(velocityAlongForward) * 0.1

  // Braking
  if (brakeForce > 0) {
    force -= Math.sign(velocityAlongForward) * brakeForce
  }

  // Clamp by grip
  const maxForce = wheelState.compression * 5000 // simplified grip limit
  return Math.max(-maxForce, Math.min(maxForce, force))
}

export function calculateLateralForce(
  lateralVelocity: number,
  config: VehicleConfig,
  wheelState: WheelState
): number {
  if (!wheelState.isGrounded) return 0

  // Lateral grip opposes sideways slip
  const grip = config.lateralGrip * wheelState.compression
  return -lateralVelocity * grip
}

export function applyAerodynamicDrag(velocity: { x: number; y: number; z: number }, drag: number): { x: number; y: number; z: number } {
  const speedSq = velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z
  if (speedSq < 0.001) return { x: 0, y: 0, z: 0 }
  const speed = Math.sqrt(speedSq)
  const dragMagnitude = drag * speedSq
  return {
    x: -(velocity.x / speed) * dragMagnitude,
    y: -(velocity.y / speed) * dragMagnitude,
    z: -(velocity.z / speed) * dragMagnitude
  }
}

// Response curve for input smoothing
export function responseCurve(input: number, exponent = 2): number {
  const sign = Math.sign(input)
  return sign * Math.pow(Math.abs(input), exponent)
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  mass: 800,
  wheelRadius: 0.33,
  suspensionRestLength: 0.35,
  suspensionStiffness: 28000,
  suspensionDamping: 3500,
  engineForce: 3500,
  brakeForce: 8000,
  steeringLimit: 0.6,
  lateralGrip: 8000,
  rollingResistance: 150,
  aerodynamicDrag: 0.35
}

export const SCOOTER_CONFIG: VehicleConfig = {
  mass: 120,
  wheelRadius: 0.18,
  suspensionRestLength: 0.15,
  suspensionStiffness: 8000,
  suspensionDamping: 1200,
  engineForce: 1200,
  brakeForce: 3000,
  steeringLimit: 0.8,
  lateralGrip: 3000,
  rollingResistance: 80,
  aerodynamicDrag: 0.25
}
