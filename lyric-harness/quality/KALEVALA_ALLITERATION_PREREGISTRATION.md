# Pre-registration — Kalevala alliteration: the first structure calibration

Committed before any number over the Finnish corpus exists. Protocol
pattern: `quality/METER_BANDS_PREREGISTRATION.md` (register → measure →
adopt or refuse → CI re-derives) and
`quality/STRUCTURE_CENSUS_PREREGISTRATION.md` (whose run-1 verdicts are in
`RESULTS_STRUCTURE_CENSUS.md`). This sitting is phase 2: the first
MEASURED laziness regime for a catalog row beyond the comparator sentinel.

## The question

Under a tradition that REQUIRES alliteration, which alliterating choices
are the cheap reflexes? Two tiers, transposing the owner's end-rhyme rule
(2026-08-18) onto this structure's own axis:

- **Tier 1 candidate — the free ride.** For end-rhyme the free ride is
  the same spelled ENDING (hair/chair). For alliteration in an
  agglutinative language the free-ride candidate is the SAME STEM: a line
  that "alliterates" `laulan`/`lauloi` has inflected one word twice.
  Operationalised orthographically as a shared spelled PREFIX beyond the
  onset; the cutoff length is DERIVED from the corpus (the distribution
  of shared-prefix lengths among alliterating pairs, reported as a table
  at every k), never guessed (doctrine 58).
- **Tier 2 — the modal partners.** P(partner word | call word) among
  CONSTRAINED alliterating pairs — the direct analogue of
  `data/song_rhymepair_en.tsv`'s conditional, whose 63.2% blocked-mass
  result is the shape this table has to beat chance by. The Kalevala's
  formulae (`vaka vanha Väinämöinen`) are exactly what this table should
  surface at its head.

## Populations and the reader

| coordinate | value |
|---|---|
| constrained corpus | `corpus/fin_kalevala.txt` (22,795 lines), `corpus/song/fin_kanteletar.txt` (28,935), `corpus/song/fin_kanteletar_uudempia.txt` (1,500) — 53,230 lines of verse that lives by the rule |
| incidental corpus (null B) | the ~~seven~~ **NINE** later-Finnish rhymed-verse files under `corpus/song/fin_*` EXCLUDING the two Kanteletar volumes — same language, same reader, NOT under the alliteration constraint. (CORRECTED 2026-08-18, before any measurement: the first commit of this row said "seven" from memory; `ls corpus/song/fin_*.txt \| grep -v kanteletar \| wc -l` is 9 — kivi, eino_leino, juteini, jh_erkko, julius_krohn, kramsu, kasimir_leino, cajander, wahanen_laulukirja. The POPULATION was always the exclusion rule, which is unambiguous; the count was a threshold nobody wrote down, doctrine 58's own case, caught by running the command before the instrument was built.) |
| items and lyric lines | the same one-definition readers the census used (`--- TITLE:` items, `is_apparatus_line`) |
| population | word-within-line ordered pairs — the tradition binds within the line, per the catalog row's own documentation |
| reader | `quality.structures.judge("kalevala-alliteration", a, b, phon=PH.get("fin"))` — the grader's own routing on the language's own phonology (doctrines 45/48); probed live before this registration: vaka/vanha TRUE, vanha/väinämöinen TRUE, vesi/meri FALSE |
| verdict accounting | n_pairs / n_true / n_false / n_refused per corpus arm, never summed (doctrine 79) |

## Two nulls, both required (doctrine 27/31/76)

- **Null A — within-item random pairing.** For each item, pairs are drawn
  at random from the item's own words ACROSS its lines
  (`random.Random(20260818)`), matched in count to the item's observed
  within-line pairs, and judged by the same reader; 200 resamples give
  the null distribution and the empirical p. This is the within-item
  permutation null in its pair-level form — the judge's verdict depends
  only on the two words, so random cross-line pairing from the same
  vocabulary estimates the same quantity at a fraction of the judgings,
  and the memoised verdicts are shared across resamples. It breaks the
  constraint while holding vocabulary: "what does THIS lexicon
  alliterate by chance."
- **Null B — the incidental corpus.** The later-Finnish files' own
  within-line rate: same language under no constraint. **The English
  census cells are NOT a null here** — a Finnish chance rate cannot be
  read off English text, and the census's own registration bound its
  cells to English enforcement. Registered so nobody quotes the 9%
  English chance rate against a Finnish measurement.

## Expectations and falsifiers

- **E1 (the constraint is visible).** The constrained corpus's
  within-line realization rate EXCEEDS both nulls — null A's p at the
  permutation floor and null B by an inspectable margin. If it does not,
  either the reader or the corpus identification is wrong: no adoption,
  diagnose first.
- **E2 (the conditional has support).** The tier-2 table's coverage is
  reported the way `song_rhymepair` reports sparsity: types with ≥1
  realised partner, median distinct partners, token-weighted coverage.
  If the dense region cannot fill a k=6 exclusion for most call tokens,
  the modal_exclusion analogue adopts a SMALLER k or refuses — the
  number follows the table.
- **E3 (tier 1 is real).** The shared-prefix distribution among TRUE
  pairs shows a separable same-stem mass; the cutoff adopted is the one
  the distribution offers. If no separation exists, tier 1 is REFUSED
  for this structure and the refusal recorded — a free-ride class that
  is not there cannot be banned into existence.
- **F1 (accounting).** Verdict counts sum per arm, or no adoption.
- **Split-half discipline.** The tier-2 table is derived on a seeded
  half of the constrained items and its blocked-mass measured on the
  other half (the leave-out pattern doctrine 13/14 demands), both
  halves disclosed.

## What adoption flips, all in one sitting

`Structure.calibrated = True` on the `kalevala-alliteration` preset row
ONLY (the weak/strong axis cells stay uncalibrated until separately
measured); the planner pool grows to two and `quality/test_structures.py`
§7's pool check is REPINNED — a visible edit, by design; the
`--structures` CLI spelling ships, because a non-default pick is now
producible; and the adopted numbers are re-derived in CI the way
`meter_bands --check` is.

**The binding scope, registered as a non-claim:** this regime binds
FINNISH-language use of the structure. English drafts declaring
kalevala-alliteration keep grading correctness with the
`STRUCTURE_UNCALIBRATED`-style disclosure semantics for laziness until an
English alliterative signal corpus is measured — a table fitted on one
tradition is not quietly applied to another (doctrine 8).
