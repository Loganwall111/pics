import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Color, Group, MeshStandardMaterial } from "three";
import { RngStream } from "@/lib/math/Random";
import { frameState } from "@/state/transient/frameState";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { getQualityProfile } from "@/engine/rendering/quality";

/**
 * Ambient bird flocks (§33 — sky life).
 *
 * Cheap orbital flocking: each flock circles the city on a slow drifting ring
 * while individual birds hold formation offsets and flap. Weather-coupled —
 * flocks land (unmount from the frame work) while rain is heavy, and return
 * when it clears. Pure visual: no physics, shared geometry/materials,
 * disposed on unmount.
 */

const RAIN_GROUNDED = 0.45; // rain level above which birds shelter

interface BirdState {
  orbitRadius: number;
  angle: number;
  angularSpeed: number;
  height: number;
  bobPhase: number;
  flapPhase: number;
  slotAngle: number;
  slotRadius: number;
}

export function Birds(): React.JSX.Element | null {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const quality = useSettingsStore((s) => s.quality);
  const profile = getQualityProfile(quality);
  const count = profile.birdCount;

  const wingGeo = useMemo(() => new BoxGeometry(0.62, 0.04, 0.22), []);
  const bodyGeo = useMemo(() => new BoxGeometry(0.16, 0.14, 0.46), []);
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: new Color("#3d4652"), roughness: 0.8, metalness: 0.05 }),
    []
  );

  useEffect(() => {
    return () => {
      wingGeo.dispose();
      bodyGeo.dispose();
      mat.dispose();
    };
  }, [wingGeo, bodyGeo, mat]);

  const birds = useMemo<BirdState[]>(() => {
    if (count <= 0) return [];
    const rng = new RngStream(citySeed ^ 0x81bd);
    return Array.from({ length: count }, () => ({
      orbitRadius: 70 + rng.float() * 60,
      angle: rng.float() * Math.PI * 2,
      angularSpeed: (0.05 + rng.float() * 0.045) * (rng.chance(0.5) ? 1 : -1),
      height: 42 + rng.float() * 18,
      bobPhase: rng.float() * Math.PI * 2,
      flapPhase: rng.float() * Math.PI * 2,
      slotAngle: (rng.float() - 0.5) * 0.5,
      slotRadius: (rng.float() - 0.5) * 14,
    }));
  }, [citySeed, count]);

  const groupRefs = useRef<(Group | null)[]>([]);
  const wingLRefs = useRef<(Group | null)[]>([]);
  const wingRRefs = useRef<(Group | null)[]>([]);
  const flockRef = useRef<Group>(null);
  const grounded = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const rain = frameState.weather.rain;
    const flock = flockRef.current;
    if (!flock) return;

    // Shelter during heavy rain (and skip all per-bird work while grounded).
    const shouldGround = rain > RAIN_GROUNDED;
    if (shouldGround !== grounded.current) {
      grounded.current = shouldGround;
      flock.visible = !shouldGround;
    }
    if (shouldGround) return;

    // The flock's shared centre drifts around the city slowly.
    const t = frameState.clock.shaderTimeSeconds;
    flock.position.set(Math.sin(t * 0.02) * 30, 0, Math.cos(t * 0.016) * 30);

    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i];
      const group = groupRefs.current[i];
      if (!bird || !group) continue;

      bird.angle += bird.angularSpeed * dt;
      const a = bird.angle + bird.slotAngle;
      const r = bird.orbitRadius + bird.slotRadius;
      group.position.set(Math.cos(a) * r, bird.height + Math.sin(t * 1.3 + bird.bobPhase) * 1.6, Math.sin(a) * r);
      // Face the direction of travel (tangent of the orbit).
      const dirSign = bird.angularSpeed > 0 ? 1 : -1;
      group.rotation.y = Math.atan2(-Math.sin(a) * dirSign, Math.cos(a) * dirSign);

      bird.flapPhase += dt * 9;
      const flap = Math.sin(bird.flapPhase) * 0.65;
      const wl = wingLRefs.current[i];
      const wr = wingRRefs.current[i];
      if (wl) wl.rotation.z = flap;
      if (wr) wr.rotation.z = -flap;
    }
  });

  if (count <= 0) return null;

  return (
    <group ref={flockRef}>
      {birds.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <mesh geometry={bodyGeo} material={mat} castShadow />
          <group
            ref={(el) => {
              wingLRefs.current[i] = el;
            }}
            position={[-0.08, 0.04, 0]}
          >
            <mesh geometry={wingGeo} material={mat} position={[-0.34, 0, 0]} />
          </group>
          <group
            ref={(el) => {
              wingRRefs.current[i] = el;
            }}
            position={[0.08, 0.04, 0]}
          >
            <mesh geometry={wingGeo} material={mat} position={[0.34, 0, 0]} />
          </group>
        </group>
      ))}
    </group>
  );
}
