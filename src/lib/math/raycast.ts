/**
 * Allocation-free ray casting against axis-aligned bounding boxes (§4/§33).
 *
 * Used by the chase camera to avoid clipping through buildings: the city
 * publishes its footprint AABBs once at build time and the camera casts a
 * single segment per frame. Pure math — no Three.js objects, no allocations.
 */

/** Axis-aligned bounding box (world space, city modes only). */
export interface Aabb {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * Nearest hit distance of segment `origin + t·dir` (t ∈ [0, maxDist]) against
 * `boxes[0..boxCount)`; returns `maxDist` when nothing is hit. `dir` need not
 * be normalized (t scales accordingly). Slab method (Kay–Kajiya); branches
 * written to also handle ray origins inside a box (t = 0).
 */
export function raycastAABBs(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  boxes: readonly Aabb[],
  boxCount: number
): number {
  let nearest = maxDist;
  const invDx = dx !== 0 ? 1 / dx : Infinity;
  const invDy = dy !== 0 ? 1 / dy : Infinity;
  const invDz = dz !== 0 ? 1 / dz : Infinity;
  const signX = invDx < 0 ? -1 : 1;
  const signY = invDy < 0 ? -1 : 1;
  const signZ = invDz < 0 ? -1 : 1;

  for (let i = 0; i < boxCount; i++) {
    const b = boxes[i];
    if (!b) continue;

    let tMin = 0;
    let tMax = nearest;

    // X slab
    const tx1 = (b.minX - ox) * invDx;
    const tx2 = (b.maxX - ox) * invDx;
    const txEnter = signX > 0 ? tx1 : tx2;
    const txExit = signX > 0 ? tx2 : tx1;
    tMin = Math.max(tMin, txEnter);
    tMax = Math.min(tMax, txExit);

    // Y slab
    const ty1 = (b.minY - oy) * invDy;
    const ty2 = (b.maxY - oy) * invDy;
    const tyEnter = signY > 0 ? ty1 : ty2;
    const tyExit = signY > 0 ? ty2 : ty1;
    tMin = Math.max(tMin, tyEnter);
    tMax = Math.min(tMax, tyExit);

    // Z slab
    const tz1 = (b.minZ - oz) * invDz;
    const tz2 = (b.maxZ - oz) * invDz;
    const tzEnter = signZ > 0 ? tz1 : tz2;
    const tzExit = signZ > 0 ? tz2 : tz1;
    tMin = Math.max(tMin, tzEnter);
    tMax = Math.min(tMax, tzExit);

    if (tMin <= tMax && tMin < nearest && tMin >= 0) {
      nearest = tMin;
    }
  }
  return nearest;
}

/** Convenience: build one AABB from a citygen BuildingSpec-like footprint. */
export function aabbFromFootprint(
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  out: Aabb
): Aabb {
  out.minX = x - width / 2;
  out.maxX = x + width / 2;
  out.minY = 0;
  out.maxY = height;
  out.minZ = z - depth / 2;
  out.maxZ = z + depth / 2;
  return out;
}
