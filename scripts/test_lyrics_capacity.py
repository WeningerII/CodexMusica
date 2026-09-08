#!/usr/bin/env python3
"""Cheap adversarial checks for the production capacity qualification oracle."""
import copy
import hashlib
from lyrics_capacity_runtime import runtime_evidence_failures, run_store_evidence_failures, queue_pressure_failures, ResidentRuntime
import unittest
from check_lyrics_capacity import validate_measurement, percentile, terminate_measurement, MeasurementProgress
from measure_verb_memory import _checkpoint_valid, _machine_result, CONTROL_TOKEN, assessment_coverage_valid


def measured(mode='cold'):
    rows = [dict(verb=v, exit_code=0, wall_s=1., peak_mb=400., retained_mb=300., typed=True, authenticated=True, machine_status='planned') for v in ('plan', 'fill')]
    for i in range(3 if mode == 'worker' else 1):
        rows += [dict(verb='grade', exit_code=3, wall_s=30., peak_mb=700., retained_mb=500.+i*10, typed=True, authenticated=True, quality_certified=False,
                      stop='graded', machine_status='graded', coverage={'scope':'requested_layers','pairs_mandated':1,'pairs_judged':0,'pairs_refused':1,'certified':False,'obligations':[{'id':'rhyme:1:2','status':'refused'}],'refused_obligations': ['rhyme:1:2']}, refusals=1),
                 dict(verb='revise', exit_code=4, wall_s=40., peak_mb=700., retained_mb=600.+i*10, typed=True, authenticated=True,
                      stop='needs_proposal', machine_status='suspended', checkpoint_present=True, checkpoint_valid=True)]
    return {'version': 1, 'ok': True, 'seed': 20260908, 'lines': 24,
            'mode': mode, 'rounds': 3 if mode == 'worker' else 1, 'rows': rows,
            'growth_mb': 20., 'peak_mb': 700., 'residual_mb': 620., 'round_retained_mb': [600.,610.,620.]}


def retained_runs():
    return dict(pid=123,probes=2,records=64,max_records=64,
        worker_bytes_min=458751,worker_bytes_max=458751,worker_max_bytes=458752,
        declaration_bytes_min=32767,declaration_max_bytes=32768,
        state_wire_bytes=28000000,checkpoint_wire_bytes=28000000,
        draft_bytes=12000000,declaration_bytes=2097088,
        max_lines_per_draft=447,max_chars_per_line=200,all_codec_roundtrips_verified=True,
        queue=dict(maxAdmitted=16,maxInputBytes=33554432,admitted=0,admittedBytes=0,
                   queued=0,active=False,exercised=False))


def queue_rows():
    rows = []
    for phase in ('count', 'bytes', 'full'):
        count = 15 if phase == 'bytes' else 16
        size = 16384 if phase == 'count' else 33554432
        idle = dict(maxAdmitted=16,maxInputBytes=33554432,admitted=0,admittedBytes=0,queued=0,active=False)
        memory = dict(rss=180000000,heapTotal=64000000,heapUsed=29000000,external=73000000,
                      arrayBuffers=2000000,cgroup_current=1200000000,cgroup_peak=1300000000)
        rows.append(dict(version=1,phase=phase,request_id='24/20260908/cold',server_pid=123,
            instrument_pid=456,instrument_alive=True,instrument_children=[dict(pid=789,kind='cli-song',rss=700000000)],
            wall_ms=450.,initial=idle.copy(),after=idle.copy(),
            retained={**idle,'admitted':count,'admittedBytes':size,'queued':count-1,'active':True},
            payload_count=count,payload_bytes=size,distinct_payloads=count,overflow_input_bytes=10,
            overflow=dict(code='PYTHON_BUSY',path='busy',busy=True,retryable=True),
            settled=count,cancelled=count,spawn_calls=0,worker_pid_after=None,
            memory_before=memory.copy(),memory_retained=memory.copy(),memory_after=memory.copy()))
    return dict(version=1,server_pid=123,rows=rows)


def queue_measurements():
    return {'24/20260908/cold': {'server_pid':123,'instrument_pid':456}}


