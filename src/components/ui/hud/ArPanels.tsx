import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectMode, selectQuality } from "@/state/selectors";
import { audio } from "@/engine/audio/AudioSystem";
import type { QualityLevel, SimulationMode } from "@/types";

/**
 * Glass panels for the AR dock (asset directive §2): modes + systems.
 * The stats panel lives in DiagnosticsOverlay.tsx (ArStatsPanel) and the
 * full configuration panel in controls/SettingsPanel.tsx.
 */

const MODES: { id: SimulationMode; label: string; key: string }[] = [
  { id: "METROPOLIS", label: "Metropolis", key: "1" },
  { id: "LOW_GRAVITY", label: "Low-Gravity", key: "2" },
  { id: "ORBITAL", label: "Orbital", key: "3" },
  { id: "DEEP_SPACE", label: "Deep Space", key: "4" },
  { id: "LAB", label: "Physics Lab", key: "5" },
];

const QUALITIES: QualityLevel[] = ["low", "medium", "high", "ultra"];

export function ArModesPanel(): React.JSX.Element {
  const mode = useSettingsStore(selectMode);
  const setMode = useSettingsStore((s) => s.setMode);

  return (
    <div className="ar-panel ar-panel-modes">
      <div className="ar-panel-title">WORLD MODE</div>
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`ar-row ${mode === m.id ? "active" : ""}`}
          onClick={() => setMode(m.id)}
        >
          <span className="ar-row-label">{m.label}</span>
          <span className="ar-row-key">{m.key}</span>
        </button>
      ))}
    </div>
  );
}

export function ArSystemsPanel(): React.JSX.Element {
  const quality = useSettingsStore(selectQuality);
  const setQuality = useSettingsStore((s) => s.setQuality);
  const simRate = useSettingsStore((s) => s.simulationRate);
  const setSimulationRate = useSettingsStore((s) => s.setSimulationRate);
  const muted = useSettingsStore((s) => s.muted);
  const timeOfDay = useSettingsStore((s) => s.timeOfDay);

  return (
    <div className="ar-panel ar-panel-systems">
      <div className="ar-panel-title">SYSTEMS</div>
      <button
        className={`ar-row ${muted ? "" : "active"}`}
        onClick={() => {
          const next = !muted;
          if (next) audio.resume(); // mute→unmute is a user gesture
          audio.setMuted(next);
          useSettingsStore.getState().setMuted();
        }}
      >
        <span className="ar-row-label">{muted ? "Audio muted (M)" : "Audio on (M)"}</span>
        <span className="ar-row-key">{muted ? "OFF" : "ON"}</span>
      </button>
      <div className="ar-panel-title" style={{ marginTop: 8 }}>
        WEATHER — {timeOfDay >= 6 && timeOfDay < 18 ? "DAY CYCLE" : "NIGHT CYCLE"}
      </div>
      <div className="ar-quality-row">
        {QUALITIES.map((q) => (
          <button
            key={q}
            className={`ar-chip ${quality === q ? "active" : ""}`}
            onClick={() => setQuality(q)}
          >
            {q.toUpperCase()}
          </button>
        ))}
      </div>
      <label className="ar-slider">
        <span>Simulation ×{simRate.toFixed(2)}</span>
        <input
          type="range"
          min={0.1}
          max={2}
          step={0.05}
          value={simRate}
          onChange={(e) => setSimulationRate(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
