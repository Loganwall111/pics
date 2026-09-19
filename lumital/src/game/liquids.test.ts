import { describe, expect, it } from "vitest";
import { findPondSpots } from "./liquids";
import { WORLDS } from "./worlds";
import { WORLD_ORDER } from "./worlds";

/** Liquid placement contracts (v0.3 §liquids). */

describe("findPondSpots", () => {
  it("is deterministic per world", () => {
    expect(findPondSpots("ocean")).toEqual(findPondSpots("ocean"));
    expect(findPondSpots("ocean")).not.toEqual(findPondSpots("void"));
  });

  it("finds 3 well-separated spots on flat-ish ground for every world", () => {
    for (const id of WORLD_ORDER) {
      const spots = findPondSpots(id);
      expect(spots.length).toBe(3);
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const a = spots[i];
          const b = spots[j];
          expect(a && b && Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(55);
        }
        const spot = spots[i];
        if (spot) {
          expect(WORLDS[id].terrainHeight(spot.x, spot.z)).toBeCloseTo(spot.y - 0.12, 6);
        }
      }
    }
  });

  it("pond radius stays sane (4..12)", () => {
    for (const id of WORLD_ORDER) {
      for (const p of findPondSpots(id)) {
        expect(p.r).toBeGreaterThan(4);
        expect(p.r).toBeLessThan(12);
      }
    }
  });
});
