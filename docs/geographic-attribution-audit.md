# Geographic attribution audit

Date: 2026-10-06. Baseline: the 7078-tradition catalog and `data/geo.json` at the
head of `main` on that date. Per-entry evidence is in
[`geographic-attribution-audit/`](geographic-attribution-audit/).

## The question

The atlas looks lopsided: Europe holds 2697 pins and North America 1687, against
374 for Africa, 236 for South Asia and 49 for the Caucasus and Central Asia. Does
that come from **misattributed pins** (fix the data), from **source bias**
(go find more traditions), or from both?

## Short answer

Both, but they are different problems with different sizes.

1. **Wrong pins are real but small.** 270 pins were confirmed to be in the wrong
   place, 209 of them in the wrong country. Moving them shifts about 94 pins out of
   Europe and North America. That is under 2% of the catalog and does not change
   the shape of the map.
2. **Inflation drives the hyper-concentrations.** 4490 entries (63%) were
   imported from Spotify's Every Noise at Once taxonomy. 2822 of all entries are
   market labels: a nationality or city tag on a genre practised everywhere, such
   as "Swiss house", "Aarhus indie" or "Polish ambient". Another 560 are not
   traditions at all ("8D", "432Hz", "Reiki", "Birthday", "Spa"). 1153 pins are
   arbitrary: a placeless category pinned to one member artist's or label's city.
   These sit overwhelmingly in Europe and North America.
3. **The vacancies are real gaps.** After removing the inflation, Europe and
   North America still hold 54% of the catalog's distinct traditions. Skeptic
   agents verified 1088 documented, recorded traditions that are absent, in 18
   under-covered regions. The two control regions (British Isles, US roots) yield
   0.07 and 0.06 verified gaps per existing distinct entry; China yields 2.1,
   Maritime Southeast Asia 2.05 and Central Africa 1.73. That is 10–30× the control
   rate.

Fix attribution and taxonomy first; that is cheap, mechanical and makes the map
honest. The larger job, the one that changes the map's shape, is filling the gaps
from ethnomusicological sources. More streaming-taxonomy imports would add more
inflation, not fill the gaps.

## Method

- Every entry was joined to its provenance (core hand-researched, geographic
  expansions, or Every Noise), its pin rationale, and a country by
  point-in-polygon against `data/countries.geo.json`.
- 20 classifier agents labelled all 7078 entries for three things:
  - **scope:** local origin, city scene, national label, diaspora, transnational,
    or not place-based;
  - **pin:** correct, representative, wrong place, arbitrary, or unsure;
  - **split:** distinct, market label, near-duplicate, or not a tradition.
- A separate skeptic agent re-labelled about 12 entries per chunk blind. Agreement
  was 90% for scope, 89% for pin and 77% for split. Most split disagreements are
  between distinct and near-duplicate, so treat "near-duplicate" as soft.
- Every wrong-place claim (300) went to an adversarial verifier with web search,
  told to refute it. 270 were confirmed, 29 refuted and 1 left uncertain.
- 20 coverage agents listed documented, recorded traditions absent from the
  catalog, one per region. Two of the regions were controls (British Isles, US
  roots). Each list went to a skeptic who checked for presence under other names,
  for distinctness, and for existence. Of 1492 candidates, 1132 were kept, 46
  were already present, 209 were not distinct, 104 were unverifiable and 1 was not
  real.

## Findings

### 1. The map's bubbles merge countries

The 1019 bubble over London at world zoom is not Britain. The UK holds 563 pins.
The bubble also takes in Ireland (52), France (204) and the Low Countries (155).
By country the leaders are: United States 1509, United Kingdom 563, Brazil 324,
Germany 268, Japan 208, France 204, India 186, Spain 177, Canada 175, Italy 173,
Mexico 172 and Sweden 156.

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

The core catalog was already 55% Europe plus North America. The Every Noise
import pushed Europe from 31% to 42%.

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

Of Europe's 1884 Every Noise entries, 227 are distinct traditions and 1221 are
market labels. Most Every Noise pin rationales name a label, venue or recording
location, or one member's base. Only about 200 of 4490 name a documented origin.

### 4. Confirmed wrong pins (270)

Most confirmed wrong pins are Every Noise national labels pinned where one sample
artist lives or once performed:

- "Indian classical" is in Fairfax, Virginia.
- "Italian opera" is in London.
- "Ethiopian pop" is in Krems, Austria.
- "Algerian folk" is in Paris.
- "Somali pop" is in Neukölln, Berlin.
- "Sudanese pop" is in Washington.
- "Liberian pop" is in Knoxville.
- "Chinese classical" is in Amsterdam.
- "Korean traditional" is in Washington.

