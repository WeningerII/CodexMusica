#!/usr/bin/env python3
"""#676 P2 observations on main 10b42689, not future P2 acceptance.

Run with the repository runtime requirements and pinned CMU dictionary staged:
    python3 -B lyric-harness/quality/test_p2_return_characterization.py

The real grader and inspect return-reporting branch run. The unrelated slop
floor is explicitly omitted by a test double: these tests DO NOT establish
which full-floor lexical flags survive. That missing acceptance is a skip,
not a passing fake floor. The two persistence paths live in the companion JS
fixture; neither suite claims browser/UI or typed contained-role acceptance.

Separate full-floor observations: #666 comment 6640294428, BB8 on e3525a4e,
Python 3.13.16 / nltk 3.10.3 with verified assets. This is not the environment
of this suite's original Python 3.12.14 / nltk 3.10.4 execution, nor CI
equivalence. That receipt does not remove this suite's floor skip.
"""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lyric_harness import Lexicon
from quality import schemes as S
from quality.grid import normalise_line
from quality.loop import apply_candidate
from quality.revise import Reviser, ReviseDeclaration, _floor_pair_groups

LINES = ['I hold the light', 'We face the night',
         'I hold the light', 'You face the night']


class OmittedFloor:
    """An explicit boundary double, never evidence about SlopFloor.check."""
    qf = SimpleNamespace()

    def check(self, *_args):
        return []


