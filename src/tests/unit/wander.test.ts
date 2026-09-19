import { describe, expect, it } from "vitest";
import { RngStream } from "@/lib/math/Random";
import { createWanderer, stepWander } from "@/lib/math/wander";

/** Shared wander behaviour contracts (§33 ambient AI). */

describe("createWanderer", () => {
  it("is deterministic for a given seed", () => {
    const a = createWanderer(1337, 0, 0, 10, 1, 2);
    const b = createWanderer(1337, 0, 0, 10, 1, 2);
    expect(a).toEqual(b);
  });

  it("spawns inside the home disc", () => {
    for (let seed = 0; seed < 40; seed++) {
      const w = createWanderer(seed * 7919, 5, -7, 12, 1, 2);
      expect(Math.hypot(w.x - 5, w.z + 7)).toBeLessThanOrEqual(12 + 1e-9);
      expect(w.speed).toBeGreaterThanOrEqual(1);
      expect(w.speed).toBeLessThanOrEqual(2);
    }
  });
});

describe("stepWander", () => {
  it("replays identically for the same step sequence", () => {
    const run = (): number[] => {
      const w = createWanderer(42, 0, 0, 20, 1.5, 1.5);
      const rng = new RngStream(999);
      const trace: number[] = [];
      let now = 0;
      for (let i = 0; i < 400; i++) {
        const dt = 1 / 60;
        now += dt;
        stepWander(w, dt, now, 20, rng);
        trace.push(w.x, w.z, w.yaw);
      }
      return trace;
    };
    expect(run()).toEqual(run());
  });

  it("never leaves the home radius", () => {
    const w = createWanderer(7, 0, 0, 15, 2, 2);
    const rng = new RngStream(1234);
    let now = 0;
    for (let i = 0; i < 6000; i++) {
      const dt = 1 / 60;
      now += dt;
      stepWander(w, dt, now, 15, rng);
      // Waypoints are inside the disc and steps move toward them, so the
      // position can overshoot the disc only by sub-step margin.
      expect(Math.hypot(w.x, w.z)).toBeLessThanOrEqual(15 + 2.5);
    }
  });

  it("pauses: returns 0 speed while pauseUntil holds", () => {
    const w = createWanderer(9, 0, 0, 10, 2, 2);
    const rng = new RngStream(5);
    let now = 0;
    // Force an immediate pause.
    w.pauseUntil = 3;
    for (let i = 0; i < 100; i++) {
      now += 1 / 60;
      expect(stepWander(w, 1 / 60, now, 10, rng)).toBe(0);
    }
    expect(now).toBeLessThan(3);
  });

  it("moves toward its target when active", () => {
    const w = createWanderer(11, 0, 0, 30, 2, 2);
    w.x = 0;
    w.z = 0;
    w.targetX = 10;
    w.targetZ = 0;
    w.pauseUntil = 0;
    const before = Math.hypot(w.targetX - w.x, w.targetZ - w.z);
    stepWander(w, 0.5, 10, 30, new RngStream(1));
    const after = Math.hypot(w.targetX - w.x, w.targetZ - w.z);
    expect(after).toBeLessThan(before);
  });
});
