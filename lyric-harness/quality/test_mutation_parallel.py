#!/usr/bin/env python3
"""Adverse controls for complete in-run mutation suite partitioning."""
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mutate


class CompleteSuiteTests(unittest.TestCase):
    def run_fixture(self, body, *, timeout=5, env=None, name='quality/test_revise.py'):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / name
            path.parent.mkdir()
            path.write_text(body)
            result = mutate.run_complete_suite(directory, name, {**os.environ, **(env or {})}, timeout)
            seen = {p.name: p.read_text() for p in Path(directory).glob('seen-*')}
            return result, seen

    def test_both_halves_execute_concurrently_despite_inherited_partial_scope(self):
        body = '''import os, time
from pathlib import Path
coordinate = os.environ['TEST_REVISE_SHARD']
i, n = map(int, coordinate.split('/'))
assert n == 2
Path('seen-' + str(i)).write_text(coordinate)
end = time.monotonic() + 3
while len(list(Path('.').glob('seen-*'))) != 2 and time.monotonic() < end:
    time.sleep(.01)
assert len(list(Path('.').glob('seen-*'))) == 2, 'other half never ran concurrently'
'''
        result, seen = self.run_fixture(body, env={'TEST_REVISE_SHARD': '1/9'})
        self.assertEqual(result, ('PASS', ''))
        self.assertEqual(seen, {'seen-1': '1/2', 'seen-2': '2/2'})

    def test_a_failure_never_prevents_the_other_half_from_finishing(self):
        body = '''import os, sys, time
from pathlib import Path
i = os.environ['TEST_REVISE_SHARD'][0]
if i == '1':
    print('1 FAILING: planted detector')
    sys.exit(1)
time.sleep(.1)
Path('seen-2').write_text('completed')
'''
        (status, tail), seen = self.run_fixture(body)
        self.assertEqual(status, 'FAIL')
        self.assertIn('planted detector', tail)
        self.assertEqual(seen, {'seen-2': 'completed'})

    def test_timeout_overrides_a_catch(self):
        body = '''import os, time, sys
if os.environ['TEST_REVISE_SHARD'].startswith('1/'):
    print('1 FAILING: planted catch')
    sys.exit(1)
time.sleep(5)
'''
        (status, tail), _ = self.run_fixture(body, timeout=1)
        self.assertEqual(status, 'TIMEOUT')
        self.assertIn('shard 1/2: FAIL', tail)
        self.assertIn('shard 2/2: TIMEOUT', tail)
        self.assertIn('1s', tail)

    def test_error_and_failure_are_both_retained(self):
        body = '''import os, sys
if os.environ['TEST_REVISE_SHARD'].startswith('1/'):
    print('1 FAILING: planted catch')
    sys.exit(1)
raise RuntimeError('planted crash')
'''
        (status, tail), _ = self.run_fixture(body)
        self.assertEqual(status, 'ERROR')
        self.assertIn('shard 1/2: FAIL', tail)
        self.assertIn('shard 2/2: ERROR', tail)

    def test_loop_uses_its_own_complete_coordinate(self):
        result, seen = self.run_fixture('''import os
from pathlib import Path
coordinate = os.environ['TEST_LOOP_SHARD']
Path('seen-' + coordinate[0]).write_text(coordinate)
''', name='quality/test_loop.py')
        self.assertEqual(result, ('PASS', ''))
        self.assertEqual(set(seen.values()), {'1/2', '2/2'})

    def test_other_suites_run_once(self):
        result, seen = self.run_fixture("from pathlib import Path\nwith Path('seen-once').open('a') as out: out.write('done')\n", name='quality/test_other.py')
        self.assertEqual(result, ('PASS', ''))
        self.assertEqual(seen, {'seen-once': 'done'})

    def test_ordinary_suite_cannot_inherit_partial_coordinates(self):
        result, _ = self.run_fixture('''import os
assert not any(k.startswith('TEST_') and k.endswith('_SHARD') for k in os.environ)
''', name='quality/test_other.py', env={'TEST_REVISE_SHARD': '1/9', 'TEST_PLAN_SHARD': '2/5'})
        self.assertEqual(result, ('PASS', ''))

    def test_signal_is_incomplete_even_when_the_other_half_catches(self):
        (status, tail), _ = self.run_fixture('''import os, signal, sys
if os.environ['TEST_REVISE_SHARD'].startswith('1/'):
    print('1 FAILING: planted catch')
    sys.exit(1)
os.kill(os.getpid(), signal.SIGKILL)
''')
        self.assertEqual(status, 'TIMEOUT')
        self.assertIn('signal 9', tail)
        self.assertIn('shard 1/2: FAIL', tail)

    def test_confirmation_repeats_complete_partitioned_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'quality/test_revise.py'
            path.parent.mkdir()
            path.write_text('''import os, sys
from pathlib import Path
coordinate = os.environ.get('TEST_REVISE_SHARD')
assert coordinate in ('1/2', '2/2')
assert 'TEST_PLAN_SHARD' not in os.environ
Path('seen-' + coordinate[0]).write_text(coordinate)
print('1 FAILING: split-only detector')
sys.exit(1)
''')
            with patch.dict(os.environ, {'TEST_REVISE_SHARD': '1/9', 'TEST_PLAN_SHARD': '2/5'}):
                status, _, _ = mutate.run_test(directory, 'quality/test_revise.py')
                self.assertEqual(status, 'FAIL')
                for seen in Path(directory).glob('seen-*'):
                    seen.unlink()
                observations = []
                verdict, detail = mutate.confirm_failure(directory, 'quality/test_revise.py',
                                                         attempts=1, observations=observations)
            self.assertEqual(verdict, 'CAUGHT')
            self.assertEqual(observations[0]['status'], 'FAIL')
            self.assertIn('split-only detector', detail)
            self.assertEqual({p.read_text() for p in Path(directory).glob('seen-*')}, {'1/2', '2/2'})

    def test_signal_confirmation_is_refused_not_caught(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'quality/test_revise.py'
            path.parent.mkdir()
            path.write_text('import os, signal\nos.kill(os.getpid(), signal.SIGKILL)\n')
            observations = []
            verdict, detail = mutate.confirm_failure(directory, 'quality/test_revise.py',
                                                     attempts=2, observations=observations)
            self.assertEqual(verdict, 'REFUSED')
            self.assertEqual([o['status'] for o in observations], ['TIMEOUT', 'TIMEOUT'])
            self.assertIn('signal 9', detail)

    def test_instrument_controls_are_not_mutation_detectors(self):
        self.assertIn('quality/test_mutation_parallel.py', mutate.EXCLUDE_TESTS)
        self.assertNotIn('quality/test_mutation_parallel.py', mutate.discover_tests())
        self.assertIn('quality/test_revise.py', mutate.discover_tests())

    def test_timeout_outranks_error_and_each_half_gets_the_same_bound(self):
        calls = []
        def child(command, **kwargs):
            calls.append(kwargs['timeout'])
            if kwargs['env']['TEST_REVISE_SHARD'] == '1/2':
                return mutate.subprocess.CompletedProcess(command, 1, b'', b'Traceback (most recent call last)\ncrash')
            raise mutate.subprocess.TimeoutExpired(command, kwargs['timeout'])
        with patch.object(mutate.subprocess, 'run', side_effect=child):
            status, tail = mutate.run_complete_suite('.', 'quality/test_revise.py', {}, 37)
        self.assertEqual(status, 'TIMEOUT')
        self.assertEqual(calls, [37, 37])
        self.assertIn('shard 1/2: ERROR', tail)
        self.assertIn('shard 2/2: TIMEOUT', tail)

    def test_tail_keeps_both_causes_within_the_existing_report_limit(self):
        (status, tail), _ = self.run_fixture('''import os, sys
print('1 FAILING: cause-' + os.environ['TEST_REVISE_SHARD'][0] + '-' + 'x' * 500)
sys.exit(1)
''')
        self.assertEqual(status, 'FAIL')
        self.assertLessEqual(len(tail), 400)
        self.assertIn('cause-1', tail)
        self.assertIn('cause-2', tail)

    def test_successful_half_is_absent_from_failure_tail(self):
        (status, tail), _ = self.run_fixture('''import os, sys
if os.environ['TEST_REVISE_SHARD'] == '2/2':
    print('1 FAILING: second half')
    sys.exit(1)
''')
        self.assertEqual(status, 'FAIL')
        self.assertNotIn('shard 1/2', tail)
        self.assertIn('shard 2/2: FAIL', tail)


if __name__ == '__main__':
    unittest.main()
