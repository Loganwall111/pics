# Model & Asset Registry

Reference sheets and texture sources for every hand-built model in AETHER CITY.
All meshes are **procedurally constructed in code** (no external model files);
this document maps each model to its parts, materials and concept art.

## Concept sheets (AI-generated, committed under `src/assets/art/`)

| Sheet | File | Used by |
| --- | --- | --- |
| Player turnaround (front/side/back) | `modelsheet-character.jpg` | `components/world/entities/Player.tsx` |
| Dog turnaround | `modelsheet-dog.jpg` | `components/world/entities/Dogs.tsx` |
| Boot key art | `splash.jpg` | `components/ui/hud/LoadingScreen.tsx` |
| NPC portraits | `portrait-{nova,atlas,kai,juno}.jpg` | dialogue overlay |
| Billboard art | `billboard-{volt,orbital,mind}.jpg` | instanced city billboards |

## Photo PBR textures (AI-generated, committed under `src/assets/textures/`)

| Texture | File | Applied to |
| --- | --- | --- |
| Asphalt (seamless) | `asphalt.jpg` | road bands composited into the city ground canvas |
| Concrete pavers (seamless) | `pavers.jpg` | sidewalk/pavement base of the ground canvas |
| Brick masonry facade | `facade-brick.jpg` | building podium hulls (street level, variant A) |
| Stone/concrete facade | `facade-concrete.jpg` | building podium hulls (street level, variant B) |

The far-ground plane additionally uses procedural PBR maps
(`lib/geometry/textures.ts` → albedo + roughness + Sobel normal).

## Player character (visible third-person, `Player.tsx`)

Parts (all shared geometry, disposed on unmount): torso capsule (white tee) ·
hips block + per-leg shorts cylinders (denim) · bare-skin thighs/shins ·
sneaker boxes · sleeves + upper arms + forearms + hands · neck · head sphere ·
procedural face decal texture (canvas-drawn eyes/brows/lips) · bob haircut
(cap + back volume + bangs).

Animation: velocity-synced walk cycle — leg/arm swing phase and amplitude are
functions of rigid-body horizontal speed; heading damps toward the motion
vector; forward lean and vertical bob scale with gait; idle = neutral stance.
First-person (`V` / `F1` or the dock button) hides the rig and moves the
camera to the head.

## Dog (`Dogs.tsx`)

Parts: capsule body · head + snout + ears · 4 swing-animated legs · wagging
tail. Behaviour: seeded wander (waypoints + idle pauses) — deterministic per
`citySeed`, 2 dogs on LOW quality, 4 otherwise. Visual-only (no physics
bodies) to keep the 16.6 ms budget intact.

## Buildings (`City.tsx` + `citygen.ts`)

- **Tower hull** — instanced boxes with the facade shader: window frames,
  floor slabs, grime streaks (diffuse side) + window emission + sky-reflection
  fresnel (emissive side). All per-window work is GPU-side via `aWindow`
  instanced attributes.
- **Podium hull** — instanced 5 m street-level base wrapped in the generated
  brick/stone photo textures (two deterministic variants).
- **Billboards** — planes with the generated poster art on tall towers.
- **Street lights** — two instanced meshes (poles + glowing heads).

## Clouds (`CloudLayer.tsx`)

Procedural multi-blob sprite texture; 80–210 camera-facing puffs clustered
into 12 altitude banks with vertex-shader drift and sun-tinted shading.
Documented upgrade path: true raymarched volumetrics.

## Weather / audio / ambient AI (§33 systems, v1.0)

No new art assets — weather is procedural (pure seeded math), audio is synthesized at runtime
(WebAudio graphs, zero audio files), and ambient life reuses the procedural-figure approach
documented above.

- **Weather model** (`src/engine/simulation/Weather.ts`): 240 s seeded cycle. Cloudiness =
  √(lerped hash keys) ×1.15 clamped; rain = smoothstep(0.62, 0.88, cloud) × gust; wind =
  0.15 + 0.65·cloud + 0.1·sin(0.4t); lightning strikes every ~9 s (70 % fire chance,
  two-stage exponential envelope) only while rain > 0.45. `integrateWetness` soaks at
  0.22·rain·dt and dries at 0.05·dt, clamped to [0,1]; the value drives the ground shader's
  puddle field (`u_wetness`) and cloud opacity/tint.
- **Audio** (`src/engine/audio/AudioSystem.ts`): one shared pink-ish noise buffer feeds wind
  and rain voices through bandpass/lowpass chains; the engine is two detuned oscillators
  (saw+square → lowpass). Engine frequency = 42 Hz ground / 58 Hz flight base, ×1.15/×0.62
  per km/h, capped 220 Hz; gain = idle 0.035/0.05 + speed/160·0.1 + boost·0.09, capped 0.22;
  on-foot engine gain 0. Thunder = brown-noise burst, 130 Hz lowpass, 2.4 s decay.
  Pure mappings (`engineFrequency`, `engineGain`) are unit-tested.
- **Pedestrians** (`src/components/world/entities/Pedestrians.tsx`): 8 (3 on low) simplified
  figures with per-pedestrian clothing tints, walking closed square sidewalk circuits
  (`src/lib/math/paths.ts` — pure arc-length walk, wrap-exact, unit-tested). Dogs: 4 seeded
  wanderers (2 on low). Both use velocity-synced leg swing and heading damping at corners;
  no physics bodies by design (16.6 ms budget stays with player + vehicles).
- **Persistence**: `settingsStore` persists mode, quality, citySeed, timeOfDay, timeScale,
  mute, and home spawn (key `aether-city-settings`).

## Traffic, birds, wandering NPCs, camera collision (§33 completion, v1.0)

No new art assets — everything below is procedural and code-authored.

- **Traffic** (`src/components/world/entities/Traffic.tsx` + `src/lib/simulation/traffic.ts`):
  cars run square loops on road centrelines at `(k+½)·46` m (`streetLoopRadii`, unit-tested),
  right-hand lane offset 2.2 m, arc-length integration via the shared `squareLoopPoint`.
  Rain slows traffic to 70 % (`trafficSpeedFactor`) and forces headlights; darkness
  (dusk 18–20 h, dawn 05–07 h, full night) raises head/tail emissive intensity
  (`headlightIntensity`, unit-tested). Counts: 0 low / 8 medium / 14 high / 20 ultra.
- **Birds** (`src/components/world/entities/Birds.tsx`): flock orbits a slow drifting centre,
  per-bird slot offsets + flap phase; shelters (`visible=false`, work skipped) while
  rain > 0.45. Counts: 0 low / 5 medium / 8 high / 12 ultra.
- **Wander behaviour** (`src/lib/math/wander.ts`): one deterministic, replay-pinned
  implementation backs dogs (radius 26 m), dialogue NPCs (radius 3.2 m — engaged NPCs
  freeze and face you) and is unit-tested for determinism, home-disc containment and
  pause handling. Dialogue framing uses live positions (`npcShared.livePositions`).
- **Camera collision** (`src/lib/math/raycast.ts` + `buildings/cityCollision.ts`): City
  publishes world-space building AABBs at build time; the chase boom casts one segment
  per frame (Kay–Kajiya slab test, allocation-free) and pulls in to the hit minus a
  0.5 m skin (1.4 m minimum boom). Unit-tested: hits, misses, nearest-of-several,
  behind-ray, origin-inside, maxDist sentinel.
