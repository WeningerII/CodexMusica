#!/usr/bin/env python3
"""Does the line FIT the bar? — the DECLARED layer, and only the declared layer.

WHAT WAS MISSING

`quality/meter.py` can express a metric cycle exactly: .125/1 through 64/32,
fractional numerators, non-power-of-two denominators, ordered groupings, tālas,
usuls, colotomic cycles. `quality/grid.py` places a line at a bar and a beat and
gives it a duration. **Nothing joined a line's SYLLABLES to the pulses of the
bar it sits in.** So the harness could say a section was fourteen bars of 7/8 as
3+2+2 and could not say whether nine syllables would go in one of those bars,
where they would crowd, or which of them could reach a group head.

That is MISSING.md G-1 (no syllable-to-beat mapping), G-2 (no prosodic fit) and
G-3 (meter templates unconnected to the bar grid). It is also why a real
bar-grid blueprint was gradeable only on rhyme: its `beat` and `duration`
fields were declared by hand and read by nothing, so setting every second
line to an anacrusis cleared `DOWNBEAT_LOCKED` without any check that the
syllables could land there. An inert declared coordinate is the
defect this repo has now found five times — `Span.unit`, `SpanRule.terminator`,
`RelationSchema.traditions`, `search_k`, and these two. Here they drive the
arithmetic or they raise.

THE CONSTRAINT, WHICH IS THE INTERESTING PART

**There is no audio and no tempo.** Doctrine 4 is explicit that isochrony is an
ASSUMED coordinate here, not a measurement, and that "on the beat" is not a
claim this project can make; MISSING.md C-5 records that `Song` has bars and
meters and no tempo. So this module is not a beat detector and contains no
onset analysis. It answers one shape of question:

    GIVEN a line, a declared cycle, and a declared placement — how many grid
    units must be accommodated, over how many pulses, at what density, and
    WHERE does the declaration become unsatisfiable?

Every quantity below is a function of the declaration. Anything that would need
a performance is refused by name, in the shape `quality/declared_inputs.py` R5
already uses: the refusal states the missing input, its type, an example that
would satisfy it, and whether the gap is scheduled work or a permanent
boundary — because a caller who reads PERMANENT should stop waiting.

THE THREE TIERS, AND KEEPING THEM APART IS THE POINT

  1. UNCONDITIONAL — true under any setting whatever, by counting.
     Pigeonhole is the whole of it and it is stronger than it looks: a line
     with six prominent syllables in a span covering three group heads has at
     least three prominent syllables off a head NO MATTER HOW IT IS SUNG.
     `PROMINENCE_EXCEEDS_HEADS` and `HEADS_EXCEED_UNITS` are of this kind.

  2. CONDITIONAL ON A DECLARED SUBDIVISION — a `Subdivision` says how many
     slots a pulse carries. With one, "does the declared start sit on a slot"
     and "can every prominent unit reach a head" become decidable; without
     one they are REFUSED, because the answer is a function of a coordinate
     nobody supplied. This is where a declared anacrusis gets checked: the
     blueprint's 7/8 pickups sit at beat 6.5 of an eighth-note pulse, which is
     a SIXTEENTH-note position, and at `Subdivision(1)` they are off-grid.

  3. CONDITIONAL ON A SETTING — which unit sits on which slot. That is a
     `BeatGrid` (R5's declared input) or an explicit `Isochrony` assumption,
     and every verdict computed from the latter carries `conditional_on`
     saying so. Nothing here derives a setting from the text.

PROMINENCE IS NOT ALWAYS STRESS (doctrine 35)

The unit that must be accommodated is `Phonology.grid_unit`, which is declared
per language: the syllable for English, Welsh, Finnish and Middle Chinese, the
MORA for Somali, Persian and Sanskrit. This module counts in whatever the
phonology declares and says which in its output.

`prominence` is read the same way and is never called stress. `som` has pitch
accent and `prominences()` raises rather than returning a pattern; `msa` and
`fas` raise for their own reasons; `ltc`'s binary is 平/仄, which is what
regulated verse constrains and is not stress at all. So a head-alignment
finding here carries the phonology's own `prominence_rule` verbatim in its
evidence, and where the phonology refuses, so does this. A module that returned
a plausible stress pattern for Somali or Middle Chinese would produce numbers
nobody could catch, which is the doctrine.

AN UNDECLARED GROUPING IS REFUSED, NOT GUESSED (doctrine 19)

Which pulses are BEATS is exactly what an ordered composition of the pulse count
declares, and there are 2^(n-1) of them. `Cycle.pulse_groups()` returns None
rather than asserting one and `conventional_grouping()` is labelled a
convention; every head question here returns a `FitRefusal` on a cycle that
declares no grouping. Three of the seven sections of the shipped example declare
none, so seventeen of its forty-one lines get no head finding at all. That is
the correct output, not a shortfall.

WHAT REMAINS IMPOSSIBLE HERE

Anything per SECOND. A note VALUE is declared — `Cycle.note_value` is exact
because `unit` is — and a note DURATION is not, because there is no tempo. So
"syllables per second", "too fast to sing", "the pickup is 200 ms" and every
groove question in MISSING.md C-4 (pushes, pulls, laid-back placement,
syncopation as a measurement rather than as a declared offset) are refused
permanently and by name, not approximated.

Run: python3 quality/fit.py quality/fixtures/mandate_song.blueprint.json
"""

import json
import math
import os
import re
import sys
from dataclasses import dataclass, field
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.join(HERE, "..") not in sys.path:
    sys.path.insert(0, os.path.join(HERE, ".."))

from quality.meter import Cycle  # noqa: E402

# ---------------------------------------------------------------------------
# REFUSALS — the same discipline as quality/declared_inputs.py, one layer over
# ---------------------------------------------------------------------------

_NOT_A_NEGATIVE = (
    "This is a refusal, not a verdict: 'I was not given what I would need to "
    "tell' is not 'the line does not fit'.")

#: route/status carry the same meaning as `declared_inputs.Family`:
#: SCHEDULED work ends the refusal for every caller; PERMANENT means a
#: declaration ends it for one line, one placement, one performance, and never
#: in general.
STATUSES = ("SCHEDULED", "PERMANENT")


class FitError(Exception):
    """Base for everything this module raises."""


class Refused(FitError):
    """A fit question was asked and a declared input for it is absent."""


@dataclass(frozen=True)
class FitRefusal:
    """The non-raising carrier of a refusal, for callers doing a survey.

    `bool()` RAISES, exactly as `declared_inputs.Refusal.__bool__` does: the
    single line that would quietly turn "not given the coordinate" into "does
    not fit" — `if not r:` — is made impossible rather than discouraged.
    """
    code: str
    question: str
    missing: str
    detail: str = ""
    status: str = "SCHEDULED"
    ends_with: str = ""

    def __post_init__(self):
        if self.status not in STATUSES:
            raise ValueError(f"status must be one of {STATUSES}")
        if self.status == "SCHEDULED" and not self.ends_with:
            raise ValueError(
                f"{self.code} is SCHEDULED and names no work that would end "
                f"it. A schedule with nothing on it is an impossibility "
                f"wearing a date.")

    def render(self):
        out = [f"{self.code}: NOT ANSWERED — {self.question}",
               f"  ABSENT  {self.missing}"]
        if self.detail:
            out.append(f"  NOTE    {self.detail}")
        out.append(f"  STATUS  {self.status}")
        if self.ends_with:
            out.append(f"  ENDS BY {self.ends_with}")
        out.append(f"  {_NOT_A_NEGATIVE}")
        return "\n".join(out)

    def __bool__(self):
        raise Refused(self.render() + "\n  (a FitRefusal was used in a "
                                      "boolean test)")

    def raise_(self):
        raise Refused(self.render())

    def __str__(self):
        return self.render()


def _no_tempo(question):
    """The one refusal that is PERMANENT for every caller and every language."""
    return FitRefusal(
        "NO_TEMPO", question,
        missing="a tempo, and a tempo map for any change in it",
        detail=("MISSING.md C-5: `Song` carries bars and meters and no tempo. "
                "A note VALUE is declared here and exact — `Cycle.note_value` "
                "reads the declared `unit` — but a note DURATION is a value "
                "times a tempo, and there is none. There is also no audio, so "
                "the tempo cannot be recovered: doctrine 4 records that "
                "isochrony is an assumed coordinate here and 'on the beat' is "
                "not a claim this project can make."),
        status="PERMANENT")


