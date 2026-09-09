#!/usr/bin/env python3
"""Profile the first writer menu on the real finish/defer CLI path.

Initial assessment runs without cProfile; the first Reviser.brief call with
include_offers=True activates it. The original method receives every argument
unchanged. --keep-profiling captures the complete bounded menu-selection
window, including later menus when an earlier one cannot supply a question.
Overall and phase deadlines preserve partial statistics and phase records. Profiled durations are diagnostics, never capacity qualification.

Example (use the retained draft and plan from a failed capacity measurement):
  python3 scripts/profile_lyrics_phase.py --seed=20260908 --lines=31 \
    --draft=/path/draft.txt --plan=/path/plan.json --out=/path/profile
"""
import argparse
import contextlib
import cProfile
import functools
import hashlib
import json
import os
from pathlib import Path
import pstats
import signal
import sys
import tempfile
import time


class ProfileDeadline(BaseException):
    """Instrumentation stop: deliberately outside the CLI's refusal handlers."""


class FirstMenuProfile:
    def __init__(self, event, *, keep_profiling=False, target_line=None):
        self.keep_profiling = keep_profiling
        self.target_line = target_line
        self.profiler = cProfile.Profile()
        self.event = event
        self.started = False
        self.active = False
        self.completed = False
        self.calls = 0

    def wrap(self, original):
        @functools.wraps(original)
        def brief(instance, *args, **kwargs):
            self.calls += 1
            number = self.calls
            menu = kwargs.get('include_offers', True)
            target = kwargs.get('target_lines')
            visible_target = target if isinstance(target, (list, tuple, set, frozenset)) else None
            self.event('brief_started', call=number, include_offers=menu,
                       target_lines=None if visible_target is None else sorted(visible_target))
            selected = self.target_line is None or (visible_target is not None and self.target_line in visible_target)
            first = menu and selected and not self.started
            if first:
                self.started = True
                self.active = True
                self.event('profile_started', call=number)
                self.profiler.enable()
            try:
                result = original(instance, *args, **kwargs)
            except BaseException:
                if self.active:
                    self.profiler.disable()
                    self.active = False
                    self.event('profile_interrupted', call=number)
                raise
            if first and not self.keep_profiling:
                self.profiler.disable()
                self.active = False
                self.completed = True
                self.event('profile_completed', call=number)
            elif first:
                self.event('first_menu_completed', call=number)
            self.event('brief_completed', call=number, include_offers=menu)
            return result
        return brief


