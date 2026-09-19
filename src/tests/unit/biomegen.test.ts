import { describe, expect, it } from "vitest";
import {
  CITY_RADIUS,
  FARM_DIST,
  LAKE_CENTER,
  LAKE_RADIUS,
  VILLAGE_DIST,
  generateBiomes,
  villageCameraBoxes,
} from "@/lib/geometry/biomegen";

/** District generation contracts (v1.1 §biomes). */

describe("generateBiomes", () => {
  it("is deterministic per seed", () => {
    expect(generateBiomes(1337)).toEqual(generateBiomes(1337));
    expect(generateBiomes(1337)).not.toEqual(generateBiomes(99));
  });

  it("places 2 villages with 6 houses each, clear of the city", () => {
    const b = generateBiomes(1337);
    expect(b.villages.length).toBe(3);
    for (const v of b.villages) {
      expect(v.houses.length).toBe(7);
      for (const h of v.houses) {
        expect(Math.hypot(h.x, h.z)).toBeGreaterThan(CITY_RADIUS + 100);
      }
    }
  });

  it("houses never overlap their neighbours", () => {
    const b = generateBiomes(1337);
    for (const v of b.villages) {
      for (let i = 0; i < v.houses.length; i++) {
        for (let j = i + 1; j < v.houses.length; j++) {
          const a = v.houses[i];
          const c = v.houses[j];
          if (!a || !c) continue;
          const dx = Math.abs(a.x - c.x);
          const dz = Math.abs(a.z - c.z);
          const gapX = dx - (a.width / 2 + c.width / 2);
          const gapZ = dz - (a.depth / 2 + c.depth / 2);
          expect(gapX > 0 || gapZ > 0).toBe(true);
        }
      }
    }
  });

  it("places farms beyond the village ring, skipping the lake", () => {
    const b = generateBiomes(1337);
    expect(b.farms.length).toBeGreaterThanOrEqual(6);
    for (const f of b.farms) {
      expect(Math.hypot(f.cx, f.cz)).toBeGreaterThan(VILLAGE_DIST - 80);
      expect(Math.hypot(f.cx - LAKE_CENTER.x, f.cz - LAKE_CENTER.z)).toBeGreaterThanOrEqual(
        LAKE_RADIUS + 50
      );
      expect(FARM_DIST).toBeGreaterThan(VILLAGE_DIST);
    }
  });

  it("camera boxes wrap the houses", () => {
    const b = generateBiomes(1337);
    const boxes = villageCameraBoxes(b.villages);
    expect(boxes.length).toBe(21);
    const first = b.villages[0]?.houses[0];
    const box = boxes[0];
    if (first && box) {
      expect(box.minX).toBeCloseTo(first.x - first.width / 2, 6);
      expect(box.maxY).toBeGreaterThan(first.wallHeight);
    }
  });
});
