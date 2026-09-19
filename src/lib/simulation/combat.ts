/**
 * Combat math (v1.1 — §combat).
 *
 * Pure, allocation-free helpers for the three on-foot verbs: PUNCH (cone
 * melee), SHOOT (hitscan cone), THROW (ballistic velocity). The component
 * applies results (panic, damage flavor, audio); this module owns the
 * decisions and is unit-pinned.
 */

export interface Combatant2D {
  id: number;
  x: number;
  z: number;
}

/** Shortest signed yaw difference in (-π, π]. */
function yawDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Nearest combatant inside `range` and within `halfAngle` (radians) of the
 * facing yaw (yaw convention: 0 → +z, like atan2(dx, dz)). Null when none.
 */
export function coneTarget(
  px: number,
  pz: number,
  yaw: number,
  range: number,
  halfAngle: number,
  targets: readonly Combatant2D[]
): Combatant2D | null {
  let best: Combatant2D | null = null;
  let bestD2 = range * range;
  for (const t of targets) {
    const dx = t.x - px;
    const dz = t.z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 > bestD2) continue;
    const facing = Math.atan2(dx, dz);
    if (Math.abs(yawDelta(facing, yaw)) > halfAngle) continue;
    bestD2 = d2;
    best = t;
  }
  return best;
}

/** Ballistic launch velocity for the throw verb (yaw, pitch ≥ 0 up). */
export function throwVelocity(
  yaw: number,
  pitch: number,
  power: number,
  out: { x: number; y: number; z: number }
): void {
  const cos = Math.cos(pitch);
  out.x = Math.sin(yaw) * cos * power;
  out.z = Math.cos(yaw) * cos * power;
  out.y = Math.sin(Math.max(0, Math.min(Math.PI / 2, pitch))) * power;
}

/** Throw arc sanity: range of a projectile launched at 45°. */
export function throwRange(power: number, gravity: number): number {
  return (power * power) / gravity; // v²/g at 45°
}

/** Cooldown gate: true when `now - last >= cooldown`. */
export function offCooldown(last: number, now: number, cooldown: number): boolean {
  return now - last >= cooldown;
}
