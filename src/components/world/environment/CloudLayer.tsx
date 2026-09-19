import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  CLOUD_VOLUMETRIC_FRAGMENT,
  CLOUD_VOLUMETRIC_VERTEX,
  makeCloudVolumetricUniformRefs,
} from "@/shaders/sky/cloudVolumetric";
import { frameState } from "@/state/transient/frameState";
import { getQualityProfile } from "@/engine/rendering/quality";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectQuality } from "@/state/selectors";
import { RngStream } from "@/lib/math/Random";

/**
 * Cloud layer (§33 weather) — two techniques, tier-switched:
 *
 * - medium and above: RAYMARCHED volumetric slab (cloudVolumetric.ts) — an
 *   analytic ray/slab march through a wind-advected noise field with sun
 *   occlusion sampling; march budget = profile.volumetricSamples.
 * - low: layered soft-particle billboards (the original few-draw-call
 *   fallback), bounded by the particle budget.
 *
 * Both paths are weather-coupled per frame (coverage, tint, opacity) and
 * dispose all GPU resources on unmount (§22).
 */

const SIZE = 512;

/** Procedural cloud sprite: multi-blob soft alpha, deterministic. */
function makeCloudTexture(): import("three").Texture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("clouds: 2D canvas unavailable");
  ctx.clearRect(0, 0, SIZE, SIZE);
  const rng = new RngStream(0xc10d);
  const blobs = 16;
  for (let i = 0; i < blobs; i++) {
    const x = SIZE / 2 + (rng.float() - 0.5) * SIZE * 0.5;
    const y = SIZE / 2 + (rng.float() - 0.5) * SIZE * 0.34;
    const r = SIZE * (0.1 + rng.float() * 0.14);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.16)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const CLOUD_BASE = 320;
const CLOUD_THICKNESS = 160;

/** Raymarched slab path (medium+ tiers). */
function RaymarchedClouds(): React.JSX.Element {
  const profile = getQualityProfile(useSettingsStore(selectQuality));
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => new BoxGeometry(9000, CLOUD_THICKNESS, 9000), []);
  const uniforms = useMemo(() => makeCloudVolumetricUniformRefs(), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CLOUD_VOLUMETRIC_VERTEX,
        fragmentShader: CLOUD_VOLUMETRIC_FRAGMENT,
        uniforms: uniforms as unknown as Record<string, { value: unknown }>,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [uniforms]
  );

  useEffect(() => {
    uniforms.u_baseHeight.value = CLOUD_BASE;
    uniforms.u_thickness.value = CLOUD_THICKNESS;
    uniforms.u_steps.value = profile.volumetricSamples;
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material, uniforms, profile]);

  const tint = useMemo(() => new Color(), []);
  const sky = useMemo(() => new Color(), []);
  const NIGHT = useMemo(() => new Color(0.06, 0.08, 0.13), []);
  const GREY = useMemo(() => new Color(0.32, 0.34, 0.38), []);

  useFrame(({ camera: cam }) => {
    const weather = frameState.weather;
    uniforms.u_time.value = frameState.clock.shaderTimeSeconds;
    uniforms.u_coverage.value = weather.cloudiness;
    uniforms.u_density.value = 0.55 + 0.55 * weather.cloudiness;
    uniforms.u_wind.value.set(4 + weather.windStrength * 9, 1.2 + weather.windStrength * 4);
    // Sun scattering tint: warm daylight, dim blue at night, grey under load.
    tint.copy(frameState.sunColor).multiplyScalar(0.25 + 0.75 * frameState.sunIntensity * 0.34);
    tint.lerp(NIGHT, frameState.nightFactor);
    tint.lerp(GREY, weather.cloudiness * 0.5);
    uniforms.u_sunColor.value.copy(tint);
    sky.copy(frameState.zenithColor).lerp(GREY, weather.cloudiness * 0.6);
    uniforms.u_skyColor.value.copy(sky);
    uniforms.u_sunDirection.value.copy(frameState.sunDirection);
    // Follow the viewer in large steps (sky feels infinite, cheap).
    meshRef.current?.position.set(
      Math.round(cam.position.x / 1200) * 1200,
      CLOUD_BASE + CLOUD_THICKNESS / 2,
      Math.round(cam.position.z / 1200) * 1200
    );
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={-5} />
  );
}

