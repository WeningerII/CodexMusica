"""Connection-view prerequisites at the existing Library evidence boundary.

Small authored fixtures only; no UI, writer-route substitute, or corpus run.
These regressions protect identity, native binding and durable replay. They do
not certify the proposed domain/search manifest, which needs its own producer
tests once implemented. Run from lyric-harness:
    python3 -m unittest library.test_connection_acceptance -v
"""
import copy
import json
import unittest

from library.analysis import AnalysisSession, run_step
from library.contracts import canonical_json, method_id
from library.test_analysis import complete, source


class ConnectionAcceptance(unittest.TestCase):
    def assert_references(self, records):
        tokens = {r["token_id"]: r for r in records if r["kind"] == "token"}
        units = {r["unit_id"]: r for r in records if r["kind"] == "syllable"}
        self.assertEqual(len(tokens), sum(r["kind"] == "token" for r in records))
        for edge in (r for r in records if r["kind"] == "relation_instance"):
            for role in ("a", "b"):
                member = edge[role]
                self.assertTrue(member["token_ids"])
                for token_id in member["token_ids"]:
                    self.assertIn(token_id, tokens)
                    self.assertIn(tokens[token_id]["line_id"], member["line_ids"])
                for unit_id in member["unit_ids"]:
                    self.assertIn(unit_id, units)
                    self.assertIn(units[unit_id]["token_id"], member["token_ids"])

    def test_duplicate_spellings_bind_to_separate_source_occurrences(self):
        text = "cat cat bat\ncat bat cat"
        _, records, _ = complete(source(text), schemas=["internal rhyme"])
        cats = [r for r in records if r["kind"] == "token" and r["text"] == "cat"]
        self.assertEqual(len(cats), 4)
        self.assertEqual(len({r["token_id"] for r in cats}), 4)
        self.assertEqual({tuple(r["normalized_range"]["codepoint_range"]) for r in cats},
                         {(0, 3), (4, 7), (12, 15), (20, 23)})
        # Two identically spelled words on the same line each bind to bat.
        bindings = {(tuple(r["a"]["token_ids"]), tuple(r["b"]["token_ids"]))
                    for r in records if r["kind"] == "relation_instance"}
        self.assertIn((("line:0:token:0",), ("line:0:token:2",)), bindings)
        self.assertIn((("line:0:token:1",), ("line:0:token:2",)), bindings)
        self.assert_references(records)

    def test_function_words_participate_without_cross_line_alliteration(self):
        _, records, _ = complete(source("we will\nwe will"), schemas=["alliteration"])
        edges = [r for r in records if r["kind"] == "relation_instance"]
        self.assertEqual(len(edges), 2)
        self.assertEqual({(tuple(r["a"]["token_ids"]), tuple(r["b"]["token_ids"]))
                          for r in edges}, {
            (("line:0:token:0",), ("line:0:token:1",)),
            (("line:1:token:0",), ("line:1:token:1",)),
        })
        for edge in edges:
            self.assertEqual(edge["verdict"], "true")
            self.assertEqual(edge["a"]["line_ids"], edge["b"]["line_ids"])
        self.assert_references(records)

    def test_cross_rhyme_keeps_final_to_interior_role_order(self):
        _, records, _ = complete(source("cat cat bat\ncat bat cat"), schemas=["cross rhyme"])
        edges = [r for r in records if r["kind"] == "relation_instance" and r["verdict"] == "true"]
        self.assertTrue(edges)
        for edge in edges:
            self.assertEqual(edge["a"]["token_ids"], ["line:0:token:2"])
            self.assertEqual(edge["b"]["token_ids"], ["line:1:token:0"])
            self.assertEqual(edge["a"]["origin"], "L0.final")
            self.assertEqual(edge["b"]["origin"], "L1.T0")
            self.assertIn(["a_line_final", True], edge["placement_reads"])
        self.assert_references(records)

    def test_phrasal_members_remain_ordered_spans_not_token_pair_cliques(self):
        text = "cat bat\nhat mat"
        _, records, _ = complete(source(text), schemas=["compound / phrasal rhyme"])
        edges = [r for r in records if r["kind"] == "relation_instance"]
        self.assertEqual(len(edges), 1)
        edge = edges[0]
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["a"]["token_ids"], ["line:0:token:0", "line:0:token:1"])
        self.assertEqual(edge["b"]["token_ids"], ["line:1:token:0", "line:1:token:1"])
        for role, words in (("a", ["cat", "bat"]), ("b", ["hat", "mat"])):
            ranges = edge[role]["normalized_ranges"]
            self.assertEqual([text[r["codepoint_range"][0]:r["codepoint_range"][1]] for r in ranges], words)
        self.assert_references(records)

    def test_semantic_changes_reject_checkpoint_even_when_tokens_look_identical(self):
        reading = source("cat\nhat")
        request = {"layers": ["sound"], "schemas": ["perfect rhyme"]}
        session = AnalysisSession(reading, requested=request)
        checkpoint = session.step(1)["checkpoint"]
        cases = []
        for field, value in (("reading_revision", "fixture-v2"),
                             ("reading_unit_id", "another-reading"),
                             ("source_sha256", "a" * 64),
                             ("source_map", {"edition": "another-source-map"})):
            changed = {**reading, field: value}
            cases.append((field, changed, request, None))
        cases.append(("requested methods", reading,
                      {"layers": ["sound"], "schemas": ["alliteration"]}, None))
        cases.append(("declared frame", reading, request,
                      {"sound": {"caesura": {"positions": {}, "source": "authored fixture"}}}))
        for label, changed, requested, declaration in cases:
            with self.subTest(change=label):
                with self.assertRaisesRegex(ValueError, "STALE_READING"):
                    AnalysisSession(changed, declaration, requested, checkpoint)
        # The exact question remains resumable; a stale-link check must bind
        # to semantic identity, not merely to line:N:token:M strings.
        resumed = AnalysisSession(reading, requested=request, checkpoint=checkpoint)
        self.assertEqual(resumed.identity["hash"], session.identity["hash"])

    def test_public_step_replays_serialized_commits_without_losing_bindings(self):
        reading = source("we will\ncat cat bat\ncat bat cat")
        schemas = ["alliteration", "internal rhyme", "cross rhyme"]
        _, expected, full = complete(reading, schemas=schemas)
        request = {"layers": ["sound"], "schemas": schemas}
        committed, checkpoint = [], None
        partial_seen = False
        for _ in range(300):
            result = run_step(reading, requested=request, checkpoint=checkpoint,
                              budget_candidates=1, max_bytes=65536,
                              load_records=lambda mid: (r for r in committed if r.get("method_id") == mid))
            self.assertEqual(result["provider_calls"], 0)
            self.assertLessEqual(sum(len(canonical_json(r).encode()) for r in result["records"]), 65536)
            committed.extend(json.loads(json.dumps(result["records"])))
            checkpoint = json.loads(json.dumps(result["checkpoint"]))
            self.assertEqual(checkpoint["sequence"], len(committed))
            if result["done"]:
                break
            partial_seen = True
            self.assertTrue(result["summary"]["coverage"]["partial"])
            self.assertFalse(result["summary"]["coverage"]["certified"])
        else:
            self.fail("small authored fixture did not finish in 300 batches")
        self.assertTrue(partial_seen)
        self.assertEqual(canonical_json(committed), canonical_json(expected))
        self.assertEqual(result["summary"], full["summary"])
        self.assertEqual(len(committed), len({r["id"] for r in committed}))
        self.assert_references(committed)

    def test_uncommitted_step_can_be_replayed_from_last_durable_checkpoint(self):
        reading = source("we will\ncat cold")
        request = {"layers": ["sound"], "schemas": ["alliteration"]}
        first = run_step(reading, requested=request, budget_candidates=1)
        durable = copy.deepcopy(first["checkpoint"])
        def next_step():
            return run_step(reading, requested=request, checkpoint=copy.deepcopy(durable),
                            budget_candidates=1,
                            load_records=lambda mid: (r for r in first["records"] if r.get("method_id") == mid))
        lost, retried = next_step(), next_step()
        self.assertTrue(lost["records"])
        self.assertEqual(canonical_json(lost), canonical_json(retried))
        self.assertEqual(durable, first["checkpoint"])

    def test_refused_method_does_not_become_a_false_pair_result(self):
        name = "cynghanedd groes"
        _, rows, result = complete(source("cat bat\nhat mat"), schemas=[name])
        method_rows = [r for r in rows if r.get("method_id") == method_id("schema", name)]
        terminal = next(r for r in method_rows if r["kind"] == "method_result")
        self.assertEqual(terminal["coverage"], "refused")
        self.assertEqual(terminal["verdict"], "undecided")
        self.assertIn("caesura", terminal["refusal"]["missing"])
        self.assertFalse(any(r.get("verdict") == "false" for r in method_rows))
        self.assertTrue(result["done"])
        self.assertFalse(result["summary"]["coverage"]["certified"])
        self.assertIn(method_id("schema", name), result["summary"]["coverage"]["refused_obligations"])


if __name__ == "__main__":
    unittest.main()
