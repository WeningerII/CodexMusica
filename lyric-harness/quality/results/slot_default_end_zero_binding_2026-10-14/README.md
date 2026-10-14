# Default end: zero bound syllables refuse (2026-10-14)

Receipt for the reviser's default-end splice under reader scheme v2 (3PO #519
6163216518, contract blocker 1; BB8's packet #527 6163195621). Code commit
`3e77a5d97` makes `quality/loop.py` `_end_occurrence_bound` refuse where
`slots.resolve` binds ZERO syllables on the line's end; this receipt measures
the code head of the round, `0af39c6ff`, which carries that change unchanged.

## How it was run

- Tool: BB8's `slot_occurrence.py` (version 3.3, sha256 `e543b4f4…edc88`) and
  `slot_binding.py` (sha256 `42e878a0…a026`), from
  `lyric-harness/quality/results/acceptance_2026-10-13/` on the branch
  `bb8/shape-sweep-2026-10-13` at `9ae80be5`. Run unmodified: version 3.3
  replicates production's `lex=` keyword itself, so the lexicon delta the
  previous receipt disclosed for `sb_dump.py` is not needed.
- Population: that folder's `slot_match_67889851/population.txt` (3,990 lines,
  file sha256 `87946276…76c0`).
- Trees: `git archive` of each commit's `lyric-harness/`, with the staged data
  (`cmudict.dict`, `data/concreteness.txt`, `data/moby/`, `data/nltk/`) copied
  in. An archive is not a checkout, so the tool's own commit and dirty-state
  pins read null; the commits are named here instead.
- Interpreter: CPython 3.11.17 (CI pins 3.11.16).
- Measured lexicon (the tool's): the v2 supplemented lexicon, no fallback, in
  both aside modes, and its v1 twin.

## Results

`summary.json` holds both runs' gates, outcome counts and pins;
`changed_cases.json` lists every case that differs between them.

| | `61b6618a` (reproduction) | `0af39c6f` |
|---|---:|---:|
| v2 gate (process scheme) | FAIL | **PASS** |
| v2 `edit_unbound` (stripped / sung) | 191 / 191 | **0 / 0** |
| v2 `refused_unbound` (stripped / sung) | 1,071 / 1,331 | 1,262 / 1,522 |
| v2 `occ_agree` (stripped / sung) | 33,591 / 39,143 | 33,591 / 39,143 |
| v2 `occ_wrong`, `unplaceable_edit`, `no_op_edit` | 0 | 0 |
| controls / readable controls / negative controls failed | 0 / 0 / 0 | 0 / 0 / 0 |
| declared-path cases failed (v2) | 0 | 0 |
| v1 | FAIL (pre-batch behaviour) | identical, record for record |

- The `61b6618a` run reproduces BB8's committed `so_61b6618a.json` outcome
  counts exactly.
- 382 records differ between the two runs, all of them default `end` under
  v2: 191 per aside mode go from `edit_unbound` to `refused_unbound` (tool
  `literal`: `agree_unbound` to `refused_unbound`). They split, per mode, as
  181 unread words, 7 numerals and 3 hyphenated words, BB8's 181/7/3.
- REPAIRED 0 / REFUSED 191 / NO-OP 0 per mode for that cohort: none is
  edited any more, because the grader binds nothing there.
- Readable default ends are unchanged: the 6,052 v2 `end` records that read
  `occ_agree` (multi-word anchors included) are byte-identical in both runs.
- Every v1 record is identical in both runs. The v1 failures (353/348
  `occ_wrong`, 1,099 `edit_unbound` per mode, 18 declared-path cases, 2
  resolver mismatches per mode) are pre-batch behaviour, as on `fce4bf0f`.

What it does not establish: the zeros cover this population, its controls and
the tool's seven declared lines, not the corpus. `occ_agree` shows the reviser
edits what the grader binds, not that the binding is musically right.
