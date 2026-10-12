"""Every end word where the grader's anchor reader and the grid reader disagree (dev side, v2). Read-only."""
import sys, os, glob, collections, json, re
sys.path.insert(0, '.')
import lyric_harness as LH
from quality import grid as G
from quality.coverage_census import build_lexicon, items_of, POPULATIONS, ROOT
from quality.coverage_split import checked_assignment
lex = build_lexicon('v2', 'none'); key = G.rime_cmudict(lex)
assign, _ = checked_assignment(); keep = {u for u, s in assign.items() if s == 'dev'}
paths = sorted({p for g in POPULATIONS['song'] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
lines_n = 0; both_read = both_unread = 0
dis = collections.Counter(); ex = collections.defaultdict(collections.Counter)
def cause(a_tok, g_tok):
    g = g_tok or ''
    if not g: return 'grid: no end token'
    if not re.search(r'[A-Za-z]', g): return 'grid ends on punctuation-only token (e.g. "--")'
    if a_tok and LH.fold_apostrophes(a_tok).lower() != LH.fold_apostrophes(re.sub(r'^\W+|\W+$', '', g)).lower():
        if '-' in g.strip('-'): return 'hyphenated: grid reads whole token, anchor reads last piece'
        return 'different word chosen as end word'
    if '-' in g.strip('-'): return 'hyphenated: grid reads whole token, anchor reads last piece'
    if "'" in g or '’' in g: return 'apostrophe form'
    return 'same word, readers disagree'
for path in paths:
    rel = os.path.relpath(path, ROOT); ordinal = -1
    for _t, lines in items_of(path):
        if not lines: continue
        ordinal += 1
        if f"{rel}#{ordinal}" not in keep: continue
        for line in lines:
            a = LH.raw_final_token(line, strip_parens=lex.strip_parens)
            g = G._end_word(line) or None
            if not a and not g: continue
            lines_n += 1
            a_ok = bool(a) and bool(LH.line_anchors(lex, line)[0])
            g_ok = bool(g) and key(g) is not None
            if a_ok and g_ok: both_read += 1; continue
            if not a_ok and not g_ok: both_unread += 1; continue
            side = 'anchor reads, grid refuses' if a_ok else 'grid reads, anchor refuses'
            c = side + ' | ' + cause(a, g)
            dis[c] += 1; ex[c][g or a] += 1
out = {"lines": lines_n, "both_read": both_read, "both_unread": both_unread,
       "disagree": sum(dis.values()),
       "by_cause": [[c, n, len(ex[c]), [w for w, _ in ex[c].most_common(8)]] for c, n in dis.most_common()]}
json.dump(out, open(sys.argv[1], 'w'), indent=1, ensure_ascii=False)
print(json.dumps({k: out[k] for k in ('lines', 'both_read', 'both_unread', 'disagree')}))
for c, n, k, w in out['by_cause']: print(n, f'({k} distinct)', c, w)
