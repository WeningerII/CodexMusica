# Independent reproduction and integrity review of #562 (UI repairs)

This reviews head `1b819d5875427c61b9f8da8b30101540a753d540` against base `b887e5ef`. Every browser result comes from **headless Chromium 1194 emulation** (Playwright, fixture replies). No real device, IME, pinch, native zoom or assistive technology was used.

`COMMANDS.txt` holds every command. Left out:
- the rebuilt `codex.html` and build outputs;
- screenshots;
- the reconstructed eight-fix tree;
- the per-commit intermediate patches.

## Integrity and reproduction: all PASS

- **Page suite:** at `1b819d58`, 747 assertions, exit 0 (`full_562.log`). At `b887e5ef`, 651 assertions, exit 0, on the rerun (`full_b887_run2.log`). The first base run (`full_b887_run1.log`) hit one 60 s `waitForFunction` timeout under shared-CPU load, a flake in the base tree.
- **`check_lyrics_viewport.js`:** 15 cases and 0 errors at the head.
  - Red control: the reconstructed eight-fix tree, whose bundle hash `37ff7957…` matches the claim, gives 18 errors, identical to the committed red-final. `b887e5ef` gives 22.
  - The initial caret geometry is byte-equal across the trees. The documented 0.703125 px line-30 dock overlap is present on all of them.
- **`codex.html`:** equal to a fresh `build_html` (sha256 `90431a92…`).
- **Evidence hashes:** all 5 entries in `viewport/hashes.json` match. The combined patch SHA256 `0436aaf6…` and the delta `6e3c4f65…` both reproduce exactly (`patches/`). The per-item eight-fix hashes point at `/tmp` files and couldn't be checked.
- **Assertions:** no `check(` was removed or weakened (400 → 466). The one changed expression is stricter.
- **Scope:** numbering, declaration and migration code is untouched. The diff doesn't touch `lyDeclarationsOf`, numbering or migration, or `app.js`, `mcp/` or `lyric-harness/`.
- **Lint:** ESLint and Prettier pass on the changed js and css.

## Findings

1. **Major — Don's finding, reproduced (#562 comment 6194666319), and it extends to landscape.** Opening the pending-changes gate from the Review panel leaves the warning, Apply all and Cancel all above the viewport while focus is on Apply all (`lyrics.js:5702`, focus with `preventScroll`).

   | Viewport | Apply all top (px) | Cancel top (px) |
   |---|---|---|
   | 390×508 | −153 | −101 |
   | 390×600 | −94 | −42 |
   | 844×390 | −128 | −128 |
   | 667×375 | −136 | −136 |
   | 390×844 | visible | visible |

   The eight-fix tree measures the same, so the defect comes from that layer. The viewport script's own green run starts Cancel at −33 and −101, then recovers by scrolling, so it misses this (`probes/probe_562.json`).
2. **Minor — an unfocused height change across 600 px drops the reading position.** `ly-body` at 1047 resets to 0 on 844→508, because the media query switches the scroller.
3. **Minor — any resize snaps back to the caret when the editor is focused** (`lyrics.js:4194-4227`, wired at `6629-6643`).
   - Desktop: a wheel to 906, then a resize from 757 to 740, snaps to 0.
   - Phone at 508: a resize to 500 moves 1444 → 387.

   Whether real mobile URL-bar or rotation events do this can't be told from emulation.
4. **Minor — a forward selection reveals its start, not the caret** (`lyrics.js:4198`, `selectionStart`). A selection from line 5 to line 30 shows line 5.
5. **Note — Cancel focuses the Review panel's Run review** (`lyrics.js:5720`), not necessarily the opener. With the Tools tab showing, focus still drops to body.
6. **Note — the page test writes screenshots to a hard-coded `/tmp/ui-eight-evidence/h1/` on every run** (`check_lyrics_page.js:2453,2472`) and prints large geometry JSON. The viewport script isn't wired into `package.json` or CI.
7. **Note — IME, emulated with CDP `imeSetComposition`:** the composition commits correctly through a keyboard rise. No real IME was used.

**Per-item verdicts:**
- **PASS:** J1, J4 (before this fix the label could never show), J10, J12, H1 (reachability after a scroll) and H2.
- **J5:** passes, but `aria-invalid` sits on the Place select while the error is about the member count.
- **J11:** passes as designed, but "New song" now also discards unsent typed text.

**Unverified:** real devices, soft keyboards, pinch and zoom, finger drag, screen readers, and the live service.
