#!/usr/bin/env python3
"""Regressions written to KILL surviving mutations — structure, value,
ingestion, and the sonnet oracle's HEADLINE.

    python3 quality/test_mut_oracle.py

THE ORACLE HAD NO ASSERTION
---------------------------
`battery.py` is this project's oracle: 152 self-labelled sonnets, 1,064
mandated pairs, and the number every result in `CLAUDE.md` is quoted against.
Its `__main__` prints and returns. **Its exit status is 0 whatever it
observes.** So "run all 23 test files and battery.py" was 23 checks and one
report, and a mutation that moved the headline from 81 violations to 300 would
have been recorded as passing. Mutation M21 -- the battery's own denominator
reverted from JUDGED pairs to MANDATED pairs, which is doctrine 79's defect
planted in the one place doctrine 79 was written about -- is caught by nothing
else in the repo.

This file gives the oracle an assertion, and pins the three counts separately
because doctrine 79 is precisely that they are three counts and not one.

THE PINNED NUMBERS DISAGREE WITH CLAUDE.md, AND THE CODE IS RIGHT
-----------------------------------------------------------------
`CLAUDE.md`'s "Current baselines" says **73/1014, 7.2%**. The shipped harness
says **81/1014, 8.0%**, and `quality/RESULTS_REDTEAM.md` predicted exactly
that: "Battery moves 73/1014 (7.2%) -> 81/1014 (8.0%), exactly as predicted"
when `theta_coda` was calibrated 0.60 -> 0.80. So 7.2% is the PRE-CALIBRATION
figure left standing in the doctrine file, and 73 and 81 are the same
measurement at two settings of one coordinate -- doctrine 58, a bare n-of-N is
a coordinate of a setting somebody did not write down. The setting is named
beside every number below.
"""

import io
import os
import sys
from contextlib import redirect_stdout

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import battery  # noqa: E402
from lyric_harness import (Declaration, Lexicon, check_scheme,  # noqa: E402
                           line_readability, line_tokens, raw_final_token,
                           refusals_for_pairs, readability_records,
                           same_scheme_class, scheme_class, score, best_score,
                           line_anchors)

FAILURES = []
LEX = Lexicon()
DECL = Declaration()

#: The sonnet oracle at the SHIPPED declaration: CMUdict General American,
#: conjunctive_band=True, theta_rhyme 0.75, theta_coda 0.80, theta_nucleus
#: 0.60, scheme ABABCDCDEFEFGG over 152 sonnets. Every one of those is a
#: coordinate of the numbers below (doctrine 58).
SONNETS = 152
PAIRS_MANDATED = 1064          # 7 rhyme-mandated pairs x 152 sonnets
PAIRS_REFUSED = 50             # end word absent from CMUdict: NOT judged
PAIRS_JUDGED = 1014            # the only legitimate denominator
VIOLATIONS = 81                # 8.0% of JUDGED; 73 at theta_coda 0.60


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def rel(a, b):
    aa, _, _ = line_anchors(LEX, a, promote=DECL.final_promotion)
    bb, _, _ = line_anchors(LEX, b, promote=DECL.final_promotion)
    return best_score(aa, bb, DECL, a, b)


# ---------------------------------------------------------------------------
# 1. THE ORACLE, WITH AN ASSERTION ON IT
# ---------------------------------------------------------------------------

def test_sonnet_oracle_headline():
    print("\n1. the sonnet oracle reports three counts and they are pinned")
    buf = io.StringIO()
    with redirect_stdout(buf):
        res = battery.sonnet_battery()
    out = buf.getvalue()

    # DICT, not the violation list, since 9396946 -- see the note in
    # quality/test_homograph.py section 9. `len()` on it is the key count.
    check(f"{SONNETS} sonnets parse", f"{SONNETS} sonnets parsed" in out,
          out.splitlines()[0] if out else "no output")
    check(f"violations == {VIOLATIONS}", res["violations"] == VIOLATIONS,
          f"got {res['violations']}. This is a coordinate of theta_coda: "
          f"73 at 0.60, "
          f"81 at the shipped 0.80 (RESULTS_REDTEAM.md predicted the move). "
          f"If it changes, say which coordinate moved and price it held out "
          f"(doctrine 5) -- do not retune this constant to match.")

    # The three counts, read out of the battery's OWN printed headline. This is
    # what catches a change to the battery's arithmetic rather than to the
    # harness: nothing else in the repo reads what it prints.
    for frag, why in [
        (f"mandated pairs {PAIRS_MANDATED}", "what the FORM requires"),
        (f"judged {PAIRS_JUDGED}", "the only legitimate denominator"),
        (f"refused {PAIRS_REFUSED}", "end word absent from CMUdict"),
        (f"violations {VIOLATIONS} ", "the numerator"),
        ("of JUDGED pairs", "the rate must name its denominator"),
    ]:
        check(f"the headline prints {frag!r}", frag in out, why)

    # Doctrine 79 in one line: the three are not interchangeable.
    check("refused + judged == mandated",
          PAIRS_REFUSED + PAIRS_JUDGED == PAIRS_MANDATED,
          f"{PAIRS_REFUSED} + {PAIRS_JUDGED} = {PAIRS_MANDATED}. Dividing by "
          f"the MANDATED pairs charges the comparator for the ingestion "
          f"layer's misses and reports Shakespeare as failing to rhyme "
          f"viewest/renewest. It is also not conservative in a predictable "
          f"direction: it SHRINKS the band's measured effect.")


