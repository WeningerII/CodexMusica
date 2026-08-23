#!/usr/bin/env python3
"""Regressions for the shape classifier (quality/relation_shapes.py).

THE CLAIM UNDER TEST IS NOT "the counts are 25/52/12".  `--check` already
grades that, and a suite that re-asserted it would be the pin stated twice.
The claim here is that the classifier COULD HAVE SAID SOMETHING ELSE --
doctrine 94, which this repo learned by measuring a band that had passed every
positive case for eight months because nobody had written `five`/`of` and
looked at the answer.  A classifier that can only ever answer "pair-shaped" is
the same instrument as one that never looked, and every count it produces
would still be a number.

So each of the three conjuncts in `is_pair_shaped` is shown to be LOAD-BEARING
by a synthetic schema that violates exactly that one and must come back False,
and the gate is shown to go RED from both sides: from a moved PIN and from a
moved REGISTRY.  The second matters more -- a check that only compares its own
constants to each other is green on any tree.

Sections:
  1  the premise -- the classification is well posed over this registry
  2  the partition, and the bucket that CROSS-CUTS it
  3  the predicates fail in both directions (doctrine 94)
  4  the gate goes red: from a moved pin AND from a moved registry
  5  CANNOT TELL is reachable, and is not a moved figure (doctrine 20)
  6  doctrine 1 by AST -- no schema name is transcribed outside the pins
  7  the survey split adds up, and the index is ASKED rather than re-parsed
  8  the surfaces -- bare, --json, --check
  9  quality/pin_sweep.py reads this instrument correctly, mechanically
 10  the arity bucket's PREMISE: the coordinate it names is declared and
     read by nothing, and no schema declares a member rule for members 3+

Run: python3 quality/test_relation_shapes.py
"""

import ast
import collections
import dataclasses
import io
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from quality import relation_shapes as RS      # noqa: E402
from quality import relations as R             # noqa: E402

FAILURES = []
MODULE_PY = os.path.join(HERE, "relation_shapes.py")


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# --- synthetic schemas.  BUILT, never taken from the registry: the point of a
#     control is that it is a shape the file does not contain, so a predicate
#     cannot pass it by having memorised the registry.
def _schema(name="synthetic", loci=("line_final_token", "line_final_token"),
            placement=(("both_line_final", True),), **fig):
    f = R.Figure(**fig)
    return R.RelationSchema(
        name=name,
        spans=tuple(R.SpanRule(l) for l in loci),
        placement=tuple(R.Placement(k, polarity=p) for k, p in placement),
        figure=f)


def test_premise():
    print("\n1. the premise -- 'the two span loci' is a well-posed question "
          "over this registry")
    reg = R.all_schemas()
    check("the registry is non-empty", bool(reg), f"{len(reg)} schemas")
    bad = {n: len(s.spans) for n, s in reg.items() if len(s.spans) != 2}
    check("every schema declares EXACTLY two span rules -- the day one does "
          "not, span_loci() raises instead of reporting a shape nobody "
          "declared", not bad, str(bad))
    check("span_slots is 2 x schemas, derived rather than asserted",
          RS.census()["span_slots"] == 2 * len(reg),
          f"{RS.census()['span_slots']} over {len(reg)}")
    check("the declared vocabulary is still attested in the registry",
          RS.vocabulary_unattested() == (),
          str(RS.vocabulary_unattested()))
    # A schema with three span rules is REFUSED, not truncated.
    try:
        s3 = R.RelationSchema(name="three", spans=tuple(
            R.SpanRule("line_final_token") for _ in range(3)))
        RS.span_loci(s3)
        raised = False
    except ValueError:
        raised = True
    check("...and a three-span schema raises rather than being read as a pair",
          raised)


