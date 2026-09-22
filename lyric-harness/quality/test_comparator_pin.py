#!/usr/bin/env python3
"""Regressions for THE COMPARATOR PIN — does the gate notice a moved comparator?

The defect this gate exists for is measured, not imagined: on 2026-09-16 six
pull requests touched `lyric_harness.py` in a day, each discarding the
~2.1-CPU-hour predictability memo, and one of them moved the shipped `lyric`
row. The refusal surfaced hours later on an unrelated commit as a 134-minute
red `curves` component and blocked every deploy behind it.

THE ONLY CHECK WORTH WRITING HERE IS THAT THE GATE CAN FAIL. A pin that always
says HOLDS reads exactly like a pin that is working, which is the defect this
repository found in seven of its own checks and fixed by mutation (doctrine
48). So every section below MOVES something and requires the verdict to
change; none of them is satisfied by a clean tree alone.

Sections:
  1  the pin agrees with the tree it is committed against
  2  a MOVED input is caught and NAMED — and an edit outside the closure is not
  3  the fold and the parts are ONE definition, not two
  4  an input that is not staged CANNOT TELL — it does not read as MOVED
  5  a pin cannot be advanced without naming the receipt that backs it
"""

import ast
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import check_comparator_pin as CP                  # noqa: E402
from quality import song_profile_calibration as C               # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _pin():
    return CP.load_pin()


def test_the_pin_agrees_with_this_tree():
    print("\n1. the pin agrees with the tree it is committed against")
    fingerprint, parts, absent = CP.measure()
    pin = _pin()
    check("no comparator input is missing, so this suite is measuring the "
          "comparator rather than its own container",
          not absent, f"absent={absent}")
    check("the committed fingerprint equals the measured one — if this fails, "
          "the tree moved and the PR that moved it owes a re-verification",
          pin["fingerprint"] == fingerprint,
          f"pin={pin['fingerprint'][:16]} measured={fingerprint[:16]}")
    check("the pin names the receipt that backs it, and that receipt is IN "
          "the tree — a pin on nobody's authority is the stale number wearing "
          "a measurement's clothes (doctrine 16)",
          pin.get("verified_by")
          and os.path.exists(os.path.join(HERE, "..", pin["verified_by"])),
          f"{pin.get('verified_by')}")
    check("the gate exits 0 on the committed tree",
          CP.main([]) == 0)


def _plant_inside(path, definition):
    """Insert a COMMENT inside one top-level definition's own body.

    The weakest possible edit to a definition the comparator reaches: it
    changes no behaviour and no AST, only the source text inside that
    definition's line span. Returning the file's prior bytes lets the caller
    restore it.
    """
    before = io.open(path, encoding="utf-8").read()
    lines = before.splitlines(keepends=True)
    node, = [n for n in ast.parse(before).body
             if getattr(n, "name", None) == definition]
    first = node.body[0].lineno - 1
    indent = lines[first][:len(lines[first]) - len(lines[first].lstrip())]
    lines.insert(first, indent + "# planted by test_comparator_pin.py section 2\n")
    io.open(path, "w", encoding="utf-8").write("".join(lines))
    return before


def test_a_moved_input_is_caught_and_named():
    print("\n2. a MOVED input is caught, and the moved input is NAMED")
    # THE TWO MUTATIONS ARE A PAIR AND NEITHER IS SUFFICIENT ALONE.
    # `lyric_harness.py` is hashed as the comparator's dependency CLOSURE, so
    # this section has to prove both halves of that: an edit inside the
    # closure is caught at its WEAKEST (a comment, changing no behaviour and
    # no AST), and an edit outside it is NOT — which is the whole reason the
    # input narrowed, and a claim a reader of the pin has to be able to check.
    # `score` is an entry point: `quality/features.py` imports it by name.
    target = os.path.join(HERE, "..", "lyric_harness.py")
    clean_fp, _clean_parts, _ = CP.measure()
    before = _plant_inside(target, "score")
    try:
        moved_fp, moved_parts, _ = CP.measure()
        check("a COMMENT INSIDE a reached definition moves the fingerprint — "
              "the guard is over-inclusive within the closure and that is the "
              "correct direction to be wrong",
              moved_fp != clean_fp, f"{clean_fp[:12]} -> {moved_fp[:12]}")
        pin = _pin()
        differing = sorted(k for k, v in moved_parts.items()
                           if pin["parts"].get(k) != v)
        check("EXACTLY the edited input is named — a gate that says only "
              "'something moved' sends the next session looking at seven "
              "files",
              differing == ["lyric_harness.py closure"], f"{differing}")
        check("the gate exits 1, not 0 and not 2: this is a real move, not a "
              "container problem",
              CP.main([]) == 1)
    finally:
        io.open(target, "w", encoding="utf-8").write(before)
    restored_fp, _, _ = CP.measure()
    check("the mutation is reverted, so this suite leaves no residue",
          restored_fp == clean_fp)
    check("and the gate is green again afterwards", CP.main([]) == 0)

    try:
        io.open(target, "a", encoding="utf-8").write(
            "\n# planted by test_comparator_pin.py section 2, outside the closure\n")
        outside_fp, _outside_parts, _ = CP.measure()
        check("a comment OUTSIDE every reached definition does NOT move the "
              "fingerprint — it cannot change what an item scores, and "
              "invalidating on one discarded a ~2.4-CPU-hour memo on 7 of the "
              "10 commits that touched this file (MISSING.md M-299)",
              outside_fp == clean_fp, f"{clean_fp[:12]} -> {outside_fp[:12]}")
        check("and the gate still exits 0 on it", CP.main([]) == 0)
    finally:
        io.open(target, "w", encoding="utf-8").write(before)
    check("still no residue after the second mutation",
          CP.measure()[0] == clean_fp)


