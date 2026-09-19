import { describe, expect, it } from "vitest";
import { RngStream, hashStringToSeed, mulberry32 } from "@/lib/math/Random";

/** Deterministic seeded generation tests (§31). */

describe("mulberry32", () => {
  it("same seed → identical sequence", () => {
    const a = mulberry32(1337);
    const b = mulberry32(1337);
    for (let i = 0; i < 64; i++) expect(a()).toBe(b());
  });

  it("different seeds → different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("outputs stay in [0,1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("RngStream", () => {
  it("range respects bounds", () => {
    const r = new RngStream(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
  });

  it("int stays within [0, n)", () => {
    const r = new RngStream(11);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it("gaussian is finite and roughly centered", () => {
    const r = new RngStream(99);
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const g = r.gaussian();
      expect(Number.isFinite(g)).toBe(true);
      sum += g;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.1); // σ/√n ≈ 0.016 → 0.1 is generous
  });

  it("pick throws on empty input rather than returning undefined", () => {
    const r = new RngStream(1);
    expect(() => r.pick([])).toThrow();
  });
});

describe("hashStringToSeed", () => {
  it("is deterministic and collision-resistant enough for our use", () => {
    expect(hashStringToSeed("city")).toBe(hashStringToSeed("city"));
    expect(hashStringToSeed("city")).not.toBe(hashStringToSeed("citY"));
  });
});
