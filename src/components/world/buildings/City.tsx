import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  SRGBColorSpace,
  PlaneGeometry,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SphereGeometry,
  Texture,
} from "three";
import { generateCity } from "@/lib/geometry/citygen";
import { cityCollision } from "./cityCollision";
import { aabbFromFootprint } from "@/lib/math/raycast";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import {
  WINDOW_FRAGMENT_BODY,
  WINDOW_FRAGMENT_HEAD,
  WINDOW_FRAGMENT_SHADE,
  WINDOW_VERTEX_BODY,
  WINDOW_VERTEX_HEAD,
  makeWindowShaderUniformRefs,
} from "@/shaders/buildings/windowShader";
import facadeBrickUrl from "@/assets/textures/facade-brick.jpg";
import facadeConcreteUrl from "@/assets/textures/facade-concrete.jpg";
import { frameState } from "@/state/transient/frameState";
import { RngStream } from "@/lib/math/Random";
import billboardVolt from "@/assets/art/billboard-volt.jpg";
import billboardOrbital from "@/assets/art/billboard-orbital.jpg";
import billboardMind from "@/assets/art/billboard-mind.jpg";

/**
 * Procedural metropolitan environment (§13, §15).
 *
 * Building archetypes → deterministic instance generation (generateCity) →
 * ONE InstancedMesh for every structure, ONE for street-light poles, ONE for
 * their glowing heads. Material variation comes from instance colours; the
 * window-emission system runs entirely in the fragment shader via instanced
 * attributes (aWindow) — zero per-window CPU work (§15).
 *
 * The MeshStandardMaterial is EXTENDED (not replaced) by onBeforeCompile
 * chunks documented in src/shaders/buildings/windowShader.ts.
 *
 * Update frequency: static geometry; uniforms (u_time, u_emissiveIntensity)
 * mutate per frame. Cleanup disposes every GPU resource created here (§22).
 */

const BUILDING_TINTS = [0x9aa3b2, 0x8fa8b8, 0xa89f96, 0x7f8ea3, 0xb3b9c4, 0x6f7f95].map(
  (h) => new Color(h)
);

