"""check-order-marker binder (BB8). Reads a /chat payload's declarations the
way the receiving tree's harness does, and reports the word each member binds.

Usage: python bind.py <tree-dir> <in.json> <out.json>
in.json: [{"id": ..., "sung": [line texts], "groups": str|None, "returns": str|None}]

Mandate: built as lyric_harness.py's CLI builds it from --groups= / --returns=
(the CLI's own `_groups` split: ';' then ',', members left as strings), i.e.
SC.mandate(g, n_lines=len(lines), returns=r) when there are returns, else
SC.mandate(g, n_lines=len(lines)). Lexicon: coverage_census.build_lexicon('v2','none').
Per member: Mandate.slot_of (groups) / Return.members() + slots.parse_slot (returns,
exactly as placed_returns_check does), then slots.resolve; the bound word index is
the anchor syllables' `widx`; the raw span is that token's pieces in the raw line
(reader_token_spans where the tree has it; on main, _TOKEN_RUN.finditer checked
equal to line_tokens).
"""
import json
import os
import re
import sys

tree, inp, outp = (os.path.abspath(a) for a in sys.argv[1:4])
H = os.path.join(tree, "lyric-harness")
os.chdir(H)
sys.path.insert(0, H)
import hashlib  # noqa: E402
import lyric_harness as LH  # noqa: E402

# A tree with no cmudict.dict staged beside its module (wt-main: gitignored, absent)
# reads the operator's staged copy instead, only after its bytes and sha256 equal
# THAT tree's own release-manifest entry. Nothing is written into the tree.
STAGED_CMU = "/home/user/CodexMusica/lyric-harness/cmudict.dict"
CMU_NOTE = "tree's own cmudict.dict"
if not os.path.exists(LH.CMUDICT_PATH):
    man = json.load(open(os.path.join(H, "data", "runtime_assets.json")))
    ent = [a for a in man["assets"] if a["id"] == "cmudict"][0]
    f0 = [x for x in ent["files"] if x["path"] == "cmudict.dict"][0]
    blob = open(STAGED_CMU, "rb").read()
    assert len(blob) == f0["bytes"] and hashlib.sha256(blob).hexdigest() == f0["sha256"], "staged cmudict differs from manifest"
    LH.CMUDICT_PATH = STAGED_CMU
    import quality.release_assets as RA
    _orig = RA.verify_asset

    def _verify(asset_id, *a, **k):
        if asset_id == "cmudict":
            return ent  # checked above against this tree's manifest entry
        return _orig(asset_id, *a, **k)
    RA.verify_asset = _verify
    CMU_NOTE = f"staged {STAGED_CMU} (bytes+sha256 == this tree's manifest {f0['sha256'][:12]})"
print("cmudict:", CMU_NOTE, file=sys.stderr)
from quality import schemes as SC, slots as SL, coverage_census as CC  # noqa: E402

lex = CC.build_lexicon("v2", "none")
scheme = getattr(LH, "READER_SCHEME", None)


def spans(line):
    if hasattr(LH, "reader_token_spans"):
        sp = LH.reader_token_spans(line)
        return [(t, [list(p) for p in pcs]) for t, pcs in sp] if sp is not None else None
    out = [(m.group(), [[m.start(), m.end()]]) for m in LH._TOKEN_RUN.finditer(line)
           if LH.LATIN_SCRIPT.search(m.group())]
    if [t for t, _ in out] != LH.line_tokens(line):
        return None
    return out


def groups_split(raw):
    return [[x.strip() for x in g.split(",") if x.strip()] for g in raw.split(";") if g.strip()]


def bound(line_text, slot):
    anc, label, _ = SL.resolve(lex, line_text, slot)
    w = sorted({s.get("widx") for a in anc for s in a if s.get("widx") is not None})
    sp = spans(line_text)
    toks = LH.line_tokens(line_text)
    res = {"label": label, "widx": w, "tokens": toks}
    if w and sp is not None:
        res["raw"] = [{"widx": i, "text": sp[i][0], "pieces": sp[i][1],
                       "raw_text": "".join(line_text[a:b] for a, b in sp[i][1])} for i in w]
    return res


def one(item):
    lines = item["sung"]
    g = groups_split(item["groups"]) if item.get("groups") else []
    r = groups_split(item["returns"]) if item.get("returns") else []
    rec = {"id": item["id"], "reader_scheme": scheme, "groups_wire": item.get("groups"),
           "returns_wire": item.get("returns"), "members": []}
    try:
        m = SC.mandate(g, n_lines=len(lines), returns=r) if r else SC.mandate(g, n_lines=len(lines))
    except Exception as e:  # a refusal is evidence too
        rec["mandate_error"] = f"{type(e).__name__}: {e}"
        return rec
    rec["mandate_groups"] = [list(x) for x in m.groups]
    rec["mandate_loci"] = [[SL.spell_slot(s) if s is not None else None for s in (lo or ())] for lo in m.loci]
    for gi, grp in enumerate(m.groups):
        for ln in grp:
            slot = m.slot_of(gi, ln)
            b = bound(lines[ln - 1], slot)
            rec["members"].append({"kind": "groups", "group": gi, "line": ln, "slot": SL.spell_slot(slot),
                                   "line_text": lines[ln - 1], **b})
    for ri, ret in enumerate(m.returns):
        for ln, locus in ret.members():
            if locus:
                slot = SL.parse_slot(f"1.{locus}")
                b = bound(lines[ln - 1], slot)
            else:
                b = {"label": "(whole line)"}
            rec["members"].append({"kind": "returns", "class": ri, "line": ln, "locus": locus,
                                   "line_text": lines[ln - 1], **b})
    try:
        rec["placed_returns_check"] = [list(map(str, f)) for f in m.placed_returns_check(lines, lex=lex)]
    except Exception as e:
        rec["placed_returns_check_error"] = f"{type(e).__name__}: {e}"
    return rec


items = json.load(open(inp))
out = [one(it) for it in items]
json.dump(out, open(outp, "w"), indent=1, ensure_ascii=False)
for rec in out:
    mem = "; ".join(
        f"{x['kind'][0]}{x.get('group', x.get('class'))} L{x['line']}.{x.get('slot') or x.get('locus') or 'line'}"
        f"->{x.get('label')!r} {[(y['raw_text'], y['pieces']) for y in x.get('raw', [])]}"
        for x in rec["members"])
    print(f"{rec['id']}: scheme={rec['reader_scheme']} g={rec['groups_wire']!r} r={rec['returns_wire']!r} :: {mem}"
          + (f" :: PRC={rec.get('placed_returns_check')}" if rec.get('placed_returns_check') else "")
          + (f" :: ERR {rec.get('mandate_error')}" if rec.get('mandate_error') else ""))
