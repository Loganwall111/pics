/**
 * Photographic Texture Generation
 * Generates realistic PBR textures using Canvas API with noise, photographic detail
 * No external assets required - pure procedural but mimics photographic quality
 */
import * as THREE from 'three'

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function noise2D(x: number, y: number): number {
  // Simple value noise
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

function fbm(x: number, y: number, octaves = 4): number {
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

export function generateAsphaltTexture(size = 1024): { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const colorCanvas = createCanvas(size, size)
  const roughCanvas = createCanvas(size, size)
  const normalCanvas = createCanvas(size, size)
  const cCtx = colorCanvas.getContext('2d')!
  const rCtx = roughCanvas.getContext('2d')!
  const nCtx = normalCanvas.getContext('2d')!

  // Base asphalt dark gray
  cCtx.fillStyle = '#1a1d22'
  cCtx.fillRect(0, 0, size, size)

  const imageData = cCtx.getImageData(0, 0, size, size)
  const roughData = rCtx.getImageData(0, 0, size, size)
  const normalData = nCtx.getImageData(0, 0, size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const nx = x / size * 8
      const ny = y / size * 8

      const n = fbm(nx, ny, 5)
      const n2 = fbm(nx * 2 + 100, ny * 2, 3)
      const crack = fbm(nx * 0.5, ny * 0.5, 2)

      // Asphalt color variation - realistic aggregate
      const aggregate = n2 > 0.6 ? 30 : 0
      const base = 26 + n * 25 + aggregate
      const r = base + (Math.random() - 0.5) * 8
      const g = base + (Math.random() - 0.5) * 6
      const b = base + 2 + (Math.random() - 0.5) * 10

      imageData.data[idx] = r
      imageData.data[idx + 1] = g
      imageData.data[idx + 2] = b
      imageData.data[idx + 3] = 255

      // Roughness - asphalt is rough but with variation
      const rough = 0.85 + crack * 0.15 + (Math.random() - 0.5) * 0.1
      const roughVal = Math.floor(rough * 255)
      roughData.data[idx] = roughVal
      roughData.data[idx + 1] = roughVal
      roughData.data[idx + 2] = roughVal
      roughData.data[idx + 3] = 255

      // Normal map - subtle bumps
      const dx = fbm(nx + 0.01, ny, 3) - fbm(nx - 0.01, ny, 3)
      const dy = fbm(nx, ny + 0.01, 3) - fbm(nx, ny - 0.01, 3)
      normalData.data[idx] = 128 + dx * 60
      normalData.data[idx + 1] = 128 + dy * 60
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
    tex.repeat.set(4, 4)
    tex.anisotropy = 8
    tex.needsUpdate = true
    tex.colorSpace = tex === colorTex ? THREE.SRGBColorSpace : THREE.NoColorSpace
  }

  return { color: colorTex, roughness: roughTex, normal: normalTex }
}

export function generateBrickTexture(size = 1024): { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const colorCanvas = createCanvas(size, size)
  const roughCanvas = createCanvas(size, size)
  const normalCanvas = createCanvas(size, size)
  const cCtx = colorCanvas.getContext('2d')!
  const rCtx = roughCanvas.getContext('2d')!
  const nCtx = normalCanvas.getContext('2d')!

  const brickW = size / 8
  const brickH = size / 16
  const mortar = 4

  cCtx.fillStyle = '#d5d5d5'
  cCtx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y += brickH + mortar) {
    const offset = (Math.floor(y / (brickH + mortar)) % 2) * (brickW / 2)
    for (let x = -brickW; x < size; x += brickW + mortar) {
      const bx = x + offset
      // Brick color variation - realistic red/brown
      const hueVar = (Math.random() - 0.5) * 20
      const satVar = 0.6 + Math.random() * 0.3
      const r = 160 + hueVar + Math.random() * 40
      const g = 60 + hueVar * 0.5 + Math.random() * 30
      const b = 45 + Math.random() * 20

      cCtx.fillStyle = `rgb(${r * satVar}, ${g * satVar}, ${b * satVar})`
      cCtx.fillRect(bx, y, brickW, brickH)

      // Add brick texture noise
      cCtx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`
      for (let k = 0; k < 3; k++) {
        cCtx.fillRect(bx + Math.random() * brickW, y + Math.random() * brickH, 2, 2)
      }
    }
  }

  // Generate roughness and normal procedurally
  const cData = cCtx.getImageData(0, 0, size, size)
  const rData = rCtx.getImageData(0, 0, size, size)
  const nData = nCtx.getImageData(0, 0, size, size)

  for (let i = 0; i < cData.data.length; i += 4) {
    const isMortar = cData.data[i] > 200 && cData.data[i + 1] > 200
    const rough = isMortar ? 0.9 : 0.7 + Math.random() * 0.2
    rData.data[i] = rData.data[i + 1] = rData.data[i + 2] = rough * 255
    rData.data[i + 3] = 255

    nData.data[i] = 128 + (Math.random() - 0.5) * (isMortar ? 10 : 30)
    nData.data[i + 1] = 128 + (Math.random() - 0.5) * (isMortar ? 10 : 30)
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
    tex.anisotropy = 8
    tex.needsUpdate = true
    tex.colorSpace = tex === colorTex ? THREE.SRGBColorSpace : THREE.NoColorSpace
  }

  return { color: colorTex, roughness: roughTex, normal: normalTex }
}

export function generateWindowTexture(size = 512): THREE.CanvasTexture {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')!

  // Dark building base
  ctx.fillStyle = '#0a0e1a'
  ctx.fillRect(0, 0, size, size)

  const windowW = size / 8
  const windowH = size / 8
  const gap = 8

  for (let y = gap; y < size; y += windowH + gap) {
    for (let x = gap; x < size; x += windowW + gap) {
      const isLit = Math.random() > 0.35
      if (isLit) {
        const hue = 40 + Math.random() * 40 // warm yellow to cool blue
        const sat = 0.3 + Math.random() * 0.7
        const light = 0.6 + Math.random() * 0.4
        ctx.fillStyle = `hsl(${hue}, ${sat * 100}%, ${light * 100}%)`
        // Add glow
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 10
        ctx.fillRect(x, y, windowW, windowH)
        ctx.shadowBlur = 0

        // Interior detail
        if (Math.random() > 0.7) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)'
          ctx.fillRect(x, y + windowH * 0.4, windowW, 2)
        }
      } else {
        ctx.fillStyle = `rgb(${10 + Math.random() * 15}, ${15 + Math.random() * 20}, ${25 + Math.random() * 30})`
        ctx.fillRect(x, y, windowW, windowH)
        // Reflection
        ctx.fillStyle = `rgba(100,150,255,${0.05 + Math.random() * 0.1})`
        ctx.fillRect(x, y, windowW * 0.5, windowH * 0.5)
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 4)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

export function generateConcreteTexture(size = 1024): { color: THREE.CanvasTexture; roughness: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const colorCanvas = createCanvas(size, size)
  const ctx = colorCanvas.getContext('2d')!
  ctx.fillStyle = '#c8c9cc'
  ctx.fillRect(0, 0, size, size)

  const img = ctx.getImageData(0, 0, size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const n = fbm(x / size * 10, y / size * 10, 4)
      const v = 200 + n * 40 + (Math.random() - 0.5) * 20
      img.data[idx] = v
      img.data[idx + 1] = v - 2
      img.data[idx + 2] = v + 2
      img.data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  const colorTex = new THREE.CanvasTexture(colorCanvas)
  colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping
  colorTex.repeat.set(2, 2)
  colorTex.colorSpace = THREE.SRGBColorSpace
  colorTex.anisotropy = 8

  // Simple roughness/normal clones for now - will be extended
  const roughCanvas = createCanvas(size, size)
  const rCtx = roughCanvas.getContext('2d')!
  rCtx.fillStyle = '#cccccc'
  rCtx.fillRect(0, 0, size, size)

  const roughTex = new THREE.CanvasTexture(roughCanvas)
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping

  const normalCanvas = createCanvas(size, size)
  const nCtx = normalCanvas.getContext('2d')!
  nCtx.fillStyle = '#8080ff'
  nCtx.fillRect(0, 0, size, size)
  const normalTex = new THREE.CanvasTexture(normalCanvas)
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping

  return { color: colorTex, roughness: roughTex, normal: normalTex }
}
