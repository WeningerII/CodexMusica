#!/usr/bin/env python3
"""AUDIT: the 律詩 88.1% "rhyme agreement at mandated positions", with nulls.

THE CLAIMS UNDER AUDIT
  quality/POSITIVE_CONTROL.md, Part B ("SOURCED AND VALIDATED — this is the
  cell that runs"):
      poems checked                                    253
      rhyme agreement at mandated positions (2,4,6,8)  88.1%
      character coverage by the rime table             99.3%
  data/sources.tsv repeats it. Part D then runs arm A on 300 poems and reports
  264 admitted / 36 refused = 88.0%, i.e. the same statistic at a different
  `limit`. Neither figure carries a comparator.

  Part D already contains the C1 control that shows arm A's *p-value* is
  carried by line length, not rhyme. That control does NOT touch the 88.1%
  itself, which is a claim about the RHYME DETECTOR: "of poems in this form,
  this share have all four mandated line-ends in one rhyme group."

CHOOSING THE RANDOMISATIONS
  This is a LINE-FINAL relation, so a within-line shuffle changes nothing at
  the line end and is the wrong null. Three nulls, each destroying a different
  thing, because the claim has three separable parts:

  N1 -- CROSS-POEM PERMUTATION of the four rhyme-position characters.
     PRESERVES: the exact multiset of rhyme-position characters in the corpus
     (hence the rime table's own frequency distribution, its polyphony, its
     coverage), the poem count, the "all four agree" predicate, the 同用
     grouping.
     DESTROYS: which characters a single poet put in one poem.
     ANSWERS: is agreement above what the corpus's own end-character
     inventory gives by chance?

  N2 -- WITHIN-POEM RESELECTION: draw 4 of the poem's 8 line-final characters.
     PRESERVES: the poem, its whole line-final inventory, the predicate.
     DESTROYS: only WHICH positions are read as the rhyme.
     ANSWERS: are the MANDATED positions special, or would any four of this
     poem's line-ends agree as often? This is the 88.1%'s version of the C1
     tripwire that Part D applied to the p-value.

  N3 -- THE COMPLEMENTARY FIXED POSITIONS: lines 1,3,5,7.
     Not a randomisation but the form's own negative positions: 律詩 does not
     rhyme the odd lines (line 1 optionally). A fixed comparator, no Monte
     Carlo error.

Run: python3 quality/audit_tang_null.py [limit] [n_replicates]
"""

import os
import random
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                          # noqa: E402
from quality.run_positive_control import tang_poems        # noqa: E402

SEED = 20260810


def agree(ltc, chars):
    """The recorded predicate, verbatim from run_positive_control.
    mandated_rhyme_events: all(ltc.rhymes(words[0], w) for w in words[1:])."""
    return all(ltc.rhymes(chars[0], w) for w in chars[1:])


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
    print()


