import { clamp, lerp, smoothstep } from "@/lib/math/Scalar";

/**
 * Procedural weather (§33 "procedural weather" — now implemented).
 *
 * Deterministic function of simulation time: a seeded value-noise schedule
 * drives cloud cover; rain follows heavy cloud; lightning pulses are sharp
 * deterministic envelopes only while raining. `sampleWeather` is PURE —
 * identical (t, seed) always yields identical weather (§7 determinism), and
 * unit tests pin those contracts.
 *
 * Consumed by SimulationLoop (coupling into sky/sun/fog), RainSystem,
 * CloudLayer, the wet-street shader (via the wetness integrator) and the
 * audio system (rain/wind/thunder levels).
 */

export interface WeatherSample {
  /** 0 = clear, 1 = fully overcast. */
  cloudiness: number;
  /** 0 = dry, 1 = downpour. */
  rain: number;
  /** 0..1 wind intensity (drives rain slant + audio). */
  windStrength: number;
  /** 0..1 lightning flash envelope (non-zero only while raining). */
  lightning: number;
}

/** One full clear→storm→clear cycle (seconds of simulation time). */
const CYCLE_SECONDS = 240;

/** Stable hash → [0,1) from an integer (deterministic across platforms). */
function hash01(n: number): number {
  let h = (n | 0) * 0x27d4eb2d;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Sample the weather at simulation time `t` seconds.
 * @param tSeconds simulation elapsed time (rate-scaled by the caller's clock)
 * @param seed world seed (city seed) — different worlds, different skies
 */
export function sampleWeather(tSeconds: number, seed = 0x51e7): WeatherSample {
  const t = Math.max(0, tSeconds);
  const phase = t / CYCLE_SECONDS;

  // Cloud target per cycle, smoothly interpolated between cycle keys.
  const cycleIdx = Math.floor(phase);
  const f = phase - cycleIdx;
  const keyA = hash01(cycleIdx * 2654435761 + seed);
  const keyB = hash01((cycleIdx + 1) * 2654435761 + seed);
  // Bias toward clearer weather: sqrt pushes targets upward on average.
  const cloudTarget = Math.sqrt(lerp(keyA, keyB, smoothstep(0, 1, f)));
  const cloudiness = clamp(cloudTarget * 1.15, 0, 1);

  // Rain follows heavy cloud with a soft threshold; gusts modulate it.
  const gust = 0.75 + 0.25 * Math.sin(t * 0.23 + seed);
  const rain = smoothstep(0.62, 0.88, cloudiness) * gust;

  const windStrength = clamp(0.15 + cloudiness * 0.65 + 0.1 * Math.sin(t * 0.4), 0, 1);

  // Lightning: sharp deterministic pulses every ~9 s, only in storms.
  let lightning = 0;
  if (rain > 0.45) {
    const strikePeriod = 9;
    const strikeIdx = Math.floor(t / strikePeriod);
    // Some strikes fizzle (per-strike deterministic chance).
    if (hash01(strikeIdx * 97 + seed) < 0.7) {
      const strikeTime = (strikeIdx + 0.2 + 0.5 * hash01(strikeIdx * 13 + seed)) * strikePeriod;
      const dt = t - strikeTime;
      // Double-flicker envelope, exponentially decayed.
      const pulse = Math.exp(-Math.max(0, dt) * 9) + 0.55 * Math.exp(-Math.max(0, dt - 0.16) * 11);
      lightning = clamp(pulse, 0, 1);
    }
  }

  return { cloudiness, rain, windStrength, lightning };
}

/**
 * Wetness integrator: ground soaks while raining and dries slowly after.
 * Deterministic; clamp-bounded; test-pinned (§32 small/large-delta safety:
 * `dt` is expected pre-clamped by the caller's clock).
 */
export function integrateWetness(wetness: number, rain: number, dt: number): number {
  const soak = rain > 0.05 ? rain * 0.22 * dt : 0;
  const dry = rain > 0.05 ? 0 : 0.05 * dt;
  return clamp(wetness + soak - dry, 0, 1);
}
