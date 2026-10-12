# Pronunciation scope, population-wide, 2026-10-12

These are read-only measurements of the whole problem rather than one word pair at a time. Work was split on PR #527: R2 took the variant audit, BB8 these three items, and 3PO the adjudication design and evidence review. Item 4, the agreement between tools, is deferred until the one-reader change lands. Nothing here changes a code path or any data the program reads.

## Inputs

| input | value |
|---|---|
| commit | `4b14ff5b0017f5f8b9e33cbbc6f00b1cf612bb80` |
| `cmudict.dict` | sha256 `81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22` |
| `data/lexicon_supplement_v2.tsv` | sha256 `bec6e6ddf8522b1f6ffc01bea806ef1ddb71584b2f8630670e8538de4c52fc51` |
| Moby `mpron.txt` (staged, not committed) | sha256 `55580c3b258873723fed33497fe3a438b26167370bbe016431b3fc65fea67f2d` |
| population for items 1 and 3 | `song`, **dev** side of the frozen split (6,991 items). Validation is excluded because it is spent for tuning (`../census_validation_2026-10-12/README.md`). |

## Item 1: unread words, dev side

    python3 quality/coverage_census.py --population song --split dev [--lexicon-supplement=v2] [--fallback=high] --top 100000 --out FILE

The records are `census_dev_none.json`, `census_dev_v2.json` and `census_dev_v2high.json`. Every `top_*` list is cut to its first 500 rows here, and the command above regenerates the full lists. They took 66 s, 136 s and 140 s to run.

| basis | unread words (of 1,491,865) | unread types (of 60,446) | songs fully read (of 6,991) |
|---|---|---|---|
| CMUdict only | 70,571 | 20,467 | 857 |
| + v2 | 70,571 | 20,467 | 857 |
| + v2 + `fallback: high` | 51,231 | 15,041 | 2,185 |

- **v2 changes no dev count.** Its 205 rows are 203 hyphenated number readings plus *streetlight* and *streetlights*, and none of those forms occurs in these dev songs. That means no measured gain on dev. It says nothing about any other population.
- **Spelling groups of unread occurrences under v2:** 73.0% have no hyphen and no apostrophe, 22.9% have an apostrophe and 4.1% a hyphen. Spelling groups are **not** a linguistic classification. They do not establish what share is dialect, archaic or a closed compound.

## Item 2: CMUdict + v2 against Moby

    python3 quality/results/scope_2026-10-12/lex_vs_moby.py PATH/TO/mpron.txt OUT.json

This compares the **whole dictionary inventory**: every word that has a reading in `cmudict.dict` or in the v2 supplement, 126,189 words. That is a different population from the readings actually selected for corpus occurrences, which this item does not measure. Moby is converted by `quality/moby_convert.py`.

**Moby is a reference.** It flags disagreements. It does not judge which reading is right, and it cannot independently check the v2 rows that were sourced from it.

| class | words |
|---|---|
| not in Moby, as converted (unchecked) | 98,586 |
| exact match on some reading | 19,051 |
| stress only | 2,317 |
| reduced unstressed vowel only | 2,154 |
| sounds differ | 4,081 |

**Rhyme tail** (from the last primary-stressed vowel onward, with reduced vowels tolerated): **3,983** words disagree.
- **1,170** fall in substitution families that are known dialect or transcription conventions (`lex_vs_moby_tail2.json`, `families`). Being in a family does not make a reading correct, and a family member can still be an error.
- **The remaining 2,813** spread across 1,222 substitution patterns (`other_patterns`).

All of these are **disagreements to adjudicate**. None of the counts is an error rate. The adjudication design is 3PO's, and this file does not presume it.

## Item 3: anchor reader vs grid reader, every dev end line

    python3 quality/results/scope_2026-10-12/reader_disagree.py OUT.json

It reads with `SupplementedLexicon(v2)` and no fallback. The output is in `reader_disagree_dev.json`.

227,538 end lines: 202,488 read by both readers, 13,995 by neither, and **11,055 where the two disagree**. By mechanism, the rule being in `reader_disagree.py`:

| mechanism | lines |
|---|---|
| anchor reads, grid refuses: a trailing `--` is glued to the grid's last token | 3,811 |
| anchor reads, grid refuses: the grid's last token is punctuation or digits only | 3,656 |
| anchor reads, grid refuses: hyphenated, where the grid reads the whole token and the anchor reads the last piece | 3,206 |
| grid reads, anchor refuses: same word | 370 |
| other | 12 |

**Agreement is not correctness.**
- **The hyphen row needs a semantic decision:** which reading of a hyphenated end word is the right one. Making the two readers agree does not answer that.
- **"Anchor reads" on a digit line can itself be wrong.** The digits are dropped, so the anchor lands on the word before them (R2's finding, reproduced on #527).
- **The 370 row is unverified.** It still needs checking in line context.

## Item 2b: the readings actually selected in dev occurrences

    python3 quality/results/scope_2026-10-12/selected_vs_moby.py PATH/TO/mpron.txt OUT.json

Each dev word is looked up through `SupplementedLexicon(v2)` with no fallback, the reading `transcribe_word` selects is compared with Moby, and the counts are weighted by occurrence. The output is in `selected_vs_moby.json`. It ran in 31 s.

| class | all occurrences (1,491,865) | line-end occurrences (227,098) |
|---|---|---|
| exact | 63.7% | 71.3% |
| not in Moby | 12.7% | 16.3% |
| unread | 4.7% | 6.2% |
| sounds differ in the rhyme tail | 9.6% | 3.5% |
| stress only | 7.8% | 0.8% |
| reduced vowel only | 1.1% | 1.2% |
| sounds differ before the rhyme tail | 0.3% | 0.6% |

The line-end disagreements with the most occurrences fall into four groups:
- **Conventions.** NEAR `IH`~`IY` (*dear, fear, near, year, clear*), which M-320's licence already agrees before R, and `AW ER`~`AW R` (*hour, ours*).
- **Valid homographs.** *read, lives, content*.
- **Moby carrying only a rare sense.** For *said* it has only `'s/A//I/d` (sayyid), for *rose* only `r/oU/'z/eI/` (rosé), for *none* only `n/oU/n`, and for *comes* only the Latin plural.
- **A real silent error.** Scots *a'* ("all") is read `AH0` as the article *a*. This is the apostrophe-stripping mechanism R2 found.

So disagreeing with Moby is a weak signal of error, and some of Moby's own entries are wrong for the common sense. That is more evidence that Moby cannot judge a reading.
