# Typing during keyboard-rise correction

Continuation of PR #562 from f25faf008c629f8776d97353945bca5718d08146. Reference reports: BB8 #527 comment6195772133 and Jony #553 comment6196255761.

The queued resize correction now accepts the exact text, selection and scroll associated with input, and collapsed unmodified horizontal-arrow movement within the same raw lyric row. Pointer/wheel/touch navigation, expanded selection, and deliberate keyboard movement to another row still cancel correction. The previous reading-anchor, scroll-away, forward-selection and gate behavior remains covered.

Final bundle SHA256: `3d38dff60d17cabc096d202be9b7b831e0fa900756fddcc6058e9836a5aac12b`.
Baseline bundle SHA256: `3668086b54aad45b179aed2b50ae5a01b65291ef9bf9db88003d0941e84b81ea`.

The same viewport script tests all original 22 cases plus eight timing cases. It holds application animation-frame callbacks across an actual CSS viewport resize, then uses Chromium keyboard input before frame one or between frames. Baseline failures are the four typing/ArrowRight cases, with line 30 at y483.90625–512.703125 behind the tab bar. Deliberate navigation, range selection, typing then navigation, and navigation then typing are explicit controls.

Independent probes additionally cover a horizontal arrow crossing a newline followed by typing, same-row arrow followed by typing, and actual CSS reflow between frames. Their scripts and records are archived alongside the reviewer receipt. JSON files retain original bytes under .json.txt names.

Limitations: emulated Chromium viewport and controlled animation-frame timing, not physical phone, native keyboard hardware or IME acceptance. Jony’s programmatic setSelectionRange(+1) without a keyboard event is a reproduction reference, not claimed equivalent to actual ArrowRight acceptance. His tap-other-line probe was inconclusive and is not counted as a pass. No performance redesign, live-service calls, or unrelated input changes are included.

Run `node scripts/check_lyrics_viewport.js` and `node scripts/check_lyrics_gate.js` with Playwright installed. TEST_HTML chooses the bundle, TEST_EVIDENCE the output directory and PLAYWRIGHT_BROWSERS_PATH the installed Chromium. Network requests use local fixtures.

Final results: viewport 30/30, gate 37/37, independent probes 8/8. Baseline viewport: four failed assertions. Build, ESLint, Prettier and scoped diff checks pass. Intermediate green28/green30 runs were superseded after exposing timing failures; the final records above are the acceptance evidence.
