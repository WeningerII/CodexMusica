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


def test_a_recurred_single_use_function_is_reported():
    """SINGLE_USE_RECURRED could not fire for the whole life of this module.

    `song_function_report` built its question set from `recurrence == "returns"`
    or `convention.fixed_return`, and every function in `convention.single_use`
    has recurrence "once" and is in neither tuple -- the two are DISJOINT -- so
    `return_findings` was never handed one and the guard at its own line was
    unreachable. Found by declaring two bridges and getting silence.

    The three assertions below are the fix, its scope, and its cost:
    the check fires, it fires for every single-use function and not just the
    one that found it, and a well-formed song gains no new finding or refusal.
    """
    print("\n16. a single-use function declared twice is a finding")
    from quality.grid import (song_from_blueprint, song_function_report,
                              POPULAR_SONG, SECTION_FUNCTIONS)

    def report(fns):
        bp = {"bpm": 120, "meter": "4/4", "hooks": ["hold the line"],
              "sections": [{"name": f"S{i}", "function": f,
                            "start_bar": 1 + 4 * i, "bars": 4,
                            "lines": [{"text": "hold the line now",
                                       "bar": 1 + 4 * i, "beat": 1,
                                       "duration": 1}]}
                           for i, f in enumerate(fns)]}
        song, hooks = song_from_blueprint(bp)
        return song_function_report(song, hooks=hooks)

    codes = {f.code for f in report(["verse", "bridge", "chorus",
                                     "bridge"])["findings"]}
    check("two bridges earn SINGLE_USE_RECURRED", "SINGLE_USE_RECURRED" in codes,
          f"codes: {sorted(codes)}")

    # Not just the bridge that found it: every single_use function, or the fix
    # is a patch on one example rather than on the gate.
    missed = []
    for fn in POPULAR_SONG.single_use:
        c = {f.code for f in report(["verse", fn, "chorus", fn])["findings"]}
        if "SINGLE_USE_RECURRED" not in c:
            missed.append(fn)
    check("every single_use function is covered, not only bridge", not missed,
          f"silent for: {missed}" if missed else
          f"fires for all of {list(POPULAR_SONG.single_use)}")

    # The gate is count>1, not declaredness. A song with one intro must not
    # start paying a SINGLE_INSTANCE refusal for having an ordinary intro.
    clean = report(["intro", "verse", "chorus", "bridge"])
    check("a well-formed song gains no SINGLE_USE_RECURRED",
          "SINGLE_USE_RECURRED" not in {f.code for f in clean["findings"]})
    check("and gains no SINGLE_INSTANCE refusal for its one intro",
          not any(r.code == "SINGLE_INSTANCE" and "intro" in r.message
                  for r in clean["refusals"]),
          "gating on count>1 is what keeps the ordinary case silent")

    # Pin the disjointness that made it unreachable, so a later edit that
    # reintroduces the overlap assumption fails here rather than in silence.
    overlap = set(POPULAR_SONG.fixed_return) & set(POPULAR_SONG.single_use)
    check("fixed_return and single_use are still disjoint", not overlap,
          "the guard is reached by its own branch, not by an overlap")
    once = [f for f in POPULAR_SONG.single_use
            if SECTION_FUNCTIONS[f].recurrence != "once"]
    check("every single_use function still has recurrence 'once'", not once,
          f"otherwise the returns-branch would reach them: {once}")
    # AND THE CONVERSE, WHICH IS THE DIRECTION THAT WAS FALSE. The check above
    # shipped alone, and `reprise` -- declared recurrence "once" in the
    # vocabulary, absent from the tuple -- passed it every time while being
    # unreachable at both gates. Half a set equality is not a set equality.
    unlisted = sorted(fn for fn, s in SECTION_FUNCTIONS.items()
                      if s.recurrence == "once"
                      and fn not in POPULAR_SONG.single_use)
    check("and every recurrence-'once' function is listed in single_use",
          not unlisted,
          f"unreachable at both gates: {unlisted}" if unlisted else
          f"the two spellings of 'expected once' agree on all "
          f"{len(POPULAR_SONG.single_use)} members")


# ---------------------------------------------------------------------------
# THE THREE CLAIMS BELOW WERE AUDIT CLAIMS. Each was reproduced first and each
# reproduced, so each has a fix and a regression here that fails without it.
# ---------------------------------------------------------------------------


def _hook_song(last_function=None):
    """A hook in two DECLARED choruses and once more in a final section whose
    function is `last_function` -- None meaning nobody declared it."""
    secs = [Section("v1", 4, function="verse"),
            Section("c1", 4, function="chorus"),
            Section("v2", 4, function="verse"),
            Section("c2", 4, function="chorus"),
            Section("last", 4, function=last_function or UNDECLARED)]
    s = Song(sections=secs, title="hold the line").layout()
    s.lines = [Line("nothing here at all", bar=1),
               Line("hold the line tonight", bar=5),
               Line("nothing here either", bar=9),
               Line("hold the line tonight", bar=13),
               Line("hold the line tonight", bar=17)]
    return s


def test_hook_confined_and_the_undeclared_landing():
    """HOOK_CONFINED fired on a hook that had LEFT the one function it names.

    `len(fns - {UNDECLARED}) == 1` counts UNDECLARED as no function rather
    than as an unanswerable one, so a hook occurring twice in the chorus and
    once in a section nobody declared reported "returns 3 times and never
    leaves one function". Its own evidence line gave the branch away: it
    printed `occurs only in '' sections`, the UNDECLARED marker, which sorts
    ahead of every real function name.

    Doctrine 28: "confined" and "cannot tell where it went" are two answers,
    and doctrine 79 puts the second in the refusal count -- never in a finding.
    """
    print("\n17. HOOK_CONFINED and the undeclared landing")
    from quality.grid import hook_findings

    f, r = hook_findings(_hook_song())
    check("no hook declared -> the question is refused, not answered",
          [x.code for x in r] == ["HOOK_UNDECLARED"] and not f)

    f, r = hook_findings(_hook_song(), ["hold the line"])
    codes, rcodes = {x.code for x in f}, {x.code for x in r}
    check("a hook that also lands in an UNDECLARED section is not CONFINED",
          "HOOK_CONFINED" not in codes,
          f"findings {sorted(codes)} — the third occurrence is in a section "
          f"whose function nobody declared, so whether the hook stays in the "
          f"chorus is CANNOT TELL")
    partly = [x.message for x in r
              if x.code == "HOOK_PLACEMENT_PARTLY_UNDECLARED"]
    check("it is a REFUSAL, and it names how many landings are undeclared",
          "HOOK_PLACEMENT_PARTLY_UNDECLARED" in rcodes
          and "1 of those" in partly[0],
          partly[0] if partly else f"refusals: {sorted(rcodes)}")
    check("and no finding ever names the UNDECLARED marker as a function",
          not any("''" in x.evidence or "'' sections" in x.evidence
                  for x in f),
          [x.evidence[:70] for x in f])

    # THE POSITIVE CASE MUST SURVIVE. A hook confined to declared choruses is
    # still confined; a fix that silenced it would trade one wrong answer for
    # another (and `quality/test_revise.py` test 27 asserts this same finding
    # on the moonlight fixture).
    f2, _ = hook_findings(_hook_song("chorus"), ["hold the line"])
    check("with the last section DECLARED a chorus, HOOK_CONFINED fires again",
          "HOOK_CONFINED" in {x.code for x in f2},
          [x.evidence for x in f2][0][:90])
    check("and it names the chorus rather than the empty string",
          any("'chorus' sections" in x.evidence for x in f2
              if x.code == "HOOK_CONFINED"))

    # The hook demonstrably leaving one declared function for another is an
    # ANSWER, not a refusal: nothing about it is undecided.
    f3, r3 = hook_findings(_hook_song("verse"), ["hold the line"])
    check("a hook that leaks into a declared verse is neither confined nor "
          "refused",
          "HOOK_CONFINED" not in {x.code for x in f3}
          and "HOOK_PLACEMENT_PARTLY_UNDECLARED" not in {x.code for x in r3},
          f"findings {sorted({x.code for x in f3})}, "
          f"refusals {sorted({x.code for x in r3})}")


