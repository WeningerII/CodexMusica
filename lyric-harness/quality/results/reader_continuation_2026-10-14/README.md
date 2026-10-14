# Reader repair continuation — 2026-10-14

Continuation of the accepted P1–P8 repairs from
`8ea94ac9d5141eb5062a8094351a9330f4edc38c`. The remote
`claude/reader-batch-2026-10-13` head was checked before work and still named
that commit. Work used an isolated continuation branch; the original clean
checkout and R2's branch were preserved. Inbox PRs #519 and #527 were read,
not merged or closed.

## Scope and evidence

- P1: member-wise selection mapping avoids the old 250,000-pair fallback;
  other large stretches use linear-space alignment. The baseline reproduces
  `[29,34]` becoming `[1396,1396]` at 124 groups. Tests also cover 123 and
  1,000 groups, with first and last unchanged members.
- P2: appending a migration preserves the same draft's legacy `more` count.
  The regression imports retained entries plus seven previously lost entries
  and verifies that the warning survives another append.
- P3: documentation distinguishes bare `N` from explicit `N.line`. Their
  shared exemption from word-offset migration does not equate their judges.
- P4: historical comparison descriptions now identify normalized serialized
  records, distinguish direct-probe refusal from unchanged output, remove
  absent run logs, and correct the comparison script hash.
- P5/P6: real mouse, keyboard, dock, and narrow-layout migration checks cover
  selection preservation and sung-line boundaries. See final validation
  results for execution status.
- P7: `p7_commands.txt`, the focused test logs, and `p7_mutations.py` record
  passing fallback/declared-reading controls and assertion failures for BB8's
  C and F2 mutants. Only tests changed; fallback and grading policy did not.
- P8: accumulated text-import logs, permanent Dismiss, and native browser
  Undo are not newly promised-contract blockers. Library cross-draft
  overwrite remains covered separately. Empty mount is documentation only:
  startup content is restored by `uiRestoreSession`. `boo_quote_probe.py`
  and its JSON receipt distinguish the historical quoted Boo witness and
  aside-stripped versus voices modes, within their stated module-probe scope.

All writer replies in page tests are local fixtures. No provider calls or
live-service acceptance are claimed.

## Reproduction

Use the repository's Python runtime and lexical assets. The browser run here
used installed Chromium 151.0.7922.173 through Playwright; the browser binary
was not the Playwright-downloaded revision.

```sh
git show 8ea94ac9d5141eb5062a8094351a9330f4edc38c:src/pages/lyrics.js > /tmp/reader-before.js
node scripts/check_lyrics_page.js --unit-only --unit-source=/tmp/reader-before.js
node scripts/check_lyrics_page.js --unit-only
node scripts/check_lyrics_page.js
node --test scripts/test_library_import.js scripts/test_library_chunk_generations.js
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/test_library_import_browser.js
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/test_library_import_shipped.js
```

The first command pair intentionally produces six failing assertions against
the baseline source (`page_before_unit.txt`); it does not replace checked-out
source. The default page gate uses the shipped `codex.html` and includes the
Library working-copy receiver and draft-specific Undo regressions. For a
system Chromium, set `PLAYWRIGHT_BROWSERS_PATH` to a directory containing
`chromium-0/chrome-linux/chrome` linked to the executable, as supported by
the existing gate's browser lookup.

The rebuilt `codex.html` was independently rebuilt to a temporary output and
compared equal; SHA256
`8f48b426266657dce959828afc627302e6f040573521248f2d09761824937249`.

P7 commands and individual results are in `p7_commands.txt`. The full
Normalisation class passes 11 tests; the focused two pass, and the C/F2
mutation runs fail by assertions rather than test errors.

## Integrated validation before publication

- Full page gate: 611 assertions pass, including units and real browser
  interactions (`page_full.txt`). Focused send paths: 10 assertions pass.
- Library import/chunk unit tests: 21 pass. Browser transfer and shipped
  activation/reload tests pass with zero provider POSTs.
- ESLint for changed JavaScript, formatting, documented paths, documentation
  counts/references, 13 documented commands, and whitespace checks pass.
- Historical timeout investigation is recorded separately in
  `../high_report_timeout_2026-10-14/README.md`. Later historical heads pass
  locally but fail their recorded CI runs; the cause is not established.

These receipts describe the integrated working tree. The final commit SHA
and any exact-head follow-up results are reported in the continuation PR;
local fixture success is not live acceptance or permission to merge.

The old/new Library pronunciation compatibility and queued-job version
identity/release safeguards extension remains awaiting owner approval.
Rejecting empty replacement candidates in the shared reviser loop is also
excluded pending owner approval.
