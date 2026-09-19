import { describe, expect, it } from "vitest";
import {
  ITEMS,
  MAX_STACK,
  SLOT_COUNT,
  addItem,
  removeFirst,
  scatterPickups,
} from "@/lib/simulation/items";

/** Pickup + inventory stack contracts (v1.1 §items). */

describe("addItem/removeFirst", () => {
  it("stacks up to MAX_STACK then spills to the next slot", () => {
    const slots = new Array<null>(SLOT_COUNT).fill(null);
    expect(addItem(slots, "scrap")).toBe(true);
    for (let i = 1; i < MAX_STACK; i++) expect(addItem(slots, "scrap")).toBe(true);
    expect(slots[0]).toEqual({ id: "scrap", count: MAX_STACK });
    expect(addItem(slots, "scrap")).toBe(true); // spills to slot 2
    expect(slots[1]).toEqual({ id: "scrap", count: 1 });
  });

  it("fills all 5 slots then refuses (hotbar full)", () => {
    const slots = new Array<null>(SLOT_COUNT).fill(null);
    for (let i = 0; i < SLOT_COUNT * MAX_STACK; i++) {
      expect(addItem(slots, "med_gel")).toBe(true);
    }
    expect(addItem(slots, "med_gel")).toBe(false);
  });

  it("removeFirst drains the earliest slot first and nulls it", () => {
    const slots = new Array<null>(SLOT_COUNT).fill(null);
    addItem(slots, "repair_cell");
    addItem(slots, "pulse_core");
    expect(removeFirst(slots)).toBe("repair_cell");
    expect(removeFirst(slots)).toBe("pulse_core");
    expect(removeFirst(slots)).toBeNull();
    expect(slots.every((s) => s === null)).toBe(true);
  });
});

describe("scatterPickups", () => {
  it("is deterministic and places the plaza ring near spawn", () => {
    const a = scatterPickups(1337);
    const b = scatterPickups(1337);
    expect(a).toEqual(b);
    const plaza = a.slice(0, 8);
    for (const p of plaza) {
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(14, 6);
    }
    expect(a.length).toBeGreaterThan(12);
  });

  it("uses only known item ids", () => {
    for (const p of scatterPickups(7)) {
      expect(Object.keys(ITEMS)).toContain(p.item);
    }
  });
});
