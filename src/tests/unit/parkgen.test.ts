import { describe, expect, it } from "vitest";
import { generateParks } from "@/lib/geometry/parkgen";

/** Park generation contracts (v1.2 §parks). */

describe("generateParks", () => {
  it("is deterministic per seed", () => {
    expect(generateParks(1337)).toEqual(generateParks(1337));
    expect(generateParks(1337)).not.toEqual(generateParks(5));
  });

  it("street trees stay on sidewalk corners inside the grid", () => {
    const { streetTrees } = generateParks(1337);
    expect(streetTrees.length).toBeGreaterThan(200);
    for (const t of streetTrees) {
      // |x| mod blockSize lands on the corner offset (25.4) or its mirror
      // (46 − 25.4 = 20.6) — both mark a block-corner sidewalk position.
      const mx = Math.abs(t.x) % 46;
      const mz = Math.abs(t.z) % 46;
      const near = (m: number): boolean =>
        Math.abs(m - 25.4) < 0.01 || Math.abs(m - 20.6) < 0.01;
      expect(near(mx)).toBe(true);
      expect(near(mz)).toBe(true);
      // Corner-diagonal bound: gridRadius·46 + 25.4 per axis.
      expect(Math.hypot(t.x, t.z)).toBeLessThan(Math.SQRT2 * (5 * 46 + 25.4) + 1);
    }
  });

  it("plants 4 greenbelt parks clear of the city and villages", () => {
    const { parks } = generateParks(1337);
    expect(parks.length).toBe(4);
    const villages: [number, number][] = [
      [0, -420],
      [420, 60],
      [-420, 30],
    ];
    for (const p of parks) {
      expect(Math.hypot(p.cx, p.cz)).toBeGreaterThan(253 + 40); // outside city
      for (const [vx, vz] of villages) {
        expect(Math.hypot(p.cx - vx, p.cz - vz)).toBeGreaterThan(64 + 20);
      }
    }
  });

  it("each park has trees, benches and a pond inside its lawn", () => {
    const { parks } = generateParks(1337);
    for (const p of parks) {
      expect(p.trees.length).toBeGreaterThanOrEqual(10);
      expect(p.benches.length).toBe(4);
      if (p.pond) {
        expect(Math.hypot(p.pond.x - p.cx, p.pond.z - p.cz)).toBeLessThan(p.lawnRadius);
        expect(p.pond.r).toBeLessThan(p.lawnRadius / 2);
      }
      for (const t of p.trees) {
        expect(Math.hypot(t.x - p.cx, t.z - p.cz)).toBeLessThanOrEqual(p.lawnRadius + 0.01);
      }
    }
  });
});
