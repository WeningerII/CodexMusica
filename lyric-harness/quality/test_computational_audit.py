"""Independent oracles and counterexamples for the lyrics computation audit.

Run: python3 lyric-harness/quality/test_computational_audit.py
Small combinatorial results were independently checked with Wolfram Language:
BellB[n], SeriesCoefficient[1/(1-x^2-x^3), {x,0,n}], and the BH rank-two
boundary {p1=p2=0.03, q=0.05}. Tests also enumerate actual assignments rather
than comparing an implementation with a second spelling of its recurrence.
"""
from fractions import Fraction
from itertools import combinations, product
from pathlib import Path
import math
import random
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lyric_harness as LH
from quality import fit as FT, plan as PLN, recover as RC, time_layer as TL
from quality.features import QualityFeatures
from quality.floor import SlopFloor


class CombinatorialOracles(unittest.TestCase):
    def test_bell_numbers_and_completion_counts_against_wolfram(self):
        expected = [1, 1, 2, 5, 15, 52, 203, 877, 4140, 21147,
                    115975, 678570, 4213597]
        self.assertEqual([PLN.bell(n) for n in range(13)], expected)
        self.assertEqual([PLN._rgs_completions(n, 0) for n in range(13)], expected)

    def test_beat_composition_counts_against_generating_function(self):
        expected = [1, 0, 1, 1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16,
                    21, 28, 37, 49, 65, 86, 114]
        self.assertEqual([PLN._n_compositions_23(n) for n in range(21)], expected)
        for n in range(2, 21):
            enumerated = PLN._compositions_23(n)
            self.assertEqual(len(set(enumerated)), expected[n])
            self.assertTrue(all(sum(parts) == n for parts in enumerated))

    def test_section_partition_counts_by_exhaustive_assignments(self):
        for counts in ((1,), (2,), (1, 1), (2, 1), (1, 2, 1), (2, 3)):
            for total in range(1, 13):
                expected = {ks for ks in product(range(1, total + 1), repeat=len(counts))
                            if sum(c * k for c, k in zip(counts, ks)) == total}
                self.assertEqual(PLN._partition_count(counts, total), len(expected))
                got = PLN._partition_uniform(counts, total, random.Random(total))
                self.assertEqual(got is None, not expected)
                if got is not None:
                    self.assertIn(tuple(got), expected)

    def test_prominence_dp_against_every_order_preserving_setting(self):
        compared = 0
        for slots_n in range(6):
            slots = tuple(range(slots_n))
            for n in range(5):
                for prominent in product((False, True), repeat=n):
                    indices = [i for i, yes in enumerate(prominent) if yes]
                    for heads in product((False, True), repeat=slots_n):
                        assignments = combinations(slots, n)
                        best = max((sum(prominent[i] and heads[j] for i, j in enumerate(a))
                                    for a in assignments), default=None)
                        self.assertEqual(FT._max_prominent_on_heads(n, indices, slots,
                                                                   lambda j: heads[j]), best)
                        compared += 1
        self.assertGreater(compared, 1000)

    def test_consonant_alignment_against_all_subsequence_pairings(self):
        sequences = [p for n in range(4) for p in product(('P', 'B', 'T'), repeat=n)]
        for a in sequences:
            for b in sequences:
                if not a and not b:
                    want = 1.0
                elif not a or not b:
                    want = 0.0
                else:
                    best = max(sum(LH.cons_sim(a[i], b[j]) for i, j in zip(ia, ib))
                               for k in range(min(len(a), len(b)) + 1)
                               for ia in combinations(range(len(a)), k)
                               for ib in combinations(range(len(b)), k))
                    want = 2 * best / (len(a) + len(b))
                self.assertAlmostEqual(LH.cluster_sim(a, b), want, places=14)


