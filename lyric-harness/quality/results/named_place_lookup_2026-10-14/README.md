# Identical cut, moved end binding: diagnosis and the page's condition (2026-10-14)

BB8 (#519 6161601064, item A.2-six) found English corpus lines whose v1 and v2 cuts are identical (the same token texts on the same raw characters) but whose default END binding still changes.
The Lyrics page's named-place notice fired only when the cut changed, so it said nothing on those lines.
Three of them: `Below the knap, 's a runnèn still;`, `When in that house M.P.'s divide,`, `“Also, some few I. O. U.’s and bets,”`.

## Cause

Under reader scheme v1, `line_anchors` reads the words before the last by re-cutting them joined with single spaces: `lex.transcribe(" ".join(words[:-1]))`, which is the v1 body of `Lexicon.transcribe` and applies `join_spaced_enclitics`.
Re-cutting is not idempotent:

- An enclitic that the printed line separates from its host with punctuation is its own word in the cut.
- The space join turns it into a spaced enclitic.
- The re-cut then joins it to the word before.

So v1 looked up `knap's`, `P's` (P IY1 Z) and `U's` (Y UW1 Z).
v2 reads each token at its own position (`transcribe_tokens`; its docstring already names the non-idempotent re-cut). There, `'s` is read alone (EH1 S), and the rhyme's start moves.

The cut is the same under both schemes. What differs is the lookup words.

## Condition

`src/pages/lyrics.js` `lyLineCutChanged` treats a line as changed when its cut is identical but v1's lookup words differ from that cut. The lookup words come from `src/lyric-tokens.js` `v1GraderLookup`: `_line_tokens_v1` of the space-joined words before the last, then the last word.
`measure.py` computes the same condition with the harness's own functions, not the mirror.

## Result

`python3 quality/results/named_place_lookup_2026-10-14/measure.py --write`, run with CPython 3.11.17, then formatted with Prettier (the repository JSON style). Re-running prints the same counts. Population: `corpus/song/eng_*.txt` sung lines, voices off.

| | lines |
|---|---|
| sung lines | 281,399 |
| identical cut | 271,092 (262,604 unique) |
| END binding changes on an identical cut, Latin script | 8, all named by the condition |
| condition fires | 24: the 8, plus 16 where the lookup differs but the end anchor does not reach the joined word |
| condition fires on the other identical-cut lines | 0 of 271,068 |
| label differs only by Unicode NFC, nothing bound under either scheme | 7 (polytonic Greek, e.g. U+1F79 against U+03CC); not a binding change |

The 16 extra lines are real differences in what the earlier grader looked up, but the default end binding did not move on them.
They are disclosed, not treated as noise. The notice on them is the same non-blocking note ("may have changed"), which the page labels display-only.

## How this is tested

- `scripts/check_lyrics_page.js`, unit B §7:
  - the three lines and every end-changed Latin line fire;
  - a page scan of the same population fires on exactly `lookup_differs` and no other line.
  - Removing the lookup clause fails 15 assertions.
- `quality/test_reader.py` `NamedPlaceLookup`, using the harness's own functions:
  - the eight have an identical cut, a differing lookup and a moved END;
  - the cause is shown directly (`knap's` among v1's looked-up words);
  - the 16 keep their END;
  - identical-cut controls do not fire.

The corpus is volatile (`quality/counters.py`). If it changes, re-run `measure.py --write` and the page check together.
