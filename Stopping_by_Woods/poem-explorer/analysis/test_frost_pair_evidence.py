"""Bounded phonetic regressions for the poem adapter; no corpus run."""
import contextlib
import sys
import unittest
from unittest import mock

import run_frost_pairs as adapter

sys.path.insert(0, str(adapter.HARNESS))
import lyric_harness as LH
from quality import relations as R
from quality.phonology.eng import English, _reading_scope


class ConsonantEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.phon = English(
            readings="all", lexicon=LH.Lexicon(reader_scheme="v2"), reader_scheme="v2"
        )

    def examine(self, a, b, k, *, empty_first=False):
        schema = R.REGISTRY[adapter.SCHEMA_BY_ID[k]]

        def build(phon):
            stream = R.build_stream([a, b], phon)
            R.declare_orthography(stream, LH.spelled_rime)
            return stream

        original_combos = R.reading_combos

        def reversed_combos(*args, **kwargs):
            combos, complete = original_combos(*args, **kwargs)
            return (list(reversed(combos)) if combos else combos), complete

        ordering = (mock.patch.object(R, "reading_combos", reversed_combos)
                    if empty_first else contextlib.nullcontext())
        with _reading_scope(), R._line_read_scope(), ordering:
            stream = build(self.phon)
            builder = R.cached_builder(build)
            native, native_witness = R.pair_satisfies_any(
                schema, stream, (0, 0), (1, 0), builder
            )
            support, witness = native, native_witness
            if native is True and k in adapter.CONSONANT_EVIDENCE_CHANNELS:
                support, witness = adapter.consonant_support_any(
                    R, k, schema, stream, (0, 0), (1, 0), builder
                )
            return native, support, native_witness, witness, stream.unreadable

    def test_excluded_village_syllable_is_not_evidence(self):
        native, support, *_ = self.examine("are", "village", 5)
        self.assertIs(native, True)
        self.assertIs(support, False)

    def test_vowel_overlap_survives_empty_consonance(self):
        for k in (4, 11, 15):
            with self.subTest(category=k):
                self.assertIs(self.examine("village", "to", k)[1], True)
        self.assertIs(self.examine("village", "to", 5)[1], False)

    def test_difference_and_identity_are_not_matching_sound_evidence(self):
        for k in (5, 7, 9):
            with self.subTest(category=k):
                native, support, *_ = self.examine("I", "are", k)
                self.assertIs(native, True)
                self.assertIs(support, False)

    def test_pararhyme_needs_one_positive_consonant_channel(self):
        for a, b in (("at", "it"), ("bay", "bee")):
            with self.subTest(pair=(a, b)):
                self.assertIs(self.examine(a, b, 7)[1], True)
        for k in (5, 7, 9):
            with self.subTest(pair=("whose", "his"), category=k):
                self.assertIs(self.examine("whose", "his", k)[1], True)

    def test_positive_alternative_replaces_first_empty_witness(self):
        native, support, first, positive, _ = self.examine(
            "are", "or", 5, empty_first=True
        )
        self.assertIs(native, True)
        self.assertIs(support, True)
        self.assertEqual(first, ["are = ER0", "or = ER0"])
        self.assertEqual(positive, ["are = AA1 R", "or = AO1 R"])

    def test_open_syllable_rhymes_retain_their_supported_categories(self):
        for a, b in (("see", "free"), ("see", "me"), ("know", "snow")):
            for k in (1, 4, 11):
                with self.subTest(pair=(a, b), category=k):
                    self.assertIs(self.examine(a, b, k)[1], True)
            self.assertIs(self.examine(a, b, 5)[1], False)
        for k in (2, 8):
            with self.subTest(pair=("I", "eye"), category=k):
                self.assertIs(self.examine("I", "eye", k)[1], True)

    def test_structural_and_extension_relations_keep_open_channels(self):
        for a, b, k in (("grow", "growing", 14), ("growing", "grow", 15),
                        ("see", "seed", 12), ("seed", "see", 13)):
            with self.subTest(pair=(a, b), category=k):
                self.assertIs(self.examine(a, b, k)[1], True)

    def test_syllable_dispute_is_resolved_in_complete_readings(self):
        native, support, _, witness, unreadable = self.examine("miles", "bells", 5)
        self.assertTrue(unreadable)
        self.assertIs(native, True)
        self.assertIs(support, True)
        self.assertIn("miles = M AY1 L Z", witness)
        for word in ("miles", "sleep"):
            self.assertIs(self.examine(word, word, 3)[1], True)

    def test_incomplete_negative_search_is_not_absence(self):
        with _reading_scope():
            stream = R.build_stream(["are", "village"], self.phon)
            schema = R.REGISTRY["consonance"]
            with mock.patch.object(R, "reading_combos", return_value=([], False)):
                support, _ = adapter.consonant_support_any(
                    R, 5, schema, stream, (0, 0), (1, 0),
                    lambda p: R.build_stream(["are", "village"], p)
                )
            self.assertIsNone(support)


if __name__ == "__main__":
    unittest.main()
