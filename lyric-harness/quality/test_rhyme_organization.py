#!/usr/bin/env python3
"""Exact-orbit, power, refusal, text-path and temporal-consumer regressions."""

import io
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
from quality.audit_rhyme_organization import synthetic  # noqa: E402
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

    def test_validation(self):
        for kw in ({"alpha": True}, {"alpha": float("nan")}, {"theta": 2},
                   {"n_perm": 0}, {"seed": -1}, {"end_window": 0}):
            with self.assertRaises(ValueError):
                OrganizationDeclaration(**kw)
        for matrix, lengths in (([[0, 1], [0, 0]], [2]), ([[0, 2], [2, 0]], [2]),
                                ([[1]], [1]), ([[0]], [0]), ([[0]], [2])):
            with self.assertRaises(ValueError):
                analyze_graph(matrix, lengths)

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
