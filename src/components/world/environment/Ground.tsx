/**
 * PBR Metropolitan Ground - Asphalt / Sidewalk / Road with photographic textures
 * Uses generated textures from textureGenerator
 */
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { generateAsphaltTexture, generateConcreteTexture, generateBrickTexture } from '@/lib/utilities/textureGenerator'
import { useGameStore } from '@/state/stores/useGameStore'
import { getQualityProfile } from '@/state/stores/qualityProfiles'

export function Ground() {
  const quality = useGameStore(s => s.quality)
  const profile = getQualityProfile(quality)

  const textures = useMemo(() => {
    const asphalt = generateAsphaltTexture(1024)
    const concrete = generateConcreteTexture(512)
    const brick = generateBrickTexture(512)
    return { asphalt, concrete, brick }
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup GPU resources
      Object.values(textures).forEach(group => {
        Object.values(group).forEach(tex => {
          if (tex instanceof THREE.Texture) tex.dispose()
        })
      })
    }
  }, [textures])

  return (
    <group>
      {/* Main road - asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial
          map={textures.asphalt.color}
          roughnessMap={textures.asphalt.roughness}
          normalMap={textures.asphalt.normal}
          roughness={0.85}
          metalness={0.05}
          normalScale={new THREE.Vector2(0.5, 0.5)}
        />
      </mesh>

      {/* Sidewalk - concrete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4, 2000]} />
        <meshStandardMaterial
          map={textures.concrete.color}
          roughness={0.9}
          metalness={0}
          color="#d8d8dc"
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4, 2000]} />
        <meshStandardMaterial
          map={textures.concrete.color}
          roughness={0.9}
          metalness={0}
          color="#d8d8dc"
        />
      </mesh>

      {/* Brick walls like InZOI reference */}
      <BrickWall position={[10.5, 0.6, 0]} length={200} height={1.2} texture={textures.brick} />
      <BrickWall position={[-10.5, 0.6, 0]} length={200} height={1.2} texture={textures.brick} rotation={Math.PI} />

      {/* Road markings */}
      <RoadMarkings />
    </group>
  )
}

function BrickWall({ position, length, height, texture, rotation = 0 }: { position: [number, number, number], length: number, height: number, texture: any, rotation?: number }) {
  return (
    <mesh position={position} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.3, height, length]} />
      <meshStandardMaterial
        map={texture.color}
        roughnessMap={texture.roughness}
        normalMap={texture.normal}
        roughness={0.8}
        metalness={0.05}
      />
    </mesh>
  )
}

function RoadMarkings() {
  const markings = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: number }[] = []
    for (let z = -1000; z < 1000; z += 8) {
      arr.push({ pos: [0, 0.01, z], rot: 0 })
    }
    for (let z = -1000; z < 1000; z += 20) {
      arr.push({ pos: [-4, 0.01, z], rot: 0 })
      arr.push({ pos: [4, 0.01, z], rot: 0 })
    }
    return arr
  }, [])

  return (
    <group>
      {markings.map((m, i) => (
        <mesh key={i} position={m.pos} rotation={[-Math.PI / 2, 0, m.rot]}>
          <planeGeometry args={i % 3 === 0 ? [0.3, 2] : [0.15, 1]} />
          <meshStandardMaterial color={i < 250 ? "#ffffff" : "#ffcc00"} emissive="#222222" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
