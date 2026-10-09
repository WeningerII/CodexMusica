"""Source-specific boundary/faithfulness checks; no shared-engine changes."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('adapter_' + HERE.name, HERE/'adapter.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
ROWS = json.loads((HERE/'candidates.json').read_text())
BY = {r['id']:r for r in ROWS}


class SourceBoundaryTests(unittest.TestCase):
    def test_offline_replay(self):
        self.assertEqual(adapter.extract(), ROWS)
        meta = json.loads((HERE/'collection.json').read_text())
        self.assertEqual(hashlib.sha256(gzip.decompress((HERE/'source.html.gz').read_bytes())).hexdigest(),meta['retrieval']['sha256'])

    def test_contents_reconciled(self):
        contents = json.loads((HERE/'contents.json').read_text())
        self.assertEqual(len(ROWS), 68)
        mapped = [r['candidate_id'] for r in contents if 'candidate_id' in r]
        self.assertEqual(sorted(mapped,key=int),sorted(BY,key=int))
        self.assertEqual(len(mapped),len(set(mapped)))

    def test_source_apparatus_is_not_sung(self):
        for row in ROWS:
            self.assertNotRegex(row['text'],r'\[Pg? ?\d+\]|\[\d+\]|\[A\]')
            self.assertNotIn('Copied by permission',row['text'])
            self.assertNotIn('Project Gutenberg',row['text'])
            self.assertNotIn('Public domain',row['text'])
            self.assertNotRegex(row['text'],r'(?m)^(CHORUS|Chorus|Air|Tune)[.—:]')
            if 'sections' in row:
                self.assertEqual(row['text'],'\n\n'.join('\n'.join(s['lines']) for s in row['sections']))
            self.assertEqual(row['verse_line_count'],sum(bool(l) for l in row['text'].splitlines()))

    def test_reviewed_exclusions(self):
        self.assertEqual({r['id'] for r in ROWS if r['disposition']=='excluded'}, {'52'})

    def test_first_last_boundaries(self):
        self.assertEqual(BY['1']['text'].splitlines()[0], 'Thou wilt come no more, gentle Annie—')
        self.assertEqual(BY['68']['text'].splitlines()[-1], 'The dear old folks I loved long ago.')
        self.assertTrue(all(row['verse_line_count'] >= 8 for row in ROWS))

    def test_margin_refrain_retained(self):
        self.assertIn('Nothing but hard times.', BY['21']['text'])
        self.assertEqual(BY['23']['text'].count('The Cabin stands upon the stream, &c.'), 4)

if __name__ == '__main__':
    unittest.main()
