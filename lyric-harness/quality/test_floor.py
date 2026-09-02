#!/usr/bin/env python3
"""Regression tests for the slop floor.

Each test pins a property the gate must keep. Several encode defects that were
found by running earlier code against material it was not designed for, which
is the only way anything in this project has ever been found.

Run: python3 quality/test_floor.py
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import lyric_harness as _lh  # noqa: E402
from quality import floor as FL  # noqa: E402
from quality.floor import (CALIBRATION, Finding, FloorDeclaration,  # noqa: E402
                           PROFILES, SlopFloor, declaration_for)

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


def test_the_licence_needs_the_fraction_not_the_bare_count():
    print("\n4b. a run of two in an item of five is NOT a radif — the "
          "FRACTION is the licence's second condition (QF2's detector, "
          "`MISSING.md` M-179)")
    # THE MUTATION SWEPT AND NOTHING WENT RED (run #1171, 2026-08-30): QF2
    # drops `len(ps) / npairs >= need` from the licence and keeps the bare
    # count of two, and 80 checks — this file's own QF2 block included (the
    # `radif_min_pair_fraction is declared and non-trivial` checks far below,
    # which assert the CONSTANT exists and never run a draft through it) —
    # stayed green. The mutant is GENEROUS: it only ever REMOVES findings, so
    # a suite of clean-stays-clean and licensed-stays-licensed cases cannot
    # see it (doctrine 94). What can is the exact draft `_relation_findings`'
    # own docstring was written about: a repetend closing SOME pairs of MANY.
    #
    # ONE RUN, TWO DENOMINATORS, OPPOSITE VERDICTS — the fraction isolated as
    # the only moving part. Pairs A and B both close on 'it' (2 pairs); with
    # three more pairs beside them 2/5 = 40% sits UNDER the declared 50% and
    # the licence must refuse; the SAME four lines alone are 2/2 = 100% and
    # it must grant. Under QF2 the first case is licensed too, which reds
    # both halves of the refusal below while the control holds on either
    # tree — a check that cannot fail is the defect, so the kill was proven
    # by applying the mutation by hand before this shipped.
    verse = [
        "She said she could not risk it",
        "He turned away and tried to fix it",
        "The letter came and she would hide it",
        "He read the name and dropped beside it",
        "The morning broke across the grey bay",
        "She walked the long and quiet way",
        "His boots were heavy on the floor",
        "He counted out the coins for more",
        "A candle burned against the light",
        "The city hummed into the night",
    ]
    check("a run closing 2 of 5 pairs earns NO licence — the count cleared "
          "and the fraction did not",
          find(verse, "RADIF_LICENSED", "AABBCCDDEE") is None,
          "40% against the declared 50%")
    f = find(verse, "REPEAT_IN_VERSE", "AABBCCDDEE")
    check("...and REPEAT_IN_VERSE still speaks about those pairs — the "
          "licence did not swallow real self-rhyme",
          f is not None and "under the declared" in f.evidence
          and f.severity == "note",
          f.evidence[:120] if f else "no REPEAT_IN_VERSE finding")
    check("...naming the run's own lines",
          f is not None and 1 in f.locations and 3 in f.locations,
          f.locations if f else "")
    # THE CONTROL, which must pass on BOTH trees: the identical four 'it'
    # lines with nothing beside them are 2/2 = 100%, so the licence GRANTS —
    # proving the refusal above tests the DENOMINATOR and not the licence's
    # existence.
    lic = find(verse[:4], "RADIF_LICENSED", "AABB")
    check("CONTROL: the same run at 2 of 2 pairs IS licensed — same words, "
          "different denominator, opposite verdict",
          lic is not None and "100%" in lic.evidence,
          lic.evidence[:90] if lic else "no RADIF_LICENSED finding")
    check("CONTROL: ...and REPEAT_IN_VERSE is silent there",
          find(verse[:4], "REPEAT_IN_VERSE", "AABB") is None)


def test_shared_suffix_needs_a_real_stem():
    print("\n5. the ending must be the WHOLE of the rhyme — every worked pair "
          "DECLARED, none chosen by eye")
    # THE OWNER'S RULING, 2026-08-24 (`MISSING.md` M-90): the finding fires
    # *"only when the ending is the whole of the rhyme"*.
    #
    # AND THIS SECTION IS THE GATE THE OWNER ASKED FOR, in their words:
    # *"you keep screwing this up you need to be gating this stuff instead of
    # shooting from the hip"*. Three example pairs were picked by eye in one
    # sitting and all three were wrong — `walking`/`talking` offered as a
    # clean rhyme (`alk` against `alk`), then `singing`/`ringing` and
    # `burning`/`turning` built into a fixture as clean (`ing`, `urn`). So no
    # pair is written here at all: `lyric_harness.SHARED_ENDING_CASES` is the
    # declared table of worked pairs AND their verdicts, this drives the whole
    # of it, and adding an example means declaring what it must do.
    cases = _lh.SHARED_ENDING_CASES
    check("the case table is non-empty and carries BOTH verdicts, so this "
          "section cannot pass by examining one side of the rule",
          len(cases) >= 6
          and {v for _a, _b, v, _w in cases} == {
              _lh.ENDING_IS_THE_RHYME, _lh.ENDING_IS_NOT_THE_RHYME},
          f"{len(cases)} declared case(s)")
    wrong = []
    for a, b, want, why in cases:
        got, _suf, _detail = _lh.ending_carries_the_rhyme(a, b)
        if got != want:
            wrong.append(f"{a}/{b}: want {want}, got {got} — {why}")
    check("EVERY declared case answers as ruled — this is the whole gate, and "
          "a pair that disagrees names itself rather than hiding in a fixture",
          not wrong, "; ".join(wrong) if wrong else f"{len(cases)}/{len(cases)}")

    # AND THE VERDICTS REACH THE FINDING, which the table alone cannot say:
    # a predicate that answers correctly and is wired to nothing is this
    # repository's most-repeated defect.
    fires = ["The board reviewed the clauses it was affecting",
             "The lawyer read them back and kept objecting"]
    f = find(fires, "SHARED_SUFFIX", "AA")
    check("a CARRIES pair reaches the finding, evidence and all",
          f is not None and "spelled rime" in f.evidence,
          f.evidence[:96] if f else "no SHARED_SUFFIX finding")
    silent = ["The kitchen light still burns and no one cares",
              "and nobody came back to climb the stairs"]
    check("a SURVIVES pair produces NO finding — `es` against `airs`, so the "
          "plural is incidental and the rhyme is care/stair",
          "SHARED_SUFFIX" not in codes(silent, "AA"))
    # THE MUTATION: without the spelled-rime condition the rule collapses back
    # to a shared ending alone, which is the defect M-90 opened on.
    survives_now = [(a, b) for a, b, v, _w in cases
                    if v == _lh.ENDING_IS_NOT_THE_RHYME
                    and _lh.shared_ending(a, b)]
    check("...and that is NOT vacuous: those pairs DO share a grammatical "
          "ending, so only the spelled-rime condition is holding them back",
          bool(survives_now), f"{survives_now}")


def test_cliche_pair():
    print("\n6. the stock-pair list still fires")
    lines = ["She stood alone and watched the falling rain",
             "And every year she carried all the pain"]
    f = find(lines, "CLICHE_PAIR", "AA")
    check("rain/pain fires", f is not None,
          f.evidence if f else "no CLICHE_PAIR finding")
    # The list is a DECLARED COORDINATE (doctrine 1), not a module constant
    # the caller has to argue with. Until 2026-08-14 it was the only floor
    # threshold with no field to disagree in.
    d = FloorDeclaration()
    check("the stock list is a declared coordinate",
          isinstance(d.cliche_pairs, frozenset) and len(d.cliche_pairs) == 30,
          f"FloorDeclaration.cliche_pairs, {len(d.cliche_pairs)} pairs")
    check("...and it is DEFINITIONAL, not a measured threshold",
          "cliche_pairs" in CALIBRATION.get("definitional", []),
          "there is no percentile to move: the only disagreement available "
          "is which pairs are on the list")
    empty = SlopFloor(decl=FloorDeclaration(cliche_pairs=frozenset()),
                      qf=FLOOR.qf)
    check("declaring an empty list silences the check",
          not any(x.code == "CLICHE_PAIR" for x in empty.check(lines, "AA")),
          "the declaration is READ, not decorative")
    swapped = SlopFloor(
        decl=FloorDeclaration(cliche_pairs=frozenset(
            [frozenset(("rain", "pain")), frozenset(("moon", "june"))])),
        qf=FLOOR.qf)
    g = [x for x in swapped.check(lines, "AA") if x.code == "CLICHE_PAIR"]
    check("a swapped list does not inherit the shipped list's FPR",
          bool(g) and "does not describe it" in g[0].evidence
          and "no measured rate behind it at all" in g[0].evidence
          and f is not None and "does not describe it" not in f.evidence,
          "the 6.35% is a property of THIS set on THIS corpus (doctrine 22), "
          "so the finding disowns it the moment the set is replaced")
    # WHAT THE FLAG IS NOT. The rate licenses it to fire; it does not make
    # the list a cliche detector, and the finding a writer reads has to say
    # so where they will see it.
    check("the finding states what it is NOT, not only what fired",
          f is not None and "WHAT IT IS NOT" in f.evidence
          and "13.3%" in f.evidence and "#254 of 15,409" in f.evidence,
          "measured: 4 of the top 30 pairs by author dispersion in "
          "data/song_rhymepair_en.tsv are on the list; 9 of the 30 never "
          "fire anywhere in corpus/song/eng_*")
    check("...and it names the missing rhyme test",
          f is not None and "tears" in f.evidence
          and "no rhyme test" in f.evidence,
          "raw string-set membership: tears/years fires 21x over the corpus "
          "on couplets the repo's own perfect-rhyme table gives count zero")


def test_cliche_pair_may_only_reject_where_it_was_measured():
    print("\n6b. CLICHE_PAIR runs at every length and rejects at one")
    # 34 tokens -> the `section` profile EXACTLY.
    inband = ["She stood alone and watched the falling rain",
              "And every year she carried all the pain",
              "The kettle cooled beside an empty chair",
              "A neighbour's radio was playing somewhere"]
    n = sum(len(FLOOR.qf._tokens(x)) for x in inband)
    prof, exact = declaration_for(n)
    f = find(inband, "CLICHE_PAIR", "AABB")
    check("inside a measured range it is a FLAG",
          exact and f is not None and f.severity == "flag",
          f"{n} tokens, profile {prof.name if prof else None}, exact={exact}, "
          f"severity={f.severity if f else None}")
    # Past every profile's reach: the branch where `check()` returns early and
    # CLICHE_PAIR used to be the ONLY flag the gate could still emit.
    huge = inband + ["word " * 40] * 40
    m = sum(len(FLOOR.qf._tokens(x)) for x in huge)
    pr, ex = declaration_for(m)
    fs = FLOOR.check(huge, None)
    g = [x for x in fs if x.code == "CLICHE_PAIR"]
    check("past every profile's reach it still RUNS",
          pr is None and g,
          f"{m} tokens, profile None; the membership test is length-blind "
          f"and nothing about it changed")
    check("...but it may not reject there",
          g and g[0].severity == "note",
          "MEASURED 2026-08-14: 14.74% of the 285 corpus items in this "
          "bucket fire it, against 6.35% in band. An unmeasured rate may "
          "not carry a rejection (doctrine 22)")
    check("...and it was the ONLY flag the gate could emit there",
          not [x for x in fs if x.severity == "flag"
               and x.code != "REPEAT_IN_VERSE"],
          "OUT_OF_CALIBRATED_LENGTH returns before every length-sensitive "
          "check; REPEAT_IN_VERSE stays a flag on purpose, since a word "
          "rhymed with itself needs no calibration")
    # And the announcement has to be TRUE. It said "every finding below is
    # downgraded to a note" while `_relation_findings` hardcoded a flag.
    # REPINNED 2026-09-01 (MISSING.md M-193): `inband` plus a 40-word line
    # is ~69 tokens, which the `short` profile now COVERS exactly, so the
    # stretch that used to land between the section and song bands lands
    # inside a measured range. Ten words puts it at ~42 tokens — reached by
    # the section profile's tolerance band and by the short profile's, and
    # covered by neither — which is the extrapolated case this check is
    # about, with the cliche pair the next two checks read still in it.
    stretched = inband + ["word " * 10]
    s_tok = sum(len(FLOOR.qf._tokens(x)) for x in stretched)
    sp, sx = declaration_for(s_tok)
    ext = find(stretched, "EXTRAPOLATED_LENGTH")
    check("a length between profiles is announced as extrapolated",
          sp is not None and not sx and ext is not None,
          f"{s_tok} tokens, profile {sp.name if sp else None}, exact={sx}")
    check("the extrapolation banner names which checks still ran",
          ext is not None and "REPEAT_IN_VERSE" in ext.evidence
          and "CLICHE_PAIR" in ext.evidence
          and "may not reject" in ext.evidence,
          "it claimed 'every finding below is downgraded to a note' and that "
          "was false — `_relation_findings` is appended AFTER `sev()` and "
          "hardcoded a flag — and false in the direction that makes a "
          "surviving flag look impossible")
    sf = find(stretched, "CLICHE_PAIR")
    check("...and the banner's claim now matches the severity emitted",
          sf is not None and sf.severity == "note",
          f"severity={sf.severity if sf else None}")
    oob = find(huge, "OUT_OF_CALIBRATED_LENGTH")
    check("the out-of-range banner does too",
          oob is not None and "REPEAT_IN_VERSE" in oob.evidence
          and "CLICHE_PAIR" in oob.evidence,
          "a reader of the finding can tell which of the relation checks "
          "can still fail them")


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
    defn = set(CALIBRATION["definitional"]) | set(
        CALIBRATION.get("policy", ()))
    valued = {k for k, v in d.__dict__.items() if v is not None}
    check("every threshold with a default value is a declared definition",
          valued == defn,
          f"valued: {sorted(valued)}; definitional-or-policy: "
          f"{sorted(defn)} — every "
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

    # A DECLARED COORDINATE NOTHING READS IS DECORATION, which is this repo's
    # own recurring failure mode ("BUILT AND NEVER WIRED", CLAUDE.md). The
    # MATTR window was a bare default inside `features._mattr` until
    # 2026-08-14 -- declaring it would buy nothing if `check()` did not
    # actually thread it, so the test is that MOVING it moves the statistic
    # the finding reports. `same` is 34 tokens: at the shipped 50 it is
    # inside the window and `_mattr` degenerates to plain TTR, at 20 it is
    # not and a real moving average is taken.
    def _mattr_evidence(w):
        fl = SlopFloor(decl=FloorDeclaration(mattr_window=w), qf=FLOOR.qf)
        for f in fl.check(same, "ABAB"):
            if f.code == "LEXICAL_MONOTONY":
                return f.evidence
        return ""

    at50, at20 = _mattr_evidence(50), _mattr_evidence(20)
    check("the declared MATTR window reaches the statistic, not just the doc",
          bool(at50) and bool(at20) and at50 != at20,
          "34 tokens: window 50 -> plain TTR, window 20 -> a real moving "
          "average. If these two were equal the field would be a number "
          "nothing reads")
    check("...and the finding NAMES which statistic it computed",
          at50.startswith("TTR ") and at20.startswith("MATTR "),
          f"window 50 -> {at50[:16]!r}; window 20 -> {at20[:16]!r} — the "
          f"`section` profile's own figures are plain TTR for exactly this "
          f"reason (CALIBRATION['mattr_window'])")


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
    # 60 -> 40 tokens, 2026-09-01 (MISSING.md M-193): the `short` profile
    # COVERS 50-150 now, so 60 is exact; 40 is reached by the section band
    # (14-74) and by the short band (40-187) and covered by neither.
    p, exact = declaration_for(40)
    check("a length between profiles is served but marked inexact",
          p is not None and not exact, f"profile={p.name}, exact={exact}")

    # the load-bearing behaviour: an extrapolated finding may not reject
    long_bad = ["And so the morning comes and so it goes and so it goes"] * 3 \
        + ["And all the world is turning in the rain again and again"] * 3
    fs = FLOOR.check(long_bad)
    tok = sum(len(FLOOR.qf._tokens(x)) for x in long_bad)
    pr, ex = declaration_for(tok)
    if pr is not None and not ex:
        # The five LENGTH-CALIBRATED checks are downgraded because their
        # thresholds were extrapolated. CLICHE_PAIR is downgraded too, and
        # for a different reason (see test 6b): it borrows no percentile, but
        # the false-positive rate that lets it reject was only ever measured
        # in band. Self-rhyme, radif and shared suffix keep their severity —
        # a word rhymed with itself is a fact about two lines.
        sized = {"LEXICAL_MONOTONY", "FUNCTION_WORD_HEAVY",
                 "ANAPHORA_OVERLOAD", "UNIFORM_LINE_LENGTH",
                 "PREDICTABLE_RHYME", "CLICHE_PAIR"}
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
        #
        # THREE LISTS SINCE 2026-08-23, and the third was earned by this very
        # check failing. The length gate added `uncalibrated_length` and
        # `require_exact_length`, and they are NEITHER measured NOR
        # definitional: they are not thresholds at all — they compare against
        # nothing, no measurement could move them, and they select BEHAVIOUR
        # where the measurements do not reach. Widening `definitional` to
        # swallow them would have been exactly the category error this check
        # exists to catch, and would have left a reader looking for the
        # calibration run that set a policy.
        policy = set(CALIBRATION.get("policy", ()))
        measured = {k for p in profs.values() for k in p.percentiles}
        untraceable = [k for k in d.__dict__
                       if k not in measured and k not in defn
                       and k not in policy]
        check("no threshold can hide outside the THREE lists",
              not untraceable,
              f"untraceable: {untraceable}" if untraceable else
              f"{len(measured)} measured, {len(defn)} definitional, "
              f"{len(policy)} policy, 0 unaccounted")
        check("and every POLICY entry says what it selects and why it is not "
              "a number a corpus could answer — an unexplained policy field "
              "reads exactly like a threshold nobody calibrated",
              policy and all(
                  isinstance(v, str) and len(v) > 80
                  for v in CALIBRATION.get("policy", {}).values()),
              f"{len(policy)} policy field(s): {sorted(policy)}")
        # AMENDED 2026-08-11. This read `all(p.measured_auc for p in ...)` --
        # every profile must record an AUC -- which was true while every
        # profile came from the same human-vs-generated pair. The `song`
        # profile does not: this repo has no generated song class, so it has no
        # AUC and CANNOT have one, and the old assertion would have been
        # satisfied by borrowing the sonnet's. What has to hold is weaker and
        # more useful: every profile records EVIDENCE, and says which KIND.
        missing = [n for n, p in profs.items()
                   if not p.measured_auc and not p.held_out_fpr]
        check("each profile records evidence of one kind or the other",
              not missing,
              "; ".join(
                  f"{n}: " + (", ".join(f"{k}={v}" for k, v in
                                        p.measured_auc.items())
                              if p.measured_auc else
                              "no generated class; held-out FPR " +
                              ", ".join(f"{k}={v[0]:.2f}%" for k, v in
                                        p.held_out_fpr.items()))
                  for n, p in profs.items()))
        liars = [n for n, p in profs.items()
                 if p.n_generated == 0 and p.measured_auc]
        check("a profile with no generated class claims no separation",
              not liars,
              f"claiming an AUC without a negative class: {liars}" if liars
              else "n_generated=0 implies measured_auc={} — an AUC is a "
                   "statement about two classes and there is only one")
        unsourced = [n for n, p in profs.items()
                     if p.n_generated == 0 and not p.source]
        check("a profile whose only evidence is a false-positive rate names "
              "the text that rate was measured on",
              not unsourced, f"unsourced: {unsourced}" if unsourced else
              "doctrine 22: an FPR is a coordinate of the population it was "
              "measured on")
        check("a profile cannot borrow a threshold it never measured",
              "predictable_pair_fraction_max"
              not in profs["section"].percentiles,
              "the section profile stays silent on PREDICTABLE_RHYME rather "
              "than reusing the sonnet cut")
        check("checks that failed their expectation are recorded too",
              "BACKWARDS" in CALIBRATION.get("failed_expectations", ""),
              "a gate that only shows its working results is advertising")
    # THE PROVISIONAL PATH, EXERCISED RATHER THAN ASSERTED. This sat in an
    # `else:` on `CALIBRATION["calibrated"]` and read `check("an uncalibrated
    # block is marked provisional", True, ...)` until 2026-08-23 (doctrine
    # 17). The shipped tree IS calibrated, so the branch was dead -- and had
    # it ever run it could only have passed, because nothing in it read the
    # banner it was making a claim about. It is now hoisted out of the branch
    # and run every time, against a CALIBRATION whose flag is flipped for the
    # length of the call.
    def _banner():
        buf = io.StringIO()
        SlopFloor(FloorDeclaration()).banner(buf)
        return buf.getvalue()

    was = CALIBRATION.get("calibrated")
    try:
        CALIBRATION["calibrated"] = False
        said = _banner()
    finally:
        CALIBRATION["calibrated"] = was
    check("an uncalibrated block is marked provisional — the banner says so "
          "in the run's own output, not in a comment",
          "PROVISIONAL" in said and "outside a guessed range" in said,
          [ln.strip() for ln in said.splitlines() if ln.strip()][:1])
    check("...and a CALIBRATED block does not print it, so the warning means "
          "something when it appears",
          "PROVISIONAL" not in _banner(),
          "CALIBRATION['calibrated'] is %r in the shipped tree" % (was,))


def test_predictability_is_demoted():
    print("\n11. the note stays a note after the number moved in its favour")
    lines = ["The candle burned and set the room on fire",
             "And all night long she nursed a small desire",
             "He said the word and then he turned to go",
             "She never asked the thing she had to know"]

    # THIS FIXTURE FIRES NOTHING, and until 2026-08-14 that made every pin in
    # this section VACUOUS. Four lines land in the `section` profile, which
    # measured no `predictable_pair_fraction_max` and therefore refuses to run
    # the check at all (§10 pins that refusal) -- so `fs` was empty, `all()`
    # over it was True, and "its evidence states the failed replication"
    # asserted nothing about any string. Doctrine 76 one layer in: a pin is
    # only as good as the demonstration that it could have failed.
    fs = [f for f in FLOOR.check(lines, "AABB")
          if f.code == "PREDICTABLE_RHYME"]
    check("the section profile emits no PREDICTABLE_RHYME to pin",
          not fs,
          "so the pins below declare the threshold themselves rather than "
          "asserting over an empty list")

    # The same lines under a DECLARED threshold -- both pairs sit at 0.944 and
    # 0.998 predictability against the shipped 0.90 axis, so the finding fires
    # and its real evidence string can be read.
    decl = FloorDeclaration(predictable_pair_fraction_max=0.8333)
    fs = [f for f in SlopFloor(decl).check(lines, "AABB")
          if f.code == "PREDICTABLE_RHYME"]
    check("a declared threshold makes the finding fire, so these pins bite",
          len(fs) == 1, f"{len(fs)} finding(s)")
    check("PREDICTABLE_RHYME is a note, never a flag",
          all(f.severity == "note" for f in fs) and bool(fs),
          "doctrine 7 -- a floor may not order the region it already passed. "
          "This is the reason it may not reject, and it does not depend on "
          "the AUC: the severity is unchanged by the 2026-08-14 repin below")
    check("its evidence carries the COLD predictability-only AUC",
          all("0.648" in f.evidence for f in fs) and bool(fs),
          "predictability-only joint, Exp 2, absolute feature set, cold "
          "(quality/test_discriminate.py PINNED abs_exp2.joint_solo)")
    check("and does not still carry the superseded warm figure",
          all("0.560" not in f.evidence for f in fs) and bool(fs),
          "REPINNED 2026-08-14: 0.560 was a warm reading and 'which is "
          "chance' was arithmetic on it. This pin required 0.560 until then, "
          "so the string and the test moved together or not at all")
    # REPINNED 2026-08-22 with the ten-feature joint: 0.964 -> 0.960
    # (`MISSING.md` M-31). The pin and the string move together or not at
    # all, which is the same discipline the 0.560 check two above records.
    check("it names what the number is a coordinate of",
          all("0.960" in f.evidence for f in fs) and bool(fs),
          "doctrine 58: 0.648 is only readable against the ten-feature "
          "joint on the SAME human-vs-generated split")


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


FIXTURES = os.path.join(HERE, "fixtures")


def _sheet(name):
    """A lyric sheet's body lines, section markers dropped — the unit the song
    profile was calibrated on."""
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as fh:
        return [l.strip() for l in fh
                if l.strip() and not (l.strip().startswith("[")
                                      and l.strip().endswith("]"))]


def test_the_floor_runs_on_a_song():
    print("\n13. the length-sensitive half runs on a song-length lyric")
    from quality.floor import declaration_for
    for name, n_lines in (("anaphoric.txt", 26),):
        ls = _sheet(name)
        tok = sum(len(FLOOR.qf._tokens(x)) for x in ls)
        prof, exact = declaration_for(tok)
        check(f"{name} lands in the song profile, exactly",
              prof is not None and prof.name == "song" and exact,
              f"{len(ls)} lines, {tok} tokens -> "
              f"{prof.name if prof else None}, exact={exact}")
        check(f"{name} gets a length-sensitive verdict",
              "OUT_OF_CALIBRATED_LENGTH" not in codes(ls),
              "before 2026-08-11 the example songs got OUT_OF_CALIBRATED_"
              "LENGTH and the entire length-sensitive half of the floor sat "
              "out on the only song-length fixture this project had")
        check(f"{name} really has {n_lines} lines", len(ls) == n_lines)


def test_the_song_profile_was_not_tuned_to_the_examples():
    print("\n14. the thresholds were not chosen to make the examples pass")
    # THE POINT OF THIS TEST. A profile whose cuts were picked so that the
    # repo's own showcase lyrics come out clean would be worthless and would
    # look identical to a good one from the outside. So the guard is pinned to
    # the outcome that a tuned profile could not have produced: the harness's
    # flagship example song FAILS its own gate, on a check whose threshold is
    # the corpus's 95th percentile and nothing else.
    ls = _sheet("anaphoric.txt")
    f = find(ls, "ANAPHORA_OVERLOAD")
    check("the fixture trips ANAPHORA_OVERLOAD", f is not None,
          "13 of its 26 lines open with 'I' — 50% against a human 95th "
          "percentile of 30.0% measured on 1,859 corpus songs. If a later "
          "change makes this pass, the threshold moved for the lyric's sake "
          "and this test is the thing that says so")
    check("and it is a flag, not a note", f is not None and
          f.severity == "flag", "the song profile covers 221 tokens exactly, "
          "so nothing is downgraded for extrapolation")
    from quality.floor import PROFILES
    song = [p for p in PROFILES if p.name == "song"][0]
    # `mattr_min` PINS A WINDOW AS WELL AS A PERCENTILE, and until 2026-08-14
    # nothing here said so. 0.7226 is the 5th percentile of MATTR computed at
    # `FloorDeclaration.mattr_window` = 50 tokens; at another window it is the
    # 5th percentile of a different statistic and this equality would fail for
    # a reason that has nothing to do with the corpus. The band is a
    # coordinate of the window too -- at window 20 the band rule returns
    # 100-350 (2,953 items, 132 authors) rather than the 150-400 / 1,859 /
    # 108 quoted below, so the OTHER four thresholds move with it as well.
    # The sweep, the admissible set [1,22] u [40,93] and the reason 50 is
    # kept rather than retuned are `quality.floor.CALIBRATION["mattr_window"]`.
    # REPINNED 2026-08-22, `mattr_min` ONLY: 0.7128 -> 0.7118, and it is a
    # READER FIX and not a load. `features.py._tokens` matched `[A-Za-z'\-]+`
    # until 2026-08-21, so Barnes's `A-baggèn` was two tokens and `jaÿ` was a
    # letter short; MATTR is a TYPE-token ratio and was being computed over a
    # text nobody printed. The eng token total falls -0.420% as fragments
    # merge back into words, and the band's 5th percentile follows.
    #
    # THE OTHER FOUR RE-DERIVE EXACTLY, which is what makes this one
    # coordinate moving rather than the set being re-adopted: MATTR is the
    # only one of the five that counts TYPES, so it is the only one a
    # tokenisation change can touch.
    #
    # THIS CHECK DID NOT FIND IT AND COULD NOT: it pins the CONSTANT against
    # itself, so it moves only when someone edits `floor.py`. The drift was
    # found by `quality/pin_sweep.py` (`MISSING.md` M-21) through
    # `expected_drift.py`, which re-DERIVES. A pin and a re-derivation are
    # different instruments and this file holds the first kind.
    check("the five song thresholds are the recorded corpus percentiles",
          song.percentiles == {"mattr_min": 0.7172,
                               "function_word_ratio_max": 0.4783,
                               "anaphora_max": 0.3000,
                               "line_length_cv_min": 0.1111,
                               "predictable_pair_fraction_max": 0.9333},
          "RE-ADOPTED 2026-08-26: 200-400 tokens, 2,261 items, 663 authors, "
          "MATTR window 50 (~~150-400, 3,571 items, 879 authors~~; "
          "~~1,859 items, 108 authors~~). THE BAND IS WHAT MOVED and the "
          "four thresholds follow it -- over the SHIPPED 150-400 they "
          "re-derive EXACTLY, which `--without-predictability` measures. The "
          "band moved because the rule is FIVE-check and sub-bin 150-200 "
          "answers predictability 1.0000 against a band-wide 0.9375, "
          "|d| 0.0625 > 0.05; floor.py's own note had been stating the rule "
          "in its FOUR-check form. anaphora is unmoved at 0.3000 for the "
          "third band running. quality/RESULTS_SONG_FLOOR.md 10 carries the "
          "argument and the commands")


#: A sheet that trips EVERY length-sensitive check under the `song` profile at
#: once, so §15's population is the whole of `LENGTH_SENSITIVE` rather than
#: whichever codes one fixture happened to fire.
#:
#: WHY IT IS BUILT HERE RATHER THAN READ FROM `fixtures/`: the section's claim
#: is about the SET of findings, so the text has to be answerable to the set.
#: `anaphoric.txt` — the fixture §15 used until 2026-09-02 — fires exactly ONE
#: of the five (ANAPHORA_OVERLOAD, 221 tokens, 26 lines), so every `all(...)`
#: below it was quantifying over a single finding while reading as though it
#: covered the profile.
#:
#: HOW THE PAIRS WERE CHOSEN, DECLARED because a fixture picked to make a check
#: fire is a tuning decision unless it says so. PREDICTABLE_RHYME needs the
#: fraction of pairs above `predictability_max` (0.90) to exceed the `song`
#: profile's 0.9333, so with n pairs it needs ALL of them: 11/12 is 0.9167 and
#: does not clear. Twelve stock pairs were measured through
#: `QualityFeatures._predictability` and three fell below 0.90 — time/rhyme
#: 0.7213, home/roam 0.7221, eyes/skies 0.8255 — so the nine that cleared are
#: what is here (day/way 0.9942, night/light 0.9735, heart/part 0.9858,
#: true/you 1.0000, mind/find 0.9971, fire/desire 0.9438, rain/again 0.9903,
#: sea/me 0.9997, sun/one 0.9966). Nothing about the CHECK was moved to make
#: this fire; three unsuitable pairs were dropped from a fixture and the
#: measurement that dropped them is written down.
_ALL_FIVE_PAIRS = [("day", "way"), ("night", "light"), ("heart", "part"),
                   ("true", "you"), ("mind", "find"), ("fire", "desire"),
                   ("rain", "again"), ("sea", "me"), ("sun", "one")]


def _sheet_that_trips_every_length_check(n_pairs=9):
    """All nine pairs: 18 lines / 234 tokens, inside `song`'s measured 200-400.

    The first three: 6 lines / 78 tokens, inside `short`'s measured 50-150 —
    the SAME text shortened, so the two arms differ in length and in nothing
    else, which is what makes the shrinking expectation below attributable to
    the profile rather than to the fixture.
    """
    out = []
    for a, b in _ALL_FIVE_PAIRS[:n_pairs]:
        for w in (a, b):
            out.append(f"and it is the one that we would have to be the {w}")
    return out


def test_the_song_profile_makes_no_separation_claim():
    print("\n15. a profile with no negative class may not sound like one")
    import re as _re
    from quality.floor import LENGTH_SENSITIVE

    # THE POPULATION IS DERIVED, NOT LISTED. Until 2026-09-02 this section
    # selected its findings with a literal four-code tuple, and the fifth —
    # PREDICTABLE_RHYME — was the one that broke the promise the section is
    # named after: it printed the SONNET arm's "AUC 0.648 on
    # human-vs-generated" under a profile with no generated class, and said
    # nothing about having no separation. The guard's list was short and a
    # short list looks exactly like a complete one, so the guard is now a
    # function of `floor.LENGTH_SENSITIVE` and of what the running profile
    # actually declares a threshold for.
    # THE MAP MAY NOT GO STALE EITHER. A sixth threshold added to any profile
    # without joining `LENGTH_SENSITIVE` would be a length-sensitive finding
    # nothing here reads — the same defect one layer up.
    declared = {k for p in PROFILES for k in p.percentiles}
    mapped = {pk for pk, _ in LENGTH_SENSITIVE.values()}
    check("`LENGTH_SENSITIVE` names every percentile any profile declares",
          declared == mapped,
          f"declared-not-mapped {sorted(declared - mapped)}; "
          f"mapped-not-declared {sorted(mapped - declared)}")

    # BOTH LYRIC-SHEET PROFILES ARE UNDER TEST, and the second is not a
    # duplicate: `short` declares FOUR thresholds, not five — M-193's stage B
    # REFUSED `predictable_pair_fraction_max` there, because its 95th
    # percentile over that band is 1.0000, the statistic's own ceiling. So the
    # expected finding set SHRINKS BY ARITHMETIC on the shorter sheet, and if
    # it did not, the derivation below would be a constant wearing a
    # comprehension.
    seen_profiles = []
    for n_pairs in (9, 3):
        ls = _sheet_that_trips_every_length_check(n_pairs)
        n_tok = sum(len(FLOOR.qf._tokens(l)) for l in ls)
        prof, exact = declaration_for(n_tok, len(ls))
        check("the sheet lands EXACTLY in a profile with no generated class",
              prof is not None and exact and prof.n_generated == 0,
              f"{n_tok} tokens, {len(ls)} lines -> "
              f"{prof.name if prof else None}, exact={exact}, "
              f"n_generated={prof.n_generated if prof else '-'}")
        if prof is None:
            continue
        seen_profiles.append(prof.name)

        # Which codes MUST appear: every length-sensitive finding this
        # profile declares a threshold for.
        want = {c for c, (pk, _) in LENGTH_SENSITIVE.items()
                if pk in prof.percentiles}
        got = {f.code for f in FLOOR.check(ls)} & set(LENGTH_SENSITIVE)
        check(f"[{prof.name}] every length-sensitive finding the profile "
              f"declares actually FIRES on this sheet, so no check below is "
              f"vacuous",
              got == want, f"want {sorted(want)}; got {sorted(got)}")

        fs = [f for f in FLOOR.check(ls) if f.code in LENGTH_SENSITIVE]
        check(f"[{prof.name}] at least one finding is under test", bool(fs))

        # THE DISCLOSURE IS THE PROFILE'S OWN SENTENCE, CHARACTER FOR
        # CHARACTER. This is what makes it mechanical rather than a promise:
        # the expected text is computed by calling `Profile.evidence_for`
        # here, so deleting the call from a finding — or retyping its content
        # beside the call — turns this red (doctrine 1, doctrine 48).
        for f in fs:
            key = LENGTH_SENSITIVE[f.code][1]
            check(f"[{prof.name}] {f.code} carries the profile's OWN evidence "
                  f"phrase, derived and not retyped",
                  prof.evidence_for(key) in f.evidence,
                  f"expected: {prof.evidence_for(key)[:70]}...")

        # `AUC \d` and not the bare word: the finding is REQUIRED to contain
        # the string "no AUC and no separation claim", so a substring test on
        # "AUC" would pass on the disclaimer and fail on the honest text. What
        # must not appear is a NUMBER after it — UNLESS the number is
        # attributed to the arm that produced it. PREDICTABLE_RHYME
        # legitimately cites the sonnet arm's 0.648/0.710/0.960; what it may
        # not do is print them bare, where a reader takes them for this
        # profile's separation (doctrine 58).
        for f in fs:
            if not _re.search(r"AUC\s*[0-9]", f.evidence):
                continue
            check(f"[{prof.name}] {f.code} quotes a numeric AUC, so it names "
                  f"the arm that measured it and refuses the carry",
                  "ON THE SONNET ARM" in f.evidence
                  and "may not be read as this profile's separation"
                  in f.evidence,
                  "an unattributed AUC under a profile with no generated "
                  "class is the exact carry `Profile.evidence_for` exists to "
                  "prevent")
        check(f"[{prof.name}] and each says so in as many words",
              all("no AUC and no separation claim" in f.evidence for f in fs))
        check(f"[{prof.name}] every finding states its held-out "
              f"false-positive rate",
              all("HELD-OUT human song" in f.evidence for f in fs),
              "doctrine 22: a threshold is a false-positive rate, not a point "
              "on a scale")
        check(f"[{prof.name}] and states that this does not mean it catches a "
              f"machine",
              all("not whether it catches a machine" in f.evidence
                  for f in fs))

    check("the two arms landed in DIFFERENT profiles, so the derivation above "
          "is not one profile read twice",
          len(set(seen_profiles)) == 2, f"{seen_profiles}")

    # The period half below reads the ANAPHORA_OVERLOAD finding on the
    # original fixture, which is where the withdrawal was pinned.
    ls = _sheet("anaphoric.txt")
    fs = [f for f in FLOOR.check(ls)
          if f.code in ("ANAPHORA_OVERLOAD", "LEXICAL_MONOTONY",
                        "FUNCTION_WORD_HEAVY", "UNIFORM_LINE_LENGTH")]
    # WHAT THIS PINS CHANGED ON 2026-08-20, AND THE OLD PIN WAS THE DEFECT.
    # Until then these three lines asserted that the finding carries a LIVE
    # period slope -- doctrine 11, author-level Spearman +0.275 against birth
    # year, p_perm 0.0042 over 10,000 label permutations at seed 20260811,
    # measured on the 108 dated authors the song profile was calibrated over.
    # Re-derived over 407 dated authors it does not reproduce: rho -0.008,
    # p_perm 0.8695. So the shipped finding now carries a WITHDRAWAL and this
    # section moves with it. Doctrine 17 sets the shape: the struck figure
    # stays legible and may never stand as a live claim.
    #
    # AND THE OLD CHECK COULD NOT HAVE FAILED ON AN EMPTY LIST. It was
    # `all(... for f in fs if f.code == "ANAPHORA_OVERLOAD")`, which is True
    # over no findings at all, so a build that stopped emitting the code
    # entirely would have printed PASS. The population is named first now.
    an = [f for f in fs if f.code == "ANAPHORA_OVERLOAD"]
    check("exactly one ANAPHORA_OVERLOAD is under inspection", len(an) == 1,
          f"got {len(an)} -- an empty list makes every check below vacuous, "
          "which is what the old `all(... if ...)` spelling did")
    ev = an[0].evidence if an else ""
    check("the period question is carried in the finding, not only the docs",
          "PERIOD" in ev,
          "doctrine 48: a withdrawal that lives only in "
          "quality/RESULTS_SONG_FLOOR.md reaches nobody reading the finding")
    check("and what it carries is a WITHDRAWAL, not a live slope",
          "PERIOD CAUTION WITHDRAWN" in ev and "-0.008" in ev
          and "0.8695" in ev,
          "re-derived over 407 dated authors against the original 108: "
          "rho -0.008, p_perm 0.8695 -- ABSENT and sign-flipped, not weaker, "
          "so the caution is withdrawn rather than softened")
    check("the struck figure is still legible, and marked as struck",
          "+0.275" in ev and "used to read" in ev,
          "doctrine 17: a check may be kept after its premise is falsified "
          "but never quoted as if it were not -- +0.275 stays visible and "
          "may not stand unqualified")
    check("and the withdrawal does not read as a clean bill",
          "472 undated" in ev and "NOT missing at random" in ev
          and "moved rather than left" in ev,
          "doctrine 20: 472 of 879 authors are undated and NOT missing at "
          "random, and `mattr`/`fwr` now carry the slopes -- a failure to "
          "reproduce, not an acquittal, and the confound relocated")


def test_the_song_profile_did_not_swallow_everything():
    print("\n16. adding a profile must not delete the refusal")
    from quality.floor import declaration_for
    for tok in (501, 700, 3000):
        p, _ = declaration_for(tok)
        check(f"{tok} tokens is still outside every profile", p is None,
              "doctrine 15: length is a coordinate of the declaration. A "
              "profile widened until nothing refuses is not a calibration")
    huge = ["word " * 40] * 40
    c = codes(huge)
    check("OUT_OF_CALIBRATED_LENGTH still fires above the song band",
          "OUT_OF_CALIBRATED_LENGTH" in c and "LEXICAL_MONOTONY" not in c,
          f"codes: {sorted(c)}")
    p, exact = declaration_for(450)
    check("450 tokens is served by the song profile but marked inexact",
          p is not None and p.name == "song" and not exact,
          "1.25x tolerance -> applied 120-500. Measured on the song corpus, "
          "carrying these thresholds to 2.0x raises the union false-positive "
          "rate from 20.79% to 26.33%, which is why this profile does not "
          "take the 2.0 the other two ship with")


def test_the_examples_are_not_in_the_calibration_set():
    print("\n17. the scored text is independent of the text that set the cut")
    import glob
    import re
    import unicodedata

    def norm(s):
        s = unicodedata.normalize("NFC", s).replace("’", "'")
        return " ".join(re.sub(r"[^a-z0-9 ']+", " ", s.lower()).split())

    corpus = set()
    for p in glob.glob(os.path.join(HERE, "..", "corpus", "song",
                                    "eng_*.txt")):
        with open(p, encoding="utf-8", errors="replace") as fh:
            for l in fh:
                n = norm(l)
                if len(n) >= 12:
                    corpus.add(n)
    check("the calibration set is the one the profile names",
          len(corpus) > 100000, f"{len(corpus)} distinct normalised lines "
                                f">= 12 chars in corpus/song/eng_*.txt")
    for name in ("anaphoric.txt",):
        lines = {norm(l) for l in _sheet(name) if len(norm(l)) >= 12}
        shared = lines & corpus
        check(f"{name} shares no line with the calibration set", not shared,
              f"{len(lines)} long lines, {len(shared)} shared. Doctrine 13: a "
              f"resource used to score a cell must be independent of that "
              f"cell's label, and a calibration set containing the item it "
              f"scores has measured nothing"
              + (f" — {sorted(shared)[:3]}" if shared else ""))


def test_anaphora_tie_break_reproduces():
    print("\n18. a tie is broken by the text, not by the hash seed")
    # doctrine 66. This read `max(set(firsts), key=firsts.count)` until
    # 2026-08-11, and a set of strings iterates in an order Python randomises
    # per process. On the fixture below the RATE was a stable 0.5 and the
    # reported word alternated between 'alpha' and 'beta' across
    # PYTHONHASHSEED 0-5, taking the finding's line numbers with it — so the
    # evidence and the locations, which are the part a writer acts on, did not
    # reproduce. Only a cross-process run could have found it, so that is what
    # this test does.
    import subprocess
    tie = ["Alpha one", "Beta two", "Alpha three", "Beta four"]
    rate, word = FLOOR._anaphora(tie)
    check("the tie goes to the word that appears first",
          (rate, word) == (0.5, "alpha"), f"{rate}, {word!r}")
    prog = (
        "import sys; sys.path.insert(0, %r); sys.path.insert(0, %r)\n"
        "from quality.floor import SlopFloor\n"
        "print(SlopFloor._anaphora(None, %r))\n"
        % (os.path.join(HERE, ".."), os.path.join(HERE, "..", ".."), tie))
    seen = set()
    for seed in range(6):
        env = dict(os.environ, PYTHONHASHSEED=str(seed))
        r = subprocess.run([sys.executable, "-c", prog], capture_output=True,
                           text=True, env=env,
                           cwd=os.path.join(HERE, ".."))
        seen.add(r.stdout.strip() or r.stderr.strip()[-120:])
    check("six PYTHONHASHSEEDs give one answer", len(seen) == 1,
          f"{sorted(seen)}")



def test_the_two_mutants_this_suite_could_not_see():
    """Both survived `quality/mutate.py`'s sweep on 2026-08-13.

    Neither is hypothetical. Each is a one-line edit to `quality/floor.py` that
    the whole ten-file inventory ran against and did not notice, and both are
    in the GENEROUS direction -- they only ever REMOVE findings. That is
    doctrine 94 as a measurement rather than a worry: a positive-case suite
    cannot find a rule that is too generous, because every case it carries is
    one the rule is supposed to pass.
    """
    print("\n19. the two mutants this suite could not see (doctrine 94)")

    # QF4 -- `declaration_for` returned `min(reach, key=gap)`; the mutant
    # returned `reach[0]`. PROFILES is ordered section, sonnet, song, so at a
    # song length the mutant grades a real song on the SECTION profile's 29-37
    # token percentiles: an extrapolation of a hundred-odd tokens past a
    # measured edge, at a length the song profile actually MEASURED. This
    # suite asserted which profile is chosen only at lengths where every rule
    # agrees, so the difference was invisible to it.
    # THE LENGTH MATTERS, and getting this wrong once is why it is spelled
    # out. At a COVERED length `declaration_for` returns from its `covers`
    # loop and never reaches the mutated line at all, so a test there passes
    # under the mutant too. The discriminating lengths are the ones where NO
    # profile covers and two REACH -- there the rule picks the smallest
    # extrapolation and `reach[0]` picks whichever comes first in PROFILES.
    # REPOINTED 2026-08-26 FROM ~~149, 140~~ WITH THE BAND (MISSING.md M-131).
    # The song profile's measured range is 200-400 now, so its tolerance band
    # opens at 160 and 140/149 no longer reach it at all -- at those lengths
    # only the sonnet reaches and the discriminating condition is simply
    # false. 199 and 180 are the same question at the band that ships.
    # REPINNED 2026-09-01 (MISSING.md M-193): a FOURTH profile, `short`
    # (50-150 tokens, reach 40-187), sits after `song`; the mutant's
    # `reach[0]` is still the sonnet at every length below, so the
    # mutation stays live.
    order = [p.name for p in PROFILES]
    check("PROFILES is ordered section, sonnet, song, short",
          order == ["section", "sonnet", "song", "short"], " -> ".join(order))
    song_lo = [p for p in PROFILES if p.name == "song"][0].lo
    for n, want_reach in ((199, ["sonnet", "song"]),
                          (180, ["sonnet", "song", "short"])):
        reach = [p.name for p in PROFILES if p.reaches(n)]
        got, exact = declaration_for(n)
        check(f"at {n} tokens {len(want_reach)} profiles REACH and none "
              f"COVERS -- the mutated line is live here",
              reach == want_reach and not exact, f"reaches {reach}")
        check(f"...and the choice is `song`, the smallest extrapolation",
              got.name == "song",
              f"got {got.name!r}. `reach[0]` would give {reach[0]!r} -- "
              f"{n - 126} tokens past the sonnet's measured 126, against "
              f"{song_lo - n} short of the song's {song_lo}. This is the "
              f"worked case `declaration_for`'s own comment records")

    # AND THE COST OF THE 2026-08-26 REPIN IS PINNED HERE RATHER THAN LEFT TO
    # BE REDISCOVERED (MISSING.md M-132). Narrowing the song band to 200-400
    # handed 150-163 to the SONNET profile: `gap()` minimises the
    # extrapolation in TOKENS and knows nothing about FORM, so a whole lyric
    # sheet is judged against a 14-line profile's percentiles there. It is
    # NOT silent -- `EXTRAPOLATED_LENGTH` fires and nothing can reject -- and
    # it is not new, only wider: the same handoff ran 127-149 before. This
    # check is the record that it is known, and it goes red if the selector
    # or either band moves again.
    # ~~for n in (150, 163): falls to `sonnet`~~ -- THE COST OF THE
    # 2026-08-26 REPIN IS PAID BACK 2026-09-01 (MISSING.md M-193): the
    # `short` profile COVERS 50-150 exactly -- 127-150 included, the
    # lengths that used to fall to the sonnet -- and its reach (40-187)
    # takes 163 at a 13-token extrapolation where the sonnet's was 37. So
    # the sonnet handoff for a lyric sheet is CLOSED: the only lengths
    # a lyric sheet meets the sonnet profile at are the sonnet's own
    # 108-126, which both cover, and there `declaration_for`'s line-count
    # tie-break (preregistration §4) decides -- fourteen lines is a
    # sonnet, anything else a sheet.
    got_150, ex_150 = declaration_for(150)
    check("at 150 tokens a lyric sheet is EXACT under `short` -- the "
          "2026-08-26 handoff to the sonnet is paid back here",
          got_150 is not None and got_150.name == "short" and ex_150,
          f"got {got_150.name if got_150 else None!r}, exact={ex_150}")
    got_163, ex_163 = declaration_for(163)
    check("at 163 tokens it falls to `short`, extrapolated 13 tokens, "
          "where it fell to `sonnet` extrapolated 37",
          got_163 is not None and got_163.name == "short" and not ex_163,
          f"got {got_163.name if got_163 else None!r}, exact={ex_163}")
    got_127, ex_127 = declaration_for(127)
    got_138, ex_138 = declaration_for(138)
    check("...and the sonnet handoff for a lyric sheet is CLOSED, not "
          "narrowed: 127-150 sit INSIDE the short band, so 127 and 138 "
          "are exact under `short` where they fell to the sonnet "
          "extrapolated; the only lengths a lyric sheet still meets the "
          "sonnet at are its own 108-126, where the line count decides",
          got_127 is not None and got_127.name == "short" and ex_127
          and got_138 is not None and got_138.name == "short" and ex_138,
          f"127 -> {got_127.name if got_127 else None!r} exact={ex_127}, "
          f"138 -> {got_138.name if got_138 else None!r} exact={ex_138}")
    got_175, _ = declaration_for(175)
    got_176, _ = declaration_for(176)
    check("...and between the two lyric-sheet bands 176 is where `song` "
          "takes over from `short` (a tie at 175 goes to the narrower "
          "band), so no length between them falls to the sonnet",
          got_175 is not None and got_175.name == "short"
          and got_176 is not None and got_176.name == "song",
          f"175 -> {got_175.name if got_175 else None!r}, "
          f"176 -> {got_176.name if got_176 else None!r}")

    for n, want in ((200, "song"), (400, "song"), (37, "section"),
                    (126, "sonnet")):
        got, exact = declaration_for(n)
        check(f"...and at {n} tokens it is `{want}`, EXACT",
              got.name == want and exact, f"got {got.name!r}, exact={exact}")
    far, exact_far = declaration_for(1000)
    check("past every profile's REACH the answer is None, not a nearest guess",
          far is None and not exact_far,
          "doctrine 15 -- text outside every calibrated length gets no "
          "length-sensitive finding at all, rather than one extrapolated "
          "600 tokens past a measured edge")

    # QF2 -- the radif licence needs BOTH a count of >= 2 pairs AND a fraction
    # >= radif_min_pair_fraction. The mutant kept only the count. floor.py's
    # own docstring records the case it was written for: in a 31-pair rap
    # verse, two pairs that happen to end in `it` cleared a bare count of two
    # and were licensed as a refrain. Nothing here distinguished "2 of 2" from
    # "2 of many", so this constant -- declared, and marked DEFINITIONAL -- had
    # never been asserted at all.
    check("radif_min_pair_fraction is declared and non-trivial",
          0.0 < FLOOR.decl.radif_min_pair_fraction <= 1.0,
          f"{FLOOR.decl.radif_min_pair_fraction} -- a fraction of ALL pairs, "
          f"not a count, which is the half the mutant dropped")
    check("...and it is DEFINITIONAL, so it is not a tunable threshold",
          "radif_min_pair_fraction" in CALIBRATION.get("definitional", []),
          "a definitional constant states what the word MEANS; moving it "
          "changes the claim rather than the sensitivity")



#: The 5-couplet English ghazal a blind writer returned to the form seed
#: (`quality/COVERAGE_PREREGISTRATION.md` §F). Radif `turn`, matla on both
#: lines of the first couplet, takhallus in the last — a correct ghazal, and
#: the qafiya before the radif does NOT rhyme, which is the second finding.
GHAZAL_TURN = [
    "They said the door was locked; I learned the key was never mine to turn.",
    "The lamp still burns behind the glass, and still the key is not the turn.",
    "I carried water in my hands across a country made of thirst,",
    "and every mile the river laughed: what leaves you is the leaving's turn.",
    "My mother folded winter coats in summer, humming to the moths,",
    "as if to say, the season keeps whatever waits its turn.",
    "Some men ask heaven for a sign; I asked the street for one small name,",
    "and got the rain, the streetlight's hum, a stranger's shoulder, and my "
    "turn.",
    "So write it, Claude, the way it came, unpolished, half a thing, alive —",
    "the poem is not the poem yet; the making is the poem's turn."]
GHAZAL_GROUPS = [[1, 2, 4, 6, 8, 10]]


def test_the_radif_licence_says_which_layer_it_speaks_for():
    """`RADIF_LICENSED` said "self-rhyme checking is suppressed for it" and
    suppressed exactly ONE module's check.

    Found by the form seed of §F, whose whole purpose was to reach this code
    with a real draft. It fired, as pre-registered — and the same run reported
    **15 `SCHEME_VIOLATION`s on the very pairs the note says are licensed**.
    Both are correct: the FLOOR suppresses its own `REPEAT_IN_VERSE`, and the
    MANDATE layer judges an identical end word on a different, separately
    declared coordinate (`ReviseDeclaration.repeat_licence`, default
    `'unlicensed'`). The note was the only thing that overclaimed — one
    sentence a reader can only take as settling the question for the run
    (doctrine 1), printed beside fifteen findings that say otherwise.

    THE VERDICTS ARE UNCHANGED. This is a message repair; check 4 is the
    control that says so.
    """
    print("\n  RADIF_LICENSED names the layer it speaks for")
    import quality.schemes as _SC
    from quality.revise import Reviser as _R, ReviseDeclaration as _RD

    def _run(rev):
        f = rev.inspect(list(GHAZAL_TURN),
                        _SC.mandate(GHAZAL_GROUPS, n_lines=10))
        codes, viol, rad = set(), 0, None
        for x in f["whole"]:
            codes.add(x.code)
        for _ln, fs in f["per_line"].items():
            for x in fs:
                codes.add(x.code)
                if x.code == "SCHEME_VIOLATION":
                    viol += 1
                if x.code == "RADIF_LICENSED":
                    rad = x
        return codes, viol, rad

    codes, viol, rad = _run(_R())
    check("the radif is recognised on a real ghazal — 'turn' closes 15 of 15 "
          "mandated pairs, at or above the declared 50%",
          "RADIF_LICENSED" in codes and rad is not None
          and "15 of 15" in rad.message,
          rad.message if rad else "not emitted")
    check("...and the MANDATE layer flags every one of those pairs anyway, "
          "because it reads a DIFFERENT declared coordinate",
          viol == 15, f"{viol} SCHEME_VIOLATION(s) at the default "
                      f"repeat_licence='unlicensed'")
    check("the note now says WHICH check it suppressed, and its evidence "
          "names the coordinate that governs the other one",
          "THIS FLOOR's self-rhyme check" in rad.message
          and "repeat_licence" in rad.evidence
          and "SCHEME_VIOLATION" in rad.evidence,
          rad.message)

    lic_codes, lic_viol, lic_rad = _run(_R(rdecl=_RD(repeat_licence="refrain")))
    check("CONTROL: declaring the licence clears all 15 and leaves the "
          "finding standing — so the two layers are two questions, not one "
          "broken one, and the caller's declaration is what settles it",
          lic_viol == 0 and "RADIF_LICENSED" in lic_codes,
          f"{lic_viol} violation(s) at repeat_licence='refrain'; "
          f"RADIF_LICENSED {'present' if 'RADIF_LICENSED' in lic_codes else 'GONE'}")

def test_the_length_gate_is_a_gate():
    print("\n. an uncalibrated length REFUSES to certify — it is not a note")
    short = ["A cat", "A hat"]
    n = sum(len(FL.QualityFeatures._tokens(l)) for l in short)
    prof, exact = FL.declaration_for(n)
    check("the premise: this fixture reaches NO profile, so every "
          "length-sensitive check is skipped on it",
          prof is None, f"{n} tokens -> profile {prof}")
    found = [f.code for f in FL.SlopFloor().check(short)]
    check("the default still REPORTS rather than raising, because the floor "
          "is ONE layer and the rhyme, meter and structure layers grade a "
          "two-line draft perfectly well — raising here would charge a "
          "refusal to the wrong layer (doctrine 79)",
          "OUT_OF_CALIBRATED_LENGTH" in found, f"{found}")
    check("and the code is NAMED in `LENGTH_GATE_CODES`, beside the finding "
          "that emits it, so the gate and the emitter cannot drift about "
          "which lengths are ungraded (doctrine 1)",
          "OUT_OF_CALIBRATED_LENGTH" in FL.LENGTH_GATE_CODES)
    check("`EXTRAPOLATED_LENGTH` is deliberately NOT a gate code: inside a "
          "tolerance band every check still runs and reports, downgraded on "
          "a false-positive rate `Profile.tolerance` carries. That is a "
          "graded draft under a measured allowance, not an ungraded one",
          "EXTRAPOLATED_LENGTH" not in FL.LENGTH_GATE_CODES)
    raised = False
    try:
        FL.SlopFloor(FL.FloorDeclaration(
            uncalibrated_length="refuse")).check(short)
    except FL.UncalibratedLength:
        raised = True
    check("the declared hard stop RAISES for an API caller who wants the "
          "floor's silence to be fatal at the call site", raised)
    old = [f.code for f in FL.SlopFloor(FL.FloorDeclaration(
        uncalibrated_length="note")).check(short)]
    check("and the pre-2026-08-23 behaviour is still reachable WITH ITS NAME "
          "ON IT — the shape `modal_exclusion=0` uses, so the defect stays "
          "demonstrable rather than becoming a sentence nobody can check",
          old == found, f"{old}")
    mid = ["Silver rivers carry morning light"] * 4
    nm = sum(len(FL.QualityFeatures._tokens(l)) for l in mid)
    pm, em = FL.declaration_for(nm)
    strict = False
    try:
        FL.SlopFloor(FL.FloorDeclaration(
            require_exact_length=True,
            uncalibrated_length="refuse")).check(mid)
    except FL.UncalibratedLength:
        strict = True
    check("`require_exact_length` refuses inside a TOLERANCE BAND too, where "
          "nothing can reject — off by default because the band is a "
          "measured allowance rather than an absence",
          pm is not None and not em and strict,
          f"{nm} tokens -> {pm.name if pm else None}, exact={em}")
    exact_n = sum(1 for k in range(1, 700)
                  if all(FL.declaration_for(k)))
    none_n = sum(1 for k in range(1, 700)
                 if FL.declaration_for(k)[0] is None)
    # REPINNED 2026-08-26 with the song band (MISSING.md M-131). The
    # flaggable share falls ~~39.9%~~ -> 32.8% because the song profile's
    # MEASURED range narrowed 150-400 -> 200-400, and only a measured range
    # can flag. The no-profile share is UNMOVED at 30.3%, and that is the
    # check on the direction: the profile's tolerance BAND (160-500 against
    # 120-500) still reaches almost everything it used to, so nothing fell
    # out of coverage entirely -- 50 tokens' worth of lengths moved from
    # "can reject" to "can only note", which is exactly the cost the
    # re-adoption priced and nothing more.
    # REPINNED AGAIN 2026-09-01 (MISSING.md M-193): the `short` profile
    # (50-150 tokens, four checks) joined, so the flaggable share RISES
    # ~~32.8%~~ -> 44.5% -- 82 of the 101 lengths 50-150 were tolerance
    # band or between profiles and can reject now -- and the no-profile
    # share is UNMOVED at 30.3% a second time, for the same reason: the
    # new band's reach (40-187) sits inside what the section and song
    # bands already reached, so it moved lengths from "note" to "flag" and
    # none from "nothing" to anything.
    check("AND THE SIZE OF THE HOLE IS MEASURED, not asserted: over 1-699 "
          "tokens the floor can FLAG at 44.5% of lengths and reaches no "
          "profile at all at 30.3%, with everything between downgraded",
          abs(exact_n / 699 - 0.445) < 0.01
          and abs(none_n / 699 - 0.303) < 0.01,
          f"flaggable {exact_n / 699:.1%}, no profile {none_n / 699:.1%}")


def test_the_profile_pick_reads_the_line_count():
    print("\n26. two profiles covering one token count: the LINE COUNT "
          "breaks the tie (`quality/SHORT_SONG_FLOOR_PREREGISTRATION.md` §4)")
    # RULED 2026-09-01 BEFORE THE ROW THAT NEEDS IT EXISTED. `sonnet` covers
    # 108-126 tokens; a lyric-sheet profile reaching under 126 covers them
    # too, and `declaration_for` returned the FIRST in `PROFILES` — so a
    # twenty-line song of 115 tokens would be graded on fourteen-line
    # sonnets. The pick now prefers a profile whose calibrated line count IS
    # the text's, then a profile whose unit fixes none, then list order; a
    # caller passing no line count gets list order byte for byte.
    import dataclasses
    from quality import floor as FL
    # THE TIE IS REAL SINCE THE `short` ROW SHIPPED (M-193, the same
    # sitting): `sonnet` covers 108-126 and `short` covers 50-150, so 118
    # tokens is covered by both. The section was first written against a
    # stand-in row appended for its duration; the shipped row makes the
    # stand-in a THIRD coverer and is used directly instead.
    names = [p.name for p in FL.PROFILES if p.covers(118)]
    check("the premise: two profiles cover 118 tokens, `sonnet` and `short`",
          names == ["sonnet", "short"], f"{names}")
    p0, e0 = FL.declaration_for(118)
    check("with NO line count the pick is list order — the pre-2026-09-01 "
          "answer, byte for byte", p0.name == "sonnet" and e0)
    p1, e1 = FL.declaration_for(118, 14)
    check("a fourteen-line text of 118 tokens is graded as a SONNET — "
          "the profile whose calibrated unit IS this text's shape",
          p1.name == "sonnet" and e1, f"{p1.name}")
    p2, e2 = FL.declaration_for(118, 20)
    check("a twenty-line text of 118 tokens is graded as a LYRIC SHEET — "
          "the profile whose unit fixes no line count — and not as a "
          "sonnet it is not",
          p2.name == "short" and e2, f"{p2.name}")
    p3, _ = FL.declaration_for(33, 20)
    check("a count only ONE profile covers is unmoved by the line count",
          p3.name == "section")
    p4, e4 = FL.declaration_for(40, 20)
    check("...and a count NO profile covers still takes the "
          "nearest-measured-edge rule, inexact", p4 is not None and not e4)
    # THE GATE PASSES THE COUNT. Recorded rather than inferred: the picker
    # is swapped for a recorder for one call, so the check reads what the
    # gate actually handed it.
    seen = []
    real = FL.declaration_for

    def _rec(n_tok, n_lines=None):
        seen.append((n_tok, n_lines))
        return real(n_tok, n_lines)
    FL.declaration_for = _rec
    try:
        lines = ["the river runs to where the morning fell"] * 6
        FLOOR.check(lines)
    finally:
        FL.declaration_for = real
    check("`Floor.check` hands the picker the text's line count beside its "
          "token count", seen and seen[0][1] == 6, f"{seen[:1]}")


if __name__ == "__main__":
    for fn in (test_the_length_gate_is_a_gate,
               test_never_returns_a_score, test_too_short_is_silent,
               test_repeat_in_verse, test_single_pair_repeat_is_undecidable,
               test_radif_is_not_a_repeat,
               test_the_licence_needs_the_fraction_not_the_bare_count,
               test_shared_suffix_needs_a_real_stem, test_cliche_pair,
               test_cliche_pair_may_only_reject_where_it_was_measured,
               test_anaphora, test_anaphora_is_a_note_about_a_figure,
               test_thresholds_are_declared_not_hidden,
               test_length_is_a_coordinate,
               test_calibration_block_is_honest,
               test_predictability_is_demoted,
               test_out_of_domain_is_announced,
               test_the_floor_runs_on_a_song,
               test_the_song_profile_was_not_tuned_to_the_examples,
               test_the_song_profile_makes_no_separation_claim,
               test_the_song_profile_did_not_swallow_everything,
               test_the_examples_are_not_in_the_calibration_set,
               test_anaphora_tie_break_reproduces,
               test_the_two_mutants_this_suite_could_not_see,
               test_the_radif_licence_says_which_layer_it_speaks_for,
               test_the_profile_pick_reads_the_line_count):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all slop-floor regressions pass")
