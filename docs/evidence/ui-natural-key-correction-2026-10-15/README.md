# Natural key timing during keyboard rise

PR #562 continuation from e079aebafa911fced461cd39e2d8d4328fd7db83, addressing independent report6196801718. The prior held-frame tests did not reproduce all natural Chromium event ordering.

Baseline bundle SHA256: `3d38dff60d17cabc096d202be9b7b831e0fa900756fddcc6058e9836a5aac12b`.
Final bundle SHA256: `9683457f71fb8b50498d6b99d406f8888f9bd88b790ee2a1f548f392e321d27a`.

Failed natural baseline traces establish the cause: inputMatches is true, navigation intent is unchanged and the caret was previously visible, but Chromium scrolls after the input snapshot. The scroll offset no longer equals the captured value, so the queued correction returns without revealing. Independent diagnostic records have an empty errors array because they record observations, not acceptance assertions; their observed visibility failures must not be read as passing tests.

The correction permits browser caret scrolling for an exact accepted input tuple or actual collapsed same-row horizontal arrow movement. Explicit pointer, wheel, touch and keyboard navigation still cancel the correction. Non-writing scroll changes retain the existing guard. It removes the stale input/arrow scroll snapshots and their extra listeners; no other behavior regions are edited.

The new natural runner uses actual Chromium keyboard events after requested delays of 0, 16, 33 and 100ms on lines9 and30. It observes animation frames without holding or rescheduling them. Requested delays are labels, not proof of event phase: traces classify actual key arrival before, between or after the two queued frames. Two bounded repetitions include post-input wheel and cross-row keyboard controls. The existing30 viewport and37 gate cases remain unchanged.

Limits: no physical-phone, native on-screen keyboard or IME qualification. Arbitrary script-only scroll immediately after accepted writing is indistinguishable from browser caret scrolling when no explicit navigation event occurs, and can be corrected; this is explicitly characterized, not claimed protected. Standalone scripted-scroll and real gesture/navigation controls remain covered. No merge, deployment, provider calls, performance redesign or R2 P-A changes.

Run `node scripts/check_lyrics_natural_resize.js`, `node scripts/check_lyrics_viewport.js`, and `node scripts/check_lyrics_gate.js` with Playwright installed. TEST_HTML selects the bundle, TEST_EVIDENCE the output directory, and PLAYWRIGHT_BROWSERS_PATH the Chromium installation. Natural timing defaults to two repetitions. Evidence JSON is archived byte-for-byte under .json.txt filenames.

Final checks: natural40 passes all cases against nine baseline failures; all events classified (candidate3 before-first,13 between-frame,24 after-second). Existing viewport30 and gate37 pass. Independent uninstrumented natural20 and held-frame real-intent3 pass. Natural wheel/navigation actions landed after correction in this run; pending-interval protection is supported separately by the independent held-frame controls. Build, ESLint, Prettier and scoped diff checks pass.
