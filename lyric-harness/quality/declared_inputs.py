#!/usr/bin/env python3
"""The six declared-input families — R1-R6, the honest boundary.

WHAT THIS FILE IS FOR

`quality/RHYME_COVERAGE.md` §2 sorts 66 failing rhyme structures into three
classes: 8 missing degrees of freedom, 13 producer defects, and

    6 declared-input families (R1-R6): not computable from text + phonology
    by any route.

The first two classes are work. This class is not: no amount of model effort
reaches them, because the information is not in the input. The deliverable for
them is therefore not a capability, it is a BOUNDARY — an object that accepts
the input when a caller has it, and a refusal that NAMES the input when they
do not.

THE THREE RULES THIS FILE OBEYS

1. **A refusal names its input.** Not `False`, not a bare `None`. Returning
   False for `love`/`move` with no orthography declared asserts *these do not
   rhyme*, when the truth is *I was not given what I would need to tell*. The
   two are different claims and this project's doctrine (2, 28, 35, 53) is that
   collapsing them is the defect. `MissingDeclaredInput` carries the family,
   the exact field, its type, and whether the gap is scheduled or permanent.

2. **A refusal cannot be read as a negative, mechanically.** `Refusal.__bool__`
   RAISES. `if not result:` is the line that would silently turn a refusal into
   "does not rhyme", so it is made impossible rather than discouraged.
   `Refusal == False` is False. This is the same move `meter.pulse_groups()`
   made by returning None instead of `(1,1,1,1,1,1,1)`: the wrong answer
   delivered confidently is worse than no answer.

3. **The slot ships empty.** No period lexicon, no slang register, no sense
   inventory, no contour table is written here from memory. `meter.py`'s
   catalogue slot is the pattern: `get_named()` raises and says what is
   missing, `register_named()` REFUSES an entry with no `source`. Every
   declaration below refuses at construction without one, for the reason the
   sourcing cells refused lyrics they could recite — a table written from
   recall is unsourced data in the evidence base.

THE LINE BETWEEN SCHEDULED AND PERMANENT — the point of the file

Conflating "not yet built" with "not computable" makes a schedule out of an
impossibility and an impossibility out of a schedule. Each family therefore
carries TWO orthogonal coordinates:

  `route`   — could this input EVER come from text + phonology?
              IN_TEXT              the input is already in the input; what is
                                   missing is a field and a plumbing path
              SWAPPABLE_PHONOLOGY  a DIFFERENT declared phonology supplies it;
                                   a sourcing problem, not a modelling one
              OUTSIDE              no route, ever, from text plus sound

  `status`  — SCHEDULED  work exists that ends the refusal for every caller
              PERMANENT  the refusal is the finished capability; a declaration
                         ends it for one pair, one item, one performance, and
                         never in general

    R1 eye rhyme       IN_TEXT              SCHEDULED
    R2 historical      SWAPPABLE_PHONOLOGY  SCHEDULED
    R3 antanaclasis    OUTSIDE              PERMANENT
    R4 rhyming slang   OUTSIDE              PERMANENT
    R5 offbeat         OUTSIDE              PERMANENT
    R6 tone-contour    SWAPPABLE_PHONOLOGY  SCHEDULED

Three scheduled, three permanent, and the two coordinates do not collapse into
one: R5's beat grid is PERMANENTLY uncomputable from text (there is no audio,
so isochrony is an assumed coordinate — CLAUDE.md doctrine 4) while the ability
to ACCEPT a declared grid is ordinary scheduled work (MISSING.md G-1, the
syllable-to-beat map). What is scheduled there is the plumbing, never the
measurement, and a verdict computed from an ASSERTED grid says so in its own
`conditional_on` field rather than passing as a finding.

Two families carry a PERMANENT RESIDUE inside a SCHEDULED shell, and the
residue is recorded on the family rather than smoothed over:

  R1 closes at WORD granularity, where the spelling is a string in the text.
     At SYLLABLE granularity it must refuse on any phonology whose
     `Syllable.text` is empty — the CMUdict English path — because no
     grapheme-to-syllable alignment exists and inventing one would put a
     letter in a syllable no phonology put there.
  R6 answers tone CATEGORY wherever a tone-bearing lexicon exists (ltc.py
     already carries 平/仄), and the category-to-CONTOUR map is a separate
     declared input. For a reconstructed language the contour is itself a
     reconstruction, so that half never becomes a measurement.

SIX FAMILIES ARE SIX SHAPES, AND THEY CLOSE OVER THE REST OF §5

RHYME_COVERAGE.md §5 lists eleven not-producible types. They are instances of
these six shapes, which is the reason to hold six families and not eleven:

    a SURFACE the text carries and the model drops        -> R1 (eye rhyme)
    a PHONOLOGY at another coordinate                     -> R2 (historical,
                                                             dialect, Scots)
    an ANNOTATION over OCCURRENCES, not over word types   -> R3 (antanaclasis)
    a PAIR-KEYED, NON-TRANSITIVE register of attestation  -> R4 (rhyming slang,
                                                             conventional
                                                             licence)
    a PERFORMANCE channel no text carries                 -> R5 (offbeat, sung
                                                             delivery,
                                                             delivered
                                                             prominence)
    a CHANNEL MISSING FROM `Syllable`                     -> R6 (tone contour,
                                                             vowel length)

`refrain by reference` is the one §5 row that is NOT here, deliberately: its
stub-resolution map is derivable from the text itself (`&c.` points at a
printed chorus in the same file), so it is a producer defect (P10), not a
declared input. Filing it here would have been the schedule-as-impossibility
error this file exists to prevent.

WHAT THIS FILE DOES NOT DO

It does not transcribe, and it holds no language data. Every decision function
takes the caller's `phon` — any object with `.syllabify()`, which is every
module in `quality/phonology/` — exactly as `rhyme_types.classify_pair` does,
so a Welsh, Persian or Middle Chinese boundary lands in the same six families
as an English one.
"""

import os
import re
import sys
from dataclasses import dataclass, field
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.join(HERE, "..") not in sys.path:
    sys.path.insert(0, os.path.join(HERE, ".."))

from quality.rhyme_types import verdict as _sound_verdict  # noqa: E402

# ---------------------------------------------------------------------------
# THE TWO CARRIERS: a refusal that cannot be read as "no", and a verdict that
# cannot be read as certainty.
# ---------------------------------------------------------------------------

