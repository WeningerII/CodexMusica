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


if __name__ == "__main__":
    main()
