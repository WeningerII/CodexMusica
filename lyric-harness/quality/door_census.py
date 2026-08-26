#!/usr/bin/env python3
"""WHICH DOOR DOES EACH SITE JUDGE A PAIR AT — the census, not the claim.

THE OWNER'S RULING THAT MADE THIS NECESSARY, 2026-08-26, verbatim: *"go find
everywhere it still has the incorrect 4 and make sure all 77 are there ... 4 is
poisonous as fuck. without all 77 we're going to be racking up the wrong
numbers and then we have to come back and do all of this all over again."*

THE DEFAULT DOOR HAS MOVED TWICE AND IT MOVED IN TWO DIFFERENT COORDINATES,
which is the whole reason a site can be behind without looking behind:

  2026-08-22  `MISSING.md` M-59   `Declaration.admit` widened from the
                                  historical {RHYME, RIME_RICHE} to all FOUR
                                  of `ADMITTABLE_RELATIONS`.
  2026-08-25  `MISSING.md` M-116  ALL 77 SCHEMAS joined the default. A
                                  mandated pair that declares no relation is
                                  satisfied when its two lines stand in ANY
                                  schema the vocabulary names, judged by
                                  `relations.whole_vocabulary_pairs`.

So the complete default is **`admits(s, theta, decl.admit)` OR
`whole_vocabulary_pairs`**, and a site reading only the first is not "slightly
strict" — it is answering the question the tree asked in AUGUST 22nd's
vocabulary. Both halves have to be present for a site to be at the default.

WHAT THIS COUNTS AS A SITE. Any place that decides whether a scored pair
stands in a relation, found on the AST and never by reading:

  * a call to `admits(...)`, by either spelling — `admits(...)` and
    `LH.admits(...)`. THE FIRST DRAFT OF THIS FILE SAW ONLY THE FIRST and
    reported 15 sites against a true 19, missing `quality/redteam_band.py`
    entirely — the same shape `gate_census.py`'s first run had when it was
    blind to `quality/grid.py` and therefore reported that layer as fully
    gated. A census blind to a site reports that site as compliant.
  * a membership test against `RHYME_RELATIONS`, or against a LITERAL
    `("RHYME", "RIME_RICHE")` — the second spelling is how
    `quality/redteam_band.py` writes it, and a grep for the constant name
    cannot see it.

SIX DISPOSITIONS, and the split is what keeps this from being a demand that
every site widen. Not every site is judging a mandate.

  FULL         reads `decl.admit` AND consults the 77. The complete default.
  INCOMPLETE   judges MANDATE SATISFACTION and stops short of it. The defect
               class, and the one the ruling above is about.
  PER_WORD     holds a WORD, not a line pair, so it CANNOT ask the 77 —
               `whole_vocabulary_pairs` judges line pairs over a built stream.
               Owes a DISCLOSURE instead, because a field that stays silent
               about a whole acceptance route reads as though nothing else
               could answer (doctrine 20).
  RENDERING    names or counts a relation and gates nothing.
  VALIDATION   validates a DECLARED set at declaration time.
  ARGUED       deliberately narrower, with the argument written at the site.

AN UNRULED SITE FAILS `--check`. That is the half that answers the owner's
"do all of this all over again": a site added at the narrow door with no
ruling is a red check, not something a later sitting rediscovers by hand.

    python3 quality/door_census.py             the census, printed
    python3 quality/door_census.py --check     exit 3 on drift or an unruled
                                               site
"""
import ast
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

#: The historical two, as a SET so the literal-tuple detector compares content
#: rather than spelling. This is the door every site below is measured against
#: — it is what `admits()` falls back to when `relations=` is omitted, by that
#: function's own docstring.
NARROW_LITERAL = frozenset({"RHYME", "RIME_RICHE"})

#: The one judge of the 77 (owner ruling 2026-08-25, M-116). A site "consults
#: the 77" when this name appears anywhere in its enclosing function — matched
#: on the NAME and not on an import path, because both consumers reach it
#: through a local alias (`_RF.whole_vocabulary_pairs`, `_WVP`).
SCHEMA_JUDGE = "whole_vocabulary_pairs"

#: Directories that are not production Python.
SKIP_DIRS = {".git", "corpus", "data", "node_modules", "graphify-out",
             "__pycache__", "examples", "songs", "mcp"}

