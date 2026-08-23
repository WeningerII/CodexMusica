#!/usr/bin/env python3
"""Regressions for the two-tier rhyme ban and the declared admit set.

THE OWNER'S RULE (2026-08-18), after hAIR/chAIR, stOVE/wOVE/cOVE and
sOWN/grOWN each passed the old top-6 modal cliff at rank 7-11 of the very
ranking that computed the cliff: tier 1, HOMEOTELEUTON — a partner on the
SAME SPELLED ENDING is the laziest class there is, ranked beneath every
frequency judgment and banned outright; tier 2, the top `modal_exclusion`
most-predictable of the DIFFERENTLY-SPELLED remainder. And the
counterweight that keeps the ban from closing rhyme classes:
`Declaration.admit`, the declared widening of what satisfies a mandate,
backed by the repo's own count — 601 surveyed structures, ~116 canonical,
49 named by the engine, and a door that admitted 2.

Sections:
  1  spelled_rime — the declared orthographic-rime function, by table
  2  the two tiers compose — class banned wholesale, frequency over the
     remainder, offers exclude both (menu and verdict cannot disagree)
  3  the pair verdicts — HOMEOTELEUTON by spelling, MODAL_RHYME by tier 2,
     silence for a pair clean under both
  4  the pursuit is mandatory — HOMEOTELEUTON joins MODAL_RHYME
  5  the admit coordinate — default byte-identical, declared widening
     admits on the scalar, refusals at declaration time

Run: python3 quality/test_homeoteleuton.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (ADMITTABLE_RELATIONS, Declaration,  # noqa: E402
                           check_scheme, Lexicon, spelled_rime)
from quality.loop import MANDATORY_PURSUE  # noqa: E402
from quality.revise import RHYME_FINDINGS, Reviser  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_spelled_rime():
    print("\n1. spelled_rime — the declared orthographic rime, by table")
    table = {"hair": "air", "chair": "air", "despair": "air",
             "prayer": "ayer", "everywhere": "ere",
             "stove": "ove", "wove": "ove", "cove": "ove",
             "sown": "own", "grown": "own", "bone": "one",
             "day": "ay", "way": "ay", "free": "ee", "make": "ake",
             "loved": "ed", "singing": "ing", "sky": "y", "high": "igh"}
    bad = [(w, want, spelled_rime(w)) for w, want in table.items()
           if spelled_rime(w) != want]
    check("all 19 declared cases — silent-e folds (stove->ove, bone->one), "
          "y is a vowel letter (day/way->ay), w is not (sown->own)",
          not bad, bad or "every case as declared")
    check("punctuation and case are stripped before the letters are read",
          spelled_rime("Chair,") == "air" and spelled_rime("'TWAS") == "as")
    check("a wordless token answers the empty string, never a crash",
          spelled_rime("123") == "" and spelled_rime("") == "")


def test_two_tiers_compose():
    print("\n2. the two tiers compose in the field (joint_field)")
    R = Reviser()
    offered, forbidden = R.modal_field("hair")
    fs = set(forbidden)
    check("TIER 1: every same-spelled partner in the field is forbidden — "
          "chair, stair, despair, the whole -air family, whatever its rank",
          {"chair", "stair", "despair", "affair"} <= fs,
          sorted(w for w in fs if spelled_rime(w) == "air")[:8])
    check("TIER 2 digs into the DIFFERENTLY-spelled remainder — prayer "
          "(rank 7 under the old cliff, the word the gap let through) is "
          "now forbidden", "prayer" in fs)
    check("...and the ban is deeper than the old six",
          len(fs) > 6, f"{len(fs)} forbidden")
    check("the OFFERS exclude both tiers — no same-spelled word, nothing "
          "forbidden: the menu and the verdict cannot disagree",
          offered and all(spelled_rime(w) != "air" for w in offered)
          and not (set(offered) & fs), offered[:6])


def test_pair_verdicts():
    print("\n3. the pair verdicts — each tier catches its own class")
    R = Reviser()
    found = R.inspect(
        ["Cold morning light across your silver hair,",
         "you hum, flour rising like a prayer,",
         "same as the day I first pulled up that chair —",
         "the still water sleeping in the cove,",
         "every quilt your patient fingers wove,",
         "but your laugh still shakes me to the bone",
         "the fields your steady hands have sown"],
        mandate=[[1, 2, 3], [4, 5], [6, 7]])
    codes = {}
    for ln, fs in found["per_line"].items():
        for f in fs:
            if f.code in ("HOMEOTELEUTON", "MODAL_RHYME"):
                codes[tuple(f.locations)] = f.code
    check("hair/chair is HOMEOTELEUTON — same spelled -air, caught by the "
          "pair's own spellings with no field consulted",
          codes.get((1, 3)) == "HOMEOTELEUTON", codes)
    check("cove/wove is HOMEOTELEUTON — the -ove class the old cliff let "
          "through at rank 7", codes.get((4, 5)) == "HOMEOTELEUTON")
    check("hair/prayer is MODAL_RHYME — differently spelled, so tier 2's "
          "frequency judgment owns it, and it now reaches deep enough",
          codes.get((1, 2)) == "MODAL_RHYME")
    check("bone/sown carries NEITHER — different spelling ('one'/'own') "
          "and below the frequency tier: silence still means clean",
          (6, 7) not in codes, codes)
    check("HOMEOTELEUTON is a RHYME_FINDING, so a briefed line gets a "
          "candidate field to fix it with", "HOMEOTELEUTON" in RHYME_FINDINGS)
    # THE STRESS ANCHOR — found the day the ban shipped, by a fixture:
    # anchored at the LAST vowel group, silver/deliver shared '-er' and the
    # whole feminine -er rhyme space was one banned class — the "closing
    # rhyme classes" the owner ruled out. The approved definition anchors
    # at the RHYMING syllable (the comparator's own last-primary-stress
    # rule), where silver/deliver spell 'ilver'/'iver' and stay a real
    # rhyme, while singing/ringing still share 'inging' and stay banned.
    check("the rime anchors at the STRESSED syllable — silver/deliver are "
          "DISTINCT ('ilver'/'iver'), not one banned -er class",
          R._spelled_rime("silver") == "ilver"
          and R._spelled_rime("deliver") == "iver",
          (R._spelled_rime("silver"), R._spelled_rime("deliver")))
    check("...and the anchor does not weaken the ban where the stress IS "
          "the last group: singing/ringing share 'inging', still banned",
          R._spelled_rime("singing") == R._spelled_rime("ringing")
          == "inging")


def test_pursuit_is_mandatory():
    print("\n4. the pursuit is mandatory — the class ban cannot be waited "
          "out")
    check("HOMEOTELEUTON is in MANDATORY_PURSUE beside MODAL_RHYME — "
          "additive-only, no declaration can remove it",
          MANDATORY_PURSUE >= {"MODAL_RHYME", "HOMEOTELEUTON"},
          sorted(MANDATORY_PURSUE))


def test_the_admit_coordinate():
    print("\n5. the admit coordinate — ~~widening is BY DECLARATION, never "
          "by default~~ the default admits all four; NARROWING is the "
          "declared move (2026-08-22)")
    lex = Lexicon()
    # sun/much: identical nucleus, disagreeing coda -> ASSONANCE at 0.772,
    # the BAND_PREREGISTRATION.md case.
    #
    # ~~Default: violation.~~ SUPERSEDED 2026-08-22 (doctrine 17 — the old
    # value stays visible). This check used to read "DEFAULT is
    # byte-identical to the old world: sun/much violates as ASSONANCE",
    # and it PASSED, which is how a default that charged a TYPED sonic
    # relation as a violation survived every suite: the pin asserted the
    # defect. The band names this pair ASSONANCE (doctrines 3/24 — the band
    # RELABELS rather than rejects) and the mandate layer then said that
    # name satisfies nothing. One repository, two opposite answers, one
    # pair. The door now admits every relation the vocabulary admits.
    draft = ["we lay all day beneath the sun", "these old hands never "
             "asked for much"]
    strict = check_scheme(lex, draft, "AA", Declaration())
    v = [x for x in strict["violations"] if x[0] == 1 and x[1] == 2]
    check("DEFAULT now SATISFIES sun/much — the band typed it ASSONANCE "
          "and the door no longer contradicts the band "
          "(~~violates as ASSONANCE, refusal naming the declared door~~)",
          not v, v)
    wide = check_scheme(lex, draft, "AA",
                        Declaration(admit=("RHYME", "RIME_RICHE",
                                           "ASSONANCE")))
    v = [x for x in wide["violations"] if x[0] == 1 and x[1] == 2]
    check("DECLARED admit=ASSONANCE: the same pair SATISFIES on its "
          "scalar — the near relation is a first-class declared move",
          not v, v)
    for kwargs, why in ((dict(admit=("RHYME", "PROEST")),
                         "an unknown relation refuses AT DECLARATION time"),
                        (dict(admit=("ASSONANCE",)),
                         "near-only refuses — that is not a rhyme mandate")):
        try:
            Declaration(**kwargs)
            check(why, False, "no refusal raised")
        except ValueError as e:
            check(why, "admit" in str(e), str(e)[:60])
    check("the admittable vocabulary is the taxonomy's named pair set, "
          "REPEAT deliberately absent (identity has its own licence)",
          ADMITTABLE_RELATIONS == {"RHYME", "RIME_RICHE", "ASSONANCE",
                                   "CONSONANCE"})




def test_the_default_admits_everything_admittable():
    """THE DEFAULT IS PINNED, because prose did not hold it (doctrine 48).

    `Declaration.admit` sat at `("RHYME", "RIME_RICHE")` for four days after
    the migration that justified it was over, and this repository defended
    that default more than once while ALSO holding doctrines 3 and 24, which
    exist so the band RELABELS rather than rejects. `sun`/`much` is
    ASSONANCE -- a real sonic event with a name -- and the mandate layer was
    telling the writer it satisfied nothing.

    A preference that lives in a comment is followed exactly as often as
    someone remembers it. This is the check that remembers.
    """
    print("\n   the DEFAULT admit set")
    import lyric_harness as _LH
    check("the default admits EVERY admittable relation — a near relation "
          "the band has already TYPED is a sonic event this project exists "
          "to represent, and a default that charged it as a violation was "
          "one repository giving two opposite answers about one pair",
          set(_LH.Declaration().admit) == set(_LH.ADMITTABLE_RELATIONS),
          str(_LH.Declaration().admit))
    check("...and it DERIVES from `ADMITTABLE_RELATIONS` rather than "
          "restating it, so the default and the validator cannot drift "
          "(doctrine 1) — they were 2,000 lines apart and hand-typed until "
          "2026-08-22",
          tuple(sorted(_LH.ADMITTABLE_RELATIONS)) == _LH.Declaration().admit)
    check("NARROWING is still available and is the useful direction — a "
          "cell that genuinely wants perfect rhyme only declares it and "
          "gets exactly the old behaviour BY SAYING SO",
          _LH.Declaration(admit=("RHYME", "RIME_RICHE")).admit
          == ("RHYME", "RIME_RICHE"))
    try:
        _LH.Declaration(admit=("REPEAT",))
        check("REPEAT is still refused", False, "it was accepted")
    except ValueError:
        check("REPEAT is still REFUSED — identity has its own licence "
              "machinery and admitting it here would let a copied word "
              "satisfy a rhyme", True)


if __name__ == "__main__":
    for fn in (test_spelled_rime, test_two_tiers_compose,
               test_pair_verdicts, test_pursuit_is_mandatory,
               test_the_admit_coordinate,
               test_the_default_admits_everything_admittable):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the lazy class is banned, the taxonomy is the palette")
