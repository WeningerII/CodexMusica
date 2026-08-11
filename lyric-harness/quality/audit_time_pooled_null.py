#!/usr/bin/env python3
"""AUDIT: is the time layer's pooled Fisher p a fact about verse, or the
instrument's own H0 output?

THE CLAIMS UNDER AUDIT
  quality/POSITIVE_CONTROL.md Part A:
      "stress    k=23 items, median p=0.701, X2=31.4 on 46 df  ->  p = 0.950
       syllable  k=26 items, median p=0.554, X2=48.4 on 52 df  ->  p = 0.617"
      "That is the predicted null holding under a test that pools 23-26 items"
  quality/RESULTS_FWER.md and RESULTS_TIME.md repeat both figures; CLAUDE.md
  doctrine 4 cites "Sonnet arm null with pooled power (Fisher p=0.950, k=23)".

  Fisher's method assumes the combined p-values are UNIFORM(0,1) under H0.
  If they are not -- if the instrument returns systematically large p under
  H0 -- then a pooled p of 0.950 is what the instrument prints when nothing
  is there AND when something is there, and pooling has added no power.

  Two reasons to suspect it here, both visible in the recorded numbers:
    * median p = 0.701 across 23 items. Under a calibrated test the median
      of 23 draws from U(0,1) is 0.500 with a 95% interval of about
      [0.36, 0.64]. 0.701 sits outside it.
    * quality/positive_control.py's own floor check reports false-positive
      0.02 at 8 events against a declared alpha of 0.05 -- conservative by a
      factor of 2.5 at exactly the size the sonnets carry.

CHOOSING THE RANDOMISATION
  The claim is POSITIONAL: "rhyme events are placed against a metric period".
  The audit brief's rule for a positional claim is that the null preserves the
  COUNT of events and randomises only their POSITIONS. That is precisely what
  this does, and it is the same construction analyse() uses for its own
  permutation null -- which is the point. Under H0 the observed event set IS a
  draw from that null, so feeding the instrument such a draw and looking at the
  p it returns measures the instrument, not the verse.

  PRESERVES: the number of events, the number of slots, the slot geometry, the
  period sweep (2,3,4,6,8), the max-over-sweep, the permutation-null
  construction, the tie-inclusive `>=` comparison, n_perm.
  DESTROYS: any relation between events and phase -- there is none to begin
  with, by construction. H0 is TRUE in every replicate.

  So every p this script produces is an H0 p. If they were uniform the pooled
  Fisher p would be uniform too, and 0.950 would be a 1-in-20 observation. If
  they are not, 0.950 is the modal output.

Run: python3 quality/audit_time_pooled_null.py [n_replicates]
"""

import math
import os
import random
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.time_layer import phase_statistic   # noqa: E402

SEED = 20260810
PERIODS = (2, 3, 4, 6, 8)

#: The sizes the corrected sonnets actually carry, per POSITIVE_CONTROL.md
#: Part A ("5-8 events over 60-75 slots") and RESULTS_FWER.md (median
#: saturation 10.4%).
SIZES = [(5, 65), (6, 68), (7, 72), (8, 75)]


def _fast_stat(slots, events):
    """phase_statistic, with the slot phase counts hoisted. Verified against
    the real function below before use."""
    best = -1.0
    for P in PERIODS:
        sp = Counter(c % P for c in slots)
        ep = Counter(c % P for c in events)
        ns, ne = len(slots), len(events)
        tot = 0.0
        for ph in range(P):
            p = ep.get(ph, 0) / ne
            q = sp.get(ph, 0) / ns
            if p > 0 and q > 0:
                tot += p * math.log(p / q)
        if tot > best:
            best = tot
    return best


def item_p(n_ev, n_slots, rng, n_perm):
    """One item under H0: events drawn uniformly from the slots, then the
    layer's own permutation test run against them."""
    slots = list(range(n_slots))
    ev = rng.sample(slots, n_ev)
    obs = _fast_stat(slots, ev)
    hits = 0
    for _ in range(n_perm):
        if _fast_stat(slots, rng.sample(slots, n_ev)) >= obs:
            hits += 1
    return (hits + 1) / (n_perm + 1)


