# Resize correction evidence — 2026-10-15

PR #562 continuation from a68c5e88d89303d7c74260de517b87121be00114.

The correction preserves a visible lyric row’s screen offset across the H1 scroller switch, reveals a focused caret only when it was visible before resize, and uses selectionEnd for forward selections. Queued correction yields to intervening selection or scroll intent. The published gate-center correction remains included.

Final bundle SHA256: `3668086b54aad45b179aed2b50ae5a01b65291ef9bf9db88003d0941e84b81ea`.

The same 22-case viewport script reports 10 failed assertions against the preserved pre-correction bundle (7b5b3254f808f9deac04bb9cbddf4cb112cc77e1, SHA256 `1b4f22cdf8cef0ba62c22a5dab0573a674195c7aa56ae7e1b8a349b8ced3643d`) and zero against the final bundle. All original 15 cases, including six keyboard-rise cases, remain covered. The final gate suite passes all 37 cases, including page-top keyboard opening and touch actions at 844×390 and 390×508.

Build, ESLint, Prettier and scoped diff checks pass. JSON records retain their original bytes under .json.txt names. Final red22/green22 records supersede exploratory runs; independent probes are recorded separately in review.txt.

Reproduction: run `node scripts/check_lyrics_viewport.js` and `node scripts/check_lyrics_gate.js` with Playwright installed. TEST_HTML selects the bundle, TEST_EVIDENCE selects the output directory, and PLAYWRIGHT_BROWSERS_PATH selects the installed Chromium. Tests intercept network requests with fixtures and do not call providers.

Limits: viewport resizing and visualViewport stubs emulate keyboard changes. Synthetic wheel plus explicit scroll models queued intent; it is not native touch or hardware-keyboard acceptance. No live-service acceptance or exact-head remote CI claim is made. Existing unrelated Apply-all selection behavior is outside this correction.
