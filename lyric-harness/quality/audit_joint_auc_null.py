#!/usr/bin/env python3
"""AUDIT: the joint held-out AUCs, against a label-permutation null and
against the CV seed they were measured at.

THE CLAIMS UNDER AUDIT
  quality/RESULTS.md headline:            0.709 (Exp 1), 0.971 (Exp 2)
  quality/RESULTS.md post-fix rerun:      0.659 (Exp 1), 0.975 (Exp 2)
  quality/RESULTS_WITHIN_ITEM.md:         0.604 (Exp 1), 0.877 (Exp 2)
  and every derived sentence: "Detecting bad writing works. Ranking good
  writing barely does. That gap -- 0.971 against 0.709 -- is the whole
  argument in two numbers"; "P1 ... 0.975 -> 0.877 ... ~4.9x the error";
  "P2 -- Exp 1 AUC must hold or improve on 0.659. FAILED. 0.659 -> 0.604."

  Every per-FEATURE number in those documents carries a permutation p and a
  BH-FDR verdict. The JOINT AUCs carry neither. They are the numbers the
  headline, both pre-registered predictions P1/P2, and doctrine 7 are stated
  in, and they are bare.

  They are also single draws from one cross-validation split:
  discriminate.joint_classifier hard-codes StratifiedKFold(shuffle=True,
  random_state=SEED). Doctrine 58: a bare number is a coordinate of a setting.
  Here the setting is a seed, and at n=15 in the minority class one seed is
  not a measurement.

CHOOSING THE RANDOMISATION
  The claim is that a FEATURE VECTOR predicts a LABEL. So the null must
  destroy the label-to-item assignment and nothing else.

  NULL P -- permute y within the experiment.
     PRESERVES: every feature value, the class sizes, the missing-value
     pattern, the imputer, the scaler, the logistic regression and its C, the
     fold count, and the seed. The observed AUC and the null AUCs come out of
     the identical pipeline.
     DESTROYS: which item carries which label -- exactly the hypothesis.
  This is the only randomisation that leaves the "advantage" of a
  10-parameter fit on 132 items intact in the null, which is the advantage
  that matters: a CV AUC on a small minority class is not centred on 0.500.

  Reported alongside: the same pipeline with TRUE labels over many CV seeds,
  which is the spread the single recorded number is one draw from.

Run: python3 quality/audit_joint_auc_null.py [n_permutations]
"""

import json
import os
import sys

import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.corpus import (SONNET_SCHEME, labelled_sonnets,     # noqa: E402
                            load_generated, load_sonnets)
from quality.discriminate import (CACHE, SEED, cache_identity,  # noqa: E402
                                  compute, load_cache)
from quality.features import QualityFeatures                     # noqa: E402
from quality.within_item import WithinItemFeatures               # noqa: E402


def cv_auc(X, y, seed, folds=5):
    """discriminate.joint_classifier verbatim, with the seed exposed."""
    n_min = min(int((y == 1).sum()), int((y == 0).sum()))
    if n_min < folds:
        folds = max(2, n_min)
    pipe = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                         LogisticRegression(max_iter=2000, C=1.0))
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed)
    oof = np.zeros(len(y), dtype=float)
    for tr, te in skf.split(X, y):
        pipe.fit(X[tr], y[tr])
        oof[te] = pipe.predict_proba(X[te])[:, 1]
    return float(roc_auc_score(y, oof))


def matrix(rows_a, rows_b, names):
    X = np.array([[r.get(n, np.nan) for n in names] for _, r in rows_a]
                 + [[r.get(n, np.nan) for n in names] for _, r in rows_b],
                 dtype=float)
    y = np.array([1] * len(rows_a) + [0] * len(rows_b))
    return X, y