def test_partition():
    print("\n2. the partition, and the bucket that CROSS-CUTS it")
    b = RS.buckets()
    reg = R.all_schemas()
    both = set(b["pair_shaped"]) & set(b["not_pair_shaped"])
    check("pair-shaped and not-pair-shaped are disjoint", not both, str(both))
    check("...and together they are the whole registry",
          set(b["pair_shaped"]) | set(b["not_pair_shaped"]) == set(reg))
    check("...so the two counts sum to the registry and nothing else does",
          len(b["pair_shaped"]) + len(b["not_pair_shaped"]) == len(reg))

    over = set(b["pair_shaped"]) & set(b["arity_extension"])
    check("the arity bucket is NOT a third slice -- it overlaps pair-shaped, "
          "and the overlap is non-empty, so summing the three counts would "
          "double-count a real schema (doctrine 79)",
          bool(over), str(sorted(over)))
    check("...and the overlap is exactly what the pin names",
          over == set(RS.PINNED_EDGE["pair_and_arity"]), str(sorted(over)))

    e = RS.edge_cases()
    check("the figure-blind reading is STRICTLY larger than the pair count -- "
          "that difference is the hand count's overcount",
          RS.census()["span_shaped"] > RS.census()["pair_shaped"],
          f"span_shaped={RS.census()['span_shaped']} "
          f"pair_shaped={RS.census()['pair_shaped']}")
    check("...and every span-shaped-but-not-pair schema fails on FIGURE alone",
          all(RS.shapes()[n]["why_not_pair"] == ("FIGURE",)
              for n in e["span_not_pair"]),
          str({n: RS.shapes()[n]["why_not_pair"] for n in e["span_not_pair"]}))


def test_both_directions():
    print("\n3. the predicates fail in BOTH directions (doctrine 94)")

    # -- the positive control
    check("a canonical 2-node / both-ends / both_line_final schema IS "
          "pair-shaped", RS.is_pair_shaped(_schema()))

    # -- one conjunct removed at a time.  A classifier that dropped ANY of the
    #    three passes the positive control above and fails exactly one of these.
    figure_mut = _schema(nodes=4)
    locus_mut = _schema(loci=("line_final_token", "any_token"))
    place_mut = _schema(placement=())
    polarity_mut = _schema(placement=(("both_line_final", False),))
    for label, s, want_reason in (
            ("FIGURE   (4 nodes, spans and placement unchanged)",
             figure_mut, ("FIGURE",)),
            ("LOCUS    (one span looks at any_token)",
             locus_mut, ("LOCUS",)),
            ("PLACEMENT(no placement declared)",
             place_mut, ("PLACEMENT",)),
            ("PLACEMENT(both_line_final declared FORBIDDEN)",
             polarity_mut, ("PLACEMENT",))):
        check(f"...and is NOT pair-shaped once {label} moves",
              not RS.is_pair_shaped(s), label)
        check(f"     ...with the failing conjunct named {want_reason}",
              RS.not_pair_reason(s) == want_reason,
              str(RS.not_pair_reason(s)))

    check("the polarity reading is the LOAD-BEARING one: a forbidden "
          "both_line_final does not satisfy a required one",
          RS.requires_end_placement(_schema())
          and not RS.requires_end_placement(polarity_mut))

    # -- the arity predicate, both ways
    for q, nodes, want in (("exists", 2, False), ("exists_k", 2, False),
                           ("forall", 2, True), ("fraction", 2, True),
                           ("exists", 3, True), ("exists", 4, True),
                           ("exists", 1, True)):
        s = _schema(quantifier=q, nodes=nodes)
        check(f"needs_arity_extension({nodes} nodes / {q}) is {want}",
              RS.needs_arity_extension(s) is want)

    # -- THE GENEROSITY CONTROL.  Over the REAL registry each predicate must
    #    return both answers. A predicate that answered one way for all 77
    #    would satisfy every count in this file and have looked at nothing.
    sh = RS.shapes()
    for key in ("pair_shaped", "arity_extension", "span_shaped"):
        vals = {r[key] for r in sh.values()}
        check(f"over the real registry, `{key}` returns BOTH answers -- a "
              f"constant predicate is an instrument that never looked",
              vals == {True, False}, str(vals))
    reasons = collections.Counter(
        r["why_not_pair"] for r in sh.values() if not r["pair_shaped"])
    check("...and the not-pair-shaped schemas fail on more than one distinct "
          "combination of conjuncts, so no single conjunct is carrying the "
          "whole classification",
          len(reasons) > 1, str(dict(reasons)))


def _mutated_registry(name, **figure_kwargs):
    reg = dict(R.all_schemas())
    s = reg[name]
    reg[name] = dataclasses.replace(
        s, figure=dataclasses.replace(s.figure, **figure_kwargs))
    return reg


