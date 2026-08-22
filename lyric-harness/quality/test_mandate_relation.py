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
  6  the MANDATE-LEVEL relation is the default route — the round trip
     through the store, idempotence under replace(), resolution order,
     and the gate in grade() that has to ask for it
  7  the re-open path carries every coordinate it is not re-declaring —
     the dropped ReturnRule (M-53) and the dropped relations (M-50)
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
    check("resolution is case-insensitive across the tables, which spell "
          "themselves differently",
          RT.resolve_relation("rhyme")[0] == "RHYME"
          and RT.resolve_relation("QAFIYA")[0] == "qafiya")

    # THE NAMESPACES — owner's ruling 2026-08-22 on M-37.
    check("three namespaces are declared", RT.NAMESPACES ==
          ("class", "type", "schema"), RT.NAMESPACES)
    amb = RT.relation_ambiguities()
    check("26 names are in more than one namespace, and every one of them is "
          "(schema, type) — the classes escape only because they are spelled "
          "in capitals, which is a finding and not a reassurance",
          len(amb) == 26 and set(amb.values()) == {("schema", "type")},
          (len(amb), sorted(set(amb.values()))))
    for bare in ("assonance", "syllabic rhyme", "consonance"):
        try:
            RT.resolve_relation(bare)
            check("bare %r refuses" % bare, False, "it resolved")
        except RT.RelationRefused as e:
            check("a bare name in two namespaces REFUSES and prints both "
                  "prefixed forms — picking one would make a mandate mean "
                  "whichever table was consulted first (%r)" % bare,
                  "namespaces" in str(e) and "type:" in str(e)
                  and "schema:" in str(e))
    check("an explicit prefix is unambiguous in every namespace",
          RT.resolve_relation("type:assonance") == ("assonance", "named")
          and RT.resolve_relation("schema:assonance") == ("assonance", "schema")
          and RT.resolve_relation("class:ASSONANCE") == ("ASSONANCE", "class"))
    check("...and the 51 schema-only and 54 type-only names still resolve "
          "BARE, so namespacing costs nothing where nothing is ambiguous",
          RT.resolve_relation("perfect rhyme")[1] == "schema"
          and RT.resolve_relation("qafiya")[1] == "named")
    check("EXACT match is tried across all three before any case-insensitive "
          "pass, so `ASSONANCE` stays the class while `assonance` refuses — "
          "the two are one shift key apart and must not silently swap",
          RT.resolve_relation("ASSONANCE") == ("ASSONANCE", "class"))
    try:
        RT.resolve_relation("nosuchns:qafiya")
        check("an undeclared namespace refuses", False, "it resolved")
    except RT.RelationRefused as e:
        check("an undeclared namespace refuses against the declared list",
              "declared namespaces" in str(e))
    try:
        RT.satisfies_relation("schema:perfect rhyme", "RHYME", "night",
                              "light", _phon(), position="end")
        check("the schema namespace refuses at the JUDGE", False, "it answered")
    except RT.RelationRefused as e:
        check("a `schema:` name is declarable but NOT judgeable yet — a "
              "RelationSchema is evaluated over a whole stream, and routing "
              "it is gated on the null sweep, so it refuses rather than "
              "grading as something else", "schema" in str(e))
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
    check("a declaration lands on the group its LABEL names, STORED "
          "NAMESPACED so it re-resolves to the same judge (M-49)",
          (m.relation_of(0), m.relation_of(1)) == ("type:qafiya", ""))
    check("a short tuple reads as default for the tail, so widening a "
          "mandate by one group shifts nothing (doctrine 66)",
          Mandate(n_lines=4, groups=((1, 3), (2, 4)), labels=("A", "B"),
                  relations=("type:qafiya",)).relation_of(1) == "")
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
          ok.relations[0] == "type:qafiya"
          and ok.structures[1] == "perfect-rhyme")


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
    # PREFIXED, because `eye rhyme` and `historical rhyme` are ALSO schema
    # names and a bare form now refuses for AMBIGUITY first (the namespace
    # ruling). Naming the namespace is what isolates the realisation rule —
    # which is the ruling working, not a workaround.
    for nm in ("type:eye rhyme", "type:sight rhyme", "type:historical rhyme"):
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




