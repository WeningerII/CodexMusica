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


def test_the_doctrine_14_claim_is_GRADED_not_grepped():
    """§8. THE CLAIM THIS MODULE MAKES ABOUT ITSELF, PUT TO THE GRADER.

    `web`'s own `why` says grading this cover against the same band at the
    same theta "cannot produce a rhyme violation". Until 2026-08-26 that was
    FALSE through this module's only documented handoff, and NOTHING HERE
    COULD SEE IT: §6 checks the sentence by grepping for `doctrine 14`,
    `CONSTRUCTION`, `non-trivially` and `theta`, so a false sentence passed
    four greps. MEASURED at the time on `quality/fixtures/song.txt`: the whole
    web handed to `--groups=` charges 34 SCHEME_VIOLATION — exactly its 34
    REPEAT edges — about pairs this module admitted FOR BEING IDENTICAL,
    because a `--groups=` group is REQUIRE_RHYME and REPEAT is a violation
    there (doctrine 3's second half).

    So this section GRADES. It is the only check in the file that runs a
    judge, and it is the mutation guard for the split: restoring
    `rhymes = list(edges)` in `recover` takes it red.
    """
    print("\n8. the doctrine-14 claim is GRADED, not grepped")
    import lyric_harness as LH
    lines = _sung(MARKED)
    r = RC.recover(lines, raw_lines=MARKED)
    ms = r.get("mandate_spelling")
    check("the cover is offered as the CLI's OWN two mandate flags, because "
          "it holds two DIFFERENT demands and `--groups=` can state only one",
          isinstance(ms, dict) and set(ms) == {"--groups=", "--returns="},
          str(sorted(ms))[:90] if isinstance(ms, dict) else repr(ms))

    reps = [e for e in r["web"] if e["relation"] == "REPEAT"]
    band = [e for e in r["web"] if e["relation"] != "REPEAT"]
    check("the fixture HAS both kinds — a section that graded a REPEAT-free "
          "cover would pass against the defect and prove nothing",
          reps and band, f"{len(reps)} REPEAT, {len(band)} band")

    from quality import schemes as SC
    from quality.revise import Reviser

    def _violations(spec):
        """The SAME judge `brief FILE --groups=SPEC` runs, reached the same
        way the CLI reaches it: one `Mandate` off the spec, one `inspect`."""
        if not spec:
            return 0
        m = SC.mandate([g.split(",") for g in spec.split(";")],
                       n_lines=len(lines))
        rv = Reviser(LH.Lexicon(), LH.Declaration())
        found = rv.inspect(list(lines), mandate=m)["per_line"]
        return sum(1 for fs in found.values() for f in fs
                   if getattr(f, "code", "") == "SCHEME_VIOLATION")

    # The WHOLE web is what the module used to hand over, and it is the
    # control: if this is 0 the fixture cannot discriminate and the check
    # below examined nothing (doctrine 48's own failure mode).
    whole = ";".join(f"{e['a']},{e['b']}" for e in r["web"])
    check("the WHOLE web DOES charge violations — this is the defect, "
          "measured, and it is the control that makes the next check "
          "non-vacuous",
          _violations(whole) > 0, f"{_violations(whole)} SCHEME_VIOLATION")
    check("and `mandate_spelling['--groups=']` charges NONE, which is the "
          "doctrine-14 sentence made TRUE rather than asserted",
          _violations(ms["--groups="]) == 0,
          f"{_violations(ms['--groups='])} SCHEME_VIOLATION")

    placed = [e for e in reps
              if "." in str(e["a"]) or "." in str(e["b"])]
    if placed:
        check("a REPEAT edge binding at a PLACEMENT is REFUSED and names its "
              "remedy — no mandate spelling in this harness can hold one, "
              "and flattening it to line numbers would declare an identity "
              "between two line ENDS this module never measured",
              r.how.get("repeats_at_a_placement", ("", ""))[0] == "REFUSED"
              and "_normalise_returns" in
              r.how.get("repeats_at_a_placement", ("", ""))[1],
              f"{len(placed)} placed REPEAT edge(s)")