def audit(label, X, y, names, recorded, n_perm, rng):
    obs = cv_auc(X, y, SEED)
    nulls = sorted(cv_auc(X, rng.permutation(y), SEED) for _ in range(n_perm))
    seeds = sorted(cv_auc(X, y, s) for s in range(200))
    beat = sum(1 for v in nulls if v >= obs)
    p = (beat + 1) / (n_perm + 1)
    floor = 1 / (n_perm + 1)
    print(f"  {label}   (n={int((y == 1).sum())} vs {int((y == 0).sum())}, "
          f"{len(names)} features)")
    print(f"    observed R_obs           {obs:.3f}   "
          f"(RECORDED {recorded})")
    print(f"    null: N={n_perm} label permutations, median {nulls[len(nulls) // 2]:.3f}, "
          f"min {nulls[0]:.3f}, max {nulls[-1]:.3f}")
    print(f"    excess over null MEDIAN  {obs - nulls[len(nulls) // 2]:+.3f}")
    print(f"    excess over null MAX     {obs - nulls[-1]:+.3f}")
    print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {floor:.4f})"
          + ("   <- AT THE FLOOR" if abs(p - floor) < 1e-12 else ""))
    print(f"    TRUE labels over 200 CV seeds: median {seeds[100]:.3f}, "
          f"range {seeds[0]:.3f}-{seeds[-1]:.3f}, "
          f"IQR {seeds[50]:.3f}-{seeds[150]:.3f}")
    print()
    return obs, nulls, seeds


def main(n_perm=200):
    rng = np.random.default_rng(20260810)
    # READ THE CACHE THROUGH ITS OWNER, not as raw JSON. On 2026-08-13
    # `quality/discriminate.py`'s cache grew a fingerprint wrapper (format 2)
    # so a changed feature definition can no longer be served silently from a
    # stale entry. A bare `json.load` still SUCCEEDS against that file and
    # misses every key, so this script degraded to a ~70-MINUTE COLD RECOMPUTE
    # that looked exactly like a slow start. Measured: it produced 30 bytes of
    # output and then nothing.
    #
    # That failure mode is the one this whole file is about -- a stale
    # comparator serving numbers nobody knows are stale -- reproduced in the
    # reader rather than the writer. `load_cache` validates the fingerprint and
    # says which coordinate moved when it discards.
    cache, _fp, _why = load_cache(cache_identity())
    survived, forgotten = labelled_sonnets()
    generated = load_generated()
    human = [(n, l) for n, l in sorted(load_sonnets().items())]

    for tag, feats, rec1, rec2 in (
            # COLD figures, repinned 2026-08-13. The 0.659/0.975 and
            # 0.604/0.877 these read until then are WARM -- measured against a
            # cache keyed `tag:ident` with no fingerprint of the code that
            # wrote it, so they reproduced whatever features.py looked like on
            # 2026-08-09. Cold, twice, at two lyric_harness.py digests and
            # agreeing to the digit: 0.717/0.964 and 0.638/0.891. See
            # quality/RESULTS.md, which carries both readings and the
            # reproduce command.
            ("ABSOLUTE (original ten)", QualityFeatures, "0.717", "0.964"),
            ("WITHIN-ITEM (respecified eight)", WithinItemFeatures,
             "0.638", "0.891")):
        qf = feats()
        pfx = "abs" if feats is QualityFeatures else "wi"
        print(f"\n### {tag}\n")
        rs = compute(qf, survived, SONNET_SCHEME, cache, f"{pfx}son")
        rf = compute(qf, forgotten, SONNET_SCHEME, cache, f"{pfx}son")
        X, y = matrix(rs, rf, feats.NAMES)
        audit("Exp 1  survived vs forgotten", X, y, feats.NAMES, rec1,
              n_perm, rng)
        rh = compute(qf, human, SONNET_SCHEME, cache, f"{pfx}son")
        rg = compute(qf, generated, SONNET_SCHEME, cache, f"{pfx}gen")
        X, y = matrix(rh, rg, feats.NAMES)
        audit("Exp 2  human vs generated", X, y, feats.NAMES, rec2,
              n_perm, rng)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 200)
