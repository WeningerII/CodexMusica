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
          "re-adopted song band and again 2026-08-28 under the "
          "22-function vocabulary (seeds 1-40: 35 admit, 5 admit zero — "
          "the RATIO is unmoved through BOTH moves and the exemplars "
          "are not)")
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
    #:
    #: REPINNED A THIRD TIME 2026-08-28 (`MISSING.md` M-52's close), AND
    #: THIS GENERATION'S CAUSE IS THE VOCABULARY, NOT THE ENVELOPE:
    #: `patter` entered `grid.SECTION_FUNCTIONS` as the 22nd function on
    #: its printed Ruddigore witness, `plan._CELLS` derives from the
    #: vocabulary, and a 22-cell grammar arithmetics EVERY body draw
    #: differently — measured, 60 of 60 seed patterns moved (against
    #: M-133's move, which left three rosters standing). What SURVIVED
    #: is the census: **35 admit / 5 zero over seeds 1-40, unmoved a
    #: second time**, across a fully remapped seed space — the ratio is
    #: a property of the grammar and the rules, not of which seeds carry
    #: which shapes. Every exemplar below is re-chosen from the new
    #: space: the opening refusals are seeds 9 (bridge-first), 25
    #: (false_ending-first) and 39 (tag-first, the one carrier that
    #: HELD); seed 28 is the RESOLVE-clause zero at position 2
    #: ([intro, false_ending, ...]); and seed 27 is NEW EVIDENCE the
    #: two-kinds claim undersold — it survives [intro, vamp] and dies at
    #: POSITION 3 on the same RESOLVE clause, a third depth nothing had
    #: yet witnessed from the planner's own dice. Seed 1's shape now
    #: carries `patter` itself.
    pins = {
        # shapes with line-ups — seed 1's roster carries `patter`
        1: 924672, 7: 456576, 31: 16768, 4: 480,
        # zeros refused AT THE OPENING: bridge-, false_ending-, tag-first
        9: 0, 25: 0, 39: 0,
        # ...the RESOLVE-clause zero at position 2, and the NEW one at
        # position 3
        28: 0, 27: 0,
    }
    got = {}
    for seed, want in sorted(pins.items()):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        got[seed] = N.count_lineups(fns)
    check("nine pinned seeds re-derive exactly — four shapes with "
          "line-ups (seed 1's roster carrying the new `patter`), the "
          "three zero-shapes refused at the OPENING (bridge-, "
          "false_ending-, tag-first) and the two refused LATER by the "
          "RESOLVE-needs-a-prior-COMPLICATE clause, at positions 2 "
          "and 3",
          got == pins, got)
    #: The claim above is only worth making if the KINDS of zero are
    #: actually distinguishable, so the position is asserted rather than
    #: described: an opening refusal collapses at prefix length 1, and
    #: the two RESOLVE-clause zeros do not — at DIFFERENT depths.
    def collapse_at(seed):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        return next((k for k in range(1, len(fns) + 1)
                     if N.count_lineups(fns[:k]) == 0), None)
    at = {s: collapse_at(s) for s in (9, 25, 39, 28, 27)}
    check("...and the kinds of zero are told apart by WHERE they "
          "collapse, not by the count they share: the three opening "
          "refusals die on their first section, seed 28 survives its "
          "opening and dies on the second, and seed 27 survives TWO "
          "sections and dies on the third — the same clause, three "
          "depths",
          at[9] == 1 and at[25] == 1 and at[39] == 1
          and at[28] == 2 and at[27] == 3, at)


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
    # relation layer reads the GROUPS, and under M-133's move this seed
    # moved the second without moving the first.
    #
    # REPINNED A FOURTH TIME 2026-08-28 (`MISSING.md` M-52's close), and
    # THIS time both layers moved together, because the cause is
    # upstream of both: `patter` made the cell grammar 22 cells and
    # every body draw re-arithmetics, so seed 31's ROSTER itself changed
    # (intro, verse, prechorus, chorus, reprise, coda — six sections
    # against the old five) and everything downstream follows. Its
    # length still draws the SONG band's floor — the one coordinate of
    # this seed that held through both generations, asserted below as
    # the floor and not as a literal.
    #
    # REPINNED A FIFTH TIME 2026-08-29 (`MISSING.md` M-171), and the
    # cause is the PARTICIPATION BOUND: `line_binding_ceiling` had been
    # capping BOUND WORDS by the density band's SYLLABLE floor (a unit
    # error, the M-81(B) species), and the repair caps it at the floor
    # minus `WORDS_LEFT_FREE`. Every line's participation pool shrank,
    # so `want`'s randint range moved on the first line and every draw
    # downstream re-dealt: seed 31's cover goes 388 -> 359 groups and
    # 22 -> 19 schema labels, with the ROSTER and the whole narrative
    # draw (mode, 16768 line-ups, atoms, junctions) BYTE-IDENTICAL —
    # the same layer split as the third repin, moved from the other
    # side. The sharpest new fact is pinned first: label A now draws
    # the BARE DEFAULT, so it has no relations entry at all, and a
    # KeyError on "A" is exactly how the stale pin announced this move.
    check("seed 31's RELATION draw re-derives exactly (A bare-default "
          "— absent from the dict — D consonance, F pararhyme, J "
          "perfect rhyme) — a moved pin here means the pools, the "
          "dice, the ENVELOPE or the VOCABULARY moved, which is a "
          "question, not a merge conflict",
          "A" not in pl["relations"]
          and pl["relations"]["D"] == "schema:consonance"
          and pl["relations"]["F"] == "schema:pararhyme"
          and pl["relations"]["J"] == "schema:perfect rhyme",
          {k: pl["relations"].get(k) for k in ("A", "D", "F", "J")})
    #: REPINNED A SIXTH TIME 2026-08-30 (`MISSING.md` M-174), and this move
    #: is the NARROWEST of the six, which is itself the reading: the
    #: overhang filter refuses a self-contradicting group its RELATION, not
    #: its existence, so seed 31's cover is BYTE-IDENTICAL at 359 groups and
    #: only the label count moves, 19 -> 20. The three named draws (A bare,
    #: D consonance, F pararhyme, J perfect rhyme) all held through it.
    check("...and seed 31 still draws the SONG band's own floor, its "
          "cover sized by it — a pin that says WHICH layer moved, "
          "where three relation names alone could not",
          pl["total_lines"] == min(P.song_line_counts())
          and pl["total_lines"] == 22 and len(pl["groups"]) == 359
          and len(pl["relations"]) == 20,
          f"lines {pl['total_lines']} (floor "
          f"{min(P.song_line_counts())}), {len(pl['groups'])} groups, "
          f"{len(pl['relations'])} labels")
    nar = pl["narrative"]
    check("the collapse is RECORDED: mode drawn, the exact line-up "
          "count disclosed, one atom per sung section, one junction "
          "per seam", nar["mode"] == "drawn" and nar["lineups"] == 16768
          and len(nar["atoms"]) == 6 and len(nar["junctions"]) == 5)
    check("the drawn line-up VALIDATES under the one shared validator",
          N.validate_lineup([sec["function"] for sec in pl["sections"]],
                            nar["atoms"], nar["junctions"]) == [])
    check("the draw is deterministic with the seed",
          P.make_plan(31)["narrative"] == nar)
    check("the brief carries the story plan in writer's words, nothing "
          "about the harness",
          "Story plan" in pl["writer_brief"]
          and "ANCHOR" not in pl["writer_brief"])
    #: SEED 4 -> SEED 11 (M-133) -> SEED 9, 2026-08-28 (M-52's close):
    #: each vocabulary or envelope move re-deals which seed draws a
    #: zero-shape, and the carrier is re-chosen from the measured zero
    #: class each time (seed 9 is the bridge-first opening refusal
    #: under the 22-function grammar). The check itself is unchanged —
    #: what a zero-shape must do is disclose and still ship a sound
    #: plan, whichever seed draws one.
    p9 = P.make_plan(9)
    check("a zero-shape seed DISCLOSES and still ships: mode none, "
          "lineups 0, the brief says nothing is asked of the meaning "
          "axis, and the sound plan is intact",
          p9["narrative"]["mode"] == "none"
          and p9["narrative"]["lineups"] == 0
          and "NO STORY PLAN" in p9["writer_brief"] and p9["groups"])
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
    # The declared strings fit seed 31's CURRENT six-sung-section shape
    # (re-spelled 2026-08-28 with the vocabulary repin above; the check's
    # subject — the SPELLING is reachable — does not depend on which
    # legal line-up is declared).
    dec = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         "--narrative=ESTABLISH,COMPLICATE/AND_THEN,DWELL/ELABORATE,"
         "ANCHOR/THEREFORE,ANCHOR/JUXTAPOSE,JUDGE/THEREFORE"],
        cwd=HERE, capture_output=True, text=True)
    bad = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         "--narrative=TURN,COMPLICATE/AND_THEN,DWELL/ELABORATE,"
         "ANCHOR/THEREFORE,ANCHOR/JUXTAPOSE,JUDGE/THEREFORE"],
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
    #: shape the check was built on: two accepted, one rejected. Under
    #: the 22-function vocabulary (M-52, 2026-08-28) seed 39 is still
    #: the window's one zero — a TAG-first opening refusal now, where it
    #: was bridge-first before; the window survived the remap by luck
    #: and the label below is corrected to what it measures.
    res = P.sweep(range(38, 41),
                  wants=[P.parse_sweep_want("story_lineups>=1")])
    check("the SEED FILTER is a sweep predicate: story_lineups>=1 over "
          "seeds 38-40 accepts 38 and 40 and rejects 39 (the "
          "tag-first zero-shape) — rejection sampling, no ranking",
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
