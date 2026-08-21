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
    stretched = inband + ["word " * 40]
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
        measured = {k for p in profs.values() for k in p.percentiles}
        untraceable = [k for k in d.__dict__
                       if k not in measured and k not in defn]
        check("no threshold can hide outside both lists",
              not untraceable,
              f"untraceable: {untraceable}" if untraceable else
              f"{len(measured)} measured, {len(defn)} definitional, "
              f"0 unaccounted")
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
    else:
        check("an uncalibrated block is marked provisional", True,
              "calibrated=False; findings mean 'outside a guessed range'")


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
    check("it names what the number is a coordinate of",
          all("0.964" in f.evidence for f in fs) and bool(fs),
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
    check("the five song thresholds are the recorded corpus percentiles",
          song.percentiles == {"mattr_min": 0.7226,
                               "function_word_ratio_max": 0.4716,
                               "anaphora_max": 0.3000,
                               "line_length_cv_min": 0.1123,
                               "predictable_pair_fraction_max": 0.9286},
          "150-400 tokens, 1,859 items, 108 authors, MATTR window 50; "
          "quality/RESULTS_SONG_FLOOR.md carries the commands")


def test_the_song_profile_makes_no_separation_claim():
    print("\n15. a profile with no negative class may not sound like one")
    ls = _sheet("anaphoric.txt")
    fs = [f for f in FLOOR.check(ls)
          if f.code in ("ANAPHORA_OVERLOAD", "LEXICAL_MONOTONY",
                        "FUNCTION_WORD_HEAVY", "UNIFORM_LINE_LENGTH")]
    import re as _re
    check("at least one song-profile finding is under test", bool(fs))
    # `AUC \d` and not the bare word: the finding is REQUIRED to contain the
    # string "no AUC and no separation claim", so a substring test on "AUC"
    # would pass on the disclaimer and fail on the honest text. What must not
    # appear is a NUMBER after it.
    quoted = [f.code for f in fs if _re.search(r"AUC\s*[0-9]", f.evidence)]
    check("no song-profile finding quotes a numeric AUC", not quoted,
          f"quoting one: {quoted}" if quoted else
          "there is no generated song class, so there is no separation and "
          "nothing to put an AUC on")
    check("and each says so in as many words",
          all("no AUC and no separation claim" in f.evidence for f in fs))
    check("every song-profile finding states its held-out false-positive rate",
          all("HELD-OUT human song" in f.evidence for f in fs),
          "doctrine 22: a threshold is a false-positive rate, not a point on "
          "a scale")
    check("and states that this does not mean it catches a machine",
          all("not whether it catches a machine" in f.evidence for f in fs))
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
    # returned `reach[0]`. PROFILES is ordered section, sonnet, song, so at 150
    # tokens the mutant grades a real song on the SECTION profile's 29-37 token
    # percentiles: an extrapolation of 113 tokens past a measured edge, at a
    # length the song profile actually MEASURED. This suite asserted which
    # profile is chosen only at lengths where every rule agrees, so the
    # difference was invisible to it.
    # THE LENGTH MATTERS, and getting this wrong once is why it is spelled
    # out. At 150 tokens `declaration_for` returns from its `covers` loop and
    # never reaches the mutated line at all, so a test at 150 passes under the
    # mutant too. The discriminating lengths are the ones where NO profile
    # covers and two REACH -- there the rule picks the smallest extrapolation
    # and `reach[0]` picks whichever comes first in PROFILES.
    order = [p.name for p in PROFILES]
    check("PROFILES is ordered section, sonnet, song",
          order == ["section", "sonnet", "song"], " -> ".join(order))
    for n in (149, 140):
        reach = [p.name for p in PROFILES if p.reaches(n)]
        got, exact = declaration_for(n)
        check(f"at {n} tokens two profiles REACH and neither COVERS -- the "
              f"mutated line is live here",
              reach == ["sonnet", "song"] and not exact, f"reaches {reach}")
        check(f"...and the choice is `song`, the smaller extrapolation",
              got.name == "song",
              f"got {got.name!r}. `reach[0]` would give {reach[0]!r} -- "
              f"{n - 126} tokens past the sonnet's measured 126, against "
              f"{150 - n} short of the song's 150. This is the worked case "
              f"`declaration_for`'s own comment records")
    for n, want in ((150, "song"), (400, "song"), (37, "section"),
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

if __name__ == "__main__":
    for fn in (test_never_returns_a_score, test_too_short_is_silent,
               test_repeat_in_verse, test_single_pair_repeat_is_undecidable,
               test_radif_is_not_a_repeat,
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
               test_the_radif_licence_says_which_layer_it_speaks_for):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all slop-floor regressions pass")
