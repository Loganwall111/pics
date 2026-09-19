/**
 * PBR Metropolitan Ground - Photographic textures, with physics collider to prevent teleport/fall
 */
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { generateAsphaltTexture, generateConcreteTexture, generateBrickTexture } from '@/lib/utilities/textureGenerator'
import { useGameStore } from '@/state/stores/useGameStore'

export function Ground({ withPhysics = true }: { withPhysics?: boolean }) {
  const quality = useGameStore(s => s.quality)

  const textures = useMemo(() => {
    const size = quality === 'ultra' ? 512 : quality === 'high' ? 256 : 128
    const asphalt = generateAsphaltTexture(size)
    const concrete = generateConcreteTexture(128)
    const brick = generateBrickTexture(128)
    return { asphalt, concrete, brick }
  }, [quality])

  useEffect(() => {
    return () => {
      Object.values(textures).forEach(group => {
        Object.values(group).forEach(tex => {
          if (tex instanceof THREE.Texture) tex.dispose()
        })
      })
    }
  }, [textures])

  const groundVisual = (
    <group>
      {/* Main road - PBR asphalt with reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial
          map={textures.asphalt.color}
          roughnessMap={textures.asphalt.roughness}
          normalMap={textures.asphalt.normal}
          roughness={0.85}
          metalness={0.08}
          normalScale={new THREE.Vector2(0.6, 0.6)}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* Sidewalks - concrete with roughness */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4, 2000]} />
        <meshStandardMaterial map={textures.concrete.color} roughness={0.9} metalness={0} color="#d8d8dc" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.02, 0]} receiveShadow>
        <planeGeometry args={[4, 2000]} />
        <meshStandardMaterial map={textures.concrete.color} roughness={0.9} metalness={0} color="#d8d8dc" />
      </mesh>

      <BrickWall position={[10.5, 0.6, 0]} length={300} height={1.2} texture={textures.brick} />
      <BrickWall position={[-10.5, 0.6, 0]} length={300} height={1.2} texture={textures.brick} rotation={Math.PI} />
      <RoadMarkings />
    </group>
  )

  if (!withPhysics) return groundVisual

  return (
    <>
      {/* Physics collider - prevents teleport/fall through */}
      <RigidBody type="fixed" colliders={false} position={[0, -0.5, 0]}>
        <CuboidCollider args={[1000, 0.5, 1000]} />
      </RigidBody>
      {/* Sidewalk colliders */}
      <RigidBody type="fixed" colliders={false} position={[8, 0, 0]}>
        <CuboidCollider args={[2, 0.5, 1000]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[-8, 0, 0]}>
        <CuboidCollider args={[2, 0.5, 1000]} />
      </RigidBody>
      {groundVisual}
    </>
  )
}

function BrickWall({ position, length, height, texture, rotation = 0 }: { position: [number, number, number], length: number, height: number, texture: any, rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.3, height, length]} />
          <meshStandardMaterial map={texture.color} roughnessMap={texture.roughness} normalMap={texture.normal} roughness={0.8} metalness={0.05} />
        </mesh>
      </RigidBody>
    </group>
  )
}

function RoadMarkings() {
  const markings = useMemo(() => {
    const arr: { pos: [number, number, number] }[] = []
    for (let z = -500; z < 500; z += 6) arr.push({ pos: [0, 0.01, z] })
    return arr
  }, [])

  return (
    <group>
      {markings.map((m, i) => (
        <mesh key={i} position={m.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 1.5]} />
          <meshStandardMaterial color="#ffffff" emissive="#333333" emissiveIntensity={0.2} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
