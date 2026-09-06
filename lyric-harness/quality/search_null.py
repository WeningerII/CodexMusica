#!/usr/bin/env python3
"""DOES THE COMPARATOR'S SPAN SEARCH BEAT A NULL UNDER THE SAME SEARCH?

`lyric_harness.best_score` takes a max over k span readings of both sides and
compares the winner to `theta_rhyme`. It RECORDS the size of that search --
`"search_k": k`, under a comment reading *"doctrine 56: k is the size of the
search the max was taken over. Recording it is the precondition for a null
under the same search"* -- and until this module existed, NOTHING CONSUMED IT.
Its only other reader was a print. The precondition was banked, disclosed, and
never applied (`MISSING.md` M-135).

`quality/relations.py` obeys the same doctrine properly one screen away:
`search_burden()` consumes its `search_k`, and `quality/relations_null.py` is
the null under the same search -- which is how `line_permutation` was caught
being the IDENTITY MAP and `internal rhyme` caught sitting BELOW chance. This
module is that null for the OTHER search.

WHAT IT MEASURES, and the arms are the whole design:

    REAL, full search    every span reading, the shipped comparator
    REAL, no search      both sides restricted to the `endword_only` span (k=1)
    NULL, full search    the same, on permuted text
    NULL, no search      the same, on permuted text

The quantity of interest is NOT the rate. It is the LIFT the search gives --
full minus no-search -- on each arm, and the comparison between them. A search
that raises real verse and its own null equally has bought nothing, which is
doctrine 71's sentence pointed at a search instead of a corpus.

THE NULL IS A WITHIN-UNIT LINE PERMUTATION, not a re-pairing of random words.
It holds the poem, the author and the vocabulary fixed and moves only which
lines are asked to rhyme, so a lift it reproduces is a lift the SEARCH found in
material that has no rhyme to find. Random re-pairing was tried first and is
the WEAKER null: it reported 75.8% of the lift as chance where the permutation
reports 83.4%, because re-pairing across poems also varies the vocabulary.

WHAT IT DOES NOT DO. It measures the SCALAR gate (`total >= theta`), not this
harness's verdict: `admits()` types the relation and, since M-59/M-116, accepts
ASSONANCE, CONSONANCE and the whole-vocabulary schema default, which is why the
battery reports 1.2% violations of judged pairs and not the rates below.
Nothing here restates the battery and no violation count moves. It also grades
nothing and repairs nothing -- `--check` compares against the pinned figures
and exits 3 on drift, and that is its whole enforcement.

    python3 quality/search_null.py            the sweep, printed
    python3 quality/search_null.py --check    against the pins, exit 3 on drift
"""
import random
import statistics as st
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as LH  # noqa: E402

#: The sweep, so the crossover is visible rather than asserted at one point.
THETAS = (0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90)

#: Replicates of the permutation null. Ten, because doctrine 73 -- a single
#: seed is a coin flip reported as a verdict -- and the reported figure is the
#: MEDIAN, with the range printed beside it so a reader sees the spread.
REPLICATES = 10
SEED = 4242

SONNET_SCHEME = "ABABCDCDEFEFGG"

#: ADOPTED 2026-08-26 (`MISSING.md` M-135). The measured crossover: the theta
#: below which the span search lifts the NULL more than it lifts the SIGNAL,
#: i.e. below which the search is net harmful to separation. Measured at 0.72
#: on the sonnets and reproduced on `corpus/song/` adjacent-line pairs under a
#: within-block permutation null -- two corpora, two signal-set definitions,
#: two null designs.
#:
#: IT IS NOT A THRESHOLD THIS MODULE ENFORCES ON A DRAFT. It is the coordinate
#: the SHIPPED theta has to be read against, and the gate below is the one
#: sentence that follows from it: `theta_rhyme` must sit above the crossover,
#: because below it the comparator's own search is working against the band.
CROSSOVER = 0.72

#: The figures `--check` holds, from the run recorded in M-135. Keyed by theta;
#: each value is (real_lift_pp, null_lift_pp) on the sonnet arm. Held to a
#: tolerance rather than exactly: the null is a Monte Carlo median and doctrine
#: 57 says a figure fed by a draw is pinned as a band, not a point.
PINNED_SONNET = {
    0.60: (+14.98, +18.30),
    0.70: (+7.40, +8.51),
    0.75: (+5.42, +4.53),
    0.80: (+4.33, +2.49),
    0.90: (+2.89, +0.50),
}
TOLERANCE_PP = 1.5


