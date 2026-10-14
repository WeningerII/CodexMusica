"""Sensitivity of the WarmWorker F9/F10 checks, by in-memory mutation only
(no tracked file is edited). Run from <tree>/lyric-harness:

    python probe_mutants.py <mutant> <scenario>

mutants:
  agree_between   - between requests run `_caches_agree` (the 61b behaviour,
                    which builds both schemes) instead of the read-only check.
                    R2: the cold v1->v2 child then fails "v2 was primed".
  none            - unmutated control.
Exit 0 when the scenario passes, 1 when it fails; prints the failure.
"""
import os
import sys
import unittest

os.environ["READER_TEST_WARM_WORKER_CHILD"] = "1"
sys.path.insert(0, os.getcwd())
mutant, name = sys.argv[1], sys.argv[2]
import quality.test_reader as TR  # noqa: E402

B = TR.WarmWorkerBody
if mutant == "agree_between":
    real_hold = B._caches_hold_their_schemes

    def hold(self):
        real_hold(self)
        self._caches_agree()
    B._caches_hold_their_schemes = hold
elif mutant != "none":
    raise SystemExit(f"unknown mutant {mutant}")

res = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([B(name)]))
for _, tb in res.failures + res.errors:
    print("FAILURE:", tb.strip().splitlines()[-1])
print("MUTANT", mutant, name, "PASS" if res.wasSuccessful() else "FAIL")
sys.exit(0 if res.wasSuccessful() else 1)