# ---------------------------------------------------------------------------
# 2. REFUSALS ARE NOT VIOLATIONS
# ---------------------------------------------------------------------------

def test_refusal_is_recorded_not_counted():
    print("\n2. an unreadable end word is a RECORDED REFUSAL (doctrine 79)")
    lines = ["the night was long and cold",
             "a shape of purest zzzqx",
             "and all the stars were gold",
             "beneath a moon of wax"]
    res = check_scheme(LEX, lines, "ABAB", DECL)
    check("the pair containing the unreadable word is REFUSED",
          res["pairs_refused"] == 1 and res["refusals"][0]["lines"] == (2, 4),
          f"refused={res['pairs_refused']} {[(r['lines'], r['unreadable']) for r in res['refusals']]}")
    check("...and does NOT appear among the violations",
          all(v[:2] != (2, 4) for v in res["violations"]),
          f"violations {res['violations']}")
    check("the counts are reported separately",
          (res["pairs_mandated"], res["pairs_judged"], res["pairs_refused"])
          == (2, 1, 1),
          f"mandated {res['pairs_mandated']}, judged {res['pairs_judged']}, "
          f"refused {res['pairs_refused']}")

    rec = line_readability(LEX, "a shape of purest zzzqx")
    check("the record says the END WORD is what could not be read",
          rec["final_unreadable"] and not rec["readable"]
          and rec["final_token"] == "zzzqx",
          str({k: rec[k] for k in ("final_token", "readable",
                                   "final_unreadable")}))
    check("and it names the instrument, not the poet",
          rec["reason"] and "CMUdict" in rec["reason"],
          rec["reason"])
    recs = readability_records(LEX, lines)
    check("refusals_for_pairs finds it from the records alone",
          len(refusals_for_pairs(recs, [(1, 3)])) == 1)


# ---------------------------------------------------------------------------
# 3. THE SCHEME IS A PARTITION, AND X IS A SINGLETON
# ---------------------------------------------------------------------------

def test_scheme_mandate():
    print("\n3. the mandate is built from EQUAL, non-free classes "
          "(mutations M17, M18)")
    check("X is not a rhyme class", scheme_class("X") is None)
    check(". is not a rhyme class", scheme_class(".") is None)
    check("A is", scheme_class("a") == "A")
    for a, b, want, why in [("A", "A", True, "same class"),
                            ("A", "B", False, "different classes"),
                            ("a", "A", True, "case is not a coordinate"),
                            ("X", "X", False,
                             "two free lines are two SINGLETONS, not a pair"),
                            (".", ".", False, "same"),
                            ("A", "X", False, "one of them is free")]:
        check(f"same_scheme_class({a!r}, {b!r}) is {want}",
              same_scheme_class(a, b) is want, why)

    lines = ["a summer day", "the open door", "a broken vow", "we drive away"]
    for scheme, want in (("AXXA", 1), ("ABCA", 1), ("AABB", 2),
                         ("AAAA", 6), ("XXXX", 0)):
        got = check_scheme(LEX, lines, scheme, DECL)["pairs_mandated"]
        check(f"scheme {scheme} mandates {want} pair(s)", got == want,
              f"got {got}. `quality/schemes.py` has always treated an "
              f"unrhymed line as a singleton BLOCK, so ABXB and ABCB are the "
              f"same partition; the spine disagreed with it silently until "
              f"2026-08-10, and declaring 24 lines of a 41-line lyric free "
              f"then mandated all 276 of their pairs and demanded that "
              f"'does' rhyme with 'heat'. The sonnet oracle cannot see this: "
              f"ABABCDCDEFEFGG contains no X.")


