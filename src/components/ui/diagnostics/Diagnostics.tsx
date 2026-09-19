/**
 * Developer Diagnostics Overlay
 * Shows FPS, frame time, draw calls, triangles, physics bodies, etc.
 */
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/state/stores/useGameStore'
import { getQualityProfile } from '@/state/stores/qualityProfiles'

export function DiagnosticsOverlay() {
  const showDiagnostics = useGameStore(s => s.showDiagnostics)
  const metrics = useGameStore(s => s.metrics)
  const quality = useGameStore(s => s.quality)
  const simulationMode = useGameStore(s => s.simulationMode)
  const profile = getQualityProfile(quality)
  const { gl } = useThree()
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const fpsHistory = useRef<number[]>([])

  const [localFps, setLocalFps] = useState(60)

  useFrame(() => {
    frameCount.current++
    const now = performance.now()
    const delta = now - lastTime.current
    if (delta > 500) {
      const fps = Math.round((frameCount.current * 1000) / delta)
      fpsHistory.current.push(fps)
      if (fpsHistory.current.length > 20) fpsHistory.current.shift()
      const avg = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length
      setLocalFps(Math.round(avg))
      useGameStore.getState().setMetrics({ fps: Math.round(avg), frameTime: delta / frameCount.current })
      frameCount.current = 0
      lastTime.current = now

      // Update renderer info
      const info = gl.info
      useGameStore.getState().setMetrics({
        drawCalls: info.render.calls,
        triangles: info.render.triangles
      })
    }
  })

  if (!showDiagnostics) return null

  return (
    <div style={{
      position: 'fixed',
      top: 60,
      left: 20,
      background: 'rgba(0,0,0,0.75)',
      color: '#00ff88',
      fontFamily: 'monospace',
      fontSize: 11,
      padding: '10px 12px',
      borderRadius: 8,
      lineHeight: 1.5,
      pointerEvents: 'none',
      zIndex: 20,
      border: '1px solid rgba(0,255,136,0.3)',
      minWidth: 220
    }}>
      <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
        DIAGNOSTICS • {quality.toUpperCase()} • {simulationMode}
      </div>
      <div>FPS: <span style={{ color: localFps < 30 ? '#ff4444' : localFps < 50 ? '#ffaa00' : '#00ff88' }}>{localFps}</span> | Frame: {metrics.frameTime.toFixed(2)}ms</div>
      <div>Draw Calls: {metrics.drawCalls} | Tris: {(metrics.triangles / 1000).toFixed(1)}k</div>
      <div>Physics Bodies: {metrics.physicsBodies} | Step: {metrics.physicsStepTime.toFixed(2)}ms</div>
      <div>Entities: {metrics.activeEntities} | Particles: {metrics.particleCount}</div>
      <div style={{ marginTop: 6, color: '#888' }}>
        <div>Shadow: {profile.shadowMapSize}px</div>
        <div>Volumetric: {profile.volumetricSamples} samples</div>
        <div>PostFX: {(profile.postFxResolutionScale * 100).toFixed(0)}% | Aniso: {profile.maxAnisotropy}x</div>
        <div>Build Dist: {profile.buildingRenderDistance}m</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#666' }}>
        WebGL2: {gl.capabilities.isWebGL2 ? 'YES' : 'NO'} | {gl.getContext().getParameter(gl.getContext().VERSION)}
      </div>
    </div>
  )
}

export function PerformanceTracker() {
  const setMetrics = useGameStore(s => s.setMetrics)
  const { gl } = useThree()

  useEffect(() => {
    let physicsBodies = 0
    const interval = setInterval(() => {
      // @ts-ignore - rapier world access if available
      const world = (window as any).__RAPIER_WORLD__
      if (world && world.bodies) {
        physicsBodies = world.bodies.len ? world.bodies.len() : 0
      }
      setMetrics({ physicsBodies })
    }, 1000)
    return () => clearInterval(interval)
  }, [setMetrics])

  return null
}
