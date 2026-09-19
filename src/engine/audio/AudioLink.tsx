import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { audio } from "./AudioSystem";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * Per-frame audio parameter link (§33): bridges the transient frame state
 * (speed, boost, weather) into the WebAudio voices. Mounted inside the
 * Canvas; the context itself is created on the first user gesture (App).
 */
export function AudioLink(): null {
  const domElement = useThree((s) => s.gl.domElement);

  useEffect(() => {
    // Gesture safety net: any canvas interaction also wakes audio.
    const wake = (): void => {
      audio.resume();
      audio.setMuted(useSettingsStore.getState().muted);
    };
    domElement.addEventListener("pointerdown", wake, { once: false });
    return () => {
      domElement.removeEventListener("pointerdown", wake);
    };
  }, [domElement]);

  useFrame(() => {
    const player = frameState.player;
    const state = useSimulationStore.getState().playerState;
    audio.update({
      speedKmh: player.speedKmh,
      mode: state,
      boost: player.boost,
      wind: frameState.weather.windStrength,
      rain: frameState.weather.rain,
    });
  });

  return null;
}
