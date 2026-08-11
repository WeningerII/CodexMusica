#!/usr/bin/env python3
"""Regressions for the syllable-to-pulse layer.

The load-bearing tests are the ones that pin a REFUSAL. This module's whole
value is that it answers the questions a declaration supports and declines the
ones it does not, so a change that makes it answer MORE is a defect until the
new coordinate is declared. Four refusals are pinned here and each has a
different cause:

  UNDECLARED_GROUPING   7/8 admits 64 orderings; asserting one is what
                        `meter.py` was built to stop (doctrine 19)
  PROMINENCE_DECLINED   `som` has pitch accent and `msa`'s stress is
                        contested; a plausible pattern for either is a number
                        nobody could catch (doctrine 35)
  NO_SUBDIVISION        how finely a pulse divides is a property of the
                        SETTING, and an assumed sixteenth grid is a number in
                        the output nobody declared
  NO_SETTING / NO_TEMPO which unit sits where, and anything per second

And one hostility: `FitRefusal.__bool__` RAISES, so `if not r:` cannot quietly
become "the line does not fit". It caught this module's own author once during
development, which is the shortest possible argument for it.

Run: python3 quality/test_fit.py
"""

import os
import sys
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import phonology as PH                    # noqa: E402
from quality.fit import (ANSWERABLE, UNANSWERABLE, FitFinding,  # noqa: E402
                         FitRefusal, Isochrony, Placement, SectionFit,
                         Subdivision, _max_prominent_on_heads, _no_tempo,
                         fit_line, fit_song, from_blueprint, read_line,
                         report)
from quality.meter import Cycle                        # noqa: E402

BLUEPRINT = os.path.join(HERE, "..", "examples",
                         "never_been_to_a_scene.blueprint.json")

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn, want=None):
    try:
        fn()
    except Exception as exc:                            # noqa: BLE001
        return want is None or want in str(exc)
    return False


def _codes(fit):
    return {f.code for f in fit.findings}


def _rcodes(fit):
    return {r.code for r in fit.refusals}


SEVEN = Cycle(pulses=7, unit=8, groups=(3, 2, 2))
SEVEN_UNDECL = Cycle(pulses=7, unit=8)
FOUR = Cycle(pulses=4, unit=4, groups=(2, 2))
SOURCE = "STRUCTURE DEMO — a decision made in this test, not a measurement"


def _place(cycle=SEVEN, bar=1, beat=1, duration=7, bars=14):
    return Placement(cycle=cycle, bar=bar, beat=F(str(beat)),
                     duration=F(str(duration)), section="demo",
                     section_start_bar=1, section_bars=bars)


# ---------------------------------------------------------------------------


def test_the_count_is_in_the_phonologys_own_grid_unit():
    print("\n1. what must be accommodated is `Phonology.grid_unit`, declared")
    eng = read_line("The scanner warms before the room does")
    check("English counts SYLLABLES and the count is exact",
          eng.unit_name == "syllable" and eng.count == 9 == eng.syllables,
          f"{eng.pattern()}")
    som = read_line("hooyo macaan", PH.get("som"))
    check("Somali counts MORAS, and they are not the syllable count",
          som.unit_name == "mora" and som.count == 6 and som.syllables == 4,
          "quantitative metre — `som` declares grid_unit='mora', so a fit "
          "against it is 6 units and not 4")
    check("the mora count is what a density is computed on",
          fit_line(som, _place(duration=6)).count == 6)
    ltc = read_line("白日依山盡", PH.get("ltc"))
    check("Middle Chinese counts one syllable per character",
          ltc.unit_name == "syllable" and ltc.count == 5)
    fin = read_line("Vaka vanha Vainamoinen", PH.get("fin"))
    check("Finnish initial stress comes through as the declared prominence",
          fin.pattern() == "/./././.", fin.pattern())


