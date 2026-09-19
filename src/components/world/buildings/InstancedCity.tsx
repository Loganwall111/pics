/**
 * Procedural Metropolitan Environment - Instanced City
 * Uses InstancedMesh for GPU-efficient building rendering
 * Seeded deterministic generation
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { SeededRandom } from '@/lib/math/seededRandom'
import type { CityConfig, BuildingInstanceData } from '@/types'
import { generateWindowTexture } from '@/lib/utilities/textureGenerator'
import { useGameStore } from '@/state/stores/useGameStore'
import { getQualityProfile } from '@/state/stores/qualityProfiles'

const BUILDING_ARCHETYPES = [
  { w: 12, d: 12, h: 30, color: '#2a2f3f' },
  { w: 15, d: 10, h: 45, color: '#3a3f4f' },
  { w: 20, d: 15, h: 60, color: '#4a4a5a' },
  { w: 10, d: 10, h: 80, color: '#2f3a4a' },
  { w: 25, d: 20, h: 35, color: '#3f3a35' },
  { w: 18, d: 12, h: 50, color: '#353a4f' }
]

function generateCityData(config: CityConfig): BuildingInstanceData[] {
  const rng = new SeededRandom(config.seed)
  const buildings: BuildingInstanceData[] = []

  const halfX = (config.blocksX * config.blockSize) / 2
  const halfZ = (config.blocksZ * config.blockSize) / 2

  for (let bx = -config.blocksX / 2; bx < config.blocksX / 2; bx++) {
    for (let bz = -config.blocksZ / 2; bz < config.blocksZ / 2; bz++) {
      // Skip center area for player spawn and roads
      const centerX = bx * config.blockSize
      const centerZ = bz * config.blockSize
      const distFromCenter = Math.sqrt(centerX * centerX + centerZ * centerZ)
      if (distFromCenter < 25) continue // keep city center open
      if (Math.abs(centerX) < 12 && Math.abs(centerZ) < 200) continue // road corridor

      if (rng.next() > config.buildingDensity) continue

      const archetype = rng.nextInt(0, BUILDING_ARCHETYPES.length - 1)
      const arch = BUILDING_ARCHETYPES[archetype]

      const heightVar = rng.nextRange(config.minBuildingHeight, config.maxBuildingHeight)
      const h = arch.h * (0.5 + heightVar * 0.01) * rng.nextRange(0.8, 1.4)

      const x = centerX + rng.nextRange(-config.blockSize * 0.3, config.blockSize * 0.3)
      const z = centerZ + rng.nextRange(-config.blockSize * 0.3, config.blockSize * 0.3)

      buildings.push({
        position: { x, y: h / 2, z },
        scale: { x: arch.w * rng.nextRange(0.8, 1.2), y: h, z: arch.d * rng.nextRange(0.8, 1.2) },
        rotationY: rng.next() > 0.8 ? rng.nextRange(0, Math.PI * 0.5) : 0,
        archetype,
        colorVariation: rng.next(),
        windowDensity: rng.nextRange(0.6, 1.0),
        emissiveIntensity: rng.nextRange(0.3, 1.2)
      })
    }
  }

  return buildings
}

export function InstancedCity({ config }: { config?: Partial<CityConfig> }) {
  const fullConfig: CityConfig = useMemo(() => ({
    seed: 1337,
    blocksX: 20,
    blocksZ: 20,
    blockSize: 40,
    streetWidth: 12,
    buildingDensity: 0.85,
    maxBuildingHeight: 100,
    minBuildingHeight: 20,
    ...config
  }), [config])

  const quality = useGameStore(s => s.quality)
  const profile = getQualityProfile(quality)

  const buildings = useMemo(() => generateCityData(fullConfig), [fullConfig])
  const visibleBuildings = useMemo(() => {
    return buildings.filter(b => {
      const dist = Math.sqrt(b.position.x * b.position.x + b.position.z * b.position.z)
      return dist < profile.buildingRenderDistance
    })
  }, [buildings, profile.buildingRenderDistance])

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const windowTexture = useMemo(() => generateWindowTexture(512), [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorArray = useMemo(() => {
    const colors: number[] = []
    visibleBuildings.forEach(b => {
      const base = new THREE.Color(BUILDING_ARCHETYPES[b.archetype].color)
      base.offsetHSL((b.colorVariation - 0.5) * 0.1, 0, (b.colorVariation - 0.5) * 0.2)
      colors.push(base.r, base.g, base.b)
    })
    return new Float32Array(colors)
  }, [visibleBuildings])

  useLayoutEffect(() => {
    if (!meshRef.current) return
    const mesh = meshRef.current

    visibleBuildings.forEach((b, i) => {
      dummy.position.set(b.position.x, b.position.y, b.position.z)
      dummy.scale.set(b.scale.x / BUILDING_ARCHETYPES[b.archetype].w, 1, b.scale.z / BUILDING_ARCHETYPES[b.archetype].d)
      dummy.rotation.set(0, b.rotationY, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const color = new THREE.Color()
      color.fromArray(colorArray, i * 3)
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = visibleBuildings.length
    mesh.frustumCulled = true
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [visibleBuildings, dummy, colorArray])

  // Animate emissive flicker for window lights
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame((state) => {
    if (!materialRef.current) return
    const t = state.clock.getElapsedTime()
    // subtle emissive pulse for city life
    materialRef.current.emissiveIntensity = 0.8 + Math.sin(t * 0.5) * 0.1
  })

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, visibleBuildings.length]}
        castShadow
        receiveShadow
        frustumCulled
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={materialRef}
          roughness={0.7}
          metalness={0.2}
          emissiveMap={windowTexture}
          emissive={new THREE.Color('#ffcc66')}
          emissiveIntensity={0.8}
          vertexColors
        />
      </instancedMesh>

      {/* Additional detailed buildings near player */}
      {visibleBuildings.slice(0, 20).map((b, i) => (
        <DetailedBuilding key={`detail-${i}`} data={b} />
      ))}

      {/* Trees along sidewalk like InZOI */}
      <TreeLine />
    </group>
  )
}

function DetailedBuilding({ data }: { data: BuildingInstanceData }) {
  const dist = Math.sqrt(data.position.x * data.position.x + data.position.z * data.position.z)
  if (dist > 100) return null

  return (
    <group position={[data.position.x, 0, data.position.z]} rotation={[0, data.rotationY, 0]}>
      {/* Antenna */}
      {data.scale.y > 50 && (
        <mesh position={[0, data.scale.y + 2, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
        </mesh>
      )}
      {/* Rooftop AC units */}
      <mesh position={[data.scale.x * 0.2, data.scale.y + 0.5, data.scale.z * 0.2]}>
        <boxGeometry args={[2, 1, 2]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
    </group>
  )
}

function TreeLine() {
  const trees = useMemo(() => {
    const arr: { x: number; z: number; scale: number }[] = []
    for (let z = -500; z < 500; z += 12) {
      if (Math.abs(z) < 10) continue
      arr.push({ x: 6.5, z: z + (Math.random() - 0.5) * 2, scale: 0.8 + Math.random() * 0.6 })
      arr.push({ x: -6.5, z: z + (Math.random() - 0.5) * 2, scale: 0.8 + Math.random() * 0.6 })
    }
    return arr
  }, [])

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={[t.scale, t.scale, t.scale]}>
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 4]} />
            <meshStandardMaterial color="#3d2817" roughness={0.9} />
          </mesh>
          <mesh position={[0, 4.5, 0]} castShadow>
            <sphereGeometry args={[1.5, 8, 8]} />
            <meshStandardMaterial color="#2d5a27" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
