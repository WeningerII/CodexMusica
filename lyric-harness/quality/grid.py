#!/usr/bin/env python3
"""The BAR GRID. Lines live in musical time, not in stanzas.

WHY THIS FILE EXISTS

This project spent its whole life measuring lines in groups of four. The slop
floor has two profiles and they are "4-line quatrain" and "14-line sonnet".
`blueprint.json` shipped six four-line sections. Every demonstration, every
fixture, every draft came out as 16 bars of 4/4 with four lines in it, because
that was the only shape anything could see.

A stanza is a PRINTING convention. A song has bars. Once a line is placed at a
bar and a beat and given a duration, "four lines per section" stops being a
unit of anything -- a section is 11 bars long, a line takes 3 beats or 7, one
line spills across a barline and the next one starts before the downbeat. The
grid is what makes non-uniform structure expressible instead of merely allowed.

WHAT IS DECLARED HERE

  - TIME SIGNATURE is arbitrary: 4/4, 3/4, 6/8, 5/4, 7/8, 12/8, 11/8. It may
    CHANGE mid-song; `Song.meter_at(bar)` resolves it.
  - SECTION LENGTH is measured in BARS and is arbitrary. Not 16. Not a multiple
    of 4. Not a multiple of anything.
  - LINE PLACEMENT is (bar, beat) with a duration in beats. Lines may overlap,
    leave gaps, start before the downbeat (anacrusis), or run across a barline.
  - LINES PER SECTION IS EMERGENT. There is no field for it and there will not
    be one. It is a consequence of where lines fall, which is the point.

THE ANTI-CLICHE CHECK, WHICH IS THE REASON THIS IS NOT JUST A DATA MODEL

`uniformity()` measures how close a song has drifted to the default: 4/4
throughout, every section a multiple of 4 bars, every section the same bar
length, every line the same duration, every line landing on a downbeat, four
lines to a section. A song that scores high on all six has been written by the
grid rather than on it. `stanza_lock()` returns the findings.

This is the FIRST structural-cliche detector in the repo. Everything before it
measured cliche at the word and rhyme-pair level -- CLICHE_PAIR,
PREDICTABLE_RHYME -- and would happily certify the most exhausted form in
popular music as clean, which is exactly what it did.

WHAT THE SECOND ROUND ADDED, AND WHY IT IS THE SAME GAP THREE TIMES

Everything above places a line in TIME. Nothing above knows what a section IS.
`Section` carried `name, bars, meter, start_bar`, and `name` was a free string:
"chorus", "chorus2" and "verse1" were opaque tokens, so no check could ask a
question a writer actually asks. `MISSING.md` D-1, D-2, D-3 and A-2 are one
gap seen from four sides -- no FUNCTION, no HOOK, no RETURN structure, no way
to say that a chorus came back with one word changed.

  - `Section.function` is a DECLARED coordinate over a declared vocabulary.
    It is never parsed from `name`. Inferring a function from a name string is
    the same error as inferring a tradition from a schema's name, which this
    repo made and caught. An unknown value RAISES (doctrine 45's move for
    `language`); an absent value is UNDECLARED and every function-dependent
    check REFUSES on it rather than guessing (doctrine 28, doctrine 79).
  - `compare_returns` measures repetition-with-variation. It never returns
    "same" or "different": every pair of returns resolves to a NAMED KIND
    (doctrine 24 -- a rule that would delete a category must RELABEL), with an
    edit distance, the invariant lines, the moved lines, and separate flags
    for the rhyme scheme and the tune slot.
  - `Hook` is a FRAGMENT, not a section, because that is what a hook is.
  - `ingest_mark` reads a source's OWN structural mark. That is not name
    inference: a printed `[CHORUS]` is the printer's declaration, the table
    that reads it is explicit and enumerable, and a mark not in the table is
    REFUSED rather than mapped to the nearest-looking function.
"""

import itertools
import re
import unicodedata
from dataclasses import dataclass, field
from fractions import Fraction

# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Meter:
    """A time signature. Arbitrary; nothing here privileges 4/4."""
    beats: int = 4
    unit: int = 4
    #: The ordered composition of the pulses. Empty means UNDECLARED, and an
    #: undeclared grouping is refused rather than guessed.
    groups: tuple = ()

    def __str__(self):
        return f"{self.beats}/{self.unit}"

    @property
    def compound(self):
        return self.unit in (8, 16) and self.beats % 3 == 0 and self.beats > 3

    @property
    def cycle(self):
        """-> quality.meter.Cycle. The general object; this class is the
        two-integer convenience over it."""
        from quality.meter import Cycle
        return Cycle(pulses=self.beats, unit=self.unit, groups=self.groups)

    @property
    def pulse_groups(self):
        """The DECLARED grouping, or None.

        THIS USED TO ASSERT. It returned (3,3,3) for 9/8 -- the European
        reading -- where Balkan daichovo is 2+2+2+3, and (1,1,1,1,1,1,1) for
        7/8, which is not a grouping at all. There are 2^(n-1) orderings of n
        pulses (64 at seven, 256 at nine) and it represented one by fiat.

        None now means "this cycle has not said". `conventional_grouping` is
        available separately and is labelled a convention.
        """
        return self.cycle.pulse_groups()

    def conventional_grouping(self):
        """A habit of common-practice European repertoire, labelled as one.
        Wrong for aksak, for tala, and for anything polycentric."""
        return self.cycle.conventional_grouping()

    def variants(self):
        """Every other grouping of this signature -- what it is distinguished
        FROM."""
        return self.cycle.variants()


