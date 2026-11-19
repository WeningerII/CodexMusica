"""Offline tests of the isolated catalog topology helper. No generated text."""
import random
import unittest
from unittest.mock import patch

from quality import catalog_shape, plan


def declaration(parts, rhymes=(), returns=()):
    return {"version": 1, "id": "test", "scope": "rule", "variant": 0, "counts": {},
            "sections": parts, "rhymeGroups": list(rhymes), "returnGroups": list(returns)}


def resolve(contract, seed=11, **options):
    return catalog_shape.resolve_catalog_shape(contract, random.Random(seed),
                                              totals=range(2, 464), **options)


class CatalogShapeTests(unittest.TestCase):
    def test_mixed_counts_replay_exact_role_order_and_known_lengths(self):
        roles = ["verse", "prechorus", "chorus"] * 2
        contract = declaration([{"unit": "section", "role": f, "lines": 2 if f == "prechorus" else None}
                                for f in roles])
        seen = set()
        with patch.object(plan, "_sample_pattern", side_effect=AssertionError("shape was drawn")):
            for seed in range(20):
                shape = resolve(contract, seed, lines=16)
                self.assertEqual(shape, resolve(contract, seed, lines=16))
                self.assertEqual([s["function"] for s in shape["sections"]], roles)
                lengths = tuple(s["lines"] for s in shape["sections"])
                self.assertEqual(sum(lengths), 16)
                self.assertEqual(lengths[:3], lengths[3:])
                self.assertEqual(lengths[1], 2)
                seen.add(lengths)
        self.assertGreater(len(seen), 1)

    def test_unsupported_classes_and_unnamed_roles_refuse_before_computing_a_partition(self):
        named = [{"unit": "section", "role": "verse", "lines": 2}]
        unsupported = [declaration(named, rhymes=[[True, 2]]), declaration(named, rhymes=[[1, 2.0]]), declaration(named, rhymes=[[1, 3]]), declaration(named, returns=[[1, 2]]),
                       declaration([{"unit": "section", "lines": 2}])]
        with patch.object(plan, "_partition_count", side_effect=AssertionError("counted before validation")):
            for contract in unsupported:
                with self.subTest(contract=contract), self.assertRaises(plan.PlanRefused):
                    resolve(contract)

    def test_fully_determined_tag_ceiling_filters_impossible_totals_before_drawing(self):
        sections = [{"unit": "section", "role": "chorus", "lines": 4}] * 2
        data = declaration(sections + [{"unit": "section", "role": "tag", "lines": None}])
        for seed in range(20):
            chosen = resolve(data, seed)
            self.assertLessEqual(chosen["sections"][-1]["lines"], 4)
        with self.assertRaises(plan.PlanRefused) as caught:
            resolve(data, lines=24)
        self.assertFalse(isinstance(caught.exception, plan.SeedRefused))

    def test_joint_bar_divisors_recurrent_roles_and_exact_total(self):
        def section(role, bars=None, lines=None):
            return {"unit": "section", "role": role, "lines": lines,
                    **({"bars": bars} if bars is not None else {})}
        data = declaration([section("verse", 8), section("chorus", 16), section("verse")])
        for seed in range(5):
            resolved = resolve(data, seed, lines=16)
            self.assertEqual(resolved["bars_per_line"], 2)
            self.assertEqual([s["lines"] for s in resolved["sections"]], [4, 8, 4])
        rejected = [
            (data, {"lines": 15}), (data, {"lines": 16, "melody_bars": 4}),
            (declaration([section("verse", 8), section("verse", 7)]), {}),
            (declaration([section("verse", 7, 2)]), {}),
            (declaration([section("verse", True)]), {}),
            (declaration([section("verse", 0)]), {}),
            (declaration([section("part-a", 8), section("part-b", 8)]), {}),
        ]
        for candidate, kwargs in rejected:
            with self.subTest(candidate=candidate, kwargs=kwargs), self.assertRaises(plan.PlanRefused) as caught:
                resolve(candidate, **kwargs)
            self.assertNotIsInstance(caught.exception, plan.SeedRefused)

    def test_input_is_immutable_and_all_unsupported_constraints_refuse(self):
        base = declaration([{"unit": "section", "role": "verse", "lines": 2}])
        import copy
        original = copy.deepcopy(base)
        resolve(base)["sections"][0]["lines"] = 3
        self.assertEqual(base, original)
        invalid = [
            {**base, "example": "forbidden"},
            {**base, "sections": [{"unit": "section", "role": "verse", "lines": True}]},
            {**base, "sections": [{"unit": "section", "role": "unknown", "lines": None}]},
            {**base, "sections": [{"unit": "section", "role": "prechorus", "lines": None}]},
            {**base, "sections": [{"unit": "section", "role": "verse", "lines": 2},
                                    {"unit": "section", "role": "verse", "lines": 3}]},
            {**base, "rhymeGroups": [[1, 2], [1, 2]]},
            {**base, "returnGroups": [[1, 2]]},
            {**base, "returnGroups": [[1, 3]]},
            {**base, "counts": {"01": 1}},
        ]
        for item in invalid:
            with self.subTest(item=item), self.assertRaises(plan.PlanRefused):
                resolve(item)
        for kw in ({"functions": ["chorus"]}, {"lines": 3}, {"minimum": 3}, {"form": "verse-chorus"}):
            with self.subTest(kw=kw), self.assertRaises(plan.PlanRefused):
                resolve(base, **kw)


if __name__ == "__main__":
    unittest.main()
