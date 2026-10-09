import json, unittest
from pathlib import Path
import adapter
HERE=Path(__file__).resolve().parent
class SourceBoundaries(unittest.TestCase):
    def test_reproduction(self):
        self.assertEqual(adapter.extract(),json.loads((HERE/'candidates.json').read_text()))
    def test_complete_ledger(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),60)
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
        for row in rows:
            self.assertTrue(row['text'].strip())
            self.assertNotIn('PROJECT GUTENBERG',row['text'])
    def test_reviewed_boundaries_and_scope(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(rows['line-750']['disposition'],'eligible')
        self.assertEqual(rows['line-750']['verse_line_count'],36)
        for n in (948,972,983,1112,2478):
            self.assertEqual(rows[f'line-{n}']['disposition'],'excluded')
        self.assertEqual(rows['line-2635']['verse_line_count'],10)
        self.assertIn("Seems lak to me",rows['line-1957']['text'])

if __name__=='__main__':unittest.main()
