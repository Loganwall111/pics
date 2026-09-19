/**
 * Building PBR + Emissive Window Shader
 * Data-driven window emission, flicker probability, activation schedule
 */
export const BuildingVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = color;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const BuildingFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vColor;

  uniform sampler2D u_windowMap;
  uniform float u_time;
  uniform float u_emissiveIntensity;
  uniform vec3 u_sunDirection;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 baseColor = vColor;
    
    // Window emissive
    vec2 windowUv = vUv * vec2(2.0, 4.0);
    vec4 windowSample = texture2D(u_windowMap, windowUv);
    float windowMask = windowSample.r;
    
    // Flicker based on random + time
    float flicker = random(floor(windowUv * 10.0) + floor(u_time * 0.5));
    float flickerFactor = step(0.92, flicker) * sin(u_time * 10.0 + flicker * 10.0) * 0.5 + 0.5;
    flickerFactor = mix(1.0, flickerFactor, 0.15);
    
    // Time-of-day activation - windows more lit at night
    float sunDot = dot(normalize(vNormal), normalize(u_sunDirection));
    float nightFactor = 1.0 - clamp(sunDot * 0.5 + 0.5, 0.0, 1.0);
    
    vec3 emissiveColor = windowSample.rgb * u_emissiveIntensity * flickerFactor * nightFactor * 2.0;
    
    // PBR lighting
    vec3 N = normalize(vNormal);
    vec3 L = normalize(u_sunDirection);
    float NdotL = max(dot(N, L), 0.0);
    float diffuse = NdotL * 0.6 + 0.3;
    
    vec3 color = baseColor * diffuse + emissiveColor * windowMask;
    
    // Add subtle ambient occlusion in corners
    float ao = 1.0 - length(vUv - 0.5) * 0.3;
    color *= ao;
    
    gl_FragColor = vec4(color, 1.0);
  }
`
