"""Human-readable tables from summary.json (analyze.py) -> report.txt. Read-only."""
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(HERE, "summary.json"), encoding="utf-8"))
SPEC = json.load(open(os.path.join(HERE, "scenarios.json"), encoding="utf-8"))
P = json.load(open(os.path.join(HERE, "wire_parsed.json"), encoding="utf-8"))
out = []
w = out.append
TREES = ["cand", "main", "prev61b"]
rows = S["rows"]


def short(r):
    return r.replace(" (carried across the word-cut change)", " (C)").replace(" (numbered under the earlier cut)", " (U)") if isinstance(r, str) else r


# ---------------- (a) unchanged rows: bytes through every path ----------------
w("=" * 100)
w("(a) UNCHANGED-BINDING ROWS (U1-U13, M1): is every byte kept? (bytes_kept = row identical to the row as written)")
w("    steps where the row's bytes are NOT expected to change by construction: load, reload, keep, keep_reload, exports, imports")
w("=" * 100)
U = [s["id"] for s in SPEC["scenarios"] if s["id"].startswith("U") or s["id"] == "M1"]
IDENT_STEPS = {("A", "load"), ("A", "reload"), ("A", "keep"), ("A", "keep_reload"), ("R", "load"),
               ("X", "exported_session_rows"), ("X", "exported_txt_rows"), ("X", "import_exported_session"),
               ("X", "import_exported_txt"), ("X", "import_original_txt"), ("X", "import_original_session")}
for t in TREES:
    tot = kept = 0
    bad = []
    for r in rows:
        if r.get("tree") != t or r.get("id") not in U or (r.get("flow"), r.get("step")) not in IDENT_STEPS:
            continue
        tot += 1
        if r.get("bytes_kept"):
            kept += 1
        else:
            bad.append(f"   {r['id']} {r['key']} {r['flow']}/{r['step']}: {short(r.get('row'))}  (written {r['written']})")
    w(f"[{t}] identity steps: {kept}/{tot} rows byte-identical")
    for b in bad:
        w(b)
    # stored == draft
    sd = [r for r in rows if r.get("tree") == t and r.get("id") in U and r.get("stored_equals_draft") is False]
    w(f"[{t}] rows whose saved (localStorage) copy differs from the draft: {len(sd)}")

# Rows that a writer action necessarily rewrites (reorder renumbers lines; forms add a group):
w("")
w("-" * 100)
w("(a, continued) WRITER ACTIONS ON UNCHANGED ROWS: reorder (lines renumber), Repeats form (FP), Rhymes form (FR), Declare exact repeat (FD)")
w("    reported: mark added? member spelling changed (written -> now, line numbers ignored)? whitespace changed? the OTHER key's row untouched?")
w("-" * 100)
ACT = [("R", "reorder1"), ("R", "reorder2"), ("R", "reorder2_reload"), ("FP", "form"), ("FR", "form"), ("FD", "form")]
for t in TREES:
    agg = defaultdict(lambda: defaultdict(int))
    lines = []
    for r in rows:
        if r.get("tree") != t or r.get("id") not in U or (r.get("flow"), r.get("step")) not in ACT:
            continue
        k = f"{r['flow']}/{r['step']}/{r['key']}"
        agg[k]["n"] += 1
        agg[k]["bytes_kept"] += bool(r.get("bytes_kept"))
        agg[k]["mark_added"] += bool(r.get("mark_added"))
        agg[k]["spelling_changed"] += bool(r.get("spelling_changes"))
        agg[k]["spacing_changed"] += bool(r.get("spacing_changed"))
        if r.get("spelling_changes"):
            lines.append(f"   {r['id']} {k}: {r['spelling_changes']}  -> {short(r.get('row'))}")
    w(f"[{t}]")
    for k, v in sorted(agg.items()):
        w(f"   {k:28s} n={v['n']:2d} bytes_kept={v['bytes_kept']:2d} mark_added={v['mark_added']:2d} spelling_changed={v['spelling_changed']:2d} spacing_changed={v['spacing_changed']:2d}")
    for l in lines:
        w(l)

# ---------------- (b) rewritten rows ----------------
w("")
w("=" * 100)
w("(b) ROWS THE MIGRATION REWRITES (W1-W11): candidate row after load vs the policy expectation; main and 61b for contrast")
w("=" * 100)
for s in SPEC["scenarios"]:
    if not s["id"].startswith("W"):
        continue
    for key in ("R", "G"):
        w(f"{s['id']} {key} written: [{s[key]}]{'  voices ON' if s['voices'] else ''}{'  NOTE ' + s['note'] if s.get('note') else ''}")
        for t in TREES:
            for st in ("load", "keep"):
                r = next((x for x in rows if x.get("tree") == t and x.get("id") == s["id"] and x.get("flow") == "A" and x.get("step") == st and x.get("key") == key), None)
                if not r:
                    continue
                extra = ""
                if t == "cand" and st == "load":
                    extra = f"  matches_expected={r.get('matches_expected')}"
                    if not r.get("matches_expected"):
                        extra += f"  EXPECTED {short(r.get('expected'))}"
                w(f"   [{t:7s}] {st:5s} {short(r.get('row'))}{extra}")

