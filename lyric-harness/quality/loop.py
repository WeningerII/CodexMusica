#!/usr/bin/env python3
"""The automated write-check-fix loop — quality/revise.py driven to
convergence instead of one round at a time by hand.

Run: python3 lyric_harness.py revise FILE MANDATE

WHAT THIS IS NOT. It does not write lyrics. "The model proposes, this
grades" (CLAUDE.md, first page) is not relaxed here — text generation is a
PLUGGABLE `propose`/`propose_pair` callable the caller supplies. The default
shipped here (`swap_end_word`, `default_propose`, `default_propose_pair`) is
a MECHANICAL stub: it substitutes exactly one word and touches nothing else.
That is enough to prove the loop's own control flow — accept, reject, retry,
backtrack, stop — actually works, without a live model anywhere in the run.
It is not offered as a way to write a good line, and nothing here scores one.

TWO TIERS, matching what a person backspacing through a draft actually does.

  TIER 1 — swap the flagged line's own end word for one of `brief()`'s
  offered candidates, and hand it to `verify()`. This is what
  `Reviser.brief`/`verify` were already built for; this module only adds the
  repetition.

  TIER 2 — BACKTRACK. Some pivot lines are not hard, they are IMPOSSIBLE:
  `Brief.joint_conflict` means `joint_field` already searched the complete
  candidate pool and nothing in it answers every group the line is in at
  once. Retrying tier 1 there is not "try harder" — it is re-running a
  search that has already proven empty, on the SAME line, which is why
  `Brief.joint_conflict` says plainly "the mandate, not the line, is what
  needs revising." The fix, when one exists, is upstream: change the word of
  the line THIS one has to match, which changes what the pivot must satisfy.
  Bounded to groups of exactly two lines (the pivot and one ANCHOR) — a
  group of three or more would mean rewriting the whole group at once to
  keep its members mutually rhyming, which is a bigger and structurally
  different move than backtracking one step, and this tier does not attempt
  it. It says so in the result rather than pretending the search was wider
  than it was.

STOP CONDITIONS, and they are not one thing.

  SUCCESS       `brief()` has nothing left carrying a "flag" finding —
                which is a PER-LINE statement and not a clean bill of
                health; see "THE STOP CONDITIONS ARE PER-LINE SCOPED" below.
  NO_PROGRESS   a whole round fixed nothing; running an identical round
                again would not either, so the loop does not.
  ROUND_LIMIT   `ReviseDeclaration.max_rounds` reached — declared since the
                first commit of `quality/revise.py`, unread by anything
                until this module.

A per-line dead end (tier 1 exhausted; tier 2 exhausted, or not attempted
because every one of a pivot's groups has three or more members) is NOT a
stop condition on its own. The loop keeps going on every OTHER flagged line
and reports the dead end in the result — it does not discard the draft over
one line it could not solve.

WHICH LAYERS ONE RUN ACTUALLY ASKS, AND WHICH IT DOES NOT. Doctrine 48 in
this module's own back yard: a grading layer that is off unless a caller
passes a parameter, and does not SAY it was off, is indistinguishable in the
result from a layer that was asked and came back clean.

  ALWAYS ASKED, whatever the caller passes — the mandate's rhyme grading
  (`Reviser.grade`), the slop floor (`quality/floor.py`), doctrine 9's modal
  exclusion in BOTH of its directions (reactively, as the FORBIDDEN head of
  every candidate field; and proactively, as `MODAL_RHYME` on a pair that
  never failed anything), the declared returns (`Mandate.returns_check`,
  which is VACUOUS rather than skipped when the mandate declares none — a
  letter string declares none, `--returns=` and A-1 notation declare some),
  and the readability REFUSALS of mandated pairs.

  ASKED IS NOT THE SAME AS ACTIONABLE, and the floor is where the two come
  apart furthest. It is called on every run, but its LENGTH-SENSITIVE half
  is gated by doctrine 15: outside a calibrated profile's measured range
  every one of its findings is downgraded to a note, and inside one the two
  that can still be flags — `LEXICAL_MONOTONY`, `FUNCTION_WORD_HEAVY` — are
  whole-draft and invisible below. Measured on this suite's own fixture:
  4 lines is 37 tokens and lands in the `section` profile exactly, so
  `LEXICAL_MONOTONY` IS a flag there; 8 and 10 lines (74 and 93 tokens) fall
  between two profiles and every floor finding becomes a note. What is left
  that can actually start a round is the LENGTH-INDEPENDENT half —
  `CLICHE_PAIR` and `REPEAT_IN_VERSE`, which are flags at any length and are
  in `RHYME_FINDINGS`, so they earn a candidate field. `ANAPHORA_OVERLOAD`
  names lines and so IS briefed, but it is not in `RHYME_FINDINGS`: the line
  comes back with an empty field and the round reports "no candidates
  offered". The same is true of every meter flag and of
  `RETURN_NOT_VERBATIM` — seen, briefed, and left where they are, which is a
  reported dead end rather than a silent pass.

  OPT-IN, and silently absent without the parameter — meter
  (`quality/fit.py`) and song-function (`quality/grid.py`) BOTH ride the one
  `blueprint=` coordinate, so omitting it drops TWO layers, not one;
  `subdivision=` then decides whether meter's slot questions are answered or
  refused; `profile=` picks the comparator every score is read under.
  `LoopResult.disclosure()` states each of them on every run, both ways —
  the same move `Reviser.inspect`'s own `blueprint_declared` key makes one
  level down, and the CLI's `_say_blueprint()` makes one level up. This
  module was the gap between those two: `revise_loop` has taken
  `blueprint=` since meter joined the loop and its RESULT said nothing about
  whether it got one, so a caller holding a `LoopResult` — or reading one
  back later, without the call site in view — could not tell "meter clean"
  from "meter never asked."

  ASKED SINCE 2026-08-14 — `quality/readability.py`'s own report.
  `Reviser.inspect` folds it in, so an unreadable end word on a line the
  mandate leaves FREE reaches this loop, where it used to be invisible: what
  arrived before was only `grade`'s `refusals`, scoped to pairs the MANDATE
  puts together.
  IT ARRIVES AS A NOTE, so nothing in this file's control flow changes. A
  refusal is not a violation (doctrine 79), and `SCHEME_UNREADABLE` — the same
  refusal on a pair the mandate DECLARED — was already a note, so flagging this
  one would make an unreadable word on an UNMANDATED line fail harder than the
  identical word on a mandated one. Measured both ways: as a note the loop
  returns SUCCESS in 0 rounds on a draft whose only defect is an unreadable
  free-line end word; as a flag it returns NO_PROGRESS with that line
  unresolved — and NO_PROGRESS rather than ROUND_LIMIT, because the loop
  notices a barren round before exhausting `max_rounds`.
  ~~NEVER ASKED, from here or from `quality/revise.py`. Not fixed in this
  module: the join belongs in `Reviser.inspect`, which this file does not
  own.~~

THE STOP CONDITIONS ARE PER-LINE SCOPED, WHICH IS THE ONE THING "SUCCESS"
DOES NOT MEAN. `brief()` is built out of `inspect()`'s `per_line` half only,
so a WHOLE-DRAFT finding — one with no single line to hand back — is
structurally invisible to `flagged` below, flag or not. Three codes are
whole-draft AND a flag: `LEXICAL_MONOTONY` and `FUNCTION_WORD_HEAVY` (the
floor, and only where the draft's token count is inside a calibrated
profile's MEASURED range — outside it they are downgraded to notes, so the
loop's blindness to them is invisible at most lengths too), and
`HOOK_ABSENT` (song-function, so only once a blueprint is declared). Every
one of them IS read by `verify()`, whose diff covers `whole` as well as
`per_line` — so a whole-draft flag can REJECT a revision and can never ASK
for one, and `revise_loop` can and does return SUCCESS on a draft still
carrying one. That asymmetry is not closed by widening the stop condition:
this loop's only move is a word swap on a NAMED line, none of the three
names one, and promoting them would spend every round of `max_rounds` on a
defect the loop has no move for and then report ROUND_LIMIT about it. It is
DISCLOSED instead — `LoopResult.whole`/`.whole_flags` carry them out of the
run and `__str__` prints them under the stop reason, so SUCCESS is never
read as "clean" when it means "nothing left that this loop can act on."
"""

