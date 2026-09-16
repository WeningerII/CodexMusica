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
reports ~~83.4%~~ 79.2% at the shipped theta, because re-pairing across
poems also varies the vocabulary. (Both shares are from the 2026-08-26
sitting; the permutation share was repinned to 79.2% on 2026-09-16 when E-5
removed the empty-coda evidence bonus -- see `PINNED_SONNET` below. The
re-pairing null has not been re-run under E-5, so 75.8% keeps its own dating.)

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

#: The figures `--check` holds. Keyed by theta; each value is
#: (real_lift_pp, null_lift_pp) on the sonnet arm. Held to a tolerance rather
#: than exactly: the null is a Monte Carlo median and doctrine 57 says a figure
#: fed by a draw is pinned as a band, not a point.
#:
#: REPINNED 2026-09-16 (E-5), superseded values struck and kept (doctrine 17).
#: The whole dict is re-banked from ONE run rather than patched figure by
#: figure, because these five rows are a single sweep and a dict half from
#: 2026-08-26 and half from today would be a chimera no reader could date.
#:
#:             REAL lift                    NULL lift
#:   0.60   ~~+14.98~~ +12.55          ~~+18.30~~ +15.31   BOTH BEYOND TOL
#:   0.70    ~~+7.40~~  +6.14           ~~+8.51~~  +7.06
#:   0.75    ~~+5.42~~  +4.96           ~~+4.53~~  +3.93
#:   0.80    ~~+4.33~~  +3.88           ~~+2.49~~  +2.12
#:   0.90      +2.89 (UNMOVED)          ~~+0.50~~  +0.54
#:
#: WHY, AND IT WAS MEASURED RATHER THAN INFERRED. Only theta 0.60 broke the
#: 1.5 pp tolerance, and a drift confined to the LOOSEST band is the signature
#: of a change to MARGINAL pairs. The attribution was settled by a CONTROLLED
#: A/B, not by the coincidence: the sweep was run on `origin/main`'s own tree
#: (9d9df09) with `coda_empty_evidence` toggled between "gift" and
#: "cannot_tell" and NOTHING else varied. The toggle alone reproduces the real
#: arm's move at every theta to 0.01 pp (0.60: -2.44 measured against the
#: -2.43 observed across the two commits). The delta is E-5's; it is not
#: pre-existing, and `origin/main` passes this check with all ten pins green.
#:
#: THE MECHANISM, and it is the search's own selection bias. E-5 stops
#: scoring an empty/empty coda as agreement and renormalises the remaining
#: evidence, so any pair resting on an absent coda loses `total` (`now`/`why`
#: 0.902 -> 0.850). The two arms are NOT touched equally: on the 1,108
#: mandated pairs the removal moves 274 (24.7%) on the FULL k-search arm and
#: only 98 (8.8%) on the `endword_only` k=1 arm. The max over k span readings
#: was PREFERENTIALLY PICKING readings that had the gift, which is why the arm
#: that searches loses nearly three times as many pairs as the arm that does
#: not -- and the lift is full minus k=1, so it must fall. At theta 0.60 the
#: full arm loses 50 pairs and the k=1 arm 23, a net -27 = -2.44 pp; at 0.90
#: each loses 2 and the lift does not move at all, because pairs clearing 0.90
#: are carried by heard consonants and never needed the gift.
#:
#: NOT ALL OF THE 0.60 NULL MOVE IS E-5's, and the decomposition is the point.
#: The committed +18.30 is M-135's 2026-08-26 figure; `origin/main` measures
#: +17.96 TODAY, so -0.34 of the -2.99 was already there and the band was
#: absorbing it. E-5 is the other -2.65. The same residual is why 0.90's null
#: repins +0.50 -> +0.54 although E-5 does not move it: the real column
#: reproduces 2026-08-26 EXACTLY at every theta while the null column does not,
#: because the permutation shuffles within sonnet units and the unit reader now
#: returns 187 windows where that sitting recorded 152. That is pre-existing,
#: it reproduces on `origin/main`, and it is stated here rather than fixed.
#:
#: NOTHING WAS TUNED. `CROSSOVER` (0.72), `theta_rhyme` (0.75), `TOLERANCE_PP`
#: and every declared coordinate are untouched by this lot, and the gate below
#: -- the only thing this module enforces -- did not move: the sign of what the
#: search buys still flips between 0.70 (-0.92) and 0.75 (+1.03), exactly the
#: bracket it flipped in before (-1.11 / +0.90). E-5 moved the MAGNITUDES and
#: left the crossover where it was. Only the recorded figures move, which is
#: the remedy doctrine 58 prescribes once the question has been argued: the
#: drift was a QUESTION, the question has an answer with a name on it, and the
#: answer is banked with the superseded values visible.
PINNED_SONNET = {
    0.60: (+12.55, +15.31),  # REPINNED 2026-09-16 from ~~(+14.98, +18.30)~~
    0.70: (+6.14, +7.06),    # REPINNED 2026-09-16 from ~~(+7.40, +8.51)~~
    0.75: (+4.96, +3.93),    # REPINNED 2026-09-16 from ~~(+5.42, +4.53)~~
    0.80: (+3.88, +2.12),    # REPINNED 2026-09-16 from ~~(+4.33, +2.49)~~
    0.90: (+2.89, +0.54),    # real UNMOVED; null from ~~+0.50~~ (not E-5)
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
