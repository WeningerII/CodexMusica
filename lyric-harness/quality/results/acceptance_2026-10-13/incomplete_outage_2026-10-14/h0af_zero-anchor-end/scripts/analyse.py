"""Join the endmatrix dumps (out/em_<tag>.jsonl.gz) and answer (a)-(d).

    python -I analyse.py F
writes F/out/analysis.json and prints a summary."""
import collections
import gzip
import json
import os
import sys

F = sys.argv[1]
OUT = os.path.join(F, "out")
SK = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/so3/skeptic-counterexamples"
TAGS = ["695", "61b", "t3e77", "trev", "0af"]
V2 = ["v2plain:stripped", "v2plain:sung", "v2sup:stripped", "v2sup:sung", "v2sup:voices"]
V1 = ["v1plain:stripped", "v1plain:sung", "v1sup:stripped", "v1sup:sung"]


def load(tag):
    d = {}
    for rec in map(json.loads, gzip.open(os.path.join(OUT, f"em_{tag}.jsonl.gz"), "rt", encoding="utf-8")):
        d[(rec["src"], rec["line"], rec["mode"])] = rec
    return d


D = {t: load(t) for t in TAGS}
keys = list(D["0af"])
for t in TAGS:
    assert set(D[t]) == set(keys), t


def unbound(rec):
    b = rec["bind"]
    return (not b.get("unsupported")) and b["n"] == 0


res = {}

# ---------------------------------------------------------------- (a)
# r2-tests skeptic's list: population, swap_at_slot(text, 1, 'zqzq', lex=lex) edits while
# slots.resolve binds no anchors -- at 61b and at 6955 -- for the plain v2 lexicons
# ("cur:stripped"/"cur:sung" in end_unbound.py), plus the supplemented lexicons.
EXCL = set(json.load(open(os.path.join(SK, "bb8_excluded_lines.json"), encoding="utf-8")))
a = {}
for mode in V2:
    lst = {}
    for tag in ("61b", "695"):
        lst[tag] = sorted(k[1] for k in keys if k[0] == "pop" and k[2] == mode
                          and D[tag][k]["r2form"] is not None and unbound(D[tag][k]))
    rows = []
    for line in lst["695"]:
        k = ("pop", line, mode)
        r0 = D["0af"][k]
        rows.append({
            "line": line,
            "spaced_enclitic_excluded_by_slot_tool": line in EXCL,
            "0af_bind_n": r0["bind"].get("n"), "0af_label": r0["bind"].get("label"),
            "695_r2form": D["695"][k]["r2form"],
            "0af_r2form": r0["r2form"],
            "0af_prod": r0["out"],
            "0af_all_refuse": r0["r2form"] is None and all(v is None for v in r0["out"].values()),
            "trev_r2form": D["trev"][k]["r2form"],
            "t3e77_r2form": D["t3e77"][k]["r2form"],
        })
    a[mode] = {
        "n_61b": len(lst["61b"]), "n_695": len(lst["695"]),
        "same_list_61b_695": lst["61b"] == lst["695"],
        "n_excluded_in_list": sum(r["spaced_enclitic_excluded_by_slot_tool"] for r in rows),
        "n_0af_all_refuse": sum(r["0af_all_refuse"] for r in rows),
        "n_0af_still_unbound": sum(r["0af_bind_n"] == 0 for r in rows),
        "n_0af_r2form_edit": sum(r["0af_r2form"] is not None for r in rows),
        "n_t3e77_r2form_edit": sum(r["t3e77_r2form"] is not None for r in rows),
        "n_trev_r2form_edit": sum(r["trev_r2form"] is not None for r in rows),
        "rows": rows,
    }
    # any v2 default-end production edit at 0af where the grader binds zero syllables (any line, any cand)
    a[mode]["0af_any_unbound_edit"] = [
        (k[0], k[1], w, v) for k in keys if k[2] == mode and unbound(D["0af"][k])
        for w, v in list(D["0af"][k]["out"].items()) + [("r2form", D["0af"][k]["r2form"])] if v is not None]
res["a"] = a

