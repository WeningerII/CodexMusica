# Place in CodexMusica — production plan

Status: decision-complete. Every choice below is made. The four questions that are genuinely the
product owner's are in §11, each with the default this plan already assumes, so work starts today.

Two reading conventions. A script written with its `scripts/` path exists today; a script written as a
bare filename is one this plan creates — `scripts/check_docs.js` asserts that every `scripts/`-pathed
reference in a doc resolves, so the distinction is enforced rather than stylistic. And a count of part
of the catalog is written as "N entries", never "N traditions": that same gate holds the phrase
"N traditions" to the live catalog total, so "entries" is the only way a document here can state a
subset and stay gated.

---

## 1. Verdict

Ship **place as a third view of the existing tradition picker inside `codex.html`** — a complete,
uncapped, keyboard-reachable DOM list of every tradition grouped by place, with an SVG map of at most
931 uniform marks beside it above 900px, and no `<canvas>` anywhere. The prototype's coordinates are
kept but re-typed: the geographic object becomes the **place**, not the tradition, and a place's label
is published only when a script can corroborate it from the catalog's own prose or a named person has
sourced it — day one that is 1,250 of 2,503 traditions (49.9%), rising to 2,038 (81.4%) after one
bounded editorial pass. A place with no published label draws no mark, so the map's mark count is a
derived function of the publication rule rather than a threshold anyone flips. Nothing about the map ships in Phase 1; Phase 1 removes 76 false cultural
claims that are in `references/_tradition_signatures.json` **right now** and is independently valuable
with zero geography. Three things the prototype's headline visual does — bubble size, the density
heatmap, and 25 simultaneous taxonomy hues — are cut outright, because each of them draws the drafting
method rather than the world.

---

## 2. What the prototype got right

Named precisely, because these are the reasons this work is worth doing.

1. **A spatial entry point for a catalog that has none.** Production has zero geographic data —
   `api/traditions/index.json` items are `{id, name, family, href}` and the full record adds
   `lineage, recipe, recipe_chars, score, config, source`. There is no `place`, no `lat`, no `region`
   anywhere in `references/` or `api/`. The prototype's `geo.json` is the only genuinely new asset in
   the bundle, and it is complete: 2,503 entries, exact bijection with the catalog, zero orphans.

2. **Colouring by the catalog's own taxonomy rather than by geography.** "Sonic territories over a
   borderless basemap" is the right editorial stance, and the data supports it completely: all 2,503
   traditions carry a resolving `extras.parent` against the 317 `TREE_NODES`, landing in exactly 25
   roots (verified through `scripts/_loader.js`; `node scripts/validate.js` reports 0 broken refs).
   `item.parent.split('.')[0]` is a real, total key.

3. **The provenance line.** `Traditions Atlas.dc.html:147` renders "Bubbles count documented scenes,
   not musical abundance · N drafted · M verified — corrections welcome", computed live from
   `data/geo-meta.json` at `:781`. Disclosing a drafted/verified ratio derived from the data rather
   than typed into prose is exactly this repo's culture, and it is the honest way to ship drafted
   data. Kept, moved, and gated.

4. **`kinBasis` labels itself.** `Traditions Atlas.dc.html:676` renders `'shared sound-words'` or
   `'same branch, nearest'` depending on which path ran. The prototype does not hide its fallback.
   That instinct is right even though the fallback itself is wrong (§3b).

5. **Sound-word retrieval is a real capability the current UI cannot express.** Production's tradition
   search ranks over `name`, `lineage`, `description` only (`src/app.js:18529-18535`), so a descriptor
   query is unreachable today.

6. **Guided threads.** Six curated walks, 39 stops, every stop id resolving against the live catalog.
   Genuine editorial value that costs no geography.

7. **`?trad=` deep links.** Production reads no URL parameter at all — `src/app.js` contains no
   `URLSearchParams`, no `location.search`, and its only `location` reference is `location.reload()`
   in the boot-error handler. Every tradition being addressable is a real gap.

8. **`upstream/label-policy.md`.** A serious document that names the hard cases (Kurdistan, Tibet,
   Somaliland, Taiwan, Sápmi, Nunavut, Jerusalem, Tenochtitlan, Constantinople) and says plainly that
   "today's draft is not" uniform. §6 turns its proposals into mechanical rules.

---

## 3. What is actually wrong

### (a) Prototype-medium artifacts — they vanish on rewrite, dismissed

Claude Design's `<x-dc>` markup, `{{ }}` bindings, `<sc-if>`/`<sc-for>`, the `DCLogic` base class and
all 1,911 lines of `support.js`; `state.off` as a state escape hatch with `forceUpdate()`;
`flyTo` racing `requestAnimationFrame` against `setTimeout(…, 24)` because rAF can be suspended in an
embedded preview; `ctx.arc(x, y, r, 0, 7)` with `7` standing in for 2π; 100% inline styles; one
`try/catch` around all nine boot fetches collapsing every failure into `shownCount: 'load error'`;
the five redundant `data/geo-1..5.json` shards. None of this survives a rewrite in vanilla JS against
production's 65 design tokens. Not discussed further.

One item that *looks* like medium and is not: `support.js` loads React, ReactDOM and
`@babel/standalone` from unpkg at runtime, with the integrity attribute bypassable via a
page-controlled override map. That is why **no part of the DC runtime is carried over** — an
in-browser compiler cannot coexist with the hashed CSP in §7.

### (b) Defects in the idea or the data — these survive any rewrite

**B1. Zero of 2,503 coordinates or labels are audited.** `data/geo-meta.json` is
`{"verified": [], "note": "…"}`. The coordinates and the labels were machine-drafted together
(`upstream/label-policy.md:3`). This repo already ruled on exactly this class of claim three commits
ago, in `AUDIT.md:384-388`: the 650 instruments with no material data are left blank deliberately,
because "writing plausible-sounding materials for hundreds of instruments that cannot be verified …
would put unsourced claims into a catalog whose whole value is that its defaults are researched." A
map feature does not get to be the exception.

**B2. One pin per tradition is false for 82.6% of the catalog, and 60.6% is unreachable by pointer at
any zoom.** Measured on `geo.json`: 2,503 traditions occupy **835 distinct coordinates**; 399 of those
are shared, holding **2,067 entries**; only 436 entries have a coordinate to themselves. The
worst stacks are 51.51,-0.13 London **×103**, 34.05,-118.24 Los Angeles ×54, 35.68,139.7 Tokyo ×39,
48.86,2.35 Paris ×36, 52.52,13.4 Berlin ×35. **159 stacks hold 4 or more, covering 1,516 entries
(60.6%)** — and `Traditions Atlas.dc.html:538` draws any group of ≥4 as a bubble whose click handler
(`:643-646`) only calls `flyTo`, never selects. Identical coordinates cannot separate at any finite
scale, so those 1,516 entries are unreachable from the map surface forever. The left rail cannot
rescue them: `:713` caps each group at `CAP = 14` and offers "+N more — zoom in", which is the one
action that provably cannot work. Zoom is not a disambiguation mechanism, and no renderer makes it
one.

**B3. Bubble size measures how finely the catalog subdivides Anglophone pop.** `:452` and `:539`
compute `r = max(11, min(26, 7 + sqrt(n) * 2.1))` where `n` is the count in a **58px screen cell**
after a merge pass — so the printed integer is a function of viewport width and sub-cell pan phase,
not of the data. It also saturates: every `n ≥ 82` draws the identical 26px circle, so London's 103
and any 82-stack are indistinguishable. The density layer at `:514` uses `20 + sqrt(n) * 9` with no
cap at all. And what the number counts is catalog granularity: `progressive_rock`, `art_rock`,
`glam_rock` and `synthpop` are four entries at one coordinate while `aka_baka_polyphony` is one entry
covering three peoples across two countries. No caption undoes a pre-attentive read.

**B4. Label and coordinate are not a function in either direction.** 878 distinct labels over 835
coordinates, but **931 distinct (label, coordinate) pairs**: **27 labels sit at more than one
coordinate** ("New York, US" at 11, "London, UK" at 7, "Chicago, US" and "Brooklyn, US" at 4 each) and
**87 coordinates carry more than one label** ("Bakersfield, US" and "Bakersfield, California, US";
"Rosine, Kentucky, US" and "Kentucky, US" both at 37.46,-86.74). So the same declared place is
asserted at up to eleven points 6–11 km apart. Note also that keying the place table on the
coordinate alone silently merges 96 labels — including the two names in this dataset most worth
having, "Rosine, Kentucky" and "Soho, London". The table is keyed on the pair.

**B5. False precision the schema cannot express.** 2,378 of 2,503 entries carry 2 decimal places
(≈1.1 km), 114 carry 1, 11 carry 0. Meanwhile 42 entries (30 distinct labels) carry no comma at
all — "Kazakh Steppe", "Northwest Congo Basin", "Levant", "Sápmi", "Bengal", "Central Australia" — and
are asserted at kilometre precision. `[lat, lng, label]` has no slot for extent, so no remedy is even
expressible.

**B6. 66 entries state in their own label that they have no place, and are pinned anyway.** 54 carry
`(internet-native)`, 5 `(worldwide)`, the rest `(pan-tribal)`, `(pan-regional)`, `(regional)`,
`(shortwave)`, `(Durango diaspora)` — 26 distinct labels. `vaporwave` is at Portland, `asmr_whisper_triggers`
at Los Angeles, `folk` at "Greenwich Village, New York, US (worldwide)". This is not an error a review
pass converges on; it proves the drafting method had no representation for "no place" and emitted a
plausible city instead. "Folk music originates in Greenwich Village" is a sentence this dataset
currently renders.

**B7. `region(lat, lng)` is an invented taxonomy that is demonstrably wrong.** `:256-272` is an
ordered chain of bounding-box tests returning continent names, used at `:709` as the left rail's group
heading. Run over all 835 coordinates it files all 9 Hawaiian traditions under "Latin America &
Caribbean", 12 Maghreb traditions (Algiers, Oran, Tizi Ouzou, Tunis, Fez) under "Europe", Macon
Georgia and Miami and Tampa under "Latin America & Caribbean", and Tbilisi under "Europe" despite a
"Caucasus & Central Asia" bucket existing at `:261`. It falls through to `return 'Africa'`. Production
holds no geographic taxonomy, so "region" here is invented structure, and the defect is the method:
14 ordered rectangles cannot partition a sphere along coastlines.

**B8. The signature vocabulary asserts things that are false, and those strings are in production
today.** `references/_tradition_signatures.json` covers **479 of 2,503 traditions (19.1%)** with 359
distinct tokens; 42 of those tokens name a culture, place or ethnicity. Read this session:
`didgeridoo_yidaki_solo` (Yolŋu, NE Arnhem Land) carries `"celtic"` and `"Scottish-influenced"`;
`powwow` and `inuit_katajjaq` both carry `"African-traditional"`, `"African-derived"`, `"pan-African"`;
`guqin` and `samul_nori` carry `"gagaku-foundational"`, asserting a Japanese court-music foundation for
Chinese and Korean traditions and inverting the direction of transmission. These are latent today —
the only consumer is an internal scoring baseline — but a sound-word search or a "shares sound-words"
label makes them published claims. A hand audit puts the wrong pairs at 76 across 59 entries.

**B9. The kin fallback ranks musical similarity by map distance, and the primary path is degenerate.**
`:660-665` sorts same-branch candidates by `Math.hypot` over Equal-Earth-projected coordinates —
equal-area, not equidistant, and cut at the antimeridian, so Apia to Suva (1,151 km real) measures
5.167 of a 5.413-unit-wide map while Rotorua at 2,950 km scores closer. That path serves the 2,024
entries with no signature. The signature path is not much better: **302 of the 479 in-catalog
entries share their entire token set verbatim with another tradition**, so a Jaccard ranking reports
Moroccan gnawa's closest kin, at a perfect match, as Hawaiian slack-key. Only 177 have a unique token
set; 154 have unique **and** ≥6 tokens.

**B10. Nine signature keys name no tradition, and several hold the tokens their live counterpart
lacks.** `mariachi_traditional, jingju, mongolian_xoomii, tibetan_gyuto, kompa_song_form,
kizomba_song_form, coptic_liturgical, melodic_death_swedish, norwegian_2nd_wave_black`. Live
`mongolian_khoomei` has no signature while dead `mongolian_xoomii` carries the khoomei tokens; same
shape for `tibetan_yang_chant` vs `tibetan_gyuto` (12 authored tokens) and `coptic_orthodox_chant` vs
`coptic_liturgical`. Every future id rename orphans another, silently, because nothing asserts a
signature key is a real tradition id.

**B11. The basemap is unattributed third-party political geometry.** `countries.geo.json` is 180
features whose `properties` is `{"name": …}` and nothing else; a case-insensitive grep for
licence/copyright/attribution/Natural Earth/public domain returns **zero** matches. `LICENSE` is
all-rights-reserved. It is rendered "borderless" only because `:490` sets `strokeStyle` equal to
`fillStyle` — the borders ship, unstroked, one styling change from visible, and the file carries
positions on Taiwan, Somaliland, Northern Cyprus, Kosovo and "West Bank" (with no Palestine feature).
`jewish_kaddish` at 31.78,35.22 "Jerusalem" resolves inside the "West Bank" polygon. It is also
missing land the catalog places traditions on: Singapore, Bahrain, Cape Verde, Barbados, Mauritius,
Samoa, Tonga, Maldives, Comoros and Seychelles have no polygon at all.

