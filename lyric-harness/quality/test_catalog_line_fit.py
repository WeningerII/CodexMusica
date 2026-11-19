"""Check exact counts against one native timeline and its actual relation bindings."""
import copy
import unittest

from quality import catalog_shape, plan


def blueprint(slots, *, groups="", returns="", relation="class:RHYME"):
    return {"total_lines": len(slots), "subdivision": 2,
            "line_slots": [{"line": i, "duration": count / 2} for i, count in enumerate(slots, 1)],
            "groups": groups, "returns": returns, "relation": relation, "relations": {}}


def conflicts(native, requirements):
    return {(r["line"], r["code"]) for r in catalog_shape.line_fit_conflicts(native, requirements)}


class CatalogLineFitTests(unittest.TestCase):
    def test_ceilings_are_per_line_after_pickup_and_not_minima(self):
        native = blueprint([3, 10])
        self.assertEqual(conflicts(native, [{"line": 1, "syllables": 4}]), {(1, "CATALOG_SLOTS_EXCEEDED")})
        self.assertEqual(conflicts(native, [{"line": 1, "syllables": 3}, {"line": 2, "words": 2}]), set())

    def test_strict_requirement_schema_and_positions(self):
        native = blueprint([8, 8])
        for bad in [None, {}, [{"line": 1}], [{"line": 1, "words": 0}], [{"line": True, "words": 1}],
                    [{"line": 3, "syllables": 2}], [{"line": 1, "words": 4, "syllables": 2}],
                    [{"line": 1, "stresses": 1}], [{"line": 1, "words": 1}, {"line": 1, "syllables": 2}]]:
            with self.subTest(bad=bad), self.assertRaises(plan.PlanRefused):
                catalog_shape.line_fit_conflicts(native, bad)

    def test_positioned_spelling_can_only_conflict_on_the_same_returned_word(self):
        native = blueprint([8, 8], returns="1,2")
        first = {"line": 1, "words": 2, "wordLetters": [3, None]}
        second = {"line": 2, "words": 2, "wordLetters": [None, 5]}
        self.assertEqual(conflicts(native, [first, second]), set())
        self.assertIn((2, "CATALOG_RETURN_COUNT_CONFLICT"),
                      conflicts(native, [first, dict(second, wordLetters=[4, 5])]))
        for widths in ([], [3], [True, 4], [0, None], [None, None], "34"):
            with self.subTest(widths=widths), self.assertRaises(plan.PlanRefused):
                conflicts(native, [dict(first, wordLetters=widths)])

    def test_indexed_binding_and_reserved_word_fit(self):
        native = blueprint([8, 8, 8], groups="1.T3,2;1,3")
        for req in ({"line": 1, "words": 3}, {"line": 2, "words": 1}):
            self.assertIn((req["line"], "CATALOG_WORD_BINDINGS"), conflicts(native, [req]))
        self.assertEqual(conflicts(native, [{"line": 1, "words": 4}, {"line": 2, "syllables": 2}]), set())

    def test_overhang_direction_and_minimum_cost(self):
        native = blueprint([3, 4], groups="1,2", relation="schema:apocopated rhyme")
        self.assertEqual(conflicts(native, [{"line": 1, "words": 3}]), {(1, "CATALOG_SLOTS_EXCEEDED")})
        self.assertEqual(conflicts(native, [{"line": 1, "syllables": 2}]), {(1, "CATALOG_SYLLABLE_BINDINGS")})
        self.assertEqual(conflicts(native, [{"line": 2, "syllables": 2}]), set())

    def test_returns_share_counts_and_each_copy_must_fit(self):
        native = blueprint([9, 9, 2], returns="1,2;2,3")
        self.assertEqual(conflicts(native, [{"line": 1, "syllables": 4}]), {(3, "CATALOG_SLOTS_EXCEEDED")})
        self.assertIn((1, "CATALOG_RETURN_COUNT_CONFLICT"), conflicts(
            native, [{"line": 1, "words": 1}, {"line": 3, "words": 2}]))
        native["returns"] = "1.endword,3.endword"
        self.assertEqual(conflicts(native, [{"line": 1, "syllables": 4}]), set())

    def test_exact_lexical_stress_infers_slots_but_does_not_require_a_musical_head(self):
        native = blueprint([3, 6])
        self.assertEqual(conflicts(native, [{"line": 1, "stress": "././"}]), {(1, "CATALOG_SLOTS_EXCEEDED")})
        self.assertEqual(conflicts(native, [{"line": 2, "stress": "/////."}]), set())
        self.assertEqual(conflicts(native, [{"line": 1, "syllables": 2, "stresses": 0}]), set())

    def test_incoherent_or_ambiguous_stress_coordinates_refuse(self):
        native = blueprint([8, 8])
        for fields in ({"stress": "..x"}, {"stress": ""}, {"stress": [1]},
                       {"stress": "./", "syllables": 3}, {"stress": "./", "stresses": 0},
                       {"stress": "./", "stresses": True}, {"syllables": 2, "stresses": -1},
                       {"syllables": 2, "stresses": 3}, {"stresses": 2}):
            with self.subTest(fields=fields), self.assertRaises(plan.PlanRefused):
                conflicts(native, [{"line": 1, **fields}])

    def test_whole_line_returns_preserve_stress_pattern_and_derived_counts(self):
        native = blueprint([5, 5], returns="1,2")
        for other, code in (({"stress": "/."}, "CATALOG_RETURN_STRESS_CONFLICT"),
                            ({"syllables": 3}, "CATALOG_RETURN_COUNT_CONFLICT"),
                            ({"syllables": 2, "stresses": 0}, "CATALOG_RETURN_COUNT_CONFLICT")):
            self.assertIn((1, code), conflicts(native, [{"line": 1, "stress": "./"}, {"line": 2, **other}]))
        self.assertEqual(conflicts(native, [{"line": 1, "stress": "./"},
                                           {"line": 2, "syllables": 2, "stresses": 1}]), set())

    def test_actual_native_plan_is_immutable_and_keeps_its_native_groups(self):
        requirements = [{"line": 1, "syllables": 3}, {"line": 2, "words": 3}]
        contract = {"id": "test", "scope": "setting", "version": 1, "variant": 0, "counts": {},
                    "sections": [{"unit": "section", "role": "verse", "lines": 4}],
                    "rhymeGroups": [], "returnGroups": [], "lineRequirements": requirements}
        actual = plan.make_plan(11, song_form=contract, relation="class:RHYME")
        original = copy.deepcopy(actual)
        catalog_shape.line_fit_conflicts(actual, requirements)
        self.assertEqual(actual, original)
        self.assertEqual(actual["request"]["song_form"], contract)
        self.assertTrue(actual["groups"])


if __name__ == "__main__":
    unittest.main()
