#!/usr/bin/env python3
"""ms_ scratch: verify the scope/collision-loop finding, byte-identity form."""
import sys
import os
import io
import json
import hashlib
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import quality.schemes as S
from quality.revise import Reviser

HERE = os.path.dirname(os.path.abspath(__file__))
LINES = [l.rstrip("\n") for l in
         open(os.path.join(HERE, "fixtures", "mandate_song.txt"))
         if l.strip() and not l.startswith(("[", "#", "---"))]

SONG_RETURN = "chorus:33-40<=13-20"
GROUPS = [[13, 17], [14, 16], [15, 19], [18, 20]]
CHORUS = list(range(13, 21)) + list(range(33, 41))

no_scope = S.mandate(GROUPS, n_lines=41, returns=SONG_RETURN)
scoped = S.mandate(GROUPS, n_lines=41, returns=SONG_RETURN, scope=CHORUS)

rv = Reviser()


def digest(m):
    ins = rv.inspect(LINES, m)
    buf = []
    for ln in sorted(ins["per_line"]):
        for f in ins["per_line"][ln]:
            buf.append(f"L{ln} {f.code} {f.severity} {f.message} | {f.evidence}"
                       f" | {f.locations}")
    for f in ins["whole"]:
        buf.append(f"W {f.code} {f.severity} {f.message} | {f.evidence} "
                   f"| {f.locations}")
    text = "\n".join(buf)
    rep = ins["grade"]
    return ins, text, hashlib.sha256(text.encode()).hexdigest(), rep


ins_a, txt_a, h_a, rep_a = digest(no_scope)
ins_b, txt_b, h_b, rep_b = digest(scoped)

print("SAME mandate, scope OFF vs scope ON")
print(f"  collisions  : {len(rep_a['collisions'])} vs {len(rep_b['collisions'])}")
oos = [c for c in rep_b["collisions"]
       if not (scoped.in_scope(c["lines"][0]) and scoped.in_scope(c["lines"][1]))]
print(f"  of the scoped run's collisions, touching an out-of-scope line: "
      f"{len(oos)}")
print(f"  per_line findings: {sum(len(v) for v in ins_a['per_line'].values())}"
      f" vs {sum(len(v) for v in ins_b['per_line'].values())}")
print(f"  whole findings   : {len(ins_a['whole'])} vs {len(ins_b['whole'])}")
print(f"  sha256 of the full finding dump: {h_a[:16]} vs {h_b[:16]}")
print(f"  BYTE-IDENTICAL: {txt_a == txt_b}")
print(f"  pairs_mandated/judged/refused: "
      f"{rep_a['pairs_mandated']}/{rep_a['pairs_judged']}/{rep_a['pairs_refused']}"
      f" vs "
      f"{rep_b['pairs_mandated']}/{rep_b['pairs_judged']}/{rep_b['pairs_refused']}")

c = Counter(f.code for fs in ins_b["per_line"].values() for f in fs)
c.update(Counter(f.code for f in ins_b["whole"]))
print("  codes (scoped):", dict(sorted(c.items())))

# which codes do the out-of-scope collisions carry?
oos_pairs = {tuple(c["lines"]) for c in oos}
oosc = Counter()
for fs in ins_b["per_line"].values():
    for f in fs:
        if f.code in ("SCHEME_COLLISION", "NEAR_COLLISION",
                      "REPEAT_ACROSS_GROUPS") and tuple(f.locations) in oos_pairs:
            oosc[f.code] += 1
print("  out-of-scope collision findings by code:", dict(oosc))
print("  in-scope collisions:", len(rep_b["collisions"]) - len(oos))
