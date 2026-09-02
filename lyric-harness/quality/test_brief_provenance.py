#!/usr/bin/env python3
"""Regressions for the brief-provenance gate.

WHAT IS BEING PROVEN is not that changed lines can be counted — it is that
the gate CANNOT GO QUIETLY GREEN on the exact miss it was built for. Every
failure guarded here renders as a clean report:

  the fingerprint check dropped        -> a brief earned on ANY draft
                                          launders a hand-edit on another,
                                          and 16 unbriefed lines read BRIEFED
  `pending` not read                   -> the question standing when the run
                                          suspended counts as never asked
  the length refusal dropped           -> a restructure is diffed as a
                                          revision and reports line numbers
                                          that mean nothing
  the local fingerprint drifting from
  `quality.revise.draft_fingerprint`   -> every line UNBRIEFED, PASS-shaped
                                          failure that blames the writer

Run: python3 quality/test_brief_provenance.py
"""

import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import brief_provenance as BP  # noqa: E402

FAILURES = []


def check(name, ok, detail=""):
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if detail:
        print("          %s" % detail)
    if not ok:
        FAILURES.append(name)


BEFORE = ["one", "two", "three", "four"]
AFTER = ["one", "TWO", "three", "FOUR"]


def _state(path, entries, pending=None):
    blob = {"version": 1,
            "answered": {"propose": entries, "propose_group": []},
            "pending": pending}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(blob, f)
    return path


def _rec(line, draft):
    return {"record": {"line": line, "draft": draft, "attempt": 0,
                       "round": 1, "text": None}}


print("\n1. the fingerprint is the SAME one the loop stamps into its records")
# Doctrine 1's hazard: this module spells `draft_fingerprint` locally so the
# gate runs with no lexicon loaded. Two spellings of one fact is how they
# start disagreeing, so the equivalence is CHECKED and not commented.
try:
    from quality.revise import draft_fingerprint as RV_FP
    same = all(BP.draft_fingerprint(x) == RV_FP(x)
               for x in ([], BEFORE, AFTER, ["a"], ["a", "", "b"]))
    check("the local fingerprint equals quality.revise.draft_fingerprint over "
          "five drafts including the empty one",
          same, "a drift here reports every line UNBRIEFED and blames the "
                "writer for the gate's own arithmetic")
except Exception as e:  # pragma: no cover - import cost only
    check("quality.revise imports so the equivalence can be checked",
          False, repr(e))

print("\n2. a changed line COUNT is refused, never diffed")
try:
    BP.changed_lines(["a", "b"], ["a", "b", "c"])
    check("a length change raises rather than aligning", False,
          "it returned a diff over two different objects")
except ValueError as e:
    check("a length change raises rather than aligning", True, str(e)[:60])
check("equal-length drafts diff to the moved lines",
      BP.changed_lines(BEFORE, AFTER) == [2, 4],
      str(BP.changed_lines(BEFORE, AFTER)))

print("\n3. THE GATE'S SUBJECT — a brief must name THIS draft, not any draft")
fp_before = BP.draft_fingerprint(BEFORE)
with tempfile.TemporaryDirectory() as td:
    right = _state(os.path.join(td, "right.json"),
                   [_rec(2, fp_before), _rec(4, fp_before)])
    res = BP.classify(BEFORE, AFTER, [right])
    check("both revised lines are BRIEFED when the brief names this draft",
          res["briefed"] == [2, 4] and res["unbriefed"] == [], str(res))

    # THE LAUNDERING CASE, and it is the whole reason the fingerprint is read.
    stale = _state(os.path.join(td, "stale.json"),
                   [_rec(2, "ffffffffffff"), _rec(4, "000000000000")])
    res2 = BP.classify(BEFORE, AFTER, [stale])
    check("a brief issued against a DIFFERENT draft launders nothing — both "
          "lines are UNBRIEFED",
          res2["unbriefed"] == [2, 4] and res2["briefed"] == [],
          str(res2))

    # A brief that was ISSUED and not yet answered was still put in front of
    # the writer, so `pending` counts.
    pend = _state(os.path.join(td, "pend.json"), [_rec(2, fp_before)],
                  pending=_rec(4, fp_before))
    res3 = BP.classify(BEFORE, AFTER, [pend])
    check("the question standing at suspension counts as issued (pending is "
          "read, not only answered)",
          res3["briefed"] == [2, 4], str(res3))

