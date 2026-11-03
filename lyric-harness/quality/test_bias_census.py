#!/usr/bin/env python3
"""The deterministic bias census (#671, plan v3): what the planner and the
revise loop choose when the caller chose nothing.

Three questions, each answered per entrypoint and never as one default for
every surface:

  1. LENGTH. With no declared `lines`, `make_plan` draws the total uniformly
     over `fillable_line_counts(form)`. The domain is DERIVED (it moves when
     calibration moves), so this file pins the derivation's arithmetic with
     its own hand-checked cases, independently of the production helper, and
     then tests the actual draws over a PRE-REGISTERED seed set against a
     PRE-REGISTERED tolerance: no unexplained mass anywhere, and none at the
     round numbers 16, 24 and 32 in particular. Zero occurrences is not the
     claim; "no more than chance" is.
  2. FORM. Each surface's documented default: `open` for `make_plan` and the
     connector, `verse-chorus` for the raw CLI `plan` and `finish`. The
     Python and CLI paths are executed here; the connector's argv is executed
     by `mcp/test.mjs` and only its source is read here. Pinning
     the CLI default protects the current documented contract; it does not
     endorse it (whether it should change is John's policy call).
  3. FREQUENCY. D6 on #519: no system-chosen word reaches the draft. With
     the default stub proposer, `revise` changes nothing, offers no
     candidates in the brief, and never enters the multi-line backtrack.

A census, not a bias measurement of any model: it reads only this engine's
own defaults, with no model call and nothing outside the process.

    python3 quality/test_bias_census.py
"""

import collections
import math
import os
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import lyric_harness  # noqa: E402,F401
from quality import plan as P  # noqa: E402

#: PRE-REGISTERED (2026-11-03, before any assertion below was run): the seed
#: set, the round numbers, and the tolerances. Changing any of them after
#: seeing a failure is moving the goalposts; change them only with a reason
#: stated here.
SEEDS = range(1, 601)
ROUND_NUMBERS = (16, 24, 32)
#: Per value, uniform over ~460 values at 600 draws expects ~1.3. A count of
#: 9 or more at any one value has probability ~1e-5 per value under uniform,
#: ~0.005 over the whole domain. So a hit is strong evidence of mass, not
#: proof: these are fixed-seed regression checks with a stated false-alarm
#: rate, and passing them does not show every possible length bias is absent.
MAX_PER_VALUE = 8
#: Eight equal-width bins over the domain; each bin's observed share must lie
#: within 4 binomial standard deviations of its expected share.
BINS = 8
BIN_SIGMAS = 4.0


def _draws(form):
    return [P.make_plan(s, form=form)["total_lines"] for s in SEEDS]


