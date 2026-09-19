import { create } from "zustand";
import type { DialogueEntry } from "@/types";
import { resolveNextEntryIndex } from "@/lib/simulation/DialogueEngine";

/**
 * Transient-but-UI-relevant simulation state (specification §5, §20).
 *
 * Values here change at low frequency (mode switches, dialogue flow, errors).
 * Anything per-frame lives in `frameState` instead. Dialogue progression is
 * implemented through the pure `DialogueEngine` so it is unit-testable and
 * swappable for a backend/LLM processor later (specification §18).
 */

export interface SimError {
  id: number;
  subsystem: string;
  message: string;
  time: number;
  fatal: boolean;
}

export type PlayerState = "on-foot" | "driving" | "flying";

export interface SimulationState {
  booted: boolean;
  canvasReady: boolean;
  rapierReady: boolean;
  playerState: PlayerState;
  /** NPC currently inside interaction range (null = none). */
  nearbyNpcId: string | null;
  dialogue: {
    active: boolean;
    npcId: string | null;
    entryIndex: number;
  };
  errors: SimError[];

  setBooted: (booted: boolean) => void;
  setCanvasReady: (ready: boolean) => void;
  setRapierReady: (ready: boolean) => void;
  setPlayerState: (state: PlayerState) => void;
  setNearbyNpc: (npcId: string | null) => void;
  openDialogue: (npcId: string) => void;
  /** Advance or close dialogue; returns true when dialogue remains open. */
  advanceDialogue: (script: readonly DialogueEntry[]) => boolean;
  closeDialogue: () => void;
  pushError: (subsystem: string, message: string, fatal?: boolean) => void;
  dismissError: (id: number) => void;
}

let errorCounter = 0;
const MAX_ERRORS = 12;

export const useSimulationStore = create<SimulationState>()((set, get) => ({
  booted: false,
  canvasReady: false,
  rapierReady: false,
  playerState: "on-foot",
  nearbyNpcId: null,
  dialogue: { active: false, npcId: null, entryIndex: 0 },
  errors: [],

  setBooted: (booted) => set({ booted }),
  setCanvasReady: (canvasReady) => {
    set({ canvasReady });
    if (canvasReady && get().rapierReady) set({ booted: true });
  },
  setRapierReady: (rapierReady) => {
    set({ rapierReady });
    if (rapierReady && get().canvasReady) set({ booted: true });
  },
  setPlayerState: (playerState) => set({ playerState }),
  setNearbyNpc: (nearbyNpcId) => {
    if (get().nearbyNpcId !== nearbyNpcId) set({ nearbyNpcId });
  },
  openDialogue: (npcId) =>
    set({ dialogue: { active: true, npcId, entryIndex: 0 } }),
  advanceDialogue: (script) => {
    const { dialogue } = get();
    if (!dialogue.active) return false;
    const nextIndex = resolveNextEntryIndex(script, dialogue.entryIndex);
    if (nextIndex < 0) {
      set({ dialogue: { active: false, npcId: null, entryIndex: 0 } });
      return false;
    }
    set({ dialogue: { ...dialogue, entryIndex: nextIndex } });
    return true;
  },
  closeDialogue: () => set({ dialogue: { active: false, npcId: null, entryIndex: 0 } }),
  pushError: (subsystem, message, fatal = false) => {
    const entry: SimError = {
      id: ++errorCounter,
      subsystem,
      message,
      time: Date.now(),
      fatal,
    };
    const errors = [...get().errors, entry].slice(-MAX_ERRORS);
    set({ errors });
  },
  dismissError: (id) => set({ errors: get().errors.filter((e) => e.id !== id) }),
}));
