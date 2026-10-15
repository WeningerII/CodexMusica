# Warm worker resident memory, both reader schemes, 2026-10-13

**Test-process isolation, not a production capacity bound.** These numbers
come from one fresh process serving three requests. A long-lived worker that
serves many requests can hold more than this, so nothing here bounds one. No
threshold, guard or constant was changed or added, and nothing here passes or
fails.

## What was asked

From 3PO (#519, 6155500208): measure the warm worker's peak resident memory
while one process holds the v1 and v2 lexicons (the new dual-scheme cache)
and a Library analysis, and say so if the peak approaches the Library guard.
Do not raise the guard.

## Method

    python3 quality/results/warm_worker_rss_2026-10-13/measure.py

Run from `lyric-harness/`. The script refuses to start if
`LIBRARY_READER_MAX_RSS_MIB` is set, so the guard stays at its shipped 1 GiB.

One process loads `mcp/worker.py` and runs these steps in order:

1. A new lyrics request through `run_one`, read under reader scheme v2.
2. A legacy one, read under v1: a deferred state written by the pre-batch
   harness, from `fixtures/reader_v1_defer_states.json`.
3. A Library analysis through `run_reader`: the two lines that
   `quality/test_reader.py` WarmWorker analyses, carrying their three
   v1-bound Gutenberg declarations. The analysis rebinds them under v2.
4. A second Library analysis: the largest verse unit of the same book
   (`imports/gutenberg-next-ten/69378/candidates.json`, unit `line02115`,
   100 lines), with the 52 declared rows that fall on its lines.

After each step the script records VmRSS and VmHWM (the peak) from
`/proc/self/status`. The analyses acknowledge every checkpoint frame the way
the Node adapter does: the frame's records go to a content-addressed page on
disk, and the ack names that page, so later steps can resume from it. The fake
parent keeps only the frame it is about to acknowledge.

A first draft of the script kept every frame in an in-memory buffer. That
charged the parent's buffer to the worker and recorded a spurious 1.09 GB
peak, and the large analysis then ran out its lease. That draft is not a
result and is not committed.

## Results

At commit `8d43e5be915a0e5b4581583be0a4880b9666ead4` (the reader batch,
local), with this directory's script added on top; the commit that adds the
directory changes nothing the worker runs. `cmudict.dict` sha256 `81917843…3c22`. The receipts are
`receipt_cpython3.13.16.json` and `receipt_cpython3.11.17.json`. CI pins
3.11.16; 3.11.17 is the closest interpreter available on this machine, so
this is not a CI result.

| step | 3.13.16 RSS | 3.13.16 peak | 3.11.17 RSS | 3.11.17 peak |
|---|---:|---:|---:|---:|
| worker loaded | 25.3 MB | 25.3 MB | 24.8 MB | 24.8 MB |
| new lyrics request (v2) | 431.3 MB | 431.3 MB | 454.7 MB | 454.7 MB |
| legacy lyrics request (v1) | 455.9 MB | 507.4 MB | 484.7 MB | 539.4 MB |
| Library analysis, 2 lines (complete) | 462.9 MB | 507.4 MB | 495.0 MB | 539.4 MB |
| Library analysis, 100 lines (complete, 3,307 / 3,308 frames) | 461.6 MB | 507.4 MB | 493.0 MB | 539.4 MB |

**Peak: 507,371,520 bytes (3.13.16) and 539,365,376 bytes (3.11.17).** That
is 47.3% and 50.2% of the 1 GiB guard (1,073,741,824 bytes). The guard did
not trip.

The peak occurs during the legacy (v1) lyrics request, after the v2 request.
Neither Library analysis raised it.

Caches holding a lexicon after the last step:

- `eng._LEX`: v1 and v2.
- `meter_bands._READERS`: `fallback-low` under v1 and under v2.
- `fit._LEX`: v1 only.

## Isolated test children (the same session)

`quality/test_reader.py` WarmWorker runs each complete sequential scenario in
a child process of its own, with the unchanged 1 GiB guard active and
consulted (1,692 guard checks per child), and prints each child's peak.

| scenario | 3.13.16 | 3.11.17 |
|---|---:|---:|
| legacy lyrics request, then Library analysis | 547.8 MB | 587.8 MB |
| new lyrics request, then legacy one, then Library analysis | 608.8 MB | 651.6 MB |
| new lyrics request, then Library analysis | 548.2 MB | 588.0 MB |

These peaks are higher than the measurement above because the child is a
unittest process, and it builds extra lexicons to check every cache
(`_caches_agree`).
