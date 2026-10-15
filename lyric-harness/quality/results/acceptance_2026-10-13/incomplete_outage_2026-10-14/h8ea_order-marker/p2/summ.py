"""Pair O1/O2 finals per tree: the line-1 word-place member's bound occurrence (receiving tree's harness), notices."""
import json, sys, os
D = os.path.dirname(os.path.abspath(__file__))
def L(f):
    p = os.path.join(D, f)
    return json.load(open(p)) if os.path.exists(p) else []
rows = []
for tree in ["cand", "c0af", "c695", "c61b", "main"]:
    orders = {r["id"]: r for r in L(f"orders_{tree}.json")}
    binds = {b["id"]: b for b in L(f"bind_{tree}.json")}
    def fin(rid):
        k = [i for i in binds if i.startswith(rid + ".") and i.endswith("FINAL")]
        if not k: return None
        b = binds[k[0]]
        m = [x for x in b["members"] if x["line"] in (1, 3) and (x.get("slot") or "").find(".T") >= 0 or (x.get("locus") or "").startswith("T") and x["line"] == 1]
        m = [x for x in m if x["line"] == 1 or b.get("groups_wire", "") and b["groups_wire"].startswith("3.")]
        x = m[0] if m else None
        prc = [f[3] for f in b.get("placed_returns_check", [])]
        return {"wire": b.get("groups_wire") or b.get("returns_wire"), "slot": x and (x.get("slot") or "1." + x["locus"]),
                "word": x and x["label"], "raw": x and [(y["raw_text"], y["pieces"]) for y in x.get("raw", [])], "prc": prc}
    cases = sorted({r["case"] for r in orders.values()}, key=lambda c: list(orders).index(f"{tree}.{c}.O1"))
    for c in cases:
        o1, o2 = orders[f"{tree}.{c}.O1"], orders[f"{tree}.{c}.O2"]
        f1, f2 = fin(o1["id"]), fin(o2["id"])
        renum = lambda r: any("renumbered" in t for s in r["steps"] for t in s["toasts"])
        same = f1 and f2 and f1["raw"] == f2["raw"]
        rows.append({"tree": tree, "case": c, "same": bool(same),
                     "O1_rows": [s["setup"] for s in o1["steps"]], "O2_rows": [s["setup"] for s in o2["steps"]],
                     "O1": f1, "O2": f2,
                     "O1_renumber_toast": renum(o1), "O2_renumber_toast": renum(o2),
                     "O1_review_cut": o1.get("review", {}).get("mentionsCut"), "O1_review_renum": o1.get("review", {}).get("mentionsRenumber"),
                     "O2_review_cut": o2.get("review", {}).get("mentionsCut"), "O2_review_renum": o2.get("review", {}).get("mentionsRenumber"),
                     "O1_display_after_insert": o1["steps"][0]["display"], "O2_display_final": o2["steps"][-1]["display"],
                     "threw": bool(o1.get("threw") or o2.get("threw"))})
json.dump(rows, open(os.path.join(D, "summary.json"), "w"), indent=1, ensure_ascii=False)
for tree in ["cand", "c0af", "c695", "c61b", "main"]:
    rs = [r for r in rows if r["tree"] == tree]
    print(f"== {tree}: {sum(r['same'] for r in rs)}/{len(rs)} pairs bind the SAME occurrence; threw={sum(r['threw'] for r in rs)}")
    for r in rs:
        a, b = r["O1"] or {}, r["O2"] or {}
        print(f"  {r['case']:<30} same={str(r['same']):<5} O1 {a.get('wire')!r:<28} {a.get('slot')}->{a.get('word')!r} {a.get('raw')} PRC={a.get('prc')} | O2 {b.get('wire')!r:<28} {b.get('slot')}->{b.get('word')!r} {b.get('raw')} PRC={b.get('prc')} | renumToast O1={r['O1_renumber_toast']} O2={r['O2_renumber_toast']} reviewCut O1={r['O1_review_cut']} O2={r['O2_review_cut']}")
