#!/usr/bin/env python3
"""Regressions for the SERIES SHAPE census (`MISSING.md` H-3, first item).

H-3 asked for clichéd section orders and the phrase had no measurement behind
it. The census answers it on the only population that can answer it, and this
suite pins the two things that make the answer honest: that the population is
`song_record.songs()` rather than a second glob, and that the duplicate groups
are real rather than an artefact of stripping instance digits.

Sections:
  1  the population is the register's own, not a second definition
  2  the counts partition, and the census is not empty
  3  the duplicate groups are REAL — verified against the raw marks
  4  instance digits are stripped for FUNCTIONS and kept in RAW
  5  PINNED drift reds `--check`, and an unknown flag refuses
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import song_shape as SS                         # noqa: E402
from quality import song_record as SR                        # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_population_is_the_registers_own():
    print("\n1. the population is `song_record.songs()`, not a second glob")
    c = SS.census()
    want = {os.path.basename(p) for p in SR.songs()}
    got = {r["song"] for r in c["rows"]}
    check("every delivered song is censused and nothing else is",
          got == want, f"{len(got)} songs")
    # MUTATION: a census that built its own file list would not move when the
    # register's definition moves. Shrink the register's answer and require
    # the census to follow it.
    real = SR.songs
    try:
        SR.songs = lambda: real()[:3]
        check("shrinking `song_record.songs()` shrinks the census — the "
              "census READS that definition rather than re-deriving one",
              SS.census()["songs"] == 3)
    finally:
        SR.songs = real
    check("and the real census is restored", SS.census()["songs"] == len(want))


def test_counts_partition():
    print("\n2. the counts partition, and the census is not empty")
    c = SS.census()
    check("the census is not empty, asserted BEFORE anything that walks it — "
          "every aggregate below is vacuously true over nothing",
          c["songs"] > 0 and c["rows"], f"{c['songs']} songs")
    seqs = [r["functions"] for r in c["rows"]]
    check("distinct == the number of distinct section orders",
          c["distinct"] == len(set(seqs)), f"{c['distinct']}")
    check("duplicate_groups counts ORDERS shared by 2+ songs, never songs",
          c["duplicate_groups"] == len(c["duplicates"])
          and all(len(v) > 1 for v in c["duplicates"].values()))
    check("distinct <= songs, with equality exactly when nothing is shared",
          c["distinct"] <= c["songs"]
          and ((c["distinct"] == c["songs"]) == (c["duplicate_groups"] == 0)))
    check("functions_used equals the inventory's key count",
          c["functions_used"] == len(c["inventory"]))


def test_duplicates_are_real():
    print("\n3. the duplicate groups are REAL, not a stripping artefact")
    c = SS.census()
    check("there is at least one duplicate group to examine — without this "
          "the checks below pass over an empty list", c["duplicates"])
    for seq, names in c["duplicates"].items():
        raws = []
        for n in names:
            row = next(r for r in c["rows"] if r["song"] == n)
            raws.append(row["raw"])
            check(f"{n}: its FUNCTION sequence is the group's key",
                  row["functions"] == seq)
        check(f"{', '.join(names)}: the RAW marks are identical too, so the "
              f"shared order is not an artefact of stripping instance digits",
              len(set(raws)) == 1, f"{raws[0]}")


def test_instance_digits():
    print("\n4. instance digits are stripped for FUNCTIONS, kept in RAW")
    c = SS.census()
    withidx = [r for r in c["rows"]
               if any(m != f for m, f in zip(r["raw"], r["functions"]))]
    check("some song carries an instance index — asserted before the claim "
          "that the two coordinates differ", withidx,
          f"{len(withidx)} of {c['songs']} songs")
    r = withidx[0]
    check("RAW keeps the index and FUNCTIONS drops it, so `[VERSE1] [VERSE2]` "
          "and `[VERSE1] [VERSE1]` share a function order and differ in raw",
          r["raw"] != r["functions"],
          f"{r['song']}: raw {r['raw'][:3]} vs fns {r['functions'][:3]}")
    check("stripping never empties a name",
          all(f for r in c["rows"] for f in r["functions"]))


def test_drift_and_refusal():
    print("\n5. PINNED drift reds `--check`, and an unknown flag refuses")
    check("the real census matches PINNED", SS.check() == 0)
    live = dict(SS.PINNED)
    try:
        SS.PINNED["distinct"] = live["distinct"] + 1
        check("a moved count exits 3 — the series moving is an ANSWER, "
              "reported, never a failure charged to a song", SS.check() == 3)
    finally:
        SS.PINNED.clear()
        SS.PINNED.update(live)
    check("restored, and green again", SS.check() == 0)
    check("an unrecognised flag REFUSES at 2 rather than being ignored "
          "(doctrine 20)", SS.main(["--nope"]) == 2)
    check("the bare census exits 0", SS.main([]) == 0)


def main():
    for fn in (test_population_is_the_registers_own,
               test_counts_partition,
               test_duplicates_are_real,
               test_instance_digits,
               test_drift_and_refusal):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
