"""Pair ORDER O1 with ORDER O2 per scenario and tree: the FINAL payload's
line-1 member as the receiving tree's harness binds it (bind_<tree>.json),
plus every step's raw [SETUP] row and cut marker (orders_<tree>.json).
Usage: python3 summary.py  (writes summary.json, prints a table)"""
import json
import os

O = os.path.dirname(os.path.abspath(__file__))
out = []
for tree in ("cand", "c0af", "c695", "c61b", "main"):
    orders = {c["id"]: c for c in json.load(open(f"{O}/orders_{tree}.json"))["cases"]}
    binds = {c["id"]: c for c in json.load(open(f"{O}/bind_{tree}.json"))["cases"]}

    def line1(send):
        for g in send.get("groups_bound", []):
            for m in g:
                if m["line"] == 1:
                    b = m["bound"][0]
                    return {"member": m["member"], "word": m["label"], "span": b["pieces"], "raw": b["raw"]}
        for r in send.get("returns_bound", []):
            for m in r.get("members", []):
                if m["line"] == 1:
                    b = m["bound"][0]
                    return {"member": m["member"], "word": m["label"], "span": b["pieces"], "raw": b["raw"],
                            "placed_returns_check": [f[3] for f in send.get("placed_returns_check", [])] or "clean"}
        return None

    base = sorted({i.rsplit(".", 1)[0] for i in orders})
    for b in base:
        rec = {"tree": tree, "scenario": b}
        for o in ("O1", "O2"):
            cid = f"{b}.{o}"
            if cid not in orders:
                continue
            c = orders[cid]
            sends = binds[cid]["sends"]
            rec[o] = {
                "steps": [{"step": s["step"], "rows": s["rows"], "cut": s["cut"], "pageWords": s["pageWords"],
                           "toasts": s["toasts"]} for s in c["steps"]],
                "payloads": [{"at": s["at"], "declarations": s.get("declarations"), "line1": line1(s)} for s in sends],
                "final": line1(sends[-1]) if sends else None,
                "threw": c.get("threw"),
            }
        f1, f2 = rec.get("O1", {}).get("final"), rec.get("O2", {}).get("final")
        rec["same_final_binding"] = (f1 and f2 and f1["span"] == f2["span"] and f1["word"] == f2["word"])
        out.append(rec)
json.dump(out, open(f"{O}/summary.json", "w"), ensure_ascii=False, indent=1)
print(f"{'tree':<5} {'scenario':<26} {'O1 final (member -> word @span)':<44} {'O2 final':<44} same")
for r in out:
    def fmt(x):
        f = x.get("final") if x else None
        return f"{f['member']} -> {f['word']!r} @{f['span']}" + (f" [{','.join(f['placed_returns_check']) if isinstance(f.get('placed_returns_check'), list) else f.get('placed_returns_check', '')}]" if 'placed_returns_check' in f else '') if f else "-"
    print(f"{r['tree']:<5} {r['scenario']:<26} {fmt(r.get('O1')):<44} {fmt(r.get('O2')):<44} {r['same_final_binding']}")
