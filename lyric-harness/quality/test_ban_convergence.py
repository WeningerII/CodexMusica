#!/usr/bin/env python3
"""Regressions for `quality/ban_convergence.py` (C18 / M-168, 2026-09-02).

Sections:
  1  the population — the bank `song_record.py` banks, and where each
     song's mandate was found (README command / plan log / REFUSED by name)
  2  one song's counts — carry_it_over, whose README states the harness's
     own three counts (11 mandated / 11 judged / 0 refused), read here
     through the same grader; the screened pool from its log
  3  a mutation — pull one partner back to the modal head and the ban's
     count and the HEAD bucket both move; the eligible count does not

Run: python3 quality/test_ban_convergence.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from quality import ban_convergence as BC  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_population():
    print("\n1. the population and the mandate sources")
    from quality.song_record import songs as _songs
    pop = BC.songs()
    check("the population is song_record's (a lyric with a blueprint)",
          pop == [os.path.basename(p) for p in _songs()], pop)
    check("sixteen songs banked at the pin", len(pop) == BC.PINNED["songs"],
          len(pop))
    src = {s: BC.mandate_spec(s)[0] for s in pop}
    counts = {"readme": 0, "log": 0, None: 0}
    for v in src.values():
        counts[v] += 1
    check("mandate sources: three counts, never summed — README command, "
          "plan-log facts, refused by name",
          (counts["readme"], counts["log"], counts[None]) ==
          (BC.PINNED["mandate_readme"], BC.PINNED["mandate_log"],
           BC.PINNED["mandate_refused"]), counts)
    check("oar_lair.txt is REFUSED — no README section, no plan row: the "
          "mandate is banked nowhere and is not invented (doctrine 20)",
          src.get("oar_lair.txt") is None
          and "no `song` command" in BC.mandate_spec("oar_lair.txt")[1],
          BC.mandate_spec("oar_lair.txt"))
    check("carry_it_over's mandate is the README's `song` command, with "
          "its returns",
          src["carry_it_over.txt"] == "readme"
          and BC.mandate_spec("carry_it_over.txt")[2] == [["7", "17"],
                                                           ["7", "20"]],
          BC.mandate_spec("carry_it_over.txt"))


def test_one_song(rv):
    print("\n2. carry_it_over — the grader's own counts, through this file")
    r = BC.measure_song(rv, "carry_it_over.txt")
    check("screened pool from the log: 35 HOMEOTELEUTON / 25 MODAL_RHYME / "
          "33 CLEAN / 5 REFUSED / 0 other",
          (r["screen_homeo"], r["screen_modal"], r["screen_clean"],
           r["screen_refused"], r["screen_other"]) == (35, 25, 33, 5, 0), r)
    check("final: 11 mandated / 11 judged / 0 refused — the README's own "
          "line, re-derived",
          (r["pairs_mandated"], r["pairs_judged"], r["pairs_refused"])
          == (11, 11, 0), r)
    check("exit-0 bytes carry no ban finding", r["banned_in_final"] == 0, r)
    check("9 ban-eligible rhyming pairs (11 minus the two REPEAT returns)",
          r["eligible"] == 9, r["pairs"])
    check("no partner sits in the ban's head; HEAD + TAIL + OUTSIDE are "
          "never summed and account for every eligible pair",
          r["rank_head"] == 0
          and r["rank_head"] + r["rank_tail"] + r["rank_outside"]
          == r["eligible"], r)
    return r


def test_mutation(rv):
    print("\n3. a mutation — one partner pulled back to the modal head")
    import lyric_harness as LH
    song = "carry_it_over.txt"
    spec = BC.mandate_spec(song)
    lines = LH.load_lyric_lines(os.path.join(BC.SONGS, song))
    m = BC.build_mandate(spec, len(lines))
    base = BC.measure_lines(rv, lines, m)
    # group `3,4.T2`: L3 ends `dust`, L4 token 2 is `cussed`. `trust` is the
    # same spelled rime (-ust): tier 1, HOMEOTELEUTON.
    assert lines[3].split()[1] == "cussed", lines[3]
    mut = list(lines)
    mut[3] = mut[3].replace("cussed", "trust", 1)
    got = BC.measure_lines(rv, mut, m)
    check("the ban fires on the mutated pair (banned_in_final 0 -> >=1)",
          base["banned_in_final"] == 0 and got["banned_in_final"] >= 1,
          (base["banned_in_final"], got["banned_in_final"]))
    check("the partner is now in the HEAD bucket (rank_head 0 -> 1)",
          base["rank_head"] == 0 and got["rank_head"] == 1,
          (base["rank_head"], got["rank_head"]))
    check("the pair still rhymes, so the eligible count does not move",
          got["eligible"] == base["eligible"],
          (base["eligible"], got["eligible"]))
    head = [p for p in got["pairs"] if p[3] == "head"]
    check("the HEAD pair is L3/L4 dust~trust at rank 0 of dust's field",
          head == [((3, 4), "dust", "trust", "head", 0)], head)


if __name__ == "__main__":
    from quality.revise import Reviser
    rv = Reviser()
    test_population()
    test_one_song(rv)
    test_mutation(rv)
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the ban is measured against the bank, through the grader")
