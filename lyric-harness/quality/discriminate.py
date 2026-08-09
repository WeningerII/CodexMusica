#!/usr/bin/env python3
"""Discrimination test for the pre-registered quality features.

Reports, per feature: AUC, whether the observed direction matches the direction
committed in PREREGISTRATION.md, a permutation p-value, and a Benjamini-Hochberg
FDR verdict across the whole pre-registered set.

Two rules this module enforces rather than merely documents:

1. Only features named in PREREGISTRATION.md are reported as findings. Anything
   else is exploratory and is printed under a separate heading.
2. A feature that separates with the *wrong* sign is a failed prediction, not a
   success. It is never counted as a hit no matter how small its p-value.
"""

import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.corpus import (SONNET_SCHEME, labelled_sonnets,  # noqa: E402
                            load_generated, load_sonnets)
from quality.features import QualityFeatures  # noqa: E402

CACHE = os.path.join(HERE, "..", "data", "feature_cache.json")
N_PERM = 20000
FDR_Q = 0.10
SEED = 20260809          # fixed so the permutation test is reproducible


# ---------------------------------------------------------------------------
# Statistics -- no scipy; rank-based so permutation is O(n) per shuffle
# ---------------------------------------------------------------------------

def _ranks(values):
    """Average ranks, ties shared."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            out[order[k]] = avg
        i = j + 1
    return out


def auc_from_ranks(ranks, idx_a, n_a, n_b):
    """AUC that a member of group A outranks a member of group B."""
    r_a = sum(ranks[i] for i in idx_a)
    u_a = r_a - n_a * (n_a + 1) / 2.0
    return u_a / (n_a * n_b)


def permutation_test(vals_a, vals_b, n_perm=N_PERM, seed=SEED):
    """Two-sided permutation test on AUC. Returns (auc, p)."""
    values = list(vals_a) + list(vals_b)
    n_a, n_b = len(vals_a), len(vals_b)
    ranks = _ranks(values)
    observed = auc_from_ranks(ranks, range(n_a), n_a, n_b)
    obs_dev = abs(observed - 0.5)
    rng = random.Random(seed)
    idx = list(range(n_a + n_b))
    hits = 0
    for _ in range(n_perm):
        rng.shuffle(idx)
        a = auc_from_ranks(ranks, idx[:n_a], n_a, n_b)
        if abs(a - 0.5) >= obs_dev - 1e-12:
            hits += 1
    return observed, (hits + 1) / (n_perm + 1)


def benjamini_hochberg(pvals, q=FDR_Q):
    """-> list of bools, True where the hypothesis is rejected at FDR q."""
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    keep = [False] * m
    kmax = -1
    for rank, i in enumerate(order, start=1):
        if pvals[i] <= q * rank / m:
            kmax = rank
    for rank, i in enumerate(order, start=1):
        if rank <= kmax:
            keep[i] = True
    return keep


# ---------------------------------------------------------------------------
# Feature computation with an on-disk cache
# ---------------------------------------------------------------------------

def compute(qf, items, scheme, cache, tag):
    rows = []
    for ident, lines in items:
        key = f"{tag}:{ident}"
        if key not in cache:
            cache[key] = qf.extract(lines, scheme)
        rows.append((ident, cache[key]))
    return rows


def _clean(rows_a, rows_b, name):
    """Paired extraction of one feature, dropping non-finite values."""
    a = [r[name] for _, r in rows_a if math.isfinite(r.get(name, float('nan')))]
    b = [r[name] for _, r in rows_b if math.isfinite(r.get(name, float('nan')))]
    return a, b


def run_experiment(title, rows_a, rows_b, label_a, label_b, note=""):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")
    print(f"  {label_a}: n={len(rows_a)}    {label_b}: n={len(rows_b)}")
    if note:
        print(f"  {note}")

    results = []
    for name in QualityFeatures.NAMES:
        a, b = _clean(rows_a, rows_b, name)
        if len(a) < 3 or len(b) < 3:
            results.append((name, float("nan"), 1.0, False, 0, 0))
            continue
        auc, p = permutation_test(a, b)
        predicted = QualityFeatures.DIRECTION[name]
        # AUC > 0.5 means class A scores higher on this feature
        observed = "higher" if auc > 0.5 else "lower"
        results.append((name, auc, p, observed == predicted, len(a), len(b)))

    pvals = [r[2] for r in results]
    keep = benjamini_hochberg(pvals)

    print(f"\n  {'feature':32s} {'AUC':>6s} {'p':>8s}  {'dir':>9s}  verdict")
    print(f"  {'-' * 72}")
    hits = 0
    for (name, auc, p, dir_ok, na, nb), sig in zip(results, keep):
        if not math.isfinite(auc):
            print(f"  {name:32s} {'--':>6s} {'--':>8s}  {'--':>9s}  "
                  f"insufficient data")
            continue
        if sig and dir_ok:
            verdict, mark = "HIT (FDR)", "*"
            hits += 1
        elif sig and not dir_ok:
            verdict, mark = "WRONG SIGN", "x"
        elif p < 0.05:
            verdict, mark = "uncorrected only", " "
        else:
            verdict, mark = "null", " "
        pred = QualityFeatures.DIRECTION[name]
        print(f" {mark}{name:32s} {auc:6.3f} {p:8.4f}  {pred:>9s}  {verdict}")

    print(f"\n  pre-registered hits surviving BH-FDR at q={FDR_Q}: "
          f"{hits}/{len(QualityFeatures.NAMES)}")
    return results, keep, hits


def main():
    qf = QualityFeatures()
    cache = {}
    if os.path.exists(CACHE):
        cache = json.load(open(CACHE))

    # ---------------- Experiment 1: within-author survival ----------------
    survived, forgotten = labelled_sonnets()
    rows_s = compute(qf, survived, SONNET_SCHEME, cache, "son")
    rows_f = compute(qf, forgotten, SONNET_SCHEME, cache, "son")
    run_experiment(
        "EXPERIMENT 1 — within-Shakespeare: anthologized vs not",
        rows_s, rows_f, "survived", "forgotten",
        note=("one author, one form, one era, one register — confounds "
              "eliminated by construction; power is the cost"))

    # ---------------- Experiment 2: generated-text detection --------------
    generated = load_generated()
    if generated:
        allsn = load_sonnets()
        human = [(n, l) for n, l in sorted(allsn.items())]
        rows_h = compute(qf, human, SONNET_SCHEME, cache, "son")
        rows_g = compute(qf, generated, SONNET_SCHEME, cache, "gen")
        run_experiment(
            "EXPERIMENT 2 — Shakespeare vs model-generated sonnets",
            rows_h, rows_g, "human", "generated",
            note=("CONFOUNDED: generation-in-imitation leaves pastiche "
                  "artifacts; a hit here may detect imitation, not slop"))
    else:
        print("\n(Experiment 2 skipped: no generated corpus staged)")

    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, "w"))


if __name__ == "__main__":
    main()
