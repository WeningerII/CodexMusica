import csv,json,collections,hashlib
from pathlib import Path
D=Path('/tmp/m25-qualification')
def read(p):
 with p.open(newline='') as f: return list(csv.DictReader(f,delimiter='\t'))
old=[r for p in sorted((D/'baseline').glob('rows-*.tsv')) for r in read(p)]
new=read(D/'current-calibration-rows.tsv')
def bag(rows): return collections.Counter(tuple(sorted(r.items())) for r in rows)
a,b=bag(old),bag(new)
removed=[dict(r) for r,n in (a-b).items() for _ in range(n)]
added=[dict(r) for r,n in (b-a).items() for _ in range(n)]
def summary(rows):
 return {'items':len(rows),'lines':sum(int(r['n_lines']) for r in rows),'tokens':sum(int(r['n_tokens']) for r in rows),'token_range':[min(int(r['n_tokens']) for r in rows),max(int(r['n_tokens']) for r in rows)],'mattr_ttr_items_at_50':sum(int(r['n_tokens'])<=50 for r in rows)}
result={'baseline_receipt_commit':'0c31fdbc76a4077a3cdbd3d6adc93a82ff34ca4d','comparison':'multiset of every serialized TSV field; row order ignored, multiplicity retained; no field exclusions','baseline':summary(old),'candidate':summary(new),'unchanged_rows':sum((a&b).values()),'removed_or_changed_before':removed,'added_or_changed_after':added}
(D/'row-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
