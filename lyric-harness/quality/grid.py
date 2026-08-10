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
"""

import itertools
from dataclasses import dataclass, field
from fractions import Fraction

# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Meter:
    """A time signature. Arbitrary; nothing here privileges 4/4."""
    beats: int = 4
    unit: int = 4

    def __str__(self):
        return f"{self.beats}/{self.unit}"

    @property
    def compound(self):
        return self.unit in (8, 16) and self.beats % 3 == 0 and self.beats > 3

    @property
    def pulse_groups(self):
        """How the bar subdivides. 7/8 is 2+2+3 or 3+2+2 and which one it is
        changes the whole feel, so it is not derivable and a caller who cares
        must declare it."""
        if self.compound:
            return tuple([3] * (self.beats // 3))
        return tuple([1] * self.beats)


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


@dataclass
class Section:
    """A named span measured in BARS. There is no line count field."""
    name: str
    bars: int
    meter: Meter = field(default_factory=Meter)
    start_bar: int = 1

    @property
    def end_bar(self):
        return self.start_bar + self.bars - 1


@dataclass
class Song:
    sections: list = field(default_factory=list)
    lines: list = field(default_factory=list)

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


__all__ = ["Meter", "Line", "Section", "Song", "GridFinding",
           "uniformity", "stanza_lock", "phrase_profile"]
