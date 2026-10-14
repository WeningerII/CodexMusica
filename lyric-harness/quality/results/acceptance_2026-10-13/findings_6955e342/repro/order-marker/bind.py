"""BB8 order-marker: what each captured /chat payload's declarations BIND, as
the harness at the tree that would receive it reads them.

Run from <tree>/lyric-harness (so `import lyric_harness` is that tree's):
    LYRIC_STAGED_DATA=... python bind.py <tree-label> <orders_<tree>.json> <out.json>

For every send of every case: the declarations' `groups` / `returns` strings
are split exactly as the CLI's `_groups` splits `--groups=` / `--returns=`
(lyric_harness.py, verbatim below), handed to `quality.schemes.mandate` as the
CLI hands them, and every member is resolved with `quality.slots.resolve`
(placed return members as `Mandate.placed_returns_check` resolves them:
`parse_slot(f"1.{place}")` on the member's own line). The bound occurrence is
the resolved anchor's word index (`widx`) mapped to that tree's raw token span
(`reader_token_spans` where the tree has it; at main, which has no such
function, the n-th `line_tokens` token located left to right in the line).
"""
import json
import os
import sys

sys.path.insert(0, os.getcwd())
import lyric_harness as LH  # noqa: E402

TREE, SRC, DST = sys.argv[1], sys.argv[2], sys.argv[3]
if TREE == "main" and not os.path.exists(LH.CMUDICT_PATH):
    # main reads cmudict.dict beside its own module (gitignored, not staged in
    # the worktree); point it at the staged copy instead of writing into the
    # worktree, after checking that copy against MAIN's own release manifest
    # entry (bytes + sha256), and answer main's verify_asset("cmudict") with
    # that same manifest entry. Every other asset is verified by main as is.
    import hashlib
    from pathlib import Path
    from quality import release_assets as _RA
    sub = "/home/user/CodexMusica/lyric-harness/cmudict.dict"
    ent = next(a for a in _RA.manifest(Path(LH.HERE) / "data" / _RA.MANIFEST.name)["assets"]
               if a["id"] == "cmudict")
    f0 = next(f for f in ent["files"] if f["path"] == "cmudict.dict")
    blob = open(sub, "rb").read()
    assert len(blob) == f0["bytes"] and hashlib.sha256(blob).hexdigest() == f0["sha256"], "staged cmudict differs from main's manifest"
    LH.CMUDICT_PATH = sub
    _orig_verify = _RA.verify_asset
    _RA.verify_asset = lambda asset_id, **kw: ent if asset_id == "cmudict" else _orig_verify(asset_id, **kw)
    print(f"main: cmudict.dict taken from {sub} (sha256 {f0['sha256'][:12]}.. == main manifest)", file=sys.stderr)
from quality import coverage_census as C  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality import slots as SL  # noqa: E402

LEX = C.build_lexicon("v2", "none")


def _groups(raw):  # lyric_harness.py CLI, verbatim
    return [[x.strip() for x in g.split(",") if x.strip()]
            for g in raw.split(";") if g.strip()]


def spans(line):
    if hasattr(LH, "reader_token_spans"):
        sp = LH.reader_token_spans(line, True)
        return None if sp is None else [(t, [list(p) for p in pcs]) for t, pcs in sp]
    toks = LH.line_tokens(line, True)
    out, at = [], 0
    folded = line.replace("’", "'").replace("‘", "'")
    for t in toks:
        k = folded.find(t, at)
        if k < 0:
            return None
        out.append((t, [[k, k + len(t)]]))
        at = k + len(t)
    return out


def bind(line_text, slot_or_int, spelled):
    try:
        anc, label, _ = SL.resolve(LEX, line_text, slot_or_int)
    except Exception as e:  # a refusal is a result
        return {"member": spelled, "error": f"{type(e).__name__}: {e}"}
    if not anc:
        return {"member": spelled, "word": None, "note": "no anchor"}
    widx = sorted({s.get("widx") for s in anc[0] if s.get("widx") is not None})
    sp = spans(line_text)
    raw = []
    for w in widx:
        if sp and w < len(sp):
            t, pcs = sp[w]
            raw.append({"widx": w, "token": t, "pieces": pcs,
                        "raw": "".join(line_text[a:b] for a, b in pcs),
                        "number_T": w + 1})
    return {"member": spelled, "label": label, "bound": raw,
            "syllables": [{k: s.get(k) for k in ("word", "nucleus", "coda", "stress")} for s in anc[0]]}


