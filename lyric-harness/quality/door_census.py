#!/usr/bin/env python3
"""WHICH DOOR DOES EACH SITE JUDGE A PAIR AT — the census, not the claim.

THE OWNER'S RULING THAT MADE THIS NECESSARY, 2026-08-26, verbatim: *"go find
everywhere it still has the incorrect 4 and make sure all 77 are there ... 4 is
poisonous as fuck. without all 77 we're going to be racking up the wrong
numbers and then we have to come back and do all of this all over again."*

THE DEFAULT DOOR, SINCE 2026-09-22 (the N-relation model). A pair stands in
EVERY relation its sound supports, never one, and the default judges every
pair against ALL of them: each coarse relation in `decl.admit` at its own cut
(`admits_decl` / `admitted_relations`) AND every registry schema
(`relations.whole_vocabulary_pairs`). Neither half is a rescue for the other;
both are asked of every pair. The door's history — the historical two
(RHYME, RIME_RICHE), M-59's widening to four, M-116's 77 schemas as a rescue
for failed pairs — is in `MISSING.md`; none of those doors exists now.

WHAT THIS COUNTS AS A SITE. Any place that decides whether a scored pair
stands in a relation, found on the AST and never by reading:

  * a call to `admits`, `admitted_relations` or `admits_decl`, by either
    spelling (`admits(...)` and `LH.admits(...)` — the first draft saw only
    the first and missed `quality/redteam_band.py` entirely);
  * a RHYME-family membership test: `x in RHYME_RELATIONS`,
    `rels & RHYME_RELATIONS`, or the historical literal pair;
  * an EQUALITY test against a relation NAME (`== "RHYME"`). A pair has a SET
    of relations, so equality picks one label out of it: the defect the
    N-relation model removes, flagged wherever it appears.

HOW A SITE "REACHES THE SCHEMAS". The judge is named in the site's own
function, an ENCLOSING one, or a HELPER THE SITE CALLS, resolved EXACTLY ONE
HOP (`quality/test_door_census.py` §3b pins all three edges of that).

DISPOSITIONS. Not every site is judging a mandate.

  FULL         judges a pair against its coarse relation set AND consults
               every schema. The complete default.
  INCOMPLETE   judges MANDATE SATISFACTION short of it, or picks one label.
               The defect class.
  PER_WORD     holds a WORD or a within-line span, not a line pair, so the
               schemas (which judge line pairs over a stream) cannot be asked.
  RENDERING    names or counts a relation and gates nothing.
  VALIDATION   validates a DECLARED set at declaration time.
  DEFINITION   the predicate's own body.
  FORM         a form or instrument whose own definition names ONE relation
               family (a sain's rhyme, a RHYME-event layer): membership of
               that family in the pair's set is its question.
  ARGUED       deliberately narrower, with the measured argument at the site.

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
#: rather than spelling. A literal spelling of the RHYME family; `admits()`
#: with `relations=` omitted means EVERY admittable relation since 2026-09-22.
NARROW_LITERAL = frozenset({"RHYME", "RIME_RICHE"})

#: Every coarse relation name a scored pair's SET can hold, plus the two
#: empty-set spellings. An EQUALITY test against one of these picks one label
#: out of a set — the defect the N-relation model removes.
RELATION_NAMES = frozenset({"RHYME", "RIME_RICHE", "PROMOTED_RHYME",
                            "ASSONANCE", "CONSONANCE", "REPEAT",
                            "NO_RELATION", "NO_ANCHOR"})

#: The one judge of the registry schemas. A site "consults the schemas" when
#: this name appears anywhere in its enclosing function — matched
#: on the NAME and not on an import path, because both consumers reach it
#: through a local alias (`_RF.whole_vocabulary_pairs`, `_WVP`).
SCHEMA_JUDGE = "whole_vocabulary_pairs"

#: WHERE THE DOOR LIVES. `admits()` is defined in `lyric_harness.py`, so a
#: BARE `admits(...)` there is the door itself. Anywhere else, a file that
#: defines its own `admits` is defining something unrelated — `quality/
#: narrative.py` has `def admits(functions)` about section rosters — and this
#: detector matches a bare name with no import resolution, so it would count a
#: call to that as a pair-satisfaction site. Declared rather than inferred
#: (doctrine 1), because the first draft of this guard suppressed the door in
#: its OWN HOME MODULE and took the census from 19 sites to 15.
DOOR_HOME = "lyric_harness.py"

#: Directories that are not production Python.
SKIP_DIRS = {".git", "corpus", "data", "node_modules", "graphify-out",
             "__pycache__", "examples", "songs", "mcp"}

FULL = "FULL"
INCOMPLETE = "INCOMPLETE"
PER_WORD = "PER_WORD"
RENDERING = "RENDERING"
VALIDATION = "VALIDATION"
ARGUED = "ARGUED"
DEFINITION = "DEFINITION"
FORM = "FORM"

#: ONE RULING PER SITE, keyed on (relative path, qualified function name) and
#: NEVER on a line number — `MISSING.md`'s Welsh entry records what a line
#: citation into a moving file is worth, and this table would go stale on the
#: next edit above any of these functions.
#:
#: Every ruling states the QUESTION the site asks, because the disposition
#: follows from the question and not from the door it happens to spell.
RULINGS = {
    # ------------------------------------------------------------ DEFINITION
    ("lyric_harness.py", "admits"): (
        DEFINITION,
        "The predicate itself: `bool(admitted_relations(...))`."),
    ("lyric_harness.py", "admits_decl"): (
        DEFINITION,
        "The predicate at a Declaration's own admit set and per-relation "
        "cuts."),

    # ---------------------------------------------------------------- FULL
    ("lyric_harness.py", "check_scheme"): (
        FULL,
        "Every mandated pair is judged against its coarse relation set at "
        "`decl.admit` AND every registry schema (`whole_vocabulary_pairs` "
        "over every mandated pair, always)."),
    ("lyric_harness.py", "check_scheme.ok"): (
        FULL,
        "The transitivity counter reads the same verdict as the chain above "
        "it — `admits_decl` or a schema the pair stands in (M-139)."),
    ("quality/revise.py", "Reviser.grade"): (
        FULL,
        "The grader: every verdict pair against its coarse relation set and "
        "`whole_vocabulary_pairs`, the SAME call `check_scheme` makes."),
    ("quality/revise.py", "Reviser.group_merges"): (
        FULL,
        "Would every cross pair satisfy the mandate: `admits_decl` or a "
        "schema, the latter through `_schema_satisfies` (one hop, M-139)."),
    ("quality/chance_rate.py", "measure"): (
        FULL,
        "The chance-rate instrument: every drawn pair is counted in every "
        "coarse relation it holds at `decl.admit` and every schema "
        "`whole_vocabulary_pairs` finds; ANY is the default door and the "
        "RHYME family is one count inside it, never a second door."),
    ("quality/chance_rate.py", "_answered"): (
        FULL,
        "The separation arm: a sonnet pair is answered when it stands in an "
        "admitted coarse relation OR any schema, both asked of every pair."),

    # ------------------------------------------------------------ PER_WORD
    ("lyric_harness.py", "CandidateEngine.candidates"): (
        PER_WORD,
        "Holds ONE query word against candidate words and lists EVERY coarse "
        "relation each stands in at its cut; registry schemas judge LINE "
        "pairs over a built stream and are not askable here (M-139)."),
    ("lyric_harness.py", "internal_matches"): (
        PER_WORD,
        "Span pairs INSIDE a line (internal rhyme): each match carries every "
        "coarse relation it stands in. The schemas judge whole line pairs, "
        "and `internal rhyme` is itself one of them (M-139)."),
    ("lyric_harness.py", "end_pair_relations"): (
        PER_WORD,
        "The `screen` verb's coarse column for two words in fixed carriers; "
        "the schemas are asked at the same two end tokens by `screen_pairs` "
        "(M-189)."),
    ("quality/features.py", "RhymeField.field"): (
        PER_WORD,
        "A candidate FIELD for one call word over the corpus lexicon: words "
        "standing in an admitted coarse relation at its cut. One word, so "
        "no line-pair schema is askable (M-139)."),
    ("quality/revise.py", "Reviser.joint_field_screened"): (
        PER_WORD,
        "The offered field screened from the offered word's own side "
        "(M-185): one word against each call word."),
    ("quality/revise.py", "Reviser._field_split"): (
        PER_WORD,
        "Splits one call word's candidate field into words standing in an "
        "admitted coarse relation (`admits_decl`) and words left for the "
        "end-pair schema pass; one word against each candidate (M-185)."),
    ("quality/revise.py", "Reviser._offer_reopens"): (
        PER_WORD,
        "The conservative outranker count behind M-185's screen: does an "
        "offered word reopen a modal head from the other side, at the "
        "declared coarse set — one word each, a COUNT bounding a scan."),
    ("quality/revise.py", "Reviser._offerable"): (
        PER_WORD,
        "The field's own predicate on a word pair: an admitted coarse "
        "relation, or a schema at the two line ends (`_end_pair_schemas`) "
        "when the admit set is the default (M-185)."),

    # ----------------------------------------------------------- RENDERING
    ("lyric_harness.py", "near_relation_default_disclosure"): (
        RENDERING,
        "Names the satisfied pairs whose coarse set holds a near relation "
        "and no rhyme, for the report line; decides nothing (M-138)."),
    ("quality/revise.py", "Reviser._collision_code"): (
        RENDERING,
        "Names an unintended pair COLLISION or NEAR_COLLISION from its "
        "relation set; the collision cut itself is scalar."),

    # ---------------------------------------------------------- VALIDATION
    ("lyric_harness.py", "Declaration.__post_init__"): (
        VALIDATION,
        "Refuses a declared `admit` naming no rhyme relation at all."),

    # ---------------------------------------------------------------- FORM
    ("lyric_harness.py", "check_cynghanedd"): (
        FORM,
        "Cynghanedd sain and llusg are DEFINED by rhyme between named "
        "parts, so the form's own question is membership of the RHYME "
        "family, asked of the pair's relation set (M-136)."),
    ("quality/structure_census.py", "d1_diagnostic"): (
        FORM,
        "Tabulates the masculine-rhyme judge against whether RHYME is IN the "
        "engine's relation set: the judge names rhyme, so the comparison is "
        "that membership (M-138)."),
    ("quality/time_layer.py", "_raw_score"): (
        FORM,
        "The time layer places RHYME events: a candidate is a span pair "
        "whose relation set holds a RHYME-family relation (M-139)."),
    ("quality/redteam_band.py", "run"): (
        FORM,
        "Adversary 3 scores the comparator's RHYME membership against a "
        "strict-identity reference SET, per relation (M-138)."),

    # -------------------------------------------------------------- ARGUED
    ("lyric_harness.py", "rhyme_graph"): (
        ARGUED,
        "The pairwise GRAPH (`chains`, `graph`): a GENERATOR over every line "
        "pair, asking every admittable coarse relation plus REPEAT. The "
        "schemas are not folded in because, over every pair, the default "
        "door does not separate from its matched redeal: all 91 pairs R_obs 50.27% against a null median 52.36% and max 54.21%, p 0.8571 at 20 draws "
        "(`chance_rate.py --null`), while on DECLARED pairs it does: "
        "the 7 mandated pairs R_obs 91.07% against a null median 52.38% and max 54.76%, +38.69 pp over the median. A generator asking a question answered at chance "
        "manufactures structure (doctrine 71; M-139, M-145)."),
    ("lyric_harness.py", "infer_chains.match"): (
        ARGUED,
        "Chain promotion at `theta_chain` over every admittable coarse "
        "relation plus REPEAT — a generator like `rhyme_graph`, for the same "
        "measured reason (all 91 pairs R_obs 50.27% against a null median 52.36% and max 54.21%, p 0.8571 at 20 draws; M-139)."),
    ("quality/revise.py", "Reviser.mandate_from_graph"): (
        ARGUED,
        "`--cliques` means the rhyme graph: a GENERATOR cover over every "
        "pair, handed to `grade()`, which asks every schema of each pair it "
        "then declares. Folding schemas into the generator would build "
        "covers from a door at chance over undeclared pairs (all 91 pairs R_obs 50.27% against a null median 52.36% and max 54.21%, p 0.8571 at 20 draws; "
        "M-145)."),
    ("quality/recover.py", "recover"): (
        ARGUED,
        "The pasted-song door (M-72): a GENERATOR over every line pair of a "
        "text, same argument and measurement as `mandate_from_graph` "
        "(all 91 pairs R_obs 50.27% against a null median 52.36% and max 54.21%, p 0.8571 at 20 draws; M-145)."),
    ("quality/rhyme_types.py", "coarse_relation_consensus"): (
        ARGUED,
        "The all-pronunciation sub-question for the COARSE relations: every "
        "permitted endpoint reading tested for membership of the declared "
        "coarse set; a disagreement returns unknown. check_scheme and "
        "Reviser.grade ask the schemas beside it for every pair. MEASURED "
        "by test_production_relations: 4 controls, cat/hat=True, "
        "wind/moon=False, wind/find and an unreadable endpoint=unknown "
        "(M-139)."),
    ("quality/e5_coda_adoption.py", "admitted"): (
        ARGUED,
        "E-5 changes the coda SCALAR, so it counts the coarse admitted set "
        "that scalar moves; check_scheme's violations over every relation "
        "are reported beside it in the same run. MEASURED 2026-09-22 by `e5_coda_adoption.py`: 900 mandated pairs admitted under gift and 900 under cannot_tell, 0 lost; violations 9 -> 9 (E-5)."),
    ("quality/negative_control.py", "Quatrain.__init__"): (
        ARGUED,
        "The negative control of the COMPARATOR reads the coarse relation "
        "set at the declaration's cuts plus REPEAT. The schemas have their "
        "own matched-redeal null: a schema holds on 896..921 random "
        "pairs of 4,000 (`chance_rate.ADOPTED['schema']`), which would "
        "saturate a four-line partition (doctrine 14; M-138)."),

}

#: The two RENDERING sites inside `check_scheme` cannot be keyed by function
#: alone — the function is FULL and also carries a naming test. Keyed on the
#: door kind as well, because one function legitimately holds both.
_BY_DOOR = {
    ("lyric_harness.py", "check_scheme", "RHYME(member)"): (
        RENDERING,
        "Chooses the WORDING of an unintended-pair note from the pair's "
        "relation set; the verdict is settled above it."),
}

#: MEASURED 2026-08-26 on this tree, REPINNED 2026-08-27, and the INCOMPLETE
#: count is a DEFECT count rather than a target — it is pinned so it cannot
#: grow quietly, and the repairs that lower it repin it downward in the
#: same commit.
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
#: ~~`MISSING.md` M-139 and each needs its own measurement before it
#: moves.~~
#:
#: **`incomplete` IS 0 SINCE 2026-08-27 AND IT GOT THERE BY RULING, NOT BY
#: REPAIR (`MISSING.md` M-145) — SO READ IT AS A DIFFERENT STATEMENT.** The
#: two INCOMPLETE sites were each holding open a QUESTION rather than a
#: defect (does `--cliques` mean the rhyme graph; may a RECOVERED cover
#: bind at a placement a PLANNER may not volunteer), both are ruled, and
#: NEITHER DOOR MOVED A BYTE. A 0 here therefore means "no site is waiting
#: on a ruling", and it does NOT mean every site reaches the complete
#: default: 12 of 21 are ARGUED, and that is the count carrying this
#: tree's deliberate narrowness now. The guard that used to read
#: `incomplete > 0` is REPOINTED rather than deleted —
#: `test_door_census.py` §4 now requires every ARGUED reason to carry a
#: MEASUREMENT and a register citation, because ARGUED is the disposition
#: a site could otherwise be TALKED into.
#: REPINNED 2026-09-01 from ~~21 / per_word 1 / rendering 3~~: five sites
#: joined — M-185's screened field and its outranker count (PER_WORD, two
#: sites) and M-189's `screen` verb (RENDERING, three sites under `main`).
#: No door moved; `full` and `incomplete` are unchanged, which is the
#: control that the delegation sitting widened nothing (`MISSING.md`
#: M-185, M-189).
# 2026-09-08: pronunciation-consensus helper adds one deliberately scalar
# site; check_scheme's all-readings-false branch adds one existing FULL site.
# E-5, 2026-09-15: one argued measurement site; production doors unchanged.
# REPINNED 2026-09-22 (N-relation model) from ~~sites 29, full 5, incomplete
# 0, per_word 3, rendering 6, validation 1, argued 14~~. The detector now
# reads `admits_decl`/`admitted_relations`, RHYME-family intersections and
# single-label EQUALITY, and two dispositions joined (DEFINITION, FORM). The
# single-label site in cym_rhyme_rate.py was repaired by the lead the same day
# (membership now), so incomplete is 0. `Reviser._field_one` stopped
# calling the predicate directly (slice B, same day): per_word 9 -> 8.
# Measured by `python3 quality/door_census.py --check`.
PINNED = {"sites": 35, "full": 7, "incomplete": 0, "per_word": 8,
          "rendering": 3, "validation": 1, "definition": 2, "form": 6,
          "argued": 8}


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


def _callees(tree, enc):
    """-> {qualified function name: {names it calls}}.

    ONE HOP, and the bound is the point. A site can reach the judge through a
    HELPER rather than in its own body — `Reviser.group_merges` asks the 77
    through `Reviser._schema_satisfies`, which is the right shape (the stream
    is memoised across candidate merges) and which a scope-chain detector
    cannot see. Following the call graph to unlimited depth would credit half
    the module through any path, so exactly one hop is resolved and the
    module docstring says so.
    """
    out = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        f = node.func
        name = (f.id if isinstance(f, ast.Name)
                else f.attr if isinstance(f, ast.Attribute) else None)
        if name:
            out.setdefault(enc.get(node, "<module>"), set()).add(name)
    return out


def _reaches_judge(func, sees, calls=None, bare=None):
    """Does this site's scope reach the 77 judge — its own, an ENCLOSING
    one's, or a HELPER it calls (one hop)?

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
    if any(".".join(parts[:i]) in sees for i in range(len(parts), 0, -1)):
        return True
    # ONE HOP. `bare` maps a plain function name to every qualified name
    # ending in it, so `self._schema_satisfies` resolves to
    # `Reviser._schema_satisfies` without this file modelling attribute
    # binding.
    for name in (calls or {}).get(func, ()):
        for qual in (bare or {}).get(name, ()):
            if qual in sees:
                return True
    return False


