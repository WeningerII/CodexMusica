#!/usr/bin/env python3
"""AUDIT: "radif visible in 297 of 495 ghazals", with the setting and a null.

THE CLAIM UNDER AUDIT
  quality/POSITIVE_CONTROL.md Part E table:
      "Persian ghazal | FOUND kavehbc/hafez, MIT + author d.1390 |
       495 ghazals, radif visible in 297"
  data/sources.tsv: "RADIF VISIBLY PRESENT in 297/495 ghazals as an identical
  final token on the matla first hemistich and every even hemistich".
  CLAUDE.md doctrine 58 has already established that 297 is exactly
  min_fraction=1.0 on a sweep 318/318/315/311/310/306/301/297 -- the number is
  a coordinate of a threshold that was not written next to it.

  What doctrine 58 did NOT supply is a comparator. 297/495 = 60.0% is still a
  bare n-of-N.

CHOOSING THE RANDOMISATION
  Radif is a LINE-FINAL repetend, so a within-line shuffle changes nothing at
  the line end and is the wrong null.

  NULL H -- permute hemistichs ACROSS ghazals.
     PRESERVES: the exact multiset of hemistichs in the corpus, hence every
     final token, the token frequency distribution, the ghazal count and each
     ghazal's length.
     DESTROYS: which hemistichs belong to one poem, i.e. the poet's choice to
     close a poem's even hemistichs on one word.
  This is the null for "is the repetend a property of the poem", which is
  what radif means.

  NULL F -- permute only the FINAL TOKENS across the whole corpus, leaving
  each hemistich otherwise in place. Destroys strictly less: the poem's line
  count, order and body survive. Reported as the tighter of the two.

Run: python3 quality/audit_hafez_radif.py PATH_TO_hafez.json [n]
"""

import json
import random
import sys


def has_radif(poem, min_fraction=1.0):
    """The rule data/sources.tsv states: an identical final token on the matla
    (hemistich 0) and every even hemistich. `min_fraction` is the share of
    even hemistichs that must carry it -- the coordinate doctrine 58 named.
    """
    if len(poem) < 4:
        return False
    finals = [h.split()[-1] if h.split() else "" for h in poem]
    target = finals[0]
    if not target:
        return False
    even = [finals[i] for i in range(1, len(finals), 2)]
    if not even:
        return False
    share = sum(1 for f in even if f == target) / len(even)
    return share >= min_fraction


def rate(poems, mf):
    return sum(1 for p in poems if has_radif(p, mf)) / len(poems)


def main(path, n=200):
    data = json.load(open(path, encoding="utf-8"))
    poems = [d["poem"] for d in data]
    print(f"{path}: {len(poems)} ghazals, "
          f"{sum(len(p) for p in poems)} hemistichs")
    print("RECORDED: radif in 297/495 (= min_fraction 1.0, per doctrine 58)\n")

    print("  the sweep, written next to the number as doctrine 58 requires:")
    for mf in (0.5, 0.6, 0.7, 0.8, 0.9, 1.0):
        k = sum(1 for p in poems if has_radif(p, mf))
        print(f"    min_fraction={mf:.2f}  {k}/{len(poems)} = "
              f"{k / len(poems):.1%}")
    print()

    rng = random.Random(20260810)
    obs = rate(poems, 1.0)

    for name, mk in (("NULL H  hemistichs permuted across ghazals", "h"),
                     ("NULL F  final tokens permuted across the corpus", "f")):
        nulls = []
        for _ in range(n):
            if mk == "h":
                pool = [h for p in poems for h in p]
                rng.shuffle(pool)
                out, k = [], 0
                for p in poems:
                    out.append(pool[k:k + len(p)])
                    k += len(p)
            else:
                fin = [h.split()[-1] if h.split() else "" for p in poems
                       for h in p]
                rng.shuffle(fin)
                out, k = [], 0
                for p in poems:
                    out.append([(" ".join(h.split()[:-1] + [fin[k + i]])
                                 if h.split() else h)
                                for i, h in enumerate(p)])
                    k += len(p)
            nulls.append(rate(out, 1.0))
        nulls.sort()
        beat = sum(1 for x in nulls if x >= obs)
        p = (beat + 1) / (n + 1)
        print(f"  {name}")
        print(f"    observed R_obs           {obs:.1%} "
              f"({int(round(obs * len(poems)))}/{len(poems)})")
        print(f"    null: N={n}, median {nulls[len(nulls) // 2]:.2%}, "
              f"min {nulls[0]:.2%}, max {nulls[-1]:.2%}")
        print(f"    excess over null MEDIAN  "
              f"{100 * (obs - nulls[len(nulls) // 2]):+.1f} pp")
        print(f"    excess over null MAX     "
              f"{100 * (obs - nulls[-1]):+.1f} pp")
        print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {1 / (n + 1):.4f})"
              + ("   <- AT THE FLOOR" if abs(p - 1 / (n + 1)) < 1e-12 else ""))
        print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 200)
