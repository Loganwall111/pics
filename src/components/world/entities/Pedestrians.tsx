import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Group,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { RngStream } from "@/lib/math/Random";
import { squareLoopLength, squareLoopPoint, type PathPoint } from "@/lib/math/paths";
import { dampAngle } from "@/lib/math/Scalar";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * Ambient AI pedestrians (§33 "AI-controlled NPCs" — first tier).
 *
 * Simplified figures (shared geometry, per-pedestrian clothing tint) walking
 * closed sidewalk circuits: deterministic arc-length integration over
 * `squareLoopPoint`, per-pedestrian speed/direction/phase from the city
 * seed. Velocity-synced leg swing, corner heading damping, occasional
 * pause-free flow (no physics bodies — same documented trade-off as Dogs:
 * the 16.6 ms budget stays with the player and vehicles).
 */
const LOOPS = [24, 33, 42];

interface PedState {
  loopR: number;
  arc: number;
  speed: number;
  direction: 1 | -1;
  phase: number;
  yaw: number;
  colorIndex: number;
}

export function Pedestrians(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const quality = useSettingsStore((s) => s.quality);
  const count = quality === "low" ? 3 : 8;

  const geo = useMemo(
    () => ({
      torso: new CapsuleGeometry(0.15, 0.34, 6, 10),
      head: new SphereGeometry(0.1, 12, 10),
      leg: new BoxGeometry(0.09, 0.5, 0.1),
    }),
    []
  );

  const clothes = useMemo(
    () =>
      ["#b8c2cf", "#7a8ba0", "#9b8a7a", "#6d7f6a", "#a06d6d", "#5d6b85"].map(
        (c) => new MeshStandardMaterial({ color: new Color(c), roughness: 0.85, metalness: 0 })
      ),
    []
  );
  const skinMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color("#dcae94"), roughness: 0.65, metalness: 0 }),
    []
  );
  const legMat = useMemo(
    () => new MeshStandardMaterial({ color: new Color("#3a4354"), roughness: 0.9, metalness: 0 }),
    []
  );

  useEffect(() => {
    return () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const m of clothes) m.dispose();
      skinMat.dispose();
      legMat.dispose();
    };
  }, [geo, clothes, skinMat, legMat]);

  const peds = useMemo<PedState[]>(() => {
    const rng = new RngStream(citySeed ^ 0x9e5);
    return Array.from({ length: count }, (_, i) => {
      const loopR = LOOPS[i % LOOPS.length] ?? 24;
      const perimeter = squareLoopLength(loopR);
      return {
        loopR,
        arc: rng.float() * perimeter,
        speed: 1.05 + rng.float() * 0.75,
        direction: rng.chance(0.5) ? 1 : -1,
        phase: rng.float() * Math.PI * 2,
        yaw: 0,
        colorIndex: i % clothes.length,
      };
    });
  }, [citySeed, count, clothes]);

  const groupRefs = useRef<(Group | null)[]>([]);
  const legRefs = useRef<(Group | null)[][]>(peds.map(() => [null, null]));
  const scratch = useMemo<PathPoint>(() => ({ x: 0, z: 0, tx: 0, tz: 0 }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    for (let i = 0; i < peds.length; i++) {
      const ped = peds[i];
      const group = groupRefs.current[i];
      if (!ped || !group) continue;

      ped.arc += ped.speed * ped.direction * dt;
      squareLoopPoint(ped.loopR, ped.arc, scratch);
      group.position.set(scratch.x, 0, scratch.z);

      const targetYaw = Math.atan2(scratch.tx * ped.direction, scratch.tz * ped.direction);
      ped.yaw = dampAngle(ped.yaw, targetYaw, 8, dt);
      group.rotation.y = ped.yaw;

      ped.phase += ped.speed * dt * 3.4;
      const swing = Math.sin(ped.phase) * 0.5;
      const legs = legRefs.current[i];
      const legL = legs?.[0];
      const legR = legs?.[1];
      if (legL && legR) {
        legL.rotation.x = swing;
        legR.rotation.x = -swing;
      }
    }
  });

  return (
    <group>
      {peds.map((ped, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <mesh geometry={geo.torso} material={clothes[ped.colorIndex]} castShadow position={[0, 1.02, 0]} />
          <mesh geometry={geo.head} material={skinMat} castShadow position={[0, 1.44, 0]} />
          <group
            ref={(el) => {
              const legs = legRefs.current[i];
              if (legs) legs[0] = el;
            }}
            position={[-0.075, 0.52, 0]}
          >
            <mesh geometry={geo.leg} material={legMat} castShadow position={[0, -0.25, 0]} />
          </group>
          <group
            ref={(el) => {
              const legs = legRefs.current[i];
              if (legs) legs[1] = el;
            }}
            position={[0.075, 0.52, 0]}
          >
            <mesh geometry={geo.leg} material={legMat} castShadow position={[0, -0.25, 0]} />
          </group>
        </group>
      ))}
    </group>
  );
}