def main(limit=300, n=200):
    ltc = get("ltc")
    poems = tang_poems(limit=limit)
    print(f"全唐诗, filtered to 8 uniform lines of 5 or 7 characters: "
          f"{len(poems)} poems  (limit={limit})")
    print("RECORDED: 253 poems / 88.1% (POSITIVE_CONTROL Part B); "
          "300 poems / 264 admitted = 88.0% (Part D arm A).\n"
          "REPINNED 2026-08-13: the mandated-position agreement rate is "
          "90.0%, not 88.0%, and character coverage is 99.9%, not 99.3%. "
          "Superseded values kept above (doctrine 17); the null verdict is "
          "unchanged, p stays at the floor.\n")

    # REFUSE, DO NOT DIVIDE BY ZERO — added 2026-08-14, found by CI.
    #
    # The 全唐诗 pool is an absolute path OUTSIDE this repository, overridable
    # by `TANG_POOL` and not fetched by any CI job. When it is absent
    # `tang_poems()` returns [], `allch` is the empty string, and the coverage
    # line below divided by zero — so a MISSING CORPUS crashed with a
    # ZeroDivisionError pointing at an arithmetic line, which reads as a defect
    # in the statistic rather than in the environment.
    #
    # That is doctrine 20 exactly: nothing was measured, so nothing moved, and
    # "cannot tell" is not "failed". Exit 2, the code this file already uses
    # for a refusal, and the message names the override. `run_positive_control`
    # has carried the same guard at its own line 328 the whole time; this
    # module reached `tang_poems()` without going through it.
    if not poems:
        print("REFUSED — the 全唐诗 pool yielded no poems.\n"
              "  It is an absolute path OUTSIDE this repository, not committed\n"
              "  and not fetched by CI. Set TANG_POOL to a checkout of\n"
              "  chinese-poetry to run this arm somewhere other than the\n"
              "  machine it was written on.\n"
              "  Nothing was measured, so nothing moved (doctrine 20).")
        # None is the REFUSAL sentinel, read by the dispatcher at the bottom.
        # Returning 2 here would be wrong: `main()`'s value is a MEASUREMENT
        # dict that the dispatcher feeds to `check()`, so a bare 2 would be
        # graded as though it were one and come back exit 1 — a refusal
        # rendered as a moved figure, which is the collapse doctrine 20 names.
        return None

    ends = [[ln[-1] for ln in lines] for _, lines in poems]
    allch = "".join("".join(lines) for _, lines in poems)
    known = sum(1 for c in allch if ltc.readings(c))
    print(f"character coverage by the rime table: {known}/{len(allch)} = "
          f"{known / len(allch):.1%}   (RECORDED 99.9%, repinned 2026-08-13 "
          f"from 99.3%)\n")
    measured = {"poems": len(poems), "coverage_known": known,
                "coverage_total": len(allch)}

    mand = [[e[i] for i in (1, 3, 5, 7)] for e in ends]
    obs = sum(1 for c in mand if agree(ltc, c)) / len(mand)
    odd = [[e[i] for i in (0, 2, 4, 6)] for e in ends]
    obs_odd = sum(1 for c in odd if agree(ltc, c)) / len(odd)

    rng = random.Random(SEED)

    # N1 -- cross-poem permutation of the rhyme-position characters
    pool = [c for row in mand for c in row]
    n1 = []
    for _ in range(n):
        rng.shuffle(pool)
        n1.append(sum(1 for k in range(len(mand))
                      if agree(ltc, pool[4 * k:4 * k + 4])) / len(mand))
    report("N1  cross-poem permutation of rhyme-position characters",
           obs, n1, n)

    # N2 -- within-poem reselection of 4 of the 8 line-finals
    n2 = []
    for _ in range(n):
        hit = 0
        for e in ends:
            if agree(ltc, rng.sample(e, 4)):
                hit += 1
        n2.append(hit / len(ends))
    report("N2  within-poem: any 4 of this poem's 8 line-ends", obs, n2, n)

    # N3 -- the form's own non-rhyming positions
    print("  N3  the form's complementary positions, lines 1,3,5,7 "
          "(fixed, no Monte Carlo)")
    print(f"    mandated (2,4,6,8)   {obs:.1%}")
    print(f"    non-mandated (1,3,5,7) {obs_odd:.1%}")
    print(f"    difference           {100 * (obs - obs_odd):+.1f} pp\n")

    # how permissive is the predicate itself?
    pairs = 0
    hits = 0
    flat = [c for row in mand for c in row]
    for _ in range(20000):
        a, b = rng.sample(flat, 2)
        r = ltc.rhymes(a, b)
        if r is not None:
            pairs += 1
            hits += bool(r)
    print(f"  pairwise chance agreement between two random rhyme-position "
          f"characters: {hits}/{pairs} = {hits / pairs:.1%}")
    poly = Counter(len(ltc.rhyme_keys(c) or ()) for c in flat)
    print(f"  readings per rhyme-position character: {dict(sorted(poly.items()))}"
          f"  (a polyphone gets several chances to agree)")

    return measured


#: THE COMMITTED FIGURES, so `--check` can go red instead of a human being
#: expected to read `RECORDED:` off the screen and compare. Until 2026-08-13
#: `main()` returned None and nothing ever called `sys.exit` with a code, so
#: this runner exited 0 whatever it found -- and it HAD drifted: the agreement
#: rate recorded as 88.0% measures 90.0%, and coverage recorded as 99.3%
#: measures 99.9%. Nobody noticed, because nothing runs it.
#:
#: This is the same shape as `quality/audit_spans.py` and
#: `quality/audit_corpus.py`, both wired the same day: an instrument that
#: prints its own drift and cannot act on it. Doctrine 48 -- a principle that
#: lives only in prose gets followed exactly as often as somebody remembers it.
#: Doctrine 58: argue these and repin; do not tune the measurement to meet them.
#:
#: The RATE is not pinned here. It is a permutation statistic and the mandated
#: rate is exact at a given limit, but the null draw is not, so `--check` pins
#: the DETERMINISTIC quantities (the corpus shape and the coverage) and leaves
#: the null verdict to the printed p, which is at its floor either way.
PINNED = {"poems": 300, "coverage_known": 12848, "coverage_total": 12864}


def check(measured):
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    print()
    print("=" * 74)
    print("CHECK -- the committed corpus shape against this run")
    print("=" * 74)
    bad = 0
    for k in sorted(PINNED):
        ok = measured.get(k) == PINNED[k]
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {k:16s} committed {PINNED[k]}"
              + ("" if ok else f", measured {measured.get(k)}"))
    if bad:
        print()
        print(f"  {bad} figure(s) moved. The ingestion or the rime table has "
              f"changed under this arm.")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17).")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    lim = int(argv[0]) if argv else 300
    n = int(argv[1]) if len(argv) > 1 else 200
    if "--check" in sys.argv:
        # The null draw costs the whole runtime and `check` does not read it.
        n = min(n, 5)
    _m = main(lim, n)
    # A REFUSAL SHORT-CIRCUITS `check()` — it must never be graded. `main()`
    # returns None when the 全唐诗 pool is absent, and exit 2 is this repo's
    # code for "nothing was measured, so nothing moved": not 0, which would
    # claim the arm reproduced, and not 1, which would claim a figure moved.
    if _m is None:
        sys.exit(2)
    sys.exit(check(_m) if "--check" in sys.argv else 0)
