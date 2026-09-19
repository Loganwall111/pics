import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from "three";
import {
  EXHAUST_PARTICLE_FRAGMENT,
  EXHAUST_PARTICLE_VERTEX,
} from "@/shaders/effects/particleShaders";
import { frameState } from "@/state/transient/frameState";

/**
 * Pooled exhaust / thrust particles (§21: bounded, no per-frame allocation).
 *
 * Producers (vehicle, spacecraft) call the module-level `emitExhaustParticle`;
 * the component integrates the ring buffer each frame and streams positions
 * through a preallocated BufferAttribute. Capacity is fixed — the oldest
 * particle is overwritten, so the system can never grow unbounded.
 */

const CAPACITY = 256;
const LIFETIME = 1.1;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  size: number;
}

const particles: Particle[] = Array.from({ length: CAPACITY }, () => ({
  x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 1,
}));
let cursor = 0;

/** Emit one particle at world position with velocity (m/s). */
export function emitExhaustParticle(x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
  const p = particles[cursor];
  if (!p) return;
  cursor = (cursor + 1) % CAPACITY;
  p.x = x; p.y = y; p.z = z;
  p.vx = vx; p.vy = vy; p.vz = vz;
  p.life = LIFETIME;
  p.size = 6 + Math.random() * 7;
}

export function getLiveParticleCount(): number {
  let n = 0;
  for (const p of particles) if (p.life > 0) n++;
  return n;
}

export function ExhaustParticles(): React.JSX.Element {
  const pointsRef = useRef<Points>(null);
  const pixelRatio = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(CAPACITY * 3);
    const life = new Float32Array(CAPACITY);
    const size = new Float32Array(CAPACITY);
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aLife", new BufferAttribute(life, 1));
    g.setAttribute("aSize", new BufferAttribute(size, 1));
    g.boundingSphere = null; // computed manually; culled off
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: EXHAUST_PARTICLE_VERTEX,
        fragmentShader: EXHAUST_PARTICLE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          u_pixelRatio: { value: 1 },
          u_colorHot: { value: new Color(0.55, 0.95, 1.0) },
          u_colorCool: { value: new Color(0.25, 0.35, 1.0) },
        },
      }),
    []
  );

  useEffect(() => {
    material.uniforms.u_pixelRatio!.value = pixelRatio;
  }, [material, pixelRatio]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const posAttr = geometry.getAttribute("position") as BufferAttribute;
    const lifeAttr = geometry.getAttribute("aLife") as BufferAttribute;
    const sizeAttr = geometry.getAttribute("aSize") as BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const lifeArr = lifeAttr.array as Float32Array;
    const sizeArr = sizeAttr.array as Float32Array;

    for (let i = 0; i < CAPACITY; i++) {
      const p = particles[i]!;
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy += 1.6 * dt; // buoyant drift
      }
      const i3 = i * 3;
      posArr[i3] = p.x;
      posArr[i3 + 1] = p.life > 0 ? p.y : -1000;
      posArr[i3 + 2] = p.z;
      lifeArr[i] = Math.max(0, p.life / LIFETIME);
      sizeArr[i] = p.size;
    }
    posAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    frameState.particleCount = getLiveParticleCount() + ambientCountRef;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Set by AmbientParticles so diagnostics report a combined count. */
export let ambientCountRef = 0;
export function setAmbientParticleCount(n: number): void {
  ambientCountRef = n;
}
