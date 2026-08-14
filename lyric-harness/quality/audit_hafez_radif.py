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
     python3 quality/audit_hafez_radif.py --check        (exit 1 on drift)
"""

import os
import json
import random
import sys

#: The sweep grid. A constant rather than a literal in the loop, because
#: `--check` pins the counts POSITIONALLY against it.
SWEEP = (0.5, 0.6, 0.7, 0.8, 0.9, 1.0)


def radif_share(poem):
    """-> float in [0,1] if the ghazal can be JUDGED, or None if it is REFUSED.

    The rule data/sources.tsv states: an identical final token on the matla
    (hemistich 0) and every even hemistich. The returned share is the fraction
    of even hemistichs carrying it -- the coordinate doctrine 58 named.

    THIS USED TO RETURN A BARE BOOLEAN, which answered a three-state question
    with two states and put every REFUSAL in the denominator as a judged NO
    (doctrine 79). Three ways a ghazal cannot be judged, and none of them is
    evidence that the poet did not write a radif:

      - fewer than 4 hemistichs. A single matla supplies exactly ONE
        comparison, which cannot separate a radif from a coincidence. This is
        insufficient evidence, not an absent radif (doctrine 20).
      - the matla's first hemistich has no token, so there is no target.
      - no even hemistich exists to carry one.

    On `corpus/fas_hafez.json` all three branches are EMPTY -- 0 refused of 495
    -- so the published 297/495 is unaffected by this correction. The branch is
    written as a refusal anyway because the collapse was real in the code and
    dormant only in this corpus; a null in a permuted replicate, or a second
    recension (doctrine 91), is not obliged to keep it dormant.
    """
    if len(poem) < 4:
        return None
    finals = [h.split()[-1] if h.split() else "" for h in poem]
    target = finals[0]
    if not target:
        return None
    even = [finals[i] for i in range(1, len(finals), 2)]
    if not even:
        return None
    return sum(1 for f in even if f == target) / len(even)


def has_radif(poem, min_fraction=1.0):
    """Kept, and kept BOOLEAN, because the nulls and the sweep both want the
    predicate. A refusal is False here -- but no caller now reaches this
    without `shares()` having already counted the refusals separately."""
    s = radif_share(poem)
    return s is not None and s >= min_fraction


def shares(poems):
    """Every ghazal's share, computed ONCE. -> (list of share-or-None).

    `has_radif` recomputed this for all 495 ghazals on each of the six sweep
    thresholds and discarded everything but the boolean, six times over. It is
    the same arithmetic; doing it once is cheaper than doing it six times, and
    what falls out of keeping it is doctrine 67's question -- see `where()`.
    """
    return [radif_share(p) for p in poems]


def counts(sh, mf):
    """-> (carrying, judged, refused) at threshold `mf`. THREE COUNTS, NEVER
    SUMMED, and no refusal in the numerator (doctrine 79)."""
    judged = [s for s in sh if s is not None]
    return (sum(1 for s in judged if s >= mf), len(judged),
            len(sh) - len(judged))


def where(sh):
    """DOCTRINE 67: a refusal rate is not a tax, measure WHERE it falls.

    The share is already on the path for every ghazal and was thrown away down
    to one bit. Kept, it splits the ~40% that do not carry a radif at
    min_fraction=1.0 into two populations that are not the same finding:

      ABSENT   share == 0   the matla's final token recurs at NO even
                            hemistich. The poet did not write this radif.
      PARTIAL  0 < share < 1 the token recurs, but not everywhere. This is a
                            THRESHOLD residue, not an absence -- it is the same
                            population the sweep walks up.

    No new computation: three comparisons over a list already built.
    """
    judged = [s for s in sh if s is not None]
    return {"exact": sum(1 for s in judged if s >= 1.0),
            "partial": sum(1 for s in judged if 0.0 < s < 1.0),
            "absent": sum(1 for s in judged if s == 0.0)}


def rate(poems, mf):
    """-> carrying / JUDGED. The denominator is judged, not mandated: charging
    a refusal to the comparator is doctrine 79's own failure mode. The two
    denominators coincide on this corpus (0 refused), so every published figure
    reproduces unchanged -- but they coincide as a MEASUREMENT, not by
    construction, and the code now says which."""
    car, jud, _ = counts(shares(poems), mf)
    return car / jud if jud else 0.0


def main(path, n=200):
    data = json.load(open(path, encoding="utf-8"))
    poems = [d["poem"] for d in data]
    print(f"{path}: {len(poems)} ghazals, "
          f"{sum(len(p) for p in poems)} hemistichs")
    print("RECORDED: radif in 297/495 (= min_fraction 1.0, per doctrine 58)\n")

    sh = shares(poems)
    measured = {"ghazals": len(poems),
                "hemistichs": sum(len(p) for p in poems)}

    print("  the sweep, written next to the number as doctrine 58 requires:")
    sweep = []
    for mf in SWEEP:
        k, jud, _ = counts(sh, mf)
        sweep.append(k)
        print(f"    min_fraction={mf:.2f}  {k}/{len(poems)} = "
              f"{k / jud:.1%}")
    measured["sweep"] = tuple(sweep)
    print()

    # DOCTRINE 79 -- three counts, never summed, no REFUSAL in the numerator.
    car, jud, ref = counts(sh, 1.0)
    measured.update(mandated=len(poems), judged=jud, refused=ref)
    print("  doctrine 79 -- three counts, reported separately and never summed:")
    print(f"    MANDATED  {len(poems):4d}   ghazals the audit puts the "
          f"question to")
    print(f"    JUDGED    {jud:4d}   a matla final token and at least two even "
          f"hemistichs")
    print(f"    REFUSED   {ref:4d}   too short, or no readable target to "
          f"compare against")
    print(f"    -> the rate's denominator is JUDGED ({jud}), which equals "
          f"MANDATED here")
    print(f"       because {ref} were refused. That is a measurement, not a "
          f"construction.")
    print()

    # DOCTRINE 67 -- a refusal rate is not a tax, measure WHERE it falls.
    w = where(sh)
    measured.update(w)
    print("  doctrine 67 -- WHERE the non-carrying share falls "
          "(the per-ghazal share, already computed and previously discarded):")
    print(f"    EXACT    share = 1.00   {w['exact']:4d}  "
          f"{w['exact'] / jud:5.1%}  carries the radif at every even hemistich")
    print(f"    PARTIAL  0 < s < 1.00  {w['partial']:4d}  "
          f"{w['partial'] / jud:5.1%}  the token recurs, but not everywhere")
    print(f"    ABSENT   share = 0.00   {w['absent']:4d}  "
          f"{w['absent'] / jud:5.1%}  no recurrence at all")
    print(f"    So the {jud - w['exact']} ghazals that miss at min_fraction=1.0 "
          f"are TWO populations, not one:")
    print(f"    {w['partial']} are a THRESHOLD residue (the sweep walks up "
          f"through them, {sweep[0] - sweep[-1]} of them")
    print(f"    between 0.50 and 1.00) and {w['absent']} carry no trace of a "
          f"radif at all.")
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
              f"({car}/{jud})")
        print(f"    null: N={n}, median {nulls[len(nulls) // 2]:.2%}, "
              f"min {nulls[0]:.2%}, max {nulls[-1]:.2%}")
        print(f"    excess over null MEDIAN  "
              f"{100 * (obs - nulls[len(nulls) // 2]):+.1f} pp")
        print(f"    excess over null MAX     "
              f"{100 * (obs - nulls[-1]):+.1f} pp")
        print(f"    empirical p = {p:.4f}  (floor 1/(N+1) = {1 / (n + 1):.4f})"
              + ("   <- AT THE FLOOR" if abs(p - 1 / (n + 1)) < 1e-12 else ""))
        print()

    return measured


#: THE COMMITTED FIGURES, so `--check` can go red instead of a human being
#: expected to read `RECORDED:` off the screen and compare. Until 2026-08-13
#: `main()` returned None and nothing ever called `sys.exit` with a code, so
#: this runner printed 297/495 and its two nulls and exited 0 whatever it
#: found. It is not in CI, has no test and no caller -- the seventh instrument
#: of this shape found in one session, after `audit_spans.py`,
#: `audit_corpus.py`, `audit_tang_null.py`, `audit_kalevala_null.py` and
#: `canon_sources.py` twice. Doctrine 48: a principle that lives only in prose
#: gets followed exactly as often as somebody remembers it.
#:
#: MEASURED 2026-08-13, and unlike the Tang and Kalevala arms NOTHING HAD
#: DRIFTED. Every figure `quality/NULL_AUDIT.md` §2.4 publishes reproduces
#: exactly: 495 ghazals, 8,384 hemistichs, the sweep 311/311/309/306/300/297,
#: and 297/495 = 60.0% at min_fraction 1.0, which is doctrine 58's own
#: identification of the recorded 297. So there is no repin here -- the pin IS
#: the finding, because the number was previously true by nobody's checking.
#:
#: WHAT IS PINNED AND WHY THAT RATHER THAN THE RATE. The counts are EXACT over
#: a fixed corpus at a fixed threshold, so they are pinnable. The null medians
#: are Monte Carlo estimates and are NOT pinned -- same call `audit_tang_null.py`
#: and `audit_kalevala_null.py` make. The separation here is not close: 297
#: against a null MAX of 0 over 200 replicates, i.e. not one permutation in 200
#: produced a SINGLE ghazal with a full radif, so p sits at its floor with
#: three digits of headroom and is left to the printed value.
#:
#: `mandated`/`judged`/`refused` are pinned as THREE separate numbers rather
#: than as a rate (doctrine 79). `refused` is 0 today, and pinning a zero is
#: the point: if a re-ingestion or a second recension (doctrine 91) starts
#: refusing ghazals, the rate would slide silently while every other pinned
#: figure still matched.
#:
#: Doctrine 58: these are counts, and a count is a coordinate of a threshold
#: AND of a rendering. Argue them and repin with the superseded value visible
#: and dated (doctrine 17); do not tune `radif_share` to meet them.
PINNED = {"ghazals": 495,
          "hemistichs": 8384,
          "mandated": 495, "judged": 495, "refused": 0,
          "sweep": (311, 311, 309, 306, 300, 297),
          "exact": 297, "partial": 90, "absent": 108}

DEFAULT_CORPUS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              "..", "corpus", "fas_hafez.json")


def check(m):
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    print()
    print("=" * 74)
    print("CHECK -- the committed radif counts against this run")
    print("=" * 74)
    bad = 0
    for k in ("ghazals", "hemistichs", "mandated", "judged", "refused",
              "exact", "partial", "absent"):
        ok = m.get(k) == PINNED[k]
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {k:12s} committed {PINNED[k]}"
              + ("" if ok else f", measured {m.get(k)}"))
    got = m.get("sweep")
    for i, mf in enumerate(SWEEP):
        want = PINNED["sweep"][i]
        have = got[i] if got and i < len(got) else None
        ok = have == want
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] sweep mf={mf:.2f}  committed "
              f"{want}" + ("" if ok else f", measured {have}"))
    if bad:
        print()
        print(f"  {bad} figure(s) moved. The ingestion, the recension "
              f"(doctrine 91) or the")
        print("  radif predicate has changed under this arm.")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17).")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    if "--check" in sys.argv:
        # The null draw costs the whole runtime and `check` does not read it.
        sys.exit(check(main(argv[0] if argv else DEFAULT_CORPUS, 5)))
    if not argv:
        sys.exit(__doc__)
    main(argv[0], int(argv[1]) if len(argv) > 1 else 200)
