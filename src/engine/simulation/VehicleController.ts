import type { RapierRigidBody } from "@react-three/rapier";
import { Quaternion, Vector3 } from "three";
import type { VehicleConfig, VehicleControls } from "@/types";
import {
  lateralGripImpulse,
  longitudinalForce,
  resistanceForce,
  suspensionForce,
} from "@/lib/physics/VehicleMath";
import { clamp, damp } from "@/lib/math/Scalar";
import { steeringResponse } from "@/lib/math/Curve";
import { physicsRuntime } from "@/engine/physics/PhysicsRuntime";

/**
 * Raycast vehicle controller (specification §8).
 *
 * Rapier ships no native vehicle controller, so this implements the classic
 * raycast-car model on top of supported Rapier rigid-body/query APIs:
 *
 *   per physics step, per wheel:
 *     1. cast a suspension ray from the chassis attach point downward
 *        (excluding the chassis itself via filterExcludeRigidBody)
 *     2. apply the damped spring impulse along the chassis up-axis
 *     3. resolve the tyre friction patch at the contact:
 *          lateral impulse opposing slip (clamped by the friction circle)
 *          longitudinal engine/brake impulse along the wheel forward vector
 *     4. chassis-level drag, rolling resistance, downforce and anti-roll
 *
 * All forces are `applyImpulseAtPoint(force * dt)` so they integrate
 * correctly with Rapier's fixed timestep regardless of frame rate.
 *
 * Update frequency: once per physics step (useBeforePhysicsStep).
 * Allocation policy: every vector/quaternion is preallocated on the class.
 */

export interface VehicleTelemetry {
  speedKmh: number;
  groundedWheels: number;
  boost: number;
}

interface WheelState {
  /** Attach point in chassis-local space (chassis forward = +Z). */
  localX: number;
  localY: number;
  localZ: number;
  isFront: boolean;
  steerAngle: number;
  spinAngle: number;
  grounded: boolean;
  /** Current suspension length for rendering (m). */
  suspensionLength: number;
}

const ANTI_ROLL_GAIN = 0.35;
const FLIGHT_ACCEL = 26;
const FLIGHT_LEVEL_GAIN = 2.4;

export class VehicleController {
  readonly config: VehicleConfig;
  readonly wheels: readonly WheelState[];

  private readonly throttleSmoothed = { value: 0 };
  private readonly brakeSmoothed = { value: 0 };
  private boostLevel = 0;
  private flightBlend = 0;

  // Preallocated math scratch (single instance per controller).
  private readonly pos = new Vector3();
  private readonly quat = new Quaternion();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly attach = new Vector3();
  private readonly velAtPoint = new Vector3();
  private readonly linvel = new Vector3();
  private readonly angvel = new Vector3();
  private readonly impulse = new Vector3();
  private readonly rel = new Vector3();
  private readonly wheelForward = new Vector3();
  private readonly wheelRight = new Vector3();
  private readonly tmpQ = new Quaternion();
  private readonly rayResult = { hit: false, distance: 0, normalX: 0, normalY: 1, normalZ: 0 };

  constructor(config: VehicleConfig) {
    this.config = config;
    const trackHalf = 0.82;
    const wheelBaseHalf = 1.35;
    this.wheels = [
      { localX: -trackHalf, localY: -0.1, localZ: wheelBaseHalf, isFront: true, steerAngle: 0, spinAngle: 0, grounded: false, suspensionLength: config.suspensionRestLength },
      { localX: trackHalf, localY: -0.1, localZ: wheelBaseHalf, isFront: true, steerAngle: 0, spinAngle: 0, grounded: false, suspensionLength: config.suspensionRestLength },
      { localX: -trackHalf, localY: -0.1, localZ: -wheelBaseHalf, isFront: false, steerAngle: 0, spinAngle: 0, grounded: false, suspensionLength: config.suspensionRestLength },
      { localX: trackHalf, localY: -0.1, localZ: -wheelBaseHalf, isFront: false, steerAngle: 0, spinAngle: 0, grounded: false, suspensionLength: config.suspensionRestLength },
    ];
  }

