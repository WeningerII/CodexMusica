"""p1 add-on: per pair, is the FINAL /chat payload byte-identical between the orders --
the whole lyric_context.document and the whole declarations object -- and are the final
[SETUP] rows identical. Usage: python3 cmp_docs.py  (prints one line per tree and every
differing pair)"""
import json
import os

D = os.path.dirname(os.path.abspath(__file__))
for tree in ("cand", "c0af", "c695", "c61b", "main"):
    p = os.path.join(D, f"orders_{tree}.json")
    if not os.path.exists(p):
        continue
    cases = {c["id"]: c for c in json.load(open(p))["cases"]}
    base = sorted({i.rsplit(".", 1)[0] for i in cases})
    same_doc = same_decl = same_rows = n = 0
    diffs = []
    for b in base:
        o1, o2 = cases.get(b + ".O1"), cases.get(b + ".O2")
        if not o1 or not o2 or o1.get("threw") or o2.get("threw"):
            diffs.append((b, "missing/threw"))
            continue
        n += 1
        f1 = o1["sends"][-1]["calls"][-1]
        f2 = o2["sends"][-1]["calls"][-1]
        d = f1["document"] == f2["document"]
        e = json.dumps(f1["declarations"], sort_keys=True) == json.dumps(f2["declarations"], sort_keys=True)
        r = o1["steps"][-1]["rows"] == o2["steps"][-1]["rows"]
        same_doc += d
        same_decl += e
        same_rows += r
        if not (d and e and r):
            diffs.append((b, {"doc": d, "decl": e, "rows": r, "O1": f1["declarations"], "O2": f2["declarations"]}))
    print(f"{tree}: pairs={n} same final document={same_doc} same final declarations={same_decl} same final rows={same_rows}")
    for x in diffs:
        print("   DIFF", json.dumps(x, ensure_ascii=False)[:400])
