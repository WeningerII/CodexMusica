# Changelog

All notable changes to this project are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This file replaces the former
`docs/plans/` collection of point-in-time planning documents.

## [Unreleased] — production hardening

### Added
- **Genre expansion (focused everynoise cut) completed: six new traditions**
  (1113 → 1119): `gengetone` (revived from the PR #33 revert), `manele`,
  `chalga`, `marrabenta`, `murga_uruguaya`, `shangaan_electro` — the full
  vetted-gap queue from the darkpsy pilot recon. Each modeled to full standard
  (catalog entry + extras with hand-authored axes/description/exemplars,
  era-correct rooms/chains, part-variant picks) and verified: validate clean,
  placement pre-flight, per-entry coherence audit, compiled recipes distinct
  and ≤1000 chars. One new tree node (`carnivalProcessional.riverPlate`, 311 →
  312) places Río de la Plata carnival; murga crossRefs candombe's
  `groovePercussion.latinAm` and `protestSong.iberianLatin`.
- **Placement policy decided (the PR #33 question): accuracy over strict
  additivity.** New genres are placed where they genuinely belong even when
  that updates relatives' genre-signature neighbor lists; the affected recipes
  are inspected diff-by-diff and re-blessed. Gengetone's accurate
  `mcRhythm.intlHipHop` placement updates 4 relatives (genge_kenyan,
  bongo_flava, mahraganat, algerian_rap): "korean rap" → "gengetone" in their
  neighbor lists — gengetone is genuinely the nearer neighbor — plus a
  one-descriptor budget ripple where the shorter name freed recipe chars.
- **`rompler_workstation` instrument** (418 → 419, the genre cut's
  instrument-add): the ROM-playback workstation / arranger keyboard the
  electronic family lacked — Korg M1 / Roland JV / Yamaha-PSR-Casio home /
  Korg Pa arranger lineages, preset-bank part (GM combo, MIDI-marimba, oriental
  arranger, dance stabs, piano/orchestral), use-context part, and membership in
  the shared `electronic_technique` applies_to pools. Carries shangaan
  electro's MIDI-marimba signature and manele/chalga's wedding-circuit arranger
  sound; used by no pre-existing tradition, so zero recipe churn from the add
  itself.
- **Two palette-gap variants, anchored by the proper-noun-stem discipline**
  (zero spurious cross-genre bleed, verified by sweeping the scorer over all
  1119): `southern_african_bantu_vocal_tradition` (voice_tradition #34 — Zulu/
  Xhosa/Tsonga choral chant; wins exactly kwaito, gqom, maskandi, isicathamiya,
  mbaqanga, south_african_kwaito, shangaan_electro, all previously stamped with
  the West-African `yoruba_tonal_vocal_tradition`) and
  `choir_regional_rioplatense_murga` (murga block-chorus; wins exactly
  murga_uruguaya — previously the tie-broken pick was Georgian
  `kakhetian_three_voice`). Both fix visibly wrong-region tokens in rendered
  recipes; the Bantu reassignments are accuracy improvements re-blessed under
  the placement policy above.
- **check_docs count-gate hardened against the forms that actually drifted.**
  The darkpsy artifact regen (1112 → 1113) left AGENTS.md, SKILL.md,
  index.html, and package.json stale because the gate only matched a bare
  "N traditions". Now gated: modifier forms ("N recorded-music traditions",
  line-wrapped counts), adjectival forms ("1119-tradition codex", "312-node
  genre tree", ≥3 digits so example builds don't false-positive), SKILL.md §1
  table rows, loader-output shorthand ("loaded: 419 insts, 1119 trads"), and
  the derived facts "global dominates at 678/1119" and "288 of 312 ids contain
  dots"; package.json joined the scanned surfaces. All doc counts trued up to
  1119/419/312 in the same pass.

- **Default build flipped to the lazy shell (phase 4 — the flip).** `npm run
  build:html` (and `node scripts/build_html.js` with no flags) now produces the
  lazy shell, and the committed `codex.html` is that shell (~2.5 MB vs ~6.3 MB
  embedded): it deploys beside the static `api/` and boots from
  `api/browse.json`. `--embedded` builds the historical fully-self-contained
  single-file variant; `--embedded` and `--lazy` are mutually exclusive. The
  gates that boot the page in a no-fetch sandbox were retooled to build the
  `--embedded` variant from the same source — `equivalence.js`,
  `app_recipe_regression.js`, `tandem.js` (its HTML-artifact + import-simulation
  checks), and `ui_reachability_check.js` (headless Chromium can't fetch `api/`
  over `file://`); each is sound because `check_lazy_app.js` proves the shipped
  shell is behaviorally identical to that embedded build. `tandem.js` also now
  asserts the *shipped* `codex.html` is a true shell (no embedded tradition
  tables; carries `CODEX_LAZY_API`). The freshness/reproducibility job rebuilds
  the lazy shell by default and byte-diffs it against the committed copy. The
  shell↔embedded parity is registered as the `lazy-shell-parity` promise
  (`check_lazy_app.js`), and `faults.js` plants a one-tradition `browse.json`
  desync to prove that gate is two-sided. *This is the GitHub Pages deployment
  model going forward: the lone-file / open-from-`file://` property is dropped
  in favor of one hosted app + static API.*
- **Lazy shell build + parity gate (phase 3 of the lazy-load migration).**
  `node scripts/build_html.js --lazy` (`npm run build:html:lazy`) assembles the
  thin-shell variant of the app: the two tradition tables (~3.7 MB, 66% of the
  embedded data) stay out of the page and a build-injected `CODEX_LAZY_API`
  const switches `src/app.js` onto its `CATALOG_READY` boot path — ONE fetch of
  `api/browse.json` before UI init, with a persistent, honest boot-error state
  (not a blank app) if that fetch fails. The embedded build's init stays fully
  synchronous and byte-identical in behavior. `scripts/check_lazy_app.js`
  (`npm run test:lazy`, in the `npm test` chain so CI runs it) boots BOTH
  builds in jsdom — the lazy one against the committed `api/` through a fetch
  shim — and asserts behavioral identity: the app-facing catalog projection
  deep-equal across all traditions, `renderTradPicker()` innerHTML
  string-identical for the tree and search queries, a six-tradition import
  producing identical cards and an identical `compressRichRecipe` string,
  exactly one (cached) fetch per imported tradition, plus both failure paths
  (browse index unreachable → boot-error state; tradition 404 → zero cards +
  error toast). `--check` on a lazy build also fails closed if the tradition
  tables ever leak back into the page. *(Phase 4 flipped the default build to
  this shell and made the committed `codex.html` the shell — see the entry
  above.)*
- **`Catalog` data layer in the app (phase 2 of the lazy-load migration).** Every
  tradition read in `src/app.js` now routes through one `Catalog` object — direct
  `TRADITIONS` / `TRADITION_EXTRAS` access survives only inside its boot function.
  Two boot modes: *embedded* (the tables are present as globals — today's
  single-file `codex.html` and every node/jsdom gate harness; behavior is
  byte-identical) and *lazy* (`Catalog.bootFromIndex(browse)` boots from
  `api/browse.json` and `Catalog.ensureFull(id)` fetches a tradition's import
  payload once, on demand). `importTradition` stays intentionally synchronous
  (tandem's sandbox checks call it directly), reading the Catalog cache; the
  UI entry points (`importTraditionWithFeedback`, the sidebar staple button)
  await `ensureFull` first — the ONE await on the import path, a few hundred
  bytes, cached per tradition.
- **`api/browse.json` — Tier-1 browse index (phase 1 of the lazy-load migration).**
  `build:api` emits a per-tradition index carrying everything the browse surfaces
  read — id, name, family, lineage, parent, a compact 13-axis array, instrument
  ids, full description, exemplars, crossRefs (~1 MB for 1112; gzips ~4:1) — and
  `check_api` validates it (complete count, ids match the catalog, 13-axis shape,
  app-facing fields present). Search, tree, find-similar, and fingerprints run
  locally off this ONE fetch with recall and display identical to the embedded
  build. The only fields excluded are what an *import* needs (tuning/room/parts/
  chain_*): those ship per tradition as a new `source` field in
  `traditions/{id}.json` (a verbatim projection of the catalog row, gated by
  `check_api` against drift), fetched only when a tradition is imported — lifting
  the single-file memory ceiling (~3–5k traditions) with no server and no
  per-action lag on browse interactions. *Index, `source`, gates, and the app's
  data layer landed; the build-shell flip is the next phase.*
- **22 canonical umbrella genres added as distinct top-level traditions** (1090 → 1112):
  `pop`, `rock`, `metal`, `country`, `lo_fi`, `jazz`, `blues`, `folk`, `soul`, `reggae`,
  `hip_hop`, `rnb`, `gospel`, `classical`, `electronic`, `house`, `techno`, `ska`, `trap`,
  `dubstep`, `kpop`, `afrobeats`. The catalog had 40+ `pop` and 30+ `metal`/`rock`
  sub-genres but no entry for the bare, most-queried terms — an agent fetching
  `…/api/traditions/pop.json`, or a user searching "Rock", got a 404 on the single most
  likely query. Each is a peer entry (like the existing `funk`/`punk`), modeled on its most
  canonical existing exemplar's config so every id resolves, with era-neutral lineages and
  hand-authored descriptions/exemplars.
- **`umbrella: true` extras flag + staple/neighbor exclusion** (`search.js` auto-staple,
  `score.js` neighbor-bias). Umbrella genres are query endpoints, not real recording
  lineages, so both pools now skip any tradition flagged `umbrella: true`. Without it, the
  axis-central umbrellas became high-scoring staple/neighbor candidates and perturbed 53
  existing sub-genre recipes (e.g. dragging `death_metal`'s Mesa Dual Rectifier to a
  Marshall). With it, every existing recipe is byte-identical (regression 1198/1198, zero
  churn) while the umbrellas stay fully queryable and compile sensible canonical recipes.
- Four new `voice_tradition` variants (32 total) for vocal lineages the palette
  lacked: `sami_joik_tradition` (Nordic Sápmi joik), `andean_quechua_tradition`
  (Quechua/Aymara wayno), `native_american_vocal_tradition` (Plains/Southwest
  powwow & ceremonial), `southeast_asian_folk_vocal_tradition` (lam/mor-lam,
  luk-thung). 20 traditions reassigned off the `modern_pop_vocal_training`
  default onto these. Variant descriptor tokens were tuned to distinctive
  proper-noun stems so the engine's scorer surfaces them only for their own
  region (Sámi/Andean/SE-Asian/Lakota traditions auto-select correctly; spurious
  cross-genre bleed eliminated — verified by sweeping the scorer over all 1090).
- `scripts/audit_coherence.js` (`npm run audit:coherence`): a substantive
  **coherence** auditor that complements `validate` (reference resolution) and
  `audit` (token/descriptor health) by checking that a tradition's fields are
  mutually consistent — the class of issue that passes every structural gate
  because a generic default was stamped early and never customized. Checks:
  archetype↔explicit-medium recording-era clash, voice-multitrack-stack era vs
  medium, stamped `voice_tradition: modern_pop_vocal_training` on traditional
  forms (with palette suggestions), precise non-12-TET tuning contradictions
  (pentatonic/modal correctly excluded), plus advisory environment-collapse and
  single-instrument reports. `--json` / `--full` / `--section=` / `--strict`.
- `scripts/_apply_trad_edits.js`: surgical, id-scoped field editor for
  `05_traditions.js` (one tradition per line). Asserts the prior value and a
  unique, delimiter-anchored match before writing, so an edit can never corrupt
  a neighbouring field (e.g. top-level `tuning` vs the `string_tuning` part).
- `scripts/check_doc_behaviors.js` (folded into `npm run check-docs`, so it runs in
  CI): a third doc gate that asserts the documented *behaviors and outputs* of the
  agent-facing docs, not merely that commands exit 0. `check_docs.js` gates the catalog
  counts and `check_doc_commands.js` gates that every documented command runs — neither
  caught SKILL.md §3f drifting, which kept warning (as "verified") that a bare
  `--diff <a> <b>` "dies" long after `recipe.js`'s `BOOLEAN_FLAGS` made every argument
  ordering work. Each assertion pins one documented behavior to the SKILL.md section that
  states it — the `--diff` arg-order/byte-identity contract, `--swap-variant` exit-2
  rejection, stapling order → lead tradition, the `nearest_neighbor` / `preface_configure`
  outputs cited as "Verified", and arrangement being CLI-only — and fails CI when reality
  diverges (proven against the historical `--diff` regression).
- `scripts/check_api.js` + `scripts/_api_contract.js` (`npm run check:api`, in CI; also
  run at the tail of `npm run build:api` and in the Pages publish): a contract gate over
  the **static API itself** — the agent-facing product (`api/*.json`) that AGENTS.md,
  `llms.txt`, and `index.html` point every external agent at, and which until now had **no**
  automated verification at all. `_api_contract.js` encodes the promises those docs make,
  asserted in two places. (1) `build_static_api.js` now **fails closed**: a tradition that
  won't compile, an incomplete count, an over-ceiling recipe, or an unresolvable `config`
  id makes the build exit non-zero instead of silently dropping the tradition — the old
  `fail++; continue` could quietly publish fewer than the promised 1090, and
  `build_discovery.js` would then propagate the short count into `llms.txt`. (2)
  `check_api.js` re-checks the on-disk artifact: completeness (the "all 1090 in one fetch"
  promise), the ≤1000-char recipe ceiling, `recipe_chars` accuracy, and that **every**
  `config` id (room, archetype, tuning, `inline_chain`, `fx_extras`, instruments + slot
  variants) resolves against the current catalog — which also catches the committed `api/`
  snapshot drifting from `references/`.
- `validate.js` now guards three previously-unchecked tradition fields: `chain_fx`
  (against the fx section) and `chain_amp_guitar` / `chain_amp_bass` (against the
  `amp_make` variant namespace they actually draw from). That gap is what let the
  `fx_`-prefix and wrong-namespace amp ids in the Fixed section below ride along unflagged.
- Two more `check_doc_behaviors.js` assertions: fx_extras render into the recipe (surf
  rock shows its spring reverb + tremolo — the regression guard for the fx fix below) and
  the §3d `belting` lexicon tokens match the doc verbatim.
- **Three standing gates that make the dogfooding self-enforcing** (a promise-coverage
  bijection, two-sided proofs, and artifact reproducibility):
  - `scripts/check_promises.js` + `scripts/_promises.js` (`npm run check:promises`, in
    CI): enforces a bijection across the promises the agent-facing docs make
    (`<!-- @promise: id -->` markers), a registry, and the gates that verify them
    (`// @covers: id` tags). A documented promise with no gate — or a gate covering an
    unregistered/undocumented promise — fails CI. 9 promises, 0 orphans on any side.
  - `scripts/faults.js` (`npm run faults`, new `freshness` CI job): fault injection that
    plants one known defect per gate-class (broken ref, >1000-char recipe, dropped
    tradition, app↔node desync, stale `api/`, silent blend-drop) into isolated temp
    copies and asserts each owning gate exits non-zero. A check you've never seen go red
    is worthless; this proves all 7 are two-sided (0 escapes).
  - `scripts/check_artifact_fresh.js` (`npm run check:fresh`, new `freshness` CI job):
    rebuilds `api/` + `codex.html` and byte-diffs against the committed copy (build
    timestamps normalized), so the published artifact is provably a function of the
    source — killing the committed-snapshot-drift class. Caught a stale committed
    `codex.html` on first run (the file predated the `chain_fx` fix's effect on the
    embedded data; `build:api` doesn't rebuild it); regenerated.
- `build_static_api.js --out` now uses `path.resolve` so an absolute output dir is
  honored (it was `path.join`-ed onto the repo root, silently relocating absolute paths),
  matching `build_html.js`.
- **Voice model expanded with two new articulatory dimensions + an `auto: false`
  explicit-only variant mechanism.** The `voice` instrument gains `voice_vocal_tract`
  (tongue-root / vowel posture: `tongue_root_retracted_dark`, `tongue_root_advanced_bright`,
  `pharyngeal_widened_yawned`, `nasalized_tract`) and `voice_effort` (phonatory effort /
  subglottal pressure: `effort_minimal_undersung`, `effort_projected`, `effort_pressed_maximal`),
  plus a `slow_wide_terminal_vibrato` vibrato variant and an `appalachian_outlaw_folk_tradition`
  vocal tradition. These give native slots to vocal techniques the model previously had to
  cram into `voice_quality` — e.g. "keep subglottal pressure minimal / sing at conversation
  volume or below" (effort) and "pull the tongue root back, target back vowels" (vocal tract),
  which can now coexist with a lowered larynx and fry instead of competing for one slot. To add
  them without perturbing a single existing recipe, every new non-default variant carries
  `auto: false`: `search.js` skips such variants in BOTH the seed pick (`seedFromTradition`) and
  the hill-climb (`variantSwapMoves`), so an optional dimension stays at its neutral
  (empty-descriptor, silently-dropped) default for every tradition unless a caller selects it
  explicitly via `--swap-variant` (which pins it past the search). Verified zero-blast — recipes
  1198/1198, prefaces 79/79, app 56/56, equivalence 8/8, all byte-identical.
- `voice_mechanism_compound` gains `voice_mechanism_supraglottal_rasp_pitch_stable` — a
  controlled supraglottal rasp that rides on a clean core without bending pitch
  (`supraglottal-rasp-clean-core, pitch-stable-distortion, controlled-ventricular-overlay,
  throat-clear-grain`). Every prior supraglottal-grit option baked pitch alteration into its
  descriptors (`subharmonic` / `octave-down-pitched` / `sub-fundamental-buzz` / `screamed`),
  so a deliberate pitch-decoupled growl had no native variant. `auto: false` (explicit-only),
  so zero recipe drift.
- **"Not set" for instrument parts in the composer UI.** The part-variant picker now offers a
  "Not set" chip (mirroring the existing null option on `signal chain` / `environment` stages),
  and the `setPart` handler does `variant || null` like `setTuning`/`setRoom`/`setChain`. An
  unset part contributes no descriptors — both descriptor builders already skip a falsy variant
  id (`app.js` `Variant()` → null guard; `scripts/_card_descriptors.js`), so no engine change was
  needed and browser↔node parity is unaffected (app 56/56, equivalence 8/8).

### Removed
- `scripts/_instrument_asset_map.json` — orphaned since the original import;
  nothing reads it (`fetch_commons.js` reads `_instrument_asset_map_full.json`).

### Changed
- Tradition defaults refined (61 traditions; recipe outputs re-snapshotted, all
  regression/equivalence gates green, `codex.html` rebuilt):
  - **Recording-era coherence (21):** corrected anachronistic `chain_archetype`
    labels and the explicit medium/voice-multitrack stamps that contradicted
    them — e.g. modern digital genres (reggaeton, merengue urbano, bachata,
    cumbia electrónica, sertanejo universitário, reggae fusion) no longer carry
    1950s Kingston/Havana tape archetypes; vintage forms (Lebanese tarab-pop,
    Sahel praise) no longer carry a modern-DAW archetype over a researched tube
    chain; Minneapolis synth-funk moved off a 2010s Melodyne stack.
  - **Vocal-tradition defaults (43):** replaced the catalog default
    `modern_pop_vocal_training` with the accurate vocal lineage on clearly
    traditional forms — Sardinian/Corsican/Balkan polyphony → Mediterranean
    demotic, Irish/Breton lament → sean-nós, Scottish/Hebridean → Gaelic,
    Japanese/Korean folk → min'yō/minsogak, Maghrebi/Levantine art-song → maqām,
    Yoruba dirge → Yoruba tonal, sacred-steel/prison-song → gospel. Heritage-named
    but modern-pop-sung genres (baroque pop, mandopop, Greek rock) were left as-is.

- Project scaffold: `package.json` (declared dev dependencies, `npm run` command
  surface, `engines.node >= 22`), committed lockfile, ESLint flat config, Prettier,
  `.gitignore`, `.editorconfig`, `README.md`, this changelog, and `LICENSE`.
- `src/app.js` and `src/index.template.html`: the browser application is now
  first-class, lintable source. The build assembles `codex.html` by injecting the
  data block, the family-parts merge, and the app into a single `<!--@CODEX_BODY-->`
  marker.
- `scripts/_merge.js`: one source for the instrument family-parts merge, shared by
  the Node loader and the build (it had been written twice).
- `scripts/app_recipe_regression.js` + `tests/app_recipe_snapshot.json`: snapshot
  regression for the browser recipe path (`makeCard` → `compileStack` /
  `compileRecipeStack` across all four formats), wired into `npm test` and the build.
- `build_html --check` now asserts a hard per-`<script>` byte ceiling in addition to
  parsing the embedded data; documented exit codes.
- `.github/workflows/ci.yml`: lint, validate, audit, regressions, build (with byte
  check), and UI reachability on every push and pull request.

### Changed
- `tests/ui_capability_inventory.md` (relocated from `docs/`): it is reachability-test
  input, not documentation.
- `check_docs.js` scoped to the canonical manifest (`SKILL.md`); prose docs and test
  fixtures are excluded.
- Splitter budgeting renamed `maxChars` (it measures characters); the real byte limit
  is enforced by the `--check` assertion.
- `ui_reachability_check.js` uses Playwright's bundled Chromium — removed the hardcoded
  browser path and the absolute `require`.

### Removed
- About 45 dead or vestigial files (~830 KB): `scripts/_one_off/`, orphaned scripts,
  archived audit outputs, and the entire `docs/` tree.
- The `--extract` template-reconstruction bootstrap from `build_html.js`; templates are
  required source.
- Dead code: a duplicate object key, several unused locals and parameters, and a dead
  token-set chain in `build_variants.js`. `npm run lint` is clean.

### Fixed
- **Browse-traditions search now ranks by match locus, not catalog order.** Typing a
  genre returned every tradition whose name/lineage/description merely *contained* the
  term, rendered in raw catalog-array order — so the exact title (e.g. `Pop`) sat
  hundreds of rows below prose mentions ("…Selena-era pop-conjunto…"), and newly-appended
  umbrellas sorted dead last. Results are now tiered: exact name → name prefix → name
  substring → lineage/description only, with shortest name first within a tier. (`src/app.js`,
  browser-only; recipe output and the static API are unaffected.)
- Two false-positive `tandem` gates (flagging source untouched by data work):
  the card-descriptor-semantics gate now strips comments before scanning the
  HTML embed for `match_tokens` (the injected `harvestDescriptors` core carries
  a "NOT match_tokens" comment); and the inline-SVG gate now allowlists
  `glyphSvg()`, the tradition glyph/emoji renderer (a hand-rolled SVG renderer
  like the already-allowlisted viz functions, not an `icon()` bypass).
- Delete-workspace used native `confirm()` (which browsers can suppress in the embed) —
  it now uses the app's `confirmDialog`.
- `saveWS` and `delWS` now guard `window.storage` symmetrically (each early-returns on
  `!window.storage`; reads go through `safeGet`'s try/catch wrapper).
- `scripts/expand.js` truncated piped JSON at the OS pipe buffer (~64 KiB): each success
  path did `console.log(bigJSON); process.exit(0)`, and `process.exit()` tears the process
  down before a large async stdout write drains to a pipe — so `expand.js --tradition
  <id> | jq` lost everything past byte 65524 while still exiting 0 (a file redirect was
  unaffected). Success paths now set `process.exitCode` and let the event loop flush
  stdout; the flag dispatch is an `if/else-if/else` chain so they no longer fall through
  into the usage error. Exit codes unchanged (0 success / 2 error).
- Corrected two stale SKILL.md dogfooding notes the code had outrun: §3f no longer claims
  a bare `--diff <a> <b>` "dies" (every argument ordering is byte-identical, now gated by
  `check_doc_behaviors.js`), and §3h no longer says jsdom is "already installed" — the
  headless rich-recipe path needs `npm ci` first, and a fresh clone fails with "Cannot
  find module 'jsdom'" even from the repo root.
- **18 traditions silently dropped their intended fx.** Their `chain_fx` carried
  `fx_`-prefixed ids (`fx_spring_reverb`, `fx_chorus_pedal`, `fx_tape_echo`, …) that don't
  exist in the fx section — the real ids are unprefixed (`spring_reverb`, `chorus_pedal`,
  `tape_echo`). `translate` (and the browser `compileStack`) resolve fx by exact id and
  silently `continue` past a miss, so the period-correct fx never rendered: surf rock
  without its spring-reverb tank, dub without its plate reverb, honky-tonk/bakersfield
  without spring reverb + analog delay (27 occurrences across bakersfield,
  british_invasion_rb, city_pop, country_rock, detroit_techno, dream_pop, dub, honky_tonk,
  krautrock, madchester_baggy, merseybeat, midwest_emo, new_wave, post_punk, reggae_roots,
  space_rock, surf_rock, synthpop). Stripped the bogus prefix; those recipes now render
  their fx, and `validate.js` + `check_api.js` make this class of broken ref fatal.
- `modal_jazz.chain_amp_guitar` used a chain-`amp`-section id (`amp_fender_twin_blackface`)
  in a field that resolves against the `amp_make` variant namespace, so its guitar amp
  silently never applied; corrected to `amp_american_fender_blackface` (the same Fender
  Blackface Twin). Surfaced immediately by the new `validate.js` amp guard.
- `recipe.js` blends silently dropped unknown tradition ids. The primary id (and every
  `--exclude-instrument` / `--add-instrument` / `--swap-variant` id) was validated and
  rejected with exit 2, but staple ids in `--traditions a,b` and the secondary in
  `--diff a b` were passed straight to `seedFromTradition`, which skips an unknown
  staple — so `--traditions afrobeat,typo` or `--diff afrobeat wrongid` produced a
  plausible recipe that silently omitted the requested genre (exit 0), quietly breaking
  the blend promise. Now every tradition id is validated up front (exit 2, offending id
  named) and `--diff` rejects a stray third positional. Found by an alpha/beta CLI sweep.

## [1.0.0]

- First fully-verified cut: 1,090 traditions, 421 instruments, 256 rooms, 22 chain
  archetypes, 21 production aesthetics. Reference integrity clean, recipe and preface
  regression green, single-file `codex.html` reproducible from source.
