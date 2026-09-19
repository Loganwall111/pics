import { clamp, damp, lerp, saturate, sign } from "./Scalar";

/**
 * Input/system response curves (specification §8, §31).
 *
 * Physical inputs must pass through shaping before reaching simulation:
 * raw key values are binary, but vehicles and characters should feel analog.
 * All functions are pure so they can be unit-tested against reference values.
 */

/** Symmetric deadzone: outputs 0 inside the zone, rescales outside. */
export function deadzone(x: number, dz: number): number {
  const a = Math.abs(x);
  if (a <= dz) return 0;
  return sign(x) * ((a - dz) / (1 - dz));
}

/**
 * Progressive response: mixes linear and quadratic response.
 * shape=0 → linear, shape=1 → fully quadratic (gentle around centre).
 * Monotonic on [-1, 1].
 */
export function responseCurve(x: number, shape: number): number {
  const s = saturate(shape);
  const a = Math.abs(x);
  const shaped = a * (s + (1 - s) * a);
  return clamp(shaped, 0, 1) * sign(x);
}

/**
 * Speed-sensitive steering: full authority at low speed, fading to
 * `floor` once `fadeStartKmh`…`fadeEndKmh` is crossed. Prevents twitchy
 * control at velocity without removing all authority.
 */
export function steeringResponse(
  steerInput: number,
  speedKmh: number,
  limitRadians: number,
  fadeStartKmh: number,
  fadeEndKmh: number,
  floor: number
): number {
  const fade = 1 - (1 - floor) * saturate((speedKmh - fadeStartKmh) / Math.max(fadeEndKmh - fadeStartKmh, 1e-3));
  return steerInput * limitRadians * fade;
}

/**
 * Longitudinal throttle mapping: separate acceleration and braking
 * constants so reversing never feels like an accident.
 * Returns a force multiplier in [-1, 1].
 */
export function longitudinalResponse(
  throttleInput: number,
  accelConstant: number,
  decelConstant: number
): number {
  if (throttleInput >= 0) {
    return responseCurve(throttleInput, 0.6) * accelConstant;
  }
  return -responseCurve(-throttleInput, 0.3) * decelConstant;
}

/** Exponential input smoothing for analog feel; frame-rate independent. */
export function smoothAxis(current: number, target: number, lambda: number, dt: number): number {
  return damp(current, clamp(target, -1, 1), lambda, dt);
}

/** 0→1 attack / 0→0 release pair used for boost and flight transitions. */
export function engage(value: number, active: boolean, attackLambda: number, releaseLambda: number, dt: number): number {
  return damp(value, active ? 1 : 0, active ? attackLambda : releaseLambda, dt);
}

export function mix(a: number, b: number, t: number): number {
  return lerp(a, b, saturate(t));
}
