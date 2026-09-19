import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { frameState } from "@/state/transient/frameState";
import { reportOrbitalPeriods } from "@/components/world/space/SpaceScene";

/**
 * AR stats panel (asset directive §2, §25 diagnostics).
 *
 * Was a rigid corner table; now a floating glass card above the AR dock.
 * Samples the transient frame state at 4 Hz — the render loop never touches
 * React for telemetry. GPU string and JS heap are capability-gated and
 * degrade gracefully (§24).
 */

interface GpuInfo {
  vendor: string;
  renderer: string;
}

let gpuInfoCache: GpuInfo | null = null;

function readGpuInfo(): GpuInfo {
  if (gpuInfoCache) return gpuInfoCache;
  const renderer = frameState.renderer;
  let vendor = "unavailable";
  let gpu = "unavailable";
  if (renderer) {
    const gl = renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    if (debug) {
      vendor = String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL));
      gpu = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    } else {
      vendor = "masked";
      gpu = String(gl.getParameter(gl.VERSION));
    }
  }
  gpuInfoCache = { vendor, renderer: gpu };
  return gpuInfoCache;
}

function readHeapMb(): number | null {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  if (perf.memory && typeof perf.memory.usedJSHeapSize === "number") {
    return perf.memory.usedJSHeapSize / 1048576;
  }
  return null;
}

const INTERVAL_MS = 250;

export function ArStatsPanel(): React.JSX.Element {
  const quality = useSettingsStore(selectQuality);
  const setArPanel = useSettingsStore((s) => s.setArPanel);
  const [snapshot, setSnapshot] = useState(() => takeSnapshot());
  const tick = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      tick.current += 1;
      setSnapshot(takeSnapshot());
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const s = snapshot;

  return (
    <div className="ar-panel ar-panel-stats">
      <div className="ar-panel-head">
        <div className="ar-panel-title">
          DIAGNOSTICS — {quality.toUpperCase()}
        </div>
        <button className="ar-close" onClick={() => setArPanel("none")} aria-label="Close stats">
          ×
        </button>
      </div>
      <table>
        <tbody>
          <tr>
            <td>FPS / frame</td>
            <td>
              {s.fps.toFixed(0)} fps · {s.frameMs.toFixed(2)} ms
            </td>
          </tr>
          <tr>
            <td>Draw calls / tris</td>
            <td>
              {s.drawCalls} / {(s.triangles / 1000).toFixed(1)}k
            </td>
          </tr>
          <tr>
            <td>GPU programs</td>
            <td>{s.programs}</td>
          </tr>
          <tr>
            <td>Geometry / textures</td>
            <td>
              {s.geometries} / {s.textures}
            </td>
          </tr>
          <tr>
            <td>Physics bodies / step</td>
            <td>
              {s.bodies} / {s.stepMs.toFixed(2)} ms
            </td>
          </tr>
          <tr>
            <td>Particles</td>
            <td>{s.particles}</td>
          </tr>
          <tr>
            <td>Shader time</td>
            <td>{s.shaderTime.toFixed(1)} s</td>
          </tr>
          <tr>
            <td>JS heap</td>
            <td>{s.heapMb !== null ? `${s.heapMb.toFixed(1)} MB` : "n/a (browser)"}</td>
          </tr>
          <tr>
            <td>GPU</td>
            <td className="diag-small">{s.gpu}</td>
          </tr>
          {s.periods.length > 0 && (
            <tr>
              <td>Orbital periods</td>
              <td className="diag-small">
                {s.periods
                  .slice(0, 3)
                  .map((p) => `${p.name} ${p.periodHours.toFixed(1)}h`)
                  .join(" · ")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function takeSnapshot() {
  const store = useSettingsStore.getState();
  const space = store.mode === "ORBITAL" || store.mode === "DEEP_SPACE";
  return {
    fps: frameState.fps,
    frameMs: frameState.frameMs,
    drawCalls: frameState.render.drawCalls,
    triangles: frameState.render.triangles,
    programs: frameState.render.programs,
    geometries: frameState.render.geometries,
    textures: frameState.render.textures,
    bodies: frameState.physics.bodies,
    stepMs: frameState.physics.stepMs,
    particles: frameState.particleCount,
    shaderTime: frameState.clock.shaderTimeSeconds,
    heapMb: readHeapMb(),
    gpu: readGpuInfo().renderer,
    periods: space ? reportOrbitalPeriods() : [],
  };
}
