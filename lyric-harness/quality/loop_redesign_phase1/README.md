# Phase 1 measurement scripts for the revise-loop redesign

These are the scratch scripts behind the Phase 1 figures in
`quality/LOOP_REDESIGN.md`. They are kept so every figure there can be run
again. **None of them produced or delivered a song** (standing rule 3).
`drive.py` answers the loop's questions mechanically, and only to measure what
a continuation costs.

Each script has its working directory hard-coded as `S=` (or `S` in Python),
the session scratch directory it was written in. Change that line to a
directory of your own before running it.

All of them need the staged runtime:

- `cmudict.dict`;
- the wheels in `mcp/requirements-runtime.txt`;
- `quality/fetch_data.py`.

| script | what it measures |
|---|---|
| `mkdraft.py SEED N OUT` | builds an N-line fixture draft the way `mcp/test.mjs`'s live block does (`plan --seed --lines`, the fixture line bank, declared returns honoured) |
| `grade.sh N` | plan, fill, then one `song` grade of the N-line fixture draft; logs wall time and report bytes |
| `run.sh TAG STATE -- ARGS…` | runs one `lyric_harness.py` command; logs exit code, wall time, output bytes, state bytes |
| `drive.py N CALLS TAG [FLAGS…]` | drives a deferred run call by call (set `PASTE=1` for the pasted couplet drafts `cp{N}.txt`); logs per call: wall time, state bytes, question bytes, answers on record, what was asked |
| `repro_kill.mjs` | defect 3 through the real session layer. Copy it into `mcp/` to run, because it imports the connector by relative path: `REPRO_DIR=$(mktemp -d) node repro_kill.mjs open`, then `CHAT_TOOL_TIMEOUT_MS=12000 node repro_kill.mjs kill` |
| `repro_folded.mjs` | defect 2's connector rendering: feeds the two AABB states to `foldedOf`. Copy it into `mcp/` to run. |
