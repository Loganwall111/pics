import { useEffect, useRef, useState } from "react";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectNearbyNpcId, selectPlayerState } from "@/state/selectors";
import { getNpcDefinition } from "@/components/world/entities/npcDefinitions";
import { frameState } from "@/state/transient/frameState";
import { ArDock } from "./ArDock";
import { ArStatsPanel } from "@/components/ui/diagnostics/DiagnosticsOverlay";
import { ArModesPanel, ArSystemsPanel } from "./ArPanels";
import { SettingsPanel } from "@/components/ui/controls/SettingsPanel";

/**
 * HUD (asset directive §2): no rigid corner boxes.
 *
 * Layout = floating translucent elements only:
 *   lower-left  — circular AR dock + glass panels (stats/modes/systems/config)
 *   lower-right — minimal speed pill (DOM-direct, zero re-renders)
 *   upper-right — time pill
 *   bottom-centre — contextual hint chip, auto-fades after 7 s
 */
export function HUD(): React.JSX.Element {
  const playerState = useSimulationStore(selectPlayerState);
  const nearbyNpcId = useSimulationStore(selectNearbyNpcId);
  const arPanel = useSettingsStore((s) => s.arPanel);
  const speedRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const originRef = useRef<HTMLSpanElement>(null);
  const [hintVisible, setHintVisible] = useState(true);

  const nearbyNpc = nearbyNpcId ? getNpcDefinition(nearbyNpcId) : null;

  // Hint chip re-appears on context change, fades after 7 s.
  useEffect(() => {
    setHintVisible(true);
    const t = window.setTimeout(() => setHintVisible(false), 7000);
    return () => window.clearTimeout(t);
  }, [playerState, nearbyNpcId]);

  // High-frequency values write straight to DOM nodes (§5, §20).
  useEffect(() => {
    const mode = useSettingsStore.getState().mode;
    const space = mode === "ORBITAL" || mode === "DEEP_SPACE";
    const id = window.setInterval(() => {
      if (speedRef.current) {
        const kmh = frameState.player.speedKmh;
        speedRef.current.textContent = space ? `${(kmh / 3600).toFixed(1)} km/s` : `${Math.round(kmh)} km/h`;
      }
      if (clockRef.current) {
        const h = Math.floor(frameState.timeOfDay);
        const m = Math.floor((frameState.timeOfDay - h) * 60);
        clockRef.current.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
      if (originRef.current) {
        const o = frameState.originOffset;
        const mag = Math.hypot(o.x, o.y, o.z);
        originRef.current.textContent = mag > 1 ? `origin ±${(mag / 1000).toFixed(1)}k u` : "";
      }
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  const hint = hintFor(playerState, nearbyNpc?.name ?? null);

  return (
    <div className={`hud ${playerState === "flying" ? "space" : ""}`}>
      {/* Floating time pill */}
      <div className="hud-pill hud-clock-pill">
        <span ref={clockRef}>16:24</span>
        <span ref={originRef} className="hud-origin" />
      </div>

      {/* Minimal speed pill */}
      <div className="hud-pill hud-speed-pill">
        <span ref={speedRef}>0 km/h</span>
        <span className="hud-speed-label">{playerState === "driving" ? "GROUND" : playerState === "flying" ? "FLIGHT" : "ON FOOT"}</span>
      </div>

      {/* Contextual hint */}
      {hintVisible && <div className="hud-hint">{hint}</div>}

      <ArDock />
      {arPanel === "stats" && <ArStatsPanel />}
      {arPanel === "modes" && <ArModesPanel />}
      {arPanel === "systems" && <ArSystemsPanel />}
      <SettingsPanel />
    </div>
  );
}

function hintFor(playerState: string, npcName: string | null): string {
  if (playerState === "flying") {
    return "W/S thrust · drag aim · R/F up-down · T dampers · X warp · 1 return";
  }
  if (playerState === "driving") {
    return "WASD drive · Shift boost · Space handbrake · F flight · E exit · R recover · V first-person";
  }
  if (npcName) return `E — talk to ${npcName}`;
  return "WASD move · Shift sprint · Space jump · E interact · V first-person · 1–5 modes";
}