# ---------------------------------------------------------------------------
# WHAT MUST BE ACCOMMODATED — counted in the phonology's own declared unit
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Unit:
    """One grid unit of a line, in order.

    `prominence` is 1 / 0 / None and None means the phonology declined to say —
    a refusal, never a zero (doctrine 35). `moras` is carried because a
    quantitative tradition's grid unit is the mora and not the syllable.
    """
    index: int
    text: str
    word: str
    widx: int
    prominence: object = None
    moras: int = 1

    @property
    def prominent(self):
        return self.prominence == 1


@dataclass(frozen=True)
class RefusedToken:
    """A token of the line that contributed NOTHING to the count, and why.

    Doctrine 79: a refusal is not a failure and it does not belong in the
    numerator. A line with an unreadable word has a syllable count that is a
    LOWER BOUND, and saying so is the difference between a measurement and a
    number.
    """
    token: str
    cause: str
    detail: str = ""


@dataclass(frozen=True)
class LineUnits:
    """The demand side: what this line's text asks the bar to hold."""
    text: str
    units: tuple = ()
    refused: tuple = ()
    tokens: tuple = ()
    grid_unit: str = "syllable"
    unit_name: str = "syllable"
    prominence_rule: str = ""
    language: str = ""
    prominence_refusal: object = None    # FitRefusal, or None

    @property
    def syllables(self):
        return len(self.units)

    @property
    def count(self):
        """The count in the phonology's DECLARED grid unit."""
        if self.unit_name == "mora":
            return sum(int(u.moras) for u in self.units)
        return len(self.units)

    @property
    def prominent(self):
        return tuple(u for u in self.units if u.prominent)

    @property
    def prominence_undecided(self):
        return tuple(u for u in self.units if u.prominence is None)

    @property
    def certain(self):
        """True when every token of the line was read. False makes `count` a
        LOWER BOUND and every density derived from it one too."""
        return not self.refused

    def pattern(self):
        """The declared prominence pattern. '/' prominent, '.' not, '?' the
        phonology declined. NOT a stress string unless the phonology's
        `prominence_rule` says stress is what it holds."""
        return "".join("?" if u.prominence is None
                       else ("/" if u.prominence == 1 else ".")
                       for u in self.units)


_WORDISH = re.compile(r"[^\W\d_]+(?:['’‑-][^\W\d_]+)*", re.UNICODE)
_HAS_DIGIT = re.compile(r"\d")


def _chunks(text, strip_parens=True):
    """Whitespace chunks with edge punctuation stripped.

    `strip_parens=True` (the default) drops parentheticals entirely, the way
    `lyric_harness.line_tokens` does -- see that function's docstring for why
    this is a declared coordinate rather than a fixed rule: the same `(...)`
    means a non-sung aside in this repo's own corpus/song/ and real sung
    words in a second voice under voice-attribution notation. `False` keeps
    the words; the edge-punctuation strip below already peels a lone `(`/`)`
    off a chunk that starts or ends with one, so a whole-line parenthetical
    like `(we'll sing along)` reads its words normally once the blanket
    erasure is skipped."""
    t = re.sub(r"\([^)]*\)", " ", str(text)) if strip_parens else str(text)
    out = []
    for raw in t.split():
        s = raw.strip("\"'‘’“”.,;:!?()[]{}—–-")
        if s:
            out.append(s)
    return out


def _resolve_prominence(p):
    """A channel may hold a `Readings` (quality/phonology KNOWLEDGE SETS). Two
    readings that disagree are UNDECIDED, which is None — never a pick."""
    if isinstance(p, frozenset):
        vals = set(p)
        return vals.pop() if len(vals) == 1 else None
    return p


def _probe_prominence(phon):
    """-> FitRefusal when the phonology declines a prominence pattern.

    Asked of the phonology rather than assumed: `som` raises because Somali has
    pitch accent and quantitative metre, `msa` because Malay stress is
    contested, `fas` because ʿarūż counts moras. Their own words are carried
    into the refusal, because they are the ones that know why.
    """
    try:
        phon.prominences("a")
    except Exception as exc:                       # noqa: BLE001
        if type(exc).__name__ == "Unsupported":
            return FitRefusal(
                "PROMINENCE_DECLINED",
                f"which units of this line are prominent, in {phon.language}",
                missing=f"{phon.language} declines a prominence pattern",
                detail=(f"{exc} — doctrine 35: prominence is not always "
                        f"stress, and faking it is invisible in the numbers. "
                        f"The grid unit this phonology declares is "
                        f"{phon.grid_unit!r}."),
                status="PERMANENT")
    except BaseException:                          # pragma: no cover
        raise
    return None


def read_line(text, phon=None, strip_parens=True):
    """-> LineUnits. What the line asks the bar to hold, and what it could not
    read.

    The ENGLISH path goes through `lyric_harness.word_syllable_map` rather than
    `quality.phonology.eng.syllabify`, because the WEAK_ALWAYS / WEAK_NONFINAL
    demotion is a PHRASE-level rule and the per-word entry point cannot see
    phrase position. Doctrine 46: a function-word list is part of a phonology,
    not an optimisation, and without it every English monosyllable reads as
    prominent — which would put a spurious accent on every `the` in this song.
    (Its proper home is a `line_syllables` method on `eng`; that file is not
    owned by this cell, and the patch is in the round's scratch.)

    A phonology that grows such a method is used through it: the hook is
    `phon.syllabify_line(text) -> [Syllable]` and nothing here needs to change.

    THE HOOK IS NOT CALLED `line_syllables`, AND THE NEAR-MISS IS THE POINT.
    `msa.line_syllables` already exists and returns an INT — the pantun's
    syllable COUNT, or None when a word is unreadable. A duck-typed hook of
    that name would have iterated an integer for Malay and crashed, or worse,
    read a count where it wanted syllables. Duck typing keys on a name, so a
    name that is already taken elsewhere in the same package is a collision
    waiting for the one caller that meets it; this one met it on its first run
    over all nine declared phonologies.

    `strip_parens` -- see `_chunks`/`lyric_harness.line_tokens`, whose
    declaration this shares.
    """
    from quality import phonology as PH
    phon = phon or PH.get("eng")
    unit_name = "mora" if str(phon.grid_unit).startswith("mora") else "syllable"
    prom_refusal = _probe_prominence(phon)

    chunks = _chunks(text, strip_parens=strip_parens)
    refused = []
    for c in chunks:
        if _HAS_DIGIT.search(c):
            refused.append(RefusedToken(
                c, "NUMERAL",
                "a numeral is sung as a word and `lyric_harness.line_tokens` "
                "matches [A-Za-z'-]+, so it contributes no syllables and "
                "raises no refusal. The count without it is a LOWER BOUND."))

    units = []
    if hasattr(phon, "syllabify_line"):
        sylls = phon.syllabify_line(text)
        for i, s in enumerate(sylls):
            units.append(Unit(i, getattr(s, "text", ""), getattr(s, "text", ""),
                              -1, _resolve_prominence(getattr(s, "prominence",
                                                              None)),
                              getattr(s, "moras", 1) or 1))
    elif getattr(phon, "language", "") == "eng":
        import lyric_harness as _lh
        lex = _english_lexicon(strip_parens=strip_parens)
        for k, s in enumerate(_lh.word_syllable_map(lex, text)):
            units.append(Unit(k, s.get("nucleus", ""), s["word"], s["widx"],
                              1 if s["stress"] in (1, 2) else 0, 1))
        for tok in phon.unreadable(text):
            refused.append(RefusedToken(
                tok, "OUT_OF_LEXICON",
                f"{phon.name} could not read it, so it contributed no "
                f"{unit_name}s. Known gap 1 (G2P for OOV)."))
    else:
        k = 0
        for c in chunks:
            if not _WORDISH.fullmatch(c):
                continue
            try:
                sylls = phon.syllabify(c)
            except Exception:                      # noqa: BLE001
                sylls = []
            if not sylls:
                refused.append(RefusedToken(
                    c, "UNREADABLE",
                    f"{getattr(phon, 'name', phon.language)} returned no "
                    f"syllables. Empty is a refusal, not a zero-syllable "
                    f"word."))
                continue
            for s in sylls:
                units.append(Unit(
                    k, getattr(s, "text", ""), c, -1,
                    # `is not None`, not a truth test: FitRefusal.__bool__
                    # RAISES, and it caught this very line during development.
                    # That is the design working, one layer earlier than the
                    # caller it was written for.
                    None if prom_refusal is not None else
                    _resolve_prominence(getattr(s, "prominence", None)),
                    _resolve_prominence(getattr(s, "moras", 1)) or 1))
                k += 1

    if prom_refusal is not None:
        units = [Unit(u.index, u.text, u.word, u.widx, None, u.moras)
                 for u in units]

    return LineUnits(
        text=str(text), units=tuple(units), refused=tuple(refused),
        tokens=tuple(chunks), grid_unit=str(phon.grid_unit),
        unit_name=unit_name,
        prominence_rule=str(getattr(phon, "prominence_rule", "")),
        language=str(getattr(phon, "language", "")),
        prominence_refusal=prom_refusal)