  /**
   * Advance one physics step.
   * @param dt physics timestep × simulationRate (matches world.timestep)
   */
  step(dt: number, body: RapierRigidBody, controls: VehicleControls, telemetry: VehicleTelemetry): void {
    const cfg = this.config;

    // --- Basis from body rotation -------------------------------------------
    const t = body.translation();
    const r = body.rotation();
    this.pos.set(t.x, t.y, t.z);
    this.quat.set(r.x, r.y, r.z, r.w);
    this.forward.set(0, 0, 1).applyQuaternion(this.quat);
    this.right.set(1, 0, 0).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);

    const lv = body.linvel();
    const av = body.angvel();
    this.linvel.set(lv.x, lv.y, lv.z);
    this.angvel.set(av.x, av.y, av.z);

    const speed = this.linvel.length();
    const speedKmh = speed * 3.6;
    const forwardSpeed = this.linvel.dot(this.forward);

    // --- Control smoothing (response curves, never raw keys) ----------------
    const steerTarget = steeringResponse(
      controls.steer,
      speedKmh,
      cfg.steeringLimit,
      cfg.steerFadeStartKmh,
      cfg.steerFadeEndKmh,
      cfg.steerFadeFloor
    );
    this.throttleSmoothed.value = damp(this.throttleSmoothed.value, controls.throttle, 7, dt);
    this.brakeSmoothed.value = damp(this.brakeSmoothed.value, controls.handbrake, 10, dt);
    this.boostLevel = damp(this.boostLevel, controls.boost, 6, dt);
    this.flightBlend = damp(this.flightBlend, controls.flight ? 1 : 0, 3.5, dt);

    // --- Per-wheel raycasts and forces --------------------------------------
    let groundedWheels = 0;
    const wheelCount = this.wheels.length;
    const maxRayLen = cfg.suspensionRestLength + cfg.wheelRadius;

    for (let i = 0; i < wheelCount; i++) {
      const wheel = this.wheels[i];
      if (!wheel) continue;

      // Steering eases toward the target (rate-limited feel).
      wheel.steerAngle = damp(wheel.steerAngle, wheel.isFront ? steerTarget : 0, 9, dt);

      this.attach.set(wheel.localX, wheel.localY, wheel.localZ).applyQuaternion(this.quat).add(this.pos);

      // Velocity of the attach point: v + ω × r
      this.rel.copy(this.attach).sub(this.pos);
      this.velAtPoint.copy(this.angvel).cross(this.rel).add(this.linvel);

      const rr = physicsRuntime.raycastDown(this.attach, maxRayLen + 0.08, body);
      this.rayResult.hit = rr.hit;
      this.rayResult.distance = rr.distance;

      if (rr.hit) {
        groundedWheels += 1;
        wheel.grounded = true;
        wheel.suspensionLength = clamp(rr.distance - cfg.wheelRadius, 0, cfg.suspensionRestLength);

        // Spring compression velocity: chassis moving down along its up-axis
        // compresses the suspension (positive rate).
        const compressVel = -this.velAtPoint.dot(this.up);
        const spring = suspensionForce(
          cfg.suspensionStiffness,
          cfg.suspensionDamping,
          cfg.suspensionRestLength,
          cfg.wheelRadius,
          rr.distance,
          compressVel,
          cfg.mass * 45 // per-wheel force clamp
        );

        // Suspension impulse along chassis up, applied at the attach point.
        this.impulse.copy(this.up).multiplyScalar(spring.force * dt);
        body.applyImpulseAtPoint(
          { x: this.impulse.x, y: this.impulse.y, z: this.impulse.z },
          { x: this.attach.x, y: this.attach.y, z: this.attach.z },
          true
        );

        // Wheel basis with steering applied around chassis up.
        if (wheel.isFront && wheel.steerAngle !== 0) {
          this.tmpQ.setFromAxisAngle(this.up, wheel.steerAngle);
          this.wheelForward.copy(this.forward).applyQuaternion(this.tmpQ);
          this.wheelRight.copy(this.right).applyQuaternion(this.tmpQ);
        } else {
          this.wheelForward.copy(this.forward);
          this.wheelRight.copy(this.right);
        }

        const wheelLoad = Math.max(spring.force, (cfg.mass * 9.81) / (wheelCount * 3));

        // Lateral grip: kill slip velocity, clamp at the friction circle.
        const handbrakeLoss = wheel.isFront ? 1 : 1 - 0.62 * this.brakeSmoothed.value;
        const vLateral = this.velAtPoint.dot(this.wheelRight);
        const latImpulseN = lateralGripImpulse(vLateral, wheelLoad, cfg.lateralGrip * handbrakeLoss, 1.15);
        this.impulse.copy(this.wheelRight).multiplyScalar(latImpulseN * dt);
        body.applyImpulseAtPoint(
          { x: this.impulse.x, y: this.impulse.y, z: this.impulse.z },
          { x: this.attach.x, y: this.attach.y, z: this.attach.z },
          true
        );

        // Longitudinal: engine + brakes along wheel forward.
        const engineN = longitudinalForce(
          cfg.engineForce * (1 + (cfg.boostMultiplier - 1) * this.boostLevel),
          this.throttleSmoothed.value,
          cfg.brakeForce,
          this.brakeSmoothed.value,
          forwardSpeed
        );
        this.impulse.copy(this.wheelForward).multiplyScalar(engineN * dt);
        body.applyImpulseAtPoint(
          { x: this.impulse.x, y: this.impulse.y, z: this.impulse.z },
          { x: this.attach.x, y: this.attach.y, z: this.attach.z },
          true
        );

        // Visual wheel spin from contact rolling (no slip model needed).
        wheel.spinAngle += (forwardSpeed / cfg.wheelRadius) * dt;
      } else {
        wheel.grounded = false;
        wheel.suspensionLength = cfg.suspensionRestLength;
      }
    }

