#!/usr/bin/env python3
"""Regressions for the bar grid and the structural-cliche detector.

The load-bearing test is test_stanza_lock_fires_on_the_default: a song of six
16-bar 4/4 sections carrying four lines each must trip every check. Everything
this repo had before would certify that structure as clean, because every check
it owned was about words.

Run: python3 quality/test_grid.py
"""

import os
import sys
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import schemes as S                                  # noqa: E402
from quality.grid import (Line, Meter, Section, Song, UNDECLARED,  # noqa: E402
                          UnknownFunction, line_pickup, phrase_profile,
                          song_from_blueprint, stanza_lock, tokens,
                          uniformity)

FAILURES = []

#: the seven drift channels, named here so a change to the set is a decision
#: rather than a diff nobody read.
CHANNELS = {"four_four", "bars_multiple_of_four", "equal_section_length",
            "equal_line_duration", "downbeat_locked", "uniform_anacrusis",
            "four_lines_per_section"}


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn):
    try:
        fn()
    except Exception:
        return True
    return False


def cliche_song():
    names = ("verse1", "chorus1", "verse2", "chorus2", "bridge", "chorus3")
    s = Song(sections=[Section(n, 16) for n in names]).layout()
    s.lines = [Line(f"l{i}", bar=sec.start_bar + 4 * k)
               for sec in s.sections for k, i in
               enumerate(range(4))]
    return s


def real_song():
    s = Song(sections=[
        Section("intro", 5), Section("verse", 11),
        Section("turn", 3, Meter(7, 8)), Section("chorus", 14),
        Section("verse", 9), Section("break", 6, Meter(6, 8)),
        Section("chorus", 14), Section("coda", 19, Meter(5, 4))]).layout()
    spec = [(1, 1, 6), (7, 4, 9), (10, 2, 5), (13, F("3/2"), 11), (17, 1, 7),
            (19, F("7/2"), 13), (23, 1, 4), (26, 2, 10), (30, F("5/2"), 6),
            (34, 4, 9), (37, F("3/2"), 14), (42, 1, 3), (44, 4, 8),
            (49, F("7/2"), 13), (53, 1, 4), (56, 2, 10), (60, F("5/2"), 6),
            (63, 1, 15), (67, 3, 7), (70, F("9/2"), 11), (74, 2, 20),
            (79, 1, 5)]
    s.lines = [Line(f"L{i+1}", bar=b, beat=F(bt), duration=F(d))
               for i, (b, bt, d) in enumerate(spec)]
    return s


def test_the_model_cannot_express_a_stanza():
    print("\n1. lines-per-section is EMERGENT — there is no field for it")
    check("Section has no line-count field",
          not any(f in Section.__dataclass_fields__
                  for f in ("lines", "line_count", "n_lines")),
          f"fields are {sorted(Section.__dataclass_fields__)}")
    check("Section is measured in BARS", "bars" in Section.__dataclass_fields__)
    check("a section length need not be a multiple of anything",
          Section("x", 11).bars == 11 and Section("y", 7).bars == 7)


def test_meter_is_arbitrary():
    print("\n2. nothing privileges 4/4")
    check("7/8 exists and is simple", str(Meter(7, 8)) == "7/8"
          and not Meter(7, 8).compound)
    # THESE ASSERTIONS USED TO ENCODE THE DEFECT. pulse_groups ASSERTED
    # (3,3,3) for 9/8 -- the European reading -- where Balkan daichovo is
    # 2+2+2+3, and gave seven single pulses for 7/8, which is not a grouping.
    # There are 2^(n-1) orderings of n pulses; it represented one by fiat.
    check("an UNDECLARED grouping is refused, not guessed",
          Meter(9, 8).pulse_groups is None and Meter(7, 8).pulse_groups is None,
          "None means this cycle has not said which of its 256 or 64 "
          "groupings it is")
    check("a DECLARED grouping is returned exactly",
          Meter(9, 8, groups=(2, 2, 2, 3)).pulse_groups == (2, 2, 2, 3)
          and Meter(7, 8, groups=(3, 2, 2)).pulse_groups == (3, 2, 2),
          "daichovo 9/8 and a 3+2+2 seven are now distinguishable from the "
          "European readings AND from each other")
    check("the convention still exists and is LABELLED a convention",
          Meter(6, 8).conventional_grouping() == (3, 3)
          and Meter(9, 8).conventional_grouping() == (3, 3, 3),
          "available on request, never used as a default")
    check("a cycle knows what it is distinguished FROM",
          len(Meter(9, 8, groups=(2, 2, 2, 3)).variants()) == 255,
          "2^(9-1) = 256 orderings of nine pulses, minus itself")
    check("a declared grouping must exhaust the cycle",
          _raises(lambda: Meter(7, 8, groups=(2, 2)).pulse_groups))
    s = real_song()
    check("meter resolves per BAR and can change mid-song",
          str(s.meter_at(18)) == "7/8" and str(s.meter_at(20)) == "4/4"
          and str(s.meter_at(80)) == "5/4",
          "bar 18 is the turn, bar 20 the chorus, bar 80 the coda")


