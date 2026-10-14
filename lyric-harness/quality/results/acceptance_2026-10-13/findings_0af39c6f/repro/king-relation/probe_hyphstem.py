import os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
L4 = "High there, how he rung upon the rein of a wimpling wing"
with LH.reader_scheme_scope(MODE):
    lex = LH.Lexicon(reader_scheme=MODE); judge = RV.relation_phonology_for(lex)
    for end in ("x-ray-", "well-known-", "twenty-two-", "co-op-", "self-", "Catch-22-", "re-", "a-", "I-", "'tis-", "ev'ry-", "o-", "ding-dong-", "sing-song-"):
        first = "I caught this morning minion, " + end
        st = RL.build_stream([first, L4], judge)
        v = RL.line_pairs_for(RL.REGISTRY["perfect rhyme"], st, keep_refusal=True, requested_pairs={(1, 2)}).verdict((1, 2))
        anc, lw, _ = LH.line_anchors(lex, first)
        sr = not any(li == 0 and w == st.lexical_tokens[0][-1] for (li, _, w) in st.unreadable)
        print(MODE, f"{end!r:16}", "stream_reads:", sr, "perfect:", v, "| anchors:", bool(anc),
              "AGREE" if sr == bool(anc) else "DISAGREE")
