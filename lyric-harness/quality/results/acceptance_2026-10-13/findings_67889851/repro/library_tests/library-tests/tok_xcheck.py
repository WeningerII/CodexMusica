import sys, json
sys.path.insert(0, '.')
import lyric_harness as h
line = 'Oh--oh, oh my love'
out = {'tree': sys.argv[1], 'line_tokens': h.line_tokens(line, False)}
for name in ('_line_tokens_v1', '_v1_token_spans'):
    f = getattr(h, name, None)
    if f:
        try: out[name] = f(line, False)
        except TypeError: out[name] = f(line)
print(json.dumps(out, default=str))
