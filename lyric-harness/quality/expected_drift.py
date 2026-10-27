#!/usr/bin/env python3
"""Declared drift — the difference between a gate that is RED and a gate that
is red FOR A REASON SOMEBODY WROTE DOWN.

THE PROBLEM THIS EXISTS FOR, stated as what it cost. `corpus/song/` is volatile
by design, so `song_profile_calibration.py --check` reports DRIFT whenever the
corpus moves and the shipped constants have not been re-adopted. That is the
runner working exactly as designed: doctrine 58 says a drift is argued and
repinned in a closing sitting, never tuned to. But the closing sitting is
DEFERRED by the owner, so the drift is permanent for now, so `suites` is
permanently red -- and a job that is always red teaches every reader to stop
looking at it. Measured on this branch on 2026-08-21: `suites` had been failing
on TWO steps for days, one of them the expected calibration drift and the other
a REAL regression in `test_capacity`, and they were indistinguishable from the
job status. The real one went unexamined for hours because the job had been red
so long that red carried no information.

SO THE FIX IS NOT TO SILENCE THE DRIFT. It is to make the EXPECTED drift a
declared set, and to fail on any difference from it -- which turns "red" back
into a signal without hiding anything.

THE ALLOWLIST IS SYMMETRIC, AND THAT IS THE WHOLE DESIGN. A one-directional
allowlist -- ignore these, fail on anything else -- is itself a staleness
generator: the day a value stops drifting, the entry that excused it becomes a
lie nobody is told about, and this repo has spent a day on exactly that shape
more than once. So:

  a drift that is NOT declared          -> FAIL. Something new moved.
  a declared drift that is NOT observed -> FAIL. The ruling is spent; delete it.
  the two sets equal                    -> PASS, and every reason is printed.

AND IT REFUSES RATHER THAN PASSES WHEN IT CANNOT READ THE ANSWER. If the
instrument exits non-zero and this runner cannot find its drift list, that is
NOT a pass with an empty set -- it is a parser that has stopped matching its
instrument, which is the same defect as `verify_entries.py`'s comma bug found
the same day (a `\\b\\d+` that read "1,297" as "297" and could pass a stale
claim as easily as fail a fresh one). Doctrine 20: inconclusive by construction
is not a null.

Usage:
    python3 quality/expected_drift.py song_profile_calibration-fast
    python3 quality/expected_drift.py --list

Exit 0 when the observed drift EQUALS the declared drift; 1 otherwise.
"""

import os
import re
import subprocess
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")


@dataclass(frozen=True)
class Ruling:
    """Why one value is allowed to drift, and what will end that."""

    #: The argument. Not "known issue" -- the reason a reader can disagree with.
    because: str
    #: When the owner ruled. A ruling with no date cannot be judged stale.
    since: str
    #: What closes it. A drift with no closing condition is not a ruling, it is
    #: a shrug, and it will still be here in a year.
    closed_by: str


@dataclass(frozen=True)
class Instrument:
    """One runner, one mode, and the drift its ruling permits."""

    argv: tuple
    #: Pattern whose group(1) is the comma-separated list of drifted names.
    drift_re: str
    declared: dict = field(default_factory=dict)


INSTRUMENTS = {
    "song_profile_calibration-fast": Instrument(
        argv=("python3", "quality/song_profile_calibration.py",
              "--check", "--without-predictability"),
        drift_re=r"\d+ value\(s\) DRIFTED: (.+)",
        #: EMPTY, AND THAT IS THE HEALTHY STATE — 2026-08-21.
        #:
        #: This dict held five rulings for about an hour. They excused the
        #: three thresholds and two period constants that had drifted while
        #: the closing sitting was deferred, each dated and each pointing at
        #: task #47 as the thing that would end it. Then the predictability
        #: arm finished banking, the set was adopted, and every one of those
        #: five drifts stopped happening.
        #:
        #: THE SYMMETRIC HALF IS WHY THEY ARE GONE RATHER THAN LEFT HERE
        #: HARMLESSLY. A declared drift that no longer occurs FAILS this
        #: reconciler, on purpose: an allowlist that outlives its reason is
        #: the staleness it was built to catch, and the entry excusing a
        #: value that now re-derives is a lie with nobody assigned to notice
        #: it. So adoption did not merely permit deleting them -- it required
        #: it, and the gate said so. First real use of that direction, on the
        #: same day it was built.
        #:
        #: An empty set does NOT make this instrument inert: `reconcile`
        #: passes only when the OBSERVED drift is also empty, so the runner
        #: still fails the moment anything moves.
        declared={}),
}


def observed(inst):
    """-> (set of drifted names, exit code, raw output).

    A non-zero exit with NO readable drift list raises: the instrument
    changed its report and this parser did not, and reporting an empty set
    there would be a pass manufactured out of a broken reader.
    """
    p = subprocess.run(inst.argv, cwd=ROOT, capture_output=True, text=True)
    out = p.stdout + p.stderr
    m = re.search(inst.drift_re, out)
    if m:
        return {s.strip() for s in m.group(1).split(",") if s.strip()}, p.returncode, out
    if p.returncode == 0:
        return set(), p.returncode, out
    raise RuntimeError(
        "%s exited %d and this runner could not find its drift list with "
        "%r. That is a parser that has stopped matching its instrument, not "
        "an absence of drift — refusing rather than reporting a pass "
        "(doctrine 20). Last 400 chars:\n%s"
        % (" ".join(inst.argv), p.returncode, inst.drift_re, out[-400:]))


def reconcile(name, verbose=True):
    inst = INSTRUMENTS[name]
    got, rc, _out = observed(inst)
    want = set(inst.declared)
    undeclared = sorted(got - want)
    spent = sorted(want - got)

    if verbose:
        print("=== declared drift: %s ===" % name)
        print("  ran: %s" % " ".join(inst.argv))
        print("  observed %d drifted value(s), declared %d"
              % (len(got), len(want)))
        for k in sorted(want & got):
            r = inst.declared[k]
            print("  [declared] %s" % k)
            print("             since %s — %s" % (r.since, r.closed_by))
        for k in undeclared:
            print("  [NEW]      %s — nothing rules this drift" % k)
        for k in spent:
            print("  [SPENT]    %s — declared, but it no longer drifts" % k)

    if not undeclared and not spent:
        print("PASS — the drift is exactly what is ruled, and every reason "
              "is dated with the sitting that ends it.")
        return 0
    if undeclared:
        print("\nFAIL — %d value(s) drifted with no ruling. Either argue and "
              "declare it here, or repin the constant. A drift nobody wrote "
              "down is the reason a red job stops being read." % len(undeclared))
    if spent:
        print("\nFAIL — %d declared drift(s) no longer occur. The ruling is "
              "SPENT and must be deleted: an allowlist that outlives its "
              "reason is the staleness it was built to catch." % len(spent))
    return 1


def main(argv):
    if "--list" in argv or not argv:
        for name, inst in sorted(INSTRUMENTS.items()):
            print("%s\n  %s\n  %d declared drift(s)"
                  % (name, " ".join(inst.argv), len(inst.declared)))
            for k, r in sorted(inst.declared.items()):
                print("    %-32s since %s" % (k, r.since))
        return 0
    name = argv[0]
    if name not in INSTRUMENTS:
        print("REFUSED — no instrument %r is declared. Declared: %s"
              % (name, ", ".join(sorted(INSTRUMENTS))))
        return 2
    return reconcile(name)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