@dataclass
class Line:
    """One sung line, placed in musical time.

    `bar` is 1-based. `beat` is 1-based and may be FRACTIONAL (2.5 = the 'and'
    of two) and may be NEGATIVE or zero to express an anacrusis that starts
    before the section's first downbeat. `duration` is in beats and may exceed
    the bar.
    """
    text: str
    bar: int
    beat: Fraction = Fraction(1)
    duration: Fraction = Fraction(4)
    section: str = ""

    def __post_init__(self):
        object.__setattr__ if False else None
        self.beat = Fraction(self.beat)
        self.duration = Fraction(self.duration)

    def on_downbeat(self):
        return self.beat == 1

    def end_beat_absolute(self, meter):
        return self.start_absolute(meter) + self.duration

    def start_absolute(self, meter):
        return (self.bar - 1) * meter.beats + (self.beat - 1)


# ---------------------------------------------------------------------------
# SECTION FUNCTION -- the declared coordinate (MISSING.md D-1)
# ---------------------------------------------------------------------------

#: The value of `Section.function` when nobody has said. It is NOT "verse" and
#: it is NOT guessable from the section's name; doctrine 28 -- "none" and
#: "cannot tell" are different answers and the difference has to be mechanical.
UNDECLARED = ""


class UnknownFunction(ValueError):
    """Raised when a section declares a function outside the vocabulary.

    The move `check_cynghanedd` made for `language` (doctrine 45): a coordinate
    that silently accepts anything is making a claim it never states. A
    function that is not in the table is a REFUSAL to represent the section,
    not a licence to treat it as a verse.
    """


@dataclass(frozen=True)
class FunctionSpec:
    """What the harness DECLARES about a section function.

    `recurrence` and `returns_as` are conventions of popular song form, and
    they are labelled conventions for the same reason `Meter.pulse_groups`
    refuses and `conventional_grouping` is separate: a genre may answer
    differently, and a default that pretends otherwise is a fiat. Override with
    a `FormConvention`.
    """
    name: str
    gloss: str
    #: "once" | "returns" | "open" -- what the convention expects
    recurrence: str
    #: what a RETURN of this function is expected to carry
    #: "verbatim" | "new words" | "varied" | "n/a"
    returns_as: str
    #: functions this one is conventionally expected to CONTRAST with
    contrasts_with: tuple = ()


def _spec(name, gloss, recurrence, returns_as, contrasts_with=()):
    return FunctionSpec(name, gloss, recurrence, returns_as, contrasts_with)


#: THE VOCABULARY. D-1 asked for it by name. Every entry is declared here and
#: nowhere else; `as_function` accepts exactly these keys.
SECTION_FUNCTIONS = {s.name: s for s in (
    _spec("intro", "opens the song; may state material that returns later",
          "once", "n/a"),
    _spec("verse", "carries the narrative; returns with NEW WORDS on the same "
          "tune", "returns", "new words"),
    _spec("prechorus", "lifts from verse into chorus; a distinct function, "
          "not a short verse", "returns", "varied", ("verse", "chorus")),
    _spec("chorus", "the returning section; the one place where REPEAT is the "
          "requirement rather than the violation (doctrine 3)",
          "returns", "verbatim", ("verse",)),
    _spec("postchorus", "returns immediately after the chorus and is not part "
          "of it", "returns", "verbatim", ("chorus",)),
    _spec("refrain", "a returning line or couplet INSIDE or after a stanza, "
          "not a standalone section", "returns", "verbatim"),
    _spec("burden", "a refrain sung by all, often printed before the first "
          "stanza; kept SEPARATE from `refrain` because the corpus marks the "
          "two differently and collapsing them would delete a distinction "
          "1,776 blocks already carry (doctrine 24)",
          "returns", "verbatim"),
    _spec("bridge", "appears once and CONTRASTS; a middle-8 is a bridge whose "
          "bar count happens to be 8, which this model already records, so it "
          "is not a separate function", "once", "n/a", ("verse", "chorus")),
    _spec("breakdown", "strips the arrangement back", "open", "varied"),
    _spec("build", "raises tension toward a return", "open", "varied"),
    _spec("drop", "the arrival a build points at", "returns", "varied"),
    _spec("vamp", "a repeating figure held open", "open", "varied"),
    _spec("turnaround", "carries the end of one section into the next",
          "returns", "verbatim"),
    _spec("interlude", "instrumental or spoken span between sung sections",
          "open", "n/a"),
    _spec("solo", "an instrumental span over section material", "open", "n/a"),
    _spec("tag", "a short repeated fragment closing a section or the song",
          "returns", "verbatim"),
    _spec("hook", "a section that IS the hook. A hook is properly a FRAGMENT "
          "(MISSING.md D-2) and `Hook` below is the object for that; this "
          "entry covers the post-chorus-hook case where a whole section "
          "carries it", "returns", "verbatim"),
    _spec("coda", "a closing section with its own material", "once", "n/a"),
    _spec("outro", "closes the song and does not recur", "once", "n/a"),
    _spec("false_ending", "a close the song comes back from", "once", "n/a"),
    _spec("reprise", "a declared return of earlier material, later and "
          "changed", "once", "varied"),
)}

