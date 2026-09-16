#!/usr/bin/env python3
"""Regressions for the metric-cycle space.

The load-bearing test is test_an_undeclared_grouping_is_refused. The old
`grid.Meter` did not fail to express a grouping — it ASSERTED one, returning
(3,3,3) for 9/8 where Balkan daichovo is 2+2+2+3. A wrong answer delivered
confidently is worse than a refusal, and that is the behaviour this file pins.

Run: python3 quality/test_meter.py
"""

import os
import sys
import unittest
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.meter import (CATALOGUE, Cycle, Density, Marker,  # noqa: E402
                           MeterMap, Polymeter, Polyrhythm, compositions,
                           get_named, lcm_fraction, n_compositions,
                           register_named)

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


def test_duration_is_an_exact_rational():
    print("\n1. .125/1 through 64/32, exact, with no special cases")
    cases = {(F(1, 8), 1): F(1, 8), (F(5, 2), 4): F(5, 8), (3, 4): F(3, 4),
             (64, 32): F(2), (12, 16): F(3, 4), (4, 3): F(4, 3),
             (5, 6): F(5, 6), (13, 8): F(13, 8)}
    for (n, u), want in cases.items():
        c = Cycle(pulses=n, unit=u)
        check(f"{c.signature:>8} -> {want} whole-notes", c.duration == want)
    check("a FRACTIONAL numerator is not a special case",
          Cycle(pulses=F(5, 2), unit=4).duration == F(5, 8),
          "2.5/4 — `beats: int` could not hold this at all")
    check("a non-power-of-two denominator is DECLARED, not rejected",
          Cycle(pulses=4, unit=3).irrational
          and not Cycle(pulses=4, unit=4).irrational,
          "4/3 is four third-notes; 'irrational' names the denominator, not a "
          "number")
    check("12/16 and 3/4 are the same duration and different signatures",
          Cycle(pulses=12, unit=16).duration == Cycle(pulses=3, unit=4).duration
          and Cycle(pulses=12, unit=16).signature != "3/4")
    check("a non-positive cycle is refused",
          _raises(lambda: Cycle(pulses=0, unit=4))
          and _raises(lambda: Cycle(pulses=4, unit=0)))


def test_the_grouping_space_is_compositions():
    print("\n2. groupings are ORDERED compositions — 2^(n-1), not partitions")
    for n in (1, 2, 3, 4, 5, 7, 9, 11):
        got = list(compositions(n))
        check(f"{n} pulses -> {n_compositions(n)} orderings",
              len(got) == n_compositions(n) == 2 ** (n - 1)
              and len(set(got)) == len(got))
    check("(2,2,3) and (3,2,2) are BOTH present and different",
          (2, 2, 3) in set(compositions(7)) and (3, 2, 2) in set(compositions(7)),
          "ordered — this is what separates a rachenitsa from its mirror")
    check("every composition exhausts the cycle",
          all(sum(c) == 7 for c in compositions(7)))


def test_an_undeclared_grouping_is_refused():
    print("\n3. THE ONE THAT MATTERS — it used to assert, now it refuses")
    check("9/8 undeclared returns None",
          Cycle(pulses=9, unit=8).pulse_groups() is None,
          "it returned (3,3,3), the European reading, over Balkan daichovo")
    check("7/8 undeclared returns None",
          Cycle(pulses=7, unit=8).pulse_groups() is None,
          "it returned seven single pulses, which is not a grouping")
    d = Cycle(pulses=9, unit=8, groups=(2, 2, 2, 3), name="daichovo-shape")
    e = Cycle(pulses=9, unit=8, groups=(3, 3, 3))
    check("a declared grouping comes back exactly",
          d.pulse_groups() == (2, 2, 2, 3) and e.pulse_groups() == (3, 3, 3))
    check("and the two are distinguishable, which they were not",
          d.pulse_groups() != e.pulse_groups()
          and d.group_starts() == (0, 2, 4, 6)
          and e.group_starts() == (0, 3, 6))
    check("the convention exists SEPARATELY and is labelled one",
          Cycle(pulses=9, unit=8).conventional_grouping() == (3, 3, 3)
          and Cycle(pulses=6, unit=8).conventional_grouping() == (3, 3),
          "available on request, never a default")
    check("a cycle knows the 255 meters it is distinguished FROM",
          len(d.variants()) == 255)
    check("a grouping that does not exhaust the cycle is refused",
          _raises(lambda: Cycle(pulses=7, unit=8, groups=(2, 2))))


