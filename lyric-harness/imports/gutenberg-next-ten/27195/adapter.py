#!/usr/bin/env python3
"""Offline extraction of PG27195's 1922 edition, retaining its printed dialect.

Usage: python adapter.py [SOURCE_HTML_OR_GZIP] [OUTPUT_JSON]
The pinned HTML already encodes macrons/breves as characters/entities. Beautiful
Soup decodes these; no pronunciation aid is stripped or modernized. The ASCII
witness's [=a]/[)a] conventions are decoded only by decode_ascii_marks(), tested
against their corresponding HTML characters; this adapter reads HTML, not a
heuristically segmented plaintext witness.
"""
import gzip
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
URL = 'https://www.gutenberg.org/files/27195/27195-h/27195-h.htm'
EXPECTED_SHA256 = 'c029704cd515a56697e551c7af1f6d03d54e6742057ddf020b7e2281dd075ead'
EXCLUSIONS = {
    250: 'original_language_unresolved: The Study (pp.243–244) explicitly describes Frog in a Mill as mixed African/English and possibly French, Spanish or Portuguese language, not an identified English-original lyric. Preserved in audit; excluded from this English-only import, not declared invalid language.',
    252: 'original_language_unresolved: The Study (pp.243–244) explicitly describes Tree Frogs as mixed African/English language. Preserved in audit; original-language scope is unresolved, not a pronunciation or dialect quality judgment.',
    328: 'incomplete_source_work: The Study (p.243) identifies another stanza of Old Man Know-All which the compiler and informants could not recall. No missing stanza is invented.',
}
ROLE = re.compile(r"^\((?:He|She|Fox Call|Goose Sponse|Chicken's Call|Hawk Sponse|Hawk Call|Chicken's Sponse|Human Call|Witch Sponse|Conscience's Warning Call)\)\s*")


def decode_ascii_marks(text):
    """Decode the witness's documented glyph notation, preserving the diacritic."""
    return unicodedata.normalize('NFC', re.sub(
        r'\[([=)])([A-Za-z])\]',
        lambda m: m[2] + ('\u0304' if m[1] == '=' else '\u0306'), text))


def clean(node):
    copy = BeautifulSoup(str(node), 'html.parser')
    for junk in copy.select('.pagenum, .fnanchor'):
        junk.decompose()
    return re.sub(r'\s+', ' ', copy.get_text()).strip()


def extract(path=HERE / 'source.html.gz'):
    packed = Path(path).read_bytes()
    raw = gzip.decompress(packed) if packed[:2] == b'\x1f\x8b' else packed
    assert hashlib.sha256(raw).hexdigest() == EXPECTED_SHA256, 'source witness hash changed'
    soup = BeautifulSoup(raw, 'html.parser')
    assert 'Published January, 1922.' in soup.get_text()
    rows, active, section = [], False, ''
    for node in soup.find_all(['h2', 'h3', 'div']):
        if node.name == 'h2':
            if clean(node).startswith('PART I NEGRO FOLK RHYMES'):
                active = True
            elif active:
                break
        if not active:
            continue
        if node.name == 'h3':
            section = clean(node)
        if node.name != 'div' or 'poem' not in node.get('class', []):
            continue
        ordinal = len(rows) + 1
        heads = node.find_all('h5')
        title = clean(heads[0]) if heads else 'Philippine Island Rhyme [untitled source unit]'
        page = node.find_previous('span', class_='pagenum')
        anchor = page.find('a').get('id') if page else 'Page_1'
        blocks, notes, original_blocks = [], [], []
        for stanza in node.select('div.stanza'):
            lines, originals = [], []
            for span in stanza.find_all('span', class_=lambda c: c and re.fullmatch(r'i\d+', c), recursive=False):
                line = clean(span)
                if not line:
                    continue
                originals.append(line)
                if line in ('Interlocution:', 'Translation'):
                    lines.append('# APPARATUS: ' + line)
                elif ordinal == 59 and re.match(r'^\((Fiddler|Banjo Picker)\)', line):
                    # Explicit spoken prose interlude, printed between verse stanzas.
                    lines.append('# APPARATUS: spoken interlocution: ' + line)
                elif ROLE.match(line):
                    role = ROLE.match(line).group().strip()
                    lines.extend(['# APPARATUS: speaker ' + role, ROLE.sub('', line)])
                else:
                    lines.append(line)
            if lines:
                blocks.append('\n'.join(lines))
            if originals:
                original_blocks.append('\n'.join(originals))
        text = '\n\n'.join(blocks)
        assert text, (ordinal, title)
        for p in node.find_all('p'):
            notes.append(clean(p))
        for ref in node.select('a.fnanchor[href]'):
            target = soup.find(id=ref['href'][1:])
            if target:
                note = clean(target.find_parent('div', class_='footnote'))
                if note not in notes:
                    notes.append(note)
        reason = EXCLUSIONS.get(ordinal)
        if section == 'Foreign Section':
            reason = 'foreign_section: Complete source unit from the explicitly headed Foreign Section (African/Jamaican/Venezuelan/Trinidad/Philippine material and translations); outside this bounded English-original import. Source-language text and translations retained together in audit.'
        rows.append({
            'id': f'poem-{ordinal:03d}', 'title': title,
            'author': 'Anonymous / traditional', 'index_title': title,
            'index_anchor': anchor, 'source_section': section,
            'source_ordinal': ordinal, 'source_locator': URL + '#' + anchor,
            'source_sha256': EXPECTED_SHA256,
            'text': text, 'source_verse_text': '\n\n'.join(original_blocks),
            'text_sha256': hashlib.sha256(text.encode()).hexdigest(),
            'disposition': 'excluded' if reason else 'eligible',
            'reason': reason or 'Complete independently headed English traditional rhyme/song as printed in Part I; no translation attribution in this source unit or its attached notes. No numerical length cap.',
            'translation_evidence': 'Printed unit, attached footnotes, Foreign Section boundary and Study language discussion screened. Compiler is not credited as author. Dialect spellings and pronunciation diacritics retained; no standard-English reading inferred.',
            'editorial_notes_excluded': notes,
            'verse_line_count': sum(bool(x.strip()) and not x.startswith(('#', '[')) for x in text.splitlines()),
        })
    assert len(rows) == 349
    assert sum(r['source_section'] == 'Foreign Section' for r in rows) == 13
    assert rows[335]['title'] == 'JACK AND DINAH WANT FREEDOM'
    return rows


if __name__ == '__main__':
    rows = extract(sys.argv[1] if len(sys.argv) > 1 else HERE / 'source.html.gz')
    result = json.dumps(rows, ensure_ascii=False, indent=2) + '\n'
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(result)
    else:
        print(result, end='')
