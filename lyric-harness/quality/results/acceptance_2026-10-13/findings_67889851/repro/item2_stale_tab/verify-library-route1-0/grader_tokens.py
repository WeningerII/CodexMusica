import sys, json
sys.path.insert(0, '.')
import lyric_harness as H
for line in ['Oh--oh, oh, oh my love', 'Oh--oh, oh my love']:
    toks = H.line_tokens(line, strip_parens=False)
    low = line.lower(); cur = 0; out = []
    for k, t in enumerate(toks, 1):
        i = low.find(t.lower(), cur)
        out.append([k, t, [i, i + len(t)] if i >= 0 else None]); cur = (i + len(t)) if i >= 0 else cur
    print(sys.argv[1], json.dumps(line), json.dumps(out))
