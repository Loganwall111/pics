# Shaders

All GLSL lives as exported template strings (no loader plugin required) and is
validated by `npm run check:shaders` (static analysis: brace/paren balance,
required uniform declarations, no dead `TODO` markers).

| Directory   | Contents                                                                  |
| ----------- | ------------------------------------------------------------------------- |
| `sky/`      | Procedural atmospheric dome (Rayleigh/Mie approximation, sun disc, stars). |
| `buildings/`| Window-emissive injection chunks for `MeshStandardMaterial` (§15, §23).    |
| `effects/`  | GPU ambient drift particles + CPU-pooled exhaust particles.               |
| `terrain/`  | Documentation only — ground uses the **native Three.js PBR pipeline** fed  |
|             | by procedurally generated textures (`src/lib/geometry/textures.ts`).      |
| `post/`     | Documentation only — volumetric passes come from the installed             |
|             | `@react-three/postprocessing` / `postprocessing` stack (`GodRaysEffect`).  |

Uniform ownership rules (§23): every runtime-updated uniform lives in a single
shared object created by the owning component and is mutated per frame.
Materials are never recreated to change uniforms.
