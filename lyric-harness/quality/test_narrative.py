"""Tests for quality/narrative.py — the vocabulary tables and the exact
line-up counter. The tables transcribe NARRATIVE_DESIGN.md as RULED
2026-08-25 under the owner's delegation (M-121); these tests hold the
MODULE's internal consistency and the counter's behavior, so a later
ruling's row edit moves pins loudly instead of silently."""

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
    only = sorted(j for j in N.JUNCTIONS if "TURN" in N.ENTER[j])
    check("the TURN rule is held STRUCTURALLY: TURN appears in exactly "
          "the BUT and JUXTAPOSE enter sets — softened from BUT-only by "
          "the M-121 ruling on the kishotenketsu witness (the ten is a "
          "turn entered by juxtaposition); THEREFORE and AND_THEN stay "
          "out, and a membership edit is the mutation that kills this",
          only == ["BUT", "JUXTAPOSE"], f"TURN enterable by {only}")
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
    # [drop, drop]: the ruled row is ANCHOR alone. Back-to-back second
    # instance may not take an inbound BUT; ANCHOR is otherwise
    # enterable by THEREFORE, AND_THEN, JUXTAPOSE = 3. Hand-derived: 3.
    check("[drop, drop] counts exactly 3 — the ANCHOR card's three "
          "non-BUT inbound junctions; both drops share one card by "
          "construction",
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
    check("the classic verse-chorus-bridge shape admits, its bridge "
          "TURN entered by BUT or JUXTAPOSE per the ruled edge rule",
          N.admits(shape))


def test_measured_seeds():
    print("\n5. the measured seeds — pins from the first recorded sweep "
          "(2026-08-25, seeds 1-40: 35 admit, 5 admit zero, every zero "
          "failing at the OPENING)")
    from quality import plan as P
    pins = {31: 4176, 1: 820224, 7: 881280, 4: 0, 11: 0, 20: 0}
    got = {}
    for seed, want in sorted(pins.items()):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        got[seed] = N.count_lineups(fns)
    check("six pinned seeds re-derive exactly — three shapes with "
          "line-ups (seed 31, Crooked Waltz's shape, at 4,176 under the "
          "ruled tables) and the three zero-shapes (bridge-first, "
          "false_ending-first, tag-first — all five sweep zeros stand "
          "under the softened TURN rule, since every one fails at the "
          "OPENING where no inbound junction exists to soften)",
          got == pins, got)


def test_the_wired_draw():
    print("\n6. the wired half — the planner plays the joker card "
          "(M-121), entropy last, declared-silences-drawn")
    import random
    from quality import plan as P
    pl = P.make_plan(31)
    check("seed 31's RELATION draw is byte-identical to the banked "
          "crooked_waltz mandate (B light rhyme, K anaphora) — the "
          "narrative draw consumes entropy AFTER every existing draw",
          pl["relations"]["B"] == "schema:light rhyme"
          and pl["relations"]["K"] == "schema:anaphora")
    nar = pl["narrative"]
    check("the collapse is RECORDED: mode drawn, the exact line-up "
          "count disclosed, one atom per sung section, one junction "
          "per seam", nar["mode"] == "drawn" and nar["lineups"] == 4176
          and len(nar["atoms"]) == 5 and len(nar["junctions"]) == 4)
    check("the drawn line-up VALIDATES under the one shared validator",
          N.validate_lineup([sec["function"] for sec in pl["sections"]],
                            nar["atoms"], nar["junctions"]) == [])
    check("the draw is deterministic with the seed",
          P.make_plan(31)["narrative"] == nar)
    check("the brief carries the story plan in writer's words, nothing "
          "about the harness",
          "Story plan" in pl["writer_brief"]
          and "ANCHOR" not in pl["writer_brief"])
    p4 = P.make_plan(4)
    check("a zero-shape seed DISCLOSES and still ships: mode none, "
          "lineups 0, the brief says nothing is asked of the meaning "
          "axis, and the sound plan is intact",
          p4["narrative"]["mode"] == "none"
          and p4["narrative"]["lineups"] == 0
          and "NO STORY PLAN" in p4["writer_brief"] and p4["groups"])
    lu = {"atoms": nar["atoms"], "junctions": nar["junctions"]}
    pd = P.make_plan(31, narrative=lu)
    check("a DECLARED line-up is carried, never resampled",
          pd["narrative"]["mode"] == "declared"
          and pd["narrative"]["atoms"] == nar["atoms"])
    try:
        bad = {"atoms": [[a[0], a[1], "TURN"] for a in nar["atoms"]],
               "junctions": nar["junctions"]}
        P.make_plan(31, narrative=bad)
        check("an illegal declared line-up refuses", False, "accepted")
    except P.PlanRefused:
        check("an illegal declared line-up REFUSES at plan time, while "
              "the writer is still holding the declaration", True)
    poff = P.make_plan(31, narrative="off")
    check("narrative='off' silences the layer and moves nothing else",
          poff["narrative"]["mode"] == "off"
          and poff["relations"] == pl["relations"]
          and poff["groups"] == pl["groups"])
    import subprocess
    HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    off = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         "--narrative=off"], cwd=HERE, capture_output=True, text=True)
    dec = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         "--narrative=ESTABLISH,ANCHOR/JUXTAPOSE,DWELL/ELABORATE,"
         "COMPLICATE/AND_THEN,JUDGE/THEREFORE"],
        cwd=HERE, capture_output=True, text=True)
    bad = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         "--narrative=TURN,ANCHOR/JUXTAPOSE,DWELL/ELABORATE,"
         "COMPLICATE/AND_THEN,JUDGE/THEREFORE"],
        cwd=HERE, capture_output=True, text=True)
    check("the CLI spelling is REACHABLE (the M-55 lesson): "
          "--narrative=off prints no story plan, the declared grammar "
          "lands in the brief, and an illegal declaration refuses at "
          "exit 2 naming the row",
          off.returncode == 0 and "Story plan" not in off.stdout
          and dec.returncode == 0
          and "compressed verdict" in dec.stdout
          and bad.returncode == 2
          and "cannot carry TURN" in bad.stdout + bad.stderr,
          f"off rc={off.returncode}, dec rc={dec.returncode}, "
          f"bad rc={bad.returncode}")
    res = P.sweep(range(3, 6),
                  wants=[P.parse_sweep_want("story_lineups>=1")])
    check("the SEED FILTER is a sweep predicate: story_lineups>=1 over "
          "seeds 3-5 accepts 3 and 5 and rejects 4 (the bridge-first "
          "zero-shape) — rejection sampling, no ranking",
          4 not in res["accepted"] and 3 in res["accepted"]
          and 5 in res["accepted"], res["accepted"])


if __name__ == "__main__":
    for fn in (test_tables, test_position_rules, test_returning_sections,
               test_refusal_and_determinism, test_measured_seeds,
               test_the_wired_draw):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the tables hold, the counter counts, and a shape that admits "
          "no story says so before anyone writes a word")