def test_a_refused_token_makes_the_count_a_lower_bound():
    print("\n2. doctrine 79 — a refusal is not a zero and not a failure")
    lu = read_line("Nine miles of gravel on the whiteboard")
    check("an out-of-lexicon word is NAMED, not silently dropped",
          [r.token for r in lu.refused] == ["whiteboard"]
          and lu.refused[0].cause == "OUT_OF_LEXICON",
          "`word_syllable_map` contributes no syllables for it; without this "
          "the line reports 7 and the true count is 9")
    check("...and the LineUnits says its count is not certain",
          not lu.certain and lu.count == 7)
    f = fit_line(lu, _place())
    check("the fit refuses the exact-count question and says why",
          "COUNT_IS_A_LOWER_BOUND" in _rcodes(f)
          and "LOWER BOUND" in [r for r in f.refusals
                                if r.code == "COUNT_IS_A_LOWER_BOUND"][0].detail)
    num = read_line("Tonight it is County Road 6")
    check("a NUMERAL is refused too — a defect this cell found",
          [r.cause for r in num.refused] == ["NUMERAL"],
          "`lyric_harness.line_tokens` matches [A-Za-z'-]+, so '6' is not a "
          "token at all: it contributed no syllables AND raised no refusal, "
          "which is the silent half of the same gap")
    check("a fully readable line is CERTAIN",
          read_line("I don't get to go").certain)


def test_beat_and_duration_are_read_or_they_raise():
    print("\n3. `Line.beat` and `Line.duration` stop being inert")
    p = _place(beat=1)
    check("beat 1 of bar 1 is pulse 0 of the section",
          p.start == 0 and p.end == 7)
    p2 = _place(bar=3, beat=6.5)
    check("beat 6.5 of bar 3 in 7/8 is pulse 19.5, and the arithmetic is "
          "exact",
          p2.start == F(39, 2) and p2.pickup == F(3, 2) and p2.is_anacrusis,
          "nothing in the repo had ever resolved these two fields into a "
          "position")
    bad = fit_line("I don't get to go", _place(beat=9))
    check("a beat the bar does not have is UNSATISFIABLE, with a cause",
          "BEAT_OUTSIDE_CYCLE" in _codes(bad) and not bad.satisfiable,
          "7/8 has seven pulses; beat 9 names one it has not got")
    zero = fit_line("I don't get to go", _place(duration=0))
    check("a non-positive duration is UNSATISFIABLE",
          "ZERO_DURATION" in _codes(zero) and not zero.satisfiable)
    over = fit_line("I don't get to go", _place(bar=14, beat=5, duration=7,
                                                bars=14))
    check("a span that leaves its section is UNSATISFIABLE",
          "OVERRUNS_SECTION" in _codes(over) and not over.satisfiable,
          "the tail is in the next section, whose pulse may be a different "
          "note value")
    check("a Placement REFUSES a bare time signature",
          _raises(lambda: Placement(cycle=(7, 8), bar=1),
                  "must be a quality.meter.Cycle"))


def test_the_declared_start_has_a_note_value_and_never_a_duration():
    print("\n4. note VALUES are declared; note DURATIONS need a tempo")
    p = _place(bar=3, beat=6.5)
    check("beat 6.5 of a 7/8 bar is a SIXTEENTH-note position",
          p.start_subdivision == 2 and p.start_note_value == F(1, 16),
          "the pulse is an eighth; half of it is a sixteenth. This is a fact "
          "the blueprint has always contained and nothing has ever read")
    q = _place(cycle=FOUR, beat=3.5, duration=4, bars=16)
    check("the SAME 0.5 in 4/4 is an eighth — the unit is the coordinate",
          q.start_note_value == F(1, 8))
    check("the tempo refusal is PERMANENT and names both halves",
          _no_tempo("x").status == "PERMANENT"
          and "a tempo" in _no_tempo("x").missing
          and "no tempo" in _no_tempo("x").detail
          and "no audio" in _no_tempo("x").detail,
          "no tempo AND no audio: either alone would leave a route open, and "
          "neither is here")
    check("...and it cannot be read as a negative either",
          _raises(lambda: bool(_no_tempo("x")), "not a verdict"))


