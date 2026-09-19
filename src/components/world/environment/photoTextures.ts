import { RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from "three";

/**
 * Photo-PBR helper for district surfaces (v1.1 texture overhaul).
 *
 * `TextureLoader` returns a live Texture immediately — the image decodes in
 * the background and the material updates without React state (same
 * progressive philosophy as the ground composite, no canvas staging
 * needed). Callers own disposal.
 */

const loader = new TextureLoader();

export function photoTexture(url: string, repeatX: number, repeatY: number, anisotropy = 4): Texture {
  const tex = loader.load(url);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  return tex;
}
