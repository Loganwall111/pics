/**
 * Shared wet-street uniform (§23 centralised ownership).
 *
 * Owned by the weather integrator (SimulationLoop writes `value` per frame);
 * the ground material binds (never copies) this object in onBeforeCompile.
 */
export const GROUND_WET_UNIFORMS = {
  u_wetness: { value: 0 },
};
