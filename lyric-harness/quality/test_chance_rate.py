#!/usr/bin/env python3
"""Regressions for `quality/chance_rate.py` (`MISSING.md` M-138 / M-140).

The module's whole claim is that it reads the door from the DECLARATION and
measures three doors APART. Both halves are the exact defects M-138 names in
its two sibling instruments — `redteam_band.py` spells the narrow pair as a
LITERAL, `negative_control.py` OMITS `relations=` — and neither of those sites
has a check that would notice. So §2 here is a MUTATION on the declaration: if
the module read a literal, narrowing `decl.admit` would move nothing, and this
suite would be measuring its own docstring.

n is deliberately small: these are contract checks, and the FIGURES are gated
by `chance_rate.py --check` in CI at the full 4,000 (45s). A suite that re-ran
the adopted band would be a second copy of the pin (doctrine 1).
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as L  # noqa: E402
from quality import chance_rate as CR  # noqa: E402
from quality import redteam_band as RB  # noqa: E402

FAILED = []
N = 300


def check(section, claim, ok, evidence=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {claim}")
    if evidence:
        print(f"          {evidence}")
    if not ok:
        FAILED.append(f"{section}: {claim}")


def main():
    lex = L.Lexicon()
    shipped = CR.Sampler(CR.SHIPPED.seed, N, CR.SHIPPED.population,
                         CR.SHIPPED.reader)

    print("1. the three counts are three counts, and they partition")
    m = CR.measure(shipped, lex, L.Declaration())
    check("1", "drawn is accounted for: refused + judged == drawn",
          m["refused"] + m["judged"] == m["drawn"],
          f"{m['refused']} + {m['judged']} == {m['drawn']}")
    check("1", "ADMIT-only and both partition the ADMIT count — the split is "
          "reported, not merely printed",
          m["admit_only"] + m["both"] == m["admit"],
          f"{m['admit_only']} + {m['both']} == {m['admit']}")
    check("1", "...and SCHEMA-only and both partition the SCHEMA count",
          m["schema_only"] + m["both"] == m["schema"],
          f"{m['schema_only']} + {m['both']} == {m['schema']}")
    check("1", "the two doors are NOT the same door — `both` is a proper "
          "subset of each, so summing them would double-count (doctrine 79)",
          m["both"] < m["admit"] and m["both"] < m["schema"],
          f"admit {m['admit']}  schema {m['schema']}  both {m['both']}")

    print("\n2. MUTATION — the door is READ from the declaration, and "
          "narrowing it moves the ADMIT arm onto the NARROW arm")
    # `redteam_band.py:421` spells `("RHYME", "RIME_RICHE")` as a literal, so
    # this mutation would leave it byte-identical. That is the defect; this is
    # the check that this module does not share it.
    narrowed = L.Declaration(admit=tuple(sorted(L.RHYME_RELATIONS)))
    m2 = CR.measure(shipped, lex, narrowed)
    check("2", "the ADMIT arm FALLS when `decl.admit` is narrowed",
          m2["admit"] < m["admit"],
          f"{m2['admit']} against {m['admit']}")
    check("2", "...and lands exactly on the historical two, which is what "
          "'reads the declaration' MEANS here",
          m2["admit"] == m2["narrow"] == m["narrow"],
          f"admit {m2['admit']}  narrow {m2['narrow']}  "
          f"shipped narrow {m['narrow']}")
    check("2", "...while the SCHEMA arm does NOT move, because the 77 are a "
          "different door and `admit` is not their coordinate",
          m2["schema"] == m["schema"],
          f"{m2['schema']} == {m['schema']}")

    print("\n3. the READER is a real coordinate and the two are not "
          "interchangeable")
    other = CR.Sampler(CR.SHIPPED.seed, N, CR.SHIPPED.population,
                       "word anchor + score")
    m3 = CR.measure(other, lex, L.Declaration(), schema=False)
    check("3", "the same draw judged by the two readers gives DIFFERENT "
          "counts — which is why M-138's re-derivations disagreed",
          m3["admit"] != m["admit"],
          f"word anchor {m3['admit']}  against line anchor {m['admit']}")
    check("3", "...and the draw itself is IDENTICAL, so the difference is "
          "the reader and not the sample",
          other.pairs(lex) == shipped.pairs(lex),
          f"{N} pairs, byte-identical")

    print("\n4. the INERT coordinates are ASSERTED, not remembered")
    words = CR.POPULATIONS[CR.SHIPPED.population](lex.entries)
    r1, r2 = random.Random(7), random.Random(7)
    a = [(r1.choice(words), r1.choice(words)) for _ in range(N)]
    b = [tuple(r2.sample(words, 2)) for _ in range(N)]
    check("4", "`rng.sample(words, 2)` IS two `rng.choice` calls on this "
          "population — the DRAW coordinate is inert, measured",
          a == b, f"{N} pairs, byte-identical")
    srt = sorted(words)
    moved = sum(1 for x, y in zip(words, srt) if x != y)
    check("4", "`sorted` moves a handful of entries and no more — the ORDER "
          "coordinate is inert because CMUdict is all but sorted already",
          0 < moved < len(words) // 1000,
          f"{moved} of {len(words)} positions move")

    print("\n5. M-140's premise is live — the judge does not read `normative`")
    from quality import relations as RF
    disowned = sorted(n for n, sc in RF.REGISTRY.items()
                      if getattr(sc, "normative", None)
                      in ("forbidden", "deprecated"))
    check("5", "the registry DISOWNS some of its own names, so the field is "
          "not decorative",
          len(disowned) > 0, f"{disowned}")
    from quality.revise import _relation_phonology
    hit = RF.whole_vocabulary_pairs(["running", "singing"],
                                    _relation_phonology()).get((1, 2)) or []
    check("5", "...and the ONE JUDGE returns a `forbidden` schema as a "
          "reason a mandated pair is satisfied — the tier-1 ban's own "
          "canonical example, with the ban's own name in the list",
          "homoioteleuton" in hit, f"running/singing -> {hit}")
    check("5", "the instrument COUNTS that rather than asserting it, and "
          "reports the SOLE-satisfier case apart (it is 0 today, which is "
          "why M-140 is filed LATENT and not live — doctrine 20)",
          m["schema_sole_forbidden"] <= m["schema_any_forbidden"],
          f"answered on {m['schema_any_forbidden']}, sole on "
          f"{m['schema_sole_forbidden']}")

    print("\n6. the shipped cell is the same DRAW adversary 3 makes")
    check("6", "`Sampler.pairs` reproduces `redteam_band.sample_pairs` — one "
          "definition of the population, not two (doctrine 1)",
          shipped.pairs(lex) == RB.sample_pairs(lex, N,
                                                random.Random(shipped.seed)),
          f"{N} pairs")

    print()
    if FAILED:
        print(f"FAILED {len(FAILED)}:")
        for f in FAILED:
            print(f"  - {f}")
        return 1
    print("all pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
