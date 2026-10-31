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
#: ~~"violations": 40~~ -> 36, 2026-10-27 (identical words that satisfy a
#: type are not charged as REPEAT; `battery.py` states the four pairs).
#: ~~"violations": 36~~ -> 24, 2026-10-30 (`MISSING.md` M-322, the English
#: sound inventory: non-rhotic readings let ten pairs hold as consonance --
#: herd/beard, deserts/parts, worth/forth x3, desert/part, desert/impart,
#: word/afford, words/affords x2 -- and were/bear, were/near pass on two
#: empty codas, which E-5 keeps agreeing; judged and refused unmoved).
#: ~~"judged": 1012, "refused": 52, "violations": 24~~ -> 1013 / 51 / 25,
#: the same day (M-322): the any-reading search varies first the words that
#: differ on what a schema reads, so sonnet 1 ornament/content, refused when
#: every word's combinations passed the cap, is judged and violates.
#: ~~"judged": 1013, "refused": 51, "violations": 25~~ -> 1011 / 53 / 23,
#: 2026-10-31 (`MISSING.md` M-311 F1, R2's mosaic ruling): an unread word
#: inside a member makes that candidate undecided for every channel, and the
#: any-reading search no longer sinks on a word it cannot vary; `battery.py`
#: states the four pairs that moved.
EXPECTED = {"mandated": 1064, "judged": 1011, "refused": 53, "violations": 23}
