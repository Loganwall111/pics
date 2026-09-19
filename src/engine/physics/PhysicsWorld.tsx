/**
 * Physics Engine Integration - Rapier via @react-three/rapier
 * Implements PhysicsRuntime interface, handles stepping, gravity, raycasts
 */
import { Physics, useRapier, useAfterPhysicsStep } from '@react-three/rapier'
import type { Vector3Like } from '@/types'
import { useGameStore } from '@/state/stores/useGameStore'

function PhysicsMetrics() {
  const setMetrics = useGameStore(s => s.setMetrics)
  const { world } = useRapier()

  useAfterPhysicsStep(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).__RAPIER_WORLD__ = world
    }
    try {
      const len = (world as any).bodies?.len ? (world as any).bodies.len() : (world as any).bodies?.length ?? 0
      setMetrics({ physicsBodies: len })
    } catch {
      // ignore
    }
  })

  return null
}

export function PhysicsWorld({ children }: { children: React.ReactNode }) {
  const physicsEnabled = useGameStore(s => s.physicsEnabled)

  return (
    <Physics
      gravity={[0, -9.81, 0]}
      timeStep={1 / 60}
      paused={!physicsEnabled}
      updateLoop="follow"
      colliders={false}
      numSolverIterations={8}
    >
      <PhysicsMetrics />
      {children}
    </Physics>
  )
}

// Physics runtime abstraction for direct Rapier API access when needed
export function usePhysicsRuntime() {
  const { world, rapier } = useRapier()

  const runtime = {
    step: (deltaSeconds: number) => {
      world.step()
    },
    setGravity: (gravity: Vector3Like) => {
      world.gravity = gravity as any
    },
    raycast: (origin: Vector3Like, direction: Vector3Like, maxToi: number) => {
      const ray = new rapier.Ray(origin as any, direction as any)
      const hit = world.castRay(ray, maxToi, true)
      if (!hit) return { hit: false }
      const point = ray.pointAt(hit.timeOfImpact)
      // RayColliderHit does not expose normal directly in some versions, use collider normal if available
      const normal = (hit as any).normal ?? (hit as any).normal1 ?? undefined
      return {
        hit: true,
        point: { x: point.x, y: point.y, z: point.z },
        normal: normal ? { x: normal.x, y: normal.y, z: normal.z } : undefined
      }
    },
    reset: () => {
      // Reset logic
      console.log('[Physics] Reset requested')
    }
  }

  return runtime
}
