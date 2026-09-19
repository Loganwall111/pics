import { describe, expect, it } from "vitest";
import { aabbFromFootprint, raycastAABBs, type Aabb } from "@/lib/math/raycast";

/** Ray-vs-AABB contracts for the chase camera (§33 camera collision). */

const boxes: Aabb[] = [
  // A 10×20×10 building centred at origin.
  aabbFromFootprint(0, 0, 10, 10, 20, { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }),
  // A second building 30 u to +x.
  aabbFromFootprint(30, 0, 10, 10, 8, { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }),
];

describe("raycastAABBs", () => {
  it("misses open space (returns maxDist)", () => {
    // Ray along +z at x=40 — clear of both boxes.
    expect(raycastAABBs(40, 1, -50, 0, 0, 1, 100, boxes, 2)).toBe(100);
  });

  it("hits a square face at the expected distance", () => {
    // From (0,1,-50) toward +z: face z=-5 → t = 45.
    expect(raycastAABBs(0, 1, -50, 0, 0, 1, 100, boxes, 2)).toBeCloseTo(45, 6);
  });

  it("returns the nearest of several hits", () => {
    // Along +x from x=-50 at y=1: first box face x=-5 → 45; second at 25 → 75.
    expect(raycastAABBs(-50, 1, 0, 1, 0, 0, 200, boxes, 2)).toBeCloseTo(45, 6);
  });

  it("ignores boxes behind the ray and caps at maxDist", () => {
    // Looking −x from x=50: the far box spans x∈[25,35], its near face x=35
    // is 15 u away.
    expect(raycastAABBs(50, 1, 0, -1, 0, 0, 200, boxes, 2)).toBeCloseTo(15, 6);
    // Cap below that distance → no hit reported.
    expect(raycastAABBs(50, 1, 0, -1, 0, 0, 10, boxes, 2)).toBe(10);
  });

  it("treats an origin inside a box as an immediate hit (t = 0)", () => {
    expect(raycastAABBs(0, 10, 0, 0, 0, 1, 100, boxes, 1)).toBe(0);
  });

  it("respects maxDist as 'no hit' sentinel", () => {
    expect(raycastAABBs(0, 1, -50, 0, 0, 1, 10, boxes, 2)).toBe(10);
  });

  it("handles axis-aligned diagonal rays via slab intersection", () => {
    // 45° ray into the corner region of box 1 from (-50, 1, -50).
    const t = raycastAABBs(-50, 1, -50, 1, 0, 1, 500, boxes, 1);
    // Enters x=-5 plane at t=45 (z there is -5 → corner graze, valid slab hit).
    expect(t).toBeCloseTo(45, 6);
  });
});

describe("aabbFromFootprint", () => {
  it("centers the box on (x, z) and spans [0, height]", () => {
    const b = aabbFromFootprint(7, -3, 4, 6, 12, { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
    expect(b.minX).toBe(5);
    expect(b.maxX).toBe(9);
    expect(b.minZ).toBe(-6);
    expect(b.maxZ).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(12);
  });
});
