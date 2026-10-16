# Empty replacement guard — 2026-10-15

This newly authorized follow-up starts from merged main
`b887e5effcea84bf11722ca69bd13fc7088755c5`. It is separate from the completed
reader batch and from the still-excluded Library compatibility and queued-job
proposals.

An empty `GroupBrief.pivot_word` reached the mechanical group proposer and the
shared splice helpers. An empty replacement could remove the bound token rather
than decline the proposal; `whole_repair` also deliberately supplies an empty
word because its question requires rewriting lines, not mechanically replacing
words. The regression uses `the room on fire` and `we walk in rain`, direct end
and actual `T2` slots, and real `GroupBrief` instances. Empty strings, spaces,
tab/newline and nonbreaking space are checked under both reader schemes.

Before the fix, the focused section failed 26 blank-candidate assertions while
its valid replacement controls passed. After adding a blank-candidate
precondition to each shared splice helper, all 33 assertions pass. A mechanical
whole-line repair now declines with `None`. Nonempty group replacements still
produce `the room on attire` and `we walk in train`; a placed replacement still
produces `the house on fire`.

One loop path changes with it, and it is stated here because it is visible:
the atomic group/return backtrack (`quality/loop.py`, a group with a member
in a declared verbatim return) asks for whole lines with an empty pivot word
(`whole_repair=True`). Under the mechanical stub (`default_propose_group`)
that request used to splice the empty word into each member, proposing the
verbatim class with its bound words deleted for `verify` to reject; it now
declines every such attempt, so the stub never answers an atomic return
repair and only a writer-backed proposer can. `test_loop.py` asserts it on
the declared-return fixture (every atomic attempt returns `None`; the draft
is unchanged). Tokenization, grading and replacement policy for
nonempty candidates are unchanged. The v1 splice body is preserved, with the new
explicit blank-candidate precondition applied before it.

Focused commands from the repository root, using the existing staged data:

```sh
PYTHONPATH=lyric-harness python -c 'from quality import test_loop as t; t.test_swap_end_word_refuses_a_disagreeing_reading(); raise SystemExit(bool(t.FAILURES))'
PYTHONPATH=lyric-harness python -m unittest quality.test_reader.V1Frozen
python lyric-harness/quality/test_source_identity.py
```

Results: 33 focused assertions passed; four frozen-v1 tests passed (11.525s);
source-identity checks reported ALL PASS. The comparator fingerprint remains
`51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4`;
no calibration rebuild or repin was performed. Local red/green logs are retained
outside the repository. No provider calls or live-service acceptance claims are
part of this evidence.

## Follow-up: replacements with no letter or numeral

BB8's review of `d85d2f26` (#561 comment 6193809091) found that the guard
caught only whitespace. A replacement made of invisible format characters
(U+200B, U+00AD, U+2060, U+FEFF, U+180E) or of punctuation alone (`-`, `'`,
`...`) was still spliced, which deletes the bound word just as an empty string
did. The rule is now that a replacement must contain at least one letter or
one numeral (Unicode general category L or N). Those are the only characters
the reader uses to count a token (`raw_final_token`, `line_tokens`), so a
candidate without one is not a word, and both `swap_end_word` and
`swap_at_slot` refuse it with `None` through `_no_word_in` in
`quality/loop.py`. A numeral-only replacement still splices, because the
reader counts numerals as words. Candidates that contain a letter or numeral
are handled exactly as before.

`test_loop.py`'s blank-candidate section now covers those invisible and
punctuation-only candidates under both reader schemes, plus a numeral control.
Against main's `loop.py` (`f4b84158`) it fails 60 assertions; with the change
it passes all of them. The comparator pin holds (`51316f79…`).

Out of scope and only logged: invisible characters *inside* an otherwise real
replacement word (for example `fi​re`) are still spliced as given.