#: Spelling variants only. NOT a synonym table: `middle8 -> bridge` would be a
#: CLAIM, and claims live in the vocabulary above with a gloss.
_FUNCTION_SPELLINGS = {
    "pre-chorus": "prechorus", "pre_chorus": "prechorus",
    "pre chorus": "prechorus",
    "post-chorus": "postchorus", "post_chorus": "postchorus",
    "post chorus": "postchorus",
    "false ending": "false_ending", "false-ending": "false_ending",
}


def as_function(value):
    """-> a vocabulary key, or UNDECLARED. Anything else RAISES.

    `None`, `""` and UNDECLARED all mean NOBODY HAS SAID. They do not mean
    verse. A function-dependent check handed an undeclared section records a
    REFUSAL and reports it as one (doctrine 79): a refusal in the numerator
    charges the wrong layer, and a song reported "clean" because nothing
    declared a chorus is a vacuous pass (doctrine 20).
    """
    if value is None:
        return UNDECLARED
    if isinstance(value, FunctionSpec):
        value = value.name
    v = str(value).strip().lower()
    if not v:
        return UNDECLARED
    v = _FUNCTION_SPELLINGS.get(v, v)
    if v in SECTION_FUNCTIONS:
        return v
    raise UnknownFunction(
        f"{value!r} is not a declared section function.\n"
        f"The vocabulary is: {', '.join(sorted(SECTION_FUNCTIONS))}.\n"
        f"This does NOT fall back to `verse`, and it is NOT inferred from the "
        f"section's name -- 'chorus2' and 'verse1' are name strings, and "
        f"reading a function out of one is the same error as reading a "
        f"tradition out of a schema's name. Declare the function, or leave it "
        f"UNDECLARED and accept that the function-dependent checks will refuse "
        f"rather than guess.")


@dataclass
class Section:
    """A named span measured in BARS. There is no line count field.

    `function` is the DECLARED coordinate (MISSING.md D-1). `name` is still a
    free string and stays one -- it is what the writer calls this span, and it
    is deliberately not evidence. `Section("chorus", 16).function` is
    UNDECLARED, and there is a regression that says so.
    """
    name: str
    bars: int
    meter: Meter = field(default_factory=Meter)
    start_bar: int = 1
    function: str = UNDECLARED

    def __post_init__(self):
        self.function = as_function(self.function)

    @property
    def end_bar(self):
        return self.start_bar + self.bars - 1

    @property
    def declared(self):
        return self.function != UNDECLARED

    @property
    def spec(self):
        return SECTION_FUNCTIONS.get(self.function)


