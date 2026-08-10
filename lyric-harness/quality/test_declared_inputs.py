#!/usr/bin/env python3
"""Regressions for the six declared-input families.

Three things are pinned here and the first is the load-bearing one:

  1. A MISSING INPUT IS NEVER A NEGATIVE. `test_a_refusal_is_not_a_no` checks
     it mechanically — `bool(refusal)` RAISES, `refusal == False` is False, and
     no family returns False when its input is absent. Returning False for
     `love`/`move` with no orthography declared would assert *these do not
     rhyme* when the truth is *I was not given what I would need to tell*.
  2. EVERY REFUSAL NAMES ITS INPUT. Each family's message must contain the
     field a caller would supply, so the refusal is an instruction and not a
     complaint.
  3. THE SCHEDULED / PERMANENT LINE IS MACHINE-READABLE and enforced by
     `Family.__post_init__`: a SCHEDULED family with nothing on its schedule is
     refused at construction, and so is a PERMANENT family whose route is
     anything but OUTSIDE.

REAL DATA WHERE THERE IS ANY. R1 runs on the couplet of sonnet 116 as it is
printed in `corpus/sonnets.txt` (`prov’d`/`lov’d`) rather than on invented
words; R2 and R6 run on `quality/phonology/ltc.py` and `data/qieyun_mc.tsv`
(CC0), which is the one dated phonology this repo actually has. Where a family
needs data the repo does not hold — a slang glossary, a sense inventory, a
Middle Chinese contour table — the fixture is labelled STRUCTURE DEMO in its
own `source` field and asserts nothing about the world, which is the same
choice `test_meter.py` makes for the empty catalogue.

THIS FILE IMPORTS `lyric_harness` ON PURPOSE, unlike the phonology tests which
assert it is absent. English has no declared phonology module (MISSING.md F-1),
so the CMUdict path is the only phonology that reads English, and eye rhyme's
canonical cases are English. `test_the_module_holds_no_phonology` checks that
`declared_inputs` itself pulled in neither CMUdict nor `lyric_harness`.

Run: python3 quality/test_declared_inputs.py
"""

import os
import sys
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.declared_inputs import (  # noqa: E402
    BeatGrid, DECLARED, FAMILIES, MissingDeclaredInput, Orthography,
    PERIOD_PHONOLOGIES, PeriodPhonology, Refusal, SenseAnnotation,
    SlangRegister, ToneChannel, Undecided, Verdict, antanaclasis, attempt,
    capability_report, clear_declarations, declare, eye_rhyme, get_period,
    historical_rhyme, offbeat, permanent, probe_all, register_period,
    rhyming_slang, scheduled, tone_rhyme)

#: Snapshot taken the instant the module under test is loaded, for
#: test_the_module_holds_no_phonology below.
MODULES_AT_IMPORT = set(sys.modules)

from quality.meter import Cycle  # noqa: E402
from quality.phonology import Syllable  # noqa: E402
from quality.phonology import ltc  # noqa: E402
from quality.rhyme_types import verdict as generic_verdict  # noqa: E402

SONNETS = os.path.join(HERE, "..", "corpus", "sonnets.txt")

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn, exc=Exception):
    try:
        fn()
    except exc:
        return True
    except Exception:
        return False
    return False


def _tagged(message, tag):
    """-> the line of a refusal carrying `tag`, for printing beside a check."""
    for ln in message.splitlines():
        if ln.strip().startswith(tag):
            return ln.strip()
    return f"(no {tag} line)"


def _msg(fn):
    """-> the refusal text, or '' if the call did not refuse."""
    try:
        fn()
    except MissingDeclaredInput as e:
        return str(e)
    except Exception as e:               # a different failure is not a refusal
        return f"WRONG EXCEPTION {type(e).__name__}: {e}"
    return ""


# ---------------------------------------------------------------------------
# FIXTURES
# ---------------------------------------------------------------------------


