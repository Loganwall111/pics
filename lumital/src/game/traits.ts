import type { BodyPlan } from "./creatures";

/**
 * LUMITAL evolution (§evolution).
 *
 * DNA is the journey currency (collected as motes, awarded per world).
 * Traits cost DNA on an escalating curve and mutate the body plan live —
 * the renderer reads the same BodyPlan, so evolution is instantly visible.
 * All math pure + unit-pinned.
 */

export type TraitId = "stride" | "vitality" | "glow" | "limbs" | "halo" | "pulse";

export interface TraitDef {
  id: TraitId;
  name: string;
  blurb: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
}

export const TRAITS: readonly TraitDef[] = [
  { id: "stride", name: "Long Stride", blurb: "+18 % move speed per level", baseCost: 20, costGrowth: 1.5, maxLevel: 6 },
  { id: "vitality", name: "Vitality", blurb: "+1 heart of resilience per level", baseCost: 25, costGrowth: 1.6, maxLevel: 5 },
  { id: "glow", name: "Bioluminescence", blurb: "Glow brighter; light follows you", baseCost: 15, costGrowth: 1.35, maxLevel: 8 },
  { id: "limbs", name: "Sprout Limb", blurb: "+1 limb pair per level", baseCost: 40, costGrowth: 1.8, maxLevel: 3 },
  { id: "halo", name: "Halo Ring", blurb: "A signature ring crowns you", baseCost: 60, costGrowth: 1.0, maxLevel: 1 },
  { id: "pulse", name: "Phase Pulse", blurb: "Short blink-dash (Space mid-stride)", baseCost: 50, costGrowth: 1.0, maxLevel: 1 },
];

export type TraitLevels = Partial<Record<TraitId, number>>;

/** Cost of the NEXT level of a trait, or Infinity when maxed. */
export function traitCost(def: TraitDef, currentLevel: number): number {
  if (currentLevel >= def.maxLevel) return Infinity;
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

/** Attempt to buy one level. Returns new state (dna, levels) or null if unaffordable/maxed. */
export function buyTrait(
  dna: number,
  levels: TraitLevels,
  id: TraitId
): { dna: number; levels: TraitLevels } | null {
  const def = TRAITS.find((t) => t.id === id);
  if (!def) return null;
  const level = levels[id] ?? 0;
  const cost = traitCost(def, level);
  if (!Number.isFinite(cost) || dna < cost) return null;
  return { dna: dna - cost, levels: { ...levels, [id]: level + 1 } };
}

/** Speed multiplier from stride level (1 + 0.18·level, capped ×2.2). */
export function speedMultiplier(levels: TraitLevels): number {
  return Math.min(2.2, 1 + 0.18 * (levels.stride ?? 0));
}

/** Emissive boost from base plan glow + bioluminescence level. */
export function glowIntensity(plan: BodyPlan, levels: TraitLevels): number {
  return Math.min(2.4, 0.25 + plan.glow * 0.9 + 0.28 * (levels.glow ?? 0));
}

/** Limb count from plan + sprout levels (pairs). */
export function totalLimbPairs(plan: BodyPlan, levels: TraitLevels): number {
  return Math.min(7, Math.floor(plan.limbCount / 2) + (levels.limbs ?? 0));
}

/** Total DNA spent on a loadout (progress display). */
export function investedDna(levels: TraitLevels): number {
  let sum = 0;
  for (const def of TRAITS) {
    const level = levels[def.id] ?? 0;
    for (let l = 0; l < level; l++) {
      const c = traitCost(def, l);
      if (Number.isFinite(c)) sum += c;
    }
  }
  return sum;
}
