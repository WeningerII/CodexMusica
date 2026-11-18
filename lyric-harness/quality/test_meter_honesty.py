#!/usr/bin/env python3
"""Regressions for the `meter` verb's honest output (#677 b1).

What `check_meter` compares, and how far: every expectation below is read
off the frozen fixture records on #677 (the production-reader supplement,
6588075475, and the synthetic contracts it cites), or off a hand-read
dictionary stress for a plain English word -- never off this module's own
output. The legacy keys keep their values; the new keys say what those
values are worth.

Run: python3 -m unittest quality.test_meter_honesty
"""

import copy
import inspect
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import lyric_harness as lh                                # noqa: E402
from quality import pronunciation as P                    # noqa: E402

IAMBIC5 = "./" * 5
TROCHAIC4 = "/." * 4
HEXAMETER = "/.." * 5 + "/."
IAMBIC4 = "./" * 4

# Frozen editions (#677 revision 2, 6587884272).
C1 = "That time of year thou mayst in me behold,"
C2 = "Tell me not, in mournful numbers,"
C3 = "THIS is the forest primeval. The murmuring pines and the hemlocks,"
V1 = "Gather ye rosebuds while ye may,"


def by_token(entry):
    return {w["token"]: w for w in entry.get("words") or ()}


class MeterHonesty(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lex = lh.Lexicon()

    def one(self, line, template, lex=None):
        return lh.check_meter(lex or self.lex, [line], template)[0]

    # -- production-reader fixtures C1-P, C2-P, C3-P, V1-P ------------------

    def test_c1_alignment_stops_at_the_unread_word(self):
        e = self.one(C1, IAMBIC5)
        # Legacy values unchanged.
        self.assertEqual((e["syllables"], e["stress"], e["syllable_match"],
                          e["strong_position_agreement"], e["oov"]),
                         (9, "././/.../", False, 0.4, ["mayst"]))
        # Honest values: "mayst" (token 6) has no reading; the comparison is
        # valid through token 5, five syllables, where the two strong slots
        # it reaches both match. Five strong slots in the template.
        self.assertEqual(by_token(e)[6]["source"], "unknown")
        self.assertEqual(e.get("syllable_count"), "lower_bound")
        self.assertEqual(e.get("alignment"), {"valid_through_token": 5,
                                          "valid_syllables": 5})
        self.assertEqual(e.get("strong_slots"),
                         {"total": 5, "compared": 2, "matched": 2})
        self.assertTrue((e.get("strong_position_agreement_basis") or "")
                        .startswith("misaligned after token 5"))
        # Demotion is disclosed per word, never applied silently.
        demoted = {w["word"] for w in e.get("words") or () if w["demoted"]}
        self.assertEqual(demoted, {"That", "of", "me"})

    def test_c2_weak_slot_demotion_does_not_move_strong_agreement(self):
        e = self.one(C2, TROCHAIC4)
        self.assertEqual((e["stress"], e["syllable_match"],
                          e["strong_position_agreement"]),
                         ("/./././.", True, 1.0))
        self.assertEqual(e.get("strong_slots"),
                         {"total": 4, "compared": 4, "matched": 4})
        me = by_token(e)[2]
        # Lexical 1, post-demotion 0, at position 2: a weak slot the
        # comparison never reads.
        self.assertEqual((me["lexical"], me["stream"], me["demoted"]),
                         ("1", "0", True))
        self.assertEqual(e.get("basis", {}).get("weak_positions", ""), "not_checked")

    def test_c3_only_the_first_strong_slot_misses_and_hemlocks_is_a_rule(self):
        e = self.one(C3, HEXAMETER)
        self.assertEqual((e["stress"], e["syllable_match"],
                          e["strong_position_agreement"]),
                         (".../../../../..//", True, 0.83))
        self.assertEqual(e.get("strong_slots"),
                         {"total": 6, "compared": 6, "matched": 5})
        hem = by_token(e)[11]
        self.assertEqual(hem["source"], "rule")
        self.assertEqual(hem["detail"], {"rule": "plural", "from": "hemlock"})
        # Secondary stress is kept in the lexical record; the comparison
        # merges it (and position 17 is a weak slot, unchecked).
        self.assertEqual(hem["lexical"], "12")
        self.assertEqual(e["stress"][16], "/")
        self.assertEqual(HEXAMETER[16], ".")

    def test_v1_production_reads_ye_stressed(self):
        e = self.one(V1, IAMBIC4)
        self.assertEqual((e["stress"], e["strong_position_agreement"]),
                         ("/.//.///", 0.75))
        self.assertEqual(e.get("strong_slots"),
                         {"total": 4, "compared": 4, "matched": 3})
        t = by_token(e)
        for k in (2, 5):
            self.assertEqual((t.get(k, {}).get("word"), t.get(k, {}).get("stream"), t.get(k, {}).get("demoted")),
                             ("ye", "1", False))
        self.assertEqual(t[3]["source"], "rule")
        self.assertEqual(t[3]["detail"]["from"], "rosebud")

    # -- synthetic contracts (#677 6587406414 §synthetic) -------------------

    def test_s1_equal_count_opposite_stress_separates_on_strong_slots(self):
        iamb = self.one("away believe become delight release", IAMBIC5)
        troch = self.one("garden yellow river morning table", IAMBIC5)
        self.assertEqual((iamb.get("strong_slots") or {}).get("matched"), 5)
        self.assertEqual((troch.get("strong_slots") or {}).get("matched"), 0)
        self.assertTrue(iamb["syllable_match"] and troch["syllable_match"])

    def test_s2_weak_slot_blind_spot_is_disclosed_not_passed(self):
        all_strong = self.one(
            "cold wind black rain dark night grim fog red sky", IAMBIC5)
        # Every strong slot agrees, exactly as for a true iambic line ...
        self.assertEqual(all_strong.get("strong_slots"),
                         {"total": 5, "compared": 5, "matched": 5})
        # ... and the five stressed weak positions are not checked, which
        # the report says rather than calling the line a full pass.
        self.assertEqual(all_strong.get("basis", {}).get("weak_positions", ""), "not_checked")
        self.assertIn("weak positions not checked", lh.meter_basis_line())

    def test_s3_first_listed_reading_is_named_with_its_alternatives(self):
        e = self.one("record", "/.")
        rec = (e.get("words") or [{}])[0]
        self.assertEqual(rec["source"], "dictionary")
        self.assertEqual(rec["detail"]["index"], 0)
        self.assertGreater(rec["detail"]["readings"], 1)
        self.assertIn("first listed reading", e.get("basis", {}).get("stress", ""))

    def test_s4_unknown_ends_alignment_and_a_guess_is_a_guess(self):
        e = self.one("away believe zorbleflax delight release", IAMBIC5)
        self.assertEqual(e.get("alignment"), {"valid_through_token": 2,
                                          "valid_syllables": 4})
        self.assertEqual((e.get("strong_slots") or {}).get("compared"), 2)
        guessed = self.one("away believe zorbleflax delight release",
                           IAMBIC5, lex=lh.Lexicon(fallback="low"))
        z = by_token(guessed)[3]
        self.assertEqual(z["source"], "guessed")
        self.assertGreater(z["syllables"], 0)
        self.assertEqual(guessed.get("alignment"), "exact")

    def test_form_observations_require_agreement_on_each_coordinate(self):
        def observe(text):
            return lh._form_reading(self.lex, text)

        self.assertEqual(observe("record"), {"syllables": 2, "stresses": 1})
        self.assertEqual(observe("hour"), {"stresses": 1})
        self.assertEqual(observe("read"), {"syllables": 1, "stress": "/"})
        self.assertEqual(observe("the read"), {"syllables": 2, "stress": "./"})
        self.assertEqual(observe("read zorbleflax"), {})
        self.assertEqual(observe("read 山"), {})
        self.assertEqual(observe("read (山)"), {"syllables": 1, "stress": "/"})
        self.assertEqual(lh._form_reading(lh.Lexicon(fallback="low"), "zorbleflax"), {})

    def test_s5_secondary_stress_kept_in_evidence_merged_in_comparison(self):
        e = self.one("the hemlock", "../")
        hem = by_token(e)[2]
        self.assertEqual(hem["lexical"], "12")
        self.assertEqual(e["stress"], ".//")
        self.assertIn("secondary stress merged", e.get("basis", {}).get("stress", ""))

    def test_catalog_count_uses_the_readers_sung_tokens_even_without_a_pronunciation(self):
        from quality.catalog_grading import _reading
        silent = lh.Lexicon(strip_parens=True, reader_scheme="v2")
        voiced = lh.Lexicon(strip_parens=False, reader_scheme="v2")
        text = "one (two)"
        for lex, tokens, n in ((silent, ["one"], 1), (voiced, ["one", "two"], 2)):
            record = _reading(lex, text)
            self.assertEqual(record["text"], text)
            self.assertEqual(record["sungWords"], tokens)
            self.assertEqual(record["syllables"], n)
        aside = _reading(silent, "(two)")
        self.assertEqual((aside["sungWords"], aside["syllables"]), ([], 0))
        rare = _reading(silent, "qzxv")
        self.assertEqual(rare["sungWords"], ["qzxv"])
        self.assertNotIn("syllables", rare)
        outside = _reading(silent, "one 我")
        self.assertIsNone(outside["sungWords"])
        self.assertNotIn("syllables", outside)
        self.assertNotIn("rhyme", outside)
        self.assertEqual(_reading(silent, "one (我)")["sungWords"], ["one"])
        self.assertEqual(_reading(silent, "two-part")["sungWords"], ["two-part"])

    def test_catalog_uses_native_section_instances_numeric_forms_and_implicit_owners(self):
        from quality.catalog_grading import _sections
        from quality.grid import song_from_blueprint
        parts = [{"name": name, "function": role, "bars": bars,
                  "meter": {"beats": "4", "unit": 4}}
                 for name, role, bars in (("A", "verse", 8), ("B", "chorus", "8"),
                                          ("A", "verse", 8.0), ("B", "chorus", 8))]
        slots = [{"bar": n, "duration": "8", **({"section": name} if name else {})}
                 for n, name in ((1, "A"), (5, None), (9, "B"), (13, None),
                                 (17, "A"), (21, None), (25, "B"), (29, None))]
        blueprint = {"sections": parts, "lines": slots}
        native, _ = song_from_blueprint(blueprint)
        self.assertEqual([len(native.lines_in(sec)) for sec in native.sections], [2] * 4)
        observed = [{} for _ in slots]
        spans = _sections(blueprint, observed)
        self.assertEqual([row["lineSpan"] for row in spans], [[0, 2], [2, 4], [4, 6], [6, 8]])
        self.assertEqual([row["bars"] for row in spans], [sec.bars for sec in native.sections])
        self.assertEqual([row["role"] for row in spans], ["verse", "chorus"] * 2)
        self.assertEqual(observed, [{"bars": 2}] * 8)
        # Overlapping repeated instances have no determinate owner. Neither
        # section spans nor derived line bars can enter the grader.
        ambiguous = copy.deepcopy(blueprint)
        ambiguous["sections"][2]["start_bar"] = 1
        untouched = [{} for _ in slots]
        self.assertIsNone(_sections(ambiguous, untouched))
        self.assertEqual(untouched, [{} for _ in slots])

    def test_catalog_grade_measures_bar_counts_on_submitted_blueprints(self):
        from types import SimpleNamespace
        from quality.catalog_grading import inspect_catalog
        data = {"song_form": {"id": "16-bar-blues", "variant": 1},
                "sections": [{"name": "A", "function": "verse",
                              "meter": {"beats": 4, "unit": 4}}],
                "lines": [{"bar": n, "duration": 4} for n in (1, 3, 5, 7)]}
        for bars, expected in ((16.0, "pass"), ("16", "pass"), ("8", "fail")):
            with self.subTest(bars=bars):
                data["sections"][0]["bars"] = bars
                verdict = inspect_catalog(self.lex, ["one"] * 4, data,
                                          SimpleNamespace(default_relation="type:perfect"), {})
                check = next(c for c in verdict["checks"] if c["kind"] == "bars")
                self.assertEqual((check["expected"], check["outcome"], verdict["verdict"]),
                                 (16, expected, expected))

    def test_catalog_grades_syllable_rimes_without_terminal_pair_evidence(self):
        from types import SimpleNamespace
        from quality.catalog_grading import inspect_catalog, _reading
        # Letter tokens have independent dictionary pronunciations.
        cases = (
            ("than-bauk", ["xxxx", "xxxy", "yxzz"], (1, 2)),
            ("luc-bat", ["xxxxxx", "xxxxxxxy", "xxxxxy", "xxxxxyxz"], (1, 5)),
        )
        mandate = SimpleNamespace(default_relation="class:perfect")
        for form, shapes, (row, column) in cases:
            blueprint = {"song_form": {"id": form}, "lines": [{"bar": i + 1} for i in range(len(shapes))],
                         "sections": [{"name": str(i), "function": "verse", "bars": width,
                                       "meter": {"beats": 4, "unit": 4}}
                                      for i, width in enumerate([2, 2] if form == "luc-bat" else [3])]}
            def grade(text):
                return inspect_catalog(self.lex, [" ".join(line) for line in text], blueprint,
                                       mandate, {"verdicts": []})
            with self.subTest(form=form):
                passed = grade(shapes)
                self.assertEqual(passed["verdict"], "pass", passed)
                altered = [list(s) for s in shapes]
                altered[row][column] = "z"
                self.assertEqual(grade(altered)["verdict"], "fail")
                altered[row][column] = "qzxv"
                self.assertEqual(grade(altered)["verdict"], "unknown")
                if form == "luc-bat":
                    collided = [s.replace("y", "x") for s in shapes]
                    checks = grade(collided)["checks"]
                    self.assertTrue(any(c["kind"] == "syllable-rhyme-distinct" and c["outcome"] == "fail"
                                        for c in checks))
        self.assertEqual(_reading(self.lex, "x (y) z")["syllableRimes"], ["EH K S", "IY"])

    def test_s7_an_unknown_word_never_counts_as_matched(self):
        e = self.one("zorbleflax", "/")
        self.assertEqual(e.get("strong_slots"),
                         {"total": 1, "compared": 0, "matched": 0})

    def test_declared_reading_is_named_declared(self):
        line = "the record"
        noun = ["R", "EH1", "K", "ER0", "D"]
        lex = copy.copy(self.lex)
        lex.pronunciations = P.validate_choices(
            [dict(line=line, token=2, word="record", phones=noun,
                  basis="dictionary", source="test: noun reading")], lex)
        e = self.one(line, "./.", lex=lex)
        rec = by_token(e)[2]
        self.assertEqual(lh._form_reading(lex, line), {"syllables": 3, "stress": "./."})
        self.assertEqual((rec["source"], rec["lexical"]), ("declared", "10"))

    def test_legacy_template_symbols_are_disclosed(self):
        e = self.one("Tell me not", "X/x/")
        self.assertEqual(e.get("template_symbols_read_as_weak"), ["X", "x"])
        self.assertEqual(e.get("missing_positions"), 1)

    def test_dropped_g_is_rederived_and_never_assumed(self):
        # Jony (#686): the reduced-reading branch must re-derive -ing -> -in'
        # and claim nothing when it cannot.
        e = self.one("nothin' is lovin' feelin'", "/./././")
        src = {w["word"]: (w["source"], w.get("detail", {}).get("from"))
               for w in e["words"]}
        self.assertEqual(src["nothin'"], ("rule", "nothing"))
        self.assertEqual(src["lovin'"], ("rule", "loving"))
        self.assertEqual(lh._reading_provenance(
            self.lex, "lovin'", ["L", "AH1", "V", "IH0", "Z"], False),
            ("unclassified", {}))

    def test_elision_is_rederived_and_never_assumed(self):
        # 3PO's provenance-parity audit (#677 6641363309): a mutant that
        # changed the elision reading's phones survived every meter test,
        # because no test named the elision rule. `crown'd` reads as
        # CMUdict `crowned` (K R AW1 N D), and anything else is not claimed.
        e = self.one("crown'd", "/")
        rec = by_token(e)[1]
        self.assertEqual((rec["source"], rec.get("detail")),
                         ("rule", {"rule": "elision", "from": "crowned"}))
        self.assertEqual(rec.get("lexical"), "1")
        self.assertEqual(lh._reading_provenance(
            self.lex, "crown'd", ["K", "R", "AW1", "N", "D", "Z"], False),
            ("unclassified", {}))

    def test_only_an_accent_rule_reading_is_called_accent_derived(self):
        # 3PO's provenance-parity audit (#677 6641363309): supplement rows
        # whose source is `rule:number-compound` were labelled
        # "accent-derived (number-compound)". They are rule-derived, not
        # accent readings. `here` (NEAR respelling) is the accent control.
        from quality import lexicon_supplement as LS
        try:
            sv2 = LS.supplemented_lexicon(reader_scheme="v2")
        except LS.SupplementUnavailable as exc:
            self.skipTest(str(exc))

        def reading(lex, word):
            rec = by_token(self.one(word, "./", lex=lex))[1]
            return rec["source"], rec["detail"].get("reading")

        self.assertEqual(reading(sv2, "thirty-one"),
                         ("dictionary", "rule-derived (number-compound)"))
        self.assertEqual(reading(sv2, "here"),
                         ("dictionary", "accent-derived (near)"))
        self.assertEqual(reading(self.lex, "here"),
                         ("dictionary", "accent-derived (near)"))
        self.assertEqual(reading(self.lex, "record"),
                         ("dictionary", "cmudict"))

    def test_both_dropped_g_routes_name_one_rule(self):
        # Jony (#686 nit): the reduced-variant route (lovin') and the
        # fallback route (everythin') spell the rule the same way.
        e = self.one("lovin' everythin'", "/./.")
        rules = {w["word"]: w.get("detail", {}).get("rule")
                 for w in e["words"]}
        self.assertEqual(rules, {"lovin'": "dropped g (-in')",
                                 "everythin'": "dropped g (-in')"})

    def test_basis_is_not_shared_between_entries(self):
        a, b = lh.check_meter(self.lex, ["away", "release"], "./")
        a["basis"]["stress"] = "mutated"
        self.assertNotEqual(b["basis"]["stress"], "mutated")
        self.assertNotEqual(lh.METER_BASIS["stress"], "mutated")

    # -- contract pins -------------------------------------------------------

    def test_legacy_keys_and_signature_unchanged(self):
        self.assertEqual(str(inspect.signature(lh.check_meter)),
                         "(lex, lines, template=None)")
        e = self.one("away believe become delight release", IAMBIC5)
        for k in ("line", "text", "syllables", "stress", "oov",
                  "target_syllables", "syllable_match",
                  "strong_position_agreement"):
            self.assertIn(k, e)
        src = inspect.getsource(lh.check_meter)
        self.assertNotIn("monosyllables count as flexible", src)
        for token in ("quality.grid", "quality.fit", "blueprint", "cycle",
                      "subdivision"):
            self.assertNotIn(token, src)

    def test_human_lines_say_partial_and_name_the_stop(self):
        rows = lh.meter_report_lines(self.one(C1, IAMBIC5))
        self.assertIn("[syllables partial: 9 read, 10 expected]", rows[0])
        self.assertIn("strong 2/2 matched of 5", rows[0])
        self.assertTrue(any("'mayst': no reading; alignment stops before it"
                            in r for r in rows))
        # The legacy number is NOT printed once alignment stops (it stays in
        # the entry for compatibility); the human line says why.
        self.assertFalse(any("0.4" in r for r in rows), rows)
        self.assertTrue(any("full-line strong-position agreement not computed:"
                            " alignment stops before token 6 'mayst'" in r
                            for r in rows), rows)
        self.assertEqual(self.one(C1, IAMBIC5)["strong_position_agreement"],
                         0.4)
        # An aligned line still prints its legacy number (C2, C3).
        self.assertTrue(any("legacy strong-pos agreement 1.0" in r
                            for r in lh.meter_report_lines(
                                self.one(C2, TROCHAIC4))))
        self.assertTrue(any("legacy strong-pos agreement 0.83" in r
                            for r in lh.meter_report_lines(
                                self.one(C3, HEXAMETER))))
        rows = lh.meter_report_lines(self.one(C3, HEXAMETER))
        self.assertIn("[syllables ok: 17/17]", rows[0])
        self.assertTrue(any("rule-derived (plural of 'hemlock')" in r
                            for r in rows))


if __name__ == "__main__":
    unittest.main()
