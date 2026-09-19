# Devouring Storms — build-loop overhaul

**Repo:** `Loganwall111/Lowuuuuuu` · **Live branch:** `arena/01a0b039-lowuuuuuu` (last commit 2026-09-19T14:03:57Z)
**Delivered:** 2026-09-19

---

## Read this first: two things about your repo

**1. `main` is ten days stale.** Its HEAD is `2026-09-09T13:22:31Z`. It has no `ci/`, no `VERSION`, no `build.gradle` — none of the build system. Everything real lives on `arena/01a0b039-lowuuuuuu` (today), which is where I worked. If you have been looking at `main` wondering where things went, they are on the branch.

**2. Your build is green — but not at the tip.** `ci-out/run-708` shipped `devouringstorms-7000.0.25-M.jar`, `javac: exit 0`, 283 classes, `VERDICT: FULL BUILD`.

**`ci-out/run-709` — the newest run recorded in your own tree — is red, and it dies *before* javac.** It reaches `shimcheck: 165/174 pass`, prints `[glsl] shader gate FAILED — not building a broken shaderpack`, and exits 1. `ci-out/run-709/classes.txt` is empty because **javac never ran and no classes were produced.** The branch tip does not build. Patch 03 fixes it; see Finding 1.

---

## The actual problem

Of the **152 build runs** recorded in `ci-out/`, **43 died at javac.** Mining every `JAVAC_FAILED.txt`:

| error class | count |
|---|---:|
| cannot find symbol | 134 |
| incompatible types (lossy double→float) | 33 |
| moved/renamed API (`method vertex in class`) | 32 |
| missing package | 22 |
| **lambda capture not final** | **17** |
| duplicate local variable | 4 |

That is roughly a **28% red-build rate**, and the cost is unusual here. Your own workflow file says it:

> *"the sandbox has no JDK and no route to Mojang/Maven, so every push … builds the full jar on a runner that has both."*

So every mechanical Java mistake costs a full `edit → push → runner → red` cycle. You cannot compile locally. You find out on the runner.

**And the guard against exactly this already existed — but was never switched on.**

`ci/check_java_balance.py` is a good, careful piece of work: 130 lines, correctly comment-, string-, char- and text-block-aware. Its own docstring says it exists so that *"a syntax error in a Java file costs a full CI round trip"*.

I grepped `ci/build.sh` for it:

```
$ grep -c check_java_balance ci/build.sh
0
```

Zero call sites. It has never once stopped a build. (It is also why it reports `all 0 file(s) balanced` — it takes files as argv and CI passes it none.)

That is the whole finding: **you built the net and never hung it.**

---

## What I built

`ci/preflight.py` — a static Java preflight that runs in `build.sh` *before* javac, folding in the balance check and adding the classes that actually recurred.

| rule | catches | corpus hits | blocking? |
|---|---|---:|---|
| `balance` | unbalanced `{}` `()` `[]` | — | yes |
| `lambda-capture` | effectively-final violation | 17 | yes |
| `dup-local` | re-declared / shadowed local | 4 | yes |
| `multidecl` | `Vec3 a = x0, y0, z0;` (see below) | 1 | yes |
| `lossy-float` | double→float narrowing | 33 | yes |
| `unused-import` | stale imports | 49 | no — advisory |
| `api-drift` | member absent from the javap dump | — | no — advisory |

### Why some rules are advisory and not blocking

This is the most important design decision in the whole thing.

`api-drift` **cannot** be blocking. Every dump in `ci-out/` comes from `javap -p`, which prints *declared* members only — inherited members are invisible. `PathfinderMob.createMobAttributes()` looks absent from the dump even though it is inherited from `LivingEntity` and compiles perfectly. Two such notes exist in your tree right now. If that rule failed builds, you would delete the gate within a week.

`unused-import` is left advisory for the same reason: it is a real defect but not an error.

