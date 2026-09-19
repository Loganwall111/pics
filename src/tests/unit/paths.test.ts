import { describe, expect, it } from "vitest";
import { squareLoopLength, squareLoopPoint } from "@/lib/math/paths";

/** Pedestrian circuit path contracts (§33, §31). */

describe("squareLoopPoint", () => {
  it("stays on the circuit boundary for any arc length", () => {
    const r = 24;
    const out = { x: 0, z: 0, tx: 0, tz: 0 };
    for (let s = -100; s < 1000; s += 3.7) {
      squareLoopPoint(r, s, out);
      const onBoundary =
        Math.abs(Math.abs(out.x) - r) < 1e-9 || Math.abs(Math.abs(out.z) - r) < 1e-9;
      expect(onBoundary).toBe(true);
    }
  });

  it("wraps exactly: p(s) === p(s + perimeter)", () => {
    const r = 33;
    const a = { x: 0, z: 0, tx: 0, tz: 0 };
    const b = { x: 0, z: 0, tx: 0, tz: 0 };
    const perimeter = squareLoopLength(r);
    squareLoopPoint(r, 123.4, a);
    squareLoopPoint(r, 123.4 + perimeter, b);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.z).toBeCloseTo(b.z, 9);
    expect(a.tx).toBeCloseTo(b.tx, 9);
  });

  it("tangent is a unit vector everywhere", () => {
    const out = { x: 0, z: 0, tx: 0, tz: 0 };
    for (let s = 0; s < 500; s += 1.1) {
      squareLoopPoint(24, s, out);
      expect(Math.hypot(out.tx, out.tz)).toBeCloseTo(1, 9);
    }
  });

  it("is continuous: |p(s+ds) − p(s)| ≈ ds except across corners", () => {
    const r = 24;
    const a = { x: 0, z: 0, tx: 0, tz: 0 };
    const b = { x: 0, z: 0, tx: 0, tz: 0 };
    const ds = 0.5;
    let discontinuities = 0;
    // Offset grid (start 0.3) so corners at multiples of 2r are crossed
    // mid-step rather than sampled exactly.
    for (let s = 0.3; s < squareLoopLength(r) - 1; s += ds) {
      squareLoopPoint(r, s, a);
      squareLoopPoint(r, s + ds, b);
      const dist = Math.hypot(b.x - a.x, b.z - a.z);
      if (Math.abs(dist - ds) > 1e-6) discontinuities++;
    }
    // 3 sharp corner jumps inside the open lap interval; the 4th corner
    // coincides with the wrap seam at s = perimeter and is excluded.
    expect(discontinuities).toBe(3);
  });

  it("rejects non-positive radius loudly", () => {
    const out = { x: 0, z: 0, tx: 0, tz: 0 };
    expect(() => squareLoopPoint(0, 1, out)).toThrow(RangeError);
  });
});
