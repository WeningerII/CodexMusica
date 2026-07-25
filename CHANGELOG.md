# Changelog

All notable changes to this project are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This file replaces the former
`docs/plans/` collection of point-in-time planning documents.

## [Unreleased]

### Fixed
- **Duplicate `chain_archetype` keys were silently discarding purpose-built chains.**
  A tradition is a JS object literal, so writing a key twice keeps the *last* value
  and drops the first — invisible to every ref check, because both ids are valid.
  Nine records carried two `chain_archetype` keys, and in seven of them a
  purpose-built archetype had been clobbered by a later generic append. That is why
  four archetypes sat authored-but-unused: `northern_soul_motown` was losing
  **Motown Snakepit**, `philly_soul_intl` **Sigma Sound**, `disco` the **NYC disco
  12-inch** chain, `ecm_jazz_aesthetic` **ECM/Kongshaug**, `nashville_sound` the
  **Nashville A-Team**, `dub_techno` the **Berlin dub-techno** chain, and `mariachi`
  was rendering a *Havana* chain instead of Mexican Churubusco. Each record now
  carries exactly one key, restoring the authored chain. `validate` gained a
  source-level duplicate-key rule for single-valued tradition fields (a sibling of
  the existing `06_extras.js` check) so this cannot regress; it strips the nested
  `parts` object first, since part ids share a namespace with field names (`tuning`
  is both).
- **Ten instruments no longer show "Playing technique" twice.** Each carried a
  generic family-level technique part *and* an instrument-specific one — both
  rendering under the same "Playing technique" label — so a card listed two
  technique dropdowns and a recipe stamped two technique tokens. The generic
  family part was frequently *wrong* for the instrument (an upright bass offered
  guitar "flatpicked" / "chord-melody"; a banjo offered generic "strummed"). Each
  instrument now excludes the generic family technique part (`exclude_family_parts`,
  the same mechanism the drum kit uses) and keeps its idiomatic own part:
  `upright_bass`→`upright_play` (pizz/arco/slap), `electric_bass`→`bass_technique`,
  `archtop_jazz`→`archtop_technique`, `acoustic_guitar_om`→`acoustic_om_technique`,
  `banjo_5_string`→`banjo_play` (clawhammer/three-finger), `akonting`→`akonting_play`,
  `cuatro_venezolano`→`cuatro_venezolano_technique`, `gayageum`→`gayageum_technique`,
  `djembe`→`djembe_play`, `harmonica`→`harmonica_technique`. The instrument-specific
  part was already pinned in nearly every relevant tradition, so recipes just lose
  the spurious duplicate token (e.g. hard bop's "gut chord melody upright bass" →
  "growly gut upright bass"). 116 now-orphaned family-technique pins were removed
  from the traditions that only used them via one of these instruments; 67 fixtures
  re-blessed, 2 preface fixtures re-blessed, preface 79/79 otherwise unchanged.

### Changed
- **Broke up the catch-all recording chain (221 → 160 traditions).**
  `arch_modern_pro_daw_studio` ("2000–present") had become the fallback for anything
  modern-ish, and **104 of its 221 traditions are documented as pre-2000** — a plain
  era error. It also made the chain the least informative part of a recipe: across
  the catalog only **97 distinct chain tails** served 1,147 recipes, with **95% of
  recipes sharing a tail with at least one other**, and a single 202-recipe tail
  reading `tube condenser, 500-series boutique pre, brick-wall limiter, dynamic EQ`.
  59 traditions were reassigned to era-correct archetypes that already existed —
  90s club/rave scenes to the pre-DAW electronic-pioneer chain, 80s/90s metal and
  major-studio pop to the late-analog SSL chain, sample-era hip-hop and post-punk to
  the American indie-commercial chain, holy minimalism / free improvisation /
  European chamber-jazz to **ECM/Kongshaug**, historically-informed performance to
  the church-location chain, and the spoken-word forms out of a music-mastering
  chain entirely (radio-broadcast storytelling to the network-radio chain, audiobook
  / podcast / voiceover to the home-booth digital chain). Archetypes in active use
  rose from 78 to 82 of 84; no archetype was added or removed.

