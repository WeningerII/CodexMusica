# #574 at `3cc82de2` (re-land of #570 + #571 on the release): PASS, 2026-10-16, 02:07–02:38 UTC

**Content.** `git diff 6eaa8e4c 3cc82de2 -- . ':!lyric-harness/map/files.md'` is **byte-identical** to `git diff 5d922d8d 822fd505` (the same scope), which is the exact reverse of #573's two reverts. So #574 re-lands exactly the #570 (`47e8d342`) and #571 (`704fe5f0`) code qualified in `../review_570_47e8d342/` and `../review_571_704fe5f0/`. The head is based on main `6eaa8e4c` (the release, with #569). `f90d0707e` was not available in the shared repository to compare against.

**Composition with the redesign:**

| Check | Result |
|---|---|
| `map/build.py --check` | current |
| `check_comparator_pin` | HOLDS (`51316f79…`) |
| `probes/blank_guard/blank_probe.py`, `edge_probe.py` | OK and OK: the #570 letter-or-numeral rule holds on top of #569 |
| #571 no-behaviour-change | `revise` CLI on the four-line `AAAA` draft: stdout **identical** to main `6eaa8e4c` once only the state path and `scorer` are normalised. State files differ only at `.cursor.scorer`. Wall time 31 s against 41 s, with the CPUs shared with another run. |
| `test_relations` | all pass |
| `test_reader` LegacyReplay + V1Frozen | OK |
| `test_revise` | all pass (829 s) |
| `test_loop` | all pass (614 s) |

Not covered: CI, the MCP first-request comparison (done at `704fe5f0` on the pre-redesign base), and concurrent callers.
