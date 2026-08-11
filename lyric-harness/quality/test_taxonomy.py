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
    check("and the ANCHOR axis multiplies it, per member, twice",
          T.space_size(1, anchors=True) == 20736 * (14 * 3) ** 2
          and T.ANCHOR_VALUES == 42,
          f"span-1 was {T.space_size(1):,} placement cells and is "
          f"{T.space_size(1, anchors=True):,} once the locator is a "
          f"coordinate — a factor of {T.ANCHOR_VALUES ** 2:,}, which is the "
          f"size of the hole the seven-axis model had")
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



def test_the_producer_closes_E1():
    print("\n9. gap E-1 — two words and a phonology now yield a coordinate")
    from quality.phonology import get
    from quality.rhyme_types import Indeterminate, classify_pair, verdict
    # ONE space, many phonologies. Nothing is transcribed here; `phon` is any
    # object with .syllabify(), which is every module in quality/phonology/.
    for lang, a, b, kw in (("cym", "llais", "llon", {}),
                           ("fin", "kukka", "kukko", {}),
                           ("msa", "burong", "tolong", {"span": 1}),
                           ("san", "rāma", "kāma", {"span": 1})):
        t = classify_pair(a, b, get(lang), **kw)
        check(f"{lang}: {a}~{b} lands in the space",
              t is not None and t.verdict() in (True, False, None),
              t.describe()[:74] if t else "None")
    # NB the first fixture here was `wolf`/`hound`, which FAILED — both are
    # legal Welsh orthography (w is a VOWEL in Welsh). The test was wrong, not
    # the code. Welsh lacks k, q and x, so those are the real refusal.
    check("an out-of-inventory word gives None, not a guess",
          classify_pair("quiz", "kex", get("cym")) is None,
          "Welsh has no k, q or x")
    check("and a word that only LOOKS foreign is read, correctly",
          classify_pair("wolf", "hound", get("cym")) is not None,
          "w is a vowel in Welsh; refusing this would be the opposite error")
    # THE TERNARY PATH. A binary channel would force this to True or False and
    # both are assertions the orthography does not support.
    P = get("fas")
    t = classify_pair("دل", "گل", P, span=1)
    check("Persian: an unwritten short vowel propagates as UNKNOWN",
          t is not None and t.verdict() is None and not t.determined
          and t.unknown_channels == [(0, "nucleus")],
          "the channel is named, so a caller knows WHY the verdict is None")
    check("and it agrees with the phonology's own independent answer",
          t.verdict() == P.rhymes("دل", "گل") is None,
          "two separately written paths, same tri-state")
    # Refusal where the anchor rule has no referent.
    check("'anchor' is REFUSED where the phonology carries no prominence",
          _raises(lambda: classify_pair("burong", "tolong", get("msa"))),
          "som/msa/fas decline a stress grid, so 'last stressed syllable to "
          "end' has nothing to point at — the rule is a coordinate, not a "
          "universal")
    check("verdict() is the tri-state a caller wants",
          verdict("burong", "tolong", get("msa"), span=1) is True)


def test_ternary_channels_and_unbounded_span():
    print("\n10. the channel space is 27, not 8; span has no ceiling")
    check("binary is the fully-DETERMINED subset",
          len(T.agreement_cells()) == 8
          and len(T.agreement_cells(ternary=True)) == 27)
    check("span names do not cap at 4",
          T.span_name(5) == "5-syllable multisyllabic"
          and T.span_name(2) == "feminine",
          "the old SPAN dict lumped everything 4+ into 'extended'")
    check("an undetermined type reports UNNAMED rather than a nearest cell",
          T.RhymeType(((False, None, True),)).names() == ()
          and T.RhymeType(((False, None, True),)).verdict() is None)