@dataclass
class Song:
    sections: list = field(default_factory=list)
    lines: list = field(default_factory=list)
    #: The song's title, as declared. Needed so "is the title in the hook?"
    #: can be ASKED; absent, that question is refused rather than answered.
    title: str = ""

    def layout(self):
        """Assign section start bars in order. Sections are laid end to end;
        their LENGTHS are whatever they are."""
        bar = 1
        for s in self.sections:
            s.start_bar = bar
            bar += s.bars
        return self

    @property
    def total_bars(self):
        return sum(s.bars for s in self.sections)

    def meter_at(self, bar):
        for s in self.sections:
            if s.start_bar <= bar <= s.end_bar:
                return s.meter
        return self.sections[-1].meter if self.sections else Meter()

    def section_at(self, bar):
        for s in self.sections:
            if s.start_bar <= bar <= s.end_bar:
                return s.name
        return ""

    def line_sections(self):
        """-> per-LINE section labels, for quality.schemes.coordinates().

        This is the handoff that keeps the two layers honest: the scheme layer
        partitions the whole song and takes section membership as a per-line
        annotation. It never receives a list of sections to chunk by.
        """
        return [l.section or self.section_at(l.bar) for l in self.lines]

    def lines_in(self, section):
        """Lines belonging to ONE section instance, matched by BAR RANGE.

        Matching by name was wrong and the demo caught it: a song with two
        sections both called "chorus" collapsed them, so the line count per
        section was double and QUATRAIN_LOCK could not fire correctly. Two
        choruses are the same chorus for RHYME purposes and two different
        spans for GRID purposes, and this layer is the grid.
        """
        if isinstance(section, str):
            hits = [s for s in self.sections if s.name == section]
            if len(hits) != 1:
                raise ValueError(
                    f"{section!r} names {len(hits)} sections; pass the "
                    f"Section itself. Repeated section names are normal and "
                    f"are exactly why this cannot key on the name.")
            section = hits[0]
        return [l for l in self.lines
                if section.start_bar <= l.bar <= section.end_bar]

    # -- function-keyed accessors (MISSING.md D-1) ------------------------

    def declared_sections(self):
        return [s for s in self.sections if s.declared]

    def undeclared_sections(self):
        return [s for s in self.sections if not s.declared]

    def instances_of(self, function):
        """Every section declaring `function`, in bar order.

        Keyed on the DECLARED function, never on the name -- which is the
        whole point. `lines_in` still refuses a repeated NAME, because two
        choruses are one chorus for rhyme and two spans for the grid; this
        accessor is the other half of that sentence, and it is the half the
        model could not express.
        """
        fn = as_function(function)
        return sorted((s for s in self.sections if s.function == fn),
                      key=lambda s: s.start_bar)

    def form(self):
        """-> the run of declared functions in order, e.g.
        ('verse', 'prechorus', 'chorus', ...). Undeclared spans appear as
        UNDECLARED so the hole is visible rather than skipped."""
        return tuple(s.function for s in self.sections)

    def bars_until(self, function):
        """-> (bars, section) before the first instance of `function`, or
        (None, None) when nothing declares it.

        D-1 named this question in as many words: "how many bars until the
        first chorus". It could not be asked, because nothing knew what a
        chorus was.
        """
        hits = self.instances_of(function)
        if not hits:
            return None, None
        return hits[0].start_bar - 1, hits[0]

    def slot_profile(self, section):
        """-> the TUNE SLOT of a section: per line, its offset from the
        section's own first bar, its beat, and its duration.

        Two returns of a chorus occupy the same slot iff their profiles are
        equal. This is the coordinate that makes "does the chorus land in the
        same place each time" a measurement rather than an impression, and it
        is the `preserved-tune-slot` flag `compare_returns` carries.
        """
        return tuple((l.bar - section.start_bar, l.beat, l.duration)
                     for l in self.lines_in(section))


# ---------------------------------------------------------------------------
# THE ANTI-CLICHE CHECK
# ---------------------------------------------------------------------------

@dataclass
class GridFinding:
    code: str
    message: str
    evidence: str

    def __str__(self):
        return f"[{self.code}] {self.message}\n    {self.evidence}"


def uniformity(song):
    """-> dict of six drift measures, each in [0,1]. 1.0 means fully default.

    Reported as measurements, never summed into a score -- the exchange rate
    between them is a genre's answer and belongs in a declaration.
    """
    secs = song.sections
    lines = song.lines
    out = {}

    out["four_four"] = (sum(1 for s in secs if s.meter == Meter(4, 4))
                        / len(secs)) if secs else 0.0
    out["bars_multiple_of_four"] = (sum(1 for s in secs if s.bars % 4 == 0)
                                    / len(secs)) if secs else 0.0
    lens = [s.bars for s in secs]
    out["equal_section_length"] = (
        max(lens.count(v) for v in set(lens)) / len(lens)) if lens else 0.0
    durs = [l.duration for l in lines]
    out["equal_line_duration"] = (
        max(durs.count(v) for v in set(durs)) / len(durs)) if durs else 0.0
    out["downbeat_locked"] = (sum(1 for l in lines if l.on_downbeat())
                              / len(lines)) if lines else 0.0
    counts = [len(song.lines_in(s)) for s in secs]
    out["four_lines_per_section"] = (
        sum(1 for c in counts if c == 4) / len(counts)) if counts else 0.0
    return out


def stanza_lock(song, threshold=0.90):
    """-> findings. Fires when a song has been written BY the grid.

    THE SPECIFIC CLICHE THIS NAMES: sixteen bars of 4/4 carrying four lines,
    repeated. Nothing in this repo could see that before -- the rhyme checker
    would certify it as clean, because every check it had was about words.
    """
    u = uniformity(song)
    out = []
    if u["four_four"] >= threshold and u["bars_multiple_of_four"] >= threshold:
        out.append(GridFinding(
            "METER_LOCKED",
            "every section is 4/4 and every section length is a multiple of 4",
            f"4/4 on {u['four_four']:.0%} of sections, bar counts divisible "
            f"by 4 on {u['bars_multiple_of_four']:.0%}. Nothing forces this; "
            f"5/4, 6/8, 7/8, and 10- or 11-bar sections are all available."))
    if u["equal_section_length"] >= threshold and len(song.sections) > 2:
        out.append(GridFinding(
            "SECTION_LENGTH_LOCKED",
            "every section is the same number of bars",
            f"{[s.bars for s in song.sections]} — the form has no shape of "
            f"its own; a section that ARRIVES early or overstays is where "
            f"structure becomes audible."))
    if u["four_lines_per_section"] >= threshold and len(song.sections) > 2:
        out.append(GridFinding(
            "QUATRAIN_LOCK",
            "every section carries exactly four lines",
            "line counts per section are all 4. Lines-per-section is "
            "EMERGENT from where lines fall on the bar grid; if it comes out "
            "at 4 every time, the lines were written to a stanza and then "
            "placed, rather than placed."))
    if u["downbeat_locked"] >= threshold and len(song.lines) > 4:
        out.append(GridFinding(
            "DOWNBEAT_LOCKED",
            "every line starts on beat one",
            f"{u['downbeat_locked']:.0%} of lines begin on a downbeat. No "
            f"anacrusis, no line entering late, no phrase pushed across a "
            f"barline — the words are sitting on the grid rather than "
            f"playing against it."))
    if u["equal_line_duration"] >= threshold and len(song.lines) > 4:
        out.append(GridFinding(
            "PHRASE_LENGTH_LOCKED",
            "every line is the same length in beats",
            f"durations are all {song.lines[0].duration}. Uniform phrase "
            f"length is the audible signature of writing in quatrains."))
    return out


