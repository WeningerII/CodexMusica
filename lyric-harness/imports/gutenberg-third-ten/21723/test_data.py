import unittest,json,hashlib
from pathlib import Path
from adapter import extract
HERE=Path(__file__).resolve().parent
class SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.rows=extract()
    def test_exact_offline_replay(self):
        self.assertEqual(self.rows,json.loads((HERE/'candidates.json').read_text()))
    def test_content_hashes_and_population(self):
        meta=json.loads((HERE/'collection.json').read_text())
        self.assertEqual(len(self.rows),meta['counts']['candidate_units'])
        self.assertEqual(len({r['id'] for r in self.rows}),len(self.rows))
        for r in self.rows:
            self.assertEqual(hashlib.sha256(r['text'].encode()).hexdigest(),r['text_sha256'])
            self.assertTrue(r['source_locator'].startswith(meta['source_url']+'#'))
            self.assertNotIn('�',r['text'])
    def test_source_credits_and_complete_poem(self):
        self.assertEqual(self.rows[0]['title'],'OUT WHERE THE WEST BEGINS')
        self.assertEqual(self.rows[0]['author'],'Arthur Chapman')
        self.assertNotIn('Arthur Chapman.',self.rows[0]['text'])
        glory=next(r for r in self.rows if r['title']=='THE GLORY TRAIL')
        self.assertIn("'WAY high up the Mogollons,",glory['text'])
        self.assertNotIn('[1]',glory['text'])
        riding=next(r for r in self.rows if r['title']=="JUST A-RIDIN'!")
        self.assertNotIn('cowpuncher.) See',riding['text'])
        self.assertEqual(riding['author'],'Charles Badger Clark, Jr.')
    def test_printed_ornaments_are_apparatus(self):
        texas=next(r for r in self.rows if r['title']=='THE TRANSFORMATION OF A TEXAS GIRL')
        self.assertIn('# APPARATUS: printed separator · · · · · · ·',texas['text'])
        riding=next(r for r in self.rows if r['title']=="RIDIN' UP THE ROCKY TRAIL FROM TOWN")
        self.assertTrue(riding['text'].startswith("WE'RE the children of the open"))
        self.assertNotIn('Billy Leamont',riding['text'])
        self.assertEqual(riding['verse_line_count'],36)
        self.assertTrue(any('This fragment is not included' in x for x in riding['editorial_notes_excluded']))
        self.assertNotIn('\n* * *\n',riding['text'])
    def test_named_exclusions(self):
        self.assertEqual(sum(r['disposition']=='excluded' for r in self.rows),7)
        self.assertTrue(next(r for r in self.rows if 'WHISKEY BILL' in r['title'])['reason'].startswith('incomplete_source'))

if __name__=='__main__':unittest.main()
