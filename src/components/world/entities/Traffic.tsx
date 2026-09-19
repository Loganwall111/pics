import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
} from "three";
import { RngStream } from "@/lib/math/Random";
import { squareLoopLength, squareLoopPoint, type PathPoint } from "@/lib/math/paths";
import { dampAngle } from "@/lib/math/Scalar";
import {
  headlightIntensity,
  streetLoopRadii,
  trafficSpeedFactor,
} from "@/lib/simulation/traffic";
import { frameState } from "@/state/transient/frameState";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { getQualityProfile } from "@/engine/rendering/quality";

/**
 * AI traffic (§33 — the city's streets carry life).
 *
 * Low-poly cars driving the road-centred square loops from
 * `streetLoopRadii` (pure, unit-tested): deterministic arc-length integration
 * via the shared `squareLoopPoint` path, right-hand lane offset, corner
 * heading damping. Weather-coupled: rain slows traffic and forces headlights;
 * darkness raises the beam intensity (pure mappings in `lib/simulation/
 * traffic.ts`). Cars are visual-only (no physics bodies) — same documented
 * trade-off as dogs/pedestrians: the 16.6 ms budget stays with the player
 * and the hero vehicle.
 */

const LANE = 2.2; // right-hand offset from the road centreline (m)
const HEADLIGHT_RANGE_BRIGHTNESS = 2.4;

const BODY_COLORS = ["#c23b3b", "#3b66c2", "#c2b43b", "#48b04f", "#b0b4bc", "#2e3340"];

interface CarState {
  loopR: number;
  arc: number;
  speed: number; // km/h-equivalent world units/s at dry
  direction: 1 | -1;
  yaw: number;
  colorIndex: number;
}

export function Traffic(): React.JSX.Element | null {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const quality = useSettingsStore((s) => s.quality);
  const profile = getQualityProfile(quality);
  const count = profile.trafficCount;

  const geo = useMemo(
    () => ({
      body: new BoxGeometry(1.9, 0.62, 4.3),
      cabin: new BoxGeometry(1.7, 0.5, 2.1),
      wheel: new CylinderGeometry(0.34, 0.34, 0.24, 12),
      light: new BoxGeometry(1.5, 0.14, 0.06),
    }),
    []
  );

  const mats = useMemo(() => {
    const bodies = BODY_COLORS.map(
      (c) => new MeshStandardMaterial({ color: new Color(c), roughness: 0.35, metalness: 0.55 })
    );
    return {
      bodies,
      glass: new MeshStandardMaterial({ color: 0x10141c, roughness: 0.15, metalness: 0.4 }),
      wheel: new MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9, metalness: 0 }),
      head: new MeshStandardMaterial({
        color: 0xfff6d8,
        emissive: 0xfff2c0,
        emissiveIntensity: 0,
        roughness: 0.3,
      }),
      tail: new MeshStandardMaterial({
        color: 0x4a0f0f,
        emissive: 0xff2a1a,
        emissiveIntensity: 0,
        roughness: 0.3,
      }),
    };
  }, []);

  useEffect(() => {
    return () => {
      geo.body.dispose();
      geo.cabin.dispose();
      geo.wheel.dispose();
      geo.light.dispose();
      for (const m of mats.bodies) m.dispose();
      mats.glass.dispose();
      mats.wheel.dispose();
      mats.head.dispose();
      mats.tail.dispose();
    };
  }, [geo, mats]);

  const cars = useMemo<CarState[]>(() => {
    if (count <= 0) return [];
    const rng = new RngStream(citySeed ^ 0x7baf);
    const radii = streetLoopRadii(46, 5, 3);
    return Array.from({ length: count }, (_, i) => {
      const loopR = radii[i % radii.length] ?? 23;
      return {
        loopR,
        arc: rng.float() * squareLoopLength(loopR),
        speed: 7.5 + rng.float() * 5.5,
        direction: i % 2 === 0 ? 1 : -1,
        yaw: 0,
        colorIndex: i % mats.bodies.length,
      };
    });
  }, [citySeed, count, mats]);

  const groupRefs = useRef<(Group | null)[]>([]);
  const scratch = useMemo<PathPoint>(() => ({ x: 0, z: 0, tx: 0, tz: 0 }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const weather = frameState.weather;
    const timeOfDay = useSettingsStore.getState().timeOfDay;
    const lights = headlightIntensity(timeOfDay, weather.rain);
    // Head/tail materials are shared — one write per frame, not per car.
    mats.head.emissiveIntensity = lights * HEADLIGHT_RANGE_BRIGHTNESS;
    mats.tail.emissiveIntensity = lights * 1.6;

    const speedFactor = trafficSpeedFactor(weather.rain);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const group = groupRefs.current[i];
      if (!car || !group) continue;

      car.arc += car.speed * speedFactor * car.direction * dt;
      squareLoopPoint(car.loopR, car.arc, scratch);

      // Right-hand traffic: offset along the right of the motion vector.
      const mx = scratch.tx * car.direction;
      const mz = scratch.tz * car.direction;
      group.position.set(scratch.x - mz * LANE, 0.7, scratch.z + mx * LANE);

      const targetYaw = Math.atan2(mx, mz);
      car.yaw = dampAngle(car.yaw, targetYaw, 10, dt);
      group.rotation.y = car.yaw;
    }
  });

  if (count <= 0) return null;

  return (
    <group>
      {cars.map((car, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <mesh geometry={geo.body} material={mats.bodies[car.colorIndex]} castShadow />
          <mesh geometry={geo.cabin} material={mats.glass} position={[0, 0.52, -0.2]} castShadow />
          {/* Wheels: static cylinders at the corners (visual-only cars). */}
          {([[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]] as const).map(([wx, wz], j) => (
            <mesh
              key={j}
              geometry={geo.wheel}
              material={mats.wheel}
              position={[wx, -0.36, wz]}
              rotation={[0, 0, Math.PI / 2]}
            />
          ))}
          {/* Head + tail light strips (shared emissive materials). */}
          <mesh geometry={geo.light} material={mats.head} position={[0, 0.05, 2.16]} />
          <mesh geometry={geo.light} material={mats.tail} position={[0, 0.05, -2.16]} />
        </group>
      ))}
    </group>
  );
}
