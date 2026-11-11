import json
from pathlib import Path
import tempfile
import unittest
import subprocess
from unittest.mock import patch
from collect_paired_images import collect, read_arm, SOURCES


class Collection(unittest.TestCase):
    def exercise_read(self, failure):
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory)
            image = 'sha256:' + 'a' * 64
            info = {'Id': image, 'Os': 'linux', 'Architecture': 'amd64', 'Config': {
                'Env': [f'{key}={SOURCES["before"]}' for key in
                        ('BUILD_GIT_COMMIT', 'RENDER_GIT_COMMIT')]}}
            (evidence / 'before-image.json').write_text(json.dumps([info]))
            row = {key: {} for key in ('assets', 'configuration', 'fixture_dependencies',
                   'runtime_dependencies', 'runtime_source', 'runtime_inputs', 'generated_metadata')}
            row.update(source_sha=SOURCES['before'], corpus_directory_present=False,
                       node_version='v22', python_version='3.11')
            def process(argv, **kwargs):
                if argv[1] == 'rm':
                    return subprocess.CompletedProcess(argv, 1 if failure == 'cleanup' else 0,
                        '', 'permission denied' if failure == 'cleanup' else '')
                kwargs['stderr'].write('retained diagnostic stderr\n')
                if failure == 'timeout':
                    raise subprocess.TimeoutExpired(argv, kwargs['timeout'])
                if failure == 'source':
                    row['source_sha'] = SOURCES['after']
                kwargs['stdout'].write('{invalid' if failure == 'json' else json.dumps(row))
                return subprocess.CompletedProcess(argv, 0)
            with patch('collect_paired_images.subprocess.run', side_effect=process) as run:
                result = read_arm('before', evidence, Path('helper'))
            self.assertEqual(run.call_count, 2)
            self.assertEqual(run.call_args_list[1].args[0][:3], ['docker', 'rm', '-f'])
            self.assertEqual(run.call_args_list[0].args[0][3], run.call_args_list[1].args[0][3])
            status = json.loads((evidence / 'before-status.json').read_text())
            self.assertEqual(status, result[2])
            self.assertEqual(status['status'], 'failed')
            self.assertIn('retained diagnostic', (evidence / 'before-inventory.stderr').read_text())
            return result

    def test_read_timeout_is_recorded_and_container_cleaned(self):
        row, _, status = self.exercise_read('timeout')
        self.assertIsNone(row)
        self.assertIn('TimeoutExpired', status['error'])

    def test_read_malformed_json_is_recorded(self):
        row, _, status = self.exercise_read('json')
        self.assertIsNone(row)
        self.assertIn('JSONDecodeError', status['error'])

    def test_read_source_mismatch_is_recorded(self):
        row, _, status = self.exercise_read('source')
        self.assertIsNone(row)
        self.assertIn('source identity mismatch', status['error'])

    def test_cleanup_failure_overrides_successful_read(self):
        row, _, status = self.exercise_read('cleanup')
        self.assertIsNotNone(row)
        self.assertEqual(status['exit_code'], 0)
        self.assertEqual(status['cleanup_error'], 'permission denied')

    def test_both_reads_attempted_and_failure_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory)
            with patch('collect_paired_images.read_arm', return_value=(None, None,
                    {'status':'failed', 'error':'fixture refusal'})) as read, \
                    patch('builtins.print'):
                self.assertEqual(collect(evidence, Path('helper')), 1)
            self.assertEqual([c.args[0] for c in read.call_args_list], ['before', 'after'])
            result = json.loads((evidence / 'comparison.json').read_text())
            self.assertEqual(result['status'], 'failed')
            self.assertFalse(result['measurements_run'])
            self.assertEqual(set(result['arms']), {'before', 'after'})
