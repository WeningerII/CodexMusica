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
lines to a section — and, since a session cleared the fifth of those by adding
one constant, every line that is NOT on a downbeat carrying the same pickup as
all the others. A song that scores high on all seven has been written by the
grid rather than on it. `stanza_lock()` returns the findings, and it names
which shape it sees rather than passing in silence when the first shape has
been swapped for the second (doctrine 24).

This is the FIRST structural-cliche detector in the repo. Everything before it
worked at the word and rhyme-pair level -- CLICHE_PAIR, PREDICTABLE_RHYME --
and would happily certify the most exhausted form in popular music as clean,
which is exactly what it did. CORRECTED 2026-08-14: this read "measured
cliche at the word and rhyme-pair level", and neither of those two measures
cliche. `CLICHE_PAIR` is membership in a hand-typed 30-pair list whose overlap
with the corpus's own most-dispersed rhymes is 4 of 30, and
`PREDICTABLE_RHYME` is a rank inside a candidate field; `quality/floor.py`'s
CLICHE_PAIR docstring section and `quality/phrase_commonplace.py` both refuse
the over-familiarity claim outright. The sentence's point -- structure versus
word -- is unaffected; the word "measured" was not earned.

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
import json
import os
import re
import unicodedata
from collections import Counter
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
    #: Did the SIGNATURE above come from a declaration, or from these two
    #: defaults? Added 2026-08-14, because `groups` refused an undeclared
    #: value one line up while `beats`/`unit` silently became common time —
    #: half of one declaration failing safe and half failing silent, directly
    #: under a docstring reading "Arbitrary; nothing here privileges 4/4".
    #:
    #: TRUE by default on purpose. Writing `Meter()` in Python IS a
    #: declaration — a person chose it. What cannot tell is a blueprint
    #: READER looking at a section with no `meter` key, so
    #: `song_from_blueprint` is the only site that passes False. `quality/
    #: fit.py` carries the same coordinate on `Placement.meter_declared` and
    #: raises `UNDECLARED_METER` from it.
    declared: bool = True
    #: WHOSE assumption, when `declared` is False. Empty and
    #: undeclared is unreachable through the reader, which
    #: refuses; this is either a declaration or a named guess.
    assumed: str = ""

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


class SpecialisationMismatch(ValueError):
    """A section declared a SPECIALISATION whose differentia it does not meet
    (M-57, 2026-08-28).  `Section(bars=13, function='middle-eight')` used to
    store `'bridge'` — the door accepted a specialisation and discarded it,
    silently widening to the genus.  A mismatch is a contradiction between
    two things the writer declared (the name and the bar count), so it
    REFUSES with both quoted, the same family as a blueprint/draft length
    mismatch — a `ValueError`, so every CLI path that turns those into
    `REFUSED …` exit 2 catches this one identically.
    """


@dataclass(frozen=True)
class Specialisation:
    """One row-LESS specific name under a genus row (M-57).

    `aliases` models SYNONYMY — symmetric, a dialect naming the SAME
    function.  This models SUBSUMPTION — asymmetric: every middle-eight is a
    bridge and not every bridge is a middle-eight.  The whole content of the
    claim is the DIFFERENTIA, so it is recorded as a checkable coordinate
    (`middle-eight` is `bridge` + `bars == 8`) rather than as prose, and the
    `evidence` quotes the gloss that has argued the subsumption since the
    row was written — checked at import against the genus row's own gloss,
    the same discipline placement claims obey.

    A record lives ON its genus row (`FunctionSpec.narrower`), never in a
    hand-written map, so the claim cannot exist without a row behind it
    (doctrine 1 — the rule the alias map already follows).  The other shape
    of the same relation — a specific that HAS its own row (`burden` is a
    kind of `refrain` and keeps its row because the corpus marks the two
    differently) — is `FunctionSpec.specialises` on the specific's row.
    """
    name: str                 # the canonical specific name, e.g. "middle-eight"
    spellings: tuple          # every spelling that declares it
    differentia_field: str    # the Section field the claim reads, e.g. "bars"
    differentia_value: int    # the value the claim requires
    evidence: str             # quoted from the genus row's gloss


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
    #: THE WORLD'S OWN NAMES FOR THIS FUNCTION (2026-08-18) — the same move
    #: `structures.Structure.aliases` makes for rhyme rows: a genre dialect
    #: naming the same function is a CLAIM, and this file's own rule is that
    #: claims live in the vocabulary WITH a gloss, never in the spellings
    #: table. The bridge row's gloss had made the middle-8 claim in prose
    #: since it was written while `as_function("middle-eight")` refused —
    #: the claim existed and was not resolvable, which is doctrine 48's
    #: shape one field over. Each alias is enumerated in its spellings the
    #: way `_FUNCTION_SPELLINGS` already enumerates, explicit over clever.
    #: SYNONYMS ONLY since 2026-08-28 (M-57): three of this field's five
    #: claims were SUBSUMPTION wearing synonymy's symmetric field —
    #: `middle-eight` is not another name for a bridge, it is a KIND of
    #: bridge with a differentia (`bars == 8`) the alias route accepted at
    #: the door and discarded. Those claims moved to `narrower` below.
    aliases: tuple = ()
    #: SPECIALISATIONS OF THIS ROW THAT CARRY NO ROW OF THEIR OWN (M-57) —
    #: `Specialisation` records, asymmetric, each with its differentia and
    #: the gloss quote that states the subsumption. Resolution KEEPS the
    #: declared name (`Section.specialised_as`) and CHECKS the differentia;
    #: a mismatch REFUSES rather than silently widening to the genus.
    narrower: tuple = ()
    #: THE OTHER SHAPE OF THE SAME RELATION (M-57): this row IS a kind of
    #: the named row while keeping its own row. `burden` specialises
    #: `refrain` — its own gloss says "a refrain sung by all" — and the two
    #: stay separate rows because the corpus marks them differently
    #: (doctrine 24). Before this field the table could only say the two
    #: were UNRELATED; the alias route could only say they were IDENTICAL;
    #: what is true is one is a kind of the other. Asymmetric: the SPECIFIC
    #: names its genus, never the reverse.
    specialises: str = ""
    #: the quoted phrase from THIS row's own gloss stating the subsumption —
    #: checked at import, the same discipline `placement_evidence` obeys.
    specialises_evidence: str = ""

    # -- WHERE THIS FUNCTION CAN GO (2026-08-22, `MISSING.md` M-54) --------
    #
    # THE RULE THIS LAYER OBEYS, AND IT IS THE WHOLE SAFETY ARGUMENT: a
    # placement coordinate may only ever DENY. Anything not denied stays
    # reachable, so `verse` carries none of these fields and may open a song,
    # close one, or sit anywhere. An allow-list would have had to enumerate
    # {first, mid, last} and would go stale the moment a shape nobody
    # enumerated turned up -- which is the owner's "move 37" ban aimed at
    # structure instead of at rhyme.
    #
    # AND A DENIAL IS ADMISSIBLE ONLY IF IT IS DEFINITIONAL. The test, applied
    # per row: VIOLATE IT -- is the result a NOVEL SONG, or a MISLABELLED
    # SECTION? A prechorus with no chorus is not an experimental structure;
    # the word means BEFORE THE CHORUS, so the section is simply something
    # else. Mislabelled, so it prunes. Verse-chorus-verse-chorus-bridge
    # violated is a novel song -- a CONVENTION, which belongs in
    # `FormConvention` as a note and never near the planner (doctrine 6).
    #
    # WHY THESE FOUR KINDS AND NOT ONE `position` FIELD. M-54's first design
    # was `position in {first, last, free}`, and its own derivation refuted
    # it: read out of the glosses by keyword it claimed a position for 11 of
    # 21 rows and got 4 wrong, every failure a RELATIONAL fact flattened into
    # an ABSOLUTE one and inverted. `false_ending` came out "last" on the word
    # *close* when its definition is that the song comes back from it;
    # `turnaround` and `interlude` are BETWEEN things; `reprise` needs
    # something earlier. Exactly three rows carry a genuine boundary fact and
    # everything else falls out of a dependency, so position is mostly
    # DERIVED. `quality/SECTION_CONSTRAINTS_DESIGN.md` is the argument.

    #: "first" | "last" | "" -- an edge of the WHOLE SONG. Three rows.
    boundary: str = ""
    #: functions that must be present in the song AT ALL for this one to mean
    #: what it says. A precondition on the ROSTER, checked before any ordering
    #: question is asked: "this song has no chorus, so it has neither a pre-
    #: nor a post-chorus" is this field and not an adjacency one.
    requires: tuple = ()
    #: this function sits IMMEDIATELY AFTER a section of the NAMED function.
    #: Strictly stronger than `requires`, and separate from it because a row
    #: can need a chorus to exist without needing to touch one.
    adjacent_after: str = ""
    #: ...and immediately BEFORE one.
    adjacent_before: str = ""
    #: requires SOME section before it -- any function, just not the first
    #: thing in the song. This is where three of the four failed keyword
    #: derivations actually live.
    needs_before: bool = False
    #: ...and some section after it, so not the last thing in the song.
    needs_after: bool = False
    #: THE PHRASE THAT LICENSES EVERY CLAIM ABOVE, quoted from a gloss in this
    #: vocabulary -- usually this row's own. Not decoration: `test_grid`
    #: asserts the quotation really occurs, so a placement claim cannot be
    #: added without evidence a reader can check (doctrine 45 -- a checker
    #: that silently picks is the bug, and so is a table that silently
    #: asserts).
    placement_evidence: str = ""
    #: WHY NO CLAIM WAS MADE, when the gloss WAS consulted and did not decide.
    #: `verse` has no constraint because nothing denies it; `tag` has none
    #: because its gloss says "closing a section OR THE SONG" and carries both
    #: readings at once. Those are different states and a table that rendered
    #: them identically would be doctrine 20 in a dataclass. Mutually
    #: exclusive with every claim field above.
    placement_refused: str = ""
    #: WHAT KIND OF OBJECT THIS FUNCTION IS — `MISSING.md` M-56, closed
    #: 2026-08-22. Three values:
    #:
    #:   "section"   a SPAN of lines the planner can draw as a cell.
    #:   "line"      a returning LINE or couplet inside or after a stanza.
    #:               Not a span, so a cell grammar can never draw one and a
    #:               placement coordinate on one would answer a question about
    #:               the wrong kind of object.
    #:   "fragment"  a phrase, shorter than a line.
    #:
    #: THIS WAS ALREADY DECIDED AND ONLY EVER WRITTEN IN PROSE, which is the
    #: defect doctrine 48 names: `quality/plan.py`'s roster comment excluded
    #: `refrain`/`burden` as "line-level per their own glosses" and `hook` as
    #: "properly a fragment", and nothing could read that. Now the glosses'
    #: own words are the field: `refrain` says "a returning line or couplet
    #: INSIDE or after a stanza, not a standalone section"; `burden` says "a
    #: refrain sung by all"; `hook` says "A hook is properly a FRAGMENT
    #: (MISSING.md D-2)". The value is read off the declaration, not invented
    #: beside it.
    kind: str = "section"


def _spec(name, gloss, recurrence, returns_as, contrasts_with=(),
          aliases=(), boundary="", requires=(), adjacent_after="",
          adjacent_before="", needs_before=False, needs_after=False,
          placement_evidence="", placement_refused="", kind="section",
          narrower=(), specialises="", specialises_evidence=""):
    return FunctionSpec(name, gloss, recurrence, returns_as, contrasts_with,
                        aliases=aliases, narrower=narrower,
                        specialises=specialises,
                        specialises_evidence=specialises_evidence,
                        boundary=boundary, requires=requires,
                        adjacent_after=adjacent_after,
                        adjacent_before=adjacent_before,
                        needs_before=needs_before, needs_after=needs_after,
                        placement_evidence=placement_evidence,
                        placement_refused=placement_refused, kind=kind)


#: THE VOCABULARY. D-1 asked for it by name. Every entry is declared here and
#: nowhere else; `as_function` accepts exactly these keys.
SECTION_FUNCTIONS = {s.name: s for s in (
    _spec("intro", "opens the song; may state material that returns later",
          "once", "n/a",
          boundary="first", placement_evidence="opens the song"),
    # NO PLACEMENT CLAIM, AND NO REFUSAL EITHER -- the two empty states are
    # different and this row is the first one. A verse may open a song, close
    # one, or sit anywhere; nothing in its gloss denies any position, so
    # nothing here does. That is the answer to the owner's "does verse know it
    # can be first, free, and/or last": it does not need to, because the layer
    # only ever denies.
    _spec("verse", "carries the narrative; returns with NEW WORDS on the same "
          "tune", "returns", "new words"),
    _spec("prechorus", "lifts from verse into chorus; a distinct function, "
          "not a short verse", "returns", "varied", ("verse", "chorus"),
          requires=("chorus",), adjacent_before="chorus",
          placement_evidence="lifts from verse into chorus"),
    _spec("chorus", "the returning section; the one place where REPEAT is the "
          "requirement rather than the violation (doctrine 3)",
          "returns", "verbatim", ("verse",)),
    _spec("postchorus", "returns immediately after the chorus and is not part "
          "of it", "returns", "verbatim", ("chorus",),
          requires=("chorus",), adjacent_after="chorus",
          placement_evidence="returns immediately after the chorus"),
    _spec("refrain", "a returning line or couplet INSIDE or after a stanza, "
          "not a standalone section", "returns", "verbatim",
          # KIND READ OFF THIS ROW'S OWN GLOSS (M-56, 2026-08-22): "a
          # returning LINE or couplet ... NOT a standalone section". A cell
          # grammar draws spans, so it can never draw this, and that is not a
          # gap in the planner — it is this function being a different kind of
          # object. `quality/plan.py` had the same sentence in a comment
          # nothing could read.
          kind="line"),
    # THE POSITION CLAUSE WAS FALSE AND THE COUNT WAS STALE -- both repaired
    # 2026-08-21 against the corpus this row describes.  It read "often
    # printed before the first stanza": MEASURED, **1,580 of 1,580 [BURDEN]
    # blocks in `corpus/song/eng_*.txt` follow a VERSE block and NOT ONE
    # stands before the first stanza**.  The marks that do appear there are
    # REFRAIN and CHORUS.  A gloss is what a later session reads to decide
    # whether a printing is a burden, so a false positional claim here is a
    # staging instruction, not a note.  The SEPARATION argument is untouched
    # and is what the row is for; only the evidence offered for it moved.
    _spec("burden", "a refrain sung by all, printed AFTER a stanza in every "
          "staged instance (1,580 of 1,580, measured 2026-08-21 -- the marks "
          "that open a song are `refrain` and `chorus`); kept SEPARATE from "
          "`refrain` because the corpus marks the two differently and "
          "collapsing them would delete a distinction ~~1,776~~ 1,580 blocks "
          "already carry (doctrine 24)",
          "returns", "verbatim",
          # SAME KIND AS `refrain`, and for the reason this row's own gloss
          # gives: a burden IS "a refrain sung by all". Its placement claim
          # (after a verse, 1,580 of 1,580) is about where the LINE is
          # printed, not about a span the planner draws.
          kind="line",
          # BOTH STATEMENTS AT ONCE (M-57): a burden is a KIND of refrain
          # AND keeps its own row. The alias route could only say the two
          # were identical; separate rows alone could only say they were
          # unrelated; what is true is subsumption, stated asymmetrically
          # here with the row's own gloss as the evidence.
          specialises="refrain",
          specialises_evidence="a refrain sung by all",
          requires=("verse",), adjacent_after="verse",
          # THE ONLY PLACEMENT CLAIM IN THIS TABLE BACKED BY A MEASURED RATE
          # RATHER THAN A DEFINITION -- 1,580 of 1,580, and the row already
          # carries the measurement. It is admissible on the same test as the
          # rest: a "burden" printed before the first stanza is not a novel
          # structure, it is what this corpus marks REFRAIN or CHORUS.
          placement_evidence="printed AFTER a stanza in every staged "
                             "instance"),
    _spec("bridge", "appears once and CONTRASTS; a middle-8 is a bridge whose "
          "bar count happens to be 8, which this model already records, so it "
          "is not a separate function", "once", "n/a", ("verse", "chorus"),
          # TRUE SYNONYMS ONLY (M-57): the middle-eight family moved to
          # `narrower` below, because "another name for" and "a kind of"
          # are different claims and this field's own doc says it models
          # the first. `departure-section` stays — it names the same
          # function with no differentia.
          aliases=("departure-section", "departure section",
                   "departure_section"),
          # THE GLOSS HAS ARGUED THIS SINCE THE ROW WAS WRITTEN and the
          # alias route was accepting the claim and discarding it —
          # `Section(bars=13, function='middle-eight')` stored 'bridge',
          # measured in M-57. The differentia IS the claim, so it is a
          # checkable coordinate now: kept on the section as
          # `specialised_as`, checked against `bars`, a mismatch REFUSING
          # rather than silently widening to the genus.
          narrower=(Specialisation(
              name="middle-eight",
              spellings=("middle-eight", "middle eight", "middle_eight",
                         "middle-8", "middle 8", "middle8"),
              differentia_field="bars", differentia_value=8,
              evidence="a middle-8 is a bridge whose bar count happens "
                       "to be 8"),)),
    _spec("breakdown", "strips the arrangement back", "open", "varied"),
    _spec("build", "raises tension toward a return", "open", "varied"),
    # REFUSED IN BOTH DIRECTIONS, and the asymmetry is why. `drop`'s gloss
    # defines it BY REFERENCE to a build, which is not the same as requiring
    # one -- a drop can arrive without a formal build section. And `build`'s
    # own gloss says only "raises tension toward a return", which does not
    # name a drop, so the edge cannot be licensed from that side either
    # without citing a row that is not its own. An owner ruling, not a
    # reading.
    _spec("drop", "the arrival a build points at", "returns", "varied",
          placement_refused="'the arrival a build points at' defines a drop "
                            "by reference to a build without requiring one, "
                            "and `build`'s own gloss names no drop. The edge "
                            "is a ruling, not a reading.",
          # ATTEMPTED AND WITHDRAWN, 2026-08-22, and recorded because the
          # attempt found something. Deriving `quality/plan._CELLS` from
          # these fields made `("build", "drop")` vanish — the literal had
          # hard-coded that pair while NEITHER row declared an adjacency —
          # and the first move was to add `adjacent_after="build"` here so
          # the derivation would reproduce it. THE REFUSAL ABOVE REFUSED
          # THAT, and the import-time claim/refusal check enforced it: a
          # drop may follow a breakdown, so the gloss references a build
          # WITHOUT requiring one, and "the edge is a ruling, not a
          # reading" is exactly right. The pair stays undeclared.
          # WHAT IS LOST BY THAT, measured rather than waved at: NOTHING
          # functional. `build` and `drop` each keep a singleton cell, and
          # the pattern sampler can still place them adjacently by drawing
          # the two cells in sequence — what it no longer does is treat the
          # pair as a PREFERRED unit, which is what a ruling nobody made
          # was buying
          ),
    _spec("vamp", "a repeating figure held open", "open", "varied"),
    # THE KEYWORD DERIVATION READ THIS AS `last`, on "the end of one section".
    # It is a SEAM: it needs a section on BOTH sides, so it can be neither
    # first nor last, which is the opposite of what an absolute reading gave.
    _spec("turnaround", "carries the end of one section into the next",
          "returns", "verbatim",
          needs_before=True, needs_after=True,
          placement_evidence="carries the end of one section into the next"),
    _spec("interlude", "instrumental or spoken span between sung sections",
          "open", "n/a",
          needs_before=True, needs_after=True,
          placement_evidence="between sung sections",
          aliases=("instrumental-break", "instrumental break",
                   "instrumental_break")),
    _spec("solo", "an instrumental span over section material", "open", "n/a",
          aliases=("instrumental-solo", "instrumental solo",
                   "instrumental_solo")),
    # REFUSED, AND THE REFUSAL IS THE POINT. Both readings live in one
    # sentence and picking either would answer a question the vocabulary has
    # not decided (doctrine 20). A tag closing a SECTION is mid-song; a tag
    # closing THE SONG is last; the gloss asserts both.
    _spec("tag", "a short repeated fragment closing a section or the song",
          "returns", "verbatim",
          placement_refused="its gloss says 'closing a section OR THE SONG' "
                            "-- a section-final tag is mid-song and a "
                            "song-final tag is last, and the row asserts "
                            "both. Picking one would settle by table order "
                            "what the vocabulary has not settled."),
    _spec("hook", "a section that IS the hook. A hook is properly a FRAGMENT "
          "(MISSING.md D-2) and `Hook` below is the object for that; this "
          "entry covers the post-chorus-hook case where a whole section "
          "carries it", "returns", "verbatim"),
    _spec("coda", "a closing section with its own material", "once", "n/a",
          boundary="last", placement_evidence="a closing section"),
    _spec("outro", "closes the song and does not recur", "once", "n/a",
          boundary="last", placement_evidence="closes the song"),
    # THE SHARPEST OF THE FOUR. An absolute reading makes a false ending the
    # LAST section, on the word *close*, and its whole definition is that it
    # is not: the song COMES BACK FROM it, so something must follow.
    _spec("false_ending", "a close the song comes back from", "once", "n/a",
          needs_after=True,
          placement_evidence="a close the song comes back from"),
    _spec("reprise", "a declared return of earlier material, later and "
          "changed", "once", "varied",
          needs_before=True,
          placement_evidence="a declared return of earlier material"),
)}

