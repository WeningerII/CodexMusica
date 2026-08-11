# Finnic type-index survival labels — fi, krl, et, izh/vot

Two continuous labels per poem, built from `hsci-r/filter-data` (SKVR + ERAB +
JR + Kalevala/Kanteletar, 294,367 records) with `rahvaluule/erab` as the source
of truth for the ERAB type table and for the orthography experiment.

Rebuild: `python3 build_finnic_variant_counts.py` (fetches everything itself).
Check: `python3 verify.py` — 24 assertions, all passing.
Numbers: `build_report.json`.

| label | meaning |
|---|---|
| `label_variant_count.<cell>.tsv` | how many OTHER poems attest this poem's song type |
| `label_parish_spread.<cell>.tsv` | how many DISTINCT PARISHES those other attestations come from |

`.dedup.tsv` variants keep one row per distinct text (see leak closure 2).

## Join key

`join_key` = `poem_id`, the `hsci-r/filter-data` `poems.csv` identifier
(`join_key_name` = `filter_poem_id`). It is an id-to-id join inside one
harmonised release, so it is exact and lossless: it resolves for 141,706 of
141,706 rows, and 99.85% also join to verse text in `verses.csv` (210 rows are
metadata-only records with no `<V>` lines).

Two extra join columns are carried so these tables can also be joined to corpora
that have no FILTER ids (`sks190/SKVR` XML, `drshnkv/est-runocorp-morph`):
`text_key_norm` and `text_key_exact`, sha1-16 of the normalised and raw body.
Use `text_key_norm`. The section below is why.

## Pool and positives

| | rows |
|---|---|
| FILTER release | 294,367 |
| minus `kr` (leak closure 3) | 283,823 |
| with verse text | 291,681 |
| **labelled** (clean type link, inside a language cell) | **141,706** |
| label ≥ 1 after leave-one-out (some evidence of retransmission) | 139,261 |
| label = 0 after leave-one-out (no other attestation) | 2,445 |
| label ≥ 10 | 131,063 |

| cell | rows | .dedup | max | median | =0 | ≥10 | parish max | parish median |
|---|---|---|---|---|---|---|---|---|
| fi | 61,174 | 59,653 | 1,628 | 162 | 1,438 | 55,524 | 349 | 72 |
| krl | 10,527 | 9,802 | 1,628 | 162 | 217 | 9,702 | 349 | 48 |
| et | 54,229 | 54,063 | 1,118 | 177 | 567 | 51,092 | 112 | 62 |
| izh/vot | 15,776 | 15,750 | 1,628 | 115 | 223 | 14,745 | 349 | 28 |

Cells are assigned by the corpus's own county partition: `krl` = Viena, Aunus,
Raja-Karjala, Tveri, Novgorod; `izh/vot` = the three Ingrian counties; `fi` =
the Finland-proper counties; `et` = all of ERAB. This reproduces the previously
published cell sizes exactly (krl 10,527/10,949 = 96.1%, izh/vot 15,776/15,980 =
98.7%), which is why it was kept.

**`izh/vot` is an AREA label, not a speaker attribution.** Keski- and Itä-Inkeri
held Ingrian-Finnish (Savakko/Äyrämöinen) settlers alongside Izhorian and Votic
speakers. A speaker-level claim needs the singer records, which are not used here.

## Cleanup

| | removed | what it was |
|---|---|---|
| C1 | 1,270 links | ERAB id 1, kood `999999999`, `- Jääb ära -`. **Disposal bucket.** Verified top of the unfiltered ERAB ranking — this is exactly where the discredited "~1,270 max variants" headline came from. FILTER already drops it (66,298 source links − 1,270 = 65,028 in the release); asserted here rather than assumed. |
| C2 | 335 links | ERAB id 1347, kood `017002025`, `Määramata` ("undetermined"), under `Omalooming`. **Administrative placeholder.** FILTER does *not* drop it. |
| C3 | 81,040 links / 14,827 pseudo-types | `erab_orig*`. Not a type index: one node per distinct original type-name *string* (ERAB `hierarhia_originaal.csv`, 81,040 rows), so every Estonian song is linked both to its real unified type and to a free-text restatement. Double-counts every Estonian attestation, and shatters types across spellings. |
| C4 | 676 links / 60 nodes | `kt_t*` — the **table of contents of the Kanteletar**. Book sections, not song types. |
| C5 | — | **Found by this build.** The published spread figure counted every `poem_place.csv` row as a parish. `places.csv` holds 861 parishes *and* 41 counties, so a poem localised only to a county contributed a phantom parish. |

284,812 in-pool links (+5 orphans dropped) → **202,761 clean links over 10,037
types** (SKVR 7,555 + ERAB 2,482).

## Corrected maximum and distribution

| configuration | types | max | mean | median | singletons |
|---|---|---|---|---|---|
| unfiltered, undeduplicated | 24,917 | 1,673 | 11.42 | 1 | 13,847 |
| types cleaned | 10,037 | 1,673 | 20.18 | 3 | 3,657 |
| + `kr` removed + **exact** dedup | 10,037 | 1,672 | 20.15 | 3 | 3,660 |
| + `kr` removed + **normalised** dedup (operative) | 10,037 | **1,629** | 19.96 | 3 | 3,671 |

**Corrected maximum: 1,629 attestations (1,628 after leave-one-out)** —
`skvr_t060500_2700` *Verensulku*, the blood-stanching charm. A real charm type,
not a bucket. **On the ERAB side the corrected maximum is 1,119 / 1,118 LOO,
`Ema haual`**, replacing the 1,270 that came from the disposal bucket.

