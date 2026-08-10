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


def rates(welsh, lines, caesura):
    """-> (n_judged, {type: count}, mean_positions_tried)."""
    counts, tried, judged = {}, 0, 0
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
    return judged, counts, (tried / judged if judged else 0.0)


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

    print(f"{path}: {len(lines)} lines")
    print(f"phonology: {welsh.notation}\n")

    for caesura in ("marked", "search"):
        judged, counts, mean_k = rates(welsh, lines, caesura)
        hit = sum(counts.values())
        print(f"caesura={caesura!r}  {hit}/{judged} = "
              f"{hit / judged:.1%}   mean placements tried = {mean_k:.1f}")
        for k in sorted(counts):
            print(f"    {k:<7} {counts[k]}")

        nulls = []
        for _ in range(n_shuffles):
            nj, nc, _mk = rates(welsh, shuffled(lines, rng), caesura)
            nulls.append(sum(nc.values()) / nj if nj else 0.0)
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


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 20)