    // --- Chassis-level forces ------------------------------------------------
    // Aerodynamic drag + rolling resistance, always opposing velocity.
    if (speed > 0.01) {
      const resistN = resistanceForce(speed, cfg.aerodynamicDrag, cfg.rollingResistance);
      this.impulse.copy(this.linvel).multiplyScalar((-resistN * dt) / speed);
      body.applyImpulse({ x: this.impulse.x, y: this.impulse.y, z: this.impulse.z }, true);
    }

    // Grounded downforce + anti-roll keeps high-speed cornering planted.
    if (groundedWheels > 0) {
      this.impulse.copy(this.up).multiplyScalar(-0.35 * cfg.mass * 9.81 * dt);
      body.applyImpulse({ x: this.impulse.x, y: this.impulse.y, z: this.impulse.z }, true);

      // Anti-roll torque aligning chassis up with world up.
      this.rel.copy(this.up).cross(this.worldUp); // axis to rotate up → worldUp
      this.impulse.copy(this.rel).multiplyScalar(ANTI_ROLL_GAIN * cfg.mass * dt);
      body.applyTorqueImpulse({ x: this.impulse.x, y: this.impulse.y, z: this.impulse.z }, true);
    }

    // --- Flight / boost mode (§8 "Boost / Flight Mode") ----------------------
    if (this.flightBlend > 0.02) {
      const blend = this.flightBlend;
      // Hover thrust compensates gravity; vertical input climbs/dives.
      const g = Math.abs(currentGravityY);
      const hoverN = cfg.mass * (g + FLIGHT_ACCEL * Math.max(0, controls.vertical));
      const diveN = cfg.mass * FLIGHT_ACCEL * Math.min(0, controls.vertical) * 0.6;
      this.impulse
        .copy(this.worldUp)
        .multiplyScalar((hoverN + diveN) * blend * dt);
      body.applyImpulse({ x: this.impulse.x, y: this.impulse.y, z: this.impulse.z }, true);

      // Auto-level pitch/roll in flight mode.
      this.rel.copy(this.up).cross(this.worldUp);
      this.impulse.copy(this.rel).multiplyScalar(FLIGHT_LEVEL_GAIN * cfg.mass * blend * dt);
      body.applyTorqueImpulse({ x: this.impulse.x, y: this.impulse.y, z: this.impulse.z }, true);
    }

    // --- Reset (R): lift the chassis upright above its current position ------
    if (controls.reset) {
      body.setTranslation({ x: this.pos.x, y: this.pos.y + 2.2, z: this.pos.z }, true);
      body.setRotation({ x: 0, y: r.y, w: Math.sqrt(Math.max(0, 1 - r.y * r.y)), z: 0 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      controls.reset = false;
    }

    telemetry.speedKmh = speedKmh;
    telemetry.groundedWheels = groundedWheels;
    telemetry.boost = this.boostLevel;
  }
}

/** Written by the owning scene each step; avoids threading gravity through calls. */
export let currentGravityY = 9.81;
export function setCurrentGravityY(y: number): void {
  currentGravityY = y;
}
