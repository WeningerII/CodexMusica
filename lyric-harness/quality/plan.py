#!/usr/bin/env python3
"""The PLANNING phase: a song request in, a blueprint and a mandate out.

WHAT THIS IS. The front half of the songwriter — the phase CLAUDE.md's
standing rule §2 records as the hole. It takes a REQUEST (a form, an optional
length, a declared seed) and produces the two artifacts every downstream layer
already demands: a blueprint (sections, bars, meters, line slots) and a
mandate (groups, returns, subdivision), plus a writer brief in the same shape
the coverage experiment's blind seeds used. It writes NO WORDS: the writer is
outside the harness (CLAUDE.md, first page), and the plan's line slots are
empty on purpose.

V2 (2026-08-18) — DERIVED SPACES, NOT TABLES. The owner's finding on v1,
verbatim in effect: a huge bias toward 4 lines and 4/4, because v1 pinned
`LINES_PER_FUNCTION` at constants, listed three meters by hand, and wrote
five patterns as strings. Every one of those tables is replaced by a
GENERATOR over a space the enforcement layers already grade:

- METERS are derived from the cycle grammar — any beat count whose pulse
  grouping is a composition into 2s and 3s (the attested additive-meter
  vocabulary), at any bars-per-line and subdivision, FILTERED by one derived
  envelope: slots per line. The envelope's floor IS the calibrated density
  band's floor (`meter_bands.ADOPTED` — a line must hold at least that many
  syllables, so fewer slots is unsatisfiable BY CONSTRUCTION); the ceiling is
  the band's ceiling times one declared multiplier (`SLOTS_CEILING_X`),
  beyond which every band-legal line under-fills the grid into decoration.
  THE MEASURE IS BY DERIVATION, NOT BY LEAF — (bars, subdivision) uniform
  over the pairs the envelope admits, the beat count uniform over that
  pair's derived range, the grouping exact-uniform over that beat count's
  compositions. This module's own first smoke run (2026-08-18) convicted
  the leaf measure: compositions of n into {2,3} grow ~1.3247^n, so
  uniform-over-enumerated-cycles hands nearly every plan the largest beat
  count the envelope admits — a weight-by-grouping-count table nobody
  declared, and a bias of exactly the kind v2 exists to remove.
  THE TIME-SIGNATURE DENOMINATOR IS NOT BOUNDED AND NOT SAMPLED WIDE,
  because it is not enforced: `fit.py`'s slot arithmetic is exact rational
  fractions of the BEAT and never reads the unit. The planner notates its
  cycle conventionally (4 for simple groupings, 8 for compound); a writer
  hand-declaring 5/24 is grading-identical to 5/8 and nothing refuses it.
- LINES PER SECTION are sampled UNIFORMLY from the envelope, per function
  kind.
  V3 (2026-08-23) — AND THE ENVELOPE ITSELF IS DERIVED NOW. V2 replaced the
  planner's TABLES with generators and left its BOUNDS as literals: lines per
  section `(1, 16)`, sections `(2, 12)`, total lines `(4, 64)`, bars per line
  `(1, 4)`, body cells `(2, 6)`, anacrusis `(0.0, 0.5, 1.0)`. The owner named
  the first — *"1-16 is weird...should we change it to a variable?"* — under
  the standing rule that a hard number in the generator is a defect. All six
  are functions now:
    * TOKENS PER LINE is read off the floor's own calibration. Each stanza
      profile declares a measured token band AND the line count it was
      measured at (`Profile.n_lines`, declared the same day), so the 4-line
      section profile fixes 7.25-9.25 tokens per line and the 14-line sonnet
      profile fixes 7.71-9.00. They agree, which is the check that this is a
      property of English verse rather than of one profile.
    * THE LINE ENVELOPE IS WHAT THE FLOOR CAN ENFORCE. A draft outside every
      profile's MEASURED range has every length-sensitive finding downgraded
      to a note or skipped, so volunteering that length is volunteering a
      plan the graders cannot hold to anything. Measured across 1-699
      tokens: 39.9% of lengths can produce a flag, 29.8% sit in a tolerance
      band where everything is downgraded, 30.3% reach no profile at all.
      `gradeable_line_counts()` is the set that survives, and it is NOT
      contiguous — 6 to 11 lines falls between the section profile's reach
      and the sonnet's. `line_count_gaps()` names that hole in every plan's
      own disclosure, because a gap nobody prints is a calibration request
      nobody makes.
    * THE TOTAL IS DRAWN FIRST and then bounds everything conditioned on it:
      the pattern's cell count (a song of T lines carries at most T sung
      sections) and the per-kind line counts, which are drawn EXACT-UNIFORM
      over the assignments summing to it (`_partition_uniform`, the
      counted-completions move `_composition_uniform` and `_rgs_uniform`
      already use). Drawing each kind independently was measured at 6 plans
      per 200 seeds and, worse, biased the survivors.
    * ANACRUSIS is derived from the grid the section actually drew — k/sub
      beats for k in 0..sub — instead of the sub=2 case written out as a
      tuple. A section at subdivision 4 can now land on the quarter-beat
      pickups its own grid resolves.
  AND A SECTION WITH NO WORDS IS NOT A SECTION WITH NO CONSTRAINTS. V2's own
  sentence here read "instrumental functions carry bars with no lines", and
  the owner refused it: *"instrumental is not free of lines."* A wordless
  section draws a PHRASE count and its bars follow from it exactly as a sung
  section's follow from its line count — see `WORDLESS_FUNCTIONS`. What the
  label removes is the LYRIC half and nothing else, because a section
  carrying no constraint mass is a free token an optimiser can append to
  satisfy any structural rule.
  Schemes come from `schemes.rgs` exactly as before up to
  `EXACT_ENUM_MAX` lines (full enumeration, pool size disclosed); above it,
  an EXACT-UNIFORM set-partition sampler (the Bell-triangle completion
  counts drive each digit, so every partition is equally likely without
  enumerating the pool) with the Bell-number pool size disclosed. So large
  stanzas are not banned by arithmetic — only the enumeration was ever
  bounded, and the sampler removes that bound.
- PATTERNS are generated from the section-function vocabulary's own
  recurrence contracts (`grid.SECTION_FUNCTIONS`), not written as strings:
  once-functions appear once, returning-verbatim functions become return
  classes, new-words functions get fresh groups per instance, and
  instrumental functions carry bars with no lines. The roster below names
  which functions the GENERATOR reaches and why the rest wait; every one of
  the rest is hand-declarable today.
- THE CORPUS SAMPLES NOTHING. Measured distributions as a sampler would
  give the unprecedented shape probability ~zero — a ban wearing statistics
  (the owner's "move 37"). The corpus's role stays what it is on the
  grading side: conventions are DISCLOSED (the shape layer's notes), never
  enforced, and never weighted into the dice. A regression pins that this
  module imports no corpus reader.

EVERY FREE CHOICE IS SEEDED AND DISCLOSED. Doctrine 66: a tie broken by
nothing is a tie broken by the hash seed, and it does not reproduce. The
request therefore REQUIRES a seed, one `random.Random(seed)` drives every
pick, and the emitted plan echoes each choice beside the set (or the SIZE of
the set) it was chosen from.

REFUSALS, NOT DEFAULTS (doctrine 20). An unknown form is refused by name. A
length outside the envelope is refused naming the envelope. `ghazal` is
refused BY NAME for the stated mechanical reason (the radif licence has no
CLI flag).

Run:  python3 lyric_harness.py plan --seed=N [--form=verse-chorus]
                                    [--lines=N] [--fill=DRAFT] [--out=PATH]
Test: python3 quality/test_plan.py
"""

import json
import math
import random
from fractions import Fraction
from functools import lru_cache

from quality import schemes as SC
from quality import capacity as _CAP
from quality import floor as _FL
from quality import slots as _SL
from quality import meter_bands as MB

__all__ = ["PLAN_FORMS", "ENVELOPE", "EXACT_ENUM_MAX", "SLOTS_CEILING_X",
           "tokens_per_line_band", "gradeable_line_counts",
           "line_count_gaps",
           "GENERATOR_ROSTER", "ZERO_LINE_FUNCTIONS", "PlanRefused",
           "make_plan", "fill_plan", "writer_brief", "grading_command",
           "render_song", "section_header",
           "meter_dims", "meter_space_size", "bell",
           "meter_factorisations", "slot_values",
           "JOINT_CODES", "LAST_WORD", "placement_word",
           "line_syllable_ceiling", "joint_findings"]


class PlanRefused(ValueError):
    """A request the planner will not guess around. Message is the verdict."""


#: The declared forms. ONE for now, plus a named refusal — `ghazal` is listed
#: so the refusal can say "declared but blocked" instead of "unknown", which
#: are different answers (doctrine 28).
PLAN_FORMS = ("verse-chorus",)
BLOCKED_FORMS = {
    "ghazal": ("a ghazal's radif is a LICENSED repeat "
               "(ReviseDeclaration.repeat_licence='refrain'), and no CLI "
               "flag declares that licence — measured 2026-08-17 on a real "
               "ghazal: 15 SCHEME_VIOLATIONs at the default and 0 at "
               "'refrain', the finding unmoved in both. A plan the CLI "
               "cannot grade honestly is refused, and the fix is the flag, "
               "not a workaround."),
}

#: WHAT A NAMED FORM REQUIRES — and the half of it this repo REFUSES to
#: enforce, which is the more important half (2026-08-23).
#:
#: THE DEFECT THIS CLOSES. `make_plan(seed, form=...)` validated `form`
#: against `PLAN_FORMS` and then never passed it to `_sample_pattern`, so
#: every plan printed `form=verse-chorus` and the form constrained NOTHING.
#: Measured over six seeds before the fix: seeds 42, 777 and 2024 produced no
#: verse at all, seed 1 produced none either, seed 100 put the only verse
#: last, and exactly one of the six had a verse before a chorus. A coordinate
#: printed on every run and read by no one is this repo's oldest defect and
#: it was sitting in the one verb between a writer and a shape.
#:
#: WHY IT COULD NOT LIVE IN `grid.SECTION_FUNCTIONS`. That table's own
#: comment on `verse` says it: "the layer only ever denies". Per-function
#: rows state what a section may not do — `requires`, `adjacent_after`,
#: `boundary` — and "a verse-chorus song CONTAINS a verse" is a positive
#: claim about the WHOLE, which no denial about a part can express. So this
#: is a new layer, not a row somebody forgot.
#:
#: MEASURED ON `corpus/song/` BEFORE BEING WRITTEN, because the alternative
#: was inventing it, and inventing a rule about a tradition is the exact
#: mistake this repo made about Welsh vowel length on 2026-08-22 and undid a
#: day later. Over the 1,421 staged files, 178 song items carry a [CHORUS]
#: marker:
#:
#:   MEMBERSHIP   178 of 178 items with a chorus ALSO carry a verse. Nothing
#:                in the corpus is a chorus-without-verse. That is why
#:                `FORM_REQUIRES` is categorical and enforced below.
#:   ORDER        137 of 178 = 77.0% put a verse BEFORE the first chorus.
#:                41 items open on the chorus. So "a verse precedes its
#:                chorus" is a TENDENCY, not a rule, and it is NOT enforced —
#:                see `FORM_TENDENCIES`.
#:
#: CAVEAT ON THE SOURCE, stated because 77% is a number and numbers travel
#: further than their provenance. This corpus is pre-1931 by the provenance
#: gate (doctrine 85) and is anthology verse, not 20th-century popular song:
#: 74,319 [VERSE] markers against 269 [CHORUS]. It is the best evidence this
#: repo HAS about the form and it is not evidence about modern pop. A caller
#: with a sourced modern set should re-measure; what would lift it is the
#: same corpus that lifts `eng-verse` in `quality/frequency.py`.
FORM_REQUIRES = {
    "verse-chorus": ("chorus", "verse"),
}