### Removed
- **Deduplicated 30 redundant tradition records (1195 → 1165).** A catalog-wide
  name-similarity scan (distinctive-token overlap, transliteration-folded) surfaced
  clusters of entries that were the *same* tradition under a rephrasing,
  transliteration, or minor scene/era/context sub-tag; a per-cluster classification
  pass (leaning "merge" for borderline, per catalog policy) confirmed 30 merge
  groups while keeping genuinely-distinct neighbors separate (early vs late
  Romantic, distinct Orthodox churches, distinct drill scenes, Thai field vs city
  song). Each removed record was folded into its canonical keeper — the keeper
  absorbs any instruments the duplicate carried that it lacked — so no roster
  coverage is lost. Examples: `mongolian_xoomii`→`mongolian_khoomei`,
  `jingju`→`beijing_opera`, `mariachi_traditional`→`mariachi`,
  `dixieland_traditional_jazz`→`new_orleans`, `shape_note`→`sacred_harp_singing`,
  `coptic_liturgical`→`coptic_orthodox_chant`. Regression fixtures and audit
  fixtures repointed to keepers; the 30 stale `api/traditions/*.json` files removed.

### Changed
- **Drum-kit recipes are now technique-first, not boilerplate-cluttered.** A kit
  carried 11+ parts, most of them fine-grained boilerplate stamped identically on
  all 257 drum traditions (shell ply, bearing edges, snare wires, cymbal lathing/
  finish/hammering — each only 2–3 distinct values catalog-wide, one dominating
  64–81%), which crowded the playing approach out of the recipe. Now:
  - **8 parts default to "not set"** (all variants `auto: false`, pins removed from
    the 257 traditions) so they contribute nothing unless a user selects them —
    shell_wood, shell_thickness, bearing_edges, snare_wires, cymbal_alloy,
    cymbal_hammering, cymbal_lathing, cymbal_finish. All stay fully selectable.
  - **`percussion_technique` dropped from the kit.** It's a generic percussion-
    family part and a strict subset of the kit's own `drum_technique` (Playing
    approach) — every drum tradition redundantly pinned both. A new
    `exclude_family_parts` mechanism on the instrument (single source in
    `_merge.js`, inlined into the HTML build) lets an instrument opt out of an
    inherited family part; `percussion_technique` stays intact on the other 13
    percussion instruments (congas, timpani, marimba…).
  - **`drum_technique` promoted to the top** of the kit's parts (Playing approach
    is the single most defining choice for a kit in a recording).
  - Net: a kit recipe now foregrounds **playing approach + batter head + kick
    pedal** (e.g. "pre-muffled edge-muffled sticks-backbeat drum kit") instead of
    "oak … machine-hammered symmetric-pattern drum kit". 278 fixtures re-blessed;
    preface 79/79 unchanged; congas/percussion unaffected.
  - The 8 detail parts also had `default: true` removed from their variants, so the
    interactive app (`defaultParts`, which keys off `default: true`, not the
    search-only `auto: false`) renders them as "—/not set" too — the two paths now
    agree. validate's missing-default rule exempts all-`auto:false` (explicit-only)
    parts, since search skips them and a canonical default is moot.

