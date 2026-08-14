#!/usr/bin/env python3
"""How often does cynghanedd fire -- and how often would it fire on nothing?

WHY THIS FILE EXISTS

The Welsh sourcing cell measured `check_cynghanedd` against a corpus where
essentially EVERY line carries cynghanedd by construction -- three awdlau and a
cywydd, strict metre end to end -- and got 10.3%. Supplying a caesura at the
best word boundary raised it to 26.1%. Both numbers are far under 100%, so the
checker under-detects, and that is a real finding about the checker.

But 26.1% is not comparable with 10.3%, and neither is comparable with any
number this project has recorded before, because the second one comes from a
SEARCH. Taking the best of k caesura placements is k hypotheses. Doctrine 19:
an argmax over a swept parameter is biased. Doctrine 25: agreement is not
evidence. The way to find out whether a searched rate means anything is to run
the identical search on text that cannot contain the thing.

THE NULL

Shuffle the words WITHIN each line. This holds constant almost everything a
skeleton is built from -- the same words, the same consonant inventory, the
same line length, the same syllable count, the same proclitics -- and destroys
only the arrangement, which is the thing cynghanedd actually constrains. Then
run the same k-placement search over the shuffled line.

If the observed rate and the shuffled rate are close, the search is finding
itself and the 26.1% is an artifact. If observed sits well above shuffled, the
excess is the part attributable to the poet.

This is the same fairness rule that had to be applied once already, when
`infer_chains` imposed a band on the hand-set scheme but not on the comparator
and inflated a Whitman result from 21.3% to 35.3%. The comparator gets every
advantage the hypothesis gets.

Run:
  python3 quality/cynghanedd_rate.py corpus/cym_alun_strict.txt [n_shuffles]
  python3 quality/cynghanedd_rate.py --check     (exit 1 on drift, 2 if the
                                                  declared corpora are absent)
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                       # noqa: E402
from quality.phonology.cym import WORD_RE, normalise    # noqa: E402

#: Fixed so a rerun reproduces. A null drawn from a fresh seed each time is a
#: number nobody can check.
SEED = 20260810

EXIT_OK, EXIT_FAILED, EXIT_CANNOT_TELL = 0, 1, 2


def rates(welsh, lines, caesura):
    """-> {judged, hits, tried, by_type}. FOUR INTEGERS AND A COUNTER, and the
    mean is computed at the print site rather than here.

    This used to return `tried / judged` already divided. That threw away the
    only exactly-pinnable form of doctrine 56's own k -- `tried` is an integer
    over a fixed corpus at a fixed search width, and a float rounded to one
    decimal in a print statement is not a figure `--check` can compare. Nothing
    printed changed: `main()` divides at the same place the old return value
    was consumed.
    """
    counts, tried, judged, hits = {}, 0, 0, 0
    for line in lines:
        if caesura == "search":
            hit = welsh.cynghanedd_scan(line)
            kind, k = hit["type"], hit["positions_tried"]
        else:
            kind, _ = welsh.cynghanedd(line, caesura=caesura)
            k = 1
        if k == 0:
            continue
        judged += 1
        tried += k
        if kind:
            counts[kind] = counts.get(kind, 0) + 1
            hits += 1
    return {"judged": judged, "hits": hits, "tried": tried,
            "by_type": counts}


def shuffled(lines, rng):
    """Same words, same length, arrangement destroyed."""
    out = []
    for line in lines:
        w = [x for x in WORD_RE.findall(normalise(line)) if x.strip("'-")]
        rng.shuffle(w)
        out.append(" ".join(w))
    return out


def main(path, n_shuffles=20):
    welsh = get("cym")
    lines = [l.strip() for l in open(path, encoding="utf-8") if l.strip()]
    rng = random.Random(SEED)
    measured = {"lines": len(lines)}

    print(f"{path}: {len(lines)} lines")
    print(f"phonology: {welsh.notation}\n")

    for caesura in ("marked", "search"):
        r = rates(welsh, lines, caesura)
        judged, counts, hit = r["judged"], r["by_type"], r["hits"]
        mean_k = r["tried"] / judged if judged else 0.0
        measured[caesura] = dict(r, by_type=dict(counts))
        print(f"caesura={caesura!r}  {hit}/{judged} = "
              f"{hit / judged:.1%}   mean placements tried = {mean_k:.1f}")
        for k in sorted(counts):
            print(f"    {k:<7} {counts[k]}")

        nulls, null_hits = [], []
        for _ in range(n_shuffles):
            nr = rates(welsh, shuffled(lines, rng), caesura)
            nj = nr["judged"]
            null_hits.append(nr["hits"])
            nulls.append(nr["hits"] / nj if nj else 0.0)
        measured[caesura]["null_hits"] = tuple(null_hits)
        nulls.sort()
        lo, hi = nulls[0], nulls[-1]
        mid = nulls[len(nulls) // 2]
        obs = hit / judged if judged else 0.0
        # a one-sided empirical p: how many shuffles reached the observed rate
        beat = sum(1 for x in nulls if x >= obs)
        p = (beat + 1) / (n_shuffles + 1)
        floor = 1 / (n_shuffles + 1)
        print(f"    null over {n_shuffles} within-line shuffles: "
              f"median {mid:.1%}, range {lo:.1%}-{hi:.1%}")
        print(f"    excess over null: {obs - mid:+.1%}   empirical p = {p:.3f}"
              f"  (floor {floor:.3f} at n={n_shuffles})")
        if p > 0.05:
            print("    -> NOT separated from the null. At this caesura "
                  "setting the checker is finding the search, not the poet.")
        elif abs(p - floor) < 1e-9:
            # Doctrine 20: "inconclusive by construction" is not "significant".
            # p cannot go below 1/(n+1), so a p AT the floor reports the
            # resolution of the experiment, not the strength of the effect.
            # Read the gap between obs and the null's MAXIMUM instead.
            print(f"    -> p is AT the resolution floor: no shuffle reached "
                  f"{obs:.1%}. That is all n={n_shuffles} can say. The "
                  f"separation to judge is obs {obs:.1%} vs null max "
                  f"{hi:.1%} = {obs - hi:+.1%}; raise n to resolve further.")
        print()
    return measured


# --------------------------------------------------------------- the check

#: The replicate count `--check` runs at, and it is NOT the published 200.
#: `check()` reads the OBSERVATION, which does not depend on it, and the null
#: HIT COUNTS, which do -- so the number is declared here and pinned with the
#: figures rather than left implicit at a call site. Five, because the null
#: draw is the whole runtime of this file: n=200 on Alun is minutes, n=5 is
#: seconds, and a check nobody can afford to run is doctrine 48's decoration.
CHECK_N = 5

#: THE COMMITTED FIGURES, so `--check` can go red instead of a human being
#: expected to read the rate off the screen and compare it with a document.
#: Until 2026-08-14 `main()` returned None, nothing called `sys.exit` with a
#: code, and this runner printed 57.1% and its null and exited 0 whatever it
#: found. It is not in CI, has no test and no caller -- the LAST of a family
#: this session closed nine times, after `audit_spans.py`, `audit_corpus.py`,
#: `audit_tang_null.py`, `audit_kalevala_null.py`, `canon_sources.py` (twice),
#: `audit_hafez_radif.py` and `cym_rhyme_rate.py`. Doctrine 48: a principle
#: that lives only in prose gets followed exactly as often as someone
#: remembers it.
#:
#: AND THIS RUNNER IS THE ONE THAT NEEDED IT MOST, because its figure is the
#: one the repository carried under TWO values at once. MEASURED 2026-08-14
#: and the CURRENT value REPRODUCES EXACTLY: Alun `caesura='search'`
#: **890/1558 = 57.1%**, null max 21.8% at n=200, +35.3 pp, p at the 0.005
#: floor. The superseded value is **843/1558 = 54.1%** against a null max of
#: 27.8% (+26.3), and it is kept here visible and dated (doctrine 17) because
#: it is still quoted, as current, in four rows of `data/sources.tsv`.
#:
#: WHICH CHANGE MOVED IT, VERIFIED BY RUNNING THE OLD CODE RATHER THAN BY
#: READING THE LOG. `git show <rev>:quality/phonology/cym.py` at four
#: revisions, each run against this file at the byte-identical corpus:
#:     cc08b43  2026-08-10 04:29  skeleton(text)              843/1558 = 54.1%
#:     d91cc55  2026-08-10 21:19  skeleton(text, extent)      (mid-write)
#:     34f495d  2026-08-10 21:39  + the DOSBARTH class table  890/1558 = 57.1%
#:     9414415  2026-08-11 06:13  the end-rhyme cell          890/1558 = 57.1%
#: So the deciding change is doctrine 82's -- `skeleton()`'s terminus became a
#: property of the line's DIWEDDEB and `extent` lost its default -- and it
#: landed on **2026-08-10**, not on 2026-08-11. The 06:13 commit is merely the
#: LAST commit to touch `cym.py`; it added `rhymes()` and changed the
#: cynghanedd path not at all, which the two identical rows above measure
#: rather than assert.
#:
#: WHAT IS PINNED AND WHY THAT RATHER THAN THE RATE. `hits`, `judged` and
#: `tried` are EXACT over a fixed corpus at a fixed search width, so they are
#: pinnable; `tried` is doctrine 56's own k before it is divided (10.6 = mean
#: of `tried / judged`), and it is here because a null that quietly stopped
#: getting the SAME search width as the observation is the exact join doctrine
#: 56 says breaks first. `by_type` is pinned because the four rules are what
#: a skeleton change moves, and a bare hit count would have shown ONE number
#: moving where four did. Measured across the same two revisions, Alun
#: `search`: croes 187 -> 184, traws 319 -> **375**, sain 272 -> 279, llusg
#: 65 -> 52. The +47 net is almost entirely traws.
#:
#: `null_hits` IS PINNED AS A TUPLE OF COUNTS AT `CHECK_N`, NOT AS A MEDIAN.
#: The published null median/max are Monte Carlo estimates at n=200 and are
#: NOT pinned -- the same call `audit_tang_null.py`, `audit_kalevala_null.py`
#: and `audit_hafez_radif.py` all make. But the seed is FIXED, so at a
#: declared n the replicate sequence is exactly determined, and pinning it
#: catches a change in the SHUFFLE or the TOKENIZER -- which would move the
#: comparator without moving the observation, and is the one drift the
#: observation alone cannot see.
#:
#: BOTH EDITIONS, because the doctrine this file supports states both:
#: METHOD.md item 56 reads "Two editions, 200 shuffles each". Pinning only
#: Alun would let the replication half go stale silently.
#:
#: Doctrine 58: these are counts, and a count is a coordinate of a threshold
#: AND of a rendering. Argue them and repin with the superseded value visible
#: and dated (doctrine 17); do not tune `cynghanedd_scan` to meet them.
PINNED = {
    # 890/1558 = 57.1% search, 129/1558 = 8.3% marked. MEASURED 2026-08-14.
    "corpus/cym_alun_strict.txt": {
        "lines": 1558,
        "marked": {"judged": 1558, "hits": 129, "tried": 1558,
                   "by_type": {"croes": 9, "llusg": 104, "traws": 16},
                   "null_hits": (113, 90, 100, 91, 102)},
        "search": {"judged": 1558, "hits": 890, "tried": 16547,
                   "by_type": {"croes": 184, "llusg": 52, "sain": 279,
                               "traws": 375},
                   "null_hits": (310, 302, 290, 297, 319)},
    },
    # 72/156 = 46.2% search, 5/156 = 3.2% marked. MEASURED 2026-08-14.
    # Superseded: 80/156 = 51.3% search at cc08b43 (doctrine 17).
    "corpus/cym_twm_or_nant_cywydd.txt": {
        "lines": 156,
        "marked": {"judged": 156, "hits": 5, "tried": 156,
                   "by_type": {"llusg": 4, "traws": 1},
                   "null_hits": (6, 15, 11, 7, 4)},
        "search": {"judged": 156, "hits": 72, "tried": 1915,
                   "by_type": {"croes": 27, "llusg": 2, "sain": 28,
                               "traws": 15},
                   "null_hits": (25, 30, 30, 22, 22)},
    },
}

ROOT = os.path.join(HERE, "..")


def check(rel, m):
    """-> (bad, checks). One corpus's committed figures against this run."""
    want, bad, n = PINNED[rel], 0, 0
    ok = m.get("lines") == want["lines"]
    bad += not ok
    n += 1
    print(f"  [{'ok  ' if ok else 'FAIL'}] {'lines':<22s} committed "
          f"{want['lines']}" + ("" if ok else f", measured {m.get('lines')}"))
    for mode in ("marked", "search"):
        got = m.get(mode, {})
        for key in ("judged", "hits", "tried", "by_type", "null_hits"):
            w = want[mode][key]
            g = got.get(key)
            ok = g == w
            bad += not ok
            n += 1
            label = f"{mode}.{key}"
            print(f"  [{'ok  ' if ok else 'FAIL'}] {label:<22s} committed {w}"
                  + ("" if ok else f", measured {g}"))
    return bad, n


