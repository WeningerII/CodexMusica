import contextlib, json, os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as R
from quality.phonology.eng import English
BASE = MODE == "base"
scope = contextlib.nullcontext() if BASE else LH.reader_scheme_scope(MODE)
with scope:
    L = LH.Lexicon() if BASE else LH.Lexicon(reader_scheme=MODE)
    e = English()
    for w in ["king-", "king‐", "king"]:
        print(MODE, "syllabify", repr(w), "->", len(e.syllabify(w) or []), "syl;",
              "transcribe_word", L.transcribe_word(w))
    for t in ["I caught this morning morning's minion, king-", "the crown of the king‐"]:
        a = LH.line_anchors(L, t)
        print(MODE, "line_anchors", repr(t), "-> end", repr(a[1]), "oov", a[2], "n_anchors", len(a[0]))
        print(MODE, "line_readability", repr(t), "->", LH.line_readability(L, t) if hasattr(LH, "line_readability") else None)
    lines = ["I caught this morning morning's minion, king-",
             "dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
             "Of the rolling level underneath him steady air, and striding",
             "High there, how he rung upon the rein of a wimpling wing"]
    st = R.build_stream(lines, e)
    print(MODE, "stream tokens L0", list(st.lexical_tokens[0]), "unreadable", st.unreadable)
    for name in ("broken rhyme", "perfect rhyme"):
        sch = R.REGISTRY[name]
        print(MODE, name, "(L1 end, L4 end) ->", repr(R.pair_satisfies(sch, st, (0, -1), (3, -1))))
