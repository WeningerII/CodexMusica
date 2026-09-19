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
import contextlib
import io
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


def test_the_seed_is_read_and_refused_not_guessed():
    print("\n6. the seed is READ from the log, and its absence REFUSES")
    c = SS.census()
    seeds = {r["song"]: r["seed"] for r in c["rows"]}
    check("every row carries a seed coordinate, present or REFUSED",
          len(seeds) == c["songs"])
    missing = [n for n, v in seeds.items() if v is None]
    check("a song whose log declares no seed comes back None — a REFUSAL, "
          "never a zero and never a guess (doctrine 20)",
          len(missing) == c["seeds_missing"] and missing == ["oar_lair.txt"],
          f"missing: {missing}")
    # THE READER IS NOT A DERIVER. Re-running `make_plan` at HEAD answers a
    # DIFFERENT question, because a plan is a pure function of its seed AND
    # the planner's code, and the planner has moved since these songs were
    # written. Measured rather than argued: seed 1 at HEAD produces a section
    # order that neither seed-1 song has.
    from quality import plan as PL
    at_head = tuple(s.get("function") for s in PL.make_plan(seed=1)["sections"])
    seed1 = [r["functions"] for r in c["rows"] if r["seed"] == "1"]
    check("re-deriving at HEAD is NOT how this is answered — seed 1 at HEAD "
          "gives an order neither seed-1 song has, so the log is read and "
          "the planner is not re-run",
          seed1 and all(at_head != f for f in seed1),
          f"HEAD {'-'.join(str(x) for x in at_head)}")


def test_the_duplicate_orders_are_confounded_by_the_seed():
    print("\n7. the shared orders are shared DRAWS — the confound, measured")
    c = SS.census()
    seed_of = {r["song"]: r["seed"] for r in c["rows"]}
    # This is the section that corrects H-3's first item. A shared section
    # order reads as a fact about two songs; where both songs declare ONE
    # seed it is a fact about one draw. Asked of each group, never summed.
    per_group = []
    for names in c["duplicates"].values():
        ss = {seed_of.get(n) for n in names}
        per_group.append(len(ss) == 1 and None not in ss)
    check("EVERY duplicate section order is a duplicate SEED — 2 of 2, so "
          "neither is independent evidence about craft",
          per_group and all(per_group)
          and c["orders_confounded_by_seed"] == len(c["duplicates"]),
          f"{c['orders_confounded_by_seed']} of {len(c['duplicates'])}")
    check("and the seed duplicates are exactly the order duplicates, not "
          "merely as many — the correspondence is on MEMBERSHIP",
          {tuple(v) for v in c["seed_duplicates"].values()}
          == {tuple(v) for v in c["duplicates"].values()},
          f"seeds {sorted(c['seed_duplicates'].values())}")
    check("the report SAYS so rather than leaving a reader to notice — the "
          "word CONFOUNDED appears once per confounded group",
          SS.report(c).count("CONFOUNDED") == c["orders_confounded_by_seed"])
    # THE MUTATION. With the seeds erased the confound is unsayable and the
    # report falls back to its old reading, so this section is proven able to
    # fail against the census as it shipped in PR 350.
    blind = dict(c)
    blind["rows"] = [dict(r, seed=None) for r in c["rows"]]
    check("MUTATION — with the seed erased the report states no confound, "
          "which is exactly what the pre-seed census said",
          "CONFOUNDED" not in SS.report(blind),
          "the pre-seed reading is recoverable, so the coordinate is "
          "load-bearing")


def test_the_hook_is_a_fact_and_its_provenance_is_refused():
    print("\n8. the hook census — a fact, and a refusal beside it")
    h = SS.hook_census()
    check("the three counts partition the series and are never summed with "
          "each other (doctrine 79)",
          h["declared"] + h["undeclared"] == h["songs"] == 16,
          f"{h['declared']} declared + {h['undeclared']} undeclared "
          f"= {h['songs']}")
    check("NO song's hook phrase reaches a second section function — a "
          "property of what was written, measured over every occurrence",
          h["spread_over_functions"] == 0)
    check("and `where` therefore accounts for every song that declares one",
          sum(h["where"].values()) == h["declared"],
          f"{h['where']}")
    # THE REFUSAL IS THE POINT. The current planner DERIVES `hook_slot`, so a
    # census of hook placement would be a census of the planner's own draw --
    # but that reasoning does not reach THIS population, and saying it did
    # would be crediting a mechanism the artifacts cannot show.
    check("PROVENANCE REFUSED — `hook_slot` is in 0 of 16 committed "
          "blueprints, so whether a hook position was DRAWN or CHOSEN is "
          "not recoverable and is not attributed either way",
          h["blueprints_with_hook_slot"] == 0)
    check("the report states the refusal rather than printing a bare "
          "distribution a reader would take for craft",
          "PROVENANCE REFUSED" in SS.report())
    # `check()` prints the whole census; swallow it so this suite's own
    # output stays readable. The RETURN CODE is what is being asserted.
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = SS.check()
    check("nothing here fails a song — the census has no verdict column and "
          "`--check` gates the COUNTS only (doctrine 7/96)", rc == 0)

def main():
    for fn in (test_population_is_the_registers_own,
               test_counts_partition,
               test_duplicates_are_real,
               test_instance_digits,
               test_drift_and_refusal,
               test_the_seed_is_read_and_refused_not_guessed,
               test_the_duplicate_orders_are_confounded_by_the_seed,
               test_the_hook_is_a_fact_and_its_provenance_is_refused):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
