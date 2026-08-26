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
    print("\n5. the measured seeds — re-swept 2026-08-26 under the "
          "re-adopted song band (seeds 1-40: 35 admit, 5 admit zero — "
          "the RATIO is unmoved and the CAUSES are not)")
    from quality import plan as P
    #: REPINNED 2026-08-26 (`MISSING.md` M-133) BY THE M-131 SONG-PROFILE
    #: RE-ADOPTION, AND THE PIN THAT MOVED IS NOT THE PIN THAT MATTERS.
    #: The floor profile's song band went `lo` 150 -> 200 tokens, so
    #: `plan.song_line_counts()` — which READS that band, by the M-106
    #: `n_lines == 0` idiom — went **17..55 (39 values) -> 22..55 (34)**.
    #: A seed's drawn length is uniform over that set, so every seed that
    #: was drawing near the old floor draws a longer song now, and a
    #: longer song draws a different section roster. This suite was the
    #: one the re-adoption sitting missed (`test_floor.py` was repinned
    #: in the same sitting), and it is the pin doing its job: a moved
    #: envelope is a question, and the question here has an answer.
    #:
    #: WHAT SURVIVED, WHICH IS THE EVIDENCE THE MOVE WAS NARROW: the
    #: sweep census is **35 admit / 5 zero over seeds 1-40, unmoved**,
    #: and seeds 1, 7 and 31 re-derive BYTE-IDENTICALLY (820224, 881280,
    #: 4176). The band moved the lengths and left those three rosters
    #: alone.
    #:
    #: ~~every zero failing at the OPENING~~ — **STRUCK, and this is a
    #: finding rather than a repin (doctrine 17 keeps the old text
    #: visible).** Under the old envelope all five zeros were opening
    #: refusals. Under this one, **seed 10 is a zero that collapses at
    #: POSITION 2, not at the opening**: its roster opens
    #: `[intro, false_ending]`, and `false_ending`'s only atom is RESOLVE
    #: while `intro`'s only atom is ESTABLISH — the
    #: RESOLVE-needs-a-prior-COMPLICATE clause §2 above encodes by hand,
    #: reached from the PLANNER'S OWN DICE for the first time. §2 proves
    #: the rule on a constructed shape; seed 10 is the same rule met in
    #: the wild, so it is pinned here as its own case and not folded in
    #: with the four opening refusals.
    #:
    #: Seed 4 CHANGED CLASS — it was the bridge-first zero and is now an
    #: eleven-section shape at 534,528 — so the bridge-first opening
    #: refusal is carried by seeds 21 and 39 now. Seed 4 keeps its row at
    #: the new value: a seed that crossed a class boundary once is
    #: exactly the seed worth watching cross back.
    pins = {
        # shapes with line-ups — 1, 7 and 31 UNMOVED across the band
        1: 820224, 7: 881280, 31: 4176,
        # ...and the seed the band moved out of the zero class
        4: 534528,
        # zeros refused AT THE OPENING: bridge-, false_ending-, tag-first
        21: 0, 11: 0, 20: 0,
        # ...and the zero refused LATER, on [intro, false_ending]
        10: 0,
    }
    got = {}
    for seed, want in sorted(pins.items()):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        got[seed] = N.count_lineups(fns)
    check("eight pinned seeds re-derive exactly — three shapes whose "
          "line-ups the band move did NOT touch (seed 31, Crooked "
          "Waltz's shape, still at 4,176), the one seed it moved out of "
          "the zero class (seed 4), the three zero-shapes refused at the "
          "OPENING (bridge-, false_ending-, tag-first) and the one "
          "refused later, at [intro, false_ending], by the "
          "RESOLVE-needs-a-prior-COMPLICATE clause",
          got == pins, got)
    #: The claim above is only worth making if the two KINDS of zero are
    #: actually distinguishable, so the position is asserted rather than
    #: described: an opening refusal collapses at prefix length 1, and
    #: seed 10 does not.
    def collapse_at(seed):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        return next((k for k in range(1, len(fns) + 1)
                     if N.count_lineups(fns[:k]) == 0), None)
    at = {s: collapse_at(s) for s in (21, 11, 20, 10)}
    check("...and the two kinds of zero are told apart by WHERE they "
          "collapse, not by the count they share: the three opening "
          "refusals die on their first section, seed 10 survives its "
          "own opening and dies on the second",
          at[21] == 1 and at[11] == 1 and at[20] == 1 and at[10] == 2, at)


