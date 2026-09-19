import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  AMBIENT_PARTICLE_FRAGMENT,
  AMBIENT_PARTICLE_VERTEX,
} from "@/shaders/effects/particleShaders";
import { frameState } from "@/state/transient/frameState";
import { setAmbientParticleCount } from "./ExhaustParticles";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { RngStream } from "@/lib/math/Random";

/**
 * Atmospheric drift particles (§21: zero CPU cost per frame).
 *
 * Positions are a static seeded buffer; drift + camera-relative wrapping
 * happen entirely in the vertex shader (u_globalTime + u_cameraPos), so the
 * field follows the viewer with no CPU updates and no unbounded growth.
 */
export function AmbientParticles(): React.JSX.Element {
  const quality = useSettingsStore(selectQuality);
  const count = Math.min(getQualityProfile(quality).particleBudget, 4200);
  const camera = useThree((s) => s.camera);
  const pointsRef = useRef<Points>(null);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const rng = new RngStream(0xa3e5);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng.float() - 0.5) * 120;
      positions[i * 3 + 1] = rng.float() * 30 + 0.5;
      positions[i * 3 + 2] = (rng.float() - 0.5) * 120;
      seeds[i] = rng.float() * 1000;
    }
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new BufferAttribute(seeds, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: AMBIENT_PARTICLE_VERTEX,
        fragmentShader: AMBIENT_PARTICLE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          u_globalTime: { value: 0 },
          u_cameraPos: { value: new Vector3() },
          u_boxSize: { value: new Vector3(120, 34, 120) },
          u_pixelRatio: { value: 1 },
          u_size: { value: 2.1 },
          u_color: { value: new Color(0.65, 0.85, 1.0) },
        },
      }),
    []
  );

  useEffect(() => {
    material.uniforms.u_pixelRatio!.value = Math.min(window.devicePixelRatio, 2);
    setAmbientParticleCount(count);
    return () => {
      geometry.dispose();
      material.dispose();
      setAmbientParticleCount(0);
    };
  }, [geometry, material, count]);

  useFrame(() => {
    material.uniforms.u_globalTime!.value = frameState.clock.shaderTimeSeconds;
    (material.uniforms.u_cameraPos!.value as Vector3).copy(camera.position);
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
