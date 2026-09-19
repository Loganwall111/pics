/**
 * Procedural Celestial Sky System
 * Implements Rayleigh + Mie scattering approximation, sun disc, horizon scattering
 * Uniforms match directive: u_globalTime, u_sunDirection, u_sunColor, u_zenithColor, u_horizonColor, u_rayleighStrength, u_mieStrength
 */
import * as THREE from 'three'

export const SkyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vSunDirection;
  varying float vSunFade;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const SkyFragmentShader = /* glsl */ `
  precision highp float;

  uniform float u_globalTime;
  uniform vec3 u_sunDirection;
  uniform vec3 u_sunColor;
  uniform vec3 u_zenithColor;
  uniform vec3 u_horizonColor;
  uniform float u_rayleighStrength;
  uniform float u_mieStrength;
  uniform float u_timeOfDay; // 0-1
  uniform vec3 u_moonDirection;

  varying vec3 vWorldPosition;

  // Atmospheric scattering approximation
  vec3 rayleighScattering(vec3 viewDir, vec3 sunDir, vec3 zenithCol, vec3 horizonCol, float strength) {
    float sunDot = dot(viewDir, sunDir);
    float horizonFactor = 1.0 - clamp(viewDir.y * 2.0 + 0.5, 0.0, 1.0);
    
    // Rayleigh phase function (1 + cos^2 theta)
    float rayleighPhase = 0.75 * (1.0 + sunDot * sunDot);
    
    // Blend zenith to horizon based on view angle
    float elevation = clamp(viewDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 baseColor = mix(horizonCol, zenithCol, pow(elevation, 0.6));
    
    // Sun influence
    float sunInfluence = pow(max(sunDot, 0.0), 8.0) * 0.8;
    
    return baseColor * rayleighPhase * strength + sunInfluence * vec3(1.0, 0.9, 0.7);
  }

  vec3 mieScattering(vec3 viewDir, vec3 sunDir, float strength) {
    float sunDot = dot(viewDir, sunDir);
    // Henyey-Greenstein approximation for Mie
    float g = 0.76;
    float g2 = g * g;
    float miePhase = (3.0 / (8.0 * 3.14159265)) * ((1.0 - g2) * (1.0 + sunDot * sunDot)) / pow(1.0 + g2 - 2.0 * g * sunDot, 1.5);
    miePhase = clamp(miePhase, 0.0, 5.0);
    
    // Horizon glow for Mie
    float horizonGlow = pow(1.0 - abs(viewDir.y), 3.0) * 0.5;
    
    return vec3(miePhase * strength * 0.15 + horizonGlow);
  }

  vec3 sunDisc(vec3 viewDir, vec3 sunDir, vec3 sunColor) {
    float sunDot = dot(viewDir, sunDir);
    float sunSize = 0.9995; // angular size
    float sun = smoothstep(sunSize, 0.9999, sunDot);
    float glow = pow(max(sunDot, 0.0), 800.0) * 2.0;
    float innerGlow = pow(max(sunDot, 0.0), 100.0) * 0.5;
    return (sun + glow + innerGlow) * sunColor * 1.5;
  }

  // Pseudo sunset colors based on timeOfDay
  vec3 getTimeOfDayColors(float t, out vec3 zenith, out vec3 horizon, out vec3 sunCol) {
    // t: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    // Our reference: 8:43am ~ 0.36
    
    // Day
    vec3 dayZenith = vec3(0.15, 0.35, 0.85);
    vec3 dayHorizon = vec3(0.6, 0.75, 0.95);
    vec3 daySun = vec3(1.0, 0.95, 0.85);
    
    // Sunrise/sunset - warm orange/pink like your glare pase 5.png and turquoise phase
    vec3 sunriseZenith = vec3(0.25, 0.15, 0.45);
    vec3 sunriseHorizon = vec3(0.95, 0.5, 0.35);
    vec3 sunriseSun = vec3(1.0, 0.6, 0.3);
    
    // Turquoise phase 5
    vec3 turquoiseZenith = vec3(0.05, 0.4, 0.5);
    vec3 turquoiseHorizon = vec3(0.2, 0.7, 0.75);
    vec3 turquoiseSun = vec3(0.8, 0.95, 1.0);
    
    // Purple phase
    vec3 purpleZenith = vec3(0.15, 0.05, 0.35);
    vec3 purpleHorizon = vec3(0.7, 0.3, 0.6);
    vec3 purpleSun = vec3(0.9, 0.5, 0.9);
    
    // Midnight
    vec3 nightZenith = vec3(0.02, 0.02, 0.08);
    vec3 nightHorizon = vec3(0.05, 0.05, 0.15);
    vec3 nightSun = vec3(0.3, 0.4, 0.8); // moon
    
    // Interpolate based on time
    float dayFactor = smoothstep(0.2, 0.3, t) * (1.0 - smoothstep(0.7, 0.8, t));
    float sunriseFactor = exp(-pow((t - 0.25) * 8.0, 2.0)) + exp(-pow((t - 0.75) * 8.0, 2.0));
    float nightFactor = 1.0 - dayFactor - sunriseFactor * 0.5;
    nightFactor = clamp(nightFactor, 0.0, 1.0);
    
    // Blend
    zenith = mix(nightZenith, dayZenith, dayFactor);
    horizon = mix(nightHorizon, dayHorizon, dayFactor);
    
    // Add sunrise warmth
    zenith = mix(zenith, sunriseZenith, sunriseFactor * 0.8);
    horizon = mix(horizon, sunriseHorizon, sunriseFactor);
    
    sunCol = mix(nightSun, daySun, dayFactor);
    sunCol = mix(sunCol, sunriseSun, sunriseFactor);
    
    // Special turquoise/purple phases if time > 0.9 (withers storm like)
    if (t > 0.85) {
      float storm = smoothstep(0.85, 0.95, t);
      zenith = mix(zenith, mix(turquoiseZenith, purpleZenith, sin(u_globalTime * 0.1) * 0.5 + 0.5), storm);
      horizon = mix(horizon, mix(turquoiseHorizon, purpleHorizon, cos(u_globalTime * 0.12) * 0.5 + 0.5), storm);
    }
    
    return zenith;
  }

  void main() {
    vec3 viewDir = normalize(vWorldPosition);
    
    vec3 zenithColor;
    vec3 horizonColor;
    vec3 sunColorDynamic;
    getTimeOfDayColors(u_timeOfDay, zenithColor, horizonColor, sunColorDynamic);
    
    // Override with uniforms but blend with time-of-day for artistic control
    vec3 finalZenith = mix(zenithColor, u_zenithColor, 0.3);
    vec3 finalHorizon = mix(horizonColor, u_horizonColor, 0.3);
    vec3 finalSunColor = mix(sunColorDynamic, u_sunColor, 0.4);
    
    vec3 rayleigh = rayleighScattering(viewDir, normalize(u_sunDirection), finalZenith, finalHorizon, u_rayleighStrength);
    vec3 mie = mieScattering(viewDir, normalize(u_sunDirection), u_mieStrength);
    vec3 sun = sunDisc(viewDir, normalize(u_sunDirection), finalSunColor);
    
    // Add subtle moving clouds via noise
    float cloudNoise = sin(viewDir.x * 5.0 + u_globalTime * 0.02) * sin(viewDir.z * 5.0 + u_globalTime * 0.015) * 0.5 + 0.5;
    cloudNoise = pow(cloudNoise, 3.0) * 0.08 * clamp(viewDir.y * 2.0, 0.0, 1.0);
    vec3 clouds = vec3(cloudNoise);
    
    // Stars at night
    float night = 1.0 - clamp(dot(viewDir, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0, 1.0);
    night *= 1.0 - clamp(dot(viewDir, normalize(u_sunDirection)) * 0.5 + 0.5, 0.0, 1.0);
    float stars = 0.0;
    if (night > 0.5) {
      float starNoise = fract(sin(dot(viewDir.xz, vec2(12.9898, 78.233))) * 43758.5453);
      stars = step(0.995, starNoise) * night * 0.8;
    }
    
    vec3 color = rayleigh + mie + sun + clouds + stars;
    
    // Atmospheric perspective - fade to horizon color near ground
    float fade = pow(1.0 - max(viewDir.y, 0.0), 2.0) * 0.15;
    color = mix(color, finalHorizon * 0.5, fade);
    
    // Tone mapping approx
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(0.4545)); // gamma
    
    gl_FragColor = vec4(color, 1.0);
  }
`

export function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SkyVertexShader,
    fragmentShader: SkyFragmentShader,
    uniforms: {
      u_globalTime: { value: 0 },
      u_sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
      u_sunColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
      u_zenithColor: { value: new THREE.Color(0.15, 0.35, 0.85) },
      u_horizonColor: { value: new THREE.Color(0.6, 0.75, 0.95) },
      u_rayleighStrength: { value: 1.2 },
      u_mieStrength: { value: 0.8 },
      u_timeOfDay: { value: 0.35 },
      u_moonDirection: { value: new THREE.Vector3(-0.5, 0.3, -0.8) }
    },
    side: THREE.BackSide,
    depthWrite: false
  })
}
