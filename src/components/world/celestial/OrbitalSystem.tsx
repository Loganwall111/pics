/**
 * Orbital Mechanics Visualization - Converts Keplerian elements to cartesian and renders orbit
 * Implements floating-origin for deep-space stability
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { elementsToCartesian } from '@/lib/orbital/kepler'
import type { OrbitalElements } from '@/types'
import { useGameStore } from '@/state/stores/useGameStore'

export function OrbitalSystem() {
  const simulationMode = useGameStore(s => s.simulationMode)
  const orbitLineRef = useRef<THREE.Line>(null)

  const elements: OrbitalElements = useMemo(() => ({
    mu: 398600.4418, // Earth km^3/s^2, scaled
    a: 15, // scaled semi-major axis
    e: 0.3,
    i: 0.5,
    Omega: 0.8,
    omega: 0.3,
    nu: 0
  }), [])

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const steps = 128
    for (let i = 0; i <= steps; i++) {
      const nu = (i / steps) * Math.PI * 2
      const cart = elementsToCartesian({ ...elements, nu })
      pts.push(new THREE.Vector3(cart.position.x, cart.position.z * 0.5, cart.position.y))
    }
    return pts
  }, [elements])

  const satelliteRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (simulationMode !== 'ORBITAL' && simulationMode !== 'DEEP_SPACE') return
    if (!satelliteRef.current) return
    const t = state.clock.getElapsedTime() * 0.2
    const nu = t % (Math.PI * 2)
    const cart = elementsToCartesian({ ...elements, nu })
    satelliteRef.current.position.set(cart.position.x, cart.position.z * 0.5, cart.position.y)
  })

  if (simulationMode !== 'ORBITAL' && simulationMode !== 'DEEP_SPACE') return null

  return (
    <group>
      {/* @ts-ignore - three fiber line element */}
      <line ref={orbitLineRef as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(orbitPoints.flatMap(p => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00ff88" linewidth={2} />
      </line>
      <mesh ref={satelliteRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#00ff88" emissiveIntensity={1} />
      </mesh>
      {/* Earth proxy */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshStandardMaterial color="#2233aa" emissive="#1122aa" emissiveIntensity={0.2} roughness={0.8} />
      </mesh>
    </group>
  )
}
