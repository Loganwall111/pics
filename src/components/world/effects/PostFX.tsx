import { useMemo } from "react";
import { Bloom, EffectComposer, GodRays, Vignette } from "@react-three/postprocessing";
import { HalfFloatType, type Mesh } from "three";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("postfx");

/**
 * Post-processing composition (§12).
 *
 * Pipeline (single EffectComposer, HalfFloat input buffer):
 *   scene → GodRays (sun-masked occlusion volumetrics, real geometry)
 *         → Bloom (mipmap) → Vignette → renderer tone mapping → present
 *
 * Quality tiers drive sample count, multisampling and whether the composer
 * mounts at all (LOW tier renders the raw scene for maximum headroom).
 * The sun mesh is a real scene object (see celestial/SunMesh) — no fake
 * light-shaft geometry anywhere in the pipeline.
 */
export function PostFX({ sunMesh }: { sunMesh: Mesh | null }): React.JSX.Element | null {
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);

  const godRaysProps = useMemo(
    () => ({
      samples: profile.volumetricSamples,
      density: 0.96,
      decay: 0.92,
      weight: 0.32,
      exposure: 0.42,
      clampMax: 1,
      blur: true,
    }),
    [profile.volumetricSamples]
  );

  if (!profile.volumetricEnabled || !profile.bloomEnabled) {
    // LOW tier: composer disabled entirely — documented quality behaviour.
    return null;
  }

  if (!sunMesh) {
    // Sun not mounted yet (first frames) — skip, effect mounts when ready.
    return null;
  }

  log.info(`composer active: samples=${profile.volumetricSamples} msaa=${profile.multisampling}`);

  return (
    <EffectComposer multisampling={profile.multisampling} frameBufferType={HalfFloatType}>
      <GodRays sun={sunMesh} {...godRaysProps} />
      {profile.bloomEnabled ? (
        <Bloom
          intensity={profile.bloomIntensity}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
      ) : null}
      <Vignette offset={0.22} darkness={0.55} />
    </EffectComposer>
  );
}
