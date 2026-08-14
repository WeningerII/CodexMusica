#!/usr/bin/env python3
"""Metric cycles. One object, enough degrees of freedom for all of it.

WHAT THIS REPLACES

`grid.Meter` held two integers and a simple/compound guess. It could store
`9/8` and then ASSERT the grouping 3+3+3 — the European reading — where Balkan
daichovo is 2+2+2+3. It did not fail to express the grouping; it silently
supplied the wrong one. 5/8, 7/8, 11/8 and 13/8 collapsed to undifferentiated
pulses, so rachenitsa, kopanitsa and lesnoto were indistinguishable from each
other and from nothing.

THE TWO THINGS A METER IS

1. **A DURATION, which is an exact rational.** `n/d` means *n notes of length
   1/d*, so the bar is `Fraction(n, d)` whole-notes. Let `n` itself be a
   Fraction and the whole range .125/1 through 64/32 is one object with no
   special cases. "Irrational" bottoms are not irrational numbers — they are
   denominators that are not powers of two, so 4/3 is four third-notes and the
   bar is exactly `Fraction(4, 3)`. Rationals never lose a tie the way floats
   do, and a tie lost in a metric grid is a beat in the wrong place.

2. **A GROUPING, which is an ordered COMPOSITION of the pulse count.**
   7/8 as 2+2+3 and as 3+2+2 are different meters sharing one duration. There
   are **2^(n-1)** compositions of n, so seven pulses admit 64 distinct
   meters. This is the same shape as `schemes.py` one level down: rhyme
   schemes are set PARTITIONS (Bell), metric groupings are COMPOSITIONS
   (ordered, 2^(n-1)).

NOTHING IS SNIFFED. If a grouping is not declared, `groups` is empty and
`pulse_groups()` returns **None**. `conventional_grouping()` exists separately
and is labelled a convention, because "4/4 is 2+2" is a habit of one repertoire
and not a property of the signature.

WHAT ELSE A CYCLE MAY CARRY

- **Typed groups** — a Carnatic tāla is a composition whose parts have KINDS:
  laghu (variable by jāti), drutam (2), anudrutam (1). `group_labels` runs
  parallel to `groups`.
- **Per-position labels** — an usul or an īqāʿ is not a grouping, it is a
  LABELLED cycle: maqsūm is not "4 grouped 2+2", it is D T – T / – T D –. The
  identity of each position matters, not just where the accents fall.
- **Marked positions** — Hindustani tāl marks sam (the emphatic return) and
  khali (the empty). Teental is 16 as 4+4+4+4 with sam at 1 and khali at 9.
- **Nested periodicities with phase** — colotomic form. The gong closes the
  gongan, the kenong subdivides it, the kempul sits offset between. A set of
  (period, phase, marker) triples over one cycle.
- **NO CANONICAL ORIGIN** — `origin=None` is polycentric: each part carries its
  own phase reference and there is no privileged beat 1. This is the setting
  that breaks the most assumptions elsewhere, because almost every
  representation quietly assumes a downbeat exists.

AND THE THINGS THAT ARE NOT ONE CYCLE

`Polymeter` (concurrent cycles that do not share a barline; composite period is
the lcm of their durations), `Polyrhythm` (n against m INSIDE one span, sharing
a barline), `Density` (irama — a ratio between layers over a fixed frame, which
is not a meter change and must not be stored as one), and `MeterMap` (meter as
a function of bar index — mixed meter).

WHAT IS DELIBERATELY ABSENT

The CATALOGUES. There are 35 Carnatic tālas, 100+ usuls, ~100 īqāʿāt, the
gamelan forms, the flamenco compases, the West African timelines. This module
can hold every one of them and contains none, because writing them from memory
would put unsourced data into the evidence base. `get_named()` raises and says
so. See MISSING.md C-2.
"""

import itertools
import json
from dataclasses import dataclass, field
from fractions import Fraction
from math import gcd

# ---------------------------------------------------------------------------
# THE MATH
# ---------------------------------------------------------------------------


def compositions(n):
    """Every ORDERED grouping of n pulses. 2^(n-1) of them.

    (2,2,3) and (3,2,2) are both yielded and are different meters. This is the
    space `grid.Meter` represented one point of, by assertion.
    """
    if n <= 0:
        return
    for k in range(n):
        for cuts in itertools.combinations(range(1, n), k):
            prev, out = 0, []
            for c in cuts:
                out.append(c - prev)
                prev = c
            out.append(n - prev)
            yield tuple(out)


def n_compositions(n):
    return 2 ** (n - 1) if n > 0 else 0


def lcm_fraction(a, b):
    """lcm of two Fractions: lcm(num)/gcd(den). The composite period of two
    concurrent cycles that do not share a barline."""
    a, b = Fraction(a), Fraction(b)
    if a == 0 or b == 0:
        return Fraction(0)
    num = a.numerator * b.numerator // gcd(a.numerator, b.numerator)
    den = gcd(a.denominator, b.denominator)
    return Fraction(num, den)


# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Marker:
    """A nested periodicity: `name` sounds every `period` pulses from `phase`.

    Colotomic structure is a set of these over one cycle. So is hypermeter.
    """
    name: str
    period: Fraction
    phase: Fraction = Fraction(0)

    def positions(self, cycle_pulses):
        p, out, x = Fraction(self.period), [], Fraction(self.phase)
        while x < cycle_pulses:
            out.append(x)
            x += p
        return tuple(out)


@dataclass(frozen=True)
class Cycle:
    """One metric cycle. Every item on the list is a setting of this.

    `pulses` may be a Fraction (fractional top numbers). `unit` need not be a
    power of two (so-called irrational signatures). Nothing is inferred: an
    undeclared grouping stays undeclared.
    """
    pulses: Fraction = Fraction(4)
    unit: int = 4
    groups: tuple = ()          # ordered composition; sums to int(pulses)
    group_labels: tuple = ()    # parallel to groups — tala angas
    labels: tuple = ()          # per-POSITION labels — usul / iqa' strokes
    markers: tuple = ()         # nested periodicities — colotomic, hypermeter
    sam: object = None          # emphatic return (Hindustani)
    khali: tuple = ()           # empty positions
    origin: object = 1          # None => POLYCENTRIC, no canonical downbeat
    name: str = ""
    tradition: str = ""
    source: str = ""            # where the catalogue entry came from

    def __post_init__(self):
        object.__setattr__(self, "pulses", Fraction(self.pulses))
        if self.unit <= 0:
            raise ValueError("unit must be positive")
        if self.pulses <= 0:
            raise ValueError("pulses must be positive")
        if self.groups:
            if sum(self.groups) != self.pulses:
                raise ValueError(
                    f"groups {self.groups} sum to {sum(self.groups)}, not "
                    f"{self.pulses}. A composition must exhaust the cycle.")
            if self.group_labels and len(self.group_labels) != len(self.groups):
                raise ValueError("group_labels must run parallel to groups")
        if self.labels and len(self.labels) != self.pulses:
            raise ValueError(
                f"{len(self.labels)} labels for {self.pulses} positions. A "
                f"labelled cycle labels EVERY position; use '-' for a rest.")

    # -- duration -----------------------------------------------------------

    @property
    def duration(self):
        """Bar length in whole-notes, EXACT. Covers .125/1 through 64/32,
        fractional numerators, and non-power-of-two denominators alike."""
        return Fraction(self.pulses, self.unit)

    @property
    def signature(self):
        n = self.pulses
        top = n.numerator if n.denominator == 1 else f"{n.numerator}/{n.denominator}"
        return f"{top}/{self.unit}"

    @property
    def irrational(self):
        """True when the denominator is not a power of two — 4/3, 5/6. Not a
        judgement, a declared property."""
        u = self.unit
        return not (u and (u & (u - 1)) == 0)

    @property
    def polycentric(self):
        return self.origin is None

    # -- grouping -----------------------------------------------------------

    def pulse_groups(self):
        """The DECLARED grouping, or None.

        None is the honest answer for an undeclared 7/8: there are 64 ordered
        groupings of seven and this cycle has not said which. The old code
        returned (1,1,1,1,1,1,1) for that and (3,3,3) for 9/8, which asserted
        the European reading over Balkan daichovo.
        """
        return tuple(self.groups) if self.groups else None

    def conventional_grouping(self):
        """A CONVENTION, labelled as one, never used as a default.

        Common-practice European habit: compound signatures group in threes,
        simple ones in the obvious equal parts. It is a habit of one repertoire
        and it is wrong for aksak, for tala, and for anything polycentric.
        """
        n = self.pulses
        if n.denominator != 1:
            return None
        n = int(n)
        if self.unit in (8, 16) and n % 3 == 0 and n > 3:
            return tuple([3] * (n // 3))
        return tuple([1] * n)

    def group_starts(self):
        """Pulse index at which each group begins, 0-based."""
        if not self.groups:
            return None
        out, x = [], 0
        for g in self.groups:
            out.append(x)
            x += g
        return tuple(out)

    # -- what the grouping says about a POSITION -----------------------------
    #
    # `group_starts` answers "where do the groups begin" for one cycle. A line
    # sits in a SPAN, which may start mid-cycle and run over a barline, so the
    # three below take absolute 0-based pulse positions and wrap. Every one of
    # them returns None on an undeclared grouping, for the same reason
    # `pulse_groups` does: seven pulses admit 64 orderings and this cycle has
    # not said which. See quality/fit.py, which is the caller.

    def is_head(self, pulse):
        """Is this absolute 0-based pulse a GROUP HEAD? None if undeclared."""
        starts = self.group_starts()
        if starts is None:
            return None
        within = Fraction(pulse) % Fraction(self.pulses)
        return within in {Fraction(s) for s in starts}

    def group_at(self, pulse):
        """-> (group index, offset into the group), or None if undeclared.

        The offset matters as much as the index: pulse 4 of 7/8 as 3+2+2 is the
        HEAD of group 1, and of 2+2+3 it is offset 0 of group 2 — same pulse,
        different metric identity, which is the whole reason a grouping is
        declared rather than sniffed.
        """
        starts = self.group_starts()
        if starts is None:
            return None
        within = Fraction(pulse) % Fraction(self.pulses)
        idx = 0
        for i, s in enumerate(starts):
            if Fraction(s) <= within:
                idx = i
        return idx, within - Fraction(starts[idx])

    def heads_between(self, start, end):
        """Absolute 0-based group-head positions in the half-open [start, end).

        None if the grouping is undeclared. `()` is a real answer — a span that
        genuinely covers no head — and is not the same as None.
        """
        starts = self.group_starts()
        if starts is None:
            return None
        start, end = Fraction(start), Fraction(end)
        if end <= start:
            return ()
        period = Fraction(self.pulses)
        k = start // period          # Fraction floor division -> integer value
        out = []
        while k * period < end:
            base = k * period
            for s in starts:
                p = base + Fraction(s)
                if start <= p < end:
                    out.append(p)
            k += 1
        return tuple(sorted(out))

    # -- note VALUES, which are declared; note DURATIONS are not -------------

    def note_value(self, pulses=1):
        """The length of `pulses` pulses in WHOLE NOTES, exact.

        This is available because `unit` is declared. What is NOT available is
        the length in SECONDS: `Song` has no tempo and no tempo change
        (MISSING.md C-5), so a note value is a ratio and never a duration.
        Callers that need seconds must be refused, not approximated.
        """
        return Fraction(pulses, self.unit)

    def variants(self):
        """Every OTHER grouping of the same signature — the meters this one is
        being distinguished from. 2^(n-1) total."""
        if self.pulses.denominator != 1:
            return ()
        return tuple(c for c in compositions(int(self.pulses))
                     if c != tuple(self.groups))

    def marker_positions(self):
        return {m.name: m.positions(self.pulses) for m in self.markers}


# ---------------------------------------------------------------------------
# THINGS THAT ARE NOT ONE CYCLE
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Polymeter:
    """Concurrent cycles that do NOT share a barline, each with its own phase.

    Distinct from Polyrhythm: polyrhythm subdivides one shared span, polymeter
    runs independent bars that realign only at the composite period.
    """
    cycles: tuple
    phases: tuple = ()

    def period(self):
        """Composite period in whole-notes: the lcm of the durations."""
        p = None
        for c in self.cycles:
            p = c.duration if p is None else lcm_fraction(p, c.duration)
        return p

    def realignment(self):
        """-> {cycle index: how many of its bars fit the composite period}."""
        p = self.period()
        return {i: p / c.duration for i, c in enumerate(self.cycles)}


@dataclass(frozen=True)
class Polyrhythm:
    """n against m INSIDE one span, sharing a barline. 3:2, 4:3, 5:4."""
    span: Fraction = Fraction(1)
    ratios: tuple = (3, 2)

    def grid(self):
        """The composite attack grid: every onset of every layer, in order."""
        span = Fraction(self.span)
        pts = set()
        for r in self.ratios:
            pts |= {span * Fraction(i, r) for i in range(r)}
        return tuple(sorted(pts))

    def resolution(self):
        """Smallest common subdivision — lcm of the layer counts."""
        out = 1
        for r in self.ratios:
            out = out * r // gcd(out, r)
        return out


@dataclass(frozen=True)
class Density:
    """A ratio between layers over a FIXED frame — gamelan irama.

    Deliberately not a Cycle. Irama doubles the melodic density against an
    unchanged colotomic structure; storing it as a meter change would say the
    frame moved, and the frame is exactly what does not move.
    """
    level: str = "I"
    ratio: Fraction = Fraction(1)
    frame: object = None

    def against(self, cycle):
        return Fraction(cycle.pulses) * Fraction(self.ratio)


@dataclass
class MeterMap:
    """Meter as a function of BAR INDEX — mixed meter at bar granularity.

    `grid.Song` resolves meter per SECTION, which cannot express a bar of 7/8
    inside a 4/4 section.
    """
    default: Cycle = field(default_factory=Cycle)
    changes: dict = field(default_factory=dict)   # bar -> Cycle

    def at(self, bar):
        best, cyc = None, self.default
        for b, c in self.changes.items():
            if b <= bar and (best is None or b > best):
                best, cyc = b, c
        return cyc

    def is_mixed(self):
        return bool(self.changes)


# ---------------------------------------------------------------------------
# THE CATALOGUE SLOT — deliberately empty
# ---------------------------------------------------------------------------

CATALOGUE = {}


def register_named(cycle):
    """Add a sourced catalogue entry. `cycle.source` must say where from."""
    if not cycle.name:
        raise ValueError("a catalogue entry needs a name")
    if not cycle.source:
        raise ValueError(
            f"{cycle.name!r} has no source. A catalogue entry written from "
            f"memory is unsourced data in the evidence base; the same refusal "
            f"the sourcing cells made about lyrics they could recite.")
    CATALOGUE[cycle.name.lower()] = cycle
    return cycle


def get_named(name):
    key = name.lower()
    if key not in CATALOGUE:
        raise KeyError(
            f"no catalogue entry for {name!r}. This module can hold tala, "
            f"usul, iqa'at, colotomic and compas cycles and contains NONE of "
            f"them: 35 talas, 100+ usuls, ~100 iqa'at, the gamelan forms, the "
            f"compases and the West African timelines all need SOURCING, not "
            f"recall. See MISSING.md C-2. Declared: "
            f"{sorted(CATALOGUE) or 'nothing yet'}")
    return CATALOGUE[key]


# ---------------------------------------------------------------------------
# WHAT A BLUEPRINT SECTION'S `meter` FIELD MAY BE
# ---------------------------------------------------------------------------


class MeterDeclarationError(ValueError):
    """A section's `meter` field is PRESENT and is not a meter object.

    A `ValueError` subclass on purpose. `lyric_harness.py` already routes that
    family, for the blueprint-reading verbs, to ONE `REFUSED — ...`/exit 2
    shape; inheriting from it means this refusal reaches the operator through
    the handler that already exists instead of a second one being invented for
    it, which is the thing that shape was consolidated to prevent.
    """


# JSON's own names for the types a hand-written blueprint can put here. The
# operator wrote JSON; telling them Python found a `str` names a language they
# were not writing in.
_JSON_TYPE = {str: "string", bool: "boolean", int: "number", float: "number",
              list: "array", type(None): "null"}


def section_meter(raw, section=None):
    """-> a blueprint section's `meter` mapping, or `{}` when it declares none.

    THE ONE PREDICATE THE THREE BLUEPRINT READERS SHARE.
    `grid.song_from_blueprint`, `fit.from_blueprint` and
    `lyric_harness._grid_song` each build a different object out of the same
    `meter` field -- a `grid.Meter`, a `meter.Cycle`, and a `grid.Meter` again
    -- and each used to reach straight for `.get("beats", 4)`. On a section
    that declares `"meter": "4/4"` all three raised
    `AttributeError: 'str' object has no attribute 'get'`, from three
    different frames, and `AttributeError` is outside the refusal family, so
    all three tracebacked at exit 1 and none of them named the field at fault.
    The DIAGNOSIS is what was missing: the operator reading that traceback
    cannot tell a mistyped meter from a corrupt file from a bug in the reader.

    Routing all three through here is what makes `song` and `grid` unable to
    answer differently about one file: same predicate, same message, same exit
    code, whichever verb the operator happened to run first.

    An ABSENT `meter` is not an error and never was -- it returns `{}` and each
    reader applies its own documented default, exactly as `s.get("meter", {})`
    did. Only a meter that IS declared and cannot be read raises. A declared
    signature is likewise NOT parsed out of a string: `"4/4"` names a duration
    and cannot name a grouping, and `meter.Cycle` exists precisely because
    supplying the grouping a signature omits is an assertion, not a reading
    (see `pulse_groups`, above -- 7/8 admits 64 groupings and this module
    refuses to pick one).
    """
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        shown = json.dumps(raw)
    except (TypeError, ValueError):        # pragma: no cover - non-JSON input
        shown = repr(raw)
    kind = _JSON_TYPE.get(type(raw), type(raw).__name__)
    a_kind = f"{'an' if kind[0] in 'aeiou' else 'a'} {kind}"
    who = f"section {section!r}" if section else "a section"
    raise MeterDeclarationError(
        f'{who} declares "meter": {shown}, {a_kind}; this schema wants an '
        f'object — {{"beats": 4, "unit": 4}}, optionally with '
        f'"groups": [2, 2]. The time signature IS declared on that section '
        f'and is not being read for want of one: {a_kind} carries the '
        f'duration and cannot carry the grouping, and supplying the grouping '
        f'it omits would be an assertion rather than a reading. Nothing else '
        f'about the section is at fault — rewrite that one field.')


__all__ = ["compositions", "n_compositions", "lcm_fraction", "Marker",
           "Cycle", "Polymeter", "Polyrhythm", "Density", "MeterMap",
           "CATALOGUE", "register_named", "get_named",
           "MeterDeclarationError", "section_meter"]
