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

  SUCCESS       `brief()` has nothing left carrying a "flag" finding.
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
"""

import os
import re
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import raw_final_token  # noqa: E402
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
    switch on it exhaustively."""
    stop_reason: str
    lines: list
    rounds: list          # [RoundResult]
    unresolved: list      # [Brief], still carrying a flag finding at stop

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
        return "\n".join(out)


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
    """
    propose = propose or default_propose
    propose_pair = propose_pair or default_propose_pair
    rdecl = reviser.rdecl
    rounds = []
    for round_no in range(1, rdecl.max_rounds + 1):
        briefs = reviser.brief(lines, mandate, profile=profile,
                               blueprint=blueprint, subdivision=subdivision,
                               assume=assume)
        flagged = [b for b in briefs
                  if any(f.severity == "flag" for f in b.findings)]
        if not flagged:
            return LoopResult("success", lines, rounds, [])

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
            return LoopResult("no_progress", lines, rounds, flagged)

    briefs = reviser.brief(lines, mandate, profile=profile,
                           blueprint=blueprint, subdivision=subdivision,
                           assume=assume)
    unresolved = [b for b in briefs
                 if any(f.severity == "flag" for f in b.findings)]
    return LoopResult("round_limit", lines, rounds, unresolved)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python3 quality/loop.py FILE MANDATE", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as fh:
        lines_ = [l.rstrip() for l in fh.read().splitlines()
                 if l.strip() and not l.strip().startswith("[")]
    R = Reviser(rdecl=ReviseDeclaration())
    result = revise_loop(R, lines_, sys.argv[2])
    print(result)
    print()
    print("\n".join(result.lines))
