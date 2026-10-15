"""Default-end swap_end_word(lex=) at the tree vs a loop.py variant, over population + crafted/fuzz.
usage: cd <0af>/lyric-harness; python -I probe_variant_end.py ROOT VARIANT.py POP CRAFTED.json OUT.json"""
import os, sys, json, copy, importlib.util
ROOT = os.path.abspath(sys.argv[1]); os.chdir(ROOT); sys.path.insert(0, ROOT)
import lyric_harness as LH
from quality import loop as LP
from quality.coverage_census import build_lexicon
from quality import lexicon_supplement as LS
spec = importlib.util.spec_from_file_location("loop_var", sys.argv[2]); V = importlib.util.module_from_spec(spec); spec.loader.exec_module(V)
pop = [l.rstrip("\n") for l in open(sys.argv[3], encoding="utf-8")]
cj = json.load(open(sys.argv[4], encoding="utf-8")); crafted = cj["crafted"] + cj["fuzz"]
st = build_lexicon("v2", "none")
lexes = {"sup:stripped": st, "sup:voices": LS.SupplementedLexicon(fallback=None, strip_parens=False, version=LS.canonical_version("v2"))}
res = {}; ex = []
for tag, lines in (("population", pop), ("crafted+fuzz", crafted)):
    d = n = 0; dl = set()
    for text in lines:
        for name, lex in lexes.items():
            for w in ("zqxj", "night"):
                n += 1
                a, b = LP.swap_end_word(text, w, lex=lex), V.swap_end_word(text, w, lex=lex)
                if a != b:
                    d += 1; dl.add(text)
                    if len(ex) < 12: ex.append((tag, name, text, w, a, b))
    res[tag] = {"lines": len(lines), "cases": n, "differ": d, "differ_lines": len(dl)}
    print(tag, res[tag], flush=True)
json.dump({"variant": sys.argv[2], "res": res, "examples": ex}, open(sys.argv[5], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for e in ex: print(e)
