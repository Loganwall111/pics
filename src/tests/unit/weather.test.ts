import { describe, expect, it } from "vitest";
import { integrateWetness, sampleWeather } from "@/engine/simulation/Weather";

/** Procedural weather contracts (§33, §31 determinism). */

describe("sampleWeather", () => {
  it("is deterministic: same (t, seed) → identical sample", () => {
    const a = sampleWeather(123.456, 1337);
    const b = sampleWeather(123.456, 1337);
    expect(a).toEqual(b);
  });

  it("different seeds → different weather", () => {
    const a = sampleWeather(60, 1);
    const b = sampleWeather(60, 2);
    expect(a).not.toEqual(b);
  });

  it("all channels stay bounded in [0, 1] across a long horizon", () => {
    for (let t = 0; t < 3000; t += 1.7) {
      const w = sampleWeather(t, 1337);
      for (const v of [w.cloudiness, w.rain, w.windStrength, w.lightning]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rain only falls under heavy cloud (physical implication)", () => {
    for (let t = 0; t < 2000; t += 1.3) {
      const w = sampleWeather(t, 42);
      if (w.rain > 0.02) {
        expect(w.cloudiness).toBeGreaterThan(0.55);
      }
    }
  });

  it("lightning never fires while dry", () => {
    for (let t = 0; t < 2000; t += 0.9) {
      const w = sampleWeather(t, 99);
      if (w.rain < 0.45) {
        expect(w.lightning).toBe(0);
      }
    }
  });

  it("negative time is clamped, not thrown", () => {
    expect(() => sampleWeather(-5)).not.toThrow();
    expect(sampleWeather(-5).cloudiness).toBeGreaterThanOrEqual(0);
  });
});

describe("integrateWetness", () => {
  it("soaks while raining and saturates at 1", () => {
    let wet = 0;
    // Soak rate 0.22·rain·dt ⇒ saturation after ~273 frames at 60 Hz.
    for (let i = 0; i < 200; i++) {
      const next = integrateWetness(wet, 1, 1 / 60);
      expect(next).toBeGreaterThanOrEqual(wet);
      wet = next;
    }
    expect(wet).toBeCloseTo(0.22 * (200 / 60), 5); // linear ramp pre-saturation
    for (let i = 0; i < 200; i++) wet = integrateWetness(wet, 1, 1 / 60);
    expect(wet).toBe(1);
  });

  it("dries toward 0 when the rain stops", () => {
    let wet = 1;
    for (let i = 0; i < 2000; i++) wet = integrateWetness(wet, 0, 1 / 60);
    expect(wet).toBeLessThan(0.05);
  });

  it("never leaves [0, 1] even for huge deltas (clamped, §32)", () => {
    expect(integrateWetness(0, 1, 100)).toBeLessThanOrEqual(1);
    expect(integrateWetness(1, 0, 100)).toBeGreaterThanOrEqual(0);
  });
});
