import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { inputManager } from "./InputManager";
import { frameState } from "@/state/transient/frameState";

/**
 * Binds the InputManager to the canvas element once (§19).
 * Mounted early inside the Canvas; the paired InputFinalizer (mounted LAST)
 * clears per-frame edge accumulators after every consumer has read them.
 */
export function InputSystem(): null {
  const domElement = useThree((s) => s.gl.domElement);

  useEffect(() => {
    inputManager.attach(domElement);
    frameState.input = inputManager;
    return () => {
      inputManager.detach();
      frameState.input = null;
    };
  }, [domElement]);

  return null;
}

/** Mounted last in the Canvas: clears pressed-edge + look accumulators. */
export function InputFinalizer(): null {
  useFrame(() => {
    inputManager.endFrame();
  });
  return null;
}
