#!/usr/bin/env python3
"""Adverse controls for complete in-run mutation suite partitioning."""
import os
from pathlib import Path
import sys
import tempfile
import unittest

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
        result, seen = self.run_fixture("from pathlib import Path\nPath('seen-once').write_text('done')\n", name='quality/test_other.py')
        self.assertEqual(result, ('PASS', ''))
        self.assertEqual(seen, {'seen-once': 'done'})


if __name__ == '__main__':
    unittest.main()
