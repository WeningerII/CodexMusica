"""Which guard refuses a v2 default-end case, at one tree (re-derived independently of
loop.py's control flow, then checked against the tree's actual answer).

    cd <tree>/lyric-harness
    python -I reason.py ROOT analysis.json OUT.json

Input: analysis.json's (c) rows (the 1,760 crafted cases). For each:
  prot      swap_end_word(text, w, scheme='v2') -- the protections, no grading lexicon
  pieces    last token of the lexicon's cut == the kept-cut token swap_end_word replaces
  anchors   slots.resolve(lex, text, 1): number of readings; label; last-syllable widx/word
  endpoint  every reading's last syllable on the last token, same spelling
  run/last  the raw last run's text vs the last reader token's text (the 61b label-vs-token mismatch)
  derived   'edit' iff prot and pieces and anchors and endpoint
  actual    the tree's production answer (Reviser._splice call shape)"""
import collections
import json
import os
import sys

ROOT = os.path.abspath(sys.argv[1])
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import lyric_harness as LH  # noqa: E402
from quality import slots as SL  # noqa: E402
import quality.loop as LP  # noqa: E402
from quality.coverage_census import build_lexicon  # noqa: E402
from quality import lexicon_supplement as LS  # noqa: E402

rows = json.load(open(sys.argv[2], encoding="utf-8"))["c"]["rows"]
LEX = {"sup:stripped": build_lexicon("v2", "none"),
       "sup:voices": LS.SupplementedLexicon(fallback=None, strip_parens=False,
                                            version=LS.canonical_version("v2"))}
END = SL.parse_slot("1.end")
tally = collections.Counter()
out = []
for r in rows:
    text, mode, w = r["line"], r["mode"], r["cand"]
    lex = LEX[mode]
    lx = lex.for_line(text) if hasattr(lex, "for_line") else lex
    prot = LP.swap_end_word(text, w, scheme="v2")
    kept = LH.reader_line(text, False, "v2")
    cut = LH.reader_line(text, getattr(lx, "strip_parens", True), "v2").tokens
    replaced = kept.tokens[-1] if kept.tokens else None
    pieces = bool(cut) and replaced is not None and cut[-1].pieces == replaced.pieces and cut[-1].text == replaced.text
    try:
        anchors, label, _ = SL.resolve(lex, text, 1)
        unsup = False
    except SL.SlotUnsupported:
        anchors, label, unsup = [], None, True
    endpoint = bool(anchors) and all(
        a and isinstance(a[-1].get("widx"), int) and a[-1]["widx"] == len(cut) - 1
        and a[-1].get("word") == cut[-1].text for a in anchors)
    derived = prot is not None and pieces and bool(anchors) and endpoint
    actual = LP.swap_at_slot(text, END, w, scheme=LH._scheme_of(lex), strip_parens=lex.strip_parens, lex=lex)
    run_text = kept.runs[-1].text if kept.runs else None
    last_text = cut[-1].text if cut else None
    reason = ("edit" if actual is not None else
              "protections" if prot is None else
              "pieces" if not pieces else
              "unsupported" if unsup else
              "zero_anchor" if not anchors else
              "endpoint" if not endpoint else "??")
    tally[(reason, "label==last_token" if label == last_text else "label!=last_token",
           "run==token" if run_text == last_text else "run!=token")] += 1
    out.append({"line": text, "mode": mode, "cand": w, "reason": reason, "derived_edit": derived,
                "actual": actual, "label": label, "last_token": last_text, "last_run": run_text,
                "n_anchors": len(anchors), "agree": derived == (actual is not None)})
assert all(o["agree"] for o in out), [o for o in out if not o["agree"]][:5]
json.dump({"tally": {"|".join(k): v for k, v in tally.items()}, "rows": out},
          open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(dict(tally))
