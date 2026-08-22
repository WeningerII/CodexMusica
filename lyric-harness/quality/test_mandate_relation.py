#!/usr/bin/env python3
"""Regressions for the DECLARED RELATION coordinate on a mandate.

Added 2026-08-22 on the owner's ruling that a door admitting two relations
out of a 601-entry world survey is not a palette. The fix is NOT a wider
global set: `admits()` answers "what satisfies ANY mandate anywhere", so
widening it makes every requirement in every song looser. A PER-GROUP
declared relation is richer AND stricter, and §4 is the section that proves
the stricter half — a group declaring ASSONANCE is not satisfied by a full
rhyme.

Sections:
  1  the vocabulary — derived from NAMED, two granularities, no collisions
  2  the judge — both directions, tradition synonyms, refusal vs no
  3  the mandate learns the coordinate — index alignment, refusals,
     and the both-judges rule
  4  grade() routes a declared group through the named-type engine, the
     default path is byte-identical, and the declaration is STRICTER
  5  POSITION is declared, never assumed (M-34)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import rhyme_types as RT                       # noqa: E402
from quality.schemes import mandate, Mandate, NoMandate      # noqa: E402
from quality.revise import Reviser                           # noqa: E402
import lyric_harness as LH                                   # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# `night`/`light` is a masculine rhyme and NOT a feminine one, and that is
# the whole fixture: one pair a declaration can be right or wrong about.
LINES = ["The lamp goes out into the night",
         "and everything I own is light"]
_R = Reviser(LH.Lexicon())
_PHON = None


def _phon():
    global _PHON
    if _PHON is None:
        from quality import phonology as PH
        _PHON = PH.get("eng")
    return _PHON


def _why(**kw):
    """-> grade()'s `why` for the single pair, or None when satisfied."""
    g = _R.grade(LINES, mandate("AA", **kw))
    if g.get("refusals"):
        return "REFUSED: " + g["refusals"][0]["reason"]
    v = g["verdicts"][0] if g.get("verdicts") else None
    return (v or {}).get("why")


def test_vocabulary():
    print("\n1. the declarable vocabulary")
    v = RT.relation_vocabulary()
    check("the coarse classes are declarable",
          all(v.get(n) == "class" for n in RT.CLASS_RELATIONS),
          list(RT.CLASS_RELATIONS))
    named = {k for k, kind in v.items() if kind == "named"}
    check("the named types are DERIVED from NAMED, not re-typed — every "
          "synonym in every cell is declarable",
          named == {n for names in RT.NAMED.values() for n in names},
          "%d named" % len(named))
    check("a tradition's own word resolves to the same cell as the "
          "English one — `qafiya` and `masculine rhyme` are one question",
          "qafiya" in named and "masculine rhyme" in named)
    check("no name is both a coarse class and a named cell — one "
          "declaration cannot mean two things",
          RT.relation_collisions() == (), RT.relation_collisions())
    check("resolution is case-insensitive across the two tables, which "
          "spell themselves differently",
          RT.resolve_relation("rhyme")[0] == "RHYME"
          and RT.resolve_relation("QAFIYA")[0] == "qafiya")
    try:
        RT.resolve_relation("no such relation")
        check("an unknown name REFUSES", False, "it resolved")
    except RT.RelationRefused as e:
        check("an unknown name REFUSES rather than falling back to the "
              "default — a relation that does not exist, graded as the "
              "default, is a silently different question (doctrine 20)",
              "not a declarable relation" in str(e))


def test_judge():
    print("\n2. the judge, in both directions")
    p = _phon()
    check("a coarse class is answered from the score alone — no "
          "classify_pair, no phonology needed",
          RT.satisfies_relation("RHYME", "RHYME") is True
          and RT.satisfies_relation("ASSONANCE", "RHYME") is False)
    check("a named type SATISFIES when the pair stands in it",
          RT.satisfies_relation("masculine rhyme", "RHYME", "night", "light",
                                p, position="end") is True)
    check("...and its tradition synonym gives the same answer, because "
          "they name one cell",
          RT.satisfies_relation("qafiya", "RHYME", "night", "light",
                                p, position="end") is True)
    check("a named type REFUSES the pair when it does not stand in it — "
          "the classifier can say no, so it is not an instrument that "
          "only ever says yes (doctrine 94)",
          RT.satisfies_relation("feminine rhyme", "RHYME", "night", "light",
                                p, position="end") is False)
    check("...and says yes to a pair that DOES stand in it",
          RT.satisfies_relation("feminine rhyme", "RHYME", "mother",
                                "brother", p, position="end") is True)
    unread = RT.satisfies_relation("masculine rhyme", "RHYME", "zzzqx",
                                   "light", p, position="end")
    check("an unreadable member is None — a REFUSAL, never a no. Reading "
          "it as False charges the writer for a word the engine cannot "
          "pronounce (doctrine 79)", unread is None, repr(unread))