def test_the_three_counts_all_count_questions():
    """`answered` was `asked - len(refusals)` — questions minus RECORDS.

    One question can record more than one refusal: `hook_findings` refuses the
    placement question AND the title question, both inside the single call
    `song_function_report` counts as one ask. The report below asked three
    questions and printed `answered -1`, a negative count of answers, because
    four records were subtracted from three questions.
    """
    print("\n18. asked / answered / refused are three counts of QUESTIONS")
    from quality.grid import song_function_report

    s = Song(sections=[Section("a", 4), Section("b", 4),
                       Section("c", 4)]).layout()      # no title, nothing
    s.lines = [Line("hold the line", bar=b) for b in (1, 5, 9)]  # declared
    rep = song_function_report(s, hooks=["hold the line"])
    check("one question that records two refusals is still one question",
          rep["asked"] == 3 and rep["refused"] == 3 and rep["answered"] == 0,
          f"asked {rep['asked']}, answered {rep['answered']}, refused "
          f"{rep['refused']}; records {rep['refusal_records']}")
    check("a count of answers is never negative", rep["answered"] >= 0)
    check("asked == answered + refused",
          rep["asked"] == rep["answered"] + rep["refused"])
    check("the extra RECORD is disclosed rather than folded into the three",
          rep["refusal_records"] == 4 > rep["refused"],
          f"{rep['refusal_records']} records from {rep['refused']} refused "
          f"questions: {[x.code for x in rep['refusals']]} — doctrine 79 "
          f"wants three counts of the same kind of thing, and the list is "
          f"returned in full either way")

    # A question that is answered on six channels and refuses the seventh is
    # counted refused ONCE, not once per channel: the conservative direction.
    s2 = Song(sections=[Section("v", 4, function="verse"),
                        Section("c", 4, function="chorus"),
                        Section("v2", 4, function="verse"),
                        Section("c2", 4, function="chorus"),
                        Section("b", 4, function="bridge")],
              title="hold the line").layout()
    s2.lines = [Line(f"line {i} hold the line", bar=1 + 4 * i)
                for i in range(5)]
    rep2 = song_function_report(s2, hooks=["hold the line"])
    check("a partly-refused question is one refused question, not several",
          rep2["asked"] == rep2["answered"] + rep2["refused"]
          and rep2["refused"] == 1,
          f"asked {rep2['asked']}, answered {rep2['answered']}, refused "
          f"{rep2['refused']}: {[x.code for x in rep2['refusals']]} — no "
          f"rhyme key was declared, so `rhyme_inventory` was not measured")


def test_the_ask_gate_reaches_every_function_that_is_expected_once():
    """`reprise` was asked by nothing, ever, and answered by nothing either.

    The gate the SINGLE_USE_RECURRED fix installed reads
    `convention.single_use`, and `reprise` -- `recurrence="once"` in the
    vocabulary since it was written -- was not in that tuple. So a song
    declaring two reprises was neither asked the question nor charged the
    finding: the same defect the fix was for, one member further out, because
    the fix keyed on a hand-copied list rather than on the vocabulary's own
    declaration.

    The five `open` functions stay unasked ON PURPOSE and this test says so:
    "open" is the vocabulary declaring that the convention expects nothing
    about how often they occur, and measuring drift against an expectation
    nobody holds is noise on a correct song (doctrine 7).
    """
    print("\n19. THE ASK GATE — reachable, deliberately unreachable, and the "
          "cost on a well-formed song")
    from quality.grid import (POPULAR_SONG, SECTION_FUNCTIONS,
                              song_from_blueprint, song_function_report)

    def report(fns, **kw):
        bp = {"hooks": ["hold the line"],
              "sections": [{"name": f"S{i}", "function": f,
                            "start_bar": 1 + 4 * i, "bars": 4 + i,
                            "lines": [{"text": "hold the line now",
                                       "bar": 1 + 4 * i, "beat": 1,
                                       "duration": 1}]}
                           for i, f in enumerate(fns)]}
        song, hooks = song_from_blueprint(bp)
        return song_function_report(song, hooks=hooks, **kw)

    rep = report(["verse", "reprise", "chorus", "reprise"])
    check("two reprises are ASKED at all", "reprise" in rep["returns"],
          f"questions asked: {sorted(rep['returns'])} + bridge + hook")
    check("and answered: a recurred single-use function is a finding",
          "SINGLE_USE_RECURRED" in {f.code for f in rep["findings"]},
          f"codes: {sorted({f.code for f in rep['findings']})}")

    # Not one function: EVERY function the vocabulary calls "once".
    once_fns = sorted(fn for fn, s in SECTION_FUNCTIONS.items()
                      if s.recurrence == "once")
    missed = [fn for fn in once_fns
              if "SINGLE_USE_RECURRED" not in
              {f.code for f in report(["verse", fn, "chorus", fn])["findings"]}]
    check("every recurrence-'once' function is reachable, not just the "
          "listed ones", not missed, f"silent for: {missed}" if missed else
          f"all {len(once_fns)} of them: {once_fns}")

    # THE DELIBERATE HALF. Recorded as a decision so a later session reads a
    # choice rather than an omission.
    open_fns = sorted(fn for fn, s in SECTION_FUNCTIONS.items()
                      if s.recurrence == "open")
    still_silent = [fn for fn in open_fns
                    if fn not in report(["verse", fn, "chorus", fn])["returns"]]
    check("the five 'open' functions are still not asked, on purpose",
          still_silent == open_fns,
          f"{open_fns} — 'open' means the convention expects nothing about "
          f"how often they occur; a vamp is a repeating figure HELD OPEN and "
          f"reporting that two of them differ in length would be a finding "
          f"against an expectation nobody declared")

    # AND THE COST, MEASURED ON A REAL FIXTURE rather than argued: a
    # well-formed song must report exactly what it reported before. A change
    # that adds a finding here is a regression, not a fix.
    song, hooks = song_from_blueprint(
        os.path.join(HERE, "fixtures", "moonlight_fixture.blueprint.json"))
    real = song_function_report(song, hooks=hooks)
    check("the well-formed fixture gains nothing: same findings as before",
          [f.code for f in real["findings"]]
          == ["RETURN_LOCKED", "HOOK_CONFINED", "TITLE_NOT_IN_HOOK"],
          [f.code for f in real["findings"]])
    check("same refusals, and the same three counts",
          [r.code for r in real["refusals"]] == ["CHANNEL_NOT_MEASURED"]
          and (real["asked"], real["answered"], real["refused"]) == (4, 3, 1),
          f"asked {real['asked']}, answered {real['answered']}, refused "
          f"{real['refused']}")


