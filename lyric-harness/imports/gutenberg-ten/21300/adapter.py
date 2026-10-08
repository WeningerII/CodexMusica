#!/usr/bin/env python3
"""Extract the 153 complete indexed units from PG 21300's 1929 printing.

Requires beautifulsoup4. Input is the HTML witness named in collection.json.
Usage: python adapter.py SOURCE_HTML [OUTPUT_JSON]
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

EXCLUSIONS = {
    'page139': 'long_narrative_poem: California Joe is an extended campfire framed narrative (204 verse lines), rather than a short poem; retained whole in audit data.',
}
AUTHORS = {'page020': 'James Barton Adams (attributed)', 'page025': 'Charles E. Winter',
           'page327': 'Berton Braley (probable)', 'page335': 'Larry Chittenden'}
URL = 'https://www.gutenberg.org/files/21300/21300-h/21300-h.htm'


def clean(node):
    node = BeautifulSoup(str(node).replace('\n', ' '), 'html.parser')
    for tag in node.select('.pagenum, a[href^="#footnote"]'):
        tag.decompose()
    for br in node.find_all('br'):
        br.replace_with('\n')
    # Source line wrapping is whitespace; only HTML br defines a verse line.
    lines = [re.sub(r'\s+', ' ', line).strip() for line in node.get_text().split('\n') if line.strip()]
    result = []
    for line in lines:
        if re.fullmatch(r'(?:\.\s*){3,}', line):
            line = '# APPARATUS: ' + line
        elif re.fullmatch(r'(Chorus|Cho|Refrain)[:.— -]*', line, re.I):
            line = '[REFRAIN]' if line.lower().startswith('refrain') else '[CHORUS]'
        result.append(line)
    return '\n'.join(result)


def extract(path):
    raw = Path(path).read_bytes()
    s = BeautifulSoup(raw, 'html.parser')
    assert 'Reprinted February, 1929.' in s.get_text()
    toc = s.find('h2', string='CONTENTS').find_next('ul').select('a[href]')
    heads = s.select('p.tit-song')
    assert len(toc) == len(heads) == 153
    by_page = {a['href'][1:]: a.get_text(' ', strip=True) for a in toc}
    rows = []
    for h in heads:
        page_tag = h.select_one('.pagenum a')
        page = page_tag['id'] if page_tag else {'JOE BOWERS': 'page015', 'THE SHANTY BOY': 'page252'}[h.get_text(strip=True)]
        index_page = 'page247' if page == 'page249' else page
        assert index_page in by_page, (page, h.get_text())
        title_parts = clean(h).splitlines()
        author = AUTHORS.get(page, 'Anonymous / traditional')
        byline = re.search(r'\bBy (.+)', ' '.join(title_parts[1:]))
        if byline:
            author = byline.group(1)
        title = title_parts[0]
        blocks = []
        notes = []
        for b in h.next_siblings:
            if getattr(b, 'name', None) == 'p' and ('tit-song' in b.get('class', []) or b.find('a', id='footnote1')):
                break
            if getattr(b, 'name', None) == 'p':
                if 'center' not in b.get('class', []):
                    blocks.append(clean(b))
                elif b.get_text(strip=True) and 'center' not in b.get('class', []):
                    notes.append(clean(b))
        text = '\n\n'.join(blocks)
        assert text
        rows.append({'id': page, 'title': title, 'index_title': by_page[index_page], 'index_anchor': index_page, 'author': author,
                     'text': text, 'disposition': 'excluded' if page in EXCLUSIONS else 'eligible',
                     'reason': EXCLUSIONS.get(page, 'Complete English song or short verse unit as printed; no translation attribution in the supplied collection.'),
                     'source_locator': URL + '#' + page,
                     'translation_evidence': 'The title, verse, byline and source notes were screened; English verse with no translator or foreign-source attribution in this witness. English dialect and isolated loan words are preserved.',
                     'source_sha256': hashlib.sha256(raw).hexdigest(),
                     'editorial_notes_excluded': notes,
                     'verse_line_count': sum(bool(x.strip()) and not x.startswith(('#', '[')) for x in text.splitlines())})
    assert set(by_page) == {x['index_anchor'] for x in rows}
    return rows


if __name__ == '__main__':
    rows = extract(sys.argv[1])
    result = json.dumps(rows, ensure_ascii=False, indent=2) + '\n'
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(result)
    else:
        print(result, end='')
