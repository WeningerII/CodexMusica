#!/usr/bin/env python3
"""AUDIT: the time layer's "false-event rate measured at 5.4% against a
declared 5.0%", and whether its events beat a matched null at all.

THE CLAIMS UNDER AUDIT
  quality/RESULTS_FWER.md, P2:
      scrambled sonnet 1   5.2%      4   3.0%
      scrambled sonnet 2  11.7%      5   1.5%
      scrambled sonnet 3   9.7%      6   1.4%
                                    MEAN 5.4%   against a declared alpha of 5.0%
      "The within-item null delivers the rate it advertises."
  CLAUDE.md doctrine 4 carries it forward: "false-event rate measured at 5.4%
  against a declared 5.0%".
  RESULTS_FWER.md P1 table, the same instrument on REAL text at theta 0.80 /
  window 32: sonnet 1 8%, sonnet 2 11%, lyric sheet 8%, rap 13%.

  Two things are unchecked in the record:
   (a) the printed mean. 5.2 + 11.7 + 9.7 over 3 is 8.9%, and 3.0 + 1.5 + 1.4
       over 3 is 2.0%. Neither is 5.4%. The document says the mean is over six
       sonnets while showing three; quality/test_fwer.py runs THREE and asserts
       only `mean < 0.20`, so nothing in the repo checks the 5.4%.
   (b) the comparison that matters is not scrambled-vs-alpha, it is
       REAL-vs-SCRAMBLED on the same sonnets. If a real sonnet flags 8% of its
       slots and its own word-scramble flags 9%, the event detector has no
       discrimination and every downstream placement statistic is being
       computed on a set that is mostly noise.

CHOOSING THE RANDOMISATION
  The events are LINE-INTERNAL syllable-span matches inside a 32-syllable
  window, so the audit brief's line-internal rule applies -- but the window
  crosses line boundaries, so a within-LINE shuffle is too weak: it leaves
  every cross-line pair intact. Two nulls, bracketing the choice:

  NULL S -- WHOLE-ITEM WORD SCRAMBLE (the one RESULTS_FWER.md used).
     PRESERVES: the item's exact word multiset, hence its phonology, its
     lexicon, its OOV rate, the syllable count, and roughly the slot count.
     DESTROYS: all word order, within and across lines -- and also the line
     lengths, since test_fwer.py re-chunks into 14 equal lines.

  NULL L -- LINE PERMUTATION (tighter).
     PRESERVES: every line verbatim, hence line lengths, the stress layout
     inside each line, and every within-line span pair.
     DESTROYS: only which lines fall inside a 32-syllable window together.
  NULL L destroys strictly less than NULL S. A real effect should clear both;
  an effect that clears only S is an effect on line length.

Run: python3 quality/audit_fwer_fpr.py [n_sonnets] [n_replicates]
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from lyric_harness import Declaration, Lexicon                    # noqa: E402
from quality.corpus import load_sonnets                           # noqa: E402
from quality.time_layer import (TimeDeclaration, grid_index,      # noqa: E402
                                rhyme_events, syllable_stream)

SEED = 20260810
LEX = Lexicon()
DECL = Declaration()


#: counts every item that returned "cannot tell" or refused, so a 0.0% rate in
#: the report below can never be read as "alpha was met". Doctrine 20 and
#: doctrine 28: at the honest family size (`family="candidate"`, the default
#: since 2026-08-11) EVERY item in this repository is mute at window 32, so the
#: rates this audit prints are 0.0% for BOTH arms and that zero is a REFUSAL.
#: The audit is kept because its construction is right and its comparison --
#: real against its own scramble -- is the one that matters; what changed is
#: that the instrument now declines rather than answering.
MUTE = {"n": 0, "total": 0}


def saturation(lines, correction="sidak"):
    """test_fwer.run() verbatim: share of eligible slots flagged as events at
    theta 0.80, window 32, the ORIGINAL registered parameters."""
    st = syllable_stream(LEX, lines)
    gi = grid_index(st, "stress")
    slots = [i for i in range(len(st))
             if gi[i] is not None and not st[i]["line_final"]]
    t = TimeDeclaration(theta=0.80, window=32, correction=correction)
    det = {}
    ev = rhyme_events(LEX, st, DECL, t, None, det)
    MUTE["total"] += 1
    if det.get("cannot_tell") or det.get("refused"):
        MUTE["n"] += 1
    hits = [i for i in slots if i in ev]
    return len(hits) / max(1, len(slots))


def scramble(lines, rng):
    """RESULTS_FWER.md's own null, from quality/test_fwer.py."""
    words = [w for l in lines for w in l.split()]
    rng.shuffle(words)
    n = max(1, len(words) // 14)
    return [" ".join(words[i * n:(i + 1) * n]) for i in range(14)]


def permute_lines(lines, rng):
    s = list(lines)
    rng.shuffle(s)
    return s


def main(n_son=20, reps=20):
    son = load_sonnets()
    keys = sorted(son)[:n_son]
    rng = random.Random(SEED)

    print(f"theta 0.80, window 32, Sidak -- the ORIGINAL registered "
          f"parameters RESULTS_FWER.md's P1/P2 tables use.\n")

    real = [saturation(son[k]) for k in keys]
    real_mean = sum(real) / len(real)
    print(f"REAL sonnets, n={len(keys)}")
    print(f"    mean event rate   {real_mean:.1%}")
    print(f"    median            {sorted(real)[len(real) // 2]:.1%}"
          f"   range {min(real):.1%}-{max(real):.1%}")
    print(f"    RECORDED (P1 table): sonnet 1 8%, sonnet 2 11%\n")

    for name, fn in (("NULL S  whole-item word scramble", scramble),
                     ("NULL L  line permutation", permute_lines)):
        per_item = []
        for k in keys:
            per_item.append([saturation(fn(son[k], rng)) for _ in range(reps)])
        means = [sum(col) / len(col)
                 for col in zip(*per_item)]        # a mean per replicate
        means.sort()
        mid = means[len(means) // 2]
        beat = sum(1 for x in means if x >= real_mean)
        p = (beat + 1) / (len(means) + 1)
        floor = 1 / (len(means) + 1)
        flat = sorted(x for row in per_item for x in row)
        print(f"  {name}")
        print(f"    observed R_obs (real)     {real_mean:.1%}")
        print(f"    null: N={len(means)} replicates of the whole arm, "
              f"median {mid:.1%}, min {means[0]:.1%}, max {means[-1]:.1%}")
        print(f"    excess over null MEDIAN   {100 * (real_mean - mid):+.1f} pp")
        print(f"    excess over null MAX      "
              f"{100 * (real_mean - means[-1]):+.1f} pp")
        print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {floor:.4f})"
              + ("   <- AT THE FLOOR" if abs(p - floor) < 1e-12 else ""))
        print(f"    per-ITEM null rate: median {flat[len(flat) // 2]:.1%}, "
              f"range {flat[0]:.1%}-{flat[-1]:.1%}")
        print(f"    -> the declared per-position alpha is 5.0%; "
              f"RESULTS_FWER.md records the measurement as 5.4%\n")

    # A ZERO HERE IS NOT AN ALPHA. Print the refusal count beside every rate,
    # so nobody reads "0.0% against a declared 5.0%" as the claim being met.
    print(f"  MUTE: {MUTE['n']} of {MUTE['total']} items measured returned "
          f"CANNOT TELL or refused.")
    if MUTE["n"]:
        print(f"    At the honest family size (`family='candidate'`) no "
              f"position on any item in")
        print(f"    this repository clears its cut at window 32, so every "
              f"rate above that reads")
        print(f"    0.0% is a REFUSAL and not an alpha (doctrine 20/28). The "
              f"comparison this")
        print(f"    audit was built to make -- real against its own scramble "
              f"-- is correct and")
        print(f"    the instrument declines to answer it. Why, and what each "
              f"lever buys:")
        print(f"    `python3 quality/time_attainable.py`.")


if __name__ == "__main__":
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    main(a, b)