A gate that cries wolf gets switched off, and then it protects nothing. Blocking rules are restricted to findings that are *guaranteed* javac errors.

---

## A real logic bug I found while building this

From `ci-out/run-653`, `McsmCoreEngineController.java:223`:

```
error: variable y0 is already defined in method cubeFace(Pose,VertexConsumer,...)
        Vec a = x0, y0, z0;
```

The author meant `new Vec3(x0, y0, z0)`. It is not a constructor call — it is a *declarator* that initialises `a = x0` and then re-declares `y0` and `z0`.

The reason this matters beyond the compile error: once you silence the declaration errors, `a` is **a copy of `x0`** — not a vector. Whatever `cubeFace` renders is silently wrong, and it would look like a rendering bug, not a typing mistake. That is what the `multidecl` rule exists to catch, and it reports the *intent* (`did you mean new Vec(...)`), not just the syntax.

---

## Proof

**Tests — 9/9 passing.** Fixtures are built from verbatim snippets out of `JAVAC_FAILED.txt`, so they are real failures, not invented ones.

```
$ python3 ci/tests/test_preflight.py
  ok   unbalanced bracket is caught
  ok   lossy double->float is caught
  ok   non-final lambda capture is caught
  ok   constructor-lookalike declarator is caught
  ok   clean file reports nothing at all
  ok   LossyFloat.java has exactly one finding, on the broken method
  ok   LambdaCapture.java has exactly one finding, on the broken method
  ok   all 7 checks exercised
  ok   exit codes: findings -> 1, clean -> 0
preflight tests: 9 passed, 0 failed
```

**On your tree — clean, and the gate will not block your build:**

```
$ python3 ci/preflight.py --roots
[preflight] 220 file(s) scanned -- 0 blocking, 2 advisory
[preflight] symbol oracle: 64 class(es) from 116 javap dump(s)
[preflight]   note   api-drift        2
exit=0
```

The 0 blocking is the correct result: your tree compiles, so there is nothing to block on. The gate's job is the *next* mistake, not this one.

### The false-positive work

I am flagging this because it is the part that decides whether a gate survives.

My first run reported **472 findings**. Most were mine, not yours. Each one is now a regression test in `fixtures/Clean.java`:

- **`"" in "dD"` is `True` in Python.** My suffix test read *every integer literal* as a double, so `float tot = w[0]+w[1]+w[2]+w[3]` was "lossy". 308 findings. The suffix must decide first.
- **17 legal `catch (Throwable t)` clauses** in one method in `McsmBuiltinPackMixin.java` read as duplicates. A catch parameter is scoped to *its own block*. The scope walker now defers catch/for/pattern variables to the block they guard.
- **`gx`/`gz` declared inside a lambda** were reported as captured from outside. A variable declared inside a lambda cannot be captured by it.
- **Two sibling `if (x instanceof ServerLevel server)`** in `McsmVoidLurker` are legal — pattern variables are block-scoped.
- **`Mth.sin(t * 1.1F)`** was "lossy" because my number regex matched the `1` inside `1.1F`.
- **`m.start("name")` is already absolute.** I added the match position to it, so every offset was double-counted and findings pointed at unrelated lines.
- **`return out;`** matched as type `eturn`, name `out` — mid-identifier matching. And `double`/`int` are Java keywords, so an early version silently discarded *every primitive declaration*.

472 → 49 → 0 blocking.

---

## Finding 1: the tip does not build (patch 03)

`ci/build.sh` runs `glslcheck/shimcheck.py` as a hard gate — its `else` branch prints *"not building a broken shaderpack"* and `exit 1`. On the tip it fails in **nine of nine** define variants of one file, always with the same three errors:

```
FAIL mcsm-core-shaders/core/final.fsh [plain] [lit] [misc] [rev]
     [sky_position] [void_body] [void_body_lit] [void_body_rev] [glow_white]
ERROR: 0:1643: 'fractalPhase' : no matching overloaded function found
ERROR: 0:1643: 'assign' : cannot convert from ' const float' to ' temp 3-component vector of float'
shimcheck: 165/174 pass
```

