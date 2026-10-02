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
