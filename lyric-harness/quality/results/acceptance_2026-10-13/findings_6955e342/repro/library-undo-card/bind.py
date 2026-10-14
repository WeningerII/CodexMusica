"""Where does the receiving harness bind each declaration member the page sent?
Run from <tree>/lyric-harness with LYRIC_STAGED_DATA set.
Usage: python bind.py <cand|main> <payload.json> <out.json>
For every captured /chat body: the document's sung lines (non-blank rows that
are not a bracketed header/setup row), each groups/returns member parsed with
the tree's own quality.slots.parse_slot, resolved with quality.slots.resolve
over quality.coverage_census.build_lexicon('v2', 'none'), and the raw span of
the token it names (cand: reader_token_spans(line, True, 'v2'); main has no
reader scheme, so its v1 _TOKEN_RUN located in the raw line)."""
import json, os, sys
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
from quality import slots as SL
from quality import coverage_census as CC
mode, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
lex = CC.build_lexicon("v2", "none")
scheme = LH.resolve_reader_scheme(None) if hasattr(LH, "resolve_reader_scheme") else "v1 (pre-batch; no scheme)"


def spans(line):
    if hasattr(LH, "reader_token_spans"):
        return [(t, [list(p) for p in ps]) for t, ps in LH.reader_token_spans(line, True, "v2")]
    return [(m.group(0), [[m.start(), m.end()]]) for m in LH._TOKEN_RUN.finditer(LH.join_spaced_enclitics(line)) if LH.LATIN_SCRIPT.search(m.group(0))]


def sung(doc):
    out = []
    for raw in doc.split("\n"):
        t = raw.strip()
        if not t or (t.startswith("[") and t.endswith("]")):
            continue
        out.append(raw)
    return out


data = json.load(open(src, encoding="utf-8"))
res = {"tree": os.path.dirname(os.getcwd()), "scheme": scheme, "lexicon": "build_lexicon('v2','none')", "points": {}}
for point, v in data["payload"].items():
    ctx = (v.get("sent") or {}).get("lyric_context")
    if not ctx:
        res["points"][point] = {"sent": None}
        continue
    lines = sung(ctx["document"])
    rows = []
    for field in ("groups", "returns"):
        val = ctx["declarations"].get(field)
        if not val:
            continue
        for gi, grp in enumerate(val.split(";")):
            for mem in grp.split(","):
                mem = mem.strip()
                slot = SL.parse_slot(mem)
                line = lines[slot.line - 1]
                anchors, label, oov = SL.resolve(lex, line, slot)
                idx = SL.token_of(slot)
                sp = spans(line)
                tok = sp[idx] if idx is not None and -len(sp) <= idx < len(sp) else None
                rows.append({"field": field, "group": gi, "member": mem, "line_no": slot.line, "line": line,
                             "token_index0": idx, "raw_token": tok[0] if tok else None, "raw_chars": tok[1] if tok else None,
                             "raw_text_at_chars": "".join(line[a:b] for a, b in tok[1]) if tok else None,
                             "resolve_label": label, "anchor_syllables": len(anchors[0]) if anchors else 0, "oov": oov})
    res["points"][point] = {"document": ctx["document"], "declarations": ctx["declarations"], "sung": lines,
                            "page_sung": v["sent"].get("pageSung"), "card_words_at_send": [m["word"] for m in ((v["pre"].get("ui") or {}).get("renumbered") or {}).get("items", [])],
                            "draftId_at_send": v["pre"].get("draftId"), "bound": rows}
    for r in rows:
        print(point, r["field"], r["member"], "->", repr(r["raw_token"]), r["raw_chars"], "label", repr(r["resolve_label"]), "| card lists", res["points"][point]["card_words_at_send"])
json.dump(res, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("scheme", scheme)
