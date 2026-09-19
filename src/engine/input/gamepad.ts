/**
 * Gamepad Input Abstraction - Ready for future controller support
 */
export class GamepadManager {
  private gamepads: Map<number, Gamepad> = new Map()

  update(): void {
    const gps = navigator.getGamepads()
    for (let i = 0; i < gps.length; i++) {
      const gp = gps[i]
      if (gp) this.gamepads.set(i, gp)
    }
  }

  getAxis(gamepadIndex: number, axis: number): number {
    const gp = this.gamepads.get(gamepadIndex)
    if (!gp) return 0
    return gp.axes[axis] || 0
  }

  getButton(gamepadIndex: number, button: number): number {
    const gp = this.gamepads.get(gamepadIndex)
    if (!gp) return 0
    return gp.buttons[button]?.value || 0
  }
}
