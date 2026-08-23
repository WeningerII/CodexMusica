#!/usr/bin/env python3
"""Regressions for the bracketed-mark triage (`MISSING.md` M-52).

`grid.MARK_FUNCTION` maps five marks and was the ONLY reader of any `[MARK]`
line, so 62% of every marked line in this corpus reached no check at all — and
a mark nobody classified is indistinguishable from a mark nobody printed.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import section_marks as SM                        # noqa: E402
from quality import grid as GR                                 # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_table_is_closed():
    print("\n1. the table is CLOSED against the corpus")
    bad = SM.check()
    check("every printed mark has a row, every count re-derives, and the "
          "table agrees with `grid.MARK_FUNCTION` about which marks ARE "
          "functions — a load that prints a new mark turns this RED instead "
          "of joining the 62% that answer nothing",
          bad == [], "; ".join(bad[:3]))
    rs = SM.rows()
    check("every row carries a NOTE — a classification nobody can check is "
          "prose sitting in code's seat, which is the defect M-48 named one "
          "table over",
          all(r["note"] for r in rs))
    check("every declared kind is in the closed set",
          all(r["kind"] in SM.KINDS for r in rs), str(SM.KINDS))


def test_the_kinds_are_kept_apart():
    print("\n2. the kinds are four questions, never one")
    rs = SM.rows()
    check("ONLY a `function` row carries a `maps_to`. A form mark mapped to a "
          "function would put the form layer's answer in the function "
          "layer's slot — `[BAYT]` is a couplet and `[SLOKA]` is a stanza, "
          "and neither is what a section is FOR",
          all(not r["maps_to"] for r in rs if r["kind"] != "function"))
    kinds = SM.by_kind(rs)
    check("the counts are reported PER KIND and never summed (doctrine 79) — "
          "a form mark and a function mark are not two of the same thing, "
          "and the headline that added them is the number this entry is about",
          set(kinds) == set(SM.KINDS)
          and all(isinstance(v, tuple) and len(v) == 2 for v in kinds.values()),
          str({k: v for k, v in kinds.items()}))
    check("`form` is the largest kind by LINES and `function` the largest by "
          "what the harness can use — 125,333 against 77,070, which is the "
          "measurement that says the corpus's marked mass is prosody, not "
          "song function",
          kinds["form"][1] > kinds["function"][1],
          f"form {kinds['form'][1]}, function {kinds['function'][1]}")


def test_the_movement_level():
    print("\n3. the piobaireachd marks are a LEVEL, not three functions")
    rs = {r["mark"]: r for r in SM.rows()}
    mv = [m for m, r in rs.items() if r["kind"] == "movement"]
    check("URLAR / SIUBHAL / CRUNLUATH are `movement`, not `function` — "
          "MEASURED: in 3 of 3 files every one of them is immediately "
          "followed by a `[VERSE n]`, so each GROUPS verses rather than "
          "being one. Filing them as functions would have put a container "
          "in the contained layer's table",
          sorted(mv) == ["CRUNLUATH", "SIUBHAL", "URLAR"], str(sorted(mv)))
    check("...and none of them maps to a section function, because the model "
          "has NO layer at that level yet — an empty `maps_to` here is a "
          "finding, not an omission",
          all(not rs[m]["maps_to"] for m in mv))


def test_what_the_vocabulary_lacks():
    print("\n4. the rows the vocabulary cannot yet answer")
    rs = SM.rows()
    unmapped = [r for r in rs if r["kind"] == "function" and not r["maps_to"]]
    check("exactly ONE mark is a genuine section FUNCTION the 21-name "
          "vocabulary does not contain: `[PATTER]`. Its file's own note "
          "records the printed heading 'PATTER-TRIO.' AND records that "
          "nothing else in the file was tagged because that would be an "
          "editorial guess — which is the evidence rule working",
          [r["mark"] for r in unmapped] == ["PATTER"],
          str([r["mark"] for r in unmapped]))
    voice = [r for r in rs if r["kind"] == "voice"]
    check("the `PART:` marks are a VOICE coordinate and there are 12 of "
          "them — WHO sings, not what the span is for. `--voices` already "
          "establishes that a voice is a declared reading in this repo",
          len(voice) == 12 and all(r["mark"].startswith("PART:")
                                   for r in voice),
          f"{len(voice)} voice rows")
    ref = [r for r in rs if r["kind"] == "refused"]
    check("a mark the corpus does not decide is REFUSED, not guessed "
          "(doctrine 20) — one row, `[tempat anu]`, one occurrence, printed "
          "lowercase, and one instance decides nothing",
          len(ref) == 1 and ref[0]["mark"] == "TEMPAT ANU")


def test_radif_meets_its_function():
    print("\n5. the biggest unmapped mark, and why it is not mapped")
    rs = {r["mark"]: r for r in SM.rows()}
    check("`[RADIF]` is 54,193 lines — the second largest mark in the corpus "
          "— and is filed FORM, not function. A radif is the ghazal's "
          "repeated post-rhyme ELEMENT, not a span with a job; mapping it to "
          "`refrain` would make a prosodic unit a section",
          rs["RADIF"]["kind"] == "form" and not rs["RADIF"]["maps_to"],
          f"{rs['RADIF']['lines']} lines in {rs['RADIF']['files']} files")
    check("...and `[BAYT]`, the largest at 70,866, is form for the same "
          "reason: it is a couplet",
          rs["BAYT"]["kind"] == "form" and not rs["BAYT"]["maps_to"])
    check("between them they are the whole of the `form` mass, which is why "
          "62% of marked lines answered nothing: the corpus's marked bulk is "
          "PERSIAN PROSODY and the only reader was an English song-form table",
          rs["RADIF"]["lines"] + rs["BAYT"]["lines"]
          > 0.9 * SM.by_kind()["form"][1])


if __name__ == "__main__":
    for fn in (test_the_table_is_closed, test_the_kinds_are_kept_apart,
               test_the_movement_level, test_what_the_vocabulary_lacks,
               test_radif_meets_its_function):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)[:300]}")
        sys.exit(1)
    print("every bracketed mark this corpus prints is classified, and the "
          "four kinds are kept apart")
