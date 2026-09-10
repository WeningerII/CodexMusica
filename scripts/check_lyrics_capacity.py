#!/usr/bin/env python3
"""Declared cold/warm capacity matrix. No model calls; program-generated plans.

Production: run inside the tested image with --cpus=1 --memory=2g --memory-swap=2g.
--local records supplemental measurements without claiming production isolation.

--cells picks which (lines:seed) cells of the declared SIZES x SEEDS matrix this
process measures, so CI can deal the matrix across containers by MEASURED cost
rather than by workload. The coordinate is the cell and not the size because
the cost is not a function of the size alone: on every measured run, seed
20260910 costs more than the other two seeds together at sizes 24 and 31
(at 18 the expensive seed is 20260909), and one cell (31 lines, seed
20260910) is 27% of the whole matrix by itself (ci.yml, the matrix step's
comment, has the numbers). A partial process can
never be production-qualified on its own; `merge_lyrics_capacity.py` re-derives
that from every shard's cells, exactly once each.
"""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import signal
import sys
import tempfile
import time
from measure_verb_memory import assessment_coverage_valid
from lyrics_capacity_runtime import ResidentRuntime, runtime_evidence_failures

ROOT = Path(__file__).resolve().parents[1]
SIZES = (18, 24, 31)
SEEDS = (20260908, 20260909, 20260910)
#: The declared matrix, as the cells a shard is dealt from.
CELLS = tuple((size, seed) for size in SIZES for seed in SEEDS)
MODES = ('cold', 'worker')
LIMITS = {"call_seconds": 600, "child_peak_mib": 1792, "warm_growth_mib": 128,
          "cpus": 1, "memory_bytes": 2 * 1024**3, "worker_rounds": 3,
          "whole_runtime_peak_mib": 1792}


def read(path):
    try:
        return Path(path).read_text().strip()
    except OSError:
        return None


def isolation():
    cpu = read('/sys/fs/cgroup/cpu.max')
    memory = read('/sys/fs/cgroup/memory.max')
    if cpu:
        quota, period = cpu.split()
    else:
        quota = read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us')
        period = read('/sys/fs/cgroup/cpu/cpu.cfs_period_us')
    if memory is None:
        memory = read('/sys/fs/cgroup/memory/memory.limit_in_bytes')
    cpus = float(quota) / float(period) if quota and period and quota not in ('max', '-1') else None
    mem = int(memory) if memory and memory != 'max' else None
    swap = read('/sys/fs/cgroup/memory.swap.max')
    if swap is None:
        memsw = read('/sys/fs/cgroup/memory/memory.memsw.limit_in_bytes')
        swap = str(int(memsw) - mem) if memsw and mem is not None else None
    swap_bytes = int(swap) if swap and swap != 'max' else None
    return {"cpus": cpus, "memory_bytes": mem, "swap_bytes": swap_bytes,
            "production_limits_verified": cpus == 1 and mem == LIMITS['memory_bytes'] and swap_bytes == 0}


def memory_events():
    raw = read('/sys/fs/cgroup/memory.events') or ''
    return {parts[0]: int(parts[1]) for line in raw.splitlines() if len(parts := line.split()) == 2}


