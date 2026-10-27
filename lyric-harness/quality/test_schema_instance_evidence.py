"""Offline report serialization tests using explicit fixture readings, not CMUdict."""
import copy
import dataclasses
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lyric_harness as LH
from library.contracts import canonical_json
from quality import relations as R
from quality import schema_instance_evidence as E
from quality.phonology import Phonology, Syllable
from quality.schema_instance_evidence import from_stream, for_grade, _Serializer


class FixturePhonology(Phonology):
    language = "eng"
    reader_scheme = "v2"
    def tokens_for_line(self, text):
        return tuple(t.text for t in LH.reader_line(text, strip_parens=False, scheme="v2").tokens)
    def syllabify(self, word):
        return [Syllable(text=word, onset=(word[0],), nucleus="a", coda=("t",), prominence=1)]
    def declaration(self):
        return {"language": "eng", "reader_scheme": "v2", "fixture": True, "voices": True}


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.phon = FixturePhonology()
        self.lines = ["cat bat cat", "hat"]
        self.stream = R.build_stream(self.lines, self.phon, declaration={"language": "eng"})
    def report(self, **kw):
        return from_stream(self.stream, self.phon, declarations={"voices": True},
                           provenance={"reader_scheme": "v2"}, **kw)
    def test_actual_instances_and_same_line_population(self):
        # Pick the registered pair-local schemas with same-line matches, not a
        # synthesized word-pair or a Cartesian product of a declaration group.
        got = self.report()
        self.assertTrue(got["records"])
        same = [r for r in got["records"] if r["a"]["line_ids"] == r["b"]["line_ids"]]
        self.assertTrue(same)
        for record in got["records"]:
            expected = R.realise(R.REGISTRY[record["schema_name"]], self.stream)
            self.assertTrue(any(list(i.a.idx) == [int(x.split(':')[1]) for x in record['a']['unit_ids']]
                                and list(i.b.idx) == [int(x.split(':')[1]) for x in record['b']['unit_ids']]
                                for i in expected))
        self.assertFalse(got['population']['mandate_satisfaction'])
        self.assertTrue(got['population']['excluded_schemas'])
    def test_repeated_words_keep_occurrence_coordinates(self):
        serializer = _Serializer(self.stream, self.phon, {"hash": "fixture"})
        first, _ = serializer._token_ranges(0, 0)
        second, _ = serializer._token_ranges(0, 2)
        self.assertEqual(first[0]['utf16_range'], [0, 3])
        self.assertEqual(second[0]['utf16_range'], [8, 11])
    def test_discontinuous_parts_and_utf16(self):
        st = R.build_stream(["😀 There ’s cat"], self.phon, declaration={"language": "eng"})
        serializer = _Serializer(st, self.phon, {"hash": "fixture"})
        parts, normalized = serializer._token_ranges(0, 0)
        self.assertEqual([p['utf16_range'] for p in parts], [[3, 8], [9, 11]])
        self.assertEqual([p['codepoint_range'] for p in normalized['parts']], [[2, 7], [8, 10]])
    def test_cache_hits_do_not_supply_or_mutate_report_endpoints(self):
        first = R.whole_vocabulary_pairs(self.lines, self.phon, schemas=['perfect rhyme'])
        again = R.whole_vocabulary_pairs(self.lines, self.phon, schemas=['perfect rhyme'])
        self.assertEqual(first, again)
        before = copy.deepcopy(R._WVP_MEMO)
        a = self.report(schemas=['perfect rhyme'])
        b = self.report(schemas=['perfect rhyme'])
        self.assertEqual(a, b)
        self.assertEqual(before, R._WVP_MEMO)
        with patch.object(R, 'whole_vocabulary_pairs', side_effect=AssertionError('name cache used')):
            self.assertEqual(a, self.report(schemas=['perfect rhyme']))
    def test_no_candidate_cap_and_the_time_guard_names_what_it_did_not_count(self):
        # 2026-10-27 (end-of-day plan, #519): no type is capped by candidate
        # count; a count that runs out of time names every type it did not
        # reach and says the coverage is incomplete.
        full = self.report()
        self.assertIsNone(full["limits"]["candidates_per_schema"])
        self.assertFalse([m for m in full["coverage"]["methods"]
                          if m.get("reason") == "candidate_limit"])
        ticks = iter([0.0, 0.0] + [10.0] * 1000)
        cut = self.report(time_budget_s=5, clock=lambda: next(ticks))
        methods = cut["coverage"]["methods"]
        self.assertEqual(methods[0]["status"], "answered")
        self.assertTrue(methods[1:])
        self.assertTrue(all(m["status"] == "partial" and m["reason"] == "time_budget"
                            for m in methods[1:]))
        self.assertEqual(cut["coverage"]["status"], "partial")
        self.assertIsNone(cut["coverage"]["total_records"])
        self.assertEqual(cut["limits"]["count_time_budget_s"], 5)
    def test_limits_are_honest(self):
        got = self.report(max_records=0)
        self.assertFalse(got['coverage']['complete'])
        self.assertGreater(got['coverage']['omitted_records'], 0)
        self.assertEqual(got['records'], [])
        limited = self.report(max_candidates=0)
        self.assertFalse(limited['coverage']['complete'])
        self.assertTrue(limited['coverage']['remaining_records_unknown'])
        self.assertIsNone(limited['coverage']['total_records'])
        tiny = self.report(max_bytes=2048)
        self.assertLessEqual(len(canonical_json(tiny).encode()), 2048)
        self.assertFalse(tiny['coverage']['complete'])
    def test_refused_and_unrequested_populations_never_claim_known_zero(self):
        got = self.report()
        self.assertTrue(any(m['status'] == 'refused' for m in got['coverage']['methods']))
        self.assertIsNone(got['coverage']['total_records'])
        self.assertGreater(got['coverage']['observed_records'], 0)
        empty = self.report(schemas=[])
        self.assertEqual(empty['coverage']['status'], 'not_requested')
        self.assertFalse(empty['coverage']['complete'])

    def test_identity_changes_with_text_and_reading_declaration(self):
        a = self.report(schemas=['perfect rhyme'])
        b = from_stream(self.stream, self.phon, declarations={'voices': False},
                        provenance={'reader_scheme': 'v2'}, schemas=['perfect rhyme'])
        self.assertNotEqual(a['identity']['hash'], b['identity']['hash'])
        self.stream = R.build_stream(['cat cat bat', 'hat'], self.phon, declaration={'language': 'eng'})
        self.assertNotEqual(a['identity']['hash'], self.report(schemas=['perfect rhyme'])['identity']['hash'])
    def assert_reference_bytes(self, **kwargs):
        # The pre-optimization check serialized the whole growing result for
        # every candidate. Keep that independent oracle, not a second copy of
        # the arithmetic being tested. All other enumeration behavior is shared.
        def previous_size(result, _record_bytes):
            return len(canonical_json(result).encode("utf-8"))
        with patch.object(E, '_report_bytes', side_effect=previous_size):
            expected = self.report(**kwargs)
        measured = []
        optimized_size = E._report_bytes
        def checked_size(result, record_bytes):
            got = optimized_size(result, record_bytes)
            self.assertEqual(got, previous_size(result, None))
            measured.append(got)
            return got
        with patch.object(E, '_report_bytes', side_effect=checked_size):
            actual = self.report(**kwargs)
        self.assertEqual(canonical_json(actual).encode("utf-8"),
                         canonical_json(expected).encode("utf-8"))
        return actual, measured

    def test_byte_accounting_matches_previous_full_serialization(self):
        self.stream = R.build_stream(['😀 cat “bat” cat', 'hat café'], self.phon,
                                     declaration={'language': 'eng'})
        # Real registry instances, refused methods, and candidate exhaustion.
        for limits in ({}, {'max_records': 0}, {'max_records': 1},
                       {'max_records': 2}, {'max_candidates': 0},
                       {'max_candidates': 1}, {'max_bytes': 1024}, {'max_bytes': 2048},
                       {'max_bytes': 36000}, {'schemas': []}):
            with self.subTest(limits=limits):
                self.assert_reference_bytes(**limits)
        # Find exact admission boundaries using the old full-serialization
        # oracle. The limit itself is serialized, so don't assume its digit width.
        for count in (1, 2):
            low, high = 32768, 262144
            while low < high:
                mid = (low + high) // 2
                with patch.object(E, '_report_bytes', side_effect=lambda r, _: len(canonical_json(r).encode('utf-8'))):
                    report = self.report(schemas=['internal rhyme'], max_records=count, max_bytes=mid)
                if len(report['records']) >= count:
                    high = mid
                else:
                    low = mid + 1
            for budget in (low - 1, low, low + 1):
                got, measured = self.assert_reference_bytes(
                    schemas=['internal rhyme'], max_records=count, max_bytes=budget)
                self.assertTrue(measured)
                self.assertEqual(len(got['records']) >= count, budget >= low)

    def test_rejected_record_bytes_do_not_accumulate(self):
        names = sorted(n for n, schema in R.REGISTRY.items()
                       if R.pair_scope_representable(schema))[:2]
        records = [{'verdict': True, 'text': '😀é"\\' * 5000}]
        records += [{'verdict': True, 'text': f'cat {i}'} for i in range(105)]
        instances = [SimpleNamespace(verdict=True, record=r) for r in records]
        # Reject the large first record, admit later small ones, cross decimal
        # counter boundaries, and update the envelope with a later refusal.
        def realise(schema, *_args, **_kwargs):
            if schema is R.REGISTRY[names[0]]:
                return instances
            return R.Refusal(names[1], 'beat', 'fixture missing beat', missing=('beat',))
        with patch.object(R, 'realise', side_effect=realise), patch.object(
                E._Serializer, '_edge_record', side_effect=lambda inst, _st: copy.deepcopy(inst.record)):
            for budget in (36000, 40000, 262144):
                got, measured = self.assert_reference_bytes(schemas=names, max_bytes=budget)
                self.assertTrue(measured)
                self.assertTrue(got['records'])
                if budget < 262144:
                    self.assertFalse(any(r == records[0] for r in got['records']))
                self.assertEqual(got['coverage']['methods'][-1]['status'], 'refused')
            for limit in (0, 1, 9, 10, 99, 100):
                self.assert_reference_bytes(schemas=names, max_records=limit, max_bytes=40000)
            instances[:1] = [instances[0]] * 105
            got, measured = self.assert_reference_bytes(schemas=names, max_bytes=40000)
            self.assertGreaterEqual(got['coverage']['omitted_records'], 105)
            self.assertTrue(got['records'])
            self.assertGreater(len(measured), 105)

    def test_byte_accounting_does_not_reserialize_admitted_records(self):
        original = E.canonical_json
        full_calls = []
        def tracked(value):
            if isinstance(value, dict) and value.get('records'):
                full_calls.append(len(value['records']))
            return original(value)
        with patch.object(E, 'canonical_json', side_effect=tracked):
            got = self.report(schemas=['internal rhyme'])
        self.assertGreater(len(got['records']), 1)
        self.assertEqual(full_calls, [len(got['records'])],
                         'only the unchanged final full-size guard walks admitted records')

    def test_report_failure_does_not_replace_grade(self):
        with patch('quality.schema_instance_evidence._for_grade', side_effect=ValueError('fixture')):
            got = for_grade(None, self.lines, None)
        self.assertEqual(got['coverage']['status'], 'unavailable')
        self.assertFalse(got['coverage']['complete'])
        self.assertNotIn('hash', got['identity'])

    def test_report_rebuild_uses_grade_basis_without_checkpoint_mutation(self):
        from quality.schemes import Mandate
        from quality.revise import Brief, SlotField
        from quality.floor import Finding
        before = {c: dataclasses.fields(c) for c in (Brief, SlotField, Finding)}
        mandate = Mandate(n_lines=2, groups=((1, 2),), labels=('A',))
        from quality.loop import _menu_encode, _menu_decode
        finding = Finding('FIXTURE', 'note', 'fixture', 'fixture', [1])
        brief = Brief(1, self.lines[0], findings=[finding])
        field = SlotField(None, ('A',), ('hat',), 'cat', [], [], False, False)
        checkpoint = {'menus': [brief, field], 'draft': self.lines[:]}
        original = json.dumps(_menu_encode(checkpoint), sort_keys=True)
        rv = SimpleNamespace(_relation_phonology=lambda: self.phon, decl=LH.Declaration())
        got = for_grade(rv, self.lines, mandate, provenance={'reader_scheme': 'v2'})
        self.assertTrue(got['records'])
        self.assertEqual(original, json.dumps(_menu_encode(checkpoint), sort_keys=True))
        self.assertEqual(original, json.dumps(_menu_encode(_menu_decode(json.loads(original))), sort_keys=True))
        self.assertEqual(before, {c: dataclasses.fields(c) for c in before})


if __name__ == '__main__':
    unittest.main()
