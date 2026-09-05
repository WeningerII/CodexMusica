#!/usr/bin/env python3
"""Regressions for the GATE CENSUS — which findings can refuse anything.

The owner's standing rule is that a note is a record and only a gate is an
enforcement. Across every finding code this tree can emit that rule cannot be
kept by memory, which is doctrine 48's own subject: this suite pins the
instrument that makes it a command. The counts live in `GC.PINNED` and are
read from there rather than restated here, so this docstring cannot go stale
against the thing it describes (doctrine 1).

Sections:
  1  the census counts what it says it counts, and cannot miss a layer
  2  the gate sets are READ from the modules that own them
  3  undecidable is EMPTY, asserted before the checks that walk that list
  4  the causes stay apart, and the four-spelling reader is load-bearing
  5  the pin moves when the tree does
  6  every disclosed-only code carries a DECLARED disposition

UNDECIDABLE REACHED 0 ON 2026-08-23 (`MISSING.md` M-77) and that turned two
of these checks vacuous — `all()` over an empty list is True and reads exactly
like a check that examined something, which is the defect this repo found in
seven of its own checks and fixed by mutation. Sections 3 and 4 assert the
POPULATION first and then prove the classifier still classifies by taking the
spelling away, because "0 undecidable" and "the census stopped answering"
produce the same number.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality import gate_census as GC                          # noqa: E402
from quality.floor import LENGTH_GATE_CODES                    # noqa: E402
from quality.loop import MANDATORY_PURSUE                      # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_census_sees_every_layer():
    print("\n1. the census counts what it says, and cannot miss a layer")
    c = GC.census()
    s = GC.summarize(c)
    check("the three verdicts partition the codes — every code has exactly "
          "one, and they sum to the total (this is the ONE place a sum is "
          "correct, because it is a partition and not three measurements)",
          s["gated"] + s["disclosed_only"] + s["undecidable"] == s["codes"],
          f"{s}")
    check("the SHAPE layer is visible. Its constructor joined on the "
          "instrument's first run, which had silently omitted "
          "`quality/grid.py` entirely — a census blind to a whole layer "
          "reports that layer as fully gated, the flattering direction",
          "GridFinding" in GC.FINDING_CONSTRUCTORS
          and "HOOK_ABSENT" in c, f"{sorted(GC.FINDING_CONSTRUCTORS)}")
    check("the rhyme, meter, floor and shape layers all contribute codes, so "
          "no single module's convention decides the answer",
          {"revise.py", "fit.py", "floor.py", "grid.py"}
          <= {f for r in c.values() for f in r["files"]},
          f"{sorted({f for r in c.values() for f in r['files']})}")
    check("the skipped prefixes are DECLARED, not implicit — an exclusion "
          "nobody writes down is a threshold nobody wrote down (doctrine 58)",
          GC.SKIP_PREFIX and all(isinstance(x, str) for x in GC.SKIP_PREFIX),
          f"{GC.SKIP_PREFIX}")


def test_gate_sets_are_read_not_respelled():
    print("\n2. the gate sets are READ from the modules that own them")
    c = GC.census()
    for code in MANDATORY_PURSUE:
        if code in c:
            check(f"`{code}` is GATED via the pursue set, which the census "
                  f"reads from `quality/loop.py` rather than respelling",
                  c[code]["verdict"] == "GATED"
                  and "MANDATORY_PURSUE" in c[code]["gates"],
                  f"{c[code]['gates']}")
    for code in LENGTH_GATE_CODES:
        if code in c:
            check(f"`{code}` is GATED via the length gate, read from "
                  f"`quality/floor.py`",
                  c[code]["verdict"] == "GATED"
                  and "LENGTH_GATE_CODES" in c[code]["gates"],
                  f"{c[code]['gates']}")
    check("a pursued NOTE is GATED — which is the whole reason a note is not "
          "automatically toothless, and the mechanism doctrine 9 needed",
          any(c[k]["severities"] == ["note"] and k in MANDATORY_PURSUE
              for k in c), "pursued notes count as enforcement")


def test_undecidable_is_never_counted_as_gated():
    print("\n3. an undecidable code is NEVER counted as gated")
    c = GC.census()
    und = [k for k, v in c.items() if v["verdict"] == "UNDECIDABLE"]
    # UNDECIDABLE IS 0 SINCE M-77, so the two checks that walk that list are
    # now VACUOUS — `all()` over an empty list is True and would read exactly
    # like a check that examined something. The population is asserted FIRST
    # so the section cannot pass by looking at nothing (this repo's own
    # seven-vacuous-checks lesson, applied to the suite that found it).
    check("the undecidable list is EMPTY, which is the claim M-77 makes — "
          "every code this tree can emit has a severity readable at its "
          "emitter, in one of the four declared spellings",
          und == [], f"{len(und)} undecidable: {und}")
    check("no undecidable code carries a gate — vacuous today by design, and "
          "kept because the moment a new constructor arrives it stops being "
          "vacuous and this is the check that catches a gate hiding inside "
          "an unreadable severity",
          all(not c[k]["gates"] for k in und), f"{len(und)} undecidable")
    dis = [k for k, v in c.items() if v["verdict"] == "DISCLOSED-ONLY"]
    check("every DISCLOSED-ONLY code is a note at every construction site — "
          "the claim is that nothing CAN refuse on it, so a single flag "
          "construction anywhere must move it",
          all(c[k]["severities"] == ["note"] for k in dis),
          f"{len(dis)} disclosed-only")


def test_the_two_causes_are_apart():
    print("\n4. the causes stay reported APART, and the READING is load-bearing")
    s = GC.summarize(GC.census())
    check("computed-at-the-call-site and no-severity-field-at-all are still "
          "counted separately and still sum to the undecidable total: they "
          "ask different things of whoever closes them, and one total would "
          "hide the second entirely",
          s["computed"] + s["consumer_assigned"] == s["undecidable"],
          f"{s['computed']} computed + {s['consumer_assigned']} "
          f"consumer-assigned = {s['undecidable']}")
    # THE MUTATION THAT MAKES THIS SECTION NON-VACUOUS. Both causes are 0 now,
    # so asserting "both are present" would fail and asserting "both are zero"
    # would pass against a census that had simply stopped classifying. Take
    # away the SPELLING and the codes must fall back into undecidable — that
    # is the proof the four-spelling reader is doing the work and not merely
    # present, and it is the same shape as §5's constructor mutation.
    real = GC.SEVERITY_SPELLING
    try:
        GC.SEVERITY_SPELLING = {}
        blind = GC.summarize(GC.census())
    finally:
        GC.SEVERITY_SPELLING = real
    check("forgetting that `FitFinding` spells its severity `satisfiable` "
          "puts 18 codes straight back into UNDECIDABLE — so the reading is "
          "READ, and the 0 is an answer rather than a classifier that "
          "stopped classifying",
          blind["consumer_assigned"] > 0
          and blind["undecidable"] > s["undecidable"],
          f"blind to the spelling: {blind['undecidable']} undecidable "
          f"({blind['consumer_assigned']} consumer-assigned) vs "
          f"{s['undecidable']} when it is read")
    check("...and the restoration held",
          GC.summarize(GC.census()) == GC.PINNED)
    # THE SAME PROOF FOR THE TERNARY SHAPE, added 2026-09-05 (`MISSING.md`
    # M-239) because the census met it in the wild and failed: the
    # length-curve adoption made `CLICHE_PAIR`'s severity depend on which
    # rows carry a rate at the text's length, so `floor.py` writes it as
    # `sev("flag") if (...) else "note"`, and a resolver that read only a
    # call and a bare name filed that DECIDED code as undecidable — the
    # gated count fell 24 -> 23 and this suite went red. A shape the
    # resolver cannot read is not the tree's defect, it is the census's,
    # and it fails in the census's own flattering direction (a bigger
    # UNDECIDABLE makes the tree look worse and the instrument look more
    # necessary). Take the shape away and the code must fall back, or the
    # reader is not doing the work.
    _real_ifexp = GC._ceiling_severity

    def _blind_to_ternaries(expr, scope):
        import ast as _ast
        if isinstance(expr, _ast.IfExp):
            return None
        return _real_ifexp(expr, scope)

    try:
        GC._ceiling_severity = _blind_to_ternaries
        blind_t = GC.summarize(GC.census())
    finally:
        GC._ceiling_severity = _real_ifexp
    check("and forgetting that a severity may be written as a TERNARY puts "
          "`CLICHE_PAIR` straight back into UNDECIDABLE — the shape the "
          "census actually met on 2026-09-05, so this reading is READ too "
          "and the 0 is an answer",
          blind_t["undecidable"] > s["undecidable"]
          and blind_t["gated"] < s["gated"],
          f"blind to the ternary: {blind_t['undecidable']} undecidable, "
          f"{blind_t['gated']} gated vs {s['undecidable']} and {s['gated']} "
          f"when it is read")
    check("...and THAT restoration held too",
          GC.summarize(GC.census()) == GC.PINNED)


def test_the_pin_moves_when_the_tree_does():
    print("\n5. the pin moves when the tree does")
    s = GC.summarize(GC.census())
    check("the live census matches the pin — a finding added without a gate "
          "MOVES a number instead of joining a list nobody reads",
          s == GC.PINNED, f"live {s} vs pinned {GC.PINNED}")
    check("the pin is on the COUNTS and not the membership, so a new finding "
          "is a question rather than a merge conflict",
          set(GC.PINNED) == {"codes", "gated", "disclosed_only",
                             "undecidable", "computed", "consumer_assigned"})
    # THE MUTATION: drop a constructor and the census must notice, which is
    # what makes this a gate rather than a report about itself.
    real = GC.FINDING_CONSTRUCTORS
    try:
        GC.FINDING_CONSTRUCTORS = ("Finding",)
        moved = GC.summarize(GC.census())
    finally:
        GC.FINDING_CONSTRUCTORS = real
    check("removing a constructor MOVES the census, so the instrument is "
          "read rather than merely present — a census that could not fail "
          "reads exactly like one that passes",
          moved != GC.PINNED and moved["codes"] < GC.PINNED["codes"],
          f"one constructor: {moved['codes']} codes vs "
          f"{GC.PINNED['codes']}")
    check("...and the restoration held, so no later section inherits a "
          "mutated instrument",
          GC.summarize(GC.census()) == GC.PINNED)


def test_every_toothless_code_is_ruled():
    print("\n6. every disclosed-only code carries a DECLARED disposition")
    c = GC.census()
    dis = [k for k, v in c.items() if v["verdict"] == "DISCLOSED-ONLY"]
    check("the population is non-empty, so this section cannot pass by "
          "examining nothing", len(dis) > 0, f"{len(dis)} disclosed-only")
    check("...and NONE is unruled. M-73 produced the LIST and said the "
          "question 'should this one gate?' must be asked of each code by a "
          "person; a list nobody answers is the same defect one level up",
          GC.unruled(c) == [], f"unruled: {GC.unruled(c)}")
    check("every ruling is inside the CLOSED vocabulary, so a new kind is "
          "added deliberately rather than by somebody typing a new string "
          "(doctrine 58)",
          all(d in GC.DISPOSITIONS for d in GC.DISPOSITION.values()),
          f"{sorted(GC.DISPOSITIONS)}")
    # `PROMOTE_CANDIDATE` IS A WORD THE VOCABULARY KEEPS, NOT A QUOTA THE
    # ROSTER MUST FILL — REPOINTED 2026-08-24. This check read
    # `by_disposition(c).get("PROMOTE_CANDIDATE")` and required the SHIPPED
    # table to hold at least one, on the argument that a ruling can be WORK
    # rather than a settled answer (doctrine 20). That argument is untouched
    # and the assertion was the wrong shape for it: the owner ruled on all
    # three candidates in one sitting — `HOOK_DOES_NOT_RECUR` (`M-84`),
    # `SHARED_SUFFIX` (`M-85`), `TITLE_NOT_IN_HOOK` (`M-86`) — so the queue
    # went to ZERO and the suite went red for the roster having been WORKED.
    # A check that fails when the open questions are all answered is asking
    # for a backlog, and an EMPTY queue is a legitimate state of this table.
    #
    # THE SUBJECT IS THAT THE CENSUS CAN REPORT ONE, and that is proven by a
    # MUTATION rather than by the shipped contents — the same move §5 makes
    # on `FINDING_CONSTRUCTORS`. The count is DISCLOSED beside it, because
    # "nobody has open questions" and "the word is unreachable" are different
    # states and only the second is a defect.
    open_now = GC.by_disposition(c).get("PROMOTE_CANDIDATE") or []
    real_d = dict(GC.DISPOSITION)
    try:
        GC.DISPOSITION["QUATRAIN_LOCK"] = "PROMOTE_CANDIDATE"
        planted = GC.by_disposition(GC.census()).get("PROMOTE_CANDIDATE") or []
    finally:
        GC.DISPOSITION.clear(); GC.DISPOSITION.update(real_d)
    check("`PROMOTE_CANDIDATE` is REACHABLE — the vocabulary keeps a word for "
          "'this should probably gate and it is not mine to decide', so a "
          "ruling can be WORK rather than a settled answer (doctrine 20). "
          "Proven by planting one, because the shipped queue may honestly be "
          "empty and a check that demands a backlog is asking the roster not "
          "to be worked",
          "PROMOTE_CANDIDATE" in GC.DISPOSITIONS
          and list(planted) == ["QUATRAIN_LOCK"],
          f"planted -> {list(planted)}; open in the shipped table: "
          f"{list(open_now)}")
    check("...and the restoration held, so the shipped queue is read as it "
          "ships and no later section inherits a planted ruling",
          (GC.by_disposition(GC.census()).get("PROMOTE_CANDIDATE") or [])
          == list(open_now),
          f"{list(open_now)}")
    # THE MUTATIONS: both branches of the gate must actually refuse.
    real = dict(GC.DISPOSITION)
    try:
        GC.DISPOSITION.pop("QUATRAIN_LOCK")
        rc_unruled = GC.main(["--check"])
    finally:
        GC.DISPOSITION.clear(); GC.DISPOSITION.update(real)
    try:
        GC.DISPOSITION["QUATRAIN_LOCK"] = "PROBABLY_FINE"
        rc_offvocab = GC.main(["--check"])
    finally:
        GC.DISPOSITION.clear(); GC.DISPOSITION.update(real)
    check("removing one ruling REFUSES at exit 3 — the gate is read, not "
          "merely present", rc_unruled == 3, f"exit {rc_unruled}")
    check("and a disposition outside the vocabulary REFUSES too, so the "
          "closed set is closed by a check and not by hoping",
          rc_offvocab == 3, f"exit {rc_offvocab}")
    check("...and the restoration held, so no later section inherits a "
          "mutated table", GC.unruled() == [])


def main():
    for fn in (test_the_census_sees_every_layer,
               test_gate_sets_are_read_not_respelled,
               test_undecidable_is_never_counted_as_gated,
               test_the_two_causes_are_apart,
               test_the_pin_moves_when_the_tree_does,
               test_every_toothless_code_is_ruled):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
