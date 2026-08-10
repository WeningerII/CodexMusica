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
from quality.grid import (Line, Meter, Section, Song,              # noqa: E402
                          phrase_profile, stanza_lock, uniformity)

FAILURES = []


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
    check("6/8 is compound and subdivides 3+3",
          Meter(6, 8).compound and Meter(6, 8).pulse_groups == (3, 3))
    check("12/8 subdivides into four groups of three",
          Meter(12, 8).pulse_groups == (3, 3, 3, 3))
    check("5/4 is simple and five-pulsed",
          Meter(5, 4).pulse_groups == (1, 1, 1, 1, 1))
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


if __name__ == "__main__":
    for fn in (test_the_model_cannot_express_a_stanza,
               test_meter_is_arbitrary,
               test_lines_key_on_bar_range_not_name,
               test_stanza_lock_fires_on_the_default,
               test_a_real_structure_clears_it,
               test_the_grid_hands_off_to_the_scheme_layer_without_chunking):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all grid regressions pass")
