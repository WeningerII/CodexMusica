#!/usr/bin/env python3
"""E-5 fragments retain the full experiment and every failure gate.

Run: python3 quality/test_e5_coda_adoption.py
"""
import contextlib
import copy
import io
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from quality import e5_coda_adoption as E


class Fragments(unittest.TestCase):
    @contextlib.contextmanager
    def experiment(self, defect=None):
        """Small, observable observations with the production assertions intact."""
        pair = ({'RHYME': 1.0}, 1.0, 'certain', ('perfect rhyme',))
        old = [{'idx': 1, 'lines': ['cat', 'hat'], 'mandated': [(1, 2)],
                'refused': set(), 'pairs': {(1, 2): pair}, 'base_violations': set()}]
        new = copy.deepcopy(old)
        if defect == 'admission':
            new[0]['pairs'][(1, 2)] = ({}, 0.0, 'certain', ())
        if defect == 'empty':
            old[0]['pairs'][(1, 2)] = ({}, 0.0, 'certain', ())
        if defect == 'refusal':
            new[0]['refused'].add((1, 2))
        if defect == 'violations':
            new[0]['base_violations'].add((1, 2))
        real_decl = E.L.Declaration

        def declaration(**kwargs):
            if defect == 'default' and not kwargs:
                kwargs['coda_empty_evidence'] = 'gift'
            return real_decl(**kwargs)

        def canon(_lex, decl):
            return copy.deepcopy(old if decl.coda_empty_evidence == 'gift' else new)

        measured = []

        def measure(sampler, _lex, decl):
            measured.append((sampler.label(), decl.coda_empty_evidence))
            row = dict(judged=100, any=50, admit=40, rhyme=30, schema=20)
            if defect == 'random' and decl.coda_empty_evidence == 'cannot_tell':
                row['admit'] += 1
            return row

        def score(_left, _right, decl):
            if defect == 'fixed' and decl.coda_empty_evidence == 'cannot_tell':
                return {'relations': {'CONSONANCE'}}
            return {'relations': {'RHYME'}}

        def best(_a, _b, decl, w1, _w2):
            old_arm = decl.coda_empty_evidence == 'gift'
            if w1 == 'now':
                return {'total': 0.5 if old_arm or defect == 'gift' else 0.4,
                        'relations': set()}
            return {'total': 0.9 if defect == 'control' and not old_arm else 1.0,
                    'relations': {'RHYME'}}

        with contextlib.ExitStack() as stack:
            for target, value in (
                ('canon_records', canon), ('CR.measure', measure),
                ('L.Lexicon', lambda: object()), ('L.Declaration', declaration),
                ('L.line_anchors', lambda *a, **kw: ([object()], '', [])),
                ('L.score', score), ('L.best_score', best),
                ('L.admits_decl', lambda row, decl: bool(row['relation_totals']))):
                parts = target.split('.')
                owner = E
                for p in parts[:-1]:
                    owner = getattr(owner, p)
                stack.enter_context(mock.patch.object(owner, parts[-1], value))
            yield measured

    def test_fragment_union_is_the_complete_experiment(self):
        with self.experiment() as measured:
            full = E.evaluate()
            full_calls = measured[:]
            measured.clear()
            canon = E.evaluate('canon')
            parts = [E.evaluate(f'random-{k}/4') for k in range(1, 5)]
            self.assertCountEqual(measured, full_calls)
            self.assertEqual(len(measured), 2 * len(E.CR.GRID))
        joined = {k: v for k, v in canon.items() if k not in ('part', 'samplers')}
        joined['random'] = [row for part in parts for row in part['random']]
        joined['failures'] += [failure for part in parts for failure in part['failures']]
        self.assertEqual(joined, full)
        self.assertEqual(full['failures'], [])
        self.assertEqual(full['fixed_candidates'], 1)
        self.assertEqual(set(full['controls']), {'now/why', 'see/free', 'cat/hat'})
        self.assertEqual(full['max_loss_rate'], 0.005)

    def test_every_supported_random_deal_is_exactly_once(self):
        for n in range(1, len(E.CR.GRID) + 1):
            with self.subTest(n=n):
                seen = [sampler for k in range(1, n + 1)
                        for sampler in E.selected_samplers(f'random-{k}/{n}')]
                self.assertCountEqual(seen, E.CR.GRID)
                self.assertEqual(len(seen), len(E.CR.GRID))

    def test_each_original_canon_guard_still_fails(self):
        failures = {
            'admission': 'scalar admission loss exceeds 0.5%',
            'empty': 'scalar admission loss exceeds 0.5%',
            'default': 'default has not adopted cannot_tell',
            'refusal': 'refusal drift: sonnet 1',
            'fixed': 'fixed-span relation drift: sonnet 1 (1, 2)',
            'violations': 'violations increased',
            'control': 'control failed: see/free',
            'gift': 'empty-coda gift remains',
        }
        for defect, failure in failures.items():
            with self.subTest(defect=defect), self.experiment(defect):
                self.assertIn(failure, E.evaluate('canon')['failures'])
                self.assertIn(failure, E.evaluate()['failures'])

    def test_random_failure_still_gates_each_selected_cell(self):
        with self.experiment('random'):
            full = E.evaluate()
            fragments = [E.evaluate(f'random-{k}/4') for k in range(1, 5)]
            self.assertEqual(len(full['failures']), len(E.CR.GRID))
            self.assertEqual([f for part in fragments for f in part['failures']],
                             full['failures'])
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(E.main(['--part=random-1/4']), 1)

    def test_invalid_coordinate_refuses_before_the_experiment_runs(self):
        for bad in ('random-0/4', 'random-5/4', 'random-1/0', 'random-1/5',
                    'random-1', 'canon/1', '', 'all'):
            with self.subTest(bad=bad), mock.patch.object(E, 'canon_report') as canon:
                with contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(E.main([f'--part={bad}']), 2)
                canon.assert_not_called()


if __name__ == '__main__':
    unittest.main()
