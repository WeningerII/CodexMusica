#!/usr/bin/env python3
"""M-170: serial cold/warm continuations through the shipped worker handler.

Extends quality/fold_series.py's deterministic filler/answer recipe. No model
calls, thresholds or grading predicates are replaced. --components times coarse
boundaries with nested wall/CPU clocks, not cProfile's per-call hooks. Inclusive
rows overlap; exclusive rows partition ONLY the instrumented region. Run an
untimed arm on the identical fixture before interpreting these diagnostics.

Every arm starts with an empty journal. Warm holds one worker process; cold
starts one per call. Exit/refusal/timeout, complete output and journals survive.
Timings describe this host and this deterministic answer policy, not convergence
of a writer or capacity qualification of a deployed instance.
"""
import argparse
import functools
import hashlib
import json
import os
from pathlib import Path
import platform
import queue
import re
import resource
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
HARN = ROOT / 'lyric-harness'


def deployed_turn_seconds():
    """-> the seconds one deployed turn may take, READ FROM THE CONNECTOR.

    THE CEILING ON `--timeout` WAS A BARE 600 WITH NO COMMENT AND NO SOURCE,
    and M-170 item 6 is unmeasured because of it: the 28-line COLD arm reaches
    that ceiling at continuation 2 (exit 124), so its later cold continuations
    and full-arm equivalence were never measured, and the entry refused to
    substitute a longer budget SILENTLY. This is that substitution made out
    loud, and tied to a number the deployment actually enforces instead of a
    new one invented here.

    `mcp/gemini_agent.js` sets `maxTurnMs: 2_400_000` -- 2,400 s, FOUR TIMES
    the old ceiling. A continuation that takes 700 s is therefore well inside
    a legal turn, and refusing to measure it said nothing about the workload;
    it was an artifact of this instrument. `scripts/flash_battery.mjs` already
    reads the same constant out of the same file rather than restating it
    (doctrine 1), and this follows that precedent, so the instrument cannot go
    stale against a deployment that re-tunes its turn.

    The DEFAULT is unchanged at 600: nothing moves unless a caller asks, and a
    caller who asks is recorded in the evidence as having asked.

    REFUSES rather than guesses if the constant cannot be read -- an
    instrument that silently invents its own ceiling is the defect above.
    """
    src = (ROOT / 'mcp' / 'gemini_agent.js').read_text(encoding='utf-8')
    m = re.search(r'maxTurnMs:\s*([\d_]+)', src)
    if not m:
        raise SystemExit(
            'REFUSED: maxTurnMs not found in mcp/gemini_agent.js; this '
            'instrument reads its ceiling from the connector and will not '
            'invent one (doctrine 20)')
    return int(m.group(1).replace('_', '')) / 1000.0


class ComponentClock:
    """Nested clocks, including exceptional exits, with no double-counted self time."""
    def __init__(self):
        self.rows, self.stack = {}, []

    def wrap(self, name, original):
        @functools.wraps(original)
        def call(*args, **kwargs):
            parents = [frame['name'] for frame in self.stack]
            frame = dict(name=name, wall=time.perf_counter(), cpu=time.process_time(),
                         child_wall=0., child_cpu=0.)
            self.stack.append(frame)
            try:
                return original(*args, **kwargs)
            finally:
                wall, cpu = time.perf_counter()-frame['wall'], time.process_time()-frame['cpu']
                self.stack.pop()
                key = ' > '.join(parents + [name])
                row = self.rows.setdefault(key, dict(calls=0, wall=0., cpu=0., self_wall=0., self_cpu=0.))
                row['calls'] += 1
                row['wall'] += wall
                row['cpu'] += cpu
                row['self_wall'] += wall-frame['child_wall']
                row['self_cpu'] += cpu-frame['child_cpu']
                if self.stack:
                    self.stack[-1]['child_wall'] += wall
                    self.stack[-1]['child_cpu'] += cpu
        return call


def serve(components):
    sys.path[:0] = [str(HARN), str(ROOT / 'mcp')]
    import worker
    from quality import revise, relations
    from quality.features import RhymeField
    from quality.floor import SlopFloor
    import lyric_harness
    clock = ComponentClock()
    if components:
        targets = [(revise.Reviser, n) for n in
                   ('__init__', 'brief', 'inspect', 'verify', 'grade', 'group_merges',
                    '_matrix', '_field_one', '_rank_field', 'joint_field')]
        targets += [(relations, 'build_stream'), (relations, 'line_pairs_for'),
                    (RhymeField, 'field'), (lyric_harness.Lexicon, '__init__'),
                    (SlopFloor, 'check')]
        for owner, name in targets:
            setattr(owner, name, clock.wrap(owner.__name__ + '.' + name, getattr(owner, name)))
    for line in sys.stdin:
        request = json.loads(line)
        clock.rows = {}
        wall, cpu = time.perf_counter(), time.process_time()
        code, stdout, stderr = worker.run_one(request['argv'])
        elapsed, used = time.perf_counter()-wall, time.process_time()-cpu
        memory = {}
        for record in Path('/proc/self/status').read_text().splitlines():
            if record.startswith(('VmRSS:', 'VmHWM:')):
                key, number, _unit = record.split()
                memory[key.rstrip(':') + '_KiB'] = int(number)
        print(json.dumps(dict(code=code, stdout=stdout, stderr=stderr,
              cli_wall=elapsed, cli_cpu=used, memory=memory,
              maxrss_KiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              components=clock.rows,
              caches=dict(pair=relations.pair_memo_tally(), field=revise.field_memo_tally(), score=revise.score_memo_tally(),
                          rank=revise.rank_memo_tally()))), flush=True)


