import { useEffect } from "react";
import { useAfterPhysicsStep, useBeforePhysicsStep, useRapier } from "@react-three/rapier";
import { physicsRuntime } from "./PhysicsRuntime";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";

/**
 * Binds the active `<Physics>` world to the engine-level `physicsRuntime`
 * facade and measures per-step CPU cost into `frameState.physics`.
 * Mounted exactly once inside each scene's `<Physics>` root; unmount
 * detaches the runtime so a stale world can never be queried (§22).
 */
export function PhysicsBridge({ baseTimeStep }: { baseTimeStep: number }): null {
  const { world, rapier } = useRapier();

  useEffect(() => {
    // Documented isolation cast (§0.10): the facade's BoundWorld is a
    // structural view over the exact installed Rapier types; the cast bridges
    // nominal lib types to the structural facade in ONE auditable place.
    physicsRuntime.attach(
      {
        world: {
          bodies: world.bodies,
          gravity: world.gravity, // live reference — mutations reach Rapier
          // Live accessor properties: writes must reach the real world.
          get timestep() {
            return world.timestep;
          },
          set timestep(v: number) {
            world.timestep = v;
          },
          numSolverIterations: world.numSolverIterations,
          castRayAndGetNormal: world.castRayAndGetNormal.bind(world),
        },
        rapier: rapier,
      } as unknown as Parameters<typeof physicsRuntime.attach>[0],
      baseTimeStep
    );
    // WASM core is live once any Physics root has mounted → boot gate.
    useSimulationStore.getState().setRapierReady(true);
    return () => physicsRuntime.detach();
  }, [world, rapier, baseTimeStep]);

  let stepStart = 0;

  useBeforePhysicsStep(() => {
    stepStart = performance.now();
  });

  useAfterPhysicsStep(() => {
    const ms = performance.now() - stepStart;
    const ema = frameState.physics.stepMs;
    frameState.physics.stepMs = ema === 0 ? ms : ema * 0.9 + ms * 0.1;
    frameState.physics.bodies = world.bodies.len();
  });

  return null;
}
