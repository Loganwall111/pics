import type { QualityLevel, QualityProfile } from '@/types'

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    shadowMapSize: 512,
    volumetricSamples: 32,
    postFxResolutionScale: 0.5,
    particleDensity: 0.3,
    buildingRenderDistance: 300,
    physicsComplexity: 0.5,
    maxAnisotropy: 1
  },
  medium: {
    shadowMapSize: 1024,
    volumetricSamples: 64,
    postFxResolutionScale: 0.75,
    particleDensity: 0.6,
    buildingRenderDistance: 600,
    physicsComplexity: 0.8,
    maxAnisotropy: 4
  },
  high: {
    shadowMapSize: 2048,
    volumetricSamples: 128,
    postFxResolutionScale: 1.0,
    particleDensity: 1.0,
    buildingRenderDistance: 1000,
    physicsComplexity: 1.0,
    maxAnisotropy: 8
  },
  ultra: {
    shadowMapSize: 4096,
    volumetricSamples: 256,
    postFxResolutionScale: 1.0,
    particleDensity: 1.5,
    buildingRenderDistance: 2000,
    physicsComplexity: 1.2,
    maxAnisotropy: 16
  }
}

export function getQualityProfile(level: QualityLevel): QualityProfile {
  return QUALITY_PROFILES[level]
}
