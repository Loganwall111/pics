/**
 * Deterministic path utilities (shared by pedestrians and tests).
 *
 * `squareLoopPoint` walks a closed square circuit of half-size `r` centred
 * on the origin: parametric arc-length `s` (world metres) → position +
 * tangent. Pure, allocation-free (writes into `out`), test-pinned.
 */

export interface PathPoint {
  x: number;
  z: number;
  /** Unit tangent (direction of travel). */
  tx: number;
  tz: number;
}

/** Total perimeter of the square loop (metres). */
export function squareLoopLength(r: number): number {
  return 8 * r;
}

/**
 * Position on a square circuit at arc-length `s` (wraps automatically).
 * Corners are sharp; pedestrians damp their heading, which rounds them
 * visually without extra math here.
 */
export function squareLoopPoint(r: number, s: number, out: PathPoint): PathPoint {
  if (r <= 0) throw new RangeError(`squareLoopPoint: r must be positive, got ${r}`);
  const perimeter = squareLoopLength(r);
  let t = ((s % perimeter) + perimeter) % perimeter;
  // 4 edges, each of length 2r: right(+x), forward(+z... use +x/+z plane).
  const edge = Math.floor(t / (2 * r));
  const f = t - edge * 2 * r;
  switch (edge) {
    case 0: // along +x at z = -r? Choose: start at (r? ) — edge 0: x from -r to r at z = r
      out.x = -r + f;
      out.z = r;
      out.tx = 1;
      out.tz = 0;
      break;
    case 1: // x = r, z from r to -r
      out.x = r;
      out.z = r - f;
      out.tx = 0;
      out.tz = -1;
      break;
    case 2: // x from r to -r at z = -r
      out.x = r - f;
      out.z = -r;
      out.tx = -1;
      out.tz = 0;
      break;
    default: // x = -r, z from -r to r
      t = t - 3 * 2 * r;
      out.x = -r;
      out.z = -r + f;
      out.tx = 0;
      out.tz = 1;
      break;
  }
  return out;
}