ROUTES = ("IN_TEXT", "SWAPPABLE_PHONOLOGY", "OUTSIDE")
STATUSES = ("SCHEDULED", "PERMANENT")

_NOT_A_NEGATIVE = ("This is a refusal, not a verdict: 'I was not given what I "
                   "would need to tell' is not 'these do not rhyme'.")


class DeclaredInputError(Exception):
    """Base for everything this module raises."""


class MissingDeclaredInput(DeclaredInputError):
    """The family was asked for a verdict and its input is absent.

    NEVER equivalent to False. The message names the field, its type, an
    example that would satisfy it, and whether the gap is scheduled work or a
    permanent boundary — because a caller who reads 'permanent' should stop
    waiting, and a caller who reads 'scheduled' should not.
    """

    def __init__(self, family, missing="", detail=""):
        self.family = family
        self.missing = missing
        self.detail = detail
        super().__init__(self.render())

    def render(self):
        f = self.family
        out = [f"{f.code} {f.name}: NOT ANSWERED — a declared input is "
               f"missing.",
               f"  NEEDS   {f.needs.field}: {f.needs.type_}",
               f"  SHAPE   {f.needs.example}",
               f"  KEYED   {f.needs.granularity}",
               f"  DECLARE {f.needs.constructor}"]
        if self.missing:
            out.append(f"  ABSENT  {self.missing}")
        if self.detail:
            out.append(f"  NOTE    {self.detail}")
        out.append(f"  STATUS  {f.status} / route {f.route} — {f.why}")
        if f.status == "SCHEDULED":
            out.append(f"  WAITING ON  {f.blocked_on}")
        if f.residue:
            out.append(f"  RESIDUE {f.residue}")
        out.append(f"  {_NOT_A_NEGATIVE}")
        return "\n".join(out)


class Undecided(DeclaredInputError):
    """A verdict was READ and could not be DECIDED. Also not a negative."""


@dataclass(frozen=True)
class Refusal:
    """The non-raising carrier of a `MissingDeclaredInput`.

    `attempt()` returns one of these instead of raising, for callers doing a
    survey. It is deliberately hostile to being mistaken for a negative:
    `bool()` RAISES rather than returning False, so the one line that would
    quietly turn "not given the input" into "does not rhyme" —
    `if not result:` — cannot be written by accident.
    """
    family: object
    missing: str = ""
    detail: str = ""

    @property
    def code(self):
        return self.family.code

    @property
    def message(self):
        return MissingDeclaredInput(self.family, self.missing,
                                    self.detail).render()

    def __bool__(self):
        raise MissingDeclaredInput(
            self.family, self.missing,
            "a Refusal was used in a boolean test. " + self.detail)

    def __eq__(self, other):
        return other is self

    def __hash__(self):
        return id(self)

    def raise_(self):
        raise MissingDeclaredInput(self.family, self.missing, self.detail)

    def __repr__(self):
        return f"<Refusal {self.family.code} needs {self.family.needs.field}>"


@dataclass(frozen=True)
class Verdict:
    """A real answer, with the declaration that made it possible attached.

    `value` is the project's tri-state: True / False / None, where None means
    READ AND UNDECIDABLE — distinct from a Refusal, which means NOT READ.
    `bool()` raises on None for the same reason `Refusal.__bool__` does.
    `conditional_on` is non-empty whenever the answer is a function of an
    ASSERTED coordinate rather than a measured one.
    """
    family: str
    value: object
    reason: str = ""
    declaration: str = ""
    conditional_on: str = ""

    def __bool__(self):
        if self.value is None:
            raise Undecided(
                f"{self.family}: {self.reason}. The channels were read and the "
                f"question could not be decided; None is not False.")
        return bool(self.value)

    def describe(self):
        v = {True: "YES", False: "NO", None: "UNDECIDED"}[self.value]
        s = f"{self.family}: {v} — {self.reason} [from: {self.declaration}]"
        if self.conditional_on:
            s += f" CONDITIONAL ON: {self.conditional_on}"
        return s


# ---------------------------------------------------------------------------
# THE INPUT SPECIFICATIONS — what a caller must supply, concretely
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class InputSpec:
    """Exactly what would satisfy a family. A prose gap entry is not this."""
    field: str            # the name of the thing
    type_: str            # its Python shape
    example: str          # a filled-in instance
    constructor: str      # the call that declares it
    granularity: str = "" # what the keys index


@dataclass(frozen=True)
class Family:
    """One declared-input family: what it needs, and where the line falls."""
    code: str
    name: str
    needs: InputSpec
    route: str
    status: str
    why: str                       # why the route is what it is
    blocked_on: str = ""           # SCHEDULED: the work that ends the refusal
    residue: str = ""              # a PERMANENT part inside a SCHEDULED shell
    reference: str = ""
    probe: object = None           # zero-arg call that fires the refusal

    def __post_init__(self):
        if self.route not in ROUTES:
            raise ValueError(f"route must be one of {ROUTES}")
        if self.status not in STATUSES:
            raise ValueError(f"status must be one of {STATUSES}")
        if self.status == "SCHEDULED" and not self.blocked_on:
            raise ValueError(
                f"{self.code} is SCHEDULED and names no work. A schedule with "
                f"nothing on it is an impossibility wearing a date.")
        if self.status == "PERMANENT" and self.route != "OUTSIDE":
            raise ValueError(
                f"{self.code} is PERMANENT but its route is {self.route!r}. A "
                f"permanent boundary must say no route exists; anything else "
                f"is unscheduled work being called impossible.")

    def refuse(self, missing="", detail=""):
        raise MissingDeclaredInput(self, missing, detail)


# ---------------------------------------------------------------------------
# THE DECLARATIONS — the objects that accept the input
# ---------------------------------------------------------------------------


class _Sourced:
    """Every declaration refuses at construction without a `source`.

    Stricter than `meter.register_named`, which refuses only on entry to the
    catalogue: these objects are passed directly to decision functions, so the
    check has to be at construction or it can be walked around.
    """

    def _check_source(self):
        if not getattr(self, "source", ""):
            raise ValueError(
                f"{type(self).__name__} has no source. A period lexicon, slang "
                f"register, sense inventory or tone table written from memory "
                f"is unsourced data in the evidence base — the same refusal "
                f"the sourcing cells made about lyrics they could recite. "
                f"State where it came from, or leave the slot empty.")


