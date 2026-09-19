/**
 * HUD - InZOI-like UI overlay
 * Shows time, weather, money, controls, minimap style
 */
import { useGameStore } from '@/state/stores/useGameStore'

export function HUD() {
  const timeOfDay = useGameStore(s => s.timeOfDay)
  const quality = useGameStore(s => s.quality)
  const isOnVehicle = useGameStore(s => s.isOnVehicle)
  const playerName = useGameStore(s => s.playerName)

  // Convert timeOfDay 0-1 to clock time
  const totalMinutes = Math.floor(timeOfDay * 24 * 60)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  const day = 'WED'

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', fontFamily: 'Inter, system-ui', zIndex: 10 }}>
      {/* Top left - Time & Weather like InZOI */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.4)', padding: '8px 14px', borderRadius: 20, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1 }}>
          <div>{day}</div>
          <div style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>{displayHours}:{String(minutes).padStart(2, '0')} {ampm}</div>
        </div>
        <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>21°C</span>
          <span>⛅</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
          <button style={hudBtnStyle}>⏪</button>
          <button style={hudBtnStyle}>⏸️</button>
          <button style={hudBtnStyle}>▶️</button>
          <button style={hudBtnStyle}>⏩</button>
        </div>
      </div>

      {/* Bottom center - Action bar like InZOI */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(30,30,35,0.85)', padding: '8px 16px', borderRadius: 30, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #ff9a5c, #ff6a00)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < 8 ? '#fff' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #ffaa00', overflow: 'hidden' }}>
            <img src={`https://i.pravatar.cc/100?u=${playerName}`} style={{ width: '100%', height: '100%' }} alt="player" />
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚶</div>
        </div>
      </div>

      {/* Top right - Quality & Money */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 20, fontSize: 12, color: '#fff', backdropFilter: 'blur(8px)' }}>
          {quality.toUpperCase()} • {isOnVehicle ? '🛴 Riding' : '🚶 Walking'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>👤</div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ℹ️</div>
        </div>
        <div id="interaction-prompt" style={{ display: 'none', background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', padding: '8px 14px', borderRadius: 20, color: '#00ff88', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(10px)' }} />
        <div id="vehicle-prompt" style={{ display: 'none', background: 'rgba(126,211,33,0.15)', border: '1px solid #7ed321', padding: '8px 14px', borderRadius: 20, color: '#7ed321', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(10px)', marginTop: 4 }} />
      </div>

      {/* Bottom right - Money like InZOI */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 20, color: '#fff', fontSize: 13 }}>
          <span style={{ color: '#5af' }}>◍</span> 200,000
        </div>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 0 20px rgba(139,92,246,0.5)' }}>💬</div>
      </div>

      {/* Top center - Logo */}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, background: 'rgba(0,0,0,0.35)', padding: '6px 14px', borderRadius: 20, backdropFilter: 'blur(10px)' }}>
        <span style={{ color: '#fff', opacity: 0.7, fontSize: 12 }}>◈</span>
        <span style={{ color: '#fff', opacity: 0.7, fontSize: 12 }}>✦</span>
        <span style={{ color: '#fff', opacity: 0.7, fontSize: 12 }}>🎬</span>
        <span style={{ color: '#fff', opacity: 0.7, fontSize: 12 }}>☰</span>
      </div>

      {/* Controls hint */}
      <div style={{ position: 'absolute', bottom: 80, left: 20, background: 'rgba(0,0,0,0.4)', padding: '10px 14px', borderRadius: 12, fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, backdropFilter: 'blur(8px)' }}>
        <div><b style={{ color: '#fff' }}>WASD</b> Move • <b style={{ color: '#fff' }}>Shift</b> Sprint • <b style={{ color: '#fff' }}>E</b> Interact</div>
        <div><b style={{ color: '#fff' }}>Mouse</b> Look • <b style={{ color: '#fff' }}>Wheel</b> Zoom • <b style={{ color: '#fff' }}>ESC</b> Menu</div>
      </div>
    </div>
  )
}

const hudBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  width: 24,
  height: 24,
  borderRadius: '50%',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10
}