class CMUdictEnglish:
    """The CMUdict path, wrapped to the `.syllabify()` interface.

    NOT a declared phonology module — MISSING.md F-1 records that English is
    not one, and this adapter does not make it one. It exists so eye rhyme can
    be tested on English, which is the language its canonical cases are in.
    U+2019 is folded per doctrine 26 before the lexicon sees the token.
    """
    language = "eng (CMUdict General American — a DECLARED coordinate)"

    def __init__(self):
        import lyric_harness as lh
        self._lh = lh
        self._lex = lh.Lexicon()

    def syllabify(self, word):
        phones, _oov = self._lex.transcribe_word(str(word).replace("’",
                                                                  "'"))
        return [Syllable(text="", onset=tuple(s["onset"]),
                         nucleus=s["nucleus"], coda=tuple(s["coda"]),
                         prominence=1 if s["stress"] in (1, 2) else 0)
                for s in self._lh.syllabify(phones)]


def sonnet_couplet():
    """-> (line_index, word_a, word_b) for sonnet 116's couplet, read from the
    staged corpus rather than typed here. `prov’d`/`lov’d` as PRINTED."""
    with open(SONNETS, encoding="utf-8") as f:
        lines = f.read().splitlines()
    for i, ln in enumerate(lines):
        if "upon me prov" in ln:
            return i, ln.split()[-1].strip(".,;:!?"), \
                lines[i + 1].split()[-1].strip(".,;:!?")
    return None, None, None


def sonnet_line(needle):
    with open(SONNETS, encoding="utf-8") as f:
        for i, ln in enumerate(f.read().splitlines()):
            if needle in ln:
                return i, ln
    return None, None


ENG = None          # built once, lazily — the Lexicon load is ~1s
MC = ltc.MiddleChinese()


def english():
    global ENG
    if ENG is None:
        ENG = CMUdictEnglish()
    return ENG


# ---------------------------------------------------------------------------


def test_every_family_refuses_and_names_its_input():
    print("\n1. Six families, six refusals, each naming what it needs")
    clear_declarations()
    got = probe_all()
    check("all six probes refuse on an empty registry",
          len(got) == 6 and all(isinstance(v, Refusal) for v in got.values()),
          f"{sorted(got)} -> {[type(v).__name__ for v in got.values()]}")
    wanted = {"R1": "orthography", "R2": "dated phonology",
              "R3": "sense annotation", "R4": "referent chain",
              "R5": "beat grid", "R6": "tone channel"}
    for code, noun in wanted.items():
        m = _msg(FAMILIES[code].probe)
        check(f"{code} names {noun!r} in its refusal",
              noun in m and "NEEDS" in m and "DECLARE" in m,
              _tagged(m, "NEEDS") if m else "DID NOT REFUSE")
    for code, f in FAMILIES.items():
        m = _msg(f.probe)
        check(f"{code} states its status and that this is not a 'no'",
              f.status in m and "not 'these do not rhyme'" in m)


def test_a_refusal_is_not_a_no():
    print("\n2. THE LOAD-BEARING ONE: a refusal cannot be read as a negative")
    clear_declarations()
    r = attempt(FAMILIES["R4"].probe)
    check("attempt() returns a Refusal, not False", isinstance(r, Refusal))
    check("bool(refusal) RAISES rather than returning False",
          _raises(lambda: bool(r), MissingDeclaredInput),
          "`if not result:` is the line that would silently turn 'no input' "
          "into 'does not rhyme'; it is made impossible, not discouraged")
    check("`not refusal` raises too", _raises(lambda: not r,
                                              MissingDeclaredInput))
    check("refusal == False is False", (r == False) is False)  # noqa: E712
    check("refusal == True is False", (r == True) is False)    # noqa: E712
    check("refusal == None is False", (r == None) is False)    # noqa: E712
    check("refusal != False", r != False)                      # noqa: E712
    for code, v in probe_all().items():
        check(f"{code} returns no verdict at all with its input absent",
              isinstance(v, Refusal) and not isinstance(v, Verdict))
    check("the refusal carries the full message for a caller to print",
          "NEEDS" in r.message and "STATUS" in r.message)
    check("an UNDECIDED verdict also refuses bool() — None is not False",
          _raises(lambda: bool(Verdict("x", None, "channel unreadable")),
                  Undecided))
    check("a decided verdict is an ordinary boolean",
          bool(Verdict("x", True)) is True
          and bool(Verdict("x", False)) is False)


