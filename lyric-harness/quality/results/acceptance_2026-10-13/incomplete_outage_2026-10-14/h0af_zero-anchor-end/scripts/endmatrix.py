"""Default-END splice matrix on one tree (zero-anchor-end acceptance, 3e77a5d9).

    cd <tree>/lyric-harness
    LYRIC_STAGED_DATA=... python -I endmatrix.py ROOT OUT.jsonl.gz POPULATION.txt CRAFTED_LINES.json

For every line (population + the counterexample skeptic's crafted/fuzz lines)
and every lexicon mode, records:
  * the grader's default-end binding, slots.resolve(lex, text, 1):
    n_readings, label, the set of last-syllable widx, unsupported flag;
  * the production splice exactly as revise.Reviser._splice calls it
    (swap_at_slot(text, 1.end, w, scheme=_scheme_of(lex), strip_parens=lex.strip_parens, lex=lex))
    for each candidate;
  * the r2-tests skeptic's form swap_at_slot(text, 1, 'zqzq', lex=lex);
  * (v2 only) the protections-only splice swap_end_word(text, w, scheme='v2')
    (no lex) -- used to tell which guard refused.
Nothing in the tree is modified.
"""
import copy
import gzip
import json
import os
import sys
import time

ROOT = os.path.abspath(sys.argv[1])
OUT = sys.argv[2]
POP = sys.argv[3]
CRAFT = sys.argv[4]
LIMIT = int(os.environ.get("EM_LIMIT", "0"))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

import lyric_harness as LH  # noqa: E402
from quality import slots as SL  # noqa: E402
import quality.loop as LP  # noqa: E402
from quality.coverage_census import build_lexicon  # noqa: E402
from quality import lexicon_supplement as LS  # noqa: E402

CANDS = ["zqzq", "zqxj", "night", "remember", "o'er", "'s"]
END = SL.parse_slot("1.end")


def lexicons():
    plain_st = LH.Lexicon(reader_scheme="v2")
    plain_su = LH.Lexicon(reader_scheme="v2", strip_parens=False)
    sup_st = build_lexicon("v2", "none")
    sup_su = copy.copy(sup_st)
    sup_su.strip_parens = False
    sup_voices = LS.SupplementedLexicon(fallback=None, strip_parens=False,
                                        version=LS.canonical_version("v2"))
    out = {"v2plain:stripped": plain_st, "v2plain:sung": plain_su,
           "v2sup:stripped": sup_st, "v2sup:sung": sup_su, "v2sup:voices": sup_voices}
    v1p = LH.Lexicon(reader_scheme="v1")
    v1ps = LH.Lexicon(reader_scheme="v1", strip_parens=False)
    v1s = sup_st.with_reader_scheme("v1")
    v1ss = copy.copy(v1s)
    v1ss.strip_parens = False
    out.update({"v1plain:stripped": v1p, "v1plain:sung": v1ps,
                "v1sup:stripped": v1s, "v1sup:sung": v1ss})
    for m, lx in out.items():
        assert LH._scheme_of(lx) == m[:2], (m, LH._scheme_of(lx))
    return out


def binding(lex, text):
    try:
        anchors, label, _ = SL.resolve(lex, text, 1)
    except SL.SlotUnsupported:
        return {"unsupported": True}
    ws = []
    for r in anchors:
        if not r:
            ws.append(None)
            continue
        w = r[-1].get("widx")
        ws.append([w if isinstance(w, int) and not isinstance(w, bool) else None, r[-1].get("word")])
    return {"n": len(anchors), "label": label, "ends": ws}


def main():
    pop = [l.rstrip("\n") for l in open(POP, encoding="utf-8")]
    cj = json.load(open(CRAFT, encoding="utf-8"))
    crafted = cj["crafted"] + cj["fuzz"]
    srcs = [("pop", pop), ("craft", crafted)]
    lexes = lexicons()
    t0 = time.time()
    n = 0
    with gzip.open(OUT, "wt", encoding="utf-8") as gz:
        for src, lines in srcs:
            if LIMIT:
                lines = lines[:LIMIT]
            for i, text in enumerate(lines):
                for mode, lex in lexes.items():
                    rec = {"src": src, "i": i, "line": text, "mode": mode,
                           "bind": binding(lex, text)}
                    sch = LH._scheme_of(lex)
                    outs = {}
                    for w in CANDS:
                        outs[w] = LP.swap_at_slot(text, END, w, scheme=sch,
                                                  strip_parens=getattr(lex, "strip_parens", True),
                                                  lex=lex)
                    rec["out"] = outs
                    rec["r2form"] = LP.swap_at_slot(text, 1, "zqzq", lex=lex)
                    if sch == "v2":
                        rec["prot"] = {w: LP.swap_end_word(text, w, scheme="v2") for w in CANDS}
                    gz.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    n += 1
                if i % 500 == 0:
                    print(src, i, len(lines), round(time.time() - t0), flush=True)
    print("records", n, "seconds", round(time.time() - t0))


if __name__ == "__main__":
    main()
