/**
 * Photographic Texture Generation - LIGHTWEIGHT VERSION for fast initial render
 * Generates realistic PBR textures using Canvas API - reduced size for performance
 */
import * as THREE from 'three'

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function noise2D(x: number, y: number): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = Math.sin(X * 12.9898 + Y * 78.233) * 43758.5453 % 1
  const b = Math.sin((X + 1) * 12.9898 + Y * 78.233) * 43758.5453 % 1
  const c = Math.sin(X * 12.9898 + (Y + 1) * 78.233) * 43758.5453 % 1
  const d = Math.sin((X + 1) * 12.9898 + (Y + 1) * 78.233) * 43758.5453 % 1
  const aa = a - Math.floor(a)
  const bb = b - Math.floor(b)
  const cc = c - Math.floor(c)
  const dd = d - Math.floor(d)
  return aa * (1 - u) * (1 - v) + bb * u * (1 - v) + cc * (1 - u) * v + dd * u * v
}

function fbm(x: number, y: number, octaves = 3): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency)
    amplitude *= 0.5
    frequency *= 2
  }
  return value
}

export function generateAsphaltTexture(size = 256): { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const colorCanvas = createCanvas(size, size)
  const roughCanvas = createCanvas(size, size)
  const normalCanvas = createCanvas(size, size)
  const cCtx = colorCanvas.getContext('2d')!
  const rCtx = roughCanvas.getContext('2d')!
  const nCtx = normalCanvas.getContext('2d')!

  cCtx.fillStyle = '#1a1d22'
  cCtx.fillRect(0, 0, size, size)

  const imageData = cCtx.getImageData(0, 0, size, size)
  const roughData = rCtx.getImageData(0, 0, size, size)
  const normalData = nCtx.getImageData(0, 0, size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const nx = x / size * 4
      const ny = y / size * 4

      const n = fbm(nx, ny, 3)
      const base = 26 + n * 15
      const r = base + (Math.random() - 0.5) * 4
      const g = base + (Math.random() - 0.5) * 3
      const b = base + 2

      imageData.data[idx] = r
      imageData.data[idx + 1] = g
      imageData.data[idx + 2] = b
      imageData.data[idx + 3] = 255

      const rough = 0.85 + (Math.random() - 0.5) * 0.05
      const roughVal = Math.floor(rough * 255)
      roughData.data[idx] = roughVal
      roughData.data[idx + 1] = roughVal
      roughData.data[idx + 2] = roughVal
      roughData.data[idx + 3] = 255

      normalData.data[idx] = 128 + (Math.random() - 0.5) * 10
      normalData.data[idx + 1] = 128 + (Math.random() - 0.5) * 10
      normalData.data[idx + 2] = 255
      normalData.data[idx + 3] = 255
    }
  }

  cCtx.putImageData(imageData, 0, 0)
  rCtx.putImageData(roughData, 0, 0)
  nCtx.putImageData(normalData, 0, 0)

  const colorTex = new THREE.CanvasTexture(colorCanvas)
  const roughTex = new THREE.CanvasTexture(roughCanvas)
  const normalTex = new THREE.CanvasTexture(normalCanvas)

  for (const tex of [colorTex, roughTex, normalTex]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 2)
    tex.anisotropy = 2
    tex.needsUpdate = true
    ;(tex as any).colorSpace = tex === colorTex ? THREE.SRGBColorSpace : THREE.NoColorSpace
  }

  return { color: colorTex, roughness: roughTex, normal: normalTex }
}