# ---------------------------------------------------------------- (b) + (d)
def compare(t1, t2, modes):
    out = collections.Counter()
    diffs = []
    for k in keys:
        if k[2] not in modes:
            continue
        r1, r2 = D[t1][k], D[t2][k]
        b1, b2 = r1["bind"], r2["bind"]
        cands = list(r1["out"]) + ["r2form"]
        for w in cands:
            o1 = r1["r2form"] if w == "r2form" else r1["out"][w]
            o2 = r2["r2form"] if w == "r2form" else r2["out"][w]
            bindkind = ("bind_changed" if b1 != b2 else
                        "unsupported" if b1.get("unsupported") else
                        "unbound" if b1["n"] == 0 else "bound")
            if o1 == o2:
                out[(k[0], bindkind, "same")] += 1
                continue
            kind = ("edit->refuse" if o1 is not None and o2 is None else
                    "refuse->edit" if o1 is None else "edit->otheredit")
            out[(k[0], bindkind, kind)] += 1
            diffs.append({"src": k[0], "line": k[1], "mode": k[2], "cand": w, t1: o1, t2: o2,
                          "bind_" + t1: b1, "bind_" + t2: b2, "kind": kind, "bindkind": bindkind})
    return {"counts": {"|".join(x): n for x, n in sorted(out.items())}, "diffs": diffs}


res["b_695_vs_0af_v2"] = compare("695", "0af", V2)
res["b_trev_vs_0af_v2"] = compare("trev", "0af", V2)       # exactly the 3e77 loop change
res["b_695_vs_trev_v2"] = compare("695", "trev", V2)       # the later commits only (82fe, 0af)
res["b_t3e77_vs_0af_v2"] = compare("t3e77", "0af", V2)     # later commits, 3e77 loop present
res["b_695_vs_61b_v2"] = compare("695", "61b", V2)
res["d_695_vs_0af_v1"] = compare("695", "0af", V1)
res["d_61b_vs_0af_v1"] = compare("61b", "0af", V1)
res["d_trev_vs_0af_v1"] = compare("trev", "0af", V1)

# ---------------------------------------------------------------- (c)
# the 1,760 crafted/fuzz cases: 67889851 edited, 61b6618a refused (skeptic dumps end_678/end_61b).
def sk(tag):
    d = {}
    for r in map(json.loads, gzip.open(os.path.join(SK, f"end_{tag}.jsonl.gz"), "rt", encoding="utf-8")):
        d[(r["line"], r["mode"], r["cand"])] = r["out"]
    return d


s678, s61b = sk("678"), sk("61b")
assert set(s678) == set(s61b)
cases = [k for k in s678 if s678[k] is not None and s61b[k] is None]
back = [k for k in s678 if s678[k] is None and s61b[k] is not None]
MODEMAP = {"sup:stripped": "v2sup:stripped", "sup:voices": "v2sup:voices"}
fate = collections.Counter()
c_rows = []
for line, mode, cand in cases:
    k = ("craft", line, MODEMAP[mode])
    r0, r61 = D["0af"][k], D["61b"][k]
    assert r61["out"][cand] is None, (line, mode, cand)   # reproduces the skeptic's 61b refusal
    o = r0["out"][cand]
    b = r0["bind"]
    fate[("0af_edit" if o is not None else "0af_refuse",
           "unsupported" if b.get("unsupported") else ("zero_anchor" if b["n"] == 0 else "bound"),
           "prot_edits" if r0["prot"][cand] is not None else "prot_refuses")] += 1
    c_rows.append({"line": line, "mode": mode, "cand": cand, "678": s678[(line, mode, cand)],
                   "61b": None, "0af": o, "0af_bind": b, "0af_prot": r0["prot"][cand],
                   "695": D["695"][k]["out"][cand], "trev": D["trev"][k]["out"][cand]})
res["c"] = {"n_cases": len(cases), "n_lines": len({c[0] for c in cases}), "n_refuse_to_edit_678_61b": len(back),
            "fate": {"|".join(x): n for x, n in fate.items()}, "rows": c_rows}

json.dump(res, open(os.path.join(OUT, "analysis.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- print
for mode in V2:
    x = a[mode]
    print("(a)", mode, {k: v for k, v in x.items() if k not in ("rows", "0af_any_unbound_edit")},
          "0af_any_unbound_edit:", len(x["0af_any_unbound_edit"]))
for name in ("b_695_vs_0af_v2", "b_trev_vs_0af_v2", "b_695_vs_trev_v2", "b_t3e77_vs_0af_v2",
             "b_695_vs_61b_v2", "d_695_vs_0af_v1", "d_61b_vs_0af_v1", "d_trev_vs_0af_v1"):
    c = res[name]["counts"]
    print(name, {k: v for k, v in c.items() if not k.endswith("|same")}, "same:",
          sum(v for k, v in c.items() if k.endswith("|same")))
print("(c)", {k: v for k, v in res["c"].items() if k != "rows"})
