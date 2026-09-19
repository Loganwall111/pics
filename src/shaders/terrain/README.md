# Terrain / ground materials

The asphalt and pavement surfaces intentionally do **not** replace any part of
the Three.js PBR pipeline. They are `MeshStandardMaterial` instances fed by
procedurally generated texture maps:

- albedo, roughness, normal (Sobel-derived) — `makeAsphaltTextures()`
- whole-city road layout canvas — `makeCityLayoutTexture()`

Both live in `src/lib/geometry/textures.ts` and are deterministic for a seed.

Physically meaningful parameters (specification §14):

| Surface        | roughness | metalness | justification                          |
| -------------- | --------: | --------: | -------------------------------------- |
| Asphalt        |      0.92 |       0.0 | aggregate dielectric — never metallic  |
| Pavement       |      0.85 |       0.0 | concrete dielectric                    |
| Building shell |      0.55 |      0.15 | curtain-wall glass on concrete frame   |
| Vehicle paint  |      0.35 |      0.85 | metallic flake clearcoat               |
