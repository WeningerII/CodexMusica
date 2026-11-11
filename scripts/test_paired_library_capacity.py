import unittest
import tempfile
import json
import hashlib
import copy
import subprocess
from pathlib import Path
from unittest.mock import patch
from paired_library_capacity_probe import PairedRuntime, fixture_files, search_evidence, SEARCH_QUERIES
from run_paired_library_capacity import command, frozen_image, run_arm, compare_searches, schedule, validate_preflight


class Protocol(unittest.TestCase):
    def test_precheck_refusal_retains_failed_arm_without_measurement(self):
        from run_paired_library_capacity import main
        from paired_fixture_validation import PROTOCOL
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            common = root / 'common.json'; common.write_text('{}')
            preflight = root / 'preflight.json'
            preflight.write_text(json.dumps({'fixture_protocol': PROTOCOL,
                'fixture_manifests': {'before':'before-manifest','after':'after-manifest'},
                'common_corpus_sha256':'common-hash'}))
            images = ['sha256:'+'a'*64, 'sha256:'+'b'*64]
            sources = ['c'*40, 'd'*40]
            infos = [json.dumps([{'Id':image,'Config':{'Env':['BUILD_GIT_COMMIT='+source]}}]).encode()
                     for image,source in zip(images,sources)]
            argv = ['driver', '--before-image',images[0], '--after-image',images[1],
                '--before-sha',sources[0], '--after-sha',sources[1], '--cells','31:20260910,24:20260909',
                '--out',str(root/'out'), '--before-fixtures',str(root/'before'),
                '--after-fixtures',str(root/'after'), '--common-corpus',str(common), '--preflight',str(preflight)]
            with patch('sys.argv',argv), \
                    patch('run_paired_library_capacity.subprocess.check_output',side_effect=infos), \
                    patch('run_paired_library_capacity.validate_preflight'), \
                    patch('run_paired_library_capacity.platform.uname', **{'return_value._asdict.return_value': {'system':'test'}}), \
                    patch('run_paired_library_capacity.signal.signal'), \
                    patch('paired_fixture_validation.scripts_inventory',return_value={}), \
                    patch('paired_fixture_validation.compare_sets',return_value='common-hash'), \
                    patch('paired_fixture_validation.fixture_set',side_effect=[
                        {'manifest_sha256':'before-manifest'}, {'manifest_sha256':'after-manifest'},
                        RuntimeError('JobStore fixture lacks safe remaining TTL')]), \
                    patch('run_paired_library_capacity.run_arm') as run:
                with self.assertRaisesRegex(RuntimeError,'safe remaining TTL'):
                    main()
            run.assert_not_called()
            result = json.loads((root/'out/pair.json').read_text())
            self.assertEqual(result['status'],'failed')
            self.assertEqual(len(result['arms']),1)
            failed = result['arms'][0]
            self.assertEqual(failed['arm'],'r1-before-loaded')
            self.assertEqual(failed['phase'],'precheck')
            self.assertEqual(failed['status'],'failed')
            self.assertFalse(failed['measurement_invoked'])
            self.assertIn('safe remaining TTL',failed['error'])

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
            if '/search?' in path:
                return {'snapshot_id': 'fixture', 'total': 1, 'items': [{'id': 'one'}]}
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
        self.assertEqual(runtime.calls, ['/library/v1/search?q=love&limit=1', '/library/v1/health'])
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
        cmd = command('sha256:' + 'a'*64, '/scripts', '/out', '31:20260910,24:20260909', 'loaded', 'before-loaded', '/fixtures', 'owned-uuid')
        for flag in ['--pull=never','--network=none','--cpus=1','--memory=2g','--memory-swap=2g','--pids-limit=256']:
            self.assertIn(flag, cmd)
        self.assertIn('type=bind,src=/scripts,dst=/app/scripts,readonly', cmd)
        self.assertNotIn('--privileged', cmd)

    def test_nonempty_controls_and_equivalence_refuse_wrong_results(self):
        hit = {'snapshot_id':'fixture','total':1,'items':[{'id':'one'}]}
        miss = {'snapshot_id':'fixture','total':0,'items':[]}
        before = {'resident_runtime': {
            'library': {'search_result': search_evidence('library', hit)},
            'library_recovery': {'search_result': search_evidence('library_recovery', miss)}}}
        compare_searches(before, copy.deepcopy(before))
        after = copy.deepcopy(before)
        after['resident_runtime']['library']['search_result']['result_sha256'] = 'b'*64
        with self.assertRaisesRegex(RuntimeError, 'differ'):
            compare_searches(before, after)
        for key, response in [('library', miss), ('library_recovery', hit)]:
            with self.assertRaises(RuntimeError):
                search_evidence(key, response)
        self.assertTrue(all(SEARCH_QUERIES.values()))
        self.assertNotEqual(SEARCH_QUERIES['library'], SEARCH_QUERIES['library_recovery'])

    def test_timeout_and_interruption_remove_owned_container(self):
        for error in [subprocess.TimeoutExpired(['docker'], 1), KeyboardInterrupt()]:
            with patch('run_paired_library_capacity.subprocess.run', side_effect=[
                    error, subprocess.CompletedProcess([], 0, '', '')]) as run:
                with self.assertRaises(type(error)):
                    run_arm(['docker', 'run'], {}, None, 'owned-uuid')
                self.assertEqual(run.call_args_list[-1].args[0][-3:], ['rm','-f','owned-uuid'])

    def test_cleanup_failure_is_not_silently_accepted(self):
        with patch('run_paired_library_capacity.subprocess.run', side_effect=[
                subprocess.CompletedProcess([], 0),
                subprocess.CompletedProcess([], 1, '', 'daemon unavailable')]):
            with self.assertRaisesRegex(RuntimeError, 'cleanup failed'):
                run_arm(['docker', 'run'], {}, None, 'owned-uuid')

    def test_each_workload_has_repeated_reverse_order(self):
        arms = [('before-loaded','before','loaded'), ('after-loaded','after','loaded'),
                ('after-unloaded','after','unloaded')]
        rows = schedule(arms)
        self.assertEqual(len(rows), 6)
        self.assertEqual([x[1] for x in rows[:3]], [x[1] for x in rows[3:]][::-1])
        for arm, _, _ in arms:
            self.assertEqual([r for r,a,_,_ in rows if a == arm], [1,2])

    def test_preflight_rejects_unreviewed_mismatched_or_missing_identity(self):
        images = {key: {'image_id':key,'source_sha':key} for key in ('before','after')}
        record = {'status':'verified','reviewer':'review-fixture','evidence_source':'fixture-only',
                  **{key:{**value,'assets_sha256':'a'*64,'config_sha256':'b'*64,
                           'fixture_codec_sha256':'c'*64,'node_version':'22','python_version':'3.11'}
                     for key,value in images.items()}}
        validate_preflight(record, images)
        for field in ('image_id','source_sha','assets_sha256','config_sha256',
                      'fixture_codec_sha256','node_version','python_version'):
            broken = copy.deepcopy(record)
            broken['after'][field] = 'different'
            with self.assertRaises(RuntimeError):
                validate_preflight(broken, images)
        broken = copy.deepcopy(record)
        broken.pop('reviewer')
        with self.assertRaises(RuntimeError):
            validate_preflight(broken, images)

    def test_inherited_health_keeps_five_second_default_and_deadline_cap(self):
        from lyrics_capacity_runtime import ResidentRuntime, HEALTH_SECONDS
        healthy = {'service':'codex-musica-mcp', 'recovery':{'healthy':True,'durable':True},
                   'lyrics':{'ready':True}, 'build':{'node':'fixture'}}
        for remaining, expected in [(60, HEALTH_SECONDS), (2, 2)]:
            runtime = object.__new__(PairedRuntime)
            runtime._pair_deadline = remaining
            runtime.record = {}
            runtime.library_mode = 'loaded'
            with patch.object(ResidentRuntime, 'request', return_value=healthy) as request, \
                    patch('paired_library_capacity_probe.time.monotonic', return_value=0):
                runtime.health()
            self.assertEqual(request.call_args.kwargs['timeout'], expected)

    def test_explicit_search_timeout_is_preserved_and_capped(self):
        from lyrics_capacity_runtime import ResidentRuntime, LIBRARY_LOAD_SECONDS
        for remaining, explicit, expected in [(90, LIBRARY_LOAD_SECONDS, 60),
                                               (12, LIBRARY_LOAD_SECONDS, 12), (60, 3, 3)]:
            runtime = object.__new__(PairedRuntime)
            runtime._pair_deadline = remaining
            with patch.object(ResidentRuntime, 'request', return_value={}) as request, \
                    patch('paired_library_capacity_probe.time.monotonic', return_value=0):
                runtime.request('GET', '/library/v1/search?q=love&limit=1', timeout=explicit)
            self.assertEqual(request.call_args.kwargs['timeout'], expected)

    def test_mutable_image_names_are_refused(self):
        for name in ['latest','ghcr.io/x/image:tag','sha256:'+'a'*63]:
            with self.assertRaises(ValueError):
                frozen_image(name)


if __name__ == '__main__':
    unittest.main()
