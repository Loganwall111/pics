import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import { frameState } from "@/state/transient/frameState";

/**
 * The renderable sun disc (§12).
 *
 * This is a real, occludable scene object placed along the sampled sun
 * direction each frame — the GodRays post-effect uses it as its light source
 * mask, so buildings genuinely block the volumetric light. Material is
 * MeshBasicMaterial (required by GodRaysEffect's mask pass) with an HDR
 * colour so bloom picks it up.
 */
export const SUN_DISTANCE = 2600;

export function SunMesh({ onReady }: { onReady?: (mesh: Mesh) => void }): React.JSX.Element {
  const ref = useRef<Mesh>(null);

  const geometry = useMemo(() => new SphereGeometry(48, 24, 16), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(3.2, 2.7, 2.1), // HDR: > 1 drives bloom + god rays
        toneMapped: false,
        fog: false,
        blending: AdditiveBlending,
      }),
    []
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (ref.current) onReady?.(ref.current);
  }, [onReady]);

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.position.copy(camera.position).addScaledVector(frameState.sunDirection, SUN_DISTANCE);
    const night = frameState.nightFactor;
    const visible = frameState.sunDirection.y > -0.05;
    mesh.visible = visible;
    if (visible) {
      const heat = 1 - night * 0.55;
      material.color.setRGB(3.2 * heat, 2.7 * heat * (0.8 + 0.2 * (1 - night)), 2.1 * heat * (0.62 + 0.38 * (1 - night)));
    }
  });

  return <mesh ref={ref} geometry={geometry} material={material} renderOrder={-900} />;
}
