#!/usr/bin/env python3
"""MISSING.md C-5: declared tempo, changes, seconds and honest refusals."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from fractions import Fraction as F
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality.tempo import Tempo, TempoMap, from_blueprint, report
from quality.grid import song_from_blueprint
from quality.declared_inputs import BeatGrid
from quality.meter import Cycle, validate_blueprint
from quality.fit import Refused, from_blueprint as fit_from_blueprint


def blueprint():
    return {
        "tempo": {"bpm": 120, "beat_value": "1/4", "source": "test score"},
        "tempo_changes": [{"at": "1/2", "bpm": 60,
                           "beat_value": "1/4", "source": "test score"}],
        "sections": [
            {"name": "a", "bars": 1, "meter": {"beats": 4, "unit": 4}},
            {"name": "b", "bars": 1, "meter": {"beats": 6, "unit": 8}}],
        "lines": [{"bar": 1, "beat": 4, "duration": 4, "text": "the rain"}]}


class TempoTests(unittest.TestCase):
    def test_exact_units_and_decimal(self):
        self.assertEqual(Tempo(120, "1/4", "score").seconds(1), 2)
        self.assertEqual(Tempo(60, "3/8", "score").seconds("6/8"), 2)
        self.assertEqual(Tempo(72.5, "1/4", "score").bpm, F(145, 2))
        self.assertEqual(Tempo(60, "1/4", "score").seconds(0.1), F(2, 5))

    def test_changes_boundary_and_pickup(self):
        t = from_blueprint(blueprint())
        for start, end, seconds in [(0, 1, 3), (0, F(1, 2), 1),
                                    (F(1, 2), 1, 2), (-F(1, 4), 0, F(1, 2)),
                                    (-F(1, 4), 1, F(7, 2)), (0, 0, 0)]:
            self.assertEqual(t.seconds_between(start, end), seconds)
        self.assertEqual(t.seconds_between(0, 2),
                         t.seconds_between(0, F(3, 4)) + t.seconds_between(F(3, 4), 2))
        with self.assertRaises(ValueError):
            t.seconds_between(1, 0)

    def test_song_and_line_cross_meter_boundary(self):
        song, _ = song_from_blueprint(blueprint())
        self.assertEqual(song.seconds_between(1, 1, 3, 1), 6)
        # Last quarter pulse of 4/4 + three eighth pulses of 6/8, all at q=60.
        self.assertEqual(song.line_seconds(song.lines[0]), F(5, 2))
        self.assertIn("source=test score", report(song))
        self.assertIn("not measured performance", report(song))
        bp = blueprint(); bp["lines"] = [{"bar": 1, "beat": 0, "duration": 2}]
        song, _ = song_from_blueprint(bp)
        self.assertEqual(song.line_seconds(song.lines[0]), 1)

    def test_beat_grid_reads_bpm_and_beat_unit(self):
        args = dict(cycle=Cycle(6, 8, (3, 3)), positions={(0, 0): 0, (0, 1): 6},
                    source="score", derived_from="notation")
        grid = BeatGrid(**args, tempo_bpm=60)
        self.assertEqual(grid.seconds_between((0, 0), (0, 1)), 3)
        grid = BeatGrid(**args, tempo_bpm=60, tempo_beat_value="3/8")
        self.assertEqual(grid.seconds_between((0, 0), (0, 1)), 2)
        self.assertEqual(BeatGrid(**args).seconds_between((0, 0), (0, 1)).code, "NO_TEMPO")
        with self.assertRaises(ValueError):
            grid.seconds_between((0, 0), (9, 9))
        with self.assertRaises(ValueError):
            BeatGrid(**args, tempo_bpm=0)

    def test_missing_tempo_is_not_zero_or_a_verdict(self):
        bp = blueprint(); del bp["tempo"], bp["tempo_changes"]
        song, _ = song_from_blueprint(bp)
        refusal = song.line_seconds(song.lines[0])
        self.assertEqual(refusal.code, "NO_TEMPO")
        self.assertEqual(refusal.status, "SCHEDULED")
        with self.assertRaises(Refused):
            bool(refusal)
        self.assertIn("NO_TEMPO", report(song))
        self.assertEqual(TempoMap().seconds_between(0, 0).code, "NO_TEMPO")

    def test_malformed_declarations_refused_by_shared_readers(self):
        variants = []
        for field in ("bpm", "beat_value"):
            for bad in (0, -1, True, None, "bad", float("inf"), float("nan"), [], 2**257):
                bp = blueprint(); bp["tempo"][field] = bad; variants.append(bp)
        for bad in ("", None, 12):
            bp = blueprint(); bp["tempo"]["source"] = bad; variants.append(bp)
        for bad in ("120", {}, {"bpm": 120}, {"bpm": 120, "beat_value": "1/4", "source": "x", "ramp": True}):
            bp = blueprint(); bp["tempo"] = bad; variants.append(bp)
        for at in (0, -1, True, None, "bad"):
            bp = blueprint(); bp["tempo_changes"][0]["at"] = at; variants.append(bp)
        bp = blueprint(); bp["tempo_changes"] *= 2; variants.append(bp)
        bp = blueprint(); del bp["tempo"]; variants.append(bp)
        bp = blueprint(); bp["tempo_changes"] = {}; variants.append(bp)
        for bp in variants:
            for reader in (validate_blueprint, song_from_blueprint, fit_from_blueprint):
                with self.subTest(bp=bp, reader=reader.__name__), self.assertRaises(ValueError):
                    reader(bp)

    def test_no_unstated_meter_extrapolation(self):
        bp = blueprint(); bp["sections"][1]["start_bar"] = 3
        song, _ = song_from_blueprint(bp)
        with self.assertRaisesRegex(ValueError, "contiguous"):
            report(song)
        bp = blueprint(); bp["lines"][0]["duration"] = 100
        song, _ = song_from_blueprint(bp)
        with self.assertRaisesRegex(ValueError, "beyond"):
            song.line_seconds(song.lines[0])

    def test_cli_timing_and_invalid_input(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "song.json"
            for bp, code, expected in ((blueprint(), 0, "bar-span seconds: 6"),
                                       ({**blueprint(), "tempo": {"bpm": 0}}, 2, "REFUSED")):
                path.write_text(json.dumps(bp))
                result = subprocess.run([sys.executable, str(root / "lyric_harness.py"), "grid", str(path)],
                                        cwd=root, capture_output=True, text=True)
                self.assertEqual(result.returncode, code, result.stdout + result.stderr)
                self.assertIn(expected, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
