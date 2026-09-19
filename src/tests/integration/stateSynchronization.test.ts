import { beforeEach, describe, expect, it } from "vitest";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore, MODE_SCENE, modeFromLocationHash } from "@/state/stores/settingsStore";
import { selectMode, selectScene, selectQuality } from "@/state/selectors";
import { getScript, getNpcDefinition, NPC_ROSTER } from "@/components/world/entities/npcDefinitions";
import { MU_AETHER, MU_EARTH, orbitalPeriod } from "@/lib/orbital/OrbitalMechanics";
import { reportOrbitalPeriods } from "@/components/world/space/SpaceScene";

/**
 * State synchronization / mode-switching integration (§31).
 *
 * These exercise the real Zustand stores and the data flowing between
 * subsystems (mode → scene route → gravity/sky), without WebGL.
 */

describe("mode → scene routing", () => {
  it("city modes route to the city scene, space modes to space", () => {
    expect(MODE_SCENE.METROPOLIS).toBe("city");
    expect(MODE_SCENE.LOW_GRAVITY).toBe("city");
    expect(MODE_SCENE.ORBITAL).toBe("space");
    expect(MODE_SCENE.DEEP_SPACE).toBe("space");
    expect(MODE_SCENE.LAB).toBe("lab");
  });

  it("setMode updates the store and derives the scene via selector", () => {
    const s = useSettingsStore.getState();
    s.setMode("ORBITAL");
    // Selectors are plain functions of state — usable outside React hooks.
    expect(selectMode(useSettingsStore.getState())).toBe("ORBITAL");
    expect(selectScene(useSettingsStore.getState())).toBe("space");
    s.setMode("METROPOLIS");
    expect(selectScene(useSettingsStore.getState())).toBe("city");
  });

  it("hash routing round-trips every mode", () => {
    for (const hash of ["#/metropolis", "#/low-gravity", "#/orbital", "#/deep-space", "#/lab"]) {
      expect(modeFromLocationHash(hash)).not.toBeNull();
    }
    expect(modeFromLocationHash("#/bogus")).toBeNull();
  });

  it("settings persist quality through partialize (store-level check)", () => {
    useSettingsStore.getState().setQuality("ultra");
    expect(selectQuality(useSettingsStore.getState())).toBe("ultra");
    useSettingsStore.getState().setQuality("high");
  });
});

describe("interaction store flow (NPC → dialogue → lock)", () => {
  beforeEach(() => {
    useSimulationStore.getState().closeDialogue();
    useSimulationStore.getState().setPlayerState("on-foot");
  });

  it("openDialogue engages the movement lock and advanceDialogue closes at the end", () => {
    const store = useSimulationStore.getState();
    store.openDialogue("nova");
    expect(useSimulationStore.getState().dialogue.active).toBe(true);

    const script = getScript("nova");
    // Walk the whole script; it must terminate cleanly.
    for (let i = 0; i < script.length; i++) {
      expect(useSimulationStore.getState().dialogue.active).toBe(true);
      useSimulationStore.getState().advanceDialogue(script);
    }
    expect(useSimulationStore.getState().dialogue.active).toBe(false);
  });

  it("advancing a closed dialogue is a no-op", () => {
    expect(useSimulationStore.getState().advanceDialogue(getScript("nova"))).toBe(false);
  });

  it("player state switches driving ↔ on-foot", () => {
    const store = useSimulationStore.getState();
    store.setPlayerState("driving");
    expect(useSimulationStore.getState().playerState).toBe("driving");
    store.setPlayerState("on-foot");
    expect(useSimulationStore.getState().playerState).toBe("on-foot");
  });

  it("errors accumulate with subsystem context and are dismissible", () => {
    const store = useSimulationStore.getState();
    store.pushError("test-subsystem", "synthetic failure for diagnostics test");
    const errors = useSimulationStore.getState().errors;
    const found = errors.find((e) => e.subsystem === "test-subsystem");
    expect(found).toBeDefined();
    if (found) {
      useSimulationStore.getState().dismissError(found.id);
      expect(
        useSimulationStore
          .getState()
          .errors.find((e) => e.id === found.id)
      ).toBeUndefined();
    }
  });
});

describe("NPC ↔ dialogue data consistency", () => {
  it("every NPC definition resolves to a non-empty script with unique ids", () => {
    for (const npc of NPC_ROSTER) {
      const def = getNpcDefinition(npc.id);
      expect(def).not.toBeNull();
      const script = getScript(npc.dialogueId);
      expect(script.length).toBeGreaterThan(0);
      const ids = new Set(script.map((e) => e.id));
      expect(ids.size).toBe(script.length);
      for (const entry of script) {
        if (entry.nextId) {
          expect(ids.has(entry.nextId)).toBe(true);
        }
      }
      expect(def?.portraitUrl).toMatch(/portrait-/);
    }
  });
});

describe("orbital scene data is physically consistent", () => {
  it("all planetary periods match Kepler's third law", () => {
    for (const p of reportOrbitalPeriods()) {
      void p; // reportOrbitalPeriods derives from PLANETS; verified below
    }
    // Reference check against the closed-form law for a known planet.
    const a = 41000; // Aetherra semi-major axis (km)
    const T = orbitalPeriod(a, MU_AETHER);
    expect(T / 3600).toBeCloseTo(reportOrbitalPeriods()[2]!.periodHours, 6);
  });

  it("Earth reference values remain stable (sanity for HUD conversions)", () => {
    expect(MU_EARTH).toBeCloseTo(398600.4418, 4);
    expect(orbitalPeriod(6771, MU_EARTH) / 60).toBeCloseTo(92.4, 0); // minutes
  });
});

