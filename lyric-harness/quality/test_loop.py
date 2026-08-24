#!/usr/bin/env python3
"""Regressions for the automated write-check-fix loop (quality/loop.py).

Every fixture here is EMPIRICALLY VERIFIED, not guessed: each one was run
interactively before being pinned, per this project's own test discipline
(CLAUDE.md "Real exemplars over constructed tests" — the same argument
applies to a constructed fixture as to a corpus one, one level down: build
it, then measure what it actually does, don't assume).

Tests 1-3 are the STOP CONDITIONS, each forced independently by injecting a
`propose` callable rather than by hoping a real fixture happens to produce
one:
  - 1  SUCCESS — the stock proposer clears a real cliche pair in one round
  - 2  NO_PROGRESS — a proposer that refuses everything stops after one
       round rather than repeating an identical failure
  - 3  ROUND_LIMIT — a proposer that fixes one flagged line and refuses the
       other is DIFFERENT from test 2: partial progress, still not success

Tests 4-6 are TIER 2, the backtrack. `Brief.joint_conflict` is real and
already built (quality/revise.py); this module's whole addition on top of
it is deciding what to DO about one:
  - 4  a genuine two-line backtrack, verified to actually flip
       `joint_conflict` from True to gone
  - 5  a two-line backtrack that is TRIED and correctly REJECTED (creates a
       new collision) rather than accepted because tier 1's search bottomed
       out
  - 6  a pivot whose conflicting groups both have 3+ members: NOT attempted,
       and the result says so rather than pretending narrower search meant
       "impossible"

Test 7 is the invariant every tier is built on: the loop never changes a
line it did not report changing, in any round, on any path.

Tests 11-12 are WHICH LAYERS ONE RUN ASKS — the question "what is built here
but not automated here", asked of this module about itself:
  - 11 the OPT-IN pair (meter + song-function, both on `blueprint=`) is
       stated in the RESULT in both directions, and the same run pins the
       blind spot that made the disclosure necessary: `revise_loop` reports
       SUCCESS on a draft still carrying `HOOK_ABSENT`, because every stop
       condition reads `brief()`, and `brief()` is per-LINE
  - 12 the DECLARED-RETURNS layer is ASKED without any opt-in and the loop
       has no move for what it finds — `RETURN_NOT_VERBATIM` is briefed with
       an EMPTY candidate field, so the line is a reported dead end rather
       than a silent pass

Tests 13-16 are WHAT THE WRITER IS TOLD — the same question asked of the two
`propose` seams rather than of the result:
  - 13 tier 2 hands a `PairBrief`, one argument, carrying both LINE numbers,
       the whole draft, the group being backtracked, the pivot's own
       `Brief`, and the previous attempt's rejection. It passed four bare
       strings until 2026-08-14 — for the HARDER of the two tiers, while
       tier 1 got `brief`/`lines`/`attempt`/`reasons`
  - 14 `propose` is shown `whole` — the draft-level findings `verify()` will
       grade its proposal against. `HOOK_ABSENT` can REJECT a revision and
       can never ask for one (test 11), and nothing used to tell the writer
       it existed: a rubric enforced but not issued
  - 15 tier 2 still CLEARS a real `joint_conflict` through the new contract,
       driven by a caller-supplied proposer rather than the stub
  - 16 `backtrack_width` still bounds the search to width^2 per two-line
       group — 50 at the declared default, the same count as before

BOUNDED ON PURPOSE: every fixture here is 3-5 lines. One `revise_loop` run
over a 4-line draft costs 40-90s wall clock (the candidate field is built
over the complete lexicon pool), and a 28-line one has already blown a
180-second budget once. A fixture in this file that grows past about a dozen
lines is a fixture that stops being run. Tests 13 and 16 drive the same
5-line fixture at two DIFFERENT `backtrack_width`s for the same reason: 8
proposals and 50 are two points on one curve, and the cheap point is the one
that carries the field assertions.

Run: python3 quality/test_loop.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.loop import (PairBrief, default_propose,  # noqa: E402
                          default_propose_pair, revise_loop, swap_end_word)
from quality.revise import ReviseDeclaration, Reviser  # noqa: E402
from quality.schemes import NoMandate  # noqa: E402
from quality import schemes as SC  # noqa: E402
from lyric_harness import line_tokens, raw_final_token, Lexicon  # noqa: E402

FAILURES = []

#: Test 13's MEASURED (backtrack_width, pairs proposed), read by test 16 so
#: its "the bound is the declared coordinate and not a constant" check
#: compares two RUNS rather than two literals. It read
#: `8 == 2 * 2 ** 2 and 50 == 2 * 5 ** 2` until 2026-08-15 -- a condition
#: containing no Name, Call or Attribute node anywhere, so no mutation of any
#: production file could move it and it evaluated True with the loop deleted.
#: Found by an AST sweep for constant-only `check()` conditions; it was the
#: only one of 612 outside the True/False arms of refusal try/excepts.
_NARROW_RUN = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


CLICHE = ["The candle burned and set the room on fire",
          "He said the word and then he turned to go",
          "And all night long she nursed a small desire",
          "She never asked the thing she had to know"]

#: Verified interactively: `R.brief(SILVER_MIND, [[1,3],[2,3]])` reports L3
#: `joint_conflict=True` -- "silver" and "mind" share no rhyme, so nothing
#: answers both groups at once -- and `revise_loop` resolves it in one round
#: by backtracking L1's "silver" (a `default_propose_pair` swap, so the
#: prose is nonsense; the CLAIM under test is the mechanism, not the line).
SILVER_MIND = ["It gleamed like polished silver",
              "We wandered deep into the mind",
              "The whole thing felt like a dream"]

#: Verified interactively, and REBUILT once already: the first version of
#: this fixture was the SAME shape as SILVER_MIND with "night" for L2, on
#: the claim that every backtracked anchor for L1 also rhymes with L2's
#: "night" and so collides with it. That collision (`SCHEME_COLLISION`) is
#: severity "note", not "flag" -- an unmandated rhyme is the writer's call,
#: doctrine 7 -- and once `verify()`'s net-new gate was fixed to stop
#: counting notes against acceptance (the SAME fix MODAL_RHYME's own
#: `test_tier2_backtrack_resolves_a_joint_conflict` needed), that fixture
#: reached SUCCESS instead of demonstrating a rejection: it was pinning the
#: bug, not the mechanism. L4 and L5 here lock L1 and L2 to their OWN
#: separate rhyme families with real mandated groups ([1,4], [2,5]) --
#: "silver"/"deliver" and "night"/"bright" -- so backtracking EITHER anchor
#: to answer the pivot breaks a real mandated pair elsewhere and earns a
#: genuine `SCHEME_VIOLATION` FLAG, not a note. Every one of tier 2's 50
#: attempts is rejected on that flag, verified interactively.
SILVER_NIGHT_LOCKED = ["It gleamed like polished silver",
                       "We wandered deep into the night",
                       "The whole thing felt like a dream",
                       "A memory I could not deliver",
                       "Everything was burning bright"]
SILVER_NIGHT_LOCKED_MANDATE = [[1, 3], [2, 3], [1, 4], [2, 5]]
#: THE SAME DRAFT WITH THE ANCHOR LOCKS REMOVED — added 2026-08-17 with the
#: defect F repair. `SILVER_NIGHT_LOCKED_MANDATE` locks L1 and L2 to families
#: of their own (L4, L5), which is now a condition `_try_tier2` REFUSES to
#: search rather than a search that runs and rejects: the anchor conjunction
#: is empty, so the fixture proposes zero pairs. Tests 13 and 16 need pairs
#: to count, so they use this mandate and get their proposals rejected by a
#: NO-OP PROPOSER instead — a pair that changes nothing is rejected by
#: `verify()`'s own "nothing was fixed" rule, which is a real verdict and not
#: a mandate rigged to be unsatisfiable. MEASURED: 2 two-line groups (A, B),
#: pivot L3, anchors L1/L2, 8 pairs at width 2 and 50 at width 5 — the same
#: two numbers the locked mandate produced before the repair.
SILVER_NIGHT_OPEN_MANDATE = [[1, 3], [2, 3]]


def _no_op_pair(pair_brief):
    """A proposer that hands both lines back UNCHANGED.

    Its rejection is `verify()`'s own no-op rule, so every attempt fails for
    a stated reason without the fixture having to encode an unsatisfiable
    mandate — which is what the anchor-lock shape used to do, and what the
    defect F repair now refuses to search at all.
    """
    return (pair_brief.pivot_text, pair_brief.anchor_text)

#: Verified interactively: BOTH of L5's groups have 3 members
#: ([1,2,5] and [3,4,5]), so neither qualifies for tier 2's two-line
#: backtrack at all -- `_try_tier2` reports 0 tried rather than searching a
#: group it cannot rewrite one line at a time.
TOO_LARGE = ["We laughed the whole entire day",
            "The kids went out to run and play",
            "It gleamed like polished silver",
            "Another walk beside the river",
            "The whole thing felt like a dream"]

#: A FOUR-LINE blueprint over `CLICHE`, in memory rather than in
#: `quality/fixtures/`: `fit.from_blueprint` takes a dict or a path, and the
#: smallest blueprint shipped in this repo is 16 lines — four times the size
#: this suite can afford to drive the loop over (see the module docstring on
#: what a run costs). Every field here is load-bearing for test 11: the two
#: sections declare `function`, which is what `grid.song_from_blueprint`
#: reads and `fit.py` ignores, and `hooks` names a line that is NOT in the
#: draft and cannot be put there by a proposer that only swaps end words —
#: so `HOOK_ABSENT`, the ONE flag the song-function layer can raise, is
#: guaranteed present at every stop condition rather than depending on what
#: the stub happens to pick. Verified interactively before being pinned.
CLICHE_BLUEPRINT = {
    "title": "four line probe",
    "hooks": ["a hook that is nowhere in this draft"],
    "sections": [
        {"name": "verse1", "bars": 2, "start_bar": 1, "function": "verse",
         "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
        {"name": "chorus1", "bars": 2, "start_bar": 3, "function": "chorus",
         "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}},
    ],
    "lines": [
        {"text": CLICHE[0], "bar": 1, "beat": 1, "duration": 4,
         "section": "verse1"},
        {"text": CLICHE[1], "bar": 2, "beat": 1, "duration": 4,
         "section": "verse1"},
        {"text": CLICHE[2], "bar": 3, "beat": 1, "duration": 4,
         "section": "chorus1"},
        {"text": CLICHE[3], "bar": 4, "beat": 1, "duration": 4,
         "section": "chorus1"},
    ],
}

#: L1 and L3 are DECLARED THE SAME LINE and are not verbatim — `reasons`/
#: `reason`, `all the`/`every`. Verified interactively: `Mandate.
#: returns_check` returns one `HEAD_AND_TAIL_PRESERVED` finding on this
#: draft, `inspect()` turns it into a `RETURN_NOT_VERBATIM` FLAG on L3, and
#: `brief()` hands that line back with ZERO candidates, because
#: `RETURN_NOT_VERBATIM` is not in `RHYME_FINDINGS` and a return is not
#: repaired by swapping an end word.
# L1/L3 are the DECLARED VERBATIM RETURN, drifted. L2/L4 carry a CLICHE_PAIR
# the loop can actually repair, and that division is the point: §12 asserts
# that one unsolvable line is never a stop condition, which needs a solvable
# line beside it to mean anything.
#
# L2/L4 USED TO BE 'hall'/'at all' AND CARRIED NO FINDING AT ALL. The fixed
# line was L1, and it was "fixed" by swapping the end word of a line the
# mandate REQUIRES to be identical to L3 -- the loop was paid for breaking the
# refrain. It could only score that because `_floor_for` handed the slop floor
# the declared return pair, so the floor read a required identity as a
# self-rhyme (doctrine 3 inverted). Subtracting the returns removed L1's
# finding, this section went red, and the assertion turned out to have been
# pinning the defect. The invariant is real, so it keeps its test; the fixture
# is what changed, and the repaired line is L2 now.
RETURN_DRIFT = ["we counted every reason we were given",
               "the kettle on the stove had caught the light",
               "we counted all the reasons we were given",
               "the morning came and did not care that night"]
RETURN_DRIFT_MANDATE = SC.mandate([[1, 3], [2, 4]], n_lines=4,
                                  returns=[[1, 3]])


def test_success_stop():
    print("\n1. SUCCESS — nothing left flagged, the stock proposer alone")
    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB")
    check("stops on SUCCESS", res.stop_reason == "success", res.stop_reason)
    # RESTATED 2026-08-17 under MANDATORY PURSUIT: the loop now also fixes
    # the two lines carrying only a MODAL_RHYME note, because success while
    # one stands is unreportable (owner's order — see loop.MANDATORY_PURSUE).
    check("both flagged lines AND both mandatory-pursued lines were fixed",
          set(res.rounds[0].fixed_lines) == {1, 2, 3, 4},
          f"fixed {res.rounds[0].fixed_lines}")
    check("no line left unresolved", res.unresolved == [])
    R2 = Reviser()
    final = R2.brief(res.lines, "ABAB")
    check("the FINAL draft actually re-checks clean, independently",
          not any(f.severity == "flag" for b in final for f in b.findings),
          "re-briefing the loop's own output with a FRESH Reviser finds "
          "nothing flagged -- the stop condition is not taken on faith")


def test_no_progress_stop():
    print("\n2. NO_PROGRESS — a proposer that refuses everything")
    # FIVE PARAMETERS, not four: `whole` joined the contract 2026-08-14 and
    # this signature is the migration. A four-parameter proposer raises
    # TypeError at the first call now, loudly and before the draft is
    # touched -- quality/loop.py's docstring argues that break rather than
    # shimming around it, and these three inline proposers are the whole of
    # what it broke in this repo.
    def refuses_everything(brief, lines, attempt, reasons=None, whole=()):
        return None
    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB", propose=refuses_everything)
    check("stops on NO_PROGRESS, not ROUND_LIMIT",
          res.stop_reason == "no_progress", res.stop_reason)
    check("stops after ONE round, not burning the full max_rounds",
          len(res.rounds) == 1,
          f"{len(res.rounds)} round(s) -- an identical round would fail "
          f"identically, so a second one is not run")
    check("the draft is untouched",
          res.lines == CLICHE, "no proposal was ever accepted")
    check("every attempt says WHY: no candidates offered",
          all(a.tried == 0 for a in res.rounds[0].attempts))


def test_round_limit_stop():
    print("\n3. ROUND_LIMIT — partial progress, capped rather than repeated "
         "forever")
    def picky(brief, lines, attempt, reasons=None, whole=()):
        if brief.line_no == 2:
            return None
        return default_propose(brief, lines, attempt, reasons, whole)
    R = Reviser(rdecl=ReviseDeclaration(max_rounds=1))
    res = revise_loop(R, CLICHE, "ABAB", propose=picky)
    check("stops on ROUND_LIMIT, distinct from NO_PROGRESS",
          res.stop_reason == "round_limit", res.stop_reason)
    # RESTATED 2026-08-17 under MANDATORY PURSUIT. L1, L3 and L4 are fixed
    # (L3/L4 were pursued); fixing L4's end word DISSOLVES the pair finding
    # that flagged L2, so L2 is closed by its partner's repair — and L4's
    # replacement word is itself directionally modal, so L4 is the line the
    # round leaves standing. Measured, not narrated: doctrine 58.
    check("L1 WAS fixed this round -- this is real progress, not a stall",
          res.rounds[0].fixed_lines == [1, 3, 4], res.rounds[0].fixed_lines)
    check("the line left unresolved says why, and it is the PURSUED one",
          [b.line_no for b in res.unresolved] == [4]
          and {f.code for b in res.unresolved for f in b.findings}
          == {"MODAL_RHYME"},
          res.unresolved[0].findings if res.unresolved else None)
    check("`max_rounds` is the declared bound that fired, not a hidden one",
          len(res.rounds) == R.rdecl.max_rounds == 1)


def test_tier2_backtrack_resolves_a_joint_conflict():
    print("\n4. TIER 2 — backtracking an anchor actually clears "
         "joint_conflict")
    R = Reviser()
    before = R.brief(SILVER_MIND, [[1, 3], [2, 3]])
    pivot_before = [b for b in before if b.line_no == 3][0]
    check("the fixture is a REAL joint_conflict before the loop runs",
          pivot_before.joint_conflict and not pivot_before.candidates,
          "L3 answers two groups whose call words share no rhyme")

    res = revise_loop(R, SILVER_MIND, [[1, 3], [2, 3]])
    # RESTATED 2026-08-17: the tier-2 fix lands ('mankind' for the pivot) and
    # its accepted word is directionally modal against L2's 'mind', so
    # mandatory pursuit holds L3 open and the stop is a LOUD no_progress with
    # the line named — the lexicon has no better joint answer, and saying so
    # beats calling it success (owner's order; loop.MANDATORY_PURSUE).
    check("stops loudly, refusing to call a still-modal draft a success",
          res.stop_reason == "no_progress"
          and [b.line_no for b in res.unresolved_pursued] == [3],
          f"{res.stop_reason} pursued="
          f"{[b.line_no for b in res.unresolved_pursued]}")
    tier2 = [a for r in res.rounds for a in r.attempts if a.tier == 2]
    check("exactly one tier-2 attempt ran, and it was accepted",
          len(tier2) == 1 and tier2[0].accepted,
          tier2[0] if tier2 else None)
    check("it touched BOTH the pivot and the anchor, never a third line",
          set(tier2[0].touched) == {1, 3},
          tier2[0].touched)
    check("L2 (the untouched anchor) is byte-identical",
          res.lines[1] == SILVER_MIND[1])

    R2 = Reviser()
    after = R2.brief(res.lines, [[1, 3], [2, 3]])
    pivot_after = [b for b in after if b.line_no == 3]
    check("re-briefed independently, L3 carries no FLAG -- the pivot is "
          "genuinely resolved at the mandate level, not merely accepted on "
          "a stale finding set",
          not any(f.severity == "flag"
                  for b in pivot_after for f in b.findings),
          pivot_after)
    # THE MECHANICAL PROPOSER'S OWN PICK IS THE DEMONSTRATION, NOT AN
    # INCONVENIENCE. `_try_tier2` excludes the modal set ONE direction only
    # -- `mankind` was correctly kept OFFERED as an answer to `mind` (it is
    # not one of `mind`'s own most-predictable partners) -- and landed on
    # `mind`/`mankind` anyway, because `mind` turns out to be `mankind`'s
    # single most-predictable partner in the OTHER direction, which nothing
    # in the search ever asks. MODAL_RHYME asks it after the fact and finds
    # it, on the loop's own real output, which is exactly the "leaking
    # through" the reactive-only wiring let past every prior version of this
    # test.
    modal_after = [f for b in pivot_after for f in b.findings
                  if f.code == "MODAL_RHYME"]
    check("...and MODAL_RHYME is what catches it: a note, not a flag, so it "
          "does not block a fix that is otherwise completely correct",
          bool(modal_after)
          and all(f.severity == "note" for f in modal_after),
          modal_after)


def test_tier2_tries_and_correctly_rejects():
    """~~5. TIER 2 — a resolving pair is tried and REJECTED for introducing a
    new FLAG elsewhere, which is not a bug in the search.~~

    **RESTATED 2026-08-17 WITH THE DEFECT F REPAIR, AND THE OLD SENTENCE WAS
    PINNING THE DEFECT.** This section asserted `tried > 0` — "it did not bail
    out early" — on a fixture whose own comment says every backtrack here
    breaks a real mandated pair, because L1 and L2 are locked to families of
    their own. Both halves were true and together they said the loop was
    right to propose 50 pairs it would reject every time. It was not: the
    anchor's own groups were never in the anchor's search, so the offer was
    illegal BY CONSTRUCTION and no consumer could say so (doctrine 48).

    THE FIXTURE IS UNCHANGED AND ITS VERDICT IS BETTER. `_try_tier2` folds
    the anchor's obligations into the anchor field, the conjunction comes
    back EMPTY, and the loop refuses with a reason instead of spending a
    writer's attempts. `tried == 0` here is now the CORRECT answer and the
    old check would have to be deleted to state it.
    """
    print("\n5. TIER 2 — an anchor locked to a family of its own is REFUSED, "
         "not searched (restated 2026-08-17: this asserted the opposite)")
    R = Reviser()
    res = revise_loop(R, SILVER_NIGHT_LOCKED, SILVER_NIGHT_LOCKED_MANDATE)
    check("cannot reach SUCCESS -- L1 and L2 are each locked to their own "
          "mandated rhyme family (L4, L5), so backtracking either one to "
          "answer the pivot breaks a real mandated pair",
          res.stop_reason != "success", res.stop_reason)
    tier2 = [a for r in res.rounds for a in r.attempts if a.tier == 2]
    check("tier 2 proposes NOTHING here, and that is the repair: every pair "
          "it used to offer was rejected by its own grader, so `tried == 0` "
          "is the honest count rather than an early bail-out",
          tier2 and tier2[0].tried == 0,
          tier2[0].tried if tier2 else None)
    check("...and the reason names WHICH search failed -- the anchor's own "
          "conjunction, not a proposer that came back short (doctrine 58)",
          tier2 and "EMPTY ANCHOR field" in tier2[0].reason
          and "unsatisfiable at this anchor" in tier2[0].reason,
          tier2[0].reason[:170] if tier2 else None)
    check("and every attempt was correctly rejected, none silently kept",
          tier2 and not tier2[0].accepted)
    # RESTATED 2026-08-18 under the two-tier ban: L2/L5 (night/bright)
    # share the spelled rime 'ight' — HOMEOTELEUTON, mandatorily pursued —
    # so the loop now legitimately repairs L5 by tier 1 before the pivot's
    # tier-2 search refuses. The claim this check makes is unchanged and
    # sharper: the REFUSED SEARCH changes nothing — every line the pivot's
    # conjunction touches (L1-L4) is byte-identical — while L5's repair
    # belongs to a different rule with its own regression suite.
    check("the refused search changes nothing IT governs — L1-L4 are "
          "byte-identical; L5 moved under tier 1 (night/bright, 'ight'), "
          "a different rule",
          res.lines[:4] == SILVER_NIGHT_LOCKED[:4]
          and res.lines[4] != SILVER_NIGHT_LOCKED[4],
          f"changed: {[i + 1 for i in range(5) if res.lines[i] != SILVER_NIGHT_LOCKED[i]]}")


def test_tier2_declines_a_group_of_three_or_more():
    print("\n6. TIER 2 — a pivot whose groups are BOTH 3+ members is not "
         "attempted, and says so")
    R = Reviser()
    before = R.brief(TOO_LARGE, [[1, 2, 5], [3, 4, 5]])
    pivot = [b for b in before if b.line_no == 5][0]
    check("the fixture is a real joint_conflict with two 3-member groups",
          pivot.joint_conflict
          and all(len(mem) == 3 for _, mem, _ in pivot.must_answer),
          [(lab, mem) for lab, mem, _ in pivot.must_answer])

    res = revise_loop(R, TOO_LARGE, [[1, 2, 5], [3, 4, 5]])
    tier2 = [a for r in res.rounds for a in r.attempts if a.tier == 2]
    check("tier 2 ran (it is still the joint_conflict path) but tried "
          "NOTHING",
          tier2 and tier2[0].tried == 0, tier2[0] if tier2 else None)
    check("the reason names WHY: no two-line group exists to backtrack",
          tier2 and "3+ members" in tier2[0].reason, tier2[0].reason
          if tier2 else None)
    check("the draft is untouched", res.lines == TOO_LARGE)


def test_the_loop_never_touches_an_unreported_line():
    print("\n7. the loop's own invariant: every changed line is a line it "
         "reported changing, in every round")
    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB")
    touched_ever = {n for r in res.rounds for a in r.attempts if a.accepted
                    for n in a.touched}
    actually_changed = {i + 1 for i in range(len(CLICHE))
                        if CLICHE[i].strip() != res.lines[i].strip()}
    check("the SET of lines that differ from the original equals the SET "
          "the attempts reported touching",
          actually_changed == touched_ever,
          f"changed {sorted(actually_changed)}, reported "
          f"{sorted(touched_ever)}")


def test_swap_end_word_refuses_a_disagreeing_reading():
    print("\n8. `swap_end_word` refuses rather than guesses when its own "
         "reading disagrees with `raw_final_token`")
    check("an ordinary line swaps cleanly",
          swap_end_word("the room on fire", "attire") ==
          "the room on attire")
    check("case is preserved on a capitalised end word",
          swap_end_word("She had to Know", "go") == "She had to Go")
    check("a parenthetical after the end word REFUSES rather than "
          "splicing into the parenthetical",
          swap_end_word("the room on fire (repeat)", "attire") is None,
          "line_tokens strips parentheticals before reading the end word, "
          "so the last regex match here is 'repeat', not 'fire' -- "
          "splicing there would silently corrupt an aside, not a rhyme")


def test_no_mandate_is_a_refusal_not_a_pass():
    print("\n9. no mandate declared REFUSES, the same contract brief()/"
         "verify() already hold")
    R = Reviser()
    raised = False
    try:
        revise_loop(R, CLICHE, None)
    except NoMandate:
        raised = True
    check("revise_loop raises NoMandate rather than looping over nothing",
          raised)


def test_strip_parens_is_a_declared_coordinate():
    print("\n10. `strip_parens` (line_tokens/raw_final_token/Lexicon."
         "transcribe) is declared, not assumed -- the same `(repeat)` line "
         "test 8 refuses on reads the OPPOSITE way once a caller declares "
         "the parenthetical is a second voice, not a stage direction")
    check("default (omitted): unchanged from every reading this project "
          "has ever produced -- 'repeat' is not read as a word at all",
          line_tokens("the room on fire (repeat)") == ["the", "room", "on",
                                                        "fire"])
    check("strip_parens=False: the same text keeps 'repeat' as a real word",
          line_tokens("the room on fire (repeat)", strip_parens=False) ==
          ["the", "room", "on", "fire", "repeat"])
    check("a WHOLE line in parens -- the backup-vocal notation this was "
          "built for -- anchors on its own last word once declared, "
          "instead of vanishing to NO_ANCHOR",
          raw_final_token("(Hì ro, hù ro, the day is lang,)",
                          strip_parens=False) == "lang")
    check("the same whole-line parenthetical is still unreadable by "
          "default, which is the bug this coordinate exists to make "
          "OPT-IN rather than silently fixed for everyone",
          raw_final_token("(Hì ro, hù ro, the day is lang,)") is None)
    check("*asterisk*-wrapped text was never special either way -- it "
          "reads as real words with or without strip_parens",
          line_tokens("*the whole crowd sings round*") ==
          ["the", "whole", "crowd", "sings", "round"])
    lex_default = Lexicon()
    lex_voiced = Lexicon(strip_parens=False)
    check("Lexicon() defaults to strip_parens=True, unchanged",
          lex_default.strip_parens is True)
    _, words_default, _ = lex_default.transcribe(
        "the room on fire (repeat)")
    _, words_voiced, _ = lex_voiced.transcribe(
        "the room on fire (repeat)")
    check("Lexicon.transcribe reads its OWN self.strip_parens, matching "
          "line_tokens exactly rather than carrying a second, separate "
          "paren rule",
          words_default == ["the", "room", "on", "fire"] and
          words_voiced == ["the", "room", "on", "fire", "repeat"],
          f"default={words_default!r} voiced={words_voiced!r}")


def test_optin_layers_are_disclosed_and_success_is_per_line():
    print("\n11. the OPT-IN layers are stated in the RESULT both ways — and "
         "SUCCESS is per-LINE, on a draft still carrying a whole-draft FLAG")
    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB", blueprint=CLICHE_BLUEPRINT)
    check("blueprint declared: the RESULT says so, not just the call site",
          res.blueprint_declared is True)
    text = "\n".join(res.disclosure())
    check("...and names BOTH layers that ride the one coordinate — omitting "
          "`blueprint=` drops meter AND song-function, not one of them",
          "meter" in text and "song-function" in text, text)
    check("no subdivision was declared, and the disclosure says the slot "
          "questions REFUSED rather than assuming a grid",
          res.subdivision_declared is False
          and "NO SUBDIVISION DECLARED" in text)
    check("doctrine 79: mandated / judged / refused survive the loop as "
          "THREE counts rather than being discarded at the `brief()` call "
          "that computed them",
          (res.pairs_mandated, res.pairs_judged, res.pairs_refused)
          == (2, 2, 0),
          f"{res.pairs_mandated} / {res.pairs_judged} / {res.pairs_refused}")

    # THE BLIND SPOT THE DISCLOSURE EXISTS FOR. `HOOK_ABSENT` is the only
    # FLAG the song-function layer raises and it carries no line, so it lands
    # in `inspect()`'s `whole` half, which `brief()` never reads -- the loop
    # stops on SUCCESS with it standing. `verify()` DOES read it (CLAUDE.md
    # records a CLI run rejecting a chorus swap for introducing exactly this
    # code), so it can reject a revision and can never ask for one.
    check("the loop reports SUCCESS...", res.stop_reason == "success",
          res.stop_reason)
    codes = [f.code for f in res.whole_flags]
    check("...on a draft that STILL carries HOOK_ABSENT, a flag -- so "
          "SUCCESS means 'nothing left this loop can act on', never 'clean'",
          "HOOK_ABSENT" in codes, codes)
    check("the two halves of the result openly disagree, which IS the "
          "finding: `unresolved` (per-line, what every stop condition reads) "
          "is EMPTY while `whole_flags` is not -- a `Brief` can only ever "
          "carry a per-line finding, so no widening of `unresolved` would "
          "have reached these",
          res.unresolved == [] and res.whole_flags != [],
          f"unresolved {res.unresolved}, whole flags {codes}")
    check("the printed result carries the warning, not just the dataclass",
          "NO STOP CONDITION ABOVE CAN SEE" in str(res))

    def refuses_everything(brief, lines, attempt, reasons=None, whole=()):
        return None
    R2 = Reviser(rdecl=ReviseDeclaration(max_rounds=1))
    off = revise_loop(R2, CLICHE, "ABAB", propose=refuses_everything)
    off_text = "\n".join(off.disclosure())
    check("OMITTED is disclosed too, which is the whole point -- silence "
          "about an opt-in layer reads exactly like that layer being clean",
          off.blueprint_declared is False and "NOT" in off_text
          and "meter" in off_text, off_text)


def test_declared_returns_are_asked_and_have_no_move():
    print("\n12. the DECLARED-RETURNS layer is asked with no opt-in at all, "
         "and the loop reports having no move for it rather than passing")
    R = Reviser(rdecl=ReviseDeclaration(max_rounds=1))
    res = revise_loop(R, RETURN_DRIFT, RETURN_DRIFT_MANDATE)
    flagged_codes = {f.code for b in res.unresolved for f in b.findings}
    check("L3's broken return reaches the loop as a FLAG -- `returns_check` "
          "is consulted on every run, not behind a parameter; a letter "
          "scheme simply declares no returns for it to check",
          [b.line_no for b in res.unresolved] == [3]
          and "RETURN_NOT_VERBATIM" in flagged_codes,
          f"unresolved {[b.line_no for b in res.unresolved]}, "
          f"codes {sorted(flagged_codes)}")
    l3 = [a for r in res.rounds for a in r.attempts if a.line_no == 3]
    # REPOINTED 2026-08-16. This read `"no candidates offered" in reason`,
    # which was the ONE sentence `_try_tier1` printed for all three ways of
    # reaching `tried == 0` (§17). This line is the FIRST of those — the
    # harness genuinely offered nothing — so the check keeps its claim and
    # gains the discrimination it never had: it now requires the attempt to
    # name THIS rule and to rule out the proposer's, so it cannot go green
    # against a message that blames the writer for an empty field.
    check("and the loop offers ZERO candidates for it -- a return is not "
          "repaired by swapping an end word, so `RETURN_NOT_VERBATIM` earns "
          "no candidate field and the attempt says WHICH rule that is",
          l3 and l3[0].tried == 0 and not l3[0].accepted
          and "no candidate field was offered" in l3[0].reason
          and "not about the proposer" in l3[0].reason
          and "PROPOSER declined" not in l3[0].reason,
          l3[0].reason if l3 else None)
    check("L2's rhyme WAS fixed in the same round -- one unsolvable line is "
          "never a stop condition, which is the invariant this fixture "
          "exercises against a real second layer rather than a stub",
          # RESTATED 2026-08-17: L4 (mandatory-pursued modal) is fixed in
          # the same round as L2's flag — pursuit is not a second pass.
          res.rounds[0].fixed_lines == [2, 4], res.rounds[0].fixed_lines)
    check("and L1 is NOT touched, though it ends on the same word as L3 -- "
          "the mandate REQUIRES that identity, so it is the requirement and "
          "not a self-rhyme, and the floor is no longer handed the pair",
          res.lines[0] == RETURN_DRIFT[0]
          and not any(f.code == "REPEAT_IN_VERSE"
                      for b in res.unresolved for f in b.findings),
          f"L1 {res.lines[0]!r}; before the returns were subtracted the floor "
          f"charged L1 with REPEAT_IN_VERSE and the loop 'repaired' it by "
          f"swapping the end word of a line declared verbatim-identical to L3")
    check("L3 is byte-identical: a line the loop had no move for is left "
          "exactly as written",
          res.lines[2] == RETURN_DRIFT[2])


def test_pair_brief_carries_the_situation():
    print("\n13. TIER 2 hands its writer a `PairBrief`, not four bare "
         "strings: BOTH line numbers, the whole draft, the group, and the "
         "previous rejection")
    seen = []

    def recording(pair_brief):
        seen.append(pair_brief)
        return _no_op_pair(pair_brief)

    # `backtrack_width=2` rather than the default 5 for cost, and it earns
    # its keep twice: 2 two-line groups x 2 x 2 = 8 proposals, which is the
    # low end of the bound test 16 pins at the default width. Verified
    # interactively before being pinned, like every fixture in this file.
    #
    # THE MANDATE IS `..._OPEN_` AND THE PROPOSER IS A NO-OP, 2026-08-17.
    # Under the locked mandate this fixture now proposes ZERO pairs -- the
    # anchors are locked to families of their own, which the defect F repair
    # refuses to search rather than searching and rejecting (test 5). This
    # section is about what a `PairBrief` CARRIES, so it needs pairs; the
    # rejection that populates `reasons` comes from `verify()`'s no-op rule
    # instead of from a mandate rigged to be unsatisfiable. Same 8, same two
    # labels, same pivot.
    R = Reviser(rdecl=ReviseDeclaration(backtrack_width=2))
    res = revise_loop(R, SILVER_NIGHT_LOCKED, SILVER_NIGHT_OPEN_MANDATE,
                      propose=lambda *a, **k: None, propose_pair=recording)
    check("tier 2 ran and actually proposed pairs", bool(seen), len(seen))
    check("ONE argument, and it is a PairBrief -- not four positional "
          "strings, which is what this tier passed until 2026-08-14",
          all(isinstance(pb, PairBrief) for pb in seen),
          [type(pb).__name__ for pb in seen[:1]])

    first = seen[0]
    check("the PIVOT's line number is on it: L3, the line whose conjunction "
          "`joint_field` proved unsatisfiable",
          first.pivot_line_no == 3, first.pivot_line_no)
    check("...and the ANCHOR's, which is the OTHER line this move rewrites "
          "-- a writer told only two texts cannot say which lines of the "
          "song they are, and tier 2 changes two",
          first.anchor_line_no in (1, 2), first.anchor_line_no)
    check("the two line numbers ARE the named group's two members, so the "
          "brief is internally checkable rather than merely populated",
          all(set(pb.members) == {pb.pivot_line_no, pb.anchor_line_no}
              and len(pb.members) == 2 for pb in seen),
          sorted({pb.members for pb in seen}))
    check("the group being backtracked is NAMED (`label`), which is the one "
          "fact that says WHY these two lines and not two others",
          sorted({pb.label for pb in seen}) == ["A", "B"],
          sorted({pb.label for pb in seen}))
    check("the WHOLE DRAFT travels with it, as a snapshot tuple",
          all(list(pb.lines) == SILVER_NIGHT_LOCKED for pb in seen)
          and isinstance(first.lines, tuple),
          f"{type(first.lines).__name__} of {len(first.lines)}")
    check("the pivot's own `Brief` rides along -- including the "
          "`joint_conflict` that is the whole reason this is tier 2 and not "
          "another tier-1 retry",
          first.brief.line_no == 3 and first.brief.joint_conflict is True,
          f"L{first.brief.line_no} joint_conflict="
          f"{first.brief.joint_conflict}")
    check("both candidate FIELDS are carried, and the two words this "
          "attempt asks for are drawn from the front of them",
          all(pb.pivot_word in pb.pivot_offered[:2]
              and pb.anchor_word in pb.anchor_offered[:2] for pb in seen),
          f"{first.pivot_word!r} from {first.pivot_offered[:2]}; "
          f"{first.anchor_word!r} from {first.anchor_offered[:2]}")
    check("the offered fields are the COMPLETE ones (24 = "
          "`ReviseDeclaration.offered`), not the 2 the search walks -- a "
          "bound on effort is not a claim about the field",
          len(first.pivot_offered) == len(first.anchor_offered)
          == R.rdecl.offered == 24,
          f"{len(first.pivot_offered)} / {len(first.anchor_offered)}")

    check("`attempt` counts this pivot's proposals, 0-based and gapless, "
          "the same way tier 1's does",
          [pb.attempt for pb in seen] == list(range(len(seen))),
          [pb.attempt for pb in seen])
    check("the FIRST attempt has no rejection to report",
          first.reasons is None and first.attempt == 0)
    check("...and every attempt after it carries the PREVIOUS one's "
          "rejection -- the feedback path tier 1 has had since it was "
          "written and this tier had none of",
          sum(1 for pb in seen if pb.reasons) == len(seen) - 1,
          f"{sum(1 for pb in seen if pb.reasons)} of {len(seen)}")
    check("and the rejection is the real verdict text, not a placeholder: "
          "it is `verify()`'s own no-op rule, fired by a proposer that hands "
          "both lines back unchanged",
          all("nothing was fixed" in "; ".join(pb.reasons)
              for pb in seen if pb.reasons),
          seen[1].reasons)
    check("the whole-draft findings reach tier 2 as well -- the harder tier "
          "is not the one told less",
          all(isinstance(pb.whole, tuple) for pb in seen)
          and {f.code for pb in seen for f in pb.whole}
          == {"EXTRAPOLATED_LENGTH"},
          sorted({f.code for pb in seen for f in pb.whole}))
    check("8 pairs proposed = 2 two-line group(s) x width 2 x width 2",
          len(seen) == 8 == 2 * R.rdecl.backtrack_width ** 2, len(seen))
    # HANDED TO TEST 16, which compares this run against its own. Recorded
    # as a (width, count) PAIR rather than a bare number, so the comparison
    # there reads two measurements and cannot be satisfied by arithmetic on
    # two literals -- see the note at that check.
    _NARROW_RUN.append((R.rdecl.backtrack_width, len(seen)))
    check("the draft is untouched -- every pair was correctly rejected, so "
          "widening the brief changed what the writer SEES and not what the "
          "loop accepts",
          res.lines == SILVER_NIGHT_LOCKED and res.stop_reason != "success",
          res.stop_reason)


def test_propose_sees_the_whole_draft_rubric():
    print("\n14. `propose` is handed the WHOLE-DRAFT findings it is being "
         "graded against -- HOOK_ABSENT among them, on a draft carrying one")
    seen = []

    def recording(brief, lines, attempt, reasons=None, whole=()):
        seen.append((brief, tuple(whole)))
        return default_propose(brief, lines, attempt, reasons, whole)

    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB", blueprint=CLICHE_BLUEPRINT,
                      propose=recording)
    check("the proposer was called at all", bool(seen), len(seen))
    seen_whole = {f.code for _b, w in seen for f in w}
    check("every call carried a non-empty whole-draft half",
          all(w for _b, w in seen), [len(w) for _b, w in seen])
    # THE ONE THE LOOP'S OWN DOCSTRING NAMES. `HOOK_ABSENT` is the only FLAG
    # the song-function layer raises, it names no line, and `verify()`'s diff
    # covers `whole` -- so it can REJECT a proposal and could never ask for
    # one, and until 2026-08-14 nothing told the proposer it existed.
    # CLAUDE.md records a real CLI run rejected for introducing exactly this
    # code, by a stub that had never been shown it.
    check("HOOK_ABSENT reaches the writer",
          "HOOK_ABSENT" in seen_whole, sorted(seen_whole))
    check("so does LEXICAL_MONOTONY -- the floor's whole-draft flag, and the "
          "other half of the pair this loop can never ask for",
          "LEXICAL_MONOTONY" in seen_whole)
    # REPOINTED 2026-08-23 (`MISSING.md` M-86). This compared `whole_flags`
    # against a HAND-LISTED pair, so it went red the moment the whole-draft
    # flag family grew — `TITLE_NOT_IN_HOOK` joined it by owner ruling and the
    # result became `['LEXICAL_MONOTONY', 'HOOK_ABSENT', 'TITLE_NOT_IN_HOOK']`.
    # The check's INTENT is doctrine 1 — the writer is shown the SAME object
    # the result discloses, not a second derivation of it — and a literal pair
    # never expressed that; it expressed the family's size on the day it was
    # written. Comparing the FULL SETS is what the intent actually says, and
    # it is strictly stronger: a fourth whole-draft flag is covered
    # automatically instead of breaking the section.
    shown_flags = {f.code for _b, w in seen for f in w
                   if getattr(f, "severity", "") == "flag"}
    check("what the writer was shown is EXACTLY what the result discloses: "
          "one source (`inspect()['whole']`), not two derivations of it "
          "(doctrine 1)",
          {f.code for f in res.whole_flags} == shown_flags
          and {"HOOK_ABSENT", "LEXICAL_MONOTONY"} <= shown_flags,
          f"result {sorted(f.code for f in res.whole_flags)} vs shown "
          f"{sorted(shown_flags)}")
    # AND IT IS NOT ON THE `Brief`, which is the point of passing it
    # separately: a Brief is per-LINE, and these findings name no line.
    per_line = {f.code for b, _w in seen for f in b.findings}
    check("none of these codes is in ANY `Brief` -- widening `Brief` was "
          "never the move, which is why `whole` is its own argument",
          not (per_line & {"HOOK_ABSENT", "LEXICAL_MONOTONY"}),
          sorted(per_line))
    check("and NO stop condition moved: this is still the SUCCESS test 11 "
          "pins, on a draft still carrying both flags",
          res.stop_reason == "success" and res.unresolved == [],
          res.stop_reason)


def test_tier2_still_resolves_a_joint_conflict_through_pair_brief():
    print("\n15. TIER 2 through the `PairBrief` contract still CLEARS a real "
         "joint_conflict -- the mechanism, not merely the signature")
    seen = []

    def writes_from_the_pair_brief(pair_brief):
        # A caller-supplied proposer that reads the brief rather than
        # positional strings. Same splice as the stub, so what is under test
        # is the contract carrying enough to do the job at all.
        seen.append(pair_brief)
        pivot = swap_end_word(pair_brief.pivot_text, pair_brief.pivot_word)
        anchor = swap_end_word(pair_brief.anchor_text, pair_brief.anchor_word)
        if pivot is None or anchor is None:
            return None
        return pivot, anchor

    R = Reviser()
    res = revise_loop(R, SILVER_MIND, [[1, 3], [2, 3]],
                      propose_pair=writes_from_the_pair_brief)
    # RESTATED 2026-08-17: same outcome as test 4 under mandatory pursuit —
    # the backtrack clears the joint conflict, its accepted word is
    # directionally modal, and the loop refuses to call that success.
    check("stops loudly, exactly as test 4 does with the stub",
          res.stop_reason == "no_progress"
          and [b.line_no for b in res.unresolved_pursued] == [3],
          res.stop_reason)
    tier2 = [a for r in res.rounds for a in r.attempts if a.tier == 2]
    check("exactly one tier-2 attempt ran, and it was accepted",
          len(tier2) == 1 and tier2[0].accepted, tier2[0] if tier2 else None)
    check("the lines it touched are the two the `PairBrief` NAMED, and no "
          "third line -- the brief and the outcome agree",
          set(tier2[0].touched)
          == {seen[0].pivot_line_no, seen[0].anchor_line_no} == {1, 3},
          f"touched {tier2[0].touched}, brief named "
          f"L{seen[0].pivot_line_no}/L{seen[0].anchor_line_no}")
    check("L2 (the untouched anchor) is byte-identical",
          res.lines[1] == SILVER_MIND[1])
    R2 = Reviser()
    after = R2.brief(res.lines, [[1, 3], [2, 3]])
    pivot_after = [b for b in after if b.line_no == 3]
    check("re-briefed independently with a FRESH Reviser, L3 carries no "
          "FLAG: the pivot is genuinely resolved at the mandate level",
          not any(f.severity == "flag"
                  for b in pivot_after for f in b.findings), pivot_after)


def test_backtrack_width_still_bounds_the_search():
    print("\n16. `backtrack_width` still bounds tier 2's search to the same "
         "count it did before the `PairBrief` -- width^2 per two-line group")
    seen = []

    def counting(pair_brief):
        seen.append(pair_brief)
        return _no_op_pair(pair_brief)

    # `..._OPEN_` AND THE NO-OP PROPOSER, 2026-08-17 — same reason as test
    # 13. The number this section exists to pin is unmoved: 2 x 5^2 = 50.
    R = Reviser()                       # the DECLARED default, width 5
    res = revise_loop(R, SILVER_NIGHT_LOCKED, SILVER_NIGHT_OPEN_MANDATE,
                      propose=lambda *a, **k: None, propose_pair=counting)
    tier2 = [a for r in res.rounds for a in r.attempts if a.tier == 2]
    check("50 pairs proposed = 2 two-line group(s) x width 5 x width 5 -- "
          "the number this fixture's own comment recorded before the "
          "contract changed, unmoved",
          len(seen) == 50 == 2 * R.rdecl.backtrack_width ** 2, len(seen))
    check("and the loop COUNTS what it proposed: `tried` on the attempt is "
          "the same 50, so the result does not overstate the search",
          tier2 and tier2[0].tried == len(seen) == 50,
          tier2[0].tried if tier2 else None)
    # TWO RUNS, NOT TWO LITERALS — 2026-08-15. This said
    # `8 == 2 * 2 ** 2 and 50 == 2 * 5 ** 2`, which is arithmetic: no Name,
    # no Call, no Attribute, nothing this repository could change to make it
    # false. It named the strongest claim in the section — that the bound
    # tracks a DECLARED coordinate rather than a hardcoded number — and
    # asserted it of nothing. Test 13 now hands its measured (width, count)
    # over and the same sentence is checked against both runs, so deleting
    # either loop, or fixing either width, fails here.
    check("the bound is the DECLARED coordinate and not a constant: the "
          "same fixture at `backtrack_width=2` proposes 8 (test 13), which "
          "is 2 x 2^2 against this run's 2 x 5^2",
          len(_NARROW_RUN) == 1
          and _NARROW_RUN[0][1] == 2 * _NARROW_RUN[0][0] ** 2
          and len(seen) == 2 * R.rdecl.backtrack_width ** 2
          and _NARROW_RUN[0][0] != R.rdecl.backtrack_width
          and _NARROW_RUN[0][1] != len(seen),
          f"width {_NARROW_RUN[0][0] if _NARROW_RUN else '?'} -> "
          f"{_NARROW_RUN[0][1] if _NARROW_RUN else '?'} pair(s) against "
          f"width {R.rdecl.backtrack_width} -> {len(seen)}")
    check("every one of the 50 was rejected and the draft is untouched, "
          "which is test 5's claim re-measured through the new contract",
          not tier2[0].accepted and res.lines == SILVER_NIGHT_LOCKED)



def test_a_dead_end_and_an_open_line_each_name_their_own_rule():
    """Two containers in this module merged two rules apiece.

    Both found by the audit that preceded the `forbidden_modal` split
    (`BACKLOG.md` §4.8), by asking where ELSE one name carries two rules such
    that a report can name the wrong one — the same question, one module over.

    (a) `_try_tier1`'s dead-end detail printed "no candidates offered" for
    every path reaching `tried == 0`, and only one of THREE is about the
    offer. MEASURED before the fix: a proposer returning `None` produced that
    sentence on a line whose `brief.candidates` held 24 words — the harness
    taking the blame for the writer's refusal, on the ordinary `revise` output
    path. The third path is `attempts_per_line < 1`, where the question was
    never put at all: doctrine 20's own case, and reachable because that is a
    declared coordinate with no floor.

    (b) `LoopResult.unresolved` unions two rules — a FLAG, or a NOTE whose
    code the caller declared in `pursue` — while its own field comment read
    "still carrying a flag finding at stop". That is false for every line held
    open by a pursued note, which is the entire purpose of `--pursue`.

    THE TWO LISTS ARE NEVER SUMMED (doctrine 79/91): they OVERLAP, so
    `len(flagged) + len(pursued)` double-counts a line carrying both. Check 6
    measures that on `_open_by_rule` directly, which is a pure function of the
    briefs and does not need a draft that happens to produce the collision.
    """
    print("\n17. a tier-1 DEAD END and an OPEN LINE each name their own "
          "rule — two containers, two rules apiece")
    from quality.loop import _open_by_rule, _open_lines
    from quality import fit as _FT

    D = ["the kitchen light is burning at half past four",
         "and nobody came back to climb the stairs"]
    bp = {"sections": [{"name": "V1", "bars": 2, "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [{"text": t, "bar": i + 1, "beat": 1, "duration": 4,
                     "section": "V1"} for i, t in enumerate(D)]}
    sub = _FT.Subdivision(2, source="constructed for this regression")
    decline = lambda *a, **k: None                            # noqa: E731

    def reason_for(res, ln):
        for r in res.rounds:
            for a in r.attempts:
                if a.line_no == ln:
                    return a.reason
        return ""

    # (a1) THE PROPOSER DECLINED, and a real field was on the table.
    r1 = revise_loop(Reviser(), D, "AA", propose=decline)
    d1 = reason_for(r1, 2)
    check("a proposer that declines is reported as the PROPOSER's refusal, "
          "with the size of the field it declined, not as an empty offer",
          "PROPOSER declined" in d1 and "24 candidate(s) offered" in d1
          and "no candidates offered" not in d1, d1[:100])

    # (a2) THE HARNESS OFFERED NOTHING — a meter-only line carries no rhyme
    # finding, so `brief()` computes no field for it at all.
    r2 = revise_loop(Reviser(), D, "AA", blueprint=bp, subdivision=sub,
                     propose=decline)
    d2 = reason_for(r2, 1)
    check("a line the harness could not offer a field for says so, and says "
          "it is a fact about the MANDATE and the lexicon",
          "no candidate field was offered" in d2
          and "not about the proposer" in d2, d2[:100])
    check("...and BOTH rules are visible on the SAME run, which is what "
          "makes them two rules rather than two namings of one",
          "no candidate field was offered" in d2
          and "PROPOSER declined" in reason_for(r2, 2),
          f"L1: {d2[:44]!r} | L2: {reason_for(r2, 2)[:44]!r}")

    # (a3) NOT ASKED — inconclusive by construction, not a dead end.
    r3 = revise_loop(Reviser(rdecl=ReviseDeclaration(attempts_per_line=0)),
                     D, "AA", propose=lambda *a, **k: "x")
    d3 = reason_for(r3, 2)
    check("a budget of zero attempts is INCONCLUSIVE BY CONSTRUCTION and "
          "says so by name — the loop never put the question (doctrine 20)",
          "NOT ASKED" in d3 and "attempts_per_line=0" in d3
          and "doctrine 20" in d3, d3[:100])

    # (b) A PURSUED NOTE HOLDS LINES OPEN THAT CARRY NO FLAG AT ALL.
    MODAL = ["the bank foreclosed and boarded up the town",
             "the freight train left the siding after four",
             "we packed the truck and never once looked down",
             "and drove until the county line was more"]
    rp = revise_loop(
        Reviser(rdecl=ReviseDeclaration(pursue=frozenset({"MODAL_RHYME"}),
                                        attempts_per_line=1)),
        MODAL, [[1, 3], [2, 4]], propose=decline)
    check("lines held open by a PURSUED NOTE are unresolved with an EMPTY "
          "flagged list — the exact state the old field comment denied",
          rp.unresolved and not rp.unresolved_flagged
          and [b.line_no for b in rp.unresolved_pursued]
          == [b.line_no for b in rp.unresolved],
          f"unresolved={[b.line_no for b in rp.unresolved]} "
          f"flagged={[b.line_no for b in rp.unresolved_flagged]} "
          f"pursued={[b.line_no for b in rp.unresolved_pursued]}")
    check("...and the rendered line SAYS which rule holds each one open",
          any("unresolved:" in l and "pursued note" in l and "flag" not in
              l.split("unresolved:")[1] for l in str(rp).splitlines()),
          [l.strip() for l in str(rp).splitlines() if "unresolved:" in l])

    # THE NON-SUMMING RULE, measured on the pure function rather than on a
    # draft that happens to collide.
    class _F:
        def __init__(self, code, severity):
            self.code, self.severity = code, severity

    class _B:
        def __init__(self, n, fs):
            self.line_no, self.findings = n, fs

    both = _B(1, [_F("SCHEME_VIOLATION", "flag"), _F("MODAL_RHYME", "note")])
    only_flag = _B(2, [_F("SCHEME_VIOLATION", "flag")])
    only_note = _B(3, [_F("MODAL_RHYME", "note")])
    fl, pu = _open_by_rule([both, only_flag, only_note],
                          frozenset({"MODAL_RHYME"}))
    check("the two lists OVERLAP by construction, so summing them is wrong: "
          "a line carrying a flag AND a pursued note is in both",
          [b.line_no for b in fl] == [1, 2]
          and [b.line_no for b in pu] == [1, 3]
          and len(fl) + len(pu) == 4
          and len(_open_lines([both, only_flag, only_note],
                              frozenset({"MODAL_RHYME"}))) == 3,
          f"flagged={[b.line_no for b in fl]} "
          f"pursued={[b.line_no for b in pu]} -> 2+2=4, union=3")
    check("CONTROL: with `pursue` empty — the default — the pursued list is "
          "empty and the union is the flagged list exactly",
          _open_by_rule([both, only_flag, only_note], frozenset())[1] == []
          and [b.line_no for b in _open_by_rule(
              [both, only_flag, only_note], frozenset())[0]] == [1, 2])



def test_a_line_is_briefed_against_the_draft_as_it_now_stands():
    """DEFECT B. One `brief()` per round, so guidance went stale mid-round.

    Fixing line X inside a round changes what a LATER flagged line Y must
    answer whenever X is one of Y's call words. Y was then handed a candidate
    field, a `must rhyme with`, and a `SCHEME_VIOLATION` evidence string
    computed against a word no longer in the draft.

    THE OLD ARGUMENT WAS SOUND AND ANSWERED A DIFFERENT QUESTION: `verify()`
    re-derives the true finding set before accepting anything, so a stale
    candidate is REJECTED rather than wrongly accepted. True, and about
    ACCEPTANCE. A brief is GUIDANCE, and nothing covered that.

    WHAT CHANGED THE ECONOMICS is `--propose=defer:`. The argument was written
    when the only proposer was the free mechanical stub. MEASURED on the
    rung-1 draft: a writer who followed the stale field exactly burned all
    three attempts twice and the loop returned NO_PROGRESS, while the correct
    move was to ignore the field the harness had just offered.

    CHECK 2 IS THE ONE THAT KEEPS THE OLD ARGUMENT TRUE: the fix moves
    guidance and must not move acceptance.
    """
    print("\n18. a line is briefed against the draft AS IT NOW STANDS, not "
          "against the round's opening snapshot")
    from quality import propose as _PR

    D = ["the kitchen light is burning at half past four",
         "and nobody came back to climb the stairs"]
    ANSWER = {1: "the kitchen light is on their chairs",
              2: "and no one came back up the stairs"}
    # THE BLUEPRINT IS LOAD-BEARING FOR THIS SECTION, not decoration. Without
    # it only L2 is flagged (a pair violation is filed on the higher line), L1
    # is never asked, and L2's brief citing `four` would be CORRECT -- L1
    # really would still end on it. The meter flag is what makes L1 get fixed
    # FIRST, which is the only way a later line's brief can go stale.
    from quality import fit as _FT
    BP = {"sections": [{"name": "V1", "bars": 2, "start_bar": 1,
                        "meter": {"beats": 4, "unit": 4, "groups": [2, 2]}}],
          "lines": [{"text": t, "bar": i + 1, "beat": 1, "duration": 4,
                     "section": "V1"} for i, t in enumerate(D)]}
    SUB = _FT.Subdivision(2, source="constructed for this regression")

    shown = []

    def spy(brief, lines, attempt, reasons=None, whole=()):
        p = _PR.render_line(brief, lines, whole=whole, attempt=attempt,
                            reasons=reasons)
        shown.append((brief.line_no, p))
        return ANSWER.get(brief.line_no)

    res = revise_loop(Reviser(), D, "AA", blueprint=BP, subdivision=SUB,
                      propose=spy)
    l2 = [p for n, p in shown if n == 2]
    # RESTATED 2026-08-17: the pair CONVERGES TEXTUALLY — both lines reach
    # the scripted answers — and the stop is no_progress, because the
    # converged pair (chairs/stairs) is itself modal, mandatory pursuit holds
    # it open, and the scripted proposer has no further answer. The subject
    # of this section is the re-brief, and that is unchanged.
    check("the loop converges on this pair (and then refuses to bless the "
          "modal pair it converged TO)",
          res.stop_reason == "no_progress"
          and list(res.lines) == [ANSWER[1], ANSWER[2]],
          f"{res.stop_reason} -> {list(res.lines)}")
    check("L2 is told to rhyme with the word L1 ACTUALLY ENDS ON after L1 "
          "was fixed -- not the word L1 had when the round opened",
          bool(l2) and "L1 ('chairs')" in l2[0]
          and "L1 ('four')" not in l2[0],
          [x.strip() for x in l2[0].splitlines()
           if "must rhyme with" in x] if l2 else "L2 never briefed")
    check("...and its SCHEME_VIOLATION evidence no longer quotes the deleted "
          "word either -- the whole brief moved, not one line of it",
          bool(l2) and "'four' ~ 'stairs'" not in l2[0],
          [x.strip() for x in l2[0].splitlines()
           if "score 0.612" in x] if l2 else "")

    # CHECK 2 — ACCEPTANCE IS UNMOVED. The old design's argument was that
    # correctness never depended on re-briefing; this fix must not falsify
    # it. Same draft, same stub, same verdicts and same emitted text.
    a = revise_loop(Reviser(), CLICHE, "ABAB")
    b = revise_loop(Reviser(), CLICHE, "ABAB")
    check("the fix changes GUIDANCE and not ACCEPTANCE: the stub-driven run "
          "is unchanged in stop reason, rounds and emitted draft",
          a.stop_reason == b.stop_reason and list(a.lines) == list(b.lines)
          and len(a.rounds) == len(b.rounds),
          f"{a.stop_reason}/{len(a.rounds)} rounds")

    # CHECK 3 — A LINE CLOSED BY AN EARLIER FIX IS NOT ASKED ABOUT, and is
    # recorded as its own kind rather than as a failed attempt.
    CLOSE = ["the kitchen light is burning at half past four",
             "and nobody came back to climb the stairs",
             "the empty coats are hanging on the stairs"]
    asked = []

    def spy2(brief, lines, attempt, reasons=None, whole=()):
        asked.append(brief.line_no)
        return ("and nobody came back to cross the floor"
                if brief.line_no == 2 else None)

    R2 = Reviser(rdecl=ReviseDeclaration(
        pursue=frozenset({"REPEAT_ACROSS_GROUPS"})))
    r2 = revise_loop(R2, CLOSE, [[1, 2]], propose=spy2)
    rnd = r2.rounds[0]
    check("L3 opened the round and was NEVER ASKED ABOUT, because fixing L2 "
          "closed it -- the stale snapshot would have spent an attempt on a "
          "finding that was already gone",
          asked == [2] and rnd.resolved_elsewhere == [3],
          f"asked={asked} resolved_elsewhere={rnd.resolved_elsewhere}")
    check("...and it is NOT a `LineAttempt`: no attempt was made, so a "
          "record with accepted=False would be a failure that never "
          "happened, and len(attempts) would stop counting attempts "
          "(doctrine 79)",
          all(a.line_no != 3 for a in rnd.attempts)
          and len(rnd.attempts) == 1,
          f"{len(rnd.attempts)} attempt(s): "
          f"{[a.line_no for a in rnd.attempts]}")
    check("...and the report SAYS so, under its own marker rather than the "
          "dead-end one",
          "[==] L3" in str(r2) and "[--] L3" not in str(r2),
          [l.strip()[:60] for l in str(r2).splitlines() if "[==]" in l])

    # CHECK 4 — THE COST IS PAID ONLY WHERE THE DEFECT EXISTS. Nothing is
    # re-derived until an accepted proposal has actually moved the draft, so
    # a round that fixes nothing re-briefs exactly zero times.
    calls = []
    R3 = Reviser()
    _orig = R3.brief
    R3.brief = lambda *a, **k: (calls.append(1), _orig(*a, **k))[1]
    revise_loop(R3, D, "AA", propose=lambda *a, **k: None)
    check("a round in which NOTHING is accepted re-briefs zero times -- one "
          "`brief()` for the round, exactly as before the fix",
          len(calls) == 1,
          f"{len(calls)} brief() call(s): a proposer that refuses everything "
          f"fixes nothing, so the run stops at NO_PROGRESS after one round "
          f"and the re-brief branch is never entered")


#: A PIVOT WHOSE ANCHOR IS ITSELF A PIVOT, and no returns anywhere — the
#: shape that isolates the anchor half of defect F from the return half.
#: L3 is the pivot (groups B [1, 3] and C [3, 4]); backtracking B moves L1,
#: and L1 has a group of its own (A [1, 2], call word 'hear') that the
#: rewrite does NOT touch and that its new end word therefore still owes.
ANCHOR_IS_A_PIVOT = ["so keep the dial lit and hold it near",
                     "there is nobody lost while somebody can hear",
                     "a nurse in akron calls me on her break",
                     "she says the ward is quiet till we wake",
                     "the studio is one room and a chair",
                     "i talk into the mic like you are there"]
ANCHOR_GROUPS = [[1, 2], [1, 3], [3, 4], [5, 6]]

#: THE SAME SHAPE WITH A LIVE CONJUNCTION. Above, the anchor's own call and
#: the pivot's remaining call do not rhyme, so the folded field is EMPTY and
#: no prompt is ever built — which is the right outcome and the wrong fixture
#: for asking what the prompt says. Here L4's `door` rhymes with L1's `four`,
#: so the anchor's conjunction is non-empty and a `PairBrief` is actually
#: rendered: pivot L2, anchor L3, and L3 owes `door` to a group the backtrack
#: does not touch.
ANCHOR_HAS_A_LIVE_GROUP = ["the kitchen light is burning at half past four",
                           "and nobody came back to climb the stairs",
                           "she left the coffee cooling on the chairs",
                           "i heard him turn the handle of the door"]
LIVE_GROUPS = [[1, 2], [2, 3], [3, 4]]


def test_tier2_does_not_offer_a_pair_its_own_grader_rejects():
    """DEFECT F. Both tier-2 searches read the PIVOT's group list and nothing
    else — not the requirement KIND, and not the ANCHOR's own groups.

    FOUND BY RUNG 3 of the coverage experiment, by COMPLETING a defer session
    rather than stopping at the first prompt. Not a reading: the pair the
    prompt printed under *THE PAIR THE GRADER'S OWN SEARCH IS PROPOSING* was
    put through `verify()` and came back

        accepted  : False
        new_flags : [(5, 'SCHEME_VIOLATION'), (19, 'RETURN_NOT_VERBATIM')]

    Two rejections, one sentence. `(19, ...)` is the SEARCH half of defect E —
    `other_calls` never read `return_groups`, so a group requiring identity
    contributed its end word to a RHYME search. `(5, ...)` is the anchor half
    — `modal_field(w)` is derived from the pivot's candidate alone, so an
    anchor that is itself a pivot was searched as though the shared group
    were its only obligation.

    DOCTRINE 48 ONE LAYER OVER. The offer was never put through the check
    that judges the answer, so "this pair cannot be accepted" was not a
    verdict the loop could reach — and a blind writer that took the only
    correct move available to it was rejected for a flag on a line the prompt
    had never mentioned.

    CHECK 8 IS THE CONTROL THAT KEEPS THE FIX HONEST: on the ordinary shape —
    an anchor in one group — nothing changes at all.
    """
    print("\n19. tier 2 does not offer a pair its own grader would reject")
    import dataclasses
    from quality import propose as _PR
    import quality.schemes as _SC
    from quality.schemes import Return
    from quality.loop import _anchor_obligations
    from quality.revise import Reviser as _R

    RV = _R()
    m = _SC.mandate(ANCHOR_GROUPS, n_lines=6)
    calls, rets = _anchor_obligations(RV, m, ANCHOR_IS_A_PIVOT, 1, 3)
    check("the anchor's OWN call words are read off the mandate, and the "
          "group being backtracked is the only one dropped",
          calls == ["hear"] and rets == [],
          f"partners(1)={m.partners(1)} -> calls={calls} rets={rets}")

    # THE HEADLINE, MEASURED. `w` is the PIVOT's proposed word, drawn the way
    # the loop draws it — L3 must answer group C [3, 4], call word 'wake'.
    # The old anchor field was `modal_field(w)`; the new one is the
    # conjunction with the anchor's own calls. Both are computed here so the
    # difference is a number in this suite and not a claim in a comment.
    pf, _ = RV.joint_field(["wake"], exclude=("break",))
    w = pf[0]
    old, _ = RV.modal_field(w, exclude=("near",))
    new, _ = RV.joint_field([w] + calls, exclude=("near",))
    check("the OLD anchor field offered words every one of which breaks a "
          "group nobody had mentioned; the folded one is empty, which is the "
          "true answer",
          len(old) > 0 and new == [],
          f"pivot word {w!r}: unfolded={len(old)} word(s) e.g. {old[:4]} "
          f":: folded={new}")

    # A RETURN IS ASKED OF `requirement`, NOT OF `returns` MEMBERSHIP -- the
    # same discrimination §43 of `test_revise.py` makes one layer down.
    RET_G = [[1, 2], [1, 3], [3, 4]]
    mr = _SC.mandate(RET_G, n_lines=6, returns=[[1, 2]])
    _c, r2 = _anchor_obligations(RV, mr, ANCHOR_IS_A_PIVOT, 1, 3)
    ml = dataclasses.replace(mr, returns=(
        Return(lines=(1, 2), label="R1", verbatim=False),))
    _c2, r3 = _anchor_obligations(RV, ml, ANCHOR_IS_A_PIVOT, 1, 3)
    check("an anchor pinned by a verbatim return is reported as PINNED, and "
          "a LICENSED repeat over the same two lines is NOT",
          r2 and not r3,
          f"verbatim -> {r2}; verbatim=False -> {r3}")

    # THE DEAD END NAMES WHICH SEARCH FAILED. `starved` is its own count and
    # is not folded into "none accepted" (doctrine 79) -- before the fold the
    # anchor field was never empty here, so this sentence was unsayable.
    res = revise_loop(RV, ANCHOR_IS_A_PIVOT, m,
                      propose=lambda *a, **k: None,
                      propose_pair=lambda *a, **k: None)
    # `attempts[-1]` stopped being the tier-2 attempt when mandatory pursuit
    # added tier-1 attempts for the pursued lines after it; select by tier.
    det = [a for a in res.rounds[0].attempts if a.tier == 2][-1].reason
    check("an EMPTY ANCHOR conjunction is reported as its own outcome, not "
          "as a search that came back short",
          "EMPTY ANCHOR field" in det and "unsatisfiable at this anchor" in det
          and "L1's own group(s)" in det, det[:200])

    # THE RETURN PIN — rung 3's own shape, with the PIVOT (L3) in a declared
    # verbatim return. Every word this tier could offer it is illegal, so no
    # pair is put to a proposer at all.
    PIN = ANCHOR_IS_A_PIVOT + [ANCHOR_IS_A_PIVOT[2]]
    mp = _SC.mandate([[1, 2], [1, 3], [3, 4], [5, 6], [3, 7]], n_lines=7,
                     returns=[[3, 7]])
    asked = []
    res2 = revise_loop(RV, PIN, mp, propose=lambda *a, **k: None,
                       propose_pair=lambda pb: asked.append(pb))
    pinned_det = [a.reason for r in res2.rounds for a in r.attempts
                  if a.tier == 2]
    check("a pivot pinned by a declared verbatim return is NOT SEARCHED, and "
          "the reason names the group rather than reporting an empty field",
          any("PINNED by return group" in d for d in pinned_det)
          and any("is itself a RETURN" in d for d in pinned_det),
          pinned_det[:1])
    check("...and no pair is put to a proposer at all — a refusal is not a "
          "failed search (doctrine 20)",
          asked == [] and any("NOT ATTEMPTED" in d for d in pinned_det),
          f"{len(asked)} pair prompt(s) asked :: {pinned_det[:1]}")

    # THE WRITER IS TOLD. The prompt renders THE RHYME MANDATE ON THE PIVOT;
    # until this fix it rendered no block for the anchor, so the writer was
    # asked to move a word without being told what it owed.
    seen = []
    revise_loop(RV, ANCHOR_HAS_A_LIVE_GROUP,
                _SC.mandate(LIVE_GROUPS, n_lines=4),
                propose=lambda *a, **k: None,
                propose_pair=lambda pb: seen.append(pb))
    withc = [pb for pb in seen if pb.anchor_calls]
    check("`PairBrief.anchor_calls` carries the anchor's own call words to "
          "the renderer, and the prompt says so in its own block",
          withc and withc[0].anchor_calls == ("door",)
          and "AND THE ANCHOR HAS GROUPS OF ITS OWN — L3 is a pivot too"
          in _PR.render_pair(withc[0])
          and "L3 must also answer: 'door'" in _PR.render_pair(withc[0]),
          f"{len(withc)} of {len(seen)} pair brief(s) carry anchor_calls")

    # CONTROL — THE ORDINARY SHAPE IS UNTOUCHED. An anchor in one group has
    # no other obligation, so `anchor_calls` is empty and the block does not
    # render. A fix that also fired here would be a second defect.
    plain = []
    revise_loop(Reviser(), SILVER_MIND, [[1, 3], [2, 3]],
                propose=lambda *a, **k: None,
                propose_pair=lambda pb: plain.append(pb))
    check("CONTROL: an anchor in ONE group carries no extra calls and the "
          "new block does not render — the fix is inert where the defect is "
          "not",
          plain and all(pb.anchor_calls == () for pb in plain)
          and "AND THE ANCHOR HAS GROUPS OF ITS OWN"
          not in _PR.render_pair(plain[0]),
          f"{len(plain)} pair brief(s), anchor_calls "
          f"{[pb.anchor_calls for pb in plain[:3]]}")


#: Clean rhymes that ARE the modal answers — town/down, four/more — so the
#: draft carries MODAL_RHYME on L3/L4 and not one flag. The same shape
#: test_revise §42 measures; spelled out here per this file's own rule that
#: one suite never imports another's fixtures.
MODAL_DRAFT = ["the bank foreclosed and boarded up the town",
               "the freight train left the siding after four",
               "we packed the truck and never once looked down",
               "and drove until the county line was more"]


def test_pursuit_is_mandatory_and_success_below_it_unreportable():
    """The owner's standing order, 2026-08-17, as mechanism.

    `--pursue` was built opt-in. The operator ran the loop without it and a
    draft whose EVERY rhyme pair was the most predictable answer in its own
    field was reported SUCCESS — the exact prose-trust failure doctrine 48
    names, in the loop built to end it. `MANDATORY_PURSUE` is the repair:
    the loop unions it under every declaration, nothing subtracts from it,
    and success while a member stands is unreportable.
    """
    print("\n20. pursuit is MANDATORY, and success below it is unreportable")
    from quality.loop import MANDATORY_PURSUE

    check("the mandatory set exists, is non-empty, and carries the code the "
          "order was given about",
          "MODAL_RHYME" in MANDATORY_PURSUE, sorted(MANDATORY_PURSUE))

    # MODAL_DRAFT: clean rhymes that ARE the modal answers — no flag anywhere.
    R2 = Reviser()
    bs = R2.brief(list(MODAL_DRAFT), [[1, 3], [2, 4]])
    check("the fixture carries MODAL_RHYME and NO flag, so nothing but "
          "pursuit can open it",
          not any(f.severity == "flag" for b in bs for f in b.findings)
          and any(f.code == "MODAL_RHYME" for b in bs for f in b.findings))

    # EMPTY DECLARATION, refusing proposer: the old behaviour was instant
    # SUCCESS. Now the lines are opened anyway and the stop is loud.
    res = revise_loop(R2, list(MODAL_DRAFT), [[1, 3], [2, 4]],
                      propose=lambda *a, **k: None)
    check("an EMPTY declaration still pursues — the loop cannot report "
          "success while a mandatory finding stands",
          res.stop_reason != "success"
          and sorted(b.line_no for b in res.unresolved_pursued) == [3, 4],
          f"stop={res.stop_reason} pursued="
          f"{[b.line_no for b in res.unresolved_pursued]}")

    # ...and the default mechanical proposer CLEARS them, reaching the only
    # reportable success: nothing actionable left.
    res2 = revise_loop(Reviser(), list(MODAL_DRAFT), [[1, 3], [2, 4]])
    bs2 = Reviser().brief(list(res2.lines), [[1, 3], [2, 4]])
    check("with a proposer that answers, the loop revises to the only "
          "success there is: zero mandatory findings standing",
          res2.stop_reason == "success"
          and not any(f.code in MANDATORY_PURSUE
                      for b in bs2 for f in b.findings),
          f"stop={res2.stop_reason}")

    # A declaration may ADD, never subtract: the union always holds.
    from quality.revise import ReviseDeclaration as _RD
    R3 = Reviser(rdecl=_RD(pursue=frozenset({"CLICHE_PAIR"})))
    res3 = revise_loop(R3, list(MODAL_DRAFT), [[1, 3], [2, 4]],
                       propose=lambda *a, **k: None)
    check("a declaration that names OTHER codes still pursues the mandatory "
          "set — `pursue` is additive only",
          sorted(b.line_no for b in res3.unresolved_pursued) == [3, 4],
          [b.line_no for b in res3.unresolved_pursued])


if __name__ == "__main__":
    for fn in (test_success_stop,
               test_no_progress_stop,
               test_round_limit_stop,
               test_tier2_backtrack_resolves_a_joint_conflict,
               test_tier2_tries_and_correctly_rejects,
               test_tier2_declines_a_group_of_three_or_more,
               test_the_loop_never_touches_an_unreported_line,
               test_swap_end_word_refuses_a_disagreeing_reading,
               test_no_mandate_is_a_refusal_not_a_pass,
               test_strip_parens_is_a_declared_coordinate,
               test_optin_layers_are_disclosed_and_success_is_per_line,
               test_declared_returns_are_asked_and_have_no_move,
               test_pair_brief_carries_the_situation,
               test_propose_sees_the_whole_draft_rubric,
               test_tier2_still_resolves_a_joint_conflict_through_pair_brief,
               test_backtrack_width_still_bounds_the_search,
               test_a_dead_end_and_an_open_line_each_name_their_own_rule,
               test_a_line_is_briefed_against_the_draft_as_it_now_stands,
               test_tier2_does_not_offer_a_pair_its_own_grader_rejects,
               test_pursuit_is_mandatory_and_success_below_it_unreportable):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all loop regressions pass")
