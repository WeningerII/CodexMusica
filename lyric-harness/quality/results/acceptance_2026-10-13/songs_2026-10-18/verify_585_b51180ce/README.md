# BB8's re-check of PR #585 (edit-boundary brief) at b51180cef (2026-10-18)

R2's new head adds one commit on 6a969eff: every sentence that was already true stays
byte-identical, and only the false ones change. Checked against main (c110fe24) and the previous
head.

## Real drafts through `lyric_harness.py revise DRAFT AABBCCDD --propose=defer:STATE`

| Draft | What it is | Exit code (main / PR) | Stdout difference, main → PR |
|---|---|---|---|
| `d0.txt` | the straddle test's draft | 4 / 4 | the block row only: "L3 — the grader found nothing on them" → "L1, L2, L3, L4, L6, L8 — outside this question, whatever the grader found on them", under both batch members |
| `d1.txt` | d0 with Jony's L5 | 4 / 4 | the same block row, for a single-line question on L7: L3 → L1–L6, L8 |
| `d2.txt` | d0 with Jony's L5 and L7 | 0 / 0 | none (byte-identical) |
| `d3.txt` | d0 with L2 rewritten | 4 / 4 | the same block row as d0 |

- **d0 on b51180cef vs 6a969eff:** identical. The straddle case's answer didn't move.
- **The `*.revise.out` files:** normalised stdout (paths replaced, checkpoint lines removed).

## The block row for each case, called directly

`probe.py` uses the same brief helper `quality/test_propose.py` uses, run from `lyric-harness/`.
The outputs are in `probe_main.out` and `probe_585.out`.

| Case | Main | PR |
|---|---|---|
| a. single line, every other line clean | "…found nothing on them" | **byte-identical** |
| b. single line, some protected lines noted | lists L3 only (false) | lists every line outside the question |
| c. single line, no clean line | parenthetical | **byte-identical** |
| d. batch, every other line clean | "…found nothing on them" | **byte-identical** |
| e. return group (L2, L6), no clean line | parenthetical | **byte-identical** (see note 1) |
| f. return group, every other line clean | "…found nothing on them" | **byte-identical** |
| g. batch covering all 8 lines | parenthetical | **byte-identical** (see note 2) |

R2's three rules hold in every case above.

## Tests on b51180cef (my run)

- `quality/test_reader.py`: 105 tests OK (6 skipped).
- `quality/test_propose.py`: exit 0, "all propose regressions pass".

## Notes (not blocking)

1. **Case e.** In test 7f, the return-group fixture moved from `keep=[]` to `keep=[4]`. With
   `keep=[]`, the return group reaches the old parenthetical: "you are still only asked for this
   one", and the protected lines L1, L3–L5, L7 and L8 aren't named. The row right under it does
   name the targets ("applies your one answer to L2, L6"), so it is arguably true. Main prints the
   same thing. The test comment should say why the fixture moved, so the case stays visible.
2. **Case g.** A batch that covers every line gets the parenthetical's "this one". This is R2's
   logged follow-up.
3. **Still open, as before:** the batch members' "The tool applies your one answer to L5" wording.
