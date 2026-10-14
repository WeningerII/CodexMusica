import contextlib, os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
from quality.phonology.eng import English
BASE = MODE == "base"
scope = contextlib.nullcontext() if BASE else LH.reader_scheme_scope(MODE)
tail = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
        "Of the rolling level underneath him steady air, and striding",
        "High there, how he rung upon the rein of a wimpling wing"]
with scope:
    lex = LH.Lexicon() if BASE else LH.Lexicon(reader_scheme=MODE)
    phons = {"English(fallback='high') [author test]": lambda: English(fallback="high"),
             "English() no fallback": lambda: English(),
             "relation_phonology_for(Lexicon()) [production judge]": lambda: RV.relation_phonology_for(lex)}
    for pname, mk in phons.items():
        row = {}
        for h in ("-", "‐", "‑", "-­", "­-"):
            lines = ["I caught this morning morning's minion, king" + h] + tail
            ph = mk()
            st = RL.build_stream(lines, ph)
            v = RL.line_pairs_for(RL.REGISTRY["broken rhyme"], st, keep_refusal=True,
                                  requested_pairs={(1, 4)}).verdict((1, 4))
            row[h.encode("unicode_escape").decode()] = v
        print(MODE, pname, "fallback=", getattr(mk(), "fallback", None), row)