@dataclass(frozen=True)
class Orthography(_Sourced):
    """R1 · the SPELLING, as set in a named edition.

    Not "the word" — the printed form. Doctrine 50: a modernised edition
    normalises spelling and destroys the orthographic rhyme, so a text that has
    been modernised cannot answer an eye-rhyme question at all and this object
    refuses rather than reporting on the modernisation.

    `vowel_letters` is declared because the eye-rime (last vowel letter to end)
    is an orthographic rule and every writing system draws its vowels
    differently — English needs `y`, Welsh needs `w` and `y`, and nothing here
    may assume the Latin five.
    """
    system: str                       # 'English, printed'
    edition: str                      # WHICH printing, exactly
    vowel_letters: str = ""
    spellings: dict = field(default_factory=dict)
    token_is_printed: bool = False    # the caller has read the edition and
                                      # affirms its tokens ARE the printed form
    modernised: bool = False
    granularity: str = "word"         # 'word' | 'syllable'
    source: str = ""
    family_code = "R1"

    def __post_init__(self):
        self._check_source()
        if not self.vowel_letters:
            raise ValueError(
                "an Orthography must declare its vowel_letters: the eye-rime "
                "runs from the last vowel LETTER to the end, and which letters "
                "those are is a property of the writing system, not of Latin.")
        if self.granularity not in ("word", "syllable"):
            raise ValueError("granularity is 'word' or 'syllable'")
        if not self.edition:
            raise ValueError(
                "an Orthography must name its edition. Two printings of one "
                "poem are two different declared inputs here (MISSING.md F-4: "
                "one Gutenberg encoding of Barnes invents a letter).")

    def of(self, word):
        """-> the printed form, or a refusal naming the word."""
        if self.modernised:
            return None
        key = str(word).strip().lower()
        if key in self.spellings:
            return self.spellings[key]
        if self.token_is_printed:
            return str(word).strip()
        return None

    def eye_rime(self, printed):
        """Last vowel LETTER to the end, under the declared alphabet."""
        s = str(printed).lower()
        idx = None
        for i, c in enumerate(s):
            if c in self.vowel_letters:
                idx = i
        return None if idx is None else s[idx:]


@dataclass(frozen=True)
class PeriodPhonology(_Sourced):
    """R2 · a phonology at ANOTHER COORDINATE — a period, or a dialect.

    CLAUDE.md doctrine 1 makes the dialect (CMUdict General American) a
    declared coordinate, and for 1600s verse it is the wrong one. This object
    holds a phonology that declares a different one. `quality/phonology/ltc.py`
    is the existence proof and the template: Middle Chinese is not G2P but a
    LOOKUP over `data/qieyun_mc.tsv` (CC0), and it exists precisely because a
    modern Mandarin reading of a Tang rhyme is the wrong language for the
    question.

    `phonology` is any object with `.syllabify()`. Nothing here reconstructs.
    """
    phonology: object
    language: str
    period: str                       # '1590-1620, London English'
    reconstruction: str = ""          # the work reconstructed FROM
    source: str = ""
    family_code = "R2"

    def __post_init__(self):
        self._check_source()
        if not hasattr(self.phonology, "syllabify"):
            raise ValueError(
                "PeriodPhonology.phonology must expose .syllabify(word), like "
                "every module in quality/phonology/. A word list is not a "
                "phonology.")
        if not self.period:
            raise ValueError(
                "a PeriodPhonology must declare its period. A phonology with "
                "no period IS the modern one, and answering a historical "
                "question with it is the error this family exists to name.")
        if not self.reconstruction:
            raise ValueError(
                "name the reconstruction this reads. A period pronunciation "
                "written from memory is exactly the unsourced-data refusal.")


@dataclass(frozen=True)
class SenseAnnotation(_Sourced):
    """R3 · word SENSE, per OCCURRENCE.

    The keys must be occurrences — `(line, token)` — and a word-keyed map is
    refused. Antanaclasis is ONE word carrying TWO senses; a map from word to
    sense assigns it one, so such a map cannot express the phenomenon and would
    make every antanaclasis report False. That is the shape of error this
    module exists to prevent, so it is refused at construction rather than at
    the verdict.
    """
    senses: dict                      # (line, token) -> sense id
    inventory: str = ""               # WHICH sense inventory
    annotator: str = ""
    source: str = ""
    family_code = "R3"

    def __post_init__(self):
        self._check_source()
        if not self.inventory:
            raise ValueError(
                "a SenseAnnotation must name its sense INVENTORY. 'Sense 2' is "
                "meaningless without the dictionary that numbered it, and two "
                "inventories do not cut the same word the same way.")
        for k in self.senses:
            if not (isinstance(k, tuple) and len(k) == 2):
                raise ValueError(
                    f"sense key {k!r} is not an OCCURRENCE. Keys are "
                    f"(line, token). A word-keyed map gives each word one "
                    f"sense, and antanaclasis is one word with two — such a "
                    f"map cannot express the type it is being supplied for.")

    def at(self, occurrence):
        return self.senses.get(tuple(occurrence))


@dataclass(frozen=True)
class SlangRegister(_Sourced):
    """R4 · the cultural referent CHAIN, pair-keyed.

    Rhyming slang's constitutive member is ABSENT FROM THE TEXT: `plates of
    meat` means feet because `meat` rhymes `feet`, and `feet` is never written.
    Worse, the productive form CLIPS the rhyming word away — `plates` alone —
    so the surface carries neither the referent nor the rhyme.

    Two maps, because the chain has two hops:
        elisions    clipped form -> the full phrase   ('plates' -> 'plates of
                                                        meat')
        expansions  full phrase  -> the referent word ('plates of meat' ->
                                                        'feet')

    RHYME_COVERAGE.md M8 is why this cannot be a per-member surface: a register
    of attested pairs is NOT TRANSITIVE (`love~prove`, `prove~move`, and not
    `love~move`), while every `f(read(a), read(b))` predicate is an equivalence
    relation. The same shape carries a conventional-licence register.
    """
    expansions: dict = field(default_factory=dict)
    elisions: dict = field(default_factory=dict)
    tradition: str = ""
    source: str = ""
    family_code = "R4"

    def __post_init__(self):
        self._check_source()
        if not self.tradition:
            raise ValueError(
                "a SlangRegister must name its tradition. A referent chain is "
                "a fact about one speech community at one time and does not "
                "travel.")

    @staticmethod
    def _norm(s):
        return re.sub(r"\s+", " ", str(s).strip().lower())

    def chain(self, term):
        """-> (steps, referent). `referent` is None where a hop is missing;
        `steps` is the resolution path as far as it got, so a caller can see
        WHICH hop failed rather than only that one did."""
        t = self._norm(term)
        steps = [t]
        if t not in self.expansions and t in self.elisions:
            t = self._norm(self.elisions[t])
            steps.append(t)
        if t in self.expansions:
            ref = self._norm(self.expansions[t])
            steps.append(ref)
            return steps, ref
        return steps, None


