import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from "@react-three/rapier";
import { Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HalfFloatType,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { PhysicsBridge } from "@/engine/physics/PhysicsBridge";
import {
  FloatingOriginController,
  type OriginSubject,
} from "@/engine/simulation/FloatingOrigin";
import {
  MU_AETHER,
  orbitalPeriod,
  propagate,
  perifocalToInertial,
  type OrbitalElements,
  type Vec3,
} from "@/lib/orbital/OrbitalMechanics";
import { SimAction } from "@/engine/input/actions";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { getQualityProfile } from "@/engine/rendering/quality";
import { originSubjects } from "@/components/world/entities/CameraRig";
import { emitExhaustParticle } from "@/components/world/effects/ExhaustParticles";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("space-scene");

/**
 * Orbital / deep-space scene (§9, §10).
 *
 * Scale convention: 1 render unit = 1000 km. The Aether system is a compact
 * fictional star system (μ = 5·10⁶ km³/s²) whose five planets follow real
 * Keplerian ellipses propagated analytically from classical elements, with a
 * documented time compression so motion is observable in gameplay
 * timeframes. Ship flight is Newtonian (impulse = F·dt) in these units.
 *
 * Floating origin (§9, §32): sim-space positions live in float64 JS numbers.
 * Render-space positions are computed per frame as `sim − (ship + origin)`,
 * and when the ship strays past the rebase threshold its physics body, the
 * camera subjects and the decorative star shell are shifted together so
 * every float32 GPU transform stays small and precise.
 */

const PROPAGATION_TIME_SCALE = 260; // simulated seconds per real second
const ORBIT_COLOR = 0x2b6f8f;
const UNIT_KM = 1000;

interface PlanetDefinition {
  name: string;
  elements: OrbitalElements;
  radius: number; // render units (visually exaggerated ×3 — documented)
  color: number;
  ring?: boolean;
}

const PLANETS: readonly PlanetDefinition[] = [
  { name: "Cinder",    elements: { a: 14000,  e: 0.206, i: 0.12, raan: 0.4, argP: 1.1, M0: 0.2 }, radius: 5,  color: 0xb0664a },
  { name: "Verdance",  elements: { a: 26000,  e: 0.017, i: 0.05, raan: 1.8, argP: 0.3, M0: 2.4 }, radius: 9,  color: 0x4fae6a },
  { name: "Aetherra",  elements: { a: 41000,  e: 0.032, i: 0.02, raan: 2.7, argP: 2.2, M0: 4.4 }, radius: 11, color: 0x3f7fbf, ring: true },
  { name: "Halcyon",   elements: { a: 68000,  e: 0.048, i: 0.06, raan: 4.1, argP: 5.0, M0: 1.1 }, radius: 15, color: 0xc9a36a },
  { name: "Umbriel-9", elements: { a: 105000, e: 0.089, i: 0.15, raan: 5.3, argP: 3.6, M0: 5.5 }, radius: 8,  color: 0x7a6f9e },
];

/** Ship body accessor (camera + HUD). Null outside the space scene. */
let shipBody: RapierRigidBody | null = null;
export function getShipBody(): RapierRigidBody | null {
  return shipBody;
}

export function SpaceScene(): React.JSX.Element {
  const quality = useSettingsStore(selectQuality);
  const simulationRate = useSettingsStore((st) => st.simulationRate);
  const profile = getQualityProfile(quality);
  const camera = useThree((s) => s.camera);

  const originController = useMemo(() => new FloatingOriginController(), []);
  const starFrameRef = useRef<Group>(null); // star + orbit lines at sim origin
  const starsRef = useRef<Group>(null);     // decorative far shell

  useEffect(() => {
    const oldNear = camera.near;
    const oldFar = camera.far;
    camera.near = 0.4;
    camera.far = 400000;
    camera.updateProjectionMatrix();
    return () => {
      camera.near = oldNear;
      camera.far = oldFar;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  useEffect(() => {
    const store = useSimulationStore.getState();
    store.setPlayerState("flying");
    log.info("space scene engaged: Newtonian flight + Keplerian ephemeris");
    return () => {
      shipBody = null;
      originController.reset();
      frameState.originOffset.set(0, 0, 0);
      useSimulationStore.getState().setPlayerState("on-foot");
    };
  }, [originController]);

  return (
    <>
      <group ref={starsRef}>
        <Stars
          radius={60000}
          depth={20000}
          count={profile.starCount * 2}
          factor={900}
          saturation={0.15}
          fade
          speed={0.2}
        />
      </group>
      <StarFrame ref={starFrameRef} />
      <PlanetSystem originController={originController} starFrameRef={starFrameRef} />
      {/* Local Suspense boundary — see WorldScene note (§5 progressive boot). */}
      <Suspense fallback={null}>
        <Physics gravity={[0, 0, 0]} timeStep={(1 / 60) * simulationRate} numSolverIterations={profile.solverIterations}>
          <PhysicsBridge baseTimeStep={(1 / 60) * simulationRate} />
          <Spacecraft />
        </Physics>
      </Suspense>
      <SpaceLightRig />
      <SpacePostFX />
      <RebaseProbe originController={originController} starsRef={starsRef} />
    </>
  );
}

/**
 * Star + orbit lines share one group anchored at the star's RENDER position:
 * render = simOrigin − shipSim. Repositioned every frame (cheap, exact).
 */
const StarFrame = ({ ref }: { ref: React.RefObject<Group | null> }): React.JSX.Element => {
  const coreGeo = useMemo(() => new SphereGeometry(60, 32, 24), []);
  const coreMat = useMemo(
    () => new MeshBasicMaterial({ color: new Color(4.5, 4.0, 3.2), toneMapped: false, fog: false }),
    []
  );
  const haloGeo = useMemo(() => new SphereGeometry(92, 24, 18), []);
  const haloMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0.14,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    []
  );

  const orbitLines = useMemo(
    () =>
      PLANETS.map((planet) => {
        const N = 160;
        const positions = new Float32Array((N + 1) * 3);
        const p = planet.elements.a * (1 - planet.elements.e * planet.elements.e);
        for (let k = 0; k <= N; k++) {
          const nu = (k / N) * Math.PI * 2;
          const r = p / (1 + planet.elements.e * Math.cos(nu));
          const v: Vec3 = perifocalToInertial(
            { x: r * Math.cos(nu), y: r * Math.sin(nu), z: 0 },
            planet.elements.raan,
            planet.elements.i,
            planet.elements.argP
          );
          positions[k * 3] = v.x / UNIT_KM;
          positions[k * 3 + 1] = v.z / UNIT_KM; // orbital +Z (pole) → render +Y
          positions[k * 3 + 2] = v.y / UNIT_KM;
        }
        const geo = new BufferGeometry();
        geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
        const mat = new LineBasicMaterial({ color: ORBIT_COLOR, transparent: true, opacity: 0.32 });
        return new Line(geo, mat);
      }),
    []
  );

  useEffect(() => {
    return () => {
      coreGeo.dispose();
      coreMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      for (const l of orbitLines) {
        l.geometry.dispose();
        (l.material as LineBasicMaterial).dispose();
      }
    };
  }, [coreGeo, coreMat, haloGeo, haloMat, orbitLines]);

  return (
    <group ref={ref}>
      <mesh geometry={coreGeo} material={coreMat} />
      <mesh geometry={haloGeo} material={haloMat} />
      {orbitLines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
};

/**
 * Keplerian planets: analytic propagation each frame (float64 sim space),
 * translated into rebased render space relative to the ship.
 */
function PlanetSystem({
  originController,
  starFrameRef,
}: {
  originController: FloatingOriginController;
  starFrameRef: React.RefObject<Group | null>;
}): React.JSX.Element {
  const meshesRef = useRef<(Mesh | null)[]>(PLANETS.map(() => null));

  const planetGeos = useMemo(() => PLANETS.map((p) => new SphereGeometry(p.radius, 28, 20)), []);
  const planetMats = useMemo(
    () => PLANETS.map((p) => new MeshStandardMaterial({ color: p.color, roughness: 0.8, metalness: 0 })),
    []
  );
  const ringGeo = useMemo(() => new TorusGeometry(20, 1.6, 2, 64), []);
  const ringMat = useMemo(
    () => new MeshBasicMaterial({ color: 0x9fc8e8, transparent: true, opacity: 0.4 }),
    []
  );

  useEffect(() => {
    return () => {
      for (const g of planetGeos) g.dispose();
      for (const m of planetMats) m.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    };
  }, [planetGeos, planetMats, ringGeo, ringMat]);

  const simPos = useMemo(() => new Vector3(), []);
  const accum = useRef(0);

  useFrame((_, delta) => {
    accum.current += Math.min(delta, 0.1) * PROPAGATION_TIME_SCALE;
    const ship = getShipBody();
    if (!ship) return;
    const s = ship.translation();
    // Anchor: ship sim-space position in units.
    const ax = s.x + originController.totalX;
    const ay = s.y + originController.totalY;
    const az = s.z + originController.totalZ;

    // Star frame at sim origin → render = −anchor.
    const frame = starFrameRef.current;
    if (frame) frame.position.set(-s.x, -s.y, -s.z);

    for (let i = 0; i < PLANETS.length; i++) {
      const def = PLANETS[i];
      const mesh = meshesRef.current[i];
      if (!def || !mesh) continue;
      const state = propagate(def.elements, accum.current, MU_AETHER);
      simPos.set(state.position.x / UNIT_KM, state.position.z / UNIT_KM, state.position.y / UNIT_KM);
      mesh.position.set(simPos.x - ax, simPos.y - ay, simPos.z - az);
      mesh.rotation.y = accum.current * 0.02 + i;
    }
  });

  return (
    <group>
      {PLANETS.map((planet, i) => (
        <mesh
          key={planet.name}
          ref={(el) => {
            meshesRef.current[i] = el;
          }}
          geometry={planetGeos[i]}
          material={planetMats[i]}
        >
          {planet.ring ? <mesh geometry={ringGeo} material={ringMat} rotation-x={Math.PI / 2.4} /> : null}
        </mesh>
      ))}
    </group>
  );
}

/**
 * Newtonian spacecraft (§9): thrust along ship axes, torque from look input,
 * toggleable inertial dampers, boost, warp jumps (exercises the floating
 * origin), pooled exhaust. All forces are Rapier impulses (F·dt).
 */
function Spacecraft(): React.JSX.Element {
  const bodyRef = useRef<RapierRigidBody>(null);
  const engineRef = useRef<Mesh>(null);

  const hullGeo = useMemo(() => new SphereGeometry(1, 18, 12), []);
  const hullMat = useMemo(() => new MeshStandardMaterial({ color: 0xb8c4d4, metalness: 0.85, roughness: 0.28 }), []);
  const wingGeo = useMemo(() => new BoxGeometry(5.6, 0.12, 2.2), []);
  const wingMat = useMemo(() => new MeshStandardMaterial({ color: 0x2e3d52, metalness: 0.7, roughness: 0.35 }), []);
  const engineGeo = useMemo(() => new SphereGeometry(0.42, 10, 8), []);
  const engineMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(1.6, 2.6, 4.2),
        toneMapped: false,
        blending: AdditiveBlending,
        transparent: true,
      }),
    []
  );

  const dampers = useRef(true);
  const thrustVisual = useRef(0);

  const scratch = useMemo(
    () => ({
      fwd: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      quat: { x: 0, y: 0, z: 0, w: 1 },
      force: new Vector3(),
      torque: new Vector3(),
      vel: new Vector3(),
    }),
    []
  );

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
    shipBody = body;
    const input = frameState.input;
    const dt = frameState.clock.fixedDeltaSeconds;
    const store = useSimulationStore.getState();
    if (store.dialogue.active || !input) return;

    const r = body.rotation();
    scratch.quat.x = r.x;
    scratch.quat.y = r.y;
    scratch.quat.z = r.z;
    scratch.quat.w = r.w;
    scratch.fwd.set(0, 0, -1).applyQuaternion(scratch.quat);
    scratch.right.set(1, 0, 0).applyQuaternion(scratch.quat);
    scratch.up.set(0, 1, 0).applyQuaternion(scratch.quat);

    const mass = Math.max(body.mass(), 1);
    const boost = input.isDown(SimAction.Boost) ? 3.1 : 1;
    const mainThrust =
      (input.isDown(SimAction.MoveForward) ? 1 : 0) - (input.isDown(SimAction.MoveBackward) ? 0.45 : 0);
    const lateral = (input.isDown(SimAction.MoveRight) ? 1 : 0) - (input.isDown(SimAction.MoveLeft) ? 1 : 0);
    const vertical = (input.isDown(SimAction.Ascend) ? 1 : 0) - (input.isDown(SimAction.Descend) ? 1 : 0);

    scratch.force.set(0, 0, 0);
    scratch.force.addScaledVector(scratch.fwd, mainThrust * 26 * boost);
    scratch.force.addScaledVector(scratch.right, lateral * 12);
    scratch.force.addScaledVector(scratch.up, vertical * 12);
    scratch.force.multiplyScalar(mass * dt);

    if (input.wasPressed(SimAction.ToggleDampers)) dampers.current = !dampers.current;
    const lv = body.linvel();
    scratch.vel.set(lv.x, lv.y, lv.z);
    if (dampers.current) scratch.force.addScaledVector(scratch.vel, -0.55 * mass * dt);
    frameState.player.dampers = dampers.current;

    body.applyImpulse({ x: scratch.force.x, y: scratch.force.y, z: scratch.force.z }, true);

    // Pitch/yaw from look input; torque with angular damping folded in.
    const av = body.angvel();
    scratch.torque
      .set(
        (-input.lookY * 240 - av.x * 60) * mass * dt,
        (-input.lookX * 240 - av.y * 60) * mass * dt,
        0
      );
    body.applyTorqueImpulse({ x: scratch.torque.x, y: scratch.torque.y, z: scratch.torque.z }, true);

    // Safety speed clamp (numerical escape guard, §32).
    const speed = scratch.vel.length();
    if (speed > 400) {
      scratch.vel.multiplyScalar(400 / speed);
      body.setLinvel({ x: scratch.vel.x, y: scratch.vel.y, z: scratch.vel.z }, true);
    }

    // Warp jump: teleport 600 units along facing — honestly exercises the
    // floating-origin rebase (§9) and shows in the HUD origin counter.
    if (input.wasPressed(SimAction.WarpJump)) {
      const t = body.translation();
      body.setTranslation(
        { x: t.x + scratch.fwd.x * 600, y: t.y + scratch.fwd.y * 600, z: t.z + scratch.fwd.z * 600 },
        true
      );
    }

    thrustVisual.current += (Math.abs(mainThrust) * boost - thrustVisual.current) * Math.min(1, dt * 8);

    if (Math.abs(mainThrust) > 0.1) {
      const t = body.translation();
      emitExhaustParticle(
        t.x - scratch.fwd.x * 2.6,
        t.y - scratch.fwd.y * 2.6,
        t.z - scratch.fwd.z * 2.6,
        -scratch.fwd.x * 8,
        -scratch.fwd.y * 8,
        -scratch.fwd.z * 8
      );
    }
  });

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const v = body.linvel();
    // HUD speed: units/s → km/h (1 unit = 1000 km).
    frameState.player.speedKmh = Math.hypot(v.x, v.y, v.z) * UNIT_KM * 3.6;
    if (engineRef.current) {
      const s = 0.7 + thrustVisual.current * 0.9;
      engineRef.current.scale.set(s, s, s * 2.2);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={[0, 0, 90]}
      colliders={false}
      linearDamping={0}
      angularDamping={0.28}
      ccd
      name="ship"
    >
      <CuboidCollider args={[1.2, 0.9, 2.8]} density={40} friction={0.2} />
      <mesh geometry={hullGeo} material={hullMat} scale={[1.1, 0.8, 2.4]} />
      <mesh geometry={wingGeo} material={wingMat} position={[0, -0.1, 0.4]} />
      <mesh geometry={engineGeo} material={engineMat} ref={engineRef} position={[0, 0, 2.6]} />
    </RigidBody>
  );
}

