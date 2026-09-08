"""Regressions from the Moonshots connector run, using real readers/renderers."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lyric_harness import Lexicon
from quality.revise import Reviser
from quality.fit import Subdivision
from quality.plan import render_blueprint_song

class SessionRepairs(unittest.TestCase):
    def blueprint(self):
        return {"sections": [
            {"name": "chorus", "function": "chorus", "bars": 1, "start_bar": 1,
             "meter": {"beats": 7, "unit": 8, "groups": [3, 2, 2]}},
            {"name": "chorus", "function": "chorus", "bars": 1, "start_bar": 2,
             "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
            "lines": [
                {"text": "", "section": "chorus", "bar": 1, "beat": 1, "duration": 7},
                {"text": "", "section": "chorus", "bar": 2, "beat": 1, "duration": 4}]}

    def test_repeated_names_keep_instance_meters_and_revised_words(self):
        text = render_blueprint_song(self.blueprint(), ["First revised line", "Second revised line"])
        self.assertEqual(text.count("First revised line"), 1)
        self.assertEqual(text.count("Second revised line"), 1)
        self.assertIn("1 bar of 7/8", text)
        self.assertIn("1 bar of 4/4", text)
        self.assertLess(text.index("First revised line"), text.index("1 bar of 4/4"))
        with self.assertRaises(ValueError):
            render_blueprint_song(self.blueprint(), ["one line"])

    def test_function_counts_do_not_change_or_rank_the_plan(self):
        from quality.plan import parse_sweep_want, sweep_holds
        plan = {"sections": [{"name": "v1", "function": "verse"},
                             {"name": "v2", "function": "verse"},
                             {"name": "c1", "function": "chorus"}],
                "line_slots": [{"section": name} for name in ["v1"] * 4 + ["v2"] * 3 + ["c1"] * 2]}
        for value in ["sections.verse=2", "min_lines.verse=3", "max_lines.verse=4", "sections.bridge=0"]:
            self.assertTrue(sweep_holds(plan, parse_sweep_want(value)))
        self.assertFalse(sweep_holds(plan, parse_sweep_want("min_lines.verse=4")))
        with self.assertRaises(ValueError):
            parse_sweep_want("sections.made_up=5")

    def test_density_counts_parenthesized_sung_words_when_voices_declared(self):
        text = "My kettle whistles (elephant elephant elephant elephant)"
        default = Reviser(lex=Lexicon())._band_findings([text])
        voices = Reviser(lex=Lexicon(strip_parens=False))._band_findings([text])
        self.assertNotIn("DENSITY_OUT_OF_BAND", {f.code for fs in default.values() for f in fs})
        self.assertIn("DENSITY_OUT_OF_BAND", {f.code for fs in voices.values() for f in fs})

    def test_mixed_pickups_are_not_mislabelled_as_uniform(self):
        from quality.plan import section_header
        header = section_header(self.blueprint()["sections"][0], [{"beat": 1}, {"beat": 2}])
        self.assertIn("mixed line pickups", header)

    def test_meter_uses_declared_fallback_without_claiming_unknown_as_known(self):
        lines = ["Moonshot lights the house", "Blundin builds the next machine"]
        readings = {}
        for mode in [None, "high", "low"]:
            r = Reviser(lex=Lexicon(fallback=mode))
            per, whole = r._meter_findings(lines, self.blueprint(), Subdivision(4, source="test arrangement"))
            readings[mode] = {f.code for fs in per.values() for f in fs} | {f.code for f in whole}
        self.assertIn("COUNT_IS_A_LOWER_BOUND", readings[None])
        self.assertIn("COUNT_IS_A_LOWER_BOUND", readings["high"])
        self.assertNotIn("COUNT_IS_A_LOWER_BOUND", readings["low"])

if __name__ == "__main__":
    unittest.main()
