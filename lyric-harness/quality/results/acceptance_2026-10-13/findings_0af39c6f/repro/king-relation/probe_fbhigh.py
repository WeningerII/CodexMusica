import os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
TAIL = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
        "Of the rolling level underneath him steady air, and striding",
        "High there, how he rung upon the rein of a wimpling waver"]
L1 = "I caught this morning morning's minion, "
with LH.reader_scheme_scope(MODE):
    for fb in (None, "high"):
        lex = LH.Lexicon(fallback=fb, reader_scheme=MODE)
        judge = RV.relation_phonology_for(lex)
        for end in ("savour-", "savour", "inden-", "king-"):
            first = L1 + end
            st = RL.build_stream([first] + TAIL, judge)
            v = {rel: RL.line_pairs_for(RL.REGISTRY[rel], st, keep_refusal=True, requested_pairs={(1, 4)}).verdict((1, 4))
                 for rel in ("broken rhyme", "perfect rhyme")}
            anc, lw, _ = LH.line_anchors(lex, first)
            print(MODE, "lex.fallback=", fb, "judge.fallback=", judge.fallback, repr(end), v,
                  "unread:", [w for (li, _, w) in st.unreadable if li == 0], "| line_anchors reads:", bool(anc))
