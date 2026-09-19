import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '@/state/stores/useGameStore'

export function Sun() {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const timeOfDay = useGameStore(s => s.timeOfDay)
  const setSunDir = useGameStore(s => s.setSunDirection)

  useFrame(() => {
    if (!lightRef.current) return
    // Convert timeOfDay 0-1 to sun angle
    // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    const angle = timeOfDay * Math.PI * 2 - Math.PI / 2 // shift so noon is overhead
    const elevation = Math.sin(angle) // -1 to 1
    const azimuth = Math.cos(angle) * 0.5

    const x = Math.cos(azimuth) * 0.8
    const y = Math.max(0.1, elevation * 0.8 + 0.3)
    const z = Math.sin(azimuth) * 0.8

    lightRef.current.position.set(x * 200, y * 200, z * 200)
    setSunDir({ x, y, z })

    // Intensity based on elevation
    const intensity = Math.max(0.1, elevation * 0.8 + 0.5) * 1.2
    lightRef.current.intensity = intensity

    // Color temperature
    if (elevation < 0.2) {
      lightRef.current.color.setHSL(0.08, 0.8, 0.6) // warm sunrise/sunset
    } else {
      lightRef.current.color.setHSL(0.12, 0.2, 1.0) // daylight
    }
  })

  return (
    <>
      <directionalLight
        ref={lightRef}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />
      <ambientLight intensity={0.35} color="#8aa0ff" />
      <hemisphereLight args={['#87ceeb', '#3a3a3a', 0.4]} />
    </>
  )
}
