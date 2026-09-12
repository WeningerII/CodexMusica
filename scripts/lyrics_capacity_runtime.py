#!/usr/bin/env python3
"""Actual resident Node/JobStore load around the maintained Python matrix.

One heavy Python worker belongs to the measurement instrument. This server's
bridge stays lazy: real queue-pressure requests are cancelled before execution;
MCP catalog reads and exact completed-receipt replay run over HTTP. No provider
call and no second warm Python worker are needed. Queued execution throughput
is a separate workload from admission, retention, overflow and cleanup.
"""
import hashlib
import atexit
import http.client
import json
import math
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
STARTUP_SECONDS = 30
HEALTH_SECONDS = 5
REPLAY_SECONDS = 10
STOP_SECONDS = 5


def _proc_memory(pid):
    values = {}
    try:
        for line in Path(f'/proc/{pid}/status').read_text().splitlines():
            if line.startswith(('VmRSS:', 'VmHWM:')):
                values[line.split(':')[0]] = int(line.split()[1]) / 1024
    except OSError:
        pass
    return values


def _direct_children(pid):
    try:
        return Path(f'/proc/{pid}/task/{pid}/children').read_text().split()
    except OSError:
        return None


def run_store_evidence_failures(record):
    """Actual retained cache load, independent of successful HTTP startup."""
    failures = []
    def positive_int(key):
        return type(record.get(key)) is int and record[key] > 0
    keys = ('pid', 'probes', 'records', 'max_records', 'worker_bytes_min',
            'worker_bytes_max', 'worker_max_bytes', 'declaration_bytes_min',
            'declaration_max_bytes', 'state_wire_bytes', 'checkpoint_wire_bytes',
            'draft_bytes', 'declaration_bytes', 'max_lines_per_draft', 'max_chars_per_line')
    if not all(positive_int(key) for key in keys):
        return ['actual RunStore load has missing or invalid measurements']
    if record['records'] != record['max_records']:
        failures.append('actual RunStore did not retain its declared record cap')
    if not .99 * record['worker_max_bytes'] <= record['worker_bytes_min'] <= record['worker_bytes_max'] <= record['worker_max_bytes']:
        failures.append('retained worker payloads did not reach their declared decoded ceiling')
    if not .99 * record['declaration_max_bytes'] <= record['declaration_bytes_min'] <= record['declaration_max_bytes']:
        failures.append('retained declarations did not reach their declared byte ceiling')
    if record.get('all_codec_roundtrips_verified') is not True:
        failures.append('retained cache payloads have no codec roundtrip proof')
    queue = record.get('queue', {})
    if (any(type(queue.get(key)) is not int or queue[key] <= 0 for key in ('maxAdmitted', 'maxInputBytes'))
            or any(type(queue.get(key)) is not int or queue[key] != 0 for key in ('admitted', 'admittedBytes', 'queued'))
            or queue.get('active') is not False or queue.get('exercised') is not False):
        failures.append('idle bridge queue limits or snapshot scope are missing/inconsistent')
    return failures


