import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { generateParks, type TreeSpot } from "@/lib/geometry/parkgen";
import { photoTexture } from "./photoTextures";
import grassPhotoUrl from "@/assets/textures/grass.jpg";
import woodPlanksPhotoUrl from "@/assets/textures/wood-planks.jpg";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * City parks (v1.2 — §parks): street trees on every block corner plus four
 * greenbelt parks (photo-grass lawns, instanced round/pine trees, benches,
 * reflective ponds). Pure visual — no physics colliders (they never block
 * the player or traffic); the ground plane handles walking.
 */

export function CityParks(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const layout = useMemo(() => generateParks(citySeed), [citySeed]);

  const texs = useMemo(
    () => ({
      grass: photoTexture(grassPhotoUrl, 10, 10),
      wood: photoTexture(woodPlanksPhotoUrl, 1.4, 0.8),
    }),
    []
  );

  const kit = useMemo(
    () => ({
      trunk: new CylinderGeometry(0.22, 0.34, 3.4, 6),
      round: new SphereGeometry(1.9, 9, 7),
      pine: new ConeGeometry(1.7, 4.6, 8),
      lawn: new CircleGeometry(1, 32),
      benchSeat: new BoxGeometry(1.9, 0.09, 0.5),
      benchLeg: new BoxGeometry(0.08, 0.42, 0.45),
      pond: new CircleGeometry(1, 36),
    }),
    []
  );

  const mats = useMemo(
    () => ({
      trunk: new MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.95 }),
      roundLeaf: new MeshStandardMaterial({ color: 0x4c7a38, roughness: 0.9 }),
      pineLeaf: new MeshStandardMaterial({ color: 0x39602f, roughness: 0.9 }),
      bench: new MeshStandardMaterial({ map: texs.wood, color: 0xc9a27a, roughness: 0.85 }),
    }),
    [texs]
  );

  useEffect(() => {
    return () => {
      texs.grass.dispose();
      texs.wood.dispose();
      for (const g of Object.values(kit)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
    };
  }, [texs, kit, mats]);

  return (
    <group>
      <TreeField
        trees={layout.streetTrees}
        kit={kit}
        mats={mats}
      />
      {layout.parks.map((p, i) => (
        <group key={i} position={[p.cx, 0, p.cz]}>
          {/* Lawn */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[p.lawnRadius, 40]} />
            <meshStandardMaterial map={texs.grass} color="#b9d0a0" roughness={0.95} />
          </mesh>
          {p.pond ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.pond.x - p.cx, 0.07, p.pond.z - p.cz]}>
              <circleGeometry args={[p.pond.r, 36]} />
              <MeshReflectorMaterial
                resolution={512}
                blur={[300, 90]}
                mixBlur={1.1}
                mixStrength={9}
                mirror={0.75}
                color="#12314a"
                metalness={0.7}
                roughness={0.35}
              />
            </mesh>
          ) : null}
          <TreeField trees={p.trees} kit={kit} mats={mats} offset={[p.cx, p.cz]} />
          {p.benches.map((b, bi) => (
            <group key={bi} position={[b.x - p.cx, 0, b.z - p.cz]} rotation={[0, -b.rot + Math.PI / 2, 0]}>
              <mesh geometry={kit.benchSeat} material={mats.bench} position={[0, 0.46, 0]} castShadow />
              <mesh geometry={kit.benchSeat} material={mats.bench} position={[0, 0.78, -0.22]} castShadow />
              {[-0.8, 0.8].map((lx) => (
                <mesh key={lx} geometry={kit.benchLeg} material={mats.bench} position={[lx, 0.21, 0]} />
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Instanced tree field. `offset` re-locals tree coords (parks were generated
 * in world space but render inside a translated group).
 */
function TreeField({
  trees,
  kit,
  mats,
  offset,
}: {
  trees: TreeSpot[];
  kit: {
    trunk: CylinderGeometry;
    round: SphereGeometry;
    pine: ConeGeometry;
  };
  mats: {
    trunk: MeshStandardMaterial;
    roundLeaf: MeshStandardMaterial;
    pineLeaf: MeshStandardMaterial;
  };
  offset?: [number, number];
}): React.JSX.Element {
  const [ox, oz] = offset ?? [0, 0];

  const roundRef = useRef<InstancedMesh>(null);
  const pineRef = useRef<InstancedMesh>(null);
  const trunkRef = useRef<InstancedMesh>(null);

  const split = useMemo(() => {
    const rounds: TreeSpot[] = [];
    const pines: TreeSpot[] = [];
    for (const t of trees) (t.kind === "pine" ? pines : rounds).push(t);
    return { rounds, pines };
  }, [trees]);

  useEffect(() => {
    const m = new Matrix4();
    const place = (
      mesh: InstancedMesh | null,
      list: TreeSpot[],
      yTrunk: number,
      yCanopy: number,
      canopyScale: number
    ): void => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t) continue;
        const s = t.scale;
        m.makeScale(s, s, s);
        m.setPosition(t.x - ox, yTrunk * s, t.z - oz);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      void yCanopy;
      void canopyScale;
    };

    place(trunkRef.current, trees, 1.7, 0, 1);
    // Round canopies: crown sits at ~3.9.
    if (roundRef.current) {
      for (let i = 0; i < split.rounds.length; i++) {
        const t = split.rounds[i];
        if (!t) continue;
        const s = t.scale;
        m.makeScale(s, s * 0.92, s);
        m.setPosition(t.x - ox, 3.9 * s, t.z - oz);
        roundRef.current.setMatrixAt(i, m);
      }
      roundRef.current.count = split.rounds.length;
      roundRef.current.instanceMatrix.needsUpdate = true;
      roundRef.current.computeBoundingSphere();
    }
    if (pineRef.current) {
      for (let i = 0; i < split.pines.length; i++) {
        const t = split.pines[i];
        if (!t) continue;
        const s = t.scale;
        m.makeScale(s, s, s);
        m.setPosition(t.x - ox, 4.4 * s, t.z - oz);
        pineRef.current.setMatrixAt(i, m);
      }
      pineRef.current.count = split.pines.length;
      pineRef.current.instanceMatrix.needsUpdate = true;
      pineRef.current.computeBoundingSphere();
    }
    void place;
  }, [trees, split, ox, oz]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[kit.trunk, mats.trunk, Math.max(1, trees.length)]} frustumCulled={false} castShadow />
      <instancedMesh ref={roundRef} args={[kit.round, mats.roundLeaf, Math.max(1, split.rounds.length)]} frustumCulled={false} castShadow />
      <instancedMesh ref={pineRef} args={[kit.pine, mats.pineLeaf, Math.max(1, split.pines.length)]} frustumCulled={false} castShadow />
    </group>
  );
}
