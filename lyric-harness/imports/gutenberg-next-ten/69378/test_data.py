"""Offline source replay and meaningful lyric-boundary regression checks."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('workaday_adapter', HERE/'adapter.py')
adapter=importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)

class WorkadayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows=json.loads((HERE/'candidates.json').read_text())
        cls.by={r['id']:r for r in cls.rows}

    def test_replay_and_complete_partition(self):
        self.assertEqual(adapter.extract(),self.rows)
        self.assertEqual(len(self.rows),329)
        self.assertEqual(sum(r['disposition']=='eligible' for r in self.rows),271)
        self.assertEqual(sum(r['disposition']=='excluded' for r in self.rows),58)
        self.assertEqual(len(self.by),len(self.rows))
        for row in self.rows:
            self.assertEqual(hashlib.sha256(row['text'].encode()).hexdigest(),row['text_sha256'])
            self.assertLessEqual(row['source_line_start'],row['source_line_end'])

    def test_printed_versions_are_not_assembled(self):
        john=[r for r in self.rows if r['title'].startswith('JOHN HENRY — version')]
        self.assertEqual([r['source_variant'] for r in john],list('ABCDEFGHIJK'))
        self.assertEqual(len([r for r in self.rows if r['title'].startswith('RAISE A RUKUS TONIGHT — version')]),3)
        self.assertNotIn('JOHN HENRY',john[0]['text'])
        self.assertNotIn('B\n',john[0]['text'])

    def test_explicit_incomplete_witnesses_excluded(self):
        self.assertEqual(self.by['line01736']['disposition'],'excluded')
        self.assertIn('condensed',self.by['line01736']['reason'])
        self.assertEqual(self.by['line05690']['disposition'],'excluded')
        self.assertIn('fragment',self.by['line05690']['reason'])
        self.assertEqual(self.by['line01509']['disposition'],'excluded')

    def test_short_and_untitled_songs_remain(self):
        self.assertEqual(self.by['line02802']['disposition'],'eligible')
        self.assertEqual(self.by['line02802']['verse_line_count'],4)
        for key in ('line00812','line07988','line09094','line09141','line09275'):
            self.assertEqual(self.by[key]['disposition'],'eligible')
        self.assertEqual(self.by['line09094']['performer'],'Left Wing Gordon')

    def test_complete_score_chapter_lyrics_and_attribution(self):
        for key in ('line10261','line10301','line10342'):
            self.assertEqual(self.by[key]['disposition'],'eligible')
            self.assertNotIn('[Music:',self.by[key]['text'])
        authored=[r for r in self.rows if r['author'].startswith('Sanctified Mary')]
        self.assertEqual(len(authored),3)
        self.assertTrue(all('claimed' in r['author'] for r in authored))

    def test_dialect_spelling_and_structure_preserved(self):
        row=self.by['line07456']
        self.assertIn('I’m gwine to jine de contraband, chillun,',row['text'])
        self.assertIn('Name on de house, name on de do’,',row['text'])
        self.assertIn('[CHORUS]',row['text'])
        self.assertNotIn('Chorus:',row['text'])
        self.assertFalse(any('[90]' in r['text'] for r in self.rows))
        self.assertFalse(any('The following song' in r['text'] for r in self.rows if r['disposition']=='eligible'))

    def test_reviewed_containment_prioritizes_complete_long_witness(self):
        short=self.by['line01857']; full=self.by['line03773']
        self.assertEqual(short['verse_line_count'],8)
        self.assertEqual(full['verse_line_count'],48)
        self.assertLess(self.rows.index(full),self.rows.index(short))
        self.assertEqual(full['source_line_start'],3773)
        self.assertEqual(short['source_line_start'],1857)
        self.assertEqual(short['disposition'],'eligible')
        self.assertEqual(full['disposition'],'eligible')
        self.assertIn('That ol’ letter,',short['text'])
        self.assertIn('Cap’n, did you hear ’bout',full['text'])
        self.assertFalse(any('distinct_from' in r or 'distinct_reason' in r for r in self.rows))

if __name__=='__main__':unittest.main()