def percentile(values, p):
    return sorted(values)[max(0, math.ceil(p * len(values)) - 1)] if values else None


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_measurement(result, expected=None):
    failures = []
    if type(result.get('version')) is not int or result.get('version') != 1 or result.get('ok') is not True:
        failures.append('measurement instrument did not complete successfully')
    mode = result.get('mode')
    if mode not in ('cold', 'worker'):
        failures.append('unknown measurement mode')
    if type(result.get('seed')) is not int or result.get('seed') not in SEEDS:
        failures.append('measurement seed is outside the declared population')
    if type(result.get('lines')) is not int or result.get('lines') not in SIZES:
        failures.append('measurement size is outside the declared population')
    if expected and any(result.get(key) != value for key, value in expected.items()):
        failures.append('measured workload does not match the invoked seed, size and mode')
    if not number(result.get('peak_mb')) or not 0 < result['peak_mb'] <= LIMITS['child_peak_mib']:
        failures.append('missing or excessive aggregate child peak RSS')
    rows = result.get('rows', [])
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        failures.append('measurement rows are malformed')
        return failures
    rounds = LIMITS['worker_rounds'] if mode == 'worker' else 1
    if result.get('rounds') != rounds or [r.get('verb') for r in rows] != ['plan', 'fill'] + ['grade', 'revise'] * rounds:
        failures.append('measurement must contain the exact declared plan/fill/grade/repair sequence')
    for row in rows:
        verb = row.get('verb')
        wall, peak = row.get('wall_s'), row.get('peak_mb')
        if row.get('typed') is not True or row.get('authenticated') is not True:
            failures.append(f'{verb}: no typed real result')
        if not number(wall) or not 0 <= wall <= LIMITS['call_seconds']:
            failures.append(f'{verb}: missing or excessive call latency')
        if mode == 'worker' or verb in ('grade', 'revise'):
            if not number(peak) or not 0 < peak <= LIMITS['child_peak_mib']:
                failures.append(f'{verb}: missing or excessive child peak RSS')
            elif number(result.get('peak_mb')) and peak > result['peak_mb'] + 1:
                failures.append('aggregate peak is below a measured call peak')
        code = row.get('exit_code')
        if type(code) is not int:
            failures.append('exit code must be an integer')
        if verb in ('plan', 'fill') and (code != 0 or row.get('machine_status') != 'planned'):
            failures.append(f'{verb}: declaration was refused')
        if verb == 'grade':
            cov = row.get('coverage')
            if code not in (0, 2, 3) or row.get('stop') != 'graded' or row.get('machine_status') != 'graded' or not assessment_coverage_valid(cov):
                failures.append(f'grade did not produce a structured grade: exit {code}')
            elif (code == 2 and cov.get('certified') is not False) or row.get('quality_certified') != cov.get('certified'):
                failures.append('grade certification does not match its completed assessment')
            elif row.get('refusals') != len(cov['refused_obligations']):
                failures.append('grade refusal accounting is missing or inconsistent')
        if verb == 'revise':
            if code not in (0, 3, 4) or row.get('checkpoint_present') is not True or row.get('checkpoint_valid') is not True:
                failures.append(f'repair did not preserve a valid completed/pending journal: exit {code}')
            if code == 4 and (row.get('stop') != 'needs_proposal' or row.get('machine_status') != 'suspended'):
                failures.append('pending repair has no coherent suspension result')
            if code in (0, 3) and (row.get('machine_status') != 'finished' or not row.get('stop')):
                failures.append('completed repair has no coherent finished result')
        if mode == 'worker':
            retained = row.get('retained_mb')
            if not number(retained) or not 0 < retained <= LIMITS['child_peak_mib'] or (number(peak) and retained > peak + 1):
                failures.append(f'{verb}: missing or inconsistent retained worker RSS')
    if not any(row.get('verb') == 'revise' and row.get('exit_code') == 4 for row in rows):
        failures.append('workload never reached the declared deferred proposal stage')
    if mode == 'worker':
        round_rss = [r.get('retained_mb') for r in rows if r.get('verb') == 'revise']
        declared = result.get('round_retained_mb')
        growth = result.get('growth_mb')
        if declared != round_rss or not round_rss or not all(number(x) for x in round_rss):
            failures.append('warm round memory samples are missing or inconsistent')
        else:
            later_rss = [r.get('retained_mb') for r in rows[4:]]
            actual_growth = max([round_rss[0]] + [x for x in later_rss if number(x)]) - round_rss[0]
            if not number(growth) or abs(growth - actual_growth) > .01 or growth > LIMITS['warm_growth_mib']:
                failures.append('warm worker retained growth exceeds its declared allowance or disagrees with samples')
            if result.get('residual_mb') != round_rss[-1]:
                failures.append('final worker retained RSS disagrees with the last reply')
    return failures