def test_gate_goes_red():
    print("\n4. the gate goes RED -- from a moved pin AND from a moved "
          "registry")
    buf = io.StringIO()
    check("--check on this tree is GREEN, so a red one means something",
          RS.check(out=buf) == 0, buf.getvalue().strip().splitlines()[-1:])

    # (a) THE REGISTRY MOVES.  This is the direction that matters: a check
    #     comparing only its own constants to each other is green on any tree.
    #     `perfect rhyme` promoted to a 4-node figure must move pair_shaped,
    #     not_pair_shaped, the pair membership and the figure profile at once.
    reg = _mutated_registry("perfect rhyme", nodes=4)
    buf = io.StringIO()
    codeb = RS.check(registry=reg, out=buf)
    txt = buf.getvalue()
    check("a schema whose FIGURE moves turns --check red", codeb == 1)
    check("...and the report names the moved figure and its measured value",
          "committed 25, measured 24" in txt,
          [l for l in txt.splitlines() if "pair_shaped" in l])
    check("...and names the schema that left the pair-shaped membership",
          "perfect rhyme" in txt,
          [l for l in txt.splitlines() if "membership" in l])
    check("...and says REPIN rather than 'adjust the predicate'",
          "REPIN BY HAND" in txt and "Do not tune a predicate" in txt)
    check("...and keeps doctrine 17's instruction in the same breath",
          "doctrine 17" in txt)

    # A quantifier move is invisible to the node count and must still be seen.
    reg = _mutated_registry("perfect rhyme", quantifier="forall")
    buf = io.StringIO()
    check("a schema whose QUANTIFIER moves turns --check red too -- the arity "
          "bucket and the figure profile both see it",
          RS.check(registry=reg, out=buf) == 1)
    check("...and the arity membership is named as having GROWN",
          "entered: ['perfect rhyme']" in buf.getvalue(),
          [l for l in buf.getvalue().splitlines() if "arity" in l])

    # A frame move changes NO count and NO membership. Only the figure profile
    # can see it, which is the reason that pin exists.
    reg = _mutated_registry("perfect rhyme", frame="stanza")
    buf = io.StringIO()
    codef = RS.check(registry=reg, out=buf)
    lines = [l for l in buf.getvalue().splitlines() if "[FAIL]" in l]
    check("a schema whose FRAME moves -- changing no count and no membership "
          "-- is still caught, by the figure profile alone",
          codef == 1 and len(lines) == 1 and "figure profile" in lines[0],
          str(lines))

    # (b) THE PIN MOVES, through the real CLI in a real subprocess, so the
    #     argv path and the exit code are both exercised.
    prog = ("import sys; sys.path.insert(0, %r);"
            "from quality import relation_shapes as RS;"
            "RS.PINNED['pair_shaped'] = 999;"
            "sys.exit(RS.main(['--check']))" % ROOT)
    p = subprocess.run([sys.executable, "-c", prog], cwd=ROOT,
                       capture_output=True, text=True)
    check("a moved SCALAR pin exits 1 through the CLI", p.returncode == 1,
          p.stdout.strip().splitlines()[-1:])
    check("...and prints `committed 999, measured 25`",
          "committed 999, measured 25" in p.stdout)

    prog = ("import sys; sys.path.insert(0, %r);"
            "from quality import relation_shapes as RS;"
            "RS.PINNED_ARITY = RS.PINNED_ARITY[:-1] + ('not a schema',);"
            "sys.exit(RS.main(['--check']))" % ROOT)
    p = subprocess.run([sys.executable, "-c", prog], cwd=ROOT,
                       capture_output=True, text=True)
    check("a SWAP inside a membership pin -- same count, different name -- "
          "exits 1, which is the whole reason the small buckets are pinned "
          "by name and not by count",
          p.returncode == 1, p.stdout.strip().splitlines()[-1:])
    check("...and both sides of the swap are named",
          "left: ['not a schema']" in p.stdout
          and "entered: ['平仄 tonal template']" in p.stdout,
          [l for l in p.stdout.splitlines() if "arity membership" in l])


def test_cannot_tell():
    print("\n5. CANNOT TELL is reachable, and is never a moved figure "
          "(doctrine 20)")

    def _raiser(_registry=None):
        raise RuntimeError("the population is not on this disk")

    buf = io.StringIO()
    code = RS.check(measure=_raiser, out=buf)
    check("a measurement that raises exits 2, not 1", code == 2)
    check("...and says so in the instrument's own words",
          "RESULT: CANNOT TELL" in buf.getvalue())
    check("...naming the cause rather than the pin",
          "the population is not on this disk" in buf.getvalue())

    # AN INERT DETECTOR IS NOT A MOVED FIGURE. Rename the locus under the
    # module and every predicate silently answers False; the pins would all
    # fail and blame the registry. `vocabulary_unattested` is what stops that.
    reg = {}
    for n, s in R.all_schemas().items():
        reg[n] = dataclasses.replace(
            s, spans=tuple(dataclasses.replace(r, locus="renamed_locus")
                           if r.locus == RS.END_LOCUS else r
                           for r in s.spans))
    check("with the locus renamed under it, the classifier WOULD have "
          "reported nothing pair-shaped",
          len(RS.buckets(reg)["pair_shaped"]) == 0)
    buf = io.StringIO()
    code = RS.check(registry=reg, out=buf)
    check("...but --check answers CANNOT TELL (2) instead of blaming the "
          "registry for 25 moved figures",
          code == 2, buf.getvalue().strip().splitlines()[-1:])
    check("...and names the drifted spelling",
          RS.END_LOCUS in buf.getvalue() and "inert" in buf.getvalue())