import os
import re
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import load_lyric_lines, raw_final_token  # noqa: E402
from quality.revise import ReviseDeclaration, Reviser  # noqa: E402

__all__ = ["LineAttempt", "RoundResult", "LoopResult", "revise_loop",
          "swap_end_word", "default_propose", "default_propose_pair"]

_WORD_RE = re.compile(r"[A-Za-z'\-]+")


def swap_end_word(text, new_word):
    """-> `text` with its LAST token replaced by `new_word`; `None` if it
    cannot be done without guessing.

    "Last token" is `raw_final_token`'s reading — the ONE definition of a
    line's end word every rhyme lookup in this project has to agree with
    (`lyric_harness.raw_final_token`'s own docstring). This function finds
    that SAME token's character span in the RAW text (not a normalised
    copy) so everything else — leading words, punctuation, whitespace — is
    byte-identical, and refuses rather than guessing when a second, cruder
    reading of "the last word" (the last regex match with no paren-
    stripping) would disagree with the canonical one: a parenthetical after
    the rhyme word is exactly the kind of case doctrine 1 says may not be
    read twice, differently, in one codebase.
    """
    matches = list(_WORD_RE.finditer(text))
    if not matches:
        return None
    last = matches[-1]
    old = last.group(0)
    if old != raw_final_token(text):
        return None
    if old.isupper():
        cased = new_word.upper()
    elif old[:1].isupper():
        cased = new_word.capitalize()
    else:
        cased = new_word.lower()
    return text[:last.start()] + cased + text[last.end():]