#: MEASURED, DECLARED, AND DELIBERATELY NOT ENFORCED (doctrine 16/22: an
#: uncalibrated cut is a rate before it is a rule). Each row is a rate over
#: `corpus/song/`, and each is here so that the NEXT person to reach for it
#: finds the measurement instead of an intuition.
#:
#: Enforcing the 77% would make the planner refuse a shape 23% of this
#: repo's own chorus-bearing corpus takes, and the sampler is uniform over
#: the admissible set by design — rate-matching is a different instrument
#: with its own argument to make, not a tweak to this one.
FORM_TENDENCIES = {
    "verse-chorus": (
        ("a verse precedes the first chorus", 137, 178,
         "41 of the 178 open on the chorus. NOT enforced: a planner that "
         "refused those would be refusing a quarter of the corpus it was "
         "measured on."),
    ),
}

#: The one declared multiplier in this module. The slots ceiling is the
#: density band's ceiling times this: at 4x, a line at the band's own
#: maximum fills a quarter of its grid, which is where a grid stops
#: discriminating and starts decorating. Everything else in ENVELOPE is
#: either the band itself or a data-type fact.
SLOTS_CEILING_X = 4

#: Exact scheme enumeration up to this many lines (Bell(10) = 115,975 —
#: instant); beyond it the exact-uniform sampler serves, with the Bell
#: number disclosed as the pool size. A computational honesty bound on
#: ENUMERATION, not a bound on what is reachable.
EXACT_ENUM_MAX = 10

#: HOW MANY TOKENS A LINE CARRIES — DERIVED, not chosen (2026-08-23).
#:
#: Each of the floor's stanza profiles declares BOTH a measured token band and
#: the line count of the items it was measured on (`Profile.n_lines`), so the
#: two together fix a tokens-per-line band that nobody had to pick: the
#: 4-line section profile says 29-37 tokens (7.25-9.25 per line) and the
#: 14-line sonnet profile says 108-126 (7.71-9.00). They agree, which is the
#: check that this is a property of English verse and not of one profile.
#: `song` declares `n_lines=0` — a lyric sheet has no fixed line count — and
#: contributes nothing here rather than a zero to divide by.
def tokens_per_line_band():
    """-> (lo, hi) tokens per line, read off the floor's own calibration."""
    per = [(p.lo / p.n_lines, p.hi / p.n_lines)
           for p in _FL.PROFILES if p.n_lines]
    if not per:
        raise PlanRefused(
            "no floor profile declares a line count, so tokens-per-line "
            "cannot be derived and the planner has no envelope to volunteer "
            "inside. This is a REFUSAL and not a fallback: a line count "
            "chosen without a derivation is the literal this function "
            "replaced.")
    return min(a for a, _ in per), max(b for _, b in per)


