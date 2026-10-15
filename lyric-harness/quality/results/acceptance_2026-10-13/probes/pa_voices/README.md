# P-A acceptance probe: voices toggle after a word place is saved

**The finding (P-A, b887e5eff review).** On the Lyrics page, a rhyme groups row, a returns row or a pronunciation reading names a word by its number in the line, for example `1.T5`. The numbering depends on whether parentheses are sung. When b887 migrates an older row, it writes `— cut v2` but doesn't record which voices setting the number was counted under. At send time the page stamps the current setting (`numbering v2` or `v2+voices`). So if the writer flips "parentheses are sung" after the migration, the number can point at a different word, and the harness binds it without complaint. Repro: `Oh--oh, (ah) oh my love`. The row means "love", but after the flip the send binds "my".

## What the probe does

For a matrix of cases it walks the page path and asks the harness what the payload binds:

- **4 lines:** a `--` join with an aside (the repro), an echoed aside (`Bye--bye (bye) bye`), a spaced enclitic with a two-word aside, and a voices-only echo (`Hold on (hold on) hold on`).
- **3 row types:** rhyme groups, returns, readings.
- **3 row origins:**
  - written by the tree's own migration of a pre-release row;
  - written by the page's own form;
  - already stored exactly as b887 migrates it (`— cut v2`, no numbering mark).
- **Voices transitions:** off→sung and sung→off, plus two controls where voices don't change.

Each case is classified:

- **SAME_WORD:** binds the intended occurrence, meaning the same characters of the line.
- **REFUSED:** the page sent nothing, or the harness refused.
- **WRONG_WORD:** binds a different occurrence silently. A same-spelled echo counts as a different word.
- **DROPPED:** the declaration is gone with no decision asked.

The page side is a **node replica**: the tree's own `src/pages/lyrics.js` source runs in a VM, the send runs through its own `lySubmitLyricsAction('review')`, and the chat transport is a stub. **It is not a browser run.**

The harness side runs the harness tree's own `normalize-numbering` verb, using the flags the payload implies (`--reader-scheme`, `--voices`, `--numbering`, `--pronunciations`, `--groups`, `--returns`). It then reads the bound token back with that tree's own `reader_token_spans`.

## Pass rule: preserve or refuse

**Status:** WRONG_WORD and DROPPED are the regression gate. The GUESSED rule below is a **proposed compatibility-policy target, pending team review** (3PO, #527 6194424884). It is not a settled grading requirement, and it is reported separately.

**Identity is decided by spans.** A stored word may rule out a basis whose token holds another word. But agreement between bases is always decided by the character spans (`pieces`) each basis names, never by spelling, so repeated identical words at different spans count as different occurrences.

The rule is 3PO's, from #527 comment 6194066262:

- **Never WRONG_WORD** (and never DROPPED).
- **A row that records its basis** (`— numbering …`, as the page's forms write it): SAME_WORD or REFUSED both pass.
- **A row that does not record its basis** (`— cut v2` only, as b887 migrates rows): REFUSED passes only if the send attempt left the row bytes unchanged. SAME_WORD passes only when every plausible basis (v2 and v2+voices) names the same occurrence. If the bases differ, a SAME_WORD is a lucky guess (**GUESSED**) and fails. This applies to the controls too: the page can't prove a stored row's basis just because voices didn't change in this session.
- **Probe choices, open for 3PO or John to change:**
  - For a reading, a basis is ruled out when the stored word isn't at that number.
  - A wholly unmarked pre-release row is judged the same way, with the earlier page cut ±voices as its plausible bases. Its send boundary may still mark it, so its bytes are recorded but not judged.

**Open decision.** Rows that b887 has already migrated carry no numbering mark, and nothing in their bytes says which voices setting they were counted under. A fix can refuse them, or accept them only where the bases agree. Either way, the writer has to re-declare any that are refused. Whether to accept anything weaker, such as trusting the voices setting at first open, is for 3PO or John to decide.

## Run it

Run from `lyric-harness/`, with the tree's `cmudict.dict` staged and `LYRIC_STAGED_DATA` set:

```
PY=<python> quality/results/acceptance_2026-10-13/probes/pa_voices/run.sh <tree> <outdir> [<label>] [<harness-tree>]
```

or the two steps by hand:

```
node quality/results/acceptance_2026-10-13/probes/pa_voices/pa_probe.js <tree> > <cases.json>
<python> quality/results/acceptance_2026-10-13/probes/pa_voices/pa_harness.py <harness-tree> <cases.json> <out.json>
```

The exit status is 0 only when no case fails, 1 when any case fails, and 3 when the harness tree has no `normalize-numbering` verb.

## Results in `out/` (2026-10-15)

| page | harness | SAME_WORD | REFUSED | WRONG_WORD | FAIL (incl. GUESSED) |
|---|---|---:|---:|---:|---:|
| b887e5eff | b887e5eff | 105 | 25 | 32 | 64 (32 GUESSED, all controls) |
| 8ea94ac9d | b887e5eff | 66 | 75 | 21 | 51 (30 GUESSED, all controls) |
| 5e97e06fd | b887e5eff | 66 | 75 | 21 | 51 (identical to 8ea) |

The 8ea94ac9d and 5e97e06fd harnesses have no `normalize-numbering` verb, so their pages' payloads were read by the b887e5eff harness instead (`*.own_harness.json` records the refusal). That shows what the merged server does with an older page's payload. It is not what those trees' own servers did.

At b887, every row that records its basis (form-written) passes. All 32 WRONG_WORD cases are on rows without a basis, after a voices flip: rows from b887's migration, rows stored as b887 writes them, and unchanged pre-release rows. The 8ea and 5e9 pages send no numbering at all, and their forms don't record voices. Their 21 WRONG_WORD cases are on the two lines (the enclitic and the echo) where the harness's v1 and v2 cuts give the target the same number, so the harness has no ambiguity to refuse.
