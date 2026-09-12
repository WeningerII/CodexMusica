#!/usr/bin/env python3
"""Cheap adversarial checks for the production capacity qualification oracle."""
import copy
import hashlib
from pathlib import Path
from lyrics_capacity_runtime import runtime_evidence_failures, run_store_evidence_failures, queue_pressure_failures, ResidentRuntime
import re
import unittest
from unittest.mock import patch
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

    def test_a_late_receipt_from_the_observed_process_is_kept_and_a_strangers_refused(self):
        # CI run 34645027230: the old server finished the 'full' phase it was
        # inside when the request went inactive and wrote one more row after
        # the parent's last look; the restart then refused its own evidence.
        import json, tempfile
        from unittest.mock import Mock
        with tempfile.TemporaryDirectory() as tmp:
            runtime=ResidentRuntime.__new__(ResidentRuntime)
            runtime.directory=Path(tmp); runtime.child=Mock(pid=123)
            runtime.measurement_active=False; runtime.record={'queue_measurements':{}}
            evidence=queue_rows()
            (runtime.directory/'queue-pressure.json').write_text(json.dumps(evidence))
            runtime.collect_queue()
            runtime.child=Mock(pid=124)  # restarted; pid 123 is the observed one
            late=copy.deepcopy(evidence)
            late['rows'].append(copy.deepcopy(late['rows'][-1]))
            (runtime.directory/'queue-pressure.json').write_text(json.dumps(late))
            runtime.collect_queue()
            self.assertEqual(runtime.record['queue_pressure'],late)
            for tamper in (lambda e: e['rows'].__setitem__(0,{**e['rows'][0],'wall_ms':1.}),   # rewrites history
                           lambda e: e.__setitem__('server_pid',999),                          # another process
                           lambda e: e['rows'].append({**e['rows'][-1],'server_pid':999}),     # a stranger's row
                           lambda e: e.__setitem__('extra',1),                                 # a new field
                           lambda e: e['rows'].pop()):                                         # fewer rows
                foreign=copy.deepcopy(late); tamper(foreign)
                (runtime.directory/'queue-pressure.json').write_text(json.dumps(foreign))
                with self.assertRaises(RuntimeError, msg=repr(foreign)[:80]):
                    runtime.collect_queue()
                self.assertEqual(runtime.record['queue_pressure'],late)

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


class ResidentMemoryReading(unittest.TestCase):
    """The envelope is gated on what it has to HOLD, not on what the kernel
    happens to be caching (M-269). The arithmetic is small and the failure
    it prevents was a green commit going red on the next runner, so every
    branch of it is pinned: the subtraction, the shmem add-back, the fallback
    when memory.stat cannot say, and the absence of a reading at all."""

    STAT = 'anon 700000000\nfile 900000000\nkernel 50000000\nshmem 100000000\nfile_mapped 1\n'

    def test_reclaimable_file_cache_is_left_out_and_shmem_is_kept(self):
        from check_lyrics_capacity import memory_stat, resident_bytes
        stat = memory_stat(self.STAT)
        self.assertEqual(stat['file'], 900000000)
        self.assertEqual(stat['shmem'], 100000000)
        resident, current, accounting = resident_bytes(current=1_800_000_000, stat=stat)
        self.assertEqual(current, 1_800_000_000)
        self.assertEqual(resident, 1_800_000_000 - (900000000 - 100000000))
        self.assertEqual(accounting, 'current-minus-reclaimable-file')

    def test_without_memory_stat_the_reading_is_the_raw_figure_and_says_so(self):
        from check_lyrics_capacity import resident_bytes
        resident, current, accounting = resident_bytes(current=1_800_000_000, stat={})
        self.assertEqual((resident, current), (1_800_000_000, 1_800_000_000))
        self.assertEqual(accounting, 'cgroup-current')
        resident, current, accounting = resident_bytes(current=1_800_000_000, stat={'file': 5})
        self.assertEqual(accounting, 'cgroup-current')

    def test_no_cgroup_reading_is_none_not_zero(self):
        from check_lyrics_capacity import resident_bytes
        self.assertEqual(resident_bytes(current=None, stat={'file': 1, 'shmem': 0}), (None, None, 'unavailable'))

    def test_the_progress_sampler_keeps_the_largest_resident_reading(self):
        import check_lyrics_capacity as matrix
        readings = iter([(500, 900), (800, 1500), (300, 700)])
        with patch.object(matrix, 'resident_bytes', side_effect=lambda: (*next(readings), 'current-minus-reclaimable-file')):
            progress = matrix.MeasurementProgress('t')
            for _ in range(3):
                progress.sample()
        self.assertEqual(progress.resident_peak, 800)
        self.assertEqual(progress.samples, 3)
        self.assertEqual(progress.accounting, 'current-minus-reclaimable-file')


