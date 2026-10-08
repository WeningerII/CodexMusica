"""Offline source replay, lineation, boundaries and preservation for PG934."""
import gzip
import importlib.util
import json
import re
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('pg934_adapter', HERE / 'adapter.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class SavoyardWitnessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = json.loads((HERE / 'candidates.json').read_text())
        cls.by_title = {r['title']: r for r in cls.rows}

    def test_complete_index_and_offline_replay(self):
        self.assertEqual(self.rows, adapter.extract())
        self.assertEqual(len(self.rows), 87)
        self.assertEqual(len(self.by_title), 87)
        self.assertEqual(self.rows[0]['title'], 'THE DARNED MOUNSEER')
        self.assertEqual(self.rows[-1]['title'], 'THE PLAYED-OUT HUMORIST')
        self.assertEqual([r['id'] for r in self.rows], [f'pg934-{i:03d}' for i in range(1, 88)])

    def test_source_and_typography_preserved(self):
        major = self.by_title['THE MODERN MAJOR-GENERAL']['text']
        self.assertIn('Major-Gineral', major)
        self.assertIn('hypotenuse', major)
        self.assertIn('animalculous', major)
        self.assertIn('Major-General has never sat a gee', major)
        self.assertNotIn('_', major)
        self.assertIn('(Which is what them furriners do)', self.rows[0]['text'])
        self.assertIn('a f-famine!', self.by_title['HER TERMS']['text'])
        for row in self.rows:
            self.assertNotIn('PROJECT GUTENBERG', row['text'])
            self.assertNotIn('[Picture:', row['text'])

    def test_speakers_are_apparatus_but_wrapped_names_are_verse(self):
        duke = self.by_title['THE DUKE AND THE DUCHESS']
        self.assertEqual(duke['text'].count('# APPARATUS:'), 5)
        self.assertEqual(duke['verse_line_count'], 60)
        self.assertNotIn('# APPARATUS: JOSEPHINE', self.by_title['THE ÆSTHETE']['text'])
        self.assertNotIn('# APPARATUS: BARING', self.by_title['A NIGHTMARE']['text'])

    def test_long_patter_uses_verified_html_lineation(self):
        nightmare = self.by_title['A NIGHTMARE']
        self.assertEqual(nightmare['verse_line_count'], 32)
        self.assertEqual(nightmare['disposition'], 'eligible')
        self.assertIn('taboo’d by anxiety,', nightmare['text'].splitlines()[0])
        self.assertIn('in clover;', nightmare['text'].splitlines()[-2])
        self.assertTrue(nightmare['text'].endswith('them over!'))
        self.assertEqual(sum(c['kind'] == 'source_soft_wrap' for r in self.rows for c in r['transformations']), 60)

    def test_inline_speaker_labels_preserve_sung_words(self):
        for title, count, first in [
                ('THE MERRYMAN AND HIS MAID', 13, 'I HAVE a song to sing, O!'),
                ('HE AND SHE', 11, 'I know a youth who loves a little maid—'),
                ('WILLOW WALY!', 4, 'PRITHEE, pretty maiden—prithee, tell me true')]:
            row = self.by_title[title]
            self.assertEqual(row['text'].count('# APPARATUS:'), count)
            self.assertEqual(row['text'].splitlines()[1], first)
            self.assertFalse(any(re.match(r'^\s*(HE|SHE|BOTH)\.\s+', line)
                                 for line in row['text'].splitlines()))
            receipts = [c for c in row['transformations'] if c['kind'] == 'inline_speaker_heading']
            self.assertEqual(len(receipts), count)
            for receipt in receipts:
                sung = re.sub(r'^(\s*)(HE\.|SHE\.|BOTH\.)\s+', r'\1', receipt['source_text'])
                self.assertEqual(receipt['output_text'].split('\n')[1], sung)
        self.assertIn('He sipped no sup, and he craved no crumb,', self.by_title['THE MERRYMAN AND HIS MAID']['text'])
        self.assertIn('He cannot eat and he cannot sleep—', self.by_title['HE AND SHE']['text'])

    def test_mixed_edition_credits_and_source_pin(self):
        import hashlib
        meta = json.loads((HERE / 'collection.json').read_text())
        raw = gzip.decompress((HERE / 'source.txt.gz').read_bytes())
        self.assertEqual(hashlib.sha256(raw).hexdigest(), meta['source_sha256'])
        self.assertEqual(meta['publication_year'], 1920)
        self.assertEqual(meta['supplied_edition_years'], [1920, 1884])
        self.assertEqual(meta['rights_evidence']['jurisdiction'], 'United States')
        self.assertIn('reconstructed', meta['validation']['source_pin'])


if __name__ == '__main__':
    unittest.main()