**B12. `upstream/unplaced-placements.json`'s premise is false.** Its note calls its 74 rows "the 74
entries missing tree placement". No tradition is missing tree placement — 2,503 of 2,503 resolve.
All 74 are already placed; 58 of its rows would silently **re-parent** a tradition and 47 require four
taxonomy nodes that do not exist in `references/04_tree.js`. `data/tree-map.json` is a text-scrape of
the same `parent` field production already publishes for all 2,503 items; the 74 it drops are an
artifact of a single-format regex over `references/06_extras.js`, which carries three authoring
shapes. The "Awaiting tree placement" grey state renders a copying error as a UI apology.

**B13. `upstream/check_geo.js` cannot fail on the thing it measures.** Run against the prototype's own
data it exits 0 and prints `OK — 2503 pins, 0 verified, 37 coordinate stack(s) of 12+ (advisory: …)`,
because the stack computation at `:27-29` is never pushed to `errs`. It accepts `(0,0)`, clamps
latitude at ±85 for an Equal Earth map defined to ±90, demands total coordinate coverage (which
forbids any tiered-publication design), and carries `<!-- @promise: atlas-geo-coverage -->` inside a
JS comment where `scripts/check_promises.js:23` will never read it — that marker is scanned only in
`AGENTS.md`, `llms.txt`, `README.md`, `SKILL.md`, and `@covers` only in `scripts/*.js`. As written it
fails nothing, covers nothing, and passes the bijection gate as an invisible orphan.

**B14. `data/routes.json` is a second, ungated coordinate namespace.** 33 routes, 66 endpoints, of
which **10 are inline `[lat, lng, label]` literals**. They contradict `geo.json` and each other: two
different Parises in the one file, a seventh London at 51.51,-0.06, and `[-4.32, 15.31, 'Kongo coast']`
which is Kinshasa, several hundred km inland. Four of 33 arcs run backwards or the wrong way against
the catalog's own dates, and four or five encode forced or colonial displacement in the same arc style
and caption register as "Tango conquers Paris".

**B15. Four of six thread claims are contradicted by the catalog's own prose.** `overtone` claims
"discovered independently on four continents" over 5 stops spanning three, and includes
`inuit_katajjaq`, whose own lineage describes an inhale-exhale breathing game with no harmonic
partials. `lullaby` is titled "Every continent sings children to sleep" over 8 stops that are Europe
×2, Asia ×4, South America ×1, North Africa ×1. `clave` attributes dembow to the clave lineage where
`reggaeton`'s lineage names the Shabba Ranks sample. `migration` says "six hundred miles" over a path
its own stops measure at 849, with a final leg running east and one 0.00-mile leg between two
identically-coordinated stops, and it orders `chicago_blues` (1940s–50s) before `black_gospel_choir`
(1932). No thread carries a byline or a citation.

**B16. Production's third-party baseline is not what the brief assumed, and `PRIVACY.md` says the
opposite of what ships.** `src/index.template.html:21-23` preconnects to `fonts.googleapis.com` and
`fonts.gstatic.com` and loads five families — Fraunces, IBM Plex Sans, IBM Plex Mono, Inter, JetBrains
Mono — on every page load; it survives into `codex.html`. (The face count is deliberately not quoted:
the `css2` response's `@font-face` count depends on Google's request-time `unicode-range` subsetting, so
it drifts with no change on our side and nothing here depends on it.) `PRIVACY.md:78-79` states "The one third party that receives content is Google, and only
for the chat bar." This is a pre-existing defect, not an atlas cost, and it is fixed first.

**B17. `main` is unprotected, so every gate below is advisory until that changes.** `AUDIT.md:365`
(remediation item 11) and `:435` (F206) record `"protected": false` from the live API, PR #135 merged
8 seconds after opening with CI not started, and #125 merged with `verify` and `freshness` both red.
It is the one item in this plan that cannot be delivered as a commit.

---

## 4. The architecture

### 4.1 Shape

**No new shipped artifact.** Everything lands in `codex.html`, rebuilt by the existing
`scripts/build_html.js`.

New source:

| Path | Kind | Notes |
|---|---|---|
| `src/atlas.js` | hand-authored, ~35 KB | The Place view. **One** top-level IIFE assigning exactly one global, `AtlasView`. |
| `references/10_places.js` | generated by `build_places.js` | `const PLACES` (id, label, extent, tier, source) + `const TRADITION_PLACE` + `const PLACE_XY` — Equal-Earth-projected fixed-point integers at 1e-7, ~931×2 values ≈ 11 KB. **No `lat`, no `lng`:** unprojected coordinates stay in `references/_places.json` and `api/places/*`. |
| `references/11_landmask.js` | generated by `build_landmask.js` | `const LAND_PATH_D` + `const LAND_VIEWBOX`, Equal-Earth-projected at build time. |
| `references/_places.json` | hand-authored source | The gazetteer. One record per (label, coordinate) pair. Coordinates live **only** here and in `api/places/*`. |
| `references/_tradition_place.json` | hand-authored source | `{tradition_id: {place, relation}}`, many-to-one, nullable. |
| `references/_signature_rulings.json` | hand-authored source | Per-(cultural token, tradition) verdict. Shape mirrors `scripts/_duplicate_rulings.json`. |
| `references/_soundword_vocab.json` | hand-authored source | token → `{class: sonic\|cultural\|material\|place}`. |
| `references/_toponym_rulings.json` | hand-authored source | One canonical label form per contested region. |
| `references/_place_budget.json` | hand-authored source | The ratchet: sourced and corroborated counts up only, off-land exceptions down only, each movement the wrong way requiring a `decrease_reason` and an allowlisted `reviewer` (§5.7). No `map_unlocked` flag and no `max_stack` counter — see §5.6. |
| `references/_threads.json` | hand-authored source | 6 walks with byline, `sources[]`, per-stop `period`. |
| `references/_boundaries/ne_50m_admin0.json` + `_SOURCE.txt` | vendored, build-input only | Read only to compute the sensitive class and the consistency check. **Never shipped, never rendered.** |
| `references/_landmask/_SOURCE.txt` | provenance record | NE tier, version, URL, licence, transform command, output sha256. |
| `assets/fonts/*.woff2` + `LICENSE-OFL.txt` | vendored | Self-hosted, replacing the CDN link. Exactly four faces, Latin + Latin-ext: Fraunces variable roman 149 KB + italic 121 KB (variable, not static instances — the `SOFT`/`opsz` axes are used at `:125, 129, 735`), IBM Plex Sans 46 KB, IBM Plex Mono 30 KB — **382 KB measured**. Inter and JetBrains Mono are dropped from the request and from the token stacks at `:59-60` as second-position fallbacks behind IBM Plex with identical script coverage. Dropping JetBrains Mono is **not** free: `.rp-text` (`:494`) names it **first**, so that rule is re-pointed to `var(--font-mono)` — a visible change to the recipe-text panel, scoped in Phase 1. |

New scripts:

- `build_places.js` — **the fourth builder.** Emits `api/places/*` and the generated
  `references/10_places.js`. Sub-second. `--check` asserts the generated module matches the JSON.
- `build_landmask.js` — **the fifth builder**, registered in `BUILDERS` on the same criterion
  (§7.3): dissolve → strip every `properties`/`id` → drop Antarctica → split
  rings at ±180° → project → simplify → 3 dp → `references/11_landmask.js`, with the viewBox
  **re-derived from the retained land extent** (dropping Antarctica leaves ~15% of the prototype's
  vertical canvas as ocean that can never hold a mark, because the southernmost tradition is at
  −45.87).
- `_place_corroborate.js` — the **frozen** corroboration rule, shared by the builder and every
  gate.
- `check_places.js` — the geo gate. 15 named failing classes.
- `check_signature_tokens.js`, `check_threads.js`, `check_deeplink.js`,
  `check_atlas_surface.js`, `check_landmask.js`, `check_atlas_projection.js`,
  `check_no_cartography.js`, `check_publish_manifest.js`, `check_egress.js`,
  `check_csp.js`, `check_escaping.js`, `check_app_size_budget.js`,
  `check_shell_parity.js`, `check_contrast.js`.

Deleted or never created: `atlas.html`, `api/atlas.json`, any `data/` directory, a root-level
`geo.json`, `tree-map.json`, `tree-nodes.json`, `geo-1..5.json`, `geo-meta.json`,
`countries.geo.json`, `region()`, `ROOT_COLORS`, every `<canvas>`.

### 4.2 Why it lands inside `codex.html` — the byte question, answered by arithmetic

The objection is that `src/app.js`'s runtime `<script>` is nearly full. Measured this session:
`node scripts/build_html.js --lazy --check` prints **`PASS — largest <script> 924 KiB of 19 blocks
(ceiling 1024 KiB)`**. `MAX_SCRIPT_BYTES` is `1024 * 1024` (`scripts/build_html.js:160`) and a block
over it exits 6 (`:368`) with a message telling you to lower `MAX_SCRIPT_CHARS`, which cannot shrink
the offending block. The ceiling is enforced **per `<script>` block** — `:352` regexes every block in
the emitted HTML — so `src/atlas.js` gets its own block with a fresh 1024 KiB budget and the runtime
block's 99.6 KiB of headroom is left untouched and reserved for maintenance of the existing app.
`MAX_SCRIPT_BYTES` is never raised: that ceiling exists because a monolithic parse was OOM-killing a
real renderer (`build_html.js:147-157`).

Block separation does **not** fix the one real hazard it creates. All classic `<script>` blocks share
one global lexical scope, so a duplicate top-level `const` across blocks throws at evaluation and
blanks a 6.1 MB page. Mitigation: `src/atlas.js` is exactly one top-level IIFE assigning exactly one
global, and `check_atlas_surface.js` asserts that (one top-level statement, one global assignment).
ESLint `no-redeclare` lints per file and cannot see across the two, so the gate is the guard.

Expected artifact growth: `references/10_places.js` ≈ 90 KB (the ~11 KB of `PLACE_XY` integers
included), `references/11_landmask.js` ≤ 80 KB, `src/atlas.js` ≈ 35 KB → 22 blocks, largest still
924 KiB, total **≈ +205 KB on 6,139,499 bytes (+3.3%)**. The 382 KB of vendored woff2 is deliberately
outside that figure: in the shipped lazy build they are separate same-origin files replacing an equally
large cross-origin fetch, so `codex.html` does not grow and the wire cost is roughly neutral. Only the
`--embedded` variant pays them inline, at ≈521 KB base64.

### 4.3 Why this shape and not the others

**The gate dividend is the whole argument.** `scripts/ui_reachability_check.js` builds an **embedded**
variant and loads it over `file://` (`:400`), because Chromium cannot fetch `api/` from a file origin
(`:71-79`). An **embedded** place table needs no fetch, so every new surface resolves in the existing
harness with **zero** rearchitecture. The dividend is only real if the table is embedded in **both**
variants, which is not automatic — `SOURCE_FILES` and `LAZY_OMIT` are hand-maintained lists, so §7.3
edits them explicitly and adds the inverse leak assertion that would otherwise let this gate pass green
over a shipped shell with no places in it. A fetching second page would have required moving the flagship
UI gate onto an HTTP server, adding a per-artifact target field to the inventory schema and to
`scripts/_inventory_parser.js`'s validation, per-target grouping in the run loop, a second
`check_mobile_layout.js` target, `atlas.html` by name in `check_artifact_fresh.js`, and hand edits to
two lists in `.github/workflows/sync-pages.yml`. We pay none of it.

`check_mobile_layout.js` needs no rearchitecture either: it already spins up an HTTP server and drives
the real shipped lazy shell across **8** viewports (`:71-79` — the brief says 7; there are 8, and the
845–899 band inside `MOBILE_MAX = 899` is measured by none of them, which is a hole for `codex.html`
independent of this feature).

### 4.4 Rejected architectures

**Rejected — a second page, `atlas.html`, prerendered at build time.** The best single idea in the
set: render the marks and the index into markup and eight problem classes stop existing rather than
needing mitigations, and the result is crawlable, works with JS off, and reaches first mark at roughly
160 KB gzipped instead of after an ~11 MB parse. It lost on cost, and the cost is not theoretical:
extracting the head and token block out of a 108 KB template that
generates a byte-diffed 6.1 MB artifact, a per-target inventory schema, two **existing** promises
reworded (`artifact-reproducible` names "api/, codex.html and the discovery files"; `mobile-layout-usable`
says "the shipped page", singular), place data deliberately duplicated between page markup and `api/`
closed only by a new parity gate, and eventually 2,504 committed HTML files whose churn tracks the
data that churns most. It also cannot prove the two pages look like one product. Its crawlable
`/t/<id>/` page space is a real, separate deliverable and is parked as such in §10, not rejected.

**Rejected — gazetteer-only, with the map locked behind a threshold.** The best data-honesty design:
publication as a computed predicate, per-edge corroboration, a computed sensitive class, and
`check_no_cartography.js` enforcing a phase boundary with absent data rather than a roadmap. Four of
its ideas are grafted wholesale (§4.5). It lost as a whole because its shipped human surface is a
modal tab telling 1,364 of 2,503 traditions their place is not established, with the map behind ~40
unfunded hours — and locking the map removes the motivation for the sourcing the lock waits on.

**Rejected — vocabulary only, no geography at all.** The most rigorously measured proposal and the
only one that repairs a live falsehood; its Phase 1 is this plan's Phase 1. It lost because it
declines the question: kin would surface for 154 of 2,503 traditions, sound-word search covers 19.1%,
place retrieval stays a substring accident (`mali` returns 129 hits including `minimalist`,
`maximalist` and `formalized`), and it drops the macro-region axis it concedes clears every blocker.
Its centre of gravity is a graft, not an architecture.

### 4.5 The grafts, and what each fixes

