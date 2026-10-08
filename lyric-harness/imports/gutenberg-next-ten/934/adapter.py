#!/usr/bin/env python3
"""Extract all 87 PG934 songs, using the supplied HTML to resolve text wrapping.

Offline replay: python3 adapter.py [SOURCE_TEXT_OR_GZIP] [OUTPUT_JSON]
The gzip witnesses are reconstructed browser transcriptions, not HTTP byte pins.
The text witness owns words, spelling, punctuation, capitals and stanza spacing.
The HTML-rendered witness owns verse lineation; matching is exact after only
case/underscore/whitespace normalization, so it cannot silently rewrite words.
"""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
URL = 'https://www.gutenberg.org/ebooks/934.txt.utf-8'
HTML_URL = 'https://www.gutenberg.org/cache/epub/934/pg934-images.html'
SPEAKERS = {'THE DUKE.', 'THE DUCHESS.'}
INLINE_SPEAKER_TITLES = {'THE MERRYMAN AND HIS MAID', 'HE AND SHE', 'WILLOW WALY!'}


def read_bytes(path):
    path = Path(path)
    return gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes()


def comparison(text):
    return re.sub(r'\s+', ' ', text.replace('_', '')).strip().casefold()


def extract(path=None):
    raw = read_bytes(path or HERE / 'source.txt.gz')
    lines = raw.decode('utf-8').splitlines()
    lineation_raw = read_bytes(HERE / 'html-rendered-lines.json.gz')
    html_map = json.loads(lineation_raw)
    assert sorted(map(int, html_map)) == list(range(3303)), 'incomplete HTML witness'
    html = [html_map[str(i)] for i in range(3303)]
    assert '1920 Macmillan and Co' in '\n'.join(lines[:35])
    assert '1884 George Routledge and Sons' in '\n'.join(lines[:35])
    toc_start = lines.index('CONTENTS') + 1
    first_title = next(i for i in range(toc_start, len(lines)) if lines[i] == 'THE DARNED MOUNSEER')
    toc = []
    for i in range(toc_start, first_title):
        m = re.fullmatch(r'(.+?)\s{2,}(\d+)', lines[i])
        if m:
            toc.append((m[1], m[2], i + 1))
    assert len(toc) == 87 and len(set(t[0] for t in toc)) == 87
    heads = [(i, s) for i, s in enumerate(html) if s.startswith('## p.')]
    assert len(heads) == len(toc)
    rows = []
    for k, (title, page, toc_line) in enumerate(toc):
        starts = [i for i in range(first_title, len(lines)) if lines[i] == title]
        assert len(starts) == 1, (title, starts)
        start = starts[0]
        if k + 1 < len(toc):
            stop = next(i for i in range(start + 1, len(lines)) if lines[i] == toc[k + 1][0])
        else:
            stop = next(i for i in range(start + 1, len(lines)) if lines[i].startswith('*** END'))
        hi, heading = heads[k]
        assert heading == '## p. ' + page + ' ' + title, (title, heading)
        hz = heads[k + 1][0] if k + 1 < len(heads) else next(i for i in range(hi + 1, len(html)) if '*** END' in html[i])
        original = [(i, lines[i]) for i in range(start + 1, stop) if lines[i].strip()]
        target = [(i, html[i]) for i in range(hi + 1, hz) if html[i].strip()]
        ix = 0
        groups = []
        for at, target_line in target:
            group = []
            while ix < len(original):
                group.append(original[ix])
                ix += 1
                merged = ' '.join(s.strip() for _, s in group)
                if comparison(merged) == comparison(target_line):
                    groups.append((at, group))
                    break
                assert len(comparison(merged)) < len(comparison(target_line)), (title, at, group, target_line)
            else:
                raise AssertionError(('source exhausted', title, at))
        assert ix == len(original), ('unconsumed source', title)
        out, changes = [], []
        previous = None
        for html_line, group in groups:
            first, final = group[0][0], group[-1][0]
            if previous is not None and any(not x.strip() for x in lines[previous + 1:first]):
                out.append('')
            original_text = ' '.join(s.strip() for _, s in group)
            # Keep relative indentation after removing the common three-space
            # Gutenberg verse margin. Source text itself remains in source.txt.gz.
            indent = max(0, len(group[0][1]) - len(group[0][1].lstrip()) - 3)
            text = (' ' * indent + original_text).replace('_', '')
            if len(group) > 1:
                changes.append({'kind': 'source_soft_wrap', 'source_lines': [i + 1 for i, _ in group],
                                'html_browser_line': html_line, 'source_text': '\n'.join(s for _, s in group),
                                'output_text': text, 'evidence_url': HTML_URL})
            if '_' in original_text:
                changes.append({'kind': 'italic_markup_only', 'source_lines': [i + 1 for i, _ in group],
                                'source_text': original_text, 'output_text': text})
            if original_text in SPEAKERS:
                text = '# APPARATUS: ' + original_text
                changes.append({'kind': 'speaker_heading', 'source_lines': [first + 1],
                                'source_text': original_text, 'output_text': text})
            # Only these three source-attested dialogue songs print abbreviated
            # speaker labels before a sung line. A verse pronoun without the
            # exact uppercase label and period remains sung text.
            inline = re.match(r'^(\s*)(HE\.|SHE\.|BOTH\.)\s+(.+)$', text)
            if title in INLINE_SPEAKER_TITLES and inline:
                apparatus = '# APPARATUS: ' + inline[2]
                verse = inline[1] + inline[3]
                changes.append({'kind': 'inline_speaker_heading', 'source_lines': [i + 1 for i, _ in group],
                                'source_text': text, 'output_text': apparatus + '\n' + verse})
                out.append(apparatus)
                text = verse
            out.append(text)
            previous = final
        text = '\n'.join(out).strip()
        assert text and '[Picture:' not in text and 'PROJECT GUTENBERG' not in text
        rows.append({'id': f'pg934-{k + 1:03d}', 'title': title, 'index_title': title,
                     'index_page': int(page), 'index_line': toc_line, 'author': 'W. S. Gilbert',
                     'text': text, 'disposition': 'eligible',
                     'reason': 'Complete independently titled original English song in the supplied Songs of a Savoyard collection; narrative content within a song is retained, with no numeric length cutoff.',
                     'source_locator': f'{URL} (physical lines {start + 1}-{stop}; printed page {page})',
                     'source_url': URL, 'source_line_start': start + 1, 'source_line_end': stop,
                     'source_sha256': hashlib.sha256(raw).hexdigest(),
                     'translation_evidence': 'Author-attributed English song by W. S. Gilbert; no translator or foreign-original attribution in the supplied unit. Latin/French titles, loan phrases, comic spellings and stage-character voices are retained, not treated as translations.',
                     'transformations': changes,
                     'verse_line_count': sum(bool(x.strip()) and not x.lstrip().startswith('#') for x in text.splitlines())})
    assert sum(c['kind'] == 'source_soft_wrap' for r in rows for c in r['transformations']) == 60
    assert sum(c['kind'] == 'speaker_heading' for r in rows for c in r['transformations']) == 5
    assert sum(c['kind'] == 'inline_speaker_heading' for r in rows for c in r['transformations']) == 28
    return rows


if __name__ == '__main__':
    rows = extract(sys.argv[1] if len(sys.argv) > 1 else None)
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / 'candidates.json'
    dest.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(rows)} complete candidates -> {dest}')
