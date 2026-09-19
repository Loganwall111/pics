import { DEFAULT_KEY_BINDINGS, PREVENT_DEFAULT_KEYS, SIM_ACTION_COUNT, SimAction } from "./actions";
import { deadzone } from "@/lib/math/Curve";
import { clamp } from "@/lib/math/Scalar";

/**
 * Centralised input layer (specification §19).
 *
 * Attaches DOM listeners once, translates hardware events into semantic
 * actions and analog axes, and exposes edge-triggered queries.
 * Consumers call `endFrame()` exactly once per rendered frame (done by the
 * SimulationLoop) to clear pressed/look accumulators.
 *
 * Gamepad: polled from `navigator.getGamepads()` in `update()` so controllers
 * work without event plumbing; layout follows the standard mapping.
 */
export class InputManager {
  /** Actions currently held (bitpacked via index). */
  readonly held: Uint8Array = new Uint8Array(SIM_ACTION_COUNT);
  /** Actions pressed during the current frame (edge). */
  private readonly pressed = new Uint8Array(SIM_ACTION_COUNT);

  moveX = 0; // strafe / steer axis, -1..1
  moveY = 0; // forward axis, -1..1
  lookX = 0; // pointer drag delta (radians-ish), reset each frame
  lookY = 0;
  zoomDelta = 0; // wheel accumulations this frame

  private readonly keyToActions = new Map<string, readonly SimAction[]>();
  private domElement: HTMLElement | null = null;
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private gamepadConnected = false;
  private attached = false;

  constructor() {
    for (const [code, actions] of Object.entries(DEFAULT_KEY_BINDINGS)) {
      this.keyToActions.set(code, actions);
    }
  }

  attach(domElement: HTMLElement): void {
    if (this.attached) this.detach();
    this.attached = true;
    this.domElement = domElement;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearAll);
    domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    domElement.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("gamepadconnected", this.onGamepadConnected);
  }

  detach(): void {
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearAll);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("gamepadconnected", this.onGamepadConnected);
    if (this.domElement) {
      this.domElement.removeEventListener("pointerdown", this.onPointerDown);
      this.domElement.removeEventListener("wheel", this.onWheel);
      this.domElement = null;
    }
    this.clearAll();
  }

  isDown(action: SimAction): boolean {
    return this.held[action] === 1;
  }

  /** Edge-triggered: true only on the frame the action was first pressed. */
  wasPressed(action: SimAction): boolean {
    return this.pressed[action] === 1;
  }

  /** Poll gamepads and fold controller state into the same action buffers. */
  update(): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      this.gamepadConnected = true;
      const dz = 0.16;
      const lx = deadzone(pad.axes[0] ?? 0, dz);
      const ly = deadzone(pad.axes[1] ?? 0, dz);
      const rx = deadzone(pad.axes[2] ?? 0, dz);
      const ry = deadzone(pad.axes[3] ?? 0, dz);
      this.foldAxis(lx, ly, SimAction.MoveRight, SimAction.MoveLeft, SimAction.MoveForward, SimAction.MoveBackward);
      this.lookX += rx * 0.045;
      this.lookY += ry * 0.03;
      this.setPadEdge(pad.buttons[0]?.pressed, SimAction.Jump);
      this.setPadEdge(pad.buttons[2]?.pressed, SimAction.Interact);
      this.setPadEdge(pad.buttons[3]?.pressed, SimAction.ToggleFlight);
      this.setPadHeld(pad.buttons[7]?.value ?? 0, SimAction.Boost);
      this.setPadHeld(pad.buttons[6]?.value ?? 0, SimAction.Brake);
      this.setPadEdge(pad.buttons[5]?.pressed, SimAction.ResetVehicle);
      this.setPadEdge(pad.buttons[4]?.pressed, SimAction.Handbrake);
      break; // single controller support is sufficient
    }
    // Compose move axes from held keyboard actions (gamepad already added).
    const kx = (this.isDown(SimAction.MoveRight) ? 1 : 0) - (this.isDown(SimAction.MoveLeft) ? 1 : 0);
    const ky = (this.isDown(SimAction.MoveForward) ? 1 : 0) - (this.isDown(SimAction.MoveBackward) ? 1 : 0);
    this.moveX = clamp(kx + this.padMoveX, -1, 1);
    this.moveY = clamp(ky + this.padMoveY, -1, 1);
  }

  private padMoveX = 0;
  private padMoveY = 0;

  /** Clear per-frame accumulators. Called by the SimulationLoop. */
  endFrame(): void {
    this.pressed.fill(0);
    this.lookX = 0;
    this.lookY = 0;
    this.zoomDelta = 0;
  }

  get isGamepadConnected(): boolean {
    return this.gamepadConnected;
  }

  get isDraggingPointer(): boolean {
    return this.dragging;
  }

  clearAll(): void {
    this.held.fill(0);
    this.pressed.fill(0);
    this.moveX = 0;
    this.moveY = 0;
    this.dragging = false;
  }

  private foldAxis(
    x: number,
    y: number,
    right: SimAction,
    left: SimAction,
    forward: SimAction,
    backward: SimAction
  ): void {
    this.padMoveX = x;
    this.padMoveY = -y;
    this.held[right] = x > 0.01 ? 1 : (this.held[right] ?? 0);
    this.held[left] = x < -0.01 ? 1 : (this.held[left] ?? 0);
    this.held[forward] = -y > 0.01 ? 1 : (this.held[forward] ?? 0);
    this.held[backward] = -y < -0.01 ? 1 : (this.held[backward] ?? 0);
  }

  private setPadHeld(value: number, action: SimAction): void {
    if (value > 0.1) {
      if (this.held[action] === 0) this.pressed[action] = 1;
      this.held[action] = 1;
    } else {
      this.held[action] = 0;
    }
  }

  private setPadEdge(pressed: boolean | undefined, action: SimAction): void {
    if (pressed) {
      if (this.held[action] === 0) this.pressed[action] = 1;
      this.held[action] = 1;
    } else {
      this.held[action] = 0;
    }
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const actions = this.keyToActions.get(e.code);
    if (!actions) return;
    if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
    for (const action of actions) {
      if (this.held[action] === 0) this.pressed[action] = 1;
      this.held[action] = 1;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const actions = this.keyToActions.get(e.code);
    if (!actions) return;
    for (const action of actions) this.held[action] = 0;
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.lookX += (e.clientX - this.lastPointerX) * 0.0042;
    this.lookY += (e.clientY - this.lastPointerY) * 0.0034;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomDelta += clamp(e.deltaY * 0.01, -2, 2);
  };

  private readonly onGamepadConnected = (): void => {
    this.gamepadConnected = true;
  };
}

/** Application-wide singleton; attached once by the InputSystem component. */
export const inputManager = new InputManager();
