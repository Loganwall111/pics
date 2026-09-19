/**
 * Spatial Query System for NPC proximity, avoiding per-frame O(n) checks
 * Simple grid-based spatial hash
 */
import type { Vector3Like } from '@/types'

interface SpatialItem<T> {
  id: string
  position: Vector3Like
  radius: number
  data: T
}

export class SpatialHash<T> {
  private cellSize: number
  private grid = new Map<string, SpatialItem<T>[]>()
  private items = new Map<string, SpatialItem<T>>()

  constructor(cellSize = 20) {
    this.cellSize = cellSize
  }

  private getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    return `${cx},${cz}`
  }

  private getCellKeysForItem(pos: Vector3Like, radius: number): string[] {
    const minX = Math.floor((pos.x - radius) / this.cellSize)
    const maxX = Math.floor((pos.x + radius) / this.cellSize)
    const minZ = Math.floor((pos.z - radius) / this.cellSize)
    const maxZ = Math.floor((pos.z + radius) / this.cellSize)
    const keys: string[] = []
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        keys.push(`${x},${z}`)
      }
    }
    return keys
  }

  insert(id: string, position: Vector3Like, radius: number, data: T): void {
    this.remove(id)
    const item: SpatialItem<T> = { id, position, radius, data }
    this.items.set(id, item)
    const keys = this.getCellKeysForItem(position, radius)
    for (const key of keys) {
      if (!this.grid.has(key)) this.grid.set(key, [])
      this.grid.get(key)!.push(item)
    }
  }

  remove(id: string): void {
    const existing = this.items.get(id)
    if (!existing) return
    const keys = this.getCellKeysForItem(existing.position, existing.radius)
    for (const key of keys) {
      const cell = this.grid.get(key)
      if (cell) {
        const idx = cell.findIndex(i => i.id === id)
        if (idx !== -1) cell.splice(idx, 1)
        if (cell.length === 0) this.grid.delete(key)
      }
    }
    this.items.delete(id)
  }

  updatePosition(id: string, newPos: Vector3Like): void {
    const item = this.items.get(id)
    if (!item) return
    // reinsert if cell changed
    const oldKeys = this.getCellKeysForItem(item.position, item.radius)
    const newKeys = this.getCellKeysForItem(newPos, item.radius)
    const oldKeySet = new Set(oldKeys)
    const newKeySet = new Set(newKeys)
    const same = oldKeys.length === newKeys.length && oldKeys.every(k => newKeySet.has(k))
    if (!same) {
      this.remove(id)
      this.insert(id, newPos, item.radius, item.data)
    } else {
      item.position = newPos
    }
  }

  queryRadius(position: Vector3Like, radius: number): SpatialItem<T>[] {
    const keys = this.getCellKeysForItem(position, radius)
    const seen = new Set<string>()
    const result: SpatialItem<T>[] = []
    for (const key of keys) {
      const cell = this.grid.get(key)
      if (!cell) continue
      for (const item of cell) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        const dx = item.position.x - position.x
        const dz = item.position.z - position.z
        const distSq = dx * dx + dz * dz
        const combinedRadius = radius + item.radius
        if (distSq <= combinedRadius * combinedRadius) {
          result.push(item)
        }
      }
    }
    return result
  }

  clear(): void {
    this.grid.clear()
    this.items.clear()
  }

  get count(): number {
    return this.items.size
  }
}