def default_propose(brief, lines, attempt, reasons=None):
    """-> a replacement line for `brief.line_no`, or `None` to give up.

    The MECHANICAL stub tier 1 ships with: walk `brief.candidates` in the
    order `joint_field` already ranked them (modal region excluded, so this
    is already "not the obvious one" before this function does anything),
    one per attempt. `reasons` (the previous attempt's rejection, `None` on
    the first try) is accepted and ignored here — a proposer that actually
    writes would read it; this one only proves the loop calls it correctly.
    """
    if attempt >= len(brief.candidates):
        return None
    return swap_end_word(brief.text, brief.candidates[attempt])


def default_propose_pair(pivot_text, anchor_text, pivot_word, anchor_word):
    """-> (new_pivot_text, new_anchor_text), or `None`. Tier 2's stub,
    same mechanism as `default_propose`: one word swapped on each line."""
    new_pivot = swap_end_word(pivot_text, pivot_word)
    new_anchor = swap_end_word(anchor_text, anchor_word)
    if new_pivot is None or new_anchor is None:
        return None
    return new_pivot, new_anchor


@dataclass
class LineAttempt:
    """One line's outcome for one round — accepted or not, and why."""
    line_no: int
    tier: int                    # 1 (word swap) or 2 (backtrack)
    accepted: bool
    tried: int                   # candidates or pairs actually attempted
    reason: str
    touched: tuple = ()          # line number(s) actually changed


@dataclass
class RoundResult:
    round_no: int
    attempts: list = field(default_factory=list)     # [LineAttempt]
    fixed_lines: list = field(default_factory=list)   # sorted, this round


