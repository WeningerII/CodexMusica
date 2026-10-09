"""Offline replay, body boundaries, source spellings and eligibility checks."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('newcastle_adapter', HERE/'adapter.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class NewcastleWitnessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = json.loads((HERE/'candidates.json').read_text())
        cls.by_id = {r['id']:r for r in cls.rows}
        cls.collection = json.loads((HERE/'collection.json').read_text())

    def test_exact_offline_replay_and_source_pin(self):
        self.assertEqual(adapter.extract(HERE/'source.html.gz'), self.rows)
        raw = gzip.decompress((HERE/'source.html.gz').read_bytes())
        self.assertEqual(hashlib.sha256(raw).hexdigest(),self.collection['source_sha256'])
        self.assertEqual(len(raw),self.collection['source_bytes'])

    def test_contents_aliases_and_unanchored_units(self):
        self.assertEqual(len(self.rows),214)
        self.assertEqual(sum(len(r['contents_entries']) for r in self.rows),216)
        self.assertEqual(len(self.by_id['THE_JENNY_HOOLET']['contents_entries']),2)
        for key in ('Page_55','Page_138','Page_216','Page_228'):
            self.assertIn(key,self.by_id)
            self.assertTrue(self.by_id[key]['text'])

    def test_malformed_coronation_container_is_complete(self):
        row=self.by_id['On_George_the_Fourths_Coronation']
        self.assertEqual(row['verse_line_count'],24)
        self.assertTrue(row['text'].startswith('Men who have with Mayors fed;'))
        self.assertTrue(row['text'].endswith('Brothers, look to me!'))
        self.assertEqual(len(row['contents_entries']),2)

    def test_no_generic_length_cap(self):
        self.assertEqual(sum(r['disposition']=='eligible' for r in self.rows),211)
        self.assertEqual({r['id'] for r in self.rows if r['disposition']=='excluded'},set(adapter.EXCLUSIONS))
        self.assertEqual(self.by_id['THE_CHANGES_ON_THE_TYNE']['disposition'],'eligible')
        self.assertGreater(self.by_id['THE_CHANGES_ON_THE_TYNE']['verse_line_count'],100)
        self.assertEqual(self.by_id['THE_PITMANS_PAY']['verse_line_count'],404)

    def test_original_dialect_and_abbreviated_refrains(self):
        alltext='\n'.join(r['text'] for r in self.rows)
        self.assertIn('Gan hyem and get the bairns to bed;',alltext)
        self.assertIn("'Bout Lunnun",self.by_id['CANNY_NEWCASSEL']['text'])
        self.assertIn('&c.',self.by_id['CANNY_NEWCASSEL']['text'])
        self.assertIn('[CHORUS]',alltext)
        self.assertNotIn('[Pg ',alltext)
        self.assertNotIn('They brought the piper, Sandy Brown', self.by_id['A_GIPSYS_SONG']['text'])
        self.assertEqual(self.by_id['A_GIPSYS_SONG']['verse_line_count'],60)
        for row in self.rows:
            self.assertEqual(hashlib.sha256(row['text'].encode()).hexdigest(),row['text_sha256'])
            self.assertNotIn('Footnote_',row['text'])
            self.assertNotIn('pronunciations',row)

    def test_printed_attribution_conflicts_preserved(self):
        self.assertIn('John Morris (body byline',self.by_id['CANNY_SHEELS']['author'])
        self.assertIn('George Pickering',self.by_id['DONOCHT-HEAD52']['author'])
        self.assertEqual(self.collection['publication_year'],1842)


if __name__=='__main__':
    unittest.main()
