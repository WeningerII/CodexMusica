import json, unittest
from pathlib import Path
import adapter
HERE=Path(__file__).resolve().parent
class SourceBoundaries(unittest.TestCase):
    def test_reproduction(self):
        self.assertEqual(adapter.extract(),json.loads((HERE/'candidates.json').read_text()))
    def test_complete_ledger(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),59)
        self.assertEqual(len({r['id'] for r in rows}),len(rows))
        for row in rows:
            self.assertTrue(row['text'].strip())
            self.assertNotIn('PROJECT GUTENBERG',row['text'])
    def test_reviewed_boundaries_and_scope(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(rows['line-334']['verse_line_count'],7)
        self.assertEqual(rows['line-1493']['verse_line_count'],17)
        self.assertNotIn('PORTRAITS',rows['line-614']['text'])
        self.assertNotIn('(Parc Monceau)',rows['line-429']['text'])
        self.assertTrue(all(row['disposition']=='eligible' for row in rows.values()))

if __name__=='__main__':unittest.main()
