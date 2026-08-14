#!/usr/bin/env python3
"""AUDIT: the conjunctive band's negative control, against a matched null.

THE CLAIMS UNDER AUDIT
  quality/RESULTS_BAND.md, P4 -- "the negative control, which is the real test":
      Whitman, 150 lines, theta 0.82: 26.0% -> 20.0% lines captured in chains.
      "This is the number the fitted matrix went the wrong way on, and it is
       why the band is shipped as the default while the matrix is not."
  CLAUDE.md, test discipline: "Whitman 20.0% chained at theta 0.82, down from
      26.0%: the band tightened the negative control, which is why it ships
      and the fitted matrix does not."
  quality/RESULTS_MATRIX.md, P5 table, hand-set rows: 20.0% at theta 0.82 and
      18.0% at theta 0.85.

  Both numbers are bare rates on ONE corpus with NO comparator of any kind.
  A negative control's rate is only interpretable against two things the
  record does not carry:
    (1) the rate the same instrument gives on the same text with its
        STRUCTURE destroyed -- i.e. is 20.0% above chance for Whitman at all?
    (2) what the same change costs on the POSITIVE corpus under the SAME
        statistic. RESULTS_BAND.md compares a Whitman CHAIN-CAPTURE rate
        against a sonnet MANDATED-PAIR VIOLATION rate. Those are two
        different statistics on two different corpora, so "it tightened the
        negative control and only cost the dialect residue" is not a
        comparison that has been made.

  THE BAND'S EMPIRICAL WARRANT IS WITHDRAWN and this file is not what
  withdrew it. The withdrawal rests on `quality/RESULTS_NULL_SHAPES.md` §2,
  which needs no null at all: the property under test is PRESENT in the
  negative control as epistrophe, so `corpus/whitman.txt` was never an
  eligible negative control under any comparator. RE-MEASURED HERE 2026-08-14,
  band ON, theta 0.82 -- 7 chains of length >= 2 hold 16 lines on 9 adjacent
  links, and SEVEN OF THE NINE (78%) are REPEAT on an identical token:

      [6,7] air/their     [16,17] it/it        [45,46] end/end
      [47,48,49,50] now/now/now/now            [110,111] own/own
      [136,137] laps/laps [143,144] women/taken

  `now` closing four consecutive lines is the whole of the longest chain.
  That reproduces `RESULTS_NULL_SHAPES.md` §2's 2026-08-13 reading exactly,
  and it is the half of the argument that does NOT ride a permutation draw --
  which is why the withdrawal has survived every one of the null's three
  reversals below. THE BAND STILL SHIPS, on the doctrine 3/24 argument that it
  RELABELS rather than rejects, which is a claim about the taxonomy and needs
  no negative control. What this file measures is the null side, which is the
  half that keeps moving.

CHOOSING THE RANDOMISATION
  infer_chains is a LINE-FINAL, SEQUENTIAL relation: a line joins the open
  chain by matching one of the last two members. A within-line word shuffle
  would change nothing at the line end and is the wrong null (audit brief).
  What the statistic reads is (a) the multiset of end words and (b) their
  ORDER. Only (b) is the poet's rhyme structure.

  NULL -- permute whole lines within the item.
    PRESERVES: every line verbatim, hence every end word, every anchor, every
    OOV, the line count, the theta, the band setting, the comparator, and the
    exact chain algorithm with its two-member lookback and filler rule.
    DESTROYS: the ORDER of the lines, which is the entire rhyme scheme.
  This is the tightest null available: it is the same 150 lines, rearranged.

  The same null is applied to the sonnets, item by item (14 lines permuted
  within each sonnet), so the positive corpus is measured with the identical
  statistic and the identical null. That is the matched comparison the record
  is missing.

ONE STATISTIC, TWO MEANINGS -- read the column header, not the sign.
  This report prints TWO excesses and the record has been quoting both under
  the single word "excess":
    * EXCESS over the null MEDIAN -- the +6.7 / +3.3 / +9.3 / +5.3 series
      that CLAUDE.md, METHOD § doctrine 71 and RESULTS_NULL_SHAPES.md §1.3
      all track. A median is a location estimate; it is stable in n.
    * EXCESS over the null MAX -- the +17.9 pp METHOD § doctrine 71 cites for
      the sonnets. A MAX is an EXTREMUM: it grows with the replicate count,
      so the same effect measured at n=200 and n=2000 gives two different
      numbers and neither is wrong. Doctrine 57's mirror, doctrine 91's
      rendering point. It is not comparable across sample sizes and it is not
      a headline. `--check` therefore pins NEITHER (see PINNED, below).

Run: python3 quality/audit_band_control.py [n_shuffles]
     python3 quality/audit_band_control.py --check
        exit 0 nothing moved / 1 a committed figure moved / 2 cannot tell
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from lyric_harness import Lexicon, Declaration, infer_chains   # noqa: E402
from lyric_harness import CMUDICT_PATH                         # noqa: E402
from quality.corpus import load_sonnets                        # noqa: E402

SEED = 20260810
THETA = 0.82           # the documented literary-discovery declaration

#: The Whitman slice's own anchor, named once so `preconditions()` and
#: `whitman_lines()` cannot disagree about what "the recorded slice" is.
WHITMAN_ANCHOR = "I celebrate myself"

#: `--check` caps the null draw. The draw costs the entire runtime and `check`
#: does not read one figure out of it -- the same call `audit_tang_null.py`,
#: `audit_kalevala_null.py` and `audit_hafez_radif.py` make next door. The
#: consequence is printed loudly rather than left for a reader to infer: under
#: `--check` the null medians, mins, maxes, both excesses and the p on screen
#: are a 2-replicate draw and are NOT the figures any document quotes.
CHECK_N = 2

WHITMAN_PATH = os.path.join(HERE, "..", "corpus", "whitman.txt")
SONNETS_PATH = os.path.join(HERE, "..", "corpus", "sonnets.txt")


def whitman_lines():
    """Exactly battery.py's slice, so the number is comparable to the record."""
    lines = [l.strip() for l in open(WHITMAN_PATH, encoding="utf-8")]
    start = next(i for i, l in enumerate(lines)
                 if l.startswith(WHITMAN_ANCHOR))
    return [l for l in lines[start:start + 220] if l and len(l) > 15][:150]


