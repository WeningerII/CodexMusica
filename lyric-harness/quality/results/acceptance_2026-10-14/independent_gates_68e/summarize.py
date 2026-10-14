from pathlib import Path
import json,re,hashlib
p=Path(__file__).parent;r=json.loads((p/'results.json').read_text())
summary=[]
for x in r:
 s=(p/(x['label']+'.log')).read_text()
 summary.append({**x,'summary_lines':[l for l in s.splitlines() if re.search(r'^(ℹ (tests|pass|fail|skipped)|Ran \d+ tests|\d+ checks passed|.*# SKIP|all revision-loop regressions pass)',l)],'pass_assertions':len(re.findall(r'^  PASS ',s,re.M)) if x['label'].startswith('revise') else None})
(p/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
text='''Independent remaining-gate qualification, 2026-10-14

Executed head: a09703a0eb9581a37b97c8041e8fcc640c7cf2b1.
Qualified carry-forward head: 68e213d0aadf589319bce345b8eebc4b0d0a60f1.

PASS: all four TEST_REVISE_SHARD=k/4 runs, 62/62 sections, no failures.
PASS: complete test:connector:live script, expanded recursively into its 19
repository commands. Commands ran sequentially, continuing after any failure.
All 19 exited 0; no reported skips. Main mcp/test.mjs: 193 checks passed,
including actual local Python and SDK integration (neither dependency skipped).
PASS WITH ONE EXPLICIT SKIP: supplemental MCP reader/Library group, 141 pass,
0 fail, 1 skip. Overall 24/24 commands exited 0, no failed/cancelled commands.
MCP command wall times sum to %.3f seconds. Four revise shards overlapped with
MCP: at most two revise processes plus one MCP command. BLAS threads limited to 1.

Commands, cwd, environment, start time, duration and raw-log SHA256 are retained
in results.json and manifest.json; summary.json extracts test footer counts.
run.py reproduces the expanded workflow. Research assets were staged with
python lyric-harness/quality/fetch_data.py --research; mcp dependencies installed
with npm ci --prefix mcp --ignore-scripts --cache /tmp/acceptance-npm-cache.
No paid provider was called; tests use repository fixture replies/local servers.
Credential-like API key/token environment variables were removed from the runner.
Python/Node/package pins are in versions.json, data/source hashes in input_hashes.json.
Node 24.19.0 differs from CI Node 22; this is local qualification, not exact CI certification.

Corrected head verification:
64,333 Git tree entries identical; exactly two changed test files, no production
change. Full Git blob delta is focused-68e/tree_delta.json, selected SHA256s in
focused-68e/sha256_delta.json. Shipped codex.html SHA256 remains
1c2080a8e4b0108ffd05f3b0ee05aea60e1312212cdcaf95a5e9bd28008e2400.
Existing a097 browser/Library/A2 receipts in independent_a097 carry forward on
this exact tree identity, as do these expensive unchanged revise/MCP runs.
At 68e: Normalisation 11/11 pass; mutant C killed by 2 assertion failures,
F2 by 4, neither with errors; import without argv is harmless. All four commands
exit 0. Wiring reports STRANDED none. Actual AST symbol sweep at 68e exactly
equals all 1,739 complete symbol records at original verified 8ea; a097 differs.
No held counter/comparator pin was altered. Sources/scripts/raw output are in
focused-68e; attribution.py extracts tracked Python sources by git object so
untracked test/evidence files cannot contaminate the comparison.

Qualifications and untested surfaces:
- Supplemental actual-catalog reader interruption/resume was skipped because
  lyric-harness/library/snapshot/manifest.json is absent. No compatible installed
  snapshot was found. This is outside the canonical connector workflow; it was
  not silently counted as passing. No full catalog/corpus was rebuilt.
- test_library_search_parity.mjs and test_library_exports_parity.mjs require the
  historical pinned 317c catalog/export store from library-site.yml. Not run;
  this separate corpus/golden workflow was not rebuilt. test_library_fixtures.mjs
  and test_resume_stopped.mjs are support modules, not standalone test populations
  (the latter also loaded by supplemental node --test, which is not extra coverage).
- test_run_continuation.mjs exited 0 after 442.978s; its split fixture reports
  first batch [2,3,4,5,14,15,17,19,21,23], omitted tail [], and one further
  continuation. Therefore its success does NOT demonstrate re-asking a nonempty
  omitted tail. Exact draft preservation and rejection/unknown-state checks did run.
- No live deployment, release/merge approval, or exact-head CI success is claimed.
  CI 38589261948 was parent-reported pending; it was not certified by this receipt.
- Owner-gated exclusions remain: old/new Library compatibility plus queued-job
  identity/release hold; shared-loop empty replacement validation. No implementation
  or expanded acceptance of those scopes is asserted here. Passing existing fixture
  tests that touch adjacent behavior does not remove these owner gates.

No production code edited, no merge/deploy, inbox comment/closure, or paid calls.
Only evidence branch publication; no evidence PR opened.
''' % sum(x['duration_seconds'] for x in r if x['label'].startswith('mcp'))
text+='\nPer-command seconds / exit:\n'+''.join('%s: %.3f s, exit %d\n'%(x['label'],x['duration_seconds'],x['exit_code']) for x in r)
(p/'REPORT.txt').write_text(text)
(p/'COMMANDS.txt').write_text('python3 /workspace/acceptance-gates/run.py\npython3 /workspace/acceptance-gates/focused-68e/run.py\n/workspace/acceptance-venv/bin/python /workspace/acceptance-gates/focused-68e/attribution.py\n/workspace/acceptance-venv/bin/python lyric-harness/lyric_harness.py wiring\npython3 /workspace/acceptance-gates/summarize.py\n\nExact expanded commands are in manifest.json/results.json. Focused commands and timings are in focused-68e/results.json.\n')
(p/'SHA256SUMS').write_text(''.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+str(f.relative_to(p))+'\n' for f in sorted(p.rglob('*')) if f.is_file() and f.name!='SHA256SUMS'))
