#!/usr/bin/env python3
"""THE `NC` CENSUS — the eight codes the song-writing CLI cannot reach, each
one fired here through the API, in one place.

WHY THIS FILE EXISTS. `quality/COVERAGE_PREREGISTRATION.md` marks eight
finding codes `NC` — "not CLI-reachable" — and disposes of them (§E3) by
saying they need a different instrument and that **no claim is made about
whether they work**. That disposition was correct about the WRITING path and
it left an obvious question unanswered, and the answer turned out to be
scattered: three of the eight are asserted in `test_revise.py`, three in
`test_fit.py`, one in `test_grid.py`, and one cannot fire at all. Nothing
anywhere said "these are the NC set, and here is each of them firing", so the
question kept being re-asked and answered from the CATEGORY LABEL rather than
from the code — which is the same mistake as reading a stale summary instead
of the source.

WHAT THIS IS AND IS NOT. It is a REACHABILITY census: each code is driven to
fire through the smallest API call that produces its condition. It is not a
replacement for the suites that own these codes — those check the message,
the evidence, the counts and the negative direction, and they stay where they
are. If one of them is deleted, this file still fails, which is the point: the
question "is the NC set exercised at all" now has ONE place that answers it.

`NO_TEMPO` IS THE EIGHTH AND IT CANNOT FIRE. It is declared inert in
`quality/fit.py`'s `INERT` (`BACKLOG.md` §4.10) — no production path
constructs it, and `declared_inputs.tempo_bpm` is declared with no reader. It
is asserted here as INERT rather than omitted, because a census that quietly
drops the member it cannot produce is how a set of eight becomes a set of
seven nobody notices (doctrine 79: refused and fired are different counts).

Run: python3 quality/test_nc_census.py
"""

import dataclasses
import os
import sys
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality import fit as FIT                                # noqa: E402
from quality import grid as GR                                # noqa: E402
from quality import schemes as SC                             # noqa: E402
from quality.declared_inputs import BeatGrid                  # noqa: E402
from quality.fit import (AssumedMeter, Placement,             # noqa: E402
                         fit_line, fit_song)
from quality.meter import Cycle                               # noqa: E402
from quality.revise import Reviser                            # noqa: E402
from quality.schemes import Return                            # noqa: E402

FAILURES = []

#: The eight, verbatim from §A4's table. Kept as a literal so a code leaving
#: the `NC` set has to be moved here by hand rather than silently dropping out
#: of the census.
NC = ("MANDATE_SCOPE_DECLARED", "RETURN_OUT_OF_RANGE", "COLLISION_UNDECLARED",
      "PROMINENCE_OFF_HEAD", "ASSUMED_METER", "BEATGRID_INCOMPLETE",
      "NO_TEMPO", "REPRISE_SIDE_UNDECLARED")

SEVEN = Cycle(pulses=7, unit=8, groups=(3, 2, 2))
SOURCE = "NC CENSUS — a setting decided in this file, not a measurement"

#: Six lines. The mandate below groups only 1-4 and scopes to 1-4, so L5/L6
#: are outside the mandate's own scope and a collision touching one of them is
#: UNDECLARED rather than a violation. Both of those are conditions no
#: song-writing CLI run produces, which is why the two codes are `NC`.
SIX = ["the kitchen light is burning at half past four",
       "and nobody came back to climb the stairs",
       "i counted every window on the floor",
       "she left the coffee cooling on the chairs",
       "i heard him turn the handle of the door",
       "the morning came and rearranged the squares"]

fired = {}


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _codes(reviser, lines, mandate, **kw):
    f = reviser.inspect(list(lines), mandate, **kw)
    out = {x.code for x in f["whole"]}
    for _ln, fs in f["per_line"].items():
        out |= {x.code for x in fs}
    return out


def test_the_mandate_layer_three():
    print("\n1. the three the MANDATE layer owns — a SCOPE, and a return "
          "pointing off the end of the song")
    R = Reviser()

    # A scoped mandate. `scope` is API-only: no CLI verb accepts one, which
    # is exactly why both codes under it are NC.
    m = SC.mandate([[1, 3], [2, 4]], n_lines=6, scope=[1, 2, 3, 4])
    got = _codes(R, SIX, m)
    check("MANDATE_SCOPE_DECLARED fires when a mandate declares a SCOPE — "
          "the disclosure that it does not speak about every line",
          "MANDATE_SCOPE_DECLARED" in got, sorted(got))
    check("COLLISION_UNDECLARED fires on the same run — a collision touching "
          "a line the mandate disclaims is a different answer from a "
          "violation (doctrine 28)",
          "COLLISION_UNDECLARED" in got, sorted(got))
    fired["MANDATE_SCOPE_DECLARED"] = "scope=[1,2,3,4] over 6 lines"
    fired["COLLISION_UNDECLARED"] = "the same scoped mandate"

    # A return naming a line outside 1..n. `SC.mandate(returns=...)` refuses
    # this at construction, so the only way in is a hand-built `Return` on an
    # already-built Mandate -- API-only by construction, not by omission.
    base = SC.mandate([[1, 3], [2, 4]], n_lines=4)
    hand = dataclasses.replace(
        base, returns=(Return(lines=(1, 9), label="R1", verbatim=True),))
    got2 = _codes(R, SIX[:4], hand)
    check("RETURN_OUT_OF_RANGE fires on a return naming a line the draft "
          "does not have",
          "RETURN_OUT_OF_RANGE" in got2, sorted(got2))
    fired["RETURN_OUT_OF_RANGE"] = "Return(lines=(1, 9)) on a 4-line draft"