Core examples include "Vispop" (Visayan pop, Cebu), which is pinned in Stockholm,
and "Frafra" (Bolgatanga), which is pinned in Kumasi. The direction is mostly
outward from the Global South: the net move is −51 for North America and −43 for
Europe, and +25 Latin America, +19 Africa, +18 East Asia, +16 South Asia and +13
Middle East. The full list is in `entries.csv` (`pin_check = confirmed`, with the
verifier's place and evidence URL).

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

Cleanup roughly doubles Africa's share, but Europe plus North America stays above
half. The remaining skew is coverage.

### 6. Verified gaps by region

"Distinct" counts non-arbitrary distinct entries pinned in the region's countries.
"Keep" is the number of missing traditions that survived the skeptic. "Estimate"
is the coverage agent's estimate of all documented gaps, including those not
listed.

| Region | Pinned | Distinct | Verified missing | Estimate | Missing per distinct |
| --- | ---: | ---: | ---: | ---: | ---: |
| China, HK, Macao, Taiwan | 114 | 48 | 101 | 250–550 | 2.10 |
| Maritime Southeast Asia | 179 | 56 | 115 | 190–300 | 2.05 |
| Pakistan, Bangladesh, Nepal, Sri Lanka, Bhutan, Maldives | 47 | 26 | 46 | 80–105 | 1.77 |
| Central Africa and Angola | 40 | 26 | 45 | 100–170 | 1.73 |
| Mainland Southeast Asia | 83 | 34 | 58 | 85–140 | 1.71 |
| Indigenous North America (33 Indigenous entries) | 33 | — | 46 | 90–150 | ~1.4 |
| Russia's peoples, Mongolia, Siberia, Arctic | 138 | 47 | 62 | 120–170 | 1.32 |
| East Africa and the Horn | 60 | 40 | 52 | 95–160 | 1.30 |
| Andes, Amazonia, Central America, Guianas | 128 | 43 | 55 | 120–200 | 1.28 |
| West Africa | 114 | 72 | 67 | 140–230 | 0.93 |
| North Africa and Arab Mashriq/Peninsula | 109 | 53 | 49 | 95–135 | 0.92 |
| Anatolia, Iran, Afghanistan, Caucasus, Central Asia | 140 | 54 | 44 | 95–145 | 0.81 |
| Southern Africa and SW Indian Ocean | 117 | 66 | 51 | 85–140 | 0.77 |
| India | 186 | 97 | 71 | 130–190 | 0.73 |
| Oceania | 189 | 62 | 43 | 100–180 | 0.69 |
| Caribbean, Mexico, Colombia, Venezuela | 375 | 157 | 86 | 140–185 | 0.55 |
| Brazil and the Southern Cone | 477 | 143 | 57 | 110–180 | 0.40 |
| SE and Eastern Europe (traditional) | 442 | 124 | 40 | 85–140 | 0.32 |
| **Control: British Isles** | 619 | 229 | 16 | 30–50 | **0.07** |
| **Control: US roots** | 1509 | 435 | 28 | 70–130 | **0.06** |

Across the 18 non-control regions, 1088 missing traditions are verified, against
an estimated 2110–3470. Of all 1132 kept candidates, 37% are folk or regional, 22%
sacred or ritual, 19% Indigenous or minority, 10% historic popular and 6%
art/classical. Only 5% are contemporary popular or urban scenes. A
streaming-listenership taxonomy cannot supply these.

## Recommended course of action

1. **Re-pin the 270 confirmed misattributions.** `entries.csv` gives each one's
   place and evidence.
2. **Stop pinning placeless entries.** The 1153 arbitrary pins (including the 560
   non-traditions such as 8D, 432Hz, Reiki and Birthday) should go into a "no fixed
   origin" group, not a member's hometown.
3. **Collapse or demote the 2822 market labels.** Keep them searchable as aliases
   or tags of their parent genre, or as a layer that is off by default.
   Reconsider near-duplicates case by case; that label is the noisiest.
4. **Fill gaps in ratio order** (China, Maritime and Mainland Southeast Asia, the
   rest of South Asia, Central and East Africa, Indigenous North America, Siberia,
   Andes). Start from the 1132 verified candidates in `gaps.csv`. Source from
   UNESCO ICH lists, archival labels and regional ethnomusicology, not streaming
   taxonomies.
5. **Gate future imports on scope.** A nationality × global-genre slice should
   not get its own map pin.

## Limits

- Labels are model judgements, not a person checking a map; see the calibration
  rates above. "Near-duplicate" is the least reliable label.
- Gap estimates beyond the verified lists are model estimates. Some skeptics
  could not reach web search and marked such items "unverifiable" rather than
  keeping them.
- The coverage sweep did not cover Western, Northern or Southern European
  traditional music outside the British Isles, or Japan and Korea. Those regions
  have no gap figures here.
- Pins are representative locations, not territorial claims, as stated in
  `data/geo-meta.json`. This audit does not change `data/geo.json`.

## Files

- [`geographic-attribution-audit/entries.csv`](geographic-attribution-audit/entries.csv):
  one row per tradition, with provenance, region, country, pin, scope, pin verdict,
  suggested place, split verdict, duplicate target, and the verifier's verdict,
  place and evidence URL.
- [`geographic-attribution-audit/gaps.csv`](geographic-attribution-audit/gaps.csv):
  1492 missing-tradition candidates with place, kind, recording evidence, source
  URL and the skeptic's verdict.
- [`geographic-attribution-audit/pinned_elsewhere.csv`](geographic-attribution-audit/pinned_elsewhere.csv):
  entries about one region pinned in another, as found by the coverage agents.
