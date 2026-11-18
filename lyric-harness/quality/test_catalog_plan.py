"""Seeded catalog authoring: exercise the native planner, fill and sweep without specimen lyrics."""
import unittest
from unittest.mock import patch

from quality import plan


def catalog(form_id, sections, rhymes=(), returns=()):
    return {"version": 1, "id": form_id, "scope": "rule", "variant": 0, "counts": {},
            "sections": sections, "rhymeGroups": list(rhymes), "returnGroups": list(returns)}


class CatalogPlannerTests(unittest.TestCase):
    def test_plan_sweep_and_blueprint_replay_declared_named_shape(self):
        contract = catalog("chorus-first", [
            {"unit": "section", "role": role, "lines": None}
            for role in ("chorus", "verse", "chorus")])
        with patch.object(plan, "_sample_pattern", side_effect=AssertionError("drew undeclared shape")):
            for seed in (11, 12):
                native = plan.make_plan(seed, song_form=contract, lines=12)
                self.assertEqual(plan.sweep([seed], song_form=contract, lines=12)["accepted"], [seed])
                self.assertEqual(native, plan.make_plan(seed, song_form=contract, lines=12))
                self.assertEqual(native["total_lines"], 12)
                self.assertTrue(native["groups"])
                self.assertTrue(native["returns"])
                self.assertEqual(native["request"]["song_form"], contract)
                draft = [str(i) for i in range(12)]
                self.assertEqual(plan.fill_plan(native, draft)["song_form"], contract)

    def test_role_order_and_repeated_lengths_are_constructed_directly(self):
        parts = [
            {"unit": "section", "role": role, "lines": (2 if role == "prechorus" else None)}
            for role in ("verse", "prechorus", "chorus") * 2
        ]
        contract = catalog("verse-prechorus-chorus", parts)
        with patch.object(plan, "_sample_pattern", side_effect=AssertionError("sampled declared order")):
            native = plan.make_plan(11, lines=16, song_form=contract)
        self.assertEqual([s["function"] for s in native["sections"]], [p["role"] for p in parts])
        self.assertEqual(native["total_lines"], 16)
        for section in native["sections"]:
            if section["function"] == "prechorus":
                self.assertEqual(sum(sl["section"] == section["name"] for sl in native["line_slots"]), 2)
        self.assertTrue(native["returns"])

    def test_exact_section_bars_reach_the_plan_grid_and_blueprint(self):
        data = {**catalog("16-bar-blues", [{"unit": "section", "role": "verse", "lines": 4, "bars": 16}]),
                "variant": 1}
        for seed in (11, 12):
            native = plan.make_plan(seed, lines=4, song_form=data)
            self.assertEqual(plan.sweep([seed], lines=4, song_form=data)["accepted"], [seed])
            self.assertEqual(plan.make_plan(seed, lines=4, song_form=data), native)
            self.assertEqual(native["choices"]["bars_per_line"], 4)
            self.assertEqual([slot["bar"] for slot in native["line_slots"]], [1, 5, 9, 13])
            self.assertEqual(native["sections"][0]["bars"], 16)
            blueprint = plan.fill_plan(native, ["1", "2", "3", "4"])
            self.assertEqual(blueprint["sections"][0]["bars"], 16)
            self.assertEqual(blueprint["song_form"], data)
        melody = {"meter": {"beats": 4, "unit": 4, "groups": [2, 2]}, "bars": 4,
                  "subdivision": 1, "notes": [{"pitch_hz": 220, "ticks": 16}]}
        native = plan.make_plan(11, lines=4, song_form=data, melody=melody)
        self.assertEqual(native["melody"], melody)
        self.assertEqual(native["sections"][0]["bars"], 16)
        shorter = {**melody, "bars": 3, "notes": [{"pitch_hz": 220, "ticks": 12}]}
        with self.assertRaisesRegex(plan.PlanRefused, "catalog section bars"):
            plan.make_plan(11, lines=4, song_form=data, melody=shorter)

    def test_bars_in_instrumental_section_do_not_create_lyric_lines(self):
        data = catalog("fixture", [
            {"unit": "section", "role": "verse", "lines": 4, "bars": 8},
            {"unit": "section", "role": "solo", "lines": None, "bars": 6},
            {"unit": "section", "role": "verse", "lines": None}])
        native = plan.make_plan(11, lines=8, song_form=data)
        self.assertEqual([(s["bars"], s["start_bar"]) for s in native["sections"]],
                         [(8, 1), (6, 9), (8, 15)])
        self.assertEqual([s["bar"] for s in native["line_slots"]], [1, 3, 5, 7, 15, 17, 19, 21])
        self.assertEqual(native["total_lines"], 8)

    def test_conflicting_declaration_and_unknown_fields_refuse(self):
        base = catalog("hookless-rap-track", [{"unit": "section", "role": "verse", "lines": 2}])
        with self.assertRaises(plan.PlanRefused):
            plan.make_plan(11, lines=3, song_form=base)
        with self.assertRaises(plan.PlanRefused):
            plan.make_plan(11, song_form={**base, "unknown_coordinate": 1})
        with self.assertRaises(plan.PlanRefused):
            plan.make_plan(11, song_form={**base, "returnGroups": [[1, 3]]})


if __name__ == "__main__":
    unittest.main()
