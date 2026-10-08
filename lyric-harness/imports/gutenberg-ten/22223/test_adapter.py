"""Run with the downloaded source: python test_adapter.py /tmp/22223.txt."""
import json,re,sys
from pathlib import Path
from adapter import parse
root=Path(__file__).parent
items=parse(sys.argv[1])
assert items==json.loads((root/'candidates.json').read_text())
assert len(items)==269
assert sum(x['disposition']=='eligible' for x in items)==258
assert len({x['id'] for x in items})==269
index=json.loads((root/'index.json').read_text())
assert len(index)==len({x['candidate_id'] for x in index})==265
assert {x['title'] for x in items if x['id'] not in {r['candidate_id'] for r in index}}=={'Weep No More','My True Love','Content','Song'}
assert next(x for x in items if x['title']=='The Rime Of The Ancient Mariner')['disposition']=='excluded'
assert not any(x['title'].startswith('Part ') for x in items)
print('22223: 269 faithful complete units;265 distinct index mappings;11 whole-work exclusions')
ornaments=next(x for x in items if x['id']=='pg22223-031')
assert ornaments['text'].count('# APPARATUS: ...................................')==3
assert len(ornaments['transformations'])==3
assert not any(re.fullmatch(r'[. *·—–-]{3,}',line.strip()) for x in items for line in x['text'].splitlines())

# Verify actual staged text through the existing reader; no shared-reader changes.
import importlib.util,tempfile
sys.path.insert(0,str(root.parents[2]))
from quality.lyric_reader import normalized_rows
spec=importlib.util.spec_from_file_location('gutenberg_staging',root.parent/'integrate.py')
staging=importlib.util.module_from_spec(spec);spec.loader.exec_module(staging)
checked_rows=0
with tempfile.TemporaryDirectory(prefix='gutenberg-reader-') as td:
 for item in items:
  if item['disposition']!='eligible':continue
  expected=[line.strip() for line in item['text'].splitlines() if line.strip() and not line.startswith('#') and line.strip() not in {'[CHORUS]','[REFRAIN]'}]
  path=Path(td)/(item['id']+'.txt')
  path.write_text('--- TITLE: '+item['title']+'\n\n'+staging.marked_text(item)+'\n')
  actual=[row.text for row in normalized_rows(path) if row.kind=='lyric']
  assert actual==expected,(item['id'],[(a,b) for a,b in zip(expected,actual) if a!=b][:3])
  checked_rows+=len(actual)
print('Existing normalized_rows retains every intended verse row:',checked_rows)
