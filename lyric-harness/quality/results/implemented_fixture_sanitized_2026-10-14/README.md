# Sanitized implemented-fixture results

Existing local results, sanitized without rerunning tests. The detailed diagnostic line was removed in full from each log; no host, cgroup or process metadata is included. Raw logs remain local. These files are sanitized results, not raw logs.

The focused test passed; the full high-report file passed 10/10. The separate JSON records only test commands, source/commit identity and wall timings. Both runs preceded publication and the final one-line documentation-link comment edit; they are not literal executions of the final commit. Replacing that comment alone yields the published test source exactly; no executable test content changed. Both source hashes are retained.

Exact-head CI for `88fa63a81d8e88e5797780a50a57f0087c24d3bd` subsequently passed on attempt 1: 45 jobs successful, three skipped, zero failures. Its high-report file passed 10/10; the substantive request took 16.184 seconds with 43.816 seconds remaining under the unchanged 60-second deadline. See [the completed public CI run](https://github.com/WeningerII/CodexMusica/actions/runs/38641921790).

The fixture change and its disclosed multi-violation coverage reduction are documented in the repair commit. This receipt makes no production latency or live-service acceptance claim. `artifact_hashes.json` covers every file except itself.