#: The alias map, derived from the rows' own declarations — never written
#: by hand here, so a claim cannot exist in the map without living on its
#: row (doctrine 1). First declaration wins, and a collision with a real
#: function name is refused at import: an alias that shadows a row would
#: silently retype every blueprint using the shadowed name.
_FUNCTION_ALIASES = {}
for _s in SECTION_FUNCTIONS.values():
    for _a in _s.aliases:
        if _a in SECTION_FUNCTIONS:
            raise UnknownFunction(
                f"alias {_a!r} on {_s.name!r} shadows a declared function")
        _FUNCTION_ALIASES.setdefault(_a, _s.name)

#: The specialisation map, derived from the rows' own `narrower` records the
#: same way `_FUNCTION_ALIASES` is derived from `aliases` — never written by
#: hand, so a subsumption claim cannot exist in the map without living on
#: its genus row WITH the differentia and the gloss quote (doctrine 1).
#: Keyed by every declared spelling; the value is (record, genus name).
_SPECIALISATIONS = {}
for _s in SECTION_FUNCTIONS.values():
    for _n in _s.narrower:
        if not _n.evidence or _n.evidence not in _s.gloss:
            raise UnknownFunction(
                f"specialisation {_n.name!r} on {_s.name!r} quotes evidence "
                f"that does not occur in the genus row's own gloss — a "
                f"subsumption claim with no gloss behind it (doctrine 45)")
        for _sp in _n.spellings:
            if _sp in SECTION_FUNCTIONS or _sp in _FUNCTION_ALIASES:
                raise UnknownFunction(
                    f"specialisation spelling {_sp!r} on {_s.name!r} shadows "
                    f"a declared function or alias — one name, two claims")
            _SPECIALISATIONS.setdefault(_sp, (_n, _s.name))

def specialisation_of(name):
    """-> (Specialisation, genus name) for a specialisation NAME, else None.

    Pure and reads only the derived map — the accessor the planner consults
    so it can REFUSE a specialisation by name rather than widening it to the
    genus (M-57): the planner draws bars from the derived envelope and
    cannot promise `bars == 8`, so accepting `middle-eight` there would be
    the door-accepts-and-discards defect one layer out.
    """
    v = str(name).strip().lower()
    v = _FUNCTION_SPELLINGS.get(v, v)
    return _SPECIALISATIONS.get(v)


# THE ROW-TO-ROW SHAPE CHECKS ITSELF AT IMPORT TOO (M-57): a `specialises`
# must name a DIFFERENT declared row, and the evidence must be a phrase of
# the specialising row's OWN gloss — the same discipline placement evidence
# obeys, because a subsumption nobody can trace to a gloss is a claim
# nobody can disagree with in a coordinate.
for _s in SECTION_FUNCTIONS.values():
    if _s.specialises:
        if _s.specialises not in SECTION_FUNCTIONS:
            raise UnknownFunction(
                f"{_s.name!r} specialises {_s.specialises!r}, which is not a "
                f"declared function")
        if _s.specialises == _s.name:
            raise UnknownFunction(f"{_s.name!r} cannot specialise itself")
        if (not _s.specialises_evidence
                or _s.specialises_evidence not in _s.gloss):
            raise UnknownFunction(
                f"{_s.name!r} specialises {_s.specialises!r} with evidence "
                f"that does not occur in its own gloss")

# THE PLACEMENT TABLE CHECKS ITSELF AT IMPORT (2026-08-22, M-54), the same
# move the alias-shadow check one block up already makes. Every one of these
# would otherwise be a claim nobody could disagree with in a coordinate: a
#  naming a function that does not exist, a boundary value outside
# the declared two, a row that both claims and refuses, or -- the one that
# matters most -- a claim with no evidence behind it. A table that can hold a
# placement rule nobody can trace back to a gloss is the  defect this
# entry exists to end (doctrine 45).
_BOUNDARIES = ("first", "last")
_GLOSSES = " || ".join(_s.gloss for _s in SECTION_FUNCTIONS.values())
for _s in SECTION_FUNCTIONS.values():
    _claims = (bool(_s.boundary) or bool(_s.requires) or bool(_s.adjacent_after)
               or bool(_s.adjacent_before) or _s.needs_before or _s.needs_after)
    if _s.boundary and _s.boundary not in _BOUNDARIES:
        raise UnknownFunction(
            f"{_s.name!r} declares boundary {_s.boundary!r}; the declared "
            f"values are {list(_BOUNDARIES)}. An edge of the whole song has "
            f"two sides and no third.")
    for _f in tuple(_s.requires) + (_s.adjacent_after, _s.adjacent_before):
        if _f and _f not in SECTION_FUNCTIONS:
            raise UnknownFunction(
                f"{_s.name!r} names {_f!r} in a placement claim and there is "
                f"no such function. A dependency on a name nobody declared is "
                f"a rule that can never be satisfied or violated.")
    # A boundary and a same-side neighbour requirement contradict: nothing can
    # come before the first section, or after the last.
    if _s.boundary == "first" and _s.needs_before:
        raise UnknownFunction(
            f"{_s.name!r} claims boundary 'first' AND needs_before -- nothing "
            f"can precede the first section.")
    if _s.boundary == "last" and _s.needs_after:
        raise UnknownFunction(
            f"{_s.name!r} claims boundary 'last' AND needs_after -- nothing "
            f"can follow the last section.")
    if _claims and _s.placement_refused:
        raise UnknownFunction(
            f"{_s.name!r} both CLAIMS a placement and REFUSES one. Those are "
            f"the two answers this layer distinguishes (doctrine 20) and a "
            f"row may give one.")
    if _claims and not _s.placement_evidence:
        raise UnknownFunction(
            f"{_s.name!r} claims a placement with no `placement_evidence`. "
            f"Every claim quotes a gloss so a reader can check it; an "
            f"unevidenced rule is the `_CELLS` defect (doctrine 45).")
    if _s.placement_evidence and _s.placement_evidence not in _GLOSSES:
        raise UnknownFunction(
            f"{_s.name!r} offers placement evidence {_s.placement_evidence!r} "
            f"and that phrase occurs in NO gloss in this vocabulary. The "
            f"quotation has to be real or it is decoration.")
    if _s.placement_evidence and not _claims:
        raise UnknownFunction(
            f"{_s.name!r} offers placement evidence and claims nothing.")


def placement_of(function):
    """-> the placement claims for one function, as a plain dict.

    THE ONE READER.  derives its pattern space from this and the
    grader checks a draft against it, so the planner and the grader cannot
    disagree about where a section may go -- which is the shape  had to be collapsed into one constant to fix (doctrine 1).
    """
    sp = SECTION_FUNCTIONS[as_function(function)]
    return {"boundary": sp.boundary, "requires": tuple(sp.requires),
            "adjacent_after": sp.adjacent_after,
            "adjacent_before": sp.adjacent_before,
            "needs_before": sp.needs_before, "needs_after": sp.needs_after,
            "evidence": sp.placement_evidence,
            "refused": sp.placement_refused}


PLACEMENT_CODES = ("SECTION_NOT_AT_BOUNDARY", "SECTION_REQUIREMENT_ABSENT",
                   "SECTION_AT_EDGE", "SECTION_NOT_ADJACENT")


def placement_findings(functions):
    """An ordered list of function names -> [(code, index, evidence), ...].

    THE ONE DEFINITION. `plan.py` prunes its pattern space with this and the
    grader checks a draft with it, so the planner and the grader cannot
    disagree about where a section may go. Two readers of one rule is the
    shape `THETA_COLLISION` had to be collapsed to fix (doctrine 1), and this
    layer is born with a planner and a grader on it, so it is collapsed from
    the start rather than after they drift.

    `None` entries are UNDECLARED sections and are SKIPPED, never guessed at:
    a section nobody typed a function on cannot violate a rule about
    functions, and treating it as a verse is exactly what `as_function`
    refuses to do (doctrine 79 -- a refusal is not a violation). They still
    OCCUPY a position, so a `needs_after` section followed only by undeclared
    sections is NOT charged: something does follow it.

    Every finding carries the row's own `placement_evidence`, so the report
    quotes the gloss that licensed the rule rather than asserting it.
    """
    out = []
    n = len(functions)
    present = {f for f in functions if f}
    for i, f in enumerate(functions):
        if not f:
            continue
        sp = SECTION_FUNCTIONS.get(f)
        if sp is None or sp.placement_refused:
            continue
        ev = sp.placement_evidence
        if sp.boundary == "first" and i != 0:
            out.append(("SECTION_NOT_AT_BOUNDARY", i,
                        f"{f!r} opens the song by definition and sits at "
                        f"position {i + 1} of {n} — {ev!r}"))
        if sp.boundary == "last" and i != n - 1:
            out.append(("SECTION_NOT_AT_BOUNDARY", i,
                        f"{f!r} closes the song by definition and sits at "
                        f"position {i + 1} of {n} — {ev!r}"))
        for r in sp.requires:
            if r not in present:
                out.append(("SECTION_REQUIREMENT_ABSENT", i,
                            f"{f!r} requires a {r!r} and this song has none "
                            f"— {ev!r}"))
        if sp.needs_before and i == 0:
            out.append(("SECTION_AT_EDGE", i,
                        f"{f!r} requires a section before it and opens the "
                        f"song — {ev!r}"))
        if sp.needs_after and i == n - 1:
            out.append(("SECTION_AT_EDGE", i,
                        f"{f!r} requires a section after it and closes the "
                        f"song — {ev!r}"))
        if sp.adjacent_after and (i == 0
                                  or functions[i - 1] != sp.adjacent_after):
            got = functions[i - 1] if i else "the start of the song"
            out.append(("SECTION_NOT_ADJACENT", i,
                        f"{f!r} sits immediately after {sp.adjacent_after!r} "
                        f"by definition; here it follows {got!r} — {ev!r}"))
        if sp.adjacent_before and (i == n - 1
                                   or functions[i + 1] != sp.adjacent_before):
            got = functions[i + 1] if i < n - 1 else "the end of the song"
            out.append(("SECTION_NOT_ADJACENT", i,
                        f"{f!r} sits immediately before "
                        f"{sp.adjacent_before!r} by definition; here it "
                        f"precedes {got!r} — {ev!r}"))
    return out


#: Spelling variants only. NOT a synonym table: `middle8 -> bridge` would be a
#: CLAIM, and claims live in the vocabulary above WITH a gloss — which is
#: where they now do live: `FunctionSpec.aliases`, resolved through
#: `_FUNCTION_ALIASES` above. This table stays spelling-only.
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
    v = _FUNCTION_ALIASES.get(v, v)
    if v in _SPECIALISATIONS:
        # A bare NAME resolves to its genus — this surface holds no bars, so
        # the differentia cannot be asked here. The claim is KEPT and CHECKED
        # where the bars are: `Section.__post_init__` records
        # `specialised_as` and refuses a mismatch (M-57).
        return _SPECIALISATIONS[v][1]
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
    #: THE SPECIALISATION AS DECLARED (M-57) — DERIVED, never passed: a
    #: section declared `middle-eight` resolves `function` to the genus
    #: (`bridge`, so every consumer of the vocabulary key is unmoved) and
    #: keeps the specific name here, so "was this declared as a
    #: middle-eight?" is askable — the question nothing could answer while
    #: the alias route discarded the claim. `""` means the function was
    #: declared as itself or not at all.
    specialised_as: str = ""

    def __post_init__(self):
        raw = self.function
        self.function = as_function(raw)
        self.specialised_as = ""
        if raw is not None and not isinstance(raw, FunctionSpec):
            v = str(raw).strip().lower()
            v = _FUNCTION_SPELLINGS.get(v, v)
            rec_genus = _SPECIALISATIONS.get(v)
            if rec_genus is not None:
                rec, genus = rec_genus
                got = getattr(self, rec.differentia_field)
                if got != rec.differentia_value:
                    # The differentia IS the claim, so a section that
                    # declares the name and fails the claim is contradicting
                    # itself — refused with both halves quoted rather than
                    # silently widened to the genus (M-57's own measurement:
                    # bars=13 used to store 'bridge' and forget).
                    raise SpecialisationMismatch(
                        f"declared {rec.name!r} with "
                        f"{rec.differentia_field}={got}, and the "
                        f"specialisation's own claim is "
                        f"{rec.differentia_field} == "
                        f"{rec.differentia_value} (the {genus!r} gloss: "
                        f"{rec.evidence!r}). REFUSED rather than silently "
                        f"widened to {genus!r} — declare {genus!r} if that "
                        f"is what this section is, or set "
                        f"{rec.differentia_field}={rec.differentia_value} "
                        f"if it is a {rec.name}.")
                self.specialised_as = rec.name

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


def _frac(x):
    """Like `Fraction(x)`, except a FLOAT goes through `str` first.

    `Fraction(0.1)` is `3602879701896397/36028797018963968` -- binary
    floating point's nearest neighbour to a tenth, not a tenth. A blueprint's
    `"beat": 2.5` survives `Fraction(2.5)` exactly (2.5 IS a power-of-two
    fraction), but nothing here should depend on which JSON numbers happen to
    be. `quality.fit._frac` makes the same move for the same reason; this is
    a second copy rather than an import, matching that module's own choice
    not to depend on this one.
    """
    if isinstance(x, Fraction):
        return x
    if isinstance(x, float):
        return Fraction(str(x))
    return Fraction(x)


def song_from_blueprint(obj, assume_meter=None):
    """-> (Song, hooks) from a blueprint dict or path.

    Reads the same `sections`/`lines` shape `quality.fit.from_blueprint`
    reads, independently -- `fit.py` builds `SectionFit`/`Placement`, which
    carry WHERE a line sits and nothing about what a section IS FOR; this
    builds `Section`/`Line` with `function` declared, which is what
    `song_function_report` needs and `fit.py` has no reason to carry. A
    section with no `"function"` key comes back UNDECLARED, exactly like a
    hand-built `Section(...)` that never set one -- this reader adds no
    inference of its own.

    `hooks`, the second item, is the blueprint's own top-level `"hooks"` list
    verbatim (a list of raw phrase strings) -- `hook_findings` already
    coerces each one to a `Hook`, so no wrapping happens here.
    """
    from quality.meter import section_meter
    if isinstance(obj, str):
        with open(obj) as fh:
            obj = json.load(fh)
    secs, bar = [], 1
    for s in obj.get("sections", []):
        # `section_meter` is the SHARED TYPE CHECK -- `fit.from_blueprint`
        # and `lyric_harness._grid_song` read the same field through the
        # same call, so a `"meter": "4/4"` (a STRING, the root
        # blueprint's never-migrated schema) cannot be an accurate
        # refusal here and a bare AttributeError there. It answers `{}`
        # for an absent meter, which is what the DECLARATION check below
        # then refuses -- the two compose and neither replaces the other.
        md = section_meter(s.get("meter"), s.get("name"))
        # Both halves, independently: a section may legally declare `beats`
        # and default `unit`, and calling that "declared" would hide the half
        # that was guessed.
        _declared = ("beats" in md and "unit" in md)
        if not _declared and assume_meter is None:
            # REFUSES, as of 2026-08-14, rather than falling to common time.
            # `quality/fit.py`'s reader does the same and carries the full
            # argument; the two must agree or the `song` verb and the `grid`
            # verb would answer differently about one file.
            raise ValueError(
                f"section {s.get('name')!r} declares no time signature. This "
                f"fell to 4/4 in silence until 2026-08-14, which is the one "
                f"thing this class's own docstring says it does not do: "
                f"'Arbitrary; nothing here privileges 4/4.' Declare "
                f"\"meter\": {{\"beats\": N, \"unit\": D}}, or pass "
                f"assume_meter=fit.AssumedMeter(..., source='who decided') "
                f"and carry the assumption in the report.")
        meter = Meter(
            beats=int(md["beats"]) if _declared else int(assume_meter.beats),
            unit=int(md["unit"]) if _declared else int(assume_meter.unit),
            groups=tuple(md.get("groups", ())), declared=_declared,
            assumed="" if _declared else assume_meter.source)
        start = int(s.get("start_bar", bar))
        secs.append(Section(name=s["name"], bars=int(s["bars"]), meter=meter,
                            start_bar=start,
                            function=s.get("function", UNDECLARED)))
        bar = start + int(s["bars"])

    def owner(l):
        """-> the Section a blueprint line belongs to, name first, then bar.

        NOT `{s.name: s for s in secs}`, which is what this was until the
        repeated-name fix: that dict silently dropped the FIRST of two
        sections called `chorus`, so every line of a verse/chorus/bridge/
        chorus blueprint that named its section resolved to the LAST chorus.
        `Song.lines_in` has refused to key on a name since the demo caught it
        collapsing exactly this song ("Repeated section names are normal and
        are exactly why this cannot key on the name"), and this reader was
        still doing it one screen above the `Line` it builds.
        LATENT RATHER THAN LOUD, and worth saying so: the only field read off
        the owner below is `s.name`, which is the same string for both
        instances, so no output of this function moved. `quality/fit.py`'s
        copy of this same dict read `cycle`/`start_bar`/`bars` off it and was
        NOT latent — it put the first chorus's lines 56 pulses before their
        own downbeat. A defect that is currently invisible because of what
        the caller happens to read is one field away from being visible.

        A declared name still WINS over the bar range when it is unambiguous
        (doctrine 1: a declaration is not silently outranked by inference).
        It cannot win when the writer used it twice, because then it names a
        set; the bar says which member.
        """
        name, bar = l.get("section"), int(l["bar"])
        hits = [s for s in secs if s.name == name]
        if len(hits) == 1:
            return hits[0]
        for s in (hits or []) + secs:
            if s.start_bar <= bar < s.start_bar + s.bars:
                return s
        return secs[-1] if secs else None

    lines = []
    for l in obj.get("lines", []):
        s = owner(l)
        lines.append(Line(text=l.get("text", ""), bar=int(l["bar"]),
                          beat=_frac(l.get("beat", 1)),
                          duration=_frac(l.get("duration", 4)),
                          section=s.name if s else ""))
    return Song(sections=secs, lines=lines, title=obj.get("title", "")), \
        list(obj.get("hooks", []))


