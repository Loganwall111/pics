import { WORLDS, type WorldId } from "./worlds";

/**
 * Liquid placement (v0.3 — §liquids).
 *
 * Finds flat, low spots in a world's analytic terrain for glowing flowing
 * ponds. Pure + deterministic (grid scan of the analytic function), so the
 * renderer and the tests share one source of truth.
 */

export interface PondSpot {
  x: number;
  z: number;
  y: number;
  r: number;
}

/** Scan for the flattest spots: |∇h| small relative to neighbours. */
export function findPondSpots(world: WorldId, count = 3): PondSpot[] {
  const def = WORLDS[world];
  const spots: { x: number; z: number; flat: number; h: number }[] = [];
  const step = 18;
  for (let x = -126; x <= 126; x += step) {
    for (let z = -126; z <= 126; z += step) {
      const h = def.terrainHeight(x, z);
      const sx = def.terrainHeight(x + 4, z) - h;
      const sz = def.terrainHeight(x, z + 4) - h;
      const flat = Math.hypot(sx, sz);
      spots.push({ x, z, flat, h });
    }
  }
  spots.sort((a, b) => a.flat - b.flat);

  // Take well-separated flattest spots.
  const chosen: PondSpot[] = [];
  for (const s of spots) {
    if (chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > 60)) {
      chosen.push({ x: s.x, z: s.z, y: s.h + 0.12, r: 7 + Math.abs((s.x * 7 + s.z * 3) % 5) });
    }
    if (chosen.length >= count) break;
  }
  return chosen;
}
