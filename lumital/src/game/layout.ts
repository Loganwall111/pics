import { WORLDS, type WorldId } from "./worlds";

/**
 * Shared world layout (§worlds) — one seeded generator feeds BOTH the
 * renderer (Collectibles) and the gameplay probe (CreatureController), so
 * pickup positions can never desync from what is drawn. Pure + testable.
 */

export const PORTAL_POS: readonly [number, number] = [90, 90];

/** Seeded DNA-mote layout for a world: 12 positions above the terrain. */
export function moteLayout(world: WorldId): [number, number, number][] {
  const def = WORLDS[world];
  let s = (0xc0ffee ^ world.length * 7919) >>> 0;
  const rand = (): number => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: 12 }, () => {
    const x = (rand() - 0.5) * 160;
    const z = (rand() - 0.5) * 160;
    return [x, def.terrainHeight(x, z) + 1.2 + rand() * 2.2, z] as [number, number, number];
  });
}
