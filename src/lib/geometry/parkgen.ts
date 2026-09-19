import { RngStream } from "@/lib/math/Random";

/**
 * City parks & greenbelt generation (v1.2 — §parks).
 *
 * Kills the empty gaps the city used to have:
 *  - STREET TREES at every block-corner sidewalk position inside the grid
 *  - FOUR GREENBELT PARKS in the ring between the city and the villages:
 *    lawn (photo-grass), dense tree clusters, benches, and a small pond
 * Pure + deterministic; positions are unit-tested for separation from the
 * city blocks and village circles.
 */

export const GREENBELT_DIST = 330;

export interface TreeSpot {
  x: number;
  z: number;
  /** 0.8..1.35 height/diameter multiplier. */
  scale: number;
  kind: "round" | "pine";
}

export interface ParkSpec {
  cx: number;
  cz: number;
  lawnRadius: number;
  trees: TreeSpot[];
  benches: { x: number; z: number; rot: number }[];
  pond: { x: number; z: number; r: number } | null;
}

export interface ParkLayout {
  streetTrees: TreeSpot[];
  parks: ParkSpec[];
}

/**
 * Street trees ring every block corner: at (blockCentre ± halfBlock + 2.4)
 * diagonals — the sidewalk corner, outside every building footprint
 * (buildings stay within usable = blockSize − roadWidth of their centre).
 */
export function generateParks(seed: number, blockSize = 46, gridRadius = 5): ParkLayout {
  const rng = new RngStream(seed ^ 0x91a2d);
  const half = blockSize / 2;
  const corner = half + 2.4;

  const streetTrees: TreeSpot[] = [];
  for (let gx = -gridRadius; gx <= gridRadius; gx++) {
    for (let gz = -gridRadius; gz <= gridRadius; gz++) {
      const bx = gx * blockSize;
      const bz = gz * blockSize;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (rng.float() < 0.25) continue; // breathing room
          streetTrees.push({
            x: bx + sx * corner,
            z: bz + sz * corner,
            scale: 0.85 + rng.float() * 0.45,
            kind: rng.chance(0.3) ? "pine" : "round",
          });
        }
      }
    }
  }

  const parks: ParkSpec[] = [];
  const angles = [0.6, 1.9, 3.6, 5.0];
  for (let i = 0; i < angles.length; i++) {
    const ang = angles[i] ?? 0;
    const cx = Math.sin(ang) * GREENBELT_DIST + rng.range(-14, 14);
    const cz = Math.cos(ang) * GREENBELT_DIST + rng.range(-14, 14);
    const lawnRadius = 52 + rng.range(0, 14);

    const trees: TreeSpot[] = [];
    const count = 10 + rng.int(6);
    for (let t = 0; t < count; t++) {
      const a = rng.float() * Math.PI * 2;
      const m = Math.sqrt(rng.float()) * (lawnRadius - 8);
      trees.push({
        x: cx + Math.sin(a) * m,
        z: cz + Math.cos(a) * m,
        scale: 0.9 + rng.float() * 0.5,
        kind: rng.chance(0.4) ? "pine" : "round",
      });
    }

    const benches: { x: number; z: number; rot: number }[] = [];
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2 + rng.range(-0.2, 0.2);
      benches.push({
        x: cx + Math.sin(a) * (lawnRadius * 0.55),
        z: cz + Math.cos(a) * (lawnRadius * 0.55),
        rot: a + Math.PI,
      });
    }

    // One pond per park, offset from centre, clear of trees is not enforced
    // (trees ring the edge; pond sits inward).
    const pond = {
      x: cx + rng.range(-12, 12),
      z: cz + rng.range(-12, 12),
      r: 9 + rng.range(0, 5),
    };

    parks.push({ cx, cz, lawnRadius, trees, benches, pond });
  }

  return { streetTrees, parks };
}