@dataclass
class LoopResult:
    """-> from `revise_loop`. `stop_reason` is one of "success",
    "no_progress", "round_limit" — never a fourth value, so a caller can
    switch on it exhaustively.

    THE FIELDS BELOW `unresolved` ARE THE DISCLOSURE, and they are metadata
    about the CALL, not verdicts about the draft: which optional grading
    layers were asked at all, the three pair counts doctrine 79 says are
    never one number, and the whole-draft findings the per-line stop
    condition is structurally unable to see (this module's own docstring,
    "THE STOP CONDITIONS ARE PER-LINE SCOPED"). They default to the values a
    run that asked nothing optional would produce, so a `LoopResult` built by
    hand in a test is still a legal one.
    """
    stop_reason: str
    lines: list
    rounds: list          # [RoundResult]
    unresolved: list      # [Brief], still carrying a flag finding at stop
    #: `Reviser.inspect`'s OWN key, read out rather than recomputed here from
    #: `blueprint is not None` — one definition of "was meter asked", so this
    #: module cannot come to disagree with the module it drives (doctrine 1).
    blueprint_declared: bool = False
    #: meter's slot questions are ANSWERED with one and REFUSED without one;
    #: `quality/fit.py` has no default subdivision and must not acquire one.
    subdivision_declared: bool = False
    #: the comparator every score in this run was read under (`None` = the
    #: declared default). Doctrine 45: a checker that silently picks one is
    #: making a claim it never states.
    profile: object = None
    #: [Finding] — `inspect()`'s whole-draft half at the stop point. NOT
    #: reachable from `unresolved`, which holds `Brief`s and therefore only
    #: ever holds per-LINE findings.
    whole: list = field(default_factory=list)
    #: doctrine 79, three counts, never summed: a refusal (an end word the
    #: harness could not read) is not a judged pair that came back clean.
    pairs_mandated: int = 0
    pairs_judged: int = 0
    pairs_refused: int = 0

    @property
    def whole_flags(self):
        """The whole-draft findings that are FLAGS — the ones `stop_reason`
        above was never able to see. `LEXICAL_MONOTONY`, `FUNCTION_WORD_HEAVY`,
        `HOOK_ABSENT` are the only three codes that can appear here."""
        return [f for f in self.whole if f.severity == "flag"]

    def disclosure(self):
        """-> [str]. What was ASKED and what the stop condition could not see.

        Printed by `__str__` on every run, in both directions, for the reason
        `Reviser.inspect`'s `blueprint_declared` key exists: silence about an
        opt-in layer reads exactly like that layer having been checked and
        found clean, and the caller who most needs to know is the one reading
        the result without the call site in view.
        """
        out = []
        if self.blueprint_declared:
            out.append("  LAYERS: rhyme, slop floor, declared returns, AND "
                      "meter + song-function (blueprint declared"
                      + (", subdivision declared)" if self.subdivision_declared
                         else ", NO SUBDIVISION DECLARED — meter's slot "
                              "questions refuse rather than assume one)"))
        else:
            out.append("  LAYERS: rhyme, slop floor and declared returns "
                      "ONLY. NO BLUEPRINT — meter and song-function were NOT "
                      "ASKED, which is not the same as their being clean "
                      "(doctrine 20: a refusal is not a pass)")
        prof = ("declared default" if self.profile is None
                else repr(self.profile))
        out.append(f"  COMPARATOR: profile={prof}")
        out.append(f"  PAIRS: mandated {self.pairs_mandated}, judged "
                  f"{self.pairs_judged}, refused {self.pairs_refused} — three "
                  f"counts, never summed (doctrine 79)")
        if self.whole_flags:
            out.append("  WHOLE-DRAFT FLAG(S) NO STOP CONDITION ABOVE CAN "
                      "SEE: " + ", ".join(f.code for f in self.whole_flags))
            out.append("    a whole-draft finding names no line, and this "
                      "loop's only move is a word swap on a named line, so "
                      "these were never briefed and never revised. "
                      "`verify()` DOES read them, so one of these can reject "
                      "a revision and can never ask for one. Disclosed here "
                      "so a SUCCESS is not read as a clean draft")
        return out

    def __str__(self):
        out = [f"revise_loop: {self.stop_reason.upper()} after "
              f"{len(self.rounds)} round(s)"]
        for r in self.rounds:
            fixed = ", ".join(f"L{n}" for n in r.fixed_lines) or "none"
            out.append(f"  round {r.round_no}: fixed {fixed}")
            for a in r.attempts:
                mark = "OK" if a.accepted else "--"
                out.append(f"    [{mark}] L{a.line_no} tier{a.tier} "
                          f"({a.tried} tried): {a.reason}")
        if self.unresolved:
            out.append(f"  unresolved: "
                      f"{', '.join('L' + str(b.line_no) for b in self.unresolved)}")
        out.extend(self.disclosure())
        return "\n".join(out)


