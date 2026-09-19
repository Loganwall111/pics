import { describe, expect, it } from "vitest";
import { SimulationClock } from "@/engine/timing/SimulationClock";

/** Time-step behaviour tests (§6, §31). */

describe("SimulationClock", () => {
  it("accumulates elapsed time from frame deltas", () => {
    const c = new SimulationClock();
    c.update(1 / 60);
    c.update(1 / 60);
    c.update(1 / 60);
    expect(c.elapsedSeconds).toBeCloseTo(3 / 60, 9);
    expect(c.frameNumber).toBe(3);
  });

  it("clamps pathological deltas (browser stall)", () => {
    const c = new SimulationClock();
    c.update(5.0); // 5-second stall
    expect(c.deltaSeconds).toBeLessThanOrEqual(c.maxFrameDeltaSeconds);
    expect(c.elapsedSeconds).toBeLessThanOrEqual(c.maxFrameDeltaSeconds);
  });

  it("consumes fixed steps and keeps a bounded backlog", () => {
    const c = new SimulationClock();
    c.update(0.25); // 15 steps worth of time
    const steps = c.consumeFixedSteps();
    expect(steps).toBe(c.maxSubsteps); // capped — no spiral of death
    // Backlog dropped, so the next call runs zero steps.
    expect(c.consumeFixedSteps()).toBe(0);
  });

  it("simulationRate scales simulated time but not shader time", () => {
    const c = new SimulationClock();
    c.simulationRate = 0.5;
    c.update(0.1);
    expect(c.elapsedSeconds).toBeCloseTo(0.05, 9);
    expect(c.shaderTimeSeconds).toBeCloseTo(0.1, 9);
  });

  it("fixedDeltaSeconds reflects the rate", () => {
    const c = new SimulationClock();
    c.simulationRate = 2;
    expect(c.fixedDeltaSeconds).toBeCloseTo((1 / 60) * 2, 12);
  });

  it("reset returns to a pristine state", () => {
    const c = new SimulationClock();
    c.update(0.2);
    c.consumeFixedSteps();
    c.reset();
    expect(c.elapsedSeconds).toBe(0);
    expect(c.frameNumber).toBe(0);
    expect(c.consumeFixedSteps()).toBe(0);
  });
});
