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

Run: python3 quality/test_loop.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.loop import (default_propose, revise_loop,  # noqa: E402
                          swap_end_word)
from quality.revise import ReviseDeclaration, Reviser  # noqa: E402
from quality.schemes import NoMandate  # noqa: E402
from lyric_harness import line_tokens, raw_final_token, Lexicon  # noqa: E402

FAILURES = []


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

#: Verified interactively: BOTH of L5's groups have 3 members
#: ([1,2,5] and [3,4,5]), so neither qualifies for tier 2's two-line
#: backtrack at all -- `_try_tier2` reports 0 tried rather than searching a
#: group it cannot rewrite one line at a time.
TOO_LARGE = ["We laughed the whole entire day",
            "The kids went out to run and play",
            "It gleamed like polished silver",
            "Another walk beside the river",
            "The whole thing felt like a dream"]


def test_success_stop():
    print("\n1. SUCCESS — nothing left flagged, the stock proposer alone")
    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB")
    check("stops on SUCCESS", res.stop_reason == "success", res.stop_reason)
    check("both flagged lines were fixed",
          set(res.rounds[0].fixed_lines) == {1, 2},
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
    def refuses_everything(brief, lines, attempt, reasons=None):
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
    def picky(brief, lines, attempt, reasons=None):
        if brief.line_no == 2:
            return None
        return default_propose(brief, lines, attempt, reasons)
    R = Reviser(rdecl=ReviseDeclaration(max_rounds=1))
    res = revise_loop(R, CLICHE, "ABAB", propose=picky)
    check("stops on ROUND_LIMIT, distinct from NO_PROGRESS",
          res.stop_reason == "round_limit", res.stop_reason)
    check("L1 WAS fixed this round -- this is real progress, not a stall",
          res.rounds[0].fixed_lines == [1], res.rounds[0].fixed_lines)
    check("L2 is the one left unresolved, and says why",
          [b.line_no for b in res.unresolved] == [2],
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
    check("stops on SUCCESS", res.stop_reason == "success", res.stop_reason)
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
    print("\n5. TIER 2 — a resolving pair is tried and REJECTED for "
         "introducing a new FLAG elsewhere, which is not a bug in the "
         "search")
    R = Reviser()
    res = revise_loop(R, SILVER_NIGHT_LOCKED, SILVER_NIGHT_LOCKED_MANDATE)
    check("cannot reach SUCCESS -- L1 and L2 are each locked to their own "
          "mandated rhyme family (L4, L5), so backtracking either one to "
          "answer the pivot breaks a real mandated pair",
          res.stop_reason != "success", res.stop_reason)
    tier2 = [a for r in res.rounds for a in r.attempts if a.tier == 2]
    check("tier 2 DID search (tried > 0), it did not bail out early",
          tier2 and tier2[0].tried > 0, tier2[0].tried if tier2 else None)
    check("and every attempt was correctly rejected, none silently kept",
          tier2 and not tier2[0].accepted)
    check("the draft is untouched -- a rejected search changes nothing",
          res.lines == SILVER_NIGHT_LOCKED)


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
               test_strip_parens_is_a_declared_coordinate):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all loop regressions pass")