def test_concurrency_and_ratio_are_different_things():
    print("\n4. polymeter vs polyrhythm — independent barlines vs one span")
    pm = Polymeter(cycles=(Cycle(pulses=3, unit=4), Cycle(pulses=4, unit=4)))
    check("3/4 against 4/4 realigns after 3 whole-notes",
          pm.period() == F(3) and pm.realignment() == {0: F(4), 1: F(3)},
          "four bars of three against three bars of four")
    pm2 = Polymeter(cycles=(Cycle(pulses=5, unit=8), Cycle(pulses=7, unit=8)))
    check("5/8 against 7/8 realigns after 35/8",
          pm2.period() == F(35, 8))
    check("lcm is computed on FRACTIONS, not integers",
          lcm_fraction(F(3, 4), F(4, 4)) == F(3)
          and lcm_fraction(F(2, 3), F(1, 2)) == F(2))
    pr = Polyrhythm(span=F(1), ratios=(3, 2))
    check("3:2 shares one span and resolves at 1/6",
          pr.resolution() == 6 and pr.grid()[0] == 0 and len(pr.grid()) == 4)
    check("4:3 resolves at 1/12", Polyrhythm(ratios=(4, 3)).resolution() == 12)
    check("polyrhythm and polymeter are different classes on purpose",
          Polyrhythm is not Polymeter)


def test_labelled_and_typed_cycles():
    print("\n5. an usul is not a grouping — position IDENTITY matters")
    iqa = Cycle(pulses=8, unit=8, labels=("D", "T", "-", "T", "-", "T", "D", "-"))
    check("every position carries a label", len(iqa.labels) == 8)
    check("a partial labelling is refused",
          _raises(lambda: Cycle(pulses=8, unit=8, labels=("D", "T"))),
          "a labelled cycle labels EVERY position; '-' is a rest, not a gap")
    check("labels do not imply a grouping", iqa.pulse_groups() is None,
          "D T - T / - T D - is stroke identity, not accent structure")
    t = Cycle(pulses=8, unit=4, groups=(4, 2, 2),
              group_labels=("laghu", "drutam", "drutam"))
    check("groups may be TYPED — a tala's angas",
          t.group_labels == ("laghu", "drutam", "drutam")
          and t.group_starts() == (0, 4, 6))
    check("group_labels must run parallel to groups",
          _raises(lambda: Cycle(pulses=8, unit=4, groups=(4, 2, 2),
                                group_labels=("laghu",))))


def test_nesting_marks_and_the_missing_origin():
    print("\n6. colotomic nesting, marked positions, and no canonical beat 1")
    g = Cycle(pulses=16, unit=4,
              markers=(Marker("gong", 16), Marker("kenong", 4),
                       Marker("kempul", 4, phase=2)))
    pos = g.marker_positions()
    check("nested periodicities resolve with phase",
          pos["gong"] == (0,) and pos["kenong"] == (0, 4, 8, 12)
          and pos["kempul"] == (2, 6, 10, 14),
          "the kempul sits OFFSET between the kenongs — phase is the point")
    tt = Cycle(pulses=16, unit=4, groups=(4, 4, 4, 4), sam=1, khali=(9,))
    check("marked positions are separate from grouping",
          tt.sam == 1 and tt.khali == (9,) and tt.pulse_groups() == (4, 4, 4, 4))
    check("origin=None is POLYCENTRIC and says so",
          Cycle(pulses=12, unit=8, origin=None).polycentric
          and not Cycle(pulses=12, unit=8).polycentric,
          "no privileged downbeat — the setting that breaks every "
          "representation quietly assuming one exists")


