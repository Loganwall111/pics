/**
 * Seeded deterministic RNG - mulberry32 + hash
 * Ensures same seed produces same city layout
 */
export class SeededRandom {
  private state: number
  constructor(seed: number) {
    this.state = seed >>> 0
  }
  // mulberry32
  next(): number {
    let t = this.state += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1))
  }
  nextBool(p = 0.5): boolean {
    return this.next() < p
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}

export function hashStringToSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