class LeakSignature(unittest.TestCase):
    """`leak_verdict` records the signature for every run and fails only the
    run that measured the whole matrix; the readings are run 34518177848's."""

    @staticmethod
    def trace(values):
        return [{'current_bytes': v} for v in values]

    POLE = [540499968, 541159424, 569827328, 628477952]
    MIDDLE = [602054656, 613978112, 644837376, 675049472, 673619968, 657092608]

    def test_a_shard_records_its_climb_and_does_not_judge_it(self):
        from check_lyrics_capacity import leak_verdict
        signature, failure = leak_verdict(self.trace(self.POLE), whole_matrix=False)
        self.assertEqual(signature, {'boundaries': 4, 'rose_at_every_boundary': True,
                                     'judged_here': False})
        self.assertIsNone(failure)

    def test_the_whole_matrix_in_one_container_still_judges_itself(self):
        from check_lyrics_capacity import LEAK_SIGNATURE, leak_verdict
        signature, failure = leak_verdict(self.trace(self.POLE), whole_matrix=True)
        self.assertTrue(signature['judged_here'])
        self.assertEqual(failure, LEAK_SIGNATURE)

    def test_one_fall_is_a_working_set_moving_around(self):
        from check_lyrics_capacity import leak_verdict
        signature, failure = leak_verdict(self.trace(self.MIDDLE), whole_matrix=True)
        self.assertFalse(signature['rose_at_every_boundary'])
        self.assertIsNone(failure)
        # ...and the same shard's first four boundaries, alone, would have
        # been called a leak: the reading that made this a coin toss.
        self.assertTrue(leak_verdict(self.trace(self.MIDDLE[:4]), whole_matrix=True)[0]
                        ['rose_at_every_boundary'])

    def test_too_few_or_missing_boundaries_say_nothing(self):
        from check_lyrics_capacity import leak_verdict
        for values in (self.POLE[:3], [1, None, 3, 4]):
            signature, failure = leak_verdict(self.trace(values), whole_matrix=True)
            self.assertFalse(signature['rose_at_every_boundary'])
            self.assertIsNone(failure)


