/**
 * FINAL - Ultra Safe + Heavy with real PBR textures, shadows, reflections
 * Fixes teleport to physics lab by adding ground colliders
 */
import { useEffect, useRef, useState, Suspense, Component, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Html, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '@/state/stores/useGameStore'
import { SimulationClockManager } from '@/engine/timing/clock'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  componentDidCatch(error: any, info: any) {
    console.error('[Crash]', error, info)
    const el = document.getElementById('error-display')
    if (el) { el.style.display = 'block'; el.textContent = `CRASH: ${error?.message}\n${error?.stack?.slice(0,1500)}` }
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ background: '#111', color: '#ff4444', padding: 20, fontFamily: 'monospace', height: '100vh', overflow: 'auto' }}><h2>Crash</h2><pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message)}</pre><button onClick={() => location.reload()} style={{ padding: '8px 16px', background: '#00ff88', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reload</button></div>
    }
    return this.props.children
  }
}

function UltraSafeScene() {
  return (
    <>
      <color attach="background" args={['#87ceeb']} />
      <PerspectiveCamera makeDefault fov={65} near={0.1} far={2000} position={[0, 6, 14]} />
      <OrbitControls enablePan minDistance={2} maxDistance={100} target={[0, 0, 0]} enableDamping dampingFactor={0.08} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <Grid args={[100, 100]} position={[0, 0, 0]} cellSize={1} cellThickness={0.5} cellColor="#ffffff" sectionSize={10} sectionColor="#00ff88" fadeDistance={50} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.01, 0]}>
        <planeGeometry args={[4, 200]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0.01, 0]}>
        <planeGeometry args={[4, 200]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>

      <group position={[0, 1, 0]}>
        <mesh position={[0, 0.8, 0]} castShadow><capsuleGeometry args={[0.3, 0.8, 4, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[0, 1.8, 0]} castShadow><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color="#ffdbac" /></mesh>
        <Html position={[0, 2.8, 0]} center><div style={{ background: '#00ff88', color: '#000', padding: '4px 10px', borderRadius: 12, fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>YOU - InZOI Style</div></Html>
      </group>

      <mesh position={[2, 0.5, 2]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={0.3} /></mesh>
      <mesh position={[-3, 0.5, 1]} castShadow><sphereGeometry args={[0.6, 16, 16]} /><meshStandardMaterial color="#00ffff" /></mesh>

      {Array.from({ length: 16 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 70
        const z = (Math.random() - 0.5) * 70
        if (Math.abs(x) < 12 && Math.abs(z) < 80) return null
        const h = 10 + Math.random() * 25
        return <mesh key={i} position={[x, h / 2, z]} castShadow><boxGeometry args={[7, h, 7]} /><meshStandardMaterial color={`hsl(${220}, 15%, ${22 + Math.random() * 10}%)`} roughness={0.8} metalness={0.1} /></mesh>
      })}

      {Array.from({ length: 24 }).map((_, i) => {
        const z = (i - 12) * 6
        return <group key={i} position={[6.5, 0, z]}><mesh position={[0, 2, 0]}><cylinderGeometry args={[0.15, 0.2, 4]} /><meshStandardMaterial color="#3d2817" /></mesh><mesh position={[0, 4.5, 0]}><sphereGeometry args={[1.1, 8, 8]} /><meshStandardMaterial color="#2d5a27" /></mesh></group>
      })}
    </>
  )
}

function HeavyScene() {
  const [comps, setComps] = useState<any>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    console.log('[Heavy] Loading PBR + Physics...')
    Promise.all([
      import('@/components/world/environment/Ground').then(m => m.Ground),
      import('@/components/world/buildings/InstancedCity').then(m => m.InstancedCity),
      import('@/components/world/environment/SkyDome').then(m => m.SkyDome),
      import('@/components/world/celestial/Sun').then(m => m.Sun),
      import('@/components/world/entities/Player').then(m => m.Player),
      import('@/components/world/entities/NPC').then(m => m.NPCManager),
      import('@/components/world/vehicles/Scooter').then(m => m.Scooter),
      import('@/engine/physics/PhysicsWorld').then(m => m.PhysicsWorld),
      import('@/components/world/effects/VolumetricLight').then(m => m.VolumetricPostProcessing),
      import('@/components/ui/hud/HUD').then(m => m.HUD),
      import('@/components/ui/dialogue/DialogueSystem').then(m => m.DialogueSystem),
    ]).then(([Ground, InstancedCity, SkyDome, Sun, Player, NPCManager, Scooter, PhysicsWorld, VolumetricPostProcessing, HUD, DialogueSystem]) => {
      setComps({ Ground, InstancedCity, SkyDome, Sun, Player, NPCManager, Scooter, PhysicsWorld, VolumetricPostProcessing, HUD, DialogueSystem })
      setLoaded(true)
      console.log('[Heavy] PBR + Physics loaded - textures, shadows, reflections active')
    }).catch(e => console.error('[Heavy] Load fail', e))
  }, [])

  if (!loaded) {
    return (
      <>
        <UltraSafeScene />
        <Html center position={[0, 5, 0]}>
          <div style={{ background: 'rgba(0,0,0,0.85)', color: '#00ff88', padding: '10px 18px', borderRadius: 24, fontFamily: 'monospace', fontSize: 12, border: '1px solid #00ff88', textAlign: 'center' }}>
            <div>Loading PBR Textures + Shadows + Reflections...</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>Photographic asphalt • Brick • Window emissive • God rays</div>
          </div>
        </Html>
      </>
    )
  }

  const { Ground, InstancedCity, SkyDome, Sun, Player, NPCManager, Scooter, PhysicsWorld, VolumetricPostProcessing, HUD, DialogueSystem } = comps

  return (
    <>
      <PerspectiveCamera makeDefault fov={65} near={0.1} far={5000} position={[0, 5, 12]} />
      <OrbitControls enablePan minDistance={2} maxDistance={80} target={[0, 1, 0]} enableDamping dampingFactor={0.08} />
      <color attach="background" args={['#87ceeb']} />
      <Sun />
      <SkyDome />
      <Suspense fallback={null}>
        <PhysicsWorld>
          <Ground withPhysics={true} />
          <InstancedCity config={{ seed: 1337, blocksX: 20, blocksZ: 20, buildingDensity: 0.9 }} />
          <Player />
          <NPCManager />
          <Scooter position={[12, 0.5, 22]} />
          <Scooter position={[-10, 0.5, -18]} />
        </PhysicsWorld>
      </Suspense>
      <fog attach="fog" args={['#a0b8d0', 80, 400]} />
      <VolumetricPostProcessing />
      {/* HUDs are outside Canvas but we can include Html HUD here for heavy */}
      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
          <HUD />
          <DialogueSystem />
        </div>
      </Html>
    </>
  )
}

export function App() {
  const quality = useGameStore(s => s.quality)
  const setQuality = useGameStore(s => s.setQuality)
  const showDiagnostics = useGameStore(s => s.showDiagnostics)
  const setConfig = useGameStore(s => s.setConfig)
  const [hasMounted, setHasMounted] = useState(false)
  const [mode, setMode] = useState<'ultra' | 'heavy'>('ultra')

  useEffect(() => {
    setHasMounted(true)
    // Stay in ultra for 1.5s to guarantee first paint, then heavy with real PBR
    const t = setTimeout(() => setMode('heavy'), 1500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') setMode(m => m === 'ultra' ? 'heavy' : 'ultra')
      if (e.code === 'F1') {
        const levels: any[] = ['low', 'medium', 'high', 'ultra']
        const idx = levels.indexOf(quality)
        setQuality(levels[(idx + 1) % levels.length])
      }
      if (e.code === 'F2') setConfig({ showDiagnostics: !showDiagnostics })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [quality, showDiagnostics, setQuality, setConfig])

  const clockRef = useRef<SimulationClockManager | null>(null)
  if (!clockRef.current) clockRef.current = new SimulationClockManager(1 / 60)

  if (!hasMounted) return <div style={{ background: '#070a14', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>Booting...</div>

  return (
    <ErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', position: 'fixed', inset: 0, overflow: 'hidden', background: '#070a14' }}>
        <div id="error-display" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'rgba(255,0,0,0.9)', color: '#fff', fontFamily: 'monospace', fontSize: 11, padding: 10, zIndex: 9999, display: 'none', maxHeight: '50vh', overflow: 'auto', whiteSpace: 'pre-wrap' }} />

        <Canvas
          shadows={true}
          dpr={quality === 'ultra' ? 1.25 : 1}
          gl={{ antialias: true, powerPreference: 'high-performance', stencil: false, depth: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.0
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.shadowMap.enabled = true
            gl.shadowMap.type = THREE.PCFSoftShadowMap
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={null}>
            {mode === 'ultra' ? <UltraSafeScene /> : <HeavyScene />}
          </Suspense>
        </Canvas>

        <div style={{ position: 'fixed', top: 20, left: 20, background: 'rgba(20,20,30,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, zIndex: 30, fontFamily: 'Inter, system-ui', fontSize: 11, color: '#fff', minWidth: 240 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>NEO-CITY SIMULATOR</div>
          <div>Mode: <span style={{ color: mode === 'ultra' ? '#00ff88' : '#ffaa00', fontWeight: 700 }}>{mode.toUpperCase()}</span> (M toggle)</div>
          <div>Quality: {quality} (F1) | Diag: F2</div>
          <div style={{ marginTop: 8, background: mode === 'ultra' ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.2)', border: '1px solid #00ff88', padding: '6px 10px', borderRadius: 20, color: '#00ff88', fontWeight: 700, fontSize: 11 }}>
            {mode === 'ultra' ? '✅ ULTRA SAFE - Solid' : '✅ HEAVY - PBR Textures + Shadows + Reflections'}
          </div>
          {mode === 'heavy' && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
              • Photographic asphalt (roughness/normal)<br />
              • Brick walls (PBR)<br />
              • Window emissive + flicker<br />
              • Shadows + god rays<br />
              • Ground collider (no teleport)
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: '#888' }}>WASD Move • Mouse Look • E Interact • Shift Sprint</div>
        </div>

        <div style={{ position: 'fixed', bottom: 20, left: 20, background: 'rgba(0,0,0,0.7)', padding: '8px 14px', borderRadius: 20, color: '#fff', fontFamily: 'monospace', fontSize: 11 }}>
          WED 8:43 AM • 21°C ⛅ • InZOI Slice • {mode} • {quality}
        </div>

        <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: 20, color: '#fff', fontSize: 11 }}>
          💰 200,000 • Press M for {mode === 'ultra' ? 'HEAVY (PBR)' : 'ULTRA (safe)'}
        </div>

        <div style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', padding: '6px 12px', borderRadius: 20, color: '#00ff88', fontSize: 10, fontFamily: 'monospace' }}>
          {mode === 'heavy' ? 'PBR ACTIVE • Shadows ON • No Lab Teleport' : 'Loading PBR in 1.5s...'}
        </div>
      </div>
    </ErrorBoundary>
  )
}
