"""Extract the complete nursery rhymes in the supplied 1843 PG30418 HTML.
Usage: python adapter.py /path/to/30418-h.htm > candidates.json
"""
import html
import json
import re
import sys
from pathlib import Path


def clean(fragment):
    fragment = re.sub(r'<span class="pagenum">.*?</span>', '', fragment, flags=re.S)
    fragment = re.sub(r'\s*<br\s*/?>\s*', '\n', fragment)
    fragment = html.unescape(re.sub(r'<[^>]+>', '', fragment))
    lines = [re.sub(r'[ \t\xa0]+', ' ', line).strip() for line in fragment.splitlines()]
    # Finger numbers are stage directions, not sung words.
    lines = [re.sub(r'^\d+\. ', '', line) for line in lines]
    lines = [line for line in lines if not line.startswith('Note.') and not re.fullmatch(r'[\d, ]+', line)]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def extract(source):
    blocks = list(re.finditer(r'<div class="cpoem\d*">(.*?)</div>', source, re.S))
    assert len(blocks) == 107
    # These are continuation stanzas separated only by layout, not separate works.
    continuations = {21: 20, 50: 49, 51: 49, 74: 73}
    rows = []
    by_block = {}
    for block_number, match in enumerate(blocks, 1):
        text = clean(match[1])
        if block_number in continuations:
            by_block[continuations[block_number]]['text'] += '\n\n' + text
            by_block[continuations[block_number]]['source_blocks'].append(block_number)
            continue
        row = {'id': str(len(rows) + 1), 'title': text.splitlines()[0].rstrip(',;.!?'),
               'author': 'Anonymous', 'text': text, 'disposition': 'eligible',
               'reason': 'Complete English nursery rhyme as printed in the 1843 collection.',
               'source_locator': 'https://www.gutenberg.org/cache/epub/30418/pg30418-images.html#SONGS',
               'source_blocks': [block_number],
               'translation_evidence': 'Collection identified as Traditional Nursery Songs of England; no translation credit or non-English source is stated for this rhyme.'}
        rows.append(row)
        by_block[block_number] = row
    assert len(rows) == 103
    return rows


if __name__ == '__main__':
    print(json.dumps(extract(Path(sys.argv[1]).read_text(encoding='latin1')), ensure_ascii=False, indent=2))
