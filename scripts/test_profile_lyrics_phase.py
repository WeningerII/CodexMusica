"""Controls for phase profiling: initial assessment untouched, args unchanged, partial stats kept."""
import importlib.util
from pathlib import Path
import pstats
import json
import os
import subprocess
import sys
import tempfile
import unittest

MODULE = Path(__file__).with_name('profile_lyrics_phase.py')
spec = importlib.util.spec_from_file_location('profile_lyrics_phase', MODULE)
phase = importlib.util.module_from_spec(spec)
spec.loader.exec_module(phase)


class FirstMenuProfileTests(unittest.TestCase):
    def test_profiles_only_first_menu_and_preserves_every_argument(self):
        events, calls = [], []
        profile = phase.FirstMenuProfile(lambda kind, **kw: events.append((kind, kw)))
        owner, lines, mandate = object(), ['unchanged words'], object()

        def original(instance, received_lines, received_mandate, *, include_offers=True, target_lines=None):
            calls.append((instance, received_lines, received_mandate, include_offers, target_lines, profile.active))
            return received_lines

        wrapped = profile.wrap(original)
        self.assertIs(wrapped(owner, lines, mandate, include_offers=False), lines)
        self.assertFalse(profile.started)
        self.assertIs(wrapped(owner, lines, mandate, include_offers=True, target_lines={2, 1}), lines)
        wrapped(owner, lines, mandate, include_offers=True)
        self.assertEqual([row[-1] for row in calls], [False, True, False])
        self.assertTrue(all(row[:3] == (owner, lines, mandate) for row in calls))
        self.assertEqual(calls[1][4], {1, 2})
        self.assertEqual(sum(kind == 'profile_started' for kind, _ in events), 1)
        original_stats = [value for key, value in pstats.Stats(profile.profiler).stats.items() if key[2] == 'original']
        self.assertEqual(sum(value[0] for value in original_stats), 1)

    def test_partial_timeout_disables_profile_and_preserves_stats(self):
        events = []
        profile = phase.FirstMenuProfile(lambda kind, **kw: events.append(kind))

        def interrupted(_instance, **_kwargs):
            sum(range(100))
            raise phase.ProfileDeadline('phase_deadline')

        with self.assertRaisesRegex(phase.ProfileDeadline, 'phase_deadline'):
            profile.wrap(interrupted)(object(), include_offers=True)
        self.assertTrue(profile.started)
        self.assertFalse(profile.active)
        self.assertFalse(profile.completed)
        self.assertIn('profile_interrupted', events)
        self.assertTrue(pstats.Stats(profile.profiler).stats)

    def test_selection_window_includes_later_menus_until_deadline(self):
        active = []
        profile = phase.FirstMenuProfile(lambda *_args, **_kw: None, keep_profiling=True)

        def original(_instance, **_kwargs):
            active.append(profile.active)
            if len(active) == 3:
                raise phase.ProfileDeadline('phase_deadline')

        wrapped = profile.wrap(original)
        wrapped(object(), include_offers=False)
        wrapped(object(), include_offers=True)
        with self.assertRaises(phase.ProfileDeadline):
            wrapped(object(), include_offers=True)
        self.assertEqual(active, [False, True, True])
        self.assertFalse(profile.active)
        self.assertFalse(profile.completed)
        original_stats = [value for key, value in pstats.Stats(profile.profiler).stats.items() if key[2] == 'original']
        self.assertEqual(sum(value[0] for value in original_stats), 2)

    def test_target_selector_preserves_earlier_menu_cache_warmup(self):
        active = []
        profile = phase.FirstMenuProfile(lambda *_args, **_kw: None, target_line=15)

        def original(_instance, **_kwargs):
            active.append(profile.active)

        wrapped = profile.wrap(original)
        for target in (1, 5, 9, 10, 15):
            wrapped(object(), include_offers=True, target_lines=[target])
        self.assertEqual(active, [False, False, False, False, True])
        self.assertTrue(profile.completed)

    def test_logging_does_not_consume_an_iterable_argument(self):
        profile = phase.FirstMenuProfile(lambda *_args, **_kw: None)
        target = iter([2, 4])

        def original(_instance, *, include_offers, target_lines):
            self.assertIs(target_lines, target)
            return list(target_lines)

        result = profile.wrap(original)(object(), include_offers=True, target_lines=target)
        self.assertEqual(result, [2, 4])

    def test_real_runner_distinguishes_partial_phase_and_later_wall_deadlines(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            quality = root / 'lyric-harness/quality'
            quality.mkdir(parents=True)
            (quality / '__init__.py').write_text('')
            (quality / 'revise.py').write_text(
                'import os,time\nclass Reviser:\n'
                ' def brief(self,*args,include_offers=True,**kwargs):\n'
                '  if include_offers: time.sleep(float(os.environ["FAKE_MENU_DELAY"]))\n')
            (root / 'lyric-harness/lyric_harness.py').write_text(
                'import sys,time\nfrom pathlib import Path\nfrom quality.revise import Reviser\n'
                'def cli():\n'
                ' if sys.argv[1]=="plan":\n'
                '  Path(next(a[6:] for a in sys.argv if a.startswith("--out="))).write_text("{}")\n'
                '  return 0\n'
                ' r=Reviser()\n r.brief([],include_offers=False)\n'
                ' r.brief([],include_offers=True,target_lines=[1])\n'
                ' time.sleep(10)\n return 4\n')
            (root / 'draft.txt').write_text('exact input')
            (root / 'plan.json').write_text('{}')
            # THE TWO BUDGETS ARE MEASURED FROM DIFFERENT ZEROS, and that is the
            # whole reason these numbers are what they are. The wall budget runs
            # from the RUNNER's start; the phase budget only begins at
            # `profile_started`, once the run has imported the harness, chdir'd,
            # and made the un-profiled first menu call. So every second of
            # interpreter startup is spent out of the wall budget and none of it
            # out of the phase budget, and a wall budget close to startup cost
            # decides the outcome instead of the behaviour under test.
            #
            # It shipped at wall=.2 against phase=.05, leaving 0.15s for all of
            # that startup. CI run 1689 (main, ab2bf837) spent more than that --
            # 48 leaves, 4 at a time -- and this test reported
            # `'wall_deadline' != 'phase_deadline'` on code identical to a green
            # main. MEASURED by standing in for startup with a sleep before the
            # harness import, both cases break at +0.20s and hold at +0.10s.
            #
            # wall=2 moves that cliff past 1.5s of startup (measured at +0.0,
            # +0.2, +0.5, +1.0 and +1.5s, both cases correct at every point),
            # and the post-profile sleep goes to 10s so the wall case still
            # expires DURING it rather than after the run would have ended.
            # Neither budget's meaning changes: the phase case's menu still
            # overruns its phase budget 4x, the wall case's still finishes far
            # inside it.
            #
            # THE SAME RACE HAS A SECOND DOOR, and phase=.05 was it. In the wall
            # case the run must get from `profile_started` (which arms a 50 ms
            # timer) through the 1 ms menu call to the `profile_completed`
            # event that re-arms it, within those 50 ms of WALL time -- a
            # scheduler stall anywhere in that window fires the phase alarm on
            # a 1 ms call. CI run 35529580957 (PR 363, fbc76a6f: two markdown
            # files) reported exactly that, `'phase_deadline' !=
            # 'wall_deadline'` with profile_started true, on a `verify` job
            # running 53 leaves 4 at a time; main was green on the same
            # scripts. MEASURED here with a sleep inside the profiled call
            # standing in for the stall: at phase=.05 a 60 ms stall already
            # reads phase_deadline; at phase=.5 stalls of 60, 100 and 400 ms
            # all read wall_deadline and 600 ms reads phase_deadline, which is
            # the budget doing its job. Under 32 busy loops on 4 CPUs the
            # observed window was 7 ms, so the box cannot reproduce CI's stall
            # -- the stand-in is the evidence. phase=.5 (delay 2, still a 4x
            # overrun) and wall=4 keep every ordering: the phase case's alarm
            # fires at startup+0.5 s, before the wall's 4 s for any startup
            # under 3.5 s; the wall case's 4 s still expires during the 10 s
            # post-profile sleep. Both cases correct at 0, 0.06, 0.1 and 0.4 s
            # of stall, and 3 of 3 under the 32-loop contention.
            for label, delay, expected in [('phase', '2', 'phase_deadline'), ('wall', '.001', 'wall_deadline')]:
                out = root / label
                command = [sys.executable, str(MODULE), '--repo-root=' + str(root),
                           '--seed=1', '--lines=1', '--draft=' + str(root / 'draft.txt'),
                           '--plan=' + str(root / 'plan.json'), '--out=' + str(out),
                           '--phase-seconds=.5', '--wall-seconds=4']
                result = subprocess.run(command, env=dict(os.environ, FAKE_MENU_DELAY=delay),
                                        capture_output=True, text=True, timeout=60)
                self.assertEqual(result.returncode, 124, result.stderr)
                report = json.loads(out.with_suffix('.json').read_text())
                # ASSERTED FIRST, because it is the precondition for the stop
                # reason meaning anything. When the budget above is exhausted by
                # startup the run never reaches the profiled call at all, and
                # checking `stop_reason` first reported that as a bare label
                # mismatch -- which is how the CI failure above read, and why it
                # looked like a behaviour change rather than a starved run.
                self.assertTrue(report['profile_started'],
                                f'{label}: the run never reached the profiled call; '
                                f'--wall-seconds was spent on startup, not on the phase')
                self.assertEqual(report['stop_reason'], expected)
                self.assertEqual(report['profile_completed'], label == 'wall')
                self.assertTrue(out.with_suffix('.cprof').exists())

    def test_the_top_table_never_takes_the_runs_exit_code_with_it(self):
        """The empty-profiler crash, pinned deterministically.

        The runner writes its table from `main`'s `finally`, so a raise there
        replaces the exit code the run already decided. CI run 1505 hit it:
        a phase deadline fired before the profiler recorded a call, its stats
        were empty, `pstats.Stats` raised TypeError, and the process exited 1
        where `test_real_runner_...` above asserts 124. That test only catches
        this when the timing happens to empty the profiler, which is a
        coin-flip on a loaded runner — so the path is exercised directly here
        instead, with no deadline and no subprocess.
        """
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'top.txt'

            # A profiler that started and recorded NOTHING — the shape the
            # deadline produces. 3.11 and 3.12 disagree on whether this
            # raises, so the assertion is on the CONTRACT, not on the raise.
            empty = phase.cProfile.Profile()
            empty.enable()
            empty.disable()
            note = phase.write_top(empty, out)
            self.assertTrue(out.exists())
            if note is not None:
                self.assertIn('no profile table', out.read_text())

            # And one that DID record: the table must actually be rendered.
            live = phase.cProfile.Profile()
            live.enable()
            sum(range(1000))
            live.disable()
            out2 = Path(tmp) / 'top2.txt'
            self.assertIsNone(phase.write_top(live, out2))
            self.assertIn('cumulative', out2.read_text())

            # THE POINT: a renderer that cannot render still returns, so the
            # caller's own verdict survives. An object that is not a profiler
            # at all is the strongest form of that.
            out3 = Path(tmp) / 'top3.txt'
            self.assertIsNotNone(phase.write_top(object(), out3))
            self.assertIn('no profile table', out3.read_text())

    def test_initial_refusal_never_starts_menu_profile(self):
        profile = phase.FirstMenuProfile(lambda *_args, **_kw: None)

        def refused(_instance, **_kwargs):
            raise ValueError('declared refusal')

        with self.assertRaisesRegex(ValueError, 'declared refusal'):
            profile.wrap(refused)(object(), include_offers=False)
        self.assertFalse(profile.started)


if __name__ == '__main__':
    unittest.main()
