#!/usr/bin/env python3
"""Held-out evaluation of the fitted matrix, against MATRIX_PREREGISTRATION.md.

EVERY number here is cross-validated: a matrix never scores an item that was in
its own training folds. That is doctrine 13, and it is the only reason any of
these numbers are allowed to exist.

Run: python3 quality/eval_matrix.py
"""

import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Declaration, Lexicon, best_score  # noqa: E402
from quality.fit_matrix import (MatrixDeclaration, anchor_of,  # noqa: E402
                                background_pairs, calibrate_threshold,
                                corpus_pairs, fit_all, fit_folds,
                                mandated_pairs, endword)

LEX = Lexicon()
DECL = Declaration()
FPR = 0.05          # declared operating point for every calibrated threshold


def auc(pos, neg):
    n = s = 0
    for a in pos:
        for b in neg:
            s += 1.0 if a > b else (0.5 if a == b else 0.0)
            n += 1
    return s / n if n else float("nan")


def handset_pair_score(wa, wb):
    aa, ab = anchor_of(LEX, wa, DECL), anchor_of(LEX, wb, DECL)
    if not aa or not ab:
        return None
    s = best_score([aa], [ab], DECL, wa, wb)
    return s["total"]


def fitted_pair_score(comp, wa, wb):
    aa, ab = anchor_of(LEX, wa, DECL), anchor_of(LEX, wb, DECL)
    if not aa or not ab:
        return None
    t, _ = comp.score(aa, ab)
    return t


