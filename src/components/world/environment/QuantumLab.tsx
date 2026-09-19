/**
 * Quantum / Multi-Mass Physics Laboratory
 * Isolated stress test scene: high-density rigid bodies, variable gravity, mass, spawn rate
 */
import { useState, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, BallCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useGameStore } from '@/state/stores/useGameStore'
import { SeededRandom } from '@/lib/math/seededRandom'

interface LabConfig {
  gravity: [number, number, number]
  massMultiplier: number
  spawnRate: number
  bodyCount: number
}

export function QuantumLab() {
  const simulationMode = useGameStore(s => s.simulationMode)
  const [config, setConfig] = useState<LabConfig>({
    gravity: [0, -2, 0],
    massMultiplier: 1,
    spawnRate: 5,
    bodyCount: 30
  })

  const rng = useMemo(() => new SeededRandom(42), [])
  const bodies = useMemo(() => {
    return Array.from({ length: config.bodyCount }).map((_, i) => ({
      id: i,
      pos: [rng.nextRange(-5, 5), rng.nextRange(2, 10), rng.nextRange(-5, 5)] as [number, number, number],
      color: `hsl(${rng.nextRange(180, 280)}, 80%, 60%)`,
      mass: rng.nextRange(0.5, 3) * config.massMultiplier
    }))
  }, [config.bodyCount, config.massMultiplier, rng])

  if (simulationMode !== 'LAB') return null

  return (
    <group position={[0, 5, -60]}>
      {/* Lab floor */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[20, 0.5, 20]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.8} roughness={0.2} emissive="#0a0a2a" emissiveIntensity={0.3} />
        </mesh>
      </RigidBody>

      {/* Glass walls */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[20, 10, 0.2]} />
        <meshPhysicalMaterial color="#88ccff" transparent opacity={0.1} transmission={0.9} roughness={0} />
      </mesh>

      {/* Bodies */}
      {bodies.map(b => (
        <RigidBody key={b.id} position={b.pos} mass={b.mass} colliders="ball" linearDamping={0.2}>
          <BallCollider args={[0.3]} />
          <mesh castShadow>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.3} />
          </mesh>
        </RigidBody>
      ))}

      {/* Quantum probability visualization */}
      <QuantumField />
    </group>
  )
}

function QuantumField() {
  const pointsRef = useRef<THREE.Points>(null)
  const particleCount = 500

  const positions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3)
    const rng = new SeededRandom(123)
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] = rng.nextRange(-8, 8)
      arr[i * 3 + 1] = rng.nextRange(0, 10)
      arr[i * 3 + 2] = rng.nextRange(-8, 8)
    }
    return arr
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    const t = state.clock.getElapsedTime()
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3
      const ox = positions[ix]
      const oy = positions[ix + 1]
      const oz = positions[ix + 2]
      // Probabilistic wave function visualization
      pos.array[ix] = ox + Math.sin(t + i * 0.1) * 0.5
      pos.array[ix + 1] = oy + Math.cos(t * 0.7 + i * 0.05) * 0.3
      pos.array[ix + 2] = oz + Math.sin(t * 0.5 + i * 0.08) * 0.5
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#00ffff" transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}
