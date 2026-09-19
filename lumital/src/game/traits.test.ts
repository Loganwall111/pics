import { describe, expect, it } from "vitest";
import {
  TRAITS,
  buyTrait,
  glowIntensity,
  investedDna,
  speedMultiplier,
  totalLimbPairs,
  traitCost,
} from "./traits";

/** Evolution contracts (§evolution). */

describe("traitCost", () => {
  it("escalates geometrically and hits Infinity at max", () => {
    const stride = TRAITS.find((t) => t.id === "stride");
    if (!stride) throw new Error("missing trait");
    expect(traitCost(stride, 0)).toBe(stride.baseCost);
    expect(traitCost(stride, 1)).toBe(Math.round(stride.baseCost * 1.5));
    expect(traitCost(stride, stride.maxLevel)).toBe(Infinity);
  });
});

describe("buyTrait", () => {
  it("spends dna and levels up", () => {
    const res = buyTrait(100, {}, "glow");
    expect(res).not.toBeNull();
    if (res) {
      expect(res.dna).toBe(85); // glow baseCost 15
      expect(res.levels.glow).toBe(1);
    }
  });

  it("rejects unaffordable or maxed traits", () => {
    expect(buyTrait(5, {}, "glow")).toBeNull();
    expect(buyTrait(999, { halo: 1 }, "halo")).toBeNull();
  });

  it("mutating loadouts accumulate invested dna", () => {
    let dna = 300;
    let levels = {};
    for (const id of ["glow", "glow", "stride"] as const) {
      const res = buyTrait(dna, levels, id);
      if (res) {
        dna = res.dna;
        levels = res.levels;
      }
    }
    expect(investedDna(levels)).toBe(300 - dna);
  });
});

describe("derived stats", () => {
  it("speed multiplier caps at ×2.2", () => {
    expect(speedMultiplier({ stride: 0 })).toBe(1);
    expect(speedMultiplier({ stride: 6 })).toBeCloseTo(2.08, 5);
    expect(speedMultiplier({ stride: 99 })).toBe(2.2);
  });

  it("glow stacks plan + trait but clamps", () => {
    const plan = { glow: 1, hue: 0, hueAccent: 90, bodyLength: 1, bodyGirth: 0.5, limbCount: 2, limbLength: 0.4, limbStyle: "leg", eyeCount: 2, eyeSize: 0.1, tail: 0.5, antennae: false, dorsalFin: false, pattern: "plain", patternScale: 4 } as const;
    expect(glowIntensity(plan, { glow: 8 })).toBeLessThanOrEqual(2.4);
    expect(glowIntensity(plan, { glow: 0 })).toBeGreaterThan(1);
  });

  it("limb pairs add on top of the plan", () => {
    const plan = { limbCount: 4 } as never;
    expect(totalLimbPairs(plan, { limbs: 2 })).toBe(4); // 2 pairs + 2 levels
  });
});
