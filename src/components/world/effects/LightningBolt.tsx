import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from "three";
import { writeBolt, BOLT_MAX_SEGMENTS } from "@/lib/math/bolt";
import { frameState } from "@/state/transient/frameState";

/**
 * Visible lightning strikes (§33 weather).
 *
 * On each storm-cell strike (rising edge of `weather.lightning` with a
 * cooldown) a jagged, deterministic polyline is generated near the viewer —
 * from cloud base to ground — and rendered as additive line segments whose
 * opacity rides the strike envelope. Geometry is a single reused buffer
 * (allocation-free after mount); the bolt's seed mixes strike time so every
 * strike is a different shape.
 */

const CLOUD_BASE = 320;
const JAG = 30;
const COOLDOWN_SECONDS = 1.4;

export function LightningBolt(): React.JSX.Element {
  const camera = useThree((s) => s.camera);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(BOLT_MAX_SEGMENTS * 6), 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new LineBasicMaterial({
        color: 0xdce8ff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  const linesRef = useRef<LineSegments>(null);
  const prevLightning = useRef(0);
  const lastStrikeAt = useRef(-99);
  const segments = useRef(0);

  useFrame(() => {
    const bolt = linesRef.current;
    if (!bolt) return;
    const lightning = frameState.weather.lightning;
    const now = frameState.clock.shaderTimeSeconds;

    // Rising edge with cooldown → generate a fresh bolt near the viewer.
    if (lightning > 0.35 && prevLightning.current <= 0.35 && now - lastStrikeAt.current > COOLDOWN_SECONDS) {
      lastStrikeAt.current = now;
      const azimuth = ((now * 733.7) % 6.283185) + Math.sin(now * 31.7) * 0.8;
      const range = 320 + ((now * 541.3) % 1) * 440;
      const x0 = camera.position.x + Math.sin(azimuth) * range;
      const z0 = camera.position.z + Math.cos(azimuth) * range;
      const positions = geometry.getAttribute("position") as BufferAttribute;
      const array = positions.array as Float32Array;
      segments.current = writeBolt(
        (Math.floor(now * 1000) ^ 0x6c17) >>> 0,
        x0,
        z0,
        CLOUD_BASE,
        0,
        JAG,
        array
      );
      geometry.setDrawRange(0, segments.current * 2);
      positions.needsUpdate = true;
    }
    prevLightning.current = lightning;

    material.opacity = Math.min(1, lightning * 1.5);
    bolt.visible = material.opacity > 0.01;
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
  );
}
