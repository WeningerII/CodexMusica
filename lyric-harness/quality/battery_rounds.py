#!/usr/bin/env python3
"""THE FLASH BATTERY, ONE ROW PER ROUND, ONE LAYER PER ROW (`MISSING.md`
M-254's item D, the owner's "D sounds pretty good", 2026-09-06).

Twenty-three rounds were banked across fifteen register entries and nothing
could show the ladder in one place: which LAYER each round died in, and how
many songs reached exit 0 (none). `quality/battery_rounds.tsv` is that table,
DECLARED by hand from the entries it cites, and this module is its gate:

  layer      one of LAYERS, a CLOSED vocabulary — a round that dies in a
             layer this list does not name is a new kind of failure and
             gets a row in the vocabulary before it gets a row in the table
  entry      the register entry that banked the round; must exist
  run_id     the GitHub Actions run (11 digits), several joined by `/` when
             a round took several attempts, or `-` when the round ran with
             no run to cite
  exit0      yes / no — the only bar the owner set: a finished song

Three things it prints, never summed into a score (doctrine 79): rounds per
layer, the rounds at exit 0, and the ladder in round order.

    python3 quality/battery_rounds.py            the ladder
    python3 quality/battery_rounds.py --check    exit 3 on any row that breaks
                                                 the shape above
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TABLE = os.path.join(HERE, "battery_rounds.tsv")
MISSING = os.path.join(ROOT, "MISSING.md")

#: WHERE A ROUND DIED. Closed, and each name is a different remedy:
#:   instrument   the driver or the workflow itself — a wrong verdict, an
#:                erased record, a launch-pad run; fix the instrument
#:   transport    the network between driver, server and Gemini — resets,
#:                502/503, idle walls; retry policy and keep-alives
#:   budget       a clock or a cost cap ending legitimate work; derive the
#:                bound from the work
#:   connector    server-side logic dropping or misreading the run's record
#:   model-shape  the model could not EMIT the call the protocol asked for —
#:                wrong channel, malformed call, a broken array
#:   model-wander the model emitted well-formed calls and spent them on the
#:                wrong ones — re-plans, moved declarations, skipped steps
#:   writer       the lines themselves: the grader refused what was written
#:   rate-limit   the upstream's 429 wall, no affordable wait clearing it
LAYERS = ("instrument", "transport", "budget", "connector", "model-shape",
          "model-wander", "writer", "rate-limit")
COLUMNS = ("round", "date", "run_id", "layer", "entry", "exit0",
           "what_stopped_it")


def load(path=TABLE):
    with open(path, encoding="utf-8") as f:
        rows = [ln.rstrip("\n").split("\t") for ln in f if ln.strip()]
    head, body = rows[0], rows[1:]
    return head, [dict(zip(head, r)) for r in body]


def entries(path=MISSING):
    with open(path, encoding="utf-8") as f:
        return set(re.findall(r"^#{2,4} +([A-Z]-\d+[a-z]?)\b", f.read(), re.M))


def problems(head, rows, known):
    out = []
    if tuple(head) != COLUMNS:
        out.append(f"columns are {head}, declared {list(COLUMNS)}")
        return out
    seen = []
    for r in rows:
        n = r["round"]
        if not n.isdigit():
            out.append(f"round {n!r} is not a number")
            continue
        seen.append(int(n))
        if r["layer"] not in LAYERS:
            out.append(f"round {n}: layer {r['layer']!r} is not in the "
                       f"declared vocabulary {list(LAYERS)}")
        if r["entry"] not in known:
            out.append(f"round {n}: entry {r['entry']} is not a heading in "
                       f"MISSING.md")
        if r["run_id"] != "-" and not all(re.fullmatch(r"\d{11}", x)
                                          for x in r["run_id"].split("/")):
            out.append(f"round {n}: run_id {r['run_id']!r} is not 11-digit "
                       f"run id(s) or '-'")
        if r["exit0"] not in ("yes", "no"):
            out.append(f"round {n}: exit0 {r['exit0']!r} must be yes or no")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", r["date"]):
            out.append(f"round {n}: date {r['date']!r}")
        if not r["what_stopped_it"].strip():
            out.append(f"round {n}: what_stopped_it is empty")
    if seen != list(range(1, len(seen) + 1)):
        out.append(f"rounds are not contiguous from 1: {seen}")
    return out


def report(rows, stream=sys.stdout):
    p = lambda s="": print(s, file=stream)          # noqa: E731
    p("THE FLASH BATTERY, BY ROUND — where each one died (never summed into "
      "a score; doctrine 79)")
    for r in rows:
        p(f"  {int(r['round']):>2}  {r['date']}  {r['layer']:<12} {r['entry']:<6} "
          f"exit0={r['exit0']:<3} {r['what_stopped_it']}")
    p()
    p("ROUNDS PER LAYER")
    for L in LAYERS:
        n = [r["round"] for r in rows if r["layer"] == L]
        if n:
            p(f"  {L:<12} {len(n):>2}   rounds {', '.join(n)}")
    p()
    won = [r["round"] for r in rows if r["exit0"] == "yes"]
    p(f"SONGS AT EXIT 0: {len(won)} of {len(rows)} rounds"
      + (f" ({', '.join(won)})" if won else ""))


def main(argv):
    head, rows = load()
    bad = problems(head, rows, entries())
    if "--check" in argv:
        for b in bad:
            print(f"  [FAIL] {b}")
        if bad:
            print(f"\nRESULT: FAIL — {len(bad)} row(s) break the declared shape")
            return 3
        print(f"  [ok  ] {len(rows)} round(s), every layer declared, every "
              f"entry a heading, rounds contiguous")
        print("\nRESULT: PASS")
        return 0
    report(rows)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
