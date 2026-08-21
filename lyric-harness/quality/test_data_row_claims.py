#!/usr/bin/env python3
"""Regressions for the two gates that re-derive hand-kept numbers.

`check_data_rows.py` re-derives `data/sources.tsv`'s md5/bytes/rows claims
against the files they describe. `frequency.py --check` re-derives every
`n_types` that declares HOW.

WHAT IS PINNED HERE IS NOT THAT THEY PASS — it is that each rule which
SUPPRESSES a false positive is load-bearing, because a suppression rule that
does nothing is indistinguishable from one that works until the day it is
needed. The struck-text rule failed exactly that test on its first mutation
run: disabling it changed nothing, because `.search` happened to find the live
value before the struck one in every current row. It looked load-bearing and
was only lucky. `claims()` collects ALL matches and refuses on disagreement
now, and this file keeps that honest.

Run: python3 quality/test_data_row_claims.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import quality.check_data_rows as CDR  # noqa: E402
import quality.frequency as FQ  # noqa: E402

FAILURES = []


def check(name, ok, detail=""):
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if detail:
        print("          %s" % detail)
    if not ok:
        FAILURES.append(name)


def test_the_suppression_rules_are_load_bearing():
    print("\n1. every rule that suppresses a false positive does real work")

    # STRUCK — a doctrine-17 record of a superseded value is history, and the
    # repo's own convention for keeping history must not fail this gate.
    live_first = ("131,373 rows, 4,764,993 bytes. REPINNED from "
                  "~~46,860 rows, 1,627,624 bytes~~ when the table was "
                  "rebuilt.")
    found, _sk, amb = CDR.claims(live_first)
    check("a struck value is history, not a rival claim",
          found.get("rows") == 131373 and not amb, f"{found} {amb}")

    # ORDER MUST NOT MATTER. This is the case the first draft got right by
    # accident: with the strike written FIRST, a first-match reader would
    # have checked the superseded number and called it verified.
    struck_first = ("~~46,860 rows, 1,627,624 bytes~~ superseded; the table "
                    "now carries 131,373 rows, 4,764,993 bytes.")
    found2, _sk2, amb2 = CDR.claims(struck_first)
    check("...and it is history whichever ORDER it is written in",
          found2.get("rows") == 131373 and not amb2, f"{found2} {amb2}")

    # And with the strike removed, the two totals must CONFLICT rather than
    # one of them silently winning.
    both_live = "131,373 rows now, 46,860 rows before the rebuild."
    _f3, _s3, amb3 = CDR.claims(both_live)
    check("two unstruck totals REFUSE rather than one winning by position",
          len(amb3) == 1 and "stale" in amb3[0], str(amb3))

    # QUALIFIED md5 — the hash of the SOURCE, not of the staged artifact.
    q = "staged from upstream md5 370a7a55f79605b25638e3e262d5f920, fetched."
    found4, skipped4, _ = CDR.claims(q)
    check("an `upstream md5` is skipped, and the skip is REPORTED",
          "md5" not in found4 and len(skipped4) == 1, f"{found4} {skipped4}")

    # SUB-COUNTS — `13,797 rows carry a death year` is true of the same file.
    sub = ("13,997 data rows; 13,797 rows carry a death year, 478 a QID.")
    found5, _s5, amb5 = CDR.claims(sub)
    check("a restrictive sub-count is not a rival total",
          found5.get("rows") == 13997 and not amb5, f"{found5} {amb5}")


def test_the_row_rule_finds_the_header():
    print("\n2. the row rule locates the header instead of assuming it")
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        bare = os.path.join(d, "bare.tsv")
        with open(bare, "w", encoding="utf-8") as fh:
            fh.write("# a note\nword\tcount\na\t1\nb\t2\n")
        check("a BARE header line is not counted as data",
              CDR.data_rows(bare) == 2, str(CDR.data_rows(bare)))

        commented = os.path.join(d, "commented.tsv")
        with open(commented, "w", encoding="utf-8") as fh:
            fh.write("# a note\n#word\tcount\na\t1\nb\t2\n")
        check("a COMMENTED header is not counted twice — the off-by-one that "
              "made this gate accuse a correct row on its first run",
              CDR.data_rows(commented) == 2, str(CDR.data_rows(commented)))


def test_n_types_is_derivable_or_says_it_is_not():
    print("\n3. n_types re-derives, or names itself unchecked")
    declared = [c for c in FQ.LAYER.declared()
                if FQ.LAYER._sources[c].n_types_from]
    check("at least one source declares HOW its n_types is derived — with "
          "none, the check below would pass on an empty population",
          bool(declared), str(declared))
    for cell in declared:
        src = FQ.LAYER._sources[cell]
        kind, _, rel = src.n_types_from.partition(":")
        check("%s declares a known derivation kind" % cell,
              kind in ("rows", "distinct0"), kind)
        check("%s names a file that exists" % cell,
              os.path.exists(os.path.join(HERE, "..", rel)), rel)
    unchecked = [c for c in FQ.LAYER.declared()
                 if not FQ.LAYER._sources[c].n_types_from]
    check("the sources with no derivation are REPORTED, not silently passed "
          "(doctrine 20)", len(unchecked) > 0 and
          FQ.check_n_types(open(os.devnull, "w")) == 0,
          "%d unchecked: %s" % (len(unchecked), ", ".join(sorted(unchecked))))


def main():
    test_the_suppression_rules_are_load_bearing()
    test_the_row_rule_finds_the_header()
    test_n_types_is_derivable_or_says_it_is_not()
    print("\n" + "=" * 62)
    if FAILURES:
        print("%d FAILING: %s" % (len(FAILURES), ", ".join(FAILURES)))
        return 1
    print("the hand-kept numbers re-derive, and every suppression rule earns "
          "its place")
    return 0


if __name__ == "__main__":
    sys.exit(main())
