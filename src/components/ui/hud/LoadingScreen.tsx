import { useEffect, useState } from "react";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { selectBooted, selectCanvasReady, selectRapierReady } from "@/state/selectors";
import splash from "@/assets/art/splash.jpg";

/**
 * Boot experience (§27): key-art splash while the WebGL2 renderer and the
 * Rapier WASM core initialize. The scene renders PROGRESSIVELY behind this
 * overlay (each scene wraps <Physics> in its own Suspense boundary), so the
 * world is already visible the moment the fade begins.
 *
 * Dismissal is fast and user-controllable: it fades 120 ms after boot and
 * any click / key skips it instantly — the intro never traps the player.
 */
export function LoadingScreen(): React.JSX.Element | null {
  const booted = useSimulationStore(selectBooted);
  const canvasReady = useSimulationStore(selectCanvasReady);
  const rapierReady = useSimulationStore(selectRapierReady);
  const [faded, setFaded] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!booted || faded) return;
    const t = window.setTimeout(() => setFaded(true), 120);
    return () => window.clearTimeout(t);
  }, [booted, faded]);

  useEffect(() => {
    if (!faded) return;
    const t = window.setTimeout(() => setGone(true), 650);
    return () => window.clearTimeout(t);
  }, [faded]);

  // Click / any key skips the intro the moment (or after) boot completes.
  useEffect(() => {
    if (gone) return;
    const onSkip = (): void => {
      if (useSimulationStore.getState().booted) setFaded(true);
    };
    window.addEventListener("pointerdown", onSkip);
    window.addEventListener("keydown", onSkip);
    return () => {
      window.removeEventListener("pointerdown", onSkip);
      window.removeEventListener("keydown", onSkip);
    };
  }, [gone]);

  if (gone) return null;

  const status = !canvasReady
    ? "Initializing WebGL2 renderer…"
    : !rapierReady
      ? "Booting physics core (WASM)…"
      : "Entering the simulation…";

  return (
    <div className={`loading-screen ${faded ? "faded" : ""}`} style={{ backgroundImage: `url(${splash})` }}>
      <div className="loading-scrim" />
      <div className="loading-content">
        <h1>AETHER CITY</h1>
        <p className="loading-sub">WebGL2 Reality Simulator · v1.0</p>
        <div className="loading-bar">
          <span className={booted ? "full" : ""} />
        </div>
        <p className="loading-status">{booted ? "CLICK OR PRESS ANY KEY TO ENTER" : status}</p>
      </div>
    </div>
  );
}
