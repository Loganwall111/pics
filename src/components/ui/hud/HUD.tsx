import { useEffect, useRef, useState } from "react";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { useInventoryStore } from "@/state/stores/inventoryStore";
import { ITEMS } from "@/lib/simulation/items";
import { useQuestStore } from "@/state/stores/questStore";
import { objectiveLine } from "@/lib/simulation/story";
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
  const questIndex = useQuestStore((s) => s.questIndex);
  const questProgress = useQuestStore((s) => s.progress);
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

      {/* Story objective pill (v1.2) */}
      <QuestPill questIndex={questIndex} progress={questProgress} />

      {/* Contextual hint */}
      {hintVisible && <div className="hud-hint">{hint}</div>}

      {playerState === "on-foot" && <Hotbar />}
      {playerState === "on-foot" && <div className="crosshair" />}

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
  return "WASD move · E interact/pickup · Q punch · F shoot · T throw · V first-person";
}


/** 5-slot hotbar (v1.1 §items): mirrors the inventory store, low-frequency. */
function Hotbar(): React.JSX.Element {
  const slots = useInventoryStore((s) => s.slots);
  const selected = useInventoryStore((s) => s.selected);
  const select = useInventoryStore((s) => s.select);
  return (
    <div className="hotbar">
      {slots.map((slot, i) => (
        <div
          key={i}
          className={`hotbar-slot ${i === selected ? "active" : ""}`}
          onClick={() => select(i)}
          title="1–5 equip · F shoot · T throw"
        >
          {slot ? (
            <>
              <span className="hotbar-count">{slot.count}</span>
              <span>{ITEMS[slot.id]?.name ?? slot.id}</span>
            </>
          ) : (
            <span className="hotbar-empty">—</span>
          )}
        </div>
      ))}
    </div>
  );
}


/** Live story objective (v1.2 §story): title + progress bar over the dock. */
function QuestPill({ questIndex, progress }: { questIndex: number; progress: number }): React.JSX.Element {
  // objectiveLine reads QUESTS — stable per (index, progress).
  const line = objectiveLine({ questIndex, progress, journal: [], done: false });
  return (
    <div className="quest-pill">
      <div className="quest-title">
        <span className="quest-chapter">CH {questIndex + 1}</span> {line.title}
      </div>
      <div className="quest-text">{line.text}</div>
      <div className="quest-bar">
        <div className="quest-bar-fill" style={{ width: `${Math.round(line.ratio * 100)}%` }} />
      </div>
    </div>
  );
}