def test_mixed_meter_and_density():
    print("\n7. meter as a function of bar; density is NOT a meter change")
    mm = MeterMap(default=Cycle(pulses=4, unit=4),
                  changes={5: Cycle(pulses=7, unit=8, groups=(2, 2, 3))})
    check("meter resolves per BAR, not per section",
          mm.at(4).signature == "4/4" and mm.at(5).signature == "7/8"
          and mm.at(9).signature == "7/8" and mm.is_mixed())
    check("an unmixed map says so", not MeterMap().is_mixed())
    d = Density(level="II", ratio=F(2))
    check("irama doubles the layer against an UNCHANGED frame",
          d.against(Cycle(pulses=16, unit=4)) == 32,
          "storing this as a meter change would say the frame moved, and the "
          "frame is exactly what does not move")
    check("Density is deliberately not a Cycle", not isinstance(d, Cycle))


def test_the_catalogue_is_empty_and_refuses():
    print("\n8. the catalogues are absent, and it says so instead of guessing")
    check("nothing is pre-registered", CATALOGUE == {})
    check("get_named raises with what is missing named",
          _raises(lambda: get_named("teental")))
    try:
        get_named("teental")
    except KeyError as e:
        msg = str(e)
        # The key is pinned WITH its register prefix. quality/triage.py's
        # m_win only sees a key when the literal MISSING sits within
        # MISSING_NEAR characters of it, so a bare "MISSING.md" here left
        # C-2 reading CITED (a module names it, no test guards it) when it
        # was DECLARED. Same move as test_fit.py section 12, and stricter:
        # a refusal that renames its citation now fails.
        check("and the message names the scale of the gap and its entry",
              "35 talas" in msg and "usul" in msg and "MISSING.md C-2" in msg,
              "35 talas, 100+ usuls, ~100 iqa'at, the gamelan forms, the "
              "compases and the timelines all need SOURCING")
    check("an entry without a SOURCE is refused",
          _raises(lambda: register_named(Cycle(pulses=16, unit=4,
                                               name="teental"))),
          "a catalogue entry written from memory is unsourced data in the "
          "evidence base — the refusal the parlour cell made about lyrics it "
          "could recite")
    ok = register_named(Cycle(pulses=16, unit=4, name="demo",
                              source="STRUCTURE DEMO, not a real entry"))
    check("a sourced entry registers", get_named("demo") is ok)
    CATALOGUE.clear()



