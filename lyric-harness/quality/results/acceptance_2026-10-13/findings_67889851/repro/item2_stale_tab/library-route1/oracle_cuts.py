# Oracle: token number -> raw character span, per grader tree.
# usage: python3 oracle_cuts.py <tree>/lyric-harness <mode: base|cand> <lines.json>
# base: the tree's own line_tokens (v1), located in the raw line by the same
#       _TOKEN_RUN regex the base harness uses (asserted equal to line_tokens).
# cand: the tree's reader_token_spans(text, False, 'v2') and line_tokens(.., scheme='v2').
import sys, json, os
sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])
import lyric_harness as LH
mode = sys.argv[2]
lines = json.load(open(sys.argv[3]))
out = {}
for t in lines:
    if mode == 'base':
        toks = LH.line_tokens(t, strip_parens=False)
        norm = LH.join_spaced_enclitics(t)
        assert norm == t, ('enclitic join changed the line; spans would not be raw', t)
        spans = [(m.group(0), [[m.start(), m.end()]]) for m in LH._TOKEN_RUN.finditer(norm) if LH.LATIN_SCRIPT.search(m.group(0))]
        assert [s[0] for s in spans] == toks, (spans, toks)
        out[t] = spans
    else:
        sp = LH.reader_token_spans(t, False, 'v2')
        toks = LH.line_tokens(t, strip_parens=False, scheme='v2')
        assert [x for x, _ in sp] == toks, (sp, toks)
        out[t] = [(x, [list(p) for p in ps]) for x, ps in sp]
print(json.dumps(out, ensure_ascii=False))
