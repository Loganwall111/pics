import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MeshStandardMaterial, SphereGeometry, CapsuleGeometry } from "three";
import { SpatialHash } from "@/engine/spatial/SpatialHash";
import { RngStream } from "@/lib/math/Random";
import { createWanderer, stepWander, type Wanderer } from "@/lib/math/wander";
import { NPC_ROSTER } from "./npcDefinitions";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { dampAngle } from "@/lib/math/Scalar";

/**
 * NPC rendering + proximity management (§17, §33).
 *
 * Dialogue NPCs now LIVE at their anchors rather than standing frozen: each
 * strolls a small deterministic wander disc (shared `lib/math/wander`
 * behaviour) and freezes to face the player when engaged. One SpatialHash
 * built over anchor positions → 10 Hz radius queries for interaction
 * availability (broad-phase radius padded by the wander disc). Visuals are
 * shared geometry + per-NPC accent materials; all GPU resources disposed on
 * unmount.
 */

const QUERY_HZ = 10;
const WANDER_RADIUS = 3.2; // NPCs stay near their anchor (dialogue reach)

export function NPCManager(): React.JSX.Element {
  const groupsRef = useRef<(Group | null)[]>(NPC_ROSTER.map(() => null));
  const queryAccum = useRef(0);

  const shared = useMemo(() => {
    const bodyGeometry = new CapsuleGeometry(0.32, 0.7, 6, 12);
    const headGeometry = new SphereGeometry(0.26, 12, 10);
    const baseMaterial = new MeshStandardMaterial({ color: 0x3a4658, roughness: 0.6, metalness: 0.2 });
    const accentMaterials = NPC_ROSTER.map(
      (npc) =>
        new MeshStandardMaterial({
          color: npc.accentColor,
          emissive: npc.accentColor,
          emissiveIntensity: 0.9,
          roughness: 0.4,
        })
    );
    return { bodyGeometry, headGeometry, baseMaterial, accentMaterials };
  }, []);

  // Proximity index over anchor positions (positions padded by the wander
  // disc; exact distances below use the live wanderer position).
  const hash = useMemo(() => {
    const h = new SpatialHash<(typeof NPC_ROSTER)[number]>(8);
    for (const npc of NPC_ROSTER) h.insert(npc);
    return h;
  }, []);

  // Deterministic per-NPC strolls around each anchor (§33).
  const wanderers = useMemo<Wanderer[]>(
    () =>
      NPC_ROSTER.map((npc, i) =>
        createWanderer((0x4d65 ^ (i * 7919)) >>> 0, npc.x, npc.z, WANDER_RADIUS, 0.55, 0.95)
      ),
    []
  );
  const jitterStreams = useMemo(
    () => NPC_ROSTER.map((_, i) => new RngStream((0x5eED ^ (i * 104729)) >>> 0)),
    []
  );
  const rosterIndex = useMemo(() => new Map(NPC_ROSTER.map((npc, i) => [npc, i])), []);

  const queryOut = useMemo(() => [], []);

  useEffect(() => {
    return () => {
      shared.bodyGeometry.dispose();
      shared.headGeometry.dispose();
      shared.baseMaterial.dispose();
      for (const m of shared.accentMaterials) m.dispose();
    };
  }, [shared]);

  useFrame((_, delta) => {
    const store = useSimulationStore.getState();
    const clock = frameState.clock;

    // Player position comes from the interaction system's shared holder
    // (plain object — no allocation, no React).
    const pp = npcShared.playerPosition;

    // --- Interaction availability at 10 Hz ---------------------------------
    queryAccum.current += delta;
    if (queryAccum.current >= 1 / QUERY_HZ) {
      queryAccum.current = 0;
      if (store.playerState === "on-foot" && !store.dialogue.active) {
        // Broad phase over anchors (+wander margin), exact phase on live pos.
        const near = hash.queryRadius(pp.x, pp.z, 10, queryOut);
        let best: (typeof NPC_ROSTER)[number] | null = null;
        let bestD2 = Infinity;
        for (const npc of near) {
          const wi = rosterIndex.get(npc);
          const w = wi !== undefined ? wanderers[wi] : undefined;
          const wx = w ? w.x : npc.x;
          const wz = w ? w.z : npc.z;
          const dx = wx - pp.x;
          const dz = wz - pp.z;
          const d2 = dx * dx + dz * dz;
          const r = npc.interactRadius;
          if (d2 <= r * r && d2 < bestD2) {
            bestD2 = d2;
            best = npc;
          }
        }
        store.setNearbyNpc(best ? best.id : null);
      } else if (store.nearbyNpcId !== null) {
        store.setNearbyNpc(null);
      }
    }

    // --- Visuals: stroll, bob, face the player when engaged -----------------
    const t = clock.shaderTimeSeconds;
    for (let i = 0; i < NPC_ROSTER.length; i++) {
      const npc = NPC_ROSTER[i];
      const group = groupsRef.current[i];
      if (!npc || !group) continue;
      const w = wanderers[i];
      if (!w) continue;
      const engaged = store.nearbyNpcId === npc.id || (store.dialogue.active && store.dialogue.npcId === npc.id);
      // Engaged NPCs freeze and turn to face you; the rest keep strolling.
      const live = npcShared.livePositions[i];
      if (live) {
        live.x = w.x;
        live.z = w.z;
      }
      if (!engaged) {
        const jitter = jitterStreams[i];
        if (jitter) stepWander(w, delta, t, WANDER_RADIUS, jitter);
        group.position.set(w.x, Math.abs(Math.sin(t * 1.7 + i * 1.9)) * 0.06, w.z);
        group.rotation.y = dampAngle(group.rotation.y, w.yaw, 8, delta);
      } else {
        const targetYaw = Math.atan2(pp.x - w.x, pp.z - w.z);
        group.rotation.y = dampAngle(group.rotation.y, targetYaw, 8, delta);
      }
    }
  });

  return (
    <group>
      {NPC_ROSTER.map((npc, i) => (
        <group
          key={npc.id}
          position={[npc.x, 0, npc.z]}
          ref={(el) => {
            groupsRef.current[i] = el;
          }}
        >
          <mesh geometry={shared.bodyGeometry} material={shared.baseMaterial} castShadow position={[0, 0.75, 0]} />
          <mesh geometry={shared.headGeometry} material={shared.baseMaterial} castShadow position={[0, 1.5, 0]} />
          {/* Accent halo ring + chest core */}
          <mesh material={shared.accentMaterials[i]} position={[0, 1.06, 0.22]}>
            <boxGeometry args={[0.16, 0.16, 0.05]} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.55, 0.72, 28]} />
            <meshBasicMaterial color={npc.accentColor} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Shared player position holder — written each frame by InteractionSystem
 * from the physics body translation; read here and by the dialogue camera.
 */
export const npcShared = {
  playerPosition: { x: 0, y: 1, z: 0 },
  /** Live (wandered) NPC positions indexed by NPC_ROSTER order — dialogue
   * framing reads these so the camera tracks the strolling NPC, not the
   * static anchor. */
  livePositions: NPC_ROSTER.map(() => ({ x: 0, z: 0 })),
};