def test_mandate_level_default():
    print("\n6. the MANDATE-LEVEL relation is the default route")
    import dataclasses
    base = mandate("ABAB")

    # 6a. THE ROUND TRIP. `_resolve_relation` used to store the BARE
    #     canonical name and drop the namespace beside it, and `grade()`
    #     re-resolves that value through `satisfies_relation`. 26 of the 131
    #     distinct declarable names live in BOTH the `type` and `schema`
    #     namespaces — the whole reason M-37 made the namespace mandatory —
    #     so those declarations were ACCEPTED AT THE DOOR AND REFUSED AT THE
    #     JUDGE, which reads as taken. Measured over the whole vocabulary
    #     before the fix: 105 survived, 52 refused.
    v = RT.namespaced_vocabulary()
    survive = refused = 0
    for ns, names in v.items():
        for n in names:
            m = Mandate(n_lines=4, groups=base.groups, labels=base.labels,
                        default_relation=f"{ns}:{n}")
            try:
                RT.resolve_relation(m.default_relation)
                survive += 1
            except RT.RelationRefused:
                refused += 1
    check("EVERY declarable relation survives the store — the value a "
          "mandate keeps re-resolves to the SAME judge, which a bare "
          "canonical name does not for the 26 two-namespace names "
          "(`MISSING.md` M-49; 105 survived / 52 refused before)",
          refused == 0 and survive == sum(len(x) for x in v.values()),
          f"{survive} survive, {refused} refused")

    # 6b. IDEMPOTENCE. `Mandate` validates in `__post_init__`, so every
    #     `dataclasses.replace` — the re-open path's own move — re-runs it.
    #     A store that does not re-resolve makes `replace` refuse a mandate
    #     that was already accepted.
    m = Mandate(n_lines=4, groups=base.groups, labels=base.labels,
                default_relation="type:rime riche")
    ok = True
    try:
        again = dataclasses.replace(m, origin="re-opened")
        ok = again.default_relation == m.default_relation
    except NoMandate:
        ok = False
    check("re-opening a mandate does not refuse the relation it already "
          "accepted — validation at __post_init__ means every replace() "
          "re-validates, so the stored form has to be idempotent", ok)

    # 6c. RESOLUTION ORDER.
    check("a group that declares nothing takes the mandate's relation",
          m.relation_of(0) == "type:rime riche"
          and m.relation_of(1) == "type:rime riche")
    ov = Mandate(n_lines=4, groups=base.groups, labels=base.labels,
                 relations=("type:mosaic rhyme", ""),
                 default_relation="type:rime riche")
    check("a group's OWN declaration wins, and the default fills the rest — "
          "the only order that lets a song be mostly one relation with "
          "exceptions",
          (ov.relation_of(0), ov.relation_of(1))
          == ("type:mosaic rhyme", "type:rime riche"))
    check("a mandate declaring NEITHER still answers \"\", which is the "
          "coarse `Declaration.admit` path — so every caller that never "
          "learned this field is byte-for-byte unchanged",
          base.relation_of(0) == "")

    # 6d. A TYPO REFUSES AT DECLARATION TIME, not at grade time.
    try:
        Mandate(n_lines=4, groups=base.groups, labels=base.labels,
                default_relation="type:rime richee")
        check("an unknown mandate-level relation refuses", False,
              "it was accepted")
    except NoMandate:
        check("an unknown mandate-level relation refuses WHEN THE MANDATE "
              "IS WRITTEN — the writer is still holding the sentence they "
              "got wrong, and a name graded as the coarse default is a "
              "silently different question (doctrine 20)", True)

    # 6e. THE GATE. This is the half that makes the field a coordinate
    #     rather than a knob: `grade()` gated its named-type import on
    #     `m.relations` alone, so a mandate declaring ONLY the default was
    #     graded by the coarse admit set in silence.
    lines = ["she waited out the falling night",
             "and there rode up a shining knight",
             "the light was falling on the bay",
             "a horse was standing in the way"]
    aabb = mandate("AABB", n_lines=4)

    def _viol(m_):
        g = _R.inspect(lines, m_)["grade"]
        return tuple(sorted(v["lines"] for v in g["verdicts"] if v.get("why")))

    coarse = _viol(aabb)
    defaulted = _viol(dataclasses.replace(
        aabb, default_relation="type:rime riche"))
    pergroup = _viol(mandate("AABB", n_lines=4,
                             relations={"A": "type:rime riche",
                                        "B": "type:rime riche"}))
    check("declaring the relation ONCE at the mandate level is the SAME "
          "declaration as repeating it on every group — same verdicts, so "
          "the shorthand is not a second meaning (doctrine 1)",
          defaulted == pergroup, f"{defaulted} == {pergroup}")
    check("...and it is READ: the coarse admit set passes both pairs and "
          "the declared relation does not, so a gate that ignored this "
          "field would report a clean draft on a question nobody asked",
          defaulted != coarse, f"coarse {coarse} vs declared {defaulted}")
    check("the declaration is not a blanket no — night/knight IS a rime "
          "riche and stands, bay/way is a perfect rhyme and does not",
          defaulted == ((3, 4),), str(defaulted))