def test_doctrine_1_by_ast():
    print("\n6. doctrine 1 by AST -- no schema name is transcribed outside "
          "the pins")
    src = io.open(MODULE_PY, encoding="utf-8").read()
    tree = ast.parse(src)
    names = set(R.all_schemas())

    allowed = set()
    for node in tree.body:
        targets = []
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target,
                                                            ast.Name):
            targets = [node.target.id]
        if any(t.startswith("PINNED") for t in targets):
            for sub in ast.walk(node):
                if isinstance(sub, ast.Constant) and isinstance(sub.value, str):
                    allowed.add(id(sub))

    stray = [n.value for n in ast.walk(tree)
             if isinstance(n, ast.Constant) and isinstance(n.value, str)
             and n.value in names and id(n) not in allowed]
    check("every registry name spelled in relation_shapes.py lives inside a "
          "PINNED* table -- the derivation transcribes none of them",
          not stray, str(sorted(set(stray))))
    check("...and the guard is not vacuous: the pins DO spell schema names, "
          "so the scanner had something to find",
          len(allowed) > 30, f"{len(allowed)} string constants in PINNED*")

    # The survey side: this module must not grow its own TSV reader.
    opens = [n for n in ast.walk(tree)
             if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
             and n.func.id == "open"]
    check("...and it opens no file of its own -- canon_sources owns the "
          "survey reader (doctrine 1)", not opens, f"{len(opens)} open() calls")


def test_survey():
    print("\n7. the survey split adds up")
    cov = RS.survey_coverage()
    from quality import canon_sources as CS
    check("the index is loaded, so the split is a measurement", cov["loaded"])
    check("covered + uncited == the index's own row count",
          cov["covered"] + cov["uncited"] == cov["rows"],
          f"{cov['covered']} + {cov['uncited']} vs {cov['rows']}")
    check("the row count is ASKED of canon_sources, not counted here",
          cov["rows"] == len(CS.index()))
    check("no schema cites an index the survey does not contain",
          cov["cited_off_index"] == (), str(cov["cited_off_index"]))
    check("the per-cell uncited counts sum to the uncited total",
          sum(n for _, n in cov["uncited_by_cell"]) == cov["uncited"])
    check("...and the per-cell covered counts sum to the covered total",
          sum(n for _, n in cov["covered_by_cell"]) == cov["covered"])
    check("every cell is present on one side or the other",
          {k for k, _ in cov["uncited_by_cell"]}
          | {k for k, _ in cov["covered_by_cell"]} == set(CS.CELL_SIZE))
    for cell, size in sorted(CS.CELL_SIZE.items()):
        got = (dict(cov["uncited_by_cell"]).get(cell, 0)
               + dict(cov["covered_by_cell"]).get(cell, 0))
        check(f"...and cell {cell} splits its own declared {size} rows",
              got == size, f"measured {got}")

    # A per-schema count is a SET size, not a sum of tuple lengths: two
    # traditions of one schema may cite the same index.
    sh = RS.shapes()
    naive = {n: sum(len(t.cites) for t in R.all_schemas()[n].traditions)
             for n in sh}
    check("per-schema cite counts deduplicate across traditions -- the naive "
          "sum is larger somewhere, so the distinction is real",
          any(naive[n] > sh[n]["n_cites"] for n in sh),
          str({n: (naive[n], sh[n]["n_cites"]) for n in sh
               if naive[n] > sh[n]["n_cites"]}))


