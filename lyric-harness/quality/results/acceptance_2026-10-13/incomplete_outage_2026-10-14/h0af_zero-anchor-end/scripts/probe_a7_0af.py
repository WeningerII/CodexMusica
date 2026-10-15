"""Is the endpoint pieces/text guard of _end_occurrence_bound reachable at 0af? Compares the tree's
swap_end_word(lex=) with the a7 ablation (guard off) and with a variant where the guard logs, over the
population, the crafted+fuzz lines and synthetic aside/paren lines, in four v2 lexicon modes.
usage: cd <0af>/lyric-harness; python -I probe_a7_0af.py ROOT a7.py POP CRAFTED.json OUT.json"""
import os, sys, json, copy, importlib.util
ROOT = os.path.abspath(sys.argv[1]); os.chdir(ROOT); sys.path.insert(0, ROOT)
import lyric_harness as LH
from quality import loop as LP
from quality.coverage_census import build_lexicon
spec = importlib.util.spec_from_file_location("loop_a7", sys.argv[2]); A7 = importlib.util.module_from_spec(spec); spec.loader.exec_module(A7)
pop = [l.rstrip("\n") for l in open(sys.argv[3], encoding="utf-8")]
cj = json.load(open(sys.argv[4], encoding="utf-8")); crafted = cj["crafted"] + cj["fuzz"]
synthetic = ["hello world (oh)", "hello world (my love)", "I love you (yeah)", "(oh) (ah)", "love me do (do)",
             "hello world (zzqx)", "hello zzqx (world)", "the night (was long)", "and so to bed [sic]", "love me (do",
             "love me do)", "love (me do", "love me (do) night", "love me ((do)", "love me (do))", "love me [do",
             "love me {do}", "love me <do>", "love me (do,", "love me (do.", "love me ( do", "love me (do­",
             "love me （do）", "love me (do)!", "love me (do) .", "love me 'do'", "love me \"(do)\""]
st = build_lexicon("v2", "none"); su = copy.copy(st); su.strip_parens = False
lexes = {"sup:stripped": st, "sup:sung": su, "plain:stripped": LH.Lexicon(reader_scheme="v2"),
         "plain:sung": LH.Lexicon(reader_scheme="v2", strip_parens=False)}
res = {}; ex = []
for tag, lines in (("synthetic", synthetic), ("population", pop), ("crafted+fuzz", crafted)):
    d = n = 0
    for text in lines:
        for name, lex in lexes.items():
            for w in ("zqx", "night"):
                n += 1
                a, b = LP.swap_end_word(text, w, lex=lex), A7.swap_end_word(text, w, lex=lex)
                if a != b:
                    d += 1
                    if len(ex) < 20: ex.append((tag, name, text, w, a, b))
    res[tag] = {"lines": len(lines), "cases": n, "differ": d}
    print(tag, res[tag], flush=True)
json.dump({"res": res, "examples": ex}, open(sys.argv[5], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for e in ex: print(e)
