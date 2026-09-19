import { describe, expect, it } from "vitest";
import { INITIAL_STORY, QUESTS, advanceStory, objectiveLine } from "@/lib/simulation/story";

/** Story quest machine contracts (v1.2 §story). */

describe("advanceStory", () => {
  it("walks the full storyline to completion", () => {
    let s = INITIAL_STORY;
    s = advanceStory(s, "talk"); // ch1 complete
    expect(QUESTS[s.questIndex]?.id).toBe("parts");
    s = advanceStory(s, "collect");
    s = advanceStory(s, "collect");
    s = advanceStory(s, "collect"); // ch2 complete
    expect(QUESTS[s.questIndex]?.id).toBe("joyride");
    s = advanceStory(s, "drive");
    expect(QUESTS[s.questIndex]?.id).toBe("relay");
    s = advanceStory(s, "travel");
    expect(QUESTS[s.questIndex]?.id).toBe("chaser");
    s = advanceStory(s, "storm");
    expect(s.done).toBe(true);
    expect(QUESTS[s.questIndex]?.id).toBe("free");
  });

  it("ignores events the current quest does not want", () => {
    // Same-reference no-op: an off-kind event must not touch the state.
    expect(advanceStory(INITIAL_STORY, "drive")).toBe(INITIAL_STORY);
  });

  it("is idempotent when done", () => {
    let s = INITIAL_STORY;
    for (const ev of ["talk", "collect", "collect", "collect", "drive", "travel", "storm"] as const) {
      s = advanceStory(s, ev);
    }
    expect(s.done).toBe(true);
    const again = advanceStory(s, "talk");
    expect(again).toBe(s);
  });

  it("records journal epilogues, newest first", () => {
    const s = advanceStory(INITIAL_STORY, "talk");
    expect(s.journal[0]).toContain("storm array");
    expect(s.journal.length).toBeLessThanOrEqual(12);
  });
});

describe("objectiveLine", () => {
  it("tracks fractional progress", () => {
    const s = advanceStory(INITIAL_STORY, "talk"); // → collect 0/3
    const o = objectiveLine(s);
    expect(o.title).toBe("Field Research");
    expect(o.ratio).toBe(0);
    const s2 = advanceStory(s, "collect");
    expect(objectiveLine(s2).ratio).toBeCloseTo(1 / 3, 5);
  });

  it("free-roam reads as complete", () => {
    let s = INITIAL_STORY;
    s = advanceStory(s, "talk");
    s = advanceStory(s, "collect");
    s = advanceStory(s, "collect");
    s = advanceStory(s, "collect");
    s = advanceStory(s, "drive");
    s = advanceStory(s, "travel");
    s = advanceStory(s, "storm");
    expect(objectiveLine(s).ratio).toBe(1);
  });
});
