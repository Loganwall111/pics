import { create } from "zustand";
import { INITIAL_STORY, advanceStory, type StoryEvent, type StoryState } from "@/lib/simulation/story";

/**
 * Story/quest store (v1.2 — §story): mirrors the pure quest machine into
 * React. Session-transient — a fresh hero each session, journal included.
 */

interface QuestState extends StoryState {
  signal: (event: StoryEvent) => void;
}

export const useQuestStore = create<QuestState>()((set, get) => ({
  ...INITIAL_STORY,
  signal: (event) => {
    const next = advanceStory(
      { questIndex: get().questIndex, progress: get().progress, journal: get().journal, done: get().done },
      event
    );
    set(next);
  },
}));