def captured_lines(lex, lines, decl, theta=THETA):
    """battery.py's statistic verbatim, as a COUNT: lines inside a chain >= 2.

    Split out of `captured()` in 2026-08-14 for one reason: the count is an
    INTEGER over a fixed text under a fixed comparator, so it is exact and
    therefore pinnable, while the rate it renders to is a float that the report
    prints to one decimal. `--check` pins the count and the report prints the
    rate, from one computation, so the pin cannot drift away from the figure a
    reader compares against the record (doctrine 1: one declaration).
    """
    ch = infer_chains(lex, lines, decl, theta_chain=theta)
    return sum(c["length"] for c in ch if c["length"] >= 2)


def captured(lex, lines, decl, theta=THETA):
    """battery.py's statistic verbatim: share of lines inside a chain >= 2."""
    return captured_lines(lex, lines, decl, theta) / len(lines)


def report(name, obs, nulls, n):
    nulls = sorted(nulls)
    lo, hi, mid = nulls[0], nulls[-1], nulls[len(nulls) // 2]
    beat = sum(1 for x in nulls if x >= obs)
    p = (beat + 1) / (n + 1)
    floor = 1 / (n + 1)
    print(f"  {name}")
    print(f"    observed R_obs           {obs:.1%}")
    print(f"    null: N={n}, median {mid:.1%}, min {lo:.1%}, max {hi:.1%}")
    print(f"    excess over null MEDIAN  {100 * (obs - mid):+.1f} pp")
    print(f"    excess over null MAX     {100 * (obs - hi):+.1f} pp"
          f"   (an extremum: grows with N, not comparable across N)")
    print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {floor:.4f})"
          + ("   <- AT THE FLOOR" if abs(p - floor) < 1e-12 else ""))
    return obs, mid, hi, p


