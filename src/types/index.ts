import type { Vector3 } from 'three'

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra'

export type SimulationMode = 'METROPOLITAN' | 'LOW_GRAVITY' | 'ORBITAL' | 'DEEP_SPACE' | 'LAB'

export interface Vector3Like { x: number; y: number; z: number }

export interface SimulationClock {
  elapsedSeconds: number
  deltaSeconds: number
  fixedStepSeconds: number
  frameNumber: number
  simulationRate: number
  timeScale: number
}

export interface VehicleConfig {
  mass: number
  wheelRadius: number
  suspensionRestLength: number
  suspensionStiffness: number
  suspensionDamping: number
  engineForce: number
  brakeForce: number
  steeringLimit: number
  lateralGrip: number
  rollingResistance: number
  aerodynamicDrag: number
}

export interface CityConfig {
  seed: number
  blocksX: number
  blocksZ: number
  blockSize: number
  streetWidth: number
  buildingDensity: number
  maxBuildingHeight: number
  minBuildingHeight: number
}

export interface BuildingInstanceData {
  position: Vector3Like
  scale: Vector3Like
  rotationY: number
  archetype: number
  colorVariation: number
  windowDensity: number
  emissiveIntensity: number
}

export interface DialogueEntry {
  id: string
  speaker: string
  text: string
  duration?: number
  nextId?: string
  metadata?: Record<string, unknown>
}

export interface NPCData {
  id: string
  position: Vector3Like
  interactionRadius: number
  dialogueId: string
  facingYaw: number
  available: boolean
  name: string
  role: string
}

export interface PhysicsRuntime {
  step(deltaSeconds: number): void
  setGravity(gravity: Vector3Like): void
  raycast(origin: Vector3Like, direction: Vector3Like, maxToi: number): { hit: boolean; point?: Vector3Like; normal?: Vector3Like } | null
  reset(): void
}

export interface QualityProfile {
  shadowMapSize: number
  volumetricSamples: number
  postFxResolutionScale: number
  particleDensity: number
  buildingRenderDistance: number
  physicsComplexity: number
  maxAnisotropy: number
}

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  drawCalls: number
  triangles: number
  physicsBodies: number
  physicsStepTime: number
  activeEntities: number
  particleCount: number
  gpuMemory?: number
}

export interface OrbitalElements {
  mu: number // gravitational parameter
  a: number // semi-major axis
  e: number // eccentricity
  i: number // inclination rad
  Omega: number // longitude ascending node rad
  omega: number // argument periapsis rad
  nu: number // true anomaly rad
  M?: number // mean anomaly
  period?: number
}

export interface CartesianState {
  position: Vector3Like
  velocity: Vector3Like
}

export type InputAction =
  | 'MOVE_FORWARD'
  | 'MOVE_BACKWARD'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'BOOST'
  | 'INTERACT'
  | 'ASCEND'
  | 'DESCEND'
  | 'BRAKE'
  | 'JUMP'

export interface InputState {
  actions: Record<InputAction, number>
  pointerDelta: { x: number; y: number }
  pointerLocked: boolean
}
