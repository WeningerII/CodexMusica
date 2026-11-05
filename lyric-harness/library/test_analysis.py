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
        self.assertEqual(registry["counts"], {"schemas": 80, "types": 76, "type_cells": 49,
            "classes": 5, "functions": 22, "shared_sound": 4, "pair_local": 67, "whole_figures": 13})
        schemas = [m for m in registry["methods"] if m["namespace"] == "schema"]
        self.assertEqual({m["name"] for m in schemas}, set(RL.REGISTRY))
        for row in schemas:
            self.assertEqual(row["required_capabilities"], list(RL.REGISTRY[row["name"]].capabilities()))
        # 23: mosaic rhyme declares `quotient:reduced_vowel` (#657).
        self.assertEqual(len(registry["capabilities"]), 23)
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

    def test_method_results_are_unique_with_and_without_stanza_breaks(self):
        for separator in ("\n", "\n\n"):
            reading = source("cat\nhat\nbat\nmat" + separator + "cat\nhat\nbat\nmat")
            with self.subTest(separator=separator):
                _, records, _ = complete(reading)
                results = [r for r in records if r["kind"] == "method_result"]
                self.assertEqual(len(results), len({r["id"] for r in results}))
                self.assertEqual(len(results), len(RL.REGISTRY))
                if separator == "\n":
                    for name in ("monorhyme / leash", "dvitiyakshara-prasa", "monai"):
                        result = next(r for r in results if r["schema_name"] == name)
                        self.assertEqual(result["availability"], "needs_declaration")
                        self.assertEqual(result["verdict"], "undecided")
                        self.assertEqual(result["coverage"], "refused")
                        self.assertIn("stanza", result["refusal"]["missing"])
                        self.assertNotIn("supply", result)

    def test_refused_whole_figures_restart_without_duplicate_results(self):
        reading = source("cat\nhat")
        schemas = ["monorhyme / leash", "dvitiyakshara-prasa", "monai"]
        _, records, full = complete(reading, schemas=schemas)
        _, resumed, restarted = complete(reading, schemas=schemas, batch=1, restart=True)
        self.assertEqual(canonical_json(resumed), canonical_json(records))
        self.assertEqual(len(resumed), len({r["id"] for r in resumed}))
        self.assertEqual(restarted["summary"]["coverage"], full["summary"]["coverage"])
        self.assertEqual(restarted["summary"]["counters"], full["summary"]["counters"])

    def test_whole_figure_terminal_record_restart_preserves_refusal_phase(self):
        # Expired leases stop immediately after each record, including after
        # the terminal result but before its task advances. A candidate batch
        # alone does not exercise that emission cursor.
        fixtures = (("cat\nhat", "needs_declaration", "schema"),
                    ("cat zzzqxx\nhat\n\nbat\nmat", "unknown_members", "assembly"),
                    ("cat\nhat\n\nbat\nmat", "available", "assembly"),
                    ("cat\nhat\n\nbat\nmat", "unsupported", "assembly"))
        name = "monorhyme / leash"
        for text, availability, terminal_phase in fixtures:
            with self.subTest(availability=availability), patch.object(RL, "assemble", wraps=RL.assemble) as assemble:
                if availability == "unsupported":
                    assemble.return_value = RL.Refusal(name, "stanza", "Assembly declined the supplied frame.")
                reading = source(text)
                _, records, full = complete(reading, schemas=[name])
                committed, checkpoint, terminal_checkpoints = [], None, []
                for _ in range(100):
                    with patch("library.analysis.runtime_identity", return_value=_FIXTURE_RUNTIME):
                        session = AnalysisSession(reading, None,
                            {"layers": ["sound"], "schemas": [name]}, checkpoint,
                            load_records=lambda mid: (r for r in committed if r.get("method_id") == mid))
                    result = session.step(256, deadline=0)
                    committed.extend(result["records"])
                    checkpoint = json.loads(json.dumps(result["checkpoint"]))
                    for row in result["records"]:
                        if row["kind"] == "method_result":
                            self.assertEqual(row["availability"], availability)
                            terminal_checkpoints.append((checkpoint["phase"], checkpoint["emission"]))
                    if result["done"]:
                        break
                else:
                    self.fail("reader did not finish single-record restart traversal")
                self.assertEqual(terminal_checkpoints, [(terminal_phase, 1)])
                self.assertEqual(canonical_json(committed), canonical_json(records))
                self.assertEqual(len(committed), len({r["id"] for r in committed}))
                self.assertEqual(result["summary"], full["summary"])

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

    def test_each_reading_combination_cap_refuses_the_method(self):
        # BB8 and Jony on #590: a cap that never fires is untested. With
        # `zoddet` first read B AH1 T, the first readings rhyme identically
        # (not a perfect rhyme), so the pair is a candidate on the work's own
        # stream and is searched there: four combinations, past a cap of two.
        # With D EH1 T the pair is reachable only through each line's
        # discovery: two combinations a line, past a cap of one. Either way
        # the method is refused and the pair is never answered true.
        import lyric_harness as LH
        original = LH.Lexicon.__init__
        reading = source("I saw the zibbet\nAnd then the zoddet")
        for zoddet, cap, scope in ((["B", "AH1", "T"], 2, "a pair's words"),
                                   (["D", "EH1", "T"], 1, "a line's words")):
            def with_fixture_words(self, *args, **kwargs):
                original(self, *args, **kwargs)
                self.entries["zibbet"] = [["B", "AH1", "T"], ["AH0", "B", "IY1", "T"]]
                self.entries["zoddet"] = [zoddet, ["AH0", "D", "IY1", "T"]]

            with self.subTest(scope=scope), patch.object(LH.Lexicon, "__init__", with_fixture_words):
                _, rows, _ = complete(reading, schemas=["perfect rhyme"])
                self.assertEqual([r["verdict"] for r in rows if r["kind"] == "relation_instance"], ["true"])
                with patch.object(AnalysisSession, "EDGE_COMBOS", cap):
                    _, capped, _ = complete(reading, schemas=["perfect rhyme"])
                result = next(r for r in capped if r["kind"] == "method_result")
                self.assertEqual(result["coverage"], "refused")
                self.assertEqual(result["refusal"]["kind"], "reading_combinations")
                self.assertIn(scope, result["refusal"]["detail"])
                self.assertNotIn("true", [r["verdict"] for r in capped if r["kind"] == "relation_instance"])

    def test_only_pairs_over_disputed_words_are_kept_for_discovery(self):
        # #590's memory regression: every candidate pair of the work was kept
        # to deduplicate alternate-reading discovery, +295 MiB on a 325-word
        # text. Discovery only ever asks about pairs with a member over a
        # disputed word, so only those are kept, whatever the words.
        captured = []
        original = AnalysisSession._alternate_edges

        def capture(self, name, schema, seen):
            captured.append((self, seen))
            return original(self, name, schema, seen)

        reading = source("Between the two of us\nI only answered yes\n"
                         "The evening sun went down\nThe river ran through town\n"
                         "We walked along the shore\nAnd talked of nothing more")
        with patch.object(AnalysisSession, "_alternate_edges", capture):
            session, rows, _ = complete(reading, schemas=["perfect rhyme", "multisyllabic rhyme"])
        self.assertTrue(session._disputed)
        self.assertTrue(any(seen for _, seen in captured))
        for owner, seen in captured:
            for pair in seen:
                self.assertTrue(any(cell in owner._disputed for key in pair for cell in key[2]), pair)
        self.assertTrue(any(r["kind"] == "relation_instance" and r["verdict"] == "true" for r in rows))

    def test_figure_edge_schema_names_resolve_for_tradition_scope(self):
        # #595: analysed rhyme names its four edges "assonance (crossed)" and
        # "consonance (crossed)", schemas the registry does not hold, and the
        # reader looked each edge's schema up by name for its tradition scope
        # -- a KeyError that aborted the whole run. Every name a figure puts on
        # an edge must resolve to a schema of that name, true or undecided.
        import quality.relations as RL
        stanza = ("We walked into the sun\nAnd found a can of tin\n"
                  "The dog was feeling sick\nIt fell into the {}\n\n"
                  "And that was all we knew")
        # `zorbleth` is unread, so the same grid is recorded undecided.
        for end, expected in (("suck", "true"), ("zorbleth", "undecided")):
            with self.subTest(end=end):
                _, rows, _ = complete(source(stanza.format(end)), schemas=["analysed rhyme"])
                # A figure's edges are a field like any other: past the detail
                # threshold they travel as detail parts, read back as a reader
                # reads them.
                figures = [r for r in resolve_detail_records(rows) if r["kind"] == "relation_figure"]
                self.assertEqual([f["verdict"] for f in figures], [expected])
                names = set()
                for edge in figures[0]["edges"]:
                    named = RL.schema_named(edge["schema_name"])
                    self.assertEqual(named.name, edge["schema_name"])
                    self.assertEqual(edge["scope"], RL.tradition_scope(named, "eng"))
                    names.add(edge["schema_name"])
                self.assertEqual(names, {"assonance (crossed)", "consonance (crossed)"})
        # The crossing is the definition, and an unknown name still refuses.
        self.assertIs(RL.schema_named("assonance (crossed)"), RL.crossed_edge("assonance"))
        self.assertIn(RL.ChannelRule("coda", RL.DIFFER, "anchor"), RL.crossed_edge("assonance").channels)
        self.assertIn(RL.ChannelRule("nucleus", RL.DIFFER, "anchor"), RL.crossed_edge("consonance").channels)
        with self.assertRaises(KeyError):
            RL.schema_named("assonance (inverted)")

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

    def test_a_rebuild_reads_only_the_lines_it_has_not_read(self):
        # The #590 slowdown (Don, 6379114576): a rebuilt line stream is the
        # work's length with every other line blank, and each rebuild asked
        # every line's phonology again and re-read the syllables of a line its
        # readings leave as they were. A rebuild asks a line TEXT once, and
        # reads a line's words once per readings pinned on that line, across
        # the session. Counted, so a regression is a failure, not a slowdown.
        from quality.phonology.eng import English
        text = ("Every hour of our family fire\nDifferent nights and every lonely desire\n\n"
                "We sat by the fire with our camera and wine\nEvery interest naturally fine")
        session = AnalysisSession(source(text), None, {"layers": ["sound"]}, None, load_records=lambda mid: iter(()))
        combos, _ = RL.reading_combos(session.stream, {t for t in session._disputed if t[0] == 0}, 64)
        line0, line3 = (list(session.stream.lexical_tokens[li]) for li in (0, 3))
        texts = text.split("\n")
        asked, read = [], []
        for_line, merged = English.for_line, English._merged
        with patch.object(English, "for_line", lambda self, t: asked.append(t) or for_line(self, t)), \
             patch.object(English, "_merged", lambda self, w: read.append(w) or merged(self, w)):
            for lines, combo, texts_asked, words in (
                    ([0], combos[1], {texts[0], ""}, line0),             # one blank text, not four blank lines
                    ([0, 3], combos[1], {texts[0], texts[3], ""}, line3),  # line 0 under these readings is read
                    ([0, 3], combos[2], {texts[0], texts[3], ""}, line0),  # line 3's readings did not move
                    ([0], combos[1], set(), [])):                       # the same rebuild is the cached one
                asked.clear()
                read.clear()
                session._line_stream(lines, combo)
                with self.subTest(lines=lines, combo=session._combo_key(combo)):
                    self.assertEqual(sorted(asked), sorted(texts_asked))
                    self.assertEqual(read, words)

    def test_an_evicted_rebuild_leaves_no_span_index(self):
        session = AnalysisSession(source("Every hour of our family fire\nDifferent nights and every lonely desire"),
                                  None, {"layers": ["sound"]}, None, load_records=lambda mid: iter(()))
        rule = RL.REGISTRY["perfect rhyme"].spans[0]
        combos, _ = RL.reading_combos(session.stream, {t for t in session._disputed if t[0] == 0}, 64)
        with patch.object(AnalysisSession, "MINI_CACHE", 2):
            for combo in combos[1:6]:
                session._spans_by_key(session._line_stream([0], combo), rule)
            live = {id(st) for st in session._mini.values()}
            self.assertEqual(len(live), 2)
            self.assertEqual(set(session._span_index), live)

    def test_a_rebuild_is_guarded_when_its_lines_are_already_read(self):
        # 3PO on #598: a warm line-read table means a rebuild syllabifies
        # nothing, so the guard inside syllabification never runs. The
        # rebuild itself is guarded, whatever it reads.
        import os
        from quality.phonology.eng import English
        session = AnalysisSession(source("Every hour of our family fire\nDifferent nights and every lonely desire"),
                                  None, {"layers": ["sound"]}, None, load_records=lambda mid: iter(()))
        combos, _ = RL.reading_combos(session.stream, {t for t in session._disputed if t[0] == 0}, 64)
        session._line_stream([0], combos[1])
        session._mini.clear()
        session._span_index.clear()
        read = []
        merged = English._merged
        with patch.object(English, "_merged", lambda self, w: read.append(w) or merged(self, w)), \
             patch.dict(os.environ, {"LIBRARY_READER_MAX_RSS_MIB": "1"}):
            with self.assertRaisesRegex(ValueError, "RESOURCE_LIMIT: any-reading rebuild"):
                session._line_stream([0], combos[1])
        self.assertEqual(read, [])

    def test_the_line_read_table_is_bounded(self):
        # 3PO on #598: a measured peak is not a bound. Each combination of
        # line 0's readings is a new entry, so the table grows with them --
        # and stops at LINE_READS_CACHE + 3.
        def sizes(cap):
            session = AnalysisSession(source("Every hour of our family fire\nDifferent nights and every lonely desire"),
                                      None, {"layers": ["sound"]}, None, load_records=lambda mid: iter(()))
            combos, _ = RL.reading_combos(session.stream, {t for t in session._disputed if t[0] == 0}, 64)
            with patch.object(AnalysisSession, "LINE_READS_CACHE", cap):
                out = []
                for combo in combos[1:12]:
                    session._line_stream([0, 1], combo)
                    out.append(len(session._line_reads))
                return out
        self.assertGreater(max(sizes(1024)), 4 + 3)
        self.assertLessEqual(max(sizes(4)), 4 + 3)

    def test_every_rebuild_cache_leaves_the_record_stream_unchanged(self):
        # The caches decide what is read again, never what is recorded: the
        # whole record stream, not only verdicts, is the same with every
        # rebuild cache held to its smallest size.
        reading = source("Every night I watch the fire\nBurning in our family room\n"
                         "Every hour I feel it higher\nEvery flower starts to bloom")
        _, rows, _ = complete(reading)
        with patch.object(AnalysisSession, "MINI_CACHE", 1), patch.object(AnalysisSession, "LINE_READS_CACHE", 1):
            _, squeezed, _ = complete(reading)
        self.assertEqual(canonical_json(squeezed), canonical_json(rows))

    def test_a_member_with_no_referent_under_another_reading_is_absent(self):
        # BB8's texts on #590: with `fire` / `hour` read as one syllable, the
        # line-final penult has no referent anywhere (cynghanedd lusg,
        # syllabic rhyme). The default run over every schema must finish.
        for text in ("I sat beside the fire\nand watched the night go by",
                     "we waited for an hour\nthe rain came down"):
            _, rows, last = complete(source(text))
            self.assertTrue(last["done"], text)
            self.assertTrue(any(r["kind"] == "method_result" for r in rows), text)

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


