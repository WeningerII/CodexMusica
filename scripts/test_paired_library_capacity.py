import unittest
import tempfile
import json
import hashlib
from pathlib import Path
from unittest.mock import patch
from paired_library_capacity_probe import PairedRuntime, fixture_files
from run_paired_library_capacity import command, frozen_image


class Protocol(unittest.TestCase):
    def runtime(self, states):
        runtime = object.__new__(PairedRuntime)
        runtime.library_mode = 'loaded'
        runtime.library_load_probe = None
        runtime.record = {}
        runtime.sample = lambda: None
        runtime.health = lambda: {'library': states.pop(0) if len(states) > 1 else states[0]}
        runtime.calls = []
        def request(method, path, **kwargs):
            runtime.calls.append(path)
            return {'search_ready': True}
        runtime.request = request
        return runtime

    def test_first_search_is_timed_before_legacy_verification_wait(self):
        ready = {'state': 'ready', 'failures': [], 'corpus': 'verified'}
        runtime = self.runtime([dict(ready, corpus='verifying'), ready])
        with patch.dict('os.environ', {f'LIBRARY_{name}_DIR': '/fixture' for name in ('SEARCH','EXPORT','CORPUS')}), \
                patch('paired_library_capacity_probe.time.monotonic', side_effect=[0,0,1,2,3,4,5,6]), \
                patch('paired_library_capacity_probe.time.sleep'):
            runtime.load_library('library')
        self.assertEqual(runtime.calls, ['/library/v1/search?limit=1', '/library/v1/health'])
        self.assertEqual(runtime.record['library']['first_search_s'], 1)
        self.assertEqual(runtime.record['library']['verified_ready_s'], 5)

    def test_ready_response_after_deadline_is_refused(self):
        runtime = self.runtime([{'state':'ready', 'failures':[], 'corpus':'verified'}])
        with patch.dict('os.environ', {f'LIBRARY_{name}_DIR': '/fixture' for name in ('SEARCH','EXPORT','CORPUS')}), \
                patch('paired_library_capacity_probe.time.monotonic', side_effect=[0,0,1,2,61]):
            with self.assertRaisesRegex(RuntimeError, 'deadline'):
                runtime.load_library('library')
        self.assertIsNone(runtime._pair_deadline)
        self.assertNotIn('library', runtime.record)

    def test_shared_fixture_bytes_and_membership_are_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'jobs').mkdir()
            files = {'prepared-runs.json': b'fixture', 'prepared-runs.json.sha256': b'hash',
                     'receipts.json': b'receipt', 'jobs/one.json': b'job'}
            for name, value in files.items():
                (root / name).write_bytes(value)
            manifest = {'files': {name:hashlib.sha256(value).hexdigest() for name,value in files.items()}}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            self.assertEqual(fixture_files(root), manifest['files'])
            with patch.dict('os.environ', {'PAIRED_CAPACITY_FIXTURES': str(root)}):
                for arm in ('before', 'after'):
                    dest = root.parent / (root.name + '-' + arm)
                    with tempfile.TemporaryDirectory(prefix=dest.name) as arm_tmp:
                        target = Path(arm_tmp)
                        runtime = self.runtime([])
                        runtime._prepare(['node', 'seed_lyrics_capacity_receipts.mjs',
                                          str(target / 'jobs'), str(target / 'receipts.json')])
                        runtime._prepare(['node', 'lyrics_capacity_server.mjs', 'unused',
                                          str(target / 'prepared-runs.json'), '--prepare'])
                        for name, value in files.items():
                            self.assertEqual((target / name).read_bytes(), value)
                        self.assertEqual(runtime.record['paired_fixture_sha256'], manifest['files'])
            (root / 'prepared-runs.json').write_bytes(b'different per-arm randomness')
            with self.assertRaisesRegex(RuntimeError, 'bytes differ'):
                fixture_files(root)
            (root / 'prepared-runs.json').write_bytes(files['prepared-runs.json'])
            (root / 'jobs/two.json').write_bytes(b'extra')
            with self.assertRaisesRegex(RuntimeError, 'inventory differs'):
                fixture_files(root)

    def test_failed_verification_is_not_accepted(self):
        runtime = self.runtime([{'state':'failed', 'corpus':'failed'}])
        with patch.dict('os.environ', {f'LIBRARY_{name}_DIR': '/fixture' for name in ('SEARCH','EXPORT','CORPUS')}):
            with self.assertRaisesRegex(RuntimeError, 'verification failed'):
                runtime.load_library('library')

    def test_all_stores_remain_required(self):
        runtime = self.runtime([])
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'all Library stores'):
                runtime.load_library('library')

    def test_command_keeps_envelope_offline_and_no_pull(self):
        cmd = command('sha256:' + 'a'*64, '/scripts', '/out', '31:20260910,24:20260909', 'loaded', 'before-loaded', '/fixtures')
        for flag in ['--pull=never','--network=none','--cpus=1','--memory=2g','--memory-swap=2g','--pids-limit=256']:
            self.assertIn(flag, cmd)
        self.assertIn('type=bind,src=/scripts,dst=/app/scripts,readonly', cmd)
        self.assertNotIn('--privileged', cmd)

    def test_mutable_image_names_are_refused(self):
        for name in ['latest','ghcr.io/x/image:tag','sha256:'+'a'*63]:
            with self.assertRaises(ValueError):
                frozen_image(name)


if __name__ == '__main__':
    unittest.main()
