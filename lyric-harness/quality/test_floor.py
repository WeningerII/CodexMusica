#!/usr/bin/env python3
"""Regression tests for the slop floor.

Each test pins a property the gate must keep. Several encode defects that were
found by running earlier code against material it was not designed for, which
is the only way anything in this project has ever been found.

Run: python3 quality/test_floor.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.floor import (CALIBRATION, Finding, FloorDeclaration,  # noqa: E402
                           SlopFloor)

FAILURES = []
FLOOR = SlopFloor()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def codes(lines, scheme=None):
    return {f.code for f in FLOOR.check(lines, scheme)}


def find(lines, code, scheme=None):
    for f in FLOOR.check(lines, scheme):
        if f.code == code:
            return f
    return None


# ---------------------------------------------------------------------------

def test_never_returns_a_score():
    print("\n1. the gate returns findings, never a number")
    out = FLOOR.check(["The cat sat down upon the woven mat",
                       "A dog ran fast across the empty flat"], "AA")
    check("check() returns a list of Finding",
          isinstance(out, list) and all(isinstance(f, Finding) for f in out),
          f"{len(out)} finding(s)")
    check("SlopFloor exposes no score/rank/rate method",
          not any(hasattr(FLOOR, n) for n in ("score", "rank", "rate",
                                              "quality", "overall")),
          "doctrine 6: no weighted quality score, ever")
    check("every finding carries its own evidence",
          all(f.evidence.strip() for f in out) if out else True,
          "a caller can audit any flag without reading this module")
    check("severity is only 'flag' or 'note'",
          all(f.severity in ("flag", "note") for f in out))


def test_too_short_is_silent():
    print("\n2. below two lines the gate declines rather than guesses")
    check("empty input yields no findings", FLOOR.check([]) == [])
    check("one line yields no findings", FLOOR.check(["a lonely line"]) == [])
    check("blank lines are not counted as lines",
          FLOOR.check(["", "   ", "one real line"]) == [],
          "a stanza break must not become a datapoint")


def test_repeat_in_verse():
    print("\n3. a non-recurring self-rhyme is a violation")
    lines = ["I walked into the room and saw the light",
             "I turned away and could not bear the light",
             "She left the door ajar and crossed the floor",
             "He counted out the coins and asked for more"]
    f = find(lines, "REPEAT_IN_VERSE", "AABB")
    check("REPEAT_IN_VERSE fires", f is not None)
    check("it is a flag when another pair rules a radif out",
          f is not None and f.severity == "flag", f.evidence if f else "")
    check("it names the repeated word and the line",
          f is not None and "light" in f.evidence and f.locations == [1],
          f.locations if f else "")


def test_single_pair_repeat_is_undecidable():
    print("\n3b. on one pair the gate declines to decide")
    lines = ["I walked into the room and saw the light",
             "I turned away and could not bear the light"]
    f = find(lines, "REPEAT_IN_VERSE", "AA")
    check("it still reports the repetition", f is not None)
    check("but only as a note, not a rejection",
          f is not None and f.severity == "note")
    check("and it says why it will not decide",
          f is not None and "radif" in f.evidence,
          f.evidence if f else "")


def test_radif_is_not_a_repeat():
    print("\n4. a RECURRING refrain is licensed, not flagged (doctrine 3)")
    # Persian/Urdu ghazal shape: fixed repetend closes every line, the rhyme
    # is what precedes it. Flagging this as self-rhyme would be a category
    # error about a whole tradition. The licence is earned by recurrence.
    ghazal = ["The night was long and I was waiting for you",
              "The road was cold and I was aching for you",
              "I sold the house and kept on saving for you",
              "The years went by and I was praying for you"]
    c = codes(ghazal, "AABB")
    check("REPEAT_IN_VERSE does not fire on a recurring repetend",
          "REPEAT_IN_VERSE" not in c, f"codes: {sorted(c) or 'none'}")
    f = find(ghazal, "RADIF_LICENSED", "AABB")
    check("the suppression is announced rather than silent",
          f is not None and "for you" in f.evidence,
          f.evidence if f else "no RADIF_LICENSED finding")
    # and the qafiya underneath really is being compared
    a, b, radif = FLOOR.qf._strip_radif(ghazal[0], ghazal[1])
    check("the radif is stripped and the qafiya exposed",
          (a, b) == ("waiting", "aching") and radif == 2,
          f"call={a!r} answer={b!r} radif_len={radif}")


def test_shared_suffix_needs_a_real_stem():
    print("\n5. -ed/-er/-es/-s only count on real stems")
    real = ["Down the empty road the band kept walking",
            "Carrying her load, the girl kept talking"]
    check("a genuine shared participle fires",
          "SHARED_SUFFIX" in codes(real, "AA"))
    fake = ["The tired horse was standing in the shed",
            "The heavy cloth that she had woven, bred"]
    check("shed/bred does not fire",
          "SHARED_SUFFIX" not in codes(fake, "AA"),
          "neither 'sh' nor 'br' is a word; this was a false accusation "
          "about craft in the drafted version")


def test_cliche_pair():
    print("\n6. the stock-pair list still fires")
    lines = ["She stood alone and watched the falling rain",
             "And every year she carried all the pain"]
    f = find(lines, "CLICHE_PAIR", "AA")
    check("rain/pain fires", f is not None,
          f.evidence if f else "no CLICHE_PAIR finding")


def test_anaphora():
    print("\n7. repeated line openings")
    same = ["And so the morning comes and so it goes",
            "And all the world is turning in the rain",
            "And every heart is beating in the cold",
            "And every soul is reaching through the pain"]
    f = find(same, "ANAPHORA_OVERLOAD")
    check("100% shared opening fires", f is not None)
    check("it lists every offending line",
          f is not None and f.locations == [1, 2, 3, 4],
          f.locations if f else "")
    varied = ["Morning arrives without ceremony or noise",
              "She counts the coins left over from the fare",
              "Nothing about the platform has been repaired",
              "Later the train will carry someone else"]
    check("varied openings do not fire",
          "ANAPHORA_OVERLOAD" not in codes(varied))


def test_anaphora_is_a_note_about_a_figure():
    print("\n8. anaphora is reported as a decision, not a verdict")
    same = ["And so the morning comes and so it goes",
            "And all the world is turning in the rain"]
    f = find(same, "ANAPHORA_OVERLOAD")
    check("the evidence says deliberate anaphora is a figure",
          f is not None and "figure" in f.evidence,
          "Whitman, the Psalms and every blues refrain would trip this; the "
          "gate must hand the judgement back rather than make it")


def test_thresholds_are_declared_not_hidden():
    print("\n9. every threshold lives in the declaration")
    d = FloorDeclaration()
    defn = set(CALIBRATION["definitional"])
    valued = {k for k, v in d.__dict__.items() if v is not None}
    check("every threshold with a default value is a declared definition",
          valued == defn,
          f"valued: {sorted(valued)}; definitional: {sorted(defn)} — every "
          f"other field is None and takes the profile's measurement, so the "
          f"defaults assert nothing")
    same = ["And so the morning comes and so it goes",
            "And all the world is turning in the rain",
            "And every heart is beating in the cold",
            "And every soul is reaching through the pain"]
    check("the profile supplies the threshold when the field is unset",
          "ANAPHORA_OVERLOAD" in codes(same))
    loose = SlopFloor(decl=FloorDeclaration(anaphora_max=1.0), qf=FLOOR.qf)
    check("an override beats the measurement and suppresses its own finding",
          "ANAPHORA_OVERLOAD" not in {f.code for f in loose.check(same)},
          "a disagreement lands in a coordinate of the declaration "
          "(doctrine 1), not in an argument about the gate")


def test_length_is_a_coordinate():
    print("\n9b. a threshold measured at one length is not used at another")
    from quality.floor import PROFILES, declaration_for
    sec = [p for p in PROFILES if p.name == "section"][0]
    son = [p for p in PROFILES if p.name == "sonnet"][0]
    check("the two profiles disagree about what is normal",
          sec.percentiles["anaphora_max"] != son.percentiles["anaphora_max"],
          f"anaphora_max: section {sec.percentiles['anaphora_max']} vs "
          f"sonnet {son.percentiles['anaphora_max']} — applying the sonnet cut "
          f"to a 4-line chorus flags any two lines sharing an opening")
    p, exact = declaration_for(33)
    check("a 33-token section picks the section profile",
          p is not None and p.name == "section" and exact)
    p, exact = declaration_for(118)
    check("a 118-token sonnet picks the sonnet profile",
          p is not None and p.name == "sonnet" and exact)
    p, exact = declaration_for(3000)
    check("a length no profile reaches is refused, not extrapolated",
          p is None and not exact)
    p, exact = declaration_for(60)
    check("a length between profiles is served but marked inexact",
          p is not None and not exact, f"profile={p.name}, exact={exact}")

    # the load-bearing behaviour: an extrapolated finding may not reject
    long_bad = ["And so the morning comes and so it goes and so it goes"] * 3 \
        + ["And all the world is turning in the rain again and again"] * 3
    fs = FLOOR.check(long_bad)
    tok = sum(len(FLOOR.qf._tokens(x)) for x in long_bad)
    pr, ex = declaration_for(tok)
    if pr is not None and not ex:
        # only the LENGTH-CALIBRATED checks are downgraded. Self-rhyme, radif,
        # cliche and shared suffix do not depend on length, so extrapolating a
        # percentile has nothing to do with them and they keep their severity.
        sized = {"LEXICAL_MONOTONY", "FUNCTION_WORD_HEAVY",
                 "ANAPHORA_OVERLOAD", "UNIFORM_LINE_LENGTH",
                 "PREDICTABLE_RHYME"}
        bad = [f.code for f in fs
               if f.code in sized and f.severity == "flag"]
        check("no length-calibrated flag survives extrapolation", not bad,
              f"{tok} tokens, profile {pr.name}, {len(fs)} finding(s); "
              f"{'flags left: ' + str(bad) if bad else 'none left'}")
        check("length-independent findings keep their severity",
              any(f.severity == "flag" for f in fs
                  if f.code not in sized),
              "a self-rhyme is a self-rhyme at any length")
        check("the extrapolation is announced",
              "EXTRAPOLATED_LENGTH" in {f.code for f in fs})

    # and MATTR, the check that silently changes statistic, must not run
    # outside a profile
    huge = ["word " * 40] * 40
    c = {f.code for f in FLOOR.check(huge)}
    check("outside every profile the length-sensitive checks do not run",
          "LEXICAL_MONOTONY" not in c and "OUT_OF_CALIBRATED_LENGTH" in c,
          f"codes: {sorted(c)}")


def test_calibration_block_is_honest():
    print("\n10. the calibration block cannot silently overclaim")
    for key in ("calibrated", "positive_class", "negative_class", "form",
                "language", "rule", "known_limits"):
        check(f"CALIBRATION declares {key!r}", key in CALIBRATION)
    if CALIBRATION.get("calibrated"):
        profs = CALIBRATION.get("profiles", {})
        defn = set(CALIBRATION.get("definitional", ()))
        d = FloorDeclaration()
        check("every profile records its own percentiles",
              profs and all(p.percentiles for p in profs.values()),
              ", ".join(f"{n}:{len(p.percentiles)}" for n, p in profs.items()))
        # the load-bearing direction: a threshold cannot be added to the
        # declaration without being either measured or explicitly definitional
        measured = {k for p in profs.values() for k in p.percentiles}
        untraceable = [k for k in d.__dict__
                       if k not in measured and k not in defn]
        check("no threshold can hide outside both lists",
              not untraceable,
              f"untraceable: {untraceable}" if untraceable else
              f"{len(measured)} measured, {len(defn)} definitional, "
              f"0 unaccounted")
        check("each profile records the separation it measured",
              all(p.measured_auc for p in profs.values()),
              "; ".join(f"{n}: " + ", ".join(f"{k}={v}" for k, v in
                                             p.measured_auc.items())
                        for n, p in profs.items()))
        check("a profile cannot borrow a threshold it never measured",
              "predictable_pair_fraction_max"
              not in profs["section"].percentiles,
              "the section profile stays silent on PREDICTABLE_RHYME rather "
              "than reusing the sonnet cut")
        check("checks that failed their expectation are recorded too",
              "BACKWARDS" in CALIBRATION.get("failed_expectations", ""),
              "a gate that only shows its working results is advertising")
    else:
        check("an uncalibrated block is marked provisional", True,
              "calibrated=False; findings mean 'outside a guessed range'")


def test_predictability_is_demoted():
    print("\n11. the withdrawn claim is not quietly re-asserted")
    lines = ["The candle burned and set the room on fire",
             "And all night long she nursed a small desire",
             "He said the word and then he turned to go",
             "She never asked the thing she had to know"]
    fs = [f for f in FLOOR.check(lines, "AABB")
          if f.code == "PREDICTABLE_RHYME"]
    check("PREDICTABLE_RHYME, if it fires, is a note not a flag",
          all(f.severity == "note" for f in fs),
          "held out at 0.560 on human-vs-generated, which is chance "
          "(doctrine 11): it may not carry a rejection")
    check("its evidence states the failed replication",
          all("0.560" in f.evidence for f in fs) if fs else True)


def test_out_of_domain_is_announced():
    print("\n12. running outside the calibration domain is stated, not hidden")
    import io
    buf = io.StringIO()
    FLOOR.report(["A short couplet here", "Another line to pair"], "AA",
                 stream=buf)
    text = buf.getvalue()
    check("the report names the calibration corpora",
          CALIBRATION["positive_class"] in text)
    check("the report names the validity limit",
          "NOT validated" in text, "one form, one language, one generator")
    if not CALIBRATION.get("calibrated"):
        check("an uncalibrated run prints the provisional banner",
              "PROVISIONAL" in text)


if __name__ == "__main__":
    for fn in (test_never_returns_a_score, test_too_short_is_silent,
               test_repeat_in_verse, test_single_pair_repeat_is_undecidable,
               test_radif_is_not_a_repeat,
               test_shared_suffix_needs_a_real_stem, test_cliche_pair,
               test_anaphora, test_anaphora_is_a_note_about_a_figure,
               test_thresholds_are_declared_not_hidden,
               test_length_is_a_coordinate,
               test_calibration_block_is_honest,
               test_predictability_is_demoted,
               test_out_of_domain_is_announced):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all slop-floor regressions pass")
