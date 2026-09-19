import type { BillboardSpec, BuildingSpec, CityConfig, CityLayout, StreetLightSpec } from "@/types";
import { RngStream } from "@/lib/math/Random";

/**
 * Deterministic procedural city generation (specification §13).
 *
 * Pipeline: archetype selection → per-block instance generation → spatial
 * distribution → material/window parameter derivation. The same (seed,
 * config) pair always produces an identical layout — enforced by unit test.
 * Consuming components convert the layout into InstancedMeshes; generation
 * itself performs zero GPU work and is safe to run on the main thread.
 */

export const DEFAULT_CITY_CONFIG: CityConfig = {
  blockSize: 46,
  roadWidth: 12,
  gridRadius: 5,
  maxHeight: 96,
  plaza: true,
};

const ARCHETYPE_PROFILES: readonly {
  heightMul: number;
  slim: number;
  litBias: number;
}[] = [
  { heightMul: 1.0, slim: 0.72, litBias: 0.1 }, // downtown tower
  { heightMul: 0.55, slim: 0.9, litBias: 0.0 }, // mid block
  { heightMul: 0.3, slim: 1.0, litBias: -0.12 }, // low pod
] as const;

export function generateCity(seed: number, config: CityConfig): CityLayout {
  const rng = new RngStream(seed >>> 0);
  const buildings: BuildingSpec[] = [];
  const billboards: BillboardSpec[] = [];
  const streetLights: StreetLightSpec[] = [];

  const { blockSize, roadWidth, gridRadius, maxHeight, plaza } = config;
  const bounds = blockSize * (gridRadius + 0.5);
  const usable = blockSize - roadWidth;

  for (let gx = -gridRadius; gx <= gridRadius; gx++) {
    for (let gz = -gridRadius; gz <= gridRadius; gz++) {
      const blockCX = gx * blockSize;
      const blockCZ = gz * blockSize;
      const distFromCenter = Math.hypot(blockCX, blockCZ) / (blockSize * gridRadius);

      // Central plaza block stays open (spawn + NPC gathering area).
      if (plaza && gx === 0 && gz === 0) continue;

      // Downtown height falloff with jitter.
      const coreBias = Math.pow(Math.max(0, 1 - distFromCenter), 1.6);
      const perBlock = rng.int(3) + 1; // 1..3 structures per block

      for (let b = 0; b < perBlock; b++) {
        const profileIndex = rng.int(3);
        const profile = ARCHETYPE_PROFILES[profileIndex];
        if (!profile) continue;
        const quadrant = b === 0 ? 0 : rng.int(4);
        const spread = usable * 0.24;
        const offX = b === 0 ? 0 : [spread, -spread, 0, 0][quadrant] ?? 0;
        const offZ = b === 0 ? 0 : [0, 0, spread, -spread][quadrant] ?? 0;

        const width = Math.max(6, usable * profile.slim * rng.range(0.42, 0.62));
        const depth = Math.max(6, usable * profile.slim * rng.range(0.42, 0.62));
        const height = Math.max(
          8,
          maxHeight * profile.heightMul * (0.35 + coreBias * 0.9) * rng.range(0.7, 1.15)
        );

        const windowCols = Math.max(2, Math.round(width / 2.6));
        const windowRows = Math.max(2, Math.round(height / 3.1));
        const litProbability = Math.min(0.92, Math.max(0.08, 0.42 + profile.litBias + rng.range(-0.14, 0.2)));

        const spec: BuildingSpec = {
          x: blockCX + offX + rng.range(-1.5, 1.5),
          z: blockCZ + offZ + rng.range(-1.5, 1.5),
          width,
          depth,
          height,
          archetype: (profileIndex === 0 ? 0 : profileIndex === 1 ? 1 : 2) as 0 | 1 | 2,
          colorSeed: rng.float(),
          windowCols,
          windowRows,
          litProbability,
          billboardFace: -1,
          billboardIndex: -1,
        };

        // Tall towers may carry a billboard on a random facade.
        if (height > maxHeight * 0.55 && rng.chance(0.34)) {
          spec.billboardFace = rng.int(4);
          spec.billboardIndex = rng.int(3);
          const face = spec.billboardFace;
          const halfW = spec.width / 2;
          const halfD = spec.depth / 2;
          const by = height * rng.range(0.55, 0.8);
          const bx = spec.x + (face === 0 ? halfW + 0.3 : face === 1 ? -halfW - 0.3 : 0);
          const bz = spec.z + (face === 2 ? halfD + 0.3 : face === 3 ? -halfD - 0.3 : 0);
          const rotY = face === 0 ? Math.PI / 2 : face === 1 ? -Math.PI / 2 : face === 2 ? 0 : Math.PI;
          billboards.push({
            x: bx,
            y: by,
            z: bz,
            rotY,
            textureIndex: spec.billboardIndex,
            width: Math.min(spec.width * 0.85, 18),
            height: Math.min(spec.height * 0.28, 10),
          });
        }

        buildings.push(spec);
      }

      // Street lights at block corners (on the road edge).
      if (rng.chance(0.8)) {
        streetLights.push({
          x: blockCX + usable / 2 + roadWidth * 0.3,
          z: blockCZ + usable / 2 + roadWidth * 0.3,
        });
      }
    }
  }

  return { seed, config, buildings, billboards, streetLights, bounds };
}
