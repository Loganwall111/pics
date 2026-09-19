/**
 * NPC Proximity & Interaction System
 * Uses SpatialHash for efficient queries, exposes interaction radius, dialogue, facing
 */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { NPCData } from '@/types'
import { useGameStore } from '@/state/stores/useGameStore'
import { globalInputManager } from '@/engine/input/inputManager'

const NPC_DEFINITIONS: NPCData[] = [
  { id: 'npc_01', position: { x: 4, y: 0, z: -8 }, interactionRadius: 2.5, dialogueId: 'greeting_01', facingYaw: Math.PI, available: true, name: 'Mina', role: 'Barista' },
  { id: 'npc_02', position: { x: -5, y: 0, z: 15 }, interactionRadius: 2.5, dialogueId: 'city_info', facingYaw: 0, available: true, name: 'Jun', role: 'Engineer' },
  { id: 'npc_03', position: { x: 12, y: 0, z: 30 }, interactionRadius: 2.5, dialogueId: 'scooter_rental', facingYaw: -Math.PI / 2, available: true, name: 'Luna', role: 'Courier' },
  { id: 'npc_04', position: { x: -8, y: 0, z: -25 }, interactionRadius: 3, dialogueId: 'quantum_lab', facingYaw: Math.PI / 4, available: true, name: 'Dr. Chen', role: 'Researcher' },
  { id: 'npc_05', position: { x: 0, y: 0, z: 45 }, interactionRadius: 2.5, dialogueId: 'orbital', facingYaw: Math.PI, available: true, name: 'Aya', role: 'Pilot' }
]

const DIALOGUE_DB: Record<string, { speaker: string; text: string; nextId?: string }[]> = {
  greeting_01: [
    { speaker: 'Mina', text: 'Oh hey! You caught me on break. This city is insane lately — did you see the new volumetric lighting update? The god rays at 8:43 AM are literally perfect.', nextId: 'greeting_02' },
    { speaker: 'Mina', text: 'I’m testing the new PBR sidewalk shaders. Photographic concrete, real displacement. Want a coffee while you explore? The scooter over there is free to use — just press E near it.' }
  ],
  city_info: [
    { speaker: 'Jun', text: 'Welcome to Neo-Seoul slice. This is procedural — seeded city generation, instanced buildings, 2000m render distance on Ultra. All running WebGL2 with Three.js r175.' },
    { speaker: 'Jun', text: 'We use floating-origin for deep-space mode, but here in Metropolitan mode it’s pure raycast physics. Rapier WASM handling 60 FPS. Press Shift to sprint, WASD to move.' }
  ],
  scooter_rental: [
    { speaker: 'Luna', text: 'That scooter? Yeah, custom raycast vehicle controller. No native Rapier vehicle API — we built suspension, steering, lateral grip from scratch. PhysicsRuntime abstraction.' },
    { speaker: 'Luna', text: 'Hop on and boost! It’s got aerodynamic drag and everything. Just walk up and press E. The city is yours.' }
  ],
  quantum_lab: [
    { speaker: 'Dr. Chen', text: 'Ah, the quantum lab. We stress test high-density rigid bodies there. Variable gravity, mass multiplier, spawn rate controls. It’s isolated from the main city for safety.' },
    { speaker: 'Dr. Chen', text: 'We’re visualizing probabilistic distributions — not real quantum mechanics, but deterministic seeded probability. Press E again to close.' }
  ],
  orbital: [
    { speaker: 'Aya', text: 'You’ve heard about orbital mode? We can switch coordinate spaces — Metropolitan to Low-Gravity to Orbital to Deep-Space. Keplerian mechanics, real μ, a, e, i, Ω, ω, ν.' },
    { speaker: 'Aya', text: 'The sky shader does Rayleigh + Mie scattering mathematically, not texture swapping. Turquoise Phase 5, Purple Phase — all procedural. Ready for launch?' }
  ]
}

