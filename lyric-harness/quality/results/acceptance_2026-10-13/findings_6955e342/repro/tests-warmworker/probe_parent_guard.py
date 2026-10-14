"""Is the 1 GiB peak assertion wired into the PARENT's `_child` path (not only
the helper)? Feed `WarmWorker._child` a fake child result (subprocess.run
patched in memory) whose reported VmHWM is at / just below / over the guard.
Run from <tree>/lyric-harness:  python probe_parent_guard.py
"""
import json
import os
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.getcwd())
import quality.test_reader as TR  # noqa: E402

NAME = "test_a_legacy_lyrics_request_then_a_library_analysis"


def fake(peak, guard_calls=5, analyses=1):
    rec = {"scenario": NAME, "peak_rss_bytes": peak, "guard_envelope_bytes": 1 << 30,
           "guard_calls": guard_calls, "library_analyses": analyses, "python": "fake"}
    out = "WARM_WORKER_PEAK_RSS " + json.dumps(rec) + "\n"
    err = "test ... ok\n\n" + "-" * 70 + "\nRan 1 test in 1.0s\n\nOK\n"
    return subprocess.CompletedProcess(args=[], returncode=0, stdout=out, stderr=err)


results = {}
for label, peak, gc, an in [("below", (1 << 30) - 1, 5, 1), ("at", 1 << 30, 5, 1),
                            ("over", (1 << 30) + 4096, 5, 1),
                            ("library_but_no_guard_calls", 500 << 20, 0, 1)]:
    t = TR.WarmWorker(NAME)
    with patch.object(TR.subprocess, "run", return_value=fake(peak, gc, an)):
        try:
            t._child(NAME)
            results[label] = "parent PASSED"
        except AssertionError as e:
            results[label] = "parent FAILED: " + str(e).splitlines()[0][:160]
print(json.dumps(results, indent=1))
ok = (results["below"] == "parent PASSED" and results["at"].startswith("parent FAILED")
      and results["over"].startswith("parent FAILED")
      and results["library_but_no_guard_calls"].startswith("parent FAILED"))
print("WIRED" if ok else "NOT AS EXPECTED")
sys.exit(0 if ok else 1)
