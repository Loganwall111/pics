import { Color } from "three";
import type { Vector3Like } from "@/types";
import { SKY_PRESETS } from "@/config/skyPresets.generated";
import { clamp, lerp, saturate, smoothstep } from "@/lib/math/Scalar";

/**
 * Time-of-day atmospheric model (specification §11).
 *
 * Sky colours are interpolated mathematically between palette presets
 * (generated from the committed sky art) — never from hard-coded per-hour
 * texture states. Scattering strengths derive from solar elevation with
 * numerically stable smoothstep curves.
 *
 * Update frequency: once per rendered frame (SimulationLoop).
 * Ownership: SimulationLoop writes into frameState's preallocated outputs.
 */

export interface TimeOfDayOutput {
  sunDirection: Vector3Like;
  sunColor: Color;
  zenithColor: Color;
  horizonColor: Color;
  fogColor: Color;
  nightFactor: number;
  sunIntensity: number;
  rayleighStrength: number;
  mieStrength: number;
  starOpacity: number;
}

interface PresetStop {
  hour: number;
  preset: string;
  /** Forced minimum night factor for this stop (alien skies etc.). */
  nightBias?: number;
}

const DAY_CYCLE: readonly PresetStop[] = [
  { hour: 0, preset: "midnight", nightBias: 1 },
  { hour: 4.6, preset: "twilight", nightBias: 0.85 },
  { hour: 6.3, preset: "sunset" },
  { hour: 8.5, preset: "day" },
  { hour: 15.5, preset: "day" },
  { hour: 18.4, preset: "sunset" },
  { hour: 20.2, preset: "twilight", nightBias: 0.8 },
  { hour: 22.0, preset: "midnight", nightBias: 1 },
  { hour: 24, preset: "midnight", nightBias: 1 },
];

/** Preset colours converted to working (linear) space once at module load. */
interface LinearPreset {
  zenith: Color;
  horizon: Color;
  sun: Color;
}

function toLinear(hex: string): Color {
  return new Color().setStyle(hex); // setStyle converts sRGB → linear working space
}

const LINEAR_PRESETS: Record<string, LinearPreset> = Object.fromEntries(
  Object.entries(SKY_PRESETS).map(([name, p]) => [
    name,
    { zenith: toLinear(p.zenith), horizon: toLinear(p.horizon), sun: toLinear(p.sun) },
  ])
);

// Scratch objects: sampleTimeOfDay is a hot-path function and must not allocate.
const zenithA = new Color();
const zenithB = new Color();
const horizonA = new Color();
const horizonB = new Color();
const sunA = new Color();
const sunB = new Color();
const WARM_SUN = new Color().setStyle("#ff9a3c");
const WHITE_SUN = new Color().setStyle("#fff4d6");

export interface TimeOfDayOptions {
  /** Overrides the normal palette (e.g. turquoise sky in low-gravity mode). */
  forcedPreset?: string;
  /** Scales the computed night factor (low-gravity worlds keep visible stars). */
  nightBias?: number;
}

/**
 * Compute the full atmospheric sample for `hour` (0..24).
 * Writes exclusively into `out` and scratch objects — allocation-free.
 */
export function sampleTimeOfDay(hour: number, out: TimeOfDayOutput, options: TimeOfDayOptions = {}): void {
  const h = clamp(hour, 0, 24);

  // --- Sun direction -------------------------------------------------------
  // Elevation: 0° at 6h/18h, 90° at noon, −90° at midnight.
  const elev = ((h - 6) / 12) * (Math.PI / 2);
  const az = ((h - 12) / 12) * Math.PI; // sweeps south → north across the day
  const cosE = Math.cos(elev);
  const sinE = Math.sin(elev);
  out.sunDirection.x = Math.sin(az) * cosE;
  out.sunDirection.y = sinE;
  out.sunDirection.z = -Math.cos(az) * cosE * 0.9 - 0.18; // tilt off-axis for pleasing shadows
  const len = Math.hypot(out.sunDirection.x, out.sunDirection.y, out.sunDirection.z) || 1;
  out.sunDirection.x /= len;
  out.sunDirection.y /= len;
  out.sunDirection.z /= len;

  // --- Palette interpolation ----------------------------------------------
  const { a, b, t } = findStops(h, options.forcedPreset);
  const pa = LINEAR_PRESETS[a] ?? LINEAR_PRESETS.day!;
  const pb = LINEAR_PRESETS[b] ?? LINEAR_PRESETS.day!;
  zenithA.copy(pa.zenith);
  zenithB.copy(pb.zenith);
  horizonA.copy(pa.horizon);
  horizonB.copy(pb.horizon);
  sunA.copy(pa.sun);
  sunB.copy(pb.sun);
  out.zenithColor.copy(zenithA).lerp(zenithB, t);
  out.horizonColor.copy(horizonA).lerp(horizonB, t);
  out.sunColor.copy(sunA).lerp(sunB, t);

  // --- Night factor and scattering ----------------------------------------
  const elevationFactor = saturate(sinE);
  let night = saturate(smoothstep(0.12, -0.18, sinE));
  if (options.nightBias !== undefined) night = clamp(night * options.nightBias, 0, 1);
  // Near-horizon warm bias: low sun mixes toward amber.
  const horizonness = Math.pow(saturate(1 - Math.abs(sinE)), 3);
  out.sunColor.lerp(WARM_SUN, horizonness * 0.75 * (1 - night));
  out.sunColor.lerp(WHITE_SUN, elevationFactor * 0.35);

  out.nightFactor = night;
  out.sunIntensity = lerp(0.02, 3.2, Math.pow(elevationFactor, 0.8));
  out.rayleighStrength = lerp(0.5, 2.3, elevationFactor) + horizonness * 1.2;
  out.mieStrength = 0.1 + 0.55 * horizonness * (1 - night) + 0.08 * night;

  // Fog takes the mid colour between horizon and zenith; denser at night.
  out.fogColor.copy(out.horizonColor).lerp(out.zenithColor, 0.42);
  out.starOpacity = saturate((night - 0.25) / 0.5);
}

/** Locate surrounding stops; `forcedPreset` pins the palette entirely. */
function findStops(
  hour: number,
  forcedPreset?: string
): { a: string; b: string; t: number } {
  if (forcedPreset && LINEAR_PRESETS[forcedPreset]) {
    return { a: forcedPreset, b: forcedPreset, t: 0 };
  }
  const stops = DAY_CYCLE;
  for (let k = 0; k < stops.length - 1; k++) {
    const s0 = stops[k];
    const s1 = stops[k + 1];
    if (!s0 || !s1) continue;
    if (hour >= s0.hour && hour <= s1.hour) {
      const t = s1.hour === s0.hour ? 0 : (hour - s0.hour) / (s1.hour - s0.hour);
      return { a: s0.preset, b: s1.preset, t };
    }
  }
  return { a: "day", b: "day", t: 0 };
}

/** Gravity presets per simulation mode (m/s²). */
export const MODE_GRAVITY: Record<string, Vector3Like> = {
  METROPOLIS: { x: 0, y: -9.81, z: 0 },
  LOW_GRAVITY: { x: 0, y: -1.62, z: 0 },
  ORBITAL: { x: 0, y: 0, z: 0 },
  DEEP_SPACE: { x: 0, y: 0, z: 0 },
  LAB: { x: 0, y: -9.81, z: 0 },
};
