# Which characters does the GRADER bind each sent pronunciation row to?
# usage: python3 bind_spans.py <tree>/lyric-harness <base|cand> <page_result.json> <scenario> <step>
# Runs the tree's own validate_choices (Lexicon strip_parens=False, as the
# Library server builds it) one row at a time, then for_line() to get the token
# index the declaration attaches to, then that token's raw span (base: v1
# _TOKEN_RUN located in the raw line; cand: reader_token_spans(..., 'v2')).
import sys, json, os
sys.path.insert(0, sys.argv[1]); os.chdir(sys.argv[1])
import lyric_harness as LH
from quality.pronunciation import validate_choices, for_line
mode, res, scen, step = sys.argv[2], json.load(open(sys.argv[3])), sys.argv[4], sys.argv[5]
st = next(s for s in res['scenarios'][scen]['steps'] if s['label'] == step)
ds = st['sent_declaration_set']
lex = LH.Lexicon(strip_parens=False)
def spans(t):
    if mode == 'base':
        return [(m.group(0), [[m.start(), m.end()]]) for m in LH._TOKEN_RUN.finditer(LH.join_spaced_enclitics(t)) if LH.LATIN_SCRIPT.search(m.group(0))]
    return [(x, [list(p) for p in ps]) for x, ps in LH.reader_token_spans(t, False, 'v2')]
out = []
if ds is None:
    print(json.dumps({'tree': sys.argv[1], 'scenario': scen, 'step': step, 'sent': None}))
    sys.exit()
for r in ds.get('pronunciations', []):
    try:
        ok = validate_choices([r], lex)
        lx = LH.Lexicon.__new__(LH.Lexicon); lx.__dict__.update(lex.__dict__); lx.pronunciations = ok
        bound = for_line(lx, r['line'])._pronunciation_tokens
        (idx,) = bound.keys()
        sp = spans(r['line'])[idx]
        out.append({'word': r['word'], 'token_sent': r['token'], 'grader': 'accepted', 'binds_token_index0': idx, 'binds_text': sp[0], 'binds_chars': sp[1], 'line': r['line']})
    except ValueError as e:
        out.append({'word': r['word'], 'token_sent': r['token'], 'grader': f'REFUSED: {e}', 'line': r['line']})
print(json.dumps({'tree': sys.argv[1], 'scheme': getattr(lex, 'reader_scheme', 'v1 (pre-batch, no scheme attr)'), 'scenario': scen, 'step': step, 'rows': out}, ensure_ascii=False))
