import json, unittest
from pathlib import Path
import adapter
HERE=Path(__file__).resolve().parent
class SourceBoundaries(unittest.TestCase):
    def test_reproduction(self):
        self.assertEqual(adapter.extract(),json.loads((HERE/'candidates.json').read_text()))
    def test_complete_ledger(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),114)
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
        for row in rows:
            self.assertTrue(row['text'].strip())
            self.assertNotIn('PROJECT GUTENBERG',row['text'])
    def test_reviewed_boundaries_and_scope(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(rows['line-3768']['verse_line_count'],39)
        self.assertNotIn('ON THE DUNES.',rows['line-3768']['text'])
        self.assertNotIn('LORD OF MORNING.',rows['line-3768']['text'])
        self.assertNotIn('THE TRAVELLER.',rows['line-3768']['text'])
        self.assertEqual(rows['line-1331']['verse_line_count'],68)
        self.assertEqual(rows['line-896']['verse_line_count'],25)
        self.assertIn('Grand Pré',rows['line-931']['text'])
        self.assertNotIn('Arnoldus Villanova--',rows['line-3090']['text'])
        self.assertNotIn('restoreth',rows['line-4554']['text'])
        self.assertEqual(rows['line-2673']['verse_line_count'],32)
        self.assertTrue(rows['line-6628']['text'].endswith('Laus Deo! Nunc bibendum est!'))

if __name__=='__main__':unittest.main()
