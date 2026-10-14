import sys,json,gzip,hashlib
from pathlib import Path
p=Path(sys.argv[1])/'lyric-harness/quality/results/acceptance_2026-10-13'
def differing_keys(a,b):
 return sorted(k for k in a.keys() | b.keys() if k not in a or k not in b or a[k] != b[k])
assert differing_keys({}, {'new':None}) == ['new']
assert differing_keys({'old':None}, {}) == ['old']
out=[]
for k in range(4):
 paths=[p/f'endpoint_guard_{h}/egw_{h}_{k}.json.gz' for h in ['0af39c6f','8ea94ac9']]
 a,b=[json.load(gzip.open(f,'rt')) for f in paths]
 row={'shard':k,'file_sha256':{str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in paths},'differing_top_keys':differing_keys(a,b),'differing_pins':differing_keys(a['pins'],b['pins']),'part1_equal':a['part1_real_inputs']==b['part1_real_inputs'],'focused_equal':a['part2_focused']==b['part2_focused'],'controls_equal':a['part2_controls']==b['part2_controls']}
 assert row['differing_top_keys']==['pins'] and row['differing_pins']==['commit']
 out.append(row)
print(json.dumps(out,indent=2))