def cgroup_bytes(name):
    """-> int bytes from this container's own cgroup file, or None.

    Per-cgroup by construction, so a neighbouring container cannot move it.
    That is what lets the matrix be split across containers without the
    memory evidence becoming a reading of the runner instead of the runtime.
    """
    value = read(f'/sys/fs/cgroup/{name}')
    return int(value) if value and value.isdigit() else None


def memory_stat(raw=None):
    """-> {row: bytes} from this cgroup's memory.stat (cgroup v2), or {}."""
    raw = read('/sys/fs/cgroup/memory.stat') if raw is None else raw
    out = {}
    for line in (raw or '').splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1].isdigit():
            out[parts[0]] = int(parts[1])
    return out


def resident_bytes(current=None, stat=None):
    """-> (resident, current, accounting) for this cgroup, now.

    RESIDENT IS WHAT THE 2 GiB ENVELOPE HAS TO HOLD, AND memory.current IS
    NOT IT. memory.current counts the page cache -- every file the harness
    read and every JSON it wrote -- and under a 2 GiB limit the kernel does
    not reclaim that cache until the limit is reached, so a container that
    touched enough bytes reads 1.8 GiB while its processes hold 1.0. The
    ceiling below is 1792 MiB, so that reading fails the matrix on I/O
    volume, not on memory need. MEASURED 2026-09-10 (M-269): one commit,
    two runs, the same three-cell shard -- passed on one runner, and on
    the other sampled 1785 MiB of memory.current with the Python child at
    689 MiB (its own rusage peak) and 0.89-0.95 GiB left at every boundary
    after the child had exited.

    So the number gated is memory.current minus the cache the kernel can
    drop: `file` less `shmem` (tmpfs and shared memory sit inside `file`
    in cgroup v2 and cannot be dropped without swap, and this container
    has none). Anonymous memory, kernel memory and shared memory all stay
    counted. When memory.stat cannot say, the reading falls back to
    memory.current itself and SAYS SO in `accounting`, so the older, more
    pessimistic number is never mistaken for this one.
    """
    current = cgroup_bytes('memory.current') if current is None else current
    stat = memory_stat() if stat is None else stat
    if current is None:
        return None, None, 'unavailable'
    if 'file' in stat and 'shmem' in stat:
        return max(0, current - (stat['file'] - stat['shmem'])), current, 'current-minus-reclaimable-file'
    return current, current, 'cgroup-current'


def write_result(path, result):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    def clean(value):
        if isinstance(value, float) and not math.isfinite(value): return None
        if isinstance(value, dict): return {key:clean(v) for key,v in value.items()}
        if isinstance(value, (list,tuple)): return [clean(v) for v in value]
        return value
    temp.write_text(json.dumps(clean(result), indent=2, sort_keys=True, allow_nan=False) + '\n')
    temp.replace(path)


def parse_cells(text):
    """'31:20260910,18:20260908' -> ((31, 20260910), (18, 20260908)).

    Raises ValueError naming the defect for anything that is not a distinct
    selection of declared cells. The order given is the order measured.
    """
    cells = []
    for item in [piece.strip() for piece in text.split(',') if piece.strip()]:
        lines, sep, seed = item.partition(':')
        if not sep or not lines.isdigit() or not seed.isdigit():
            raise ValueError(f'{item!r} is not lines:seed')
        cell = (int(lines), int(seed))
        if cell not in CELLS:
            raise ValueError(f'{item!r} is not a declared cell of {SIZES} x {SEEDS}')
        if cell in cells:
            raise ValueError(f'{item!r} is selected twice')
        cells.append(cell)
    if not cells:
        raise ValueError('no cells selected')
    return tuple(cells)


LEAK_SIGNATURE = ('resident memory rose at every execution boundary; the runtime '
                  'accumulates across a long run')
