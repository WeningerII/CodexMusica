"""(a) Which placements actually move between reader schemes on R2's 24
lookup-differs lines (default production lexicon, voices off): slots.resolve
for end (bare N), endword, head, headrime, line and every T<k>, compared on
anchor phonology + label. Shows which carried notices are about a binding that
moved and which are not. Run from <tree>/lyric-harness. Usage: python a_places_v1v2.py <out.json>"""
import json, os, sys
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
from quality import slots as SL
from quality.phonology import eng
R = json.load(open("quality/results/named_place_lookup_2026-10-14/result.json", encoding="utf-8"))
lexes = {}
for s in ("v1", "v2"):
    with LH.reader_scheme_scope(s):
        lexes[s] = eng._lexicon()
def key(s, line, spelling):
    with LH.reader_scheme_scope(s):
        try:
            a, label, _ = SL.resolve(lexes[s], line, SL.parse_slot(spelling))
        except Exception as e:
            return f"ERR {type(e).__name__}: {e}"
        return [sorted(json.dumps([(x["nucleus"], list(x["coda"]), list(x["onset"]), x["stress"]) for x in r]) for r in a), label]
out = []
for row in R["lookup_differs"]:
    line = row["line"]
    n = len(LH.line_tokens(line, True, scheme="v2"))
    res = {}
    for sp in ["1", "1.end", "1.endword", "1.head", "1.headrime", "1.line"] + [f"1.T{k}" for k in range(1, n + 1)]:
        k1, k2 = key("v1", line, sp), key("v2", line, sp)
        res[sp] = "same" if k1 == k2 else {"v1": k1, "v2": k2}
    moved = [sp for sp, v in res.items() if v != "same"]
    out.append({"line": line, "end_changed": row["end_changed"], "moved": moved})
    print(("END " if row["end_changed"] else "    ") + json.dumps(line, ensure_ascii=False)[:60].ljust(62), "moved:", moved)
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