1. **Per-pair signature rulings, moved to Phase 1** (from the vocabulary proposal). The naive fix —
   deleting all 39 cultural tokens — shifts 7 preface golden fixtures and kills 6 live
   preface-lexicon tokens, every one orphaned by `"Chinese-classical"` alone, and destroys ~71
   *correct* attributions (`hindustani` on dhrupad, `arabic-maqam` on maqam traditions) to fix 76
   wrong ones. Removing only the three worst sets costs **nothing**: 79/79 preface fixtures, 0 dead
   tokens, 0 recipe strings changed. Truth is a property of the pair, so the ruling is on the pair.
2. **Per-edge corroboration recomputed in the build, rule frozen in one module** (from the gazetteer
   proposal). This is what de-risks the review bottleneck: it publishes 1,250 entries on day one
   at zero review hours instead of zero until 15 hours land. The rule must be frozen because a
   reimplementation moved the corroborated count by 125 records purely on tokenisation.
3. **A computed sensitive class as the review ordering and the withholding trigger** (same source).
   Ordering by tradition count reviews London (103, uncontroversial) before Lhasa. The class is
   computed from record shape, never maintained as a "contested places" file — such a file would
   itself be a political document, and it would be quoted back at us.
4. **State derived but never rendered** (same source). Deriving *and displaying* would newly stamp
   "United States of America" onto 9 Hawaiian and 19 Puerto Rican traditions where the draft says
   nothing, and would launder the basemap's positions into the project's voice. Deriving and *not*
   displaying buys the mechanical consistency check for free while asserting nothing.
5. **`check_no_cartography.js`, scoped** (same source). Coordinates are structurally absent from
   `references/10_places.js`, so `codex.html` cannot draw a map before the floor is met — enforced by
   absent data plus a gate, not by a phase order a future PR can reorder.
6. **`label_status: "under-review"` in the published artifact** (from the second-page proposal). A
   withheld label must be withheld in `api/places/*` too, or the JSON re-publishes what the map
   declined to say, stripped of the caption that made it honest.
7. **`check_publish_manifest.js`, `.nojekyll`, and the basemap reality check** (same source).
8. **Place ranked *above* prose** (converged from two proposals). `mali` already fills ranks 1–3 with
   129 hits (rank 1 ×1, rank 2 ×8, rank 3 ×120) against a 50-item cap, so a place bucket at rank 4 lands
   at position 130 and never renders.
9. **`check_app_size_budget.js` and `build_signatures.js --check` in the PR gate** (from the
   vocabulary proposal). The latter's own header claims CI catches JSON↔`app.js` drift, but it is
   invoked **nowhere** — not in an npm script, not in any workflow. The equivalent comparison exists
   only inline in `tandem.js:391-405`, which names the script solely inside its error string and runs on
   the schedule-gated job. Moving `--check` into the `gate` job therefore adds a genuinely new
   invocation rather than relocating an existing one.

### 4.6 UI decisions

- **Third view of `#modal-trad`**, rendered by a third branch of `renderTradPicker()`
  (`src/app.js:18505`). Entry is the existing `#btn-traditions` plus its two aliases
  (`src/app.js:17579-17596`, `:14719-14725`). **Zero new app-bar controls**, so
  `check_mobile_layout.js`'s `CAPABILITIES` list, its 44px loop and its overlap assertion are
  unperturbed.
- **Explicit stored mode `app.tradView ∈ {tree, place}`**, defined against all four states the picker
  actually has. `renderTradPicker` checks `app.similarFor` **first** (`:18510-18514`), two of its five
  entry points land directly in the similar view from the stack-signature panel (`:18177`, `:18193`),
  and `#search-trad`'s handler unconditionally clears `app.similarFor` (`:17628`, inside the handler at
  `:17626-17631`). Rules: entering
  `place` clears `similarFor`; a stack-panel arrival forces the similar view and leaves `tradView`
  untouched for the next open; typing keeps `tradView` and scopes results to it. Tree is the default;
  Place is never auto-selected.
- **Terminal action is the existing `[data-import]`** → `importTraditionWithFeedback(id, {closeModalId:
  'modal-trad'})` (`src/app.js:18830-18835`). No `target="_blank"`, no hardcoded
  `https://weningerii.github.io/…`, no "Copy recipe" in the place view (the tree leaf has none), no
  "Listen ↗".
- **SVG, zero canvas.** One `<svg>` with a build-time `viewBox`, one land `<path>` with
  `vector-effect="non-scaling-stroke"`, and exactly one `<circle data-place="<id>" tabindex="0">` with a
  `<title>` **per published place** — a place publishes iff at least one of its edges does, so **593 of
  931 on day one**, rising as the sourcing campaign lands. The mark count is a
  derived function of §5.5, never a cap: a place with no published label emits no circle at all (§5.5),
  which is what stops a withheld label leaking through a coordinate that reverse-geocodes to it. A `<canvas>` is one element to `ui_reachability_check.js:437`; jsdom has no 2D context,
  so `check_lazy_app.js` would fail outright; production ships zero `getContext` calls today.
- **No magnitude encoding of any kind.** Every mark is the same size. The count appears only as text
  in the place panel header, worded "N catalog entries attributed to this place" — *entries*, naming
  the catalog. No density layer, no radius/alpha/weight that is a function of a collection length.
- **No runtime clustering, because with one uniform mark per place there is nothing to cluster.**
  Overlap at world zoom is resolved by the list, never by zoom.
- **Two categorical colour tokens, both existing.** Dim `--text-3` #70767b, lit `--text` #202124.
  Measured: `--text-3` is 4.60:1 on the ocean ground and 4.13:1 on the land fill, so it clears the
  3:1 non-text floor; lit-vs-dim is **3.50:1** of luminance contrast, plus a size step, plus an
  always-present text label — CVD-immune. `--text-4` #bdc1c6 is explicitly **rejected** as the dim
  value despite a better lit-vs-dim ratio: it is 1.81:1 against white and 1.63:1 against the land
  fill, failing 1.4.11. Zero new colour tokens; zero colour literals in `src/atlas.js`.
- **Taxonomy is a selected highlight, never an always-on basemap.** 25 simultaneous categorical hues
  is not a colour scale: the top four roots are 1,130 of 2,503 (45.1%) and the bottom thirteen are
  306 (12.2%); under deuteranopia the palette collapses to ΔE00 0.6 between two entries; all 26
  white-on-hue cluster labels fail 4.5:1. Selecting a root from the legend lights its marks and dims
  the rest, with the root name always rendered as text. `ROOT_COLORS` never ships, including as
  tokens.
- **Coastline visible.** Hairline at `--text-3`. Land stays quiet at `--surface-3`; land-vs-ocean is
  1.11:1, so the fill is explicitly not the spatial reference. (`--border-strong` #dadce0 is 1.37:1
  and was tested and rejected.)
- **Below 900px: list only, no `<svg>` mounted.** 899 is production's model breakpoint and
  `check_mobile_layout.js:68`'s `MOBILE_MAX` — not the prototype's 860, and not 720. Rows ≥44px,
  uncapped, grouped by taxonomy root. Nothing is `display:none` with no route; there is no
  "+N more — zoom in" affordance anywhere.
- **Zero text drawn into any raster surface**; all labels at `--fs-micro` (12px) or larger, honouring
  the documented 12/11/11 → 13/12/12 raise at `src/index.template.html:36-45`.
- **Provenance at the claim.** Every place row and panel header carries a tier chip; the aggregate
  line is docked in the modal head in normal flow at `--fs-caption` on a solid ground, never
  absolutely positioned where the detail panel can cover it. Both figures are computed from the live
  table, and `check_places.js` fails on any numeric literal in that node.
- **Focus contract inherited verbatim** from `src/app.js:14460-14493` (store `activeElement` at `:14475`,
  focus after `UI_TIMING_MS.MODAL_FOCUS_DELAY` at `:14482`, trap Tab at `:14465-14472`, restore focus at
  `:14489-14491`). Escape-to-close is **not** in that range — it lives in the global `DOMContentLoaded`
  keydown handler catalogued as the `keyboard-escape-modal` inventory entry
  (`tests/ui_capability_inventory.md:834-843`), so the place panel wires its own Escape and gets its own
  inventory entry with a real `probe`/`expect`.
- **One `role="status" aria-live="polite" aria-atomic="true"` announcer**, written only on discrete
  commands (view switch, root highlight, place selected, search submit), with a 750 ms settle and
  identical-string suppression. Never on pan or zoom.
- **`prefers-reduced-motion: reduce` snaps in JS.** The global CSS reduce block at
  `src/index.template.html:1441-1448` cannot reach a rAF animation.
- **`?trad=<id>` focuses, never mutates.** Regex allowlist `/^[a-z0-9_]{1,64}$/`, then `Catalog.get(id)`
  (`src/app.js:639`, Map-backed, so `__proto__` and `constructor` are inert), after `CATALOG_READY`
  resolves (`:17494-17497`). Imports nothing. Leaves `location.search` intact so it stays shareable.
  Unknown ids change nothing, silently — a toast would make the id space enumerable. `codex.html`
  gains `<meta name="robots" content="noindex,follow">` **in `src/index.template.html`**, never in the
  generated `codex.html`, which `check_artifact_fresh.js` byte-compares.
  The bundle's patch is rejected: `TRADITIONS[deepTrad]` indexes an **array**
  (`references/05_traditions.js:7`, `src/app.js:531-532`) with a string id, so it is `undefined` for
  every real id in the embedded build, and `TRADITIONS` is undeclared in the shipped lazy shell
  (`:530`), so it throws a `ReferenceError` inside `DOMContentLoaded`. It also strips the parameter it
  exists to share, and `importTradition` collapses every other workspace group as a side effect
  (`:2232-2240`).
- **Threads ship in the empty-state starter gallery**, not the modal. The picker dismisses itself on
  import (`:18833`, `:2284-2286`), so importing at stop 1 would destroy the walk.
  `[data-starter-trad]` is already inventoried and already driven.

---

## 5. Data plan

| File | Source or derived | Generated by | Validated by | Owns edits |
|---|---|---|---|---|
| `references/_places.json` | **source** (hand-authored) | — | `check_places.js`, `check_no_cartography.js` | named maintainer |
| `references/_tradition_place.json` | **source** | — | `check_places.js` (BIJECTION) | named maintainer |
| `references/_toponym_rulings.json` | **source** | — | `check_places.js` (TOPONYM_UNRULED) | product owner + maintainer |
| `references/_signature_rulings.json` | **source** | — | `check_signature_tokens.js` | named maintainer |
| `references/_soundword_vocab.json` | **source** | — | `check_signature_tokens.js` | named maintainer |
| `references/_threads.json` | **source** | — | `check_threads.js` | product owner (byline) |
| `references/_place_budget.json` | **source** (ratchet) | — | `check_places.js` (RATCHET) | maintainer, monotone only |
| `references/_boundaries/ne_50m_admin0.json` | **vendored**, build-input only | `fetch_boundaries.js` | `check_places.js` (SOURCE_PINNED) | never edited by hand |
| `references/10_places.js` | **derived** | `build_places.js` | `build_places.js --check`, `check_artifact_fresh.js` | never edited by hand |
| `references/11_landmask.js` | **derived** | `build_landmask.js` | `check_landmask.js`, `check_artifact_fresh.js` | never edited by hand |
| `references/_tradition_signatures.json` | **source** (edited in Phase 1) | — | `validate.js` (key validity), `check_signature_tokens.js` | named maintainer |
| `src/app.js:15` `TRADITION_SIGNATURES` | **derived mirror** | `build_signatures.js` | `build_signatures.js --check`, `tandem.js:391-405` | never edited by hand |
| `api/places/index.json` | **derived** | `build_places.js` | `check_api.js`, `check_artifact_fresh.js` | — |
| `api/places/{place_id}.json` | **derived** | `build_places.js` | `check_api.js`, `check_artifact_fresh.js` | — |
| `api/places/by-tradition.json` | **derived** | `build_places.js` | `check_api.js`, `check_places.js` | — |
| `api/threads.json` | **derived** | `build_places.js` | `check_threads.js`, `check_artifact_fresh.js` | — |

**Nothing derived is ever hand-committed outside `api/` and the two generated `references/1x_*.js`
modules.** `check_artifact_fresh.js:111-118` compares the `api/` file set in both directions and fails
on a committed file no fresh build emits ("stale extra file"), so `api/` is a closed proven set. There
is no `data/` directory and no root-level geo file: `index.html` escapes `check:fresh` because it is an
input, and a geo table must be gated as a build input.

### 5.1 Place record schema

```
{ id, settlement, settlement_historical?, cultural_region?, aka?[],
  extent, lat, lng, state, state_basis, sovereignty,
  tier, source?, reviewer?, date?, disputed? }
```

- **`id`** — authored, kebab-case, stable (`london-uk`, `soho-london-uk`). A rename requires a retired-id
  row; `check_places.js` (RETIRED_ID) fails if a previously-published id neither resolves nor is
  retired. Published place URLs are permanent.
- **`extent` ∈ `quarter | settlement | subregion | nation | macro | none`.** It **caps coordinate
  precision**: `quarter` 3 dp, `settlement` 2 dp, `subregion` 1 dp, `nation`/`macro` 0 dp, `none` no
  coordinate at all. There is deliberately **no `venue` tier** — 2 dp source data cannot express one,
  so declaring it would be unfalsifiable.
- **`tier` ∈ `sourced | drafted`.** There is no `verified` value: that word is already bound in this
  repo to machine re-proof (`SKILL.md:909`, `scripts/check_doc_behaviors.js`), and reusing it for a
  human pass would make the same word mean two things in one repo.