def _close(reviser, stop_reason, lines, rounds, unresolved, mandate,
           blueprint, subdivision, assume, profile):
    """Build the `LoopResult`, and take the disclosure off `inspect()` on the
    way out. Called at all three stop conditions and nowhere else.

    ONE extra `inspect()` per RUN — not per round, not per line — on the
    final draft, at the moment the loop is already holding it. What it reads
    (`blueprint_declared`, the whole-draft finding list, `grade`'s three
    counts) is exactly what `quality/revise.py` already mints and this module
    was throwing away: the loop calls `brief()`, which calls `inspect()` and
    keeps only the `per_line` half. This is deliberately a READ of that
    module's own keys rather than a second computation of the same facts —
    a locally recomputed `blueprint is not None` would be a second definition
    that can drift (doctrine 1), and the three pair counts recomputed here
    would be a second grader.

    THE COST IS BOUNDED BY THE CALL THAT PRECEDES IT, and it was MEASURED
    rather than assumed: every stop condition is reached immediately after
    `brief(lines, ...)` on these same lines, so `Reviser._matrix_cache` and
    `_field_cache` are already holding this exact draft. On the four-line
    fixture this suite uses, a second `inspect()` straight after the first
    costs 0.1s against the first one's 43.6s — 0.2% of a 75s run. The one
    case where that does not hold is NO_PROGRESS after a round with several
    rejected proposals: `verify()` inserts each `after` draft into the
    8-entry matrix cache, so the entry for THESE lines can be evicted and the
    pairwise matrix recomputed. That is O(n^2) `best_score` calls on a draft
    of a few lines, not a rebuild of the candidate field, which is where a
    run's time actually goes.
    """
    found = reviser.inspect(lines, mandate, profile=profile,
                            blueprint=blueprint, subdivision=subdivision,
                            assume=assume)
    g = found["grade"]
    return LoopResult(
        stop_reason, lines, rounds, unresolved,
        blueprint_declared=found["blueprint_declared"],
        subdivision_declared=subdivision is not None,
        profile=profile,
        whole=list(found["whole"]),
        pairs_mandated=g["pairs_mandated"],
        pairs_judged=g["pairs_judged"],
        pairs_refused=g["pairs_refused"])


def _try_tier1(reviser, b, lines, mandate, rdecl, blueprint, subdivision,
               assume, profile, propose):
    tried = 0
    reasons = None
    for attempt in range(rdecl.attempts_per_line):
        candidate = propose(b, lines, attempt, reasons)
        if candidate is None:
            break
        tried += 1
        after = list(lines)
        after[b.line_no - 1] = candidate
        res = reviser.verify(lines, after, mandate, targeted={b.line_no},
                             profile=profile, blueprint=blueprint,
                             subdivision=subdivision, assume=assume)
        if res["accepted"]:
            return LineAttempt(b.line_no, 1, True, tried,
                               "; ".join(res["reasons"]), (b.line_no,)), after
        reasons = res["reasons"]
    detail = f"tried {tried} candidate(s), none accepted"
    if reasons:
        detail += f"; last rejection: {'; '.join(reasons)}"
    elif tried == 0:
        detail = "no candidates offered"
    return LineAttempt(b.line_no, 1, False, tried, detail, ()), lines


