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
  4  banked invocations — draft identity, precedence, coordinate retention,
     named refusals and the command-line reader

Run: python3 quality/test_ban_convergence.py
"""

import os
import io
import subprocess
import sys
import tempfile
from unittest.mock import patch

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
    counts = {"readme": 0, "log": 0, "banked": 0, None: 0}
    for v in src.values():
        counts[v] += 1
    check("mandate sources: three counts, never summed — README command, "
          "plan-log facts, refused by name",
          (counts["readme"], counts["log"], counts[None]) ==
          (BC.PINNED["mandate_readme"], BC.PINNED["mandate_log"],
           BC.PINNED["mandate_refused"]), counts)
    check("no historical invocation facts are invented by adding a reader",
          counts["banked"] == BC.PINNED["mandate_banked"] == 0, counts)
    check("oar_lair.txt is REFUSED — no README command, no plan row: the "
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


def test_banked_mandate(rv):
    print("\n4. the recorded invocation, tied to the draft it graded (MISSING.md M-196)")
    from quality import song_log as SL, schemes as SC
    from quality.revise import draft_fingerprint
    from pathlib import Path
    lines = ["I hold the dust", "I hear the cussed",
             "I hold the dust", "I hear the cussed"]
    md5 = draft_fingerprint(lines)
    with tempfile.TemporaryDirectory(prefix="m196-") as tmp:
        song = os.path.join(tmp, "probe.txt")
        Path(song).write_text("\n".join(lines) + "\n", encoding="utf-8")
        log = SL.log_path(song)

        def bank(step, args, fingerprint=md5, verb="song", extra=()):
            facts = [(SL.DRAFT_FACT[verb], fingerprint)]
            facts += SL.mandate_facts([verb, song] + args) + list(extra)
            SL.append(song, [{"song": song, "step": step,
                             "measured": "2026-09-17",
                             "harness_commit": "test-fixture", "verb": verb,
                             "exit": 0, "fact": f, "value": v}
                            for f, v in facts])

        def clear():
            if os.path.exists(log):
                os.unlink(log)

        # Old prose and a planned mandate deliberately disagree with the
        # actual invocation. A newer record belongs to different bytes.
        readme = {song: f"python3 lyric_harness.py song {song} --groups=1,3"}
        bank(1, ["--groups=1,3"])
        bank(2, ["--groups=1,2;3,4", "--returns=1,3"])
        bank(3, ["--groups=2,4"], fingerprint="different-draft")
        SL.append(song, [{"song": song, "step": 4,
                         "measured": "2026-09-17", "harness_commit": "fixture",
                         "verb": "plan", "exit": 0,
                         "fact": "groups", "value": "1,4"}])
        with patch.object(BC, "_readme_sections", return_value=readme):
            spec = BC.mandate_spec(song)
            expected = SC.mandate([[1, 2], [3, 4], [1, 3]], n_lines=4,
                                  returns=[[1, 3]])
            check("newest matching invocation outranks README and plan",
                  spec.source == "banked" and spec.step == 2
                  and spec.md5 == md5 and BC.build_mandate(spec, 4) == expected,
                  spec)
            measured = BC.measure_song(rv, song)
            direct = BC.measure_lines(rv, lines, expected)
            check("the banked groups and returns reach the actual grader",
                  all(measured[k] == v for k, v in direct.items())
                  and measured["pairs_mandated"] == 3, measured)
            out = io.StringIO()
            totals = BC.report([measured], stream=out)
            check("report names the banked step/md5 and counts its source",
                  f"[banked step=2 md5={md5}]" in out.getvalue()
                  and totals["mandate_banked"] == 1
                  and totals["mandate_readme"] == 0, out.getvalue())

        clear()
        bank(1, ["--groups=1.head,2.T2", "--returns=3,4",
                 "--relations=1:schema:anaphora", "--structures=2:qafiya"])
        check("slots, numeric labels, returns, structures and group relations "
              "survive the bank",
              BC.build_mandate(BC.mandate_spec(song), 4) == SC.mandate(
                  [["1.head", "2.T2"], ["3", "4"]], n_lines=4,
                  returns=[["3", "4"]], relations={0: "schema:anaphora"},
                  structures={1: "qafiya"}))

        for args, expected in [
            (["AABB", "--relation=schema:consonance"],
             SC.mandate("AABB", n_lines=4,
                        default_relation="schema:consonance")),
            (["--returns=1,3"],
             SC.mandate([[1, 3]], n_lines=4, returns=[[1, 3]])),
            (["--groups=1,2", "--structures=1:Kalevala-alliteration-(strong,-closed-syllable)"],
             SC.mandate([[1, 2]], n_lines=4,
                        structures={0: "Kalevala-alliteration-(strong,-closed-syllable)"})),
        ]:
            clear()
            bank(1, args)
            check(f"banked spelling round-trips: {args}",
                  BC.build_mandate(BC.mandate_spec(song), 4) == expected)

        for verb in SL.DRAFT_FACT:
            clear()
            bank(1, ["--groups=1,2"], verb=verb)
            check(f"{verb} binds its own input fingerprint fact",
                  BC.mandate_spec(song).source == "banked")

        cases = [
            (["--groups=1,2"], "different-draft", (), "matches input draft"),
            (["--cliques"], md5, (), "historical derived groups"),
            (["AABB", "--groups=1,2"], md5, (), "combines a scheme"),
            (["--groups=1,2", "--groups=3,4"], md5, (), "duplicates"),
            (["--relation=schema:consonance"], md5, (), "no declared groups"),
            (["--groups=,;"], md5, (), "empty mandate"),
            (["--groups=1,2"], md5, (("md5", "conflicting"),), "duplicates"),
        ]
        for args, fingerprint, extra, reason in cases:
            clear()
            bank(1, args, fingerprint=fingerprint, extra=extra)
            with patch.object(BC, "_readme_sections", return_value=readme):
                refused = BC.mandate_spec(song)
            check(f"refuses {reason} without borrowing a legacy mandate",
                  refused[0] is None and reason in refused[1], refused)

        clear()
        bank(1, ["--groups=1,2"], fingerprint="different-draft", verb="revise",
             extra=(("md5_out", md5),))
        refused = BC.mandate_spec(song)
        check("a loop output fingerprint is not its banked input identity",
              refused[0] is None and "matches input draft" in refused[1], refused)

        clear()
        bank(1, ["--groups=1,2"])
        bank(2, ["--cliques"])
        refused = BC.mandate_spec(song)
        check("an unreadable newer match does not reuse an older declaration",
              refused[0] is None and "step 2" in refused[1], refused)

        clear()
        bank(1, ["--groups=1,2;3,4", "--returns=1,3",
                 "--relation=schema:consonance"])
        bank(2, ["--groups=1,2"])
        spec = BC.mandate_spec(song)
        check("a newer invocation does not inherit omitted coordinates",
              spec.step == 2 and BC.build_mandate(spec, 4)
              == SC.mandate([[1, 2]], n_lines=4), spec)

        # A banked, malformed declaration cannot turn into an empty/free
        # mandate or disappear behind the README fallback.
        for args in (["--groups=1,99"],
                     ["--groups=1,2", "--relations=broken"],
                     ["--groups=1,2", "--relation=not-a-relation"]):
            clear()
            bank(1, args)
            with patch.object(BC, "_readme_sections", return_value=readme):
                got = BC.measure_song(rv, song)
            check(f"invalid banked declaration is a named refusal: {args}",
                  got["mandate_source"] == "REFUSED" and "banked mandate" in
                  got["refusal"] and "pairs_mandated" not in got, got)

        clear()
        bank(1, ["--groups=1,2"])
        proc = subprocess.run([sys.executable, os.path.join(HERE, "ban_convergence.py"),
                               f"--songs={song}"], capture_output=True, text=True,
                              cwd=ROOT, timeout=120)
        check("the CLI grades banked facts and exposes their identity",
              proc.returncode == 0 and f"[banked step=1 md5={md5}]" in proc.stdout,
              proc.stdout + proc.stderr)


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
    test_banked_mandate(rv)
    test_population()
    test_one_song(rv)
    test_mutation(rv)
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the ban is measured against the bank, through the grader")
