# #570 at `47e8d342`: a replacement must hold a letter or a numeral, 2026-10-15, 20:27–20:42 UTC

The rule is `_no_word_in` (`quality/loop.py`): decline when no character is `str.isalpha()` or in Unicode category `N*`. It applies before both reader-specific splices in `swap_end_word` and `swap_at_slot`. The base is main `f4b84158`, which has the #561 blank guard.

| Check | `47e8d342` | main `f4b84158` (red control) |
|---|---|---|
| `probes/blank_guard/blank_probe.py`: 5 blank cases | declined | declined |
| same probe: 6 invisible-only (U+200B, U+00AD, U+2060, U+FEFF, U+180E, U+200D) | **declined** | spliced |
| same probe: 4 punctuation-only (`-`, `'`, `...`, `—`) | **declined** | spliced |
| same probe: word controls `blaze`, `x` | spliced | spliced |
| `probes/blank_guard/edge_probe.py` (new), 22 cases × v1/v2 | **44/44 PASS** | 12 FAIL: `♪`, `!!`, U+0301 alone, `#`, `$`, `…` spliced |

The edge cases that **must still splice** all do, at both heads:
- numerals: `2`, `7th`, `1999`, U+216B Ⅻ, U+00BD ½, U+0663 ٣;
- apostrophe words: `don't`, `rock'n'roll`;
- words with punctuation attached: `—love`, `love!`;
- accented and CJK letters: `café`, `naïve`, `日本`;
- words joined to a zero-width space: `x​`, `​x`;
- a single letter: `A`.

`quality/test_loop.py` at `47e8d342`: all loop regressions pass (664 s).

All runs were at the end slot and at `1.T2`, under both readers, on CPython 3.11.

**Not covered:**
- CI;
- the new `test_loop.py` lines run against main. The probes above show main splicing the same inputs, so they stand in as the red control.