class ReturnCharacterization(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lex = Lexicon()  # verifies the pinned dictionary; no download

    def reviser(self, licence='unlicensed'):
        return Reviser(lex=self.lex,
                       rdecl=ReviseDeclaration(repeat_licence=licence),
                       floor=OmittedFloor())

    def test_identity_is_normalized_not_byte_exact(self):
        m = S.mandate('ABAB', n_lines=4, returns=[[1, 3]])
        original = 'I am singing tonight'
        for changed in ['I AM SINGING TONIGHT', 'I am singing, tonight!',
                        '  I am\t singing  tonight ', '_I am singing tonight_']:
            with self.subTest(changed=changed):
                self.assertNotEqual(original, changed)
                self.assertEqual(normalise_line(original), normalise_line(changed))
                self.assertEqual(m.returns_check([original, 'x', changed, 'y']), [])
        for changed in ["I am singin' tonight", 'I am singing to-night',
                        'I was singing tonight']:
            with self.subTest(changed=changed):
                self.assertNotEqual(normalise_line(original), normalise_line(changed))
                self.assertEqual([f[3] for f in m.returns_check(
                    [original, 'x', changed, 'y'], variation=False)], ['NOT_VERBATIM'])

    def test_normalized_apostrophes_and_unicode_do_not_erase_word_changes(self):
        self.assertEqual(normalise_line('I’m at the café'),
                         normalise_line("I'm at the cafe\u0301"))
        self.assertNotEqual(normalise_line("I'm at the cafe"),
                            normalise_line('I am at the cafe'))

    def test_real_grade_repeat_licence_matrix(self):
        # Observed behavior, including the surprising plain-scheme control:
        # the broad relation vocabulary satisfies those repeats even when
        # the song-wide licence is 'unlicensed'. Do not invent two failures.
        for licence in ['unlicensed', 'refrain']:
            for returns, expected in [(None, []), ([[1, 3]], [(2, 4)])]:
                with self.subTest(licence=licence, returns=returns):
                    m = S.mandate('ABAB', n_lines=4, returns=returns)
                    report = self.reviser(licence).grade(LINES, m)
                    self.assertEqual([v['lines'] for v in report['violations']], expected)
                    self.assertEqual([v['lines'] for v in report['repeats']], [(1, 3), (2, 4)])
                    self.assertEqual((report['pairs_mandated'], report['pairs_judged'],
                                      report['pairs_refused']), (2, 2, 0))
                    if returns:
                        self.assertEqual(report['violations'][0]['why'],
                                         'REPEAT not rhyme (identical word)')

    def test_occurrence_pairs_are_not_collapsed_to_one_return_class(self):
        m = S.mandate([[1, 2], [3, 4]], n_lines=4, returns=[[1, 3], [2, 4]])
        self.assertEqual(m.pairs(), [(1, 2, 0), (3, 4, 1)])
        self.assertEqual(set(_floor_pair_groups(m)), {(1, 2), (3, 4)})
        report = self.reviser().grade(LINES, m)
        self.assertEqual(report['pairs_mandated'], 2)
        self.assertEqual(report['pairs_judged'] + report['pairs_refused'], 2)

    def test_real_inspect_return_codes_with_floor_explicitly_omitted(self):
        # Assert only the real return/rhyme reporting branch. In particular,
        # never consume this adapter run's floor coverage as a floor receipt.
        wanted = {'REFRAIN_REPEAT', 'SCHEME_VIOLATION', 'RETURN_NOT_VERBATIM'}
        for licence in ['unlicensed', 'refrain']:
            for returns in [None, [[1, 3]]]:
                for edited in [False, True]:
                    with self.subTest(licence=licence, returns=returns, edited=edited):
                        lines = list(LINES)
                        if edited:
                            lines[0] = 'I guard the light'
                        m = S.mandate('ABAB', n_lines=4, returns=returns)
                        result = self.reviser(licence).inspect(lines, m)
                        # One Finding object can occur in several line buckets.
                        # Deduplicate object identities, not distinct engine
                        # findings that happen to share code/location fields.
                        placed = result['whole'] + [
                            f for bucket in result['per_line'].values() for f in bucket]
                        findings = list({id(f): f for f in placed}.values())
                        actual = {(f.code, f.severity, tuple(f.locations))
                                  for f in findings if f.code in wanted}
                        if returns:
                            expected = {('REFRAIN_REPEAT', 'note', (1, 3)),
                                        ('SCHEME_VIOLATION', 'flag', (2, 4))}
                            if edited:
                                expected.add(('RETURN_NOT_VERBATIM', 'flag', (1, 3)))
                        elif licence == 'refrain':
                            expected = {('REFRAIN_REPEAT', 'note', (1, 3)),
                                        ('REFRAIN_REPEAT', 'note', (2, 4))}
                        else:
                            expected = set()
                        self.assertEqual(actual, expected)
                        obligations = [o for o in result['coverage']['obligations']
                                       if o['id'].startswith('return:')]
                        self.assertEqual(obligations, [
                            {'id': 'return:1:3', 'layer': 'return', 'status': 'answered'}
                        ] if returns else [])
                        self.assertNotIn('return:1:3', result['coverage']['refused_obligations'])
                        # An answered comparison can FAIL. Certification is a
                        # coverage property, never proof of absence of flags.
                        # Do not pin overall certification from OmittedFloor:
                        # the local sentencehood resource is also unavailable.
                        if returns and edited:
                            failures = [f for f in findings if f.code == 'RETURN_NOT_VERBATIM']
                            self.assertEqual(len(failures), 1)
                            self.assertEqual(failures[0].severity, 'flag')
                            self.assertEqual(failures[0].locations, [1, 3])
                        self.assertEqual(lines[2], LINES[2], 'inspection must not re-sync text')

    def test_floor_projection_excludes_return_pairs_but_keeps_other_occurrences(self):
        m = S.mandate('AAAA', n_lines=4, returns=[[1, 3]])
        self.assertEqual(len(m.pairs()), 6)
        self.assertEqual(set(_floor_pair_groups(m)),
                         {(1, 2), (1, 4), (2, 3), (2, 4), (3, 4)})
        fl, pseudo = self.reviser()._floor_for(m)
        self.assertEqual(pseudo, '????')
        self.assertEqual(fl._pairs(LINES, pseudo), [(0, 1), (0, 3), (1, 2), (1, 3), (2, 3)])
        self.assertEqual(fl.qf.pairs_from_scheme(pseudo), fl._pairs(LINES, pseudo))
        self.assertEqual(fl.declared_lexical_classes, ((1, 3),))

    def test_internal_pair_occurrences_have_their_own_non_floor_denominator(self):
        m = S.mandate([['1.head', '2.head'], ['3.head', '4.head']],
                      n_lines=4, returns=[[1, 3], [2, 4]])
        self.assertEqual(m.pairs(), [(1, 2, 0), (3, 4, 1)])
        self.assertEqual(_floor_pair_groups(m), {})
        report = self.reviser().grade(LINES, m)
        self.assertEqual(report['pairs_mandated'], 2)
        self.assertEqual(report['pairs_judged'] + report['pairs_refused'], 2)

    def test_manual_edit_is_not_the_mirrored_candidate_operation(self):
        m = S.mandate('ABAB', n_lines=4, returns=[[1, 3]])
        edited = list(LINES)
        edited[0] = 'I guard the light'
        self.assertEqual([f[3] for f in m.returns_check(edited, variation=False)],
                         ['NOT_VERBATIM'])
        self.assertEqual(edited[2], 'I hold the light')
        mirrored, targets = apply_candidate(self.reviser(), LINES, m, 1, edited[0])
        self.assertEqual(targets, {1, 3})
        self.assertEqual(mirrored, [edited[0], LINES[1], edited[0], LINES[3]])
        self.assertEqual(m.returns_check(mirrored), [])
        self.assertEqual(LINES[0], 'I hold the light', 'candidate application is not in-place')

    def test_rhyme_only_return_does_not_require_or_mirror_text(self):
        m = S.mandate('ABAB', n_lines=4,
                      returns=[S.Return((1, 3), verbatim=False)])
        edited, targets = apply_candidate(self.reviser(), LINES, m, 1, 'I guard the light')
        self.assertEqual(targets, {1})
        self.assertEqual(edited[2], LINES[2])
        self.assertEqual(m.returns_check(edited), [])
        self.assertNotIn((1, 3), _floor_pair_groups(m))
        fl, _ = self.reviser()._floor_for(m)
        self.assertEqual(fl.declared_lexical_classes, ())

    @unittest.skip('Gap: full SlopFloor lexical flags need the pinned tagger; no floor pass claimed')
    def test_full_floor_repeat_licence_and_return_flags(self):
        pass


if __name__ == '__main__':
    unittest.main(verbosity=2)
