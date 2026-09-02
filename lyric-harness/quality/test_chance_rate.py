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


def _reader_disagreements(lex, shipped):
    """-> how many of the shipped draw's pairs the two READERS judge
    differently, by score or by relation.

    The two are `line anchor + best_score` (what `grade()` runs) and
    `word anchor + score` (what a one-word verb runs), and they are a
    DECLARED coordinate of this instrument because M-138's re-derivations
    disagreed on which one they had used. Measured on the JUDGEMENT rather
    than on the admit COUNT: a cut can make two different judgements land on
    the same side, and until 2026-09-02 the count was standing in for the
    reader (see §3).
    """
    import lyric_harness as _L
    decl = _L.Declaration()
    seen = {}
    for name in (CR.SHIPPED.reader, "word anchor + score"):
        sp = CR.Sampler(shipped.seed, shipped.n, shipped.population, name)
        read, cmp_ = CR.READERS[name]
        got = {}
        for a, b in sp.pairs(lex):
            aa, wa = read(lex, a)
            bb, wb = read(lex, b)
            s = None
            if aa and bb:
                try:
                    s = cmp_(aa, bb, decl, wa, wb)
                except (KeyError, IndexError, ValueError):
                    s = None
            got[(a, b)] = None if s is None else (round(s["total"], 6),
                                                  s["relation"])
        seen[name] = got
    one, two = seen[CR.SHIPPED.reader], seen["word anchor + score"]
    return sum(1 for k in one if one[k] != two[k])


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
    # ~~"the same draw judged by the two readers gives DIFFERENT counts"~~
    # STRUCK 2026-09-02, AND THE STRIKE IS THE POINT. That check read a
    # COUNT INEQUALITY as evidence for a STRUCTURAL claim, and the pricing
    # adoption (`MISSING.md` M-138 — ASSONANCE cut at 0.82) made the two
    # counts COINCIDE at 4: both readers now admit the identical four pairs
    # on this draw (telematic/acids, soroka/ida, hohn/gone,
    # inexpensive/clamping). Counts agreeing is NOT the readers being
    # interchangeable, and reading it that way is doctrine 20 — the sample
    # stopped separating them, which is a fact about the sample and the cut.
    # MEASURED on the identical 300 pairs: the two readers return a
    # different score or a different relation on **69** of them (madora/
    # barbara 0.738 ASSONANCE against 0.538 CONSONANCE; causey/overfield
    # 0.670 NO_RELATION against 0.108 ASSONANCE), and exactly ONE of those
    # 69 straddles the old flat 0.75 — which is why the ADMIT counts used to
    # differ and no longer do. The coordinate is pinned where it lives now.
    check("3", "the two readers disagree on 69 of the 300 pairs' SCORE or "
          "RELATION — the reader is a real coordinate, measured on the "
          "judgement and not on a count that happens to coincide",
          _reader_disagreements(lex, shipped) == 69,
          f"{_reader_disagreements(lex, shipped)} of {N}")
    check("3", "...and at the ADOPTED cut those disagreements no longer "
          "move the ADMIT count, which is a fact about this draw and NOT "
          "evidence the two readers are the same (doctrine 20)",
          m3["admit"] == m["admit"],
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

    print("\n5. M-140's premise WAS live — ruled 2026-09-01, the judge reads "
          "`normative` now (the sweep still counts what the ruling closed)")
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
    # REPINNED 2026-09-01 (`MISSING.md` M-140, ruled under the owner's
    # delegation): this check ASSERTED the defect — `homoioteleuton`, the
    # tier-1 ban itself, returned by the silent default as a reason a pair
    # is satisfied. The default reads `normative` now and declines the
    # four disowned names; the pin is inverted, and the sweep's own count
    # of forbidden answers must read ZERO on both arms.
    check("5", "...and the ONE JUDGE no longer returns a `forbidden` schema "
          "as a reason a mandated pair is satisfied — the tier-1 ban's own "
          "canonical example answers without the ban's name in the list",
          "homoioteleuton" not in hit
          and not any(n in hit for n in disowned),
          f"running/singing -> {hit}")
    check("5", "the instrument COUNTS that rather than asserting it: the "
          "forbidden-answer and sole-satisfier counts over the sweep are "
          "both 0 under the ruling, where the sole count alone was 0 before "
          "(doctrine 20 kept M-140 filed LATENT until the default was made "
          "to CLAIM what it claims)",
          m["schema_any_forbidden"] == 0 and m["schema_sole_forbidden"] == 0,
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
