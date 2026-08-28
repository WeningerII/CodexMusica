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
  envelope — and BOTH OF ITS ENDS ARE THE SAME CALIBRATED BAND READ IN
  DIFFERENT UNITS (2026-08-23, `MISSING.md` M-81(B)). CEILING, in BEATS: a
  line runs at most `DENSITY` ceiling beats, because it carries at most that
  many syllables and a sung line carries at least one syllable per beat
  (`BEATS_PER_SYLLABLE_MAX`, the one declared step in the chain). FLOOR, in
  SLOTS: a line holds at least `DENSITY` floor slots, because it must be able
  to carry the fewest syllables the band permits and a syllable occupies one
  slot. ~~the ceiling is the band's ceiling times one declared multiplier
  (`SLOTS_CEILING_X`), beyond which every band-legal line under-fills the
  grid into decoration~~ — struck: it measured emptiness in SLOTS, and a slot
  is a subdivision unit, so it called a twelve-beat line and a forty-eight-
  beat line the same thing and let one lyric line be set across two dozen
  bars.
  THE MEASURE IS BY DERIVATION, NOT BY LEAF — beats per line uniform over
  what the envelope realises, the (bars, subdivision) factorisation uniform
  over the ways to make it, the grouping exact-uniform over the resulting
  beat count's compositions. This module's own first smoke run (2026-08-18) convicted
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
import shlex
import math
import random
from fractions import Fraction
from functools import lru_cache

from quality import schemes as SC
from quality import relations as _RL
from quality import capacity as _CAP
from quality import floor as _FL
from quality import slots as _SL
from quality import meter_bands as MB
from quality import narrative as _NV

