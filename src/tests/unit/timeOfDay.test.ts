import { describe, expect, it } from "vitest";
import { sampleTimeOfDay, MODE_GRAVITY, type TimeOfDayOutput } from "@/engine/simulation/TimeOfDay";
import { Color, Vector3 } from "three";

/** Time-of-day model tests (§11, §31): mathematically interpolated skies. */

function makeOutput(): TimeOfDayOutput {
  return {
    sunDirection: new Vector3(0, 1, 0),
    sunColor: new Color(),
    zenithColor: new Color(),
    horizonColor: new Color(),
    fogColor: new Color(),
    nightFactor: 0,
    sunIntensity: 0,
    rayleighStrength: 0,
    mieStrength: 0,
    starOpacity: 0,
  };
}

describe("time of day", () => {
  it("sun is overhead-ish at noon and below the horizon at midnight", () => {
    const noon = makeOutput();
    sampleTimeOfDay(12, noon);
    // 0.55, not ~1: the model applies an intentional off-axis tilt so
    // noon shadows stay visually interesting (documented in TimeOfDay).
    expect(noon.sunDirection.y).toBeGreaterThan(0.55);

    const midnight = makeOutput();
    sampleTimeOfDay(0, midnight);
    expect(midnight.sunDirection.y).toBeLessThan(-0.5);
  });

  it("sun direction is always a unit vector across the whole cycle", () => {
    const out = makeOutput();
    for (let h = 0; h <= 24; h += 0.25) {
      sampleTimeOfDay(h, out);
      const d = out.sunDirection;
      const len = Math.hypot(d.x, d.y, d.z);
      expect(Math.abs(len - 1)).toBeLessThan(1e-6);
    }
  });

  it("night factor is 1 at midnight and ~0 midday", () => {
    const out = makeOutput();
    sampleTimeOfDay(0, out);
    expect(out.nightFactor).toBeGreaterThan(0.95);
    sampleTimeOfDay(12, out);
    expect(out.nightFactor).toBeLessThan(0.05);
  });

  it("day skies are brighter than night skies", () => {
    const day = makeOutput();
    const night = makeOutput();
    sampleTimeOfDay(13, day);
    sampleTimeOfDay(1, night);
    const lum = (c: Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    expect(lum(day.zenithColor)).toBeGreaterThan(lum(night.zenithColor));
  });

  it("forced preset pins the palette (low-gravity alien sky)", () => {
    const normal = makeOutput();
    const forced = makeOutput();
    sampleTimeOfDay(12, normal);
    sampleTimeOfDay(12, forced, { forcedPreset: "turquoise" });
    expect(forced.zenithColor.getHex()).not.toBe(normal.zenithColor.getHex());
  });

  it("scattering strengths stay finite and bounded across the cycle", () => {
    const out = makeOutput();
    for (let h = 0; h <= 24; h += 0.5) {
      sampleTimeOfDay(h, out);
      expect(Number.isFinite(out.rayleighStrength)).toBe(true);
      expect(Number.isFinite(out.mieStrength)).toBe(true);
      expect(out.rayleighStrength).toBeGreaterThanOrEqual(0);
      expect(out.mieStrength).toBeGreaterThanOrEqual(0);
      expect(out.starOpacity).toBeGreaterThanOrEqual(0);
      expect(out.starOpacity).toBeLessThanOrEqual(1);
    }
  });
});

describe("mode gravity presets", () => {
  it("metropolis is earth-like, low-gravity is lunar, space is zero-g", () => {
    expect(MODE_GRAVITY.METROPOLIS!.y).toBeCloseTo(-9.81, 2);
    expect(MODE_GRAVITY.LOW_GRAVITY!.y).toBeCloseTo(-1.62, 2);
    expect(MODE_GRAVITY.ORBITAL!.y).toBe(0);
    expect(MODE_GRAVITY.DEEP_SPACE!.y).toBe(0);
  });
});
