import { describe, expect, it } from "vitest";
import { BOLT_MAX_SEGMENTS, writeBolt } from "@/lib/math/bolt";

/** Lightning-bolt generator contracts (§33 weather). */

const makeBuf = (): Float32Array => new Float32Array(BOLT_MAX_SEGMENTS * 6);

describe("writeBolt", () => {
  it("is deterministic for a given seed", () => {
    const a = makeBuf();
    const b = makeBuf();
    const na = writeBolt(1337, 100, -50, 320, 0, 26, a);
    const nb = writeBolt(1337, 100, -50, 320, 0, 26, b);
    expect(na).toBe(nb);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("differs across seeds", () => {
    const a = makeBuf();
    const b = makeBuf();
    writeBolt(1, 0, 0, 300, 0, 20, a);
    writeBolt(2, 0, 0, 300, 0, 20, b);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("descends monotonically and lands near the aim point", () => {
    const buf = makeBuf();
    const segs = writeBolt(42, 10, -10, 320, 0, 30, buf);
    let prevY = Infinity;
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    for (let s = 0; s < segs; s++) {
      const sy = buf[s * 6 + 1] ?? 0;
      const ex = buf[s * 6 + 3] ?? 0;
      const ey = buf[s * 6 + 4] ?? 0;
      const ez = buf[s * 6 + 5] ?? 0;
      // Every segment (main channel and branch spurs) descends.
      expect(ey).toBeLessThan(sy + 1e-9);
      prevY = sy;
      lastX = ex;
      lastY = ey;
      lastZ = ez;
    }
    void prevY;
    expect(lastY).toBeCloseTo(0, 6);
    expect(Math.hypot(lastX - 10, lastZ - -10)).toBeLessThanOrEqual(30 * 1.6);
  });

  it("starts at the cloud base anchor", () => {
    const buf = makeBuf();
    writeBolt(7, 5, 6, 300, 0, 20, buf);
    expect(buf[0]).toBeCloseTo(5, 6);
    expect(buf[1]).toBeCloseTo(300, 6);
    expect(buf[2]).toBeCloseTo(6, 6);
  });

  it("segment count is 16 main plus branch spurs, within capacity", () => {
    for (let seed = 0; seed < 25; seed++) {
      const segs = writeBolt(seed * 97 + 1, 0, 0, 300, 0, 24, makeBuf());
      expect(segs).toBeGreaterThanOrEqual(16);
      expect(segs).toBeLessThanOrEqual(BOLT_MAX_SEGMENTS);
    }
  });

  it("rejects undersized buffers and inverted heights loudly", () => {
    expect(() => writeBolt(1, 0, 0, 300, 0, 20, new Float32Array(6))).toThrow(RangeError);
    expect(() => writeBolt(1, 0, 0, 0, 300, 20, makeBuf())).toThrow(RangeError);
  });
});
