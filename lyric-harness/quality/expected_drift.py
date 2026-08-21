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


#: THE DECLARED SET. Every entry is the owner's standing ruling that the
#: corpus has moved ahead of the constants ON PURPOSE, with growth taken
#: before reconciliation. Task #47 is the sitting that ends all of them at
#: once, which is why they share a `closed_by`.
_CLOSING = ("task #47, the closing sitting: re-derive, re-adopt and "
            "re-snapshot the manifest in one pass once the predictability "
            "arm has been banked")
_GROWTH = ("the corpus grew from 143 files / 4,930 items to 1,297 / 8,667 "
           "while the shipped constants describe the 143-file corpus. "
           "Doctrine 58: a drift is argued and repinned, never tuned to -- "
           "and repinning FOUR of the five percentiles while the fifth "
           "(predictability) is still being banked would make the `song` "
           "profile half a description of one corpus and half of another "
           "(doctrine 1)")

INSTRUMENTS = {
    "song_profile_calibration-fast": Instrument(
        argv=("python3", "quality/song_profile_calibration.py",
              "--check", "--without-predictability"),
        drift_re=r"\d+ value\(s\) DRIFTED: (.+)",
        declared={
            "threshold mattr": Ruling(_GROWTH, "2026-08-20", _CLOSING),
            "threshold fwr": Ruling(_GROWTH, "2026-08-20", _CLOSING),
            "threshold cv": Ruling(_GROWTH, "2026-08-20", _CLOSING),
            "anaphora period slope rho": Ruling(
                "the period slope does not reproduce over 407 dated authors "
                "(rho -0.008, p_perm 0.8695 against +0.275/0.0042 over 108) "
                "and the WITHDRAWAL has shipped in every message that stated "
                "it -- but the shipped CONSTANT still says 0.2750, and "
                "repinning it belongs with the thresholds rather than ahead "
                "of them. quality/RESULTS_SONG_FLOOR.md §4·R",
                "2026-08-20", _CLOSING),
            "anaphora period slope p_perm": Ruling(
                "the p_perm half of the same withdrawn slope; moves with its "
                "rho and is never repinned alone",
                "2026-08-20", _CLOSING),
        }),
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