# ---------------------------------------------------------------------------
# THE ANTI-CLICHE CHECK
# ---------------------------------------------------------------------------

#: WHAT EACH SHAPE FINDING IS WORTH — the SEVERITY, declared HERE, in the
#: module that owns the codes.
#:
#: IT USED TO LIVE IN A CONSUMER, AS ONE INLINE CONDITIONAL. `revise.
#: _function_findings` read `"flag" if f.code == "HOOK_ABSENT" else "note"`,
#: with thirty lines of docstring in THAT module arguing why — so the whole
#: SHAPE layer's severity was a string comparison in a file that does not
#: define a single one of these codes, and the reasoning was prose (doctrine
#: 48). `quality/gate_census.py` measured the consequence: 21 codes whose
#: severity could not be read at the emitter at all, reported as UNDECIDABLE
#: because that is what they were.
#:
#: THE RULE, and it is one rule with one exception:
#: everything here is measured against `POPULAR_SONG`, a labelled CONVENTION
#: (`FormConvention`, the same move `Meter.conventional_grouping` makes) and
#: NOT a mandate the writer declared. **Doctrine 6: a convention a writer is
#: free to depart from cannot be the thing that fails `verify()`.** 5/4 and an
#: eleven-bar bridge are choices. So: note.
#:
#: `HOOK_ABSENT` is the exception and is different IN KIND: the writer
#: supplied the exact hook TEXT, and whether it occurs in the draft is a
#: factual question with no convention in it — the same shape as
#: `RETURN_NOT_VERBATIM` being a flag while its sibling `RETURN_OUT_OF_RANGE`
#: is a note.
#:
#: `RETURN_SCHEME_DRIFT` IS THE ONE A LATER READER WILL WANT TO PROMOTE, and
#: must not. It is about RHYME, and rhyme is what the mandate flags — but
#: `return_findings` is never handed a mandate, so every answer it gives is
#: against the convention. THE FLAG ALREADY EXISTS ONE LAYER DOWN: a writer
#: who REQUIRES a return declares `schemes.Return(verbatim=True)` and
#: `Mandate.returns_check` breaks it as `RETURN_NOT_VERBATIM`. Promoting this
#: one would fail an undeclared return on a convention AND fail a declared one
#: twice under two names.
SEVERITY = {
    # THE ONE FLAG — a fact about the writer's own supplied text.
    "HOOK_ABSENT": "flag",
    # THE CONVENTION MEASUREMENTS — notes on purpose, every one.
    "BRIDGE_IS_A_VERSE": "note",
    "CROSS_FUNCTION_REPRISE": "note",
    "DOWNBEAT_LOCKED": "note",
    "ELABORATION_UNGROUNDED": "note",
    "HOOK_CONFINED": "note",
    "HOOK_DOES_NOT_RECUR": "flag",
    "METER_LOCKED": "note",
    "PHRASE_LENGTH_LOCKED": "note",
    "QUATRAIN_LOCK": "note",
    "RETURNS_WITH_SAME_WORDS": "note",
    "RETURN_LENGTH_DRIFT": "note",
    "RETURN_LOCKED": "note",
    "RETURN_METER_DRIFT": "note",
    "RETURN_NEVER_RETURNS": "note",
    "RETURN_SCHEME_DRIFT": "note",
    "RETURN_SLOT_DRIFT": "note",
    "SECTION_LENGTH_LOCKED": "note",
    "SINGLE_USE_RECURRED": "note",
    "TITLE_NOT_IN_HOOK": "flag",
    "UNIFORM_ANACRUSIS": "note",
    # THE PLACEMENT LAYER (M-54). These four reach `GridFinding` through the
    # ONE site that passes a VARIABLE code, so neither a reader nor
    # `gate_census.py` could see them by scanning for literals — the census
    # counted 67 codes and these are the 68th through 71st.
    #
    # AND THIS TABLE'S REFUSAL IS WHAT FOUND THEM. The four were absent from
    # the first draft, so `severity_of` would have RAISED on any draft that
    # tripped a placement rule — a crash where the old `else "note"` silently
    # gave the right answer for the wrong reason. No suite caught it: the
    # shipped blueprints trip 0 placement rules (M-54's own measurement), so
    # no fixture reaches the site. The gate caught what the tests could not,
    # which is the argument for a refusal over a default.
    #
    # NOTES, and M-54 settled why: a section's position is a fact about the
    # DECLARATION, not about any line's words, so no rewrite moves it and a
    # flag would spend every round of `max_rounds` and report ROUND_LIMIT —
    # the `uncovered_bars` precedent verbatim.
    "SECTION_AT_EDGE": "note",
    "SECTION_NOT_ADJACENT": "note",
    "SECTION_NOT_AT_BOUNDARY": "note",
    "SECTION_REQUIREMENT_ABSENT": "note",
}

#: The severity a code carries when this table has never heard of it. NOT
#: "note": a code nobody has ruled on is an OPEN QUESTION, and answering it
#: with the lenient default is how a finding joins the silent majority without
#: anybody deciding it should (doctrine 20). `severity_of` REFUSES instead.
UNRULED = None


def severity_of(code):
    """-> "flag" | "note" for one shape code. THE one definition.

    REFUSES on a code no one has ruled on rather than defaulting it, because
    a default here is a ruling nobody made. A new `GridFinding` therefore
    cannot ship until its severity is decided in the table above — which is
    the gate this module did not have, and the reason 21 codes were
    undecidable.
    """
    sev = SEVERITY.get(code, UNRULED)
    if sev is None:
        raise KeyError(
            f"{code!r} has no declared severity in grid.SEVERITY. A shape "
            f"finding is a measurement against a CONVENTION and is almost "
            f"always a note (doctrine 6) — but 'almost always' is not a "
            f"ruling, and defaulting it here would be this module deciding "
            f"by omission. Add the row.")
    return sev


@dataclass
class GridFinding:
    code: str
    message: str
    evidence: str

    @property
    def severity(self):
        """The declared severity, read from `SEVERITY` at the point of use.

        A PROPERTY rather than a field, deliberately: a field would let a
        caller construct a finding whose severity disagrees with the table,
        which is the second-opinion problem this table exists to end.
        """
        return severity_of(self.code)

    def __str__(self):
        return f"[{self.code}] {self.message}\n    {self.evidence}"


def line_pickup(song, line):
    """-> pulses from a line's declared start to the NEXT barline; 0 on a
    downbeat.

    MEASURED TO THE BARLINE, NOT FROM IT, AND THAT IS THE WHOLE POINT. The
    offset `beat - 1` is not commensurable across meters: beat 6.5 of 7/8 and
    beat 3.5 of 4/4 are 5.5 and 2.5 pulses into their bars and are THE SAME
    PICKUP -- 1.5 pulses of run-up. A measure keyed on the offset reads four
    distinct values where the declaration has one, which is exactly how a
    constant hid in a real hand-written blueprint through four time
    signatures.

    `beat` may be <= 0 (`Line` documents it as a pickup before the section's
    first downbeat), so this is a modulus rather than a subtraction.
    """
    m = song.meter_at(line.bar)
    return (Fraction(1) - Fraction(line.beat)) % Fraction(m.beats)


def uniformity(song):
    """-> dict of seven drift measures, each in [0,1]. 1.0 means fully default.

    Reported as measurements, never summed into a score -- the exchange rate
    between them is a genre's answer and belongs in a declaration.

    `uniform_anacrusis` IS THE SEVENTH, AND IT IS HERE BECAUSE THE SIX ABOVE
    IT WERE SATISFIED BY CHEATING. This repo's own song tripped
    DOWNBEAT_LOCKED on its first draft -- 41 lines, all on beat 1 -- and the
    session that wrote it cleared the check by giving every second line a
    pickup of 1.5 pulses. The same 1.5 in 7/8, in 5/4, in 4/4 and in 6/8: ONE
    CONSTANT, alternating with beat 1, chosen without any line being heard.
    `downbeat_locked` fell to 51% and the check went silent, so a defect that
    had been named was replaced by a defect that had no name.

    Doctrine 24: a rule that would delete a category must RELABEL. A uniform
    anacrusis is not the absence of the defect DOWNBEAT_LOCKED names, it is
    the other shape of it -- the words sitting on the grid rather than
    playing against it -- so it gets a name and `stanza_lock` says which one
    it sees.

    1.0 WHEN NOTHING IS ANACRUSTIC, and that is not a bug: this dict measures
    drift TOWARD the default, and a song with no pickup anywhere has not
    drifted from that default, it has arrived at it. DOWNBEAT_LOCKED is the
    name for that case and `stanza_lock` keeps it.
    """
    secs = song.sections
    lines = song.lines
    out = {}

    # (beats, unit), NOT `== Meter(4, 4)`. `Meter` is frozen and carries
    # `groups`, so the equality read a DECLARED GROUPING as "not 4/4": adding
    # `groups: [2, 2]` to this repo's own chorus dropped `four_four` from 29%
    # to 0% without one bar changing. That is the cheat this function was
    # rewritten for, found a second time inside the function itself, and it is
    # the worse instance -- a song could clear METER_LOCKED by declaring a
    # grouping, which is a coordinate about where the BEATS are and says
    # nothing whatever about whether the song is in four.
    # EVERY SECTION STATISTIC IS WEIGHTED BY THE MASS THAT SECTION CARRIES
    # (`MISSING.md` M-75, 2026-08-23) — bars for the metric locks, lines for
    # the lyric ones. ~~a plain fraction of SECTIONS~~ is what the owner's
    # anecdote defeats: *"it made all quatrains and ended with a 2 line outro
    # which technically satisfied it but that's blatantly just gaming the
    # system."* A count of sections gives every section the same vote, so
    # appending ONE two-line tag moves the denominator by 1/n and silences
    # every lock in a song of fewer than ten sections — a duck that costs
    # nothing and adds nothing.
    #
    # WHAT THE WEIGHT CHANGES IS THE PRICE OF THE DUCK, and that is the whole
    # claim. Under a section count the duck costs exactly one section however
    # long the song is; under mass it costs a share of the song, so silencing
    # a lock means giving the form a section big enough to be heard — which
    # is the thing `SECTION_LENGTH_LOCKED`'s own message asks for ("a section
    # that ARRIVES early or overstays is where structure becomes audible").
    # It is NOT un-duckable and must not be described as such: a large enough
    # off-modal section still clears it, and at that size the form does have
    # a shape of its own. Doctrine 22 — the honest statement is what the duck
    # COSTS, not that it is impossible.
    #
    # AND IT IS A DERIVATION, NOT A CALIBRATION (owner's ruling 2026-08-23,
    # *"derived envelope not rate-matching"*). No corpus rate is consulted
    # and `threshold` does not move; retuning 0.90 would be doctrine 58's
    # error and would only move the duck from one section to two. What
    # changes is which population the fraction is taken OVER, and the
    # argument is internal: a lock is a property of the song's MASS, and the
    # two statistics that were already right — `downbeat_locked` and
    # `uniform_anacrusis`, both per-LINE — stop being exceptions and become
    # instances of one rule.
    bars = [max(0, s.bars) for s in secs]
    b_tot = sum(bars)
    lines_in = [len(song.lines_in(s)) for s in secs]
    l_tot = sum(lines_in)

    def _by(mass, total, keep):
        """-> the share of `mass` carried by the sections `keep` admits.

        Falls back to the SECTION COUNT when the mass is zero, because a
        weight of nothing is not a reading: a song whose sections declare no
        bars at all has not thereby cleared every metric lock, and answering
        0.0 there would be the silence this entry exists to close.
        """
        if not secs:
            return 0.0
        if total <= 0:
            return sum(1 for i, _s in enumerate(secs) if keep(i)) / len(secs)
        return sum(m for i, m in enumerate(mass) if keep(i)) / total

    out["four_four"] = _by(
        bars, b_tot,
        lambda i: (secs[i].meter.beats, secs[i].meter.unit) == (4, 4))
    out["bars_multiple_of_four"] = _by(
        bars, b_tot, lambda i: secs[i].bars % 4 == 0)
    lens = [s.bars for s in secs]
    _modal_bars = (max(set(lens), key=lens.count) if lens else None)
    out["equal_section_length"] = _by(
        bars, b_tot, lambda i: lens[i] == _modal_bars)
    durs = [l.duration for l in lines]
    out["equal_line_duration"] = (
        max(durs.count(v) for v in set(durs)) / len(durs)) if durs else 0.0
    out["downbeat_locked"] = (sum(1 for l in lines if l.on_downbeat())
                              / len(lines)) if lines else 0.0
    picks = [p for p in (line_pickup(song, l) for l in lines) if p != 0]
    out["uniform_anacrusis"] = (
        max(picks.count(v) for v in set(picks)) / len(picks)) if picks \
        else 1.0
    counts = list(lines_in)
    # WEIGHTED BY LINES, for the reason above: this is the statistic the
    # owner's two-line outro was aimed at, and it is the lyric lock, so the
    # mass that counts is the mass of WORDS. Five quatrains and a two-line
    # tag is 20 of 22 lines in quatrains — 0.909, still locked — where by
    # section count it was 5 of 6 and silent.
    out["four_lines_per_section"] = _by(
        lines_in, l_tot, lambda i: counts[i] == 4)
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
    picks = [p for p in (line_pickup(song, l) for l in song.lines) if p != 0]
    modal = (max(set(picks), key=picks.count) if picks else None)
    if u["downbeat_locked"] >= threshold and len(song.lines) > 4:
        out.append(GridFinding(
            "DOWNBEAT_LOCKED",
            "every line starts on beat one",
            f"{u['downbeat_locked']:.0%} of lines begin on a downbeat. No "
            f"anacrusis, no line entering late, no phrase pushed across a "
            f"barline — the words are sitting on the grid rather than "
            f"playing against it. CLEARING THIS IS NOT EVIDENCE OF VARIED "
            f"PLACEMENT: this repo's own blueprint cleared it by giving "
            f"every second line one constant pickup, which is why "
            f"UNIFORM_ANACRUSIS below exists (doctrine 24). "
            f"uniform_anacrusis reads {u['uniform_anacrusis']:.0%}."))
    elif u["uniform_anacrusis"] >= threshold and len(picks) > 4:
        out.append(GridFinding(
            "UNIFORM_ANACRUSIS",
            "every line that is not on a downbeat carries the SAME pickup",
            f"{picks.count(modal)} of the {len(picks)} off-downbeat lines "
            f"enter {modal} pulse(s) before the barline "
            f"({u['uniform_anacrusis']:.0%}); "
            f"{len(set(picks))} distinct pickup(s) in the whole song, against "
            f"{u['downbeat_locked']:.0%} of lines on beat 1. The same defect "
            f"DOWNBEAT_LOCKED names, one step along: a line placed by adding "
            f"a number to beat 1 has not been heard against the bar either. "
            f"WHAT THIS CHECK CANNOT SEPARATE, MEASURED (doctrine 17): a "
            f"pickup uniform BY FIAT from one uniform BECAUSE THE LANGUAGE "
            f"IS. A hand-set constant pickup across every second line reads "
            f"exactly the same as most English lines genuinely opening on "
            f"one weak syllable — a real fixture has read both 100% (one "
            f"hand-set constant across four time signatures) and 90% (every "
            f"pickup re-derived from its own line's upbeat syllable) at "
            f"different points in this repo's history. Read the DISTINCT "
            f"count and the note VALUES beside this percentage, not the "
            f"percentage alone; a single high reading is an uncalibrated "
            f"threshold (doctrine 16) and n=1 song is not a calibration "
            f"(doctrine 72)."))
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
    ("TEXT_VERBATIM_CHANNEL_UNREAD",
     "the WORDS returned unchanged and the channel this tradition varies is "
     "not in the text, so no claim is made about whether the return varied. "
     "Reachable only under `VariationDeclaration.varies_off_text`; the "
     "underlying measurement is kept in `qualities`, which still carries "
     "VERBATIM, because the words really are identical and deleting that "
     "would trade one false claim for a missing one (doctrine 24 -- the rule "
     "RELABELS)."),
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
    ("ANAPHORIC_RETURN", "the block's FIRST line keeps a shared opening and "
                         "the rest of the block does not. Bilhana's "
                         "Caurapancasika opens all 47 of its refrains on "
                         "`adyapi tam` and shares nothing in the second line; "
                         "under a rule that asks every line to keep a run, "
                         "that refrain disappears, so it gets a name instead "
                         "of being deleted (doctrine 24). The source's own "
                         "header calls it `line-initial anaphora`."),
    ("EPIPHORIC_RETURN", "the block's LAST line keeps a shared close and the "
                         "rest does not -- the radif shape at block scale"),
    ("RESTATEMENT", "same line count, nothing invariant, token overlap above "
                    "`restatement_overlap` -- the same material said again"),
    ("REWRITTEN_RETURN", "no line, no rhyme, no token run and no slot "
                         "survived: the return shares its position and its "
                         "label and not its words. Hogg's 'Donald Macdonald' "
                         "rewrites its whole chorus on every return and keeps "
                         "the syntax. This is a NAMED kind, not a shrug -- it "
                         "says what was tested and what failed, and it has "
                         "two readings the harness cannot choose between: a "
                         "chorus that rewrites, or a mark that groups two "
                         "different sections."),
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

    #: NAME of the channel this tradition varies, when that channel is NOT the
    #: words -- `"the melodic line (Carnatic sangati)"`,
    #: `"placement across the tala (Hindustani bol-baant)"`. Empty means
    #: undeclared, and every comparison ever made here reproduces unchanged.
    #:
    #: `MISSING.md` M-26. All 15 members of `VARIATION_KINDS` compare WORD
    #: CONTENT, so a return that holds the text fixed and varies something else
    #: scored `VERBATIM` -- the STRONGEST available claim that nothing changed.
    #: A kṛti's sangati is the defining device of its exposition and it holds
    #: the sāhitya fixed while the melody moves; every one of them came back
    #: `VERBATIM`.
    #:
    #: THIS IS NOT THE HARNESS OVERREACHING ITS TEXT. Doctrine 93 -- melody and
    #: tāla placement are not in a lyric sheet and this layer must not claim
    #: them. The defect was that `compare_returns` HAS a refusal channel and no
    #: member of it could say *the channel this tradition varies is not in the
    #: text*, so inconclusive-by-construction came back as a null, and as the
    #: most POSITIVE null the vocabulary has (doctrine 20).
    varies_off_text: str = ""


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


