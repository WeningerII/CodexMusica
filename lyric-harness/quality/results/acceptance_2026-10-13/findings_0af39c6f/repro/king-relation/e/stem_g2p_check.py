import os, sys
LHD = sys.argv[1]; os.chdir(LHD); sys.path.insert(0, LHD)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
with LH.reader_scheme_scope("v2"):
    judge = RV.relation_phonology_for(LH.Lexicon(reader_scheme="v2"))
    for line in ("Just beside the deep inden-", "I caught this morning morning's minion, savour-",
                 "I caught this morning morning's minion, viewest-", "I caught this morning morning's minion, king-"):
        st = RL.build_stream([line, "High there, how he rung upon the rein of a wimpling wing"], judge)
        print(repr(line), "unread:", [w for (li, _, w) in st.unreadable if li == 0], "fallback:", judge.fallback)
