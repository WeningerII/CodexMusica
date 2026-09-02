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
                           channel_agreement, line_anchors, theta_for)

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
                 ("state", "gate")]:
        r, t = rel(a, b)
        check(f"{a}/{b} stays RHYME", r == "RHYME", f"{r} at {t:.3f}")
    # `bad`/`bat` MOVED, and it is the honest cost of calibrating theta_coda
    # 0.60 -> 0.80 rather than a regression to paper over. The two differ only
    # in the VOICING of the final stop, so D~T agreement (0.667) now sits below
    # the threshold and the pair types as ASSONANCE. Most ears would accept it
    # as a slant rhyme, and that is exactly the 0.6pp of true-positive cost the
    # held-out sweep priced against a 2.6x cut in false positives
    # (quality/RESULTS_REDTEAM.md). Doctrine 24 applies and is why this is
    # survivable: the rule RELABELS, so the pair is still in the taxonomy under
    # a name that is arguably more accurate, rather than deleted.
    r, t = rel("bad", "bat")
    check("bad/bat is now ASSONANCE, not RHYME — the priced cost",
          r == "ASSONANCE", f"{r} at {t:.3f}. Voicing-only coda contrast. If "
          f"this must be RHYME again, that is a theta_coda decision with a "
          f"measured false-positive price, not a bug fix.")


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


def test_theta_for_and_its_readers():
    """8. THE PRICED PER-RELATION CUT, AND — THE HALF THAT MATTERS — WHICH
    SITES READ IT.

    `MISSING.md` M-139 is this repository's entry for a door that moved and
    left 17 of 19 sites behind, so a coordinate only SOME callers read is a
    defect shape already paid for once. `theta_for`'s docstring names its
    readers and its non-readers; this section is what makes that list a
    check instead of a promise, so adding a reader is a test change and not
    a silent one.
    """
    print("\n8. the priced per-relation cut, and which sites read it")
    import inspect
    import lyric_harness as _LH
    from quality import recover as _RC
    from quality import revise as _RV

    check("the shipped cut is declared per relation, not as one scalar",
          DECL.theta_by_relation == {"ASSONANCE": 0.82, "CONSONANCE": 0.75},
          DECL.theta_by_relation)
    check("CONSONANCE is written down at 0.75 rather than omitted — a "
          "measured-equal entry and an absent one are different claims "
          "(doctrine 20)",
          "CONSONANCE" in DECL.theta_by_relation)
    check("ASSONANCE is cut at its priced value",
          theta_for({"total": 0.8, "relation": "ASSONANCE"}, DECL) == 0.82)
    check("RHYME falls back to theta_rhyme — 0.75 was calibrated ON it, and "
          "re-cutting it is a different sitting",
          theta_for({"total": 0.8, "relation": "RHYME"}, DECL)
          == DECL.theta_rhyme)
    check("RIME_RICHE falls back too",
          theta_for({"total": 0.8, "relation": "RIME_RICHE"}, DECL)
          == DECL.theta_rhyme)
    check("a None score does not raise — it answers theta_rhyme",
          theta_for(None, DECL) == DECL.theta_rhyme)
    check("an empty declaration restores the pre-pricing scalar exactly, so "
          "the cut is a DECLARED coordinate and the narrowing direction "
          "stays available",
          theta_for({"total": 0.8, "relation": "ASSONANCE"},
                    Declaration(theta_by_relation={})) == DECL.theta_rhyme)

    # THE READER ROSTER. Named, because M-139's whole content is that a
    # door can move and its sites not move with it.
    reads = {
        "check_scheme": inspect.getsource(_LH.check_scheme),
        "Reviser.grade": inspect.getsource(_RV.Reviser.grade),
        # `_field_one`, NOT `_field` — the first draft of this check named
        # the wrong one and PASSED nothing, which is the section's own
        # subject arriving in the section. `_field` dispatches on
        # `field_band`; `_field_one` is where the "grader" arm actually
        # scores, and it is the site M-139 already repaired once for the
        # same class of miss.
        "Reviser._field_one": inspect.getsource(_RV.Reviser._field_one),
        # The FOURTH, joined 2026-09-02 with the pricing. `recover` does
        # not GRADE, but every edge it lays down is a band-passing pair by
        # construction and the cover goes straight to `--groups=`, so a
        # flat cut here builds covers the grader then charges — the
        # mandate verdict's own question, asked one step earlier.
        "recover.recover": inspect.getsource(_RC.recover),
    }
    for name, src in sorted(reads.items()):
        check(f"MANDATE VERDICT site reads theta_for: {name}",
              "theta_for(" in src,
              "a mandate site judging at a flat theta_rhyme is M-139 again")
    # And the sites that deliberately do NOT, each asking a different
    # question. A reader added here without an argument is the defect.
    from quality import negative_control as _NC
    from quality import redteam_band as _RB
    for name, mod in (("negative_control", _NC), ("redteam_band", _RB)):
        check(f"NON-reader stays a non-reader: {name} — it is a control of "
              f"the BAND / adversary 3's NARROW door, and folding a mandate "
              f"cut in would change what it measures (doctrine 14)",
              "theta_for(" not in inspect.getsource(mod))
    # The chance-rate instrument is the OPPOSITE case and must read it: its
    # subject is the SHIPPED door.
    from quality import chance_rate as _CR
    check("chance_rate.measure DOES read it — its subject is the shipped "
          "door, and a flat 0.75 there would measure a door that no longer "
          "exists",
          "theta_for(" in inspect.getsource(_CR.measure))


if __name__ == "__main__":
    for fn in (test_tripwire_open_syllables_stay_rhyme,
               test_the_leak_closes_by_naming,
               test_consonance_is_named_too,
               test_real_rhymes_survive,
               test_no_flattening,
               test_conjunctive_across_syllables,
               test_admits_requires_both,
               test_theta_for_and_its_readers):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all conjunctive-band regressions pass")
