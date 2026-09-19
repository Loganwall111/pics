import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { WORLDS, type WorldId } from "../game/worlds";
import { getSpecies } from "../game/creatures";
import { speedMultiplier, type TraitLevels } from "../game/traits";
import { PORTAL_POS, moteLayout } from "../game/layout";
import type { JourneyState } from "../game/journey";
import { Creature } from "./Creature";
import { TextureLoader, RepeatWrapping, SRGBColorSpace } from "three";
import { lumitalAudio, worldBaseHz } from "../game/audio";
import psyGroundUrl from "../assets/psychedelic-ground.jpg";
import cellFloorUrl from "../assets/cell-floor.jpg";
import grassUrl from "../assets/grass.jpg";
import soilUrl from "../assets/farm-soil.jpg";
import stoneUrl from "../assets/stone-wall.jpg";
import {
  BLACKHOLE_FRAGMENT,
  MENGER_FRAGMENT,
  PSYCHEDELIC_FRAGMENT,
  SKY_VERTEX,
} from "./shaders";

/**
 * LUMITAL world renderer + kinematic journey controller (§worlds).
 *
 * The creature walks the analytic terrain of the current world (pure fns
 * from worlds.ts — the physics for this game), collects DNA motes, crosses
 * the portal to the next world in the journey, and can seed colonies (B).
 * Three skydome programs carry the showpiece visuals: gravitational
 * lensing (Event Horizon), a raymarched Menger labyrinth (Fractal), and a
 * domain-warped psychedelic nebula (Void).
 */

const GRAVITY = -22;
const JUMP_SPEED = 9;

interface JourneyInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  yaw: number;
  firstPerson: boolean;
}

function makeSkyMaterial(fragmentSrc: string, uniforms: Record<string, { value: unknown }>): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: fragmentSrc,
    uniforms: uniforms as never,
    side: BackSide,
    depthWrite: false,
  });
}

/** Skydome that follows the camera; program chosen by world. */
function SkyDome({ world }: { world: WorldId }): React.JSX.Element {
  const meshRef = useRef<import("three").Mesh>(null);
  const { camera } = useThree();

  const geometry = useMemo(() => new SphereGeometry(1600, 24, 16), []);
  const material = useMemo(() => {
    if (world === "blackhole") {
      return makeSkyMaterial(BLACKHOLE_FRAGMENT, {
        u_holePos: { value: new Vector3(0, 60, 0) },
        u_rs: { value: 12 },
        u_time: { value: 0 },
        u_diskColor: { value: new Color(1.0, 0.55, 0.18) },
        u_camRadius: { value: 200 },
      });
    }
    if (world === "maze") {
      return makeSkyMaterial(MENGER_FRAGMENT, {
        u_time: { value: 0 },
        u_tintA: { value: new Color(0.2, 1.0, 0.85) },
        u_tintB: { value: new Color(0.02, 0.1, 0.14) },
      });
    }
    return makeSkyMaterial(PSYCHEDELIC_FRAGMENT, {
      u_time: { value: 0 },
    });
  }, [world]);

  const holeUniforms = world === "blackhole" ? (material.uniforms as never) : null;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const u = material.uniforms as { u_time?: { value: number } };
    if (u.u_time) u.u_time.value = t;
    if (holeUniforms) {
      const hu = holeUniforms as { u_camRadius: { value: number } };
      hu.u_camRadius.value = camera.position.distanceTo(new Vector3(0, 60, 0));
    }
    meshRef.current?.position.copy(camera.position);
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={-100} />;
}