def test_an_undeclared_grouping_is_refused_and_never_conventionalised():
    print("\n5. doctrine 19 — 64 orderings, and this cycle has not said which")
    f = fit_line("So say the road. Say it slow",
                 _place(cycle=SEVEN_UNDECL, duration=7))
    check("the head questions REFUSE on an undeclared grouping",
          "UNDECLARED_GROUPING" in _rcodes(f))
    r = [x for x in f.refusals if x.code == "UNDECLARED_GROUPING"][0]
    check("...and the refusal states the size of the space",
          "2^(n-1) = 64" in r.detail, r.detail[:80])
    check("...and NO head finding is produced",
          not any(x.kind == "prominence" for x in f.findings),
          "`conventional_grouping()` exists and is labelled a convention; it "
          "is not consulted here")
    check("the refusal is SCHEDULED and names what ends it",
          r.status == "SCHEDULED" and "declaring the grouping" in r.ends_with)
    poly = fit_line("So say the road", Placement(
        cycle=Cycle(pulses=7, unit=8, groups=(3, 2, 2), origin=None), bar=1,
        duration=F(7), section_bars=4))
    check("a POLYCENTRIC cycle refuses for a DIFFERENT reason and says so",
          "POLYCENTRIC_CYCLE" in _rcodes(poly),
          "origin=None says there is no privileged beat 1 to compose from; "
          "that is not the same gap as 'no composition declared'")


def test_pigeonhole_is_unconditional():
    print("\n6. the one claim that needs no setting and no subdivision")
    f = fit_line("The chair still holds the last one's heat",
                 _place(bar=3, beat=6.5))
    check("more prominent units than heads -> a COUNT of how many cannot land",
          "PROMINENCE_EXCEEDS_HEADS" in _codes(f))
    fin = [x for x in f.findings if x.code == "PROMINENCE_EXCEEDS_HEADS"][0]
    check("...stated with no conditional attached at all",
          fin.conditional_on == "" and "ANY setting" in fin.message,
          "6 prominent syllables, 3 group heads in the span — the shortfall "
          "holds however the line is sung")
    check("...and it does NOT claim the declaration is unsatisfiable",
          fin.satisfiable and fin.kind == "prominence",
          "nobody declared 'every prominent unit sits on a group head'. That "
          "is a norm of some repertoires and the opposite of the point in "
          "others (doctrine 6)")
    check("a finding that is not a PLACEMENT one may not claim unsatisfiable",
          _raises(lambda: FitFinding("X", "m", kind="prominence",
                                     satisfiable=False),
                  "smuggle in a norm nobody declared"))
    sparse = fit_line("go", _place(cycle=FOUR, duration=4, bars=4))
    check("fewer units than heads is the other direction — a head with "
          "nothing on it",
          "HEADS_EXCEED_UNITS" in _codes(sparse) and "SPARSE" in _codes(sparse),
          "1 syllable, 2 heads: the line drags across the grouping")


