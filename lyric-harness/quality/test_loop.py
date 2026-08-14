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

BOUNDED ON PURPOSE: every fixture here is 3-5 lines. One `revise_loop` run
over a 4-line draft costs 40-90s wall clock (the candidate field is built
over the complete lexicon pool), and a 28-line one has already blown a
180-second budget once. A fixture in this file that grows past about a dozen
lines is a fixture that stops being run.

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
from quality import schemes as SC  # noqa: E402
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
RETURN_DRIFT = ["we counted every reason we were given",
               "the kettle went on shouting in the hall",
               "we counted all the reasons we were given",
               "the morning came and did not care at all"]
RETURN_DRIFT_MANDATE = SC.mandate([[1, 3], [2, 4]], n_lines=4,
                                  returns=[[1, 3]])


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

    def refuses_everything(brief, lines, attempt, reasons=None):
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
    check("and the loop offers ZERO candidates for it -- a return is not "
          "repaired by swapping an end word, so `RETURN_NOT_VERBATIM` earns "
          "no candidate field and the attempt says so",
          l3 and l3[0].tried == 0 and not l3[0].accepted
          and "no candidates offered" in l3[0].reason,
          l3[0].reason if l3 else None)
    check("L1's rhyme WAS fixed in the same round -- one unsolvable line is "
          "never a stop condition, which is the invariant this fixture "
          "exercises against a real second layer rather than a stub",
          res.rounds[0].fixed_lines == [1], res.rounds[0].fixed_lines)
    check("L3 is byte-identical: a line the loop had no move for is left "
          "exactly as written",
          res.lines[2] == RETURN_DRIFT[2])


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
               test_declared_returns_are_asked_and_have_no_move):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all loop regressions pass")