def fisher(ps):
    x2 = -2 * sum(math.log(max(p, 1e-300)) for p in ps)
    df = 2 * len(ps)
    return x2, _chi2_sf(x2, df)


def _chi2_sf(x, df):
    """Upper tail of chi-square for even df -- exact, no scipy."""
    k = df // 2
    lam = x / 2.0
    term, s = 1.0, 1.0
    for i in range(1, k):
        term *= lam / i
        s += term
    return math.exp(-lam) * s


def main(reps=200, k_items=23, n_perm=400):
    rng = random.Random(SEED)

    # sanity: the fast statistic must equal the layer's own
    for _ in range(50):
        n_s = rng.randrange(30, 90)
        slots = list(range(n_s))
        ev = rng.sample(slots, rng.randrange(4, 10))
        a = _fast_stat(slots, ev)
        b, _ = phase_statistic(slots, ev, PERIODS)
        assert abs(a - b) < 1e-12, (a, b)
    print("fast statistic verified identical to time_layer.phase_statistic\n")

    print(f"H0 IS TRUE IN EVERY REPLICATE. {reps} replicates of a {k_items}-item"
          f" arm,\nevent counts 5-8 over 60-75 slots, n_perm={n_perm}, "
          f"periods {PERIODS}.\n")

    all_ps, medians, pooled, sig = [], [], [], []
    for r in range(reps):
        ps = []
        for i in range(k_items):
            n_ev, n_slots = SIZES[(r + i) % len(SIZES)]
            ps.append(item_p(n_ev, n_slots, rng, n_perm))
        ps.sort()
        all_ps.extend(ps)
        medians.append(ps[len(ps) // 2])
        x2, pf = fisher(ps)
        pooled.append(pf)
        sig.append(sum(1 for p in ps if p <= 0.05))

    def q(xs, f):
        xs = sorted(xs)
        return xs[min(len(xs) - 1, int(f * len(xs)))]

    print("PER-ITEM p UNDER H0 -- Fisher's method requires these to be U(0,1)")
    print(f"    n = {len(all_ps)} items")
    print(f"    mean   {sum(all_ps) / len(all_ps):.3f}   (uniform: 0.500)")
    print(f"    median {q(all_ps, 0.5):.3f}   (uniform: 0.500)")
    print(f"    share <= 0.05: {sum(1 for p in all_ps if p <= 0.05) / len(all_ps):.3f}"
          f"   (uniform: 0.050)")
    print(f"    share <= 0.20: {sum(1 for p in all_ps if p <= 0.20) / len(all_ps):.3f}"
          f"   (uniform: 0.200)")

    print("\nMEDIAN p OF A 23-ITEM ARM UNDER H0")
    print(f"    median of medians {q(medians, 0.5):.3f}    "
          f"range {min(medians):.3f}-{max(medians):.3f}")
    print(f"    RECORDED: 0.701 (stress, k=23), 0.554 (syllable, k=26)")
    print(f"    share of H0 arms with median >= 0.701: "
          f"{sum(1 for m in medians if m >= 0.701) / len(medians):.3f}")

    print("\nPOOLED FISHER p UNDER H0 -- the number recorded as 0.950")
    print(f"    median {q(pooled, 0.5):.3f}   "
          f"quartiles {q(pooled, 0.25):.3f} / {q(pooled, 0.75):.3f}")
    print(f"    range  {min(pooled):.3f}-{max(pooled):.3f}")
    print(f"    share of H0 arms with pooled p >= 0.950: "
          f"{sum(1 for p in pooled if p >= 0.950) / len(pooled):.3f}"
          f"    (calibrated expectation: 0.050)")
    print(f"    share of H0 arms with pooled p >= 0.617: "
          f"{sum(1 for p in pooled if p >= 0.617) / len(pooled):.3f}"
          f"    (calibrated expectation: 0.383)")
    print(f"\n    items significant at .05 per arm: median "
          f"{q(sig, 0.5)}/{k_items}   (RECORDED: 1/23 and 1/26)")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 200)
