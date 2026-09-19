export function assertFiniteNumber(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new Error(`Non-finite number detected: ${name} = ${v}`)
}
export function assertFiniteVector3(name: string, v: { x: number; y: number; z: number }): void {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
    throw new Error(`Non-finite vector detected: ${name} = (${v.x}, ${v.y}, ${v.z})`)
  }
}
export function assertInRange(name: string, v: number, min: number, max: number): void {
  if (v < min || v > max) throw new Error(`${name} out of range [${min}, ${max}]: ${v}`)
}
