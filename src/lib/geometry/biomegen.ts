import { RngStream } from "@/lib/math/Random";

/**
 * Beyond-the-city district generation (v1.1 — §biomes).
 *
 * The metropolis occupies ~253 u around the origin; the world continues:
 * two walk-in VILLAGES (house shells you can enter through the door gap,
 * with rapier wall colliders), FARM plots (crop rows, barns, silos,
 * windmill), and a reflective LAKE. Pure + deterministic (seeded), pinned
 * by tests: everything sits beyond the city ring and structures never
 * overlap.
 */

export const CITY_RADIUS = 253;
export const VILLAGE_DIST = 420;
export const FARM_DIST = 600;
export const LAKE_CENTER = { x: -80, z: 640 } as const;
export const LAKE_RADIUS = 64;

export interface HouseSpec {
  x: number;
  z: number;
  /** Footprint (walls sit on the footprint edge). */
  width: number;
  depth: number;
  wallHeight: number;
  /** Door opening width along the front (south) wall, centred. */
  doorWidth: number;
  wallColor: string;
  roofColor: string;
}

export interface VillageSpec {
  cx: number;
  cz: number;
  name: string;
  houses: HouseSpec[];
}

export interface FarmSpec {
  cx: number;
  cz: number;
  /** Field rect (local, before rotation). */
  width: number;
  depth: number;
  rotation: number;
  crop: "wheat" | "pumpkin" | "corn";
  barn: { x: number; z: number };
  silo: { x: number; z: number };
  windmill: boolean;
}

export interface BiomeLayout {
  villages: VillageSpec[];
  farms: FarmSpec[];
}

/** Two villages at the compass N/E, eight farm plots beyond them. */
export function generateBiomes(seed: number): BiomeLayout {
  const rng = new RngStream(seed ^ 0xb10e);

  const villages: VillageSpec[] = [
    makeVillage(rng, 0, -VILLAGE_DIST, "Northgate"),
    makeVillage(rng, VILLAGE_DIST, 60, "Easthollow"),
  ];

  const farms: FarmSpec[] = [];
  const crops: FarmSpec["crop"][] = ["wheat", "pumpkin", "corn"];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const dist = FARM_DIST + rng.range(-60, 80);
    const cx = Math.sin(ang) * dist;
    const cz = Math.cos(ang) * dist;
    if (Math.hypot(cx - LAKE_CENTER.x, cz - LAKE_CENTER.z) < LAKE_RADIUS + 60) continue;
    const crop = crops[i % crops.length] ?? "wheat";
    farms.push({
      cx,
      cz,
      width: 60 + rng.range(0, 30),
      depth: 44 + rng.range(0, 24),
      rotation: rng.range(-0.4, 0.4),
      crop,
      barn: { x: cx + rng.range(-18, 18), z: cz + rng.range(-14, 18) },
      silo: { x: cx + rng.range(-24, 24), z: cz + rng.range(-20, 14) },
      windmill: i % 4 === 0,
    });
  }

  return { villages, farms };
}

function makeVillage(rng: RngStream, cx: number, cz: number, name: string): VillageSpec {
  const houses: HouseSpec[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rng.range(-0.25, 0.25);
    const dist = 26 + rng.range(-6, 10);
    const x = cx + Math.sin(ang) * dist;
    const z = cz + Math.cos(ang) * dist;
    const width = 9 + rng.range(0, 4);
    const depth = 8 + rng.range(0, 3);
    houses.push({
      x,
      z,
      width,
      depth,
      wallHeight: 3.3,
      doorWidth: 1.5,
      wallColor: ["#cfc3ae", "#d8cdb8", "#c2b7a2", "#e0d5c0"][i % 4] ?? "#cfc3ae",
      roofColor: ["#8a4a3a", "#6f4438", "#7d5540"][i % 3] ?? "#8a4a3a",
    });
  }
  return { cx, cz, name, houses };
}

/** AABBs for the chase camera (coarse: one box per house shell). */
export function villageCameraBoxes(villages: readonly VillageSpec[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}[] {
  const boxes: ReturnType<typeof villageCameraBoxes> = [];
  for (const v of villages) {
    for (const h of v.houses) {
      boxes.push({
        minX: h.x - h.width / 2,
        maxX: h.x + h.width / 2,
        minY: 0,
        maxY: h.wallHeight + 1.6,
        minZ: h.z - h.depth / 2,
        maxZ: h.z + h.depth / 2,
      });
    }
  }
  return boxes;
}
