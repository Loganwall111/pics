import type { QualityLevel } from "@/types";

/**
 * Centralised quality manager (specification §26).
 * A single matrix controls every subsystem; nothing may hard-code a quality
 * constant elsewhere. Values are configurable, not scattered.
 */
export interface QualityProfile {
  /** Upper bound for renderer pixel ratio. */
  dprCap: number;
  shadowEnabled: boolean;
  /** Directional light shadow map resolution. */
  shadowMapSize: number;
  /** God-ray sample count (post-processing volumetric pass). */
  volumetricSamples: number;
  volumetricEnabled: boolean;
  /** EffectComposer multisample count for geometry edges. */
  multisampling: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  /** Ambient + exhaust particle budget. */
  particleBudget: number;
  /** Radius of instanced city rings included. */
  cityRadius: number;
  /** Rapier solver iteration count. */
  solverIterations: number;
  /** Star point count for night skies. */
  starCount: number;
  /** Rain streak budget (0 disables rain rendering). */
  rainCount: number;
  /** Texture anisotropy cap. */
  anisotropy: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    dprCap: 1,
    shadowEnabled: false,
    shadowMapSize: 512,
    volumetricSamples: 0,
    volumetricEnabled: false,
    multisampling: 0,
    bloomEnabled: false,
    bloomIntensity: 0,
    particleBudget: 600,
    cityRadius: 3,
    solverIterations: 2,
    starCount: 900,
    rainCount: 0,
    anisotropy: 1,
  },
  medium: {
    dprCap: 1.25,
    shadowEnabled: true,
    shadowMapSize: 1024,
    volumetricSamples: 24,
    volumetricEnabled: true,
    multisampling: 2,
    bloomEnabled: true,
    bloomIntensity: 0.45,
    particleBudget: 1600,
    cityRadius: 4,
    solverIterations: 4,
    starCount: 1800,
    rainCount: 1400,
    anisotropy: 2,
  },
  high: {
    dprCap: 1.5,
    shadowEnabled: true,
    shadowMapSize: 2048,
    volumetricSamples: 40,
    volumetricEnabled: true,
    multisampling: 4,
    bloomEnabled: true,
    bloomIntensity: 0.6,
    particleBudget: 2800,
    cityRadius: 5,
    solverIterations: 6,
    starCount: 2600,
    rainCount: 2600,
    anisotropy: 4,
  },
  ultra: {
    dprCap: 2,
    shadowEnabled: true,
    shadowMapSize: 4096,
    volumetricSamples: 64,
    volumetricEnabled: true,
    multisampling: 4,
    bloomEnabled: true,
    bloomIntensity: 0.75,
    particleBudget: 4200,
    cityRadius: 6,
    solverIterations: 8,
    starCount: 3600,
    rainCount: 4000,
    anisotropy: 8,
  },
};

const ORDER: readonly QualityLevel[] = ["low", "medium", "high", "ultra"];

export function getQualityProfile(level: QualityLevel): QualityProfile {
  return QUALITY_PROFILES[level];
}

/** Next/previous tier, used for adaptive hints and UI steppers. */
export function stepQuality(level: QualityLevel, direction: 1 | -1): QualityLevel {
  const idx = ORDER.indexOf(level);
  const next = clampIndex(idx + direction);
  return ORDER[next] ?? level;
}

function clampIndex(i: number): number {
  return Math.min(ORDER.length - 1, Math.max(0, i));
}