One cause, one line. `final.fsh:317` declared

```glsl
vec3 fractalPhase(vec2 uv, float time, float glitchFactor, vec3 baseColor, float seed) {
```

and the single call site at line 414 passed **four** arguments. `baseColor` is never read anywhere in the body. glslang has no matching overload, so the file cannot compile in any variant — and because the gate sits before javac, one dead parameter stopped the entire jar from being built.

The fix removes the parameter rather than feeding the call site a fifth argument, because the neighbours this function is written alongside — `lavaHellscapePhase`, `iceVoidPhase`, `spaceNebulaPhase` — all take exactly those four and are standalone worlds that do not composite over the scene. A declared-but-ignored parameter reads as compositing that does not happen.

**Verified locally:** `shimcheck: 165/174 pass` → **`174/174 pass`, exit 0.** Run it yourself with the exact build invocation.

## Finding 2: the storm ran on three different phase timelines (patch 03)

`ci/palette_tables.py` is your declared single source of truth for the storm's colours, and it states the routing the whole build is keyed on:

```python
TEAL_TO_PURPLE = (5.10, 5.50)
PURPLE_TO_ROSE = (5.75, 6.05)
ROSE_TO_EMBER  = (7.00, 8.05)
```

with the comment *"identical in sky.fsh, position.fsh and McsmStormPhase.java"*. That was true — and nowhere else. Two more files route phases, and both were outside that module:

| file | its own windows | ember stage? |
|---|---|---|
| `StormPalettes.java` | 4.95 / 5.30 / 5.52 / 5.92 | **none** |
| `McsmStormAtmosphere.java` | 5.00 / 5.50 / 5.50 / 6.00 | **none** |

Both are live: `StormPalettes` paints the base mod's fog, cloud deck and pulse glow (the decompiled base mod links against it), and `McsmStormAtmosphere` is what `StoryModeSkyTint` asks for the sky tint. Neither had an ember stage, so each one's last ramp finished at **~6.15** while `sky.fsh` kept easing to **8.05**. For the final quarter of the storm's arc every fog, cloud, pulse and sky-tint colour was frozen while the shader above it carried on moving — which is why the storm reads as "not really changing".

Three further defects fell out of the same hole:

- **Fog painted a colour no sheet contains.** `FOG_TEAL` was `(0.060, 0.280, 0.270)` — a saturated green. The phase-5 sheet's horizon stop is `#202E34`. The fog is now the traced horizon stop of the sky it sits under.
- **The cloud deck was two different decks.** The shader ships four cloud constants (`MCSM_CLOUD_TEAL / _PURPLE / _ROSE / _EMBER`); `cloudColor()` used a different set of three. It now uses the four the shader ships.
- **A dead branch.** `pulseColor()` recovered its early-storm colour as `1 - (w0+w1+w2+w3)` *after* `stageWeights()` had normalised those weights to sum to 1, so the expression was identically zero. `PULSE_EARLY` could only ever appear through the degenerate `tot < 1.0E-4` early-return — i.e. as a violet flash below phase 4.95 that hard-stepped to green in one frame. It is now faded smoothly by `McsmPhaseTimeline.presence()`.

`McsmPhaseTimeline.weights()` expands the shader's nested `mix` into four coefficients that sum to **exactly** 1 by construction, so callers no longer normalise and the degenerate zero-total branch is gone entirely.

**The guard:** `palette_tables.check_routing()` fails the build if any Java file outside `McsmPhaseTimeline` states a phase window, or if either consumer stops delegating. Verified both ways — **exit 1 on the pre-fix tree, exit 0 on the fixed one.**

## Finding 3: Java and the shader were drawing different mouths (patch 04)

