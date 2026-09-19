#!/usr/bin/env python3
"""The queue-versus-register census (`MISSING.md` M-298).

Five sections. The load-bearing ones are §2, which proves the LAST-status rule
is what makes a reconciled row read as reconciled, and §4, which proves the
SELF-FLAGGED / SILENT split is a real partition rather than a label.
"""

import contextlib
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import backlog_status as BS                   # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_both_readers_answer():
    print("\n1. both documents are read, and each yields entries")
    reg, rows = BS.register_status(), BS.queue_rows()
    check("the register yields entry statuses from its own headings",
          len(reg) > 300, f"{len(reg)} entries")
    check("the queue yields rows from its own tables",
          len(rows) > 50, f"{len(rows)} rows")
    check("every status either reader returns is in the CLOSED vocabulary — "
          "a status cell holding prose is not read as a status",
          all(v in BS.STATUSES for v in reg.values())
          and all(v[0] in BS.STATUSES for v in rows.values()))


def test_the_status_is_the_last_one_stated():
    print("\n2. the status is the LAST one stated, in both documents")
    # THIS IS THE RULE THE WHOLE CENSUS RESTS ON. Both documents supersede in
    # place with `~~OPEN~~ CLOSED` (doctrine 17), so reading the FIRST token
    # reports the struck value on every row that has already been reconciled —
    # which would invert the finding, reporting reconciled rows as broken and
    # saying nothing about the ones that are.
    check("a superseded cell reads as its surviving status",
          BS._last_status("~~PARTIAL~~ CLOSED 2026-09-17") == "CLOSED")
    check("a plain cell reads as itself",
          BS._last_status(" OPEN ") == "OPEN")
    check("a cell with two strikes reads as the last",
          BS._last_status("~~OPEN~~ ~~PARTIAL~~ RESOLVED") == "RESOLVED")
    check("prose with no status word yields None, so it is SKIPPED rather "
          "than guessed (doctrine 20)",
          BS._last_status("entry") is None
          and BS._last_status("BUILD · M") is None)
    check("MUTATION — reading the FIRST status instead would report a "
          "reconciled row as unreconciled, which is the census inverted",
          BS._last_status("~~OPEN~~ CLOSED") != "OPEN")


def test_the_census_partitions():
    print("\n3. the three outcomes partition the compared rows")
    c = BS.census()
    check("agree + self-flagged + silent = compared, exactly",
          c["agree"] + c["self_flagged_n"] + c["silent_n"] == c["compared"],
          f"{c['agree']} + {c['self_flagged_n']} + {c['silent_n']} "
          f"= {c['compared']}")
    check("a queue row naming no register entry is counted APART and never "
          "summed with a disagreement (doctrine 20/79)",
          c["compared"] + c["unregistered_n"] == c["rows"],
          f"compared {c['compared']} + unregistered {c['unregistered_n']} "
          f"= rows {c['rows']}")
    check("and the disagreements are what the census says they are",
          (c["self_flagged_n"], c["silent_n"])
          == (BS.PINNED["self_flagged_n"], BS.PINNED["silent_n"]))


def test_self_flagged_and_silent_are_a_real_split():
    print("\n4. SELF-FLAGGED and SILENT are a partition, not a label")
    c = BS.census()
    ids_f = {e[0] for e in c["self_flagged"]}
    ids_s = {e[0] for e in c["silent"]}
    check("the two sets are disjoint", not (ids_f & ids_s))
    check("EVERY self-flagged row actually carries the word in its own kind "
          "cell or its own text — the label is earned, not asserted",
          all(BS._SELF_FLAG.search(k) or BS._SELF_FLAG.search(
              BS.queue_rows()[e][2]) for e, _, _, k in c["self_flagged"]))
    check("and NO silent row carries it — which is what makes SILENT mean "
          "'nothing in the row says the register disagrees'",
          not any(BS._SELF_FLAG.search(k)
                  or BS._SELF_FLAG.search(BS.queue_rows()[e][2])
                  for e, _, _, k in c["silent"]))
    check("every disagreement really is one — the two statuses differ on "
          "each row reported",
          all(q != r for _, q, r, _ in c["self_flagged"] + c["silent"]))


def test_the_gate_and_the_refusal():
    print("\n5. `--check` gates the counts, and nothing else")
    # Both entrances print the whole census; swallow it so this suite's own
    # output stays readable. The RETURN CODES are what is being asserted.
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        bare, rc = BS.main([]), BS.check()
    check("the bare census exits 0", bare == 0)
    check("an unrecognised flag REFUSES at 2 rather than being ignored",
          BS.main(["--nope"]) == 2)
    check("`--check` reads as pinned on this tree", rc == 0)
    check("NOTHING HERE RULES on which document is right — the module names "
          "no remedy and the report says so in its own words",
          "rules on which document is right" in BS.report())


def main():
    for fn in (test_both_readers_answer,
               test_the_status_is_the_last_one_stated,
               test_the_census_partitions,
               test_self_flagged_and_silent_are_a_real_split,
               test_the_gate_and_the_refusal):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
