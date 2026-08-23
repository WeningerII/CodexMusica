#!/usr/bin/env python3
"""WHICH OF THE 77 DECLARED RELATIONS FIT A WORD-PAIR MANDATE, AND WHICH ONES
STRUCTURALLY CANNOT?  --  the classification, as an instrument.

`quality/relations.py` declares 77 `RelationSchema`s.  A consumer building the
next mandate layer needs to know, per schema, what SHAPE it has: how many
members its figure spans, under which quantifier, where its two `SpanRule`s
look, what its `Placement`s demand, what capabilities it needs, and -- the
question the consumer actually asks -- whether the existing two-word,
two-line-final machinery reaches it unchanged.

THAT CLASSIFICATION HAD BEEN COMPUTED TWICE, BY HAND, IN A CHAT WINDOW, and
standing rule 3 names that exactly: an improvised measurement used twice is a
defect report, not a convenience.  The second hand pass is also what earned
this module its first finding -- it returned 26 pair-shaped where the objects
say 25, and the missing degree of freedom was `analysed rhyme`, whose two span
rules and single placement look like every other end-rhyme in the file and
whose FIGURE has four nodes.  A hand count reads spans; it does not
cross-check them against a figure two hundred lines away.  See `EDGE` below:
that schema is pinned by name, because it is the whole disagreement.

DERIVED, NEVER TRANSCRIBED.  Every quantity here is read off the schema
objects.  The only registry NAMES spelled in this file are inside the
`PINNED*` tables at the bottom, which is what a pin is; `test_relation_shapes.py`
§6 asserts that by AST, so "derive it, do not re-type it" is mechanical here
rather than a promise in a docstring (doctrine 48).

THE THREE BUCKETS, and the third is NOT a third slice of the first two.

  PAIR-SHAPED   figure is a 2-node pair AND both span loci are
                `line_final_token` AND placement REQUIRES `both_line_final`.
                These fit the existing word-pair machinery unchanged.
  NOT PAIR-SHAPED
                everything else.  PAIR-SHAPED and NOT PAIR-SHAPED partition
                the registry; nothing is in both and nothing is in neither.
  NEEDS AN ARITY EXTENSION
                figure is NOT a 2-node `exists`/`exists_k` pair -- `forall`,
                `fraction`, or a 3- or 4-node (or 1-node) figure.  These need a
                mandate object that does not exist yet.  IT CROSS-CUTS THE
                PARTITION and the overlap is not empty: `monorhyme / leash` is
                pair-shaped on spans, placement and node count and quantifies
                `forall` over a stanza, so it is in the arity bucket TOO.  The
                three counts are never summed (doctrine 79) and the overlap is
                pinned in its own right, because a consumer who reads
                "pair-shaped" as "needs no new mandate object" would ship a
                monorhyme graded one pair at a time.

POLARITY IS PART OF "PLACEMENT INCLUDES `both_line_final`" AND THE NAIVE
READING IS WRONG.  `Placement(polarity=False)` is the FORBIDDEN form -- the
same kind string means the opposite demand -- and `internal rhyme` carries
exactly that, `both_line_final` negated, i.e. NEITHER member may be line-final.
A predicate that scanned `p.kind` alone would read that schema's placement as
satisfying a requirement it explicitly forbids.  It costs nothing today, because
`internal rhyme` fails the locus test as well (`any_token`), and the count is
identical under both readings -- which is precisely why it has to be written
down: the correct rule is currently indistinguishable from the wrong one by its
output, and the coincidence is one declaration away from ending.

WHAT READING ALL 77 TURNED UP, and each one is asserted somewhere rather than
left as prose (doctrine 48):

  * `Figure.nodes`, `Figure.edges` and `Figure.template` are declared on all 77
    schemas and READ BY NOTHING IN THE REPOSITORY except this module.
    `realise()`/`assemble()` branch on `quantifier`, `k`, `fraction` and
    `frame`; `evaluate(schema, a, b, stream)` takes exactly two spans.  So the
    3- and 4-node figures are currently PRODUCED as two-member relations and
    their extra members exist only as a declaration.  That is the same species
    as `SpanRule.terminator`, deleted as defect P2 for being declared on all
    154 member rules and read by none -- except the honest close here is the
    opposite one: this is precisely the coordinate the arity extension needs,
    so it should be WIRED, not deleted.  `test_relation_shapes.py` §10 pins
    that it is still unread, so the day it stops being true, something says so.
  * EVERY schema declares exactly two `SpanRule`s, INCLUDING the 3- and 4-node
    figures.  `symploce` is the sharpest case: four nodes, edges
    `(0,1,'anaphora')` and `(2,3,'epistrophe')`, and both of its span rules
    look at `line_initial_token` -- the epistrophe half has no member rule of
    its own.  Same shape in `analysed rhyme` (4 nodes, two end-word rules) and
    the three `cynghanedd sain` variants.
  * `quality/rhyme_constraints.py` carries a SECOND quantifier vocabulary for
    the same question: `pair`/`exists_k`/`forall`/`count_fraction` against this
    module's `exists`/`exists_k`/`forall`/`fraction`, with `k` counted
    differently on each side (`len(nodes) >= k` there against `len(fs) >= k-1`).
    Two spellings of one coordinate in two modules is doctrine 1; it is
    RECORDED here and not touched, because reconciling them is a change to
    files this instrument is not entitled to edit.

RUN
    python3 quality/relation_shapes.py            print the classification
    python3 quality/relation_shapes.py --json     machine-readable
    python3 quality/relation_shapes.py --check    committed figures only

IMPORTABLE, AND THAT IS THE POINT.  `shapes()` returns the per-schema record,
`buckets()` the three memberships, `census()` the aggregate profiles and
`survey_coverage()` the cited/uncited split.  The next consumer asks this
module rather than re-deriving the answer a third time.

EXIT STATUS follows `audit_register.py`, the closest sibling: 0 the committed
figures reproduce, 1 a figure moved, 2 cannot tell.  Two consequences worth
stating, both about `quality/pin_sweep.py`, which discovers an instrument by
the literal string `--check` and reads its stdout:

  * the cannot-tell branch says `cannot tell` in as many words, which is what
    `pin_sweep._SAYS_REFUSED` matches, so a checkout that could not measure is
    filed as CANNOT RUN rather than as a moved figure (doctrine 20) with no
    row added to that module's `EXIT_MEANING` table;
  * for the same reason no other branch may use that phrase, and a moved
    figure is printed as `committed X, measured Y`, which is the shape
    `pin_sweep._EVIDENCE` picks up.

A FIGURE THAT MOVES IS REPINNED BY HAND, WITH THE DATE, AND THE SUPERSEDED
VALUE STAYS VISIBLE (doctrine 17).  The detector is not tuned to meet the pin;
if the two disagree the pin is what moves, and it moves in the open.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# ---------------------------------------------------------------------------
# 1. THE VOCABULARY THE BUCKETS ARE DEFINED IN
#
# These spellings are here because the bucket definitions ARE these spellings
# -- "both span loci are `line_final_token`" cannot be asked without naming
# the locus.  That makes them a second copy of a spelling `relations.py`
# owns (doctrine 1), and the copy is what goes stale: rename the locus there
# and every predicate below silently answers False, the classification collapses
# to "nothing is pair-shaped", and the pins fail while naming the wrong cause.
#
# So the copy is GUARDED rather than trusted.  `vocabulary_unattested()` asks
# the registry whether each spelling still occurs in it, and `check()` reads an
# unattested spelling as CANNOT TELL -- a detector that has gone inert is not a
# figure that moved (doctrine 20, and the `n/a` lesson in
# `audit_register.PINNED_CONSISTENCY`).
# ---------------------------------------------------------------------------

#: The locus both `SpanRule`s must name for a schema to be pair-shaped.
END_LOCUS = "line_final_token"

#: The placement kind a pair-shaped schema must REQUIRE.  Required, not merely
#: present: see the docstring on polarity.
END_PLACEMENT = "both_line_final"

#: The two quantifiers the existing pair machinery can express.  Everything
#: else -- `forall`, `fraction` -- needs a mandate object that does not exist.
PAIR_QUANTIFIERS = ("exists", "exists_k")

#: The node count of a pair.
PAIR_NODES = 2


def _registry(registry=None):
    """-> the schemas to classify.  ASKED of `relations.py`, never re-typed.

    `registry` is injectable so a test can hand this module a shape the real
    registry does not contain -- which is the only way to prove a predicate can
    answer False for the right reason (doctrine 94).
    """
    if registry is not None:
        return dict(registry)
    from quality import relations as R
    return R.all_schemas()


def vocabulary_unattested(registry=None):
    """-> the declared vocabulary spellings that occur NOWHERE in the registry.

    Empty is the healthy state.  A non-empty answer means this module's copy of
    a `relations.py` spelling has drifted, so every predicate below is measuring
    something other than what it says.
    """
    reg = _registry(registry)
    loci = {r.locus for s in reg.values() for r in s.spans}
    kinds = {p.kind for s in reg.values() for p in s.placement}
    quants = {s.figure.quantifier for s in reg.values()}
    bad = []
    if END_LOCUS not in loci:
        bad.append(("locus", END_LOCUS))
    if END_PLACEMENT not in kinds:
        bad.append(("placement kind", END_PLACEMENT))
    for q in PAIR_QUANTIFIERS:
        if q not in quants:
            bad.append(("quantifier", q))
    return tuple(bad)


# ---------------------------------------------------------------------------
# 2. THE PREDICATES.  Each takes a `RelationSchema`, so a caller -- or a test
#    with a synthetic schema -- can ask about ONE without building the census.
# ---------------------------------------------------------------------------

def span_loci(schema):
    """-> (locus, locus).  The `locus` of each of the two `SpanRule`s.

    REFUSES a schema whose `spans` is not a pair rather than padding or
    truncating: "the two span loci" is ill-posed for anything else, and the
    whole registry satisfies it today (`test_relation_shapes.py` §1 asserts the
    premise, so the day it stops being true this raises instead of quietly
    reporting a shape nobody declared).
    """
    if len(schema.spans) != 2:
        raise ValueError(
            "%r declares %d span rule(s); this classification is defined over "
            "a PAIR of member rules and has no reading for anything else."
            % (schema.name, len(schema.spans)))
    return tuple(r.locus for r in schema.spans)


def placement_kinds(schema):
    """-> ((kind, polarity), ...) for each `Placement`, in declaration order."""
    return tuple((p.kind, bool(p.polarity)) for p in schema.placement)


def requires_end_placement(schema):
    """-> True iff some placement REQUIRES `both_line_final`.

    `polarity` is read.  A forbidden `both_line_final` is the opposite demand
    and must not satisfy this (see the module docstring)."""
    return any(p.kind == END_PLACEMENT and p.polarity for p in schema.placement)


def is_pair_shaped(schema):
    """-> True iff the existing word-pair machinery reaches this unchanged:
    a 2-node figure, both loci `line_final_token`, `both_line_final` required."""
    return (schema.figure.nodes == PAIR_NODES
            and set(span_loci(schema)) == {END_LOCUS}
            and requires_end_placement(schema))


def needs_arity_extension(schema):
    """-> True iff the figure is NOT a 2-node `exists`/`exists_k` pair.

    CROSS-CUTS `is_pair_shaped`; see the docstring.  Read off the figure alone,
    because the mandate object this names is a fact about members and
    quantification and nothing about where the spans look.
    """
    f = schema.figure
    return not (f.nodes == PAIR_NODES and f.quantifier in PAIR_QUANTIFIERS)


def span_shaped(schema):
    """-> True iff the SPANS AND PLACEMENT look pair-shaped, whatever the figure.

    This is the figure-blind reading, and it exists because it is what a hand
    pass produces: it is one larger than `is_pair_shaped` and the difference is
    `EDGE`'s first entry.  Naming it makes the disagreement a locatable
    coordinate instead of an argument (doctrine 58).
    """
    return (set(span_loci(schema)) == {END_LOCUS}
            and requires_end_placement(schema))


def not_pair_reason(schema):
    """-> the conjuncts a not-pair-shaped schema fails, as a sorted tuple.

    `()` for a pair-shaped schema.  FIGURE / LOCUS / PLACEMENT -- the three
    coordinates of the definition, so a consumer can see WHICH one puts a
    relation out of reach rather than only that it is.
    """
    bad = []
    if schema.figure.nodes != PAIR_NODES:
        bad.append("FIGURE")
    if set(span_loci(schema)) != {END_LOCUS}:
        bad.append("LOCUS")
    if not requires_end_placement(schema):
        bad.append("PLACEMENT")
    return tuple(bad)


# ---------------------------------------------------------------------------
# 3. THE PER-SCHEMA RECORD
# ---------------------------------------------------------------------------

def figure_of(schema):
    """-> the figure as a plain dict: nodes, quantifier, frame, and k/fraction
    WHERE SET.

    `k` and `fraction` are omitted when they carry the dataclass default,
    because printing `k=1` beside an `exists` figure states a coordinate the
    declaration never chose -- `k` is read only under `exists_k` and `fraction`
    only under `fraction`.  A defaulted field rendered as a decision is the
    shape doctrine 58 is about, one level down.
    """
    f = schema.figure
    out = {"nodes": f.nodes, "quantifier": f.quantifier, "frame": f.frame}
    if f.quantifier == "exists_k":
        out["k"] = f.k
    if f.fraction is not None:
        out["fraction"] = f.fraction
    if f.template is not None:
        out["template"] = f.template
    return out


def figure_signature(schema):
    """-> a hashable rendering of `figure_of`, for the census."""
    d = figure_of(schema)
    return tuple(sorted(d.items()))


def cited_indices(schema):
    """-> the set of survey indices this schema's traditions cite, deduplicated.

    A schema names its traditions and each `Tradition` carries the
    cell-restricted index set its witness verdict was computed over; the union
    is "how much of the 601-row survey this one relation buys".  Two traditions
    of one schema may cite the same index, so the SET is the object and a sum
    of `len(t.cites)` would be a different, larger number.
    """
    out = set()
    for t in schema.traditions:
        out |= set(t.cites)
    return out


def shapes(registry=None):
    """-> {name: record}.  The classification, per schema, sorted by name.

    Sorted rather than in registry order: a tie broken by iterating a mapping
    is a result that does not reproduce (doctrine 66).
    """
    reg = _registry(registry)
    out = {}
    for name in sorted(reg):
        s = reg[name]
        cites = cited_indices(s)
        out[name] = {
            "name": name,
            "figure": figure_of(s),
            "loci": span_loci(s),
            "placements": placement_kinds(s),
            "capabilities": tuple(s.capabilities()),
            "cites": tuple(sorted(cites)),
            "n_cites": len(cites),
            "pair_shaped": is_pair_shaped(s),
            "arity_extension": needs_arity_extension(s),
            "span_shaped": span_shaped(s),
            "why_not_pair": not_pair_reason(s),
        }
    return out


def buckets(registry=None):
    """-> the three memberships, each a sorted tuple of names.

    NEVER SUMMED (doctrine 79).  `pair_shaped` and `not_pair_shaped` partition
    the registry; `arity_extension` cross-cuts both.
    """
    sh = shapes(registry)
    return {
        "pair_shaped": tuple(n for n, r in sh.items() if r["pair_shaped"]),
        "not_pair_shaped": tuple(n for n, r in sh.items()
                                 if not r["pair_shaped"]),
        "arity_extension": tuple(n for n, r in sh.items()
                                 if r["arity_extension"]),
    }


def edge_cases(registry=None):
    """-> the two sets where the three buckets disagree with each other.

    `span_not_pair` -- spans and placement read pair-shaped, the FIGURE does
    not.  This is the whole of the hand count's overcount.
    `pair_and_arity` -- pair-shaped AND still needing a new mandate object.

    Both are pinned by NAME rather than by count: each set has one member, and
    a count of one survives a swap that would change the entire meaning of the
    bucket (doctrine 94 -- a check that can only say "still one" is a check
    that never looked at which one).
    """
    sh = shapes(registry)
    return {
        "span_not_pair": tuple(n for n, r in sh.items()
                               if r["span_shaped"] and not r["pair_shaped"]),
        "pair_and_arity": tuple(n for n, r in sh.items()
                                if r["pair_shaped"] and r["arity_extension"]),
    }


# ---------------------------------------------------------------------------
# 4. THE AGGREGATE PROFILES
# ---------------------------------------------------------------------------

def _profile(counter):
    """-> ((key, n), ...) sorted by descending n then key.  Deterministic, so
    it can be pinned and diffed."""
    return tuple(sorted(counter.items(), key=lambda kv: (-kv[1], str(kv[0]))))


def census(registry=None):
    """-> the aggregate profiles, all deterministic, all pinnable."""
    sh = shapes(registry)
    b = buckets(registry)
    e = edge_cases(registry)
    loci = collections.Counter()
    kinds = collections.Counter()
    figs = collections.Counter()
    caps = collections.Counter()
    for r in sh.values():
        loci.update(r["loci"])
        for k, pol in r["placements"]:
            kinds[k if pol else k + " (forbidden)"] += 1
        caps.update(r["capabilities"])
    reg = _registry(registry)
    for s in reg.values():
        figs[figure_signature(s)] += 1
    return {
        "schemas": len(sh),
        "pair_shaped": len(b["pair_shaped"]),
        "not_pair_shaped": len(b["not_pair_shaped"]),
        "arity_extension": len(b["arity_extension"]),
        "span_shaped": sum(1 for r in sh.values() if r["span_shaped"]),
        "span_not_pair": e["span_not_pair"],
        "pair_and_arity": e["pair_and_arity"],
        "span_slots": sum(len(r["loci"]) for r in sh.values()),
        "placement_slots": sum(len(r["placements"]) for r in sh.values()),
        "locus_profile": _profile(loci),
        "placement_profile": _profile(kinds),
        "capability_profile": _profile(caps),
        "figure_profile": _profile(figs),
        "schemas_citing_nothing": tuple(n for n, r in sh.items()
                                        if not r["n_cites"]),
    }


def survey_coverage(registry=None):
    """-> how much of `quality/canon_index.tsv` the 77 schemas between them cite.

    THE INDEX IS ASKED, NOT PARSED HERE.  `quality/canon_sources.index()` owns
    the reader and `cell_of()` owns the cell prefix rule; a second TSV reader in
    this file would be a second definition of the survey (doctrine 1).
    `loaded()` False is a THIRD state -- a checkout with no index does not know
    that nothing is covered, it knows nothing (doctrine 28) -- and is returned
    as `loaded: False` rather than as a coverage of zero.
    """
    from quality import canon_sources as CS
    if not CS.loaded():
        return {"loaded": False, "rows": 0, "covered": 0, "uncited": 0,
                "uncited_by_cell": (), "covered_by_cell": (),
                "cited_off_index": ()}
    ix = CS.index()
    cited = set()
    for r in shapes(registry).values():
        cited |= set(r["cites"])
    on = cited & set(ix)
    off = cited - set(ix)
    un = set(ix) - cited
    return {
        "loaded": True,
        "rows": len(ix),
        "covered": len(on),
        "uncited": len(un),
        "uncited_by_cell": _profile(collections.Counter(
            CS.cell_of(i) for i in un)),
        "covered_by_cell": _profile(collections.Counter(
            CS.cell_of(i) for i in on)),
        # A cited index that is not IN the index would mean a schema's
        # provenance points at a row nobody has; reported rather than dropped.
        "cited_off_index": tuple(sorted(off)),
    }


# ---------------------------------------------------------------------------
# 5. THE REPORT
# ---------------------------------------------------------------------------

def _fmt_fig(d):
    bits = ["%d node%s" % (d["nodes"], "" if d["nodes"] == 1 else "s"),
            d["quantifier"]]
    if "k" in d:
        bits.append("k=%s" % d["k"])
    if "fraction" in d:
        bits.append("fraction=%s" % d["fraction"])
    bits.append("over %s" % d["frame"])
    if "template" in d:
        bits.append("template=%r" % d["template"])
    return " / ".join(bits)


def report(registry=None, out=None):
    """Print the classification.  This is what a bare run emits."""
    p = (out or sys.stdout).write

    def line(s=""):
        p(s + "\n")

    sh = shapes(registry)
    b = buckets(registry)
    c = census(registry)
    cov = survey_coverage(registry)

    line("=" * 78)
    line("RELATION SHAPES -- the %d declared schemas of quality/relations.py, "
         "by SHAPE" % c["schemas"])
    line("=" * 78)
    line("Every figure below is read off the schema objects. Nothing here is a")
    line("transcribed list of names except the PINNED tables --check grades "
         "against.")
    line()

    line("1. THE THREE COUNTS, AND THEY ARE NEVER SUMMED (doctrine 79)")
    line("   pair-shaped               %3d   2-node figure, both loci %r,"
         % (c["pair_shaped"], END_LOCUS))
    line("                                   %r REQUIRED -- the existing "
         "word-pair" % END_PLACEMENT)
    line("                                   machinery reaches these unchanged")
    line("   not pair-shaped           %3d   the complement: a word-pair model"
         % c["not_pair_shaped"])
    line("                                   structurally cannot reach these")
    line("   needs an arity extension  %3d   figure is not a 2-node "
         "exists/exists_k" % c["arity_extension"])
    line("                                   pair -- needs a mandate object "
         "that")
    line("                                   does not exist yet. CROSS-CUTS "
         "the")
    line("                                   partition above.")
    line()
    line("   THE FIRST TWO PARTITION THE REGISTRY: %d + %d = %d."
         % (c["pair_shaped"], c["not_pair_shaped"], c["schemas"]))
    line("   THE THIRD DOES NOT JOIN THEM. Overlap with pair-shaped: %d -- %s"
         % (len(c["pair_and_arity"]),
            ", ".join(c["pair_and_arity"]) or "none"))
    line()

    line("2. NEEDS AN ARITY EXTENSION (%d), each with its figure"
         % c["arity_extension"])
    for n in b["arity_extension"]:
        line("   %-38s %s%s" % (n, _fmt_fig(sh[n]["figure"]),
                                "   [ALSO PAIR-SHAPED]"
                                if sh[n]["pair_shaped"] else ""))
    line()

    line("3. THE FIGURE-BLIND READING, AND WHY IT DISAGREES")
    line("   Schemas whose SPANS AND PLACEMENT look pair-shaped: %d"
         % c["span_shaped"])
    line("   Of those, pair-shaped once the FIGURE is read:       %d"
         % c["pair_shaped"])
    line("   The difference (%d): %s"
         % (len(c["span_not_pair"]), ", ".join(c["span_not_pair"]) or "none"))
    for n in c["span_not_pair"]:
        line("     %-38s %s" % (n, _fmt_fig(sh[n]["figure"])))
    line("   A hand pass reads two span rules and a placement and stops; the")
    line("   figure is declared elsewhere in the file. That is the whole gap.")
    line()

    line("4. FIGURE CENSUS (%d distinct signatures over %d schemas)"
         % (len(c["figure_profile"]), c["schemas"]))
    for sig, n in c["figure_profile"]:
        line("   %3d  %s" % (n, _fmt_fig(dict(sig))))
    line()

    line("5. SPAN LOCI -- %d slots, two per schema" % c["span_slots"])
    for k, n in c["locus_profile"]:
        line("   %3d  %s" % (n, k))
    line()

    line("6. PLACEMENT KINDS -- %d slots over %d schema(s) that declare one"
         % (c["placement_slots"],
            sum(1 for r in sh.values() if r["placements"])))
    for k, n in c["placement_profile"]:
        line("   %3d  %s" % (n, k))
    line()

    line("7. CAPABILITIES -- %d distinct, over %d schema(s) that need one"
         % (len(c["capability_profile"]),
            sum(1 for r in sh.values() if r["capabilities"])))
    for k, n in c["capability_profile"]:
        line("   %3d  %s" % (n, k))
    line()

    line("8. SURVEY COVERAGE -- how much of quality/canon_index.tsv the "
         "schemas buy")
    if not cov["loaded"]:
        line("   the survey index is not on disk: no coverage is stated, and")
        line("   that is not a coverage of zero (doctrine 28).")
    else:
        line("   index rows                %3d" % cov["rows"])
        line("   cited by some schema      %3d" % cov["covered"])
        line("   cited by no schema        %3d" % cov["uncited"])
        line("   uncited by cell: %s"
             % ", ".join("%s %d" % (k, n) for k, n in cov["uncited_by_cell"]))
        line("   covered by cell: %s"
             % ", ".join("%s %d" % (k, n) for k, n in cov["covered_by_cell"]))
        if cov["cited_off_index"]:
            line("   CITED BUT NOT IN THE INDEX (%d): %s"
                 % (len(cov["cited_off_index"]),
                    ", ".join(cov["cited_off_index"])))
        line("   schemas citing nothing    %3d   %s"
             % (len(c["schemas_citing_nothing"]),
                ", ".join(c["schemas_citing_nothing"]) or "none"))
    line()

    line("9. EVERY SCHEMA")
    line("   %-4s %-38s %-11s %-34s %s"
         % ("", "name", "bucket", "figure", "loci / why not"))
    for n, r in sh.items():
        tag = "PAIR" if r["pair_shaped"] else "----"
        ar = "+ARITY" if r["arity_extension"] else "      "
        why = ("" if r["pair_shaped"]
               else " [%s]" % "+".join(r["why_not_pair"]))
        line("   %s %-38s %-11s %-34s %s%s"
             % (tag, n, ar, _fmt_fig(r["figure"]),
                "/".join(r["loci"]), why))
    line()
    line("   cites, per schema (indices into quality/canon_index.tsv):")
    for n, r in sh.items():
        line("   %5d  %s" % (r["n_cites"], n))
    line()
    return 0


# ---------------------------------------------------------------------------
# 6. THE PINS
#
# WHAT IS PINNED.  Everything below is a pure function of the declarations in
# `quality/relations.py` and the rows of `quality/canon_index.tsv`: no corpus,
# no draw, no clock, no filesystem walk.  Three consecutive runs under
# `PYTHONHASHSEED=random` are byte-identical (2026-08-22), so there is no Monte
# Carlo half to leave unpinned.
#
# WHAT IS DELIBERATELY NOT PINNED, AND WHY.
#
#   1. THE SCHEMA COUNT AND THE INDEX ROW COUNT.  `audit_register.PINNED`
#      already pins `schemas: 77` and `index_rows: 601`.  Pinning them here as
#      well would be one fact in two media with no grep that finds both, which
#      is `MISSING.md` M-21's own subject; so both are DERIVED here as
#      denominators and neither appears as a pin.  `pair_shaped` and
#      `not_pair_shaped` ARE both pinned even though they are complements over
#      the registry, and that single redundancy is on purpose: it is the
#      cheapest thing that makes a change in registry SIZE visible in this file
#      without re-pinning a figure another instrument owns.
#      A CONSEQUENCE THAT MUST NOT BE DISCOVERED THE HARD WAY: `survey_uncited`
#      is a joint fact about relations.py AND the index, so growing the index by
#      one row moves it AND `audit_register.PINNED["index_rows"]` at once. A
#      sitting that adds a survey row repins in both files. This sentence is
#      the second medium saying so.
#
#   2. PER-SCHEMA CITE COUNTS, as 77 separate pins.  They are printed on every
#      run and returned by `shapes()`, but the schema-to-index attribution is
#      `quality/canon_sources.py`'s subject and `audit_register` already pins
#      its verdict counts (`traditions_external/project/cannot_tell`).  A third
#      statement of it here would go stale first and be believed anyway.  What
#      IS pinned is the repo-wide covered/uncited split and the per-cell uncited
#      profile, which no other instrument states.
#
#   3. THE MEMBERSHIP OF `not_pair_shaped`.  It is the complement of
#      `pair_shaped` over the registry; a second list would be one partition
#      stated twice, and the copy is what goes stale (doctrine 1).
#
# WHAT A COUNT-ONLY PIN CANNOT SEE, said out loud.  A SWAP inside a bucket --
# one schema leaves, another enters, the count unchanged -- is invisible to an
# integer.  So the two SMALL buckets are pinned by NAME (`PINNED_ARITY`,
# `PINNED_EDGE`), and the large one is pinned by name as well
# (`PINNED_PAIR_SHAPED`): it is 25 lines and it is the list the next consumer
# is going to build against, so a silent substitution in it is exactly the
# failure this instrument exists to prevent.  `not_pair_shaped` is left to its
# count and its profiles, per exclusion 3 above.
#
# Doctrine 58: these are counts, and a count is a coordinate of the rendering as
# well as of the threshold.  Argue them, then repin with the date and the
# superseded value visible (doctrine 17).  Do not tune a predicate to meet one.
# ---------------------------------------------------------------------------

#: PINNED 2026-08-22, first derivation.
#:
#: `pair_shaped` 25 SUPERSEDES a hand count of 26 computed twice in a chat
#: window and never by an instrument (standing rule 3).  The hand figure is not
#: struck as a mistake in arithmetic: it is `span_shaped`, which is pinned
#: below at 26 and is a real and different quantity -- the number of schemas
#: whose SPANS AND PLACEMENT read pair-shaped.  The difference is `analysed
#: rhyme`, a 4-node figure, and the hand count listed that same schema in its
#: own arity-extension bucket, so the two hand figures contradicted each other.
PINNED = {
    # -- the three buckets --------------------------------------------------
    "pair_shaped": 25,
    "not_pair_shaped": 52,
    "arity_extension": 12,
    # -- the figure-blind reading, and the two disagreements ----------------
    "span_shaped": 26,
    "n_span_not_pair": 1,
    "n_pair_and_arity": 1,
    # -- slot totals --------------------------------------------------------
    "span_slots": 154,
    #: REPINNED 2026-08-23 from ~~91~~ (doctrine 17). ONE slot, and it is
    #: `off_beat` on `offbeat internal rhyme`: the schema kept its `beat`
    #: capability gate AND gained the placement, because the gate is what
    #: makes an undeclared grid a refusal and the placement is what makes a
    #: declared one selective, and either alone is one of the two defects
    #: that schema has had. The gate-only version fired on every internal
    #: rhyme and called it off-beat.
    "placement_slots": 92,
    # -- the survey ---------------------------------------------------------
    #    `survey_rows` is NOT here: `audit_register.PINNED["index_rows"]` owns
    #    it (exclusion 1).
    "survey_covered": 375,
    "survey_uncited": 226,
    "n_schemas_citing_nothing": 2,
    "n_cited_off_index": 0,
}

#: The 13 span loci over 154 slots, as ((locus, n), ...) descending.
PINNED_LOCUS_PROFILE = (
    ("line_final_token", 71), ("any_token", 26), ("line", 14),
    ("line_initial_token", 9), ("free_run", 8), ("half_line_a", 4),
    ("half_line_b", 4), ("lift", 4), ("line_head_index", 4),
    ("token_first_half", 3), ("token_second_half", 3),
    # The 2-tie breaks on the KEY, ascending -- `_profile` sorts by (-n, key)
    # so a tie is never left to mapping order (doctrine 66).
    ("line_final_before_refrain", 2), ("line_refrain_tail", 2),
)

#: The placement kinds over 91 slots.  `both_line_final (forbidden)` is
#: rendered as its own key BECAUSE it is a different demand from the required
#: form; collapsing the two would put the only negated placement in the
#: registry under a requirement it forbids.
#: 28 + 1, NOT 29: the required and the forbidden form of one kind string are
#: two different demands and are counted apart. A profile that summed them
#: would read 29 and hide the only negated placement in the registry.
PINNED_PLACEMENT_PROFILE = (
    ("both_line_final", 28), ("different_lines", 16), ("same_line", 15),
    ("adjacent_lines", 5), ("line_gap_at_most", 5), ("across_line_break", 3),
    ("at_caesura", 3), ("both_line_initial", 3), ("same_token", 3),
    ("a_is_split_token", 1), ("a_line_final", 1), ("at_lift", 1),
    ("both_line_final (forbidden)", 1), ("both_multiword", 1),
    ("exactly_one_line_final", 1), ("lift_index", 1),
    ("neither_line_final", 1), ("off_beat", 1), ("spans_overlap", 1),
    ("word_count_differs", 1),
)
#: `off_beat` ADDED 2026-08-23 (doctrine 17). It is the whole of the
#: `placement_slots` 91 -> 92 move above, and it is the placement half of
#: `offbeat internal rhyme` -- the half that makes a DECLARED beat grid
#: selective, as against the `beat` capability gate, which is the half that
#: makes an UNDECLARED one refuse. Every other row is unchanged.

#: THE FIGURE CENSUS: 13 distinct signatures over the 77 schemas.  Pinned as
#: the SIGNATURE and not as `_fmt_fig`'s rendering of it, so a cosmetic change
#: to the printed wording cannot turn this gate red -- a gate that goes red on
#: a rewording is a gate people learn to skip (`audit_register.PINNED`
#: exclusion 3 makes the same call about `numbers_total`).
#:
#: It is here because it is the ONLY pin that can see a figure move WITHIN a
#: bucket: change `frame` from `song` to `stanza` on a pair-shaped schema and
#: every count, membership and locus profile above is unchanged.
PINNED_FIGURE_PROFILE = (
    ((('frame', 'song'), ('nodes', 2), ('quantifier', 'exists')), 58),
    ((('frame', 'line'), ('k', 2), ('nodes', 2), ('quantifier', 'exists_k')), 3),
    ((('frame', 'stanza'), ('nodes', 2), ('quantifier', 'forall')), 3),
    ((('frame', 'token'), ('nodes', 2), ('quantifier', 'exists')), 3),
    ((('frame', 'line'), ('nodes', 3), ('quantifier', 'exists')), 2),
    ((('fraction', 0.8), ('frame', 'line'), ('nodes', 2),
      ('quantifier', 'fraction')), 1),
    ((('frame', 'line'), ('nodes', 1), ('quantifier', 'exists'),
      ('template', 'declared 平仄 pattern')), 1),
    ((('frame', 'line'), ('nodes', 2), ('quantifier', 'exists')), 1),
    ((('frame', 'line'), ('nodes', 4), ('quantifier', 'exists')), 1),
    ((('frame', 'line_pair'), ('nodes', 4), ('quantifier', 'exists')), 1),
    ((('frame', 'song'), ('nodes', 2), ('quantifier', 'forall')), 1),
    ((('frame', 'stanza'), ('nodes', 3), ('quantifier', 'exists')), 1),
    ((('frame', 'stanza'), ('nodes', 4), ('quantifier', 'exists')), 1),
)

#: The uncited half of the survey, by inventory cell.
PINNED_UNCITED_BY_CELL = (("X", 84), ("S", 50), ("G", 32), ("C", 27),
                          ("I", 20), ("E", 13))

#: THE BUCKET THE NEXT CONSUMER HAS TO BUILD FOR: 12 schemas whose figure is
#: not a 2-node exists/exists_k pair.  Pinned by NAME, not by count -- a swap
#: keeps the count at 12 and changes every requirement.
PINNED_ARITY = (
    "analysed rhyme",
    "blues AAB stanza",
    "chain rhyme (rap)",
    "cynghanedd sain",
    "cynghanedd sain gadwynog",
    "cynghanedd sain lafarog",
    "dvitiyakshara-prasa",
    "monai",
    "monorhyme / leash",
    "paroemion",
    "symploce",
    "平仄 tonal template",
)

#: THE 25 THE EXISTING MACHINERY REACHES UNCHANGED.
PINNED_PAIR_SHAPED = (
    "Middle Chinese end rhyme (同用 group)",
    "Scots vowel-length rhyme (Aitken's Law)",
    "additive rhyme",
    "amphisbaenic rhyme",
    "apocopated rhyme",
    "assonance",
    "consonance",
    "dialect rhyme",
    "eye rhyme",
    "family rhyme",
    "historical rhyme",
    "homoioteleuton",
    "light rhyme",
    "monorhyme / leash",
    "pantun ABAB",
    "pararhyme",
    "perfect rhyme",
    "proest",
    "reverse rhyme",
    "rime riche",
    "semirhyme",
    "subtractive rhyme",
    "syllabic rhyme",
    "trite rhyme",
    "wrenched rhyme",
)

#: THE TWO EDGE SCHEMAS, each the sole member of its set, each pinned by name
#: because a count of one cannot tell you a substitution happened.
#:   span_not_pair  -- looks pair-shaped until the figure is read.  This IS the
#:                     hand count's extra entry.
#:   pair_and_arity -- pair-shaped AND needs the new mandate object anyway.
PINNED_EDGE = {
    "span_not_pair": ("analysed rhyme",),
    "pair_and_arity": ("monorhyme / leash",),
}


# ---------------------------------------------------------------------------
# 7. --check
# ---------------------------------------------------------------------------

def _measure_for_check(registry=None):
    """-> the pinned quantities, measured.  Reads the SAME functions `report()`
    prints from, so the two cannot disagree."""
    c = census(registry)
    b = buckets(registry)
    cov = survey_coverage(registry)
    scalars = {
        "pair_shaped": c["pair_shaped"],
        "not_pair_shaped": c["not_pair_shaped"],
        "arity_extension": c["arity_extension"],
        "span_shaped": c["span_shaped"],
        "n_span_not_pair": len(c["span_not_pair"]),
        "n_pair_and_arity": len(c["pair_and_arity"]),
        "span_slots": c["span_slots"],
        "placement_slots": c["placement_slots"],
        "survey_covered": cov["covered"],
        "survey_uncited": cov["uncited"],
        "n_schemas_citing_nothing": len(c["schemas_citing_nothing"]),
        "n_cited_off_index": len(cov["cited_off_index"]),
    }
    return {
        "scalars": scalars,
        "locus_profile": c["locus_profile"],
        "placement_profile": c["placement_profile"],
        "figure_profile": c["figure_profile"],
        "uncited_by_cell": cov["uncited_by_cell"],
        "arity": b["arity_extension"],
        "pair": b["pair_shaped"],
        "edge": {k: v for k, v in c.items()
                 if k in ("span_not_pair", "pair_and_arity")},
        "survey_loaded": cov["loaded"],
    }


def _diff_names(want, have):
    """-> (gone, arrived) between two name tuples."""
    return (tuple(n for n in want if n not in have),
            tuple(n for n in have if n not in want))


def check(registry=None, measure=None, out=None):
    """-> exit code.  0 the committed figures reproduce · 1 a figure moved ·
    2 cannot tell.

    `measure` is injectable so the CANNOT-TELL branch is REACHABLE from a test.
    A refusal path no test can enter is a refusal path nobody has checked, and
    this module's whole subject is checks that cannot fail.
    """
    p = (out or sys.stdout).write

    def line(s=""):
        p(s + "\n")

    line()
    line("=" * 74)
    line("CHECK -- the committed relation-shape figures against this run")
    line("=" * 74)

    inert = vocabulary_unattested(registry)
    if inert:
        for what, spelling in inert:
            line("  the declared %s %r occurs nowhere in the registry"
                 % (what, spelling))
        line("  This module's copy of a relations.py spelling has drifted, so")
        line("  every predicate here is measuring something else. That is a")
        line("  detector gone inert, not a figure that moved -- so this run")
        line("  cannot tell you whether anything moved (doctrine 20).")
        line("  Repair the vocabulary at the top of this file first.")
        line()
        line("RESULT: CANNOT TELL")
        return 2

    try:
        m = (measure or _measure_for_check)(registry)
    except Exception as e:                                    # noqa: BLE001
        line("  measurement raised %s: %s" % (type(e).__name__, e))
        line("  A checkout that could not measure has not drifted; this run")
        line("  cannot tell. Exit 2, not 1 (doctrine 20/28).")
        line()
        line("RESULT: CANNOT TELL")
        return 2

    if not m.get("survey_loaded", True):
        line("  quality/canon_index.tsv is absent, so the survey split has no")
        line("  value here. A checkout with no index does not know that")
        line("  nothing is covered; it cannot tell (doctrine 28).")
        line()
        line("RESULT: CANNOT TELL")
        return 2

    bad = 0
    for k in sorted(PINNED):
        got = m["scalars"].get(k)
        ok = got == PINNED[k]
        bad += not ok
        line("  [%s] %-26s committed %s%s"
             % ("ok  " if ok else "FAIL", k, PINNED[k],
                "" if ok else ", measured %s" % (got,)))

    for label, want, have in (
            ("locus profile", PINNED_LOCUS_PROFILE, m["locus_profile"]),
            ("placement profile", PINNED_PLACEMENT_PROFILE,
             m["placement_profile"]),
            ("figure profile", PINNED_FIGURE_PROFILE, m["figure_profile"]),
            ("uncited by cell", PINNED_UNCITED_BY_CELL, m["uncited_by_cell"])):
        ok = tuple(want) == tuple(have)
        bad += not ok
        line("  [%s] %-26s committed %s%s"
             % ("ok  " if ok else "FAIL", label, list(want),
                "" if ok else ", measured %s" % (list(have),)))

    for label, want, have in (
            ("arity membership", PINNED_ARITY, m["arity"]),
            ("pair-shaped membership", PINNED_PAIR_SHAPED, m["pair"]),
            ("edge span_not_pair", PINNED_EDGE["span_not_pair"],
             m["edge"]["span_not_pair"]),
            ("edge pair_and_arity", PINNED_EDGE["pair_and_arity"],
             m["edge"]["pair_and_arity"])):
        gone, arrived = _diff_names(want, have)
        ok = not gone and not arrived
        bad += not ok
        line("  [%s] %-26s committed %d name(s)%s"
             % ("ok  " if ok else "FAIL", label, len(want),
                "" if ok else ", measured %d -- left: %s; entered: %s"
                % (len(have), list(gone) or "none", list(arrived) or "none")))

    if bad:
        line()
        line("  %d figure(s) moved. A schema's figure, span rule, placement or"
             % bad)
        line("  citation set has changed under this instrument, or a schema")
        line("  was added or removed.")
        line("  REPIN BY HAND, with the date, and keep the superseded value")
        line("  visible (doctrine 17). Do not tune a predicate to meet a pin --")
        line("  if the objects and the pin disagree, the pin is what moves.")
    line()
    line("RESULT: %s" % ("PASS" if not bad else "FAIL"))
    return 0 if not bad else 1


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Classify quality/relations.py's declared schemas by "
                    "SHAPE. Bare: print the classification.")
    ap.add_argument("--check", action="store_true",
                    help="grade the committed figures (0 pass / 1 moved / "
                         "2 cannot tell)")
    ap.add_argument("--json", action="store_true",
                    help="machine-readable classification")
    a = ap.parse_args(argv)

    if a.check:
        return check()
    if a.json:
        doc = {"shapes": {n: {k: (list(v) if isinstance(v, tuple) else v)
                              for k, v in r.items()}
                          for n, r in shapes().items()},
               "buckets": {k: list(v) for k, v in buckets().items()},
               "census": {k: (list(v) if isinstance(v, tuple) else v)
                          for k, v in census().items()},
               "survey": {k: (list(v) if isinstance(v, tuple) else v)
                          for k, v in survey_coverage().items()}}
        print(json.dumps(doc, indent=2, ensure_ascii=False, default=str))
        return 0
    return report()


if __name__ == "__main__":
    sys.exit(main())
