"""Seeded catalog authoring: exercise the native planner, fill and sweep without specimen lyrics."""
import unittest
from unittest.mock import patch

from quality import plan


def catalog(form_id, sections, rhymes=(), returns=()):
    return {"version": 1, "id": form_id, "scope": "rule", "variant": 0, "counts": {},
            "sections": sections, "rhymeGroups": list(rhymes), "returnGroups": list(returns)}


def terminal_types():
    """-> the relations a prescribed group with no stated type can draw (#902)."""
    from quality.catalog_shape import terminal_rhyme_relation
    return {f"schema:{name}" for name in plan.eligible_types() if terminal_rhyme_relation(name)}


def ends(*lines, relation=None):
    """-> a line-end group as the planner spells it: each line's last word
    for a type the grader judges at a named word (`pair_bindable`), else the
    bare lines, as for a type whose members may span words (#902)."""
    if relation is not None:
        from quality import relations
        schema = plan._schema_of(relation)[1]
        if schema is not None and not relations.pair_bindable(schema):
            return ",".join(map(str, lines))
    return ",".join(f"{line}.endword" for line in lines)


class CatalogPlannerTests(unittest.TestCase):
    def test_repeated_riff_and_break_are_measured_in_the_filled_score(self):
        import json
        import subprocess
        from copy import deepcopy
        from pathlib import Path
        from quality.catalog_grading import _sections
        script = Path(__file__).resolve().parents[2] / "scripts" / "song_forms.mjs"

        def call(command, **kwargs):
            return json.loads(subprocess.check_output(
                ["node", str(script), command, "vamp-riff-form"],
                input=json.dumps(kwargs), text=True))

        built = plan.make_plan(43, song_form=call("create")["contract"])
        words = ["a b"] * len(built["line_slots"])
        rows = _sections(plan.fill_plan(built, words), [{} for _ in words])
        verdict = lambda parts: call("grade-observations", sections=parts)["verdict"]
        self.assertEqual(verdict(rows), "pass")
        self.assertEqual(rows[1]["lineSpan"][0], rows[1]["lineSpan"][1])
        missing = deepcopy(rows)
        del missing[0]["sectionMelody"]
        self.assertEqual(verdict(missing), "unknown")
        damaged = deepcopy(rows)
        damaged[0]["sectionMelody"]["notes"][0]["pitch_hz"] += 1
        self.assertEqual(verdict(damaged), "fail")
        continued = deepcopy(rows)
        cycle = continued[0]["sectionMelody"]["notes"][:2]
        continued[1]["sectionMelody"]["notes"] = cycle * continued[1]["bars"]
        self.assertEqual(verdict(continued), "fail")
        unmeasured_break = deepcopy(rows)
        beat = unmeasured_break[1]["sectionMelody"]["notes"][0]
        beat["ticks"] -= 1
        unmeasured_break[1]["sectionMelody"]["notes"].append({"ticks": 1, "pitch_hz": 333})
        self.assertEqual(verdict(unmeasured_break), "unknown")

    def test_a_section_with_rows_printed_above_names_the_section_that_printed_them(self):
        """#902 (John: "say repeated lines once"; R2's case): a section whose
        rows under its bracket an earlier section printed names that section,
        by its bracket's name and its count among those brackets, and the one
        it names is the right one when an earlier section of the same name
        has other rows. Only the beats and strong beats repeating names the
        section for those rows alone. Over every catalog form at seed 1, the
        rows each section should get are read from the plan's own fields."""
        import json
        import re
        import subprocess
        from pathlib import Path
        script = Path(__file__).resolve().parents[2] / "scripts" / "song_forms.mjs"
        forms = json.loads(subprocess.check_output(["node", str(script), "list"],
                                                   stdin=subprocess.DEVNULL, text=True))
        fields = ("accompaniment", "closing_chord", "voice_score", "section_melody",
                  "section_parts", "source_role")
        def create(form_id, counts):
            return json.loads(subprocess.run(
                ["node", str(script), "create", form_id], input=json.dumps({"counts": counts}),
                capture_output=True, text=True).stdout)

        named_later = pulses_named = whole_named = 0
        for form in forms:
            # A form that needs repeat counts gets each at its least.
            made = create(form["id"], {})
            if made["status"] == "needs-input" and all(n["kind"] == "count" for n in made["needs"]):
                made = create(form["id"], {n["path"]: n["min"] for n in made["needs"]})
            if made["contract"] is None:
                continue
            try:
                built = plan.make_plan(1, song_form=made["contract"])
            except plan.SeedRefused:
                continue
            lines = built["writer_brief"].splitlines()
            brackets = [i for i, line in enumerate(lines)
                        if re.match(r"^  \[[A-Z]", line) and line.endswith("]")]
            self.assertEqual(len(brackets), len(built["sections"]), form["id"])
            seen, rows_of, beats_of = {}, {}, {}
            for i, sec in zip(brackets, built["sections"]):
                label = plan.section_label(sec)
                seen[label] = seen.get(label, 0) + 1
                here = (label, seen[label])
                slots = [s for s in built["line_slots"] if s["section"] == sec["name"]]
                own = {k: sec.get(k) for k in fields}
                if "accompaniment" in sec:
                    own["speech"] = slots[-1]["speech_event"]
                if "source_role" in sec or "section_melody" in sec:
                    own["function"] = sec["function"]
                beats = (plan.line_pulses_and_heads(sec, slots[0]) if slots else None)
                ceiling = (int(plan.line_syllable_ceiling(slots[0]["duration"] * built["subdivision"]))
                           if slots else None)
                key = (json.dumps(own, sort_keys=True), repr(beats), ceiling)
                if not slots and not any(own.values()):
                    continue
                first = rows_of.setdefault(key, here)
                under = lines[i + 1:i + 2]
                with self.subTest(form=form["id"], section=sec["name"]):
                    if first != here:
                        self.assertEqual(under, [f"    as in the {plan._ordinal(first[1])} {first[0]} above"])
                        whole_named += 1
                        named_later += first[0] == label and first[1] > 1
                        continue
                    self.assertFalse(under[0].startswith("    as in the "), under)
                    if beats is None:
                        continue
                    seen_beats = beats_of.setdefault(repr(beats), here)
                    expect = (f"      each line: as in the {plan._ordinal(seen_beats[1])} "
                              f"{seen_beats[0]} above")
                    shown = lines[i + 1:brackets[brackets.index(i) + 1]
                                  if i != brackets[-1] else len(lines)]
                    self.assertEqual(expect in shown, seen_beats != here, shown[:6])
                    pulses_named += seen_beats != here
        # The two cases this test is for are present: a section names a later
        # one of its own name over the first, and a section with other rows
        # names an earlier one for its beats and strong beats alone.
        self.assertGreater(named_later, 0)
        self.assertGreater(pulses_named, 0)
        self.assertGreater(whole_named, named_later)

    def test_multi_voice_scores_use_actual_written_parts(self):
        import json
        import subprocess
        from copy import deepcopy
        from pathlib import Path
        from quality.catalog_grading import _sections
        script = Path(__file__).resolve().parents[2] / "scripts" / "song_forms.mjs"
        for form, counts in [("canzonet", {"1.1": 2, "1.1.1": 2}), ("glee", {"1.1": 3})]:
            with self.subTest(form=form):
                def run(command, **args):
                    raw = subprocess.check_output(["node", str(script), command, form],
                              input=json.dumps({"counts": counts, **args}), text=True)
                    return json.loads(raw)
                built = plan.make_plan(11, song_form=run("create")["contract"])
                words = ["a b" for _ in built["line_slots"]]
                rows = _sections(plan.fill_plan(built, words), [{} for _ in words])
                score = lambda parts: run("grade-observations", sections=parts)["verdict"]
                self.assertEqual(score(rows), "pass")
                self.assertIn("Scored voice v2", built["writer_brief"])
                missing = deepcopy(rows)
                del missing[0]["sectionParts"]
                self.assertEqual(score(missing), "unknown")
                damaged = deepcopy(rows)
                if form == "glee":
                    damaged[1]["sectionParts"] = deepcopy(damaged[0]["sectionParts"])
                    damaged[1]["sectionMelody"] = deepcopy(damaged[0]["sectionMelody"])
                    self.assertEqual(score(damaged), "fail")
                    player = dict(deepcopy(rows[0]["sectionParts"][0]), performer="p1", kind="instrument")
                    rows[0]["sectionParts"].append(player)
                    self.assertEqual(score(rows), "fail")
                else:
                    voice = damaged[-1]["sectionParts"][1]["melody"]
                    voice["notes"][0]["pitch_hz"] += 7
                    self.assertEqual(score(damaged), "fail")
                    rows[-1]["sectionParts"].pop()
                    self.assertEqual(score(rows), "fail")

    def test_open_catalog_span_and_selected_writer_part_bars_remain_distinct(self):
        import json
        import subprocess
        from pathlib import Path
        import lyric_harness as lh
        from quality.catalog_grading import inspect_catalog
        from quality import revise, schemes
        script = Path(__file__).resolve().parents[2] / "scripts" / "song_forms.mjs"
        select = {"variant": 2, "counts": {"1.1": 0}}
        key = "verse-refrain-with-introductory-verse"
        contract = json.loads(subprocess.check_output(["node", str(script), "create", key],
                              input=json.dumps(select), text=True))["contract"]
        built = plan.make_plan(11, song_form=contract)
        draft = ["one two", "three four", "five six", "seven eight"]
        bp = plan.fill_plan(built, ["one two"] * len(built["line_slots"]))
        bp["lines"] = []
        start = 1
        for sec, bars, text in zip(bp["sections"], (7, 7, 11, 7), draft):
            beats = sec["meter"]["beats"]
            sec["start_bar"], sec["bars"] = start, bars
            pitch = 220 if sec["source_role"] == "part-a" else 285
            ticks = bars * beats
            sec["section_melody"] = {"bars":bars,"meter":sec["meter"],"subdivision":1,
                "notes":[{"pitch_hz":200,"ticks":1},{"pitch_hz":pitch,"ticks":ticks-1}]}
            bp["lines"].append({"section":sec["name"], "text":text, "bar":start, "beat":1, "duration":1})
            start += bars
        lex = lh.Lexicon()
        lex.catalog_selection = {"id":key, **select}
        mandate = schemes.Mandate(n_lines=len(draft))
        lookup = dict(bp)
        del lookup["song_form"]
        self.assertEqual(inspect_catalog(lex, draft, lookup, mandate, {})["verdict"], "pass")
        selected = inspect_catalog(lex, draft, bp, mandate, {})
        self.assertEqual(selected["verdict"], "fail")
        self.assertEqual([r["actual"] for r in selected["checks"] if r["kind"] == "selected-part-bars"], [7,7,11,7])
        self.assertIn("8, 8, 8, 8",built["writer_brief"])
        inspected = revise.Reviser(lex=lex, writing=True).inspect(draft, mandate, blueprint=bp)
        self.assertEqual(
            {finding.subject[0] for finding in inspected["whole"] if finding.code == "CATALOG_FORM_MISMATCH"},
            {f"catalog:{key}:selected-part-bars:section[{i}]" for i in range(1, 5)})

    def test_nested_refrain_spans_and_pitch_survive_seeded_fill_and_grade(self):
        import json
        import subprocess
        from pathlib import Path
        from quality.catalog_grading import _sections
        script = Path(__file__).resolve().parents[2] / "scripts" / "song_forms.mjs"
        for variant in range(4):
            for intro in (0, 1):
                opts = {"variant": variant, "counts": {"1.1": intro}}
                def call(command, **extra):
                    proc = subprocess.run(["node", str(script), command, "verse-refrain-with-introductory-verse"],
                                          input=json.dumps({**opts, **extra}), text=True,
                                          capture_output=True, check=True)
                    return json.loads(proc.stdout)
                with self.subTest(variant=variant, intro=intro):
                    contract = call("create")["contract"]
                    built = plan.make_plan(11, song_form=contract)
                    lines = [str(i + 1) for i in range(len(built["line_slots"]))]
                    bp = plan.fill_plan(built, lines)
                    rows = _sections(bp, [{} for _ in lines])
                    self.assertEqual(sum(r["bars"] for r in rows[intro:]), 16 if variant < 2 else 32)
                    self.assertEqual(call("grade-observations", sections=rows)["verdict"], "pass")
                    del rows[-1]["sectionMelody"]
                    self.assertEqual(call("grade-observations", sections=rows)["verdict"], "unknown")
                    rows[-1]["divisionPath"] = rows[-1]["divisionPath"][:-1]
                    self.assertEqual(call("grade-observations", sections=rows)["verdict"], "fail")

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
        drawn = set()
        for seed in range(5):
            native = plan.make_plan(seed, song_form=data)
            self.assertEqual(native["groups"], ends(1, 2, relation=native["relations"]["A"]))
            self.assertEqual(set(native["relations"]), {"A"})
            self.assertIn(native["relations"]["A"], terminal_types())
            drawn.add(native["relations"]["A"])
            record, = native["choices"]["relations"]["groups"]
            self.assertEqual(record["chosen_from"], f"equal odds over {len(terminal_types())} "
                             "eligible types that rhyme at both line endings")
            self.assertIn(f"the {len(terminal_types())} eligible types that rhyme",
                          native["choices"]["relations"]["chosen_from"])
            self.assertEqual(native["request"]["relations"], {})
            self.assertEqual(plan.fill_plan(native, ["1", "2"])["song_form"], data)
        self.assertGreater(len(drawn), 1)
        coarse = plan.make_plan(11, song_form=data, relation="class:RHYME")
        self.assertEqual((coarse["groups"], coarse["relations"]), ("1,2", {"A": "class:RHYME"}))
        chosen = plan.make_plan(11, song_form=data, relations={"A": "schema:perfect rhyme"})
        self.assertEqual(chosen["groups"], "1.endword,2.endword")
        self.assertEqual(chosen["relations"], {"A": "schema:perfect rhyme"})
        with self.assertRaisesRegex(plan.PlanRefused, "every selected line ending"):
            plan.make_plan(11, song_form=data, relation="class:ASSONANCE")

    def test_each_catalog_rhyme_group_is_judged_by_its_own_type(self):
        # A form with two rhyme groups (#902). The catalog reader also compares
        # each group's last words from the last stressed vowel; that stands in
        # for the coarse class only. A group given a rhyme type is judged by
        # that type, so a pair the type accepts passes even where those
        # sounds differ, and the coarse class still needs them to agree. The
        # mandate is the planner's own, for every type a group can draw.
        from quality import schemes
        from quality.catalog_grading import _native_rhyme
        groups = [[1, 3], [2, 4]]
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 4}],
                       rhymes=groups)
        report = {"verdicts": [{"lines": g, "group": k, "satisfied_by": ["judged"]}
                               for k, g in enumerate(groups)]}

        def judged(**chosen):
            for seed in range(20):
                try:
                    native = plan.make_plan(seed, song_form=data, **chosen)
                    break
                except plan.SeedRefused:
                    continue
            mandate = schemes.mandate([g.split(",") for g in native["groups"].split(";")], 4,
                                      relations=native["relations"],
                                      default_relation=native["relation"])
            result = {"verdict": "fail", "checks": [
                {"kind": "rhyme", "label": "A", "lines": [1, 3], "outcome": "fail"},
                {"kind": "rhyme", "label": "B", "lines": [2, 4], "outcome": "pass"},
                {"kind": "rhyme-distinct", "labels": ["A", "B"], "outcome": "pass"}]}
            return _native_rhyme(result, ["a"] * 4, mandate, report, terminal_groups=groups)

        for relation in sorted(terminal_types()):
            with self.subTest(relation=relation):
                graded = judged(relations={"A": relation, "B": relation})
                self.assertEqual(graded["verdict"], "pass")
                self.assertEqual([c["outcome"] for c in graded["checks"]], ["pass"] * 3)
        coarse = judged(relation="class:RHYME")
        self.assertEqual(coarse["verdict"], "fail")
        self.assertEqual([(c["nativeOutcome"], c["identityOutcome"], c["outcome"])
                          for c in coarse["checks"] if c["kind"] == "rhyme"],
                         [("pass", "fail", "fail"), ("pass", "pass", "pass")])

    def test_line_end_groups_draw_types_that_span_words_only_if_they_end_both_lines(self):
        # Read from the registry (#902): a type a catalog group may draw is
        # read at each line's last word, or its members may span words but
        # must each end their line. A type that may sit inside a line, or run
        # across its end, is not drawn.
        from quality import relations
        from quality.catalog_shape import terminal_rhyme_relation
        spanning = [n for n in plan.eligible_types()
                    if any(s.cross_word for s in plan._schema_of(n)[1].spans)]
        self.assertTrue(spanning)
        for name in spanning:
            schema = plan._schema_of(name)[1]
            ends = any(p.kind == "both_line_final" for p in schema.placement)
            with self.subTest(name=name):
                self.assertEqual(terminal_rhyme_relation(name), ends)
        drawn = {f"schema:{n}" for n in spanning if terminal_rhyme_relation(n)}
        self.assertTrue(drawn and drawn <= terminal_types())
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 4}],
                       rhymes=[[1, 3], [2, 4]])
        seen = set()
        for seed in range(60):
            try:
                seen |= set(plan.make_plan(seed, song_form=data)["relations"].values())
            except plan.SeedRefused:
                continue
        self.assertTrue(drawn <= seen, (drawn, seen))
        self.assertFalse(relations.audible_as_end_rhyme(plan._schema_of(sorted(drawn)[0][7:])[1]))

    def test_additional_relation_preserves_the_other_catalog_group(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 4}],
                       rhymes=[[1, 3], [2, 4]])
        for seed in (0, 11):
            native = plan.make_plan(seed, song_form=data, relations={"B": "schema:internal rhyme"})
            self.assertEqual(set(native["relations"]), {"A", "B", "C"})
            self.assertLessEqual({native["relations"]["A"], native["relations"]["B"]}, terminal_types())
            self.assertEqual(native["relations"]["C"], "schema:internal rhyme")
            a, b, extra = native["groups"].split(";")
            rel = native["relations"]
            self.assertEqual((a, b), (ends(1, 3, relation=rel["A"]), ends(2, 4, relation=rel["B"])))
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
                self.assertEqual(native["groups"], ends(*lines, relation=native["relations"]["A"]))
                self.assertIn(native["relations"]["A"], terminal_types())
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
        rel = native["relations"]
        self.assertEqual(native["groups"], f"{ends(1, 3, relation=rel['A'])};"
                         f"{ends(2, 5, 7, relation=rel['B'])};{ends(4, 6, 8, relation=rel['C'])}")
        self.assertEqual(native["relations"]["B"], "schema:perfect rhyme")
        self.assertLessEqual({native["relations"]["A"], native["relations"]["C"]}, terminal_types())
        for invalid in ([[1, 3], [2, 3, 5], [4, 6, 8]], [[2, 5, 7], [1, 3], [4, 6, 8]], [[i] for i in range(1, 9)]):
            with self.subTest(groups=invalid), self.assertRaises(plan.PlanRefused):
                plan.make_plan(11, song_form={**data, "rhymeGroups": invalid})

    def test_prescribed_classes_keep_one_member_unpaired_and_cross_real_section_boundaries(self):
        # ABCB | CDAE. D and E have no pair, but they must remain distinct.
        sections = [{"unit": "section", "role": "verse", "lines": 4}] * 2
        classes = [[1, 7], [2, 4], [3, 5], [6], [8]]
        data = catalog("fixture", sections, rhymes=classes)
        native = plan.make_plan(11, song_form=data, relations={"C": "schema:perfect rhyme"})
        rel = native["relations"]
        self.assertEqual(native["groups"], f"{ends(1, 7, relation=rel['A'])};"
                         f"{ends(2, 4, relation=rel['B'])};{ends(3, 5, relation=rel['C'])}")
        self.assertEqual(plan._sweep_coords(native).n_sounds, 5)
        self.assertEqual([s["section"] for s in native["line_slots"]], ["VERSE1"] * 4 + ["VERSE2"] * 4)
        self.assertEqual([s["rgs"] for s in native["choices"]["schemes"].values()],
                         [[0, 1, 2, 1], [0, 1, 2, 3]])
        self.assertEqual(plan.fill_plan(native, ["1"] * 8)["song_form"]["rhymeGroups"], classes)

    def test_fixed_return_has_one_source_and_preserves_all_copy_positions(self):
        data = catalog("fixture", [{"unit": "section", "role": "verse", "lines": 6}],
                       rhymes=[[1, 2, 3, 4], [5, 6]], returns=[[1, 2, 4]])
        native = plan.make_plan(11, song_form=data)
        rel = native["relations"]
        self.assertEqual(native["groups"], f"{ends(1, 3, relation=rel['A'])};{ends(5, 6, relation=rel['B'])}")
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

    def test_hook_follows_the_form_own_returning_section(self):
        """Every setting the automatic draw can choose: the plan names a hook
        line exactly when the form places a sung section whose row returns
        word for word more than once, and that line is in such a section."""
        import json
        import subprocess
        from collections import Counter
        from pathlib import Path
        from quality import grid
        root = Path(__file__).resolve().parents[2]
        source = ("import { automaticFormCandidates } from './mcp/lyric_form.js';"
                  "process.stdout.write(JSON.stringify("
                  "await automaticFormCandidates({ lines: null })));")
        drawn = json.loads(subprocess.check_output(
            ["node", "--input-type=module", "-e", source], cwd=root, text=True))
        rows = sorted({json.dumps([c["id"], c["variant"], c["counts"]], sort_keys=True): c
                       for c in drawn}.items())
        seen = Counter()
        for index, (key, contract) in enumerate(rows):
            built = None
            for seed in range(10 * index + 1, 10 * index + 11):
                try:
                    built = plan.make_plan(seed, song_form=contract)
                    break
                except plan.PlanRefused:
                    pass
            if built is None:
                seen["unplanned"] += 1
                continue
            count = Counter(s["function"] for s in built["sections"])
            returning = {fn for fn, n in count.items() if n > 1 and getattr(
                grid.SECTION_FUNCTIONS.get(fn), "returns_as", "") == "verbatim"}
            with self.subTest(setting=key):
                if returning:
                    seen["hook"] += 1
                    slot = [s for s in built["line_slots"] if s["line"] == built["hook_slot"]]
                    self.assertEqual(len(slot), 1, built["hook_slot_refused"])
                    self.assertIn(slot[0]["function"], returning)
                    self.assertEqual(built["choices"]["hook"]["value"], built["hook_slot"])
                else:
                    seen["none"] += 1
                    self.assertFalse(built["hook_slot"])
                    self.assertIn(repr(contract["id"]), built["hook_slot_refused"])
                    self.assertNotIn("hook", built["choices"])
        self.assertTrue(seen["hook"] and seen["none"], seen)
        self.assertLess(seen["unplanned"], len(rows) / 10, seen)

    def test_reprise_source_is_drawn_kept_as_declared_or_absent(self):
        """A reprise's first line comes back from the first line of an
        earlier sung section, drawn with equal odds; a copy the form declares
        there is kept; a reprise with nothing sung before it brings back no
        line, and the receipt says so (#902). It used to copy line 1 whatever
        came before."""
        section = lambda role, lines=None: {"unit": "section", "role": role, "lines": lines}
        three = catalog("probe", [section("verse"), section("bridge"), section("reprise")])
        drawn = set()
        for seed in range(1, 9):
            built = plan.make_plan(seed, lines=12, song_form=three)
            firsts = {}
            for slot in built["line_slots"]:
                firsts.setdefault(slot["section"], slot["line"])
            heads = [firsts[s["name"]] for s in built["sections"] if s["function"] != "reprise"]
            target = next(firsts[s["name"]] for s in built["sections"] if s["function"] == "reprise")
            (source, line), = built["choices"]["reprise"]["value"]
            self.assertEqual((line, built["choices"]["reprise"]["sources"]), (target, [heads]))
            self.assertIn(source, heads)
            self.assertIn(f"{source},{target}", built["returns"].split(";"))
            self.assertIn(f"Line {target} opens the reprise by repeating line {source} word for word.",
                          built["writer_brief"])
            self.assertEqual(plan.make_plan(seed, lines=12, song_form=three)["returns"], built["returns"])
            drawn.add(heads.index(source))
        self.assertEqual(drawn, {0, 1})
        declared = catalog("probe", [section("verse", 4), section("reprise", 4)], returns=[[2, 5]])
        built = plan.make_plan(1, lines=8, song_form=declared)
        self.assertEqual(built["returns"], "2,5")
        self.assertNotIn("reprise", built["choices"])
        wordless_first = catalog("probe", [section("solo"), section("reprise"), section("verse")])
        built = plan.make_plan(1, lines=8, song_form=wordless_first)
        self.assertEqual(built["returns"], "")
        self.assertEqual(built["choices"]["reprise"]["value"], [])
        self.assertEqual(built["choices"]["reprise"]["no_line_before"], [1])

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