def test_surfaces():
    print("\n8. the surfaces -- bare, --json, --check")
    p = subprocess.run([sys.executable, "quality/relation_shapes.py"],
                       cwd=ROOT, capture_output=True, text=True)
    check("a bare run exits 0", p.returncode == 0, p.stderr[-300:])
    c = RS.census()
    for want in ("pair-shaped", "not pair-shaped", "needs an arity extension",
                 "SPAN LOCI", "SURVEY COVERAGE"):
        check(f"...and prints the {want!r} section", want in p.stdout)
    check("...and no format placeholder survives into the output",
          "%3d" not in p.stdout and "%s" not in p.stdout)
    check("...and every arity-bucket member is printed WITH its figure",
          all(n in p.stdout for n in RS.buckets()["arity_extension"]))

    p = subprocess.run([sys.executable, "quality/relation_shapes.py", "--json"],
                       cwd=ROOT, capture_output=True, text=True)
    check("--json exits 0 and parses", p.returncode == 0
          and isinstance(json.loads(p.stdout), dict), p.stderr[-300:])
    doc = json.loads(p.stdout)
    check("...and its buckets agree with the in-process ones",
          doc["buckets"]["arity_extension"]
          == list(RS.buckets()["arity_extension"]))
    check("...and it carries the per-schema cite counts a consumer asked for",
          all("n_cites" in r for r in doc["shapes"].values()))

    p = subprocess.run([sys.executable, "quality/relation_shapes.py",
                        "--check"], cwd=ROOT, capture_output=True, text=True)
    check("--check exits 0 on this tree", p.returncode == 0,
          p.stdout.strip().splitlines()[-1:])
    check("...and it grades more than the three headline counts",
          p.stdout.count("[ok  ]") >= 20, f"{p.stdout.count('[ok  ]')} rows")


def test_pin_sweep_reads_it():
    print("\n9. quality/pin_sweep.py reads this instrument correctly, "
          "mechanically")
    from quality import pin_sweep as PS
    found = PS.discover(ROOT)
    check("the sweep DISCOVERS this instrument -- it spells `--check` and is "
          "not excluded", "quality/relation_shapes.py" in found)
    check("...and does not sweep its test file",
          "quality/test_relation_shapes.py" not in found)

    buf = io.StringIO()
    RS.check(out=buf)
    green = buf.getvalue()
    check("a PASSING run says nothing the sweep reads as 'cannot answer' -- "
          "otherwise a genuinely moved figure would be filed as inconclusive",
          not PS._SAYS_REFUSED.search(green))

    def _raiser(_registry=None):
        raise RuntimeError("nope")
    buf = io.StringIO()
    RS.check(measure=_raiser, out=buf)
    check("...while the CANNOT TELL run DOES match it, so exit 2 is filed as "
          "CANNOT RUN without a row in the sweep's EXIT_MEANING table",
          bool(PS._SAYS_REFUSED.search(buf.getvalue())))

    reg = _mutated_registry("perfect rhyme", nodes=4)
    buf = io.StringIO()
    RS.check(registry=reg, out=buf)
    check("...and a MOVED run gives the sweep real evidence to print, rather "
          "than a verdict with no reason",
          bool(PS._EVIDENCE.search(buf.getvalue())),
          [l for l in buf.getvalue().splitlines()
           if PS._EVIDENCE.search(l)][:2])
    check("...and the sweep's conservative default reads this module's exit 1 "
          "as MOVED", PS.verdict_for("quality/relation_shapes.py", 1) == "MOVED")


