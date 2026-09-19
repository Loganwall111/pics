import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { SKY_FRAGMENT_SHADER, SKY_VERTEX_SHADER } from "@/shaders/sky/skyShader";
import { frameState } from "@/state/transient/frameState";

/**
 * Procedural sky dome (§11).
 *
 * A single sphere locked to the camera renders the analytic atmosphere.
 * Uniforms live in ONE object created here and mutated per frame from
 * frameState (written by SimulationLoop) — the material is never recreated.
 *
 * Cleanup: geometry + material disposed on unmount.
 */
export function SkyDome(): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);

  const geometry = useMemo(() => new SphereGeometry(3000, 48, 24), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SKY_VERTEX_SHADER,
        fragmentShader: SKY_FRAGMENT_SHADER,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          u_globalTime: { value: 0 },
          u_sunDirection: { value: new Vector3(0.5, 0.8, 0.2) },
          u_sunColor: { value: new Color(1, 0.95, 0.85) },
          u_zenithColor: { value: new Color(0.25, 0.55, 0.95) },
          u_horizonColor: { value: new Color(0.75, 0.85, 0.95) },
          u_rayleighStrength: { value: 1.0 },
          u_mieStrength: { value: 0.2 },
          u_nightFactor: { value: 0 },
          u_sunDiscSize: { value: 0.9993 },
        },
      }),
    []
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(camera.position);
    // Uniform entries are defined by construction (declared above); the
    // non-null assertions keep noUncheckedIndexedAccess honest without
    // runtime cost. Uniform objects are mutated — never recreated (§23).
    const u = material.uniforms;
    u.u_globalTime!.value = frameState.clock.shaderTimeSeconds;
    (u.u_sunDirection!.value as Vector3).copy(frameState.sunDirection);
    (u.u_sunColor!.value as Color).copy(frameState.sunColor);
    (u.u_zenithColor!.value as Color).copy(frameState.zenithColor);
    (u.u_horizonColor!.value as Color).copy(frameState.horizonColor);
    u.u_rayleighStrength!.value = frameState.rayleighStrength;
    u.u_mieStrength!.value = frameState.mieStrength;
    u.u_nightFactor!.value = frameState.nightFactor;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-1000}
    />
  );
}