def test_prominence_is_not_stress_and_the_module_says_which():
    print("\n7. doctrine 35 — faking prominence is invisible in the numbers")
    som = read_line("hooyo macaan", PH.get("som"))
    check("`som` declines a prominence pattern and the reason is ITS OWN",
          som.prominence_refusal is not None
          and "pitch accent" in som.prominence_refusal.detail
          and som.prominence_refusal.status == "PERMANENT")
    check("...so every unit's prominence is None, never 0",
          som.pattern() == "????" and not som.prominent,
          "None is a refusal; 0 would be a claim that the syllable is not "
          "prominent, which `som` has explicitly not made")
    f = fit_line(som, Placement(cycle=Cycle(pulses=6, unit=8, groups=(3, 3)),
                                bar=1, duration=F(6), section_bars=4))
    check("the head question then refuses instead of counting zero prominents",
          "PROMINENCE_DECLINED" in _rcodes(f)
          and "PROMINENCE_EXCEEDS_HEADS" not in _codes(f))
    ltc = read_line("白日依山盡", PH.get("ltc"))
    check("...and its prominence is the 平/仄 binary regulated verse "
          "constrains",
          ltc.pattern() == "..//." and "平" in ltc.prominence_rule,
          "白 日 are 入, 依 山 are 平, 盡 is 去 — a tone class, and calling it "
          "stress would be a number nobody could catch")
    g = fit_line(ltc, Placement(cycle=Cycle(pulses=5, unit=4, groups=(5,)),
                                bar=1, duration=F(5), section_bars=4))
    hit = [x for x in g.findings if x.kind == "prominence"]
    check("Middle Chinese ANSWERS, and the answer is labelled 平/仄, not stress",
          bool(hit) and "NOT stress" in hit[0].evidence
          and "平" in hit[0].evidence,
          hit[0].evidence[-60:] if hit else "no prominence finding")
    check("English carries its function-word rule into the evidence too",
          "WEAK_ALWAYS" in [x for x in fit_line(
              "The chair still holds the last one's heat",
              _place(bar=3, beat=6.5)).findings
              if x.kind == "prominence"][0].evidence,
          "doctrine 46 — without the demotion every English monosyllable "
          "reads as prominent and every `the` gets an accent")


def test_the_subdivision_is_declared_never_inferred():
    print("\n8. how finely a pulse divides is a property of the SETTING")
    f = fit_line("The chair still holds the last one's heat",
                 _place(bar=3, beat=6.5))
    check("with none declared the slot questions refuse",
          "NO_SUBDIVISION" in _rcodes(f) and f.slots is None)
    r = [x for x in f.refusals if x.code == "NO_SUBDIVISION"][0]
    check("...and the refusal reports what the line would DEMAND of one",
          "a half-pulse" in r.detail and "2 slot(s) per pulse" in r.detail,
          "the demand is derivable; the supply is not")
    check("a Subdivision with no source is refused at construction",
          _raises(lambda: Subdivision(2), "has no source"))
    one = Subdivision(1, source=SOURCE)
    g = fit_line("The chair still holds the last one's heat",
                 _place(bar=3, beat=6.5), subdivision=one)
    check("at one slot per pulse the declared anacrusis is OFF THE GRID",
          "START_OFF_GRID" in _codes(g) and not g.satisfiable,
          "beat 6.5 is a sixteenth-note position in 7/8 and the pulse grid "
          "has no slot there — this is 'does the anacrusis have room', "
          "answered")
    check("...and the eight syllables do not fit seven slots",
          "SLOTS_EXCEEDED" in _codes(g))
    two = Subdivision(2, source=SOURCE)
    h = fit_line("The chair still holds the last one's heat",
                 _place(bar=3, beat=6.5), subdivision=two)
    check("at two slots per pulse both go away, and the finding said so",
          h.satisfiable and h.slots == 14)
    check("every subdivision-conditional finding CARRIES the condition",
          all(x.conditional_on for x in g.findings if not x.satisfiable),
          "the same fact at Subdivision(2) is not a fact at all, so an "
          "unconditional statement of it would be false")


def test_alignment_under_a_declared_subdivision_is_order_preserving():
    print("\n9. can every prominent unit REACH a head — decidable, once")
    slots = tuple(range(6))
    heads = {0, 3}
    best = _max_prominent_on_heads(2, [0, 1], slots, lambda j: slots[j] in heads)
    check("two adjacent prominent units can take heads 0 and 3",
          best == 2)
    best3 = _max_prominent_on_heads(4, [0, 1, 2, 3], slots,
                                    lambda j: slots[j] in heads)
    check("four prominent units cannot all reach two heads",
          best3 == 2, "the ceiling is the head count, and order is preserved")
    check("more units than slots is None, not 0",
          _max_prominent_on_heads(7, [0], slots,
                                  lambda j: slots[j] in heads) is None,
          "0 would say 'none can align'; None says 'they do not fit at all'")
    f = fit_line("where nobody has said anything yet",
                 Placement(cycle=Cycle(pulses=5, unit=4, groups=(3, 2)),
                           bar=1, duration=F(5), section_bars=8),
                 subdivision=Subdivision(2, source=SOURCE))
    check("on a real line it reports the MAXIMUM reachable, not a verdict",
          f.max_prominent_on_heads is not None
          and "PROMINENCE_CANNOT_ALIGN" in _codes(f),
          f"at most {f.max_prominent_on_heads} of "
          f"{len(f.units.prominent)} prominent syllables can reach a head")


