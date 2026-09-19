import { describe, expect, it } from "vitest";
import { headlightIntensity, streetLoopRadii, trafficSpeedFactor } from "@/lib/simulation/traffic";

/** Traffic parameter contracts (§33 AI traffic). */

describe("streetLoopRadii", () => {
  it("puts loops on road centrelines: (k + ½)·blockSize", () => {
    expect(streetLoopRadii(46, 5, 3)).toEqual([23, 69, 115]);
  });

  it("respects the loop cap and grid bounds", () => {
    const radii = streetLoopRadii(46, 2, 10);
    expect(radii.length).toBe(2); // gridRadius limits before maxLoops
    expect(streetLoopRadii(46, 5, 2).length).toBe(2); // maxLoops limits
  });

  it("is strictly increasing (outer loops are farther out)", () => {
    const radii = streetLoopRadii(46, 5, 5);
    for (let i = 1; i < radii.length; i++) {
      const prev = radii[i - 1];
      const cur = radii[i];
      expect(cur).toBeDefined();
      expect(prev).toBeDefined();
      if (prev !== undefined && cur !== undefined) expect(cur).toBeGreaterThan(prev);
    }
  });
});

describe("headlightIntensity", () => {
  it("is off at noon on a dry day", () => {
    expect(headlightIntensity(12, 0)).toBe(0);
  });

  it("is fully on at midnight and 3 a.m.", () => {
    expect(headlightIntensity(0, 0)).toBe(1);
    expect(headlightIntensity(3, 0)).toBe(1);
  });

  it("transitions through dusk and dawn (partial values)", () => {
    const dusk = headlightIntensity(19, 0);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    const dawn = headlightIntensity(6, 0);
    expect(dawn).toBeGreaterThan(0);
    expect(dawn).toBeLessThan(1);
  });

  it("rain forces lights on even at noon", () => {
    expect(headlightIntensity(12, 1)).toBe(1);
    expect(headlightIntensity(12, 0.5)).toBe(0.5);
  });

  it("wraps negative hours (clamped, §32 style)", () => {
    expect(headlightIntensity(-2, 0)).toBe(1); // -2 ≡ 22:00 → night
  });
});

describe("trafficSpeedFactor", () => {
  it("is 1 when dry and 0.7 in a downpour", () => {
    expect(trafficSpeedFactor(0)).toBe(1);
    expect(trafficSpeedFactor(1)).toBeCloseTo(0.7, 9);
  });

  it("decreases monotonically with rain", () => {
    let prev = Infinity;
    for (let r = 0; r <= 1.001; r += 0.1) {
      expect(trafficSpeedFactor(r)).toBeLessThanOrEqual(prev);
      prev = trafficSpeedFactor(r);
    }
  });
});
