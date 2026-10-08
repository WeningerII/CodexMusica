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
    def test_all_numbered_whole_limericks(self):
        rows=adapter.extract()
        self.assertEqual(len(rows),113)
        self.assertTrue(all(r['verse_line_count']==4 for r in rows[1:]))
        self.assertEqual(rows[0]['verse_line_count'],3)
    def test_source_spellings(self):
        text='\n'.join(r['text'] for r in adapter.extract())
        for spelling in ('borascible','scroobious','Philœ','sarpint','Fiddle-de-dee'):
            self.assertIn(spelling,text)

if __name__=='__main__':unittest.main()