@dataclass(frozen=True)
class BeatGrid(_Sourced):
    """R5 · the BEAT GRID and the syllable-to-beat map.

    There is no audio in this project, so isochrony is an assumed coordinate
    and "on the beat" is not a claim it can make (CLAUDE.md doctrine 4). This
    object does not remove that: it lets a caller who HAS a grid declare it,
    and it stamps every verdict with where the grid came from.

    `derived_from` is the load-bearing field:
        'audio'      onsets measured from a recording
        'notation'   a score assigned the syllables to positions
        'asserted'   somebody decided; the verdict is a function of that
                     decision and says so in `Verdict.conditional_on`

    `cycle` is a `quality.meter.Cycle` — and its GROUPING is required, because
    which pulses are beats is exactly what a composition of the pulse count
    declares. An undeclared 7/8 has 64 groupings and `meter.pulse_groups()`
    returns None rather than asserting one; this refuses for the same reason.
    """
    cycle: object                     # meter.Cycle
    positions: dict = field(default_factory=dict)   # (line, syl) -> Fraction
    derived_from: str = "asserted"
    tempo_bpm: object = None
    source: str = ""
    family_code = "R5"

    DERIVATIONS = ("audio", "notation", "asserted")

    def __post_init__(self):
        self._check_source()
        if self.derived_from not in self.DERIVATIONS:
            raise ValueError(
                f"derived_from must be one of {self.DERIVATIONS}. A grid with "
                f"no stated provenance reads as a measurement and this project "
                f"has never measured one.")
        if not hasattr(self.cycle, "group_starts"):
            raise ValueError(
                "BeatGrid.cycle must be a quality.meter.Cycle — the period AND "
                "its ordered grouping. A bare time signature does not say "
                "which pulses are beats.")

    @property
    def measured(self):
        return self.derived_from in ("audio", "notation")

    def at(self, locus):
        p = self.positions.get(tuple(locus))
        return None if p is None else Fraction(p)


@dataclass(frozen=True)
class ToneChannel(_Sourced):
    """R6 · the TONE channel `Syllable` does not have.

    `quality/phonology/__init__.py`'s `Syllable` carries text, onset, nucleus,
    coda, prominence and moras. There is no tone field, so a tone language's
    rhyme constraint has nowhere to live (MISSING.md F-2). `ltc.py` gets as far
    as a tone CLASS by spending `prominence` on the 平/仄 binary, which is the
    contrast regulated verse constrains — and that is a two-way class, not a
    contour.

    So this is TWO inputs and they are kept separate:
        `tones`     word/char -> per-syllable tone CATEGORY labels. Lexical.
                    Written in the orthography for Vietnamese and Yoruba;
                    needs a lexicon for Cantonese; in a rime book for Middle
                    Chinese.
        `contours`  category -> CONTOUR ('˧˥', 'rising', (3,5)). A separate
                    declaration because a category is not a contour: two
                    categories can share one, the mapping is period-specific,
                    and for a reconstructed language it is itself a
                    reconstruction. Empty by default, and the contour question
                    refuses while it is empty.
    """
    tones: dict = field(default_factory=dict)
    contours: dict = field(default_factory=dict)
    system: str = ""
    source: str = ""
    family_code = "R6"

    def __post_init__(self):
        self._check_source()
        if not self.system:
            raise ValueError(
                "a ToneChannel must name its tone SYSTEM. 'Tone 2' in Jyutping "
                "and 'tone 2' in Pinyin are different objects, and the label "
                "alone does not say which.")

    def of(self, word):
        return self.tones.get(str(word))

    def contour_of(self, label):
        return self.contours.get(label)


# ---------------------------------------------------------------------------
# THE REGISTRY — empty, and it says what would fill it
# ---------------------------------------------------------------------------

DECLARED = {}


def declare(decl):
    """Register a declaration for its family. Refuses one with no `source`."""
    code = getattr(decl, "family_code", None)
    if code not in FAMILIES:
        raise ValueError(
            f"{type(decl).__name__} declares family {code!r}, which is not one "
            f"of {sorted(FAMILIES)}.")
    if not getattr(decl, "source", ""):
        raise ValueError(
            f"{type(decl).__name__} has no source; see _Sourced. The slot ships "
            f"EMPTY on purpose and an unsourced fill is worse than empty.")
    DECLARED[code] = decl
    return decl


def get_declared(code, supplied=None):
    """-> the declaration for `code`, or raise naming exactly what is absent."""
    if supplied is not None:
        return supplied
    if code in DECLARED:
        return DECLARED[code]
    FAMILIES[code].refuse(missing=f"nothing declared for {code}; declared: "
                                  f"{sorted(DECLARED) or 'nothing'}")


def withdraw(code):
    DECLARED.pop(code, None)


def clear_declarations():
    DECLARED.clear()


#: R2's period lexicons get their own slot, because a phonology is a heavier
#: object than a table and a caller looks one up by name. Same discipline as
#: `meter.CATALOGUE`: empty, refusing, and saying what would fill it.
PERIOD_PHONOLOGIES = {}


def register_period(pp, key=None):
    if not isinstance(pp, PeriodPhonology):
        raise ValueError("register_period takes a PeriodPhonology")
    PERIOD_PHONOLOGIES[key or f"{pp.language}/{pp.period}"] = pp
    return pp


def get_period(key):
    if key not in PERIOD_PHONOLOGIES:
        raise MissingDeclaredInput(
            FAMILIES["R2"],
            missing=f"no period phonology registered as {key!r}; registered: "
                    f"{sorted(PERIOD_PHONOLOGIES) or 'nothing'}",
            detail=("This slot holds dated phonologies and contains NONE. "
                    "English is not a declared phonology module at all "
                    "(MISSING.md F-1), so the modern reading is the CMUdict "
                    "path in lyric_harness.py and there is no earlier one. "
                    "What would fill it: a sourced reconstruction in the shape "
                    "of quality/phonology/ltc.py — a LOOKUP over a licensed "
                    "table, committed as a file for auditability, validated "
                    "against verse known to rhyme in that period (doctrine 37) "
                    "rather than against its own rules. Writing one from "
                    "memory is refused."))
    return PERIOD_PHONOLOGIES[key]


