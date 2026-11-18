"""Seeded catalog authoring: exercise the native planner, fill and sweep without specimen lyrics."""
import unittest
from unittest.mock import patch

from quality import plan


def catalog(form_id, sections, rhymes=(), returns=()):
    return {"version": 1, "id": form_id, "scope": "rule", "variant": 0, "counts": {},
            "sections": sections, "rhymeGroups": list(rhymes), "returnGroups": list(returns)}


class CatalogPlannerTests(unittest.TestCase):
    def test_stated_counts_preserve_the_catalog_sequence(self):
        roles = ("chorus", "verse", "chorus")
        contract = catalog("chorus-first", [
            {"unit": "section", "role": role, "lines": 4} for role in roles])
        wants = ["sections=3", "sections.chorus=2", "sections.verse=1"]
        with patch.object(plan, "_sample_pattern", side_effect=AssertionError("drew undeclared shape")):
            for seed in (11, 12):
                native = plan.make_plan(seed, song_form=contract, lines=12, wants=wants)
                self.assertEqual([s["function"] for s in native["sections"]], list(roles))
                self.assertEqual(native["request"]["song_form"], contract)
                self.assertEqual(native["total_lines"], 12)
                self.assertEqual(plan.sweep([seed], song_form=contract, lines=12,
                                            wants=[plan.parse_sweep_want(w) for w in wants])
                                 ["accepted"], [seed])
        with self.assertRaises(plan.PlanRefused):
            plan.make_plan(11, song_form=contract, lines=12, wants=["sections.chorus=1"])

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
