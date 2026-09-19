import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
} from "three";
import { SimAction } from "@/engine/input/actions";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { damp, dampAngle } from "@/lib/math/Scalar";
import { physicsRuntime } from "@/engine/physics/PhysicsRuntime";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * Third-person player character (asset directive §3).
 *
 * Fully visible articulated figure — brown bob, white tee, denim shorts —
 * built from shaped primitives with a procedural face texture, driven by a
 * velocity-synced walk cycle: leg/arm swing amplitude and phase follow the
 * rigid-body's horizontal velocity every frame (no animation assets needed,
 * no per-frame allocations). Heading smooth-turns toward the motion vector.
 *
 * Physics (§17/§19) is unchanged from the validated controller: dynamic
 * capsule, damped wish-direction steering, grounding probe + jump, body
 * disabled while driving, control-only freeze during dialogue.
 */

const WALK_SPEED = 5.4;
const SPRINT_SPEED = 9.2;
const ACCEL_LAMBDA = 11;
const PLAYER_DENSITY = 60;

/** Camera yaw source written by CameraRig; read here (no React involvement). */
export const playerShared = { camYaw: 0 };

/** Global access to the player physics body (exit placement, diagnostics). */
let playerBody: RapierRigidBody | null = null;
export function getPlayerBody(): RapierRigidBody | null {
  return playerBody;
}
export function setPlayerBody(body: RapierRigidBody | null): void {
  playerBody = body;
}

