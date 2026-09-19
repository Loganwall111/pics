import { LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, CanvasTexture } from "three";
import { RngStream } from "@/lib/math/Random";

/**
 * Procedural PBR texture generation (specification §14, §27).
 *
 * All metropolitan surfaces are rendered through the native Three.js PBR
 * pipeline (MeshStandardMaterial); NO portion of the PBR shader is replaced.
 * This module only authors the texture inputs at boot:
 *   - asphalt albedo / roughness / normal (tileable, seeded noise)
 *   - the full-city road layout canvas (blocks, roads, lane paint, plaza)
 * Textures are deterministic for a given seed. They are heavy GPU resources:
 * every texture returned here must be disposed via disposeTextures().
 */

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("textures: 2D canvas context unavailable");
  return { canvas, ctx };
}

/** Tileable value-noise splatter used as the base layer of all maps. */
function noiseFill(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: RngStream,
  count: number,
  minRadius: number,
  maxRadius: number,
  shade: (r: RngStream) => string
): void {
  for (let i = 0; i < count; i++) {
    const x = rng.float() * size;
    const y = rng.float() * size;
    const r = rng.range(minRadius, maxRadius);
    ctx.fillStyle = shade(rng);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface AsphaltTextures {
  map: CanvasTexture;
  roughnessMap: CanvasTexture;
  normalMap: CanvasTexture;
  dispose: () => void;
}

/** Generate tileable asphalt PBR maps (256²; tiled across the far ground). */
export function makeAsphaltTextures(seed = 9001, anisotropy = 4): AsphaltTextures {
  const size = 256;
  const rng = new RngStream(seed);

  // Albedo: dark grey aggregate.
  const albedo = makeCanvas(size);
  albedo.ctx.fillStyle = "#2b2d31";
  albedo.ctx.fillRect(0, 0, size, size);
  noiseFill(albedo.ctx, size, rng, 900, 0.6, 2.2, (r) => {
    const g = Math.floor(r.range(30, 74));
    return `rgb(${g},${g + 2},${g + 5})`;
  });
  // Faint tyre-polished lanes.
  albedo.ctx.fillStyle = "rgba(20,20,24,0.25)";
  albedo.ctx.fillRect(0, size * 0.3, size, size * 0.08);
  albedo.ctx.fillRect(0, size * 0.62, size, size * 0.08);

  // Roughness: asphalt is broadly rough with speckle.
  const rough = makeCanvas(size);
  rough.ctx.fillStyle = "#e2e2e2"; // ~0.89 roughness
  rough.ctx.fillRect(0, 0, size, size);
  noiseFill(rough.ctx, size, rng, 500, 0.5, 1.8, (r) => {
    const v = Math.floor(r.range(190, 245));
    return `rgb(${v},${v},${v})`;
  });

  // Normal map: Sobel of a height field built from the same noise stream.
  const heightCanvas = makeCanvas(size);
  heightCanvas.ctx.fillStyle = "#808080";
  heightCanvas.ctx.fillRect(0, 0, size, size);
  noiseFill(heightCanvas.ctx, size, rng, 700, 0.4, 1.6, (r) => {
    const v = Math.floor(r.range(96, 176));
    return `rgb(${v},${v},${v})`;
  });
  const heightData = heightCanvas.ctx.getImageData(0, 0, size, size).data;
  const normalCanvas = makeCanvas(size);
  const normalImage = normalCanvas.ctx.createImageData(size, size);
  const at = (x: number, y: number): number => {
    const xi = (x + size) % size;
    const yi = (y + size) % size;
    const idx = (yi * size + xi) * 4;
    return heightData[idx] ?? 128;
  };
  const strength = 1.6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) / 255;
      const dy = (at(x, y + 1) - at(x, y - 1)) / 255;
      // Normal from inverted gradient, normalised to [0,1] byte range.
      const nx = -dx * strength;
      const ny = -dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const idx = (y * size + x) * 4;
      normalImage.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 3] = 255;
    }
  }
  normalCanvas.ctx.putImageData(normalImage, 0, 0);

  const map = new CanvasTexture(albedo.canvas);
  map.colorSpace = SRGBColorSpace;
  const roughnessMap = new CanvasTexture(rough.canvas);
  roughnessMap.colorSpace = LinearSRGBColorSpace;
  const normalMap = new CanvasTexture(normalCanvas.canvas);
  normalMap.colorSpace = LinearSRGBColorSpace;
  for (const t of [map, roughnessMap, normalMap]) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
  }
  return {
    map,
    roughnessMap,
    normalMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
      normalMap.dispose();
    },
  };
}

