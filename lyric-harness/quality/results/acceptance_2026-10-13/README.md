# Acceptance receipt for the reader batch, 2026-10-13

John approved building the reader batch on 2026-10-13 ("yes, go ahead and build it", relayed verbatim by R2 on PR #527, comment 6136624835). R2 builds the code. This directory holds BB8's independent acceptance tools, and 3PO reviews contracts and wording. Merging and deploying come back to John.

The scope receipt (`../scope_2026-10-12/shape_sweep.json`) **projects** which dev lines the batch would touch. These tools **measure** what each built head actually does to the same lines, and set the two against each other.

## The recorder

    python3 quality/results/acceptance_2026-10-13/record.py OUT.jsonl.gz [HARNESS_ROOT]

The recorder reads every dev line of the coverage split (`quality/results/coverage_split_2026-10-11-r2.tsv`) with the census's default English reader (`build_lexicon("v2", "none")`). It writes one JSON line per line id (`path#item:line`). It records only what a caller sees, through public entry points:
- `line_tokens` and `raw_final_token`;
- `line_readability`: whether the end word is refused, the cause, the unreadable lists and the reason text;
- the line's phones from `Lexicon.transcribe`.

A line that raises is recorded with its error. `HARNESS_ROOT` lets one copy of the script measure any head checked out in a worktree. A worktree has no staged data, so give it the pinned `cmudict.dict` and set `LYRIC_STAGED_DATA` to the staged data directory. The header names the commit measured and whether it had tracked changes.

## The diff

    python3 quality/results/acceptance_2026-10-13/diff.py BEFORE.jsonl.gz AFTER.jsonl.gz OUT.json

The diff joins two recordings by id. It classifies every change: the end word newly refused or newly read, a word before the end newly refused or newly read, a reading switched while the line stays readable, the tokens changed, or a line raised.

The two refusal classes are cross-tabulated against the projected id sets: item 6, M1 and M2b, at the end word and inside the line. Each set gets three counts: projected and observed, projected and not observed, and **observed but not projected**. The last is the change nobody predicted, and its ids are listed with before and after detail.

## The disputed dictionary rows

    python3 quality/results/acceptance_2026-10-13/disputed_rows.py quality/results/acceptance_2026-10-13/disputed_rows.json [MPRON]

This lists the CMUdict apostrophe rows that M2a (exact entry first) would select over today's reading. It is John's separate data decision. It covers `s'` rows that have a bare plural and `in'` rows that have an `-ing` word, both tested by one criterion:
- **Disputed:** no exact reading equals any of today's readings, once stress is dropped and unstressed AH0, IH0 and ER0 are merged. This is the data decision.
- **First switch:** they share a reading, but the exact row's first reading is not today's first. M2a makes this variant-order change; it is disclosed and tested, not disputed.

Moby's readings appear as reference only, from the pinned file (sha256 `55580c3b…`).

Results at this commit:

| kind | shape | rows | rows seen on dev | dev occurrences |
|---|---|---:|---:|---:|
| disputed | `s'` | 56 | 4 | 38 |
| disputed | `in'` | 0 | 0 | 0 |
| first switch | `s'` | 82 | 4 | 20 |
| first switch | `in'` | 5 | 5 | 17 |

The 75 occurrences quoted on #527 are 38 disputed plus 37 first switches. The 4 disputed rows seen on dev are `fathers'` (33), `mothers'` (3), `husbands'` (1) and `months'` (1). In each case Moby's singular stem agrees with today's reading. Under a broader normalization that merges AH, IH and ER at every stress, 48 of the 56 rows are still disputed. Two of the first switches change more than a reduced vowel: `congress'` gains a syllable (`… S IH0 Z`), and `gettin'` moves its stressed vowel from EH1 to IH1.
