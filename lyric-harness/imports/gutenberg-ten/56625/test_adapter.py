"""Regression checks for multi-part songs and repeated musical settings."""
import json
import unittest
from pathlib import Path

ROWS = json.loads(Path(__file__).with_name('candidates.json').read_text())


class SourceBoundaryTests(unittest.TestCase):
    def test_numbered_works_complete(self):
        self.assertEqual([int(row['id']) for row in ROWS], list(range(1, 122)))
        self.assertEqual(len(ROWS[49]['source_sections']), 2)
        self.assertIn('without division', ROWS[49]['source_note'])
        self.assertTrue(ROWS[-1]['text'].endswith('God receive my soul for ever.'))

    def test_repeated_setting_is_not_appended(self):
        flora = ROWS[57]
        self.assertEqual(len(flora['text'].split('\n\n')), 4)
        self.assertEqual(len(flora['alternate_musical_setting']['text'].split('\n\n')), 4)
        self.assertNotEqual(flora['text'], flora['alternate_musical_setting']['text'])

    def test_printed_section_labels_are_not_sung(self):
        self.assertEqual(sum(len(row.get('source_section_labels', [])) for row in ROWS), 27)
        self.assertEqual(ROWS[81]['sections'][1]['type'], 'refrain')
        self.assertIn('From hasty words he did refrain,', ROWS[84]['text'])
        for row in ROWS:
            self.assertFalse(any(line.startswith(('CHORUS:', 'CHORUS.')) or line == 'Refrain'
                                 for line in row['text'].splitlines()))
            if 'sections' in row:
                self.assertEqual(row['text'], '\n\n'.join('\n'.join(s['lines']) for s in row['sections']))

    def test_optional_stanzas_keep_all_sung_words(self):
        paul_jones = ROWS[107]['text']
        self.assertEqual(len(paul_jones.split('\n\n')), 7)
        self.assertIn("'Bout twelve was the hour when we came alongside,", paul_jones)
        self.assertIn('Our carpenter frightened, to Paul Jones he came,', paul_jones)
        self.assertNotIn('[', paul_jones)
        self.assertNotIn(']', paul_jones)

    def test_editorial_verse_quote_not_song(self):
        self.assertNotIn('I shall not rue the very hour', ROWS[24]['text'])
        self.assertFalse(any('Project Gutenberg' in row['text'] for row in ROWS))
        self.assertFalse(any('[Listen]' in row['text'] for row in ROWS))


if __name__ == '__main__':
    unittest.main()
