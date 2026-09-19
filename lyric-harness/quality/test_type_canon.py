#!/usr/bin/env python3
"""Regressions for M-35's INTERIM GATE — the `type` namespace's canon join.

The ruling of 2026-09-18 said the grader should read
`relations.tradition_scope` "rather than growing a second vocabulary". This
suite pins the measurement that says the route does not reach the firing path,
and pins the two inheritance shortcuts that DO reach it as WRONG — because both
produce an answer, and a wrong answer here reads exactly like a right one.

Sections:
  1  totality is the gate: every type name is ruled, and `--check` says so
  2  every citation resolves, and against the RIGHT table
  3  the cell route would flatten, measured on its own worst case
  4  the `aka=` route would flatten, measured on `higaad`
  5  M-44's open items get the verdict the entry asks for
  6  a name inside its own tradition is SILENT, not labelled
  7  all four scope values are reachable, so none is a value that isn't real
  8  an unruled name RAISES, and the mutations red the check

WHY §3 AND §4 ARE MUTATIONS OF A THING THAT WAS NEVER BUILT. Neither shortcut
ships; both were measured and refused. A test that only asserted the shipped
behaviour would pass just as happily against a build that took either one, so
each section CONSTRUCTS the shortcut's answer and requires it to differ from
what ships. That is the only shape that proves the refusal is load-bearing.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import type_canon as TC                           # noqa: E402
from quality import rhyme_types as RT                          # noqa: E402
from quality import relations as RL                            # noqa: E402
from quality import canon_sources as CS                        # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_totality():
    print("\n1. totality is the gate")
    vocab = set(RT.namespaced_vocabulary()["type"])
    ruled = set(TC.SOURCED) | set(TC.UNSOURCED)
    check("every name in the `type` namespace is ruled — sourced or refused "
          "in writing, with no third state that ships empty",
          vocab <= ruled, f"{len(vocab)} names, {len(vocab - ruled)} unruled")
    check("nothing is ruled twice",
          not (set(TC.SOURCED) & set(TC.UNSOURCED)))
    check("nothing is ruled here that is not a type name",
          not (ruled - vocab), f"stray: {sorted(ruled - vocab)[:4]}")
    check("the three counts partition the namespace (a partition is the one "
          "place a sum is correct — doctrine 79)",
          len(set(TC.SOURCED) & vocab) + len(set(TC.UNSOURCED) & vocab)
          + len(vocab - ruled) == len(vocab))
    check("`--check` agrees with all of the above and exits 0",
          TC.check() == 0)


def test_citations_resolve_against_the_right_table():
    print("\n2. every citation resolves, and against the RIGHT table")
    idx = CS.index()
    cited = {e for n in TC.SOURCED for e in TC.entries(n)}
    check("the module is not empty of citations, asserted BEFORE the check "
          "that walks them — `all()` over nothing is True and reads exactly "
          "like a check that examined something",
          len(cited) > 40, f"{len(cited)} distinct canon entries cited")
    check("every cited id is a row of the 601-entry inventory",
          all(e in idx for e in cited),
          f"missing: {sorted(e for e in cited if e not in idx)[:5]}")
    # THE TWO-TABLES DEFECT, REPRODUCED AS A CONTROL. `relations.CANON` is the
    # 61 RELATION records, each LISTING inventory indices; these ids ARE the
    # indices. The first draft of the module read CANON and reported all 67 of
    # its own citations as bad, which is this module's own subject one layer
    # in. If the two tables ever agreed, this check would be vacuous.
    check("`relations.CANON` is a DIFFERENT table and reading it would fail "
          "the citations — the first draft's own defect, kept as a control",
          not (cited <= set(RL.CANON)),
          f"CANON has {len(RL.CANON)} relation records, not inventory rows")


def test_the_cell_route_would_flatten():
    print("\n3. the cell route would flatten, on its own worst case")
    cell = next(c for c, names in RT.NAMED.items()
                if "qafiya" in names and "masculine rhyme" in names)
    names = RT.NAMED[cell]
    check("the premise: `qafiya` and `masculine rhyme` ARE one NAMED cell, so "
          "a cell is multi-tradition by construction (M-35's own thesis)",
          "qafiya" in names and "masculine rhyme" in names, f"{names}")
    inherited = {l for n in names for l in TC.languages(n)}
    check("the shortcut's answer: inheriting the cell's union puts `eng` on "
          "`qafiya`", "eng" in inherited, f"union = {sorted(inherited)}")
    check("so the shortcut would report a Persian name IN TRADITION on an "
          "English draft — the cross-tradition firing the gate exists to "
          "label, silenced",
          "eng" in inherited and "eng" not in TC.languages("qafiya"))
    check("what SHIPS does not inherit: `qafiya` on an English draft is "
          "rule_shape and carries a label",
          TC.scope("qafiya", "eng") == "rule_shape"
          and TC.label("qafiya", "eng") is not None)


def test_the_aka_route_would_flatten():
    print("\n4. the `aka=` route would flatten, on `higaad`")
    owner = [n for n, s in RL.REGISTRY.items()
             if "higaad" in (getattr(s, "aka", None) or ())]
    check("the premise: `higaad` reaches a schema through `aka=`",
          owner == ["alliteration"], f"{owner}")
    langs = {l for _, l in RL._SOURCED.get(owner[0], ((), ()))[1]} if owner \
        else set()
    check("the shortcut's answer: that schema's sourced languages do not "
          "include Somali, so `higaad` would be attested in languages that "
          "are not its own",
          langs and "som" not in langs, f"{sorted(langs)}")
    check("what SHIPS refuses instead, and the reason names the error",
          TC.scope("higaad", "eng") == "unsourced"
          and "gabay higaad" in TC.UNSOURCED["higaad"])
    check("and the refusal is grounded in a measurement, not a preference: "
          "the 601 carries no Somali row at all",
          not [r for r in CS.index().values()
               if "somali" in r["tradition"].lower()])


def test_m44_open_items():
    print("\n5. M-44's open items get the verdict the entry asks for")
    for name, home in (("adalhending", "non"),
                       ("dvitiyakshara-prasa", "kan")):
        check(f"{name!r} on an English draft is rule_shape — the rule shape "
              f"matched, the tradition did not (doctrine 43)",
              TC.scope(name, "eng") == "rule_shape")
        lab = TC.label(name, "eng")
        check(f"{name!r}'s label NAMES the tradition and the entry it comes "
              f"from, so the reader is not left to guess",
              lab and home in lab and TC.entries(name)[0] in lab, lab)
        check(f"{name!r} inside its own tradition is in_tradition",
              TC.scope(name, home) == "in_tradition")


def test_in_tradition_is_silent():
    print("\n6. a name inside its own tradition is SILENT")
    silent = [(n, l) for n in TC.SOURCED for l in TC.languages(n)]
    check("the population is not empty, asserted before the walk",
          len(silent) > 50, f"{len(silent)} (name, language) pairs")
    check("every one of them labels None — a caller prints a line exactly "
          "when the ordinary reading would be wrong",
          all(TC.label(n, l) is None for n, l in silent))
    check("and every one of them scopes in_tradition",
          all(TC.scope(n, l) == "in_tradition" for n, l in silent))


def test_every_scope_value_is_reachable():
    print("\n7. all four scope values are reachable")
    seen = {TC.scope(n, l) for n in TC.SOURCED for l in RL.LANG_CELL}
    seen |= {TC.scope(n, "eng") for n in TC.UNSOURCED}
    check("the scope vocabulary is `relations.SCOPES` and not a second one",
          set(RL.SCOPES) == {"in_tradition", "cell_cited", "rule_shape",
                             "unsourced"})
    for v in RL.SCOPES:
        check(f"{v!r} is reachable on this tree — a value nothing can reach "
              f"is a value that is not real (doctrine 48)", v in seen)


def test_unruled_raises_and_mutations_red():
    print("\n8. an unruled name RAISES, and the mutations red the check")
    try:
        TC.scope("not a relation this tree names", "eng")
        check("an unruled name raises rather than answering", False)
    except KeyError as e:
        check("an unruled name raises rather than answering — a name this "
              "table never ruled on is not a name with no tradition",
              "no ruling" in str(e))
    # MUTATION A: a name added to the vocabulary with no ruling.
    live = dict(TC.SOURCED)
    dropped = "masculine rhyme"
    del TC.SOURCED[dropped]
    check("dropping one ruling makes `--check` red (totality is enforced, "
          "not described)", TC.check() == 3)
    TC.SOURCED.clear()
    TC.SOURCED.update(live)
    # MUTATION B: a citation that names no canon row.
    TC.SOURCED["masculine rhyme"] = (("E9999",), ("eng",))
    check("a citation naming no canon row makes `--check` red",
          TC.check() == 3)
    TC.SOURCED.clear()
    TC.SOURCED.update(live)
    # MUTATION C: ruled in both tables.
    TC.UNSOURCED["masculine rhyme"] = "planted"
    check("a name ruled twice makes `--check` red", TC.check() == 3)
    del TC.UNSOURCED["masculine rhyme"]
    check("every mutation is restored and the real check passes again",
          TC.check() == 0)


def main():
    for fn in (test_totality,
               test_citations_resolve_against_the_right_table,
               test_the_cell_route_would_flatten,
               test_the_aka_route_would_flatten,
               test_m44_open_items,
               test_in_tradition_is_silent,
               test_every_scope_value_is_reachable,
               test_unruled_raises_and_mutations_red):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