FULL = "FULL"
INCOMPLETE = "INCOMPLETE"
PER_WORD = "PER_WORD"
RENDERING = "RENDERING"
VALIDATION = "VALIDATION"
ARGUED = "ARGUED"

#: ONE RULING PER SITE, keyed on (relative path, qualified function name) and
#: NEVER on a line number — `MISSING.md`'s Welsh entry records what a line
#: citation into a moving file is worth, and this table would go stale on the
#: next edit above any of these functions.
#:
#: Every ruling states the QUESTION the site asks, because the disposition
#: follows from the question and not from the door it happens to spell.
RULINGS = {
    # ---------------------------------------------------------------- FULL
    ("lyric_harness.py", "check_scheme"): (
        FULL,
        "The scalar+relation chain, followed in the same function by the "
        "77-schema rescue at `admit_is_default(decl)`. One of exactly two "
        "sites in the tree that reach the complete default."),
    ("quality/revise.py", "Reviser.grade"): (
        FULL,
        "The other one. Same shape, same judge, and deliberately the SAME "
        "CALL as `check_scheme`'s so the two graders cannot drift about "
        "which pair the default satisfies (doctrine 1)."),

    ("lyric_harness.py", "check_scheme.ok"): (
        FULL,
        "The transitivity defect counter — a~b, b~c, a!~c inside one letter "
        "group. REPAIRED 2026-08-26 (M-139): it asked SATISFACTION at four, "
        "thirty lines under the 77-schema rescue, so a pair the same "
        "function had just passed read as an ABSENT EDGE and a triangle with "
        "one schema edge was counted a transitivity defect. It now also "
        "consults `_schema_ok`, read from `schema_satisfied` rather than "
        "re-derived, so no second stream is built and the two readings "
        "cannot drift."),

    # ---------------------------------------------------------- INCOMPLETE
    ("quality/revise.py", "Reviser.mandate_from_graph"): (
        INCOMPLETE,
        "`--cliques`: the DERIVED cover. It asks which lines this harness "
        "sees as standing in a relation, then hands that cover to `grade()` "
        "— which accepts on a strictly wider door, so the cover omits edges "
        "its own consumer would have passed. Doctrine 14 governs whether a "
        "derived cover may be used as a control; it does not license the "
        "cover disagreeing with the grader. `MISSING.md` M-139."),
    ("quality/revise.py", "Reviser.group_merges"): (
        INCOMPLETE,
        "The merge detector asks, in its own words, whether every cross pair "
        "would SATISFY the mandate. That is the satisfaction question at "
        "four. `MISSING.md` M-139."),
    ("quality/recover.py", "recover"): (
        INCOMPLETE,
        "The pasted-song door (M-72). Its doctrine-14 claim is that every "
        "edge of the recovered cover is a band-passing pair BY "
        "CONSTRUCTION; under the complete default the cover UNDER-recovers, "
        "so a human's song is structured against a narrower reading than "
        "the one it is then graded at. `MISSING.md` M-139."),

    # ------------------------------------------------------------ PER_WORD
    ("quality/revise.py", "Reviser._field_one"): (
        PER_WORD,
        "The writer's candidate field. It holds ONE WORD and the 77 judge "
        "LINE PAIRS over a built stream, so the schema half is not askable "
        "here at any price. The relation half is, and is now read from "
        "`decl.admit`. The schema half is DISCLOSED through "
        "`Brief.field_declaration`. `MISSING.md` M-139."),

    # ----------------------------------------------------------- RENDERING
    # `check_scheme`'s own naming test is NOT keyed here: this table is keyed
    # by function, that function is already ruled FULL above, and a second
    # entry under the same key would silently overwrite the first (the last
    # literal wins). It is keyed by DOOR KIND in `_BY_DOOR` instead, which is
    # the coordinate that actually separates the two sites.
    ("quality/revise.py", "Reviser._collision_code"): (
        RENDERING,
        "Chooses between `COLLISION` and `NEAR_COLLISION` as the NAME for an "
        "unintended pair. It gates nothing and the collision cut is scalar "
        "by declaration (`COLLISION_CUT_IS_SCALAR_ONLY`)."),
    ("quality/revise.py", "Reviser.inspect"): (
        RENDERING,
        "Counts near-relation collisions apart from rhyme collisions for the "
        "report. Counted off the RELATION on purpose, per the argument at "
        "the site; no verdict turns on it."),

    # ---------------------------------------------------------- VALIDATION
    ("lyric_harness.py", "Declaration.__post_init__"): (
        VALIDATION,
        "Refuses a declared `admit` naming no rhyme relation at all. It "
        "reads the narrow set as a FLOOR on what a declaration may be, "
        "which is the one place the historical two are the right question."),

    # -------------------------------------------------------------- ARGUED
    ("lyric_harness.py", "rhyme_graph"): (
        ARGUED,
        "The pairwise GRAPH and its `theta` — doctrine 2's primary object, "
        "read by `chains`, `graph` and `--cliques`. OPEN under M-139: the "
        "argument for the narrow door here has never been written down, and "
        "an unwritten argument is what this column is for. Filed, not "
        "closed."),
    ("lyric_harness.py", "infer_chains.match"): (
        ARGUED,
        "Chain promotion at `theta_chain`, a DIFFERENT threshold answering a "
        "different question (does this line join a running chain). Same "
        "OPEN status as `rhyme_graph`: narrow, and the reason is unwritten. "
        "`MISSING.md` M-139."),
    ("quality/negative_control.py", "Quatrain.__init__"): (
        ARGUED,
        "The negative control's own door, and it is NARROWER than the "
        "grader's — which UNDERSTATES the chance rate, the flattering "
        "direction (doctrine 14/71). Already filed as `MISSING.md` M-138 "
        "and left to that entry's ruling, because moving it changes what a "
        "recorded measurement means."),
    ("quality/redteam_band.py", "run"): (
        ARGUED,
        "Adversary 3, the instrument whose output IS the `theta_coda` "
        "recalibration. Spells the two as a LITERAL, so it cannot see what "
        "happened to its sibling threshold. `MISSING.md` M-138."),
    ("quality/structure_census.py", "d1_diagnostic"): (
        ARGUED,
        "The chance-rate census's diagnostic, whose own prose declares "
        "RHYME/RIME_RICHE at theta. Declared and stated — but a chance rate "
        "measured at a narrower door than the grader's understates chance, "
        "so it carries the same OPEN question as the negative control. "
        "`MISSING.md` M-138/M-139."),
    ("quality/time_layer.py", "_raw_score"): (
        ARGUED,
        "The time layer, which doctrine 4 records as MUTE — 18 of 20 items "
        "cannot fire at the honest candidate family. Widening a door on a "
        "layer that cannot look changes no measurement, so this is recorded "
        "rather than repaired, and it must move if the layer is ever "
        "powered."),
}

