"""Exceptional rebuild fault injection; separate from unchanged acceptance tests."""
import json
import unittest
from unittest.mock import patch
from library.test_analysis import complete, source, _with_words


class RebuildFailureSearch(unittest.TestCase):
    def test_failed_rebuild_is_not_a_judged_reading(self):
        for first, second, expected in (
            (["Z", "IY1"], ["Z", "AH0"], None),
            (["Z", "AH0"], ["Z", "IY1"], True),
        ):
            with self.subTest(second_verdict=expected):
                with _with_words({"zee": [first, second]}):
                    session, _, _ = complete(source("zee is home\nand bee is too"),
                                              schemas=["internal rhyme"])
                    schema = session.RL.REGISTRY["internal rhyme"]
                    def member(rule, token):
                        return next(s for s in session.RL.enumerate_spans(rule, session.stream)
                                    if session._span(s)["token_ids"] == [token])
                    a = member(schema.spans[0], "line:0:token:0")
                    b = member(schema.spans[1], "line:1:token:1")
                    original = session._line_stream
                    calls = []
                    def rebuild(lines, combo):
                        calls.append(combo)
                        return None if len(calls) == 1 else original(lines, combo)
                    with patch.object(session, "_line_stream", side_effect=rebuild):
                        inst, _, witness, _, search = session._any_reading(
                            "internal rhyme", a, b, session.stream)
                print(json.dumps({"expected_verdict": expected, "verdict": inst.verdict,
                                  "rebuild_calls": len(calls), "search": search,
                                  "witness": witness}), flush=True)
                self.assertEqual(len(calls), 2)
                self.assertIs(inst.verdict, expected)
                self.assertIn(search["state"], ("partial", "unavailable"),
                              "a failed rebuild cannot count as a judged reading")


if __name__ == "__main__":
    unittest.main(verbosity=2)