def test_lines_key_on_bar_range_not_name():
    print("\n3. two sections may share a name — the demo caught this")
    s = real_song()
    check("a repeated section name is refused rather than silently merged",
          _raises(lambda: s.lines_in("chorus")),
          "matching by name collapsed both choruses and doubled the count, "
          "which stopped QUATRAIN_LOCK from firing correctly")
    ch = [x for x in s.sections if x.name == "chorus"]
    check("passing the Section itself works and they differ",
          len(s.lines_in(ch[0])) == 3 and len(s.lines_in(ch[1])) == 4,
          f"{len(s.lines_in(ch[0]))} vs {len(s.lines_in(ch[1]))} lines — the "
          f"same chorus for RHYME, two different spans for the GRID")


def test_stanza_lock_fires_on_the_default():
    print("\n4. THE ONE THAT MATTERS — six 16-bar 4/4 sections, four lines "
          "each, must trip everything")
    fs = stanza_lock(cliche_song())
    codes = {f.code for f in fs}
    for c in ("METER_LOCKED", "SECTION_LENGTH_LOCKED", "QUATRAIN_LOCK",
              "DOWNBEAT_LOCKED", "PHRASE_LENGTH_LOCKED"):
        check(f"{c} fires", c in codes)
    u = uniformity(cliche_song())
    check("and every drift measure reads 100%",
          all(v == 1.0 for v in u.values()),
          str({k: f"{v:.0%}" for k, v in u.items()}))


def test_a_real_structure_clears_it():
    print("\n5. and a song written ON the grid trips none of them")
    s = real_song()
    fs = stanza_lock(s)
    check("no findings", not fs, "; ".join(f.code for f in fs))
    u = uniformity(s)
    check("section lengths are irregular",
          u["bars_multiple_of_four"] == 0.0,
          str([x.bars for x in s.sections]))
    check("line counts per section are irregular",
          u["four_lines_per_section"] < 0.5,
          str([n for _n, _b, _m, n in phrase_profile(s)]) + " — ONE section "
          "landing on 4 lines is not the defect; every section landing on 4 "
          "is, which is why the measure is a fraction and not a flag")
    check("most lines do NOT start on a downbeat",
          u["downbeat_locked"] < 0.5, f"{u['downbeat_locked']:.0%}")
    check("phrase lengths vary", u["equal_line_duration"] < 0.25,
          f"{u['equal_line_duration']:.0%}")
    check("the detector is not vacuous — it separates the two songs",
          len(stanza_lock(cliche_song())) == 5 and len(fs) == 0)


def test_the_grid_hands_off_to_the_scheme_layer_without_chunking():
    print("\n6. grid -> scheme handoff stays per-LINE")
    s = real_song()
    labels = s.line_sections()
    check("one label per line, not one per section",
          len(labels) == len(s.lines) == 22, f"{len(labels)} labels")
    code = S.parse("ABCADEBFDGCHEIFAJGKBHA")
    co = S.coordinates(code, sections=labels)
    check("the scheme is ONE partition over all 22 lines",
          co.n_lines == 22 and co.n_sounds == 11)
    check("it carries long-range rhyme the stanza model forbade",
          co.max_span == 21, f"max_span={co.max_span}")
    check("and rhymes crossing section boundaries",
          co.section_crossing >= 10, f"{co.section_crossing} crossings")
    check("the form has no name, out of 4.5 quadrillion at this length",
          S.identify(code) is None and S.bell(22) > 4e15,
          f"Bell(22) = {S.bell(22):,}")