def test_the_scheduled_permanent_line():
    print("\n3. Not-yet-built vs not-computable, machine-readable")
    check("three scheduled, three permanent",
          sorted(f.code for f in scheduled()) == ["R1", "R2", "R6"]
          and sorted(f.code for f in permanent()) == ["R3", "R4", "R5"])
    for f in scheduled():
        check(f"{f.code} SCHEDULED names the work that ends the refusal",
              bool(f.blocked_on), f.blocked_on[:78] + "...")
    for f in permanent():
        check(f"{f.code} PERMANENT has route OUTSIDE and no schedule",
              f.route == "OUTSIDE" and not f.blocked_on, f.why[:78] + "...")
    check("a SCHEDULED family with an empty schedule is REFUSED",
          _raises(lambda: type(FAMILIES["R1"])(
              code="RX", name="x", needs=FAMILIES["R1"].needs,
              route="IN_TEXT", status="SCHEDULED", why="x"), ValueError),
          "a schedule with nothing on it is an impossibility wearing a date")
    check("a PERMANENT family with a route is REFUSED",
          _raises(lambda: type(FAMILIES["R1"])(
              code="RX", name="x", needs=FAMILIES["R1"].needs,
              route="IN_TEXT", status="PERMANENT", why="x"), ValueError),
          "calling unscheduled work impossible is the other half of the error")
    check("R1 and R6 record a PERMANENT residue inside a SCHEDULED shell",
          "PERMANENT" in FAMILIES["R1"].residue
          and "PERMANENT" in FAMILIES["R6"].residue)
    check("R5 is permanent for the MEASUREMENT and says the plumbing is not",
          "isochrony is an assumed coordinate" in FAMILIES["R5"].why
          and "plumbing" in FAMILIES["R5"].why)


def test_no_declaration_registers_without_a_source():
    print("\n4. The slots ship EMPTY, and an unsourced fill is refused")
    ctor = {
        "Orthography": lambda s: Orthography(system="x", edition="x",
                                             vowel_letters="aeiou", source=s),
        "PeriodPhonology": lambda s: PeriodPhonology(
            phonology=MC, language="ltc", period="p", reconstruction="r",
            source=s),
        "SenseAnnotation": lambda s: SenseAnnotation(
            senses={(0, 0): "a"}, inventory="i", source=s),
        "SlangRegister": lambda s: SlangRegister(tradition="t", source=s),
        "BeatGrid": lambda s: BeatGrid(cycle=Cycle(pulses=4, unit=4,
                                                   groups=(2, 2)), source=s),
        "ToneChannel": lambda s: ToneChannel(tones={"x": ("a",)}, system="s",
                                             source=s),
    }
    for nm, make in ctor.items():
        check(f"{nm} REFUSES construction with no source",
              _raises(lambda m=make: m(""), ValueError))
        check(f"{nm} constructs with one", make("STRUCTURE DEMO") is not None)
    check("the R2 period slot is empty and says what would fill it",
          not PERIOD_PHONOLOGIES
          and "from memory is refused" in _msg(
              lambda: get_period("enm/1600")))
    check("...and names the shape that would fill it, not just the gap",
          "quality/phonology/ltc.py" in _msg(lambda: get_period("enm/1600")))
    check("an Orthography with no declared vowel letters is refused",
          _raises(lambda: Orthography(system="x", edition="x",
                                      source="s"), ValueError),
          "the eye-rime runs to the last vowel LETTER and which those are is a "
          "property of the writing system")
    check("an Orthography with no named edition is refused",
          _raises(lambda: Orthography(system="x", edition="",
                                      vowel_letters="aeiou", source="s"),
                  ValueError))
    check("a PeriodPhonology with no period is refused",
          _raises(lambda: PeriodPhonology(phonology=MC, language="ltc",
                                          period="", reconstruction="r",
                                          source="s"), ValueError))
    check("a PeriodPhonology over a word list (no .syllabify) is refused",
          _raises(lambda: PeriodPhonology(phonology={"a": "b"},
                                          language="x", period="p",
                                          reconstruction="r", source="s"),
                  ValueError))
    check("a WORD-KEYED sense map is refused at construction",
          _raises(lambda: SenseAnnotation(senses={"light": "sense1"},
                                          inventory="i", source="s"),
                  ValueError),
          "antanaclasis is ONE word with TWO senses; a word-keyed map assigns "
          "it one and could only ever report False")
    check("a BeatGrid with an unstated derivation is refused",
          _raises(lambda: BeatGrid(cycle=Cycle(pulses=4, unit=4),
                                   derived_from="somehow", source="s"),
                  ValueError))
    check("a BeatGrid over a bare signature (no meter.Cycle) is refused",
          _raises(lambda: BeatGrid(cycle="7/8", source="s"), ValueError))


