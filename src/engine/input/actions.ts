/**
 * Semantic action layer (specification §19).
 * Physical inputs (keyboard, pointer, gamepad) are translated into these
 * actions; no scene component may read `KeyboardEvent` directly.
 */

export enum SimAction {
  MoveForward = 0,
  MoveBackward = 1,
  MoveLeft = 2,
  MoveRight = 3,
  Boost = 4,
  Sprint = 5,
  Jump = 6,
  Handbrake = 7,
  Interact = 8,
  Ascend = 9,
  Descend = 10,
  Brake = 11,
  ToggleFlight = 12,
  ToggleDampers = 13,
  ResetVehicle = 14,
  Cancel = 15,
  WarpJump = 16,
  SelectMetropolis = 17,
  SelectLowGravity = 18,
  SelectOrbital = 19,
  SelectDeepSpace = 20,
  SelectLab = 21,
  ToggleDiagnostics = 22,
  ToggleSettings = 23,
  FirstPerson = 24,
  ToggleAudio = 25,
  Punch = 26,
  ThrowItem = 27,
  Shoot = 28,
  Slot1 = 29,
  Slot2 = 30,
  Slot3 = 31,
  Slot4 = 32,
  Slot5 = 33,
}

export const SIM_ACTION_COUNT = 34;

/**
 * Physical key (KeyboardEvent.code) → semantic actions.
 * One key may emit several actions; the consuming subsystem decides which
 * apply in its context (e.g. Space = Jump on foot, Handbrake in a vehicle).
 */
export const DEFAULT_KEY_BINDINGS: Readonly<Record<string, readonly SimAction[]>> = {
  KeyW: [SimAction.MoveForward],
  ArrowUp: [SimAction.MoveForward],
  KeyS: [SimAction.MoveBackward],
  ArrowDown: [SimAction.MoveBackward],
  KeyA: [SimAction.MoveLeft],
  ArrowLeft: [SimAction.MoveLeft],
  KeyD: [SimAction.MoveRight],
  ArrowRight: [SimAction.MoveRight],
  ShiftLeft: [SimAction.Boost, SimAction.Sprint],
  ShiftRight: [SimAction.Boost, SimAction.Sprint],
  Space: [SimAction.Jump, SimAction.Handbrake, SimAction.Ascend],
  KeyC: [SimAction.Descend],
  ControlLeft: [SimAction.Descend, SimAction.Brake],
  KeyE: [SimAction.Interact],
  KeyR: [SimAction.ResetVehicle],
  KeyF: [SimAction.ToggleFlight, SimAction.Shoot],
  KeyQ: [SimAction.Punch],
  KeyT: [SimAction.ToggleDampers, SimAction.ThrowItem],
  KeyX: [SimAction.WarpJump],
  Escape: [SimAction.Cancel],
  Tab: [SimAction.ToggleDiagnostics],
  KeyG: [SimAction.ToggleSettings],
  KeyV: [SimAction.FirstPerson],
  KeyM: [SimAction.ToggleAudio],
  F1: [SimAction.FirstPerson],
  Digit1: [SimAction.SelectMetropolis],
  Digit2: [SimAction.SelectLowGravity],
  Digit3: [SimAction.SelectOrbital],
  Digit4: [SimAction.SelectDeepSpace],
  Digit5: [SimAction.SelectLab],
};

/** Keys that must not trigger browser behaviour while bound. */
export const PREVENT_DEFAULT_KEYS: ReadonlySet<string> = new Set([
  "Tab",
  "F1",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export const MODE_SELECT_ACTIONS: Readonly<Record<number, SimAction>> = {
  [SimAction.SelectMetropolis]: SimAction.SelectMetropolis,
};