def phrase_profile(song):
    """-> the actual shape: bars per section and lines per section, so the
    asymmetry (or its absence) is visible at a glance."""
    return [(s.name, s.bars, str(s.meter), len(song.lines_in(s)))
            for s in song.sections]


# ---------------------------------------------------------------------------
# REFUSALS
#
# A refusal is not a finding and must never be counted as one. Doctrine 79:
# putting a refusal in the numerator charges the wrong layer. Every check below
# returns findings and refusals as two lists, and the report prints three
# counts -- asked, answered, refused -- for the same reason the sonnet battery
# prints mandated, judged and refused.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Refusal:
    code: str
    message: str
    evidence: str = ""

    def __str__(self):
        return f"[REFUSED {self.code}] {self.message}\n    {self.evidence}"


# ---------------------------------------------------------------------------
# REPETITION WITH VARIATION (MISSING.md A-2, D-3)
#
# A chorus that returns with one word changed is neither "the same line" nor "a
# different line", and the repo had no third answer. The measurement below has
# no boolean at all: every pair of returns resolves to a NAMED KIND, and the
# residual case is named too, because doctrine 24 says a rule that would delete
# a category must relabel instead. The test of the rule is whether the harness
# can say MORE afterwards; before this it could say two things and now it can
# say twelve, of which three were forced on it by the corpus.
# ---------------------------------------------------------------------------

#: The kinds, in ladder order. `kind` is the first that applies; `qualities`
#: carries every one that applies, so the ladder never deletes an observation.
VARIATION_KINDS = (
    ("STUB", "the return POINTS at its target instead of reproducing it "
             "(printed '&c.'). Distance is REFUSED, not zero and not large: "
             "there is no second text to measure against."),
    ("VERBATIM", "every line identical under the declared normalisation"),
    ("TRUNCATED_RETURN", "the return is a strict sub-sequence of the first, "
                         "every kept line verbatim -- the last-chorus cut"),
    ("EXTENDED_RETURN", "the first is a strict sub-sequence of the return -- "
                        "the added bar on the last return"),
    ("LEXICAL_VARIATION", "same line count, same slots, and every line that "
                          "moves moves by at most `lexical_max_tokens` "
                          "tokens: present tense to past, 'will' to 'did'"),
    ("FRAME_PRESERVED", "first and last lines held, interior rewritten "
                        "(Russell, 'Cheer, Boys, Cheer')"),
    ("HEAD_AND_TAIL_PRESERVED", "each varied line keeps a leading AND a "
                                "trailing token run and varies in the middle "
                                "(the Gitagovinda dhruva-tail)"),
    ("TAIL_PRESERVED", "each varied line keeps a trailing token run -- the "
                       "radif shape, inside a line rather than across lines"),
    ("HEAD_PRESERVED", "each varied line keeps a leading token run"),
    ("RHYME_PRESERVING_REWRITE", "line count and rhyme partition held, words "
                                 "rewritten (Hanby, 'Darling Nelly Gray')"),
    ("PARTIAL_RETURN", "at least one line invariant and nothing above holds"),
    ("RESTATEMENT", "same line count, nothing invariant, token overlap above "
                    "`restatement_overlap` -- the same material said again"),
    ("UNRELATED", "no line, no rhyme, no token run and no slot survived. This "
                  "is a NAMED kind and it names what was tested: it is the "
                  "answer 'these two blocks are marked as one section and "
                  "share nothing measurable', which is a finding about the "
                  "MARKING, not a shrug."),
)
_KIND_GLOSS = dict(VARIATION_KINDS)


