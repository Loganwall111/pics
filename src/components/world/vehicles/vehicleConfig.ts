import type { VehicleConfig } from "@/types";

/**
 * Hero vehicle tuning (§8: data-driven parameters).
 * Values chosen for a ~1240 kg street car; every field is consumed by
 * VehicleController and covered by lib/physics/VehicleMath unit tests.
 */
export const VEHICLE_DEFAULT_CONFIG: VehicleConfig = {
  mass: 1240,
  wheelRadius: 0.42,
  suspensionRestLength: 0.55,
  suspensionStiffness: 42000,
  suspensionDamping: 5200,
  engineForce: 9800,
  brakeForce: 14000,
  steeringLimit: 0.58, // radians
  lateralGrip: 0.62,
  rollingResistance: 9.5,
  aerodynamicDrag: 1.35,
  throttleShape: 0.6,
  steerFadeStartKmh: 45,
  steerFadeEndKmh: 150,
  steerFadeFloor: 0.28,
  flightThrust: 26,
  boostMultiplier: 1.9,
};
