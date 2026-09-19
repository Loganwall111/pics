import { RngStream } from "../../../src/lib/math/Random";

/**
 * LUMITAL creature genesis (§creatures).
 *
 * A deterministic catalog of 108 species: names from seeded syllable
 * tables, a full procedural body plan (limbs, eyes, fins, antennae, glow,
 * pattern), a home biome affinity and a temperament. The same index always
 * yields the same creature — pinned by unit tests. Body plans drive the 3D
 * creature renderer directly (every field has a visual read).
 */

import type { WorldId } from "./worlds";

export const SPECIES_COUNT = 120;

export interface BodyPlan {
  bodyLength: number; // 0.5..1.6
  bodyGirth: number; // 0.35..0.9
  limbCount: number; // 0..6 (pairs derived)
  limbLength: number; // 0.25..0.85
  limbStyle: "leg" | "fin" | "tendril";
  eyeCount: number; // 1..5
  eyeSize: number; // 0.05..0.16
  tail: number; // 0..1 (0 none)
  antennae: boolean;
  dorsalFin: boolean;
  glow: number; // 0..1 emissive
  hue: number; // 0..360
  hueAccent: number;
  pattern: "plain" | "spots" | "stripes" | "rings";
  patternScale: number;
}

export interface Species {
  index: number;
  name: string;
  homeWorld: WorldId;
  temperament: "docile" | "curious" | "skittish" | "bold";
  speed: number; // 2..5.5
  plan: BodyPlan;
}

const SYL_A = [
  "lum", "zy", "quo", "vel", "mi", "tha", "oru", "ka", "sol", "ny",
  "phi", "dra", "elu", "xan", "ori", "vu", "sera", "noo", "kri", "al",
] as const;
const SYL_B = [
  "ti", "ra", "mo", "phel", "dun", "sil", "que", "zar", "vex", "lo",
  "neb", "cir", "mar", "fen", "dol", "shi", "rum", "tal", "vek", "on",
] as const;
const SYL_C = [
  "ian", "ox", "ara", "is", "un", "eth", "or", "ai", "ys", "ump",
  "eel", "orn", "ix", "ul", "ade", "oi", "eam", "yr", "ova", "ex",
] as const;

const TEMPERAMENTS: Species["temperament"][] = ["docile", "curious", "skittish", "bold"];

/** Worlds species can be native to (subset with walkable/habitat sense). */
const HOME_WORLDS: WorldId[] = [
  "void", "microscopic", "ocean", "alienrain", "maze",
];

export function getSpecies(index: number): Species {
  const i = ((index % SPECIES_COUNT) + SPECIES_COUNT) % SPECIES_COUNT;
  const rng = new RngStream((0x1c3a + i * 7919) >>> 0);
  const name = `${pick(rng, SYL_A)}${pick(rng, SYL_B)}${pick(rng, SYL_C)}`;
  const limbCount = Math.floor(rng.float() * 7); // 0..6
  const eyeCount = 1 + Math.floor(rng.float() * 5); // 1..5
  const hue = rng.float() * 360;
  const plan: BodyPlan = {
    bodyLength: 0.5 + rng.float() * 1.1,
    bodyGirth: 0.35 + rng.float() * 0.55,
    limbCount,
    limbLength: 0.25 + rng.float() * 0.6,
    limbStyle: pick(rng, ["leg", "fin", "tendril"] as const),
    eyeCount,
    eyeSize: 0.05 + rng.float() * 0.11,
    tail: rng.float(),
    antennae: rng.chance(0.45),
    dorsalFin: rng.chance(0.4),
    glow: rng.float(),
    hue,
    hueAccent: (hue + 90 + rng.float() * 180) % 360,
    pattern: pick(rng, ["plain", "spots", "stripes", "rings"] as const),
    patternScale: 3 + rng.float() * 9,
  };
  return {
    index: i,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    homeWorld: pick(rng, HOME_WORLDS),
    temperament: pick(rng, TEMPERAMENTS),
    speed: 2 + rng.float() * 3.5,
    plan,
  };
}

/** The full 108-species catalog, materialized once. */
export const SPECIES_CATALOG: readonly Species[] = Array.from(
  { length: SPECIES_COUNT },
  (_, i) => getSpecies(i)
);

function pick<T>(rng: RngStream, items: readonly T[]): T {
  const idx = rng.int(items.length);
  const item = items[idx];
  if (item === undefined) throw new RangeError("species: empty pick pool");
  return item;
}
