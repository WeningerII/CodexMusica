#!/usr/bin/env python3
"""Regression tests for the IPA phoneme layer.

Every test encodes a failure verified against the real engine before this
module existed. The load-bearing one is `test_unknown_never_scores`: the old
code returned a confident 1.0 for two identical unknown symbols and crashed on
two different ones, so a corpus of unreadable phonemes would have reported
perfect rhyme wherever the strings happened to match.

Run: python3 quality/test_ipa.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.ipa import (ARPABET, IPA, Inventory, Phone, Unknown,  # noqa: E402
                         declared, get, parse_phone, register)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# A deliberately tiny Dutch inventory: enough to prove the mechanism without
# asserting a full phonology this project has not verified.
NL = register(Inventory(
    "nl", IPA,
    vowels={"ɑ": (0.9, 0.1, "back"), "a": (0.9, 0.0, "front"),
            "y": (0.1, 0.9, "front"), "u": (0.1, 0.9, "back"),
            "ɛ": (0.6, 0.2, "front"), "ə": (0.5, 0.5, "central")},
    consonants={"p": (0, 0, "stop"), "b": (0, 1, "stop"),
                "k": (2, 0, "stop"), "f": (0, 0, "fricative"),
                "l": (1, 1, "lateral"), "n": (1, 1, "nasal")},
    source="illustrative subset, not a verified full inventory"))


def test_notation_is_declared_not_sniffed():
    print("\n1. NOTATION IS DECLARED, NEVER GUESSED")
    p = parse_phone("AA1", ARPABET)
    check("ARPABET parses under ARPABET", isinstance(p, Phone)
          and p.base == "AA" and p.stress == 1, f"{p!r}")
    u = parse_phone("yː", ARPABET)
    check("IPA under ARPABET is Unknown, not a crash",
          isinstance(u, Unknown), f"{u!r}")
    try:
        parse_phone("a", "guess")
        check("undeclared notation raises", False, "no exception")
    except ValueError as e:
        check("undeclared notation raises rather than sniffing", True,
              str(e)[:70])


def test_ipa_parses_where_the_old_regex_died():
    print("\n2. THE EXACT SYMBOLS THAT CRASHED split_phone")
    for sym, base, stress, long in (("yː", "y", 0, True),
                                    ("ç", "ç", 0, False),
                                    ("ˈbyː", "by", 1, True),
                                    ("ˌkɑ", "kɑ", 2, False)):
        p = parse_phone(sym, IPA)
        ok = isinstance(p, Phone) and p.base == base and p.stress == stress \
            and p.long == long
        check(f"parse {sym!r}", ok, f"{p!r}")


def test_unknown_never_scores():
    """THE LOAD-BEARING TEST."""
    print("\n3. UNKNOWN NEVER PRODUCES A NUMBER")
    same = NL.similarity("θ", "θ")
    check("two IDENTICAL unknown symbols return None, not 1.0",
          same is None,
          f"got {same!r} -- the old vowel_sim returned 1.0 here via its "
          f"a==b short-circuit")
    diff = NL.similarity("θ", "ð")
    check("two DIFFERENT unknown symbols return None, not a crash",
          diff is None, f"got {diff!r} -- the old cons_sim raised KeyError")
    half = NL.similarity("ɑ", "θ")
    check("known vs unknown returns None", half is None, f"got {half!r}")


def test_known_symbols_score_sensibly():
    print("\n4. KNOWN SYMBOLS STILL SCORE")
    same = NL.similarity("ɑ", "ɑ")
    near = NL.similarity("y", "u")
    cross = NL.similarity("ɑ", "p")
    check("identical vowel scores 1.0", same == 1.0, f"{same}")
    check("y~u are close but not identical",
          near is not None and 0.3 < near < 1.0, f"{near}")
    check("vowel vs consonant scores 0.0", cross == 0.0, f"{cross}")
    lengthened = NL.similarity(parse_phone("ɑː", IPA), parse_phone("ɑ", IPA))
    check("length difference is penalised, not ignored",
          lengthened is not None and lengthened < 1.0, f"{lengthened}")


def test_coverage_is_measurable_before_scoring():
    print("\n5. COVERAGE IS CHECKABLE UP FRONT")
    known, total, unknown = NL.coverage(["ɑ", "p", "θ", "y", "ʒ"])
    check("coverage reports the unknown symbols by name",
          known == 3 and total == 5 and set(unknown) == {"θ", "ʒ"},
          f"{known}/{total} known, unknown={unknown}")


def test_no_default_to_english():
    print("\n6. AN UNDECLARED LANGUAGE IS REFUSED")
    try:
        get("da")
        check("undeclared language raises", False, "returned an inventory")
    except KeyError as e:
        check("undeclared language refuses rather than defaulting to English",
              "English" in str(e) or "declared" in str(e).lower(),
              str(e)[:90])
    check("registry reports what is declared", declared() == ["nl"],
          f"{declared()}")


if __name__ == "__main__":
    test_notation_is_declared_not_sniffed()
    test_ipa_parses_where_the_old_regex_died()
    test_unknown_never_scores()
    test_known_symbols_score_sensibly()
    test_coverage_is_measurable_before_scoring()
    test_no_default_to_english()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all IPA-layer regressions pass")