/** Biome content pass: floating islands, organelles, flora, disk, walls. */
function WorldContent({ world }: { world: WorldId }): React.JSX.Element | null {
  const contentRef = useRef<Group>(null);
  const def = WORLDS[world];

  const kit = useMemo(() => {
    return {
      island: new IcosahedronGeometry(6, 1),
      organelle: new SphereGeometry(2.4, 14, 12),
      flora: new ConeGeometry(0.7, 4.2, 6),
      bubble: new SphereGeometry(0.35, 8, 6),
      wall: new BoxGeometry(7.5, 9, 3.2),
      disk: new RingGeometry(36, 102, 64, 1),
    };
  }, []);

  const mats = useMemo(
    () => ({
      island: new MeshStandardMaterial({ color: new Color(...def.sky).offsetHSL(0.08, 0.2, 0.22), roughness: 0.5, emissive: new Color(...def.fogColor), emissiveIntensity: 0.25 }),
      organelle: new MeshStandardMaterial({ color: 0x63d8ff, roughness: 0.2, transparent: true, opacity: 0.55, emissive: 0x2a7fa8, emissiveIntensity: 0.4 }),
      flora: new MeshStandardMaterial({ color: 0x9a4dff, roughness: 0.6, emissive: 0x5420aa, emissiveIntensity: 0.5 }),
      bubble: new MeshStandardMaterial({ color: 0xaef4ff, transparent: true, opacity: 0.5, roughness: 0.1 }),
      wall: new MeshStandardMaterial({ color: 0x0b2430, roughness: 0.85, emissive: 0x0d3a44, emissiveIntensity: 0.3 }),
      disk: new MeshBasicMaterial({ color: 0xffa245, transparent: true, opacity: 0.4, side: DoubleSide, blending: AdditiveBlending, depthWrite: false }),
    }),
    [def]
  );

  useEffect(
    () => () => {
      for (const g of Object.values(kit)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
    },
    [kit, mats]
  );

  const rng = useMemo(() => {
    let s = world.length * 7919 + 13;
    return (): number => {
      s = (s * 1103515245 + 12345) >>> 0;
      return s / 4294967296;
    };
  }, [world]);

  const layout = useMemo(() => {
    const items: { pos: [number, number, number]; scale: number }[] = [];
    const count = world === "maze" ? 90 : 42;
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * 260;
      const z = (rng() - 0.5) * 260;
      const y = WORLDS[world].terrainHeight(x, z) + (world === "void" ? 14 + rng() * 30 : world === "microscopic" ? 6 + rng() * 14 : world === "blackhole" ? 8 + rng() * 20 : 2 + rng() * 6);
      items.push({ pos: [x, y, z], scale: 0.6 + rng() * 1.8 });
    }
    return items;
  }, [world, rng]);

  useFrame(({ clock }) => {
    const g = contentRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.y = world === "blackhole" ? t * 0.02 : 0;
    if (world === "microscopic" || world === "ocean") {
      g.position.y = Math.sin(t * 0.6) * 0.8;
    }
  });

  return (
    <group ref={contentRef}>
      {layout.map((it, i) => {
        if (world === "microscopic") {
          return <mesh key={i} geometry={kit.organelle} material={mats.organelle} position={it.pos} scale={it.scale} />;
        }
        if (world === "ocean") {
          return <mesh key={i} geometry={kit.bubble} material={mats.bubble} position={it.pos} scale={it.scale} />;
        }
        if (world === "alienrain") {
          return <mesh key={i} geometry={kit.flora} material={mats.flora} position={it.pos} scale={[it.scale, it.scale * 1.6, it.scale]} />;
        }
        if (world === "maze") {
          const onGrid = Math.abs(((it.pos[0] * 0.02) % 1)) < 0.5;
          return <mesh key={i} geometry={kit.wall} material={mats.wall} position={[it.pos[0], onGrid ? 0 : 4.5, it.pos[2]]} />;
        }
        return <mesh key={i} geometry={kit.island} material={mats.island} position={it.pos} scale={it.scale} />;
      })}
      {world === "blackhole" ? (
        <mesh geometry={kit.disk} material={mats.disk} position={[0, 6, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      ) : null}
    </group>
  );
}

/** DNA motes + portal + colonies. */
function Collectibles({
  world,
  colonies,
}: {
  world: WorldId;
  colonies: [number, number][];
}): React.JSX.Element {
  const moteRefs = useRef<(import("three").Mesh | null)[]>([]);
  const def = WORLDS[world];

  const moteGeo = useMemo(() => new SphereGeometry(0.32, 10, 8), []);
  const moteMat = useMemo(
    () => new MeshStandardMaterial({ color: 0x7fffd4, emissive: 0x40e0b0, emissiveIntensity: 1.6, roughness: 0.3 }),
    []
  );
  const portalGeo = useMemo(() => new TorusGeometry(3.4, 0.35, 10, 48), []);
  const portalMat = useMemo(
    () => new MeshStandardMaterial({ color: 0xc0aaff, emissive: 0x8060ff, emissiveIntensity: 2, roughness: 0.2 }),
    []
  );
  const colonyGeo = useMemo(() => new ConeGeometry(1.1, 2.6, 8), []);
  const colonyMat = useMemo(
    () => new MeshStandardMaterial({ color: 0xffd97f, emissive: 0xffa030, emissiveIntensity: 1.2, roughness: 0.4 }),
    []
  );

  const motes = useMemo(() => moteLayout(world), [world]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const m of moteRefs.current) {
      if (m) {
        m.rotation.y = t * 1.4;
        m.position.y += Math.sin(t * 2 + m.position.x) * 0.004;
      }
    }
  });

  const portalY = def.terrainHeight(PORTAL_POS[0], PORTAL_POS[1]) + 3.6;

  return (
    <group>
      {motes.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            moteRefs.current[i] = el;
          }}
          geometry={moteGeo}
          material={moteMat}
          position={p}
        />
      ))}
      <group position={[PORTAL_POS[0], portalY, PORTAL_POS[1]]}>
        <mesh geometry={portalGeo} material={portalMat} />
      </group>
      {colonies.map(([x, z], i) => (
        <group key={i} position={[x, def.terrainHeight(x, z), z]}>
          {/* A colony is a real hamlet: three glowing huts + a hearth light. */}
          {[[0, 0], [2.4, 1.1], [-1.9, 1.8]].map((hpos, h) => {
            const hx = hpos[0] ?? 0;
            const hz = hpos[1] ?? 0;
            return <mesh key={h} geometry={colonyGeo} material={colonyMat} position={[hx, 1.3, hz]} />;
          })}
          <pointLight position={[0, 2.2, 0]} intensity={6} distance={14} color="#ffd97f" />
        </group>
      ))}
    </group>
  );
}

