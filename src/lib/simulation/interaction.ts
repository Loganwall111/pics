import type { Vector3Like } from "@/types";

/**
 * Interaction resolution (specification §17).
 *
 * Pure decision function: given the player's context and the current input
 * edges, decide what the interaction system should do this frame.
 * The component layer (InteractionSystem) applies the decision to stores.
 * Kept pure for deterministic unit tests of the full dialogue/enter/exit
 * state machine.
 */

export interface InteractionNpcRef {
  id: string;
  position: Vector3Like;
  interactRadius: number;
}

export interface InteractionInput {
  playerPosition: Vector3Like;
  onFoot: boolean;
  nearestNpc: InteractionNpcRef | null;
  /** Vehicle within enter range (null = none). */
  nearestVehicle: { id: string } | null;
  playerState: "on-foot" | "driving" | "flying";
  dialogueActive: boolean;
  /** Input edges for this frame. */
  interactPressed: boolean;
  cancelPressed: boolean;
}

export type InteractionDecision =
  | { kind: "none" }
  | { kind: "open-dialogue"; npcId: string }
  | { kind: "advance-dialogue" }
  | { kind: "close-dialogue" }
  | { kind: "enter-vehicle" }
  | { kind: "exit-vehicle" };

const EXIT_SPEED_LIMIT_MS = 4.0;

export function resolveInteraction(input: InteractionInput): InteractionDecision {
  if (input.dialogueActive) {
    if (input.cancelPressed) return { kind: "close-dialogue" };
    if (input.interactPressed) return { kind: "advance-dialogue" };
    return { kind: "none" };
  }
  if (!input.interactPressed) return { kind: "none" };

  // NPC conversation wins over vehicle entry when both are in range.
  if (input.onFoot && input.nearestNpc) {
    const dx = input.playerPosition.x - input.nearestNpc.position.x;
    const dz = input.playerPosition.z - input.nearestNpc.position.z;
    if (dx * dx + dz * dz <= input.nearestNpc.interactRadius * input.nearestNpc.interactRadius) {
      return { kind: "open-dialogue", npcId: input.nearestNpc.id };
    }
  }
  if (input.onFoot && input.nearestVehicle) {
    return { kind: "enter-vehicle" };
  }
  if (input.playerState === "driving") {
    return { kind: "exit-vehicle" };
  }
  return { kind: "none" };
}

export const VEHICLE_EXIT_SPEED_LIMIT_MS = EXIT_SPEED_LIMIT_MS;
