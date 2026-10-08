#!/usr/bin/env python3
"""Extract indexed songs plus the separately titled John Hobbs from PG 65524.

Requires beautifulsoup4. Verse is taken only from poem/stanza markup, never
from editorial paragraphs; source stanza and line boundaries are retained.
Usage: python adapter.py SOURCE_HTML [OUTPUT_JSON]
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

URL = 'https://www.gutenberg.org/files/65524/65524-h/65524-h.htm'


def plain(node):
    node = BeautifulSoup(str(node).replace('\n', ' '), 'html.parser')
    for tag in node.select('.pagenum, a[href^="#Footnote"]'):
        tag.decompose()
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True)).strip()


def lyric_line(line):
    if re.fullmatch(r'(?:\*\s*){3,}', line):
        return '# APPARATUS: ' + line
    if re.fullmatch(r'\(\s*Chorus[. ]*\)', line, re.I):
        return '[CHORUS]'
    if line == '(The chorus make up the last four lines of this verse.)':
        return '# APPARATUS: ' + line
    if line.startswith('(Spoken) '):
        return '# APPARATUS: (Spoken)\n' + line[len('(Spoken) '):]
    return line


def extract(path):
    raw = Path(path).read_bytes()
    s = BeautifulSoup(raw, 'html.parser')
    toc = s.find(id='CONTENTS').find_next('table').select('tr:has(td.pdd)')
    assert len(toc) == 138
    indexed = {}
    for row in toc:
        anchor = row.find('a')['href'][1:]
        h = s.find(id=anchor).find_next('h3')
        indexed[id(h)] = (anchor, plain(row.find('td')))
    heads = [h for h in s.find_all('h3') if plain(h) not in ['Chorus.', 'Moral.']]
    assert len(heads) == 139
    rows = []
    for h in heads:
        supplemental = id(h) not in indexed
        if supplemental:
            assert plain(h) == 'JOHN HOBBS.'
        anchor, title = indexed.get(id(h), ('page_4', 'John Hobbs'))
        blocks, notes, prose = [], [], []
        author = 'Bob Logic (attributed in editorial introduction)' if anchor == 'page_31' else 'Anonymous / traditional'
        for tag in h.next_elements:
            if getattr(tag, 'name', None) == 'h3' and plain(tag) not in ['Chorus.', 'Moral.']:
                break
            if getattr(tag, 'name', None) == 'h3' and plain(tag) == 'Chorus.':
                blocks.append('[CHORUS]')
            if getattr(tag, 'name', None) == 'h3' and plain(tag) == 'Moral.':
                blocks.append('# APPARATUS: Moral.')
            if getattr(tag, 'name', None) == 'div' and ('footnote' in tag.get('class', []) or (blocks and 'blockquot' in tag.get('class', []))):
                break
            if getattr(tag, 'name', None) == 'div' and 'stanza' in tag.get('class', []):
                if tag.find_parent(class_='blockquot'):
                    continue
                lines = [plain(line) for line in tag.find_all('span', recursive=False)
                         if any(c.startswith('i') for c in line.get('class', []))]
                blocks.append('\n'.join(lyric_line(x) for x in lines if x))
            if getattr(tag, 'name', None) == 'p':
                if tag.find_parent(class_='blockquot'):
                    notes.append(plain(tag))
                elif not tag.find_parent(class_='poem') and not tag.find_parent(class_='footnote'):
                    prose.append(plain(tag))
                    if plain(tag) == 'By Ernest Jones.':
                        author = 'Ernest Jones'
        text = '\n\n'.join(x for x in blocks if x)
        reason = 'English street song or short verse unit, preserving the complete supplied verse witness; no translation attribution in supplied source.'
        disposition = 'eligible'
        if title == 'The Chronicles of the Pope':
            assert not text
            text = '\n\n'.join(prose)
            disposition = 'excluded'
            reason = 'prose: extended political parody in 46 numbered prose paragraphs, not a lyric or poem.'
        assert text, title
        rows.append({'id': anchor + ('-john-hobbs' if supplemental else ''), 'title': title,
                     'author': author, 'text': text, 'disposition': disposition, 'reason': reason,
                     'source_locator': URL + '#' + anchor,
                     'translation_evidence': 'English street-ballad text and editorial source notes screened; no translator or foreign-original attribution. Musical tune borrowings are not treated as lyric translations.',
                     'source_sha256': hashlib.sha256(raw).hexdigest(),
                     'indexed': not supplemental, 'editorial_notes_excluded': notes,
                     'verse_line_count': sum(bool(x.strip()) and not x.startswith(('#', '[')) for x in text.splitlines()) if disposition == 'eligible' else 0})
    assert sum(x['indexed'] for x in rows) == 138
    return rows


if __name__ == '__main__':
    result = json.dumps(extract(sys.argv[1]), ensure_ascii=False, indent=2) + '\n'
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(result)
    else:
        print(result, end='')