def test_R1_eye_rhyme_accepts_an_orthography():
    print("\n5. R1 · eye rhyme — the printed form of sonnet 116's couplet")
    clear_declarations()
    idx, wa, wb = sonnet_couplet()
    check("the couplet is read from corpus/sonnets.txt, not typed here",
          (wa, wb) == ("prov’d", "lov’d"),
          f"line {idx}: {wa!r} / {wb!r}")
    orth = declare(Orthography(
        system="English, printed",
        edition="Project Gutenberg #1041 (corpus/sonnets.txt) — a modern-"
                "spelling setting that keeps the elision apostrophes; NOT the "
                "1609 quarto, and the verdict is relative to THIS printing",
        vowel_letters="aeiouy", token_is_printed=True,
        source="data/sources.tsv 48:gutenberg:shakespeare-sonnets"))
    eng = english()
    v = eye_rhyme(wa, wb, phon=eng)
    check(f"{wa!r}/{wb!r} IS an eye rhyme once the orthography is declared",
          v.value is True, v.describe())
    check("the verdict carries the edition it is relative to",
          "Gutenberg #1041" in v.declaration)
    check("love/glove is NOT an eye rhyme — it sounds",
          eye_rhyme("love", "glove", phon=eng).value is False,
          "spelled alike AND sounds alike is a rhyme, not an eye rhyme")
    check("move/prove is NOT an eye rhyme — same reason",
          eye_rhyme("move", "prove", phon=eng).value is False)
    check("love/move IS one in the declared General American coordinate",
          eye_rhyme("love", "move", phon=eng).value is True,
          "CLAUDE.md already records love/prove as CONSONANCE in this dialect; "
          "R1 says what the EYE does with the same pair, and R2 asks what an "
          "earlier dialect did")
    check("said/maid IS one — 'aid' printed twice, EH D against EY D heard",
          eye_rhyme("said", "maid", phon=eng).value is True,
          "written here as a NEGATIVE first; the code was right and the "
          "expectation was wrong, which is the check earning its place")
    check("love/night is NOT one — the spelled rimes differ",
          eye_rhyme("love", "night", phon=eng).value is False,
          "sounding apart is only half of it; eye rhyme needs the LOOK to "
          "agree, and 'ove' is not 'ight'")
    check("a word with no printed form REFUSES and names the word",
          "no printed form for 'zzz'" in _msg(
              lambda: eye_rhyme("zzz", "love", phon=eng,
                                orthography=Orthography(
                                    system="x", edition="x",
                                    vowel_letters="aeiouy",
                                    source="STRUCTURE DEMO"))))
    check("with a spelling but NO phonology it refuses the second half",
          "no phonology passed" in _msg(lambda: eye_rhyme(wa, wb)),
          "eye rhyme is a CONJUNCTION: spelled alike AND does not sound "
          "alike; half a conjunction is not a verdict")
    check("a MODERNISED edition is refused outright (doctrine 50)",
          "MODERNISED" in _msg(lambda: eye_rhyme(
              "love", "move", phon=eng,
              orthography=Orthography(
                  system="English", edition="a modernised reprint",
                  vowel_letters="aeiouy", token_is_printed=True,
                  modernised=True, source="STRUCTURE DEMO"))),
          "normalising the spelling destroys the only channel this question "
          "reads")
    check("SYLLABLE granularity refuses on the CMUdict path — PERMANENTLY",
          "PERMANENT on the CMUdict path" in _msg(lambda: eye_rhyme(
              "love", "move", phon=eng,
              orthography=Orthography(
                  system="English", edition="corpus/sonnets.txt",
                  vowel_letters="aeiouy", token_is_printed=True,
                  granularity="syllable", source="STRUCTURE DEMO"))),
          "Syllable.text is empty there, so no grapheme-to-syllable alignment "
          "exists and inventing one puts letters in syllables no phonology "
          "put there")
    clear_declarations()


