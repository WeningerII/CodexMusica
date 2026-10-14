"""Every search_null sonnet scheme pair, with identity and realized k.
usage: sonnet_pairs.py ROOT OUT.json   (run with ROOT as cwd)
Identity = (unit, i, j, line_i, line_j); a pair is admitted when both lines
have end anchors (search_null.scheme_pairs). Also lists every scheme pair
NOT admitted, with which side has no anchor."""
import sys, os, json
ROOT = sys.argv[1]; sys.path.insert(0, ROOT); os.chdir(ROOT)
import lyric_harness as LH
from quality import search_null as SN
lex = LH.Lexicon(); decl = LH.Declaration()
lines = [l.rstrip("\n") for l in open("corpus/sonnets.txt", encoding="utf-8") if l.strip() and not LH.is_apparatus_line(l)]
out = {"admitted": [], "refused": []}
for u, i0 in enumerate(range(0, len(lines) - 13, 14)):
    ls = lines[i0:i0 + 14]; anc = [LH.line_anchors(lex, l) for l in ls]
    for i in range(14):
        for j in range(i + 1, 14):
            if SN.SONNET_SCHEME[i] != SN.SONNET_SCHEME[j]: continue
            ident = [u, i, j, ls[i], ls[j]]
            if anc[i][0] and anc[j][0]:
                s = LH.best_score(anc[i][0], anc[j][0], decl, anc[i][1], anc[j][1])
                out["admitted"].append(ident + [s["spans"]["search_k"] if s else 0])
            else:
                out["refused"].append(ident + [bool(anc[i][0]), bool(anc[j][0])])
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
print("admitted", len(out["admitted"]), "refused", len(out["refused"]))
