#!/usr/bin/env python3
"""Regressions for STRUCTURE RECOVERY — the second door into one pipeline.

The owner's ruling: *"If an LLM writes something we go through all of the
steps, if a human does it then we need the same steps ... the beginning must
be to structure it."* `quality/plan.py` gave the LLM door a front half; the
pasted-song door had none, so every gate downstream was only as good as
whatever an operator hand-declared.

Sections:
  1  the four provenances are a CLOSED set and every coordinate carries one
  2  sections: declared beats derived beats REFUSED, in that order
  3  what is COUNTED is arithmetic nobody can disagree with
  4  the meter is REFUSED and the refusal names its remedy
  5  the web is a cover over PLACEMENTS, not over line ends
  6  the derived cover says it is not independent of the grader
  7  the bound is declared, and a truncation would be loud
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import recover as RC                              # noqa: E402
from quality import slots as SL                                # noqa: E402

FAILURES = []

MARKED = ["[VERSE 1]",
          "Silver rivers carry morning light",
          "A distant bell was warning",
          "The quiet water holds a silver",
          "Nothing here is calm or clever",
          "",
          "[CHORUS]",
          "Golden evening turns to grey",
          "And every road runs far away"]
BLANKS = ["Silver rivers carry morning light",
          "A distant bell was warning",
          "",
          "The quiet water holds a silver",
          "Nothing here is calm or clever"]
BARE = ["Silver rivers carry morning light",
        "A distant bell was warning",
        "The quiet water holds a silver"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _sung(raw):
    from lyric_harness import is_apparatus_line
    return [l for l in raw if l.strip() and not is_apparatus_line(l)]


def _rec(raw):
    return RC.recover(_sung(raw), raw_lines=raw)


def test_provenance_is_closed():
    print("\n1. the four provenances are CLOSED and every coordinate has one")
    r = _rec(MARKED)
    check("every coordinate the recovery emits carries a provenance — a "
          "value with no account of how it was obtained is the thing this "
          "module exists to stop emitting",
          set(r) == set(r.how), f"{sorted(set(r) ^ set(r.how))}")
    check("and every provenance is one of the four declared — a fifth "
          "cannot appear by someone writing a new string",
          all(h in RC.PROVENANCE for h, _ in r.how.values()),
          f"{RC.PROVENANCE}")
    bad = False
    try:
        r.put("x", 1, "probably")
    except ValueError:
        bad = True
    check("an undeclared provenance REFUSES at the put, not at the reader",
          bad)


def test_sections_prefer_the_declaration():
    print("\n2. sections: declared beats derived beats REFUSED")
    m = _rec(MARKED)
    check("a [SECTION] mark is DECLARED — the writer said so, and that "
          "outranks anything the harness can infer",
          m.how["sections"][0] == "declared"
          and [s["name"] for s in m["sections"]] == ["VERSE 1", "CHORUS"],
          f"{m['sections']}")
    b = _rec(BLANKS)
    check("blank-line blocks are DERIVED, not declared: a blank line is a "
          "printer's convention and the provenance says so rather than a "
          "comment nobody reads",
          b.how["sections"][0] == "derived" and len(b["sections"]) == 2,
          f"{b['sections']}")
    n = _rec(BARE)
    check("a text with NEITHER is REFUSED, not sectioned by a rule this "
          "module invented — a sectioning invented here would be graded as "
          "though the writer had asked for it (doctrine 20)",
          n.how["sections"][0] == "REFUSED" and n["sections"] == [])
    check("and the refusal names the remedy, so it is a work order",
          "Mark the sections" in n.how["sections"][1]
          or "blueprint" in n.how["sections"][1],
          n.how["sections"][1][:80])


def test_what_is_counted():
    print("\n3. what is COUNTED is arithmetic nobody can disagree with")
    m = _rec(MARKED)
    check("the line count is counted and is the sung lines, not the printed "
          "ones — the marks and the blank line are apparatus",
          m.how["total_lines"][0] == "counted" and m["total_lines"] == 6,
          f"{m['total_lines']} from {len(MARKED)} printed lines")
    check("syllables per line are COUNTED, one per sung line, through the "
          "same reader the in-line span layer uses",
          m.how["syllables_per_line"][0] == "counted"
          and len(m["syllables_per_line"]) == m["total_lines"]
          and all(x > 0 for x in m["syllables_per_line"]),
          f"{m['syllables_per_line']}")
    check("binding sites are counted, and there are MORE of them than there "
          "are lines — which is the whole point of recovering a web rather "
          "than a list of end words",
          m.how["binding_sites"][0] == "counted"
          and m["binding_sites"] > m["total_lines"],
          f"{m['binding_sites']} sites over {m['total_lines']} lines")


def test_meter_is_refused():
    print("\n4. the meter is REFUSED and the refusal names its remedy")
    m = _rec(MARKED)
    how, why = m.how["meter"]
    check("a bar grid is not inferred from syllable counts — it is a "
          "DECLARED coordinate, and inferring one would be the harness "
          "declaring a meter on the writer's behalf and then grading them "
          "against it", how == "REFUSED" and m["meter"] is None)
    check("and the refusal names the remedy (declare one) rather than "
          "stating a limitation", "--blueprint" in why, why[:90])
    check("the refusal does NOT reach for audio — counting is this "
          "project's instrument and the owner's ban on the other is "
          "standing", "audio" not in why.lower())


def test_the_web_is_over_placements():
    print("\n5. the web is a cover over PLACEMENTS, not over line ends")
    m = _rec(MARKED)
    check("the web is derived and non-empty on a text with rhyme in it",
          m.how["web"][0] == "derived" and m["web"], f"{len(m['web'])} edges")
    placed = [e for e in m["web"]
              if "." in e["a"] or "." in e["b"]]
    check("and it carries edges at placements OTHER than the line end — an "
          "end-anchored recovery could not have found these at all",
          placed, f"{len(placed)} of {len(m['web'])} edges name a placement")
    check("every edge names both its sites in the mandate's own spelling, so "
          "a recovered cover can be handed straight to `--groups=`",
          all(SL.parse_slot(e["a"]) and SL.parse_slot(e["b"])
              for e in m["web"]))
    check("SAME-LINE pairs are excluded: a group is a set of lines and a "
          "relation whose members share a line has one member, which is the "
          "refusal `quality/slots.py` already makes",
          all(e["a"].split(".")[0] != e["b"].split(".")[0]
              for e in m["web"]))


def test_the_cover_declares_its_dependence():
    print("\n6. the derived cover says it is NOT independent of the grader")
    m = _rec(MARKED)
    why = m.how["web"][1]
    check("doctrine 14 is stated in the coordinate itself, not left to a "
          "reader: every edge is a band-passing pair BY CONSTRUCTION, so "
          "grading this cover against the same band cannot produce a "
          "violation", "doctrine 14" in why and "CONSTRUCTION" in why)
    check("...and it says what such a cover CAN say non-trivially, so the "
          "disclosure is a bound on the claim rather than a disclaimer that "
          "voids it", "non-trivially" in why)
    check("the theta it was derived at is named — a cover derived at one "
          "theta is an ordinary independent mandate at another",
          "theta" in why, why[:100])


def test_the_bound_is_declared():
    print("\n7. the bound is declared, and a truncation would be LOUD")
    r = RC.recover(_sung(MARKED), raw_lines=MARKED, max_pairs=3)
    how, why = r.how["web"]
    check("past the declared pair bound the web REFUSES rather than "
          "returning a truncated one — a silently truncated web reads as a "
          "song with fewer relations in it (no silent caps)",
          how == "REFUSED" and r["web"] == [])
    check("and the refusal quotes the bound it hit and the population it "
          "would have compared, so the remedy is computable",
          "3" in why and "binding sites" in why, why[:110])


def main():
    for fn in (test_provenance_is_closed, test_sections_prefer_the_declaration,
               test_what_is_counted, test_meter_is_refused,
               test_the_web_is_over_placements,
               test_the_cover_declares_its_dependence,
               test_the_bound_is_declared):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
