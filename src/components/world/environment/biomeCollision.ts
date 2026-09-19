import type { Aabb } from "@/lib/math/raycast";

/**
 * District collision AABBs (v1.1 §biomes) — published by `BiomeField` for
 * the chase camera (mirrors `cityCollision`; merged in CameraRig). Empty
 * until the world scene mounts the districts.
 */
export const biomeCollision: { boxes: Aabb[]; count: number } = { boxes: [], count: 0 };
