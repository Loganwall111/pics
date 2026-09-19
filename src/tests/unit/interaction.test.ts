import { describe, expect, it } from "vitest";
import { resolveInteraction } from "@/lib/simulation/interaction";
import { resolveNextEntryIndex, getEntry, estimateDuration } from "@/lib/simulation/DialogueEngine";
import type { DialogueEntry } from "@/types";

/** NPC proximity → interaction state machine tests (§17, §18, §31). */

const PLAYER = { x: 0, y: 1, z: 0 };

function ctx(overrides: Partial<Parameters<typeof resolveInteraction>[0]> = {}) {
  return {
    playerPosition: PLAYER,
    onFoot: true,
    nearestNpc: { id: "nova", position: { x: 1, y: 0, z: 1 }, interactRadius: 3.6 },
    nearestVehicle: null,
    playerState: "on-foot" as const,
    dialogueActive: false,
    interactPressed: false,
    cancelPressed: false,
    ...overrides,
  };
}

describe("interaction state machine", () => {
  it("E near an available NPC opens dialogue", () => {
    expect(resolveInteraction(ctx({ interactPressed: true }))).toEqual({
      kind: "open-dialogue",
      npcId: "nova",
    });
  });

  it("no key press → no decision", () => {
    expect(resolveInteraction(ctx()).kind).toBe("none");
  });

  it("NPC wins over vehicle when both are in range", () => {
    const d = resolveInteraction(ctx({ interactPressed: true, nearestVehicle: { id: "hero" } }));
    expect(d.kind).toBe("open-dialogue");
  });

  it("vehicle entry when no NPC nearby", () => {
    const d = resolveInteraction(ctx({ interactPressed: true, nearestNpc: null, nearestVehicle: { id: "hero" } }));
    expect(d.kind).toBe("enter-vehicle");
  });

  it("E while driving exits the vehicle", () => {
    const d = resolveInteraction(
      ctx({ interactPressed: true, nearestNpc: null, playerState: "driving", onFoot: false })
    );
    expect(d.kind).toBe("exit-vehicle");
  });

  it("active dialogue: E advances, Esc closes", () => {
    const advance = resolveInteraction(ctx({ dialogueActive: true, interactPressed: true }));
    expect(advance.kind).toBe("advance-dialogue");
    const close = resolveInteraction(ctx({ dialogueActive: true, cancelPressed: true }));
    expect(close.kind).toBe("close-dialogue");
  });

  it("NPC outside its radius is ignored (spatial gate honoured)", () => {
    const d = resolveInteraction(
      ctx({
        interactPressed: true,
        nearestNpc: { id: "nova", position: { x: 30, y: 0, z: 30 }, interactRadius: 3.6 },
      })
    );
    expect(d.kind).toBe("none");
  });
});

describe("dialogue progression", () => {
  const script: DialogueEntry[] = [
    { id: "a", speaker: "X", text: "one", nextId: "c" },
    { id: "b", speaker: "X", text: "orphaned" },
    { id: "c", speaker: "X", text: "two" },
  ];

  it("resolves explicit nextId jumps", () => {
    expect(resolveNextEntryIndex(script, 0)).toBe(2); // a → c
  });

  it("defaults to linear order and detects the end", () => {
    expect(resolveNextEntryIndex(script, 2)).toBe(-1);
    const linear: DialogueEntry[] = [
      { id: "a", speaker: "X", text: "1" },
      { id: "b", speaker: "X", text: "2" },
    ];
    expect(resolveNextEntryIndex(linear, 0)).toBe(1);
  });

  it("getEntry returns null out of range instead of throwing", () => {
    expect(getEntry(script, 99)).toBeNull();
  });

  it("duration estimate scales with text length", () => {
    expect(estimateDuration("short")).toBeLessThan(estimateDuration("x".repeat(200)));
  });
});
