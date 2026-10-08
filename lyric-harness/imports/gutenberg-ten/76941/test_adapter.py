"""Run with reconstructed source: python test_adapter.py /tmp/76941.txt."""
import json,re,sys
from pathlib import Path
from adapter import parse
root=Path(__file__).parent
items=parse(sys.argv[1])
assert items==json.loads((root/'candidates.json').read_text())
assert len(items)==199
assert len({x['id'] for x in items})==199
assert sum(x['disposition']=='eligible' for x in items)==191
for x in items:
 if x['disposition']=='eligible':
  assert not re.search(r'\[[^\]]*(?:missing|lost|fragment)[^\]]*\]',x['text'],re.I)
  assert not any(re.match(r'(?:To the [Tt]une|Tune[ ,—-]|Printed in )',l.strip()) for l in x['text'].splitlines())
# Do not discard legitimate verse merely because it begins with By.
assert 'By fatal chance of powder; by one blast' in items[73]['text']
assert 'CHARLES SACKVILLE, Earl of Dorset' not in items[24]['text']
assert 'To the Tune' not in items[6]['text']
print('76941: 199 contents verse units;191 eligible;8 whole-work exclusions;metadata stripped')
assert '# APPARATUS: THE CAPTAIN’S ANSWER.' in items[42]['text']
assert '# APPARATUS: BOTH.' in items[119]['text']
assert '[CHORUS]\nThink of Jefferys the seaman’s hard fate.' in items[176]['text']
assert '[CHORUS]' in items[77]['text']
for x in items:
 for line in x['text'].splitlines():
  assert not re.fullmatch(r'[. *·—–-]{3,}',line.strip())
  assert not re.match(r'(?i)^chorus[.:]?(?:\s|$)',line.strip())
  assert line.strip() not in {'MAN.','MAID.','MOLLY.','BILLY.','TOM.','JACK.','BOTH.','CAPTAIN.','THE CAPTAIN’S ANSWER.','MESSENGER.','1ST WOMAN.','2ND WOMAN.'}
assert '# APPARATUS: The Second Part.' in items[67]['text']
assert '# APPARATUS: By Sir H. S.' in items[60]['text']
assert '# APPARATUS: (? 1756)' in items[100]['text']
assert '# APPARATUS: By J. PRAT.' in items[160]['text']
assert '# APPARATUS: Air--The Landlady of France.' in items[178]['text']
assert '# APPARATUS: Air--Tars of the ‘Blanche.’' in items[193]['text']
assert 'What is it, neighbour? Pray, to me unfold.' in items[73]['text']
assert 'The sadest news that ever mortal told.' in items[73]['text']
assert 'Then hark, etc.' in items[77]['text']

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
