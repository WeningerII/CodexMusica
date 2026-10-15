# Release regression follow-up

This follow-up preserves the I8 bundle from `1d1deff91993de7347fddebce6c18d3667c86b48`.
It addresses the two reproduced review findings before release:

- The image inventory did not classify `mcp/test_lyrics_evidence_binding.mjs`.
  The exact inventory callback fails before and passes after its offline-test
  exclusion, including the existing missing-worker COPY mutant. Production
  `mcp/lyrics_evidence_binding.js` remains in the Docker COPY set.
- LegacyReplay previously ran 14 tests with three failures: the new evidence
  field changed frozen legacy output. Both graded and finished output now emit
  instance evidence only for the resolved v2 reader. Frozen v1 fixtures remain
  unchanged. An existing replay test asserts evidence presence for v2 and
  absence for v1, preserving modern evidence while checking legacy shape.

The actual authenticated-binding test and I8 readable-line regression are now
registered in the existing npm CI chains. Browser discovery uses an explicit
CHROMIUM_PATH, an installed PLAYWRIGHT_BROWSERS_PATH browser, or Playwright's
normal default; it no longer depends on this workspace's /tmp executable.
No timeout was increased, suite suppressed, fixture rerecorded, or production
hosting/security configuration changed.

The readability gate passes all eight cases after this runner portability
change. The earlier I8 receipt retains its before/after geometry evidence.
Remote exact-head CI and independent acceptance remain separate release gates.

Validation: LegacyReplay **14/14 pass** (before: three failures), V1Frozen **4/4**,
producer **9/9**, authenticated binding **3/3** with natural process exit,
actual browser transport **8/8**, readability **8/8**, inventory check and its
negative control, full counters, map check, formatting and lint all pass.
HTML SHA256 remains `b05b30fb5e3a75d581ae9d8b463a0819be067cdee497fc33464a10e15256d4d7`.
