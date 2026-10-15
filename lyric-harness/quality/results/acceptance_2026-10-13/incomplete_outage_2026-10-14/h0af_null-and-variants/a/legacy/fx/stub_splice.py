#!/usr/bin/env python3
"""BB8: the stock tier-2 stub's splice (`default_propose_group`) on duck-typed
group briefs. argv: MODE OUT.json; MODE base | v1 | v2. Base calls the
pre-batch signature; the candidate is called as revise_loop's own partial
calls it (`_lex_cut`: under v1 -> strip_parens=True, scheme v1), and also with
strip_parens=False (a --voices lexicon) to show v1 ignores it."""
import json, sys
sys.path.insert(0, ".")
import lyric_harness as LH
from quality import loop as LP, slots as SL
mode, out = sys.argv[1], sys.argv[2]
TEXTS = ["I left my heart beside the door (the rain)", "Oh--oh, oh my love",
         "Up--i--de--i--de--i--di,", "I gave it all my heart.    10",
         "(oh) hello my world", "we go (oh) 's the night", "Catch-22 is the end",
         "she sang 4ever and a day", "thee--Arise and sing"]
PLACES = [None, "T1", "T2", "T3", "T4", "T7", "head", "endword", "end", "headrime", "line"]
class GB:
    def __init__(self, text, slot, word):
        self.members = (1,); self._p = (text, word, slot)
    def proposal_for(self, m):
        return self._p
rows = []
for t in TEXTS:
    for p in PLACES:
        slot = None if p is None else SL.parse_slot(f"1.{p}")
        gb = GB(t, slot, "zephyr")
        rec = {"text": t, "place": p}
        try:
            if mode == "base":
                rec["out"] = LP.default_propose_group(gb)
            else:
                with LH.reader_scheme_scope(mode):
                    sp = (True, "v1") if mode == "v1" else (False, "v2")
                    rec["out"] = LP.default_propose_group(gb, scheme=sp[1], strip_parens=sp[0])
                    rec["out_voices"] = LP.default_propose_group(gb, scheme=mode, strip_parens=False)
        except Exception as e:
            rec["out"] = f"EXC {type(e).__name__}: {e}"
        rows.append(rec)
json.dump(rows, open(out, "w"), ensure_ascii=False, indent=1)
print(mode, sum(1 for r in rows if r["out"] is not None), "of", len(rows), "spliced")
