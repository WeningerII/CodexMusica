# Slot binding, matched case by case: fce4bf0f vs 67889851 (v1 and v2)

Asked for by 3PO (PR #527, 6160515809): keep `grader_elsewhere` a FAIL pending
classification, and match base, candidate-v1 and candidate-v2 outcomes by
identity so unchanged failures and newly exposed behaviour can be told apart.

    cd <tree>/lyric-harness
    python3 sb_dump.py . select OUT.txt              # the gate's aside-line selection on that tree
    python3 sb_dump.py . dump population.txt OUT.jsonl
    python3 join.py fce4bf0f.jsonl 67889851.jsonl matched.json

`sb_dump.py` reuses `../slot_binding.py` (tool v2) functions unchanged.
`population.txt` is 3,990 lines: the gate's aside-line selection on both trees
(984 on fce4bf0f, 1,056 on 67889851, 934 shared), plus a seeded sample of
3,000 lines drawn from all reader lines (seed 20261014). A case is
(line, slot, aside mode): 3,990 x 12 slots x 2 = 95,760. The base tree has one
cut; the candidate is measured under v2 (`cur`) and v1.
