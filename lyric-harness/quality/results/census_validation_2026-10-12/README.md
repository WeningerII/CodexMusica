# Validation-side lookup census, 2026-10-12

Read-only measurement run before the one-dictionary plan (PR #527, BB8 comment
6133890644; sequencing asked for by R2 6133814414, evidence location asked for
by 3PO 6133908534). It changes no code path and no data the program reads.

## Inputs

| input | value |
|---|---|
| commit | `4b14ff5b0017f5f8b9e33cbbc6f00b1cf612bb80` for the three census records and the v2 `--top` record; see Provenance for the one exception |
| population | `song`, validation side of the frozen split: 1,723 items, `selected_units_sha256` `1d42fadb…c8fb15` |
| `cmudict.dict` | sha256 `81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22` |
| `data/lexicon_supplement_v2.tsv` | sha256 `bec6e6ddf8522b1f6ffc01bea806ef1ddb71584b2f8630670e8538de4c52fc51` |
| `quality/coverage_census.py` | sha256 `80fda3a9f8dbd88e254fc1d6fc98d5956e814743fe998c8eb07c171119e50ef4` |
| `quality/moby_convert.py` | sha256 `b75cd0dc32273271972b668dfcc5a90b601001671c604d9542890899c1db9efe` |
| Moby `mpron.txt` (staged, not committed) | sha256 `55580c3b258873723fed33497fe3a438b26167370bbe016431b3fc65fea67f2d` |

## Headline figures

| basis | unread words (of 351,683) | unread types (of 27,061) | songs fully read (of 1,723) |
|---|---|---|---|
| CMUdict only | 17,019 | 7,199 | 211 |
| + v2 | 17,018 | 7,198 | 211 |
| + v2 + `fallback: high` | 12,365 | 5,191 | 547 |

- **Unread under v2, by occurrence:** 72.7% other (no hyphen or apostrophe), 23.1% apostrophe,
  4.2% hyphen.
- **`fallback: high`:** answers 2,007 of v2's unread types, and 0 regress.
  Moby carries 368 of the 2,007. Of those 368: 170 exact, 38 differing only in
  stress, 65 differing only in reduced vowels, and 95 differing in sounds.

## Commands

Each census record (run from `lyric-harness/`). At a checkout of `4b14ff5b` (which predates `--reader-scheme`: drop the flag there) the output is byte for byte. At any later checkout only `census_commit` differs (it records the checkout, as Provenance below explains), and a record written since the reader batch also names its `reader_scheme`. `--reader-scheme=v1` reproduces a historical input (D8a): these records were measured under the pre-batch reader cut, and the census now defaults to v2:

    mkdir -p quality/results/census_validation_2026-10-12/
    python3 quality/coverage_census.py --reader-scheme=v1 --population song --split validation --out quality/results/census_validation_2026-10-12/census_cmudict_only.json
    python3 quality/coverage_census.py --reader-scheme=v1 --population song --split validation --lexicon-supplement=v2 --out quality/results/census_validation_2026-10-12/census_v2.json
    python3 quality/coverage_census.py --reader-scheme=v1 --population song --split validation --lexicon-supplement=v2 --fallback=high --out quality/results/census_validation_2026-10-12/census_v2_fallback_high.json

`compare_output.json`: the three commands in `compare.py`'s docstring. They
add `--top 100000`, which writes larger records than the three above.

## Files

- `census_cmudict_only.json`, `census_v2.json`, `census_v2_fallback_high.json`:
  the census records, one per basis, as `quality/coverage_census.py --out`
  wrote them. About 35 seconds per basis. The `--top 100000` records
  `compare.py` reads are not committed (2 to 3 MB each); its docstring regenerates them.
- `compare.py`: spelling groups of the types unread under v2, and the
  `fallback: high` readings of those types compared with Moby. Its docstring
  gives the three commands that reproduce `compare_output.json` byte for byte.
- `compare_output.json`: its output, with every row that is not an exact match.

## What the figures are, and what they are not

- **Answer rates, not verified coverage.** "Read" means the lookup returned a
  reading. Whether the reading is right is a separate question.
- **"Songs fully read" means no unread token piece.** It does not mean the
  song passes the workflow or that its pronunciations are verified.
- **2,007 is a set difference, not only a net change.** 2,007 spellings unread
  under v2 are answered under `fallback: high`. None that v2 reads goes unread
  under `fallback: high` (`set_difference` in `compare_output.json`).
- **Spelling groups are not a linguistic classification.** `other` includes
  closed compounds, so these groups do not measure the share of compounds.
- **Moby is a reference, not a judge.** It carries 368 of the 2,007 types that
  `fallback: high` newly reads.
  How representative that subset is has not been measured.
  The 95 rows whose sounds differ are disagreements still to be adjudicated.
  Some are fallback errors and some are Moby or converter conventions. They
  are not a measured error rate, and the subset cannot speak for the other
  1,639 types.

## Provenance

`coverage_census.py` records the checkout it ran at (`census_commit`, from
`git rev-parse HEAD`), and `compare.py` copies that field. Two checkouts were
used, and the output keeps both as they were recorded:

- **`4b14ff5b`** (main): the three census records and the v2 `--top 100000`
  record, which `compare_output.json` carries as `census_record`.
- **`8ff62a12`** (this PR's first commit): the `fallback: high` `--top 100000`
  record, which `compare_output.json` carries as `census_record_high`. It was
  added for the set-difference check after that commit.

`git diff 4b14ff5b 8ff62a12` touches only this directory and `map/files.md`.
So the census code, the dictionaries and the corpus were the same at both
checkouts. Run from one checkout, the commands reproduce every count and row
exactly. The two `census_commit` fields will show that one checkout instead,
so byte-for-byte equality of `compare_output.json` requires the
`fallback: high` record to be produced at `8ff62a12`.

## Held-out exposure

BB8 read the full list of types unread under v2 on the validation side, and
the comparison rows above. From this date the validation side is **spent for
dictionary-lane tuning**: a reviewed reading chosen from these lists is tuned
on it. Any later claim about unseen words needs a fresh holdout or an outside
source. No validation-side reading has been added to any lexicon.