def test_R2_historical_rhyme_accepts_a_dated_phonology():
    print("\n6. R2 · historical rhyme — on the one dated phonology in the repo")
    clear_declarations()
    check("with nothing declared it refuses and names the input",
          "dated phonology" in _msg(lambda: historical_rhyme("love", "prove")))
    pp = declare(PeriodPhonology(
        phonology=MC, language="ltc",
        period="切韻 system, c. 601 CE, as authorised by Tang "
               "同用 practice",
        reconstruction="data/qieyun_mc.tsv, extracted from nk2028/"
                       "qieyun-python, 19,499 characters",
        source="CC0 1.0 public-domain dedication; see quality/phonology/"
               "ltc.py"))
    v = historical_rhyme("流", "樓")
    check("流/樓 rhyme under the declared period", v.value is True,
          v.describe())
    check("the verdict is stamped CONDITIONAL ON the reconstruction",
          "reconstruction" in v.conditional_on,
          "a dated phonology is a declared coordinate, not a measurement")
    check("the GENERIC channel comparison gets the same pair WRONG",
          generic_verdict("流", "樓", MC) is False,
          "raw 切韻 classes are finer than any poet worked to "
          "(doctrine 36); 流/樓 is the rhyme of 登鸛雀樓")
    check("...so R2 asks the phonology in ITS OWN declared relation",
          "rhyme category" in v.reason, v.reason)
    check("a real non-rhyme still comes back False, not a refusal",
          historical_rhyme("東", "冬").value is False,
          "東 and 冬鐘 are different 同用 groups")
    check("a character outside the rime book is UNDECIDED, not False",
          historical_rhyme("zz", "樓").value is None)
    check("the named slot is separate and still empty",
          _raises(lambda: get_period("enm/1600"), MissingDeclaredInput))
    register_period(pp, key="ltc/qieyun")
    check("a sourced period phonology registers by name",
          get_period("ltc/qieyun") is pp)
    PERIOD_PHONOLOGIES.clear()
    clear_declarations()


def test_R3_antanaclasis_accepts_a_sense_annotation():
    print("\n7. R3 · antanaclasis — one word, two senses, per OCCURRENCE")
    clear_declarations()
    idx, line = sonnet_line("Admit impediments. Love is not love")
    toks = line.split()
    a_occ, b_occ = (idx, 2), (idx, len(toks) - 1)
    check("a real repeated word is found in corpus/sonnets.txt",
          toks[2].strip(".") == "Love" and toks[-1].strip(".") == "love",
          f"line {idx}: {line!r}")
    m = _msg(lambda: antanaclasis(a_occ, b_occ, "Love", "love",
                                  senses=SenseAnnotation(
                                      senses={}, inventory="OED-shaped",
                                      source="STRUCTURE DEMO")))
    check("with no sense at that occurrence it REFUSES and names it",
          f"occurrence {a_occ}" in m and "'Love'" in m,
          _tagged(m, "ABSENT"))
    check("...and says the gap is PERMANENT, not scheduled",
          "PERMANENT" in m and "INDISTINGUISHABLE FROM REPETITION" in m)
    ann = declare(SenseAnnotation(
        senses={a_occ: "affection.N", b_occ: "beloved-person.N"},
        inventory="STRUCTURE DEMO inventory — two ids, not a dictionary, and "
                  "not a reading of this sonnet offered as evidence",
        annotator="STRUCTURE DEMO",
        source="STRUCTURE DEMO, not an annotation set"))
    v = antanaclasis(a_occ, b_occ, "Love", "love")
    check("two senses at two occurrences of one word -> YES", v.value is True,
          v.describe())
    check("the same sense twice -> NO (that is repetition, doctrine 3)",
          antanaclasis(a_occ, b_occ, "Love", "love",
                       senses=SenseAnnotation(
                           senses={a_occ: "s1", b_occ: "s1"},
                           inventory="STRUCTURE DEMO",
                           source="STRUCTURE DEMO")).value is False)
    check("two different words -> NO, and it says why",
          antanaclasis(a_occ, b_occ, "Love", "dove").value is False)
    check("the verdict names the inventory that numbered the senses",
          "STRUCTURE DEMO inventory" in v.declaration)
    check("the annotation is keyed by OCCURRENCE, so one word holds two",
          ann.at(a_occ) != ann.at(b_occ))
    clear_declarations()