# ---------------------------------------------------------------------------
# THE SOUND SIDE
#
# Four of the six families need a phonological verdict as one TERM of their
# question. It is taken from the phonology the caller passed, never computed
# here — and a phonology that declares its OWN relation is asked in its own
# terms, because the generic (onset, nucleus, coda) comparison is not always
# the granularity the form works at.
# ---------------------------------------------------------------------------


def _declared_relation(phon):
    """-> the module's own `rhymes` if it overrides the interface, else None.

    Doctrine 36 is the reason this exists. `ltc.MiddleChinese` compares raw
    切韻 rime classes on the syllable, so the generic channel comparison reports
    流/樓 as NOT rhyming — and they are the rhyme of 登鸛雀樓. `ltc.rhymes()`
    applies the 同用 grouping the form actually worked at. Asking the generic
    question of a phonology that has declared a finer or coarser relation gets
    a confident wrong answer, which is the failure mode this whole file is
    against.
    """
    try:
        from quality.phonology import Phonology
    except Exception:
        return None
    fn = getattr(type(phon), "rhymes", None)
    if fn is None or fn is Phonology.rhymes:
        return None
    return phon.rhymes


def _sound(a, b, phon):
    """-> (True/False/None, route). Never raises for an undecidable channel."""
    own = _declared_relation(phon)
    if own is not None:
        return own(a, b), f"{getattr(phon, 'relation', 'declared relation')}"
    return _sound_verdict(a, b, phon), "generic (onset, nucleus, coda) channels"


# ---------------------------------------------------------------------------
# THE SIX DECISIONS
#
# Each: refuses NAMING ITS OWN INPUT when absent, returns a real Verdict when
# supplied. None of them ever returns False for a missing input.
# ---------------------------------------------------------------------------


def eye_rhyme(a, b, phon=None, orthography=None):
    """R1 · Do these rhyme to the EYE — spelled alike, sounding different?

    Two inputs, and they are named separately: the ORTHOGRAPHY (this family's
    own input) and a phonology that can read the words, because eye rhyme is a
    conjunction of an orthographic agreement and a phonetic DISagreement. With
    only the spelling you can answer half of it, and half of a conjunction is
    not a verdict.
    """
    f = FAMILIES["R1"]
    orth = get_declared("R1", orthography)
    if orth.modernised:
        f.refuse(missing=f"edition {orth.edition!r} is declared MODERNISED",
                 detail=("a modernised text normalises spelling, which is the "
                         "channel this question reads (doctrine 50). Supply "
                         "the original printing's spellings, not a filter over "
                         "the modern ones."))
    pa, pb = orth.of(a), orth.of(b)
    for w, p in ((a, pa), (b, pb)):
        if p is None:
            f.refuse(missing=f"no printed form for {w!r}",
                     detail=("either add it to `spellings`, or set "
                             "token_is_printed=True to affirm that this text's "
                             "tokens ARE the edition's spelling."))
    if phon is None:
        f.refuse(missing="no phonology passed",
                 detail=("eye rhyme is 'spelled alike AND does not sound "
                         "alike'. The second half needs a phonology that reads "
                         "this language; English has no declared module "
                         "(MISSING.md F-1), so pass the CMUdict path or one of "
                         "quality/phonology/."))

    if orth.granularity == "syllable":
        for w in (a, b):
            sy = phon.syllabify(w)
            if not sy or any(not getattr(s, "text", "") for s in sy):
                f.refuse(
                    missing=f"no grapheme-to-syllable alignment for {w!r}",
                    detail=("this phonology leaves Syllable.text empty, so "
                            "which letters belong to which syllable is "
                            "unknown. THIS PART IS PERMANENT on the CMUdict "
                            "path: assigning letters to syllables here would "
                            "be inventing an alignment no phonology supplied. "
                            "Ask at granularity='word', where the spelling is "
                            "a string in the text."))

    ra, rb = orth.eye_rime(pa), orth.eye_rime(pb)
    if ra is None or rb is None:
        return Verdict("R1 eye rhyme", None,
                       f"{pa!r}/{pb!r}: no vowel letter of {orth.vowel_letters!r}",
                       orth.source)
    spelled = (ra == rb)
    sound, route = _sound(a, b, phon)
    if sound is None:
        return Verdict("R1 eye rhyme", None,
                       f"spelled {ra!r}/{rb!r} ({'alike' if spelled else 'apart'}) "
                       f"but the phonology could not decide the sound",
                       orth.source)
    return Verdict(
        "R1 eye rhyme", bool(spelled and sound is False),
        f"spelling {pa!r}/{pb!r} -> rime {ra!r}/{rb!r} "
        f"{'agrees' if spelled else 'differs'}; sound "
        f"{'agrees' if sound else 'differs'} by {route}",
        f"{orth.edition} ({orth.source})")


def historical_rhyme(a, b, period=None):
    """R2 · Did these rhyme in the DECLARED period?

    The verdict is `rhyme_types.verdict` run on a phonology whose declared
    coordinate is a period rather than modern General American. Nothing is
    reconstructed here; the reconstruction is the input.
    """
    f = FAMILIES["R2"]
    pp = get_declared("R2", period)
    va = pp.phonology.syllabify(a)
    vb = pp.phonology.syllabify(b)
    for w, sy in ((a, va), (b, vb)):
        if not sy:
            return Verdict(
                "R2 historical rhyme", None,
                f"{w!r} is outside the {pp.period} inventory",
                f"{pp.reconstruction} ({pp.source})",
                conditional_on=f"the {pp.period} reconstruction")
    v, route = _sound(a, b, pp.phonology)
    return Verdict(
        "R2 historical rhyme", v,
        f"{a!r}/{b!r} under {pp.language} as of {pp.period}, by {route}",
        f"{pp.reconstruction} ({pp.source})",
        conditional_on=(f"the {pp.period} reconstruction — a declared "
                        f"coordinate, not a measurement"))