def judge(decl, lines):
    out = {"groups_raw": decl.get("groups"), "returns_raw": decl.get("returns"),
           "need_decision": {k: v for k, v in decl.items() if k.endswith("_need_decision")}}
    g = _groups(decl["groups"]) if decl.get("groups") else []
    r = _groups(decl["returns"]) if decl.get("returns") else []
    try:
        m = SC.mandate(g, n_lines=len(lines), returns=r) if r else SC.mandate(g, n_lines=len(lines))
    except Exception as e:
        out["mandate_error"] = f"{type(e).__name__}: {e}"
        return out
    out["mandate"] = {"groups": [list(x) for x in m.groups], "loci": repr(m.loci),
                      "returns": [repr(x) for x in m.returns]}
    gb = []
    for gi, grp in enumerate(m.groups):
        loc = m.loci[gi] if gi < len(m.loci) else ""
        mem = []
        for k, ln in enumerate(grp):
            slot = loc[k] if loc and k < len(loc) and loc[k] is not None else ln
            spelled = SL.spell_slot(slot) if not isinstance(slot, int) else str(ln)
            mem.append({"line": ln, "line_text": lines[ln - 1], **bind(lines[ln - 1], slot, spelled)})
        gb.append(mem)
    out["groups_bound"] = gb
    rb = []
    for ret in m.returns:
        if getattr(ret, "placed", False):
            mem = []
            for i, place in ret.members():
                mem.append({"line": i, "line_text": lines[i - 1],
                            **bind(lines[i - 1], SL.parse_slot(f"1.{place}"), f"{i}.{place}")})
            rb.append({"placed": True, "members": mem})
        else:
            rb.append({"placed": False, "lines": list(ret.lines)})
    out["returns_bound"] = rb
    if any(getattr(x, "placed", False) for x in m.returns):
        out["placed_returns_check"] = [list(map(str, f)) for f in m.placed_returns_check(lines, LEX)]
    return out


data = json.load(open(SRC, encoding="utf-8"))
res = {"tree": TREE, "reader_scheme": getattr(LH, "READER_SCHEME", "(none: single cut)"), "cases": []}
for c in data["cases"]:
    row = {"id": c["id"], "sends": []}
    for s in c.get("sends", []):
        for call in s["calls"]:
            if not call.get("declarations"):
                row["sends"].append({"at": s["at"], "no_declarations": True})
                continue
            row["sends"].append({"at": s["at"], "declarations": call["declarations"],
                                 **judge(call["declarations"], call["sung"])})
    res["cases"].append(row)
json.dump(res, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# compact print: the line-1 member of every group / return, per send
for row in res["cases"]:
    for s in row["sends"]:
        if s.get("no_declarations"):
            print(f"{row['id']:<40} {s['at']:<18} (no declarations)")
            continue
        if "mandate_error" in s:
            print(f"{row['id']:<40} {s['at']:<18} MANDATE REFUSED: {s['mandate_error'][:160]}")
            continue
        bits = []
        for g in s.get("groups_bound", []):
            for mbr in g:
                if mbr["line"] == 1:
                    b = mbr.get("bound") or [{}]
                    bits.append(f"groups {mbr['member']} -> {mbr.get('label')!r} raw[{b[0].get('pieces')}]={b[0].get('raw')!r} (T{b[0].get('number_T')})")
        for rr in s.get("returns_bound", []):
            for mbr in rr.get("members", []):
                if mbr["line"] == 1:
                    b = mbr.get("bound") or [{}]
                    bits.append(f"returns {mbr['member']} -> {mbr.get('label')!r} raw[{b[0].get('pieces')}]={b[0].get('raw')!r}")
        prc = s.get("placed_returns_check")
        if prc is not None:
            bits.append(f"placed_returns_check={[f[3] for f in prc] or 'clean'}")
        print(f"{row['id']:<40} {s['at']:<18} {s['groups_raw'] or ''}|{s['returns_raw'] or ''}  " + "; ".join(bits))
