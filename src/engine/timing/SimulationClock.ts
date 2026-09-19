import { clamp } from "@/lib/math/Scalar";

/**
 * Central simulation clock (specification §6).
 *
 * Concepts kept explicitly separate:
 *  - `deltaSeconds`      : clamped real frame delta (render time)
 *  - `elapsedSeconds`    : scaled simulation time (rate-affected)
 *  - `fixedElapsedSeconds`: accumulated fixed-step time for deterministic systems
 *  - `shaderTimeSeconds` : unscaled wall time feeding visual-only animations
 *  - fixed-step consumption with a substep cap prevents the "spiral of death"
 *    after a browser stall: the backlog is dropped, never integrated blindly.
 */
export class SimulationClock {
  /** Fixed timestep consumed by deterministic simulation (seconds). */
  fixedStepSeconds = 1 / 60;
  /** Maximum simulated substeps per rendered frame. */
  maxSubsteps = 5;
  /** Pathological frame deltas beyond this are clamped (seconds). */
  maxFrameDeltaSeconds = 0.1;

  elapsedSeconds = 0;
  deltaSeconds = 0;
  fixedElapsedSeconds = 0;
  shaderTimeSeconds = 0;
  frameNumber = 0;
  simulationRate = 1;

  private accumulator = 0;

  /** Advance the clock by one real frame. Call once per rendered frame. */
  update(realDeltaSeconds: number): void {
    const clamped = clamp(realDeltaSeconds, 0, this.maxFrameDeltaSeconds);
    this.deltaSeconds = clamped;
    this.shaderTimeSeconds += clamped;
    const scaled = clamped * this.simulationRate;
    this.elapsedSeconds += scaled;
    this.accumulator += scaled;
    this.frameNumber += 1;
  }

  /**
   * Return the number of fixed steps the simulation should run this frame.
   * If the backlog exceeds `maxSubsteps`, the remainder is discarded so a
   * long stall cannot explode physics integration.
   */
  consumeFixedSteps(): number {
    let steps = 0;
    while (this.accumulator >= this.fixedStepSeconds && steps < this.maxSubsteps) {
      this.accumulator -= this.fixedStepSeconds;
      this.fixedElapsedSeconds += this.fixedStepSeconds;
      steps += 1;
    }
    if (steps === this.maxSubsteps && this.accumulator > this.fixedStepSeconds) {
      this.accumulator = 0; // drop backlog
    }
    return steps;
  }

  /** Scaled time that would elapse over the next fixed step. */
  get fixedDeltaSeconds(): number {
    return this.fixedStepSeconds * this.simulationRate;
  }

  reset(): void {
    this.accumulator = 0;
    this.elapsedSeconds = 0;
    this.fixedElapsedSeconds = 0;
    this.deltaSeconds = 0;
    this.frameNumber = 0;
  }
}
