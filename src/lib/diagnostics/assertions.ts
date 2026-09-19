import type { Vector3Like } from "@/types";

/**
 * Runtime assertions for catastrophic invalid states (specification §32).
 * These throw deliberately: a non-finite position or NaN gravity must fail
 * loudly in development instead of silently corrupting the simulation.
 */

export class SimulationAssertionError extends Error {
  constructor(
    message: string,
    public readonly subsystem: string
  ) {
    super(`[${subsystem}] ${message}`);
    this.name = "SimulationAssertionError";
  }
}

export function assertFiniteNumber(name: string, value: number, subsystem = "runtime"): number {
  if (!Number.isFinite(value)) {
    throw new SimulationAssertionError(`Non-finite scalar detected: ${name} = ${value}`, subsystem);
  }
  return value;
}

export function assertFiniteVector3(
  name: string,
  v: { x: number; y: number; z: number },
  subsystem = "runtime"
): Vector3Like {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
    throw new SimulationAssertionError(
      `Non-finite vector detected: ${name} = (${v.x}, ${v.y}, ${v.z})`,
      subsystem
    );
  }
  return v;
}

export function assertDefined<T>(name: string, value: T | null | undefined, subsystem = "runtime"): T {
  if (value === null || value === undefined) {
    throw new SimulationAssertionError(`Missing required value: ${name}`, subsystem);
  }
  return value;
}

export function assert(condition: boolean, message: string, subsystem = "runtime"): void {
  if (!condition) {
    throw new SimulationAssertionError(message, subsystem);
  }
}