- **`state`** — authored, may be `null`. **Never derived for display.** `state_basis` records the
  point-in-polygon result against the pinned boundary file and is used only to compute the sensitive
  class and to assert that one homeland is not attributed to different states in different rows.
- **`sovereignty`** — a policy-conformant string, the literal `null` meaning *deliberately unattributed*,
  or the string `"unreviewed"`. **Absent is a build failure.** Three values, not two, because `null` alone
  would make an unreviewed row indistinguishable from a decision somebody took — the same conflation this
  schema refuses one bullet above for the word `verified`. `"unreviewed"` is permitted **only** on a record
  already in the sensitive class (§5.4) and never on a `sourced` one, so it can never be a silent default on
  a publishable row, and because the set it can occupy is already withheld it moves no published figure.
- **`relation` (on the tradition→place edge) ∈ `origin | center-of-practice | first-documented |
  diaspora-hub | no-single-place`.** Machine-drafted edges default to `first-documented`, never
  `origin`. A `no-single-place` edge carries **no coordinate**; the builder fails rather than warns, and
  it publishes `place_status: "no_single_place"` — a positive fact, not a gap (§5.5).

### 5.2 Record count is decided by a gate, not by an estimate

Authoring starts from the **931** (label, coordinate) pairs. `check_places.js` class **IDENTITY**
requires that one `place_id` resolves to exactly one centroid **and** one displayed label resolves to
exactly one `place_id`. That fails today on **27 labels**, and that failure is the forcing function for
half the reconciliation pass.

IDENTITY deliberately does **not** cover the 87 coordinates carrying more than one label: two place_ids
sharing one centroid violates neither clause, and several labels per coordinate is sometimes exactly right
("Rosine, Kentucky" beside "Kentucky, US"). Measured, those 87 split into two populations with two
different mechanisms. **56 are all-pairs nested or duplicate** — "Bakersfield, US" / "Bakersfield,
California, US"; "Clarksdale, Mississippi, US" / "Mississippi Delta, US" — and a new class
**DUPLICATE_LABEL** fails on two labels at one centroid whose normalised comma segments are a subset of one
another: they merge to one record with the other form in `aka[]`. **31 contain a genuinely non-nested
pair**, and those are resolved by **PRECISION**, not by merging: a `subregion` "Kentucky, US" must round to
1 dp and therefore *cannot* share 37.46,-86.74 with a `settlement` "Rosine, Kentucky". The extent cap is
the mechanism; separating them is its output, not a further judgement call.

The final count is whatever satisfies the gate — between 878 and 931. No number is guessed. Jitter and
spiderfy are rejected outright: inventing 103 distinct London positions converts a known-unknown into
103 fabricated facts.

### 5.3 Corroboration — the honesty mechanism that costs zero review hours

`_place_corroborate.js` holds the **frozen** rule, shared by the builder and every gate. For
edge (tradition, place), in this exact order: **(1)** delete parenthetical spans *and their contents*
from `settlement`/`cultural_region`/`aka[]`; **(2)** split the remainder on comma; **(3)** trim,
NFC-normalise, lowercase — **no diacritic folding**; **(4)** drop segments of fewer than 4 characters
(the test is `length >= 4`, inclusive, so "UK" and "US" can never corroborate anything); **(5)** the
edge is corroborated iff a surviving segment occurs as a substring of the normalised haystack
`lineage + ' ' + description + ' ' + name + ' ' + exemplars.join(' ')` from `api/browse.json`.

Measured against the live catalog under exactly that rule: **1,822 of 2,503 edges corroborated
(72.8%)**, 681 not.

The rule is frozen because it is fragile in exactly the way that matters — a reimplementation moved the
corroborated count by 125 records purely on tokenisation choices. Every clause above is therefore
load-bearing rather than descriptive, and two one-word variants that read as the *same* rule were measured
and **rejected**: retaining parenthetical contents as additional segments yields 1,832 (73.2%), and making
the length test exclusive (`> 4`) yields 1,766 (70.6%). A 66-record spread across three readings of one
sentence is why an executor implements the module, not the prose. Two things follow: the rule ships with a fixture file asserting
its verdict **per named record** (not only an aggregate count, which a rewrite can hold flat while
swapping which records are in), and the corroborated count is a **ratchet** in
`references/_place_budget.json`, so a lineage reword that silently drops a place from published to
withheld fails CI and forces an explicit decision rather than passing as noise.

### 5.4 The sensitive class — computed, never listed

A place is sensitive if **any** of:

1. its label's terminal token is in the contested set of `references/_toponym_rulings.json`;
2. its label carries a non-place qualifier (`(internet-native)`, `(worldwide)`, `(pan-tribal)`,
   `(pan-regional)`, `(regional)`, `(shortwave)`, `(teknival)`, `(… diaspora)`);
3. its `extent` is coarser than `settlement`, or its label is comma-free;
4. any tradition mapping to it has a ceremonial lineage (`/ceremonial|ritual|liturg|sacred|initiation|
   funerary|shaman|invocation|prayer|devotional|rite\b/i` — **242 entries** today, touching 180
   places);
5. its `sovereignty` is the string `"unreviewed"` (§5.1) — which the schema permits only on a record
   already sensitive under 1–4, so this clause is a closure guarantee rather than a new trigger: it
   makes "unreviewed" structurally unable to appear on a publishable row.

Measured union of 1–4: **232 sensitive places covering 788 entries.** Clause 5 adds nothing to that
count by construction, which is the point of constraining it. No hand-maintained "contested
places" file exists anywhere in the repo — such a file is itself a political document. The class
self-maintains: adding a tradition or rewording a lineage pulls its place into review automatically.

### 5.5 The publication rule

> A tradition's place is published **iff** its place is not in the sensitive class **and**
> (`tier === 'sourced'` **or** the edge is corroborated).

`place_status` is a **three-value enum: `published | not_established | no_single_place`.** An edge whose
`relation` is `no-single-place` emits `no_single_place` regardless of tier, corroboration or sensitivity,
because "not established" is a false claim about it: the catalog does not fail to know where `vaporwave`
is, it knows there is no single place. That is 66 entries across 26 labels (R5), and `check_places.js`
asserts they never emit `not_established`. Everything else withheld carries
`{ place: null, place_status: "not_established", reason }`.

**A withheld place is withheld on all three surfaces.** It emits no `<circle>`, no place-list row and no
panel entry, and its `api/places/{id}.json` body is exactly `{ id, label_status: "under-review" }` — no
coordinate, no extent, no settlement, no `cultural_region`; its traditions are reachable only through the
`not_established` group. Withholding a label while publishing its point would be no withholding at all,
since a 2 dp coordinate reverse-geocodes to the label, so **SENSITIVE_PUBLISHED** fails on any coordinate,
extent or label field surviving in such a record — not merely on a rendered label.

The page and the artifact make the **same** claim; there is no state in which the JSON asserts a label
the UI withheld. Every published record carries `tier` **in band**, and `sourced` records carry
`source`, `reviewer`, `date` — so the caveat travels with the claim rather than sitting in a footer a
re-publisher strips.

Measured outcomes:

| Milestone | Published edges | Share | Human hours |
|---|---|---|---|
| Day one, zero review | **1,250** | **49.9%** | 0 |
| After sourcing the 232 sensitive places | **2,038** | **81.4%** | ~19 h |
| Withheld: sensitive | 788 | 31.5% | — |
| Withheld: uncorroborated | 465 | 18.6% | — |

### 5.6 The cartography ban — permanent, unconditional, no flag

`check_no_cartography.js` is a **fatal** step in `scripts/build.js` and it consults **no flag and no
threshold, ever**. There is no `map_unlocked` boolean, no map floor and no Phase 7 unlock, because a
conditional ban would silently re-legalise the things §4.6 and §10 call permanent — the day a flag flipped,
bubble size and the density layer would be legal again, enforced by nothing. The bans are outright:

- any `<canvas>`, `getContext(` or `fillText` in `src/**` or `codex.html`;
- any `createRadialGradient` or `globalCompositeOperation`;
- any radius/area/alpha/stroke-width expression whose input is a collection length;
- any `lat`/`lng`/`latitude`/`longitude` key in `references/10_places.js` or any file `build_html.js`
  reads — projected `PLACE_XY` integers only, so an unprojected coordinate cannot reach the page;
- any `references/_boundaries/**` byte reaching a shipped artifact.

It **permits** a closed-enum region field, so the macro-region axis in §10 stays graftable without
touching the gate. Every clause is also asserted independently by `check_atlas_surface.js`, so the
invariants survive this gate being renamed, merged or retired.

**What replaces the floor.** The SVG in Phase 4 *is* the map, and it ships behind no threshold, because
§5.5 already does the gating a threshold would only pretend to do: a place with no published label emits no
mark, so the map cannot draw a claim the artifact withholds, and the mark count rises as sourcing lands.
**Rejected: gating the Place view's map half on the sensitive review.** It inverts the phase order — the map
would wait on Phase 6 — and it removes the motivation for the sourcing it waits on, the same failure that
sank the gazetteer-only architecture in §4.4. Coverage percentages stay **reported** figures on the
ratchet: as a threshold each would be either already satisfied on day one or a second name for §5.5.

### 5.7 Verification workflow and the corrections channel

Review order, and it is the sensitive class first — **not** by tradition count, which would review
London before Lhasa: (1) the 232 sensitive places; (2) the remaining places by coverage — top 100
places cover 1,202 entries (48.0%), top 300 cover 1,782 (71.2%); (3) the 465 uncorroborated edges.

A record is promoted by setting `tier: 'sourced'` with `source` (URL or bibliographic string),
`reviewer` (initials from the allowlist in the file header) and ISO `date`. Corrections arrive as
issues and are merged by the named maintainer, never applied by submitters. Because
`build_static_api.js` never reads a place file (§7.4), a one-word label fix costs a sub-second rebuild
and a ~3–5 minute CI run rather than the **~30-minute** API compile plus ~62 runner-minutes of catalog
shards. That figure is `ci.yml:267` ("~30 min of its ~34 min at 2,503 traditions"), measured; the
"~6-min full compile" string that `check_artifact_fresh.js:89` prints is stale by a factor of five and is
corrected to ~30 min in the same commit, because it is the number a contributor reads before deciding
whether to open the PR at all.

The invitation gets a real destination or it is removed: `.github/ISSUE_TEMPLATE/place_correction.yml`
(snake_case, matching the existing `bug_report.yml` / `catalog_correction.yml`) prefilled with place id,
current record and build hash; a published `mailto:` alias in `SUPPORT.md`,
because a GitHub account is the wrong barrier for exactly the people most entitled to correct an
indigenous place name; a written 7-day acknowledgement in `SUPPORT.md`; and a `disputed: true` field
that renders on the record when a correction is declined, so an objector can see the objection landed
even when we disagreed. **Retraction is specified, and the ratchet has a documented way down.** A counter
may decrease **only** when `references/_place_budget.json` carries a `decrease_reason` naming the
correction, PR or demotion that caused it plus a `reviewer` from the header allowlist; RATCHET fails an
undocumented decrease and passes a documented one. Without that clause the plan contradicts itself:
demoting `sourced` → `drafted`, or an honest lineage reword, lowers the published-edge count, and a
monotone-only counter would turn every correction red with no permitted route down. So demotion is
genuinely always permitted and the counter still forces an explicit decision, which is the whole reason it
exists. A retired `place_id` keeps a retired-id row and its URL keeps resolving.

---

## 6. The place-naming policy

Mechanically applicable rules. This is the deliverable, not a pointer to a discussion.
`references/_toponym_rulings.json` holds the ruled forms; an unruled contested toponym **blocks the
gate**.

**R1. Present-day name first, always.** `settlement` is the current name; a historical name goes in
`settlement_historical` and always renders second, in parentheses. So "Istanbul (Constantinople)",
"Mexico City (Tenochtitlan)", "Tokyo (Edo)", "Trabzon (Pontus)". This inverts the prototype, which
renders "Constantinople (Istanbul), Turkey" for `byzantine_chant` and `byzantine_ecclesiastical`.
**Rejected: era-matched primary names** (`upstream/label-policy.md:10`) — it requires deciding an era
for every living tradition (psaltic chant is still sung in Istanbul), no editor applies that
consistently across 2,503 entries, and the output is a revanchist toponym in the primary slot for a
city 16 million people live in.

**R2. Endonym first; the exonym lives in `aka[]`, not in a parenthetical.** `cultural_region` is the term
the tradition's own community uses for its homeland, in Latin script with full diacritics. Never a biome, a
watershed, a colonial administrative unit, or a cardinal direction. For a deny-listed region the exonym goes
in the **non-displayed `aka[]` only**, never in `cultural_region`, so findability is preserved by the same
mechanism R3 uses for state names — otherwise the rule and its own gate contradict each other, since
"Altishahr (Xinjiang)" is simultaneously the rule's literal output and a build failure. A parenthetical in
`cultural_region` is permitted only for a clarifying term that is not itself the exonym being replaced. So:
`cultural_region: "Altishahr"`, `aka: ["Xinjiang", "Uyghur homeland"]`; `"Wallmapu"`, `aka: ["Araucanía"]`;
`"BaAka lands (Sangha basin)"` (legal — "Sangha basin" clarifies, it is not the replaced exonym); the
Amazigh form with `aka: ["Kabylia"]`. A deny-list gate fails the build on the literal strings `Xinjiang`,
`Araucanía`, `Congo Basin`, `Kabylia` appearing in any `cultural_region`. "Tehrangeles",
"Rosine, Kentucky" and "Soho, London" are kept — community and local names are the strongest thing in
this dataset.