rime_orthographic.declared_name = (
    "orthographic rime PROXY (last vowel letter to end); reads `slow` and "
    "`go` as different rimes, and they rhyme")


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
            got, oov = lex.transcribe_word(w)
            if oov or not got:
                return None
            phones = [got]
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

    key.declared_name = ("CMUdict General American; phones from the last "
                         "stressed vowel of the end word, stress dropped. "
                         "IDENTITY key -- perfect rhyme only, stricter than "
                         "the graded band")
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
    #: (head_run, tail_run) shared token runs, MINIMUM over the varied lines
    #: -- the strict claim "every line that moved kept this much"
    invariant_runs: tuple = (0, 0)
    #: shared head of the FIRST aligned pair and shared tail of the LAST,
    #: reported separately because a refrain can be anaphoric at its opening
    #: without every one of its lines agreeing, and the corpus has 46 of those
    opening_run: int = 0
    closing_run: int = 0
    #: (line, head, tail) for every line that moved -- the PER-LINE runs that
    #: `invariant_runs` above reduces to a minimum. SURFACED in `describe()`
    #: 2026-08-14; until then it was computed on every comparison and read by
    #: nothing in production or in a test, `describe()` included, which printed
    #: the reduction and not its input. Kept rather than deleted because the
    #: two claims are not the same claim: `invariant_runs` is the strict
    #: "EVERY line that moved kept this much", and a reader shown `(0, 0)` has
    #: no way to tell one line that shares nothing from a block that shares
    #: nothing -- the Gitagovinda dhruva-tail against a rewrite. The minimum is
    #: the claim; this is the evidence for it, and it is one f-string away.
    line_runs: tuple = ()
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
                f"  shared head/tail runs   {self.invariant_runs} tokens "
                f"(min over moved lines, each one listed below); block "
                f"opening {self.opening_run}, closing {self.closing_run}",
                f"  declaration: normalisation={d.normalisation!r} "
                f"lexical_max_tokens={d.lexical_max_tokens} "
                f"min_invariant_run={d.min_invariant_run} "
                f"restatement_overlap={d.restatement_overlap}"]
        runs = {ln: (h, t) for ln, h, t in self.line_runs}
        for v in self.varied_lines:
            # `line_runs` is empty on a hand-built `Return` and on a STUB, so
            # the per-line runs are looked up rather than zipped positionally
            # -- a zip would silently print nothing at all there instead of
            # printing the edits without them.
            hr, tr = runs.get(v[0], (None, None))
            rows.append(f"    L{v[0]}  {v[2]!r}\n         ->  {v[3]!r}"
                        f"   ({v[4]} word edits"
                        + (f"; head {hr}, tail {tr})" if hr is not None
                           else ")"))
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
            rhyme_key=getattr(rhyme_key, "declared_name",
                              "UNNAMED KEY -- a result that cannot say which "
                              "phonology produced it (doctrine 45)"))
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
    stubbed = [l for l in a + b if stub_test(l)]
    if stubbed:
        # EITHER SIDE. Two abbreviated returns are two POINTERS, and their
        # texts agreeing says nothing about whether the choruses they point at
        # agree: Burns prints `Lal de daudle, &c.` against `Sing hey, &c.` in
        # one song and both stand for full refrains nobody reproduced. The
        # first version of this rule required the return to be SHORTER, and
        # over the corpus that read 69 pairs as stubs and silently graded 117
        # more -- 94 of them as HEAD_PRESERVED, which is a measurement of the
        # printer's abbreviation and not of the song.
        return Return(
            kind="STUB", qualities=frozenset({"STUB"}),
            line_distance=None, token_distance=None,
            declaration=decl,
            refusals=(Refusal(
                "STUB_RETURN",
                "an abbreviated reference is a POINTER, not a reproduction",
                f"{stubbed[0]!r} stands for a block it does not print. "
                f"Reporting an edit distance here would charge the PRINTER's "
                f"space-saving convention to the writer (doctrine 79); the "
                f"stub must be RESOLVED against its target before any "
                f"distance means anything, and only the exclusion is built "
                f"(MISSING.md A-1)."),))

    if len(na) == len(nb):
        pairs = [(i, i) for i in range(len(na))]
        unmatched_a = unmatched_b = 0
    else:
        # Anchor on the identical lines, then pair the leftovers INSIDE each
        # gap positionally. Anchoring alone would report a return that both
        # dropped a line and changed a word as having no changed lines at
        # all, because an LCS only ever matches lines that are already equal.
        pairs, pi, pj = [], 0, 0
        for i, j in _lcs_pairs(na, nb) + [(len(na), len(nb))]:
            ga, gb = list(range(pi, i)), list(range(pj, j))
            for k in range(max(len(ga), len(gb))):
                pairs.append((ga[k] if k < len(ga) else None,
                              gb[k] if k < len(gb) else None))
            if i < len(na) and j < len(nb):
                pairs.append((i, j))
            pi, pj = i + 1, j + 1
        unmatched_a = sum(1 for i, j in pairs if j is None)
        unmatched_b = sum(1 for i, j in pairs if i is None)

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
    line_runs = tuple((v[0], r[0], r[1]) for v, r in zip(varied, runs))
    aligned = [(i, j) for i, j in pairs if i is not None and j is not None]
    varied_at = {v[0] - 1 for v in varied}
    opening_run = closing_run = 0
    if aligned and aligned[0][0] in varied_at:
        opening_run = _run(tokens(a[aligned[0][0]]), tokens(b[aligned[0][1]]))[0]
    if aligned and aligned[-1][0] in varied_at:
        closing_run = _run(tokens(a[aligned[-1][0]]),
                           tokens(b[aligned[-1][1]]))[1]

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
    elif varied and opening_run > 0:
        q.add("ANAPHORIC_RETURN")
    if varied and tail_run >= decl.min_invariant_run:
        q.add("TAIL_PRESERVED")
    elif varied and closing_run > 0:
        q.add("EPIPHORIC_RETURN")
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
        q.add("REWRITTEN_RETURN")

    # THE DECLARED OFF-TEXT CHANNEL OUTRANKS `VERBATIM` (M-26). `VERBATIM` is
    # left IN `q`: the words are identical and that is a true measurement. What
    # changes is the HEADLINE, because `kind` is what a consumer reads and
    # `VERBATIM` there is the strongest possible claim that nothing changed --
    # about a return whose varying channel this reader cannot see at all.
    if "VERBATIM" in q and decl.varies_off_text:
        q.add("TEXT_VERBATIM_CHANNEL_UNREAD")
        refusals.append(Refusal(
            "VARIES_OFF_TEXT",
            "the channel this tradition varies is not in the text",
            f"the words returned unchanged, and {decl.varies_off_text} is "
            f"where this tradition puts the variation. A lyric sheet does not "
            f"carry it (doctrine 93), so this comparison CANNOT TELL whether "
            f"the return varied -- which is not the same as finding that it "
            f"did not (doctrine 20). `qualities` keeps VERBATIM: the words "
            f"really are identical, and that measurement stands."))

    kind = next(k for k, _ in VARIATION_KINDS if k in q)
    return Return(kind=kind, qualities=frozenset(q),
                  line_distance=line_dist, token_distance=tok_dist,
                  invariant_lines=tuple(invariant),
                  varied_lines=tuple(varied),
                  invariant_runs=(head_run, tail_run),
                  opening_run=opening_run, closing_run=closing_run,
                  line_runs=line_runs,
                  rhyme_scheme_preserved=rhyme_ok,
                  tune_slot_preserved=slot_ok,
                  declaration=decl, refusals=tuple(refusals))


# ---------------------------------------------------------------------------
# THE HOOK (MISSING.md D-2)
#
# "The hook appears nowhere in the codebase" was exactly true. A hook is not a
# section: it is a FRAGMENT that recurs, possibly inside other sections,
# possibly shorter than a line. So it is its own object, it is DECLARED (the
# harness never decides for you what your hook is), and what it supports is
# counting, placing and asking whether the title is in it.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Hook:
    """A declared fragment. `text` may be shorter than a line."""
    text: str

    @property
    def key(self):
        return normalise_line(self.text)

    def __post_init__(self):
        if not normalise_line(self.text):
            raise ValueError(
                "a hook must have text. The harness does not guess what your "
                "hook is -- deciding that for you is writing for you, and "
                "this harness never writes for you.")


@dataclass(frozen=True)
class HookOccurrence:
    """Where a hook was found, in TWO bar coordinates, because one was never
    enough and said so only once a line had a pickup.

    `bar`/`beat` are the LINE's declared start. `next_downbeat` is the first
    barline at or after that start -- equal to `bar` when the line begins on
    beat 1, and `bar + 1` when it does not. Both are arithmetic; neither is a
    claim about where the hook is HEARD to land.

    That claim needs one more thing, and the harness does not have it: whether
    the units before the barline are an ANACRUSIS (so the hook lands on
    `next_downbeat`) or the line simply enters mid-bar (so it lands where it
    starts) is a fact about the setting, and there is no setting -- see
    `quality/fit.py`'s NO_SETTING. Report the pair, name which is which, and
    let the reader supply the tune.

    `token_offset` is the third limit and the oldest. When it is non-zero the
    hook is a fragment starting some words into the line, and BOTH bar numbers
    are still the LINE's -- locating a mid-line fragment in bars would need a
    per-syllable placement, which is the same missing setting again.
    """
    hook: str
    line_index: int          # 0-based index into song.lines
    text: str
    section: str
    function: str
    bar: int                 # the LINE's declared start bar
    beat: Fraction
    token_offset: int        # where in the line the fragment starts
    next_downbeat: int = 0   # first barline at or after `bar`.`beat`

    @property
    def has_pickup(self):
        """True when the line enters before its next barline. NOT a claim
        that those units are an anacrusis -- see the class docstring."""
        return self.next_downbeat != self.bar


def hook_occurrences(song, hook):
    """-> every place the fragment lands, in bar order. Sub-line, so a hook
    that is three words inside a longer line is found."""
    h = hook if isinstance(hook, Hook) else Hook(str(hook))
    need = h.key.split()
    out = []
    for i, l in enumerate(song.lines):
        ts = tokens(l.text)
        for k in range(len(ts) - len(need) + 1):
            if ts[k:k + len(need)] == need:
                sec = l.section or song.section_at(l.bar)
                fn = next((s.function for s in song.sections
                           if s.start_bar <= l.bar <= s.end_bar), UNDECLARED)
                out.append(HookOccurrence(h.text, i, l.text, sec, fn,
                                          l.bar, l.beat, k,
                                          l.bar if l.beat == 1 else l.bar + 1))
                break
    return sorted(out, key=lambda o: (o.bar, o.beat))


def _bars_of(occ):
    """The bar list a finding prints. States both coordinates whenever any
    occurrence has a pickup, because `[30, 68]` and `[31, 69]` are the same
    hook and a reader given one number cannot tell which they were handed."""
    if any(o.has_pickup for o in occ):
        return (f"{[o.bar for o in occ]} (line starts), landing on the "
                f"barline at {[o.next_downbeat for o in occ]}")
    return str([o.bar for o in occ])


def hook_findings(song, hooks=(), title=None):
    """-> (findings, refusals). The writer's questions: does it recur, where,
    and is the title in it?"""
    findings, refusals = [], []
    hooks = [h if isinstance(h, Hook) else Hook(h) for h in hooks]
    if not hooks:
        refusals.append(Refusal(
            "HOOK_UNDECLARED",
            "no hook was declared, so no hook question was asked",
            "A hook is a FRAGMENT (MISSING.md D-2) and it is the writer's to "
            "name. Reporting 'no hook problems' here would be a pass earned "
            "by asking nothing (doctrine 20)."))
        return findings, refusals

    title = song.title if title is None else title
    for h in hooks:
        occ = hook_occurrences(song, h)
        if not occ:
            findings.append(GridFinding(
                "HOOK_ABSENT", f"the declared hook does not appear in the "
                f"lyric at all", f"{h.text!r} occurs 0 times"))
            continue
        if len(occ) == 1:
            findings.append(GridFinding(
                "HOOK_DOES_NOT_RECUR",
                "the declared hook occurs once, so it is a line and not a "
                "hook",
                f"{h.text!r} at bar {occ[0].bar}, in "
                f"{occ[0].section!r} ({occ[0].function or 'UNDECLARED'}). A "
                f"hook is defined by RETURN; one occurrence is a phrase."))
            continue
        fns = {o.function for o in occ}
        # UNDECLARED IS NOT A FUNCTION, AND IT USED TO BE COUNTED AS ONE.
        # `len(fns - {UNDECLARED}) == 1` is true of a hook that lands in the
        # chorus twice AND in a section nobody declared -- a hook that has
        # LEFT the chorus, to somewhere the harness cannot name -- and
        # HOOK_CONFINED said of it "never leaves one function". Its own
        # evidence line proved the branch was written for a set of one:
        # `sorted(fns)[0]` printed `''`, the UNDECLARED marker, which sorts
        # ahead of every real function name, so the finding named no function
        # at all. Doctrine 28: "confined" and "cannot tell where it went" are
        # different answers and the difference has to be mechanical; doctrine
        # 79: the second one is a REFUSAL and belongs in that count, never in
        # a finding.
        declared = fns - {UNDECLARED}
        if not declared:
            refusals.append(Refusal(
                "HOOK_PLACEMENT_UNDECLARED",
                "the hook recurs but no section it lands in declares a "
                "function",
                f"{h.text!r} at bars {_bars_of(occ)}; 'where does the "
                f"hook live' cannot be answered without Section.function."))
        elif len(declared) == 1 and len(occ) > 2:
            # TWO OR MORE declared functions is not this branch: the hook is
            # then ANSWERED to have left one, and an undeclared occurrence
            # beside them changes nothing about that answer.
            undeclared_at = [o for o in occ if o.function == UNDECLARED]
            where = sorted({o.section for o in undeclared_at})
            if undeclared_at:
                refusals.append(Refusal(
                    "HOOK_PLACEMENT_PARTLY_UNDECLARED",
                    f"the hook recurs {len(occ)} times and "
                    f"{len(undeclared_at)} of those land in a section that "
                    f"declares no function",
                    f"{h.text!r} in {sorted(declared)[0]!r} sections and in "
                    f"{where} (UNDECLARED), at bars {_bars_of(occ)}. Whether "
                    f"it stays in one function is CANNOT TELL: the undeclared "
                    f"section(s) may be the leak that answers it. Declare "
                    f"their function, or accept the refusal -- the harness "
                    f"does not read {where} as a function name."))
            else:
                findings.append(GridFinding(
                    "HOOK_CONFINED",
                    f"the hook returns {len(occ)} times and never leaves one "
                    f"function",
                    f"{h.text!r} occurs only in {sorted(declared)[0]!r} "
                    f"sections, at bars {_bars_of(occ)}. A hook that leaks "
                    f"into a verse or a bridge is placed; one that only ever "
                    f"appears where it is expected is a section, not a "
                    f"hook."))

    if not title:
        refusals.append(Refusal(
            "TITLE_UNDECLARED",
            "'is the title in the hook?' was not asked: Song.title is empty",
            "The question needs a declared title; guessing one from the first "
            "line is inference, which is the error this cell exists to "
            "avoid."))
        return findings, refusals

    tkey = tokens(title)
    for h in hooks:
        hk = h.key.split()
        # UNSATISFIABLE AS DECLARED, so it REFUSES rather than charging the
        # draft (2026-08-23, `MISSING.md` M-86). `TITLE_NOT_IN_HOOK` is a FLAG
        # by the owner's ruling, and a flag must name something the writer can
        # answer. A title with MORE TOKENS than the hook cannot be contained
        # in it by any writing at all — the containment test below is a
        # subsequence check in both directions, and a longer string is not a
        # subsequence of a shorter one. That is a contradiction between two
        # DECLARATIONS, not a defect in the words, so it is recorded as a
        # refusal and the flag is not raised (doctrine 20/79: a refusal is not
        # a failure, and putting it in the numerator charges the wrong layer).
        # The same shape `M-84` gave the hook slot, one layer over: a gate may
        # only demand what some draft could supply.
        if len(tkey) > len(hk):
            refusals.append(Refusal(
                "TITLE_LONGER_THAN_HOOK",
                "'is the title in the hook?' cannot be answered YES by any "
                "draft: the title has more words than the hook it would have "
                "to sit inside",
                f"title {title!r} is {len(tkey)} token(s); hook {h.text!r} is "
                f"{len(hk)}. Containment is a subsequence test, so no choice "
                f"of words makes the longer fit in the shorter — shorten the "
                f"title or declare a longer hook."))
            continue
        if any(tkey[k:k + len(hk)] == hk
               for k in range(len(tkey) - len(hk) + 1)) or \
           any(hk[k:k + len(tkey)] == tkey
               for k in range(len(hk) - len(tkey) + 1)):
            continue
        t_occ = hook_occurrences(song, Hook(title))
        where = (f"the title phrase occurs {len(t_occ)} time(s)"
                 + (f", at bar {t_occ[0].bar} in {t_occ[0].section!r} "
                    f"({t_occ[0].function or 'UNDECLARED'})" if t_occ else ""))
        findings.append(GridFinding(
            "TITLE_NOT_IN_HOOK",
            f"the title is not in the hook",
            f"title {title!r} vs hook {h.text!r}; {where}. A listener who "
            f"wants to find this song again has the hook and not the title."))
    return findings, refusals


# ---------------------------------------------------------------------------
# THE FUNCTION CHECKS
#
# Each of these is a QUESTION A WRITER ASKS, and none of them could be asked
# before `Section.function` existed, because each one needs to know which spans
# are the same thing.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FormConvention:
    """Which expectations are in force. Labelled a convention, like
    `Meter.conventional_grouping`, and overridable for the same reason."""
    name: str = "popular song, Anglo-American, 20th century"
    #: functions whose instances are expected to hold one length and one slot
    fixed_return: tuple = ("chorus", "postchorus", "refrain", "burden", "tag")
    #: functions expected to occur at most once.
    #:
    #: `reprise` WAS MISSING FROM THIS TUPLE and its own FunctionSpec has
    #: declared `recurrence="once"` since the vocabulary was written -- two
    #: spellings of one expectation, drifted apart by exactly one member. The
    #: cost was silence at BOTH gates: `song_function_report` asks a recurred
    #: single-use function only if it is named here, and SINGLE_USE_RECURRED
    #: fires only if it is named here, so a song declaring two reprises was
    #: neither asked nor answered. The regression that pinned this tuple
    #: checked one direction only -- every member has recurrence "once" -- and
    #: the converse, which is the one that was false, went unpinned
    #: (doctrine 48: a principle that lives only in prose gets followed
    #: exactly as often as someone remembers it).
    single_use: tuple = ("intro", "outro", "bridge", "coda", "false_ending",
                         "reprise")
    #: channels a bridge is expected to differ from the verses on
    contrast_channels: tuple = ("meter", "bars", "line_count",
                                "line_duration", "downbeat_rate",
                                "rhyme_inventory", "line_length")
    #: a run of this many identical returns with no variation is the strophic
    #: default; below it, saying so would be noise
    return_lock_min: int = 2
    #: ORDERED pairs (LATER, EARLIER) whose CROSS-FUNCTION reprise is asked.
    #:
    #: `compare_returns` never cared where its two line lists came from, and
    #: for the whole life of this module the only caller handed it
    #: `song.instances_of(fn)` -- two returns of ONE declared function. "Does
    #: the outro come back to the intro" was unaskable, not because the
    #: primitive was missing but because nothing called it across two
    #: different functions (CLAUDE.md known gap 7).
    #:
    #: WHY A DECLARED SET AND NOT EVERY PAIR, MEASURED RATHER THAN ARGUED.
    #: 21 functions give 420 ordered pairs, and a verse does not "reprise" a
    #: chorus -- it shares a language with it. Over `corpus/song/`, on the
    #: only cross-function pairs the printed marks can supply (verse, chorus,
    #: burden, refrain -- `MARK_FUNCTION`'s whole range), 889 unordered pairs
    #: of first blocks were compared and 51 of them -- 5.7% -- share at least
    #: one whole line under the declared normalisation. NOT ONE IS A REPRISE:
    #: they are refrain lines a printer set inside the verse (Tennyson's
    #: `Rode the six hundred.` against `[BURDEN]`, Bliss's `Wonderful words
    #: of life,` against `[REFRAIN]`, Lovelace's capitalised repetend). Asked
    #: pairwise over everything, this check would report a reprise on 5.7% of
    #: the cross-function pairs in this corpus and be wrong every time --
    #: which is doctrine 61 exactly: a rule that fires more often is not a
    #: better rule. So the SET is the measurement's own coordinate, and it is
    #: declared here where a genre can override it rather than spelled into
    #: the check.
    #:
    #: WHERE THE THREE MEMBERS COME FROM. Not taste: each one is a convention
    #: `SECTION_FUNCTIONS` already states in its own gloss.
    #:   ("outro", "intro")    `intro` is the ONE entry in the vocabulary
    #:                         whose gloss declares its material returns --
    #:                         "may state material that returns later" -- and
    #:                         the outro is where a song comes back to it.
    #:                         This is gap 7's own example, in its own words.
    #:   ("outro", "chorus")   the close that is the chorus again.
    #:   ("reprise", "chorus") `reprise` is the ONE entry whose gloss declares
    #:                         it IS a cross-function return -- "a declared
    #:                         return of earlier material, later and changed"
    #:                         -- and it names no source. Without this pair a
    #:                         declared reprise is checked by NOTHING: its
    #:                         recurrence is "once", so `return_findings`
    #:                         answers it SINGLE_INSTANCE and stops, and the
    #:                         one property that defines the function is
    #:                         invisible to every check in this file.
    #: The corpus can bound the FALSE-POSITIVE side of this set and cannot
    #: supply its positive side: `MARK_FUNCTION` reads no INTRO, OUTRO or
    #: REPRISE mark, so no printed block in `corpus/song/` can witness one of
    #: these three pairs. That is stated rather than papered over.
    reprises: tuple = (("outro", "intro"), ("outro", "chorus"),
                       ("reprise", "chorus"))
    #: how many of the earlier section's lines must come back INTACT before
    #: the later section is called a reprise of it. Doctrine 58: this is the
    #: threshold the whole check turns on, so it travels with the convention
    #: instead of being a bare `if` nobody wrote down.
    #:
    #: KEYED ON THE MEASUREMENT, NOT ON A LIST OF KINDS. The obvious spelling
    #: is "these six of the twelve `VARIATION_KINDS` count as a reprise", and
    #: it is the spelling that rots: `single_use` was exactly such a
    #: hand-copied subset and it drifted from `FunctionSpec.recurrence` by one
    #: member (`reprise`), silencing both gates it fed. `Return.
    #: invariant_lines` is the kind ladder's own input rather than a second
    #: copy of its output, so a kind added to `VARIATION_KINDS` tomorrow is
    #: classified correctly here on the day it is added.
    #:
    #: AND IT IS THE THRESHOLD THAT KEEPS THE CHECK QUIET. Two sections that
    #: merely share a language land on RESTATEMENT (token overlap, nothing
    #: invariant), REWRITTEN_RETURN, or HEAD_PRESERVED on a shared opening
    #: formula -- all of which have zero invariant lines and none of which is
    #: a reprise. What survives is the claim a reader can check by eye: a
    #: line of the earlier section is literally in the later one.
    reprise_min_lines: int = 1