def test_return_never_returns_is_reached():
    """RETURN_NEVER_RETURNS shipped with no test anywhere in the repo.

    It is the one finding `return_findings` emits from inside its SINGLE
    INSTANCE branch -- a refusal and a finding from the same call, which is
    exactly the pairing that makes it easy to miss: the refusal is the
    conspicuous half.
    """
    print("\n20. a declared chorus the song never comes back to")
    from quality.grid import (POPULAR_SONG, return_findings,
                              song_function_report)

    s = Song(sections=[Section("v1", 8, function="verse"),
                       Section("c", 8, function="chorus"),
                       Section("v2", 8, function="verse")],
             title="one time only").layout()
    s.lines = [Line("a line of words here", bar=b) for b in (1, 9, 17)]
    f, r, _ = return_findings(s, "chorus")
    check("one chorus in the whole song is a finding, not silence",
          "RETURN_NEVER_RETURNS" in {x.code for x in f},
          [x.evidence for x in f][0] if f else "no findings at all")
    check("and the OTHER half of the same branch is a refusal",
          "SINGLE_INSTANCE" in {x.code for x in r},
          "'does it land in the same place each time' has no second time — "
          "CANNOT TELL, not clean (doctrine 28)")
    check("it reaches the report, not only the function under it",
          "RETURN_NEVER_RETURNS" in {x.code for x in
                                     song_function_report(s)["findings"]})

    # THE GATE IS `fixed_return`, not "any single instance". A bridge occurs
    # once by convention, so a song with one bridge must stay silent here.
    b = Song(sections=[Section("v1", 8, function="verse"),
                       Section("c1", 8, function="chorus"),
                       Section("br", 8, function="bridge"),
                       Section("c2", 8, function="chorus")]).layout()
    b.lines = [Line("a line of words here", bar=x) for x in (1, 9, 17, 25)]
    fb, _, _ = return_findings(b, "bridge")
    check("one bridge is not RETURN_NEVER_RETURNS",
          "RETURN_NEVER_RETURNS" not in {x.code for x in fb},
          f"bridge is not in fixed_return "
          f"{list(POPULAR_SONG.fixed_return)} — a bridge appearing once is "
          f"the convention, not a defect")
    fc, _, _ = return_findings(b, "chorus")
    check("and a chorus that DOES return does not earn it either",
          "RETURN_NEVER_RETURNS" not in {x.code for x in fc},
          f"codes: {sorted({x.code for x in fc})}")


# ---------------------------------------------------------------------------
# THE VARIATION LADDER — `compare_returns`, and what it costs to collapse it
#
# `VARIATION_KINDS` is the object doctrine 24 is about: the conjunctive coda
# rule RELABELS instead of deleting, and so does this — a chorus that comes
# back one line short is not "the same" and not "different", it is TRUNCATED,
# and the test of the rule is whether the harness can say MORE afterwards.
# Nothing in this repo checked that it still could. Both tests below were
# written against a surviving mutant (`quality/mutate.py` QG1): drop the two
# unmatched-line conditions from the VERBATIM branch and ten test files,
# `test_grid.py` and `test_song_function.py` among them, stayed green.
#
# Doctrine 94 is why they did. Every assertion this repo owned about
# `compare_returns` was somebody writing a verbatim return and checking that
# it reported VERBATIM — and a rule that is too GENEROUS about VERBATIM passes
# every one of those by construction. Nobody had cut a line and looked.
# ---------------------------------------------------------------------------

#: one chorus, and the shapes its return can take. Written once so the control
#: and the two defects are literally the same words: the ONLY thing that
#: separates them is a line's presence.
CHORUS = ["Hold the line tonight",
          "Hold it till the morning",
          "Nothing in the dark can hurt us now",
          "Hold the line tonight"]