def source_hashes(root):
    files = [root / 'lyric-harness/lyric_harness.py']
    files.extend(sorted((root / 'lyric-harness/quality').rglob('*.py')))
    files = [p for p in files if not {'data', 'corpus', '__pycache__'} & set(p.parts)]
    result = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in files}
    result['instrument'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return result


def write_top(profiler, path):
    """Render the cumulative-time table for `profiler` into `path`.

    -> None when it rendered, or a one-line note when it could not.

    THE PROFILE IS DIAGNOSTIC; THE RUN'S VERDICT IS THE PRODUCT. This is
    called from `main`'s `finally`, where an exception does not merely lose
    the table — it replaces the exit code the run had already decided and
    loses the report with it. MEASURED: a phase deadline that fires before
    the profiler records a single call leaves its stats EMPTY, and
    `pstats.Stats` raises `TypeError: Cannot create or construct a Stats
    object from <cProfile.Profile ...>` on empty stats (`pstats.load_stats`'
    final guard, which sits outside its own elif chain). CI run 1505 exited
    1 where its test asserts 124, and the deadline the run correctly
    detected never reached the report.

    Python 3.11 and 3.12 do not agree on exactly when that guard fires — an
    enable/disable with nothing between raises on the runner's 3.12 and not
    on 3.11 — so this does not test for emptiness and hope the predicate
    matches the interpreter. It renders, and if rendering fails for any
    reason it says so in the file and hands the caller a note. The `.cprof`
    dump is written before this and is unaffected either way, so nothing a
    reader needs is lost.
    """
    try:
        with path.open('w') as top:
            pstats.Stats(profiler, stream=top).strip_dirs().sort_stats(
                'cumulative').print_stats(80)
        return None
    except Exception as exc:
        note = f'{type(exc).__name__}: {exc}'
        with path.open('w') as top:
            top.write(f'no profile table: {note}\n')
        return note


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo-root', type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument('--seed', type=int, required=True)
    ap.add_argument('--lines', type=int, required=True)
    ap.add_argument('--draft', type=Path, required=True)
    ap.add_argument('--plan', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True, help='output prefix; files must not exist')
    ap.add_argument('--wall-seconds', type=float, default=600)
    ap.add_argument('--phase-seconds', type=float, default=120)
    ap.add_argument('--profile-target-line', type=int, help='start only when a menu explicitly targets this line')
    ap.add_argument('--keep-profiling', action='store_true',
                    help='profile the whole bounded selection window after the first menu starts')
    a = ap.parse_args()
    if not 0 < a.phase_seconds <= a.wall_seconds <= 600:
        ap.error('require 0 < phase-seconds <= wall-seconds <= 600; profiling cannot raise the call limit')
    if a.profile_target_line is not None and not 1 <= a.profile_target_line <= a.lines:
        ap.error('profile-target-line must be within the declared draft')
    root, prefix = a.repo_root.resolve(), a.out.resolve()
    draft, plan_path = a.draft.resolve(), a.plan.resolve()
    outputs = {name: Path(str(prefix) + suffix) for name, suffix in (
        ('report', '.json'), ('stats', '.cprof'), ('top', '.top.txt'), ('stdout', '.stdout'), ('stderr', '.stderr'))}
    if any(p.exists() for p in outputs.values()):
        ap.error('output already exists; use a new prefix to preserve prior evidence')
    prefix.parent.mkdir(parents=True, exist_ok=True)
    report = {'version': 1, 'status': 'starting', 'capacity_qualified': False,
              'meaning': 'Profiling starts at the first writer menu; the selected scope is diagnostic, not capacity evidence.',
              'profile_scope': 'selection_window' if a.keep_profiling else 'one_menu',
              'profile_target_line': a.profile_target_line,
              'wall_limit_seconds': a.wall_seconds, 'phase_limit_seconds': a.phase_seconds,
              'source_sha256': source_hashes(root), 'events': [],
              'draft_sha256': hashlib.sha256(draft.read_bytes()).hexdigest(),
              'plan_sha256': hashlib.sha256(plan_path.read_bytes()).hexdigest()}
    progress = sys.stdout
    start = time.monotonic()
    absolute_deadline = start + a.wall_seconds
    phase_deadline = None

    def save():
        outputs['report'].write_text(json.dumps(report, indent=2) + '\n')

    def event(name, **detail):
        nonlocal phase_deadline
        now = time.monotonic()
        report['events'].append({'event': name, 'elapsed_seconds': round(now - start, 6), **detail})
        if name == 'profile_started':
            phase_deadline = now + a.phase_seconds
            signal.setitimer(signal.ITIMER_REAL, max(.001, min(absolute_deadline, phase_deadline) - now))
        elif name in ('profile_completed', 'profile_interrupted'):
            phase_deadline = None
            signal.setitimer(signal.ITIMER_REAL, max(.001, absolute_deadline - now))
        save()
        print(f"{now - start:.3f}s {name} {json.dumps(detail, sort_keys=True)}", file=progress, flush=True)

    def expired(_signum, _frame):
        now = time.monotonic()
        raise ProfileDeadline('phase_deadline' if phase_deadline and phase_deadline <= now else 'wall_deadline')

    old_handler = signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, a.wall_seconds)
    old_cwd, old_argv = Path.cwd(), sys.argv
    capture = FirstMenuProfile(event, keep_profiling=a.keep_profiling, target_line=a.profile_target_line)
    original_brief = None
    exit_code = 1
    try:
        os.chdir(root / 'lyric-harness')
        sys.path.insert(0, str(root / 'lyric-harness'))
        import lyric_harness as lh
        from quality.revise import Reviser
        with tempfile.TemporaryDirectory(prefix='lyrics-menu-profile-') as tmp, \
                outputs['stdout'].open('w') as stdout, outputs['stderr'].open('w') as stderr, \
                contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            generated = Path(tmp) / 'plan.json'
            sys.argv = ['lyric_harness.py', 'plan', f'--seed={a.seed}', f'--lines={a.lines}', f'--out={generated}']
            report['setup_argv'] = sys.argv[:]
            setup_code = lh.cli()
            if setup_code not in (None, 0):
                raise ValueError(f'plan setup refused: {setup_code}')
            current, stored = json.loads(generated.read_text()), json.loads(plan_path.read_text())
            changed = sorted(k for k in set(current) | set(stored) if current.get(k) != stored.get(k))
            report['plan_changed_keys'] = changed
            if changed:
                raise ValueError('stored plan differs from current CLI plan: ' + ', '.join(changed))
            event('fixture_verified')
            journal = Path(tmp) / 'journal.json'
            sys.argv = ['lyric_harness.py', 'finish', str(draft), f'--seed={a.seed}',
                        f'--lines={a.lines}', f'--propose=defer:{journal}']
            report['argv'] = sys.argv[:]
            original_brief = Reviser.brief
            Reviser.brief = capture.wrap(original_brief)
            event('cli_started')
            try:
                try:
                    code = lh.cli()
                except SystemExit as exc:
                    code = exc.code
                report.update(status='cli_completed', cli_exit_code=code)
                if capture.active:
                    capture.profiler.disable()
                    capture.active = False
                    capture.completed = True
                    event('profile_completed', call=capture.calls)
            finally:
                if journal.exists():
                    raw = journal.read_bytes()
                    Path(str(prefix) + '.journal.json').write_bytes(raw)
                    report['journal_sha256'] = hashlib.sha256(raw).hexdigest()
            exit_code = 0 if capture.completed else 1
    except KeyboardInterrupt:
        report.update(status='operator_interrupted', partial=True)
        exit_code = 130
    except ProfileDeadline as exc:
        report.update(status='profile_timeout', stop_reason=str(exc), partial=True)
        exit_code = 124
    except Exception as exc:
        report.update(status='instrument_error', error=f'{type(exc).__name__}: {exc}')
    finally:
        capture.profiler.disable()
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_handler)
        if original_brief is not None:
            Reviser.brief = original_brief
        sys.argv = old_argv
        os.chdir(old_cwd)
        report.update(elapsed_seconds=time.monotonic() - start, profile_started=capture.started,
                      profile_completed=capture.completed,
                      source_unchanged=source_hashes(root) == report['source_sha256'])
        if capture.started:
            capture.profiler.dump_stats(str(outputs['stats']))
            note = write_top(capture.profiler, outputs['top'])
            if note:
                report['profile_top_error'] = note
        save()
    print(json.dumps({k: report[k] for k in ('status', 'elapsed_seconds', 'profile_started', 'profile_completed', 'source_unchanged')}), flush=True)
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
