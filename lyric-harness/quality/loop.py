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

TIER 2 ASKED A WRITER TO COMPOSE BLIND, AND IT IS THE HARDER TIER — FIXED
2026-08-14. This module called `propose_pair(pivot_text, anchor_text,
pivot_word, anchor_word)`: FOUR BARE STRINGS, for the task of writing TWO
coupled lines that must rhyme with each other AND keep every other group
they answer — while tier 1, which swaps one word on one line, has always
been handed `propose(brief, lines, attempt, reasons)`. Everything the four
strings left out was IN SCOPE at that call site and thrown away: which
LINES these two are, the draft they sit in, the group being backtracked and
its members, the pivot's own `Brief` (its findings, its `joint_conflict`,
its `field_declaration`), and the previous attempt's rejection — which this
tier did not even keep. And the situation itself needed explaining: tier 2
only fires once `joint_field` has PROVED that no single word answers every
group at once, which is the one thing a writer most needs told and the one
thing four strings cannot say. It is a `PairBrief` now, one argument, and
`propose_pair(pair_brief) -> (str, str) | None` is the contract.

  THE FOUR-STRING ARITY IS GONE RATHER THAN KEPT BESIDE IT, and that is a
  decision with an argument rather than a shim by reflex. A compatibility
  shim would have to DISPATCH ON SHAPE, and neither end of the call can do
  that honestly. THE CALLEE CANNOT TELL WHICH IT GOT: under a two-shape
  interface `propose_pair(x)` receives either a `PairBrief` or
  `pivot_text`, a `str`, and a proposer written with `*args` — legal, and
  exactly what a decorator or a `functools.partial` wrapper produces — has
  to type-test its own first argument to discover which contract it is in.
  That is one fact read twice, in the caller's own body, with the
  declaration removed: the shape of defect doctrine 1 is about. THE CALLER
  CANNOT TELL EITHER, except through `inspect.signature`, which is
  unreadable for builtins, C callables and `*args`, and which would then be
  a SECOND statement of this contract sitting beside this docstring — the
  thing that drifts. This repo's own answer to "two readings of one input"
  is a DECLARED COORDINATE (`strip_parens`, `fallback`, `subdivision`), not
  a silent adapter, and an adapter is the only shape available here.

  WHAT BREAKS, NAMED RATHER THAN HOPED ABOUT. Any callable passed as
  `propose_pair=` taking four positionals, and any passed as `propose=`
  taking exactly four (`whole` is new and positional-fifth). Both raise
  `TypeError` naming the callable, at the FIRST proposal, before a single
  line of the draft has been touched — this loop mutates nothing until
  `verify()` accepts something, so a break here costs a run and never a
  draft. The set in this repo is enumerable and was enumerated: the two
  stubs below, and `quality/test_loop.py`'s own inline proposers. Nothing
  else passes either parameter — `lyric_harness.py`'s `revise` verb and
  `quality/test_revise.py` both call `revise_loop` without them and take
  the stubs. A loud break at a named call site is worth more than a silent
  adapter that lets a writer go on composing blind.

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
  `CLICHE_PAIR` and `REPEAT_IN_VERSE`, both in `RHYME_FINDINGS`, so both earn
  a candidate field.
  AMENDED 2026-08-14, and the amendment narrows this loop's reach: only
  `REPEAT_IN_VERSE` is a flag at any length now. `CLICHE_PAIR` runs at any
  length and may only REJECT inside the song profile's measured band, where
  its false-positive rate was measured (6.35% in band against 14.74% outside
  every profile — `quality/floor.py`'s CLICHE_PAIR docstring section). The
  two questions came apart: the membership test is length-blind, its LICENCE
  to reject is not. Priced on this suite's own fixtures, which is the only
  honest way to state it: at 4 lines / 37 tokens the `section` profile covers
  the draft exactly, so a stock pair still starts a round there; at 8 and 10
  lines it is now a note and starts none, so a draft between profiles whose
  ONLY defect is a stock rhyme reports SUCCESS with the note standing rather
  than spending rounds on it. That is the same shape as the three whole-draft
  flags above — disclosed in `LoopResult`, not acted on. `ANAPHORA_OVERLOAD`
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

AND THE PROPOSER WAS GRADED ON THAT RUBRIC WITHOUT EVER BEING SHOWN IT —
FIXED 2026-08-14. The paragraph above is written from the STOP CONDITION's
side. From the WRITER's side the same asymmetry is worse, because
`verify()`'s half of it is not blindness but ENFORCEMENT: its diff covers
`whole` as well as `per_line`, so a revision that introduces
`LEXICAL_MONOTONY`, `FUNCTION_WORD_HEAVY` or `HOOK_ABSENT` — or any of the
codes `_function_findings`/`_meter_findings` file with empty `locations` —
is REJECTED for it, and until now nothing ever told the proposer those
codes existed. `propose(brief, lines, attempt, reasons=None, whole=())` and
`PairBrief.whole` close that: the rubric a proposal is marked against is
handed to whoever writes it.

  NOT ON `Brief`, and this module's own argument above is why. A `Brief` is
  a per-LINE record; widening it to carry a finding that names no line is
  the move `LoopResult.whole`/`.whole_flags`/`disclosure()` exist precisely
  to avoid. `whole` travels as its own argument, so a proposer can tell
  "this is about MY line" from "this is about the draft" without reading a
  `locations` list to find out which it was handed.

  NO STOP CONDITION MOVES. `flagged` is still built from `brief()`, still
  per-line, and SUCCESS/NO_PROGRESS/ROUND_LIMIT mean exactly what they meant
  before. Showing a writer a defect is not the same as the loop claiming a
  move for it: this tier's only move is still a word swap on a named line,
  and none of these names one.

  ONE SOURCE, NOT A SECOND DERIVATION. `revise_loop` reads
  `inspect()["whole"]` — the same key `_close` reads to fill
  `LoopResult.whole` — rather than re-running the floor and the function
  layer here. Doctrine 1: two derivations of one fact drift, and this file
  has already paid that price once (`blueprint_declared` is READ off
  `inspect()` rather than recomputed from `blueprint is not None`).
  COST: one extra `inspect()` per ROUND, and only on a round that has
  something flagged — the success path returns before it. It is the same
  warm-cache call `_close` already makes for the same reason, and it was
  MEASURED the same way rather than assumed: on this suite's four-line
  fixture the round's own `brief()` costs 7.92s cold and the `inspect()`
  immediately after it costs 0.01s — 0.1% — because `brief()` has just
  filled `Reviser._matrix_cache`/`_field_cache` with this exact draft. The
  whole four-line run is 10.3s.
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

__all__ = ["LineAttempt", "PairBrief", "RoundResult", "LoopResult",
          "revise_loop", "swap_end_word", "default_propose",
          "default_propose_pair"]

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


def _open_lines(briefs, pursue=frozenset()):
    """-> the briefs this loop still has work on. ONE definition, because the
    SUCCESS test and the ROUND_LIMIT tally must not be able to disagree about
    what "unresolved" means — they were two copies of the same comprehension
    and this is what a coordinate added to one of them would have missed.

    A FLAG ALWAYS COUNTS. A NOTE COUNTS ONLY IF ITS CODE WAS DECLARED in
    `ReviseDeclaration.pursue`, which is empty by default — see that field for
    why `MODAL_RHYME` is pursued rather than re-typed as a flag, and why
    pursuing changes what the loop ASKS for and never what `verify()` rejects.
    """
    return [b for b in briefs
            if any(f.severity == "flag" or f.code in pursue
                   for f in b.findings)]


def default_propose(brief, lines, attempt, reasons=None, whole=()):
    """-> a replacement line for `brief.line_no`, or `None` to give up.

    The MECHANICAL stub tier 1 ships with: walk `brief.candidates` in the
    order `joint_field` already ranked them (modal region excluded, so this
    is already "not the obvious one" before this function does anything),
    one per attempt. `reasons` (the previous attempt's rejection, `None` on
    the first try) and `whole` (the draft-level findings `verify()` grades
    this proposal against — see the module docstring) are both accepted and
    both ignored here. A proposer that actually WRITES would read them; this
    one only proves the loop calls it correctly, and ignoring an argument in
    a stub is not the same as the loop declining to pass it.
    """
    if attempt >= len(brief.candidates):
        return None
    return swap_end_word(brief.text, brief.candidates[attempt])


def default_propose_pair(pair_brief):
    """-> (new_pivot_text, new_anchor_text), or `None`. Tier 2's stub,
    same mechanism as `default_propose`: one word swapped on each line.

    It reads exactly the four fields the old four-string signature carried
    (`pivot_text`, `anchor_text`, `pivot_word`, `anchor_word`) and ignores
    the other eleven, so the SEARCH this stub drives is byte-identical to
    what it drove before the `PairBrief` existed — the contract widened and
    the shipped behaviour did not move. Every other field is there for a
    proposer that writes rather than splices.
    """
    new_pivot = swap_end_word(pair_brief.pivot_text, pair_brief.pivot_word)
    new_anchor = swap_end_word(pair_brief.anchor_text, pair_brief.anchor_word)
    if new_pivot is None or new_anchor is None:
        return None
    return new_pivot, new_anchor


@dataclass
class PairBrief:
    """What a TIER-2 writer is asked to do: TWO coupled lines, at once.

    The tier-1 counterpart is `quality/revise.py`'s `Brief`, and this is
    deliberately NOT one. A `Brief` is per-LINE — one line, its findings,
    its candidate field — and a backtrack is a statement about a PAIR: the
    pivot cannot be fixed on its own, so the word of the line it has to
    match moves too. Two lines, two words, one group, and a reason the
    single-line move was already proven impossible.

    WHAT IS BEING ASKED, in the fields' own terms. The pivot (`pivot_line_no`
    / `pivot_text`) is in more than one mandated group and `joint_field` has
    already searched the COMPLETE pool and found nothing that answers all of
    them at once — that is `brief.joint_conflict`, and it is why this is
    tier 2 and not another tier-1 retry. So the loop proposes to move the
    ANCHOR (`anchor_line_no` / `anchor_text`), which is one of the words the
    pivot must answer: with the anchor on `anchor_word`, the pivot's
    conjunction is satisfiable again and `pivot_word` satisfies it. Both new
    lines must scan as writing; the two words are what makes the mandate
    hold.

    THE TWO `_word` FIELDS ARE THE PROPOSAL, NOT THE STATUS QUO.
    `pivot_word`/`anchor_word` are the words THIS attempt is asking for; the
    words currently at the ends of the two lines are the last tokens of
    `pivot_text`/`anchor_text` and are read the one way this project reads
    an end word (`lyric_harness.raw_final_token`). A proposer is free to
    return lines ending elsewhere — `verify()` re-derives the true finding
    set either way and rejects a pair that does not actually hold — but the
    two offered fields are what the loop's own search believes will.

    `pivot_offered`/`anchor_offered` are the COMPLETE fields those two words
    were drawn from, in `joint_field`/`modal_field`'s own ranking with the
    modal head already excluded (doctrine 9). The loop's search itself walks
    only the first `ReviseDeclaration.backtrack_width` of each — a bound on
    effort, not a claim about the field — so a writer holding the whole
    field can reach past where the mechanical search stops.

    `label`/`members` are the two-line group being backtracked;
    `brief` is the pivot's own `Brief` (its findings, `must_answer`,
    `joint_conflict` and `field_declaration` — the coordinates the empty
    intersection is a fact ABOUT, doctrine 58); `lines` is the whole draft
    as a snapshot tuple, so a proposer can see what the two lines sit
    between; `attempt` is the 0-based index of this proposal within this
    pivot's tier-2 search this round, counting every call including the ones
    a proposer refused, exactly as tier 1's `attempt` does; `reasons` is
    `verify()`'s rejection of the PREVIOUS attempt (`None` on the first),
    the feedback path tier 1 has had since it was written and this tier had
    not; `whole` is `inspect()`'s whole-draft findings — the half no `Brief`
    can carry and `verify()` grades this pair against anyway (see the module
    docstring).

    `reasons` and `whole` default the way `LoopResult`'s disclosure fields
    do, and for the same reason: a `PairBrief` built by hand in a test — a
    renderer's test, say — is still a legal one, and the defaults are what a
    first attempt on a clean-at-the-draft-level song actually gets.

    NO `__str__` HERE ON PURPOSE. Rendering a `PairBrief` for a human is
    another cell's file; two renderings of one object is what doctrine 1
    forbids, and a dataclass's own repr is enough to debug the loop with.
    """
    pivot_line_no: int
    pivot_text: str
    pivot_word: str
    pivot_offered: tuple
    anchor_line_no: int
    anchor_text: str
    anchor_word: str
    anchor_offered: tuple
    label: str
    members: tuple
    brief: object                # the pivot's own `quality.revise.Brief`
    lines: tuple                 # the whole draft, this attempt's snapshot
    attempt: int
    reasons: tuple = None        # the PREVIOUS attempt's rejection
    whole: tuple = ()            # `inspect()`'s whole-draft findings


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
               assume, profile, propose, whole=()):
    tried = 0
    reasons = None
    for attempt in range(rdecl.attempts_per_line):
        # `whole` LAST AND POSITIONAL, matching the declared contract
        # `propose(brief, lines, attempt, reasons=None, whole=())`. It is
        # what `verify()` two lines below will ALSO read (its diff covers
        # `whole`), so a proposal is now marked against a rubric its author
        # was shown. The stub ignores it; a writer would not.
        candidate = propose(b, lines, attempt, reasons, whole)
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
               assume, profile, propose_pair, whole=()):
    two_member = [(lab, mem, calls) for lab, mem, calls in b.must_answer
                  if len(mem) == 2]
    too_large = len(b.must_answer) - len(two_member)
    tried = 0
    # ATTEMPT AND REASONS ARE THE PIVOT'S, NOT THE GROUP'S. `attempt` counts
    # every call to `propose_pair` this pivot makes this round — including
    # the ones the proposer refused, exactly as tier 1's `attempt` counts a
    # refused candidate — and `reasons` carries the last rejection forward
    # across groups, because the writer is being asked about ONE pivot the
    # whole way down and a rejection is about the pair that was tried, not
    # about which group's turn it was.
    attempt = 0
    reasons = None
    for label, members, calls in two_member:
        # `anchor_current`/`pivot_current` are the words ALREADY THERE, and
        # they are here to be EXCLUDED from the two searches: re-proposing
        # the word that is already at the end of the line is not a revision.
        # The words being PROPOSED are `w` and `v` below, which is what
        # `PairBrief.pivot_word`/`.anchor_word` carry.
        anchor_line, anchor_current = calls[0]
        anchor_text = lines[anchor_line - 1]
        other_calls = [w for lab2, _m2, cl2 in b.must_answer if lab2 != label
                       for _, w in cl2]
        if not other_calls:
            continue
        pivot_current = raw_final_token(b.text) or ""
        p_offered, _p_forbidden = reviser.joint_field(
            other_calls, exclude=(pivot_current,))
        for w in p_offered[:rdecl.backtrack_width]:
            a_offered, _a_forbidden = reviser.modal_field(
                w, exclude=(anchor_current,))
            for v in a_offered[:rdecl.backtrack_width]:
                pair = propose_pair(PairBrief(
                    pivot_line_no=b.line_no, pivot_text=b.text,
                    pivot_word=w, pivot_offered=tuple(p_offered),
                    anchor_line_no=anchor_line, anchor_text=anchor_text,
                    anchor_word=v, anchor_offered=tuple(a_offered),
                    label=label, members=tuple(members),
                    brief=b, lines=tuple(lines), attempt=attempt,
                    reasons=reasons, whole=whole))
                attempt += 1
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
                reasons = tuple(res["reasons"])
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

    THE TWO WRITER CONTRACTS, both fixed and both stated here rather than
    left to be read off a call site:

        propose(brief, lines, attempt, reasons=None, whole=()) -> str | None
        propose_pair(pair_brief) -> (str, str) | None

    Neither is arity-compatible with what this module called before
    2026-08-14, on purpose and with an argument — see the module docstring,
    "THE FOUR-STRING ARITY IS GONE RATHER THAN KEPT BESIDE IT". A callable
    of the old shape raises `TypeError` at its first call, before any line
    of the draft has been touched.

    `whole` and `PairBrief.whole` are read ONCE PER ROUND, off
    `inspect()["whole"]` — the same key `_close` reads to fill
    `LoopResult.whole`, not a second derivation of it — and only on a round
    that has something flagged, since the success path returns above it.
    """
    propose = propose or default_propose
    propose_pair = propose_pair or default_propose_pair
    rdecl = reviser.rdecl
    # READ OFF THE DECLARATION, never a parameter of its own: a caller tunes
    # this the way it tunes `modal_exclusion`, and one coordinate has one
    # home (doctrine 1). `frozenset()` is the default, so every stop
    # condition below reads exactly as it did before this existed.
    pursue = frozenset(getattr(rdecl, "pursue", ()) or ())
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
        flagged = _open_lines(briefs, pursue)
        if not flagged:
            return _close(reviser, "success", lines, rounds, [], mandate,
                          blueprint, subdivision, assume, profile)

        # THE OTHER HALF OF `inspect()`, READ OFF ITS OWN KEY. `brief()` above
        # calls `inspect()` and keeps only `per_line`; the `whole` half —
        # `LEXICAL_MONOTONY`, `FUNCTION_WORD_HEAVY`, `HOOK_ABSENT` and every
        # finding `_function_findings`/`_meter_findings` file with empty
        # `locations` — is what `verify()` will grade every proposal below
        # against, and it was never shown to whoever writes them. It is READ
        # here, exactly as `_close` reads it for `LoopResult.whole`, rather
        # than recomputed from the floor and the function layer: doctrine 1,
        # two derivations of one fact drift. AFTER the success return, so a
        # round with nothing flagged pays nothing, and after `brief()`, so
        # the caches are warm for this exact draft — the same measured
        # argument `_close`'s own docstring makes for its extra `inspect()`.
        whole = tuple(reviser.inspect(
            lines, mandate, profile=profile, blueprint=blueprint,
            subdivision=subdivision, assume=assume)["whole"])

        attempts, fixed_this_round, touched = [], [], set()
        for b in flagged:
            if b.line_no in touched:
                continue
            if b.joint_conflict:
                attempt, lines = _try_tier2(
                    reviser, b, lines, mandate, rdecl, blueprint,
                    subdivision, assume, profile, propose_pair, whole)
            else:
                attempt, lines = _try_tier1(
                    reviser, b, lines, mandate, rdecl, blueprint,
                    subdivision, assume, profile, propose, whole)
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
    unresolved = _open_lines(briefs, pursue)
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
