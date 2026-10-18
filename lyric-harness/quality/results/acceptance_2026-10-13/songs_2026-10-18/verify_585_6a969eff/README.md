# BB8's check of PR #585 (edit-boundary brief) @ 6a969eff1 (2026-10-18)

**Input.** The straddle test's own draft (`straddle_draft.txt`; sha256 0e7d45953f7f1f25…, the same
as the live pre-deploy run). Scheme AABBCCDD, run through the connector's pasted-song argv:
`lyric_harness.py revise DRAFT AABBCCDD --propose=defer:STATE`, on main (c110fe24) and on the PR.
Both stop at exit 4 with the same batch question for L5 and L7.

**Result:**
- **"LINES THAT MUST NOT CHANGE", main:** "L3 — the grader found nothing on them", for both batch
  members. This is the incomplete boundary the live straddle test showed.
- **The same block on the PR:** "L1, L2, L3, L4, L6, L8 — outside this question, whatever the
  grader found on them", for both members. That's every line except L5 and L7.
- **Every other output line:** identical. The two block rows above are the only stdout difference.
- **Saved run state:** only `cursor.scorer` differs, because any code change moves it, and so does
  `pending.prompt`, the brief text itself. The stored slot `keep` is `[3]` on both, so the fix
  derives the boundary at render time and leaves stored state alone, as described.

**Not in scope, noted:** each batch member's brief still says "The tool applies your one answer to
L5" and "ONE line back", although the question is a batch answered with `answers` for L5 and L7.
This is a separate guidance item.
