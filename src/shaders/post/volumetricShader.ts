/**
 * Volumetric Light Shader - Multi-pass light scattering
 * Occlusion -> Scattering -> Blur -> Composite
 */
export const VolumetricVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const VolumetricFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 u_sunScreenPosition;
  uniform float u_density;
  uniform float u_decay;
  uniform float u_weight;
  uniform float u_exposure;
  uniform int u_samples;

  void main() {
    vec2 texCoord = vUv;
    vec2 deltaTexCoord = texCoord - u_sunScreenPosition;
    deltaTexCoord *= 1.0 / float(u_samples) * u_density;
    
    float illuminationDecay = 1.0;
    vec4 color = vec4(0.0);
    
    for(int i = 0; i < 128; i++) {
      if(i >= u_samples) break;
      texCoord -= deltaTexCoord;
      vec4 sampleCol = texture2D(tDiffuse, texCoord);
      // Occlusion - depth check would be here
      sampleCol *= illuminationDecay * u_weight;
      color += sampleCol;
      illuminationDecay *= u_decay;
    }
    
    color *= u_exposure;
    vec4 baseColor = texture2D(tDiffuse, vUv);
    gl_FragColor = baseColor + color * 0.5;
  }
`
