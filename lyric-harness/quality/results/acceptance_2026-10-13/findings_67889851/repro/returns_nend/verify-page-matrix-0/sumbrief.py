import json, sys
for p in sys.argv[1:]:
    txt = open(p, encoding='utf-8').read()
    res = None
    for line in txt.splitlines():
        s = line.strip()
        if s.startswith('lyric result:'):
            res = json.loads(s[len('lyric result:'):].strip())
    name = p.rsplit('/', 1)[-1]
    if res is None:
        print(f'{name}: NO RESULT'); continue
    out = {'status': res.get('status')}
    if res.get('refusal'): out['refusal'] = res['refusal'][:160]
    cov = res.get('coverage') or {}
    out['return_obligations'] = [(o['id'], o['status']) for o in cov.get('obligations', []) if o.get('layer') == 'return']
    out['refused_obligations'] = [o.get('id') if isinstance(o, dict) else o for o in cov.get('refused_obligations', [])]
    out['return_findings'] = [(f['code'], f['severity'], f['message'][:170]) for f in res.get('findings', []) if 'RETURN' in f['code']]
    dr = [l.strip() for l in txt.splitlines() if l.strip().startswith(('DECLARED RETURNS', 'L1~', 'L4~', 'L5~', 'L2~', 'L3~'))]
    out['declared_returns_text'] = dr
    print(name); print('  ' + json.dumps(out, ensure_ascii=False, indent=1).replace('\n', '\n  '))
