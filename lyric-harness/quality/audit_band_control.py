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

Run: python3 quality/audit_band_control.py [n_shuffles]
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from lyric_harness import Lexicon, Declaration, infer_chains   # noqa: E402
from quality.corpus import load_sonnets                        # noqa: E402

SEED = 20260810
THETA = 0.82           # the documented literary-discovery declaration


def whitman_lines():
    """Exactly battery.py's slice, so the number is comparable to the record."""
    path = os.path.join(HERE, "..", "corpus", "whitman.txt")
    lines = [l.strip() for l in open(path, encoding="utf-8")]
    start = next(i for i, l in enumerate(lines)
                 if l.startswith("I celebrate myself"))
    return [l for l in lines[start:start + 220] if l and len(l) > 15][:150]


def captured(lex, lines, decl, theta=THETA):
    """battery.py's statistic verbatim: share of lines inside a chain >= 2."""
    ch = infer_chains(lex, lines, decl, theta_chain=theta)
    return sum(c["length"] for c in ch if c["length"] >= 2) / len(lines)


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
    print(f"    excess over null MAX     {100 * (obs - hi):+.1f} pp")
    print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {floor:.4f})"
          + ("   <- AT THE FLOOR" if abs(p - floor) < 1e-12 else ""))
    return obs, mid, hi, p


def main(n=200):
    lex = Lexicon()
    on = Declaration(conjunctive_band=True)
    off = Declaration(conjunctive_band=False)
    rng = random.Random(SEED)

    wl = whitman_lines()
    print(f"WHITMAN negative control: {len(wl)} free-verse lines, "
          f"theta_chain={THETA}\n")
    res = {}
    for label, decl in (("band OFF (pre-band)", off), ("band ON (shipped)", on)):
        obs = captured(lex, wl, decl)
        nulls = []
        for _ in range(n):
            s = list(wl)
            rng.shuffle(s)
            nulls.append(captured(lex, s, decl))
        res[label] = report(f"Whitman, {label}", obs, nulls, n)
        print()

    print("  RECORDED: 26.0% -> 20.0%. The audit question is not the drop in")
    print("  R_obs but the drop in EXCESS OVER THE NULL, because a filter that")
    print("  lowers chance and signal equally has not tightened anything.\n")

    # ---- the matched positive corpus, same statistic, same null -----------
    son = load_sonnets()
    keys = sorted(son)[:60]          # 60 sonnets keeps the run tractable
    print(f"SONNETS positive corpus: {len(keys)} items x 14 lines, "
          f"SAME statistic (share of lines captured in chains), SAME null "
          f"(lines permuted within the item)\n")
    ns = n                           # per-item shuffles, matched to Whitman's
    for label, decl in (("band OFF (pre-band)", off), ("band ON (shipped)", on)):
        obs = sum(captured(lex, son[k], decl) for k in keys) / len(keys)
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
          "quantity\nthe record never computed:\n")
    for corpus in ("Whitman", "Sonnets"):
        pre = res[("S " if corpus == "Sonnets" else "") + "band OFF (pre-band)"]
        post = res[("S " if corpus == "Sonnets" else "") + "band ON (shipped)"]
        print(f"  {corpus:<8} R_obs   {pre[0]:.1%} -> {post[0]:.1%}"
              f"   ({100 * (post[0] - pre[0]):+.1f} pp)")
        print(f"  {corpus:<8} null md {pre[1]:.1%} -> {post[1]:.1%}"
              f"   ({100 * (post[1] - pre[1]):+.1f} pp)")
        print(f"  {corpus:<8} EXCESS  {100 * (pre[0] - pre[1]):+.1f} pp -> "
              f"{100 * (post[0] - post[1]):+.1f} pp\n")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 200)
