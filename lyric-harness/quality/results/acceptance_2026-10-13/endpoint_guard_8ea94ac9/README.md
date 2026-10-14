# Corpus endpoint-guard sweep at `8ea94ac9`

`../endpoint_guard_witness.py`, with the same tool and `slot_binding.py` sha256 as at `0af39c6f`, ran in four shards at `8ea94ac9d5141eb5062a8094351a9330f4edc38c` from a clean checkout. The sweep covered 1,344 files and 272,317 unique line texts. `compare_0af39c6f_8ea94ac9.json` compares each shard with the committed receipts in `../endpoint_guard_0af39c6f/`.

**Results:**
- **Every shard is equal to `0af39c6f`'s:** the counts, and the full list of lines where the guard changes the outcome (equal as parsed JSON, with a canonical sha256 of each list given). The only pin that differs is the commit, so `loop.py`, the lexicons and CMUdict are the same.
- **So the totals are the same.** Per aside mode, the guard refuses 16,999 default-end edits: 16,697 where the oracle shows the grader binds nothing, and 302 on lines with a multi-piece token. `../endpoint_unmapped_0af39c6f/` shows all 302 bind zero syllables at the end, so each refusal is the contract's.
- **Part 2:** the four focused rigged cases witness the guard in both modes, the controls agree, and both are equal to `0af39c6f`'s.

**Raw receipts:** `egw_8ea94ac9_<k>.json.gz`, one per shard, added after the comparison (3PO, #527 6169357841). They are equal to the committed `0af39c6f` ones apart from the commit pin. To repeat the sweep, run from `lyric-harness` at this head:

    python3 quality/results/acceptance_2026-10-13/endpoint_guard_witness.py <OUT_k.json> . <k>/4