class ShardedCapacityMerge(unittest.TestCase):
    """The merger must refuse every way three shards can fail to be one matrix.

    Sharding the matrix bought back most of a 35.6-minute step, and it gave
    away the one thing the single process had for free: a run that could not
    finish without covering every declared size. Three containers CAN finish
    while one of them never ran. So the interesting assertions here are the
    refusals, not the happy path -- a merger that only knows how to say yes
    would let CI go green on two thirds of its evidence.

    SINCE 2026-09-10 THE UNIT DEALT IS THE (lines, seed) CELL, NOT THE SIZE
    (M-268), so the fixtures below are shards of cells and the refusals
    include the shapes only a cell deal can take: a cell measured twice by
    two shards that each look complete, a shard measuring a cell it did not
    declare, and a one-cell shard -- in which the leak signature, needing four
    boundaries, never ran at all.
    """

    @staticmethod
    def shard(cells, **over):
        from check_lyrics_capacity import LIMITS, MODES, SEEDS
        cells = [tuple(c) for c in cells]
        return {**{
            'version': 1, 'status': 'passed', 'production_qualified': False,
            'local_supplement': False, 'sizes': sorted({size for size, _ in cells}),
            'seeds': list(SEEDS), 'cells': [list(c) for c in cells],
            'scope': 'resource capacity with explicit refusal accounting; not lyric-quality certification',
            'limits': LIMITS, 'isolation': {'production_limits_verified': True},
            'published_execution_limits': {'max_lines': 31},
            'measurements': [{'lines': size, 'seed': seed, 'mode': mode, 'rows': []}
                             for size, seed in cells for mode in MODES],
            'memory_trace': [{'lines': size, 'seed': seed, 'mode': mode,
                              'peak_bytes': 1000, 'current_bytes': 900}
                             for size, seed in cells for mode in MODES],
            'summaries': [], 'failures': [],
            'leak_signature': {'boundaries': len(cells) * len(MODES),
                               'rose_at_every_boundary': False, 'judged_here': False},
            'source_sha256': 'a' * 64, 'source_sha256_after': 'a' * 64,
        }, **over}

    @staticmethod
    def deal():
        """The deal ci.yml runs, read from ci.yml -- so the fixture and the
        workflow cannot drift apart (doctrine 1)."""
        text = Path(__file__).resolve().parents[1].joinpath(
            '.github', 'workflows', 'ci.yml').read_text(encoding='utf-8')
        from check_lyrics_capacity import parse_cells
        found = re.findall(r'^\s*shard\s+(\S+)\s+(\S+)\s+&', text, re.M)
        return [(name, parse_cells(spec)) for spec, name in found]

    def complete(self):
        return [(f'capacity-{name}.json', self.shard(cells)) for name, cells in self.deal()]

    def test_the_workflow_deals_every_cell_exactly_once_across_at_least_two_cells_each(self):
        """ci.yml's own deal, before any run: nine cells, once each, no
        one-cell shard. A deal that dropped a cell would still merge green
        for every OTHER reason, so this is the check that reads the deal."""
        from check_lyrics_capacity import CELLS
        deal = self.deal()
        self.assertGreaterEqual(len(deal), 2, 'ci.yml declares no `shard <cells> <name> &` lines')
        dealt = [cell for _, cells in deal for cell in cells]
        self.assertEqual(sorted(dealt), sorted(CELLS))
        for name, cells in deal:
            self.assertGreaterEqual(len(cells), 2, f'{name} measures one cell; the leak signature could not run')
        self.assertEqual(len({name for name, _ in deal}), len(deal))

    def test_a_complete_consistent_matrix_qualifies(self):
        from merge_lyrics_capacity import merge
        from check_lyrics_capacity import CELLS, MODES
        report, failures = merge(self.complete())
        self.assertEqual(failures, [])
        self.assertTrue(report['production_qualified'])
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(len(report['measurements']), len(CELLS) * len(MODES))
        self.assertEqual(sorted(map(tuple, report['cells'])), sorted(CELLS))
        # Never copied from a shard: no shard can be qualified alone, and each
        # one sets this False for exactly that reason.
        self.assertFalse(any(s['production_qualified'] for _, s in self.complete()))

    def test_summaries_are_derived_once_over_the_union(self):
        """A size whose seeds sit in two shards gets ONE row per (mode, verb),
        from the same function a single process uses -- not one partial row
        per shard, which is what concatenating shard summaries would give."""
        from merge_lyrics_capacity import merge
        from check_lyrics_capacity import SIZES, MODES, summarize_measurements
        report, failures = merge(self.complete())
        self.assertEqual(failures, [])
        keys = [(r['lines'], r['mode'], r['verb']) for r in report['summaries']]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(sorted({k[0] for k in keys}), sorted(SIZES))
        self.assertEqual(len(keys), len(SIZES) * len(MODES) * 2)
        self.assertEqual(report['summaries'], summarize_measurements(report['measurements']))

    def test_every_way_three_shards_fail_to_be_one_matrix_is_refused(self):
        """Every case names the FAILURE it is refused for, and asserts that
        one -- not merely "some failure". A case refused by an unrelated
        check would otherwise pin nothing: the review of 2026-09-10 found
        two of the merger's cell guards with no case that reached them,
        because the coverage check fired first on the shape meant for them.
        """
        from merge_lyrics_capacity import merge
        from check_lyrics_capacity import CELLS
        first_cell = tuple(self.complete()[0][1]['cells'][0])

        def relabel(s, **change):
            """The last shard, cells intact, its FIRST measurement mislabelled."""
            name, shard = s[-1]
            measurements = [dict(m, **change) if i == 0 else m
                            for i, m in enumerate(shard['measurements'])]
            return s[:-1] + [(name, {**shard, 'measurements': measurements})]

        def move_one(s):
            """One execution (and its boundary) moved from the first shard to
            the last: 18 executions overall, distinct, every cell covered --
            and two shards whose counts do not match their cells."""
            (a_name, a), (z_name, z) = s[0], s[-1]
            moved, moved_trace = a['measurements'][0], a['memory_trace'][0]
            a2 = {**a, 'measurements': a['measurements'][1:], 'memory_trace': a['memory_trace'][1:]}
            z2 = {**z, 'measurements': z['measurements'] + [moved],
                  'memory_trace': z['memory_trace'] + [moved_trace]}
            return [(a_name, a2)] + s[1:-1] + [(z_name, z2)]

        cases = {
            'a missing shard': (lambda s: s[:-1], 'each exactly once'),
            'a duplicated shard': (lambda s: s + [(s[0][0].replace('.json', '-again.json'), s[0][1])],
                                   'each exactly once'),
            'a cell dealt to two shards': (lambda s: s[:-1] + [
                (s[-1][0], self.shard(s[-1][1]['cells'] + [list(first_cell)]))], 'each exactly once'),
            'a shard whose cells are not declared': (lambda s: s[:-1] + [
                (s[-1][0], self.shard(s[-1][1]['cells'][:-1] + [[99, 20260908]]))],
                'are not cells of the declared matrix'),
            'a shard declaring no cells': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'cells': []})], 'declares no cells'),
            'a shard without the cells field': (lambda s: s[:-1] + [
                (s[-1][0], {k: v for k, v in s[-1][1].items() if k != 'cells'})], 'declares no cells'),
            'a shard that declares fewer cells than it measured': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'cells': s[-1][1]['cells'][:-1]})],
                'outside the cells it declares'),
            'a measurement at a size outside its declared cells': (
                lambda s: relabel(s, lines=99), 'outside the cells it declares'),
            'a measurement at a seed outside its declared cells': (
                lambda s: relabel(s, seed=1), 'outside the cells it declares'),
            'a measurement in a mode nobody declared': (
                lambda s: relabel(s, mode='hot'), 'outside the cells it declares'),
            'two shards whose counts do not match their cells': (move_one, 'executions for'),
            'shards agreeing on seeds nobody declared': (lambda s: [
                (name, {**shard, 'seeds': [1, 2, 3]}) for name, shard in s], 'are not the declared'),
            'a shard whose sizes do not describe its cells': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'sizes': [99]})], 'do not describe its cells'),
            'a one-cell shard, in which the leak signature never ran': (lambda s: [
                (f'capacity-{i}.json', self.shard([cell])) for i, cell in enumerate(CELLS)],
                'could not have run'),
            'no shards at all': (lambda s: [], 'no capacity shards'),
            'a shard that did not pass': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'status': 'failed'})], "not 'passed'"),
            'a shard carrying a failure': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'failures': ['excessive call latency']})],
                'excessive call latency'),
            'a --local supplement': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'local_supplement': True})], 'cannot qualify production'),
            'unverified cgroup limits': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'isolation': {'production_limits_verified': False}})],
                'cgroup limits'),
            'a shard that measured a different tree': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'source_sha256': 'b' * 64,
                            'source_sha256_after': 'b' * 64})], 'did not measure one runtime'),
            'source that moved mid-shard': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'source_sha256_after': 'c' * 64})],
                'changed during the shard'),
            'a shard that skipped executions': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'measurements': s[-1][1]['measurements'][:1]})],
                'executions across the shards'),
            'a shard with no memory trace at all': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'memory_trace': []})], 'does not cover its own executions'),
            'a trace that misses a boundary': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1],
                            'memory_trace': s[-1][1]['memory_trace'][:-1]})],
                'does not cover its own executions'),
            'shards disagreeing about the declared limits': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'limits': {'call_seconds': 9999}})], 'limits differs from'),
            'a shard that never recorded the leak signature': (lambda s: s[:-1] + [
                (s[-1][0], {k: v for k, v in s[-1][1].items() if k != 'leak_signature'})],
                'did not evaluate the leak signature'),
            'a signature over fewer boundaries than the rule needs': (lambda s: s[:-1] + [
                (s[-1][0], {**s[-1][1], 'leak_signature': {
                    'boundaries': 3, 'rose_at_every_boundary': False, 'judged_here': False}})],
                'did not evaluate the leak signature'),
            'resident memory rising at every boundary in every shard': (lambda s: [
                (name, {**shard, 'leak_signature': {**shard['leak_signature'],
                                                    'rose_at_every_boundary': True}})
                for name, shard in s], 'in every shard'),
        }
        for label, (break_it, needle) in cases.items():
            with self.subTest(label):
                report, failures = merge(break_it(self.complete()))
                self.assertTrue(failures, f'{label} was accepted')
                self.assertTrue(any(needle in f for f in failures),
                                f'{label} was refused, but not for {needle!r}: {failures}')
                self.assertFalse(report.get('production_qualified'),
                                 f'{label} still reported production_qualified')

    def test_a_climb_in_one_shard_is_a_working_set_and_not_a_leak(self):
        """M-272: the strict rule was written for 18 boundaries in one
        container. A shard has as few as four, and run 34518177848's pole
        shard rose through all four of them while its middle shard rose
        through its first four and then fell twice. A leak is a property of
        the runtime, so it shows in EVERY shard; one shard's climb, with
        another shard falling, qualifies. Every shard climbing does not (the
        refusal list holds that case)."""
        from merge_lyrics_capacity import merge
        shards = self.complete()
        name, pole = shards[0]
        shards[0] = (name, {**pole, 'leak_signature': {**pole['leak_signature'],
                                                       'rose_at_every_boundary': True}})
        report, failures = merge(shards)
        self.assertEqual(failures, [])
        self.assertTrue(report['production_qualified'])
        self.assertEqual(report['leak_signature_rising_in'], [name])

    def test_the_cell_coordinate_refuses_what_is_not_a_declared_cell(self):
        from check_lyrics_capacity import parse_cells, CELLS, SIZES, SEEDS
        self.assertEqual(parse_cells('31:20260910,18:20260908'), ((31, 20260910), (18, 20260908)))
        self.assertEqual(sorted(parse_cells(','.join(f'{a}:{b}' for a, b in CELLS))), sorted(CELLS))
        for bad in ('', '31', '31:', ':20260910', '31:20260910,31:20260910', '32:20260910',
                    f'{SIZES[0]}:1', '31-20260910', 'x:y'):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                parse_cells(bad)
        self.assertEqual(len(CELLS), len(SIZES) * len(SEEDS))

    def test_the_merger_reads_the_population_from_where_it_is_declared(self):
        """Not a retyped 18,24,31 -- the matrix and its merger cannot disagree."""
        import check_lyrics_capacity as matrix
        import merge_lyrics_capacity as merger
        self.assertIs(merger.SIZES, matrix.SIZES)
        self.assertIs(merger.SEEDS, matrix.SEEDS)
        self.assertIs(merger.CELLS, matrix.CELLS)
        self.assertIs(merger.LIMITS, matrix.LIMITS)
        self.assertEqual(merger.EXPECTED_EXECUTIONS,
                         len(matrix.SIZES) * len(matrix.SEEDS) * 2)


if __name__ == '__main__':
    unittest.main()
