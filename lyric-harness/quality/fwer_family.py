#!/usr/bin/env python3
"""The family size is a MEASUREMENT, and it was being read off the wrong set.

WHY THIS FILE EXISTS

`b1d7f64` shipped two changes to the rhyme band -- tail alignment in
`channel_agreement`, and `theta_coda` 0.60 -> 0.80 -- both held out on the
band's own false-positive rate and on the sonnet violation rate. Neither was
ever run against the time layer, and together they broke every assertion in
`quality/test_fwer.py`. The diagnosis was that the comparison family had become
a FUNCTION of the band while the correction treated it as a constant. This file
is the measurement that settles it, and the runner that re-measures the two
constants after any future change to the band, so neither is ever again a
number somebody remembers (doctrine 58).

WHAT IT MEASURES

  --grid        the 2x2: {head, tail} alignment x theta_coda {0.60, 0.80},
                each at family={scored, candidate}. Alignment is monkeypatched
                in-process and theta_coda is a Declaration field, so this needs
                no shadow tree and no disk.
  --calibrate   the distribution of the null band-pass rate and of the
                attainable-p / cut ratio over 30 real sonnets, which is where
                `max_null_band_pass` comes from.

THE FINDING, in one line: `m` was measured, but from the pairs that SURVIVED
the band rather than from the comparisons that were MADE, so tightening the
band shrank m, which loosened `1-(1-alpha)^(1/m)`, which raised the corrected
false-event rate ~3x in BOTH alignments.
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import lyric_harness as LH                                     # noqa: E402
from lyric_harness import (Declaration, Lexicon,               # noqa: E402
                           cluster_sim, vowel_sim)
from quality.time_layer import (TimeDeclaration,               # noqa: E402
                                _candidate_pairs, _pvalue, _raw_score,
                                grid_index, null_scores, rhyme_events,
                                syllable_stream)

LEX = Lexicon()

#: one planted internal rhyme (cattle/saddle) among otherwise unrelated words
REAL = ["The winter froze the harbor and the cattle in the saddle",
        "a merchant sold his cargo to the buyers at the dock",
        "she wrote a letter carefully and posted it on Friday",
        "the engine of the ferry made a slow and heavy knock"]

#: every content word from ONE rhyme class -- doctrine 28's fixture
SATURATED = ["The rattle of the cattle in the shadow of the saddle",
             "and battle after battle in the gravel and the travel",
             "a hollow follow swallow in the meadow by the willow",
             "the mellow yellow fellow with a pillow and a billow"]

TAIL_ALIGNED = LH.channel_agreement


def head_agreement(anc_a, anc_b, decl):
    """The pre-`b1d7f64` flush-LEFT comparator, reachable ONLY from here.

    It is wrong -- rhyme aligns flush right (doctrine 95) -- and it is kept so
    the 2x2 can separate the alignment's contribution from `theta_coda`'s. The
    answer is that the alignment contributes nothing to the false-event blowup
    and everything to the degenerate-item guard falling silent.

    IT REPLICATES ONE COORDINATE AND ONLY ONE. `channel_agreement` grew a
    `nucleus_agreement` shape after this was written; under any value but
    "scalar" this function would differ from the shipped comparator in TWO
    coordinates at once and the 2x2 would attribute the wrong cause. It refuses
    rather than quietly comparing two different things.
    """
    if getattr(decl, "nucleus_agreement", "scalar") != "scalar":
        raise ValueError(
            f"head_agreement replicates the pre-b1d7f64 comparator, whose "
            f"nucleus predicate is the scalar min(vowel_sim). This "
            f"declaration says nucleus_agreement="
            f"{decl.nucleus_agreement!r}, so a head-vs-tail contrast run "
            f"through it would be confounded with the nucleus shape. Port the "
            f"shape here deliberately, or run the grid at nucleus_agreement="
            f"'scalar' and say so.")
    n = min(len(anc_a), len(anc_b))
    if not n:
        return False, False
    nuc = min(vowel_sim(anc_a[i]["nucleus"], anc_b[i]["nucleus"])
              for i in range(n))
    codas = []
    for i in range(n):
        ca, cb = anc_a[i]["coda"], anc_b[i]["coda"]
        codas.append(1.0 if (not ca and not cb) else cluster_sim(ca, cb))
    return nuc >= decl.theta_nucleus, min(codas) >= decl.theta_coda


def probe(lines, decl, tdecl):
    """Everything the correction uses and everything it should have used."""
    st = syllable_stream(LEX, lines)
    gi = grid_index(st, tdecl.grid_unit)
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    pairs = _candidate_pairs(st, tdecl)
    null, n_valid = null_scores(st, pairs, decl, tdecl, None)

    fam_c, fam_s, ps = {}, {}, []
    uncorrected = set()
    best = 0.0
    for k, (sa, sb) in enumerate(pairs):
        span = list(range(*sa)) + list(range(*sb))
        for pos in span:
            fam_c.setdefault(pos, []).append(k)
        v = _raw_score(st, sa, sb, decl, None)
        if v is None:
            continue
        for pos in span:
            fam_s.setdefault(pos, []).append(k)
        ps.append(_pvalue(v, null, n_valid))
        best = max(best, v)
        if v >= tdecl.theta:
            uncorrected.update(span)

    def med(d):
        xs = sorted(len(v) for v in d.values())
        return xs[len(xs) // 2] if xs else 0

    m_cand, m_scored = med(fam_c), med(fam_s)
    # r: the per-pair false-positive rate at the declared theta, over ALL valid
    # chance draws. This is doctrine 22's currency -- a threshold stated as a
    # rate -- and it is the only quantity in the uncorrected saturation that
    # the band moves.
    r = sum(1 for v in null if v >= tdecl.theta) / n_valid if n_valid else 0.0
    det = {}
    ev = rhyme_events(LEX, st, decl, tdecl, None, det)
    return dict(
        n_slots=len(slots), n_pairs=len(pairs), n_scored=len(ps),
        band_pass=len(null) / n_valid if n_valid else 0.0,
        r=r, m_cand=m_cand, m_scored=m_scored,
        sat_none=len([i for i in slots if i in uncorrected]) / max(1, len(slots)),
        sat_corr=len([i for i in slots if i in ev]) / max(1, len(slots)),
        predicted_none=1 - (1 - r) ** m_cand if m_cand else 0.0,
        min_p=min(ps) if ps else 1.0,
        loosest_cut=det.get("loosest_cut", 1.0),
        refused=("refused" in det), cannot_tell=("cannot_tell" in det))


def scrambled_sonnets(n, seed=7):
    """Word-scramble: vocabulary and phonology preserved, structure destroyed.
    The registered H0 for the false-event rate."""
    from quality.corpus import load_sonnets
    son = [l for _, l in sorted(load_sonnets().items())]
    rng = random.Random(seed)
    out = []
    for i in range(n):
        words = [w for l in son[i] for w in l.split()]
        rng.shuffle(words)
        k = len(words) // 14
        out.append([" ".join(words[j * k:(j + 1) * k]) for j in range(14)])
    return out


def quantile(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))]


def run_grid(n_scram=6):
    tdecl_base = dict(theta=0.80, window=32)
    scram = scrambled_sonnets(n_scram)
    print(f"\nTHE 2x2, plus the family coordinate. alpha=0.05, "
          f"{n_scram} word-scrambled sonnets as H0.\n")
    print(f"{'family':10} {'align':5} {'th_coda':>7} | {'H0 rate':>8} "
          f"{'H0 mute':>7} | {'sat_none':>8} {'pred':>6} | {'m':>4} "
          f"{'cut':>9} | {'deg bp':>7} {'deg ref':>7} {'REAL':>6}")
    print("-" * 106)
    rows = []
    for fam in ("scored", "candidate"):
        for align, fn in (("head", head_agreement), ("tail", TAIL_ALIGNED)):
            LH.channel_agreement = fn
            for tc in (0.60, 0.80):
                decl = Declaration(theta_coda=tc)
                t = TimeDeclaration(family=fam, **tdecl_base)
                tno = TimeDeclaration(family=fam, max_null_band_pass=1.01,
                                      **tdecl_base)
                h0s = [probe(s, decl, t) for s in scram]
                h0 = sum(x["sat_corr"] for x in h0s) / len(h0s)
                # An H0 rate of 0 has two causes and they are not the same
                # result: alpha was met, or nothing could ever have fired.
                mute = sum(1 for x in h0s if x["cannot_tell"] or x["refused"])
                p = probe(REAL, decl, t)
                d = probe(SATURATED, decl, tno)
                dg = probe(SATURATED, decl, t)
                m = p["m_scored"] if fam == "scored" else p["m_cand"]
                cut = 1 - 0.95 ** (1.0 / m) if m else 1.0
                real = ("MUTE" if p["cannot_tell"] else f"{p['sat_corr']:.0%}")
                print(f"{fam:10} {align:5} {tc:7.2f} | {h0:8.1%} "
                      f"{mute:3d}/{len(h0s):<3d} | "
                      f"{p['sat_none']:8.1%} {p['predicted_none']:6.1%} | "
                      f"{m:4d} {cut:9.2e} | {d['band_pass']:7.3f} "
                      f"{str(dg['refused']):>7} {real:>6}")
                rows.append((fam, align, tc, h0, mute))
    LH.channel_agreement = TAIL_ALIGNED
    print("\nREAD IT DOWN THE `H0 rate` COLUMN.")
    print("  family=scored:    the rate ~3x's when theta_coda tightens, in "
          "BOTH alignments,")
    print("                    because m is counted over band SURVIVORS. "
          "A better band")
    print("                    shrinks the family, which LOOSENS "
          "1-(1-alpha)^(1/m).")
    print("  family=candidate: the rate is invariant to both coordinates, "
          "because m is")
    print("                    counted over the comparisons MADE. That is "
          "the fix -- and")
    print("                    `H0 mute` says what it costs: every item goes "
          "MUTE, so the")
    print("                    0.0% is a REFUSAL and not an alpha. At the "
          "honest family")
    print("                    size this event set has no power on any item "
          "in this repo,")
    print("                    which is doctrine 30 read in the other "
          "direction.")
    print("  `sat_none` vs `pred`: the uncorrected saturation against "
          "1-(1-r)^m, the")
    print("                    per-position error a per-pair threshold "
          "implies. Same")
    print("                    mechanism, same arithmetic, read forwards.")
    return rows


def run_calibrate(n=30):
    """Where `max_null_band_pass` comes from -- a distribution, not a guess."""
    decl = Declaration()
    t = TimeDeclaration(theta=0.80, window=32, max_null_band_pass=1.01)
    from quality.corpus import load_sonnets
    son = [l for _, l in sorted(load_sonnets().items())]
    print(f"\nCALIBRATION. alignment=tail, theta_coda={decl.theta_coda}, "
          f"theta={t.theta}, window={t.window}, null_samples={t.null_samples}")
    print(f"n = {n} Shakespeare sonnets.\n")
    bp, ratio = [], []
    for i in range(n):
        p = probe(son[i], decl, t)
        bp.append(p["band_pass"])
        ratio.append(p["min_p"] / p["loosest_cut"] if p["loosest_cut"] else 0)
    print(f"  null band-pass rate   min {min(bp):.3f}  p50 "
          f"{quantile(bp, .50):.3f}  p95 {quantile(bp, .95):.3f}  "
          f"max {max(bp):.3f}")
    print(f"  -> max_null_band_pass = 2 x max = {2 * max(bp):.3f}   "
          f"(TimeDeclaration ships "
          f"{TimeDeclaration().max_null_band_pass})")
    print(f"  min attainable p / loosest cut   min {min(ratio):.1f}x  "
          f"p50 {quantile(ratio, .50):.1f}x  max {max(ratio):.1f}x")
    print(f"     every value above 1.0 is an item in which NO event was "
          f"attainable at all.")
    for label, lines in (("REAL (one planted rhyme)", REAL),
                         ("SATURATED (one class)", SATURATED)):
        p = probe(lines, decl, t)
        print(f"  {label:26} band-pass {p['band_pass']:.3f}   "
              f"min_p/cut {p['min_p'] / p['loosest_cut']:.1f}x")
    print("\n  The old 0.25 was this same quantity measured flush-LEFT at "
          "theta_coda 0.60,")
    print("  where real verse read ~0.10 and the degenerate fixture 0.43. "
          "Both halves of")
    print("  that sentence moved when the band moved, and nothing said so.")
    return bp, ratio


def run_arms(n_real=20, n_scram=20):
    """The comparison MISSING L-2 says has never separated: real sonnets
    against their own word-scramble, on event rate. Run at BOTH family sizes,
    because the answer differs and the difference is the whole finding."""
    decl = Declaration()
    from quality.corpus import load_sonnets
    son = [l for _, l in sorted(load_sonnets().items())]
    print(f"\nARMS. real sonnets vs their own word-scramble, n={n_real}/"
          f"{n_scram}, alpha=0.05\n")
    print(f"{'family':10} {'arm':10} | {'mute':>7} {'mean sat':>9} "
          f"{'items>0':>8} {'p50 min_p/cut':>14}")
    print("-" * 66)
    scram = scrambled_sonnets(n_scram)
    out = {}
    for fam in ("scored", "candidate"):
        t = TimeDeclaration(theta=0.80, window=32, family=fam)
        for arm, items in (("real", son[:n_real]), ("scramble", scram)):
            ps = [probe(it, decl, t) for it in items]
            mute = sum(1 for x in ps if x["cannot_tell"] or x["refused"])
            sat = sum(x["sat_corr"] for x in ps) / len(ps)
            pos = sum(1 for x in ps if x["sat_corr"] > 0)
            rat = quantile([x["min_p"] / x["loosest_cut"] for x in ps], .50)
            out[(fam, arm)] = sat
            print(f"{fam:10} {arm:10} | {mute:3d}/{len(ps):<3d} {sat:9.1%} "
                  f"{pos:8d} {rat:13.1f}x")
    print(f"\n  family=scored    real {out[('scored','real')]:.1%} vs "
          f"scramble {out[('scored','scramble')]:.1%}")
    print(f"  family=candidate real {out[('candidate','real')]:.1%} vs "
          f"scramble {out[('candidate','scramble')]:.1%}")
    print("  L-2 recorded 10.9% vs 9.6% and could not tell them apart. The "
          "mechanism is")
    print("  now visible: an item's smallest attainable p is set by how many "
          "CHANCE")
    print("  re-pairings of its OWN spans are perfect rhymes, and a word "
          "scramble")
    print("  preserves the span multiset exactly -- so it preserves that "
          "number too.")
    return out


if __name__ == "__main__":
    args = set(sys.argv[1:])
    if not args or "--grid" in args:
        run_grid()
    if not args or "--calibrate" in args:
        run_calibrate()
    if not args or "--arms" in args:
        run_arms()
