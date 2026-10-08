"""Regression checks for source boundaries in the supplied nursery edition."""
import json
import unittest
from pathlib import Path

ROWS = json.loads(Path(__file__).with_name('candidates.json').read_text())


class SourceBoundaryTests(unittest.TestCase):
    def test_continuations_are_complete_works(self):
        by_title = {row['title']: row for row in ROWS}
        bopeep = by_title['Little Bo-peep has lost her sheep']
        self.assertEqual(bopeep['source_blocks'], [49, 50, 51])
        self.assertTrue(bopeep['text'].endswith('All hung on a tree to dry.'))
        tailors = by_title['Four and twenty tailors']
        self.assertTrue(tailors['text'].endswith("Or she'll kill you all e'en now."))
        rock = by_title['Rock-a-bye, baby, upon the tree top']
        self.assertTrue(rock['text'].endswith("And Johnny's a drummer, and drums for the king."))

    def test_all_source_blocks_accounted_once(self):
        self.assertEqual(len(ROWS), 103)
        self.assertEqual(sorted(block for row in ROWS for block in row['source_blocks']), list(range(1, 108)))
        self.assertFalse(any('This is said to each finger' in row['text'] for row in ROWS))
        self.assertFalse(any('[Pg ' in row['text'] for row in ROWS))


if __name__ == '__main__':
    unittest.main()
