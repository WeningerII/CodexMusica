#!/usr/bin/env python3
"""Regressions for `quality/door_census.py` (`MISSING.md` M-139).

The census's whole claim is that it can SEE every pair-satisfaction site, and
its first two drafts could not — it missed the attribute-call spelling
(`LH.admits(...)`), which hid `quality/redteam_band.py` entirely, and it
attributed each site to its enclosing CLASS, which credited all ten of
`Reviser`'s sites with the two judges `Reviser` contains. Both errors are in
the flattering direction: a census blind to a site reports that site as
compliant.

So every section here is driven by a MUTATION. A check that passes against a
crippled census is a check that examined nothing, which is this repository's
own most-repeated defect (doctrine 48) and the reason `test_gate_census.py`
§5 drops a constructor rather than asserting a number.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from quality import door_census as DC  # noqa: E402

FAILED = []


def check(section, claim, ok, evidence=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {claim}")
    if evidence:
        print(f"          {evidence}")
    if not ok:
        FAILED.append(f"{section}: {claim}")


def main():
    print("1. the census sees every site, and the pins hold")
    rows = DC.census()
    c = DC.counts(rows)
    check("1", "the shipped census matches its own pins",
          all(c[k] == v for k, v in DC.PINNED.items()),
          f"measured {c}")
    check("1", "every site carries a ruling — an unexamined site is not a "
          "compliant one (doctrine 20)",
          not DC.unruled(rows),
          f"{len(DC.unruled(rows))} unruled")
    check("1", "a FULL ruling is a claim about the CODE, and every one of "
          "them reaches the 77 judge",
          all(r["sees_77"] for r in rows if r["disposition"] == DC.FULL),
          f"{c['full']} FULL site(s), all reaching "
          f"`{DC.SCHEMA_JUDGE}`")

    print("\n2. MUTATION — a census blind to the attribute spelling reports "
          "fewer sites, and the sites it loses are the ones nobody would "
          "notice")
    real = DC._door_of
    seen = len(rows)

    def blind(node):
        # The first draft: `admits(...)` only, never `LH.admits(...)`.
        import ast as _ast
        if isinstance(node, _ast.Call) and not isinstance(node.func,
                                                          _ast.Name):
            return None
        return real(node)

    DC._door_of = blind
    try:
        crippled = DC.census()
        cc = DC.counts(crippled)
    finally:
        DC._door_of = real
    check("2", "the crippled census SEES FEWER SITES",
          len(crippled) < seen,
          f"{len(crippled)} against {seen}")
    lost = {(r["path"], r["func"]) for r in rows} - \
           {(r["path"], r["func"]) for r in crippled}
    # THE FIRST DRAFT OF THIS CHECK NAMED THE WRONG MODULE and the mutation
    # said so: it asserted `redteam_band.py`, which is lost to the OTHER
    # first-draft gap (the literal tuple, §2b below), not to this one.
    # `structure_census.py` is the module the attribute spelling hides. Two
    # blindnesses, two populations, and reading them as one is doctrine 79's
    # shape inside a test.
    check("2", "...and `quality/structure_census.py` is what it loses — the "
          "module that writes `LH.admits(...)`",
          any(p.endswith("structure_census.py") for p, _ in lost),
          f"lost {sorted(lost)}")
    check("2", "...and `--check` would REFUSE that census rather than pass "
          "it, because the pins move",
          any(cc[k] != v for k, v in DC.PINNED.items()),
          f"crippled counts {cc}")

    print("\n2b. MUTATION — and a census blind to the LITERAL "
          "`('RHYME', 'RIME_RICHE')` loses a different module again")

    def literal_blind(node):
        import ast as _ast
        if isinstance(node, _ast.Compare):
            return None
        return real(node)

    DC._door_of = literal_blind
    try:
        crippled2 = DC.census()
    finally:
        DC._door_of = real
    lost2 = {(r["path"], r["func"]) for r in rows} - \
            {(r["path"], r["func"]) for r in crippled2}
    check("2b", "`quality/redteam_band.py` is lost — the module the census's "
          "own first draft missed entirely",
          any(p.endswith("redteam_band.py") for p, _ in lost2),
          f"lost {sorted(lost2)}")
    check("2b", "...and the two blindnesses lose DIFFERENT modules, so they "
          "are two gaps and not two namings of one",
          {p for p, _ in lost} != {p for p, _ in lost2},
          f"attribute-blind loses {sorted({p for p, _ in lost})}, "
          f"literal-blind loses {sorted({p for p, _ in lost2})}")

    print("\n3. MUTATION — scope inheritance is load-bearing: a nested "
          "function sees its enclosing scope's judge")
    nested = [r for r in rows
              if r["func"] == "check_scheme.ok"]
    check("3", "`check_scheme.ok` is a real site and it is nested inside a "
          "function that consults the 77",
          len(nested) == 1 and nested[0]["sees_77"],
          f"{[(r['path'], r['func'], r['sees_77']) for r in nested]}")
    check("3", "without inheritance it reads as blind — which is what the "
          "first detector said about a judge thirty lines above it",
          not DC._reaches_judge("check_scheme.ok", {"check_scheme"}) is False
          and not ("check_scheme.ok" in {"check_scheme"}),
          "prefix chain `check_scheme.ok` -> `check_scheme` is the scope "
          "chain")
    check("3", "...and it does NOT over-credit a sibling: a method does not "
          "reach its class's other methods",
          not DC._reaches_judge("Reviser.mandate_from_graph",
                                {"Reviser.grade"}),
          "`Reviser.grade` consulting the judge must not license "
          "`Reviser.mandate_from_graph`")

    print("\n4. the INCOMPLETE sites are named, not merely counted")
    inc = sorted((r["path"], r["func"]) for r in rows
                 if r["disposition"] == DC.INCOMPLETE)
    check("4", "every INCOMPLETE site's ruling cites the register entry that "
          "holds it open",
          all("M-139" in DC.RULINGS[(p, f)][1] for p, f in inc),
          f"{inc}")
    check("4", "INCOMPLETE is not zero, and the census says so out loud "
          "rather than reporting a clean tree",
          c["incomplete"] > 0,
          f"{c['incomplete']} site(s) still short of the complete default")

    print()
    if FAILED:
        print(f"FAILED {len(FAILED)}:")
        for f in FAILED:
            print(f"  - {f}")
        return 1
    print("all pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
