import contextlib, os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH
scope = contextlib.nullcontext() if MODE == "base" else LH.reader_scheme_scope(MODE)
with scope:
    lex = LH.Lexicon() if MODE == "base" else LH.Lexicon(reader_scheme=MODE)
    for h in ("-", "‐", "­-"):
        line = "I caught this morning morning's minion, king" + h
        a = LH.line_anchors(lex, line)
        print(MODE, repr(h), "line_tokens:", LH.line_tokens(line)[-1:], "raw_final_token:", LH.raw_final_token(line) if hasattr(LH, "raw_final_token") else "n/a", "n_readings:", len(a[0]), "last syl word/phones:", [(r[-1]["word"], r[-1]["onset"], r[-1]["nucleus"], r[-1]["coda"]) for r in a[0]], "rest:", [repr(x)[:80] for x in a[1:]])