POPULAR_SONG = FormConvention()


def function_profile(song):
    """-> what the form IS, by declared function. The answer to D-1's own
    example questions."""
    counts = {}
    for s in song.sections:
        counts[s.function] = counts.get(s.function, 0) + 1
    prof = {
        "form": song.form(),
        "counts": counts,
        "declared": len(song.declared_sections()),
        "undeclared": len(song.undeclared_sections()),
        "total_bars": song.total_bars,
    }
    for fn in ("chorus", "prechorus", "bridge", "hook"):
        bars, sec = song.bars_until(fn)
        prof[f"bars_until_first_{fn}"] = bars
        prof[f"has_{fn}"] = bool(song.instances_of(fn))
    return prof


def return_findings(song, function="chorus", convention=POPULAR_SONG,
                    rhyme_key=None, decl=None):
    """Does this function land in the same place, and the same shape, each
    time it returns?  -> (findings, refusals, returns).

    Three separate questions, and before `function` existed none of them had a
    subject: two spans named "chorus" and "chorus2" were two strings.
    """
    fn = as_function(function)
    findings, refusals, rets = [], [], []
    inst = song.instances_of(fn)
    if not inst:
        refusals.append(Refusal(
            "FUNCTION_UNDECLARED",
            f"no section declares function {fn!r}",
            f"{len(song.undeclared_sections())} of {len(song.sections)} "
            f"sections are UNDECLARED. The names present are "
            f"{[s.name for s in song.sections]} -- and a name is not a "
            f"function. Nothing was checked."))
        return findings, refusals, rets
    if len(inst) == 1:
        refusals.append(Refusal(
            "SINGLE_INSTANCE",
            f"{fn!r} occurs once, so 'does it land in the same place each "
            f"time' has no second time",
            f"bars {inst[0].start_bar}-{inst[0].end_bar}. This is CANNOT "
            f"TELL, not clean (doctrine 28)."))
        if fn in convention.fixed_return:
            findings.append(GridFinding(
                "RETURN_NEVER_RETURNS",
                f"the song declares a {fn} and never comes back to it",
                f"one instance, bars {inst[0].start_bar}-{inst[0].end_bar}. "
                f"Under {convention.name!r} a {fn} is a returning function; "
                f"declared once, it is a section with a chorus's name."))
        return findings, refusals, rets

    if fn in convention.single_use and len(inst) > 1:
        findings.append(GridFinding(
            "SINGLE_USE_RECURRED",
            f"{fn!r} is declared {len(inst)} times and the convention expects "
            f"one",
            f"bars {[s.start_bar for s in inst]}. Under {convention.name!r} a "
            f"{fn} appears once; {len(inst)} of them is either a different "
            f"form or a mislabelling, and the harness cannot tell which -- it "
            f"reports the collision and stops."))

    lens = {s.bars for s in inst}
    if len(lens) > 1:
        findings.append(GridFinding(
            "RETURN_LENGTH_DRIFT",
            f"the {fn} is not the same length every time",
            f"bar counts {[s.bars for s in inst]} at bars "
            f"{[s.start_bar for s in inst]}. Neither answer is wrong -- a "
            f"final chorus that gains four bars is a decision -- but it was "
            f"unsayable, so it could not be a decision."))
    meters = {(s.meter.beats, s.meter.unit, s.meter.groups) for s in inst}
    if len(meters) > 1:
        findings.append(GridFinding(
            "RETURN_METER_DRIFT",
            f"the {fn} does not keep one time signature across its returns",
            f"{[str(s.meter) for s in inst]}"))

    slots = [song.slot_profile(s) for s in inst]
    if len({tuple(x) for x in slots}) > 1:
        first_diff = None
        for k in range(max(len(x) for x in slots)):
            vals = {x[k] if k < len(x) else None for x in slots}
            if len(vals) > 1:
                first_diff = (k + 1, sorted(map(str, vals)))
                break
        findings.append(GridFinding(
            "RETURN_SLOT_DRIFT",
            f"the {fn} does not land in the same metric position each time",
            f"line {first_diff[0]} sits at {first_diff[1]} across the "
            f"returns (offset-from-section-start, beat, duration). This is "
            f"the TUNE SLOT: a singer learning the second return has to learn "
            f"a new placement." if first_diff else str(slots)))

    for k in range(1, len(inst)):
        r = compare_returns(
            [l.text for l in song.lines_in(inst[0])],
            [l.text for l in song.lines_in(inst[k])],
            decl=decl, rhyme_key=rhyme_key,
            first_slot=slots[0], again_slot=slots[k])
        rets.append((inst[0], inst[k], r))

    # THE RETURN'S OWN REFUSALS, COLLECTED 2026-08-14. `compare_returns`
    # builds a `Return` carrying `.refusals` -- STUB_RETURN, NO_RHYME_KEY,
    # END_WORD_UNREADABLE -- and this function appended the `Return` to `rets`
    # and read `.kind` off it and nothing else. Three refusal codes were
    # therefore computed on every comparison and reachable only by a caller
    # holding the `Return` object and calling `describe()` on it by hand. No
    # grading path does that, so `song_function_report`'s refusal list -- the
    # list doctrine 79's asked/answered/refused triple is counted from -- was
    # short by every refusal the comparison itself made.
    #
    # ONE OF THE THREE IS LIVE IN THE REVISION LOOP AND WAS THE WHOLE COST:
    # `Reviser._function_findings` passes a real `rhyme_key`, so NO_RHYME_KEY
    # cannot fire there -- but END_WORD_UNREADABLE can, and does, the moment a
    # chorus carries a word the declared phonology cannot read. "Did the rhyme
    # scheme survive the return" then answers CANNOT TELL and said so to
    # nobody. That is doctrine 20 inside the layer that reports doctrine 20.
    #
    # DEDUPED BY CODE, because a chorus returning four times runs the same
    # comparison three times and would otherwise record one identical refusal
    # per return -- inflating `refusal_records` with no new information. The
    # count is kept in the evidence instead, so nothing is hidden by the
    # dedupe: a reader sees it was refused on N of the M comparisons.
    # NO_RHYME_KEY IS DELIBERATELY NOT COLLECTED, and the first attempt at
    # this collected it and broke six existing assertions — correctly. It is a
    # property of the CALL, not of the draft: the caller passed no phonology,
    # which is ONE fact, and this report already states it once as
    # CHANNEL_NOT_MEASURED from `bridge_contrast`. Collecting it here turns
    # that one fact into one record per returning function, which is the exact
    # inflation `song_function_report`'s own counting docstring records being
    # bitten by ("a three-question report came back asked 3, answered -1,
    # refused 4"). §19's "a partly-refused question is one refused question,
    # not several" is the assertion that caught it.
    #
    # The other two ARE about the draft and are collected: END_WORD_UNREADABLE
    # says THIS SONG has a return whose end word the declared phonology cannot
    # read, and STUB_RETURN says THIS RETURN is an abbreviated pointer. Neither
    # is reported anywhere else on this path.
    by_code = {}
    for _first, _again, r in rets:
        for ref in r.refusals:
            if ref.code == "NO_RHYME_KEY":
                continue
            by_code.setdefault(ref.code, []).append(ref)
    for code in sorted(by_code):
        group = by_code[code]
        refusals.append(Refusal(
            code, group[0].message,
            f"{group[0].evidence} [refused on {len(group)} of {len(rets)} "
            f"return comparison(s) for {fn!r}]"))

    # THE SAME OBJECT'S THIRD STATE, COLLECTED 2026-08-14. The block above
    # collects the return's CANNOT TELL. This collects its NO.
    #
    # `Return.rhyme_scheme_preserved` is computed on every comparison and its
    # TRUE and its FALSE were not symmetric anywhere. TRUE reaches the quality
    # ladder as RHYME_PRESERVING_REWRITE; FALSE reached no quality, no kind and
    # no finding, and only `Return.describe()` -- which no grading path calls
    # -- ever printed it. Measured on two constructed songs identical but for
    # one end word: `return_findings`, `song_function_report` and
    # `Reviser.inspect()['whole']` came back BYTE-IDENTICAL, and the only
    # difference anywhere was the quality name the TRUE branch adds. So "the
    # chorus came back on a different rhyme scheme" was answered on every run
    # of the revision loop and told to nobody.
    #
    # A FINDING, NOT A QUALITY AND NOT A KIND, and doctrine 24 is why rather
    # than why not. The ladder answers WHAT SURVIVED -- `kind` is the first
    # rung that applies -- and a rewrite that broke its rhyme still survived as
    # PARTIAL_RETURN or HEAD_PRESERVED or LEXICAL_VARIATION. Relabelling it by
    # what FAILED would delete the observation that something held, which is
    # the deletion doctrine 24 forbids. (It also cannot go in `qualities`
    # as things stand: `if not q: q.add("REWRITTEN_RETURN")` treats a non-empty
    # `q` as "some rung applied", so a non-ladder member in that set would
    # suppress the residual and `next(...)` would raise.) The category gets its
    # name at the layer that reports to a writer instead, in the vocabulary
    # RETURN_LENGTH_DRIFT / RETURN_METER_DRIFT / RETURN_SLOT_DRIFT already use
    # twenty lines above -- "this returning function does not hold one X across
    # its returns" -- because that is exactly the claim, one channel over.
    #
    # THE GATE IS THE POSITIVE'S OWN GATE WITH THE OPPOSITE ANSWER, and it was
    # measured before it was written. Over `corpus/song/` (1,920 return pairs,
    # CMUdict): 947 hold, 949 are CANNOT TELL, 24 are FALSE. Ungated, this
    # would fire on all 24 -- and TWENTY of them differ only in LINE COUNT
    # (`ABCD -> A`, `A -> AA`, `ABA -> A`: Durfey's burdens printed short on
    # the return). A partition over four lines and a partition over one are not
    # the same object, the ladder already names those TRUNCATED_RETURN /
    # EXTENDED_RETURN / HEAD_PRESERVED, and charging a LENGTH fact to the RHYME
    # layer is doctrine 79's own error. Gated on equal line counts it fires on
    # 4 (0.21%): Scott's `AB -> AA` three times and Hart's `ABAC -> ABCB`, both
    # genuine recastings at equal length. `r.varied_lines` is redundant under
    # that gate -- equal counts with nothing varied is VERBATIM, whose codes
    # are equal by construction, and 0 of the 24 took that shape -- and is
    # written anyway because it is the positive's own condition and the two
    # must not be able to drift apart (`single_use` against
    # `FunctionSpec.recurrence`, one file over).
    #
    # `reprise_findings` DOES NOT GET THIS, and that is the same discipline the
    # block above uses one axis further out. A refusal about the DRAFT is
    # collected there and one about the CALL is not; here the question is
    # whether the CONVENTION says anything at all. It does for a returning
    # function -- a singer who learned ABAB gets AABB. It says nothing about a
    # reprise: `SECTION_FUNCTIONS` glosses one as "a declared return of earlier
    # material, later and CHANGED" and names no channel it must hold, so a
    # rhyme finding there would measure against an expectation nobody holds --
    # the argument `song_function_report` already makes for not asking the five
    # "open" functions about length.
    #
    # IT IS A NOTE AT `Reviser._function_findings`, WHICH IS THE DEFAULT AND IS
    # ALSO THE ANSWER. Everything from this report is a note except HOOK_ABSENT
    # because everything here is measured against `POPULAR_SONG`, a labelled
    # CONVENTION, and doctrine 6 says a convention a writer may depart from
    # cannot be the thing that fails `verify()`. This finding is the one most
    # likely to be promoted by a later reader, because it is ABOUT RHYME and
    # rhyme is what the mandate flags -- so: the flag for this already exists
    # and is somewhere else. A writer who REQUIRES a return declares it with
    # `schemes.Return(verbatim=True)`, and breaking it is RETURN_NOT_VERBATIM,
    # a flag, from `Mandate.returns_check`. `return_findings` never sees a
    # mandate at all, so nothing it can say is a requirement the writer
    # declared, and a second flag on a declared return would be one question
    # failed twice under two names. Hanby rewrites his chorus and keeps the
    # rhyme; a writer may equally recast the scheme on purpose, and doctrine 7
    # forbids a floor from manufacturing noise on that.
    #
    # THE TRIPLE IS UNMOVED, CHECKED: this appends to `findings`, and
    # `song_function_report`'s `ask_one` counts `asked` per question and
    # `refused_questions` only when `r` is non-empty. asked / answered /
    # refused / refusal_records are identical either side of this block.
    drifted = [(a, b, r) for a, b, r in rets
               if r.rhyme_scheme_preserved is False and r.varied_lines]
    if drifted:
        from quality import schemes as S

        def _read(sec):
            """-> the lines of one instance under the DECLARED normalisation.

            The same filter `compare_returns` applies to its own two lists, so
            the gate and the comparison cannot disagree about which lines were
            read.
            """
            return [l.text for l in song.lines_in(sec)
                    if normalise_line(l.text)]

        def _label(lines):
            """-> the rhyme partition as letters, e.g. 'AABB'.

            `UNREADABLE` is unreachable from here -- a None code is what
            produced END_WORD_UNREADABLE above and a None never reaches a
            False -- and is printed rather than raised, because a grading
            path is not where an impossible branch should crash.
            """
            code = _rhyme_code(lines, rhyme_key)
            return "UNREADABLE" if code is None else S.label(code)

        rows = []
        for a, b, r in drifted:
            la, lb = _read(a), _read(b)
            if len(la) != len(lb):
                continue        # a LENGTH change; the ladder already names it
            rows.append(f"bars {a.start_bar}-{a.end_bar} is {_label(la)} and "
                        f"bars {b.start_bar}-{b.end_bar} is {_label(lb)} "
                        f"({r.kind}, {len(r.varied_lines)} line(s) moved)")
        if rows:
            findings.append(GridFinding(
                "RETURN_SCHEME_DRIFT",
                f"the {fn} does not come back on the same rhyme scheme",
                "; ".join(rows) + f". The words were rewritten AND the rhyme "
                f"partition was recast, on {len(rows)} of {len(rets)} return "
                f"comparison(s) at equal line count. This is the answer "
                f"RHYME_PRESERVING_REWRITE is the other half of: Hanby "
                f"rewrites his chorus and the partition holds, and that "
                f"earns a name -- so this one does too rather than being "
                f"silence. It is a CONVENTION of {convention.name!r} and NOT "
                f"a defect the harness will fail a draft on: recasting a "
                f"return's scheme is a decision, and it was unsayable, so it "
                f"could not be one. A REQUIRED return is declared with "
                f"`quality.schemes.Return(verbatim=True)` and broken returns "
                f"there are RETURN_NOT_VERBATIM. Phonology: "
                f"{drifted[0][2].declaration.rhyme_key or 'NONE DECLARED'}"))

    # BOTH CHECKS BELOW ASK ABOUT THE WORDS, so both read the QUALITY and not
    # the headline kind (M-26, 2026-08-22). `kind` is the most specific label
    # the ladder can give and it CAN be outranked while the words are still
    # identical -- by `STUB` (which never carries the quality, so the two
    # readings agreed) and, since the off-text declaration, by
    # `TEXT_VERBATIM_CHANNEL_UNREAD` (which does). Under the old spelling a
    # caller who declared an off-text channel would have silently lost
    # `RETURNS_WITH_SAME_WORDS` and `RETURN_LOCKED`, both of which are true and
    # both of which are about the words alone.
    same_words = bool(rets) and all("VERBATIM" in r.qualities
                                    for _, _, r in rets)
    spec = SECTION_FUNCTIONS[fn]
    if spec.returns_as == "new words" and same_words:
        findings.append(GridFinding(
            "RETURNS_WITH_SAME_WORDS",
            f"every {fn} returns with IDENTICAL words",
            f"under {convention.name!r} a {fn} returns with new words on the "
            f"same tune; identical words are a chorus's job. This is the "
            f"mirror of BRIDGE_IS_A_VERSE and it is a finding about the "
            f"LABEL, not about the lines."))
    if (spec.returns_as == "verbatim"
            and len(rets) >= convention.return_lock_min - 1
            and same_words
            and all(r.tune_slot_preserved for _, _, r in rets)):
        findings.append(GridFinding(
            "RETURN_LOCKED",
            f"every {fn} return is verbatim in an identical slot",
            f"{len(rets)} return(s), all VERBATIM. This is the strophic "
            f"default and it is not a defect -- it is the majority of the "
            f"corpus. It is reported because the OTHER answers exist and were "
            f"unsayable: Hanby rewrites the words and keeps the rhyme, "
            f"Russell holds the first and last lines and rewrites the "
            f"interior, the Gitagovinda holds a head and a tail and varies "
            f"the middle. Variation-on-return is a channel this song does "
            f"not use."))
    return findings, refusals, rets


