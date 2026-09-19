import { describe, expect, it } from "vitest";
import { DEFAULT_CITY_CONFIG, generateCity } from "@/lib/geometry/citygen";

/** Deterministic seeded generation tests (§13, §31). */

describe("generateCity", () => {
  it("same seed produces an identical layout (deep equality)", () => {
    const a = generateCity(1337, DEFAULT_CITY_CONFIG);
    const b = generateCity(1337, DEFAULT_CITY_CONFIG);
    expect(a).toEqual(b);
  });

  it("different seeds produce different layouts", () => {
    const a = generateCity(1337, DEFAULT_CITY_CONFIG);
    const b = generateCity(999, DEFAULT_CITY_CONFIG);
    expect(a.buildings[0]).not.toEqual(b.buildings[0]);
  });

  it("buildings stay inside the city bounds and above minimum size", () => {
    const layout = generateCity(7, DEFAULT_CITY_CONFIG);
    const bounds = DEFAULT_CITY_CONFIG.blockSize * (DEFAULT_CITY_CONFIG.gridRadius + 0.5);
    for (const b of layout.buildings) {
      expect(Math.abs(b.x)).toBeLessThanOrEqual(bounds);
      expect(Math.abs(b.z)).toBeLessThanOrEqual(bounds);
      expect(b.width).toBeGreaterThanOrEqual(6);
      expect(b.depth).toBeGreaterThanOrEqual(6);
      expect(b.height).toBeGreaterThanOrEqual(8);
      expect(b.height).toBeLessThanOrEqual(DEFAULT_CITY_CONFIG.maxHeight * 1.3);
    }
  });

  it("the central plaza block contains no buildings at the origin block", () => {
    const layout = generateCity(21, { ...DEFAULT_CITY_CONFIG, plaza: true });
    const bs = DEFAULT_CITY_CONFIG.blockSize / 2;
    for (const b of layout.buildings) {
      const inPlaza = Math.abs(b.x) < bs && Math.abs(b.z) < bs;
      expect(inPlaza).toBe(false);
    }
  });

  it("window grid parameters are positive integers", () => {
    const layout = generateCity(5, DEFAULT_CITY_CONFIG);
    for (const b of layout.buildings) {
      expect(b.windowCols).toBeGreaterThanOrEqual(2);
      expect(b.windowRows).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(b.windowCols)).toBe(true);
      expect(Number.isInteger(b.windowRows)).toBe(true);
      expect(b.litProbability).toBeGreaterThan(0);
      expect(b.litProbability).toBeLessThanOrEqual(0.92);
    }
  });

  it("billboards only attach to tall towers", () => {
    const layout = generateCity(1337, DEFAULT_CITY_CONFIG);
    for (const bb of layout.billboards) {
      const host = layout.buildings.find(
        (b) => Math.abs(b.x - bb.x) < b.width && Math.abs(b.z - bb.z) < b.depth
      );
      if (host) {
        expect(host.height).toBeGreaterThan(DEFAULT_CITY_CONFIG.maxHeight * 0.5);
      }
    }
  });
});
