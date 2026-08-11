#!/usr/bin/env python3
"""Regressions for family-wise error control in the time layer.

Tests 2 and 6 encode defects found by running the pre-registered controls, both
in this correction's own first draft: a null conditioned on the very filter it
was meant to calibrate, and a silent zero where the honest answer was
"cannot tell".

REWRITTEN 2026-08-11, and the reason is the point of the file.

`b1d7f64` changed the rhyme band -- tail alignment plus `theta_coda` 0.60 ->
0.80, both held out on the band's own false-positive rate -- and broke every
assertion here. Not because the band change was wrong; it is right, and it
stands. Because FOUR OF THESE ASSERTIONS WERE CONSTANTS THAT ENCODED A
CALIBRATION ONLY TRUE AT ONE BAND SETTING, and one of them was guarding a
correction that had made the same mistake in code:

    m -- the family size in `alpha/m` -- WAS MEASURED, and measured from the
    pairs that SURVIVED the band rather than from the comparisons that were
    MADE. So a better band shrank m, which LOOSENED the Sidak cut, which RAISED
    the corrected false-event rate: 8.8% -> 25.5% flush-left and 6.8% -> 26.7%
    flush-right against a declared alpha of 5%.

Every assertion below is now written against a coordinate of the declaration or
a quantity measured from the item's own null, never against a number somebody
read off one run (doctrine 58). Where the number has to be a constant --
`max_null_band_pass` -- the constant carries its calibration basis and there is
a runner that re-measures it: `python3 quality/fwer_family.py --calibrate`.

Run: python3 quality/test_fwer.py
Slower sibling that produced these numbers: python3 quality/fwer_family.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import lyric_harness as LH  # noqa: E402
from lyric_harness import Declaration  # noqa: E402
#: the fixtures, the pre-b1d7f64 comparator and the probe all live in the
#: runner that measured them, so the test and the measurement cannot drift
#: apart -- and its Lexicon is reused rather than loaded twice.
from quality.fwer_family import (LEX, REAL, SATURATED,  # noqa: E402
                                 TAIL_ALIGNED, head_agreement, probe,
                                 scrambled_sonnets)
from quality.time_layer import (TimeDeclaration, _bh,  # noqa: E402
                                _candidate_pairs, _pvalue, grid_index,
                                null_scores, rhyme_events, syllable_stream)

FAILURES = []
DECL = Declaration()

#: How many word-scrambled sonnets the alpha claim is measured on. Doctrine 72:
#: "5.4% against 5.0%" was six sonnets and the guarding test used three with a
#: tolerance of 0.20, which cannot detect a 2x miss. An alpha claim is a claim
#: about a long-run rate; measure it at a length that could falsify it.
N_H0 = 20
#: enough to show a 3x move in the false-event rate, which is what the family
#: coordinate produces. Not an alpha measurement -- test 3 is.
N_H0_FAST = 6


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def run(lines, decl=None, **kw):
    """-> (saturation, n_events, n_slots, detail)."""
    decl = decl or DECL
    st = syllable_stream(LEX, lines)
    gi = grid_index(st, "stress")
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    t = TimeDeclaration(theta=0.80, window=32, **kw)
    det = {}
    ev = rhyme_events(LEX, st, decl, t, None, det)
    hits = [i for i in slots if i in ev]
    return (len(hits) / max(1, len(slots))), len(hits), len(slots), det


def h0_rate(decl, n=N_H0_FAST, **kw):
    """-> (pooled false-event rate, items that went MUTE, decisions) on
    word-scrambled sonnets. Vocabulary and phonology preserved, structure
    destroyed.

    POOLED over slots, not averaged over items, and the difference is the whole
    point of doctrine 72. The claim `alpha = 0.05` is a claim about a per-slot
    long-run rate, so its standard error is set by the number of SLOT
    DECISIONS (~65 per sonnet), not by the number of sonnets. Averaging
    per-item rates and putting an item-count standard error on it is how a
    tolerance of 0.20 came to guard a claim of 0.05.
    """
    ev, slots, mute = 0, 0, 0
    for s in scrambled_sonnets(n):
        _sat, k, sl, det = run(s, decl, **kw)
        ev += k
        slots += sl
        if det.get("cannot_tell") or det.get("refused"):
            mute += 1
    return (ev / max(1, slots)), mute, slots


def test_a_per_pair_threshold_cannot_control_a_family():
    print("\n1. the defect is reachable, and its size is DERIVED not recalled")
    # WAS: `sat_none > 0.60`. That constant was 70.0% measured flush-left at
    # theta_coda 0.60; the band moved and the same run gives 55.0%, so the
    # assertion failed while nothing about the mechanism had changed. The
    # mechanism is arithmetic: a position compared against m candidates at a
    # per-pair false-positive rate r is an event with probability 1-(1-r)^m,
    # and BOTH r and m are measurable from the item under whatever band is
    # declared. Assert the arithmetic, not last month's answer.
    t = TimeDeclaration(theta=0.80, window=32)
    p = probe(REAL, DECL, t)
    r, m = p["r"], p["m_cand"]
    predicted = p["predicted_none"]
    check("the declaration implies a per-position error far past alpha",
          predicted > 10 * t.alpha,
          f"1-(1-r)^m = {predicted:.1%} with r={r:.4f} (per-pair FPR at "
          f"theta={t.theta}, over ALL valid chance draws) and m={m} "
          f"(candidate comparisons per position); alpha={t.alpha}")
    check("the uncorrected saturation tracks that prediction",
          p["sat_none"] >= 0.5 * predicted,
          f"observed {p['sat_none']:.1%} against predicted {predicted:.1%}; "
          f"the prediction over-reads by a stable ~1.4x across all four band "
          f"settings because the median family overstates a typical "
          f"position's DISTINCT comparisons and the tests are positively "
          f"dependent")
    check("corrected saturation lands inside the declared ceiling",
          p["sat_corr"] < t.max_saturation,
          f"{p['sat_corr']:.1%} against {t.max_saturation:.0%}")
    check("each position really is a family of many comparisons",
          m >= 5, f"median family {m}")


def test_the_family_is_measured_over_the_comparisons_made():
    print("\n2. M-4a — m is the comparisons MADE, not the ones that survived")
    # THE REGRESSION FOR THE DEFECT THIS ROUND FOUND. `family='scored'`
    # counts only band-passing pairs, so m is a function of the band and the
    # Sidak cut 1-(1-alpha)^(1/m) LOOSENS when the band TIGHTENS. Nothing in
    # the layer said the family was a measurement at all, so a change validated
    # on the band's own false-positive rate silently tripled the time layer's.
    loose, tight = Declaration(theta_coda=0.60), Declaration(theta_coda=0.80)
    bad_l, _m, _d = h0_rate(loose, family="scored")
    bad_t, _m, _d = h0_rate(tight, family="scored")
    check("the defect is reachable and moves with the band",
          bad_t > 2 * bad_l,
          f"family='scored': H0 false-event rate {bad_l:.1%} at theta_coda "
          f"0.60 -> {bad_t:.1%} at 0.80. A TIGHTER band gives a HIGHER "
          f"corrected error rate, which is the signature of an m that is "
          f"counted downstream of the filter")
    good_l, mute_l, _d = h0_rate(loose, family="candidate")
    good_t, mute_t, _d = h0_rate(tight, family="candidate")
    check("counting the candidates makes the rate invariant to the band",
          abs(good_t - good_l) <= 0.02,
          f"family='candidate': {good_l:.1%} at theta_coda 0.60, "
          f"{good_t:.1%} at 0.80 — the correction no longer reads the band")
    check("the primary family population is the candidates",
          TimeDeclaration().family == "candidate",
          f"'scored' stays reachable so the defect stays demonstrable "
          f"(doctrine 84); it is not the default")
    check("and the invariance is not bought by muting only the tight arm",
          mute_l == mute_t,
          f"{mute_l}/{N_H0_FAST} and {mute_t}/{N_H0_FAST} H0 items refuse "
          f"under either band — the power cost is real and it is the SAME "
          f"cost at both settings, so it is not the band that caused it")


def test_false_event_rate_is_controlled():
    print("\n3. P2 — the corrected false-event rate sits at alpha")
    # WAS: three sonnets, `mean < 0.20`. Doctrine 72: a tolerance of 0.20
    # against a claim of 0.05 cannot detect a 2x miss, and n=3 cannot detect
    # much of anything. The tolerance is now the CLAIM plus its Monte-Carlo
    # slack, and n is 20.
    t = TimeDeclaration()
    mean, mute, decisions = h0_rate(DECL, n=N_H0)
    tol = t.alpha + 2.0 * (t.alpha * (1 - t.alpha) / decisions) ** 0.5
    check("word-scrambled text sits at or below the declared alpha",
          mean <= tol,
          f"pooled {mean:.1%} over {decisions} slot decisions in n={N_H0} "
          f"items, against alpha {t.alpha:.1%} (tolerance {tol:.1%} = alpha + "
          f"2 s.e. on {decisions} decisions). The tolerance is set from the "
          f"CLAIM, and at this width a 2x miss — the 9.6% doctrine 72 "
          f"measured — FAILS, which `mean < 0.20` on three sonnets could not")
    # A ZERO IS NOT AUTOMATICALLY A PASS. Doctrine 30: a layer reporting 0%
    # has no power either, from the opposite direction, and an alpha test that
    # cannot tell "controlled" from "mute" is not a test.
    check("a zero rate is accounted for, never just accepted",
          mean > 0 or mute > 0,
          f"{mute}/{N_H0} H0 items returned CANNOT TELL rather than 0 events. "
          f"At the honest family size the rate is {mean:.1%} because the "
          f"instrument is mute on this material, not because alpha was hit — "
          f"and the layer says which")


def test_tripwire_a_planted_rhyme_survives():
    print("\n4. P3 TRIPWIRE — REGISTERED FORM FALSIFIED, kept and restated")
    # Doctrine 17: a check may be kept after its premise is falsified, but
    # never quoted as if it were not. P3 as registered was `n > 0` on an item
    # with one planted internal rhyme, and at the honest family size it is
    # FALSE. That is not a reason to loosen m -- it is the measurement.
    sat, n, slots, det = run(REAL)
    print(f"          P3 as registered (n > 0): "
          f"{'HOLDS' if n > 0 else 'FALSIFIED'} — {n} events at {sat:.0%}")
    check("an unfirable item REFUSES instead of reporting zero events",
          n > 0 or "cannot_tell" in det,
          (det.get("cannot_tell") or f"{n} events")[:200])
    check("the refusal is arithmetic anyone can check",
          n > 0 or (det.get("min_attainable_p", 0) > det.get("loosest_cut", 1)),
          f"best attainable p {det.get('min_attainable_p', 0):.2e} against "
          f"the loosest per-position cut {det.get('loosest_cut', 0):.2e}; the "
          f"floor is the number of CHANCE re-pairings of this item's own "
          f"spans that are themselves perfect rhymes")
    # PRICE THE COST OUT LOUD (doctrine 94). The planted rhyme DID survive at
    # the undercounted family size, so the fix is a real loss of events and the
    # test says so rather than only recording the pass.
    _s, n_old, _sl, _d = run(REAL, family="scored")
    check("the cost is priced, not buried",
          n_old > n,
          f"family='scored' returns {n_old} events here and "
          f"family='candidate' returns {n}. Those {n_old} were bought by a "
          f"cut {det.get('loosest_cut', 0):.1e} -> looser, i.e. by not "
          f"counting the comparisons that failed the band")


def test_a_saturated_inventory_says_cannot_tell():
    print("\n5. doctrine 28's tripwire, and its threshold is a COORDINATE")
    t = TimeDeclaration()
    check("the guard carries the setting it was measured at",
          "theta_coda" in t.max_null_band_pass_basis
          and "alignment" in t.max_null_band_pass_basis,
          t.max_null_band_pass_basis[:150])
    # THE HALF THAT WENT SILENT. Tail alignment alone moved the degenerate
    # item's band-pass rate 0.429 -> 0.226 and the 0.25 constant stopped
    # firing, so the mechanism that distinguishes "none" from "cannot tell"
    # was dead while every test still passed. The threshold was stale, not the
    # guard -- shown from the null's own distribution over 30 sonnets, where
    # real verse runs 0.042-0.076 and the old reference "~0.10" is also stale.
    for align, fn in (("tail (shipped)", TAIL_ALIGNED),
                      ("head (pre-b1d7f64)", head_agreement)):
        LH.channel_agreement = fn
        try:
            _s, _n, _sl, det = run(SATURATED)
            _s2, _n2, _sl2, det_real = run(REAL)
        finally:
            LH.channel_agreement = TAIL_ALIGNED
        check(f"the degenerate item is refused under {align}",
              "refused" in det, (det.get("refused") or "")[:110])
        check(f"the refusal reports a band-pass rate above the guard "
              f"under {align}",
              det.get("null_band_pass_rate", 0) > t.max_null_band_pass,
              f"{det.get('null_band_pass_rate', 0):.3f} against a guard of "
              f"{t.max_null_band_pass:.3f}")
        check(f"real verse is nowhere near the guard under {align}",
              det_real.get("null_band_pass_rate", 1.0) < t.max_null_band_pass,
              f"{det_real.get('null_band_pass_rate', 0):.3f}")


def test_null_must_not_be_conditioned_on_the_band():
    print("\n6. the null counts chance pairs that FAIL the band")
    # The defect: dropping non-rhyme pairs from the null conditions it on
    # "is already a rhyme relation", so the null consists only of pairs that
    # passed the band and nothing real can beat it. First corrected run
    # returned 0% saturation on every corpus from this alone. The family-size
    # defect in test 2 is THE SAME ERROR one layer up, in this same module.
    st = syllable_stream(LEX, REAL)
    t = TimeDeclaration(theta=0.80, window=32, null_samples=3000)
    pairs = _candidate_pairs(st, t)
    null, n_valid = null_scores(st, pairs, DECL, t, None)
    check("null_scores reports the valid-draw count separately",
          n_valid > len(null),
          f"{len(null)} scored, {n_valid} valid draws — the difference is "
          f"chance pairs that failed the band and still belong in the "
          f"denominator")
    p_all = _pvalue(999.0, null, n_valid)
    check("an unbeatable score gets the resolution floor, never zero",
          p_all == 1.0 / (n_valid + 1), f"p = {p_all:.2e}")
    v = null[len(null) // 2] if null else 0.0
    check("the denominator is the valid draws, not the band-passing ones",
          _pvalue(v, null, n_valid) < _pvalue(v, null, len(null)) + 1e-12,
          "conditioning on the band inflates every p-value")


def test_bh_resolution_guard():
    print("\n7. BH needs a finer tail than FWER and says so when it lacks one")
    from quality.corpus import load_sonnets
    son = [l for _, l in sorted(load_sonnets().items())][0]
    sat, n, slots, det = run(son, correction="bh", null_samples=2000)
    check("BH refuses when its own threshold is below the p-value floor",
          "bh_unresolvable" in det and n == 0,
          (det.get("bh_unresolvable") or "(guard did not fire)")[:130])
    sat2, n2, _s, det2 = run(son, correction="sidak", null_samples=2000)
    m2, n_pairs = det2["median_family_size"], det2["n_candidate_pairs"]
    check("FWER's threshold is orders of magnitude coarser than BH's",
          det2["per_pair_cut"] > 10 * (TimeDeclaration().q / n_pairs),
          f"alpha/m with m = {m2} is {det2['per_pair_cut']:.1e}; q/n with "
          f"n = {n_pairs} is {TimeDeclaration().q / n_pairs:.1e}. That "
          f"ordering is what doctrine 29 claims and it survives")
    # DOCTRINE 29 IS AMENDED BY THIS ROUND, and the test says so rather than
    # quoting the old number. "FWER's cut is alpha/m with m ~ 15 and needs no
    # such tail" was written when m was the SCORED family. The candidate
    # family is ~13x larger, so FWER's required resolution is ~13x finer --
    # still coarse next to BH's, but no longer free: at null_samples=2000 the
    # cut is BELOW the p-value floor and FWER cannot resolve its own threshold
    # either. It is the DEFAULT null_samples that rescues it, which makes
    # null_samples load-bearing where doctrine 29 implied it was not.
    print(f"          AMENDS DOCTRINE 29: at null_samples=2000 the FWER cut "
          f"{det2['per_pair_cut']:.1e} sits BELOW the p-value floor "
          f"{det2['p_resolution']:.1e}. m ~ 15 was the scored family.")
    d = TimeDeclaration()
    _s3, _n3, _sl3, det3 = run(son, correction="sidak")
    check("the DEFAULT declaration resolves its own FWER cut",
          det3["per_pair_cut"] > det3["p_resolution"],
          f"cut {det3['per_pair_cut']:.1e} against resolution "
          f"{det3['p_resolution']:.1e} at null_samples={d.null_samples} — "
          f"{det3['per_pair_cut'] / det3['p_resolution']:.0f}x of headroom, "
          f"where BH would need {int(n_pairs / d.q)} draws")


def test_bh_is_a_step_up():
    print("\n8. the BH helper is the standard step-up")
    check("nothing is discovered when every p is large",
          _bh([0.9, 0.8, 0.7], 0.10) is None)
    check("the largest qualifying p is returned",
          _bh([0.001, 0.9, 0.9], 0.10) == 0.001)
    check("an empty family discovers nothing", _bh([], 0.10) is None)
    check("the family size may exceed the p-values supplied",
          _bh([0.001], 0.10, 1000) is None,
          "pairs that fail the band are hypotheses with p = 1; they never "
          "qualify but they stay in n")


def test_corrections_are_declared():
    print("\n9. every knob is a coordinate")
    d = TimeDeclaration()
    for k in ("correction", "family", "alpha", "q", "null_samples",
              "max_null_band_pass", "max_null_band_pass_basis",
              "max_saturation"):
        check(f"{k} is declared", hasattr(d, k),
              f"{k}={str(getattr(d, k, None))[:60]}")
    check("the primary correction is the family-wise one",
          d.correction == "sidak",
          "the question the event set asks is per-position, so FWER is the "
          "guarantee that matches it")


if __name__ == "__main__":
    for fn in (test_a_per_pair_threshold_cannot_control_a_family,
               test_the_family_is_measured_over_the_comparisons_made,
               test_false_event_rate_is_controlled,
               test_tripwire_a_planted_rhyme_survives,
               test_a_saturated_inventory_says_cannot_tell,
               test_null_must_not_be_conditioned_on_the_band,
               test_bh_resolution_guard,
               test_bh_is_a_step_up,
               test_corrections_are_declared):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all family-wise-error regressions pass")