def test_transitivity_defect():
    print("\n4. the graph's self-consistency check (mutation M19)")
    # sun ~ gone ~ stone, and sun !~ stone: a CHAINED SLANT, the structure
    # doctrine 2 says has no letter representation. Declaring all three one
    # class is therefore a defect the letter scheme cannot express, which is
    # the only thing this counter exists to say.
    lines = ["the deed is done", "the light has gone", "a heart of stone"]
    res = check_scheme(LEX, lines, "AAA", DECL)
    edges = {p["endwords"]: (p["relation"], p["score"])
             for p in res["pair_scores"]}
    check("two of the three edges are admitted and one is not",
          res["transitivity_defect_triangles"] == 1,
          f"{edges}. done/stone is CONSONANCE at 0.772 -- it clears the .75 "
          f"scalar and fails on the RELATION, so this also exercises "
          f"`admits`'s second clause. A counter that fires on COMPLETE "
          f"triangles instead reports a broken class as clean.")
    res2 = check_scheme(LEX, ["the deed is done", "the sun has won",
                              "a race begun"], "AAA", DECL)
    check("a complete triangle is NOT a defect",
          res2["transitivity_defect_triangles"] == 0,
          str({p["endwords"]: p["relation"] for p in res2["pair_scores"]}))


# ---------------------------------------------------------------------------
# 5. THE VALUE LAYER
# ---------------------------------------------------------------------------

def test_value_layer():
    print("\n5. identity is not rhyme, and the value flags are findings "
          "(mutations M26-M29)")
    check("an identical word is REPEAT", rel("cat", "cat")["relation"]
          == "REPEAT",
          "doctrine 3: REPEAT inverts by context -- a violation inside a "
          "verse, the requirement across chorus instances, licensed as "
          "radif. Without the check a self-rhyme scores 1.0 and wins.")
    check("same sound, different word is RIME_RICHE",
          rel("sea", "see")["relation"] == "RIME_RICHE",
          "the taxonomy has to be able to SAY it (doctrine 24)")
    check("a genuine rhyme is neither",
          rel("night", "light")["relation"] == "RHYME")
    check("the cliche pair is flagged",
          "cliche_pair" in rel("fire", "desire")["flags"],
          "doctrine 9: passing the band by reaching for fire/desire is the "
          "slop direction, and revise.py's modal exclusion is built on it")
    check("the shared-suffix stem check fires",
          any(f.startswith("shared_suffix") for f in
              rel("running", "gunning")["flags"]),
          "grammatical rather than phonetic rhyme")
    check("...and does NOT fire where the stem is not a word",
          not any(f.startswith("shared_suffix") for f in
                  rel("weather", "feather")["flags"]),
          "-er/-ed/-es/-s only count on real stems: `weath` and `feath` are "
          "not words, so this is a phonetic rhyme and not a grammatical one. "
          "(`water`/`matter` DOES fire, because `wat` and `matt` both appear "
          "in the frequency list -- which is the rule working, not failing.)")


# ---------------------------------------------------------------------------
# 6. INGESTION
# ---------------------------------------------------------------------------

def test_ingestion():
    print("\n6. reading a line into words (mutations M22, M24)")
    check("U+2019 is normalised wherever a word is extracted",
          line_tokens("The rose prepar’d") == ["The", "rose",
                                                    "prepar'd"],
          f"got {line_tokens('The rose prepar’d')}. Doctrine 26: the "
          f"matrix fitter's endword() did not, `prepar’d` split, the "
          f"bare letter 'd' became an end word 75 times, 9.2% of the "
          f"training pairs were corrupted and two of eight registered "
          f"predictions flipped verdict.")
    check("U+2018 too", line_tokens("‘tis done") == ["'tis", "done"],
          str(line_tokens("‘tis done")))
    check("the end word is the line's LAST token",
          raw_final_token("The rose prepar’d") == "prepar'd")
    check("...even when the dictionary cannot read it",
          raw_final_token("i saw the cat zzzqx") == "zzzqx",
          "a path that takes the last word the DICTIONARY could read reports "
          "the rhyme word as `cat`, and on Shakespeare's `grow'st` line "
          "reports `thou`. Measured at 5.14% of song lines before it was "
          "fixed.")
    check("parentheticals are not words",
          raw_final_token("we drove away (chorus)") == "away")


if __name__ == "__main__":
    if os.environ.get("LYRIC_MUTATE_ACTIVE") == "recursion-guard":
        sys.exit(0)
    for fn in (test_sonnet_oracle_headline,
               test_refusal_is_recorded_not_counted,
               test_scheme_mandate,
               test_transitivity_defect,
               test_value_layer,
               test_ingestion):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all mutation-derived structure/value/ingestion regressions pass")
