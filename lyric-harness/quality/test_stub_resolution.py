#!/usr/bin/env python3
"""MISSING.md A-1: full-block reference resolution on production paths."""
import sys
import tempfile
import unittest
from pathlib import Path
from fractions import Fraction

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lyric_harness as LH
from quality import grid as G
from quality import mark_coverage


class StubResolutionTest(unittest.TestCase):
    chorus = ['Oh my poor Nelly Gray, they have taken you away',
              'And I will never see my darling any more']
    stub = ['Oh, my poor Nelly Gray, &c.']

    def compare(self, first, again, blocks):
        return G.compare_returns(first, again, reference_blocks=blocks,
                                 rhyme_key=lambda w: w[-2:], language='eng')

    def test_before_after_and_both_sides(self):
        for blocks in ([self.chorus, self.stub], [self.stub, self.chorus]):
            for first, again in ((self.chorus, self.stub),
                                 (self.stub, self.chorus), (self.stub, self.stub)):
                r = self.compare(first, again, blocks)
                self.assertEqual(r.kind, 'VERBATIM')
                self.assertEqual(r.line_distance, 0)
                self.assertEqual(r.invariant_lines, (1, 2))
                self.assertTrue(r.stub_resolutions)
                self.assertEqual(r.stub_resolutions[0][3], tuple(self.chorus))
                self.assertIn('resolved before comparison', r.describe())
                self.assertIsNone(r.tune_slot_preserved)

    def test_repeated_printings_and_different_endings(self):
        self.assertEqual(self.compare(self.stub, self.chorus,
                                      [self.chorus, self.chorus]).kind, 'VERBATIM')
        changed = [self.chorus[0], 'A different ending on the shore']
        r = self.compare(self.stub, self.chorus, [self.chorus, changed])
        self.assertEqual(r.kind, 'STUB')
        self.assertIsNone(r.line_distance)

    def test_no_guessing_or_chaining(self):
        for stub, blocks in ((['&c.'], [self.chorus]),
                             (['No such opening, &c.'], [self.chorus]),
                             (self.stub, [self.stub]),
                             (self.stub, [[self.chorus[0], '&c.']]),
                             (self.stub, [])):
            self.assertEqual(self.compare(stub, self.chorus, blocks).kind, 'STUB')
        # All printed words are evidence: never fall back to a shorter prefix.
        self.assertEqual(self.compare(['Oh my poor Nelly Gray not this, &c.'],
                                      self.chorus, [self.chorus]).kind, 'STUB')

    def test_embedded_pointer_and_partial_failure(self):
        r = self.compare(['Opening line'] + self.stub,
                         ['Opening line'] + self.chorus, [self.chorus])
        self.assertEqual(r.kind, 'VERBATIM')
        r = self.compare(self.stub + ['Not found, &c.'], self.chorus, [self.chorus])
        self.assertEqual(r.kind, 'STUB')
        self.assertEqual(len(r.stub_resolutions), 1)

    def test_shared_detector_and_language(self):
        for line, lang, prefix in [('Oh Gray, &c. [41]', 'eng', 'Oh Gray,'),
                                   ('Rhowch, &c.', 'cym', 'Rhowch,'),
                                   ('Aita mulle j. n. e. [41]', 'fin', 'Aita mulle'),
                                   ('dan lain d. s. b.', 'msa', 'dan lain')]:
            self.assertTrue(LH.is_chorus_stub(line, lang))
            self.assertEqual(LH.chorus_stub_incipit(line, lang), prefix)
        self.assertIsNone(LH.chorus_stub_incipit('Aita mulle j. n. e.', 'eng'))

    def test_production_corpus_later_chorus_and_song_boundary(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'eng_test.txt'
            p.write_text('--- TITLE: first\n[CHORUS]\n' + self.stub[0] +
                         '\n--- author attribution\n[CHORUS]\n' +
                         '\n'.join(self.chorus) +
                         '\n--- TITLE: second\n[CHORUS]\n' + self.stub[0] +
                         '\n[CHORUS]\n' + self.stub[0] + '\n')
            before = p.read_bytes()
            songs = G.read_marked_songs(p, language='eng')
            resolved = G.resolve_marked_references(songs[0])
            self.assertEqual(resolved['resolved'], {0: (1, 3)})
            self.assertEqual(resolved['expanded_lines'], self.chorus * 2)
            self.assertEqual(G.resolve_marked_references(songs[1])['found'], 0)
            report = mark_coverage.scan(tmp)
            self.assertEqual(report['marks']['CHORUS']['ladder'],
                             {'VERBATIM': 1, 'STUB': 1})
            self.assertEqual(p.read_bytes(), before)
            remaining = report['unresolved_references']
            self.assertEqual(len(remaining), 2)
            self.assertTrue(all(row['title'] == 'second' for row in remaining))
            self.assertTrue(all(row['printed'] == self.stub[0] for row in remaining))

    def test_italic_pointer_is_not_a_complete_target(self):
        for text in ('The Muses now, _&c._', '_The Muses now, &c._',
                     '_The Muses now_, &c.', 'The Muses now, _&c._ [41]'):
            self.assertTrue(LH.is_chorus_stub(text, 'eng'))
            self.assertEqual(LH.chorus_stub_incipit(text, 'eng'), 'The Muses now,')
            self.assertEqual(LH.chorus_stub_languages(text), ('eng', 'cym'))
            self.assertFalse(LH.is_chorus_stub(text, 'fin'))
        full = ['With a Fa la la la la']
        incomplete = full + ['The Muses now, _&c._']
        self.assertEqual(self.compare(['With a Fa la, &c.'], full,
                                      [incomplete, full]).kind, 'VERBATIM')
        self.assertEqual(self.compare(['With a Fa la, &c.'], full,
                                      [incomplete]).kind, 'STUB')
        self.assertFalse(LH.is_chorus_stub('_Sing_ the song', 'eng'))

    def test_burns_printed_labels_resolve_without_singing_the_label(self):
        path = Path(__file__).resolve().parents[1] / 'corpus/song/eng_celtic_robert_burns.txt'
        original = path.read_bytes()
        songs = G.read_marked_songs(str(path))
        self.assertEqual(path.read_bytes(), original)
        for title in ('Song--O Tibbie, I Hae Seen The Day',
                      'Song--Bonie Peggy Alison', 'Song--For A\' That',
                      'O Can Ye Labour Lea?'):
            song = next(s for s in songs if s.title == title)
            report = G.resolve_marked_references(song)
            self.assertGreater(report['stubs'], 0)
            self.assertEqual(report['stubs'], report['found'], title)
            self.assertFalse(any(line.startswith(('Chorus', 'Choir.', 'Chor.'))
                                 for line in report['expanded_lines']))

    def test_printed_label_scope_and_source_coordinates(self):
        raw = ['--- TITLE: example', '[VERSE 1]', 'Chor.--Sing with me',
               'Home again', '[REFRAIN]', 'Sing, &c.']
        with tempfile.TemporaryDirectory() as tmp:
            for filename, found in [('eng_celtic_robert_burns.txt', 1),
                                    ('eng_other.txt', 0)]:
                path = Path(tmp) / filename
                path.write_text('\n'.join(raw) + '\n')
                before = path.read_bytes()
                song = G.read_marked_songs(str(path))[0]
                self.assertEqual(G.resolve_marked_references(song)['found'], found)
                self.assertEqual(song.blocks[0].source_line, 2)
                self.assertEqual(song.blocks[1].source_line, 5)
                self.assertEqual(path.read_bytes(), before)
            # A literal label inside a stanza is not a new section.
            raw.insert(2, 'Opening lyric')
            edits, drops = G._printed_chorus_labels(raw, 'eng_celtic_robert_burns.txt')
            self.assertEqual((edits, drops), ({}, set()))

    def test_production_grid_later_chorus(self):
        song = G.Song(sections=[G.Section('c1', 8, G.Meter(4, 4), function='chorus'),
                                G.Section('c2', 8, G.Meter(4, 4), function='chorus')]).layout()
        song.lines = [G.Line(self.stub[0], bar=1, duration=Fraction(4)),
                      G.Line(self.chorus[0], bar=9, duration=Fraction(4)),
                      G.Line(self.chorus[1], bar=11, duration=Fraction(4))]
        findings, refusals, returns = G.return_findings(song, 'chorus')
        self.assertNotIn('RETURN_SLOT_DRIFT', [f.code for f in findings])
        self.assertIn('RETURN_SLOTS_UNRESOLVED', [r.code for r in refusals])
        self.assertEqual(returns[0][2].kind, 'VERBATIM')
        self.assertEqual(returns[0][2].invariant_lines, (1, 2))


if __name__ == '__main__':
    unittest.main()
