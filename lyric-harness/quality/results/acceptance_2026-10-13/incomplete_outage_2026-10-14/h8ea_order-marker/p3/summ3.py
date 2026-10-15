"""p3 pairing: ORDER 1 vs ORDER 2 per case and tree.
For each pair: the final draft text, the final payload (groups / returns / *_need_decision),
the line-1 numbered member as the RECEIVING tree's harness binds it (bind_<tree>.json from
p2/bind.py), the placed-return verdict, the renumbering record and the Review card at the end,
and whether the form's own message (O1, the form-commit step) says the renumbering.
Usage: python3 summ3.py  (writes summary3.json, prints a table)"""
import json
import os

D = os.path.dirname(os.path.abspath(__file__))
TREES = ["cand", "c0af", "c695", "c61b", "main"]


def L(f):
    p = os.path.join(D, f)
    return json.load(open(p)) if os.path.exists(p) else []


rows = []
for tree in TREES:
    runs = {r["id"]: r for r in L(f"run_{tree}.json")}
    binds = {b["id"]: b for b in L(f"bind_{tree}.json")}

    def fin_bind(rid):
        k = [i for i in binds if i.startswith(rid + ".") and i.endswith("FINAL")]
        if not k:
            return None
        b = binds[k[0]]
        m = [x for x in b.get("members", []) if x["line"] == 1 and ((x.get("slot") or "").find(".T") >= 0 or (x.get("locus") or "").startswith("T"))]
        x = m[0] if m else None
        return {"groups": b.get("groups_wire"), "returns": b.get("returns_wire"),
                "member": x and (x.get("slot") or "1." + x["locus"]), "word": x and x.get("label"),
                "raw": x and [(y["raw_text"], y["pieces"]) for y in x.get("raw", [])],
                "prc": [f[3] for f in b.get("placed_returns_check", [])], "mandate_error": b.get("mandate_error"),
                "whole_line": [(y["line"], y.get("label")) for y in b.get("members", []) if y.get("kind") == "returns" and not y.get("locus")]}

    def last_payload(r):
        for s in reversed(r["sends"]):
            if s["calls"]:
                d = s["calls"][-1]["declarations"] or {}
                return {k: d.get(k) for k in ("groups", "returns", "groups_need_decision", "returns_need_decision")}
        return None

    cases = []
    for r in runs.values():
        if r["case"] not in cases:
            cases.append(r["case"])
    for c in cases:
        o1, o2 = runs.get(f"{tree}.{c}.O1"), runs.get(f"{tree}.{c}.O2")
        if not o1 or not o2:
            continue
        t1 = o1["steps"][-1]["text"] if o1["steps"] and "text" in o1["steps"][-1] else None
        t2 = o2["steps"][-1]["text"] if o2["steps"] and "text" in o2["steps"][-1] else None
        b1, b2 = fin_bind(o1["id"]), fin_bind(o2["id"])
        form1 = [s for s in o1["steps"] if s["step"].split(" ", 1)[1].startswith("form commit")]
        msg1 = " ".join(t for s in form1 for t in s["toasts"])
        rec = lambda r: r["steps"][-1].get("record") if r["steps"] else None
        card = lambda r: (r["steps"][-1].get("card") or {}).get("title") if r["steps"] else None
        rows.append({
            "tree": tree, "case": c,
            "same_text": t1 is not None and t1 == t2,
            "same_payload": last_payload(o1) == last_payload(o2),
            "same_binding": bool(b1 and b2 and b1["raw"] == b2["raw"] and b1["word"] == b2["word"]),
            "same_prc": bool(b1 and b2 and b1["prc"] == b2["prc"]),
            "same_record": rec(o1) == rec(o2),
            "O1_form_message_says_renumbered": "renumbered" in msg1,
            "O1_form_message": msg1[:400],
            "O1_final_rows": o1["steps"][-1]["rows"] if o1["steps"] else None,
            "O2_final_rows": o2["steps"][-1]["rows"] if o2["steps"] else None,
            "O1_payload": last_payload(o1), "O2_payload": last_payload(o2),
            "O1_bind": b1, "O2_bind": b2,
            "O1_refused": [s["refused"] for s in o1["sends"]], "O2_refused": [s["refused"] for s in o2["sends"]],
            "O1_record": rec(o1), "O2_record": rec(o2), "O1_card": card(o1), "O2_card": card(o2),
            "O1_review_mentions": (o1.get("review") or {}).get("mentionsRenumbered"),
            "O2_review_mentions": (o2.get("review") or {}).get("mentionsRenumbered"),
            "threw": [x.get("threw", "").split("\n")[0] for x in (o1, o2) if x.get("threw")],
        })
json.dump(rows, open(os.path.join(D, "summary3.json"), "w"), indent=1, ensure_ascii=False)
for tree in TREES:
    rs = [r for r in rows if r["tree"] == tree]
    if not rs:
        continue
    ok = sum(r["same_text"] and r["same_payload"] and r["same_binding"] and r["same_prc"] for r in rs)
    print(f"== {tree}: {ok}/{len(rs)} pairs identical (text, payload, binding, verdict)")
    for r in rs:
        a, b = r["O1_bind"] or {}, r["O2_bind"] or {}
        print(f"  {r['case']:<22} text={r['same_text']!s:<5} payload={r['same_payload']!s:<5} bind={r['same_binding']!s:<5} prc={r['same_prc']!s:<5} record={r['same_record']!s:<5} msgRenum={r['O1_form_message_says_renumbered']!s:<5}"
              f" | O1 {a.get('member')}->{a.get('word')!r} {a.get('raw')} PRC={a.get('prc')} refused={r['O1_refused']}"
              f" | O2 {b.get('member')}->{b.get('word')!r} {b.get('raw')} PRC={b.get('prc')} refused={r['O2_refused']}"
              f" | card O1={r['O1_card']!r} O2={r['O2_card']!r}{' THREW ' + str(r['threw']) if r['threw'] else ''}")
