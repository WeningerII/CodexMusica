# Geographic attribution audit

Date: 2026-10-06/07. Baseline: the 7078-tradition catalog and `data/geo.json` at the <!-- check_docs:ignore -->
head of `main` on that date. Per-entry evidence is in
[`geographic-attribution-audit/`](geographic-attribution-audit/). The audit itself
changed no catalog data. Its first recommendation, re-pinning the confirmed wrong pins,
was applied on 2026-10-07 (see [Applied: re-pins](#applied-re-pins-2026-10-07)), and the
review of the arbitrary pins it called for followed on 2026-10-08 (see
[Applied: arbitrary-pin review](#applied-arbitrary-pin-review-2026-10-08)). The figures
below describe the catalog before those changes.

## The question

The atlas looks lopsided. Europe holds 2697 pins and North America 1687, against 374
for Africa, 236 for South Asia and 49 for the Caucasus and Central Asia. Does that
come from **misattributed pins** (fix the data), from **source bias** (go find more
traditions), or from both?

## Short answer

Both, but they are different problems with different sizes.

1. **Wrong pins are real but small.** 264 pins are confirmed to be in the wrong place,
   210 of them in the wrong country, and a sample suggested about 125 more among the
   arbitrary pins (a full review later found 43). Relocating the confirmed ones moves a net 94 pins out of Europe and
   North America. That is about 1% of the catalog and does not change the map's shape.
2. **Inflation drives the hyper-concentrations.**
   - 4490 entries (63%) were imported from Spotify's Every Noise at Once taxonomy.
   - 2822 entries are market labels: a nationality or city tag on a genre practised
     everywhere ("Swiss house", "Aarhus indie", "Polish ambient").
   - 560 are not traditions at all ("8D", "432Hz", "Reiki", "Birthday", "Spa").
   - 1153 pins are arbitrary: a placeless category pinned to one member artist's or
     label's city.
   - All of these sit overwhelmingly in Europe and North America.
3. **The vacancies are real gaps.** After removing the inflation, Europe and North
   America still hold over half of the catalog's distinct traditions. Every region was
   measured the same way: 26 regions, including Western, Nordic and Southern Europe,
   Japan and Korea, and two controls. Each region's list of missing traditions was
   checked by a separate skeptic agent, and 1299 survived.
   - **Low gap rate:** the British Isles (0.07 missing per existing distinct entry),
     US roots (0.06) and Western Europe (0.13).
   - **High gap rate:** China (2.10), Maritime Southeast Asia (2.05), the rest of South
     Asia (1.77), Central Africa (1.73) and Mainland Southeast Asia (1.71).

Fix the attribution and taxonomy first. That work is cheap and mechanical, and it makes
the map honest. The larger job, and the one that changes the map's shape, is filling the
gaps from ethnomusicological sources. More streaming-taxonomy imports would add
inflation, not fill the gaps.

## Method

1. **Join.** Every entry was joined to its provenance (core hand-researched, geographic
   expansion, or Every Noise), its pin rationale, and a country found by testing its
   point against the `data/countries.geo.json` polygons.
2. **Classify.** 20 classifier agents labelled all 7078 entries on three axes:
   - **scope:** local origin, city scene, national label, diaspora, transnational, or
     not place-based;
   - **pin:** correct, representative, wrong place, arbitrary, or unsure;
   - **split:** distinct, market label, near-duplicate, or not a tradition.
3. **Calibrate.** A second agent re-labelled about 12 entries per chunk without seeing
   the first labels. Agreement was 90% on scope, 89% on pin and 77% on split.
4. **Verify wrong pins.** Every wrong-place claim (300) went to a verifier with web
   search, told to refute it: 270 confirmed, 29 refuted, 1 uncertain. Six of the 270
   turned out to be artifacts of the country lookup (Haifa read as Lebanon, El Paso as
   Mexico, and similar border cases), which leaves **264**.
5. **Check the other direction.** A stratified sample of 102 "arbitrary" pins and 50
   pins that coverage agents said belonged elsewhere were re-checked.
6. **Find gaps.** One coverage agent per region (26 regions: 24 plus the 2 controls)
   listed documented, recorded traditions absent from the catalog. A skeptic then
   checked each candidate for presence under other names, for distinctness and for
   existence. Of 1796 candidates, 1319 were kept: 1299 once the 20 found in two
   regions are counted once. 62 were already present, 301 were not distinct, 113 were
   unverifiable and 1 was not real.
7. **Critique.** A completeness critic reviewed the first round. Its holes (European and
   Japanese/Korean coverage, Jewish, Roma and diaspora traditions, reverse-direction
   pins, cross-region double counts) were closed in round 2.

## Findings

### 1. The map's bubbles merge countries

At world zoom the 1019 bubble over London is not Britain. The UK holds 563 pins; the
bubble also takes in Ireland (52), France (204) and the Low Countries (155).

By country the leaders are the United States (1509), United Kingdom (563), Brazil (324),
Germany (268), Japan (208), France (204), India (186), Spain (177), Canada (175), Italy
(173), Mexico (172) and Sweden (156).

### 2. Two sources, two skews

| Region | All | Share | Core (2588) | Every Noise (4490) |
| --- | ---: | ---: | ---: | ---: |
| Europe | 2697 | 38.1% | 31.4% | 42.0% |
| North America | 1687 | 23.8% | 24.0% | 23.7% |
| Latin America & Caribbean | 967 | 13.7% | 15.7% | 12.5% |
| East Asia | 382 | 5.4% | 5.8% | 5.2% |
| Africa | 374 | 5.3% | 7.4% | 4.1% |
| Southeast Asia | 261 | 3.7% | 3.2% | 4.0% |
| South Asia | 236 | 3.3% | 4.2% | 2.8% |
| Oceania & Pacific | 203 | 2.9% | 2.5% | 3.1% |
| Middle East | 192 | 2.7% | 3.7% | 2.1% |
| Caucasus & Central Asia | 49 | 0.7% | 1.2% | 0.4% |
| Mongolia & Siberia | 30 | 0.4% | 0.9% | 0.2% |

The core catalog was already 55% Europe plus North America. The Every Noise import
pushed Europe from 31% to 42%.

### 3. What the entries are

| Label | Core (2588) | Every Noise (4490) |
| --- | ---: | ---: |
| distinct tradition | 1917 (74%) | 597 (13%) |
| market label | 96 (4%) | 2822 (63%) |
| near-duplicate | 477 (18%) | 511 (11%) |
| not a tradition | 98 (4%) | 560 (12%) |
| pin correct or representative | 2417 (93%) | 3173 (71%) |
| pin arbitrary | 107 (4%) | 1046 (23%) |
| pin wrong place | 43 (2%) | 257 (6%) |

Of Europe's 1884 Every Noise entries, 227 are distinct traditions and 1221 are market
labels. Most Every Noise pin rationales name a label, a venue, a recording location or
one member's base. Only about 200 of the 4490 name a documented origin.

### 4. Wrong pins

235 of the 264 confirmed wrong pins come from Every Noise, mostly national labels
pinned where one sample artist lives or once performed:

- "Indian classical" in Fairfax, Virginia
- "Italian opera" in London
- "Ethiopian pop" in Krems, Austria
- "Algerian folk" in Paris
- "Somali pop" in Neukölln, Berlin
- "Sudanese pop" in Washington
- "Liberian pop" in Knoxville
- "Chinese classical" in Amsterdam
- "Korean traditional" in Washington

29 come from the core. Examples: "Vispop" (Visayan pop, Cebu) pinned in Stockholm, and
"Frafra" (Bolgatanga) pinned in Kumasi.

The moves run mostly out of Europe and North America. Net change by region:

| Region | Net change |
| --- | ---: |
| North America | −51 |
| Europe | −43 |
| Latin America & Caribbean | +25 |
| Africa | +19 |
| East Asia | +18 |
| South Asia | +16 |
| Middle East | +13 |

The reverse-direction checks found:

- **Arbitrary pins (sample of 102):** 76 are genuinely placeless, 11 have a real origin
  elsewhere (e.g. "Karaoke" at Australia's centroid instead of Kobe, "Old school EBM" in
  Gothenburg instead of Brussels), 9 were fine and 6 were unresolved. Extrapolated,
  roughly 125 of the 1153 arbitrary pins are wrong pins in disguise.
- **Pins that coverage agents said belonged elsewhere (50):** 46 were fine. 4 were wrong,
  e.g. "Afro-soul" in Lagos instead of Johannesburg, and "Juǀ'hoansi healing" coded
  Botswana instead of Namibia.

`entries.csv` lists every confirmed and reverse-checked pin with the verifier's place and
evidence.

### 5. What the map would show after cleanup

| Region | Now | Pins fixed, arbitrary removed | Market labels and non-traditions also removed | Distinct only |
| --- | ---: | ---: | ---: | ---: |
| Europe | 38.1% | 38.4% | 33.9% | 34.3% |
| North America | 23.8% | 18.1% | 20.9% | 19.3% |
| Latin America & Caribbean | 13.7% | 15.7% | 14.8% | 14.6% |
| Africa | 5.3% | 6.3% | 8.6% | 9.7% |
| East Asia | 5.4% | 6.2% | 6.3% | 5.9% |
| South Asia | 3.3% | 4.1% | 5.2% | 5.5% |
| Entries left | 7078 | 5925 | 3125 | 2348 |

Cleanup roughly doubles Africa's share, but Europe plus North America stays above half.
What remains is a coverage problem.

### 6. Verified gaps by region, measured the same way everywhere

How to read the table:

- **Distinct:** the non-arbitrary distinct entries pinned in the region's countries.
- **Verified missing:** candidates that survived the skeptic, with cross-region
  duplicates removed.
- **Missing per distinct:** verified missing divided by distinct; this is the comparable
  rate.
- **Agent estimate:** the coverage agent's own guess at the total gap, including
  traditions it did not list. It has no stated method; treat it as indicative only.

| Region | Pinned | Distinct | Verified missing | Missing per distinct | Agent estimate |
| --- | ---: | ---: | ---: | ---: | ---: |
| China, HK, Macao, Taiwan | 114 | 48 | 101 | **2.10** | 250–550 |
| Maritime Southeast Asia | 179 | 56 | 115 | **2.05** | 190–300 |
| Pakistan, Bangladesh, Nepal, Sri Lanka, Bhutan, Maldives | 47 | 26 | 46 | **1.77** | 80–105 |
| Central Africa and Angola | 40 | 26 | 45 | **1.73** | 100–170 |
| Mainland Southeast Asia | 83 | 34 | 58 | **1.71** | 85–140 |
| Indigenous North America (33 Indigenous entries) | — | 33 | 40 | ~1.2 | 90–150 |
| Russia's peoples, Mongolia, Siberia, Arctic | 138 | 47 | 62 | **1.32** | 120–170 |
| East Africa and the Horn | 60 | 40 | 52 | **1.30** | 95–160 |
| Andes, Amazonia, Central America, Guianas | 128 | 43 | 55 | **1.28** | 120–200 |
| West Africa | 114 | 72 | 67 | 0.93 | 140–230 |
| North Africa, Arab Mashriq and Peninsula | 108 | 53 | 49 | 0.92 | 95–135 |
| Anatolia, Iran, Afghanistan, Caucasus, Central Asia | 139 | 54 | 44 | 0.81 | 95–145 |
| Southern Africa and SW Indian Ocean | 117 | 66 | 51 | 0.77 | 85–140 |
| India | 186 | 97 | 71 | 0.73 | 130–190 |
| Oceania | 189 | 62 | 43 | 0.69 | 100–180 |
| Caribbean, Mexico, Colombia, Venezuela | 373 | 157 | 86 | 0.55 | 140–185 |
| Japan and Korea (North Korea has 0 entries) | 267 | 87 | 41 | 0.47 | 120–160 |
| Southern Europe (Iberia, Italy, Malta) | 398 | 123 | 52 | 0.42 | 85–115 |
| Brazil and the Southern Cone | 477 | 143 | 57 | 0.40 | 110–180 |
| SE and Eastern Europe | 442 | 124 | 37 | 0.30 | 85–140 |
| Nordic countries | 414 | 84 | 22 | 0.26 | 46–70 |
| Western and Central Europe | 740 | 215 | 29 | 0.13 | 75–130 |
| **Control: British Isles** | 619 | 229 | 16 | **0.07** | 30–50 |
| **Control: US roots** | 1511 | 435 | 28 | **0.06** | 70–130 |

Two cross-cutting sweeps found more missing traditions that the regional sweeps did not:
16 Jewish and Roma traditions, and 16 from settler Canada, Australia and New Zealand or
from diaspora communities. Their rates are not comparable, so they are left out of the
table.

**Totals:** 1299 unique verified missing traditions.

**What kind they are:**

- folk or regional: 36%
- sacred or ritual: 22%
- Indigenous or minority: 18%
- historic popular: 11%
- art or classical: 7%
- contemporary popular or urban scene: 6%

A streaming-listenership taxonomy cannot supply these.

## Recommended course of action

1. **Re-pin the 264 confirmed misattributions.** Done on 2026-10-07; see below. Next,
   review the other 1153 arbitrary pins: about 11% have a real origin elsewhere. Done on
   2026-10-08: the full review found 43, about 4%; see below.
2. **Stop pinning placeless entries.** Arbitrary pins, including the 560 non-traditions
   such as 8D, 432Hz, Reiki and Birthday, belong in a "no fixed origin" group, not at a
   member's hometown.
3. **Collapse or demote the 2822 market labels.** Keep them searchable as aliases or tags
   of their parent genre, or as a layer that is off by default.
4. **Do a duplicate pass before merging anything.** Near-duplicates are under-counted:
   blind re-labels flagged them about twice as often as the first pass. The current
   duplicate graph also has 23 mutual pairs and 91 chains to untangle. Done on
   2026-10-08: the duplicate pass mapped the merges, and 649 duplicates were then
   merged, each keeping its id as an alias. See
   [Duplicate pass](#duplicate-pass-2026-10-08) and
   [Applied: duplicate merge](#applied-duplicate-merge-2026-10-08).
5. **Fill gaps in rate order:** China, Maritime and Mainland Southeast Asia, the rest of
   South Asia, Central and East Africa, Siberia and Russia's peoples, the Andes and
   Amazonia, and Indigenous North America. Start from the verified candidates in
   `gaps.csv`. Source from UNESCO ICH lists, archival labels and regional
   ethnomusicology, not streaming taxonomies. North Korea has no entries at all. Done:
   batch 1 (China, Maritime and Mainland Southeast Asia, the rest of South Asia,
   Central Africa) added 360 traditions and batch 2 (every other region) added 922; see <!-- check_docs:ignore -->
   [`geographic-gap-fill.md`](geographic-gap-fill.md).
6. **Gate future imports on scope.** A nationality × global-genre slice should not get its
   own map pin.

## Applied: re-pins (2026-10-07)

Before `data/geo.json` changed, each of the 264 confirmed moves was reviewed again by
an independent agent. It checked the target against this atlas's conventions in
`scripts/_atlas_regions.js`: cultural centres rather than centroids, labels that name
only the place, and the contested region rulings. Any disagreement went to a third
agent.

- **259 applied** as the audit proposed.
- **4 adjusted** to a better place:
  - Central African music goes to Bangui, not Mbaïki: it is a national label, so its
    main scene city.
  - Ukrainian experimental goes to Kyiv, not Lviv.
  - Balochi pop goes to Karachi's Lyari studio scene, not Quetta.
  - Palestinian alternative goes to Haifa, the exemplar's base and a named scene hub,
    not Ramallah.
- **1 held:** `deboxe`. Web sources tie the Deboxe brand to Goiânia's car-sound
  culture, so its pin is right. The record's Rio Grande do Sul lineage is the error,
  and it should be corrected in the record. (Corrected on 2026-10-08. Further sources
  place Deboxe's original shop and sound-car crew in Taguatinga, Brasília, with a second
  shop in Goiânia, so the pin moved to Brasília and the lineage and description now name
  Brasília and Goiás.)
- **Coordinates:**
  - 234 moves reuse the coordinate the atlas already uses for that city.
  - 28 use coordinates looked up from web sources.
  - 1 (Bangui) uses the tie-break reviewer's coordinate.
  - Every new coordinate was tested against the country polygons in
    `data/countries.geo.json` before it was written.

**Net change by sidebar region:**

| Region | Net change |
| --- | ---: |
| North America | −53 |
| Europe | −48 |
| Latin America & Caribbean | +29 |
| Africa | +21 |
| East Asia | +17 |
| South Asia | +16 |
| Middle East | +13 |

**Checks.** `data/atlas-geo.json` was regenerated. `npm run check:atlas`,
`npm run test:geography`, `npm run test:everynoise`, `npm run validate` and the doc
gates pass.

**Records.** The full ledger, with old and new coordinates, label, region, distance
moved, coordinate source, evidence URL and reason, is
[`geographic-attribution-audit/repins.csv`](geographic-attribution-audit/repins.csv).
The `data/geo-meta.json` note records that 28 of the moved ids are on its 2026-09-09
model-reviewed list.

## Applied: arbitrary-pin review (2026-10-08)

The audit labelled 1153 pins arbitrary: the entry sits where one member artist, label
or venue happens to be. The review covered all of them, plus 4 pins that the reverse
checks had flagged as wrongly placed. Most of these entries come from Every Noise.

**Method.**

1. **Classify.** Agents classified each entry, using its record and up to 10 web
   searches per batch of about 48. The verdicts were:
   - **pin ok:** already at its documented origin or centre;
   - **wrong place:** one documented origin, and the pin is not there;
   - **placeless:** no geographic identity;
   - **multi-origin:** sources credit two or more places about equally;
   - **uncertain.**

   A prominent act's home did not count as an origin unless sources credit that scene
   with starting the style. The classifiers skipped the last item of each batch; those
   23 entries were classified by hand.
2. **Review.** Before `data/geo.json` changed, an independent reviewer checked every
   proposed move against the atlas conventions in `scripts/_atlas_regions.js`, and
   disputes went to a tie-break.

| Verdict | Entries |
| --- | ---: |
| placeless | 893 |
| multi-origin | 165 |
| wrong place | 44 |
| pin ok | 42 |
| uncertain | 13 |

Of the 44 proposed moves:

- **42 applied.**
- **1 adjusted:** B-boy music goes to the Bronx, not New York.
- **1 held:** deep drum and bass is a market strand with no documented single origin.

Examples:

| Entry | Was pinned at | Moved to |
| --- | --- | --- |
| Karaoke | Australia's centroid | Kobe |
| Opera | Warrensburg, Missouri | Florence |
| Popping | Las Vegas | Fresno |
| Prepared piano | Rome | Seattle (Cage, 1940) |
| Goregrind | Minneapolis | Liverpool |
| Handpan | Krefeld | Bern (PANArt) |
| Afro-soul | Lagos | Johannesburg |
| Christian afrobeat | London | Lagos |

**What it found.**

- **The rate.** 43 moves is 3.7%, a third of the 11% the 102-item sample suggested.
  - The fuller pass was stricter about what counts as a single origin.
  - Of the 15 moves the earlier reverse checks proposed, it confirmed 5. It called
    old-school EBM, trancecore and Arab experimental multi-origin, and assyrian pop
    diaspora-defined.
- **The direction.** Unlike the first re-pin, these moves run mostly *into* North
  America and Europe. They are genres that began there but were pinned at a member's
  home abroad: surf in Leicester, rockabilly in Adelaide, boom bap in Ho Chi Minh City.
  - 23 of the 43 change sidebar region.
  - Net change: North America +6, Europe +2, Oceania & Pacific −5, Southeast Asia −2,
    Latin America & Caribbean −1.
- **No single place.** 1058 entries (893 placeless, 165 multi-origin) have no single
  right place. They are the entries recommendation 2 would move into a "no fixed
  origin" group. Their pins were left as they are.

**Checks.** `data/atlas-geo.json` was regenerated, and the atlas, geography and doc gates
pass.

**Records.** Every reviewed entry is in
[`geographic-attribution-audit/arbitrary-pins.csv`](geographic-attribution-audit/arbitrary-pins.csv).
Each row gives the classifier's verdict, place, evidence and reason, the review and
tie-break, and the old and new coordinates. The `deboxe` correction is its last row.

## Duplicate pass (2026-10-08)

This pass changed no catalog data. It turns the audit's near-duplicate flags into a
verified duplicate map, so that any merge can be decided from evidence.

**What was checked.** 1267 pairs:

- the 988 entries the audit flagged as near-duplicates, each paired with its target;
- 279 pairs found by name similarity, where neither side is a market label or
  non-tradition.

**How.**

1. A judge agent read both records and labelled each pair:
   - **same:** one tradition under two names;
   - **slice:** an era, market, mood or "deep/classic" slice with no documented
     difference in sound or practice;
   - **variant:** a documented sub-style worth keeping;
   - **distinct.**
2. A skeptic tried to refute every "same" and "slice" verdict. It overturned 95 of
   804, by naming a concrete difference.

| Final verdict | Audit flags | Name similarity |
| --- | ---: | ---: |
| same | 336 | 3 |
| slice | 348 | 22 |
| variant | 284 | 115 |
| distinct | 17 | 139 |
| unsure | 3 | 0 |

**What it found.**

- **The audit's flags hold up.** 69% of them are real merge candidates, and only 2%
  are wrong.
- **Missed duplicates are rare.** Among the remaining distinct entries, name
  similarity found only 25 more merge candidates.
- **Duplication is not only an Every Noise problem.** 250 "same" pairs join two core
  records, such as `chaabi_algerien` and `algerian_chaabi`.
- **No gap-fill entry is on either side** of a merge candidate.

**The merge map.** The 709 confirmed same or slice pairs form 529 clusters.

- Each cluster has one surviving entry: the one every "keep" verdict points to.
- 11 clusters had conflicting keeps, from mutual pairs or chains. There the
  hand-researched, least-pointed-at entry was chosen.
- Folding would retire **681 entries**: 371 from Every Noise and 310 from the core.
- Most clusters are pairs. The largest have six members:
  - alternative R&B: `alt_rnb`, `neo_r_and_b`, `indie_r_and_b`, `deep_r_and_b` and
    others;
  - Americana: `alt_country_americana`, `new_americana`, `roots_americana` and others.

**Not decided here.** How a fold should work. The owner chose to keep each retired id
as an alias, and the merge followed the same day; see below.

**Records.**

- [`geographic-attribution-audit/duplicates.csv`](geographic-attribution-audit/duplicates.csv)
  gives each pair's judge and skeptic verdicts, reasons and the id to keep.
- [`geographic-attribution-audit/duplicate-clusters.csv`](geographic-attribution-audit/duplicate-clusters.csv)
  gives each clustered id and its surviving entry.

## Applied: duplicate merge (2026-10-08)

The owner chose to merge the duplicates and keep every retired id as an alias.
649 traditions were retired into 512 survivors:

- 316 "same" merges: one tradition under two names;
- 333 "slice" merges: an era, market or mood slice with no documented difference.

The catalog went from 8362 to 7713 traditions. Merged with `main`'s 43 reviewed genres, <!-- check_docs:ignore -->
it is 7755: one of them, `pop_minang`, was also a gap-fill entry, and the gap-fill <!-- check_docs:ignore -->
record was kept.

**What was held back.** The duplicate map was applied with two exceptions, both
decisions the repository had already recorded:

- **18 pairs** that `scripts/_duplicate_rulings.json` had ruled distinct, such as
  `southern_trap` / `trap` and `k_pop_modern` / `kpop`.
- **15 pairs** whose survivor would have been one of the 22 umbrella records (`trap`,
  `country`, `kpop`, `metal` and the rest). The engine deliberately keeps those out of
  similarity scoring, and the changelog records the decision not to merge specific
  genres into them.

The remaining edges were re-clustered.

**Which record survives.**

- **Slice:** the broader entry survives.
- **Same:** the better-documented record survives. That is the one with more of its
  recording chain, parts, exemplars and prose authored.
  - In 138 clusters this differs from the duplicate pass's "keep". For example,
    `bakersfield` (12 chain fields, two effects) survives over `bakersfield_sound`
    (7, none).
  - Otherwise a hand-researched chain, such as `surf_rock`'s spring reverb and
    tremolo, would have been lost behind an alias.
- **Survivors are unchanged.** No surviving record was edited.

**What an alias does.** `references/_tradition_aliases.json` maps each retired id to
`{of, name, verdict}`. Every surface resolves it before anything else:

- **CLI:** `recipe.js` and the other CLIs; it says so on stderr.
- **Engine:** seeding and search.
- **Connector:** `start_recipe`, `add_tradition`, `remove_tradition` and
  `get_tradition`. The last answers with the survivor and `merged_from`. Naming an
  alias and its survivor together is refused as a repeat.
- **Saved workspaces:** cards carrying a retired id, in the connector and in the app,
  are rewritten to the survivor.
- **Browser app:** import, search (an old name ranks as a name match) and `?trad=` links.
- **Atlas:** `?trad=` links.
- **Static API:**
  - `api/traditions/<alias>.json` is the survivor's record plus `merged_from`, so
    old links still return a recipe;
  - `traditions/index.json`, `all.json`, `browse.json` and `index.json` carry the alias
    map;
  - `scripts/check_aliases.js` and `scripts/check_api.js` gate all of it.

**What else moved with the retired records.**

- **Removed:** their pins, signatures and signature rulings, image-manifest entries,
  geo-meta review entries and voice-part overrides.
- **Repointed:** atlas routes and threads, deduplicated.
- **Carried over:** the 5 distinct rulings that named a retired id now name the
  surviving pair, so the duplicate gate keeps the decision.
- **Preface regression fixtures:** the 5 on retired ids were repointed to their
  survivors.
  - 2 were dropped because they duplicated a survivor's own fixture.
  - 1 expectation was re-recorded: `scottish_bothy_ballad`'s melodeon now draws
    "street-pulsing", one of the engine's known odd prefaces, where
    `bothy_ballad_doric`'s drew "hiraeth".

**Effect on surviving recipes.** The engine scores each tradition against its
neighbours, so removing 649 records changes how many survivors compile.

- **Survivors' own records:** none was edited.
- **Recipe text:** 876 of the 7713 changed. 536 of those name different related styles;
  the rest re-pick an automatic part variant against the new neighbourhood.
- **Variant picks only:** another 2714 change only internal picks that the recipe text
  does not show.
- **Instruments, rooms, tunings and chains:** none moved.
- **Archetypes:** two re-picked against the new neighbours.
  - `franco_country` moved to its authored `arch_early_tape_us_commercial`;
  - `western_music` moved from it to `arch_early_tape_havana`.
- **Regression fixtures:** 269 of the 1149 were re-recorded. 52 of them are keyed by a
  retired id and now record the survivor's recipe, so they double as regression cover
  for alias resolution.

Every changed recipe text is in
[`geographic-attribution-audit/merge-recipe-changes.csv`](geographic-attribution-audit/merge-recipe-changes.csv).

## Applied: no fixed origin (2026-10-08)

The arbitrary-pin review left 937 genres with no single right place (the 1,058 of the
review, less those the merge retired). They were sorted again, each by a classifier, and
a skeptic re-checked every place a classifier claimed (it changed 68 verdicts):

| Verdict | Genres | Done |
| --- | ---: | --- |
| Own origins: one to four documented places of its own | 99 | pinned at its first origin |
| Inherits its parent genre's origins | 229 | pinned at the parent's first origin |
| No origin at any number of places | 597 | no pin; listed in the map key |
| Unsure | 12 | left as they were |

**Placed genres.** The owner chose one pin each rather than several. A pin already
within 60 km of a listed origin stayed (53); the rest moved to the first origin that
resolves to a place (275). Seven first origins named a band rather than a town, and were
pinned at the band's hometown, for example `melodic_black_metal` at Strömstad and
`post_black_metal` at Bagnols-sur-Cèze. Every origin is kept in the ledger, not only the
one pinned.

**Placeless genres.** 597 genres name a mood, a function, an instrument or format as
such, a technique, or a playlist tag with no documented scene, for example 432Hz,
Acoustic cover and Jazz trombone. They are listed in
[`data/no-fixed-origin.json`](../data/no-fixed-origin.json).
`scripts/build_atlas_geo.js` leaves them out of the drawn pins and writes the list into
`data/atlas-geo.json`. The atlas shows a "No fixed origin" row in its map key, and an
entry in Map information, and both open the list; each genre links into Codex Musica.
Their `data/geo.json` coordinates are kept, unused, so the list can be undone by
deleting an id.

**Effect on the map.** 7,158 traditions are drawn, on 3,512 coordinates. No recipe <!-- check_docs:ignore -->
changed: pins and the list feed only the atlas.

The ledger is
[`geographic-attribution-audit/no-fixed-origin.csv`](geographic-attribution-audit/no-fixed-origin.csv):
one row per genre with its verdict, parents, origins, the reason, whether the skeptic
upheld it, what was done, and the old and new pin.

## Limits

- **The labels are model judgements**, not a person checking a map. See the calibration
  rates above. "Near-duplicate" is the least reliable label, and it is under-applied, so
  the "distinct" counts are upper bounds everywhere.
- **The gap lists are verified for absence more firmly than for existence.**
  - Every kept candidate was grepped against the catalog. An independent re-check of 119
    kept items found none already present, and kept 113.
  - Existence checks used live web search only part of the time: a shared search quota
    ran out and the proxy blocked page fetches. So many existence verdicts rest on model
    knowledge plus the cited source.
  - To measure what that costs, a stratified sample of 52 kept items (two per region) was
    then web-searched. 48 were confirmed with recording evidence: Ocora, Smithsonian
    Folkways, CREM-CNRS, ILAM, PARADISEC, Library of Congress and UNESCO sources. 3 are
    documented but showed no recording evidence. 1 was not found (Dani/Lani highland
    vocal music, probably a search miss). About 7 of the 52 look like local variants of a
    broader genre, so expect roughly 10–15% of the list to merge into existing or sibling
    entries.
  - Most source URLs in the lists are Wikipedia.
- **Agent estimates beyond the verified lists have no stated method.** Use the verified
  counts and the per-distinct rates.
- **The country lookup uses Natural Earth borders.** A few border pins land in the
  neighbouring country (corrected for the six confirmed cases), and Jerusalem falls
  inside the Palestine polygon.
- **Pins are representative locations, not territorial claims**, as stated in
  `data/geo-meta.json`.

## Files

- [`geographic-attribution-audit/entries.csv`](geographic-attribution-audit/entries.csv):
  one row per tradition. Columns: provenance, region, country, pin, scope, pin verdict,
  suggested place, split verdict, duplicate target, and the verifier's verdict, place and
  evidence URL. It also carries the reverse-direction check where one was run.
- [`geographic-attribution-audit/gaps.csv`](geographic-attribution-audit/gaps.csv): 1796
  missing-tradition candidates in 26 regions. Columns: place, kind, recording evidence,
  source URL, the skeptic's verdict, a cross-region duplicate flag, the independent
  re-check where one was run, and the web-search spot check where one was run.
- [`geographic-attribution-audit/pinned_elsewhere.csv`](geographic-attribution-audit/pinned_elsewhere.csv):
  entries about one region pinned in another, as reported by the coverage agents. Of 50
  that conflicted with an accepted pin, 46 re-checked as fine.
- [`geographic-attribution-audit/repins.csv`](geographic-attribution-audit/repins.csv):
  the 2026-10-07 re-pin ledger, one row per confirmed wrong pin.
- [`geographic-attribution-audit/arbitrary-pins.csv`](geographic-attribution-audit/arbitrary-pins.csv):
  the 2026-10-08 arbitrary-pin review, one row per reviewed entry, with its verdict,
  review, decision and any new coordinate.
- [`geographic-attribution-audit/duplicates.csv`](geographic-attribution-audit/duplicates.csv)
  and [`duplicate-clusters.csv`](geographic-attribution-audit/duplicate-clusters.csv): the
  2026-10-08 duplicate pass, pair verdicts and the proposed merge map. The map actually
  applied, after the held-back pairs and survivor swaps, is
  [`references/_tradition_aliases.json`](../references/_tradition_aliases.json).
- [`geographic-attribution-audit/merge-recipe-changes.csv`](geographic-attribution-audit/merge-recipe-changes.csv):
  every surviving tradition whose static recipe text changed with the merge, before and
  after.
- [`geographic-attribution-audit/no-fixed-origin.csv`](geographic-attribution-audit/no-fixed-origin.csv):
  the 2026-10-08 no-fixed-origin pass, one row per genre with its origins, decision and
  pin.