def antanaclasis(occ_a, occ_b, word_a=None, word_b=None, senses=None):
    """R3 · One word, two SENSES.

    `occ_a`/`occ_b` are occurrences — `(line, token)`. The words are passed
    separately because the phonology cannot supply them and the annotation is
    not a lexicon.
    """
    f = FAMILIES["R3"]
    ann = get_declared("R3", senses)
    if word_a is None or word_b is None:
        raise ValueError("antanaclasis needs the surface word at each "
                         "occurrence; the sense map does not carry them")
    sa, sb = ann.at(occ_a), ann.at(occ_b)
    for occ, w, s in ((occ_a, word_a, sa), (occ_b, word_b, sb)):
        if s is None:
            f.refuse(missing=f"no sense annotated at occurrence {tuple(occ)} "
                             f"(word {w!r})",
                     detail=(f"the inventory is {ann.inventory!r}; every "
                             f"occurrence under test needs its own id, because "
                             f"the whole type is one word carrying two."))
    same_word = str(word_a).strip().lower() == str(word_b).strip().lower()
    if not same_word:
        return Verdict("R3 antanaclasis", False,
                       f"{word_a!r} and {word_b!r} are different words; "
                       f"antanaclasis is one word repeated in another sense",
                       f"{ann.inventory} ({ann.source})")
    return Verdict(
        "R3 antanaclasis", sa != sb,
        f"{word_a!r} at {tuple(occ_a)} is sense {sa!r}, at {tuple(occ_b)} is "
        f"sense {sb!r}",
        f"{ann.inventory}, annotated by {ann.annotator or 'unnamed'} "
        f"({ann.source})")


def rhyming_slang(term, target, phon=None, register=None):
    """R4 · Does `term` mean `target` by a rhyming-slang chain that RHYMES?

    Two questions in one, and both are answered from the declaration plus the
    caller's phonology: the chain must reach `target`, and the phrase's final
    word must actually rhyme it. A register entry whose rhyme does not hold in
    the declared phonology is reported as False rather than trusted — the
    register attests the convention, the phonology checks the sound.
    """
    f = FAMILIES["R4"]
    reg = get_declared("R4", register)
    steps, ref = reg.chain(term)
    if ref is None:
        f.refuse(missing=f"{term!r} resolves no further than {steps[-1]!r}",
                 detail=(f"the referent is ABSENT FROM THE TEXT — that is what "
                         f"makes this permanent. Register an expansion "
                         f"{steps[-1]!r} -> <referent> (tradition: "
                         f"{reg.tradition})."))
    if phon is None:
        f.refuse(missing="no phonology passed",
                 detail=("the chain is attested by the register; whether its "
                         "hop actually rhymes is a phonological question and "
                         "needs a phonology."))
    hit = (reg._norm(target) == ref)
    phrase_final = steps[-2].split()[-1] if len(steps) >= 2 else steps[0]
    sound, _route = _sound(phrase_final, ref, phon)
    if sound is None:
        return Verdict("R4 rhyming slang", None,
                       f"chain {' -> '.join(steps)}; the phonology could not "
                       f"decide {phrase_final!r}/{ref!r}",
                       f"{reg.tradition} ({reg.source})")
    return Verdict(
        "R4 rhyming slang", bool(hit and sound),
        f"chain {' -> '.join(steps)}; {phrase_final!r}/{ref!r} "
        f"{'rhymes' if sound else 'does not rhyme'}; target {target!r} "
        f"{'matches' if hit else 'does not match'} the referent",
        f"{reg.tradition} ({reg.source})")


def offbeat(locus, grid=None):
    """R5 · Does this syllable land OFF the beat?

    A beat is a group start of the declared cycle. An undeclared grouping is
    refused rather than assumed, because 7/8 has 64 orderings and picking one
    is the exact assertion `meter.py` was built to stop.
    """
    f = FAMILIES["R5"]
    g = get_declared("R5", grid)
    pos = g.at(locus)
    if pos is None:
        f.refuse(missing=f"no beat position for syllable {tuple(locus)}",
                 detail=("the syllable-to-beat map is MISSING.md G-1: a Line "
                         "has a duration in beats and no idea how many "
                         "syllables it holds. Supply positions[(line, syl)] as "
                         "a Fraction of pulses from the cycle origin."))
    starts = g.cycle.group_starts()
    if starts is None:
        f.refuse(missing=f"cycle {g.cycle.signature} declares no grouping",
                 detail=("which pulses are BEATS is the ordered composition of "
                         "the pulse count, and there are 2^(n-1) of them. "
                         "meter.pulse_groups() returns None rather than "
                         "asserting one, and so does this."))
    period = Fraction(g.cycle.pulses)
    within = Fraction(pos) % period
    on = within in {Fraction(s) for s in starts}
    return Verdict(
        "R5 offbeat", not on,
        f"syllable {tuple(locus)} at pulse {within} of {g.cycle.signature} "
        f"{tuple(g.cycle.groups)}; group starts {tuple(starts)}",
        f"{g.derived_from} grid ({g.source})",
        conditional_on=("" if g.measured else
                        "an ASSERTED grid — isochrony is not measured here, so "
                        "this verdict is a function of the declaration "
                        "(CLAUDE.md doctrine 4)"))


def tone_rhyme(a, b, level="category", tones=None):
    """R6 · Do these agree on TONE — as a category, or as a contour?

    `level='category'` compares the lexical tone labels. `level='contour'`
    needs the category-to-contour map, which is a SECOND declared input and is
    refused separately: a tone category is not a contour, and for a
    reconstructed language the contour is itself a reconstruction.
    """
    f = FAMILIES["R6"]
    tc = get_declared("R6", tones)
    if level not in ("category", "contour"):
        raise ValueError("level is 'category' or 'contour'")
    ta, tb = tc.of(a), tc.of(b)
    for w, t in ((a, ta), (b, tb)):
        if not t:
            f.refuse(missing=f"no tone for {w!r} in {tc.system}",
                     detail=("Syllable carries text/onset/nucleus/coda/"
                             "prominence/moras and NO tone field (MISSING.md "
                             "F-2), so the tone must arrive as a declared "
                             "channel: word -> per-syllable labels."))
    la, lb = ta[-1], tb[-1]
    if level == "category":
        return Verdict("R6 tone rhyme (category)", la == lb,
                       f"{a!r} ends {la!r}, {b!r} ends {lb!r} in {tc.system}",
                       tc.source)
    if not tc.contours:
        f.refuse(missing=f"no category-to-contour map for {tc.system}",
                 detail=(f"categories are declared ({la!r}, {lb!r}) and the "
                         f"CONTOUR is a different input: two categories can "
                         f"share a contour, the mapping is period-specific, "
                         f"and where the language is reconstructed the contour "
                         f"is a reconstruction and not a measurement. Declare "
                         f"contours={{label: shape}} with its source, or ask "
                         f"at level='category'."))
    ca, cb = tc.contour_of(la), tc.contour_of(lb)
    for lab, c in ((la, ca), (lb, cb)):
        if c is None:
            f.refuse(missing=f"category {lab!r} has no contour in the declared "
                             f"map",
                     detail=f"mapped: {sorted(tc.contours)}")
    return Verdict("R6 tone rhyme (contour)", ca == cb,
                   f"{la!r}->{ca!r} vs {lb!r}->{cb!r} in {tc.system}",
                   tc.source)