class StatisticalCounterexamples(unittest.TestCase):
    def test_diagnostic_uses_the_same_occurrences_and_family_boundary(self):
        from quality import time_attainable as TA
        st = TL.syllable_stream(TA.LEX, ['cat', 'bat'])
        declaration = TL.TimeDeclaration()
        self.assertEqual(TA._beat_pairs(st, declaration),
                         TL._candidate_pairs(st, declaration))
        self.assertEqual(TA.m_needed(.05, .05), 1)

    @classmethod
    def setUpClass(cls):
        cls.lex = LH.Lexicon()

    def test_different_lines_do_not_share_word_occurrences(self):
        stream = TL.syllable_stream(self.lex, ['cat', 'bat'])
        decl = TL.TimeDeclaration(max_span=1, null_samples=17)
        self.assertEqual(TL._candidate_pairs(stream, decl), [((0, 1), (1, 2))])
        scores, valid = TL.null_scores(stream, [((0, 1), (1, 2))], LH.Declaration(), decl)
        self.assertEqual(valid, 17)
        self.assertEqual(len(scores), 17)

    def test_disjoint_syllables_in_the_same_word_are_still_excluded(self):
        stream = [{'stress': 1, 'line': 0, 'widx': 0},
                  {'stress': 1, 'line': 0, 'widx': 0}]
        decl = TL.TimeDeclaration(max_span=1, null_samples=3)
        self.assertEqual(TL._candidate_pairs(stream, decl), [])
        self.assertEqual(TL.null_scores(stream, [((0, 1), (1, 2))],
                                      LH.Declaration(), decl), ([], 0))

    def test_bounded_search_matches_an_exhaustive_occurrence_oracle(self):
        rng = random.Random(41)
        for n in (0, 1, 4, 17, 35):
            stream = [{'stress': rng.randrange(3), 'line': i // 7, 'widx': (i % 7) // 2}
                      for i in range(n)]
            for window in (0, 1, 5, 100):
                decl = TL.TimeDeclaration(window=window, max_span=3)
                spans = [(i, i + k) for i in range(n) if stream[i]['stress']
                         for k in (1, 2, 3) if i + k <= n]
                expected = []
                for a, b in spans:
                    for c, d in spans:
                        if not (a < c <= a + window and b <= c):
                            continue
                        left = {(s['line'], s['widx']) for s in stream[a:b]}
                        right = {(s['line'], s['widx']) for s in stream[c:d]}
                        if left.isdisjoint(right):
                            expected.append(((a, b), (c, d)))
                self.assertEqual(TL._candidate_pairs(stream, decl), expected)

    def test_bh_can_discover_a_group_without_singleton_resolution(self):
        pairs = [((0, 1), (1, 2)), ((2, 3), (3, 4))]
        decl = TL.TimeDeclaration(correction='bh', q=.05, null_samples=33)
        detail = {}
        with patch.object(TL, '_candidate_pairs', return_value=pairs), \
             patch.object(TL, 'null_scores', return_value=([], 33)), \
             patch.object(TL, '_raw_score', return_value=1.):
            events = TL.rhyme_events(None, [], LH.Declaration(), decl, detail=detail)
        self.assertEqual(events, {0, 1, 2, 3})
        self.assertNotIn('bh_unresolvable', detail)
        self.assertTrue(detail['attainable'])
        self.assertEqual(detail['q'], .05)
        self.assertIsNone(detail['m_needed'])

    def test_bh_unresolvable_group_remains_an_explicit_refusal(self):
        pairs = [((0, 1), (1, 2)), ((2, 3), (3, 4))]
        detail = {}
        decl = TL.TimeDeclaration(correction='bh', q=.05, null_samples=10)
        with patch.object(TL, '_candidate_pairs', return_value=pairs), \
             patch.object(TL, 'null_scores', return_value=([], 10)), \
             patch.object(TL, '_raw_score', return_value=1.):
            self.assertEqual(TL.rhyme_events(None, [], LH.Declaration(), decl,
                                            detail=detail), set())
        self.assertIn('bh_unresolvable', detail)

    def test_empirical_tail_includes_ties_and_failed_band_draws(self):
        self.assertEqual(TL._pvalue(.5, [.2, .5, .5, .9], 9), .4)
        self.assertEqual(TL._pvalue(1., [], 9), .1)
        self.assertEqual(TL._pvalue(1., [], 0), 1.)

    def test_sidak_equality_and_small_probabilities(self):
        self.assertEqual(TL._m_needed(.05, .05), 1)
        self.assertGreater(TL._m_needed(1e-20, .05), 0)
        self.assertGreater(TL._fwer_cut(1e-20, 1000, 'sidak'), 0)
        self.assertAlmostEqual(TL._fwer_cut(.05, 2, 'sidak'),
                               0.02532056551910361, places=16)
        for correction in ('sidak', 'bonferroni'):
            for size in (1, 2, 91, 101, 193, 1000, 10000):
                p = TL._fwer_cut(.05, size, correction)
                self.assertEqual(TL._m_needed(p, .05, correction), size)

    def test_invalid_time_declarations_refuse_before_calculation(self):
        bad = [{'n_perm': 0}, {'null_samples': 0}, {'periods': ()}, {'periods': (0,)},
               {'grid_unit': 'typo'}, {'correction': 'typo'}, {'family': 'typo'},
               {'alpha': float('nan')}, {'q': 0}, {'window': -1}, {'max_span': True}]
        for kw in bad:
            with self.subTest(kw=kw), self.assertRaises(ValueError):
                TL.TimeDeclaration(**kw)


class RuntimeArithmetic(unittest.TestCase):
    def test_typographic_apostrophes_keep_the_same_words(self):
        for apostrophe in LH.APOSTROPHES:
            self.assertEqual(QualityFeatures._tokens(f"I don{apostrophe}t know"),
                             ["I", "don't", "know"])
        self.assertEqual(QualityFeatures._endword('The word prepar’d'), "prepar'd")

    def test_canonically_equivalent_latin_text_has_identical_tokens(self):
        self.assertEqual(QualityFeatures._tokens('cafe\u0301'),
                         QualityFeatures._tokens('café'))

    def test_subdivision_never_truncates_a_declared_coordinate(self):
        for value in (1.9, Fraction(3, 2), True, False, 0, -1,
                      float('inf'), float('nan'), '1.5'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                FT.Subdivision(value, source='audit')
        for value in (2, 2., '2', Fraction(2)):
            self.assertEqual(FT.Subdivision(value, source='audit').s, 2)

    def test_mattr_optimization_is_bit_identical_to_all_window_sets(self):
        rng = random.Random(83)
        for n in (1, 2, 19, 49, 50, 51, 100, 447, 3245):
            words = [rng.randrange(31) for _ in range(n)]
            for w in (1, 2, 7, 50, 150, 4000):
                expected = (len(set(words)) / n if n <= w else
                            sum(len(set(words[i:i+w])) / w for i in range(n-w+1)) / (n-w+1))
                self.assertEqual(QualityFeatures._mattr(words, w), expected)
        self.assertTrue(math.isnan(QualityFeatures._mattr([])))

    def test_invalid_mattr_windows_are_refused(self):
        for value in (0, -1, True, 2.5, '2'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                QualityFeatures._mattr(['cat', 'bat'], value)

    def test_anaphora_keeps_first_occurrence_ties(self):
        for lines in ([], ['Beta fox', 'Alpha bat', 'Alpha dog', 'Beta cat'],
                      ['One cat'] * 100 + ['Two cats'] * 100 + ['Two cats']):
            firsts = [(s.split() or [''])[0].lower().strip(',.;:!?—-') for s in lines]
            top = max(dict.fromkeys(firsts), key=firsts.count) if firsts else ''
            expected = (firsts.count(top) / len(firsts), top) if firsts else (0., '')
            self.assertEqual(SlopFloor._anaphora(None, lines), expected)

    def test_empty_chain_input_has_no_invented_first_line(self):
        self.assertEqual(LH.infer_chains(None, [], LH.Declaration()), [])


class CalibrationHandoffs(unittest.TestCase):
    def test_stanza_thresholds_and_ranges_rederive_after_token_normalization(self):
        from quality.corpus import load_sonnets
        from quality.floor import PROFILES
        from quality import song_profile_calibration as C
        qf = QualityFeatures(features={'mattr', 'function_word_ratio'})
        sonnets = list(load_sonnets().values())
        for name, poems in (('sonnet', sonnets),
                            ('section', [s[k:k+4] for s in sonnets for k in (0, 4, 8)])):
            profile = next(p for p in PROFILES if p.name == name)
            rows = []
            counts = []
            for lines in poems:
                features = qf.extract(lines)
                rows.append({'mattr_min': features['mattr'],
                             'function_word_ratio_max': features['function_word_ratio'],
                             'anaphora_max': SlopFloor._anaphora(None, lines)[0],
                             'line_length_cv_min': C.line_cv(lines)})
                counts.append(sum(len(qf._tokens(line)) for line in lines))
            self.assertEqual(profile.n_human, len(rows))
            self.assertEqual((profile.lo, profile.hi),
                             (int(C.q(counts, .05)), int(C.q(counts, .95))))
            for key in rows[0]:
                tail = .05 if key.endswith('_min') else .95
                self.assertEqual(profile.percentiles[key], C.q([r[key] for r in rows], tail))


class RecoveryHandoffs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lex = LH.Lexicon()

    def test_unreadable_words_are_not_reported_as_exact_zero_syllables(self):
        r = RC.recover(['cat zzzqx', 'bat'], lex=self.lex, placements=('end',))
        self.assertEqual(r['syllables_per_line'], [1, 1])
        self.assertEqual(r.how['syllables_per_line'][0], 'REFUSED')
        self.assertIn('LOWER BOUNDS', RC.render(r))
        self.assertEqual(r['syllable_readability'][0]['unreadable'], ['zzzqx'])
        known = RC.recover(['cat', 'bat'], lex=self.lex, placements=('end',))
        self.assertEqual(known.how['syllables_per_line'][0], 'counted')

    def test_recovery_uses_the_same_normalized_sung_rows_as_grading(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'eng_american_henry_wadsworth_longfellow.txt'
            path.write_text('[Verse]\nThe cat meets Ph[oe]bus\n[Footnote: an editorial note\n'
                            'these words are not sung]\nThe bat flies home\n', encoding='utf-8')
            expected = LH.load_lyric_lines(str(path))
            self.assertEqual(expected, ['The cat meets Phoebus', 'The bat flies home'])
            r = RC.recover_file(str(path), lex=self.lex, placements=('end',))
        self.assertEqual(r['total_lines'], len(expected))
        self.assertEqual(r['sections'][0]['lines'], len(expected))
        self.assertEqual(r['sections'][0]['raw_lines'], [2, 5])
        self.assertEqual(r['syllables_per_line'],
                         [len(LH.word_syllable_map(self.lex, line)) for line in expected])


if __name__ == '__main__':
    unittest.main(verbosity=2)
