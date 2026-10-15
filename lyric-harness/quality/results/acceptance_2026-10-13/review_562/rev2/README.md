# #562 revised head `7b5b3254`: reproduction and integrity

This is headless Chromium 1194 emulation only. `COMMANDS.txt` holds every command.

**Integrity: all PASS.**
- **Page suite:** 747 assertions.
- **Viewport script:** 15 of 15 cases.
- **New `check_lyrics_gate.js`:** 19 of 19 cases. Against the `1b819d58` bundle it gives 26 errors, identical to the committed red results.
- **`codex.html`:** equal to a fresh build.
- **Evidence hashes:** all match. The three newly excluded JSON files are byte-identical.
- **Assertions:** no `check(` was removed. `check_lyrics_page.js` is byte-unchanged from `1b819d58`.
- **Scope:** numbering, declaration and migration code is untouched. Lint and Prettier pass.

**The off-screen gate is fixed** (`probe_562b.json`):

| Viewport | Apply all top (`1b819d58` → `7b5b3254`) | Cancel top (`1b819d58` → `7b5b3254`) |
|---|---|---|
| 390×508 | −153 → 190 | −101 → 242 |
| 390×600 | −94 → 190 | −42 → 242 |
| 844×390 | −128 → 158 | −128 → 158 |
| 667×375 | −136 → 158 | −136 → 158 |
| 390×844 | unchanged, visible | unchanged, visible |

At every size, each button is fully inside the viewport and hit-testable, and Apply all has focus.

**The earlier minor findings:**
- **Unchanged:**
  - an unfocused resize across 600 px resets the reading position;
  - any resize snaps back to the caret;
  - a forward selection reveals its start.
- **Improved:** Cancel now returns focus to the header opener, including on the Tools tab. When the gate was opened from the Tools-panel callout, Cancel focuses the visible header Run review instead, because the refresh rebuilds that panel. So "actual-opener focus" holds only while the opener survives the refresh.

**Notes:**
- `LY.gateOpener` stays stale after Apply all. This is harmless, because every use checks that the button is still connected and visible.
- The gate and viewport scripts are not wired into `package.json` or CI.
- The older `viewport/hashes.json` describes the `1b819d58` snapshot.