def test_R4_rhyming_slang_accepts_a_referent_chain():
    print("\n8. R4 · rhyming slang — the member that is not in the text")
    clear_declarations()
    eng = english()
    m = _msg(lambda: rhyming_slang("plates", "feet", phon=eng,
                                   register=SlangRegister(
                                       tradition="Cockney rhyming slang",
                                       source="STRUCTURE DEMO")))
    check("an unregistered term REFUSES and names where the chain stopped",
          "'plates'" in m and "resolves no further" in m,
          _tagged(m, "ABSENT"))
    check("...and says the referent is ABSENT FROM THE TEXT",
          "ABSENT FROM THE TEXT" in m and "PERMANENT" in m)
    reg = declare(SlangRegister(
        elisions={"plates": "plates of meat"},
        expansions={"plates of meat": "feet"},
        tradition="Cockney rhyming slang",
        source="STRUCTURE DEMO — the single example named in "
               "quality/RHYME_COVERAGE.md §5, not a glossary"))
    v = rhyming_slang("plates", "feet", phon=eng)
    check("the two-hop chain resolves and the rhyme is CHECKED, not assumed",
          v.value is True, v.describe())
    check("the chain is reported so a reader can audit each hop",
          "plates -> plates of meat -> feet" in v.reason)
    check("a wrong target is False, not a refusal",
          rhyming_slang("plates", "hands", phon=eng).value is False)
    check("a register entry whose rhyme does NOT hold is reported False",
          rhyming_slang("plates", "hands", phon=eng,
                        register=SlangRegister(
                            expansions={"plates": "hands"},
                            tradition="STRUCTURE DEMO",
                            source="STRUCTURE DEMO — a deliberately bogus "
                                   "entry")).value is False,
          "the register attests the convention; the phonology checks the sound")
    check("PERMANENT means per-case: a SECOND phrase still refuses",
          "'dog and bone'" in _msg(lambda: rhyming_slang("dog and bone",
                                                         "phone", phon=eng)),
          "one declaration ends the refusal for one term and never in general "
          "— that is the difference from a scheduled gap")
    check("the register is pair-keyed, so it need not be transitive",
          reg.chain("plates")[1] == "feet"
          and reg.chain("meat")[1] is None,
          "RHYME_COVERAGE.md M8: every f(read(a), read(b)) predicate is an "
          "equivalence relation and attestation is not one")
    clear_declarations()


def test_R5_offbeat_accepts_a_beat_grid():
    print("\n9. R5 · offbeat — a declared grid, never a measured one")
    clear_declarations()
    m = _msg(lambda: offbeat((0, 4)))
    check("with nothing declared it names the grid AND the syllable map",
          "beat grid" in m and "syllable-to-beat map" in m)
    check("...and says the measurement is permanently out of reach",
          "no audio" in m and "PERMANENT" in m)
    grid = declare(BeatGrid(
        cycle=Cycle(pulses=7, unit=8, groups=(2, 2, 3), name="STRUCTURE DEMO"),
        positions={(0, 4): F(3), (0, 5): F(4), (0, 6): F(11)},
        derived_from="asserted",
        source="STRUCTURE DEMO — an asserted grid, not a measurement"))
    v = offbeat((0, 4))
    check("pulse 3 of 7/8 as 2+2+3 is OFF the beat (starts 0,2,4)",
          v.value is True, v.describe())
    check("pulse 4 is ON it", offbeat((0, 5)).value is False)
    check("the grid wraps: pulse 11 is pulse 4 of the next cycle",
          offbeat((0, 6)).value is False)
    check("an ASSERTED grid stamps every verdict CONDITIONAL",
          "ASSERTED grid" in v.conditional_on and not grid.measured,
          "isochrony is not measured here, so the verdict is a function of "
          "the declaration (doctrine 4)")
    check("a grid derived from audio carries no such condition",
          offbeat((0, 4), grid=BeatGrid(
              cycle=Cycle(pulses=7, unit=8, groups=(2, 2, 3)),
              positions={(0, 4): F(3)}, derived_from="audio",
              source="STRUCTURE DEMO onset analysis")).conditional_on == "")
    check("an unmapped syllable REFUSES and names the map (MISSING.md G-1)",
          "no beat position for syllable (0, 9)" in _msg(
              lambda: offbeat((0, 9))))
    check("an UNDECLARED GROUPING refuses instead of assuming one",
          "declares no grouping" in _msg(lambda: offbeat((0, 4), grid=BeatGrid(
              cycle=Cycle(pulses=7, unit=8), positions={(0, 4): F(3)},
              derived_from="notation", source="STRUCTURE DEMO"))),
          "7/8 has 64 orderings; meter.pulse_groups() returns None rather "
          "than asserting 2+2+3, and so does this")
    clear_declarations()


