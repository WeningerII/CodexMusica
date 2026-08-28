#!/usr/bin/env python3
"""Regressions for the DECLARED RELATION coordinate on a mandate.

Added 2026-08-22 on the owner's ruling that a door admitting two relations
out of a 601-entry world survey is not a palette. A PER-GROUP declared
relation is richer AND stricter, and §4 is the section that proves the
stricter half — a group declaring ASSONANCE is not satisfied by a full rhyme.

~~"The fix is NOT a wider global set: `admits()` answers 'what satisfies ANY
mandate anywhere', so widening it makes every requirement in every song
looser."~~ SUPERSEDED THE SAME DAY, by the owner, and the superseded text
stays visible (doctrine 17). Both halves of that sentence are true and the
conclusion drawn from them was still wrong: looser was the RIGHT direction
for that particular door, because doctrines 3/24 make ASSONANCE and
CONSONANCE real named sonic events and the mandate layer was then saying
those names satisfy nothing — one repository giving two opposite answers
about one pair. MEASURED across the sonnet battery: of 726 flagged mandated
pairs, 355 (48.9%) were typed ASSONANCE or CONSONANCE by this harness's own
band. The default now admits all four; narrowing is the declared move.

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
  8  the `schema:` namespace is judged — over the stream, per pair
  9  identity is the schema's own ruling (M-124)
  10 the M-148 gate — every drawable name accepts its canonical answer
     through the grade route, at default AND at declared slots
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


def test_the_schema_namespace_is_judged():
    """§8 — the 77 `schema:` names, live (2026-08-22).

    These resolved 77/77 through the vocabulary and refused 77/77 at the
    judge, for two stated reasons. One was real — a `RelationSchema` is
    evaluated by `relations.realise()` over a whole STREAM and
    `satisfies_relation` holds two words — and is fixed by doing the stream
    work in `grade()`, where the lines are, and handing the judge the line
    pairs. The other, ~~"gated on the null sweep: a schema that does not beat
    its own null must not become enforceable"~~, is struck by owner ruling:
    the null sweep governs what the harness may ASSERT unprompted, not what
    a writer may ASK FOR by name.

    The three answers this section pins are three DIFFERENT answers, which
    is the whole point (doctrine 20): satisfied, violated, and two distinct
    refusals — one for a figure no pair can stand in, one for evidence this
    draft does not carry.
    """
    print("\n8. the `schema:` namespace is judged — over the stream, "
          "answered per pair")
    from quality.revise import Reviser
    rv = Reviser()
    # L2/L4 = 'much'/'touch' (a perfect rhyme); L1/L3 = 'sun'/'turn'.
    draft = ["we lay all day beneath the sun",
             "these old hands never asked for much",
             "the river runs and will not turn",
             "i felt the cold of your last touch"]

    def _grade(rel, grp=None):
        m = mandate([grp or [2, 4]], n_lines=4, default_relation=rel)
        return rv.grade(draft, m)

    g = _grade("schema:perfect rhyme")
    check("a declared SCHEMA is SATISFIED where it holds — 'much'/'touch' "
          "under `schema:perfect rhyme`, the namespace that refused every "
          "one of its 77 names until today",
          not g["violations"] and not g["refusals"],
          (g["violations"], g["refusals"]))

    g = _grade("schema:consonance")
    check("...and VIOLATED where it does not — the same pair is a full "
          "rhyme, not a consonance, so the schema route is STRICTER than "
          "the coarse door and not merely another way to pass",
          len(g["violations"]) == 1 and not g["refusals"],
          (g["violations"], g["refusals"]))

    g = _grade("schema:alliteration")
    check("an INTRA-LINE figure REFUSES and names its placement — 19 of "
          "the 77 are properties of ONE line, and answering `False` would "
          "charge the writer for asking a question the schema does not "
          "answer (doctrine 20)",
          len(g["refusals"]) == 1 and not g["violations"]
          and "INTRA-LINE" in g["refusals"][0]["reason"]
          and "same_line" in g["refusals"][0]["reason"],
          g["refusals"][0]["reason"][:160] if g["refusals"] else g)

    # REPOINTED FROM ~~`schema:holorhyme`~~ TO `schema:antanaclasis`, 2026-08-22
    # — and the repoint is the good news, not a workaround. `holorhyme` needed
    # `lexicon`, and the SAME LOT that wrote this check went on to supply it
    # (`quality/morphology.py`, lexeme = root), so the schema now JUDGES and
    # correctly says `much`/`touch` is not a holorhyme. A check that asserts
    # "this refuses" is invalidated by the thing it names being built, which
    # is the healthiest possible reason for a test to move. `antanaclasis`
    # needs `sense` — one word in two SENSES — and nothing in this repo
    # supplies a sense inventory, so it is the live example of the third
    # answer.
    g = _grade("schema:antanaclasis")
    check("a schema whose CAPABILITY this draft cannot supply refuses with "
          "the capability named — a REFUSAL, never a failure (doctrine 79), "
          "and distinct from the placement refusal above",
          len(g["refusals"]) == 1 and not g["violations"]
          and "sense" in g["refusals"][0]["reason"],
          g["refusals"][0]["reason"][:160] if g["refusals"] else g)

    check("the two refusals are DIFFERENT TEXT — 'cannot be asked of a "
          "pair' and 'this draft has no evidence' are two answers and "
          "spelling them the same is the collapse doctrine 20 forbids",
          _grade("schema:alliteration")["refusals"][0]["reason"]
          != _grade("schema:antanaclasis")["refusals"][0]["reason"])

    # THE PER-PAIR JUDGE ALONE STILL REFUSES, and must: it is handed two
    # words and no stream, so a caller that skipped the realisation step
    # gets a refusal naming the step rather than a wrong answer.
    import quality.rhyme_types as _RT
    try:
        _RT.satisfies_relation("schema:perfect rhyme", "RHYME",
                               "much", "touch", None, position="end")
        ok = False
    except _RT.RelationRefused as e:
        ok = "instances=" in str(e)
    check("`satisfies_relation` called WITHOUT `instances=` still refuses, "
          "naming the realisation step — the judge never guesses a "
          "whole-stream answer from two words",
          ok)

    # THE REFRAIN-TAIL FRAME, SUPPLIED FROM THE DECLARATION.
    radif = ["the burning wheel keeps turning round again",
             "the empty street is learning how to end again",
             "the burning wheel keeps turning round again",
             "the yearning heart is churning to no end again"]
    m = mandate([[1, 3], [2, 4]], n_lines=4,
                default_relation="schema:epistrophe / radif")
    g = rv.grade(radif, m)
    # THE POSITIVE, NOT THE ABSENCE (2026-08-23, doctrine 17). This asserted
    # `not any("refrain_tail" in r["reason"] for r in g["refusals"])` over a
    # refusals list that is EMPTY on this fixture -- so it held equally if the
    # schema had never been asked, if `default_relation` had been dropped on
    # the floor, or if `grade()` had returned nothing at all. Proving a thing
    # was JUDGED by pointing at an absence of refusals is the shape: the
    # counts say it directly, and `pairs_judged` cannot be 2 on a run that
    # did not run.
    check("`epistrophe / radif` is JUDGED, not refused — `grade()` calls "
          "`mark_refrain_tail` when a declared schema needs the frame, so "
          "the capability the schema demands is supplied by the run that "
          "demands it",
          g["pairs_judged"] == 2 and g["pairs_refused"] == 0
          and not any("refrain_tail" in r["reason"] for r in g["refusals"]),
          f"{g['pairs_judged']} judged / {g['pairs_refused']} refused of "
          f"{g['pairs_mandated']} mandated; refusals "
          f"{[r['reason'][:80] for r in g['refusals']]}")
    # AND THE ARM THAT MAKES THE ONE ABOVE MEAN SOMETHING. A radif's end
    # WORD is the repeated tail, so on the fixture above every route -- this
    # schema, `perfect rhyme`, `cynghanedd groes`, no declaration at all --
    # collapses to the same REPEAT verdict and the same counts. Measured
    # 2026-08-23: all four give judged 2 / refused 0 / 2 violations, and
    # stubbing `mark_refrain_tail` moves none of them. So the fixture ALONE
    # cannot tell a judged schema from an unread coordinate, whatever the
    # condition. The same mandate on a draft with NO refrain tail is what
    # separates them: there the frame cannot be computed and the schema
    # refuses BY NAME, which is only possible if the declaration was read.
    plain = ["the cat sat on the mat", "i sang beneath the moon",
             "he wore a funny hat", "and whistled her a tune"]
    gp = rv.grade(plain, mandate([[1, 3], [2, 4]], n_lines=4,
                                 default_relation="schema:epistrophe / radif"))
    check("...and the SAME declaration on a draft with no refrain tail "
          "REFUSES BY NAME — which is what proves the coordinate was read, "
          "since the radif fixture answers identically under every schema "
          "and under none",
          gp["pairs_judged"] == 0 and gp["pairs_refused"] == 2
          and all("epistrophe / radif" in r["reason"] for r in gp["refusals"]),
          f"{gp['pairs_judged']} judged / {gp['pairs_refused']} refused; "
          f"{[r['reason'][:88] for r in gp['refusals']][:1]}")

    # AND THE ARGUMENT MATTERS. `mark_refrain_tail(stream, lines=None)`
    # answers ZERO on 495 of 495 Hafez ghazals, by its own docstring, because
    # the fraction is taken over lines that never carried the rhyme. The
    # mandate IS the declared rhyme-bearing subset, so it is what gets passed.
    import quality.relations as _R
    from quality.phonology import get as _get
    st = _R.build_stream(radif, _get("eng"), declaration={"language": "eng"})
    before = st.supply("refrain_tail").state
    _R.mark_refrain_tail(st, lines=[0, 1, 2, 3])
    check("the frame is genuinely ABSENT before the mark and PRESENT after "
          "— so the wiring supplies something the stream did not carry, "
          "rather than dressing up a capability it already had",
          before == "absent" and st.supply("refrain_tail").state == "present",
          (before, st.supply("refrain_tail").state))
    check("...and the schema then finds real line pairs on a radif draft",
          len(_R.line_pairs_for(_R.REGISTRY["epistrophe / radif"], st)) == 6,
          _R.line_pairs_for(_R.REGISTRY["epistrophe / radif"], st))
    check("`qafiya (before the radif)` on the same draft returns the EMPTY "
          "set, not a refusal — looked-and-none is a third answer and the "
          "route keeps it apart from both (doctrine 20)",
          _R.line_pairs_for(_R.REGISTRY["qafiya (before the radif)"],
                            st) == frozenset())

    # AND THE COST IS ONLY PAID BY A MANDATE THAT DECLARES ONE.
    m = mandate([[2, 4]], n_lines=4, default_relation="type:rime riche")
    g2 = rv.grade(draft, m)
    check("a mandate declaring a NAMED type never builds a stream — the "
          "schema route is lazy, like the structure route beside it",
          isinstance(g2, dict) and "violations" in g2)



def test_identity_is_the_schemas_own_ruling():
    """§9 — M-124 (2026-08-25): a declared schema's IdentityRule outranks
    the bare REPEAT pre-emption.

    `grade()` charged "REPEAT not rhyme (identical word)" on any pair whose
    bound words were identical, BEFORE the schema route was consulted — so
    a group declaring `schema:anaphora`, whose IdentityRule is token-AGREE
    and whose whole definition is identical line-openers, was refused for
    satisfying its own mandate (one repository, two answers about one pair
    — the M-59 shape at the identity coordinate). Found on the first
    paired-experiment draft: the drawn anaphora unions forced "Here" onto
    nine heads and the grader flagged the two pairs whose SLOTS both bound
    it. A schema group now routes to the schema judge, whose own
    IdentityRule adjudicates on the schema's own spans; a BARE group keeps
    the REPEAT charge byte-identically (doctrine 3 stands)."""
    print("\n9. identity is the schema's own ruling (M-124)")
    rv = Reviser()
    lines = ["Here the boats lie sober",
             "Here the tide writes charters",
             "Here the winter lays its table"]
    m = mandate([[1, 2, 3]], n_lines=3, relations={"A": "schema:anaphora"})
    g = rv.grade(lines, m)
    check("an anaphora group whose bound words are IDENTICAL is "
          "SATISFIED — the schema's token-Agree identity rule is the "
          "declared ruling, and identity here is the requirement",
          not g["violations"], g["violations"])
    m2 = mandate([[1, 2]], n_lines=2)
    g2 = rv.grade(["the tide is high", "the tide is high"], m2)
    check("a BARE group with identical end words still charges REPEAT — "
          "doctrine 3 is untouched where nothing declared otherwise",
          any("REPEAT" in str(v) for v in g2["violations"]),
          g2["violations"])
    m3 = mandate([[1, 2]], n_lines=2,
                 relations={"A": "schema:internal rhyme"})
    g3 = rv.grade(["the tide runs in the bay all night",
                   "the guide walks out the bay at dawn"], m3)
    check("a Differ-identity schema judged on SEARCHED spans reads "
          "nothing off the bound end words — internal rhyme with "
          "identical end words is satisfied by its tide~guide spans, "
          "because the schema's identity rule binds the spans it "
          "matches, not the slots the mandate drew",
          not g3["violations"], g3["violations"])


def test_the_drawable_pool_holds_through_the_grade_route():
    """§10 — THE M-148 GATE. The certified draw pool and the mandate judge
    must agree: every name in `relations.DRAWABLE_SCHEMAS` accepts an answer
    THROUGH THE GRADE ROUTE — `Reviser.grade` on a mandate declaring the
    schema — never only through the `realise()` stream the certificate was
    issued on. M-148's finding is that the two routes disagreed and nothing
    checked them against each other: the skothending schema certified into
    the pool (its witness exhibit `gate~goat` has agreeing ONSETS, so the
    `_seq` onset-inclusion defect could not show there) while refusing 0/6
    of its canonical monosyllable pairs on the route a mandated pair takes.

    Three halves, three different mutations, each named at its check:
      * the WITNESS half — all 22 names grade satisfied on the witness
        (kills a plumbing regression: schema resolution, instances
        threading, a refusal drifting into the route);
      * the CANONICAL-ANSWER half — the skothending battery at default
        slots, which is the check that would have gone red the day M-117
        shipped (kills restoring the whole-syllable `_seq` flatten), and
        `day~sea` VIOLATED (kills dropping the empty-cluster rule, without
        which the 77-schema default door goes vacuous-true on every pair
        of open syllables);
      * the DECLARED-TOKEN half (P2) — the schema judge reads the slot the
        writer bound, proven by CONTRAST: the same schema on the same
        draft satisfied at one declared token and violated at another
        (kills unwiring `pair_satisfies` — under the instances route both
        slots would be judged at the schema's own loci and answer alike).
    """
    print("\n10. the M-148 gate — the drawable pool answers through the "
          "grade route")
    from quality import relations as RL
    rv = Reviser()
    wlines = list(RL.DRAWABLE_WITNESS_LINES)
    wsections = list(RL.DRAWABLE_WITNESS_SECTIONS)
    from quality import phonology as PH
    wstream = RL.build_stream(
        wlines, PH.get("eng"), sections=wsections,
        stanzas=RL.stanzas_from_sections(wsections),
        stanza_source="declared_sections",
        declaration={"language": "eng"})
    bad = []
    for name in RL.DRAWABLE_SCHEMAS:
        ps = RL.line_pairs_for(RL.REGISTRY[name], wstream)
        if isinstance(ps, RL.Refusal) or not ps:
            bad.append((name, "no witness instance"))
            continue
        i, j = min(ps)
        g = rv.grade(wlines,
                     mandate([[i, j]], n_lines=len(wlines),
                             default_relation=f"schema:{name}"),
                     sections=wsections)
        if g["violations"] or g["refusals"]:
            bad.append((name, g["violations"]
                        or [r["reason"][:90] for r in g["refusals"]]))
    check("every drawable name is SATISFIED on its own witness exhibit "
          "through `Reviser.grade` — the route a planned mandate takes, "
          "not the route the certificate was issued on",
          not bad, bad)

    # THE CANONICAL-ANSWER HALF. Five monosyllable pairs with the
    # post-vocalic cluster agreeing in the DECLARED dialect and the nucleus
    # differing — the relation's own definition, and 0/5 before the P1
    # repair. `milk~walk`, which M-148's field battery listed, is
    # deliberately in the VIOLATED arm: CMUdict General American reads
    # `walk` as W-AO-K with the L silent, so that pair is skothending in
    # SPELLING and not in the declared phonology (doctrine 1 — the
    # disagreement is located in the dialect coordinate).
    SK = "schema:cluster consonance / skothending span"

    def _sk(a, b):
        g = rv.grade([f"she kept the {a}", f"he lost the {b}"],
                     mandate("AA", n_lines=2, default_relation=SK))
        if g["refusals"]:
            return "REFUSED: " + g["refusals"][0]["reason"][:80]
        return "violated" if g["violations"] else "satisfied"

    canon = [("fast", "lost"), ("best", "last"), ("hand", "wind"),
             ("night", "gate"), ("heart", "short")]
    wrong = [(a, b, _sk(a, b)) for a, b in canon
             if _sk(a, b) != "satisfied"]
    check("the five canonical monosyllable pairs are SATISFIED at default "
          "slots — fast~lost is the canonical English instance, and this "
          "arm is the check that reds on the whole-syllable `_seq` flatten "
          "(M-148 P1: [F,S,T] vs [L,S,T])",
          not wrong, wrong)
    check("`milk~walk` is VIOLATED — walk's L is silent in the declared "
          "dialect, so the spelling-skothending pair honestly fails the "
          "phonology the mandate grades through",
          _sk("milk", "walk") == "violated", _sk("milk", "walk"))
    check("`day~sea` is VIOLATED, not vacuously satisfied — two open "
          "syllables share an EMPTY post-vocalic cluster, and a cluster "
          "relation over zero consonants must answer False with the reason, "
          "or the 77-schema default door satisfies every such pair silently",
          _sk("day", "sea") == "violated", _sk("day", "sea"))

    # THE DECLARED-TOKEN HALF (P2), BY CONTRAST. One draft, one schema,
    # two slots: `fast` (T3) answers `lost`, `held` (T2) does not. Under
    # the instances route both mandates would be judged at the schema's
    # own line-final loci and answer identically — the contrast is what
    # proves the declared token is READ.
    draft = ["he held fast against the wind", "the thing he loved and lost"]
    g_hit = rv.grade(draft, mandate([["1.T3", 2]], n_lines=2,
                                    default_relation=SK))
    g_miss = rv.grade(draft, mandate([["1.T2", 2]], n_lines=2,
                                     default_relation=SK))
    check("a schema at a DECLARED token is judged AT that token — "
          "`fast`@1.T3 ~ `lost`@2.end SATISFIED",
          not g_hit["violations"] and not g_hit["refusals"],
          (g_hit["violations"], g_hit["refusals"]))
    check("...and the NEIGHBOURING token under the same schema is "
          "VIOLATED (`held`@1.T2), which is the contrast that proves the "
          "slot is read — both answer alike through the instances route",
          len(g_miss["violations"]) == 1 and not g_miss["refusals"],
          (g_miss["violations"], g_miss["refusals"]))

    # A SPAN SHAPE ONE TOKEN CANNOT BIND REFUSES BY NAME (doctrine 20/79):
    # `free_run` searches windows, and reinterpreting it as "this one word"
    # would judge a different schema under the declared one's name.
    g_fr = rv.grade(draft, mandate([["1.T3", 2]], n_lines=2,
                                   default_relation="schema:multisyllabic "
                                                    "rhyme"))
    check("a free_run schema at a declared slot REFUSES with the locus "
          "named — a refusal, never a wrong answer",
          len(g_fr["refusals"]) == 1 and not g_fr["violations"]
          and "free_run" in g_fr["refusals"][0]["reason"],
          g_fr["refusals"][0]["reason"][:120] if g_fr["refusals"] else g_fr)

    # THE CLASS-ROUTE CONTROL (M-148 E2): the route that already read
    # declared slots correctly still does.
    d3 = ["I saw the cat go slipping out", "he went and tipped his hat"]
    g_cls = rv.grade(d3, mandate([["1.T4", 2]], n_lines=2,
                                 default_relation="class:RHYME"))
    check("the CLASS route at a declared slot is unmoved — cat@1.T4 ~ "
          "hat@2.end still satisfies `class:RHYME` (the measured E2 "
          "control)",
          not g_cls["violations"] and not g_cls["refusals"],
          (g_cls["violations"], g_cls["refusals"]))


def test_the_type_judge_past_one_syllable():
    """§11. M-58 — THE NAMED-TYPE JUDGE PAST THE MONOSYLLABLE KEY.

    The registry keys most names at one-syllable cells — an enumeration
    accident, not a claim — so `cellar`/`seller` under `type:rime riche`
    was graded a VIOLATION while `types` called it rime riche on every
    channel of every syllable. Three dispositions now, each pinned:
    EXTENSIBLE names take the anchored-tail rule (the registry's own
    polysyllabic spelling — feminine is (0,1,1)+(1,1,1)); a
    COUNT-DEFINITIONAL name at the wrong length is a REAL no; everything
    else REFUSES naming the registry's gap (doctrine 79 — the writer is
    never charged for a key nobody wrote).
    """
    print("\n§11. M-58 — the type judge past one syllable")
    from quality.revise import _relation_phonology
    phon = _relation_phonology()

    def ask(name, a, b):
        try:
            return RT.satisfies_relation(name, None, a, b, phon,
                                         position="end")
        except RT.RelationRefused:
            return "REFUSED"

    check("the entry's own measured defect: cellar/seller satisfies "
          "`type:rime riche` — identical sound, different word, and "
          "length is nowhere in the definition",
          ask("type:rime riche", "cellar", "seller") is True)
    check("...and flour/flower, the entry's other measured False",
          ask("type:rime riche", "flour", "flower") is True)
    check("...while the four monosyllable answers hold exactly as before",
          all(ask("type:rime riche", a, b) is True
              for a, b in (("rain", "reign"), ("rain", "rein"),
                           ("hoard", "horde"), ("bore", "boar"))))
    check("a failed extension is a REAL no, never a refusal — "
          "cellar/teller is a perfect rhyme (onset differs at the "
          "anchor) and not rime riche",
          ask("type:rime riche", "cellar", "teller") is False)
    check("a COUNT-DEFINITIONAL name at the wrong length is a real no: "
          "masculine rhyme MEANS the final stressed monosyllable, and "
          "the same pair IS feminine rhyme — the vocabulary answers, so "
          "refusing would be false modesty",
          ask("type:masculine rhyme", "cellar", "seller") is False
          and ask("type:feminine rhyme", "cellar", "teller") is True)
    check("a name that is NEITHER refuses naming the registry's gap — "
          "pararhyme has no 2-syllable key and no ruled extension, and "
          "the pair may well stand in it (doctrine 79)",
          ask("type:pararhyme", "cellar", "seller") == "REFUSED")
    check("the identity family extends too: a repeated word is "
          "`type:identical rhyme` at any length",
          ask("type:identical rhyme", "cellar", "cellar") is True)
    # MUTATION 1, hand-proven: empty the EXTENSIBLE set and the entry's
    # headline defect returns as a REFUSAL (not the old False — item 1's
    # honesty holds even under the mutation, which is itself the proof
    # the two repairs are separate).
    keep = RT.EXTENSIBLE
    try:
        RT.EXTENSIBLE = frozenset()
        check("MUTATION: with EXTENSIBLE emptied, cellar/seller stops "
              "satisfying and REFUSES — the extension is what answers, "
              "and item 1's refusal is what catches the gap",
              ask("type:rime riche", "cellar", "seller") == "REFUSED")
    finally:
        RT.EXTENSIBLE = keep
    # MUTATION 2, hand-proven: put pararhyme in COUNT_DEFINITIONAL and
    # its refusal collapses to the old flat False — so the refusal path
    # is the disposition set doing the work, not the fixture.
    keep2 = RT.COUNT_DEFINITIONAL
    try:
        RT.COUNT_DEFINITIONAL = keep2 | {"pararhyme"}
        check("MUTATION: with pararhyme marked count-definitional, the "
              "refusal collapses to a flat False — the three-way "
              "disposition is what keeps the registry's gap honest",
              ask("type:pararhyme", "cellar", "seller") is False)
    finally:
        RT.COUNT_DEFINITIONAL = keep2
    check("...and both mutations are reverted",
          ask("type:rime riche", "cellar", "seller") is True
          and ask("type:pararhyme", "cellar", "seller") == "REFUSED")


if __name__ == "__main__":
    for fn in (test_vocabulary, test_judge, test_mandate_coordinate,
               test_grade_routing, test_position_is_declared,
               test_mandate_level_default,
               test_reopen_carries_what_it_is_not_declaring,
               test_the_schema_namespace_is_judged,
               test_identity_is_the_schemas_own_ruling,
               test_the_drawable_pool_holds_through_the_grade_route,
               test_the_type_judge_past_one_syllable):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("a mandate names the relation it wants — richer than a wider "
          "global set, and stricter than the door it replaces")
