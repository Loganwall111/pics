import type { WorldId } from "../game/worlds";

/**
 * LUMITAL journey state — one small reactive store (React context-free,
 * zustand-free by design for this standalone app; a plain pub/sub would
 * also do, but a reducer keeps transitions honest and testable).
 */

export interface JourneyState {
  phase: "menu" | "journey";
  speciesIndex: number;
  world: WorldId;
  dna: number;
  levels: Partial<Record<string, number>>;
  colonies: number;
  log: string[];
}

export type JourneyAction =
  | { type: "start"; speciesIndex: number }
  | { type: "backToMenu" }
  | { type: "portal"; next: WorldId; bonus: number }
  | { type: "collect"; amount: number }
  | { type: "spend"; amount: number; levels: Partial<Record<string, number>> }
  | { type: "colony" };

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case "start":
      return {
        phase: "journey",
        speciesIndex: action.speciesIndex,
        world: "void",
        dna: 40,
        levels: {},
        colonies: 0,
        log: ["Genesis. You wake in the Psychedelic Void."],
      };
    case "backToMenu":
      return { ...state, phase: "menu" };
    case "portal":
      return {
        ...state,
        world: action.next,
        dna: state.dna + action.bonus,
        log: [
          `Portal crossed → ${action.next}. Adaptation bonus +${action.bonus} DNA.`,
          ...state.log,
        ].slice(0, 6),
      };
    case "collect":
      return { ...state, dna: state.dna + action.amount };
    case "spend":
      return { ...state, dna: state.dna - action.amount, levels: action.levels };
    case "colony":
      return {
        ...state,
        colonies: state.colonies + 1,
        log: [
          `Colony ${state.colonies + 1} seeded. Your lineage spreads.`,
          ...state.log,
        ].slice(0, 6),
      };
    default:
      return state;
  }
}
