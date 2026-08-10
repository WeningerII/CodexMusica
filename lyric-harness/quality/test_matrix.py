#!/usr/bin/env python3
"""Regressions for the fitted substitution matrix.

Two of these encode defects found in this module's own first draft, both by
the pre-registered controls rather than by inspection: a zero-count cell that
scored +3.81 bits, and a stress cell that scored +5.71 and tripled the
false-positive rate on free verse.

Run: python3 quality/test_matrix.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Declaration, Lexicon  # noqa: E402
from quality.fit_matrix import (MatrixDeclaration,  # noqa: E402
                                FittedComparator, anchor_of, background_pairs,
                                collect, corpus_pairs, fit, fit_all,
                                fit_folds, mandated_pairs)

FAILURES = []
LEX = Lexicon()
DECL = Declaration()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


SONNET = "ABABCDCDEFEFGG"
TOY = [
    (["the winter came and covered up the stone",
      "a summer wind went whistling through the pine",
      "she left the gate and walked away alone",
      "he counted out the barrels of the wine"] * 3 +
     ["and so the season turned itself around",
      "and left the empty orchard on the ground"], SONNET),
]


def _toy_comparator(**kw):
    md = MatrixDeclaration(**kw)
    pos, words = corpus_pairs(TOY)
    bg = background_pairs(words, max(50, len(pos) * 4), md.seed)
    return FittedComparator(fit(collect(LEX, pos, DECL),
                                collect(LEX, bg, DECL), md), md)


def test_scale_has_a_true_zero():
    print("\n1. the log-odds scale has a true zero")
    c = _toy_comparator()
    vals = [v for tbl in c.m.values() for v in tbl.values()]
    check("some cells are negative",
          any(v < -0.01 for v in vals),
          "a substitution LESS likely under rhyme than chance must be able to "
          "score below zero; the additive comparator could not")
    check("some cells are exactly zero",
          any(abs(v) < 1e-9 for v in vals),
          "no evidence means no evidence")


def test_no_evidence_means_no_score():
    print("\n2. a cell with no observations may not score")
    # The defect: before evidence shrinkage the top learned correspondences
    # were UH~OY +3.81, OY~ER +1.37, OY~AW +1.26 -- all on ZERO observations.
    # OY is 0.1% of the corpus, so its marginal product is ~1e-5 and the
    # smoothing prior alone manufactured confidence. Seven of the top twelve.
    md = MatrixDeclaration()
    pos, words = corpus_pairs(TOY)
    pc = collect(LEX, pos, DECL)
    c = _toy_comparator()
    unseen = [(a, b) for (a, b) in c.m["nucleus"]
              if pc.get(("nucleus", a, b), 0) == 0 and a != b]
    check("every unobserved nucleus cell is ~0",
          all(abs(c.m["nucleus"][k]) < 1e-6 for k in unseen),
          f"{len(unseen)} unobserved cells, max |LO| "
          f"{max((abs(c.m['nucleus'][k]) for k in unseen), default=0):.2e}")
    loose = _toy_comparator(kappa=0.0)
    bad = [k for k in unseen if abs(loose.m["nucleus"][k]) > 1.0]
    check("without shrinkage the defect reappears (so the guard is load-bearing)",
          bool(bad),
          f"kappa=0 gives {len(bad)} unobserved cells above 1 bit — this is "
          f"the artifact the P8 tripwire caught")


def test_stress_channel_is_excluded_by_default():
    print("\n3. the stress channel is conditioning, not evidence")
    md = MatrixDeclaration()
    check("it is off by default", md.use_stress_channel is False,
          "anchor stress says which anchors are COMPARABLE; the background "
          "model treats it as independent, which it is not")
    c_on = _toy_comparator(use_stress_channel=True)
    c_off = _toy_comparator(use_stress_channel=False)
    aa = anchor_of(LEX, "sun", DECL)
    ab = anchor_of(LEX, "much", DECL)
    on, parts_on = c_on.score(aa, ab)
    off, parts_off = c_off.score(aa, ab)
    check("the stress channel contributes nothing when off",
          "stress" not in parts_off and "stress" in parts_on,
          f"on: {sorted(parts_on)}; off: {sorted(parts_off)}")
    check("and the two scores therefore differ", abs(on - off) > 1e-9,
          f"{on:+.3f} vs {off:+.3f} bits")


def test_empty_coda_stops_paying_full_price():
    print("\n4. P3 — an absent coda must not pay what a matching coda pays")
    c = _toy_comparator()
    empty = c.m["coda"].get(("0", "0"), 0.0)
    present = [c.m["coda"].get((x, x), 0.0) for x in ("N", "T", "D", "S", "L")]
    seen = [v for v in present if abs(v) > 1e-9]
    check("empty/empty earns nothing", abs(empty) < 1e-6,
          f"empty {empty:+.3f}; the additive comparator gave two ABSENT codas "
          f"the full 1.0 of the coda weight for having nothing in common")
    check("a matching consonant coda still earns",
          any(v > 0.01 for v in seen),
          f"matching {['%+.2f' % v for v in seen]} on this toy corpus; on the "
          f"152 sonnets it is N:+3.17 T:+2.94 D:+3.54 S:+3.79 L:+4.45 against "
          f"empty/empty at -0.000")


def test_folds_never_score_their_own_training_items():
    print("\n5. doctrine 13 — held-out by construction")
    items = TOY * 5
    folds = fit_folds(LEX, items, MatrixDeclaration(folds=5), DECL)
    check("one comparator per fold", len(folds) == 5)
    check("every fold declares what it held out",
          all("fold" in comp.mdecl.holdout for _, comp in folds),
          folds[0][1].mdecl.holdout)
    ship = fit_all(LEX, items, MatrixDeclaration(), DECL, source="toy")
    check("the shippable matrix declares that it is NOT held out",
          "NONE" in ship.mdecl.holdout and "circular" in ship.mdecl.holdout,
          ship.mdecl.holdout[:88])
    check("the two are distinguishable at the call site",
          ship.mdecl.holdout != folds[0][1].mdecl.holdout,
          "a matrix fitted on everything cannot be mistaken for a held-out one")


def test_mandated_pairs_come_from_the_form():
    print("\n6. training labels are the form's, not anyone's judgement")
    ps = mandated_pairs(list(range(14)), SONNET)
    # seven rhyme letters, each appearing exactly twice
    check("ABABCDCDEFEFGG mandates 7 pairs",
          len(ps) == 7, f"{len(ps)}: {ps}")
    check("a scheme of the wrong length mandates nothing",
          mandated_pairs(list(range(4)), SONNET) == [],
          "a mismatch must not silently produce partial labels")


def test_round_trip():
    print("\n7. a matrix survives serialization exactly")
    c = _toy_comparator()
    back = FittedComparator.from_json(c.to_json())
    same = all(abs(c.m[ch][k] - back.m[ch][k]) < 5e-4
               for ch in c.m for k in c.m[ch])
    check("every cell round-trips", same)
    check("the declaration round-trips too",
          back.mdecl.kappa == c.mdecl.kappa
          and back.mdecl.use_stress_channel == c.mdecl.use_stress_channel)


def test_default_comparator_is_still_the_hand_set_one():
    print("\n8. nothing switches by default")
    # The evaluation says the fitted matrix is not better: held-out AUC 0.9031
    # vs 0.9043, and 35.3% vs 18.7% on the Whitman negative control at matched
    # FPR. So it must not become the default by accident.
    check("Declaration.fitted is still False",
          Declaration().fitted is False,
          "doctrine 5 stays honest: the shipped weights are hand-set, and "
          "the fitted matrix did not earn the default")
    from quality.time_layer import rhyme_events
    import inspect
    sig = inspect.signature(rhyme_events)
    check("the time layer takes a comparator but defaults to None",
          sig.parameters["comparator"].default is None)
    from lyric_harness import infer_chains
    sig2 = inspect.signature(infer_chains)
    check("chain inference takes a comparator but defaults to None",
          sig2.parameters["comparator"].default is None)


if __name__ == "__main__":
    for fn in (test_scale_has_a_true_zero,
               test_no_evidence_means_no_score,
               test_stress_channel_is_excluded_by_default,
               test_empty_coda_stops_paying_full_price,
               test_folds_never_score_their_own_training_items,
               test_mandated_pairs_come_from_the_form,
               test_round_trip,
               test_default_comparator_is_still_the_hand_set_one):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all fitted-matrix regressions pass")
