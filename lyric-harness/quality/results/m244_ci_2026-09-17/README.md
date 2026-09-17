# M-244 CI follow-up, 2026-09-17

Starting base: `fe9181f7319869ea44a7a1540b95b495705d3b81`. Integrated #330 from `95c80efb2adb9198cf74630f106733f910721f53`; counters are regenerated from the combined tree, not selected from either branch.

The current baseline is [PR #327 CI run 2081](https://github.com/WeningerII/CodexMusica/actions/runs/35247512389), head `826e0eda`, not the September 5 runs retained historically in MISSING.md. `baseline-ci.json` contains the public Actions API job identities, start/completion times and conclusions. `baseline-verify-leaves.txt` preserves the verify log's elapsed leaf costs. The 25.9-minute wall includes queueing; sums of overlapping leaf elapsed times are not CPU measurements.

This change preserves all existing assertions and randomized replicates. The panel's sections are dealt through `quality/shard.py` within the existing three suites runners, retaining the original list index for every other suite. The observation cache lives for one `sweep` call and includes the statistic tuple because derived-only null menus can differ. No comparator input changed; no calibration or repin is owed while `check_comparator_pin.py` reports HOLDS.

The artifact cache admits only the exact conservative source closure, build invocation and Node runtime, with an exact hashed artifact inventory. The normal source/output comparison and fault injections still run; schedules build cold. A cache is saved only after comparison. A restored corrupt exact cache triggers a rebuild and cannot be overwritten under that immutable Actions cache key; it may cause another cold build, never a false pass.

## Reproduction and controls

From `lyric-harness`, run:

- `python3 quality/test_shard.py` — actual CI pool shell, exact coverage and planted child failure.
- `python3 quality/test_null_shapes.py` — sweep versus independent arm equality and refusal behavior.
- `PYTHONPATH=. python3 quality/results/m244_ci_2026-09-17/observation-control-command.py` — the new regression passes; replacing only sweep with the base implementation fails exactly the two duplicate-observation checks. Equality and replicate controls continue to pass in the old arm.
- `TEST_RELATIONS_NULL_SHARD=1/3 python3 quality/test_relations_null.py`, repeated for 2/3 and 3/3 — the full panel test population.
- `python3 quality/check_comparator_pin.py` — fingerprint verification after staging CMUdict through the repository fetcher.

At repository root, `npm run check:closure` runs the traced closure gate plus the new cache counterexamples. `scripts/test_artifact_build_cache.js` checks positive admission and invalidation for changed, new, deleted or symlink inputs; a changed runtime; input movement during a build; missing, extra, corrupt or symlink artifact files; and a truncated receipt.

The cold local build uses `node scripts/build_static_api.js --jobs=4` and `node scripts/build_html.js --quiet`, each with an explicit output outside the repository, then the ordinary freshness checker and cache recorder with the key captured **before** the build. CI retains its existing default worker count. Node is 24.19.0 locally; CI uses Node 22. Local times are not hosted performance claims.

## Incomplete attempts are not passes

`relations-null-baseline.json` is the established `suite_sweep.py --only 'test_relations_null.py' --json` instrument's **CANNOT RUN** result at its 1,200-second bound, exit 2. Its head-at-start/end fields track commits only: this checkout had an instrumented test runner and ongoing unstaged edits. The child loaded the original base sweep before the optimization was edited. No speed ratio is derived from this bounded attempt. A redundant instrumented baseline was stopped with exit 130; its partial output is retained in `relations-null-sections.txt`.

At about 17:40 UTC the local runner lost the active session handles for the first full build, panel shards and counter work. None had a completion receipt. Those incomplete runs are not counted as passing, and the required work was restarted. The first full-build attempt also predated the final expected-key recorder argument and cannot prove that lifecycle. Earlier development controls included an empty positive fixture and a spy installed in the wrong module namespace; both were corrected before the committed successful control receipt. An initial suite selector without `.py` matched nothing and is not verification.

## Coordination and limits

Open #328 and #329 touch battery/pivot work, with no comparator or implementation overlap here. Newly opened #332 owns the capacity placement decision and touches other portions of CI and shared records; preserve it on integration and regenerate counters. #330 adds a missing-entry record, which also requires regenerated counters on the combined tree. #331 and #333 are separate mutation/doctrine work.

M-244 remains PARTIAL: persistent floor field reuse and safe site-only harness scoping are unbuilt. The historical field profile is not a measurement of today's bottleneck. Queue time and the capacity floor seen in the baseline prevent claiming a ten-minute wall. This PR does not own or duplicate #332's placement change. The PR records actual hosted cold/warm observations and the verified final head/base; no hosted warm cache hit is inferred from a local unit test.

The evidence control runner has an explicit `__main__` entry point. The first counter pass correctly reported its initially missing entry point as one stranded module; the corrected runner is included in the final regeneration. The counter check interrupted for #330 integration is not counted as a passing final check.

## Completed local verification

All three final panel partitions exited 0: 36 + 33 + 42 = **111 checks**, covering all 17 sections. Their measured elapsed times were 1177.424, 320.884 and 2.449 seconds; the concurrent three-process wall was 1177.460 seconds. The longest section was `s1_partition` at 1159.9 seconds. These runs shared the host with a four-worker artifact build and other work. The bounded old baseline is inconclusive, so this is **not** a before/after speedup estimate. Raw outputs and timing JSON are retained as `relations-null-final-*` and `relations-null-final.json` in this directory.

`record-final.txt` records successful counter regeneration/check and all seven other record gates on the #330 combined tree. `node-gates.txt` records successful lint, formatting, documentation, closure/cache controls and promise checks. The focused shard, null-shape, observation and cache counterexamples also completed successfully. The independent local full artifact build was still running at initial publication; it is not claimed as a pass. The published-head CI freshness job owns the full cold-build proof and its targeted rerun will test hosted cache admission.

The record and shard command transcripts have trailing whitespace removed; command output and exit results are otherwise retained.

## Integration of M-282

Integrated #332 at `d2541f449fa5209bf55e7b9b22ce8ac9a436aecc` after its merge. Its capacity-matrix placement and deployment requirement are preserved. The old capacity job is no longer a PR-CI floor; the overall target still needs measurement on this combined workflow. The earlier statements about unbuilt placement and the baseline's floor describe their dated trees, not this integration.

The full local artifact build completed after initial publication and **before** this workflow integration: all 2588 traditions (0 failures), all 1467 instruments, the HTML build, all 4060 API files and four discovery files passed comparison. The recorder accepted the key captured before building and recorded 4061 API/HTML files. `artifact-cold-final.txt` preserves the commands' output and exit 0. The API builder measured 1676.8 seconds on the loaded local host. Exact admission and a repeated freshness comparison then passed in 0.625 and 0.739 seconds respectively; their receipt is `artifact-warm-local.txt` and its timing JSON. These are local measurements, not hosted speedup claims, and do not include fault tests in that warm timing.

The build key includes the workflow, so #332 invalidates that old receipt even though the artifact builders themselves did not change. The combined head must rebuild cold in CI before its new receipt can be reused. `integration-record.txt` and `integration-controls.txt` record the combined-tree verification; the final published head still owns its GitHub CI results.

`initial-ci-panel.json` is the Actions API metadata for the first published head's successful suites shard 1: 18:06:53–18:16:21 UTC, **568 seconds**. `initial-ci-panel-excerpt.txt` keeps the exact section-cost lines: the longest panel section measured **417.0 seconds**, and that partition passed 36 checks. Timestamped log lines are buffered flush times; SECTION COST is the elapsed measurement. The baseline suites job was 984 seconds, but these runs have different loads and no controlled speed ratio is claimed. This individual job success is not a claim that the entire initial workflow completed successfully, nor proof for the later integrated head.