def queue_pressure_failures(record, expected, *, local=False, isolated=False):
    """Require each declared measurement's actual independent queue boundaries.

    ``expected`` comes from the parent-owned processes, not the producer's rows.
    Isolated component evidence deliberately cannot establish grader overlap.
    """
    def integer(value, minimum=0):
        return type(value) is int and value >= minimum
    def number(value, minimum=0):
        return type(value) in (int, float) and math.isfinite(value) and value >= minimum
    if (not isinstance(record, dict) or record.get('version') != 1 or
            not isinstance(record.get('rows'), list) or not isinstance(expected, dict) or not expected or
            any(not isinstance(identity, str) or not isinstance(owner, dict) or
                not integer(owner.get('server_pid'), 1) or
                (not isolated and not integer(owner.get('instrument_pid'), 1))
                for identity, owner in expected.items())):
        return ['actual queue-pressure evidence or measurement inventory is missing']
    failures, found, loaded = [], set(), set()
    for row in record['rows']:
        if not isinstance(row, dict):
            failures.append('queue-pressure row is not an object'); continue
        identity = row.get('request_id')
        if not isinstance(identity, str) or identity not in expected:
            failures.append('queue-pressure row names an unmeasured workload'); continue
        phase = row.get('phase')
        if phase not in ('count', 'bytes', 'full'):
            failures.append('queue-pressure phase is unknown'); continue
        owner = expected[identity]
        if (row.get('version') != 1 or not integer(row.get('server_pid'), 1) or
                row['server_pid'] != owner['server_pid'] or
                (not isolated and (row.get('instrument_pid') != owner['instrument_pid'] or
                 not integer(row.get('instrument_pid'), 1) or type(row.get('instrument_alive')) is not bool))):
            failures.append('queue-pressure process identity or actual overlap is unproved')
        # An instrument may finish during a final retention probe. Keep its
        # actual memory/cleanup evidence, but it cannot prove overlap. Each
        # required phase must separately have an observed live instrument.
        if isolated or row.get('instrument_alive') is True:
            found.add((identity, phase))
        children = row.get('instrument_children')
        if children is not None:
            if (not isinstance(children, list) or any(not isinstance(child, dict) or
                    not integer(child.get('pid'), 1) or not number(child.get('rss'), 1) or
                    child.get('kind') not in ('cli-song', 'cli-finish', 'worker', 'other')
                    for child in children)):
                failures.append('instrument child process measurements are invalid')
            else:
                lyric_children = [child for child in children if child['kind'] != 'other']
                if len(lyric_children) > 1:
                    failures.append('queue pressure overlapped duplicate heavy lyric processes')
                if phase == 'full' and row.get('instrument_alive') is True and len(lyric_children) == 1:
                    loaded.add(identity)
        initial, retained, after = (row.get(key, {}) for key in ('initial', 'retained', 'after'))
        limits = ('maxAdmitted', 'maxInputBytes')
        if any(not isinstance(value, dict) for value in (initial, retained, after)):
            failures.append('queue-pressure capacity snapshots are invalid'); continue
        if (any(not integer(initial.get(key), 1) for key in limits) or
                initial.get('maxAdmitted', 0) < 2 or
                any(value.get(key) != initial[key] for value in (retained, after) for key in limits)):
            failures.append('queue-pressure admission limits are missing or changed'); continue
        if any(not integer(value.get(key)) or value[key] != 0
               for value in (initial, after) for key in ('admitted', 'admittedBytes', 'queued')) or \
                any(value.get('active') is not False for value in (initial, after)):
            failures.append('actual bridge was not idle before pressure and fully cleaned afterward')
        count, size = row.get('payload_count'), row.get('payload_bytes')
        overflow_size = row.get('overflow_input_bytes')
        if (not integer(count, 1) or not integer(size, 1) or not integer(overflow_size, 1) or
                retained.get('admitted') != count or retained.get('admittedBytes') != size or
                retained.get('queued') != count - 1 or retained.get('active') is not True or
                any(not integer(retained.get(key)) for key in ('admitted', 'admittedBytes', 'queued')) or
                not integer(row.get('distinct_payloads')) or row['distinct_payloads'] != count):
            failures.append('actual retained queue payload count/bytes are unproved'); continue
        max_count, max_size = initial['maxAdmitted'], initial['maxInputBytes']
        if ((phase == 'count' and not (count == max_count and size + overflow_size <= max_size)) or
                (phase == 'bytes' and not (count == max_count - 1 and size == max_size)) or
                (phase == 'full' and not (count == max_count and size == max_size))):
            failures.append('queue count and byte limits were not exercised independently and together')
        if (row.get('overflow') != {'code': 'PYTHON_BUSY', 'path': 'busy', 'busy': True, 'retryable': True} or
                any(not integer(row.get(key)) or row[key] != count for key in ('settled', 'cancelled')) or
                type(row.get('spawn_calls')) is not int or row['spawn_calls'] != 0 or
                row.get('worker_pid_after', 'missing') is not None):
            failures.append('actual overflow refusal, cancellation or zero-child cleanup is unproved')
        if not number(row.get('wall_ms')) or row['wall_ms'] > 5000:
            failures.append('queue-pressure phase exceeded its five-second admission/cleanup budget')
        for key in ('memory_before', 'memory_retained', 'memory_after'):
            measured = row.get(key, {})
            if (not isinstance(measured, dict) or
                    any(not number(measured.get(field), 1) for field in ('rss', 'heapTotal', 'heapUsed')) or
                    any(not number(measured.get(field)) for field in ('external', 'arrayBuffers')) or
                    (not local and any(not number(measured.get(field), 1) for field in ('cgroup_current', 'cgroup_peak')))):
                failures.append('actual queue memory measurement is missing or invalid')
    missing = {(identity, phase) for identity in expected for phase in ('count', 'bytes', 'full')} - found
    if missing:
        failures.append('actual queue-pressure evidence omits declared workload phases: ' + repr(sorted(missing)))
    if not local and not isolated and set(expected) - loaded:
        failures.append('full queue retention lacks actual lyric CLI/worker RSS overlap: ' + repr(sorted(set(expected) - loaded)))
    return failures


