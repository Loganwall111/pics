import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from "three";
import type { QualityLevel } from "@/types";
import { getQualityProfile } from "./quality";
import { createLogger } from "@/lib/utilities/logger";
import { frameState } from "@/state/transient/frameState";

const log = createLogger("renderer");

/**
 * Centralised renderer configuration (specification §4).
 * Runs exactly once per canvas creation (Canvas onCreated) — never from a
 * React render path. React-managed values that can change at runtime (pixel
 * ratio, shadow map size) are applied by RenderQualityManager instead.
 */
export function applyRendererConfig(renderer: WebGLRenderer, quality: QualityLevel): void {
  // WebGL2 is the authoritative target; fail loudly if unavailable.
  if (!(renderer.getContext() instanceof WebGL2RenderingContext)) {
    log.error("WebGL2 context unavailable — falling back to WebGL1 behaviour", undefined, true);
  }

  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = SRGBColorSpace; // physically-based output encoding
  renderer.shadowMap.enabled = getQualityProfile(quality).shadowEnabled;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  // Three.js r155+ uses physically correct lighting units by default
  // (useLegacyLights removed); this is the authoritative assumption (§1).
  renderer.info.autoReset = false;

  frameState.renderer = renderer;
  log.info(
    `configured: ${renderer.getContext() instanceof WebGL2RenderingContext ? "WebGL2" : "WebGL1"}`
  );
}

/**
 * Context-loss lifecycle (§4, §24). Returns a cleanup function.
 * `preventDefault` on loss enables three.js/R3F context restoration.
 */
export function attachContextLossHandlers(domElement: HTMLCanvasElement): () => void {
  const onLost = (e: Event): void => {
    e.preventDefault();
    frameState.contextLost = true;
    log.error("WebGL context lost — rendering suspended until restore", undefined, true);
  };
  const onRestored = (): void => {
    frameState.contextLost = false;
    log.info("WebGL context restored");
  };
  domElement.addEventListener("webglcontextlost", onLost);
  domElement.addEventListener("webglcontextrestored", onRestored);
  return () => {
    domElement.removeEventListener("webglcontextlost", onLost);
    domElement.removeEventListener("webglcontextrestored", onRestored);
  };
}
