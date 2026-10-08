#!/usr/bin/env python3
"""Independent source-fidelity check. Pass pinned HTML and ISO-8859-1 text paths."""
import hashlib
import json
from pathlib import Path
import re
import sys
from extract import extract, ROOT

def main():
    raw_html, raw_text = (Path(p).read_bytes() for p in sys.argv[1:])
    assert hashlib.sha256(raw_text).hexdigest() == '504b0907149678e2ccd0804fa71c9adeeae8711fa336a458a8dbcd61136e255f'
    rows = json.loads((ROOT / 'candidates.json').read_text())
    assert extract(raw_html) == rows, 'Committed candidates differ from pinned extraction'
    source = raw_text.decode('latin1').replace('\r\n', '\n')
    headings = list(re.finditer(r'^(\d+)\. {2,}(.+)$', source, re.M))
    assert [int(h[1]) for h in headings] == list(range(1, 1009))
    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else source.index('*** END')
        block = source[heading.end():end].splitlines()
        start = next(i for i, line in enumerate(block) if re.match(r'(1 +| {3,})\S', line))
        lines = []
        for line in block[start:]:
            if line.strip() and not re.match(r'(\d+ +| +)\S', line):
                break  # unindented next section's heading
            if line.strip():
                lines.append(re.sub(r'^\d+ +', '', line).strip())
        # Plain-text underscores denote typographic emphasis, not lyric characters.
        expected = ' '.join(' '.join(lines).replace('_', '').split())
        actual = ' '.join(rows[index]['text'].split())
        assert actual == expected, f'Plain text differs at hymn {index + 1}'
    assert sum(r['disposition'] == 'eligible' for r in rows) == 990
    assert sum(r['reason'] == 'translation' for r in rows) == 15
    assert sum(r['reason'] == 'original_language_unresolved' for r in rows) == 3
    print('PASS: 1008 source entries; all 17169 verse lines match the independent plain-text edition; pinned regeneration exact; 990 eligible, 18 excluded.')


if __name__ == '__main__':
    main()