**R3. `state` is authored and may be `null`; it is never derived for display.** `sovereignty` is a
policy-conformant string or the literal `null`; absent fails the build. The default for a stateless or
indigenous nation is **endonym only, no state suffix**, applied uniformly — including to the entries
that currently *have* a suffix. Today's draft is not uniform and the inconsistency is legible: the
eight Sámi entries carry Norway, Finland and nothing across three coordinates
("Kautokeino, Sápmi, Norway" ×4, "Sevettijärvi, Sápmi, Finland", "Snåsa, Sápmi, Norway", bare "Sápmi"
×2), while "Lhasa, Tibet" has no state and "Iqaluit, Nunavut, Canada" does. A non-displayed `aka[]`
field carries the state name purely for search matching, so nothing is lost to findability.
**Rejected: point-in-polygon derivation of the display string** — it would mechanically overwrite
Tibet with China and Sápmi with Finland, the exact outcome the policy exists to prevent, and it would
newly stamp "United States of America" onto 9 Hawaiian and 19 Puerto Rican traditions where the draft
says nothing.

**R4. One homeland, one state attribution.** `check_places.js` (STATE_CONSISTENT) fails if the same
`cultural_region` carries different `state` values in different rows. This clause has **zero**
political content — it forbids inconsistency, not any particular answer — and it fails today on the
Sámi set.

**R5. A label that denies a place gets no coordinate.** Any record whose label carries a non-place
qualifier is `extent: none`, `relation: no-single-place`, and the builder refuses to emit a
coordinate. Seeded mechanically from the existing suffixes: 66 entries across 26 distinct labels.
A parenthetical is not permitted as a retraction of a point.

**R6. Extent caps precision** (§5.1). A `subregion` or `macro` claim can never render at 1.1 km.

**R7. The basemap asserts nothing.** The shipped land mask is a single dissolved geometry with every
`properties`, `id` and `name` key stripped. Borderlessness becomes structural: there is no per-country
ring in the shipped bytes to stroke, and no polity name ships. `check_landmask.js` fails on any
`properties` key and on the literal strings `West Bank`, `Somaliland`, `Northern Cyprus`, `Taiwan`,
`Kosovo`, `Western Sahara` in the shipped artifact.

**R8. `upstream/label-policy.md`'s own counts are wrong and must not drive the pass.** It says
"tibetan_* (5 entries)" — there are **7 entries** carrying Tibet, collapsing to **one** distinct label
("Lhasa, Tibet"), and the distinction matters because the review unit is the place record, not the
tradition — and "sami_* (5)" — there are **8** Sámi entries across 3 coordinates and 4 distinct labels. A
review pass costed off that checklist skips 5 records, including the two bare-"Sápmi" ones. The list is
regenerated from the data before the pass, not transcribed.

---

## 7. Gates and promises

### 7.1 New promises — registry rows, in the registry's voice

Each lands as **all three** of a `scripts/_promises.js` row, a `<!-- @promise: id -->` marker in the
named doc, and a `// @covers: id` tag in the gate, or `check_promises.js` fails. Registry 22 → **30**, and
because each phase exit quotes a number, here is the progression it must match: **22 today → 25 after
Phase 1** (`signature-attribution-ruled`, `ui-surfaces-reachable`, `zero-third-party-subresources`) **→ 28
after Phase 2** (the three place promises) **→ 29 after Phase 3** (`deep-link-focuses-one`) **→ 30 after
Phase 6** (`thread-claims-sourced`).

| id | doc | gate | claim |
|---|---|---|---|
| `place-record-shape` | `AGENTS.md` | `check_places.js` | every published place carries a declared extent, a coordinate no finer than that extent permits, and a provenance tier; no other place is published |
| `place-mapping-total` | `AGENTS.md` | `check_places.js` | every tradition resolves to exactly one place record or to an explicit not-established status, and the place index and the reverse index agree in both directions |
| `place-corroboration-recomputed` | `README.md` | `check_places.js` | every published tradition-to-place edge's corroboration is recomputed from the catalog text at build time, never hand-written, and the corroborated count may only rise |
| `signature-attribution-ruled` | `SKILL.md` | `check_signature_tokens.js` | every cultural token on a tradition carries a written verdict, and no token ruled false survives in the signature table or in anything the product publishes |
| `thread-claims-sourced` | `SKILL.md` | `check_threads.js` | every published thread names an author and a citation, every stop resolves, stop periods do not decrease, and every count claimed in a thread's prose equals the count recomputed from its stops |
| `deep-link-focuses-one` | `AGENTS.md` | `check_deeplink.js` | `codex.html?trad=<id>` selects that tradition and imports nothing in both builds, and a non-conforming or unknown id changes nothing |
| `ui-surfaces-reachable` | `README.md` | `ui_reachability_check.js` | every inventory entry marked reachable resolves to at least one element in the built page under its stated precondition |
| `zero-third-party-subresources` | `PRIVACY.md` | `check_egress.js` | the shipped page requests no subresource from any origin but its own |

`ui-surfaces-reachable` is a free strengthening the repo should take regardless. `grep -c
ui_reachability_check scripts/_promises.js` returns **0** — the flagship UI gate is in no registry row,
and `faults.js:1044-1051` enumerates only promise-bound gates, so it has never been proven to go red.
Adding ~26 inventory entries (a 31% increase on 83) to an unproven gate is the largest bet in this
plan; registering it forces its fault class automatically.

Two existing claims are **not** reworded, because nothing here widens them: `artifact-reproducible`
already says "published api/, codex.html and the discovery files", and this plan ships no second
artifact; `mobile-layout-usable` already says "the shipped page", singular, and there is still one.

Deliberately **unpromised** gates — they are gates, not documented claims, the same posture as
`audit_dead_tokens.js`: `check_no_cartography.js`, `check_atlas_surface.js`, `check_landmask.js`,
`check_atlas_projection.js`, `check_publish_manifest.js`, `check_shell_parity.js`,
`check_app_size_budget.js`, `check_contrast.js`, `check_csp.js`, `check_escaping.js`.

### 7.2 New gates and what each asserts

**`check_places.js`** — 15 named, hard, exit-1 classes: **SHAPE** (schema, enums, and
`sovereignty: "unreviewed"` only on a sensitive, non-`sourced` record); **PRECISION** (decimals vs
extent — also the mechanism that separates the 31 non-nested shared coordinates, §5.2);
**IDENTITY** (one place_id → one centroid; one label → one place_id; fails today on **27 labels**);
**DUPLICATE_LABEL** (§5.2 — fails today on **56** of the 87 shared coordinates); **BIJECTION** (every
tradition resolves to a place or an explicit null, both indexes agree); **NO_COORD** (a coordinate on a
`no-single-place` edge, and any such edge emitting `not_established` instead of `no_single_place`);
**SENSITIVE_PUBLISHED** (a drafted sensitive label rendered or published, **or** any coordinate, extent or
label field surviving in a record whose label is withheld); **TIER_DRIFT** (committed corroboration ≠
recomputed); **RATCHET** (a counter moving the wrong way with no `decrease_reason` and allowlisted
`reviewer`, §5.7); **TOPONYM_UNRULED**; **STATE_CONSISTENT** (R4); **DISPLAY_UNMARKED** (a place-rendering
template emitting a label without the tier partial); **NO_LITERAL** (a numeric literal in the provenance
node); **RETIRED_ID**; **SOURCE_PINNED** (boundary file sha256 matches `_SOURCE.txt`).
`upstream/check_geo.js` is **not** adapted — see B13.

**`check_signature_tokens.js`** — every (cultural token, tradition) pair has a verdict; an
unruled pair blocks; no `false`-verdict pair survives in `references/_tradition_signatures.json` **or**
in the mirrored block in `src/app.js`; every published token is `class: sonic` or an `attested` pair;
every signature key is a real tradition id (closing B10).

**`check_threads.js`** — byline and ≥1 citation per thread; all 39 stops resolve;
non-decreasing stop `period` (which fails `migration`'s `chicago_blues`-before-`black_gospel_choir`
ordering); every numeral in a blurb equals the value recomputed from its stops (which fails "four
continents" over three, "Every continent" over eight Eurasian-plus-two stops, and "six hundred miles"
over 849).

**`check_deeplink.js`** — on `check_lazy_app.js`'s jsdom harness with a `url:` option added at
`:120`, over its existing 6-id cross-family sample, in **both** build variants: `#modal-trad.open`
present, `app.cards.length === 0`, `location.search` still contains `trad=<id>`; and `?trad=__proto__`,
`?trad=constructor`, `?trad=<script>alert(1)</script>` and a 500-char value each change nothing and log
zero page errors.

**`check_atlas_surface.js`** — over `src/atlas.js` and the built page: zero `<canvas>`, zero
`getContext`, zero `fillText`; zero `#rgb`/`rgba(`/`hsl(` literals, zero font-family strings, zero px
font sizes; at most two categorical roles; no radius/area/alpha/stroke-width expression whose input is
a collection length; exactly one top-level statement and one global assignment.

**`check_landmask.js`** — no `id`, `properties` or `name` key anywhere; no ring spanning >180°
of longitude; no coordinate above 3 dp; sha256 matches `_SOURCE.txt`; `assets/ATTRIBUTION.md` carries
the Natural Earth row; every published place centroid within **25 km** of land or an enumerated exception.
The tolerance is a declared number, not "a tolerance": 25 km absorbs a generalised 1:50m coastline
(Istanbul, Recife, Odesa, Zanzibar all fall inside it) while still failing a pin in open ocean, and the
exception list is **seeded by measurement against the chosen mask in Phase 4**, written into
`references/_place_budget.json` as a count that may only fall. Off-land is a **ratcheting budget with a
written reason per exception, not an oracle** — Natural Earth 1:110m has no polygon at all for Singapore,
Bahrain, Cape Verde, Barbados, Mauritius, Samoa, Tonga, Maldives, Comoros or Seychelles, so a hard on-land
gate against a coarse coastline red-lines on correct data. The mask is therefore **NE 1:50m land plus a
1:10m minor-islands supplement**, with the measured byte budget in `_SOURCE.txt` before Phase 4 commits to a
single `<path>`. The **≤ 80 KB** in §4.2 is a budget the Phase 4 exit confirms, not a measurement: if the
dissolved, 3 dp, simplified output exceeds it, the supplement narrows to islands carrying a placed
tradition, then the simplification tolerance coarsens. `MAX_SCRIPT_BYTES` is not raised.

**`check_atlas_projection.js`** — pure Node, no tolerance where none is needed:
`proj(0,0)` deep-equals `[0,0]`; y strictly monotone in latitude over 721 samples at five longitudes;
x strictly monotone in longitude over 361 samples at 37 latitudes; antisymmetry exactly 0; totality
(no NaN, |x| ≤ 2.7067, |y| ≤ 1.3174); 24 published Equal Earth control points at 1e-9. Because marks
and mask are projected at **build time** into fixed-point integers, the shipped page performs zero
trigonometry and `check:fresh` covers projection reproducibility with no snapshot. **No golden images,
no pixel diffs, no maxDiffPixels budget, no advisory image job.**

**`check_no_cartography.js`** — §5.6.

**`check_publish_manifest.js`** — the staged path set in
`.github/workflows/sync-pages.yml:181` (`git add -A codex.html index.html AGENTS.md llms.txt
sitemap.xml robots.txt server.json api`) equals the union of declared builder outputs. That list and
the build step at `:101-134` are both hand-typed, and the workflow's own header records two prior
omissions that shipped silently. Runs in the cheap `gate` job; it is a text comparison with no build.
`.nojekyll` lands with it — Pages serves the branch, and any generated `_`-prefixed path would be
silently dropped.

**`check_egress.js`** — zero cross-origin **subresource** fetches in the built artifact under
Playwright request interception, and statically no cross-origin `src`, `@import`, `url()`, stylesheet
`href`, or `preconnect`/`preload`/`prefetch`/`dns-prefetch`/`prerender`. Scoped to subresource-fetching
positions, **not** to every cross-origin `href`: `src/index.template.html:17` deliberately ships
`<link rel="help" href="https://codex-musica-mcp.onrender.com/mcp">` and the page also links `lucide.dev`
and `github.com`, so a blanket `href` ban would red-line correct links — and §7.1's promise text is already
scoped to "requests no subresource". Navigational links are governed by the `rel` clause instead. Also: no
absolute self-origin literal in `src/**`; `rel="noopener noreferrer"` on every external anchor; no
`clipboard.readText` anywhere.

**`check_csp.js`** — the meta CSP exists, its `sha256` values equal a fresh hash of the actual
inline blocks, `script-src` contains neither `'unsafe-inline'` nor `'unsafe-eval'`, and a Playwright
load produces zero CSP violations. Production already satisfies every precondition (zero inline event
handlers, one inline `<style>`, one inline `<script>` chain, zero `eval`, zero `data:`/`blob:`, zero
dynamic style-attribute writes) and the build is byte-reproducible, so the hash is deterministic.
`SECURITY.md` records in writing that `frame-ancestors` and CSP reporting are undeliverable via meta
on Pages, and why that is acceptable on a read-only page with no auth, no cookies and no
state-changing action — stated as a reasoned limit, not omitted.

**`check_escaping.js`** — `esc()` mandatory on every catalog-derived string reaching
`innerHTML` in `src/**`; no tradition name, place label or thread title matches `/[<>]/`; no data value
interpolated into a style attribute (under the hashed CSP that is the only remaining CSS-injection
surface). Production has 163 `esc(` tokens across ~70 `innerHTML` assignments with zero automated
enforcement, and the data already carries 19 raw `&`, 6 `"` and 51 `'`.