# ---------------------------------------------------------------------------
# THE FAMILY TABLE
# ---------------------------------------------------------------------------

FAMILIES = {}


def _add(f):
    FAMILIES[f.code] = f
    return f


_add(Family(
    code="R1", name="eye rhyme",
    needs=InputSpec(
        field="orthography",
        type_="Orthography(system, edition, vowel_letters, spellings|"
              "token_is_printed, source)",
        example="Orthography(system='English, printed', edition='Q 1609', "
                "vowel_letters='aeiouy', token_is_printed=True, "
                "source='<edition scan>') — then love/move",
        constructor="declared_inputs.declare(Orthography(...))",
        granularity="word (syllable REFUSES on the CMUdict path)"),
    route="IN_TEXT", status="SCHEDULED",
    why=("the spelling is already in the input — it is the text. What is "
         "missing is a field: `Syllable` carries onset/nucleus/coda and no "
         "spelling, and `classify_pair` takes (word, word, phonology) with no "
         "orthographic channel, so the surface the reader's EYE uses is "
         "dropped between the file and the model"),
    blocked_on=("a grapheme rung on the stream (RHYME_COVERAGE.md M1, "
                "prototyped there) plus an Orthography coordinate on the "
                "declaration; MISSING.md E-2 records that no caller passes "
                "the orthography today"),
    residue=("PERMANENT at SYLLABLE granularity for any phonology with an "
             "empty Syllable.text — the CMUdict English path. No "
             "grapheme-to-syllable alignment exists and inventing one puts "
             "letters in syllables no phonology put there. Also permanent for "
             "any modernised edition, which has already destroyed the channel "
             "(doctrine 50)"),
    reference="RHYME_COVERAGE.md §5, §6; MISSING.md E-2",
    probe=lambda: eye_rhyme("love", "move")))

_add(Family(
    code="R2", name="historical rhyme",
    needs=InputSpec(
        field="a dated phonology",
        type_="PeriodPhonology(phonology with .syllabify(), language, period, "
              "reconstruction, source)",
        example="PeriodPhonology(phonology=EarlyModernEnglish(), "
                "language='enm', period='1590-1620, London', "
                "reconstruction='<sourced reconstruction>', source='<table>')",
        constructor="declared_inputs.declare(PeriodPhonology(...)) or "
                    "register_period(...)",
        granularity="per word, in the period's own inventory"),
    route="SWAPPABLE_PHONOLOGY", status="SCHEDULED",
    why=("the modern reading cannot report an earlier one; CLAUDE.md doctrine "
         "1 already makes the dialect (CMUdict General American) a declared "
         "coordinate, and for 1600s verse it is simply the wrong coordinate. "
         "Swap the phonology and the ordinary machinery answers"),
    blocked_on=("a SOURCED dated phonology in the shape of "
                "quality/phonology/ltc.py — a lookup over a licensed table, "
                "committed as a file, validated against verse known to rhyme "
                "in that period (doctrine 37). English is not a declared "
                "module at all (MISSING.md F-1), so the modern coordinate is "
                "itself undeclared"),
    residue=("every historical verdict stays CONDITIONAL ON its reconstruction "
             "and says so; the reconstruction's own error bars are not "
             "quantified here and this module does not pretend otherwise"),
    reference="RHYME_COVERAGE.md §5; MISSING.md F-1, E-2; doctrine 36",
    probe=lambda: historical_rhyme("love", "prove")))

_add(Family(
    code="R3", name="antanaclasis",
    needs=InputSpec(
        field="a sense annotation, per OCCURRENCE",
        type_="SenseAnnotation(senses={(line, token): sense_id}, inventory, "
              "annotator, source)",
        example="SenseAnnotation(senses={(3, 6): 'light.ADJ.weight', "
                "(3, 9): 'light.N.illumination'}, inventory='OED 3rd ed.', "
                "annotator='<name>', source='<annotation set>')",
        constructor="declared_inputs.declare(SenseAnnotation(...))",
        granularity="one id per OCCURRENCE; a word-keyed map is refused"),
    route="OUTSIDE", status="PERMANENT",
    why=("two identical strings are identical in every channel a phonology "
         "reads; the sense is carried by neither the letters nor the sound. "
         "Without a sense oracle antanaclasis is INDISTINGUISHABLE FROM "
         "REPETITION by construction, and this project holds nothing semantic "
         "on the writing path at all (MISSING.md H-1). The refusal is the "
         "finished capability"),
    residue="",
    reference="RHYME_COVERAGE.md §5; MISSING.md H-1",
    probe=lambda: antanaclasis((3, 6), (3, 9), "light", "light")))

_add(Family(
    code="R4", name="rhyming slang",
    needs=InputSpec(
        field="a referent chain, pair-keyed",
        type_="SlangRegister(elisions={clipped: phrase}, "
              "expansions={phrase: referent}, tradition, source)",
        example="SlangRegister(elisions={'plates': 'plates of meat'}, "
                "expansions={'plates of meat': 'feet'}, "
                "tradition='Cockney rhyming slang', source='<glossary>')",
        constructor="declared_inputs.declare(SlangRegister(...))",
        granularity="per phrase; the register is NOT transitive"),
    route="OUTSIDE", status="PERMANENT",
    why=("the constitutive member is ABSENT FROM THE TEXT. 'plates of meat' "
         "rhymes 'feet' and 'feet' is never written; the productive form clips "
         "the rhyming word away as well, so the surface carries neither the "
         "referent nor the rhyme. No reading of a text recovers a word that is "
         "not in it, and (RHYME_COVERAGE.md M8) an attested-pair register is "
         "not transitive, so no per-member surface or quotient reproduces it"),
    residue="",
    reference="RHYME_COVERAGE.md §5, M8",
    probe=lambda: rhyming_slang("plates", "feet")))

