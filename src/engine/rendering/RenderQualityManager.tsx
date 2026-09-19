import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { getQualityProfile } from "./quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("quality");

/**
 * Applies the quality profile to renderer-level state that must react at
 * runtime: device pixel ratio cap and shadow-map enable flag. Per-subsystem
 * quality consumers (shadows resolution, volumetrics, particles) subscribe
 * to the store themselves — this component only owns cross-cutting state.
 */
export function RenderQualityManager(): null {
  const quality = useSettingsStore(selectQuality);
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const profile = getQualityProfile(quality);
    setDpr(Math.min(window.devicePixelRatio || 1, profile.dprCap));
    gl.shadowMap.enabled = profile.shadowEnabled;
    // Changing shadow enable requires materials to recompile.
    gl.shadowMap.needsUpdate = true;
    log.info(`quality → ${quality}: dpr≤${profile.dprCap} shadows=${profile.shadowEnabled}`);
  }, [quality, setDpr, gl]);

  return null;
}