class ResumeKeepsRefusals(unittest.TestCase):
    def test_an_unsearched_reading_combination_survives_a_restart(self):
        # One whole-line pair holds six disputed words, more combinations
        # than `EDGE_COMBOS`. `_any_reading` recorded that per candidate,
        # outside the generator a resume fast-forwards, so a restarted
        # traversal reported the method answered.
        reading = source("fire every hour flower power\nour family evening fire flower\ncat")
        schemas = ["parechesis / general consonance"]
        _, whole, _ = complete(reading, schemas=schemas)
        result = next(r for r in whole if r["kind"] == "method_result")
        self.assertEqual(result["coverage"], "refused")
        self.assertEqual(result["refusal"]["kind"], "reading_combinations")
        for batch in (1, 7):
            _, resumed, _ = complete(reading, schemas=schemas, batch=batch, restart=True)
            self.assertEqual(canonical_json(resumed), canonical_json(whole))

    def test_every_checkpoint_key_is_declared(self):
        # `incomplete` was written to the checkpoint without a place in
        # `ReaderCheckpoint`, the documented shape of a checkpoint.
        import typing
        from library.contracts import ReaderCheckpoint
        reading = source("fire every hour flower power\nour family evening fire flower\ncat")
        _, _, last = complete(reading, schemas=["parechesis / general consonance"])
        self.assertIn("incomplete", last["checkpoint"])
        # contracts.py defers annotations, so `__optional_keys__` is empty;
        # resolving the hints is what sees NotRequired.
        hints = typing.get_type_hints(ReaderCheckpoint, include_extras=True)
        self.assertLessEqual(set(last["checkpoint"]), set(hints))
        self.assertIs(typing.get_origin(hints["incomplete"]), typing.NotRequired)


def _with_words(words):
    """Patch the lexicon with fixture words: {word: [phones, ...]}."""
    import lyric_harness as LH
    original = LH.Lexicon.__init__

    def init(self, *args, **kwargs):
        original(self, *args, **kwargs)
        for word, readings in words.items():
            self.entries[word] = [list(r) for r in readings]
    return patch.object(LH.Lexicon, "__init__", init)


