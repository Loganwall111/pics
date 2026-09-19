import { describe, expect, it } from "vitest";
import { WORLDS, WORLD_ORDER, nextWorld } from "./worlds";

/** World contracts (§worlds) — analytic terrain, deterministic. */

describe("worlds", () => {
  it("terrain functions are deterministic", () => {
    for (const id of WORLD_ORDER) {
      const w = WORLDS[id];
      expect(w.terrainHeight(12.3, -45.6)).toBe(w.terrainHeight(12.3, -45.6));
    }
  });

  it("terrain stays within a walkable band near the origin", () => {
    for (const id of WORLD_ORDER) {
      const w = WORLDS[id];
      for (let x = -80; x <= 80; x += 7) {
        for (let z = -80; z <= 80; z += 7) {
          const h = w.terrainHeight(x, z);
          expect(h).toBeGreaterThan(-40);
          expect(h).toBeLessThan(40);
        }
      }
    }
  });

  it("nextWorld cycles through all six without repeats per lap", () => {
    let current: (typeof WORLD_ORDER)[number] = "void";
    const seen = new Set<(typeof WORLD_ORDER)[number]>([current]);
    for (let i = 0; i < 5; i++) {
      current = nextWorld(current);
      expect(seen.has(current)).toBe(false);
      seen.add(current);
    }
    expect(nextWorld(current)).toBe("void"); // full lap
  });

  it("palettes are valid rgb triples in [0, 1]", () => {
    for (const id of WORLD_ORDER) {
      const w = WORLDS[id];
      for (const c of [...w.sky, ...w.fogColor]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});
