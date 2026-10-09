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
    def test_exact_complete_shanties_and_dialect(self):
        self.assertEqual(len(self.rows),30)
        self.assertIn('äal',self.rows[0]['text'])
        self.assertIn("Singin' Hinnies",self.rows[0]['text'])
        self.assertNotIn('Glossary',self.rows[0]['text'])
        self.assertEqual(self.rows[-1]['title'],'Paddy Doyle’s boots')
    def test_apparatus_and_footnotes(self):
        low=next(r for r in self.rows if r['title']=='Lowlands away')
        self.assertIn('# APPARATUS: INTRODUCTION.',low['text'])
        self.assertNotIn('(INTRODUCTION.)',low['text'])
        self.assertNotIn('(twice)',low['text'])
        self.assertTrue(all('[' not in r['title'] for r in self.rows))

if __name__=='__main__':unittest.main()