@dataclass(frozen=True)
class VariationDeclaration:
    """Every coordinate of the variation measurement, stated (doctrine 1).

    Doctrine 58: a recorded count is a threshold nobody wrote down. Each number
    here is a threshold, so each one travels with the result -- `Return`
    carries this object and `describe()` prints it.
    """
    #: what `normalise_line` removes, in words
    normalisation: str = "curly quotes, _markup_, case, punctuation, space"
    #: a line that moves by at most this many word-edits is LEXICAL
    lexical_max_tokens: int = 2
    #: a shared head/tail run must be at least this many tokens to count. At 1
    #: an English line-final 'the' would manufacture a radif.
    min_invariant_run: int = 2
    #: token Jaccard above this, with nothing else preserved, is RESTATEMENT
    restatement_overlap: float = 0.5
    #: NAME of the rhyme key in use, or "" when no key was declared. The key
    #: itself is passed separately; this is what the RESULT says it used,
    #: because a checker that silently picks a phonology is making a claim it
    #: never states (doctrine 45).
    rhyme_key: str = ""


_MARKUP = re.compile(r"[_*]+")
_PUNCT = re.compile(r"[^\w\s'’-]", re.UNICODE)
_SPACE = re.compile(r"\s+")


def normalise_line(text):
    """The declared normalisation. Named, because it decides answers.

    Durfey prints the same burden as `_Which no body can deny._` and
    `_Which no Body can deny._`; Russell's third chorus line differs between
    returns by one comma. Under the raw text those are variations and under
    this normalisation they are not, and which of the two a result used is a
    coordinate of the result rather than a detail.
    """
    t = unicodedata.normalize("NFC", text or "")
    t = t.replace("’", "'").replace("‘", "'")
    t = t.replace("“", '"').replace("”", '"')
    t = _MARKUP.sub(" ", t)
    t = _PUNCT.sub(" ", t)
    t = _SPACE.sub(" ", t).strip().lower()
    return t


def tokens(text):
    return normalise_line(text).split()


def _lev(a, b):
    """Levenshtein over any two sequences. Used at line level and at token
    level, which is the whole reason it is generic."""
    if list(a) == list(b):
        return 0
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1,
                           prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def _lcs_pairs(a, b):
    """-> [(i, j)] aligned index pairs of a longest common subsequence."""
    n, m = len(a), len(b)
    tbl = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            tbl[i][j] = (tbl[i + 1][j + 1] + 1 if a[i] == b[j]
                         else max(tbl[i + 1][j], tbl[i][j + 1]))
    out, i, j = [], 0, 0
    while i < n and j < m:
        if a[i] == b[j]:
            out.append((i, j))
            i += 1
            j += 1
        elif tbl[i + 1][j] >= tbl[i][j + 1]:
            i += 1
        else:
            j += 1
    return out


def _run(a, b):
    """-> (head, tail) counts of shared leading and trailing tokens."""
    h = 0
    while h < len(a) and h < len(b) and a[h] == b[h]:
        h += 1
    t = 0
    while (t < len(a) - h and t < len(b) - h
           and a[len(a) - 1 - t] == b[len(b) - 1 - t]):
        t += 1
    return h, t


# -- rhyme keys, declared -----------------------------------------------------
#
# `rhyme_scheme_preserved` is a claim about SOUND, so it needs a phonology, and
# a phonology is a coordinate rather than a default. With no key declared the
# flag is None -- "cannot tell" -- and the refusal is recorded. That is
# doctrine 28 and doctrine 45 in one place: a checker that silently picks a
# phonology is making a claim it never states, and a silent False here would
# be a claim about Sanskrit made by CMUdict.


def rime_orthographic(word):
    """A SPELLING proxy: from the last vowel letter to the end.

    Labelled a proxy because it is one. It reads `slow` and `go` as different
    rimes and they rhyme; use it only where no phonology is available, and
    read `Return.declaration.rhyme_key` before quoting the flag it produced.
    """
    w = normalise_line(word)
    m = list(re.finditer(r"[aeiouy]+", w))
    return w[m[-1].start():] if m else w


def rime_cmudict(lex=None):
    """-> a key function on the project's declared phonology.

    CMUdict General American, phones from the last stressed vowel of the word
    to the end, stress digits dropped. This is an IDENTITY key -- perfect
    rhyme only -- and therefore STRICTER than the graded band: a True from it
    is a strong claim and a False means "not preserved under perfect-rhyme
    identity", never "does not rhyme". A word the dictionary does not hold
    returns None, and None propagates to a REFUSAL rather than to a False
    (doctrine 79).
    """
    if lex is None:
        import lyric_harness as LH
        lex = LH.Lexicon()

    def key(word):
        w = normalise_line(word).strip("'")
        if not w:
            return None
        phones = lex.entries.get(w)
        if not phones:
            import lyric_harness as LH
            got, oov = lex.transcribe_word(w)
            if oov or not got:
                return None
            phones = [got]
            del LH
        p = list(phones[0])
        idx = None
        for i in range(len(p) - 1, -1, -1):
            if p[i][-1] in "012" and p[i][-1] != "0":
                idx = i
                break
        if idx is None:
            for i in range(len(p) - 1, -1, -1):
                if p[i][-1] in "012":
                    idx = i
                    break
        if idx is None:
            return None
        return " ".join(re.sub(r"[012]$", "", ph) for ph in p[idx:])

    return key


