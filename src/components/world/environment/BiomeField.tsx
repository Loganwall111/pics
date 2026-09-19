import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { Color, ConeGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, SphereGeometry } from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import {
  generateBiomes,
  LAKE_CENTER,
  LAKE_RADIUS,
  villageCameraBoxes,
  type FarmSpec,
  type HouseSpec,
  type VillageSpec,
} from "@/lib/geometry/biomegen";
import { aabbFromFootprint } from "@/lib/math/raycast";
import { RngStream } from "@/lib/math/Random";
import { biomeCollision } from "./biomeCollision";
import { photoTexture } from "./photoTextures";
import grassPhotoUrl from "@/assets/textures/grass.jpg";
import stoneWallPhotoUrl from "@/assets/textures/stone-wall.jpg";
import woodPlanksPhotoUrl from "@/assets/textures/wood-planks.jpg";
import farmSoilPhotoUrl from "@/assets/textures/farm-soil.jpg";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * Beyond-the-city districts (v1.1 — §biomes).
 *
 * Two walk-in villages: houses are real shells — four walls with a door gap
 * you can walk through (fixed rapier cuboid colliders), furnished interiors
 * (table, bed, shelf, warm lamp). Eight farm plots with instanced crop
 * rows, walk-in barns, silos, fences and turning windmills, plus a
 * planar-reflective lake (drei MeshReflectorMaterial — real screen-space
 * reflections). Chase-camera AABBs are published to `biomeCollision`.
 */

const GROUND_Y = 0.02; // district ground patches ride just above the asphalt plane

