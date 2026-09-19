import { useSettingsStore } from "@/state/stores/settingsStore";
import { audio } from "@/engine/audio/AudioSystem";
import type { SimulationMode } from "@/types";

/**
 * AAA-style main menu (v1.1).
 *
 * Full-screen overlay over the LIVE canvas — the simulation keeps running
 * behind it with a cinematic orbit camera (see CameraRig), so entering the
 * city is seamless: no reload, no boot spike. Any click on ENTER or a mode
 * row closes it; Esc re-opens it from anywhere (ToggleSettings → menu when
 * nothing else is open... kept simple: settings panel still uses G).
 */

const MODES: { id: SimulationMode; label: string }[] = [
  { id: "METROPOLIS", label: "Metropolis" },
  { id: "LOW_GRAVITY", label: "Low-Gravity" },
  { id: "ORBITAL", label: "Orbital" },
  { id: "DEEP_SPACE", label: "Deep Space" },
  { id: "LAB", label: "Physics Lab" },
];

const MODE_BLURBS: Record<string, string> = {
  METROPOLIS: "The neon metropolis — traffic, storms, districts beyond the grid",
  LOW_GRAVITY: "0.165 g — giant leaps, turquoise alien sky",
  ORBITAL: "A Keplerian planetary system, real orbital mechanics",
  DEEP_SPACE: "The same system, far out — floating origin territory",
  LAB: "Physics lab — gravity, mass, uncertainty controls",
};

export function MainMenu(): React.JSX.Element | null {
  const menuOpen = useSettingsStore((s) => s.menuOpen);
  const setMenuOpen = useSettingsStore((s) => s.setMenuOpen);
  const mode = useSettingsStore((s) => s.mode);

  if (!menuOpen) return null;

  const enter = (): void => {
    audio.resume(); // menu click is a user gesture — audio wakes here
    audio.setMuted(useSettingsStore.getState().muted);
    audio.blip();
    setMenuOpen(false);
  };

  return (
    <div className="main-menu">
      <div className="main-menu-inner">
        <div className="main-menu-kicker">A REALITY SIMULATOR</div>
        <h1 className="main-menu-title">
          AETHER<span> CITY</span>
        </h1>
        <div className="main-menu-tagline">
          Procedural metropolis · volumetric storms · living districts
        </div>

        <button className="menu-enter" onClick={enter}>
          ENTER CITY
        </button>

        <div className="menu-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`menu-mode-row ${m.id === mode ? "active" : ""}`}
              onClick={() => {
                useSettingsStore.getState().setMode(m.id);
                enter();
              }}
            >
              <span className="menu-mode-name">{m.label}</span>
              <span className="menu-mode-blurb">{MODE_BLURBS[m.id] ?? ""}</span>
            </button>
          ))}
        </div>

        <div className="menu-hint">
          WASD move · E interact / pickup · Q punch · F shoot · T throw · V first-person · M audio
        </div>
        <div className="menu-credits">All art AI-generated · WebGL2 · deterministic simulation</div>
      </div>
    </div>
  );
}
