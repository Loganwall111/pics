import { describe, expect, it } from "vitest";
import {
  MU_EARTH,
  circularSpeed,
  eccentricAnomalyFromMean,
  elementsToState,
  meanFromEccentricAnomaly,
  orbitalPeriod,
  propagate,
  stateToElements,
  visVivaSpeed,
  type OrbitalElements,
} from "@/lib/orbital/OrbitalMechanics";

/**
 * Orbital mechanics reference tests (§31).
 * Tolerances are explicit; reference values derive from analytic two-body
 * identities (vis-viva, Kepler's third law), not from the implementation.
 */

describe("orbital: Kepler's third law", () => {
  it("ISS-like orbit period ≈ 5560 s (a = 6771 km)", () => {
    const a = 6771; // 6371 Earth radius + 400 km altitude
    const T = orbitalPeriod(a, MU_EARTH);
    // Reference: T = 2π√(a³/μ) — independent closed form.
    expect(T).toBeCloseTo(5544.0, -1); // ±10 s
  });

  it("period scales as a^1.5", () => {
    const T1 = orbitalPeriod(7000, MU_EARTH);
    const T2 = orbitalPeriod(28000, MU_EARTH);
    expect(T2 / T1).toBeCloseTo(Math.pow(4, 1.5), 6);
  });
});

describe("orbital: circular speed and vis-viva", () => {
  it("circular speed at 7000 km ≈ 7.546 km/s", () => {
    expect(circularSpeed(7000, MU_EARTH)).toBeCloseTo(7.546, 2);
  });

  it("vis-viva equals circular speed when r = a", () => {
    const v1 = visVivaSpeed(7000, 7000, MU_EARTH);
    const v2 = circularSpeed(7000, MU_EARTH);
    expect(v1).toBeCloseTo(v2, 9);
  });
});

describe("orbital: Kepler equation solver", () => {
  it("self-consistency: M(E(e,M), e) = M for e in {0, 0.3, 0.7, 0.95}", () => {
    for (const e of [0, 0.3, 0.7, 0.95]) {
      for (let k = 0; k < 16; k++) {
        const M = (k / 16) * Math.PI * 2;
        const E = eccentricAnomalyFromMean(M, e);
        const MBack = meanFromEccentricAnomaly(E, e);
        expect(Math.abs(MBack - M) % (Math.PI * 2)).toBeLessThan(1e-9);
      }
    }
  });

  it("circular orbit: E = M exactly", () => {
    expect(eccentricAnomalyFromMean(1.234, 0)).toBeCloseTo(1.234, 12);
  });
});

describe("orbital: elements ↔ state roundtrip", () => {
  // NOTE: perfectly circular orbits (e = 0) are excluded from the full
  // roundtrip — the argument of periapsis ω is degenerate (undefined) when
  // e ≈ 0, so element-wise equality is meaningless there. The circular
  // identity is covered by the dedicated test below.
  const CASES: OrbitalElements[] = [
    { a: 7000, e: 0.02, i: 0.1, raan: 0.5, argP: 0.3, M0: 0.0 },
    { a: 42000, e: 0.35, i: 1.2, raan: 2.4, argP: 5.1, M0: 1.0 },
    { a: 26500, e: 0.72, i: 0.02, raan: 5.9, argP: 2.8, M0: 3.6 },
  ];

  for (let c = 0; c < CASES.length; c++) {
    const el = CASES[c]!;
    it(`case ${c}: elements→state→elements preserves orbit`, () => {
      for (let k = 0; k < 8; k++) {
        const nu = (k / 8) * Math.PI * 2;
        const state = elementsToState(el, nu, MU_EARTH);
        const back = stateToElements(state, MU_EARTH);
        expect(back.a / el.a).toBeCloseTo(1, 6);
        expect(back.e).toBeCloseTo(el.e, 6);
        expect(back.i).toBeCloseTo(el.i, 6);
        // raan/argP angular equality modulo 2π is implied by a,e,i + energy
        // identity checks above; verify positions re-match instead:
        const regenerated = elementsToState(back, nu, MU_EARTH);
        const dx = regenerated.position.x - state.position.x;
        const dy = regenerated.position.y - state.position.y;
        const dz = regenerated.position.z - state.position.z;
        expect(Math.hypot(dx, dy, dz)).toBeLessThan(1e-6 * el.a);
      }
    });
  }

  it("energy is conserved through conversions (vis-viva identity)", () => {
    const el: OrbitalElements = { a: 9000, e: 0.41, i: 0.7, raan: 1.0, argP: 2.0, M0: 0.4 };
    for (let k = 0; k < 6; k++) {
      const nu = k * 1.047;
      const { position, velocity } = elementsToState(el, nu, MU_EARTH);
      const r = Math.hypot(position.x, position.y, position.z);
      const v = Math.hypot(velocity.x, velocity.y, velocity.z);
      const vVisViva = visVivaSpeed(el.a, r, MU_EARTH);
      expect(v).toBeCloseTo(vVisViva, 6);
    }
  });

  it("propagation stays on the same orbit after a full period", () => {
    const el: OrbitalElements = { a: 42164, e: 0.02, i: 0.08, raan: 0.9, argP: 1.7, M0: 2.2 };
    const T = orbitalPeriod(el.a, MU_EARTH);
    const s0 = propagate(el, 0, MU_EARTH);
    const s1 = propagate(el, T, MU_EARTH);
    const d = Math.hypot(s1.position.x - s0.position.x, s1.position.y - s0.position.y, s1.position.z - s0.position.z);
    expect(d).toBeLessThan(1e-6 * el.a);
  });

  it("circular orbit: position stays on a sphere at speed √(μ/r)", () => {
    const el: OrbitalElements = { a: 7000, e: 0.0, i: 0.35, raan: 1.2, argP: 0, M0: 0 };
    for (let k = 0; k < 8; k++) {
      const nu = (k / 8) * Math.PI * 2;
      const { position, velocity } = elementsToState(el, nu, MU_EARTH);
      const r = Math.hypot(position.x, position.y, position.z);
      expect(r).toBeCloseTo(7000, 3);
      const v = Math.hypot(velocity.x, velocity.y, velocity.z);
      expect(v).toBeCloseTo(circularSpeed(7000, MU_EARTH), 6);
    }
  });

  it("rejects invalid eccentricity", () => {
    expect(() => eccentricAnomalyFromMean(1, 1.0)).toThrow(RangeError);
    expect(() => eccentricAnomalyFromMean(1, -0.1)).toThrow(RangeError);
  });
});
