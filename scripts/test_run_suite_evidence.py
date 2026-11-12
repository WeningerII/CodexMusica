#!/usr/bin/env python3
"""Behavioral controls for the complete fixed-evidence runner."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock


_SCRIPT = Path(__file__).with_name('run_suite_evidence.py')
_SPEC = importlib.util.spec_from_file_location('suite_evidence', _SCRIPT)
_RUNNER = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_RUNNER)
_BINDING = {'github_sha': 'a' * 40, 'checkout_sha': 'a' * 40,
            'git_tree': 'b' * 40, 'github_run_id': '123', 'github_run_attempt': '4',
            'source_fingerprint': {'scope_version': 1, 'file_count': 3, 'sha256': 'c' * 64}}


def _stub(root, failure='', holds=None):
    stub = root / 'python3'
    stub.write_text(f'#!{sys.executable}\n' + '''import fcntl,json,os,sys,time
from pathlib import Path
name=os.environ['SUITE_EVIDENCE_NAME']
weight=int(os.environ.get('TEST_E5_CANON_WORKERS','1'))
events=Path(os.environ['EVENT_LOG'])
def event(kind):
 with events.open('a+') as out:
  fcntl.flock(out,fcntl.LOCK_EX)
  out.seek(0)
  active={}
  for line in out:
   old=json.loads(line)
   if old['kind']=='start': active[old['name']]=old['weight']
   else: active.pop(old['name'])
  if kind=='start': active[name]=weight
  else: active.pop(name)
  out.seek(0,2)
  out.write(json.dumps({'kind':kind,'name':name,'weight':weight,'active':active,
                       'time':time.monotonic()})+'\\n')
  out.flush()
event('start')
print(json.dumps({'name':name,'argv':sys.argv[1:],'cwd':os.getcwd(),
 'cache':os.environ['XDG_CACHE_HOME'],'tmp':os.environ['TMPDIR'],
 'store':os.environ.get('LYRIC_FIELD_STORE','default'),
 'canon_workers':os.environ.get('TEST_E5_CANON_WORKERS')}),flush=True)
holds=json.loads(os.environ.get('HOLDS','{}'))
time.sleep(holds.get(name,0.02))
event('end')
sys.exit(9 if name==os.environ.get('FAIL_NAME') else 0)
''')
    stub.chmod(0o755)
    return dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                EVENT_LOG=str(root / 'events.jsonl'), LYRIC_FIELD_STORE='1',
                TEST_E5_CANON_WORKERS='99', FAIL_NAME=failure, HOLDS=json.dumps(holds or {}))


def _reports():
    reports = []
    for index in (1, 2):
        part = {'index': index, 'count': 2}
        commands = _RUNNER._selected(part)
        reports.append({'schema_version': 2, 'kind': 'suite-evidence',
                        'binding': copy.deepcopy(_BINDING), 'part': part,
                        'inventory_sha256': _RUNNER._digest(_RUNNER._inventory()),
                        'workers': 4, 'command_count': len(commands),
                        'completed_count': len(commands), 'success': True, 'errors': [],
                        'commands': [{'name': name, 'argv': list(argv), 'exit_code': 0,
                                      'cpu_slots': _RUNNER._slots((name, argv), 4)}
                                     for name, argv in commands]})
    return reports


class _RunnerTests(unittest.TestCase):
    def test_inventory_retains_every_original_fixed_command(self):
        expected = {('python3', 'quality/' + name + '.py', '--check') for name in
                    ('meter_bands', 'search_null', 'schema_end_reading',
                     'schema_window', 'door_census', 'chance_rate')}
        expected.add(('python3', 'quality/expected_drift.py', 'song_profile_calibration-fast'))
        expected.add(('python3', 'quality/e5_coda_adoption.py', '--part=canon'))
        expected.update(('python3', 'quality/e5_coda_adoption.py', f'--part=random-{k}/4')
                        for k in range(1, 5))
        self.assertEqual({command for _, command in _RUNNER.COMMANDS}, expected)
        self.assertEqual(len(_RUNNER.COMMANDS), len(expected))
        self.assertEqual(len({name for name, _ in _RUNNER.COMMANDS}), len(expected))
        parts = [_RUNNER._selected({'index': k, 'count': 2}) for k in (1, 2)]
        self.assertEqual([len(part) for part in parts], [7, 5])
        self.assertEqual({item for part in parts for item in part}, set(_RUNNER.COMMANDS))
        self.assertEqual(sum(map(len, parts)), 12)

    def test_weighted_children_reserve_before_setup_and_continue_after_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            holds = {name: (0.08 if name == 'e5-canon' else 0.35)
                     for name, _ in _RUNNER.COMMANDS}
            env = _stub(root, failure='e5-canon', holds=holds)
            actual = _RUNNER._run

            def delayed(command, directory, slots):
                if command[0] == 'e5-canon':
                    time.sleep(0.12)
                return actual(command, directory, slots)

            with mock.patch.dict(os.environ, env), mock.patch.object(_RUNNER, '_run', delayed):
                rows = _RUNNER._execute(_RUNNER.COMMANDS, 4, root)
            self.assertEqual([row['exit_code'] for row in rows], [9] + [0] * 11)
            self.assertEqual([row['argv'] for row in rows], [list(argv) for _, argv in _RUNNER.COMMANDS])
            observations = [json.loads(Path(row['log_path']).read_text()) for row in rows]
            self.assertEqual(len({row['cache'] for row in observations}), 12)
            self.assertEqual(len({row['tmp'] for row in observations}), 12)
            self.assertTrue(all(row['store'] == '1' for row in observations))
            self.assertTrue(all(Path(row['cwd']) == _RUNNER._HARNESS for row in observations))
            self.assertEqual([row['canon_workers'] for row in observations], ['2'] + [None] * 11)
            events = list(map(json.loads, (root / 'events.jsonl').read_text().splitlines()))
            self.assertEqual(len(events), 24)
            self.assertEqual(max(sum(row['active'].values()) for row in events), 4)
            self.assertEqual(max(len(row['active']) for row in events), 4)
            canon_start = next(i for i, row in enumerate(events)
                               if row['kind'] == 'start' and row['name'] == 'e5-canon')
            self.assertEqual(sum(row['kind'] == 'start' for row in events[:canon_start]), 2)
            self.assertEqual(events[-1]['active'], {})

    def test_incoming_two_slot_command_waits_and_single_cpu_retains_serial_mode(self):
        commands = list(_RUNNER.COMMANDS)
        commands = commands[1:4] + commands[:1] + commands[4:]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env = _stub(root, holds={commands[0][0]: 0.1, commands[1][0]: 0.3,
                                     commands[2][0]: 0.3, 'e5-canon': 0.06})
            with mock.patch.dict(os.environ, env):
                rows = _RUNNER._execute(commands, 4, root)
            self.assertTrue(all(row['exit_code'] == 0 for row in rows))
            events = list(map(json.loads, (root / 'events.jsonl').read_text().splitlines()))
            canon = next(row for row in events if row['kind'] == 'start' and row['name'] == 'e5-canon')
            self.assertEqual(len(canon['active']), 3)
            self.assertEqual(sum(canon['active'].values()), 4)
            self.assertLessEqual(max(sum(row['active'].values()) for row in events), 4)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with mock.patch.dict(os.environ, _stub(root)):
                rows = _RUNNER._execute(_RUNNER.COMMANDS, 1, root)
            events = list(map(json.loads, (root / 'events.jsonl').read_text().splitlines()))
            self.assertEqual(max(sum(row['active'].values()) for row in events), 1)
            self.assertEqual(rows[0]['cpu_slots'], 1)
            self.assertTrue(all(row['exit_code'] == 0 for row in rows))

    def test_runner_errors_preserve_every_remaining_command(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            actual = _RUNNER._run

            def raises(command, directory, slots):
                if command[0] == 'e5-canon':
                    raise RuntimeError('planted setup failure')
                return actual(command, directory, slots)

            with mock.patch.dict(os.environ, _stub(root)), mock.patch.object(_RUNNER, '_run', raises):
                rows = _RUNNER._execute(_RUNNER.COMMANDS, 4, root)
            self.assertEqual(len(rows), 12)
            self.assertEqual(rows[0]['exit_code'], 1)
            self.assertEqual(rows[0]['error'], 'planted setup failure')
            self.assertTrue(all(row['exit_code'] == 0 for row in rows[1:]))
        with tempfile.TemporaryDirectory() as temporary:
            with mock.patch.object(_RUNNER.subprocess, 'run', side_effect=OSError('missing executable')):
                row = _RUNNER._run(_RUNNER.COMMANDS[0], Path(temporary), 2)
            self.assertEqual(row['exit_code'], 127)

    def test_fan_in_rejects_incomplete_changed_failed_and_unbound_receipts(self):
        def rejects(change, reseal=True):
            reports = copy.deepcopy(_reports())
            change(reports)
            with tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                for index, report in enumerate(reports):
                    sealed = _RUNNER._seal(report)
                    if not reseal:
                        sealed['elapsed_seconds'] = 999
                    (directory / f'part-{index}.json').write_text(json.dumps(sealed))
                with self.assertRaises((ValueError, TypeError)):
                    _RUNNER._verify_reports(directory, 2, _BINDING)

        changes = {
            'missing part': lambda r: r.pop(),
            'extra part': lambda r: r.append(copy.deepcopy(r[0])),
            'duplicate coordinate': lambda r: r.__setitem__(1, copy.deepcopy(r[0])),
            'wrong coordinate': lambda r: r[0]['part'].update(index=3),
            'wrong count': lambda r: r[0]['part'].update(count=3),
            'boolean coordinate': lambda r: r[0]['part'].update(index=True),
            'missing command': lambda r: r[0]['commands'].pop(),
            'duplicate command': lambda r: r[0]['commands'].__setitem__(1, copy.deepcopy(r[0]['commands'][0])),
            'wrong argv': lambda r: r[0]['commands'][0]['argv'].append('--weaken'),
            'wrong inventory': lambda r: r[0].update(inventory_sha256='x' * 64),
            'failed outcome': lambda r: r[0]['commands'][0].update(exit_code=9),
            'false success': lambda r: r[0].update(success=False),
            'source error': lambda r: r[0].update(errors=['source drift']),
            'wrong CPU reservation': lambda r: r[0]['commands'][0].update(cpu_slots=1),
            'boolean status': lambda r: r[0]['commands'][0].update(exit_code=False),
            'float status': lambda r: r[0]['commands'][0].update(exit_code=0.0),
            'wrong schema': lambda r: r[0].update(schema_version=1),
        }
        for key in _BINDING:
            changes['wrong binding ' + key] = lambda r, key=key: r[0]['binding'].__setitem__(key, 'changed')
        for label, change in changes.items():
            with self.subTest(label=label):
                rejects(change)
        rejects(lambda r: None, reseal=False)
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for index, report in enumerate(_reports()):
                (directory / f'part-{index}.json').write_text(json.dumps(_RUNNER._seal(report)))
            result = _RUNNER._verify_reports(directory, 2, _BINDING)
            self.assertTrue(result['success'])
            self.assertEqual(result['command_count'], 12)

    def test_actual_two_producers_and_dependency_free_fan_in(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            receipts = root / 'receipts'
            receipts.mkdir()
            env = _stub(root)
            env.update(GITHUB_SHA=subprocess.check_output(['git', 'rev-parse', 'HEAD'],
                                                         cwd=_RUNNER._ROOT, text=True).strip(),
                       GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='4')
            reports = []
            for k in (1, 2):
                report = receipts / f'suite-evidence-{k}.json'
                run = subprocess.run([sys.executable, str(_SCRIPT), f'--shard={k}/2',
                                      '--logs-dir=' + str(root / f'logs-{k}'),
                                      '--report=' + str(report)], env=env,
                                     capture_output=True, text=True)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                reports.append(json.loads(report.read_text()))
            verified = subprocess.run([sys.executable, str(_SCRIPT), '--verify-reports=' + str(receipts),
                                       '--shards=2'], env=env, capture_output=True, text=True)
            self.assertEqual(verified.returncode, 0, verified.stdout + verified.stderr)
            self.assertTrue(json.loads(verified.stdout)['success'])
            self.assertEqual({tuple(row['argv']) for report in reports for row in report['commands']},
                             {argv for _, argv in _RUNNER.COMMANDS})
            self.assertEqual(reports[0]['binding'], reports[1]['binding'])
            self.assertEqual(sum(report['completed_count'] for report in reports), 12)
            failed = subprocess.run([sys.executable, str(_SCRIPT), '--shard=1/2',
                                     '--logs-dir=' + str(root / 'failed-logs'),
                                     '--report=' + str(receipts / 'suite-evidence-1.json')],
                                    env=dict(env, FAIL_NAME='e5-canon'), capture_output=True, text=True)
            self.assertEqual(failed.returncode, 1, failed.stdout + failed.stderr)
            self.assertIn('7 completed, 1 failed', failed.stdout)
            refused = subprocess.run([sys.executable, str(_SCRIPT), '--verify-reports=' + str(receipts)],
                                     env=env, capture_output=True, text=True)
            self.assertEqual(refused.returncode, 1, refused.stdout + refused.stderr)

    def test_source_drift_fails_after_all_selected_commands(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            rows = [{'name': name, 'argv': list(argv), 'exit_code': 0, 'cpu_slots': 1}
                    for name, argv in _RUNNER._selected({'index': 2, 'count': 2})]
            with mock.patch.object(_RUNNER, '_binding', side_effect=[_BINDING, {}]), \
                    mock.patch.object(_RUNNER, '_execute', return_value=rows) as execute:
                status = _RUNNER._main(['--shard=2/2', '--logs-dir=' + str(root),
                                        '--report=' + str(root / 'report.json')])
            self.assertEqual(status, 1)
            self.assertEqual(len(execute.call_args.args[0]), 5)
            report = json.loads((root / 'report.json').read_text())
            self.assertFalse(report['success'])
            self.assertEqual(report['completed_count'], 5)
            self.assertEqual(len(report['errors']), 1)

    def test_list_and_invalid_options_do_not_execute_checks(self):
        listed = subprocess.run([sys.executable, str(_SCRIPT), '--list-json'],
                                capture_output=True, text=True, check=True)
        data = json.loads(listed.stdout)
        self.assertEqual(data['count'], 12)
        self.assertEqual([len(part['names']) for part in data['partitions']], [7, 5])
        for option in ('--workers=0', '--workers=5', '--workers=-1', '--shard=0/2',
                       '--shard=1/3', '--shard=3/2', '--only=e5-canon'):
            run = subprocess.run([sys.executable, str(_SCRIPT), option],
                                 capture_output=True, text=True)
            self.assertEqual(run.returncode, 2, option)
            self.assertNotIn('EVIDENCE START', run.stdout)


if __name__ == '__main__':
    unittest.main()
