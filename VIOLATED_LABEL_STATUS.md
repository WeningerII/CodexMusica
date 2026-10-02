# VIOLATED label fix — status

Branch: `claude/violated-label-fix` (cut from `claude/practical-curie-n66u8c` at 0924c9e6).

## 1. Reproduced (2026-10-02)

Setup needed in a fresh container: `python3 -c "import lyric_harness as L; L.fetch_data()"`,
`pip install nltk`, `python3 quality/fetch_data.py`.

From `lyric-harness/`:

    python3 lyric_harness.py brief /tmp/rb.txt "--groups=1,2;3,4"

prints `REPORT: 1 line(s) briefed — 0 FLAG, 1 NOTE`; the one note is MODAL_RHYME on L1/L2
(`'bed' is one of the 6 most-predictable answers to 'read'`), and yet the L2 block says

    must answer group A [1, 2]: L1 ('read') — VIOLATED

## What I found

- `Reviser._violated_groups` (quality/revise.py) attributes every finding whose code is in
  `RHYME_FINDINGS` to its group, whatever its severity. MODAL_RHYME, PREDICTABLE_RHYME,
  HOMEOTELEUTON and SHARED_SUFFIX are notes in that set, so a holding pair with one of them
  lands in `Brief.violated_groups`.
- Readers of `violated_groups`: `Brief.__str__` (label), `lyric_harness.py` brief report
  (label, "must answer group" lines), `quality/propose.py` `_mandate_block` (label: "VIOLATED,
  this is the word to change"), `brief()` itself (which place is primary, `slot`,
  `slot_conflict`, `slot_groups`, which field is offered), and `quality/loop.py`
  `_asks_group_first` (tier-2 dispatch). `verify()` does not read it.
- Plan: leave `violated_groups` and everything it decides exactly as they are (which word,
  which field, what verify() accepts do not move), and add a separate record of the groups
  whose only attribution is a note. The three renderers label those as holding with a
  predictable rhyme the loop still asks to change.

## 2. The fix (2026-10-02)

What the writer is asked to do does not change: same word, same place, same offered field,
same forbidden modal head, and `verify()` still rejects a modal candidate. So no question for
the owner was needed.

- `quality/revise.py`: new `Brief.noted_groups` — `{label: (note codes)}` for a group in
  `violated_groups` whose only attribution is NOTE findings (no flag, no incident graded
  violation). `brief()` fills it by running `_violated_groups` once over the flag findings
  and once per note finding; `violated_groups` itself is computed exactly as before. New
  helper `held_note_standing(codes)`, used by `Brief.__str__`.
- `lyric_harness.py` (`brief` report, "must answer group" lines) uses the same helper.
- `quality/propose.py` (`_mandate_block`) writes the same sentence in its own words, since
  that module imports nothing from `revise.py`. The two-place hint and the
  "MORE THAN ONE PLACE ... IS VIOLATED" heading say "marked to change" / "ASKED TO CHANGE"
  only when a noted group is present; otherwise they print exactly what they printed before.

On the reproduction the line now reads:

    must answer group A [1, 2]: L1 ('read') — HOLDS, but its rhyme is a predictable one (NOTE MODAL_RHYME), which the loop still asks to change

and the writer prompt adds ": this is the word to change". For HOMEOTELEUTON or SHARED_SUFFIX
alone it reads "HOLDS, but carries NOTE <code>, which the loop still asks to change".
A pair that fails keeps "VIOLATED".

Standing rule 4: `comparator_fingerprint()` is `d8f5a5b15e17…` with and without the
`lyric_harness.py` edit, so no memo is discarded.

New test: `quality/test_revise.py` section 70,
`test_a_holding_pair_with_a_pursued_note_is_not_violated` (8 checks: the label in all three
renderers, the CLI run, plus controls that the field, the modal head and `verify()`'s
rejection are unchanged and that a failing pair still says VIOLATED). Against the old source
it gives 4 FAIL / 4 PASS (the 4 passes are the controls); against the new source 8 PASS.
`quality/test_propose.py`'s stand-in `B` gained `noted_groups` (its field-set guard requires it).

## 3. Finished (2026-10-02) — suite results on commit 182ff955

Each run from `lyric-harness/` with `python3 quality/<suite>.py`, the new source in place:

| suite | exit | checks | time |
|---|---|---|---|
| `quality/test_revise.py` (owns `Brief.__str__`; holds the new section 70) | 0 | 427 PASS, 0 FAIL | 1330s |
| `quality/test_propose.py` (owns the writer prompt) | 0 | 137 PASS, 0 FAIL | 195s |
| `quality/test_loop.py` | 0 | 176 PASS, 0 FAIL | 959s |
| `quality/test_verbs.py` (owns the `brief` verb's report) | 0 | 596 PASS, 0 FAIL | 3670s |
| `quality/test_production_revision.py` (reads `violated_groups`) | 0 | unittest: Ran 44 tests, OK | 1026s |
| `quality/test_replay_memo.py` (pins "L2 ('four') — VIOLATED", a real failure) | 0 | 47 PASS, ALL PASS | 264s |

(`test_verbs.py`'s log has three lines starting "FAILS L2-L3 ..." / "FAILS L1-L3 ..." — those are
report text the suite prints, not failed checks; its own FAIL count is 0 and it exits 0.)

No existing check pinned the old wording on a holding-but-noted pair, so nothing needed a
dated repin.

## Left open

- The other `violated_groups` readers still treat a noted group as "to change", by design:
  `slot_conflict`, the primary place, and `quality/loop.py`'s `_asks_group_first`. The field
  keeps its name, so a reader has to check `noted_groups` to tell a held pair from a broken one.
  Renaming it would touch the loop and the tests and was outside the label fix.
- If a group is both unjudged and noted, the label says only "UNJUDGED".
- No pull request opened, nothing merged.
