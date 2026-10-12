# Validation-side lookup census, 2026-10-12

Read-only measurement run before the one-dictionary plan (PR #527, BB8 comment
6133890644; sequencing asked for by R2 6133814414, evidence location asked for
by 3PO 6133908534). It changes no code path and no data the program reads.

## Inputs

| input | value |
|---|---|
| commit | `4b14ff5b0017f5f8b9e33cbbc6f00b1cf612bb80` |
| population | `song`, validation side of the frozen split: 1,723 items, `selected_units_sha256` `1d42fadb…c8fb15` |
| `cmudict.dict` | sha256 `81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22` |
| `data/lexicon_supplement_v2.tsv` | sha256 `bec6e6ddf8522b1f6ffc01bea806ef1ddb71584b2f8630670e8538de4c52fc51` |
| `quality/coverage_census.py` | sha256 `80fda3a9f8dbd88e254fc1d6fc98d5956e814743fe998c8eb07c171119e50ef4` |
| `quality/moby_convert.py` | sha256 `b75cd0dc32273271972b668dfcc5a90b601001671c604d9542890899c1db9efe` |
| Moby `mpron.txt` (staged, not committed) | sha256 `55580c3b258873723fed33497fe3a438b26167370bbe016431b3fc65fea67f2d` |

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
  `fallback: high` newly reads, and that subset leans towards standard words.
  The 95 rows whose sounds differ are disagreements still to be adjudicated.
  Some are fallback errors and some are Moby or converter conventions. They
  are not a measured error rate, and the subset cannot speak for the other
  1,639 types.

## Held-out exposure

BB8 read the full list of types unread under v2 on the validation side, and
the comparison rows above. From this date the validation side is **spent for
dictionary-lane tuning**: a reviewed reading chosen from these lists is tuned
on it. Any later claim about unseen words needs a fresh holdout or an outside
source. No validation-side reading has been added to any lexicon.
