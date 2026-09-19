import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { playerShared } from "./Player";
import { getHeroVehicleBody } from "@/components/world/vehicles/Vehicle";
import { getPlayerBody } from "./Player";
import { getShipBody } from "@/components/world/space/SpaceScene";
import { clamp, damp } from "@/lib/math/Scalar";
import type { OriginSubject } from "@/engine/simulation/FloatingOrigin";

/**
 * Third-person chase camera (§4, §5).
 *
 * One rig serves all three control contexts (on foot, driving, space flight)
 * with context-dependent distance and height. Yaw/pitch come from pointer
 * drag or right gamepad stick (no pointer lock — UI stays clickable);
 * position uses frame-rate-independent damping. The smoothed camera position
 * registers as a floating-origin subject so deep-space rebasing stays
 * seamless (§9).
 */

/** Subjects shared with the space scene's floating-origin controller. */
export const originSubjects: Set<OriginSubject> = new Set();

export function CameraRig(): null {
  const camera = useThree((s) => s.camera);

  const state = useMemo(
    () => ({
      yaw: Math.PI,
      pitch: 0.24,
      dist: 7.5,
      pos: new Vector3(10, 6, 18),
      target: new Vector3(),
      desired: new Vector3(),
    }),
    []
  );

  const subject = useMemo<OriginSubject>(
    () => ({
      applyOriginOffset(dx, dy, dz) {
        state.pos.x += dx;
        state.pos.y += dy;
        state.pos.z += dz;
      },
    }),
    [state]
  );

  useEffect(() => {
    originSubjects.add(subject);
    return () => {
      originSubjects.delete(subject);
    };
  }, [subject]);

  useFrame((_, delta) => {
    const input = frameState.input;
    const dt = Math.min(delta, 0.1);
    const store = useSimulationStore.getState();

    if (input) {
      state.yaw -= input.lookX;
      state.pitch = clamp(state.pitch + input.lookY, -0.9, 1.25);
      state.dist = clamp(state.dist + input.zoomDelta, 3.5, 22);
    }

    // Target selection by player state.
    let tx = 0;
    let ty = 1.2;
    let tz = 0;
    let dist = 7.5;
    let height = 2.2;
    if (store.playerState === "on-foot") {
      const player = getPlayerBody();
      if (player) {
        const t = player.translation();
        tx = t.x;
        ty = t.y;
        tz = t.z;
      }
    } else if (store.playerState === "driving") {
      const body = getHeroVehicleBody();
      if (body) {
        const t = body.translation();
        tx = t.x;
        ty = t.y;
        tz = t.z;
        dist = 10.5;
        height = 3.0;
      }
    } else if (store.playerState === "flying") {
      const ship = getShipBody();
      if (ship) {
        const t = ship.translation();
        tx = t.x;
        ty = t.y;
        tz = t.z;
        dist = 16;
        height = 3.4;
      }
    }

    // First-person (V / F1): camera at the head, look direction from
    // yaw/pitch; scene visuals hide the character (Player reads the flag).
    if (frameState.firstPerson && store.playerState === "on-foot") {
      camera.position.set(tx, ty + 0.62, tz);
      camera.lookAt(
        tx + Math.sin(state.yaw) * Math.cos(state.pitch),
        ty + 0.62 + Math.sin(state.pitch),
        tz + Math.cos(state.yaw) * Math.cos(state.pitch)
      );
      playerShared.camYaw = state.yaw + Math.PI;
      return;
    }

    state.target.set(tx, ty, tz);

    const horizontal = Math.cos(state.pitch) * dist;
    state.desired.set(
      state.target.x + Math.sin(state.yaw) * horizontal,
      state.target.y + height + Math.sin(state.pitch) * dist,
      state.target.z + Math.cos(state.yaw) * horizontal
    );

    const lambda = store.playerState === "flying" ? 3.2 : 7.5;
    state.pos.x = damp(state.pos.x, state.desired.x, lambda, dt);
    state.pos.y = damp(state.pos.y, state.desired.y, lambda, dt);
    state.pos.z = damp(state.pos.z, state.desired.z, lambda, dt);

    // Never let the chase camera sink through the ground plane (city modes).
    if (store.playerState !== "flying" && state.pos.y < 0.6) state.pos.y = 0.6;

    camera.position.copy(state.pos);
    camera.lookAt(state.target);

    // Share yaw with the on-foot movement basis.
    playerShared.camYaw = state.yaw + Math.PI;
  });

  return null;
}