class MetricComplexityTests(unittest.TestCase):
    """MISSING.md C-3: declarations compute results through production readers."""

    def test_modulation_direction_and_beat_units(self):
        from quality.metric_complexity import MetricModulation
        # Old dotted quarter = new quarter: quarter BPM slows from 120 to 80.
        m = MetricModulation('3/8', '1/4', '1/4', '1/4', old_bpm=120)
        self.assertEqual(m.result(), {'tempo_multiplier': F(2, 3), 'new_bpm': 80})
        # Same old pivot now counted as the new dotted-quarter beat.
        self.assertEqual(MetricModulation('3/8', '3/8', '1/4', '3/8').multiplier, F(2, 3))
        self.assertIsNone(MetricModulation('1/4', '3/8', '1/4', '1/4').result()['new_bpm'])

    def test_nested_tuplets_conserve_duration(self):
        from quality.metric_complexity import Tuplet
        t = Tuplet(3, 2, '1/2')
        self.assertEqual(t.result()['onsets'], (0, F(1, 3), F(2, 3)))
        self.assertEqual(t.span, 1)
        nested = Tuplet(5, 4, '1/4', parent_scale=t.result()['scale'])
        self.assertEqual(nested.result()['note_duration'], F(2, 15))
        self.assertEqual(nested.span, F(2, 3))

    def test_hemiola_directions_and_modes(self):
        from quality.metric_complexity import Hemiola
        h = Hemiola(6, start=2)
        self.assertEqual(h.result(), {'reference_onsets': (2, 5), 'target_onsets': (2, 4, 6)})
        self.assertEqual(Hemiola(6, target_groups=2, mode='simultaneous').result()['target_onsets'], (0, 3))

    def test_continuous_swing_exact_pair_conservation(self):
        from quality.metric_complexity import Swing
        for ratio in ('1', '2', '1.37', '1/3', '200.001'):
            s = Swing(ratio, 1, 3, start='1/4')
            a, b = s.result()['durations']
            self.assertEqual(a / b, F(ratio))
            self.assertEqual(a + b, 1)
            self.assertEqual(s.result()['onsets'][2], F(5, 4))
        self.assertEqual(Swing('1.37', 1, 1).result()['onsets'][1], F(137, 237))

    def test_rubato_is_monotonic_relative_time_not_tempo(self):
        from quality.metric_complexity import Rubato
        r = Rubato(4, anchors=((0, 0), (2, 3), (4, 4)))
        self.assertEqual(r.performed_at(1), F(3, 2))
        self.assertEqual(r.performed_at(3), F(7, 2))
        self.assertEqual(r.performed_at(4), 4)
        self.assertIsNone(Rubato(4, mode='senza_misura').performed_at(1))
        self.assertEqual(Rubato(4).result()['timing'], 'unknown')
        with self.assertRaises(ValueError):
            r.performed_at(5)

    def test_hypermeter_uses_bars_and_wraps_phase(self):
        from quality.metric_complexity import Hypermeter
        h = Hypermeter((2, 3), phase=1).result(12)
        self.assertEqual(h['period_bars'], 5)
        self.assertEqual(h['cycle_heads'], (1, 6, 11))
        self.assertEqual(h['group_heads'], (1, 3, 6, 8, 11))
        self.assertEqual(Hypermeter((2, 2), phase=3).result(5)['group_heads'], (1, 3))

    def test_metric_dissonance_distinguishes_layers(self):
        from quality.metric_complexity import MetricDissonance
        g = MetricDissonance(3, 2, 12).result()
        self.assertTrue(g['grouping'])
        self.assertFalse(g['displacement'])
        self.assertEqual(g['composite_period'], 6)
        self.assertEqual(set(g['reference_onsets']) & set(g['competing_onsets']), {0, 6})
        d = MetricDissonance(2, 2, 8, competing_phase=1).result()
        self.assertTrue(d['displacement'])
        self.assertFalse(d['grouping'])
        nested = MetricDissonance(2, 4, 8).result()
        self.assertFalse(nested['grouping'] or nested['displacement'])
        both = MetricDissonance(3, 2, 8, competing_phase='1/2').result()
        self.assertTrue(both['grouping'] and both['displacement'])

    def test_invalid_values_and_resource_limits_are_refused(self):
        from quality.metric_complexity import read_complexity
        bad = [None, {}, [{'kind': 'swign'}], [{'kind': 'swing', 'ratio': 2}],
               [{'kind': 'swing', 'ratio': 2, 'pair_span': 1, 'pairs': True}],
               [{'kind': 'tuplet', 'count': 3.5, 'normal': 2, 'note_pulses': 1}],
               [{'kind': 'tuplet', 'count': 100001, 'normal': 2, 'note_pulses': 1}],
               [{'kind': 'rubato', 'span': 4, 'anchors': [[0, 0], [2, 3], [4, 2]]}],
               [{'kind': 'rubato', 'span': 4, 'anchors': [[0, 0], [3, 4]]}],
               [{'kind': 'hypermeter', 'groups': [2, 2], 'phase': 4}],
               [{'kind': 'hemiola', 'span': 6, 'target_groups': 4}],
               [{'kind': 'metric_dissonance', 'reference_period': 2, 'competing_period': 3,
                 'span': 4, 'reference_phase': 2}],
               [{'kind': 'metric_modulation', 'old_pivot': 0, 'new_pivot': 1,
                 'old_beat': 1, 'new_beat': 1}],
               [{'kind': 'rubato', 'span': 4, 'typo': 1}],
               [{'kind': 'swing', 'ratio': 'NaN', 'pair_span': 1, 'pairs': 2}],
               [{'kind': 'rubato', 'span': 9}]]
        for raw in bad:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                read_complexity(raw, 2, 4)
        with self.assertRaisesRegex(ValueError, 'RESOURCE_LIMIT'):
            read_complexity([{'kind': 'tuplet', 'count': 60000, 'normal': 2,
                              'note_pulses': 1}] * 2, 2, 4)

    def test_blueprint_song_fit_and_cli_keep_all_seven(self):
        import json
        import subprocess
        from quality import fit, grid
        path = os.path.join(HERE, 'fixtures', 'metric_complexity.blueprint.json')
        with open(path) as fh:
            bp = json.load(fh)
        before = json.dumps(bp, sort_keys=True)
        song, _ = grid.song_from_blueprint(bp)
        direct = fit.fit_song(bp)
        via_song = fit.fit_song(song)
        rows = direct.table()
        self.assertEqual(rows, via_song.table())
        events = rows[0]['metric_complexity']
        self.assertEqual(len(events), 7)
        self.assertEqual(events[0]['result']['new_bpm'], '80')
        self.assertEqual(events[3]['result']['durations'], ['137/237', '100/237'])
        self.assertIn('METRIC COMPLEXITY', fit.report(direct))
        self.assertEqual(json.dumps(bp, sort_keys=True), before)
        cli = subprocess.run([sys.executable, os.path.join(HERE, '..', 'lyric_harness.py'),
                              'fit', path], capture_output=True, text=True)
        self.assertEqual(cli.returncode, 0, cli.stderr + cli.stdout)
        for event in events:
            self.assertIn(event['kind'], cli.stdout)
        # Repeated names retain distinct declarations; absent stays absent.
        bp['sections'].append({'name': bp['sections'][0]['name'], 'bars': 2,
                               'meter': {'beats': 3, 'unit': 4}})
        self.assertNotIn('metric_complexity', fit.fit_song(bp).table()[1])

    def test_annotations_preserve_existing_score_fit_for_sung_lines(self):
        import copy
        from quality import fit
        bp = {'sections': [{'name': 'verse', 'bars': 2,
                            'meter': {'beats': 4, 'unit': 4, 'groups': [2, 2]}}],
              'lines': [{'bar': 1, 'beat': 1, 'duration': 4, 'text': 'the rain is falling'}]}
        baseline = fit.fit_song(bp)
        annotated = copy.deepcopy(bp)
        annotated['sections'][0]['metric_complexity'] = [
            {'kind': 'swing', 'ratio': '1.37', 'pair_span': 1, 'pairs': 4}]
        measured = fit.fit_song(annotated)
        self.assertEqual(baseline.lines[0].count, measured.lines[0].count)
        self.assertEqual(baseline.lines[0].findings, measured.lines[0].findings)
        self.assertEqual(baseline.lines[0].refusals, measured.lines[0].refusals)
        row = measured.table()[0]
        row.pop('metric_complexity')
        self.assertEqual(baseline.table()[0], row)

    def test_all_readers_refuse_malformed_complexity(self):
        from quality import fit, grid
        from quality.meter import validate_blueprint
        for raw in (None, [{'kind': 'swing'}], [{'kind': 'hemiola', 'span': 10}]):
            bp = {'sections': [{'name': 'a', 'bars': 1, 'meter': {'beats': 4, 'unit': 4},
                                'metric_complexity': raw}], 'lines': []}
            for reader in (validate_blueprint, fit.from_blueprint, grid.song_from_blueprint):
                with self.subTest(reader=reader, raw=raw), self.assertRaises(ValueError):
                    reader(bp)


if __name__ == "__main__":
    for fn in (test_duration_is_an_exact_rational,
               test_the_grouping_space_is_compositions,
               test_an_undeclared_grouping_is_refused,
               test_concurrency_and_ratio_are_different_things,
               test_labelled_and_typed_cycles,
               test_nesting_marks_and_the_missing_origin,
               test_mixed_meter_and_density,
               test_the_catalogue_is_empty_and_refuses):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all metric-cycle regressions pass")
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(MetricComplexityTests))
    sys.exit(0 if result.wasSuccessful() else 1)
