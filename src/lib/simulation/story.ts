/**
 * The Aether story (v1.2 — §story).
 *
 * A six-chapter introductory storyline with a pure, test-pinned quest
 * machine. World events (talk / collect / drive / travel / storm) advance
 * the active quest; completion unlocks the next chapter and appends a
 * journal line. The HUD renders the live objective from this state.
 */

export type StoryEvent = "talk" | "collect" | "drive" | "travel" | "storm";

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  /** Event kind that progresses this quest. */
  kind: StoryEvent;
  target: number;
  /** Journal line on completion. */
  epilogue: string;
}

export const QUESTS: readonly QuestDef[] = [
  {
    id: "signal",
    title: "Signal Lost",
    description: "The grid is misbehaving. Talk to Nova Chen at the plaza.",
    kind: "talk",
    target: 1,
    epilogue: "Nova: \"The storm array is drawing raw power from the districts. We need stabilizer parts — the streets are littered with them.\"",
  },
  {
    id: "parts",
    title: "Field Research",
    description: "Collect 3 items from the streets (E).",
    kind: "collect",
    target: 3,
    epilogue: "Good parts. Nova: \"Take the car — check the relay out past the northern fields.\"",
  },
  {
    id: "joyride",
    title: "Joyride",
    description: "Get in the car and drive (E near the vehicle).",
    kind: "drive",
    target: 1,
    epilogue: "The engine hums. The city thins into open country.",
  },
  {
    id: "relay",
    title: "The Northern Relay",
    description: "Reach the outskirts — find Northgate village.",
    kind: "travel",
    target: 1,
    epilogue: "The relay is quiet. Villagers speak of a storm that never ends.",
  },
  {
    id: "chaser",
    title: "Storm Chaser",
    description: "Witness a lightning strike (wait for the weather cycle).",
    kind: "storm",
    target: 1,
    epilogue: "Lightning arcs into the array. The grid steadies. For now.",
  },
  {
    id: "free",
    title: "Free Roam",
    description: "The city is yours. Westbrook and Easthollow still wait.",
    kind: "talk",
    target: Infinity,
    epilogue: "",
  },
];

export interface StoryState {
  questIndex: number;
  progress: number;
  journal: string[];
  done: boolean;
}

export const INITIAL_STORY: StoryState = {
  questIndex: 0,
  progress: 0,
  journal: [
    "You wake on the plaza with a dead comm-link and a city that hums too loud.",
  ],
  done: false,
};

/** Apply one world event to the story. Pure; returns the same state when irrelevant. */
export function advanceStory(state: StoryState, event: StoryEvent): StoryState {
  if (state.done) return state;
  const quest = QUESTS[state.questIndex];
  if (!quest || quest.kind !== event) return state;
  if (quest.target === Infinity) return state;

  const progress = state.progress + 1;
  if (progress < quest.target) return { ...state, progress };

  const nextQuest = QUESTS[state.questIndex + 1];
  return {
    questIndex: state.questIndex + 1,
    progress: 0,
    journal: [quest.epilogue, ...state.journal].slice(0, 12),
    // The story is complete when the chain ends OR free-roam begins.
    done: nextQuest === undefined || nextQuest.target === Infinity,
  };
}

/** Live objective readout for the HUD pill. */
export function objectiveLine(state: StoryState): { title: string; text: string; ratio: number } {
  const quest = QUESTS[state.questIndex] ?? QUESTS[QUESTS.length - 1] ?? QUESTS[0];
  if (!quest) return { title: "", text: "", ratio: 1 };
  const ratio = quest.target === Infinity ? 1 : Math.min(1, state.progress / quest.target);
  return { title: quest.title, text: quest.description, ratio };
}
