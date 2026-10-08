import json, unittest
from pathlib import Path
import adapter
HERE=Path(__file__).resolve().parent
class SourceBoundaries(unittest.TestCase):
    def test_reproduction(self):
        self.assertEqual(adapter.extract(),json.loads((HERE/'candidates.json').read_text()))
    def test_ids_unique_and_content_nonempty(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),len({r['id'] for r in rows}))
        for row in rows:
            self.assertTrue(row['text'].strip())
            self.assertNotIn('PROJECT GUTENBERG',row['text'])
    def test_whole_work_exclusions(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),130)
        self.assertEqual({r['id'] for r in rows if r['disposition']=='excluded'},{'line-1174','line-1357','line-3844'})
    def test_dedication_not_advertisement(self):
        row=adapter.extract()[0]
        self.assertEqual(row['verse_line_count'],8)
        self.assertTrue(row['text'].startswith('Take, dear,'))
        self.assertNotIn('SEPTEMBER',row['text'])
    def test_numbered_poems_are_whole(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(rows['line-2623']['verse_line_count'],16)
        self.assertIn('I am the captain of my soul.',rows['line-2623']['text'])
        self.assertIn('Fluttersd',rows['line-1087']['text'])
        self.assertIn('Cæsar',rows['line-388']['text'])

if __name__=='__main__':unittest.main()
