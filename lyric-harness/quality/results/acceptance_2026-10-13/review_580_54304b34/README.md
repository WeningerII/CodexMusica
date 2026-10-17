# #580 merge-only recheck on 54304b342a (BB8, 2026-10-17)

54304b342a merges main d02af47096 (#582 + #579) into 04127afb51, which the verification lane passed (#580 6223058415).

- Own change lines: for each of #580's 17 files, the +/- lines of `diff d02af470..54304b34` equal those of `diff 7e8f69d9..04127afb` (`own_change_lines.txt`, all SAME). The file set is identical.
- Conflict (`mcp/reader_scheduler.js`): #582's `resource_fingerprint` call-through and #580's `reader_scheme: readerScheme` both survive in the job identity (`reader_scheduler_vs_main.diff`). `server_http.js` still passes `readerScheme: await probeReaderSchemeOfWorker()` beside #582's `liveBuildIdentity()` and `readerResourceFingerprint`.
- Boot cost of the new probe (it runs before listen): 0.15-0.18 s locally (`probe_time.txt`).
- Tests on the exact head, with lexical data staged: `npm run test:library` rc 0 (Python 104 OK; node 142 pass, 1 skip, 0 fail; importer and catalog suites OK). `node --test mcp/test_runtime_assets.mjs mcp/test_job_store.mjs mcp/test_connector_http.mjs` 42/42. `map/build.py --check`, eslint and prettier on the changed files: rc 0.
