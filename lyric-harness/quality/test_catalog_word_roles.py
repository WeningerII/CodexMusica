"""Exercise the catalog grade with isolated lexical and numerical fixtures."""
import unittest
from unittest.mock import patch

import lyric_harness as lh
from quality.catalog_grading import inspect_catalog
from quality.catalog_word_roles import measure_word_roles, _pos_reading
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

    def test_alternative_tag_in_a_fragment_keeps_the_reading_open(self):
        with patch("quality.catalog_word_roles._tagger", return_value=lambda words: [(word, "NN") for word in words]):
            observed = _pos_reading(["x"], "adjectives")
        self.assertEqual(observed["outcome"], "unknown")
        self.assertEqual(observed["tags"], ["NN"])

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
                lines[2] = " ".join(["four"] * 3)
                lines[-1] = first
                broken = read()
                self.assertEqual(broken["verdict"], "fail")
                fails = {r.get("expected") for r in broken["checks"] if r["kind"] == "role" and r["outcome"] == "fail"}
                self.assertEqual(fails, {"ing-verbs", "synonym"} if relation == "synonym" else {"ing-verbs"})
                if relation == "antonym":
                    endpoint = next(r for r in broken["checks"] if r.get("expected") == relation)
                    self.assertEqual(endpoint["outcome"], "unknown")
