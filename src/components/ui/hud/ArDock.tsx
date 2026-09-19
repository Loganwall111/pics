import { useSettingsStore } from "@/state/stores/settingsStore";
import type { ArPanel } from "@/state/stores/settingsStore";
import { frameState } from "@/state/transient/frameState";

/**
 * Floating circular AR dock (asset directive §2).
 *
 * Replaces the rigid corner readout boxes: four glassmorphism buttons
 * (Stats · Modes · Systems · Config) hover near the lower-left viewport.
 * Each toggles its glass panel above the dock; the active button glows.
 * Pure inline SVG icons — no icon dependency, no texture cost.
 */

interface DockItem {
  id: Exclude<ArPanel, "none">;
  label: string;
  icon: React.JSX.Element;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DOCK_ITEMS: DockItem[] = [
  {
    id: "stats",
    label: "Stats",
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" {...stroke}>
        <path d="M4 19h16" />
        <path d="M7 16v-5" />
        <path d="M12 16V6" />
        <path d="M17 16v-8" />
      </svg>
    ),
  },
  {
    id: "modes",
    label: "Modes",
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" {...stroke}>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M3.6 12h16.8" />
        <path d="M12 3.6c2.6 2.4 3.9 5.3 3.9 8.4S14.6 18 12 20.4C9.4 18 8.1 15.1 8.1 12S9.4 6 12 3.6z" />
      </svg>
    ),
  },
  {
    id: "systems",
    label: "Systems",
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" {...stroke}>
        <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
        <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" />
        <circle cx="12" cy="12" r="2.1" />
      </svg>
    ),
  },
  {
    id: "config",
    label: "Config",
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 4.2v2.1M12 17.7v2.1M4.2 12h2.1M17.7 12h2.1M6.5 6.5l1.5 1.5M16 16l1.5 1.5M17.5 6.5L16 8M8 16l-1.5 1.5" />
      </svg>
    ),
  },
];

export function ArDock(): React.JSX.Element {
  const active = useSettingsStore((s) => s.arPanel);
  const setArPanel = useSettingsStore((s) => s.setArPanel);
  const hovered = useSettingsStore((s) => s.arPanelHover);
  const setHover = useSettingsStore((s) => s.setArPanelHover);

  // AAA dock (v1.2): the readout sits ABOVE the circular buttons and
  // mirrors the hovered/active orb's label.
  const readout =
    DOCK_ITEMS.find((i) => i.id === (hovered ?? active))?.label ??
    (hovered === "firstPerson" ? "First person" : "AETHER");

  return (
    <div className="ar-dock">
      <div className="ar-dock-readout">{readout}</div>
      <div className="ar-dock-row">
      {DOCK_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`ar-orb ${active === item.id ? "active" : ""}`}
          onClick={() => setArPanel(active === item.id ? "none" : item.id)}
          onMouseEnter={() => setHover(item.id)}
          onMouseLeave={() => setHover(null)}
          aria-label={item.label}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
      {/* First-person quick toggle mirrors the V/F1 key */}
      <button
        className={`ar-orb ${frameState.firstPerson ? "active" : ""}`}
        onClick={() => {
          frameState.firstPerson = !frameState.firstPerson;
        }}
        onMouseEnter={() => setHover("firstPerson")}
        onMouseLeave={() => setHover(null)}
        aria-label="First person"
        title="First person (V)"
      >
        <svg viewBox="0 0 24 24" width="19" height="19" {...stroke}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 20c.8-3.6 3.4-5.6 6.5-5.6s5.7 2 6.5 5.6" />
        </svg>
      </button>
      </div>
    </div>
  );
}
