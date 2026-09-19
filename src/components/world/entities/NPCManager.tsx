import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MeshStandardMaterial, SphereGeometry, CapsuleGeometry } from "three";
import { SpatialHash } from "@/engine/spatial/SpatialHash";
import { NPC_ROSTER } from "./npcDefinitions";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { dampAngle } from "@/lib/math/Scalar";

/**
 * NPC rendering + proximity management (§17).
 *
 * Static anchors → one SpatialHash built at mount → 10 Hz radius queries for
 * interaction availability (never per-NPC logic at frame rate). Visuals are
 * shared geometry + per-NPC accent materials, with idle bob and smooth
 * turn-to-face-player behaviour. All GPU resources are disposed on unmount.
 */

const QUERY_HZ = 10;

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

  // Proximity index over static anchors.
  const hash = useMemo(() => {
    const h = new SpatialHash<(typeof NPC_ROSTER)[number]>(8);
    for (const npc of NPC_ROSTER) h.insert(npc);
    return h;
  }, []);

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
        const near = hash.queryRadius(pp.x, pp.z, 6, queryOut);
        let best: (typeof NPC_ROSTER)[number] | null = null;
        let bestD2 = Infinity;
        for (const npc of near) {
          const dx = npc.x - pp.x;
          const dz = npc.z - pp.z;
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

    // --- Visuals: bob + face the player when engaged ------------------------
    const t = clock.shaderTimeSeconds;
    for (let i = 0; i < NPC_ROSTER.length; i++) {
      const npc = NPC_ROSTER[i];
      const group = groupsRef.current[i];
      if (!npc || !group) continue;
      group.position.set(npc.x, Math.abs(Math.sin(t * 1.7 + i * 1.9)) * 0.06, npc.z);
      const engaged = store.nearbyNpcId === npc.id || (store.dialogue.active && store.dialogue.npcId === npc.id);
      if (engaged) {
        const targetYaw = Math.atan2(pp.x - npc.x, pp.z - npc.z);
        group.rotation.y = dampAngle(group.rotation.y, targetYaw, 8, delta);
      } else {
        group.rotation.y = dampAngle(group.rotation.y, npc.facing + Math.sin(t * 0.3 + i) * 0.25, 2, delta);
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
export const npcShared = { playerPosition: { x: 0, y: 1, z: 0 } };