def test_a_setting_is_declared_and_stamps_its_verdicts():
    print("\n10. which unit sits where — R5's input, or an owned assumption")
    f = fit_line("I don't get to go", _place(cycle=FOUR, duration=4, bars=16))
    check("with nothing declared the per-unit question refuses, PERMANENTLY",
          "NO_SETTING" in _rcodes(f)
          and [x for x in f.refusals
               if x.code == "NO_SETTING"][0].status == "PERMANENT")
    check("...and the refusal names MISSING.md G-1 and BeatGrid",
          "G-1" in [x for x in f.refusals
                    if x.code == "NO_SETTING"][0].detail)
    check("Isochrony with no source is refused at construction",
          _raises(lambda: Isochrony(), "has no source"))
    iso = Isochrony(source=SOURCE)
    g = fit_line("The scanner warms before the room does", _place(),
                 assume=iso)
    check("an even division of 9 over a 7/8 bar is a 9-TUPLET",
          "TUPLET_REQUIRED" in _codes(g)
          and g.even_division == F(7, 72),
          "7/72 whole notes each; denominator 72 is not a power of two")
    check("every isochronous verdict is stamped CONDITIONAL",
          all(x.conditional_on for x in g.findings if x.kind == "setting")
          and "assumed coordinate" in [
              x for x in g.findings if x.kind == "setting"][0].conditional_on,
          "doctrine 4 — isochrony is assumed here and is not a measurement")
    check("the landings are reported and are 1 of 9, not a score",
          "EVEN_DIVISION_LANDINGS" in _codes(g))
    from quality.declared_inputs import BeatGrid
    grid = BeatGrid(cycle=SEVEN,
                    positions={(0, 0): F(0), (0, 1): F(3), (0, 2): F(5)},
                    derived_from="notation",
                    source="STRUCTURE DEMO — a score, which is a measurement "
                           "of the notation and not of a performance")
    h = fit_line("So say the road", _place(duration=7), beatgrid=grid,
                 line_index=0)
    check("a partial BeatGrid answers for what it holds and refuses the rest",
          "BEATGRID_INCOMPLETE" in _rcodes(h))
    check("a NOTATION-derived grid carries no isochrony condition",
          all("ASSERTED" not in x.conditional_on for x in h.findings))


def test_a_refusal_cannot_be_read_as_a_negative():
    print("\n11. `if not r:` is made impossible, not discouraged")
    r = FitRefusal("X", "q", "m", ends_with="w")
    check("bool() RAISES", _raises(lambda: bool(r), "not a verdict"))
    check("...and the message says it is a refusal",
          "not a verdict" in r.render() and _NOT in r.render())
    check("raise_() carries the same text",
          _raises(r.raise_, "NOT ANSWERED"))
    check("a SCHEDULED refusal that names no work is refused at construction",
          _raises(lambda: FitRefusal("X", "q", "m", status="SCHEDULED"),
                  "impossibility wearing a date"),
          "the same rule `declared_inputs.Family` enforces one layer down")
    check("a PERMANENT one needs no schedule",
          FitRefusal("X", "q", "m", status="PERMANENT").status == "PERMANENT")


_NOT = "I was not given what I would need to tell"