def reprise_findings(song, later="outro", earlier="intro",
                     convention=POPULAR_SONG, rhyme_key=None, decl=None):
    """Does ONE declared function's section come back to ANOTHER'S?
    -> (findings, refusals, reprises).

    The other half of `return_findings`, and the half nothing asked.
    `compare_returns` takes two LINE LISTS and does not care where they came
    from -- its own docstring says so -- but every caller in this module
    handed it `song.instances_of(fn)`, so the only question ever put to it
    was "does this function agree with ITSELF". "Does the outro reprise the
    intro" needs the same primitive pointed at two DIFFERENT functions, and
    that is all this is.

    THE PAIR IS THE WHOLE DESIGN and it is `convention.reprises` -- read that
    field before this docstring. Asking every ordered pair is 420 questions
    and measurably wrong 5.7% of the time on this repo's own corpus.

    THE THREE RULES THIS CHECK DECLARES, because each of them decides an
    answer:

      * THE STATEMENT IS THE FIRST INSTANCE of `earlier`. A chorus states its
        material once and returns to it; whether its own returns agree is
        `return_findings`' question and is answered separately, so taking the
        first instance here neither double-charges nor hides that.
      * THE REPRISE MUST BE LATER, in bars. A function that comes BEFORE the
        one it is supposed to reprise is not a reprise; the pair is ordered
        and this is where the order is enforced rather than assumed.
      * A REPRISE IS INVARIANT LINES, not similarity. At least
        `convention.reprise_min_lines` of the earlier section's lines must
        come back INTACT under the declared normalisation. Two sections in
        one writer's voice are similar by construction, and a check that
        fired on similarity would fire on every well-written song.

    Silence here is an ANSWER -- these two functions do not share a line --
    and never a pass earned by not asking: a pair whose sides are not both
    declared is refused, and `song_function_report` does not ASK it at all
    (doctrine 20, and the same gate `SINGLE_USE_RECURRED` uses).
    """
    ln, en = as_function(later), as_function(earlier)
    findings, refusals, out = [], [], []
    e_inst = song.instances_of(en)
    l_inst = song.instances_of(ln)
    if not e_inst or not l_inst:
        missing = [f for f, i in ((en, e_inst), (ln, l_inst)) if not i]
        refusals.append(Refusal(
            "REPRISE_SIDE_UNDECLARED",
            f"'does the {ln} reprise the {en}' has no "
            f"{' and no '.join(missing)}",
            f"declared functions present: "
            f"{sorted({s.function for s in song.sections if s.declared})}. A "
            f"reprise is a relation between two sections and one of them is "
            f"not in this song; reporting 'no reprise' would be an answer "
            f"about a comparison that was never made (doctrine 28)."))
        return findings, refusals, out

    src = e_inst[0]
    src_lines = [l.text for l in song.lines_in(src)]
    for dst in l_inst:
        if dst.start_bar <= src.start_bar:
            refusals.append(Refusal(
                "REPRISE_IS_NOT_LATER",
                f"the {ln} at bar {dst.start_bar} does not come after the "
                f"{en} at bar {src.start_bar}",
                f"`reprises` is a set of ORDERED pairs and this one is "
                f"declared (later={ln!r}, earlier={en!r}). Two sections in "
                f"the other order may well share material; whatever that is, "
                f"it is not the {ln} coming back to the {en}."))
            continue
        dst_lines = [l.text for l in song.lines_in(dst)]
        if not [t for t in src_lines if normalise_line(t)] or \
                not [t for t in dst_lines if normalise_line(t)]:
            empty = [f"{s.name!r} ({f})" for s, f in
                     ((src, en), (dst, ln))
                     if not [t for t in [l.text for l in song.lines_in(s)]
                             if normalise_line(t)]]
            refusals.append(Refusal(
                "REPRISE_SIDE_HAS_NO_WORDS",
                f"'does the {ln} reprise the {en}' was not measured: a side "
                f"has no words",
                f"{' and '.join(empty)} carries no line the declared "
                f"normalisation can read. An instrumental span and a span "
                f"that reprises nothing are different answers (doctrine 28), "
                f"and `compare_returns` reads two EMPTY line lists as "
                f"VERBATIM -- which is correct arithmetic and would be a "
                f"false reprise here."))
            continue
        r = compare_returns(src_lines, dst_lines, decl=decl,
                            rhyme_key=rhyme_key,
                            first_slot=song.slot_profile(src),
                            again_slot=song.slot_profile(dst))
        out.append((src, dst, r))
        if r.kind == "STUB":
            refusals.append(Refusal(
                "REPRISE_STUB",
                f"'does the {ln} reprise the {en}' was refused: one side is "
                f"an abbreviated reference",
                f"{src.name!r} -> {dst.name!r}. A printed '&c.' POINTS at a "
                f"block it does not reproduce, so the lines it stands for "
                f"were never compared -- and a stub is exactly the shape a "
                f"real reprise takes in print, which is why this is a "
                f"refusal and not a finding in either direction "
                f"(MISSING.md A-1)."))
            continue
        if len(r.invariant_lines) < convention.reprise_min_lines:
            continue                       # ANSWERED: it does not reprise it
        # `kept` is non-empty at any `reprise_min_lines >= 1`, and a
        # convention MAY legally declare 0 -- "every comparison counts" is a
        # coherent thing for a genre to say, and it is how the threshold is
        # shown to be the thing doing the work. A declared value must not be
        # able to make this raise, so the quote is conditional rather than
        # indexed blind.
        kept = [src_lines[i - 1] for i in r.invariant_lines]
        findings.append(GridFinding(
            "CROSS_FUNCTION_REPRISE",
            f"the {ln} reprises the {en}: {len(r.invariant_lines)} line(s) "
            f"come back",
            f"{src.name!r} ({en}, bars {src.start_bar}-{src.end_bar}) -> "
            f"{dst.name!r} ({ln}, bars {dst.start_bar}-{dst.end_bar}) is "
            f"{r.kind} -- {r.gloss}. Lines {list(r.invariant_lines)} of the "
            f"{en} return intact"
            + (f", beginning {kept[0]!r}" if kept else "") + "; "
            f"{len(r.varied_lines)} more moved. Under {convention.name!r} "
            f"this is a CONVENTION and not a defect -- it is reported "
            f"because the harness could not previously say it at all: "
            f"`compare_returns` was only ever asked whether a function "
            f"agreed with ITSELF. Threshold: reprise_min_lines="
            f"{convention.reprise_min_lines} line(s) invariant under "
            f"{r.declaration.normalisation!r}."))

    # THE SAME DROP, SECOND SITE — collected 2026-08-14 alongside
    # `return_findings`'. This function holds a `Return` per candidate pair and
    # read `.kind`, `.invariant_lines`, `.varied_lines` and `.declaration` off
    # it while `.refusals` went nowhere.
    #
    # STUB_RETURN IS EXCLUDED HERE AND ONLY HERE. The loop above already
    # answers that case with REPRISE_STUB, which says the same thing in this
    # function's own vocabulary (which side is abbreviated, and that a stub is
    # the shape a real reprise takes in print). Merging both would record one
    # question as refused twice and put the same fact in the report under two
    # names -- doctrine 79 asks for counts of one kind of thing, not for the
    # same thing counted twice.
    # NO_RHYME_KEY skipped for the reason given at the same collection in
    # `return_findings`: it is a fact about the CALL, stated once already.
    rby = {}
    for _src, _dst, r in out:
        for ref in r.refusals:
            if ref.code in ("STUB_RETURN", "NO_RHYME_KEY"):
                continue
            rby.setdefault(ref.code, []).append(ref)
    for code in sorted(rby):
        group = rby[code]
        refusals.append(Refusal(
            code, group[0].message,
            f"{group[0].evidence} [refused on {len(group)} of {len(out)} "
            f"cross-function reprise comparison(s)]"))
    return findings, refusals, out


def _channel_values(song, sections, rhyme_key=None):
    """-> per-channel measurement over a set of sections, for contrast."""
    lines = [l for s in sections for l in song.lines_in(s)]
    if rhyme_key is None:
        ends = None            # CANNOT TELL: no phonology was declared
    else:
        ends = {rhyme_key(_end_word(l.text)) for l in lines
                if _end_word(l.text)}
        ends.discard(None)
    dur = [float(l.duration) for l in lines]
    lens = [len(tokens(l.text)) for l in lines]
    return {
        "meter": {(s.meter.beats, s.meter.unit, s.meter.groups)
                  for s in sections},
        "bars": {s.bars for s in sections},
        "line_count": {len(song.lines_in(s)) for s in sections},
        "line_duration": round(sum(dur) / len(dur), 3) if dur else None,
        "downbeat_rate": (round(sum(1 for l in lines if l.on_downbeat())
                                / len(lines), 3) if lines else None),
        "rhyme_inventory": ends,
        "line_length": round(sum(lens) / len(lens), 3) if lens else None,
    }


def bridge_contrast(song, function="bridge", against=("verse",),
                    convention=POPULAR_SONG, rhyme_key=None):
    """Does the bridge actually contrast, or is it a verse wearing a label?
    -> (findings, refusals, channels).

    The question is only askable once both sides have a declared function. It
    was the one D-1 could not phrase at all: with `name` a free string, "the
    bridge" and "a verse" were two spellings.
    """
    fn = as_function(function)
    findings, refusals = [], []
    br = song.instances_of(fn)
    ref = [s for a in against for s in song.instances_of(a)]
    if not br:
        refusals.append(Refusal(
            "FUNCTION_UNDECLARED", f"no section declares {fn!r}",
            f"declared functions present: "
            f"{sorted({s.function for s in song.sections if s.declared})}"))
        return findings, refusals, {}
    if not ref:
        refusals.append(Refusal(
            "NO_COMPARATOR",
            f"{fn!r} is declared but nothing declares "
            f"{' or '.join(against)}, so there is nothing to contrast WITH",
            "Contrast is a relation. Reporting a bridge as contrasting "
            "against an empty set would be a pass earned by asking nothing."))
        return findings, refusals, {}

    bv = _channel_values(song, br, rhyme_key)
    rv = _channel_values(song, ref, rhyme_key)
    channels, separating, unmeasured = {}, [], []
    for ch in convention.contrast_channels:
        x, y = bv.get(ch), rv.get(ch)
        if x is None or y is None:
            # CANNOT TELL. The rhyme inventory needs a phonology, and reading
            # it off spelling because none was declared would be doctrine 45's
            # exact failure: a claim about sound made by whoever guessed.
            channels[ch] = {"bridge": None, "against": None,
                            "separates": None,
                            "why": "not measured: no key was declared for "
                                   "this channel"}
            unmeasured.append(ch)
            continue
        if isinstance(x, set):
            shared = x & y
            diff = bool(x) and bool(y) and not shared
            channels[ch] = {"bridge": sorted(map(str, x))[:6],
                            "against": sorted(map(str, y))[:6],
                            "shared": sorted(map(str, shared))[:6],
                            "separates": diff}
        else:
            diff = (x != y)
            channels[ch] = {"bridge": x, "against": y, "separates": diff}
        if channels[ch]["separates"]:
            separating.append(ch)

    if unmeasured:
        refusals.append(Refusal(
            "CHANNEL_NOT_MEASURED",
            f"{len(unmeasured)} contrast channel(s) were not measured",
            f"{unmeasured}. They are excluded from the verdict rather than "
            f"scored as 'no difference' -- an unmeasured channel that votes "
            f"is a guess with a number on it."))
    if not separating:
        tested = [c for c in convention.contrast_channels
                  if c not in unmeasured]
        findings.append(GridFinding(
            "BRIDGE_IS_A_VERSE",
            f"the {fn} does not differ from the {'/'.join(against)} on any "
            f"measured channel",
            f"channels measured: {tested}; none separated"
            + (f"; not measured: {unmeasured}" if unmeasured else "")
            + f". Same meter, same bar count, same line count, same phrase "
              f"length. It is labelled a {fn} and it is a {against[0]}. This "
              f"is a finding about the LABEL, and the label is the only "
              f"thing that says otherwise."))
    channels["_separating"] = separating
    return findings, refusals, channels


def song_function_report(song, hooks=(), rhyme_key=None,
                         convention=POPULAR_SONG, decl=None):
    """Every function-dependent question, asked once. -> dict.

    Three counts, always, and they are not interchangeable: questions ASKED,
    questions ANSWERED, questions REFUSED (doctrine 79).

    ALL THREE COUNT QUESTIONS. `answered` used to be `asked - len(refusals)`,
    which counts REFUSAL RECORDS on one side of a subtraction and QUESTIONS on
    the other -- and one question can record more than one refusal. A hook
    that recurs into undeclared sections in a song with no declared title
    records two (HOOK_PLACEMENT_UNDECLARED and TITLE_UNDECLARED) for the one
    question `hook_findings` is, so a three-question report came back
    `asked 3, answered -1, refused 4`: a negative count of answers, and the
    arithmetic lost exactly one question per extra record. The refusal LIST is
    returned in full and unchanged, and `refusal_records` states its length,
    so nothing is hidden by counting the questions instead -- doctrine 79 asks
    for three counts of the same kind of thing, which is what a mandated /
    judged / refused triple is.

    A question that records ANY refusal counts as refused, including one that
    also produced a finding (`bridge_contrast` answers six channels and
    refuses `rhyme_inventory` when no phonology is declared). That is the
    conservative direction: it never reports a partly-refused question as
    fully answered, and doctrine 20 is the reason the other direction is
    unavailable -- a pass earned by not answering is the failure mode here.
    """
    findings, refusals = [], []
    asked = refused_questions = 0
    prof = function_profile(song)
    detail = {}

    def ask_one(f, r):
        """Fold ONE question's answer in, and count it once on each axis."""
        nonlocal asked, refused_questions
        asked += 1
        findings.extend(f)
        refusals.extend(r)
        if r:
            refused_questions += 1

    # `chorus` is ALWAYS asked, declared or not: a song with no declared
    # chorus is a fact about the song, and not asking is how a report comes
    # back clean because nobody said anything (doctrine 20).
    ask = {"chorus"} | {s.function for s in song.sections if s.declared
                        and (SECTION_FUNCTIONS[s.function].recurrence
                             == "returns"
                             or s.function in convention.fixed_return)}
    # A SINGLE-USE function that RECURRED is asked too, and only then.
    # `return_findings` carries the SINGLE_USE_RECURRED guard, but every
    # function in `convention.single_use` has recurrence "once" and none is in
    # `fixed_return` -- the two tuples are disjoint -- so the loop above could
    # never hand it one, and the check could not fire for the whole life of
    # this module. Measured: a blueprint declaring two bridges reported
    # nothing. Gating on count>1 rather than on declaredness is what keeps a
    # well-formed song silent: a single intro is not a question, so asking
    # would only spend a SINGLE_INSTANCE refusal on every song that has one.
    recurred = Counter(s.function for s in song.sections if s.declared)
    # "EXPECTED ONCE" HAS TWO SPELLINGS and the gate used to read only one of
    # them. `convention.single_use` is a tuple a caller may override; the
    # vocabulary's own `FunctionSpec.recurrence == "once"` is the same
    # expectation stated per function, and `reprise` was in the second and not
    # the first, so a song declaring two reprises was never asked (measured:
    # of the 21 declared functions, 10 were reachable through the `returns`
    # branch and 5 more through this one; `reprise` was the sixth "once"
    # function and reached neither). Reading the UNION means a function added
    # to SECTION_FUNCTIONS with recurrence "once" is askable the day it is
    # added rather than the day someone remembers this tuple (doctrine 48).
    # The two agree exactly under POPULAR_SONG and `quality/test_grid.py` §16
    # pins that equality in BOTH directions -- pinning one direction only is
    # how `reprise` got through.
    #
    # The FIVE "open" functions -- breakdown, build, vamp, interlude, solo --
    # are DELIBERATELY not asked, and this is the line that decides it. "Open"
    # is the vocabulary declaring that the convention expects nothing about
    # how often they occur, so `return_findings` on a second vamp could only
    # measure drift against an expectation nobody holds: a vamp is "a
    # repeating figure held open" and reporting that two of them are different
    # lengths is noise on a correct song, which doctrine 7 forbids a floor
    # from manufacturing. If a genre does expect one of them to hold a length,
    # that is a FormConvention with it in `single_use`, declared -- not a
    # default.
    expects_once = set(convention.single_use) | {
        fn for fn in recurred if SECTION_FUNCTIONS[fn].recurrence == "once"}
    ask |= {fn for fn in expects_once if recurred.get(fn, 0) > 1}
    for fn in sorted(ask):
        f, r, rets = return_findings(song, fn, convention, rhyme_key, decl)
        ask_one(f, r)
        detail[fn] = rets
    # THE CROSS-FUNCTION HALF. Every question above asks whether ONE declared
    # function agrees with itself; this asks whether one comes back to
    # ANOTHER, which is the same primitive pointed at a different pair and was
    # asked by nothing (CLAUDE.md known gap 7).
    #
    # THE GATE IS BOTH SIDES PRESENT, and it is the same gate the single-use
    # loop above uses, for the same reason. A song with no intro has no
    # "does the outro reprise the intro" to answer, and asking anyway would
    # spend a REPRISE_SIDE_UNDECLARED refusal on every song in the repo that
    # has an outro and no intro -- which is most of them, and which would
    # make the three counts report a song as partly-refused for the crime of
    # not having a section. `reprise_findings` still refuses when called
    # directly on a missing side; what this gate decides is whether the
    # question is ASKED, and an unasked question is in none of the three
    # counts (doctrine 79).
    reprises = {}
    for later, earlier in convention.reprises:
        ln, en = as_function(later), as_function(earlier)
        if not song.instances_of(ln) or not song.instances_of(en):
            continue
        f, r, reps = reprise_findings(song, ln, en, convention, rhyme_key,
                                      decl)
        ask_one(f, r)
        reprises[(ln, en)] = reps
    # WHERE THE SECTIONS SIT (2026-08-22, `MISSING.md` M-54). One question,
    # asked once over the whole ordered list, so a song with three misplaced
    # sections is ONE refused-or-answered question and three findings —
    # `song_function_report`'s counting docstring records what happens when a
    # question is counted per record instead (`asked 3, answered -1`).
    #
    # NOTES, NOT FLAGS, AND THE PRECEDENT IS `uncovered_bars` VERBATIM: a
    # section's POSITION is a fact about the DECLARATION, not about any line's
    # words. No rewrite moves it and `revise_loop`'s only move is a word swap
    # on a named line, so a flag here would spend every round of `max_rounds`
    # on a defect the loop has no move for and then report ROUND_LIMIT — the
    # destroyed SUCCESS that entry already priced and measured. It never
    # reaches `verify()`'s gate either way: placement is a function of the
    # blueprint alone, identical on both sides of a diff, so it cancels out.
    #
    # A DEFINITIONAL VIOLATION ARGUABLY BELONGS AT THE READER, refused the way
    # `UNDECLARED_METER` is, and that is NOT decided here: it is a behaviour
    # change at a door and the shipped blueprints measure 0 violations, so
    # nothing is lost by reporting first and ruling later (M-54's open half).
    #
    # ASKED ONLY WHEN IT CAN BE PUT. A song where NO section declares a
    # function has no placement question: there are no functions to place, and
    # counting one as asked-and-answered would report a clean answer to a
    # question nobody could pose (doctrine 20 -- "inconclusive by
    # construction" is not "null"). Caught by `test_song_function` 8b, whose
    # whole subject is that an undeclared song "answers nothing", and by
    # `test_grid` §18 on three unnamed sections.
    _placed = [s.function if s.declared else None for s in song.sections]
    if any(_placed):
        pf = [GridFinding(code,
                          f"section {i + 1} sits where its own definition "
                          f"says it cannot", evidence)
              for code, i, evidence in placement_findings(_placed)]
        ask_one(pf, [])
    f, r, ch = bridge_contrast(song, convention=convention,
                               rhyme_key=rhyme_key)
    ask_one(f, r)
    f, r = hook_findings(song, hooks)
    ask_one(f, r)
    return {"profile": prof, "findings": findings, "refusals": refusals,
            "returns": detail,
            #: {(later, earlier): [(earlier_section, later_section, Return)]}
            #: -- a SEPARATE key from `returns`, which is keyed by one
            #: function and holds that function's agreement with itself. The
            #: two are different questions and folding them into one dict
            #: would make a caller unable to tell them apart.
            "reprises": reprises, "contrast": ch,
            "asked": asked, "answered": asked - refused_questions,
            "refused": refused_questions,
            #: how many refusal RECORDS the refused questions produced. Never
            #: the same axis as the three counts above; disclosed rather than
            #: summed into them (doctrine 79).
            "refusal_records": len(refusals),
            "convention": convention.name}


