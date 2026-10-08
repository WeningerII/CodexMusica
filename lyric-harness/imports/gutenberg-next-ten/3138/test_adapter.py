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
    def test_translation_notes_obeyed(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(len(rows),100)
        for key in ('line-538','line-753','line-1063','line-2322','line-2893','line-3416','line-3817','line-4133'):
            self.assertEqual(rows[key]['disposition'],'excluded')
        self.assertEqual(rows['line-2058']['disposition'],'eligible') # After Romney is a picture, not a translation.
    def test_lineation_and_embedded_greek(self):
        rows={r['id']:r for r in adapter.extract()}
        self.assertEqual(rows['line-3646']['verse_line_count'],28)
        self.assertIn('π',rows['line-2855']['text'])
        self.assertIn('κεν',rows['line-2855']['text'])
        self.assertNotIn('Un Livre',rows['line-321']['text'])
        self.assertEqual(rows['line-321']['verse_line_count'],28)
    def test_printed_dialect_not_rewritten(self):
        row=next(r for r in adapter.extract() if r['id']=='line-586')
        self.assertIn('cauldrife',row['text'])
        self.assertEqual(row['disposition'],'eligible')

if __name__=='__main__':unittest.main()
