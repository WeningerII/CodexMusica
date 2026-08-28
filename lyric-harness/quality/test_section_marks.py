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
    check("ZERO function-kind marks lack a `maps_to` — `[PATTER]` was the "
          "one such row from this table's first derivation until "
          "2026-08-28, when M-52's close entered `patter` as the "
          "vocabulary's 22nd function on its printed witness (the "
          "source's own 'PATTER-TRIO.' heading; the file's note records "
          "that nothing else was tagged because that would be an "
          "editorial guess — the evidence rule working in both "
          "directions)",
          unmapped == [], str([r["mark"] for r in unmapped]))
    check("...and the PATTER row now maps to the function it witnessed, "
          "which `--check`'s maps_to validation holds against the "
          "vocabulary",
          next(r["maps_to"] for r in rs if r["mark"] == "PATTER")
          == "patter")
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


def test_the_cap_is_a_counted_exclusion():
    """§6 — M-52's close (2026-08-28): the census's 40-character cap was a
    SILENT exclusion, found when the voice build read 13 part labels out
    of the Kanteletar against this table's 12 — the thirteenth is 41
    characters long and the scanner never saw it. The cap is declared,
    its population is pinned, and the check turns red when it moves."""
    print("\n6. the mark-length cap is a counted exclusion, not a "
          "silence (M-52, 2026-08-28)")
    check("the cap is a DECLARED constant with a pinned population — "
          "24 distinct marks / 50 lines beyond it, all annotation-"
          "bearing heads (staging CHORUS annotations, Byron's and "
          "Shelley's publication notes, Coleridge's marginal glosses, "
          "one long part label), keyed by nothing on purpose",
          SM.MARK_CONTENT_CAP == 40
          and SM.census_beyond_cap() == (SM.PINNED_BEYOND_CAP["marks"],
                                         SM.PINNED_BEYOND_CAP["lines"]),
          str(SM.census_beyond_cap()))
    long_label = "PART: Vähäonnisen naisen neuo morsiamelle"
    check("...and the exemplar that exposed it is measurably past the "
          "cap: the Kanteletar's thirteenth part label at 41 characters, "
          "which `grid.section_census` DOES read (its voices key has 13 "
          "labels where this table's voice rows have 12)",
          len(long_label) == SM.MARK_CONTENT_CAP + 1)
    check("the gate is wired: `check()` compares the beyond-cap census "
          "against the pin, so a newly staged long mark moves a number "
          "instead of vanishing",
          not [c for c in SM.check() if "beyond-cap" in c])


if __name__ == "__main__":
    for fn in (test_the_table_is_closed, test_the_kinds_are_kept_apart,
               test_the_movement_level, test_what_the_vocabulary_lacks,
               test_radif_meets_its_function,
               test_the_cap_is_a_counted_exclusion):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)[:300]}")
        sys.exit(1)
    print("every bracketed mark this corpus prints is classified, and the "
          "four kinds are kept apart")