print("\n4. the three counts are separate and never summed (doctrine 79)")
with tempfile.TemporaryDirectory() as td:
    mixed = _state(os.path.join(td, "m.json"),
                   [_rec(2, fp_before), _rec(3, fp_before)])
    res = BP.classify(BEFORE, AFTER, [mixed])
    check("BRIEFED [2], UNBRIEFED [4], BRIEFED_UNCHANGED [3] — a line asked "
          "about and left alone is in neither of the other two",
          res["briefed"] == [2] and res["unbriefed"] == [4]
          and res["briefed_unchanged"] == [3], str(res))
    text = BP.report(res)
    check("the rendering prints all three and never a total",
          "BRIEFED " in text and "UNBRIEFED" in text
          and "BRIEFED_UNCHANGED" in text and "never summed" in text)

print("\n5. --check is a GATE: exit 3 on an unbriefed revision, 0 when clean")
with tempfile.TemporaryDirectory() as td:
    b = os.path.join(td, "b.txt")
    a = os.path.join(td, "a.txt")
    open(b, "w").write("\n".join(BEFORE))
    open(a, "w").write("\n".join(AFTER))
    full = _state(os.path.join(td, "f.json"),
                  [_rec(2, fp_before), _rec(4, fp_before)])
    none = _state(os.path.join(td, "n.json"), [])
    check("exit 0 when every revised line was briefed",
          BP.main([b, a, full, "--check"]) == 0)
    check("exit 3 when a revised line was not",
          BP.main([b, a, none, "--check"]) == 3)
    check("exit 3 with NO state file at all — a hand-edited draft is the "
          "case this gate exists for",
          BP.main([b, a, "--check"]) == 3)
    check("without --check it REPORTS and does not gate (exit 0)",
          BP.main([b, a, none]) == 0)
    check("a missing draft REFUSES at 2 rather than raising",
          BP.main([os.path.join(td, "nope.txt"), a, "--check"]) == 2)
    check("too few arguments REFUSE at 2 with the usage line",
          BP.main(["--check"]) == 2)

print("\n6. THE LEDGER — the loop is the front door, and this is the memory")
with tempfile.TemporaryDirectory() as td:
    d = os.path.join(td, "d.txt")
    open(d, "w").write("\n".join(BEFORE))
    check("no ledger yet — a FIRST draft is admitted, there is nothing it "
          "could have been briefed about",
          BP.admit(d, BEFORE)[0])
    BP.write_ledger(d, BEFORE)
    check("the ledger records the draft AS HANDED IN, not the loop's output "
          "— what a writer edits next is the file they handed in",
          (BP.read_ledger(d) or {}).get("lines") == BEFORE)
    check("re-grading the IDENTICAL draft is not a revision and is admitted",
          BP.admit(d, BEFORE)[0])
    ok, say = BP.admit(d, AFTER)
    check("a hand-edited line with no brief is REFUSED, naming the line",
          not ok and "[2, 4]" in say, say)
    ok2, say2 = BP.admit(d, AFTER, reason="fixing a typo")
    check("a DECLARED reason admits it and carries the writer's own words "
          "into the message (the fit.AssumedMeter precedent)",
          ok2 and "fixing a typo" in say2, say2)
    fp = BP.draft_fingerprint(BEFORE)
    st = _state(os.path.join(td, "s.json"),
                [_rec(2, fp), _rec(4, fp)])
    ok3, say3 = BP.admit(d, AFTER, [st])
    check("a BRIEFED revision passes — the false refusal is the worse bug "
          "and this is the check that keeps it out",
          ok3 and "every one briefed" in say3, say3)
    stale = _state(os.path.join(td, "stale.json"), [_rec(2, "ffffffffffff"),
                                                    _rec(4, "ffffffffffff")])
    check("a brief against another draft does not admit it here either",
          not BP.admit(d, AFTER, [stale])[0])
    # A RESTRUCTURE IS A DIFFERENT OBJECT, not an unbriefed revision.
    ok4, say4 = BP.admit(d, BEFORE + ["five"])
    check("a changed line COUNT is admitted and named a restructure, because "
          "this gate asks which LINES moved and a changed count has no answer",
          ok4 and "restructure" in say4, say4)
    # THE STATE PATHS ARE CARRIED so a later run need not re-name them.
    BP.write_ledger(d, BEFORE, [st])
    check("the ledger carries the state paths forward — a gate a caller can "
          "evade by forgetting an argument fails toward whoever forgot",
          BP.admit(d, AFTER)[0], str(BP.read_ledger(d).get("states")))

print("\n" + "=" * 62)
if FAILURES:
    print("FAILURES: %d" % len(FAILURES))
    for f in FAILURES:
        print("  - %s" % f)
    sys.exit(1)
print("ALL PASS")
