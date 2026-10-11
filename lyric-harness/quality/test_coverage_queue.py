#!/usr/bin/env python3
"""Regressions for THE RANKED REVIEW QUEUE (quality/coverage_queue.py).

Sections:
  1  a step credits jointly completable spellings, not single words alone
  2  --attested never lets a step add a spelling the source does not attest
  3  the heuristic classes sort what they say
  4  the queue reads the dev side of the frozen split and nothing else
"""
import collections
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from quality import coverage_queue as Q                          # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_joint_sets():
    print("\n1. a step credits jointly completable spellings")
    items = [{"a", "b"}] * 3 + [{"c"}] + [set()] * 2
    tokens = collections.Counter({"a": 5, "b": 5, "c": 50})
    steps = Q.rank(items, tokens, top=10)
    check("the pair that completes three items comes before the single word "
          "that completes one (1.5 items per spelling against 1)",
          steps and steps[0]["add"] == ["a", "b"] and steps[0]["completes"] == 3,
          steps[:2])
    check("already-ready items count from the start, and each step adds its "
          "completions", steps[0]["items_lookup_ready"] == 5
          and steps[1]["items_lookup_ready"] == 6)
    check("a word that only ever appears beside another unknown is not "
          "stranded at zero", any("a" in s["add"] for s in steps))


def test_attested_restriction():
    print("\n2. --attested restricts every step")
    items = [{"a", "b"}] * 3 + [{"c"}, {"a"}]
    tokens = collections.Counter({"a": 1, "b": 1, "c": 1})
    steps = Q.rank(items, tokens, allowed={"a", "c"}, top=10)
    added = {t for s in steps for t in s["add"]}
    check("no step adds an unattested spelling", "b" not in added, steps)
    check("items needing an unattested spelling are never claimed complete",
          steps[-1]["items_lookup_ready"] == 2)


def test_classes():
    print("\n3. the heuristic classes")
    import lyric_harness as LH
    cmu = LH.Lexicon().entries
    case = {"ellen": {"lower": False, "mid_cap": True},
            "rose": {"lower": True, "mid_cap": True}}
    want = {"o'er": "elision", "to-day": "hyphenated", "feäce": "non-ascii",
            "10": "no-letters", "ellen": "name-like", "rose": "plain",
            "canst": "archaic-derivable", "loveth": "archaic-derivable"}
    got = {t: Q.classify(t, case, cmu) for t in want}
    check("each spelling lands in its class", got == want, got)


def test_dev_only():
    print("\n4. the queue reads the dev side only")
    from quality.coverage_split import read_split
    from quality.coverage_census import build_lexicon
    assignment, _meta = read_split()
    items, _tokens, _case = Q.blockers(build_lexicon("none", "none"))
    dev = sum(1 for side in assignment.values() if side == "dev")
    check("it reads exactly the dev items of the frozen split",
          len(items) == dev, f"{len(items)} read, {dev} dev")


if __name__ == "__main__":
    test_joint_sets()
    test_attested_restriction()
    test_classes()
    test_dev_only()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED")
        sys.exit(1)
    print("ALL PASS")
