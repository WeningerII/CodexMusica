#!/usr/bin/env python3
"""INTRA-LINE FIGURES — the 19 schemas no pair of lines can stand in.

THE GAP THIS CLOSES. `quality/relations.REGISTRY` holds 77 schemas and a
mandate can now declare any of them (`MISSING.md` M-59), but a mandate group
is a set of lines that must relate TO EACH OTHER, and 19 of the 77 declare
`same_line` / `same_token` / `at_caesura` / `at_lift` placement. Those are
properties of ONE line. `rhyme_types.satisfies_relation` therefore REFUSES
them with the placement named -- which is the correct answer to the question a
mandate asks, and is not an answer to the question a writer has, which is
"is this figure in my line".

So they need a different route, and this is it: not a pair judge, a PER-LINE
READER. Nothing here re-implements a schema. `relations.realise()` already
finds every instance of every schema over a stream; `relations.line_pairs_for`
takes that output and keeps the CROSS-line instances for the mandate; this
module takes the same output and keeps the SAME-line ones. One realisation,
two consumers, no second definition of any figure (doctrine 1).

WHAT A FIGURE IS NOT. It is not a violation and it is not a requirement.
`alliteration` in a line is a fact about the line, and whether it is wanted is
the writer's call -- doctrine 7's floor-not-ranking, and the same stance
`SCHEME_COLLISION` already takes about an unmandated rhyme. So every finding
this module produces is a NOTE, never a FLAG, and the module has no opinion
about how many is too many.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import relations as R                          # noqa: E402
from quality.rhyme_types import (INTRA_LINE_PLACEMENTS,      # noqa: E402
                                 _all_same_line, _placements_of)


def intra_line_schemas():
    """-> the registry names whose every declared placement is intra-line.

    DERIVED, NEVER LISTED. A hand-written list of 19 names is a list that goes
    stale the first time a schema's placement is edited, and the placement is
    already declared on the schema -- so the roster is read off the same field
    the judge refuses on, and the two cannot disagree (doctrine 1).
    """
    return tuple(sorted(n for n in R.REGISTRY if _all_same_line(n)))


def line_figures(stream, names=None, keep_refusals=True):
    """Every intra-line figure instance in this stream, grouped by LINE.

    -> {"lines": {line_no: [Figure...]}, "refused": [Refused...],
        "asked": (name, ...)}

    `line_no` is 1-BASED, converted once here from `Span.origin`'s 0-based
    `L<n>.<locus>`, the same single conversion site `line_pairs_for` uses.

    A REFUSAL IS RETURNED BESIDE THE FINDINGS AND NOT INSTEAD OF THEM
    (doctrine 20/79). `cynghanedd groes` needs a caesura and
    `alliterative long line` needs a lift map; a stream that supplies neither
    produces zero instances of both, and "this line has no cynghanedd" and
    "nothing here could look for cynghanedd" are different sentences. They are
    kept in separate lists so a caller cannot sum them.
    """
    asked = tuple(names) if names is not None else intra_line_schemas()
    # THE CAESURA FRAME, SUPPLIED BY THE RUN THAT NEEDS IT.
    # `cynghanedd draws`, `cynghanedd groes`, `cynghanedd groes o gyswllt` and
    # `leonine rhyme` all refuse without `frames.caesura`, and
    # `relations.search_caesura(stream)` COMPUTES it from the line itself —
    # it needs no declaration, no external table and no argument, unlike
    # `mark_refrain_tail`, whose rhyme-bearing subset a caller must declare.
    # So it is called here, once, only when an asked schema demands it, and
    # never when the stream already carries one: a caller who declared their
    # own caesura keeps it (doctrine 1 — the declaration wins).
    # MEASURED: `caesura` goes `absent` -> `present` and the four schemas go
    # from REFUSED to answering (three of them looked-and-none on an English
    # draft, which is the third answer and not a failure).
    if any("caesura" in (R.REGISTRY[n].capabilities() if n in R.REGISTRY
                         else ()) for n in asked) \
            and stream.supply("caesura").state != "present":
        R.search_caesura(stream)
    out, refused = {}, []
    for name in asked:
        sch = R.REGISTRY.get(name)
        if sch is None:
            refused.append({"schema": name, "kind": "unknown",
                            "detail": f"{name!r} is not in the registry"})
            continue
        res = R.realise(sch, stream)
        if isinstance(res, R.Refusal):
            if keep_refusals:
                refused.append({"schema": name, "kind": res.kind,
                                "missing": tuple(res.missing or ()),
                                "detail": res.detail})
            continue
        for inst in res:
            if inst.verdict is not True:
                continue
            a, b = _origin_line(inst.a), _origin_line(inst.b)
            if a is None or a != b:
                # A CROSS-LINE INSTANCE OF AN INTRA-LINE SCHEMA IS DROPPED
                # HERE, and it is not lost: `line_pairs_for` is the consumer
                # that keeps those. This module answers "what is IN this
                # line", so a span pair straddling a break is not its finding
                # even when the schema that produced it is intra-line by
                # placement (an unplaced member can still align across one).
                continue
            out.setdefault(a, []).append({
                "schema": name,
                "placement": _placements_of(name),
                "a": inst.a.origin, "b": inst.b.origin,
                "reads": tuple((c, i, r.value) for c, i, r in inst.reads),
            })
    return {"lines": out, "refused": refused, "asked": asked}


def _origin_line(span):
    """-> 1-based line number from a `Span.origin`, or None."""
    o = getattr(span, "origin", "") or ""
    if not o.startswith("L"):
        return None
    head = o.split(".", 1)[0][1:]
    return int(head) + 1 if head.isdigit() else None


def findings(stream, names=None):
    """The per-line figures as (line_no, code, message, evidence) tuples, in
    the shape `quality/revise.Finding` is built from.

    ONE FINDING PER (LINE, SCHEMA), carrying the instance COUNT, rather than
    one per instance. A line of four alliterating words yields six pairs and
    printing six identical notes under one line is the duplicate-findings
    shape BACKLOG 1.5 was about: it does not hide a finding, it hides the
    OTHER findings underneath it.
    """
    rep = line_figures(stream, names)
    out = []
    for line_no in sorted(rep["lines"]):
        per = {}
        for f in rep["lines"][line_no]:
            per.setdefault(f["schema"], []).append(f)
        for name in sorted(per):
            n = len(per[name])
            out.append((
                line_no, "LINE_FIGURE",
                f"L{line_no} carries {name!r} "
                f"({n} instance{'s' if n != 1 else ''})",
                f"an INTRA-LINE figure (placement "
                f"{', '.join(_placements_of(name)) or 'unplaced'}), reported "
                f"because it is a fact about this line and not because it is "
                f"a defect — whether the figure is wanted is the writer's "
                f"call (doctrine 7: a floor, not a ranking). No pair of lines "
                f"can stand in it, which is why the mandate layer refuses it "
                f"and this layer reads it."))
    for r in rep["refused"]:
        out.append((
            None, "LINE_FIGURE_REFUSED",
            f"{r['schema']!r} could not be looked for on this draft",
            f"{r.get('detail', '')} — REFUSED, not measured as zero "
            f"(doctrine 20): a figure nothing could look for and a figure "
            f"that is absent are different answers."))
    return out


__all__ = ["INTRA_LINE_PLACEMENTS", "intra_line_schemas", "line_figures",
           "findings"]


if __name__ == "__main__":
    from quality.phonology import get as _get
    draft = ["the silver salmon slipped the sullen stream",
             "a bitter better butter for the batter",
             "we lay all day beneath the burning sun",
             "the wheel keeps turning, yearning, ever burning"]
    st = R.build_stream(draft, _get("eng"), declaration={"language": "eng"})
    rep = line_figures(st)
    print(f"intra-line schemas in the registry: {len(intra_line_schemas())}")
    print(f"asked: {len(rep['asked'])}   lines with a figure: "
          f"{len(rep['lines'])}   refused: {len(rep['refused'])}\n")
    for ln in sorted(rep["lines"]):
        print(f"  L{ln}: {draft[ln - 1]}")
        seen = {}
        for f in rep["lines"][ln]:
            seen[f["schema"]] = seen.get(f["schema"], 0) + 1
        for k, v in sorted(seen.items()):
            print(f"        {k}  x{v}")
    if rep["refused"]:
        print("\n  REFUSED (capability the draft does not supply):")
        for r in rep["refused"]:
            print(f"        {r['schema']:34s} {r.get('missing', ())}")
