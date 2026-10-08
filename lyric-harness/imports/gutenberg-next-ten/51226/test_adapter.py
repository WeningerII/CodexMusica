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
        self.assertEqual(len(ROWS), 51)
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

    def test_prose_platform_and_short_complete_epigram(self):
        contents=json.loads((HERE/'contents.json').read_text())
        excluded=[r for r in contents if r['disposition']=='excluded']
        self.assertEqual(len(excluded),1)
        self.assertEqual(excluded[0]['title'],'The Republican Platform')
        self.assertEqual(BY['39']['verse_line_count'],4)
        self.assertEqual(BY['39']['disposition'],'eligible')

    def test_attributions_and_stage_direction(self):
        self.assertEqual(BY['14']['author'],'Samuel Copp')
        self.assertEqual(BY['15']['author'],'R. M. N.')
        self.assertEqual(BY['35']['author'],'W. B. H.')
        self.assertNotEqual(BY['25']['author'],'THE HUTCHINSON FAMILY')
        self.assertNotIn('GIANT’S BASS-SOLO',BY['25']['text'])
        self.assertIn('GIANT’S BASS-SOLO.',BY['25']['editorial_notes_excluded'])
        self.assertIn('“Fe, fi, fo, fum,',BY['25']['text'])
        self.assertIn('home-con-sump-shi-on',BY['51']['text'])
        self.assertTrue(BY['51']['text'].endswith('Oh, a jolly good crew, etc.'))


if __name__ == '__main__':
    unittest.main()