GROUND_TRUTH §D.1 makes the **teeth** your number-one priority fix, and `check_phase_uniform.py` states the contract in as many words — *"the teeth are WHITE at every storm phase; the aura is what changes colour"* — then enforces it on the shaders. `mcsm_teeth_color()` returns `vec3(1.0)` for `p >= 4.0`.

`McsmTeethPhaseTint` said exactly that in its header, and then did the opposite in its tables. Comparing the two implementations phase by phase, they disagreed on **every single row**:

| phase | shader teeth | java teeth | shader aura | java aura |
|---|---|---|---|---|
| 4 | white | `(1.00,0.45,0.85)` | `(0.55,0.80,1.00)` | `(0.25,0.50,1.00)` |
| 5.0 | white | `(1.00,0.35,0.90)` | `(1.00,1.00,1.00)` **pure** | `(0.30,0.55,1.00)` |
| 5.2 | white | `(0.85,0.40,1.00)` | `(0.50,0.78,1.00)` | `(0.22,0.48,1.00)` |
| 6 | white | `(0.70,0.35,1.00)` | `(0.22,0.42,1.00)` | `(0.18,0.42,1.00)` |
| 7 | white | `(0.90,0.30,0.95)` | `(0.36,1.00,0.28)` **green** | `(0.20,0.50,1.00)` |
| 8 | white | `(0.80,0.40,1.00)` | `(0.35,0.58,1.00)` | `(0.25,0.55,1.00)` |

This is the *"the mouths never matched the reference frames"* symptom that very header claims to have fixed. A later "V2 revamp" moved the Java tables without moving the shader, and because the gate only ever inspected the shaders, nothing caught it. Java now takes its values from `mcsm_teeth_color()` / `mcsm_aura_color()` verbatim, verified numerically equal at all five ramp stops.

Two more defects in the same file:

- **`glowStrength = Math.max(glowStrength, 4.5F)` was a one-way ratchet** written straight into the player's persistent config. Walk near one storm once and your bloom setting was 4.5 in every world, forever, with nothing able to lower it. Eight further config fields were written every tick with no restore, so a storm's last frame outlived the storm and became your "normal" colours. The fields are now snapshotted at phase 4 and handed back when the storm leaves.
- **`if (true) { ... }`** around the beam colours — an unconditional block wearing a condition it never tested.

**One thing I deliberately did not change.** GROUND_TRUTH §G.3 asks for teeth *"intensity ~1.15 — not the old pure-white 2.4 blast"*, while `check_phase_uniform.py` pins a **4.0x** floor and the entity shader carries `MCSM_MOUTH_GAIN = 4.0`, citing a later brief. Those two instructions contradict each other and nothing in the tree says which supersedes which. Rather than silently pick one, patch 04 fixes the colours (provably wrong) and leaves the brightness alone. **That one is your call** — if §G.3 wins it is a single number in the force block plus the gate's expectation.

## Apply it

```bash
git checkout arena/01a0b039-lowuuuuuu

# 1. the gate
cp ci/preflight.py           <repo>/ci/preflight.py
cp -r ci/tests               <repo>/ci/tests

# 2. run the tests before trusting it
cd <repo> && python3 ci/tests/test_preflight.py     # expect 9 passed, 0 failed

# 3. wire it into the build
git apply patches/01-wire-preflight-into-build.sh.patch

# 4. clear the 49 stale imports so --strict is clean
git apply patches/02-remove-unused-imports.patch

# 5. unbreak the GLSL gate, and put the storm on ONE phase timeline
git apply patches/03-build-gate-and-phase-timeline.patch

# 6. make Java's teeth/aura tracks say what the shader actually draws
git apply patches/04-teeth-aura-match-shader.patch

bash -n ci/build.sh          # syntax check
```

Patches 01 → 02 → 03 apply cleanly **in that order** to a pristine tip; verified with `patch -p1 --dry-run` against `09ae521`, and the result was byte-identical to the tree these were cut from.

Then, on the runner:

