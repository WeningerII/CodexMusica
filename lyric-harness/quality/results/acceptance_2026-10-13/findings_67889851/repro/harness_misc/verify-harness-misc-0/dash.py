"""Does a line ending in word+ASCII-hyphen (dash used as punctuation) lose its end word in the
relation stream for an ordinary schema too?  usage: dash.py TREE MODE"""
import contextlib, os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
scope = contextlib.nullcontext() if MODE == "base" else LH.reader_scheme_scope(MODE)
with scope:
    lex = LH.Lexicon() if MODE == "base" else LH.Lexicon(reader_scheme=MODE)
    ph = RV.relation_phonology_for(lex)
    names = [n for n in ("perfect rhyme", "masculine rhyme", "rhyme", "end rhyme") if n in RL.REGISTRY]
    for end in ("Fears-", "Fears"):
        lines = ["of past regrets and future " + end, "And all the coming of the years"]
        st = RL.build_stream(lines, ph)
        for n in names:
            v = RL.line_pairs_for(RL.REGISTRY[n], st, keep_refusal=True, requested_pairs={(1, 2)}).verdict((1, 2))
            print(MODE, repr(end), n, "->", v, "unreadable:", [u for u in st.unreadable if u[0] == 0])
