# #571 (revise speed fix) at `704fe5f0`, 2026-10-15, 20:43–21:24 UTC

**Heads:** most runs were at `f6add79a`. **`704fe5f0` differs from it only by one line in `lyric-harness/map/files.md`** (notes count 132 → 130), so the code results carry over. The map check and `test_revise` were rerun on a clean checkout of `704fe5f0`. The base is main `f4b84158`. Runs used CPython 3.11 and node v22 on this 4-vCPU container, and the timed runs were sequential.

| Claim | Result |
|---|---|
| No behaviour change, CLI | `revise` on R2's four-line `AAAA` draft (`--lexicon-supplement=v2 … --relation=class:RHYME --attempts=1 --backtrack=0`): **stdout byte-identical** to main after normalising only the state-file path and `scorer` (a digest of source bytes, `9203…` vs `c749…`). State files differ **only** at `.cursor.scorer`. Two runs of each head are byte-identical. |
| No behaviour change, MCP | `first_request.mjs` with `DUMP`: both content blocks are **identical** to main after normalising only the per-run `run_…` id, `ms` and the sealed `state`. Two runs of main differ by exactly the same fields. |
| Fingerprint unmoved | `comparator_fingerprint()` = `51316f79c509…` at both heads; `check_comparator_pin.py` HOLDS at both. |
| Tests | `quality/test_relations.py`: all pass. `quality/test_revise.py` at `704fe5f0`: all 62 sections pass (771 s). |
| Map | `python3 map/build.py --check` on a clean `704fe5f0` checkout: current. At `f6add79a` it was stale, as reported. |

**Speed, measured on this container (not a CI or live margin):**

| Path | main | #571 |
|---|---|---|
| CLI, wall | 39.1 s, 38.8 s | 28.6 s, 27.4 s |
| MCP first request | 35.8 s, 36.4 s | 27.7 s, 27.1 s |

That's about 25–30% less wall time here. R2's receipt reports 48 s → 36 s on its container. The absolute numbers differ between containers; the direction agrees.

**Process note:** a first `test_revise` run at `f6add79a` hit my own 1500 s `timeout`, because I paused it for 14 min during a release check and the timeout kept counting. It had 332 passes and 0 failures when it was cut off. The clean rerun above replaces it.

**Not covered:**
- CI;
- concurrent callers (the receipt states its memos assume serialized use);
- any song other than this draft.
