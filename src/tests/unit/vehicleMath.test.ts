import { describe, expect, it } from "vitest";
import {
  lateralGripImpulse,
  longitudinalForce,
  resistanceForce,
  steeringAngle,
  suspensionForce,
} from "@/lib/physics/VehicleMath";
import { responseCurve, steeringResponse, deadzone, longitudinalResponse } from "@/lib/math/Curve";

/** Vehicle response-curve tests (§8, §31). */

describe("suspensionForce", () => {
  it("is zero when the wheel is airborne", () => {
    const r = suspensionForce(40000, 4000, 0.5, 0.4, 1.2, 0, 60000);
    expect(r.force).toBe(0);
    expect(r.compression).toBe(0);
  });

  it("grows linearly with compression", () => {
    const atRest = suspensionForce(40000, 0, 0.5, 0.4, 0.7, 0, Infinity);
    const compressed = suspensionForce(40000, 0, 0.5, 0.4, 0.5, 0, Infinity);
    expect(atRest.compression).toBeCloseTo(0.2, 9); // (0.5 + 0.4) − 0.7
    expect(compressed.compression).toBeCloseTo(0.4, 9); // (0.5 + 0.4) − 0.5
    expect(compressed.force).toBeCloseTo(40000 * 0.4, 9);
  });

  it("damping opposes compression velocity (more force while compressing)", () => {
    const still = suspensionForce(40000, 4000, 0.5, 0.4, 0.6, 0, Infinity);
    const compressing = suspensionForce(40000, 4000, 0.5, 0.4, 0.6, 2.0, Infinity);
    expect(compressing.force).toBeGreaterThan(still.force);
    // And absorbs energy while rebounding (clamped at zero, never sucks).
    const rebounding = suspensionForce(40000, 4000, 0.5, 0.4, 0.6, -5.0, Infinity);
    expect(rebounding.force).toBeGreaterThanOrEqual(0);
  });

  it("clamps at maxForce", () => {
    const r = suspensionForce(100000, 0, 0.5, 0.4, 0.1, 0, 30000);
    expect(r.force).toBe(30000);
  });
});

describe("lateralGripImpulse", () => {
  it("opposes slip", () => {
    const f = lateralGripImpulse(3.0, 5000, 0.6, 1.1);
    expect(f).toBeLessThan(0);
  });

  it("is limited by the friction circle μ·load", () => {
    const load = 5000;
    const mu = 1.1;
    const sliding = lateralGripImpulse(100, load, 2.5, mu);
    expect(Math.abs(sliding)).toBeCloseTo(mu * load, 9);
  });
});

describe("steering response", () => {
  it("full authority at low speed", () => {
    expect(steeringAngle(1, 0, 0.58, 45, 150, 0.28)).toBeCloseTo(0.58, 9);
  });

  it("fades toward the floor at high speed", () => {
    const high = steeringAngle(1, 200, 0.58, 45, 150, 0.28);
    expect(high).toBeCloseTo(0.58 * 0.28, 9);
  });

  it("responds symmetrically", () => {
    const right = steeringAngle(1, 100, 0.5, 45, 150, 0.3);
    const left = steeringAngle(-1, 100, 0.5, 45, 150, 0.3);
    expect(right).toBeCloseTo(-left, 9);
  });
});

describe("resistanceForce", () => {
  it("quadratic in speed (drag dominates at velocity)", () => {
    const slow = resistanceForce(5, 1.35, 9.5);
    const fast = resistanceForce(20, 1.35, 9.5);
    expect(fast / slow).toBeGreaterThan(3.5);
  });

  it("zero at standstill", () => {
    expect(resistanceForce(0, 1.35, 9.5)).toBe(0);
  });
});

describe("longitudinalForce", () => {
  it("brakes against motion regardless of throttle sign", () => {
    const forward = longitudinalForce(9000, 0, 14000, 1, 20);
    const backward = longitudinalForce(9000, 0, 14000, 1, -20);
    expect(forward).toBe(-14000);
    expect(backward).toBe(14000);
  });
});

describe("input response curves (§8 smoothing)", () => {
  it("responseCurve is monotonic and progressive", () => {
    let prev = 0;
    for (let x = 0; x <= 1.0001; x += 0.05) {
      const v = responseCurve(x, 0.6);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  it("deadzone zeroes small inputs and rescales large ones", () => {
    expect(deadzone(0.05, 0.15)).toBe(0);
    expect(deadzone(1, 0.15)).toBeCloseTo(1, 9);
    expect(deadzone(-1, 0.15)).toBeCloseTo(-1, 9);
  });

  it("longitudinalResponse separates accel and decel constants", () => {
    const accel = longitudinalResponse(1, 1.0, 0.7);
    const decel = longitudinalResponse(-1, 1.0, 0.7);
    expect(accel).toBeCloseTo(1.0, 9);
    expect(decel).toBeGreaterThan(-1.0); // gentler reverse per curve shape
  });

  it("steeringResponse matches steeringAngle reference", () => {
    expect(steeringResponse(0.8, 10, 0.58, 45, 150, 0.28)).toBeCloseTo(
      steeringAngle(0.8, 10, 0.58, 45, 150, 0.28),
      12
    );
  });
});