export function City(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);

  const layout = useMemo(
    () => generateCity(citySeed, { blockSize: 46, roadWidth: 12, gridRadius: 5, maxHeight: 96, plaza: true }),
    [citySeed]
  );

  // --- Collision publisher (chase-camera AABBs, §33) ------------------------
  useEffect(() => {
    cityCollision.boxes = layout.buildings.map((b) =>
      aabbFromFootprint(b.x, b.z, b.width, b.depth, b.height, {
        minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0,
      })
    );
    cityCollision.count = cityCollision.boxes.length;
    return () => {
      cityCollision.boxes = [];
      cityCollision.count = 0;
    };
  }, [layout]);

  // --- Buildings (instanced) ------------------------------------------------
  const buildingGeometry = useMemo(() => {
    const g = new BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0); // grow upward from the instance position
    return g;
  }, []);

  const buildingMaterial = useMemo(() => {
    const uniforms = makeWindowShaderUniformRefs();
    const mat = new MeshStandardMaterial({
      color: 0xffffff, // per-instance tint via instanceColor
      roughness: 0.55,
      metalness: 0.15, // curtain-wall glass fraction (documented, §14)
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.u_time = uniforms.u_time;
      shader.uniforms.u_emissiveIntensity = uniforms.u_emissiveIntensity;
      shader.uniforms.u_skyColor = uniforms.u_skyColor;
      shader.uniforms.u_fresnelStrength = uniforms.u_fresnelStrength;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${WINDOW_VERTEX_HEAD}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${WINDOW_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${WINDOW_FRAGMENT_HEAD}`)
        // Diffuse-side facade shading: frames, slabs, grime (photoreal pass §15).
        .replace("#include <color_fragment>", `#include <color_fragment>\n${WINDOW_FRAGMENT_SHADE}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${WINDOW_FRAGMENT_BODY}`);
    };
    mat.customProgramCacheKey = () => "city-windows";
    return mat;
  }, []);

  const buildingsRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = buildingsRef.current;
    if (!mesh) return;
    const rng = new RngStream(layout.seed ^ 0x6d27);
    const radius = profile.cityRadius * 46 + 30;
    const visible = layout.buildings.filter((b) => Math.hypot(b.x, b.z) <= radius);
    const m = new Matrix4();
    const tint = new Color();
    const aWindow = new Float32Array(visible.length * 4);
    for (let i = 0; i < visible.length; i++) {
      const b = visible[i];
      if (!b) continue;
      m.makeScale(b.width, b.height, b.depth);
      m.setPosition(b.x, 0, b.z);
      mesh.setMatrixAt(i, m);
      const base = BUILDING_TINTS[Math.min(BUILDING_TINTS.length - 1, Math.floor(b.colorSeed * BUILDING_TINTS.length))];
      tint.copy(base ?? BUILDING_TINTS[0]!).multiplyScalar(0.82 + rng.float() * 0.3);
      mesh.setColorAt(i, tint);
      aWindow[i * 4] = b.windowCols;
      aWindow[i * 4 + 1] = b.windowRows;
      aWindow[i * 4 + 2] = b.colorSeed * 100;
      aWindow[i * 4 + 3] = b.litProbability;
    }
    mesh.count = visible.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.setAttribute("aWindow", new InstancedBufferAttribute(aWindow, 4));
    mesh.computeBoundingSphere();
  }, [layout, profile.cityRadius]);

  // --- Podium hulls (street level, 5 m photo masonry base, §13 hulls) --------
  const podiumGeometry = useMemo(() => {
    const g = new BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const podiumTextures = useTexture([facadeBrickUrl, facadeConcreteUrl]);
  const podiumMaterials = useMemo(
    () =>
      podiumTextures.map(
        (t: Texture) =>
          new MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0.0 })
      ),
    [podiumTextures]
  );
  useEffect(() => {
    for (const t of podiumTextures) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(3, 2);
      t.colorSpace = SRGBColorSpace;
    }
  }, [podiumTextures]);
  const podiumRefs = useRef<(InstancedMesh | null)[]>([null, null]);

  useEffect(() => {
    const meshes = podiumRefs.current;
    const all = layout.buildings;
    const radius = profile.cityRadius * 46 + 30;
    const visible = all.filter((b) => Math.hypot(b.x, b.z) <= radius);
    const m = new Matrix4();
    for (let variant = 0; variant < 2; variant++) {
      const mesh = meshes[variant];
      if (!mesh) continue;
      let n = 0;
      for (let i = 0; i < visible.length; i++) {
        const b = visible[i];
        if (!b) continue;
        // Deterministic per-building variant assignment.
        const useVariant = Math.floor(b.colorSeed * 997) % 2;
        if (useVariant !== variant) continue;
        m.makeScale(b.width + 0.9, 5, b.depth + 0.9);
        m.setPosition(b.x, 0, b.z);
        mesh.setMatrixAt(n, m);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [layout, profile.cityRadius]);

  // --- Street lights ----------------------------------------------------------
  const poleGeometry = useMemo(() => new CylinderGeometry(0.09, 0.13, 6, 6), []);
  const headGeometry = useMemo(() => new SphereGeometry(0.32, 10, 8), []);
  const poleMaterial = useMemo(() => new MeshStandardMaterial({ color: 0x2c3038, roughness: 0.6, metalness: 0.4 }), []);
  const headColor = useMemo(() => new Color(1, 0.85, 0.63), []);
  const headMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffd9a0,
        toneMapped: false,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    []
  );
  const headsRef = useRef<InstancedMesh>(null);
  const polesRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const heads = headsRef.current;
    const poles = polesRef.current;
    if (!heads || !poles) return;
    const m = new Matrix4();
    for (let i = 0; i < layout.streetLights.length; i++) {
      const light = layout.streetLights[i];
      if (!light) continue;
      m.makeTranslation(light.x, 6.15, light.z);
      heads.setMatrixAt(i, m);
      m.makeTranslation(light.x, 3, light.z);
      poles.setMatrixAt(i, m);
    }
    heads.count = layout.streetLights.length;
    poles.count = layout.streetLights.length;
    heads.instanceMatrix.needsUpdate = true;
    poles.instanceMatrix.needsUpdate = true;
    heads.computeBoundingSphere();
    poles.computeBoundingSphere();
  }, [layout]);

  useEffect(() => {
    return () => {
      buildingGeometry.dispose();
      buildingMaterial.dispose();
      podiumGeometry.dispose();
      for (const m2 of podiumMaterials) m2.dispose();
      poleGeometry.dispose();
      headGeometry.dispose();
      poleMaterial.dispose();
      headMaterial.dispose();
    };
  }, [buildingGeometry, buildingMaterial, podiumGeometry, podiumMaterials, poleGeometry, headGeometry, poleMaterial, headMaterial]);

  // Window emission intensity follows the night factor (CPU-scaled uniforms;
  // the shared uniform object is mutated — never recreated, §23).
  useFrame(() => {
    const uniforms = makeWindowShaderUniformRefs();
    uniforms.u_time.value = frameState.clock.shaderTimeSeconds;
    uniforms.u_emissiveIntensity.value = 0.25 + 1.55 * frameState.nightFactor;
    const day = Math.max(0.03, 1 - frameState.nightFactor);
    const sky = uniforms.u_skyColor.value as { r: number; g: number; b: number };
    sky.r = frameState.zenithColor.r * day;
    sky.g = frameState.zenithColor.g * day;
    sky.b = frameState.zenithColor.b * day;
    headMaterial.color.copy(headColor).multiplyScalar(0.25 + 1.5 * frameState.nightFactor);
  });

  return (
    <group>
      <instancedMesh
        ref={buildingsRef}
        args={[buildingGeometry, buildingMaterial, layout.buildings.length]}
        castShadow
        receiveShadow
      />
      {/* Street-level podium hulls (photo masonry) */}
      <instancedMesh ref={(el) => { podiumRefs.current[0] = el; }} args={[podiumGeometry, podiumMaterials[0], layout.buildings.length]} castShadow receiveShadow />
      <instancedMesh ref={(el) => { podiumRefs.current[1] = el; }} args={[podiumGeometry, podiumMaterials[1], layout.buildings.length]} castShadow receiveShadow />
      <Billboards billboards={layout.billboards} />
      <instancedMesh ref={polesRef} args={[poleGeometry, poleMaterial, layout.streetLights.length]} frustumCulled={false} />
      <instancedMesh ref={headsRef} args={[headGeometry, headMaterial, layout.streetLights.length]} frustumCulled={false} />
    </group>
  );
}

/**
 * Billboard planes display the generated concept-art textures (§27).
 * useTexture caches by URL; disposal hands GPU memory back on unmount.
 */
function Billboards({
  billboards,
}: {
  billboards: ReturnType<typeof generateCity>["billboards"];
}): React.JSX.Element | null {
  const textures = useTexture([billboardVolt, billboardOrbital, billboardMind]);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const materials = useMemo(
    () =>
      textures.map(
        (t: Texture) =>
          new MeshBasicMaterial({ map: t, toneMapped: false, side: DoubleSide, fog: true })
      ),
    [textures]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      for (const m of materials) m.dispose();
      // Textures are cache-owned (drei useTexture) — flagged for GC via
      // explicit dispose only when the component tree dies (§22 policy).
      for (const t of textures) t.dispose();
    };
  }, [geometry, materials, textures]);

  if (billboards.length === 0) return null;
  return (
    <group>
      {billboards.map((b, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={materials[b.textureIndex % materials.length]}
          position={[b.x, b.y, b.z]}
          rotation-y={b.rotY}
          scale={[b.width, b.height, 1]}
        />
      ))}
    </group>
  );
}

