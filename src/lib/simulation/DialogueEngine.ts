import type { DialogueEntry } from "@/types";

/**
 * Dialogue processing core (specification §18).
 *
 * Pure, side-effect-free progression over a linear script with optional
 * `nextId` jumps. The UI layer (DialogueOverlay) only consumes indices and
 * entries, which keeps the presentation replaceable: a future backend or
 * local language model can produce `DialogueEntry[]` streams without any
 * redesign of the UI contract.
 */

/** Index of the entry to play after `index`, or -1 to end the conversation. */
export function resolveNextEntryIndex(script: readonly DialogueEntry[], index: number): number {
  const entry = script[index];
  if (!entry) return -1;
  if (entry.nextId) {
    const found = script.findIndex((e) => e.id === entry.nextId);
    return found;
  }
  const next = index + 1;
  return next < script.length ? next : -1;
}

export function getEntry(script: readonly DialogueEntry[], index: number): DialogueEntry | null {
  return script[index] ?? null;
}

/** Estimated reading duration in seconds for auto-advance hints. */
export function estimateDuration(text: string, charsPerSecond = 38): number {
  return Math.max(1.6, text.length / charsPerSecond);
}