export function BiomeField(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const layout = useMemo(() => generateBiomes(citySeed), [citySeed]);

  // Photo-PBR surfaces (v1.1 overhaul): decode is progressive via
  // TextureLoader; shared across all houses/farms, disposed on unmount.
  const texs = useMemo(
    () => ({
      grass: photoTexture(grassPhotoUrl, 18, 18),
      stone: photoTexture(stoneWallPhotoUrl, 2.4, 1.4),
      wood: photoTexture(woodPlanksPhotoUrl, 3, 2),
      soil: photoTexture(farmSoilPhotoUrl, 14, 14),
    }),
    []
  );
  useEffect(
    () => () => {
      texs.grass.dispose();
      texs.stone.dispose();
      texs.wood.dispose();
      texs.soil.dispose();
    },
    [texs]
  );

  // Publish camera collision boxes (house shells).
  useEffect(() => {
    biomeCollision.boxes = villageCameraBoxes(layout.villages).map((b) =>
      aabbFromFootprint(
        (b.minX + b.maxX) / 2,
        (b.minZ + b.maxZ) / 2,
        b.maxX - b.minX,
        b.maxZ - b.minZ,
        b.maxY,
        { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
      )
    );
    biomeCollision.count = biomeCollision.boxes.length;
    return () => {
      biomeCollision.boxes = [];
      biomeCollision.count = 0;
    };
  }, [layout]);

  return (
    <group>
      {layout.villages.map((v, i) => (
        <Village key={`v${i}`} v={v} texs={texs} />
      ))}
      {layout.farms.map((f, i) => (
        <Farm key={`f${i}`} f={f} seed={citySeed ^ (0xf00d + i)} texs={texs} />
      ))}
      <Lake />
    </group>
  );
}

/** One walk-in house: floor patch, 4 walls (door gap in front), roof, furniture. */
function House({ h, texs }: { h: HouseSpec; texs: HouseTexs }): React.JSX.Element {
  const hw = h.width / 2;
  const hd = h.depth / 2;
  const doorHalf = h.doorWidth / 2;
  const t = 0.28; // wall thickness

  return (
    <group position={[h.x, 0, h.z]}>
      {/* Floor patch */}
      <mesh position={[0, GROUND_Y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.max(hw, hd) * 1.25, 18]} />
        <meshStandardMaterial color="#8f8066" roughness={0.95} />
      </mesh>

      {/* Walls (auto cuboid colliders) — front wall split around the door */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, h.wallHeight / 2, -hd]} castShadow>
          <boxGeometry args={[h.width, h.wallHeight, t]} />
          <meshStandardMaterial map={texs.stone} color={h.wallColor} roughness={0.9} />
        </mesh>
        <mesh position={[-hw, h.wallHeight / 2, 0]} castShadow>
          <boxGeometry args={[t, h.wallHeight, h.depth]} />
          <meshStandardMaterial map={texs.stone} color={h.wallColor} roughness={0.9} />
        </mesh>
        <mesh position={[hw, h.wallHeight / 2, 0]} castShadow>
          <boxGeometry args={[t, h.wallHeight, h.depth]} />
          <meshStandardMaterial map={texs.stone} color={h.wallColor} roughness={0.9} />
        </mesh>
        {/* Front wall: two segments flanking the door gap */}
        <mesh position={[-(hw + doorHalf) / 2, h.wallHeight / 2, hd]} castShadow>
          <boxGeometry args={[Math.max(0.1, hw - doorHalf), h.wallHeight, t]} />
          <meshStandardMaterial map={texs.stone} color={h.wallColor} roughness={0.9} />
        </mesh>
        <mesh position={[(hw + doorHalf) / 2, h.wallHeight / 2, hd]} castShadow>
          <boxGeometry args={[Math.max(0.1, hw - doorHalf), h.wallHeight, t]} />
          <meshStandardMaterial map={texs.stone} color={h.wallColor} roughness={0.9} />
        </mesh>
        {/* Door lintel above the gap */}
        <mesh position={[0, h.wallHeight - 0.3, hd]} castShadow>
          <boxGeometry args={[h.doorWidth, 0.6, t]} />
          <meshStandardMaterial color={h.roofColor} roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Roof (visual; camera clamp handles overflight) */}
      <mesh position={[0, h.wallHeight + 0.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(hw, hd) * 1.35, 1.6, 4]} />
        <meshStandardMaterial color={h.roofColor} roughness={0.85} />
      </mesh>

      {/* Furnishings (visual only) */}
      <mesh position={[-hw + 1.2, 0.45, -hd + 1.2]} castShadow>
        <boxGeometry args={[1.6, 0.08, 0.9]} />
        <meshStandardMaterial color="#7a5c3e" roughness={0.8} />
      </mesh>
      <mesh position={[-hw + 1.2, 0.22, -hd + 1.2]}>
        <boxGeometry args={[0.12, 0.44, 0.12]} />
        <meshStandardMaterial color="#5d452e" roughness={0.9} />
      </mesh>
      <mesh position={[hw - 1.3, 0.3, -hd + 1.4]} castShadow>
        <boxGeometry args={[1.1, 0.5, 2.2]} />
        <meshStandardMaterial color="#9c6b4f" roughness={0.85} />
      </mesh>
      <mesh position={[hw - 1.3, 0.72, -hd + 2.2]}>
        <boxGeometry args={[1.0, 0.18, 0.4]} />
        <meshStandardMaterial color="#d8d2c4" roughness={0.95} />
      </mesh>
      {/* Warm interior lamp */}
      <pointLight position={[0, h.wallHeight - 0.7, 0]} intensity={2.4} distance={9} color="#ffd9a0" />
      <mesh position={[0, h.wallHeight - 0.55, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
    </group>
  );
}

interface HouseTexs {
  grass: import("three").Texture;
  stone: import("three").Texture;
  wood: import("three").Texture;
  soil: import("three").Texture;
}

function Village({ v, texs }: { v: VillageSpec; texs: HouseTexs }): React.JSX.Element {
  const wellRoof = useRef<Group>(null);
  useFrame((_, delta) => {
    if (wellRoof.current) wellRoof.current.rotation.y += delta * 0.15;
  });
  return (
    <group>
      {/* Village dirt ground patch */}
      <mesh position={[v.cx, GROUND_Y, v.cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[64, 28]} />
        <meshStandardMaterial map={texs.grass} color="#c8d2b8" roughness={0.95} />
      </mesh>
      {/* Central well */}
      <group position={[v.cx, 0, v.cz]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[1.5, 1.7, 1.1, 12]} />
          <meshStandardMaterial color="#8d8778" roughness={0.95} />
        </mesh>
        <group ref={wellRoof} position={[0, 2.3, 0]}>
          <mesh castShadow>
            <coneGeometry args={[1.9, 1.1, 6]} />
            <meshStandardMaterial color="#6f4438" roughness={0.85} />
          </mesh>
        </group>
        {[-1.4, 1.4].map((px) => (
          <mesh key={px} position={[px, 1.3, 0]} castShadow>
            <boxGeometry args={[0.18, 2.6, 0.18]} />
            <meshStandardMaterial color="#5d452e" roughness={0.9} />
          </mesh>
        ))}
      </group>
      {v.houses.map((h, i) => (
        <House key={i} h={h} texs={texs} />
      ))}
    </group>
  );
}

/** Farm plot: dirt patch, crop rows (instanced), walk-in barn, silo, fences, windmill. */
function Farm({ f, seed, texs }: { f: FarmSpec; seed: number; texs: HouseTexs }): React.JSX.Element {
  const bladesRef = useRef<Group>(null);
  const cropCount = Math.floor((f.width * f.depth) / 6);
  const cropGeo = useMemo(
    () =>
      f.crop === "corn"
        ? new ConeGeometry(0.28, 1.7, 5)
        : f.crop === "pumpkin"
          ? new SphereGeometry(0.42, 8, 6)
          : new ConeGeometry(0.16, 0.9, 4),
    [f.crop]
  );
  const cropMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color:
          f.crop === "pumpkin"
            ? new Color("#c47a26")
            : f.crop === "corn"
              ? new Color("#7fae3f")
              : new Color("#c9b458"),
        roughness: 0.85,
      }),
    [f.crop]
  );
  const cropRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = cropRef.current;
    if (!mesh) return;
    const rng = new RngStream(seed >>> 0);
    const m = new Matrix4();
    let placed = 0;
    for (let row = 0; row * 1.6 < f.depth && placed < cropCount; row++) {
      for (let col = 0; col * 2.2 < f.width && placed < cropCount; col++) {
        const lx = -f.width / 2 + col * 2.2 + rng.range(-0.3, 0.3);
        const lz = -f.depth / 2 + row * 1.6 + rng.range(-0.25, 0.25);
        const s = 0.75 + rng.float() * 0.6;
        m.makeScale(s, s, s);
        m.setPosition(lx, (f.crop === "corn" ? 0.85 : f.crop === "pumpkin" ? 0.3 : 0.45) * s, lz);
        mesh.setMatrixAt(placed, m);
        placed++;
      }
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cropCount, f, seed]);

  useEffect(() => {
    return () => {
      cropGeo.dispose();
      cropMat.dispose();
    };
  }, [cropGeo, cropMat]);

  useFrame((_, delta) => {
    if (bladesRef.current) bladesRef.current.rotation.z += delta * 0.9;
  });

  const fieldR = Math.max(f.width, f.depth);

  return (
    <group position={[f.cx, 0, f.cz]} rotation={[0, f.rotation, 0]}>
      <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[fieldR * 0.72, 24]} />
        <meshStandardMaterial map={texs.soil} color="#b8a288" roughness={0.98} />
      </mesh>
      <instancedMesh ref={cropRef} args={[cropGeo, cropMat, cropCount]} frustumCulled={false} />

      {/* Barn (walk-in: front gap) */}
      <group position={[f.barn.x - f.cx, 0, f.barn.z - f.cz]}>
        <RigidBody type="fixed" colliders="cuboid">
          <mesh position={[-3.4, 2.4, 0]} castShadow>
            <boxGeometry args={[3.2, 4.8, 7]} />
            <meshStandardMaterial map={texs.wood} color="#c98a72" roughness={0.9} />
          </mesh>
          <mesh position={[3.4, 2.4, 0]} castShadow>
            <boxGeometry args={[3.2, 4.8, 7]} />
            <meshStandardMaterial map={texs.wood} color="#c98a72" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.4, -3.4]} castShadow>
            <boxGeometry args={[10, 4.8, 0.3]} />
            <meshStandardMaterial map={texs.wood} color="#a86a54" roughness={0.9} />
          </mesh>
        </RigidBody>
        <mesh position={[0, 6.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[7.2, 2.6, 4]} />
          <meshStandardMaterial color="#4a3328" roughness={0.9} />
        </mesh>
      </group>

      {/* Silo */}
      <mesh position={[f.silo.x - f.cx, 4.5, f.silo.z - f.cz]} castShadow>
        <cylinderGeometry args={[2.1, 2.1, 9, 14]} />
        <meshStandardMaterial color="#b9b4a8" roughness={0.65} metalness={0.35} />
      </mesh>
      <mesh position={[f.silo.x - f.cx, 9.6, f.silo.z - f.cz]} castShadow>
        <sphereGeometry args={[2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8d8878" roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Fence ring */}
      {Array.from({ length: 22 }, (_, i) => {
        const ang = (i / 22) * Math.PI * 2;
        const fx = Math.sin(ang) * (fieldR * 0.75 + 6);
        const fz = Math.cos(ang) * (fieldR * 0.75 + 6);
        return (
          <group key={i} position={[fx, 0, fz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, 0.75, 0]} castShadow>
              <boxGeometry args={[0.16, 1.5, 0.16]} />
              <meshStandardMaterial color="#6e5a40" roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.15, 1.4]}>
              <boxGeometry args={[0.08, 0.12, 2.8]} />
              <meshStandardMaterial color="#7d6848" roughness={0.95} />
            </mesh>
          </group>
        );
      })}

      {/* Windmill */}
      {f.windmill ? (
        <group position={[0, 0, -f.depth / 2 - 14]}>
          <mesh position={[0, 6, 0]} castShadow>
            <cylinderGeometry args={[1.4, 2.4, 12, 8]} />
            <meshStandardMaterial color="#cbbfa5" roughness={0.9} />
          </mesh>
          <group position={[0, 11, 1.6]} ref={bladesRef}>
            {[0, 1, 2, 3].map((b) => (
              <mesh key={b} rotation={[0, 0, (b * Math.PI) / 2]} castShadow>
                <boxGeometry args={[0.5, 8.5, 0.12]} />
                <meshStandardMaterial color="#e8e0cc" roughness={0.85} />
              </mesh>
            ))}
          </group>
        </group>
      ) : null}
    </group>
  );
}

/** The lake: planar-reflective disc (real screen-space reflections). */
function Lake(): React.JSX.Element {
  return (
    <mesh position={[LAKE_CENTER.x, 0.06, LAKE_CENTER.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[LAKE_RADIUS, 48]} />
      <MeshReflectorMaterial
        resolution={1024}
        blur={[400, 120]}
        mixBlur={1.2}
        mixStrength={12}
        mirror={0.82}
        color="#0c2438"
        metalness={0.75}
        roughness={0.32}
      />
    </mesh>
  );
}
