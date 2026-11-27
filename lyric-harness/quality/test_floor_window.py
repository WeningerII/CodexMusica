"""The floor has no word-variety window to declare.

REPINNED 2026-11-22 (owner's ruling): ~~A declared metric window cannot borrow
another statistic's calibration.~~ The word-variety check (LEXICAL_MONOTONY,
LEXICAL_REPETITION_DECLARED, MATTR_WINDOW_UNCALIBRATED) and the same-first-word
check (ANAPHORA_OVERLOAD, ANAPHORA_DECLARED) were removed from the grader, and
with them the declaration's `mattr_window`, `mattr_min` and `anaphora_max`
fields. These tests held the window's calibration; they now hold that the
checks and their fields are gone, so a repetitive draft is not stopped for
repeating itself, and a caller who still declares one of the fields is told
at once rather than ignored.
"""
from dataclasses import asdict
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality.floor import FLOOR_GATE_CODES, FloorDeclaration, SlopFloor
from quality.loop import revise_loop
from quality.revise import Reviser, ReviseDeclaration
from quality.schemes import mandate

LINES = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat']

#: The five codes the two removed checks emitted.
REMOVED = {'LEXICAL_MONOTONY', 'LEXICAL_REPETITION_DECLARED',
           'MATTR_WINDOW_UNCALIBRATED', 'ANAPHORA_OVERLOAD', 'ANAPHORA_DECLARED'}

#: The declaration fields that went with them.
REMOVED_FIELDS = ('mattr_window', 'mattr_min', 'anaphora_max')


class FloorWindowTests(unittest.TestCase):
    def test_a_repeated_couplet_is_not_flagged_for_repeating(self):
        # REPINNED 2026-11-22: ~~the default and an explicit calibrated
        # window are identical, and both flag LEXICAL_MONOTONY~~. The same
        # couplet five times over is ten lines of five distinct word pairs;
        # the floor no longer judges its word variety at all.
        lines = LINES * 5
        findings = SlopFloor().check(lines, '?' * len(lines))
        self.assertFalse(REMOVED & {f.code for f in findings})
        self.assertFalse([f for f in findings if f.severity == 'flag'])
        self.assertEqual([asdict(f) for f in findings],
                         [asdict(f) for f in SlopFloor().check(lines, '?' * len(lines))])

    def test_the_floor_gate_holds_only_the_length_gate(self):
        # REPINNED 2026-11-22: ~~an unmeasured window refuses coverage and a
        # clean completion~~. Nothing is left to be uncalibrated: the floor's
        # gate set is the length gate alone, and the couplet certifies.
        self.assertEqual(FLOOR_GATE_CODES, ('OUT_OF_CALIBRATED_LENGTH',))
        r = Reviser(rdecl=ReviseDeclaration(attempts_per_line=0, backtrack_width=0))
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        found = r.inspect(LINES, m)
        self.assertEqual(found['coverage']['refused_obligations'], [])
        self.assertTrue(found['coverage']['certified'])
        self.assertFalse(REMOVED & {f.code for f in found['whole']})
        stopped = revise_loop(r, LINES, m)
        self.assertEqual(stopped.stop_reason, 'success')
        self.assertEqual(stopped.lines, LINES)
        self.assertTrue(stopped.coverage_certified)

    def test_a_declared_cut_for_a_removed_check_is_refused(self):
        # REPINNED 2026-11-22: ~~an explicit cut remains caller-owned and can
        # be judged~~. There is no check left to judge it, so declaring one
        # is an error the caller sees, not a field the floor drops unread.
        for field in REMOVED_FIELDS:
            for value in (0.9, 0.001, 20):
                with self.subTest(field=field, value=value), self.assertRaises(TypeError):
                    FloorDeclaration(**{field: value})

    def test_no_window_value_is_accepted(self):
        # REPINNED 2026-11-22: ~~the window must be a positive integer~~ (a
        # ValueError for 0, -1, True, 20.0 and '20'). No value is a window
        # now, the calibrated 50 included.
        for window in (0, -1, True, 20.0, '20', 50):
            with self.subTest(window=window), self.assertRaises(TypeError):
                SlopFloor(FloorDeclaration(mattr_window=window))


if __name__ == '__main__':
    unittest.main()