class Runner:
    def __init__(self, components=False):
        args = [sys.executable, __file__, '--serve']
        if components:
            args.append('--components')
        self.process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, text=True)
        self.replies = queue.Queue()
        def read():
            for line in self.process.stdout:
                self.replies.put(line)
            self.replies.put(None)
        threading.Thread(target=read, daemon=True).start()

    def call(self, argv, timeout):
        self.process.stdin.write(json.dumps(dict(argv=argv)) + '\n')
        self.process.stdin.flush()
        try:
            reply = self.replies.get(timeout=timeout)
        except queue.Empty:
            self.close()
            return dict(code=124, stdout='', stderr='measurement deadline', partial=True)
        if reply is None:
            raise RuntimeError('worker exited: ' + self.process.stderr.read())
        return json.loads(reply)

    def close(self):
        if self.process.poll() is None:
            self.process.kill()
        self.process.wait()
        for pipe in (self.process.stdin, self.process.stdout, self.process.stderr):
            pipe.close()


def normalise(stdout, directory):
    """Exclude run paths, the finish blueprint's temporary header path and memo counters."""
    stdout = re.sub(r'(?m)^(  BLUEPRINT: )\S*/finish_bp_[A-Za-z0-9_]+\.json(?= —)',
                    r'\1<BLUEPRINT>', stdout)
    kept = []
    for line in stdout.replace(str(directory), '<RUN>').splitlines():
        if line.strip().startswith(('REPLAY MEMO:', 'PAIR MEMO:', 'SCORE MEMO:')):
            continue
        if line.startswith('  lyric result: '):
            record = json.loads(line.removeprefix('  lyric result: '))
            for key in ('memo_state', 'memo_hit', 'memo_asked'):
                record.pop(key, None)
            line = '  lyric result: ' + json.dumps(record, sort_keys=True)
        kept.append(line)
    return '\n'.join(kept)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--serve', action='store_true', help=argparse.SUPPRESS)
    ap.add_argument('--components', action='store_true')
    ap.add_argument('--mode', choices=('cold', 'warm'), default='cold')
    ap.add_argument('--fixture', choices=('plan', 'density'), default='plan')
    ap.add_argument('--seed', type=int, default=16)
    ap.add_argument('--lines', type=int, default=22)
    ap.add_argument('--folds', type=int, default=11, help='resumes after the initial call')
    ap.add_argument('--timeout', type=float, default=600,
                    help='seconds one call may take; the ceiling is the '
                         'deployed maxTurnMs read from mcp/gemini_agent.js')
    ap.add_argument('--out', type=Path)
    a = ap.parse_args()
    if a.serve:
        return serve(a.components)
    if a.out is None or a.out.exists():
        ap.error('--out must name a new directory; existing evidence is never overwritten')
    ceiling = deployed_turn_seconds()
    if a.lines < 2 or a.folds < 0 or not 0 < a.timeout <= ceiling:
        ap.error('require lines >= 2, folds >= 0, 0 < timeout <= %g '
                 '(the deployed maxTurnMs)' % ceiling)
    if a.fixture == 'density' and a.lines % 2:
        ap.error('density fixture requires an even number of lines')
    a.out.mkdir(parents=True)
    sys.path.insert(0, str(HARN))
    from quality.fold_series import BANK, answer_pending
    from profile_lyrics_phase import source_hashes
    plan = a.out.resolve() / 'plan.json'
    setup = subprocess.run([sys.executable, str(HARN / 'lyric_harness.py'), 'plan',
                            f'--seed={a.seed}', f'--lines={a.lines}', f'--out={plan}'],
                           cwd=HARN, capture_output=True, text=True, timeout=a.timeout)
    (a.out / 'plan.stdout').write_text(setup.stdout)
    (a.out / 'plan.stderr').write_text(setup.stderr)
    if setup.returncode != 0:
        raise ValueError(f'planner refused: {setup.returncode}; see plan.stderr')
    n = json.loads(plan.read_text())['total_lines']
    if n != a.lines:
        raise ValueError('planner changed the requested length')
    draft, state = a.out.resolve() / 'draft.txt', a.out.resolve() / 'state.json'
    lines = [f'we carry the morning to the {BANK[i % len(BANK)]}' for i in range(n)]
    if a.fixture == 'density':
        # test_replay_memo's answered, declared assonance density-repair pair.
        lines = ['The elephant elephant elephant elephant elephant elephant stove'
                 if i % 2 == 0 else 'Your fingers brush my heavy coat' for i in range(n)]
    draft.write_text('\n'.join(lines) + '\n')
    command = ['finish', str(draft), f'--seed={a.seed}', f'--lines={n}', f'--propose=defer:{state}']
    if a.fixture == 'density':
        groups = ';'.join(f'{i},{i+1}' for i in range(1, n, 2))
        command = ['revise', str(draft), '--groups='+groups, '--relation=class:ASSONANCE',
                   '--max-rounds=1', '--attempts=1', '--backtrack=0', f'--propose=defer:{state}']
    sources = source_hashes(ROOT)
    sources['continuation_instrument'] = digest(Path(__file__).read_bytes())
    runtime_files = [ROOT / 'mcp/worker.py', HARN / 'cmudict.dict',
                     HARN / 'data/opensubtitles_en_50k.tsv', HARN / 'data/runtime_assets.json']
    report = dict(version=1, head=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                  mode=a.mode, fixture=a.fixture, components=a.components, seed=a.seed,
                  lines=n, requested_resumes=a.folds, argv=command, source_sha256=sources,
                  python=sys.version, draft_sha256=digest(draft.read_bytes()),
                  runtime_sha256={str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in runtime_files},
                  host=dict(platform=platform.platform(), cpu_count=os.cpu_count(),
                            affinity=sorted(os.sched_getaffinity(0))),
                  memo_environment={k: v for k, v in os.environ.items() if k.startswith('LYRIC_') and k.endswith('MEMO')},
                  rows=[], capacity_qualified=False)
    worker = None
    try:
        for fold in range(a.folds + 1):
            on_record = 0
            if state.exists():
                before = json.loads(state.read_text())
                on_record = sum(len(before['answered'][k]) for k in ('propose', 'propose_group'))
            started = time.perf_counter()
            load = os.getloadavg()
            if worker is None:
                worker = Runner(a.components)
            result = worker.call(command, a.timeout)
            wall = time.perf_counter()-started
            if a.mode == 'cold':
                worker.close()
                worker = None
            stdout, stderr = result.pop('stdout'), result.pop('stderr')
            (a.out / f'{fold:02d}.stdout').write_text(stdout)
            (a.out / f'{fold:02d}.stderr').write_text(stderr)
            row = dict(fold=fold, answers_before=on_record, wall=wall, **result,
                       load_average=load,
                       stdout_sha256=digest(stdout.encode()),
                       semantic_sha256=digest(normalise(stdout, a.out.resolve()).encode()),
                       stderr_semantic_sha256=digest(stderr.replace(str(a.out.resolve()), '<RUN>').encode()))
            journal = json.loads(state.read_text()) if state.exists() else None
            if journal is not None:
                (a.out / f'{fold:02d}.journal.json').write_text(json.dumps(journal, indent=2)+'\n')
                row['journal_sha256'] = digest(json.dumps(journal, sort_keys=True).encode())
            pending = journal.get('pending') if journal else None
            row['pending'] = ({k: v for k, v in pending.items() if k in ('kind', 'record')}
                              if pending else None)
            report['rows'].append(row)
            report['last_attempted_resume'] = fold
            report['completed_resumes'] = (fold if result['code'] in (0, 3, 4)
                                           and not result.get('partial') else max(0, fold-1))
            report['last_exit_code'] = result['code']
            (a.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
            print(f'{a.mode} {a.fixture} n={n} fold={fold} rc={result["code"]} wall={wall:.3f} answers={on_record}', flush=True)
            if result['code'] != 4:
                break
            if not pending:
                raise RuntimeError('suspended call has no pending question')
            answer = answer_pending(pending, fold, (lambda _: 'My kettle whistles by the stove')
                                    if a.fixture == 'density' else None)
            journal['pending']['answer'] = answer
            state.write_text(json.dumps(journal, indent=2)+'\n')
    finally:
        if worker is not None:
            worker.close()
        report['source_unchanged'] = (source_hashes(ROOT) == {k: v for k, v in sources.items() if k != 'continuation_instrument'}
                                    and digest(Path(__file__).read_bytes()) == sources['continuation_instrument'])
        (a.out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
    return 0 if report['last_exit_code'] in (0, 3, 4) else 2


if __name__ == '__main__':
    sys.exit(main())