# ---------------------------------------------------------------------------
# READING A SOURCE'S OWN MARKS (doctrine 37 -- validate against the corpus)
#
# `corpus/song/` holds 258 files with 181,480 marked blocks. The marks are the
# PRINTER's declaration, not ours, and reading one is ingestion, not inference.
# The distinction is enforceable: the table below is closed and enumerable, and
# a mark that is not in it is REFUSED with a reason rather than mapped to the
# nearest-looking function. Mapping `[BAYT]` to `verse` because both are
# stanza-shaped would import a song-form vocabulary into a form that has no
# chorus and no verse -- doctrine 43, a checker that implements a tradition's
# rules and never read that tradition.
# ---------------------------------------------------------------------------

#: source mark -> declared function
MARK_FUNCTION = {
    "VERSE": "verse",
    "CHORUS": "chorus",
    "BURDEN": "burden",
    "BURDEN-TAIL": "burden",
    "REFRAIN": "refrain",
}

#: (LANGUAGE, source mark) -> why it is NOT a section function. Every entry
#: is a decision with a reason attached, which is what makes it a table rather
#: than a filter — and every entry now says WHICH TRADITION the decision was
#: made in, which is what makes it a coordinate rather than a claim about the
#: token (`MISSING.md` M-24, doctrine 45).
#:
#: THE KEY IS A PAIR SO THAT A ROW CANNOT BE ADDED WITHOUT NAMING A LANGUAGE.
#: It was a bare token, and `MARK_REFUSED["PART"]` read *"a speaker or role
#: attribution in the Kalevala wedding songs"* — true of Finnish, and the
#: sentence a hypothetical Irish tune staged as `[PART A]` would have been
#: refused with: a true refusal, in the wrong language, about the wrong
#: object. Nothing in a single-token table can express that `PART` means one
#: thing in `fin` and another in `gle`.
#:
#: MEASURED 2026-08-22 BEFORE THE TABLE WAS REWRITTEN, and the measurement is
#: why this is a latent defect rather than a live one: over the whole of
#: `corpus/song/`, EVERY refused mark occurs in EXACTLY ONE language —
#: `BAYT`/`RADIF` fas, `SLOKA` san, `PANTUN`/`QUATRAIN` msa,
#: `PART`/`NOTE`/`VARIANT` fin, `CYWYDD` cym, and the rest eng. So no reason
#: below is currently quoted over a tradition it was not written for, and the
#: languages here are READ OFF THAT MEASUREMENT rather than assigned by
#: guess. `TAORLUATH` is the one exception and it is declared `eng` beside its
#: three pìobaireachd siblings: it has zero occurrences anywhere, which its
#: own reason already records.
#:
#: `MARK_FUNCTION` IS NOT GIVEN THE SAME COORDINATE, and the same measurement
#: is the argument: `VERSE` is carried by eng, ltc, fin, cym AND san, `REFRAIN`
#: by four languages and `BURDEN` by two. The positive table is genuinely
#: shared, so keying it per language would manufacture five rows saying one
#: thing. M-24's other half — `SECTION_FUNCTIONS`' bare names, where the pop
#: `bridge` and the sonata `bridge` are different objects — is a claim about
#: the FUNCTION vocabulary rather than the MARK vocabulary, and it stays open.
MARK_REFUSED = {
    ("fas", "BAYT"): "a bayt is the couplet-unit of a ghazal. A ghazal has no chorus "
            "and no verse; calling it `verse` would be this vocabulary "
            "claiming a form it does not describe (doctrine 43).",
    ("fas", "RADIF"): "a radif is a RHYME DEVICE -- the repeated word after the rhyme "
             "-- not a span of the song. It has no bars and no return.",
    ("san", "SLOKA"): "a sloka is a metrical stanza-unit. In the Gitagovinda it is an "
             "interleaved narrative verse, and the source says so; that is a "
             "position in a text, not a function in a form.",
    ("msa", "PANTUN"): "a pantun is a whole quatrain FORM, not a section of a song.",
    ("msa", "QUATRAIN"): "a printing/metrical unit, and the mark carries its rhyme "
                "scheme rather than a function.",
    ("fin", "VARIANT"): "Lonnrot's numbered alternative READING of the same passage. "
               "An editor's variant is not a performed return, and treating "
               "it as one would count editorial apparatus as structure.",
    ("fin", "PART"): "a speaker or role attribution in the Kalevala wedding songs "
            "(`[PART: Kaason puoli]`), not a section function.",
    ("eng", "PATTER"): "a music-hall function this vocabulary does not declare. It is "
              "refused rather than folded into `verse`, because folding it in "
              "would delete the distinction the printer made.",
    ("fin", "NOTE"): "editorial apparatus.",
    ("eng", "SIDENOTE"): "editorial apparatus.",
    ("eng", "MUSIC"): "editorial apparatus.",
    ("eng", "GOTHIC"): "editorial apparatus.",
    ("cym", "CYWYDD"): "a Welsh METRE name, not a section.",
    ("eng", "URLAR"): "the GROUND of a pìobaireachd — the theme the variations are "
             "built on. It IS a span of the performance, which is why it is "
             "a mark at all; what this vocabulary has no member for is a "
             "movement in a VARIATION LADDER, and folding it into `verse` "
             "would say the theme and its ornamented restatements are the "
             "same kind of thing (`PATTER`'s argument, one tradition over).",
    ("eng", "SIUBHAL"): "a pìobaireachd variation on the ùrlar. Refused for the same "
               "reason and with the same regret: the relation it needs is a "
               "POINTER at the section it elaborates, and the section "
               "vocabulary has no pointer yet "
               "(`quality/SECTION_ORDER_PREREGISTRATION.md`).",
    ("eng", "TAORLUATH"): "a pìobaireachd variation, later in the ladder than the "
                 "siubhal. Declared here with zero occurrences in this "
                 "corpus, and the zero is the point: the ladder is INCOMPLETE "
                 "in the three staged pìobaireachds, so a `rank` over these "
                 "marks would be ordering a sequence the corpus never shows "
                 "whole. That measurement is what refused `rank`.",
    ("eng", "CRUNLUATH"): "the closing pìobaireachd variation, the most ornamented. "
                 "Same refusal as `SIUBHAL`. Two of the three staged "
                 "instances print `(FINALE)` after it, which this reader "
                 "keeps as the mark's ANNOTATION rather than as a second "
                 "mark — an editor's gloss on a heading is apparatus.",
}



#: base -> {language: reason}. DERIVED from `MARK_REFUSED`, never typed
#: beside it: a second hand-kept index is a second place for the language
#: coordinate to be wrong (doctrine 1).
_REFUSED_BY_BASE = {}
for (_lg, _bs), _rsn in MARK_REFUSED.items():
    _REFUSED_BY_BASE.setdefault(_bs, {})[_lg] = _rsn


def language_of_path(path):
    """-> the file's declared language code, or `""` when it has none.

    THE PREFIX IS THE CORPUS'S OWN CONVENTION and has dispatched the phonology
    since doctrine 45; this reads the same three characters. It is CHECKED
    against `phonology.declared()` rather than trusted, so a fixture called
    `marked.txt` yields `""` and not `"mar"` — a language that does not exist,
    silently substituted, is the failure this function is here to avoid rather
    than to commit one layer down.

    `phonology` is imported inside the body, matching `read_marked_songs`'s own
    `import lyric_harness`: this module imports nothing from `quality` at
    module level and a language lookup is not the reason to start.
    """
    from quality import phonology as _PH
    head = os.path.basename(path).split("_")[0]
    return head if head in _PH.declared() else ""


#: A MARK POINTS AT THE MARK IT IS A VARIATION OF.
#:
#: `quality/SECTION_ORDER_PREREGISTRATION.md` registered TWO fields and its
#: falsifier fired on one of them. `rank` -- a position in the monotone ladder
#: urlar < siubhal < taorluath < crunluath < crunluath a-mach -- is REFUSED:
#: two of the three staged pìobaireachds are NOT monotone, none is complete,
#: and `TAORLUATH`/`CRUNLUATH A-MACH` have zero attestation anywhere in the
#: corpus. What the literary imitation does is ALTERNATE (ground, variation,
#: ground, variation, close), so a `rank` check would have failed two of three
#: songs that are printed exactly as their editor set them (doctrine 6).
#:
#: `elaborates` SURVIVED that falsifier and this is it. The relation holds
#: regardless of sequence, and it is what makes the alternation readable
#: rather than random.
#:
#: IT IS ON THE MARK AND NOT ON `FunctionSpec`, AND THE REGISTRATION SAID
#: `FunctionSpec`. The registration was written while all 14 headings were
#: still typed `[VERSE n]` with the heading as the block's whole lyric
#: (`MISSING.md` M-25(a)); staging them as marks is what gave the field a
#: population, and it put that population on the MARK. Declaring three new
#: SECTION FUNCTIONS instead would mean folding a pìobaireachd movement into
#: a vocabulary the canon survey says it strains -- the exact move
#: `MARK_REFUSED` exists to decline. Recorded rather than retargeted in
#: silence (doctrine 17).
#:
#: MEASURED over the whole population, 9 elaborating sections in 3 songs:
#: every target is PRESENT, and 8 of 9 are grounded BEFORE the elaboration.
#: The one exception is `THE PRAISE OF MORAG`, whose opening siubhal precedes
#: its urlar because the page prints the first movement with NO HEADING AT
#: ALL -- a heading appears only where the movement changes.
MARK_ELABORATES = {
    "SIUBHAL": "URLAR",
    "TAORLUATH": "URLAR",
    "CRUNLUATH": "URLAR",
    "CRUNLUATH A-MACH": "URLAR",
}


def elaboration_findings(song):
    """-> (findings, counts) for one `MarkedSong`.

    THREE COUNTS, NEVER SUMMED (doctrine 79):

      grounded_before  the mark it elaborates appears EARLIER in the song
      grounded_after   the target appears, but only later -- a legitimate
                       shape (a variation-first opening), not a defect
      ungrounded       the target never appears at all

    ONLY `ungrounded` IS A FINDING. Ordering is a DISCLOSURE and not a
    charge: an editor who opens on a variation has departed from nothing, and
    doctrine 6 says a convention a writer may depart from cannot be what
    fails a check. `ELABORATION_UNGROUNDED` is different in kind -- the
    section says it varies something the song does not contain, which is a
    factual claim and false.

    SEVERITY IS NOT SET HERE AND CANNOT BE: `GridFinding` carries `code`,
    `message` and `evidence` and no severity at all, because in this module
    severity is the CONSUMER's decision (`Reviser._function_findings` is
    where a grid finding becomes a note or a flag). The first draft of this
    docstring said "and it is a NOTE", which was a claim about an object
    that has no such field -- one question answered in two places, with one
    of the answers imaginary (doctrine 1).

    MEASURED CORPUS-WIDE: `ungrounded` is **0 of 9**. That zero is over a
    named population and is not evidence the check works, so
    `quality/test_grid.py` plants the defect to prove it fires (doctrine 94 --
    a positive-case suite cannot find a rule that is too generous).
    """
    order = [b.base for b in song.blocks]
    out = []
    counts = {"grounded_before": 0, "grounded_after": 0, "ungrounded": 0}
    for i, base in enumerate(order):
        target = MARK_ELABORATES.get(base)
        if target is None:
            continue
        if target not in order:
            counts["ungrounded"] += 1
            out.append(GridFinding(
                "ELABORATION_UNGROUNDED",
                "`%s` elaborates `%s`, and no `%s` appears in this song"
                % (base, target, target),
                "the mark declares itself a variation OF something the song "
                "does not contain. Unlike the ORDER of the two, which is an "
                "editor's choice, this is a factual claim and it is false"))
        elif target in order[:i]:
            counts["grounded_before"] += 1
        else:
            counts["grounded_after"] += 1
    return out, counts


@dataclass
class Block:
    """One marked block of a printed song, as the source marked it."""
    mark: str                # the raw mark, e.g. 'CHORUS 2'
    base: str                # normalised head, e.g. 'CHORUS'
    index: int               # the numeral the mark carries; 1 when bare
    function: str            # a declared function, or UNDECLARED
    lines: list = field(default_factory=list)
    #: The PRINTED INDENT of each line in `lines`, index-aligned with it.
    #: The compositor's indent ladder is the rhyme scheme set visibly, and
    #: every reader in this repo stripped it before anything saw it until
    #: 2026-08-21 -- measured at 6.19x against a within-block permutation
    #: null, `MISSING.md` M-28 and `lyric_harness.line_indent`. Carried, not
    #: interpreted: nothing here derives a mandate from whitespace, because a
    #: cover derived from the printing is exactly as DERIVED as `--cliques`
    #: (doctrine 14). Empty on a `Block` built by any path but
    #: `read_marked_songs`, which is honest -- a blueprint declares no
    #: printing.
    indents: list = field(default_factory=list)
    refusal: Refusal = None
    source_line: int = 0
    #: text printed on the MARK's own line. In this corpus's convention that
    #: is apparatus, never sung text -- `[CHORUS 2] (differs from CHORUS 1 --
    #: repetition with variation)` is an editor speaking. Reading it as a
    #: fifth line of a four-line chorus made Hanby's variant compare 5 against
    #: 4 and report REWRITTEN_RETURN, which is the one answer it is not.
    annotation: str = ""


@dataclass
class MarkedSong:
    title: str = ""
    #: The tune this song was sung to, when the staged header names one.
    #: `""` when it does not -- never `None`, so a caller cannot mistake
    #: "no air was recorded" for "the air is unknown to this reader".
    air: str = ""
    path: str = ""
    language: str = ""
    blocks: list = field(default_factory=list)

    def instances(self, function):
        """-> {index: [Block]} for a function. Two blocks with the same
        function AND the same index are RETURNS of one another; different
        indices are different instances.

        That reading is DECLARED and it is what the corpus means: `[VERSE 1]`
        and `[VERSE 2]` are two verses with new words, and `[CHORUS]` beside
        `[CHORUS 2]` is one chorus and its variant -- which is precisely the
        A-2 case, already marked, in the printed record.
        """
        fn = as_function(function)
        out = {}
        for b in self.blocks:
            if b.function == fn:
                out.setdefault(b.index, []).append(b)
        return out


_MARK_RE = re.compile(r"^\[([^\]]*)\]")
_INDEX_RE = re.compile(r"(\d+)\s*$")


def ingest_mark(mark, language=""):
    """-> (base, index, function, refusal). Reads a printed mark; never a name.

    The numeral is an INSTANCE INDEX, declared: `[CHORUS 2]` is the song's
    second chorus, not the chorus's second return. `[PANTUN ABAB]` and
    `[QUATRAIN AAAA]` carry a rhyme scheme after the head, so the base is the
    FIRST token; `[CHORUS: abbreviated return, printed "&c."]` carries an
    editorial note after a colon, so the head stops there.

    `language` IS THE COORDINATE A REFUSAL IS TRUE IN (`MISSING.md` M-24,
    doctrine 45). Three answers, and the middle one is new:

      * the base is refused IN THIS LANGUAGE -> that language's own reason.
      * the base is refused in some OTHER language and not in this one ->
        `MARK_REFUSED_ELSEWHERE`. The other tradition's sentence is NOT
        quoted: a reason written about Kalevala wedding songs is a true
        statement in the wrong language about the wrong object, and
        answering with it would be worse than not answering. Doctrine 20 —
        nobody has written what this mark means here, which is not the same
        as its having been decided.
      * no language is declared at all -> the reason is still given, LABELLED
        with the tradition it was written for. Every recorded refusal keeps
        its wording; what changes is that the reader is told whose it is,
        rather than the table's single voice being read as universal.
    """
    head = re.split(r"[:(]", mark, 1)[0].strip()
    m = _INDEX_RE.search(head)
    index = int(m.group(1)) if m else 1
    head = _INDEX_RE.sub("", head).strip()
    base = head.split()[0].upper() if head.split() else ""
    if base in MARK_FUNCTION:
        # NOT KEYED ON LANGUAGE, and the measurement is the argument -- see
        # `MARK_REFUSED`'s own note. `VERSE` is carried by five languages.
        return base, index, MARK_FUNCTION[base], None
    if not base:
        return base, index, UNDECLARED, Refusal(
            "MARK_IS_A_NUMERAL",
            f"the mark {mark!r} is a bare numeral",
            "A numbered bracket in a printed text is a footnote reference or "
            "a stanza number, not a section. Reading it as a function would "
            "make the apparatus into structure.")
    rows = _REFUSED_BY_BASE.get(base)
    if rows and language and language not in rows:
        elsewhere = ", ".join(sorted(rows))
        return base, index, UNDECLARED, Refusal(
            "MARK_REFUSED_ELSEWHERE",
            f"the source mark {base!r} is not declared in {language!r}",
            f"{base!r} carries a written decision in {elsewhere} and NONE in "
            f"{language!r}. That other tradition's reason is deliberately not "
            f"quoted here: it would be a true sentence about a different "
            f"object (doctrine 45). Nobody has written what {base!r} means in "
            f"{language!r}, which is not the same as its having been decided "
            f"(doctrine 20) — the remedy is a row, in this language, with a "
            f"reason.")
    if rows:
        lang = language if language in rows else sorted(rows)[0]
        reason = rows[lang]
        if not language:
            reason = (f"[the decision below was written for {lang!r}; this "
                      f"reader was given no language] " + reason)
        return base, index, UNDECLARED, Refusal(
            "MARK_NOT_A_FUNCTION",
            f"the source mark {base!r} is not read as a section function",
            reason)
    return base, index, UNDECLARED, Refusal(
        "MARK_UNRECOGNISED",
        f"the source mark {base!r} is not read as a section function",
        f"{base!r} is in no declared table. It is refused rather "
        f"than guessed: a mark that looks stanza-shaped is not "
        f"evidence of a function, and the table is closed on "
        f"purpose so that additions are decisions.")


#: THE NAMED AIR, WHICH WAS NEVER MISSING -- IT WAS INSIDE ANOTHER COORDINATE.
#: `MISSING.md` M-11 records ZERO named airs across every non-English song
#: staged and names `--- AIR:` as the blocker. There is no `--- AIR:` line in
#: `corpus/song/` and there does not need to be: the stagers already write the
#: tune, into the TITLE VALUE, as `--- TITLE: CHWI FEIBION DEWRION  [air:
#: Marseillaise]`. Adding a second line carrying the same string would be the
#: duplicate copy this codebase keeps deleting; what was actually wrong is that
#: nothing SPLIT it, so `MarkedSong.title` read
#: `'CHWI FEIBION DEWRION  [air: Marseillaise]'` for 11,099 songs and the air
#: was a substring rather than a coordinate (doctrine 45).
AIR_IN_TITLE = re.compile(r"\s*\[\s*air\s*:\s*([^\]]*)\]\s*", re.I)


def split_named_air(value):
    """-> `(title, air)` for a `--- TITLE:` value. `air` is `""` if none.

    The air is REMOVED from the title, because leaving it in both places is
    what made the two disagree. Everything else in the value is preserved,
    including the ci convention's `其N` disambiguator.
    """
    m = AIR_IN_TITLE.search(value)
    if not m:
        return value.strip(), ""
    return (value[:m.start()] + " " + value[m.end():]).strip(), m.group(1).strip()


#: A ci's title IS its 詞牌 -- `build_ci_corpus.py` prints one variable into
#: both fields -- so `air == title` is guaranteed by the stager rather than
#: measured, and it is not independent evidence that anybody recorded a tune.
#: Counted apart from a DISTINCT air and never summed with it (doctrine 79):
#: they answer two different questions and M-11 asks only the second.
AIR_RESTATED = "restated"
AIR_DISTINCT = "distinct"


def named_air_kind(title_value):
    """-> `AIR_DISTINCT`, `AIR_RESTATED`, or `""` when no air is named."""
    title, air = split_named_air(title_value)
    if not air:
        return ""
    head = re.sub(r"\s*\u5176\s*\d+\s*$", "", title).strip()
    return AIR_RESTATED if air in (title, head) else AIR_DISTINCT


