/**
 * Uniform-grid spatial hash for proximity queries (specification §17, §21).
 *
 * Static or slowly-moving points are bucketed into cells; radius queries
 * visit only neighbouring cells. This replaces per-frame O(N) distance tests
 * against every NPC / entity.
 * Not thread-safe by design (main-thread simulation only). Rebuild for
 * moving sets; query freely for static sets.
 */
export interface SpatialPoint {
  id: string;
  x: number;
  z: number;
}

export class SpatialHash<T extends SpatialPoint> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();
  private readonly points: T[] = [];

  constructor(cellSize = 8) {
    if (cellSize <= 0) throw new RangeError("cellSize must be positive");
    this.cellSize = cellSize;
  }

  private static key(cx: number, cz: number): number {
    // Interleave into a single numeric key; world coordinates stay well
    // within ±2^15 cells for this project, so the packed key is unique.
    return ((cx + 32768) << 16) ^ (cz + 32768);
  }

  insert(point: T): void {
    this.points.push(point);
    const cx = Math.floor(point.x / this.cellSize);
    const cz = Math.floor(point.z / this.cellSize);
    const key = SpatialHash.key(cx, cz);
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(point);
    else this.cells.set(key, [point]);
  }

  get size(): number {
    return this.points.length;
  }

  /**
   * Collect all points within `radius` (on the XZ plane) of the query point.
   * Results are appended into `out` (allocation-free reuse); returns `out`.
   * The query point itself may optionally be excluded by id.
   */
  queryRadius(x: number, z: number, radius: number, out: T[], excludeId?: string): T[] {
    out.length = 0;
    const r2 = radius * radius;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(SpatialHash.key(cx, cz));
        if (!bucket) continue;
        for (const p of bucket) {
          if (excludeId !== undefined && p.id === excludeId) continue;
          const dx = p.x - x;
          const dz = p.z - z;
          if (dx * dx + dz * dz <= r2) out.push(p);
        }
      }
    }
    return out;
  }
}