_LEX = {}


def _english_lexicon(strip_parens=True):
    """Cached per `strip_parens` value, not a single global -- a Lexicon
    built with the wrong `strip_parens` silently ignores `read_line`'s own
    parameter of that name, which is exactly the bug this replaced: `_LEX`
    used to be one instance built with the constructor default (`True`),
    reused for every call regardless of what `read_line`/`_chunks` were
    told, so a whole-line-parenthetical read through `--voices` still lost
    every word here even though `_chunks` (used only for the numeral scan)
    kept them. See `word_syllable_map`, which is what actually turns this
    Lexicon's `.strip_parens` into syllables for the ENGLISH path below."""
    lex = _LEX.get(strip_parens)
    if lex is None:
        import lyric_harness as _lh
        lex = _lh.Lexicon(strip_parens=strip_parens)
        _LEX[strip_parens] = lex
    return lex


# ---------------------------------------------------------------------------
# THE DECLARED PLACEMENT — where `Line.bar`, `Line.beat` and `Line.duration` go
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Placement:
    """A line's declared coordinates, resolved against a declared cycle.

    Every position below is measured in PULSES from the SECTION's first
    downbeat, and deliberately not from the song's. Pulses are only
    commensurable inside one meter: a 7/8 pulse is an eighth note and a 5/4
    pulse is a quarter, so a song-absolute pulse count across a meter change
    would be a number with two units in it.

    `beat` is 1-based within the bar and may be fractional; it may also be <= 0
    to express a pickup before the section's first downbeat, which is what
    `grid.Line` documents. `duration` is in pulses.
    """
    cycle: object
    bar: int
    beat: Fraction = Fraction(1)
    duration: Fraction = Fraction(4)
    section: str = ""
    section_start_bar: int = 1
    section_bars: object = None
    text: str = ""

    def __post_init__(self):
        object.__setattr__(self, "beat", _frac(self.beat))
        object.__setattr__(self, "duration", _frac(self.duration))
        object.__setattr__(self, "bar", int(self.bar))
        if not hasattr(self.cycle, "group_starts"):
            raise ValueError(
                "Placement.cycle must be a quality.meter.Cycle — the period "
                "AND whatever grouping is declared for it. A bare pair of "
                "integers does not say which pulses are beats.")

    # -- the arithmetic the two inert fields now drive ----------------------

    @property
    def pulses(self):
        return Fraction(self.cycle.pulses)

    @property
    def start(self):
        """0-based pulse offset from the section's first downbeat."""
        return (self.bar - self.section_start_bar) * self.pulses + \
            (self.beat - 1)

    @property
    def end(self):
        return self.start + self.duration

    @property
    def section_pulses(self):
        return None if self.section_bars is None else \
            Fraction(self.section_bars) * self.pulses

    @property
    def bars_spanned(self):
        return self.duration / self.pulses

    @property
    def start_subdivision(self):
        """The pulse subdivision the declared start REQUIRES.

        `beat` 6.5 is offset 11/2 pulses, whose denominator is 2, so the start
        sits on a half-pulse. In 7/8 the pulse is already an eighth note, so
        that is a SIXTEENTH-note position — a fact the declaration has always
        contained and nothing has ever read.
        """
        return (self.beat - 1).denominator

    @property
    def start_note_value(self):
        """The note value of the grid the declared start lands on, in whole
        notes. Exact, and NOT a duration — see `_no_tempo`."""
        return self.cycle.note_value(Fraction(1, self.start_subdivision))

    @property
    def pickup(self):
        """Pulses from the declared start to the next barline. 0 when the line
        starts on one."""
        p = self.pulses
        nxt = Fraction(math.ceil(self.start / p)) * p
        return nxt - self.start

    @property
    def is_anacrusis(self):
        """A start off the barline whose span crosses the NEXT one. `beat != 1`
        alone is not an anacrusis: a line entering on beat 3 and stopping
        before the barline is a late entry, not a pickup."""
        pk = self.pickup
        return pk > 0 and pk < self.duration

    def heads(self):
        """Group-head pulses inside the span -> tuple, or a FitRefusal.

        Refuses on an undeclared grouping and on a polycentric cycle, and the
        two are different refusals: the first has not said which composition,
        the second has said there is no privileged beat 1 to compose from.
        """
        if getattr(self.cycle, "polycentric", False):
            return FitRefusal(
                "POLYCENTRIC_CYCLE",
                "which pulses of this span are group heads",
                missing="a canonical origin; this cycle declares origin=None",
                detail=("a polycentric cycle has no privileged beat 1, so "
                        "'the head of the bar' is not a position it holds. "
                        "Each part carries its own phase reference and a "
                        "single head list would assert one of them over the "
                        "others."),
                status="PERMANENT")
        h = self.cycle.heads_between(self.start, self.end)
        if h is None:
            n = int(self.pulses) if self.pulses.denominator == 1 else None
            space = f"2^(n-1) = {2 ** (n - 1)}" if n else "2^(n-1)"
            return FitRefusal(
                "UNDECLARED_GROUPING",
                "which pulses of this span are group heads",
                missing=f"an ordered grouping for {self.cycle.signature}",
                detail=(f"which pulses are BEATS is exactly the ordered "
                        f"composition of the pulse count, and there are "
                        f"{space} of them. `Cycle.pulse_groups()` returns None "
                        f"rather than asserting one and "
                        f"`conventional_grouping()` is labelled a convention "
                        f"(doctrine 19); this refuses for the same reason. "
                        f"Declare `groups` on the section's meter."),
                ends_with="declaring the grouping on the section's meter — a "
                          "declaration, not a measurement")
        return h

    def describe(self):
        return (f"{self.section or '?'} bar {self.bar} beat {_num(self.beat)} "
                f"for {_num(self.duration)} pulses of "
                f"{self.cycle.signature}"
                + (f" as {tuple(self.cycle.groups)}"
                   if self.cycle.groups else " (grouping undeclared)"))


def _frac(x):
    if isinstance(x, Fraction):
        return x
    if isinstance(x, float):
        return Fraction(str(x))
    return Fraction(x)


def _num(f):
    f = Fraction(f)
    return str(f.numerator) if f.denominator == 1 else \
        (f"{float(f):g}" if f.denominator in (2, 4, 8, 16) else str(f))


def _grain(denom):
    """'the pulse itself' / 'a half-pulse' / 'a 1/3 of a pulse'."""
    if denom == 1:
        return "the pulse itself"
    if denom == 2:
        return "a half-pulse"
    return f"a 1/{denom} of a pulse"