def test_a_return_that_loses_or_gains_a_line_is_not_verbatim():
    """A truncated or extended chorus must not report as an exact return.

    `compare_returns` builds VERBATIM from THREE conditions -- no paired line
    differs, no line of the first is unmatched, no line of the return is --
    and only the first is exercised by a positive case. Drop the other two and
    a return that lost or gained a whole line still reports VERBATIM, because
    every line that survived to be PAIRED is word-for-word identical; the
    difference is the line that is on one side and not the other, which no
    pairwise comparison ever looks at.

    Then the ladder does the rest of the damage. VERBATIM is FIRST in
    `VARIATION_KINDS`, so it wins the `kind` precedence over TRUNCATED_RETURN
    and EXTENDED_RETURN, and those two stop being reportable at all -- three
    named kinds collapsed into one, which is doctrine 24 run backwards.

    ASSERT ON `kind`, NOT ON `qualities`. The qualities set is assembled by
    independent branches and TRUNCATED_RETURN stays in it either way. A check
    written against `qualities` alone passes the exact collapse it exists to
    catch, which is why every assertion below names `kind` and why the
    VERBATIM-is-absent-from-qualities check is written as its own line.
    """
    print("\n21. DOCTRINE 24 INVERTED — a return that LOSES or GAINS a line "
          "is not a VERBATIM return")
    from quality.grid import compare_returns

    # THE CONTROL, FIRST AND ON THE SAME WORDS. A check that fires on
    # everything is not a check: the risk here is a rule too GENEROUS about
    # VERBATIM, and answering it with one too MEAN would trade one wrong
    # answer for another (test 17 makes the same move for HOOK_CONFINED).
    same = compare_returns(CHORUS, list(CHORUS))
    check("a genuinely verbatim return still reports VERBATIM",
          same.kind == "VERBATIM",
          f"kind={same.kind}, qualities={sorted(same.qualities)} — the same "
          f"four lines, unchanged")

    cut = compare_returns(CHORUS, CHORUS[:3])
    check("a chorus whose return DROPS its last line reports "
          "TRUNCATED_RETURN",
          cut.kind == "TRUNCATED_RETURN",
          f"kind={cut.kind}; all three surviving lines are identical, so "
          f"NO PAIRED LINE DIFFERS — the dropped line is the entire "
          f"difference and it is on neither side of any pair")
    check("...and VERBATIM is not even among its qualities",
          "VERBATIM" not in cut.qualities,
          f"qualities={sorted(cut.qualities)} — asserting the kind alone "
          f"would leave the qualities set free to claim both at once, and a "
          f"caller reading `qualities` is reading the same object")

    # INTERIOR, not just the tail: the LCS alignment is what finds this one,
    # and a rule keyed on "the return is a prefix of the first" would miss it.
    inner = compare_returns(CHORUS, [CHORUS[0], CHORUS[2], CHORUS[3]])
    check("a line dropped from the MIDDLE is truncation too",
          inner.kind == "TRUNCATED_RETURN"
          and inner.invariant_lines == (1, 3, 4),
          f"kind={inner.kind}, invariant={inner.invariant_lines} — lines 1, "
          f"3 and 4 of the first are matched and line 2 is unmatched")

    grew = compare_returns(CHORUS[:3], CHORUS)
    check("the same shape the other way round reports EXTENDED_RETURN",
          grew.kind == "EXTENDED_RETURN" and "VERBATIM" not in grew.qualities,
          f"kind={grew.kind}, qualities={sorted(grew.qualities)}")

    added = compare_returns(CHORUS, CHORUS + ["And we are not going home"])
    check("...including the added bar on the last return, where every line "
          "of the first survives verbatim",
          added.kind == "EXTENDED_RETURN"
          and added.invariant_lines == (1, 2, 3, 4),
          f"kind={added.kind}, invariant={added.invariant_lines} — all four "
          f"original lines matched, one new line unmatched. This is the case "
          f"a paired-lines-only rule is most sure about and most wrong")

    # THE RECORD MUST NOT CONTRADICT ITSELF. `kind` and the distances are two
    # readings of one comparison, and a VERBATIM return with four word-edits
    # of distance is not a wrong answer plus a right one -- it is one object
    # saying two things. Written as an invariant over every shape above rather
    # than as a fourth fixture, so a NEW collapse is caught by the same line.
    every = [("verbatim", same), ("tail cut", cut), ("interior cut", inner),
             ("extended", grew), ("bar added", added)]
    bad = [(n, r.kind, r.line_distance, r.token_distance) for n, r in every
           if r.kind == "VERBATIM"
           and not (r.line_distance == 0 and r.token_distance == 0)]
    check("VERBATIM and a non-zero distance are never reported together",
          not bad,
          f"contradictory records: {bad}" if bad else
          "; ".join(f"{n}: {r.kind} line={r.line_distance} "
                    f"token={r.token_distance}" for n, r in every))

    # AND THE BLAST RADIUS, at the layer a writer actually reads. This is the
    # half `quality/test_song_function.py` could have caught and did not.
    _returns_with_same_words_is_not_charged_to_a_cut_verse()


def _returns_with_same_words_is_not_charged_to_a_cut_verse():
    """The collapse reaches `return_findings`, and it accuses the writer.

    `RETURNS_WITH_SAME_WORDS` gates on `kinds == {"VERBATIM"}` and on nothing
    else, so a verse whose second instance is the first minus a line is told
    "every verse returns with IDENTICAL words" -- a finding about a defect it
    does not have, instead of the truncation it does.

    RETURN_LOCKED is the near miss that explains the silence. Its gate carries
    `all(r.tune_slot_preserved)` as well, and dropping a line always changes
    the slot profile, so a truncated CHORUS keeps reporting RETURN_SLOT_DRIFT
    and no report-level code moves. The report layer was catching the truncated
    chorus on the GRID -- a line count -- and never on the WORDS, which is why
    a suite watching finding codes on a chorus fixture saw nothing at all.
    """
    from quality.grid import (Line, Section, Song, SECTION_FUNCTIONS,
                              return_findings)

    verse = ["a quiet road and nothing on it",
             "the rain came down at midnight",
             "morning found the empty road", "and nobody was home"]

    def song(second):
        s = Song(sections=[Section("v1", 4, function="verse"),
                           Section("c1", 4, function="chorus"),
                           Section("v2", 4, function="verse"),
                           Section("c2", 4, function="chorus")]).layout()
        s.lines = ([Line(t, bar=1) for t in verse]
                   + [Line("hold the line tonight", bar=5)]
                   + [Line(t, bar=9) for t in second]
                   + [Line("hold the line tonight", bar=13)])
        return s

    check("a verse is a 'new words' function, so identical words ARE a "
          "finding about it",
          SECTION_FUNCTIONS["verse"].returns_as == "new words"
          and SECTION_FUNCTIONS["chorus"].returns_as == "verbatim",
          f"verse -> {SECTION_FUNCTIONS['verse'].returns_as!r}, chorus -> "
          f"{SECTION_FUNCTIONS['chorus'].returns_as!r}")

    fs, _, rets = return_findings(song(verse), "verse")
    check("the positive case survives: two identical verses ARE charged "
          "RETURNS_WITH_SAME_WORDS",
          "RETURNS_WITH_SAME_WORDS" in {f.code for f in fs}
          and [r.kind for _, _, r in rets] == ["VERBATIM"],
          f"{sorted(f.code for f in fs)}")

    fs2, _, rets2 = return_findings(song(verse[:3]), "verse")
    codes = {f.code for f in fs2}
    check("a verse that comes back one line SHORT is not charged with "
          "returning with identical words",
          "RETURNS_WITH_SAME_WORDS" not in codes,
          f"kinds {[r.kind for _, _, r in rets2]}, findings {sorted(codes)} "
          f"— the gate is `kinds == {{'VERBATIM'}}` and nothing else, so a "
          f"kind collapsed to VERBATIM hands the writer a finding about a "
          f"defect this verse does not have")
    check("...and the truncation is what the return record actually says",
          [r.kind for _, _, r in rets2] == ["TRUNCATED_RETURN"],
          f"{[r.kind for _, _, r in rets2]}")