def test_the_boundary_is_a_value_in_the_module():
    print("\n12. what it can and cannot be asked, importable")
    check("the answerable list is non-empty and mentions the declared unit",
          len(ANSWERABLE) >= 10
          and any("declared unit" in q for q in ANSWERABLE))
    whys = " ".join(w for _q, w in UNANSWERABLE)
    check("every impossibility says PERMANENT or SCHEDULED",
          all(("PERMANENT" in w or "SCHEDULED" in w) for _q, w in UNANSWERABLE))
    check("tempo, groove, melisma, the unsniffed grouping and doctrine 35 are "
          "all on it",
          "C-5" in whys and "C-4" in whys and "melisma" in " ".join(
              q for q, _w in UNANSWERABLE)
          and "doctrine 19" in whys and "doctrine 35" in whys)


def _check_overlaps_still_detects():
    """The blueprint's overlap count is a ZERO now, and a zero is what a
    silently-broken `overlaps()` also returns. Doctrine 94: a suite made of
    positive cases cannot find a rule that is too generous — so the detector
    gets its own constructed fixture, where the answer is known by
    construction and is not zero."""
    c = Cycle(pulses=F(4), unit=4, name="4/4")

    def line(bar, beat, dur, text):
        p = Placement(cycle=c, bar=bar, beat=F(beat), duration=F(dur),
                      section="fixture", section_start_bar=1,
                      section_bars=4, text=text)
        return fit_line(text, p)

    # A call over a response, which `grid.Line` says is LEGAL: the call runs
    # [0, 6) pulses from the section's downbeat, the response [4, 8). Two
    # pulses of intersection, and the bar in the middle carries both lines.
    sf = SectionFit(name="fixture", cycle=c, bars=4, start_bar=1,
                    lines=[line(1, 1, 6, "hold the note out"),
                           line(2, 1, 4, "over the top")])
    ov = sf.overlaps()
    check("`overlaps()` finds a constructed intersection and MEASURES it",
          ov == [(0, 1, F(2))],
          f"{ov} — the shipped blueprint reports 0 overlaps and that is now "
          f"a fact about the blueprint. This fixture is what makes the zero "
          f"readable: the detector answers (0, 1, 2 pulses) on two spans "
          f"built to intersect by two")

    # Abutting is not overlapping. `hi > lo` and not `hi >= lo` is the whole
    # difference between 'the next line starts where this one ends' — which
    # is what an ordinary lyric does 40 times a song — and a real collision.
    ab = SectionFit(name="fixture", cycle=c, bars=4, start_bar=1,
                    lines=[line(1, 1, 4, "first line"),
                           line(2, 1, 4, "second line")])
    check("...and abutting spans are NOT an intersection",
          ab.overlaps() == [],
          "[0,4) and [4,8) share the instant 4 and no duration. A detector "
          "that used `hi >= lo` would report every consecutive line pair in "
          "the song, which is 34 findings that mean nothing")


