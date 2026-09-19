/**
 * LUMITAL input — a tiny central mapper (§input parity with Aether City):
 * one document keydown/keyup listener set owned by App, translated into a
 * plain intent object read by the frame loop. Pointer drag orbits the
 * camera (yaw only — the journey is a walking game).
 */

export interface LumitalInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  /** Camera yaw, advanced by pointer drag. */
  yaw: number;
  /** One-shot events consumed by App each frame-ish via callbacks. */
  evolveRequested: boolean;
  colonyRequested: boolean;
  /** Camera toggle (V / F1): third-person ↔ first-person. */
  firstPerson: boolean;
  muted: boolean;
}

export function createLumitalInput(): { input: LumitalInput; dispose: () => void } {
  const input: LumitalInput = {
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

  const setKey = (code: string, down: boolean): void => {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        input.forward = down;
        break;
      case "KeyS":
      case "ArrowDown":
        input.back = down;
        break;
      case "KeyA":
      case "ArrowLeft":
        input.left = down;
        break;
      case "KeyD":
      case "ArrowRight":
        input.right = down;
        break;
      case "Space":
        input.jump = down;
        break;
      case "KeyE":
        if (down) input.evolveRequested = true;
        break;
      case "KeyB":
        if (down) input.colonyRequested = true;
        break;
      case "KeyV":
      case "F1":
        if (down) input.firstPerson = !input.firstPerson;
        break;
      case "KeyM":
        if (down) input.muted = !input.muted;
        break;
      default:
        break;
    }
  };

  let dragging = false;
  let lastX = 0;

  const onKeyDown = (e: KeyboardEvent): void => setKey(e.code, true);
  const onKeyUp = (e: KeyboardEvent): void => setKey(e.code, false);
  const onDown = (e: PointerEvent): void => {
    dragging = true;
    lastX = e.clientX;
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    input.yaw -= (e.clientX - lastX) * 0.006;
    lastX = e.clientX;
  };
  const onUp = (): void => {
    dragging = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  return {
    input,
    dispose: (): void => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    },
  };
}
