#!/usr/bin/env python3
"""Regressions for `quality/figure_exhibits.py` — the intra-line evidence route.

WHAT IS PINNED, AND WHY EACH IS THE KIND OF THING THAT ROTS

1. The route covers exactly the intra-line schemas that have no other
   evidence, and nothing else. The roster is DERIVED (`figures.
   intra_line_schemas()`), so a schema whose placement is edited cannot fall
   out of the evidence path in silence.
2. Every exhibit is graded under the phonology of the registry Tradition row
   it names, and that phonology ships. English is never the fallback.
3. Every witness or contrast that cites a repo file is VERBATIM that file's
   line(s). A cite that stops matching is a cite to text nobody can find.
4. Every recorded FINDING still measures at the verdicts it was written at.
   When the grader moves, this goes red rather than the prose going stale
   (doctrine 17).
5. The two cywydd-wide counts quoted in the findings re-derive.
6. The census row for each covered schema is this module's row, and
   `witness_and_contrast` is reachable only through [True, False].
7. MUTATIONS: swapping an earned exhibit's witness and contrast, or pointing a
   witness at a line without the figure, turns its row `unvalidated`. A gate
   that cannot fail reads exactly like one that passes (doctrine 94).

Run: python3 quality/test_figure_exhibits.py
"""

import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import figure_exhibits as FE                   # noqa: E402
from quality import figures as F                            # noqa: E402
from quality import relations as R                          # noqa: E402
from quality.phonology import get as get_phonology          # noqa: E402

ROOT = os.path.join(HERE, "..")
FAILURES = []

