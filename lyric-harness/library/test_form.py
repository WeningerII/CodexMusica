"""Reader regressions: source identity, native units and honest unknowns."""
import copy
import json
import os
import sys
import unittest
from fractions import Fraction
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from library.form import InvalidDeclaration, analyze_form, analyze_language, decode_beatgrid, source_ground
from quality.fit import LineFit, LineUnits, Placement, uncovered_bar_findings
from quality.meter import Cycle


def source(rows, language="fin"):
    items, dense = [], 0
    for index, text in enumerate(rows):
        kind = "apparatus" if text.startswith("[") else "lyric" if text else "blank"
        dense += kind == "lyric"
        items.append({"id": f"l{index + 1}", "text": text, "source_text": text,
                      "kind": kind, "physical_line": index + 100,
                      "analysis_line": dense if kind == "lyric" else None,
                      "source_cp_range": [index * 20, index * 20 + len(text)]})
    return {"reading_unit_id": "unit", "reading_revision": "revision", "language": language,
            "title": "Sail away", "completeness": "documented_excerpt", "lines": items}


class FormReaderTests(unittest.TestCase):
    def test_unmarked_poem_has_native_units_without_invented_geometry(self):
        original = source(["Vaka vanha Väinämöinen", "Laula kultainen käkönen"])
        before = copy.deepcopy(original)
        result = analyze_form(original)
        self.assertEqual(result["sections"], [])
        self.assertIsNone(result["profile"]["total_bars"])
        self.assertTrue(all(v is None for v in result["shape"].values()))
        self.assertEqual(result["rhythm"]["setting"]["coverage"], "not_requested")
        self.assertEqual(result["rhythm"]["prosody"]["lines"][0]["count"], 8)
        self.assertEqual(result["stanzas"]["coverage"], "refused")
        self.assertEqual(result["completeness"], "documented_excerpt")
        self.assertEqual(original, before)
        json.dumps(result, allow_nan=False)

    def test_repeated_source_names_keep_occurrences_and_source_lines(self):
        work = source(["[CHORUS]", "Vaka vanha Väinämöinen", "[VERSE 2]",
                       "Laula kultainen käkönen", "[CHORUS]", "Vaka vanha Väinämöinen"])
        result = analyze_form(work)
        choruses = [s for s in result["sections"] if s["function"] == "chorus"]
        self.assertEqual(len(choruses), 2)
        self.assertNotEqual(choruses[0]["id"], choruses[1]["id"])
        self.assertEqual(choruses[0]["line_ids"], ["l2"])
        ret = result["returns"]["pairs"][0]
        self.assertEqual(ret["first_line_ids"], ["l2"])
        self.assertEqual(ret["return_line_ids"], ["l6"])
        self.assertEqual(ret["comparison"]["kind"], "VERBATIM")
        self.assertEqual(ret["comparison"]["line_distance"], 0)
        self.assertIsNone(ret["comparison"]["rhyme_scheme_preserved"])
        self.assertIsNone(ret["comparison"]["tune_slot_preserved"])
        self.assertTrue(any(r["code"] == "NO_RHYME_KEY" for r in ret["comparison"]["refusals"]))

    def test_printed_chorus_apparatus_uses_existing_edition_receipts(self):
        work = source(["[CHORUS]", "# APPARATUS: Chorus", "[VERSE 38]",
                       "cat", "hat", "[VERSE 39]", "mat"], "eng")
        work["source_path"] = "corpus/song/eng_celtic_robert_burns.txt"
        work["lines"][1]["kind"] = "apparatus"
        before = copy.deepcopy(work)
        result = analyze_form(work)
        chorus, verse = result["sections"]
        self.assertEqual((chorus["function"], chorus["annotation"], chorus["line_ids"]),
                         ("chorus", "Chorus", ["l4", "l5"]))
        self.assertEqual((verse["name"], verse["line_ids"]), ("VERSE 39", ["l7"]))
        receipt = chorus["source_interpretation"]
        self.assertEqual(receipt["method"], "quality.grid._printed_chorus_labels")
        self.assertEqual(receipt["line_ids"], ["l1", "l2", "l3"])
        self.assertEqual(len(receipt["source_ranges"]), 3)
        self.assertEqual(result["stanzas"]["lines"], [
            {"line_id": "l4", "stanza": 1}, {"line_id": "l5", "stanza": 1},
            {"line_id": "l7", "stanza": 2}])
        self.assertEqual(work, before)
        # The upstream interpretation is explicitly limited to this edition.
        work["source_path"] = "corpus/song/eng_other_edition.txt"
        result = analyze_form(work)
        self.assertEqual([s["name"] for s in result["sections"]], ["CHORUS", "VERSE 38", "VERSE 39"])
        self.assertEqual(result["sections"][0]["line_ids"], [])
        self.assertNotIn("source_interpretation", result["sections"][0])

    def test_printed_inline_chorus_label_does_not_replace_normalized_lyric_text(self):
        work = source(["[VERSE 1]", "cat hat", "[VERSE 2]", "mat"], "eng")
        work["source_path"] = "corpus/song/eng_celtic_robert_burns.txt"
        work["lines"][1]["source_text"] = "Chorus.--cat hat"
        before = copy.deepcopy(work)
        result = analyze_form(work)
        chorus = result["sections"][0]
        self.assertEqual((chorus["name"], chorus["function"], chorus["line_ids"]),
                         ("CHORUS", "chorus", ["l2"]))
        self.assertEqual(chorus["source_interpretation"]["printed_mark"], "[VERSE 1]")
        self.assertEqual(chorus["source_interpretation"]["line_ids"], ["l1", "l2"])
        self.assertEqual(result["rhythm"]["prosody"]["lines"][0]["tokens"], ["cat", "hat"])
        self.assertEqual(work, before)

    def test_off_text_variation_preserves_the_underlying_verbatim_quality(self):
        work = source(["[CHORUS]", "Vaka vanha Väinämöinen", "[CHORUS]", "Vaka vanha Väinämöinen"])
        ret = analyze_form(work, {"returns": {"varies_off_text": "melodic line"}})["returns"]["pairs"][0]["comparison"]
        self.assertEqual(ret["kind"], "TEXT_VERBATIM_CHANNEL_UNREAD")
        self.assertIn("VERBATIM", ret["qualities"])
        self.assertTrue(any(r["code"] == "VARIES_OFF_TEXT" for r in ret["refusals"]))

    def test_part_is_a_persistent_voice_and_refuses_guessed_stanza_ground(self):
        work = source(["[PART: singer A]", "[VERSE]", "Vaka vanha Väinämöinen",
                       "[PART: singer B]", "[VERSE 2]", "Laula kultainen käkönen"])
        result = analyze_form(work)
        voices = result["voices"]["source_voices"]
        self.assertEqual([(v["label"], v["line_ids"]) for v in voices], [("singer A", ["l3"]), ("singer B", ["l6"])])
        self.assertIsNone(result["stanzas"]["lines"])
        self.assertIn("PART", result["stanzas"]["refused_marks"])

    def test_call_response_uses_exact_ids_and_cannot_cross_blocks(self):
        work = source(["[VERSE]", "Vaka vanha Väinämöinen", "Laula kultainen käkönen"])
        link = {"call": "l2", "response": "l3", "kind": "call_and_response", "source": "reader interpretation"}
        result = analyze_form(work, {"line_relations": [link]})
        row = result["voices"]["line_relations"]["rows"][0]
        self.assertEqual((row["call_line_id"], row["response_line_id"]), ("l2", "l3"))
        self.assertIn("semantic reply not inferred", result["voices"]["line_relations"]["basis"])
        cross = source(["[VERSE]", "Vaka vanha Väinämöinen", "[CHORUS]", "Laula kultainen käkönen"])
        with self.assertRaises(ValueError):
            analyze_form(cross, {"line_relations": [{**link, "response": "l4"}]})
        self.assertEqual(analyze_form(work, {"line_relations": []})["voices"]["line_relations"]["state"], "empty")
        self.assertEqual(analyze_form(work)["voices"]["line_relations"]["state"], "undeclared")

    def test_native_json_couplets_are_source_ground_without_synthetic_marks(self):
        work = source(["کار", "یار", "دل", "گل"], "fas")
        for i, row in enumerate(work["lines"]):
            row.update(couplet=i // 2 + 1, hemistich=i % 2 + 1)
        result = analyze_form(work)
        self.assertEqual(result["source_marks"], [])
        self.assertEqual([s["native_kind"] for s in result["sections"]], ["couplet", "couplet"])
        self.assertEqual([r["stanza"] for r in result["stanzas"]["lines"]], [0, 0, 1, 1])
        self.assertEqual(result["stanzas"]["source"], "native_couplet")
        self.assertTrue(all(s["function"] is None and s["bars"] is None for s in result["sections"]))

    def test_sanskrit_moras_are_not_relabelled_english_stress(self):
        result = analyze_form(source(["pṛṣṭhe gariṣṭhe"], "san"))
        row = result["rhythm"]["prosody"]["lines"][0]
        self.assertEqual(row["unit"], "mora")
        self.assertEqual(row["count"], 9)
        self.assertIn("guru", row["prominence_rule"])
        self.assertIn("NOT stress", row["prominence_rule"])

    def test_narrative_is_declared_grammar_not_semantic_detection(self):
        work = source(["[VERSE]", "Vaka vanha Väinämöinen", "[CHORUS]", "Laula kultainen käkönen"])
        result = analyze_form(work, {"narrative": {"source": "reader", "atoms": ["ESTABLISH", "ANCHOR"], "junctions": ["AND_THEN"]}})
        self.assertTrue(result["narrative"]["valid"])
        self.assertEqual(result["narrative"]["semantics"], "unsupported")
        bad = analyze_form(work, {"narrative": {"source": "reader", "atoms": ["TURN", "ANCHOR"], "junctions": ["AND_THEN"]}})
        self.assertFalse(bad["narrative"]["valid"])
        self.assertTrue(any("cannot open" in p for p in bad["narrative"]["problems"]))

    def _setting(self, groups=(2, 2, 3), all_lines=True):
        work = source(["[VERSE]", "Vaka vanha Väinämöinen", "Laula kultainen käkönen"])
        sid = "l1:block"
        declarations = {"setting": {"source": "declared score", "sections": [{"id": sid, "bars": 2,
                        "meter": {"beats": 7, "unit": 8, "groups": list(groups)}}],
                        "lines": [{"line_id": "l2", "section_id": sid, "bar": 1, "beat": 1, "duration": 7}]},
                        "subdivision": {"slots_per_pulse": 2, "source": "declared score"}}
        if all_lines:
            declarations["setting"]["lines"].append({"line_id": "l3", "section_id": sid, "bar": 2, "beat": 1, "duration": 7})
        return work, declarations

    def test_group_order_drives_heads_and_exact_fit_not_source_segmentation(self):
        work, declaration = self._setting()
        a = analyze_form(work, declaration)
        other = copy.deepcopy(declaration)
        other["setting"]["sections"][0]["meter"]["groups"] = [3, 2, 2]
        b = analyze_form(work, other)
        self.assertNotEqual(a["rhythm"]["setting"]["lines"][0]["group_heads"], b["rhythm"]["setting"]["lines"][0]["group_heads"])
        self.assertEqual(a["line_ids"], b["line_ids"])
        self.assertEqual(a["rhythm"]["setting"]["lines"][0]["per_pulse"], {"numerator": 8, "denominator": 7})

    def test_absent_grouping_is_a_refusal_not_an_assumed_group(self):
        work, declaration = self._setting(groups=())
        result = analyze_form(work, declaration)
        row = result["rhythm"]["setting"]["lines"][0]
        self.assertTrue(any(r["code"] == "UNDECLARED_GROUPING" for r in row["refusals"]))

    def test_missing_duration_and_wrong_middle_eight_are_rejected(self):
        work, declaration = self._setting()
        del declaration["setting"]["lines"][0]["duration"]
        with self.assertRaises(InvalidDeclaration):
            analyze_form(work, declaration)
        with self.assertRaises(InvalidDeclaration):
            analyze_form(work, {"form": {"sections": [{"id": "bridge", "line_ids": ["l2", "l3"],
                "name": "middle eight", "function": "middle-eight", "bars": 13, "source": "reader"}]}})

    def test_partial_setting_does_not_claim_a_whole_work_shape(self):
        work, declaration = self._setting(all_lines=False)
        result = analyze_form(work, declaration)
        self.assertEqual(result["rhythm"]["setting"]["unplaced_line_ids"], ["l3"])
        self.assertTrue(all(v is None for v in result["shape"].values()))
        self.assertEqual(result["line_count"], 2)

    def test_unavailable_language_features_remain_null(self):
        result = analyze_language(source(["Vaka vanha Väinämöinen"]))
        self.assertTrue(all(v["value"] is None and v["coverage"] == "refused" for v in result["features"].values()))
        self.assertEqual(result["availability"], "unsupported")
        json.dumps(result, allow_nan=False)

    def test_beatgrid_decodes_full_reading_units_exactly_and_preserves_empty(self):
        work = source(["[VERSE]", "Vaka vanha Väinämöinen", "", "Laula kultainen käkönen"])
        declaration = {"source": "printed score", "derived_from": "notation",
                       "meter": {"beats": 7, "unit": 8, "groups": [2, 2, 3]},
                       "positions": [{"line_id": "l4", "unit": 1, "pulse": "1/3"}]}
        grid = decode_beatgrid(work, declaration)
        self.assertEqual(grid.at((1, 0)), Fraction(1, 3))
        self.assertTrue(grid.measured)
        self.assertEqual(decode_beatgrid(work, {**declaration, "positions": []}).positions, {})
        self.assertIsNone(decode_beatgrid(work, None))
        with self.assertRaises(InvalidDeclaration):
            decode_beatgrid(work, {**declaration, "positions": declaration["positions"] * 2})
        with self.assertRaises(InvalidDeclaration):
            decode_beatgrid(work, {**declaration, "positions": [{"line_id": "l1", "unit": 1, "pulse": 0}]})

    def test_complete_and_partial_beatgrids_change_only_the_supported_question(self):
        work, declaration = self._setting()
        declaration["beatgrid"] = {"source": "printed score", "derived_from": "notation",
                                  "meter": {"beats": 7, "unit": 8, "groups": [2, 2, 3]},
                                  "positions": [{"line_id": lid, "unit": u + 1, "pulse": str(Fraction(start * 7) + Fraction(u, 2))}
                                                for start, lid in enumerate(("l2", "l3")) for u in range(8)]}
        full = analyze_form(work, declaration)["rhythm"]["setting"]
        for row in full["lines"]:
            self.assertFalse(any(r["code"] in ("NO_SETTING", "BEATGRID_INCOMPLETE") for r in row["refusals"]))
        declaration["beatgrid"]["positions"] = declaration["beatgrid"]["positions"][:1]
        partial = analyze_form(work, declaration)["rhythm"]["setting"]
        self.assertTrue(all(any(r["code"] == "BEATGRID_INCOMPLETE" for r in row["refusals"]) for row in partial["lines"]))
        declaration["beatgrid"]["positions"] = [{"line_id": "l2", "unit": 9, "pulse": 0}]
        with self.assertRaises(InvalidDeclaration):
            analyze_form(work, declaration)

    def test_complexity_and_tempo_keep_exact_values_and_unknown_rubato(self):
        work, declaration = self._setting()
        declaration["setting"]["sections"][0]["metric_complexity"] = [
            {"kind": "tuplet", "count": 3, "normal": 2, "note_pulses": 1},
            {"kind": "rubato", "span": 7, "anchors": []}]
        declaration["setting"]["tempo"] = {"bpm": 120, "beat_value": "1/4", "source": "printed score"}
        declaration["setting"]["tempo_changes"] = [{"at": "7/8", "bpm": 60, "beat_value": "1/4", "source": "printed score"}]
        setting = analyze_form(work, declaration)["rhythm"]["setting"]
        events = setting["sections"][0]["metric_complexity"]["events"]
        self.assertEqual(events[0]["result"]["note_duration"], {"numerator": 2, "denominator": 3})
        self.assertIsNone(events[1]["result"]["performed_span"])
        self.assertEqual(events[1]["result"]["timing"], "unknown")
        self.assertEqual([r["seconds"] for r in setting["lines"]],
                         [{"numerator": 7, "denominator": 4}, {"numerator": 7, "denominator": 2}])

    def test_contradictory_timing_does_not_erase_the_fit_findings(self):
        work, declaration = self._setting()
        declaration["setting"]["tempo"] = {"bpm": 120, "beat_value": "1/4", "source": "printed score"}
        declaration["setting"]["lines"][1]["duration"] = 14
        row = analyze_form(work, declaration)["rhythm"]["setting"]["lines"][1]
        self.assertFalse(row["satisfiable"])
        self.assertTrue(any(f["code"] == "OVERRUNS_SECTION" for f in row["findings"]))
        self.assertEqual(row["seconds"]["code"], "DECLARED_TIMING_UNREAD")
        self.assertIsNone(row["seconds"]["value"])

    def test_missing_dictionary_is_a_refusal_and_spelling_diversity_still_runs(self):
        from lyric_harness import LexicalAssetUnavailable
        work = source(["Sail away sail away", "Sail away home"], "eng")
        with patch("lyric_harness.Lexicon", side_effect=LexicalAssetUnavailable("dictionary unavailable")), \
                patch("quality.sentencehood.report", return_value={"available": False, "findings": [], "stacked": [], "fraction": 0.0, "why": "tagger unavailable"}):
            result = analyze_language(work)
        self.assertEqual(result["features"]["mattr"]["coverage"], "answered")
        self.assertEqual(result["features"]["mattr"]["value"], 3 / 7)
        self.assertTrue(all(v["value"] is None for k, v in result["features"].items() if k != "mattr"))
        self.assertIsNone(result["sentencehood"]["fraction"])
        self.assertEqual(result["sentencehood"]["coverage"], "refused")
        json.dumps(result, allow_nan=False)

    def test_readability_coordinates_preserve_line_ids_and_parenthetical_text(self):
        from library.form import _report_coordinates
        work = source(["[VERSE]", "The road (voice) rises", "Stay home"], "eng")
        result = _report_coordinates({"records": [{"line": 1, "final_token": "rises"}],
                                      "findings": [{"locations": [2]}], "lines_countable": 0,
                                      "rate_unreadable_final": 0.0}, work["lines"][1:])
        self.assertEqual(result["records"][0]["line_id"], "l2")
        self.assertEqual(result["findings"][0]["line_ids"], ["l3"])
        self.assertEqual(result["records"][0]["source_ranges"][0]["codepoint_range"], work["lines"][1]["source_cp_range"])
        self.assertIsNone(result["rate_unreadable_final"])

    def test_hook_confinement_is_unknown_for_an_undeclared_occurrence(self):
        work = source(["sail away", "[CHORUS]", "sail away", "[CHORUS]", "sail away"])
        hook = analyze_form(work, {"hooks": [{"text": "sail away", "source": "reader"}]})["hooks"]["hooks"][0]
        self.assertTrue(hook["recurs"])
        self.assertTrue(hook["title_in_hook"])
        self.assertEqual(hook["placement_coverage"], "refused")
        self.assertEqual(hook["placement_refusals"][0]["code"], "HOOK_PLACEMENT_PARTLY_UNDECLARED")
        self.assertFalse(any(f["code"] == "HOOK_CONFINED" for f in hook["findings"]))

    def test_reader_declared_voice_keeps_source_voices_separate(self):
        work = source(["[PART: narrator]", "[VERSE]", "Vaka vanha Väinämöinen"])
        result = analyze_form(work, {"form": {"sections": [{"id": "l2:block", "function": "verse",
            "line_ids": ["l3"], "source": "reader", "voice": "answering singer"}]}})
        self.assertEqual(result["voices"]["source_voices"][0]["label"], "narrator")
        self.assertEqual(result["voices"]["declared_voices"][0]["label"], "answering singer")

    def test_return_slots_use_declared_geometry_without_claiming_melody(self):
        work = source(["[CHORUS]", "Vaka vanha Väinämöinen", "[CHORUS]", "Vaka vanha Väinämöinen"])
        declaration = {"setting": {"source": "printed score", "sections": [
            {"id": "l1:block", "bars": 1, "meter": {"beats": 7, "unit": 8, "groups": [2, 2, 3]}},
            {"id": "l3:block", "bars": 1, "meter": {"beats": 7, "unit": 8, "groups": [2, 2, 3]}}],
            "lines": [{"line_id": "l2", "section_id": "l1:block", "bar": 1, "beat": 1, "duration": 7},
                      {"line_id": "l4", "section_id": "l3:block", "bar": 2, "beat": 1, "duration": 7}]}}
        same = analyze_form(work, declaration)["returns"]["pairs"][0]["comparison"]
        self.assertTrue(same["tune_slot_preserved"])
        self.assertIsNone(same["rhyme_scheme_preserved"])
        declaration["setting"]["lines"][1].update(beat=2, duration=6)
        changed = analyze_form(work, declaration)["returns"]["pairs"][0]["comparison"]
        self.assertFalse(changed["tune_slot_preserved"])
        del declaration["setting"]["lines"][1]
        partial = analyze_form(work, declaration)["returns"]["pairs"][0]["comparison"]
        self.assertIsNone(partial["tune_slot_preserved"])

    def test_printed_pointer_resolves_only_to_evidenced_full_source_block(self):
        work = source(["[CHORUS]", "Sail away", "Stay home", "[VERSE]", "Another day",
                       "[CHORUS]", "Sail away, &c."], "eng")
        result = analyze_form(work)["returns"]["pairs"][0]["comparison"]
        self.assertEqual(result["kind"], "VERBATIM")
        self.assertEqual(result["again_effective_line_ids"], ["l2", "l3"])
        self.assertEqual(result["source_stub_resolutions"][0]["printed_line_id"], "l7")
        self.assertEqual(result["source_stub_resolutions"][0]["target_section_id"], "l1:block")
        self.assertIsNone(result["tune_slot_preserved"])
        missing = source(["[CHORUS]", "Sail away, &c.", "[CHORUS]", "Sail away, &c."], "eng")
        unresolved = analyze_form(missing)["returns"]["pairs"][0]["comparison"]
        self.assertEqual(unresolved["kind"], "STUB")
        self.assertIsNone(unresolved["line_distance"])
        self.assertEqual(unresolved["source_stub_resolutions"], [])

    def test_declared_native_profile_is_shared_by_prosody_not_silently_reset(self):
        result = analyze_form(source(["流", "樓"], "ltc"), {"phonology": {
            "standard": "qieyun", "variants": False, "overlap": "settled"}})
        profile = result["rhythm"]["prosody"]["phonology"]
        self.assertEqual(profile["standard"], "qieyun")
        self.assertFalse(profile["variant_map"])
        self.assertEqual(profile["overlap"], "settled")
        english = analyze_form(source(["The road (voice) rises"], "eng"), {"phonology": {"readings": "first"}})
        self.assertEqual(english["rhythm"]["prosody"]["phonology"]["readings"], "first")
        self.assertEqual(english["rhythm"]["prosody"]["lines"][0]["count"], 5)
        with self.assertRaises(InvalidDeclaration):
            analyze_form(source(["Vaka vanha Väinämöinen"]), {"phonology": {"readings": "first"}})

    def test_empty_source_blocks_keep_occurrence_order_and_bad_inputs_are_rejected(self):
        work = source(["[VERSE]", "Vaka vanha Väinämöinen", "[PART: answer]", "[CHORUS]", "Laula kultainen käkönen"])
        result = analyze_form(work)
        self.assertEqual([s["id"] for s in result["sections"]], ["l1:block", "l3:block", "l4:block"])
        self.assertEqual(len(result["returns"]["kinds"]), 16)
        with self.assertRaises(InvalidDeclaration):
            analyze_form(work, [])
        with self.assertRaises(InvalidDeclaration):
            analyze_form(work, {"form": {"sections": {}}})
        with self.assertRaises(InvalidDeclaration):
            analyze_form(work, {"hooks": [{"text": 3, "source": "reader"}]})

    def test_fallback_line_ids_and_unicode_ranges_match_complete_stream_coordinates(self):
        result = analyze_form({"reading_unit_id": "fallback", "language": "fin", "text": "😀 Vaka vanha\r\nLaula kultainen\r\n"})
        self.assertEqual(result["line_ids"], ["line:0", "line:1"])
        first, second = result["rhythm"]["prosody"]["lines"]
        self.assertEqual(first["source_ranges"][0]["codepoint_range"], [0, 12])
        self.assertEqual(first["source_ranges"][0]["utf16_range"], [0, 13])
        self.assertEqual(second["source_ranges"][0]["codepoint_range"], [14, 29])
        self.assertEqual(second["source_ranges"][0]["utf16_range"], [15, 30])

    def test_form_uses_authoritative_normalized_slice_with_coarse_source_projection(self):
        work = {"reading_unit_id": "normalization", "language": "fin", "normalized_text": "Vaka vanha",
                "lines": [{"id": "source-row", "kind": "lyric", "text": "raw source typography",
                           "source_text": "raw source typography", "normalized_cp_range": [0, 10],
                           "source_ranges": [{"codepoint_range": [50, 71], "utf16_range": [50, 71], "precision": "row"}]}]}
        result = analyze_form(work)
        read = result["rhythm"]["prosody"]["lines"][0]
        self.assertEqual(read["text"], "Vaka vanha")
        self.assertEqual(read["count"], 4)
        self.assertEqual(read["source_ranges"][0]["precision"], "row")

    def test_missing_native_resource_does_not_claim_the_language_engine_is_missing(self):
        work = source(["流", "樓"], "ltc")
        with patch("quality.fit.read_line", side_effect=FileNotFoundError("native table is not staged")):
            result = analyze_form(work)
        prosody = result["rhythm"]["prosody"]
        self.assertEqual(prosody["availability"], "available")
        self.assertEqual(prosody["coverage"], "refused")
        self.assertEqual(prosody["code"], "LEXICAL_ASSET_MISSING")
        self.assertEqual([r["count"] for r in prosody["lines"]], [None, None])

    def test_capacity_growth_pauses_whole_prosody_without_a_partial_answer(self):
        from quality import fit as F
        work = source(["Vaka vanha Väinämöinen"] * 600)
        original = copy.deepcopy(work)
        native_read = F.read_line
        reads = []

        def tracked_read(*args, **kwargs):
            reads.append(1)
            return native_read(*args, **kwargs)

        with patch.dict(os.environ, {"LIBRARY_READER_MAX_RSS_MIB": "1"}):
            with patch("library.analysis._reader_rss_bytes", side_effect=lambda: len(reads) * 8192):
                with patch("quality.fit.read_line", side_effect=tracked_read):
                    with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT: native prosody preparation"):
                        analyze_form(work)
        self.assertGreater(len(reads), 0)
        self.assertLess(len(reads), len(work["lines"]))
        self.assertEqual(work, original)


class RepeatedGeometryRegression(unittest.TestCase):
    def test_uncovered_bars_is_keyed_by_occurrence_not_repeated_name(self):
        cycle = Cycle(4, 4, (2, 2))
        a = Placement(cycle, bar=1, beat=1, duration=4, section="chorus", section_start_bar=1, section_bars=2)
        b = Placement(cycle, bar=3, beat=1, duration=8, section="chorus", section_start_bar=3, section_bars=3)
        fits = [LineFit(LineUnits("first"), a), LineFit(LineUnits("return"), b)]
        sections = [{"name": "chorus", "cycle": cycle, "bars": 2, "start_bar": 1},
                    {"name": "chorus", "cycle": cycle, "bars": 3, "start_bar": 3}]
        findings = uncovered_bar_findings(fits, sections)
        self.assertEqual(len(findings), 2)
        self.assertIn("1 of 2", findings[0].message)
        self.assertTrue(findings[0].message.endswith(": 2"))
        self.assertIn("1 of 3", findings[1].message)
        self.assertTrue(findings[1].message.endswith(": 5"))
        self.assertTrue(all("1 line(s)" in f.evidence and f.satisfiable for f in findings))

    def test_empty_first_occurrence_is_not_filled_by_later_same_name(self):
        cycle = Cycle(4, 4, (2, 2))
        placement = Placement(cycle, bar=3, beat=1, duration=8, section="chorus", section_start_bar=3, section_bars=2)
        sections = [{"name": "chorus", "cycle": cycle, "bars": 2, "start_bar": 1},
                    {"name": "chorus", "cycle": cycle, "bars": 2, "start_bar": 3}]
        findings = uncovered_bar_findings([LineFit(LineUnits("return"), placement)], sections)
        self.assertEqual(len(findings), 1)
        self.assertIn("0 line(s)", findings[0].evidence)
        self.assertTrue(findings[0].message.endswith(": 1, 2"))


if __name__ == "__main__":
    unittest.main()
