import { useEffect, useMemo, useState } from "react";
import { MeshStandardMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector2, type CanvasTexture, type Texture } from "three";
import { makeAsphaltTextures, makeCityLayoutTexture } from "@/lib/geometry/textures";
import { GROUND_WET_UNIFORMS } from "@/shaders/terrain/wetUniforms";
import { useSettingsStore } from "@/state/stores/settingsStore";
import asphaltPhotoUrl from "@/assets/textures/asphalt.jpg";
import paversPhotoUrl from "@/assets/textures/pavers.jpg";

/**
 * Metropolitan ground (§14 + asset directive §1).
 *
 * Native Three.js PBR (MeshStandardMaterial) fed by deterministic maps:
 * the city plane composites the AI-generated asphalt / paver photography
 * into the road layout canvas at boot (photo pass), then a wet-street
 * injection (damp asphalt + puddles) modulates roughness/albedo — this
 * EXTENDS the PBR material; the BRDF stays native.
 *
 * Progressive: the procedural canvas renders immediately, the photo
 * composite swaps in when the bundled images decode. Full disposal (§22).
 */

/** Load a bundled image via decoded <img> (no three loader needed). */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`ground: failed to decode ${url}`));
    img.src = url;
  });
}

export function Ground(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const [photos, setPhotos] = useState<{
    asphalt?: HTMLImageElement;
    pavers?: HTMLImageElement;
  }>({});

  // Photo decode is progressive: procedural canvas first, photo pass after.
  useEffect(() => {
    let alive = true;
    Promise.all([loadImage(asphaltPhotoUrl), loadImage(paversPhotoUrl)])
      .then(([asphalt, pavers]) => {
        if (alive) setPhotos({ asphalt, pavers });
      })
      .catch((err: unknown) => {
        // Non-fatal: the procedural ground remains authoritative fallback.
        console.warn("[ground] photo pass unavailable, procedural only:", err);
      });
    return () => {
      alive = false;
    };
  }, []);

  const asphalt = useMemo(() => makeAsphaltTextures(9001 + citySeed, 8), [citySeed]);
  const layoutTexture = useMemo(() => {
    return makeCityLayoutTexture(46, 12, 5, citySeed, 2048, photos);
  }, [citySeed, photos]);

  const cityGeometry = useMemo(() => new PlaneGeometry(506, 506), []);
  const farGeometry = useMemo(() => new PlaneGeometry(4000, 4000), []);

  // Damp-street puddle injection (§14 wetness): roughness collapses and the
  // surface darkens inside a deterministic noise mask — reads as wet asphalt
  // after rain. Injected once at material creation; uniforms not needed.
  const cityMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      map: layoutTexture,
      roughness: 0.86,
      metalness: 0.0, // concrete/asphalt is dielectric — never metallic (§14)
      normalMap: asphalt.normalMap,
      normalScale: new Vector2(0.35, 0.35),
    });
    mat.onBeforeCompile = (shader) => {
      // Wetness uniform is OWNED by the weather system (§23): bound by
      // reference here, mutated per frame by SimulationLoop.
      shader.uniforms.u_wetness = GROUND_WET_UNIFORMS.u_wetness;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float u_wetness;
// Stable value noise for the puddle mask (deterministic, no textures).
float gndHash(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}
float gndNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(gndHash(i), gndHash(i + vec2(1.0, 0.0)), f.x),
    mix(gndHash(i + vec2(0.0, 1.0)), gndHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
{
  // Plane is 506 world units; its 0..1 vUv scales linearly with world XZ,
  // so vUv * 506 is a world-space noise domain that never depends on
  // optional shader defines (works with shadows off, §26 LOW tier).
  vec2 wUV = vUv * 506.0 * 0.055;
  float field = gndNoise(wUV) * 0.72 + gndNoise(wUV * 3.7) * 0.28;
  float puddle = smoothstep(0.56, 0.72, field) * clamp(u_wetness, 0.0, 1.0);
  // Uniform damp film scales with overall wetness; puddles on top.
  float damp = clamp(u_wetness, 0.0, 1.0) * 0.35;
  roughnessFactor = mix(roughnessFactor, 0.08, clamp(puddle * 0.92 + damp, 0.0, 1.0));
  diffuseColor.rgb *= mix(1.0, 0.52, puddle * 0.85) * mix(1.0, 0.82, damp);
}`
        );
    };
    mat.customProgramCacheKey = () => "city-ground-wet";
    return mat;
  }, [layoutTexture, asphalt]);

  const farMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        map: asphalt.map,
        roughnessMap: asphalt.roughnessMap,
        normalMap: asphalt.normalMap,
        roughness: 0.95,
        metalness: 0.0,
        normalScale: new Vector2(0.5, 0.5),
      }),
    [asphalt]
  );

  useEffect(() => {
    asphalt.map.repeat.set(220, 220);
    asphalt.roughnessMap.repeat.set(220, 220);
    asphalt.normalMap.repeat.set(220, 220);
    for (const t of [asphalt.map, asphalt.roughnessMap, asphalt.normalMap]) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
    }
  }, [asphalt]);

  // Full disposal chain (§22).
  useEffect(() => {
    return () => {
      cityGeometry.dispose();
      farGeometry.dispose();
      cityMaterial.dispose();
      farMaterial.dispose();
      (layoutTexture as CanvasTexture).dispose();
      asphalt.dispose();
    };
  }, [cityGeometry, farGeometry, cityMaterial, farMaterial, layoutTexture, asphalt]);

  const configureMap = (t: Texture): void => {
    t.colorSpace = SRGBColorSpace;
  };
  configureMap(layoutTexture);
  configureMap(asphalt.map);

  return (
    <group>
      <mesh geometry={cityGeometry} material={cityMaterial} rotation-x={-Math.PI / 2} receiveShadow />
      <mesh geometry={farGeometry} material={farMaterial} rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow />
    </group>
  );
}