def runtime_evidence_failures(record, *, local=False, require_concurrent=True):
    def number(value):
        return type(value) in (int, float) and math.isfinite(value)
    failures = []
    if record.get('startup_ok') is not True or record.get('recovery_ok') is not True:
        failures.append('actual resident server startup/restart recovery was not proved')
    if record.get('signing_key_stable') is not True or record.get('server_stopped') is not True:
        failures.append('actual server identity/recovery cleanup was not proved')
    if record.get('lazy_bridge_verified') is not True:
        failures.append('resident server may have spawned an extra Python worker')
    if record.get('errors'):
        failures.extend(record['errors'])
    failures.extend(run_store_evidence_failures(record.get('run_store', {})))
    if any(type(record.get(key)) is not int or record[key] < minimum for key, minimum in (('probe_count', 2), ('replays', 2), ('catalog_reads', 1))):
        failures.append('resident server HTTP traffic/recovery evidence is incomplete')
    if any(not number(record.get(key)) or not 0 <= record[key] <= STARTUP_SECONDS for key in ('startup_s', 'recovery_s')):
        failures.append('actual server startup/recovery exceeded its declared deadline')
    receipt = record.get('receipts', {})
    if not number(receipt.get('max_bytes')) or receipt['max_bytes'] <= 0 or not number(receipt.get('bytes')) or not .95 * receipt['max_bytes'] <= receipt['bytes'] <= receipt['max_bytes']:
        failures.append('retained receipt workload did not reach the declared byte load')
    if require_concurrent and (type(record.get('concurrent_replays')) is not int or record['concurrent_replays'] < 1):
        failures.append('actual Node replay/serialization did not overlap the Python measurement')
    if require_concurrent:
        failures.extend(queue_pressure_failures(record.get('queue_pressure', {}),
                        record.get('queue_measurements', {}), local=local))
    if not local:
        if str(record.get('node_version', '')).split('.')[0] != 'v22':
            failures.append('actual resident server is not production Node22')
        if not number(record.get('peak_rss_mib')) or record['peak_rss_mib'] <= 0:
            failures.append('actual Node RSS was not measured')
    return failures


def queue_evidence_extends(evidence, recorded):
    """True when `evidence` is `recorded` plus later rows from the same observed pid."""
    if not isinstance(evidence, dict) or not isinstance(recorded, dict):
        return False
    old_rows, new_rows = recorded.get('rows'), evidence.get('rows')
    pid = recorded.get('server_pid')
    return (type(pid) is int and evidence.get('server_pid') == pid and
            evidence.get('version') == recorded.get('version') and
            set(evidence) == set(recorded) and
            isinstance(old_rows, list) and isinstance(new_rows, list) and
            len(new_rows) > len(old_rows) and new_rows[:len(old_rows)] == old_rows and
            all(isinstance(row, dict) and row.get('server_pid') == pid for row in new_rows[len(old_rows):]))


