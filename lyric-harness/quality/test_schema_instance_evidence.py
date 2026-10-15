"""Offline report serialization tests using explicit fixture readings, not CMUdict."""
import copy
import dataclasses
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import lyric_harness as LH
from library.contracts import canonical_json
from quality import relations as R
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
    def test_identity_changes_with_text_and_reading_declaration(self):
        a = self.report(schemas=['perfect rhyme'])
        b = from_stream(self.stream, self.phon, declarations={'voices': False},
                        provenance={'reader_scheme': 'v2'}, schemas=['perfect rhyme'])
        self.assertNotEqual(a['identity']['hash'], b['identity']['hash'])
        self.stream = R.build_stream(['cat cat bat', 'hat'], self.phon, declaration={'language': 'eng'})
        self.assertNotEqual(a['identity']['hash'], self.report(schemas=['perfect rhyme'])['identity']['hash'])
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
