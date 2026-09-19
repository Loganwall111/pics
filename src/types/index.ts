/**
 * Shared type vocabulary for every subsystem.
 *
 * Ownership: architecture contract (see README).
 * This module must stay dependency-free except for cross-cutting type unions,
 * so it can be imported by engine, state, UI and tests alike.
 */

/** Ground modes render the metropolitan scene; space modes the orbital scene. */
export type SimulationMode =
  | "METROPOLIS"
  | "LOW_GRAVITY"
  | "ORBITAL"
  | "DEEP_SPACE"
  | "LAB";

export type SceneRoute = "city" | "space" | "lab";

export type QualityLevel = "low" | "medium" | "high" | "ultra";

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Data-driven vehicle parameters (specification §8).
 * All forces are expressed in SI-ish simulation units (metres, kilograms).
 */
export interface VehicleConfig {
  mass: number;
  wheelRadius: number;
  suspensionRestLength: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  engineForce: number;
  brakeForce: number;
  steeringLimit: number;
  lateralGrip: number;
  rollingResistance: number;
  aerodynamicDrag: number;
  /** Extra: progressive throttle response shape [0..1]. */
  throttleShape: number;
  /** Extra: speed (km/h) where steering begins to fade. */
  steerFadeStartKmh: number;
  /** Extra: speed (km/h) where steering reaches minimum. */
  steerFadeEndKmh: number;
  /** Extra: fraction of steering retained at high speed. */
  steerFadeFloor: number;
  /** Extra: upward acceleration used by flight mode (m/s²). */
  flightThrust: number;
  /** Extra: boost multiplier applied to engine force. */
  boostMultiplier: number;
}

export interface CityConfig {
  blockSize: number;
  roadWidth: number;
  gridRadius: number;
  maxHeight: number;
  /** Emit an open plaza around the origin instead of buildings. */
  plaza: boolean;
}

export interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  archetype: 0 | 1 | 2;
  colorSeed: number;
  windowCols: number;
  windowRows: number;
  litProbability: number;
  billboardFace: number; // 0..3, -1 = none
  billboardIndex: number; // texture index, -1 = none
}

export interface BillboardSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
  textureIndex: number;
  width: number;
  height: number;
}

export interface StreetLightSpec {
  x: number;
  z: number;
}

export interface CityLayout {
  seed: number;
  config: CityConfig;
  buildings: BuildingSpec[];
  billboards: BillboardSpec[];
  streetLights: StreetLightSpec[];
  bounds: number; // half-extent covered by the layout plane
}

/** One NPC defined in the world (static anchor; visuals animate around it). */
export interface NPCDefinition {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  facing: number; // radians around Y
  accentColor: number;
  portraitUrl: string;
  /** Interaction radius in metres. */
  interactRadius: number;
  /** Dialogue script root entry id. */
  dialogueId: string;
}

export interface DialogueEntry {
  id: string;
  speaker: string;
  text: string;
  duration?: number;
  /** Optional explicit next entry id; defaults to the following array item. */
  nextId?: string;
  metadata?: Record<string, unknown>;
}

export interface LabSettings {
  gravityX: number;
  gravityY: number;
  gravityZ: number;
  massMultiplier: number;
  spawnRate: number;
  maxBodies: number;
  solverIterations: number;
  simSpeed: number;
  uncertainty: boolean;
  seed: number;
}

export interface VehicleControls {
  throttle: number; // -1..1 (1 forward, -1 brake/reverse)
  steer: number; // -1..1
  handbrake: number; // 0..1
  boost: number; // 0..1
  flight: boolean;
  vertical: number; // -1..1 alternate vertical control
  /** One-shot recover request (consumed by the controller). */
  reset: boolean;
}

export interface PhysicsRayHit {
  distance: number;
  normalX: number;
  normalY: number;
  normalZ: number;
}
