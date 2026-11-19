"""Seeded catalog authoring: exercise the native planner, fill and sweep without specimen lyrics."""
import unittest
from unittest.mock import patch

from quality import plan


def catalog(form_id, sections, rhymes=(), returns=()):
    return {"version": 1, "id": form_id, "scope": "rule", "variant": 0, "counts": {},
            "sections": sections, "rhymeGroups": list(rhymes), "returnGroups": list(returns)}


class CatalogPlannerTests(unittest.TestCase):
    def test_whole_section_scores_survive_fill_and_observe_actual_events(self):
        from quality.catalog_grading import _sections
        from quality.melody import validate_melody
        parts = [{"unit": "section", "role": "verse", "lines": None, "bars": 8,
                  "sourceRole": group, "melodyGroup": group}
                 for group in ("part-a", "part-b", "part-a")]
        contract = catalog("ternary", parts)
        built = plan.make_plan(11, song_form=contract, lines=6)
        bp = plan.fill_plan(built, [str(n) for n in range(6)])
        phrases = [s["section_melody"] for s in bp["sections"]]
        self.assertEqual(phrases[0], phrases[2])
        self.assertIsNot(phrases[0]["notes"][0], phrases[2]["notes"][0])
        self.assertEqual(phrases[0]["notes"][0]["pitch_hz"], phrases[1]["notes"][0]["pitch_hz"])
        self.assertNotEqual(phrases[0]["notes"][1]["pitch_hz"], phrases[1]["notes"][1]["pitch_hz"])
        for phrase, sec in zip(phrases, bp["sections"]):
            self.assertEqual(phrase, validate_melody(phrase))
            self.assertEqual((phrase["meter"], phrase["bars"]), (sec["meter"], sec["bars"]))
            self.assertIn(f"{phrase['notes'][0]['pitch_hz']} Hz", built["writer_brief"])
        def read_score():
            return _sections(bp, [{} for _ in range(6)])
        self.assertEqual([row["sectionMelody"] for row in read_score()], phrases)
        starts = [section["start_bar"] for section in bp["sections"]]
        self.assertEqual([row["startBar"] for row in read_score()], starts)
        self.assertTrue(all(row["slotsWithinSection"] for row in read_score()))
        for positions in ([1, 1, 1], starts[::-1]):
            for section, start in zip(bp["sections"], positions):
                section["start_bar"] = start
            rows = read_score()
            self.assertEqual([row["startBar"] for row in rows], positions)
            self.assertTrue(any(not row["slotsWithinSection"] for row in rows))
        for section, start in zip(bp["sections"], starts):
            section["start_bar"] = start
        slot = bp["lines"][-1]
        slot["duration"] += 1
        self.assertFalse(read_score()[-1]["slotsWithinSection"])
        slot["duration"] -= 1
        phrases[-1]["notes"][0]["pitch_hz"] += 1
        observed = read_score()
        self.assertNotEqual(observed[0]["sectionMelody"], observed[2]["sectionMelody"])
        self.assertEqual(built["sections"][0]["section_melody"], built["sections"][2]["section_melody"])
        phrases[-1]["notes"][0]["ticks"] = 0
        self.assertIsNone(read_score()[-1]["sectionMelody"])
        del bp["sections"][-1]["section_melody"]
        self.assertNotIn("sectionMelody", read_score()[-1])
        with self.assertRaisesRegex(plan.PlanRefused, "line melody conflicts"):
            plan.make_plan(11, song_form=contract, lines=6, melody=phrases[0])

    def test_verified_catalog_burden_can_open_only_its_complete_alternating_setting(self):
        from quality import grid
        from types import SimpleNamespace
        from lyric_harness import _bind_blueprint_catalog, _catalog_creation
        order = ["burden", "verse", "burden", "verse", "burden"]
        contract = {**catalog("lullay-carol", [{"unit": "section", "role": role, "lines": None}
                                                for role in order]), "scope": "setting", "counts": {"1.2": 2}}
        built = plan.make_plan(11, song_form=contract, lines=10)
        parts = [s["function"] for s in built["sections"]]
        self.assertEqual(parts, order)
        bp = plan.fill_plan(built, ["one"] * 10)
        lex = SimpleNamespace()
        _bind_blueprint_catalog(lex, bp)
        self.assertEqual(grid.placement_findings(parts, selected_roles=lex.catalog_placement_roles), [])
        self.assertIn(("SECTION_NOT_ADJACENT", 0), [(c, i) for c, i, _ in grid.placement_findings(parts)])
        drift = order[:2] + ["chorus"] + order[3:]
        self.assertIn(("SECTION_NOT_ADJACENT", 0), [(c, i) for c, i, _ in grid.placement_findings(
            drift, selected_roles=lex.catalog_placement_roles)])
        # An independently supplied score carries no private plan contract.
        for command in ("song", "brief", "revise", "verify"):
            with self.subTest(command=command):
                pasted = SimpleNamespace()
                _, seeded_contract = _catalog_creation(
                    [command, "--catalog-form=lullay-carol", '--catalog-counts={"1.2":2}'], pasted)
                self.assertIsNone(seeded_contract)
                self.assertEqual(pasted.catalog_placement_roles, tuple(order))
                self.assertEqual(grid.placement_findings(parts, selected_roles=pasted.catalog_placement_roles), [])
                self.assertIn(("SECTION_NOT_ADJACENT", 0), [(c, i) for c, i, _ in grid.placement_findings(
                    drift, selected_roles=pasted.catalog_placement_roles)])
        with self.assertRaises(plan.PlanRefused):
            plan.make_plan(11, song_form={**contract, "scope": "rule"}, lines=10)

    def test_unequal_verse_instances_keep_the_draft_spans_and_disclosed_schemes(self):
        contract = catalog("cherita", [{"unit": "section", "role": "verse", "lines": n}
                                      for n in (1, 2, 3)])
        for seed in (0, 11):
            built = plan.make_plan(seed, song_form=contract, lines=6)
            self.assertEqual([s["lines"] for s in built["choices"]["schemes"].values()], [1, 2, 3])
            self.assertEqual([sum(l["section"] == s["name"] for l in built["line_slots"])
                              for s in built["sections"]], [1, 2, 3])
            self.assertEqual(plan.sweep([seed], song_form=contract, lines=6)["accepted"], [seed])
        for options in ({"lines": 7}, {"wants": ["lines_per_section>=2"]}):
            with self.assertRaises(plan.PlanRefused):
                plan.make_plan(0, song_form=contract, **options)

    def test_wordless_catalog_counts_do_not_use_the_generator_line_bound(self):
        roles = ["verse", "solo", "solo", "solo"]
        contract = catalog("wordless-sections", [
            {"unit": "section", "role": role, "lines": 2 if role == "verse" else None}
            for role in roles])
        for seed in (0, 11):
            baseline = plan.make_plan(seed, song_form=contract, lines=2)
            for wants in (["sections.solo=3"],
                          ["sections=4", "sections.solo>=3", "sections.solo<=3",
                           "sections.verse=1", "sections.chorus=0"]):
                with self.subTest(seed=seed, wants=wants):
                    native = plan.make_plan(seed, song_form=contract, lines=2, wants=wants)
                    for field in ("sections", "line_slots", "groups", "returns"):
                        self.assertEqual(native[field], baseline[field])
                    self.assertEqual(plan.sweep([seed], song_form=contract, lines=2,
                                     wants=[plan.parse_sweep_want(w) for w in wants])
                                     ["accepted"], [seed])
        for atom in ("sections.solo=2", "sections.solo>=4", "sections.solo<=2",
                     "sections=3", "sections>=5", "sections.chorus=1"):
            with self.subTest(atom=atom), self.assertRaises(plan.PlanRefused) as caught:
                plan.make_plan(0, song_form=contract, lines=2, wants=[atom])
            self.assertNotIsInstance(caught.exception, plan.SeedRefused)
            self.assertIn(atom, str(caught.exception))
            self.assertIn("catalog", str(caught.exception))

    def test_catalog_count_path_keeps_structural_and_length_checks(self):
        contract = catalog("wordless-sections", [
            {"unit": "section", "role": role, "lines": 2 if role == "verse" else None}
            for role in ("verse", "solo", "solo", "solo")])
        base = dict(song_form=contract, lines=2, wants=["sections.solo=3"])
        invalid = [
            {"functions": ["verse"]},
            {"form": "verse-chorus"},
            {"lines": 3},
            {"wants": ["sections.solo=3", "lines_per_section>=3"]},
            {"wants": ["sections.solo>=3", "sections.solo<=2"]},
            {"song_form": catalog("bad-placement", [
                {"unit": "section", "role": "verse", "lines": 2},
                {"unit": "section", "role": "intro", "lines": 2}]),
             "lines": 4, "wants": ["sections=2"]},
        ]
        for override in invalid:
            with self.subTest(override=override), self.assertRaises(plan.PlanRefused):
                plan.make_plan(0, **{**base, **override})

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

    def test_prescribed_pair_uses_the_native_terminal_binder_and_retains_requested_relation(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 2}], rhymes=[[1, 2]])
        for seed in range(5):
            native = plan.make_plan(seed, song_form=data)
            self.assertEqual(native["groups"], "1,2")
            self.assertEqual(native["relations"], {"A": "class:RHYME"})
            self.assertEqual(native["request"]["relations"], {})
            self.assertEqual(plan.fill_plan(native, ["1", "2"])["song_form"], data)
        chosen = plan.make_plan(11, song_form=data, relations={"A": "schema:perfect rhyme"})
        self.assertEqual(chosen["groups"], "1.endword,2.endword")
        self.assertEqual(chosen["relations"], {"A": "schema:perfect rhyme"})
        with self.assertRaisesRegex(plan.PlanRefused, "every selected line ending"):
            plan.make_plan(11, song_form=data, relation="class:ASSONANCE")

    def test_additional_relation_preserves_the_other_catalog_group(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 4}],
                       rhymes=[[1, 3], [2, 4]])
        for seed in (0, 11):
            native = plan.make_plan(seed, song_form=data, relations={"B": "schema:internal rhyme"})
            self.assertEqual(native["relations"], {"A": "class:RHYME", "B": "class:RHYME",
                                                   "C": "schema:internal rhyme"})
            a, b, extra = native["groups"].split(";")
            self.assertEqual((a, b), ("1,3", "2,4"))
            self.assertRegex(extra, r"^2\.(?:T[0-9]+|head),4\.(?:T[0-9]+|head)$")
            self.assertEqual(plan.fill_plan(native, ["1", "2", "3", "4"])["song_form"], data)
        with self.assertRaises(plan.PlanRefused):
            plan.make_plan(11, song_form=data, relation="schema:homoioteleuton")

    def test_extra_relation_binds_every_verbatim_copy_or_refuses_its_actual_placement(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 8}],
                       rhymes=[[1, 2, 7, 8], [3, 4, 5, 6]], returns=[[1, 7, 8]])
        with self.assertRaisesRegex(plan.PlanRefused, "two lines, the second directly after the first"):
            plan.make_plan(11, song_form=data, relations={"A": "schema:interlaced rhyme"})
        native = plan.make_plan(11, song_form=data, relations={"B": "schema:internal rhyme"})
        self.assertEqual(native["relations"]["C"], "schema:internal rhyme")
        layered = plan.make_plan(11, song_form=data, relations={"A": "schema:internal rhyme"})
        members = layered["groups"].split(";")[-1].split(",")
        self.assertEqual([m.split(".")[0] for m in members], ["1", "2", "7", "8"])
        self.assertEqual(layered["returns"], "1,7,8")

    def test_copies_can_bind_the_same_word_for_a_required_identity(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 12}],
                       rhymes=[[1, 2, 3], list(range(4, 13))], returns=[[1, 3]])
        native = plan.make_plan(11, song_form=data, relations={"A": "schema:anaphora"})
        self.assertEqual(native["groups"].split(";")[-1], "1.head,2.head,3.head")
        self.assertEqual(native["returns"], "1,3")

    def test_prescribed_group_remains_whole(self):
        for count in (3, 4):
            lines = list(range(1, count + 1))
            data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": count}], rhymes=[lines])
            for seed in range(5):
                native = plan.make_plan(seed, song_form=data)
                self.assertEqual(native["groups"], ",".join(map(str, lines)))
                self.assertEqual(native["relations"], {"A": "class:RHYME"})
            chosen = plan.make_plan(11, song_form=data, relations={"A": "schema:perfect rhyme"})
            self.assertEqual(chosen["groups"], ",".join(f"{line}.endword" for line in lines))
            with self.assertRaisesRegex(plan.PlanRefused, "whole prescribed terminal group"):
                plan.make_plan(11, song_form=data, relations={"A": "schema:semirhyme"})
            with self.assertRaisesRegex(plan.PlanRefused, "group size"):
                plan.make_plan(11, song_form=data, wants=["group<=2"])

    def test_prescribed_partition_keeps_each_group_and_its_relation(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 8}],
                       rhymes=[[1, 3], [2, 5, 7], [4, 6, 8]])
        native = plan.make_plan(11, song_form=data, relations={"B": "schema:perfect rhyme"})
        self.assertEqual(native["groups"], "1,3;2.endword,5.endword,7.endword;4,6,8")
        self.assertEqual(native["relations"], {"A": "class:RHYME", "B": "schema:perfect rhyme", "C": "class:RHYME"})
        for invalid in ([[1, 3], [2, 3, 5], [4, 6, 8]], [[2, 5, 7], [1, 3], [4, 6, 8]], [[i] for i in range(1, 9)]):
            with self.subTest(groups=invalid), self.assertRaises(plan.PlanRefused):
                plan.make_plan(11, song_form={**data, "rhymeGroups": invalid})

    def test_prescribed_classes_keep_one_member_unpaired_and_cross_real_section_boundaries(self):
        # ABCB | CDAE. D and E have no pair, but they must remain distinct.
        sections = [{"unit": "section", "role": "verse", "lines": 4}] * 2
        classes = [[1, 7], [2, 4], [3, 5], [6], [8]]
        data = catalog("fixture", sections, rhymes=classes)
        native = plan.make_plan(11, song_form=data, relations={"C": "schema:perfect rhyme"})
        self.assertEqual(native["groups"], "1,7;2,4;3.endword,5.endword")
        self.assertEqual(plan._sweep_coords(native).n_sounds, 5)
        self.assertEqual([s["section"] for s in native["line_slots"]], ["VERSE1"] * 4 + ["VERSE2"] * 4)
        self.assertEqual([s["rgs"] for s in native["choices"]["schemes"].values()],
                         [[0, 1, 2, 1], [0, 1, 2, 3]])
        self.assertEqual(plan.fill_plan(native, ["1"] * 8)["song_form"]["rhymeGroups"], classes)

    def test_fixed_return_has_one_source_and_preserves_all_copy_positions(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 6}],
                       rhymes=[[1, 2, 3, 4], [5, 6]], returns=[[1, 2, 4]])
        native = plan.make_plan(11, song_form=data)
        self.assertEqual(native["groups"], "1,3;5,6")
        self.assertEqual(native["returns"], "1,2,4")
        for classes in ([[1, 5]], [[1, 2], [2, 3]], [[1, 2, 3, 4]], [[True, 2]]):
            with self.subTest(classes=classes), self.assertRaises(plan.PlanRefused):
                plan.make_plan(11, song_form={**data, "returnGroups": classes})
        with self.assertRaisesRegex(plan.PlanRefused, "differing line requirements"):
            plan.make_plan(11, song_form={**data, "lineRequirements": [{"line": 2, "syllables": 3}]})

    def test_ending_word_rotations_through_fill_and_actual_graded_word_readings(self):
        import json
        from pathlib import Path
        import subprocess
        import lyric_harness as lh
        from quality import schemes
        from quality.catalog_grading import inspect_catalog
        root = Path(__file__).resolve().parents[2]
        lex = lh.Lexicon()
        from quality import revise
        reviser = revise.Reviser(lex=lex, writing=True)
        words = ["one", "two", "three", "four", "five", "six"]
        for form_id, variant in [("tritina", 0), ("sestina", 0), ("canzone", 1), ("canzone", 2)]:
            with self.subTest(form_id=form_id, variant=variant):
                output = subprocess.check_output(["node", str(root / "scripts/song_forms.mjs"), "create", form_id],
                                                 input=json.dumps({"variant": variant}), text=True)
                contract = json.loads(output)["contract"]
                native = plan.make_plan(1, song_form=contract)
                self.assertEqual(plan.sweep([1], song_form=contract)["accepted"], [1])
                self.assertEqual(native["returns"], "")
                classes = contract["endingWords"]["groups"]
                ends = {n: words[i] for i, group in enumerate(classes) for n in group}
                text = ["zero " + ends.get(i, "seven") for i in range(1, native["total_lines"] + 1)]
                gathered = contract["endingWords"].get("gathered", [])
                if gathered:
                    text[gathered[-1] - 1] = " ".join(words[:len(classes)])
                bp = plan.fill_plan(native, text)
                m = schemes.mandate([a.split(",") for a in native["groups"].split(";")],
                                    len(text), relations=native["relations"], default_relation=native["relation"])
                def grade(draft):
                    return inspect_catalog(lex, draft, bp, m, {"verdicts":[]})
                self.assertEqual(grade(text)["verdict"], "pass")
                replaced = text.copy()
                replaced[classes[0][1] - 1] = "zero eight"
                bad = grade(replaced)
                self.assertTrue(any(r["kind"] == "positioned-ending-identity" and r["outcome"] == "fail"
                                    for r in bad["checks"]))
                review = reviser.verify(
                    text, replaced, m, targeted={classes[0][1]}, blueprint=bp)
                self.assertFalse(review["accepted"])
                self.assertEqual(review["coverage_before"]["catalog_form"]["verdict"], "pass")
                self.assertEqual(review["coverage_after"]["catalog_form"]["verdict"], "fail")
                self.assertTrue(any(f["code"] == "CATALOG_FORM_MISMATCH"
                                    for f in review["new_findings"]))
                collapsed = [row.replace("two", "one") for row in text]
                self.assertTrue(any(r["kind"] == "endWord-distinct" and r["outcome"] == "fail"
                                    for r in grade(collapsed)["checks"]))
                if gathered:
                    omitted = text.copy()
                    omitted[gathered[-1] - 1] = "zero nine"
                    self.assertTrue(any(r["kind"] == "gathered-end-words" and r["outcome"] == "fail"
                                        for r in grade(omitted)["checks"]))

    def test_one_returning_end_word_never_exempts_whole_lines_or_their_openings(self):
        import lyric_harness as lh
        from quality import revise, schemes
        r = revise.Reviser(lex=lh.Lexicon(), writing=True)
        m = schemes.mandate([[1, 2]], 4, returns=[["1.endword", "3.endword"]])
        floor, _ = r._floor_for(m)
        self.assertFalse(floor.declared_lexical_classes)
        self.assertFalse(floor.declared_opening_classes)
        self.assertIn((0, 1), floor._pairs(["one"] * 4, "????"))

    def test_relative_lengths_reject_impossible_or_malformed_pairs(self):
        data = catalog("f", [{"unit": "section", "role": "verse", "lines": 4}])
        for key in (0, 2, 3, True):
            with self.subTest(key=key), self.assertRaises(plan.PlanRefused):
                plan.make_plan(11, song_form={**data, "lineRequirements": [{"line": 2, "shorterThan": key}]})
        rows = [{"line": 1, "syllables": 4}, {"line": 2, "syllables": 4, "shorterThan": 1}]
        with self.assertRaisesRegex(plan.PlanRefused, "fewer sung syllables"):
            plan.make_plan(11, song_form={**data, "lineRequirements": rows})

    def test_printed_pause_selects_the_immediately_preceding_word_and_the_line_ending(self):
        from quality.catalog_grading import _reading, inspect_catalog
        from quality import schemes
        import lyric_harness as lh
        lex = lh.Lexicon()
        contract = catalog("leonine-verse", [{"unit": "section", "role": "verse", "lines": None}])
        contract["lineProfile"] = "caesural-rhyme"
        native = plan.make_plan(11, lines=2, song_form=contract)
        self.assertIn("mid-line pause", native["writer_brief"])
        m = schemes.mandate([[1, 2]], 2)
        lines = ["zero one / none", "two | blue"]
        bp = plan.fill_plan(native, lines)
        for line, expected in [(lines[0], "pass"), ("one ten / none", "fail"),
                               ("two / two", "fail"), ("one, none", "unknown"),
                               ("one / none / one", "unknown"), ("red / read", "unknown"),
                               ("one / qzzxv", "unknown"), ("one (two / three) none", "unknown")]:
            with self.subTest(line=line):
                score = inspect_catalog(lex, [line, lines[1]], bp, m, {"verdicts": []})
                self.assertEqual(score["verdict"], expected, score)
                self.assertEqual([c["outcome"] for c in score["checks"]], [expected, "pass"])
        self.assertNotIn("caesuralRhyme", _reading(lex, lines[0]))

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
