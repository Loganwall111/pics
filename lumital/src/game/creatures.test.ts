import { describe, expect, it } from "vitest";
import { SPECIES_CATALOG, SPECIES_COUNT, getSpecies } from "./creatures";

/** Creature genesis contracts (§creatures) — 108 deterministic species. */

describe("getSpecies", () => {
  it("deterministic per index", () => {
    expect(getSpecies(7)).toEqual(getSpecies(7));
    expect(getSpecies(7)).toEqual(getSpecies(7 + SPECIES_COUNT)); // wraps
  });

  it("names are unique across the whole catalog", () => {
    const names = new Set(SPECIES_CATALOG.map((s) => s.name));
    expect(names.size).toBe(SPECIES_COUNT);
  });

  it("catalog is exactly 120 species", () => {
    expect(SPECIES_COUNT).toBe(120);
    expect(SPECIES_CATALOG.length).toBe(120);
  });

  it("body plans stay in visual bounds", () => {
    for (const s of SPECIES_CATALOG) {
      expect(s.plan.bodyLength).toBeGreaterThanOrEqual(0.5);
      expect(s.plan.bodyLength).toBeLessThanOrEqual(1.6);
      expect(s.plan.limbCount).toBeLessThanOrEqual(6);
      expect(s.plan.eyeCount).toBeGreaterThanOrEqual(1);
      expect(s.plan.eyeCount).toBeLessThanOrEqual(5);
      expect(s.plan.hue).toBeGreaterThanOrEqual(0);
      expect(s.plan.hue).toBeLessThan(360);
      expect(s.plan.glow).toBeLessThanOrEqual(1);
    }
  });

  it("every species has a valid home world", () => {
    for (const s of SPECIES_CATALOG) {
      expect(["void", "maze", "blackhole", "microscopic", "ocean", "alienrain"]).toContain(
        s.homeWorld
      );
    }
  });
});
