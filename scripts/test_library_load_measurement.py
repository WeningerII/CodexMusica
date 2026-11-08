import copy
import threading
import unittest
from library_load_measurement import sample_during_load, load_trace_failures


class FirstLoad(unittest.TestCase):
    def test_a_transient_peak_inside_the_request_is_not_replaced_by_postload(self):
        seen = threading.Event()
        class Progress:
            value = 10
            peak = 0
            def sample(self):
                self.peak = max(self.peak, self.value)
                if self.value == 99:
                    seen.set()
        progress = Progress()
        def load():
            self.assertEqual(progress.peak, 10, 'baseline must precede first-use request')
            progress.value = 99
            self.assertTrue(seen.wait(2), 'sampler must run while the request is pending')
            progress.value = 20
            return 'verified response'
        self.assertEqual(sample_during_load(load, progress, interval=.001), 'verified response')
        self.assertEqual(progress.peak, 99)
        self.assertFalse(any(t.name == 'library-load-sampler' for t in threading.enumerate()))

    def test_failed_request_still_samples_and_cleans_up(self):
        class Progress:
            calls = 0
            def sample(self): self.calls += 1
        progress = Progress()
        def fail(): raise ValueError('load failed')
        with self.assertRaisesRegex(ValueError, 'load failed'):
            sample_during_load(fail, progress)
        self.assertEqual(progress.calls, 2)
        self.assertFalse(any(t.name == 'library-load-sampler' for t in threading.enumerate()))

    def test_sampling_failure_cannot_return_successful_evidence(self):
        class Progress:
            calls = 0
            def sample(self):
                self.calls += 1
                if self.calls > 1: raise OSError('missing cgroup')
        with self.assertRaisesRegex(RuntimeError, 'sampling failed'):
            sample_during_load(lambda: 'success', Progress())

    def test_first_search_timing_precedes_observational_health(self):
        from lyrics_capacity_runtime import ResidentRuntime
        from unittest.mock import patch
        runtime = object.__new__(ResidentRuntime)
        runtime.record = {}
        runtime.library_load_probe = lambda key, fn: fn()
        paths = []
        def request(method, path, **kwargs):
            paths.append(path)
            return {'search_ready': True}
        runtime.request = request
        runtime.health = lambda: {'library': {'state': 'ready', 'failures': [], 'corpus': 'absent'}}
        runtime.sample = lambda: None
        with patch.dict('os.environ', {'LIBRARY_SEARCH_DIR': 'fixture', 'LIBRARY_EXPORT_DIR': '', 'LIBRARY_CORPUS_DIR': ''}), \
                patch('lyrics_capacity_runtime.time.monotonic', side_effect=[10., 12., 13.]):
            runtime.load_library('library')
        self.assertEqual(paths, ['/library/v1/search?limit=1', '/library/v1/health'])
        self.assertEqual(runtime.record['library']['first_search_s'], 2.)
        self.assertEqual(runtime.record['library']['load_s'], 3.)

    def test_missing_excessive_or_relabelled_load_evidence_is_rejected(self):
        rows = [dict(phase=phase, metric='sampled_resident_first_load', peak_bytes=1000,
                     instrumentation=dict(sample_count=2, peak_sample=dict(resident_bytes=1000)))
                for phase in ('library', 'library_recovery')]
        self.assertEqual(load_trace_failures(rows, 1792 * 1024**2), [])
        for bad in (None, [], rows[:1], [rows[0], rows[0]], [dict(phase=None), rows[1]]):
            self.assertTrue(load_trace_failures(bad, 1792 * 1024**2))
        for field, value in [('peak_bytes', 1792 * 1024**2 + 1),
                             ('peak_bytes', True), ('metric', 'lifetime_cgroup_peak'),
                             ('instrumentation', {'sample_count': 1}),
                             ('instrumentation', {'sample_count': 2, 'peak_sample': {'resident_bytes': 999}})]:
            bad = copy.deepcopy(rows)
            bad[0][field] = value
            self.assertTrue(load_trace_failures(bad, 1792 * 1024**2), (field, value))


if __name__ == '__main__':
    unittest.main()