def test_the_fold_and_the_parts_are_one_definition():
    print("\n3. the fold and the parts are ONE definition, not two")
    parts = C.comparator_fingerprint_parts()
    check("there are SEVEN inputs, which is what every doctrine sentence "
          "about this comparator claims", len(parts) == 7, f"{len(parts)}")
    check("`comparator_fingerprint` IS the parts folded — recomputing the "
          "fold from the parts reproduces it exactly, so a checker reading "
          "the parts cannot disagree with the hash that guards the memo "
          "(doctrine 1)",
          C._sha256(*[v for _l, v in parts]) == C.comparator_fingerprint())
    check("the labels are NOT hashed — they are metadata for the reader, and "
          "renaming one must not throw the corpus memo away",
          all(isinstance(l, str) and isinstance(v, str) for l, v in parts))
    check("every label is distinct, so a moved input cannot be reported "
          "under another input's name",
          len({l for l, _v in parts}) == 7)


def test_an_unstaged_input_cannot_tell():
    print("\n4. an input that is not staged CANNOT TELL, it does not read as MOVED")
    # `cmudict.dict` is fetched, not committed. A CI job that has not run
    # fetch_data has NO OPINION about the comparator, and reporting that as a
    # move would send somebody hunting a drift that does not exist
    # (doctrine 20: inconclusive-by-construction is not a finding).
    real = C.lyric_harness.CMUDICT_PATH
    try:
        C.lyric_harness.CMUDICT_PATH = os.path.join(HERE, "..", "no_such.dict")
        _fp, _parts, absent = CP.measure()
        check("the absent input is reported as absent",
              absent == ["no_such.dict"], f"{absent}")
        check("the gate exits 2 (cannot tell), NOT 1 (moved) — a container "
              "without the staged inputs must not accuse a pull request",
              CP.main([]) == 2)
    finally:
        C.lyric_harness.CMUDICT_PATH = real
    check("the real path is restored", CP.measure()[2] == [])


def test_a_pin_cannot_be_advanced_without_its_receipt():
    print("\n5. a pin cannot be advanced without naming the receipt")
    committed = io.open(CP.PIN_PATH, encoding="utf-8").read()
    try:
        check("--write with no receipt REFUSES at 2 and writes nothing",
              CP.main(["--write"]) == 2)
        check("the pin on disk is untouched by the refused write",
              io.open(CP.PIN_PATH, encoding="utf-8").read() == committed)
        check("--write naming a receipt that is NOT in the tree also refuses "
              "— the citation has to resolve, not merely be typed",
              CP.main(["--write", "--verified-by", "quality/results/no_such.txt",
                       "--verdict", "x"]) == 2)
        check("still untouched",
              io.open(CP.PIN_PATH, encoding="utf-8").read() == committed)
    finally:
        io.open(CP.PIN_PATH, "w", encoding="utf-8").write(committed)
    check("the committed pin is valid JSON at the version this build writes",
          json.loads(committed).get("version") == CP.PIN_VERSION)


def main():
    for fn in (test_the_pin_agrees_with_this_tree,
               test_a_moved_input_is_caught_and_named,
               test_the_fold_and_the_parts_are_one_definition,
               test_an_unstaged_input_cannot_tell,
               test_a_pin_cannot_be_advanced_without_its_receipt):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