#: The two RENDERING sites inside `check_scheme` cannot be keyed by function
#: alone — the function is FULL and also carries a naming test. Keyed on the
#: door kind as well, because one function legitimately holds both.
_BY_DOOR = {
    ("lyric_harness.py", "check_scheme", "NARROW(literal 2)"): (
        RENDERING,
        "Chooses the WORDING of an unintended-rhyme note ('unintended rhyme' "
        "vs 'unintended {relation}, NOT a rhyme'). A naming choice; the "
        "verdict is settled above it."),
}

#: MEASURED 2026-08-26 on this tree, and the INCOMPLETE count is a DEFECT
#: count rather than a target — it is pinned so it cannot grow quietly, and
#: the repairs that lower it repin it downward in the same commit.
#:
#: THE COUNTS ARE PER SITE, NOT PER RULING, and the first draft pinned
#: `argued` at 6 because it counted the RULINGS table's rows. Two functions
#: hold two sites each — `infer_chains.match` (a `RHYME_RELATIONS` test and an
#: `admits()` call, the fitted-comparator branch and the plain one) and
#: `redteam_band.run` — so a ruling is not a site and summing the table is not
#: the census (doctrine 91: a count is a coordinate of the rendering).
#:
#: THE LADDER, kept visible (doctrine 17). At the census's first run
#: 2026-08-26 the tree measured **full 2 / incomplete 4**: two sites in
#: nineteen reached the complete default. `check_scheme.ok` was repaired in
#: the same sitting and the pins moved with it, which is what a repair is
#: supposed to do to this table. Every remaining INCOMPLETE is OPEN under
#: `MISSING.md` M-139 and each needs its own measurement before it moves.
PINNED = {"sites": 19, "full": 3, "incomplete": 3, "per_word": 1,
          "rendering": 3, "validation": 1, "argued": 8}


