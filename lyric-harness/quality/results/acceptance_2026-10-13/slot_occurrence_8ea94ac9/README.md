# Slot binding by occurrence at R2's fourth-pass head `8ea94ac9`

Tool 3.3 (`../slot_occurrence.py`, sha256 `e543b4f4…`, committed and unchanged) ran on the 3,990-line population at `8ea94ac9d5141eb5062a8094351a9330f4edc38c`, from a clean checkout (`tracked_changes: false`). `so_8ea94ac9.json.gz` holds the gate and pins. `run.sh` is the command, with the scratch folder written as `<scratch>`.

**Results:**
- **The v2 gate passes** (`gate_by_scheme`). The v1 gate fails on the unchanged pre-batch behaviour, as at `0af39c6f`.
- **Against `0af39c6f`** (`compare_0af39c6f_8ea94ac9.json`, made by `../slot_occurrence_compare.py` from the two full dumps):
  - all 190,530 cases are **equal in every field**: 95,265 per scheme, which is 95,220 evaluated records plus 45 excluded-line placeholders. The change set is empty;
  - all 6,052 readable v2 default ends are equal in every field;
  - the uncompressed record streams have the **same sha256**, `da395e29…2d140b`. So the full dump at this head is byte-for-byte the committed `../slot_occurrence_0af39c6f/so_0af39c6f.jsonl.gz` stream, and it is not committed again.
- **Why that is expected:** `quality/loop.py` is unchanged from `0af39c6f` (sha256 `e9e56461…`). The fourth pass touches `quality/phonology/eng.py`, `quality/relations.py` and `quality/test_reader.py` in the harness.

To repeat the comparison, run from `lyric-harness` at this head, writing the new dump to a scratch path:

    python3 quality/results/acceptance_2026-10-13/slot_occurrence.py <scratch>/so_8ea94ac9 quality/results/acceptance_2026-10-13/slot_match_67889851/population.txt
    python3 quality/results/acceptance_2026-10-13/slot_occurrence_compare.py quality/results/acceptance_2026-10-13/slot_occurrence_0af39c6f/so_0af39c6f.jsonl.gz <scratch>/so_8ea94ac9.jsonl.gz <OUT.json> 0af39c6f 8ea94ac9

**Kept separate:** the corpus guard sweep at this head (running when this was written), the alternate-lexicon gates (measured at `61b6618a`), and the 5 spaced-enclitic witnesses this tool excludes.
