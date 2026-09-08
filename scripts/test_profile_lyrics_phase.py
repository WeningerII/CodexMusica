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
                ' time.sleep(.4)\n return 4\n')
            (root / 'draft.txt').write_text('exact input')
            (root / 'plan.json').write_text('{}')
            for label, delay, expected in [('phase', '.2', 'phase_deadline'), ('wall', '.001', 'wall_deadline')]:
                out = root / label
                command = [sys.executable, str(MODULE), '--repo-root=' + str(root),
                           '--seed=1', '--lines=1', '--draft=' + str(root / 'draft.txt'),
                           '--plan=' + str(root / 'plan.json'), '--out=' + str(out),
                           '--phase-seconds=.05', '--wall-seconds=.2']
                result = subprocess.run(command, env=dict(os.environ, FAKE_MENU_DELAY=delay),
                                        capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 124, result.stderr)
                report = json.loads(out.with_suffix('.json').read_text())
                self.assertEqual(report['stop_reason'], expected)
                self.assertTrue(report['profile_started'])
                self.assertEqual(report['profile_completed'], label == 'wall')
                self.assertTrue(out.with_suffix('.cprof').exists())

    def test_initial_refusal_never_starts_menu_profile(self):
        profile = phase.FirstMenuProfile(lambda *_args, **_kw: None)

        def refused(_instance, **_kwargs):
            raise ValueError('declared refusal')

        with self.assertRaisesRegex(ValueError, 'declared refusal'):
            profile.wrap(refused)(object(), include_offers=False)
        self.assertFalse(profile.started)


if __name__ == '__main__':
    unittest.main()
