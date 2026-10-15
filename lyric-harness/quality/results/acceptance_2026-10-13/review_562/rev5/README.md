# #562 merge candidate `3ff4aff7`: integrity and real-key qualification

This is headless Chromium 1194 emulation only, with fixture responses. No physical device, on-screen keyboard, IME, pinch or zoom, or assistive technology was used. `COMMANDS.txt` holds every command. `../rev4/` holds the superseded `e079aeba` run, kept for the record and **not** carried forward.

## Integrity: all PASS

| Check | Result |
|---|---|
| Page suite | 747 assertions |
| Viewport script | 30 of 30; its red control on `f25faf00` gives 4 errors |
| Gate script | 37 of 37 |
| New `check_lyrics_natural_resize.js` | 40 of 40. Its red controls on `e079aeba` and on `f25faf00` give 6 errors each, all "caret obscured" (the committed red40 has 9; natural timing varies from run to run). |
| `codex.html` | equal to a fresh build, `9683457f…` |
| Evidence hashes | match |
| Assertions | no test line removed |
| Scope | numbering code untouched |
| Lint | ESLint and Prettier pass |

## Real key events (`page.keyboard`)

Line 30 has the caret. The window is resized 390×844 → 508, then each action is run 5 times. "Visible" means the line sits at 208.9–237.7; "hidden" means it sits at 483.9–512.7, under `ly-mnav`.

| Action | `3ff4aff7` | `f25faf00` |
|---|---|---|
| Type at 0 ms | 5/5 visible | 5/5 hidden |
| Type at 16 ms | 5/5 visible | 3/5 hidden |
| Type at 33 ms, or after settling | 5/5 visible | 5/5 visible |
| ArrowRight at 0 ms | 5/5 visible | 3/5 hidden |
| ArrowDown at 0 ms (moves to another row) | 2/5 hidden | 1/5 hidden |
| PageDown at 0 ms | navigation is not overridden | same |
| Scroll away, then type | not revealed | same |

**Typing and ArrowRight are fixed.** ArrowDown and PageDown count as deliberate navigation by the PR's own policy and are not revealed, as at `f25faf00`. That is a note, not a defect.

## Earlier findings 1–4 still hold

1. **Gate:** visible and hittable at all five sizes, with focus on Apply all.
2. **Reading position across 600 px:** row 28 stays at y = 344.31.
3. **No snap after a deliberate scroll:** 906 and 1444 are kept.
4. **Forward selection:** reveals the caret end.

**Per-keystroke cost (read statically, not measured):** an `input` listener serialises the draft on each keystroke, which is O(text length). The `selectionchange` layout read from `f25faf00` remains.
