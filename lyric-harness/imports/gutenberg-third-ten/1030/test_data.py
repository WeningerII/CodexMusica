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
    def test_source_lines_and_editorial_quotes(self):
        first=self.rows[0]
        self.assertEqual(first['author'],'Martin Parker')
        self.assertEqual(first['text'].splitlines()[0],'What Booker doth prognosticate')
        self.assertNotIn('Whatever yet was published by me',first['text'])
        self.assertNotIn('[1]',first['text'])
        self.assertIn('\nDid Walker no predictions lack\n',first['text'])
        self.assertNotIn('[Did Walker',first['text'])
        self.assertIn('When the King enjoys his own again?',first['text'])
    def test_separator_ornament_is_apparatus(self):
        brewer=next(r for r in self.rows if r['title']=='THE PROTECTING BREWER.')
        self.assertTrue(brewer['text'].startswith('A Brewer may be a burgess grave,'))
        self.assertNotIn('Some Christian kings began to quake',brewer['text'])
        self.assertEqual(brewer['verse_line_count'],44)
        self.assertTrue(any('Some Christian kings began to quake' in x for x in brewer['editorial_notes_excluded']))
        self.assertNotIn('\n* * * * *\n',brewer['text'])
    def test_intact_long_narrative_exclusion(self):
        excluded=[r for r in self.rows if r['disposition']=='excluded']
        self.assertEqual(len(excluded),1)
        self.assertIn('COBBLER',excluded[0]['title'])
        self.assertGreater(excluded[0]['verse_line_count'],500)

if __name__=='__main__':unittest.main()
