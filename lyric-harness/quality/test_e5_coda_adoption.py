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
from dataclasses import asdict
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

    def test_parallel_mode_keeps_every_original_report_and_failure(self):
        defects = (None, 'admission', 'empty', 'default', 'refusal', 'fixed',
                   'violations', 'control', 'gift', 'random')
        for defect in defects:
            for part in ('canon', 'all'):
                with self.subTest(defect=defect, part=part), self.experiment(defect):
                    def records(lex, old, new):
                        return E.canon_records(lex, old), E.canon_records(lex, new)
                    with mock.patch.dict(os.environ, TEST_E5_CANON_WORKERS='1'):
                        serial = E.evaluate(part)
                    with mock.patch.dict(os.environ, TEST_E5_CANON_WORKERS='2'), \
                            mock.patch.object(E, '_parallel_canon_records', side_effect=records):
                        parallel = E.evaluate(part)
                    self.assertEqual(parallel, serial)

    def test_public_canon_report_retains_arbitrary_passed_lexicon(self):
        with self.experiment(), mock.patch.dict(os.environ, TEST_E5_CANON_WORKERS='2'), \
                mock.patch.object(E, '_parallel_canon_records') as parallel:
            lex = object()
            old = E.L.Declaration(coda_empty_evidence='gift')
            new = E.L.Declaration(coda_empty_evidence='cannot_tell')
            with mock.patch.object(E, 'canon_records', wraps=E.canon_records) as records:
                report = E.canon_report(lex, old, new)
            self.assertEqual(records.call_args_list, [mock.call(lex, old), mock.call(lex, new)])
            self.assertEqual(report['failures'], [])
            parallel.assert_not_called()

    def test_worker_constructs_fresh_lexicon_and_full_declaration(self):
        decl = E.L.Declaration(coda_empty_evidence='gift', theta_rhyme=0.89,
                               admit=('RHYME',), theta_by_relation={'CONSONANCE': 0.72})
        lex, result = object(), object()
        original_scheme = E.L.resolve_reader_scheme(None)

        def construct(**kwargs):
            self.assertEqual(E.L.resolve_reader_scheme(None), 'v1')
            return lex

        def observe(*args):
            self.assertEqual(E.L.resolve_reader_scheme(None), 'v1')
            return result

        with mock.patch.object(E.L, 'Lexicon', side_effect=construct) as constructor, \
                mock.patch.object(E, 'canon_records', side_effect=observe) as records:
            self.assertIs(E._canon_record_worker((asdict(decl), 'v1')), result)
        constructor.assert_called_once_with(reader_scheme='v1')
        self.assertIs(records.call_args.args[0], lex)
        self.assertEqual(records.call_args.args[1], decl)
        self.assertEqual(E.L.resolve_reader_scheme(None), original_scheme)
        with mock.patch.object(E.L, 'Lexicon', side_effect=construct), \
                mock.patch.object(E, 'canon_records', side_effect=RuntimeError('records failed')):
            with self.assertRaisesRegex(RuntimeError, 'records failed'):
                E._canon_record_worker((asdict(decl), 'v1'))
        self.assertEqual(E.L.resolve_reader_scheme(None), original_scheme)

    def _complete_records(self):
        population = [['cat'] * len(E._CANON_SCHEME), ['hat'] * len(E._CANON_SCHEME)]
        records = []
        for idx, lines in enumerate(population, 1):
            mandated = [(i + 1, j + 1) for i in range(len(lines))
                        for j in range(i + 1, len(lines))
                        if E.L.same_scheme_class(E._CANON_SCHEME[i], E._CANON_SCHEME[j])]
            records.append({'idx': idx, 'lines': lines[:], 'mandated': mandated,
                            'bearing': set(range(len(lines))),
                            'refused': set(), 'base_violations': set(),
                            'pairs': {pair: ({'RHYME': 1.0}, 1.0, 'certain', ('perfect rhyme',))
                                      for pair in mandated}})
        return population, records

    def test_parallel_collection_uses_spawn_full_settings_and_policy_order(self):
        import battery
        population, records = self._complete_records()
        old = E.L.Declaration(coda_empty_evidence='gift', theta_rhyme=0.83)
        new = E.L.Declaration(coda_empty_evidence='cannot_tell', theta_rhyme=0.91)
        lex = mock.Mock(reader_scheme='v1')
        pool = mock.MagicMock()
        pool.submit.side_effect = [mock.Mock(result=mock.Mock(return_value=copy.deepcopy(records)))
                                   for _ in range(2)]
        with mock.patch('concurrent.futures.ProcessPoolExecutor') as executor, \
                mock.patch.object(battery, 'parse_sonnets', return_value=population):
            executor.return_value.__enter__.return_value = pool
            a, b = E._parallel_canon_records(lex, old, new)
        self.assertEqual((a, b), (records, records))
        self.assertEqual(executor.call_args.kwargs['max_workers'], 2)
        self.assertEqual(executor.call_args.kwargs['mp_context'].get_start_method(), 'spawn')
        self.assertEqual(pool.submit.call_args_list, [
            mock.call(E._canon_record_worker, (asdict(old), 'v1')),
            mock.call(E._canon_record_worker, (asdict(new), 'v1'))])

    def test_corrupt_or_incomplete_worker_inventory_is_refused(self):
        population, records = self._complete_records()
        E._validate_canon_records(records, population)
        corruptions = []
        corruptions.append(records[:-1])
        corruptions.append(list(reversed(copy.deepcopy(records))))
        for kind in ('idx', 'bool', 'line', 'mandated', 'pair', 'bearing',
                     'one-based-bearing', 'field'):
            changed = copy.deepcopy(records)
            if kind == 'idx':
                changed[1]['idx'] = 1
            elif kind == 'bool':
                changed[0]['idx'] = True
            elif kind == 'line':
                changed[0]['lines'][0] = 'unread corpus replacement'
            elif kind == 'mandated':
                changed[0]['mandated'].pop()
            elif kind == 'pair':
                changed[0]['pairs'].pop(next(iter(changed[0]['pairs'])))
            elif kind == 'bearing':
                changed[0]['bearing'].clear()
            elif kind == 'one-based-bearing':
                changed[0]['bearing'] = {i + 1 for i in changed[0]['bearing']}
            else:
                changed[0]['extra'] = 'unexpected'
            corruptions.append(changed)
        for changed in corruptions:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                E._validate_canon_records(changed, population)
        with self.assertRaises(ValueError):
            E._validate_canon_records([], [])

    def test_worker_failure_propagates_after_both_policies_are_submitted(self):
        import battery
        population, records = self._complete_records()
        pool = mock.MagicMock()
        pool.submit.side_effect = [mock.Mock(result=mock.Mock(side_effect=RuntimeError('worker failed'))),
                                   mock.Mock(result=mock.Mock(return_value=records))]
        with mock.patch('concurrent.futures.ProcessPoolExecutor') as executor, \
                mock.patch.object(battery, 'parse_sonnets', return_value=population):
            executor.return_value.__enter__.return_value = pool
            with self.assertRaisesRegex(RuntimeError, 'worker failed'):
                E._parallel_canon_records(mock.Mock(reader_scheme='v2'),
                                          E.L.Declaration(coda_empty_evidence='gift'),
                                          E.L.Declaration(coda_empty_evidence='cannot_tell'))
        self.assertEqual(pool.submit.call_count, 2)

    def test_invalid_worker_count_refuses_before_lexicon_or_work(self):
        for value in ('0', '3', '', '02', 'true', '1/2'):
            with self.subTest(value=value), \
                    mock.patch.dict(os.environ, TEST_E5_CANON_WORKERS=value), \
                    mock.patch.object(E.L, 'Lexicon') as lex:
                with self.assertRaisesRegex(ValueError, 'TEST_E5_CANON_WORKERS'):
                    E.evaluate('canon')
                with contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(E.main(['--part=canon']), 2)
                lex.assert_not_called()


if __name__ == '__main__':
    unittest.main()
