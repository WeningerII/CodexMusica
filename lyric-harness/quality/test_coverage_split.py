#!/usr/bin/env python3
"""Regressions for THE COVERAGE SPLIT (quality/coverage_split.py) and the
census's `--split` filter (quality/coverage_census.py).

The split's promises: it is a pure, salted function of a work group; grouping
only ever joins; a group never straddles the split; the frozen file names
exactly the current population; and a census restricted to one side reads
only that side. Re-deriving the frozen file byte for byte needs a built
Library catalog and is `coverage_split.py --catalog DIR --check`, which a
verifier runs; this suite holds everything that needs no catalog.

Sections:
  1  the assignment is a pure function of the group key and the salt
  2  each grouping rule joins what it says, and nothing it should not
  3  the frozen file: current population, no straddling group, its counts
  4  the census reads one side only, and refuses a moved population
"""
import collections
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from quality import coverage_split as CS                         # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


class _G:
    def __init__(self, key):
        self.key = key

    def find(self, _x):
        return self.key


def test_assignment_is_pure():
    print("\n1. the assignment is a pure function of the group key and the salt")
    us = [(f"f#{i}", "f", "t", ["l"], None) for i in range(400)]
    a = CS.assign(us, CS.Groups([u[0] for u in us]))
    b = CS.assign(us, CS.Groups([u[0] for u in us]))
    check("the same units and groups give the same assignment", a == b)
    share = sum(1 for r in a if r[2] == "validation") / len(a)
    check("about one group in five is validation", 0.12 < share < 0.28, f"{share:.3f}")
    one = CS.assign(us, _G("f#0"))
    check("every member of one group takes that group's side",
          len({r[2] for r in one}) == 1)
    salt = CS.SALT
    try:
        CS.SALT = salt + "-other"
        moved = CS.assign(us, CS.Groups([u[0] for u in us]))
    finally:
        CS.SALT = salt
    check("a different salt is a different split", moved != a)


def _fake_catalog(readings):
    d = tempfile.mkdtemp()
    with open(os.path.join(d, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"readings": readings}, fh)
    return d


def test_grouping_rules():
    print("\n2. each grouping rule joins what it says")
    body = [f"a long and distinctive sung line number {i}" for i in range(6)]
    us = [
        ("x.txt#0", "x.txt", "Alpha", body, None),
        ("y.txt#0", "y.txt", "Alpha", [body[0], "something else entirely here"], None),
        ("z.txt#0", "z.txt", "Gamma", body[:4] + ["a fresh closing line of the song"], None),
        ("w.txt#0", "w.txt", "Delta", ["nothing here is shared with anyone at all"], None),
        ("v.txt#0", "v.txt", "Epsilon", ["the catalog says this is one work with u"], None),
        ("u.txt#0", "u.txt", "Zeta", ["a wholly different text that shares nothing"], None),
    ]
    cat = _fake_catalog([
        {"source_path": "v.txt", "title": "Epsilon", "work_id": "W1", "reading_unit_id": "r1"},
        {"source_path": "u.txt", "title": "Zeta [air: x]", "work_id": "W1", "reading_unit_id": "r2"},
    ])
    g, evidence = CS.group(us, cat)
    same = lambda a, b: g.find(a) == g.find(b)
    check("rule 1: one catalog work_id joins its readings across files",
          same("v.txt#0", "u.txt#0"))
    check("rule 3: the same title and first line join across files",
          same("x.txt#0", "y.txt#0"))
    check("rule 4: sharing half the smaller item's lines joins (4 of 5)",
          same("x.txt#0", "z.txt#0"))
    check("an item sharing nothing stays alone", not same("w.txt#0", "x.txt#0")
          and not same("w.txt#0", "v.txt#0"))
    check("the catalog's work map is digested into the evidence",
          len(evidence.get("catalog_work_map_sha256", "")) == 64)


def test_frozen_file():
    print("\n3. the frozen file")
    assignment, meta = CS.read_split()
    us = CS.units()
    ids = [u[0] for u in us]
    check("it names exactly the current population's items, in full",
          set(assignment) == set(ids) and len(assignment) == len(ids),
          f"{len(assignment)} frozen, {len(ids)} current")
    with open(CS.SPLIT_PATH, encoding="utf-8") as fh:
        rows = [l.split("\t") for l in fh.read().splitlines()[3:] if l]
    sides = collections.defaultdict(set)
    for _u, key, side in rows:
        sides[key].add(side)
    check("no group straddles the split", all(len(s) == 1 for s in sides.values()))
    from quality.coverage_census import inputs_sha256
    check("its population digest is the current corpus's",
          meta["inputs_sha256"] == inputs_sha256(
              [os.path.join(ROOT, f) for f in sorted({u[1] for u in us})]))
    count = collections.Counter(side for _u, _k, side in rows)
    check("its header counts are its rows' counts",
          (meta["dev_items"], meta["validation_items"], meta["groups"])
          == (count["dev"], count["validation"], len(sides)))
    check("the salt is the published one", meta["salt"] == CS.SALT)


def test_census_reads_one_side():
    print("\n4. the census reads one side only")
    script = os.path.join(HERE, "coverage_census.py")
    out = {}
    for side in ("dev", "validation"):
        r = subprocess.run([sys.executable, script, "--population", "song",
                            "--split", side], capture_output=True, text=True)
        out[side] = json.loads(r.stdout)
    assignment, _meta = CS.read_split()
    want = collections.Counter(assignment.values())
    check("each side's census counts exactly that side's items",
          (out["dev"]["items"], out["validation"]["items"])
          == (want["dev"], want["validation"]))
    r = subprocess.run([sys.executable, script, "--population", "library",
                        "--split", "dev"], capture_output=True, text=True)
    check("a population the split does not cover is refused",
          r.returncode == 2 and "REFUSED" in r.stdout, r.stdout.strip()[:120])


if __name__ == "__main__":
    test_assignment_is_pure()
    test_grouping_rules()
    test_frozen_file()
    test_census_reads_one_side()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED")
        sys.exit(1)
    print("ALL PASS")
