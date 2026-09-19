# MCSM reference frames — ground truth (user batch 2026-09-07)

These are the frames the user said were required from the start. Catalogued
from the attached screenshots so every later change can cite them.

> **Recovered copy.** The file at `refs/GROUND_TRUTH.md` on
> `arena/01a0b039-lowuuuuuu` is a 129-byte **Git LFS pointer**, not this text —
> even though that branch's `.gitattributes` ("Build #482 Sift Cosmos") keeps
> code and text as plain text. So the document is committed as code/text but was
> written while the path was still LFS-tracked, and the working tree only ever
> contains the pointer unless LFS is pulled. `actions/checkout` in
> `.github/workflows/build-mcsm.yml` sets `lfs: true`, so CI sees the real text;
> a plain `git clone` does not. This is the real content, kept here so it is
> readable without an LFS fetch.

## A. Sky / phase fog palettes (gradient strips + in-game skies)

| Label | Look |
|---|---|
| **Day / noon** | Clear mid-blue zenith → soft lavender / pale-lilac horizon. Not beige. Not washed pink. Clouds are white blocky decks with soft blue undersides. |
| **Day (EnderCon / Beacon Town)** | Same blue vault; hard sun; long crisp tree/building shadows on ground and roofs; warm stone; emissive lanterns. |
| **Phase 5 turquoise** | Dark teal-green zenith → pale mint horizon. Desaturated. |
| **Phase 5.5–5.9 purple** | Near-black / deep indigo-purple zenith → magenta mid → **salmon-pink / hot-pink horizon**. Big purple wash in the vault. Storm body is pure black silhouette against it. |
| **Phase 6 / late** | Deep purple vault, pinker ground fog; sometimes orange-magenta dusk under the storm. |
| **Green phase** | Olive-green full-sky wash over ruined towns. |
| **Night (no storm)** | True deep blue, soft blue radial ambient — not purple. |
| **Formidi / post** | Gold explosion dome; then blue night with black storm silhouette. |

## B. Storm body / mouths / teeth (the money shots)

1. **Teeth = body detail, not glare.** Each mouth is a **U-shaped arc of chunky bright white/cyan rectangular blocks** (dotted ring / dashed smile). Close-ups show discrete glowing cubes, not thin dashes, not a solid bar.
2. **Magenta/pink cube** sits **above** each mouth (emitter).
3. **Tractor beams** are thick **purple or blue cones** with sparkle motes riding down the cone.
4. **Black debris cubes** constantly peel off the silhouette and orbit.
5. **Early / OG form (summon)**: classic **three black wither heads** + **command block belly** (orange-brown face with coloured button grid) embedded in black flesh, often hanging in a chamber with a glowstone. Blue eye dots on some heads. This is the start look before the devourer blob.
6. **Grown devourer**: pure black mass, multiple mouths on the underside, tentacles, no orange classic skin. Command block may still glow in the core.
7. **Glare / aura**: soft colour wash glued to the storm and sky (blue early, purple 5.5+). **No three-headed symbol disc** floating far behind. Silhouette stays readable; atmosphere above can go black/purple.

## C. World / spectacle

- Beacon Town / EnderCon: **vivid** colour, multi-coloured beacon beams, **hard dynamic shadows** under players and trees.
- Sky Island: white/gold floating city **high above** a sea of blocky white clouds (void gaps between decks).
- NPCs: full crowds in halls; named cast in towns.
- Bowels / interior: blue-tinted block mass, lanterns, tentacles through rooms.
- Particles: pink/magenta starbursts, purple motes, black cubes, beam sparkles.

## D. Priority fix order (from these frames vs current jar)

1. **Teeth** → chunky white dotted U-arcs + magenta emitter cube (match close-ups).
2. **OG summon / early model** → 3 heads + command block belly must read on spawn.
3. **Phase sky palettes** → retune day + 5.5–5.9 + turquoise strips to sampled tones.
4. **Beams** → thicker purple/blue cones + sparkles.
5. **Black cube field** → denser, always on at phase 5+.
6. **Vivid shadows** → already pushed in 1.9.148; keep matching Beacon Town roof shadows.
7. **Sky Island altitude** → already ~y4200; keep cloud decks under it.

## E. Frame 2026-08-24 (user crash-batch image)
Close-up of multi-mouth black mass against purple/pink sky:
- pure black blocky body with **blue sheen stripes under/through the black**
  (glossy reverse-shading)
- cyan-white **dotted U-arc teeth** (individual glowing cubes)
- hot **magenta square emitters** above mouths
- thick **purple tractor beam** cones with black debris cubes peeling off

## F. Post-155 corrections (1.9.156 targets)

1. Glare = giant **3D world-space gradient volume** (nested spheres on storm centre), not 2D billboard plates. Traversable / visible from behind; storm locked; no player-opposite parallax.
2. **No** halo-side/under dots, black cubes, orbiting motes, debris field.
3. Calm night = deep **blue** fabric skybox + navy fog (never purple/magenta).
4. Stage 0 = 64×96 atlas with black 3-head + Formidi command-block belly UV at texOffs(0,64).
5. Phase-only left/right sway shared by volume + body detail.

## G. Body skins (user frames phase-4 + phase-6)

1. **Phase 4 skin** (covers grown body from phase ~4 through 5.9, and the
   early post-summon mass before Formidi split): pure **black block mass**,
   soft **cyan-white dotted U-arc teeth** (toned, not pure white), hot magenta
   emitter cubes above mouths, purple tractor beams. Atlas =
   `phase_4_assets(_og).png` via `StormSkins.phase4()`.

2. **Phase 6+ / devourer skin** (post-Formidi three-storm era, phase 6→9):
   multi-lobe **black mass** with **blue sheen under the black**, cyan teeth,
   magenta/purple eye clusters on the body, blue tractor beams. Atlas =
   `devourer_assets(_og).png` via `StormSkins.devourer()` when `state.devourer`.

3. Teeth brightness: soft cyan-white (~200,235,245), intensity ~1.15 — not
   the old pure-white 2.4 blast.
