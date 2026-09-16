"""Melody-first API and real CLI contract, including malformed declarations."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality import plan
from quality.melody import validate_melody

PHRASE = {'meter': {'beats': 4, 'unit': 4, 'groups': [2, 2]},
          'bars': 2, 'subdivision': 2,
          'notes': [{'pitch_hz': 432.5, 'ticks': 3},
                    {'pitch_hz': None, 'ticks': 1},
                    {'pitch_hz': 487.2, 'ticks': 4},
                    {'pitch_hz': 432.5, 'ticks': 8}]}

class MelodyTests(unittest.TestCase):
    def test_tune_controls_grid_and_survives_fill(self):
        tune = copy.deepcopy(PHRASE)
        p = plan.make_plan(3, lines=16, narrative='off', melody=tune)
        self.assertEqual(p, plan.make_plan(3, lines=16, narrative='off', melody=tune))
        self.assertEqual(p['melody'], tune)
        self.assertEqual(p['request']['melody'], tune)
        self.assertTrue(all(s['meter'] == tune['meter'] for s in p['sections']))
        self.assertTrue(all(s['duration'] == 8 and s['beat'] == 1 for s in p['line_slots']))
        self.assertEqual(p['subdivision'], 2)
        self.assertEqual(p['choices']['meter']['chosen_from'], 'declared melody; no meter draw')
        self.assertIn('487.2 Hz / 4 ticks', p['writer_brief'])
        self.assertIn('not certified', p['writer_brief'])
        bp = plan.fill_plan(p, ['The red sun falls into the sea'] * 16)
        self.assertEqual(bp['melody'], tune)
        bp['melody']['notes'][0]['pitch_hz'] = 100
        tune['notes'][0]['pitch_hz'] = 200
        self.assertEqual(p['melody']['notes'][0]['pitch_hz'], 432.5)
        self.assertTrue(plan.render_song(p, ['The red sun falls into the sea'] * 16))

    def test_invalid_coordinates_refuse(self):
        cases = [None, [], {}, dict(PHRASE, extra=True), dict(PHRASE, bars=True),
                 dict(PHRASE, subdivision=3), dict(PHRASE, notes=[])]
        for pitch in [True, -1, 0, float('nan'), float('inf'), 'C4']:
            cases.append(dict(PHRASE, notes=[{'pitch_hz': pitch, 'ticks': 16}]))
        for ticks in [True, 0, -1, 0.5, 15]:
            cases.append(dict(PHRASE, notes=[{'pitch_hz': 440, 'ticks': ticks}]))
        cases.append(dict(PHRASE, notes=[{'pitch_hz': None, 'ticks': 16}]))
        cases.append(dict(PHRASE, meter={'beats': 4, 'unit': 4, 'groups': [3, 2]}))
        for value in cases:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'melody:'):
                validate_melody(value)
        with self.assertRaisesRegex(plan.PlanRefused, 'envelope'):
            plan.make_plan(3, lines=16, melody=dict(PHRASE, bars=100,
                notes=[{'pitch_hz': 440, 'ticks': 800}]))

    def test_cli_plan_fill_and_refill_carry_tune(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            out, draft = Path(tmp)/'plan.json', Path(tmp)/'draft.txt'
            args = [sys.executable, str(root/'lyric_harness.py'), 'plan',
                    '--seed=3', '--lines=16', '--narrative=off',
                    '--melody=' + json.dumps(PHRASE), '--out=' + str(out)]
            r = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn('--melody=', r.stdout)
            self.assertEqual(json.loads(out.read_text())['melody'], PHRASE)
            draft.write_text(('The red sun falls into the sea\n') * 16)
            r = subprocess.run(args + ['--fill=' + str(draft)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertEqual(json.loads(out.read_text())['melody'], PHRASE)
            r = subprocess.run(args[:-2] + ['--melody={broken'], capture_output=True, text=True)
            self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
            self.assertNotIn('Traceback', r.stderr)

if __name__ == '__main__':
    unittest.main()