def test_the_wired_draw():
    print("\n6. the wired half — the planner plays the joker card "
          "(M-121), entropy last, declared-silences-drawn")
    import random
    from quality import plan as P
    pl = P.make_plan(31)
    # REPINNED 2026-08-25 under M-122 and again under M-123: each gate
    # widening changes some group's ACCEPTED pool, and a moved pool
    # moves that group's randrange and every draw downstream, so these
    # pins legitimately move whenever the conjunction gate learns a new
    # rule. The banked crooked_waltz mandate is NOT held by HEAD's dice
    # and never was — it lives in the song's own recorded log and
    # blueprint (songs/crooked_waltz.log.tsv, .blueprint.json), which
    # is what a bank is FOR. What this check holds is that the draw is
    # a stable pin at all, and that shape-entropy-before-relation-
    # entropy still reads (test_plan §14 holds the shape half).
    #
    # REPINNED A THIRD TIME 2026-08-26 (`MISSING.md` M-133), AND THIS
    # MOVE HAS A DIFFERENT CAUSE FROM THE TWO ABOVE — NOT A GATE, THE
    # ENVELOPE. The M-131 song-profile re-adoption took the band's `lo`
    # from 150 to 200 tokens, so `song_line_counts()` went 17..55 ->
    # 22..55 and its FLOOR rose by five lines. **Seed 31 was drawing
    # that floor**: measured either side, its `total_lines` goes
    # **17 -> 22** while its section roster is BYTE-IDENTICAL
    # (intro, chorus, postchorus, verse, coda). More lines is more
    # binding sites, so its cover goes **281 -> 413 groups** carrying
    # **16 -> 27 relation labels**, and a different number of draws off
    # the same seed is a different sequence of draws.
    # THAT SPLIT IS THE INTERESTING PART AND IS ASSERTED BELOW RATHER
    # THAN NARRATED: the narrative layer reads the FUNCTION ROSTER, the
    # relation layer reads the GROUPS, and this seed moved the second
    # without moving the first — which is why `lineups` is still 4,176
    # three lines down while every name on this line changed.
    check("seed 31's RELATION draw re-derives exactly (A consonance, "
          "D semirhyme, K Scots vowel-length) — a moved pin here means "
          "the pools, the dice or the ENVELOPE moved, which is a "
          "question, not a merge conflict",
          pl["relations"]["A"] == "schema:consonance"
          and pl["relations"]["D"] == "schema:semirhyme"
          and pl["relations"]["K"]
          == "schema:Scots vowel-length rhyme (Aitken's Law)",
          {k: pl["relations"][k] for k in ("A", "D", "K")})
    check("...and the envelope is what moved it: seed 31 draws the "
          "SONG band's own floor, so its length is that floor and its "
          "cover is sized by it — a pin that says WHICH layer moved, "
          "where three relation names alone could not",
          pl["total_lines"] == min(P.song_line_counts())
          and pl["total_lines"] == 22 and len(pl["groups"]) == 413
          and len(pl["relations"]) == 27,
          f"lines {pl['total_lines']} (floor "
          f"{min(P.song_line_counts())}), {len(pl['groups'])} groups, "
          f"{len(pl['relations'])} labels")
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
    #: SEED 4 -> SEED 11, 2026-08-26 (`MISSING.md` M-133): seed 4 stopped
    #: being a zero-shape when the band moved (see §5), so the seed that
    #: carries this check is the false_ending-first zero now. The check
    #: itself is unchanged — what a zero-shape must do is disclose and
    #: still ship a sound plan, whichever seed draws one.
    p11 = P.make_plan(11)
    check("a zero-shape seed DISCLOSES and still ships: mode none, "
          "lineups 0, the brief says nothing is asked of the meaning "
          "axis, and the sound plan is intact",
          p11["narrative"]["mode"] == "none"
          and p11["narrative"]["lineups"] == 0
          and "NO STORY PLAN" in p11["writer_brief"] and p11["groups"])
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
    #: WINDOW 3-5 -> 38-40, 2026-08-26 (`MISSING.md` M-133). The old
    #: window held exactly one zero-shape (seed 4) and the band move
    #: emptied it of zeros altogether, which would have made this check
    #: pass by accepting all three — a filter that rejects nothing looks
    #: identical to a filter that works (doctrine 48). 38-40 restores the
    #: shape the check was built on: two accepted, one rejected, and the
    #: rejection is still a BRIDGE-FIRST zero-shape (seed 39).
    res = P.sweep(range(38, 41),
                  wants=[P.parse_sweep_want("story_lineups>=1")])
    check("the SEED FILTER is a sweep predicate: story_lineups>=1 over "
          "seeds 38-40 accepts 38 and 40 and rejects 39 (the "
          "bridge-first zero-shape) — rejection sampling, no ranking",
          39 not in res["accepted"] and 38 in res["accepted"]
          and 40 in res["accepted"], res["accepted"])


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