export function NPCManager() {
  const playerPos = useGameStore(s => s.playerPosition)
  const isInteracting = useGameStore(s => s.isInteracting)
  const currentNPC = useGameStore(s => s.currentNPC)
  const startInteraction = useGameStore(s => s.startInteraction)
  const setDialogue = useGameStore(s => s.setDialogue)

  // Find closest NPC in radius
  useFrame(() => {
    if (isInteracting) return

    let closest: NPCData | null = null
    let minDist = Infinity

    for (const npc of NPC_DEFINITIONS) {
      const dx = npc.position.x - playerPos.x
      const dz = npc.position.z - playerPos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < npc.interactionRadius && dist < minDist) {
        minDist = dist
        closest = npc
      }
    }

    if (closest) {
      // Show interaction prompt via store or DOM
      const promptEl = document.getElementById('interaction-prompt')
      if (promptEl) {
        promptEl.style.display = 'block'
        promptEl.textContent = `Press E to talk to ${closest.name} — ${closest.role}`
      }

      const input = globalInputManager?.getState()
      if (input && input.actions.INTERACT > 0.5) {
        // Trigger dialogue
        const dialogues = DIALOGUE_DB[closest.dialogueId]
        if (dialogues && dialogues.length > 0) {
          startInteraction(closest)
          setDialogue({
            id: `${closest.dialogueId}_0`,
            speaker: dialogues[0].speaker,
            text: dialogues[0].text,
            nextId: dialogues[0].nextId ? `${closest.dialogueId}_1` : undefined
          })
          if (promptEl) promptEl.style.display = 'none'
        }
      }
    } else {
      const promptEl = document.getElementById('interaction-prompt')
      if (promptEl) promptEl.style.display = 'none'
    }
  })

  return (
    <group>
      {NPC_DEFINITIONS.map(npc => (
        <NPCEntity key={npc.id} data={npc} isCurrent={currentNPC?.id === npc.id} />
      ))}
    </group>
  )
}

function NPCEntity({ data, isCurrent }: { data: NPCData; isCurrent: boolean }) {
  const meshRef = useRef<THREE.Group>(null)
  const playerPos = useGameStore(s => s.playerPosition)

  useFrame((state) => {
    if (!meshRef.current) return
    // Face player when nearby
    const dx = playerPos.x - data.position.x
    const dz = playerPos.z - data.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 8) {
      const targetYaw = Math.atan2(dx, dz)
      meshRef.current.rotation.y += (targetYaw - meshRef.current.rotation.y) * 0.05
    } else {
      meshRef.current.rotation.y += (data.facingYaw - meshRef.current.rotation.y) * 0.02
    }

    // Bob animation
    const t = state.clock.getElapsedTime()
    meshRef.current.position.y = Math.sin(t * 0.8 + data.position.x) * 0.05
  })

  return (
    <group position={[data.position.x, 0, data.position.z]}>
      <group ref={meshRef}>
        {/* Interaction radius visualization */}
        {isCurrent && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[data.interactionRadius - 0.2, data.interactionRadius, 32]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* NPC Model - varied */}
        <NPCModel role={data.role} />

        {/* Nameplate */}
        <group position={[0, 2.3, 0]}>
          <mesh>
            <planeGeometry args={[1.2, 0.3]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function NPCModel({ role }: { role: string }) {
  const colors: Record<string, string> = {
    Barista: '#d4a373',
    Engineer: '#4a90e2',
    Courier: '#e94e77',
    Researcher: '#7ed321',
    Pilot: '#f5a623'
  }
  const color = colors[role] || '#ffffff'

  return (
    <group>
      <mesh position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.6, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Role indicator */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

export function getDialogueSequence(dialogueId: string, index: number): { speaker: string; text: string; nextId?: string } | null {
  const seq = DIALOGUE_DB[dialogueId]
  if (!seq) return null
  return seq[index] || null
}