### Fixed
- **Mood prefaces no longer hijack tuning to Brazilian carnival.** Applying an
  energy preface (`up-tempo`, `exuberant`, `energetic`, `frantic`, `frenetic`)
  to any card in any genre flipped its tuning to `frevo_2_4_fast` ("carnival-
  march feel") — e.g. a doom-metal drum reshaped from `doom_sabbath_tritone_
  diminished` to frevo. Cause: those 5 prefaces carried the generic token
  `fast-tempo-110-160`, and frevo was the *only* tuning in the catalog carrying
  it (a tempo descriptor mis-used as a matchable token on a culturally-specific
  rhythm), so it was a unique magnet. Removed that token from the 5 prefaces
  (it matched zero instrument variants, so nothing else changed); frevo stays
  reachable via its frevo/carnival/pernambuco descriptors. Preface regression
  79/79 unchanged.
- **Double-pedal now reads as a double bass.** `bass_drum_double_pedal`
  rendered only its abstract descriptors `rapid`/`gallop`, which don't read as a
  pedal choice. Descriptors are now `double-bass` / `rapid-double-strokes`, so
  selecting it surfaces "double-bass" in the recipe.

### Added
- **Kick pedal part on the drum kit.** The `drum_kit` instrument had four cymbal
  parts (alloy, hammering, lathing, finish) but no foot/kick-pedal part at all —
  the pedal existed only on the separate `bass_drum` instrument. Added a
  `drum_kit_kick_pedal` part: single felt (default), single wood/plastic, and
  double pedal. The two non-default options are `auto: false` (explicit-only, so
  the reshape optimizer never spuriously auto-selects a double-bass pedal for a
  bossa-nova or modal-jazz kit) and the felt default carries no descriptors, so
  the addition is fully additive — recipe regression 1198/1198 unchanged, no
  re-bless.

- **Stereo/spatial imaging — auto-derived from intent (additive core).** Recipes
  rarely conveyed any sense of stereo/panorama. A fan-out audit (5 dimensions)
  found the cause and, critically, corrected a wrong premise: the reshape
  optimizer's axes are only `mic / pre / medium / console` (+ room / parts /
  tuning) — **fx / comp / eq / amp are NOT derivation axes** — so prefaces can
  auto-derive a stereo *capture mic* but never an fx. Shipped the additive,
  zero-churn core:
  - **Spatial prefaces now auto-derive a capture technique**: `panoramic` → A-B
    spaced pair, `stereophonic` → X-Y, `widescreen` → Blumlein, `spacious` →
    ORTF, `oceanic` → ambisonic, `cinematic`/`vast` → Decca tree (one verified
    real-descriptor token added per preface). This is the "recipes now read
    stereo" win, on the mic axis the earlier round stocked.
  - **10 imaging FX items** (fx 42 → 52): stereo widener (M/S), ping-pong delay,
    Haas doubler, auto-panner, mid-side processor, dimension chorus, rotary-speaker
    sim, mono-maker (bass-mono), pseudo-stereo, true-stereo reverb. Manually/
    connector-selectable (fx isn't a derivation axis).
  - **4 console/medium items**: wide stereo bus + mono summing bus (console 27 →
    29); mono master + stereo-spectacular master (medium 23 → 25).
  - **Dead-token audit** extended to pool chain-section item descriptors (mic/pre/
    medium/console are optimizer axes, so their item descriptors are live preface
    targets) — required for the capture-mic tokens to register as reachable.
  - **Room spatial descriptors** — 7 sacred/hall rooms now read wide (byzantine
    monastery, lalibela, Armenian/Coptic churches, tibetan gompa, wooden pagoda:
    `hall-like` / `expansive-reverb` / `cathedral-air` / `cavernous`) and
    `closet_booth` reads narrow (`dry` / `boxy` / `close` / `intimate` / `narrow`),
    so spatial prefaces retain/select the right room for those traditions.
  - **Archival → mono** — `reminiscing` / `sabi-patinated` / `tarnished` now derive
    the mono summing bus (verified). So a preface applied to a pre-war/shellac card
    reads mono, the correct image for the era.
  All additive/clean: recipe regression 1198/1198 and preface auto-suggestion 79/79
  both unchanged even with the room + archival edits; dead-tokens CLEAN. (The one
  remaining churny piece — ~34 capture-technique *defaults*, e.g. orchestral →
  Decca tree — is staged for the mic-default assignment task, since it re-blesses
  recipes and overlaps that work.)

### Added
- **Microphone taxonomy + exhaustive gap-fill (mic stage 40 → 53).** Organized
  every mic under a `family` field — Acoustic, Carbon, Dynamic, Ribbon,
  Condenser, Electret, Piezoelectric, MEMS, Optical, Capture technique — and the
  chain-stage picker now renders those as grouped headers (with the inline filter
  header-aware: typing "ribbon" collapses to just the Ribbon group). Auditing the
  families by transducer principle, form-factor, and capture technique surfaced 13
  gaps, now added: **large-diaphragm / variable-D dynamic** (RE20-class broadcast/
  kick); **shotgun** (interference-tube), **measurement/reference omni**, and
  **headset** condensers; **hydrophone** and **throat/laryngophone** piezos;
  **optical/laser** (a transducer principle the catalog was entirely missing); and
  six capture techniques — **X-Y**, **A-B spaced**, **NOS**, **binaural
  dummy-head**, **ambisonic soundfield**, and **parabolic** (the stereo palette
  had the esoteric Blumlein/Decca but was missing the two most common, X-Y and
  A-B). Added as selectable options only — no archetype defaults changed, so
  recipe snapshots are unchanged. Sets up character-appropriate mic-default
  assignment off a complete, organized palette.

### Changed
- **Wired the 50 new voice-production options into the preface intent path.** A
  usage audit found that the options added in the voice round were reachable only
  by manual `set_variant` — no preface's derivation ever selected one, because no
  preface carried a token matching their descriptors (applying `operatic` vs
  `snarling` vs `crooning` derived *identical* effort/estill/tract/vibrato). Added
  142 bridging tokens across 106 prefaces so mood/technique words now auto-derive
  the right option: `operatic` → messa-di-voce + singer's-formant ring;
  `snarling` → constricted-false-fold grit + cuivré edge; `crooning`/`smoky` →
  subtone; `liturgical` → just-intonation + countertenor + oktavist; `bellowing`
  → thick-fold + jaw-dropped; `ecstatic` → gospel-push + accelerating vibrato +
  ululation; `saudade` → sighed release; `baroque` → terraced dynamics + meantone;
  and so on across all seven enriched parts. The derivation scores a variant's
  descriptors against the target preface's tokens, so this is purely additive:
  **default recipes are unchanged** (recipe regression 1198/1198; 0 of 1195
  traditions changed auto-preface) — the tokens only steer the on-demand
  `set_preface` reshape. Preface auto-suggestion is untouched (79/79) after
  keeping voice tokens off the two non-vocal-primary prefaces (`raging`,
  `marching`) whose match scores they diluted.

### Fixed
- **Dead-token audit now counts derivation-reachable variants.** `audit_dead_tokens`
  only pooled descriptors from a card's *default/override* variants, so a preface
  token matching a non-default option read as "dead" even though the reshape
  optimizer (and manual `set_variant`) can select that option — making its
  descriptor a live, working token. Broadened the audit to also pool every
  selectable (non-`expanded`) variant's descriptors + match_tokens, matching its
  own stated intent ("tokens that exist anywhere in the authoring catalog
  associated with this card"). Still catches genuine typos/orphans (a token no
  variant anywhere carries). Audit is CLEAN with the new bridging tokens.

### Added
- **50 new options across the 7 thin voice-production parts.** The earlier voice
  round fattened the *contextual* parts (tradition 39, processing-chain 32,
  quality 27) but left the parts that describe how the voice physically makes
  sound woefully under-filled. Enriched each toward parity, all authored with
  real physiological/acoustic detail and added as `auto: false` manual palette
  options (selectable in the app picker and via the connector, but not
  auto-derived — so **zero recipe churn**): **voice_effort** / phonatory effort
  6 → 14 (subtone, messa di voce, decrescendo al niente, terraced dynamics,
  sforzando, gospel breath-pulse, edge-of-clean cuivré, marcato); **voice_microtone**
  / pitch flexibility 7 → 15 (just intonation, Pythagorean leading tones,
  meantone, Byzantine genera, pelog/slendro, gapped-pentatonic glide, untempered
  drift, siren glissando); **voice_estill_quality** 8 → 16 (the figure-level
  controls underlying the six qualities — glottal/aspirate/smooth onsets, thick/
  thin/stiff true-fold body-cover, retracted vs constricted false folds);
  **voice_vocal_tract** 9 → 17 (singer's-formant ring, jaw-dropped open call,
  raised velum, narrowed epilarynx, lengthened/lowered larynx, cupped-hand
  muffle, forward mask vs back-swallowed placement); **voice_vibrato** 9 → 16
  (bleat/caprino, narrow shimmer, pure-pitch vs amplitude-only, accelerating,
  decelerating-widening, asymmetric under-pitch scoop); **voice_register** 10 →
  15 (reinforced falsetto, countertenor, leggiero head, heavy-M1 belt, oktavist
  sub-bass); **voice_articulation** 10 → 16 (marcato, portato, glottal-stop
  punctuation, vocable syllable-drumming, ululation, sighed falling releases).
  Each renders its descriptors when picked (verified 7/7 in an isolated card,
  all ≤1000 chars); preface regression 79/79 and recipe regression 1198/1198
  both unchanged.
- **8 microphone transducer principles** the catalog was entirely missing (mic
  chain stage 32 → 40 items). The existing mic list had deep named-model coverage
  but spanned only four transduction principles — acoustic horn, ribbon, condenser,
  dynamic — with **zero** carbon, crystal, piezoelectric, ceramic, electret, MEMS,
  or contact transducers anywhere in the catalog. Added, as selectable override
  options: **carbon-button** single (`carbon_button_single`) and double/broadcast
  (`carbon_button_double`) — the 1920s electrical-transition telephone/early-radio
  lo-fi era between the horn and the ribbon generation; the **piezoelectric family**
  — Rochelle-salt **crystal** (`crystal_rochelle`), the **crystal bullet**
  (`crystal_bullet_harp`, the Astatic-JT-30 blues-harp tone the existing
  dynamic-modeled `bullet_mic` was missing), **ceramic** (`ceramic_piezo`), and the
  **contact/piezo pickup** (`contact_piezo_pickup`) for direct instrument-body
  amplification; and the **modern low-cost transducers** — **electret** condenser
  (`electret_condenser`, cassette/camcorder/consumer capture) and silicon **MEMS**
  (`mems_phone`, the phone/laptop voice-memo lo-fi sound). Each carries authored
  descriptors (e.g. `carbon-hiss`, `midrange-honk`, `breaks-up-when-cupped`,
  `agc-pumping`, `direct-body-transduction`) and canonical tags, is discoverable by
  its natural query word (carbon/crystal/piezo/ceramic/electret/mems/contact), and
  renders inside the 1000-char ceiling. Added as override options only — no archetype
  defaults changed, so recipe snapshots are unchanged (1198/1198 fixtures match).
- **`tagelharpa` instrument** (490 → 491): the horsehair-strung Nordic/Baltic
  bowed lyre was entirely missing — a catalog search returned zero hits, so the
  nearest name-match a browse could surface was a generic plucked harp
  (`celtic_harp` / `concert_harp`) standing in for a bowed instrument. Added to
  the `bowed` family (modeled on `gusle`'s regional-form pattern) as one
  instrument covering the **jouhikko** (Finnish/Karelian), **talharpa**
  (Estonian-Swedish four-string), and **moraharpa** forms, with horsehair
  ("tagel") strings as the canonical default, a drone-under-melody / ritual-
  ostinato / lament playing-context part, and membership in the shared
  `bowed_rough_drone` bow-technique pool. Used by no pre-existing tradition, so
  zero recipe churn from the add itself.
- **85 missing genre-iconic instruments** (491 → 576), found by a systematic
  region-by-region audit of all 1195 traditions against the catalog. Every
  addition is either an instrument that was entirely absent or one that a
  *generic* instrument had been standing in for. By family: **28 percussion,
  24 wind, 22 plucked-traditional, 7 bowed, 4 acoustic-strings**. Highlights:
  the **Sámi frame drum** (goavddis), **gadulka**, **dombyra**, **suona**,
  **dhol**, **davul**, **angklung**, **valiha**, **saung-gauk**, **ukulele**,
  **crwth**, **Northumbrian smallpipes**, **säckpipa**, **native American
  flute**, **bandura**, **khomus**, **taepyeongso**, and regional marimbas.
  Each carries hand-authored regional-form / playing-context / material parts
  and family-calibrated axes, following the `gusle` / `igil` template.
- **18 generic-stand-in fixes**: where a tradition's roster used a generic
  instrument in place of the specific one that defines its sound, the specific
  instrument now replaces it — e.g. the **Welsh triple harp** replaces
  `celtic_harp` in Welsh cerdd-dant/hymn-balladry, the **Azerbaijani tar**
  replaces `tar_persian` in mugham, **folk marimbas** replace
  `marimba_orchestral` in Maya/Pacific-coast traditions, **panduri** replaces
  `lute_renaissance` in the Georgian supra, **gaohu** replaces `erhu` in
  Cantonese opera, and **clapsticks** replace `claves` in Aboriginal
  songlines. Orphaned per-instrument `parts` overrides pinned to the replaced
  stand-ins were removed. Wired into 93 traditions; regression re-blessed
  (104 fixtures: the wired traditions plus blends that stack them).
- **75 more instruments, second-pass audit** (576 → 651): a second region- and
  family-lensed audit surfaced gaps the first pass missed, especially in
  families it never touched. By family: **18 plucked-traditional, 14 percussion,
  13 wind, 9 ensemble, 6 free-reed, 5 bowed, 5 keyboard, 2 electronic,
  2 electric-strings, 1 acoustic-strings**. Highlights: the **sanshin**
  (Okinawan — `shamisen` was standing in for it in the tradition literally named
  after it), the **steel band** ensemble (the Panorama tradition had a lone
  `steelpan` + orchestral cello), the **cencerro** salsa cowbell (absent from
  six salsa traditions), **phin**, **chenda**, **sape**, **fujara**,
  **simsimiyya**, **bayan**, **shruti box**, plus an early-music suite
  (**sackbut, crumhorn, vielle, rebec, viola d'amore, baroque guitar, vihuela de
  mano, portative organ, medieval psaltery**) and keyboard/electronic curios
  (**omnichord, stylophone, optigan, cristal Baschet, waterphone**).
- **10 more generic-stand-in fixes**: sanshin replaces `shamisen` in Okinawan
  eisa; the hsaing waing ensemble replaces the Balinese `gamelan_balinese_full`
  that round 1 left in the Burmese traditions; `choir_isicathamiya` /
  `choir_georgian_polyphonic` / `murga_uruguaya` replace the generic
  `choir_ensemble`; `bayan` replaces `accordion` in Russian traditions;
  `trikitixa` replaces `accordion` in Basque; `tambora_colombiana` replaces
  `surdo` in cumbia; and `vielle` / `portative_organ` replace `fiddle` /
  `pipe_organ` in early-music rosters. Wired into 78 traditions; orphaned parts
  overrides cleaned; regression re-blessed.
- **62 signal-chain archetypes + 608 tradition re-homings** (22 → 84 chain
  archetypes). An archetype is the render-visible production chain
  (mic+pre+console+comp+eq+medium+fx) describing how a tradition was canonically
  recorded. Only 22 existed for 1195 traditions: 662 sat on the generic
  `arch_modern_pro_daw_studio` and many others on cross-region proxies (bossa
  nova and French chanson both rendered through the *Havana* chain, spiritual
  jazz through *UK rock*, Nashville country through *80s SSL*). An era×region
  recording-culture audit added 62 documented archetypes — Van Gelder,
  Motown Snakepit (with James Jamerson's DI bass), Nashville A-Team, Sigma
  Sound, NYC disco 12-inch, Fania salsa, Odeon/Elenco bossa-MPB, Buenos Aires
  tango golden age, Churubusco ranchera, the "Decca Sound", ECM/Kongshaug,
  Cairo state-radio golden age, Bombay filmi playback, HMV Dum Dum classical,
  Gallo township-jive, Kinshasa rumba, Melodiya, K-pop idol complex, UK jungle
  dubplate, Berlin dub-techno — plus the field-recording archetypes the catalog
  entirely lacked (Nagra analog, 24-bit portable, wax cylinder) that now re-home
  ~380 ethnographically-recorded traditions off studio chains. Each archetype's
  components resolve against the existing chain-item inventory; all 608
  re-homings validated; regression re-blessed.
- **Voice option lists enriched across all 16 voice parts** (224 → 262
  variants; 38 re-described, 38 added, 18 proposals rejected by an
  orthogonality review). The 16-part decomposition is unchanged — this fixes
  the OPTIONS under it. All five decade-named `voice_multitrack_stack`
  options now describe the technique instead of the year (e.g. "Mid-1960s
  double-tracking era stack" → "ADT / tape-offset unison double (phasey
  detimed halo)"; eras moved to `canonical_tags`); ids unchanged, so the 1051
  traditions pinning voice variants are unaffected. Thin parts filled:
  `voice_effort` gains sustained-fortissimo and overdriven-scream pressure
  levels; `voice_processing_chain` gains slapback tape echo, dub spring-send,
  phrase-end delay throw, screwed pitch-down, megaphone/bullhorn,
  reverse-reverb pre-swell, and sidechain ducking; `voice_multitrack_stack`
  gains the hip-hop ad-lib/response lane, whisper-double, and the 10cc-style
  massed tape-loop choir wall; plus vocal-tract postures, strohbass register,
  toasting/deejay chat, gospel-runs and fado-voltinha ornament systems,
  Georgian non-tempered and Byzantine 72-moria pitch systems, and five new
  vocal-tradition schools. All additions are `auto: false` (explicit-only,
  picker/connector-facing) so default recipes stay stable.
- **The 1000-char recipe ceiling is now a HARD invariant on every render
  path.** The ceiling was threaded as a soft `|| 1000` default that any caller
  could raise: the MCP `max_chars` param advertised `maximum: 9007199254740991`
  and accepted 4000+; `recipe.js --max-chars` had no upper bound; and
  `translate()`, `renderWorkspace()`, `compileStack()`, and the browser
  `compileRecipeStack()` all honored whatever ceiling they were passed. Every
  one now clamps `Math.min(requested, 1000)` — a requested ceiling can only
  *lower* the cap, never raise it past the canonical Current-Recipe length. The
  MCP tool schema now advertises `maximum: 1000` (and rejects larger values at
  the boundary); `recipe.js --max-chars` clamps with a notice. Guard tests
  assert `MAX_SAFE_INTEGER` requests still yield ≤ 1000 across the connector,
  translate, and engine paths. No output changed (no recipe ever exceeded 1000
  under the build gate); this closes the override.

### Fixed
- **36 instruments had prose stuffed into their `short` field.** `short` is the
  instrument's concise label — and, critically, the string `_recipe_stack` kebab-
  cases into the recipe's instrument label. A minority of records had a full
  descriptive sentence there instead (lineage, technique, even artist names —
  "Tiny Moore, Johnny Gimble"), 104–329 chars long, so adding one to a workspace
  produced a garbage 180-char kebab label like
  `amplified-solid-body-mandolin-—-bright-cutting-pick-and-tremolo-lead-voice-of-western-swing-…`.
  All 36 normalized to the majority convention — `short` = the name with its
  parenthetical stripped, lowercased (`"Electric mandolin"` → `electric mandolin`,
  `"Tonkori (Ainu five-string plucked zither)"` → `tonkori`). The descriptive
  character of each instrument already lives in its parts, where it belongs.
  Longest `short` is now 38 chars (was 329); recipe regression 1198/1198 unchanged
  (none of the 36 were in a default recipe — the broken labels were purely latent).
- **Saving workspaces now works on the live site.** The Save / Load / Fork /
  Delete flow was written against an async `window.storage` host API
  (`get`/`set`/`delete`/`list`), but nothing ever provided that object outside
  the test harness — its own mock comment gave it away (*"Claude.ai provides
  window.storage as a host API at runtime; headless Chromium doesn't"*). The app
  ships as a standalone static site where no host injects it, so every Save hit
  the `!window.storage` guard and toasted "Save failed." It was never cut off —
  the logic was all real; the backing store was expected from outside and never
  arrived. `src/app.js` now installs a **guarded browser-backed store**:
  **IndexedDB** primary (async-native, large quota — a natural fit for the
  existing `{key,value,shared}` contract), **localStorage** fallback, in-memory
  Map last resort, with self-heal if IndexedDB opens but a first op fails
  (private-mode engines). It installs **only when no store exists**, so a
  host-provided `window.storage` (Claude.ai artifact) still wins, and it tags
  itself `_local_shim` so the reachability gate swaps in its deterministic mock
  for isolation (a real host store is never clobbered). Proven in real Chromium:
  raw round-trip and app-level `saveWS`/`listSaved`/`loadWS` both **survive a
  page reload**. No catalog or recipe output changed; `codex.html` rebuilt.

## [2.0.0] — 2026-06-27 — production hardening

### Added
- **Gate-lattice hardening: vacuous-pass guards + two-sided coverage of the full
  CI-blocking tail.** Four gates that could report green while checking nothing now
  refuse a vacuous pass — `check_app_parity.js` (an empty-catalog `mismatch===0 &&
  errored===0` result), `check_doc_commands.js` (the "PASS — all 0" path when the doc
  scan finds no commands), `regression_prefaces.js`, and `check_slot_picks.js` (a
  deleted fixture crashed via uncaught `readFileSync`; an emptied one passed "0/0").
  Exit-code convention unified: a missing input file exits 2 (matching the
  missing-snapshot discipline in `regression_recipes.js` / `app_recipe_regression.js`),
  data present-but-empty exits 1 (matching `check_prefaces.js`). `faults.js` now plants
  a defect across **19 gate-classes** (0 escapes, registry-completeness asserted) — new
  injections prove `check_app_parity`, `regression_prefaces`, `check_slot_picks`,
  `audit_dead_tokens`, and `check_workspace_ops` go red on planted drift, closing the
  "two-sided by inspection only" tail.
- **Connector rewrite: deterministic editable workspace (PR #49).** The MCP
  connector (`mcp/`) is now a headless driver of the same deterministic pipeline
  the browser app uses, not a hill-climb search. New tool surface: `start_recipe`
  (seed a tradition → the app's "Current Recipe"), `edit_recipe` (re-pick a
  preface — which deterministically re-derives that instrument's variants/tuning/
  room/chain via inverse-configure — swap variants, override room/chain/tuning,
  add/remove instruments and traditions), `render_recipe`, plus discovery
  (`search_catalog`, `search_prefaces`, `get_instrument`, `get_tradition`,
  `list_traditions`, `list_options`). State is passed in and out — no auto-staple.
  Retired the search-based tools (`generate_recipe`, `blend_traditions`,
  `recipe_from_axis`, `apply_preface`, `find_similar_traditions`,
  `list_instruments`) and the now-unused `mcp/corpus.js`. Connector output is
  **1119/1119 byte-identical** to the app's Current Recipe, gated in CI via
  `npm run test:connector` (incl. a headless app-vs-connector catalog-wide diff,
  `scripts/check_app_parity.js`). Shared SSOT renderer/seed/inverse-configure live
  in `scripts/_recipe_stack.js` / `_seed_workspace.js` / `_inverse_configure.js` /
  `_workspace_ops.js`.
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
- **Founder personal names dropped from maker-lineage descriptors** (the recipe
  "no artist names" contract). The synth / drum-machine / theremin "maker lineage"
  variants in `references/02_instruments.js` embedded a founder's personal name beside
  the already-named brand — e.g. "Moog Robert Moog lineage" → "Moog lineage", and the
  theremin "Moog Music Etherwave … Robert Moog reissue" → "… reissue". Brand + model +
  year + place kept, personal name removed; variant ids unchanged (opaque keys). `api/`,
  `codex.html`, `sitemap.xml`, and the recipe snapshots regenerated from source.
- **`main` is now the canonical / default branch.** Reconciled history so there is one
  source of truth; CI
  and the `sync-pages` auto-publish target `main` (the live Pages / Render line).
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
  archived audit outputs, and the legacy `docs/plans/` planning tree.
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
