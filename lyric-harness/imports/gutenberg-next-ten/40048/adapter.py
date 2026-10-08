#!/usr/bin/env python3
"""Replay PG40048's complete 1842 song units from the pinned HTML witness.

Usage: python adapter.py [SOURCE_HTML_OR_GZ] [OUTPUT_JSON]
Requires beautifulsoup4. Literal h2 boundaries avoid the source's malformed p
around the Coronation invitation swallowing sibling poems under html.parser.
"""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
URL = 'https://www.gutenberg.org/files/40048/40048-h/40048-h.htm'
UNANCHORED = {'THE NEW KEEL ROW.': 'Page_55', "A NEW YEAR'S CAROL,": 'Page_138',
 'On the Attempt to remove the Custom House from Newcastle to Shields, in 1816.': 'Page_216',
 'Thomas Whittell, his Humourous Letter To good Master Moody, Razor-setter.': 'Page_228'}
EXCLUSIONS = {
 'THE_PITMANS_PAY': 'long_narrative_poem: extended social narrative of the pitman payday gathering, over multiple printed pages and 404 verse lines; retained whole for audit, not a short standalone song.',
 'THE_COLLIERS_PAY_WEEK': 'long_narrative_poem: Henry Robson\'s extended narrative itinerary of the colliers\' pay week, 177 verse lines; retained whole for audit.',
 'CORONATION_THURSDAY_July_19_1821': 'long_epistolary_poem: the Third Epistle from Bob Fudge is an extended 192-line narrated account of the coronation, not a short standalone lyric; retained whole for audit.',
}
AUTHOR_OVERRIDES = {'CANNY_SHEELS': 'John Morris (body byline; contents: John Morrison)',
 'DONOCHT-HEAD52': 'George Pickering (body byline; contents: R. Pickering)',
 'Page_228': 'Thomas Whittell', 'A_PARODY': 'Wm. Greig',
 'THE_COBBLER_O_MORPETH_Cholera_Morbus': "John M'Lellan"}


def clean(node):
    c = BeautifulSoup(str(node), 'html.parser')
    for n in c.select('.pagenum, .fnanchor, .footnote'):
        n.decompose()
    for b in c.find_all('br'):
        b.replace_with('\n')
    return '\n'.join(re.sub(r'\s+', ' ', x).strip() for x in c.get_text().splitlines() if x.strip())


def extract(path):
    raw = Path(path).read_bytes()
    if str(path).endswith('.gz'):
        raw = gzip.decompress(raw)
    html = raw.decode('utf-8')
    assert '1842.' in html and 'FORDYCE' in html
    s = BeautifulSoup(html, 'html.parser')
    toc = []
    for tr in s.find('table').find_all('tr'):
        a = tr.find('a', href=True)
        if a:
            cells = tr.find_all('td')
            toc.append({'anchor': a['href'][1:], 'title': clean(cells[0]), 'author': clean(cells[1]), 'page': clean(cells[2])})
    assert len(toc) == 216
    heads = list(re.finditer(r'<h2\b[^>]*>.*?</h2>', html, re.S | re.I))
    rows = []
    for i, match in enumerate(heads):
        heading = BeautifulSoup(match.group(), 'html.parser').h2
        title = clean(heading).replace('\n', ' ')
        if title in ('CONTENTS.', 'TYNE SONGSTER.'):
            continue
        anchor = heading.find('a', id=True)
        key = anchor['id'] if anchor else UNANCHORED[title]
        aliases = [t for t in toc if t['anchor'] == key or (key == 'On_George_the_Fourths_Coronation' and t['anchor'] == 'Page_191')]
        assert aliases, (key, title)
        section = BeautifulSoup(html[match.end():heads[i+1].start() if i+1<len(heads) else len(html)], 'html.parser')
        blocks = []
        for stanza in section.select('div.poem div.stanza'):
            if stanza.find_parent(class_='footnote'):
                continue
            lines = clean(stanza).splitlines()
            converted = []
            for line in lines:
                if re.fullmatch(r'(?:CHORUS|REFRAIN)[.:— -]*', line, re.I):
                    line = '[REFRAIN]' if line.upper().startswith('REFRAIN') else '[CHORUS]'
                elif re.fullmatch(r'(?:\*\s*){3,}|(?:\.\s*){3,}', line):
                    line = '# APPARATUS: ' + line
                converted.append(line)
            if converted:
                blocks.append('\n'.join(converted))
        text = '\n\n'.join(blocks)
        assert text, key
        notes = [clean(p) for p in section.find_all('p') if not p.find_parent(class_='poem') and not p.find(class_='poem') and clean(p)]
        # Printed footnote prose is provenance, never sung text.
        notes += [clean(n) for n in section.select('div.footnote') if clean(n)]
        author = AUTHOR_OVERRIDES.get(key, aliases[0]['author'] or 'Anonymous / traditional')
        if key == 'On_George_the_Fourths_Coronation':
            title += ' Invitation to the Mansion-House Dinner in Honour of the Coronation.'
            author = next((a['author'] for a in aliases if a['author']), author)
        row = {'id':key,'title':title,'index_title':aliases[0]['title'],'index_anchor':aliases[0]['anchor'],
          'contents_entries':aliases,'author':author,'text':text,
          'disposition':'excluded' if key in EXCLUSIONS else 'eligible',
          'reason':EXCLUSIONS.get(key,'Complete English song or short verse unit as printed; source dialect and abbreviated refrains preserved. No translation attribution in this witness.'),
          'source_locator':URL+'#'+key,'source_sha256':hashlib.sha256(raw).hexdigest(),
          'translation_evidence':'Printed contents credits, headings, verse and accompanying notes screened; no translation attribution identified. Tune references do not make the English lyrics a translation.',
          'editorial_notes_excluded':notes,
          'verse_line_count':sum(bool(x.strip()) and not x.startswith(('#','[')) for x in text.splitlines())}
        row['text_sha256'] = hashlib.sha256(text.encode()).hexdigest()
        rows.append(row)
    assert len(rows)==214
    assert sum(len(r['contents_entries']) for r in rows)==216
    assert {x['anchor'] for x in toc} == {x['anchor'] for r in rows for x in r['contents_entries']}
    return rows


if __name__ == '__main__':
    rows = extract(sys.argv[1] if len(sys.argv)>1 else HERE/'source.html.gz')
    result = json.dumps(rows,ensure_ascii=False,indent=2)+'\n'
    if len(sys.argv)>2:
        Path(sys.argv[2]).write_text(result)
    else:
        print(result,end='')
