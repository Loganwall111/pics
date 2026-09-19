import { useEffect, useRef, useState } from "react";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { getNpcDefinition, getScript } from "@/components/world/entities/npcDefinitions";
import { getEntry } from "@/lib/simulation/DialogueEngine";
import { frameState } from "@/state/transient/frameState";

/**
 * Dialogue UI (§18).
 *
 * Typewriter reveal runs on rAF writing into a span (no per-character React
 * state); the progression itself lives in the simulation store via the pure
 * DialogueEngine. `frameState.dialogueCommand` carries one-shot reveal /
 * advance commands from the InteractionSystem so input semantics stay in one
 * place. The processor behind the entries is swappable without UI changes.
 */

const CHARS_PER_SECOND = 46;

export function DialogueOverlay(): React.JSX.Element | null {
  const dialogue = useSimulationStore((s) => s.dialogue);
  const advance = useSimulationStore((s) => s.advanceDialogue);
  const close = useSimulationStore((s) => s.closeDialogue);
  const textRef = useRef<HTMLSpanElement>(null);
  const revealedRef = useRef(0);
  const [revealed, setRevealed] = useState(0);

  const npc = dialogue.active && dialogue.npcId ? getNpcDefinition(dialogue.npcId) : null;
  const script = dialogue.active && dialogue.npcId ? getScript(dialogue.npcId) : [];
  const entry = getEntry(script, dialogue.entryIndex);
  const fullText = entry?.text ?? "";

  // Reset the typewriter whenever the entry changes.
  useEffect(() => {
    revealedRef.current = 0;
    setRevealed(0);
    frameState.dialogueTyping = fullText.length > 0;
    if (!dialogue.active) frameState.dialogueTyping = false;
  }, [fullText, dialogue.active, dialogue.entryIndex]);

  // rAF typewriter loop.
  useEffect(() => {
    if (!dialogue.active || !entry) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      revealedRef.current = Math.min(fullText.length, revealedRef.current + dt * CHARS_PER_SECOND);
      const n = Math.floor(revealedRef.current);
      setRevealed((prev) => (prev === n ? prev : n));
      if (textRef.current) textRef.current.textContent = fullText.slice(0, n);
      frameState.dialogueTyping = n < fullText.length;
      if (frameState.dialogueTyping) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dialogue.active, entry, fullText]);

  // One-shot reveal command from the interaction system.
  useEffect(() => {
    if (frameState.dialogueCommand === 1) {
      frameState.dialogueCommand = 0;
      revealedRef.current = fullText.length;
      setRevealed(fullText.length);
      if (textRef.current) textRef.current.textContent = fullText;
      frameState.dialogueTyping = false;
    }
  }, [fullText]);

  if (!dialogue.active || !npc || !entry) return null;

  const isLast = dialogue.entryIndex >= script.length - 1;

  const onAdvance = (): void => {
    if (revealed < fullText.length) {
      revealedRef.current = fullText.length;
      setRevealed(fullText.length);
      if (textRef.current) textRef.current.textContent = fullText;
      frameState.dialogueTyping = false;
      return;
    }
    if (isLast) {
      close();
    } else {
      advance(script);
    }
  };

  return (
    <div className="dialogue-backdrop">
      <div className="dialogue-card" onClick={onAdvance}>
        <div className="dialogue-header">
          <img className="dialogue-portrait" src={npc.portraitUrl} alt={`${npc.name} portrait`} />
          <div>
            <div className="dialogue-speaker">{entry.speaker}</div>
            <div className="dialogue-role">{npc.role}</div>
          </div>
        </div>
        <p className="dialogue-text">
          <span ref={textRef}>{fullText.slice(0, revealed)}</span>
          {revealed < fullText.length && <span className="dialogue-caret">▌</span>}
        </p>
        <div className="dialogue-actions">
          <button onClick={onAdvance}>{revealed < fullText.length ? "Skip (E)" : isLast ? "End (E)" : "Next (E)"}</button>
          <button
            className="ghost"
            onClick={() => {
              close();
            }}
          >
            Leave (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