def test_the_meter_layer_three_and_the_one_that_cannot_fire():
    print("\n2. the three the METER layer owns, and the one that cannot fire")
    place = Placement(cycle=SEVEN, bar=1, beat=F(1), duration=F(7),
                      section="demo", section_start_bar=1, section_bars=14)

    def _rcodes(f):
        return {r.code for r in f.refusals}

    # BEATGRID_INCOMPLETE -- a grid that answers for some units and not all.
    partial = BeatGrid(cycle=SEVEN, positions={(0, 0): F(0)},
                       derived_from="notation", source=SOURCE)
    h = fit_line("So say the road", place, beatgrid=partial, line_index=0)
    check("BEATGRID_INCOMPLETE fires on a grid that holds SOME of the line — "
          "it answers for what it has and refuses the rest",
          "BEATGRID_INCOMPLETE" in _rcodes(h), sorted(_rcodes(h)))
    fired["BEATGRID_INCOMPLETE"] = "a BeatGrid holding 1 of 4 units"

    # PROMINENCE_OFF_HEAD -- a COMPLETE grid that puts a prominent unit off a
    # group head. The grid must be complete or BEATGRID_INCOMPLETE refuses
    # first and this never runs.
    full = BeatGrid(cycle=SEVEN,
                    positions={(0, 0): F(0), (0, 1): F(1),
                               (0, 2): F(2), (0, 3): F(3)},
                    derived_from="notation", source=SOURCE)
    off = fit_line("So say the road", place, beatgrid=full, line_index=0)
    off_codes = {x.code for x in off.findings}
    check("PROMINENCE_OFF_HEAD fires under a COMPLETE grid that lands a "
          "prominent unit off a group head",
          "PROMINENCE_OFF_HEAD" in off_codes
          and "BEATGRID_INCOMPLETE" not in _rcodes(off),
          sorted(off_codes))
    fired["PROMINENCE_OFF_HEAD"] = "a complete BeatGrid on 7/8 as (3, 2, 2)"

    # ASSUMED_METER -- a section with no declared time signature, run with a
    # SOURCED assumption. Refused without the source, which is the point.
    bp = {"_note": "constructed for the NC census",
          "sections": [{"name": "A", "bars": 2, "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
                       {"name": "B", "bars": 2, "start_bar": 3}],
          "lines": [{"text": t, "bar": b, "beat": 1, "duration": 4}
                    for t, b in zip(SIX[:4], (1, 2, 3, 4))]}
    am = AssumedMeter(beats=4, unit=4, source=SOURCE)
    sf = fit_song(bp, assume_meter=am)
    got = [r for r in sf.refusals() if r.code == "ASSUMED_METER"]
    check("ASSUMED_METER fires on a section that declares no time signature, "
          "and carries the SOURCE of the assumption",
          len(got) >= 1 and SOURCE in got[0].detail,
          f"{len(got)} refusal(s)")
    fired["ASSUMED_METER"] = "a section declaring no meter + AssumedMeter"

    # NO_TEMPO -- the eighth, and it CANNOT fire. Asserted as inert rather
    # than omitted.
    entry = [e for e in FIT.INERT if "NO_TEMPO" in e.field]
    check("NO_TEMPO is the one member of the set that cannot fire, and it is "
          "DECLARED inert rather than quietly dropped from the census",
          len(entry) == 1 and entry[0].blocker == "build"
          and hasattr(FIT, "_no_tempo"),
          entry[0].field if entry else "no INERT entry")
    fired["NO_TEMPO"] = "INERT (blocker=build) — asserted, never fired"


def test_the_song_structure_one():
    print("\n3. the one the SONG-STRUCTURE layer owns")
    _f, refusals, _o = GR.reprise_findings(GR.Song(
        sections=[GR.Section("o", 2, function="outro")],
        lines=[GR.Line("x", bar=1)]))
    codes = {r.code for r in refusals}
    check("REPRISE_SIDE_UNDECLARED fires when one side of the reprise "
          "relation is not declared at all — 'no reprise' would be an answer "
          "about a comparison never made",
          codes == {"REPRISE_SIDE_UNDECLARED"}, sorted(codes))
    fired["REPRISE_SIDE_UNDECLARED"] = "a song declaring an outro and no intro"


def test_every_member_of_the_set_is_accounted_for():
    """The census closes over its own list.

    Doctrine 48's shape one level up: a census that checks whatever it
    happens to have written down passes for the wrong reason. This asserts
    the accounted set IS `NC`, so adding a code to the list without giving it
    a probe fails here, and probing something outside the set fails too.
    """
    print("\n4. the census closes over the declared set")
    check("every one of the eight is accounted for, and nothing outside the "
          "set was counted",
          set(fired) == set(NC),
          f"missing {sorted(set(NC) - set(fired))}; "
          f"extra {sorted(set(fired) - set(NC))}")
    check("...and exactly ONE of them is accounted for as INERT rather than "
          "fired — the other seven were driven to fire in this file",
          sum(1 for v in fired.values() if v.startswith("INERT")) == 1,
          {k: v for k, v in sorted(fired.items())})


if __name__ == "__main__":
    for fn in (test_the_mandate_layer_three,
               test_the_meter_layer_three_and_the_one_that_cannot_fire,
               test_the_song_structure_one,
               test_every_member_of_the_set_is_accounted_for):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the NC set is exercised: 7 fired here, 1 declared inert")