def endword_only(cands):
    """The no-search arm: the reading whose span is the end word alone.

    Not `cands[0]` -- THAT WAS THE FIRST DRAFT'S ERROR AND IT IS RECORDED
    HERE BECAUSE IT LOOKED RIGHT. The candidate list is ordered with the
    MOSAIC reach first, so `cands[0]` is the longest span, and a "best minus
    first" comparison measures mosaic-versus-mosaic rather than search-versus-
    none. The provenance is asked instead.
    """
    for c in cands:
        p = LH.span_provenance(c)
        if p and p["endword_only"]:
            return c
    return min(cands, key=len)


def totals(pairs, decl):
    """-> [(full_search_total, no_search_total)] so a theta sweep costs one
    scoring pass rather than one per threshold."""
    out = []
    for ca, cb, wa, wb in pairs:
        s = LH.best_score(ca, cb, decl, wa, wb)
        s2 = LH.best_score([endword_only(ca)], [endword_only(cb)], decl, wa, wb)
        out.append((s["total"] if s else 0.0, s2["total"] if s2 else 0.0))
    return out


def search_shape(pairs, decl):
    """-> {'pairs', 'mean_k', 'max_k', 'mean_a', 'mean_b'}: the search's
    SIZE and its two FACTORS, read off the Attribution `best_score` records.

    `candidates_a` / `candidates_b` were banked on every score from the first
    commit and read by nothing in production (`MISSING.md` M-137) -- the
    decomposition of doctrine 56's k into the two side-searches, invisible.
    This is their consumer: k is not one number here, it is a product, and a
    null under the same search has to reproduce BOTH factors, not the product
    alone (a 2x8 search and a 4x4 search have the same k and different
    reach). Reported beside the sweep, never pinned as a rate.
    """
    ks, aa, bb = [], [], []
    for ca, cb, wa, wb in pairs:
        s = LH.best_score(ca, cb, decl, wa, wb)
        if not s:
            continue
        sp = s["spans"]
        ks.append(sp["search_k"])
        aa.append(sp["candidates_a"])
        bb.append(sp["candidates_b"])
    n = len(ks)
    return {"pairs": n,
            "mean_k": (sum(ks) / n) if n else 0.0,
            "max_k": max(ks) if ks else 0,
            "mean_a": (sum(aa) / n) if n else 0.0,
            "mean_b": (sum(bb) / n) if n else 0.0}


def sonnet_units(lex, path="corpus/sonnets.txt"):
    lines = [l.rstrip("\n") for l in open(path, encoding="utf-8")
             if l.strip() and not LH.is_apparatus_line(l)]
    return [[LH.line_anchors(lex, l) for l in lines[i:i + 14]]
            for i in range(0, len(lines) - 13, 14)]


def scheme_pairs(anc):
    return [(anc[i][0], anc[j][0], anc[i][1], anc[j][1])
            for i in range(14) for j in range(i + 1, 14)
            if SONNET_SCHEME[i] == SONNET_SCHEME[j]
            and anc[i][0] and anc[j][0]]


def sweep(units, pair_fn, decl, replicates=REPLICATES, seed=SEED):
    """-> {theta: (real_lift, null_lift_median, null_lift_range)} in points."""
    real = [p for u in units for p in pair_fn(u)]
    if not real:
        raise SystemExit("REFUSED — no pairs to score; the unit reader "
                         "returned nothing and a rate over nothing is not a "
                         "rate (doctrine 20).")
    tr = totals(real, decl)
    tp = []
    for r in range(replicates):
        rng = random.Random(seed + r)
        perm = []
        for u in units:
            sh = list(u)
            rng.shuffle(sh)
            perm += pair_fn(sh)
        tp.append(totals(perm, decl))
    out = {}
    for th in THETAS:
        rf = sum(1 for a, _ in tr if a >= th) / len(tr)
        rn = sum(1 for _, b in tr if b >= th) / len(tr)
        nl = [(sum(1 for a, _ in t if a >= th) / len(t)
               - sum(1 for _, b in t if b >= th) / len(t)) for t in tp]
        out[th] = (100 * (rf - rn), 100 * st.median(nl),
                   (100 * min(nl), 100 * max(nl)))
    return out, len(real)


