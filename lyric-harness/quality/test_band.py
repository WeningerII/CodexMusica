#!/usr/bin/env python3
"""Regressions for the conjunctive coda band.

Test 1 is the pre-registered tripwire and is checked first on purpose: if
both-empty codas are read as disagreement, the rule deletes every open-syllable
rhyme in English while appearing to work on the case that motivated it.

Run: python3 quality/test_band.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (NEAR_RELATIONS, RHYME_RELATIONS,  # noqa: E402
                           Declaration, Lexicon, admits, best_score,
                           channel_agreement, line_anchors)

FAILURES = []
LEX = Lexicon()
DECL = Declaration()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def rel(a, b, decl=None, profile=None):
    d = decl or DECL
    aa, _, _ = line_anchors(LEX, a, promote=d.final_promotion)
    bb, _, _ = line_anchors(LEX, b, promote=d.final_promotion)
    s = best_score(aa, bb, d, a, b, profile=profile)
    return s["relation"], s["total"]


def test_tripwire_open_syllables_stay_rhyme():
    print("\n1. TRIPWIRE — agreement is not evidence")
    # Two ABSENT codas carry no EVIDENCE: the fitted matrix scored empty/empty
    # at 0.000 bits, correctly. But they plainly AGREE, and a quarter of the
    # sonnets' mandated pairs are open-syllable. Conflating the two predicates
    # would delete them all while the sun/much test still passed.
    for a, b in [("see", "free"), ("day", "way"), ("low", "snow"),
                 ("die", "eye"), ("me", "be"), ("true", "you")]:
        r, t = rel(a, b)
        check(f"{a}/{b} stays RHYME", r == "RHYME", f"{r} at {t:.3f}")
    aa, _, _ = line_anchors(LEX, "see", promote=DECL.final_promotion)
    bb, _, _ = line_anchors(LEX, "free", promote=DECL.final_promotion)
    nuc, coda = channel_agreement(aa[0], bb[0], DECL)
    check("both-empty codas AGREE", coda is True,
          "the predicate the band asks is agreement, not evidence")


def test_the_leak_closes_by_naming():
    print("\n2. P1 — sun/much is assonance, not a non-relation")
    r, t = rel("sun", "much")
    check("sun/much types as ASSONANCE", r == "ASSONANCE", f"{r} at {t:.3f}")
    check("it is still a named member of the taxonomy",
          r in NEAR_RELATIONS,
          "rejecting it outright would delete assonance from a harness built "
          "to represent it")
    check("but it is no longer admitted as rhyme",
          not admits({"total": t, "relation": r}, DECL.theta_rhyme),
          f"scalar {t:.3f} clears the .75 band; the relation does not")


def test_consonance_is_named_too():
    print("\n3. the other half of the taxonomy")
    for a, b in [("love", "prove"), ("dawn", "again")]:
        r, t = rel(a, b)
        check(f"{a}/{b} types as CONSONANCE", r == "CONSONANCE",
              f"{r} at {t:.3f}")
    check("love/prove is correctly NOT a rhyme in the declared dialect",
          not admits({"total": rel("love", "prove")[1],
                      "relation": rel("love", "prove")[0]}, DECL.theta_rhyme),
          "the declaration says CMUdict General American; love/prove is an "
          "Early Modern rhyme and the residue is a dialect mismatch, which "
          "typing now says out loud")


def test_real_rhymes_survive():
    print("\n4. the rule must not eat genuine rhyme")
    for a, b in [("night", "light"), ("fire", "desire"), ("hand", "land"),
                 ("bad", "bat"), ("state", "gate")]:
        r, t = rel(a, b)
        check(f"{a}/{b} stays RHYME", r == "RHYME", f"{r} at {t:.3f}")


def test_no_flattening():
    print("\n5. P2 — the rule must not flatten the taxonomy")
    r, t = rel("sun", "much", profile="assonance")
    check("the assonance profile still admits sun/much",
          r == "RHYME", f"{r} at {t:.3f} — that profile exists to score "
                        f"nucleus-only agreement, so a coda requirement "
                        f"there would be incoherent")
    off = Declaration(conjunctive_band=False)
    r2, _ = rel("sun", "much", decl=off)
    check("the rule is a declared coordinate that can be turned off",
          r2 == "RHYME",
          "a disagreement about the band lands in Declaration."
          "conjunctive_band (doctrine 1)")
    check("the relation vocabulary grew rather than shrank",
          len(RHYME_RELATIONS | NEAR_RELATIONS) >= 4,
          f"rhyme: {sorted(RHYME_RELATIONS)}; near: {sorted(NEAR_RELATIONS)}")


def test_conjunctive_across_syllables():
    print("\n6. a strong first syllable cannot buy a weak second")
    aa, _, _ = line_anchors(LEX, "nation", promote=DECL.final_promotion)
    bb, _, _ = line_anchors(LEX, "nation", promote=DECL.final_promotion)
    nuc, coda = channel_agreement(aa[0], bb[0], DECL)
    check("identical multisyllable anchors agree on both channels",
          nuc and coda)
    # the predicate is a MINIMUM over aligned syllables, not a mean
    import inspect
    src = inspect.getsource(channel_agreement)
    check("agreement is computed as a minimum over syllables",
          "min(" in src and "codas" in src,
          "a mean would let a strong first syllable compensate, which is the "
          "defect being fixed one level up")


def test_admits_requires_both():
    print("\n7. admission needs the scalar AND the relation")
    check("a high scalar with a near relation is refused",
          not admits({"total": 0.99, "relation": "ASSONANCE"}, 0.75))
    check("a low scalar with a rhyme relation is refused",
          not admits({"total": 0.50, "relation": "RHYME"}, 0.75))
    check("both together are admitted",
          admits({"total": 0.80, "relation": "RHYME"}, 0.75))
    check("rime riche counts as rhyme",
          admits({"total": 0.99, "relation": "RIME_RICHE"}, 0.75))
    check("None is handled", not admits(None, 0.75))


if __name__ == "__main__":
    for fn in (test_tripwire_open_syllables_stay_rhyme,
               test_the_leak_closes_by_naming,
               test_consonance_is_named_too,
               test_real_rhymes_survive,
               test_no_flattening,
               test_conjunctive_across_syllables,
               test_admits_requires_both):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all conjunctive-band regressions pass")
