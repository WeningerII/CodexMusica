"""Production audit regressions; python3 quality/test_production_harness.py."""
import copy
import itertools
import os
import sys
import unittest
import unicodedata
from fractions import Fraction
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from quality import fit, grid, meter, phonology, plan, schemes


def blueprint():
    return {"sections": [{"name": "verse", "bars": 2, "meter":
                          {"beats": 4, "unit": 4, "groups": [2, 2]}}],
            "lines": [{"text": "I hold your hand", "section": "verse", "bar": 1,
                       "beat": 1, "duration": 4}]}


class HarnessProduction(unittest.TestCase):
    def test_global_relation_feasibility(self):
        for relation in ("schema:semirhyme", "schema:internal rhyme", "schema:anaphora"):
            with self.subTest(relation=relation), self.assertRaises(plan.PlanRefused):
                plan.make_plan(1, lines=24, relation=relation)
        p = plan.make_plan(0, lines=24)
        p.update(relations={}, relation="schema:semirhyme", groups="1,2,3")
        self.assertIn("GROUP_CONTRADICTS_ITSELF", {r[0] for r in plan.joint_findings(p)})

    def test_singleton_rosters_terminate(self):
        for functions in (["bridge"], ["intro"], ["outro"], ["verse"]):
            try:
                p = plan.make_plan(1, lines=24, functions=functions)
            except plan.PlanRefused:
                pass
            else:
                self.assertLessEqual({s["function"] for s in p["sections"]}, set(functions))

    def test_mandate_reopen(self):
        original = schemes.mandate("ABAB")
        for kw in ({}, {"default_relation": "class:ASSONANCE"},
                   {"scope": [1, 2, 3]}, {"relations": {"A": "class:ASSONANCE"}}):
            with self.subTest(kw=kw), self.assertRaises(schemes.NoMandate):
                schemes.mandate(original, n_lines=3, **kw)
        updated = schemes.mandate(original, rule=schemes.ReturnRule(return_rhyme="positional"))
        self.assertEqual(updated.rule.return_rhyme, "positional")
        with self.assertRaises(schemes.NoMandate):
            schemes.Mandate(n_lines=3, groups=((1, 4),), labels=("A",))
        identity = schemes.mandate([], n_lines=3, returns=[(1, 3)])
        self.assertEqual(identity.groups, ())
        self.assertEqual(tuple(r.lines for r in identity.returns), ((1, 3),))
        self.assertEqual(identity.free, (2,))
        self.assertEqual(schemes.mandate(None, n_lines=3, returns=[(1, 3)]), identity)
        with self.assertRaises(schemes.NoMandate):
            schemes.mandate([], n_lines=3, returns=[(1, 4)])

    def test_blueprint_rejection_parity(self):
        cases = []
        for field, value in (("bars", 2.8), ("start_bar", 1.9), ("bars", True),
                             ("bars", 0), ("bars", "NaN")):
            b = blueprint(); b["sections"][0][field] = value; cases.append(b)
        for groups in ([-2, 6], [0, 4], [1, 1], "2+2"):
            b = blueprint(); b["sections"][0]["meter"]["groups"] = groups; cases.append(b)
        for field, value in (("bar", 1.9), ("section", "notthere"),
                             ("duration", float("inf")), ("duration", 0)):
            b = blueprint(); b["lines"][0][field] = value; cases.append(b)
        cases += [{"sections": [], "lines": blueprint()["lines"]},
                  {"sections": [None]}, {"sections": "verse"}, []]
        for b in cases:
            errors = []
            for reader in (fit.from_blueprint, grid.song_from_blueprint):
                with self.subTest(b=b, reader=reader.__name__), self.assertRaises(ValueError) as e:
                    reader(copy.deepcopy(b))
                errors.append(str(e.exception))
            self.assertEqual(errors[0], errors[1])

    def test_exact_fractional_coordinates(self):
        b = blueprint()
        b["sections"][0]["meter"] = {"beats": 4.5, "unit": 8, "groups": [2, 2.5]}
        b["lines"][0].update(beat=1.25, duration="7/2")
        _, placements = fit.from_blueprint(b)
        song, _ = grid.song_from_blueprint(b)
        self.assertEqual(placements[0].cycle.pulses, Fraction(9, 2))
        self.assertEqual(song.sections[0].meter.beats, Fraction(9, 2))
        self.assertEqual(placements[0].beat, song.lines[0].beat)
        self.assertEqual(placements[0].duration, Fraction(7, 2))

    def test_text_accountability(self):
        r = fit.read_line("I 我我我我 love you")
        self.assertFalse(r.certain)
        self.assertEqual(r.refused[0].token, "我我我我")
        self.assertEqual([u.widx for u in r.units], [0, 2, 3])
        compound = fit.read_line("long-lost love")
        self.assertTrue(compound.certain)
        self.assertEqual(compound.count, 3)
        self.assertEqual(fit.read_line("maa maa,maa", phonology.get("fin")).count, 3)
        text = "rāmaḥ rāmaḥ"
        a, b = (fit.read_line(t, phonology.get("san")) for t in
                (text, unicodedata.normalize("NFD", text)))
        self.assertEqual((a.count, a.certain, a.tokens), (b.count, b.certain, b.tokens))
        self.assertGreater(a.count, 0)
        self.assertTrue(fit.read_line("I love you (qzxqzx)").certain)
        self.assertFalse(fit.read_line("I love you (qzxqzx)", strip_parens=False).certain)

    def test_ambiguous_reading_accountability(self):
        r = fit.read_line("our fire")
        self.assertFalse(r.certain)
        self.assertEqual({f.cause for f in r.refused}, {"UNRESOLVED_READING"})
        self.assertEqual(fit.read_line("wind").count, 1)
        self.assertTrue(fit.read_line("wind").certain)

    def test_sanskrit_line_mora_mapping(self):
        r = fit.read_line("yam ayuṅkta", phonology.get("san"))
        self.assertEqual(r.count, 5)
        self.assertEqual(r.units[-1].prominence, None)
        self.assertEqual({u.widx for u in r.units}, {0, 1})

    def test_expansion_limits_precede_allocation(self):
        p = fit.Placement(meter.Cycle(groups=(2, 2)), bar=1, duration=10_000_000)
        with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT"):
            fit._slot_positions(p, fit.Subdivision(4, source="audit declaration"))
        with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT"):
            p.cycle.heads_between(0, 10_000_000)
        with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT"):
            fit._uncovered_bars([], 4, 10_000_000, 1)
        with self.assertRaisesRegex(ValueError, "positive"):
            meter.Marker("never", 0).positions(4)

    def test_rolling_dp_matches_exhaustive_assignments(self):
        for slots in range(1, 8):
            for units in range(1, slots + 1):
                prominent, heads = tuple(range(0, units, 2)), set(range(0, slots, 3))
                expected = max(sum(picked[i] in heads for i in prominent)
                               for picked in itertools.combinations(range(slots), units))
                self.assertEqual(fit._max_prominent_on_heads(units, prominent,
                                                            range(slots), heads.__contains__), expected)
        with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT"):
            fit._max_prominent_on_heads(1000, (), range(1001), lambda _: False)

    def test_default_plan_is_inside_execution_budget_and_large_is_inspection_only(self):
        limits = plan.execution_limits()
        self.assertEqual(limits["max_candidate_pairs"], __import__("quality.relations", fromlist=["MAX_CANDIDATE_PAIRS"]).MAX_CANDIDATE_PAIRS)
        for seed in range(20):
            p = plan.make_plan(seed)
            self.assertTrue(p["execution_limits"]["admitted"])
            self.assertLessEqual(p["total_lines"], limits["max_lines"])
        with self.assertRaisesRegex(plan.PlanRefused, "RESOURCE_LIMIT"):
            plan.make_plan(13, lines=144)
        p = plan.make_plan(13, lines=144, inspection_only=True)
        self.assertEqual(p["total_lines"], 144)
        self.assertFalse(p["execution_limits"]["admitted"])
        self.assertIn("INSPECTION ONLY", p["writer_brief"])
        with self.assertRaisesRegex(plan.PlanRefused, "RESOURCE_LIMIT"):
            plan.fill_plan(p, ["I hold your hand"] * 144)

    def test_actual_draft_work_preflight(self):
        # The same declared maximum accepts twelve syllables per line at
        # the derived line ceiling, but catches proposal growth past it.
        n = plan.execution_limits()["max_lines"]
        before = [" ".join(["love"] * 12)] * n
        self.assertTrue(plan.draft_execution_bound(before)["within_budget"])
        after = list(before)
        after[0] += " love"
        self.assertFalse(plan.draft_execution_bound(after)["within_budget"])
        self.assertEqual(before[0].split(), ["love"] * 12)
        long_line = " ".join(["a"] * 100)
        self.assertEqual(len(long_line), 199)
        self.assertFalse(plan.draft_execution_bound([long_line] * n)["within_budget"])
        # No aesthetic twelve-syllable ceiling: two very long lines still
        # fit the actual computational budget.
        self.assertTrue(plan.draft_execution_bound([long_line] * 2)["within_budget"])
        ambiguous = plan.draft_execution_bound(["our fire"])
        self.assertEqual(ambiguous["observed_line_units"], [4])
        self.assertEqual(plan.draft_execution_bound(["love qzxqzx"])["observed_line_units"], [2])

    def test_explicit_briefs_are_reproducible_and_satisfied(self):
        wants = ["lines<=60", "sections<=6", "lines_per_section>=2", "group<=4"]
        for seed in range(10):
            p = plan.make_plan(seed, wants=wants)
            self.assertTrue(all(plan.sweep_holds(p, plan.parse_sweep_want(w)) for w in wants))
            selection = p["choices"]["brief_selection"]
            self.assertEqual(selection["attempts"][-1]["status"], "accepted")
            self.assertLessEqual(len(selection["attempts"]), 64)
            self.assertEqual(p, plan.make_plan(seed, wants=wants))
        with self.assertRaises(plan.PlanRefused):
            plan.parse_sweep_want("bound_words_per_line<=nan")


if __name__ == "__main__":
    unittest.main()
