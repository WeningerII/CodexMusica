# Runtime acceptance of R2's blocker head `0af39c6f`

**Candidate:** `0af39c6ff3bb9f1c0229bbf7bf14f49816e298e2`. Its code commits are `3e77a5d9` (the zero-anchor default end refuses), `82fe130e` (`N.end` and bare `N` identity) and `0af39c6f` (the `king-` relation, the null scheme and the variants).

**Already committed elsewhere for this head:** the slot gate (`../slot_occurrence_0af39c6f/`), the corpus guard sweep (`../endpoint_guard_0af39c6f/`) and the endpoint check of the 302 unmapped refusals (`../endpoint_unmapped_0af39c6f/`).

**Receipts here:**
- `testers.json` holds each finished tester's result, as returned;
- `repro/<tester>/` holds its scripts, outputs and `COMMANDS.txt`. Scratch paths there read as written.
- **Mutants are stored as diffs**, in `repro/king-relation/e/mut/*.diff`, against `quality/relations.py` at `0af39c6f` (sha256 `e004953f3c6922eb…`). The tester's full mutant copies are left out.

## `king-` relation (tester: PASS)

All 16 checks pass: the five hyphen spellings, the `anguish-` and non-rhyme controls, `king-,` and `king-.`, the brief end to end, the preserved printed-boundary, numeral and fragment refusals, no global G2P, v1 byte identity, a declared reading answering first, `line_anchors` agreement, the corpus, and R2's tests, both pristine and under a behavioural revert.

**Minor findings** (behaviour at `0af39c6f` is correct in the first two):
1. **The stem's fallback policy is not mutation-guarded.** A mutant that reads the stem through a G2P fallback (mutC) passes R2's test, which has no control with an unlisted stem that G2P can read. Production refuses such stems.
2. **"A declared reading of `king-` answers first" is stated but not tested.** A mutant that lets the stem override a declared reading (mutF2) passes R2's test.
3. **A residual v1-to-v2 regression.** Under v2 the judge still refuses a line-final `X-` followed by punctuation, a closing quote, an em dash or an aside, while `line_anchors` reads it. v1 and the base judged these as perfect rhymes. Real corpus witness: Lewis Carroll, `Then the ominous words “It’s a Boo-”`. It is identical at `6955e342`, so `0af39c6f` did not introduce it, but it does not close it either.

**Notes:**
- the corpus denominator in the commit and `LYRICS_RUNTIME.md` (281,069) was not reproduced, though the numerator (13 of 18) was;
- an undeclared v2 brief now prints 3 extra `SCHEMA RELATIONS` disclosure lines for the `king-` pair, with an identical result JSON;
- `_line_read_key` omits `hyphen_continues`. This is theoretical only, since no caller passes `hyphen_continues=False`.

R2's fourth pass (`7c26d40c`) changes this handling: `king-,` is read as `king` and unsplit, with a closing-quote allowance. `8ea94ac9`'s harness tester re-checks all three items there, including whether mutC and mutF2 are now caught.