def test_every_variation_kind_is_reportable():
    """A kind that can never be REPORTED is a check that cannot fail.

    `kind` is `next(k for k, _ in VARIATION_KINDS if k in q)`, so the ladder's
    ORDER decides which observation a reader is shown, and a kind whose every
    input also satisfies something above it is dead vocabulary: present in the
    tuple, glossed in the docstring, never once the answer. Doctrine 48 -- a
    principle that lives only in prose gets followed exactly as often as
    someone remembers it, and the fifteen entries of `VARIATION_KINDS` are a
    promise in prose until something asks each of them to be the answer.

    THIS IS THE AUDIT, RUN AS A TEST rather than reported once. It found
    nothing wrong with the shipped ladder: all fifteen are reportable, so
    nothing was fixed. It fails under QG1 with EXACTLY the two kinds that
    mutation collapses -- TRUNCATED_RETURN and EXTENDED_RETURN -- and the
    other thirteen still reported, which is a sharper fingerprint than "a
    fixture changed answer".

    The fixtures are the evidence and are deliberately minimal: each one is
    the smallest pair that lands on its rung without satisfying a higher one.
    `rime_orthographic` is used for the one rung that needs a phonology
    because this test is about the LADDER and not about English sound -- it is
    a LABELLED proxy (doctrine 45), it says so in its own `declared_name`, and
    reading it as a claim about rhyme would be reading it wrong.
    """
    print("\n22. THE LADDER — every one of the fifteen kinds can be the "
          "REPORTED kind")
    from quality.grid import (VARIATION_KINDS, compare_returns,
                              rime_orthographic)

    fixtures = {
        "STUB": (
            ["Hold the line tonight", "Hold it till the morning"],
            ["Hold the line, &c."], {}),
        "VERBATIM": (CHORUS, list(CHORUS), {}),
        "TRUNCATED_RETURN": (CHORUS, CHORUS[:3], {}),
        "EXTENDED_RETURN": (CHORUS[:3], CHORUS, {}),
        "LEXICAL_VARIATION": (
            ["We will hold the line", "We will wait for morning"],
            ["We did hold the line", "We did wait for morning"], {}),
        "FRAME_PRESERVED": (
            ["Hold the line tonight", "rain against the shutters cold",
             "Hold the line tonight"],
            ["Hold the line tonight", "wind across an empty road",
             "Hold the line tonight"], {}),
        "HEAD_AND_TAIL_PRESERVED": (
            ["hold the rain against the morning light",
             "hold the wind above the morning light"],
            ["hold the empty roads and quiet cars until the morning light",
             "hold the broken glass and silent bells until the morning light"],
            {}),
        "TAIL_PRESERVED": (
            ["rain came falling to the morning light",
             "wind came calling to the morning light"],
            ["empty roads and silent cars beside the morning light",
             "broken glass and quiet bells beside the morning light"], {}),
        "HEAD_PRESERVED": (
            ["hold the rain against the shutters",
             "hold the wind across the road"],
            ["hold the empty roads and quiet cars",
             "hold the broken glass and silent bells"], {}),
        "RHYME_PRESERVING_REWRITE": (
            ["a bitter wind is on the town",
             "the empty streets are burning bright"],
            ["whatever else has fallen down",
             "so many candles carried light"],
            {"rhyme_key": rime_orthographic}),
        "PARTIAL_RETURN": (
            ["Hold the line tonight", "rain against the shutters cold",
             "morning comes for everyone"],
            ["Hold the line tonight", "empty roads and silent cars",
             "quiet bells for no one now"], {}),
        "ANAPHORIC_RETURN": (
            ["still the rain against the shutters cold",
             "morning comes for everyone at last"],
            ["still an empty road and silent cars",
             "quiet bells for no one now my friend"], {}),
        "EPIPHORIC_RETURN": (
            ["rain against the shutters cold at last",
             "morning comes for everyone tonight"],
            ["empty roads and silent cars go by",
             "quiet bells for no one now tonight"], {}),
        "RESTATEMENT": (
            ["the rain came down at midnight",
             "morning found the empty road"],
            ["at midnight down came the rain",
             "the empty road found morning"], {}),
        "REWRITTEN_RETURN": (
            ["the rain came down at midnight",
             "morning found the empty road"],
            ["whistles blow for nobody",
             "so few candles burning bright"], {}),
    }

    ladder = [k for k, _ in VARIATION_KINDS]
    check("every kind in VARIATION_KINDS has a fixture, and every fixture "
          "names a kind",
          sorted(fixtures) == sorted(ladder),
          f"ladder {ladder}\n          fixtures "
          f"{sorted(fixtures)} — half a set equality is not a set equality "
          f"(test 16 learned this the hard way), so a kind added to the "
          f"vocabulary without a fixture fails HERE rather than going "
          f"unreachable in silence")

    unreportable = []
    for kind in ladder:
        first, again, kw = fixtures[kind]
        got = compare_returns(first, again, **kw)
        if got.kind != kind:
            unreportable.append((kind, got.kind, sorted(got.qualities)))
    check("all fifteen are reachable as the reported kind — no rung of the "
          "ladder is shadowed by the one above it",
          not unreportable,
          "\n          ".join(f"{k} is UNREPORTABLE: its own fixture came "
                              f"back {g}, qualities {q}"
                              for k, g, q in unreportable)
          if unreportable else
          f"{len(ladder)} kinds, {len(ladder)} reported: {ladder}")


# ---------------------------------------------------------------------------
# THE CORPUS READER'S APPARATUS RULE — `read_marked_songs`, and the one
# definition it now calls instead of half-spelling its own
# ---------------------------------------------------------------------------