#: The schemas this route certifies today. A regression pin, not a target:
#: a name leaving it is a grader change to explain, a name joining it needs a
#: finding struck (doctrine 17/58).
EARNED = ["Kalevala alliteration (strong)", "Kalevala alliteration (weak)",
          "ablaut reduplication", "alliteration", "alliterative long line",
          "cynghanedd groes", "cynghanedd lusg", "cynghanedd sain",
          "cynghanedd sain drosgl", "cynghanedd sain gadwynog", "epanalepsis", "exact reduplication",
          "leonine rhyme", "rhyming reduplication"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_roster():
    print("\n1. the route covers the intra-line schemas with no other evidence")
    intra = set(F.intra_line_schemas())
    cov = FE.covered()
    check("every covered name is intra-line by its own declared placement",
          cov <= intra, sorted(cov - intra))
    # `paroemion` is the one intra-line schema carrying a production
    # regression witness already (schema_census's regression list).
    check("every intra-line schema is covered here or by paroemion's "
          "regression witness",
          intra - cov == {"paroemion"}, sorted(intra - cov))
    check("no name is both exhibited and declared exhibit-less",
          not set(FE.FIGURE_EXHIBITS) & set(FE.NO_EXHIBIT))


def test_phonology_is_the_traditions():
    print("\n2. each exhibit is graded under its named tradition's language")
    for name, ex in sorted(FE.FIGURE_EXHIBITS.items()):
        trads = {t.name: t.lang for t in R.REGISTRY[name].traditions}
        ok = trads.get(ex["tradition"]) == ex["lang"]
        try:
            get_phonology(ex["lang"])
            ships = True
        except Exception:
            ships = False
        check(f"{name}: '{ex['tradition']}' is {ex['lang']} and it ships",
              ok and ships, f"registry says {trads.get(ex['tradition'])!r}")
    # The fourth-lift reason stands only while Old English has no phonology.
    try:
        get_phonology("ang")
        ang = True
    except Exception:
        ang = False
    check("the fourth-lift NO_EXHIBIT reason is still true: no `ang` "
          "phonology ships", not ang)


def _cited_text(cite):
    kind, where = cite
    if kind == "joined":
        path, nums = where
    elif kind in ("constructed", "quoted"):
        return None
    else:
        path, nums = kind, where
    rows = open(os.path.join(ROOT, path), encoding="utf-8").read().splitlines()
    return [rows[n - 1] for n in nums], kind == "joined"


def test_cites_are_verbatim():
    print("\n3. every file cite is verbatim the cited line(s)")
    n = 0
    for name, ex in sorted(FE.FIGURE_EXHIBITS.items()):
        for role in ("witness", "contrast"):
            lines, cite, _ = ex[role]
            got = _cited_text(cite)
            if got is None:
                continue
            rows, joined = got
            want = [" ".join(r.strip() for r in rows)] if joined else rows
            n += 1
            check(f"{name} {role} matches {cite[0] if not joined else cite[1][0]}",
                  [l.strip() for l in lines] == [w.strip() for w in want],
                  f"{lines!r} vs {want!r}")
    check("and the section examined something", n >= 15, f"{n} cites")


def test_findings_are_not_stale():
    print("\n4. every recorded finding still measures at its verdicts")
    for name, f in sorted(FE.FINDINGS.items()):
        live, _ = FE.grade_exhibit(name)
        check(f"{name}: recorded {list(f['verdicts'])}, live {live}",
              live == list(f["verdicts"]))
        row = FE.semantic_row(name)
        check(f"{name}: the census blocker QUOTES the finding, not a stale note",
              row["blocker"].startswith("FINDING"), row["blocker"][:80])


def test_cywydd_counts():
    print("\n5. the cywydd-wide counts the findings quote re-derive")
    live = FE.cywydd_counts()
    for n, want in FE.CYWYDD_COUNTS.items():
        check(f"{n}: {want[0]} of {want[1]} lines", live[n] == want, live[n])
    txt = FE.FIGURE_EXHIBITS["cynghanedd sain drosgl"]["contrast"][2]
    check("the sain-drosgl contrast note quotes the pinned count",
          f"{FE.CYWYDD_COUNTS['cynghanedd sain drosgl'][0]} of the cywydd's "
          f"{FE.CYWYDD_COUNTS['cynghanedd sain drosgl'][1]}" in txt)


def test_census_reads_this_route():
    print("\n6. the census row is this route's, and the status rule holds")
    from quality import schema_census as CEN
    rep = CEN.census()["semantic_status"]
    for name in sorted(FE.covered()):
        mine = FE.semantic_row(name)
        check(f"{name}: census row == figure_exhibits row",
              rep[name] == mine, f"{rep[name].get('status')}")
    earned = sorted(n for n in FE.covered()
                    if rep[n]["status"] == "witness_and_contrast")
    check("the earned set is the pinned one", earned == sorted(EARNED),
          f"{earned}")
    check("every earned row graded exactly [True, False]",
          all(rep[n]["verdicts"] == [True, False] for n in earned))
    # The census prints witness_and_contrast split by evidence route, so the
    # figures reader (which revise.py never calls) is never read as the
    # production grade route. The split must partition the total, put
    # exactly this file's earned set on the figures route, and leave a row
    # it cannot place UNATTRIBUTED rather than in either route.
    wr = CEN.witness_routes(rep)
    total = sum(1 for r in rep.values() if r["status"] == "witness_and_contrast")
    check("the figures route holds exactly this file's earned set",
          sorted(sum(wr[CEN.ROUTE_FIGURES].values(), [])) == sorted(EARNED),
          f"{wr[CEN.ROUTE_FIGURES]}")
    check("the routes partition the witness total, none unattributed",
          not wr[CEN.ROUTE_NONE]
          and sum(len(v) for t in wr.values() for v in t.values()) == total,
          f"{ {r: sum(map(len, t.values())) for r, t in wr.items()} } of {total}")
    fake = dict(rep, x={"status": "witness_and_contrast",
                        "evidence": "hand-typed route"})
    wr2 = CEN.witness_routes(fake)
    check("a row on neither route is unattributed, not folded into one",
          wr2[CEN.ROUTE_NONE] == {"hand-typed": ["x"]}
          and "x" not in sum(wr2[CEN.ROUTE_GRADE].values(), []),
          f"{wr2[CEN.ROUTE_NONE]}")


def test_mutations():
    print("\n7. MUTATIONS — the gate can fail")
    saved = copy.deepcopy(FE.FIGURE_EXHIBITS)
    try:
        ex = FE.FIGURE_EXHIBITS["cynghanedd sain"]
        ex["witness"], ex["contrast"] = ex["contrast"], ex["witness"]
        row = FE.semantic_row("cynghanedd sain")
        check("swapping witness and contrast -> unvalidated [False, True]",
              row["status"] == "unvalidated"
              and row["verdicts"] == [False, True], row.get("verdicts"))
        FE.FIGURE_EXHIBITS.update(copy.deepcopy(saved))
        ex = FE.FIGURE_EXHIBITS["alliteration"]
        ex["witness"] = ex["contrast"]
        row = FE.semantic_row("alliteration")
        check("a witness without the figure -> unvalidated, and the blocker "
              "says no finding is recorded",
              row["status"] == "unvalidated"
              and "no finding is recorded" in row["blocker"], row["blocker"])
        FE.FIGURE_EXHIBITS.update(copy.deepcopy(saved))
        rec = FE.FINDINGS["平仄 tonal template"]["verdicts"]
        FE.FINDINGS["平仄 tonal template"]["verdicts"] = (True, False)
        row = FE.semantic_row("平仄 tonal template")
        check("a finding whose verdicts moved is reported STALE, not quoted",
              "STALE" in row["blocker"], row["blocker"][:80])
        FE.FINDINGS["平仄 tonal template"]["verdicts"] = rec
    finally:
        FE.FIGURE_EXHIBITS.clear()
        FE.FIGURE_EXHIBITS.update(saved)
    check("every mutation is restored",
          FE.semantic_row("cynghanedd sain")["status"]
          == FE.semantic_row("alliteration")["status"]
          == "witness_and_contrast")


def main():
    for fn in (test_roster, test_phonology_is_the_traditions,
               test_cites_are_verbatim, test_findings_are_not_stale,
               test_cywydd_counts, test_census_reads_this_route,
               test_mutations):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
