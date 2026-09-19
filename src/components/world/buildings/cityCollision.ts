import type { Aabb } from "@/lib/math/raycast";

/**
 * World-space building AABBs published by `City.tsx` at build time (§33).
 *
 * The chase camera casts against this plain array each frame — no physics
 * bodies, no per-frame allocation, rebuilt only when the city seed changes.
 * Empty in space/lab modes (camera collision is a city-mode feature).
 */
export const cityCollision: { boxes: Aabb[]; count: number } = { boxes: [], count: 0 };