def test_function_and_bar_range_are_two_different_keys():
    print("\n7. the FUNCTION coordinate and the BAR RANGE do not merge")
    s = Song(sections=[
        Section("verse1", 11, function="verse"),
        Section("chorus", 14, function="chorus"),
        Section("verse2", 9, function="verse"),
        Section("chorus", 14, function="chorus")]).layout()
    s.lines = [Line(f"L{i}", bar=b) for b in (1, 5, 12, 20, 26, 30, 40, 48)
               for i in [b]]
    check("two sections declaring one FUNCTION are two instances, not one",
          len(s.instances_of("chorus")) == 2
          and [x.start_bar for x in s.instances_of("chorus")] == [12, 35],
          "the accessor D-1 was missing: keyed on the declared function, in "
          "bar order")
    check("and lines_in STILL refuses a repeated NAME",
          _raises(lambda: s.lines_in("chorus")),
          "these are two different keys and they must stay two: a chorus is "
          "one thing for FUNCTION and two spans for the GRID, which is the "
          "same sentence the bar-range rule has always made")
    check("adding `function` did not add a line-count field",
          not any(f in Section.__dataclass_fields__
                  for f in ("lines", "line_count", "n_lines")),
          f"fields are {sorted(Section.__dataclass_fields__)}")
    check("and it is not a uniformity channel",
          set(uniformity(s)) == CHANNELS and "function" not in CHANNELS,
          "the anti-cliche measure is about the GRID; a form with two "
          "choruses is not thereby uniform. The channel COUNT moved from six "
          "to seven in the same round for an unrelated reason "
          "(uniform_anacrusis, test 8); `function` is still not one of them, "
          "which is what this line has always asserted")
    check("the drift checks read the declared function, never the name",
          _drift_reads_function())


#: a real bar-grid blueprint, the one whose Song was written by hand.
BLUEPRINT = os.path.join(HERE, "fixtures", "song.blueprint.json")


def scene_song():
    import json
    bp = json.load(open(BLUEPRINT, encoding="utf-8"))
    secs = [Section(name=s["name"], bars=int(s["bars"]),
                    start_bar=int(s["start_bar"]),
                    meter=Meter(int(s["meter"]["beats"]),
                                int(s["meter"]["unit"]),
                                tuple(s["meter"]["groups"])))
            for s in bp["sections"]]
    lines = [Line(text=l["text"], bar=int(l["bar"]), beat=F(str(l["beat"])),
                  duration=F(str(l["duration"])), section=l["section"])
             for l in bp["lines"]]
    return Song(sections=secs, lines=lines)


def anacrusis_cheat_song():
    """DOWNBEAT_LOCKED cleared the way this repo's own blueprint cleared it.

    Four sections in four different meters, six lines each, strictly
    alternating beat 1 with ONE CONSTANT pickup of 1.5 pulses. Half the lines
    are off the downbeat, so `downbeat_locked` reads 50% and the old check
    went silent -- on a song in which no line was ever heard against its bar.
    """
    ms = (Meter(4, 4), Meter(7, 8), Meter(5, 4), Meter(6, 8))
    s = Song(sections=[Section(f"s{i}", 12, m) for i, m in enumerate(ms)])
    s.layout()
    for sec in s.sections:
        # beat b such that (b - 1) = pulses - 3/2 -> the same 1.5-pulse pickup
        up = sec.meter.beats - F(1, 2)
        for k in range(6):
            s.lines.append(Line(f"{sec.name}.{k}", bar=sec.start_bar + 2 * k,
                                beat=F(1) if k % 2 == 0 else up,
                                duration=F(sec.meter.beats),
                                section=sec.name))
    return s


