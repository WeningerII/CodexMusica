#!/usr/bin/env python3
"""The reduced schema listing (`Reviser.grade(..., _schema_report=False)`)
answers every verdict the full listing answers (2026-10-31, EA-R speed).

    python3 quality/test_schema_report.py

WHAT IS REDUCED. The full grade runs the rule-5 listing
(`VocabularyPairResults.listed`, M-322) over every undecided pair, so each
verdict's `schemas`/`relations` name every schema some whole reading holds.
`capacity._group_measurement` reads verdicts, bans and refusals and no pair's
schema list, so it asks for the reduced listing: only the pairs whose verdict
the listing can move -- an open route the coarse relations failed -- are
resolved. On the capacity witness EA-R that was 334.5 of the grade's 357.2 s.

WHAT THIS PINS (3PO, #637 6537308588): full against reduced, on
  1  an alternate-reading rescue on an open route
  2  an unresolved refusal
  3  repeat handling, with and without a declared return
  4  capacity's bans and counts
the `why`, the earned ban, the refusals, the violations and every count are
EQUAL, and so are the readings of every pair the reduced path resolved (the
rescues). The reporting `schemas`, `relations` and `readings` of a pair the
coarse relations already passed are INTENDED to differ, so they are never
asserted equal; section 1 shows they do differ, and only on pairs both paths
pass, so the reduced path is not the full one under another name.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness  # noqa: E402,F401
import quality.schemes as SC  # noqa: E402
from quality import capacity as CAP  # noqa: E402
from quality.revise import Reviser  # noqa: E402

FAILURES = []
RV = Reviser()

# One draft holds every case. Lines 1-3 (either/record/minute) leave
# `multisyllabic rhyme` open under every reading -- the unresolved refusal;
# 4-5 are the identical word `sea`; 6 (`night`) fails most partners outright;
# 8-9 are one line twice, so section 3 can declare them a return.
WORDS = ("either", "record", "minute", "sea", "sea", "night", "tomato",
         "shore", "shore")
LINES = [f"we carry the evening to the {w}" for w in WORDS]
COUNTS = ("pairs_judged", "pairs_mandated", "pairs_refused",
          "refused_obligations", "excused")


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail and not cond:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def both(returns=None):
    m = SC.mandate([list(range(1, len(WORDS) + 1))], n_lines=len(WORDS),
                   returns=returns)
    return (m, RV.grade(LINES, m),
            RV.grade(LINES, m, _schema_report=False))


def answer(v):
    """What a verdict ANSWERS -- everything but the reporting lists."""
    return (v["lines"], v["group"], v["why"], RV.earned_pair_ban(v))


def same_rescues(full, red):
    """The reduced path's readings (the pairs it resolved) are the full
    path's; any other readings the full listing adds sit on a pair both
    paths pass."""
    for f, r in zip(full["verdicts"], red["verdicts"]):
        if r.get("readings") and r["readings"] != f.get("readings"):
            return False
        if (f.get("readings") or {}) != (r.get("readings") or {}) and (
                f["why"] or r["why"]):
            return False
    return True


def same_answers(full, red):
    return ([answer(v) for v in full["verdicts"]]
            == [answer(v) for v in red["verdicts"]]
            and full["refusals"] == red["refusals"]
            and [answer(v) for v in full["violations"]]
            == [answer(v) for v in red["violations"]]
            and [v["lines"] for v in full["repeats"]]
            == [v["lines"] for v in red["repeats"]]
            and all(full[k] == red[k] for k in COUNTS)
            and same_rescues(full, red))


def by_lines(found, i, j):
    return next(v for v in found["verdicts"] if v["lines"] == (i, j))


def test_open_route_rescue():
    print("\n1. an alternate-reading rescue on an open route")
    m, full, red = both()
    check("the mandate's one group has the schema route open",
          RV.schema_route_open(m, 0))
    check("every verdict, ban, refusal, violation and count is the same",
          same_answers(full, red))
    # record ~ tomato: the coarse relations fail it and a whole reading
    # holds multisyllabic rhyme, so the reduced listing must resolve it.
    f, r = by_lines(full, 2, 7), by_lines(red, 2, 7)
    check("record~tomato passes under a named reading on both paths",
          f["why"] is None and r["why"] is None
          and "multisyllabic rhyme" in (r.get("readings") or {})
          and f.get("readings") == r.get("readings"),
          (f.get("readings"), r.get("readings")))
    check("the readings it passes under are listed in its schemas on both",
          set(r["readings"]) <= set(r["schemas"])
          and set(f["readings"]) <= set(f["schemas"]))
    # record ~ shore already passed coarsely: its full listing adds schemas
    # some reading holds, and the reduced path does not ask.
    f, r = by_lines(full, 2, 8), by_lines(red, 2, 8)
    check("a coarsely passed pair keeps its verdict but not its reporting "
          "lists (record~shore: the full listing names more schemas and "
          "the readings that hold them)",
          f["why"] is None and r["why"] is None
          and set(r["schemas"]) < set(f["schemas"])
          and f.get("readings") and not r.get("readings"),
          (f["schemas"], r["schemas"]))


def test_unresolved_refusal():
    print("\n2. an unresolved refusal")
    _m, full, red = both()
    want = [(1, 2), (1, 3), (2, 3)]
    for found, label in ((full, "full"), (red, "reduced")):
        rows = [r for r in found["refusals"]
                if "remains unresolved" in r["reason"]]
        check(f"{label}: either/record/minute are refused, unresolved in "
              "multisyllabic rhyme",
              [r["lines"] for r in rows] == want
              and all("multisyllabic rhyme" in r["reason"] for r in rows),
              [(r["lines"], r["reason"]) for r in rows])
        check(f"{label}: a refused pair is not also a verdict",
              not any(v["lines"] in want for v in found["verdicts"]))
    check("the refusal rows are identical", full["refusals"] == red["refusals"])


def test_repeat_handling():
    print("\n3. repeat handling")
    _m, full, red = both()
    f, r = by_lines(full, 4, 5), by_lines(red, 4, 5)
    check("undeclared, sea~sea is a REPEAT a type satisfies, so it is not "
          "charged, on both paths",
          "REPEAT" in f["relations"] and "REPEAT" in r["relations"]
          and f["why"] is None and r["why"] is None
          and answer(f) == answer(r) and r.get("readings")
          and f.get("readings") == r.get("readings"))
    m, full, red = both(returns=[[8, 9]])
    check("with lines 8-9 declared a return, every answer is the same",
          same_answers(full, red))
    f, r = by_lines(full, 4, 5), by_lines(red, 4, 5)
    check("a return declared elsewhere makes sea~sea a violation on both "
          "paths", RV._repeat_declared_violation(m, 4, 5)
          and f["why"] and f["why"] == r["why"]
          and (4, 5) in [v["lines"] for v in red["violations"]]
          and (4, 5) in [v["lines"] for v in full["violations"]],
          (f["why"], r["why"]))
    f, r = by_lines(full, 8, 9), by_lines(red, 8, 9)
    check("the declared return shore~shore passes on both paths",
          f["why"] is None and r["why"] is None and answer(f) == answer(r))
    check("the repeats are the same pairs on both paths, and there are two",
          [v["lines"] for v in full["repeats"]]
          == [v["lines"] for v in red["repeats"]] == [(4, 5), (8, 9)])


def test_capacity_bans_and_counts():
    print("\n4. capacity's bans and counts")
    words = ["air", "bear", "care", "fair", "where", "prayer", "night"]
    reduced = CAP._group_measurement(RV, words)

    class Full:
        """The same reviser, with `grade` forced to the full listing."""
        def __getattr__(self, name):
            return getattr(RV, name)

        def grade(self, *a, **k):
            k.pop("_schema_report", None)
            return RV.grade(*a, **k)

    full = CAP._group_measurement(Full(), words)
    (ff, fb, fi), (rf, rb, ri) = full, reduced
    check("the banned edges are the same and there are some", fb == rb and fb,
          (sorted(map(sorted, fb)), sorted(map(sorted, rb))))
    check("the incompatible edges are the same and there are some",
          fi == ri and fi,
          (sorted(map(sorted, fi)), sorted(map(sorted, ri))))
    check("every verdict, ban, refusal, violation and count is the same",
          same_answers(ff, rf))


if __name__ == "__main__":
    for fn in (test_open_route_rescue, test_unresolved_refusal,
               test_repeat_handling, test_capacity_bans_and_counts):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all schema-report checks pass")
