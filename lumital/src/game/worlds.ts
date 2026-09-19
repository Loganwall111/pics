/**
 * LUMITAL worlds (§worlds).
 *
 * Six hand-authored biome archetypes, each with a pure analytic terrain
 * function (deterministic, test-pinned), palette and fog parameters. The
 * terrain functions are the physics: the creature controller walks the
 * heightfield they define — no engine physics needed for the journey.
 */

export type WorldId =
  | "void"
  | "maze"
  | "blackhole"
  | "microscopic"
  | "ocean"
  | "alienrain";

export interface WorldDef {
  id: WorldId;
  name: string;
  blurb: string;
  /** Analytic ground height at (x, z). */
  terrainHeight: (x: number, z: number) => number;
  sky: [number, number, number];
  fogColor: [number, number, number];
  fogDensity: number;
  /** Ambient particle budget multiplier for the biome content pass. */
  density: number;
  /** True when the world has no meaningful "down" (free-flight). */
  weightless: boolean;
}

export const WORLDS: Record<WorldId, WorldDef> = {
  void: {
    id: "void",
    name: "Psychedelic Void",
    blurb: "Float through kaleidoscope nebulae and impossible archipelagos.",
    // Rolling glass dunes with interference ripples.
    terrainHeight: (x, z) =>
      Math.sin(x * 0.045) * Math.cos(z * 0.038) * 6 +
      Math.sin((x + z) * 0.012) * 9 +
      Math.sin(x * 0.31 + z * 0.27) * 0.8,
    sky: [0.16, 0.02, 0.28],
    fogColor: [0.25, 0.05, 0.4],
    fogDensity: 0.0038,
    density: 1.4,
    weightless: false,
  },
  maze: {
    id: "maze",
    name: "Fractal Labyrinth",
    blurb: "A Menger maze that repeats forever. Do not trust the corridors.",
    // Flat plateaus carved by deep sinusoid canyon walls (maze-like reads).
    terrainHeight: (x, z) => {
      const wall = Math.min(
        Math.abs(((x * 0.02) % 1) - 0.5),
        Math.abs(((z * 0.02) % 1) - 0.5)
      );
      const canyons = Math.sin(x * 0.11) * Math.sin(z * 0.13);
      return (wall < 0.08 ? -7 : 0) + canyons * 0.7;
    },
    sky: [0.01, 0.03, 0.05],
    fogColor: [0.02, 0.1, 0.12],
    fogDensity: 0.011,
    density: 0.8,
    weightless: false,
  },
  blackhole: {
    id: "blackhole",
    name: "Event Horizon",
    blurb: "Surf the accretion disk of a lensing black hole.",
    // A gentle inward-sloping disk plane — you are on the accretion disk.
    terrainHeight: (x, z) => {
      const r = Math.hypot(x, z);
      return -Math.max(0, (60 - r) * 0.18) + Math.sin(r * 0.25 + x * 0.01) * 0.4;
    },
    sky: [0.0, 0.0, 0.004],
    fogColor: [0.06, 0.01, 0.02],
    fogDensity: 0.0022,
    density: 1.0,
    weightless: false,
  },
  microscopic: {
    id: "microscopic",
    name: "Microscopic",
    blurb: "Drift the cytoplasm. Organelles the size of continents.",
    // Soft membrane-floor undulation, bouncy like a cell.
    terrainHeight: (x, z) =>
      Math.sin(x * 0.09) * Math.cos(z * 0.07) * 2.4 +
      Math.sin(x * 0.021 + z * 0.017) * 3.2,
    sky: [0.05, 0.09, 0.14],
    fogColor: [0.1, 0.2, 0.3],
    fogDensity: 0.02,
    density: 1.8,
    weightless: false,
  },
  ocean: {
    id: "ocean",
    name: "Luminal Ocean",
    blurb: "Bioluminescent shallows over an endless deep.",
    terrainHeight: (x, z) =>
      Math.sin(x * 0.06 + z * 0.04) * 1.6 +
      Math.sin(z * 0.083 - x * 0.021) * 1.1 - 2,
    sky: [0.0, 0.12, 0.2],
    fogColor: [0.0, 0.18, 0.26],
    fogDensity: 0.016,
    density: 1.2,
    weightless: false,
  },
  alienrain: {
    id: "alienrain",
    name: "Alien Rain",
    blurb: "A violet monsoon over phosphorescent flora.",
    terrainHeight: (x, z) =>
      Math.sin(x * 0.033) * Math.cos(z * 0.029) * 5 +
      Math.sin(x * 0.15 + z * 0.11) * 1.4,
    sky: [0.09, 0.03, 0.16],
    fogColor: [0.16, 0.06, 0.26],
    fogDensity: 0.009,
    density: 1.1,
    weightless: false,
  },
};

export const WORLD_ORDER: readonly WorldId[] = [
  "void", "ocean", "microscopic", "alienrain", "maze", "blackhole",
];

/** Deterministic portal cycle: next world in the journey order. */
export function nextWorld(current: WorldId): WorldId {
  const idx = WORLD_ORDER.indexOf(current);
  const next = WORLD_ORDER[(idx + 1) % WORLD_ORDER.length];
  if (next === undefined) throw new RangeError(`unknown world: ${current}`);
  return next;
}
