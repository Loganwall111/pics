import { useEffect, useReducer, useRef, useState } from "react";
import { MainMenu } from "./ui/MainMenu";
import { Hud } from "./ui/Hud";
import { GameCanvas } from "./scenes/GameCanvas";
import { createLumitalInput } from "./game/input";
import { journeyReducer, type JourneyState } from "./game/journey";
import { buyTrait, type TraitId } from "./game/traits";
import { nextWorld } from "./game/worlds";
import { lumitalAudio } from "./game/audio";
import "./styles.css";

/**
 * LUMITAL app shell (§app).
 *
 * menu → journey. The journey owns one input mapper and drives the world
 * through a reducer (honest, testable transitions). E opens the evolution
 * overlay, B seeds a colony at the creature's feet, the glowing portal
 * carries you to the next world (+DNA adaptation bonus).
 */

const INITIAL: JourneyState = {
  phase: "menu",
  speciesIndex: 0,
  world: "void",
  dna: 0,
  levels: {},
  colonies: 0,
  log: [],
};

export function App(): React.JSX.Element {
  const [journey, dispatch] = useReducer(journeyReducer, INITIAL);
  const [evolveOpen, setEvolveOpen] = useState(false);
  const [, forceTick] = useState(0);
  const coloniesRef = useRef<[number, number][]>([]);
  const dnaSpentRef = useRef(0);

  const inputRef = useRef<ReturnType<typeof createLumitalInput> | null>(null);

  useEffect(() => {
    const handle = createLumitalInput();
    inputRef.current = handle;
    return () => {
      handle.dispose();
      inputRef.current = null;
    };
  }, []);

  // One-shot key intents (E evolve overlay, B colony).
  useEffect(() => {
    if (journey.phase !== "journey") return;
    const id = window.setInterval(() => {
      const input = inputRef.current?.input;
      if (!input) return;
      if (input.evolveRequested) {
        input.evolveRequested = false;
        setEvolveOpen((v) => !v);
      }
      if (input.muted !== lumitalAudio.muted) lumitalAudio.setMuted(input.muted);
      if (input.colonyRequested) {
        input.colonyRequested = false;
        if (!evolveOpen && journey.colonies < 5) {
          lumitalAudio.colony();
          // Colony at the creature's current spot (approximated by last cam
          // focus — the input module tracks yaw; the canvas reports position
          // via colony placement callback below).
          dispatch({ type: "colony" });
        }
      }
      forceTick((t) => (t + 1) % 1000000);
    }, 120);
    return () => window.clearInterval(id);
  }, [journey.phase, journey.colonies, evolveOpen]);

  if (journey.phase === "menu") {
    return (
      <MainMenu
        onStart={(speciesIndex) => {
          lumitalAudio.resume(); // user gesture — audio wakes here
          lumitalAudio.setMuted(inputRef.current?.input.muted ?? false);
          coloniesRef.current = [];
          dnaSpentRef.current = 0;
          dispatch({ type: "start", speciesIndex });
        }}
      />
    );
  }

  const input = inputRef.current?.input ?? {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    yaw: Math.PI,
    evolveRequested: false,
    colonyRequested: false,
    firstPerson: false,
    muted: false,
  };

  const handleBuy = (id: TraitId): void => {
    const res = buyTrait(journey.dna, journey.levels, id);
    if (res) {
      dnaSpentRef.current += journey.dna - res.dna;
      dispatch({ type: "spend", amount: journey.dna - res.dna, levels: res.levels });
    }
  };

  return (
    <div className="lum-game">
      <GameCanvas
        journey={journey}
        input={input}
        onPortal={() => {
          lumitalAudio.portal();
          dispatch({ type: "portal", next: nextWorld(journey.world), bonus: 30 });
        }}
        onCollect={() => {
          lumitalAudio.pickup();
          dispatch({ type: "collect", amount: 8 });
        }}
        colonies={coloniesRef.current}
      />
      <Hud
        journey={journey}
        evolveOpen={evolveOpen}
        onToggleEvolve={() => setEvolveOpen(false)}
        onBuy={handleBuy}
        onSeedColony={() => dispatch({ type: "colony" })}
        onMenu={() => dispatch({ type: "backToMenu" })}
      />
    </div>
  );
}
