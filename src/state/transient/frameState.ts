import { Color, Vector3, WebGLRenderer } from "three";
import { SimulationClock } from "@/engine/timing/SimulationClock";
import type { InputManager } from "@/engine/input/InputManager";

/**
 * Transient per-frame simulation state (specification §5, §20).
 *
 * This is a mutable singleton read/written by engine systems inside the
 * render loop. It is deliberately NOT a React/Zustand store: mutation here
 * never triggers reconciliation. UI panels that need these values poll them
 * at low frequency (4 Hz) or mutate DOM nodes directly.
 */

export interface PhysicsTelemetry {
  bodies: number;
  stepMs: number; // EMA of measured step time
  substeps: number;
}

export interface RenderTelemetry {
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
}

export interface PlayerTelemetry {
  speedKmh: number;
  grounded: boolean;
  /** Vehicle/ship flight system engagement 0..1 (for HUD effects). */
  boost: number;
  inVehicle: boolean;
  dampers: boolean;
}

export interface TransientFrameState {
  /** Central simulation clock — the single authority on time. */
  clock: SimulationClock;
  /** Assigned by InputSystem once the canvas exists. */
  input: InputManager | null;
  /** Assigned once in Canvas onCreated; used for diagnostics + config. */
  renderer: WebGLRenderer | null;

  // Environment (written once per frame by SimulationLoop)
  timeOfDay: number;
  sunDirection: Vector3;
  sunColor: Color;
  zenithColor: Color;
  horizonColor: Color;
  fogColor: Color;
  nightFactor: number;
  sunIntensity: number;
  rayleighStrength: number;
  mieStrength: number;
  starOpacity: number;

  // Diagnostics
  fps: number;
  frameMs: number;

  // Weather (written per frame by SimulationLoop from Weather.ts)
  weather: {
    cloudiness: number;
    rain: number;
    wetness: number;
    windStrength: number;
    lightning: number;
  };

  // Player / vehicle telemetry
  player: PlayerTelemetry;

  // Physics
  physics: PhysicsTelemetry;

  // Render stats (sampled from renderer.info after each present)
  render: RenderTelemetry;
  particleCount: number;

  // Floating origin (space mode): cumulative shift applied to render space
  originOffset: Vector3;

  // Interaction: one-shot command consumed by the dialogue overlay
  dialogueCommand: 0 | 1 | 2; // 0 none, 1 reveal-typewriter, 2 advance/close
  /** Set by DialogueOverlay while the typewriter is mid-reveal. */
  dialogueTyping: boolean;
  /** First-person camera toggle (V / F1). */
  firstPerson: boolean;

  contextLost: boolean;
  /** Set when the boot sequence should reveal the scene. */
  firstFrameRendered: boolean;
}

export const frameState: TransientFrameState = {
  clock: new SimulationClock(),
  input: null,
  renderer: null,

  timeOfDay: 16.4,
  sunDirection: new Vector3(0.5, 0.8, 0.2).normalize(),
  sunColor: new Color(1, 0.95, 0.85),
  zenithColor: new Color(0.25, 0.55, 0.95),
  horizonColor: new Color(0.75, 0.85, 0.95),
  fogColor: new Color(0.65, 0.75, 0.9),
  nightFactor: 0,
  sunIntensity: 3,
  rayleighStrength: 1,
  mieStrength: 0.2,
  starOpacity: 0,

  fps: 60,
  frameMs: 16.7,
  weather: { cloudiness: 0.2, rain: 0, wetness: 0, windStrength: 0.2, lightning: 0 },

  player: { speedKmh: 0, grounded: false, boost: 0, inVehicle: false, dampers: true },

  physics: { bodies: 0, stepMs: 0, substeps: 0 },
  render: { drawCalls: 0, triangles: 0, programs: 0, geometries: 0, textures: 0 },
  particleCount: 0,

  originOffset: new Vector3(0, 0, 0),

  dialogueCommand: 0,
  dialogueTyping: false,
  firstPerson: false,
  contextLost: false,
  firstFrameRendered: false,
};