**`check_app_size_budget.js`** — `src/app.js` ≤ 955,000 B, in the fast `gate` job, so the ceiling
is hit by a readable gate seconds into a run rather than by `exit 6` with advice that cannot fix the
offending block. The number is derived, not chosen: `src/app.js` is 930,147 B today, and Phases 3–4 add to
it only the `?trad=` reader, `app.tradView` plumbing across the four picker states, the third
`renderTradPicker` branch, the place rank bucket, the tier chip at each place-rendering site and the
ancestor path in `renderTradLeaf` — estimated **≤ 12 KB**, because the view, all rendering, the SVG and the
announcer live in `src/atlas.js` and its own block. 955,000 B is that estimate plus a stated ~12 KB
maintenance margin. If Phase 4 exceeds it the remedy is moving code into `src/atlas.js`, never raising the
number — the anti-pattern §4.2 rejects for `MAX_SCRIPT_BYTES`.

**`check_shell_parity.js`** — the `:root` token block and reset are byte-identical to one source
file, and no file redeclares a token outside it. The one existing redeclaration is **not** a defect:
`src/index.template.html:1407` re-declares `:root` inside the ≤599px tier, setting `--fs-nano`, `--fs-code`
and `--fs-micro` all to 12px under the comment "Legibility floor: nothing below 12px on a phone. A scoped
override of the shared scale — the desktop type ramp is untouched." That is an accessibility floor,
deliberately taken. **The fix is a move, not an allowlist entry:** the three overrides fold into a named
`@media (max-width: 599px)` block *inside the token source file*, so tokens are still declared in exactly
one place and the gate ships with an empty allowlist. All three values are already 12px, so the floor is
preserved byte-for-byte through the move. **Rejected: scoping the gate to colour tokens with `:1407`
allowlisted** — it leaves the type scale with two declaration sites permanently and makes the gate's own
claim ("one source file") false.

**`check_contrast.js`** — the declared (foreground, background) and (lit, dimmed) pairing matrix,
shipping with an **empty allowlist**. It resolves grounds from **computed style in a Playwright pass**, not
from co-declared `color`+`background` pairs in the stylesheet, because most real failures inherit their
ground from an ancestor and a static parser cannot see them. That mechanism decides the fix list, so the
list is derived from the pass and not from a grep: `--text-3` on `--surface-2` measures **4.36:1**, below AA
at `--fs-micro`, and exactly **three** rules land there — `:768` `.starter-trad-count`, which co-declares
the ground, plus `:1016` `.inline-filter-count` and `:1023` `.env-cluster-count`, which inherit it from
`.part-row-grid.is-editing` (`:463`). Those three swap to `--text-2` (5.74:1) in the same commit. Three
further `--text-3` rules a static scan would have flagged are **not** failures: `:990` `.chip-block-sub`
sits on `.chip-block`'s `background: var(--surface)` (`:987`, 4.60:1, passes), and `:1032` `.fam-count` and
`:1113` `.preface-cat-count` have no tinted ancestor, rendering into `.modal-body` on `--surface`.

### 7.3 Existing gates extended

- **`scripts/validate.js:284`** — `if (e.parent && !treeIds.has(e.parent))` becomes two errors:
  `MISSING_PARENT` when absent, `BROKEN_REF` when unresolvable. Verified: `MISSING_EXTRAS` already
  catches a tradition with **no extras entry**, but a tradition with extras and no `parent` field
  passes `npm run validate` clean today while vanishing from tree browse — the `alternative_rock`
  regression the `MISSING_EXTRAS` comment at `:263-269` already names by name (that comment annotates the
  bijection loop, not the `parent` test at `:284`). Also gains signature-key validity.
- **`scripts/check_api.js`** — assert `parent` is a non-null string on every browse item; assert the
  `api/places/*` contract; assert every **non-templated** value in `api/index.json.endpoints` exists on
  disk **and** appears in `llms.txt`'s `## Catalog` markdown link list, closing the
  documented-endpoint-with-no-address hole generally (`build_discovery.js:47-52` records that many
  consumers parse only that list). Scoped to non-templated values and landing with a data fix, because
  unscoped it red-lines on today's six endpoints: `tradition` (`traditions/{id}.json`) and `instrument` have
  no fixed URL and can never satisfy it, and `browse.json` is missing from the list. **Adding the
  `browse.json` row to `llms.txt` is part of the Phase 5 cost**, not a free strengthening.
- **`scripts/check_artifact_fresh.js:85-100`** — `buildFresh()` runs exactly `build_static_api.js` and
  `build_html.js` today, unconditionally, printing the full-compile warning at `:89`. It must learn
  `build_places.js` and `build_landmask.js` **in the same commit as the first committed `api/places/*`**,
  or the exact file-set diff at `:111-118` fails as "stale extra file" on the first CI run. Order:
  `build_static_api` → `build_landmask` → `build_places` → `build_html` → `build_discovery`.
  `references/10_places.js` and `references/11_landmask.js` join the byte-diff set, so the generated
  modules are proven a pure function of the JSON. It also gains **`--only=places,html`**, which reuses the
  committed `api/` untouched and byte-diffs only `api/places/*`, `api/threads.json`, the two generated
  modules and `codex.html` against a fresh partial build. Without it a places-only PR still pays the
  ~30-minute compile, since the point of putting `api/places/*` under `check:fresh` is that they are proven
  byte-fresh and today the only proof is the full rebuild.
- **`scripts/build_html.js`** — `SOURCE_FILES` (`:60-70`, a hardcoded list of exactly nine `0x_*.js`
  modules) gains `'10_places.js'` and `'11_landmask.js'`; a new module is simply not in the page until it is
  added there. Neither joins `LAZY_OMIT` (`:106`), with the reason written at that site. And the `--check`
  leak assertion at `:318-326`, which today tests only that `sandbox.TRADITIONS`/`TRADITION_EXTRAS` are
  **absent** from a lazy build, gains the inverse: `PLACES`, `TRADITION_PLACE`, `PLACE_XY` and `LAND_PATH_D`
  must be **present in both** variants. That is what stops a future `LAZY_OMIT` edit blanking the atlas in
  the shipped shell while `ui_reachability_check.js` — which builds the *embedded* variant — stays green.
  `scripts/_loader.js`'s `FILES` list (`:8-18`, the same nine) gains them too, because `check_docs.js`
  `COUNT_CHECKS` reads `expected` from the live table and cannot see a module the loader never evaluates.
- **`scripts/_build_closure.js`** — `BUILDERS` 3 → **5** (`build_landmask.js`, `build_places.js`), each
  traced to its own `CODEX_TRACE_OUT` with per-builder containment asserted. `build_landmask.js` belongs
  there on the file's own criterion at `:38-39` ("If a fourth ever joins them it belongs here, and the trace
  check will say so loudly") because its output is byte-diffed — and per-builder containment could not
  attribute `references/_boundaries/**` to `build_places.js` anyway, since the two read disjoint inputs.
  `classify()` returns the **set** of builders a path reaches, deny-by-default = all, because under today's
  union check a path misattributed to one builder is invisible whenever another happens to read it.
  `build_places.js` must read its inputs **unconditionally at startup**, not lazily per record, or a
  `--limit`-bounded trace would miss them.
- **`.github/workflows/ci.yml`** — the scope step emits `api_affected` / `places_affected` /
  `html_affected` separately, replacing today's single `artifacts_affected` boolean (`:120`), each mapped to
  a job rather than left implicit: **`api_affected`** gates the full `buildFresh()` and the catalog shards
  (`:301`, `:307`, `:350`); **`places_affected`** alone gates `check:fresh --only=places,html`;
  **`html_affected`** alone gates the 0.3 s html build plus its byte-diff. No INERT rule is ever added for
  the place table: `build_html.js` reads the generated module, so `check_build_closure.js:187-195` would
  fail the gate on the traced read. The escape is mechanically unavailable, not merely discouraged.
- **`scripts/check_mobile_layout.js`** — one `CAPABILITIES` row (`browse-place`, satisfied by the
  existing `#btn-traditions`, so no new header control), an atlas branch on assertion G asserting the
  place **list** is on screen below 900px with **no `<svg>` mounted**, and a `narrow-880` viewport
  (880×1000, `phone: false`) so the 845–899 band inside `MOBILE_MAX` is finally measured. The existing
  `unfittable-header` fault class covers the new row.
- **`scripts/ui_reachability_check.js`** — three new `PRECONDITIONS` at `:105`: `tradition picker
  open, place view`; `…, place selected`; `…, root highlighted`. Necessary because the dynamic
  `modal open: <id>` generator only calls `openModal(id)` and never `renderTradPicker`, and the gate
  hard-fails on an unresolved precondition. Each is documented in the inventory's precondition table
  in the same commit.
- **`scripts/_inventory_parser.js`** — reject a non-DOM selector on any `kind` other than
  `keyboard-shortcut`, and require `probe`/`expect` on those, which the gate then actually presses.
  This closes the always-pass at `ui_reachability_check.js:435` (`sel.startsWith('n/a')` returns 1).
  Only 3 live entries use the sentinel today and each carries a `notes` field describing a keypress
  probe the gate never performs, so migration cost is three rows.
- **`scripts/check_promises.js:23`** — `DOCS` gains `PRIVACY.md` and `SECURITY.md`, so security and
  privacy claims become promise-bearing. Also fails on any `@promise:` marker found **outside** `DOCS`
  — proven necessary, since `upstream/check_geo.js:2` carries one that is invisible today.
- **`scripts/check_docs.js:202`** (`COUNT_CHECKS`) — rows for the published place count and the
  sourced/corroborated ratio, `expected` read from the live table, so a prose figure cannot drift.
- **`scripts/faults.js`** — **ten promise-bound classes plus two for unpromised gates, twelve in all**, each
  in the same commit as its gate, each naming its own detection phrase so a missing Chromium reports
  WRONG-REASON rather than masquerading as detection. The count is forced, not chosen: `:1044-1051` computes
  `uncovered` as every distinct `PROMISES.map(p => p.gate)` lacking a class, so §7.1's eight promises
  introduce six gates and **each** needs one, or the suite fails on completeness and the Phase 1 and Phase 6
  exits are unreachable. `check_places.js` → `place-edge-dropped`, `place-tier-handwritten`,
  `place-extent-precision`, `place-sensitive-published`, `place-label-multi-coord`;
  `check_signature_tokens.js` → `signature-pair-unruled`; `check_deeplink.js` → `deeplink-imports`;
  `check_threads.js` → **`thread-numeral-drift`** (edit a blurb numeral away from the value recomputed from
  its stops); `check_egress.js` → **`egress-external-subresource`** (re-add the `fonts.googleapis.com`
  link to `src/index.template.html`); `ui_reachability_check.js` → **`inventory-selector-stripped`** (strip a
  `data-place-pick` attribute from a built embedded page). Plus the two unpromised gates that still need
  proving: `atlas-surface-stripped` → `check_atlas_surface.js`, `cartography-smuggled` →
  `check_no_cartography.js`.
- **`eslint.config.js:67-99`** — `PLACES`, `TRADITION_PLACE`, `LAND_PATH_D`, `LAND_VIEWBOX` as readonly
  globals; a `no-restricted-syntax` rule banning any function in `src/**` that takes `(lat, lng)` and
  returns a region string, and banning `createRadialGradient`, `globalCompositeOperation`,
  `getContext`, `fillText`, `clipboard.readText`.
- **`node scripts/build_signatures.js --check`** is added to the PR `gate` job. Its own header
  (`build_signatures.js:25`) says it "Exits non-zero on any mismatch so CI/tandem catch drift", but it is
  invoked **nowhere** — grepping `.github/workflows/` for `build_signatures` returns nothing. The
  equivalent comparison exists only inline in `tandem.js:391-405`, whose `if:` at `ci.yml:430` is
  schedule/`workflow_dispatch` only, so the JSON↔`app.js` parity that Phase 1 depends on is proven weekly
  rather than on the PR that breaks it. This is therefore a new invocation, not a relocated one.

### 7.4 How `check:fresh` reproducibility is preserved

Every new shipped byte is a build product of a source file inside the closure, and every generator is
deterministic — no `new Date()`, no wall-clock value, no `Math.random`, no iteration over an unordered
set without a total sort. `api/places/*` and `api/threads.json` land inside `api/`, which
`check_artifact_fresh.js:111-127` already diffs as an exact file set and by date-normalised content.
`references/10_places.js` and `references/11_landmask.js` join the explicit byte-diff list.
`build_places.js --check` gives a third independent parity leg (JSON → generated module → `codex.html`),
the pattern `build_signatures.js` and `build_descriptor_df.js` already use.

**The critical sequencing constraint:** committing `api/places/*` without teaching `buildFresh()` the new
builders fails `check:fresh` immediately as a stale extra file — the single most likely mis-sequencing, and
it is loud, not silent.

`place` is deliberately **not** added to `api/traditions/{id}.json` or `api/browse.json` in this plan.
That would put geo inside `build_static_api.js`'s closure and make every one-word label fix pay the
~30-minute API compile plus ~62 runner-minutes of catalog shards — which is exactly the cost that
determines whether the sourcing campaign ever happens. Agents get place from one extra ~40 KB fetch
(`api/places/by-tradition.json`), registered in `api/index.json.endpoints`
(`scripts/build_static_api.js:282-289`), in `sitemap.xml`, and as a `[text](url)` row in `llms.txt`'s
`## Catalog` list. §10 revisits the per-record field once labels stop churning.

### 7.5 UI capability inventory entries

~26 entries in `tests/ui_capability_inventory.md`, in the **same commit** as the surfaces they
describe (Rule 1), taking the inventory from 83 to ~109. Every selector is a real CSS selector; **not
one** uses `n/a` or `document`.