def _edge(rows, a, b):
    """The relation_instance between token coordinates `a` and `b`, or None."""
    want = {f"line:{a[0]}:token:{a[1]}", f"line:{b[0]}:token:{b[1]}"}
    return next((r for r in rows if r["kind"] == "relation_instance"
                 and {r["a"]["token_ids"][0], r["b"]["token_ids"][0]} == want), None)


def _domain_cells(domain):
    toks = domain["tokens"]
    return {(toks[int(i)], toks[j]) for i, runs in domain["pairs"].items()
            for first, last in runs for j in range(first, last + 1)}


class ConnectionEvidence(unittest.TestCase):
    """The evidence the connection views read (design contract, 2026-10-30):
    merged readings searched, per-edge search and quantifier, a reason on
    every undecided edge, the syllables compared, and each method's domain."""

    # `zee` is MERGED: two readings of one syllable, folded into knowledge
    # sets. `zeed`'s readings disagree on nucleus AND coda, so the sets leave
    # zeed~beet open while each whole reading fails one channel.
    WORDS = {"zee": [["Z", "IY1"], ["Z", "AH0"]], "zeed": [["Z", "IY1", "D"], ["Z", "UW1", "T"]]}

    def test_an_open_merged_set_is_settled_under_whole_readings(self):
        reading = source("zee is home\nand bee is too")
        with _with_words(self.WORDS):
            session, rows, _ = complete(reading, schemas=["internal rhyme"])
            self.assertIn((0, 0), session._merged)
            edge = _edge(rows, (0, 0), (1, 1))
            self.assertEqual(edge["verdict"], "true")
            self.assertEqual(edge["reading"], {"rule": "any_reading", "witness": ["zee = Z IY1"]})
            # Both readings were AVAILABLE (inside the cap) but the search
            # stopped at its first witness: one of two judged, so partial.
            self.assertEqual(edge["reading_search"], {"state": "partial", "combinations_examined": 1,
                                                      "combination_limit": 64, "termination_reason": "witness_found"})
            self.assertEqual(edge["quantifier"], "exists_compatible_reading")
            # What was compared is the witness reading's syllable, not the set.
            self.assertEqual(edge["compared"]["a"][0]["nucleus"], "IY")
            # Unsearched, the same pair stays open on the set: the check above
            # is what the merged search changed.
            with patch.object(AnalysisSession, "_merged_touched", lambda self, st, *spans: set()):
                _, before, _ = complete(reading, schemas=["internal rhyme"])
            self.assertEqual(_edge(before, (0, 0), (1, 1))["verdict"], "undecided")
            self.assertEqual(_edge(before, (0, 0), (1, 1))["undecided_reason"], "channel_unknown")

    def test_an_open_merged_set_every_reading_fails_is_false(self):
        reading = source("zeed is home\nand beet is too")
        with _with_words(self.WORDS):
            _, rows, _ = complete(reading, schemas=["internal rhyme"])
            # False is counted, never recorded.
            self.assertIsNone(_edge(rows, (0, 0), (1, 1)))
            self.assertFalse([r for r in rows if r["kind"] == "relation_instance" and r["verdict"] == "undecided"])
            with patch.object(AnalysisSession, "_merged_touched", lambda self, st, *spans: set()):
                _, before, _ = complete(reading, schemas=["internal rhyme"])
            self.assertEqual(_edge(before, (0, 0), (1, 1))["verdict"], "undecided")

    def test_a_capped_merged_search_is_partial_on_the_edge_only(self):
        # A merged word forms no bucket key, so a cap on its readings can
        # leave an edge undecided but never hide a pair: the edge says
        # `partial` and the method stays answered. A disputed word's cap,
        # which can hide a pair, still refuses the method (the tests above).
        reading = source("zeed is home\nand beet is too")
        with _with_words(self.WORDS), patch.object(AnalysisSession, "EDGE_COMBOS", 1):
            _, rows, _ = complete(reading, schemas=["internal rhyme"])
            edge = _edge(rows, (0, 0), (1, 1))
            self.assertEqual(edge["verdict"], "undecided")
            self.assertEqual(edge["undecided_reason"], "combination_cap")
            self.assertEqual(edge["reading_search"], {"state": "partial", "combinations_examined": 1,
                                                      "combination_limit": 1, "reason": "combination_cap",
                                                      "termination_reason": "combination_cap"})
            result = next(r for r in rows if r["kind"] == "method_result")
            self.assertEqual(result["coverage"], "answered")

    def test_a_search_stopped_at_its_witness_is_exhaustive_only_if_nothing_was_left(self):
        # Available-combination completeness is not evaluated completeness
        # (3PO, #641): `zee`'s witness is its FIRST reading (one of two
        # judged, partial); `zea`'s is its LAST (both judged, exhaustive).
        words = {"zee": [["Z", "IY1"], ["Z", "AH0"]], "zea": [["Z", "AH0"], ["Z", "IY1"]]}
        with _with_words(words):
            for word, state, examined in (("zee", "partial", 1), ("zea", "exhaustive", 2)):
                with self.subTest(word=word):
                    _, rows, _ = complete(source(f"{word} is home\nand bee is too"), schemas=["internal rhyme"])
                    search = _edge(rows, (0, 0), (1, 1))["reading_search"]
                    self.assertEqual((search["state"], search["combinations_examined"],
                                      search["termination_reason"]), (state, examined, "witness_found"))

    def test_a_failed_rebuild_is_never_counted_as_judged(self):
        # Fault injection (3PO, #641): the first of `zee`'s two readings
        # cannot be rebuilt. Only the second is judged, so the search is
        # never `exhaustive`, whether that reading holds (witness, partial)
        # or fails (undecided, partial, rebuild_unavailable).
        original = AnalysisSession._line_stream
        failed = []

        def first_fails(self, lines, combo):
            # The first-listed reading's rebuild fails; every other builds.
            if any(tuple(c[2]) == tuple(fail) for c in combo.values()):
                failed.append(self._combo_key(combo))
                return None
            return original(self, lines, combo)
        for words, verdict_ in (({"zee": [["Z", "IY1"], ["Z", "AH0"]]}, "undecided"),
                                ({"zee": [["Z", "UW1"], ["Z", "IY1"]]}, "true")):
            failed.clear()
            fail = words["zee"][0]
            with self.subTest(readings=words["zee"]), _with_words(words), \
                    patch.object(AnalysisSession, "_line_stream", first_fails):
                _, rows, _ = complete(source("zee is home\nand bee is too"), schemas=["internal rhyme"])
                edge = _edge(rows, (0, 0), (1, 1))
                self.assertEqual(edge["verdict"], verdict_)
                self.assertEqual(edge["reading_search"]["state"], "partial")
                self.assertEqual(edge["reading_search"]["combinations_examined"], 1)
                self.assertTrue(failed)
                if verdict_ == "undecided":
                    self.assertEqual(edge["undecided_reason"], "rebuild_unavailable")
                    self.assertEqual(edge["reading_search"]["termination_reason"], "rebuild_unavailable")

    def test_a_locus_only_some_readings_have_is_never_certified(self):
        # `zeeta`'s readings share a syllable count (MERGED) but not their
        # stress, so its last-stressed anchor -- and its internal-rhyme span --
        # exists under each reading and not on the knowledge set. The domain
        # must not certify its cells False or outside (3PO, #641): it names
        # the occurrence as reading-dependent.
        words = {"zeeta": [["Z", "IY1", "T", "AH0"], ["Z", "IY0", "T", "AH1"]]}
        with _with_words(words):
            session, rows, _ = complete(source("the zeeta came\nwe bring the beta home"),
                                        schemas=["internal rhyme"])
            self.assertIn((0, 1), session._merged)
            domain = next(r for r in rows if r["kind"] == "method_result")["domain"]
            self.assertIn("line:0:token:1", domain["reading_dependent_tokens"])
            # Not merely absent: `the` is merged too, but its one syllable
            # is the anchor under every reading, so it stays certified.
            self.assertNotIn("line:0:token:0", domain["reading_dependent_tokens"])

    def test_a_restressed_merged_word_is_discovered_under_its_readings(self):
        # `zanchor`'s readings share a syllable count but not their stress:
        # its knowledge set has no last-stressed syllable, so no span over it
        # is enumerated and no pair reaches the search. Its readings rebuild
        # its line, as a disputed word's do, and the rhyme one of them makes
        # is found -- inside the domain (3PO's #641 fixture).
        words = {"zanchor": [["Z", "IY1", "T", "AH0"], ["Z", "IY0", "T", "AH1"]],
                 "banchor": [["B", "IY1", "T", "AH0"]]}
        with _with_words(words):
            session, rows, _ = complete(source("zanchor\nbanchor\ncat\nhat"), schemas=["perfect rhyme"])
            self.assertIn((0, 0), session._restressed)
            edge = _edge(rows, (0, 0), (1, 0))
            self.assertEqual(edge["verdict"], "true")
            self.assertEqual(edge["reading"]["witness"], ["zanchor = Z IY1 T AH0"])
            domain = next(r for r in rows if r["kind"] == "method_result")["domain"]
            self.assertIn(("line:0:token:0", "line:1:token:0"), _domain_cells(domain))
            self.assertIn("line:0:token:0", domain["reading_dependent_tokens"])

    def test_every_undecided_edge_names_a_declared_reason(self):
        import typing
        from library.contracts import UndecidedReason
        allowed = set(typing.get_args(UndecidedReason))
        reading = source("fire every hour flower power\nour family evening fire flower\nthe cat is in the hat")
        _, rows, _ = complete(reading, schemas=["internal rhyme", "perfect rhyme", "multisyllabic rhyme"])
        # Whole figures too: Frost's L2-3 leave chain rhyme open. (L13 left
        # cynghanedd sain open only on only~other's empty onsets, which
        # M-323's real-consonant rule now judges False.)
        _, chain, _ = complete(source("His house is in the village though;\nHe will not see me stopping here"),
                               schemas=["chain rhyme (rap)"])
        figures = [r for r in resolve_detail_records(chain) if r["kind"] == "relation_figure"]
        self.assertIn("undecided", [r["verdict"] for r in figures])
        for r in figures:
            self.assertEqual(r["verdict"] == "undecided", "undecided_reason" in r, r["id"])
            if "undecided_reason" in r:
                self.assertIn(r["undecided_reason"], allowed)
        edges = [r for r in rows if r["kind"] == "relation_instance"]
        self.assertTrue(edges)
        for r in edges:
            self.assertIn(r["quantifier"], ("exists_compatible_reading", "first_listed_reading"))
            self.assertIn(r["reading_search"]["state"], ("not_needed", "exhaustive", "partial", "unavailable"))
            self.assertEqual(r["verdict"] == "undecided", "undecided_reason" in r, r["id"])
            if "undecided_reason" in r:
                self.assertIn(r["undecided_reason"], allowed)

    def test_a_domain_names_its_reading_policy(self):
        # A work with sound declarations keeps first-listed readings, so a
        # disputed word's missing record is only its first reading's False:
        # the domain says so and lists the word (3PO, #646). Searched, the
        # same word is answered for every reading.
        words = {"zyre": [["Z", "AY1", "ER0"], ["Z", "AY1", "R"]]}
        reading = source("zyre is here\nthe bar")
        declared = {"sound": {"caesura": {"source": "caller-owned empty map", "positions": {}}}}
        with _with_words(words):
            for declarations, policy, dependent in ((None, "exists_compatible_reading", False),
                                                    (declared, "first_listed_reading", True)):
                _, rows, _ = complete(reading, declarations, ["internal rhyme"])
                domain = next(r for r in rows if r["kind"] == "method_result")["domain"]
                self.assertEqual(domain["reading_policy"], policy)
                self.assertEqual("line:0:token:0" in domain["reading_dependent_tokens"], dependent, policy)

    def test_first_listed_scopes_say_so_on_the_edge(self):
        # `every` is disputed and multisyllabic rhyme is a searched rule, kept
        # on first-listed readings: its edges over `every` say so.
        session, rows, _ = complete(source("every day\nheavy clay"), schemas=["multisyllabic rhyme"])
        over = [r for r in rows if r["kind"] == "relation_instance"
                and "line:0:token:0" in r["a"]["token_ids"] + r["b"]["token_ids"]]
        self.assertTrue(over)
        self.assertEqual({r["quantifier"] for r in over}, {"first_listed_reading"})

    def test_compared_syllables_are_the_judged_ones(self):
        _, rows, _ = complete(source("I know the snow\nwill go below"), schemas=["perfect rhyme"])
        syllables = {r["unit_id"]: r["syllable"] for r in rows if r["kind"] == "syllable"}
        edges = [r for r in rows if r["kind"] == "relation_instance"]
        self.assertTrue(edges)
        for r in edges:
            if "reading" not in r:
                self.assertEqual(r["compared"]["a"], [syllables[u] for u in r["a"]["unit_ids"]])
                self.assertEqual(r["compared"]["b"], [syllables[u] for u in r["b"]["unit_ids"]])

    def test_domain_is_the_loci_the_method_binds(self):
        reading = source("watch his woods\nthe snow will fall")
        _, rows, _ = complete(reading, schemas=["alliteration", "perfect rhyme", "multisyllabic rhyme"])
        domains = {r["schema_name"]: r["domain"] for r in rows if r["kind"] == "method_result"}
        alliteration = _domain_cells(domains["alliteration"])
        # Same-line pairs only: three on line 0, six on line 1, none across.
        self.assertEqual(len(alliteration), 9)
        self.assertTrue(all(a.split(":")[1] == b.split(":")[1] for a, b in alliteration))
        self.assertEqual(_domain_cells(domains["perfect rhyme"]), {("line:0:token:2", "line:1:token:3")})
        self.assertEqual(domains["alliteration"]["ordering"], "role_ordered")
        self.assertEqual(domains["multisyllabic rhyme"], {"projection": "none", "reason": "multi_token_spans"})
        # Every record of a projected method lies inside its domain, in the
        # same roles: the domain is the question the engine asked.
        for r in rows:
            if r["kind"] == "relation_instance" and r["schema_name"] in ("alliteration", "perfect rhyme"):
                pair = (r["a"]["token_ids"][0], r["b"]["token_ids"][0])
                self.assertIn(pair, _domain_cells(domains[r["schema_name"]]))

    def test_inside_the_domain_a_missing_record_is_the_engines_false(self):
        # The equality test (R2 B7.1), on the reference route's own answers:
        # every domain pair's Library verdict -- its record, or False where
        # there is none -- is what the engine's any-reading pair judge says.
        from quality.phonology.eng import _reading_scope
        reading = source("watch the white wave wash\nwe will walk away\nthe snow is low below")
        for name in ("alliteration", "perfect rhyme"):
            with self.subTest(schema=name):
                session, rows, _ = complete(reading, schemas=[name])
                st = session.stream
                domain = next(r for r in rows if r["kind"] == "method_result")["domain"]
                held = {(r["a"]["token_ids"][0], r["b"]["token_ids"][0]): r["verdict"]
                        for r in rows if r["kind"] == "relation_instance"}

                def rebuild(phon):
                    return RL.build_stream(st.text_lines, phon, line_status=st.line_status)

                def at(token_id):
                    parts = token_id.split(":")
                    return int(parts[1]), int(parts[3])
                # A reading-dependent cell is certified neither way.
                dependent = set(domain["reading_dependent_tokens"])
                cells = {c for c in _domain_cells(domain) if not dependent & set(c)}
                self.assertTrue(cells)
                with _reading_scope(), RL._line_read_scope():
                    for a, b in cells:
                        engine, _ = RL.pair_satisfies_any(RL.REGISTRY[name], st, at(a), at(b), rebuild)
                        self.assertEqual(held.get((a, b), "false"),
                                         {True: "true", False: "false", None: "undecided"}[engine], (a, b))


