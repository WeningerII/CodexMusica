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
          "re-adopted song band, 2026-08-28 under the 22-function "
          "vocabulary (35 admit / 5 zero through both), and 2026-09-01 "
          "under the short-profile envelope (seeds 1-40: 36 admit, 4 "
          "admit zero — the census moved by one for the first time, and "
          "the exemplars are re-chosen again). "
          "~~That 2026-09-01 sweep is the last basis~~ — REPINNED "
          "2026-09-05 (`MISSING.md` M-239): the `lyric` LENGTH-CURVE "
          "profile superseded the `song` and `short` band rows on "
          "2026-09-04, `song_line_counts()` is 1..447 and "
          "`fillable_line_counts()` 12..447 (was {6..20} | {22..55} and "
          "12..55), so every seed's drawn LENGTH was re-rolled a fifth "
          "time and ~~the figures printed here were measured under the "
          "12..55 envelope, not this one~~ — RE-SWEPT 2026-09-05 under "
          "M-239's envelope, which is what the figures below now are: "
          "seeds 1-40 are ~~36 admit / 4 zero~~ -> 34 ADMIT / 6 ZERO, "
          "and every exemplar is re-chosen from that sweep")
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
    #: which shapes.
    #: ~~the ratio is a property of the grammar and the rules~~ —
    #: STRUCK 2026-09-05 (`MISSING.md` M-239), and this is a finding, not
    #: a repin: the census has now moved under three consecutive
    #: envelopes (35/5 -> 36/4 -> **34/6 over seeds 1-40**, measured
    #: below), so the ratio is a property of the ENVELOPE as much as of
    #: the grammar. What held across five generations was the two-digit
    #: neighbourhood, not the number. The 2026-08-26 and 2026-08-28
    #: readings above stay as dated history of the sets they were taken
    #: over (doctrine 17).
    #: Every exemplar below is re-chosen from the new
    #: space: the opening refusals are seeds 9 (bridge-first), 25
    #: (false_ending-first) and 39 (tag-first, the one carrier that
    #: HELD); seed 28 is the RESOLVE-clause zero at position 2
    #: ([intro, false_ending, ...]); and seed 27 is NEW EVIDENCE the
    #: two-kinds claim undersold — it survives [intro, vamp] and dies at
    #: POSITION 3 on the same RESOLVE clause, a third depth nothing had
    #: yet witnessed from the planner's own dice. Seed 1's shape now
    #: carries `patter` itself.
    #: REPINNED A FOURTH TIME 2026-09-01 (`MISSING.md` M-193), AND THE
    #: CAUSE IS THE ENVELOPE AGAIN, FROM THE OTHER END: the `short` floor
    #: profile (50-150 tokens) joined, `song_line_counts()` went
    #: 22..55 -> {6..20} | {22..55}, and the planner's FILLABLE floor
    #: (`fillable_line_counts`, the totals a verse-chorus form can hold)
    #: went 22 -> 12, 34 -> 43 values. A seed's length is uniform over
    #: that set, so every seed re-dealt its LENGTH first and its roster
    #: after. MEASURED over seeds 1-40: **36 admit / 4 zero** — the
    #: census moved by ONE for the first time in four generations, and
    #: the direction is the one a wider, shorter envelope predicts
    #: (fewer sections, fewer places for a bridge or a false ending to
    #: open). Seeds 1 and 7 are BYTE-IDENTICAL a second time (924672,
    #: 456576): both drew lengths the old set also held, at the same
    #: stream position, so nothing downstream moved.
    #:
    #: REPINNED A FIFTH TIME 2026-09-05 (`MISSING.md` M-239) — HEADER TEXT
    #: ONLY, THE CAUSE IS THE ENVELOPE A THIRD TIME: the two
    #: fixed-percentile band rows (`song` 200-400 tokens, `short` 50-150)
    #: are SUPERSEDED by one LENGTH-CURVE profile, `lyric`, covering
    #: 4-3,245 tokens with thresholds that are curves in ln N; they keep
    #: their place in `PROFILES` with `superseded_by="lyric"` for their own
    #: drift checks and are never applied. `song_line_counts()` went
    #: ~~{6..20} | {22..55}, 49 values, one hole at 21~~ -> **1..447, 447
    #: values, NO hole**, and the planner's FILLABLE set went ~~12..55, 43
    #: values~~ -> **12..447, 436 values**, `ENVELOPE["total_lines"]`
    #: (12, 447). The default draw is uniform over 12..447 (measured
    #: median 201 lines over 40 seeds, against ~35 under 12..55), so every
    #: seed re-dealt its LENGTH first and its roster after, a fifth time.
    #: WHAT THAT COSTS THIS SUITE, SAID PLAINLY: the census and exemplars
    #: below, and §6's seed-31 pin, were MEASURED under the 12..55
    #: envelope and are not re-measured in this repin — they are readings
    #: of a set the floor no longer has. They are repinned by the worker
    #: who owns the re-sweep; this note is the disclosure that the
    #: question is open, not an answer to it (doctrine 17: the numbers
    #: that were true when written stay legible inside the strike).
    #:
    #: ~~THE EXEMPLARS, RE-CHOSEN FROM THE NEW SPACE: the opening
    #: refusals are seed 9 (bridge-first, HELD through the move) and
    #: seed 15 (SOLO-first — a kind no earlier generation witnessed:
    #: `solo` carries no ESTABLISH face, so a song cannot open on it);
    #: the RESOLVE-clause zeros at position 2 are seeds 30 ([intro,
    #: false_ending]) and 34 ([breakdown, false_ending]). **THE THIRD
    #: DEPTH IS GONE FROM THE DICE**: no seed in 1-100 collapses at
    #: position 3 under this envelope (measured: nine zeros, at 1 or 2),
    #: so seed 27's witness of 2026-08-28 is struck rather than replaced
    #: — the CLAUSE is unchanged and §2 proves it by hand; what the
    #: planner's own dice happen to reach is a property of the envelope,
    #: and this one does not reach three (doctrine 17 keeps the third
    #: depth legible as history). The four seeds that crossed a class
    #: boundary keep their rows at the new values, as before.~~
    #:
    #: THE RE-SWEEP THAT NOTE ASKED FOR, RUN 2026-09-05 (`MISSING.md`
    #: M-239) — THE PARAGRAPH ABOVE IS STRUCK IN FULL, AND NOT ONLY
    #: BECAUSE ITS NUMBERS AGED: swept at HEAD over seeds 1-100
    #: (`P.make_plan(s)` -> `N.count_lineups`, plus the collapse depth of
    #: every prefix), **NONE of the four exemplars it names is a
    #: zero-shape at all**: seed 9 draws 10,227,548,160 line-ups, seed 15
    #: 394,496, seed 30 44,308,800, seed 34 11,482,560. They are pinned
    #: below at those values as class-crossers rather than deleted.
    #:
    #: THE MEASURED ZERO CLASS, seeds 1-100: **21 zeros** — 4, 6, 19, 23,
    #: 24, 27, 41, 51, 52, 56, 67, 71, 77, 78, 79, 81, 82, 87, 88, 89,
    #: 100 (against the struck paragraph's "nine zeros, at 1 or 2").
    #: ~~THE THIRD DEPTH IS GONE FROM THE DICE~~ — **STRUCK: the third
    #: depth is BACK, and the dice now reach FIVE.** The full ladder,
    #: each rung pinned below: position 1 seeds 19 (`false_ending`-first),
    #: 24 (`tag`-first), 27 (`bridge`-first); position 2 seeds 77
    #: ([intro, false_ending]) and 89 ([vamp, false_ending]); position 3
    #: seed 23 ([intro, chorus, false_ending]) — seed 27's 2026-08-28
    #: witness of a third depth is RESTORED by a different seed, so that
    #: strike is itself struck; position 4 seed 6; position 5 seed 4,
    #: the deepest collapse any generation of this suite has witnessed
    #: from the planner's own dice.
    #:
    #: SEED 4 CROSSED BACK. The 2026-08-26 note pinned seed 4 at its new
    #: shape saying "a seed that crossed a class boundary once is exactly
    #: the seed worth watching cross back". It has: zero again, and it is
    #: the position-5 witness. The watch was worth keeping.
    #:
    #: A PREMISE REPAIR THE SWEEP FORCED, and the reason the struck
    #: paragraph's `solo` claim could never have been true: a WORDLESS
    #: opener makes the length-1 prefix count 0 without refusing
    #: anything. Measured: `count_lineups(["solo"]) == 0` and
    #: `count_lineups(["interlude"]) == 0`, but
    #: `count_lineups(["solo", "verse", "chorus"]) == 8` — `solo` carries
    #: NO atom at all, so it is not a function that "cannot open a song",
    #: it is a function that contributes no line-up until a sung section
    #: follows. **"SOLO-FIRST OPENING REFUSAL" HAS NO WITNESS AND IS NOT
    #: A KIND**: searched every zero-shape in seeds 1-300 by first
    #: function — `intro` 27, `false_ending` 9, `tag` 9, `bridge` 5,
    #: `chorus` 3, `vamp` 2, `hook` 1, `solo` 1 (seed 261) — and seed
    #: 261's depth-1 reading is exactly this artifact, not a refusal.
    #: The three position-1 exemplars pinned below are therefore chosen
    #: with SUNG openers whose every face is illegal at the opening
    #: (RESOLVE, JUDGE, TURN), which is the distinction §2 proves by hand.
    #: REPINNED 2026-09-05 (`MISSING.md` M-239) FROM THE RE-SWEEP ABOVE.
    #: Every one of the twelve rows moved. ~~seeds 1 and 7
    #: byte-identical~~ — **STRUCK: that run of two generations ends
    #: here.** Seed 1 goes ~~924672~~ -> 13,602,816 and seed 7 ~~456576~~
    #: -> 1,485,125,222,400; under M-193 both had drawn lengths the
    #: {6..20}|{22..55} set also held, and a 12..447 set holds neither
    #: draw at the same stream position. The old values stay legible
    #: here beside the new ones.
    pins = {
        # shapes with line-ups. ~~1: 924672, 7: 456576, 31: 136448~~
        # (2026-09-01) -> re-derived 2026-09-05:
        1: 13602816, 7: 1485125222400, 31: 63232,
        # class-crossers, watched: the four seeds the struck 2026-09-05
        # paragraph called zeros are shapes — ~~9: 0, 15: 0, 30: 0,
        # 34: 0~~ -> measured
        9: 10227548160, 15: 394496, 30: 44308800, 34: 11482560,
        # class-crossers, watched from 2026-08-26/28: former zeros that
        # still draw a shape. ~~25: 19024, 39: 17056, 28: 13384960~~ ->
        25: 442368, 39: 15206400, 28: 90243072,
        # zeros refused AT THE OPENING, all three with SUNG openers whose
        # every face is illegal at position 1 (see the premise repair
        # above): false_ending-first (RESOLVE), tag-first (JUDGE),
        # bridge-first (TURN). ~~seed 27: 1866240~~ — seed 27 CROSSED
        # BACK into the zero class on this envelope.
        19: 0, 24: 0, 27: 0,
        # the RESOLVE-clause zeros at position 2
        77: 0, 89: 0,
        # position 3 — the depth the 2026-09-05 note struck as witnessed
        # by nothing, RESTORED by measurement
        23: 0,
        # positions 4 and 5, reached from the dice for the first time.
        # ~~4: 1664~~ — the seed the 2026-08-26 note said was worth
        # watching cross back has crossed back, at the deepest rung.
        6: 0, 4: 0,
    }
    got = {}
    for seed, want in sorted(pins.items()):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        got[seed] = N.count_lineups(fns)
    check("eighteen pinned seeds re-derive exactly (repinned 2026-09-05, "
          "M-239) — three shapes with line-ups (~~seeds 1 and 7 "
          "byte-identical~~, struck: all three re-dealt), seven "
          "class-crossers, the three zero-shapes refused at the OPENING "
          "(false_ending-, tag-, bridge-first), the two refused LATER by "
          "the RESOLVE-needs-a-prior-COMPLICATE clause at position 2, "
          "and one each at positions 3, 4 and 5",
          got == pins, got)
    #: The claim above is only worth making if the KINDS of zero are
    #: actually distinguishable, so the position is asserted rather than
    #: described: an opening refusal collapses at prefix length 1, and
    #: the two RESOLVE-clause zeros do not — at DIFFERENT depths.
    def collapse_at(seed):
        fns = [s["function"] for s in P.make_plan(seed)["sections"]]
        return next((k for k in range(1, len(fns) + 1)
                     if N.count_lineups(fns[:k]) == 0), None)
    #: REPINNED 2026-09-05 (`MISSING.md` M-239), AND THE CHECK IS
    #: STRONGER THAN THE ONE IT REPLACES, NOT WEAKER: it asserted two
    #: depths over four seeds by naming each; it now asserts the WHOLE
    #: LADDER as one exact mapping. ~~at[9] == 1 and at[15] == 1 and
    #: at[30] == 2 and at[34] == 2~~ — struck because none of those four
    #: seeds is a zero any more (`collapse_at` returns None for all four,
    #: which is how the stale pin announced the move). The seeds below
    #: are chosen from the seeds 1-100 sweep recorded in the header, one
    #: per measured rung, NOT from whichever seed happened to pass; and
    #: the position-1 rung deliberately excludes rosters that open on a
    #: wordless section, whose length-1 prefix counts 0 for a reason that
    #: is not a refusal (the premise repair in the header).
    at = {s: collapse_at(s) for s in (19, 24, 27, 77, 89, 23, 6, 4)}
    check("...and the kinds of zero are told apart by WHERE they "
          "collapse, not by the count they share — and the ladder now "
          "runs to FIVE: three opening refusals die on their first "
          "section, seeds 77 and 89 survive the opening and die on the "
          "second, seed 23 on the third (~~the third depth's witness is "
          "struck~~ — RESTORED 2026-09-05), seed 6 on the fourth and "
          "seed 4 on the fifth, every rung the same RESOLVE clause "
          "except the openings",
          at == {19: 1, 24: 1, 27: 1, 77: 2, 89: 2, 23: 3, 6: 4, 4: 5},
          at)


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
    #: REPINNED A SEVENTH TIME 2026-09-01 (`MISSING.md` M-193), and the
    #: cause is the ENVELOPE from the other end: the `short` floor
    #: profile took the planner's fillable floor 22 -> 12 lines and the
    #: set 34 -> 43 values, so seed 31 — which had drawn the floor through
    #: two generations — draws **24** now, and with the length every
    #: layer re-dealt: roster (drop, reprise, chorus, postchorus,
    #: turnaround, chorus, postchorus, verse, outro — nine sections),
    #: cover 359 -> 235 groups, labels 20 -> 12, and the four named
    #: draws all moved (A perfect rhyme where it was bare, D family
    #: rhyme, F Scots vowel-length rhyme, J cluster consonance). The
    #: layer-split reading the third and fifth repins made cannot be
    #: made here: a length move is upstream of BOTH layers, and the
    #: check below says so by asserting the length rather than the floor.
    #: REPINNED AN EIGHTH TIME 2026-09-05 (`MISSING.md` M-239), AND THE
    #: ENVELOPE ANSWERED THE QUESTION THE CHECK'S OWN TEXT ASKS: the
    #: `lyric` length-curve profile took the fillable set 12..55 -> 12..447,
    #: seed 31's length re-dealt 24 -> 18, and a length move is upstream
    #: of every layer, so all four named draws moved together.
    #: ~~A perfect rhyme, D family rhyme, F Scots vowel-length rhyme,
    #: J cluster consonance~~ (2026-09-01) -> **A FAMILY rhyme, D
    #: PARARHYME, F RIME RICHE, J MONAI** (measured 2026-09-05).
    check("seed 31's RELATION draw re-derives exactly (~~A perfect "
          "rhyme, D family rhyme, F Scots vowel-length rhyme, J cluster "
          "consonance~~ -> A family rhyme, D pararhyme, F rime riche, "
          "J monai, repinned 2026-09-05 under M-239) — a moved pin here "
          "means the pools, the dice, the ENVELOPE or the VOCABULARY "
          "moved, which is a question, not a merge conflict",
          pl["relations"].get("A") == "schema:family rhyme"
          and pl["relations"]["D"] == "schema:pararhyme"
          and pl["relations"]["F"] == "schema:rime riche"
          and pl["relations"]["J"] == "schema:monai",
          {k: pl["relations"].get(k) for k in ("A", "D", "F", "J")})
    #: REPINNED A SIXTH TIME 2026-08-30 (`MISSING.md` M-174), and this move
    #: is the NARROWEST of the six, which is itself the reading: the
    #: overhang filter refuses a self-contradicting group its RELATION, not
    #: its existence, so seed 31's cover is BYTE-IDENTICAL at 359 groups and
    #: only the label count moves, 19 -> 20. The three named draws (A bare,
    #: D consonance, F pararhyme, J perfect rhyme) all held through it.
    check("...and seed 31 still draws no floor: ~~24 lines~~ -> 18 lines "
          "inside the FILLABLE set (floor 12, unmoved by M-239 — the "
          "`lyric` curve moved the CEILING, 55 -> 447), ~~235 groups~~ "
          "-> 147, ~~12 labels~~ -> 9 (repinned 2026-09-05) — a pin that "
          "says WHICH layer moved, where four relation names alone could "
          "not: this time the LENGTH again, upstream of both",
          pl["total_lines"] == 18
          and pl["total_lines"] in P.fillable_line_counts()
          and min(P.fillable_line_counts()) == 12
          and len(pl["groups"]) == 147 and len(pl["relations"]) == 9,
          f"lines {pl['total_lines']} (fillable floor "
          f"{min(P.fillable_line_counts())}), {len(pl['groups'])} groups, "
          f"{len(pl['relations'])} labels")
    nar = pl["narrative"]
    #: REPINNED 2026-09-05 (M-239) WITH THE LENGTH: seed 31's roster is
    #: [intro, prechorus, chorus, prechorus, chorus, verse, outro] — SEVEN
    #: sections against the old nine, and every one of them SUNG, so the
    #: atom count equals the section count here where it did not before
    #: (the old nine carried one wordless section: 8 atoms, 7 junctions).
    #: ~~lineups 136448, 8 atoms, 7 junctions~~ -> 63232, 7, 6.
    check("the collapse is RECORDED: mode drawn, the exact line-up "
          "count disclosed, one atom per sung section, one junction "
          "per seam", nar["mode"] == "drawn" and nar["lineups"] == 63232
          and len(nar["atoms"]) == 7 and len(nar["junctions"]) == 6)
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
    #: SEED 9 -> SEED 27, 2026-09-05 (`MISSING.md` M-239): ~~seed 9 is
    #: the bridge-first opening refusal~~ — struck, seed 9 draws
    #: 10,227,548,160 line-ups under this envelope and is no longer a
    #: zero of any kind, so the check would have had no zero-shape to
    #: make its point on. The carrier is re-chosen from the seeds 1-100
    #: sweep recorded in §5's header rather than from the first seed that
    #: passes: seed 27 is a bridge-first opening refusal there (roster
    #: opens `[bridge, turnaround, ...]`, collapse depth 1), the SAME
    #: kind seed 9 carried, so the sentence beside the check still
    #: describes what it measures.
    p27 = P.make_plan(27)
    check("a zero-shape seed DISCLOSES and still ships: mode none, "
          "lineups 0, the brief says nothing is asked of the meaning "
          "axis, and the sound plan is intact",
          p27["narrative"]["mode"] == "none"
          and p27["narrative"]["lineups"] == 0
          and "NO STORY PLAN" in p27["writer_brief"] and p27["groups"])
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
    # The declared strings are SPELLED FROM SEED 31's OWN DRAWN LINE-UP
    # (2026-09-01: the literal re-spelled at each repin went stale on
    # every envelope move, so it is derived now — the check's subject, the
    # SPELLING is reachable, does not depend on which legal line-up is
    # declared, and the drawn one is legal by construction). The illegal
    # declaration puts TURN on the first sung section, which the
    # validator refuses by name whatever that section is, unless it
    # carries a TURN face — asserted first so the refusal below is known
    # to be the validator's and not luck's.
    _atoms, _juncs = nar["atoms"], nar["junctions"]
    dec_spelling = ",".join(
        [_atoms[0][2]] + [f"{a[2]}/{j[2]}" for a, j in zip(_atoms[1:], _juncs)])
    bad_spelling = ",".join(
        ["TURN"] + [f"{a[2]}/{j[2]}" for a, j in zip(_atoms[1:], _juncs)])
    _turn_first = N.validate_lineup(
        [sec["function"] for sec in pl["sections"]],
        [[a[0], a[1], "TURN"] if i == 0 else a for i, a in enumerate(_atoms)],
        _juncs)
    check("the premise for the illegal spelling: seed 31's first sung "
          "section cannot carry TURN, by the validator's own word",
          any("cannot carry TURN" in x for x in _turn_first), f"{_turn_first[:1]}")
    dec = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         f"--narrative={dec_spelling}"],
        cwd=HERE, capture_output=True, text=True)
    bad = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=31",
         f"--narrative={bad_spelling}"],
        cwd=HERE, capture_output=True, text=True)
    check("the CLI spelling is REACHABLE (the M-55 lesson): "
          "--narrative=off prints no story plan, the declared grammar "
          "lands in the brief, and an illegal declaration refuses at "
          "exit 2 naming the row",
          off.returncode == 0 and "Story plan" not in off.stdout
          and dec.returncode == 0
          and "Story plan" in dec.stdout
          and "the writer declared the line-up" in dec.stdout
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
    #: WINDOW 38-40 -> 8-10, 2026-09-01 (`MISSING.md` M-193): the
    #: envelope move gave seed 39 a shape (17056 line-ups), which would
    #: have emptied the window of zeros and let the check pass by
    #: accepting all three — the same doctrine-48 trap the 2026-08-26
    #: repin names. 8-10 restores two accepted, one rejected: seed 9 is
    #: the bridge-first opening refusal that HELD through the move.
    #: WINDOW 8-10 -> 26-28, 2026-09-05 (`MISSING.md` M-239): the
    #: length-curve move gave seed 9 a shape (10,227,548,160 line-ups),
    #: emptying 8-10 of zeros — measured, the sweep accepted all three,
    #: which is the doctrine-48 trap the 2026-08-26 and 2026-09-01 repins
    #: both name: a filter that rejects nothing looks identical to a
    #: filter that works. 26-28 is chosen from the seeds 1-100 zero
    #: sweep in §5's header, not by trying windows until one passed: it
    #: restores two accepted, one rejected, and the rejected one is a
    #: BRIDGE-FIRST opening refusal (seed 27, roster opens
    #: `[bridge, turnaround, ...]`), the same kind seed 9 carried, so the
    #: label below still says what it measures.
    res = P.sweep(range(26, 29),
                  wants=[P.parse_sweep_want("story_lineups>=1")])
    check("the SEED FILTER is a sweep predicate: story_lineups>=1 over "
          "seeds ~~8-10~~ -> 26-28 accepts 26 and 28 and rejects 27 (the "
          "bridge-first zero-shape) — rejection sampling, no ranking",
          27 not in res["accepted"] and 26 in res["accepted"]
          and 28 in res["accepted"], res["accepted"])


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