View switch (2: `[data-trad-view="tree"]`, `[data-trad-view="place"]`) · place list row
(`[data-place-pick]`) · root group header · place mark (`#atlas-svg [data-place]`) · place panel ·
place panel member row · place panel close · root legend row (`[data-root-toggle]`) ·
clear-highlight · tier chip (`[data-place-tier]`) · provenance readout · "place under review" group
(`[data-place-open="_not_established"]`) · "no single place" group · extent disc · place search result
(`#picker-trad [data-place-hit]` — the picker renders into `#picker-trad`, `src/app.js:18506`; there is no
`#trad-results` anywhere in `src/`) · place zoom in/out/reset (`[data-place-zoom]`) · thread walk row ·
thread stop row · Escape and Tab keyboard entries (with `probe`/`expect`).

---

## 8. Accessibility contract

**Conformance target: WCAG 2.2 AA for the place surface, in the sense that every criterion below is
asserted by a gate rather than reviewed by eye.** Two criteria are named as out of reach on this host
and recorded as such rather than quietly claimed: CSP `frame-ancestors` and CSP reporting are
undeliverable via a meta tag on GitHub Pages (`SECURITY.md` carries the reasoning).

Concretely, and what enforces each:

| Requirement | Enforced by |
|---|---|
| Every one of the 2,503 traditions reachable by keyboard alone, zero pointer steps, uncapped | Split, because a Node data gate cannot assert an interaction: `check_places.js` proves only the **structural** half (every tradition in exactly one group; group sizes sum to 2,503; no group capped), and a **Playwright leg in `check_atlas_surface.js`** proves keyboard-only reach in ≤3 interactions for every group header plus the members of the ten largest places |
| No surface `display:none` with no route at any width; place list on screen below 900px with no `<svg>` | `check_mobile_layout.js` assertion G, 9 viewports |
| Every control ≥44×44 at ≤899px, reusing production's existing `<=899px` block (`src/index.template.html:1341-1361`) — no second set of sizes | `check_mobile_layout.js` `CAPABILITIES` loop |
| Zero text rendered into a raster surface; every label ≥`--fs-micro` (12px) | `check_atlas_surface.js` (no `fillText`, no px font sizes) |
| Category never carried by hue alone: lit/dim is 3.50:1 of **luminance** plus a size step plus the root name as text | `check_contrast.js` (lit-vs-dim pairing) + `check_atlas_surface.js` (≤2 categorical roles) |
| Every mark and land fill ≥3:1 against every shipped ground (1.4.11); coastline visible | `check_contrast.js` |
| Every text pairing ≥4.5:1 — including the six existing `--text-3`-on-`--surface-2` rules fixed in the same commit | `check_contrast.js`, empty allowlist |
| Focus never lost: `activeElement` stored on open, Tab trapped, Escape closes, focus returns to the originating row | inventory keyboard entries with real `probe`/`expect` |
| `prefers-reduced-motion: reduce` snaps in JS (the CSS reduce block cannot reach a rAF animation) | `check_atlas_surface.js` (guard present) + a Playwright leg with `reducedMotion: 'reduce'` |
| Status changes announced once, on discrete commands only, never on pan/zoom; 750 ms settle; identical-string suppression | Playwright leg: zero status mutations across a scripted pan, exactly one across a filter toggle |
| No hover-only affordance; no `title=` as a control's only label | `check_atlas_surface.js` |
| Document `lang`, exactly one `<h1>`, non-skipping heading levels | `check_atlas_surface.js` |

Explicitly **rejected**: a roving-tabindex arrow-key traversal over marks (undefined for the 2,067
entries that share a coordinate), a separate accessible-alternative view (two data paths that will
drift and that `check:fresh` cannot hold together), and any canvas pixel-snapshot or draw-call gate
(nondeterministic across DPR and font stacks, so it breaks `artifact-reproducible`).

---

## 9. Delivery phases

### Phase 0 — Make the merge boundary real *(hours; not a commit)*

Apply the ruleset in `docs/branch-protection.md`: `catalog-result` as a required status check, direct
pushes disallowed.

**Owner:** the repository admin — this is the one item in the plan that requires an account permission
rather than a commit, so it cannot be delegated to whoever writes Phase 1.

**Exit:** `repos/WeningerII/CodexMusica/branches/main` returns `"protected": true` with
`catalog-result` in `required_status_checks`. `AUDIT.md` item 11 struck. Nothing below is enforceable
until this holds. Phase 1 may be **authored** in parallel, but no Phase 1 PR **merges** until this exit
holds: every gate it adds is advisory until then, which is precisely the condition B17 describes — #135
merged 8 seconds after opening with CI not started.

### Phase 1 — The vocabulary truth pass *(2 weeks — independently shippable, zero geography)*

**Scope.** Author `references/_signature_rulings.json` covering every (cultural token, tradition) pair
against the catalog's own lineage prose, and `references/_soundword_vocab.json` classifying all 359
in-catalog tokens. Delete `false`-verdict pairs from `references/_tradition_signatures.json`;
regenerate the `src/app.js` mirror via `build_signatures.js`. Reconcile the 9 orphan keys through
`scripts/_duplicate_rulings.json`, recovering `tibetan_gyuto`'s 12 tokens and
`mongolian_xoomii`'s khoomei tokens for the live traditions that have none. Ship
`check_signature_tokens.js`. Move `build_signatures.js --check` into the PR gate. Add
`MISSING_PARENT` to `validate.js:284` and signature-key validity. Register
`ui-surfaces-reachable`; narrow the `n/a` sentinel in `_inventory_parser.js` and make the gate press
the three keyboard entries. Correct `PRIVACY.md`; self-host the four faces in §4.1, drop Inter and
JetBrains Mono from the request and the token stacks, and **re-point `.rp-text` (`:494`) to
`var(--font-mono)`** — a visible change to the recipe-text panel, which is why it is named in scope rather
than absorbed. Ship `check_egress.js`. Ship
`check_contrast.js` with an empty allowlist and fix the six `--text-3` rules. Ship
`check_app_size_budget.js` and `check_publish_manifest.js` + `.nojekyll`. Delete
`upstream/unplaced-placements.json` from the handoff with the false-premise finding recorded.

**Why this is Phase 1.** The three worst attribution sets cost **nothing** to remove — 79/79 preface
fixtures, 0 dead tokens, 0 recipe strings changed — while the naive blanket 39-token deletion shifts 7
goldens and kills 6 live preface-lexicon tokens. The fix that matters is free, needs no editorial
judgement about sovereignty, and it removes a live published falsehood. It must not sit behind a map.