class LengthDomain(unittest.TestCase):
    """The derivation's arithmetic, checked by hand rather than by calling
    `fillable_line_counts` and agreeing with it."""

    def test_form_minimum_sections_by_hand(self):
        # open requires no function and no return: zero sections needed.
        self.assertEqual(P.form_min_sections("open"), 0)
        # verse-chorus requires a verse once and a chorus that returns
        # (twice): 1 + 2 = 3.
        self.assertEqual(P.FORM_REQUIRES["verse-chorus"], ("chorus", "verse"))
        self.assertEqual(P.FORM_RECURS["verse-chorus"], ("chorus",))
        self.assertEqual(P.form_min_sections("verse-chorus"), 3)

    def test_domain_recomputed_independently(self):
        # A restatement over the LIVE calibration: it catches the helper and
        # its inputs drifting apart, but it shares the helper's predicate, so
        # it is not the independent oracle. That is the next test.
        stanza = P.stanza_line_floor()
        song = P.song_line_counts()
        for form, need in (("open", 0), ("verse-chorus", 3)):
            mine = {t for t in song if t >= 2 and max(1, t // stanza) >= need}
            self.assertEqual(set(P.fillable_line_counts(form)), mine, form)

    def test_controlled_calibration_cases(self):
        # THE INDEPENDENT ORACLE (#693, 3PO): the calibration inputs are
        # replaced by small, explicit fixtures and every expected set below
        # is worked by hand, not computed. Real calibration stays free to
        # move; these pin the DERIVATION from inputs to fillable totals.
        #   gradeable totals G, stanza floor s, form minimum sections m:
        #   fillable = {t in G : t >= 2 and max(1, t // s) >= m}
        cases = [
            # G, s, open expected, verse-chorus expected (m = 3)
            # s=4: 3*4 = 12 is the first verse-chorus total; 11 // 4 = 2.
            ({1, 2, 3, 5, 8, 11, 12, 13, 20}, 4,
             {2, 3, 5, 8, 11, 12, 13, 20}, {12, 13, 20}),
            # s=3: 3*3 = 9 is the first; 8 // 3 = 2 falls short.
            ({1, 2, 8, 9, 10}, 3, {2, 8, 9, 10}, {9, 10}),
            # A hole in G stays a hole: 12 is absent, so verse-chorus starts
            # at 13 even though 12 // 4 = 3.
            ({2, 11, 13, 14}, 4, {2, 11, 13, 14}, {13, 14}),
            # s=1: every t >= 3 holds three one-line cells; 2 does not, and
            # 1 is never fillable (a group is two lines).
            ({1, 2, 3, 4}, 1, {2, 3, 4}, {3, 4}),
        ]
        for song, stanza, want_open, want_vc in cases:
            with mock.patch.object(P, "song_line_counts",
                                   return_value=frozenset(song)), \
                    mock.patch.object(P, "stanza_line_floor",
                                      return_value=stanza):
                self.assertEqual(set(P.fillable_line_counts("open")),
                                 want_open, (sorted(song), stanza, "open"))
                self.assertEqual(set(P.fillable_line_counts("verse-chorus")),
                                 want_vc, (sorted(song), stanza, "vc"))

    def test_hand_checked_edges(self):
        stanza = P.stanza_line_floor()
        song = P.song_line_counts()
        open_, vc = (P.fillable_line_counts(f) for f in ("open", "verse-chorus"))
        # A group is two lines: one line is never fillable, two always is
        # when the floor grades it.
        self.assertNotIn(1, open_)
        if 2 in song:
            self.assertIn(2, open_)
        # verse-chorus needs three stanza-sized cells: 3 * stanza lines is
        # the first total that holds them, one line fewer is not.
        first = 3 * stanza
        if first in song:
            self.assertIn(first, vc)
        self.assertNotIn(first - 1, vc)
        # verse-chorus is the open domain with its short end removed, never
        # a different shape.
        self.assertEqual(set(vc), {t for t in open_ if t >= first})
        # The disclosed envelope is the open domain's span.
        self.assertEqual(P.ENVELOPE["total_lines"], (min(open_), max(open_)))

    def test_domain_has_no_favoured_gaps(self):
        # Contiguous today: a hole would make some totals impossible and so
        # others relatively favoured. If calibration ever opens one, this
        # says so instead of letting the uniform test below absorb it.
        for form in ("open", "verse-chorus"):
            d = sorted(P.fillable_line_counts(form))
            self.assertEqual(d, list(range(d[0], d[-1] + 1)), form)


class LengthDraws(unittest.TestCase):
    """The actual draws over the pre-registered seeds."""

    @classmethod
    def setUpClass(cls):
        cls.draws = {f: _draws(f) for f in ("open", "verse-chorus")}

    def test_every_draw_is_in_its_domain(self):
        for form, ds in self.draws.items():
            dom = P.fillable_line_counts(form)
            self.assertFalse([d for d in ds if d not in dom], form)

    def test_no_value_carries_unexplained_mass(self):
        for form, ds in self.draws.items():
            c = collections.Counter(ds)
            heavy = {v: n for v, n in c.items() if n > MAX_PER_VALUE}
            self.assertEqual(heavy, {}, form)

    def test_round_numbers_are_not_favoured(self):
        for form, ds in self.draws.items():
            c = collections.Counter(ds)
            for r in ROUND_NUMBERS:
                if r in P.fillable_line_counts(form):
                    self.assertLessEqual(c[r], MAX_PER_VALUE, (form, r))
            # Together the three round numbers expect 3/|domain| of the
            # draws; allow the same per-value tolerance, three times over.
            self.assertLessEqual(sum(c[r] for r in ROUND_NUMBERS),
                                 3 * MAX_PER_VALUE, form)

    def test_no_band_of_the_domain_is_favoured(self):
        for form, ds in self.draws.items():
            dom = sorted(P.fillable_line_counts(form))
            lo, hi, n = dom[0], dom[-1], len(ds)
            width = (hi - lo + 1) / BINS
            for b in range(BINS):
                a, z = lo + b * width, lo + (b + 1) * width
                p = sum(1 for v in dom if a <= v < z) / len(dom)
                got = sum(1 for v in ds if a <= v < z) / n
                sd = math.sqrt(p * (1 - p) / n)
                self.assertLessEqual(abs(got - p), BIN_SIGMAS * sd,
                                     f"{form} bin {b}: {got:.3f} vs {p:.3f}")


class FormDefaults(unittest.TestCase):
    """Each surface's documented default, asserted per entrypoint."""

    def test_make_plan_defaults_to_open(self):
        self.assertEqual(P.DEFAULT_FORM, "open")
        self.assertEqual(P.make_plan(1)["request"]["form"], "open")

    def test_connector_source_sends_open(self):
        # SOURCE-ONLY, and labelled so. What the connector EXECUTES is pinned
        # in JavaScript, not here: `mcp/test.mjs` (the `planArgs` check, at
        # about lines 1211-1217) runs `planArgs({seed: 7})` and gets
        # `--form=open`, and gets `--form=verse-chorus` when one is named.
        # This file only reads the constant those argv builders use, and the
        # sweep handler's own line: `lyric_sweep` builds its argv inline
        # rather than through `planArgs`, and no executed test covers its
        # omitted-form path, so that path stays a source-only check.
        mcp = os.path.join(ROOT, "..", "mcp")
        with open(os.path.join(mcp, "lyric_workflow.js"), encoding="utf-8") as fh:
            self.assertRegex(fh.read(), r"export const DEFAULT_FORM = 'open';")
        with open(os.path.join(mcp, "lyric_tools.js"), encoding="utf-8") as fh:
            tools = fh.read()
        self.assertIn("args.push(`--form=${a.form || DEFAULT_FORM}`);", tools)

    def _cli(self, *args):
        r = subprocess.run([sys.executable, "-B",
                            os.path.join(ROOT, "lyric_harness.py"), *args],
                           cwd=ROOT, capture_output=True, text=True,
                           timeout=600)
        return r.stdout + r.stderr

    def test_raw_cli_plan_defaults_to_verse_chorus(self):
        out = self._cli("plan", "--seed=1")
        self.assertRegex(out, r"PLAN: form=verse-chorus seed=1 ")
        self.assertRegex(self._cli("plan", "--seed=1", "--form=open"),
                         r"PLAN: form=open seed=1 ")

    def test_raw_cli_finish_defaults_to_verse_chorus(self):
        # `finish` re-derives the plan from --seed; on a draft of the wrong
        # length it refuses and names the plan's total, which is the
        # verse-chorus plan's, not the open plan's.
        vc = P.make_plan(1, form="verse-chorus")["total_lines"]
        op = P.make_plan(1, form="open")["total_lines"]
        self.assertNotEqual(vc, op)
        with tempfile.TemporaryDirectory() as tmp:
            draft = os.path.join(tmp, "short.txt")
            with open(draft, "w", encoding="utf-8") as fh:
                fh.write("one line\nanother line\n")
            out = self._cli("finish", draft, "--seed=1")
        self.assertIn(f"the plan declares {vc} line(s)", out)


class FrequencyTrace(unittest.TestCase):
    """D6 on #519: no system-chosen word reaches the writer or the draft."""

    LINES = ["the night is long and cold", "I walk along the river",
             "my heart is never old", "the water runs forever"]

    @classmethod
    def setUpClass(cls):
        from quality.loop import revise_loop
        from quality.revise import Reviser
        from quality.schemes import mandate
        cls.reviser = Reviser()
        cls.mandate = mandate([[1, 2, 3, 4]], n_lines=4)
        cls.result = revise_loop(cls.reviser, list(cls.LINES), cls.mandate)

    def test_default_stub_changes_nothing(self):
        self.assertEqual(self.result.lines, self.LINES)
        self.assertNotEqual(self.result.stop_reason, "success")

    def test_no_brief_offers_candidates(self):
        briefs = self.reviser.brief(list(self.LINES), self.mandate)
        offered = [b for b in briefs if getattr(b, "candidates", None)]
        self.assertEqual(offered, [])

    def test_tier_two_is_not_entered_without_a_declared_writer(self):
        reasons = [a.reason for r in self.result.rounds for a in r.attempts]
        self.assertTrue(reasons)
        for why in reasons:
            self.assertIn("the PROPOSER declined at attempt 0", why)
            self.assertIn("tier 2 was NOT entered", why)


if __name__ == "__main__":
    unittest.main()
