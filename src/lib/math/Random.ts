/**
 * Deterministic pseudo-randomness.
 *
 * mulberry32 is a 32-bit state PRNG: tiny, fast, high-quality for graphics
 * work and fully reproducible across platforms (pure integer ops).
 * Every procedural subsystem (city, lab uncertainty, palette extraction)
 * must consume randomness through this module — never Math.random().
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string → seed (used to derive subsystem seeds from a world seed). */
export function hashStringToSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Convenience wrapper with common distributions. */
export class RngStream {
  private readonly next: Rng;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Uniform [0, 1). */
  float(): number {
    return this.next();
  }

  /** Uniform [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n) % Math.max(n, 1);
  }

  /** Box–Muller gaussian, μ=0 σ=1 (deterministic, allocation-free). */
  gaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("RngStream.pick: empty list");
    const idx = this.int(items.length);
    const item = items[idx];
    if (item === undefined) throw new Error("RngStream.pick: index out of range");
    return item;
  }
}
