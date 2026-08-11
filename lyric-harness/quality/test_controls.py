#!/usr/bin/env python3
"""Regression tests for the three blocker fixes.

Each test encodes a defect that an adversarial review found in a drafted matrix
design. The point is that the defects are now structurally unreachable, not
merely documented.

Run: python3 quality/test_controls.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.controls import (calibrated_threshold, permuted_label_null,  # noqa
                              shuffle_twin, twin_is_degenerate)
from quality.frequency import (LAYER, FrequencyLayer,  # noqa: E402
                               FrequencySource, LabelDependencyError,
                               unavailable)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_blocker1_pool_derived_source_is_refused():
    print("\n1. BLOCKER 1 — a pool-derived frequency source is refused")
    lay = FrequencyLayer()
    bad = FrequencySource(cell="fi", name="loo:skvr-pool",
                          derived_from_pool=True, n_types=89247)
    try:
        lay.declare(bad)
        check("declaring a pool-derived source raises", False, "it was accepted")
    except LabelDependencyError as e:
        check("declaring a pool-derived source raises", True, str(e)[:88])

    ok = FrequencySource(
        cell="fi", name="loo:skvr-pool", derived_from_pool=True,
        justification="deliberate sensitivity analysis; direction argued in "
                      "the pre-registration before the run")
    lay.declare(ok)
    check("a documented dependence is allowed but recorded",
          lay.source_for("fi").derived_from_pool is True,
          "the dependence survives into the run log rather than being hidden")


def test_blocker1_undeclared_cell_is_refused():
    print("\n2. BLOCKER 1 — an undeclared cell cannot be scored")
    try:
        LAYER.source_for("klingon")
        check("undeclared cell raises", False, "returned a source")
    except KeyError as e:
        check("undeclared cell raises rather than defaulting", True,
              str(e)[:80])
    check("cells with no independent list are named, not silently skipped",
          unavailable("lzh") is not None and unavailable("fi") is None,
          f"lzh -> {str(unavailable('lzh'))[:60]}")


def test_blocker2_old_twin_was_an_identity():
    print("\n3. BLOCKER 2 — the old twin is detectably degenerate")
    old = [1.0] * 8            # partner == field maximum, by construction
    check("a constant control is flagged degenerate",
          twin_is_degenerate(old), "max-min < tol")
    check("a varying control is not flagged",
          not twin_is_degenerate([0.2, 0.7, 0.4, 0.9]), "")


def test_blocker2_shuffle_preserves_marginals():
    print("\n4. BLOCKER 2 — the shuffle twin preserves every marginal")
    items = list("abcdef")
    realised = {c: [f"{c}1", f"{c}2"] for c in items}
    tw = shuffle_twin(items, lambda i: realised[i])
    before = sorted(w for i in items for w in realised[i])
    after = sorted(w for _, ws in tw for w in ws)
    check("the rhyme-word multiset is exactly preserved", before == after,
          "a permutation, not a resample, so frequency/length/word-class "
          "marginals are all held fixed")
    check("per-item counts are preserved",
          all(len(ws) == len(realised[i]) for i, ws in tw), "")
    moved = sum(1 for i, ws in tw if ws != realised[i])
    check("the item-to-word pairing is actually destroyed", moved >= 4,
          f"{moved}/6 items received different words")
    again = shuffle_twin(items, lambda i: realised[i])
    check("the shuffle is deterministic under a fixed seed",
          [w for _, ws in tw for w in ws] == [w for _, ws in again for w in ws],
          "reproducible")


def test_blocker3_permuted_label_null():
    print("\n5. BLOCKER 3 — calibration comes from permuted labels")
    import random as _r

    def honest_scorer(perm):
        """A battery with no signal: p-values uniform regardless of labels."""
        rng = _r.Random(hash(tuple(perm)) & 0xFFFF)
        return [rng.random() for _ in range(8)]

    res = permuted_label_null(list(range(40)), honest_scorer, n_perm=120)
    fw = res["family_wise_fpr"][0.05]
    check("an honest battery shows a family-wise FPR well above its nominal "
          "alpha", fw > 0.20,
          f"family-wise {fw:.2f} at nominal 0.05 across 8 features -- this is "
          f"the multiplicity the correction must absorb")

    def zipf_scorer(perm):
        """A battery containing one feature that fires regardless of labels --
        the old calibrator's failure mode."""
        rng = _r.Random(hash(tuple(perm)) & 0xFFFF)
        return [1e-9] + [rng.random() for _ in range(7)]

    bad = permuted_label_null(list(range(40)), zipf_scorer, n_perm=60)
    check("a mechanically-firing feature is caught at 100% under permutation",
          bad["family_wise_fpr"][0.01] == 1.0,
          f"family-wise {bad['family_wise_fpr'][0.01]:.2f} -- a feature that "
          f"fires with the labels destroyed cannot be a calibrator")
    check("mean discoveries reveal it is exactly one feature",
          0.9 <= bad["mean_discoveries"][0.01] <= 1.6,
          f"{bad['mean_discoveries'][0.01]:.2f} discoveries per permutation")

    thr = calibrated_threshold(res, target_fpr=0.05)
    check("a calibrated threshold is derived from measurement, not assumption",
          thr in (0.01, 0.05, 0.10), f"alpha={thr}")


if __name__ == "__main__":
    test_blocker1_pool_derived_source_is_refused()
    test_blocker1_undeclared_cell_is_refused()
    test_blocker2_old_twin_was_an_identity()
    test_blocker2_shuffle_preserves_marginals()
    test_blocker3_permuted_label_null()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all blocker-fix regressions pass")
