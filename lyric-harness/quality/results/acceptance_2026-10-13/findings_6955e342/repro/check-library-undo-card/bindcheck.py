"""BB8 re-run (check-library-undo-card): bind each captured /chat declaration
member with the receiving tree's own harness code. Run with cwd = that tree's
lyric-harness (or a shadow of it) and LYRIC_STAGED_DATA set.
Usage: python -I bindcheck.py <run_*.json> <out.json>
Per member: quality.slots.parse_slot -> Slot; the sung line it names (the
document's rows that are neither blank nor a bracketed row, 1-based);
quality.slots.resolve(build_lexicon('v2','none'), line, slot) -> label; the
raw codepoint span of the token the slot indexes, from
lyric_harness.reader_token_spans(line, True) under the tree's resolved
scheme where it exists, else a v1 _TOKEN_RUN pass over the raw line. The
returns field is also parsed by quality.schemes.parse_returns where present
(line classes only) as a cross-check."""
import json
import os
import re
import sys

sys.path.insert(0, os.getcwd())
import lyric_harness as LH  # noqa: E402
from quality import slots as SL  # noqa: E402
from quality import coverage_census as CC  # noqa: E402

src, dst = sys.argv[1], sys.argv[2]
lex = CC.build_lexicon("v2", "none")
scheme = LH.resolve_reader_scheme(None) if hasattr(LH, "resolve_reader_scheme") else "none (tree predates reader schemes)"
try:
    from quality import schemes as SCH
except Exception:  # pragma: no cover
    SCH = None


def token_spans(line):
    if hasattr(LH, "reader_token_spans"):
        got = LH.reader_token_spans(line, True)
        return None if got is None else [(t, [list(p) for p in ps]) for t, ps in got]
    out = []
    for m in LH._TOKEN_RUN.finditer(line):
        if LH.LATIN_SCRIPT.search(m.group(0)):
            out.append((m.group(0), [[m.start(), m.end()]]))
    return out


def sung_lines(doc):
    return [r for r in doc.split("\n") if r.strip() and not re.fullmatch(r"\s*\[.*\]\s*", r)]


run = json.load(open(src, encoding="utf-8"))
res = {"cwd": os.getcwd(), "scheme": scheme, "lexicon": "coverage_census.build_lexicon('v2','none')", "points": {}}
for pt, v in run["payload"].items():
    sent = v.get("sent") or {}
    decl, doc = sent.get("declarations"), sent.get("document")
    if not decl or doc is None:
        res["points"][pt] = {"sent": None}
        print(pt, "NOTHING SENT")
        continue
    lines = sung_lines(doc)
    rows = []
    for field in ("groups", "returns"):
        val = decl.get(field)
        if not val:
            continue
        for g, grp in enumerate(val.split(";")):
            for mem in [m.strip() for m in grp.split(",") if m.strip()]:
                slot = SL.parse_slot(mem)
                line = lines[slot.line - 1]
                anchors, label, oov = SL.resolve(lex, line, slot)
                k = SL.token_of(slot)
                sp = token_spans(line)
                tok = sp[k] if (sp and k is not None and -len(sp) <= k < len(sp)) else None
                rows.append({
                    "field": field, "member": mem, "line_no": slot.line, "line": line,
                    "token_index0": k, "raw_token": tok[0] if tok else None,
                    "raw_chars": tok[1] if tok else None,
                    "text_at_chars": "".join(line[a:b] for a, b in tok[1]) if tok else None,
                    "resolve_label": label, "anchor_count": len(anchors), "oov": oov,
                })
    pr = None
    if SCH is not None and decl.get("returns"):
        try:
            pr = [list(r.lines) for r in SCH.parse_returns(re.sub(r"\.T\d+", "", decl["returns"]), len(lines))]
        except Exception as e:  # noqa: BLE001
            pr = "ERR " + str(e)
    card = ((v.get("pre") or {}).get("renumbered") or {}).get("items") or []
    res["points"][pt] = {"declarations": decl, "document": doc, "sung": lines, "bound": rows,
                         "parse_returns_line_classes": pr,
                         "card_at_send": [f"{m['kind']}:{m['word']}@L{m['n']}" for m in card],
                         "draftId_at_send": (v.get("pre") or {}).get("draftId")}
    for r in rows:
        print(pt, r["field"], r["member"], "->", repr(r["raw_token"]), r["raw_chars"], repr(r["text_at_chars"]),
              "label", repr(r["resolve_label"]), "| card at send:", res["points"][pt]["card_at_send"])
json.dump(res, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("scheme", scheme)
