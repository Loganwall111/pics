import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectMode, selectQuality, selectShowSettings } from "@/state/selectors";
import type { QualityLevel, SimulationMode } from "@/types";
import { frameState } from "@/state/transient/frameState";

/**
 * Simulation controls (§2 UI Layer, §26).
 *
 * Every slider writes to the settings store; subsystems subscribe and apply
 * values themselves (quality → RenderQualityManager + profiles, gravity →
 * SimulationLoop, seed → City). Local state is deliberately avoided so the
 * panel is a pure projection of configuration state.
 */

const QUALITIES: QualityLevel[] = ["low", "medium", "high", "ultra"];
const MODES: { id: SimulationMode; label: string }[] = [
  { id: "METROPOLIS", label: "1 · Metropolis" },
  { id: "LOW_GRAVITY", label: "2 · Low-Gravity" },
  { id: "ORBITAL", label: "3 · Orbital" },
  { id: "DEEP_SPACE", label: "4 · Deep Space" },
  { id: "LAB", label: "5 · Physics Lab" },
];

export function SettingsPanel(): React.JSX.Element | null {
  const open = useSettingsStore(selectShowSettings);
  const s = useSettingsStore();
  const mode = useSettingsStore(selectMode);
  const quality = useSettingsStore(selectQuality);

  if (!open) return null;
  // (open === showSettings; the AR dock 'config' orb syncs this flag.)

  return (
    <div className="settings-panel">
      <div className="settings-head">
        <h2>SIMULATION CONTROLS</h2>
        <button className="ghost" onClick={() => s.toggleSettings()}>
          Close (G)
        </button>
      </div>

      <section>
        <h3>World mode</h3>
        <div className="btn-row">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? "active" : ""} onClick={() => s.setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Quality profile</h3>
        <div className="btn-row">
          {QUALITIES.map((q) => (
            <button key={q} className={quality === q ? "active" : ""} onClick={() => s.setQuality(q)}>
              {q.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={s.showDiagnostics} onChange={() => s.toggleDiagnostics()} />
          Diagnostics overlay (Tab)
        </label>
      </section>

      <section>
        <h3>Time of day</h3>
        <label className="slider">
          <span>
            {(() => {
              const h = Math.floor(s.timeOfDay);
              const m = Math.floor((s.timeOfDay - h) * 60);
              return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            })()}
          </span>
          <input
            type="range"
            min={0}
            max={23.99}
            step={0.05}
            value={s.timeOfDay}
            onChange={(e) => {
              const v = Number(e.target.value);
              s.setTimeOfDay(v);
              frameState.timeOfDay = v;
            }}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.timeFrozen}
            onChange={(e) => s.setTimeFrozen(e.target.checked)}
          />
          Freeze time of day
        </label>
        <label className="slider">
          <span>Time speed ×{s.timeScaleHoursPerSecond.toFixed(2)} h/s</span>
          <input
            type="range"
            min={0.02}
            max={2}
            step={0.02}
            value={s.timeScaleHoursPerSecond}
            onChange={(e) => s.setTimeScale(Number(e.target.value))}
          />
        </label>
      </section>

      <section>
        <h3>Global simulation</h3>
        <label className="slider">
          <span>Simulation rate ×{s.simulationRate.toFixed(2)}</span>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.05}
            value={s.simulationRate}
            onChange={(e) => s.setSimulationRate(Number(e.target.value))}
          />
        </label>
        <label className="slider">
          <span>City seed {s.citySeed}</span>
          <input
            type="range"
            min={1}
            max={9999}
            step={1}
            value={s.citySeed % 10000}
            onChange={(e) => s.setCitySeed(Number(e.target.value))}
          />
        </label>
        <p className="note">Same seed ⇒ identical skyline (deterministic generation).</p>
      </section>

      {mode === "LAB" && (
        <section>
          <h3>Laboratory parameters</h3>
          <label className="slider">
            <span>
              Gravity ({s.lab.gravityX.toFixed(1)}, {s.lab.gravityY.toFixed(1)}, {s.lab.gravityZ.toFixed(1)}) m/s²
            </span>
            <input
              type="range"
              min={-25}
              max={5}
              step={0.1}
              value={s.lab.gravityY}
              onChange={(e) => s.setLab({ gravityY: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>Mass multiplier ×{s.lab.massMultiplier.toFixed(2)}</span>
            <input
              type="range"
              min={0.1}
              max={8}
              step={0.1}
              value={s.lab.massMultiplier}
              onChange={(e) => s.setLab({ massMultiplier: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>Spawn rate {s.lab.spawnRate.toFixed(1)} /s</span>
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={s.lab.spawnRate}
              onChange={(e) => s.setLab({ spawnRate: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>Body cap {s.lab.maxBodies}</span>
            <input
              type="range"
              min={0}
              max={400}
              step={10}
              value={s.lab.maxBodies}
              onChange={(e) => s.setLab({ maxBodies: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>Solver iterations {s.lab.solverIterations}</span>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={s.lab.solverIterations}
              onChange={(e) => s.setLab({ solverIterations: Number(e.target.value) })}
            />
          </label>
          <label className="slider">
            <span>Simulation speed ×{s.lab.simSpeed.toFixed(2)}</span>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.05}
              value={s.lab.simSpeed}
              onChange={(e) => s.setLab({ simSpeed: Number(e.target.value) })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={s.lab.uncertainty}
              onChange={(e) => s.setLab({ uncertainty: e.target.checked })}
            />
            "Quantum uncertainty" stochastic kicks (visualized concept)
          </label>
        </section>
      )}
    </div>
  );
}
