#!/usr/bin/env python3
"""Cheap adverse controls for complete evidence; never run a real sweep."""
import copy
import unittest
import contextlib
import io
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
import production_qualification as Q
from production_qualification import COMPONENTS, aggregate, spec

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.kw = dict(commit="a" * 40, repository="owner/repo", run_id=23, run_attempt=2, names=[f"M{i}" for i in range(1, 59)])
        self.identity = dict(commit=self.kw["commit"], source_sha256="b"*64, inputs_sha256="c"*64)
        self.rows = [dict(version=1, component=c, command=spec(c)[0], budget_s=spec(c)[1], identity=self.identity,
                          identity_after=self.identity, inventory=self.kw["names"], repository="owner/repo",
                          run_id=23, run_attempt=2, status="completed", exit_code=0) for c in COMPONENTS]

    def check_bad(self, mutate):
        rows = copy.deepcopy(self.rows)
        mutate(rows)
        with self.assertRaises(ValueError):
            aggregate(rows, **self.kw)

    def test_capacity_receipt_cannot_cross_attempt_commit_or_bytes(self):
        expected = {k: self.kw[k] for k in ("commit", "repository", "run_id", "run_attempt")}
        receipt = b'{"scope":"all_certified_capacity_witnesses"}'
        value = Q.capacity_metadata(receipt, **expected)
        Q.validate_capacity_metadata(value, receipt, **expected)
        for key, wrong in (("commit", "b"*40), ("repository", "fork/repo"), ("run_id", 24), ("run_attempt", 1), ("version", True)):
            with self.assertRaises(ValueError):
                Q.validate_capacity_metadata({**value, key: wrong}, receipt, **expected)
        with self.assertRaises(ValueError):
            Q.validate_capacity_metadata(value, receipt + b" ", **expected)

    def test_real_timed_out_child_leaves_incomplete_durable_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            child = Path(directory) / "slow.py"
            child.write_text("import time\ntime.sleep(10)\n")
            receipt = Path(directory) / "receipt.json"
            with patch.object(Q, "spec", return_value=([str(child)], 0.1)), patch.object(Q, "identity", return_value=self.identity), patch.object(Q, "inventory", return_value=self.kw["names"]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(Q.run_component("curves", receipt), 1)
            saved = json.loads(receipt.read_text())
            self.assertEqual(saved["exit_code"], 124)
            self.assertEqual(saved["status"], "incomplete")
            self.assertLess(saved["elapsed_s"], 3)
            self.assertEqual(len(saved["log_sha256"]), 64)

    def test_complete_inventory_requires_all_four_unique_shards(self):
        self.assertTrue(aggregate(self.rows, **self.kw)["completed"])
        self.check_bad(lambda r: r.pop(0))
        self.check_bad(lambda r: r.__setitem__(1, copy.deepcopy(r[0])))
        self.check_bad(lambda r: r[0].__setitem__("inventory", r[0]["inventory"][:-1]))

    def test_timed_out_running_failed_and_unexecuted_cannot_qualify(self):
        for code in [124, 1, 2, None, False]:
            self.check_bad(lambda r: r[0].__setitem__("exit_code", code))
        for status in ["running", "incomplete", "partial"]:
            self.check_bad(lambda r: r[-1].__setitem__("status", status))

    def test_reduced_calibration_and_wrong_partition_are_refused(self):
        for command in [["quality/song_profile_calibration.py", "--check", "--without-predictability"],
                        ["quality/song_profile_calibration.py", "--check", "--sample=1"],
                        ["quality/song_profile_calibration.py", "--check", "--seeds=1"]]:
            self.check_bad(lambda r: r[4].__setitem__("command", command))
        self.check_bad(lambda r: r[0].__setitem__("command", ["quality/test_mutation.py", "--shard=1/2"]))

    def test_commit_input_runtime_and_attempt_drift_refuse(self):
        self.check_bad(lambda r: r[0].__setitem__("identity", {**self.identity, "source_sha256": "d"*64}))
        self.check_bad(lambda r: r[0].__setitem__("identity_after", {**self.identity, "inputs_sha256": "d"*64}))
        self.check_bad(lambda r: r[0].__setitem__("run_attempt", 1))
        self.check_bad(lambda r: r[0].__setitem__("repository", "fork/repo"))
        self.check_bad(lambda r: r[0].__setitem__("run_id", 22))
        with self.assertRaises(ValueError):
            aggregate(self.rows, **{**self.kw, "commit": "d"*40})

if __name__ == "__main__":
    unittest.main()
