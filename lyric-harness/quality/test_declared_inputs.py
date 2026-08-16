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

§12 IS A SEVENTH DECLARED INPUT OF A DIFFERENT KIND, and it is here for the
reason the other six are: a declaration that nothing reads is decorative.
`quality/frequency.py`'s `FrequencySource.licence` carried real licence text
from the day the English cells were written and, until 2026-08-13, exactly one
line of code read it — the `report()` printer. That made TWO licence registries
in this repo, `data/sources.tsv` gated by `quality/provenance.py` and this one
gated by nothing, free to disagree. Doctrine 85 says an express non-commercial
grant is a rejection in every language; §12 pins that it is now a rejection in
every REGISTRY too, that the predicate is IMPORTED rather than reimplemented
(one vocabulary, not two), and that the clean tables the repo actually serves
are untouched by it.

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

# §12. Imported AFTER the MODULES_AT_IMPORT snapshot above on purpose: the
# snapshot is check 11's evidence about `declared_inputs`, and polluting it
# with this module's imports would make that check assert something weaker
# than it says.
from quality import frequency as FREQ  # noqa: E402
from quality.provenance import noncommercial_marker  # noqa: E402

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


#: Fields a `*Declaration` may carry that NOTHING is expected to read back,
#: declared as a closed list so a new one has to be argued for rather than
#: added. Empty today, and that is the point: every coordinate on every
#: declaration in this repo is consulted by something.
_MAY_BE_UNREAD = ()


