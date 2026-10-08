"""Reader adapter parity, source mapping and restart acceptance tests."""
import copy
import json
import unittest
from unittest.mock import patch

from library.analysis import AnalysisSession, runtime_identity, resolve_detail_records
from library.contracts import canonical_json, json_safe, method_id
from library.registry import build_registry
from quality import relations as RL
from quality.phonology import get

_FIXTURE_RUNTIME = runtime_identity()


def source(text, language="eng"):
    return {"reading_unit_id": "caller-owned-fixture:" + language,
            "reading_revision": "fixture-v1", "language": language, "text": text}


def complete(reading, declarations=None, schemas=None, batch=256, restart=False, layers=None):
    committed, checkpoint, last = [], None, None
    requested = {"layers": layers or ["sound"], "schemas": schemas}
    session = None
    for _ in range(20000):
        if session is None or restart:
            # Deployed jobs execute an immutable release. Concurrent edits in
            # this working tree are not a simulated change to that release.
            with patch("library.analysis.runtime_identity", return_value=_FIXTURE_RUNTIME):
                session = AnalysisSession(reading, declarations, requested, checkpoint,
                    load_records=lambda mid: (r for r in committed if r.get("method_id") == mid))
        last = session.step(batch)
        committed.extend(last["records"])
        checkpoint = last["checkpoint"]
        if last["done"]:
            return session, committed, last
    raise AssertionError("reader traversal did not exhaust")


