import { create } from "zustand";
import { SLOT_COUNT, addItem, removeFirst, type ItemId, type Slot } from "@/lib/simulation/items";

/**
 * Inventory store (v1.1 — §items). Five visible hotbar slots; pure stack
 * rules live in `lib/simulation/items` (tested) — this store only mirrors
 * them into React. Session-transient by design (not persisted).
 */

interface InventoryState {
  slots: (Slot | null)[];
  lastPicked: ItemId | null;
  pickup: (id: ItemId) => boolean;
  consumeAny: () => ItemId | null;
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  slots: Array.from({ length: SLOT_COUNT }, () => null),
  lastPicked: null,
  pickup: (id) => {
    const slots = get().slots.map((s) => (s ? { ...s } : null));
    const ok = addItem(slots, id);
    if (ok) set({ slots, lastPicked: id });
    return ok;
  },
  consumeAny: () => {
    const slots = get().slots.map((s) => (s ? { ...s } : null));
    const id = removeFirst(slots);
    if (id) set({ slots });
    return id;
  },
}));