def _end_word(line):
    ts = tokens(line)
    return ts[-1] if ts else ""


def _rhyme_code(lines, rhyme_key):
    """-> canonical partition of the end words, or None if any is unreadable.

    None is a refusal, not a scheme. A partition built with one class missing
    would silently compare a four-line chorus against a three-line reading of
    itself.
    """
    from quality import schemes as S
    keys = []
    for l in lines:
        k = rhyme_key(_end_word(l))
        if k is None:
            return None
        keys.append(k)
    return S.canonical(keys)


@dataclass
class Return:
    """One pair of returns, MEASURED. There is no boolean on this object."""
    kind: str
    qualities: frozenset
    #: line-level Levenshtein under the declared normalisation, or None when
    #: the comparison was refused (a stub points, it does not reproduce)
    line_distance: int = None
    #: word-level Levenshtein summed over the alignment, or None
    token_distance: int = None
    #: 1-based indices WITHIN the section that survived unchanged
    invariant_lines: tuple = ()
    #: (index_first, index_again, before, after, token_edits) for lines that moved
    varied_lines: tuple = ()
    #: (head_run, tail_run) shared token runs, minimum over the varied lines
    invariant_runs: tuple = (0, 0)
    rhyme_scheme_preserved: bool = None
    tune_slot_preserved: bool = None
    declaration: VariationDeclaration = field(
        default_factory=VariationDeclaration)
    refusals: tuple = ()

    @property
    def gloss(self):
        return _KIND_GLOSS.get(self.kind, "")

    def describe(self):
        def flag(v):
            return {True: "yes", False: "no", None: "CANNOT TELL"}[v]
        d = self.declaration
        rows = [f"return: {self.kind} -- {self.gloss}",
                f"  line distance   {self.line_distance}"
                f"   token distance {self.token_distance}",
                f"  invariant lines {list(self.invariant_lines)}"
                f"   moved {[v[0] for v in self.varied_lines]}",
                f"  rhyme scheme preserved  {flag(self.rhyme_scheme_preserved)}"
                f"   (key: {d.rhyme_key or 'NONE DECLARED'})",
                f"  tune slot preserved     "
                f"{flag(self.tune_slot_preserved)}",
                f"  shared head/tail runs   {self.invariant_runs} tokens",
                f"  declaration: normalisation={d.normalisation!r} "
                f"lexical_max_tokens={d.lexical_max_tokens} "
                f"min_invariant_run={d.min_invariant_run} "
                f"restatement_overlap={d.restatement_overlap}"]
        for v in self.varied_lines:
            rows.append(f"    L{v[0]}  {v[2]!r}\n         ->  {v[3]!r}"
                        f"   ({v[4]} word edits)")
        for r in self.refusals:
            rows.append(f"  {r}")
        return "\n".join(rows)