def _pos(placement, pulse):
    """A section-relative pulse rendered as bar and beat, which is the
    coordinate the blueprint is written in."""
    P = Fraction(placement.pulses)
    pulse = Fraction(pulse)
    bar = placement.section_start_bar + int(pulse // P)
    return f"b{bar}.{_num(pulse % P + 1)}"


# ---------------------------------------------------------------------------
# THE TWO DECLARED COORDINATES A FIT MAY BE CONDITIONED ON
# ---------------------------------------------------------------------------


class _Sourced:
    """Every declaration here refuses at construction without a `source`.

    The same rule as `meter.register_named` and `declared_inputs._Sourced`: a
    coordinate written from memory is unsourced data in the evidence base, and
    these objects are passed straight into decision functions, so the check has
    to be at construction or it can be walked around.
    """

    def _check_source(self):
        if not getattr(self, "source", ""):
            raise ValueError(
                f"{type(self).__name__} has no source. Say where the "
                f"coordinate came from — a score, an arrangement, a decision "
                f"somebody made — or leave the slot empty and take the "
                f"refusal.")


@dataclass(frozen=True)
class Subdivision(_Sourced):
    """How many SLOTS a pulse carries. A declared coordinate, never inferred.

    A pulse is not the smallest thing a syllable can sit on, and how much
    smaller is a property of the setting rather than of the meter. With this
    declared, "is the declared start on a slot" and "can every prominent unit
    reach a group head" become decidable; without it they are refused, which
    is the honest answer rather than an assumed sixteenth-note grid.
    """
    slots_per_pulse: int = 1
    source: str = ""

    def __post_init__(self):
        self._check_source()
        if int(self.slots_per_pulse) < 1:
            raise ValueError("slots_per_pulse must be >= 1")

    @property
    def s(self):
        return int(self.slots_per_pulse)


@dataclass(frozen=True)
class Isochrony(_Sourced):
    """The ASSUMPTION that a line's units divide its span evenly.

    Declared, never default, and every verdict computed through it is stamped
    `conditional_on`. Doctrine 4: isochrony is an assumed coordinate in this
    project and not a measurement, so this is a way of SAYING the assumption
    out loud, not a way of making it true. Real settings are not isochronous;
    what this answers is what an even division would demand.
    """
    source: str = ""

    def __post_init__(self):
        self._check_source()

    CONDITION = ("a DECLARED ISOCHRONOUS setting — the units are assumed to "
                 "divide the span evenly. There is no audio, so this is an "
                 "assumed coordinate and not a measurement (doctrine 4)")


# ---------------------------------------------------------------------------
# FINDINGS
# ---------------------------------------------------------------------------


#: A finding's KIND, and the distinction is load-bearing.
#:
#:   placement   the declaration contradicts itself — a beat the bar does not
#:               have, a span that leaves its section, more units than the
#:               declared subdivision has slots. `satisfiable` is False here
#:               and ONLY here.
#:   density     an arithmetic consequence of the counts. Crowding is not a
#:               violation: a pulse subdivides, and this says by how much it
#:               would have to.
#:   prominence  a fact about the declared prominence against the declared
#:               grouping. NOT a violation either, and this is the honesty
#:               that matters: nobody declared "every prominent unit sits on a
#:               group head". That is a norm of some repertoires and the
#:               opposite of the point in others, and doctrine 6 says the
#:               exchange rate belongs in a declaration rather than in this
#:               file. So the finding reports the pigeonhole bound and stops.
#:   setting     produced only from a declared setting or a declared
#:               assumption, and always carrying `conditional_on`.
KINDS = ("placement", "density", "prominence", "setting")


@dataclass(frozen=True)
class FitFinding:
    """A named cause, never a score.

    `satisfiable=False` means the DECLARATION cannot be met — under any setting
    when `conditional_on` is empty, and under the stated coordinate when it is
    not. Doctrine 6: the features stay a vector and there is no exchange rate
    between them to sum, so nothing here adds up.
    """
    code: str
    message: str
    evidence: str = ""
    kind: str = "density"
    satisfiable: bool = True
    conditional_on: str = ""
    line: object = None

    def __post_init__(self):
        if self.kind not in KINDS:
            raise ValueError(f"kind must be one of {KINDS}")
        if not self.satisfiable and self.kind != "placement":
            raise ValueError(
                f"{self.code} is kind {self.kind!r} and claims the "
                f"declaration is unsatisfiable. Only a PLACEMENT finding may: "
                f"a density or a prominence count is a measurement of the "
                f"declaration, not a contradiction in it, and calling one "
                f"unsatisfiable would smuggle in a norm nobody declared.")

    def __str__(self):
        head = f"[{self.code}]"
        if not self.satisfiable:
            head += " UNSATISFIABLE"
        s = f"{head} {self.message}\n    {self.evidence}"
        if self.conditional_on:
            s += f"\n    CONDITIONAL ON: {self.conditional_on}"
        return s


# ---------------------------------------------------------------------------
# THE FIT
# ---------------------------------------------------------------------------


@dataclass
class LineFit:
    """One line against one bar, and everything that follows from that alone."""
    units: LineUnits
    placement: Placement
    findings: list = field(default_factory=list)
    refusals: list = field(default_factory=list)
    heads: object = None                 # tuple of pulses, or FitRefusal
    slots: object = None                 # int, or FitRefusal
    max_prominent_on_heads: object = None
    isochronous_positions: tuple = ()

    # -- the quantities, all exact ------------------------------------------

    @property
    def count(self):
        return self.units.count

    @property
    def pulses(self):
        return self.placement.duration

    @property
    def per_pulse(self):
        return Fraction(self.count, 1) / self.pulses if self.pulses else None

    @property
    def per_bar(self):
        b = self.placement.bars_spanned
        return Fraction(self.count, 1) / b if b else None

    @property
    def required_subdivision(self):
        """The smallest slots-per-pulse that holds one unit per slot."""
        if self.pulses <= 0:
            return None
        return math.ceil(Fraction(self.count, 1) / self.pulses)

    @property
    def even_division(self):
        """Whole notes per unit IF the span were divided evenly. Exact, and
        conditional on an assumption nobody has to accept — see `Isochrony`."""
        if not self.count:
            return None
        return self.placement.cycle.note_value(self.pulses) / self.count

    @property
    def satisfiable(self):
        """False when the DECLARATION contradicts itself. Never False because
        the line is crowded or its stresses miss the group heads — those are
        counts, and calling them failures is a norm nobody declared."""
        return all(f.satisfiable for f in self.findings)

    @property
    def unsatisfiable_causes(self):
        return [f for f in self.findings if not f.satisfiable]

    @property
    def unconditional_failures(self):
        """The placement contradictions that hold with no extra coordinate at
        all — as opposed to the ones conditional on a declared subdivision."""
        return [f for f in self.findings
                if not f.satisfiable and not f.conditional_on]

    @property
    def prominence_findings(self):
        return [f for f in self.findings if f.kind == "prominence"]

    def describe(self):
        u = self.units
        bound = "" if u.certain else "  (LOWER BOUND — see refusals)"
        if not u.units:
            return "\n".join(
                [self.placement.describe(), f"  {u.text!r}",
                 "  count REFUSED — nothing in the line was read, so it is "
                 "unknown and not 0"]
                + ["  " + r.render().replace("\n", "\n  ")
                   for r in self.refusals])
        dens = ("no density: the declared duration is not positive"
                if self.per_pulse is None else
                f"= {_num(self.per_pulse)} per pulse, "
                f"{_num(self.per_bar)} per bar")
        out = [f"{self.placement.describe()}",
               f"  {u.text!r}",
               f"  {u.count} {u.unit_name}s over {_num(self.pulses)} pulses "
               f"{dens}{bound}"]
        for f in self.findings:
            out.append("  " + str(f).replace("\n", "\n  "))
        for r in self.refusals:
            out.append("  " + r.render().replace("\n", "\n  "))
        return "\n".join(out)


def _slot_positions(placement, sub):
    """Absolute slot pulses inside the span, anchored to the CYCLE origin.

    Anchored to the cycle and not to the line: a grid that started wherever the
    line started could never report a start as off-grid, which is the one thing
    it is for.
    """
    s = sub.s
    lo = math.ceil(placement.start * s)
    hi = math.ceil(placement.end * s)
    return tuple(Fraction(j, s) for j in range(lo, hi))


def _max_prominent_on_heads(n, prom_idx, slots, is_head):
    """Largest number of prominent units that can sit on a head, over every
    ORDER-PRESERVING assignment of units to distinct slots.

    Order-preserving because a line is sung in its order; distinct because two
    units cannot share a slot at the declared subdivision. Returns None when
    there are not enough slots to hold the units at all.
    """
    S = len(slots)
    if n > S:
        return None
    prom = set(prom_idx)
    # best[i][j] = max hits placing units i.. into slots j..
    NEG = -1
    best = [[NEG] * (S + 1) for _ in range(n + 1)]
    for j in range(S + 1):
        best[n][j] = 0
    for i in range(n - 1, -1, -1):
        for j in range(S - 1, -1, -1):
            skip = best[i][j + 1]
            take = NEG
            if best[i + 1][j + 1] >= 0:
                take = best[i + 1][j + 1] + (1 if (i in prom and is_head(j))
                                             else 0)
            best[i][j] = max(skip, take)
    return best[0][0] if best[0][0] >= 0 else None


def fit_line(text, placement, phon=None, subdivision=None, assume=None,
             beatgrid=None, line_index=None, strip_parens=True):
    """-> LineFit. Everything that follows from the declaration, and refusals
    for everything that does not.

    `subdivision`  a `Subdivision`. Without one, the slot questions refuse.
    `assume`       an `Isochrony`. Without one, no per-unit position is
                   produced and the setting questions refuse.
    `beatgrid`     a `declared_inputs.BeatGrid` — a REAL setting. Preferred
                   over `assume`, and it is the only path that is not
                   conditional on an assumption when its `derived_from` is
                   'audio' or 'notation'.
    `strip_parens` see `read_line`. Ignored when `text` is already a
                   `LineUnits` (the reading already happened).
    """
    units = text if isinstance(text, LineUnits) else \
        read_line(text, phon, strip_parens=strip_parens)
    fit = LineFit(units=units, placement=placement)
    p, c = placement, placement.cycle
    F, R = fit.findings, fit.refusals

    # -- 1. is the declared placement even arithmetic? ----------------------

    if p.duration <= 0:
        F.append(FitFinding(
            "ZERO_DURATION",
            "the declared duration is not positive",
            f"duration {_num(p.duration)} pulses with {units.count} "
            f"{units.unit_name}s to place. `Line.duration` is the field that "
            f"says how much room the line gets; at or below zero it says "
            f"none.", kind="placement", satisfiable=False, line=p.text))
        return fit
    if p.beat >= p.pulses + 1:
        F.append(FitFinding(
            "BEAT_OUTSIDE_CYCLE",
            "the declared beat lies past the end of the bar",
            f"beat {_num(p.beat)} in {c.signature}, whose bar spans "
            f"[1, {_num(p.pulses + 1)}) — {_num(p.pulses)} pulses, 1-based. "
            f"This is `Line.beat` read for the first time; nothing had ever "
            f"checked it against the section's meter. The bound is the "
            f"BARLINE, not the last pulse's number: beat "
            f"{_num(p.pulses)}.5 is the second half of the last pulse and is "
            f"inside the bar — in 4/4 that is the 'and of four', the "
            f"commonest pickup position in popular song, and this test "
            f"declared it nonexistent until 2026-08-11.",
            kind="placement", satisfiable=False, line=p.text))
    if p.start < 0:
        F.append(FitFinding(
            "START_BEFORE_SECTION",
            "the line starts before its section's first downbeat",
            f"start {_num(p.start)} pulses relative to bar "
            f"{p.section_start_bar}. A pickup into the FIRST bar of a section "
            f"has to be carried by the previous section, whose meter may "
            f"differ — so the pulses before the barline are not this cycle's "
            f"pulses.", kind="placement", satisfiable=False, line=p.text))
    if p.section_pulses is not None and p.end > p.section_pulses:
        over = p.end - p.section_pulses
        F.append(FitFinding(
            "OVERRUNS_SECTION",
            "the declared span runs past the section's last barline",
            f"ends {_num(over)} pulses past bar "
            f"{p.section_start_bar + int(p.section_bars) - 1}. The tail sits "
            f"in the next section, whose cycle may be a different note value, "
            f"so the density below is computed on THIS cycle and is not a "
            f"single number across the boundary.",
            kind="placement", satisfiable=False, line=p.text))

    if not units.units:
        R.append(FitRefusal(
            "NOTHING_READ",
            "how many units this line asks the bar to hold",
            missing=f"any readable token in {units.text!r}",
            detail=("every token was refused, so the count is not 0 — it is "
                    "unknown. Doctrine 79: a refusal in the numerator charges "
                    "the wrong layer. " +
                    "; ".join(f"{r.token}: {r.cause}" for r in units.refused)),
            ends_with="a G2P fallback for out-of-lexicon words (known gap 1), "
                      "or a phonology that reads this script"))
        return fit

    # -- 2. density, and what the even division would demand ----------------

    if not units.certain:
        R.append(FitRefusal(
            "COUNT_IS_A_LOWER_BOUND",
            "the exact number of units this line asks the bar to hold",
            missing=f"{len(units.refused)} token(s) contributed nothing: "
                    + "; ".join(f"{r.token} ({r.cause})" for r in units.refused),
            detail=("the count and every density derived from it are LOWER "
                    "BOUNDS. Reporting them as measurements would charge the "
                    "ingestion layer's gap to the fit (doctrine 79). "
                    + " ".join(r.detail for r in units.refused)),
            ends_with="a G2P fallback for out-of-lexicon words (known gap 1) "
                      "and a numeral expansion on the tokeniser"))

    if fit.required_subdivision and fit.required_subdivision > 1:
        F.append(FitFinding(
            "CROWDED",
            f"more {units.unit_name}s than pulses — the pulse must divide",
            f"{units.count} {units.unit_name}s over {_num(p.pulses)} pulses "
            f"needs at least {fit.required_subdivision} slots per pulse, i.e. "
            f"a {_frac_value_name(c.note_value(Fraction(1, fit.required_subdivision)))} "
            f"grid at the coarsest. Not impossible — a pulse subdivides — but "
            f"it is a demand the declaration makes on the setting.",
            kind="density"))
    elif fit.count < p.duration:
        F.append(FitFinding(
            "SPARSE",
            f"fewer {units.unit_name}s than pulses — pulses with nothing "
            f"declared on them",
            f"{units.count} {units.unit_name}s over {_num(p.pulses)} pulses "
            f"leaves {_num(p.duration - units.count)} pulses unaccounted for. "
            f"Where they fall is a setting question and is refused below.",
            kind="density"))

    # -- 3. the anacrusis, and whether the declaration puts it on a grid ----

    if p.is_anacrusis:
        F.append(FitFinding(
            "ANACRUSIS",
            "the declared start is a pickup across the next barline",
            f"{_num(p.pickup)} pulses before the barline, "
            f"{_num(p.duration - p.pickup)} after. The start sits on a "
            f"{_grain(p.start_subdivision)}, which in {c.signature} is a "
            f"{_frac_value_name(p.start_note_value)} position.",
            kind="placement"))
    elif p.beat != 1:
        F.append(FitFinding(
            "LATE_ENTRY",
            "the line starts off the barline and does not cross the next one",
            f"beat {_num(p.beat)}, span {_num(p.duration)} pulses, "
            f"{_num(p.pickup)} pulses to the barline. An entry, not a pickup — "
            f"`grid.uniformity` counts both as 'not downbeat_locked' and they "
            f"are different placements.", kind="placement"))

    # -- 4. the slot grid: refused unless a subdivision is declared ---------

    if subdivision is None:
        R.append(FitRefusal(
            "NO_SUBDIVISION",
            "whether the declared start sits on a slot, and whether the units "
            "fit at all",
            missing="a Subdivision — how many slots a pulse carries",
            detail=("a pulse is not the smallest position a unit can take, "
                    "and how much smaller is a property of the SETTING, not "
                    "of the meter. Assuming a sixteenth-note grid would put a "
                    "number in the output that nobody declared. This line's "
                    f"start needs {_grain(p.start_subdivision)} and its count "
                    f"needs at least {fit.required_subdivision} slot(s) per "
                    f"pulse."),
            ends_with="Subdivision(slots_per_pulse=n, source=...) from the "
                      "arrangement, the score, or an explicit decision"))
    else:
        slots = _slot_positions(p, subdivision)
        fit.slots = len(slots)
        cond = f"Subdivision({subdivision.s}) — {subdivision.source}"
        if (p.start * subdivision.s).denominator != 1:
            F.append(FitFinding(
                "START_OFF_GRID",
                "the declared start is not on any slot of the declared "
                "subdivision",
                f"start {_num(p.start)} pulses at "
                f"{subdivision.s} slot(s) per pulse; the start needs "
                f"{_grain(p.start_subdivision)} "
                f"({_frac_value_name(p.start_note_value)} in {c.signature}). "
                f"Declared source: {subdivision.source}",
                kind="placement", satisfiable=False, conditional_on=cond))
        if units.count > len(slots):
            F.append(FitFinding(
                "SLOTS_EXCEEDED",
                f"more {units.unit_name}s than slots, at the declared "
                f"subdivision",
                f"{units.count} {units.unit_name}s, {len(slots)} slots "
                f"({_num(p.duration)} pulses x {subdivision.s}). No setting "
                f"places them one to a slot.",
                kind="placement", satisfiable=False, conditional_on=cond))

    # -- 5. prominence against the DECLARED grouping -----------------------
    #
    # NONE of this is a violation and none of it sets `satisfiable=False`.
    # "Every prominent unit on a group head" is a norm of some repertoires and
    # is precisely what others play against; declaring it here would be the
    # weighted quality score doctrine 6 forbids, wearing a metric hat. What is
    # reported is the arithmetic: how many CAN reach a head, and how many
    # cannot under any setting whatever.

    heads = p.heads()
    fit.heads = heads
    if isinstance(heads, FitRefusal):
        R.append(heads)
    if units.prominence_refusal is not None:
        R.append(units.prominence_refusal)
    if not isinstance(heads, FitRefusal) and units.prominence_refusal is None:
        prom = units.prominent
        rule = units.prominence_rule or "(the phonology declared no rule)"
        if units.prominence_undecided:
            R.append(FitRefusal(
                "PROMINENCE_UNDECIDED",
                "whether every prominent unit could reach a group head",
                missing=f"{len(units.prominence_undecided)} unit(s) whose "
                        f"prominence the phonology left undecided",
                detail=("a channel holding a `Readings` whose members "
                        "disagree is UNDECIDED, and None is not 0 "
                        "(quality/phonology KNOWLEDGE SETS). Counting an "
                        "undecided unit as unprominent would answer a "
                        "question about a reading nobody declared."),
                ends_with="a declared reading for the ambiguous word, or a "
                          "homograph resolution on the line"))
        if len(prom) > len(heads):
            F.append(FitFinding(
                "PROMINENCE_EXCEEDS_HEADS",
                f"more prominent {units.unit_name}s than group heads in the "
                f"span — at least {len(prom) - len(heads)} must fall off a "
                f"head under ANY setting",
                f"{len(prom)} prominent of {units.count}, pattern "
                f"{units.pattern()}; {len(heads)} head(s) at pulses "
                f"{tuple(_pos(p, h) for h in heads)} of {c.signature} as "
                f"{tuple(c.groups)}. Pigeonhole, so it needs no setting and no "
                f"subdivision — and it is a COUNT, not a complaint. "
                f"PROMINENCE HERE IS: {rule}",
                kind="prominence"))
        if len(heads) > units.count:
            F.append(FitFinding(
                "HEADS_EXCEED_UNITS",
                f"more group heads than {units.unit_name}s — at least "
                f"{len(heads) - units.count} head carries nothing at all",
                f"{units.count} {units.unit_name}s against {len(heads)} heads "
                f"at pulses {tuple(_pos(p, h) for h in heads)}. The line drags "
                f"across the grouping rather than crowding it.",
                kind="prominence"))
        if subdivision is not None and fit.slots and units.count <= fit.slots:
            slots = _slot_positions(p, subdivision)
            headset = {Fraction(h) for h in heads}
            best = _max_prominent_on_heads(
                len(units.units), [u.index for u in units.units if u.prominent],
                slots, lambda j: slots[j] in headset)
            fit.max_prominent_on_heads = best
            if best is not None and best < len(prom):
                F.append(FitFinding(
                    "PROMINENCE_CANNOT_ALIGN",
                    f"no order-preserving setting puts every prominent "
                    f"{units.unit_name} on a group head",
                    f"at most {best} of {len(prom)} can, over "
                    f"{fit.slots} slots at {subdivision.s} per pulse. Units "
                    f"are sung in order and no two share a slot, so this is "
                    f"the maximum over every setting the subdivision permits. "
                    f"PROMINENCE HERE IS: {rule}",
                    kind="prominence",
                    conditional_on=f"Subdivision({subdivision.s}) — "
                                   f"{subdivision.source}"))

    # -- 6. the SETTING: which unit sits where -----------------------------

    if beatgrid is not None:
        _read_beatgrid(fit, beatgrid, line_index)
    elif assume is not None:
        _place_isochronous(fit, assume)
    else:
        R.append(FitRefusal(
            "NO_SETTING",
            f"which {units.unit_name} sits on which pulse",
            missing="a syllable-to-beat map: (line, unit) -> pulse",
            detail=("MISSING.md G-1. `declared_inputs.BeatGrid` is the object "
                    "that accepts one, and R5 is PERMANENT: there is no audio "
                    "here, so the map arrives from a score, an arrangement or "
                    "a decision and never from the text. `Isochrony(source=)` "
                    "declares the even-division ASSUMPTION instead, and every "
                    "verdict through it is stamped conditional (doctrine 4)."),
            status="PERMANENT"))

    return fit


def _read_beatgrid(fit, grid, line_index):
    """Positions from a declared BeatGrid — R5's input, used as R5 defines it."""
    p = fit.placement
    pos, missing = [], []
    for u in fit.units.units:
        key = (line_index, u.index) if line_index is not None else (u.index,)
        v = grid.at(key)
        if v is None:
            missing.append(key)
        else:
            pos.append((u, Fraction(v)))
    if missing:
        fit.refusals.append(FitRefusal(
            "BEATGRID_INCOMPLETE",
            "which unit sits on which pulse",
            missing=f"no beat position for {missing[:4]}"
                    + (" ..." if len(missing) > 4 else ""),
            detail=("a BeatGrid maps (line, unit) -> Fraction pulses from the "
                    "cycle origin. A partial map answers for the units it "
                    "holds and refuses for the rest; it is not filled in."),
            status="PERMANENT"))
    if not pos:
        return
    heads = fit.heads
    on = None
    if not isinstance(heads, FitRefusal):
        hs = {Fraction(h) for h in heads}
        on = [(u.index, v, v in hs) for u, v in pos]
    fit.isochronous_positions = tuple((u.index, v) for u, v in pos)
    cond = ("" if getattr(grid, "measured", False) else
            f"an ASSERTED grid ({grid.source}) — isochrony is not measured "
            f"here, so this is a function of the declaration (doctrine 4)")
    if on is not None:
        prom_off = [i for (i, _v, ok) in on
                    if not ok and fit.units.units[i].prominent]
        if prom_off:
            fit.findings.append(FitFinding(
                "PROMINENCE_OFF_HEAD",
                f"{len(prom_off)} prominent unit(s) land off a group head "
                f"under the declared setting",
                f"unit indices {prom_off}; heads at "
                f"{tuple(_pos(p, h) for h in heads)}. From: {grid.source}",
                kind="setting", conditional_on=cond))


def _place_isochronous(fit, assume):
    """Even division of the span. A DECLARED assumption, stamped as one."""
    p, u = fit.placement, fit.units
    n = len(u.units)
    if not n:
        return
    step = p.duration / n
    pos = tuple((k, p.start + step * k) for k in range(n))
    fit.isochronous_positions = pos
    val = fit.even_division
    if val is not None and (val.denominator & (val.denominator - 1)):
        fit.findings.append(FitFinding(
            "TUPLET_REQUIRED",
            "an even division of the declared span is not a notatable note "
            "value",
            f"{n} units over {_num(p.duration)} pulses of "
            f"{p.cycle.signature} is {val} whole notes each — denominator "
            f"{val.denominator} is not a power of two, so the even division "
            f"is a {n}-tuplet across the span. Declared: {assume.source}",
            kind="setting", conditional_on=Isochrony.CONDITION))
    heads = fit.heads
    if isinstance(heads, FitRefusal):
        return
    hs = {Fraction(h) for h in heads}
    landed = [k for k, v in pos if v in hs]
    prom_on = [k for k, v in pos if v in hs and u.units[k].prominent]
    fit.findings.append(FitFinding(
        "EVEN_DIVISION_LANDINGS",
        f"{len(landed)} of {n} units land on a group head under even division",
        f"units {landed} of {n}; {len(prom_on)} of them prominent; heads at "
        f"{tuple(_pos(p, h) for h in heads)}. PROMINENCE HERE IS: "
        f"{u.prominence_rule or '(none declared)'}",
        kind="setting", conditional_on=Isochrony.CONDITION))


_NOTE_NAMES = {1: "whole", 2: "half", 4: "quarter", 8: "eighth",
               16: "sixteenth", 32: "thirty-second", 64: "sixty-fourth",
               128: "hundred-twenty-eighth"}


def _frac_value_name(v):
    """A note VALUE named, never a duration. `1/16 whole note` is declared;
    `125 ms` needs a tempo and there is none."""
    v = Fraction(v)
    if v.numerator == 1 and v.denominator in _NOTE_NAMES:
        return f"{_NOTE_NAMES[v.denominator]}-note"
    return f"{v} whole-note"


# ---------------------------------------------------------------------------
# SECTIONS AND SONGS
# ---------------------------------------------------------------------------


@dataclass
class SectionFit:
    name: str
    cycle: object
    bars: int
    start_bar: int
    lines: list = field(default_factory=list)

    @property
    def units(self):
        return sum(l.count for l in self.lines)

    @property
    def unit_name(self):
        return self.lines[0].units.unit_name if self.lines else "syllable"

    @property
    def per_bar(self):
        return Fraction(self.units, self.bars) if self.bars else None

    @property
    def certain(self):
        return all(l.units.certain for l in self.lines)

    @property
    def unsatisfiable(self):
        return [l for l in self.lines if not l.satisfiable]

    @property
    def refused_tokens(self):
        return [r for l in self.lines for r in l.units.refused]

    def overlaps(self):
        """Pairs of lines whose declared spans intersect -> (i, j, pulses).

        `grid.Line` says lines MAY overlap and means it — two vocal parts, a
        call over a response. For FIT it is still worth naming, because the
        bars in the intersection carry both lines' units and the per-bar
        density there is the SUM, which no per-line number shows.
        """
        out = []
        for i in range(len(self.lines)):
            for j in range(i + 1, len(self.lines)):
                a, b = self.lines[i].placement, self.lines[j].placement
                lo, hi = max(a.start, b.start), min(a.end, b.end)
                if hi > lo:
                    out.append((i, j, hi - lo))
        return out

    def uncovered_bars(self):
        """Bars of the section no line's declared span touches. A grid fact,
        available because the placement is declared."""
        P = Fraction(self.cycle.pulses)
        covered = set()
        for l in self.lines:
            a, b = l.placement.start, l.placement.end
            k = int(a // P)
            while Fraction(k) * P < b:
                if 0 <= k < self.bars:
                    covered.add(k)
                k += 1
        return tuple(self.start_bar + k for k in range(self.bars)
                     if k not in covered)

    def fighting(self):
        """Lines whose declared prominence cannot all reach the declared
        grouping's heads. A count of lines, not a verdict on any of them."""
        return [l for l in self.lines if l.prominence_findings]

    def crowded(self):
        return [l for l in self.lines
                if any(f.code == "CROWDED" for f in l.findings)]

    def refusal_codes(self):
        out = {}
        for l in self.lines:
            for r in l.refusals:
                out[r.code] = out.get(r.code, 0) + 1
        return out


@dataclass
class SongFit:
    sections: list = field(default_factory=list)

    @property
    def lines(self):
        return [l for s in self.sections for l in s.lines]

    def table(self):
        """-> rows: section, meter, grouping, bars, lines, units, units/bar,
        unsatisfiable, fighting-the-grouping, refusal codes."""
        rows = []
        for s in self.sections:
            rows.append({
                "section": s.name,
                "meter": s.cycle.signature,
                "groups": tuple(s.cycle.groups) or None,
                "bars": s.bars,
                "lines": len(s.lines),
                "unit": s.unit_name,
                "units": s.units,
                "per_bar": s.per_bar,
                "exact": s.certain,
                "unsatisfiable": len(s.unsatisfiable),
                "crowded": len(s.crowded()),
                "fighting": len(s.fighting()),
                "overlaps": len(s.overlaps()),
                "uncovered_bars": s.uncovered_bars(),
                "refusals": s.refusal_codes(),
            })
        return rows

    def findings(self):
        return [f for l in self.lines for f in l.findings]

    def refusals(self):
        return [r for l in self.lines for r in l.refusals]


def _cycle_of(meterdict):
    return Cycle(pulses=int(meterdict.get("beats", 4)),
                 unit=int(meterdict.get("unit", 4)),
                 groups=tuple(meterdict.get("groups", ()) or ()))


def from_blueprint(obj):
    """-> (sections, placements) from a blueprint dict or path.

    Deliberately does NOT import `quality/grid.py`: a `grid.Song` is accepted
    through `from_song` by duck typing instead, so this module has no build
    dependency on a file another cell owns this round.
    """
    if isinstance(obj, str):
        with open(obj) as fh:
            obj = json.load(fh)
    secs, bar = [], 1
    for s in obj.get("sections", []):
        cyc = _cycle_of(s.get("meter", {}))
        start = int(s.get("start_bar", bar))
        secs.append({"name": s["name"], "cycle": cyc,
                     "bars": int(s["bars"]), "start_bar": start})
        bar = start + int(s["bars"])
    by_name = {s["name"]: s for s in secs}

    def owner(l):
        if l.get("section") in by_name:
            return by_name[l["section"]]
        for s in secs:
            if s["start_bar"] <= int(l["bar"]) < s["start_bar"] + s["bars"]:
                return s
        return secs[-1] if secs else None

    places = []
    for l in obj.get("lines", []):
        s = owner(l)
        places.append(Placement(
            cycle=s["cycle"], bar=int(l["bar"]),
            beat=_frac(l.get("beat", 1)), duration=_frac(l.get("duration", 4)),
            section=s["name"], section_start_bar=s["start_bar"],
            section_bars=s["bars"], text=l.get("text", "")))
    return secs, places


def from_song(song):
    """-> (sections, placements) from anything shaped like a `grid.Song`.

    Duck-typed on `.sections` / `.lines` and their fields, so `grid.Meter`'s
    `beats`/`unit`/`groups` become a `meter.Cycle` here. `grid.Meter.cycle`
    already builds one; this reads the three fields directly so a Song that
    predates that property still works.
    """
    secs, bar = [], 1
    for s in song.sections:
        m = s.meter
        cyc = getattr(m, "cycle", None)
        if cyc is None or not hasattr(cyc, "group_starts"):
            cyc = Cycle(pulses=m.beats, unit=m.unit,
                        groups=tuple(getattr(m, "groups", ()) or ()))
        start = int(getattr(s, "start_bar", bar) or bar)
        secs.append({"name": s.name, "cycle": cyc, "bars": int(s.bars),
                     "start_bar": start})
        bar = start + int(s.bars)
    by_name = {s["name"]: s for s in secs}
    places = []
    for l in song.lines:
        s = by_name.get(getattr(l, "section", ""))
        if s is None:
            for cand in secs:
                if cand["start_bar"] <= l.bar < cand["start_bar"] + cand["bars"]:
                    s = cand
                    break
        s = s or secs[-1]
        places.append(Placement(
            cycle=s["cycle"], bar=int(l.bar), beat=_frac(l.beat),
            duration=_frac(l.duration), section=s["name"],
            section_start_bar=s["start_bar"], section_bars=s["bars"],
            text=l.text))
    return secs, places


def fit_song(obj, phon=None, subdivision=None, assume=None, strip_parens=True):
    """-> SongFit. `obj` is a blueprint path, a blueprint dict, or a Song.

    `strip_parens` see `read_line`, forwarded to every line in the song."""
    if hasattr(obj, "sections") and hasattr(obj, "lines"):
        secs, places = from_song(obj)
    else:
        secs, places = from_blueprint(obj)
    out = SongFit(sections=[SectionFit(name=s["name"], cycle=s["cycle"],
                                       bars=s["bars"], start_bar=s["start_bar"])
                            for s in secs])
    by_name = {s.name: s for s in out.sections}
    for i, p in enumerate(places):
        f = fit_line(p.text, p, phon=phon, subdivision=subdivision,
                     assume=assume, line_index=i, strip_parens=strip_parens)
        by_name[p.section].lines.append(f)
    # Overlap is a relation BETWEEN lines, so it cannot be seen from inside
    # one, which is why `fit_line` does not look for it.
    for s in out.sections:
        for i, j, span in s.overlaps():
            a, b = s.lines[i], s.lines[j]
            both = a.count + b.count
            for one, other in ((a, b), (b, a)):
                one.findings.append(FitFinding(
                    "OVERLAPPING_SPANS",
                    "two declared spans intersect — the shared pulses carry "
                    "both lines",
                    f"{_num(span)} pulses shared with {other.units.text!r}; "
                    f"{both} {one.units.unit_name}s across the two lines over "
                    f"the intersection. Legal — `grid.Line` says lines may "
                    f"overlap — and the per-line density above does not show "
                    f"it.", kind="density"))
    return out


# ---------------------------------------------------------------------------
# WHAT THIS LAYER CAN AND CANNOT BE ASKED
# ---------------------------------------------------------------------------

#: The deliverable is the boundary as much as the code, so it is a value in the
#: module rather than a paragraph in a report nobody imports.
ANSWERABLE = (
    "how many grid units must this bar accommodate, in the phonology's own "
    "declared unit",
    "how many of the line's tokens could NOT be read, and what that makes the "
    "count a bound on",
    "how many pulses does the declared placement provide, and how many bars",
    "what is the density -- units per pulse and units per bar, exact rationals",
    "what is the smallest slots-per-pulse subdivision that holds one unit per "
    "slot",
    "what note VALUE does the declared start sit on -- a 1/16 position in 7/8 "
    "is a fact about the declaration",
    "is the declared beat a pulse the bar actually has",
    "does the declared span stay inside its section",
    "is the declared start a pickup across the next barline, or a late entry",
    "how many group heads does the span cover, when a grouping is declared",
    "can every prominent unit reach a group head -- NO, by pigeonhole, "
    "whenever there are more of them than heads",
    "at a DECLARED subdivision: does the start sit on a slot, do the units "
    "fit, and can every prominent unit reach a head",
    "under a DECLARED setting or a DECLARED isochrony: which units land on "
    "heads",
    "which bars of a section no declared line touches",
)

UNANSWERABLE = (
    ("anything per second -- syllables per second, whether a line is too fast "
     "to sing, how long the pickup is",
     "PERMANENT: there is no tempo (MISSING.md C-5) and no audio, so a note "
     "value cannot become a duration"),
    ("whether the singer LANDS on the beat, ahead of it or behind it",
     "PERMANENT: MISSING.md C-4 -- pushes, pulls and laid-back placement are "
     "a performance channel no text carries, and doctrine 4 says 'on the "
     "beat' is not a claim this project can make"),
    ("which unit sits on which pulse, absent a declaration",
     "PERMANENT for the MEASUREMENT (R5), SCHEDULED for the plumbing: "
     "`BeatGrid` accepts a map from a score or an arrangement and this module "
     "reads it"),
    ("whether a syllable is held over several pulses (melisma) or several "
     "syllables share one",
     "PERMANENT without a setting: that IS the setting, and it comes from "
     "notation, not from text"),
    ("which grouping a section 'really' has, when none is declared",
     "PERMANENT: doctrine 19 -- an argmax over the 2^(n-1) compositions is "
     "biased and must be withheld; `conventional_grouping()` exists and is "
     "labelled a convention"),
    ("whether a prominent unit lands on a head, in a phonology that declines "
     "a prominence pattern",
     "PERMANENT: doctrine 35 -- `som` has pitch accent, `ltc`'s binary is "
     "平/仄, and a plausible-looking stress pattern for either is a number "
     "nobody could catch"),
    ("whether the line BREATHES, whether a long vowel sits on a long note, "
     "whether a word is broken across a rest",
     "SCHEDULED in part: MISSING.md G-2. The vowel-length half needs "
     "`Syllable` to carry length (MISSING.md F-2); the rest needs a setting"),
)


# ---------------------------------------------------------------------------


def report(fit, verbose=False):
    rows = fit.table()
    w = max(len(r["section"]) for r in rows) if rows else 8
    out = []
    out.append(f"  {'section'.ljust(w)}  meter  group   bars  line   unit  "
               f"per bar  UNSAT  crowd  fight  over  empty bars")
    for r in rows:
        g = ("+".join(str(x) for x in r["groups"]) if r["groups"]
             else "UNDECL")
        pb = f"{float(r['per_bar']):.2f}" if r["per_bar"] is not None else "-"
        exact = "" if r["exact"] else "*"
        ub = r["uncovered_bars"]
        ubs = (f"{len(ub)}" + (f" {ub[0]}..{ub[-1]}" if ub else "")) if ub \
            else "0"
        out.append(f"  {r['section'].ljust(w)}  {r['meter']:>5}  {g:<6} "
                   f"{r['bars']:>5}  {r['lines']:>4}  {r['units']:>4}{exact:1} "
                   f"{pb:>7}  {r['unsatisfiable']:>5}  {r['crowded']:>5}  "
                   f"{r['fighting']:>5}  {r['overlaps']:>4}  {ubs}")
    tot = sum(r["units"] for r in rows)
    bars = sum(r["bars"] for r in rows)
    out.append(f"  {'TOTAL'.ljust(w)}  {'':>5}  {'':<6} {bars:>5}  "
               f"{len(fit.lines):>4}  {tot:>4}")
    out.append("  * the count is a LOWER BOUND: a token was refused "
               "(doctrine 79). UNSAT counts lines whose DECLARATION "
               "contradicts itself;")
    out.append("    `fight` counts lines with more prominent units than the "
               "span has group heads, which is a count and not a verdict.")
    codes = {}
    for s in fit.sections:
        for k, v in s.refusal_codes().items():
            codes[k] = codes.get(k, 0) + v
    out.append("  REFUSED, by cause: "
               + ", ".join(f"{k} x{v}" for k, v in sorted(codes.items())))
    if verbose:
        for s in fit.sections:
            for l in s.lines:
                out.append("")
                out.append(l.describe())
    return "\n".join(out)


def main(argv):
    path = argv[1] if len(argv) > 1 else os.path.join(
        HERE, "fixtures", "mandate_song.blueprint.json")
    sub = None
    if "--subdivision" in argv:
        n = int(argv[argv.index("--subdivision") + 1])
        sub = Subdivision(slots_per_pulse=n,
                          source="command line --subdivision, an explicit "
                                 "decision by whoever ran this")
    assume = None
    if "--isochronous" in argv:
        assume = Isochrony(source="command line --isochronous, an explicit "
                                  "assumption by whoever ran this")
    f = fit_song(path, subdivision=sub, assume=assume)
    print(f"FIT: {os.path.basename(path)}")
    print(report(f, verbose="-v" in argv))
    print("\nWHAT THIS LAYER CAN BE ASKED")
    for q in ANSWERABLE:
        print(f"  ? {q}")
    print("\nWHAT IT CANNOT, AND WHY")
    for q, why in UNANSWERABLE:
        print(f"  X {q}\n      {why}")
    return 0


__all__ = ["Unit", "RefusedToken", "LineUnits", "read_line", "Placement",
           "Subdivision", "Isochrony", "FitFinding", "FitRefusal", "Refused",
           "FitError", "LineFit", "fit_line", "SectionFit", "SongFit",
           "fit_song", "from_blueprint", "from_song", "report",
           "ANSWERABLE", "UNANSWERABLE"]


if __name__ == "__main__":
    sys.exit(main(sys.argv))