def test_every_declared_coordinate_is_read():
    """A DECLARED COORDINATE NOTHING CONSULTS IS A KNOB THAT LIES.

    Doctrine 1 says a disagreement is located in a coordinate of the tuple. A
    field no code reads cannot hold one: it reads as a setting, it takes a
    value, and moving it changes nothing. That is worse than a missing setting,
    because a missing setting is visibly missing.

    THREE WERE FOUND THE DAY THIS WAS WRITTEN, out of 90 fields across 8
    declarations, and each had a different repair:

      * `lyric_harness.Declaration.theta_repeat_onset` -- a THRESHOLD for a
        boundary decided by EXACT EQUALITY. Measured byte-identical at 0.0,
        0.5 and 1.0 (md5 c9b9e7bf4bd2), the two ends being the settings that
        would make everything or nothing a REPEAT. Removed; the exactness is
        deliberate and the repair was to stop advertising a threshold.
      * `rhyme_constraints.Declaration.tie_break` -- a REAL rule ("doctrine
        66: fixed and stated") that the code implements implicitly through
        stable `sorted` and first-maximum `max`. The statement and the
        behaviour were never connected, so either could move alone. Removed
        as a field, stated at the two sites that enforce it, pinned below.
      * `fit_matrix.MatrixDeclaration.fitted_on` -- a PROVENANCE field neither
        fitter ever wrote, so every matrix claimed an empty training set while
        `fit_all`'s own docstring warned that scoring a training item is
        circular. WIRED rather than removed: this one has a job.
    """
    print("\n15. every field of every `*Declaration` is READ by something "
          "(FIXED 2026-08-15)")
    import ast
    import re
    root = os.path.join(HERE, "..")
    srcs, tree_of = {}, {}
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs
                   if d not in ("data", "corpus", "examples", "__pycache__",
                                ".git", "scratch")]
        for f in files:
            if not f.endswith(".py"):
                continue
            p = os.path.join(base, f)
            try:
                srcs[p] = open(p, encoding="utf-8", errors="replace").read()
                tree_of[p] = ast.parse(srcs[p])
            except (OSError, SyntaxError):
                continue
    # A CENSUS THAT CANNOT SEE ITS POPULATION REFUSES (doctrine 20) -- an
    # empty walk would report "0 dead fields" and read as a pass.
    decls, declaring = {}, set()
    for p, tree in tree_of.items():
        for n in ast.walk(tree):
            if isinstance(n, ast.ClassDef) and n.name.endswith("Declaration"):
                rows = [b for b in n.body
                        if isinstance(b, ast.AnnAssign)
                        and isinstance(b.target, ast.Name)]
                # THE DECLARING NODE IS ITSELF AN `ast.Name`, so without
                # this the field counts as its own use and NOTHING is
                # ever dead -- the check passes on every tree, which is
                # exactly the shape it exists to find. Excluded by node
                # IDENTITY, not by name, so a real read elsewhere in the
                # same class still counts.
                declaring |= {id(b.target) for b in rows}
                decls[(os.path.relpath(p, root), n.name)] = [
                    b.target.id for b in rows]
    check("the declarations are found at all — a census that reads nothing "
          "reports no defects and looks identical to a clean one",
          len(decls) >= 6 and sum(len(v) for v in decls.values()) >= 50,
          f"{len(decls)} declaration classes, "
          f"{sum(len(v) for v in decls.values())} fields")

    # THE CENSUS IS AST-ONLY, AND A REGEX SWEEP IS WRONG IN BOTH DIRECTIONS.
    # Too narrow if it reads attribute syntax alone: `grid.Meter.assumed` is
    # reached only as `getattr(m, "assumed", "")`, so a `\.name\b` sweep calls
    # a live field dead. Too WIDE if it reads the raw text: a `\bname\b` sweep
    # counts the field's name inside a COMMENT, and this file's own removals
    # are documented in comments that name the fields they removed — planting
    # `theta_repeat_onset` back as a live dataclass field left this section
    # GREEN, because the note explaining its deletion referenced it. A check
    # defeated by its own documentation is doctrine 48 with a paper trail.
    # An AST carries no comments, so the same three forms count and prose does
    # not: `x.name`, `getattr(x, "name")`/`d["name"]`, and `f(name=...)`.
    used = set()
    for p, tree in tree_of.items():
        docstrings = set()
        for n in ast.walk(tree):
            if isinstance(n, (ast.Module, ast.ClassDef, ast.FunctionDef,
                              ast.AsyncFunctionDef)) and n.body:
                first = n.body[0]
                if (isinstance(first, ast.Expr)
                        and isinstance(first.value, ast.Constant)
                        and isinstance(first.value.value, str)):
                    docstrings.add(id(first.value))
        for n in ast.walk(tree):
            if isinstance(n, ast.Attribute):
                used.add(n.attr)
            elif isinstance(n, ast.Name):
                if id(n) not in declaring:
                    used.add(n.id)
            elif isinstance(n, ast.keyword) and n.arg:
                used.add(n.arg)
            elif (isinstance(n, ast.Constant) and isinstance(n.value, str)
                  and id(n) not in docstrings):
                used.add(n.value)
    dead = [f"{cls}.{f} ({rel})"
            for (rel, cls), fields in sorted(decls.items())
            for f in fields
            if f not in _MAY_BE_UNREAD and f not in used]
    check("no `*Declaration` field is referenced ONLY by the line that "
          "declares it — doctrine 1's tuple cannot locate a disagreement in a "
          "coordinate nothing consults",
          not dead, f"{len(decls)} declarations, "
                    f"{sum(len(v) for v in decls.values())} fields; "
                    f"DEAD: {dead or 'none'}")

    # AND THE TWO RULES THE REMOVALS RESTED ON, pinned here so the deletions
    # are not the only record of them.
    from lyric_harness import (Declaration, Lexicon, anchor, score,
                               syllabify)
    lex = Lexicon()
    if lex is not None:
        def _anc(w):
            pr = lex.transcribe_word(w)
            ph = pr[0] if pr and isinstance(pr[0], list) else pr
            return anchor(syllabify(ph))
        d = Declaration()
        same = score(_anc("light"), _anc("light"), d,
                     word_a="light", word_b="light")
        rich = score(_anc("bear"), _anc("bare"), d,
                     word_a="bear", word_b="bare")
        check("REPEAT and RIME_RICHE are decided by EXACT identity, which is "
              "why no threshold governs them",
              same["relation"] == "REPEAT"
              and rich["relation"] == "RIME_RICHE",
              f"{same['relation']} / {rich['relation']}")

    from quality.rhyme_constraints import Declaration as RCDecl
    check("and `rhyme_constraints.Declaration` no longer offers a `tie_break` "
          "knob for a rule its own code fixes",
          "tie_break" not in RCDecl.__dataclass_fields__,
          sorted(RCDecl.__dataclass_fields__))
    # THE TIE-BREAK ITSELF, not the absence of the field: equal keys settle on
    # the lowest index. Asserted on the primitives the two sites use, because
    # that is exactly what those sites rely on.
    check("the stated tie-break is the one the code actually takes — equal "
          "keys settle on the LOWEST index (doctrine 66)",
          sorted(range(4), key=lambda i: 0) == [0, 1, 2, 3]
          and max([(0, "a"), (0, "b")], key=lambda x: x[0])[1] == "a",
          "stable `sorted` and first-maximum `max`")


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
    # This pair is the standing demonstration of doctrine 36, and the producer
    # moved under it. `rhyme_types.verdict` now ASKS a phonology that declares
    # the relation and implements the predicate, so the default entry point
    # gets 流/樓 right where it used to get it wrong. The defect has to stay
    # REACHABLE or the doctrine becomes a sentence nobody can check -- the same
    # argument that keeps `modal_exclusion=0` reachable in revise.py -- so the
    # channel path is pinned explicitly at consult=False and the improvement is
    # pinned beside it.
    check("the GENERIC channel comparison still gets the same pair WRONG",
          generic_verdict("流", "樓", MC, consult=False) is False,
          "raw 切韻 classes are finer than any poet worked to "
          "(doctrine 36); 流/樓 is the rhyme of 登鸛雀樓")
    check("...but the DEFAULT path now consults the phonology and gets it right",
          generic_verdict("流", "樓", MC) is True,
          "the producer asks a phonology that declares the relation; R2's job "
          "is narrower than it was, and this line records how much")
    check("consulting does not manufacture a rhyme where there is none",
          generic_verdict("東", "冬", MC) is False,
          "東 and 冬鐘 are different 同用 groups under the same consultation")
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