if __name__ == "__main__":
    unittest.main()


def _sound(reading, keys, batch=256, restart=False):
    """A whole traversal of the named shared-sound methods, committed as a
    worker would; restarted from each checkpoint when `restart`."""
    from library.registry import shared_sound_name
    mids = [method_id("shared_sound", shared_sound_name(k)) for k in keys]
    committed, checkpoint, session = [], None, None
    for _ in range(20000):
        if session is None or restart:
            with patch("library.analysis.runtime_identity", return_value=_FIXTURE_RUNTIME):
                session = AnalysisSession(reading, None, {"layers": ["sound"]}, checkpoint, requested_methods=mids,
                    load_records=lambda mid: (r for r in committed if r.get("method_id") == mid))
        last = session.step(batch)
        committed.extend(last["records"])
        checkpoint = last["checkpoint"]
        if last["done"]:
            return session, list(resolve_detail_records(committed)), last
    raise AssertionError("reader traversal did not exhaust")


def _sound_edges(rows, key):
    return [r for r in rows if r["kind"] == "relation_instance" and r.get("method_name") == key + "@v1"]


def _token(rows, li, ti):
    return next(r for r in rows if r["kind"] == "token" and r["token_id"] == f"line:{li}:token:{ti}")


class ReadingOutcomes(unittest.TestCase):
    """Item 5 (#637 6547011992, corrected 6547475463 / 6547751176 /
    6547785583; shapes BB8 6547502531): what the any-reading search already
    judged, carried on the edge as complete role-bound assignments, and the
    readings it varies, carried on the token. Only listed assignments are
    known; every other combination stays uncomputed. No new search."""

    WORDS = ConnectionEvidence.WORDS

    @staticmethod
    def member(assignment, occurrence):
        return next(m for m in assignment if m["occurrence"] == occurrence)

    def test_an_alternative_judged_before_the_witness_is_a_full_assignment(self):
        # `zea`'s witness is its LAST reading: the first was judged and failed.
        with _with_words({"zea": [["Z", "AH0"], ["Z", "IY1"]]}):
            _, rows, _ = complete(source("zea is home\nand bee is too"), schemas=["internal rhyme"])
        edge = _edge(rows, (0, 0), (1, 1))
        self.assertEqual(edge["verdict"], "true")
        [judged] = edge["reading_outcomes"]
        self.assertEqual(judged["verdict"], "false")
        zea = self.member(judged["assignment"], "line:0:token:0")
        bee = self.member(judged["assignment"], "line:1:token:1")
        self.assertEqual((zea["role"], zea["phones"], zea["held"], zea["display"]),
                         (["a"], "Z AH0", "varied", "zea = Z AH0"))
        # The fixed partner is part of the assignment, with its own reading.
        self.assertEqual((bee["role"], bee["held"]), (["b"], "only_reading"))
        # The witness is bound the same way.
        w = self.member(edge["witness_assignment"], "line:0:token:0")
        self.assertEqual((w["phones"], w["held"]), ("Z IY1", "varied"))
        # The pair's own verdict was judged on zea's merged set.
        self.assertEqual((edge["judged_under"]["basis"], edge["judged_under"]["verdict"]),
                         ("merged_set", "undecided"))
        self.assertEqual(self.member(edge["judged_under"]["assignment"], "line:0:token:0")["held"],
                         "merged_set")
        # The agreed summary keeps its shape: nothing private leaks into it.
        self.assertEqual(set(edge["reading_search"]), {"state", "combinations_examined",
                                                       "combination_limit", "termination_reason"})

    def test_a_first_reading_witness_judged_nothing_else(self):
        with _with_words(self.WORDS):
            _, rows, _ = complete(source("zee is home\nand bee is too"), schemas=["internal rhyme"])
        edge = _edge(rows, (0, 0), (1, 1))
        self.assertEqual(edge["reading_outcomes"], [])
        tok = _token(rows, 0, 0)
        self.assertEqual(tok["applicable_readings"], ["Z IY1", "Z AH0"])
        self.assertEqual(tok["applicable_source"], "variants")

    def test_repeated_occurrences_of_a_word_are_never_confused(self):
        # The same word on two lines, each paired with bee: every assignment
        # names its own occurrence, so the two zea are told apart by id.
        with _with_words({"zea": [["Z", "AH0"], ["Z", "IY1"]]}):
            _, rows, _ = complete(source("zea is home\nand bee is too\nzea again"),
                                  schemas=["internal rhyme"])
        for line in (0, 2):
            edge = _edge(rows, (line, 0), (1, 1))
            occurrences = {m["occurrence"] for o in edge["reading_outcomes"] for m in o["assignment"]}
            self.assertIn(f"line:{line}:token:0", occurrences)
            self.assertNotIn(f"line:{2 - line}:token:0", occurrences)

    def test_a_capped_search_lists_only_what_it_judged(self):
        with _with_words(self.WORDS), patch.object(AnalysisSession, "EDGE_COMBOS", 1):
            _, rows, _ = complete(source("zeed is home\nand beet is too"), schemas=["internal rhyme"])
        edge = _edge(rows, (0, 0), (1, 1))
        self.assertEqual(edge["verdict"], "undecided")
        self.assertEqual(len(edge["reading_outcomes"]), edge["reading_search"]["combinations_examined"])
        zeed = self.member(edge["reading_outcomes"][0]["assignment"], "line:0:token:0")
        self.assertEqual((zeed["phones"], zeed["held"]), ("Z IY1 D", "varied"))

    def test_an_edge_no_search_reached_carries_no_outcomes(self):
        _, rows, _ = complete(source("cat is home\nand hat is too"), schemas=["internal rhyme"])
        for r in rows:
            if r["kind"] == "relation_instance" and r["reading_search"]["state"] == "not_needed":
                self.assertNotIn("reading_outcomes", r)
                self.assertNotIn("judged_under", r)

    def test_the_inventory_is_the_declared_row_never_the_dictionary(self):
        reading = source("wind\nfind")
        declaration = {"pronunciations": [{"line": "wind", "token": 1, "word": "wind",
            "phones": ["W", "IH1", "N", "D"], "basis": "dictionary", "source": "caller-owned noun reading"}]}
        _, rows, _ = complete(reading, declaration, ["perfect rhyme"])
        tok = _token(rows, 0, 0)
        self.assertEqual(tok["applicable_source"], "declared")
        self.assertEqual(tok["applicable_readings"], ["W IH1 N D"])
        self.assertGreater(len(tok["reading_choices"]["dictionary_readings"]), 1)

    def test_the_shared_sound_search_keeps_its_judged_assignments(self):
        # zyre's first reading leaves its anchor coda open; its second, closed
        # by R as bar is, is the witness.
        with _with_words(SharedSound.WORDS):
            _, rows, _ = _sound(source("zyre is here\nthe bar"), ["coda"])
        edge = _edge(_sound_edges(rows, "coda"), (0, 0), (1, 1))
        self.assertEqual(edge["verdict"], "true")
        got = [(self.member(o["assignment"], "line:0:token:0")["phones"],
                self.member(o["assignment"], "line:1:token:1")["phones"], o["verdict"])
               for o in edge["reading_outcomes"]]
        # zyre's ER0 reading was judged against EACH of bar's readings: two
        # full assignments, never one per-reading verdict (3PO 6547475463).
        self.assertEqual(got, [("Z AY1 ER0", "B AA1 R", "false"), ("Z AY1 ER0", "B AA1", "false")])
        # `bar` has two readings of one syllable (rhotic or not), so the
        # pair's own verdict was judged on its merged set.
        self.assertGreater(len(_token(rows, 1, 1)["applicable_readings"]), 1)
        self.assertEqual(edge["judged_under"]["basis"], "merged_set")

    def test_a_pair_with_no_span_on_the_work_records_its_judged_assignments(self):
        # 3PO 6547785583 (2): the _sound_alt_pair route is instrumented too.
        # zanchor has no span on the work's reading; listed with its AH1
        # reading first, that reading is judged (against banchor's IY) before
        # the IY1 witness.
        words = dict(SharedSound.UNANCHORED, zanchor=[["Z", "IY0", "T", "AH1"], ["Z", "IY1", "T", "AH0"]])
        with _with_words(words):
            _, rows, _ = _sound(source("zanchor is here\nthe banchor zeal"), ["vowel"])
        edge = _edge(_sound_edges(rows, "vowel"), (0, 0), (1, 1))
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["judged_under"]["basis"], "no_span_on_work")
        self.assertIsNone(edge["judged_under"]["verdict"])
        [judged] = edge["reading_outcomes"]
        self.assertEqual(self.member(judged["assignment"], "line:0:token:0")["phones"], "Z IY0 T AH1")
        self.assertEqual(judged["verdict"], "false")

    def test_a_missing_span_is_outside_the_locus_never_false(self):
        # 3PO 6547785583 (3): a reading under which a member has no span was
        # not a candidate there; it is recorded outside the locus, never as a
        # predicate False. Fault injection: zyre's ER0 reading gives no span.
        original = AnalysisSession._sound_spans

        def spans(self, family, st):
            found = original(self, family, st)
            combo = getattr(st, "any_reading_combo", None) or {}
            if list(combo.get((0, 0), (None, None, []))[2]) == ["Z", "AY1", "ER0"]:
                found = {t: v for t, v in found.items() if t != (0, 0)}
            return found
        with _with_words(SharedSound.WORDS), patch.object(AnalysisSession, "_sound_spans", spans):
            _, rows, _ = _sound(source("zyre is here\nthe bar"), ["coda"])
        edge = _edge(_sound_edges(rows, "coda"), (0, 0), (1, 1))
        self.assertEqual(edge["verdict"], "true")
        got = [(self.member(o["assignment"], "line:0:token:0")["phones"],
                self.member(o["assignment"], "line:1:token:1")["phones"], o["verdict"])
               for o in edge["reading_outcomes"]]
        self.assertEqual(got, [("Z AY1 ER0", "B AA1 R", "outside_locus"),
                               ("Z AY1 ER0", "B AA1", "outside_locus")])

    def test_a_fixed_merged_partner_is_part_of_the_schema_base_provenance(self):
        # A confident base False excludes the merged partner from the search
        # subset, but that partner was still judged as a merged set.
        with _with_words({"zyre": [["Z", "IY1", "ER0"], ["Z", "AA1", "R"]]}):
            session, rows, _ = complete(source("zyre is here\nthe bar"), schemas=["internal rhyme"])
        edge = _edge(rows, (0, 0), (1, 1))
        self.assertIsNotNone(edge)
        self.assertIn((0, 0), session._disputed)
        self.assertIn((1, 1), session._merged)
        self.assertEqual(edge["verdict"], "undecided")
        under = edge["judged_under"]
        self.assertEqual(under["verdict"], "false")
        partner = self.member(under["assignment"], "line:1:token:1")
        self.assertEqual((partner["role"], partner["held"]), (["b"], "merged_set"))
        self.assertEqual(under["basis"], "merged_set")

    def test_the_base_provenance_is_the_stream_it_was_judged_on(self):
        # 3PO 6547785583 (4): a rebuilt stream carries its own assignment.
        from types import SimpleNamespace
        with _with_words(self.WORDS):
            session, _, _ = complete(source("zee is home\nand bee is too"), schemas=["internal rhyme"])
        roles = {(0, 0): ["a"], (1, 1): ["b"]}
        rebuilt = SimpleNamespace(any_reading_combo={(0, 0): (1, "zee", ["Z", "AH0"])})
        got = session._judged_under(rebuilt, roles, False, "merged_set")
        self.assertEqual((got["basis"], got["verdict"]), ("rebuilt_assignment", "false"))
        self.assertEqual(self.member(got["assignment"], "line:0:token:0")["phones"], "Z AH0")
        work = session._judged_under(session.stream, roles, None)
        self.assertEqual(work["basis"], "first_listed")


