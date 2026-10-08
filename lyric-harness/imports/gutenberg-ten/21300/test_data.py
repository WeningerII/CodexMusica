"""Offline boundary and provenance checks for the Cowboy Songs witness."""
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent


class CowboyWitnessTest(unittest.TestCase):
    def setUp(self):
        self.rows = {x['id']: x for x in json.loads((HERE / 'candidates.json').read_text())}

    def test_complete_contents_and_single_line_refrains(self):
        self.assertEqual(len(self.rows), 153)
        self.assertEqual(self.rows['page132']['text'].count('Whoo-a-whoo-a-whoo-a-whoo.'), 14)
        self.assertIn('Bung yer eye: bung yer eye.', self.rows['page252']['text'])
        self.assertEqual(self.rows['page249']['index_anchor'], 'page247')
        self.assertTrue(self.rows['page249']['source_locator'].endswith('#page249'))

    def test_structural_labels_are_not_sung_words(self):
        self.assertIn('# APPARATUS: . . . . . .', self.rows['page324']['text'])
        self.assertIn('[REFRAIN]', self.rows['page329']['text'])
        self.assertIn('[CHORUS]', self.rows['page377']['text'])
        for row in self.rows.values():
            sung = [line for line in row['text'].splitlines() if line and not line.startswith(('#', '['))]
            self.assertFalse(any(line in {'REFRAIN:', 'Refrain:', 'Refrain:—', 'Cho:—', 'Chorus:', 'Chorus:—'} for line in sung))

    def test_narrative_review_and_edition(self):
        self.assertEqual(self.rows['page139']['disposition'], 'excluded')
        self.assertEqual(self.rows['page139']['verse_line_count'], 204)
        self.assertEqual(self.rows['page271']['disposition'], 'eligible')
        self.assertEqual(json.loads((HERE / 'collection.json').read_text())['publication_year'], 1929)
        self.assertEqual(self.rows['page335']['author'], 'Larry Chittenden')
        for row in self.rows.values():
            self.assertNotIn('(p.', row['text'])
            self.assertNotIn('Footnote ', row['text'])
            self.assertNotIn('Download Finale', row['text'])


if __name__ == '__main__':
    unittest.main()