Variants per type (10,037 clean types): 1 → 3,671 · 2 → 1,142 · 3–4 → 1,137 ·
5–9 → 1,234 · 10–24 → 1,279 · 25–49 → 661 · 50–99 → 452 · 100–249 → 337 ·
250–499 → 93 · 500+ → 31.

Parishes per type: 1 → 3,985 · 2 → 1,206 · 3–4 → 1,290 · 5–9 → 1,300 ·
10–24 → 1,164 · 25–49 → 506 · 50–99 → 276 · 100–249 → 70 · 250–499 → 4.
Corrected max **349**, mean **7.784** on the identical SKVR-only universe the
published 362 / 8.128 / 3,216-single-parish figures were computed over
(reproduced exactly in `parish_measure_audit`, then corrected: 349 / 7.784 /
3,097). Note doctrine 13 in `../../CLAUDE.md` cites the old 362.

## Exact vs normalised matching — priced, not asserted

**Against ground truth.** ERAB ships all 108,969 texts twice: `xml/` normalised
by orthography, `xml_koll/` in original collection orthography. Same ids, so
recall is measured, not estimated. On 108,120 true pairs:

| key | recovered | recall | ambiguous |
|---|---|---|---|
| exact body text | 25,828 | 23.89% | 140 |
| normalised | 51,171 | 47.33% | 1,149 |

**Exact under-counts by 49.53%** — the same order as the ~58% found on the Czech
1918-vs-1927 re-edition pair. The two printings disagree on word division itself
(`Kus su`/`Kussu`, `Kus see`/`Kusse`), on palatalisation marks (`kul´l`/`kull`),
and on `y`/`ü`, so whitespace must be *stripped*, not collapsed. Normalising
costs 1,149 ambiguous collisions (1.06%); that is the price, and it is paid.

Even normalised recovers only 47%: ERAB's normalisation is genuine editorial
re-spelling (`beal`→`peal'`), not punctuation. Neutralising b/d/g→p/t/k lifts it
to 49.53% and degemination to 66.27%, but gemination is phonemic in Finnic
(`tuli`/`tulli`) so neither is used.

**On the label itself.** Every count was computed twice; both are in every row
(`label_value` vs `label_value_if_exact_dedup`).

| | clusters | rows collapsed |
|---|---|---|
| exact | 1,063 | 1,429 |
| normalised | 3,926 | 6,353 |

Exact under-counts collapsible rows by **77.51%**. Effect on the label:

| cell | rows whose value changes | mean change | max |
|---|---|---|---|
| fi | 37,841 (61.86%) | 8.1 | 60 |
| krl | 7,015 (66.64%) | 10.3 | 60 |
| izh/vot | 6,229 (39.48%) | 6.5 | 59 |
| et | 13,227 (24.39%) | 1.7 | 9 |

Exact is never *lower* than normalised on any of the 141,706 rows, as it must
be. **`parish_spread` is invariant to the dedup key by construction** — a
duplicate contributes its parish either way — so only `variant_count` pays this
cost. That asymmetry is a reason to prefer L2 where the two disagree.

## Leak closure

**1 — self-count. 141,706 rows moved, all of them.** A variant count is built
out of the very poems it labels: poem X, one of N attestations of type T, would
be handed the label N — a label containing X. Structurally the same fault as
leaving an anthology's poems inside the comprehensive pool they are contrasted
with. Closure is leave-one-out per poem per type. **2,445 singletons move 1 → 0**,
which is the correct statement — nothing else in the corpus repeats their song
type — where before they were indistinguishable from a type with one other
attestation.

**2 — re-entered texts. 2,950 labelled rows fold into a duplicate master.**
6,353 pool rows collapse on the normalised key (1,429 on exact), plus 1,082
curated pairs from `poem_duplicates.csv`; 294,367 → 286,932 distinct texts. The
`.dedup.tsv` tables then drop **2,438 rows** (fi 1,521, krl 725, et 166,
izh/vot 26) so no two rows share a text — otherwise a train/test split can put a
poem in train and its verbatim re-entry in test.

**3 — the compiled anthology inside the pool. 10,544 rows removed.** The `kr`
collection is Kalevala 1–50 + Kanteletar: Lönnrot's *selective compilation*,
assembled out of the same oral material the rest of the corpus records
comprehensively. Its rows are editorial re-workings of poems already in the pool
— **65 still collide with an SKVR text on the normalised key even after
Lönnrot's rewriting** — so counting them as independent attestations is the
anthology-inside-the-pool leak in its literal form. The whole collection is
removed from the pool, not merely from the label.

Also: 7,045 `type_is_minor` links are ignored when choosing a poem's primary
type (a non-minor link is preferred; among ties, the best-attested type wins).

## Limits, stated

- **JR carries no label at all.** 85,607 poems, 29% of the release, have **zero**
  type links. Not a defect of the label — a coverage limit of the type index.
  The same kills a Veps cell: all 1,142 Veps-area poems sit in JR.
- **ERAB has no licence.** `data/sources.tsv` blocks `et` on that, and this build
  does not unblock it. These tables carry ids, type names and hashes, not text.
- **Doctrine 13 applies directly.** Any feature scored on these cells must not be
  derived from the labelled pool; a per-cell frequency list built from it is a
  monotone function of the label.
