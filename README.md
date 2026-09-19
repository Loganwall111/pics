# AETHER CITY — Multitask WebGL2 3D Reality Simulator

A production-structured, single-process open-world simulation built on **Vite + TypeScript 5 (strict) + React 19 + Three.js r180 + @react-three/fiber v9 + @react-three/rapier (Rapier WASM 0.19) + Zustand 5 + @react-three/postprocessing (postprocessing 6.39)**, targeting **WebGL2**.

One world, five modes: a procedural instanced metropolis with a raycast-vehicle and on-foot controller, a low-gravity variant, a Keplerian orbital star system with Newtonian spaceflight and floating-origin deep-space traversal, and a multi-mass physics laboratory.

```bash
npm install
npm run dev        # http://localhost:5173
npm run verify     # typecheck && lint && test && check:shaders && build
```

---

## Controls

| Context | Keys |
| --- | --- |
| Global | `1–5` switch mode · AR dock (bottom-left): stats/modes/systems/config · `Tab` stats · `G` config · `M` mute audio · drag = camera · wheel = zoom |
| On foot | `WASD` move · `Shift` sprint · `Space` jump · `E` talk / enter vehicle · `V`/`F1` first-person |
| Driving | `WASD` drive · `Shift` boost · `Space` handbrake · `F` flight mode · `E` exit · `R` recover |
| Space flight | `W/S` main/retro thrust · `R/F`/`Space`/`C` vertical · drag = pitch/yaw · `T` inertial dampers · `X` warp jump · `Shift` boost |
| Gamepad | left stick move · right stick camera · `A` jump · `X` interact · `Y` flight · `RT/LT` boost/brake · `RB` recover |

Modes: `1` Metropolis · `2` Low-Gravity (0.165 g, alien turquoise sky) · `3` Orbital (Keplerian system) · `4` Deep Space (same, far out — floating origin engages) · `5` Physics Lab.

---

## Architecture (subsystem → file → notes)

| Subsystem | Files | Update frequency | Cleanup |
| --- | --- | --- | --- |
| App shell / canvas | `src/app/App.tsx`, `src/main.tsx`, `index.html` | once + mount | ErrorBoundary + context-loss handlers |
| Routes | `src/app/routes/AppRoutes.tsx` | on mode change | full scene unmount ⇒ Rapier teardown + GPU dispose |
| Renderer config | `src/engine/rendering/rendererConfig.ts`, `RenderQualityManager.tsx`, `ResizeGuard.tsx` | once / on quality | shadow + DPR caps centralized (§4) |
| Simulation clock | `src/engine/timing/SimulationClock.ts` | per frame | clamped deltas, fixed-step accumulator, spiral-of-death guard |
| Frame orchestrator | `src/engine/simulation/SimulationLoop.tsx` | per frame (first subscriber) | zero allocations |
| Input | `src/engine/input/InputManager.ts`, `actions.ts`, `InputSystem.tsx` | per frame | semantic actions, gamepad polling, edge triggers |
| Physics facade | `src/engine/physics/PhysicsRuntime.ts`, `PhysicsBridge.tsx` | per step | Rapier 0.19 API isolated behind one auditable wrapper |
| Vehicle | `src/engine/simulation/VehicleController.ts`, `components/world/vehicles/*` | per physics step | raycast suspension + tyre friction, impulse-based |
| Player / camera | `components/world/entities/Player.tsx`, `CameraRig.tsx` | per step / frame | on-foot body disabled while driving |
| NPCs + interaction | `entities/npcDefinitions.ts`, `NPCManager.tsx`, `InteractionSystem.tsx`, `lib/simulation/interaction.ts` | 10 Hz queries | SpatialHash proximity (§17), pure decision fn |
| Dialogue | `lib/simulation/DialogueEngine.ts`, `ui/dialogue/DialogueOverlay.tsx` | rAF typewriter | swappable processor (§18) |
| Orbital mechanics | `lib/orbital/OrbitalMechanics.ts`, `space/SpaceScene.tsx` | per frame (analytic) | real elements↔state, Kepler solver, μ tables |
| Floating origin | `engine/simulation/FloatingOrigin.ts` + `RebaseProbe` | per frame past 4096 u | float64 sim space, float32-safe render space |
| Sky | `shaders/sky/skyShader.ts`, `celestial/SkyDome.tsx`, `engine/simulation/TimeOfDay.ts` | uniforms per frame | Rayleigh/Mie approx, contract uniform model (§11) |
| Volumetric clouds | `shaders/sky/cloudVolumetric.ts`, `environment/CloudLayer.tsx` | raymarch per pixel | slab raymarch, wind-advected fBm density, 3-sample sun occlusion; march budget = quality tier (particle fallback on low) |
| Lightning | `lib/math/bolt.ts`, `effects/LightningBolt.tsx` | on strike | deterministic jagged polyline (tested) near the viewer, additive, opacity rides the strike envelope |
| Volumetrics | `effects/PostFX.tsx`, `celestial/SunMesh.tsx` | per frame | GodRaysEffect with real occluding sun mesh (§12) |
| City | `lib/geometry/citygen.ts`, `textures.ts`, `buildings/City.tsx`, `environment/Ground.tsx` | on seed/quality | InstancedMesh + shader windows (§13–§15), seeded |
| Particles | `effects/AmbientParticles.tsx`, `ExhaustParticles.tsx`, `shaders/effects/*` | GPU drift / pooled CPU | bounded budgets (§21) |
| Lab | `components/world/lab/LabScene.tsx` | queue events | gravity/mass/spawn/solver/uncertainty controls (§16) |
| State | `state/stores/*`, `state/selectors`, `state/transient/frameState.ts` | — | persistent vs transient split (§20), hot path = plain object |
| Diagnostics | `ui/diagnostics/DiagnosticsOverlay.tsx`, `ErrorOverlay.tsx`, `lib/utilities/logger.ts` | 4 Hz sampling | FPS/frame/draw/tris/bodies/step/heap/GPU (§25) |
| Quality | `engine/rendering/quality.ts` | on tier change | 4-tier matrix across 8 subsystems (§26) |
| Assets | `src/assets/art/*` (AI-generated), `tools/extract-palette.mjs` | boot | bundled splash/portraits/billboards + palette-derived sky presets (§27) |
| Weather | `engine/simulation/Weather.ts`, `effects/RainSystem.tsx`, `CloudLayer.tsx`, `shaders/terrain/wetUniforms.ts` | seeded sample per frame | deterministic 240 s cycle: cloud→rain→wind→lightning; GPU rain streaks; ground soak/dry puddle field (§33) |
| Audio | `engine/audio/AudioSystem.ts`, `AudioLink.tsx` | per frame param sweep | WebAudio: pink-noise wind/rain, 2-osc engine w/ speed+boost mapping, thunder, UI blips; `KeyM` mute (§33) |
| Ambient AI | `entities/Dogs.tsx`, `entities/Pedestrians.tsx`, `entities/Birds.tsx`, `lib/math/paths.ts`, `lib/math/wander.ts` | per frame | seeded wanderers (shared tested behaviour), sidewalk circuit walkers, rain-sheltering bird flocks — all velocity-synced (§33) |
| AI traffic | `entities/Traffic.tsx`, `lib/simulation/traffic.ts` | per frame | cars on road-centred square loops: right-hand lanes, corner damping, rain-slowed, darkness/rain headlights (§33) |
| Camera collision | `entities/CameraRig.tsx`, `lib/math/raycast.ts`, `buildings/cityCollision.ts` | 1 segment cast/frame | chase boom clamps against published building AABBs (slab test, allocation-free) |
| Persistence | `state/stores/settingsStore.ts` (`persist`) | on change | mode, quality, seed, time-of-day, mute, home spawn in `aether-city-settings` (§20/§33) |