/**
 * Floating-origin rebase probe (§9): after all per-frame writes, if the ship
 * exceeded the threshold, shift the ship body, camera subjects and the
 * decorative star shell together. Planet/star-frame positions are computed
 * from sim space every frame and need no shifting.
 */
function RebaseProbe({
  originController,
  starsRef,
}: {
  originController: FloatingOriginController;
  starsRef: React.RefObject<Group | null>;
}): null {
  useEffect(() => {
    const shipSubject: OriginSubject = {
      applyOriginOffset(dx, dy, dz) {
        const body = getShipBody();
        if (!body) return;
        const t = body.translation();
        body.setTranslation({ x: t.x + dx, y: t.y + dy, z: t.z + dz }, false);
      },
    };
    const starsSubject: OriginSubject = {
      applyOriginOffset(dx, dy, dz) {
        const g = starsRef.current;
        if (g) g.position.set(g.position.x + dx, g.position.y + dy, g.position.z + dz);
      },
    };
    originController.register(shipSubject);
    originController.register(starsSubject);
    for (const s of originSubjects) originController.register(s);
    return () => {
      originController.unregister(shipSubject);
      originController.unregister(starsSubject);
      for (const s of originSubjects) originController.unregister(s);
    };
  }, [originController, starsRef]);

  useFrame(() => {
    const body = getShipBody();
    if (!body) return;
    const t = body.translation();
    const shift = originController.update(t);
    if (shift) {
      frameState.originOffset.set(shift.totalX, shift.totalY, shift.totalZ);
      log.info(
        `floating origin rebased: cumulative (${shift.totalX.toFixed(0)}, ${shift.totalY.toFixed(0)}, ${shift.totalZ.toFixed(0)}) units`
      );
    }
  });
  return null;
}

