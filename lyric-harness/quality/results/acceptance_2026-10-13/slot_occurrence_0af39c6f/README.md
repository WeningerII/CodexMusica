# Slot binding by occurrence at R2's blocker head `0af39c6f`

Tool 3.3 (`../slot_occurrence.py`) ran on the 3,990-line population at `0af39c6ff3bb9f1c0229bbf7bf14f49816e298e2`. `so_0af39c6f.json` holds the gate and pins, and `so_0af39c6f.jsonl.gz` holds every record.

**The comparison with `61b6618a`** (`compare_61b6618a_0af39c6f.json`) was made by `../slot_occurrence_compare.py` from the two full dumps. That receipt holds the sha256 of each uncompressed stream, every field of every case, and the complete change set with both records:

    python3 quality/results/acceptance_2026-10-13/slot_occurrence_compare.py quality/results/acceptance_2026-10-13/slot_occurrence_61b6618a/so_61b6618a.jsonl.gz quality/results/acceptance_2026-10-13/slot_occurrence_0af39c6f/so_0af39c6f.jsonl.gz <OUT.json> 61b6618a 0af39c6f

**Results:**
- **v1:** 95,265 of 95,265 cases are **equal in every field**: the parsed records compare equal, which is not a byte comparison. No case appears twice in either dump, since the script refuses a duplicate. That is 95,220 evaluated records plus 45 excluded-line placeholders per scheme.
- **v2:** 382 cases differ, all default `end`. In each aside mode, 191 go from `edit_unbound` to `refused_unbound`. Every other v2 case (94,883) is equal in every field.
- **Readable default ends:** all 6,052 v2 `end` records reading `occ_agree` at `61b6618a` are equal in every field at `0af39c6f`.
- **The v2 gate passes** (`gate_by_scheme`). The v1 gate fails on the unchanged pre-batch behaviour.

**Kept separate:**
- the 5 spaced-enclitic default-end witnesses this tool excludes;
- the alternate-lexicon gates (`../slot_occurrence_61b6618a/lexicon_variants/`, measured at `61b6618a`);
- the corpus endpoint sweep (`../endpoint_guard_0af39c6f/`). It is a **same-head guard-versus-no-lexicon sweep**, not a join of outcomes across heads; the earlier zero-difference sweep at `61b6618a`, with the same corpus and tool pins, gives continuity. There, the guard refuses 16,999 default-end edits per mode:
  - **16,697** where the oracle shows the grader binds nothing;
  - **302** on lines with a multi-piece token, which the oracle cannot place. Their endpoint-level check (`../endpoint_unmapped_0af39c6f/`, from `../endpoint_unmapped_check.py`) reads `slots.resolve` directly: **all 302 bind zero syllables at the end**, so each refusal is the contract's. The 5 previously excluded witnesses are among them.
  - Of the population's 23 excluded lines, the 17 whose end the grader does bind are still **edited**, exactly on the bound end token. No mapped `occ_agree` case changed in the sweep.
