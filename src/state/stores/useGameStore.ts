/**
 * Zustand State Architecture - Distinguishing persistent, transient, config, diagnostic
 */
import { create } from 'zustand'
import type { QualityLevel, SimulationMode, DialogueEntry, NPCData, PerformanceMetrics } from '@/types'

interface PersistentState {
  quality: QualityLevel
  simulationMode: SimulationMode
  playerName: string
  hasSeenTutorial: boolean
}

interface TransientState {
  playerPosition: { x: number; y: number; z: number }
  playerRotation: number
  isInteracting: boolean
  currentNPC: NPCData | null
  currentDialogue: DialogueEntry | null
  isDialogueOpen: boolean
  isOnVehicle: boolean
  vehicleId: string | null
  timeOfDay: number // 0-1
  sunDirection: { x: number; y: number; z: number }
}

interface ConfigState {
  fov: number
  mouseSensitivity: number
  showDiagnostics: boolean
  enableVolumetrics: boolean
  enableShadows: boolean
}

interface DiagnosticState {
  metrics: PerformanceMetrics
  physicsEnabled: boolean
  lastError: string | null
}

interface GameStore extends PersistentState, TransientState, ConfigState, DiagnosticState {
  // Actions
  setQuality: (q: QualityLevel) => void
  setSimulationMode: (m: SimulationMode) => void
  setPlayerPosition: (p: { x: number; y: number; z: number }) => void
  setPlayerRotation: (r: number) => void
  startInteraction: (npc: NPCData) => void
  endInteraction: () => void
  setDialogue: (d: DialogueEntry | null) => void
  setDialogueOpen: (open: boolean) => void
  setOnVehicle: (on: boolean, id?: string | null) => void
  setTimeOfDay: (t: number) => void
  setSunDirection: (dir: { x: number; y: number; z: number }) => void
  setMetrics: (m: Partial<PerformanceMetrics>) => void
  setConfig: (c: Partial<ConfigState>) => void
  setError: (e: string | null) => void
}

export const useGameStore = create<GameStore>((set) => ({
  // Persistent
  quality: 'high',
  simulationMode: 'METROPOLITAN',
  playerName: 'Zoi',
  hasSeenTutorial: false,

  // Transient
  playerPosition: { x: 0, y: 1, z: 0 },
  playerRotation: 0,
  isInteracting: false,
  currentNPC: null,
  currentDialogue: null,
  isDialogueOpen: false,
  isOnVehicle: false,
  vehicleId: null,
  timeOfDay: 0.35, // morning ~8:43am like reference
  sunDirection: { x: 0.5, y: 0.8, z: 0.3 },

  // Config
  fov: 65,
  mouseSensitivity: 1.0,
  showDiagnostics: true,
  enableVolumetrics: true,
  enableShadows: true,

  // Diagnostic
  metrics: {
    fps: 60,
    frameTime: 16.6,
    drawCalls: 0,
    triangles: 0,
    physicsBodies: 0,
    physicsStepTime: 0,
    activeEntities: 0,
    particleCount: 0
  },
  physicsEnabled: true,
  lastError: null,

  // Actions - narrow selectors to avoid re-renders
  setQuality: (quality) => set({ quality }),
  setSimulationMode: (simulationMode) => set({ simulationMode }),
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setPlayerRotation: (playerRotation) => set({ playerRotation }),
  startInteraction: (npc) => set({ isInteracting: true, currentNPC: npc, isDialogueOpen: true }),
  endInteraction: () => set({ isInteracting: false, currentNPC: null, isDialogueOpen: false, currentDialogue: null }),
  setDialogue: (currentDialogue) => set({ currentDialogue }),
  setDialogueOpen: (isDialogueOpen) => set({ isDialogueOpen }),
  setOnVehicle: (isOnVehicle, vehicleId = null) => set({ isOnVehicle, vehicleId }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setSunDirection: (sunDirection) => set({ sunDirection }),
  setMetrics: (partial) => set((s) => ({ metrics: { ...s.metrics, ...partial } })),
  setConfig: (partial) => set((s) => ({ ...s, ...partial } as GameStore)),
  setError: (lastError) => set({ lastError })
}))

// Selectors - narrow to prevent unnecessary re-renders
export const selectQuality = (s: GameStore) => s.quality
export const selectMetrics = (s: GameStore) => s.metrics
export const selectPlayerPos = (s: GameStore) => s.playerPosition
export const selectIsInteracting = (s: GameStore) => s.isInteracting
export const selectDialogue = (s: GameStore) => s.currentDialogue
export const selectTimeOfDay = (s: GameStore) => s.timeOfDay
