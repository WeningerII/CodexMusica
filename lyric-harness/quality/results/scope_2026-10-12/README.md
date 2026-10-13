# Pronunciation scope, population-wide, 2026-10-12

These are read-only measurements of the whole problem rather than one word pair at a time. Work was split on PR #527: R2 took the variant audit, BB8 these three items, and 3PO the adjudication design and evidence review. Item 4, the agreement between tools, is deferred until the one-reader change lands. Nothing here changes a code path or any data the program reads.

## Inputs

Run every command below from `lyric-harness/`. The Moby file is the staged, git-ignored `data/moby/mpron.txt` (`quality/fetch_data.py --research`).

| input | value |
|---|---|
| commit | `4b14ff5b0017f5f8b9e33cbbc6f00b1cf612bb80` |
| `cmudict.dict` | sha256 `81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22` |
| `data/lexicon_supplement_v2.tsv` | sha256 `bec6e6ddf8522b1f6ffc01bea806ef1ddb71584b2f8630670e8538de4c52fc51` |
| Moby `mpron.txt` (staged, not committed) | sha256 `55580c3b258873723fed33497fe3a438b26167370bbe016431b3fc65fea67f2d` |
| population for items 1 and 3 | `song`, **dev** side of the frozen split `quality/results/coverage_split_2026-10-11-r2.tsv` (sha256 `604d309f…`, 6,991 items). Validation is excluded because it is spent for tuning (`../census_validation_2026-10-12/README.md`). |
| scripts | the `.py` files in this directory exist only at this PR's head, not at `4b14ff5b` |

## Item 1: unread words, dev side

    python3 quality/coverage_census.py --population song --split dev [--lexicon-supplement=v2] [--fallback=high] --top 100000 --out FILE

The records are `census_dev_none.json`, `census_dev_v2.json` and `census_dev_v2high.json`. They are the command's output after three edits: `population_manifest` dropped, every `top_*` list cut to its first 500 rows, and a `note` field added. The command above regenerates the unedited records. They took 66 s, 136 s and 140 s to run.

| basis | unread words (of 1,491,865 tokenizer-produced occurrences; tokens the tokenizer drops, such as digits, are not in this denominator) | unread types (of 60,446) | songs fully read (of 6,991) |
|---|---|---|---|
| CMUdict only | 70,571 | 20,467 | 857 |
| + v2 | 70,571 | 20,467 | 857 |
| + v2 + `fallback: high` | 51,231 | 15,041 | 2,185 |

- **v2 changes no dev count.** Its 205 rows are 203 hyphenated number readings plus *streetlight* and *streetlights*, and none of those forms occurs in these dev songs. That means no measured gain on dev. It says nothing about any other population.
- **Spelling groups of unread occurrences under v2:** 73.0% have no hyphen and no apostrophe, 22.9% have an apostrophe and 4.1% a hyphen. A hyphen takes precedence: the 484 occurrences carrying both count as hyphen, so the split depends on that order. Spelling groups are **not** a linguistic classification. They do not establish what share is dialect, archaic or a closed compound.

## Item 2: CMUdict + v2 against Moby

    python3 quality/results/scope_2026-10-12/lex_vs_moby.py data/moby/mpron.txt quality/results/scope_2026-10-12/lex_vs_moby.json

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

    python3 quality/results/scope_2026-10-12/reader_disagree.py quality/results/scope_2026-10-12/reader_disagree_dev.json

It reads with `SupplementedLexicon(v2)` and no fallback. The output is in `reader_disagree_dev.json`.

227,538 end lines: 202,488 read by both readers, 13,995 by neither, and **11,055 where one reads and the other refuses**. This is read/refuse disagreement, not pronunciation disagreement: lines both readers read are not compared, and the output saves aggregates and example spellings, not occurrence contexts. By the classifier in `reader_disagree.py`:

