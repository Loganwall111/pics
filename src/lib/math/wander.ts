/**
 * Shared deterministic wander behaviour (§33 ambient AI).
 *
 * One implementation backs dogs, dialogue NPCs and any future ambient life:
 * each agent orbits between random waypoints inside a home-radius disc, with
 * timed idle pauses. Determinism: a `Wanderer` is a pure function of its seed
 * and the step sequence — replaying the same (seed, dt list) reproduces the
 * identical path (unit-pinned). Mutates state in place; zero allocations.
 */

import { RngStream } from "@/lib/math/Random";

export interface Wanderer {
  x: number;
  z: number;
  yaw: number;
  /** Home anchor the agent wanders around. */
  homeX: number;
  homeZ: number;
  targetX: number;
  targetZ: number;
  speed: number;
  /** Simulation-clock seconds until the current pause ends. */
  pauseUntil: number;
  phase: number;
}

/**
 * Create a wanderer around (`homeX`, `homeZ`). `seed` should be unique per
 * agent (callers typically mix an index into the city seed).
 */
export function createWanderer(
  seed: number,
  homeX: number,
  homeZ: number,
  radius: number,
  speedMin: number,
  speedMax: number
): Wanderer {
  const rng = new RngStream(seed >>> 0);
  return {
    x: homeX + (rng.float() - 0.5) * radius,
    z: homeZ + (rng.float() - 0.5) * radius,
    yaw: rng.float() * Math.PI * 2,
    homeX,
    homeZ,
    targetX: homeX + (rng.float() - 0.5) * radius,
    targetZ: homeZ + (rng.float() - 0.5) * radius,
    speed: speedMin + rng.float() * (speedMax - speedMin),
    pauseUntil: 0,
    phase: rng.float() * Math.PI * 2,
  };
}

/**
 * Advance one step. Returns the current speed actually applied (0 while
 * paused) so callers can drive gait animation from it. Pauses are scheduled
 * with ~18 % probability on waypoint arrival and last 1–3 s.
 */
export function stepWander(
  w: Wanderer,
  dt: number,
  nowSeconds: number,
  radius: number,
  rngJitter: RngStream
): number {
  if (nowSeconds < w.pauseUntil) return 0;

  const dx = w.targetX - w.x;
  const dz = w.targetZ - w.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 0.35) {
    // Pick a new waypoint inside the home disc; sometimes idle first.
    if (rngJitter.float() < 0.18) {
      w.pauseUntil = nowSeconds + 1 + rngJitter.float() * 2;
      return 0;
    }
    const ang = rngJitter.float() * Math.PI * 2;
    const mag = Math.sqrt(rngJitter.float()) * radius;
    w.targetX = w.homeX + Math.cos(ang) * mag;
    w.targetZ = w.homeZ + Math.sin(ang) * mag;
    return 0;
  }

  const targetYaw = Math.atan2(dx, dz);
  // Shortest-arc turn, frame-rate independent (λ ≈ 6).
  let dyaw = targetYaw - w.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  w.yaw += dyaw * Math.min(1, 6 * dt);

  const step = w.speed * dt;
  if (step >= dist) {
    w.x = w.targetX;
    w.z = w.targetZ;
  } else {
    w.x += (dx / dist) * step;
    w.z += (dz / dist) * step;
  }
  w.phase += step * 2.6;
  return w.speed;
}
