import { useMemo, useState } from "react";
import { SPECIES_CATALOG, SPECIES_COUNT, getSpecies, type Species } from "../game/creatures";
import { WORLDS, WORLD_ORDER, type WorldId } from "../game/worlds";

/**
 * LUMITAL main menu (§menu).
 *
 * Two-pane picker: LEFT — title, the selected creature's inspector (real
 * body-plan stats), START, world chips. RIGHT — the FULL 108-species
 * genesis catalog in its own scrollable pane with home-world filters, so
 * nothing is ever cut off (all of it renders; the pane scrolls).
 * Every card is a real deterministic creature — glyph colors derive from
 * its actual hue/pattern/glow data.
 */

const HOME_FILTERS: { id: WorldId | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "void", label: "Void" },
  { id: "ocean", label: "Ocean" },
  { id: "microscopic", label: "Micro" },
  { id: "alienrain", label: "Rain" },
  { id: "maze", label: "Labyrinth" },
];

function SpeciesCard({
  species,
  selected,
  onPick,
}: {
  species: Species;
  selected: boolean;
  onPick: (i: number) => void;
}): React.JSX.Element {
  const hue = species.plan.hue;
  const accent = species.plan.hueAccent;
  return (
    <button
      className={`species-card ${selected ? "selected" : ""}`}
      onClick={() => onPick(species.index)}
      title={`${species.name} — ${WORLDS[species.homeWorld].name} · ${species.temperament}`}
    >
      <span
        className="species-glyph"
        style={{
          background: `radial-gradient(circle at 35% 35%, hsl(${accent} 85% 65%), hsl(${hue} 80% 42%) 70%)`,
          borderRadius:
            species.plan.pattern === "rings"
              ? "50%"
              : species.plan.pattern === "stripes"
                ? "30% 70% 30% 70%"
                : "42%",
          boxShadow: species.plan.glow > 0.55 ? `0 0 14px hsl(${accent} 90% 60% / 0.8)` : "none",
        }}
      />
      <span className="species-name">{species.name}</span>
      <span className="species-world">{WORLDS[species.homeWorld].name}</span>
    </button>
  );
}

/** Big inspection readout of the currently selected creature. */
function Inspector({ species }: { species: Species }): React.JSX.Element {
  const p = species.plan;
  const glyph = {
    background: `radial-gradient(circle at 35% 35%, hsl(${p.hueAccent} 85% 65%), hsl(${p.hue} 80% 42%) 70%)`,
    borderRadius: p.pattern === "rings" ? "50%" : p.pattern === "stripes" ? "30% 70% 30% 70%" : "42%",
    boxShadow: p.glow > 0.55 ? `0 0 30px hsl(${p.hueAccent} 90% 60% / 0.9)` : "0 0 12px rgba(150,90,255,0.3)",
  };
  return (
    <div className="inspector">
      <span className="inspector-glyph" style={glyph} />
      <div className="inspector-stats">
        <div className="inspector-name">{species.name}</div>
        <div className="inspector-line">Home — {WORLDS[species.homeWorld].name}</div>
        <div className="inspector-line">
          {p.limbCount} limbs ({p.limbStyle}) · {p.eyeCount} eyes
        </div>
        <div className="inspector-line">
          {p.tail > 0.15 ? "tailed" : "tailless"} · {p.antennae ? "antennae" : "no antennae"}
          {p.dorsalFin ? " · dorsal fin" : ""}
        </div>
        <div className="inspector-line">
          {p.pattern} pattern · glow {Math.round(p.glow * 100)}% · {species.temperament}
        </div>
      </div>
    </div>
  );
}

export function MainMenu({
  onStart,
}: {
  onStart: (speciesIndex: number) => void;
}): React.JSX.Element {
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState<WorldId | "all">("all");
  const species = useMemo(() => getSpecies(selected), [selected]);

  const visible = useMemo(
    () => (filter === "all" ? SPECIES_CATALOG : SPECIES_CATALOG.filter((s) => s.homeWorld === filter)),
    [filter]
  );

  return (
    <div className="lum-menu">
      <div className="lum-menu-bg" />

      {/* LEFT — identity + start (always visible) */}
      <div className="lum-pane-left">
        <div className="lum-kicker">A PSYCHEDELIC MULTIVERSE EXPLORER</div>
        <h1 className="lum-title">LUMITAL</h1>
        <p className="lum-tag">
          Choose your creature from {SPECIES_COUNT} species. Cross portals through six worlds —
          nebulae, labyrinths, an event horizon, the inside of life itself. Collect DNA, evolve
          your form, seed colonies, build your lineage's empire.
        </p>

        <Inspector species={species} />

        <button className="lum-start" onClick={() => onStart(species.index)}>
          BEGIN AS {species.name.toUpperCase()}
        </button>

        <div className="lum-worlds-row">
          {WORLD_ORDER.map((id) => (
            <span key={id} className="lum-world-chip">
              {WORLDS[id].name}
            </span>
          ))}
        </div>
        <div className="lum-hint">
          WASD walk · Space jump · drag look · E evolve · B seed colony · portals glow
        </div>
      </div>

      {/* RIGHT — the complete catalog, scrollable, filterable */}
      <div className="lum-pane-right">
        <div className="species-filter-row">
          {HOME_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`species-filter ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <span className="species-count">
            {visible.length} / {SPECIES_COUNT} species
          </span>
        </div>
        <div className="species-grid">
          {visible.map((s) => (
            <SpeciesCard
              key={s.index}
              species={s}
              selected={s.index === selected}
              onPick={setSelected}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