/**
 * The player-creature: kinematic controller walking the analytic terrain.
 * Camera: third-person orbit (pointer drag). Speed from species + stride.
 */
function CreatureController({
  speciesIndex,
  levels,
  world,
  input,
  speedRef,
  bodyRef,
  onArrivePortal,
  onCollectMote,
  motePositions,
}: {
  speciesIndex: number;
  levels: TraitLevels;
  world: WorldId;
  input: JourneyInput;
  speedRef: { current: number };
  bodyRef: React.MutableRefObject<Group | null>;
  onArrivePortal: () => void;
  onCollectMote: () => void;
  motePositions: [number, number, number][];
}): React.JSX.Element {
  const species = useMemo(() => getSpecies(speciesIndex), [speciesIndex]);
  const def = WORLDS[world];
  const velY = useRef(0);
  const phase = useRef(0);
  const pos = useRef(new Vector3(0, 4, 0));
  const { camera } = useThree();
  const portalCooldown = useRef(0);
  const collected = useRef<Set<number>>(new Set());
  const scratch = useMemo(() => new Vector3(), []);

  useFrame((_, deltaRaw) => {
    const dt = Math.min(deltaRaw, 0.1);
    const speed = species.speed * speedMultiplier(levels);
    const g = new Vector3(0, 0, 0);

    let mx = 0;
    let mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const cos = Math.cos(input.yaw);
      const sin = Math.sin(input.yaw);
      g.x = (mx * cos - mz * sin) * speed * dt;
      g.z = (mx * sin + mz * cos) * speed * dt;
      pos.current.x += g.x;
      pos.current.z += g.z;
      bodyRef.current?.rotation.set(0, Math.atan2(g.x, g.z), 0);
    }
    speedRef.current = moving ? speed : 0;
    phase.current += (moving ? speed * dt * 2.2 : dt);
    if (bodyRef.current) bodyRef.current.userData.phase = phase.current * 3;

    const ground = def.terrainHeight(pos.current.x, pos.current.z);
    if (input.jump && pos.current.y <= ground + 0.05) velY.current = JUMP_SPEED;
    velY.current += GRAVITY * dt;
    pos.current.y += velY.current * dt;
    if (pos.current.y < ground) {
      pos.current.y = ground;
      velY.current = 0;
    }
    if (bodyRef.current) bodyRef.current.position.copy(pos.current);

    // Third-person orbit camera — or first-person (V/F1): camera rides the
    // head and looks where yaw points.
    if (input.firstPerson) {
      const head = 1.9;
      camera.position.lerp(
        scratch.set(pos.current.x, pos.current.y + head, pos.current.z),
        Math.min(1, 24 * dt)
      );
      camera.lookAt(
        pos.current.x + Math.sin(input.yaw + Math.PI) * 4,
        pos.current.y + head + 0.2,
        pos.current.z + Math.cos(input.yaw + Math.PI) * 4
      );
    } else {
      const camDist = 9;
      const camX = pos.current.x + Math.sin(input.yaw) * camDist;
      const camZ = pos.current.z + Math.cos(input.yaw) * camDist;
      const camY = Math.max(pos.current.y + 4.2, def.terrainHeight(camX, camZ) + 2);
      camera.position.lerp(scratch.set(camX, camY, camZ), Math.min(1, 10 * dt));
      camera.lookAt(pos.current.x, pos.current.y + 1.2, pos.current.z);
    }

    // Mote pickup (pure shared layout).
    for (let i = 0; i < motePositions.length; i++) {
      if (collected.current.has(i)) continue;
      const m = motePositions[i];
      if (m && Math.hypot(m[0] - pos.current.x, m[2] - pos.current.z) < 1.6 && Math.abs(m[1] - pos.current.y) < 2.6) {
        collected.current.add(i);
        onCollectMote();
      }
    }

    // Portal crossing (ring at PORTAL_POS).
    portalCooldown.current -= dt;
    if (
      portalCooldown.current <= 0 &&
      Math.hypot(PORTAL_POS[0] - pos.current.x, PORTAL_POS[1] - pos.current.z) < 3.6
    ) {
      portalCooldown.current = 3;
      onArrivePortal();
    }
  });

  return <Creature species={species} levels={levels} speed={speedRef} positionRef={bodyRef} />;
}

