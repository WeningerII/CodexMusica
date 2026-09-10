#!/usr/bin/env python3
"""The within-item extractor loads the norms its own features read (M-270).

For two days (a75da39f, 2026-09-08 -> 2026-09-10) `WithinItemFeatures`
constructed with `self.conc == {}`: the base class gates the norm load on
`CONCRETENESS_FEATURES & requested`, the subclass overrode NAMES with eight
`wi_*` names and inherited a set of three ABSOLUTE names, so the gate never
opened and `wi_concreteness_delta`, `wi_abstract_delta` and `wi_conc_spread`
were NaN on every item. Nothing cheap was red: the extractor raised nothing,
the nightly's cache was rebuilt under the broken gate by the same commit,
and `test_discriminate.py` is cold and heavy and not in the cheap job.
This suite is the cheap check that would have gone red the same hour.
"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from quality.features import QualityFeatures  # noqa: E402
from quality.within_item import WithinItemFeatures  # noqa: E402

QUATRAIN = [
    "the river keeps the score of every stone",
    "a lantern in the window burns alone",
    "the harbour holds the boats the tide has thrown",
    "and every road we walked is overgrown",
]


class WithinItemNorms(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wi = WithinItemFeatures()

    def test_the_extractor_declares_only_names_it_has_and_loads_the_norms_for_them(self):
        self.assertTrue(WithinItemFeatures.CONCRETENESS_FEATURES <= set(WithinItemFeatures.NAMES))
        self.assertEqual(sorted(WithinItemFeatures.CONCRETENESS_FEATURES),
                         ["wi_abstract_delta", "wi_conc_spread", "wi_concreteness_delta"])
        # The same norms the absolute extractor reads: one file, one loader.
        self.assertGreater(len(self.wi.conc), 30000)
        self.assertEqual(len(self.wi.conc), len(QualityFeatures().conc))

    def test_the_three_norm_backed_features_are_finite_on_a_quatrain(self):
        out = self.wi.extract(QUATRAIN, scheme="AAAA")
        for name in WithinItemFeatures.CONCRETENESS_FEATURES:
            self.assertTrue(math.isfinite(out[name]), f"{name} is {out[name]!r}: the norms did not reach it")
        self.assertEqual(set(out), set(WithinItemFeatures.NAMES))

    def test_a_subclass_that_overrides_names_without_declaring_its_norm_set_is_refused(self):
        class Overrides(QualityFeatures):
            NAMES = ["something_else"]
        with self.assertRaisesRegex(ValueError, "does not declare"):
            Overrides()

    def test_a_subclass_with_no_norm_backed_features_says_so_and_loads_none(self):
        class NormFree(QualityFeatures):
            NAMES = ["rhyme_predictability_mean"]
            CONCRETENESS_FEATURES = frozenset()
        self.assertEqual(NormFree().conc, {})


if __name__ == "__main__":
    unittest.main()
