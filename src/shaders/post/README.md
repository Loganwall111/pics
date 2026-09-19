# Post-processing pipeline (volumetrics)

The multi-pass volumetric pipeline (specification §12) is composed from the
installed `@react-three/postprocessing` + `postprocessing` stack:

```text
Scene render (EffectComposer input buffer, HalfFloat)
→ GodRaysEffect: luminance/occlusion extraction around the sun mesh
   (real scene geometry occludes the sun — buildings cast light shafts)
→ radial integration + blur inside the effect (samples = quality tier)
→ Bloom (mipmapBlur) — chromatic-friendly energy bleed
→ Vignette composite
→ renderer tone mapping (ACES Filmic) → sRGB present
```

The sun mesh (`components/world/celestial/SunMesh`) is a real occludable
object placed along the sampled sun direction each frame; no fake transparent
cones are used at any quality tier. Quality tiers (LOW…ULTRA) control
`volumetricSamples`, `multisampling`, bloom and whether the composer runs at
all — see `src/engine/rendering/quality.ts`.

The sun mesh material is `MeshBasicMaterial` as required by
`GodRaysEffect`'s light-source mask.
