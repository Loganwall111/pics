import { TRAITS, traitCost, type TraitLevels, type TraitId } from "../game/traits";
import { WORLDS } from "../game/worlds";
import type { JourneyState } from "../game/journey";

/**
 * LUMITAL HUD (§hud): DNA counter, world banner, journey log, and the
 * EVOLVE overlay (E) where DNA buys trait levels that morph the creature
 * live. Colony seeding (B) progresses the lineage phase.
 */

export function Hud({
  journey,
  evolveOpen,
  onToggleEvolve,
  onBuy,
  onSeedColony,
  onMenu,
}: {
  journey: JourneyState;
  evolveOpen: boolean;
  onToggleEvolve: () => void;
  onBuy: (id: TraitId) => void;
  onSeedColony: () => void;
  onMenu: () => void;
}): React.JSX.Element {
  const world = WORLDS[journey.world];
  return (
    <>
      <div className="lum-hud">
        <div className="lum-hud-left">
          <div className="lum-dna">◈ {journey.dna} DNA</div>
          <div className="lum-worldname">{world.name}</div>
          <div className="lum-blurb">{world.blurb}</div>
          <div className="lum-colonies">Colonies: {journey.colonies} / 5 {journey.colonies >= 5 ? "— EMPIRE ACHIEVED" : ""}</div>
        </div>
        <div className="lum-hud-right">
          <div className="lum-log">
            {journey.log.map((line, i) => (
              <div key={i} className="lum-log-line">
                {line}
              </div>
            ))}
          </div>
          <div className="lum-keys">E evolve · B colony · reach the glowing portal to travel</div>
          <button className="lum-menu-btn" onClick={onSeedColony} disabled={journey.colonies >= 5}>
            {journey.colonies >= 5 ? "EMPIRE COMPLETE" : "SEED COLONY HERE (B)"}
          </button>
          <button className="lum-menu-btn" onClick={onMenu}>
            MENU
          </button>
        </div>
      </div>

      {evolveOpen ? (
        <div className="lum-evolve" onClick={onToggleEvolve}>
          <div className="lum-evolve-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lum-evolve-title">EVOLVE — ◈ {journey.dna} DNA</div>
            {TRAITS.map((t) => {
              const level = journey.levels[t.id] ?? 0;
              const cost = traitCost(t, level);
              const maxed = !Number.isFinite(cost);
              return (
                <button
                  key={t.id}
                  className="lum-trait-row"
                  disabled={maxed || journey.dna < cost}
                  onClick={() => onBuy(t.id)}
                >
                  <span className="lum-trait-name">
                    {t.name} <em>Lv {level}/{t.maxLevel}</em>
                  </span>
                  <span className="lum-trait-blurb">{t.blurb}</span>
                  <span className="lum-trait-cost">{maxed ? "MAX" : `◈ ${cost}`}</span>
                </button>
              );
            })}
            <div className="lum-evolve-hint">Traits morph your body instantly. E / click outside to close.</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export type { TraitLevels };
