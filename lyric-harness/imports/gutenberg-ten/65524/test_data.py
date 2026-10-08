"""Offline boundary checks for Modern Street Ballads' distinct printed units."""
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent


class StreetWitnessTest(unittest.TestCase):
    def setUp(self):
        self.rows = {x['id']: x for x in json.loads((HERE / 'candidates.json').read_text())}

    def test_indexed_and_supplemental_units(self):
        self.assertEqual(sum(x['indexed'] for x in self.rows.values()), 138)
        self.assertEqual(len(self.rows), 139)
        self.assertFalse(self.rows['page_4-john-hobbs']['indexed'])
        self.assertTrue(self.rows['page_4-john-hobbs']['text'].startswith('A jolly shoemaker, John Hobbs'))
        self.assertNotIn('John Hobbs', self.rows['page_1']['text'])
        self.assertTrue(self.rows['page_1']['text'].endswith('# APPARATUS: * * * * * *'))

    def test_structural_labels_are_not_sung_words(self):
        self.assertEqual(self.rows['page_1']['verse_line_count'], 46)
        self.assertIn('[CHORUS]', self.rows['page_1']['text'])
        self.assertIn('# APPARATUS: (The chorus make up the last four lines of this verse.)', self.rows['page_52']['text'])
        self.assertEqual(self.rows['page_173']['text'].count('# APPARATUS: (Spoken)'), 10)
        for row in self.rows.values():
            sung = [line for line in row['text'].splitlines() if line and not line.startswith(('#', '['))]
            self.assertFalse(any(line.startswith('(Spoken)') for line in sung))
            self.assertNotIn('( Chorus. )', sung)
            self.assertNotIn('* * * * * *', sung)

    def test_prose_and_trailing_footnote_not_lyrics(self):
        self.assertEqual(self.rows['page_313']['disposition'], 'excluded')
        self.assertEqual(self.rows['page_313']['verse_line_count'], 0)
        self.assertTrue(self.rows['page_403']['text'].endswith('For killing the finest butcher that ever the sun shone on.'))
        self.assertNotIn('losing of the Prentice boys', self.rows['page_403']['text'])
        for row in self.rows.values():
            self.assertNotIn('Footnote_', row['text'])
            self.assertNotRegex(row['text'], r'\{\d+\}|\[\d+\]')


if __name__ == '__main__':
    unittest.main()