export function generateBrickTexture(size = 256): { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const colorCanvas = createCanvas(size, size)
  const roughCanvas = createCanvas(size, size)
  const normalCanvas = createCanvas(size, size)
  const cCtx = colorCanvas.getContext('2d')!
  const rCtx = roughCanvas.getContext('2d')!
  const nCtx = normalCanvas.getContext('2d')!

  const brickW = size / 6
  const brickH = size / 12
  const mortar = 2

  cCtx.fillStyle = '#d5d5d5'
  cCtx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += brickH + mortar) {
    const offset = (Math.floor(y / (brickH + mortar)) % 2) * (brickW / 2)
    for (let x = -brickW; x < size; x += brickW + mortar) {
      const bx = x + offset
      const r = 160 + Math.random() * 30
      const g = 60 + Math.random() * 20
      const b = 45 + Math.random() * 15
      cCtx.fillStyle = `rgb(${r}, ${g}, ${b})`
      cCtx.fillRect(bx, y, brickW, brickH)
    }
  }

  const cData = cCtx.getImageData(0, 0, size, size)
  const rData = rCtx.getImageData(0, 0, size, size)
  const nData = nCtx.getImageData(0, 0, size, size)

  for (let i = 0; i < cData.data.length; i += 4) {
    const isMortar = cData.data[i] > 200 && cData.data[i + 1] > 200
    const rough = isMortar ? 0.9 : 0.7
    rData.data[i] = rData.data[i + 1] = rData.data[i + 2] = rough * 255
    rData.data[i + 3] = 255
    nData.data[i] = 128
    nData.data[i + 1] = 128
    nData.data[i + 2] = 255
    nData.data[i + 3] = 255
  }

  rCtx.putImageData(rData, 0, 0)
  nCtx.putImageData(nData, 0, 0)

  const colorTex = new THREE.CanvasTexture(colorCanvas)
  const roughTex = new THREE.CanvasTexture(roughCanvas)
  const normalTex = new THREE.CanvasTexture(normalCanvas)

  for (const tex of [colorTex, roughTex, normalTex]) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    tex.needsUpdate = true
    ;(tex as any).colorSpace = tex === colorTex ? THREE.SRGBColorSpace : THREE.NoColorSpace
  }

  return { color: colorTex, roughness: roughTex, normal: normalTex }
}

export function generateWindowTexture(size = 128): THREE.CanvasTexture {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0a0e1a'
  ctx.fillRect(0, 0, size, size)

  const windowW = size / 6
  const windowH = size / 6
  const gap = 4

  for (let y = gap; y < size; y += windowH + gap) {
    for (let x = gap; x < size; x += windowW + gap) {
      const isLit = Math.random() > 0.4
      if (isLit) {
        const hue = 40 + Math.random() * 30
        ctx.fillStyle = `hsl(${hue}, 70%, 65%)`
        ctx.fillRect(x, y, windowW, windowH)
      } else {
        ctx.fillStyle = `rgb(${10 + Math.random() * 10}, ${15 + Math.random() * 10}, ${25 + Math.random() * 10})`
        ctx.fillRect(x, y, windowW, windowH)
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 4)
  ;(tex as any).colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export function generateConcreteTexture(size = 128): { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const colorCanvas = createCanvas(size, size)
  const ctx = colorCanvas.getContext('2d')!
  ctx.fillStyle = '#c8c9cc'
  ctx.fillRect(0, 0, size, size)

  const img = ctx.getImageData(0, 0, size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const v = 200 + Math.random() * 20
      img.data[idx] = v
      img.data[idx + 1] = v - 2
      img.data[idx + 2] = v + 2
      img.data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  const colorTex = new THREE.CanvasTexture(colorCanvas)
  colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping
  colorTex.repeat.set(1, 1)
  ;(colorTex as any).colorSpace = THREE.SRGBColorSpace

  const roughCanvas = createCanvas(size, size)
  const rCtx = roughCanvas.getContext('2d')!
  rCtx.fillStyle = '#cccccc'
  rCtx.fillRect(0, 0, size, size)
  const roughTex = new THREE.CanvasTexture(roughCanvas)

  const normalCanvas = createCanvas(size, size)
  const nCtx = normalCanvas.getContext('2d')!
  nCtx.fillStyle = '#8080ff'
  nCtx.fillRect(0, 0, size, size)
  const normalTex = new THREE.CanvasTexture(normalCanvas)

  return { color: colorTex, roughness: roughTex, normal: normalTex }
}
