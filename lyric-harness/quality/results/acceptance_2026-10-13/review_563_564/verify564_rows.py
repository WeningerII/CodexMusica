import csv, json, collections, hashlib, sys
from pathlib import Path
E = Path(sys.argv[1])
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
ah = json.loads((E/'artifact-hashes.json').read_text())
for name, v in ah.items():
    p = E/name
    if p.exists():
        print('hash', name, 'OK' if sha(p)==v['sha256'] and p.stat().st_size==v['bytes'] else f'MISMATCH {sha(p)} {p.stat().st_size}')
    else:
        print('hash', name, 'NOT COMMITTED')
for i in range(1,5):
    m = json.loads((E/f'baseline/rows-{i}-of-4.meta.json').read_text()); p = E/f'baseline/rows-{i}-of-4.tsv'
    rows = list(csv.DictReader(p.open(newline=''), delimiter='\t'))
    print('shard', i, 'meta items', m['items'], 'rows', len(rows), 'row_sha ok', sha(p)==m['row_sha256'])
cm = json.loads((E/'current-calibration-rows.meta.json').read_text())
def read(p): return list(csv.DictReader(p.open(newline=''), delimiter='\t'))
old = [r for i in range(1,5) for r in read(E/f'baseline/rows-{i}-of-4.tsv')]
new = read(E/'current-calibration-rows.tsv')
print('current meta items', cm['items'], 'rows', len(new), 'row_sha ok', sha(E/'current-calibration-rows.tsv')==cm['row_sha256'])
# raw-line multiset too (byte-level, independent of DictReader)
def lines(p): 
    t = p.read_bytes().split(b'\n'); return t[0], [l for l in t[1:] if l]
hdrs=set(); ol=collections.Counter(); 
for i in range(1,5):
    h,l = lines(E/f'baseline/rows-{i}-of-4.tsv'); hdrs.add(h); ol.update(l)
h2,nl = lines(E/'current-calibration-rows.tsv'); nl=collections.Counter(nl)
print('headers equal', hdrs=={h2}, len(hdrs))
print('raw lines: baseline', sum(ol.values()), 'current', sum(nl.values()), 'common', sum((ol&nl).values()), 'removed', sum((ol-nl).values()), 'added', sum((nl-ol).values()))
a = collections.Counter(tuple(sorted(r.items())) for r in old); b = collections.Counter(tuple(sorted(r.items())) for r in new)
removed = [dict(r) for r,n in (a-b).items() for _ in range(n)]
rc = json.loads((E/'row-comparison.json').read_text())
print('dict multiset: unchanged', sum((a&b).values()), 'removed', len(removed), 'added', sum((b-a).values()))
print('row-comparison.json: unchanged', rc['unchanged_rows'], 'removed', len(rc['removed_or_changed_before']), 'added', len(rc['added_or_changed_after']))
key = lambda r: json.dumps(r, sort_keys=True)
print('removed set == row-comparison removed', sorted(map(key,removed))==sorted(map(key,rc['removed_or_changed_before'])))
def summary(rows):
    return {'items':len(rows),'lines':sum(int(r['n_lines']) for r in rows),'tokens':sum(int(r['n_tokens']) for r in rows),'token_range':[min(int(r['n_tokens']) for r in rows),max(int(r['n_tokens']) for r in rows)],'mattr_ttr_items_at_50':sum(int(r['n_tokens'])<=50 for r in rows)}
print('baseline', summary(old), 'json', rc['baseline']); print('candidate', summary(new), 'json', rc['candidate'])
print('removed n_lines sum', sum(int(r['n_lines']) for r in removed), 'tokens', sum(int(r['n_tokens']) for r in removed))
cols = list(new[0].keys()); print('columns', cols[:12], '...', len(cols))
idcol = [c for c in cols if c in ('id','item','key','file','source','title','item_id')]
for r in removed: print('REMOVED', {k: r[k] for k in cols[:4]}, 'n_lines', r['n_lines'], 'n_tokens', r['n_tokens'])
# predictability tsv
p = E/'current-predictability.tsv'; t=p.read_text().splitlines(); print('predictability lines', len(t), t[0][:200])
