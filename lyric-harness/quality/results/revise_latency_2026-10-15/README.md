# lyric_revise first-request latency — 2026-10-15

The request: the original high-report test 8 draft (four lines, scheme `AAAA`,
`relation=class:RHYME`, `backtrack=0`), whose first `lyric_revise` call
suspends on L2 with three violating members (tonight / rain / us) and **no
joint candidate**. The committed test 8 now uses a two-line fixture
(`docs/revise-interface-fixture-2026-10-14.md`); this folder is about the
original four-line workload, which the smaller fixture no longer exercises.

No timeout, assertion, grading rule, comparator or data file was changed.
`lyric_harness.py` and `quality/features.py` are untouched, and
`comparator_fingerprint()` is `51316f79…` before and after.

## Where the time went (main `b887e5ef`, cold worker)

Python 3.11.16, the connector's argv
(`--lexicon-supplement=v2 --lexicon-supplement-sha256=… revise <draft> AAAA
--relation=class:RHYME --propose=defer:<state> --attempts=1 --backtrack=0`).
CPU seconds, non-profiled accumulators around each function:

| stage | CPU s |
|---|---:|
| whole request | 43.6 |
| `Reviser._place_field` (one slot's field) | 38.0 |
| `joint_field_screened` (4 calls) | 29.9 |
| `_end_pair_schemas` (4,833 calls; 178,821 `pair_satisfies`) | 16.1 |
| `_rank_field` (incl. 6 full-index `candidates` scans, 3 of them repeats) | 13.8 |
| `Lexicon.__init__` (5 builds, cold start only) | 4.6 |

No word answers all three calls, so the joint screen walks every
schema-only candidate and asks every registry schema of a two-line carrier
stream for each one. Warm-worker context, one process: the same request
again 3.5 s; a different four-line song that does find joint words 16 s.

## The change (`quality/revise.py`, `quality/relations.py`, `quality/phonology/eng.py`)

1. `_engine_candidates` — inside one `_place_field` (`_field_scope`), a call
   word's full ranking is computed once; a shallower request is served as a
   slice of a deeper one (the ranking is sorted, each row depends only on
   its own score).
2. `English.syllabify` remembers words inside `_reading_scope` (opened by
   `_field_scope`) — the joint field re-read the same carrier words ~80,000
   times. Outside a scope nothing is remembered: a standing memo failed
   `test_relations.py`'s patched-transcriber check, which is why the memo is
   scoped.
3. `_spelled_rimes` — `_decl_lex_key` built once per ranking batch instead
   of ~100,000 times; the same `_RIME_MEMO` is read.
4. `pair_satisfies` reads a frozen schema's capabilities and placement-free
   copy once per schema object.

## Measurements (this container, 4 vCPU, sequential, nothing else running)

| | main `b887e5ef` | this change |
|---|---|---|
| CLI, cold process (wall s) | 48.0, 48.0 | 36.5, 36.5, 35.9 |
| MCP SDK in-memory transport, cold worker (first request s) | 49.3, 51.3, 50.3 | 39.2, 39.6 |

Byte equality: CLI stdout and the saved state file are identical to main
except the state-file path and the `scorer` identity hash (a digest of
source bytes). Through MCP the song text block is identical and every
verdict field matches except `ms` and the sealed `state` token, which also
differ between two runs of main.

The slower CI runner measured ~1.25x this container on the same request
(`high_report_timeout_2026-10-14/`), so the change is expected near 45 s
against the unchanged 60 s deadline: real headroom, not a 2x margin.

## Not done, and why

- Memoising `syllabify` / `split_phone` in `lyric_harness.py` is
  byte-identical but moves `comparator_fingerprint()` (`51316f79` ->
  `00aa9927`, measured), which discards the predictability memo — an owner
  decision (`lyric-harness/CLAUDE.md`, standing rule 4).
- An exact pre-filter that would let the joint screen skip candidates no
  schema can bind needs a per-schema necessary condition; not attempted.

## Reproduce

From the repository root, with the harness staged:

    LYRIC_PYTHON=python3 node lyric-harness/quality/results/revise_latency_2026-10-15/first_request.mjs
