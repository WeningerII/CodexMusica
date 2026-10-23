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

    def test_syllable_disputed_words_hold_under_any_reading(self):
        # Owner ruling 2026-10-23: `us` (AH1 S | Y UW2 EH1 S) and `fine`
        # (F AY1 N | F IH1 N AH0) differ in syllable count. The Library reads
        # them, and a check holds when ANY reading holds it -- `us`/`yes`
        # rhymes only as the letters U.S., and says so.
        reading = source("Between the two of us\nI only answered yes\n"
                         "The evening sun was fine\nThe wine was red as dine")
        session, rows, last = complete(reading, schemas=["perfect rhyme"])
        self.assertEqual(sorted(session._disputed), [(0, 4), (2, 4)])
        tokens = {r["text"]: r for r in rows if r["kind"] == "token"}
        for word in ("us", "fine"):
            self.assertTrue(tokens[word]["readable"])
            self.assertEqual(tokens[word]["reading_status"], "disputed")
        edges = {(r["a"]["origin"], r["b"]["origin"]): r for r in rows if r["kind"] == "relation_instance"}
        self.assertEqual(edges[("L2.final", "L3.final")]["verdict"], "true")
        self.assertNotIn("reading", edges[("L2.final", "L3.final")])
        us = edges[("L0.final", "L1.final")]
        self.assertEqual(us["verdict"], "true")
        self.assertEqual(us["reading"], {"rule": "any_reading", "witness": ["us = Y UW2 EH1 S"]})
        # Judged under another reading, the record still names the work's
        # own syllables of the word, never the pinned stream's numbering.
        self.assertEqual(us["a"]["unit_ids"], [f"syllable:{i}" for i in session.stream.tokens[(0, 4)]])
        result = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual(result["coverage"], "answered")
        self.assertNotIn("unreadable_tokens", result["counts"])
        _, resumed, _ = complete(reading, schemas=["perfect rhyme"], batch=1, restart=True)
        self.assertEqual(canonical_json(resumed), canonical_json(rows))

    def test_joint_alternate_readings_are_discovered_or_refused(self):
        # 3PO's case on #590: each word's first reading, and either single
        # switch, leave the end words in different rhyme buckets; only BOTH
        # alternates rhyme (IY1 T). Discovery must reach that pair through
        # the public path, and a bounded search must say it is incomplete.
        import lyric_harness as LH
        original = LH.Lexicon.__init__

        def with_fixture_words(self, *args, **kwargs):
            original(self, *args, **kwargs)
            self.entries["zibbet"] = [["B", "AH1", "T"], ["AH0", "B", "IY1", "T"]]
            self.entries["zoddet"] = [["D", "EH1", "T"], ["AH0", "D", "IY1", "T"]]

        reading = source("I saw the zibbet\nAnd then the zoddet")
        with patch.object(LH.Lexicon, "__init__", with_fixture_words):
            session, rows, _ = complete(reading, schemas=["perfect rhyme"])
            self.assertEqual(sorted(session._disputed), [(0, 3), (1, 3)])
            edge = next(r for r in rows if r["kind"] == "relation_instance")
            self.assertEqual(edge["verdict"], "true")
            self.assertEqual(edge["reading"]["witness"], ["zibbet = AH0 B IY1 T", "zoddet = AH0 D IY1 T"])
            result = next(r for r in rows if r["kind"] == "method_result")
            self.assertEqual(result["coverage"], "answered")
            with patch.object(AnalysisSession, "MINI_CAP", 0):
                _, capped, _ = complete(reading, schemas=["perfect rhyme"])
            result = next(r for r in capped if r["kind"] == "method_result")
            self.assertEqual(result["coverage"], "refused")
            self.assertEqual(result["refusal"]["kind"], "reading_combinations")

    def test_alternate_reading_records_keep_the_partner_word_exact(self):
        # Jony's probe on #590: under `us = Y UW2 EH1 S`, `confess` rhymes
        # on its second syllable only, and the record must say so -- not
        # widen the undisputed partner to the whole word.
        session, rows, _ = complete(source("Between the two of us\nI have one thing to confess"),
                                    schemas=["perfect rhyme"])
        edge = next(r for r in rows if r["kind"] == "relation_instance")
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["b"]["unit_ids"], [f"syllable:{session.stream.tokens[(1, 5)][-1]}"])

    def test_first_reading_only_verdicts_are_counted(self):
        # A searched rule enumerates sub-spans inside a word, which another
        # syllable count leaves without counterparts: such a schema keeps the
        # first-listed reading, and says how many verdicts rest on it alone.
        session, rows, _ = complete(source("every day\nheavy clay"), schemas=["multisyllabic rhyme"])
        self.assertEqual(sorted(session._disputed), [(0, 0)])
        result = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual(result["coverage"], "answered")
        self.assertGreater(result["counts"]["first_reading_only"], 0)
        self.assertTrue(all("reading" not in r for r in rows if r["kind"] == "relation_instance"))

    def test_rebuilt_lines_judge_every_pair_as_the_whole_work_does(self):
        # The any-reading search judges a pair on its own one or two lines,
        # rebuilt. That is only sound if, under the work's own readings, the
        # rebuilt lines give every pair exactly the verdict the whole work
        # gives -- for every schema the search covers, on every candidate.
        reading = source("Every hour of our family fire\nDifferent nights and every lonely desire\n"
                         "We sat by the fire with our camera and wine\nEvery interest naturally fine\n"
                         "Our hour is over and the fire is low\nEvery family knows what different people know")
        session = AnalysisSession(reading, None, {"layers": ["sound"]}, None, load_records=lambda mid: iter(()))
        checked = 0
        for name in session.schema_names:
            schema = RL.REGISTRY[name]
            if not session._varies(schema):
                continue
            try:
                candidates = list(session._candidates(name))
            except Exception:
                continue
            for kind, value in candidates:
                if kind != "edge":
                    continue
                a, b = value
                whole = RL.evaluate(schema, a, b, session.stream)
                lines = sorted({session.stream.units[i].line for span in (a, b) for i in span.idx})
                mini = session._line_stream(lines, {})
                xs = session._spans_by_key(mini, schema.spans[0]).get(session._span_key(a, session.stream), ())
                ys = session._spans_by_key(mini, schema.spans[1]).get(session._span_key(b, session.stream), ())
                got = [RL.evaluate(schema, x, y, mini) for x in xs for y in ys]
                self.assertEqual(len(got), 1, (name, a.origin, b.origin))
                self.assertEqual(None if whole is None else whole.verdict,
                                 None if got[0] is None else got[0].verdict, (name, a.origin, b.origin))
                checked += 1
        self.assertGreater(checked, 2000)

    def test_relation_instance_ids_are_unique_under_any_reading(self):
        _, rows, _ = complete(source("Every hour of our family fire\nDifferent nights and every lonely desire\n"
                                     "The camera sees us every time we fly\nOur desire was natural and so was our goodbye"),
                              layers=["sound"])
        ids = [r["id"] for r in rows if r["kind"] == "relation_instance"]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_syllable_disputed_word_is_read_by_the_library_only(self):
        # The whole dictionary, not a chosen word: every CMUdict entry whose
        # readings differ in syllable count (1,698 at the pinned cmudict) is
        # read by the Library under exactly its first-listed reading, and
        # refused by the graders exactly as before.
        import lyric_harness as LH
        from quality.phonology import UNALIGNABLE, merge_readings
        from quality.phonology.eng import English
        grader, library = English(), English(syllable_disputes="first")
        lex = grader._lexicon()
        disputed = [w for w, prons in lex.entries.items()
                    if len(prons) > 1 and merge_readings(grader.parses(w))[1] == UNALIGNABLE]
        self.assertGreater(len(disputed), 1000)
        for word in disputed:
            first = next(p for p in lex.pronunciation_variants(word) if p)
            self.assertEqual(grader.syllabify(word), [], word)
            self.assertEqual(grader.reading_status(word)[0], "unalignable", word)
            self.assertEqual([(s.onset, s.nucleus, s.coda) for s in library.syllabify(word)],
                             [(tuple(s["onset"]), s["nucleus"], tuple(s["coda"])) for s in LH.syllabify(first)], word)
            self.assertEqual(library.reading_status(word)[0], "disputed", word)
        self.assertNotIn("syllable_disputes", grader.declaration())
        self.assertEqual(library.declaration()["syllable_disputes"], "first")
        with self.assertRaises(ValueError):
            English(syllable_disputes="any")

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

    def test_reading_choices_name_their_numbering(self):
        # Evidence says which cut and voices setting counted `token`: the
        # Library reads every line with its asides sung, under v2.
        _, rows, _ = complete(source("wind\nfind"), schemas=[])
        choices = [r["reading_choices"] for r in rows
                   if r["kind"] == "token" and "reading_choices" in r]
        self.assertTrue(choices)
        self.assertEqual({c["numbering"] for c in choices}, {"v2+voices"})

    def test_library_pronunciations_follow_the_numbering_rule(self):
        # B1: the session's lexicon is guarded. An unmarked row that names
        # its word on different characters under the two cuts is refused
        # naming both; a marked row binds the identical raw occurrence; an
        # unmarked row that matches only under the earlier cut is rebound.
        oh, lawdy = "Oh--oh, oh my love", "U--h, Lawdy"
        reading = source(oh + "\n" + lawdy)
        requested = {"layers": ["sound"], "schemas": []}

        def row(line, token, word, **extra):
            return {"line": line, "token": token, "word": word, "phones": ["OW1"],
                    "basis": "declared", "source": "the singer", **extra}

        with self.assertRaisesRegex(ValueError, r"^INVALID_DECLARATION: ambiguous token 2 "
                                    r".*v1\+voices binds \('oh', \(\(8, 10\),\)\); "
                                    r"v2\+voices binds \('oh', \(\(4, 6\),\)\)"):
            AnalysisSession(reading, {"pronunciations": [row(oh, 2, "oh")]}, requested)
        for numbering, token in (("v1+voices", 2), ("v2+voices", 3), ("v1", 2), ("v2", 3)):
            with self.subTest(numbering=numbering):
                session = AnalysisSession(
                    reading, {"pronunciations": [row(oh, token, "oh", numbering=numbering)]},
                    requested)
                bound = session.phon.lexicon.pronunciations
                self.assertEqual([(b["token"], b["numbering"]) for b in bound], [(3, "v2+voices")])
        session = AnalysisSession(reading, {"pronunciations": [row(lawdy, 2, "Lawdy")]}, requested)
        self.assertEqual([b["token"] for b in session.phon.lexicon.pronunciations], [3])
        self.assertEqual(session.declarations["pronunciations"][0]["token"], 3)
        with self.assertRaisesRegex(ValueError, "^INVALID_DECLARATION: numbering must be"):
            AnalysisSession(reading, {"pronunciations": [row(lawdy, 3, "Lawdy", numbering="v3")]},
                            requested)
        # An unmarked row whose number names the same characters under both
        # cuts keeps the six fields it was sent with.
        plain = AnalysisSession(source("wind\nfind"), {"pronunciations": [
            row("wind", 1, "wind")]}, requested)
        self.assertNotIn("numbering", plain.phon.lexicon.pronunciations[0])

    def test_pinned_gutenberg_set_is_migrated_once(self):
        # The scheduler injects a pinned v1-bound set; it is rebound by raw
        # span once and then binds exactly there under the guard.
        import json
        from pathlib import Path
        import lyric_harness as LH
        from quality.pronunciation import rebind_occurrences
        asset = Path(LH.__file__).resolve().parent / "imports/gutenberg-next-ten/pronunciations/69378.json"
        payloads = json.loads(asset.read_text(encoding="utf-8"))
        rows = next(p["pronunciations"] for p in payloads.values()
                    if any(r["line"].startswith("U--h") for r in p["pronunciations"]))
        lines = list(dict.fromkeys(r["line"] for r in rows))
        once = rebind_occurrences(rows, "v1", "v2", strip_parens=False)
        self.assertTrue(any(a["token"] != b["token"] for a, b in zip(rows, once)))
        session = AnalysisSession(source("\n".join(lines)), {"pronunciations": rows},
                                  {"layers": ["sound"], "schemas": []})
        bound = session.phon.lexicon.pronunciations
        self.assertEqual([(b["line"], b["token"], b["word"]) for b in bound],
                         [(b["line"], b["token"], b["word"]) for b in once])
        self.assertEqual({b["numbering"] for b in bound}, {"v2+voices"})
        self.assertEqual(session.phon.lexicon._numbering_notices, [])

    def test_bound_pronunciations_reach_form_and_language(self):
        # The form and language layers re-read the public declaration rows
        # with their own lexicons: a marked, a rebound and a pinned row reach
        # them in six fields, bound where the sound layer bound them.
        import json
        from pathlib import Path
        import lyric_harness as LH
        oh, lawdy = "Oh--oh, oh my love", "U--h, Lawdy"

        def row(line, token, word, **extra):
            return {"line": line, "token": token, "word": word, "phones": ["OW1"],
                    "basis": "declared", "source": "the singer", **extra}

        asset = Path(LH.__file__).resolve().parent / "imports/gutenberg-next-ten/pronunciations/69378.json"
        payloads = json.loads(asset.read_text(encoding="utf-8"))
        pinned = next(p["pronunciations"] for p in payloads.values()
                      if any(r["line"].startswith("U--h") for r in p["pronunciations"]))
        cases = {
            "marked": (oh + "\n" + lawdy, [row(oh, 3, "oh", numbering="v2+voices")]),
            "rebound": (oh + "\n" + lawdy, [row(lawdy, 2, "Lawdy")]),
            "pinned": ("\n".join(dict.fromkeys(r["line"] for r in pinned)), pinned),
        }
        for name, (text, rows) in cases.items():
            for layers in (["form"], ["language"]):
                with self.subTest(case=name, layers=layers):
                    session, records, last = complete(source(text), {"pronunciations": rows},
                                                      schemas=[], layers=layers)
                    self.assertTrue(last["done"])
                    self.assertTrue(records)
                    public = session.declarations["pronunciations"]
                    self.assertTrue(all("numbering" not in r for r in public))
                    self.assertEqual([(r["line"], r["token"]) for r in public],
                                     [(r["line"], r["token"]) for r in session.phon.lexicon.pronunciations])

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

    def test_english_coordinates_follow_joined_enclitics_and_dash_runs(self):
        # Reader scheme v2: a run of hyphens is punctuation, so `well--known`
        # is two tokens, each located on its own raw span.
        session, records, _ = complete(source("😀 There ’s high\nwell--known cat"), schemas=[])
        tokens = [r for r in records if r["kind"] == "token"]
        self.assertEqual([r["text"] for r in tokens], ["There's", "high", "well", "known", "cat"])
        joined, high, well, known, cat = tokens
        self.assertEqual(joined["normalized_range"]["codepoint_range"], [2, 10])
        self.assertEqual(joined["normalized_range"]["precision"], "span")
        self.assertEqual([r["codepoint_range"] for r in joined["normalized_range"]["parts"]], [[2, 7], [8, 10]])
        self.assertEqual([r["codepoint_range"] for r in joined["source_ranges"]], [[2, 7], [8, 10]])
        self.assertEqual([r["utf16_range"] for r in joined["source_ranges"]], [[3, 8], [9, 11]])
        self.assertEqual(high["normalized_range"]["codepoint_range"], [11, 15])
        self.assertEqual(well["normalized_range"]["codepoint_range"], [16, 20])
        self.assertEqual(known["normalized_range"]["codepoint_range"], [22, 27])
        self.assertEqual(cat["normalized_range"]["codepoint_range"], [28, 31])
        self.assertEqual(session.stream.lexical_tokens, (("There's", "high"), ("well", "known", "cat")))

    def test_english_token_ranges_rebuild_the_token_on_generated_lines(self):
        # Reader scheme v2's raw pieces, projected through the reading's own
        # ranges: on generated English lines (spaced enclitics, U+00AD, NFD,
        # dash runs, numerals, asides) every token record's codepoint and
        # UTF-16 ranges slice back to the token it names.
        import sys
        import unicodedata
        from pathlib import Path
        import lyric_harness as LH
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "quality"))
        import reader_cases as RC
        lines = [t for t in RC.generated_lines(400, seed=5)
                 if not any(c in t for c in "\x85\x1c\x1d\x1e\u2028\u2029\x0b\x0c\r")
                 and unicodedata.is_normalized("NFC", unicodedata.normalize("NFC", t))
                 and LH.reader_line(t, False).tokens][:60]
        text = "\n".join(lines)
        session, records, _ = complete(source(text), schemas=[])
        tokens = [r for r in records if r["kind"] == "token"]
        self.assertEqual(len(tokens), sum(len(w) for w in session.stream.lexical_tokens))
        checked = 0
        for r in tokens:
            nr = r["normalized_range"]
            if nr is None:
                continue
            parts = [p["codepoint_range"] for p in nr.get("parts", [])] or [nr["codepoint_range"]]
            raw = "".join(text[a:b] for a, b in parts)
            line = text[:parts[0][0]].count("\n")
            if not unicodedata.is_normalized("NFC", lines[line]):
                continue          # a recomposed segment maps whole (RawSpans)
            self.assertEqual(LH.normalise_word(raw), r["text"], (lines[line], r))
            exact = [x for x in r["source_ranges"] if x.get("precision") == "exact"]
            if len(exact) == len(parts):
                units = text.encode("utf-16-le")
                for x, (a, b) in zip(exact, parts):
                    self.assertEqual(x["codepoint_range"], [a, b])
                    ua, ub = x["utf16_range"]
                    self.assertEqual(units[2 * ua:2 * ub].decode("utf-16-le"), text[a:b])
            checked += 1
        self.assertGreater(checked, 100)

    def test_english_coordinates_follow_joined_enclitics_and_repeated_hyphens(self):
        # Reader scheme v1 (legacy replay): `well--known` is ONE token and the
        # pre-batch projection locates it.
        import lyric_harness as LH
        with LH.reader_scheme_scope("v1"):
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
