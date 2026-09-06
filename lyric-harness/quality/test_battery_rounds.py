#!/usr/bin/env python3
"""`quality/battery_rounds.py --check` cannot pass on a broken table — three
mutations in memory, the committed table as the control (M-254 D)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import battery_rounds as BR  # noqa: E402

FAILURES = []


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}" + (f"\n          {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(msg)


def main():
    print("1. the committed table holds, and each declared rule refuses its mutation")
    head, rows = BR.load()
    known = BR.entries()
    check("the committed table passes", BR.problems(head, rows, known) == [],
          BR.problems(head, rows, known))
    check("...and it is not vacuous: 23 rounds, 0 at exit 0, every layer in the vocabulary",
          len(rows) == 23 and all(r["exit0"] == "no" for r in rows)
          and {r["layer"] for r in rows} <= set(BR.LAYERS), len(rows))
    m = [dict(r) for r in rows]
    m[2]["layer"] = "model-vibes"
    check("an undeclared layer FAILS by name — a new kind of failure gets a row in "
          "the vocabulary before a row in the table",
          any("model-vibes" in p for p in BR.problems(head, m, known)))
    m = [dict(r) for r in rows]
    m[5]["entry"] = "M-9999"
    check("an entry that is no heading FAILS", any("M-9999" in p for p in BR.problems(head, m, known)))
    m = [dict(r) for r in rows if r["round"] != "7"]
    check("a missing round FAILS as non-contiguous", any("contiguous" in p for p in BR.problems(head, m, known)))
    m = [dict(r) for r in rows]
    m[0]["run_id"] = "3321287248"
    check("a ten-digit run id FAILS", any("run_id" in p for p in BR.problems(head, m, known)))
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILING")
        return 1
    print("all battery-rounds checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
