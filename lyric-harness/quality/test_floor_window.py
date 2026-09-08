"""A declared metric window cannot borrow another statistic's calibration."""
from dataclasses import asdict
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality.floor import FloorDeclaration, SlopFloor
from quality.loop import revise_loop
from quality.revise import Reviser, ReviseDeclaration
from quality.schemes import mandate

LINES = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat']


class FloorWindowTests(unittest.TestCase):
    def test_default_and_explicit_calibrated_window_are_identical(self):
        lines = LINES * 5
        ordinary = SlopFloor().check(lines, '?' * len(lines))
        declared = SlopFloor(FloorDeclaration(mattr_window=50)).check(lines, '?' * len(lines))
        self.assertEqual([asdict(f) for f in ordinary], [asdict(f) for f in declared])
        self.assertTrue(any(f.code == 'LEXICAL_MONOTONY' for f in ordinary))

    def test_unmeasured_window_refuses_coverage_and_clean_completion(self):
        r = Reviser(floor=SlopFloor(FloorDeclaration(mattr_window=20)),
                    rdecl=ReviseDeclaration(attempts_per_line=0, backtrack_width=0))
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        found = r.inspect(LINES, m)
        self.assertEqual(found['coverage']['refused_obligations'], ['floor:draft'])
        refusal = next(f for f in found['whole'] if f.code == 'MATTR_WINDOW_UNCALIBRATED')
        self.assertIn('WITHDRAWN', refusal.evidence)
        self.assertFalse(found['coverage']['certified'])
        stopped = revise_loop(r, LINES, m)
        self.assertEqual(stopped.stop_reason, 'uncertified')
        self.assertEqual(stopped.lines, LINES)
        self.assertFalse(stopped.coverage_certified)

    def test_explicit_cut_remains_caller_owned_and_can_be_judged(self):
        floor = SlopFloor(FloorDeclaration(mattr_window=20, mattr_min=0.9))
        findings = floor.check(LINES * 5, '?' * 10)
        lexical = next(f for f in findings if f.code == 'LEXICAL_MONOTONY')
        self.assertIn('DECLARED by the caller', lexical.evidence)
        self.assertIn('WITHDRAWN', lexical.evidence)
        self.assertNotIn('4.88%', lexical.evidence)
        self.assertFalse(any(f.code == 'MATTR_WINDOW_UNCALIBRATED' for f in findings))
        r = Reviser(floor=SlopFloor(FloorDeclaration(mattr_window=20, mattr_min=0.001)))
        found = r.inspect(LINES, mandate('AA', n_lines=2, default_relation='class:ASSONANCE'))
        self.assertTrue(found['coverage']['certified'])
        self.assertFalse([f for fs in found['per_line'].values() for f in fs if f.severity == 'flag'])

    def test_window_must_be_a_positive_integer(self):
        for window in (0, -1, True, 20.0, '20'):
            with self.subTest(window=window), self.assertRaises(ValueError):
                SlopFloor(FloorDeclaration(mattr_window=window))


if __name__ == '__main__':
    unittest.main()