export function GameCanvas({
  journey,
  input,
  onPortal,
  onCollect,
  colonies,
}: {
  journey: JourneyState;
  input: JourneyInput;
  onPortal: () => void;
  onCollect: () => void;
  colonies: [number, number][];
}): React.JSX.Element {
  const world = journey.world;
  const def = WORLDS[world];
  const bodyRef = useRef<Group | null>(null);
  const speedRef = useRef(0);
  const moteLayoutMemo = useMemo(() => moteLayout(world), [world]);

  const terrainGeo = useMemo(() => {
    const geo = new PlaneGeometry(320, 320, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    if (p) {
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        p.setY(i, def.terrainHeight(x, z));
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [def]);

  const terrainMat = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: new Color(...def.sky).offsetHSL(0.02, 0.1, 0.16),
      roughness: 0.75,
      metalness: 0.08,
      emissive: new Color(...def.fogColor),
      emissiveIntensity: 0.18,
    });
    // Texture overhaul: each world walks on its own photo-PBR surface.
    const loader = new TextureLoader();
    const url =
      world === "void"
        ? psyGroundUrl
        : world === "microscopic"
          ? cellFloorUrl
          : world === "alienrain"
            ? grassUrl
            : world === "ocean"
              ? soilUrl
              : world === "maze"
                ? stoneUrl
                : cellFloorUrl; // blackhole: wet organic disk surface
    const map = loader.load(url);
    map.wrapS = RepeatWrapping;
    map.wrapT = RepeatWrapping;
    map.colorSpace = SRGBColorSpace;
    map.repeat.set(40, 40);
    mat.map = map;
    return mat;
  }, [def, world]);

  useEffect(() => {
    return () => {
      terrainGeo.dispose();
      terrainMat.map?.dispose();
      terrainMat.dispose();
    };
  }, [terrainGeo, terrainMat]);

  // Ambient bed follows the world; mute key handled by App.
  useEffect(() => {
    lumitalAudio.setWorld(worldBaseHz(world));
  }, [world]);

  return (
    <Canvas
      shadows={false}
      camera={{ fov: 62, near: 0.1, far: 4000, position: [0, 6, 12] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new Color(...def.sky));
      }}
    >
      <fog attach="fog" args={[new Color(...def.fogColor), 10, 260 / Math.max(def.fogDensity, 0.001) * 0.02 + 60]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[30, 60, 20]} intensity={1.1} color={new Color(...def.fogColor).lerp(new Color(1, 1, 1), 0.6)} />
      <SkyDome world={world} />
      <mesh geometry={terrainGeo} material={terrainMat} />
      <WorldContent world={world} />
      <Collectibles world={world} colonies={colonies} />
      <CreatureController
        speciesIndex={journey.speciesIndex}
        levels={journey.levels}
        world={world}
        input={input}
        speedRef={speedRef}
        bodyRef={bodyRef}
        onArrivePortal={onPortal}
        onCollectMote={onCollect}
        motePositions={moteLayoutMemo}
      />
    </Canvas>
  );
}