| mechanism | lines |
|---|---|
| anchor reads, grid refuses: the two readers chose different end words (generic). Of the 3,811, the grid's token ends in `--` in 3,729, in another dash in 12, and in something else in 70 | 3,811 |
| anchor reads, grid refuses: the grid's last token has no letter (punctuation and digits together, not separated) | 3,656 |
| anchor reads, grid refuses: hyphenated, where the grid reads the whole token and the anchor reads the last piece | 3,206 |
| grid reads, anchor refuses: same word | 370 |
| other | 12 |

**Agreement is not correctness.**
- **The hyphen row needs a semantic decision:** which reading of a hyphenated end word is the right one. Making the two readers agree does not answer that.
- **"Anchor reads" on a digit line can itself be wrong.** The digits are dropped, so the anchor lands on the word before them (R2's finding, reproduced on #527).
- **The 370 row is unverified.** It still needs checking in line context.

## Item 2b: one isolated reading per dev spelling, weighted by occurrence

    python3 quality/results/scope_2026-10-12/selected_vs_moby.py data/moby/mpron.txt quality/results/scope_2026-10-12/selected_vs_moby.json

`lex_vs_moby*.json` and `reader_disagree_dev.json` now record `commit` (and `mpron_sha256`, or the split file) too; they were regenerated at `dafbab2a` with only those fields added, every other field byte-for-byte as before. `selected_vs_moby.json` records `commit` `6bfbb726`, this PR's first commit, which it ran from. `4b14ff5b..6bfbb726` adds only this directory, `.prettierignore` and `map/files.md`. A rerun at a later head reproduces every field except `commit`.

**Isolated readings, not contextual ones.** Each distinct dev spelling is read once, in isolation, by `transcribe_word` (`SupplementedLexicon(v2)`, no fallback), and that one reading is weighted by the spelling's occurrence count. It is not the sequence `transcribe(line)` returns in context: per-position weak-token stress demotion is not applied, and a spelling with several contextual readings gets one. The contextual line sequence is kept in the occurrence sidecar below for the occurrences it covers. **Denominators.** Three line populations appear in this receipt, and they differ: 227,538 lines with an anchor or grid endpoint (item 3; equal to the census's `end_grid.end_words`); 227,115 lines with an anchor endpoint (`end_anchor.end_words`); and 227,098 lines where `transcribe` keeps at least one token, whose last kept token is this table's "line end". A kept last token can already have lost a raw digit endpoint. **Exposure, not errors.** Counts per spelling are exposure counts, not adjudicated errors. The output is in `selected_vs_moby.json`. It ran in 31 s.

| class | all occurrences (1,491,865) | last kept token on lines with one (227,098) |
|---|---|---|
| exact | 63.7% | 71.3% |
| not in Moby | 12.7% | 16.3% |
| unread | 4.7% | 6.2% |
| sounds differ in the rhyme tail | 9.6% (54.8% of it is *and* and *a*: our weak forms against Moby's strong forms) | 3.5% |
| stress only | 7.8% | 0.8% |
| reduced vowel only | 1.1% | 1.2% |
| sounds differ before the rhyme tail | 0.3% | 0.6% |

The line-end disagreements with the most occurrences fall into four groups:
- **Conventions.** NEAR `IH`~`IY` (*dear, fear, near, year, clear*), which M-320's licence already agrees before R, and `AW ER`~`AW R` (*hour, ours*).
- **Valid homographs.** *read, lives, content*.
- **Reference artifacts.** Moby carries only a rare sense for *said* (`'s/A//I/d`, sayyid), *rose* (`r/oU/'z/eI/`, rosé), *none* (`n/oU/n`) and *comes* (the Latin plural). The top line-end row, *man* (565 line-end, 1,780 total), is a converter case artifact: `moby_convert` keeps lowercase `man m/A/n` and drops `Man m/&/n`.
- **An exposure, not a verdict.** *a'* is read `AH0`, as the article *a*, through the apostrophe-stripping mechanism. Its occurrences (1,030 total, 184 at line ends) mix the article *a'* with Scots *a'* ("all"), so they cannot all take one verdict (3PO's occurrence review).

So disagreeing with Moby is a weak signal of error, and some of Moby's own entries are wrong for the common sense. That is more evidence that Moby cannot judge a reading.