/** Starlight: directional light aimed from the star toward the ship. */
function SpaceLightRig(): React.JSX.Element {
  const lightRef = useRef<DirectionalLight>(null);
  const dir = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const light = lightRef.current;
    const ship = getShipBody();
    if (!light || !ship) return;
    const t = ship.translation();
    // Ship sits ~90 units from the star at spawn; light from that direction.
    dir.set(-t.x, -t.y, -t.z).normalize();
    target.copy(dir).multiplyScalar(120);
    light.position.set(target.x, target.y, target.z);
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  });
  return (
    <>
      <directionalLight ref={lightRef} intensity={2.6} color={0xfff1dc} />
      <ambientLight intensity={0.06} />
    </>
  );
}

/** Space post: bloom + vignette (no atmosphere → no god-ray mask). */
function SpacePostFX(): React.JSX.Element | null {
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);
  if (!profile.bloomEnabled) return null;
  return (
    <EffectComposer multisampling={profile.multisampling} frameBufferType={HalfFloatType}>
      <Bloom intensity={0.85} luminanceThreshold={0.62} luminanceSmoothing={0.3} mipmapBlur />
      <Vignette offset={0.25} darkness={0.62} />
    </EffectComposer>
  );
}

/** Orbital period report — displayed by diagnostics, asserted by tests. */
export function reportOrbitalPeriods(): { name: string; periodHours: number }[] {
  return PLANETS.map((p) => ({
    name: p.name,
    periodHours: orbitalPeriod(p.elements.a, MU_AETHER) / 3600,
  }));
}