**Exit:** every cultural pair has a verdict and an unruled pair exits non-zero. Zero `false`-verdict
pairs in `references/_tradition_signatures.json` **or** in `src/app.js`, with
`build_signatures.js --check` and `tandem.js:391-405` green. Zero signature keys naming no tradition.
`npm run test:prefaces` **79/79** and `node scripts/check_prefaces.js` reports **0** production-dead
tokens — any shift is attributable to a specific reviewed ruling, recorded pair-by-pair in the PR
body. `node scripts/validate.js` now fails when a tradition's `parent` is deleted. `node
check_egress.js` reports 0 cross-origin subresources. `node check_contrast.js` passes
with an empty allowlist and zero remaining `--text-3`-on-`--surface-2` pairings. `npm run check:promises`
PASS at **25** promises, 0 orphans (22 today plus `signature-attribution-ruled`, `ui-surfaces-reachable`
and `zero-third-party-subresources`). `npm run faults` 0 escapes with the new classes, including
`egress-external-subresource` and `inventory-selector-stripped`. `npm run check:fresh` green.

### Phase 2 — Place data, gates, and the closure split *(2 weeks; no UI)*

**Scope.** Author `references/_places.json` from the 931 pairs as a **reconciliation**, not a copy:
resolve the 27 labels at multiple coordinates and the 87 coordinates with multiple labels; assign
`extent`/`state`/`sovereignty` to every record; set the 26 qualifier labels to `extent: none` and their
66 entries to `relation: no-single-place`; set the 30 comma-free labels to `subregion`/`macro` at
their permitted precision. Author `references/_tradition_place.json`, `_toponym_rulings.json`,
`_place_budget.json`. Pin `references/_boundaries/ne_50m_admin0.json` with `_SOURCE.txt` and an
`assets/ATTRIBUTION.md` row. Write `_place_corroborate.js` (with its fixture file), `build_places.js`,
`check_places.js`, `check_no_cartography.js`. Make the closure per-builder; teach `buildFresh()`;
split the CI scope output. Ship the corrections channel: issue template, `SUPPORT.md` alias and SLA.

**Exit:** `node check_places.js` exits 0 with all **15** classes clean — 0 labels at more than one
coordinate, 0 nesting duplicate labels at one centroid, 0 place_ids with more than one centroid, 0
coordinates finer than their extent permits, 0 coordinates on a `no-single-place` edge, all 66
`no-single-place` edges emitting `no_single_place` and never `not_established`, 0 unruled contested
toponyms, `state` consistent per `cultural_region`, corroboration recomputed and matching the fixture file
record-by-record at 1,822. `node scripts/check_build_closure.js` green with **5** builders traced and
per-builder containment asserted. `npm run check:fresh` green with `api/places/*` byte-identical to a fresh
build. `node check_no_cartography.js` exits 0 and fails on a planted `lat` key in
`references/10_places.js`. `npm run faults` catches all five planted place defects. A PR touching only
`references/_places.json` logs `api_affected=false places_affected=true`, runs
`check:fresh --only=places,html` rather than `buildFresh()`, and completes in **under 6 minutes** — reachable
only because of that flag, since the full compile is ~30 minutes on its own. Without the partial path this
criterion is arithmetically impossible and the correction workflow §5.7 depends on does not exist. No UI
ships.

### Phase 3 — `?trad=` focus, in its own commit *(2 days)*

**Scope.** Read `location.search` at the tail of `_initApp`, after `CATALOG_READY`. Validate, then
`Catalog.get(id)`. Open `#modal-trad` with that tradition selected; import nothing; leave the URL
intact. Add `robots noindex,follow` to `src/index.template.html`. Ship `check_deeplink.js` and its
promise, plus the fault class. One inventory entry for the modal state — not an `n/a` row.

**Exit:** `node check_deeplink.js` exits 0 in both build variants over the 6-id sample, with
all four adversarial inputs importing nothing and logging zero page errors. `npm run faults` fails the
gate when auto-import is restored. `?trad=` appears nowhere in `sitemap.xml` (still 3,918 `<loc>`).

### Phase 4 — The Place view *(3 weeks)*

**Scope.** `references/11_landmask.js` + `build_landmask.js` + `check_landmask.js` +
`check_atlas_projection.js`. `src/atlas.js` as one IIFE, emitted as its own `<script>` block by a
two-line change to `build_html.js:242-245`. Third branch of `renderTradPicker()`; `app.tradView`
defined against all four states. Above 900px: the SVG plus the region-grouped place list plus the root
legend. Below 900px: list only. Place panel enumerates every member as a `renderTradLeaf` row
**extended with the ancestor path** — verified missing from `renderTradLeaf` (`src/app.js:18640-18669`)
and present only in the inline search rows at `:18571-18573`, and a 103-row London list without a
taxonomic anchor is unreadable. Tier chips at every place-rendering site; provenance line docked in
the modal head. `role="status"` announcer. Place rank bucket inserted **above** prose in the picker
ranker. `check_atlas_surface.js`, ~26 inventory entries, 3 preconditions, the mobile capability and
assertion-G branch, `narrow-880`. The hashed meta CSP + `check_csp.js`; `check_escaping.js`;
`check_shell_parity.js`.

**Exit:** `npm run reachability` passes ~109 reachable entries, 0 failures, zero `n/a`/`document`
selectors among the new ones. `node check_atlas_surface.js` exits 0 on every clause.
`node scripts/build_html.js --check` prints **22 blocks, largest 924 KiB**, exit 0.
`node check_app_size_budget.js` green. `npm run check:mobile` passes all 9 viewports with
`browse-place` reachable and no `<svg>` below 900px. `npm run check:fresh` byte-identical.
`npm run faults` 0 escapes across all classes. `check_csp.js`, `check_escaping.js`,
`check_shell_parity.js` exit 0, the last with the three ≤599px type overrides folded into the token source
file and all three still 12px. The SVG carries exactly one `<circle>` per published place — **593** at Phase
4's data state — and `check_places.js` asserts that count equals the publication rule's output, not a
constant. Every one of the 2,503 traditions reachable in ≤3 interactions from a cold load, split across the
two gates that can each assert their half: `check_places.js` for the structural sum (every tradition in
exactly one group, sizes totalling 2,503, no group capped), the Playwright leg in `check_atlas_surface.js`
for keyboard-only reach across every group header and the members of the ten largest places.

### Phase 5 — The machine surface and the connector *(1 week)*

**Scope.** Register `places_index`, `place`, `place_by_tradition`, `threads_index` in
`api/index.json.endpoints`, in `sitemap.xml`, and in `llms.txt`'s `## Catalog` link list. Extend
`check_api.js` (endpoint↔address, place contract). Register the published ratio as a `COUNT_CHECKS`
row. Connector: an optional `place` filter on `list_traditions`, a read-only `get_place(place_id)`,
place-label matching in `search_catalog` — all read-only, idempotent and closed-world, carrying no
structural JSON-schema keyword, so they ride the existing `connector-tools-read-only` and
`connector-schema-subset` promises with no new registry row. Reconcile the two divergent privacy
documents (root `PRIVACY.md`, `mcp/PRIVACY.md`), both of which sit inside the deployed image.

**Exit:** `npm run check:api` and `npm run check:fresh` green with `api/places/*` in the exact file
set. `check_connector_contract.js` and `check_connector_parity.js` green with the three new surfaces.
`npm run check-docs` fails when a documented place count is edited away from the computed value.
`sitemap.xml` contains no URL with a `?` or `#`.

### Phase 6 — Threads, and the sourcing campaign *(2 weeks + ongoing)*

**Scope.** Author `references/_threads.json` with byline, `sources[]` and per-stop `period`; re-author
the four contradicted blurbs to the counts their stops support; drop `inuit_katajjaq` from `overtone`;
rewrite the `clave` dembow link to name Jamaican dancehall. Promote `STARTER_TRADITIONS`
(`src/app.js:14651-14685`) to six titled walks in `#starter-gallery`. Ship `check_threads.js` and its
promise. Then the sourcing campaign: batched PRs, sensitive class first, each raising
`references/_place_budget.json`.

**Exit:** `node check_threads.js` exits 0 on byline, citations, resolving stops, non-decreasing
periods and recomputed blurb numerals, with `thread-numeral-drift` proving the last of those two-sided.
`sensitive_unsourced` reaches 0 and published coverage reaches **81.4%** (2,038 edges), which raises the
mark count on the already-shipped map without any flag being flipped. `npm run check:promises` PASS at
**30** promises. Every budget counter is a ratchet and `npm run faults` catches a planted undocumented
decrease.

---

## 10. What we are deliberately not building

- **The always-on 25-hue taxonomy basemap** — the prototype's signature look. Unbuildable at any hex
  values: the top four roots are 45.1% of the catalog and the bottom thirteen 12.2%; under
  deuteranopia two entries collapse to ΔE00 0.6; all 26 white-on-hue cluster labels fail 4.5:1; the
  legend already had to scroll to show its rows. Replaced by single-root highlight in two
  luminance-separated tokens with the root name always in text. Nothing true is lost — only the claim
  of simultaneous 25-way readability, which was false.
- **Bubble size, the cluster numeral, and the Density heatmap.** B3.
- **Canvas, entirely.** Not demoted to decoration behind an ARIA mirror — deleted. Dropping it also
  drops the raster budget gate, DPR capping, `touch-action`, rAF coalescing, tween cancellation, glyph
  rasterisation, the paint-trace snapshot and every argument about golden images: a whole verification
  framework that would otherwise have to be built and proven two-sided for one feature.
- **All clustering**, at runtime and at build time. With one uniform mark per place there is nothing to
  cluster.
- **Any state, sovereignty or region string derived from geometry for display.** R3.
- **`region(lat, lng)` and the "In view" rail.** B7; the rail could surface at most 11 × 14 = 154 of
  2,503 rows (6.2%) while telling 2,067 entries to zoom in.
- **`data/routes.json` — the 33 diaspora arcs.** B14. If it returns, it returns with endpoints
  restricted to a tradition id or a gazetteer place id (zero inline literals), a required
  `displacement` enum (`forced | colonial | voluntary | commercial`) with distinct rendering and plain
  declarative captions for the forced and colonial set, `sources[]`, and a named reviewer. The Middle
  Passage cannot ship in the same arc style and caption voice as "Tango conquers Paris".
- **Kin and sound-word retrieval in the shipped UI.** B8/B9. Only the integrity work ships in Phase 1.
  If they return, kin is offered only for the traditions whose token set is **unique to them and ≥6
  tokens deep** (154 today) and is **absent** elsewhere with no placeholder and no relabelled
  fallback; the geometric fallback never returns; and the coverage figure (479 of 2,503) is printed at
  the point of use and registered as a `COUNT_CHECKS` row. Thresholding a Jaccard score cannot fix a
  5-token set shared verbatim by six unrelated traditions — only uniqueness can.
- **"Listen ↗".** A YouTube search built from a tradition name, on a site whose whole architecture is
  zero third-party requests, for a catalog including 242 ceremonial-lineage traditions. The
  destination is a ranked search result, not a recording, so the label claims a provenance it cannot
  deliver. Those 242 entries instead gain a notice: "This entry describes it; it is not an
  instruction to perform it."
- **"Copy recipe" in the place view.** `grep -c 'parseRecipe|fromRecipe|importRecipe' src/app.js` → 0.
  There is no importer for a recipe string, so it is a dead end dressed as an action. (Copying the
  recipe stays where it already is, on the workspace card.)
- **The Ink / dark basemap.** A Claude Design authoring prop (`:219` `data-props`) that recoloured
  canvas internals while the chrome stayed light. Production ships zero dark support, and 9 of 26 mark
  colours fall below 3:1 against Ink land versus 6 of 26 against Light, so satisfying both would
  constrain the palette twice for no established need.
- **`data/tree-map.json`, `data/tree-nodes.json`, the "Awaiting tree placement" state, and
  `upstream/unplaced-placements.json`.** B12. Zero taxonomy nodes are added and zero traditions
  re-parented: a map feature must never be the reason the catalog's taxonomy changes.
- **`upstream/check_geo.js`.** B13.
- **A second HTML page, and the 2,503 prerendered `/t/<id>/` pages.** Parked as a **named, separable**
  deliverable with its shape pre-decided, not rejected on merit: its own builder and gate; an absolute
  self-referential canonical per page; `<link rel="alternate" type="application/json">` to the already-gated
  per-id endpoint; `crossRefs` anchors; the existing `assets/og-image.png` shared as `og:image` with
  `twitter:card`; `description` emitted **only where it differs from `lineage` after trim** (409 of
  2,503 are byte-identical or prefix-nested, so emitting both unconditionally would ship visibly
  duplicated prose on 16% of the pages built to be indexed); and a place line only where the tier is
  not drafted-and-sensitive. The negative is honoured in the meantime: `?trad=` is never canonical,
  never sitemapped, and `codex.html` is `noindex,follow`, so nothing is canonicalized wrongly while
  the page space waits.
- **`place` on `api/traditions/{id}.json` or `api/browse.json`.** §7.4. Revisited once labels stop
  churning — the trade is one extra ~40 KB agent fetch against a ~30-minute rebuild per label fix.
- **The ~20-term authored macro-region axis** — the cheapest correct geographic idea available: it
  takes no position on statehood, matches the register the recipes already use, and needs no
  coordinates. It is **not** in this plan because it is a 2,503-row classification campaign whose
  authoring, review and error rate nobody has scoped, and pretending it is free because it needs no
  sourcing would be the same mistake as the coordinates. `check_no_cartography.js` is deliberately
  written to **permit** a closed-enum `region` field so it can be grafted later without touching the
  gate. If the owner wants exactly one geographic thing beyond this plan, this is it.
- **Schema.org JSON-LD.** There is no honest type for a music tradition (`DefinedTerm` is closest and
  earns no rich result), and this repo does not merge claims it cannot gate.
- **Any promise that a coordinate is correct.** No script can prove it, and `check_promises.js` would
  then be enforcing a claim wider than its gate.

---

## 11. Open questions for the product owner

Each has the default this plan already assumes, so Phases 0–2 start before any answer arrives.

**Q1. Do we fund the ~19-hour sensitive-class review as a launch condition for the Place view, or ship
Phase 4 with those 788 entries reading "place under review" indefinitely?**
*Recommended default (assumed): fund it, scheduled in Phase 6, and ship Phase 4 before it lands.*
Day one is already 1,250 published traditions (49.9%) at zero review hours across 593 marks, so the view
is useful without it; the review takes it to 2,038 (81.4%) and 780-odd marks. Nothing is gated on it —
there is no map unlock (§5.6), so the review buys published coverage and nothing else waits on it.
Withholding forever is safe but means "place under review" on every indigenous, ceremonial, stateless and
region-scale entry — the ~31% of the catalog where a place surface has the most to offer, and where
absence reads as avoidance rather than care.

**Q2. Do we publish a `mailto:` alias for place corrections, accepting a human-monitored inbox on a
project whose entire support surface is GitHub issues?**
*Recommended default (assumed): yes — one alias, routed into the same triage queue as the
`place-correction` label.*
A GitHub account is the wrong barrier for exactly the people most entitled to correct an indigenous
place name, and "corrections welcome" is not credible if the only door needs a developer account. If
this is declined, the honest consequence is that the line must say what is true — "corrections via
GitHub" — and the `disputed: true` flag becomes the only channel an objector has.

**Q3. Who is the named reviewer of record, and who arbitrates a declined correction?**
*Recommended default (assumed): the single maintainer is the sole merger of place corrections and is
recorded per record; a declined correction sets `disputed: true` and is closed with a written reason,
never silently.*
No gate can distinguish a real citation from a plausible one — every gate here checks that `source` is
a non-empty string, `reviewer` is in the header allowlist and `date` parses ISO. If no second reader
exists for the sensitive class, that should be a written decision rather than an implicit one, and the
honest fallback is that the sensitive class ships withheld until one does.

**Q4. Is the Place view's first impression allowed to cost a full app boot?**
*Recommended default (assumed): yes — the place list paints only after `CATALOG_READY` resolves, so a
stranger arriving on a shared link pays a full app boot before the first row. That is accepted for this
plan; if it becomes the deciding metric the answer is the parked `/t/<id>/` page space in §10, not a
faster modal.*
There is no partial-paint mitigation to claim: `src/app.js:17494-17497` is
`DOMContentLoaded → if (CATALOG_READY) CATALOG_READY.then(_initApp)`, so **nothing** inside `_initApp` runs
before the 4,993,494-byte `api/browse.json` fetch resolves — not `renderTradPicker`, not a list rendered
from the embedded table. A visitor parses the 6.1 MB shell plus that fetch before any row appears: ~2.7 MB
over the wire and ~11 MB to parse, against ~160 KB gzipped for a prerendered page. A split boot would fix it
and is deliberately not in this plan.

---

## Appendix — measurements, all taken this session

| Fact | Value | Source |
|---|---|---|
| Largest `<script>` block / ceiling / count | 924 KiB / 1024 KiB / 19 | `node scripts/build_html.js --lazy --check` |
| `codex.html` | 6,139,499 B | `ls -la` |
| `api/browse.json` / `api/all.json` | 4,993,494 B / 1,959,542 B | `ls -la api/` |
| Traditions / tree nodes / roots | 2,503 / 317 / 25 | `scripts/_loader.js` |
| Traditions with no `parent` / dangling | 0 / 0 | `scripts/_loader.js`; `node scripts/validate.js` → VALID |
| Root distribution: top 4 / bottom 13 | 1,130 (45.1%) / 306 (12.2%) | `scripts/_loader.js` |
| geo: traditions / coords / labels / (label,coord) pairs | 2,503 / 835 / 878 / **931** | `geo.json` |
| Coordinate stacks / traditions stacked | 399 / **2,067** | `geo.json` |
| Stacks ≥4 / traditions in them | 159 / **1,516 (60.6%)** | `geo.json` |
| Worst stacks | London 103, LA 54, Tokyo 39, Paris 36, Berlin 35 | `geo.json` |
| Labels at >1 coordinate / coords with >1 label | **27** / **87** | `geo.json` |
| Decimal places (max of lat,lng) | 2 dp ×2,378 · 1 dp ×114 · 0 dp ×11 | `geo.json` |
| Non-place qualifier traditions / distinct labels | 66 / 26 | `geo.json` |
| Comma-free labels: traditions / distinct | 42 / 30 | `geo.json` |
| Audited coordinates | **0 of 2,503** | `data/geo-meta.json` |
| Corroborated edges (frozen rule, §5.3 clauses 1–5) | **1,822 / 2,503 = 72.8%** | `api/browse.json` × `geo.json` |
| Ceremonial-lineage traditions / places touched | 242 / 180 | `api/browse.json` |
| Sensitive places / traditions covered | **232 / 788** | computed union |
| Day-one published / withheld sensitive / withheld uncorroborated | **1,250 (49.9%)** / 788 / 465 | publication rule |
| Day-one published **places** (≥1 published edge) | **593 of 931** | publication rule |
| After sourcing the sensitive class | **2,038 (81.4%)** | publication rule |
| (label, coordinate) pairs holding >8 entries | 53, covering 906 entries (36.2%) | `geo.json` |
| Coordinates with >1 label: nesting/duplicate vs non-nested | **56** / **31** | `geo.json` |
| Place coverage curve (top N places → traditions) | 20→529 · 100→1,202 · 300→1,782 · 600→2,172 | `geo.json` |
| Signatures: keys / in-catalog / orphans | 488 / **479 (19.1%)** / **9** | `references/_tradition_signatures.json` |
| Signature tokens / instances / avg | 359 / 3,445 / 7.2 | same |
| Traditions sharing a full token set | **302** | same |
| Unique token set / unique + ≥6 tokens | 177 / **154** | same |
| Threads / stops · routes / inline literals | 6 / 39 · 33 / **10** | `data/threads.json`, `data/routes.json` |
| Basemap features / provenance keys | 180 / **0** | `countries.geo.json` |
| Promises / inventory entries / mobile viewports | 22 / 83 / **8** | `_promises.js`, inventory, `check_mobile_layout.js:71-79` |
| `ui_reachability_check` rows in the registry | **0** | `grep -c` |
| `--text-3` on white / on `--surface-2` / on land | 4.60 : 1 / **4.36 : 1** / 4.13 : 1 | tokens at `src/index.template.html:62-99` |
| `--text-4` vs white / vs land | 1.81 : 1 / 1.63 : 1 (both fail 1.4.11) | same |
| lit `--text` vs dim `--text-3` | **3.50 : 1** | same |
| Land vs ocean (the prototype's only spatial reference) | **1.11 : 1** | `Traditions Atlas.dc.html:488-490` |
| White on `--accent` | 4.47 : 1 (fails 4.5) | tokens |