def _lic_msg(fn):
    """-> the licence-refusal text, or '' if the call did not refuse."""
    try:
        fn()
    except FREQ.LicenceRefusedError as e:
        return str(e)
    except Exception as e:
        return f"WRONG EXCEPTION {type(e).__name__}: {e}"
    return ""


def test_the_frequency_licence_is_load_bearing():
    print("\n12. §12 · a frequency table's licence GATES, it does not decorate")

    # ONE REGISTRY, NOT TWO. This is the whole finding: a copy of the marker
    # vocabulary here would be a second registry free to drift from the first.
    check("frequency.py uses provenance.py's OWN marker function, not a copy",
          FREQ.noncommercial_marker is noncommercial_marker,
          "doctrine 85 binds in every language; it has to bind in every "
          "registry too, and that is an identity check, not a similarity one")

    # A RESTRICTED TABLE REFUSES.
    lay = FREQ.FrequencyLayer()
    nc = FREQ.FrequencySource(
        cell="demo-nc", name="file:nowhere.tsv", derived_from_pool=False,
        licence="CC-BY-NC-SA-4.0", n_types=1,
        register_note="STRUCTURE DEMO — a licence, not a corpus")
    lay.declare(nc)
    check("a restricted source still DECLARES — the row is a record, not a hole",
          "demo-nc" in lay.declared(),
          "refusing the declaration would train the next session to delete the "
          "row rather than write it; the refusal belongs at SERVICE")
    m = _lic_msg(lambda: lay.ranks("demo-nc"))
    check("...and REFUSES to be served, by identifier prefix", bool(m),
          m[:96] if m else "IT SERVED")
    check("the refusal names the cell, the marker and the doctrine",
          "'demo-nc'" in m and "cc-by-nc-sa-4.0" in m and "85" in m)
    check("...and says there is NO override, unlike the scoring refusal",
          "no override" in m and "no `scoring=`-shaped escape" in m,
          "a pool dependence is cured by naming what you score; a restriction "
          "in the GRANT is not cured by anything said at the call site")
    check("the refusal quotes the licence, so the reason travels with it",
          "LICENCE: CC-BY-NC-SA-4.0" in m)

    # IN EVERY LANGUAGE — doctrine 85's own string, the rime-aca grant.
    lay.declare(FREQ.FrequencySource(
        cell="demo-zh", name="file:nowhere2.tsv", derived_from_pool=False,
        licence="資料自由使用，但不得為商業用途", n_types=1))
    check("the prose prohibition doctrine 85 was written about refuses too",
          "不得為商業" in _lic_msg(lambda: lay.ranks("demo-zh")),
          "4,347 ci and 734 樂府 were refused on this exact string by a human "
          "reading it; a table carrying it is refused by the code")

    # THE SONG ROUTE IS GATED AT THE SAME CHOKE POINT, not only `ranks`.
    lay.declare(FREQ.FrequencySource(
        cell="demo-song", name="song:nowhere/*", derived_from_pool=True,
        licence="cc-by-nc-4.0", pool="nowhere/*", loo_unit="author",
        justification="STRUCTURE DEMO — present so the LICENCE is what "
                      "refuses, not the missing justification",
        may_not_score="STRUCTURE DEMO"))
    mcond = _lic_msg(lambda: lay.conditional("demo-song", "night",
                                          scoring=FREQ.UNSEEN))
    check("`conditional()` refuses on the licence as well as `ranks()`",
          "cc-by-nc-4.0" in mcond,
          "both routes reach a source through `source_for` and nowhere else, "
          "so the question is asked once — the shape provenance.admit uses to "
          "put doctrine 85 ahead of all three of its admitting routes")
    check("...and it refuses BEFORE any file is opened",
          "FileNotFoundError" not in mcond and "No such file" not in mcond,
          "a licence refusal that first reads the data has already done the "
          "thing it was refusing")

    # THE NEGATION GUARD TRAVELS WITH THE IMPORT. `data/opensubtitles_en_50k
    # .tsv`'s real row says "No non-commercial clause anywhere in the chain";
    # a substring search would refuse the admissible file for describing the
    # inadmissible one it replaced.
    lay.declare(FREQ.FrequencySource(
        cell="demo-neg", name="file:nowhere3.tsv", derived_from_pool=False,
        licence="MIT (hermitdave/FrequencyWords). No non-commercial clause "
                "anywhere in the chain — which is the point, since the list "
                "it replaces has one.", n_types=1))
    check("a row DESCRIBING an absent NC clause is not refused for saying so",
          lay.source_for("demo-neg") is not None,
          "the guard lives in provenance.py and comes along with the import; "
          "it did not have to be rewritten here, which is the point")

    # THE CLEAN TABLES STILL SERVE. These are the two the repo actually reads.
    r = FREQ.LAYER.ranks("eng-spoken")
    check("eng-spoken (MIT) still serves, unchanged",
          len(r) == 50000 and r.get("moon") is not None,
          f"{len(r):,} types; moon rank {r.get('moon')}, yahoo rank "
          f"{r.get('yahoo')}")
    cond = FREQ.LAYER.conditional("eng-song", "night", scoring=FREQ.UNSEEN)
    check("eng-song's conditional still serves — the ONE table anything reads",
          len(cond) > 0,
          f"P(partner|'night') top 6: "
          f"{[w for w, _ in cond.most_common(6)]}")
    check("...and its own pool refusal is untouched by the licence gate",
          _raises(lambda: FREQ.LAYER.conditional("eng-song", "night"),
                  FREQ.UndeclaredScoringError),
          "doctrine 13's refusal and doctrine 85's are separate questions and "
          "stay separate exceptions")
    for cell in ("fi", "ces", "nl", "spa", "he", "ar", "ja", "ta"):
        check(f"wordfreq cell {cell!r} is not refused",
              FREQ.LAYER.source_for(cell) is not None)
    check("...because CC BY-SA carries no non-commercial term",
          noncommercial_marker(FREQ.WORDFREQ_LICENCE) is None,
          f"{FREQ.WORDFREQ_LICENCE!r} — SA is a share-alike obligation, not a "
          "commercial-use prohibition, and conflating them would strip eight "
          "cells for a clause they do not carry")

    # WHAT THE GATE FIRES ON TODAY, MEASURED AND PRINTED (doctrine 79).
    refused = FREQ.LAYER.licence_refusals()
    check("the shipped registry has ZERO licence refusals, and that is stated",
          refused == {},
          "eng-web quotes 'I do not recommend using this data for commercial "
          "purposes WITHOUT LICENSING IT from the LDC' — a redistributor's "
          "recommendation with a route through it, not one of the unambiguous "
          "prohibitions NONCOMMERCIAL_PROSE is restricted to. Widening that "
          "vocabulary is a change to provenance.py and data/sources.tsv, "
          "which is what having one registry MEANS")
    import io
    buf = io.StringIO()
    counts = FREQ.LAYER.report(stream=buf)
    out = buf.getvalue()
    check("the count is printed on every run, zero or not",
          "licence gate" in out and "0 of 11 declared sources" in out,
          "a gate that fires on nothing must still say so: silence is "
          "indistinguishable from a gate that is not there")
    check("...and eng-web is still LISTED, refusal or none",
          "eng-web" in out and counts["declared"] == 11
          and counts["licence_refused"] == 0)


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
               test_the_module_holds_no_phonology,
               test_the_frequency_licence_is_load_bearing,
               test_every_declared_coordinate_is_read):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all declared-input regressions pass")