__all__ = ["PLAN_FORMS", "ENVELOPE", "EXACT_ENUM_MAX",
           "tokens_per_line_band", "gradeable_line_counts",
           "line_count_gaps", "song_line_counts", "stanza_line_floor",
           "GENERATOR_ROSTER", "ZERO_LINE_FUNCTIONS", "PlanRefused",
           "make_plan", "fill_plan", "writer_brief", "grading_command",
           "render_song", "section_header",
           "meter_dims", "meter_space_size", "bell",
           "meter_factorisations", "beats_values",
           "SWEEP_MEASURES", "SWEEP_SETS", "SWEEP_ORDERS",
           "SWEEP_OPS", "parse_sweep_want", "sweep_holds",
           "sweep",
           "BEATS_PER_SYLLABLE_MAX",
           "JOINT_CODES", "LAST_WORD", "placement_word",
           "bound_placements", "bound_token_share", "end_rhyme_groups",
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

#: ~~SLOTS_CEILING_X = 4 — the one declared multiplier in this module. The
#: slots ceiling is the density band's ceiling times this: at 4x, a line at
#: the band's own maximum fills a quarter of its grid, which is where a grid
#: stops discriminating and starts decorating.~~
#: **STRUCK AND DERIVED 2026-08-23 BY OWNER RULING ("now do B"), `MISSING.md`
#: M-81(B).** It was the last hard number in the generator, argued and never
#: measured, and it could not be measured: doctrine 4 makes a bar grid a
#: DECLARED coordinate, `quality/recover.py` REFUSES to infer one from text,
#: and audio is out of this project's vocabulary — so there is no population
#: of grids to take a fill fraction over. Its own sentence is also the reason
#: it had to go: *"a line at the band's own maximum fills a quarter of its
#: grid"* measures emptiness in SLOTS, and a slot is a subdivision unit, not
#: a unit of time. Forty-eight slots is twelve beats at subdivision 4 and
#: FORTY-EIGHT BEATS at subdivision 1, and this multiplier called those the
#: same line.
#:
#: THE ENVELOPE IS STATED IN BEATS NOW, AND BOTH OF ITS ENDS ARE THE SAME
#: CALIBRATED BAND READ IN DIFFERENT UNITS:
#:   * CEILING — a line runs at most `DENSITY` ceiling BEATS, because it
#:     carries at most that many syllables and a sung line carries at least
#:     one syllable per beat. Beyond it the beat itself is decoration: the
#:     grid is finer than the words need at EVERY level, subdivision
#:     included, and nothing about the line is being measured by counting it.
#:   * FLOOR — a line holds at least `DENSITY` floor SLOTS, because it must
#:     be able to carry the fewest syllables the band permits and a syllable
#:     occupies one slot (`fit.SLOTS_EXCEEDED`).
#: So the ceiling is a bound on TIME and the floor a bound on CAPACITY, which
#: is why they are in different units and why one multiplier could not be
#: both.
#:
#: WHAT IS CALIBRATED AND WHAT IS DECLARED, kept apart (doctrine 16/22): the
#: band `[5, 12]` syllables per line is MEASURED over 139,694 corpus lines
#: (`meter_bands.ADOPTED`, three preregistrations). The step from syllables
#: to beats is DECLARED and is `BEATS_PER_SYLLABLE_MAX` below — the one free
#: choice left in this envelope, named so it can be overruled in one line
#: rather than found in an expression.

#: THE SLOWEST LINE THE PLANNER VOLUNTEERS, in beats per syllable. 1 is the
#: IDENTITY — the point where the grid's own beat is the syllable rate — and
#: it is chosen for the reason exact equality is chosen over a threshold
#: elsewhere in this repo: it is the only value in the range that is not a
#: guess. Above 1 the planner would be volunteering held notes, which is a
#: melodic decision it has no basis to make and a writer makes for
#: themselves; a draft that holds a note is not refused by anything here.
#: A CAPACITY, NOT A REQUIREMENT (the `SPARSE` reading M-79 got wrong): the
#: ceiling is computed against the MOST syllables a line may carry, so a
#: writer who fills a twelve-beat line with five syllables gets a slow line
#: and no finding.
BEATS_PER_SYLLABLE_MAX = 1

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


def line_count_gaps(ok=None):
    """-> [(lo, hi)] runs of line counts INSIDE a set's span that no profile
    grades with teeth. Disclosed, never silently skipped.

    TAKES THE SET SINCE 2026-08-24 (`MISSING.md` M-106), defaulting to the
    union so every earlier caller reads unchanged. It has to, because the
    planner no longer draws from the union: asking this of one set and
    printing the answer beside a draw from another is the shape of defect
    doctrine 1 is about.
    """
    ok = gradeable_line_counts() if ok is None else ok
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


@lru_cache(maxsize=None)
def song_line_counts():
    """-> frozenset of line counts THE SONG PROFILE CAN GRADE WITH TEETH.

    THE HOLE IN `gradeable_line_counts()` IS AN ARTEFACT OF UNIONING THREE
    KINDS OF TEXT, AND THIS IS THE REPAIR (2026-08-24, `MISSING.md` M-106,
    the owner's standing rule *"we do not want hard numbers anywhere ... we're
    not supposed to have hard coded numbers for the line count or section
    count or the total length of the song"*).

    `gradeable_line_counts()` answers *"what line counts can ANY floor profile
    grade"* over `section` (a 4-line quatrain), `sonnet` (14 lines) and `song`
    (a lyric sheet). MEASURED, the three reach **4–5**, **12–17** and
    ~~**17–55**~~ **22–55** lines — so the union is
    ~~`{4, 5} | {12..55}`~~ `{4, 5} | {12..17} | {22..55}` and the famous
    **6–11 hole is the space between a quatrain and a sonnet**, which is not
    a fact about songs at all. A SONG planner drawing its length from that
    union was drawing from a set that contains "lengths a QUATRAIN can be"
    and "lengths a SONNET can be", and the hole it then had to reject around
    was one it created by asking the wrong question.

    REPINNED 2026-08-26 BY M-131's RE-ADOPTION (`MISSING.md` M-133): the song
    profile's band `lo` went 150 -> 200 tokens and this function READS that
    band, so the reach followed. **THE UNION GAINED A SECOND HOLE, 18–21**,
    once the song floor rose past the sonnet ceiling — the identical species
    as 6–11 at the next seam out, which is this docstring's own argument
    confirmed rather than dented: the holes are facts about which KINDS of
    text were unioned, and a moved band adds one without touching the case.

    THE SONG PROFILE ALONE IS CONTIGUOUS — ~~**17..55, 39 values**~~
    **22..55, 34 values, still no hole** — and it is the profile that grades
    the object this planner emits. The
    profile is identified by `n_lines == 0`, which is its own declaration
    that a lyric sheet has no fixed line count, and not by its name: a name
    test would be a second statement of which profile means what (doctrine
    1), and `tokens_per_line_band()` one screen up already keys on the same
    field for the opposite reason.

    WHAT THIS COSTS, SAID PLAINLY: a song of fewer than ~~17~~ **22** lines is
    now outside the planner's envelope — the cost ROSE by five lines with the
    band (M-133), and it rose in the direction this paragraph already priced.
    That is not a narrowing of the harness —
    a writer hand-declares any length and the graders grade it — it is the
    planner declining to volunteer a length the song profile cannot hold to
    anything. `gradeable_line_counts()` is UNCHANGED and still answers its
    own (different) question for any caller that wants the union.
    """
    tlo, thi = tokens_per_line_band()
    lyric = [p for p in _FL.PROFILES if not p.n_lines]
    if not lyric:
        raise PlanRefused(
            "no floor profile declares itself a whole lyric sheet "
            "(`n_lines == 0`), so a SONG length cannot be derived and this "
            "planner has no envelope to volunteer inside. A REFUSAL, not a "
            "fallback to the union: grading a song against a quatrain's "
            "calibration is the laundering doctrine 13/14 forbids.")
    out = set()
    for prof in lyric:
        out.update(range(max(1, math.ceil(prof.lo / thi)),
                         int(prof.hi // tlo) + 1))
    if not out:
        raise PlanRefused(
            "no line count lands inside the song profile's measured range.")
    return frozenset(out)


@lru_cache(maxsize=None)
def stanza_line_floor():
    """-> the fewest lines a section can carry and still BE a stanza the
    floor has calibrated.

    THE SECTION-COUNT CEILING WAS A SOUND BOUND USED AS A UNIFORM DRAW, and
    that is verbatim the error `MISSING.md` M-81(A) named one layer over.
    `_sample_pattern` took `max_cells = total` under the argument *"a song of
    T lines cannot hold more than T sung sections"* — TRUE, and never a claim
    that all T values are equally musical. MEASURED over 240 seeds: sections
    per song reached **22**, and since the total was drawn INDEPENDENTLY of
    the section count, lines-per-section is `total / sections` — a hyperbola.
    **31.5% of sung sections came out with exactly ONE line.**

    THE DERIVATION IS THE `section` PROFILE'S OWN REACH. That profile grades
    a stanza at `lo` tokens; at the derived tokens-per-line band that is
    `ceil(lo / thi)` lines — **4**. So a song of T lines can carry at most
    `T // 4` sung sections without every section being a fragment the floor
    has no calibration for. Read from the profile, never respelled.

    NOT A FLOOR ON ANY SECTION. Sections shorter than this are still
    reachable — the partition puts them there, and a one-line tag or vamp is
    a real section. What is bounded is the COUNT, which is the quantity that
    was blowing up.
    """
    tlo, thi = tokens_per_line_band()
    stanza = [p for p in _FL.PROFILES if p.n_lines]
    if not stanza:
        raise PlanRefused(
            "no floor profile declares a line count, so the size of a graded "
            "stanza cannot be derived and the section-count ceiling would be "
            "a literal.")
    return max(1, min(math.ceil(p.lo / thi) for p in stanza))


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
    # THE SONG'S OWN BAND, NOT THE UNION OF THREE TEXT KINDS (M-106). What
    # this planner emits is a lyric sheet, so the lengths it volunteers come
    # from the profile that grades one. `gradeable_line_counts()` still
    # answers its own question and is still exported; it is simply not the
    # question a SONG planner is asking.
    ok = song_line_counts()
    stanza = stanza_line_floor()
    d_lo, d_hi = MB.ADOPTED["DENSITY"]
    # TWO ENDS, ONE CALIBRATED BAND, TWO UNITS (`MISSING.md` M-81(B)). The
    # ceiling bounds TIME and the floor bounds CAPACITY, which is why the old
    # single `slots_per_line` pair could not carry both: 48 slots is twelve
    # beats at subdivision 4 and forty-eight at subdivision 1, and one
    # multiplier called those the same line.
    beats_hi = max(2, int(d_hi * BEATS_PER_SYLLABLE_MAX))
    return {
        # BEATS PER LINE = bars_per_line x beats_per_bar, and it is the
        # quantity a listener hears as the length of the line. Ceiling
        # DERIVED: a line carries at most `DENSITY` ceiling syllables and at
        # least `BEATS_PER_SYLLABLE_MAX` beat each, so it runs at most that
        # many beats. Floor: the composition grammar's own — no cycle has
        # fewer than 2 beats, and a line is at least one bar.
        "beats_per_line": (2, beats_hi),
        # SLOTS PER LINE = beats_per_line x subdivision, so the ceiling
        # FOLLOWS from the beats ceiling and the finest grid this vocabulary
        # models rather than being declared beside it. Floor DERIVED: the
        # calibrated density band's floor — fewer slots than the minimum
        # band-legal syllable count is unsatisfiable by construction, since a
        # syllable occupies one slot (`fit.SLOTS_EXCEEDED`).
        # KEPT AS AN ENTRY because `meter_dims` and the disclosure both read
        # it, and because the FLOOR genuinely lives in this unit — but it is
        # now the widest span any subdivision admits, not a bound the sampler
        # draws against (see `_sample_meter`, which draws in beats).
        "slots_per_line": (d_lo, beats_hi * max(ENVELOPE_SUBDIVISIONS)),
        # LINES PER SECTION: bounded ONLY by what the whole song may carry.
        # There is no separate per-section calibration to derive a tighter
        # bound from — the floor grades a DRAFT, not a section — so inventing
        # one would be the literal this replaced wearing a derivation. 1 is a
        # real section (a tag, a one-line vamp).
        "lines_per_section": (1, max(ok)),
        # SECTIONS: ~~a sung section carries at least one line, so a song of
        # at most `max(ok)` lines carries at most that many sung sections.~~
        # **REPINNED 2026-08-24 (M-106): that is a SOUND bound and it was
        # being used as a UNIFORM DRAW, which is M-81(A)'s error one layer
        # over.** The ceiling is now what the song can afford at the
        # calibrated stanza size — `max(ok) // stanza_line_floor()` — so a
        # section count is bounded by what makes a section a stanza rather
        # than by what makes it non-empty. 1 is still a real song.
        "sections": (1, max(1, max(ok) // stanza)),
        # TOTAL LINES: the span of the song profile's own set. The set itself
        # is what the sampler rejects against; it is CONTIGUOUS now, and the
        # 6-11 hole it used to carry belonged to the gap between a quatrain
        # and a sonnet rather than to songs (M-106).
        "total_lines": (min(ok), max(ok)),
        # subdivisions the fit layer's grid models (eighth/sixteenth pulse
        # against the beat) — a data-type set, not taste.
        "subdivisions": (1, 2, 4),
        # BARS PER LINE: bounded by the BEATS envelope it feeds. The
        # composition grammar admits no bar under 2 beats, so a line of
        # `bars` bars runs at least `2 * bars` beats and a bars count past
        # `beats_hi // 2` cannot produce a legal line at any meter.
        # ~~`hi // 2` on the SLOTS envelope~~, which read 24 and let one lyric
        # line be set across two dozen bars — the ceiling was a bound on the
        # wrong unit, and M-81(A) measured the median plan spending eight
        # bars on a line because of it.
        "bars_per_line": (1, max(1, beats_hi // 2)),
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
    dimension pair whose derived BEATS-PER-BAR range is non-empty under the
    envelope. Pure arithmetic on the envelope; the beat count needs no cap of
    its own — the beats-per-line ceiling implies one.

    BOTH ENDS COME FROM THE DENSITY BAND, in the two units M-81(B) separated:
    the floor is the CAPACITY end (this pair must be able to hold the fewest
    syllables the band permits, and a syllable occupies one slot) and the
    ceiling is the TIME end (the whole line runs at most `DENSITY` ceiling
    beats, so one bar of it runs at most that over the bar count).
    ~~`b_hi = slots_hi // (sub * bars)`~~ — struck 2026-08-23: dividing the
    SLOTS ceiling by the subdivision let a coarse grid buy length, which is
    how `bars=24, sub=1` became a legal shape for one lyric line.
    """
    d_lo = MB.ADOPTED["DENSITY"][0]
    beats_hi = ENVELOPE["beats_per_line"][1]
    dims = {}
    for bars in range(ENVELOPE["bars_per_line"][0],
                      ENVELOPE["bars_per_line"][1] + 1):
        for sub in ENVELOPE["subdivisions"]:
            b_lo = max(2, math.ceil(d_lo / (sub * bars)))
            b_hi = beats_hi // bars
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
def meter_factorisations(beats_per_line):
    """-> ((bars, subdivision), ...) every way this envelope can realise a
    line running `beats_per_line` beats.

    `beats_per_bar = beats_per_line // bars` follows, and the `>= 2` is the
    composition grammar's own floor: `_compositions_23` has no composition
    below 2, so a one-beat cycle is not a cycle here. The SUBDIVISION is
    filtered by the CAPACITY end of the envelope — a line must be able to
    hold the fewest syllables the density band permits, and a syllable
    occupies one slot, so `beats_per_line * sub` must clear the floor. That
    is why a two-beat line exists only at the finest grid: two beats of
    quarter-notes cannot carry five syllables and two beats of sixteenths
    can.
    ~~took `slots` and divided~~ — struck 2026-08-23 with M-81(B). Slots are
    subdivision units, so drawing in them made a line's LENGTH a function of
    its grid resolution: 48 slots was twelve beats at subdivision 4 and
    forty-eight at subdivision 1.
    """
    d_lo = MB.ADOPTED["DENSITY"][0]
    out = []
    for bars in range(ENVELOPE["bars_per_line"][0],
                      ENVELOPE["bars_per_line"][1] + 1):
        if beats_per_line % bars or beats_per_line // bars < 2:
            continue
        for sub in ENVELOPE["subdivisions"]:
            if beats_per_line * sub >= d_lo:
                out.append((bars, sub))
    return tuple(out)


@lru_cache(maxsize=None)
def beats_values():
    """-> the beats-per-line counts the envelope can actually REALISE.

    COMPUTED rather than assumed: the moment `bars_per_line`, `subdivisions`
    or the density floor moves, a count can stop being reachable, and a
    sampler drawing uniformly over counts it cannot realise would silently
    re-weight the ones it can.
    """
    lo, hi = ENVELOPE["beats_per_line"]
    return tuple(n for n in range(lo, hi + 1) if meter_factorisations(n))


def _sample_meter(rng):
    """One meter draw under the DERIVATION measure (module docstring).

    BEATS PER LINE FIRST, then a factorisation of it, then the grouping.
    That order is the module's own rule — *"THE MEASURE IS BY DERIVATION,
    NOT BY LEAF"* — applied to the coordinate the ENVELOPE is stated in, and
    it is the second time this file has had to learn it (`MISSING.md` M-81).
    ~~SLOTS per line first~~ (M-81(A)) got the ORDER right and the UNIT
    wrong: a slot is a subdivision unit, so 48 slots is twelve beats at
    subdivision 4 and forty-eight at subdivision 1, and drawing uniformly
    over slots made a line's length a function of its grid resolution. The
    length a listener hears is BEATS, and that is what the envelope is stated
    in now (M-81(B)).
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
    direction, not a new bias: a beat count one factorisation can make
    should not be rarer than one six can make, which is exactly what
    weighting by pair did. It is a PREDICTION rather than an accident —
    `P(bars, sub)` is computable from `meter_factorisations` alone, and
    `test_plan.py` §4 holds the sampler to it.

    Uniform over the flat enumeration remains wrong for the reason it always
    was: compositions into {2,3} grow ~1.3247^n, so leaves concentrate on
    the maximal beat count (this module's first smoke run showed it).

    A function of its own so the test file can hold the MEASURE itself to
    its prediction, not just the plans downstream of it. -> (bars, sub,
    beats, groups, (n_beat_values, n_factorisations, beats_per_line)); the
    tail is the disclosure's raw material.
    """
    vals = beats_values()
    per_line = vals[rng.randrange(len(vals))]
    fact = meter_factorisations(per_line)
    bars, sub = fact[rng.randrange(len(fact))]
    beats = per_line // bars
    groups = _composition_uniform(beats, rng)
    return bars, sub, beats, groups, (len(vals), len(fact), per_line)


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
               "WORDS_EXCEED_SPAN", "TWO_GROUPS_ONE_WORD",
               "HOOK_IN_NONRECURRING_SECTION")


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


def line_binding_ceiling(max_token):
    """-> the most DISTINCT bound spans one line may be asked for.

    A binding occupies a SPAN and distinct bindings need distinct spans, so
    the number a line can carry is bounded by its syllables — and the number
    it is GUARANTEED to carry is bounded by the fewest syllables a band-legal
    line may have, which is the calibrated density band's FLOOR. A writer may
    legally write a five-syllable line wherever the grid allows twelve, so a
    plan asking for six distinct spans has forced that writer above the band
    floor to satisfy it.

    NOT `joint_findings`' PER-LINE CEILING, WHICH IS A DIFFERENT AND WEAKER
    QUESTION. That gate asks what THIS line's own grid admits at its declared
    duration; this asks what ANY band-legal line is guaranteed to hold. The
    gate is right to use the looser one — it refuses only the arithmetically
    impossible — and the planner is right to volunteer against the tighter
    one, and the two are kept apart rather than reconciled.

    COUNTED IN WORDS, not in placement names: `end` and `endword` are one
    word between them and so are `head`, `headrime` and `T1` (M-80).

    EXTRACTED 2026-08-24 (`MISSING.md` M-107). It was spelled inline in the
    web pass, so the END-RHYME pass added beside it did not consult it and
    pushed a line to SIX bindings against a floor of five — caught by
    `test_plan.py`'s own participation check, which is exactly the shape a
    second spelling of one bound produces (doctrine 1).
    """
    return max(1, min(len({placement_word(p) for p in _PLACE_POOL(max_token)}),
                      MB.ADOPTED["DENSITY"][0]))


def plan_max_token(plan):
    """-> the highest token index this plan's lines are asked for.

    The same derivation `make_plan` makes, read off the plan so a pure
    function of the emitted dict can ask the same question: the floor's own
    measured tokens-per-line FLOOR, held under the tightest line's syllable
    ceiling so a placement never names a word past what the shortest line can
    reach.
    """
    sub = plan["subdivision"]
    caps = [line_syllable_ceiling(float(s["duration"]) * sub)
            for s in plan["line_slots"]] or [1]
    return max(1, min(int(tokens_per_line_band()[0]), int(min(caps)) - 1))


def bound_token_share(plan):
    """-> per section instance, in plan order: {"section", "function",
    "bound", "capacity", "share"} — how much of the section's token capacity
    the mandate has already spoken for (`MISSING.md` M-112).

    THE NUMBER A SESSION HAD BEEN COMPUTING BY HAND, which is the
    private-instrument shape standing rule 3 exists to end: the series'
    third song cleared every gate and the panel rejected its chorus, and
    the coordinate that separated that chorus from the rest — 23 of ~31
    sung tokens bound, against a song mean of 2.6 bound members a line —
    was derivable from the plan and disclosed by nothing.

    NUMERATOR: distinct bound WORDS per line, summed over the section —
    `bound_placements` is the one reading of `plan["groups"]` and
    `placement_word` is the one word-key (M-80: `end` and `endword` are one
    word, `head`/`headrime`/`T1` are one word). Returns are NOT counted: a
    verbatim return fixes whole LINES, a different constraint, and summing
    the two would hide which layer is heavy (doctrine 79).

    DENOMINATOR: the section's token CAPACITY — each line's
    `line_syllable_ceiling` over its own slots, summed — because a binding
    occupies a token and the ceiling is the most tokens the line may
    legally carry.

    A DISCLOSURE, NOT A GATE, and deliberately so: a ceiling needs a
    calibration, the corpus carries no mandates, and the honest route
    (recovered covers, then the share's distribution, stated as an FPR —
    doctrine 22) is a preregistration this function does not presume.
    Density is measured NOT sufficient to stand in for it (panel run 2:
    ranks 2-5 equally dense and passed), so nothing here refuses.
    """
    at = bound_placements(plan)
    sub = plan["subdivision"]
    order, per = [], {}
    for s in plan["line_slots"]:
        if s["section"] not in per:
            order.append(s["section"])
            per[s["section"]] = (s["function"], [])
        per[s["section"]][1].append(s)
    out = []
    for name in order:
        fn, ss = per[name]
        bound = sum(len({placement_word(p) for p in at.get(s["line"], [])})
                    for s in ss)
        cap = sum(int(line_syllable_ceiling(float(s["duration"]) * sub))
                  for s in ss)
        out.append({"section": name, "function": fn, "bound": bound,
                    "capacity": cap,
                    "share": round(bound / cap, 4) if cap else 0.0})
    return out


def bound_placements(plan):
    """-> {line: [placement, ...]} — every placement each line already binds.

    THE ONE READING OF `plan["groups"]` AS A PER-LINE MAP. `joint_findings`
    parsed this inline and `end_rhyme_groups` needs exactly the same answer,
    so it is a function rather than a second parse (doctrine 1): the pass that
    ADDS a binding and the gate that REFUSES one have to agree about what is
    already bound, and two spellings of "which words does this line carry" is
    how they stop agreeing.

    A member with no `.placement` is the DEFAULT SLOT — the end of the line —
    which is what a bare line number has always meant.
    """
    at = {}
    for group in str(plan.get("groups") or "").split(";"):
        for member in group.split(","):
            member = member.strip()
            if not member:
                continue
            num, _, place = member.partition(".")
            at.setdefault(int(num), []).append(place or "end")
    return at


def end_rhyme_groups(plan):
    """-> ([[line, ...]], disclosure) — END-bound groups realising each sung
    section's OWN declared scheme at the line ends, wherever the end is free.

    THE OWNER'S ASK, 2026-08-24: *"would it not be possible to take what we
    have and add a step at the end that adds rhymes to the end of the lines in
    order to follow the respective forms of the sections in a way that is
    derived from how the sections line up in our structure of the song as a
    whole for coherence?"* — and, in the same sitting and about the same
    subject, the refusal that bounds it: *"no, end should not be uniform, you
    misunderstood ... do not fuck up what we've already built."*

    SO THIS IS ADDITIVE AND NOTHING ELSE. `_place_group`'s uniform draw over
    the placement vocabulary is untouched: `end` is still one placement among
    the ones this harness can grade, drawn at the rate M-71 measured, and this
    pass never removes, re-places or re-weights a binding that draw produced.
    What it adds is a SECOND realisation of a scheme the plan has ALREADY
    DRAWN — at the ends — which is why it needs no new dice and consumes no
    seed entropy.

    IT IS A PURE FUNCTION OF THE EMITTED PLAN, like `joint_findings`, and for
    the same two reasons: it can be run against a hand-written plan on the
    same terms, and `make_plan`'s own draw cannot be what makes it work. Every
    coordinate it reads is one the plan already discloses —
    `choices["schemes"][fn]["rgs"]`, `line_slots`, `returns`, `groups`,
    `subdivision`.

    WHAT "THE RESPECTIVE FORMS OF THE SECTIONS" RESOLVES TO. Each sung
    function carries ONE drawn RGS code, so every instance of that function
    already has the same scheme SHAPE — the cross-section coherence the ask
    names is a property the planner has, not one this pass has to invent, and
    inventing a binding BETWEEN instances would be this pass deciding that two
    verses share their rhymes, which most songs do not. What is added is
    within-section: the block structure the section's own code declares,
    written at the ends where the ends are free.

    A LATER INSTANCE OF A VERBATIM RETURNER IS SKIPPED, and it is skipped by
    reading `returns` rather than by naming a function. Those lines must be
    the EARLIER LINE word for word, so a rhyme group on them declares a
    requirement about words that are already fixed — and the earlier instance
    carries the identical constraint by being the identical words, which is
    `joint_findings`' own argument for reading `groups` and not `returns`.

    THREE COUNTS, NEVER SUMMED (doctrine 79), and the last two are different
    refusals: `added` is groups emitted; `blocked` is blocks where the
    placement draw had already spent an end, which is a fact about that draw;
    `narrow` is blocks whose lines cannot carry one more distinct span — the
    participation ceiling or the line's own grid — which is a fact about the
    meter and the density band. Summing them would report a crowded line and
    a spent placement as one thing, and they are closed by different repairs.
    """
    schemes = (plan.get("choices") or {}).get("schemes") or {}
    at = bound_placements(plan)
    sub = plan["subdivision"]
    span = {s["line"]: float(s["duration"]) * sub
            for s in plan["line_slots"]}
    # THE LINES A DECLARED RETURN PINS — the LATER member of each pair.
    pinned = set()
    for cls in str(plan.get("returns") or "").split(";"):
        mem = [int(x) for x in cls.split(",") if x.strip()]
        pinned.update(mem[1:])

    ceiling = line_binding_ceiling(plan_max_token(plan))

    def _free_end(ln):
        """Can this line take an END binding it does not already carry?"""
        places = at.get(ln, [])
        words = [placement_word(p) for p in places]
        if LAST_WORD in words:
            return False
        # THE PARTICIPATION CEILING, and skipping it was this pass's own
        # first defect. A line already carrying every span a band-legal line
        # is GUARANTEED to hold cannot take another, whatever its own grid
        # admits — see `line_binding_ceiling`.
        if len(set(words)) >= ceiling:
            return False
        # THE SAME ARITHMETIC `joint_findings` REFUSES ON, asked BEFORE the
        # binding is proposed rather than after it is emitted. The last word
        # must be a different word from every numbered one, so a line already
        # naming word `top` needs `top + 1` distinct words to take an end too.
        indices = [w for w in words if w != LAST_WORD]
        top = max(indices) if indices else 0
        return max(1, top + 1) <= line_syllable_ceiling(span.get(ln, 0))

    # SECTION INSTANCES IN ORDER, keyed on the instance NAME, because the
    # scheme applies to each instance's own lines and two instances of one
    # function are two sections.
    order, per = [], {}
    for s in plan["line_slots"]:
        if s["section"] not in per:
            order.append(s["section"])
            per[s["section"]] = (s["function"], [])
        per[s["section"]][1].append(s["line"])

    out = []
    added = blocked = narrow = 0
    for name in order:
        fn, lines = per[name]
        code = (schemes.get(fn) or {}).get("rgs") or ()
        if len(lines) < 2 or len(code) != len(lines):
            continue
        if any(ln in pinned for ln in lines):
            continue
        blocks = {}
        for b, ln in zip(code, lines):
            blocks.setdefault(b, []).append(ln)
        for _b, block in sorted(blocks.items()):
            if len(block) < 2:
                continue
            room = [ln for ln in block if _free_end(ln)]
            if len(room) < 2:
                # WHICH REFUSAL, named apart. A block whose members are all
                # crowded is a meter fact; one whose ends are already spoken
                # for is a fact about the placement draw.
                if any(LAST_WORD in [placement_word(p)
                                     for p in at.get(ln, [])]
                       for ln in block):
                    blocked += 1
                else:
                    narrow += 1
                continue
            if len(room) > _CAP.ADOPTED_MAX_GROUP:
                # THE CAPACITY GATE AGAIN, and it binds here for the same
                # reason it binds the scheme sampler: a group of k members
                # needs a family the lexicon is measured to fill k of at
                # once. Trimmed rather than refused — this pass is additive,
                # so asking for less of it is a real answer where refusing
                # the whole plan would not be.
                room = room[:_CAP.ADOPTED_MAX_GROUP]
            out.append([str(ln) for ln in room])
            for ln in room:
                at.setdefault(ln, []).append("end")
            added += 1
    return out, {"added": added, "blocked": blocked, "narrow": narrow,
                 # WHICH GROUPS THIS PASS PUT THERE, and it is a disclosure
                 # rather than bookkeeping. The web pass can draw a group
                 # whose members all land on `end`, so an all-end group in
                 # the emitted plan is NOT evidence this pass produced it —
                 # MEASURED at 3 of 225 on 60 seeds. Without this a reader
                 # (and a check) can only guess which provenance a group has,
                 # and guessing is what the whole `choices` block exists to
                 # end.
                 "groups": [",".join(g) for g in out]}


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
    at = bound_placements(plan)

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

    # THE FIFTH CAUSE, and it is not per-word at all — it is the one
    # conjunction on this list a writer cannot answer BY WRITING (2026-08-23,
    # `MISSING.md` M-84). A hook slot is legal; a pattern drawing its section
    # once is legal; together they declare a hook in a section that never
    # comes back, and `grid.HOOK_DOES_NOT_RECUR` — a FLAG since the owner's
    # ruling — then charges the draft for it. No choice of words makes a
    # section recur, so this must be refused where it is DECIDABLE, which is
    # here. The line reported is the slot itself, so the refusal names the
    # position the plan was about to hand over.
    hook = plan.get("hook_slot")
    if hook:
        fn = next((s["function"] for s in plan["line_slots"]
                   if s["line"] == hook), "")
        n = sum(1 for s in plan["sections"] if s["function"] == fn)
        if n < 2:
            out.append((
                "HOOK_IN_NONRECURRING_SECTION", hook,
                f"the hook is declared at line {hook}, in {fn!r}, and this "
                f"plan draws {fn!r} {n} time(s) — a hook is defined by "
                f"RETURN, so this asks the writer for something no choice of "
                f"words can supply. Declare no hook instead (doctrine 20: "
                f"the plan says WHY in `hook_slot_refused`)."))
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

# ------------------------------------------------------- the seed sweep
#
# THE LAST PRIVATE INSTRUMENT, MADE A VERB (2026-08-23, `MISSING.md` M-82,
# owner's ruling *"make it a verb"*). CLAUDE.md's standing rule 3 named this
# one and left it: *"The seed-sweep instrument (looping `make_plan` with
# filters to find a shape) stays manual for now BY THE OWNER'S PENDING
# RULING, and is named here so it cannot become a quiet fourth instrument."*
# The ruling has been made.
#
# WHY IT IS NEEDED AT ALL, and the answer is a property of the planner rather
# than a defect in it. `--functions` is an ALLOW-LIST: it PERMITS a roster and
# cannot COMPEL a draw to use it, because compelling would mean weighting the
# dice, which is the "move 37" ban. The honest way to turn a permit into a
# compel is to DRAW AGAIN — and rejection sampling from a uniform proposal is
# uniform over the accepted set, which is the same argument `_sample_pattern`
# already makes for the placement layer. A sweep is that argument spelled as
# a command.
#
# IT DOES NOT RANK, AND THAT IS THE LOAD-BEARING REFUSAL. Doctrine 7 —
# *"enforce a floor, do not order the permitted region"* — and doctrine 19,
# on an argmax over a swept parameter being biased toward whichever end of the
# sweep has more degrees of freedom. A sweep that returned "the best seed"
# would be exactly that argmax, and the score it ranked by would be the
# weighted quality score doctrine 6 forbids. So this returns the ACCEPTED SET
# in seed order, with its acceptance RATE, and nothing else.
#
# AND IT INVENTS NO CRITERIA. Every predicate reads a coordinate the plan
# ALREADY DISCLOSES, the vocabulary is CLOSED, and there are NO DEFAULTS: a
# sweep with no predicates accepts every seed that plans at all, which is
# honest and useless and is the correct behaviour. The numbers in a predicate
# are the CALLER's — `M-55`'s own principle, that a writer saying *"I want a
# chorus and a postchorus"* is making a declaration about THIS song — and the
# owner's ban on hard numbers is a ban on them in the GENERATOR, not on a
# writer stating what they want.

#: WHAT A SWEEP MAY ASK ABOUT — CLOSED (doctrine 58: an exclusion nobody
#: writes down is a threshold nobody wrote down), and every entry a
#: coordinate the emitted plan already carries. A name outside this table
#: REFUSES and prints the table, rather than being read as a filter that
#: silently matched nothing.
#:
#: The NUMERIC measures answer `<=`, `>=` and `=`; the two SET measures answer
#: `=` alone and take a comma-separated list. `before` is the one ORDER
#: measure and takes exactly two function names.
SWEEP_MEASURES = {
    "story_lineups": ("how many legal story line-ups the shape admits "
                      "(quality/narrative.py, M-121) — `>=1` is the seed "
                      "filter for shapes that can carry a story at all",
                      lambda p: (p.get("narrative") or {}).get(
                          "lineups", 0)),
    "lines": ("the song's total line count",
              lambda p: p["total_lines"]),
    "sections": ("how many sections the pattern drew",
                 lambda p: len(p["sections"])),
    "lines_per_section": ("the SMALLEST sung section's line count — sections "
                          "carrying no lines are not counted, because a "
                          "wordless section is not a short one",
                          lambda p: min(_sweep_sung(p).values() or [0])),
    "group": ("the deepest rhyme group's member count",
              lambda p: max([len(g.split(",")) for g in
                             str(p.get("groups") or "").split(";") if g]
                            or [0])),
    "bars_per_line": ("bars per lyric line, as drawn",
                      lambda p: p["choices"]["bars_per_line"]),
    "beats_per_line": ("how many beats a lyric line runs — the length a "
                       "listener hears (`MISSING.md` M-81(B))",
                       lambda p: p["choices"]["meter"]["beats_per_line"]),
    "slots_per_line": ("the widest line's slot capacity",
                       lambda p: max([float(s["duration"]) * p["subdivision"]
                                      for s in p["line_slots"]] or [0])),
    "hook": ("the hook's line number, or 0 where this shape declares none. "
             "`hook>=1` asks for a song that HAS a hook, which since "
             "`MISSING.md` M-84 means a shape whose hook sits in a function "
             "the plan drew more than once — a hook is defined by RETURN, so "
             "before that repair this coordinate could not be asked for "
             "honestly",
             lambda p: p.get("hook_slot") or 0),
    "returns": ("how many RETURN CLASSES this plan declares — sets of lines "
                "that must come back WORD FOR WORD. `returns>=1` asks for a "
                "shape whose repeat is structural rather than something the "
                "writer has to arrange by hand, which is what makes a hook "
                "recur without a second set of rhyme pins fighting the first",
                lambda p: len([g for g in str(p.get("returns") or "").split(";")
                               if g.strip()])),
    "pins_per_line": ("the most words any one line is bound at — the "
                      "coordinate `M-79`'s Finding 3 says has none",
                      lambda p: max(_sweep_pins(p).values() or [0])),
}

#: SET measures: `uses=chorus,bridge` asks that the draw REACHED them, which
#: is the compel a roster cannot be.
SWEEP_SETS = {
    "uses": ("the functions the pattern actually drew — a roster PERMITS and "
             "this is how a caller COMPELS, by drawing again rather than by "
             "weighting the dice",
             lambda p: {s["function"] for s in p["sections"]}),
}

#: ORDER measures: `before=verse,chorus` asks that the first instance of the
#: first name precedes the first instance of the second.
#:
#: NOTE WHAT THIS IS NOT. `FORM_TENDENCIES` records that a verse precedes the
#: first chorus in 137 of 178 corpus songs and is DELIBERATELY NOT ENFORCED,
#: because a planner refusing the other 41 would refuse a quarter of the
#: corpus it was measured on. Nothing here changes that: the planner still
#: draws both orders, and a CALLER asking for one is declaring what they want
#: for THIS song. A default here would be the rate-matching that paragraph
#: refuses.
SWEEP_ORDERS = {
    "before": "the first instance of A precedes the first instance of B",
}

SWEEP_OPS = ("<=", ">=", "=")


def _sweep_sung(plan):
    """-> {section name: line count} for sections that carry lines."""
    out = {}
    for s in plan["line_slots"]:
        out[s["section"]] = out.get(s["section"], 0) + 1
    return out


def _sweep_pins(plan):
    """-> {line: how many words this line is bound at}."""
    out = {}
    for group in str(plan.get("groups") or "").split(";"):
        for member in group.split(","):
            member = member.strip()
            if member:
                ln = int(member.partition(".")[0])
                out[ln] = out.get(ln, 0) + 1
    return out


def parse_sweep_want(text):
    """'sections<=6' -> ('sections', '<=', '6'). REFUSES anything else.

    The refusal prints the vocabulary, because a predicate silently read as
    matching nothing and a predicate that refuses look identical in the
    accepted set — and the first would have a caller believe their
    declaration was applied (doctrine 20).
    """
    raw = str(text).strip()
    for op in SWEEP_OPS:
        name, sep, val = raw.partition(op)
        if not sep:
            continue
        name, val = name.strip(), val.strip()
        known = set(SWEEP_MEASURES) | set(SWEEP_SETS) | set(SWEEP_ORDERS)
        if name not in known:
            raise PlanRefused(
                f"{raw!r} asks about {name!r}, which is not a coordinate a "
                f"sweep can read. Declared: "
                f"{', '.join(sorted(known))}.")
        if name in SWEEP_SETS or name in SWEEP_ORDERS:
            if op != "=":
                raise PlanRefused(
                    f"{raw!r}: {name!r} answers '=' and nothing else — it "
                    f"names functions, and functions do not compare.")
        elif not val.lstrip("-").isdigit():
            raise PlanRefused(
                f"{raw!r}: {name!r} is a count and {val!r} is not an "
                f"integer.")
        if not val:
            raise PlanRefused(f"{raw!r} declares no value.")
        return name, op, val
    raise PlanRefused(
        f"{raw!r} carries none of {', '.join(SWEEP_OPS)}. A predicate is "
        f"NAME<=N, NAME>=N or NAME=VALUE.")


def sweep_holds(plan, want):
    """-> True if this plan satisfies one parsed predicate."""
    name, op, val = want
    if name in SWEEP_ORDERS:
        a, _, b = val.partition(",")
        fns = [s["function"] for s in plan["sections"]]
        if a.strip() not in fns or b.strip() not in fns:
            return False
        return fns.index(a.strip()) < fns.index(b.strip())
    if name in SWEEP_SETS:
        have = SWEEP_SETS[name][1](plan)
        return all(x.strip() in have for x in val.split(",") if x.strip())
    got, n = SWEEP_MEASURES[name][1](plan), int(val)
    return got <= n if op == "<=" else got >= n if op == ">=" else got == n


def sweep(seeds, wants=(), **plan_kw):
    """-> {accepted, refused, planned, wants, seeds} over a declared range.

    REJECTION, NOT SELECTION (doctrine 7). `accepted` is every seed whose
    plan satisfies every predicate, IN SEED ORDER — no ranking, no score, no
    "best". A sweep that ordered the permitted region would be the argmax
    doctrine 19 refuses and the weighted quality score doctrine 6 forbids.

    THREE COUNTS, NEVER SUMMED (doctrine 79): `planned` is how many seeds
    produced a plan at all, `refused` how many `make_plan` itself turned down
    (an unattainable request, or the joint gate), and `accepted` how many of
    the planned ones the predicates kept. A refusal is not a rejection and
    charging one to the other would blame the predicates for the envelope.

    A PLAN IS A PURE FUNCTION OF ITS SEED, so this returns SEEDS and no
    plans: the caller runs `plan --seed=N` on one and gets the artifact,
    reproducibly, with nothing carried over from the search.
    """
    seeds = list(seeds)
    accepted, planned, refused = [], 0, 0
    for s in seeds:
        try:
            p = make_plan(seed=s, **plan_kw)
        except PlanRefused:
            refused += 1
            continue
        planned += 1
        if all(sweep_holds(p, w) for w in wants):
            accepted.append(s)
    return {"accepted": accepted, "planned": planned, "refused": refused,
            "wants": list(wants), "seeds": len(seeds)}


def make_plan(seed, form="verse-chorus", lines=None, relation=None,
              functions=None, title=None, narrative=None):
    """A request -> the plan dict. Refuses rather than guessing.

    `relation`, `functions` and `title` are THE WRITER'S DECLARATION
    (`MISSING.md` M-55) and none of them is sampled. ~~The planner does
    not pick a relation: doing so would put `type:pararhyme` on a group
    nobody asked for, which is the "move 37" ban pointed at rhyme instead
    of at shape.~~ SUPERSEDED BY OWNER RULING 2026-08-25 (M-117, doctrine
    17 keeps the strike visible): when the writer declares NOTHING, each
    group now DRAWS its relation uniformly over the certified pool
    (`relations.DRAWABLE_SCHEMAS`) — a uniform draw over a witness-
    certified vocabulary is the planner's ordinary dice, not move 37,
    which bans sampling MEASURED corpus distributions. The struck
    sentence's live half survives as precedence: a writer's declaration
    is CARRIED into the plan artifact and SILENCES the draw, so the one
    command that grades the draft names the relation the writer chose.

    THREE LAYERS, AND ONLY THE MIDDLE ONE IS HERE (design doc §2):
    the VOCABULARY says a prechorus requires a chorus and that is
    definitional; the CONVENTION says verse-chorus-verse-chorus and is never
    enforced; and this is the DECLARATION — "chorus and postchorus, no
    prechorus" — which is neither, and had no way to be spelled at all.

    `title` JOINED 2026-08-24. `grid.py`'s `hook_findings` asks "is the title
    in the hook?" and refuses (`TITLE_UNDECLARED`) when `Song.title` is
    empty, and `fill_plan` wrote `"title": ""` into every blueprint it has
    ever built -- so the ONLY way to answer that question was to hand-patch
    the JSON after the planner wrote it. That is standing rule 3's own case:
    a step used in producing a delivered song, with no entrance the system
    owns. It is carried, never inferred: guessing a title off the first line
    is exactly the inference `TITLE_UNDECLARED` exists to refuse, so `None`
    stays `""` and the finding stays.
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
    _GRADEABLE = song_line_counts()
    _STANZA = stanza_line_floor()
    k_lo, k_hi = ENVELOPE["lines_per_section"]
    for _attempt in range(500):
        # THE LENGTH FIRST. It is the coordinate that decides what the floor
        # can grade, so it is drawn from the gradeable set before anything
        # is conditioned on it — and it then BOUNDS the pattern, since a
        # song of T lines cannot carry more than T sung sections.
        total = rng.choice(sorted(_GRADEABLE))
        # THE CELL CEILING IS WHAT THIS SONG CAN AFFORD AT THE CALIBRATED
        # STANZA SIZE, not what it can afford at one line each (M-106).
        # `total` alone is a SOUND bound — a song of T lines cannot hold more
        # than T sung sections — and using it as the ceiling of a uniform
        # draw made 31.5% of sung sections one line long, because the total
        # was drawn INDEPENDENTLY of the count it was then divided among.
        # `stanza_line_floor()` is read from the `section` profile's own
        # measured range, so this is a derivation and not a tuning.
        _cells_hi = max(1, total // _STANZA)
        try:
            funcs = _sample_pattern(rng, roster, form=form,
                                    max_cells=_cells_hi)
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
        # THE SET, NOT THE SPAN. ~~`gradeable_line_counts()` is not
        # contiguous — 6 to 11 lines lands between the section profile's
        # reach and the sonnet's~~ — **and `song_line_counts()` IS contiguous
        # (M-106): that hole was the gap between a quatrain and a sonnet and
        # was never a fact about songs.** The set test is KEPT anyway, because
        # what makes it correct is that the set is the authority and the span
        # is a rendering of it — a span test would go wrong silently the day
        # a second lyric-sheet profile is calibrated at another length.
        # Rejection against the set keeps the draw uniform over what is
        # ACCEPTED, the same argument the placement layer's rejection
        # sampling makes.
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
            f" MINUS the uncalibrated runs "
            f"{line_count_gaps(song_line_counts())}, which the song profile "
            f"does not grade with teeth"
            f"{', exact total ' + str(lines) if lines is not None else ''}) "
            f"— try another seed, drop --lines, or declare the shape by "
            f"hand.")

    bars, sub, beats, groups_m, (n_beats, n_fact, beats_pl) = \
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
                pool_n = line_binding_ceiling(_max_token)
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

    # The hook SLOT: the first line of the first instance of a function this
    # plan actually DREW MORE THAN ONCE. The plan writes no words, so it
    # declares a POSITION; fill_plan realises the text into the blueprint's
    # hooks list.
    #
    # RECURRENCE IS THE WHOLE CONDITION (2026-08-23, `MISSING.md` M-84, owner's
    # ruling *"promote HOOK_DOES_NOT_RECUR to a flag"*). This read
    # ~~`s["function"] == "chorus"`~~ and stopped, never asking whether that
    # chorus COMES BACK — so a hook was declared in a section drawn once in
    # **219 of 400 seeds (54.8%)**, every one of them a chorus. Once the code
    # is a flag that is a requirement NO WRITER CAN MEET: no choice of words
    # makes a section recur, and `grid`'s own message says so — *"A hook is
    # defined by RETURN; one occurrence is a phrase."* Individually the hook
    # slot is legal and the one-chorus pattern is legal; their CONJUNCTION is
    # unwritable, which is `joint_findings`' subject one layer out.
    #
    # THE PREFERENCE IS THE VOCABULARY'S, NOT A LITERAL. `chorus` wins when a
    # recurring one is present because `FunctionSpec.returns_as` says it
    # returns VERBATIM — its gloss is *"the returning section; the one place
    # where REPEAT is the requirement rather than the violation"* — and any
    # other actually-recurring sung function is taken over declaring nothing.
    # Reading the drawn `sections` costs no entropy, so every seed's groups,
    # meter and schemes are byte-identical either side of this repair.
    from quality import grid as _GR   # lazy, as everywhere else in this file
    drawn = {}
    for s in sections:
        drawn[s["function"]] = drawn.get(s["function"], 0) + 1
    recurs = {fn for fn, n in drawn.items()
              if n > 1 and fn not in WORDLESS_FUNCTIONS}
    verbatim = {fn for fn in recurs
                if getattr(_GR.SECTION_FUNCTIONS.get(fn), "returns_as", "")
                == "verbatim"}
    hook_slot, hook_refused = None, ""
    for pool in (verbatim, recurs):
        for s in line_slots:
            if s["function"] in pool:
                hook_slot = s["line"]
                break
        if hook_slot:
            break
    if hook_slot is None:
        # A REFUSAL IS NOT AN ABSENCE (doctrine 20). Silence here would read
        # as "this shape has no hook worth naming"; the truth is that nothing
        # in it comes back, so no position can carry one.
        hook_refused = (
            "no function this pattern drew occurs more than once, and a hook "
            "is defined by RETURN — so this shape declares no hook rather "
            "than naming a position no writer could make recur "
            "(`grid.HOOK_DOES_NOT_RECUR`)")

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
                      "beats_per_line": beats_pl,
                      "slots_per_line": beats_pl * sub,
                      "chosen_from": f"{meter_space_size()} derived cycles "
                                     f"(beats envelope "
                                     f"{list(ENVELOPE['beats_per_line'])}, "
                                     f"slots envelope "
                                     f"{list(ENVELOPE['slots_per_line'])}), "
                                     f"measured BY DERIVATION ON THE "
                                     f"DECLARED COORDINATE: 1 of {n_beats} "
                                     f"beats-per-line values, then 1 of "
                                     f"{n_fact} bars x subdivision "
                                     f"factorisation(s) of {beats_pl} beats, "
                                     f"then 1 of {_n_compositions_23(beats)} "
                                     f"groupings of {beats}. The line runs "
                                     f"{beats_pl} beat(s) — at most the "
                                     f"density band's ceiling, since a sung "
                                     f"line carries at least one syllable a "
                                     f"beat — and holds {beats_pl * sub} "
                                     f"slot(s), at least the band's floor. "
                                     f"Both ends are the same calibrated "
                                     f"band in different units; the pair "
                                     f"share follows from how many ways each "
                                     f"beat count factorises. Unit is "
                                     f"notation, never enforced"},
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
        # WHY there is none, when there is none — never silence (doctrine 20).
        # "" means a hook WAS declared; a sentence means the shape could not
        # carry one and says what about the shape stopped it.
        "hook_slot_refused": hook_refused,
        # THE WRITER'S DECLARATION, echoed so the grading command can name
        # it and so a reader of a stored plan can see what was asked for --
        # `""` and `[]` mean NOBODY SAID, never "the default was chosen".
        "relation": relation or "",
        #: `""` means NOBODY DECLARED A TITLE, and `fill_plan` writes that
        #: straight through so `TITLE_UNDECLARED` fires exactly as it did
        #: before this coordinate existed.
        "title": title or "",
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
    # THE END-RHYME PASS (`MISSING.md` M-107, the owner's ask). A SECOND
    # realisation of each sung section's own already-drawn scheme, written at
    # the line ENDS wherever the end is free — additive, seedless, and
    # touching no coordinate the placement draw produced. It runs HERE, on
    # the finished dict and before the joint gate, for the two reasons that
    # gate itself runs where it does: it is then a pure function of what the
    # plan says rather than of what the loop had in scope, and whatever it
    # adds is put through the SAME refusal everything else passed.
    _end_add, _end_say = end_rhyme_groups(plan)
    if _end_add:
        groups = list(groups) + _end_add
        plan["groups"] = ";".join(",".join(str(x) for x in g)
                                  for g in groups)
    plan["choices"]["end_rhyme"] = dict(
        _end_say,
        chosen_from="NOT A DRAW — each sung section's own `schemes[fn].rgs` "
                    "re-realised at the line ends, so this consumes no seed "
                    "entropy and the placement draw above is untouched. "
                    "Three counts, never summed (doctrine 79): `added` "
                    "groups emitted; `blocked` blocks whose ends the "
                    "placement draw had already spent; `narrow` blocks whose "
                    "lines cannot carry one more DISTINCT word.")

    # THE RELATION DRAW — 2026-08-25, OWNER RULING ("now do the planner
    # too"; `MISSING.md` M-117, the planner half of M-116's
    # whole-vocabulary default). Each group draws its relation uniformly
    # over the bare default plus the CERTIFIED drawable pool —
    # `relations.DRAWABLE_SCHEMAS`, the schemas a declared English witness
    # proves a writer can satisfy (the capacity layer's certification
    # idiom: the pool grows by growing the witness, never by hand-editing
    # the tuple; `derive_drawable_schemas` is the derivation and
    # `test_plan.py` re-derives the adoption). THE WRITER'S OWN
    # `--relation=` WINS: when one is declared the planner draws nothing,
    # because a declared coordinate is carried, never sampled over (M-55).
    # Uniform means the bare default is RARE — one draw in
    # len(pool)+1 — which is the same consequence the placement draw's
    # `end` share carries, disclosed the same way; reweighting it is the
    # owner's call, not this draw's (doctrine 19: the dice stay flat).
    # This runs AFTER the end-rhyme pass so the added end groups draw too,
    # and consumes entropy strictly AFTER every existing draw, so a seed's
    # shape under the old planner is byte-identical under this one.
    # THE CONJUNCTION GATE ON THE DRAW ITSELF (M-118, filed the hour the
    # first drawn plan was read): measured over seeds 4-43 before this
    # filter, 39 OF 40 seeds drew a jointly unsatisfiable schema
    # conjunction — a gap-limited schema on a pair its own placement rule
    # forbids (pantun ABAB spans at most 2 lines and the draw put it on a
    # gap of 8), or two groups SHARING a line pair whose schemas demand
    # opposite predicates on one channel (monorhyme's coda-Agree against
    # assonance's coda-Differ on the same two end words). Every constraint
    # was individually legal and nothing held their conjunction — M-79's
    # finding replayed one coordinate over, and the same repair: filter
    # the pool per group by what is decidable WITHOUT WORDS, draw uniform
    # over the ACCEPTED subset (rejection keeps the dice flat — the
    # planner's own idiom), and let the bare default — compatible with
    # everything, since the whole-vocabulary fan satisfies it on any
    # relation — keep the pool non-empty by construction. The channel
    # signature is approximate on purpose (scope subtleties are not read);
    # the GRADER stays the final word, and this gate only removes draws
    # that are unsatisfiable on the registry's own declared coordinates.
    drawn_relations = {}
    if not relation:
        _traits = _RL.drawable_traits()
        _grp_lines = [sorted({int(str(m).split(".")[0])
                              for m in g.split(",")})
                      for g in ";".join(
                          ",".join(str(x) for x in g) for g in groups
                      ).split(";")]
        # M-119 widened the claim ledger to two stores; M-122 REBUILT IT
        # AS A GRAPH, found designing the first paired-experiment song:
        # `adjacent_lines` is a gap constraint spelled as a placement
        # KIND (interlaced rhyme drew onto non-adjacent groups on 117
        # pairs over sixty seeds), and EQUALITY IS TRANSITIVE where a
        # per-pair ledger is not — rime riche equated an anchor coda,
        # semirhyme equated it one pair over, and assonance demanded the
        # chain's two ends differ (32 such contradictions over the same
        # sixty seeds; 53 of 60 seeds carried one shape or the other).
        # Claims now ride (channel, syllable-coordinate) keys from
        # `drawable_traits`; Agree edges union per key, Differ edges are
        # checked against the closure, and everything that is neither
        # keeps the old exact-match rule per pair.
        # M-123, found the hour the M-122 gate first emitted seed 32's
        # demand sheet: a DIFFER CLAIM IS A DISEQUALITY CLIQUE AND A
        # CLIQUE NEEDS ONE VALUE PER MEMBER, so a channel's finite value
        # domain caps the group — light rhyme's `prominence Differ`
        # rides a channel the eng phonology constructs BINARY, capping
        # its groups at TWO, and the draw had put it on a group of
        # seven (74 impossible cliques over seeds 1-60, 40 of 60 seeds;
        # the production judge confirmed the pigeonhole on a declared
        # 3-member group before the repair was designed). The cap reads
        # `relations.CHANNEL_DOMAINS` (adopted, measured over the full
        # lexicon), and for a BINARY domain the closure is a PARITY
        # union-find — Agree is a parity-0 edge, Differ a parity-1
        # edge, and a cycle that forces both refuses the candidate —
        # which also catches cross-group odd cycles no clique cap sees.
        # A channel absent from the table stays a plain disequality
        # edge, so the gate can only miss a cap, never invent one.
        # M-125(b): THE FLOOR'S OWN CEILING BOUNDS THE DRAW. An anaphora
        # group forces every one of its lines to OPEN with one word — the
        # schema judges line-initial tokens, whatever the slots say — and
        # groups sharing a line UNION into one forced-opener class, so the
        # draw was able to force 9 of 21 identical openers while the
        # floor's calibrated ANAPHORA_OVERLOAD (a FLAG at the human 95th
        # percentile) refuses anything past its `anaphora_max` share: a
        # demand sheet no writing could pass, found on this seed 32 draft.
        # The ceiling is READ from the floor's lyric-sheet profile — the
        # one identified by its own n_lines == 0, never by name (M-106) —
        # so there is exactly one definition of the threshold, and the
        # forced-opener classes are the (token, head) Agree components the
        # claim ledger already carries (M-119's head claims).
        _aprof = next(p for p in _FL.PROFILES if p.n_lines == 0)
        _acap = int(_FL.FloorDeclaration().resolve("anaphora_max", _aprof)
                    * total + 1e-9)
        _pairc = {}
        _eqp = {}
        _nep = {}

        def _pfind(par, x):
            p = 0
            while True:
                nx, xp = par.get(x, (x, 0))
                if nx == x:
                    return x, p
                x, p = nx, p ^ xp

        for _gi in range(len(groups)):
            _lines = _grp_lines[_gi]
            _pairs = [(a, b) for i2, a in enumerate(_lines)
                      for b in _lines[i2 + 1:]]
            # M-149(a): A GROUP BINDING DECLARED TOKENS IS JUDGED BY THE
            # PAIR ROUTE, and that route refuses by name every schema whose
            # member spans cannot bind ONE token (`free_run` searches
            # windows, `line_head_index` reads its own magnitude, a
            # searched anchor carries k hypotheses no mandated pair can
            # correct for). Seed 28 drew 8 of its 25 groups into exactly
            # that conjunction — disclosed refusals no writing can close
            # and no writer asked for. The draw consults the judge's own
            # predicate (`relations.pair_bindable`, the ONE definition —
            # doctrine 1), so a shape-refused (draw, placement) pair is
            # unsampleable BY CONSTRUCTION; the unbindable schemas stay
            # drawable at DEFAULT slots, where the instances route judges
            # them at their own loci. A member spelled `<line>.end` IS the
            # default slot in a different coat and does not restrict.
            _slotted_g = any(
                "." in str(_m2) and str(_m2).split(".", 1)[1] != "end"
                for _m2 in groups[_gi])
            _ok = [""]
            for _cand in _RL.DRAWABLE_SCHEMAS:
                if _slotted_g and not _RL.pair_bindable(
                        _RL.REGISTRY[_cand]):
                    continue
                _t = _traits[_cand]
                if _t["gap"] is not None and any(
                        b - a > _t["gap"] for a, b in _pairs):
                    continue
                _bad = False
                for _ch, _co, _pr in _t["claims"]:
                    if any(_pairc.get((_p, _ch, _co)) not in (None, _pr)
                           for _p in _pairs):
                        _bad = True
                        break
                    _dom = _RL.CHANNEL_DOMAINS.get(_ch)
                    if (_pr == "Differ" and _dom is not None
                            and len(_lines) > len(_dom)):
                        _bad = True
                        break
                if _bad:
                    continue
                _by = {}
                for _ch, _co, _pr in _t["claims"]:
                    if _pr in ("Agree", "Differ"):
                        _by.setdefault((_ch, _co), set()).add(_pr)
                for _key, _prs in sorted(_by.items()):
                    _par = dict(_eqp.get(_key, ()))
                    _ne2 = list(_nep.get(_key, ()))
                    _dom = _RL.CHANNEL_DOMAINS.get(_key[0])
                    _binary = _dom is not None and len(_dom) == 2
                    for _w, _on in ((0, "Agree" in _prs),
                                    (1, "Differ" in _prs and _binary)):
                        if _bad or not _on:
                            continue
                        for _a, _b in _pairs:
                            _ra, _pa = _pfind(_par, _a)
                            _rb, _pb = _pfind(_par, _b)
                            if _ra == _rb:
                                if _pa ^ _pb != _w:
                                    _bad = True
                                    break
                            else:
                                _par[_ra] = (_rb, _pa ^ _pb ^ _w)
                    if _bad:
                        break
                    if "Differ" in _prs and not _binary:
                        _ne2.extend(_pairs)
                    for _a, _b in _ne2:
                        _ra, _pa = _pfind(_par, _a)
                        _rb, _pb = _pfind(_par, _b)
                        if _ra == _rb and not (_pa ^ _pb):
                            _bad = True
                            break
                    if _bad:
                        break
                    if _key == ("token", "head") and "Agree" in _prs:
                        # M-125(b): forced-opener classes may not outgrow
                        # the floor's own ANAPHORA_OVERLOAD share. A root
                        # appears only as a parent VALUE, so the node set
                        # is keys + parents + this candidate's endpoints.
                        _nodes = (set(_par)
                                  | {pp[0] for pp in _par.values()}
                                  | {x for pp in _pairs for x in pp})
                        _sz = {}
                        for _n in _nodes:
                            _r, _ = _pfind(_par, _n)
                            _sz[_r] = _sz.get(_r, 0) + 1
                        if _sz and max(_sz.values()) > _acap:
                            _bad = True
                            break
                if _bad:
                    continue
                _ok.append(_cand)
            _pick = _ok[rng.randrange(len(_ok))]
            if _pick:
                drawn_relations[SC.label((_gi,))] = "schema:" + _pick
                for _ch, _co, _pr in _traits[_pick]["claims"]:
                    for _p in _pairs:
                        _pairc[(_p, _ch, _co)] = _pr
                    _key = (_ch, _co)
                    _dom = _RL.CHANNEL_DOMAINS.get(_ch)
                    _binary = _dom is not None and len(_dom) == 2
                    if _pr == "Agree" or (_pr == "Differ" and _binary):
                        _w = 0 if _pr == "Agree" else 1
                        _par = _eqp.setdefault(_key, {})
                        for _a, _b in _pairs:
                            _ra, _pa = _pfind(_par, _a)
                            _rb, _pb = _pfind(_par, _b)
                            if _ra != _rb:
                                _par[_ra] = (_rb, _pa ^ _pb ^ _w)
                    elif _pr == "Differ":
                        _nep.setdefault(_key, []).extend(_pairs)
    plan["relations"] = drawn_relations
    plan["choices"]["relations"] = {
        "chosen_from": (
            "NOT DRAWN — the writer declared --relation and a declared "
            "coordinate is carried, never sampled over (M-55)" if relation
            else f"uniform per group over the bare default plus the "
                 f"{len(_RL.DRAWABLE_SCHEMAS)} certified drawable schemas "
                 f"(relations.DRAWABLE_SCHEMAS, witness-certified — "
                 f"M-117). The bare default lands on 1 draw in "
                 f"{len(_RL.DRAWABLE_SCHEMAS) + 1}, a rarity this "
                 f"disclosure exists to hand the owner, exactly as the "
                 f"placement draw's `end` share was. A group binding "
                 f"declared tokens draws only from the schemas the pair "
                 f"route can bind there (relations.pair_bindable, "
                 f"M-149a); the rest stay drawable at default slots"),
        "value": dict(drawn_relations)}

    # THE JOINT GATE (`MISSING.md` M-80). Every constraint above is
    # individually legal and their CONJUNCTION is what nothing held. Asked of
    # the FINISHED dict rather than of the draw, so it is the same check a
    # hand-written plan gets and so no repair upstream can make it pass by
    # not being asked. Refused BEFORE the brief is built: a brief is what a
    # writer reads, and handing one out is the moment the plan stops costing
    # a seed and starts costing a draft.
    #
    # AND IT IS WHAT GATES THE END PASS TOO. That pass proposes; this
    # refuses. Its own precondition is arranged to satisfy this by
    # construction — the same relationship the placement draw has — so a
    # finding here from an added end group is a defect in the pass and not a
    # property of the seed.
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

    # THE NARRATIVE COLLAPSE (M-121, the joker card played). One atom per
    # sung section, one junction per seam, drawn UNIFORM over the legal
    # story line-ups of THIS shape — or carried from the writer, who
    # silences the draw (M-117's precedence, ruled again for this
    # coordinate). Entropy is consumed LAST, after every existing draw
    # and after the joint gate, so seed shapes, relation draws and
    # refusals are byte-identical to the pre-narrative planner. A shape
    # admitting NO line-up is DISCLOSED and still ships: the sound plan
    # is writable, the story layer simply has nothing to ask, and the
    # harm-check registration records such seeds as refused-by-layer for
    # the experiment without costing the planner one (doctrine 20 — a
    # disclosure, not an absence). No grader reads this coordinate: the
    # brief is the carrier and the enforcement split is step 5's, after
    # its own sitting.
    _fns = [s["function"] for s in plan["sections"]]
    if narrative == "off":
        plan["narrative"] = {"mode": "off"}
    elif narrative is not None:
        _probs = _NV.validate_lineup(
            _fns, narrative.get("atoms", ()), narrative.get("junctions", ()))
        if _probs:
            raise PlanRefused(
                "the declared narrative line-up is illegal for this "
                "shape:\n" + "\n".join("  " + p for p in _probs)
                + "\nA declared coordinate is carried, never resampled — "
                  "fix the declaration or drop it and the planner draws.")
        _pos, _sfns = _NV.sung_sequence(_fns)
        plan["narrative"] = {
            "mode": "declared",
            "lineups": _NV.count_lineups(_fns),
            # a declaration may spell bare atoms/junctions (the CLI's
            # grammar) or full triples (the API's); both are stored as
            # the triples the brief and the validator read.
            "atoms": [
                list(a) if isinstance(a, (list, tuple))
                else [_pos[k], _sfns[k], a]
                for k, a in enumerate(narrative["atoms"])],
            "junctions": [
                list(j) if isinstance(j, (list, tuple))
                else [_pos[k], _pos[k + 1], j]
                for k, j in enumerate(narrative["junctions"])]}
    else:
        _n_lineups = _NV.count_lineups(_fns)
        if _n_lineups:
            _lu = _NV.draw_lineup(_fns, rng)
            plan["narrative"] = {"mode": "drawn", "lineups": _n_lineups,
                                 "atoms": _lu["atoms"],
                                 "junctions": _lu["junctions"]}
        else:
            plan["narrative"] = {
                "mode": "none", "lineups": 0,
                "reason": "this shape admits NO story line-up under the "
                          "ruled vocabulary — its opening section demands "
                          "an atom that needs a past, or no legal junction "
                          "chain survives. The sound plan is unaffected; "
                          "the writer writes unguided on this axis."}
    plan["choices"]["narrative"] = {
        "chosen_from": (
            "NOT DRAWN — the writer declared the line-up and a declared "
            "coordinate is carried, never sampled over" if narrative
            not in (None,) and narrative != "off" else
            "narrative=off — the writer silenced the layer" if
            narrative == "off" else
            f"uniform over the {plan['narrative'].get('lineups', 0)} "
            f"legal story line-ups of this shape (quality/narrative.py, "
            f"M-121; the count is exact and the draw is entropy-last)"),
        "value": {k: v for k, v in plan["narrative"].items()
                  if k != "reason"}}
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
        # CARRIED FROM THE PLAN, not re-derived and never guessed: this was
        # the literal `""` that made `TITLE_UNDECLARED` unanswerable through
        # the verbs (see `make_plan`). A plan with no declared title still
        # writes `""` here, so the finding is unchanged for anyone who does
        # not declare one.
        "title": plan.get("title") or "",
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
        rels = plan.get("relations") or {}
        out.append("Rhyme plan (line numbers over the whole song):")
        for gi, g in enumerate(plan["groups"].split(";")):
            name = rels.get(SC.label((gi,)))
            if name:
                out.append(f"  lines {g.replace(',', ' & ')} stand in "
                           f"{name.split(':', 1)[1]} — a NAMED relation, "
                           f"judged as itself, not as plain rhyme")
            else:
                out.append(f"  lines {g.replace(',', ' & ')} rhyme")
    nar = plan.get("narrative") or {}
    if nar.get("mode") in ("drawn", "declared"):
        atom_say = {
            "ESTABLISH": "puts the world and its cast in place",
            "COMPLICATE": "lets the pressure in",
            "TURN": "flips the reading of everything before it",
            "DWELL": "holds the moment and deepens it, without advancing",
            "ANCHOR": "is the fixed claim the song keeps returning to",
            "JUDGE": "is a compressed verdict on what has happened",
            "RESOLVE": "cashes the standing pressure",
            "DEPART": "is the leave-taking — the walk home"}
        junc_say = {
            "THEREFORE": "because of", "BUT": "against",
            "AND_THEN": "after", "MEANWHILE": "elsewhere during",
            "ELABORATE": "deeper into",
            "JUXTAPOSE": "set beside (connection unstated)"}
        names = [s["name"] for s in plan["sections"]]
        inbound = {b: (a, j) for a, b, j in nar["junctions"]}
        out.append("Story plan (one job per sung section; each enters "
                   "from the section before it as stated):")
        for idx, _fn, atom in nar["atoms"]:
            line = f"  {names[idx]} {atom_say[atom]}"
            if idx in inbound:
                a, j = inbound[idx]
                line += f" — {junc_say[j]} {names[a]}"
            out.append(line)
    elif nar.get("mode") == "none":
        out.append("NO STORY PLAN: this shape carries no legal story "
                   "line-up, so nothing is asked of the meaning axis.")
    rets = {fn for fn in VERBATIM_RETURNERS
            if sum(1 for s in plan["sections"]
                   if s["function"] == fn) >= 2}
    for fn in sorted(rets):
        out.append(f"Every {fn} after the first repeats the first {fn} "
                   f"word for word, line for line.")
    if plan.get("hook_slot"):
        out.append(f"Line {plan['hook_slot']} is the hook — make it the "
                   f"line someone leaves humming.")
    elif plan.get("hook_slot_refused"):
        out.append(f"NO HOOK IS DECLARED: {plan['hook_slot_refused']}.")
    return "\n".join(out)


def grading_command(plan, draft_path="DRAFT.txt", bp_path="BP.json"):
    """The exact invocation that grades a draft against this plan.

    **SHELL-QUOTED WITH `shlex.quote`, BECAUSE A DRAWN RELATION NAME CAN
    CONTAIN AN APOSTROPHE AND THE HAND-ROLLED `'...'` THEN CLOSES ON IT.**
    `schema:Scots vowel-length rhyme (Aitken's Law)` is one of the 22
    `DRAWABLE_SCHEMAS`, so once M-117 made the planner DRAW a relation per
    group this line began emitting commands no shell can parse: MEASURED over
    `make_plan(1..100)`, **48 of 100 seeds print a `GRADE IT:` line
    `shlex.split` REFUSES**, and `bash -n` gives `syntax error near unexpected
    token ')'`.
    **AND THE DEFECT WAS MET BEFORE AND FIXED IN THE WRONG PLACE**:
    `songs/README.md` carries a hand-escaped `(Aitken'"'"'s Law)` for
    `the_frost_ledger`, so somebody hit this, repaired the DOCUMENT, and left
    the INSTRUMENT emitting it — standing rule 3's own shape, and the reason
    this is a code fix rather than another escaped string.
    `shlex.quote` is BYTE-IDENTICAL to the old spelling for every value with
    no apostrophe, so no other printed command moves.
    The connector is immune either way (`execFile`, one argv token, no shell),
    which is exactly why the honest carrier is the half that broke.
    """
    parts = [f"python3 lyric_harness.py song {bp_path} {draft_path}"]
    if plan["groups"]:
        parts.append(shlex.quote(f"--groups={plan['groups']}"))
    if plan["returns"]:
        parts.append(shlex.quote(f"--returns={plan['returns']}"))
    # THE DECLARED RELATION REACHES THE GRADE (M-55). Without this line the
    # writer declares a relation, the plan records it, and the one command
    # that grades the draft asks the coarse `Declaration.admit` set instead —
    # a declared coordinate read by nothing, one layer out from M-54's.
    if plan.get("relation"):
        parts.append(shlex.quote(f"--relation={plan['relation']}"))
    # THE DRAWN PER-GROUP RELATIONS REACH THE GRADE (M-117) — the same
    # carry M-55 built for the writer's own declaration, one coordinate
    # over: a plan that drew `schema:pararhyme` for group C and did not
    # put it in this command would be a declared coordinate read by
    # nothing. Sorted by label so the command is deterministic
    # (doctrine 66).
    if plan.get("relations"):
        _spec = ",".join(f"{k}:{v}"
                         for k, v in sorted(plan["relations"].items()))
        parts.append(shlex.quote(f"--relations={_spec}"))
    parts.append(f"--subdivision {plan['subdivision']}")
    return " ".join(parts)
