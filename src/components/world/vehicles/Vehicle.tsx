import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { CylinderGeometry, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { VehicleController, type VehicleTelemetry } from "@/engine/simulation/VehicleController";
import { SimAction } from "@/engine/input/actions";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { VEHICLE_DEFAULT_CONFIG } from "./vehicleConfig";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { damp } from "@/lib/math/Scalar";
import { emitExhaustParticle } from "@/components/world/effects/ExhaustParticles";

/**
 * Player vehicle: raycast-car physics body + visual model (§8).
 *
 * Controls only apply while the global player state is "driving"; otherwise
 * the chassis remains a full dynamic body (parkable, pushable, collidable).
 * Wheel visuals are plain meshes driven by the controller's per-wheel state.
 *
 * The chassis registers itself with the vehicle registry so the interaction
 * system can offer enter/exit (§17) without prop drilling or re-renders.
 */

export const HERO_VEHICLE_ID = "hero";
const SPAWN = { x: 7, y: 1.4, z: 10 };

/** Global registry (module-scope; single hero vehicle). */
let heroBody: RapierRigidBody | null = null;
export function getHeroVehicleBody(): RapierRigidBody | null {
  return heroBody;
}

/** World-space placement for the player when exiting (driver side). */
export function exitVehiclePlacement(body: RapierRigidBody, out: Vector3): Vector3 {
  const t = body.translation();
  const r = body.rotation();
  // Rotate local +X (driver side, 1.9 m out) into world space.
  const sin = 2 * (r.w * r.x + r.y * r.z);
  const cos = 1 - 2 * (r.x * r.x + r.y * r.y);
  out.set(t.x + cos * 1.9, t.y + 0.6, t.z + sin * 1.9);
  return out;
}

export function Vehicle(): React.JSX.Element {
  const bodyRef = useRef<RapierRigidBody>(null);
  const wheelRefs = useRef<(Object3D | null)[]>([null, null, null, null]);
  const simulationRate = useSettingsStore((s) => s.simulationRate);

  const controller = useMemo(() => new VehicleController(VEHICLE_DEFAULT_CONFIG), []);
  const telemetry = useMemo<VehicleTelemetry>(() => ({ speedKmh: 0, groundedWheels: 0, boost: 0 }), []);
  const controls = useMemo(
    () => ({ throttle: 0, steer: 0, handbrake: 0, boost: 0, flight: false, vertical: 0, reset: false }),
    []
  );

  const wheelGeometry = useMemo(
    () => new CylinderGeometry(VEHICLE_DEFAULT_CONFIG.wheelRadius, VEHICLE_DEFAULT_CONFIG.wheelRadius, 0.32, 18),
    []
  );
  const wheelMaterial = useMemo(() => new MeshStandardMaterial({ color: 0x14161a, roughness: 0.85, metalness: 0.1 }), []);

  useEffect(() => {
    heroBody = bodyRef.current;
    return () => {
      heroBody = null;
      wheelGeometry.dispose();
      wheelMaterial.dispose();
    };
  }, [wheelGeometry, wheelMaterial]);

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
    const store = useSimulationStore.getState();
    const driving = store.playerState === "driving";
    const input = frameState.input;
    const dt = (1 / 60) * simulationRate;

    controls.reset = false;
    if (!driving || !input || store.dialogue.active) {
      // Parked / conversation-locked: decay control authority smoothly.
      controls.throttle = damp(controls.throttle, 0, 4, dt);
      controls.steer = damp(controls.steer, 0, 4, dt);
      controls.handbrake = 1; // parking brake
      controls.boost = 0;
      controls.flight = false;
      controls.vertical = 0;
      controller.step(dt, body, controls, telemetry);
      return;
    }

    controls.throttle =
      (input.isDown(SimAction.MoveForward) ? 1 : 0) - (input.isDown(SimAction.MoveBackward) ? 1 : 0);
    controls.steer = (input.isDown(SimAction.MoveLeft) ? 1 : 0) - (input.isDown(SimAction.MoveRight) ? 1 : 0);
    controls.handbrake = input.isDown(SimAction.Handbrake) ? 1 : 0;
    controls.boost = input.isDown(SimAction.Boost) ? 1 : 0;
    if (input.wasPressed(SimAction.ToggleFlight)) controls.flight = !controls.flight;
    controls.vertical = (input.isDown(SimAction.Ascend) ? 1 : 0) - (input.isDown(SimAction.Descend) ? 1 : 0);
    if (input.wasPressed(SimAction.ResetVehicle)) controls.reset = true;

    controller.step(dt, body, controls, telemetry);
  });

  // Wheel visual sync + exhaust + telemetry (per rendered frame).
  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;

    for (let i = 0; i < 4; i++) {
      const wheelObj = wheelRefs.current[i];
      const wheel = controller.wheels[i];
      if (!wheelObj || !wheel) continue;
      wheelObj.position.set(wheel.localX, wheel.localY - wheel.suspensionLength, wheel.localZ);
      wheelObj.rotation.set(0, wheel.isFront ? wheel.steerAngle : 0, wheel.spinAngle);
    }

    // Boost / flight exhaust from the rear diffuser.
    if (telemetry.boost > 0.25) {
      const t = body.translation();
      emitExhaustParticle(t.x + (Math.random() - 0.5) * 0.7, t.y + 0.35, t.z - 2.2, 0, 1.4 + Math.random(), 0);
    }

    // Telemetry only while driving — otherwise the on-foot controller owns it.
    if (useSimulationStore.getState().playerState === "driving") {
      frameState.player.speedKmh = telemetry.speedKmh;
      frameState.player.boost = telemetry.boost;
      frameState.player.grounded = telemetry.groundedWheels > 0;
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={[SPAWN.x, SPAWN.y, SPAWN.z]}
      colliders={false}
      linearDamping={0.08}
      angularDamping={0.9}
      ccd
      name={HERO_VEHICLE_ID}
    >
      {/* Chassis collider: low-slung box; density gives mass ≈ 1240 kg. */}
      <CuboidCollider args={[1.05, 0.42, 2.2]} position={[0, 0.55, 0]} density={620} friction={0.4} />
      {/* Body shell */}
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[2.05, 0.62, 4.35]} />
        <meshStandardMaterial color="#c8102e" metalness={0.85} roughness={0.32} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[0, 1.08, -0.25]}>
        <boxGeometry args={[1.7, 0.52, 2.1]} />
        <meshStandardMaterial color="#10141c" metalness={0.6} roughness={0.25} />
      </mesh>
      {/* Neon underglow */}
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[1.9, 0.06, 4.1]} />
        <meshStandardMaterial color="#22e4ff" emissive="#22e4ff" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      {controller.wheels.map((_wheel, i) => (
        <mesh
          key={i}
          ref={(el) => {
            wheelRefs.current[i] = el;
          }}
          geometry={wheelGeometry}
          material={wheelMaterial}
          castShadow
          rotation={[0, 0, Math.PI / 2]}
        />
      ))}
    </RigidBody>
  );
}
