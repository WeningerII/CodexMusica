#!/usr/bin/env python3
"""Regressions for the SECTION PLACEMENT layer (`MISSING.md` M-54).

The rule "an outro is last" was true of every plan the planner produced and
was stated in no coordinate: `plan._sample_pattern` enforced it by the ORDER
OF TWO `append` CALLS. So nothing could consult it — a hand-written blueprint
with an outro in the middle graded clean — and the roster could not be
extended by a table row.

Sections:
  1  the table declares, and REFUSES a claim it cannot evidence
  2  a claim and a REFUSAL are different empty states (doctrine 20)
  3  `placement_findings` is the one definition, and what it does NOT charge
  4  the planner DERIVES its edges and its admissibility from the same table
  5  the grader reaches it, and quotes the gloss that licensed the rule
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import grid as GR                                  # noqa: E402
from quality import plan as PL                                  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_table():
    print("\n1. the table declares, with evidence")
    F = GR.SECTION_FUNCTIONS
    claimed = [n for n, sp in F.items()
               if sp.boundary or sp.requires or sp.adjacent_after
               or sp.adjacent_before or sp.needs_before or sp.needs_after]
    check("EVERY placement claim quotes a phrase that really occurs in a "
          "gloss in this vocabulary — the check that a rule can be traced "
          "back to the definition it came from, rather than asserted "
          "(doctrine 45)",
          all(F[n].placement_evidence
              and F[n].placement_evidence in " || ".join(
                  s.gloss for s in F.values())
              for n in claimed),
          f"{len(claimed)} rows claim something")
    check("exactly THREE rows carry a boundary — position is mostly DERIVED, "
          "which is the finding that killed `position in {first,last,free}`",
          sorted(n for n, sp in F.items() if sp.boundary)
          == ["coda", "intro", "outro"])
    check("`false_ending` needs something AFTER it — the keyword derivation "
          "read it as `last` on the word *close* and inverted the sign",
          F["false_ending"].needs_after and not F["false_ending"].boundary)
    check("`turnaround` and `interlude` are BETWEEN things, so neither first "
          "nor last",
          all(F[n].needs_before and F[n].needs_after
              for n in ("turnaround", "interlude")))
    check("`prechorus`/`postchorus` REQUIRE a chorus — the roster "
          "precondition, which is a different question from adjacency and "
          "is why they are separate fields",
          F["prechorus"].requires == ("chorus",)
          and F["postchorus"].requires == ("chorus",))


def test_refusal_is_not_absence():
    print("\n2. a REFUSAL and NO CLAIM are different states")
    F = GR.SECTION_FUNCTIONS
    check("`verse` claims nothing AND refuses nothing — nothing denies it a "
          "position, so the layer says nothing. That is the answer to \"does "
          "verse know it can be first, free, and/or last\": it does not need "
          "to, because the layer only ever DENIES",
          not F["verse"].placement_refused
          and not F["verse"].boundary and not F["verse"].needs_before)
    check("`tag` REFUSES, and records why — its gloss says \"closing a "
          "section OR THE SONG\" and asserts both readings, so picking one "
          "would settle by table order what the vocabulary has not settled "
          "(doctrine 20)",
          bool(F["tag"].placement_refused)
          and "OR THE SONG" in F["tag"].placement_refused)
    check("`drop` REFUSES the build edge in BOTH directions, and the "
          "refusal names the asymmetry rather than hiding it",
          bool(F["drop"].placement_refused)
          and "ruling, not a reading" in F["drop"].placement_refused)
    check("a REFUSED row is SILENT in the grader — it is not a violation, it "
          "is a question the table declined to answer",
          GR.placement_findings(["verse", "chorus", "tag"]) == []
          and GR.placement_findings(["tag", "verse", "chorus"]) == [])


def test_findings():
    print("\n3. `placement_findings` — the one definition")
    def codes(fns):
        return [c for c, _, _ in GR.placement_findings(fns)]
    check("a clean song is silent",
          codes(["intro", "verse", "chorus", "outro"]) == [])
    check("an outro in the middle is caught — the case that graded CLEAN "
          "before this layer existed",
          codes(["verse", "outro", "chorus"]) == ["SECTION_NOT_AT_BOUNDARY"])
    check("an intro that is not first is caught",
          codes(["verse", "intro"]) == ["SECTION_NOT_AT_BOUNDARY"])
    check("a prechorus in a song with NO chorus is caught, and it is the "
          "ROSTER question — the owner's \"this song has no chorus so we "
          "neither pre nor post\"",
          "SECTION_REQUIREMENT_ABSENT" in codes(["verse", "prechorus"]))
    check("an interlude at either edge is caught — 'between sung sections' "
          "with nothing sung on one side",
          codes(["interlude", "verse"])[:1] == ["SECTION_AT_EDGE"]
          and codes(["verse", "interlude"])[:1] == ["SECTION_AT_EDGE"])
    check("a postchorus that does not follow a chorus is caught",
          "SECTION_NOT_ADJACENT" in codes(["verse", "postchorus", "chorus"]))
    # WHAT IT DOES NOT CHARGE, and each is a doctrine-79 line.
    check("an UNDECLARED section is skipped, never guessed at — a section "
          "nobody typed a function on cannot violate a rule about functions",
          codes([None, None, None]) == [])
    check("...and it still OCCUPIES a position, so a needs_after section "
          "followed only by undeclared sections is NOT charged: something "
          "does follow it",
          codes(["verse", "interlude", None]) == [])
    check("an unknown function name does not raise — the vocabulary's own "
          "refusal happens at `as_function`, not here",
          codes(["verse", "not_a_function"]) == [])


def test_planner_derives():
    print("\n4. the planner derives from the SAME table")
    first, last = PL._edges()
    check("the edges are READ off `FunctionSpec.boundary`, not written into "
          "control flow — the literals were `\"intro\"` and "
          "`(\"outro\", \"coda\")` inside `_sample_pattern`",
          first == ("intro",) and last == ("coda", "outro"),
          f"first={first} last={last}")
    bad = plans = 0
    emitted = set()
    for seed in range(200):
        p = PL.make_plan(seed, form="verse-chorus")
        plans += 1
        fns = [s.get("function") for s in p.get("sections", [])
               if s.get("function")]
        emitted |= set(fns)
        if GR.placement_findings(fns):
            bad += 1
    check("NO plan violates the vocabulary's own definitions. Measured "
          "before this layer: 19 of 300, every one an `interlude` opening or "
          "closing the song — a span whose gloss is \"between sung sections\"",
          bad == 0, f"{plans} plans, {bad} violating")
    check("...and the constraint pruned nothing legitimate: the planner "
          "still emits 14 of the 21 declared functions",
          len(emitted & set(GR.SECTION_FUNCTIONS)) == 14,
          f"{len(emitted)} functions emitted")
    check("the sampler REFUSES rather than hanging if the constraints and "
          "the cell grammar do not intersect — rejection sampling is uniform "
          "over the accepted set, and a bound is what keeps it terminating",
          isinstance(PL.PATTERN_ATTEMPTS, int) and PL.PATTERN_ATTEMPTS > 0)


def test_grader_reaches_it():
    print("\n5. the grader reaches it and quotes its evidence")
    song = GR.Song(sections=(GR.Section("a", 4, function="verse"),
                             GR.Section("b", 4, function="outro"),
                             GR.Section("c", 4, function="chorus")))
    rep = GR.song_function_report(song)
    hits = [f for f in rep["findings"] if f.code in GR.PLACEMENT_CODES]
    check("a blueprint with an outro in the middle now produces a finding — "
          "before this it graded CLEAN, because the rule lived in the "
          "planner's control flow and the grader had never heard of it",
          len(hits) == 1, str(hits[:1]))
    check("...and the finding QUOTES the gloss that licensed the rule, so a "
          "reader can check the claim rather than take it",
          hits and "closes the song" in hits[0].evidence)
    clean = GR.Song(sections=(GR.Section("a", 4, function="intro"),
                              GR.Section("b", 4, function="verse"),
                              GR.Section("c", 4, function="outro")))
    check("a correctly-ordered song produces none",
          [f for f in GR.song_function_report(clean)["findings"]
           if f.code in GR.PLACEMENT_CODES] == [])
    check("the whole ordered list is ONE question, not one per section — "
          "`song_function_report`'s own counting docstring records what "
          "happens when a question is counted per record instead "
          "(`asked 3, answered -1`)",
          GR.song_function_report(song)["asked"]
          == GR.song_function_report(clean)["asked"],
          f"{GR.song_function_report(song)['asked']} either way")


if __name__ == "__main__":
    for fn in (test_table, test_refusal_is_not_absence, test_findings,
               test_planner_derives, test_grader_reaches_it):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)[:400]}")
        sys.exit(1)
    print("where a section may go is a DECLARED coordinate, and the planner "
          "and the grader read one table")
