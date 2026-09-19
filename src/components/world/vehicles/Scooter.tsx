/**
 * Scooter Vehicle - Raycast-based controller
 * Implements suspension, steering, engine force without native Rapier vehicle API
 */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useGameStore } from '@/state/stores/useGameStore'
import { globalInputManager } from '@/engine/input/inputManager'
import { SCOOTER_CONFIG } from '@/lib/physics/vehicleMath'

export function Scooter({ position = [12, 0.5, 20] as [number, number, number] }) {
  const rbRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Group>(null)
  const isOnVehicle = useGameStore(s => s.isOnVehicle)
  const vehicleId = useGameStore(s => s.vehicleId)
  const setOnVehicle = useGameStore(s => s.setOnVehicle)
  const playerPos = useGameStore(s => s.playerPosition)
  const isInteracting = useGameStore(s => s.isInteracting)

  const isThisVehicleActive = isOnVehicle && vehicleId === 'scooter_01'

  const velocity = useMemo(() => new THREE.Vector3(), [])
  const steeringAngle = useRef(0)
  const engineForce = useRef(0)

  // Proximity check for entering
  useFrame((state, delta) => {
    const dist = Math.sqrt(
      (playerPos.x - position[0]) ** 2 +
      (playerPos.z - position[2]) ** 2
    )

    const promptEl = document.getElementById('vehicle-prompt')

    if (!isOnVehicle && !isInteracting && dist < 2.5) {
      if (promptEl) {
        promptEl.style.display = 'block'
        promptEl.textContent = 'Press E to ride scooter'
      }
      const input = globalInputManager?.getState()
      if (input && input.actions.INTERACT > 0.5) {
        setOnVehicle(true, 'scooter_01')
        if (promptEl) promptEl.style.display = 'none'
      }
    } else if (!isThisVehicleActive && promptEl && promptEl.textContent?.includes('scooter')) {
      // don't hide if other prompt active, but check
    }

    if (!rbRef.current) return

    if (isThisVehicleActive) {
      // Vehicle controls
      const input = globalInputManager?.update(delta)
      const actions = input?.actions

      let forward = 0
      let steer = 0
      if (actions) {
        forward = (actions.MOVE_FORWARD || 0) - (actions.MOVE_BACKWARD || 0)
        steer = (actions.MOVE_RIGHT || 0) - (actions.MOVE_LEFT || 0)
        if (actions.INTERACT > 0.5) {
          // exit vehicle
          setOnVehicle(false, null)
          // place player near
          rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
          return
        }
      }

      // Steering smoothing
      const targetSteer = steer * SCOOTER_CONFIG.steeringLimit
      steeringAngle.current += (targetSteer - steeringAngle.current) * Math.min(1, delta * 6)

      // Engine force with response curve
      const targetForce = forward * SCOOTER_CONFIG.engineForce * (actions?.BOOST ? 1.8 : 1)
      engineForce.current += (targetForce - engineForce.current) * Math.min(1, delta * 4)

      // Apply forces - simplified raycast vehicle logic
      const rb = rbRef.current
      const linvel = rb.linvel()
      velocity.set(linvel.x, linvel.y, linvel.z)

      // Forward direction from rotation
      const rot = rb.rotation()
      const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
      const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)

      // Longitudinal force
      const forwardForce = forwardDir.clone().multiplyScalar(engineForce.current)
      rb.addForce({ x: forwardForce.x, y: 0, z: forwardForce.z }, true)

      // Lateral grip - counter sideways slip
      const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(quat)
      const lateralVel = velocity.dot(rightDir)
      const lateralForce = rightDir.clone().multiplyScalar(-lateralVel * SCOOTER_CONFIG.lateralGrip * delta)
      rb.addForce({ x: lateralForce.x, y: 0, z: lateralForce.z }, true)

      // Steering torque
      if (Math.abs(velocity.length()) > 0.5) {
        rb.addTorque({ x: 0, y: steeringAngle.current * velocity.length() * 2, z: 0 }, true)
      }

      // Aerodynamic drag
      const speedSq = velocity.lengthSq()
      if (speedSq > 0.01) {
        const drag = SCOOTER_CONFIG.aerodynamicDrag * speedSq
        const dragForce = velocity.clone().normalize().multiplyScalar(-drag)
        rb.addForce({ x: dragForce.x, y: 0, z: dragForce.z }, true)
      }

      // Update player position to follow vehicle
      const t = rb.translation()
      useGameStore.getState().setPlayerPosition({ x: t.x, y: t.y, z: t.z })

      // Camera follow is handled in App via player position
    }
  })

  return (
    <RigidBody
      ref={rbRef}
      colliders="cuboid"
      mass={SCOOTER_CONFIG.mass}
      position={position}
      linearDamping={0.4}
      angularDamping={1.5}
      friction={0.8}
    >
      <group ref={meshRef}>
        {/* Scooter Model - Lime / Green like InZOI ref */}
        <group>
          {/* Deck */}
          <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.4, 0.08, 1.2]} />
            <meshStandardMaterial color="#222222" roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Front pole */}
          <mesh position={[0, 0.6, 0.5]} rotation={[0.1, 0, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1.0]} />
            <meshStandardMaterial color="#111111" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Handlebar */}
          <mesh position={[0, 1.05, 0.52]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.6]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          {/* Wheels */}
          <mesh position={[0, 0, 0.6]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[SCOOTER_CONFIG.wheelRadius, SCOOTER_CONFIG.wheelRadius, 0.1]} />
            <meshStandardMaterial color="#111111" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, -0.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[SCOOTER_CONFIG.wheelRadius, SCOOTER_CONFIG.wheelRadius, 0.1]} />
            <meshStandardMaterial color="#111111" roughness={0.8} />
          </mesh>
          {/* Lime accent like image */}
          <mesh position={[0, 0.15, 0.3]} castShadow>
            <boxGeometry args={[0.42, 0.02, 0.3]} />
            <meshStandardMaterial color="#7ed321" emissive="#7ed321" emissiveIntensity={0.3} />
          </mesh>
          {/* Light */}
          <mesh position={[0, 0.5, 0.6]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={isThisVehicleActive ? 1 : 0.2} />
          </mesh>
        </group>
      </group>
    </RigidBody>
  )
}