#: Fewer boundaries than this and the signature says nothing (recorded as not rising
#: over that many boundaries; the merger refuses a shard with fewer).
LEAK_MIN_BOUNDARIES = 4


def leak_verdict(trace, whole_matrix):
    """-> (signature, failure-or-None) for a memory trace's resident boundaries.

    The signature is RECORDED for every run: how many boundaries it saw and
    whether resident memory rose at every one of them. The failure is
    returned only when this run measured the whole matrix -- one container,
    every boundary -- because that is the evidence the strict rule was
    written for. A shard's signature is judged by `merge_lyrics_capacity.py`
    over every shard (M-272).
    """
    climb = [sample.get('current_bytes') for sample in trace]
    rose = (len(climb) >= LEAK_MIN_BOUNDARIES and all(isinstance(v, int) for v in climb)
            and all(b > a for a, b in zip(climb, climb[1:])))
    signature = {'boundaries': len(climb), 'rose_at_every_boundary': rose,
                 'judged_here': bool(whole_matrix)}
    return signature, (LEAK_SIGNATURE if rose and whole_matrix else None)


def summarize_measurements(measurements):
    """-> per (lines, mode, verb) p95 wall and peak over the executions supplied.

    ONE derivation for a shard and for the merged matrix. A shard summarises
    the cells it measured; `merge_lyrics_capacity.py` calls this same function
    over the union, so a size whose seeds were dealt to different containers
    gets one row from all of its samples rather than two partial ones.
    """
    sizes = sorted({m.get('lines') for m in measurements if isinstance(m.get('lines'), int)})
    summaries = []
    for size in sizes:
        for mode in MODES:
            group = [m for m in measurements if m.get('lines') == size and m.get('mode') == mode]
            for verb in ('grade', 'revise'):
                rows = [r for m in group for r in m.get('rows', []) if r.get('verb') == verb]
                summaries.append({"lines": size, "mode": mode, "verb": verb, "samples": len(rows),
                    "p95_seconds": percentile([r['wall_s'] for r in rows if isinstance(r.get('wall_s'), (float, int))], .95),
                    "peak_mib": max([r['peak_mb'] for r in rows if isinstance(r.get('peak_mb'), (float, int))], default=None)})
    return summaries


def published_limits():
    sys.path.insert(0, str(ROOT / 'lyric-harness'))
    from quality.plan import execution_limits
    return execution_limits()


class MeasurementProgress:
    """Expose captured diagnostics without treating activity as a passing result.

    Also the SAMPLER for this execution's resident-memory peak: every call
    (the measurement loop makes one about once a second) reads the cgroup,
    and `resident_peak` is the largest resident reading seen. The kernel's
    own high-water mark, memory.peak, cannot be asked to leave the page
    cache out (see `resident_bytes`), so the peak of what the envelope must
    hold is a sampled quantity, at that cadence; the Python child's own
    peak is measured exactly by its rusage and gated separately.
    """
    def __init__(self, identity):
        self.identity = identity
        self.started = self.last = time.monotonic()
        self.output_bytes = 0
        self.resident_peak = None
        self.accounting = None
        self.samples = 0

    def sample(self):
        resident, current, accounting = resident_bytes()
        self.accounting = accounting
        if resident is not None:
            self.samples += 1
            self.resident_peak = resident if self.resident_peak is None else max(self.resident_peak, resident)
        return resident, current

    def emit(self, output, final=False):
        now = time.monotonic()
        resident, current = self.sample()
        if not final and now - self.last < 30:
            return
        raw = output.encode('utf-8') if isinstance(output, str) else (output or b'')
        fresh = raw[self.output_bytes:]
        if fresh:
            print(fresh[-4000:].decode('utf-8', errors='replace'), end='', flush=True)
        self.output_bytes = len(raw)
        cpu = read('/sys/fs/cgroup/cpu.stat') or ''
        usage = next((line.split()[1] for line in cpu.splitlines()
                      if line.startswith('usage_usec ')), 'unavailable')
        print(f'Capacity activity {self.identity}: elapsed={now-self.started:.1f}s '
              f'cgroup_cpu_usec={usage} cgroup_memory_bytes={current if current is not None else "unavailable"} '
              f'resident_bytes={resident if resident is not None else "unavailable"} '
              f'resident_peak_bytes={self.resident_peak if self.resident_peak is not None else "unavailable"} '
              f'measurement={"exited; validation pending" if final else "running"}', flush=True)
        self.last = now