## Occurrence sidecar for the M1/M2 context ledger (3PO)

    python3 quality/results/scope_2026-10-12/occurrence_sidecar.py quality/results/scope_2026-10-12/occurrence_sidecar.jsonl.gz

The output is `occurrence_sidecar.jsonl.gz`: gzip JSON lines, a header record first, about 1.4 MB, 16 s to run.

It holds every dev raw token, at every line position, that carries a digit, or that starts or ends with an apostrophe once outer punctuation other than apostrophes is removed. Each record has:
- the path, item ordinal, line index and line text;
- the raw token, its span and position;
- the tokens the tokenizer keeps from it, and whether it dropped the token;
- the pieces, with each piece's selected phones and `reading_source` provenance (fallback `none`);
- the tokens kept for the whole line, and the contextual phone sequence `transcribe(line)` returns for it (`line_phones_contextual`);
- each end reader's end token and whether it reads.

A field this pass cannot observe is `"UNAVAILABLE"`. No verdict is recorded.

**Counts.** 24,965 edge-apostrophe tokens (7 dropped by the tokenizer) and 746 digit tokens (640 dropped).

**The selection is by spelling.** It includes tokens that are not elisions, for example quotation marks (`'Reveille.'`) and editorial line numbers (`heart.    10`). Telling these apart is left to the adjudicator.

## Item 6: hyphenated anchor end tokens, four classes, with line ids

    python3 quality/results/scope_2026-10-12/hyphen_end_classes.py quality/results/scope_2026-10-12/hyphen_end_classes.jsonl.gz

The script reads `raw_final_token` on every dev line (227,115 anchor end lines) with `SupplementedLexicon(v2)` and no fallback. It records one JSON line per hyphenated end token, carrying a stable id `path#item:line`, under three selection definitions. Its docstring states each definition exactly.

| definition | whole-token lookup succeeds (read whole today / not) | every piece reads | an earlier piece unread | last piece unread | total |
|---|---|---|---|---|---|
| `bb8` (BB8's first count) | 86 (82 / 4) | 2,962 | 147 | 411 | 3,606 |
| `r2` (R2's third row) | 86 (82 / 4) | 2,960 | 148 | 413 | 3,607 |
| `policy` (the agreed dash rule: split at internal `--`/`–`/`—`, take the last word) | 87 (82 / 5) | 2,963 | 148 | 413 | 3,611 |

**Reconciling the definitions.**
- **`bb8` against `r2`.** 8 lines are in `bb8` only: tokens joined by an internal `--`, such as `flower-pot--yet`. 9 lines are in `r2` only: a hyphen next to an apostrophe, such as `meetin'-bunnet`. Every other line has the same class under both.
- **`policy` against `r2`.** `policy` adds 4 lines that `r2` excludes for their internal `--` but whose last word is hyphenated: `great--grand-daughters`, `bands--Mac-Nee's--`, `likewise--Never-mind` and `also--You-know-who--`.

**What the strict item-6 rule would change, under `policy`:**

| class | lines | change |
|---|---|---|
| every piece reads | 2,963 | joined today → refused |
| an earlier piece unread | 148 | read silently by the last piece today → refused |
| whole entry, not read whole today | 5 | → read whole |
| whole entry, read whole today | 82 | unchanged |
| last piece unread | 413 | refused today and after |

"Whole-token lookup succeeds" is `transcribe_word` on the whole spelling. That includes its always-on `-s`/`'s`, `'d` and `in'` rules, so it is not an exact-entry test. One `policy` line, `corpus/song/eng_british_edwin_arnold.txt#4:70` (`grand-daughters`), is read through the plural rule on CMUdict's `grand-daughter` entry. Counting exact entries only would give 2,964 lines that every piece reads, so 3,112 newly refused lines. R2's independent check on #527 measured with `line_anchors` that every line in the first three classes anchors today and every last-piece-unread line refuses. The three "every piece reads"/"earlier piece unread" transitions above are therefore measured current outcomes and projected post-change behaviour.

These are anchor end-line counts only. Per-word, meter and schema before/after counts belong to the test family.
