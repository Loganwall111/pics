import type { Vector3Like } from '@/types'

export function vec3(x = 0, y = 0, z = 0): Vector3Like { return { x, y, z } }

export function add(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}
export function sub(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
export function scale(v: Vector3Like, s: number): Vector3Like {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}
export function dot(a: Vector3Like, b: Vector3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
export function length(v: Vector3Like): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}
export function normalize(v: Vector3Like): Vector3Like {
  const l = length(v)
  if (l < 1e-8) return { x: 0, y: 0, z: 0 }
  return scale(v, 1 / l)
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
export function lerpVec(a: Vector3Like, b: Vector3Like, t: number): Vector3Like {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
}
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
export function smoothDamp(current: number, target: number, velocity: { value: number }, smoothTime: number, delta: number): number {
  const omega = 2 / Math.max(0.0001, smoothTime)
  const x = omega * delta
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - target
  const temp = (velocity.value + omega * change) * delta
  velocity.value = (velocity.value - omega * temp) * exp
  const result = target + (change + temp) * exp
  if ((target - current > 0) === (result > target)) {
    velocity.value = (result - target) / delta
    return target
  }
  return result
}