def _innermost(tree):
    """-> {node: qualified name of the innermost enclosing def/class}.

    Innermost WINS — the first draft let the outer class overwrite the inner
    function, which filed every `Reviser` method under `Reviser` and made the
    77-consult column a per-CLASS fact. `Reviser` holds both of the tree's
    two complete-default sites and eight others, so that reading reported all
    ten as consulting the 77.
    """
    out = {}

    def walk(node, prefix):
        for ch in ast.iter_child_nodes(node):
            if isinstance(ch, (ast.FunctionDef, ast.AsyncFunctionDef,
                               ast.ClassDef)):
                name = f"{prefix}.{ch.name}" if prefix else ch.name
                for sub in ast.walk(ch):
                    out[sub] = name
                walk(ch, name)
            else:
                walk(ch, prefix)

    walk(tree, "")
    return out


def _reaches_judge(func, sees):
    """Does this site's scope reach the 77 judge — its own, or an ENCLOSING
    one's?

    A NESTED function sees its enclosing scope, and the first draft of this
    detector did not, so it reported `check_scheme.ok` as blind to a judge
    called thirty lines above it in the same function — under-crediting the
    exact repair `MISSING.md` M-139 made there. The prefix chain is the
    scope chain: `a.b.c` reaches the judge when `a.b.c`, `a.b` or `a` calls
    it.

    It does NOT over-credit a sibling: a method reaches its CLASS's body, not
    its class's other methods, because `_innermost` files every node under
    the innermost def and the class body holds no call. `Reviser` holds ten
    sites and two judges and this rule credits neither of the ten.
    """
    parts = func.split(".")
    return any(".".join(parts[:i]) in sees for i in range(len(parts), 0, -1))


def _is_narrow_literal(node):
    if isinstance(node, (ast.Tuple, ast.Set, ast.List)):
        vals = {e.value for e in node.elts
                if isinstance(e, ast.Constant) and isinstance(e.value, str)}
        return vals == NARROW_LITERAL
    return False


def _door_of(node):
    """-> the door this node reads, or None if it is not a site."""
    if isinstance(node, ast.Call):
        f = node.func
        name = (f.id if isinstance(f, ast.Name)
                else f.attr if isinstance(f, ast.Attribute) else None)
        if name == "admits":
            given = (any(k.arg == "relations" for k in node.keywords)
                     or len(node.args) >= 3)
            return "DECLARED(admit)" if given else "NARROW(omitted)"
        return None
    if isinstance(node, ast.Compare) and \
            any(isinstance(o, (ast.In, ast.NotIn)) for o in node.ops):
        for c in node.comparators:
            if isinstance(c, ast.Name) and c.id == "RHYME_RELATIONS":
                return "NARROW(RHYME_RELATIONS)"
            if _is_narrow_literal(c):
                return "NARROW(literal 2)"
    return None


def _files(root):
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(files):
            if not fn.endswith(".py"):
                continue
            if os.path.basename(fn).startswith("test_"):
                continue
            yield os.path.relpath(os.path.join(dirpath, fn), root)


def census(root=None):
    """-> [ {path, line, func, door, sees_77, disposition, ruling} ], sorted.

    REFUSES rather than returning a short list when a file will not parse:
    a census that silently skips a module reports that module as compliant,
    which is this instrument's own first defect (see the module docstring).
    """
    root = root or ROOT
    rows = []
    for rel in _files(root):
        path = os.path.join(root, rel)
        try:
            tree = ast.parse(open(path, encoding="utf-8").read())
        except SyntaxError as exc:
            raise SystemExit(
                f"REFUSED — {rel} does not parse ({exc}). A census that "
                f"skips a file reports that file as compliant (doctrine 20).")
        enc = _innermost(tree)
        sees = set()
        for n in ast.walk(tree):
            nm = (n.id if isinstance(n, ast.Name)
                  else n.attr if isinstance(n, ast.Attribute)
                  else n.name if isinstance(n, ast.alias) else None)
            if nm == SCHEMA_JUDGE:
                sees.add(enc.get(n, "<module>"))
        for n in ast.walk(tree):
            door = _door_of(n)
            if not door:
                continue
            func = enc.get(n, "<module>")
            key3 = (rel, func, door)
            key2 = (rel, func)
            ruled = _BY_DOOR.get(key3) or RULINGS.get(key2)
            rows.append({
                "path": rel, "line": n.lineno, "func": func, "door": door,
                "sees_77": _reaches_judge(func, sees),
                "disposition": ruled[0] if ruled else None,
                "ruling": ruled[1] if ruled else "",
            })
    rows.sort(key=lambda r: (r["path"], r["line"]))
    return rows


