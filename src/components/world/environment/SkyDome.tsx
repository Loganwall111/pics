/**
 * SkyDome - Procedural sky shader with Rayleigh/Mie scattering
 * Uses custom shader material from shaders/sky/skyShader.ts
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createSkyMaterial } from '@/shaders/sky/skyShader'
import { useGameStore } from '@/state/stores/useGameStore'

export function SkyDome() {
  const meshRef = useRef<THREE.Mesh>(null)
  const material = useMemo(() => createSkyMaterial(), [])
  const timeOfDay = useGameStore(s => s.timeOfDay)
  const sunDir = useGameStore(s => s.sunDirection)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    material.uniforms.u_globalTime.value = t
    material.uniforms.u_timeOfDay.value = timeOfDay
    material.uniforms.u_sunDirection.value.set(sunDir.x, sunDir.y, sunDir.z)

    // Dynamic sun color based on timeOfDay
    const time = timeOfDay
    if (time < 0.3 || time > 0.7) {
      // sunrise/sunset warm
      material.uniforms.u_sunColor.value.set(1.0, 0.6, 0.3)
      material.uniforms.u_zenithColor.value.set(0.25, 0.15, 0.45)
      material.uniforms.u_horizonColor.value.set(0.95, 0.5, 0.35)
    } else if (time > 0.35 && time < 0.4) {
      // morning like InZOI reference 8:43am
      material.uniforms.u_sunColor.value.set(1.0, 0.95, 0.85)
      material.uniforms.u_zenithColor.value.set(0.15, 0.45, 0.9)
      material.uniforms.u_horizonColor.value.set(0.7, 0.85, 1.0)
    } else {
      material.uniforms.u_sunColor.value.set(1.0, 0.98, 0.9)
      material.uniforms.u_zenithColor.value.set(0.2, 0.5, 0.95)
      material.uniforms.u_horizonColor.value.set(0.65, 0.8, 1.0)
    }
  })

  return (
    <mesh ref={meshRef} scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
