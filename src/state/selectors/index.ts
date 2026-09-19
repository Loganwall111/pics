import type { QualityLevel, SimulationMode } from "@/types";
import { MODE_SCENE } from "@/state/stores/settingsStore";

/**
 * Narrow selectors (specification §20).
 * Components must subscribe through these instead of selecting whole stores,
 * so unrelated store writes never re-render simulation-adjacent UI.
 */

export const selectMode = (s: { mode: SimulationMode }): SimulationMode => s.mode;
export const selectQuality = (s: { quality: QualityLevel }): QualityLevel => s.quality;
export const selectScene = (s: { mode: SimulationMode }) => MODE_SCENE[s.mode];
export const selectShowDiagnostics = (s: { showDiagnostics: boolean }): boolean => s.showDiagnostics;
export const selectShowSettings = (s: { showSettings: boolean }): boolean => s.showSettings;
export const selectIsDialogueActive = (s: { dialogue: { active: boolean } }): boolean =>
  s.dialogue.active;
export const selectNearbyNpcId = (s: { nearbyNpcId: string | null }): string | null =>
  s.nearbyNpcId;
export const selectPlayerState = (s: { playerState: string }): string => s.playerState;
export const selectBooted = (s: { booted: boolean }): boolean => s.booted;
export const selectRapierReady = (s: { rapierReady: boolean }): boolean => s.rapierReady;
export const selectCanvasReady = (s: { canvasReady: boolean }): boolean => s.canvasReady;
