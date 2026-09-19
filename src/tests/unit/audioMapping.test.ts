import { describe, expect, it } from "vitest";
import { engineFrequency, engineGain } from "@/engine/audio/AudioSystem";

/** Audio mapping contracts (§33 audio simulation, §31 reference tests). */

describe("engineFrequency", () => {
  it("is non-decreasing with speed and saturates at the 220 Hz cap", () => {
    let prev = -1;
    for (let s = 0; s <= 200; s += 10) {
      const f = engineFrequency(s, "driving");
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
    // Cap reached at (220−42)/1.15 ≈ 154.8 km/h.
    expect(engineFrequency(160, "driving")).toBe(220);
  });

  it("is clamped to a sane ceiling (no runaway pitch)", () => {
    expect(engineFrequency(9999, "driving")).toBe(220);
    expect(engineFrequency(9999, "flying")).toBe(220);
  });

  it("on-foot is silent via gain, but the mapping stays defined", () => {
    expect(engineGain(0, 0, "on-foot")).toBe(0);
    expect(engineGain(50, 0, "on-foot")).toBe(0);
    expect(engineFrequency(50, "on-foot")).toBeGreaterThan(0);
  });

  it("boost increases loudness", () => {
    expect(engineGain(80, 1, "driving")).toBeGreaterThan(engineGain(80, 0, "driving"));
  });

  it("gain never exceeds the mix ceiling", () => {
    expect(engineGain(400, 1, "driving")).toBeLessThanOrEqual(0.22);
    expect(engineGain(400, 1, "flying")).toBeLessThanOrEqual(0.22);
  });
});
