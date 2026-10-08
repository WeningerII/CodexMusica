"""Offline boundary, dialect-preservation and scope tests for PG27195."""
import hashlib
import json
from pathlib import Path
import runpy
import unittest

HERE = Path(__file__).resolve().parent


class TalleyWitnessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.adapter = runpy.run_path(str(HERE / 'adapter.py'))
        cls.rows = json.loads((HERE / 'candidates.json').read_text())

    def test_offline_replay_and_complete_source_partition(self):
        self.assertEqual(self.adapter['extract'](), self.rows)
        self.assertEqual(len(self.rows), 349)
        self.assertEqual(sum(r['disposition'] == 'eligible' for r in self.rows), 333)
        self.assertEqual(sum(r['source_section'] == 'Foreign Section' for r in self.rows), 13)
        self.assertTrue(all(r['disposition'] == 'excluded' for r in self.rows[336:]))
        self.assertEqual(self.rows[335]['title'], 'JACK AND DINAH WANT FREEDOM')
        self.assertEqual(self.rows[300]['title'], 'FROG WENT A-COURTING')
        self.assertEqual(self.rows[300]['verse_line_count'], 75)
        for r in self.rows:
            self.assertEqual(r['text_sha256'], hashlib.sha256(r['text'].encode()).hexdigest())

    def test_pronunciation_aids_and_spelling_are_not_standardized(self):
        self.assertEqual(self.adapter['decode_ascii_marks']("y[=o]' sh[=o]' f[=u]ner'l m[)e]n"), "yō' shō' fūner'l mĕn")
        self.assertIn("yō' finger", self.rows[1]['text'])
        self.assertIn("fūner'l", self.rows[34]['text'])
        self.assertIn("gwine", self.rows[0]['text'])
        self.assertIn("W'en", self.rows[4]['text'])
        for r in self.rows:
            self.assertNotIn('[=', r['text'])
            self.assertNotIn('[Pg', r['text'])
            self.assertNotRegex(r['text'], r'\[\d+\]')

    def test_spoken_prose_and_speaker_roles_are_apparatus(self):
        text = self.rows[58]['text']
        self.assertIn('# APPARATUS: spoken interlocution: (Fiddler)', text)
        self.assertEqual(self.rows[58]['verse_line_count'], 14)
        self.assertIn('He don\'t lak whisky', text)
        self.assertIn('# APPARATUS: speaker (Fox Call)', self.rows[93]['text'])
        self.assertIn('"Fox in de mawnin\'!"', self.rows[93]['text'])
        self.assertNotIn('These are dance steps.', self.rows[0]['text'])
        self.assertTrue(any('These are dance steps.' in n for n in self.rows[0]['editorial_notes_excluded']))

    def test_explicit_mixed_language_and_incomplete_witness_exclusions(self):
        for i in [249, 251]:
            self.assertEqual(self.rows[i]['disposition'], 'excluded')
            self.assertIn('original_language_unresolved:', self.rows[i]['reason'])
        self.assertEqual(self.rows[327]['disposition'], 'excluded')
        self.assertIn('incomplete_source_work:', self.rows[327]['reason'])
        self.assertEqual(json.loads((HERE / 'collection.json').read_text())['publication_year'], 1922)


if __name__ == '__main__':
    unittest.main()
