"""THE SONNET BATTERY'S PIN, in the tree the production image ships.

`battery.EXPECTED` IS this dict: `battery.py` imports it from here, so the
battery, its tests and `quality/chance_rate.py` all read one object and a
repin moves every one of them. The REASON for each repin is still written in
`battery.py`, directly above that import, where the whole repin history has
always been; a repin edits the dict below and argues itself there.

WHY THE DICT LIVES HERE AND NOT IN `battery.py` (2026-09-26). Since the
N-relation model (#380, 67c3cc5c) `quality/chance_rate.py` read the canon
arm's rate off `battery.EXPECTED` at import -- right about the number (a
retyped copy had drifted to 4/967) and wrong about the dependency.
`battery.py` is a research runner, not a runtime module:
`quality/release_assets.py --assemble` ships `lyric_harness.py` and
`quality/` and nothing else. In the production image every `grade` reaches
`lyric_harness.door_chance_note`, which imports `chance_rate`, which died on
`ModuleNotFoundError: No module named 'battery'` -- all four capacity shards
of production qualification run 36223006454 (main be562b45, 2026-09-26).
Shipping `battery.py` instead would have cost every grade a second
`Lexicon()`, which the battery builds at import (0.4 s and ~70 MB measured
2026-09-26), to read four integers. So the four integers live here, with no
imports at all. `quality/test_production_data.py` imports every module the
runtime reaches inside a code-only assembled tree, so the next import of an
unshipped module fails in PR CI rather than in qualification.
"""

#: The 152 self-labelled sonnets: mandated pairs, pairs judged, pairs refused
#: at ingestion, and judged pairs that violate. Repin HERE; state the layer
#: that moved and the price in `battery.py`'s repin history.
EXPECTED = {"mandated": 1064, "judged": 936, "refused": 128, "violations": 9}
