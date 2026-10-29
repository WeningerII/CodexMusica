#!/usr/bin/env python3
"""Focused semantic controls for the poem's English schema declarations.

Run from any directory. FROST_ANALYSIS_ROOT may locate the pinned checkout.
No corpus run, source mutation, network, or viewer build is performed.
"""
from __future__ import annotations

import copy
import json
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ANALYSIS = Path(os.environ.get("FROST_ANALYSIS_ROOT", HERE))
sys.path.insert(0, str(ANALYSIS / "CodexMusica" / "lyric-harness"))
sys.path.insert(0, str(HERE))

import lyric_harness as LH
from quality import relations as R
from quality.phonology import Syllable
from quality.phonology.eng import English, _reading_scope
from quality.quotients import ENG_QUOTIENTS
import english_schema_contracts as C


class ExactPhones:
    """Explicit phones isolate a schema from dictionary/pronunciation policy."""

    language = "eng"
    quotients = ENG_QUOTIENTS

    def __init__(self, mapping):
        self.mapping = mapping

    def syllabify(self, word):
        rows = self.mapping[word.lower()]
        if isinstance(rows, str):
            rows = [Syllable(word, tuple(s["onset"]), s["nucleus"],
                             tuple(s["coda"]), int(s["stress"] in (1, 2)))
                    for s in LH.syllabify(rows.split())]
        return [copy.copy(row) for row in rows]


def fixed_stream(a, b, phones_a, phones_b):
    return R.build_stream([a, b], ExactPhones({a.lower(): phones_a, b.lower(): phones_b}))


class SchemaContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemas = C.audited_schemas()
        cls.lexicon = LH.Lexicon(reader_scheme="v2")
        cls.phon = English(readings="all", lexicon=cls.lexicon, reader_scheme="v2")

    def answer(self, number, a, b, phones_a=None, phones_b=None, native=False):
        schema = (R.REGISTRY[C.SCHEMA_BY_ID[number]] if native else self.schemas[number])
        if phones_a is not None:
            stream = fixed_stream(a, b, phones_a, phones_b)
            return R.pair_satisfies(schema, stream, (0, 0), (1, 0))
        lines = [a, b]
        def build(reader):
            stream = R.build_stream(lines, reader)
            R.declare_orthography(stream, LH.spelled_rime)
            return stream
        with _reading_scope():
            stream = build(self.phon)
            return R.pair_satisfies_any(schema, stream, (0, 0), (1, 0), build)[0]

    def test_native_registry_is_unchanged_and_copies_are_fresh(self):
        second = C.audited_schemas()
        self.assertEqual(len(second), 20)
        self.assertEqual(set(C.AUDIT), {f"E{n}" for n in range(1, 23)})
        json.dumps({"corrections": C.CORRECTIONS, "audit": C.AUDIT})
        for number, schema in second.items():
            native = R.REGISTRY[C.SCHEMA_BY_ID[number]]
            self.assertIsNot(schema, native)
            self.assertIsNot(schema, self.schemas[number])
            if f"E{number}" not in C.CORRECTIONS:
                self.assertEqual(schema, native)
        self.assertEqual(R.REGISTRY["pararhyme"].unmatched, "exclude")
        self.assertEqual(R.REGISTRY["syllabic rhyme"].spans[0], R.END_UNSTRESSED)
        self.assertEqual(R.REGISTRY["amphisbaenic rhyme"].spans[1].direction, -1)

    def test_prominence_requirement_preserves_uncertainty(self):
        pred = C.BothProminentValue(1)
        self.assertIs(pred(1, 1).value, True)
        self.assertIs(pred(0, 0).value, False)
        self.assertIs(pred(frozenset({0, 1}), 1).value, None)
        self.assertIs(pred(frozenset({0, 1}), 0).value, False)
        self.assertIs(pred(None, 1).value, None)

    def test_e1_weak_the_to_is_not_perfect(self):
        self.assertIs(self.answer(1, "the", "To", "DH AH0", "T AH0", native=True), True)
        self.assertIs(self.answer(1, "the", "To", "DH AH0", "T AH0"), False)
        self.assertIs(self.answer(1, "the", "To"), False)
        self.assertIs(self.answer(1, "know", "snow"), True)
        self.assertIs(self.answer(1, "deep", "keep"), True)

    def test_any_reading_continues_after_rejected_weak_witness(self):
        # Reorder attested alternatives so the misleading weak/weak witness
        # occurs first. No pronunciation is invented and the shared lexicon
        # is not modified.
        lex = copy.copy(self.lexicon)
        lex.entries = dict(self.lexicon.entries)
        for word in ("an", "than"):
            lex.entries[word] = sorted(lex.entries[word],
                                      key=lambda p: not any(ph.endswith("0") for ph in p))
        phon = English(readings="all", lexicon=lex, reader_scheme="v2")
        lines = ["an", "than"]
        def build(reader):
            return R.build_stream(lines, reader)
        stream = build(phon)
        combos, complete = R.reading_combos(stream, {(0, 0), (1, 0)})
        self.assertTrue(complete)
        first = build(R.pinned_phonology(stream, combos[0]))
        self.assertIs(R.pair_satisfies(R.REGISTRY["perfect rhyme"], first, (0, 0), (1, 0)), True)
        self.assertIs(R.pair_satisfies(self.schemas[1], first, (0, 0), (1, 0)), False)
        result, witness = R.pair_satisfies_any(self.schemas[1], stream, (0, 0), (1, 0), build)
        self.assertIs(result, True)
        self.assertEqual(witness, ["an = AE1 N", "than = DH AE1 N"])

    def test_e7_requires_both_complete_tails(self):
        for a, b in (("in", "only"), ("here", "harness"), ("evening", "of")):
            with self.subTest(a=a, b=b):
                self.assertIs(self.answer(7, a, b, native=True), True)
                self.assertIs(self.answer(7, a, b), False)
        self.assertIs(self.answer(7, "woods", "words"), True)
        self.assertIs(self.answer(7, "bad", "bed"), True)

    def test_e11_complete_family_tails_and_overlap(self):
        self.assertIs(self.answer(11, "To", "village", native=True), True)
        self.assertIs(self.answer(11, "To", "village"), False)
        self.assertIs(self.answer(11, "lemon", "lesson", native=True), True)
        self.assertIs(self.answer(11, "lemon", "lesson"), False)
        self.assertIs(self.answer(11, "caddy", "happy"), True)
        self.assertIs(self.answer(11, "cat", "cap"), True)
        self.assertIs(self.answer(11, "know", "snow"), True)  # native empty class
        self.assertIs(self.answer(1, "know", "snow"), True)   # independent overlap
        self.assertIs(self.answer(11, "bellow", "yellow"), True)

    def test_e12_e13_are_terminal_segmental_extensions(self):
        for a, b in (("year", "feared"), ("in", "wind"), ("down", "found"),
                     ("rain", "brains"), ("prove", "moved"), ("stow", "hope"),
                     ("see", "seed"), ("farmer", "farmers")):
            with self.subTest(a=a, b=b):
                self.assertIs(self.answer(12, a, b), True)
                self.assertIs(self.answer(13, b, a), True)
                self.assertIs(self.answer(13, a, b), False)
        self.assertIs(self.answer(12, "cat", "hat"), False)
        self.assertIs(self.answer(12, "cat", "cab"), False)
        self.assertIs(self.answer(12, "He", "evening", native=True), True)
        self.assertIs(self.answer(12, "He", "evening"), False)
        self.assertIs(self.answer(13, "evening", "He"), False)
        self.assertIs(self.answer(12, "know", "only"), False)

    def test_extension_checks_pre_final_consonants_and_all_vowels(self):
        a = [Syllable("a", ("K",), "AE", ("N",), 1),
             Syllable("a", ("D",), "IY", (), 0)]
        good = [Syllable("b", ("B",), "AE", ("N",), 1),
                Syllable("b", ("D",), "IY", ("Z",), 0)]
        bad = [Syllable("b", ("B",), "AE", ("M",), 1), good[1]]
        self.assertIs(self.answer(12, "alpha", "beta", a, good), True)
        self.assertIs(self.answer(12, "alpha", "beta", a, bad), False)
        pred = C.TerminalConsonantExtension(1)
        self.assertIs(pred(("S", "IY"), ("S", "IY", "D", "IH", "NG")).value, False)
        self.assertIs(pred(("K", "AX"), ("B", "AH", "D")).value, False)
        self.assertIs(pred(("K", "AX"), ("B", "AX", "D")).value, True)

    def test_e14_e15_prefix_direction_follows_shorter_word(self):
        self.assertIs(self.answer(14, "sound's", "downy", native=True), True)
        self.assertIs(self.answer(14, "sound's", "downy"), False)
        self.assertIs(self.answer(15, "downy", "sound's"), False)
        for a, b in (("bend", "ending"), ("hum", "humble"),
                     ("grow", "growing"), ("drum", "stomach")):
            with self.subTest(a=a, b=b):
                self.assertIs(self.answer(14, a, b), True)
                self.assertIs(self.answer(15, b, a), True)
                self.assertIs(self.answer(14, b, a), False)
        self.assertIs(C.ShorterWordClusterPrefix(0)(("N", "D", "Z"), ("N",)).value, False)
        self.assertIs(C.ShorterWordClusterPrefix(0)((), ()).value, True)
        self.assertIs(C.ShorterWordClusterPrefix(0)(frozenset({(), ("N",)}), ("N",)).value, None)

    def test_e18_uses_actual_final_weak_syllables(self):
        for a, b in (("To", "before"), ("To", "mistake"), ("the", "Between")):
            with self.subTest(a=a, b=b):
                self.assertIs(self.answer(18, a, b, native=True), True)
                self.assertIs(self.answer(18, a, b), False)
        self.assertIs(self.answer(18, "the", "To", "DH AH0", "T AH0"), True)
        self.assertIs(self.answer(18, "cleaver", "silver"), True)
        self.assertIs(self.answer(18, "village", "image"), True)
        self.assertIs(self.answer(18, "dog", "bog"), False)

    def test_e19_reverses_the_complete_sequence_once(self):
        self.assertIs(self.answer(19, "step", "pets"), True)
        # Explicit schematic two-syllable words: K AE T | S IY P reverses
        # to P IY S | T AE K. These are phone controls, not invented entries.
        a = [Syllable("a", ("K",), "AE", ("T",), 1),
             Syllable("a", ("S",), "IY", ("P",), 0)]
        reverse = [Syllable("b", ("P",), "IY", ("S",), 1),
                   Syllable("b", ("T",), "AE", ("K",), 0)]
        within_each = list(reversed(reverse))
        self.assertIs(self.answer(19, "alpha", "beta", a, reverse, native=True), False)
        self.assertIs(self.answer(19, "alpha", "beta", a, reverse), True)
        self.assertIs(self.answer(19, "alpha", "beta", a, within_each, native=True), True)
        self.assertIs(self.answer(19, "alpha", "beta", a, within_each), False)

    def test_unchanged_schemas_keep_positive_overlap_and_distinct_scopes(self):
        controls = ((2, "seas", "sees"), (3, "sleep", "sleep"),
                    (4, "know", "frozen"), (4, "deep", "keep"),
                    (5, "woods", "words"), (8, "woods", "would"),
                    (9, "will", "woods"), (16, "sea", "happy"),
                    (20, "good", "food"))
        for number, a, b in controls:
            with self.subTest(number=number, a=a, b=b):
                self.assertIs(self.answer(number, a, b), True)
        for number in (6, 17, 21):
            with self.subTest(number=number):
                self.assertIsInstance(self.answer(number, "cat", "hat"), R.Refusal)


if __name__ == "__main__":
    unittest.main(verbosity=2)