class CapacityOracle(unittest.TestCase):
    def test_progress_exposes_captured_work_before_completion_without_certifying_it(self):
        import io
        from contextlib import redirect_stdout
        from unittest.mock import patch
        output = io.StringIO()
        with patch('check_lyrics_capacity.time.monotonic', side_effect=[0, 5, 30, 60, 61]), \
             patch('check_lyrics_capacity.read', return_value=None), redirect_stdout(output):
            progress = MeasurementProgress('31/20260910/worker')
            progress.emit(b'worker call=1 completed\n')
            self.assertEqual(output.getvalue(), '')
            progress.emit(b'worker call=1 completed\n')
            self.assertIn('worker call=1 completed', output.getvalue())
            progress.emit(b'worker call=1 completed\nworker call=2 started\n')
            progress.emit('worker call=1 completed\nworker call=2 started\n', final=True)
        text = output.getvalue()
        self.assertEqual(text.count('worker call=1 completed'), 1)
        self.assertEqual(text.count('worker call=2 started'), 1)
        self.assertIn('elapsed=60.0s', text)
        self.assertIn('cgroup_cpu_usec=unavailable', text)
        self.assertIn('exited; validation pending', text)
        self.assertNotIn('passed', text)

    def test_actual_queue_boundaries_require_complete_independent_proof(self):
        good = queue_rows()
        self.assertEqual(queue_pressure_failures(good,queue_measurements()), [])
        for patch in ({'server_pid':999},{'instrument_pid':999},{'instrument_alive':False},
                      {'spawn_calls':1},{'spawn_calls':False},{'worker_pid_after':1},
                      {'settled':15},{'cancelled':15},{'distinct_payloads':1},
                      {'overflow':{}},{'wall_ms':float('nan')},{'wall_ms':5001},
                      {'request_id':[]},{'payload_bytes':True}):
            broken=copy.deepcopy(good); broken['rows'][0].update(patch)
            self.assertTrue(queue_pressure_failures(broken,queue_measurements()),patch)
        for index, patch in ((0,{'admittedBytes':33554432}),(1,{'admitted':16}),
                             (2,{'admittedBytes':33554431})):
            broken=copy.deepcopy(good); broken['rows'][index]['retained'].update(patch)
            self.assertTrue(queue_pressure_failures(broken,queue_measurements()),patch)
        broken=copy.deepcopy(good); broken['rows'][0]['after']['admitted']=1
        self.assertTrue(queue_pressure_failures(broken,queue_measurements()))
        broken=copy.deepcopy(good); broken['rows'].pop()
        self.assertTrue(queue_pressure_failures(broken,queue_measurements()))
        expected=queue_measurements(); expected['31/20260908/worker']={'server_pid':123,'instrument_pid':789}
        self.assertTrue(queue_pressure_failures(good,expected))

    def test_queue_memory_is_measured_and_component_is_not_combined_evidence(self):
        for key in ('rss','heapTotal','heapUsed','external','arrayBuffers','cgroup_current','cgroup_peak'):
            for invalid in (None,True,float('nan')):
                broken=queue_rows(); broken['rows'][2]['memory_retained'][key]=invalid
                self.assertTrue(queue_pressure_failures(broken,queue_measurements()),(key,invalid))
        component=queue_rows()
        for row in component['rows']:
            row.update(instrument_pid=None,instrument_alive=False)
            for phase in ('memory_before','memory_retained','memory_after'):
                row[phase].update(cgroup_current=None,cgroup_peak=None)
        self.assertEqual(queue_pressure_failures(component,queue_measurements(),local=True,isolated=True),[])
        self.assertTrue(queue_pressure_failures(component,queue_measurements(),local=True))
        self.assertTrue(queue_pressure_failures(component,queue_measurements(),isolated=True))
        for children in (None,[],[dict(pid=789,kind='other',rss=700000000)],
                         [dict(pid=789,kind='worker',rss=float('nan'))],
                         [dict(pid=789,kind='worker',rss=700000000),dict(pid=790,kind='worker',rss=700000000)]):
            broken=queue_rows()
            for row in broken['rows']:
                row['instrument_children']=children
            self.assertTrue(queue_pressure_failures(broken,queue_measurements()),children)

    def test_queue_control_uses_parent_owned_process_and_preserves_restart_evidence(self):
        import json, tempfile
        from pathlib import Path
        from unittest.mock import Mock
        with tempfile.TemporaryDirectory() as tmp:
            runtime=ResidentRuntime.__new__(ResidentRuntime)
            runtime.directory=Path(tmp); runtime.child=Mock(pid=123)
            runtime.measurement_active=False; runtime.record={'queue_measurements':{}}
            proc=Mock(pid=456); proc.poll.return_value=None
            identity='24/20260908/cold'
            runtime.begin_measurement(identity,proc)
            self.assertEqual(json.loads((runtime.directory/'queue-request.json').read_text()),
                             {'id':identity,'active':True,'instrument_pid':456})
            with self.assertRaises(RuntimeError):
                runtime.begin_measurement(identity,proc)
            evidence=queue_rows()
            (runtime.directory/'queue-pressure.json').write_text(json.dumps(evidence))
            runtime.end_measurement()
            self.assertFalse(runtime.measurement_active)
            self.assertEqual(runtime.record['queue_measurements'],queue_measurements())
            self.assertEqual(runtime.record['queue_pressure'],evidence)
            runtime.child=Mock(pid=124)  # recovery preserves previously observed evidence
            runtime.collect_queue()
            evidence['rows'][0]['server_pid']=999
            (runtime.directory/'queue-pressure.json').write_text(json.dumps(evidence))
            with self.assertRaises(RuntimeError):
                runtime.collect_queue()

    def test_final_probe_after_instrument_exit_cannot_supply_overlap(self):
        good=queue_rows()
        final=copy.deepcopy(good['rows'][-1]); final['instrument_alive']=False
        good['rows'].append(final)
        self.assertEqual(queue_pressure_failures(good,queue_measurements()),[])
        good['rows']=good['rows'][:2]+[final]
        self.assertTrue(queue_pressure_failures(good,queue_measurements()))

    def test_live_run_cache_must_reach_its_declared_load(self):
        self.assertEqual(run_store_evidence_failures(retained_runs()), [])
        for patch in ({'records':63},{'records':float('nan')},{'worker_bytes_min':1},
                      {'worker_bytes_max':500000},{'declaration_bytes_min':1},
                      {'all_codec_roundtrips_verified':False},{'state_wire_bytes':0},
                      {'checkpoint_wire_bytes':None},{'queue':{}}):
            broken=retained_runs(); broken.update(patch)
            self.assertTrue(run_store_evidence_failures(broken), patch)
        broken=retained_runs(); broken['queue']['active']=True
        self.assertTrue(run_store_evidence_failures(broken))

    def test_valid_complete_control(self):
        for mode in ('cold', 'worker'):
            self.assertEqual(validate_measurement(measured(mode)), [])
        self.assertEqual(percentile([10, 20, 30], .95), 30)
        self.assertIsNone(percentile([], .95))

    def test_missing_grade_or_repair_is_not_capacity(self):
        for verb in ('grade', 'revise'):
            value = measured()
            value['rows'] = [r for r in value['rows'] if r['verb'] != verb]
            self.assertTrue(validate_measurement(value))

    def test_journal_and_real_exit_required(self):
        for patch in ({'checkpoint_valid': False}, {'exit_code': 2}):
            value = measured()
            value['rows'][3].update(patch)
            self.assertTrue(validate_measurement(value))
        value = measured()
        value['ok'] = False
        self.assertTrue(validate_measurement(value))

    def test_declared_peak_wall_and_retained_growth(self):
        for field, bad in [('peak_mb', 1792.01), ('wall_s', 600.01),
                           ('wall_s', float('nan')), ('peak_mb', None)]:
            value = measured()
            value['rows'][2][field] = bad
            self.assertTrue(validate_measurement(value))
        value = measured('worker')
        value['growth_mb'] = 128.01
        self.assertTrue(validate_measurement(value))

    def test_unknown_modes_and_boolean_measurements_fail(self):
        value = measured()
        value['mode'] = 'unknown'
        self.assertTrue(validate_measurement(value))
        for field in ('wall_s', 'peak_mb'):
            value = measured()
            value['rows'][2][field] = True
            self.assertTrue(validate_measurement(value))

    def test_no_memory_or_status_can_be_inferred_from_exit(self):
        for key, value in [('typed', False), ('machine_status', 'journal_capacity'), ('coverage', None), ('refusals', 0)]:
            result = measured()
            result['rows'][2][key] = value
            self.assertTrue(validate_measurement(result))
        for value in (None, 0, True, float('nan')):
            result = measured('worker')
            result['rows'][3]['retained_mb'] = value
            self.assertTrue(validate_measurement(result))
        result = measured('worker')
        result['round_retained_mb'] = [600., 900., 620.]
        result['rows'][5]['retained_mb'] = 900.
        self.assertTrue(validate_measurement(result))
        result = measured()
        result['rows'][3].update(exit_code=3, stop='uncertified', machine_status='finished')
        self.assertTrue(validate_measurement(result))  # never reached deferred proposal

    def test_completed_unjudgeable_grade_is_capacity_but_not_quality(self):
        result = measured()
        result['rows'][2]['exit_code'] = 2
        self.assertEqual(validate_measurement(result), [])
        self.assertIs(result['rows'][2]['quality_certified'], False)
        for patch in ({'machine_status':'refused'}, {'authenticated':False}, {'coverage':{}}, {'quality_certified':True}):
            broken=copy.deepcopy(result); broken['rows'][2].update(patch)
            self.assertTrue(validate_measurement(broken))
        broken=copy.deepcopy(result); broken['rows'][2]['coverage']['pairs_judged']=1
        self.assertTrue(validate_measurement(broken))
        import json
        self.assertEqual(_machine_result('  lyric result: '+json.dumps({'version':1,'status':'graded','transport_token':'wrong'})), {})
        self.assertEqual(_machine_result('  lyric result: '+json.dumps({'version':1,'status':'graded','transport_token':CONTROL_TOKEN}))['status'], 'graded')

    def test_python_component_cannot_qualify_combined_runtime(self):
        good = dict(startup_ok=True, recovery_ok=True, signing_key_stable=True, server_stopped=True,
                    lazy_bridge_verified=True, errors=[], probe_count=6, replays=2, catalog_reads=2,
                    concurrent_replays=1, startup_s=3., recovery_s=11., peak_rss_mib=800.,
                    node_version='v22.23.2', receipts={'bytes':250.,'max_bytes':256.},
                    run_store=retained_runs(),queue_pressure=queue_rows(),queue_measurements=queue_measurements())
        self.assertEqual(runtime_evidence_failures(good), [])
        for patch in ({'lazy_bridge_verified':False},{'startup_ok':False},{'recovery_ok':False},
                      {'concurrent_replays':0},{'peak_rss_mib':None},{'peak_rss_mib':float('nan')},
                      {'startup_s':float('nan')},{'recovery_s':31.},{'signing_key_stable':False},
                      {'server_stopped':False},{'node_version':'v24.1.0'},
                      {'queue_pressure':{}},{'queue_measurements':{}},
                      {'errors':['resident server died']},{'receipts':{'bytes':1,'max_bytes':256}}):
            broken=copy.deepcopy(good); broken.update(patch)
            self.assertTrue(runtime_evidence_failures(broken), patch)
        self.assertTrue(runtime_evidence_failures({}))

    def test_owned_process_groups_close_on_cancellation_and_leader_exit(self):
        import subprocess, sys, signal
        from unittest.mock import Mock, patch, call
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'],
                                 start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            terminate_measurement(child)
            self.assertEqual(child.returncode, -signal.SIGKILL)
            self.assertTrue(child.stdout.closed and child.stderr.closed)
        finally:
            if child.poll() is None:
                child.kill(); child.wait(timeout=5)
        runtime = ResidentRuntime.__new__(ResidentRuntime)
        runtime.child = Mock(pid=12345)
        runtime.child.poll.return_value = 0  # leader exited; group can still have children
        runtime.group_open = True
        runtime.log = None
        with patch('lyrics_capacity_runtime.os.killpg') as kill:
            runtime.stop_child()
            self.assertEqual(kill.call_args_list, [call(12345,signal.SIGTERM),call(12345,signal.SIGKILL)])
            runtime.stop_child()
            self.assertEqual(kill.call_count, 2)  # never signal a later reused group ID
        preparer = Mock(pid=12346)
        preparer.communicate.side_effect = SystemExit(143)
        with patch('lyrics_capacity_runtime.subprocess.Popen', return_value=preparer), \
             patch('lyrics_capacity_runtime.os.killpg') as kill:
            with self.assertRaises(SystemExit):
                runtime._prepare(['unused'])
            kill.assert_called_once_with(12346,signal.SIGKILL)
            preparer.wait.assert_called_once()
            preparer.stdout.close.assert_called_once()
            preparer.stderr.close.assert_called_once()

    def test_pending_requires_real_record_and_draft(self):
        machine = dict(status='suspended', exit=4, plan_lines=2)
        state = dict(version=1, accepted_lines=['my stone','your home'], answered={'propose': [], 'propose_group': []},
                     pending=dict(kind='propose', record={'line':1, 'draft':hashlib.md5(b'my stone\nyour home').hexdigest()[:12]}, prompt='write the line', answer=None))
        self.assertTrue(_checkpoint_valid(state,4,machine,2))
        for field,value in [('kind','made_up'), ('record',{}), ('answer','already answered')]:
            broken=copy.deepcopy(state); broken['pending'][field]=value
            self.assertFalse(_checkpoint_valid(broken,4,machine,2))
        self.assertFalse(_checkpoint_valid(state,4,{},2))
        self.assertFalse(_checkpoint_valid(state,4,machine,24))
        self.assertEqual(_machine_result('exit 3 but no result'), {})

    def test_worker_requires_all_declared_rounds(self):
        value = measured('worker')
        value['rows'] = copy.deepcopy(value['rows'][:2])
        self.assertTrue(validate_measurement(value))


if __name__ == '__main__':
    unittest.main()
