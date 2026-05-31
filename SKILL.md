---
name: codex-music-tool
description: Generate compressed song-recipe descriptor stacks from a 1090-tradition / 421-instrument music codex. Use for song recipes, tradition blends, axis-profile matching, and catalog introspection.
---

# Codex Music Tool

The codex is a structured catalog of recorded-music traditions in 13-dimensional parameter space. The headline operation is **song recipe generation**: produce a tightly compressed structural descriptor stack (≤1,000 characters, no prose, no axes printed, no artist names) that tells someone how to record a specific song.

Every song is treated as inherently an outlier — a unique combination of 1-3 stapled traditions, customized instruments with selected variants per part, and a specific room/chain configuration. The catalog has the resolution to specify all of this; the engine searches for the best-fitting configuration and emits a descriptor stack.

---

## When to invoke this skill

**Activate when the user asks to:**
- make a song, give a recipe for a song, or describe how to record something
- produce a recording in a specific tradition or aesthetic
- blend two traditions or generate a structural production blueprint
- find a tradition matching an axis profile

**Activation phrases:**
- "make me a song like X"
- "give me a recipe for X"
- "how do I produce X"
- "describe the structural recipe for X"
- "what would a song between X and Y look like"
- "I want a recording with this profile"

**Also activate for catalog-introspection tasks:**
- fingerprint a tradition, find similar traditions
- validate references, audit catalog state
- place a new tradition in the tree, extend the catalog

**Do NOT activate for unrelated music questions** — lyric analysis, music theory tutoring, song recommendations. Only when the catalog is the right tool.

---

## Skill structure

```
references/    Source data — never loads automatically; read on demand only
  02_instruments.js          (421 instruments with parts/variants decomposition)
  03_rooms_chains_tunings.js (256 rooms + 22 archetypes + 21 aesthetics + 120 tunings)
  04_tree.js                 (311 tree nodes — the tradition hierarchy)
  05_traditions.js           (1090 traditions — id/name/instruments/room/chain)
  06_extras.js               (per-tradition axes/exemplars/description/crossRefs)

scripts/       Operations — call these, don't re-derive their logic
  _loader.js              shared module loading all 21 catalog tables
  recipe.js               GENERATE A SONG RECIPE (the headline operation)
  search.js               hill-climbing search engine (called by recipe.js)
  score.js                coherence scorer (called by search.js)
  translate.js            configuration → descriptor stack (called by recipe.js)
  list.js                 browse primitives — sections, rooms, instruments, variants, etc.
  expand.js               deep view of a single catalog entry with refs resolved
  compare.js              structural diff between two same-type entries
  fingerprint.js          shallow lookup of one tradition (inspection tool)
  nearest_neighbor.js     keyword OR axis-vector search across traditions
  placement_check.js      pre-flight check for adding a new tradition
  validate.js                          cross-reference integrity check (run after edits)
  audit.js                             data-quality audit — catches non-fatal issues (parent==crossRef, dead canonical tags, duplicate descriptors, redundant descriptors)
  inspect.js                           tradition diagnostic — shows variant scoring breakdown for any tradition (or stapled set)
  stack.js                             compilation viewer — full descriptor stack (layered) or merged weighted cloud for any compiled config
  regression_recipes.js                snapshot-and-diff for canonical recipe outputs (forces intentional acknowledgment of changes)
  regression_prefaces.js               snapshot-and-diff for canonical preface assignments (79 fixtures, byte-equivalent to HTML embed)
  smoke.js                             catalog-wide pipeline health: every tradition + blends + axis-targets + recipe-stack ceiling check (fail-fast, ~3min)
  tandem.js                            end-to-end coherence across source pipeline, HTML artifact, zip artifact, and HTML↔source parity (23 subchecks)
  check_slot_picks.js                  9 frozen (tradition × instrument × part) → variant lockins, gated against silent drift
  build_html.js                        regenerate /mnt/user-data/outputs/codex.html from sources
  build.js                             canonical ship-this — runs validate + audit + regression + smoke + build_html
```

---

## Routing — pick the right operation

