#!/usr/bin/env python3
"""Integrate the next ten collections with the existing, unchanged batch rules."""
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('previous_gutenberg_import',
                                             HERE.parent / 'gutenberg-ten/integrate.py')
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
BASE.HERE = HERE
BASE.IDS = ('69378', '27195', '58414', '51226', '934', '40048',
            '50878', '13646', '1568', '3138')
BASE.DEST = BASE.ROOT / 'corpus/library/gutenberg-next-ten'
ROOT, IDS, DEST = BASE.ROOT, BASE.IDS, BASE.DEST
dump, build = BASE.dump, BASE.build
Duplicates, normalized = BASE.Duplicates, BASE.normalized
verse_lines, marked_text, lyric_items = BASE.verse_lines, BASE.marked_text, BASE.lyric_items

if __name__ == '__main__':
    BASE._main()