_add(Family(
    code="R5", name="offbeat rhyme",
    needs=InputSpec(
        field="a beat grid and a syllable-to-beat map",
        type_="BeatGrid(cycle=meter.Cycle(...with groups...), "
              "positions={(line, syl): Fraction}, derived_from, tempo_bpm, "
              "source)",
        example="BeatGrid(cycle=Cycle(pulses=7, unit=8, groups=(2,2,3)), "
                "positions={(0, 4): Fraction(3)}, derived_from='audio', "
                "source='<onset analysis>')",
        constructor="declared_inputs.declare(BeatGrid(...))",
        granularity="per syllable, in pulses from the cycle origin"),
    route="OUTSIDE", status="PERMANENT",
    why=("there is no audio, so isochrony is an assumed coordinate and 'on the "
         "beat' is not a claim this project can make (CLAUDE.md doctrine 4). "
         "A DECLARED grid is an input, never a measurement: it can be accepted "
         "and it cannot be computed. What IS scheduled is only the plumbing — "
         "MISSING.md G-1's syllable-to-beat map and a bar value in the frame — "
         "and calling that 'closing the gap' would be the schedule-for-an-"
         "impossibility error. Every verdict from an asserted grid carries "
         "`conditional_on` saying so"),
    residue="",
    reference="RHYME_COVERAGE.md §5; MISSING.md C-4, C-5, G-1; doctrine 4",
    probe=lambda: offbeat((0, 4))))

_add(Family(
    code="R6", name="tone-contour rhyme",
    needs=InputSpec(
        field="a tone channel (and, separately, a contour map)",
        type_="ToneChannel(tones={word: (label, ...)}, "
              "contours={label: shape}, system, source)",
        example="ToneChannel(tones={'樓': ('平',), '侯': ('平',)}, "
                "system='Middle Chinese 四聲', source='data/qieyun_mc.tsv "
                "(CC0)') — contours left EMPTY, so level='contour' refuses",
        constructor="declared_inputs.declare(ToneChannel(...))",
        granularity="per syllable; contours keyed by category label"),
    route="SWAPPABLE_PHONOLOGY", status="SCHEDULED",
    why=("`Syllable` has text/onset/nucleus/coda/prominence/moras and no tone "
         "field, so a tone language's rhyme constraint has nowhere to live "
         "(MISSING.md F-2). The information itself is reachable: Vietnamese "
         "and Yoruba WRITE tone in the orthography, Cantonese needs a lexicon, "
         "and ltc.py already spends `prominence` on the 平/仄 class"),
    blocked_on=("a `tone` field on quality.phonology.Syllable plus a "
                "tone-bearing phonology module — the same shape of work as the "
                "eight existing ones, and cheap for the languages that write "
                "tone"),
    residue=("PERMANENT for the CONTOUR half wherever the language is "
             "reconstructed: a tone CATEGORY is not a contour, two categories "
             "can share one, and the Middle Chinese contours are themselves "
             "reconstructions. `level='category'` answers; `level='contour'` "
             "refuses until a sourced map is declared, and for a dead language "
             "that map is never a measurement"),
    reference="RHYME_COVERAGE.md §5; MISSING.md F-2; doctrine 35, 36",
    probe=lambda: tone_rhyme("樓", "侯")))


# ---------------------------------------------------------------------------
# SURVEY
# ---------------------------------------------------------------------------


def attempt(fn, *args, **kwargs):
    """Run a decision and return a `Refusal` instead of raising.

    For a caller surveying what is answerable. The Refusal still cannot be
    tested as a boolean, so a survey cannot degrade into a row of Falses.
    """
    try:
        return fn(*args, **kwargs)
    except MissingDeclaredInput as e:
        return Refusal(e.family, e.missing, e.detail)


def probe_all():
    """-> {code: Verdict | Refusal}. Runs every family with what is declared
    right now. On an empty registry this is six refusals, which is the honest
    state of the boundary."""
    return {c: attempt(f.probe) for c, f in sorted(FAMILIES.items())}


def scheduled():
    return [f for f in FAMILIES.values() if f.status == "SCHEDULED"]


def permanent():
    return [f for f in FAMILIES.values() if f.status == "PERMANENT"]


def capability_report():
    """The boundary, in one page, with each refusal actually fired."""
    out = ["THE SIX DECLARED-INPUT FAMILIES (RHYME_COVERAGE.md §2, R1-R6)",
           "=" * 70,
           "not computable from text + phonology by any route; each accepts a",
           "declared input and each refuses BY NAME without one.", ""]
    for code, f in sorted(FAMILIES.items()):
        got = attempt(f.probe)
        state = ("REFUSES: needs " + f.needs.field
                 if isinstance(got, Refusal) else "ANSWERS: " + got.describe())
        out += [f"{code} · {f.name}   [{f.status} / {f.route}]",
                f"    needs     {f.needs.field}: {f.needs.type_}",
                f"    example   {f.needs.example}",
                f"    keyed     {f.needs.granularity}",
                f"    why       {f.why}"]
        if f.blocked_on:
            out.append(f"    waiting   {f.blocked_on}")
        if f.residue:
            out.append(f"    residue   {f.residue}")
        out += [f"    now       {state}",
                f"    see       {f.reference}", ""]
    out += ["-" * 70,
            f"SCHEDULED  {', '.join(f.code for f in scheduled())} — work "
            f"exists that ends the refusal for every caller.",
            f"PERMANENT  {', '.join(f.code for f in permanent())} — the "
            f"refusal IS the capability; a declaration ends it for one case "
            f"and never in general.",
            "Conflating the two makes a schedule out of an impossibility and "
            "an impossibility out of a schedule."]
    return "\n".join(out)


__all__ = ["ROUTES", "STATUSES", "DeclaredInputError", "MissingDeclaredInput",
           "Undecided", "Refusal", "Verdict", "InputSpec", "Family",
           "Orthography", "PeriodPhonology", "SenseAnnotation",
           "SlangRegister", "BeatGrid", "ToneChannel", "FAMILIES", "DECLARED",
           "declare", "get_declared", "withdraw", "clear_declarations",
           "PERIOD_PHONOLOGIES", "register_period", "get_period",
           "eye_rhyme", "historical_rhyme", "antanaclasis", "rhyming_slang",
           "offbeat", "tone_rhyme", "attempt", "probe_all", "scheduled",
           "permanent", "capability_report"]


if __name__ == "__main__":
    print(capability_report())
