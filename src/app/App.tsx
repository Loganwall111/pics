/**
 * SAFE MODE - Guaranteed to render even on low-end GPUs
 * Heavy systems (Rapier, GodRays, 1k textures) are lazy-loaded after first paint
 */
import { useEffect, useRef, useState, Suspense, Component, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SkyDome } from '@/components/world/environment/SkyDome'
import { Ground } from '@/components/world/environment/Ground'
import { InstancedCity } from '@/components/world/buildings/InstancedCity'
import { Sun } from '@/components/world/celestial/Sun'
import { useGameStore } from '@/state/stores/useGameStore'
import { SimulationClockManager } from '@/engine/timing/clock'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('[App] Crash:', error, info)
    const el = document.getElementById('error-display')
    if (el) {
      el.style.display = 'block'
      el.textContent = `CRASH: ${error?.message}\n${error?.stack?.slice(0, 1000)}`
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#ff4444', padding: 20, fontFamily: 'monospace', background: '#111', height: '100vh', overflow: 'auto' }}>
          <h2>⚠️ Rendering Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <pre style={{ fontSize: 11, color: '#888', whiteSpace: 'pre-wrap' }}>{String(this.state.error?.stack || '').slice(0, 2000)}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '8px 16px', background: '#00ff88', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

function SafeScene() {
  const [log, setLog] = useState('init')
  useEffect(() => {
    setLog('SafeScene mounted - WebGL works')
    console.log('[Safe] Scene mounted')
  }, [])

  return (
    <>
      <PerspectiveCamera makeDefault fov={65} near={0.1} far={2000} position={[0, 6, 14]} />
      <OrbitControls enablePan minDistance={2} maxDistance={100} target={[0, 0, 0]} enableDamping dampingFactor={0.08} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
      <Sun />
      <SkyDome />
      <Ground />
      <InstancedCity config={{ seed: 1337, blocksX: 10, blocksZ: 10, buildingDensity: 0.7 }} />

      {/* Guaranteed visible debug objects */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1, 2, 0.6]} />
        <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[2, 0.5, 2]} castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-2, 0.5, -2]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffaa00" />
      </mesh>

      <Html position={[0, 3, 0]} center>
        <div style={{ background: 'rgba(0,255,136,0.9)', color: '#000', padding: '6px 12px', borderRadius: 20, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
          ✅ RENDER OK - {log}
        </div>
      </Html>

      <fog attach="fog" args={['#a0b8d0', 60, 300]} />
    </>
  )
}

