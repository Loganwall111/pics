# LUMITAL — psychedelic multiverse evolution explorer

A second game in this repository, living beside Aether City (`lumital/`).
React 19 + Three.js + @react-three/fiber, deps shared from the workspace root.

**Run:** `npm run dev:lumital` → http://localhost:5174 (Aether City stays on 5173).
**Deploy anywhere:** `npm run build:lumital` produces a fully static site in
`lumital/dist/` (one `index.html` + hashed assets) — host it on GitHub Pages,
Netlify, Vercel or any static server. It is a normal website: no backend, no
downloads.

## The pitch

Pick one of **108 deterministic creature species** from the genesis catalog.
Begin as that creature in the Psychedelic Void. Cross glowing portals through
six worlds — kaleidoscope nebulae, a raymarched Menger labyrinth, the
**gravitationally-lensed event horizon** of a black hole, the inside of a cell
(microscopic), a bioluminescent ocean, and a violet alien monsoon. Collect DNA
motes, **evolve your body live** (limbs sprout, glow brightens, speed rises),
and **seed colonies** to grow your lineage's empire (5 colonies = EMPIRE).

## What's real (v0.2)

- **v0.2**: 120 species (was 108); every world walks on its own photo-PBR texture (psychedelic meadow, cell membrane, grass, wet soil, stone); **colonies are real hamlets** (three glowing huts + hearth light each); **synthesized audio** — per-world ambient drone beds, pickup/portal/evolve/colony sounds, `M` mute; **V/F1 first-person toggle** (camera rides the creature's head).

- **Creature genesis** (`game/creatures.ts`): 120 species from seeded syllable
  tables + full body plans (limbs, eyes, tail, antennae, fins, glow, pattern,
  hue) — deterministic, unique names, all unit-pinned.
- **Creature renderer** (`scenes/Creature.tsx`): every body-plan field renders;
  gait is speed-synced; evolution traits morph the body instantly.
- **Six worlds** (`game/worlds.ts`): each with a pure analytic terrain function
  (the physics the controller walks), palettes and fog. Determinism + bounds
  tested.
- **Black hole** (`scenes/shaders.ts`): true per-pixel geodesic lensing
  (d²x/dλ² = −1.5·h²·x/r⁵, rs-scaled), procedural starfield sampled along the
  bent ray, photon ring, accretion disk with banded heat and beaming-side
  brightening; capture/structure constants pinned by JS-twin tests
  (`game/blackhole.ts`, photon capture at b < (3√3/2)·rs).
- **Menger labyrinth sky**: 4-iteration periodic Menger raymarch; the ground
  maze walls derive from the same terrain function.
- **Journey loop**: DNA motes (E not needed — walk into them), portal cycle
  (+30 DNA adaptation bonus), evolution overlay (E; 6 traits with escalating
  costs), colony seeding (B, 5 → EMPIRE), journey log.
- **Controls**: WASD + Space, drag to orbit, E evolve, B colony.

## Honest status

v0.1 is a real, playable vertical slice — not the full design: creature
movement is kinematic over analytic terrain (no engine physics), worlds are
single-player and local, "empires" are colony counters, and the menu's
animated background is CSS (the shader showpieces are in-world). Evolution
covers the survival/morph loop; towns are the colony seeds. The structure
(worlds as data, pure terrain fns, reducer-driven journey) is built for the
next phases.
