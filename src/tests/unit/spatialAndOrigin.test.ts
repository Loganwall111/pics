import { describe, expect, it } from "vitest";
import { SpatialHash } from "@/engine/spatial/SpatialHash";
import {
  FloatingOriginController,
  needsRebase,
  precisionProbe,
  type OriginSubject,
} from "@/engine/simulation/FloatingOrigin";

/** Proximity detection (§17) and floating-origin math (§9, §32). */

describe("SpatialHash", () => {
  it("finds points within radius across cell boundaries", () => {
    const hash = new SpatialHash<{ id: string; x: number; z: number }>(8);
    hash.insert({ id: "a", x: 0, z: 0 });
    hash.insert({ id: "b", x: 7.9, z: 0 }); // same cell
    hash.insert({ id: "c", x: 8.1, z: 0 }); // next cell, within radius
    hash.insert({ id: "d", x: 20, z: 20 }); // far away
    const out = hash.queryRadius(0, 0, 10, []);
    const ids = out.map((p) => p.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("queryRadius reuses the output array (allocation-free contract)", () => {
    const hash = new SpatialHash<{ id: string; x: number; z: number }>(8);
    hash.insert({ id: "a", x: 1, z: 1 });
    const out: { id: string; x: number; z: number }[] = [];
    hash.queryRadius(0, 0, 5, out);
    expect(out.length).toBe(1);
    hash.queryRadius(100, 100, 2, out);
    expect(out.length).toBe(0);
    expect(out).toBe(out); // identity preserved
  });

  it("excludeId skips the self entry", () => {
    const hash = new SpatialHash<{ id: string; x: number; z: number }>(8);
    hash.insert({ id: "self", x: 0, z: 0 });
    const out = hash.queryRadius(0, 0, 5, [], "self");
    expect(out.length).toBe(0);
  });

  it("rejects invalid cell size loudly", () => {
    expect(() => new SpatialHash(0)).toThrow(RangeError);
  });
});

describe("floating origin", () => {
  it("threshold triggers at large coordinates only", () => {
    expect(needsRebase({ x: 100, y: 0, z: 0 }, 4096)).toBe(false);
    expect(needsRebase({ x: 5000, y: 0, z: 0 }, 4096)).toBe(true);
    expect(needsRebase({ x: 0, y: -5000, z: 0 }, 4096)).toBe(true);
  });

  it("rebase shifts all registered subjects by the same offset and tracks totals", () => {
    const controller = new FloatingOriginController();
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const subjectA: OriginSubject = {
      applyOriginOffset(dx, dy, dz) {
        sx += dx;
        sy += dy;
        sz += dz;
      },
    };
    let bx = 0;
    const subjectB: OriginSubject = {
      applyOriginOffset(dx) {
        bx += dx;
      },
    };
    controller.register(subjectA);
    controller.register(subjectB);

    const shift = controller.update({ x: 6000, y: 300, z: -7000 });
    expect(shift).not.toBeNull();
    expect(sx).toBeCloseTo(-6000, 9);
    expect(sy).toBeCloseTo(-300, 9);
    expect(sz).toBeCloseTo(7000, 9);
    expect(bx).toBeCloseTo(-6000, 9);
    expect(controller.totalX).toBeCloseTo(-6000, 9);
  });

  it("does nothing below the threshold", () => {
    const controller = new FloatingOriginController();
    expect(controller.update({ x: 10, y: 20, z: 30 })).toBeNull();
  });

  it("precision probe demonstrates WHY rebasing is required (§32)", () => {
    const base = 16_000_000; // beyond float32 resolution
    const delta = 0.125;
    const { naive, rebased } = precisionProbe(base, delta);
    expect(naive).toBe(0); // naive float32-style math loses the delta entirely
    expect(rebased).toBe(0.125); // rebased coordinates preserve it
    expect(needsRebase({ x: base, y: 0, z: 0 }, 4096)).toBe(true);
  });

  it("unregistered subjects are no longer shifted", () => {
    const controller = new FloatingOriginController();
    let count = 0;
    const s: OriginSubject = {
      applyOriginOffset() {
        count++;
      },
    };
    controller.register(s);
    controller.unregister(s);
    controller.update({ x: 99999, y: 0, z: 0 });
    expect(count).toBe(0);
  });
});