# ---------------- (c) wire ----------------
w("")
w("=" * 100)
w("(c) WHAT WENT ON THE WIRE (/chat lyric_context.declarations.returns) and how each harness parses it")
w("    sig = per return class (kind, loci with T<n> as T*), line numbers ignored; 'kept' = every class of the row as written")
w("    is still there with the same kind and loci (forms may add classes)")
w("=" * 100)
wire = S["wire"]
for t in TREES:
    agg = defaultdict(lambda: [0, 0, 0])
    devs = []
    for e in wire:
        if e["tree"] != t or e["flow"] == "extra":
            continue
        sc = next((x for x in SPEC["scenarios"] if x["id"] == e["id"]), None)
        if not e["sent"]:
            agg[(e["flow"], e["step"])][2] += 1
            continue
        k = e.get("returns_semantics_kept_6955e342")
        if k is None:
            continue
        a = agg[(e["flow"], e["step"])]
        a[0] += 1
        a[1] += bool(k)
        if not k:
            pk = json.dumps([e["sent"]["groups"], e["sent"]["returns"]], ensure_ascii=False)
            pc = P["6955e342"].get(pk, {})
            devs.append(f"   {e['id']} {e['flow']}/{e['step']}: written R [{sc['R']}] -> sent returns {e['sent']['returns']!r} groups {e['sent']['groups']!r}"
                        f"\n        intended {e.get('intended_sig_6955e342')}\n        parsed   {e.get('returns_sig_6955e342') if 'returns' in pc else pc}")
    w(f"[{t}] returns semantics kept per step (kept/sent; blocked sends):")
    for k, (n, ok, blocked) in sorted(agg.items()):
        w(f"   {k[0]:3s}/{k[1]:32s} kept {ok}/{n}  not sent {blocked}")
    for d in devs:
        w(d)

# song8 rows of the task (c)
w("")
w("-" * 100)
w("(c, detail) the song8 rows named in the task, per member: placed (locus) or WHOLE (line), parsed by the candidate harness 6955e342 (base fce4bf0f identical: see same_in_base)")
w("-" * 100)
FOCUS = {"W1": "4.end,6.end", "W2": "5.end,6.end;1.T4,8.T4", "W3": "1.end,6.head"}


def per_member(p):
    if not p or "returns" not in p:
        return p
    out = []
    for c in p["returns"]:
        out.append("{" + ", ".join(f"L{ln}:{(c['loci'][i] if c['loci'] else 'WHOLE')}" for i, ln in enumerate(c["lines"])) + "}")
    return " ".join(out)


for sid, row in FOCUS.items():
    w(f"{sid} written returns [{row}]")
    for t in TREES:
        for e in wire:
            if e["tree"] != t or e["id"] != sid:
                continue
            if not e["sent"]:
                w(f"   [{t:7s}] {e['flow']}/{e['step']:28s} NOT SENT  {e.get('toast')}")
                continue
            pk = json.dumps([e["sent"]["groups"], e["sent"]["returns"]], ensure_ascii=False)
            pc, pb = P["6955e342"].get(pk), P["fce4bf0f"].get(pk)
            w(f"   [{t:7s}] {e['flow']}/{e['step']:28s} sent {e['sent']['returns']!r:44s} -> {per_member(pc)}  same_in_base={pc == pb}")

# extras
w("")
w("=" * 100)
w("EXTRAS: voices toggle (V_U11), hand-pasted unmarked row + form / send / reorder / declare (P_*)")
w("=" * 100)
for t in TREES:
    pg = json.load(open(os.path.join(HERE, f"page_{t}.json"), encoding="utf-8"))
    for name, log in (pg.get("extras") or {}).items():
        if not isinstance(log, list):
            w(f"[{t}] {name}: {log}")
            continue
        w(f"[{t}] {name}")
        for e in log:
            if "rows" in e and not e["step"].endswith(":send"):
                w(f"     {e['step']:18s} rows {[short(x) for x in e['rows']]}")
            elif e["step"].endswith(":send"):
                d = (e["sent"] or [None])[0]
                w(f"     {e['step']:18s} sent {json.dumps({k: v for k, v in (d or {}).items() if k in ('groups', 'returns', 'groups_need_decision', 'returns_need_decision', 'readings_need_decision')}, ensure_ascii=False) if d else 'NOT SENT ' + json.dumps(e.get('toast'), ensure_ascii=False)}")
                w(f"     {'':18s} rows after send {[short(x) for x in e['rows_after_send']]}")
open(os.path.join(HERE, "report.txt"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("\n".join(out))
