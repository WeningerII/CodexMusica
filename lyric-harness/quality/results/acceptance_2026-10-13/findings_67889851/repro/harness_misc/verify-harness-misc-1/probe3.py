import sys, os, contextlib
tree = sys.argv[1]
os.chdir(os.path.join(tree, "lyric-harness")); sys.path.insert(0, os.getcwd())
import lyric_harness as LH
schemes = ("v2", "v1") if hasattr(LH, "reader_scheme_scope") else ("base",)
for h in ("-", "‐", "­-"):
    line = "I caught this morning morning's minion, king" + h
    for sc in schemes:
        scope = LH.reader_scheme_scope(sc) if sc != "base" else contextlib.nullcontext()
        with scope:
            lex = LH.Lexicon()
            a = LH.line_anchors(lex, line)
            anc = a[0]
            last = [[(x["word"], x["widx"], x["onset"], x["nucleus"], x["coda"]) for x in r][-1] for r in anc]
            print(sc, repr(h), "line_anchors last syllable per reading ->", last, "| other fields:", repr(a[1:])[:200])