/** Soft-particle fallback path (low tier). */
function ParticleClouds(): React.JSX.Element {
  const profile = getQualityProfile(useSettingsStore(selectQuality));
  const pointsRef = useRef<Points>(null);

  const count = Math.floor(profile.particleBudget * 0.05); // 80–210 puffs

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const rng = new RngStream(0x5c1d);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const shades = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Cluster puffs into ~12 layered banks for depth parallax.
      const bank = Math.floor(i / Math.max(1, count / 12));
      positions[i * 3] = (rng.float() - 0.5) * 2200;
      positions[i * 3 + 1] = 150 + bank * 26 + rng.float() * 22;
      positions[i * 3 + 2] = (rng.float() - 0.5) * 2200;
      sizes[i] = 220 + rng.float() * 320;
      shades[i] = 0.55 + rng.float() * 0.45;
    }
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aSize", new BufferAttribute(sizes, 1));
    g.setAttribute("aShade", new BufferAttribute(shades, 1));
    return g;
  }, [count]);

  const texture = useMemo(() => makeCloudTexture(), []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: /* glsl */ `
          precision highp float;
          uniform float u_globalTime;
          uniform float u_pixelRatio;
          attribute float aSize;
          attribute float aShade;
          varying float vShade;
          void main() {
            // Slow deterministic drift, wrapping within a 2400-unit cell.
            vec3 p = position;
            p.x = mod(p.x + u_globalTime * 2.6 + 1200.0, 2400.0) - 1200.0;
            p.z += sin(u_globalTime * 0.014 + p.y * 0.013) * 40.0;
            vShade = aShade;
            vec4 mv = viewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = min(aSize * u_pixelRatio * (600.0 / max(-mv.z, 60.0)), 1100.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision mediump float;
          uniform sampler2D u_map;
          uniform vec3 u_tint;
          uniform float u_opacity;
          varying float vShade;
          void main() {
            vec4 tex = texture2D(u_map, gl_PointCoord);
            float a = tex.a * u_opacity;
            if (a < 0.004) discard;
            // Vertical gradient approximates sun scattering through the puff.
            vec3 col = u_tint * mix(0.72, 1.12, vShade * (gl_PointCoord.y < 0.5 ? 1.0 : 0.82));
            gl_FragColor = vec4(col, a);
          }
        `,
        uniforms: {
          u_globalTime: { value: 0 },
          u_pixelRatio: { value: 1 },
          u_map: { value: texture },
          u_tint: { value: new Color(1, 1, 1) },
          u_opacity: { value: 0.85 },
        },
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
        side: DoubleSide,
      }),
    [texture]
  );

  useEffect(() => {
    material.uniforms.u_pixelRatio!.value = Math.min(window.devicePixelRatio, 2);
    return () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [geometry, material, texture]);

  const tint = useMemo(() => new Color(), []);
  const camPos = useMemo(() => new Vector3(), []);
  const NIGHT = useMemo(() => new Color(0.06, 0.08, 0.13), []);
  const GREY = useMemo(() => new Color(0.32, 0.34, 0.38), []);

  useFrame(({ camera: cam }) => {
    material.uniforms.u_globalTime!.value = frameState.clock.shaderTimeSeconds;
    // Sun-side scattering tint: warm at golden hour, dark slate at night,
    // and the coverage thickens with the weather system's cloudiness (§33).
    const night = frameState.nightFactor;
    tint.copy(frameState.sunColor).lerp(NIGHT, night);
    tint.lerp(GREY, frameState.weather.cloudiness * 0.55);
    (material.uniforms.u_tint!.value as Color).copy(tint);
    material.uniforms.u_opacity!.value =
      (0.24 + 0.72 * frameState.weather.cloudiness) * (0.5 + 0.4 * (1 - night));
    // Clouds follow the viewer in large steps (sky feels infinite, cheap).
    camPos.copy(cam.position);
    pointsRef.current?.position.set(
      Math.round(camPos.x / 1200) * 1200,
      0,
      Math.round(camPos.z / 1200) * 1200
    );
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Tier switch: raymarched volumetrics on medium+, particle fallback on low. */
export function CloudLayer(): React.JSX.Element {
  const quality = useSettingsStore(selectQuality);
  const profile = getQualityProfile(quality);
  if (quality !== "low" && profile.volumetricEnabled) return <RaymarchedClouds />;
  return <ParticleClouds />;
}
