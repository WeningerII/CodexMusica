import json, subprocess, sys, os
PY, OUT = sys.argv[1], sys.argv[2]
trees = {'base_5ad10a62': sys.argv[3], 'old_1dbc75cf': sys.argv[4], 'rework_c765ca44': sys.argv[5]}
drafts = sys.argv[6:]
res = {}
for name, tree in trees.items():
    for d in drafts:
        p = subprocess.run([PY, 'lyric_harness.py', '--reader-scheme=v2', 'brief', d, 'AA' if 't36' not in d else 'AABB'],
                           capture_output=True, text=True, cwd=os.path.join(tree, 'lyric-harness'), timeout=600)
        rec = None
        for line in p.stdout.splitlines():
            if line.startswith('  lyric result: '):
                rec = json.loads(line[16:])
        rec = rec or {}
        f = sorted({(x['code'], x['severity']) for x in rec.get('findings', [])})
        res.setdefault(os.path.basename(d), {})[name] = {'rc': p.returncode, 'status': rec.get('status'), 'flags': rec.get('flags'), 'findings': f}
json.dump(res, open(OUT, 'w'), indent=1)
for d, v in res.items():
    print('==', d)
    for name, r in v.items():
        print('  %-16s rc=%s flags=%s %s' % (name, r['rc'], r['flags'], [c + ':' + s for c, s in r['findings'] if c not in ('MODAL_RHYME', 'HOMEOTELEUTON')]))
