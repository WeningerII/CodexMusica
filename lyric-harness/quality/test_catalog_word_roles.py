"""Exercise the catalog grade with isolated lexical and numerical fixtures."""
import unittest
from unittest.mock import Mock, patch

import lyric_harness as lh
from quality.catalog_grading import inspect_catalog
from quality.catalog_word_roles import measure_word_roles, _noun_relation, _pos_reading
from quality.schemes import Mandate


class WordRoles(unittest.TestCase):
    def test_missing_reader_resources_and_tokens_stay_unknown(self):
        result = {"id": "diamante", "checks": [
            {"kind": "role", "expected": "noun", "lines": [1], "outcome": "unknown"},
            {"kind": "role", "expected": "ing-verbs", "lines": [2], "outcome": "unknown"},
            {"kind": "role", "expected": "synonym", "lines": [3], "outcome": "unknown"},
        ]}
        for row in list(result["checks"]):
            row["address"] = str(row["lines"][0])
            result["checks"].append({"kind": "word-count", "outcome": "pass", "address": row["address"]})
        with patch("quality.catalog_word_roles._tagger", side_effect=LookupError), \
             patch("quality.catalog_word_roles._wordnet", return_value=None):
            measure_word_roles(result, [{"sungWords": ["x"]}, {"sungWords": None}, {"sungWords": ["y"]}])
        self.assertEqual([r["outcome"] for r in result["checks"] if r["kind"] == "role"], ["unknown"] * 3)
        self.assertEqual(result["verdict"], "unknown")

    def test_phrase_needs_one_unbroken_grammatical_unit(self):
        lex = lh.Lexicon()
        lex.catalog_selection = {"id": "gogyohka", "variant": 0, "counts": {}}
        lines = ["the large red integer"] * 5

        def read():
            return inspect_catalog(lex, lines, None, Mandate(n_lines=5), {})

        self.assertEqual(read()["verdict"], "pass")
        for wrong in ("the large. red integer", "one two three four", "the / large red integer"):
            with self.subTest(wrong=wrong):
                lines[2] = wrong
                checked = read()
                self.assertEqual(checked["verdict"], "unknown")
                self.assertTrue(any(c.get("lines") == [3] and c["outcome"] == "unknown"
                                    and c["kind"] == "unit" for c in checked["checks"]))

    def test_alternative_tag_in_a_fragment_keeps_the_reading_open(self):
        with patch("quality.catalog_word_roles._tagger", return_value=lambda words: [(word, "NN") for word in words]):
            observed = _pos_reading(["x"], "adjectives")
        self.assertEqual(observed["outcome"], "unknown")
        self.assertEqual(observed["tags"], ["NN"])

    def test_tagger_guesses_require_a_lexical_witness_and_inflections_stay_eligible(self):
        for token, role, tag in (("qzvxx", "noun", "NN"), ("qzvxxing", "ing-verbs", "VBG")):
            with self.subTest(token=token):
                reading = _pos_reading([token], role)
                self.assertEqual(reading["tags"], [tag])
                self.assertEqual(reading["outcome"], "unknown")
        for token, role in (("integers", "noun"), ("larger", "adjectives"), ("computing", "ing-verbs")):
            with self.subTest(token=token):
                self.assertEqual(_pos_reading([token], role)["outcome"], "pass")

    def test_homographs_keep_each_synset_and_antonym_sense_key(self):
        class Lemma(str):
            # The reader's lemma objects compare equal by spelling.
            def __new__(cls, spelling, synset_id, sense_key):
                item = super().__new__(cls, spelling)
                item.synset = lambda: synset_id
                item.key = lambda: sense_key
                item.antonyms = lambda: []
                return item

        first = Lemma("x", 1, "x1")
        unrelated = Lemma("y", 2, "y2")
        related = Lemma("y", 1, "y1")
        wn = Mock(NOUN="n")
        wn.lemmas.side_effect = lambda word, pos: {"x": [first], "y": [unrelated, related]}[word]
        with patch("quality.catalog_word_roles._wordnet", return_value=wn):
            self.assertEqual(_noun_relation("x", "y", "synonym")["outcome"], "pass")
            first.antonyms = lambda: [Lemma("y", 3, "y3")]
            self.assertEqual(_noun_relation("x", "y", "antonym")["outcome"], "unknown")
            first.antonyms = lambda: [Lemma("y", 1, "y1")]
            self.assertEqual(_noun_relation("x", "y", "antonym")["outcome"], "pass")

    def test_pos_and_lexical_observations_are_measured_for_each_selection(self):
        adjectives = ["positive", "negative"]
        verbs = ["computing", "multiplying", "dividing"]
        middle = ["one", "two", "three", "four"]
        cases = [
            ("didactic-cinquain", 0, "sum", "total", "synonym"),
            ("diamante", 0, "sum", "total", "synonym"),
            ("diamante", 1, "addition", "subtraction", "antonym"),
        ]
        lex = lh.Lexicon()
        for source, variant, first, last, relation in cases:
            with self.subTest(source=source, variant=variant):
                lex.catalog_selection = {"id": source, "variant": variant, "counts": {}}
                units = [[first], adjectives, verbs, middle]
                if source == "diamante":
                    units.extend([verbs, adjectives])
                units.append([last])
                lines = [" ".join(unit) for unit in units]

                def read():
                    return inspect_catalog(lex, lines, None, Mandate(n_lines=len(lines)), {})

                checked = read()
                roles = [r for r in checked["checks"] if r["kind"] == "role"]
                for r in roles:
                    self.assertEqual(r["outcome"], "unknown" if "phrase" in r["expected"] else "pass", r)
                selected = next(r for r in roles if r["expected"] == relation)
                self.assertEqual(selected["comparedLines"], [1, len(lines)])
                self.assertEqual(checked["verdict"], "unknown")
                if source == "didactic-cinquain":
                    lines[3] = "the large red integer"
                    verified = read()
                    self.assertEqual(verified["verdict"], "pass", verified["checks"])
                    lines[3] = "one two three four"
                    self.assertEqual(read()["verdict"], "unknown")
                if source == "diamante":
                    lines[3] = ("sum amount total amount" if relation == "synonym"
                                else "addition addition deduction subtraction")
                    verified = read()
                    self.assertEqual(verified["verdict"], "pass", verified["checks"])
                    lines[3] = "subtraction deduction addition addition"
                    self.assertEqual(read()["verdict"], "unknown")
                lines[2] = " ".join(["four"] * 3)
                lines[-1] = first
                broken = read()
                self.assertEqual(broken["verdict"], "fail")
                fails = {r.get("expected") for r in broken["checks"] if r["kind"] == "role" and r["outcome"] == "fail"}
                self.assertEqual(fails, {"ing-verbs", "synonym"} if relation == "synonym" else {"ing-verbs"})
                if relation == "antonym":
                    endpoint = next(r for r in broken["checks"] if r.get("expected") == relation)
                    self.assertEqual(endpoint["outcome"], "unknown")
