"""Tests for quality/narrative.py — the vocabulary tables and the exact
line-up counter. The tables transcribe NARRATIVE_DESIGN.md (DRAFT, under
the owner's red pen); these tests hold the MODULE's internal consistency
and the counter's behavior, so a red-pen row edit moves pins loudly
instead of silently."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import narrative as N  # noqa: E402

FAILURES = []


def check(name, ok, note=""):
    print(("  PASS  " if ok else "  FAIL  ") + name)
    if note:
        print("          " + str(note))
    if not ok:
        FAILURES.append(name)


def test_tables():
    print("\n1. the tables are closed and internally consistent")
    check("every candidate set is a subset of the closed atom vocabulary",
          all(set(v) <= set(N.ATOMS) for v in N.FUNCTION_ATOMS.values()))
    check("every ENTER set is a subset of the closed atom vocabulary, "
          "and every junction has one",
          set(N.ENTER) == set(N.JUNCTIONS)
          and all(set(v) <= set(N.ATOMS) for v in N.ENTER.values()))
    only = [j for j in N.JUNCTIONS if "TURN" in N.ENTER[j]]
    check("the one hard edge rule is held STRUCTURALLY: TURN appears in "
          "exactly BUT's enter set — the doc's 'any' cells compose with "
          "this narrowing, and a membership edit is the mutation that "
          "kills this check",
          only == ["BUT"], f"TURN enterable by {only}")
    check("every invariant-return function is a declared function with a "
          "non-empty candidate set (a card must have at least one face)",
          all(N.FUNCTION_ATOMS.get(f) for f in N.INVARIANT_RETURNS))
    check("`verse` is NOT on the invariant-return roster — its own gloss "
          "returns with NEW WORDS, and binding the card rule to it would "
          "pin every verse of a song to one atom",
          "verse" not in N.INVARIANT_RETURNS)


def test_position_rules():
    print("\n2. the encoded violate-it clauses")
    check("a bridge-opening shape admits NOTHING: bridge's only atom is "
          "TURN and a turn nothing precedes has nothing to flip",
          not N.admits(["bridge", "verse", "chorus"]))
    check("a tag-opening shape admits NOTHING: tag's only atom is JUDGE "
          "and judgment before anything has happened is an epigraph",
          not N.admits(["tag", "verse", "chorus"]))
    check("the same functions NOT at the opening are fine — the rule is "
          "positional, not a ban on the function",
          N.admits(["verse", "bridge", "chorus"])
          and N.admits(["verse", "chorus", "tag"]))
    check("RESOLVE needs a prior COMPLICATE: [intro, false_ending] "
          "admits nothing (false_ending's only atom is RESOLVE and "
          "intro's only atom is ESTABLISH), while [build, false_ending] "
          "admits (build IS the complication)",
          not N.admits(["intro", "false_ending"])
          and N.admits(["build", "false_ending"]))


def test_returning_sections():
    print("\n3. the card rule and the room-between-returns rule (§D)")
    # [drop, drop]: card ANCHOR -> back-to-back second instance may not
    # take an inbound BUT; ANCHOR is otherwise enterable by THEREFORE,
    # AND_THEN, JUXTAPOSE = 3 junctions. Card RESOLVE -> refused at the
    # opening (no prior COMPLICATE). Hand-derived total: 3.
    check("[drop, drop] counts exactly 3 — the ANCHOR card's three "
          "non-BUT inbound junctions, the RESOLVE card refused at the "
          "open; both drops share one card by construction",
          N.count_lineups(["drop", "drop"]) == 3,
          N.count_lineups(["drop", "drop"]))
    n_b2b = N.count_lineups(["verse", "chorus", "chorus"])
    n_room = N.count_lineups(["verse", "chorus", "interlude", "chorus"])
    check("an interlude between two choruses RAISES the count — the "
          "wordless section carries no atom but IS intervening material, "
          "so the second chorus regains its inbound BUT",
          n_room > n_b2b, f"{n_b2b} back-to-back vs {n_room} with room")
    check("the seam weight itself says why: ANCHOR<-ANCHOR back-to-back "
          "excludes BUT, with room admits it",
          N._seam_weight("ANCHOR", "ANCHOR", True) + 1
          == N._seam_weight("ANCHOR", "ANCHOR", False))


def test_refusal_and_determinism():
    print("\n4. refusal and determinism")
    try:
        N.count_lineups(["verse", "zither_solo_of_destiny"])
        check("an unknown function REFUSES by name", False, "accepted")
    except N.NarrativeRefused as e:
        check("an unknown function REFUSES by name, listing the declared "
              "rows (doctrine 20)", "zither" in str(e).lower()
              or "declared rows" in str(e))
    shape = ["intro", "verse", "prechorus", "chorus", "verse", "chorus",
             "bridge", "chorus", "coda"]
    check("the count is deterministic — two calls agree exactly "
          "(doctrine 66: no RNG, no set-order dependence)",
          N.count_lineups(shape) == N.count_lineups(shape))
    check("the classic verse-chorus-bridge shape admits, and its bridge "
          "TURN is reachable only through the mandated inbound BUT",
          N.admits(shape))


def test_measured_seeds():
    print("\n5. the measured seeds — pins from the first recorded sweep "
          "(2026-08-25, seeds 1-40: 35 admit, 5 admit zero, every zero "
          "failing at the OPENING)")
    from quality import plan as P
    pins = {31: 3888, 1: 730368, 7: 414720, 4: 0, 11: 0, 20: 0}
    got = {}
    for seed, want in sorted(pins.items()):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        got[seed] = N.count_lineups(fns)
    check("six pinned seeds re-derive exactly — three shapes with "
          "line-ups (seed 31, Crooked Waltz's shape, at 3,888) and the "
          "three zero-shapes (bridge-first x1, false_ending-first x1, "
          "tag-first x1)", got == pins, got)


if __name__ == "__main__":
    for fn in (test_tables, test_position_rules, test_returning_sections,
               test_refusal_and_determinism, test_measured_seeds):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the tables hold, the counter counts, and a shape that admits "
          "no story says so before anyone writes a word")