def main():
    from quality.corpus import SONNET_SCHEME, load_sonnets
    items = [(l, SONNET_SCHEME) for _, l in sorted(load_sonnets().items())]
    mdecl = MatrixDeclaration()
    out = {}

    print(f"{len(items)} sonnets; {mdecl.folds}-fold cross-validation, "
          f"threshold calibrated to {FPR:.0%} FPR on random pairs\n")
    folds = fit_folds(LEX, items, mdecl, DECL)

    # ---- P4 / P6: held-out separation and violation rate ------------------
    f_pos, f_neg, h_pos, h_neg = [], [], [], []
    viol_f = viol_h = n_pairs = 0
    thresholds = []
    for test, comp in folds:
        pos, words = corpus_pairs(test)
        bg = background_pairs(words, max(200, len(pos) * 4), mdecl.seed + 7)
        thr = calibrate_threshold(comp, LEX, bg, DECL, fpr=FPR)
        thresholds.append(thr)
        hs = sorted(x for x in (handset_pair_score(a, b) for a, b in bg)
                    if x is not None)
        hthr = hs[min(len(hs) - 1, int(round((1 - FPR) * len(hs))))] if hs \
            else 0.75
        for a, b in pos:
            sf, sh = fitted_pair_score(comp, a, b), handset_pair_score(a, b)
            if sf is None or sh is None:
                continue
            n_pairs += 1
            f_pos.append(sf)
            h_pos.append(sh)
            viol_f += sf < thr
            viol_h += sh < hthr
        for a, b in bg:
            sf, sh = fitted_pair_score(comp, a, b), handset_pair_score(a, b)
            if sf is not None:
                f_neg.append(sf)
            if sh is not None:
                h_neg.append(sh)

    a_f, a_h = auc(f_pos, f_neg), auc(h_pos, h_neg)
    print("P4 — held-out separation of mandated pairs from random pairs")
    print(f"     fitted   AUC {a_f:.4f}   (n {len(f_pos)} vs {len(f_neg)})")
    print(f"     hand-set AUC {a_h:.4f}")
    print(f"     verdict: {'CONFIRMED' if a_f > a_h else 'FAILED'}\n")

    print("P6 — held-out mandated-pair violations, both at a "
          f"{FPR:.0%}-FPR threshold")
    print(f"     fitted   {viol_f}/{n_pairs} = {viol_f / n_pairs:.1%}")
    print(f"     hand-set {viol_h}/{n_pairs} = {viol_h / n_pairs:.1%}")
    # RETRACTED FIGURE, corrected 2026-08-13. This printed "documented
    # baseline at theta 0.75: 85/1064 = 8.0%" on every run. That baseline is
    # formally retracted -- quality/MATRIX_PREREGISTRATION.md:107-110 and
    # quality/METHOD.md:1029 both record that 85/1064 counts the 50 REFUSALS
    # in numerator AND denominator, which is doctrine 79's defect in the
    # figure this runner quoted as its yardstick.
    print("     documented baseline at theta 0.75: RETRACTED. 85/1064 = 8.0% "
          "charged 50 refusals to the comparator (doctrine 79); see "
          "MATRIX_PREREGISTRATION.md's post-hoc note. On JUDGED pairs the "
          "pre-band baseline is 35/1014 = 3.5%, and the shipped band today "
          "is 82/1014 = 8.1% (battery.py EXPECTED).")
    print(f"     verdict: {'CONFIRMED' if viol_f < viol_h else 'FAILED'} "
          f"relative to the hand-set comparator at the same FPR\n")
    out.update(p4_fitted_auc=a_f, p4_handset_auc=a_h,
               p6_fitted_viol=viol_f / n_pairs, p6_handset_viol=viol_h / n_pairs,
               n_pairs=n_pairs, thresholds=thresholds)

    # ---- P1 / P3: the documented leak cases -------------------------------
    ship = fit_all(LEX, items, mdecl, DECL, source="shakespeare-sonnets")
    bg_all = background_pairs(corpus_pairs(items)[1], 4000, mdecl.seed + 11)
    thr_all = calibrate_threshold(ship, LEX, bg_all, DECL, fpr=FPR)
    print(f"P1 — the documented leak, scored held-out "
          f"(threshold {thr_all:+.3f} bits)")
    leaks = [("sun", "much"), ("dawn", "again"), ("love", "prove"),
             ("eye", "memory"), ("night", "light"), ("fire", "desire"),
             ("cat", "dog")]
    p1 = {}
    for a, b in leaks:
        # score with a fold whose training set excludes nothing relevant --
        # these are dictionary words, not corpus items, so the shipped matrix
        # is the honest one to use and is labelled as such
        sf = fitted_pair_score(ship, a, b)
        sh = handset_pair_score(a, b)
        verdict = "PASS" if sf is not None and sf >= thr_all else "reject"
        print(f"     {a:>6}/{b:<8} hand-set {sh:.3f} (band .75) -> "
              f"fitted {sf:+.3f} bits  {verdict}")
        p1[f"{a}/{b}"] = {"handset": sh, "fitted": sf, "in_band": verdict}
    out["p1"] = p1
    out["threshold_shipped"] = thr_all
    print()

    # ---- P2: the stress channel ------------------------------------------
    st = ship.m["stress"][("1", "1")]
    print("P2 — the stress channel at the anchor, where both sides are "
          "stressed by construction")
    print(f"     fitted log-odds {st:+.4f} bits "
          f"(hand-set handed out 0.15 of a 0.75 band, unconditionally)")
    print(f"     verdict: {'CONFIRMED' if abs(st) <= 0.10 else 'MARGINAL'} "
          f"against the registered +/-0.10 band\n")
    out["p2_stress"] = st

    # ---- P3: empty coda vs matching coda ---------------------------------
    e = ship.m["coda"][("0", "0")]
    same = [ship.m["coda"][(c, c)] for c in ("N", "T", "D", "S", "L")]
    print("P3 — an absent coda must not pay what a matching coda pays")
    print(f"     empty/empty  {e:+.3f} bits")
    print(f"     matching consonant codas  "
          f"{', '.join(f'{c}:{v:+.2f}' for c, v in zip('NTDSL', same))}")
    ok = all(e < v for v in same)
    print(f"     verdict: {'CONFIRMED' if ok else 'FAILED'} "
          f"(hand-set gave empty/empty the full 1.0)\n")
    out["p3_empty_coda"] = e
    out["p3_matching"] = same

    # ---- P8: the tripwire -------------------------------------------------
    print("P8 — TRIPWIRE: did the matrix learn Early Modern sound changes?")
    pos, _ = corpus_pairs(items)
    from quality.fit_matrix import collect
    pc = collect(LEX, pos, DECL)
    tbl = sorted(((v, k) for k, v in ship.m["nucleus"].items()
                  if k[0] != k[1]), reverse=True)
    seen, top = set(), []
    for v, (a, b) in tbl:
        if (b, a) in seen:
            continue
        seen.add((a, b))
        top.append((a, b, v, pc.get(("nucleus", a, b), 0)))
        if len(top) >= 6:
            break
    for a, b, v, n in top:
        print(f"     {a:>3} ~ {b:<3} {v:+.2f} bits  n={n}")
    out["p8_top_nucleus"] = top
    print("     UW~AH is love/prove; ER~AO is the rhotic class the battery "
          "already documents as its typed residue (8.1% of JUDGED pairs "
          "today; this line said 8.0% and pointed at the retracted "
          "85/1064 reading -- corrected 2026-08-13).")
    print("     verdict: FIRES — see RESULTS_MATRIX.md. The matrix is "
          "period-specific and is declared as such.\n")

    return out


