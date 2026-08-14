#!/usr/bin/env python3
"""Positive control for the time layer — does the statistic detect periodicity
when periodicity is there?

WHY THIS EXISTS, AND WHY IT COMES FIRST

Every arm the time layer has run tested material where the right answer was
unknown, so a null said nothing about whether the instrument works. Three
instrument versions later it has never once been shown to detect a periodic
signal it was pointed at.

Two questions were being conflated, and they separate cleanly:

  (a) Does the PHASE STATISTIC detect periodicity in an event set?
  (b) Does the RHYME DETECTOR find the events a form mandates?

This file answers (a). It is language-agnostic by construction — it plants
events at known phases in a synthetic slot stream and asks whether the
statistic recovers them — so it dodges the monoculture problem entirely for
the instrument question, and it needs no corpus, so it dodges provenance too.
(b) needs real verse from many traditions and is specified in
`quality/POSITIVE_CONTROL.md`.

If (a) fails there is nothing to fix in (b): every null the layer has ever
produced would be uninformative and the design would be dead. If (a) succeeds,
it also yields the number the project has never had — the **minimum detectable
effect** at the event counts real items actually produce.

Run: python3 quality/positive_control.py
     python3 quality/positive_control.py --check      (exit 0/1/2, see below)

WHY THERE IS A `--check` AT ALL, ADDED 2026-08-13

This file is doctrine 31's own instrument — "run the positive control before
believing any null" — and CLAUDE.md's reading order sends a session here first
of the three. Until this date it could not fail. `main()` printed the table and
returned `None`, `sys.exit` was never called with a code, and NOTHING invoked
it: not CI, not a test, not another module. `wiring` listed it under "one-shot
runners, standalone by design", which is discoverability, not invocation. So
the doctrine that gates every null in the project rested on a command a human
had to remember to type and then read with their own eyes.

That is the fifth instance of one shape in this repository — `audit_spans`,
`audit_corpus`, `audit_tang_null`, `audit_kalevala_null` and `canon_sources`
all printed their own drift and exited 0. Doctrine 48: a principle that lives
only in prose gets followed exactly as often as somebody remembers it.

WHAT IS PINNED, AND WHY IT IS NOT THE TABLE

Every cell of the table above is a share of `trials` Bernoulli draws. It is
SEEDED (`seed=20260810`), so it reproduces bit-exactly — and pinning it would
still be wrong, because bit-exactness would witness the seed and the replicate
count rather than the instrument. Doctrine 57 says an empirical figure sitting
at its own resolution is reporting the resolution; that warning applies one
axis out to a Monte Carlo power estimate too.

MEASURED, not argued: re-running the check cells under TEN seeds (2026-08-13,
`trials=100, n_perm=400`) gives

    ceiling, all three sizes   1.00  1.00  ...  1.00     (zero spread)
    floor,   all three sizes   0.00 - 0.08              (declared alpha 0.05)
    8 events @ c=0.60          0.04 - 0.21, median 0.15
    8 events @ c=0.75          0.68 - 0.82, median 0.74
    40 events @ c=0.60         1.00  ...  1.00          (zero spread)

AND THAT SWEEP CORRECTS THE RECORD. `POSITIVE_CONTROL.md` bolds **0.82** for
8 events at c=0.75, and CLAUDE.md's known gap 3 turns it into "8 events needs
~75% of an item's rhymes on one phase to reach 0.80 power". 0.82 is the MAXIMUM
of ten seeds; the median is 0.74, and only 2 of 10 seeds reach 0.80 at all. The
sentence the project quotes is a lucky draw. Repinned in POSITIVE_CONTROL.md
the same day, superseded value kept visible (doctrine 17). Had `--check` pinned
the recorded number it would have been RED on nine seeds out of ten.

So `--check` pins the CLAIMS this file is cited for, as one-sided thresholds
and orderings with margins wider than the measured seed spread:

  CEILING  a perfect signal must be detected  -- doctrine 76, the whole reason
           this file exists. If this fails, every null the layer ever produced
           is uninformative.
  FLOOR    pure noise must NOT be detected    -- doctrine 63/68. Catches a null
           that has collapsed to the identity map, and a statistic that fires
           on everything.
  MDE      the underpowered corner, the 0.75 band, and "more events buy power"
           -- the three orderings CLAUDE.md's known gap 3 rests on.

THREE EXITS, NOT TWO (doctrine 20/28). `--check` measures POWER, and power has
a resolution floor of its own: with `n_perm` permutations the smallest
attainable p is 1/(n_perm+1), so if that exceeds `alpha` NO trial can ever be
detected and every cell reads 0.00 for a reason that is not the instrument's.
Below `CHECK_MIN_TRIALS` the Bernoulli error on a cell is wider than the
margins above. Either case exits **2 -- CANNOT TELL**, never 1: "the run could
not resolve the question" is not "the instrument is broken", and collapsing
those two is the false negative doctrine 20 is about.
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.time_layer import phase_statistic  # noqa: E402

PERIODS = (2, 3, 4, 6, 8)


def plant(n_slots, n_events, period, phase, concentration, rng):
    """Events at a known phase, mixed with events at random phases.

    `concentration` is the share placed ON the planted phase; the rest land
    uniformly. concentration=1.0 is a perfectly periodic signal, 1/period is
    indistinguishable from noise (that phase gets its fair share and no more).
    """
    on = [c for c in range(n_slots) if c % period == phase]
    off = [c for c in range(n_slots) if c % period != phase]
    k = int(round(n_events * concentration))
    k = min(k, len(on))
    ev = rng.sample(on, k)
    rest = min(n_events - k, len(off))
    ev += rng.sample(off, rest)
    return sorted(ev)


def detect(slots, events, n_perm, rng):
    """The layer's own test, verbatim: max-KL over the sweep against a null
    that draws the same NUMBER of events from the same slots and takes the
    same maximum."""
    obs, _p = phase_statistic(slots, events, PERIODS)
    hits = 0
    for _ in range(n_perm):
        draw = rng.sample(slots, len(events))
        k, _q = phase_statistic(slots, draw, PERIODS)
        if k >= obs:
            hits += 1
    return (hits + 1) / (n_perm + 1)


def power(n_slots, n_events, concentration, period=4, trials=200,
          n_perm=400, alpha=0.05, seed=20260810):
    """-> share of trials in which the planted signal is detected at alpha."""
    rng = random.Random(seed)
    slots = list(range(n_slots))
    hit = 0
    for t in range(trials):
        ev = plant(n_slots, n_events, period, t % period, concentration, rng)
        if detect(slots, ev, n_perm, rng) <= alpha:
            hit += 1
    return hit / trials


def main():
    print("POSITIVE CONTROL — can the phase statistic see a signal at all?\n")
    print("A synthetic slot stream with events planted at a known phase.")
    print("`concentration` = share of events on that phase; 1/period = noise.")
    print("Sweep is over periods (2,3,4,6,8), so the argmax has 5 chances to")
    print("be wrong, exactly as in the real layer.\n")

    # The event counts real items actually produce, from RESULTS_FWER.md:
    # corrected sonnets carry 5-8 events over 60-75 slots.
    print("  ceiling check — a PERFECT signal must be detected")
    for n_ev, n_slots in ((8, 65), (20, 120), (40, 240)):
        p = power(n_slots, n_ev, 1.0, trials=100, n_perm=400)
        print(f"    {n_ev:>3} events / {n_slots:>3} slots, concentration 1.00 "
              f"-> power {p:.2f}")

    print("\n  floor check — pure noise must NOT be detected")
    for n_ev, n_slots in ((8, 65), (20, 120), (40, 240)):
        p = power(n_slots, n_ev, 0.25, trials=100, n_perm=400)
        print(f"    {n_ev:>3} events / {n_slots:>3} slots, concentration 0.25 "
              f"(= 1/4, chance) -> false-positive {p:.2f}")

    print("\n  MINIMUM DETECTABLE EFFECT at the sizes real items produce")
    print(f"    {'events':>7} {'slots':>6}  " +
          "  ".join(f"c={c:.2f}" for c in (0.4, 0.5, 0.6, 0.75, 0.9)))
    for n_ev, n_slots in ((8, 65), (12, 75), (20, 120), (40, 240), (80, 300)):
        row = []
        for c in (0.4, 0.5, 0.6, 0.75, 0.9):
            row.append(f"{power(n_slots, n_ev, c, trials=100, n_perm=400):.2f}")
        print(f"    {n_ev:>7} {n_slots:>6}  " +
              "  ".join(f"{v:>6}" for v in row))

    print("\n  Read the table as: to reach 0.80 power, an item needs BOTH")
    print("  enough events AND enough of them on one phase. The corrected")
    print("  sonnets carry 5-8 events (RESULTS_FWER.md), which is the top row.")


# --------------------------------------------------------------------------
# THE CHECK. See the module docstring for why these are thresholds and
# orderings rather than the printed table's own numbers.
# --------------------------------------------------------------------------

#: The resolution `--check` was calibrated at. Both are floors, not defaults to
#: tune: the margins below were measured at exactly these values over ten seeds.
CHECK_TRIALS = 100
CHECK_NPERM = 400
ALPHA = 0.05

#: Below this the Bernoulli standard error on a single cell (<= 0.5/sqrt(t))
#: is wider than the tightest margin below, so a pass or a fail would both be
#: noise. Exit 2, not 1.
CHECK_MIN_TRIALS = 100

#: CEILING -- doctrine 76. Measured 1.00 at every one of 10 seeds x 3 sizes;
#: there is no spread to allow for, because at concentration 1.00 every event
#: sits on the planted phase by construction. The 0.05 is slack, not error.
MIN_CEILING = 0.95

#: FLOOR -- doctrine 63/68. Declared alpha is 0.05; measured 0.00-0.08 over 10
#: seeds x 3 sizes. 0.15 clears the observed max by 0.07. Widen this only with
#: a seed sweep that justifies it, never to make a red run green (doctrine 58).
MAX_FLOOR = 0.15

#: MDE -- the three orderings CLAUDE.md's known gap 3 rests on.
#: measured 0.04-0.21 over 10 seeds; 0.40 is ~2x the observed max.
MAX_WEAK_8EV = 0.40
#: measured 0.68-0.82 over 10 seeds, median 0.74. A BAND, because both sides
#: are the claim: 8 events at 75% concentration is well above the c=0.60 case
#: and still short of a conventional 0.80. An upper bound of 0.95 is what makes
#: this check able to notice the layer becoming MORE powerful than recorded.
STRONG_8EV_LO, STRONG_8EV_HI = 0.50, 0.95
#: measured 1.00 at every one of 10 seeds -- "the binding constraint is events
#: per item, not corpus choice".
MIN_MORE_EVENTS = 0.90


def _cannot_tell(reason):
    print()
    print("=" * 70)
    print("CANNOT TELL -- the run could not resolve the question (exit 2)")
    print("=" * 70)
    print(f"  {reason}")
    print()
    print("  This is NOT a failure of the instrument, and it is not a pass.")
    print("  Doctrine 20/28: 'inconclusive by construction' is not 'null'.")
    return 2


def check(trials=CHECK_TRIALS, n_perm=CHECK_NPERM, seed=20260810):
    """-> exit code. 0 pass / 1 the claim moved / 2 cannot tell.

    Every threshold here is one-sided or a band, and every one was measured
    over ten seeds before it was written down. Nothing that is a draw from a
    distribution is pinned to its own value.
    """
    # --- the two ways this run cannot answer at all (doctrine 20/28) -------
    floor_p = 1.0 / (n_perm + 1)
    if floor_p > ALPHA:
        return _cannot_tell(
            f"n_perm={n_perm} puts the smallest attainable p at "
            f"1/(n_perm+1) = {floor_p:.4f}, above the declared alpha "
            f"{ALPHA}. No trial can be detected at any concentration, so "
            f"every cell would read 0.00 for a reason that is arithmetic "
            f"and not the statistic's. Doctrine 57. Need n_perm >= "
            f"{math.ceil(1 / ALPHA) - 1}.")
    if trials < CHECK_MIN_TRIALS:
        return _cannot_tell(
            f"trials={trials} gives a standard error up to "
            f"{0.5 / math.sqrt(trials):.3f} on a single cell, which is wider "
            f"than the margins these thresholds were calibrated with at "
            f"trials={CHECK_TRIALS}. A pass and a fail would both be noise. "
            f"Need trials >= {CHECK_MIN_TRIALS}.")

    def p(n_slots, n_ev, c):
        return power(n_slots, n_ev, c, trials=trials, n_perm=n_perm,
                     alpha=ALPHA, seed=seed)

    print()
    print("=" * 70)
    print("CHECK -- the claims this file is cited for, against this run")
    print(f"         trials={trials}  n_perm={n_perm}  seed={seed}  "
          f"alpha={ALPHA}")
    print("=" * 70)

    rows, bad = [], 0

    def judge(name, ok, detail):
        nonlocal bad
        bad += not ok
        rows.append((ok, name, detail))

    print("\n  CEILING -- a perfect signal must be detected (doctrine 76)")
    for n_ev, n_slots in ((8, 65), (20, 120), (40, 240)):
        v = p(n_slots, n_ev, 1.00)
        judge(f"ceiling {n_ev} events / {n_slots} slots", v >= MIN_CEILING,
              f"power {v:.2f}, need >= {MIN_CEILING}")

    print("  FLOOR -- pure noise must NOT be detected (doctrine 63/68)")
    for n_ev, n_slots in ((8, 65), (20, 120), (40, 240)):
        v = p(n_slots, n_ev, 0.25)
        judge(f"floor {n_ev} events / {n_slots} slots", v <= MAX_FLOOR,
              f"false-positive {v:.2f}, need <= {MAX_FLOOR} "
              f"(declared alpha {ALPHA})")

    print("  MDE -- the orderings CLAUDE.md's known gap 3 rests on")
    weak = p(65, 8, 0.60)
    judge("8 events at c=0.60 is mostly MISSED", weak <= MAX_WEAK_8EV,
          f"power {weak:.2f}, need <= {MAX_WEAK_8EV}")
    strong = p(65, 8, 0.75)
    judge("8 events at c=0.75 is caught, and still short of 0.80",
          STRONG_8EV_LO <= strong <= STRONG_8EV_HI,
          f"power {strong:.2f}, need {STRONG_8EV_LO} <= p <= "
          f"{STRONG_8EV_HI}")
    more = p(240, 40, 0.60)
    judge("more events buy power at the same concentration",
          more >= MIN_MORE_EVENTS,
          f"power {more:.2f} at 40 events vs {weak:.2f} at 8, need >= "
          f"{MIN_MORE_EVENTS}")
    judge("power is ordered in concentration at 8 events",
          weak < strong,
          f"c=0.60 -> {weak:.2f}, c=0.75 -> {strong:.2f}")

    print()
    for ok, name, detail in rows:
        print(f"  [{'ok  ' if ok else 'FAIL'}] {name}")
        print(f"         {detail}")

    if bad:
        print()
        print(f"  {bad} of {len(rows)} claims moved.")
        print("  A CEILING failure voids every null this layer has ever "
              "produced (doctrine 76).")
        print("  A FLOOR failure means the permutation null is not a null "
              "(doctrine 63/68).")
        print("  Argue it and repin with the date, keeping the superseded "
              "value visible (doctrine 17).")
        print("  Do NOT widen a threshold to make this green (doctrine 58).")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    _argv = [a for a in sys.argv[1:] if a != "--check"]
    _trials = int(_argv[0]) if _argv else CHECK_TRIALS
    _n_perm = int(_argv[1]) if len(_argv) > 1 else CHECK_NPERM
    if "--check" in sys.argv:
        # `--check` does NOT print the 31-cell table: it measures nine cells
        # of its own, and re-running main() first would triple the cost for
        # output the check does not read.
        sys.exit(check(_trials, _n_perm))
    main()
    sys.exit(0)