def _try_tier2(reviser, b, lines, mandate, rdecl, blueprint, subdivision,
               assume, profile, propose_pair):
    two_member = [(lab, mem, calls) for lab, mem, calls in b.must_answer
                  if len(mem) == 2]
    too_large = len(b.must_answer) - len(two_member)
    tried = 0
    for label, _members, calls in two_member:
        anchor_line, anchor_word = calls[0]
        anchor_text = lines[anchor_line - 1]
        other_calls = [w for lab2, _m2, cl2 in b.must_answer if lab2 != label
                       for _, w in cl2]
        if not other_calls:
            continue
        pivot_word = raw_final_token(b.text) or ""
        p_offered, _p_forbidden = reviser.joint_field(
            other_calls, exclude=(pivot_word,))
        for w in p_offered[:rdecl.backtrack_width]:
            a_offered, _a_forbidden = reviser.modal_field(
                w, exclude=(anchor_word,))
            for v in a_offered[:rdecl.backtrack_width]:
                pair = propose_pair(b.text, anchor_text, w, v)
                if pair is None:
                    continue
                tried += 1
                new_pivot, new_anchor = pair
                after = list(lines)
                after[b.line_no - 1] = new_pivot
                after[anchor_line - 1] = new_anchor
                res = reviser.verify(
                    lines, after, mandate,
                    targeted={b.line_no, anchor_line}, profile=profile,
                    blueprint=blueprint, subdivision=subdivision,
                    assume=assume)
                if res["accepted"]:
                    return LineAttempt(
                        b.line_no, 2, True, tried,
                        f"backtracked: L{anchor_line} -> {v!r} so "
                        f"L{b.line_no} could take {w!r}; "
                        + "; ".join(res["reasons"]),
                        (b.line_no, anchor_line)), after
    detail = (f"tried {tried} anchor/pivot pair(s) across "
             f"{len(two_member)} two-line group(s), none accepted")
    if too_large:
        detail += (f"; {too_large} of {len(b.must_answer)} group(s) have "
                  f"3+ members and were NOT attempted — fixing those means "
                  f"rewriting a whole group, not backtracking one line")
    if not two_member:
        detail = (f"no two-line group to backtrack — all "
                 f"{len(b.must_answer)} of this pivot's groups have 3+ "
                 f"members, which this tier does not rewrite")
    return LineAttempt(b.line_no, 2, False, tried, detail, ()), lines


