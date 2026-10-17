# Lyrics gap list rev 5 — evidence captures (2026-10-17)

Evidence only: no product code changes. Captured by the Jony Ive review session on main `d02af470`
(`codex.html` `1b0050e89cc7e8b2…`, matching a fresh `--out` build), Chromium 141 emulation, every request except the
page's own GETs aborted (no POST sent). Mocks were injected into a local copy only; nothing is built.

- `phone/base-390x844.png`: main as shipped, 390×844, caret unset, scroll 0. 4 readable lyric lines.
- `phone/P1-390x844.png`: the P1 mock (header actions on one row, brief on one row, section navigator folded into the
  Find/Display row, dock lowered). 8 readable lyric lines. Method and full script: #553 comment 6241330267.
- `combined/*.png`: the G2/G3 combined-state mock on L1 "light" / L2 "night" (tint, rhyme solid underline, assonance double
  line, selected-pair top bar, Find ring, native selection), at 1440×900 and 390×844, light and dark, forced colours off and on.
  Method and full script: #553 comment 6241378517. In the `-forced` captures the selected-pair bar is missing (it is drawn as
  a background); see that comment.