def unruled(rows=None):
    """Sites with no ruling. `--check` fails on a non-empty list — an
    unexamined site is not a compliant one (doctrine 20)."""
    rows = census() if rows is None else rows
    return [r for r in rows if r["disposition"] is None]


def counts(rows=None):
    rows = census() if rows is None else rows
    out = {"sites": len(rows)}
    for d, key in ((FULL, "full"), (INCOMPLETE, "incomplete"),
                   (PER_WORD, "per_word"), (RENDERING, "rendering"),
                   (VALIDATION, "validation"), (ARGUED, "argued")):
        out[key] = sum(1 for r in rows if r["disposition"] == d)
    return out


def main(argv):
    check = "--check" in argv
    rows = census()
    c = counts(rows)

    print("WHICH DOOR EACH SITE JUDGES A PAIR AT (M-59 widened it to four, "
          "M-116 added the 77)")
    print(f"  the complete default is `admits(s, theta, decl.admit)` OR "
          f"`{SCHEMA_JUDGE}`\n")
    print(f"  {'file':30s}{'line':>6s}  {'door':24s}{'77':>4s}  "
          f"{'disposition':12s} function")
    for r in rows:
        print(f"  {r['path']:30s}{r['line']:6d}  {r['door']:24s}"
              f"{'YES' if r['sees_77'] else 'no':>4s}  "
              f"{str(r['disposition'] or 'UNRULED'):12s} {r['func']}")

    print(f"\n  SIX DISPOSITIONS, NEVER SUMMED PAST THE PARTITION "
          f"(doctrine 79):")
    for key in ("full", "incomplete", "per_word", "rendering", "validation",
                "argued"):
        print(f"    {key:12s} {c[key]}")
    print(f"    {'sites':12s} {c['sites']}")

    print(f"\n  {c['full']} of {c['sites']} sites reach the complete "
          f"default. That is the finding, not a comfort.")

    if not check:
        return 0

    print("\n" + "=" * 70)
    print("CHECK — every site ruled, and the census against its pins")
    print("=" * 70)
    bad = 0

    bare = unruled(rows)
    if bare:
        for r in bare:
            print(f"  [FAIL] UNRULED site {r['path']}:{r['line']} "
                  f"{r['func']} reads {r['door']} — a pair-satisfaction site "
                  f"with no ruling is not a compliant one. Add it to "
                  f"`RULINGS` with the QUESTION it asks.")
        bad += len(bare)
    else:
        print(f"  [ok  ] all {c['sites']} sites carry a ruling")

    # A FULL RULING IS A CLAIM ABOUT THE CODE AND IS CHECKED AGAINST IT.
    # Without this the table would be the only witness to its own headline,
    # and a site could be talked into compliance by editing its ruling —
    # which is the shape this whole module exists to stop.
    liars = [r for r in rows
             if r["disposition"] == FULL and not r["sees_77"]]
    if liars:
        for r in liars:
            print(f"  [FAIL] {r['path']}:{r['line']} {r['func']} is RULED "
                  f"FULL and its scope never reaches `{SCHEMA_JUDGE}`. A "
                  f"disposition is not an argument.")
        bad += len(liars)
    else:
        print(f"  [ok  ] every FULL site's scope reaches `{SCHEMA_JUDGE}`")

    for key, want in sorted(PINNED.items()):
        got = c[key]
        ok = got == want
        bad += 0 if ok else 1
        print(f"  [{'ok  ' if ok else 'FAIL'}] {key:12s} committed {want}, "
              f"measured {got}")

    print()
    if bad:
        print(f"RESULT: DRIFT — {bad} check(s) moved. A new site, or a "
              f"repaired one.\n  If a site was REPAIRED, repin `PINNED` in "
              f"the same commit and say so\n  in `MISSING.md`. Do not widen "
              f"a door to make a count pass (doctrine 58).")
        return 3
    print("RESULT: PASS — every site is ruled and the census holds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
