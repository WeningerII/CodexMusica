# Geographic gap fill

This change adds traditions that the
[geographic attribution audit](geographic-attribution-audit.md) verified as documented,
recorded and missing from the catalog. Candidates come from the audit's checked gap list,
[`geographic-attribution-audit/gaps.csv`](geographic-attribution-audit/gaps.csv), and are
worked through region by region, worst-covered regions first. The machine-readable ledger
is [`geographic-gap-fill.json`](geographic-gap-fill.json). It has one row per added
tradition, giving its gap-list candidate, map anchor, sources and exemplars, plus every
candidate that was skipped or merged and why. `scripts/check_gap_fill.js` (run by
`npm run test:geography`) checks every ledger row against the catalog.

## Batch 1 — the five worst-covered regions

360 traditions from 361 candidates. Two candidates were merged into a sibling entry: <!-- check_docs:ignore -->
Tchamassi into Bend-skin, and Lam mahaxay into Lam khon savan. One was dropped because its
instrumentation could not be verified (Bulauê, São Tomé). Two candidates that each named
two distinct ensembles were split into two entries: Chaozhou xianshi strings and Chaozhou
daluogu gongs and drums, and Kadazandusun gong music and the sompoton.

| Gap-list region | Added |
| --- | ---: |
| Maritime Southeast Asia | 115 |
| China, Hong Kong, Macao and Taiwan | 102 |
| Mainland Southeast Asia | 57 |
| Pakistan, Bangladesh, Nepal, Sri Lanka, Bhutan and Maldives | 45 |
| Central Africa and Angola | 41 |

By country: China 85, Indonesia 75, Vietnam 21, Malaysia 19, Philippines 19, Taiwan 15,
Nepal 15, Thailand 15, Sri Lanka 13, Cameroon 12, Dem. Rep. Congo 10, Pakistan 8,
Bangladesh 8, Laos 8, Myanmar 7, Angola 6, Cambodia 6, and 18 more across nine other
countries.

What batch 1 covers:

- **China:** regional opera and narrative-song forms, silk-and-bamboo and
  wind-and-percussion ensembles, Daoist, Buddhist and Confucian ritual music, and the
  musics of minority peoples.
- **Maritime Southeast Asia:** Javanese, Sundanese and Balinese gamelan genres, Malay
  court and theatre music, Philippine regional forms, and the musics of Borneo and
  Papua.
- **Mainland Southeast Asia:** the Lao and Isan lam family, Vietnamese ritual and
  chamber forms, Khmer, Burmese and highland traditions.
- **South Asia:** Sufi, Baul and devotional song in Pakistan and Bangladesh, Nepali
  bardic and ethnic genres, and Sri Lankan drumming and drama music.
- **Central Africa and Angola:** Cameroonian urban and court forms, Congolese regional
  guitar and drum musics, Chadian and Central African traditions, and Angolan and
  São Toméan dance musics.

## Batch 2 — the remaining 21 regions

922 traditions. Batch 2 covers every other region of the gap list: <!-- check_docs:ignore -->

- the 13 remaining first-round regional sweeps;
- the four round-2 regions: Western, Nordic and Southern Europe, and Japan and Korea;
- the two control regions;
- the two cross-cutting sweeps, Jewish/Roma and settler/diaspora. One candidate,
Irish Traveller and English Romany song, was split into two entries.

Nine candidates were not added:

- **Duplicates.** Four were already covered, or were the same tradition listed in two
  regions: Kalmyk Jangar is covered by the Jangar epic entry, and Vlach Roma song,
  Bukharan sozanda and the Australian bush band each appeared twice.
- **Too little documentation.** Three could not be described from documented facts:
  Maale ritual songs, Afar music, and ichigenkin and yakumo-goto zither song.
- **No map pin.** Two islands are missing from the basemap's country polygons, so they
  could not be pinned: Rodriguan accordion dances and San Andrés and Providencia Raizal
  music. They need the basemap's island supplement extended, as was done for Onotoa.

| Gap-list region | Added |
| --- | ---: |
| Caribbean, Mexico, Colombia and Venezuela | 85 |
| India | 71 |
| West Africa | 67 |
| Russia's peoples, Mongolia, Siberia and the Arctic | 61 |
| Brazil and the Southern Cone | 57 |
| Andes, Amazonia, Central America and the Guianas | 55 |
| Southern Europe (Iberia, Italy, Malta) | 52 |
| Southern Africa and the SW Indian Ocean | 50 |
| East Africa and the Horn | 49 |
| North Africa, the Arab Mashriq and the Peninsula | 48 |
| Anatolia, Iran, Afghanistan, the Caucasus and Central Asia | 44 |
| Oceania | 43 |
| Indigenous North America and the Arctic | 40 |
| Japan and Korea | 40 |
| SE and Eastern Europe (traditional) | 35 |
| Western and Central Europe (traditional) | 29 |
| Control: US roots | 27 |
| Nordic countries | 22 |
| Control: British Isles | 17 |
| Jewish and Roma traditions | 15 |
| Settler and diaspora traditions | 15 |