def source_identity():
    import hashlib
    return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in (
        'lyric-harness/lyric_harness.py', 'lyric-harness/quality/plan.py', 'lyric-harness/quality/revise.py',
        'lyric-harness/quality/relations.py', 'mcp/server_http.js', 'mcp/job_store.js',
        'mcp/run_store.js', 'mcp/state_codec.js', 'mcp/python_bridge.js',
        'scripts/measure_verb_memory.py', 'scripts/check_lyrics_capacity.py',
        'scripts/lyrics_capacity_runtime.py', 'scripts/seed_lyrics_capacity_receipts.mjs',
        'scripts/lyrics_capacity_server.mjs', 'scripts/lyrics_capacity_queue.mjs')}


def terminate_measurement(proc):
    """Close the owned instrument group even on SystemExit/KeyboardInterrupt."""
    if proc is None:
        return
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait(timeout=5)
    for pipe in (proc.stdout, proc.stderr):
        if pipe is not None:
            pipe.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', required=True)
    ap.add_argument('--local', action='store_true')
    ap.add_argument('--cells', default=','.join(f'{size}:{seed}' for size, seed in CELLS),
                    help='the lines:seed cells of the declared matrix to measure, in order')
    args = ap.parse_args()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(SystemExit(143)))
    try:
        cells = parse_cells(args.cells)
    except ValueError as error:
        ap.error(f'--cells: {error}')
    sizes = tuple(sorted({size for size, _ in cells}))
    out = Path(args.out)
    # `sizes` and `seeds` are the DECLARED matrix's coordinates as this shard
    # touches them; `cells` is what it actually measured. The merger reads
    # `cells` against CELLS, and refuses a shard whose `seeds` is not the
    # declared population or whose `sizes` does not describe its cells, so no
    # shard can quietly redefine the matrix.
    report = {"version": 1, "status": "running", "production_qualified": False,
              "local_supplement": args.local, "sizes": sizes, "seeds": SEEDS,
              "cells": [list(cell) for cell in cells],
              "scope": "resource capacity with explicit refusal accounting; not lyric-quality certification",
              "limits": LIMITS, "isolation": isolation(), "measurements": [],
              "memory_trace": [], "failures": [],
              "source_sha256": source_identity()}
    try:
        report['published_execution_limits'] = published_limits()
        if report['published_execution_limits']['max_lines'] != max(SIZES):
            report['failures'].append('published planner maximum differs from the predeclared capacity matrix')
    except Exception as error:
        report['failures'].append(f'cannot verify published planner scope: {error}')
    before_events = memory_events()
    if not args.local and 'oom_kill' not in before_events:
        report['failures'].append('cgroup OOM-kill accounting is unavailable; production isolation cannot be qualified')
    if not args.local and not report['isolation']['production_limits_verified']:
        report['failures'].append('Require the actual 1 CPU / 2 GiB cgroup limits; --local is supplemental only')
    write_result(out, report)
    deadline = time.monotonic() + 60 * 60
    with tempfile.TemporaryDirectory(prefix='lyrics-capacity-') as tmp:
        resident = ResidentRuntime(Path(tmp) / 'server')
        try:
            if not report['failures']:
                report['resident_runtime'] = resident.start()
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
            report['failures'].append(f'resident server startup: {error}')
        for size, seed in cells:
            for mode in MODES:
                if report['failures']:
                    break
                target = Path(tmp) / f'{size}-{seed}-{mode}.json'
                command = [sys.executable, str(ROOT / 'scripts/measure_verb_memory.py'),
                           f'--seed={seed}', f'--lines={size}', '--verb=both', f'--json={target}']
                if mode == 'worker':
                    command += ['--worker', f"--rounds={LIMITS['worker_rounds']}"]
                print(f'Capacity lines={size} seed={seed} mode={mode}', flush=True)
                progress = MeasurementProgress(f'{size}/{seed}/{mode}')
                proc = None
                try:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise TimeoutError('capacity matrix exhausted its 60-minute total budget')
                    proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                            text=True, cwd=ROOT, start_new_session=True)
                    resident.begin_measurement(f'{size}/{seed}/{mode}', proc)
                    process_deadline = time.monotonic() + min(remaining, 3600)
                    while True:
                        try:
                            # One second, not five: each wait is also one
                            # resident-memory sample (MeasurementProgress).
                            stdout, stderr = proc.communicate(timeout=min(1, max(.01, process_deadline - time.monotonic())))
                            progress.emit(stdout, final=True)
                            break
                        except subprocess.TimeoutExpired as pending:
                            progress.emit(pending.output)
                            runtime_failed = resident.record.get('errors') or resident.child.poll() is not None
                            if time.monotonic() < process_deadline and not runtime_failed:
                                continue
                            os.killpg(proc.pid, signal.SIGKILL)
                            proc.communicate()
                            if runtime_failed:
                                raise RuntimeError('actual resident server failed during the Python workload')
                            raise
                    result = json.loads(target.read_text())
                    if proc.returncode:
                        report['failures'].append(f'measurement exited {proc.returncode}: {stdout[-1500:]} {stderr[-1500:]}')
                    report['failures'] += validate_measurement(result, {'seed':seed,'lines':size,'mode':mode})
                    report['measurements'].append(result)
                    if resident.record.get('errors'):
                        report['failures'] += resident.record['errors']
                except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired, TimeoutError) as error:
                    report['failures'].append(f'{size}/{seed}/{mode}: {error}')
                finally:
                    try:
                        resident.end_measurement()
                    except (OSError, ValueError, RuntimeError) as error:
                        report['failures'].append(f'{size}/{seed}/{mode}: queue-pressure cleanup: {error}')
                    finally:
                        terminate_measurement(proc)
                # A HIGH-WATER MARK READ ONCE AT THE END CANNOT SEE A CLIMB.
                # `whole_runtime_peak_bytes` below ~~is /sys/fs/cgroup/memory.peak
                # read after the whole loop~~ WAS memory.peak read once -- a
                # max, and one number. It was doing double duty: bounding the
                # peak AND standing in for "the resident server does not
                # accumulate across a long run". Only the first of those
                # survives being read once, and when this matrix was split
                # across containers (ci.yml, 2026-09-09) the second would
                # have been lost silently. Sampling at every execution
                # boundary answers both, with one reading per execution
                # instead of one per run, and it is the same 18 executions
                # either way.
                #
                # AND memory.peak COUNTS THE PAGE CACHE (M-269, 2026-09-10),
                # so since then `peak_bytes` is the peak RESIDENT reading
                # sampled during this execution and `current_bytes` the
                # resident reading at its boundary; the raw cgroup figures
                # ride beside them, unjudged, so the record still shows
                # what the kernel's own counter said.
                boundary_resident, boundary_current = progress.sample()
                report['memory_trace'].append({
                    'lines': size, 'seed': seed, 'mode': mode,
                    'peak_bytes': progress.resident_peak,
                    'current_bytes': boundary_resident,
                    'samples': progress.samples,
                    'accounting': progress.accounting,
                    'cgroup_peak_bytes': cgroup_bytes('memory.peak'),
                    'cgroup_current_bytes': boundary_current})
                write_result(out, report)
        try:
            if report.get('resident_runtime', {}).get('startup_ok'):
                report['resident_runtime'] = resident.finish()
                report['failures'] += runtime_evidence_failures(report['resident_runtime'], local=args.local)
            else:
                report['failures'].append('combined-runtime capacity was not measured')
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
            report['failures'].append(f'resident server recovery: {error}')
        finally:
            resident.close()
            for name in ('server.stderr', 'restart.stderr'):
                source = Path(tmp) / 'server' / name
                if source.exists():
                    out.with_name(out.stem + '-' + name).write_text(source.read_text()[-131072:])
    after_events = memory_events()
    if after_events.get('oom_kill', 0) > before_events.get('oom_kill', 0):
        report['failures'].append('cgroup recorded an OOM kill during the matrix')
    expected = len(cells) * len(MODES)
    if len(report['measurements']) != expected:
        report['failures'].append(f"completed {len(report['measurements'])}/{expected} declared measurements")
    ceiling = LIMITS['whole_runtime_peak_mib'] * 1024**2
    if not args.local:
        if len(report['memory_trace']) != len(report['measurements']):
            report['failures'].append('the memory trace does not cover every execution')
        for sample in report['memory_trace']:
            if sample['peak_bytes'] is None or sample['peak_bytes'] > ceiling:
                report['failures'].append(
                    f"{sample['lines']}/{sample['seed']}/{sample['mode']}: missing or "
                    f"excessive resident-memory peak during this execution")
        # THE LEAK SIGNATURE, AND DELIBERATELY A STRICT ONE. Resident memory
        # rising at EVERY boundary without once falling back is accumulation;
        # anything less than that is a working set moving around, and calling
        # it a leak would make this check a coin toss on a busy runner. Needs
        # at least four boundaries before it will say anything at all.
        #
        # AND FOUR IS A COIN TOSS TOO, IN A SHARD (M-272, 2026-09-10). Written
        # for one container's 18 boundaries, where a strict climb is evidence;
        # dealt three ways (M-268), the pole shard has exactly four, and a
        # working set that is merely warming up climbs through four boundaries
        # before it first falls -- run 34518177848 showed it in two shards of
        # three, one of which then fell twice. A leak is a property of the
        # runtime, so every container running it would show it: a shard
        # RECORDS its signature here and the merger judges over every shard.
        # A run that measured the whole matrix in one container still judges
        # itself, over the 18 boundaries the rule was written for.
        report['leak_signature'], leak = leak_verdict(
            report['memory_trace'], whole_matrix=sorted(cells) == sorted(CELLS))
        if leak:
            report['failures'].append(leak)
    # The whole-runtime peak is the largest resident reading over every
    # execution's samples -- Node and Python together, page cache left out
    # (M-269). The kernel's memory.peak is recorded beside it, unjudged.
    peaks = [s.get('peak_bytes') for s in report['memory_trace']]
    report['whole_runtime_peak_bytes'] = max(peaks) if peaks and all(isinstance(v, int) for v in peaks) else None
    report['memory_accounting'] = sorted({s.get('accounting') for s in report['memory_trace'] if s.get('accounting')})
    if not args.local and (report['whole_runtime_peak_bytes'] is None or
            report['whole_runtime_peak_bytes'] > LIMITS['whole_runtime_peak_mib'] * 1024**2):
        report['failures'].append('missing or excessive resident-memory peak with resident Node and Python')
    report['source_sha256_after'] = source_identity()
    if report['source_sha256_after'] != report['source_sha256']:
        report['failures'].append('measured runtime source changed during the capacity matrix')
    report.update(status='failed' if report['failures'] else 'passed',
                  summaries=summarize_measurements(report['measurements']),
                  memory_events_before=before_events, memory_events_after=after_events,
                  cgroup_peak_bytes=read('/sys/fs/cgroup/memory.peak'),
                  production_qualified=not report['failures'] and not args.local
                                       and sorted(cells) == sorted(CELLS))
    write_result(out, report)
    print(json.dumps({k: report[k] for k in ('status','production_qualified','failures')}, sort_keys=True))
    return 1 if report['failures'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
