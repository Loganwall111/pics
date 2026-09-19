/**
 * Renderer Configuration - Centralized ownership per directive
 * Handles pixel ratio, tone mapping, color space, shadows, antialias, power preference
 */
import * as THREE from 'three'

export interface RendererConfig {
  pixelRatio: number
  antialias: boolean
  powerPreference: 'default' | 'high-performance' | 'low-power'
  shadowMapEnabled: boolean
  shadowMapType: THREE.ShadowMapType
  toneMapping: THREE.ToneMapping
  toneMappingExposure: number
  outputColorSpace: THREE.ColorSpace
  physicallyCorrectLights: boolean
}

export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  antialias: true,
  powerPreference: 'high-performance',
  shadowMapEnabled: true,
  shadowMapType: THREE.PCFSoftShadowMap,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
  outputColorSpace: THREE.SRGBColorSpace,
  physicallyCorrectLights: true
}

export function applyRendererConfig(renderer: THREE.WebGLRenderer, config: RendererConfig): void {
  renderer.setPixelRatio(config.pixelRatio)
  renderer.shadowMap.enabled = config.shadowMapEnabled
  renderer.shadowMap.type = config.shadowMapType
  renderer.toneMapping = config.toneMapping
  renderer.toneMappingExposure = config.toneMappingExposure
  renderer.outputColorSpace = config.outputColorSpace
  // In Three r150+ physicallyCorrectLights is default, useLegacyLights removed
  const anyRenderer = renderer as any
  if ('useLegacyLights' in anyRenderer) {
    anyRenderer.useLegacyLights = !config.physicallyCorrectLights
  }
  if ('physicallyCorrectLights' in anyRenderer) {
    anyRenderer.physicallyCorrectLights = config.physicallyCorrectLights
  }
}

export function createRenderer(canvas: HTMLCanvasElement, config: RendererConfig = DEFAULT_RENDERER_CONFIG): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: config.antialias,
    powerPreference: config.powerPreference,
    alpha: false,
    stencil: false,
    depth: true
  })
  applyRendererConfig(renderer, config)
  return renderer
}

export function handleContextLoss(renderer: THREE.WebGLRenderer, onLoss: () => void, onRestore: () => void): () => void {
  const canvas = renderer.domElement
  const handleLoss = (e: Event): void => {
    e.preventDefault()
    console.warn('[Renderer] WebGL context lost')
    onLoss()
  }
  const handleRestore = (): void => {
    console.log('[Renderer] WebGL context restored')
    onRestore()
  }
  canvas.addEventListener('webglcontextlost', handleLoss)
  canvas.addEventListener('webglcontextrestored', handleRestore)
  return () => {
    canvas.removeEventListener('webglcontextlost', handleLoss)
    canvas.removeEventListener('webglcontextrestored', handleRestore)
  }
}

export function validateRenderTargetSize(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    console.warn(`[Renderer] Invalid render target size: ${width}x${height}`)
    return false
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    console.warn(`[Renderer] Non-finite render target size: ${width}x${height}`)
    return false
  }
  return true
}