def main(n=200):
    lex = Lexicon()
    on = Declaration(conjunctive_band=True)
    off = Declaration(conjunctive_band=False)
    rng = random.Random(SEED)
    measured = {}

    wl = whitman_lines()
    measured["whitman_lines"] = len(wl)
    print(f"WHITMAN negative control: {len(wl)} free-verse lines, "
          f"theta_chain={THETA}\n")
    res = {}
    for label, key, decl in (("band OFF (pre-band)", "off", off),
                             ("band ON (shipped)", "on", on)):
        k = captured_lines(lex, wl, decl)
        measured["whitman_captured_" + key] = k
        nulls = []
        for _ in range(n):
            s = list(wl)
            rng.shuffle(s)
            nulls.append(captured(lex, s, decl))
        res[label] = report(f"Whitman, {label}", k / len(wl), nulls, n)
        print()

    # RECORDED 26.0% -> 20.0%, and the 20.0% is the PRE-`b1d7f64` comparator's:
    # it has read 17.3% (2026-08-11) and reads 10.7% at head. Superseded values
    # kept visible and dated per doctrine 17; see PINNED for the full ladder.
    print("  RECORDED: 26.0% -> 20.0% (2026-08-10) -> 17.3% (2026-08-11) ->")
    print("  10.7% at head. Only the band-OFF 26.0% is comparator-invariant.")
    print("  The audit question is not the drop in R_obs but the drop in")
    print("  EXCESS OVER THE NULL MEDIAN, because a filter that lowers chance")
    print("  and signal equally has not tightened anything (doctrine 71).\n")

    # ---- the matched positive corpus, same statistic, same null -----------
    son = load_sonnets()
    keys = sorted(son)[:60]          # 60 sonnets keeps the run tractable
    measured["sonnet_items"] = len(keys)
    measured["sonnet_lines"] = sum(len(son[k]) for k in keys)
    print(f"SONNETS positive corpus: {len(keys)} items x 14 lines, "
          f"SAME statistic (share of lines captured in chains), SAME null "
          f"(lines permuted within the item)\n")
    ns = n                           # per-item shuffles, matched to Whitman's
    for label, key, decl in (("band OFF (pre-band)", "off", off),
                             ("band ON (shipped)", "on", on)):
        per = [captured_lines(lex, son[k], decl) for k in keys]
        measured["sonnet_captured_" + key] = sum(per)
        obs = sum(c / len(son[k]) for c, k in zip(per, keys)) / len(keys)
        nulls = []
        for _ in range(ns):
            tot = 0.0
            for k in keys:
                s = list(son[k])
                rng.shuffle(s)
                tot += captured(lex, s, decl)
            nulls.append(tot / len(keys))
        res["S " + label] = report(f"Sonnets, {label}", obs, nulls, ns)
        print()

    print("SUMMARY -- what the band does to the SEPARATION, which is the "
          "quantity\nthe record never computed. BOTH excesses are named, "
          "because this file's\nown history quoted two of them under one word "
          "(doctrine 91):\n")
    for corpus in ("Whitman", "Sonnets"):
        pre = res[("S " if corpus == "Sonnets" else "") + "band OFF (pre-band)"]
        post = res[("S " if corpus == "Sonnets" else "") + "band ON (shipped)"]
        print(f"  {corpus:<8} R_obs          {pre[0]:.1%} -> {post[0]:.1%}"
              f"   ({100 * (post[0] - pre[0]):+.1f} pp)")
        print(f"  {corpus:<8} null MEDIAN    {pre[1]:.1%} -> {post[1]:.1%}"
              f"   ({100 * (post[1] - pre[1]):+.1f} pp)")
        print(f"  {corpus:<8} EXCESS vs MED  {100 * (pre[0] - pre[1]):+.1f} pp "
              f"-> {100 * (post[0] - post[1]):+.1f} pp")
        print(f"  {corpus:<8} EXCESS vs MAX  {100 * (pre[0] - pre[2]):+.1f} pp "
              f"-> {100 * (post[0] - post[2]):+.1f} pp   (extremum, rides N)\n")

    return measured