def check_all():
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    missing = [rel for rel in PINNED
               if not os.path.exists(os.path.join(ROOT, rel))]
    if missing:
        print()
        print("REFUSED -- the pinned figures are declared over corpora that "
              "are not on disk:")
        for rel in missing:
            print(f"    {rel}")
        print("  Nothing was measured, so nothing moved. This is doctrine "
              "20's 'cannot tell',")
        print("  not a drift, and it does not share an exit code with one.")
        print()
        print("RESULT: CANNOT TELL")
        return EXIT_CANNOT_TELL

    bad = total = 0
    results = {}
    for rel in PINNED:
        results[rel] = main(os.path.join(ROOT, rel), CHECK_N)
    print("=" * 74)
    print(f"CHECK -- the committed cynghanedd figures against this run "
          f"(n={CHECK_N})")
    print("=" * 74)
    for rel in PINNED:
        print(f"  {rel}")
        b, t = check(rel, results[rel])
        bad += b
        total += t
    print()
    if bad:
        print(f"  {bad} of {total} figure(s) moved. `skeleton()`, the "
              f"DOSBARTH class table, the")
        print("  caesura search width or the shuffle has changed under this "
              "arm.")
        print("  THE LAST TIME THIS MOVED IT MOVED 54.1% -> 57.1% and four "
              "documents went")
        print("  three days without hearing. Repin with the date, keep the "
              "superseded value")
        print("  visible (doctrine 17), and re-run the two editions before "
              "quoting either.")
    print("RESULT:", "PASS" if not bad else "FAIL")
    return EXIT_OK if not bad else EXIT_FAILED


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    if "--check" in sys.argv:
        sys.exit(check_all())
    if not argv:
        sys.exit(__doc__)
    main(argv[0], int(argv[1]) if len(argv) > 1 else 20)