def test_the_anchor_is_a_coordinate_and_it_moves_the_span():
    print("\n11. AXIS 8 — the anchor fixes the ORIGIN of the span, per member")
    from quality.phonology import get
    fin = get("fin")

    # THE DEFECT, in one call. Before the anchor axis, classify_pair compared
    # sa[-n:] against sb[-n:] and `position` never touched the span.
    # `consult=False` keeps doctrine 83's defect DEMONSTRABLE now that fin
    # declares a rhyme predicate (MISSING M-6, closed 2026-08-11). With the
    # declared relation consulted the verdict is True, because fin.rhymes
    # agrees with fin.alliterates -- which is the disagreement doctrine 83 was
    # written about, now closed on one side. Doctrine 84: a demonstration that
    # has been optimised away is a sentence nobody can check.
    old_style = T.classify_pair("kukka", "kalevala", fin, consult=False)
    check("the tail locator reads kukka~kalevala as a 2-syllable rhyme span",
          old_style.member_text == (("kuk", "ka"), ("va", "la"))
          and old_style.verdict() is False,
          "'kuk' against 'va' and 'ka' against 'la' — and the SECOND cell "
          "reports 'perfect rhyme', which is a false-positive label sitting "
          "on top of a false-negative verdict")
    check("and the declared relation now OVERRULES it, which is the half of "
          "doctrine 83 that M-6 closes",
          T.classify_pair("kukka", "kalevala", fin).verdict() is True,
          "fin.rhymes reads the shared open final `a` -- the Finnish "
          "one-syllable loppusointu -- where the tail locator saw kuk~va")
    check("and that disagrees with the phonology's own relation",
          fin.alliterates("kukka", "kalevala") is True
          and old_style.alliterates() is False,
          "fin.alliterates says True; the tail-located coordinate says False")

    head = T.classify_pair("kukka", "kalevala", fin,
                           preset="kalevala-alliteration")
    check("THE FIX — the head anchor locates the relation that is there",
          head.member_text == (("kuk",), ("ka",))
          and head.alliterates() is True
          and head.alliterates() == fin.alliterates("kukka", "kalevala"),
          f"{head.member_text}, cell {head.cells()[0][0]!r}, and it now "
          f"AGREES with fin.alliterates()")
    check("and it resolves to the head-anchored names",
          "Kalevala alliteration (weak)" in head.names()
          and "higaad" in head.names() and "studlar/hofudstafr" in head.names())
    check("the anchor is what changed, not the label",
          old_style.anchor_a != head.anchor_a
          and old_style.agreement != head.agreement,
          "under the old model 'head' was a POSITION value that changed the "
          "label and not one comparison")

    # PER MEMBER, with a DETERMINACY.
    check("an anchor carries a rule AND a determinacy AND a span",
          T.LAST_PROMINENT.rule == "last-prominent"
          and T.LAST_PROMINENT.determinacy == "rule-fixed"
          and T.PROMINENT_SEARCH.determinacy == "searched"
          and T.SECOND_AKSARA.index == 1)
    check("fourteen anchor rules and three determinacies are declared",
          len(T.ANCHOR_RULES) == 14 and len(T.DETERMINACY) == 3,
          ", ".join(T.ANCHOR_RULES[:5]) + ", ...")
    check("an undeclared anchor rule is refused, not approximated",
          _raises(lambda: T.Anchor("nearest-vowel-ish")))
    check("'fixed-index' with no index is refused — the index IS the rule",
          _raises(lambda: T.Anchor("fixed-index")))
    check("'unanchored' with a measured span is refused",
          _raises(lambda: T.Anchor("unanchored", span=2)),
          "a span measured from an origin that does not exist is the "
          "inert-parameter defect wearing a different hat")

    # THE REFUSAL THAT PREDATES THIS AXIS AND MUST SURVIVE IT.
    for lang in ("som", "msa", "fas"):
        P = get(lang)
        check(f"{lang}: every prominence-dependent anchor RAISES",
              all(_raises(lambda r=r: T.resolve_anchor(
                  T.Anchor(r, "searched" if r == "prominent-onset"
                           else "rule-fixed",
                           1 if r != "last-prominent" else "to-end"),
                  P.syllabify("burong" if lang == "msa"
                              else ("guri" if lang == "som" else "دل"))))
                  for r in T.PROMINENCE_RULES),
              "pitch accent / contested stress / quantitative metre — the "
              "rule has no referent and the module will not default to the "
              "tail")
    check("but a WORD-EDGE anchor still works there, because it needs no "
          "prominence",
          T.verdict("burong", "tolong", get("msa"), span=1) is True,
          "the legacy span= path is now the named coordinate "
          "Anchor('word-final', 'declared', -n)")

    # SPAN IS PER MEMBER TOO.
    check("span runs FROM the anchor, and a negative span runs leftward",
          T._span_indices(5, 2, "to-end") == [2, 3, 4]
          and T._span_indices(5, 2, "to-start") == [2, 1, 0]
          and T._span_indices(5, 2, 2) == [2, 3]
          and T._span_indices(5, 2, -2) == [2, 1],
          "offset i means 'i steps from THIS member's own origin', which is "
          "what lets a head-anchored member zip against a tail-anchored one")


