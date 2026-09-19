/**
 * Pure traffic-system parameters (§33 AI traffic).
 *
 * Street geometry follows the city grid: blocks are centred on multiples of
 * `blockSize`, so road centrelines form square loops at half-sizes
 * `(k + ½)·blockSize`. These helpers pin the loop selection, weather/darkness
 * couplings and lane math used by `Traffic.tsx` — kept pure for unit tests.
 */

import { clamp, smoothstep } from "@/lib/math/Scalar";

/** Road-centred square loop half-sizes available to traffic (metres). */
export function streetLoopRadii(blockSize: number, gridRadius: number, maxLoops: number): number[] {
  const radii: number[] = [];
  for (let k = 0; k < gridRadius && radii.length < maxLoops; k++) {
    radii.push((k + 0.5) * blockSize);
  }
  return radii;
}

/**
 * Fractional headlight intensity [0, 1]: on through the night, fading in
 * around dusk (18:00–20:00) and dawn (05:00–07:00); rain forces lights on
 * (visibility + conspicuity).
 */
export function headlightIntensity(timeOfDay: number, rain: number): number {
  const t = ((timeOfDay % 24) + 24) % 24;
  // Darkness rises 18→20, full night until 05, falls 05→07.
  const dusk = smoothstep(18, 20, t);
  const dawn = 1 - smoothstep(5, 7, t);
  const night = Math.max(dusk, dawn);
  return clamp(Math.max(night, rain), 0, 1);
}

/** Traffic slows in rain (wet roads): multiplier in [0.7, 1]. */
export function trafficSpeedFactor(rain: number): number {
  return 1 - 0.3 * clamp(rain, 0, 1);
}