def revise_loop(reviser, lines, mandate, blueprint=None, subdivision=None,
                assume=None, profile=None, propose=None, propose_pair=None):
    """Drive `reviser.brief`/`verify` to convergence. -> `LoopResult`.

    `reviser` is a caller-supplied `Reviser` (its `.rdecl` supplies
    `max_rounds`/`attempts_per_line`/`backtrack_width`) so a caller can tune
    the loop the same way it already tunes `modal_exclusion` or
    `field_band` — one declaration, not a second set of knobs.

    ONE `brief()` PER ROUND, not one per line fixed. Fixing line X inside a
    round can change what a LATER flagged line Y in the SAME round must
    satisfy (if X is one of Y's call words), so Y's candidate list from this
    round's brief can go stale mid-round. This is deliberately not chased:
    `verify()` always re-derives the true finding set for the CURRENT
    `lines` before accepting anything, so a stale candidate is simply
    rejected rather than wrongly accepted — correctness does not depend on
    re-briefing every line, and Y is re-briefed fresh at the top of the next
    round regardless. RAISES `NoMandate` exactly when `brief()`/`verify()`
    already do: a loop with nothing to check against is not this module's
    problem to paper over.

    `blueprint`/`subdivision`/`assume`/`profile` are the OPT-IN coordinates
    and every one of them is restated in the returned `LoopResult` (see
    `LoopResult.disclosure`), so which layers this run asked travels WITH the
    result instead of living only on this call line.
    """
    propose = propose or default_propose
    propose_pair = propose_pair or default_propose_pair
    rdecl = reviser.rdecl
    rounds = []
    for round_no in range(1, rdecl.max_rounds + 1):
        briefs = reviser.brief(lines, mandate, profile=profile,
                               blueprint=blueprint, subdivision=subdivision,
                               assume=assume)
        # PER-LINE FLAGS ONLY, and this module's docstring says so out loud
        # rather than leaving it to be inferred from `brief()`'s signature:
        # `briefs` is built from `inspect()`'s `per_line` half, so a
        # whole-draft flag is not in `b.findings` for ANY b and cannot be
        # here. `_close` carries those out in `LoopResult.whole_flags`.
        flagged = [b for b in briefs
                  if any(f.severity == "flag" for f in b.findings)]
        if not flagged:
            return _close(reviser, "success", lines, rounds, [], mandate,
                          blueprint, subdivision, assume, profile)

        attempts, fixed_this_round, touched = [], [], set()
        for b in flagged:
            if b.line_no in touched:
                continue
            if b.joint_conflict:
                attempt, lines = _try_tier2(
                    reviser, b, lines, mandate, rdecl, blueprint,
                    subdivision, assume, profile, propose_pair)
            else:
                attempt, lines = _try_tier1(
                    reviser, b, lines, mandate, rdecl, blueprint,
                    subdivision, assume, profile, propose)
            attempts.append(attempt)
            if attempt.accepted:
                fixed_this_round.extend(attempt.touched)
                touched.update(attempt.touched)
        rounds.append(RoundResult(round_no, attempts,
                                  sorted(fixed_this_round)))
        if not fixed_this_round:
            return _close(reviser, "no_progress", lines, rounds, flagged,
                          mandate, blueprint, subdivision, assume, profile)

    briefs = reviser.brief(lines, mandate, profile=profile,
                           blueprint=blueprint, subdivision=subdivision,
                           assume=assume)
    unresolved = [b for b in briefs
                 if any(f.severity == "flag" for f in b.findings)]
    return _close(reviser, "round_limit", lines, rounds, unresolved, mandate,
                  blueprint, subdivision, assume, profile)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        # RHYME AND FLOOR ONLY, said in the usage line rather than left for a
        # reader to infer from the absence of a flag: this runner takes no
        # `--blueprint`, so meter and song-function are never asked through
        # it. `python3 lyric_harness.py revise FILE MANDATE
        # --blueprint=BP.json` is the surface that reaches them. Every run
        # here also prints the same fact under its own result
        # (`LoopResult.disclosure`), so the two cannot come apart.
        print("usage: python3 quality/loop.py FILE MANDATE\n"
              "       rhyme + slop floor + declared returns only; meter and "
              "song-function need a blueprint, which reaches the loop through "
              "`lyric_harness.py revise ... --blueprint=`", file=sys.stderr)
        sys.exit(2)
    # APPARATUS IS `[Section]`, `--- ` OR `#`, ONE DEFINITION — and this
    # runner was the last holdout after `lyric_harness.py`'s own verbs were
    # centralized onto `load_lyric_lines` (CLAUDE.md, 2026-08-12). Its own
    # inline filter kept only the `[` case, so a `# stage direction` or a
    # `--- TITLE:` note under a section header was fed to this module as sung
    # text: tokenized, rhyme-graded, counted toward the floor's MATTR, and
    # eligible to be handed back to a writer as a line to revise.
    lines_ = load_lyric_lines(sys.argv[1])
    R = Reviser(rdecl=ReviseDeclaration())
    result = revise_loop(R, lines_, sys.argv[2])
    print(result)
    print()
    print("\n".join(result.lines))
