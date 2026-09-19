import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { frameState } from "@/state/transient/frameState";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { RngStream } from "@/lib/math/Random";

/**
 * GPU rain streaks (§33 procedural weather rendering).
 *
 * Static seeded buffer; fall + wind slant + camera wrapping happen entirely
 * in the vertex shader — zero CPU per frame, bounded budget via the quality
 * tier. Intensity follows frameState.weather.rain, so storms fade in/out
 * without reallocating anything. LOW quality disables the system (rainCount
 * = 0) by design.
 */
const BOX = new Vector3(56, 44, 56);

export function RainSystem(): React.JSX.Element | null {
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);
  const pointsRef = useRef<Points>(null);
  const camera = useThree((st) => st.camera);

  const count = profile.rainCount;

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const rng = new RngStream(0x1211);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng.float() - 0.5) * BOX.x;
      positions[i * 3 + 1] = (rng.float() - 0.5) * BOX.y;
      positions[i * 3 + 2] = (rng.float() - 0.5) * BOX.z;
      seeds[i] = rng.float();
    }
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new BufferAttribute(seeds, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: /* glsl */ `
          precision highp float;
          uniform float u_globalTime;
          uniform vec3 u_cameraPos;
          uniform vec3 u_box;
          uniform float u_wind;
          uniform float u_pixelRatio;
          uniform float u_intensity;
          attribute float aSeed;
          varying float vAlpha;
          void main() {
            // Deterministic fall: faster streaks for higher seeds.
            float fall = 22.0 + 14.0 * aSeed;
            vec3 p = position;
            p.y = mod(p.y - u_globalTime * fall, u_box.y) - u_box.y * 0.5;
            // Wind slant (x/z drift), wrapped inside the camera box.
            p.x += u_globalTime * (6.0 + 14.0 * u_wind) * (0.6 + 0.4 * aSeed);
            p.z += u_globalTime * (3.0 + 6.0 * u_wind);
            vec3 rel = mod(p - u_cameraPos + u_box * 0.5, u_box) - u_box * 0.5;
            vec3 world = u_cameraPos + rel;
            vec4 mv = viewMatrix * vec4(world, 1.0);
            gl_Position = projectionMatrix * mv;
            float dist = max(length(mv.xyz), 1.0);
            gl_PointSize = clamp(260.0 / dist, 1.5, 7.0) * u_pixelRatio;
            // Fade with distance and near the wrap boundary (recycle hiding).
            float edge = length(rel / (u_box * 0.5));
            vAlpha = u_intensity
              * (1.0 - smoothstep(0.72, 1.0, edge))
              * smoothstep(46.0, 18.0, dist)
              * (0.35 + 0.65 * aSeed);
          }
        `,
        fragmentShader: /* glsl */ `
          precision mediump float;
          uniform vec3 u_color;
          varying float vAlpha;
          void main() {
            // Thin vertical streak inside the point sprite.
            float across = pow(max(0.0, 1.0 - abs(gl_PointCoord.x - 0.5) * 2.6), 2.0);
            float along = 1.0 - abs(gl_PointCoord.y - 0.5) * 0.7;
            float a = across * along * vAlpha;
            if (a < 0.004) discard;
            gl_FragColor = vec4(u_color, a);
          }
        `,
        uniforms: {
          u_globalTime: { value: 0 },
          u_cameraPos: { value: new Vector3() },
          u_box: { value: BOX },
          u_wind: { value: 0 },
          u_pixelRatio: { value: 1 },
          u_intensity: { value: 0 },
          u_color: { value: new Vector3(0.62, 0.72, 0.85) },
        },
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    []
  );

  useEffect(() => {
    material.uniforms.u_pixelRatio!.value = Math.min(window.devicePixelRatio, 2);
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    if (count === 0) return;
    const w = frameState.weather;
    const u = material.uniforms;
    u.u_globalTime!.value = frameState.clock.shaderTimeSeconds;
    (u.u_cameraPos!.value as Vector3).copy(camera.position);
    u.u_wind!.value = w.windStrength;
    // Storm intensity eases with the rain sample (smooth in/out).
    u.u_intensity!.value = w.rain;
    const mesh = pointsRef.current;
    if (mesh) mesh.visible = w.rain > 0.02;
  });

  if (count === 0) return null;
  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