def main(argv):
    check = "--check" in argv
    lex = LH.Lexicon()
    decl = LH.Declaration()
    units = sonnet_units(lex)
    res, n = sweep(units, scheme_pairs, decl)

    print("THE SPAN SEARCH AGAINST A NULL UNDER THE SAME SEARCH "
          "(doctrine 56)")
    print(f"  {len(units)} sonnets, {n} mandated pairs, "
          f"{REPLICATES} within-sonnet line-permutation replicates")
    shape = search_shape([p for u in units for p in scheme_pairs(u)], decl)
    print(f"  the search, as its two factors (doctrine 56; M-137): "
          f"mean k {shape['mean_k']:.2f} = {shape['mean_a']:.2f} x "
          f"{shape['mean_b']:.2f} candidates per side, max k {shape['max_k']}")
    print(f"  arms: full k-search vs `endword_only` (k=1), on real and "
          f"permuted text\n")
    print(f"  {'theta':>7}{'REAL lift':>12}{'NULL lift':>12}"
          f"{'null range':>18}{'search buys':>13}{'chance':>9}")
    for th in THETAS:
        rl, nlm, (lo, hi) = res[th]
        buys = rl - nlm
        share = (100 * nlm / rl) if rl else float("nan")
        mark = "  <- theta_rhyme" if abs(th - decl.theta_rhyme) < 1e-9 else ""
        print(f"  {th:>7.2f}{rl:>+11.2f}{nlm:>+12.2f}"
              f"{f'{lo:+.2f} to {hi:+.2f}':>18}{buys:>+12.2f}"
              f"{share:>8.1f}%{mark}")

    print(f"\n  MEASURED CROSSOVER (adopted {CROSSOVER}): the theta below "
          f"which the search")
    print("  lifts the null MORE than the signal, so a looser band is "
          "loosened further")
    print("  by a mechanism no coordinate declares.")

    if not check:
        print("\n  Not a verdict on any draft: this is the SCALAR gate, not "
              "`admits()`,\n  which types the relation and accepts the near "
              "relations besides.")
        return 0

    print("\n" + "=" * 70)
    print("CHECK — the shipped theta against the measured crossover, and the "
          "pins")
    print("=" * 70)
    bad = 0

    # THE GATE. One sentence: the band must sit above the crossover, because
    # below it the comparator's own search works against the band. This is the
    # enforcement M-135 was missing -- the entry stays OPEN on what to DO about
    # the coupling, and this refuses the one state that is indefensible either
    # way.
    if decl.theta_rhyme <= CROSSOVER:
        print(f"  [FAIL] theta_rhyme {decl.theta_rhyme} is at or below the "
              f"measured crossover {CROSSOVER} — below it the span search "
              f"lifts a null under the same search MORE than it lifts real "
              f"verse, so the band is being loosened by an undeclared "
              f"mechanism (M-135).")
        bad += 1
    else:
        print(f"  [ok  ] theta_rhyme {decl.theta_rhyme} sits above the "
              f"measured crossover {CROSSOVER}")
        print(f"         margin {decl.theta_rhyme - CROSSOVER:+.2f} — thin, "
              f"and that is the finding, not a comfort")

    for th, (want_r, want_n) in sorted(PINNED_SONNET.items()):
        got_r, got_n, _ = res[th]
        for label, want, got in (("real lift", want_r, got_r),
                                 ("null lift", want_n, got_n)):
            ok = abs(got - want) <= TOLERANCE_PP
            bad += 0 if ok else 1
            print(f"  [{'ok  ' if ok else 'FAIL'}] theta {th:.2f} {label:<10}"
                  f" committed {want:+.2f} pp, measured {got:+.2f} pp"
                  f" (tol {TOLERANCE_PP})")

    print()
    if bad:
        print(f"RESULT: DRIFT — {bad} figure(s) moved. That is a QUESTION "
              f"(doctrine 58):\n  re-argue it in a closing sitting; do not "
              f"tune anything to make this pass.")
        return 3
    print("RESULT: PASS — the crossover holds and the shipped band sits "
          "above it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
