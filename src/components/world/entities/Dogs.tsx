import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { RngStream } from "@/lib/math/Random";
import { createWanderer, stepWander, type Wanderer } from "@/lib/math/wander";
import { frameState } from "@/state/transient/frameState";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * Ambient wildlife: procedurally generated dogs (§33 extensibility list —
 * "AI-controlled NPCs / animals" started small by design).
 *
 * Fully procedural quadrupeds (no model assets): capsule body, head, ears,
 * wagging tail, four swing-animated legs. Behaviour is a deterministic
 * seeded wander (waypoint loop with idle pauses) — cheap, bounded, and it
 * reads as life in the plaza. Visuals only: no physics bodies, zero spawn
 * cost after mount, one shared geometry/material set.
 */

const DOG_COUNT = 4;
const WANDER_RADIUS = 26;

interface DogState {
  w: Wanderer;
  jitter: RngStream;
  colorIndex: number;
}

export function Dogs(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const quality = useSettingsStore((s) => s.quality);
  const count = quality === "low" ? 2 : DOG_COUNT;

  const geo = useMemo(
    () => ({
      body: new CapsuleGeometry(0.16, 0.34, 6, 10),
      head: new SphereGeometry(0.13, 12, 10),
      snout: new BoxGeometry(0.09, 0.08, 0.12),
      ear: new ConeGeometry(0.045, 0.09, 6),
      leg: new CylinderGeometry(0.035, 0.03, 0.26, 8),
      tail: new CylinderGeometry(0.02, 0.035, 0.24, 8),
    }),
    []
  );

  const mat = useMemo(() => {
    const colors = ["#c9a06a", "#3d3229", "#e8dcc8", "#8a5f3a"];
    return {
      fur: colors.map(
        (c) => new MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 })
      ),
      dark: new MeshStandardMaterial({ color: "#2a2118", roughness: 0.7, metalness: 0 }),
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const m of mat.fur) m.dispose();
      mat.dark.dispose();
    };
  }, [geo, mat]);

  // Deterministic per-seed pack.
  const dogs = useMemo<DogState[]>(() => {
    const rng = new RngStream(citySeed ^ 0xd06);
    return Array.from({ length: count }, (_, i) => {
      const homeX = (rng.float() - 0.5) * WANDER_RADIUS * 1.4;
      const homeZ = (rng.float() - 0.5) * WANDER_RADIUS * 1.4;
      return {
        w: createWanderer(((citySeed ^ 0xd06) + i * 7919) >>> 0, homeX, homeZ, WANDER_RADIUS, 1.3, 2.4),
        jitter: new RngStream(((citySeed ^ 0x5eed) + i * 104729) >>> 0),
        colorIndex: i % mat.fur.length,
      };
    });
  }, [citySeed, count, mat]);

  const groupRefs = useRef<(Group | null)[]>([]);
  const legRefs = useRef<(Group | null)[][]>(dogs.map(() => [null, null, null, null]));
  const tailRefs = useRef<(Group | null)[]>([]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const now = frameState.clock.elapsedSeconds;
    for (let i = 0; i < dogs.length; i++) {
      const d = dogs[i];
      const group = groupRefs.current[i];
      if (!d || !group) continue;

      // Shared wander behaviour (same tested path as NPCs/Pedestrians).
      const speed = stepWander(d.w, dt, now, WANDER_RADIUS, d.jitter);
      const moving = speed > 0;

      group.position.set(d.w.x, 0.34, d.w.z);
      group.rotation.y = d.w.yaw;

      // Gait: diagonal pairs (trot).
      const legs = legRefs.current[i];
      const s = moving ? Math.sin(d.w.phase * 1.7) * 0.55 : 0;
      const l0 = legs?.[0];
      const l1 = legs?.[1];
      const l2 = legs?.[2];
      const l3 = legs?.[3];
      if (l0 && l1 && l2 && l3) {
        l0.rotation.x = s;
        l3.rotation.x = s;
        l1.rotation.x = -s;
        l2.rotation.x = -s;
      }
      // Tail wag: faster when moving.
      const tail = tailRefs.current[i];
      if (tail) {
        tail.rotation.y = Math.sin(d.w.phase * (moving ? 2.4 : 0.9)) * (moving ? 0.5 : 0.22);
      }
      // Idle look-around.
      if (!moving) group.rotation.y += Math.sin(now * 0.7 + i * 2.1) * 0.0015;
    }
  });

  return (
    <group>
      {dogs.map((dog, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <mesh geometry={geo.body} material={mat.fur[dog.colorIndex]} castShadow rotation-x={Math.PI / 2} />
          <group position={[0, 0.12, 0.3]}>
            <mesh geometry={geo.head} material={mat.fur[dog.colorIndex]} castShadow />
            <mesh geometry={geo.snout} material={mat.dark} position={[0, -0.03, 0.14]} />
            <mesh geometry={geo.ear} material={mat.dark} position={[-0.07, 0.12, 0]} rotation-z={-0.16} />
            <mesh geometry={geo.ear} material={mat.dark} position={[0.07, 0.12, 0]} rotation-z={0.16} />
          </group>
          <group
            ref={(el) => {
              tailRefs.current[i] = el;
            }}
            position={[0, 0.1, -0.28]}
            rotation-x={0.7}
          >
            <mesh geometry={geo.tail} material={mat.dark} position={[0, 0.1, 0]} />
          </group>
          {[
            [-0.1, 0.2],
            [0.1, 0.2],
            [-0.1, -0.2],
            [0.1, -0.2],
          ].map((pair, li) => {
            const lx = pair[0] ?? 0;
            const lz = pair[1] ?? 0;
            return (
            <group
              key={li}
              ref={(el) => {
                const legs = legRefs.current[i];
                if (legs) legs[li] = el;
              }}
              position={[lx, -0.12, lz]}
            >
              <mesh geometry={geo.leg} material={mat.dark} position={[0, -0.1, 0]} castShadow />
            </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}
