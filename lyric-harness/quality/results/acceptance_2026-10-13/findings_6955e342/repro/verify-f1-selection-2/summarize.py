import json, glob, os, collections
O = os.path.dirname(os.path.abspath(__file__))
out = {}
for f in sorted(glob.glob(os.path.join(O, 'sel_*_chatClick-reviewKbd-reviewClick-reviewProg_top-bottom.json'))):
    d = json.load(open(f))
    tally = collections.OrderedDict()
    for c in d['cases']:
        trig = c['id'].split('.')[1]
        t = tally.setdefault(trig, {'cases': 0, 'pasteKept': 0, 'migratedAtBoundary': 0, 'sameChars': 0, 'afterEqLyMapOffset': 0, 'afterSel': collections.Counter(), 'ZQrow': collections.Counter()})
        t['cases'] += 1
        t['pasteKept'] += bool(c.get('pasteKeptBytes'))
        t['migratedAtBoundary'] += bool(c.get('migrated'))
        t['sameChars'] += bool(c.get('sameChars'))
        if c.get('pageMapPredicted') and c['after']['sel'][:2] == c['pageMapPredicted']: t['afterEqLyMapOffset'] += 1
        t['afterSel'][f"{c['id'].split('.')[2]} {c['before']['sel'][:2]}->{c['after']['sel'][:2]}"] += 1
        t['ZQrow'][(c.get('typedZQ') or {}).get('rowNow')] += 1
    out[d['label']] = {k: {**v, 'afterSel': dict(v['afterSel']), 'ZQrow': dict(v['ZQrow'])} for k, v in tally.items()}
json.dump(out, open(os.path.join(O, 'summary.json'), 'w'), indent=1, ensure_ascii=False)
for lab, t in out.items():
    for trig, v in t.items():
        print(lab, trig, {k: v[k] for k in ('cases', 'pasteKept', 'migratedAtBoundary', 'sameChars', 'afterEqLyMapOffset')})
        for k, n in v['afterSel'].items(): print('     ', n, 'x', k)
