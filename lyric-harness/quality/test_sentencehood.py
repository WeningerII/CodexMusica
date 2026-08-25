#!/usr/bin/env python3
"""The sentencehood layer, checked — `quality/sentencehood.py` (M-110).

    python3 quality/test_sentencehood.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from lyric_harness import load_lyric_lines            # noqa: E402
from quality import sentencehood as SH                # noqa: E402

FAILURES = []


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(msg)


def test_the_witness():
    print("\n1. the banked witness — the song this layer was built to hear")
    lb = load_lyric_lines(os.path.join(ROOT, "songs/long_bridge.txt"))
    rep = SH.report(lb)
    check("the tagger is available in this environment (the sections below "
          "examine nothing without it)", rep["available"])
    if not rep["available"]:
        return
    flags = [f for f in rep["findings"] if f.severity == "flag"]
    check("`long_bridge` trips STACKED_DRAFT — the draft every sound-layer "
          "gate passed at exit 0",
          [f.code for f in flags] == ["STACKED_DRAFT"],
          f"flags: {[f.code for f in flags]}")
    check("its four stacked lines are the ones the blind panel quoted "
          "(8, 14, 23, 25)", rep["stacked"] == [8, 14, 23, 25],
          f"stacked: {rep['stacked']}")
    for s in ("one_more", "turn_the_wheel", "stay_awake", "carry_it_over",
              "keep_the_light"):
        r = SH.report(load_lyric_lines(os.path.join(ROOT, f"songs/{s}.txt")))
        check(f"`{s}` — the five the panel passed carry ZERO stacked lines",
              r["stacked"] == [] and not r["findings"],
              f"stacked: {r['stacked']}")


def test_the_boundary():
    print("\n2. the boundary — verbless is NOT stacked (doctrine 7)")
    # an ordinary human verbless line: prepositional, function-word-rich.
    # The calibration measured human verbless lines at func-share median
    # 0.38; the predicate's ceiling is 0.15, so this shape must never trip.
    check("a prepositional verbless line is not a stack",
          not SH.line_is_stacked("Down by the river in the morning light"))
    check("a comma-spliced noun inventory is",
          SH.line_is_stacked("Spark, full height, cinder, ash, sleeve"))
    check("a short fragment is beneath the predicate's notice",
          not SH.line_is_stacked("Almost."))
    check("an imperative is finite — 'Carry it. Don't look down.' is a "
          "sentence", not SH.line_is_stacked("Carry it, boy, don't look down"))


def test_the_gate_asks_nothing_of_small_drafts():
    print("\n3. the calibration population's own floor")
    stack = "Spark, full height, cinder, ash, sleeve"
    rep = SH.report([stack, "I know the road home and I do not take it",
                     "He never said a word", "The light stays on"])
    check("a 4-line draft with one stacked line gets the NOTE and no flag — "
          "the ceiling was calibrated on songs of >= 8 lines and asks "
          "nothing below its own population",
          [f.code for f in rep["findings"]] == ["STACKED_LINE"],
          f"{[f.code for f in rep['findings']]}")


def test_the_mutation():
    print("\n4. MUTATION — the ceiling is load-bearing")
    lb = load_lyric_lines(os.path.join(ROOT, "songs/long_bridge.txt"))
    kept = SH.ADOPTED["STACKED_FRACTION_MAX"]
    try:
        SH.ADOPTED["STACKED_FRACTION_MAX"] = 1.1
        rep = SH.report(lb)
        check("ceiling raised past 1.0 -> the flag disappears, so the "
              "constant is read and not decorative",
              not any(f.severity == "flag" for f in rep["findings"]))
    finally:
        SH.ADOPTED["STACKED_FRACTION_MAX"] = kept


def test_the_wiring():
    print("\n5. the wiring — inspect() carries the layer and says so")
    from quality.revise import Reviser
    rv = Reviser()
    lb = load_lyric_lines(os.path.join(ROOT, "songs/long_bridge.txt"))
    out = rv.inspect(lb, [[1, 3]])
    check("inspect() discloses `sentencehood_checked` beside "
          "`blueprint_declared`", "sentencehood_checked" in out)
    whole = [f.code for f in out["whole"]]
    check("STACKED_DRAFT reaches inspect()'s whole-draft set — the same "
          "seam `song`'s exit 3 and verify()'s new_flags read",
          "STACKED_DRAFT" in whole, f"whole: {whole}")
    per = [f.code for fs in out["per_line"].values() for f in fs]
    check("the per-line notes name their lines through the same fold",
          per.count("STACKED_LINE") == 4)


if __name__ == "__main__":
    for fn in (test_the_witness, test_the_boundary,
               test_the_gate_asks_nothing_of_small_drafts,
               test_the_mutation, test_the_wiring):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)}")
        sys.exit(1)
    print("a line of stacked nouns is not a sung phrase, and now a gate "
          "says so")