def test_read_marked_songs_drops_apparatus_by_the_one_rule():
    """`read_marked_songs` scored a stage direction as a lyric, and the reason
    was a bracket with no closing `]`.

    THE THREE STRUCTURAL TESTS AND THE ONE CONTENT TEST, and the whole defect
    is that the fourth was missing. `--- TITLE:` opens a song; `#`/`--- `
    skips a header or source note; `_MARK_RE = ^\\[([^\\]]*)\\]` opens a block.
    All three are about STRUCTURE and their ORDER is load-bearing --
    `[VERSE 1]` IS apparatus by `lyric_harness.is_apparatus_line` and is
    nonetheless the thing that opens a block, so the mark test has to be asked
    first or the reader stops reading blocks at all. The append branch had no
    test whatever, so anything that reached it was a line of the song:

      * `[Exeunt.` has no `]`, so `_MARK_RE` does not match, so it fell
        through and was scored as sung text. Same for `[Drinks.`, `[Rises.`,
        `[Music:` and `[_Exeunt omnes._`.
      * the `#` and `--- ` tests above read the RAW line, so an indented one
        reached the append branch too.
      * and `--- ` is not the centre's rule: `----"'Tis not merely` is
        apparatus everywhere else in this repo (the same four-hyphen epigraph
        that moved `quality/readability.py`'s denominator by 4).

    THE FIXTURE IS THE FOUR CASES AND THEIR CONTROLS, and the controls are the
    half that matters: a mark must still OPEN a block, a mark's trailing text
    must still be an ANNOTATION, and an ordinary line beginning with a word
    must be untouched. A test that only proved lines get dropped would pass on
    a reader that dropped everything.
    """
    print("\n23. `read_marked_songs` — the apparatus rule is the CENTRE's, "
          "and the mark test still runs first")
    import tempfile
    from lyric_harness import is_apparatus_line
    from quality.grid import read_marked_songs

    text = "\n".join([
        "# a header comment, dropped before any song opens",
        "--- TITLE: The Fixture",
        "--- Source: nowhere, constructed",
        "[VERSE 1] (an annotation on the mark's own line)",
        "Hold the line tonight",
        "[Exeunt.",
        "  # an indented comment, which the raw-line test never saw",
        "  --- an indented source note, likewise",
        "----“An epigraph opening on four hyphens",
        "Rain against the shutters cold",
        "[CHORUS]",
        "[Drinks.",
        "[VERSE 2]",
        "Morning found the empty road",
        "",
    ])
    d = tempfile.mkdtemp(prefix="grid_apparatus_")
    p = os.path.join(d, "eng_fixture.txt")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(text)

    songs = read_marked_songs(p, language="eng")
    check("one song, opened by `--- TITLE:` and titled from it",
          len(songs) == 1 and songs[0].title == "The Fixture",
          f"{[s.title for s in songs]}")
    blocks = songs[0].blocks
    check("three blocks, and the marks still OPEN them — the apparatus rule "
          "is asked AFTER `_MARK_RE`, never before it",
          [b.mark for b in blocks] == ["VERSE 1", "CHORUS", "VERSE 2"],
          f"{[b.mark for b in blocks]} — every one of these is apparatus by "
          f"`is_apparatus_line`, so a reader that dropped apparatus first "
          f"would report NO blocks at all")
    check("the mark's trailing text is still an ANNOTATION and not a fifth "
          "line", blocks[0].annotation ==
          "(an annotation on the mark's own line)",
          repr(blocks[0].annotation))
    check("VERSE 1 keeps its two sung lines and drops the four apparatus "
          "lines between them",
          blocks[0].lines == ["Hold the line tonight",
                              "Rain against the shutters cold"],
          f"{blocks[0].lines} — dropped `[Exeunt.` (a `[` with no `]`, which "
          f"`_MARK_RE` cannot match), an indented `#`, an indented `---`, "
          f"and a four-hyphen epigraph that `--- ` never matched")
    check("VERSE 2 keeps its one line", blocks[2].lines ==
          ["Morning found the empty road"], f"{blocks[2].lines}")

    survivors = [l for b in blocks for l in b.lines if is_apparatus_line(l)]
    check("NO line of any block is apparatus by the one definition — stated "
          "as the invariant rather than as four cases, because the four cases "
          "are what a second spelling of the rule always passes",
          not survivors, f"survivors: {survivors}")

    # THE EMPTIED BLOCK, AND WHAT READS IT. `[CHORUS]` here is followed by
    # `[Drinks.` and nothing else, which is exactly Gay's shape in
    # `eng_hall_john_gay.txt` and 13 more like it corpus-wide. The block is
    # now EMPTY, and that is the correct reading -- a chorus whose whole
    # printed content is a stage direction has no words -- so what has to be
    # shown is that nothing downstream indexes it. Every reader of
    # `Block.lines` in this repo passes the list to `compare_returns`
    # (`quality/test_song_function.py`, two sites); grep found no third.
    check("the emptied block is EMPTY, not absent — the mark is still read, "
          "so the song still has a chorus with no words in it",
          blocks[1].mark == "CHORUS" and blocks[1].lines == [],
          f"{blocks[1].mark}: {blocks[1].lines}")

    from quality.grid import compare_returns, rime_orthographic
    empties = {
        "both sides empty": ([], []),
        "empty return of a real block": (list(CHORUS), []),
        "real return of an empty block": ([], list(CHORUS)),
    }
    landed = {}
    for name, (a, b) in empties.items():
        landed[name] = (compare_returns(a, b).kind,
                        compare_returns(a, b,
                                        rhyme_key=rime_orthographic).kind)
    check("`compare_returns` answers on an empty block from either side, "
          "with and without a phonology — no unguarded index, no exception",
          landed["both sides empty"] == ("VERBATIM", "VERBATIM")
          and landed["empty return of a real block"][0] == "TRUNCATED_RETURN"
          and landed["real return of an empty block"][0] == "EXTENDED_RETURN",
          "; ".join(f"{k} -> {v[0]}/{v[1]}" for k, v in landed.items())
          + " — TRUNCATED and EXTENDED are the honest answers: a return that "
            "prints no lines against one that prints four HAS lost four")


# ---------------------------------------------------------------------------
# THE CROSS-FUNCTION REPRISE — the primitive existed and nothing called it
# this way (CLAUDE.md known gap 7, the half that was still open)
#
# `compare_returns` takes two LINE LISTS. `return_findings` only ever fed it
# `song.instances_of(fn)` — two returns of ONE declared function — so "does
# the outro come back to the intro" was unaskable while the machinery that
# answers it sat in the same file, fully tested, on the wrong pair.
#
# THE DESIGN IS THE ASKED SET, not the comparison. Every ordered pair is 420
# questions on a 21-function vocabulary and is measurably wrong: section 10 of
# `quality/test_song_function.py` runs the rule over `corpus/song/` and finds
# 51 of 889 cross-function block pairs sharing a whole line, none of them a
# reprise. So the set is `FormConvention.reprises`, DECLARED beside the other
# expectations a genre may override, and the tests below are about that field
# as much as about the check.
# ---------------------------------------------------------------------------

#: An intro whose material returns — `SECTION_FUNCTIONS["intro"]`'s own gloss
#: says it may, and it is the only entry in the vocabulary that says so.
INTRO = ["the wire hums low across the yard",
         "a counted step a counted breath"]

