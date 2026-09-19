/**
 * PBR Terrain Shader - Micro-displacement, normal mapping, ambient response
 */
export const TerrainVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  uniform float u_time;
  uniform float u_displacementScale;

  // Simple noise
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec3 pos = position;
    // Micro-displacement
    float disp = noise(uv * 10.0) * u_displacementScale;
    pos += normal * disp * 0.1;
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

export const TerrainFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  
  uniform sampler2D u_colorMap;
  uniform sampler2D u_roughnessMap;
  uniform sampler2D u_normalMap;
  uniform vec3 u_sunDirection;
  uniform float u_time;

  void main() {
    vec3 color = texture2D(u_colorMap, vUv * 4.0).rgb;
    float roughness = texture2D(u_roughnessMap, vUv * 4.0).r;
    vec3 normalMap = texture2D(u_normalMap, vUv * 4.0).rgb * 2.0 - 1.0;
    
    vec3 N = normalize(vNormal + normalMap * 0.5);
    vec3 L = normalize(u_sunDirection);
    
    float NdotL = max(dot(N, L), 0.0);
    float ambient = 0.3;
    float diffuse = NdotL * 0.7 + ambient;
    
    // Specular - very low for asphalt
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 halfDir = normalize(L + viewDir);
    float spec = pow(max(dot(N, halfDir), 0.0), 32.0) * (1.0 - roughness) * 0.2;
    
    vec3 finalColor = color * diffuse + vec3(spec);
    
    // Emissive reflections from city lights
    float nightFactor = 1.0 - NdotL;
    vec3 emissive = vec3(0.8, 0.6, 0.3) * nightFactor * 0.05;
    finalColor += emissive;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`
