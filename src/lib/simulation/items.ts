import { RngStream } from "@/lib/math/Random";

/**
 * Pickups & inventory (v1.1 — §items).
 *
 * Item catalog, seeded world scatter (plaza, villages, house interiors) and
 * the pure stack rules behind the 5-slot hotbar. All logic pure + tested;
 * the store is a thin wrapper.
 */

export const ITEM_IDS = ["repair_cell", "pulse_core", "strange_seed", "scrap", "med_gel"] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDef {
  id: ItemId;
  name: string;
  color: string;
  /** Thrown-item damage when it lands on someone (fun > realism). */
  throwDamage: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  repair_cell: { id: "repair_cell", name: "Repair Cell", color: "#59d9ff", throwDamage: 4 },
  pulse_core: { id: "pulse_core", name: "Pulse Core", color: "#b07aff", throwDamage: 9 },
  strange_seed: { id: "strange_seed", name: "Strange Seed", color: "#7fff9e", throwDamage: 2 },
  scrap: { id: "scrap", name: "Scrap", color: "#c9b48a", throwDamage: 3 },
  med_gel: { id: "med_gel", name: "Med Gel", color: "#ff7f9e", throwDamage: 1 },
};

export const MAX_STACK = 8;
export const SLOT_COUNT = 5;

export interface Slot {
  id: ItemId;
  count: number;
}

/**
 * Add one item to the slot array (mutates and returns `slots` for chaining
 * simplicity in the store). Returns false when every slot rejects it.
 */
export function addItem(slots: (Slot | null)[], id: ItemId): boolean {
  for (const slot of slots) {
    if (slot && slot.id === id && slot.count < MAX_STACK) {
      slot.count += 1;
      return true;
    }
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) {
      slots[i] = { id, count: 1 };
      return true;
    }
  }
  return false;
}

/** Remove one from the first non-empty slot. Returns its id, or null. */
export function removeFirst(slots: (Slot | null)[]): ItemId | null {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot) {
      const id = slot.id;
      slot.count -= 1;
      if (slot.count <= 0) slots[i] = null;
      return id;
    }
  }
  return null;
}

/** Remove one from a specific slot (the equipped one). Returns id or null. */
export function removeAt(slots: (Slot | null)[], index: number): ItemId | null {
  const slot = slots[index];
  if (!slot) return null;
  const id = slot.id;
  slot.count -= 1;
  if (slot.count <= 0) slots[index] = null;
  return id;
}

export interface PickupSpot {
  x: number;
  z: number;
  y: number;
  item: ItemId;
}

/** Seeded scatter: plaza ring + both village centres + house interiors. */
export function scatterPickups(seed: number): PickupSpot[] {
  const rng = new RngStream(seed ^ 0x1d3a);
  const spots: PickupSpot[] = [];

  // Plaza ring — guaranteed early finds.
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    spots.push({
      x: Math.sin(ang) * 14,
      z: Math.cos(ang) * 14,
      y: 0.9,
      item: ITEM_IDS[i % ITEM_IDS.length] ?? "scrap",
    });
  }
  // Village clusters + one inside a house each.
  const villages = [
    { cx: 0, cz: -420 },
    { cx: 420, cz: 60 },
    { cx: -420, cz: 30 },
  ];
  for (const v of villages) {
    for (let i = 0; i < 4; i++) {
      spots.push({
        x: v.cx + rng.range(-24, 24),
        z: v.cz + rng.range(-24, 24),
        y: 0.9,
        item: ITEM_IDS[Math.floor(rng.float() * ITEM_IDS.length)] ?? "scrap",
      });
    }
    spots.push({ x: v.cx + 26, z: v.cz + 26, y: 0.9, item: "med_gel" });
  }
  return spots;
}