#: The outro the gap register named: the intro, plus a close. Written from
#: `INTRO` itself rather than retyped, so the positive case cannot drift away
#: from the thing it is a positive case OF.
OUTRO_REPRISE = INTRO + ["and the count goes on without a sum"]

#: THE CONTROL. Same line count, same length, same voice, same closing line as
#: the reprise above — and not one line of the intro in it.
OUTRO_FRESH = ["the light goes out along the fence",
               "a shuttered room a folded coat",
               "and the count goes on without a sum"]

#: THE FALSE POSITIVE, which is the risk this check actually runs. Same
#: opening formula, same content words in a different order, heavy token
#: overlap — a writer's voice, not a reprise. It lands on a NAMED variation
#: kind (HEAD_PRESERVED), which is exactly why the threshold cannot be "the
#: kind is one of these": no whole line survives, and a reader asked to check
#: "the outro reprises the intro" by eye would find nothing to point at.
OUTRO_ECHO = ["the wire that hums is low across the yard",
              "a counted breath a counted step",
              "and the count goes on without a sum"]

VERSE = ["a folded map a steady hand",
         "the gate keeps time the way it can"]
CHORUS_LINES = ["we counted every reason we were given",
                "we numbered every corner of the room"]


def _reprise_song(outro, intro=INTRO, chorus=None, outro_first=False):
    """intro / verse / chorus / outro, laid end to end, one bar per line.

    `outro_first` swaps the two single-use sections' POSITIONS and nothing
    else — the ordered-pair rule has to be tested on a song where the only
    thing wrong is the order.
    """
    chorus = list(CHORUS_LINES if chorus is None else chorus)
    blocks = [("i", "intro", list(intro)), ("v", "verse", list(VERSE)),
              ("c", "chorus", chorus), ("o", "outro", list(outro))]
    if outro_first:
        blocks = [blocks[3], blocks[1], blocks[2], blocks[0]]
    # `layout()` assigns the start bars, so the LINES are placed from the
    # sections afterwards rather than from a second counter that would have
    # to agree with it. A section with no lines still occupies a bar — an
    # instrumental outro is a span of the song.
    s = Song(sections=[Section(n, max(len(t), 1), function=f)
                       for n, f, t in blocks],
             title="The Count").layout()
    s.lines = [Line(t, bar=sec.start_bar + j, duration=F(4))
               for sec, (_, _, texts) in zip(s.sections, blocks)
               for j, t in enumerate(texts)]
    return s


def _codes(fs):
    return sorted({x.code for x in fs})


