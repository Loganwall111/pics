/**
 * Dialogue Engine - Modular dialogue processor with typewriter animation
 */
import { useEffect, useState, useRef } from 'react'
import { useGameStore } from '@/state/stores/useGameStore'

export function DialogueSystem() {
  const isOpen = useGameStore(s => s.isDialogueOpen)
  const dialogue = useGameStore(s => s.currentDialogue)
  const currentNPC = useGameStore(s => s.currentNPC)
  const endInteraction = useGameStore(s => s.endInteraction)
  const setDialogue = useGameStore(s => s.setDialogue)

  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [canSkip, setCanSkip] = useState(false)
  const typewriterRef = useRef<number | null>(null)
  const fullTextRef = useRef('')

  useEffect(() => {
    if (!dialogue) {
      setDisplayedText('')
      return
    }

    fullTextRef.current = dialogue.text
    setDisplayedText('')
    setIsTyping(true)
    setCanSkip(false)

    let index = 0
    const speed = 25 // ms per char

    const type = () => {
      if (index < fullTextRef.current.length) {
        setDisplayedText(fullTextRef.current.slice(0, index + 1))
        index++
        typewriterRef.current = window.setTimeout(type, speed)
      } else {
        setIsTyping(false)
        setCanSkip(true)
      }
    }

    // Allow skip after 300ms
    setTimeout(() => setCanSkip(true), 300)
    type()

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current)
    }
  }, [dialogue])

  const handleNext = () => {
    if (isTyping) {
      // Instant reveal
      if (typewriterRef.current) clearTimeout(typewriterRef.current)
      setDisplayedText(fullTextRef.current)
      setIsTyping(false)
      setCanSkip(true)
      return
    }

    if (dialogue?.nextId) {
      // For demo, just cycle through same NPC's next dialogue
      // In real implementation, fetch next from DB
      const nextTexts: Record<string, { speaker: string; text: string; nextId?: string }> = {
        'greeting_01_1': { speaker: 'Mina', text: 'I’m testing the new PBR sidewalk shaders. Photographic concrete, real displacement. Want a coffee while you explore? The scooter over there is free to use — just press E near it.' },
        'city_info_1': { speaker: 'Jun', text: 'We use floating-origin for deep-space mode, but here in Metropolitan mode it’s pure raycast physics. Rapier WASM handling 60 FPS. Press Shift to sprint, WASD to move.' },
        'scooter_rental_1': { speaker: 'Luna', text: 'Hop on and boost! It’s got aerodynamic drag and everything. Just walk up and press E. The city is yours.' },
        'quantum_lab_1': { speaker: 'Dr. Chen', text: 'We’re visualizing probabilistic distributions — not real quantum mechanics, but deterministic seeded probability. Press E again to close.' },
        'orbital_1': { speaker: 'Aya', text: 'The sky shader does Rayleigh + Mie scattering mathematically, not texture swapping. Turquoise Phase 5, Purple Phase — all procedural. Ready for launch?' }
      }

      const next = nextTexts[dialogue.nextId]
      if (next) {
        setDialogue({
          id: dialogue.nextId,
          speaker: next.speaker,
          text: next.text,
          nextId: next.nextId
        })
        return
      }
    }

    // End dialogue
    endInteraction()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      handleNext()
    } else if (e.code === 'Escape') {
      endInteraction()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, dialogue, isTyping])

  if (!isOpen || !dialogue || !currentNPC) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0 0 100px 0',
      zIndex: 50,
      pointerEvents: 'auto',
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{
        width: '90%',
        maxWidth: 800,
        background: 'linear-gradient(135deg, rgba(20,20,30,0.95), rgba(35,35,50,0.95))',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 20,
        padding: '20px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
        backdropFilter: 'blur(20px)'
      }}>
        {/* Speaker header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
            <img src={`https://i.pravatar.cc/100?u=${currentNPC.id}`} alt={dialogue.speaker} style={{ width: '100%', height: '100%' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{dialogue.speaker}</div>
            <div style={{ color: '#aaa', fontSize: 12 }}>{currentNPC.role} • {currentNPC.id}</div>
          </div>
          <div style={{ marginLeft: 'auto', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', padding: '4px 10px', borderRadius: 20, color: '#00ff88', fontSize: 11, fontWeight: 600 }}>
            ● LIVE DIALOGUE
          </div>
        </div>

        {/* Text with typewriter */}
        <div style={{ color: '#e8e8f0', fontSize: 15, lineHeight: 1.6, minHeight: 60, fontFamily: 'Inter, system-ui' }}>
          {displayedText}
          {isTyping && <span style={{ animation: 'blink 1s infinite', marginLeft: 2 }}>▌</span>}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#666', fontSize: 11 }}>
            {isTyping ? 'Press E / Space to skip • ' : ''}E / Space for next • ESC to close
          </div>
          <button
            onClick={handleNext}
            style={{
              background: isTyping ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #00ff88, #00cc6a)',
              color: isTyping ? '#aaa' : '#000',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {isTyping ? 'Skip ▶▶' : dialogue.nextId ? 'Next →' : 'Close ✓'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }
      `}</style>
    </div>
  )
}
