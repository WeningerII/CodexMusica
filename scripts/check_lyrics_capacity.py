#!/usr/bin/env python3
"""Declared cold/warm capacity matrix. No model calls; program-generated plans.

Production: run inside the tested image with --cpus=1 --memory=2g --memory-swap=2g.
--local records supplemental measurements without claiming production isolation.
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


def published_limits():
    sys.path.insert(0, str(ROOT / 'lyric-harness'))
    from quality.plan import execution_limits
    return execution_limits()


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
    ap.add_argument('--sizes', default=','.join(map(str, SIZES)))
    args = ap.parse_args()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(SystemExit(143)))
    sizes = tuple(int(value) for value in args.sizes.split(','))
    if not sizes or len(set(sizes)) != len(sizes) or any(value not in SIZES for value in sizes):
        ap.error('--sizes must select distinct declared workloads: 18,24,31')
    out = Path(args.out)
    report = {"version": 1, "status": "running", "production_qualified": False,
              "local_supplement": args.local, "sizes": sizes, "seeds": SEEDS,
              "scope": "resource capacity with explicit refusal accounting; not lyric-quality certification",
              "limits": LIMITS, "isolation": isolation(), "measurements": [], "failures": [],
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
        for size in sizes:
            for seed in SEEDS:
                for mode in ('cold', 'worker'):
                    if report['failures']:
                        break
                    target = Path(tmp) / f'{size}-{seed}-{mode}.json'
                    command = [sys.executable, str(ROOT / 'scripts/measure_verb_memory.py'),
                               f'--seed={seed}', f'--lines={size}', '--verb=both', f'--json={target}']
                    if mode == 'worker':
                        command += ['--worker', f"--rounds={LIMITS['worker_rounds']}"]
                    print(f'Capacity lines={size} seed={seed} mode={mode}', flush=True)
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
                                stdout, stderr = proc.communicate(timeout=min(5, max(.01, process_deadline - time.monotonic())))
                                break
                            except subprocess.TimeoutExpired:
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
    expected = len(sizes) * len(SEEDS) * 2
    if len(report['measurements']) != expected:
        report['failures'].append(f"completed {len(report['measurements'])}/{expected} declared measurements")
    whole_peak = read('/sys/fs/cgroup/memory.peak')
    report['whole_runtime_peak_bytes'] = int(whole_peak) if whole_peak and whole_peak.isdigit() else None
    if not args.local and (report['whole_runtime_peak_bytes'] is None or
            report['whole_runtime_peak_bytes'] > LIMITS['whole_runtime_peak_mib'] * 1024**2):
        report['failures'].append('missing or excessive whole-cgroup peak with resident Node and Python')
    report['source_sha256_after'] = source_identity()
    if report['source_sha256_after'] != report['source_sha256']:
        report['failures'].append('measured runtime source changed during the capacity matrix')
    summaries = []
    for size in sizes:
        for mode in ('cold', 'worker'):
            group = [m for m in report['measurements'] if m.get('lines') == size and m.get('mode') == mode]
            for verb in ('grade', 'revise'):
                rows = [r for m in group for r in m.get('rows', []) if r.get('verb') == verb]
                summaries.append({"lines": size, "mode": mode, "verb": verb, "samples": len(rows),
                    "p95_seconds": percentile([r['wall_s'] for r in rows if isinstance(r.get('wall_s'), (float, int))], .95),
                    "peak_mib": max([r['peak_mb'] for r in rows if isinstance(r.get('peak_mb'), (float, int))], default=None)})
    report.update(status='failed' if report['failures'] else 'passed', summaries=summaries,
                  memory_events_before=before_events, memory_events_after=after_events,
                  cgroup_peak_bytes=read('/sys/fs/cgroup/memory.peak'),
                  production_qualified=not report['failures'] and not args.local and sizes == SIZES)
    write_result(out, report)
    print(json.dumps({k: report[k] for k in ('status','production_qualified','failures')}, sort_keys=True))
    return 1 if report['failures'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
