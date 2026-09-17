"""M-170 measurement controls; timings never become CI performance thresholds."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'lyric-harness'))
from quality import fold_series
import measure_lyric_continuations as measure
import summarize_lyric_continuations as summary


class ContinuationMeasurementTests(unittest.TestCase):
    def test_line_override_reaches_the_planner_but_finish_flags_do_not(self):
        with patch.object(fold_series.subprocess, 'run') as run:
            run.return_value.stdout = 'Write a song: 28 lines'
            run.return_value.returncode = 0
            self.assertEqual(fold_series.declared_lines(16, ['--lines=28', '--attempts=1']), 28)
        self.assertEqual(run.call_args.args[0], [sys.executable, 'lyric_harness.py',
                                                'plan', '--seed=16', '--lines=28'])

    def test_every_pending_kind_preserves_order_and_exact_members(self):
        choose = lambda n: f'answer {n}'
        cases = [('propose', {'line': 3}, 'answer 3'),
                 ('propose_group', {'members': [8, 2]}, 'L8: answer 8\nL2: answer 2'),
                 ('propose_batch', {'records': [{'line': 5}, {'line': 1}]},
                  'L5: answer 5\nL1: answer 1')]
        for kind, record, expected in cases:
            self.assertEqual(fold_series.answer_pending(dict(kind=kind, record=record), 0, choose), expected)
        with self.assertRaisesRegex(ValueError, 'unsupported pending kind'):
            fold_series.answer_pending(dict(kind='new protocol', record={}), 0)

    def test_failed_fold_is_not_a_successful_measurement_and_old_files_survive(self):
        with tempfile.TemporaryDirectory() as tmp, \
                patch.dict(fold_series.os.environ, {'FOLD_SERIES_DIR': tmp}), \
                patch.object(fold_series, 'declared_lines', return_value=22), \
                patch.object(fold_series.subprocess, 'run') as run, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            run.return_value.returncode = 2
            run.return_value.stdout = 'REFUSED: a required resource is missing'
            run.return_value.stderr = ''
            self.assertEqual(fold_series.main(['failure', '--folds=0']), 2)
            self.assertIn('required resource is missing', output.getvalue())
            draft = Path(tmp) / 'draft16_failure.txt'
            draft.write_text('preserve these exact bytes')
            with self.assertRaisesRegex(SystemExit, 'already exists'):
                fold_series.main(['failure'])
            self.assertEqual(draft.read_text(), 'preserve these exact bytes')

    def test_nested_clock_does_not_double_count_and_preserves_return_and_arguments(self):
        clock = measure.ComponentClock()
        marker = object()
        inner = clock.wrap('inner', lambda received: received)
        outer = clock.wrap('outer', lambda received: inner(received))
        with patch.object(measure.time, 'perf_counter', side_effect=[0., 1., 3., 5.]), \
                patch.object(measure.time, 'process_time', side_effect=[0., 1., 2., 4.]):
            self.assertIs(outer(marker), marker)
        self.assertEqual(clock.rows['outer']['wall'], 5.)
        self.assertEqual(clock.rows['outer']['self_wall'], 3.)
        self.assertEqual(clock.rows['outer > inner']['self_wall'], 2.)
        self.assertEqual(sum(r['self_cpu'] for r in clock.rows.values()), 4.)

    def test_exception_is_not_replaced_and_clock_stack_is_restored(self):
        clock = measure.ComponentClock()
        error = ValueError('original refusal')
        def refused():
            raise error
        with self.assertRaises(ValueError) as raised:
            clock.wrap('refusal', refused)()
        self.assertIs(raised.exception, error)
        self.assertEqual(clock.stack, [])
        self.assertEqual(clock.rows['refusal']['calls'], 1)

    def test_equivalence_ignores_only_disclosed_cache_and_path_differences(self):
        def record(lines, hits):
            return '  lyric result: '+json.dumps(dict(lines=lines, memo_hit=hits, memo_asked=9,
                                                    memo_state='warm', exit_code=3))
        a = 'draft /a/draft.txt\n REPLAY MEMO: cold\n'+record(['real lyric'], 0)
        b = 'draft /b/draft.txt\n REPLAY MEMO: warm\n'+record(['real lyric'], 8)
        self.assertEqual(measure.normalise(a, '/a'), measure.normalise(b, '/b'))
        self.assertNotEqual(measure.normalise(a, '/a'), measure.normalise(b.replace('real lyric', 'changed lyric'), '/b'))
        self.assertNotEqual(measure.normalise(a, '/a'), measure.normalise(b.replace('"exit_code": 3', '"exit_code": 0'), '/b'))

    def test_internal_blueprint_path_is_ignored_only_in_its_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / 'a.stdout', Path(tmp) / 'b.stdout'
            a.write_text('  BLUEPRINT: /tmp/finish_bp_abc.json — declared meter\nreal finding\n')
            b.write_text(a.read_text().replace('finish_bp_abc', 'finish_bp_xyz'))
            self.assertEqual(summary.output_digest(a), summary.output_digest(b))
            b.write_text(b.read_text().replace('real finding', 'changed finding'))
            self.assertNotEqual(summary.output_digest(a), summary.output_digest(b))
            a.write_text('a lyric about /tmp/finish_bp_abc.json')
            b.write_text('a lyric about /tmp/finish_bp_xyz.json')
            self.assertNotEqual(summary.output_digest(a), summary.output_digest(b))

    def test_missing_or_unfinished_receipts_cannot_report_equivalence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = summary.summarise(root)
            self.assertFalse(result['initial_equality']['equal'])
            self.assertFalse(result['comparisons']['22']['complete'])
            directory = root / 'series-warm-22'
            directory.mkdir()
            (directory / 'report.json').write_text('{"source_unchanged":false}')
            with self.assertRaisesRegex(ValueError, 'unchanged-source receipt'):
                summary.summarise(root)
            incomplete = dict(source_unchanged=True, head='test', lines=22, rows=[],
                              completed_resumes=0, requested_resumes=11, last_exit_code=4)
            (directory / 'report.json').write_text(json.dumps(incomplete))
            other = root / 'series-cold-22'
            other.mkdir()
            (other / 'report.json').write_text(json.dumps(incomplete))
            result = summary.summarise(root)
            self.assertFalse(result['comparisons']['22']['complete'])
            self.assertFalse(result['comparisons']['22']['equal'])

    def test_relocated_receipts_normalise_the_recorded_paths_not_the_new_location(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            digests = []
            for name in ('cold', 'warm'):
                directory = root / name
                directory.mkdir()
                original = f'/old-host/{name}'
                (directory / 'report.json').write_text(json.dumps({'argv':['finish',original+'/draft.txt']}))
                output = directory / '00.stdout'
                output.write_text(f'draft {original}/draft.txt\nkeep this actual finding\n')
                digests.append(summary.output_digest(output))
            self.assertEqual(*digests)

    def test_two_empty_outputs_or_absent_pending_journals_are_not_equivalence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for mode in ('warm', 'cold'):
                directory = root / f'series-{mode}-22'
                directory.mkdir()
                report = dict(source_unchanged=True, head='test', lines=22,
                              rows=[dict(fold=0, code=4)], completed_resumes=0,
                              requested_resumes=0, last_exit_code=4, source_sha256={'a':'source'},
                              runtime_sha256={'b':'data'}, python='test', fixture='plan',
                              seed=16, draft_sha256='draft')
                (directory / 'report.json').write_text(json.dumps(report))
                (directory / '00.stdout').write_text('')
                (directory / '00.stderr').write_text('')
            self.assertFalse(summary.summarise(root)['comparisons']['22']['equal'])
            for directory in root.iterdir():
                (directory / '00.stdout').write_text('a pending question')
            self.assertFalse(summary.summarise(root)['comparisons']['22']['equal'])
            for directory in root.iterdir():
                (directory / '00.journal.json').write_text('{"pending":{"kind":"propose"}}')
            self.assertTrue(summary.summarise(root)['comparisons']['22']['equal'])
            path = root / 'series-cold-22/report.json'
            report = json.loads(path.read_text())
            report['runtime_sha256']['b'] = 'different data'
            path.write_text(json.dumps(report))
            self.assertFalse(summary.summarise(root)['comparisons']['22']['equal'])
            report['runtime_sha256']['b'] = 'data'
            path.write_text(json.dumps(report))
            for directory in root.iterdir():
                path = directory / 'report.json'
                report = json.loads(path.read_text())
                report['last_exit_code'] = report['rows'][0]['code'] = 124
                report['rows'][0]['partial'] = True
                path.write_text(json.dumps(report))
            result = summary.summarise(root)['comparisons']['22']
            self.assertFalse(result['complete'])
            self.assertFalse(result['equal'])


if __name__ == '__main__':
    unittest.main()
