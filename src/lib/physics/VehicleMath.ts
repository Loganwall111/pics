import { clamp, saturate } from "@/lib/math/Scalar";

/**
 * Pure vehicle dynamics math (specification §8, §31).
 *
 * The raycast vehicle model treats each wheel as a damped spring against the
 * ground plus an anisotropic friction patch:
 *   suspension : F = k·x + c·v_rel   (clamped ≥ 0, never sucks the car down)
 *   lateral    : impulse opposes sideways slip, clamped by the friction circle
 *   longitudinal: engine/brake force along the wheel forward vector
 * All functions here are pure so reference tests can pin their behaviour.
 */

export interface SuspensionResult {
  /** Spring force in newtons (≥ 0). */
  force: number;
  /** Compression in metres (0 = fully extended). */
  compression: number;
}

/**
 * Damped spring suspension force.
 * @param stiffness        spring constant k (N/m)
 * @param damping          damper constant c (N·s/m)
 * @param restLength       suspension travel at full droop (m)
 * @param wheelRadius      wheel radius (m)
 * @param hitDistance      ray distance to ground (m); > rest + radius → airborne
 * @param compressVelocity rate of compression (m/s, positive = compressing)
 * @param maxForce         force clamp (N)
 */
export function suspensionForce(
  stiffness: number,
  damping: number,
  restLength: number,
  wheelRadius: number,
  hitDistance: number,
  compressVelocity: number,
  maxForce: number
): SuspensionResult {
  const fullLength = restLength + wheelRadius;
  if (hitDistance >= fullLength) {
    return { force: 0, compression: 0 };
  }
  const compression = fullLength - hitDistance;
  const spring = stiffness * compression;
  const damper = damping * compressVelocity;
  return { force: clamp(spring + damper, 0, maxForce), compression };
}

/**
 * Lateral tyre grip: impulse opposing sideways slip at a wheel, clamped by
 * the friction ellipse μ·load. Beyond the clamp the tyre "slides" — the
 * physical origin of drift.
 * @param vLateral sideways velocity at the contact patch (m/s)
 * @param load     instantaneous wheel load (N)
 * @param grip     grip coefficient (≈ mass-normalised responsiveness)
 * @param mu       friction coefficient (≈ 1 dry asphalt)
 */
export function lateralGripImpulse(vLateral: number, load: number, grip: number, mu: number): number {
  const raw = -vLateral * grip * load;
  const limit = mu * load;
  return clamp(raw, -limit, limit);
}

/**
 * Speed-sensitive steering angle target (radians).
 * Beyond fadeStart the authority linearly falls toward `floor` at fadeEnd.
 */
export function steeringAngle(
  steerInput: number,
  speedKmh: number,
  limit: number,
  fadeStartKmh: number,
  fadeEndKmh: number,
  floor: number
): number {
  const t = saturate((speedKmh - fadeStartKmh) / Math.max(fadeEndKmh - fadeStartKmh, 1e-3));
  const authority = 1 - (1 - floor) * t;
  return steerInput * limit * authority;
}

/**
 * Aerodynamic drag + rolling resistance force magnitude (N), opposing
 * velocity: quadratic drag with a linear rolling term.
 */
export function resistanceForce(speed: number, dragCoefficient: number, rollingCoefficient: number): number {
  const s = Math.abs(speed);
  return dragCoefficient * s * s + rollingCoefficient * s;
}

/** Longitudinal wheel force including brake attenuation (N). */
export function longitudinalForce(engineForceN: number, throttle: number, brakeForceN: number, brake: number, forwardSpeed: number): number {
  let force = engineForceN * throttle;
  // Brakes oppose motion, not the throttle command.
  if (brake > 0) {
    force -= Math.sign(forwardSpeed) * brakeForceN * brake;
  }
  return force;
}
