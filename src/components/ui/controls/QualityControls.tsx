import { useGameStore } from '@/state/stores/useGameStore'
import type { QualityLevel, SimulationMode } from '@/types'

export function QualityControls() {
  const quality = useGameStore(s => s.quality)
  const setQuality = useGameStore(s => s.setQuality)
  const simulationMode = useGameStore(s => s.simulationMode)
  const setSimulationMode = useGameStore(s => s.setSimulationMode)
  const showDiagnostics = useGameStore(s => s.showDiagnostics)
  const setConfig = useGameStore(s => s.setConfig)

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: 20,
      background: 'rgba(20,20,30,0.9)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 16,
      zIndex: 30,
      minWidth: 220,
      backdropFilter: 'blur(12px)',
      fontFamily: 'Inter, system-ui',
      fontSize: 12
    }}>
      <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12, fontSize: 13 }}>SIMULATION CONTROLS</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#aaa', marginBottom: 6 }}>Quality</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['low', 'medium', 'high', 'ultra'] as QualityLevel[]).map(q => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                border: '1px solid',
                borderColor: quality === q ? '#00ff88' : 'rgba(255,255,255,0.1)',
                background: quality === q ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                color: quality === q ? '#00ff88' : '#aaa',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#aaa', marginBottom: 6 }}>Simulation Mode</div>
        <select
          value={simulationMode}
          onChange={(e) => setSimulationMode(e.target.value as SimulationMode)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '6px 8px',
            color: '#fff',
            fontSize: 11
          }}
        >
          <option value="METROPOLITAN">METROPOLITAN / GROUND</option>
          <option value="LOW_GRAVITY">LOW-GRAVITY</option>
          <option value="ORBITAL">ORBITAL</option>
          <option value="DEEP_SPACE">DEEP-SPACE</option>
          <option value="LAB">QUANTUM LAB</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', cursor: 'pointer' }}>
          <input type="checkbox" checked={showDiagnostics} onChange={(e) => setConfig({ showDiagnostics: e.target.checked })} />
          Diagnostics Overlay (F2)
        </label>
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', color: '#666', fontSize: 10, lineHeight: 1.4 }}>
        <div>60 FPS target • WebGL2 • Three r175</div>
        <div>Instanced city • PBR asphalt • Volumetric god rays</div>
        <div>Raycast vehicle • Keplerian orbits • Spatial hash NPCs</div>
      </div>
    </div>
  )
}