def _is_narrow_literal(node):
    if isinstance(node, (ast.Tuple, ast.Set, ast.List)):
        vals = {e.value for e in node.elts
                if isinstance(e, ast.Constant) and isinstance(e.value, str)}
        return vals == NARROW_LITERAL
    return False


def _name_of(node):
    return (node.id if isinstance(node, ast.Name)
            else node.attr if isinstance(node, ast.Attribute) else None)


def _door_of(node, shadowed=False):
    """-> the door this node reads, or None if it is not a site.

    `shadowed` is True when the FILE defines its own `admits`, in which case a
    bare `admits(...)` in it is NOT this tree's door (`quality/narrative.py`
    defines `def admits(functions)` about section rosters).

    KINDS:
      DECLARED(admit)   `admits`/`admitted_relations` given a relation set,
                        or `admits_decl` — the declaration's coarse set.
      ALL(omitted)      `admits`/`admitted_relations` with no relation set:
                        every admittable coarse relation (since 2026-09-22;
                        it meant the historical two before).
      RHYME(member)     membership of the RHYME family — `x in
                        RHYME_RELATIONS`, `rels & RHYME_RELATIONS`, or the
                        historical literal pair. A question about ONE
                        relation family, asked of a set.
      SINGLE_LABEL(==)  equality against a relation NAME. Under the
                        N-relation model a pair has a SET of relations, so an
                        equality test is picking one label: a defect unless
                        ruled otherwise.
    """
    if isinstance(node, ast.Call):
        f = node.func
        name = _name_of(f)
        if name == "admits_decl":
            return "DECLARED(admit)"
        if name in ("admits", "admitted_relations") and not (
                shadowed and isinstance(f, ast.Name)):
            given = (any(k.arg == "relations" for k in node.keywords)
                     or len(node.args) >= 3)
            return "DECLARED(admit)" if given else "ALL(omitted)"
        return None
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitAnd):
        if "RHYME_RELATIONS" in (_name_of(node.left), _name_of(node.right)):
            return "RHYME(member)"
        return None
    if isinstance(node, ast.Compare):
        if any(isinstance(o, (ast.In, ast.NotIn)) for o in node.ops):
            for c in node.comparators:
                # attribute form too (`LH.RHYME_RELATIONS`)
                if _name_of(c) == "RHYME_RELATIONS" or _is_narrow_literal(c):
                    return "RHYME(member)"
        if any(isinstance(o, (ast.Eq, ast.NotEq)) for o in node.ops):
            for v in [node.left] + node.comparators:
                if isinstance(v, ast.Constant) and v.value in RELATION_NAMES:
                    return "SINGLE_LABEL(==)"
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
        calls = _callees(tree, enc)
        bare = {}
        for qual in set(enc.values()):
            bare.setdefault(qual.split(".")[-1], set()).add(qual)
        shadowed = (rel != DOOR_HOME and any(
            isinstance(d, (ast.FunctionDef, ast.AsyncFunctionDef))
            and d.name == "admits" for d in ast.walk(tree)))
        for n in ast.walk(tree):
            door = _door_of(n, shadowed)
            if not door:
                continue
            func = enc.get(n, "<module>")
            key3 = (rel, func, door)
            key2 = (rel, func)
            ruled = _BY_DOOR.get(key3) or RULINGS.get(key2)
            rows.append({
                "path": rel, "line": n.lineno, "func": func, "door": door,
                "sees_77": _reaches_judge(func, sees, calls, bare),
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


DISPOSITION_KEYS = ((FULL, "full"), (INCOMPLETE, "incomplete"),
                    (PER_WORD, "per_word"), (RENDERING, "rendering"),
                    (VALIDATION, "validation"), (DEFINITION, "definition"),
                    (FORM, "form"), (ARGUED, "argued"))


def counts(rows=None):
    rows = census() if rows is None else rows
    out = {"sites": len(rows)}
    for d, key in DISPOSITION_KEYS:
        out[key] = sum(1 for r in rows if r["disposition"] == d)
    return out


def main(argv):
    check = "--check" in argv
    rows = census()
    c = counts(rows)

    print("WHICH RELATIONS EACH SITE JUDGES A PAIR AGAINST")
    print(f"  the complete default: the pair's coarse relation set at "
          f"`decl.admit` AND `{SCHEMA_JUDGE}`, for every pair\n")
    print(f"  {'file':30s}{'line':>6s}  {'door':24s}{'sch':>4s}  "
          f"{'disposition':12s} function")
    for r in rows:
        print(f"  {r['path']:30s}{r['line']:6d}  {r['door']:24s}"
              f"{'YES' if r['sees_77'] else 'no':>4s}  "
              f"{str(r['disposition'] or 'UNRULED'):12s} {r['func']}")

    print(f"\n  DISPOSITIONS, NEVER SUMMED PAST THE PARTITION "
          f"(doctrine 79):")
    for _, key in DISPOSITION_KEYS:
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