@lru_cache(maxsize=None)
def gradeable_line_counts():
    """-> frozenset of line counts the FLOOR CAN GRADE WITH TEETH.

    THE ENVELOPE IS WHAT THE ENFORCEMENT CAN ENFORCE. A draft whose token
    count falls outside every profile's MEASURED range gets every
    length-sensitive finding downgraded to a note or skipped entirely, so a
    plan volunteering that length is a plan the graders cannot hold to
    anything. Measured across 1..699 tokens: 39.9% of lengths can produce a
    flag, 29.8% are inside a tolerance band where every finding is downgraded,
    and 30.3% reach no profile at all.

    So the line envelope is the set of line counts whose expected token count
    — at the derived tokens-per-line band — can land inside some profile's
    measured range. It is NOT CONTIGUOUS, and the gap is a real finding rather
    than an inconvenience: it is a calibration request, and
    `line_count_gaps()` names it so it is visible in every plan's own
    disclosure instead of being discovered by a writer.
    """
    tlo, thi = tokens_per_line_band()
    out = set()
    for prof in _FL.PROFILES:
        lo = max(1, math.ceil(prof.lo / thi))
        hi = int(prof.hi // tlo)
        out.update(range(lo, hi + 1))
    if not out:
        raise PlanRefused(
            "no line count lands inside any calibrated profile — the floor "
            "can grade nothing this planner could volunteer.")
    return frozenset(out)


def line_count_gaps():
    """-> [(lo, hi)] runs of line counts INSIDE the envelope's span that no
    profile grades with teeth. Disclosed, never silently skipped."""
    ok = gradeable_line_counts()
    gaps, run = [], None
    for n in range(min(ok), max(ok) + 1):
        if n in ok:
            if run:
                gaps.append(run)
                run = None
        else:
            run = (run[0], n) if run else (n, n)
    if run:
        gaps.append(run)
    return gaps


#: The planner's envelope — what it volunteers by default. NOT the system's
#: bounds: a writer hand-declares anything and the graders grade it.
#:
#: EVERY ENTRY IS DERIVED OR ARGUED, AND NONE IS CHOSEN (2026-08-23, the
#: owner's standing rule: *"we do not want hard numbers anywhere ... meter
#: should be something like x/y and number of lines should be something like
#: N"*). What was here before: `lines_per_section (1, 16)`, `sections
#: (2, 12)`, `total_lines (4, 64)`, `bars_per_line (1, 4)`, `body_cells
#: (2, 6)` and `anacrusis (0.0, 0.5, 1.0)` — six literals with no derivation
#: between them, of which the owner named the first: *"1-16 is weird ...
#: should we change it to a variable?"*. It is a variable now, and so are the
#: other five.
def _envelope():
    ok = gradeable_line_counts()
    lo, hi = MB.ADOPTED["DENSITY"][0], MB.ADOPTED["DENSITY"][1] * SLOTS_CEILING_X
    return {
        # slots per line = beats x subdivision x bars_per_line. Floor DERIVED:
        # the calibrated density band's floor (meter_bands.ADOPTED) — fewer
        # slots than the minimum band-legal syllable count is unsatisfiable by
        # construction. Ceiling: band ceiling x SLOTS_CEILING_X.
        "slots_per_line": (lo, hi),
        # LINES PER SECTION: bounded ONLY by what the whole song may carry.
        # There is no separate per-section calibration to derive a tighter
        # bound from — the floor grades a DRAFT, not a section — so inventing
        # one would be the literal this replaced wearing a derivation. 1 is a
        # real section (a tag, a one-line vamp).
        "lines_per_section": (1, max(ok)),
        # SECTIONS: a sung section carries at least one line, so a song of at
        # most `max(ok)` lines carries at most that many sung sections. 1 is
        # a real song.
        "sections": (1, max(ok)),
        # TOTAL LINES: the span of the gradeable set. The set itself is what
        # the sampler rejects against, because the span is not contiguous.
        "total_lines": (min(ok), max(ok)),
        # subdivisions the fit layer's grid models (eighth/sixteenth pulse
        # against the beat) — a data-type set, not taste.
        "subdivisions": (1, 2, 4),
        # BARS PER LINE: bounded by the slots envelope it feeds. A line of
        # `bars` bars at the coarsest grid this vocabulary admits (2 beats,
        # subdivision 1) already carries `2 * bars` slots, so a bars count
        # past `hi // 2` cannot produce a band-legal line at any meter.
        "bars_per_line": (1, max(1, hi // 2)),
        # ANACRUSIS is derived PER DRAW from the subdivision, because the
        # pickup has to land on the grid the section actually declared:
        # `_anacrusis_choices(sub)`. The entry here is the widest set any
        # subdivision admits, for the disclosure's denominator.
        "anacrusis": _anacrusis_choices(max(ENVELOPE_SUBDIVISIONS)),
        # BODY CELLS: at least one, and no more than the section ceiling —
        # every cell contributes at least one section, so a draw past that
        # can only be rejected. The pattern's own length check is what
        # actually binds (see `_sample_pattern`).
        "body_cells": (1, max(ok)),
    }


#: Named so `_envelope` can read it before ENVELOPE exists — the subdivision
#: set is the one entry with no dependency on the others.
ENVELOPE_SUBDIVISIONS = (1, 2, 4)


def _anacrusis_choices(sub):
    """-> the pickups a grid of `sub` subdivisions per beat can LAND ON.

    DERIVED from the grid's own resolution: a pickup of k/sub beats for k in
    0..sub, i.e. every grid position from no pickup up to a full beat. The
    literal `(0.0, 0.5, 1.0)` this replaces was the sub=2 case written out,
    which silently denied a sub=4 section the quarter-beat pickups its own
    grid resolves — a table standing in for the arithmetic that produces it.
    """
    return tuple(k / sub for k in range(sub + 1))


ENVELOPE = _envelope()

# ---------------------------------------------------------------- meters

@lru_cache(maxsize=None)
def _compositions_23(n):
    """All ordered compositions of n into parts of {2, 3} — the attested
    additive-meter vocabulary (aksak 2+2+3, Balkan 3+2+2, compound 3+3...).
    n < 2 has none, which is what keeps beats >= 2 without naming a cap.
    The ENUMERATED ground truth: sampling goes through the counter and
    `_composition_uniform` instead, and the tests hold those to this list
    at small n — enumerate-to-verify, count-to-sample."""
    if n < 2:
        return ()
    out = []
    if n == 2:
        out.append((2,))
    if n == 3:
        out.append((3,))
    for first in (2, 3):
        for rest in _compositions_23(n - first):
            out.append((first,) + rest)
    return tuple(out)


def _unit_for(groups):
    """Conventional notation for the sampled cycle: simple groupings in 4,
    anything with a 3 in 8. NOTATION ONLY — the slot arithmetic never reads
    the denominator, so 7/8 and 7/4 (and 7/10) grade identically; exotic
    denominators stay hand-declarable and are not sampled because sampling
    a label buys nothing the enforcement can see."""
    return 8 if any(g == 3 for g in groups) else 4


@lru_cache(maxsize=None)
def _n_compositions_23(n):
    """len(_compositions_23(n)) without building it — the Padovan
    recurrence (first part 2 leaves n-2, first part 3 leaves n-3). The
    counter, not the list, is what sampling needs: at the envelope's top
    beat count the list runs to ~10^5 tuples per beat count."""
    if n < 0:
        return 0
    if n == 0:
        return 1
    return _n_compositions_23(n - 2) + _n_compositions_23(n - 3)


def _composition_uniform(n, rng):
    """One EXACT-uniform composition of n into {2, 3} — each next part
    drawn with probability proportional to the completions it leaves, the
    same counted-completions move as `_rgs_uniform`. Uniform over the
    compositions OF THIS n; the measure across beat counts is the
    derivation's, decided in make_plan."""
    out = []
    while n:
        w2 = _n_compositions_23(n - 2) if n >= 2 else 0
        w3 = _n_compositions_23(n - 3) if n >= 3 else 0
        part = 2 if rng.randrange(w2 + w3) < w2 else 3
        out.append(part)
        n -= part
    return tuple(out)


@lru_cache(maxsize=None)
def _partition_count(counts, total):
    """How many line-count assignments realise `total` exactly.

    `counts` is the per-kind instance count as a tuple, in the order the
    draw will walk; a kind appearing c times contributes c x k lines. Counts
    the solutions of `sum(c_i * k_i) == total, k_i >= 1` — the completions,
    not the leaves, which is what makes an exact-uniform draw possible
    without enumerating the space (`_composition_uniform` and `_rgs_uniform`
    use the identical move, and `_n_compositions_23` is the same recurrence
    one dimension down).
    """
    if not counts:
        return 1 if total == 0 else 0
    c, rest = counts[0], counts[1:]
    later = sum(rest)
    n = 0
    k = 1
    while c * k <= total - later:
        n += _partition_count(rest, total - c * k)
        k += 1
    return n


def _partition_uniform(counts, total, rng):
    """One EXACT-UNIFORM assignment of line counts, or None when the shape
    admits none.

    Each next count is drawn with probability proportional to the
    COMPLETIONS it leaves, so every admissible assignment is equally likely.
    The sequential alternative — draw each kind uniform over what remains —
    is NOT uniform and was measured so: it forced later kinds to the floor
    and left 52% of all sections carrying exactly one line.
    """
    total_ways = _partition_count(counts, total)
    if not total_ways:
        return None
    out, rem = [], total
    for i, c in enumerate(counts):
        rest = counts[i + 1:]
        later = sum(rest)
        pick = rng.randrange(_partition_count(counts[i:], rem))
        k = 1
        while True:
            w = _partition_count(rest, rem - c * k)
            if pick < w:
                break
            pick -= w
            k += 1
        out.append(k)
        rem -= c * k
    return out


def meter_dims():
    """-> {(bars_per_line, subdivision): (beats_lo, beats_hi)} — every
    dimension pair whose derived beat range is non-empty under the slots
    envelope. Pure arithmetic on the envelope; the beat count needs no cap
    of its own — the envelope's ceiling implies one."""
    lo, hi = ENVELOPE["slots_per_line"]
    dims = {}
    for bars in range(ENVELOPE["bars_per_line"][0],
                      ENVELOPE["bars_per_line"][1] + 1):
        for sub in ENVELOPE["subdivisions"]:
            b_lo = max(2, math.ceil(lo / (sub * bars)))
            b_hi = hi // (sub * bars)
            if b_lo <= b_hi:
                dims[(bars, sub)] = (b_lo, b_hi)
    return dims


def meter_space_size():
    """How many distinct (bars, subdivision, beats, grouping) cycles the
    envelope admits — the disclosure's denominator, counted, never
    enumerated. NOT the sampling measure (see `_sample_meter`)."""
    return sum(_n_compositions_23(b)
               for (lo, hi) in meter_dims().values()
               for b in range(lo, hi + 1))


@lru_cache(maxsize=None)
def meter_factorisations(slots):
    """-> ((bars, subdivision), ...) every way this envelope can realise a
    line of `slots` slots. `beats = slots // (bars * sub)` follows, and the
    `>= 2` is the composition grammar's own floor: `_compositions_23` has no
    composition below 2, so a one-beat cycle is not a cycle here."""
    out = []
    for bars in range(ENVELOPE["bars_per_line"][0],
                      ENVELOPE["bars_per_line"][1] + 1):
        for sub in ENVELOPE["subdivisions"]:
            step = bars * sub
            if slots % step == 0 and slots // step >= 2:
                out.append((bars, sub))
    return tuple(out)


@lru_cache(maxsize=None)
def slot_values():
    """-> the slots-per-line counts the envelope can actually REALISE.

    Every integer in the envelope is realisable — `(bars, sub) = (1, 1)`
    gives `beats = slots`, and the envelope's floor is the density band's
    floor, comfortably above the grammar's 2 — so this is the envelope's own
    range today. It is COMPUTED rather than assumed because the moment
    `bars_per_line` or `subdivisions` narrows, a value can stop being
    reachable, and a sampler drawing uniformly over values it cannot realise
    would silently re-weight the ones it can.
    """
    lo, hi = ENVELOPE["slots_per_line"]
    return tuple(n for n in range(lo, hi + 1) if meter_factorisations(n))


def _sample_meter(rng):
    """One meter draw under the DERIVATION measure (module docstring).

    SLOTS PER LINE FIRST, then a factorisation of it, then the grouping.
    That order is the module's own rule — *"THE MEASURE IS BY DERIVATION,
    NOT BY LEAF"* — applied to the coordinate the ENVELOPE is stated in, and
    it is the second time this file has had to learn it (`MISSING.md` M-81).
    ~~dimension pair uniform over what the envelope admits, beat count
    uniform over that pair's derived range~~ was the first correction's
    shape and it moved the bias rather than removing it: `bars_per_line`
    runs to `hi // 2` — a sound BOUND, since past it no band-legal line is
    possible at any meter, and never a claim that all of those values are
    equally musical — and a high-bars pair's beat range COLLAPSES. At
    `bars=24, sub=1` the only legal beat count is 2, so that pair emits the
    envelope's ceiling every time it is drawn. Uniform over PAIRS is
    therefore not uniform over slots per line: MEASURED at median 35 of a
    [5, 48] envelope, with only 4.6% of lines given a grid a band-legal line
    could fill.

    THE PAIR MARGINAL IS NOW A REALISABILITY SHARE and that is the correct
    direction, not a new bias: a slots count one factorisation can make
    should not be rarer than one six can make, which is exactly what
    weighting by pair did. It is a PREDICTION rather than an accident —
    `P(bars, sub)` is computable from `meter_factorisations` alone, and
    `test_plan.py` §4 holds the sampler to it.

    Uniform over the flat enumeration remains wrong for the reason it always
    was: compositions into {2,3} grow ~1.3247^n, so leaves concentrate on
    the maximal beat count (this module's first smoke run showed it).

    A function of its own so the test file can hold the MEASURE itself to
    its prediction, not just the plans downstream of it. -> (bars, sub,
    beats, groups, (n_slot_values, n_factorisations, slots)); the tail is
    the disclosure's raw material.
    """
    vals = slot_values()
    slots = vals[rng.randrange(len(vals))]
    fact = meter_factorisations(slots)
    bars, sub = fact[rng.randrange(len(fact))]
    beats = slots // (bars * sub)
    groups = _composition_uniform(beats, rng)
    return bars, sub, beats, groups, (len(vals), len(fact), slots)


# ---------------------------------------------------------------- schemes

@lru_cache(maxsize=None)
def bell(n):
    """Bell number B(n) via the Bell triangle — the LAST element of row n,
    not the first (row n's first element is B(n-1): the off-by-one the
    test file's uniformity pin caught on 2026-08-18, which had every
    above-enumeration scheme pool disclosed at Bell(k-1)-1). Held to the
    enumeration (`schemes.rgs`) at small k in test_plan §4."""
    row = [1]
    for _ in range(n - 1):
        nxt = [row[-1]]
        for v in row:
            nxt.append(nxt[-1] + v)
        row = nxt
    return row[-1] if n else 1


@lru_cache(maxsize=None)
def _rgs_completions(r, m):
    """How many restricted-growth strings of length r complete a prefix
    whose current maximum block index is m-1 (i.e. m blocks so far)."""
    if r == 0:
        return 1
    return m * _rgs_completions(r - 1, m) + _rgs_completions(r - 1, m + 1)


def _rgs_uniform(k, rng):
    """One EXACT-uniform restricted-growth string of length k — every set
    partition equally likely, no enumeration. Each digit is drawn with
    probability proportional to the count of completions it leaves
    (doctrine 66: the rng is the only source of the draw)."""
    code, m = [], 0
    for i in range(k):
        r = k - i - 1
        weights = [_rgs_completions(r, max(m, 1))] * m
        weights.append(_rgs_completions(r, m + 1))
        total = sum(weights)
        pick = rng.randrange(total)
        acc = 0
        for d, w in enumerate(weights):
            acc += w
            if pick < acc:
                code.append(d)
                if d == m:
                    m += 1
                break
    return tuple(code)


def _scheme_for(k, rng):
    """One seeded scheme over k lines -> (code, pool_size).

    k == 1: the only scheme, pool of one (a one-line section mandates no
    pair; the SONG-level pair requirement below is what keeps a plan from
    checking nothing). k <= EXACT_ENUM_MAX: the full enumeration with >=1
    mandated pair, exactly v1's rule. Above: the exact-uniform sampler,
    rejecting the single all-singleton partition, pool = Bell(k) - 1."""
    if k == 1:
        return (0,), 1
    if k <= EXACT_ENUM_MAX:
        pool = [code for code in SC.rgs(k)
                if any(code.count(b) >= 2 for b in set(code))]
        return rng.choice(pool), len(pool)
    while True:
        code = _rgs_uniform(k, rng)
        if any(code.count(b) >= 2 for b in set(code)):
            return code, bell(k) - 1


def _abs_groups(code, first_line):
    """RGS code over a section -> absolute-numbered groups of >=2 lines."""
    blocks = {}
    for i, b in enumerate(code):
        blocks.setdefault(b, []).append(first_line + i)
    return [g for _, g in sorted(blocks.items()) if len(g) >= 2]


def _place_group(group, rng, max_token, used):
    """-> the group's members SPELLED with a placement (`quality/slots.py`).

    THE PLANNER STOPS PLANNING AROUND END RHYME HERE (2026-08-23, the owner's
    ruling). A group's members were emitted as bare line numbers, which is the
    default slot — the end of the line — so every plan this generator has ever
    produced bound every requirement to the last word of its lines. Not
    because anything chose that: because it was the only thing the
    declaration layer could say.

    A PLACEMENT PER MEMBER, uniform over what the grading path can resolve.
    Per member and not per group, because the mixed case is real and is the
    one no letter scheme can express: 8 of the registry's 77 schemas anchor
    one member at each end of a word, and linked rhyme binds a line-final to
    a line-INITIAL. Uniform over the vocabulary means `end` is one placement
    among the ones this harness can grade rather than the axis everything
    else is measured against — which is the correction, stated as a measure.

    `T<n>` IS DRAWN WITH ITS INDEX BOUNDED BY WHAT A LINE RELIABLY HAS. The
    bound is the floor's own measured tokens-per-line floor, so the planner
    asks for the n-th word only where the calibration says a line carries
    that many; asking for the fortieth word of a line the grid holds seven
    words of is a binding no writer can fill, and an unfillable plan is the
    "move 37" ban's own shape pointed at placement.
    """
    out = []
    for ln in group:
        free = [p for p in _PLACE_POOL(max_token)
                if placement_word(p) not in used.get(ln, ())]
        if not free:
            # Every WORD this path can bind is already spoken for on this
            # line. The group is DROPPED rather than doubled onto one: two
            # groups on one word are a joint constraint on one word, which is
            # the question a plan cannot answer.
            return []
        place = rng.choice(free)
        used.setdefault(ln, set()).add(placement_word(place))
        out.append(str(ln) if place == "end" else f"{ln}.{place}")
    return out


@lru_cache(maxsize=None)
def _PLACE_POOL(max_token):
    """The placements a plan may draw, with the token indices this line
    length admits. Cached because it is a pure function of one integer."""
    return tuple(_SL.PLANNABLE_PLACEMENTS) + tuple(
        f"T{n}" for n in range(1, max_token + 1))


# -------------------------------- joint satisfiability (M-79 / M-80)
#
# EVERY GATE IN THIS MODULE PASSES AND THEIR CONJUNCTION DOES NOT, which is
# the one defect under all four of `MISSING.md` M-79's findings. The meter is
# drawn from a derived cycle space, the density band is a corpus calibration,
# the schemes are exact-uniform over completions, the placements are bounded
# by a reachable token index — and NO LAYER HOLDS THE CONJUNCTION, so a plan
# whose constraints cannot be met together is emitted, graded as legal, and
# handed to a writer who discovers it three revise rounds in.
#
# `capacity.ADOPTED_MAX_GROUP` (above) was the only joint check that existed:
# it refuses a rhyme group larger than any family in the lexicon is measured
# to fill. This is the same shape, per LINE rather than per group.

#: THE WORD A PLACEMENT BINDS, and the sentinel for the last one. RE-EXPORTED
#: FROM `quality/slots.py` AND NOT RE-IMPLEMENTED: that module is the one
#: place a placement name is bound to a rule, and a second answer here to
#: "which word is `headrime`?" is exactly the shape doctrine 1 names. Bound to
#: module-level names so this file reads as though they were local, which is
#: what a re-export is for.
LAST_WORD = _SL.LAST_WORD
placement_word = _SL.placement_word

#: The codes this gate can emit, DECLARED (doctrine 58 — an exclusion nobody
#: writes down is a threshold nobody wrote down). Every one is a REFUSAL and
#: not a note: a plan is the one artifact in this pipeline nobody has spent
#: any writing on yet, so refusing here costs a seed and refusing later costs
#: a draft.
JOINT_CODES = ("SPAN_BELOW_DENSITY_FLOOR", "TOKEN_INDEX_UNREACHABLE",
               "WORDS_EXCEED_SPAN", "TWO_GROUPS_ONE_WORD")


def line_syllable_ceiling(slots):
    """-> the most syllables a line of `slots` slots may LEGALLY carry.

    The conjunction of two layers that never met. `quality/fit.py` refuses
    more units than slots (`SLOTS_EXCEEDED`, `satisfiable=False`); the
    calibrated density band refuses more than its ceiling. A line may carry
    what BOTH admit, which is the smaller — and that is the number every
    placement demand below is measured against.

    THE OTHER DIRECTION IS NOT A CEILING AND MUST NOT BE READ AS ONE. A line
    given MORE slots than the band's ceiling is a legitimately SLOWER line —
    `SPARSE`'s own gloss is *"fewer units than pulses"*, so slots are a
    CAPACITY and never a requirement. M-79's Finding 1 read 24 slots against a
    ceiling of 12 as a bar the writer could not legally fill and measured 78%
    of plans that way; the honest reading is that those plans are sparse and
    the unsatisfiable ones are elsewhere (see this module's own gate below).
    """
    return min(slots, MB.ADOPTED["DENSITY"][1])


def joint_findings(plan):
    """-> [(code, line, detail)] every per-line CONJUNCTION this plan asks for
    and cannot get.

    A PURE FUNCTION OF THE EMITTED PLAN, so it checks a hand-written one on
    the same terms as a generated one and so `make_plan`'s own draw cannot be
    what makes it pass. `make_plan` calls it on the finished dict and REFUSES
    on any finding; the generator is separately arranged to satisfy it by
    construction, which is what makes a mutation the only way to fire it —
    the same relationship `ADOPTED_MAX_GROUP` has to the scheme sampler.

    THE FOUR CAUSES ARE REPORTED APART AND NEVER SUMMED (doctrine 79). They
    ask different things of whoever closes them: the first is a meter that
    left no room after its own pickup, the second and third are a placement
    reaching past what the line can hold, and the fourth is two declared rhyme
    groups landing on ONE word — which is not an arithmetic impossibility at
    all but the joint question `joint_field` answers WITH WORDS, and a plan
    has none.

    IT READS `groups` AND NOT `returns`, and that is a fact about the shape
    rather than an omission. A return class demands the later instance be the
    EARLIER LINE, so it adds no binding of its own and no placement to collide
    with: `make_plan` emits groups for a returning function's FIRST instance
    only, and the later ones carry the identical constraints by being the
    identical words. The span question is settled the same way — anacrusis and
    meter are per function KIND, so two instances of one kind have the same
    slots by construction, and a drift there is `RETURN_SLOT_DRIFT`'s to
    report rather than this gate's to refuse.
    """
    lo = MB.ADOPTED["DENSITY"][0]
    sub = plan["subdivision"]
    span = {s["line"]: float(s["duration"]) * sub
            for s in plan["line_slots"]}
    at = {}
    for group in str(plan.get("groups") or "").split(";"):
        for member in group.split(","):
            member = member.strip()
            if not member:
                continue
            num, _, place = member.partition(".")
            at.setdefault(int(num), []).append(place or "end")

    out = []
    for ln in sorted(span):
        slots = span[ln]
        ceiling = line_syllable_ceiling(slots)
        if ceiling < lo:
            out.append((
                "SPAN_BELOW_DENSITY_FLOOR", ln,
                f"the line is given {slots:g} slot(s) and the calibrated "
                f"density band's floor is {lo} syllable(s), so every legal "
                f"line overflows its own bar: below the floor the band flags "
                f"it and at or above it `fit.SLOTS_EXCEEDED` does. No draft "
                f"clears both."))
            continue
        places = at.get(ln, [])
        words = [placement_word(p) for p in places]
        landed = {}
        for place, word in zip(places, words):
            landed.setdefault(word, []).append(place)
        for word in sorted(landed, key=str):
            names = landed[word]
            if len(names) > 1:
                where = ("the last word" if word == LAST_WORD
                         else f"word {word}")
                out.append((
                    "TWO_GROUPS_ONE_WORD", ln,
                    f"{len(names)} declared rhyme groups bind {where} of this "
                    f"line ({', '.join(sorted(names))}). Whether one word "
                    f"answers every family at once is `joint_field`'s "
                    f"question and it needs WORDS; a plan has none, so this "
                    f"is volunteered homework nobody has checked."))
        indices = [w for w in words if w != LAST_WORD]
        top = max(indices) if indices else 0
        if top > ceiling:
            out.append((
                "TOKEN_INDEX_UNREACHABLE", ln,
                f"a placement names word {top} of a line that may carry at "
                f"most {ceiling:g} syllable(s) — {slots:g} slot(s) against a "
                f"band ceiling of {MB.ADOPTED['DENSITY'][1]} — and a line has "
                f"no more words than syllables."))
            continue
        need = top
        if LAST_WORD in words:
            # The last word must be a DIFFERENT word from every numbered one,
            # or the two groups meet on it — the collision above, arrived at
            # by arithmetic instead of by name.
            need = max(1, top + 1 if top else 1)
        if need > ceiling:
            out.append((
                "WORDS_EXCEED_SPAN", ln,
                f"the placements on this line need {need} distinct words and "
                f"the line may carry at most {ceiling:g} syllable(s) "
                f"({slots:g} slot(s) against a band ceiling of "
                f"{MB.ADOPTED['DENSITY'][1]}); a word is at least one "
                f"syllable."))
    return out


# ---------------------------------------------------------------- pattern

#: WHICH FUNCTIONS THE GENERATOR REACHES, with each row's semantics taken
#: from `grid.SECTION_FUNCTIONS`' own recurrence contract:
#:   "once"              -> at most one instance
#:   "returns verbatim"  -> instance 2+ is a return class of instance 1
#:   "returns new words" / "varied" / "open" -> fresh groups per instance,
#:                          same line count and scheme (the same tune)
#: ~~"Functions NOT in the roster are hand-declarable today and wait for a
#: stated reason: refrain/burden are line-level per their own glosses (not
#: standalone sections); reprise needs a cross-reference the plan schema does
#: not carry yet; turnaround overlaps a seam; postchorus and false_ending need
#: ordering machinery beyond the cell grammar; hook is covered by the hook
#: SLOT below (a hook is properly a fragment)."~~
#:
#: DERIVED, NOT LISTED — 2026-08-22, owner ruling "all 21 working". The
#: paragraph above was doing two different jobs and only one of them was
#: sound. The sound half is a KIND distinction and it is now a FIELD
#: (`FunctionSpec.kind`, `MISSING.md` M-56): `refrain` and `burden` are
#: line-level by their own glosses, so a cell grammar that draws SPANS can
#: never draw one, and that is not a gap. The unsound half was four functions
#: excluded for "ordering machinery beyond the cell grammar" — `postchorus`,
#: `false_ending`, `reprise`, `turnaround` — when the ordering machinery had
#: ALREADY BEEN BUILT: `grid.placement_findings` enforces `requires`,
#: `adjacent_after`, `adjacent_before`, `needs_before` and `needs_after`, and
#: `_sample_pattern` already rejection-samples on it. Every one of those four
#: declares exactly such a constraint and it was being enforced by a
#: hand-written omission instead. `hook` was excluded as "properly a
#: fragment", which its own gloss contradicts in as many words: "this entry
#: covers the post-chorus-hook case where a WHOLE SECTION carries it" — the
#: fragment is the separate `Hook` object.
#:
#: So the roster is READ OFF THE VOCABULARY and cannot drift from it.
def _derive_roster():
    """-> the section-kind function names. LAZY IMPORT, like every other
    `grid` reach in this file: `quality/test_plan.py` §4's move-37 guard
    reads this module's AST and allows `grid` only for a named symbol set,
    and a module-level `import grid` would also make `import plan` pay for
    `grid`'s three file opens."""
    from quality import grid as _GR
    return tuple(n for n, sp in sorted(_GR.SECTION_FUNCTIONS.items())
                 if sp.kind == "section")


GENERATOR_ROSTER = _derive_roster()

#: Instrumental spans: bars with no lines. `fit.py` reports their bars as
#: uncovered — a note, a rest is not a defect.
#: Functions that carry NO SUNG WORDS. They are NOT zero-structure sections
#: — see `WORDLESS_FUNCTIONS` and the paragraph below it — and the name is
#: kept because `plan.py`'s own API exports it and callers read it.
ZERO_LINE_FUNCTIONS = frozenset({"interlude", "solo"})

#: THE SAME SET, NAMED FOR WHAT IT ACTUALLY MEANS (2026-08-23).
#:
#: A SECTION WITH NO WORDS IS NOT A SECTION WITH NO CONSTRAINTS, and modelling
#: it as one was a hole an optimiser could drive through. The owner named it:
#: *"instrumental is not free of lines. what have you that idea?"* — and the
#: idea came from this module's own v2 paragraph, "instrumental functions
#: carry bars with no lines", repeated uncritically.
#:
#: MUSICALLY IT IS FALSE: an instrumental has bars, a meter, and phrase
#: structure; what it lacks is words. STRUCTURALLY IT IS DANGEROUS: a section
#: carrying no constraint mass is a free token, the cheapest possible version
#: of the two-line outro that "technically satisfied" a variety rule while
#: gaming it. Any structural requirement over sections could be answered by
#: appending constraint-free instrumentals.
#:
#: SO EVERY SECTION CARRIES PHRASES. A wordless section draws a PHRASE count
#: from the same per-section envelope every other section draws its line
#: count from, and its bars follow from that count exactly as a sung
#: section's do. What "wordless" removes is the LYRIC half — no line slots,
#: no rhyme group, nothing for the writer to fill — and nothing else.
WORDLESS_FUNCTIONS = ZERO_LINE_FUNCTIONS

#: Functions whose later instances RETURN VERBATIM (their contract's
#: `returns_as`): the plan realises them as return classes.
VERBATIM_RETURNERS = frozenset({"chorus", "tag"})

#: The cell grammar: a body is 2..6 cells; each cell is a short run the
#: vocabulary's own adjacencies license (a prechorus is BEFORE a chorus by
#: definition; a build points AT a drop).
#:
#: DERIVED FROM `SECTION_FUNCTIONS` SINCE 2026-08-22, and the comment above
#: is why it had to be: it claimed these runs were "the vocabulary's own
#: adjacencies", and until the placement layer shipped there was no way to
#: check that claim — so the literal below drifted from the vocabulary it
#: named. MEASURED before the change: `grid` declared 21 functions and this
#: tuple reached 11 of them, with eight of the ten missing carrying placement
#: constraints that were declared, validated at import, covered by
#: `quality/test_placement.py` — and consulted by nothing, because the
#: planner drew from the literal instead. That is `MISSING.md` M-59's shape
#: one layer up: a declared coordinate read by nothing.
#:
#: THE DERIVATION, and it is deliberately the SMALLEST one that is honest:
#:   * every section-kind function gets a singleton cell `(f,)`;
#:   * a function declaring `adjacent_before=X` also gets `(f, X)`, and one
#:     declaring `adjacent_after=X` also gets `(X, f)` — that is what those
#:     fields MEAN, and it is where `("prechorus", "chorus")` and
#:     `("build", "drop")` come from rather than from a hand-typed row;
#:   * `("verse", "prechorus", "chorus")` is the one chain, composed by
#:     following `adjacent_before` twice.
#: Nothing else is invented. A cell that violates a `requires` or a boundary
#: is NOT filtered here: `_sample_pattern` already rejection-samples on
#: `grid.placement_findings`, and pruning twice in two places is how the two
#: come to disagree (doctrine 1).


def _derive_cells():
    """-> the cell grammar, from the vocabulary's own adjacency fields."""
    from quality import grid as _GR
    fns = {n: sp for n, sp in _GR.SECTION_FUNCTIONS.items()
           if sp.kind == "section"}
    cells = {(n,) for n in fns}
    for n, sp in fns.items():
        b = getattr(sp, "adjacent_before", "")
        a = getattr(sp, "adjacent_after", "")
        if b and b in fns:
            cells.add((n, b))
        if a and a in fns:
            cells.add((a, n))
    # THE ONE CHAIN, composed rather than typed: a function whose
    # `adjacent_before` is itself a function with an `adjacent_before`.
    for n, sp in fns.items():
        b = getattr(sp, "adjacent_before", "")
        if not b or b not in fns:
            continue
        for m, sp2 in fns.items():
            if getattr(sp2, "adjacent_after", "") == n and m in fns:
                cells.add((m, n, b))
    return tuple(sorted(cells))


_CELLS = _derive_cells()


#: THE EDGES, DERIVED (2026-08-22, `MISSING.md` M-54). These were the literals
#: `"intro"` and `("outro", "coda")` written into `_sample_pattern`'s control
#: flow, which made "an outro is last" true of the output and stated in no
#: coordinate — so no grader could check it and no table row could extend the
#: roster. They are read off `grid.FunctionSpec.boundary` now, and the same
#: table is what `grid.placement_findings` grades a draft against, so the
#: planner and the grader cannot disagree (doctrine 1).
def _edges():
    from quality import grid as _GR
    first = tuple(sorted(n for n, sp in _GR.SECTION_FUNCTIONS.items()
                         if sp.boundary == "first" and n in GENERATOR_ROSTER))
    last = tuple(sorted(n for n, sp in _GR.SECTION_FUNCTIONS.items()
                        if sp.boundary == "last" and n in GENERATOR_ROSTER))
    return first, last


#: How many times a body may be redrawn before the planner gives up. Rejection
#: sampling from a UNIFORM proposal is uniform over the ACCEPTED set — which is
#: the property the design asked for ("uniform over SOLUTIONS") and the reason
#: this is not a greedy left-to-right collapse: collapsing slot by slot would
#: re-introduce exactly the enumeration bias v2's own smoke run found. A bound
#: is still required, because a constraint set can be unsatisfiable and a
#: sampler that hangs is worse than one that refuses (doctrine 20).
PATTERN_ATTEMPTS = 200


def _sample_pattern(rng, roster=None, form=None, max_cells=None):
    """-> ordered tuple of function names. Once-functions once, edges at
    the edges, everything else free.

    `form` is THE NAMED SHAPE, and it is enforced HERE because nothing else
    could (2026-08-23). It was a parameter of `make_plan` that this function
    never received, so `form=verse-chorus` printed on every plan and denied
    nothing. What it now denies is exactly what `FORM_REQUIRES` declares —
    membership, measured 178 of 178 on `corpus/song/` — and nothing else.
    The ORDER tendency is measured at 77% and left to `FORM_TENDENCIES`,
    unenforced, because a planner that refused the other 23% would be
    refusing a quarter of the corpus the number came from.

    `roster` is THE WRITER'S ALLOW-LIST (`MISSING.md` M-55): when given, no
    function outside it may appear. It is enforced by REJECTION, the same way
    the placement constraints are, so the draw stays uniform over the
    admissible set rather than being steered function by function. A roster
    the cell grammar cannot satisfy exhausts the attempts and REFUSES, which
    is the honest answer -- a planner that quietly widened the roster to find
    a plan would be answering a different request (doctrine 20).

    THE EDGES AND THE ADMISSIBILITY TEST ARE BOTH DERIVED FROM THE VOCABULARY
    (M-54). What was hardcoded: `funcs.append("intro")` before the cell loop
    and `rng.choice((None, "outro", "coda"))` after it. Those two `append`
    calls WERE the rule "an intro is first and an outro is last", enforced by
    the order of statements and written down nowhere — measured true of 84 of
    84 plans carrying an outro, and consultable by nothing.

    AND THE BODY ITSELF WAS UNCHECKED. Measured before this changed: **19 of
    300 plans violated the vocabulary's own definitions**, every one an
    `interlude` opening or closing the song — a span whose gloss is "between
    sung sections", with nothing sung on one side of it. `_CELLS` offers
    `("interlude",)` and `("solo",)` as standalone cells and nothing stopped
    one landing at an edge.
    """
    first_fns, last_fns = _edges()
    need = set(FORM_REQUIRES.get(form, ()))
    from quality import grid as _GR
    # PRUNE THE PROPOSAL, DO NOT STEER THE DRAW. Drawing uniformly from the
    # cells a roster admits is uniform over the admissible set -- the same
    # argument rejection sampling rests on, with the rejections done once
    # here instead of once per attempt. Rejecting cell by cell instead was
    # measured and it is not a tuning question, it is a correctness one:
    # `--functions=verse,chorus,outro` admits 3 of the 12 cells, so a
    # 2-6 cell body survives at ~0.25^n and REFUSED on an ordinary request.
    cells = _CELLS if roster is None else tuple(
        c for c in _CELLS if all(f in roster for f in c))
    if not cells:
        raise PlanRefused(
            f"the declared roster {sorted(roster)} admits NONE of the "
            f"{len(_CELLS)} cells the pattern grammar is built from, so no "
            f"body can be drawn from it at all. The buildable functions are "
            f"{sorted(set().union(*_CELLS))} plus the edges "
            f"{sorted(set(first_fns) | set(last_fns))}.")
    openers = (None,) + tuple(f for f in first_fns
                              if roster is None or f in roster)
    enders = (None,) + tuple(f for f in last_fns
                             if roster is None or f in roster)
    max_cells = ENVELOPE["sections"][1] if max_cells is None \
        else max_cells
    for _ in range(PATTERN_ATTEMPTS):
        funcs = []
        # An opener, drawn uniformly over the boundary='first' rows plus the
        # no-opener case, so adding a row to that table widens this draw.
        opener = rng.choice(openers)
        if opener:
            funcs.append(opener)
        # THE CELL COUNT IS BOUNDED BY THE SONG THIS PLAN IS ALREADY
        # COMMITTED TO. `max_cells` comes from the drawn total: every sung
        # section carries at least one line, so a song of T lines cannot
        # hold more than T sung sections and therefore not more than T
        # cells. That is the derivation the old literal `(2, 6)` stood in
        # for — and it stood in for something real, since the placement
        # vocabulary's admissible fraction decays smoothly with length
        # (measured: 71% of one-cell patterns are admissible, 18% at six,
        # 0.12% at twenty-four). There is no admissible CEILING to derive,
        # only a decay, so the bound comes from the song and the placement
        # layer keeps doing the rejecting.
        n_cells = rng.randint(1, max(1, max_cells))
        bridge_used = False
        for _ in range(n_cells):
            while True:
                cell = cells[rng.randrange(len(cells))]
                if "bridge" in cell and bridge_used:
                    continue
                break
            if "bridge" in cell:
                bridge_used = True
            funcs.extend(cell)
        # AT MOST ONE CLOSER, and that bound is NOT derived — nothing in
        # either gloss says a song may not carry a coda AND an outro. It is
        # the old `rng.choice((None, "outro", "coda"))` preserved as an
        # EXPLICIT declared choice rather than silently kept in a tuple's
        # shape, and the ruling on whether to lift it is M-54's open half.
        ending = rng.choice(enders)
        if ending:
            funcs.append(ending)
        # THE FORM'S OWN MEMBERSHIP, on the same rejection path as the
        # placement constraints. Pruning the cell grammar instead would be
        # steering the draw rather than pruning the proposal, which is the
        # correctness argument the roster block above already makes.
        if need and not need <= set(funcs):
            continue
        if not _GR.placement_findings(list(funcs)):
            return tuple(funcs)
    raise PlanRefused(
        f"no admissible section pattern in {PATTERN_ATTEMPTS} draws"
        + (f" under the declared roster {sorted(roster)}" if roster else "")
        + (f" carrying every function `--form={form}` requires "
           f"({', '.join(sorted(need))})" if need else "")
        + f". The placement constraints on `grid.SECTION_FUNCTIONS`"
        + (", the declared roster," if roster else "")
        + (", the form's membership," if need else "")
        + f" and the cell grammar `_CELLS` do not intersect — REFUSED rather "
        f"than returning a pattern the vocabulary's own definitions reject, "
        f"or quietly widening a roster the writer declared (doctrine 20).")


# ---------------------------------------------------------------- plan

def make_plan(seed, form="verse-chorus", lines=None, relation=None,
              functions=None):
    """A request -> the plan dict. Refuses rather than guessing.

    `relation` and `functions` are THE WRITER'S DECLARATION (`MISSING.md`
    M-55) and neither is sampled. The planner does not pick a relation: doing
    so would put `type:pararhyme` on a group nobody asked for, which is the
    "move 37" ban pointed at rhyme instead of at shape. What the planner does
    is CARRY a declaration into the plan artifact, so the one command that
    grades the draft names the relation the writer chose.

    THREE LAYERS, AND ONLY THE MIDDLE ONE IS HERE (design doc §2):
    the VOCABULARY says a prechorus requires a chorus and that is
    definitional; the CONVENTION says verse-chorus-verse-chorus and is never
    enforced; and this is the DECLARATION — "chorus and postchorus, no
    prechorus" — which is neither, and had no way to be spelled at all.
    """
    if seed is None:
        raise PlanRefused(
            "plan requires --seed=N — the pattern, the meter and every "
            "scheme are free choices, and a free choice without a declared "
            "seed is a hidden coordinate (doctrine 66). Any integer; the "
            "same seed reproduces the same plan byte for byte.")
    if form in BLOCKED_FORMS:
        raise PlanRefused(f"--form={form} is declared and BLOCKED: "
                          f"{BLOCKED_FORMS[form]}")
    if form not in PLAN_FORMS:
        raise PlanRefused(
            f"--form={form!r} is not a declared form. Declared: "
            f"{', '.join(PLAN_FORMS)}; declared-but-blocked: "
            f"{', '.join(sorted(BLOCKED_FORMS))}.")
    t_lo, t_hi = ENVELOPE["total_lines"]
    if lines is not None and not t_lo <= lines <= t_hi:
        raise PlanRefused(
            f"--lines={lines} is outside the planner's envelope "
            f"[{t_lo}, {t_hi}]. The envelope bounds what the planner "
            f"VOLUNTEERS, not what the graders accept — declare a "
            f"blueprint and mandate by hand for a shape outside it.")

    # THE DECLARED RELATION, validated HERE rather than at grade time. It is
    # resolved through the same `rhyme_types.resolve_relation` every mandate
    # uses, so a typo refuses while the writer is still holding the sentence
    # they got wrong, and the stored form is the namespaced one that
    # re-resolves to the same judge (`MISSING.md` M-49).
    if relation:
        from quality import schemes as _SC
        try:
            relation = _SC.mandate("AA", n_lines=2,
                                   default_relation=relation).default_relation
        except _SC.NoMandate as e:
            raise PlanRefused(f"--relation={relation!r} is not declarable: "
                              f"{e}")

    # THE DECLARED ROSTER. A song may ask for the functions it wants, and the
    # request is CHECKED against the vocabulary's own definitional
    # constraints: asking for a prechorus and no chorus REFUSES, because the
    # word means before-the-chorus and a roster that cannot contain one is
    # not a novel structure, it is a contradiction (M-54's `requires`).
    roster = None
    if functions:
        from quality import grid as _GR
        want = []
        for f in functions:
            f = str(f).strip()
            if not f:
                continue
            try:
                want.append(_GR.as_function(f))
            except Exception:
                raise PlanRefused(
                    f"--functions names {f!r} and there is no such section "
                    f"function. The vocabulary is "
                    f"`quality.grid.SECTION_FUNCTIONS` — "
                    f"{len(_GR.SECTION_FUNCTIONS)} names.")
        unbuildable = sorted(set(want) - set(GENERATOR_ROSTER))
        if unbuildable:
            raise PlanRefused(
                f"--functions names {unbuildable}, which the vocabulary "
                f"declares but this planner cannot BUILD. Its roster is "
                f"{sorted(GENERATOR_ROSTER)} — a declaration the generator "
                f"cannot honour is refused rather than silently dropped "
                f"(doctrine 20).")
        have = set(want)
        for f in want:
            sp = _GR.SECTION_FUNCTIONS[f]
            missing = [r for r in sp.requires if r not in have]
            if missing:
                raise PlanRefused(
                    f"--functions asks for {f!r} and not for {missing} — and "
                    f"{f!r} REQUIRES {missing} by definition "
                    f"({sp.placement_evidence!r}). A section that cannot "
                    f"stand in the relation its own name states is not a "
                    f"novel structure, it is a mislabelled one. Declare "
                    f"{missing} too, or drop {f!r}.")
        roster = tuple(want)

    rng = random.Random(seed)

    # REJECTION SAMPLING over the generated grammar: uniform over the
    # space, CONDITIONED on the envelope (and on --lines when given).
    # Deterministic — the retries are the same rng stream.
    _GRADEABLE = gradeable_line_counts()
    k_lo, k_hi = ENVELOPE["lines_per_section"]
    for _attempt in range(500):
        # THE LENGTH FIRST. It is the coordinate that decides what the floor
        # can grade, so it is drawn from the gradeable set before anything
        # is conditioned on it — and it then BOUNDS the pattern, since a
        # song of T lines cannot carry more than T sung sections.
        total = rng.choice(sorted(_GRADEABLE))
        try:
            funcs = _sample_pattern(rng, roster, form=form, max_cells=total)
        except PlanRefused:
            # A REJECTED DRAW, NOT A REFUSED REQUEST. `_sample_pattern`
            # raises when it cannot find an admissible pattern within the
            # cell ceiling it was given, and that ceiling is THIS attempt's
            # drawn total — a four-line song cannot carry a form that
            # requires two sung sections and much else. The outer loop is the
            # rejection sampler, so the honest move is to draw another total;
            # letting the inner refusal escape would report a request as
            # impossible on the strength of one unlucky length.
            continue
        s_lo, s_hi = ENVELOPE["sections"]
        if not s_lo <= len(funcs) <= s_hi:
            continue
        # THE TOTAL FIRST, THEN THE PARTITION — the dimension-by-dimension
        # derivation `_sample_meter` already follows, and it is not a
        # convenience: drawing each kind's line count INDEPENDENTLY over the
        # song's whole capacity blows the joint budget almost every time
        # (measured at 6 plans in 200 seeds), and rejecting those draws would
        # bias the survivors toward whichever shapes happen to fit. So the
        # TOTAL is drawn uniform over the gradeable set — which is the
        # distribution that matters, since it decides how long a song this
        # planner volunteers — and the per-kind counts are then drawn to sum
        # to it exactly.
        #
        # A kind appearing c times contributes c x k lines, so each draw is
        # bounded by what remains after every LATER kind takes its minimum of
        # one line per instance. The kind ORDER is shuffled from the same
        # seeded stream, because a fixed order would hand the first kind the
        # widest range on every plan — a bias in the sampler's own bookkeeping
        # rather than in its declared space.
        kinds = [f for f in dict.fromkeys(funcs)
                 if f not in ZERO_LINE_FUNCTIONS]
        counts = {fn: sum(1 for f in funcs if f == fn) for fn in kinds}
        order = list(kinds)
        rng.shuffle(order)
        shape = tuple(counts[f] for f in order)
        drawn = _partition_uniform(shape, total, rng)
        if drawn is None:
            # This (pattern, total) pair admits no assignment at all — every
            # kind needs at least one line per instance and the total cannot
            # cover them, or the arithmetic leaves no whole remainder.
            # Rejected, never rounded: a rounded total is a length the floor
            # was not asked about.
            continue
        ks = {f: 0 for f in dict.fromkeys(funcs)}
        for fn, k in zip(order, drawn):
            ks[fn] = k
        # PHRASES FOR THE WORDLESS SECTIONS, from the SAME per-section
        # envelope. They consume no lines — they carry no words — so they
        # are not part of the partition above, but they are not free either:
        # a wordless section's bars follow from its phrase count exactly as
        # a sung section's follow from its line count, so it cannot be a
        # one-bar token an optimiser appends to satisfy a structural rule.
        phrases = dict(ks)
        # AT THIS SONG'S OWN SCALE, not at the envelope's. A wordless
        # section consumes no lines, so nothing in the partition bounds it —
        # and drawn against the global ceiling it produced instrumentals of
        # 984 bars beside verses of four, which is the freebie inverted
        # rather than closed. The scale that IS available is the song's own:
        # the longest sung section this plan drew. An instrumental is as long
        # as this song's sections are, which is a derivation from the plan
        # rather than a number chosen for it.
        _scale = max([v for f, v in ks.items()
                      if f not in WORDLESS_FUNCTIONS] or [k_lo])
        for fn in dict.fromkeys(funcs):
            if fn in WORDLESS_FUNCTIONS:
                phrases[fn] = rng.randint(k_lo, max(k_lo, _scale))
        # verbatim returners: later instances are copies, so they carry the
        # SAME line count already (ks is per kind) — the drawn total stands.
        assert total == sum(ks[f] for f in funcs), (
            "the partition must sum to the drawn total; a mismatch here "
            "would mean the plan's length is not the length the gradeable "
            "set was asked about")
        #
        # THE SET, NOT THE SPAN. `gradeable_line_counts()` is not contiguous
        # — 6 to 11 lines lands between the section profile's reach and the
        # sonnet's, where every length-sensitive finding is downgraded to a
        # note — so a span test would volunteer plans the floor cannot hold
        # to anything. Rejection against the set keeps the draw uniform over
        # what is ACCEPTED, which is the same argument the placement layer's
        # rejection sampling makes.
        if total not in _GRADEABLE:
            continue
        if lines is not None and total != lines:
            continue
        # at least one mandated pair somewhere: some sung function with
        # k >= 2 (its scheme then carries a pair by _scheme_for's rule).
        if not any(ks[f] >= 2 for f in funcs):
            continue
        break
    else:
        raise PlanRefused(
            f"500 seeded draws found no plan matching the request inside "
            f"the envelope (sections {ENVELOPE['sections']}, lines/section "
            f"{ENVELOPE['lines_per_section']}, total {ENVELOPE['total_lines']}"
            f" MINUS the uncalibrated runs {line_count_gaps()}, which no "
            f"floor profile grades with teeth"
            f"{', exact total ' + str(lines) if lines is not None else ''}) "
            f"— try another seed, drop --lines, or declare the shape by "
            f"hand.")

    bars, sub, beats, groups_m, (n_slots, n_fact, slots_pl) = \
        _sample_meter(rng)
    meter = {"beats": beats, "unit": _unit_for(groups_m),
             "groups": list(groups_m)}

    # Schemes per function kind (one tune per kind — new words, same
    # shape), and a per-section anacrusis in beats.
    by_func, scheme_meta = {}, {}
    for fn in dict.fromkeys(funcs):
        if ks[fn] == 0:
            continue
        code, pool = _scheme_for(ks[fn], rng)
        by_func[fn] = code
        scheme_meta[fn] = {"rgs": list(code), "chosen_from": pool,
                           "lines": ks[fn],
                           "lines_chosen_from": list(ENVELOPE[
                               "lines_per_section"])}

    # Anacrusis is PER FUNCTION KIND, like the scheme: the pickup is part
    # of the tune, and a kind whose instances differed would hand the
    # grader's own shape layer a RETURN_SLOT_DRIFT on a return this very
    # plan mandates as verbatim (caught by the first round-trip probe,
    # 2026-08-18). Halves need a subdivided grid to land on.
    # DERIVED FROM THE GRID THIS PLAN ACTUALLY DREW, not filtered out of a
    # table: a pickup must land on a grid position, and a section at
    # subdivision `sub` resolves k/sub of a beat. The old filter kept whole
    # beats plus halves-if-subdivided, which is the sub=2 case written out —
    # it denied a sub=4 section the quarter-beat pickups its own grid can
    # land on, and no coordinate said so.
    # AND THE PICKUP IS SUBTRACTED FROM THE SPAN THE ENVELOPE GUARANTEED, so
    # the choices are filtered against what is LEFT (`MISSING.md` M-80). The
    # envelope's floor is derived on `bars x beats x sub` — "fewer slots than
    # the minimum band-legal syllable count is unsatisfiable BY CONSTRUCTION",
    # this module's own docstring — and then every line is emitted with
    # `duration = bars * beats - ana`, so a pickup of a whole beat at
    # subdivision 4 removes four slots from a floor that was checked before
    # they were taken. A derivation stated on one quantity and applied to
    # another: measured at 1 plan in 400 landing a line UNDER the density
    # floor, where every legal draft is flagged either by the band (too few
    # syllables) or by `fit.SLOTS_EXCEEDED` (too many for the bar).
    # THE FILTERED SET CANNOT BE EMPTY: `_anacrusis_choices` always contains
    # 0.0, and the envelope has already cleared the un-pickedup span.
    _floor = MB.ADOPTED["DENSITY"][0]
    ana_choices = [a for a in _anacrusis_choices(sub)
                   if (bars * beats - a) * sub >= _floor]
    anacrusis = {fn: rng.choice(ana_choices)
                 for fn in dict.fromkeys(funcs) if ks[fn] > 0}

    # THE WORD INDEX A PLACEMENT MAY NAME. Two bounds, and the second is this
    # plan's own (`MISSING.md` M-80): the floor's measured tokens-per-line
    # floor says what a line of English verse RELIABLY carries, and the
    # shortest line THIS PLAN drew says what it can carry AT ALL. A plan whose
    # sections run seven slots after their pickup was still asking for the
    # seventh word, because the ceiling was a module-level constant computed
    # before the meter was even drawn — measured at 5 plans in 400 naming a
    # word past what the line could hold and 4 more needing more distinct
    # words than syllables.
    # MINUS ONE, because a numbered word and the LAST word must be different
    # words or the two groups binding them meet (`joint_findings`' fourth
    # cause). Reserving the final word is what makes `end` co-drawable with
    # any `T<n>` this pool holds.
    _spans = [(bars * beats - a) * sub for a in anacrusis.values()] \
        or [bars * beats * sub]
    _cap_lo = min(int(line_syllable_ceiling(s)) for s in _spans)
    _max_token = max(1, min(int(tokens_per_line_band()[0]), _cap_lo - 1))

    # Lay out sections and line slots.
    sections, line_slots = [], []
    #: WHICH WORDS EACH LINE ALREADY BINDS. A line may join a further group
    #: only at a word it does not already bind — see the overlap draw below
    #: for why that is what makes an overlapping cover satisfiable without
    #: words.
    #: ~~WHICH PLACEMENTS EACH LINE ALREADY CARRIES~~ — the placement NAME was
    #: the wrong coordinate and it is the whole of `MISSING.md` M-80's fourth
    #: cause: four of the names this pool draws denote only TWO words (`end`
    #: and `endword` are the last, `head`, `headrime` and `T1` the first), so
    #: the invariant this comment states was tested against something that
    #: does not answer it, and 94% of plans landed two declared rhyme groups
    #: on one word. `placement_word` is the coordinate that answers it.
    used = {}
    bar, line_no = 1, 1
    counts = {}
    first_seen = {}
    groups, returns = [], []
    for fn in funcs:
        counts[fn] = counts.get(fn, 0) + 1
        name = f"{fn.upper()}{counts[fn]}"
        k = ks[fn]
        # BARS FOLLOW THE PHRASE COUNT, which for a sung section IS its line
        # count and for a wordless one is its own draw. `max(k, 1)` used to
        # stand here and it is what made an instrumental exactly one line's
        # worth of music whatever else the plan did — the freebie this
        # section's own comment now records.
        n_bars = phrases[fn] * bars
        ana = anacrusis.get(fn, 0.0)
        sections.append({"name": name, "function": fn,
                         "bars": n_bars, "start_bar": bar,
                         "meter": dict(meter)})
        first = line_no
        for i in range(k):
            line_slots.append({
                "line": line_no, "section": name, "function": fn,
                "bar": bar + i * bars, "beat": 1 + ana,
                "duration": bars * beats - ana})
            line_no += 1
        bar += n_bars
        if k == 0:
            continue
        if fn in VERBATIM_RETURNERS and fn in first_seen:
            returns.extend([first_seen[fn] + i, first + i]
                           for i in range(k))
        else:
            if fn in VERBATIM_RETURNERS:
                first_seen[fn] = first
            for _g in _abs_groups(by_func[fn], first):
                # THE CAPACITY GATE (`MISSING.md` M-41). A rhyme group of k
                # members needs a family the grader accepts k members of AT
                # ONCE, and `quality/capacity.py` is what measured that: the
                # deepest CERTIFIED chain is 40, a witness clique graded
                # through `Reviser.inspect`. A plan volunteering a larger
                # group is asking for something no family in this lexicon is
                # measured to fill — unfillable homework, refused here rather
                # than discovered three revise rounds in.
                if len(_g) > _CAP.ADOPTED_MAX_GROUP:
                    raise PlanRefused(
                        f"this seed's scheme puts {len(_g)} lines in one "
                        f"rhyme group, and the lexicon is measured to "
                        f"sustain at most {_CAP.ADOPTED_MAX_GROUP} "
                        f"(quality/capacity.py: the deepest CERTIFIED chain, "
                        f"a witness clique graded through the reviser). The "
                        f"tier-1 ceiling reaches further and is ungraded, so "
                        f"this refuses where the MEASUREMENT stops rather "
                        f"than where the arithmetic does.")
                groups.append(_place_group(_g, rng, _max_token, used))
            # OVERLAPPING GROUPS, DRAWN AND NOT ONLY DECLARABLE (2026-08-23).
            #
            # Doctrine 2's own sentence is that maximal cliques MAY OVERLAP —
            # "structures with no letter representation" — and the mandate
            # layer has accepted overlapping groups since it was written.
            # The GENERATOR could not produce one: its groups come from an
            # RGS code, which is a PARTITION, so a whole class of structure
            # was declarable and never drawable. On this repository's own
            # rule that the planner is the front door and hand-written
            # mandates are for tests, that is the class of song the system
            # WORKING AS INTENDED can never write — probability exactly zero,
            # which is the "move 37" ban committed by omission rather than by
            # weighting.
            #
            # AND THE PLACEMENT COORDINATE IS WHAT MAKES IT SATISFIABLE. Two
            # groups binding one line at the SAME WORD are a joint constraint
            # on ONE word, and whether any word answers both is
            # `joint_field`'s question — which needs words, and a plan has
            # none. At DIFFERENT words they constrain different words of the
            # line and no such question arises. So a line may join a second
            # group only at a WORD it does not already bind: satisfiable BY
            # CONSTRUCTION rather than by a search a plan cannot run.
            # ~~at a PLACEMENT it does not already carry~~ — struck 2026-08-23
            # (`MISSING.md` M-80). The placement name is not the word: `end`
            # and `endword` are one word between them, `head`, `headrime` and
            # `T1` another, and `headrime`/`T1` are the IDENTICAL SPAN of it.
            # Under the name test this paragraph's own conclusion was false in
            # 94% of plans, which is why `used` keys on `placement_word` and
            # why `joint_findings` checks the conclusion rather than asserting
            # it.
            #
            # DIMENSION BY DIMENSION, never uniform over the leaves: the
            # count first, then each group's size, then its members. Uniform
            # over covers would weight a shape by how many memberships it
            # admits, which is the enumeration bias v2's own smoke run found
            # in the meter sampler.
            sec_lines = list(range(first, line_no))
            if len(sec_lines) >= 2:
                # HOW MUCH WEB, and it is a PER-LINE draw. The owner's
                # framing: *"I don't think that literally every word need N
                # pairs of rhymes but there's just no way that we can only be
                # contemplating the last word of every line."* Both ends of
                # that sentence are refusals — of a plan that binds only line
                # ends, and of one that binds everything — so the count is
                # drawn rather than chosen at either extreme.
                #
                # EACH LINE DRAWS ITS OWN PARTICIPATION, uniform over what
                # the placement pool admits. Uniform over [1, |pool|]
                # privileges no count: a line carrying exactly one binding —
                # the classic end rhyme and nothing else — is as likely as
                # any other, and so is a line woven into several. Drawing a
                # number of extra GROUPS instead was measured at 100% of
                # plans overlapping with a median of 22 groups a song, which
                # is the density decided by the shape of the loop rather than
                # by a coordinate.
                # THE CEILING IS WHAT A LINE CAN CARRY, not how many names
                # the placement table happens to hold. A binding occupies a
                # SPAN, and distinct bindings on one line need distinct
                # spans, so the number a line can carry is bounded by its
                # syllables — and the number it is GUARANTEED to carry is
                # bounded by the fewest syllables a band-legal line may have,
                # which is the calibrated density band's floor
                # (`meter_bands.ADOPTED`, the same constant the slots
                # envelope derives from). Bounding by the pool size instead
                # would let a plan ask a five-syllable line for eleven
                # distinct bound spans — arithmetic the line cannot satisfy
                # at its own minimum legal length.
                # AND THE POOL IS COUNTED IN WORDS, not in names: `end` and
                # `endword` are one word between them and so are `head`,
                # `headrime` and `T1`, so the number of names overstates what
                # a line can carry (M-80).
                pool_n = max(1, min(len({placement_word(p)
                                         for p in _PLACE_POOL(_max_token)}),
                                    MB.ADOPTED["DENSITY"][0]))
                want = {ln: rng.randint(1, pool_n) for ln in sec_lines}
                have = {ln: sum(1 for g in groups
                                for m in g
                                if int(str(m).split(".")[0]) == ln)
                        for ln in sec_lines}
                for _ in range(len(sec_lines) * pool_n):
                    short = [ln for ln in sec_lines
                             if have[ln] < want[ln]]
                    if len(short) < 2:
                        break
                    hi = min(len(short), _CAP.ADOPTED_MAX_GROUP)
                    members = rng.sample(short, rng.randint(2, hi))
                    spelled = _place_group(sorted(members), rng,
                                           _max_token, used)
                    if not spelled:
                        break
                    if spelled in groups:
                        continue
                    groups.append(spelled)
                    for ln in members:
                        have[ln] += 1

    total = line_no - 1

    # The hook SLOT: the first chorus's first line, when a chorus exists.
    # The plan writes no words, so it declares a POSITION; fill_plan
    # realises the text into the blueprint's hooks list.
    hook_slot = None
    for s in line_slots:
        if s["function"] == "chorus":
            hook_slot = s["line"]
            break

    # Structures: the pool is rows calibrated FOR ENGLISH — this planner
    # plans English songs, and a table fitted on one tradition is not
    # quietly applied to another (doctrine 8; kalevala-alliteration is
    # calibrated ("fin",) and deliberately absent here). A pool of one is
    # a forced pick and consumes no entropy.
    from quality import structures as _ST
    spool = sorted(s.name for s in _ST.STRUCTURES.values()
                   if "eng" in s.calibrated)
    struct_meta = {}
    for fn in dict.fromkeys(funcs):
        if ks[fn] == 0:
            continue
        name = spool[0] if len(spool) == 1 else rng.choice(spool)
        struct_meta[fn] = {"name": name, "chosen_from": list(spool)}

    plan = {
        "plan_version": 2,
        "request": {"form": form, "lines": lines, "seed": seed},
        "envelope": {k: (list(v) if isinstance(v, tuple) else v)
                     for k, v in ENVELOPE.items()},
        "choices": {
            "pattern": {"functions": list(funcs),
                        "chosen_from": (f"generated grammar: {len(_CELLS)} "
                                        f"cell types x "
                                        f"{ENVELOPE['body_cells']} cells, "
                                        f"optional intro/outro/coda, "
                                        f"roster {len(GENERATOR_ROSTER)} "
                                        f"of 21 functions")},
            "meter": {"value": dict(meter),
                      "slots_per_line": slots_pl,
                      "chosen_from": f"{meter_space_size()} derived cycles "
                                     f"(slots envelope "
                                     f"{list(ENVELOPE['slots_per_line'])}), "
                                     f"measured BY DERIVATION ON THE "
                                     f"DECLARED COORDINATE: 1 of {n_slots} "
                                     f"slots-per-line values, then 1 of "
                                     f"{n_fact} bars x subdivision "
                                     f"factorisation(s) of {slots_pl}, then "
                                     f"1 of {_n_compositions_23(beats)} "
                                     f"groupings of {beats}. The slots "
                                     f"count is what the envelope is stated "
                                     f"in, so it is what the draw is uniform "
                                     f"over; the pair share follows from how "
                                     f"many ways each count factorises. Unit "
                                     f"is notation, never enforced"},
            # WHERE EACH REQUIREMENT BINDS, and the MEASURE it was drawn
            # under — disclosed because it is the coordinate that stopped
            # this generator being end-rhyme-only, and because the measure
            # is a ruling the owner has not made yet.
            #
            # UNIFORM OVER THE POOL means `end` is one placement among the
            # ones this harness can grade rather than the axis everything
            # else is measured against. The consequence is stated rather
            # than buried: a two-member group is all-ends with probability
            # 1/|pool|^2, so a plain end-rhyme plan becomes RARE. That is
            # the correction taken literally; whether a song's placements
            # should instead be drawn with end as a first-class outcome is a
            # taste question, and the pool and its measure are printed here
            # so the answer can be given to a coordinate rather than to a
            # rewrite.
            "placements": {"pool": list(_PLACE_POOL(_max_token)),
                           "words": sorted(
                               {str(placement_word(p))
                                for p in _PLACE_POOL(_max_token)}),
                           "measure": "uniform per MEMBER over the pool; "
                                      "per member and not per group because "
                                      "8 of the 77 registered schemas anchor "
                                      "one member at each end of a word",
                           "token_ceiling": _max_token,
                           "token_ceiling_from":
                               "the smaller of the floor's measured "
                               f"tokens-per-line floor "
                               f"{tokens_per_line_band()[0]:.2f} and this "
                               f"plan's own shortest line ({_cap_lo} "
                               f"syllable(s) after its pickup) less one for "
                               f"the last word — a plan asks for the n-th "
                               f"word only where BOTH the calibration and "
                               f"this meter say a line carries that many"},
            "schemes": scheme_meta,
            "structures": struct_meta,
            "anacrusis": {fn: {"value": v, "chosen_from": ana_choices}
                          for fn, v in anacrusis.items()},
            "bars_per_line": bars,
            "subdivision": sub,
        },
        "total_lines": total,
        "sections": sections,
        "line_slots": line_slots,
        "hook_slot": hook_slot,
        # THE WRITER'S DECLARATION, echoed so the grading command can name
        # it and so a reader of a stored plan can see what was asked for --
        # `""` and `[]` mean NOBODY SAID, never "the default was chosen".
        "relation": relation or "",
        "functions": list(roster) if roster else [],
        #: requested functions the sampled pattern did NOT use. A DISCLOSURE,
        #: not a failure: a roster is an allow-list, and a plan that happens
        #: not to reach `bridge` this seed has not disobeyed anything. Silence
        #: here would let a writer believe they got a section they did not.
        "functions_unused": sorted(set(roster) - set(funcs)) if roster else [],
        # MEMBERS CARRY THEIR PLACEMENT since 2026-08-23: `3` is the end of
        # line 3 (what a bare number has always meant) and `3.head` is its
        # first word. `--groups=` parses both, so a plan that drew all-ends
        # is byte-identical to what this line always emitted.
        "groups": ";".join(",".join(str(x) for x in g) for g in groups),
        "returns": ";".join(f"{a},{b}" for a, b in returns),
        "subdivision": sub,
    }
    # THE JOINT GATE (`MISSING.md` M-80). Every constraint above is
    # individually legal and their CONJUNCTION is what nothing held. Asked of
    # the FINISHED dict rather than of the draw, so it is the same check a
    # hand-written plan gets and so no repair upstream can make it pass by
    # not being asked. Refused BEFORE the brief is built: a brief is what a
    # writer reads, and handing one out is the moment the plan stops costing
    # a seed and starts costing a draft.
    joint = joint_findings(plan)
    if joint:
        codes = sorted({c for c, _, _ in joint})
        raise PlanRefused(
            "this seed's constraints cannot be satisfied together — "
            + f"{len(joint)} finding(s) over {len({ln for _, ln, _ in joint})}"
            + f" line(s), {', '.join(codes)}:\n"
            + "\n".join(f"  L{ln} {code}: {detail}"
                        for code, ln, detail in joint)
            + "\nEach gate this plan passed is a separate layer and no layer "
              "held their conjunction; this one does. Try another seed.")
    plan["writer_brief"] = writer_brief(plan)
    return plan


def fill_plan(plan, lines):
    """Plan + the writer's lines -> a complete blueprint dict.

    Count mismatch is refused, not truncated: the blueprint reader correlates
    by POSITION, and a silent zip would misalign every line after the first
    difference — the same argument `quality/fit.py` makes for its own count
    refusal.
    """
    want = plan["total_lines"]
    got = [l for l in lines if l.strip()]
    if len(got) != want:
        raise PlanRefused(f"the plan declares {want} line(s) and the draft "
                          f"carries {len(got)} — they must be the same song.")
    hooks = []
    if plan.get("hook_slot"):
        hooks = [got[plan["hook_slot"] - 1]]
    return {
        "title": "",
        "hooks": hooks,
        "sections": [dict(s) for s in plan["sections"]],
        "lines": [{"text": got[s["line"] - 1], "bar": s["bar"],
                   "beat": s["beat"], "duration": s["duration"],
                   "section": s["section"]}
                  for s in plan["line_slots"]],
    }


def _pickup_phrase(beats):
    """-> the pickup clause for an anacrusis of `beats` beats.

    DERIVED FROM THE FRACTION, not looked up. It was a dict literal
    `{0.0: "", 0.5: ", half-beat pickup", 1.0: ", one-beat pickup"}`, which
    is the sub=2 grid written out — and the moment the anacrusis became a
    function of the section's OWN subdivision (2026-08-23) a legitimate
    quarter-beat pickup raised `KeyError: 0.75` from inside the report
    builder. A table standing in for arithmetic, found by widening the space
    it was silently bounding.

    Renders exact fractions rather than decimals because a pickup is a
    position on a grid: `three-quarter-beat`, not `0.75-beat`.
    """
    if not beats:
        return ""
    frac = Fraction(beats).limit_denominator(64)
    if frac.denominator == 1:
        names = {1: "one", 2: "two", 3: "three", 4: "four"}
        n = names.get(frac.numerator, str(frac.numerator))
        return f", {n}-beat pickup"
    parts = {2: "half", 3: "third", 4: "quarter", 6: "sixth", 8: "eighth"}
    unit = parts.get(frac.denominator, f"1/{frac.denominator}")
    if frac.numerator == 1:
        return f", {unit}-beat pickup"
    words = {2: "two", 3: "three", 5: "five", 7: "seven"}
    n = words.get(frac.numerator, str(frac.numerator))
    return f", {n}-{unit}-beat pickup"


def section_header(sec, slots):
    """The bracket header for one section — measurements SURFACED from the
    section's own dict and its own line slots, the same numbers the grid
    grades (the owner's rule, 2026-08-18: measured-and-followed means
    required in the output, as implementation, not prose). ONE builder
    serves the writer brief and the rendered song so the two can never
    disagree, and reading per section keeps the rows honest the day
    meters vary between sections."""
    im = sec["meter"]
    size = (f"{sec['bars']} bar{'s' if sec['bars'] != 1 else ''} "
            f"of {im['beats']}/{im['unit']}")
    if not slots:
        return f"[{sec['function'].upper()} — instrumental — {size}, no words]"
    pickup = _pickup_phrase(slots[0]["beat"] - 1)
    n = len(slots)
    return (f"[{sec['function'].upper()} — {n} "
            f"line{'s' if n != 1 else ''} — {size}{pickup}]")


def render_song(plan, lines):
    """The filled song in PERFORMANCE ORDER — every section under its own
    bracket header, every line written out in full, returns included
    verbatim, blank line between sections. This is the copy-paste
    artifact, and it is the SYSTEM'S output now: until 2026-08-18 the
    delivered song text was assembled by hand in an operator's chat
    (Undertow, Count to Five), which is the no-private-instruments flaw
    this function closes. Count mismatch refuses exactly as `fill_plan`
    does and for the same reason."""
    want = plan["total_lines"]
    got = [l for l in lines if l.strip()]
    if len(got) != want:
        raise PlanRefused(f"the plan declares {want} line(s) and the draft "
                          f"carries {len(got)} — they must be the same song.")
    out = []
    for sec in plan["sections"]:
        slots = [s for s in plan["line_slots"]
                 if s["section"] == sec["name"]]
        out.append(section_header(sec, slots))
        for s in slots:
            out.append(got[s["line"] - 1])
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def writer_brief(plan):
    """The plan as a blind writer's seed — shape and rhyme plan, nothing
    about the harness (the coverage experiment's bias rule, kept)."""
    m = plan["sections"][0]["meter"]
    out = [f"Write a song: {plan['total_lines']} lines, "
           f"{len(plan['sections'])} sections, in this order:"]
    for sec in plan["sections"]:
        slots = [s for s in plan["line_slots"]
                 if s["section"] == sec["name"]]
        out.append("  " + section_header(sec, slots))
    out.append(f"Feel: {m['beats']}/{m['unit']} grouped "
               f"{'+'.join(str(g) for g in m['groups'])}.")
    if plan["groups"]:
        out.append("Rhyme plan (line numbers over the whole song):")
        for g in plan["groups"].split(";"):
            out.append(f"  lines {g.replace(',', ' & ')} rhyme")
    rets = {fn for fn in VERBATIM_RETURNERS
            if sum(1 for s in plan["sections"]
                   if s["function"] == fn) >= 2}
    for fn in sorted(rets):
        out.append(f"Every {fn} after the first repeats the first {fn} "
                   f"word for word, line for line.")
    if plan.get("hook_slot"):
        out.append(f"Line {plan['hook_slot']} is the hook — make it the "
                   f"line someone leaves humming.")
    return "\n".join(out)


def grading_command(plan, draft_path="DRAFT.txt", bp_path="BP.json"):
    """The exact invocation that grades a draft against this plan."""
    parts = [f"python3 lyric_harness.py song {bp_path} {draft_path}"]
    if plan["groups"]:
        parts.append(f"'--groups={plan['groups']}'")
    if plan["returns"]:
        parts.append(f"'--returns={plan['returns']}'")
    # THE DECLARED RELATION REACHES THE GRADE (M-55). Without this line the
    # writer declares a relation, the plan records it, and the one command
    # that grades the draft asks the coarse `Declaration.admit` set instead —
    # a declared coordinate read by nothing, one layer out from M-54's.
    if plan.get("relation"):
        parts.append(f"'--relation={plan['relation']}'")
    parts.append(f"--subdivision {plan['subdivision']}")
    return " ".join(parts)
