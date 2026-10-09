import json, unittest
from pathlib import Path
import adapter
HERE=Path(__file__).resolve().parent
class SourceBoundaries(unittest.TestCase):
    def test_reproduction(self):
        self.assertEqual(adapter.extract(),json.loads((HERE/'candidates.json').read_text()))
    def test_complete_ledger(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),54)
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
        for row in rows:
            self.assertTrue(row['text'].strip())
            self.assertNotIn('PROJECT GUTENBERG',row['text'])
    def test_reviewed_boundaries_and_scope(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(rows['line-2828']['verse_line_count'],32)
        self.assertEqual(rows['line-1361']['verse_line_count'],14)
        self.assertNotIn('THIS BOOK WAS PRINTED',rows['line-2828']['text'])
        self.assertEqual(rows['line-2416']['disposition'],'eligible')
        self.assertEqual(rows['line-620']['disposition'],'eligible')
        self.assertEqual(rows['line-721']['disposition'],'excluded')

if __name__=='__main__':unittest.main()
