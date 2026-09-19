import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { coneTarget, offCooldown, throwVelocity } from "@/lib/simulation/combat";
import { ITEMS, type ItemId } from "@/lib/simulation/items";
import { useInventoryStore } from "@/state/stores/inventoryStore";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { frameState } from "@/state/transient/frameState";
import { SimAction } from "@/engine/input/actions";
import { npcShared } from "./NPCManager";
import { playerShared } from "./Player";
import { NPC_ROSTER } from "./npcDefinitions";
import { audio } from "@/engine/audio/AudioSystem";

/**
 * On-foot combat verbs (v1.1 — §combat).
 *
 * Q PUNCH: cone melee → target NPC panics and flees; thud + blip miss.
 * F SHOOT: hitscan beam (brief additive tracer) → panic + spark flash.
 * T THROW: consumes the first hotbar item and launches a dynamic rapier
 * ball along the aim arc; despawns after 6 s. Decision math is pure
 * (lib/simulation/combat.ts, unit-tested); this component applies results.
 */

const MELEE_RANGE = 2.6;
const MELEE_HALF_ANGLE = 0.7;
const SHOOT_RANGE = 40;
const SHOOT_HALF_ANGLE = 0.12;
const SHOOT_COOLDOWN = 0.35;
const THROW_COOLDOWN = 0.6;
const THROW_POWER = 13;
const BALL_POOL = 6;

export function Combat(): React.JSX.Element {
  // --- Beam tracer (reused buffer, brief visibility) -----------------------
  const beamRef = useRef<LineSegments>(null);
  const beamUntil = useRef(-1);

  // --- Thrown ball pool ----------------------------------------------------
  const ballRefs = useRef<(RapierRigidBody | null)[]>([]);
  const ballDespawn = useRef<number[]>(Array.from({ length: BALL_POOL }, () => -1));
  const ballGeo = useMemo(() => new SphereGeometry(0.22, 10, 8), []);
  const ballMat = useMemo(
    () => new MeshStandardMaterial({ color: ITEMS.scrap.color, emissive: ITEMS.scrap.color, emissiveIntensity: 0.8, roughness: 0.4 }),
    []
  );

  const beamGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([0, 1.2, 0, 0, 1.2, SHOOT_RANGE]), 3));
    return g;
  }, []);
  const beamMat = useMemo(
    () =>
      new LineBasicMaterial({
        color: 0x9fe8ff,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useEffect(() => {
    return () => {
      ballGeo.dispose();
      ballMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
    };
  }, [ballGeo, ballMat, beamGeo, beamMat]);

  const cooldowns = useRef({ punch: -99, shoot: -99, throw: -99 });
  const aimOut = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
  const rosterTargets = useMemo(
    () => NPC_ROSTER.map((npc, i) => ({ id: i, x: npc.x, z: npc.z })),
    []
  );

  useFrame(() => {
    const store = useSimulationStore.getState();
    const input = frameState.input;
    if (!input || store.playerState !== "on-foot" || store.dialogue.active) return;
    const now = frameState.clock.shaderTimeSeconds;
    const pp = npcShared.playerPosition;
    const yaw = playerShared.camYaw;

    if (input.wasPressed(SimAction.Punch) && offCooldown(cooldowns.current.punch, now, 0.45)) {
      cooldowns.current.punch = now;
      const t = coneTarget(pp.x, pp.z, yaw, MELEE_RANGE, MELEE_HALF_ANGLE, rosterTargets);
      if (t !== null) {
        npcShared.panicUntil[t.id] = now + 4;
        audio.thud();
      } else {
        audio.blip();
      }
    }

    if (input.wasPressed(SimAction.Shoot) && offCooldown(cooldowns.current.shoot, now, SHOOT_COOLDOWN)) {
      cooldowns.current.shoot = now;
      const t = coneTarget(pp.x, pp.z, yaw, SHOOT_RANGE, SHOOT_HALF_ANGLE, rosterTargets);
      if (t !== null) npcShared.panicUntil[t.id] = now + 5;
      const beam = beamRef.current;
      if (beam) {
        const attr = beam.geometry.getAttribute("position") as BufferAttribute;
        const dist = t !== null ? Math.hypot(t.x - pp.x, t.z - pp.z) : SHOOT_RANGE;
        attr.setX(1, pp.x + Math.sin(yaw) * dist);
        attr.setY(1, 1.2);
        attr.setZ(1, pp.z + Math.cos(yaw) * dist);
        attr.needsUpdate = true;
        beamUntil.current = now + 0.07;
      }
    }
    if (beamRef.current) beamRef.current.visible = now < beamUntil.current;

    if (input.wasPressed(SimAction.ThrowItem) && offCooldown(cooldowns.current.throw, now, THROW_COOLDOWN)) {
      cooldowns.current.throw = now;
      const id: ItemId | null = useInventoryStore.getState().consumeAny();
      if (id !== null) {
        throwVelocity(yaw, 0.5, THROW_POWER, aimOut);
        let slot = ballDespawn.current.findIndex((d) => d < now);
        if (slot < 0) slot = 0;
        const body = ballRefs.current[slot];
        if (body) {
          body.setTranslation({ x: pp.x, y: 1.4, z: pp.z }, true);
          body.setLinvel(aimOut, true);
          ballDespawn.current[slot] = now + 6;
        }
      }
    }

    // Despawn landed balls by sinking them far below the world.
    for (let i = 0; i < BALL_POOL; i++) {
      const deadline = ballDespawn.current[i] ?? -1;
      if (deadline > 0 && now > deadline) {
        ballDespawn.current[i] = -1;
        ballRefs.current[i]?.setTranslation({ x: 0, y: -60 - i, z: 0 }, true);
        ballRefs.current[i]?.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  });

  return (
    <group>
      <lineSegments ref={beamRef} geometry={beamGeo} material={beamMat} visible={false} frustumCulled={false} />
      {Array.from({ length: BALL_POOL }, (_, i) => (
        <RigidBody
          key={i}
          ref={(el) => {
            ballRefs.current[i] = el;
          }}
          position={[0, -60 - i, 0]}
          colliders="ball"
          restitution={0.35}
        >
          <mesh geometry={ballGeo} material={ballMat} castShadow />
        </RigidBody>
      ))}
    </group>
  );
}
