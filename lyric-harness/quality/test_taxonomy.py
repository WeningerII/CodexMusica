#!/usr/bin/env python3
"""Regressions for the scheme and type SPACES.

The load-bearing test in this file is test_sections_annotate_they_do_not_chunk.
Every other failure here is a bug; that one would be the return of the defect
these modules exist to remove -- a 40-line lyric analysed as ten 4-line boxes,
in which a rhyme between line 3 and line 31 is not weak evidence but is
UNREPRESENTABLE.

Run: python3 quality/test_taxonomy.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import rhyme_types as T          # noqa: E402
from quality import schemes as S              # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_space_is_the_bell_numbers():
    print("\n1. the scheme space is Bell(n), and it is enumerated exhaustively")
    known = [1, 1, 2, 5, 15, 52, 203, 877, 4140, 21147, 115975]
    check("Bell numbers match the known sequence",
          [S.bell(n) for n in range(11)] == known, str(known[:8]))
    for n in (1, 2, 3, 4, 5, 6, 7):
        got = list(S.rgs(n))
        check(f"n={n}: enumerates exactly Bell({n}) = {S.bell(n)}",
              len(got) == S.bell(n) and len(set(got)) == len(got))
    check("the fifteen four-line schemes are ALL of them",
          [S.label(c) for c in S.rgs(4)] ==
          ["AAAA", "AAAB", "AABA", "AABB", "AABC", "ABAA", "ABAB", "ABAC",
           "ABBA", "ABBB", "ABBC", "ABCA", "ABCB", "ABCC", "ABCD"],
          "this project had been using three of these fifteen")
    check("Stirling rows sum to Bell",
          sum(S.stirling2(6, k) for k in range(7)) == S.bell(6))
    check("max_blocks slices the space without breaking canonicity",
          all(max(c) < 3 for c in S.rgs(8, max_blocks=3)))


def test_canonical_form():
    print("\n2. one partition, one representation")
    check("ABAB and BABA are the same object",
          S.parse("ABAB") == S.parse("BABA"))
    check("CDCD too", S.parse("ABAB") == S.parse("CDCD"))
    check("an X is a singleton block, not a missing value",
          S.parse("ABXB") == S.parse("ABCB"),
          "'unrhymed' is a block of size one, so ABXB IS ABCB")
    check("two X's are two DIFFERENT singletons, not one class",
          S.parse("AXXA") == S.parse("ABCA"),
          "if X meant a shared class, AXXA would be ABBA -- it is not")
    check("round-trips", S.label(S.parse("ABBACC")) == "ABBACC")
    check("beyond 26 sounds it keeps going",
          len(S.label(tuple(range(30)))) > 30)


def test_coordinates_separate_forms_the_letters_hide():
    print("\n3. coordinates locate a scheme; letters alone do not")
    ab = S.coordinates(S.parse("ABAB"))
    ba = S.coordinates(S.parse("ABBA"))
    check("ABAB and ABBA have identical block sizes",
          ab.block_sizes == ba.block_sizes == (2, 2),
          "so block sizes alone cannot tell interlocking from enclosed")
    check("but ABAB crosses and ABBA nests",
          ab.crossings == 1 and ab.nestings == 0
          and ba.crossings == 0 and ba.nestings == 1)
    check("AABB is adjacency, not crossing or nesting",
          S.coordinates(S.parse("AABB")).adjacencies == 2
          and S.coordinates(S.parse("AABB")).crossings == 0)
    check("every unrhymed line is its own singleton block",
          S.coordinates(S.parse("ABCB")).singletons == 2
          and S.blocks(S.parse("ABCB")) == [[1], [2, 4], [3]],
          "ABCB has TWO unrhymed lines, 1 and 3 — they are not one class")
    check("ABCD is four singletons and no rhyme at all",
          S.coordinates(S.parse("ABCD")).singletons == 4
          and S.coordinates(S.parse("ABCD")).max_span == 0)
    long_range = S.parse("A" + "B" * 28 + "A")
    check("a 30-line scheme reports its true span",
          S.coordinates(long_range).max_span == 29,
          "the stanza model could not represent this rhyme at all")


def test_sections_annotate_they_do_not_chunk():
    print("\n4. THE ONE THAT MATTERS — sections label lines, they do not "
          "partition the analysis")
    # 12 lines: verse, chorus, verse. Line 2 rhymes line 11 -- ACROSS two
    # section boundaries and nine lines apart. Under the old stanza model the
    # lyric would have been cut into three 4-line boxes and this relation
    # would not have been weak evidence, it would have been unrepresentable.
    code = S.parse("ABCD EBFG HIJB".replace(" ", ""))
    secs = (["verse"] * 4) + (["chorus"] * 4) + (["verse"] * 4)
    co = S.coordinates(code, sections=secs)
    check("the long-range rhyme exists in the object",
          co.max_span >= 9, f"max_span={co.max_span}")
    xs = S.crossing_rhymes(code, secs)
    check("rhymes spanning a section boundary are reported",
          {(i, j) for i, j, _a, _b in xs} == {(2, 6), (6, 12)}, str(xs))
    check("section_crossing counts them", co.section_crossing == len(xs) == 2)
    # Lines 2 and 12 are ten apart and BOTH labelled 'verse'. That pair is
    # long-range but does not cross a boundary, and conflating the two would
    # make 'crossing' mean 'distant'. They are different questions.
    check("a long-range rhyme WITHIN one label is not a crossing",
          (2, 12) not in {(i, j) for i, j, _a, _b in xs}
          and co.max_span == 10,
          "span and crossing are separate coordinates")
    check("sections must be per-LINE, and a per-section list is refused",
          _raises(lambda: S.coordinates(code,
                                        sections=["verse", "chorus", "verse"])),
          "a caller handing over three section NAMES for twelve lines is "
          "reaching for the chunking model, and is stopped")
    same = S.coordinates(code, sections=["one"] * 12)
    check("relabelling the sections does not change the rhyme structure",
          same.block_sizes == co.block_sizes and same.max_span == co.max_span,
          "the partition is over the SONG; sections are an overlay")


def test_named_forms_are_coordinates_not_the_taxonomy():
    print("\n5. the named forms are a labelled subset, and a small one")
    check("ABAB resolves to its names",
          "alternate" in S.identify(S.parse("ABAB"))["names"])
    check("rhyme royal is a point in the space",
          S.identify(S.parse("ABABBCC")) is not None)
    check("an arbitrary six-line scheme has NO name, and that is the point",
          S.identify(S.parse("ABACBC")) is None)
    for n, floor in ((6, 0.90), (8, 0.99), (10, 0.999)):
        _named, _total, frac = S.unnamed_fraction(n)
        check(f"n={n}: at least {floor:.1%} of the space is unnamed",
              frac >= floor, f"{frac:.4%} of {S.bell(n):,} schemes unnamed")


def test_the_partition_is_a_floor_not_a_ceiling():
    print("\n6. doctrine 2 — overlapping cliques have no letter scheme")
    disjoint = S.Cover(4, [[1, 3], [2, 4]])
    check("a disjoint cover projects to a letter scheme",
          S.label(disjoint.to_partition()) == "ABAB")
    # line 2 answers line 1 on the nucleus and line 3 on the coda, while 1
    # and 3 share nothing. No letter string can say that.
    chained = S.Cover(3, [[1, 2], [2, 3]])
    check("an overlapping cover returns None rather than a fake scheme",
          chained.to_partition() is None,
          "forcing a partition here would delete the overlap that IS the "
          "structure")
    check("and it names the pivot line", chained.overlapping_lines() == [2])
    check("is_partition is the honest predicate",
          disjoint.is_partition() and not chained.is_partition())


def test_the_type_space():
    print("\n7. the type space is a product, and English named 6 of 8 cells")
    cells = T.agreement_cells()
    check("there are exactly eight single-syllable agreement cells",
          len(cells) == 8 and len(set(cells)) == 8)
    unnamed = [c for c in cells if not T.CELL_NAMES.get(c)]
    check("two of the eight have no English name",
          sorted(unnamed) == [(0, 0, 0), (1, 1, 0)],
          "(1,1,0) is onset+nucleus agreeing and coda differing — bat : back")
    check("perfect rhyme is nucleus+coda, NOT all three",
          T.CELL_NAMES[(0, 1, 1)][0] == "perfect rhyme"
          and "alliteration" in T.CELL_NAMES[(1, 0, 0)])
    check("the space is large and enumerable",
          T.space_size(1) == 20736 and T.space_size(2) == 186624,
          f"span<=3 is {T.space_size(3):,}")
    n, tot, frac = T.named_count(max_span=1)
    check("named types are a vanishing fraction of even the span-1 slice",
          frac > 0.99, f"{n} named of {tot:,} — {frac:.4%} unnamed")


def test_types_resolve_and_refuse():
    print("\n8. named types resolve; unnamed ones say so")
    check("masculine perfect end rhyme is named",
          "masculine rhyme" in T.RhymeType(((0, 1, 1),)).names())
    check("feminine is a span-2 coordinate, not a separate concept",
          "feminine rhyme" in T.RhymeType(((0, 1, 1), (1, 1, 1))).names())
    check("mosaic is the boundary axis",
          "mosaic rhyme" in T.RhymeType(((0, 1, 1),),
                                        boundary="mosaic").names())
    check("wrenched is the stress axis",
          "wrenched rhyme" in T.RhymeType(((0, 1, 1),),
                                          stress="wrenched").names())
    check("eye rhyme is the realisation axis, not an agreement cell",
          "eye rhyme" in T.RhymeType(((0, 1, 1),),
                                     realisation="eye").names(),
          "its sound channels DISAGREE and the relation is real anyway, so it "
          "cannot be a cell of the agreement pattern")
    check("a real combination nobody named reports UNNAMED",
          T.RhymeType(((0, 1, 1),), stress="wrenched",
                      boundary="broken").names() == (),
          "wrenched AND broken is a thing a writer can do and English has no "
          "word for it")
    check("the non-English relations sit in the SAME space",
          "radif" in T.RhymeType(((1, 1, 1),), identity="same_word").names()
          and "higaad" in T.RhymeType(((1, 0, 0),), position="head").names(),
          "eight phonology modules bought this: not special cases, "
          "coordinates")
    check("classify takes agreements a phonology computed, and transcribes "
          "nothing", T.classify([(0, 1, 1)]).span == 1)
    check("an undeclared axis is refused rather than silently ignored",
          _raises(lambda: list(T.enumerate_types(max_span=1, colour="blue"))))


def _raises(fn):
    try:
        fn()
    except Exception:
        return True
    return False


if __name__ == "__main__":
    for fn in (test_the_space_is_the_bell_numbers,
               test_canonical_form,
               test_coordinates_separate_forms_the_letters_hide,
               test_sections_annotate_they_do_not_chunk,
               test_named_forms_are_coordinates_not_the_taxonomy,
               test_the_partition_is_a_floor_not_a_ceiling,
               test_the_type_space,
               test_types_resolve_and_refuse):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all taxonomy regressions pass")