class SharedSound(unittest.TestCase):
    """`namespace: "shared_sound"` (#637): what two occurrences' sounds share
    at one aligned position, read through `relations.pair_channel_reads`
    and judged with the engine's own predicates. Never a registered figure."""

    TEXT = "The cat sat on the mat\nA bat in the hat"

    def test_four_versioned_methods_none_run_by_default(self):
        from library.registry import SHARED_SOUND_METHODS, SHARED_SOUND_LAYER
        rows = [m for m in build_registry()["methods"] if m["namespace"] == "shared_sound"]
        self.assertEqual({m["name"] for m in rows}, {k + "@v1" for k in SHARED_SOUND_METHODS})
        for m in rows:
            self.assertTrue(m["reader_requestable"])
            self.assertEqual(m["layer"], SHARED_SOUND_LAYER)
            self.assertEqual(m["id"], method_id("shared_sound", m["name"]))
        # The two onsets are two families, never one "onset" read.
        self.assertEqual({m["name"]: m["family"] for m in rows if m["channel"] == "onset"},
                         {"onset@v1": "word_start", "stressed_onset@v1": "last_stressed"})
        # All pairs of a work's words is paid only on request.
        session, _, _ = complete(source(self.TEXT))
        self.assertFalse([t for t in session.tasks if t[0] == "shared_sound"])

    def test_a_hold_is_agreement_at_the_compared_position(self):
        _, rows, _ = _sound(source(self.TEXT), ["vowel", "coda"])
        cat_sat = _edge(_sound_edges(rows, "vowel"), (0, 1), (0, 2))
        self.assertEqual(cat_sat["verdict"], "true")
        self.assertEqual((cat_sat["namespace"], cat_sat["layer"]),
                         ("shared_sound", "Shared sound (not a registered figure)"))
        self.assertEqual([cat_sat["compared"]["a"][0]["nucleus"], cat_sat["compared"]["b"][0]["nucleus"]], ["AE", "AE"])
        self.assertEqual(cat_sat["reading_context"], {"type": "merged", "members": [{"pinned": False}] * 2})
        self.assertEqual(cat_sat["channel_versions"]["channel_reads"], RL.CHANNEL_READ_VERSION)
        self.assertFalse(cat_sat["same_spelling"])
        # cat~the share no vowel: a judged False is counted, not recorded.
        self.assertIsNone(_edge(_sound_edges(rows, "vowel"), (0, 1), (0, 4)))
        # on~in: different vowels, the same closed coda.
        self.assertIsNone(_edge(_sound_edges(rows, "vowel"), (0, 3), (1, 2)))
        self.assertEqual(_edge(_sound_edges(rows, "coda"), (0, 3), (1, 2))["verdict"], "true")

    def test_a_record_from_the_read_only_primitive_serializes(self):
        # The primitive hands out read-only mappings all the way down, so a
        # caller cannot corrupt its cache; a sound record built from one
        # serializes exactly as from plain dicts (3PO, #646).
        from types import MappingProxyType
        session, rows, _ = _sound(source(self.TEXT), ["vowel"])
        st = session.stream
        spans = session._sound_spans("last_stressed", st)
        read = RL.pair_channel_reads(st, spans[(0, 1)][0], spans[(0, 2)][0], "last_stressed")
        self.assertIsInstance(read["reading_context"], MappingProxyType)
        self.assertIsInstance(read["syllables"][0][0], MappingProxyType)
        with self.assertRaises(TypeError):
            read["versions"]["channel_reads"] = 0
        value, record, _ = session._sound_pair("vowel", spans[(0, 1)][0], spans[(0, 2)][0])
        self.assertTrue(value)
        self.assertEqual(json.loads(canonical_json(record)), _edge(_sound_edges(rows, "vowel"), (0, 1), (0, 2)))

    def test_empty_sounds_are_not_shared(self):
        _, rows, _ = _sound(source(self.TEXT), ["onset", "stressed_onset", "coda"])
        # on~in and A~on agree on an EMPTY onset: no real consonant, no hold.
        for key in ("onset", "stressed_onset"):
            self.assertIsNone(_edge(_sound_edges(rows, key), (0, 3), (1, 2)))
            self.assertIsNone(_edge(_sound_edges(rows, key), (1, 0), (0, 3)))
        # the~A agree on an open coda: no hold either.
        self.assertIsNone(_edge(_sound_edges(rows, "coda"), (0, 0), (1, 0)))
        # Spelled alike is kept and flagged, never dropped.
        the_the = _edge(_sound_edges(rows, "onset"), (0, 0), (0, 4))
        self.assertEqual((the_the["verdict"], the_the["same_spelling"]), ("true", True))

    def test_a_merged_word_is_judged_under_one_whole_reading(self):
        _, rows, _ = _sound(source(self.TEXT), ["vowel"])
        # `the` is merged (AH0 ~ IY0): its set cannot agree with A's AH, so
        # the pair is judged under each whole reading, and holds under one.
        edge = _edge(_sound_edges(rows, "vowel"), (0, 0), (1, 0))
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["reading"]["witness"], ["The = DH AH0", "A = AH0"])
        self.assertEqual(edge["reading_search"]["termination_reason"], "witness_found")
        self.assertEqual(edge["reading_context"]["type"], "pinned")
        # What was compared is the witness reading's vowel, not the set.
        self.assertEqual(edge["compared"]["a"][0]["nucleus"], "AH")

    WORDS = {"zyre": [["Z", "AY1", "ER0"], ["Z", "AY1", "R"]]}

    def test_a_disputed_first_reading_never_answers_false_for_the_others(self):
        # zyre's first reading is two syllables, its anchor coda open; its
        # second is one syllable closed by R, as bar is.
        reading = source("zyre is here\nthe bar")
        with _with_words(self.WORDS):
            session, rows, _ = _sound(reading, ["coda"])
            self.assertIn((0, 0), session._disputed)
            edge = _edge(_sound_edges(rows, "coda"), (0, 0), (1, 1))
            self.assertEqual(edge["verdict"], "true")
            self.assertIn("zyre = Z AY1 R", edge["reading"]["witness"])
            self.assertEqual(edge["compared"]["a"][0]["coda"], ["R"])
            # Every pair over zyre is judged under each reading, so its
            # missing records are judged Falses: not reading-dependent.
            domain = next(r for r in rows if r["kind"] == "method_result")["domain"]
            self.assertNotIn("line:0:token:0", domain["reading_dependent_tokens"])
            # With no reading to search, the first reading's False is not
            # certified: undecided, and says why.
            with patch.object(RL, "reading_combos", lambda st, toks, cap: ([], True)):
                _, unsearched, _ = _sound(reading, ["coda"])
            edge = _edge(_sound_edges(unsearched, "coda"), (0, 0), (1, 1))
            self.assertEqual((edge["verdict"], edge["undecided_reason"]), ("undecided", "no_reading_combination"))
            self.assertEqual(edge["reading_search"]["state"], "unavailable")

    # 3PO's fixture (#646): zanchor's readings share a syllable count and
    # disagree on stress, so its knowledge set has no last-stressed anchor
    # and no span on the work's reading. Under its first whole reading it
    # stresses IY, as banchor does, and starts with Z, as zeal does.
    UNANCHORED = {"zanchor": [["Z", "IY1", "T", "AH0"], ["Z", "IY0", "T", "AH1"]],
                  "banchor": [["B", "IY1", "T", "AH0"]], "zeal": [["Z", "IY1", "L"]]}

    def test_a_word_unanchored_on_the_set_is_discovered_under_its_readings(self):
        reading = source("zanchor is here\nthe banchor zeal")
        with _with_words(self.UNANCHORED):
            session, rows, _ = _sound(reading, ["vowel", "stressed_onset"])
            self.assertIn((0, 0), session._merged)
            self.assertNotIn((0, 0), session._sound_spans("last_stressed", session.stream))
            for key, partner in (("vowel", (1, 1)), ("stressed_onset", (1, 2))):
                edge = _edge(_sound_edges(rows, key), (0, 0), partner)
                self.assertEqual(edge["verdict"], "true", key)
                self.assertIn("zanchor = Z IY1 T AH0", edge["reading"]["witness"])
                # Only zanchor is pinned; its partner keeps its own reading.
                self.assertEqual(edge["reading_context"]["type"], "partial")
                result = next(r for r in rows if r["kind"] == "method_result"
                              and r["method_name"] == key + "@v1")
                # Inside the domain, and nothing left reading-dependent: every
                # pair over zanchor was judged under its readings.
                self.assertIn(("line:0:token:0", "line:%d:token:%d" % partner), _domain_cells(result["domain"]))
                self.assertEqual(result["domain"]["reading_dependent_tokens"], [])
            # zanchor~is: IY or AH against IH under either reading -- judged,
            # and counted False.
            self.assertIsNone(_edge(_sound_edges(rows, "vowel"), (0, 0), (0, 1)))
            # The discovered cells live in the method's counts, so a
            # restarted traversal keeps them.
            _, resumed, _ = _sound(reading, ["vowel", "stressed_onset"], batch=1, restart=True)
            self.assertEqual(canonical_json(resumed), canonical_json(rows))

    def test_a_domain_names_its_reading_policy(self):
        # A work with sound declarations keeps first-listed readings, so a
        # disputed word's missing record is only its first reading's False:
        # the domain says so, and lists the word, for both namespaces (3PO,
        # #646). Searched, the same word is answered for every reading.
        reading = source("zyre is here\nthe bar")
        declared = {"sound": {"caesura": {"source": "caller-owned empty map", "positions": {}}}}
        with _with_words(self.WORDS):
            for declarations, policy, dependent in ((None, "exists_compatible_reading", False),
                                                    (declared, "first_listed_reading", True)):
                with patch("library.analysis.runtime_identity", return_value=_FIXTURE_RUNTIME):
                    _, schema_rows, _ = complete(reading, declarations, ["internal rhyme"])
                    from library.registry import shared_sound_name
                    session = AnalysisSession(reading, declarations, {"layers": ["sound"]},
                        requested_methods=[method_id("shared_sound", shared_sound_name("coda"))])
                rows = []
                while True:
                    last = session.step(256)
                    rows += last["records"]
                    if last["done"]:
                        break
                for row in (schema_rows, list(resolve_detail_records(rows))):
                    domain = next(r for r in row if r["kind"] == "method_result")["domain"]
                    self.assertEqual(domain["reading_policy"], policy)
                    self.assertEqual("line:0:token:0" in domain["reading_dependent_tokens"], dependent, policy)
                # The hold under zyre's second reading exists only when searched.
                held = _edge(_sound_edges(list(resolve_detail_records(rows)), "coda"), (0, 0), (1, 1))
                self.assertEqual(held is not None and held["verdict"] == "true", not dependent)

    def test_inside_the_domain_a_missing_record_is_a_judged_false(self):
        session, rows, last = _sound(source(self.TEXT), ["vowel"])
        result = next(r for r in rows if r["kind"] == "method_result")
        counts = next(m for m in last["summary"]["methods"] if m["method_id"] == result["method_id"])
        domain = result["domain"]
        self.assertEqual((domain["projection"], domain["ordering"]), ("exact_token_pair", "unordered"))
        self.assertEqual(domain["pair_count"], counts["true"] + counts["false"] + counts["undecided"])
        cells = _domain_cells(domain)
        edges = _sound_edges(rows, "vowel")
        recorded = {(e["a"]["token_ids"][0], e["b"]["token_ids"][0]) for e in edges}
        self.assertLessEqual(recorded, cells)
        # Independently: every unrecorded pair whose vowels are both settled
        # has different vowels, read straight off the work's syllables.
        st = session.stream
        nucleus = {}
        for tok, ids in st.tokens.items():
            anchor = [i for i in ids if st.units[i].syl.prominence == 1]
            nucleus[f"line:{tok[0]}:token:{tok[1]}"] = st.units[anchor[-1]].syl.nucleus if anchor else None
        for a, b in cells - recorded:
            if isinstance(nucleus[a], str) and isinstance(nucleus[b], str):
                self.assertNotEqual(nucleus[a], nucleus[b], (a, b))

    def test_a_restart_from_any_checkpoint_is_identical(self):
        keys = ["vowel", "onset"]
        _, whole, _ = _sound(source(self.TEXT), keys)
        for batch in (1, 7):
            _, resumed, _ = _sound(source(self.TEXT), keys, batch=batch, restart=True)
            self.assertEqual(canonical_json(resumed), canonical_json(whole))

    def test_past_the_pair_cap_the_method_is_refused_not_truncated(self):
        with patch.object(AnalysisSession, "SOUND_PAIR_CAP", 10):
            _, rows, last = _sound(source(self.TEXT), ["vowel"])
        self.assertFalse(_sound_edges(rows, "vowel"))
        result = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual((result["coverage"], result["domain"]), ("refused", {"projection": "none", "reason": "refused"}))
        self.assertFalse(last["summary"]["coverage"]["certified"])

    def test_the_pair_cap_counts_pairs_over_words_without_a_span(self):
        # 3PO's probe (#637 6534358951): zanchor has no span on the work's
        # reading, so its pairs were added after the cap was checked, and a
        # cap of 1 answered over 3 pairs.
        with _with_words(self.UNANCHORED), patch.object(AnalysisSession, "SOUND_PAIR_CAP", 1):
            _, rows, _ = _sound(source("zanchor banchor cat"), ["vowel"])
        result = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual((result["coverage"], result["domain"]), ("refused", {"projection": "none", "reason": "refused"}))
        self.assertFalse(_sound_edges(rows, "vowel"))
        # Exactly at the cap it answers, over all three pairs.
        with _with_words(self.UNANCHORED), patch.object(AnalysisSession, "SOUND_PAIR_CAP", 3):
            _, rows, _ = _sound(source("zanchor banchor cat"), ["vowel"])
        result = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual((result["coverage"], result["domain"]["pair_count"]), ("answered", 3))


