#!/usr/bin/env python3
"""Regressions for the structure catalog (quality/structures.py) — Phase A/B
of the owner's widening: a mandate names a declared structure per group, and
adding one is transcribing a row, never writing code.

Sections:
  1  the catalog's shape — rows, kinds, the sentinel, world aliases
  2  the judges answer each tradition's OWN question — skothending on the
     coda alone, Kalevala on onsets, masculine rhyme refusing identity
  3  refusals — the sentinel routes to grade(), unknown names refuse,
     a refused pair is None and never False

Run: python3 quality/test_structures.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality import structures as ST  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_catalog():
    print("\n1. the catalog — declared rows on one engine")
    kinds = {}
    for s in ST.STRUCTURES.values():
        kinds[s.kind] = kinds.get(s.kind, 0) + 1
    check("58 declared structures: 1 comparator sentinel, 9 presets, 48 "
          "named axis cells — the 49 named types plus the shipped presets, "
          "as DATA",
          len(ST.STRUCTURES) == 58 and kinds == {"comparator": 1,
                                                 "preset": 9, "cell": 48},
          kinds)
    check("the default is the sentinel and resolves to itself",
          ST.DEFAULT == "english-end-rhyme"
          and ST.resolve(ST.DEFAULT) == ST.DEFAULT
          and ST.get(ST.DEFAULT).kind == "comparator")
    # The resolves are caught so a mutant that drops the alias table fails
    # THIS check by name instead of crashing the suite on an unhandled
    # refusal — red by accident is not the standard (mutation M19's first
    # run taught the same lesson M7's did).
    try:
        aliases_ok = (ST.resolve("qafiya") == "masculine-rhyme"
                      and ST.resolve("antya-prasa") == "masculine-rhyme"
                      and ST.resolve("single-rhyme") == "masculine-rhyme")
    except ST.StructureRefused as e:
        aliases_ok, _detail = False, str(e)[:60]
    check("the world's own names resolve — masculine rhyme IS qafiya IS "
          "antya-prasa, one row, three traditions' vocabulary", aliases_ok)
    check("spaces in a declared name are the hyphens of its row",
          ST.resolve("masculine rhyme") == "masculine-rhyme")


def test_the_judges():
    print("\n2. each judge asks its OWN tradition's question")
    table = [
        # (structure, a, b, want, why)
        ("drottkvaett-hending", "winter", "canter", True,
         "skothending: coda N agrees, vowels differ — the tradition's "
         "half-rhyme, and the generic nucleus+coda predicate would REFUSE "
         "it, which is why the judge reads the preset's own select"),
        ("drottkvaett-hending", "silver", "dreaming", False,
         "no coda agreement at the hending anchors"),
        ("drottkvaett-hending", "storm", "arm", None,
         "a fixed-index -2 anchor has no referent in one syllable: the "
         "question has no coordinates here — REFUSED, not failed"),
        ("kalevala-alliteration", "wind", "winter", True,
         "onset W agrees at the head anchor"),
        ("kalevala-alliteration", "wind", "storm", False, ""),
        ("masculine-rhyme", "night", "delight", True, ""),
        ("masculine-rhyme", "night", "night", False,
         "the cell demands identity 'distinct': the identical word is not "
         "a masculine rhyme"),
        ("masculine-rhyme", "night", "dream", False, ""),
        ("cynghanedd-lusg", "growing", "slow", True,
         "the llusg reach: the penult rhymes an earlier syllable"),
    ]
    for name, a, b, want, why in table:
        got = ST.judge(name, a, b)
        check(f"{name}: {a}/{b} -> {want}" + (f" — {why}" if why else ""),
              got is want if want is None else got == want, f"got {got}")


def test_refusals():
    print("\n3. refusals, never defaults")
    try:
        ST.judge("english-end-rhyme", "night", "delight")
        check("the sentinel REFUSES to judge — the default is graded by "
              "the scalar comparator and the declared admit set inside "
              "grade(), and a second implementation would drift", False)
    except ST.StructureRefused as e:
        check("the sentinel REFUSES to judge — the default is graded by "
              "the scalar comparator and the declared admit set inside "
              "grade(), and a second implementation would drift",
              "grade()" in str(e), str(e)[:60])
    try:
        ST.resolve("vibes-rhyme")
        check("an unknown name refuses, naming the vocabulary", False)
    except ST.StructureRefused as e:
        check("an unknown name refuses, naming the vocabulary",
              "58 structures" in str(e), str(e)[:70])
    check("no row is unnamed — a coordinate without a name cannot be "
          "MANDATED by name, so it is not a row",
          all(s.name for s in ST.STRUCTURES.values()))


if __name__ == "__main__":
    for fn in (test_the_catalog, test_the_judges, test_refusals):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("58 structures, one engine, every row a declared question")