def test_the_placement_set_is_the_CALLERS_and_it_is_reachable():
    """§9. M-145(b) — a recovered `T<n>` binding is ADMISSIBLE, and the
    coordinate that says so has to be REACHABLE or the ruling is prose.

    `recover()` has taken `placements=` since it was written and its default
    was `slots.PLANNABLE_PLACEMENTS` — a tuple whose own docstring scopes it
    to *"WHAT A PLANNER MAY VOLUNTEER"*, read here as a bound on what a
    reader may OBSERVE. `__main__` took a path and no flag, so the only way
    to declare anything else was to drop to Python: built, tested and
    unreachable, which is this repository's most-repeated defect at the
    outermost layer.

    THE CHECKS ARE DIFFERENCES, NOT STRING MATCHES. A flag that is parsed
    and dropped renders BYTE-IDENTICALLY to one that is read, which is how
    `--returns=` went three days unread (`test_verbs.py` §19's own lesson),
    so the load-bearing assertion here is that two runs DISAGREE.
    """
    print("\n9. the placement set is the CALLER'S, and it is reachable")
    check("the default is this module's own constant, IMPORTED from `slots` "
          "rather than respelled, so the two cannot drift (doctrine 1)",
          RC.RECOVERABLE_PLACEMENTS is SL.PLANNABLE_PLACEMENTS,
          f"{RC.RECOVERABLE_PLACEMENTS}")
    base = _rec(MARKED)
    wide = RC.recover(_sung(MARKED), raw_lines=MARKED,
                      placements=("end", "endword", "head", "headrime",
                                  "T2", "T3", "T4"))
    check("...and it is BYTE-IDENTICAL in value to what this function "
          "already searched, so the ruling moves no recovered cover",
          base["placements_searched"] == ["end", "endword", "head",
                                          "headrime"],
          f"{base['placements_searched']}")
    check("a declared `T<n>` set is READ — the two covers DISAGREE, which a "
          "dropped flag could not do",
          wide["binding_sites"] > base["binding_sites"]
          and len(wide["web"]) != len(base["web"]),
          f"default {base['binding_sites']} sites / {len(base['web'])} edges "
          f"-> declared {wide['binding_sites']} / {len(wide['web'])}")
    tn = [e for e in wide["web"]
          if "T" in str(e["a"]) or "T" in str(e["b"])]
    check("...and the added edges NAME the placement, so a recovered `T<n>` "
          "binding is spellable and not merely counted",
          tn and all("T" not in str(e["a"]) and "T" not in str(e["b"])
                     for e in base["web"]),
          f"{len(tn)} of {len(wide['web'])} declared-run edges name a T<n>, "
          f"against 0 of {len(base['web'])} by default")
    check("the coordinate is RECORDED on the result with its provenance — "
          "`declared` when the caller said so, `derived` when it is this "
          "module's default and not a fact about the text",
          base.how["placements_searched"][0] == "derived"
          and wide.how["placements_searched"][0] == "declared",
          f"{base.how['placements_searched'][0]} / "
          f"{wide.how['placements_searched'][0]}")
    check("...and RENDERED, because a placement not searched is not a "
          "placement the text lacks (doctrine 20)",
          "PLACEMENTS SEARCHED" in RC.render(base),
          "render() names the set it swept")

    # THE REFUSAL IS AT DECLARATION AND NOT PER LINE. `_slot_words` SKIPS a
    # placement naming nothing in a given line — correct, and a different
    # question. Leaning on that skip would let a mistyped `--placements=T4x`
    # silently NARROW the search and report the smaller web as the text's.
    for bad in ("T4x", "endwrod", ""):
        try:
            RC.parse_placements(bad)
            check(f"an unresolvable placement {bad!r} REFUSES by name", False,
                  "it was accepted")
        except SL.SlotUnsupported as exc:
            check(f"an unresolvable placement {bad!r} REFUSES by name",
                  bad in str(exc) or "names no placement" in str(exc),
                  str(exc)[:90])
    check("...and a resolvable one does NOT refuse — the guard is not "
          "refusing everything",
          RC.parse_placements("end, head ,T4") == ("end", "head", "T4"),
          "whitespace tolerated, order kept")
    check("`line` stays DECLARABLE, which is `PLANNABLE_PLACEMENTS`' own "
          "word for it — its exclusion is about volunteering a holorhyme, "
          "not about a reader being unable to name one",
          RC.parse_placements("line") == ("line",),
          "declarable, never volunteered")


def main():
    for fn in (test_provenance_is_closed, test_sections_prefer_the_declaration,
               test_what_is_counted, test_meter_is_refused,
               test_the_web_is_over_placements,
               test_the_cover_declares_its_dependence,
               test_the_bound_is_declared,
               test_the_doctrine_14_claim_is_GRADED_not_grepped,
               test_the_placement_set_is_the_CALLERS_and_it_is_reachable):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
