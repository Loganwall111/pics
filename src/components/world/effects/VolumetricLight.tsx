/**
 * Volumetric Light / God Rays - Multi-pass postprocessing
 * Uses @react-three/postprocessing GodRays where available, with fallback
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer, Bloom, Vignette, ToneMapping, GodRays } from '@react-three/postprocessing'
import { useGameStore } from '@/state/stores/useGameStore'
import { getQualityProfile } from '@/state/stores/qualityProfiles'

export function VolumetricPostProcessing({ sunRef }: { sunRef?: React.RefObject<THREE.Mesh> }) {
  const quality = useGameStore(s => s.quality)
  const enableVolumetrics = useGameStore(s => s.enableVolumetrics)
  const profile = getQualityProfile(quality)

  const godRaysSun = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshBasicMaterial({ color: '#ffffff' })
    )
    mesh.position.set(50, 80, 30)
    return mesh
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    // Animate sun position for god rays
    const time = useGameStore.getState().timeOfDay
    const angle = time * Math.PI * 2
    godRaysSun.position.set(
      Math.cos(angle) * 100,
      Math.sin(angle) * 100 + 50,
      30 + Math.sin(t * 0.1) * 10
    )
  })

  if (!enableVolumetrics) {
    return (
      <EffectComposer>
        <Bloom intensity={0.4} luminanceThreshold={0.9} luminanceSmoothing={0.9} />
        <ToneMapping mode={THREE.ACESFilmicToneMapping} />
      </EffectComposer>
    )
  }

  return (
    <EffectComposer multisampling={profile.postFxResolutionScale > 0.75 ? 4 : 0}>
      {quality !== 'low' && (
        <GodRays
          sun={godRaysSun as any}
          samples={profile.volumetricSamples}
          density={0.96}
          decay={0.92}
          weight={0.6}
          exposure={0.6}
          clampMax={1.0}
          blur={true}
        />
      )}
      <Bloom
        intensity={quality === 'ultra' ? 0.7 : quality === 'high' ? 0.5 : 0.3}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.1} darkness={0.3} />
      <ToneMapping mode={THREE.ACESFilmicToneMapping} />
    </EffectComposer>
  )
}