def test_reopen_carries_what_it_is_not_declaring():
    print("\n7. the re-open path carries every coordinate it is not "
          "re-declaring")
    import dataclasses
    from quality.schemes import ReturnRule

    # M-53. `mandate()` opens with `rule = rule or ReturnRule()`, so the
    # parameter is non-None for the rest of the function and a later
    # `if rule is None` cannot fire. The re-open branch passed that value to
    # `_normalise_returns` AND to the stored field, so SILENCE WAS READ AS A
    # DECLARATION OF THE DEFAULT and every re-open replaced the writer's rule.
    r = ReturnRule(return_verbatim="verbatim", return_rhyme="positional")
    base = mandate([[1, 3], [2, 4]], n_lines=4, returns=[[2, 4]], rule=r)
    check("the premise: a non-default rule is stored as declared",
          base.rule.return_rhyme == "positional", base.rule.return_rhyme)
    for kw, tag in ((dict(default_relation="type:rime riche"),
                     "default_relation"),
                    (dict(relations={"A": "type:qafiya"}), "relations"),
                    (dict(structures={"A": "perfect-rhyme"}), "structures"),
                    (dict(returns=[[1, 3]]), "returns"),
                    (dict(scope=[1, 2, 3, 4]), "scope")):
        again = mandate(base, **kw)
        check(f"re-opening to add {tag} carries the declared ReturnRule — "
              f"`return_rhyme` decides whether a return class's rhyme "
              f"obligations are read as a UNION with its group's or "
              f"POSITIONALLY, so re-defaulting it re-judges the song "
              f"(`MISSING.md` M-53)",
              again.rule == base.rule, again.rule.return_rhyme)
    r2 = ReturnRule(return_verbatim="verbatim", return_rhyme="union")
    check("...and an EXPLICIT rule on the re-open still wins — the fix "
          "distinguishes silence from a declaration, it does not make the "
          "field unwritable",
          mandate(base, default_relation="type:rime riche",
                  rule=r2).rule == r2)
    check("...and a FRESH build with no rule still gets the default, so the "
          "`rule or ReturnRule()` contract is untouched for every caller "
          "that never declared one",
          mandate("ABAB").rule == ReturnRule())

    # THE RELATIONS HALF OF THE SAME BRANCH — M-50. `relations` was in
    # neither the re-open guard nor the `added` list that builds `origin`.
    plain = mandate("ABAB")
    reop = mandate(plain, relations={"A": "type:qafiya"})
    check("a re-declared relation is CARRIED, not dropped — before M-50 this "
          "compared EQUAL to the mandate it re-opened, which is a declared "
          "coordinate consumed and ignored",
          reop.relations and reop.relations[0] == "type:qafiya"
          and reop != plain, str(reop.relations))
    check("...and `origin` NAMES it, so the provenance string is not a "
          "trailing conjunction with nothing after it",
          "relations" in reop.origin, reop.origin)


if __name__ == "__main__":
    for fn in (test_vocabulary, test_judge, test_mandate_coordinate,
               test_grade_routing, test_position_is_declared,
               test_mandate_level_default,
               test_reopen_carries_what_it_is_not_declaring):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("a mandate names the relation it wants — richer than a wider "
          "global set, and stricter than the door it replaces")
