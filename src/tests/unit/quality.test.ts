import { describe, expect, it } from "vitest";
import { QUALITY_PROFILES, getQualityProfile, stepQuality } from "@/engine/rendering/quality";

/** Quality configuration tests (§26, §31). */

const LEVELS = ["low", "medium", "high", "ultra"] as const;

describe("quality profiles", () => {
  it("every level defines a complete, positive profile", () => {
    for (const level of LEVELS) {
      const p = getQualityProfile(level);
      expect(p.dprCap).toBeGreaterThan(0);
      expect(p.shadowMapSize).toBeGreaterThanOrEqual(256);
      expect(p.particleBudget).toBeGreaterThan(0);
      expect(p.cityRadius).toBeGreaterThan(0);
      expect(p.solverIterations).toBeGreaterThan(0);
      expect(p.starCount).toBeGreaterThan(0);
      expect(p.rainCount).toBeGreaterThanOrEqual(0);
      expect(p.trafficCount).toBeGreaterThanOrEqual(0);
      expect(p.birdCount).toBeGreaterThanOrEqual(0);
      expect(p.anisotropy).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(p.bloomIntensity)).toBe(true);
    }
  });

  it("resource scales rise monotonically with tier", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const prev = getQualityProfile(LEVELS[i - 1]!);
      const cur = getQualityProfile(LEVELS[i]!);
      expect(cur.dprCap).toBeGreaterThanOrEqual(prev.dprCap);
      expect(cur.shadowMapSize).toBeGreaterThanOrEqual(prev.shadowMapSize);
      expect(cur.volumetricSamples).toBeGreaterThanOrEqual(prev.volumetricSamples);
      expect(cur.particleBudget).toBeGreaterThanOrEqual(prev.particleBudget);
      expect(cur.cityRadius).toBeGreaterThanOrEqual(prev.cityRadius);
      expect(cur.solverIterations).toBeGreaterThanOrEqual(prev.solverIterations);
      expect(cur.rainCount).toBeGreaterThanOrEqual(prev.rainCount);
      expect(cur.trafficCount).toBeGreaterThanOrEqual(prev.trafficCount);
      expect(cur.birdCount).toBeGreaterThanOrEqual(prev.birdCount);
    }
  });

  it("LOW disables post-processing, ULTRA enables everything", () => {
    const low = QUALITY_PROFILES.low;
    expect(low.volumetricEnabled).toBe(false);
    expect(low.bloomEnabled).toBe(false);
    const ultra = QUALITY_PROFILES.ultra;
    expect(ultra.volumetricEnabled).toBe(true);
    expect(ultra.bloomEnabled).toBe(true);
    expect(ultra.volumetricSamples).toBeGreaterThanOrEqual(48);
  });

  it("stepQuality clamps at both ends", () => {
    expect(stepQuality("low", -1)).toBe("low");
    expect(stepQuality("ultra", 1)).toBe("ultra");
    expect(stepQuality("medium", 1)).toBe("high");
    expect(stepQuality("high", -1)).toBe("medium");
  });
});
