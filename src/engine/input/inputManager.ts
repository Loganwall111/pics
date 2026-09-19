/**
 * Centralized Input Architecture
 * Translates physical inputs into semantic actions, supports rebinding and gamepad-ready abstraction
 */
import type { InputAction, InputState } from '@/types'

type KeyMap = Record<string, InputAction>

const DEFAULT_KEYMAP: KeyMap = {
  KeyW: 'MOVE_FORWARD',
  ArrowUp: 'MOVE_FORWARD',
  KeyS: 'MOVE_BACKWARD',
  ArrowDown: 'MOVE_BACKWARD',
  KeyA: 'MOVE_LEFT',
  ArrowLeft: 'MOVE_LEFT',
  KeyD: 'MOVE_RIGHT',
  ArrowRight: 'MOVE_RIGHT',
  ShiftLeft: 'BOOST',
  ShiftRight: 'BOOST',
  KeyE: 'INTERACT',
  Space: 'JUMP',
  ControlLeft: 'BRAKE',
  KeyQ: 'ASCEND',
  KeyZ: 'DESCEND'
}

export class InputManager {
  private keyMap: KeyMap = { ...DEFAULT_KEYMAP }
  private keysDown = new Set<string>()
  private actions: Record<InputAction, number> = {
    MOVE_FORWARD: 0,
    MOVE_BACKWARD: 0,
    MOVE_LEFT: 0,
    MOVE_RIGHT: 0,
    BOOST: 0,
    INTERACT: 0,
    ASCEND: 0,
    DESCEND: 0,
    BRAKE: 0,
    JUMP: 0
  }
  private pointerDelta = { x: 0, y: 0 }
  private pointerLocked = false
  private smoothing = 0.15
  private targetActions: Record<InputAction, number> = { ...this.actions }

  private listeners: Set<(state: InputState) => void> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown)
      window.addEventListener('keyup', this.onKeyUp)
      window.addEventListener('mousemove', this.onMouseMove)
      window.addEventListener('blur', this.onBlur)
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return
    this.keysDown.add(e.code)
    const action = this.keyMap[e.code]
    if (action) {
      this.targetActions[action] = 1
      if (action === 'INTERACT' || action === 'JUMP') {
        // pulse actions
        setTimeout(() => { this.targetActions[action] = 0 }, 100)
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code)
    const action = this.keyMap[e.code]
    if (action && action !== 'INTERACT' && action !== 'JUMP') {
      this.targetActions[action] = 0
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      this.pointerDelta.x += e.movementX
      this.pointerDelta.y += e.movementY
    }
  }

  private onBlur = (): void => {
    this.keysDown.clear()
    for (const k in this.targetActions) {
      this.targetActions[k as InputAction] = 0
    }
  }

  setPointerLocked(locked: boolean): void {
    this.pointerLocked = locked
  }

  // Called each frame to smooth inputs
  update(deltaSeconds: number): InputState {
    const lerpFactor = 1 - Math.exp(-deltaSeconds / this.smoothing)

    for (const action in this.actions) {
      const a = action as InputAction
      const current = this.actions[a]
      const target = this.targetActions[a]
      this.actions[a] = current + (target - current) * lerpFactor * 10
      // clamp
      if (Math.abs(this.actions[a]) < 0.001) this.actions[a] = 0
      if (this.actions[a] > 1) this.actions[a] = 1
      if (this.actions[a] < -1) this.actions[a] = -1
    }

    const state: InputState = {
      actions: { ...this.actions },
      pointerDelta: { ...this.pointerDelta },
      pointerLocked: this.pointerLocked
    }

    // reset delta after consumption
    this.pointerDelta.x = 0
    this.pointerDelta.y = 0

    this.listeners.forEach(l => l(state))
    return state
  }

  getState(): InputState {
    return {
      actions: { ...this.actions },
      pointerDelta: { ...this.pointerDelta },
      pointerLocked: this.pointerLocked
    }
  }

  subscribe(listener: (state: InputState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code)
  }

  rebind(code: string, action: InputAction): void {
    this.keyMap[code] = action
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown)
      window.removeEventListener('keyup', this.onKeyUp)
      window.removeEventListener('mousemove', this.onMouseMove)
      window.removeEventListener('blur', this.onBlur)
    }
    this.listeners.clear()
  }
}

// Singleton for ease of use in transient systems
export const globalInputManager = typeof window !== 'undefined' ? new InputManager() : null as unknown as InputManager