## Weather, audio & persistence (v1.0)

- **Weather** is a pure seeded function of simulation time (240 s cycle): cloudiness drives rain (smoothstep gate), wind, and lightning strikes (9 s mean, rain-gated). Rain soaks the ground — a shader puddle/dampness field that dries when the storm passes. Clouds thicken and the sky/fog desaturates toward overcast as coverage rises.
- **Audio** synthesizes everything at runtime (no audio files): filtered pink noise for wind and rain, a two-oscillator engine voice mapped from speed/boost/flight, thunder on lightning strikes, and UI blips. `M` mutes; the SYSTEMS panel has an audio toggle.
- **Persistence**: quality, seed, time-of-day, mute, and your home spawn point (saved as you explore) survive reloads. Spawning returns you to your last home.
- **Ambient life**: seeded dogs and pedestrians walk the city with velocity-synced gaits; pedestrians follow shared, unit-tested sidewalk circuits. **AI traffic** drives the road grid with right-hand lanes, rain-slowed speeds and headlights that respond to darkness and storms; **bird flocks** circle the skyline and land while it pours. The chase camera now collides with buildings (ray-vs-AABB clamped boom).
- **Storms are a show**: raymarched volumetric clouds build and darken with the weather cycle; lightning bolts strike visibly near the viewer (deterministic jagged geometry, opacity rides the strike envelope) synced with the thunder audio and sun flash; street lamps and car headlights ignite in rain and darkness.

## Validation results (executed, not claimed)

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`) | `npm run typecheck` | **PASS** (0 errors) |
| ESLint 9 flat + typescript-eslint | `npm run lint` | **PASS** (0 errors, 26 stylistic warnings: non-null assertions after verified API reads) |
| Unit/integration tests | `npm run test` | **PASS** (91/91 in 10 files: orbital reference values, Kepler solver, clock, seeded RNG, city determinism, vehicle math, spatial hash, floating-origin precision, interaction state machine, quality matrix, store sync) |
| Static shader gate | `npm run check:shaders` | **PASS** (brace/paren balance + §11 contract uniforms + marker scan) |
| Palette extraction | `npm run check:palette` | **PASS** (6 presets from committed sky art) |
| Production build | `npm run build` | **PASS** (664 modules, ~7 s) |
| Dev-server module graph | HTTP probes | **PASS** (13 deep modules serve 200; Vite 500s on transform errors) |
| WebGL render in browser | — | **UNVERIFIED in sandbox** (no GPU here). The dev preview is live; first browser load is the authoritative runtime test. Rapier WASM init, physics stepping and post-processing were validated only as far as build + API-typing + module-graph checks allow. |

## Known limitations

- GodRays/Bloom and raymarched clouds require a quality tier ≥ medium (LOW falls back to particle clouds and disables the composer by design).
- Circular-orbit (e ≈ 0) element roundtrips are excluded from tests: ω is mathematically degenerate there (covered by a dedicated circular identity test instead).
- Clouds are a raymarched analytic slab (fBm density field) — beautiful but not a full 3D fluid simulation. Dogs, pedestrians and traffic are visual-only (no physics bodies) — by design, to keep the 16.6 ms budget on the player and hero vehicle. Street wetness/puddles are a shading model, not a water simulation.
- Dialogue NPCs stroll within ~3 m of their anchor (reachable + framed correctly in dialogue) rather than roaming the whole city.
- Planetary radii are visually exaggerated ×3; orbital time is compressed ×260 (both documented in `SpaceScene.tsx`); ship physics itself is unscaled Newtonian.
- StrictMode is intentionally off (double-mounted WebGL/physics boot cost); effects are written idempotent regardless.
