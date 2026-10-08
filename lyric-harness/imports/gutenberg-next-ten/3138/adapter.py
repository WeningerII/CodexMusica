#!/usr/bin/env python3
"""Reproduce reviewed whole-poem candidates from the compressed pinned witness.
Run python adapter.py [--check]. Boundary ledger is source-local, not a reader rule.
"""
import gzip, hashlib, json, re, sys
from pathlib import Path
HERE=Path(__file__).resolve().parent

def extract():
    meta=json.loads((HERE/'collection.json').read_text())
    raw=gzip.decompress((HERE/'source.txt.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest()==meta['source_sha256'], 'source witness changed'
    lines=raw.decode('utf-8-sig').splitlines()
    rows=[]
    for record in json.loads((HERE/'boundaries.json').read_text()):
        selected=record['verse_source_lines']
        assert selected==sorted(set(selected))
        assert all(record['start_line']<=n<=record['end_line'] for n in selected)
        # Underscores encode italics, braces are source footnote references.
        # Neither changes the spelling of the words themselves.
        clean=lambda s: re.sub(r'\s*\{\d+[a-z]?\}', '', s.replace('_','')).strip()
        groups=record.get('join_source_lines', [[n] for n in selected])
        text='\n'.join(' '.join(clean(lines[n-1]) for n in group) for group in groups)
        text=re.sub(r'\n{3,}','\n\n',text).strip()
        assert text and 'GUTENBERG' not in text
        rows.append(dict(id=record['id'],title=clean(record['title']),
            author=record.get('author',meta['author']),text=text,
            disposition=record['disposition'],reason=record['reason'],
            source_locator=meta['source_url']+'#'+record['id'],
            source_lines=[record['start_line'],record['end_line']],
            source_sha256=meta['source_sha256'],
            translation_evidence=record['reason'] if record['disposition']=='excluded' else
                'Original English poem in author collection; source title, epigraphs and notes screened. Foreign quotations do not change original language. Dialect spellings retained.',
            editorial_notes_excluded=record['apparatus'],
            verse_line_count=sum(bool(s.strip()) for s in text.splitlines())))
    return rows

if __name__=='__main__':
    result=json.dumps(extract(),ensure_ascii=False,indent=2)+'\n'
    path=HERE/'candidates.json'
    if '--check' in sys.argv: assert path.read_text()==result, 'candidate drift'
    else:path.write_text(result)
    print(len(extract()),'whole source units')