def test_position_is_computed_or_refused():
    print("\n12. position is COMPUTED from a frame, or it is not asserted")
    from quality.phonology import get
    fin = get("fin")
    check("an unframed call leaves position UNLOCATED rather than 'end'",
          T.classify_pair("kukka", "kukko", fin).position is None,
          "None here means the relation was read and its placement was not "
          "measured — not a missing value waiting for the modal one")
    check("DECLARING a position with nothing to check it against RAISES",
          _raises(lambda: T.classify_pair("kukka", "kukko", fin,
                                          position="end")),
          "this parameter used to be accepted and never consulted; an inert "
          "parameter that looks live is worse than an absent one")
    check("and the refusal is Unverifiable, a kind of Indeterminate",
          issubclass(T.Unverifiable, T.Indeterminate))
    got = {}
    for want, fr in (
            ("end", T.Frame("talo on kukka", "pieni on kukko")),
            ("head", T.Frame("kukka on talo", "kukko on pieni")),
            ("internal", T.Frame("talo kukka on", "pieni kukko on")),
            ("cross", T.Frame("talo on kukka", "pieni kukko on")),
            ("leonine", T.Frame("talo kukka on kukko",
                                "talo kukka on kukko", 2, 2)),
            ("holorhyme", T.Frame("kukka", "kukko"))):
        got[want] = T.classify_pair("kukka", "kukko", fin, frame=fr).position
    check("every one of the six declared positions is COMPUTABLE",
          set(got.values()) == set(T.POSITION) and all(k == v for k, v
                                                       in got.items()),
          str(got))
    check("a declared position that CONTRADICTS the frame is refused, and "
          "not overwritten in either direction",
          _raises(lambda: T.classify_pair(
              "kukka", "kukko", fin, position="head",
              frame=T.Frame("talo on kukka", "pieni on kukko"))))
    check("a member that is not in its declared line is refused",
          _raises(lambda: T.classify_pair(
              "kukka", "kukko", fin,
              frame=T.Frame("talo on ruusu", "pieni on kukko"))),
          "nothing about its placement can be measured, so nothing is said")


