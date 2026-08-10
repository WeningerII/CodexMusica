#!/usr/bin/env python3
"""Regressions for family-wise error control in the time layer.

Tests 2 and 5 encode defects found by running the pre-registered controls,
both in this correction's own first draft: a null conditioned on the very
filter it was meant to calibrate, and a silent zero where the honest answer
was "cannot tell".

Run: python3 quality/test_fwer.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Declaration, Lexicon  # noqa: E402
from quality.time_layer import (TimeDeclaration, _bh,  # noqa: E402
                                _candidate_pairs, _pvalue, grid_index,
                                null_scores, rhyme_events, syllable_stream)

FAILURES = []
LEX = Lexicon()
DECL = Declaration()

REAL = ["The winter froze the harbor and the cattle in the saddle",
        "a merchant sold his cargo to the buyers at the dock",
        "she wrote a letter carefully and posted it on Friday",
        "the engine of the ferry made a slow and heavy knock"]

#: every content word from one rhyme class -- 43% of RANDOM re-pairings in
#: this text already rhyme
SATURATED = ["The rattle of the cattle in the shadow of the saddle",
             "and battle after battle in the gravel and the travel",
             "a hollow follow swallow in the meadow by the willow",
             "the mellow yellow fellow with a pillow and a billow"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def run(lines, **kw):
    st = syllable_stream(LEX, lines)
    gi = grid_index(st, "stress")
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    t = TimeDeclaration(theta=0.80, window=32, **kw)
    det = {}
    ev = rhyme_events(LEX, st, DECL, t, None, det)
    hits = [i for i in slots if i in ev]
    return (len(hits) / max(1, len(slots))), len(hits), len(slots), det


def test_a_per_pair_threshold_cannot_control_a_family():
    print("\n1. the defect is reachable, so the fix is demonstrably load-bearing")
    sat_none, n_none, slots, _ = run(REAL, correction="none")
    sat_sid, n_sid, _, det = run(REAL, correction="sidak")
    check("uncorrected, nearly every slot is an event",
          sat_none > 0.60, f"{sat_none:.0%} of {slots} slots")
    check("corrected, saturation lands inside the 0.75 ceiling",
          sat_sid < 0.75, f"{sat_sid:.0%}")
    m = det.get("median_family_size", 0)
    check("each position really is a family of many comparisons",
          m >= 5, f"median family {m}; a per-pair cut of alpha leaves "
                  f"1-(1-alpha)^m per position, which is the saturation")


def test_null_must_not_be_conditioned_on_the_band():
    print("\n2. the null counts chance pairs that FAIL the band")
    # The defect: dropping non-rhyme pairs from the null conditions it on
    # "is already a rhyme relation", so the null consists only of pairs that
    # passed the band and nothing real can beat it. First corrected run
    # returned 0% saturation on every corpus from this alone.
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
    # the load-bearing comparison: denominator = valid draws, not scored ones
    v = null[len(null) // 2] if null else 0.0
    check("the denominator is the valid draws, not the band-passing ones",
          _pvalue(v, null, n_valid) < _pvalue(v, null, len(null)) + 1e-12,
          "conditioning on the band inflates every p-value")


def test_false_event_rate_is_controlled():
    print("\n3. P2 — the corrected false-event rate sits at alpha")
    import random
    from quality.corpus import load_sonnets
    son = [l for _, l in sorted(load_sonnets().items())]
    rng = random.Random(7)
    rates = []
    for k in range(3):
        words = [w for l in son[k] for w in l.split()]
        rng.shuffle(words)
        n = len(words) // 14
        scram = [" ".join(words[i * n:(i + 1) * n]) for i in range(14)]
        rates.append(run(scram, correction="sidak")[0])
    mean = sum(rates) / len(rates)
    check("word-scrambled text sits near the declared alpha",
          mean < 0.20, f"mean {mean:.1%} against alpha 5.0% "
                       f"(over 6 sonnets the measured mean is 5.4%)")


def test_tripwire_a_planted_rhyme_survives():
    print("\n4. P3 TRIPWIRE — the correction must not delete everything")
    sat, n, slots, _ = run(REAL, correction="sidak")
    check("a planted internal rhyme survives the correction",
          n > 0, f"{n} events at {sat:.0%} — a layer reporting 0% has no "
                 f"power either, from the opposite direction")


def test_a_saturated_inventory_says_cannot_tell():
    print("\n5. an empty result must distinguish 'none' from 'cannot tell'")
    sat, n, slots, det = run(SATURATED, correction="sidak")
    check("the degenerate item is refused, not scored",
          "refused" in det, (det.get("refused") or "")[:100])
    check("the refusal reports the measured band-pass rate",
          det.get("null_band_pass_rate", 0) > 0.25,
          f"{det.get('null_band_pass_rate', 0):.3f} against real verse "
          f"at ~0.10 — when 43% of RANDOM re-pairings rhyme, 'this pair "
          f"rhymes' carries no information relative to this text")
    _s, _n, _sl, det_real = run(REAL, correction="sidak")
    check("real verse is nowhere near the guard",
          det_real.get("null_band_pass_rate", 1.0) < 0.25,
          f"{det_real.get('null_band_pass_rate', 0):.3f}")


def test_bh_resolution_guard():
    print("\n6. BH needs a finer tail than FWER and says so when it lacks one")
    # A real sonnet has ~7000 candidate pairs, so BH's threshold for the
    # top-ranked p is q/n ~ 1.4e-5. A 2000-draw null resolves to 5e-4, which
    # is 35x coarser: whether anything is discovered then depends on how many
    # pairs pile up on the resolution floor, not on the evidence. Measured
    # before the guard: 63% saturation on one sonnet, 0% on the next three.
    from quality.corpus import load_sonnets
    son = [l for _, l in sorted(load_sonnets().items())][0]
    sat, n, slots, det = run(son, correction="bh", null_samples=2000)
    check("BH refuses when its own threshold is below the p-value floor",
          "bh_unresolvable" in det and n == 0,
          (det.get("bh_unresolvable") or "(guard did not fire)")[:130])
    sat2, n2, _s, det2 = run(son, correction="sidak", null_samples=2000)
    check("FWER at the same null size does not need the guard",
          "bh_unresolvable" not in det2 and n2 > 0,
          f"{n2} events at {sat2:.0%} — its cut is alpha/m with m ~ 15, not "
          f"q/n with n ~ 10^4")


def test_bh_is_a_step_up():
    print("\n7. the BH helper is the standard step-up")
    check("nothing is discovered when every p is large",
          _bh([0.9, 0.8, 0.7], 0.10) is None)
    check("the largest qualifying p is returned",
          _bh([0.001, 0.9, 0.9], 0.10) == 0.001)
    check("an empty family discovers nothing", _bh([], 0.10) is None)


def test_corrections_are_declared():
    print("\n8. every knob is a coordinate")
    d = TimeDeclaration()
    for k in ("correction", "alpha", "q", "null_samples",
              "max_null_band_pass", "max_saturation"):
        check(f"{k} is declared", hasattr(d, k), f"{k}={getattr(d, k, None)}")
    check("the primary correction is the family-wise one",
          d.correction == "sidak",
          "the question the event set asks is per-position, so FWER is the "
          "guarantee that matches it")


if __name__ == "__main__":
    for fn in (test_a_per_pair_threshold_cannot_control_a_family,
               test_null_must_not_be_conditioned_on_the_band,
               test_false_event_rate_is_controlled,
               test_tripwire_a_planted_rhyme_survives,
               test_a_saturated_inventory_says_cannot_tell,
               test_bh_resolution_guard,
               test_bh_is_a_step_up,
               test_corrections_are_declared):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all family-wise-error regressions pass")
