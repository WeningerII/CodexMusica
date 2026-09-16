"""M-40: cross-stanza rhyme links and mandatory stanza grounding."""
import dataclasses
import unittest
import tempfile
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from quality import relations as R
from quality import relations_null as N
from quality.phonology import get

NAME = "chain rhyme (interlocking scheme)"


class InterlockingChainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.phon = get("eng")
        cls.schema = R.REGISTRY[NAME]

    def stream(self, lines, **kw):
        return R.build_stream(lines, self.phon, **kw)

    def pairs(self, lines, **kw):
        st = self.stream(lines, **kw)
        result = R.realise(self.schema, st)
        self.assertNotIsInstance(result, R.Refusal)
        return {(st.units[x.a.head()].line, st.units[x.b.head()].line)
                for x in result if x.verdict is True}

    def test_aba_bcb_cdc_links(self):
        lines = ["cat", "moon", "hat", "", "tune", "day", "spoon", "",
                 "way", "bell", "say"]
        self.assertEqual(self.pairs(lines), {(1, 4), (1, 6), (5, 8), (5, 10)})

    def test_same_skipped_and_nonrhyming_stanzas(self):
        self.assertEqual(self.pairs(["cat", "hat"], stanzas=[0, 0]), set())
        self.assertEqual(self.pairs(["cat", "hat"], stanzas=[0, 2]), set())
        self.assertEqual(self.pairs(["cat", "moon"], stanzas=[0, 1]), set())
        self.assertEqual(self.pairs(["cat", "cat"], stanzas=[0, 1]), set())

    def test_only_line_ends_and_forward_order(self):
        self.assertEqual(self.pairs(["cat moon", "hat day"], stanzas=[0, 1]), set())
        self.assertEqual(self.pairs(["cat", "hat"], stanzas=[1, 0]), set())

    def test_missing_ground_refuses_even_without_explicit_requires(self):
        schema = dataclasses.replace(self.schema, requires=())
        self.assertIn("stanza", schema.capabilities())
        for kw in ({}, {"stanzas": [0, 0], "stanza_source": "none"}):
            st = self.stream(["cat", "hat"], **kw)
            self.assertIsInstance(R.realise(schema, st), R.Refusal)
        # The placement itself refuses too, including when negated.
        st = self.stream(["cat", "hat"], stanzas=[0, 1])
        inst = next(x for x in R.realise(schema, st) if x.verdict is True)
        st.frames.stanza_source = "none"
        for polarity in (True, False):
            self.assertIsNone(R.Placement("adjacent_stanzas", polarity=polarity)
                              .holds(inst.a, inst.b, st))

    def test_senses_and_null_coordinate(self):
        self.assertIn("chain rhyme (rap)", R.REGISTRY)
        self.assertIn("linked rhyme", R.REGISTRY)
        self.assertEqual(N._PLACEMENT_READS["adjacent_stanzas"], "stanza")
        self.assertTrue(self.schema.traditions)


class NormalizedCellTests(unittest.TestCase):
    def test_apparatus_repair_boundaries_and_first_song(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "eng_british_lord_byron.txt"
            path.write_text("--- TITLE: First\n[VERSE 1]\ncat[a]\n"
                            "[Footnote a: an editorial note\n"
                            "continued here]\n\n[VERSE 2]\nhat\n"
                            "--- TITLE: Second\nmoon\n")
            lines, groups, source, refused = N._read_normalized_one_song_grounded(
                str(path), 40, "eng")
            self.assertEqual(lines, ["cat", "hat"])
            self.assertEqual(groups, [0, 1])
            self.assertTrue(source)
            self.assertFalse(refused)

    def test_unframed_text_stays_unframed_and_unknown_mark_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "draft.txt"
            path.write_text("cat\nhat\n")
            lines, groups, source, refused = N._read_normalized_one_song_grounded(str(path), 40, "eng")
            self.assertEqual(source, "none")
            path.write_text("[NOT_A_SECTION]\ncat\n\nhat\n")
            lines, groups, source, refused = N._read_normalized_one_song_grounded(str(path), 40, "eng")
            self.assertEqual(source, "none")
            self.assertTrue(refused)


if __name__ == "__main__":
    unittest.main()
