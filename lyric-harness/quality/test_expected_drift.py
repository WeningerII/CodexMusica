#!/usr/bin/env python3
"""Regressions for the declared-drift reconciler.

THE THING BEING PROVEN is not that the allowlist works — it is that it works
in BOTH directions and refuses in a third case. A one-directional allowlist
(ignore these, fail on the rest) is the staleness generator it was built to
catch: the day a value stops drifting, the entry excusing it becomes a lie
with nobody assigned to notice.

The set logic is exercised against a stubbed `observed` so the checks are
deterministic and take milliseconds instead of re-running a 100-second
calibration four times. The PARSER is exercised separately, on captured
instrument text, because that is the half that can silently stop matching —
`verify_entries.py`'s comma bug, found the same day, was exactly a parser
that had gone quietly wrong in both directions.

Run: python3 quality/test_expected_drift.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import quality.expected_drift as ED  # noqa: E402

FAILURES = []
NAME = "song_profile_calibration-fast"


def check(name, ok, detail=""):
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if detail:
        print("          %s" % detail)
    if not ok:
        FAILURES.append(name)


def _with_observed(fake):
    """Swap ED.observed for one that returns `fake`, restore after."""
    real = ED.observed

    def stub(inst):
        return set(fake), 1, ""
    ED.observed = stub
    return real


def test_symmetry():
    print("\n1. the allowlist fails in BOTH directions")
    declared = set(ED.INSTRUMENTS[NAME].declared)
    check("the declared set is non-empty — a vacuous allowlist would make "
          "every check below meaningless", bool(declared), str(sorted(declared)))

    real = _with_observed(declared)
    try:
        check("observed == declared -> PASS", ED.reconcile(NAME, False) == 0)
    finally:
        ED.observed = real

    real = _with_observed(declared | {"threshold something_new"})
    try:
        check("an UNDECLARED drift -> FAIL (something new moved)",
              ED.reconcile(NAME, False) == 1)
    finally:
        ED.observed = real

    real = _with_observed(set(list(declared)[:-1]))
    try:
        check("a declared drift that NO LONGER occurs -> FAIL (the ruling is "
              "spent, and an allowlist outliving its reason is the staleness "
              "it was built to catch)",
              ED.reconcile(NAME, False) == 1)
    finally:
        ED.observed = real

    real = _with_observed(set())
    try:
        check("NOTHING drifts -> FAIL, not PASS — every ruling is spent and "
              "the constants should be repinned",
              ED.reconcile(NAME, False) == 1)
    finally:
        ED.observed = real


def test_every_ruling_is_answerable():
    print("\n2. a ruling states a reason, a date and what ends it")
    for name, inst in sorted(ED.INSTRUMENTS.items()):
        for k, r in sorted(inst.declared.items()):
            check("%s / %s carries all three" % (name, k),
                  len(r.because) > 40 and r.since and len(r.closed_by) > 20,
                  "because=%d chars, since=%r, closed_by=%d chars"
                  % (len(r.because), r.since, len(r.closed_by)))


def test_the_parser():
    print("\n3. the drift parser reads its instrument, and REFUSES when it "
          "cannot")
    import re
    inst = ED.INSTRUMENTS[NAME]
    real_line = ("   5 value(s) DRIFTED: threshold mattr, threshold fwr, "
                 "threshold cv, anaphora period slope rho, anaphora period "
                 "slope p_perm")
    m = re.search(inst.drift_re, real_line)
    got = {s.strip() for s in m.group(1).split(",")} if m else set()
    check("the shipped pattern reads a real DRIFTED line whole",
          got == set(inst.declared), str(sorted(got)))
    check("...and one drifted value parses as one, not as its substring",
          "threshold mattr" in got and "mattr" not in got)

    class _P:
        returncode, stdout, stderr = 3, "no drift list here at all\n", ""

    real_run = ED.subprocess.run
    ED.subprocess.run = lambda *a, **k: _P()
    try:
        raised = False
        try:
            ED.observed(inst)
        except RuntimeError as e:
            raised = "could not find its drift list" in str(e)
        check("a non-zero exit with NO readable drift list RAISES rather "
              "than reporting an empty set — a parser that stopped matching "
              "its instrument is not an absence of drift (doctrine 20)",
              raised)
    finally:
        ED.subprocess.run = real_run

    class _Q:
        returncode, stdout, stderr = 0, "everything re-derives exactly\n", ""

    ED.subprocess.run = lambda *a, **k: _Q()
    try:
        got2, rc, _ = ED.observed(inst)
        check("but a CLEAN exit with no drift list is an honest empty set",
              got2 == set() and rc == 0)
    finally:
        ED.subprocess.run = real_run


def main():
    test_symmetry()
    test_every_ruling_is_answerable()
    test_the_parser()
    print("\n" + "=" * 62)
    if FAILURES:
        print("%d FAILING: %s" % (len(FAILURES), ", ".join(FAILURES)))
        return 1
    print("declared drift is a ruling with a date and an end, and the "
          "allowlist fails in both directions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