def test_the_shipped_song():
    print("\n13. the real blueprint — 41 lines, 83 bars, seven sections")
    secs, places = from_blueprint(BLUEPRINT)
    check("the blueprint resolves without importing quality/grid.py",
          len(secs) == 7 and len(places) == 41
          and "quality.grid" not in sys.modules,
          "duck-typed on Song instead, so this module has no build dependency "
          "on a file another cell owns")
    f = fit_song(BLUEPRINT)
    rows = {r["section"]: r for r in f.table()}
    check("83 bars and 41 lines survive the round trip",
          sum(r["bars"] for r in rows.values()) == 83
          and sum(r["lines"] for r in rows.values()) == 41)
    check("340 syllables, of which two lines' counts are LOWER BOUNDS",
          sum(r["units"] for r in rows.values()) == 340
          and sum(0 if r["exact"] else 1 for r in rows.values()) == 2,
          "verse1 'whiteboard' (out of lexicon) and verse2 '6' (numeral)")
    check("every section declares a grouping now, so NO line refuses one — "
          "and the declaration BUYS a finding rather than silencing one",
          sum(r["refusals"].get("UNDECLARED_GROUPING", 0)
              for r in rows.values()) == 0
          and rows["chorus"]["fighting"] == 8,
          "was 17 refusals (chorus 8 + chorus2 8 + outro 1) and `chorus "
          "fighting` 0, which doctrine 19 says is the CORRECT output for an "
          "undeclared 4/4. The blueprint now declares chorus/chorus2 as "
          "(2,2) and outro as (3) — an authorial decision stated as one, "
          "never `conventional_grouping()`. The 17 refusals became 17 "
          "PROMINENCE_EXCEEDS_HEADS findings: at (2,2) a 4-pulse span covers "
          "two heads and every chorus line has more prominent syllables than "
          "that. Declaring is not a way to go quiet")
    check("every line is CROWDED except the two that are not",
          sum(r["crowded"] for r in rows.values()) == 36,
          "the song asks 5.14 syllables of a 7/8 bar in verse2 and 3.75 of a "
          "4/4 bar in the chorus")
    check("no line's declared placement contradicts itself",
          all(r["unsatisfiable"] == 0 for r in rows.values()),
          "the arithmetic of bar/beat/duration holds everywhere; what it "
          "demands of the setting is the finding")
    one = Subdivision(1, source=SOURCE)
    g = fit_song(BLUEPRINT, subdivision=one)
    check("at ONE slot per pulse 36 of the 41 lines become unsatisfiable",
          sum(r["unsatisfiable"] for r in g.table()) == 36,
          "the song is not written on the pulse; it needs the pulse to "
          "divide, and now that is a number. Was 39: three of those lines "
          "were unsatisfiable only because their declared START was off the "
          "1-slot grid, and the blueprint's pickups are whole pulses now")
    two = fit_song(BLUEPRINT, subdivision=Subdivision(2, source=SOURCE))
    rows2 = {r["section"]: r for r in two.table()}
    check("at TWO the 7/8 verses fit and the 4/4 chorus does not",
          rows2["verse1"]["unsatisfiable"] == 0
          and rows2["verse2"]["unsatisfiable"] == 0
          and rows2["chorus"]["unsatisfiable"] == 2
          and rows2["chorus2"]["unsatisfiable"] == 3,
          "the tightest writing in the song is the 4/4 chorus, not the 7/8 "
          "verse — the first thing this project has been able to say about "
          "whether its own song is singable")
    check("uncovered bars are reported per section",
          rows["verse1"]["uncovered_bars"] == (6,)
          and len(rows["outro"]["uncovered_bars"]) == 5,
          f"verse1 {rows['verse1']['uncovered_bars']} carry no declared line "
          f"at all; the outro carries one line across seven bars")
    check("NO declared span in the shipped blueprint intersects another",
          sum(r["overlaps"] for r in rows.values()) == 0,
          "was verse1 1 + verse2 1: both verses declared a bar-10 pickup "
          "running 5.5 of its 7 pulses into a line declared at bar 11 beat "
          "1, so one bar carried 17 syllables that no per-line density "
          "showed. The two downbeats are separated now. THIS ASSERTION IS "
          "A ZERO, so it cannot tell a fixed blueprint from a broken "
          "`overlaps()` — the next check is the one that can (doctrine 94)")
    _check_overlaps_still_detects()
    txt = report(f)
    check("the report prints refusals by cause and marks the bounded counts",
          "REFUSED, by cause" in txt and "*" in txt)