def test_a_uniform_anacrusis_is_a_finding_and_not_a_pass():
    print("\n8. DOCTRINE 24 — the check RELABELS instead of going silent")
    cheat = anacrusis_cheat_song()
    u = uniformity(cheat)
    check("the pickup is measured to the BARLINE, so it is meter-relative",
          {line_pickup(cheat, l) for l in cheat.lines} == {F(0), F(3, 2)},
          "beat 3.5 of 4/4, 6.5 of 7/8, 4.5 of 5/4 and 5.5 of 6/8 are FOUR "
          "offsets and ONE pickup — 1.5 pulses of run-up — which is how one "
          "constant hid in four time signatures. Keyed on `beat - 1` this "
          "reads four distinct values and the check never fires")
    check("half the lines are off the downbeat, so DOWNBEAT_LOCKED cannot see "
          "it", u["downbeat_locked"] == 0.5, f"{u['downbeat_locked']:.0%}")
    codes = {f.code for f in stanza_lock(cheat)}
    check("UNIFORM_ANACRUSIS fires instead — the other shape of the defect",
          "UNIFORM_ANACRUSIS" in codes and "DOWNBEAT_LOCKED" not in codes,
          f"{sorted(codes)}; uniform_anacrusis "
          f"{u['uniform_anacrusis']:.0%} — every one of the 12 off-downbeat "
          f"lines carries the same pickup")
    ev = [f for f in stanza_lock(cheat)
          if f.code == "UNIFORM_ANACRUSIS"][0].evidence
    check("...and the finding says what it CANNOT separate (doctrine 17)",
          "CANNOT SEPARATE" in ev and "doctrine 16" in ev,
          "a pickup uniform by fiat and one uniform because English "
          "line-openings are read the same here, and the finding says so "
          "rather than being quoted as if it did not")
    lock = stanza_lock(cliche_song())
    lcodes = {f.code for f in lock}
    check("on an all-downbeat song only DOWNBEAT_LOCKED fires, not both",
          "DOWNBEAT_LOCKED" in lcodes and "UNIFORM_ANACRUSIS" not in lcodes,
          "two shapes of one defect: the check names WHICH one it sees")
    check("uniform_anacrusis is 1.0 when nothing is anacrustic",
          uniformity(cliche_song())["uniform_anacrusis"] == 1.0,
          "this dict measures drift TOWARD the default; a song with no pickup "
          "anywhere has arrived at the default, not departed from it — and "
          "that keeps `all(v == 1.0)` in test 4 meaning what it says")
    real = real_song()
    ua = uniformity(real)["uniform_anacrusis"]
    distinct = len({line_pickup(real, l) for l in real.lines})
    check("...and a song written ON the grid still trips neither",
          not {f.code for f in stanza_lock(real)}
          & {"DOWNBEAT_LOCKED", "UNIFORM_ANACRUSIS"},
          f"uniform_anacrusis {ua:.0%} over {distinct} distinct pickups — "
          f"the check is not vacuous in the other direction")


def test_four_four_does_not_read_the_grouping():
    print("\n9. a DECLARED GROUPING is not a change of meter")
    a = Song(sections=[Section("x", 16, Meter(4, 4)),
                       Section("y", 16, Meter(4, 4))]).layout()
    b = Song(sections=[Section("x", 16, Meter(4, 4, (2, 2))),
                       Section("y", 16, Meter(4, 4, (2, 2)))]).layout()
    check("declaring 4/4 as (2,2) leaves four_four at 100%",
          uniformity(a)["four_four"] == uniformity(b)["four_four"] == 1.0,
          "`s.meter == Meter(4, 4)` read the frozen `groups` field too, so "
          "adding `groups: [2, 2]` to this repo's own chorus dropped "
          "four_four from 29% to 0% with no bar changed — METER_LOCKED "
          "clearable by declaring where the beats are, which says nothing "
          "about whether the song is in four")


