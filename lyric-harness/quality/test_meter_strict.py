#!/usr/bin/env python3
"""Regressions for the strict all-position meter check (#677 b2).

Every expected position below is copied from the frozen fixture records on
#677, never from this module's output:
  - revision 2 (6587884272) section 4-6: the declared streams C1-L, C2-L,
    C3-L, V1-D, their demoted forms C1-U, C2-U, C3-U, and the negative N1;
  - the production-reader supplement (6588075475) and its reconciliation
    (6612935003): C1-P, C2-P, C3-P, V1-P on `Lexicon()` defaults.

Run: python3 -m unittest quality.test_meter_strict
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import meter_strict as MS                     # noqa: E402

IAMBIC5 = "./" * 5
TROCHAIC4 = "/." * 4
HEXAMETER = "/.." * 5 + "/."
IAMBIC4 = "./" * 4

# Frozen editions (#677 revision 2, 6587884272).
C1 = "That time of year thou mayst in me behold,"
C2 = "Tell me not, in mournful numbers,"
C3 = "THIS is the forest primeval. The murmuring pines and the hemlocks,"
V1 = "Gather ye rosebuds while ye may,"


def positions(result):
    return [d["position"] for d in result["differences"]]


class SuppliedStreams(unittest.TestCase):
    """Revision 2 section 4-6: supplied and demoted streams, no lexicon."""

    def check(self, digits, template, status, where, policy=None):
        r = MS.compare(digits, template, policy=policy)
        self.assertEqual((r["status"], positions(r)), (status, where),
                         (digits, template, policy))
        return r

    def test_c1_declared_and_demoted(self):
        self.check("1101110101", IAMBIC5, "does_not_hold", [1, 5])
        r = self.check("0101110001", IAMBIC5, "does_not_hold", [5, 8])
        self.assertEqual([(d["expected"], d["stress"]) for d in r["differences"]],
                         [("W", "1"), ("S", "0")])

    def test_c2_declared_misses_two_weak_slots_and_demoted_holds(self):
        # Positions 2 and 4 are WEAK: the strong-only comparison passes
        # this stream 4/4; the strict check must not.
        self.check("11111010", TROCHAIC4, "does_not_hold", [2, 4])
        r = self.check("10101010", TROCHAIC4, "holds", [])
        self.assertEqual(r["positions_compared"], 8)

    def test_c3_declared_and_demoted(self):
        self.check("11010010010010010", HEXAMETER, "does_not_hold", [2])
        self.check("00010010010010010", HEXAMETER, "does_not_hold", [1])

    def test_v1_exact_and_with_declared_initial_inversion(self):
        self.check("10010101", IAMBIC4, "does_not_hold", [1, 2])
        r = self.check("10010101", IAMBIC4, "holds", [],
                       policy="initial_inversion")
        self.assertTrue(r["inversion_used"])

    def test_n1_trochaic_reading_against_iambic_tetrameter(self):
        r = self.check("10101010", IAMBIC4, "does_not_hold",
                       [1, 2, 3, 4, 5, 6, 7, 8])
        # Adding the trochaic template gives a fit: N1 is a scoped negative,
        # not "nonmetrical".
        self.check("10101010", TROCHAIC4, "holds", [])
        self.assertIn("not recognition", r["basis"])

    def test_inversion_is_initial_only(self):
        # A medial inversion is not licensed by the initial policy: the
        # exact check names 5-6, and the declared policy, which inverts
        # positions 1-2 only, adds 1-2 rather than forgiving 5-6.
        self.check("01011001", IAMBIC4, "does_not_hold", [5, 6])
        self.check("01011001", IAMBIC4, "does_not_hold", [1, 2, 5, 6],
                   policy="initial_inversion")
        r = MS.compare("01010101", IAMBIC4, policy="initial_inversion")
        self.assertEqual((r["status"], positions(r)), ("does_not_hold", [1, 2]))
        refused = MS.compare("10101010", TROCHAIC4, policy="initial_inversion")
        self.assertEqual(refused["status"], "not_computed")

    def test_counts_and_symbols(self):
        over = MS.compare("01010", "./..", )
        self.assertEqual((over["status"], positions(over), over["overhang"]),
                         ("does_not_hold", [4], 1))
        fits_then_over = MS.compare("010", "./")
        self.assertEqual((fits_then_over["status"], positions(fits_then_over),
                          fits_then_over["overhang"]), ("does_not_hold", [], 1))
        short = MS.compare("01", "./.", )
        self.assertEqual((short["status"], short["missing_positions"]),
                         ("does_not_hold", 1))
        odd = MS.compare("0101", ".x./")
        self.assertEqual((odd["status"], odd["template_symbols"]),
                         ("not_computed", ["x"]))
        self.assertEqual(MS.compare("01", "./", policy="medial")["status"],
                         "not_computed")

    def test_secondary_stress_is_kept_and_projected_strong(self):
        r = MS.compare("012", "../")
        self.assertEqual(r["differences"],
                         [{"position": 2, "expected": "W", "stress": "1"}])
        r = MS.compare("102", "/..")
        self.assertEqual(r["differences"],
                         [{"position": 3, "expected": "W", "stress": "2"}])

    def test_alignment_prefix_is_compared_and_tail_is_not(self):
        clean_prefix = MS.compare("0101", IAMBIC5, valid=4)
        self.assertEqual(clean_prefix["status"], "not_computed")
        self.assertEqual(clean_prefix["not_compared_after_syllable"], 4)
        bad_prefix = MS.compare("0111", IAMBIC5, valid=4)
        self.assertEqual((bad_prefix["status"], positions(bad_prefix)),
                         ("does_not_hold", [3]))
        self.assertNotIn("overhang", bad_prefix)
        # The unread word is the LAST word: no digits follow the prefix,
        # and the line is still not complete.
        last_unread = MS.compare("01", "./", valid=2)
        self.assertEqual(last_unread["status"], "not_computed")
        self.assertNotIn("missing_positions", last_unread)


class ProductionReader(unittest.TestCase):
    """The production-reader supplement: `Lexicon()` defaults, v2."""

    @classmethod
    def setUpClass(cls):
        import lyric_harness as lh
        cls.lh = lh
        cls.lex = lh.Lexicon()

    def strict(self, line, template, policy=None):
        e = self.lh.check_meter(self.lex, [line], template)[0]
        return e, MS.from_entry(e, template, policy=policy)

    def test_c1p_fails_inside_the_aligned_prefix_and_stops_at_mayst(self):
        e, r = self.strict(C1, IAMBIC5)
        self.assertEqual(e["stress"], "././/.../")
        self.assertEqual((r["status"], positions(r)), ("does_not_hold", [5]))
        self.assertEqual(r["differences"][0]["word"], "thou")
        self.assertEqual((r["compared_through_syllable"], r["unread_from_token"]),
                         (5, 6))
        self.assertNotIn("overhang", r)
        text = "\n".join(MS.report_lines(r))
        self.assertIn("after syllable 5 not compared", text)

    def test_c2p_holds_on_every_position(self):
        e, r = self.strict(C2, TROCHAIC4)
        self.assertEqual((r["status"], r["positions_compared"]), ("holds", 8))

    def test_c3p_names_the_weak_slot_secondary_on_hemlocks(self):
        e, r = self.strict(C3, HEXAMETER)
        self.assertEqual((r["status"], positions(r)), ("does_not_hold", [1, 17]))
        last = r["differences"][-1]
        self.assertEqual((last["word"], last["token"], last["stress"], last["expected"]),
                         ("hemlocks", 11, "2", "W"))
        # b1's strong-only comparison never sees position 17.
        self.assertEqual(e["strong_slots"]["matched"], 5)

    def test_v1p_stressed_ye_survives_the_inversion(self):
        _, exact = self.strict(V1, IAMBIC4)
        self.assertEqual(positions(exact), [1, 2, 3, 7])
        _, inv = self.strict(V1, IAMBIC4, policy="initial_inversion")
        self.assertEqual((inv["status"], positions(inv)), ("does_not_hold", [3, 7]))
        # Both leftovers are the two `ye` occurrences (tokens 2 and 5),
        # which the dictionary stresses and demotion leaves alone.
        self.assertEqual([(d["word"], d["token"]) for d in inv["differences"]],
                         [("ye", 2), ("ye", 5)])

    def test_weak_slot_blind_spot_is_closed(self):
        # Synthetic contract 2 (6587406414): every strong slot agrees, so
        # b1 reports 5/5; the strict check must name the stressed weak slots.
        e, r = self.strict("cold wind black rain dark night grim fog red sky",
                           IAMBIC5)
        self.assertEqual(e["strong_slots"]["matched"], 5)
        self.assertEqual((r["status"], positions(r)),
                         ("does_not_hold", [1, 3, 5, 7, 9]))

    def test_last_word_unread_is_not_computed_not_short(self):
        # Synthetic contract 4's unread word moved to the end: b1 stops
        # alignment after token 2 (4 syllables), and nothing follows.
        e, r = self.strict("away believe zorbleflax", IAMBIC5)
        self.assertEqual(e["alignment"], {"valid_through_token": 2,
                                          "valid_syllables": 4})
        self.assertEqual((r["status"], r["unread_from_token"]),
                         ("not_computed", 3))
        self.assertNotIn("missing_positions", r)

    def test_words_unavailable_is_not_computed(self):
        r = MS.from_entry({"words": None, "alignment": "unavailable"}, IAMBIC5)
        self.assertEqual(r["status"], "not_computed")


if __name__ == "__main__":
    unittest.main()
