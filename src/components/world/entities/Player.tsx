/**
 * Player Controller - Third Person InZOI-like
 * Physically based capsule, smoothed input, camera follow
 * Implements movement, interaction locking during dialogue
 */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody, CapsuleCollider, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGameStore } from '@/state/stores/useGameStore'
import { globalInputManager } from '@/engine/input/inputManager'

export function Player() {
  const rbRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Group>(null)
  const isInteracting = useGameStore(s => s.isInteracting)
  const isOnVehicle = useGameStore(s => s.isOnVehicle)
  const setPlayerPos = useGameStore(s => s.setPlayerPosition)
  const setPlayerRot = useGameStore(s => s.setPlayerRotation)
  const playerPos = useGameStore(s => s.playerPosition)

  const velocity = useMemo(() => new THREE.Vector3(), [])
  const targetVelocity = useMemo(() => new THREE.Vector3(), [])
  const direction = useMemo(() => new THREE.Vector3(), [])
  const rotation = useMemo(() => ({ y: 0, target: 0, vel: { value: 0 } }), [])

  const moveSpeed = 4.5
  const boostSpeed = 7.5
  const rotationSpeed = 8

  useFrame((state, delta) => {
    if (!rbRef.current || !meshRef.current) return
    if (isInteracting || isOnVehicle) {
      // Lock movement during dialogue / vehicle
      rbRef.current.setLinvel({ x: 0, y: rbRef.current.linvel().y, z: 0 }, true)
      return
    }

    const input = globalInputManager ? globalInputManager.update(delta) : null
    const actions = input?.actions

    // InZOI-like third person movement
    let forward = 0
    let right = 0
    if (actions) {
      forward = (actions.MOVE_FORWARD || 0) - (actions.MOVE_BACKWARD || 0)
      right = (actions.MOVE_RIGHT || 0) - (actions.MOVE_LEFT || 0)
    }

    // Camera-relative movement
    const camera = state.camera
    const camForward = new THREE.Vector3()
    camera.getWorldDirection(camForward)
    camForward.y = 0
    camForward.normalize()
    const camRight = new THREE.Vector3()
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).negate()

    direction.set(0, 0, 0)
    direction.addScaledVector(camForward, forward)
    direction.addScaledVector(camRight, right)
    if (direction.length() > 1) direction.normalize()

    const isBoosting = (actions?.BOOST || 0) > 0.5
    const currentSpeed = isBoosting ? boostSpeed : moveSpeed

    targetVelocity.set(direction.x * currentSpeed, 0, direction.z * currentSpeed)

    // Smooth velocity
    const lerpFactor = 1 - Math.exp(-delta * 12)
    velocity.lerp(targetVelocity, lerpFactor)

    // Apply to rigidbody
    const currentLinvel = rbRef.current.linvel()
    rbRef.current.setLinvel({ x: velocity.x, y: currentLinvel.y, z: velocity.z }, true)

    // Rotation towards movement direction
    if (direction.length() > 0.1) {
      rotation.target = Math.atan2(direction.x, direction.z)
      let diff = rotation.target - rotation.y
      // wrap angle
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      rotation.y += diff * Math.min(1, delta * rotationSpeed)
      meshRef.current.rotation.y = rotation.y
      setPlayerRot(rotation.y)
    }

    // Update store position for NPC queries
    const pos = rbRef.current.translation()
    setPlayerPos({ x: pos.x, y: pos.y, z: pos.z })

    // Animation bob
    if (meshRef.current && velocity.length() > 0.1) {
      const t = state.clock.getElapsedTime()
      meshRef.current.position.y = Math.sin(t * (isBoosting ? 12 : 8)) * 0.05 * (velocity.length() / currentSpeed)
    }
  })

  // Reset if fallen
  useEffect(() => {
    const interval = setInterval(() => {
      if (!rbRef.current) return
      const pos = rbRef.current.translation()
      if (pos.y < -20) {
        rbRef.current.setTranslation({ x: 0, y: 2, z: 0 }, true)
        rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <RigidBody
      ref={rbRef}
      colliders={false}
      mass={70}
      type="dynamic"
      position={[0, 2, 5]}
      enabledRotations={[false, false, false]}
      linearDamping={2}
      friction={0.5}
    >
      <CapsuleCollider args={[0.8, 0.35]} position={[0, 0.8, 0]} />
      <group ref={meshRef}>
        {/* InZOI-like character - stylized realistic */}
        <CharacterModel />
      </group>
    </RigidBody>
  )
}

function CharacterModel() {
  return (
    <group>
      {/* Shadow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>

      {/* Body - white t-shirt like reference */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.6, 4, 12]} />
        <meshStandardMaterial color="#f5f5f7" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* T-shirt detail - light blue stripe like image 1 */}
      <mesh position={[0, 1.15, 0.16]} castShadow>
        <planeGeometry args={[0.5, 0.2]} />
        <meshStandardMaterial color="#c5d5e0" roughness={0.8} />
      </mesh>

      {/* Jeans - light blue like reference */}
      <group position={[0, 0.4, 0]}>
        <mesh position={[-0.12, 0, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
          <meshStandardMaterial color="#a8c0d8" roughness={0.7} />
        </mesh>
        <mesh position={[0.12, 0, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.5, 4, 8]} />
          <meshStandardMaterial color="#a8c0d8" roughness={0.7} />
        </mesh>
      </group>

      {/* Head - bob hair like reference */}
      <mesh position={[0, 1.75, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.6} />
      </mesh>
      {/* Hair - short brown bob */}
      <mesh position={[0, 1.85, -0.05]} castShadow>
        <sphereGeometry args={[0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshStandardMaterial color="#8b6a43" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.7, 0.05]} castShadow>
        <boxGeometry args={[0.65, 0.4, 0.5]} />
        <meshStandardMaterial color="#8b6a43" roughness={0.9} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.35, 1.1, 0]} rotation={[0, 0, -0.2]} castShadow>
        <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.6} />
      </mesh>
      <mesh position={[0.35, 1.1, 0]} rotation={[0, 0, 0.2]} castShadow>
        <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
        <meshStandardMaterial color="#ffdbac" roughness={0.6} />
      </mesh>
    </group>
  )
}
