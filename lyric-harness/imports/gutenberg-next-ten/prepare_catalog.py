#!/usr/bin/env python3
"""Register this import's sources and pin the complete Library input tree.

Only the ten explicitly named source rows are written. Existing registry rows
and the previous Library snapshot's source manifest are preserved.
"""
import csv
import hashlib
import json
from pathlib import Path

from integrate import HERE, IDS, ROOT, dump


def main():
    path = ROOT / 'data/sources.tsv'
    original = path.read_text(encoding='utf-8')
    columns = original.splitlines()[0].split('\t')
    identities = {'ProjectGutenberg/ebook_' + book for book in IDS}
    existing = [line for line in original.splitlines()
                if line.split('\t')[0] not in identities]
    for book in IDS:
        value = json.loads((HERE / book / 'collection.json').read_text())
        year = value.get('publication_year')
        evidence = value.get('rights_evidence', value.get('rights'))
        if not evidence:
            raise ValueError('missing rights evidence: ' + book)
        retrieval = value.get('retrieval', {})
        digest = value.get('source_sha256') or value.get('sha256') or (
            retrieval.get('sha256') if isinstance(retrieval, dict) else None)
        if not digest or len(digest) != 64:
            raise ValueError('missing source SHA256: ' + book)
        row = {'source_id': 'ProjectGutenberg/ebook_' + book,
               'licence': 'public domain', 'pd_affirmed': 'true',
               'contested': 'false', 'generated': 'false',
               'publication_year': str(year) if year is not None else '',
               'publication_evidence': value['edition'], 'jurisdiction': 'USA',
               'evidence': 'https://www.gutenberg.org/ebooks/' + book +
                   ' states Public domain in the USA. Exact supplied transcription SHA256 ' + digest +
                   '; edition-specific evidence and source retrieval in imports/gutenberg-next-ten/' + book + '/collection.json.',
               'note': 'Original English verse only. Complete per-entry eligibility, translation exclusions and existing/cross-collection duplicate decisions in imports/gutenberg-next-ten/audit.json. ' +
                   ('Supplied title page undated; no publication year inferred; express PG rights affirmation is the admission route.'
                    if year is None else 'Supplied edition publication year retained, not first publication or ebook release.')}
        fields = [row.get(key, '') for key in columns]
        if any('\t' in value or '\n' in value for value in fields):
            raise ValueError('invalid registry field')
        existing.append('\t'.join(fields))
    path.write_text('\n'.join(existing) + '\n', encoding='utf-8')
    tree = []
    for source in sorted((ROOT / 'corpus').rglob('*')):
        if source.is_file():
            raw = source.read_bytes()
            tree.append({'path': 'lyric-harness/' + source.relative_to(ROOT).as_posix(),
                         'sha': hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest(),
                         'size': len(raw)})
    # The Library builder's supported array form pins bytes without pretending
    # that a commit can contain a manifest of its own not-yet-created SHA.
    (HERE / 'source_manifest.json').write_text(dump(tree), encoding='utf-8')
    print(f'Registered {len(IDS)} sources; pinned {len(tree)} corpus files.')


if __name__ == '__main__':
    main()