| User wants | Run |
|---|---|
| Recipe for a song in tradition X | `recipe.js --tradition <id>` |
| Recipe blending two traditions | `recipe.js --traditions <id1>,<id2>` |
| Recipe between two traditions, weighted | `recipe.js --diff <id_a> <id_b> --weight=0.7` |
| Recipe matching an axis profile | `recipe.js --axis-target "harm:1,density:2,..."` |
| Find which tradition matches a recording | `nearest_neighbor.js --keyword "<term>"` |
| Find traditions matching axis vector | `nearest_neighbor.js --axes "..."` |
| Browse a chain section / rooms / variants | `list.js --section <id>` / `--rooms` / `--variants` |
| Deep view of one entry with refs resolved | `expand.js --tradition <id>` (or --instrument, --room, --archetype) |
| Compare two traditions structurally | `compare.js --traditions=<a>,<b>` (or positional) |
| Pre-flight a new tradition before adding | `placement_check.js --id <new_id> --parent <path> ...` |
| Verify catalog integrity after edits | `validate.js` |
| Audit catalog data quality (warnings) | `audit.js` (or `--full` to see all entries; `--section=<name>` to filter) |
| Diagnose why a tradition produces output X (variant scoring) | `inspect.js --tradition=<id>` |
| Diagnose why a recipe came out the way it did | `recipe.js --tradition=<id> --why` (per-slot variant selection + search trace) or `--why-prefaces` (preface-assignment breakdown with top-3 candidates and token matches). Both have `--*-json` machine-readable variants. |
| See the full descriptor stack a compiled config draws from | `stack.js --tradition=<id>` |
| See the gravity centers / merged weighted cloud of a config | `stack.js --tradition=<id> --mode=cloud` |
| Snapshot canonical recipes / catch regressions | `regression_recipes.js` (or `regression_recipes.js --update` to accept changes) |
| Periodic quality-review against gold-standard fixtures | `calibrate.js` (or `--fixture=<id>` for one). Runs hand-curated track→recipe gold-standards; presents side-by-side for human judgment. NOT in build pipeline — on-demand. |
| End-to-end coherence check across source + zip + HTML | `tandem.js`. Verifies all three artifacts ship in a coherent state: source pipeline passes, HTML JS parses, catalog data matches source, zip round-trips clean, HTML import simulation produces expected card counts. Use after major changes. |
| Verify markdown claims against current catalog state | `check_docs.js`. Catches numeric drift (e.g. a doc claiming "400 instruments" when the catalog has 421), broken script references, and stale audit-count claims across all active markdowns. Default mode is instant (catalog counts + script refs); `--with-audits` adds dead_tokens + profile_size checks (~5s); `--with-smoke` adds smoke ceiling + advisory count checks (~3min); `--all` enables everything. Historical/shipped docs (STATUS: SHIPPED|MOSTLY SHIPPED|ACTED ON) auto-excluded; per-line override via `<!-- check_docs:ignore -->` pragma. Run before tagging releases or after catalog changes that move canonical counts. |
| Voice-pick stapling-cycle audit (Phase 3 triage tool) | `audit_voice_picks.js`. For every voice-bearing tradition, compares the `voice_quality` pick under primary-only context vs hill-climber-with-staples context. Surfaces every mismatch with both-side top-3 scores, staple set, lineage. Outputs JSON to `tests/voice_audit.json` and markdown to stdout (or `--out=<path>`). NOT in build pipeline. Each mismatch row gets A/B/C classification (A: flip target, current pick wrong; B: current pick right, primary-only would regress; C: bin-3 defensible). Single-tradition mode: `--tradition=<id>`. **Restored May 17, 2026** — the archived JSONs in `tests/` reflect pre-type-separation scoring; regenerating produces a different mismatch set and may require re-classifying entries in `tests/voice_audit_classifications.json`. **Safe-verify mode**: `--dry-run` writes JSON to `/tmp` instead of `tests/`, leaving the frozen gate input untouched. Use this to verify the script runs without disturbing tandem coherence. |
| Generalized pick-audit on any slot | `audit_picks.js`. Same logic as `audit_voice_picks.js` but takes `--instrument=<id> --part=<id>` for any slot. Outputs to `tests/<inst>_<part>_audit.json`. Voice audit remains the only slot with classification-coherence enforced by tandem; other slots are on-demand triage only. (Why: a 208-mismatch sweep across 15 non-voice slots found zero bucket-A cases — `voice_quality` encodes a tradition's canonical vocal identity, so staple cross-pollination is wrong there and is suppressed via `isolated_parts: ['voice_quality']`, whereas non-voice timbre signals like shell wood, pickup magnet, and scale length legitimately benefit from staple cross-pollination, so no isolation is needed.) **Restored May 17, 2026** — the archived JSONs reflect pre-type-separation scoring; regenerating may require re-classifying entries in `tests/pick_audit_classifications.json`. **Safe-verify mode**: `--dry-run` writes JSON to `/tmp` instead of `tests/`. |
| Rebuild the browseable HTML | `build_html.js` |
| Ship: validate + audit + regression + rebuild HTML | `build.js` |
| Add a new tradition/instrument/room | Edit `references/*.js` with str_replace, then `build.js` |

---

## How recipe generation works

The engine follows a four-stage pipeline:

1. **Parse song spec into seeds.** Input can be a tradition id, multiple traditions to staple, an axis target, or a freeform description. Each seed becomes a starting configuration.

2. **Generate parameter slots.** Each instrument gets parts-and-variants slots, room gets selected, chain archetype selected, tuning selected, optional aesthetic.

3. **Hill-climbing search.** From the seed, the engine evaluates moves — variant swaps within parts, chain swaps, tradition staples, aesthetic toggles — scoring each by descriptor-overlap with the tradition's structural context (parent tree-node tokens, crossRefs, room/archetype genre tags). Key search-engine constraints:
   - **Primary tradition is anchor.** Only stapling additional traditions allowed; primary cannot be replaced.
   - **Neighbor-bias capped at 30%** of |direct score|. Prevents neighbor-tradition pollution where a high-similarity unrelated tradition dominates the variant scoring.
   - **Stapled traditions drawn only from primary's crossRef descendants.** Prevents arbitrary semantic-distance staples.
   - **Staple candidates deduped by parent path.** When multiple sibling traditions share the exact same parent path (e.g. `tango` + `tango_traditional` both at `balladPoetry.latinAmTroubadour`, or `british_invasion_rb` + `hard_rock` + `garage_rock` all at `distortedRock.classic`), only one representative gets stapled — picked by axes-similarity to primary tradition (closest 13-axis L1-distance match), with lex-first as tiebreak. Without this, both siblings score nearly identically and BOTH get stapled, producing redundant "tango tango traditional" output and over-representing the dominant crossRef branch.
   - **Aesthetics toggled only from primary's `production_aesthetic` field.** Speculative aesthetic-application is too noisy.
   - **Era anchor uses archetype era as fallback** when room.era is undefined. Otherwise chainSwapMoves can drift to a stylistically-close but era-wrong room (e.g. Atlanta-trap mid-1970s mid-major studio).
   - **Era extraction (translate.js extractEraFromText)** strips lineage-historical-reference tokens (`1960s-derived`, `1970s-influenced`, `2000s-rooted`) before regex matching, and treats `X-present`/`X-onward` as `qualifier: 'modern'` so e.g. `2000-present` archetype era renders as `modern`, not `early-2000s`.

4. **Translate to descriptor stack.** The winning configuration becomes 6 period-bounded sentences:
   1. Tradition position: `classic <region> <era> <name>, <parent root>, <parent leaf branch>, <crossref 1>, <crossref 2>.`
   2. Voice descriptors (no noun): `blues-shouter, narrative.`
   3. Instruments with iconic descriptors: `<modifiers> <instrument noun>, ... .`
   4. Room: `<descriptor> <era> <scale> <room label>.`
   5. Chain electronics: `<mic>, <pre>, <amp>, <console>, <comp>, <eq>.`
   6. Medium + fx: `<medium> <fx> <fx>.`

---

## Output format rules — non-negotiable

These are encoded in the translator. Don't reverse them.

**No prose, no connectives, no labels.** "Classic afrobeat" not "a classic afrobeat recording." Period-bounded sentences for category transitions, comma-separated within categories.

**No axis values printed.** Axes are scoring-internal only.

**No artist/band/composer names.** Names appear in `exemplars[]` arrays only, never in output.

**Drop defaults silently.** No "comp_none," "tuning: twelve_tet" (the catalog default), "no compression." Absence carries the information.

**Negative prompts only when structurally informative.** Most recipes have zero negatives. A negative is justified only when the absence is counter-typical for the tradition AND not redundant with the positive prompt's silence.

**Modifiers in front, anchor noun at end.** "clean midrange forward chicken-scratch single coil electric guitar" not "single coil electric guitar with chicken-scratch midrange-forward clean attack."

**Hyphens preserved only for real compound lexical units.** `Afro-diasporic`, `chicken-scratch`, `large-diaphragm`, `wall-of-sound`, `blues-shouter`. NOT `mid-major-1965` or `EMI-equipment-heritage`.

**Proper nouns capitalize.** `West African`, `German`, `Pultec`, `Studer`, `EMI`, `Afro-diasporic`. Generic descriptors stay lowercase: `classic`, `afrobeat`, `blues-shouter`.

**1,000 characters is a CEILING not a target.** Most recipes come in well under. Trim from the bottom (sentence 6 first) when over budget.

**Parity-test discipline.** When checking codex output against a "this is what it should be" target — e.g. "describe Dylan's 'In My Time of Dyin'' and compare to recipe.js output" — the target MUST be written under the SAME rules the codex itself follows: no proper nouns (artist/band/producer/studio names), no specific gear models, no prose narrative, descriptor-level only, structural blueprint not session log. Comparing codex output to a prose-with-proper-nouns paragraph is a rigged test — the codex is scored on its faithfulness to content it's correctly forbidden from producing. If you can't write the target under codex rules, you're not running a parity test; you're running a "do I prefer prose to structured output" test, which proves nothing about the codex.

**Calibration discrepancy taxonomy.** When `calibrate.js` shows a fixture's actual output diverging from its gold-standard, sort the discrepancy into one of four bins before acting on it:
1. **Catalog issue** — the catalog data is wrong, missing a staple, has an anachronistic crossref, etc. Fix the data.
2. **Algorithm issue** — search picked a poor variant, translate dropped a load-bearing descriptor, etc. Fix the code.
3. **Genuine ambiguity** — both recipes are defensible (e.g. "alto vs tenor saxophone" for modal jazz; "horn section" vs "saxophone, trumpet" enumeration). Document and move on; don't chase parity that isn't there.
4. **Curator misconception** — the gold-standard was wrong (e.g. described a track-specific solo simplification of an inherently-ensemble tradition; used vocabulary the catalog doesn't share). Update the fixture, not the catalog. Important: track-specific anomalies (Dylan's specific track having no harmonica even though delta_blues canonically does) are usually curator misconceptions, not catalog bugs — the codex describes traditions, not tracks.

The most common failure mode is bin 4 — writing gold-standards that capture track-specific knowledge ("this song doesn't have X") rather than tradition-canonical content. Resist it. The codex describes a tradition's central tendency; gold-standards should too.

**Mechanism-vocabulary discipline (the editorial pass May 2026).** Variant descriptors name *mechanisms*, not impressions. "Gritty/rough/edge-heavy" is impression — replaced across the catalog with anatomical phonatory mechanisms: `fry-bleed` (modal voice with vocal-fry register leak — Armstrong, late Tom Waits), `pressed` / `supraglottal-constricted` (Joe Cocker, Janis Joplin), `false-fold-engaged` / `ventricular-phonation` (Howlin' Wolf, Tuvan kargyraa, death growl), `breath-admixed` / `incomplete-closure-active` (Macy Gray, neo-soul), `worn-fold` / `irregular-fold-mass` (late-career Sinatra/Holiday). Same for chain — "warm" replaced with the actual circuit topology: `even-harmonic-rich` (tube), `asymmetric-saturation` (transformer-iron), `euphonic-clean` (discrete Class-A), `inductor-phase-shift` (Pultec/Neve inductor stages), `solid-state-clean` (modern op-amp). The pass continues into amp/comp/eq/fx with the same discipline: `high-gain-cascading-tube-stages` (British high-gain stack), `long-attack-LDR-thermal` (LA-2A), `germanium-soft-clip-asymmetric` (germanium fuzz), `passive-LC-broad-curves` (Pultec EQ), `doppler-pitch-modulation` (Leslie cabinet). When authoring a new variant, the test is: name two recordings (or two specific gear pieces) whose variant for this part is the same descriptor, but whose actual production mechanism differs in ways an informed listener could explain. If you can do that, the descriptor is too vague — split it. Tradition-agnostic mechanism words go in `TRUSTED_TECHNIQUE_DESCRIPTORS` in `scripts/translate.js`; tradition-canonical tags (`*-canonical`) do not.

---

## Schema reference

### TRADITIONS (`05_traditions.js`)
`{ id, name, family, lineage, instruments[], room, chain_mic, chain_pre, chain_console, chain_comp, chain_eq, chain_amp, chain_medium, chain_archetype?, tuning, production_aesthetic? }`. When `chain_archetype` is set, archetype components win for recipe output (period-curated); inline `chain_*` fields act as fallback for traditions without an archetype. The `chain_amp` field surfaces in sentence 5 between `pre` and `console` — currently set per-tradition only (no archetype declares an amp yet).

### TRADITION_EXTRAS (`06_extras.js`)
Keyed by tradition id. `{ parent, axes (13-dim), description, exemplars[], status, crossRefs[] }`.

**Description quality standard.** Each tradition's `description` field is ≥250 chars and includes: era boundaries (specific years or decade), geographic origin, canonical instrumental architecture, ≥1 neighbor-tradition distinction, tradition-specific tokens. Thin descriptions (under 200 chars) reduce the search engine's scoring signal — the descriptor tokens it can extract from the description directly affect variant-and-chain selection. Layer 3 of the codex's expansion-plan brought all 247 thin descriptions up to standard.

### INSTRUMENTS (`02_instruments.js`)
`{ id, name, family, axes (9-dim), short, parts[] }`. Each `part` has `variants[]`, each variant has `descriptors[]`.

### Catalog conventions
- Variant descriptors include both **iconic** tokens (whose words appear in the variant id, e.g. `chicken-scratch` in `chicken_scratch`) and **character** tokens (sonic descriptors like `clean`, `midrange-forward`).
- Genre-anchoring tokens like `jazz-canonical`, `afrobeat-canonical`, `r&b-canonical` are scoring hints — they help the search find the right variant for a tradition. They get stripped of the `-canonical` suffix at output time and bare-genre tokens (afrobeat, jazz, funk, etc.) are filtered from the output stack since the user already knows the tradition from sentence 1.

### Canonical-descriptor scoring semantics (post-2026-05-11 structural fix)
Descriptors ending in `-canonical` are *genre claims*, not generic overlap tokens, and the scorer treats them differently from non-canonical descriptors. **Subtoken overlap is disabled for canonical descriptors** — a compound canonical like `black-metal-canonical` no longer earns +weights["metal"] credit just because some unrelated metal tradition has "metal" in context. That was the structural bleed (a doom tradition was picking false_fold_voice because the false_fold variant had `black-metal-canonical` and doom context had `metal`). **Compound canonicals (>1 subtoken) require all subtokens present in the merged context to fire bonus**, scored at `min(subtoken-weights) × 1.5` — weakest-evidence-wins, conservative. Single-token canonicals (`blues-canonical`, `jazz-canonical`) keep their historical overlap-plus-bonus behavior. **Conflict penalty is -0.05** (was -0.1 when subtoken bleed offset was needed; without bleed it would over-penalize variants with many specific compound tags). When authoring a new canonical descriptor, prefer single-token forms (`taarab-canonical`, `doom-canonical`) over compound where possible — single tokens are stronger scoring signals because they avoid the min-aggregation. Use compound only when the genre claim has no clean single-token form (`cuban-rumba-canonical`, `delta-blues-canonical`). For compound canonicals to fire, **the descriptor's subtokens must be reachable from context tokenization** — context splits on `\W+` and `[-\s]`, so `r&b` in a descriptor never matches because `&` is `\W` (use `rb` instead; `contemporary-rb-canonical` works because `rb` tokenizes from camelCase paths like `soulRb`).

### Tree-node ids
camelCase paths like `groovePercussion.afroDiasporicElec`. Display rules:
- Root segment camelCase preserved: `groovePercussion` → `groove Percussion` (capital P signals category-defining noun).
- Sub-branches expand abbreviations and add "branch" suffix: `afroDiasporicElec` → `Afro-diasporic electric branch`.
- CrossRefs render with full path: `improvOnFrame.americanJazz.fusion` → `American jazz fusion`.

---

## Critical constraints

1. **NEVER use artist/band/composer names as descriptors anywhere in output.** Names live only in `exemplars[]` arrays inside the catalog.

2. **All axis values are integers in the range −2 to +2.** Validator rejects out-of-range values.

3. **`crossRefs[]` must be tree-node ids**, not tradition ids. They point to other branches.

4. **After ANY edit to `references/*.js`, run `build.js`.** It runs validate + audit + regression + anti-drift (prefaces, slot-picks) + smoke + build_html + ui-reachability: `validate.js` (catches broken references, axis violations, duplicate ids/names, duplicate instruments in a tradition, orphaned extras, MULTIPLE_DEFAULTS — pairs of variants both marked `default: true` within the same part — fatal on failure), `audit.js` (data-quality warnings: parent==crossRef redundancies, dead canonical tags, duplicate descriptors, empty crossRefs, family-parts coverage gaps, unsurfaceable variants, redundant-descriptors-in-part, coverage_gaps for orphaned aesthetics/archetypes, duplicate_axes_signature for indistinguishable sibling traditions, parent_top_branch_overlap, parent_crossref_redundant, description_instrument_mismatch — advisory unless `--strict-audit` flag set), `regression_recipes.js` (1198 fixture snapshots verifying recipe output stability — covers a stratified sample of major branches, targeted canaries for previously-buggy traditions, rare-instrument coverage, and 84 multi-tradition fixtures (primary plus stapled traditions) exercising staple selection across genre-distant primaries), `smoke.js` (catalog-wide pipeline health: runs every one of the 1090 traditions plus 19 multi-tradition blends plus 8 axis-target seeds plus an HTML JS-parseability check plus 2000 recipe-stack ceiling assertions — asserts that the pipeline doesn't crash and outputs are non-empty under the 1000-char ceiling, not that recipes are correct; 100% catalog coverage of crash-resistance vs regression's correctness coverage of the verified subset; ~3min runtime; skip with `--skip-smoke` during fast iteration), then `build_html.js` (regenerates `/mnt/user-data/outputs/codex.html`). Three opt-in audit sections require explicit `--section=NAME` to run: `no_iconic_descriptor` (414 advisories — voice variants and metadata-style parts skipped architecturally; the rest are real authoring patterns that don't break recipes), `multistart_divergent` (throttled with `--restarts` and `--multistart-iters` flags, detects search seed-dependent divergence), and `description_instrument_mismatch` (catches authoring drift between tradition prose and `instruments[]` array — useful as authoring aid).

5. **Banned-words list applies to all generated prose** that ends up in the catalog (tradition descriptions, room notes, archetype notes, etc.). Read carefully — overcorrection is its own failure mode.

---

## Common failure modes

- **Tradition without TRADITION_EXTRAS** — every TRADITIONS entry needs a paired entry in TRADITION_EXTRAS keyed by the same id. Validator catches.
- **Wrong tuning ids** — `just_indian` doesn't exist (use `shruti_22`); `just_arabic` doesn't exist (use `maqam_24edo`).
- **Wrong tree-node parent paths** — verify with `placement_check.js` before adding.
- **CrossRef pollution** — when a tradition's `crossRefs[]` points at semantically-distant tree nodes, the search engine pulls unrelated traditions as staples. Symptom: recipe sentence 1 surfaces stapled traditions from a tradition that obviously doesn't belong (e.g. New Orleans Dixieland pulling minneapolis-synth-funk-pop, jingju pulling Western symphonic). Fix: replace the wrong crossRef with a target closer to the tradition's actual lineage.
- **Era leaks via lineage strings** — putting decade-references inside `lineage:` field text (e.g. `"1960s-derived chimey-guitar pop"`) leaks "mid-1960s" into recipes for traditions that are actually post-1980. Era-extraction now strips these patterns, but avoid them in lineage strings going forward.
- **Era/region/scale mismatches** — assigning a 2020s tradition to a 1965-1985 room, or borrowing a Kingston archetype for a Lagos room.
- **Duplicate instruments in a tradition** — validator flags `DUPLICATE`. Fix by deduping the array.
- **Duplicate tradition names** — validator flags `DUPLICATE_NAME` (case-insensitive). Distinguish by adding qualifier (e.g., "Southern gospel piano-bass" vs "Southern gospel quartet").
- **Multiple defaults in a part** — validator flags `MULTIPLE_DEFAULTS` when two or more variants in the same part are marked `default: true`. Exception: at the family-parts level, two defaults with non-overlapping `applies_to` scopes coexist legitimately — they can never both apply to the same instrument (e.g. `percussion_technique` has three defaults: `percussion_sticks_rock` for drum_kit, `percussion_hands_layered` for hand drums, `percussion_mallets_orchestral` for mallet instruments — each in its own applies_to scope). The validator implements this exception. The complementary check `MISSING_DEFAULT` flags multi-variant parts post-family-merge that lack any default — these emit when an instrument inherits a family-part but isn't in any default variant's `applies_to`, leaving search to fall through to arbitrary array-order tie-break rather than canonical preference. Default coverage is currently 100% across all multi-variant parts. To mark a default on an inherited family-part without overriding the variant set, use an annotation-only own-part: `{ id: '<family_part_id>', default_variant: '<variant_id>' }` — the loader recognizes this pattern and marks the named variant default for this instrument's view without duplicating variant definitions. The flag is consumed by the search-engine seed builder (`seedFromTradition` in search.js) as a tiebreaker — when two variants score equally against tradition context, the one marked default wins, replacing arbitrary author-ordering with explicit canonical preference.
- **Adding duplicate instruments** — search first.
- **Catalog gaps as honest output** — when an instrument lacks a "technique" part with genre-anchoring descriptors, the recipe emits the bare instrument name without modifiers. That's correct behavior; the fix is to add a technique part to the instrument's parts list.
- **Description-instrument mismatch** — when a tradition's `description` mentions an instrument by name (e.g. "...with sarangi accompaniment") but `instruments[]` doesn't include it, the audit flags this. Fix by either adding the instrument to `instruments[]` or reframing the description (or, if the mention is comparison-reference like "distinguished from sarangi-tradition", add the comparison-token to the global stoplist in audit.js).

---

## When the right entry doesn't exist

The catalog is incomplete by design — gaps surface as recordings get fingerprinted. When a recipe requires an entry that doesn't exist:

1. Try `placement_check.js` to confirm the gap is real (not a search miss)
2. Report the gap structurally: "no commercial_studio room with era=1962-1968 and region=UK"
3. Offer to add the missing entry with a complete spec
4. After approval: edit the file with `str_replace`, then run `build.js` (validates references and rebuilds the browseable HTML at `/mnt/user-data/outputs/codex.html`).

The HTML build at `/mnt/user-data/outputs/codex.html` is regenerated from these same source files by `build_html.js`. It's part of the catalog's lifecycle — any edit to `references/*.js` should be followed by `build.js` so the source and the browseable view stay locked together.
