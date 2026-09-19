import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleGeometry, ConeGeometry, Group, MeshStandardMaterial, SphereGeometry, TorusGeometry, Color } from "three";
import type { Species } from "../game/creatures";
import { glowIntensity, totalLimbPairs, type TraitLevels } from "../game/traits";

/**
 * Procedural creature renderer (§creatures).
 *
 * Every species body plan renders live: capsule torso, limb pairs with
 * speed-synced gait (fin/tendril/leg styles change the swing), symmetric
 * eye cluster, tail chain, antennae, dorsal fin, emissive glow (stacks with
 * the Bioluminescence trait), Halo trait ring. Trait-driven morphs (limb
 * pairs, glow) apply instantly — evolution you can SEE.
 */

export function Creature({
  species,
  levels,
  speed,
  positionRef,
}: {
  species: Species;
  levels: TraitLevels;
  /** Current locomotion speed (drives gait). Mutated by the controller. */
  speed: { current: number };
  positionRef: React.MutableRefObject<Group | null>;
}): React.JSX.Element {
  const plan = species.plan;

  const geo = useMemo(
    () => ({
      body: new CapsuleGeometry(0.5, 1.0, 6, 14),
      eye: new SphereGeometry(1, 12, 10),
      limb: new CapsuleGeometry(0.09, 1.0, 4, 8),
      tail: new ConeGeometry(0.22, 1.0, 8),
      fin: new ConeGeometry(0.5, 1.0, 4),
      antenna: new CapsuleGeometry(0.03, 1.0, 3, 6),
      halo: new TorusGeometry(1.15, 0.05, 8, 40),
    }),
    []
  );

  const mats = useMemo(() => {
    const bodyColor = new Color().setHSL(plan.hue / 360, 0.72, 0.5);
    const accentColor = new Color().setHSL(plan.hueAccent / 360, 0.85, 0.6);
    return {
      body: new MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.12 }),
      accent: new MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.2 }),
      eye: new MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.15, emissive: accentColor, emissiveIntensity: 0.5 }),
      glow: new MeshStandardMaterial({ color: accentColor, roughness: 0.3, emissive: accentColor, emissiveIntensity: 1, transparent: true, opacity: 0.85 }),
    };
  }, [plan]);

  const bodyGroup = useRef<Group>(null);
  const limbRefs = useRef<(Group | null)[]>([]);
  const tailRefs = useRef<(Group | null)[]>([]);
  const haloRef = useRef<Group>(null);

  const limbPairs = totalLimbPairs(plan, levels);
  const glow = glowIntensity(plan, levels);

  useFrame((_, delta) => {
    const gaitPhase = (positionRef.current?.userData.phase as number | undefined) ?? 0;
    const sp = speed.current;
    void delta;
    for (let i = 0; i < limbRefs.current.length; i++) {
      const limb = limbRefs.current[i];
      if (!limb) continue;
      const phase = gaitPhase * (1 + i * 0.13) + (i % 2) * Math.PI;
      if (plan.limbStyle === "tendril") limb.rotation.z = Math.sin(phase) * 0.5;
      else if (plan.limbStyle === "fin") limb.rotation.x = Math.sin(phase) * 0.45;
      else limb.rotation.x = Math.sin(phase) * 0.62;
    }
    for (let i = 0; i < tailRefs.current.length; i++) {
      const seg = tailRefs.current[i];
      if (seg) seg.rotation.y = Math.sin(gaitPhase * 0.8 + i * 0.9) * (0.25 + sp * 0.03);
    }
    if (haloRef.current) haloRef.current.rotation.y += 0.012;
    mats.glow.emissiveIntensity = glow;
  });

  const scale = 0.9 + plan.bodyLength * 0.55;
  const limbLen = plan.limbLength * 1.6;
  const eyeRing = 0.32;

  return (
    <group ref={positionRef} scale={scale}>
      <group ref={bodyGroup}>
        {/* Torso */}
        <mesh geometry={geo.body} material={mats.body} rotation={[Math.PI / 2, 0, 0]} scale={[plan.bodyGirth, plan.bodyLength, plan.bodyGirth]} castShadow />
        {/* Eyes: ring arrangement facing forward */}
        {Array.from({ length: plan.eyeCount }, (_, e) => {
          const ang = (e / plan.eyeCount) * Math.PI - Math.PI / 2;
          return (
            <mesh
              key={e}
              geometry={geo.eye}
              material={mats.eye}
              position={[Math.sin(ang) * eyeRing, 0.18 + Math.cos(ang) * 0.08, plan.bodyLength * 0.72]}
              scale={plan.eyeSize * (plan.pattern === "rings" ? 1.3 : 1)}
            />
          );
        })}
        {/* Limb pairs */}
        {Array.from({ length: limbPairs }, (_, p) =>
          ([-1, 1] as const).map((side) => {
            const i = p * 2 + (side === 1 ? 1 : 0);
            return (
              <group
                key={i}
                ref={(el) => {
                  limbRefs.current[i] = el;
                }}
                position={[(side * plan.bodyGirth * 0.55), 0, plan.bodyLength * (0.45 - p * 0.35)]}
              >
                <mesh
                  geometry={geo.limb}
                  material={mats.accent}
                  position={[0, -limbLen / 2 - 0.1, 0]}
                  scale={[1, limbLen, 1]}
                  castShadow
                />
              </group>
            );
          })
        )}
        {/* Tail chain */}
        {plan.tail > 0.15
          ? Array.from({ length: 3 }, (_, t) => (
              <group
                key={t}
                ref={(el) => {
                  tailRefs.current[t] = el;
                }}
                position={[0, 0, t === 0 ? -plan.bodyLength * 0.72 : 0]}
              >
                <mesh
                  geometry={geo.tail}
                  material={mats.accent}
                  position={[0, 0, -0.45]}
                  rotation={[Math.PI / 2, 0, 0]}
                  scale={[1 - t * 0.25, (0.7 + plan.tail * 0.7) * (1 - t * 0.2), 1 - t * 0.25]}
                />
              </group>
            ))
          : null}
        {/* Antennae */}
        {plan.antennae
          ? ([-1, 1] as const).map((side, a) => (
              <mesh
                key={a}
                geometry={geo.antenna}
                material={mats.glow}
                position={[side * 0.14, plan.bodyGirth * 0.6 + 0.22, plan.bodyLength * 0.6]}
                rotation={[0.4, 0, side * -0.35]}
                scale={[1, 0.55, 1]}
              />
            ))
          : null}
        {/* Dorsal fin */}
        {plan.dorsalFin ? (
          <mesh geometry={geo.fin} material={mats.glow} position={[0, plan.bodyGirth * 0.85, -0.05]} scale={[0.12, 0.6, 0.75]} />
        ) : null}
        {/* Halo trait */}
        {levels.halo ? (
          <group ref={haloRef} position={[0, 1.15, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
            <mesh geometry={geo.halo} material={mats.glow} />
          </group>
        ) : null}
      </group>
    </group>
  );
}