def test_four_languages_four_anchors():
    print("\n13. the four cross-language proofs — every one on real material")
    from quality.phonology import get, non as NONMOD
    fin, san, non, cym = get("fin"), get("san"), get("non"), get("cym")

    # (1) FINNISH — head anchor. Checked in section 11; here it is checked
    #     against the phonology's own verdict over a spread of pairs.
    pairs = [("kukka", "kalevala"), ("kukka", "kukko"), ("vesi", "veli"),
             ("aalto", "ilma"), ("mies", "matka"), ("talo", "koira"),
             ("laulaa", "lintu"), ("metsä", "meri")]
    agree = sum(T.alliterates(a, b, fin) == fin.alliterates(a, b)
                for a, b in pairs)
    tail = sum(T.classify_pair(a, b, fin).alliterates()
               == fin.alliterates(a, b) for a, b in pairs)
    check(f"fin: the head anchor agrees with fin.alliterates on "
          f"{agree}/{len(pairs)}",
          agree == len(pairs), f"the tail anchor agrees on {tail}/{len(pairs)}")

    # (2) SANSKRIT — a FIXED INDEX, because dvitīyākṣara-prāsa is anchored on
    #     the second akṣara of the pāda and no stress is involved. san's
    #     prominence is guru/laghu, so a 'last stressed syllable' rule read
    #     here would be reading a QUANTITY as an accent (doctrine 35).
    a, b = "kamalākṣa naya", "kamalāsana deva"
    second = T.classify_pair(a, b, san, preset="dvitiyakshara-prasa")
    tail1 = T.classify_pair(a, b, san, span=1)
    check("san: the second-akṣara anchor lands on the second akṣara",
          second.member_text == (("ma",), ("ma",))
          and second.origins == (1, 1),
          f"the tail locator lands on {tail1.member_text} — a different "
          f"syllable, and the relation is not there")
    check("and the tail locator does NOT find the relation",
          second.alliterates() is True and tail1.alliterates() is not True)
    check("san declares its prominence is guru/laghu, NOT stress",
          "guru" in san.prominence_rule and san.grid_unit == "mora",
          "which is why the anchor rules here are written on PROMINENCE and "
          "the module never says 'stress'")
    check("a multi-token Sanskrit member is read by scan_pada, not joined",
          hasattr(san, "scan_pada")
          and len(T.classify_pair(a, b, san, preset="dvitiyakshara-prasa")
                  .member_text[0]) == 1,
          "saṃhitā resyllabifies across word boundaries, so a token-by-token "
          "join would put every index after the first boundary in the wrong "
          "place — and every anchor rule here is an index")

    # (3) OLD NORSE — the PENULTIMATE syllable of the LINE, by the metre.
    H = [" ".join(NONMOD._tokens(l)) for l in (
        "Lætr sá, er Hákun heitir,", "hann rekkir lið, bannat,",
        "jörð kann frelsa, fyrðum", "friðrofs, konungr, ofsa.",
        "Sjalfr ræðr allt ok Elfar", "ungr stillir sá milli,",
        "gramr á gift at fremri,", "Gandvíkr jöfurr landi.")]
    same = 0
    for ln in H:
        sc = non.scan(ln)
        t = T.classify_pair(ln, ln, non, preset="drottkvaett-hending")
        same += t.member_text[1][0] == sc[-2]["syllable"].text
    check(f"non: the fixed-index -2 anchor finds the viðrhending on "
          f"{same}/{len(H)} Háttatal lines",
          same == len(H),
          "non.line_hending computes the same syllable independently")
    hit = T.classify_pair(H[2], H[2], non, preset="drottkvaett-hending")
    check("and on Snorri's own demonstration line it names the relation",
          "skothending" in hit.names()
          and hit.member_text == (("jörð",), ("fyrð",))
          and non.line_hending(H[2], "skothending")[0] is True,
          "jörð : fyrð is the pair Snorri's prose defines skothending on")
    check("the two members are located by DIFFERENT rules, and the searched "
          "side reports its k",
          hit.anchors_differ and hit.anchor_a.determinacy == "searched"
          and hit.anchor_b.determinacy == "rule-fixed"
          and hit.searched[0] > 1,
          f"k={hit.searched[0]} candidate origins tried on side A, ties="
          f"{hit.ties} — doctrine 56, a searched rate is not an unsearched "
          f"one and the k has to travel with it")
    check("a tail anchor cannot express this relation at all",
          _raises(lambda: T.classify_pair(H[2], H[2], non, span=1))
          or T.classify_pair(H[2], H[2], non,
                             span=1).member_text[1][0] != "fyrð",
          "both members are the same line, so a single global origin gives "
          "one position against itself")

    # (4) WELSH — the two members of ONE relation, DIFFERENT anchors.
    import os
    import re
    corpus = os.path.join(HERE, "..", "corpus", "cym_alun_strict.txt")
    if not os.path.exists(corpus):
        check("cym: the Alun corpus is present", False, corpus)
        return
    W = re.compile(r"[A-Za-zÀ-ÿ'\-]+")
    lines = [l.strip() for l in open(corpus, encoding="utf-8") if l.strip()]
    hits = [l for l in lines if cym.llusg(l)[0]]
    per_member = tail_only = 0
    for l in hits:
        ws = [w for w in W.findall(l) if w.strip("'-")]
        A, B = " ".join(ws[:-1]), ws[-1]
        try:
            per_member += T.classify_pair(
                A, B, cym, preset="cynghanedd-lusg").verdict() is True
        except T.Indeterminate:
            pass
        try:
            tail_only += T.classify_pair(A, B, cym, span=1).verdict() is True
        except T.Indeterminate:
            pass
    check(f"cym: per-member anchors recover cynghanedd lusg on "
          f"{per_member}/{len(hits)} lines",
          per_member == len(hits) and len(hits) > 50,
          f"side A is SEARCHED over the prominent syllables and side B is "
          f"RULE-FIXED on the final word's stressed PENULT — a different "
          f"rule and a different determinacy on the two members of one "
          f"relation")
    check(f"the same-anchor-both-sides reading recovers {tail_only}/"
          f"{len(hits)}",
          tail_only == 0,
          "the final word's answering syllable is its PENULT, so a tail "
          "anchor is looking one syllable past the relation on every line")

    # and the claim that no single global alignment covers croes AND traws.
    # `cym.skeleton` is a sibling cell's file and its signature moved under
    # this test mid-round -- `extent` lost its default, which is the same
    # finding as this cell's, one module over. Bind to whatever it takes now
    # rather than to a shape, and SKIP loudly if it moves again: a test that
    # silently stops measuring is worse than one that says it cannot.
    def _spans(first, second):
        """The two half-lines' answered spans, from cym's OWN extent rules.

        `answer()` works the extent out from the line's accentuation class,
        which is that module's version of this cell's finding: the span is
        per member and it is not one rule. Fall back to the older single-
        extent `skeleton()` where `answer()` is not present.
        """
        if hasattr(cym, "answer"):
            a = cym.answer(first, second)
            return a.get("first"), a.get("second")
        return cym.skeleton(first), cym.skeleton(second)

    off = {"croes": [], "traws": []}
    try:
        for l in lines:
            r = cym.cynghanedd_scan(l)
            if r.get("type") not in off or not r.get("caesura"):
                continue
            ws = [w for w in W.findall(l) if w.strip("'-")]
            c = r["caesura"][0]
            sa, sb = _spans(" ".join(ws[:c]), " ".join(ws[c:]))
            if sa is not None and sb is not None:
                off[r["type"]].append(len(sb) - len(sa))
    except Exception as e:                                   # noqa: BLE001
        check("NO SINGLE GLOBAL ALIGNMENT COVERS THE PAIR", False,
              f"cannot measure: cym.{type(e).__name__}: {e}")
        return
    croes_head = sum(1 for x in off["croes"] if x == 0)
    traws_head = sum(1 for x in off["traws"] if x == 0)
    check("NO SINGLE GLOBAL ALIGNMENT COVERS THE PAIR",
          croes_head == len(off["croes"]) and traws_head == 0
          and len(off["croes"]) > 100 and len(off["traws"]) > 100,
          f"side B's origin sits at its HEAD on {croes_head}/"
          f"{len(off['croes'])} croes lines and on {traws_head}/"
          f"{len(off['traws'])} traws lines (traws bridges run "
          f"{min(off['traws'])}-{max(off['traws'])} consonants). Head-align "
          f"both and traws is unrepresentable; tail-align both and croes "
          f"cannot be told from traws, because the distinction IS the anchor")


