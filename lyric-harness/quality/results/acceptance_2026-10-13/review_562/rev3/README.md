# #562 third head `f25faf00`: reproduction and integrity

This is headless Chromium 1194 emulation only. `COMMANDS.txt` holds every command.

**Integrity: all PASS.**

| Check | Result |
|---|---|
| Page suite | 747 assertions |
| Viewport script | 22 of 22. The red control on the `7b5b3254` bundle gives 10 errors, identical to the committed red22. |
| Gate script | 37 of 37. The red control on `7b5b3254` with `TEST_CASE=page-top` gives 20 errors, identical to the committed red-top. |
| `codex.html` | equal to a fresh build (sha256 `3668086b…`) |
| Evidence hashes | every receipt bundle hash matches its commit |
| Assertions | no `check(` removed or weakened. The removed lines are refactors. The page test is byte-unchanged. |
| Scope | numbering, declaration and migration code is untouched |
| Lint | ESLint and Prettier pass |

**My earlier findings:**

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Gate opens off-screen | Still fixed | All five sizes are inside the viewport and hit-testable, with focus on Apply all. |
| 2 | Unfocused resize across 600 px loses the reading position | **Fixed** | Row 28 stays at y = 344.3 through 844 → 508 → 844. |
| 3 | Any resize snaps back to the caret | **Fixed** | Desktop stays at 906; phone stays at 1444. |
| 4 | A forward selection reveals its start | **Fixed** while the caret was visible before the resize | Line 30 is revealed. By design, a caret that was already off-screen is no longer revealed. |
| 5 | Cancel focus target | Unchanged from `7b5b3254` and acceptable | — |

**Adversarial probes:**
- Rapid resizes, rotation, and a selection spanning the fold: correct.
- **New minor issue (`lyrics.js:6730`): typing within about 33 ms of a keyboard-rise resize** (the two queued animation frames) is taken as deliberate intent, so the reveal is skipped. Line 30 at 390×844 → 508, with "xy" typed in the same moment, is left under `ly-mnav` (483.9–512.7 in a 508 viewport). At `7b5b3254` it was revealed. How often this happens on a real keyboard can't be told here.

**Notes:**
- `rememberViewportPosition` now runs on every `selectionchange`, which may force a layout on each keystroke. The cost on long documents was not measured.
- Where `selectionDirection` is `'none'`, a forward selection falls back to revealing its start. That could not be tested on Linux.

**Unverified:** real devices, soft keyboards, IME, pinch and zoom, assistive technology, other platforms, and the live service.