#: THE COMMITTED FIGURES, so `--check` can go red instead of a human being
#: expected to read `RECORDED:` off the screen and compare. Until 2026-08-14
#: `main()` returned None and nothing ever called `sys.exit` with a code, so
#: this runner printed its own drift and exited 0 whatever it found. It has no
#: CI step, no test and no caller -- the last file in this repo with that exact
#: shape, after `audit_spans.py`, `audit_corpus.py`, `audit_tang_null.py`,
#: `audit_kalevala_null.py`, `audit_hafez_radif.py` and `canon_sources.py`
#: (twice). `audit_register.py` is the remaining relative and it is a DIFFERENT
#: defect: it does `sys.exit(main())` and does go red on its own internal
#: contradictions, but it commits no figure, so nothing it prints can be
#: compared against a record. Doctrine 48: a principle that lives only in prose
#: gets followed exactly as often as somebody remembers it.
#:
#: MEASURED 2026-08-14, seed 20260810, n=200, threads pinned. EVERY FIGURE THE
#: 2026-08-13 RECORD PUBLISHES REPRODUCES, to the decimal, on both corpora and
#: in both arms:
#:
#:            R_obs   null med   excess vs MED   excess vs MAX        p
#:   Whitman  OFF     26.0%      19.3%   +6.7 pp        -1.3 pp   0.0547
#:   Whitman  ON      10.7%       5.3%   +5.3 pp        -1.3 pp   0.0199
#:   Sonnets  OFF     53.5%      29.9%  +23.6 pp       +17.9 pp   0.0050  floor
#:   Sonnets  ON      48.9%      21.3%  +27.6 pp       +21.3 pp   0.0050  floor
#:
#: So there is NO REPIN in this lot. The pin IS the finding, because these
#: numbers were previously true by nobody's checking: this arm's figures have
#: flipped sign TWICE in three days and nothing in the repository would have
#: said so.
#:
#: THE LADDER, kept visible and dated (doctrine 17). One text, three
#: comparators, three answers, all of them EXCESS OVER THE NULL MEDIAN:
#:   2026-08-10   +6.7 -> +3.3 pp   R_obs 26.0% -> 20.0%   pre-`b1d7f64`
#:   2026-08-11   +6.7 -> +9.3 pp   R_obs 26.0% -> 17.3%   sign FLIPS
#:   2026-08-13   +6.7 -> +5.3 pp   R_obs 26.0% -> 10.7%   sign flips BACK
#:   2026-08-14   +6.7 -> +5.3 pp   R_obs 26.0% -> 10.7%   reproduces
#: Only the 2026-08-13 row survives at head. The other two are the record of
#: comparators that no longer ship and are kept because doctrine 17 says a
#: falsified check may be kept but never quoted as if it were not.
#:
#: THE CONTROL ON THE CONTROL, and it is what localises every one of those
#: moves. `whitman_captured_off` and `sonnet_captured_off` are the band-OFF
#: rows, and they reproduce EXACTLY across all four datings -- 39/150 = 26.0%
#: with null 19.3/8.7/27.3, and 449/840 = 53.5% with null 29.9/25.5/35.6. The
#: null machinery and the ingestion are therefore demonstrably unchanged, so
#: everything that moved is downstream of the band-ON comparator alone. Pinning
#: the two OFF counts is what makes a future red attributable instead of merely
#: alarming: if an OFF count moves, the ingestion or the null moved; if only an
#: ON count moves, the band's own comparator did.
#:
#: WHAT IS PINNED, AND WHY COUNTS RATHER THAN RATES. Every pinned value is an
#: integer over a fixed text at a fixed theta under a fixed declaration, with
#: no `rng` draw anywhere on its path. The rate is the count over a fixed
#: denominator, so pinning the count pins the rate exactly while surviving the
#: report's one-decimal rendering (doctrine 91: a count is a coordinate of the
#: RENDERING). `sonnet_lines` is pinned separately from `sonnet_items` on
#: purpose: the printed sonnet rate is a MEAN OF PER-ITEM RATES, which equals
#: total/840 only because `load_sonnets` admits nothing but 14-line items --
#: that is a MEASUREMENT, not a construction, and 840 is where it would break.
#:
#: WHAT IS DELIBERATELY NOT PINNED, and this is the load-bearing half:
#:   * THE NULL MEDIAN, MIN AND MAX. Monte Carlo estimates off `rng`. They are
#:     reproducible at a FIXED n, which is exactly what makes pinning them a
#:     trap -- the pinned number would be a property of the replicate count,
#:     `--check` caps that count for cost, and the pin would then witness a
#:     sample nobody reports. Same call `audit_tang_null.py` and
#:     `audit_hafez_radif.py` make.
#:   * THE EMPIRICAL p, and here the reason is sharper than cost. Doctrine 57:
#:     an empirical p at 1/(n+1) reports the RESOLUTION, not the effect. Both
#:     sonnet arms sit exactly at their floor, so their p measures n and
#:     nothing else. Whitman's band-ON p=0.0199 is 3 of 200 permutations and is
#:     NOT at its floor -- but the recorded `p 0.006 at n=2000` was measured on
#:     an R_obs (17.3%) that no longer reproduces, so the record's own p is
#:     superseded whatever its resolution was and has not been re-run.
#:   * EITHER EXCESS. An excess is R_obs minus a Monte Carlo quantity, so it
#:     inherits the draw and cannot be pinned even though half of it is exact.
#:     The MAX flavour is worse than merely sampled: it is an extremum and
#:     grows with n, so `+17.9 pp` and `-1.3 pp` are statements about N=200 as
#:     much as about the band. If a later lot ever does pin an excess here, it
#:     must name which -- MEDIAN or MAX -- in the pin's own key, because this
#:     file's history is four numbers quoted under one word.
#:
#: Doctrine 58: these are counts, and a count is a coordinate of the THRESHOLD
#: (theta 0.82), of the RENDERING, and -- as this arm has now demonstrated
#: three times -- of the COMPARATOR. Argue them and repin with the superseded
#: value visible and dated; do NOT tune `captured_lines` or theta to meet them.
PINNED = {"whitman_lines": 150,
          "whitman_captured_off": 39,
          "whitman_captured_on": 16,
          "sonnet_items": 60,
          "sonnet_lines": 840,
          "sonnet_captured_off": 449,
          "sonnet_captured_on": 411}