def test_the_shipped_blueprint_is_declared_honestly():
    print("\n10. a real bar-grid blueprint, declared rather than inferred")
    s = scene_song()
    check("16 lines over 16 bars in seven sections", len(s.lines) == 16
          and s.total_bars == 16 and len(s.sections) == 7)
    spans = []
    for sec in s.sections:
        P = F(sec.meter.beats)
        spans.append(sorted((l.start_absolute(sec.meter),
                             l.end_beat_absolute(sec.meter))
                            for l in s.lines_in(sec)))
    check("no two declared spans intersect",
          all(a[1] <= b[0] for run in spans for a, b in zip(run, run[1:])),
          "one line per bar, each duration bounded to its own bar -- a real "
          "hand-written blueprint once got exactly this wrong (a genuine "
          "overlap, found and fixed), which is why the check exists rather "
          "than being assumed")
    check("every section declares a grouping",
          all(sec.meter.groups for sec in s.sections),
          f"{[(x.name, x.meter.groups) for x in s.sections]} — 4/4 admits "
          f"eight orderings and [2,2] is a different meter from [4], so "
          f"declaring is a decision (doctrine 19 forbids inferring one)")
    v = [x for x in s.sections if x.name.startswith("verse")]
    c = [x for x in s.sections if x.name.startswith("chorus")]
    check("a RETURN inherits its first instance's tune slot",
          s.slot_profile(v[0]) == s.slot_profile(v[1])
          and s.slot_profile(c[0]) == s.slot_profile(c[1]),
          "a return is the same TUNE with new words, so a repeated section "
          "shares the pickup a different one would otherwise move")
    u = uniformity(s)
    codes = {f.code for f in stanza_lock(s)}
    check("every line opens on the downbeat, so DOWNBEAT_LOCKED fires and "
          "UNIFORM_ANACRUSIS does not — the other shape of the same check, "
          "covered on a mixed-pickup fixture by test 8 above",
          "DOWNBEAT_LOCKED" in codes and "UNIFORM_ANACRUSIS" not in codes
          and u["downbeat_locked"] == 1.0,
          f"downbeat_locked {u['downbeat_locked']:.0%}; codes {sorted(codes)}")
    check("the numeral survives grid.py's normalisation",
          tokens("We drove down County Road 9")[-1] == "9",
          "`lyric_harness.line_tokens` matches [A-Za-z'-]+ and drops it "
          "silently; `quality/fit.py` REFUSES it as a NUMERAL and marks the "
          "count a lower bound (doctrine 79). This layer must not be the "
          "third answer — a token dropped here would make the variation "
          "measurement blind to it too")


# ---------------------------------------------------------------------------
# `song_from_blueprint` -- the reader `song_function_report`'s wiring needs
#
# `scene_song()` above is the hand-rolled version of exactly this reader,
# written before this function existed because nothing needed `.function` or
# hooks from a blueprint yet. These tests hold the new reader to the SAME
# blueprint that one already parses, so a divergence between the two is
# caught rather than shipped as two silently-different readings of one file.
# ---------------------------------------------------------------------------

MOONLIGHT = os.path.join(HERE, "fixtures", "function_fixture.blueprint.json")


def test_song_from_blueprint_matches_the_hand_rolled_reader():
    print("\n11. song_from_blueprint agrees with the hand-rolled reader on "
          "a real bar-grid blueprint")
    hand = scene_song()
    got, hooks = song_from_blueprint(BLUEPRINT)
    check("same section count, names, bars, start bars and meters",
          [(s.name, s.bars, s.start_bar, s.meter) for s in hand.sections]
          == [(s.name, s.bars, s.start_bar, s.meter) for s in got.sections])
    check("every section comes back UNDECLARED — this blueprint sets no "
          "\"function\" key and none is inferred from the name",
          all(s.function == UNDECLARED for s in got.sections),
          [(s.name, s.function) for s in got.sections])
    check("same line count, text, bar, beat, duration and section",
          [(l.text, l.bar, l.beat, l.duration, l.section)
           for l in hand.lines]
          == [(l.text, l.bar, l.beat, l.duration, l.section)
              for l in got.lines])
    check("no hooks key in this blueprint -> the empty list, not a KeyError",
          hooks == [])
    check("no title key either -> the empty string, the same UNDECLARED "
          "shape Song.title already uses",
          got.title == "")


def test_song_from_blueprint_reads_function_and_hooks():
    print("\n12. song_from_blueprint reads a blueprint that DOES declare "
          "function and hooks")
    got, hooks = song_from_blueprint(MOONLIGHT)
    check("every section's declared function survives",
          [s.function for s in got.sections]
          == ["verse", "verse", "chorus", "verse", "chorus", "bridge",
              "verse", "chorus", "outro"],
          [(s.name, s.function) for s in got.sections])
    check("hooks pass through verbatim, as raw strings",
          hooks == ["a hook line for the reader to find"], hooks)
    check("title passes through", got.title == "Fixture Two")
    check("a path and an already-loaded dict give the same answer",
          song_from_blueprint(MOONLIGHT)[0].sections
          == song_from_blueprint(__import__("json").load(open(MOONLIGHT)))[0]
          .sections)


