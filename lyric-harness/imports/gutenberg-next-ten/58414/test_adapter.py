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
        self.assertEqual(len(ROWS), 46)
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

    def test_tune_is_not_translation_and_all_stanzas_retained(self):
        self.assertIn('Air—Marseilles Hymn.',BY['4']['editorial_notes_excluded'])
        self.assertEqual(BY['4']['disposition'],'eligible')
        self.assertEqual(BY['1']['verse_line_count'],30)
        self.assertTrue(BY['1']['text'].endswith('Its folds above a single slave.'))
        self.assertTrue(BY['46']['text'].endswith('Send up the shout—hurrah! hurrah!'))

    def test_chorus_and_reported_speech_preserved(self):
        self.assertTrue(any(s['type']=='chorus' for s in BY['5']['sections']))
        self.assertIn('Shine on, northern star, thou’rt beautiful and bright',BY['5']['text'])
        self.assertEqual(BY['13']['author'],'ELIAS SMITH')
        self.assertNotIn('This song is said',BY['27']['text'])
        self.assertTrue(any('This song is said' in x for x in BY['27']['editorial_notes_excluded']))


if __name__ == '__main__':
    unittest.main()