#: READING ORDER for the check's report only -- shape first, then the two arms
#: per corpus, so the band-OFF control sits next to the band-ON figure it
#: localises. `check()` derives its key set from `PINNED` and uses this only to
#: sort, so a key added to `PINNED` and forgotten here is still CHECKED.
_ORDER = ("whitman_lines", "whitman_captured_off", "whitman_captured_on",
          "sonnet_items", "sonnet_lines", "sonnet_captured_off",
          "sonnet_captured_on")

#: The denominator each pinned count renders against, so the check can print
#: the RATE the record is written in beside the count it actually compares.
_DENOM = {"whitman_captured_off": "whitman_lines",
          "whitman_captured_on": "whitman_lines",
          "sonnet_captured_off": "sonnet_lines",
          "sonnet_captured_on": "sonnet_lines"}


def preconditions():
    """-> [(coordinate, why)] that stop this arm firing at all. Empty = fine.

    DOCTRINE 20. An instrument that cannot fire and an instrument that fired
    and found nothing are different results, and collapsing them is a false
    negative dressed as a finding. Every coordinate below is one this audit
    reads and cannot substitute for: without the lexicon there is no
    comparator, without the Whitman anchor there is no recorded slice, without
    the sonnets there is no matched positive corpus. `--check` names the
    missing one and exits 2 -- the code this repo already uses for a refusal
    (CLAUDE.md's `brief`/`verify`/`revise`) -- rather than raising three frames
    down or, worse, reporting a PASS on an arm that never ran.
    """
    out = []
    if not os.path.exists(CMUDICT_PATH):
        out.append((os.path.basename(CMUDICT_PATH),
                    "the pronunciation dictionary is not staged; "
                    "run lyric_harness.fetch_data()"))
    if not os.path.exists(WHITMAN_PATH):
        out.append(("corpus/whitman.txt", "the negative control's text"))
    else:
        try:
            n = len(whitman_lines())
        except StopIteration:
            n = None
        if n is None:
            out.append(("corpus/whitman.txt",
                        f"the recorded slice starts at {WHITMAN_ANCHOR!r} "
                        f"and that line is not in the file"))
    if not os.path.exists(SONNETS_PATH):
        out.append(("corpus/sonnets.txt", "the matched positive corpus"))
    return out


