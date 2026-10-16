# #578 at f4b11658a7: partial independent measurement, handed over (BB8, 2026-10-16)

**Not a verdict.** I stopped at 15:45 UTC when the coordinator assigned #578 to the
BB8 verification lane (session_01GtHqKEo6293oC3CypcR8WQ). This folder is what I had
by then, given to the lane to check on its own and use however it likes. Base is
34dd4c1fb4; the head is f4b11658a795ad004b5af7ab54946d293233c542.

## What was measured

`drive2.py` runs one warm `mcp/worker.py` per run, from cwd `lyric-harness`, like
the bridge. It sends the same 8 requests that
`scripts/measure_verb_memory.py --worker --rounds=3` sends: plan, fill, then grade
and finish 3 times on the instrument's own filler draft. After every reply it sends
one unreadable request (a "ping") that the worker answers without running anything.
The ping only returns once the worker is back at stdin, so:

- the ping's turnaround is how long the worker stayed busy after its reply. On the
  head, that is `release_heap()`.
- the RSS read at the ping's reply is the RSS the next request starts from.

Setup: Python 3.13.16 on a 4-CPU container. Base and head ran as a concurrent pair,
3 repetitions on cell 24/20260910. The 24/20260908 cell and the back-to-back
(no-ping) timing runs were stopped before they finished, so neither is reported.

## Results (`SUMMARY.md`; per-run digests in `runs_digest.json`)

- **RSS carried between requests is lower on the head.**
  - After the first revise: 585 → 467 MiB (−117).
  - Requests 5–8: −38 to −43 MiB.
  - Plan and fill: about −22 MiB.
- **Whole-sequence peak is unchanged locally.** ru_maxrss was 587/588/594 MiB on
  base and 590/588/588 MiB on the head.
- **The base call-5 climb did not happen locally in 3 of 3 runs.** On both trees the
  peak was set inside the first revise, and a trim after the reply can't lower that.
  This matches the author's own correction, which says the climb doesn't reproduce
  reliably.
- **Cleanup cost:** head p50 0.414 s, p95 2.05 s, max 2.11 s (n=24); base ping
  0.000 s. By verb, p50: plan 0.025, fill 0.026, grade 0.363, revise 1.266 s.
  - This is higher than the author's 0.27 s p50, but the pairs ran concurrently.
  - I have not reproduced the +2–3% turnaround figure; those runs were stopped.
- **Output equality.** Each run was compared with base r1: every frame of all 8
  requests and the 3 written defer states. All 5 comparisons are equal after
  replacing the driver's temp directory and normalising `finish_bp_XXXXXXXX.json`.
  - Without the `finish_bp` normalisation, exactly the 3 revise requests differ.
  - They differ the same way between two base runs.
  - Frame shapes (event kinds and lengths) are equal without any normalisation.

## CI (`ci_upper_cell.md`)

The "cells upper" job, 24/20260910 worker:

| run | tree | result | peak after call 4 (revise) | peak after call 5 (grade) | Node + Python peak |
|---|---|---|---|---|---|
| 38867915283 | base | failed: "excessive resident-memory peak" | 627.0 MiB | 702.6 MiB | 1,910,575,104 B |
| 38915406585 | head | passed | 628.0 MiB | 628.0 MiB | 1,753,735,168 B |

That is one sample on each side. At about 15:40 UTC, run 38915406585 had passed every job
except qualification-mutation-11, which was still running. Run 38915419168 was
queued with no jobs started.

## Paths

- **Cold path.** `mcp/python_bridge.js:588` spawns `lyric_harness.py` directly, so
  `worker.py` and `release_heap()` are never loaded on the cold path. The other
  callers of worker.py are `measure_verb_memory.py` and `mcp/test.mjs`; both spawn
  it as a separate process.
- **Non-glibc** (`nonglibc/probe.txt`). Two cases, each run in a real worker process
  serving two requests:
  - A libc-less shared library: built with `-nostdlib`, with no NEEDED entries and no
    `malloc_trim`, and returned by `find_library`. This stands in for macOS and any
    other libc without the symbol. It takes the `AttributeError` branch.
  - A Windows-shaped failure: `find_library` returns None and `CDLL("libc.so.6")`
    raises an `OSError` subclass. It takes the `OSError` branch.

  In both cases `_malloc_trim` is None, `gc.collect()` still runs once per
  `release_heap()`, and the worker serves both requests with exit 0. On real glibc,
  `_malloc_trim` resolves. The production image is `node:22…-bookworm-slim` with
  Debian's python3 (glibc), so production takes the trim path.
- **Bridge.** After a reply the worker stays busy for up to about 2 s, and the
  bridge's next request waits behind that in stdin. That wait counts against the next
  request's deadline (at most 605 s), and termination is SIGKILL, so cleanup cannot
  delay a kill.
- **Weak references.** The only weakref in the harness is
  `quality/field_store.py:450`. Its target is also held strongly by
  `rhyme_field._cache`, so an explicit collection cannot drop it.

## Test

- `python3 scripts/test_lyrics_capacity.py` on the head: 35 tests OK.
- The new
  `CapacitySourceIdentity.test_a_worker_only_change_changes_the_capacity_identity`,
  run against base's `check_lyrics_capacity.py`, fails with
  `'mcp/worker.py' not found` (`nonglibc/base_new_test.txt`). So it tests the change.

## Not done

- Back-to-back turnaround (the +2–3% claim).
- The 24/20260908 cell.
- A Python 3.11 pair. Production and CI use 3.11; only the CI run covers it here.
- Run 38915419168.