def test_all_nine_declared_phonologies_go_through_it():
    print("\n14. nine phonologies, three grid units, three refusals")
    samples = {"cym": "Cynghanedd groes", "eng": "I have never once been",
               "fas": "گل", "fin": "Vaka vanha", "ltc": "白日依山",
               "msa": "Pisang emas", "non": "Hjaldrs", "san": "dharmakshetre",
               "som": "hooyo macaan"}
    seen = {}
    for lang in PH.declared():
        lu = read_line(samples[lang], PH.get(lang))
        seen[lang] = (lu.unit_name,
                      lu.prominence_refusal.code
                      if lu.prominence_refusal is not None else None)
    check("every declared phonology is readable through one entry point",
          len(seen) == 9 and all(v[0] in ("syllable", "mora")
                                 for v in seen.values()),
          str(seen))
    check("the MORA languages are som, fas and san — a declared coordinate",
          {k for k, v in seen.items() if v[0] == "mora"} == {"som", "fas",
                                                             "san"})
    check("the three that decline prominence are som, fas and msa",
          {k for k, v in seen.items() if v[1]} == {"som", "fas", "msa"},
          "and `san` is NOT one of them: its prominence is guru/laghu, a "
          "quantitative binary that its tradition really does constrain")
    check("the phrase-level hook is `syllabify_line`, and nothing declares it",
          not any(hasattr(PH.get(l), "syllabify_line") for l in PH.declared()))
    check("...deliberately NOT `line_syllables`, which msa already has and "
          "which returns an int",
          hasattr(PH.get("msa"), "line_syllables")
          and isinstance(PH.get("msa").line_syllables("Pisang emas"), int),
          "a duck-typed hook keys on a NAME; this one collided with an "
          "existing method of a different return type on its first sweep")


def test_the_cycle_helpers_refuse_the_same_way_the_cycle_does():
    print("\n15. quality/meter.py's new head arithmetic")
    check("is_head answers on a declared grouping and None on an undeclared",
          SEVEN.is_head(0) and SEVEN.is_head(3) and not SEVEN.is_head(1)
          and SEVEN_UNDECL.is_head(0) is None)
    check("it WRAPS, so a span crossing a barline is one coordinate",
          SEVEN.is_head(7) and SEVEN.is_head(10) and not SEVEN.is_head(8))
    check("heads_between returns () for a real empty span and None for "
          "undeclared",
          SEVEN.heads_between(1, 3) == ()
          and SEVEN_UNDECL.heads_between(0, 7) is None,
          "() is an answer; None is a refusal, and collapsing them is "
          "doctrine 28")
    check("a span starting mid-bar reports the heads it actually covers",
          SEVEN.heads_between(F(11, 2), F(11, 2) + 7) == (F(7), F(10), F(12)))
    check("group_at separates 3+2+2 from 2+2+3 at the same pulse",
          SEVEN.group_at(4) == (1, F(1))
          and Cycle(pulses=7, unit=8, groups=(2, 2, 3)).group_at(4) == (2, F(0)),
          "pulse 4 is inside group 1 of one meter and the HEAD of group 2 of "
          "the other — the whole reason a grouping is declared")
    check("note_value is exact and reads the declared unit",
          SEVEN.note_value(1) == F(1, 8) and FOUR.note_value(1) == F(1, 4)
          and Cycle(pulses=4, unit=3).note_value(1) == F(1, 3),
          "a non-power-of-two denominator is a note value too")


def main():
    for t in (test_the_count_is_in_the_phonologys_own_grid_unit,
              test_a_refused_token_makes_the_count_a_lower_bound,
              test_beat_and_duration_are_read_or_they_raise,
              test_the_declared_start_has_a_note_value_and_never_a_duration,
              test_an_undeclared_grouping_is_refused_and_never_conventionalised,
              test_pigeonhole_is_unconditional,
              test_prominence_is_not_stress_and_the_module_says_which,
              test_the_subdivision_is_declared_never_inferred,
              test_alignment_under_a_declared_subdivision_is_order_preserving,
              test_a_setting_is_declared_and_stamps_its_verdicts,
              test_a_refusal_cannot_be_read_as_a_negative,
              test_the_boundary_is_a_value_in_the_module,
              test_the_shipped_song,
              test_all_nine_declared_phonologies_go_through_it,
              test_the_cycle_helpers_refuse_the_same_way_the_cycle_does):
        t()
    print("\n" + "=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURES:")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print("all syllable-to-pulse regressions pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