/** Procedural face texture (deterministic; no external asset needed). */
function makeFaceTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("player: 2D canvas unavailable for face texture");
  ctx.clearRect(0, 0, 128, 160);
  // Eyes
  for (const ex of [42, 86]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, 68, 13, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a3325";
    ctx.beginPath();
    ctx.arc(ex + 2, 69, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.arc(ex + 2, 69, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // Lash line
    ctx.strokeStyle = "#3a2a1c";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(ex - 14, 64);
    ctx.quadraticCurveTo(ex, 58, ex + 14, 64);
    ctx.stroke();
  }
  // Brows
  ctx.strokeStyle = "#4e3320";
  ctx.lineWidth = 4;
  for (const ex of [42, 86]) {
    ctx.beginPath();
    ctx.moveTo(ex - 14, 52);
    ctx.quadraticCurveTo(ex, 46, ex + 14, 51);
    ctx.stroke();
  }
  // Nose + lips (subtle)
  ctx.strokeStyle = "rgba(150,100,80,0.55)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(64, 74);
  ctx.quadraticCurveTo(66, 88, 62, 92);
  ctx.stroke();
  ctx.fillStyle = "#c9827a";
  ctx.beginPath();
  ctx.ellipse(64, 108, 9, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function Player(): React.JSX.Element {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);
  const rigRef = useRef<Group>(null);
  // Persistent world state (§33): spawn at the last saved position.
  const [spawn] = useState(() => useSettingsStore.getState().home);
  const legLRef = useRef<Group>(null);
  const legRRef = useRef<Group>(null);
  const armLRef = useRef<Group>(null);
  const armRRef = useRef<Group>(null);
  const wasDriving = useRef(false);

  // --- Shared geometry (disposed once, §22) --------------------------------
  const geo = useMemo(
    () => ({
      torso: new CapsuleGeometry(0.14, 0.3, 6, 12),
      hips: new BoxGeometry(0.26, 0.17, 0.16),
      head: new SphereGeometry(0.105, 18, 14),
      hairCap: new SphereGeometry(0.116, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairBack: new BoxGeometry(0.17, 0.16, 0.07),
      bangs: new BoxGeometry(0.17, 0.055, 0.035),
      neck: new CylinderGeometry(0.045, 0.05, 0.09, 8),
      sleeve: new CylinderGeometry(0.056, 0.05, 0.2, 10),
      upperArmSkin: new CylinderGeometry(0.045, 0.042, 0.16, 10),
      forearm: new CylinderGeometry(0.04, 0.034, 0.2, 10),
      hand: new SphereGeometry(0.048, 10, 8),
      shortsLeg: new CylinderGeometry(0.072, 0.066, 0.24, 10),
      thighSkin: new CylinderGeometry(0.058, 0.052, 0.2, 10),
      shin: new CylinderGeometry(0.05, 0.042, 0.3, 10),
      shoe: new BoxGeometry(0.1, 0.09, 0.24),
      face: new PlaneGeometry(0.15, 0.19),
    }),
    []
  );

  const faceTexture = useMemo(() => makeFaceTexture(), []);

  // --- Shared materials ------------------------------------------------------
  const mat = useMemo(
    () => ({
      skin: new MeshStandardMaterial({ color: new Color("#e8b99e"), roughness: 0.62, metalness: 0 }),
      shirt: new MeshStandardMaterial({ color: new Color("#f4f4f1"), roughness: 0.85, metalness: 0 }),
      denim: new MeshStandardMaterial({ color: new Color("#86a3c9"), roughness: 0.9, metalness: 0 }),
      hair: new MeshStandardMaterial({ color: new Color("#4e3320"), roughness: 0.72, metalness: 0 }),
      shoe: new MeshStandardMaterial({ color: new Color("#efefe8"), roughness: 0.6, metalness: 0 }),
      face: new MeshStandardMaterial({
        map: faceTexture,
        transparent: true,
        roughness: 0.6,
        metalness: 0,
      }),
    }),
    [faceTexture]
  );

  useEffect(() => {
    return () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(mat)) m.dispose();
      faceTexture.dispose();
    };
  }, [geo, mat, faceTexture]);

  // --- Physics scratch (validated controller, unchanged) --------------------
  const tmp = useMemo(
    () => ({
      wish: new Vector3(),
      vel: new Vector3(),
      forward: new Vector3(),
      right: new Vector3(),
      bob: 0,
      gravity: { x: 0, y: -9.81, z: 0 },
      heading: 0,
      walkPhase: 0,
    }),
    []
  );

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
    playerBody = body;
    const store = useSimulationStore.getState();
    const input = frameState.input;
    const dt = frameState.clock.fixedDeltaSeconds;
    const gravity = physicsRuntime.getGravity(tmp.gravity);
    const driving = store.playerState === "driving";

    // Toggle body activity exactly at the driving boundary.
    if (driving !== wasDriving.current) {
      body.setEnabled(!driving);
      wasDriving.current = driving;
      if (driving) frameState.player.speedKmh = 0;
    }
    if (driving || !input) return;

    const locked = store.dialogue.active;

    // Camera-relative movement basis (yaw only).
    const yaw = playerShared.camYaw;
    tmp.forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    // Screen-right = forward × up (negating this made A/D feel swapped).
    tmp.right.set(-tmp.forward.z, 0, tmp.forward.x);

    const axisX = locked ? 0 : input.moveX;
    const axisY = locked ? 0 : input.moveY;
    tmp.wish
      .set(0, 0, 0)
      .addScaledVector(tmp.forward, axisY)
      .addScaledVector(tmp.right, axisX);
    if (tmp.wish.lengthSq() > 1) tmp.wish.normalize();

    const sprinting = input.isDown(SimAction.Sprint) && !locked;
    const maxSpeed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    const lv = body.linvel();
    tmp.vel.set(lv.x, lv.y, lv.z);

    // Horizontal damping toward wish velocity (accel & decel share lambda).
    tmp.vel.x = damp(tmp.vel.x, tmp.wish.x * maxSpeed, ACCEL_LAMBDA, dt);
    tmp.vel.z = damp(tmp.vel.z, tmp.wish.z * maxSpeed, ACCEL_LAMBDA, dt);

    // Grounding probe (own body excluded by the runtime) + jump.
    const t = body.translation();
    const probe = physicsRuntime.raycastDown({ x: t.x, y: t.y, z: t.z }, 1.02, body);
    const grounded = probe.hit;
    frameState.player.grounded = grounded;

    if (!locked && grounded && input.wasPressed(SimAction.Jump)) {
      const jumpHeight = Math.abs(gravity.y) > 4 ? 1.05 : 2.6; // low-gravity worlds jump higher
      tmp.vel.y = Math.sqrt(2 * Math.abs(gravity.y) * jumpHeight);
    }

    body.setLinvel({ x: tmp.vel.x, y: tmp.vel.y, z: tmp.vel.z }, true);

    // Telemetry for HUD.
    frameState.player.speedKmh = Math.hypot(lv.x, lv.z) * 3.6;
    frameState.player.inVehicle = false;
    frameState.player.boost = sprinting ? 1 : 0;
  });

  // --- Visual: position, heading, walk cycle, first-person hide ------------
  useFrame((_, delta) => {
    const body = bodyRef.current;
    const group = visualRef.current;
    const rig = rigRef.current;
    if (!body || !group || !rig) return;
    const driving = useSimulationStore.getState().playerState === "driving";
    group.visible = !driving && !frameState.firstPerson;
    if (driving) return;
    const t = body.translation();
    const lv = body.linvel();
    group.position.set(t.x, t.y, t.z);

    const speed = Math.hypot(lv.x, lv.z);
    const dt = Math.min(delta, 0.1);

    // Heading follows motion (never spins in place).
    if (speed > 0.35) {
      tmp.heading = dampAngle(tmp.heading, Math.atan2(lv.x, lv.z), 10, dt);
    }
    group.rotation.y = tmp.heading;

    // Walk cycle: phase from distance travelled; amplitude from speed.
    tmp.walkPhase += speed * dt * 2.35;
    const k = Math.min(speed / WALK_SPEED, 1.35);
    const swing = Math.sin(tmp.walkPhase) * 0.62 * k;
    if (legLRef.current && legRRef.current) {
      legLRef.current.rotation.x = swing;
      legRRef.current.rotation.x = -swing;
    }
    if (armLRef.current && armRRef.current) {
      armLRef.current.rotation.x = -swing * 0.68;
      armRRef.current.rotation.x = swing * 0.68;
      armLRef.current.rotation.z = 0.06;
      armRRef.current.rotation.z = -0.06;
    }
    // Forward lean + vertical bob from the gait.
    rig.rotation.x = 0.055 * k;
    rig.position.y = -0.8 + Math.abs(Math.cos(tmp.walkPhase)) * 0.045 * k;
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={[spawn.x, 1.4, spawn.z]}
      colliders={false}
      lockRotations
      linearDamping={0.4}
      friction={0.1}
      name="player"
      ccd
    >
      <CapsuleCollider args={[0.42, 0.38]} density={PLAYER_DENSITY} friction={0.2} restitution={0} />
      <group ref={visualRef}>
        <group ref={rigRef} position={[0, -0.8, 0]}>
          {/* Torso + hips */}
          <mesh geometry={geo.torso} material={mat.shirt} castShadow position={[0, 0.3, 0]} scale={[1.25, 1, 0.82]} />
          <mesh geometry={geo.hips} material={mat.denim} castShadow position={[0, 0.06, 0]} />
          {/* Neck + head */}
          <mesh geometry={geo.neck} material={mat.skin} castShadow position={[0, 0.52, 0]} />
          <group position={[0, 0.72, 0]}>
            <mesh geometry={geo.head} material={mat.skin} castShadow scale={[0.95, 1.08, 1]} />
            <mesh geometry={geo.face} material={mat.face} position={[0, 0.004, 0.101]} />
            {/* Brown bob: cap + back volume + bangs */}
            <mesh geometry={geo.hairCap} material={mat.hair} castShadow position={[0, 0.008, -0.006]} />
            <mesh geometry={geo.hairBack} material={mat.hair} castShadow position={[0, -0.045, -0.085]} />
            <mesh geometry={geo.bangs} material={mat.hair} castShadow position={[0, 0.075, 0.082]} rotation-x={0.12} />
          </group>
          {/* Arms: shoulder pivots (sleeve → skin → hand) */}
          <group ref={armLRef} position={[-0.225, 0.46, 0]}>
            <mesh geometry={geo.sleeve} material={mat.shirt} castShadow position={[0, -0.1, 0]} />
            <mesh geometry={geo.upperArmSkin} material={mat.skin} castShadow position={[0, -0.24, 0]} />
            <mesh geometry={geo.forearm} material={mat.skin} castShadow position={[0, -0.38, 0]} />
            <mesh geometry={geo.hand} material={mat.skin} castShadow position={[0, -0.51, 0]} />
          </group>
          <group ref={armRRef} position={[0.225, 0.46, 0]}>
            <mesh geometry={geo.sleeve} material={mat.shirt} castShadow position={[0, -0.1, 0]} />
            <mesh geometry={geo.upperArmSkin} material={mat.skin} castShadow position={[0, -0.24, 0]} />
            <mesh geometry={geo.forearm} material={mat.skin} castShadow position={[0, -0.38, 0]} />
            <mesh geometry={geo.hand} material={mat.skin} castShadow position={[0, -0.51, 0]} />
          </group>
          {/* Legs: hip pivots (denim shorts → bare thigh → shin → sneaker) */}
          <group ref={legLRef} position={[-0.095, 0.0, 0]}>
            <mesh geometry={geo.shortsLeg} material={mat.denim} castShadow position={[0, -0.12, 0]} />
            <mesh geometry={geo.thighSkin} material={mat.skin} castShadow position={[0, -0.32, 0]} />
            <mesh geometry={geo.shin} material={mat.skin} castShadow position={[0, -0.55, 0]} />
            <mesh geometry={geo.shoe} material={mat.shoe} castShadow position={[0, -0.75, 0.05]} />
          </group>
          <group ref={legRRef} position={[0.095, 0.0, 0]}>
            <mesh geometry={geo.shortsLeg} material={mat.denim} castShadow position={[0, -0.12, 0]} />
            <mesh geometry={geo.thighSkin} material={mat.skin} castShadow position={[0, -0.32, 0]} />
            <mesh geometry={geo.shin} material={mat.skin} castShadow position={[0, -0.55, 0]} />
            <mesh geometry={geo.shoe} material={mat.shoe} castShadow position={[0, -0.75, 0.05]} />
          </group>
        </group>
      </group>
    </RigidBody>
  );
}
