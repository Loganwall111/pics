/**
 * Simulation Engine Manager - Coordinates all simulation subsystems
 * Implements frame architecture: INPUT -> CLOCK -> TRANSIENT -> PHYSICS -> ORBITAL -> TRANSFORMS -> ANIMATION -> RENDER PREP -> POST -> PRESENT
 */
import { SimulationClockManager } from '@/engine/timing/clock'
import type { SimulationMode } from '@/types'

export class SimulationManager {
  public clock: SimulationClockManager
  public mode: SimulationMode = 'METROPOLITAN'
  private isPaused = false

  constructor() {
    this.clock = new SimulationClockManager(1 / 60)
  }

  setMode(mode: SimulationMode): void {
    console.log(`[Simulation] Mode transition: ${this.mode} -> ${mode}`)
    this.mode = mode
    // Handle coordinate space transitions
    switch (mode) {
      case 'METROPOLITAN':
        // Standard gravity, render coordinates = simulation coordinates
        break
      case 'LOW_GRAVITY':
        // Reduced gravity, floating origin starts
        break
      case 'ORBITAL':
        // Switch to orbital reference frame
        break
      case 'DEEP_SPACE':
        // Floating-origin high-precision
        break
      case 'LAB':
        // Isolated physics lab
        break
    }
  }

  pause(): void { this.isPaused = true }
  resume(): void { this.isPaused = false }

  update(now: number): { shouldPhysicsStep: boolean; alpha: number } {
    if (this.isPaused) return { shouldPhysicsStep: false, alpha: 0 }
    const result = this.clock.update(now / 1000)
    return { shouldPhysicsStep: result.shouldFixedStep, alpha: result.alpha }
  }

  consumePhysicsStep(): void {
    this.clock.consumeFixedStep()
  }
}

export const globalSimulationManager = new SimulationManager()
