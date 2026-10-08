"""Extract complete numbered songs from PG56625's April 1913 reprint.
Usage: python adapter.py /path/to/56625-h.htm > candidates.json
"""
import html
import json
import re
import sys
from pathlib import Path


def clean(fragment):
    fragment = re.sub(r'<span class="pagenum">.*?</span>', '', fragment, flags=re.S)
    fragment = re.sub(r'<a[^>]*class="fnanchor"[^>]*>.*?</a>', '', fragment, flags=re.S)
    fragment = re.sub(r'\s*<br\s*/?>\s*', '\n', fragment)
    fragment = html.unescape(re.sub(r'<[^>]+>', '', fragment))
    return '\n'.join(re.sub(r'[ \t\xa0]+', ' ', line).strip() for line in fragment.splitlines()).strip()


def mark_printed_sections(row):
    sections, labels = [], []
    for stanza in row['text'].split('\n\n'):
        kind, lines = 'verse', []
        for line in stanza.splitlines():
            marker = re.match(r'^(CHORUS[:.]|Refrain$)\s*(.*)$', line)
            if marker:
                if lines:
                    sections.append({'type': kind, 'lines': lines})
                kind = 'refrain' if marker[1] == 'Refrain' else 'chorus'
                lines = [marker[2]] if marker[2] else []
                labels.append(marker[1])
            else:
                lines.append(line)
        if lines:
            sections.append({'type': kind, 'lines': lines})
    if labels:
        row['sections'] = sections
        row['source_section_labels'] = labels
        row['text'] = '\n\n'.join('\n'.join(section['lines']) for section in sections)


def extract(source):
    sections = re.findall(r'<h2><a name="(No_[^"]+)"[^>]*>(.*?)</h2>(.*?)(?=<h2>|\Z)', source, re.S)
    assert len(sections) == 123
    notes = {int(number): clean(body) for number, body in re.findall(r'<p class="tp"><a id="NOTE_(\d+)"></a>(.*?)(?=<p class="tp"><a id="NOTE_|\Z)', source.split('<h2><a name="FOOTNOTES"')[0], re.S)}
    rows = {}
    for anchor, title, body in sections:
        number = int(re.match(r'No_(\d+)', anchor)[1])
        # No.25's second poem is a quotation in an editorial note, outside the song.
        song_body = body.split('<div class="blockquot">')[0]
        stanzas = []
        for poem in re.findall(r'<div class="poem">(.*?)</div>', song_body, re.S):
            for attrs, paragraph in re.findall(r'<p([^>]*)>(.*?)</p>', poem, re.S):
                if 'class="center"' in attrs:
                    continue
                stanza = clean(paragraph)
                if stanza:
                    stanzas.append(stanza)
        assert stanzas, anchor
        text = '\n\n'.join(stanzas)
        # No.108 brackets mark optional sung stanzas, not stage directions.
        # Keep every printed word; bracket delimiters would hide verse from
        # the existing Library reader.
        if number == 108:
            assert text.count('[') == text.count(']') == 2
            text = text.replace('[', '').replace(']', '')
        if number == 50 and number in rows:
            rows[number]['text'] += '\n\n' + text
            rows[number]['source_sections'].append(anchor)
            continue
        if number == 58 and number in rows:
            rows[number]['alternate_musical_setting'] = {'source_section': anchor, 'text': text,
                'disposition': 'duplicate_variant', 'reason': 'Second musical setting of the same four-stanza song; minor printed verbal variants retained here for audit, not appended as extra stanzas.'}
            continue
        rows[number] = {'id': str(number), 'title': re.sub(r'^No\s*\d+\s*', '', clean(title)).replace('\n', ' ').title(),
            'author': ('H. Fleetwood Sheppard' if number in (73, 105) else 'Traditional / S. Baring-Gould (editorial adaptations)'), 'text': text,
            'disposition': 'eligible', 'reason': 'Complete numbered English song as printed; source editorial adaptations are retained without further abridgement.',
            'source_locator': 'https://www.gutenberg.org/cache/epub/56625/pg56625-images.html#' + anchor,
            'source_sections': [anchor], 'translation_evidence': 'English folk song or original English editorial adaptation; accompanying source note inspected for authorship and translation.',
            'source_note': notes[number]}
    assert sorted(rows) == list(range(1, 122))
    for row in rows.values():
        mark_printed_sections(row)
    return list(rows.values())


if __name__ == '__main__':
    print(json.dumps(extract(Path(sys.argv[1]).read_text(encoding='latin1')), ensure_ascii=False, indent=2))