class ReaderAcceptance(unittest.TestCase):
    def test_engine_registry_not_a_second_taxonomy(self):
        registry = build_registry()
        self.assertEqual(registry["counts"], {"schemas": 78, "types": 76, "type_cells": 49,
            "classes": 5, "functions": 22, "pair_local": 65, "whole_figures": 13})
        schemas = [m for m in registry["methods"] if m["namespace"] == "schema"]
        self.assertEqual({m["name"] for m in schemas}, set(RL.REGISTRY))
        for row in schemas:
            self.assertEqual(row["required_capabilities"], list(RL.REGISTRY[row["name"]].capabilities()))
        self.assertEqual(len(registry["capabilities"]), 22)
        self.assertEqual(len({m["id"] for m in registry["methods"]}), len(registry["methods"]))

    def test_nine_profiles_exhaust_all_78_questions(self):
        fixtures = {"eng": "cat\nhat", "fas": "کار\nیار", "fin": "vaka vanha\nkala kaunis",
                    "cym": "A llyma fyd | llwm i fardd\nBore hir", "non": "jǫrð\nfyrðum",
                    "ltc": "流\n樓", "msa": "kata\nmata\npata\nrata",
                    "san": "pṛṣṭhe\ngariṣṭhe", "som": "beer biyo\naan eed"}
        for language, text in fixtures.items():
            with self.subTest(language=language):
                _, records, result = complete(source(text, language))
                census = result["summary"]["coverage"]
                self.assertTrue(result["checkpoint"]["done"])
                self.assertFalse(census["partial"])
                self.assertEqual(census["pending_methods"], 0)
                self.assertEqual(census["requested_methods"], census["answered_methods"] + census["refused_methods"])
                rows = [r for r in records if r["kind"] == "method_result" and r["namespace"] == "schema"]
                self.assertEqual({r["schema_name"] for r in rows}, set(RL.REGISTRY))
                self.assertEqual(result["provider_calls"], 0)

    def test_pair_judges_and_full_figures_match_installed_engine(self):
        reading = source("cat bat hat mat\ncat rat hat mat\n\ncat\nhat\nbat")
        session, records, _ = complete(reading)
        for name, schema in RL.REGISTRY.items():
            with self.subTest(schema=name):
                expected = RL.realise(schema, session.stream, keep="all")
                results = [r for r in records if r.get("schema_name") == name and r["kind"] == "method_result"]
                self.assertEqual(len(results), 1)
                if isinstance(expected, RL.Refusal):
                    self.assertEqual(results[0]["coverage"], "refused")
                    self.assertEqual(results[0]["refusal"]["missing"], list(expected.missing))
                elif RL.pair_scope_representable(schema):
                    self.assertEqual({k: results[0]["counts"][k] for k in ("true", "false", "undecided")},
                        {"true": sum(e.verdict is True for e in expected),
                         "false": sum(e.verdict is False for e in expected),
                         "undecided": sum(e.verdict is None for e in expected)})
                else:
                    figures = RL.assemble(schema, expected, session.stream)
                    actual = [r for r in records if r.get("schema_name") == name and r["kind"] == "relation_figure"]
                    if isinstance(figures, RL.Refusal):
                        self.assertEqual(results[0]["coverage"], "refused")
                    else:
                        self.assertEqual([r["verdict"] for r in actual],
                                         ["true" if v is True else "false" if v is False else "undecided" for _, _, v in figures])

    def test_restart_is_identical_to_uninterrupted_whole_work(self):
        reading = source("cat bat hat mat\ncat rat hat mat\n\ncat\nhat\nbat\nmat")
        _, all_rows, full = complete(reading, schemas=["perfect rhyme", "paroemion", "monorhyme / leash", "symploce"], batch=256)
        _, resumed, restarted = complete(reading, schemas=["perfect rhyme", "paroemion", "monorhyme / leash", "symploce"], batch=1, restart=True)
        self.assertEqual(canonical_json(resumed), canonical_json(all_rows))
        self.assertEqual(restarted["summary"]["counters"], full["summary"]["counters"])
        self.assertEqual(restarted["summary"]["coverage"], full["summary"]["coverage"])
        self.assertEqual(len({r["id"] for r in resumed}), len(resumed))

    def test_whole_dictionary_witness_and_occurrence_override(self):
        reading = source("wind\nfind")
        _, rows, _ = complete(reading, schemas=["perfect rhyme"])
        pair = next(r for r in rows if r["kind"] == "native_pair")
        self.assertEqual(pair["whole_reading"]["verdict"], "true")
        self.assertIn("wind = W AY1 N D", pair["whole_reading"]["witness"])
        declaration = {"pronunciations": [{"line": "wind", "token": 1, "word": "wind",
            "phones": ["W", "IH1", "N", "D"], "basis": "dictionary", "source": "caller-owned noun reading"}]}
        _, changed, _ = complete(reading, declaration, ["perfect rhyme"])
        self.assertEqual(next(r for r in changed if r["kind"] == "native_pair")["class_verdicts"]["RHYME"], "false")
        declaration["pronunciations"][0]["line"] = "wind changed"
        with self.assertRaisesRegex(ValueError, "STALE_READING"):
            AnalysisSession(reading, declaration)
        declaration["pronunciations"][0]["line"] = "wind"
        declaration["pronunciations"][0]["source"] = " "
        with self.assertRaisesRegex(ValueError, "pronunciation source"):
            AnalysisSession(reading, declaration)

    def test_unknown_endpoint_is_not_previous_readable_word(self):
        _, rows, result = complete(source("cat qzxqzx\nhat qzxqzx"), schemas=["perfect rhyme"])
        pair = next(r for r in rows if r["kind"] == "native_pair")
        self.assertEqual(pair["whole_reading"]["verdict"], "undecided")
        self.assertEqual(result["summary"]["denominators"]["unread_tokens"], 2)
        row = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual(row["coverage"], "refused")
        self.assertEqual(row["refusal"]["kind"], "unknown_members")

    def test_native_structured_unknowns_are_refused_in_census(self):
        mid = method_id("native", "fas.relations")
        session = AnalysisSession(source("دل\nگل", "fas"), requested=["sound"], requested_methods=[mid])
        records=[]
        while True:
            result=session.step()
            records.extend(result["records"])
            if result["done"]: break
        pair = next(r for r in records if r["kind"] == "native_pair")
        self.assertEqual(pair["predicates"], {"rhymes": "undecided", "alliterates": "false"})
        self.assertEqual(pair["coverage"], "refused")
        self.assertFalse(result["summary"]["coverage"]["certified"])
        self.assertEqual(result["summary"]["coverage"]["refused_obligations"], [mid])
        session, records, result = complete(source("Bore hir", "cym"), schemas=[])
        row = next(r for r in records if r["kind"] == "native_measure")
        self.assertEqual(row["result"][0]["positions_tried"], 0)
        self.assertEqual(row["coverage"], "refused")
        self.assertFalse(result["summary"]["coverage"]["certified"])

    def test_radif_absence_and_insufficient_population_are_distinct(self):
        _, rows, _ = complete(source("کار من\nیار تو\nبار او\nزار ما", "fas"), schemas=[])
        radif = next(r for r in rows if r["kind"] == "native_measure" and r["method_id"] == method_id("native", "fas.radif"))
        self.assertIsNone(radif["result"]["radif"])
        self.assertEqual(radif["coverage"], "answered")
        _, rows, _ = complete(source("کار من\nیار تو", "fas"), schemas=[])
        radif = next(r for r in rows if r["kind"] == "native_measure" and r["method_id"] == method_id("native", "fas.radif"))
        self.assertEqual(radif["coverage"], "refused")

    def test_absent_and_explicitly_empty_caesura_are_distinct(self):
        reading = source("cat bat\nhat mat")
        default, _, _ = complete(reading, schemas=["cynghanedd groes"])
        declared, rows, _ = complete(reading, {"sound": {"caesura": {"source": "caller-owned empty map", "positions": {}}}}, ["cynghanedd groes"])
        self.assertEqual(default.stream.supply("caesura").state, "absent")
        self.assertEqual(declared.stream.supply("caesura").state, "empty")
        self.assertEqual(next(r for r in rows if r["kind"] == "method_result")["refusal"]["kind"], "vacuous_frame")

    def test_source_ranges_include_utf16_and_preserve_coarse_mapping(self):
        text = "😀 کار\nیار"
        reading = source(text, "fas")
        _, rows, _ = complete(reading, schemas=[])
        token = next(r for r in rows if r["kind"] == "token" and r["text"] == "کار")
        self.assertEqual(token["source_ranges"][0]["codepoint_range"], [2, 5])
        self.assertEqual(token["source_ranges"][0]["utf16_range"], [3, 6])
        reading["normalized_text"] = "کار"
        reading["lines"] = [{"id": "source-row", "text": "كـار", "kind": "lyric", "normalized_cp_range": [0, 3],
                             "source_ranges": [{"codepoint_range": [50, 54], "utf16_range": [50, 54], "precision": "row"}]}]
        _, rows, _ = complete(reading, schemas=[])
        self.assertEqual(next(r for r in rows if r["kind"] == "token")["source_ranges"][0]["precision"], "row")

    def test_english_coordinates_follow_joined_enclitics_and_repeated_hyphens(self):
        session, records, _ = complete(source("😀 There ’s high\nwell--known cat"), schemas=[])
        tokens = [r for r in records if r["kind"] == "token"]
        self.assertEqual([r["text"] for r in tokens], ["There's", "high", "well--known", "cat"])
        joined, high, hyphenated, cat = tokens
        self.assertEqual(joined["normalized_range"]["codepoint_range"], [2, 10])
        self.assertEqual(joined["normalized_range"]["precision"], "span")
        self.assertEqual([r["codepoint_range"] for r in joined["normalized_range"]["parts"]], [[2, 7], [8, 10]])
        self.assertEqual([r["codepoint_range"] for r in joined["source_ranges"]], [[2, 7], [8, 10]])
        self.assertEqual([r["utf16_range"] for r in joined["source_ranges"]], [[3, 8], [9, 11]])
        self.assertEqual(high["normalized_range"]["codepoint_range"], [11, 15])
        self.assertEqual(hyphenated["normalized_range"]["codepoint_range"], [16, 27])
        self.assertEqual(cat["normalized_range"]["codepoint_range"], [28, 31])
        self.assertEqual(session.stream.lexical_tokens, (("There's", "high"), ("well--known", "cat")))

    def test_native_refused_punctuation_token_keeps_its_complete_range(self):
        _, records, _ = complete(source("rāmaḥ, devaḥ", "san"), schemas=[])
        tokens = [r for r in records if r["kind"] == "token"]
        self.assertEqual([r["text"] for r in tokens], ["rāmaḥ,", "devaḥ"])
        self.assertEqual(tokens[0]["normalized_range"]["codepoint_range"], [0, 6])
        self.assertEqual(tokens[1]["normalized_range"]["codepoint_range"], [7, 12])

    def test_native_definitions_and_knowledge_sets_survive_json(self):
        fas = get("fas")
        self.assertIs(fas.rhymes("کار", "یار"), True)
        self.assertIs(fas.rhymes("کار", "در"), False)
        self.assertIsNone(fas.rhymes("دل", "گل"))
        san = get("san")
        self.assertTrue(san.rhymes("pṛṣṭhe", "gariṣṭhe", depth=1))
        self.assertFalse(san.rhymes("pṛṣṭhe", "gariṣṭhe", depth=2))
        self.assertEqual(json_safe(("N", "D")), ["N", "D"])
        self.assertEqual(json_safe(frozenset(("IH", "AY"))), {"kind": "readings", "values": ["AY", "IH"]})

    def test_stale_resume_and_unknown_method_fail_explicitly(self):
        reading = source("cat\nhat")
        session = AnalysisSession(reading, requested={"layers": ["sound"], "schemas": []})
        checkpoint = session.step(1)["checkpoint"]
        with self.assertRaisesRegex(ValueError, "STALE_READING"):
            AnalysisSession(source("cat\nbat"), requested={"layers": ["sound"], "schemas": []}, checkpoint=checkpoint)
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_METHOD"):
            AnalysisSession(reading, requested_methods=["schema:not-real"])
        with self.assertRaisesRegex(ValueError, "INVALID_DECLARATION"):
            AnalysisSession(reading, {"narrativ": {"source": "typo"}})
        with self.assertRaisesRegex(ValueError, "INVALID_DECLARATION"):
            AnalysisSession(reading, {"hooks": [{"text": "cat", "source": 23}]})
        with self.assertRaisesRegex(ValueError, "INVALID_DECLARATION"):
            AnalysisSession(reading, [])
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_METHOD"):
            AnalysisSession(source("کار", "fas"), {"pronunciations": [{"word": "کار"}]})
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_METHOD"):
            AnalysisSession(reading, requested_methods=[method_id("native", "fas.qafiya")])

    def test_crlf_ranges_and_private_declaration_prose(self):
        _, rows, _ = complete(source("😀 cat\r\nhat"), schemas=[])
        hat = next(r for r in rows if r["kind"] == "token" and r["text"] == "hat")
        self.assertEqual(hat["source_ranges"][0]["codepoint_range"], [7, 10])
        self.assertEqual(hat["source_ranges"][0]["utf16_range"], [8, 11])
        one = {"sound": {"caesura": {"positions": {}, "source": "private user A prose"}}}
        two = {"sound": {"caesura": {"positions": {}, "source": "private user B prose"}}}
        a, rows, _ = complete(source("cat\nhat"), one, ["cynghanedd groes"])
        b, _, _ = complete(source("cat\nhat"), two, ["cynghanedd groes"])
        self.assertEqual(a.identity["hash"], b.identity["hash"])
        self.assertNotIn("private user", canonical_json(rows))

    def test_private_redaction_does_not_validate_whitespace_only_sources(self):
        reading = source("cat\nhat")
        invalid = [
            {"sound": {"caesura": {"positions": {}, "source": " \t\n"}}},
            {"hooks": [{"text": "cat", "source": " \t\n"}]},
        ]
        for declaration in invalid:
            with self.subTest(declaration=declaration):
                with self.assertRaisesRegex(ValueError, "INVALID_DECLARATION|nonempty source"):
                    complete(reading, declaration, schemas=[], layers=["sound", "form"])

    def test_resource_envelope_is_an_explicit_pause_not_a_population_cutoff(self):
        with patch.dict("os.environ", {"LIBRARY_READER_MAX_RSS_MIB": "1"}):
            with patch("library.analysis._reader_rss_bytes", return_value=2 * 1024 * 1024):
                with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT.*No source or comparison was dropped"):
                    AnalysisSession(source("cat\nhat"))

    def test_partial_beatgrid_does_not_make_unplaced_units_off_beat(self):
        reading = source("cat bat\nhat mat")
        reading["lines"] = [{"id": "a", "kind": "lyric", "text": "cat bat", "normalized_cp_range": [0, 7], "analysis_line": 1},
                            {"id": "b", "kind": "lyric", "text": "hat mat", "normalized_cp_range": [8, 15], "analysis_line": 2}]
        declaration = {"beatgrid": {"meter": {"beats": 4, "unit": 4, "groups": [2, 2]},
            "positions": [{"line_id": "a", "unit": 1, "pulse": 0}], "derived_from": "asserted", "source": "caller-owned test"}}
        session, rows, _ = complete(reading, declaration, ["offbeat internal rhyme"])
        row = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual(row["coverage"], "refused")
        self.assertIn("beatgrid_complete", row["refusal"]["missing"])
        declaration["beatgrid"]["positions"] = [{"line_id": lid, "unit": unit, "pulse": unit - 1}
            for lid in ("a", "b") for unit in (1, 2)]
        session, _, _ = complete(reading, declaration, ["offbeat internal rhyme"])
        self.assertEqual(session.stream.frames.beat, {0: (0,), 1: (2,)})

    def test_oversized_form_and_figure_details_roundtrip_across_restart(self):
        reading = source("cat\nhat")
        committed, checkpoint = [], None
        huge = {"text": "😀کار" * 100000, "members": [list(range(40))] * 12000}
        self.assertGreater(len(canonical_json(huge).encode("utf-8")), 2 * 1024 * 1024)
        session, raw = None, None
        for step in range(1000):
            if session is None or step % 14 == 0:
                with patch("library.analysis.runtime_identity", return_value=_FIXTURE_RUNTIME):
                    session = AnalysisSession(reading, requested={"layers": ["form"]}, checkpoint=checkpoint)
                session.tasks = [("form", "form")]
                if raw is None:
                    raw = [session._record("form_result", "form", "large-form", path=[], result=huge, coverage="answered"),
                           session._record("relation_figure", "form", "large-figure", edges=huge, verdict="true")]
                session._task_generator = lambda phase, name: iter(raw)
            result = session.step(1, max_bytes=65536)
            self.assertLess(len(canonical_json(result).encode("utf-8")), 2 * 1024 * 1024)
            self.assertTrue(all(len(canonical_json(r).encode("utf-8")) < 32768 for r in result["records"]))
            committed.extend(result["records"])
            checkpoint = result["checkpoint"]
            if result["done"]:
                break
        else:
            self.fail("detail emission did not exhaust")
        restored = list(resolve_detail_records(committed))
        self.assertEqual(restored, raw)
        self.assertEqual(len({r["id"] for r in committed}), len(committed))
        damaged = copy.deepcopy(committed)
        next(r for r in damaged if r["kind"] == "detail_part")["json_fragment"] += "x"
        with self.assertRaisesRegex(ValueError, "RESULT_EXPIRED"):
            list(resolve_detail_records(damaged))


if __name__ == "__main__":
    unittest.main()