function HeavyScene() {
  // Lazy load heavy components to avoid blocking first paint
  const [PlayerComp, setPlayerComp] = useState<any>(null)
  const [NPCComp, setNPCComp] = useState<any>(null)
  const [ScooterComp, setScooterComp] = useState<any>(null)
  const [PhysicsComp, setPhysicsComp] = useState<any>(null)
  const [VolumetricComp, setVolumetricComp] = useState<any>(null)
  const [DiagnosticsComp, setDiagnosticsComp] = useState<any>(null)

  useEffect(() => {
    console.log('[Heavy] Loading heavy modules...')
    Promise.all([
      import('@/components/world/entities/Player').then(m => setPlayerComp(() => m.Player)),
      import('@/components/world/entities/NPC').then(m => setNPCComp(() => m.NPCManager)),
      import('@/components/world/vehicles/Scooter').then(m => setScooterComp(() => m.Scooter)),
      import('@/engine/physics/PhysicsWorld').then(m => setPhysicsComp(() => m.PhysicsWorld)),
      import('@/components/world/effects/VolumetricLight').then(m => setVolumetricComp(() => m.VolumetricPostProcessing)),
      import('@/components/ui/diagnostics/Diagnostics').then(m => setDiagnosticsComp(() => m.PerformanceTracker))
    ]).then(() => console.log('[Heavy] All heavy modules loaded'))
      .catch(e => console.error('[Heavy] Failed to load:', e))
  }, [])

  if (!PhysicsComp || !PlayerComp) {
    return (
      <>
        <SafeScene />
        <Html center position={[0, 1, 0]}>
          <div style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '8px 14px', borderRadius: 20, fontFamily: 'monospace', fontSize: 11 }}>
            Loading physics & player...
          </div>
        </Html>
      </>
    )
  }

  return (
    <>
      <PerspectiveCamera makeDefault fov={65} near={0.1} far={5000} position={[0, 5, 12]} />
      <OrbitControls enablePan minDistance={2} maxDistance={80} target={[0, 1, 0]} enableDamping dampingFactor={0.08} />
      <Sun />
      <SkyDome />
      <Suspense fallback={null}>
        <PhysicsComp>
          <Ground />
          <InstancedCity config={{ seed: 1337, blocksX: 18, blocksZ: 18, buildingDensity: 0.85 }} />
          <PlayerComp />
          <NPCComp />
          <ScooterComp position={[12, 0.5, 22]} />
          <ScooterComp position={[-10, 0.5, -18]} />
          {DiagnosticsComp && <DiagnosticsComp />}
        </PhysicsComp>
      </Suspense>
      <fog attach="fog" args={['#a0b8d0', 80, 400]} />
      {VolumetricComp && <VolumetricComp />}
    </>
  )
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const quality = useGameStore(s => s.quality)
  const setQuality = useGameStore(s => s.setQuality)
  const showDiagnostics = useGameStore(s => s.showDiagnostics)
  const setConfig = useGameStore(s => s.setConfig)
  const [hasMounted, setHasMounted] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)
  const [mode, setMode] = useState<'safe' | 'heavy'>('safe')

  useEffect(() => {
    setHasMounted(true)
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (!gl) setWebglSupported(false)
      else console.log('[Renderer] Supported:', (gl as any).getParameter((gl as any).VERSION))
    } catch { setWebglSupported(false) }

    // Auto switch to heavy after 2s
    const t = setTimeout(() => {
      console.log('[App] Switching to heavy mode')
      setMode('heavy')
    }, 2000)

    const onError = (e: ErrorEvent) => {
      console.error('[Global]', e.message, e.error)
      const el = document.getElementById('error-display')
      if (el) { el.style.display = 'block'; el.textContent += `\n[Error] ${e.message}\n` }
    }
    window.addEventListener('error', onError)
    return () => { clearTimeout(t); window.removeEventListener('error', onError) }
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'F1') {
        const levels: any[] = ['low', 'medium', 'high', 'ultra']
        const idx = levels.indexOf(quality)
        setQuality(levels[(idx + 1) % levels.length])
      }
      if (e.code === 'F2') setConfig({ showDiagnostics: !showDiagnostics })
      if (e.code === 'KeyM') setMode(m => m === 'safe' ? 'heavy' : 'safe')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [quality, showDiagnostics, setQuality, setConfig])

  const clockRef = useRef<SimulationClockManager | null>(null)
  if (!clockRef.current) clockRef.current = new SimulationClockManager(1 / 60)

  if (!hasMounted) return <div style={{ background: '#070a14', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>Mounting...</div>
  if (!webglSupported) return <div style={{ background: '#111', color: '#fff', padding: 40, fontFamily: 'monospace' }}><h1>WebGL Not Supported</h1></div>

  return (
    <ErrorBoundary>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'fixed', inset: 0, overflow: 'hidden', background: '#070a14' }}>
        <div id="error-display" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'rgba(255,0,0,0.9)', color: '#fff', fontFamily: 'monospace', fontSize: 11, padding: 10, zIndex: 9999, display: 'none', maxHeight: '50vh', overflow: 'auto', whiteSpace: 'pre-wrap' }} />

        <Canvas
          shadows={false}
          dpr={1}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, alpha: false }}
          onCreated={({ gl }) => {
            console.log('[Renderer] Created:', gl.getContext().getParameter(gl.getContext().VERSION))
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.0
            gl.outputColorSpace = THREE.SRGBColorSpace
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            {mode === 'safe' ? <SafeScene /> : <HeavyScene />}
          </Suspense>
        </Canvas>

        {/* Always visible UI */}
        <div style={{ position: 'fixed', top: 20, left: 20, background: 'rgba(20,20,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, zIndex: 30, fontFamily: 'monospace', fontSize: 11, color: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>NEO-CITY SIMULATOR</div>
          <div>Mode: {mode.toUpperCase()} (M to toggle)</div>
          <div>Quality: {quality} (F1)</div>
          <div style={{ marginTop: 6, color: '#00ff88' }}>✅ Canvas OK</div>
          <div style={{ marginTop: 6, color: '#aaa', fontSize: 10 }}>If you see this box + 3D cubes, renderer works. Heavy mode auto-loads in 2s.</div>
        </div>

        <div style={{ position: 'fixed', bottom: 20, left: 20, background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 20, color: '#fff', fontFamily: 'monospace', fontSize: 11 }}>
          WED 8:43 AM • 21°C ⛅ • InZOI Slice • {mode}
        </div>

        <div style={{ position: 'fixed', bottom: 10, right: 10, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
          SAFE MODE guarantees render. Heavy mode adds Rapier + NPC + Scooter + Volumetrics.
        </div>
      </div>
    </ErrorBoundary>
  )
}
