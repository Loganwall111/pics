import type { RapierRigidBody } from "@react-three/rapier";
import type { Vector3Like } from "@/types";
import type { PhysicsRayHit } from "@/types";

/**
 * Engine-level abstraction over the installed Rapier runtime (§7, §24).
 *
 * All direct Rapier API access used by gameplay systems (vehicle raycasts,
 * gravity/timestep control, solver tuning, body counting) is funnelled
 * through this class so the physics engine remains swappable and the exact
 * API surface is auditable in one file.
 *
 * The instance is bound per active scene by `PhysicsBridge` (one `<Physics>`
 * root per scene); `detach` runs on unmount so a stale world can never be
 * stepped after a route transition (§22).
 */

/** Minimal structural type of the rapier module namespace we rely on. */
export interface RapierModule {
  Ray: new (origin: Vector3Like, dir: Vector3Like) => unknown;
}

export interface BoundWorld {
  world: {
    bodies: { len(): number };
    gravity: { x: number; y: number; z: number };
    timestep: number;
    numSolverIterations?: number;
    castRayAndGetNormal: (
      ray: unknown,
      maxToi: number,
      solid: boolean,
      filterFlags: unknown,
      filterGroups: unknown,
      filterExcludeCollider: unknown,
      filterExcludeRigidBody: unknown
    ) => { timeOfImpact: number; normal: { x: number; y: number; z: number } } | null;
  };
  rapier: RapierModule;
}

export interface VehicleRayResult extends PhysicsRayHit {
  hit: boolean;
}

export class PhysicsRuntime {
  private bound: BoundWorld | null = null;
  private baseTimeStep = 1 / 60;

  // Preallocated ray endpoints — zero allocation per raycast.
  private readonly rayOrigin = { x: 0, y: 0, z: 0 };
  private readonly rayDirection = { x: 0, y: -1, z: 0 };
  private ray: unknown = null;
  private readonly result: VehicleRayResult = { hit: false, distance: 0, normalX: 0, normalY: -1, normalZ: 0 };

  attach(world: BoundWorld, baseTimeStep: number): void {
    this.bound = world;
    this.baseTimeStep = baseTimeStep;
  }

  detach(): void {
    this.bound = null;
    this.ray = null;
  }

  get isBound(): boolean {
    return this.bound !== null;
  }

  get bodyCount(): number {
    return this.bound ? this.bound.world.bodies.len() : 0;
  }

  /** Current world gravity (reads the live Rapier gravity vector). */
  getGravity(out: Vector3Like): Vector3Like {
    if (!this.bound) return out;
    out.x = this.bound.world.gravity.x;
    out.y = this.bound.world.gravity.y;
    out.z = this.bound.world.gravity.z;
    return out;
  }

  setGravity(g: Vector3Like): void {
    if (!this.bound) return;
    this.bound.world.gravity.x = g.x;
    this.bound.world.gravity.y = g.y;
    this.bound.world.gravity.z = g.z;
  }

  /**
   * Simulation-rate scaling: Rapier integrates `timestep` seconds per step,
   * so scaling the timestep scales simulated time without changing stability
   * assumptions for rates ≤ 1 (slow motion integrates smaller steps).
   */
  setSimulationRate(rate: number): void {
    if (!this.bound) return;
    const r = Math.min(2, Math.max(0.05, rate));
    this.bound.world.timestep = this.baseTimeStep * r;
  }

  /** Solver iteration count (higher = stiffer stacks, more CPU). */
  setSolverIterations(iterations: number): void {
    if (!this.bound) return;
    if ("numSolverIterations" in this.bound.world) {
      this.bound.world.numSolverIterations = iterations;
    }
  }

  /**
   * Downward raycast used by the vehicle suspension.
   * `exclude` removes the chassis so the ray never hits its own collider.
   * Result is a shared object — consume it before the next raycast.
   */
  raycastDown(origin: Vector3Like, maxToi: number, exclude: RapierRigidBody): VehicleRayResult {
    const res = this.result;
    res.hit = false;
    const bound = this.bound;
    if (!bound) return res;
    if (this.ray === null) {
      this.ray = new bound.rapier.Ray(this.rayOrigin, this.rayDirection);
    }
    this.rayOrigin.x = origin.x;
    this.rayOrigin.y = origin.y;
    this.rayOrigin.z = origin.z;
    this.rayDirection.x = 0;
    this.rayDirection.y = -1;
    this.rayDirection.z = 0;

    const hit = bound.world.castRayAndGetNormal(this.ray, maxToi, true, undefined, undefined, undefined, exclude);
    if (hit) {
      res.hit = true;
      res.distance = hit.timeOfImpact;
      res.normalX = hit.normal.x;
      res.normalY = hit.normal.y;
      res.normalZ = hit.normal.z;
    }
    return res;
  }
}

/** Application-wide physics facade bound by the active scene's bridge. */
export const physicsRuntime = new PhysicsRuntime();
