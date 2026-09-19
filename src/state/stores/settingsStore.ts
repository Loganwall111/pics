import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LabSettings, QualityLevel, SimulationMode, SceneRoute } from "@/types";

/**
 * Persistent / configuration state (specification §20).
 *
 * This store holds values that change at human frequency (settings, mode).
 * Hot-path simulation values intentionally live in `state/transient/frameState`
 * and never enter React reconciliation.
 *
 * The active mode is mirrored into the URL hash so scene routes survive
 * reloads and remain linkable — a minimal, dependency-free router.
 */

export const MODE_SCENE: Record<SimulationMode, SceneRoute> = {
  METROPOLIS: "city",
  LOW_GRAVITY: "city",
  ORBITAL: "space",
  DEEP_SPACE: "space",
  LAB: "lab",
};

export const MODE_TO_HASH: Record<SimulationMode, string> = {
  METROPOLIS: "#/metropolis",
  LOW_GRAVITY: "#/low-gravity",
  ORBITAL: "#/orbital",
  DEEP_SPACE: "#/deep-space",
  LAB: "#/lab",
};

const HASH_TO_MODE: Record<string, SimulationMode> = {
  "#/metropolis": "METROPOLIS",
  "#/low-gravity": "LOW_GRAVITY",
  "#/orbital": "ORBITAL",
  "#/deep-space": "DEEP_SPACE",
  "#/lab": "LAB",
};

export function modeFromLocationHash(hash: string): SimulationMode | null {
  return HASH_TO_MODE[hash] ?? null;
}

export type ArPanel = "none" | "stats" | "modes" | "systems" | "config";

export interface SettingsState {
  mode: SimulationMode;
  /** AAA-style main menu: open at boot; the canvas runs a cinematic orbit behind it. */
  menuOpen: boolean;
  /** Floating AR dock: which glass panel is open (null-closed). */
  arPanel: ArPanel;
  /** Dock orb currently hovered (drives the readout above the buttons). */
  arPanelHover: ArPanel | "firstPerson" | null;
  /** Master audio mute (persisted). */
  muted: boolean;
  /** Last on-foot position (persisted; restored as the spawn point). */
  home: { x: number; z: number };
  quality: QualityLevel;
  citySeed: number;
  timeOfDay: number; // 0..24, also written by the clock (slider = authoritative seed)
  timeFrozen: boolean;
  /** Simulation hours advanced per real second when not frozen. */
  timeScaleHoursPerSecond: number;
  /** Global simulation rate applied to game logic and physics stepping. */
  simulationRate: number;
  showDiagnostics: boolean;
  showSettings: boolean;
  lab: LabSettings;

  setArPanel: (panel: ArPanel) => void;
  setArPanelHover: (panel: ArPanel | "firstPerson" | null) => void;
  setMenuOpen: (menuOpen: boolean) => void;
  setMuted: () => void;
  setHome: (x: number, z: number) => void;
  toggleStatsPanel: () => void;
  toggleConfigPanel: () => void;
  setMode: (mode: SimulationMode) => void;
  setQuality: (q: QualityLevel) => void;
  setCitySeed: (seed: number) => void;
  setTimeOfDay: (t: number) => void;
  setTimeFrozen: (frozen: boolean) => void;
  setTimeScale: (scale: number) => void;
  setSimulationRate: (rate: number) => void;
  toggleDiagnostics: () => void;
  toggleSettings: () => void;
  setLab: (partial: Partial<LabSettings>) => void;
}

const DEFAULT_LAB: LabSettings = {
  gravityX: 0,
  gravityY: -9.81,
  gravityZ: 0,
  massMultiplier: 1,
  spawnRate: 8,
  maxBodies: 180,
  solverIterations: 4,
  simSpeed: 1,
  uncertainty: true,
  seed: 1337,
};

function initialMode(): SimulationMode {
  if (typeof window !== "undefined") {
    const fromHash = modeFromLocationHash(window.location.hash);
    if (fromHash) return fromHash;
  }
  return "METROPOLIS";
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      mode: initialMode(),
      menuOpen: true,
      arPanel: "none",
      arPanelHover: null,
      muted: false,
      home: { x: 0, z: 0 },
      quality: "high",
      citySeed: 1337,
      timeOfDay: 16.4,
      timeFrozen: false,
      timeScaleHoursPerSecond: 0.25,
      simulationRate: 1,
      showDiagnostics: true,
      showSettings: false,
      lab: DEFAULT_LAB,

      setMode: (mode) => {
        set({ mode, showSettings: false, arPanel: "none" });
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", MODE_TO_HASH[mode]);
        }
      },
      setArPanel: (arPanel) => set({ arPanel }),
      toggleStatsPanel: () => {
        const stats = get().arPanel === "stats";
        set({ arPanel: stats ? "none" : "stats", showDiagnostics: !stats });
      },
      toggleConfigPanel: () => {
        const open = get().arPanel === "config";
        set({ arPanel: open ? "none" : "config", showSettings: !open });
      },
      setArPanelHover: (hover) => set({ arPanelHover: hover }),
      setMenuOpen: (menuOpen) => set({ menuOpen }),
      setMuted: () => set({ muted: !get().muted }),
      setHome: (x, z) => set({ home: { x, z } }),
      setQuality: (quality) => set({ quality }),
      setCitySeed: (citySeed) => set({ citySeed: Math.trunc(citySeed) >>> 0 }),
      setTimeOfDay: (timeOfDay) => set({ timeOfDay: ((timeOfDay % 24) + 24) % 24 }),
      setTimeFrozen: (timeFrozen) => set({ timeFrozen }),
      setTimeScale: (timeScaleHoursPerSecond) => set({ timeScaleHoursPerSecond }),
      setSimulationRate: (simulationRate) =>
        set({ simulationRate: Math.min(2, Math.max(0.1, simulationRate)) }),
      toggleDiagnostics: () => {
        const stats = get().arPanel === "stats";
        set({ arPanel: stats ? "none" : "stats", showDiagnostics: !stats });
      },
      toggleSettings: () => {
        const open = get().arPanel === "config";
        set({ arPanel: open ? "none" : "config", showSettings: !open });
      },
      setLab: (partial) => set({ lab: { ...get().lab, ...partial } }),
    }),
    {
      name: "aether-city-settings",
      version: 1,
      // Only durable preferences are persisted; volatile UI flags are not.
      partialize: (s) => ({
        quality: s.quality,
        citySeed: s.citySeed,
        mode: s.mode,
        showDiagnostics: s.showDiagnostics,
        lab: s.lab,
        muted: s.muted,
        home: s.home,
        timeOfDay: s.timeOfDay,
      }),
    }
  )
);