def test_the_arity_premise():
    print("\n10. the arity bucket's premise -- the coordinate is declared and "
          "unread, and members 3+ have no rule")
    # (a) `Figure.nodes`/`edges`/`template` are read by NOTHING but this
    #     classifier. That is what "needs a mandate object that does not exist
    #     yet" MEANS, made mechanical: if this check goes red because a
    #     production module started reading the coordinate, the extension has
    #     landed and this assertion is the thing to update -- not the docstring
    #     that claims it, which would otherwise go stale in silence
    #     (doctrine 48).
    import re
    pat = re.compile(r"\b(?:figure|fig)\.(?:nodes|edges|template)\b")
    readers = []
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs
                   if d not in (".git", "__pycache__", "node_modules")]
        for fn in sorted(files):
            if not fn.endswith(".py"):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            try:
                src = io.open(full, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            if pat.search(src):
                readers.append(rel)
    mine = {"quality/relation_shapes.py", "quality/test_relation_shapes.py"}
    others = sorted(set(readers) - mine)
    check("Figure.nodes/edges/template are read by NO production module but "
          "this classifier -- the arity coordinate is declared and unwired, "
          "which is the whole of 'needs a mandate object that does not exist'",
          not others, str(others))
    check("...and the scanner is not vacuous: it finds this module",
          "quality/relation_shapes.py" in readers, str(sorted(readers)))

    # (b) A 4-node figure still declares exactly TWO span rules, so members 3
    #     and 4 have no member rule of their own. The producer takes two spans;
    #     the figure says four members. That gap IS the extension.
    reg = R.all_schemas()
    big = {n: s.figure.nodes for n, s in reg.items() if s.figure.nodes > 2}
    check("the registry really does declare figures with more than two "
          "members", bool(big), str(big))
    check("...and every one of them still declares exactly two span rules, so "
          "its members beyond the second have no rule to find them by",
          all(len(reg[n].spans) == 2 for n in big),
          str({n: len(reg[n].spans) for n in big}))
    check("...and the producer's own entry point takes exactly two spans",
          "def evaluate(schema, a, b, stream" in io.open(
              os.path.join(HERE, "relations.py"), encoding="utf-8").read())


# ---------------------------------------------------------------------------
# 11. THE QUANTIFIER VOCABULARY IS ONE TABLE  (`MISSING.md` M-38)
# ---------------------------------------------------------------------------

def test_quantifier_vocabulary_is_one_table():
    """Two modules declared this coordinate and neither knew about the other.
    The table now lives in `rhyme_constraints` (the lower module — nothing
    there imports `relations`), both read it, and the divergent `exists_k`
    is bounded to the range where the proxy is exact rather than guessed at.
    """
    import sys as _s, os as _o
    _s.path.insert(0, _o.path.join(_o.path.dirname(_o.path.abspath(__file__)),
                                   ".."))
    from quality import relations as R
    from quality import rhyme_constraints as C

    print("\n11. the quantifier vocabulary is ONE table (M-38)")
    check("`k` COUNTS is declared, once, and it is members",
          C.K_COUNTS == "members", C.K_COUNTS)
    check("four canonical names",
          sorted(C.QUANTIFIERS) == ["exists", "exists_k", "forall",
                                    "fraction"], sorted(C.QUANTIFIERS))
    check("both modules' historical spellings are ALIASES onto them, kept "
          "rather than renamed (doctrine 17)",
          C.canonical_quantifier("pair") == "exists"
          and C.canonical_quantifier("count_fraction") == "fraction"
          and C.canonical_quantifier("exists") == "exists")
    check("EVERY one of the 77 figures resolves through that one table",
          all(s.figure.canonical_quantifier() in C.QUANTIFIERS
              for s in R.REGISTRY.values()))
    # THE GATE FAILS IN BOTH DIRECTIONS.
    for bad in ("nonsense", "PAIR", ""):
        try:
            R.Figure(quantifier=bad)
            check("Figure refuses %r" % bad, False, "it constructed")
        except C.QuantifierRefused:
            check("a Figure declaring %r REFUSES AT CONSTRUCTION, so a typo "
                  "in one of 77 schemas cannot fall through assemble()'s "
                  "if/elif to a silent no-op (defect P15's shape)" % bad, True)
    check("...and a good one still constructs",
          R.Figure(quantifier="forall").canonical_quantifier() == "forall")
    # THE BOUND ON THE PROXY.
    check("the proxy is declared exact only at k=2",
          C.EXISTS_K_PROVEN_AT == (2,), C.EXISTS_K_PROVEN_AT)
    check("Selection(exists_k, k=2) constructs — the only value in use",
          C.Selection("exists_k", k=2).canonical() == "exists_k")
    for k in (1, 3, 5):
        try:
            C.Selection("exists_k", k=k)
            check("Selection refuses exists_k k=%d" % k, False, "it built")
        except C.QuantifierRefused as e:
            check("Selection REFUSES exists_k k=%d rather than picking a "
                  "reading: its `>= k-1` figure count is a proxy for the "
                  "declared member semantics, exact only at 2, and which "
                  "module is right above 2 is CANNOT TELL from the source"
                  % k, "CANNOT TELL" in str(e))
    check("relations' own exists_k carries NO such bound, because it is not "
          "a proxy — it counts distinct members and tests >= k exactly",
          R.Figure(quantifier="exists_k", k=7).k == 7)


if __name__ == "__main__":
    for fn in (test_premise, test_partition, test_both_directions,
               test_gate_goes_red, test_cannot_tell, test_doctrine_1_by_ast,
               test_survey, test_surfaces, test_pin_sweep_reads_it,
               test_the_arity_premise,
               test_quantifier_vocabulary_is_one_table):
        fn()
    print("=" * 68)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the classification is an instrument: it answers, it can be wrong, "
          "and it says which figure moved")