```bash
python3 ci/preflight.py --roots              # 0 blocking, 2 advisory
MCSM_PREFLIGHT_STRICT=1 bash ci/build.sh     # strict mode for releases
MCSM_PREFLIGHT=skip   bash ci/build.sh       # escape hatch, always available
```

**Patch 02 is provably safe.** Every changed line is a removed `import`; there are zero added lines. Verified mechanically:

```
$ grep -E '^[+-]' patches/02-remove-unused-imports.patch | grep -vE '^(\+\+\+|---)' | grep -vc '^-import '
0
```

---

## What I could not do, honestly

- **The GLSL fix is verified; the Java edits are not compiled.** `shimcheck` is a real compiler run (glslang) and it goes 165/174 → 174/174, so Finding 1 is proven, not inferred. The phase-timeline edits in patch 03 are Java: they are held to `preflight`, `check_phase_uniform` (520/520) and `palette_tables`, and the public surface of the two base-mod replacement classes was diffed member-by-member against the decompiled call sites — but no `javac` ran on them. Treat the first green runner as the real confirmation.
- **`refs/GROUND_TRUTH.md` is a Git LFS pointer.** Your `.gitattributes` on this branch (Build #482) keeps code and text as plain text, and that file is `.md` — but it was committed while the path was still LFS-tracked, so a plain clone yields a 129-byte pointer while CI (which sets `lfs: true`) sees the real 5,259-byte document. The recovered text is in `reference/GROUND_TRUTH.md` so nobody has to fetch LFS to read the spec. Worth re-committing that one file as plain text.
- **I cannot compile.** This sandbox has no JDK, no Gradle, and no route to Maven Central, Fabric Maven or Mojang — the same constraint your workflow file documents. I could not run `javac` against my own changes, and I could not run `bash ci/build.sh` end to end. Every claim above rests on running the Python tooling and reading the corpus, not on building the jar.
- **I could not push.** The `arena-ai-coding-agent` token has `push: false` on your repo. The patches are therefore files, not commits.
- **The rules are a lint, not a compiler.** They catch the mechanised classes; they cannot catch a genuine type error or a wrong API name in general. `api-drift` is a *hint* backed by a hardcoded 47-class dump, and it says so when it fires.
- **I did not touch gameplay.** No tornado core, no cinematics, no textures. I chose the build loop because 43 wasted runs is a measurable tax on every one of those, and because it was the one thing I could verify without a compiler.

---

## Where the real leverage is next

Two things worth doing, in this order:

1. **Widen the API oracle.** `ci/build.sh:975` dumps `javap` for a hardcoded list of ~47 vanilla classes, truncated at 220 lines (900 for `Blocks`). Its own comments record the cost — *"run 508 asked for WHITE_CONCRETE and the dump could not answer."* Meanwhile the top unresolved symbols in the corpus are `ClientPlayNetworking` (9), `getDescriptionId()` (9), `smoothstep` (8), `getSharedSpawnPos()` (8), `getTimeOfDay` (8) — all absent from the list. Enumerating the whole client jar instead of a hand-kept 47 would turn 134 blind guesses into lookups.

2. **Then** the roadmap's own ordered list: tornado core → phase-transition cinematics → defeat cinematic → texture pack.

---

## Files

```
ci/preflight.py                    the gate (7 rules, wired before javac)
ci/tests/test_preflight.py         9 tests, fixtures from the real corpus
ci/tests/fixtures/                 5 fixtures, incl. Clean.java anti-FP guard
patches/01-wire-preflight-into-build.sh.patch
patches/02-remove-unused-imports.patch
patches/03-build-gate-and-phase-timeline.patch   GLSL gate fix + one phase timeline
patches/04-teeth-aura-match-shader.patch         teeth white, aura = shader, config no longer ratcheted
reference/GROUND_TRUTH.md                        your design spec, recovered (see note)
evidence/corpus-analysis.txt       152 runs / 43 failures, by error class
evidence/preflight-results.txt     the run output on your tree
```