def test_song_from_blueprint_rejects_an_undeclared_function():
    print("\n13. an unrecognised \"function\" value RAISES, the same "
          "contract Section() itself holds")
    check("a bogus function name is not silently dropped to UNDECLARED",
          _raises(lambda: song_from_blueprint(
              {"sections": [{"name": "x", "bars": 4, "function": "verse-ish",
                            "meter": {}}], "lines": []})),
          "doctrine 45's move for `language`: an unknown value raises "
          "rather than being coerced or ignored")


def test_song_from_blueprint_owns_lines_by_bar_when_unnamed():
    print("\n14. a line naming no section, or an unknown one, is owned by "
          "BAR RANGE — the same fallback quality.fit.from_blueprint uses")
    obj = {"sections": [{"name": "a", "bars": 4, "meter": {}},
                        {"name": "b", "bars": 4, "start_bar": 5,
                         "meter": {}}],
           "lines": [{"text": "in a, named", "bar": 2, "section": "a"},
                     {"text": "in b, unnamed", "bar": 6},
                     {"text": "in b, wrong name given", "bar": 7,
                      "section": "nonexistent"}]}
    song, _ = song_from_blueprint(obj)
    check("a correctly-named line is owned by that section",
          song.lines[0].section == "a")
    check("an unnamed line is owned by whichever section its BAR falls in",
          song.lines[1].section == "b")
    check("a line naming a section that does not exist falls back to bar "
          "range too, rather than raising or being silently dropped",
          song.lines[2].section == "b")


def test_song_from_blueprint_float_beats_are_exact():
    print("\n15. a float beat/duration in the JSON becomes the DECIMAL "
          "fraction, not its nearest binary neighbour")
    obj = {"sections": [{"name": "a", "bars": 4, "meter": {}}],
           "lines": [{"text": "x", "bar": 1, "beat": 1.1, "duration": 0.1}]}
    song, _ = song_from_blueprint(obj)
    from fractions import Fraction as Fr
    check("beat 1.1 -> exactly 11/10, not the ~3602879701896397/... IEEE "
          "double closest to it",
          song.lines[0].beat == Fr(11, 10), str(song.lines[0].beat))
    check("duration 0.1 -> exactly 1/10",
          song.lines[0].duration == Fr(1, 10), str(song.lines[0].duration))


def _drift_reads_function():
    """Two spans NAMED 'x' and 'y' and both DECLARED chorus, at two lengths:
    the length-drift finding must fire on the declaration."""
    from quality.grid import return_findings
    s = Song(sections=[Section("x", 16, function="chorus"),
                       Section("y", 12, function="chorus")]).layout()
    s.lines = [Line("l", bar=b) for b in (1, 5, 17, 21)]
    f, _, _ = return_findings(s, "chorus")
    return "RETURN_LENGTH_DRIFT" in {x.code for x in f}


if __name__ == "__main__":
    for fn in (test_the_model_cannot_express_a_stanza,
               test_meter_is_arbitrary,
               test_lines_key_on_bar_range_not_name,
               test_stanza_lock_fires_on_the_default,
               test_a_real_structure_clears_it,
               test_the_grid_hands_off_to_the_scheme_layer_without_chunking,
               test_function_and_bar_range_are_two_different_keys,
               test_a_uniform_anacrusis_is_a_finding_and_not_a_pass,
               test_four_four_does_not_read_the_grouping,
               test_the_shipped_blueprint_is_declared_honestly,
               test_song_from_blueprint_matches_the_hand_rolled_reader,
               test_song_from_blueprint_reads_function_and_hooks,
               test_song_from_blueprint_rejects_an_undeclared_function,
               test_song_from_blueprint_owns_lines_by_bar_when_unnamed,
               test_song_from_blueprint_float_beats_are_exact):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all grid regressions pass")