def test_R6_tone_accepts_a_channel_and_refuses_the_contour():
    print("\n10. R6 · tone — a category is not a contour")
    clear_declarations()
    m = _msg(lambda: tone_rhyme("樓", "侯"))
    check("with nothing declared it names the tone channel",
          "tone channel" in m and "no tone field" in m)
    tones = {ch: (MC.readings(ch)[0]["tone"],)
             for ch in "流樓侯日月"}
    tc = declare(ToneChannel(
        tones=tones, system="Middle Chinese 四聲 "
                            "平上去入",
        source="data/qieyun_mc.tsv (CC0 1.0), read through "
               "quality/phonology/ltc.py"))
    check("the channel is built from the SOURCED rime book, not from memory",
          tones["流"] == ("平",) and tones["月"] == ("入",),
          f"{tones}")
    check("two 平 characters agree on tone CATEGORY",
          tone_rhyme("流", "樓").value is True)
    check("平 against 入 does not",
          tone_rhyme("流", "月").value is False)
    check("two 入 characters agree even across rhyme groups",
          tone_rhyme("日", "月").value is True)
    m = _msg(lambda: tone_rhyme("流", "樓", level="contour"))
    check("the CONTOUR question refuses separately and names the map",
          "category-to-contour map" in m)
    check("...and says why that half never becomes a measurement here",
          "reconstructed" in m and "not a measurement" in m,
          "two categories can share a contour and the mapping is "
          "period-specific")
    demo = ToneChannel(
        tones=tones, contours={"平": "CONTOUR-A", "入": "CONTOUR-B"},
        system="STRUCTURE DEMO",
        source="STRUCTURE DEMO — placeholder shapes. NO reconstruction of "
               "Middle Chinese contours is written anywhere in this repo and "
               "none is asserted here")
    check("with a declared contour map the contour question answers",
          tone_rhyme("流", "樓", level="contour",
                     tones=demo).value is True
          and tone_rhyme("流", "月", level="contour",
                         tones=demo).value is False)
    check("a word outside the channel REFUSES and names it",
          "no tone for 'zz'" in _msg(lambda: tone_rhyme("zz", "樓")))
    check("the tone channel is a DECLARATION, not a Syllable field",
          not hasattr(Syllable("x"), "tone") and tc.of("流") is not None,
          "MISSING.md F-2 — closing R6 means adding the field, which is "
          "ordinary scheduled work")
    clear_declarations()


def test_the_module_holds_no_phonology():
    print("\n11. The boundary file carries no language data")
    check("declared_inputs imported neither lyric_harness nor cmudict",
          "lyric_harness" not in MODULES_AT_IMPORT
          and not any("cmudict" in m for m in MODULES_AT_IMPORT),
          "it takes the caller's phonology, exactly as rhyme_types does, so a "
          "Welsh or Persian boundary lands in the same six families")
    check("the registry starts and ends empty", not DECLARED)
    rep = capability_report()
    for code in FAMILIES:
        check(f"the capability report carries {code}", code in rep)
    check("the report fires every refusal rather than describing it",
          rep.count("REFUSES: needs") == 6)
    check("the report states the scheduled/permanent split in one line",
          "SCHEDULED  R1, R2, R6" in rep and "PERMANENT  R3, R4, R5" in rep)


if __name__ == "__main__":
    for fn in (test_every_family_refuses_and_names_its_input,
               test_a_refusal_is_not_a_no,
               test_the_scheduled_permanent_line,
               test_no_declaration_registers_without_a_source,
               test_R1_eye_rhyme_accepts_an_orthography,
               test_R2_historical_rhyme_accepts_a_dated_phonology,
               test_R3_antanaclasis_accepts_a_sense_annotation,
               test_R4_rhyming_slang_accepts_a_referent_chain,
               test_R5_offbeat_accepts_a_beat_grid,
               test_R6_tone_accepts_a_channel_and_refuses_the_contour,
               test_the_module_holds_no_phonology):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all declared-input regressions pass")