class DomainOutcomes(unittest.TestCase):
    """`domain.listed_pairs_by_state` (#637, BB8's counts inventory, as 3PO narrowed it in 6545638972): a pair-projecting
    domain carries its listed pairs by state, counted where the verdicts were
    reached, because `counts` counts bucket candidates and disagrees with the
    domain (29 of 40 pair-projecting schemas on this poem). Every count is
    checked against the committed records cell by cell, on a whole run and on
    one restarted from every checkpoint."""

    TEXT = ("the cat sat on the mat tonight\nand light falls on the bright hat\n\n"
            "the night is long and wrong and strong\nso sing the song along")
    SCHEMAS = ["internal rhyme", "cross rhyme", "perfect rhyme", "amphisbaenic rhyme",
               "internal consonance", "alliteration"]

    def _check(self, rows):
        edges = {}
        for r in rows:
            if r["kind"] == "relation_instance":
                edges.setdefault(r["method_id"], []).append(r)
        seen = 0
        for r in rows:
            if r["kind"] != "method_result":
                continue
            d = r["domain"]
            if d["projection"] != "exact_token_pair":
                self.assertNotIn("listed_pairs_by_state", d)
                continue
            seen += 1
            cells = _domain_cells(d)
            states = {}
            for e in edges.get(r["method_id"], []):
                a, b = e["a"]["token_ids"], e["b"]["token_ids"]
                if len(a) == 1 and len(b) == 1 and a[0] != b[0]:
                    cell = (a[0], b[0])
                    if d["ordering"] == "unordered" and cell not in cells:
                        cell = (b[0], a[0])
                    # A recorded single-token pair is a listed pair.
                    self.assertIn(cell, cells, r["method_id"])
                    # One state per listed pair: true if any record of it
                    # is, else undecided (several spans can name one pair).
                    if states.get(cell) != "true":
                        states[cell] = e["verdict"]
            holds = sum(v == "true" for v in states.values())
            undecided = sum(v == "undecided" for v in states.values())
            o = d["listed_pairs_by_state"]
            self.assertEqual((o["listed"], o["true_pairs"], o["undecided_pairs"]),
                             (len(cells), holds, undecided), r["method_id"])
            self.assertEqual(o["listed"], d["pair_count"])
            unsure = o["reading_dependent_pairs"] or r["coverage"] != "answered"
            self.assertEqual(o["judged_false"], None if unsure else len(cells) - holds - undecided)
            self.assertNotIn("domain_true", r["counts"])
            self.assertNotIn("domain_undecided", r["counts"])
        return seen

    def test_schema_outcomes_match_the_records_cell_by_cell(self):
        _, rows, _ = complete(source(self.TEXT), schemas=self.SCHEMAS)
        self.assertEqual(self._check(rows), len(self.SCHEMAS))
        # The defect the field exists for: counts and domain disagree here.
        cross = next(r for r in rows if r["kind"] == "method_result" and r.get("schema_name") == "cross rhyme")
        self.assertNotEqual(cross["counts"]["candidates"], cross["domain"]["pair_count"])

    def test_outcomes_survive_a_restart_from_every_checkpoint(self):
        _, whole, _ = complete(source(self.TEXT), schemas=self.SCHEMAS)
        _, resumed, _ = complete(source(self.TEXT), schemas=self.SCHEMAS, batch=7, restart=True)
        pick = lambda rows: {r["method_id"]: r["domain"].get("listed_pairs_by_state") for r in rows if r["kind"] == "method_result"}
        self.assertEqual(pick(whole), pick(resumed))

    def test_an_unanswered_method_judges_nothing_false(self):
        # An unread member refuses the method's coverage: a listed pair with
        # no record there was never shown False, so `judged_false` is null
        # while the record counts still stand.
        text = "the cat sat on the zorbleflax mat\na hat and a bat on a flat"
        _, rows, _ = complete(source(text), schemas=["perfect rhyme", "cross rhyme"])
        results = [r for r in rows if r["kind"] == "method_result"
                   and r["domain"].get("projection") == "exact_token_pair"]
        self.assertTrue(results)
        for r in results:
            self.assertNotEqual(r["coverage"], "answered", r["method_id"])
            self.assertIsNone(r["domain"]["listed_pairs_by_state"]["judged_false"], r["method_id"])
        self.assertEqual(self._check(rows), len(results))

    def test_several_spans_on_one_pair_count_it_once(self):
        # A merged word is one token whose syllables are each a span, so two
        # candidates can name one word pair: the pair counts once, on a whole
        # run and on one restarted from every checkpoint (3PO, #637 6547517269).
        text = "the afternoon balloon, eighteen seventeen\nthe macaroon and the tambourine"
        names = ["internal rhyme", "internal assonance", "internal consonance"]
        _, rows, _ = complete(source(text), schemas=names)
        self.assertEqual(self._check(rows), len(names))
        singles = [r for r in rows if r["kind"] == "relation_instance"
                   and r["schema_name"] == "internal assonance"
                   and len(r["a"]["token_ids"]) == len(r["b"]["token_ids"]) == 1]
        pairs = {(r["a"]["token_ids"][0], r["b"]["token_ids"][0]) for r in singles}
        self.assertGreater(len(singles), len(pairs))
        _, resumed, _ = complete(source(text), schemas=names, batch=7, restart=True)
        pick = lambda rows: {r["method_id"]: r["domain"].get("listed_pairs_by_state") for r in rows if r["kind"] == "method_result"}
        self.assertEqual(pick(rows), pick(resumed))

    def test_outcomes_count_distinct_listed_pairs(self):
        out = AnalysisSession._outcomes
        domain = lambda ordering="role_ordered": {
            "projection": "exact_token_pair", "ordering": ordering, "tokens": ["t0", "t1", "t2"],
            "pairs": {"0": [[1, 2]], "1": [[2, 2]]}, "pair_count": 3, "reading_dependent_tokens": []}
        state = lambda d: d["listed_pairs_by_state"]
        # Duplicate notes, and a pair noted both true and undecided: true wins,
        # the populations are disjoint, and the rest is judged False.
        o = state(out(domain(), ([["t0", "t1"], ["t0", "t1"]], [["t0", "t1"], ["t1", "t2"], ["t1", "t2"]])))
        self.assertEqual((o["listed"], o["true_pairs"], o["undecided_pairs"], o["judged_false"]), (3, 1, 1, 1))
        # A replayed note (a restarted traversal) is the same pair again.
        self.assertEqual(state(out(domain(), ([["t0", "t2"]] * 5, [])))["judged_false"], 2)
        # Unordered: either order of a listed pair is that pair.
        o = state(out(domain("unordered"), ([["t1", "t0"], ["t0", "t1"]], [])))
        self.assertEqual((o["true_pairs"], o["judged_false"]), (1, 2))
        # Role-ordered: the reverse of a listed pair is not listed, so the
        # rest is not known to be False.
        o = state(out(domain(), ([["t1", "t0"]], [])))
        self.assertEqual((o["true_pairs"], o["judged_false"]), (0, None))
        # Unanswered, or a reading-dependent pair: no judged False.
        self.assertIsNone(state(out(domain(), ([], []), answered=False))["judged_false"])
        d = domain()
        d["reading_dependent_tokens"] = ["t2"]
        o = state(out(d, ([], [])))
        self.assertEqual((o["reading_dependent_pairs"], o["judged_false"]), (2, None))
        # A domain that projects nothing carries no outcomes.
        self.assertNotIn("listed_pairs_by_state", out({"projection": "none", "reason": "domain_cap"}, ([], [])))

    def test_shared_sound_outcomes_match_the_records(self):
        _, rows, _ = _sound(source(self.TEXT), ["vowel", "coda", "onset", "stressed_onset"])
        self.assertEqual(self._check(rows), 4)

    def _terminal_restart(self, requested, extra):
        """An uninterrupted traversal, and one restored from the checkpoint
        taken after each terminal method_result header, and after each of
        its detail parts but the last (3PO, #673): the domain is padded past
        the detail threshold, so the terminal record is emitted in parts and
        a restore must rebuild exactly the record whose header it already
        committed. -> (whole, restored, boundaries)."""
        pad = lambda real: lambda self, *a: {**real(self, *a), "pad": "x" * 20000}
        def run(restart):
            committed, cp, session, at, boundaries = [], None, None, False, 0
            for _ in range(20000):
                if session is None or (restart and at):
                    with patch("library.analysis.runtime_identity", return_value=_FIXTURE_RUNTIME):
                        session = AnalysisSession(source(self.TEXT), None, requested, cp,
                            load_records=lambda mid: (r for r in committed if r.get("method_id") == mid), **extra)
                # One record per step, so a checkpoint falls at every boundary.
                last = session.step(4096, deadline=0)
                tail = last["records"][-1] if last["records"] else None
                at = bool(tail and last["checkpoint"]["emission"] and (
                    (tail["kind"] == "method_result" and "$detail_ref" in tail["domain"])
                    or (tail["kind"] == "detail_part" and tail["parent_id"].startswith("method_result")
                        and tail["part"] + 1 < tail["total"])))
                boundaries += at
                committed.extend(last["records"])
                cp = last["checkpoint"]
                if last["done"]:
                    return list(resolve_detail_records(committed)), last, boundaries
            raise AssertionError("reader traversal did not exhaust")
        with patch.object(AnalysisSession, "_domain", pad(AnalysisSession._domain)), \
                patch.object(AnalysisSession, "_sound_domain", pad(AnalysisSession._sound_domain)):
            return run(False), run(True)

    def _assert_terminal_restart_is_exact(self, whole, restored, expected):
        (rows, last, _), (again, again_last, boundaries) = whole, restored
        self.assertGreater(boundaries, 0, "no checkpoint fell inside a terminal emission")
        self.assertEqual(again, rows)
        self.assertEqual(again_last["summary"], last["summary"])
        self.assertEqual(again_last["checkpoint"]["methods"], last["checkpoint"]["methods"])
        self.assertEqual(self._check(again), expected)
        for m in again_last["checkpoint"]["methods"].values():
            for key in ("domain_true", "domain_undecided", "alt_cells"):
                self.assertNotIn(key, m)

    def test_a_schema_terminal_emission_survives_a_restore_inside_it(self):
        names = ["internal rhyme", "perfect rhyme"]
        whole, restored = self._terminal_restart({"layers": ["sound"], "schemas": names}, {})
        self._assert_terminal_restart_is_exact(whole, restored, len(names))

    def test_a_shared_sound_terminal_emission_survives_a_restore_inside_it(self):
        from library.registry import shared_sound_name
        keys = ["vowel", "coda"]
        mids = [method_id("shared_sound", shared_sound_name(k)) for k in keys]
        whole, restored = self._terminal_restart({"layers": ["sound"]}, {"requested_methods": mids})
        self._assert_terminal_restart_is_exact(whole, restored, len(keys))
