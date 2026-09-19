import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { Stars } from "@react-three/drei";
import { DirectionalLight, HemisphereLight, Vector3, type Mesh } from "three";
import { PhysicsBridge } from "@/engine/physics/PhysicsBridge";
import { physicsRuntime } from "@/engine/physics/PhysicsRuntime";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectMode, selectQuality } from "@/state/selectors";
import { MODE_GRAVITY } from "@/engine/simulation/TimeOfDay";
import { setCurrentGravityY } from "@/engine/simulation/VehicleController";
import { SkyDome } from "./celestial/SkyDome";
import { SunMesh } from "./celestial/SunMesh";
import { Ground } from "./environment/Ground";
import { CloudLayer } from "./environment/CloudLayer";
import { RainSystem } from "./effects/RainSystem";
import { City } from "./buildings/City";
import { Vehicle } from "./vehicles/Vehicle";
import { Player, getPlayerBody } from "./entities/Player";
import { CameraRig } from "./entities/CameraRig";
import { NPCManager, npcShared } from "./entities/NPCManager";
import { Dogs } from "./entities/Dogs";
import { Pedestrians } from "./entities/Pedestrians";
import { Traffic } from "./entities/Traffic";
import { LightningBolt } from "./effects/LightningBolt";
import { Birds } from "./entities/Birds";
import { InteractionSystem } from "./entities/InteractionSystem";
import { AmbientParticles } from "./effects/AmbientParticles";
import { ExhaustParticles } from "./effects/ExhaustParticles";
import { PostFX } from "./effects/PostFX";
import { frameState } from "@/state/transient/frameState";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("world-scene");

/**
 * Metropolitan scene root (METROPOLIS + LOW_GRAVITY modes).
 *
 * Composition: environment → instanced city → physics actors → effects →
 * post-processing. Mode switches adjust gravity + lighting without
 * remounting the scene; scene switches (space/lab) unmount the whole
 * subtree, tearing down the Rapier world and disposing GPU resources (§22).
 */
export function WorldScene(): React.JSX.Element {
  const mode = useSettingsStore(selectMode);
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const simulationRate = useSettingsStore((st) => st.simulationRate);

  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const [sunMesh, setSunMesh] = useState<Mesh | null>(null);

  // Mode → gravity configuration (immediate, direct Rapier world access
  // through the runtime facade, §7).
  useEffect(() => {
    const gravity = MODE_GRAVITY[mode] ?? MODE_GRAVITY.METROPOLIS!;
    setCurrentGravityY(gravity.y);
    if (physicsRuntime.isBound) physicsRuntime.setGravity(gravity);
    log.info(`mode ${mode}: gravity=(${gravity.x}, ${gravity.y}, ${gravity.z})`);
  }, [mode]);

  // Camera clipping per scene (§9); restore on unmount for the next scene.
  useEffect(() => {
    const cam = camera;
    const oldNear = cam.near;
    const oldFar = cam.far;
    cam.near = 0.12;
    cam.far = 7000;
    cam.updateProjectionMatrix();
    gl.shadowMap.enabled = profile.shadowEnabled;
    return () => {
      cam.near = oldNear;
      cam.far = oldFar;
      cam.updateProjectionMatrix();
    };
  }, [camera, gl, profile.shadowEnabled]);

  // Sun shadow follows the player so the ortho box stays tight (§21).
  const followTarget = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const light = sunRef.current;
    if (!light) return;
    const p = npcShared.playerPosition;
    followTarget.set(p.x, 0, p.z);
    light.position.copy(frameState.sunDirection).multiplyScalar(190).add(followTarget);
    light.target.position.copy(followTarget);
    light.target.updateMatrixWorld();
    light.intensity = frameState.sunIntensity + frameState.weather.lightning * 12;
    light.color.copy(frameState.sunColor);

    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(frameState.zenithColor);
      hemi.groundColor.copy(frameState.horizonColor).multiplyScalar(0.35);
      hemi.intensity = 0.25 + 0.65 * (1 - frameState.nightFactor);
    }
  });

  return (
    <>
      <SkyDome />
      <SunMesh onReady={(m) => setSunMesh(m)} />
      <hemisphereLight ref={hemiRef} intensity={0.6} />
      <directionalLight
        ref={sunRef}
        castShadow={profile.shadowEnabled}
        shadow-mapSize-width={profile.shadowMapSize}
        shadow-mapSize-height={profile.shadowMapSize}
        shadow-camera-near={10}
        shadow-camera-far={480}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-bias={-0.0004}
        intensity={3}
      />
      <Stars
        radius={2600}
        depth={120}
        count={profile.starCount}
        factor={5}
        saturation={0.4}
        fade
        speed={0.6}
      />

      <Ground />
      <Suspense fallback={null}>
        <City />
      </Suspense>

      {/* Own Suspense boundary: Rapier's WASM suspension must NOT bubble to
          the Canvas root boundary (which would block the whole scene). With
          this boundary the city renders progressively while WASM decodes. */}
      <Suspense fallback={null}>
        <Physics
          gravity={[0, -9.81, 0]}
          timeStep={(1 / 60) * simulationRate}
          numSolverIterations={profile.solverIterations}
        >
          <PhysicsBridge baseTimeStep={(1 / 60) * simulationRate} />
          <GroundCollider />
          <Player />
          <Vehicle />
          <NPCManager />
        </Physics>
      </Suspense>

      <AmbientParticles />
      <ExhaustParticles />
      <CloudLayer />
      <RainSystem />
      <Dogs />
      <Pedestrians />
      <Traffic />
      <Birds />
      <LightningBolt />

      <CameraRig />
      <InteractionSystem />
      <PlayerPositionBridge />

      <Suspense fallback={null}>
        <PostFX sunMesh={sunMesh} />
      </Suspense>
    </>
  );
}

/** Invisible static collider matching the visible ground planes. */
function GroundCollider(): React.JSX.Element {
  return (
    <RigidBody type="fixed" colliders={false} friction={1.1}>
      <CuboidCollider args={[2000, 0.5, 2000]} position={[0, -0.5, 0]} />
    </RigidBody>
  );
}

/** Publishes the on-foot player body position into the shared holder. */
function PlayerPositionBridge(): null {
  const saveAccum = useRef(0);
  useFrame((_, delta) => {
    const body = getPlayerBody();
    if (!body || !body.isEnabled()) return;
    const t = body.translation();
    npcShared.playerPosition.x = t.x;
    npcShared.playerPosition.y = t.y;
    npcShared.playerPosition.z = t.z;
    // Persistent world state (§33): snapshot the on-foot position every 5 s
    // (throttled — store writes are human-frequency, never per frame).
    saveAccum.current += Math.min(delta, 0.1);
    if (saveAccum.current > 5) {
      saveAccum.current = 0;
      const store = useSettingsStore.getState();
      const dx = t.x - store.home.x;
      const dz = t.z - store.home.z;
      if (dx * dx + dz * dz > 16) store.setHome(t.x, t.z);
    }
  });
  return null;
}
