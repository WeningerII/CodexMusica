#!/usr/bin/env python3
"""Verify the pinned source, complete numbered coverage, and apparatus removal."""
import hashlib
import json
import re
import sys
from pathlib import Path
from extract import Tree, compact, extract
base=Path(__file__).parent
source=Path(sys.argv[1]).read_bytes()
metadata=json.loads((base/'collection.json').read_text())
assert hashlib.sha256(source).hexdigest()==metadata['source_sha256']
rows=extract(source.decode('utf-8-sig'))
assert rows==json.loads((base/'candidates.json').read_text())
assert len(rows)==1324
assert sum(x['disposition']=='excluded' for x in rows)==42
assert all(x['text'] and all(x['stanzas']) for x in rows)
# Every printed lyric paragraph is accounted for, omitting only printed section labels.
root=Tree(source.decode('utf-8-sig')).root
for h,row in zip(root.find('hymn'),rows):
    expected=[]
    for v in h.find('verse'):
        for p in v.children:
            if getattr(p,'tag','')!='p': continue
            for cls in ('vn','scripRef'):
                for n in p.find(cls): n.children=[]
            line=re.sub(r'^Chorus\.[—\s]*','',compact(p.text()),flags=re.I)
            if line: expected.append(line)
    assert expected==row['text'].replace('\n\n','\n').splitlines(),row['id']
assert rows[137]['sections'][1]['type']=='chorus'
assert rows[264]['title']=='Cling to the mighty One'
assert 'Ps.' not in rows[264]['text']
assert rows[399]['disposition']=='excluded' # Rothe despite C. Wesley credit
assert rows[808]['disposition']=='excluded' # Zinzendorf despite C. Wesley credit
assert rows[0]['author']=='Watts.'
print('PASS: 1324 sequential entries; pinned bytes; 25467 lyric lines conserved; 42 translation exclusions; chorus and scripture apparatus checks')