The new entries are pinned in 146 countries and territories. By atlas sidebar region:
Latin America & Caribbean 205, Europe 192, Africa 188, South Asia 77, North America 76,
Middle East 55, Oceania & Pacific 47, East Asia 40, Mongolia & Siberia 22, and Caucasus &
Central Asia 20.

The authoring and review method is the same as batch 1:

- 378 lineages name a stand-in card.
- 628 entries use the contemporary field model and 75 the archival field-tape model.
  219 copy a comparable studio entry's chain and are labelled as authored models.
- The wording sweep retuned the batch-2 entries whose automatic preface named an
  unrelated culture.

## How each entry was made and checked

1. **Author.** An agent wrote the entry from the gap-list candidate's recording evidence
   and source, using only existing instrument cards. When the documented instrument has
   no card, the closest card stands in, and the lineage names it (185 entries do this).
   Recording chains follow the catalog's existing conventions:
   - 300 use the contemporary field-recording model of earlier geographic expansions;
   - 27 use an archival field-tape model;
   - 33 copy the chain of a comparable studio entry and are labelled as authored
     models.
2. **Review.** A second agent checked every entry independently: facts and exemplars
   (anything unverifiable was generalised or removed), duplicates against the whole
   catalog, instruments, map pin, tree parent and axes. It also checked the rendered
   recipe in every format.
3. **Validate.** Every part setting is pinned to an explicit choice: a "source
   unspecified" variant unless something specific is documented. Signatures use only
   sound-words (no cultural tokens), and every entry compiles in all four formats within
   the 1000-character ceiling.
4. **Wording sweep.** A final pass rendered all 360 entries with their signatures in
   place. It retuned 22 entries whose automatically chosen preface named an unrelated
   culture, for example "sean-nos" or "inshad".

## Effect on existing recipes

The engine scores each tradition against its neighbours, and a tradition's compiled
recipe names its nearest related styles. So adding traditions moves some existing static
recipes even though no existing record was edited. After batch 1, 200 existing
traditions compile differently:

- **What did not change.** No instrument, room, tuning or signal chain moved.
- **What did change.**
  - 101 now name different related styles; in 52 of them the new neighbour is a batch-1
    entry.
  - 110 have a different automatically chosen part variant, picked against those
    neighbours. Variants a tradition pins never change.
- **Culture words.** A scan for unrelated culture words found that 28 of the changed
  recipes lost one, 11 gained one (through a new neighbour name) and 161 are neutral.
- **Regression fixtures.** 52 of the 1149 recipe regression fixtures changed this way and
  were re-recorded.

Every before/after pair is in
[`geographic-gap-fill/batch1-existing-recipe-changes.csv`](geographic-gap-fill/batch1-existing-recipe-changes.csv).

Batch 2 had the same effect at a larger scale. 659 existing traditions compile
differently; 108 of them are batch-1 entries.

- **What did not change.** Again no instrument, room, tuning or signal chain moved.
- **What did change.** 348 name different related styles, 232 of them because the new
  neighbour is a batch-2 entry. 376 have a different automatically chosen variant.
- **Culture words.** 77 changed recipes lost an unrelated culture word, 50 gained one,
  and 532 are neutral.
- **Regression fixtures.** 217 of the 1149 recipe regression fixtures were re-recorded.

The pairs are in
[`geographic-gap-fill/batch2-existing-recipe-changes.csv`](geographic-gap-fill/batch2-existing-recipe-changes.csv).

## Limits

- **Modeled, not measured.** Ensembles, recording chains and numeric axes are authored
  choices, not session data. Exemplars name documented recordings, performers or archive
  collections; no catalogue number was added that the candidate's evidence did not give.
- **Preface quirks inherited from the engine.** Preface labels are chosen by the engine
  and can read oddly ("street-pulsing", "futuristic"), as they do across the existing
  catalog.
  - Two entries recorded on 78-rpm shellac, Nurthi and Sarswela, show "sabi-patinated".
    The shellac chain draws that preface in 72 of the catalog's other 74 shellac-era
    traditions as well.
  - Some instrument variants carry their region's own vocabulary, such as a Jiangnan
    qudi or a Javanese rebab body.
- **Pins** are cultural or documentation centres, not territorial claims. Where an
  island is too small for the basemap, the pin sits at the nearest governing town and
  the lineage names the island (Lanyu at Taitung).
