#!/usr/bin/env python3
"""Regressions for hazards the SONG corpus exposed in the English path.

Both were found by staging real printed song texts, not by auditing code.
Neither could have been found on Shakespeare and Whitman, because neither of
those sources contains them.

Run: python3 quality/test_english_text.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as lh  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_apostrophes_fold():
    print("\n1. doctrine 26, finally applied to the ENGLISH path")
    # 7,550 curly apostrophes across 30 song files against 41,925 straight
    # ones: the same word arrives in two typographies from two printers.
    # Three strip sites existed and only ONE listed the curly forms -- and
    # stripping edges never helped, because in `weep'd` the mark is INSIDE.
    for a, b in (("weep’d", "weep'd"), ("prepar’d", "prepar'd"),
                 ("I’m", "I'm"), ("o’er", "o'er")):
        check(f"{a} folds to {b}", lh.fold_apostrophes(a) == b)
    check("every typographic variant folds, not just U+2019",
          {lh.fold_apostrophes(c + "d") for c in lh.APOSTROPHES} == {"'d"},
          f"{len(lh.APOSTROPHES)} marks fold to one")
    check("a straight apostrophe is untouched",
          lh.fold_apostrophes("don't") == "don't")


def test_chorus_stubs_are_not_lines():
    print("\n2. `&c.` is a POINTER, not sung text — 941 of them in the corpus")
    # `Oh, my poor Nelly Gray, &c.` is the printer's shorthand for "and the
    # rest of the chorus". Its last token strips to `&c`, which is not a word
    # and would enter the rhyme data as one. This is line identity BY
    # REFERENCE and the repo cannot represent it (MISSING.md A-1).
    for stub in ("Oh, my poor Nelly Gray, &c.",
                 "Then come, weel speed my pleughman lad, &c",
                 "Farewell to the shore, etc."):
        check(f"recognised: {stub[:34]!r}", lh.is_chorus_stub(stub))
    for real in ("Farewell to the old Kentucky shore.",
                 "And I'll never see my darling any more,",
                 "The spacious firmament on high,"):
        check(f"a real line is NOT a stub: {real[:30]!r}",
              not lh.is_chorus_stub(real))


if __name__ == "__main__":
    test_apostrophes_fold()
    test_chorus_stubs_are_not_lines()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all English-text regressions pass")