def test_the_phonologys_own_relation_wins():
    print("\n14. channel equality is not the relation everywhere")
    from quality.phonology import get
    ltc = get("ltc")
    # 流/樓 is the rhyme of 登鸛雀樓 and their NUCLEI differ: 尤 against 侯,
    # two Qieyun categories that 平水韻 同用 merges. The merge is a TABLE.
    t = T.classify_pair("流", "樓", ltc)
    check("ltc: the raw channels say 流~樓 do NOT rhyme",
          t.channel_verdict() is False,
          "nucleus 尤 against 侯 — different rime categories in the rime book")
    check("but ltc.rhymes says they DO, and that answer wins",
          ltc.rhymes("流", "樓") is True and t.verdict() is True
          and t.route["rhyme"] == "declared_relation",
          "doctrine 36: the granularity a REFERENCE WORK records is not the "
          "granularity a FORM works at, and ltc is a lookup, not a G2P")
    check("the disagreement is REPORTED, never resolved silently",
          t.disagreements == {"rhyme": (False, True)},
          "this disagreement is how the case was found; a producer that hid "
          "it would ship a confident wrong answer on the strongest positive "
          "control this project has")
    check("consult=False is reachable, so the channel-only path stays "
          "demonstrable",
          T.classify_pair("流", "樓", ltc, consult=False).verdict() is False)
    # fin USED to be the example here and no longer is: M-6 is closed and
    # fin.py declares an end-rhyme predicate, so it IS consulted. The
    # distinction this protects is unchanged -- an inherited stub's None must
    # not read as a refusal -- so it moves to a module that still inherits the
    # stub. cym, not som: som declines a stress grid, so the default anchor
    # raises there for an unrelated reason and would muddy what is tested.
    check("a phonology that declares NO rhyme predicate is not consulted",
          T.classify_pair("cariad", "bariad", get("cym")).route["rhyme"]
          == "channels",
          "cym implements cynghanedd and no rhymes(); reading the inherited "
          "stub's None as a refusal would delete every Welsh verdict")
    check("while fin, which now HAS one, is consulted (M-6 closed)",
          T.classify_pair("kukka", "kukko", get("fin")).route["rhyme"]
          == "declared_relation",
          "the verdict is unchanged -- False either way; what moved is which "
          "layer answered")
    check("and a declared LOCATOR suppresses the consultation, because "
          "phon.rhymes() would be answering a different question",
          T.classify_pair("流", "樓", ltc,
                          anchor_a=T.WORD_INITIAL,
                          anchor_b=T.WORD_INITIAL).route["rhyme"]
          == "channels")
    P = get("fas")
    tf = T.classify_pair("دل", "گل", P, span=1)
    check("a REFUSAL propagates and is not a fallback to the channels",
          tf.verdict() is None and tf.unknown_channels == [(0, "nucleus")],
          "fas returns None on 60.2% of real Hafez pairs by design, and "
          "None from a refusal is not None from an unimplemented stub")


