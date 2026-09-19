/**
 * Application Shell - Main App component
 * Implements full-viewport Canvas, renderer lifecycle, resize handling, context loss
 */
import { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { PhysicsWorld } from '@/engine/physics/PhysicsWorld'
import { SkyDome } from '@/components/world/environment/SkyDome'
import { Ground } from '@/components/world/environment/Ground'
import { InstancedCity } from '@/components/world/buildings/InstancedCity'
import { Player } from '@/components/world/entities/Player'
import { NPCManager } from '@/components/world/entities/NPC'
import { Scooter } from '@/components/world/vehicles/Scooter'
import { Sun } from '@/components/world/celestial/Sun'
import { OrbitalSystem } from '@/components/world/celestial/OrbitalSystem'
import { QuantumLab } from '@/components/world/environment/QuantumLab'
import { VolumetricPostProcessing } from '@/components/world/effects/VolumetricLight'
import { HUD } from '@/components/ui/hud/HUD'
import { DiagnosticsOverlay, PerformanceTracker } from '@/components/ui/diagnostics/Diagnostics'
import { DialogueSystem } from '@/components/ui/dialogue/DialogueSystem'
import { QualityControls } from '@/components/ui/controls/QualityControls'
import { useGameStore } from '@/state/stores/useGameStore'
import { SimulationClockManager } from '@/engine/timing/clock'

function SceneContent() {
  const playerPos = useGameStore(s => s.playerPosition)
  const isInteracting = useGameStore(s => s.isInteracting)
  const fov = useGameStore(s => s.fov)
  const timeOfDay = useGameStore(s => s.timeOfDay)
  const setTimeOfDay = useGameStore(s => s.setTimeOfDay)

  // Auto time progression
  useEffect(() => {
    const interval = setInterval(() => {
      if (isInteracting) return
      // Slow time progression - full day every 10 minutes
      setTimeOfDay((timeOfDay + 0.00005) % 1)
    }, 16)
    return () => clearInterval(interval)
  }, [timeOfDay, isInteracting, setTimeOfDay])

  return (
    <>
      <PerspectiveCamera makeDefault fov={fov} near={0.1} far={5000} position={[0, 3, 8]} />
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={15}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.48}
        target={[playerPos.x, playerPos.y + 1, playerPos.z]}
        enabled={!isInteracting}
        enableDamping
        dampingFactor={0.08}
      />

      <Sun />
      <SkyDome />

      <PhysicsWorld>
        <Ground />
        <InstancedCity config={{ seed: 1337, blocksX: 24, blocksZ: 24, buildingDensity: 0.9 }} />
        <Player />
        <NPCManager />
        <Scooter position={[12, 0.5, 22]} />
        <Scooter position={[-10, 0.5, -18]} />
        <OrbitalSystem />
        <QuantumLab />
        <PerformanceTracker />
      </PhysicsWorld>

      <fog attach="fog" args={['#a0b8d0', 80, 400]} />

      <VolumetricPostProcessing />
    </>
  )
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const quality = useGameStore(s => s.quality)
  const setQuality = useGameStore(s => s.setQuality)
  const showDiagnostics = useGameStore(s => s.showDiagnostics)
  const setConfig = useGameStore(s => s.setConfig)

  // ResizeObserver for invalid/collapsed canvas detection
  useEffect(() => {
    if (!containerRef.current) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width <= 0 || height <= 0) {
          console.warn(`[Renderer] Invalid canvas size detected: ${width}x${height}`)
          return
        }
        setCanvasSize({ width, height })
      }
    })

    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Keyboard quality switching
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'F1') {
        e.preventDefault()
        const levels: Array<'low' | 'medium' | 'high' | 'ultra'> = ['low', 'medium', 'high', 'ultra']
        const idx = levels.indexOf(quality)
        const next = levels[(idx + 1) % levels.length]
        setQuality(next)
      }
      if (e.code === 'F2') {
        e.preventDefault()
        setConfig({ showDiagnostics: !showDiagnostics })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [quality, showDiagnostics, setQuality, setConfig])

  // Clock manager
  const clockRef = useRef<SimulationClockManager | null>(null)
  if (!clockRef.current) {
    clockRef.current = new SimulationClockManager(1 / 60)
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#070a14'
      }}
    >
      <Canvas
        shadows
        dpr={quality === 'ultra' ? 2 : quality === 'high' ? 1.5 : quality === 'medium' ? 1.25 : 1}
        gl={{
          antialias: quality !== 'low',
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          alpha: false
        }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          // @ts-ignore
          gl.physicallyCorrectLights = true

          // Context loss handling
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            console.warn('[Renderer] Context lost')
          })
          canvas.addEventListener('webglcontextrestored', () => {
            console.log('[Renderer] Context restored')
          })
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>

      {/* UI Layer - outside Canvas for HTML */}
      <HUD />
      <DiagnosticsOverlay />
      <DialogueSystem />
      <QualityControls />

      {/* Loading overlay */}
      <div id="loading" style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #0a0e1a, #1a1f3a)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        transition: 'opacity 0.8s',
        pointerEvents: 'none',
        opacity: 0
      }}>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>NEO-CITY SIMULATOR</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>WebGL2 • Three.js r175 • Rapier • Zustand • Postprocessing</div>
      </div>

      {/* Quality hint */}
      <div style={{ position: 'fixed', bottom: 100, right: 20, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', pointerEvents: 'none' }}>
        F1: Quality [{quality}] • F2: Diagnostics • WASD Move • E Interact
      </div>
    </div>
  )
}
