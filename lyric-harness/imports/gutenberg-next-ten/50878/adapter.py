#!/usr/bin/env python3
"""Extract complete song units from this supplied Gutenberg HTML witness.

Requires beautifulsoup4. Defaults to the byte-pinned compressed local witness.
Printed abbreviations are retained; no missing refrain is reconstructed.
"""
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

PG = "50878"
HEADING = "h3"
FIRST = 1
LAST = 73
EXPECTED = 73
URL = f"https://www.gutenberg.org/cache/epub/{PG}/pg{PG}-images.html"
EXCLUSIONS = {'6': 'translation: English adaptation of Bellini’s La sonnambula aria; not original English words. NLA https://nla.gov.au/nla.obj-166652466 identifies adaptation for the English stage by H. R. Bishop; University of Illinois Press translated-aria table identifies Italian original Ah! Perchè non posso odiarti.', '8': 'translation: matching English text is a translation of Karl Herloßsohn’s German poem set by Franz Abt. https://www.lieder.net/lieder/get_text.html?TextId=25218 records English after the German; original sheet music https://hdl.loc.gov/loc.music/sm1852.510570.'}


def clean(node):
    node = BeautifulSoup(str(node), 'html.parser')
    for tag in node.select('.pagenum, .pagenum2, .fnanchor, .brace'):
        tag.decompose()
    return re.sub(r'\s+', ' ', node.get_text()).strip()


def extract(path=None):
    path = Path(path) if path else Path(__file__).with_name('source.html.gz')
    raw = gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes()
    text = raw.decode('utf-8-sig')
    heads = list(re.finditer(fr'<{HEADING}\b[^>]*>.*?</{HEADING}>', text, re.S))
    rows = []
    for index in range(FIRST - 1, LAST):
        h = heads[index]
        end = heads[index + 1].start() if index + 1 < len(heads) else len(text)
        body = BeautifulSoup(text[h.end():end], 'html.parser')
        title = clean(BeautifulSoup(h[0], 'html.parser'))
        notes, sections, labels = [], [], []
        # Credits, tune changes and notes can follow or interrupt the song.
        # The last Connecticut unit is followed by a separately boxed advert.
        for advert in body.select('.bbox'):
            advert.decompose()
        for node in body.find_all('p'):
            if not node.find_parent(class_='stanza') and clean(node) and not node.select('.pagenum, .pagenum2'):
                notes.append(clean(node))
        pending_kind = None
        for stanza in body.select('.stanza'):
            kind, lines = pending_kind or 'verse', []
            pending_kind = None
            for node in stanza.find_all(['div', 'p'], recursive=False):
                cls = node.get('class', [])
                line = clean(node)
                if not line:
                    continue
                standalone = re.fullmatch(r'(Chorus|Cho|Refrain)[.:—– -]*', line, re.I)
                if standalone:
                    kind = 'refrain' if line.lower().startswith('refrain') else 'chorus'
                    labels.append(line)
                    pending_kind = kind
                    continue
                if any(c in cls for c in ('verseright', 'center', 'sig', 'brace')):
                    notes.append(line)
                    continue
                if not (any(c.startswith('i') for c in cls) or 'verse' in cls):
                    notes.append(line)
                    continue
                marker = re.match(r'^(?:Chorus|Cho\.?|Refrain)[.:—–-]*\s*(.*)$', line, re.I)
                if marker:
                    if lines:
                        sections.append({'type':kind, 'lines':lines})
                    kind = 'refrain' if line.lower().startswith('refrain') else 'chorus'
                    labels.append(line[:len(line)-len(marker[1])].strip())
                    lines = [marker[1]] if marker[1] else []
                else:
                    lines.append(line)
            if lines:
                sections.append({'type':kind, 'lines':lines})
                pending_kind = None
        number = str(index - FIRST + 2)
        author = 'Anonymous / unattributed in supplied edition'
        for note in notes:
            byline = re.search(r'\bBY ([^—]+?)(?= Air| Tune|$)', note)
            if byline and not note.startswith(('AS SUNG', 'And Sung')):
                author = byline[1].strip().rstrip('.')
        if PG == '51226' and number in ('15', '35'):
            author = 'R. M. N.' if number == '15' else 'W. B. H.'
        if PG == '51226' and title == 'LINCOLN AND HAMLIN.':
            author = 'Samuel Copp'
        text_out = '\n\n'.join('\n'.join(s['lines']) for s in sections)
        assert text_out, (PG,number,title)
        previous_pages = re.findall(r'(?:id|name)="(Page_\d+)"', text[:h.start()])
        page = previous_pages[-1] if previous_pages else None
        row = {'id':number, 'title':title, 'author':author, 'text':text_out,
            'disposition':'excluded' if number in EXCLUSIONS else 'eligible',
            'reason':EXCLUSIONS.get(number, 'Complete standalone English song as printed; dialect spellings and printed abbreviated repeats retained.'),
            'source_locator':URL + ('#'+page if page else ''),
            'source_heading_index':index+1, 'source_html_line':text[:h.start()].count('\n')+1,
            'source_sha256':hashlib.sha256(raw).hexdigest(),
            'translation_evidence':'Printed title, verse and source notes screened. No translator or foreign-language source credited unless specifically excluded; tune attribution alone is not a translation of the words.',
            'editorial_notes_excluded':notes,
            'verse_line_count':sum(len(s['lines']) for s in sections)}
        if labels:
            row['sections'] = sections
            row['source_section_labels'] = labels
        rows.append(row)
    assert len(rows) == EXPECTED
    return rows


if __name__ == '__main__':
    print(json.dumps(extract(sys.argv[1] if len(sys.argv)>1 else None),ensure_ascii=False,indent=2))
