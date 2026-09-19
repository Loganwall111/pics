import type { Vector3Like } from "@/types";

/**
 * Floating-origin support for deep-space traversal (specification §9).
 *
 * JavaScript numbers are float64 (safe for astronomical sim-space
 * coordinates), but GPU matrices are float32: once render-space coordinates
 * exceed ~2¹³ the camera transform begins to jitter visibly. The controller
 * monitors the reference body (the spacecraft) and, past a threshold,
 * shifts every registered subject by a common offset so nearby geometry and
 * the camera stay numerically small while `totalOffset` preserves the true
 * sim-space position of everything.
 *
 * Coordinate separation (§9):
 *   simulation coordinates : float64, unbounded (positions + origin)
 *   render coordinates     : float32-safe (sim − origin), small by design
 *   camera coordinates     : chase-cam state in render space (rebased too)
 */
export const ORIGIN_REBASE_THRESHOLD = 4096;

export interface OriginSubject {
  /** Apply a render-space shift (dx, dy, dz) to this subject. */
  applyOriginOffset(dx: number, dy: number, dz: number): void;
}

export interface OriginShift {
  dx: number;
  dy: number;
  dz: number;
  totalX: number;
  totalY: number;
  totalZ: number;
}

export function needsRebase(p: Vector3Like, threshold = ORIGIN_REBASE_THRESHOLD): boolean {
  return (
    Math.abs(p.x) > threshold || Math.abs(p.y) > threshold || Math.abs(p.z) > threshold
  );
}

/**
 * Precision probe demonstrating WHY rebasing is required (§32).
 *
 * GPU transforms are float32: `Math.fround` models that rounding exactly.
 * At large magnitudes a small delta is annihilated by the rounding
 * (fround(base + delta) == base), while rebased coordinates preserve it.
 */
export function precisionProbe(base: number, delta: number): { naive: number; rebased: number } {
  const fbase = Math.fround(base);
  const naive = Math.fround(Math.fround(base + delta) - fbase);
  return { naive, rebased: delta };
}

export class FloatingOriginController {
  /** Cumulative shift applied to render space (sim position = render + total). */
  totalX = 0;
  totalY = 0;
  totalZ = 0;

  private readonly subjects = new Set<OriginSubject>();

  register(subject: OriginSubject): void {
    this.subjects.add(subject);
  }

  unregister(subject: OriginSubject): void {
    this.subjects.delete(subject);
  }

  /**
   * Check the reference position and rebase if required.
   * Returns the applied shift, or null when no rebase occurred.
   */
  update(reference: Vector3Like, threshold = ORIGIN_REBASE_THRESHOLD): OriginShift | null {
    if (!needsRebase(reference, threshold)) return null;
    const dx = -reference.x;
    const dy = -reference.y;
    const dz = -reference.z;
    for (const s of this.subjects) {
      s.applyOriginOffset(dx, dy, dz);
    }
    this.totalX += dx;
    this.totalY += dy;
    this.totalZ += dz;
    return { dx, dy, dz, totalX: this.totalX, totalY: this.totalY, totalZ: this.totalZ };
  }

  reset(): void {
    this.totalX = 0;
    this.totalY = 0;
    this.totalZ = 0;
    this.subjects.clear();
  }
}
