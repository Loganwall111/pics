import { describe, expect, it } from "vitest";
import { PORTAL_POS, moteLayout } from "./layout";
import { WORLDS, WORLD_ORDER } from "./worlds";

/** Layout contracts (§worlds) — renderer and probe share one source. */

describe("moteLayout", () => {
  it("is deterministic per world", () => {
    expect(moteLayout("ocean")).toEqual(moteLayout("ocean"));
    expect(moteLayout("ocean")).not.toEqual(moteLayout("void"));
  });

  it("sits above the terrain (reachable)", () => {
    for (const id of WORLD_ORDER) {
      const def = WORLDS[id];
      for (const mote of moteLayout(id)) {
        const [x, y, z] = mote;
        expect(y).toBeGreaterThan(def.terrainHeight(x, z) + 1);
      }
    }
  });

  it("lays out 12 motes within the play field", () => {
    for (const id of WORLD_ORDER) {
      const motes = moteLayout(id);
      expect(motes.length).toBe(12);
      for (const mote of motes) {
        expect(Math.abs(mote[0])).toBeLessThanOrEqual(80);
        expect(Math.abs(mote[2])).toBeLessThanOrEqual(80);
      }
    }
  });

  it("portal sits on the map within the walkable band", () => {
    const [px, pz] = PORTAL_POS;
    expect(Math.abs(px)).toBeLessThan(200);
    expect(Math.abs(pz)).toBeLessThan(200);
  });
});
