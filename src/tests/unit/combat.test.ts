import { describe, expect, it } from "vitest";
import { coneTarget, offCooldown, throwRange, throwVelocity } from "@/lib/simulation/combat";

/** Combat math contracts (v1.1 §combat). */

const targets = [
  { id: 0, x: 0, z: 5 }, // dead ahead if yaw = 0
  { id: 1, x: 3, z: 4 }, // ~36.87° right
  { id: 2, x: -10, z: 0 }, // left, far
];

describe("coneTarget", () => {
  it("hits the target dead ahead", () => {
    const t = coneTarget(0, 0, 0, 8, 0.5, targets);
    expect(t?.id).toBe(0);
  });

  it("respects the facing cone", () => {
    // (3,4) sits 53° off the +x axis: inside a ±1.0 rad cone facing +x,
    // outside a ±0.6 rad one.
    const t = coneTarget(0, 0, Math.PI / 2, 8, 1.0, targets);
    expect(t?.id).toBe(1);
    expect(coneTarget(0, 0, Math.PI / 2, 8, 0.6, targets)).toBeNull();
    // Narrow cone facing +z picks the dead-ahead target.
    expect(coneTarget(0, 0, 0, 8, 0.2, targets)?.id).toBe(0);
  });

  it("respects range", () => {
    expect(coneTarget(0, 0, 0, 2, 0.5, targets)).toBeNull();
  });

  it("yaw wrapping stays consistent across ±π", () => {
    // Facing -z (yaw = π) should find nothing behind.
    expect(coneTarget(0, 0, Math.PI, 6, 0.3, targets)).toBeNull();
  });
});

describe("throwVelocity", () => {
  it("45° pitch maximises range among sampled pitches", () => {
    const g = 9.81;
    const v = 18;
    let best = 0;
    for (let deg = 5; deg <= 85; deg += 5) {
      const out = { x: 0, y: 0, z: 0 };
      throwVelocity(0, (deg * Math.PI) / 180, v, out);
      const t = (2 * out.y) / g;
      const range = out.z * t;
      best = Math.max(best, range);
    }
    expect(best).toBeCloseTo(throwRange(v, g), 1);
  });

  it("points along yaw", () => {
    const out = { x: 0, y: 0, z: 0 };
    throwVelocity(Math.PI / 2, 0, 10, out);
    expect(out.x).toBeCloseTo(10, 9);
    expect(out.z).toBeCloseTo(0, 9);
  });
});

describe("offCooldown", () => {
  it("gates until the cooldown elapses", () => {
    expect(offCooldown(10, 10.4, 0.5)).toBe(false);
    expect(offCooldown(10, 10.5, 0.5)).toBe(true);
  });
});
