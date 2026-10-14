"""BB8 f6-bytes-returns: read page_{cand,main,prev61b}.json (drive.js) and the
harness parses (mandate_probe.py), and write:

  rows_matrix.tsv     every (tree, scenario, flow, step, key) row: bytes vs written,
                      mark, member spellings, spacing, vs the policy expectation
  wire_matrix.tsv     every payload sent to /chat, parsed by each harness tree:
                      per return class placed/whole-line + loci; semantic identity
                      against the row as written
  summary.json        the counts and every deviation
Read-only on the trees.

    python3 analyze.py            (after drive.js x3 and mandate_probe.py)
    python3 analyze.py --pairs    (only writes wire_pairs.json for mandate_probe.py)
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = json.load(open(os.path.join(HERE, "scenarios.json"), encoding="utf-8"))
TREES = [t for t in ("cand", "main", "prev61b") if os.path.exists(os.path.join(HERE, f"page_{t}.json"))]
PAGES = {t: json.load(open(os.path.join(HERE, f"page_{t}.json"), encoding="utf-8")) for t in TREES}
C = " (carried across the word-cut change)"
U = " (numbered under the earlier cut)"
M = " — cut v2"
KEYS = {"R": "returns", "G": "rhyme groups"}


def expand(exp):
    return exp.replace(" C", C).replace(" U", U).replace(" M", M)


def row_of(key, value):
    return f"[SETUP — {KEYS[key]} — {value}]"


def find_row(rows, key):
    pre = f"[SETUP — {KEYS[key]} —"
    hits = [r for r in rows if r.strip().startswith(pre)]
    return hits[0] if len(hits) == 1 else (None if not hits else hits)


def value_of(row):
    body = row.strip()[1:-1]
    k = body.index(" — ", len("SETUP — "))
    return body[k + 3:]


def members(value):
    """value (mark stripped) -> [[(line, suffix-with-annotation, raw-with-spaces)]]"""
    v = value[:-len(M)] if value.endswith(M) else value
    out = []
    for g in v.split(";"):
        if not g.strip():
            continue
        grp = []
        for raw in g.split(","):
            if not raw.strip():
                continue
            m = re.match(r"^\s*(\d+)(.*?)\s*$", raw)
            grp.append((int(m.group(1)), m.group(2), raw) if m else (None, raw.strip(), raw))
        out.append(grp)
    return out


def suffixes(value):
    return [[s for (_, s, _) in g] for g in members(value)]


def nospace(s):
    return re.sub(r"\s+", "", s)


REORDER = {**{n: n + 4 for n in range(1, 5)}, **{n: n - 4 for n in range(5, 9)}}


def describe(written_value, got_row, step):
    """Compare one row with the row as written."""
    if got_row is None:
        return {"present": False}
    if isinstance(got_row, list):
        return {"present": True, "multiple": got_row}
    gv = value_of(got_row)
    marked = gv.endswith(M)
    wv = written_value
    w_marked = wv.endswith(M)
    d = {"present": True, "row": got_row, "bytes_kept": got_row == None or None}
    d["bytes_kept"] = got_row == f"[SETUP — {{}} — {wv}]"  # placeholder, fixed by caller
    d["mark_added"] = marked and not w_marked
    d["mark_dropped"] = w_marked and not marked
    ws, gs = suffixes(wv), suffixes(gv)
    flat_w = [s for g in ws for s in g]
    flat_g = [s for g in gs for s in g]
    # annotation-free suffixes (the page's own member-state notes removed)
    strip = lambda s: s.replace(C, "").replace(U, "")
    d["annotated"] = [s for s in flat_g if C in s or U in s]
    d["groups_w"], d["groups_g"] = len(ws), len(gs)
    # spellings of the written members as they stand now (first len(ws) groups;
    # a form appends its own group after them)
    lost = []
    for gi, g in enumerate(ws):
        if gi >= len(gs):
            lost.append(("group missing", gi))
            continue
        for mi, s in enumerate(g):
            if mi >= len(gs[gi]):
                lost.append(("member missing", gi, mi))
                continue
            now = strip(gs[gi][mi])
            if now != s:
                lost.append((s or "(bare)", now or "(bare)"))
    d["spelling_changes"] = lost
    # whitespace inside the written members' part
    wm = members(wv)
    gm = members(gv)
    d["spacing_changed"] = any(
        (a[2] != b[2]) and nospace(a[2]) == nospace(b[2])
        for ga, gb in zip(wm, gm) for a, b in zip(ga, gb)
    ) or (";" in wv and nospace(wv.split(";")[0]) == nospace(gv.split(";")[0]) and wv.split(";")[0] != gv.split(";")[0])
    return d


def scen(sid):
    return next(s for s in SPEC["scenarios"] if s["id"] == sid)


ROW_STEPS = {
    "A": ["load", "reload", "keep", "keep_reload"],
    "R": ["load", "reorder1", "reorder2", "reorder2_reload"],
    "FP": ["form", "form_reload"],
    "FR": ["form", "form_reload"],
    "FD": ["form", "form_reload"],
    "X": ["import_exported_session", "import_exported_txt", "import_original_txt", "import_original_session"],
}


def rows_matrix():
    out = []
    for t in TREES:
        for s in PAGES[t]["scenarios"]:
            if "error" in s:
                out.append({"tree": t, "id": s["id"], "error": s["error"]})
                continue
            sc = scen(s["id"])
            for flow, log in s["flows"].items():
                by = {e["step"]: e for e in log}
                steps = ROW_STEPS[flow] + (["exported"] if flow == "X" else [])
                for st in steps:
                    e = by.get(st)
                    if not e:
                        continue
                    for key in ("R", "G"):
                        if sc.get(key) is None:
                            continue
                        written = row_of(key, sc[key])
                        if st == "exported":
                            for which in ("session_rows", "txt_rows"):
                                got = find_row(e[which], key)
                                d = describe(sc[key], got, st)
                                d["bytes_kept"] = got == written
                                out.append({"tree": t, "id": s["id"], "flow": flow, "step": f"exported_{which}", "key": key, "written": written, **d})
                            continue
                        got = find_row(e["rows"], key)
                        d = describe(sc[key], got, st)
                        d["bytes_kept"] = got == written
                        stored = find_row(e.get("stored_rows", []), key)
                        d["stored_equals_draft"] = stored == got
                        exp_key = "exp" + key
                        if t == "cand" and st in ("load", "reload", "import_original_txt", "import_original_session", "import_exported_session", "import_exported_txt") and flow in ("A", "X", "R"):
                            exp = sc[exp_key]
                            want = written if exp == "=" else row_of(key, expand(exp))
                            d["expected"] = want
                            d["matches_expected"] = got == want
                        out.append({"tree": t, "id": s["id"], "flow": flow, "step": st, "key": key, "written": written, **d})
    return out


def wire_entries():
    out = []
    for t in TREES:
        for s in PAGES[t]["scenarios"]:
            if "error" in s:
                continue
            for flow, log in s["flows"].items():
                for e in log:
                    if not e["step"].endswith(":send"):
                        continue
                    if not e["sent"]:
                        out.append({"tree": t, "id": s["id"], "flow": flow, "step": e["step"], "sent": None, "toast": e.get("toast")})
                        continue
                    for d in e["sent"]:
                        d = d or {}
                        out.append({"tree": t, "id": s["id"], "flow": flow, "step": e["step"],
                                    "sent": {k: d.get(k) for k in ("groups", "returns", "groups_need_decision", "returns_need_decision", "voices")}})
        for name, log in (PAGES[t].get("extras") or {}).items():
            if not isinstance(log, list):
                continue
            for e in log:
                if e["step"].endswith(":send"):
                    d = (e["sent"] or [None])[0] or {}
                    out.append({"tree": t, "id": name, "flow": "extra", "step": e["step"],
                                "sent": {k: d.get(k) for k in ("groups", "returns", "groups_need_decision", "returns_need_decision", "voices")} if e["sent"] else None,
                                "toast": e.get("toast")})
    return out


def pairs(entries):
    keys = set()
    for e in entries:
        if e["sent"]:
            keys.add(json.dumps([e["sent"]["groups"], e["sent"]["returns"]], ensure_ascii=False))
    for s in SPEC["scenarios"]:  # the rows as written: the intended obligation
        keys.add(json.dumps([s["G"], s["R"]], ensure_ascii=False))
        keys.add(json.dumps([None, s["R"]], ensure_ascii=False))
    return sorted(keys)


def sig_returns(parsed):
    """class signature without line numbers and without the T number."""
    if not parsed or "returns" not in parsed:
        return None
    # loci as a sorted multiset per class: a reorder changes line order, not the obligation
    return sorted((c["kind"], tuple(sorted(re.sub(r"^T0*\d+$", "T*", l) for l in c["loci"]))) for c in parsed["returns"])


def per_line_kind(parsed):
    if not parsed or "returns" not in parsed:
        return None
    out = {}
    for c in parsed["returns"]:
        for i, ln in enumerate(c["lines"]):
            out.setdefault(ln, []).append(c["loci"][i] if c["loci"] else "WHOLE")
    return {k: sorted(v) for k, v in sorted(out.items())}


def main():
    entries = wire_entries()
    if "--pairs" in sys.argv:
        json.dump([json.loads(k) for k in pairs(entries)], open(os.path.join(HERE, "wire_pairs.json"), "w"), ensure_ascii=False, indent=0)
        print(f"wrote wire_pairs.json ({len(pairs(entries))} pairs)")
        return
    parsed = json.load(open(os.path.join(HERE, "wire_parsed.json"), encoding="utf-8"))
    rows = rows_matrix()
    # ---- wire: semantic identity against the row as written (parsed by the same harness)
    wire = []
    for e in entries:
        sc = next((s for s in SPEC["scenarios"] if s["id"] == e["id"]), None)
        rec = dict(e)
        if e["sent"]:
            k = json.dumps([e["sent"]["groups"], e["sent"]["returns"]], ensure_ascii=False)
            for tag, P in parsed.items():
                p = P.get(k)
                rec[f"parsed_{tag}"] = p
                rec[f"returns_sig_{tag}"] = sig_returns(p)
                if sc and sc.get("R") is not None and e["sent"]["returns"] is not None:
                    intended = P.get(json.dumps([sc["G"], sc["R"]], ensure_ascii=False))
                    rec[f"intended_sig_{tag}"] = sig_returns(intended)
                    got, want = sig_returns(p) or [], sig_returns(intended) or []
                    # forms add their own class(es): the written classes must all still be there
                    rem = list(got)
                    ok = True
                    for w in want:
                        if w in rem:
                            rem.remove(w)
                        else:
                            ok = False
                    rec[f"returns_semantics_kept_{tag}"] = ok
                    rec[f"returns_extra_classes_{tag}"] = rem
        wire.append(rec)
    with open(os.path.join(HERE, "rows_matrix.tsv"), "w", encoding="utf-8") as f:
        cols = ["tree", "id", "flow", "step", "key", "bytes_kept", "mark_added", "spelling_changes", "spacing_changed", "annotated", "matches_expected", "stored_equals_draft", "written", "row", "expected"]
        f.write("\t".join(cols) + "\n")
        for r in rows:
            f.write("\t".join(json.dumps(r.get(c), ensure_ascii=False) if not isinstance(r.get(c), str) else r.get(c) for c in cols) + "\n")
    with open(os.path.join(HERE, "wire_matrix.tsv"), "w", encoding="utf-8") as f:
        tags = list(parsed)
        cols = ["tree", "id", "flow", "step", "returns", "groups", "returns_need_decision", "groups_need_decision"] + [f"returns_semantics_kept_{t}" for t in tags] + [f"returns_sig_{t}" for t in tags] + [f"intended_sig_{t}" for t in tags]
        f.write("\t".join(cols) + "\n")
        for w in wire:
            s = w["sent"] or {}
            vals = [w["tree"], w["id"], w["flow"], w["step"], s.get("returns"), s.get("groups"), s.get("returns_need_decision"), s.get("groups_need_decision")] + [w.get(c) for c in cols[8:]]
            f.write("\t".join(v if isinstance(v, str) else json.dumps(v, ensure_ascii=False) for v in vals) + "\n")
    json.dump({"rows": rows, "wire": wire}, open(os.path.join(HERE, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"rows {len(rows)} wire {len(wire)}")


if __name__ == "__main__":
    main()
