import unittest
from unittest.mock import patch
from paired_library_capacity_probe import PairedRuntime
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
                patch('paired_library_capacity_probe.time.monotonic', side_effect=[0,1,2,3,4,5]), \
                patch('paired_library_capacity_probe.time.sleep'):
            runtime.load_library('library')
        self.assertEqual(runtime.calls, ['/library/v1/search?limit=1', '/library/v1/health'])
        self.assertEqual(runtime.record['library']['first_search_s'], 1)
        self.assertEqual(runtime.record['library']['verified_ready_s'], 4)

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
        cmd = command('sha256:' + 'a'*64, '/scripts', '/out', '31:20260910,24:20260909', 'loaded', 'before-loaded')
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