def test_a_reprise_is_a_relation_between_two_DIFFERENT_functions():
    """Known gap 7's open half: the primitive exists, nothing calls it across
    two functions.

    Four things are under test and only the first is the comparison:
    that `compare_returns` was ALWAYS call-compatible with a cross-function
    pair; that the pair asked is a DECLARED coordinate rather than a list
    baked into the check; that a song sharing a language across two sections
    stays quiet; and that a song with only one side of a pair is not ASKED at
    all rather than refused on every run.
    """
    print("\n24. THE CROSS-FUNCTION REPRISE — does the outro come back to "
          "the intro?")
    import inspect as _inspect
    from quality.grid import (FormConvention, POPULAR_SONG, SECTION_FUNCTIONS,
                              compare_returns, reprise_findings,
                              song_function_report)

    # -- 1. the gap's own claim, verified rather than repeated --------------
    params = list(_inspect.signature(compare_returns).parameters)
    check("`compare_returns` takes two LINE LISTS and nothing that names a "
          "section, a function, or an instance index — it was call-compatible "
          "with a cross-function pair from the day it was written",
          params[:2] == ["first", "again"]
          and not ({"section", "function", "instance"} & set(params)),
          f"signature: {params}")
    cross = compare_returns(INTRO, OUTRO_REPRISE)
    check("...and handed one intro and one outro it answers on the same "
          "ladder, with no special case",
          cross.kind == "EXTENDED_RETURN"
          and cross.invariant_lines == (1, 2),
          f"kind={cross.kind}, invariant={list(cross.invariant_lines)} — "
          f"'outro-extends-intro' is EXTENDED_RETURN in the ladder's own "
          f"vocabulary. The primitive was never the missing piece")

    # -- 2. the positive case ----------------------------------------------
    f, r, reps = reprise_findings(_reprise_song(OUTRO_REPRISE))
    check("an outro built on the intro's lines IS found",
          _codes(f) == ["CROSS_FUNCTION_REPRISE"] and not r,
          f"findings {_codes(f)}, refusals {_codes(r)}")
    ev = f[0].evidence if f else ""
    check("and the finding names the KIND, the LINES and the THRESHOLD — not "
          "a boolean",
          "EXTENDED_RETURN" in ev and "[1, 2]" in ev
          and "reprise_min_lines=1" in ev,
          ev[:150])

    # -- 3. the negative case, on the same words ---------------------------
    f2, r2, _ = reprise_findings(_reprise_song(OUTRO_FRESH))
    check("a DIFFERENT outro of the same length comes back clean — no "
          "finding, and no refusal either: this was asked and answered",
          not f2 and not r2,
          f"findings {_codes(f2)}, refusals {_codes(r2)}")

    # -- 4. THE FALSE POSITIVE, which is the real risk ---------------------
    echo = _reprise_song(OUTRO_ECHO)
    f3, r3, reps3 = reprise_findings(echo)
    # NOT `reps3[0]` — a mutant that stops the comparison happening must
    # report a FAILING CHECK, not raise an IndexError out of the assertion
    # written to catch it (a crashed test says the suite is broken; this one
    # has to say which claim is false).
    seen = [(x.kind, len(x.invariant_lines)) for _, _, x in reps3]
    check("two sections that share a LANGUAGE and no whole line stay quiet",
          not f3 and not r3 and seen == [("HEAD_PRESERVED", 0)],
          f"the comparison happened and landed on {seen} — a NAMED variation "
          f"kind with no invariant line. A threshold written as 'the kind is "
          f"one of these six' would report a reprise here; keyed on "
          f"`Return.invariant_lines` it does not")
    check("...and the quiet is not the check being broken: the same song "
          "reports the reprise as soon as ONE line is held",
          _codes(reprise_findings(
              _reprise_song([INTRO[0]] + OUTRO_ECHO[1:]))[0])
          == ["CROSS_FUNCTION_REPRISE"],
          "one line of OUTRO_ECHO restored to the intro's wording, nothing "
          "else touched")
    # AND THE THRESHOLD IS WHAT IS DOING IT, shown by declaring it away rather
    # than by argument. `reprise_min_lines=0` is a legal declaration -- "every
    # comparison counts" -- and it is the shape of the rule this design
    # REJECTED: any two sections that landed on a named kind. On this fixture
    # that rule reports a reprise between an intro and an outro sharing no
    # whole line, which is the false positive, made visible.
    check("declaring the threshold to 0 makes the SAME song report a reprise "
          "— so the quiet above is the threshold and not the fixture",
          _codes(reprise_findings(
              echo, convention=FormConvention(reprise_min_lines=0))[0])
          == ["CROSS_FUNCTION_REPRISE"],
          "doctrine 94: a positive-case suite cannot find a rule that is too "
          "GENEROUS, so the generous rule is run here on purpose")

    # -- 5. the asked set is a COORDINATE, not a list in the check ---------
    # The task the design answers: a verse does not reprise a chorus, it
    # shares a language with it. Here the verse and the chorus DO share a
    # whole line — the strongest possible case — and the default says nothing,
    # because the pair is not in `reprises`.
    shared = _reprise_song(OUTRO_FRESH, chorus=[VERSE[0]] + CHORUS_LINES[1:])
    rep = song_function_report(shared)
    check("a verse and a chorus sharing a WHOLE LINE report no reprise under "
          "the default convention — the pair is not asked",
          "CROSS_FUNCTION_REPRISE" not in {x.code for x in rep["findings"]}
          and ("chorus", "verse") not in rep["reprises"],
          f"pairs asked: {sorted(rep['reprises'])}; findings "
          f"{_codes(rep['findings'])}")
    declared = FormConvention(reprises=(("chorus", "verse"),))
    rep2 = song_function_report(shared, convention=declared)
    check("...and the SAME song answers it when a convention declares the "
          "pair — which is what makes this a coordinate and not a hard-coded "
          "list",
          "CROSS_FUNCTION_REPRISE" in {x.code for x in rep2["findings"]}
          and ("chorus", "verse") in rep2["reprises"],
          f"pairs asked: {sorted(rep2['reprises'])}; findings "
          f"{_codes(rep2['findings'])} — doctrine 45: the expectation in "
          f"force is declared by whoever is asking, and POPULAR_SONG is one "
          f"answer rather than the only one")

    # -- 6. the ORDER in the ordered pair ----------------------------------
    f4, r4, _ = reprise_findings(_reprise_song(OUTRO_REPRISE,
                                               outro_first=True))
    check("an outro that comes BEFORE the intro is refused, not reported — "
          "the pair is ordered and the bars are what enforce it",
          not f4 and _codes(r4) == ["REPRISE_IS_NOT_LATER"],
          f"findings {_codes(f4)}, refusals {_codes(r4)}. The two sections "
          f"share both lines; what they do not share is an order in which "
          f"one can come back to the other")

    # -- 7. a side with no words -------------------------------------------
    silent = _reprise_song([])
    f5, r5, _ = reprise_findings(silent)
    check("an instrumental outro REFUSES rather than reporting a reprise — "
          "`compare_returns` reads two empty line lists as VERBATIM and that "
          "is correct arithmetic and a false reprise here",
          not f5 and _codes(r5) == ["REPRISE_SIDE_HAS_NO_WORDS"],
          f"findings {_codes(f5)}, refusals {_codes(r5)} (doctrine 28: "
          f"'no words' and 'no reprise' are two answers)")

    # -- 8. THE COST ON A SONG THAT HAS ONE SIDE OF THE PAIR ---------------
    # The gate is BOTH SIDES PRESENT. Called directly, a missing side
    # refuses; asked through the report, it is not asked at all — otherwise
    # every song with an outro and no intro pays a refusal for not having a
    # section, and the three counts start reporting well-formed songs as
    # partly refused (the same move `SINGLE_USE_RECURRED`'s count>1 gate
    # makes).
    _, r6, _ = reprise_findings(Song(sections=[
        Section("o", 2, function="outro")], lines=[Line("x", bar=1)]))
    check("called DIRECTLY with one side missing, it refuses",
          _codes(r6) == ["REPRISE_SIDE_UNDECLARED"], _codes(r6))
    moon, hooks = song_from_blueprint(
        os.path.join(HERE, "fixtures", "moonlight_fixture.blueprint.json"))
    real = song_function_report(moon, hooks=hooks)
    check("asked through the report on the well-formed fixture — verse, "
          "chorus, bridge and no intro, outro or reprise — NOTHING is asked "
          "and nothing is refused",
          not real["reprises"]
          and [f.code for f in real["findings"]]
          == ["RETURN_LOCKED", "HOOK_CONFINED", "TITLE_NOT_IN_HOOK"]
          and (real["asked"], real["answered"], real["refused"]) == (4, 3, 1),
          f"pairs asked: {sorted(real['reprises'])}; asked {real['asked']} "
          f"answered {real['answered']} refused {real['refused']} — the same "
          f"three counts section 19 pins, unchanged by this layer")

    # -- 9. the declared set itself ----------------------------------------
    # Pinned in BOTH directions, because half a set check is how `reprise`
    # got past `single_use` for the life of the module (section 16).
    bad = [p for p in POPULAR_SONG.reprises
           if len(p) != 2 or p[0] == p[1]
           or not set(p) <= set(SECTION_FUNCTIONS)]
    check("every declared pair names two DIFFERENT functions and both are in "
          "the vocabulary", not bad,
          f"malformed: {bad}" if bad else
          f"{list(POPULAR_SONG.reprises)} — a pair naming one function twice "
          f"is `return_findings`' question, already asked and answered there")
    check("the threshold is a DECLARED coordinate carrying a number, not an "
          "`if` inside the check (doctrine 58)",
          POPULAR_SONG.reprise_min_lines == 1
          and "reprise_min_lines" in FormConvention.__dataclass_fields__,
          f"reprise_min_lines={POPULAR_SONG.reprise_min_lines}")
    check("and raising it silences the positive case, which is what makes it "
          "a threshold rather than a decoration",
          not reprise_findings(
              _reprise_song(OUTRO_REPRISE),
              convention=FormConvention(reprise_min_lines=3))[0],
          "the intro holds 2 lines; asked for 3, the same song answers no")


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
               test_song_from_blueprint_float_beats_are_exact,
               test_a_recurred_single_use_function_is_reported,
               test_hook_confined_and_the_undeclared_landing,
               test_the_three_counts_all_count_questions,
               test_the_ask_gate_reaches_every_function_that_is_expected_once,
               test_return_never_returns_is_reached,
               test_a_return_that_loses_or_gains_a_line_is_not_verbatim,
               test_every_variation_kind_is_reportable,
               test_read_marked_songs_drops_apparatus_by_the_one_rule,
               test_a_reprise_is_a_relation_between_two_DIFFERENT_functions):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all grid regressions pass")
