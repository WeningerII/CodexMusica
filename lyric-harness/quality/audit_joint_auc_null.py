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

Run: python3 quality/audit_joint_auc_null.py [n_permutations] [--cache=PATH]
     python3 quality/audit_joint_auc_null.py --check [--cache=PATH]

  `--check` grades the DETERMINISTIC half of the report above against its
  committed values and exits 1 when one has moved; it exits 2, REFUSING, when
  the feature cache or a declared resource cannot serve the run. See the block
  above PINNED for why the split falls where it does, and what each exit means.
"""

import os
import sys

# ---------------------------------------------------------------------------
# THREAD PINNING, AND THE 20x IT IS WORTH.  Set BEFORE numpy is imported --
# BLAS reads these once, at load, and a `setdefault` after `import numpy` is a
# no-op that looks like a fix.
#
# MEASURED 2026-08-13 on a 4-core box, warm cache, same input both ways:
#     824 CVs (`n_permutations=5`)  4 threads ~625 CPU-s | 1 thread ~32 CPU-s
#      84 CVs (equivalence probe)   4 threads  70.3 CPU-s | 1 thread 7.96 CPU-s
# 8.8x on the small run, ~20x on the full one -- the penalty grows with the
# number of calls, which is the signature of per-call thread overhead rather
# than of contention.
#
# The work is logistic regressions on matrices of 132x10 and 192x8. At that
# size every BLAS call is smaller than the cost of waking four threads to serve
# it, so the pool spends its life in spin-wait -- and spin-wait is CPU, not
# idle, which is why `user` tracked `real` and a 10-minute run did not look
# like a busy machine.
#
# IT CHANGES THE COST AND NOT THE NUMBERS, and that was checked rather than
# assumed: all 84 AUCs in the probe above are IDENTICAL AT FULL FLOAT PRECISION
# (`repr`, 17 significant figures) between the two settings -- a stricter test
# than the 3 decimals the report prints. So this is an undeclared coordinate of
# the RUNTIME, not of the measurement (doctrine 58's shape, applied to cost).
#
# `setdefault`, not assignment: an operator who has already declared a thread
# count keeps it.
for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
           "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ.setdefault(_v, "1")

import numpy as np                                                # noqa: E402
from sklearn.impute import SimpleImputer                          # noqa: E402
from sklearn.linear_model import LogisticRegression               # noqa: E402
from sklearn.metrics import roc_auc_score                         # noqa: E402
from sklearn.model_selection import StratifiedKFold               # noqa: E402
from sklearn.pipeline import make_pipeline                        # noqa: E402
from sklearn.preprocessing import StandardScaler                  # noqa: E402

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


def audit(key, label, X, y, names, recorded, n_perm, rng, n_seeds=200):
    """Print the block, and return the measured quantities behind it.

    `n_seeds` is the ONE bound the caller may move (doctrine 79 -- say what you
    bounded). It costs 200 of the 206 cross-validations this function runs.
    """
    obs = cv_auc(X, y, SEED)
    nulls = sorted(cv_auc(X, rng.permutation(y), SEED) for _ in range(n_perm))
    seeds = sorted(cv_auc(X, y, s) for s in range(n_seeds))
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
    if seeds:
        print(f"    TRUE labels over {n_seeds} CV seeds: "
              f"median {seeds[len(seeds) // 2]:.3f}, "
              f"range {seeds[0]:.3f}-{seeds[-1]:.3f}, "
              f"IQR {seeds[len(seeds) // 4]:.3f}-"
              f"{seeds[(3 * len(seeds)) // 4]:.3f}")
    else:
        print("    TRUE labels over CV seeds: NOT RUN (n_seeds=0)")
    print()
    return {"key": key, "label": label, "obs": obs, "recorded": recorded,
            "n_pos": int((y == 1).sum()), "n_neg": int((y == 0).sum()),
            "n_features": len(names), "n_perm": n_perm, "n_seeds": n_seeds,
            "seed_median": seeds[len(seeds) // 2] if seeds else None,
            "null_median": nulls[len(nulls) // 2], "p": p}


def main(n_perm=200, n_seeds=200, strict=False, cache_path=CACHE):
    rng = np.random.default_rng(20260810)
    # READ THE CACHE THROUGH ITS OWNER, not as raw JSON. On 2026-08-13
    # `quality/discriminate.py`'s cache grew a fingerprint wrapper (format 2)
    # so a changed feature definition can no longer be served silently from a
    # stale entry. A bare `json.load` still SUCCEEDS against that file and
    # misses every key, so this script degraded to a COLD RECOMPUTE that looked
    # exactly like a slow start. Measured: it produced 30 bytes of output and
    # then nothing.
    #
    # That failure mode is the one this whole file is about -- a stale
    # comparator serving numbers nobody knows are stale -- reproduced in the
    # reader rather than the writer. `load_cache` validates the fingerprint and
    # says which coordinate moved when it discards.
    identity = cache_identity()
    absent = sorted(k for k, v in identity["resources"].items()
                    if v == "ABSENT")
    cache, _fp, why = load_cache(identity, cache_path)
    stats = {"reused": 0, "computed": 0}
    measured = {"cache_entries": len(cache), "cache_status": why,
                "resources_absent": absent, "arms": [], "cache_path":
                cache_path, "n_perm": n_perm, "n_seeds": n_seeds}

    # STRICT (= `--check`) REFUSES BEFORE IT SPENDS.  Cold extraction MEASURED
    # 2026-08-13: 1049.5 CPU-s over 384 items, 2.73 s/item -- **17.5 CPU-
    # MINUTES** -- and this script never calls `save_cache`, so every cold run
    # pays it again and warms nothing for the next one.
    #
    # Worse than the cost: a run that cannot prove the cache was written by the
    # code running now is measuring a comparator nobody named, which is the
    # exact defect this file is an audit OF. And that is not hypothetical here.
    # `quality/features.py` was edited TWICE by a concurrent cell inside that
    # single 17.5-minute build (digest d19ffe04 -> 2efbffbe -> 1ff08f3c), so
    # the cache was stale before it finished being written. A cold recompute
    # cannot outrun the rate at which this repo's own comparator moves, which
    # is the strongest possible argument for refusing rather than recomputing.
    # Doctrine 20 -- "cannot tell" is not a result, and it is not a failure
    # either.
    if strict and (absent or why != "fingerprint match"):
        measured.update(stats)
        return measured

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
        rs = compute(qf, survived, SONNET_SCHEME, cache, f"{pfx}son", stats)
        rf = compute(qf, forgotten, SONNET_SCHEME, cache, f"{pfx}son", stats)
        X, y = matrix(rs, rf, feats.NAMES)
        measured["arms"].append(audit(
            f"{pfx}_exp1", "Exp 1  survived vs forgotten", X, y, feats.NAMES,
            rec1, n_perm, rng, n_seeds))
        rh = compute(qf, human, SONNET_SCHEME, cache, f"{pfx}son", stats)
        rg = compute(qf, generated, SONNET_SCHEME, cache, f"{pfx}gen", stats)
        X, y = matrix(rh, rg, feats.NAMES)
        measured["arms"].append(audit(
            f"{pfx}_exp2", "Exp 2  human vs generated", X, y, feats.NAMES,
            rec2, n_perm, rng, n_seeds))

    measured.update(stats)
    return measured


# ---------------------------------------------------------------------------
# WHAT `--check` ASSERTS, AND WHY THE SPLIT FALLS WHERE IT DOES
# ---------------------------------------------------------------------------
#
# The two sibling runners wired the same day take opposite shapes, and this
# script is honestly BOTH -- so the split is drawn inside it rather than
# between it and them.
#
#   `quality/audit_tang_null.py` PINS NUMBERS, because its counts are exact:
#   a fixed corpus through a fixed predicate has one answer.
#   `quality/audit_time_pooled_null.py` CHECKS A DIRECTION, because every
#   figure it prints is a Monte Carlo estimate and pinning one to three
#   decimals would pin a sample (doctrine 57).
#
# EXACT here, and therefore PINNED:
#   * the four observed AUCs. Every input is fixed -- a fingerprint-validated,
#     content-addressed cache supplies X; the labels supply y; the fold split
#     is StratifiedKFold(shuffle=True, random_state=SEED) at a hard-coded SEED;
#     lbfgs is deterministic. No draw is taken anywhere on this path. They are
#     also the numbers the record is STATED in -- RESULTS.md's headline, P1 and
#     P2, doctrine 7 -- so they are the ones worth a witness.
#   * the corpus and cache shape: 15 vs 117, 152 vs 40, 10 and 8 features, 384
#     cached vectors. A silent change in who is compared with whom would move
#     the AUCs for a reason that has nothing to do with the comparator, and
#     without these counts the check could not tell the two apart.
#   * the median of the TRUE-label AUC over CV seeds 0..199. Deterministic for
#     the same reason -- 200 declared seeds, no rng draw -- and it is the
#     statistic doctrine 73 rests on ("a single CV seed is a coin flip reported
#     as a verdict"). It is pinned SEPARATELY from the observed AUC on purpose:
#     the whole seed distribution can shift while the one recorded draw sits
#     still, and that movement is invisible to any check that watches only the
#     headline.
#
# SAMPLED here, and therefore NOT pinned -- left to the printed p:
#   * the null median, min and max, and the empirical p. These are label
#     permutations drawn from `rng`. They are reproducible at a FIXED n_perm,
#     which is exactly what makes pinning them a trap: the number would be a
#     property of the replicate count, `--check` caps that count for cost, and
#     the pin would then witness a sample nobody reports. Doctrine 57 -- an
#     empirical p at 1/(N+1) is reporting the resolution, not the effect.
#
# THE THIRD ANSWER, which neither sibling needs: REFUSE (exit 2).
# Everything pinned above is exact ONLY GIVEN a warm, fingerprint-matching
# cache and the resource files the features read. Without them the numbers are
# still computable, at 17.5 CPU-minutes, against code the fingerprint says has
# moved -- so the honest output is not PASS and not FAIL. Doctrine 20: an
# instrument that cannot fire and an instrument that fired and found nothing
# are different results, and collapsing them is a false negative dressed as a
# finding. `--check` names the missing coordinate and exits 2, the code this
# repo already uses for a refusal (CLAUDE.md's `brief`/`verify`/`revise`).
#
# Doctrine 58 for all of it: argue these and repin with the date; do not tune
# the measurement to meet them.
PINNED = {
    "cache_entries": 384,
    "abs_exp1": {"n_pos": 15, "n_neg": 117, "n_features": 10,
                 "seed_median": 0.638},
    "abs_exp2": {"n_pos": 152, "n_neg": 40, "n_features": 10,
                 "seed_median": 0.967},
    "wi_exp1": {"n_pos": 15, "n_neg": 117, "n_features": 8,
                "seed_median": 0.640},
    "wi_exp2": {"n_pos": 152, "n_neg": 40, "n_features": 8,
                "seed_median": 0.900},
}

#: The observed AUCs are NOT repeated here. They are checked against the
#: `RECORDED` strings already carried in `main()` -- the same literals the
#: report prints on screen -- so the pin and the printed claim cannot drift
#: apart into two different committed values (doctrine 1: one declaration).

#: BOUNDS `--check` DECLARES (doctrine 79). Measured 2026-08-13 with threads
#: pinned as above, warm cache, on a 4-core box under other load:
#:   imports + two feature constructors      ~5 s   (the constructors read the
#:                                                   concreteness norms)
#:   4 observed AUCs                         ~0.2 s
#:   4 x CHECK_PERM null permutations        ~0.8 s
#:   4 x CHECK_SEEDS true-label CVs          ~30 s at 200
#:   ------------------------------------------------------------------
#:   WHOLE `--check`                         35.6 / 36.5 CPU-s on two runs
#:                                           (50.5 s and 65.3 s WALL, busy box)
#: A REFUSED run costs 1.8 s: it never reaches a constructor.
#:
#: The null is capped because `check` does not read it; the seed sweep is NOT
#: capped, because its median is one of the pinned quantities and a sweep run
#: at a different length is a different statistic, not a cheaper estimate of
#: the same one.
CHECK_PERM = 5
CHECK_SEEDS = 200


def check(m):
    """-> exit code. 0 pass, 1 drifted, 2 REFUSED. Fails loudly either way."""
    print()
    print("=" * 74)
    print("CHECK -- the DETERMINISTIC half of this report against its "
          "committed values")
    print("=" * 74)
    print(f"  bounds: n_perm={m['n_perm']} (capped; the null verdict is left "
          f"to the printed p),")
    print(f"          n_seeds={m['n_seeds']} (NOT capped; its median is "
          f"pinned)")
    print(f"  cache:  "
          f"{os.path.relpath(m['cache_path'], os.path.join(HERE, '..'))}"
          f"   {m['cache_entries']} entries   status {m['cache_status']!r}")
    print()

    # --- refusals, before anything is graded --------------------------------
    if m["resources_absent"]:
        print("  REFUSED -- a DECLARED coordinate of every cached vector is "
              "absent:")
        for k in m["resources_absent"]:
            print(f"      {k}")
        print("  These are quality/discriminate.py's own RESOURCE_FILES, so "
              "an absent one")
        print("  changes the cache fingerprint and no cache built with it "
              "present can be")
        print("  reused (doctrine 1 -- the declaration is part of the "
              "identity of the")
        print("  measurement). data/concreteness.txt is additionally FATAL: "
              "QualityFeatures()")
        print("  raises SystemExit without it, before a single AUC is "
              "reached. None of")
        print("  these three files is tracked in git, so a fresh checkout has "
              "none of")
        print("  them -- run quality/fetch_data.py first.")
        print("\nRESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
        return 2
    if m["cache_status"] != "fingerprint match":
        print("  REFUSED -- the feature cache cannot serve this run:")
        print(f"      {m['cache_status']}")
        print("  Every pinned number below is exact ONLY against a cache the "
              "fingerprint")
        print("  proves was written by the code running now. Recomputing cold "
              "costs 17.5")
        print("  CPU-MINUTES (measured 2026-08-13: 1049.5 CPU-s / 384 items) "
              "and this script")
        print("  never saves what it computes, so it would pay that again "
              "next time.")
        print("  Warm it with `python3 quality/discriminate.py`, which does "
              "save.")
        print("\nRESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
        return 2
    if m.get("computed"):
        print(f"  REFUSED -- {m['computed']} feature vector(s) were computed "
              f"rather than reused,")
        print("  so the corpus has items the cache has never seen. The shape "
              "pins below")
        print("  are about a corpus that no longer exists; repin them rather "
              "than grading")
        print("  a mixture.")
        print("\nRESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
        return 2

    # --- the graded, deterministic quantities -------------------------------
    bad = 0
    ok = m["cache_entries"] == PINNED["cache_entries"]
    bad += not ok
    print(f"  [{'ok  ' if ok else 'FAIL'}] cache_entries        committed "
          f"{PINNED['cache_entries']}"
          + ("" if ok else f", measured {m['cache_entries']}"))

    for arm in m["arms"]:
        pin = PINNED[arm["key"]]
        print(f"  -- {arm['key']}  ({arm['label']})")
        for field in ("n_pos", "n_neg", "n_features"):
            ok = arm[field] == pin[field]
            bad += not ok
            print(f"  [{'ok  ' if ok else 'FAIL'}]   {field:14s} committed "
                  f"{pin[field]}"
                  + ("" if ok else f", measured {arm[field]}"))
        # The AUC is graded against the RECORDED string the report itself
        # prints, at the 3 decimals the record quotes it to.
        got = f"{arm['obs']:.3f}"
        ok = got == arm["recorded"]
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}]   observed AUC   RECORDED "
              f"{arm['recorded']}" + ("" if ok else f", measured {got}"))
        got = f"{arm['seed_median']:.3f}"
        want = f"{pin['seed_median']:.3f}"
        ok = got == want
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}]   seed median    committed "
              f"{want}" + ("" if ok else f", measured {got}"))

    if bad:
        print()
        print(f"  {bad} figure(s) moved. Either the comparator changed under "
              f"this arm or the")
        print("  corpus did -- the cache fingerprint above says the code did "
              "not, so look")
        print("  at the corpus and the labels first.")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17).")
        print("  Doctrine 58: argue the number; do not tune the measurement "
              "to meet it.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    # `--cache=PATH` is spelled exactly as `quality/discriminate.py` spells it.
    # It cannot smuggle a stale number in: `load_cache` still validates the
    # fingerprint against the code running NOW, whatever path it is handed, so
    # a foreign cache either matches or is discarded and the check refuses.
    _path = CACHE
    for _a in list(argv):
        if _a.startswith("--cache="):
            _path = _a.split("=", 1)[1]
            argv.remove(_a)
    if "--check" in sys.argv:
        if argv:
            raise SystemExit(f"unknown arguments: {argv}\nusage: "
                             f"audit_joint_auc_null.py --check [--cache=PATH]")
        sys.exit(check(main(CHECK_PERM, CHECK_SEEDS, strict=True,
                            cache_path=_path)))
    main(int(argv[0]) if argv else 200, cache_path=_path)
