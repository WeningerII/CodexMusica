#!/usr/bin/env python3
"""Regressions for the positive control.

These pin the instrument's ceiling, its floor, and the minimum detectable
effect. Test 4 is the one that matters: it fixes in code the fact that at the
event counts real items produce, the layer is underpowered — so nobody reads a
future null as evidence about verse when it is evidence about sample size.

Run: python3 quality/test_positive_control.py
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.positive_control import PERIODS, detect, plant, power  # noqa

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_plant_places_events_where_it_says():
    print("\n1. the planted signal is what it claims to be")
    rng = random.Random(1)
    ev = plant(120, 20, 4, 1, 1.0, rng)
    check("concentration 1.0 puts every event on the phase",
          all(c % 4 == 1 for c in ev), f"{len(ev)} events, all at phase 1")
    ev = plant(120, 20, 4, 1, 0.5, rng)
    on = sum(1 for c in ev if c % 4 == 1)
    check("concentration 0.5 puts half on the phase",
          abs(on / len(ev) - 0.5) < 0.12, f"{on}/{len(ev)} on phase")
    check("events are unique positions", len(set(ev)) == len(ev))


def test_ceiling_a_perfect_signal_is_always_seen():
    print("\n2. CEILING — the statistic detects a perfect signal")
    p = power(65, 8, 1.0, trials=40, n_perm=300)
    check("8 events over 65 slots at concentration 1.0", p >= 0.95,
          f"power {p:.2f} — this is the check the layer never ran in three "
          f"instrument versions")


def test_floor_noise_is_not_seen():
    print("\n3. FLOOR — pure noise is not detected above alpha")
    p = power(120, 20, 0.25, trials=60, n_perm=300)
    check("concentration 1/4 at period 4 is chance and stays at alpha",
          p <= 0.15, f"false-positive {p:.2f} against a declared 0.05")


def test_minimum_detectable_effect_is_pinned():
    print("\n4. the layer is UNDERPOWERED at real item sizes")
    # RESULTS_FWER.md: corrected sonnets carry 5-8 events over 60-75 slots.
    weak = power(65, 8, 0.60, trials=60, n_perm=300)
    strong = power(65, 8, 0.90, trials=40, n_perm=300)
    check("at 8 events a 60%-concentrated signal is mostly MISSED",
          weak < 0.40,
          f"power {weak:.2f} — a null at this size is evidence about sample "
          f"size, not about verse")
    check("at 8 events a 90%-concentrated signal is caught",
          strong >= 0.90, f"power {strong:.2f}")
    check("more events buy power at the same concentration",
          power(240, 40, 0.60, trials=40, n_perm=300) > weak,
          "the binding constraint is events per item, not corpus choice")


def test_the_rap_arm_was_never_testable():
    print("\n5. n=1 at ~15 events could not have answered the question")
    p = power(95, 15, 0.60, trials=60, n_perm=300)
    check("a single item at ~15 events has little power",
          p < 0.60,
          f"power {p:.2f} for a real-sized effect. The withdrawn rap arm "
          f"reported p = 0.132, 0.626 and 0.087 across three instruments; "
          f"none of those meant 'no effect', they meant 'no power'")


if __name__ == "__main__":
    for fn in (test_plant_places_events_where_it_says,
               test_ceiling_a_perfect_signal_is_always_seen,
               test_floor_noise_is_not_seen,
               test_minimum_detectable_effect_is_pinned,
               test_the_rap_arm_was_never_testable):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all positive-control regressions pass")
