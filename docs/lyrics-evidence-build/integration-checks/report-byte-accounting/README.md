# Evidence-report byte accounting

Base commit: `31b4140452f7bfb95b39512f1e477c39382c9942`.
CI verify job `116693179024` timed out the unchanged `mcp/test_lexicon_basis.mjs` file at 120.007 seconds after raw continuation (71.108 seconds) and session (41.695 seconds). The deadline is unchanged. No test split, fixture reduction, waiver, grading change, shared reviser optimization, or provider call is included.

## Measured report cost and scoped repair

A local cProfile of the original session's real 12-line song request spent 25.260 of 35.622 instrumented seconds in `schema_instance_evidence.for_grade`; `canonical_json` consumed 23.552 seconds across 766 calls. The byte-budget loop repeatedly walked all admitted records, including when a later candidate was rejected. The separate finish/revise request spent 12.162 of 17.070 instrumented seconds in the actual reviser loop; that path is unchanged. Profiling adds overhead and these are attribution measurements, not service latency claims. See `profile-summary.txt` and per-request events.

The repair caches only the canonical UTF-8 lengths of detached, admitted records. Every candidate still serializes the current envelope with `records: []`, adds the admitted and candidate record lengths plus exact commas, and applies the same strict `> max_bytes - 32768` boundary. Rejected candidates never add to the cache. Method counters, refusals, omission counts, order, all limits, and the final full canonical size guard remain unchanged. `AnalysisSession._record` recursively applies `json_safe`, so stored records cannot change through later method/stream mutations.

## Before/after evidence

The exact unchanged 11-test file ran serially with `--test-concurrency=1 --test-timeout=120000`, staged local assets, and the same lightweight request-timing wrapper:

| Run | Raw continuation | Session | Types | Full file | Margin to 120s |
|---|---:|---:|---:|---:|---:|
| Before | 45.104s | 25.367s | 6.043s | 78.327s | 41.673s |
| After | 60.652s | 25.247s | 7.454s | 95.377s | 24.623s |

Both pass 11/11. The individual real song request changes from 11.540s to 7.698s; the untouched finish request varies from 7.495s to 8.421s. The whole-file run is slower overall, so these samples do **not** establish a whole-file speedup, identify CI contention, or prove that CI is repaired. Exact-head passing CI is still required. No local deadline was raised.

A separate alternating benchmark loads the **actual old module source from the base commit** and the new module into one process, using the same real English phonology stream, 12 repeated fixture lines, declarations, and fixed provenance. Old/new timings are 7.471s/0.471s and 7.194s/1.180s. All four outputs are exactly the same 233,914 canonical UTF-8 bytes with 103 records, SHA-256 `578f62608d091f150c5778953bd7b82b3d3ff434dafa9136dde170c92a9e2ce6`. See `benchmark.py` and `benchmark.log`. This isolates report serialization cost; it does not imply equivalent service-level improvement.

The differential unit tests use the previous full-result serialization as an independent byte-size oracle. They check each trial size and final canonical bytes for real registry instances, Unicode/quotes, exact first and second admission boundaries ±1, zero/exact record limits, candidate exhaustion, refusals, oversized envelopes, a large rejected record followed by small admitted records, and omission counters crossing 9/10 and 99/100. A structural regression requires that only the final guard reserializes admitted records. Restoring the old full-size check makes it fail with traversals `[1, 2, 3, 4, 4]` instead of `[4]`; `old-size-mutant.log` records this intentional negative control. Fixed `from_stream` provenance is deliberate: real `for_grade` provenance includes the implementation source hash, which must change for this repair, so production report identities are expected to change rather than be artificially pinned.

## Reproduction and environment

Node 24.19.0; Python `/workspace/musica-ci-venv/bin/python` (3.12.14); staged data `/workspace/musica-ci/lyric-harness/data`; no mutable fixture or dependency symlinks created. The temporary `deps.mjs` resolution hook locates already-installed MCP dependencies without editing the checkout. Source and test code otherwise run from the repository.

```
export PATH=/workspace/musica-ci-venv/bin:$PATH
export PYTHONHASHSEED=0
export LYRIC_STAGED_DATA=/workspace/musica-ci/lyric-harness/data
export NLTK_DATA=$LYRIC_STAGED_DATA/nltk
export LYRIC_PYTHON=/tmp/lexicon-profile-31b/python-profile
export MUSICA_PROFILE_PREFIX=/tmp/lexicon-profile-31b/optimized
node --import /tmp/lexicon-profile-31b/deps.mjs --test --test-concurrency=1 --test-timeout=120000 mcp/test_lexicon_basis.mjs
python /tmp/lexicon-profile-31b/benchmark.py
python lyric-harness/quality/test_schema_instance_evidence.py -v
# The following gates use the normal Python executable, without instrumentation:
export LYRIC_PYTHON=/workspace/musica-ci-venv/bin/python
python lyric-harness/quality/test_reader.py V1Frozen LegacyReplay
node --import /tmp/lexicon-profile-31b/deps.mjs --test --test-concurrency=1 --test-timeout=120000 mcp/test_lyrics_evidence_binding.mjs
node --test scripts/test_lyrics_evidence.js
```

Copy the receipt's helper files into `/tmp/lexicon-profile-31b` and make the Python wrappers executable to repeat. The before full-file run used the base source; no checkout reset is needed to repeat the isolated old-source benchmark. The cProfile run used `LYRIC_PYTHON=.../python-cprofile`, `MUSICA_PROFILE_IDS=6,7`, and `--test-name-pattern='session: default grade'` with the same 120-second limit; its binary profiles remain in `/tmp/lexicon-profile-31b`.

A rejected `/tmp` two-line session experiment failed the published minimum-12-lines schema (10/11 tests); `two-lines.log` records it. A shorter-text experiment was interrupted and is not acceptance evidence. The initial benchmark used synthetic identical phonology and was interrupted; the retained benchmark uses real English phonology. The interruption returned exit 130 but left its shell running queued gates. Two copies of the reader suite subsequently wrote one log; that mixed log is preserved in `/tmp/lexicon-profile-31b/reader-v1-mixed-discarded.log` and excluded from acceptance. Only the identified test-shell descendant trees were stopped, and the reader suite was restarted in its own process with a unique log. The standalone benchmark output remained separate, though the abandoned job overlapped its execution; its wall and CPU samples establish bounded report cost, not an exclusively scheduled system benchmark. Neither experiment changed tracked fixtures.

Production HTML remains SHA-256 `94dbde6a41896462fc82beeeb52213e26dea6b15bee03e4b11e2656878e3879e`.

## Validation results

- Schema/evidence suite: 12/12 pass in 1.903s (`schema-tests.log`).
- Full unchanged lexicon-basis file: 11/11 before and after, original 120s cap (`timing.log`, `optimized.log`).
- Frozen v1 and legacy replay: 18/18 pass in 279.008s (`reader-v1-clean.log`), clean standalone rerun, exit 0.
- Real authenticated MCP → HTTP → frontend binding: 3/3 pass in 33.224s (`binding-clean.log`), exit 0.
- Frontend evidence: 13/13 pass in 1.374s (`frontend-evidence-clean.log`), exit 0.
- `source-sha256.json` records exact before/after hashes; the lexicon-basis test fixture and production HTML are unchanged.
- `git diff --check` passes.