class ResidentRuntime:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            self.port = listener.getsockname()[1]
        self.child = None
        self.group_open = False
        self.stopping = threading.Event()
        self.thread = None
        self.measurement_active = False
        self.measurement_id = None
        self.record = {'version': 1, 'errors': [], 'probe_count': 0, 'replays': 0,
                       'catalog_reads': 0, 'concurrent_replays': 0, 'peak_rss_mib': None, 'lazy_bridge_verified': False,
                       'queue_measurements': {},
                       'scope': 'Resident real HTTP/chat/MCP server, full synthetic RunStore cache and near-ceiling durable receipts plus strict Python component workload; catalog and receipt replay exercise Node serialization. Actual queue admission/retention/overflow/cancellation is measured concurrently, without another Python worker. No model conversation, queued execution throughput or writer-convergence claim.'}
        self.node = shutil.which('node')
        if not self.node:
            raise RuntimeError('Node is required for the actual resident server workload')
        self.manifest = None
        self.startup_deadline = None
        atexit.register(self.close)

    def request(self, method, path, body=None, timeout=HEALTH_SECONDS):
        if self.startup_deadline is not None:
            remaining = self.startup_deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError('resident server startup/recovery deadline elapsed')
            timeout = min(timeout, remaining)
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=timeout)
        try:
            data = None if body is None else json.dumps(body, separators=(',', ':'), ensure_ascii=False).encode()
            headers = {'content-type': 'application/json', 'accept': 'application/json, text/event-stream'}
            connection.request(method, path, data, headers)
            response = connection.getresponse()
            raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise RuntimeError('capacity HTTP response exceeded its bounded read')
            if response.status != 200:
                raise RuntimeError(f'capacity HTTP {path.split("/")[1]} returned {response.status}')
            if response.getheader('content-type', '').startswith('text/event-stream'):
                values = [json.loads(line[6:]) for line in raw.decode().splitlines() if line.startswith('data: ')]
                return values[-1] if values else {}
            return json.loads(raw)
        finally:
            connection.close()

    def sample(self):
        if self.child is None or self.child.poll() is not None:
            raise RuntimeError('resident server exited during the capacity workload')
        memory = _proc_memory(self.child.pid)
        rss, peak = memory.get('VmRSS'), memory.get('VmHWM')
        if peak is not None:
            self.record['peak_rss_mib'] = max(self.record['peak_rss_mib'] or 0, peak)
        if rss is not None:
            self.record['last_rss_mib'] = rss
        children = _direct_children(self.child.pid)
        if children:
            raise RuntimeError('resident server spawned an extra child; combined matrix would duplicate Python')
        if children == []:
            self.record['lazy_bridge_verified'] = True
        retained = json.loads((self.directory / 'run-store.json').read_text())
        failures = run_store_evidence_failures(retained)
        if (retained.get('pid') != self.child.pid or
                type(retained.get('sampled_at')) is not int or
                not 0 <= time.time() * 1000 - retained['sampled_at'] <= 15000):
            failures.append('RunStore evidence is stale or belongs to another server process')
        if failures:
            raise RuntimeError('; '.join(failures))
        self.record['run_store'] = retained
        self.collect_queue()
        self.record['probe_count'] += 1

    def collect_queue(self):
        path = self.directory / 'queue-pressure.json'
        if not path.exists():
            return
        evidence = json.loads(path.read_text())
        # Restart keeps the completed old process's private receipt. Do not
        # relabel it as load on the replacement process or silently discard it.
        if evidence.get('server_pid') != self.child.pid:
            recorded = self.record.get('queue_pressure')
            if evidence == recorded:
                return
            # The server measures on a 250 ms tick and finishes the phase it
            # is inside when the request goes inactive, so its last write can
            # land after this side's last look and before its own exit (CI run
            # 34645027230 at main dd316b1b: one 'full' row more than recorded,
            # same pid, and the restart read it as a stranger's for thirty
            # seconds). A receipt that extends exactly what was recorded, from
            # the pid that was observed, is that process's own and is kept
            # under its pid. Anything else is still refused.
            if queue_evidence_extends(evidence, recorded):
                self.record['queue_pressure'] = evidence
                return
            raise RuntimeError('queue-pressure evidence belongs to an unobserved server process')
        self.record['queue_pressure'] = evidence

    def begin_measurement(self, identity, proc):
        if self.measurement_active or identity in self.record['queue_measurements'] or proc.poll() is not None:
            raise RuntimeError('queue-pressure measurement process is absent or already recorded')
        self.record['queue_measurements'][identity] = {'server_pid': self.child.pid, 'instrument_pid': proc.pid}
        self.measurement_id = identity
        self.measurement_active = True
        self._queue_request({'id': identity, 'active': True, 'instrument_pid': proc.pid})

    def _queue_request(self, value):
        path = self.directory / 'queue-request.json'
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(value) + '\n')
        temporary.replace(path)

    def end_measurement(self):
        self._queue_request({'active': False})
        self.measurement_active = False
        self.measurement_id = None
        if self.child is not None:
            self.collect_queue()

    def health(self):
        health = self.request('GET', '/health')
        if health.get('service') != 'codex-musica-mcp' or health.get('recovery', {}).get('healthy') is not True or health.get('recovery', {}).get('durable') is not True or health.get('lyrics', {}).get('ready') is not True:
            raise RuntimeError('resident server does not have healthy durable lyrics initialization')
        if self.record.get('build') is not None and self.record['build'] != health.get('build'):
            raise RuntimeError('resident server build/assets changed during the measured workload')
        self.record['node_version'] = health.get('build', {}).get('node')
        self.record['build'] = health.get('build')
        return health

    def replay(self):
        record = self.request('GET', '/chat/jobs/' + self.manifest['id'], timeout=REPLAY_SECONDS)
        if record.get('state') != 'completed' or record.get('durable') is not True:
            raise RuntimeError('retained completed receipt was lost or changed state')
        # Establish the exact existing record before posting its original intent;
        # a missing receipt must never turn this probe into new provider work.
        if record.get('response', {}).get('status') != 200:
            raise RuntimeError('retained receipt has no completed response')
        response = self.request('POST', '/chat', self.manifest['intent'], timeout=REPLAY_SECONDS)
        encoded = json.dumps(response, separators=(',', ':'), ensure_ascii=False).encode()
        if hashlib.sha256(encoded).hexdigest() != self.manifest['response_sha256']:
            raise RuntimeError('exact HTTP receipt replay changed the saved response')
        self.record['replays'] += 1
        self.sample()

    def catalog(self):
        response = self.request('POST', '/mcp/lyrics', {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list', 'params': {}}, timeout=REPLAY_SECONDS)
        tools = response.get('result', {}).get('tools')
        if not isinstance(tools, list) or not any(row.get('name') == 'lyric_grade' for row in tools):
            raise RuntimeError('actual HTTP MCP catalog was not serialized')
        self.record['catalog_reads'] += 1
        self.sample()

    def _launch(self, recovery=False):
        started = time.monotonic()
        self.startup_deadline = started + STARTUP_SECONDS
        self.log = open(self.directory / ('restart.stderr' if recovery else 'server.stderr'), 'w')
        env = {**os.environ, 'PORT': str(self.port), 'LYRIC_RUNTIME_DIR': str(self.directory / 'runtime'),
               'GEMINI_API_KEY': 'offline-capacity-placeholder', 'LYRIC_PYTHON': os.sys.executable,
               'HTTP_PROXY': '', 'HTTPS_PROXY': '', 'ALL_PROXY': '', 'NO_PROXY': '127.0.0.1,localhost'}
        self.child = subprocess.Popen([self.node, str(ROOT / 'scripts/lyrics_capacity_server.mjs'),
                                      str(self.directory / 'run-store.json'),
                                      str(self.directory / 'prepared-runs.json')], cwd=ROOT,
                                      env=env, stdout=self.log, stderr=subprocess.STDOUT, start_new_session=True)
        self.group_open = True
        last_error = None
        while time.monotonic() - started <= STARTUP_SECONDS:
            if self.child.poll() is not None:
                raise RuntimeError('actual server exited during startup; see retained server log')
            try:
                self.health()
                self.sample()
                self.replay()
                self.catalog()
                break
            except (OSError, RuntimeError, ValueError) as error:
                last_error = error
                time.sleep(.1)
        else:
            raise RuntimeError(f'actual server startup/recovery deadline: {last_error}')
        self.startup_deadline = None
        self.record['recovery_s' if recovery else 'startup_s'] = time.monotonic() - started
        self.record['recovery_ok' if recovery else 'startup_ok'] = True

    def start(self):
        manifest = self.directory / 'receipts.json'
        result = self._prepare([self.node, str(ROOT / 'scripts/seed_lyrics_capacity_receipts.mjs'),
                                str(self.directory / 'runtime/jobs'), str(manifest)])
        if result.returncode:
            raise RuntimeError('retained receipt setup failed: ' + result.stderr[-1000:])
        self.manifest = json.loads(manifest.read_text())
        self.record['receipts'] = {key: value for key, value in self.manifest.items() if key not in ('id', 'intent', 'response_sha256')}
        started = time.monotonic()
        prepared = self._prepare([self.node, str(ROOT / 'scripts/lyrics_capacity_server.mjs'),
                                  str(self.directory / 'run-store.json'),
                                  str(self.directory / 'prepared-runs.json'), '--prepare'])
        if prepared.returncode:
            raise RuntimeError('retained RunStore preparation failed: ' + prepared.stderr[-1000:])
        self.record['run_store_preparation_s'] = time.monotonic() - started
        self._launch()
        key = self.directory / 'runtime/chat-secret.key'
        self.key_digest = hashlib.sha256(key.read_bytes()).digest()
        self.thread = threading.Thread(target=self._monitor, daemon=True)
        self.thread.start()
        return self.record

    def _prepare(self, command):
        child = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, start_new_session=True)
        try:
            stdout, stderr = child.communicate(timeout=180)
            return subprocess.CompletedProcess(command, child.returncode, stdout, stderr)
        finally:
            # Also closes preparation on SIGTERM/SystemExit/KeyboardInterrupt,
            # including descendants after an early preparer-leader exit.
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=STOP_SECONDS)
            child.stdout.close(); child.stderr.close()

    def _monitor(self):
        while not self.stopping.wait(5):
            try:
                during_measurement = self.measurement_active
                self.health()
                self.replay()
                if during_measurement:
                    self.record['concurrent_replays'] += 1
            except (OSError, RuntimeError, ValueError) as error:
                self.record['errors'].append(str(error))
                return

    def stop_child(self):
        if self.child and self.group_open:
            # The leader may already have died while an owned startup child
            # remains. Close the process group once, even after leader exit.
            self.group_open = False
            try:
                os.killpg(self.child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                self.child.wait(timeout=STOP_SECONDS)
            except subprocess.TimeoutExpired:
                pass
            finally:
                try:
                    os.killpg(self.child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                self.child.wait(timeout=STOP_SECONDS)
        if getattr(self, 'log', None):
            self.log.close()

    def finish(self):
        self.stopping.set()
        if self.thread:
            self.thread.join(timeout=2 * REPLAY_SECONDS + HEALTH_SECONDS + 1)
            if self.thread.is_alive():
                raise RuntimeError('resident HTTP monitor did not finish within its deadline')
        # The last look at the old process's receipt, as late as it can be
        # taken: a measurement still finishing when the monitor stopped may
        # have written since the last sample.
        self.collect_queue()
        self.stop_child()
        self._launch(recovery=True)
        if hashlib.sha256((self.directory / 'runtime/chat-secret.key').read_bytes()).digest() != self.key_digest:
            raise RuntimeError('server signing identity changed across restart')
        self.record['signing_key_stable'] = True
        self.stop_child()
        self.record['server_stopped'] = self.child.poll() is not None
        return self.record

    def close(self):
        self.stopping.set()
        self.stop_child()


if __name__ == '__main__':
    import argparse
    import tempfile
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', required=True)
    ap.add_argument('--local', action='store_true')
    args = ap.parse_args()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(SystemExit(143)))
    result = {'ok': False, 'scope': 'Resident server startup, retained-payload HTTP replay and restart only; no Python capacity claim.'}
    with tempfile.TemporaryDirectory(prefix='lyrics-resident-') as tmp:
        runtime = ResidentRuntime(tmp)
        try:
            runtime.start()
            runtime.finish()
            result.update(runtime=runtime.record, failures=runtime_evidence_failures(runtime.record, local=args.local, require_concurrent=False))
            result['ok'] = not result['failures']
        except Exception as error:
            result.update(error=str(error), runtime=runtime.record)
        finally:
            runtime.close()
            target = Path(args.out)
            target.parent.mkdir(parents=True, exist_ok=True)
            for name in ('server.stderr', 'restart.stderr'):
                source = Path(tmp) / name
                if source.exists():
                    target.with_name(target.stem + '-' + name).write_text(source.read_text()[-131072:])
            target.write_text(json.dumps(result, indent=2) + '\n')
    raise SystemExit(0 if result['ok'] else 1)