/**
 * Paint the deterministic city ground layout: asphalt roads on a pavement
 * base, lane markings, crosswalks and the central plaza.
 * One texture covers the whole city bounds (single draw call for the ground).
 *
 * `photos` optionally supplies AI-generated PBR albedo photography
 * (§1 asset directive): asphalt photo fills the road bands, paver photo the
 * sidewalks — composited at build time, zero runtime cost. Deterministic.
 */
export function makeCityLayoutTexture(
  blockSize: number,
  roadWidth: number,
  gridRadius: number,
  seed: number,
  size = 2048,
  photos: { asphalt?: HTMLImageElement; pavers?: HTMLImageElement } = {}
): CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const world = blockSize * 2 * (gridRadius + 0.5);
  const scale = size / world;
  const toPx = (v: number): number => (v + world / 2) * scale;
  const rng = new RngStream(seed ^ 0x5740);

  // Pavement/concrete base — photo pavers when available (asset directive §1).
  if (photos.pavers && photos.pavers.width > 0) {
    const pattern = ctx.createPattern(photos.pavers, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = "#8f9096";
    }
  } else {
    ctx.fillStyle = "#8f9096";
  }
  ctx.fillRect(0, 0, size, size);
  if (!photos.pavers) {
    noiseFill(ctx, size, rng, 2600, 0.5, 2.4, (r) => {
      const g = Math.floor(r.range(118, 158));
      return `rgb(${g},${g},${g + 4})`;
    });
  }

  // Roads: horizontal + vertical bands at block boundaries.
  const roadHalf = (roadWidth / 2) * scale;
  const lineCenters: number[] = [];
  for (let g = -gridRadius; g <= gridRadius + 1; g++) {
    lineCenters.push(toPx(g * blockSize - blockSize / 2));
  }
  if (photos.asphalt && photos.asphalt.width > 0) {
    const pattern = ctx.createPattern(photos.asphalt, "repeat");
    if (pattern) ctx.fillStyle = pattern;
    else ctx.fillStyle = "#33363c";
  } else {
    ctx.fillStyle = "#33363c";
  }
  for (const c of lineCenters) {
    ctx.fillRect(0, c - roadHalf, size, roadHalf * 2);
    ctx.fillRect(c - roadHalf, 0, roadHalf * 2, size);
  }
  if (!photos.asphalt) {
    // Road speckle (fallback only — the photo carries its own detail).
    noiseFill(ctx, size, rng, 1400, 0.4, 1.4, (r) => {
      const g = Math.floor(r.range(42, 64));
      return `rgb(${g},${g},${g + 3})`;
    });
  }

  // Lane centre dashes.
  ctx.strokeStyle = "#d8d24a";
  ctx.lineWidth = Math.max(1, 0.28 * scale);
  ctx.setLineDash([5 * scale, 4 * scale]);
  for (const c of lineCenters) {
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(size, c);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, size);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks at intersections.
  ctx.fillStyle = "rgba(235,235,235,0.85)";
  for (const cx of lineCenters) {
    for (const cz of lineCenters) {
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 4; i++) {
          const off = (i - 1.5) * (roadHalf / 2.4);
          ctx.fillRect(cx + off - roadHalf * 0.14, cz + s * (roadHalf + 1.4 * scale), roadHalf * 0.28, 2.2 * scale);
          ctx.fillRect(cx + s * (roadHalf + 1.4 * scale), cz + off - roadHalf * 0.14, 2.2 * scale, roadHalf * 0.28);
        }
      }
    }
  }

  // Central plaza: darker paving + neon ring accent.
  const center = size / 2;
  const plazaR = blockSize * 0.9 * scale;
  ctx.fillStyle = "#5c5e66";
  ctx.beginPath();
  ctx.arc(center, center, plazaR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#37e0ff";
  ctx.lineWidth = Math.max(2, 0.5 * scale);
  ctx.beginPath();
  ctx.arc(center, center, plazaR * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ff5fd2";
  ctx.beginPath();
  ctx.arc(center, center, plazaR * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function disposeTexture(texture: CanvasTexture | null | undefined): void {
  texture?.dispose();
}
