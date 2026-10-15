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
produces `the house on fire`. Tokenization, grading and replacement policy for
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
