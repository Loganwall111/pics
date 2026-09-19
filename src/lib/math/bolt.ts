/**
 * Deterministic lightning-bolt geometry (§33 weather).
 *
 * Writes a jagged descending polyline (main channel + up to 3 side branches)
 * as line-segment endpoint pairs into a caller-owned buffer — allocation-free
 * at strike time, replay-pinned per seed (unit-tested). Pure math, no Three.
 */

import { RngStream } from "@/lib/math/Random";

/** Hard capacity: 16 main segments + 3 branches × 4 segments = 28 ≤ 40. */
export const BOLT_MAX_SEGMENTS = 40;

/** Segments per branch spur. */
const BRANCH_SEGMENTS = 4;

/**
 * Fill `out` with segment endpoint pairs (x,y,z, x,y,z, …) for a bolt from
 * (`x0`, `yTop`, `z0`) down to ~`yBottom`. `jag` scales horizontal chaos.
 * Returns the number of segments written; throws if `out` is undersized.
 * The main channel drifts with damped jitter, so the bolt lands near the
 * aim column; branches fork at deterministic nodes.
 */
export function writeBolt(
  seed: number,
  x0: number,
  z0: number,
  yTop: number,
  yBottom: number,
  jag: number,
  out: Float32Array
): number {
  if (out.length < BOLT_MAX_SEGMENTS * 6) {
    throw new RangeError(`writeBolt: out must hold ${BOLT_MAX_SEGMENTS} segments`);
  }
  if (yBottom >= yTop) throw new RangeError("writeBolt: yBottom must be below yTop");

  const rng = new RngStream(seed >>> 0);
  const MAIN = 16;
  const dy = (yBottom - yTop) / MAIN;
  // Branch nodes picked deterministically in the upper/mid channel.
  const branchNodes = new Set<number>([
    4 + rng.int(3),
    8 + rng.int(3),
    12 + rng.int(2),
  ]);

  let cursor = 0;
  let driftX = 0;
  let driftZ = 0;
  let px = x0;
  let pz = z0;
  let py = yTop;

  const branch = (bx: number, by: number, bz: number, scale: number): void => {
    let cx = bx;
    let cy = by;
    let cz = bz;
    const dirX = (rng.float() - 0.5) * 2 * jag * scale;
    const dirZ = (rng.float() - 0.5) * 2 * jag * scale;
    for (let j = 0; j < BRANCH_SEGMENTS; j++) {
      const nx = cx + dirX * 0.35 + (rng.float() - 0.5) * jag * 0.5;
      const nz = cz + dirZ * 0.35 + (rng.float() - 0.5) * jag * 0.5;
      const ny = cy + dy * 0.9;
      out[cursor++] = cx;
      out[cursor++] = cy;
      out[cursor++] = cz;
      out[cursor++] = nx;
      out[cursor++] = ny;
      out[cursor++] = nz;
      cx = nx;
      cy = ny;
      cz = nz;
    }
  };

  for (let i = 1; i <= MAIN; i++) {
    const t = i / MAIN;
    // Jitter shrinks toward the ground; damping keeps the channel coherent.
    const amp = jag * (1 - t * 0.55);
    driftX = (driftX + (rng.float() - 0.5) * amp) * 0.82;
    driftZ = (driftZ + (rng.float() - 0.5) * amp) * 0.82;
    const nx = x0 + driftX;
    const nz = z0 + driftZ;
    const ny = yTop + dy * i;

    out[cursor++] = px;
    out[cursor++] = py;
    out[cursor++] = pz;
    out[cursor++] = nx;
    out[cursor++] = ny;
    out[cursor++] = nz;

    if (branchNodes.has(i)) branch(nx, ny, nz, 1);
    px = nx;
    pz = nz;
    py = ny;
  }
  return cursor / 6;
}