def check(m):
    """-> exit code. 0 nothing moved / 1 a committed figure moved.

    FAILS LOUDLY; it does not report and continue. Exit 2 is decided before
    this runs, by `preconditions()`, because a refusal is a statement about
    the inputs and not about the figures.
    """
    print()
    print("=" * 74)
    print("CHECK -- the committed DETERMINISTIC figures against this run")
    print("=" * 74)
    print("  Nothing below rides the permutation draw. The null medians, both")
    print("  excesses and the p printed above are Monte Carlo and are NOT")
    print("  checked -- see PINNED for why, and doctrine 57.")
    print()
    bad = 0
    # DERIVED FROM `PINNED`, never a second hand-written list. A checker whose
    # loop is a literal tuple can be left quantifying over a key somebody added
    # to `PINNED` and forgot to add here -- a pin that guards nothing and still
    # prints PASS. `_ORDER` only ORDERS; anything in `PINNED` and not in it is
    # appended rather than silently dropped.
    keys = ([k for k in _ORDER if k in PINNED]
            + sorted(set(PINNED) - set(_ORDER)))
    for k in keys:
        have, want = m.get(k), PINNED[k]
        ok = have == want
        bad += not ok
        den = PINNED.get(_DENOM.get(k))
        rate = f"  = {want / den:.1%}" if den else ""
        print(f"  [{'ok  ' if ok else 'FAIL'}] {k:22s} committed {want}{rate}"
              + ("" if ok else f", measured {have}"))
    if bad:
        print()
        print(f"  {bad} figure(s) moved. This arm has moved THREE TIMES in "
              f"three days and")
        print("  the band-OFF rows are what say where: if `*_captured_off` "
              "moved, the")
        print("  ingestion or the null machinery moved; if only `*_captured_on`"
              " moved,")
        print("  the band's own comparator did, and the Whitman/sonnet split "
              "says on")
        print("  which corpus. Re-run the control when the COMPARATOR moves "
              "(doctrine 58,")
        print("  one axis out). Repin with the date and keep the superseded "
              "value")
        print("  visible (doctrine 17); do not tune the statistic to meet the "
              "pin.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    if "--check" in sys.argv:
        blocked = preconditions()
        if blocked:
            print("=" * 74)
            print("CANNOT TELL -- this arm could not fire (exit 2)")
            print("=" * 74)
            for what, why in blocked:
                print(f"  MISSING  {what}\n           {why}")
            print()
            print("  Doctrine 20: this is not a PASS and it is not a FAIL.")
            sys.exit(2)
        print("=" * 74)
        print(f"--check: the null draw is capped at N={CHECK_N}. It costs the "
              f"entire")
        print("runtime and nothing checked below reads it, so every null "
              "median, min,")
        print("max, excess and p printed in the report is a "
              f"{CHECK_N}-replicate draw and is")
        print("NOT the figure any document quotes -- every arm's p reads "
              f"{1 / (CHECK_N + 1):.4f}")
        print("because that is the floor at this N, which is doctrine 57 in "
              "miniature.")
        print("The draw is still TAKEN rather than skipped, so a crash in the "
              "null path")
        print("is still a red check. The figures live in `... 200`.")
        print("=" * 74)
        print()
        sys.exit(check(main(CHECK_N)))
    main(int(argv[0]) if argv else 200)