def compare_returns(first, again, decl=None, rhyme_key=None,
                    first_slot=None, again_slot=None, stub_test=None):
    """Two returns of one section -> a `Return`. Never "same" or "different".

    `first` and `again` are LINE LISTS -- the object is deliberately not a
    Section, because the corpus has 2,739 marked repeat blocks and not one of
    them is placed on a bar grid. Pass `first_slot`/`again_slot` (from
    `Song.slot_profile`) when the song IS placed and the tune-slot flag becomes
    answerable; leave them off and it stays None, which is "cannot tell" and
    not "no".

    THE PAIRING RULE, DECLARED. Equal line counts align POSITIONALLY: line k
    of the return answers line k of the first, because that is what occupying
    the same slot means. Unequal counts align by longest common subsequence,
    which is what finds a truncation or an added line. The rule is stated
    because it decides the answer.
    """
    decl = decl or VariationDeclaration()
    if rhyme_key is not None and not decl.rhyme_key:
        decl = VariationDeclaration(
            decl.normalisation, decl.lexical_max_tokens,
            decl.min_invariant_run, decl.restatement_overlap,
            rhyme_key="UNNAMED KEY -- declare its name")
    a = [l for l in first if normalise_line(l)]
    b = [l for l in again if normalise_line(l)]
    na = [normalise_line(l) for l in a]
    nb = [normalise_line(l) for l in b]
    refusals = []

    if stub_test is None:
        try:
            import lyric_harness as LH
            stub_test = LH.is_chorus_stub
        except Exception:
            stub_test = lambda _l: False          # noqa: E731
    if b and any(stub_test(l) for l in b) and len(b) < len(a):
        return Return(
            kind="STUB", qualities=frozenset({"STUB"}),
            line_distance=None, token_distance=None,
            declaration=decl,
            refusals=(Refusal(
                "STUB_RETURN",
                "the return is an abbreviated reference, not a reproduction",
                f"{b[0]!r} points at the {len(a)}-line block it abbreviates. "
                f"Reporting an edit distance here would charge the PRINTER's "
                f"space-saving convention to the writer (doctrine 79); the "
                f"stub must be resolved against its target before any "
                f"distance means anything, and only the exclusion is built "
                f"(MISSING.md A-1)."),))

    if len(na) == len(nb):
        pairs = [(i, i) for i in range(len(na))]
        unmatched_a = unmatched_b = 0
    else:
        keep = _lcs_pairs(na, nb)
        matched_a = {i for i, _ in keep}
        matched_b = {j for _, j in keep}
        pairs = keep + [(i, None) for i in range(len(na))
                        if i not in matched_a] \
                    + [(None, j) for j in range(len(nb))
                       if j not in matched_b]
        pairs.sort(key=lambda p: (p[0] if p[0] is not None else 1e9))
        unmatched_a = len(na) - len(matched_a)
        unmatched_b = len(nb) - len(matched_b)

    invariant, varied, tok_dist = [], [], 0
    for i, j in pairs:
        if i is None or j is None:
            tok_dist += len(tokens(a[i] if j is None else b[j]))
            continue
        if na[i] == nb[j]:
            invariant.append(i + 1)
            continue
        e = _lev(tokens(a[i]), tokens(b[j]))
        tok_dist += e
        varied.append((i + 1, j + 1, a[i], b[j], e))

    line_dist = _lev(na, nb)
    runs = [(_run(tokens(v[2]), tokens(v[3]))) for v in varied]
    head_run = min((r[0] for r in runs), default=0)
    tail_run = min((r[1] for r in runs), default=0)

    rhyme_ok = None
    if rhyme_key is None:
        refusals.append(Refusal(
            "NO_RHYME_KEY",
            "rhyme-scheme preservation was not measured: no phonology was "
            "declared",
            "pass rhyme_key=rime_cmudict() for the project's General American "
            "reading, or rime_orthographic for the labelled spelling proxy. "
            "A silent default here would make a claim about a language "
            "nobody named (doctrine 45)."))
    else:
        ca = _rhyme_code(a, rhyme_key)
        cb = _rhyme_code(b, rhyme_key)
        if ca is None or cb is None:
            refusals.append(Refusal(
                "END_WORD_UNREADABLE",
                "rhyme-scheme preservation refused: an end word is outside "
                "the declared phonology",
                f"first={'readable' if ca else 'UNREADABLE'} "
                f"again={'readable' if cb else 'UNREADABLE'}. A False here "
                f"would charge the dictionary's gap to the writer."))
        else:
            rhyme_ok = (ca == cb)

    slot_ok = None
    if first_slot is not None and again_slot is not None:
        slot_ok = (tuple(first_slot) == tuple(again_slot))

    q = set()
    if not varied and not unmatched_a and not unmatched_b:
        q.add("VERBATIM")
    if invariant:
        q.add("PARTIAL_RETURN")
    if len(na) != len(nb):
        if unmatched_b == 0 and unmatched_a > 0 and not varied:
            q.add("TRUNCATED_RETURN")
        if unmatched_a == 0 and unmatched_b > 0 and not varied:
            q.add("EXTENDED_RETURN")
    if len(na) == len(nb) and varied and all(
            v[4] <= decl.lexical_max_tokens for v in varied):
        q.add("LEXICAL_VARIATION")
    if (len(na) == len(nb) and len(na) >= 3 and varied
            and 1 in invariant and len(na) in invariant):
        q.add("FRAME_PRESERVED")
    if varied and head_run >= decl.min_invariant_run:
        q.add("HEAD_PRESERVED")
    if varied and tail_run >= decl.min_invariant_run:
        q.add("TAIL_PRESERVED")
    if "HEAD_PRESERVED" in q and "TAIL_PRESERVED" in q:
        q.add("HEAD_AND_TAIL_PRESERVED")
    if rhyme_ok and len(na) == len(nb) and varied:
        q.add("RHYME_PRESERVING_REWRITE")
    ta, tb = set(), set()
    for l in a:
        ta |= set(tokens(l))
    for l in b:
        tb |= set(tokens(l))
    overlap = len(ta & tb) / len(ta | tb) if (ta | tb) else 0.0
    if (len(na) == len(nb) and not invariant
            and overlap >= decl.restatement_overlap):
        q.add("RESTATEMENT")
    if not q:
        q.add("UNRELATED")

    kind = next(k for k, _ in VARIATION_KINDS if k in q)
    return Return(kind=kind, qualities=frozenset(q),
                  line_distance=line_dist, token_distance=tok_dist,
                  invariant_lines=tuple(invariant),
                  varied_lines=tuple(varied),
                  invariant_runs=(head_run, tail_run),
                  rhyme_scheme_preserved=rhyme_ok,
                  tune_slot_preserved=slot_ok,
                  declaration=decl, refusals=tuple(refusals))


__all__ = ["Meter", "Line", "Section", "Song", "GridFinding",
           "uniformity", "stanza_lock", "phrase_profile"]