def test_mandate_coordinate():
    print("\n3. the mandate learns the coordinate")
    check("absence means DEFAULT, and the default is \"\" rather than an "
          "invented name — the default is the coarse admit SET, which is "
          "not a row in this vocabulary",
          mandate("ABAB").relation_of(0) == "")
    m = mandate("ABAB", relations={"A": "qafiya"})
    check("a declaration lands on the group its LABEL names",
          (m.relation_of(0), m.relation_of(1)) == ("qafiya", ""))
    check("a short tuple reads as default for the tail, so widening a "
          "mandate by one group shifts nothing (doctrine 66)",
          Mandate(n_lines=4, groups=((1, 3), (2, 4)), labels=("A", "B"),
                  relations=("qafiya",)).relation_of(1) == "")
    for bad, why in (({"A": "not a relation"}, "an unknown name"),
                     ({"Z": "qafiya"}, "a label naming no group"),
                     ({7: "qafiya"}, "an index outside the mandate")):
        try:
            mandate("ABAB", relations=bad)
            check("%s refuses" % why, False, "it was accepted")
        except NoMandate:
            check("%s refuses IN THE MANDATE LAYER'S OWN TYPE, so every "
                  "CLI surface turns it into REFUSED at exit 2" % why, True)
    try:
        mandate("ABAB", relations={"A": "qafiya"},
                structures={"A": "perfect-rhyme"})
        check("a group declaring BOTH a structure and a relation refuses",
              False, "it was accepted")
    except NoMandate as e:
        check("a group declaring BOTH a structure and a relation refuses — "
              "two judges over one group's pairs, and which answered would "
              "depend on grade()'s branch order (doctrine 1)",
              "two judges" in str(e))
    ok = mandate("ABAB", relations={"A": "qafiya"},
                 structures={"B": "perfect-rhyme"})
    check("...but the two coordinates coexist on DIFFERENT groups, which "
          "is the whole point of them being per-group",
          ok.relations[0] == "qafiya" and ok.structures[1] == "perfect-rhyme")


def test_grade_routing():
    print("\n4. grade() routes a declared group, and the declaration BINDS")
    check("a mandate that never learned the coordinate takes the old path",
          _why() is None)
    check("a declared coarse class the pair satisfies is satisfied",
          _why(relations={"A": "RHYME"}) is None)
    check("a declared NAMED type the pair satisfies is satisfied",
          _why(relations={"A": "masculine rhyme"}) is None)
    check("...and so is its tradition synonym",
          _why(relations={"A": "qafiya"}) is None)
    w = _why(relations={"A": "feminine rhyme"})
    check("a declared named type the pair does NOT satisfy FLAGS, and the "
          "finding names the relation", w and "feminine rhyme" in w, w)
    # THE STRICTER HALF, and the reason this is not a wider global set.
    a = _why(relations={"A": "ASSONANCE"})
    check("A GROUP DECLARING ASSONANCE IS NOT SATISFIED BY A FULL RHYME. "
          "This is what a global widening could never express: adding "
          "ASSONANCE to `admits()` makes every requirement in every song "
          "satisfiable by assonance — looser. Asked per group, the same "
          "name is STRICTER.", a and "ASSONANCE" in a, a)
    check("an unreadable member REFUSES the pair rather than failing it",
          str(_R.grade(["zzzqx qqzzx", "and everything I own is light"],
                       mandate("AA", relations={"A": "masculine rhyme"}))
              .get("refusals", []))[:1] != "")


def test_position_is_declared():
    print("\n5. position is DECLARED, never assumed (M-34)")
    need = sum(1 for k in RT.NAMED if k[3] is not None)
    check("31 of the 49 named types require a non-None position — the "
          "measurement M-34 rests on",
          (need, len(RT.NAMED)) == (31, 49), "%d of %d" % (need, len(RT.NAMED)))
    t = RT.classify_pair("night", "light", _phon())
    check("`classify_pair` takes two bare words and leaves position None, "
          "so those 31 can never match on that path — which is why the "
          "`types` verb reports UNNAMED for a masculine rhyme",
          t.position is None and t.names() == (), (t.position, t.names()))
    try:
        RT.satisfies_relation("masculine rhyme", "RHYME", "night", "light",
                              _phon())
        check("a named relation with no declared position REFUSES", False,
              "it answered")
    except RT.RelationRefused as e:
        check("a named relation with no declared position REFUSES rather "
              "than silently answering 'no name here' for two thirds of "
              "the vocabulary (doctrine 45)", "POSITION" in str(e))
    try:
        RT.satisfies_relation("masculine rhyme", "RHYME", "night", "light",
                              _phon(), position="nowhere")
        check("an undeclared position value REFUSES", False, "it answered")
    except RT.RelationRefused as e:
        check("an undeclared position value REFUSES against the declared "
              "vocabulary", "not in the declared vocabulary" in str(e))
    # FOUND 2026-08-22 by comparing this judge against `relations.py`'s
    # schema of the same name: the schema REFUSED on all 12 test pairs while
    # this answered a flat False on all 12.
    check("the realisation axis is exactly ('phonetic','eye','historical') "
          "and only TWO of the 49 keys sit off 'phonetic'",
          RT.REALISATION == ("phonetic", "eye", "historical")
          and sum(1 for k in RT.NAMED if k[6] != "phonetic") == 2,
          RT.REALISATION)
    for nm in ("eye rhyme", "sight rhyme", "historical rhyme"):
        try:
            RT.satisfies_relation(nm, "RHYME", "night", "light", _phon(),
                                  position="end")
            check("%s REFUSES rather than answering False" % nm, False,
                  "it answered")
        except RT.RelationRefused as e:
            check("%s is only reachable at a non-phonetic realisation, so it "
                  "REFUSES rather than answering False — `classify_pair` "
                  "reads a phonemic stream and cannot see the channel the "
                  "relation is defined on (doctrine 20/79)" % nm,
                  "NON-PHONETIC" in str(e))
    check("...and the rule does NOT swallow the 47 phonetic keys: a "
          "masculine rhyme still answers, and answers True",
          RT.satisfies_relation("masculine rhyme", "RHYME", "night", "light",
                                _phon(), position="end") is True)


if __name__ == "__main__":
    for fn in (test_vocabulary, test_judge, test_mandate_coordinate,
               test_grade_routing, test_position_is_declared):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("a mandate names the relation it wants — richer than a wider "
          "global set, and stricter than the door it replaces")
