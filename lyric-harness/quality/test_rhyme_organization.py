#!/usr/bin/env python3
"""Exact-orbit, power, refusal, text-path and temporal-consumer regressions."""

import io
import copy
import itertools
import json
import os
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from contextlib import redirect_stdout
from dataclasses import replace
from unittest.mock import patch

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lyric_harness import Lexicon  # noqa: E402
from quality.audit_rhyme_organization import gates, synthetic  # noqa: E402
from quality.rhyme_organization import (OrganizationDeclaration, STRATA,  # noqa: E402
                                        WordGraph, analyze_graph, layout,
                                        main, summarize, tail_p)
from quality.time_layer import TimeDeclaration, analyse  # noqa: E402


class OrganizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lex = Lexicon()

    def test_exact_joint_orbit_error_control(self):
        # Full product of two S4 orbits, 576 layouts, with paired/dependent
        # edges and ties. For each observed layout enumerate the conditional
        # null appropriate to EACH stratum, not an unconditional surrogate.
        a = np.zeros((8, 8), dtype=np.int8)
        for x, y in ((0, 1), (2, 3), (4, 5), (6, 7), (1, 3), (5, 7)):
            a[x, y] = a[y, x] = 1
        pairs, pools = layout([2] * 4, end_window=1)
        perms = {s: list(itertools.permutations(pools[s])) for s in STRATA}
        hits = Counter()
        for interior, finals in itertools.product(perms["internal"], perms["end"]):
            order = np.arange(8)
            order[pools["internal"]] = interior
            order[pools["end"]] = finals
            ps = []
            for s in STRATA:
                def count(o):
                    return sum(a[o[x], o[y]] for x, y in pairs[s])
                obs = count(order)
                null = []
                for perm in perms[s]:
                    draw = order.copy()
                    draw[pools[s]] = perm
                    null.append(count(draw))
                null.remove(obs)  # tail_p supplies the observed permutation
                p = tail_p(obs, null)
                ps.append(p)
                for alpha in (0.05, 0.2, 0.5):
                    hits[s, alpha] += p <= alpha
            for alpha in (0.05, 0.2, 0.5):
                hits["family", alpha] += min(ps) * len(STRATA) <= alpha
        for (scope, alpha), n in hits.items():
            self.assertLessEqual(n / 576, alpha, (scope, alpha, n))
        self.assertGreater(hits["family", 0.5], 0, "exact check must exercise rejection")

    def test_ties_resolution_and_full_family(self):
        self.assertEqual(tail_p(4, [4] * 999), 1)
        self.assertEqual(tail_p(4, [0] * 999), 0.001)
        d = OrganizationDeclaration()
        row = summarize(4, [0] * 975 + [4] * 24, 10, 0, d)
        self.assertEqual(row["p_adjusted"], 0.05)
        self.assertTrue(row["discovery"])
        self.assertEqual(summarize(0, [0] * 999, 10, 0, d)["status"], "cannot_tell")
        a, lengths = synthetic()
        res = analyze_graph(a, lengths, replace(d, n_perm=38))
        self.assertTrue(all("resolution" in r["refusal"] for r in res["strata"].values()))
        # An empty end stratum must not halve the correction on internal.
        res = analyze_graph(a, [sum(lengths)], d)
        self.assertEqual(res["family_size"], 2)
        self.assertEqual(res["strata"]["end"]["status"], "cannot_tell")

    def test_positive_controls_and_reproducibility(self):
        a, lengths = synthetic()
        first = analyze_graph(a, lengths)
        self.assertEqual(first, analyze_graph(a, lengths))
        self.assertTrue(all(r["discovery"] for r in first["strata"].values()))
        self.assertIsNone(first["certified_positions"])
        self.assertIn("unsupported", first["temporal_inference"])
        # Erase rhyme while preserving all line positions. Form cannot fire.
        no_signal = analyze_graph(np.zeros_like(a), lengths)
        self.assertFalse(no_signal["any_discovery"])
        self.assertTrue(all(r["status"] == "cannot_tell" for r in no_signal["strata"].values()))

    def test_null_preserves_stratum_roles(self):
        a, lengths = synthetic()
        # Alter only final/final edges; the internal result must be identical,
        # under EVERY shuffle and in the observation, not just in direction.
        original = analyze_graph(a, lengths)
        _, pools = layout(lengths)
        a[np.ix_(pools["end"], pools["end"])] = 0
        changed = analyze_graph(a, lengths)
        self.assertEqual(original["strata"]["internal"], changed["strata"]["internal"])
        self.assertFalse(changed["strata"]["end"]["discovery"])

    def test_spacing_search_is_repeated_inside_the_null(self):
        a = np.zeros((6, 6), dtype=np.int8)
        for x, y in ((0, 1), (2, 3), (4, 5)):
            a[x, y] = a[y, x] = 1
        permutations = list(itertools.permutations(range(6)))

        def oracle(order):
            return max(sum(int(a[order[i], order[i + lag]]) for i in range(6 - lag))
                       for lag in range(1, 5))

        values = [oracle(order) for order in permutations]
        expected = sum(v >= values[0] for v in values) / len(values)
        draws = iter(permutations[1:])

        class Exhaustive:
            def shuffle(self, draw):
                draw[:] = next(draws)

        with patch("quality.rhyme_organization.random.Random", return_value=Exhaustive()):
            res = analyze_graph(a, [1] * 6, OrganizationDeclaration(n_perm=719))
        self.assertEqual(res["strata"]["end"]["p"], expected)
        self.assertEqual(res["strata"]["end"]["null_mean"], sum(values[1:]) / 719)
        self.assertEqual(res["strata"]["end"]["p_adjusted"], min(1, 2 * expected))
        self.assertEqual(res["strata"]["end"]["statistic"], "max_edges_at_one_line_distance")

    def test_end_inventory_alone_cannot_be_a_discovery(self):
        a, lengths = synthetic()
        _, pools = layout(lengths)
        a[:] = 0
        a[np.ix_(pools["end"], pools["end"])] = 1
        np.fill_diagonal(a, 0)
        res = analyze_graph(a, lengths)
        self.assertFalse(res["any_discovery"])
        self.assertEqual(res["strata"]["end"]["status"], "cannot_tell")

    def test_unknown_repetition_and_pronunciation_consensus(self):
        graph = WordGraph(self.lex)
        self.assertEqual(graph.relation("cat", "bat"), 1)
        self.assertEqual(graph.relation("cat", "cat"), 0)
        self.assertEqual(graph.relation("zzqqvv", "cat"), -1)
        with patch("quality.rhyme_organization.coarse_relation_consensus", return_value=None) as consensus:
            self.assertEqual(graph.relation("newword", "unreadword"), -1)
            consensus.assert_called_once()
        result = graph.analyze(["cat zzqqvv bat", "cat bat stone"])
        self.assertEqual(result["line_token_counts"], [3, 3])
        self.assertEqual(result["unreadable_occurrences"], [1])
        self.assertGreater(result["strata"]["internal"]["unresolved_pairs"], 0)
        json.dumps(result)  # the complete declaration must be serializable

    def test_one_edge_carries_every_relation(self):
        # A perfect rhyme is also assonance and consonance: the edge carries
        # all three, and each relation has its own graph. No score threshold
        # decides membership; each relation is judged at its own cut.
        graph = WordGraph(self.lex)
        held, unresolved = graph.relations("cat", "bat")
        self.assertTrue({"RHYME", "ASSONANCE", "CONSONANCE"} <= held, held)
        self.assertNotIn("RHYME", graph.relations("cat", "cap")[0])
        self.assertEqual(graph.relation("cat", "cap", "ASSONANCE"), 1)
        self.assertEqual(graph.relation("cat", "cap", "RHYME"), 0)
        a, _, _ = graph.build(["cat cap"], relation="ASSONANCE")
        self.assertEqual(int(a[0, 1]), 1)
        a, _, _ = graph.build(["cat cap"], relation="RHYME")
        self.assertEqual(int(a[0, 1]), 0)
        self.assertEqual(graph.relations("cat", "cat"), (frozenset(), frozenset()))

    def test_validation(self):
        for kw in ({"alpha": True}, {"alpha": float("nan")},
                   {"n_perm": 0}, {"seed": -1}, {"end_window": 0}):
            with self.assertRaises(ValueError):
                OrganizationDeclaration(**kw)
        for matrix, lengths in (([[0, 1], [0, 0]], [2]), ([[0, 2], [2, 0]], [2]),
                                ([[1]], [1]), ([[0]], [0]), ([[0]], [2])):
            with self.assertRaises(ValueError):
                analyze_graph(matrix, lengths)

    def test_acceptance_gates_keep_the_failed_design_failed(self):
        here = os.path.dirname(__file__)
        with open(os.path.join(here, "results", "rhyme_organization_2026-09-15.json")) as f:
            first = json.load(f)
        self.assertEqual(gates(first), ["real-versus-scrambled end organization separation"])
        with open(os.path.join(here, "results", "rhyme_organization_v2_2026-09-15.json")) as f:
            second = json.load(f)
        self.assertEqual(gates(second), [])
        # A receipt cannot pass merely because its stored failures say [].
        for path, value in (
            (("synthetic", 0, "null", "null_excess_tail"), 0.001),
            (("synthetic", 0, "positive", "strata", "internal", "detection_rate"), 0),
            (("corpus", "real", "strata", "end", "detection_rate"), 0.49),
            (("corpus", "scrambled", "null_excess_tail"), 0.001),
            (("replication", "scrambled", "null_excess_tail"), 0.001),
            (("replication", "separation", "p"), 0.02),
        ):
            mutated = copy.deepcopy(second)
            target = mutated
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            self.assertTrue(gates(mutated), path)

    def test_legacy_detected_events_cannot_license_timing(self):
        lines = ["cat bat stone road", "dog log chair tree"] * 4
        # Force a usable nonsaturated event set past the old detector's
        # sample-size/refusal branches. The new guard must still refuse.
        with patch("quality.time_layer.rhyme_events", return_value={0, 4, 8, 12}):
            result = analyse(self.lex, lines, tdecl=TimeDeclaration(n_perm=39))
        self.assertIsNone(result["p"])
        self.assertEqual(result["refused_by"], "analyse:unsupported_event_inference")
        supplied = analyse(self.lex, lines, events={0, 4, 8, 12},
                           tdecl=TimeDeclaration(n_perm=39))
        self.assertIn("research control", supplied["inference_scope"])
        self.assertIsNotNone(supplied["p"])
        # line_final_control forwards positions, but cannot relabel their origin.
        forwarded = analyse(self.lex, lines, events={0, 4, 8, 12}, legacy_detected=True,
                            tdecl=TimeDeclaration(n_perm=39))
        self.assertIsNone(forwarded["p"])

    def test_cli_refusal_and_single_item_boundary(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "lyric.txt")
            with open(path, "w") as out:
                out.write("cat bat stone\ndog log road\n")
            output = io.StringIO()
            with redirect_stdout(output):
                rc = main([path, "--permutations=1"])
            self.assertEqual(rc, 2)
            self.assertFalse(json.loads(output.getvalue())["any_discovery"])
            with open(path, "w") as out:
                out.write("--- TITLE: One\ncat bat\n--- TITLE: Two\ndog log\n")
            p = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__),
                               "rhyme_organization.py"), path], capture_output=True, text=True)
            self.assertEqual(p.returncode, 2)
            self.assertIn("one lyric item", json.loads(p.stdout)["refusal"])


if __name__ == "__main__":
    unittest.main()
