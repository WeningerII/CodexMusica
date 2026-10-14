"""probe4.py TREE: for line shapes around a trailing hyphen/dash, what the production relation stream
(relation_phonology_for(None), fallback None) reads for the line's last token, and the perfect-rhyme verdict vs 'wing'."""
import sys, os, contextlib, json
tree = sys.argv[1]
os.chdir(os.path.join(tree, "lyric-harness")); sys.path.insert(0, os.getcwd())
import lyric_harness as LH
import quality.relations as RL
try:
    from quality.revise import relation_phonology_for
except ImportError:
    relation_phonology_for = None
schemes = ("v2", "v1") if hasattr(LH, "reader_scheme_scope") else ("base",)
cases = ["the minion king-", "the minion king -", "the minion king--", "the minion king—", "the minion king —",
         "the minion king-,", "the minion king-.", "the king- dom of a sing", "the minion king", "the minion king-  ",
         "our anguish-", "the minion king‐"]
for sc in schemes:
    scope = LH.reader_scheme_scope(sc) if sc != "base" else contextlib.nullcontext()
    with scope:
        phon = relation_phonology_for(None)
        for c in cases:
            st = RL.build_stream([c, "a wimpling wing"], phon)
            lex0 = st.lexical_tokens[0]
            unread = [u[2] for u in st.unreadable if u[0] == 0]
            v = RL.line_pairs_for(RL.REGISTRY["perfect rhyme"], st, keep_refusal=True, requested_pairs={(1, 2)}).verdict((1, 2))
            b = RL.line_pairs_for(RL.REGISTRY["broken rhyme"], st, keep_refusal=True, requested_pairs={(1, 2)}).verdict((1, 2))
            print(f"{sc:4} {c!r:32} tokens={list(lex0)!r} unreadable={unread!r} perfect={v} broken={b}")
