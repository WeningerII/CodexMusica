# BB8's own measurements at merged main `b887e5ef`

These are reruns at `b887e5effcea84bf11722ca69bd13fc7088755c5`, from a clean worktree with only `cmudict.dict` staged, on 15 October between 13:13 and 13:23 UTC. `run.sh` holds the commands, with the scratch folder written as `<scratch>`. The tools are unchanged from the `8ea94ac9` runs.

**Results:**
- **Slot binding** (`slot/`, tool 3.3):
  - the v2 gate passes, and the v1 gate fails on the unchanged pre-batch behaviour, as before;
  - all 190,530 cases are **equal in every field** to `8ea94ac9`'s (`compare_8ea94ac9_b887e5ef.json`). The comparison's "old" stream is the committed `../slot_occurrence_0af39c6f/` dump, whose stream sha256 equals `8ea94ac9`'s;
  - the uncompressed record streams have the same sha256, `da395e29…`;
  - `quality/loop.py` is unchanged (sha256 `e9e56461…`).
- **Corpus guard sweep** (`guard/`): every shard is equal to `../endpoint_guard_8ea94ac9/`: the corpus pins, the counts, and the full lists of lines where the guard changes the outcome. The only pin that differs is the commit. Part 2's focused cases and controls pass.
- **A.2 `measure.py`** (`a2/`): the output is byte-identical to the runs at `8ea94ac9` and `6955e342`: 281,399 sung lines, 271,092 with an identical cut, 24 lookup differences, 8 end changes and 7 NFC-only labels.

**Not covered here:**
- the page, MCP and declaration-normalization changes made after `8ea94ac9`, which are under separate review;
- anything live (MCP host, provider, deployment).
