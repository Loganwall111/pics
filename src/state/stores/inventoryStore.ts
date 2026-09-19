import { create } from "zustand";
import { SLOT_COUNT, addItem, removeAt, type ItemId, type Slot } from "@/lib/simulation/items";

/**
 * Inventory store (v1.1 — §items). Five visible hotbar slots; pure stack
 * rules live in `lib/simulation/items` (tested) — this store only mirrors
 * them into React. Session-transient by design (not persisted).
 */

interface InventoryState {
  slots: (Slot | null)[];
  lastPicked: ItemId | null;
  /** Equipped hotbar slot (0-4): shoot/throw consume from here. */
  selected: number;
  select: (index: number) => void;
  pickup: (id: ItemId) => boolean;
  consumeSelected: () => ItemId | null;
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  slots: Array.from({ length: SLOT_COUNT }, () => null),
  lastPicked: null,
  selected: 0,
  select: (index) => set({ selected: Math.max(0, Math.min(SLOT_COUNT - 1, Math.trunc(index))) }),
  pickup: (id) => {
    const slots = get().slots.map((s) => (s ? { ...s } : null));
    const ok = addItem(slots, id);
    if (ok) set({ slots, lastPicked: id });
    return ok;
  },
  consumeSelected: () => {
    const state = get();
    const slots = state.slots.map((s) => (s ? { ...s } : null));
    const id = removeAt(slots, state.selected);
    if (id) set({ slots });
    return id;
  },
}));
