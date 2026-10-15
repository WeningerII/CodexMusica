"""Every production path of the default end on the (a) list, at one tree.

    cd <tree>/lyric-harness
    python -I a_paths.py ROOT analysis.json OUT.json

For each line of the (a) list (union over the v2 modes) and each v2 lexicon
mode (plain/supplemented x stripped/sung): slots.resolve's default-end binding,
then swap_end_word(lex=), swap_at_slot(1, lex=), swap_at_slot(1.end, scheme,
strip_parens, lex) (Reviser._splice's own call), Reviser(lex)._splice(text, 1|1.end, w),
default_propose(brief), and default_propose_group with a readable sibling --
for several candidates. A path that returns a line is an EDIT."""
import copy
import json
import os
import sys
from types import SimpleNamespace

ROOT = os.path.abspath(sys.argv[1])
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import lyric_harness as LH  # noqa: E402
from quality import slots as SL  # noqa: E402
import quality.loop as LP  # noqa: E402
from quality.revise import Reviser  # noqa: E402
from quality.coverage_census import build_lexicon  # noqa: E402

A = json.load(open(sys.argv[2], encoding="utf-8"))["a"]
lines = sorted({r["line"] for m in A.values() for r in m["rows"]})
plain_st = LH.Lexicon(reader_scheme="v2")
plain_su = LH.Lexicon(reader_scheme="v2", strip_parens=False)
sup_st = build_lexicon("v2", "none")
sup_su = copy.copy(sup_st)
sup_su.strip_parens = False
LEX = {"v2plain:stripped": plain_st, "v2plain:sung": plain_su,
       "v2sup:stripped": sup_st, "v2sup:sung": sup_su}
CANDS = ["zqzq", "night", "remember"]
END = SL.parse_slot("1.end")
SIB = "the night was cold"
out = []
tot = {"cases": 0, "edits": 0, "edits_where_unbound": 0}
REV = {m: Reviser(lx) for m, lx in LEX.items()}   # one reviser per grading lexicon
for text in lines:
    for mode, lex in LEX.items():
        anchors, label, _ = SL.resolve(lex, text, 1)
        rev = REV[mode]
        rec = {"line": text, "mode": mode, "n_anchors": len(anchors), "label": label, "paths": {}}
        for w in CANDS:
            p = {
                "swap_end_word(lex)": LP.swap_end_word(text, w, lex=lex),
                "swap_at_slot(1,lex)": LP.swap_at_slot(text, 1, w, lex=lex),
                "swap_at_slot(1.end,_splice-args)": LP.swap_at_slot(
                    text, END, w, scheme=LH._scheme_of(lex), strip_parens=lex.strip_parens, lex=lex),
                "Reviser._splice(1)": rev._splice(text, 1, w),
                "Reviser._splice(1.end)": rev._splice(text, END, w),
                "default_propose": LP.default_propose(
                    SimpleNamespace(text=text, slot=None, line_no=1, candidates=[w]), [text], 0,
                    scheme="v2", strip_parens=lex.strip_parens, lex=lex),
                "default_propose_group": LP.default_propose_group(
                    SimpleNamespace(members=(1, 2), proposal_for={1: (SIB, w, None), 2: (text, w, None)}.get),
                    scheme="v2", strip_parens=lex.strip_parens, lex=lex),
            }
            rec["paths"][w] = p
            for v in p.values():
                tot["cases"] += 1
                if v is not None:
                    tot["edits"] += 1
                    if not anchors:
                        tot["edits_where_unbound"] += 1
        out.append(rec)
json.dump({"lines": len(lines), "totals": tot, "rows": out}, open(sys.argv[3], "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("lines", len(lines), tot)
