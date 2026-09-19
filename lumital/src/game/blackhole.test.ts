import { describe, expect, it } from "vitest";
import { RS, diskRadii, dilationFactor, photonCaptured, photonSphere } from "./blackhole";

/** Black-hole optics contracts (§blackhole) — pinned constants. */

describe("photonCaptured", () => {
  it("captures rays inside the shadow (b < (3√3/2)·rs)", () => {
    const bCrit = ((3 * Math.sqrt(3)) / 2) * RS;
    expect(photonCaptured(bCrit - 0.001)).toBe(true);
    expect(photonCaptured(0)).toBe(true);
  });

  it("lets rays pass outside the shadow", () => {
    const bCrit = ((3 * Math.sqrt(3)) / 2) * RS;
    expect(photonCaptured(bCrit + 0.001)).toBe(false);
    expect(photonCaptured(10 * RS)).toBe(false);
  });
});

describe("structure radii", () => {
  it("orders horizon < photon sphere < disk inner < disk outer", () => {
    const { inner, outer } = diskRadii();
    expect(photonSphere()).toBeCloseTo(1.5 * RS, 9);
    expect(inner).toBe(3 * RS);
    expect(RS).toBeLessThan(photonSphere());
    expect(photonSphere()).toBeLessThan(inner);
    expect(inner).toBeLessThan(outer);
  });
});

describe("dilationFactor", () => {
  it("is 0 inside the horizon and →1 far away", () => {
    expect(dilationFactor(RS * 0.5)).toBe(0);
    expect(dilationFactor(RS * 1e6)).toBeCloseTo(1, 3);
  });

  it("matches √(1 − rs/r) at r = 4 rs", () => {
    expect(dilationFactor(4 * RS)).toBeCloseTo(Math.sqrt(0.75), 9);
  });
});
