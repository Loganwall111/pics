import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Grid } from "@react-three/drei";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry } from "three";
import { PhysicsBridge } from "@/engine/physics/PhysicsBridge";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { RngStream } from "@/lib/math/Random";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("lab-scene");

/**
 * Quantum / multi-mass physics laboratory (§16).
 *
 * A stress-test arena: bounded spawn/despawn queue of variable-mass rigid
 * bodies under user-configured gravity, mass multiplier, spawn rate, solver
 * iterations and simulation speed. The "quantum uncertainty" behaviour is a
 * VISUALIZED PROBABILISTIC CONCEPT (seeded stochastic impulses) — explicitly
 * not a claim of physical quantum mechanics.
 *
 * Spawn/despawn queue: spawns accumulate on a deterministic timer; removal
 * happens after a fixed lifetime (FIFO). React state changes only at spawn /
 * despawn events (a few per second), never per frame.
 */

type Shape = "box" | "sphere" | "cylinder";

interface LabBody {
  id: number;
  shape: Shape;
  mass: number;
  x: number;
  z: number;
  hue: number;
  spawnedAt: number;
}

const LIFETIME_SECONDS = 26;
const MAX_ENTITIES = 400;

export function LabScene(): React.JSX.Element {
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);
  const lab = useSettingsStore((s) => s.lab);

  const [bodies, setBodies] = useState<LabBody[]>([]);
  const nextId = useRef(1);

  // Deterministic spawn sequence derived from the lab seed (§16).
  const rng = useMemo(() => new RngStream(lab.seed >>> 0), [lab.seed]);

  const shared = useMemo(() => {
    const box = new BoxGeometry(0.9, 0.9, 0.9);
    const sphere = new SphereGeometry(0.55, 18, 14);
    const cylinder = new CylinderGeometry(0.45, 0.45, 1.1, 16);
    const materials = [0x37e0ff, 0xff5fd2, 0xffc857, 0x7dff8a].map(
      (c) => new MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.25 })
    );
    return { geos: [box, sphere, cylinder], materials };
  }, []);

  useEffect(() => {
    return () => {
      for (const g of shared.geos) g.dispose();
      for (const m of shared.materials) m.dispose();
    };
  }, [shared]);

  // Spawn/despawn queue driver (runs in the render loop, mutates state only
  // on queue events).
  const queue = useRef({ spawnCredit: 0, elapsed: 0, despawnTimer: 0 });
  const bodiesRef = useRef(bodies);
  bodiesRef.current = bodies;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1) * lab.simSpeed;
    queue.current.elapsed += dt;
    queue.current.spawnCredit += dt * lab.spawnRate;
    queue.current.despawnTimer += dt;

    let list = bodiesRef.current;
    let mutated = false;

    while (queue.current.spawnCredit >= 1 && list.length < Math.min(lab.maxBodies, MAX_ENTITIES)) {
      queue.current.spawnCredit -= 1;
      const shape: Shape = rng.chance(0.34) ? "box" : rng.chance(0.5) ? "sphere" : "cylinder";
      const mass = 0.4 + rng.float() * 5.5;
      const id = nextId.current++;
      list = [...list, {
        id,
        shape,
        mass,
        x: (rng.float() - 0.5) * 16,
        z: (rng.float() - 0.5) * 16,
        hue: rng.int(4),
        spawnedAt: queue.current.elapsed,
      }];
      mutated = true;
    }
    queue.current.spawnCredit = Math.min(queue.current.spawnCredit, lab.spawnRate * 2);

    if (queue.current.despawnTimer > 1) {
      queue.current.despawnTimer = 0;
      const cutoff = queue.current.elapsed - LIFETIME_SECONDS;
      const filtered = list.filter((b) => b.spawnedAt > cutoff);
      if (filtered.length !== list.length) {
        list = filtered;
        mutated = true;
      }
    }

    if (mutated) setBodies(list);
  });

  // Uncertainty impulses: seeded stochastic kicks on random active bodies.
  const uncertaintyAccum = useRef(0);
  const bodyRefs = useRef(new Map<number, RapierRigidBody>());
  const uncertaintyRng = useMemo(() => new RngStream(lab.seed ^ 0x91), [lab.seed]);

  useFrame((_, delta) => {
    if (!lab.uncertainty) return;
    uncertaintyAccum.current += Math.min(delta, 0.1) * lab.simSpeed;
    if (uncertaintyAccum.current < 0.45) return;
    uncertaintyAccum.current = 0;
    const count = bodiesRef.current.length;
    if (count === 0) return;
    const idx = uncertaintyRng.int(count);
    const pick = bodiesRef.current[idx];
    if (!pick) return;
    const body = bodyRefs.current.get(pick.id);
    if (!body) return;
    const kick = 1.2 + uncertaintyRng.float() * 2.4;
    body.applyImpulse(
      { x: uncertaintyRng.gaussian() * kick, y: Math.abs(uncertaintyRng.gaussian()) * kick * 1.6, z: uncertaintyRng.gaussian() * kick },
      true
    );
  });

  useEffect(() => {
    log.info(`lab configured: gravity=(${lab.gravityX}, ${lab.gravityY}, ${lab.gravityZ}) solver=${lab.solverIterations}`);
  }, [lab.gravityX, lab.gravityY, lab.gravityZ, lab.solverIterations]);

  return (
    <>
      <hemisphereLight intensity={0.5} />
      <directionalLight position={[18, 26, 12]} intensity={2.2} castShadow={profile.shadowEnabled} shadow-mapSize-width={profile.shadowMapSize} shadow-mapSize-height={profile.shadowMapSize} />
      {/* Local Suspense boundary — see WorldScene note (§5 progressive boot). */}
      <Suspense fallback={null}>
        <Physics
          gravity={[lab.gravityX, lab.gravityY, lab.gravityZ]}
          timeStep={(1 / 60) * lab.simSpeed}
          numSolverIterations={lab.solverIterations}
        >
        <PhysicsBridge baseTimeStep={(1 / 60) * lab.simSpeed} />
        {/* Arena floor + walls */}
        <RigidBody type="fixed" colliders={false} friction={1}>
          <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.5, 0]} />
          <CuboidCollider args={[30, 8, 0.5]} position={[0, 8, -30]} />
          <CuboidCollider args={[30, 8, 0.5]} position={[0, 8, 30]} />
          <CuboidCollider args={[0.5, 8, 30]} position={[-30, 8, 0]} />
          <CuboidCollider args={[0.5, 8, 30]} position={[30, 8, 0]} />
        </RigidBody>
        <mesh receiveShadow position={[0, -0.02, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#141a24" roughness={0.35} metalness={0.55} />
        </mesh>

        {bodies.map((b) => (
          <RigidBody
            key={b.id}
            position={[b.x, 16 + (b.id % 7) * 2.2, b.z]}
            mass={b.mass * lab.massMultiplier}
            restitution={0.35}
            friction={0.75}
            ref={(el) => {
              if (el) bodyRefs.current.set(b.id, el);
              else bodyRefs.current.delete(b.id);
            }}
          >
            <mesh geometry={shared.geos[b.shape === "box" ? 0 : b.shape === "sphere" ? 1 : 2]} material={shared.materials[b.hue]} castShadow />
          </RigidBody>
        ))}
        </Physics>
      </Suspense>

      <Grid
        position={[0, 0.02, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        sectionSize={6}
        sectionThickness={1.4}
        sectionColor="#1f6f8f"
        cellColor="#123"
        fadeDistance={70}
        fadeStrength={1.2}
        infiniteGrid
      />
    </>
  );
}

/** Live lab body count is reported through frameState.physics.bodies. */
