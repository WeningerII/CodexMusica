#!/usr/bin/env python3
"""Behavioral controls for the complete fixed-evidence runner."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


_SCRIPT = Path(__file__).with_name("run_suite_evidence.py")
_SPEC = importlib.util.spec_from_file_location("suite_evidence", _SCRIPT)
_RUNNER = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_RUNNER)


class _RunnerTests(unittest.TestCase):
    def test_inventory_retains_every_original_fixed_command(self):
        expected = {("python3", "quality/" + name + ".py", "--check") for name in
                    ("meter_bands", "search_null", "schema_end_reading",
                     "schema_window", "door_census", "chance_rate")}
        expected.add(("python3", "quality/expected_drift.py", "song_profile_calibration-fast"))
        expected.add(("python3", "quality/e5_coda_adoption.py", "--part=canon"))
        expected.update(("python3", "quality/e5_coda_adoption.py", f"--part=random-{k}/4")
                        for k in range(1, 5))
        self.assertEqual({command for _, command in _RUNNER.COMMANDS}, expected)
        self.assertEqual(len(_RUNNER.COMMANDS), len(expected))
        self.assertEqual(len({name for name, _ in _RUNNER.COMMANDS}), len(expected))

    def test_failure_continues_all_commands_with_private_cache_and_four_slots(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            stub = root / "python3"
            stub.write_text(f"#!{sys.executable}\n" + """import json,os,sys,time
from pathlib import Path
log=Path(os.environ['EVENT_LOG'])
def event(kind):
 with log.open('a') as out:
  out.write(json.dumps({'event':kind,'time':time.monotonic(),'pid':os.getpid()})+'\\n')
event('start')
print(json.dumps({'argv':sys.argv[1:],'cwd':os.getcwd(),'cache':os.environ['XDG_CACHE_HOME'],
 'tmp':os.environ['TMPDIR'],'store':os.environ.get('LYRIC_FIELD_STORE','default')}),flush=True)
deadline=time.monotonic()+5
while len(log.read_text().splitlines())<4 and time.monotonic()<deadline:
 time.sleep(0.005)
time.sleep(0.08)
event('end')
sys.exit(9 if '--part=canon' in sys.argv else 0)
""")
            stub.chmod(0o755)
            events, report = root / "events.jsonl", root / "report.json"
            env = dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                       EVENT_LOG=str(events), LYRIC_FIELD_STORE="1")
            run = subprocess.run([sys.executable, str(_SCRIPT), "--workers=4",
                                  "--logs-dir=" + str(root / "logs"),
                                  "--report=" + str(report)], env=env,
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 1, run.stdout + run.stderr)
            data = json.loads(report.read_text())
            self.assertEqual(data['completed_count'], 12)
            self.assertFalse(data['success'])
            self.assertEqual([row['argv'] for row in data['commands']],
                             [list(command) for _, command in _RUNNER.COMMANDS])
            self.assertEqual([row['exit_code'] for row in data['commands']], [9] + [0] * 11)
            observations = [json.loads(Path(row['log_path']).read_text()) for row in data['commands']]
            self.assertEqual(len({row['cache'] for row in observations}), 12)
            self.assertEqual(len({row['tmp'] for row in observations}), 12)
            self.assertTrue(all(row['store'] == '1' for row in observations))
            self.assertTrue(all(Path(row['cwd']) == _RUNNER._HARNESS for row in observations))
            active = peak = 0
            for row in sorted(map(json.loads, events.read_text().splitlines()), key=lambda row: row['time']):
                active += 1 if row['event'] == 'start' else -1
                peak = max(peak, active)
            self.assertEqual(active, 0)
            self.assertEqual(peak, 4)
            self.assertIn('FAILING EVIDENCE e5-canon', run.stdout)

    def test_list_and_invalid_width_do_not_execute_checks(self):
        listed = subprocess.run([sys.executable, str(_SCRIPT), '--list-json'],
                                capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(listed.stdout)['count'], 12)
        for width in ('0', '5', '-1'):
            run = subprocess.run([sys.executable, str(_SCRIPT), '--workers=' + width],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 2)
            self.assertNotIn('EVIDENCE START', run.stdout)


if __name__ == '__main__':
    unittest.main()