def named_air_census(paths):
    """-> `{prefix: {AIR_DISTINCT: n, AIR_RESTATED: n, "songs": n}}`.

    The rate M-11 asks for, re-derivable by command, with its two numerators
    kept apart. A prefix with songs and no airs reports zeros rather than
    being absent from the mapping -- an absent key reads like a pass.
    """
    out = {}
    for path in paths:
        prefix = os.path.basename(path)[:3]
        cell = out.setdefault(prefix, {AIR_DISTINCT: 0, AIR_RESTATED: 0,
                                       "songs": 0})
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if not line.startswith("--- TITLE:"):
                    continue
                cell["songs"] += 1
                kind = named_air_kind(line[len("--- TITLE:"):])
                if kind:
                    cell[kind] += 1
    return out


def read_marked_songs(path, language=""):
    """-> [MarkedSong] from one `corpus/song/*.txt` file.

    The file conventions: `#` header lines are metadata, `--- TITLE:` opens a
    song, `--- ` otherwise is a per-song source note, `[MARK]` opens a block.

    THE APPARATUS DROP IS THE CENTRE'S, 2026-08-13. The three tests above are
    STRUCTURAL -- they decide what OPENS a song and what OPENS a block, and
    their order is load-bearing: `--- TITLE:` must be asked first because it
    opens a song, and `_MARK_RE` must be asked before any apparatus rule
    because `[VERSE 1]` IS apparatus by `lyric_harness.is_apparatus_line` and
    is nonetheless the thing that opens a block. What was missing is the
    CONTENT test on the append branch, and its absence made this reader
    disagree with the one definition in two ways at once:

      * it never stripped before testing, so an indented `#` or `---` reached
        the append branch as sung text; and
      * a `[` with NO CLOSING `]` ON THE SAME LINE does not match `_MARK_RE`,
        so it opened no block and fell straight through to be scored as a
        LYRIC. That is the whole of Gay's `[Exeunt.`, `[Drinks.`,
        `[Rises.`, Durfey's `[Music:` and Hemans's `[_Exeunt omnes._`.

    MEASURED over `corpus/song/` before shipping it: 133 lines in 19 files,
    across 130 blocks, and 14 of those blocks are EMPTIED -- a one-line stage
    direction was their entire "lyric". Emptying them is the correction, not a
    cost to weigh against it: `[VERSE 2]` followed by nothing but `[Exeunt.`
    is a verse with no words in the printed source, and the reader now says
    so. An empty block was ALREADY this corpus's ordinary state (6,187 of
    182,147 before this rule, 5,884 of them Persian), so nothing downstream
    could have been assuming otherwise; 6,201 after, and none of the 14 is a
    chorus/burden/refrain, so no `compare_returns` pair is built from one.
    `quality/test_song_function.py` §9 pins all of it and
    `quality/test_grid.py` pins the rule on a fixture.
    """
    import lyric_harness as LH
    # THE COORDINATE WAS ON THE PATH AND WAS DROPPED AT THE ONE CALL THAT
    # NEEDED IT. This function has taken `language=` since it was written and
    # stored it on `MarkedSong`; `ingest_mark` — the reader that decides what
    # a mark MEANS — was handed nothing, and `audit_corpus` calls this with no
    # language at all. Derived from the filename when not declared, which is
    # the same three characters the phonology has dispatched on since
    # doctrine 45.
    language = language or language_of_path(path)
    songs, cur = [], None
    with open(path, encoding="utf-8", errors="replace") as f:
        raw_lines = f.read().splitlines()
    # The DECLARED bracket-apparatus rules (M-47/M-27), the same two calls
    # `load_lyric_lines` makes, so the block reader and the CLI reader
    # cannot disagree about which lines a wrapped Gutenberg note owns or
    # what a bracketed span means (doctrine 1).
    _bracket_drops = LH.wrapped_apparatus_drops(raw_lines, path)
    for idx0, line in enumerate(raw_lines):
        n = idx0 + 1
        if idx0 in _bracket_drops:
            continue
        if line.startswith("--- TITLE:"):
            _t, _air = split_named_air(line[len("--- TITLE:"):])
            cur = MarkedSong(title=_t, air=_air,
                             path=path, language=language)
            songs.append(cur)
            continue
        if line.startswith("#") or line.startswith("--- "):
            continue
        if cur is None:
            continue
        s = line.strip()
        m = _MARK_RE.match(s)
        if m:
            base, idx, fn, ref = ingest_mark(m.group(1), language)
            cur.blocks.append(Block(mark=m.group(1), base=base, index=idx,
                                    function=fn, refusal=ref,
                                    source_line=n))
            cur.blocks[-1].annotation = s[m.end():].strip()
        elif s and cur.blocks and not LH.is_apparatus_line(s):
            s2 = LH.normalise_bracket_spans(s, path).strip()
            if s2:
                cur.blocks[-1].lines.append(s2)
                cur.blocks[-1].indents.append(LH.line_indent(line))
    return songs


def indent_partition(block):
    """-> tuple[int, ...] — each line's group id under the PRINTED indent.

    Group ids are assigned in order of first appearance, so the partition is
    a shape and not a set of column counts: a stanza printed flush/indented/
    flush/indented reads `(0, 1, 0, 1)` whether the indent is 2 spaces or 8.
    That is what makes two files comparable, and it is the same normalisation
    a letter scheme already applies to rhyme.

    Returns `()` when the block carries no recorded indents (a `Block` from a
    blueprint) — EMPTY, never all-zeros, because "the printing said nothing"
    and "the printing set every line flush" are different facts and only one
    of them is a measurement (doctrine 20).
    """
    if not block.indents or len(block.indents) != len(block.lines):
        return ()
    seen, out = {}, []
    for d in block.indents:
        if d not in seen:
            seen[d] = len(seen)
        out.append(seen[d])
    return tuple(out)


# ---------------------------------------------------------------------------
# THE SECTION COORDINATE, SUPPLIED  (`MISSING.md` M-39)
# ---------------------------------------------------------------------------
#
# WHAT WAS INERT.  `relations.build_stream` has taken a `sections=` argument
# since it was written; `relations.Unit.section` is populated from it; two
# `Placement` kinds -- `different_sections` and `same_section` -- read it.
# MEASURED 2026-08-22: **zero callers anywhere pass `sections=`**, so every
# `Unit.section` is `""`, so one of those predicates is always True and the
# other always False -- and **zero of the 77 schemas declare either kind**.
# Four layers of declared-and-unreached, which is `SpanRule.terminator`
# (defect P2) and M-15's shape a third time.
#
# WHY THE PARSER LIVES HERE AND NOT THERE.  `relations.py` serves nine
# languages and ships no vocabulary -- it declined to ship a rime rule for
# the same reason (doctrine 45/65). The section MARK vocabulary is this
# module's: `MARK_FUNCTION`, `MARK_REFUSED` and `ingest_mark` already read it,
# already know that `VERSE 1` is a verse, and already REFUSE `BAYT` and
# `RADIF` for English because those marks belong to other traditions. So the
# coordinate is derived HERE, from the declared table, and handed across --
# `relations` stays the engine and this stays the vocabulary.

#: The corpus's printed section mark. MEASURED over `corpus/song/*.txt`:
#: `[VERSE n]` 74,318 · `[BAYT n]` 70,866 · `[RADIF]` 54,193 · `[BURDEN]`
#: 1,753 · `[REFRAIN]` 709 · `[CHORUS]` 267 · `[SLOKA]` 144 and a tail of
#: nine more. The bracket is the convention; what is INSIDE it is adjudicated
#: by `ingest_mark`, never by this pattern.
SECTION_MARK = re.compile(r"^\s*\[([^\]]+)\]\s*$")

SECTION_MARKER_STATUS = "section_marker"


def sections_from_marks(text_lines, language=""):
    """-> (sections, line_status), both one entry per line, for `build_stream`.

    `sections` is a per-line SECTION IDENTITY and `line_status` marks the
    marker lines themselves so a caller can pass
    `exclude_status=(SECTION_MARKER_STATUS,)` and keep them out of the token
    stream. That matters on its own: `build_stream` tokenises whatever it is
    given, so an unfiltered `[CHORUS]` becomes the WORD `CHORUS` and can
    stand in a `repetition` with the next one. Every caller that matters
    filters first today, which makes this latent rather than live -- but the
    filtering lives in each caller instead of in the coordinate, and that is
    the arrangement that eventually gets one caller wrong.

    THE IDENTITY IS PER OCCURRENCE, and that is a choice worth stating: a
    second `[CHORUS]` is a DIFFERENT section here (`CHORUS#3`), not the same
    one returning. `different_sections` and `same_section` are placement
    predicates about whether a pair crosses a printed block boundary, and the
    per-occurrence reading is the one that answers that. The OTHER reading --
    that both choruses are one thing recurring -- is a question about
    FUNCTION, it is what `MARK_FUNCTION` and the returns machinery already
    answer, and it is deliberately NOT supplied through this field
    (doctrine 1: one coordinate, one question).

    A mark this module REFUSES for the declared language keeps its base in the
    identity and is reported by `section_census`; it is not silently dropped
    and not silently accepted (doctrine 79). Lines before the first mark get
    `""` -- undeclared, which is honest and is exactly what the field's
    historical default already meant.
    """
    sections, status = [], []
    cur, k = "", 0
    for raw in text_lines:
        m = SECTION_MARK.match(raw or "")
        if m:
            base, _n, _fn, _ref = ingest_mark(m.group(1).strip(), language)
            cur = "%s#%d" % (base, k)
            k += 1
            status.append(SECTION_MARKER_STATUS)
        else:
            status.append("")
        sections.append(cur)
    return sections, status


#: base mark -> does this mark OPEN A NEW METRICAL GROUP?
#:
#: A THIRD QUESTION ABOUT THE SAME TOKEN, and it is a separate table because
#: it is a separate question.  `MARK_FUNCTION` asks whether a mark names a
#: SONG-FORM function; `MARK_REFUSED` says why a mark does not.  Neither
#: answers what `relations.build_stream(stanzas=...)` needs to know, and
#: reading either one as if it did is doctrine 43 in the direction this
#: module usually catches it going the other way: `BAYT`, `SLOKA` and
#: `PANTUN` are all refused as functions, and all three refusals say IN THEIR
#: OWN WORDS that the mark is a couplet-unit, a metrical stanza-unit and a
#: quatrain form — which is exactly a metrical group.  A ghazal has no chorus
#: AND has stanzas.
#:
#: EVERY ROW QUOTES A DECISION ALREADY WRITTEN IN THIS FILE.  Nothing here is
#: a new judgement about a tradition; the reasons in `MARK_FUNCTION` and
#: `MARK_REFUSED` were written for the other two questions and each already
#: says whether the mark is A SPAN OF THE TEXT.  Where an existing reason does
#: NOT say, the mark is ABSENT from this table and the ground is refused
#: whole (see `stanza_ground`) rather than being built from the marks that
#: happen to be declared: a stanza vector that is right about four marks and
#: silent about a fifth is not a partial answer, it is a wrong one.
MARK_OPENS_GROUP = {
    # spans of the song — `MARK_FUNCTION`'s five, which are functions
    # precisely because they are spans.
    "VERSE": True, "CHORUS": True, "BURDEN": True, "BURDEN-TAIL": True,
    "REFRAIN": True,
    # metrical units, each quoting its own `MARK_REFUSED` reason.
    "BAYT": True,        # "the couplet-unit of a ghazal"
    "SLOKA": True,       # "a metrical stanza-unit"
    "PANTUN": True,      # "a whole quatrain FORM"
    "QUATRAIN": True,    # "a printing/metrical unit"
    "CYWYDD": True,      # "a Welsh METRE name" — it heads a poem
    # pìobaireachd movements.  `URLAR`'s refusal says it verbatim: "It IS a
    # span of the performance, which is why it is a mark at all"; the other
    # three are refused "for the same reason".
    "URLAR": True, "SIUBHAL": True, "TAORLUATH": True, "CRUNLUATH": True,
    "PATTER": True,      # "a music-hall function" — a function is a span
    # NOT a span, and each says so.
    "RADIF": False,      # "not a span of the song. It has no bars and no
    #                      return."
    "NOTE": False, "SIDENOTE": False, "MUSIC": False, "GOTHIC": False,
    "VARIANT": False,    # editorial apparatus, all five
    # `PART` IS DELIBERATELY ABSENT.  Its reason — "a speaker or role
    # attribution in the Kalevala wedding songs" — settles that it is not a
    # FUNCTION and says nothing about whether a change of speaker begins a
    # metrical group.  Deciding that here would be inventing a fact about
    # Finnish wedding songs to make a vector come out non-empty.
}

#: A `---` row is the corpus's own SONG boundary (`--- TITLE:`, `--- SOURCE:`
#: and the rest are written by the loaders in `quality/`), and a new song is a
#: new group under any reading.
GROUP_BREAK_PREFIX = "---"


def stanza_ground(text_lines, language=""):
    """-> (stanzas, source, refusals).  THE PRINTED GROUP COORDINATE, for
    `relations.build_stream(stanzas=...)`.

    `stanzas` is one 0-based group index per input line, or `None` when the
    text carries no ground at all.  `source` is `"printed_breaks"` or
    `"none"`.  `refusals` names every mark the span carried that
    `MARK_OPENS_GROUP` does not declare.

    ONE RULE, APPLIED TO EVERY TRADITION (doctrine 1).  A group ends at a run
    of blank lines, at a `---` row, or at a `[MARK]` that `MARK_OPENS_GROUP`
    declares to open one.  There is no per-file branch and no sniffing: the
    three break kinds are the ones the corpus prints, and which marks are of
    the third kind is a closed table with a reason per row.

    WHY THIS EXISTS.  `relations.stanzas_from_blank_lines` is the only other
    ground and it has evidence only where a text prints a blank line.  Both
    of `relations_null`'s panel readers drop blank lines AND `[MARK]` rows
    before tokenising, so measured on 2026-08-22 all NINE panel slices
    reported exactly ONE distinct `Unit.stanza` and the five `frame="stanza"`
    schemas were quantified over a frame that could not vary — including
    `monorhyme / leash`, second in that run's admissible set at +227.

    A REFUSED SPAN RETURNS `None` AND NOT A BEST EFFORT.  If any mark in the
    span is undeclared the whole ground goes, because the alternative is a
    vector that silently merges two groups and reports a number for it.
    """
    stanzas, refusals = [], []
    g, seen, opened = 0, False, False
    for raw in text_lines:
        line = raw or ""
        t = line.strip()
        if not t:
            stanzas.append(g)
            if seen:
                g += 1
                seen = False
            continue
        if t.startswith(GROUP_BREAK_PREFIX):
            if seen:
                g += 1
                seen = False
            opened = True
            stanzas.append(g)
            continue
        m = SECTION_MARK.match(line)
        if m:
            base, _n, _fn, _ref = ingest_mark(m.group(1).strip(), language)
            if base not in MARK_OPENS_GROUP:
                refusals.append(base)
                stanzas.append(g)
                continue
            if MARK_OPENS_GROUP[base]:
                if seen:
                    g += 1
                    seen = False
                opened = True
            stanzas.append(g)
            continue
        stanzas.append(g)
        seen = True
    if refusals:
        return None, "none", tuple(sorted(set(refusals)))
    if not opened and len(set(stanzas)) < 2:
        # No break of any kind fired.  That is not "one stanza": it is a text
        # that never told this function where its stanzas are, and the two
        # must not produce the same vector (doctrine 20).
        return None, "none", ()
    return stanzas, "printed_breaks", ()


def stanzas_from_sections(sections):
    """-> a per-line 0-based STANZA index derived from a per-line SECTION
    vector, for `relations.build_stream(stanzas=...)`.

    THE SECOND GROUND, and it is declared rather than sniffed.  `relations`
    ships one derivation, `stanzas_from_blank_lines`, and it has evidence only
    where the text prints a blank line.  Measured on the `relations_null`
    panel (2026-08-22): both panel readers drop blank lines before tokenising,
    so all NINE slices reported exactly one distinct `Unit.stanza` and the five
    `frame="stanza"` schemas were quantified over a frame that could not vary.
    Three of the nine slices -- `fin`, `cym`, `san` -- print neither a blank
    line NOR a section mark inside the span read, so for those the honest
    answer is that no ground exists and `Stream.supply('stanza')` refuses.
    The other six carry marks the corpus already prints, and this turns them
    into the coordinate.

    A SECTION IS NOT A STANZA and this does not claim otherwise.  A verse can
    print three stanzas under one `[VERSE 1]`, and where a text carries both
    grounds they will disagree; the caller picks, the pick is recorded in
    `Frames.stanza_source`, and the two are never averaged.  What this rules
    out is the third state -- no ground at all, silently rendered as one.

    Lines before the first mark carry `""` from `sections_from_marks` and are
    grouped together as stanza 0, which is a real group (the material a text
    prints above its first heading) and not a fallback.
    """
    out, seen, cur = [], {}, None
    for sec in sections:
        if sec not in seen:
            seen[sec] = len(seen)
        out.append(seen[sec])
    return out


def section_census(text_lines, language=""):
    """-> {'marks': n, 'sections': n, 'functions': {...}, 'refused': {...},
    'lines_before_first_mark': n} -- what a text's section marks ARE.

    The three counts are kept apart (doctrine 79): a mark this language
    declares, a mark another tradition owns and this one REFUSES, and the
    lines that sit under no mark at all.
    """
    marks = funcs = 0
    refused, fn = {}, {}
    before, seen = 0, False
    for raw in text_lines:
        m = SECTION_MARK.match(raw or "")
        if not m:
            if not seen:
                before += 1
            continue
        seen = True
        marks += 1
        base, _n, function, ref = ingest_mark(m.group(1).strip(), language)
        if ref is not None:
            refused[base] = refused.get(base, 0) + 1
        elif function:
            funcs += 1
            fn[function] = fn.get(function, 0) + 1
    return {"marks": marks, "sections": marks, "functions": fn,
            "declared_functions": funcs, "refused": refused,
            "lines_before_first_mark": before}


__all__ = ["Meter", "Line", "Section", "Song", "GridFinding",
           "song_from_blueprint",
           "uniformity", "stanza_lock", "phrase_profile", "line_pickup",
           # section function -- MISSING.md D-1
           "UNDECLARED", "UnknownFunction", "FunctionSpec",
           "SECTION_FUNCTIONS", "as_function", "FormConvention",
           "POPULAR_SONG", "function_profile", "return_findings",
           "reprise_findings",
           "bridge_contrast", "song_function_report", "Refusal",
           # repetition with variation -- MISSING.md A-2, D-3
           "VARIATION_KINDS", "VariationDeclaration", "Return",
           "compare_returns", "normalise_line", "tokens",
           "indent_partition",
           "MARK_ELABORATES", "elaboration_findings",
           "rime_orthographic", "rime_cmudict",
           # the hook -- MISSING.md D-2
           "Hook", "HookOccurrence", "hook_occurrences", "hook_findings",
           # reading the corpus's own marks
           "MARK_FUNCTION", "MARK_REFUSED", "ingest_mark",
           "language_of_path", "Block",
           "MarkedSong", "read_marked_songs",
           # the named air -- MISSING.md M-11, BACKLOG 3.2
           "AIR_DISTINCT", "AIR_RESTATED", "split_named_air",
           "named_air_kind", "named_air_census",
           # the section coordinate -- MISSING.md M-39
           "SECTION_MARK", "SECTION_MARKER_STATUS",
           "sections_from_marks", "section_census",
           "stanzas_from_sections",
           "MARK_OPENS_GROUP", "GROUP_BREAK_PREFIX", "stanza_ground"]