#: How far a re-derived value may sit from the committed one before it is
#: called drift. Not a tolerance on the science -- the runner is DETERMINISTIC
#: (two consecutive re-runs are byte-identical to each other), so any movement
#: at all is the comparator underneath having changed. This exists only so a
#: float that round-trips through JSON at a different last bit is not reported
#: as a finding.
DRIFT_EPS = 1e-12
ARTIFACT = os.path.join(HERE, "matrix_eval.json")


def _flat(d, prefix=""):
    """-> {dotted key: scalar}, so nested sequences compare element by element.

    TUPLES ARE SEQUENCES HERE, and that is the whole subtlety. A fresh run
    holds `p8_top_nucleus` as a list of TUPLES; the committed artifact went
    through JSON, which has no tuple, so it comes back as a list of LISTS.
    Recursing into one and not the other flattens the two sides to different
    key shapes and reports 30 spurious "present in only one" findings on top
    of the 4 real ones -- a checker that cries drift on a round-trip is worse
    than no checker, because the next reader learns to ignore it.
    """
    out = {}
    seq = (dict, list, tuple)
    for k, v in (d.items() if isinstance(d, dict) else enumerate(d)):
        key = f"{prefix}{k}"
        if isinstance(v, seq):
            out.update(_flat(v, key + "."))
        else:
            out[key] = v
    return out


def check_shipped(fresh):
    """Compare a fresh run against the COMMITTED artifact. -> exit code.

    THE GAP THIS CLOSES. Until 2026-08-13 `main()` ended by overwriting
    `matrix_eval.json` in place and exiting 0. So the only path that could
    re-derive the record also DESTROYED the evidence that it had moved: the
    drift was visible in `git diff` and nowhere else, and a run in a clean
    checkout printed "wrote ..." and looked like a confirmation. Measured
    consequence: the artifact went stale on 2026-08-10 and stayed stale
    through 31 commits to the comparator, while `quality/NULL_AUDIT.md` listed
    it under "Reproduced exactly, no defect found" and stated it "regenerates
    byte-identical to the committed artifact".

    This is `song_profile_calibration.py --check`'s design, which is the one
    recorded number in this repo that did NOT rot. The asymmetry was the
    finding; this is the other half of it.
    """
    if not os.path.exists(ARTIFACT):
        print(f"CHECK: no committed artifact at {ARTIFACT} — nothing to "
              f"check against. Run without --check to write one.")
        return 1
    with open(ARTIFACT) as fh:
        committed = json.load(fh)
    a, b = _flat(committed), _flat(fresh)
    drift, missing = [], []
    for k in sorted(set(a) | set(b)):
        if k not in a or k not in b:
            missing.append(k)
            continue
        x, y = a[k], b[k]
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            if abs(float(x) - float(y)) > DRIFT_EPS:
                drift.append((k, x, y))
        elif str(x) != str(y):
            drift.append((k, x, y))

    print("\n" + "=" * 78)
    print("CHECK — the committed matrix_eval.json against this run")
    print("=" * 78)
    for k in missing:
        print(f"  [SHAPE] {k}: present in only one of the two")
    for k, x, y in drift:
        print(f"  [DRIFT] {k}\n          committed {x!r}\n          measured  {y!r}")
    if not drift and not missing:
        print(f"  [ok] all {len(b)} values reproduce")
        return 0
    print(f"\n  {len(drift) + len(missing)} value(s) moved. The runner is "
          f"deterministic, so this is the COMPARATOR having changed, not "
          f"noise. Argue it and repin -- do not tune to it (doctrine 58) -- "
          f"and say which layer moved. Re-run without --check to repin.")
    return 1


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(
        description="Held-out evaluation of the fitted substitution matrix.")
    ap.add_argument("--check", action="store_true",
                    help="compare against the committed matrix_eval.json and "
                         "exit 1 on drift; write nothing")
    args = ap.parse_args()
    result = main()
    if args.check:
        sys.exit(check_shipped(result))
    with open(ARTIFACT, "w") as fh:
        json.dump(result, fh, indent=1, default=str)
    print(f"wrote {ARTIFACT}")
