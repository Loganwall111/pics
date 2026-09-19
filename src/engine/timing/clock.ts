/**
 * Central Simulation Clock
 * Explicit separation of render time, simulation time, fixed physics time, global shader time
 */
import type { SimulationClock } from '@/types'

export class SimulationClockManager {
  private _clock: SimulationClock = {
    elapsedSeconds: 0,
    deltaSeconds: 0,
    fixedStepSeconds: 1 / 60,
    frameNumber: 0,
    simulationRate: 1.0,
    timeScale: 1.0
  }

  private _accumulator = 0
  private _lastTime = 0
  private _fixedTime = 0
  private _maxDelta = 0.1 // clamp pathological frames

  get clock(): SimulationClock {
    return this._clock
  }

  get fixedTime(): number {
    return this._fixedTime
  }

  get accumulator(): number {
    return this._accumulator
  }

  constructor(fixedStep = 1 / 60) {
    this._clock.fixedStepSeconds = fixedStep
  }

  /**
   * Update with high-resolution timestamp (from requestAnimationFrame or performance.now)
   */
  update(nowSeconds: number): { shouldFixedStep: boolean; alpha: number } {
    if (this._lastTime === 0) {
      this._lastTime = nowSeconds
      return { shouldFixedStep: false, alpha: 0 }
    }

    let delta = (nowSeconds - this._lastTime) * this._clock.timeScale
    this._lastTime = nowSeconds

    // Clamp to prevent spiral of death
    delta = Math.min(delta, this._maxDelta)

    this._clock.deltaSeconds = delta
    this._clock.elapsedSeconds += delta
    this._clock.frameNumber++

    this._accumulator += delta

    const shouldFixedStep = this._accumulator >= this._clock.fixedStepSeconds
    const alpha = this._accumulator / this._clock.fixedStepSeconds

    return { shouldFixedStep, alpha }
  }

  consumeFixedStep(): void {
    this._accumulator -= this._clock.fixedStepSeconds
    this._fixedTime += this._clock.fixedStepSeconds
    if (this._accumulator < 0) this._accumulator = 0
    // Prevent accumulator overflow after long pause
    if (this._accumulator > 0.2) this._accumulator = 0.2
  }

  setTimeScale(scale: number): void {
    this._clock.timeScale = Math.max(0, Math.min(4, scale))
  }

  setSimulationRate(rate: number): void {
    this._clock.simulationRate = rate
  }

  reset(): void {
    this._clock.elapsedSeconds = 0
    this._clock.deltaSeconds = 0
    this._clock.frameNumber = 0
    this._accumulator = 0
    this._fixedTime = 0
    this._lastTime = 0
  }
}