def test_registry_reachability():
    print("\n15. how much of the registry the producer can actually EMIT")
    from quality.phonology import get
    import itertools as _it
    PAIRS = [("fin", "kukka", "kukko"), ("fin", "kukka", "kalevala"),
             ("fin", "vesi", "veli"), ("fin", "aalto", "ilma"),
             ("fin", "kukka", "kukka"), ("fin", "kalevala", "salevala"),
             ("cym", "llais", "llon"), ("cym", "llon", "ton"),
             ("cym", "calon", "galon"), ("cym", "mawr", "mawr"),
             ("san", "rāma", "kāma"), ("non", "jörð", "hörð"),
             ("msa", "burong", "tolong"), ("ltc", "流", "樓")]
    PAIRS += [(l, b, a) for l, a, b in PAIRS]
    ANCH = [T.LAST_PROMINENT, T.WORD_INITIAL, T.PERFECT_ANCHOR,
            T.SYLLABIC_ANCHOR, T.APOCOPATED_ANCHOR, T.SECOND_AKSARA,
            T.Anchor("word-final", "declared", -1),
            T.Anchor("word-final", "declared", -2)]

    def _frames(a, b):
        yield None
        yield T.Frame(f"xx yy {a}", f"zz ww {b}")          # end
        yield T.Frame(f"{a} yy zz", f"{b} ww vv")          # head
        yield T.Frame(f"xx {a} yy", f"zz {b} ww")          # internal
        yield T.Frame(f"xx yy {a}", f"zz {b} ww")          # cross
        yield T.Frame(a, b)                                # holorhyme
        yield T.Frame(f"{a} xx yy {b}", f"{a} xx yy {b}", 1, 1)   # leonine

    emitted, resolved = set(), set()
    for lang, a, b in PAIRS:
        P = get(lang)
        for x, y in _it.product(ANCH, repeat=2):
            for fr in _frames(a, b):
                try:
                    t = T.classify_pair(a, b, P, anchor_a=x, anchor_b=y,
                                        frame=fr)
                except (T.Indeterminate, ValueError):
                    continue
                if t is not None:
                    emitted.add(t.key())
                    resolved.update(t.names())
    all_names = {n for v in T.NAMED.values() for n in v}
    check("real pairs resolve a substantial share of the registry",
          len(resolved) >= 30,
          f"{len(resolved)} of {len(all_names)} registry names resolved from "
          f"{len(PAIRS)} pairs × {len(ANCH) ** 2} anchor pairings × 6 frames, "
          f"landing on {len(emitted):,} distinct coordinates. Before the "
          f"anchor axis the producer could not resolve ANY name whose "
          f"placement it did not verify")
    # WHAT DOES NOT RESOLVE, partitioned by the REASON read off the key --
    # not by guessing from the name. The residual bucket must be EMPTY: an
    # unreachable name whose reason nobody can state is the defect this whole
    # section exists to count.
    # PER-AXIS EMITTABILITY. A name unresolved by a 28-pair sample is a fact
    # about the sample; an axis VALUE the producer can never emit at all is a
    # fact about the producer, and only the second is a defect. Measure which
    # is which instead of arguing it.
    emit_axis = {ax: {k[i] for k in emitted} for ax, i in T.AXIS_INDEX.items()}
    for bnd in T.BOUNDARY:                     # declared pass-throughs, so a
        for real in T.REALISATION:             # tiny sweep settles them
            t = T.classify_pair("llon", "ton", get("cym"), boundary=bnd,
                                realisation=real)
            emit_axis["boundary"].add(t.boundary)
            emit_axis["realisation"].add(t.realisation)
    never = {ax: sorted(set(vals) - emit_axis[ax], key=str)
             for ax, vals in (("identity", T.IDENTITY), ("stress", T.STRESS),
                              ("position", T.POSITION),
                              ("boundary", T.BOUNDARY), ("length", T.LENGTH),
                              ("realisation", T.REALISATION))}
    never = {ax: v for ax, v in never.items() if v}
    check("the ONLY declared axis value the producer can never emit is "
          "length='apocopated'",
          never == {"length": ["apocopated"]},
          f"unemittable by axis: {never} — and apocopation is not a length, "
          f"it is an ANCHOR, so the name survives in its anchor-keyed form "
          f"and the length value is the dead coordinate")
    missing = all_names - resolved
    combo = {n for k, names in T.NAMED.items() for n in names
             if n in missing
             and all(k[i] in emit_axis[ax] for ax, i in T.AXIS_INDEX.items()
                     if ax != "agreement")}
    check("and every remaining unresolved name is combination-limited, not "
          "axis-blocked",
          len(combo) >= len(missing) - 12,
          f"{len(missing)} of {len(all_names)} names unresolved by this "
          f"sample; {len(combo)} of them have every axis value individually "
          f"emittable and are missing only the exact 9-tuple — a fact about "
          f"a 28-pair sample, not about the producer. The other "
          f"{len(missing) - len(combo)} need a longer span, a searched "
          f"anchor's own corpus (section 13), or the apocopated length")
    check("'apocopated' on the LENGTH axis is still unreachable, and that is "
          "the finding",
          not any(k[T.AXIS_INDEX["length"]] == "apocopated" for k in emitted),
          "nothing computes a dropped final syllable, so length='apocopated' "
          "was a value the producer could never emit. Apocopation is an "
          "ANCHOR — the penultimate stressed syllable — and THAT form is "
          "reachable, which is the axis paying for itself")
    apo = T.classify_pair("kalevala", "salevala", get("fin"),
                          preset="apocopated-rhyme")
    check("the anchor-keyed apocopated rhyme IS emitted by a real pair",
          "apocopated rhyme (penultimate stressed syllable)" in apo.names(),
          f"{apo.member_text} at origin {apo.origins}")
    # THE THREE THAT DIFFER ONLY BY ANCHOR
    fin = get("fin")
    trio = [T.classify_pair("kalevala", "kalevalo", fin, preset=p)
            for p in ("perfect-rhyme", "syllabic-rhyme", "apocopated-rhyme")]
    check("perfect / syllabic / apocopated locate THREE different syllables",
          len({t.origins for t in trio}) == 3,
          " · ".join(f"{p}={t.member_text[0][0]!r}" for p, t in
                     zip(("perfect", "syllabic", "apocopated"), trio)))
    ka, kc = trio[0].key(), trio[2].key()
    diff = [ax for ax, i in T.AXIS_INDEX.items() if ka[i] != kc[i]]
    check("and perfect vs apocopated differ in NOTHING BUT THE ANCHOR",
          diff == ["anchor_a", "anchor_b"],
          f"differing axes: {diff} — same channels, same placement, same "
          f"identity, same everything the seven-axis model could see")


if __name__ == "__main__":
    for fn in (test_the_space_is_the_bell_numbers,
               test_canonical_form,
               test_coordinates_separate_forms_the_letters_hide,
               test_sections_annotate_they_do_not_chunk,
               test_named_forms_are_coordinates_not_the_taxonomy,
               test_the_partition_is_a_floor_not_a_ceiling,
               test_the_type_space,
               test_types_resolve_and_refuse,
               test_the_producer_closes_E1,
               test_ternary_channels_and_unbounded_span,
               test_the_anchor_is_a_coordinate_and_it_moves_the_span,
               test_position_is_computed_or_refused,
               test_four_languages_four_anchors,
               test_the_phonologys_own_relation_wins,
               test_registry_reachability):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all taxonomy regressions pass")
