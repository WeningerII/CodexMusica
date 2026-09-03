#!/usr/bin/env python3
"""The automated write-check-fix loop — quality/revise.py driven to
convergence instead of one round at a time by hand.

Run: python3 lyric_harness.py revise FILE MANDATE

WHAT THIS IS NOT. It does not write lyrics. "The model proposes, this
grades" (CLAUDE.md, first page) is not relaxed here — text generation is a
PLUGGABLE `propose`/`propose_group` callable the caller supplies. The default
shipped here (`swap_end_word`, `swap_at_slot`, `default_propose`,
`default_propose_group`) is
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
  ~~Bounded to groups of exactly two lines (the pivot and one ANCHOR) — a
  group of three or more would mean rewriting the whole group at once to
  keep its members mutually rhyming, which is a bigger and structurally
  different move than backtracking one step, and this tier does not attempt
  it. It says so in the result rather than pretending the search was wider
  than it was.~~
  **THE BOUND IS GONE — 2026-08-24, `MISSING.md` M-105. THE WHOLE GROUP IS
  REWRITTEN AT ONCE AND IT IS THE SAME MOVE, NOT A DIFFERENT ONE.** The
  struck sentence has two halves and only the first is true: rewriting the
  group at once IS what keeps its members mutually rhyming, and that turns
  out to be one more member on the same search rather than a structurally
  different one. MEASURED over 300 plans before the widening — 7,641
  declared groups, of which **3,177 (41.6%) have three or more members**,
  carrying **28,912 of the 33,376 mandated pairs (86.6%)**, every one of
  them refused by this tier with the refusal correctly disclosed. The bound
  was written when a group came from an RGS partition and was almost always
  a pair; it stopped being true when placement drawing (M-71/M-80) began
  emitting overlapping covers at a median of 26 groups a song, and nothing
  re-asked it. THE MUTUAL RHYME IS BY CONSTRUCTION rather than by a second
  predicate: members are assigned IN ORDER and each one's field is searched
  against the pivot's word PLUS every sibling already placed, so
  `joint_field`'s intersection is what holds the clique together and there
  is no separate check to drift from the grader (doctrine 1). The cost is
  `width * (k - 1)` searches and `width ** 2` proposals — linear in the
  group, so a group of nineteen is affordable — and the two-member case is
  byte-identical to the pair search it replaces.

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
**RENAMED WITH THE BOUND, 2026-08-24: `GroupBrief` and
`propose_group(group_brief) -> tuple[str, ...] | None`, one line per
member in `GroupBrief.members` order.** A pair is a group of two, so two
contracts for one move would be two statements of it (doctrine 1); the
paragraph above is kept unedited because it is the record of why the
argument object exists at all, and every word of it still applies
(doctrine 17).

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

  WHAT BREAKS, NAMED RATHER THAN HOPED ABOUT — AND A SECOND SET WAS ADDED
  2026-08-24 BY THE SAME RULE. The `propose_pair=` PARAMETER is gone, not
  deprecated: a caller still passing it gets `TypeError: revise_loop() got
  an unexpected keyword argument`, at the call itself, before a brief is
  built. A callable passed as `propose_group=` that reads `.anchor_line_no`
  / `.anchor_word` / `.anchor_offered` / `.anchor_calls` raises
  `AttributeError` at its first proposal — those four fields are now
  `GroupBrief.anchors[i].line_no` / `.word` / `.offered` / `.calls`, one per
  non-pivot member, because one anchor was the bound and not the shape. The
  set in this repo was enumerated and moved in the same commit:
  `default_propose_group`, `quality/propose.py`'s `ModelProposer`,
  `lyric_harness.py`'s `replay:`/`defer:` proposers, and the inline
  proposers in `test_loop.py`/`test_propose.py`/`test_verbs.py`.
  THE ORIGINAL 2026-08-14 SET, unchanged: any callable passed as
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
`GroupBrief.whole` close that: the rubric a proposal is marked against is
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

import collections
import os
import re
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (load_lyric_lines, line_tokens,
                           raw_final_token)
from quality import slots as _SL  # noqa: E402
from quality.revise import (ReviseDeclaration, Reviser,  # noqa: E402
                            draft_fingerprint)

__all__ = ["LineAttempt", "AnchorSlot", "GroupBrief", "RoundResult",
           "LoopResult",
          "revise_loop", "swap_end_word", "default_propose",
           "default_propose_group"]

#: The CRUDER reading `swap_end_word` uses to find a token's character span.
#: It must carry the SAME letter repertoire as `lyric_harness.line_tokens`, or
#: the two disagree on every word with a diacritic and this function refuses a
#: swap it could have made: with `line_tokens` widened to `LATIN_SCRIPT` on
#: 2026-08-21 and this left ASCII, `raw_final_token` returned `jaÿ` while this
#: found `ja`, they disagreed, and the reviser lost the ability to swap an end
#: word on any line Barnes actually wrote. Safe (it refuses rather than
#: corrupting) and wrong (doctrine 1).
_WORD_RE = re.compile(r"(?:[A-Za-zÀ-ɏḀ-ỿ]|['\-])+")


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


def swap_at_slot(text, slot, new_word):
    """-> `text` with the token the SLOT names replaced; `None` if it cannot
    be done without guessing.

    The generalisation of `swap_end_word` to the placement coordinate
    (`quality/slots.py`), and the reason it has to exist: `grade()` can flag a
    binding that is NOT at the line's end, and a loop whose only move is an
    end-word swap would answer that flag by rewriting the wrong word — the
    writer told to fix L3's opening and handed a rewrite of its ending. One
    question, two readings (doctrine 1), with the loop acting on the wrong
    one.

    THE DEFAULT SLOT IS `swap_end_word`, CALLED. Same discipline
    `slots.resolve` uses for `line_anchors`: the ordinary case is not
    reimplemented, so every existing run keeps its exact behaviour including
    the paren-stripping refusal that function documents.

    A slot naming no token in this line returns None — the loop's own "no
    move here" — rather than falling back to a token nearby.
    """
    if _SL.is_default(slot):
        return swap_end_word(text, new_word)
    slot = _SL.as_slot(slot)
    toks = list(_WORD_RE.finditer(text))
    if not toks:
        return None
    # THE TOKEN INDEX IS READ THROUGH `line_tokens`, the one definition of
    # "the words of a line" the rhyme path may use, and then matched back to
    # the RAW span so leading words, punctuation and whitespace stay
    # byte-identical — the property `swap_end_word` refuses rather than
    # loses. A disagreement between the two readings refuses here too.
    words = line_tokens(text)
    if [m.group(0) for m in toks] != list(words):
        return None
    locus = slot.rule.locus
    if locus == "line_final_token":
        idx = len(toks) - 1
    elif locus == "line_initial_token":
        idx = 0
    elif locus == "any_token":
        idx = _SL._declared_token(slot.rule)
    else:
        # `line` covers every token, so "replace the word" names no single
        # one. The loop has no move for it and says so instead of picking.
        return None
    if idx is None or not 0 <= idx < len(toks):
        return None
    hit = toks[idx]
    old = hit.group(0)
    if old.isupper():
        cased = new_word.upper()
    elif old[:1].isupper():
        cased = new_word.capitalize()
    else:
        cased = new_word.lower()
    return text[:hit.start()] + cased + text[hit.end():]


#: THE MANDATORY PURSUE SET — OWNER'S STANDING ORDER, 2026-08-17, AND IT IS
#: NOT A COORDINATE. `ReviseDeclaration.pursue` can ADD codes; nothing can
#: remove these. The order, verbatim in intent: enforcement must be
#: "mandatory, unskippable — the system passes through grading and revision
#: until nothing it can act on is left standing, no exceptions." The history
#: that earned it: `--pursue` was built as an opt-in flag, the operator ran
#: the loop without it, and a draft whose EVERY rhyme pair was the most
#: predictable answer in its own field was reported SUCCESS. An enforcement
#: that depends on the operator remembering a flag is prose one level up —
#: the exact failure doctrine 48 names — so the set lives here, in the loop,
#: below every invocation. Success while one of these stands is UNREPORTABLE:
#: the loop keeps asking until the finding clears, or it stops loudly with
#: the line named in `unresolved_pursued` and the CLI exits nonzero.
#:
#: `MODAL_RHYME` is a member because it is the per-LINE laziness finding
#: with a built candidate field (doctrine 9's own machinery). ~~the
#: whole-draft `PREDICTABLE_RHYME` fraction empties as a consequence of
#: clearing it and cannot be pursued per-line (it names no line)~~ —
#: SUPERSEDED 2026-08-23, owner ruling, and BOTH clauses were half-true.
#: The overlap is real but not containment: the modal head is a FREQUENCY
#: rank over the field and predictability is a probability over the pair,
#: so a pair can sit above 0.90 predictability with neither word in the
#: other's modal head — clearing every MODAL_RHYME does not empty the
#: fraction. And "it names no line" was a fact about the AGGREGATION, not
#: the measurement: `_predictability` returns (i, j, value) per pair and
#: `SlopFloor.check` threw the lines away. It keeps them now (the
#: CLICHE_PAIR/SHARED_SUFFIX pattern), the finding lands per-line through
#: `inspect()`'s existing locations routing, `PREDICTABLE_RHYME` has been in
#: `RHYME_FINDINGS` since 2026-08-15 so `brief()` hands those lines a
#: candidate field with the modal head marked FORBIDDEN — and the member
#: below makes the loop hold them open. `verify()` is untouched: pursuing
#: changes what the loop ASKS FOR, never what it rejects, and this finding
#: fires only where a measured profile declared its threshold, so a draft
#: inside the band is asked nothing.
MANDATORY_PURSUE = frozenset({"MODAL_RHYME", "HOMEOTELEUTON",
                              "PREDICTABLE_RHYME", "SHARED_SUFFIX"})
#: `SHARED_SUFFIX` JOINED 2026-08-23 (`MISSING.md` M-85, owner's ruling to
#: promote it out of disclosed-only). `gate_census` had it as a
#: PROMOTE_CANDIDATE on an argument that is doctrine 1's own: it names THE SAME
#: SONIC EVENT `HOMEOTELEUTON` names — its message says "(homeoteleuton)" in as
#: many words — and that one has been gated through this set since the ban went
#: unskippable, while this one was silent. One repository, two answers about
#: one event.
#:
#: PURSUED AND NOT PROMOTED TO A FLAG, and the tree already paid to learn why.
#: CLAUDE.md on `MODAL_RHYME`: *"re-typing MODAL_RHYME as a flag was wrong
#: twice over: doctrine 7 says a floor may not order the region it already
#: passed and a pair that RHYMES is inside that region, and verify() gates on
#: flags, so a promoted note would begin REJECTING revisions for introducing
#: one — the exact regression new_flags was split out to end."* A shared-suffix
#: pair rhymes, so it sits inside the permitted region on the identical
#: argument. A flag would also make `floor.py`'s own user-facing sentence
#: false — it tells a reader, twice, that *"RADIF_LICENSED and SHARED_SUFFIX
#: are notes at every length"* — and pursuing keeps that true.
#:
#: SO IT CHANGES WHAT THE LOOP ASKS FOR AND NEVER WHAT IT REJECTS: `verify()`
#: is untouched, and this is a GATE by `gate_census`'s own mechanism 2 (a line
#: held open on a pursued note, the CLI exiting nonzero if it stands). The
#: finding already carries its `locations`, so the loop has lines to hold.


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


def _open_by_rule(briefs, pursue=frozenset()):
    """-> (flagged, pursued), the two rules `_open_lines` unions, kept apart.

    `_open_lines` answers ONE question — has this loop still got work here —
    and that union is the right object for a stop condition. It is the wrong
    object for a REPORT: `LoopResult.unresolved`'s own field comment read
    "still carrying a flag finding at stop", which is FALSE for every line
    held open by a pursued NOTE, and `--pursue` exists precisely to hold lines
    open that carry no flag at all. So a `NO_PROGRESS` could not say which
    rule kept it going (`BACKLOG.md` §4.8, found by the defect-D audit; same
    shape as `forbidden_modal`, one module over).

    THE TWO LISTS OVERLAP AND MUST NEVER BE SUMMED (doctrine 79/91). A line
    carrying a `SCHEME_VIOLATION` flag AND a pursued `MODAL_RHYME` note is in
    both, so `len(flagged) + len(pursued)` counts it twice and is not
    `len(unresolved)`. The union stays the authority on how many lines are
    open; these two say WHY, per line.
    """
    flagged = [b for b in briefs
               if any(f.severity == "flag" for f in b.findings)]
    pursued = [b for b in briefs
               if any(f.severity != "flag" and f.code in pursue
                      for f in b.findings)]
    return flagged, pursued


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
    # AT THE BRIEF'S OWN BINDING SITE since 2026-08-23. `brief.slot` is None
    # for every line that binds at its end, and `swap_at_slot` calls
    # `swap_end_word` for those, so this is the same splice it has always
    # been on every draft written before the coordinate existed. Where a
    # slot IS declared, splicing the end word would answer a flag about the
    # line's HEAD by rewriting its ending — the stub proving the loop's
    # control flow would be proving it against the wrong word.
    return swap_at_slot(brief.text, brief.slot or brief.line_no,
                        brief.candidates[attempt])


def default_propose_group(group_brief):
    """-> one replacement line per member of the group, or `None`.

    Tier 2's stub, the same mechanism `default_propose` is for tier 1: one
    word spliced on each line of the group. The return is a tuple ordered by
    `group_brief.members` — the MANDATE'S own order, never pivot-first — so
    a proposer never has to work out which index the pivot occupies before it
    can answer, and the loop never has to state that order twice.

    AT EACH MEMBER'S OWN BINDING SLOT, which is a repair this stub needed
    from the day placement became a coordinate. `default_propose_pair`, the
    two-line predecessor, called `swap_end_word` on both lines
    unconditionally — so a group binding at a line's HEAD was answered by
    rewriting its ENDING, the identical defect `swap_at_slot` was written to
    close for tier 1 and which stayed live here because the two stubs were
    repaired a lot apart. It is invisible on any end-bound group, which is
    every group anyone wrote before `Mandate.loci` existed, and that is
    exactly why it survived.

    It reads only `members`, each member's text, its proposed word and its
    slot, and ignores every other field, so the SEARCH this stub drives is
    byte-identical to what it drove as a pair wherever the group has two
    end-bound members. Every other field is there for a proposer that WRITES
    rather than splices.
    """
    out = []
    for m in group_brief.members:
        prop = group_brief.proposal_for(m)
        if prop is None:
            return None
        text, word, slot = prop
        new = swap_at_slot(text, m if slot is None else slot, word)
        if new is None:
            return None
        out.append(new)
    return tuple(out)


@dataclass
class AnchorSlot:
    """ONE non-pivot member of the group a joint backtrack is rewriting.

    The pivot is asked for a word that answers its OTHER groups; every other
    member of the shared group then has to move to match it, and each of them
    is a line with obligations of its own. This carries what a writer needs
    about ONE of them and nothing about the others, so a group of nine is
    nine of these rather than one field holding nine of everything.

    `word` IS THE PROPOSAL. The status quo is `text`'s own final token, read
    the one way this project reads an end word — the same reading
    `GroupBrief` documents for the pivot, and the same one
    `quality/propose.py` printed backwards for every real run until
    2026-08-14.

    `offered` is the COMPLETE field `word` was drawn from, in
    `joint_field`'s own ranking with the modal head already excluded
    (doctrine 9). `calls` is every call word this member must STILL answer
    from groups OTHER than the one being rewritten — empty is the ordinary
    case, a member in one group only, and is not a disclosure gap. `slot` is
    where this member BINDS inside the group being rewritten, read from
    `Mandate.slot_of`, so a head-bound member is asked for its head.
    """
    line_no: int
    text: str
    word: str
    offered: tuple
    calls: tuple = ()
    slot: object = None


@dataclass
class GroupBrief:
    """What a TIER-2 writer is asked to do: a WHOLE rhyme group, at once.

    The tier-1 counterpart is `quality/revise.py`'s `Brief`, and this is
    deliberately NOT one. A `Brief` is per-LINE — one line, its findings, its
    candidate field — and a backtrack is a statement about a GROUP: the pivot
    cannot be fixed on its own, so every line it has to match moves with it.

    ~~`PairBrief`, and TWO coupled lines.~~ **SUPERSEDED 2026-08-24, AND THE
    PAIR WAS THE WHOLE LIMITATION (`MISSING.md` M-105).** This tier was
    bounded to groups of exactly two on the argument, written into its own
    module docstring, that "a group of three or more would mean rewriting the
    whole group at once to keep its members mutually rhyming, which is a
    bigger and structurally different move". The first half is true and the
    second is false: rewriting the whole group at once is what this does now,
    and it is the SAME move with one more member, not a different one.
    MEASURED over 300 plans before the widening — 7,641 declared groups, of
    which **3,177 (41.6%) have three or more members**, carrying **28,912 of
    the 33,376 mandated pairs (86.6%)**. Tier 2 refused every one of them and
    said so; the loop's only backtrack could not reach the population the
    planner spends most of its declarations on. The bound was written when a
    group came from an RGS partition and was mostly a pair, and it stopped
    being true when placement drawing (M-71/M-80) started emitting overlapping
    covers with a median of 26 groups a song.

    WHAT IS BEING ASKED, in the fields' own terms. The pivot
    (`pivot_line_no`/`pivot_text`) is in more than one mandated group and
    `joint_field` has already searched the COMPLETE pool and found nothing
    that answers all of them at once — that is `brief.joint_conflict`, and it
    is why this is tier 2 and not another tier-1 retry. So the loop proposes
    to move every OTHER member of one of those groups: with the anchors on
    their proposed words, the pivot's conjunction is satisfiable again and
    `pivot_word` satisfies it. Every line must scan as writing; the words are
    what makes the mandate hold.

    `pivot_word` IS THE PROPOSAL, NOT THE STATUS QUO — the word currently at
    the end of the pivot is `pivot_text`'s own last token. A proposer is free
    to return lines ending elsewhere; `verify()` re-derives the true finding
    set either way and rejects a group that does not actually hold.

    THE OFFERED FIELDS ARE ORDERED, AND SAYING SO IS THE HONEST HALF. The
    loop assembles its own proposal so that it is a CLIQUE BY CONSTRUCTION:
    the pivot's word answers the pivot's other groups, the first anchor's
    field is searched against that word, the second anchor's against both,
    and so on — `joint_field`'s intersection semantics doing the work at each
    step, which is why no post-hoc mutual-rhyme check is needed on what this
    loop itself puts forward. A WRITER reaching past the loop's own pick into
    `anchors[i].offered` is picking from a field computed against every
    member BEFORE i and none after, so two late members can be offered words
    that answer the pivot and not each other. That is disclosed rather than
    silently relied on, and it is not a hole: `verify()` grades the whole
    group and rejects such a pick with a named reason, which reaches the next
    attempt through `reasons`.

    `label`/`members` are the group being rewritten, `members` in the
    mandate's own order and INCLUDING the pivot — which is what
    `propose_group`'s return is ordered by. `brief` is the pivot's own
    `Brief` (its findings, `must_answer`, `joint_conflict` and
    `field_declaration` — the coordinates the empty intersection is a fact
    ABOUT, doctrine 58); `lines` is the whole draft as a snapshot tuple;
    `attempt` is the 0-based index of this proposal within this pivot's
    tier-2 search this round, counting every call including the ones a
    proposer refused, exactly as tier 1's does; `reasons` is `verify()`'s
    rejection of the PREVIOUS attempt (`None` on the first); `whole` is
    `inspect()`'s whole-draft findings — the half no `Brief` can carry and
    `verify()` grades this group against anyway.

    `reasons` and `whole` default the way `LoopResult`'s disclosure fields
    do, and for the same reason: a `GroupBrief` built by hand in a test is
    still a legal one, and the defaults are what a first attempt on a
    clean-at-the-draft-level song actually gets.

    NO `__str__` HERE ON PURPOSE. Rendering one for a human is another
    cell's file (`quality/propose.py`); two renderings of one object is what
    doctrine 1 forbids, and a dataclass's own repr is enough to debug the
    loop with.
    """
    pivot_line_no: int
    pivot_text: str
    pivot_word: str
    pivot_offered: tuple
    anchors: tuple               # AnchorSlot, one per NON-pivot member
    label: str
    members: tuple               # the whole group, pivot included
    brief: object                # the pivot's own `quality.revise.Brief`
    lines: tuple                 # the whole draft, this attempt's snapshot
    attempt: int
    reasons: tuple = None        # the PREVIOUS attempt's rejection
    whole: tuple = ()            # `inspect()`'s whole-draft findings
    #: WHERE THE PIVOT BINDS inside the group being rewritten, from
    #: `Mandate.slot_of`. `None` is the default slot — the end of the line —
    #: and is what every mandate written before `Mandate.loci` means.
    pivot_slot: object = None

    def proposal_for(self, line_no):
        """-> (text, proposed word, slot) for one member, or `None`.

        THE ONE PLACE THE PIVOT/ANCHOR SPLIT IS RESOLVED. A proposer answers
        in `members` order and does not care which index the pivot sits at;
        without this every caller would re-derive that split, and a stub that
        got it backwards would splice the pivot's word onto an anchor with no
        error anywhere (doctrine 1).
        """
        if line_no == self.pivot_line_no:
            return self.pivot_text, self.pivot_word, self.pivot_slot
        for a in self.anchors:
            if a.line_no == line_no:
                return a.text, a.word, a.slot
        return None


@dataclass
class LineAttempt:
    """One line's outcome for one round — accepted or not, and why."""
    line_no: int
    tier: int                    # 1 (word swap) or 2 (backtrack)
    accepted: bool
    tried: int                   # candidates or pairs actually attempted
    reason: str
    touched: tuple = ()          # line number(s) actually changed
    #: False when this tier put NOTHING to a proposer AND refused for no
    #: stated reason — tier 2 walked an empty pivot field, or every walk
    #: broke before a `GroupBrief` was built (`MISSING.md` M-185). A pinned
    #: or starved refusal is a stated reason and stays `asked=True`: the
    #: tier answered, and the answer was "no legal move". The loop reads
    #: this to fall through to tier 1 in the same round, so a line never
    #: reaches NO_PROGRESS without a proposer having been consulted.
    asked: bool = True


@dataclass
class RoundResult:
    round_no: int
    attempts: list = field(default_factory=list)     # [LineAttempt]
    fixed_lines: list = field(default_factory=list)   # sorted, this round
    #: Line numbers this round OPENED and never asked about, because an
    #: EARLIER fix in the same round closed them. Added 2026-08-16 with the
    #: per-line re-brief.
    #:
    #: NOT A `LineAttempt`, and that is the whole reason it is a second list:
    #: no attempt was made, so a record with `accepted=False` would be a
    #: failure that never happened, and `len(attempts)` would stop counting
    #: attempts (doctrine 79 — two kinds, never summed into one container).
    resolved_elsewhere: list = field(default_factory=list)


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
    #: [Brief] — the lines this loop still has work on at the stop point.
    #:
    #: ~~still carrying a flag finding at stop~~ — STRUCK 2026-08-16. That
    #: was FALSE for every line held open by a PURSUED NOTE, and `--pursue`
    #: exists precisely to hold open lines carrying no flag at all
    #: (`ReviseDeclaration.pursue`, and `MODAL_RHYME` is the case it was
    #: built for). One list, two rules, and the comment named one.
    #: `unresolved_flagged`/`unresolved_pursued` below say which; this stays
    #: the UNION, because that is the question a stop condition asks.
    unresolved: list
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
    #: WHY each unresolved line is open, as the two rules `unresolved` unions
    #: — a FLAG, or a NOTE whose code the caller DECLARED in
    #: `ReviseDeclaration.pursue`. Added 2026-08-16 with the strike above.
    #:
    #: THEY OVERLAP AND ARE NEVER SUMMED (doctrine 79/91): a line carrying a
    #: `SCHEME_VIOLATION` and a pursued `MODAL_RHYME` is in both, so
    #: `len(flagged) + len(pursued)` double-counts it and is not
    #: `len(unresolved)`. The union remains the count of open lines.
    #:
    #: `pursued` is EMPTY on every run that did not declare `pursue`, which
    #: is the default — so a reader who sees it non-empty knows a note is
    #: holding the loop open, which was previously unsayable.
    unresolved_flagged: list = field(default_factory=list)
    unresolved_pursued: list = field(default_factory=list)
    #: [Finding] — `inspect()`'s whole-draft half at the stop point. NOT
    #: reachable from `unresolved`, which holds `Brief`s and therefore only
    #: ever holds per-LINE findings.
    whole: list = field(default_factory=list)
    #: doctrine 79, three counts, never summed: a refusal (an end word the
    #: harness could not read) is not a judged pair that came back clean.
    pairs_mandated: int = 0
    pairs_judged: int = 0
    pairs_refused: int = 0
    #: WHICH DRAFT WAS HANDED IN — count and `draft_fingerprint` of the lines
    #: as `revise_loop` received them. This loop is the one caller that
    #: CHANGES the draft, so `lines` above identifies only what came OUT;
    #: without these two fields no reader of the result can say what went in,
    #: and a wrong same-length input produces a plausible result naming
    #: nothing (the collisions-69 misattribution — see
    #: `quality.revise.draft_fingerprint`). Defaults keep a hand-built
    #: `LoopResult` legal, and `disclosure()` prints the absence AS an
    #: absence rather than inventing an identity (doctrine 20).
    input_n: int = 0
    input_fingerprint: str = ""

    @property
    def whole_flags(self):
        """The whole-draft findings that are FLAGS — the ones `stop_reason`
        above was never able to see. ~~`LEXICAL_MONOTONY`, `FUNCTION_WORD_HEAVY`,
        `HOOK_ABSENT` are the only three codes that can appear here.~~ SIX
        since 2026-08-25 (repinned 2026-09-02, M-186's verification): those
        three, `HOOK_DOES_NOT_RECUR` and `TITLE_NOT_IN_HOOK` (M-84/M-86) and
        `STACKED_DRAFT` (M-110). The set is whatever `inspect()` emits at
        flag severity with no line; this list is a record, not a filter."""
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
        # THE DRAFT, BOTH ENDS, FIRST — the loop is the one caller that
        # transforms its input, so its result must identify what went in AND
        # what came out or neither figure below can be tied to a text. The
        # `(UNCHANGED)` marker is load-bearing: a loop that emitted its input
        # verbatim is a fact a reader wants at a glance, and comparing two
        # 12-hex strings by eye is exactly the step that gets skipped.
        fp_out = draft_fingerprint(self.lines)
        if self.input_fingerprint:
            out.append(f"  DRAFT: handed in {self.input_n} line(s), md5 "
                       f"{self.input_fingerprint} — emitted "
                       f"{len(self.lines)} line(s), md5 {fp_out}"
                       + (" (UNCHANGED)"
                          if fp_out == self.input_fingerprint else ""))
        else:
            # A hand-built result (tests do this; the dataclass docstring
            # licenses it) recorded no input. Say so — an absent identity
            # printed as nothing would read exactly like the pre-2026-08-16
            # reports this line exists to end.
            out.append(f"  DRAFT: emitted {len(self.lines)} line(s), md5 "
                       f"{fp_out} — input NOT RECORDED (result built "
                       f"without one; `revise_loop` always records it)")
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
            # NOT FOLDED INTO THE ATTEMPT LIST ABOVE. A line closed by an
            # earlier fix in the same round was never asked about, so it is
            # neither an accepted attempt nor a failed one, and printing it
            # as `[--]` would report a dead end that never happened.
            if r.resolved_elsewhere:
                out.append(
                    "    [==] "
                    + ", ".join(f"L{n}" for n in r.resolved_elsewhere)
                    + " — opened this round and NOT asked about: an earlier "
                      "fix in the same round closed them (re-briefed against "
                      "the current draft, not the round's opening snapshot)")
        if self.unresolved:
            # WHICH RULE HOLDS EACH LINE OPEN — 2026-08-16. This printed a
            # bare line list under a field whose own comment said "still
            # carrying a flag", and a line held open by a PURSUED NOTE
            # carries none. A reader could not tell a draft the loop failed
            # to repair from one the caller asked it to keep polishing.
            # `flag`/`note` per line, and NOT two totals: the two rules
            # OVERLAP, so summing them double-counts a line carrying both
            # (doctrine 79/91).
            _fl = {b.line_no for b in self.unresolved_flagged}
            _pu = {b.line_no for b in self.unresolved_pursued}

            def _why(n):
                bits = (["flag"] if n in _fl else []) + (["pursued note"]
                                                         if n in _pu else [])
                return "+".join(bits) or "?"
            out.append(f"  unresolved: "
                      + ", ".join(f"L{b.line_no} ({_why(b.line_no)})"
                                  for b in self.unresolved))
        out.extend(self.disclosure())
        return "\n".join(out)


def _close(reviser, stop_reason, lines, rounds, unresolved, mandate,
           blueprint, subdivision, assume, profile, input_n=0, input_fp="",
           pursue=frozenset()):
    """Build the `LoopResult`, and take the disclosure off `inspect()` on the
    way out. Called at all three stop conditions and nowhere else.

    `input_n`/`input_fp` are the ENTRY draft's identity, captured by
    `revise_loop` before its first round — by the time any stop condition
    fires, `lines` has been rebound round by round and the input is gone
    from every local. They default to the not-recorded state only so this
    function's contract matches `LoopResult`'s; `revise_loop` always passes
    them.

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
    # WHICH RULE HOLDS EACH OPEN LINE, derived HERE from the union this
    # function was handed rather than recomputed at three call sites — one
    # definition, so the report and the stop condition cannot disagree about
    # what "unresolved" contains (doctrine 1, the argument `_open_lines`
    # itself was written for).
    _flagged, _pursued = _open_by_rule(unresolved, pursue)
    return LoopResult(
        stop_reason, lines, rounds, unresolved,
        unresolved_flagged=_flagged,
        unresolved_pursued=_pursued,
        blueprint_declared=found["blueprint_declared"],
        subdivision_declared=subdivision is not None,
        profile=profile,
        whole=list(found["whole"]),
        pairs_mandated=g["pairs_mandated"],
        pairs_judged=g["pairs_judged"],
        pairs_refused=g["pairs_refused"],
        input_n=input_n,
        input_fingerprint=input_fp)


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
        # A RETURN IS A CLASS, AND REVISING ONE MEMBER OF IT IS REFUSING TO
        # REVISE (`MISSING.md` M-201, owner's ruling 2026-09-02, found by the
        # first clean end-to-end run). A `REQUIRE_RETURN` group says these
        # lines ARE the same line; moving one and not its mates breaks the
        # return, which rule 2 then rejects — so the loop was ASKING a
        # question whose every answer is refused, and spending the line's
        # whole attempt budget doing it. On seed 275 that was 10 of 19 lines.
        # The move is the one M-105 already made at tier 2 when it stopped
        # revising a PAIR and started revising the whole group: a set of
        # lines that must move together is revised together, in one proposal,
        # and every member is TARGETED so rule 2 admits what it asked for.
        targets = {b.line_no}
        for _lab, _members, _pairs in (b.must_answer or ()):
            if _lab not in (b.return_groups or ()):
                continue
            for _ln in _members:
                if 1 <= _ln <= len(after):
                    after[_ln - 1] = candidate
                    targets.add(_ln)
        res = reviser.verify(lines, after, mandate, targeted=set(targets),
                             profile=profile, blueprint=blueprint,
                             subdivision=subdivision, assume=assume)
        if res["accepted"]:
            return LineAttempt(b.line_no, 1, True, tried,
                               "; ".join(res["reasons"]),
                               tuple(sorted(targets))), after
        reasons = res["reasons"]
    detail = f"tried {tried} candidate(s), none accepted"
    if reasons:
        detail += f"; last rejection: {'; '.join(reasons)}"
    elif tried == 0:
        # ===========================================================
        # `tried == 0` IS THREE RULES, AND THIS SAID ONE — FIXED
        # 2026-08-16 (`BACKLOG.md` §4.8, found by the defect-D audit).
        # ===========================================================
        # It read `detail = "no candidates offered"` for every path
        # that reaches here, and only ONE of them is about the offer.
        # MEASURED: driving `revise_loop` with a proposer that returns
        # `None` printed "no candidates offered" on a line whose
        # `brief.candidates` held 24 WORDS. That is the harness taking
        # the blame for the writer's refusal, on the ordinary `revise`
        # output path via `LoopResult.__str__` — doctrine 79's shape
        # (a refusal is not a failure, and putting it in the other
        # layer's numerator charges the wrong one).
        #
        # The three are genuinely different things to tell a caller:
        # nothing to propose FROM, a proposer that declined, and a
        # budget that never let the question be asked. The third is
        # doctrine 20's own case — INCONCLUSIVE BY CONSTRUCTION, not a
        # dead end — and it is reachable, because `attempts_per_line`
        # is a declared coordinate with no floor on it.
        #
        # `_replay_proposer.disclosure` ALREADY keeps the first two
        # apart one layer up, so the repo stated this distinction and
        # then lost it per line.
        if rdecl.attempts_per_line < 1:
            detail = (f"NOT ASKED — attempts_per_line="
                      f"{rdecl.attempts_per_line}, so tier 1 never called "
                      f"the proposer for this line. This is inconclusive by "
                      f"construction, not a line the loop could not fix "
                      f"(doctrine 20)")
        elif not b.candidates and b.forbidden_modal:
            # THE FOURTH RULE, ADDED 2026-08-26 (`MISSING.md` M-139). The
            # branch below states a CAUSE — "a fact about the MANDATE and the
            # lexicon" — and it is FALSE whenever the field was non-empty and
            # the two-tier ban took all of it: the lexicon answered, and
            # doctrine 9's own exclusion is what emptied the offer. Measured
            # on three pivots, `joint_field` returning `offered=0` with
            # `forbidden` NON-empty every time — `['find','one']` at 2 of 2
            # banned, `['sorrow','pleasure']` at 1 of 1 — because
            # `modal_exclusion` is an ABSOLUTE count (6) applied to a field of
            # any size, so a field smaller than the cut is eaten whole.
            #
            # `joint_conflict` cannot cover this: it requires
            # `not b.forbidden_modal`, so the case where the ban ate the
            # field is precisely the case it excludes. Same family as
            # `BACKLOG.md` §4.8 — one message over several rules — with the
            # third rule never entering the enumeration.
            detail = (f"the candidate field was EMPTIED BY THE BAN, not by "
                      f"the lexicon — {len(b.forbidden_modal)} word(s) "
                      f"answered every call and all of them are forbidden "
                      f"(homoeoteleuton, or inside the top "
                      f"{rdecl.modal_exclusion} most predictable). This is a "
                      f"fact about `modal_exclusion` meeting a field smaller "
                      f"than itself, NOT about the mandate being "
                      f"unsatisfiable: {', '.join(b.forbidden_modal[:6])}")
        elif not b.candidates:
            detail = ("no candidate field was offered — the harness had "
                      "nothing for the proposer to choose from, so this is "
                      "a fact about the MANDATE and the lexicon, not about "
                      "the proposer")
        else:
            detail = (f"the PROPOSER declined at attempt 0 with "
                      f"{len(b.candidates)} candidate(s) offered — its "
                      f"refusal, not an empty field")
    return LineAttempt(b.line_no, 1, False, tried, detail, ()), lines


def _anchor_obligations(reviser, mandate, lines, anchor_line, pivot_line,
                        rewriting_label=None):
    """-> (other call words, return-group labels) for the ANCHOR.

    SLOT-AWARE SINCE 2026-09-02 (`MISSING.md` M-184's addendum, residual
    (a), found by the tier-A verification): a backtrack rewrites the word
    the anchor binds AT THE PLACE the rewritten group binds it — its end
    word under a bare group, its T2 word under `1.T2`. A group where the
    anchor binds a DIFFERENT word imposes nothing on the rewrite and is
    skipped; and a mate's call word is the word the mate binds in THAT
    group, read at the mate's own slot, never its end word by default.
    `rewriting_label` names the group being rewritten; without it (the
    pre-2026-09-02 call shape) every group containing the pivot is
    dropped and the anchor's rewrite place is its end.

    The anchor of a tier-2 backtrack is a line like any other: it can sit in
    groups of its own, and it can sit in a declared verbatim return. Neither
    was ever asked — `_try_tier2` derived both of its searches from the
    PIVOT's `Brief`, which is written about the pivot — so an anchor that is
    itself a pivot was searched as though the shared group were its only
    obligation (defect F).

    THE GROUP CONTAINING THE PIVOT IS DROPPED, and it is the only one: that
    group is what the backtrack is rewriting, and its call word is the pivot's
    proposed word, which the caller supplies. Everything else the anchor is in
    still holds after the rewrite and every word in it is a call the anchor's
    new end word has to answer too.

    ASKED OF THE MANDATE. `Mandate.partners`/`requirement` is the one object
    that holds both the grouping and the requirement kind; deriving either
    from the words would be a second statement of it (doctrine 1).
    """
    # THE SPEC MAY STILL BE A SPEC. `revise_loop` takes whatever mandate
    # spelling its caller used and hands it down unresolved — `verify()`
    # resolves its own — so this asks `Reviser.mandate` rather than assuming
    # an object, which is the one place in this module that needs the built
    # `Mandate` before `verify()` gets there.
    if not hasattr(mandate, "partners"):
        mandate = reviser.mandate(list(lines), mandate)
    k_rw = None
    if rewriting_label is not None and rewriting_label in mandate.labels:
        k_rw = mandate.labels.index(rewriting_label)
    # THE WORD THE REWRITE MOVES: the anchor's word at its slot in the group
    # being rewritten (the end word when no group is named).
    moved = reviser._incumbent(
        lines, anchor_line, _slot_for(mandate, k_rw, anchor_line))
    calls, rets = [], []
    for k, mates in mandate.partners(anchor_line):
        if k_rw is not None:
            if k == k_rw:
                continue
        elif pivot_line in mandate.groups[k]:
            continue
        if any(getattr(mandate.requirement(anchor_line, x), "name", "")
               == "REQUIRE_RETURN" for x in mates):
            rets.append(mandate.labels[k])
            continue
        # A GROUP THAT BINDS THE ANCHOR AT ANOTHER WORD HOLDS AFTER THE
        # REWRITE UNTOUCHED, so it is no call on the new word.
        here = reviser._incumbent(
            lines, anchor_line, _slot_for(mandate, k, anchor_line))
        if here != moved:
            continue
        for x in mates:
            w = reviser._incumbent(lines, x, _slot_for(mandate, k, x))
            if w:
                calls.append(w)
    return calls, sorted(rets)


def _slot_for(mandate, group_index, line):
    """-> where `line` binds inside one group, or `None` for the default.

    ASKED OF THE MANDATE (`Mandate.slot_of`), never re-derived: that method
    already resolves an undeclared group, an undeclared member and a `None`
    entry to the same default, and a second copy of that resolution is how a
    loop starts rewriting a different word from the one the grader scored
    (doctrine 1). A group this mandate cannot name answers `None`, which is
    the default slot and is what every mandate written before `Mandate.loci`
    existed means.
    """
    if group_index is None:
        return None
    try:
        return mandate.slot_of(group_index, line)
    except Exception:
        return None


def _try_tier2(reviser, b, lines, mandate, rdecl, blueprint, subdivision,
               assume, profile, propose_group, whole=()):
    """THE JOINT BACKTRACK — rewrite a WHOLE mandated group at once.

    ~~Bounded to groups of exactly two.~~ **WIDENED 2026-08-24
    (`MISSING.md` M-105).** See `GroupBrief` for the measurement that closed
    the argument; the short form is that 41.6% of the groups this planner
    draws have three or more members and this tier refused all of them.

    THE SEARCH, and it is the two-line one with the members generalised. The
    pivot is asked for a word `w` answering its OTHER groups; then every
    remaining member of the shared group is searched IN ORDER, each against
    `w` PLUS every word already chosen PLUS its own outside obligations. That
    ordering is what makes the loop's own proposal a CLIQUE BY CONSTRUCTION
    rather than a set of words that each rhyme with the pivot and not with
    each other — `joint_field`'s intersection doing the work at every step,
    so no separate mutual-rhyme check exists to drift from the grader's own
    predicate (doctrine 1).

    THE COST IS LINEAR IN THE GROUP AND QUADRATIC IN THE WIDTH, which is why
    a group of nineteen is affordable at all. `backtrack_width` pivot words
    are walked; under each, the first k-2 members take their field's own top
    candidate and only the LAST is walked over `backtrack_width` — so the
    call count is `width * (k - 1)` searches plus `width * width` proposals,
    not `width ** k`. At k=2 that is `width` searches and `width ** 2`
    proposals, which is what this tier has always done: **the two-member case
    is byte-identical to the pair search it replaces**, and
    `test_loop.py` pins that rather than asserting it.

    A WRITER REACHING PAST THE LOOP'S OWN PICK is picking from a field
    computed against every member before it and none after, so a late pick
    can answer the pivot and not a sibling. `GroupBrief`'s docstring
    discloses that; `verify()` grades the whole group and rejects it with a
    named reason, which reaches the next attempt through `reasons`. An offer
    that is never put through the check that judges the answer cannot report
    its own impossibility (doctrine 48, defect F).

    FOUR COUNTS, NEVER SUMMED (doctrine 79): `tried` — groups actually put to
    a proposer; `pinned` — groups REFUSED unsearched because a declared
    verbatim return fixes one of their lines; `starved` — groups where every
    walked pivot word left some member with an EMPTY field, which is a fact
    about the mandate's conjunction and not about a search that came back
    short; and the group-size census, which exists because the sentence this
    tier used to print — "3+ members and were NOT attempted" — was the
    disclosure of a refusal, and a reader owed the news that it now searches
    them is owed it in the same place (doctrine 20).
    """
    groups = [(lab, tuple(mem), cl) for lab, mem, cl in b.must_answer]
    # THE GROUPS AT THE PIVOT'S OWN PLACE (M-184, 2026-09-01). A pivot bound
    # at its end in one group and at its T2 word in another is a pivot at
    # NEITHER place: each place's groups conflict only among themselves.
    # Walking every group and intersecting the others' calls across places
    # is how a stub run rewrote L1 to 'like' so L3 could end on 'cut' — a
    # consonance conjunction over two families the grader never asked to
    # meet — when L3 needed one door-rhyme at one place. Absent on a brief
    # that predates the field (a hand-built stand-in), every group is walked
    # as before.
    _at_place = tuple(getattr(b, "slot_groups", ()) or ())
    if _at_place:
        groups = [g for g in groups if g[0] in _at_place]
    tried = 0
    # ATTEMPT AND REASONS ARE THE PIVOT'S, NOT THE GROUP'S. `attempt` counts
    # every call to `propose_group` this pivot makes this round — including
    # the ones the proposer refused, exactly as tier 1's `attempt` counts a
    # refused candidate — and `reasons` carries the last rejection forward
    # across groups, because the writer is being asked about ONE pivot the
    # whole way down and a rejection is about the group that was tried, not
    # about which group's turn it was.
    attempt = 0
    reasons = None
    pinned = []
    starved = []
    # THE SKIPS THAT USED TO BE SILENT (`MISSING.md` M-205). Each is its own
    # list and none is summed into another (doctrine 79): "the pivot has no
    # obligation outside this group", "no member of this group can move" and
    # "the pivot's field came back empty" are three different facts, and the
    # first two used to leave `_try_tier2` having recorded NOTHING — the
    # attempt came back `asked=False` with a reason that said the tier walked
    # nothing, which is a description of the symptom and not of the cause.
    unbound = []
    memberless = []
    # THE SPEC MAY STILL BE A SPEC — `revise_loop` hands its caller's mandate
    # down unresolved, and `slot_of`/`partners` need the built object.
    if not hasattr(mandate, "partners"):
        mandate = reviser.mandate(list(lines), mandate)
    labels = list(getattr(mandate, "labels", ()))
    for label, members, calls in groups:
        gi = labels.index(label) if label in labels else None
        # (a) A RETURN PINS A LINE. If this group IS a declared verbatim
        # return, or another of the pivot's groups is, the only legal end
        # word is the one already there — which `exclude` removes — so every
        # word the search could offer breaks the return. Refused with a
        # reason rather than searched: the writer is owed "no legal answer
        # exists", not a field of words each of which is illegal.
        rets = set(getattr(b, "return_groups", ()) or ())
        if label in rets:
            pinned.append(
                f"group {label} {list(members)} is itself a RETURN — its "
                f"lines must be identical, so no member of it is a line this "
                f"tier can move")
            continue
        pivot_ret = sorted(rets - {label})
        if pivot_ret:
            pinned.append(
                f"group {label} {list(members)}: L{b.line_no} is PINNED by "
                f"return group(s) {', '.join(pivot_ret)} — a verbatim return "
                f"fixes the whole line, so no word this tier could offer it "
                f"is legal")
            continue
        other_calls = [w for lab2, _m2, cl2 in groups if lab2 != label
                       for _, w in cl2]
        # AN UNCONSTRAINED PIVOT IS NOT AN UNANSWERABLE ONE (`MISSING.md`
        # M-205). This read `if not other_calls: continue`, and `other_calls`
        # is the calls of the pivot's OTHER groups at this place — so a pivot
        # in exactly ONE group here, which is the ordinary case and EVERY
        # couplet, was skipped without a word being put to anybody. The
        # premise was right and the conclusion inverted: no outside call
        # means the pivot may take ANY word, so this is the case with the
        # MOST freedom, not the least. It is asked below with an empty
        # offered field that says so.
        pivot_free = not other_calls
        if pivot_free:
            unbound.append(
                f"group {label} {list(members)}: L{b.line_no} has no "
                f"obligation outside this group, so no field ranks its "
                f"candidates — every word is legal for it and the members "
                f"follow whatever it takes")
        # (b) EVERY OTHER MEMBER HAS ITS OWN GROUPS, and they are asked of
        # the MANDATE before any search runs (defect F, generalised from the
        # single anchor: a member that is itself a pivot was searched as
        # though the shared group were its only obligation).
        others, pin_hit = [], None
        for m_line, m_current in calls:
            m_other, m_rets = _anchor_obligations(
                reviser, mandate, lines, m_line, b.line_no,
                rewriting_label=label)
            if m_rets:
                pin_hit = (m_line, m_rets)
                break
            others.append((m_line, m_current, tuple(m_other)))
        if pin_hit is not None:
            m_line, m_rets = pin_hit
            pinned.append(
                f"group {label} {list(members)}: L{m_line} is PINNED by "
                f"return group(s) {', '.join(m_rets)} — that member cannot "
                f"move either, so this group has no joint rewrite available")
            continue
        if not others:
            # NO MEMBER OF THIS GROUP CAN MOVE, so there is no group to
            # rewrite and this tier has no move — which is a REASON and was
            # a silent `continue` (`MISSING.md` M-205). Unlike the two skips
            # around it this one is correctly unasked: a joint backtrack over
            # a group of one is tier 1.
            memberless.append(
                f"group {label} {list(members)}: no member of it besides "
                f"L{b.line_no} carries a readable bound word, so there is no "
                f"joint rewrite to put to anybody")
            continue
        # THE PIVOT'S INCUMBENT AT ITS OWN PLACE, off the brief (M-184):
        # `raw_final_token` is the end word, which is the wrong word for a
        # pivot briefed at T2. The brief's field is empty only when no field
        # was computed, and then the end word is what it always was.
        pivot_current = (getattr(b, "forbidden_incumbent", "")
                         or raw_final_token(b.text) or "")
        p_offered, _p_forbidden = (
            reviser.joint_field(other_calls, exclude=(pivot_current,))
            if other_calls else ([], []))
        walked = p_offered[:rdecl.backtrack_width]
        # AN EMPTY WALK IS STILL A QUESTION (`MISSING.md` M-205). `walked`
        # is empty on two populations: the pivot is FREE (no outside call to
        # rank against) or its conjunction came back EMPTY. In both the
        # `for w in walked` loop below never runs, nothing reaches a
        # proposer, and the `starved` guard is `if walked and ...` — so the
        # group produced no proposal AND no reason, which is the silence
        # this repairs. The group is real, its members can move, and a
        # WRITER can answer it: it is put ONCE with the pivot field declared
        # empty and WHY, and each member carrying its own outside field.
        # Nothing is invented — an empty offer is an honest offer (doctrine
        # 20), and `verify()` still judges whatever comes back.
        if not walked:
            _anchors = []
            for m_line, m_current, m_other in others:
                _mf, _ = (reviser.joint_field(list(m_other),
                                              exclude=(m_current,))
                          if m_other else ([], []))
                _anchors.append(AnchorSlot(
                    line_no=m_line, text=lines[m_line - 1], word="",
                    offered=tuple(_mf), calls=tuple(m_other),
                    slot=_slot_for(mandate, gi, m_line)))
            got = propose_group(GroupBrief(
                pivot_line_no=b.line_no, pivot_text=b.text,
                pivot_word="", pivot_offered=(),
                pivot_slot=_slot_for(mandate, gi, b.line_no),
                anchors=tuple(_anchors), label=label, members=members,
                brief=b, lines=tuple(lines), attempt=attempt,
                reasons=reasons, whole=whole))
            attempt += 1
            if got is not None:
                tried += 1
                got = tuple(got)
                if len(got) != len(members):
                    reasons = (f"proposer returned {len(got)} line(s) for "
                               f"group {label}, which has {len(members)} "
                               f"member(s) — the return is ordered by "
                               f"`GroupBrief.members`, one line each",)
                else:
                    after = list(lines)
                    for m_line, text in zip(members, got):
                        after[m_line - 1] = text
                    res = reviser.verify(
                        lines, after, mandate, targeted=set(members),
                        profile=profile, blueprint=blueprint,
                        subdivision=subdivision, assume=assume)
                    if res["accepted"]:
                        _why = ("the pivot is unconstrained" if pivot_free
                                else "its conjunction came back empty")
                        return LineAttempt(
                            b.line_no, 2, True, tried,
                            f"joint backtrack over group {label} "
                            f"{list(members)} with NO ranked pivot field "
                            f"({_why}): " + "; ".join(res["reasons"]),
                            tuple(members)), after
                    reasons = tuple(res["reasons"])
            continue
        empty_member = collections.Counter()
        for w in walked:
            # THE CHAIN. `chosen` grows as members are assigned, and each
            # member's field is searched against ALL of it — so member i
            # answers the pivot AND every sibling already placed, which is
            # what keeps the group mutually rhyming without a second
            # predicate. The LAST member is the one walked, so the k=2 case
            # walks its single anchor exactly as the pair search did.
            chosen = [w]
            assigned, broke = [], None
            for idx, (m_line, m_current, m_other) in enumerate(others):
                field, _mf = reviser.joint_field(
                    chosen + list(m_other), exclude=(m_current,))
                if not field:
                    # THIS MEMBER'S OWN CONJUNCTION CAME BACK EMPTY, a
                    # sentence only the folded field can form — the
                    # unfolded search was never empty here and offered
                    # words that all broke a group nobody had mentioned.
                    # Counted PER MEMBER, so the dead end below can name
                    # WHICH line the conjunction failed at.
                    broke = m_line
                    break
                assigned.append((m_line, m_current, m_other, field))
                if idx < len(others) - 1:
                    chosen.append(field[0])
            if broke is not None:
                empty_member[broke] += 1
                continue
            last_field = assigned[-1][3]
            for v in last_field[:rdecl.backtrack_width]:
                anchors = []
                for j, (m_line, _m_cur, m_calls, m_field) in enumerate(
                        assigned):
                    word = v if j == len(assigned) - 1 else chosen[j + 1]
                    anchors.append(AnchorSlot(
                        line_no=m_line, text=lines[m_line - 1], word=word,
                        offered=tuple(m_field), calls=tuple(m_calls),
                        slot=_slot_for(mandate, gi, m_line)))
                got = propose_group(GroupBrief(
                    pivot_line_no=b.line_no, pivot_text=b.text,
                    pivot_word=w, pivot_offered=tuple(p_offered),
                    pivot_slot=_slot_for(mandate, gi, b.line_no),
                    anchors=tuple(anchors), label=label, members=members,
                    brief=b, lines=tuple(lines), attempt=attempt,
                    reasons=reasons, whole=whole))
                attempt += 1
                if got is None:
                    continue
                tried += 1
                got = tuple(got)
                if len(got) != len(members):
                    # A CONTRACT BREACH IS A REJECTION WITH A REASON, not a
                    # crash and not a silent skip: the proposer answered a
                    # different question and the next attempt is told so
                    # through the channel every other rejection uses.
                    reasons = (f"proposer returned {len(got)} line(s) for "
                               f"group {label}, which has {len(members)} "
                               f"member(s) — the return is ordered by "
                               f"`GroupBrief.members`, one line each",)
                    continue
                after = list(lines)
                for m_line, text in zip(members, got):
                    after[m_line - 1] = text
                res = reviser.verify(
                    lines, after, mandate,
                    targeted=set(members), profile=profile,
                    blueprint=blueprint, subdivision=subdivision,
                    assume=assume)
                if res["accepted"]:
                    moved = ", ".join(f"L{a.line_no} -> {a.word!r}"
                                      for a in anchors)
                    return LineAttempt(
                        b.line_no, 2, True, tried,
                        f"joint backtrack over group {label} "
                        f"{list(members)} ({len(members)} members): {moved} "
                        f"so L{b.line_no} could take {w!r}; "
                        + "; ".join(res["reasons"]),
                        tuple(members)), after
                reasons = tuple(res["reasons"])
        if walked and sum(empty_member.values()) == len(walked):
            where = ", ".join(f"L{ln} x{n}" for ln, n
                              in sorted(empty_member.items()))
            # NAMING THE MEMBERS IS THE POINT, not decoration: this sentence
            # exists to say WHICH search failed, and "a member" says only
            # that one did. The pair version named its single anchor; the
            # joint version names every member the conjunction died at, with
            # the count of pivot words it died under beside each.
            names = " / ".join(f"L{ln}" for ln in sorted(empty_member))
            starved.append(
                f"group {label} {list(members)}: every one of the "
                f"{len(walked)} pivot word(s) walked left a member with an "
                f"EMPTY field ({where}) — nothing answers the new pivot "
                f"word AND {names}'s own group(s) at once, so the "
                f"conjunction is unsatisfiable at that member and this is "
                f"not a search that came back short")
    # PINNED IS ITS OWN COUNT AND IS NEVER FOLDED INTO `tried` (doctrine 79):
    # a group the loop REFUSED to search because no legal answer exists is
    # not a group it searched and failed. Reporting them together would say
    # the loop looked and came back empty, which is a claim about the
    # lexicon rather than about the mandate.
    if not groups:
        detail = ("this pivot is in no mandated group, so there is no group "
                  "to rewrite")
    elif pinned and len(pinned) == len(groups):
        # EVERY group refused, so "none accepted" would be the wrong lead: no
        # group was ever put to a proposer, and the outcome is a fact about
        # the MANDATE (doctrine 20 — a refusal is not a failed search).
        detail = (f"NOT ATTEMPTED — all {len(groups)} group(s) are pinned by "
                  f"a declared verbatim return, so this tier has no legal "
                  f"move and the MANDATE is what needs revising: "
                  + "; ".join(pinned))
    else:
        detail = (f"tried {tried} joint rewrite(s) across "
                  f"{len(groups) - len(pinned)} group(s), none accepted")
        if pinned:
            detail += (f"; a further {len(pinned)} group(s) NOT SEARCHED "
                       f"because a declared verbatim return pins a line: "
                       + "; ".join(pinned))
    # WALKED NOTHING, FOR NO STATED REASON (M-185): no group was pinned, no
    # member starved, and still no `GroupBrief` reached a proposer — the
    # pivot's own field over the other groups' calls was empty, or every
    # walk broke at a member before a proposal could be built. That is not
    # a search that came back short and not a refusal with a reason; it is
    # a line whose turn this tier consumed without asking anyone. Said so,
    # and `asked=False` is what the loop falls through on.
    # `attempt`, not `tried`: a proposer that DECLINED every group brief was
    # consulted, and its refusal is its own answer (tier 1's "the PROPOSER
    # declined" rule); only a tier that built no brief at all was silent.
    asked = (bool(attempt) or bool(starved)
             or (pinned and len(pinned) == len(groups))
             or not groups
             # M-205: a group with no movable member is a STATED refusal,
             # not a turn consumed in silence. `attempt` cannot cover it —
             # nothing was put to a proposer and nothing should have been —
             # so it is named here or the M-185 fall-through fires on a
             # line this tier answered correctly.
             or (memberless and len(memberless) + len(pinned) == len(groups)))
    if not asked:
        detail = (f"NOT ASKED — tier 2 walked 0 pivot word(s) and built no "
                  f"joint proposal ({detail}); no group pinned, no member "
                  f"starved, so this is inconclusive by construction "
                  f"(doctrine 20), not a dead end")
    # STARVED IS A THIRD COUNT, and it is the one each member's own groups
    # made sayable: before they were folded in, the search came back full of
    # words that all broke a group nobody had mentioned, so this dead end was
    # reported as a proposer that could not find anything.
    if starved:
        detail += (f"; {len(starved)} group(s) reached an EMPTY MEMBER "
                   f"field — the conjunction is unsatisfiable at that "
                   f"member, not a search that came back short: "
                   + "; ".join(starved))
    # THE TWO SKIPS THAT USED TO SAY NOTHING (`MISSING.md` M-205). Their own
    # counts, never folded into `tried`, `pinned` or `starved` (doctrine 79),
    # because they are different facts: `unbound` groups WERE asked — with an
    # empty field, because no outside call ranks the pivot — and `memberless`
    # ones correctly were not, there being no second line to move.
    if unbound:
        detail += (f"; {len(unbound)} group(s) have an UNCONSTRAINED pivot "
                   f"and were asked with an empty offered field rather than "
                   f"skipped — no ranking exists, which is freedom and not "
                   f"a dead end: " + "; ".join(unbound))
    if memberless:
        detail += (f"; {len(memberless)} group(s) have NO MOVABLE MEMBER "
                   f"besides the pivot, so a joint rewrite does not exist "
                   f"for them and tier 1 is the whole move: "
                   + "; ".join(memberless))
    # THE SIZE CENSUS, and it is here because the sentence it replaces was a
    # REFUSAL. This tier used to print "N group(s) have 3+ members and were
    # NOT attempted"; a reader owed the news that they are searched now is
    # owed it in the same place, and a silent widening reads exactly like a
    # tier that never had the bound (doctrine 20).
    big = [m for _l, m, _c in groups if len(m) > 2]
    if big:
        detail += (f"; {len(big)} of {len(groups)} group(s) have 3+ members "
                   f"(largest {max(len(m) for m in big)}) and WERE searched "
                   f"jointly — the whole group is rewritten at once")
    return LineAttempt(b.line_no, 2, False, tried, detail, (),
                       asked=bool(asked)), lines


def revise_loop(reviser, lines, mandate, blueprint=None, subdivision=None,
                assume=None, profile=None, propose=None, propose_group=None):
    """Drive `reviser.brief`/`verify` to convergence. -> `LoopResult`.

    `reviser` is a caller-supplied `Reviser` (its `.rdecl` supplies
    `max_rounds`/`attempts_per_line`/`backtrack_width`) so a caller can tune
    the loop the same way it already tunes `modal_exclusion` or
    `field_band` — one declaration, not a second set of knobs.

    ~~ONE `brief()` PER ROUND, not one per line fixed. Fixing line X inside a
    round can change what a LATER flagged line Y in the SAME round must
    satisfy (if X is one of Y's call words), so Y's candidate list from this
    round's brief can go stale mid-round. This is deliberately not chased:
    `verify()` always re-derives the true finding set for the CURRENT
    `lines` before accepting anything, so a stale candidate is simply
    rejected rather than wrongly accepted — correctness does not depend on
    re-briefing every line, and Y is re-briefed fresh at the top of the next
    round regardless.~~
    **STRUCK 2026-08-16 — DEFECT B of the rung-1 coverage experiment. EVERY
    WORD OF THAT ARGUMENT IS STILL TRUE AND IT ANSWERS A DIFFERENT QUESTION.**
    It is about ACCEPTANCE: nothing wrong is accepted, which is what it
    claims. A brief is GUIDANCE, and the argument says nothing about that —
    so Y was handed a `must rhyme with`, a candidate field and a
    `SCHEME_VIOLATION` evidence string computed against a word no longer in
    the draft, and on the blind re-run the flag it was briefed to fix had
    ALREADY BEEN REPAIRED by X's own answer, with 24 offered words every one
    of which would have broken the rhyme that now held.
    THE ECONOMICS CHANGED UNDER IT: the argument was written when the only
    proposer was the free mechanical stub, for which a rejected attempt costs
    nothing. `--propose=defer:` made the proposer a person or a model.
    MEASURED on the rung-1 draft — a writer who followed the stale field
    exactly burned all three attempts twice over and the loop returned
    NO_PROGRESS with the line unresolved, while the correct move was to
    ignore the field the harness had just offered. A stale field is cheap to
    reject and expensive to follow.
    A LINE IS NOW RE-BRIEFED IF THE DRAFT MOVED SINCE THE ROUND OPENED, and
    a line an earlier fix CLOSED is not asked about at all
    (`RoundResult.resolved_elsewhere`). COST, MEASURED on the 41-line
    `mandate_song` fixture over two runs each: **30.3–30.8s before, 31.2–33.7s
    after — +0.9 to +2.9s, +3% to +9%** — and the OUTCOME is byte-identical on
    both runs (`no_progress`, 2 rounds, 5 lines fixed, final draft md5
    `ef78e300f1a9`), which is the old argument holding exactly as it always
    did. Nothing is re-derived until an accepted proposal has actually moved
    the draft, so a round that fixes nothing pays zero.
    RAISES `NoMandate` exactly when `brief()`/`verify()`
    already do: a loop with nothing to check against is not this module's
    problem to paper over.

    `blueprint`/`subdivision`/`assume`/`profile` are the OPT-IN coordinates
    and every one of them is restated in the returned `LoopResult` (see
    `LoopResult.disclosure`), so which layers this run asked travels WITH the
    result instead of living only on this call line.

    THE TWO WRITER CONTRACTS, both fixed and both stated here rather than
    left to be read off a call site:

        propose(brief, lines, attempt, reasons=None, whole=()) -> str | None
        propose_group(group_brief) -> tuple[str, ...] | None

    Neither is arity-compatible with what this module called before
    2026-08-14, on purpose and with an argument — see the module docstring,
    "THE FOUR-STRING ARITY IS GONE RATHER THAN KEPT BESIDE IT". A callable
    of the old shape raises `TypeError` at its first call, before any line
    of the draft has been touched.

    `whole` and `GroupBrief.whole` are read ONCE PER ROUND, off
    `inspect()["whole"]` — the same key `_close` reads to fill
    `LoopResult.whole`, not a second derivation of it — and only on a round
    that has something flagged, since the success path returns above it.
    """
    # WAS A GROUP WRITER DECLARED? (`MISSING.md` M-205.) `propose_group`
    # falls back to the stock stub below, and that fallback is fine on the
    # `joint_conflict` path, which has always run with whatever this line
    # leaves. It is NOT fine for the new escalation: a caller who passed
    # only `propose=` declared a LINE writer, and reaching a group writer it
    # never named is substituting an undeclared instrument (doctrine 1).
    # Caught by `quality/test_loop.py` §2 — a fixture whose line proposer
    # refuses everything had its draft REWRITTEN by the stock group stub,
    # so "a proposer that refuses everything" stopped being true of the run.
    _group_declared = propose_group is not None
    propose = propose or default_propose
    propose_group = propose_group or default_propose_group
    rdecl = reviser.rdecl
    # READ OFF THE DECLARATION, never a parameter of its own: a caller tunes
    # this the way it tunes `modal_exclusion`, and one coordinate has one
    # home (doctrine 1). `frozenset()` is the default, so every stop
    # condition below reads exactly as it did before this existed.
    # THE UNION IS THE ENFORCEMENT. `rdecl.pursue` adds; nothing subtracts —
    # an empty declaration still pursues MANDATORY_PURSUE, which is what
    # makes the owner's order mechanism rather than memory.
    pursue = MANDATORY_PURSUE | frozenset(getattr(rdecl, "pursue", ()) or ())
    # THE INPUT'S IDENTITY, CAPTURED BEFORE THE FIRST ROUND CAN REBIND
    # `lines`. Every accepted proposal below does `attempt, lines = ...`, so
    # by any stop condition the entry draft exists nowhere else — this pair
    # is the only record of what this run was actually asked to revise, and
    # it rides the result (`LoopResult.input_n`/`.input_fingerprint`) for the
    # reason every other coordinate does: the caller who needs it is reading
    # the result without the call site in view.
    input_n, input_fp = len(lines), draft_fingerprint(lines)
    rounds = []
    for round_no in range(1, rdecl.max_rounds + 1):
        briefs = reviser.brief(lines, mandate, profile=profile,
                               blueprint=blueprint, subdivision=subdivision,
                               assume=assume)
        # THE ROUND IS A COORDINATE OF THE QUESTION (M-183): stamped on the
        # brief, read by the recording proposers, so the same line at the
        # same attempt in a later round is a new question and not a replay.
        for _b in briefs:
            _b.round_no = round_no
        # PER-LINE FLAGS ONLY, and this module's docstring says so out loud
        # rather than leaving it to be inferred from `brief()`'s signature:
        # `briefs` is built from `inspect()`'s `per_line` half, so a
        # whole-draft flag is not in `b.findings` for ANY b and cannot be
        # here. `_close` carries those out in `LoopResult.whole_flags`.
        flagged = _open_lines(briefs, pursue)
        if not flagged:
            return _close(reviser, "success", lines, rounds, [], mandate,
                          blueprint, subdivision, assume, profile,
                          input_n=input_n, input_fp=input_fp,
                          pursue=pursue)

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
        resolved_elsewhere = []
        # THE DRAFT `briefs` AND `whole` WERE BUILT ON. Every accepted
        # proposal below rebinds `lines`, so this is how the loop knows its
        # own guidance has gone stale.
        brief_lines = list(lines)
        #: THE LATEST BRIEF SET THIS ROUND, or None while the round-opening
        #: one is still current (`MISSING.md` M-210). The re-brief below
        #: replaces `b` for the line it fires ON, and the guard it fires on
        #: is `lines != brief_lines` — which that same block then satisfies
        #: by assigning `brief_lines = list(lines)`. So the NEXT line of the
        #: round took the guard's False branch and read the ROUND-OPENING
        #: brief again, however far the draft had moved. One line was
        #: re-briefed per change and the rest of the round was not.
        latest_open = None
        for b in flagged:
            if b.line_no in touched:
                continue
            # ===========================================================
            # RE-BRIEF WHEN THE DRAFT HAS MOVED — FIXED 2026-08-16.
            # DEFECT B of the rung-1 coverage experiment.
            # ===========================================================
            # This loop briefed ONCE PER ROUND and then walked the flagged
            # lines proposing against that snapshot. Fixing line X inside a
            # round changes what a LATER flagged line Y must answer whenever
            # X is one of Y's call words — so Y was handed a candidate field,
            # a `must rhyme with`, and a `SCHEME_VIOLATION` evidence string
            # computed against a word no longer in the draft.
            #
            # THE OLD ARGUMENT WAS SOUND AND ANSWERED A DIFFERENT QUESTION.
            # It ran: `verify()` always re-derives the true finding set for
            # the CURRENT lines before accepting anything, so a stale
            # candidate is REJECTED rather than wrongly accepted, and
            # correctness does not depend on re-briefing. Every word of that
            # is still true — and it is about ACCEPTANCE. It says nothing
            # about GUIDANCE, and guidance is what a brief is.
            #
            # WHAT CHANGED THE ECONOMICS: `--propose=defer:`. The argument
            # was written when the only proposer was the free mechanical
            # stub, for which a rejected attempt costs nothing. The proposer
            # is now a person or a model, and MEASURED on the rung-1 draft, a
            # writer who followed the stale field exactly burned all three
            # attempts twice over and the loop returned NO_PROGRESS with the
            # line unresolved — while the correct answer was to ignore the
            # field the harness had just offered. A stale field is cheap to
            # reject and expensive to follow.
            #
            # AND THE STALE HALF CAN BE A FLAG THAT IS ALREADY REPAIRED.
            # On the blind re-run, L1's fix repaired the PAIR, and L2 was
            # then briefed to fix a `SCHEME_VIOLATION` that no longer
            # existed, with 24 offered words every one of which would have
            # broken the rhyme that now held.
            #
            # THE COST IS PAID ONLY WHERE THE DEFECT EXISTS: nothing is
            # re-derived until an accepted proposal has actually moved the
            # draft, so a round that fixes nothing, and the whole of the
            # first line of every round, cost exactly what they did before.
            if lines != brief_lines:
                fresh = reviser.brief(lines, mandate, profile=profile,
                                      blueprint=blueprint,
                                      subdivision=subdivision, assume=assume)
                for _b in fresh:
                    _b.round_no = round_no
                # `whole` is the rubric `verify()` grades against and it
                # moves with the draft too, so it is re-read here rather
                # than left pointing at the top of the round. Cheap by the
                # same measured argument the first read makes: `brief()`
                # above has just warmed the caches for exactly these lines.
                whole = tuple(reviser.inspect(
                    lines, mandate, profile=profile, blueprint=blueprint,
                    subdivision=subdivision, assume=assume)["whole"])
                brief_lines = list(lines)
                still_open = {x.line_no: x
                              for x in _open_lines(fresh, pursue)}
                latest_open = still_open
                if b.line_no not in still_open:
                    # AN EARLIER FIX THIS ROUND CLOSED IT. Asking anyway is
                    # what the stale snapshot used to do: it briefed a line
                    # whose finding was gone and spent a writer's attempt on
                    # it. Recorded rather than skipped in silence — and NOT
                    # as a failed `LineAttempt`, because no attempt was made.
                    resolved_elsewhere.append(b.line_no)
                    continue
                b = still_open[b.line_no]
            elif latest_open is not None:
                # THE DRAFT HAS NOT MOVED SINCE THE LAST RE-BRIEF, AND THE
                # LAST RE-BRIEF IS NOT THE ROUND-OPENING ONE (M-210). Read
                # the line's brief off THAT rather than off the snapshot the
                # round opened with. MEASURED on seed 6006: L3 and L4 were
                # accepted, L5's finding was closed by them, and L6 was then
                # briefed with `ANAPHORA_OVERLOAD: 8 of 14 lines open with
                # the same word (lines 3, 4, 5, 6, 11, 12, 13, 14)` printed
                # directly above a rendered draft in which lines 3, 4, 11
                # and 12 no longer open with that word at all — 4 of 14, and
                # under the threshold, so the flag was already gone. Nothing
                # was cached and nothing was wrong with `brief()`; the round
                # simply stopped asking it.
                if b.line_no not in latest_open:
                    resolved_elsewhere.append(b.line_no)
                    continue
                b = latest_open[b.line_no]
            if b.joint_conflict:
                attempt, lines = _try_tier2(
                    reviser, b, lines, mandate, rdecl, blueprint,
                    subdivision, assume, profile, propose_group, whole)
                if not attempt.accepted and not attempt.asked:
                    # THE FALL-THROUGH (M-185, 2026-09-01). Tier 2 consumed
                    # this line's turn without putting anything to a
                    # proposer, so the line would reach NO_PROGRESS never
                    # having been asked (M-173(e): "11 never asked"). The
                    # tier-2 record is KEPT — its own count, doctrine 79 —
                    # and tier 1 asks the pivot for one line in the same
                    # round, with whatever field the brief holds (an empty
                    # one is a real question to a writer and the stub's own
                    # "no candidate field" answer).
                    attempts.append(attempt)
                    attempt, lines = _try_tier1(
                        reviser, b, lines, mandate, rdecl, blueprint,
                        subdivision, assume, profile, propose, whole)
                    attempt = LineAttempt(
                        attempt.line_no, attempt.tier, attempt.accepted,
                        attempt.tried,
                        "after tier 2 NOT ASKED, fell through to tier 1: "
                        + attempt.reason, attempt.touched,
                        asked=attempt.asked)
            else:
                attempt, lines = _try_tier1(
                    reviser, b, lines, mandate, rdecl, blueprint,
                    subdivision, assume, profile, propose, whole)
                # THE ESCALATION (`MISSING.md` M-205). `joint_conflict` was
                # the ONLY door to tier 2, and it is
                # `len(calls) > 1 and not offered and not forbidden` — so a
                # two-member group, which gives its member exactly ONE call,
                # could never open it however unsatisfiable it was, and a
                # place with a non-empty offer could not either however
                # useless every word in it turned out to be. The flag
                # PREDICTS that tier 1 has no move; this asks whether it
                # HAD one. A tier-1 line that came back unaccepted is a line
                # tier 1 could not close, and that is the condition the
                # backtrack exists for — so the group is offered to tier 2
                # in the same round rather than waiting for a prediction
                # that cannot be made for its shape.
                #
                # BOTH RECORDS ARE KEPT, NEVER SUMMED (doctrine 79): tier 1
                # was asked and failed, and tier 2 was then asked; folding
                # them would lose which tier the line was actually closed
                # by, and `RoundResult.attempts` is the census the stop
                # condition reads.
                if not attempt.accepted and rdecl.backtrack_width < 1:
                    # THE DECLARED COORDINATE COMES FIRST (`MISSING.md`
                    # M-208). `--backtrack=0` SAYS do not backtrack, and
                    # M-205's escalation read only `_group_declared`, so a
                    # caller who had switched tier 2 off was handed a group
                    # brief anyway — a declared coordinate consumed and
                    # ignored, which is the family this file records more
                    # than any other, introduced by the commit that closed
                    # four silent skips. DISCLOSED rather than skipped, for
                    # the same reason the clause below is.
                    attempt = LineAttempt(
                        attempt.line_no, attempt.tier, attempt.accepted,
                        attempt.tried,
                        attempt.reason + "; tier 2 was NOT entered — "
                        "`backtrack_width` is 0, so the caller declared no "
                        "backtrack and the escalation may not substitute "
                        "one",
                        attempt.touched, asked=attempt.asked)
                elif not attempt.accepted and not _group_declared:
                    # DISCLOSED, NOT SKIPPED. This is the one place the
                    # escalation declines to run, and saying nothing here
                    # would make it a fourth silent skip — the exact
                    # species this entry exists to close.
                    attempt = LineAttempt(
                        attempt.line_no, attempt.tier, attempt.accepted,
                        attempt.tried,
                        attempt.reason + "; tier 2 was NOT entered — no "
                        "group proposer was DECLARED, and the backtrack "
                        "rewrites several lines at once, so it is not run "
                        "against a writer the caller did not name "
                        "(pass `propose_group=` to reach it)",
                        attempt.touched, asked=attempt.asked)
                elif not attempt.accepted:
                    attempts.append(attempt)
                    attempt, lines = _try_tier2(
                        reviser, b, lines, mandate, rdecl, blueprint,
                        subdivision, assume, profile, propose_group, whole)
                    attempt = LineAttempt(
                        attempt.line_no, attempt.tier, attempt.accepted,
                        attempt.tried,
                        "after tier 1 found no accepted line, escalated to "
                        "tier 2: " + attempt.reason, attempt.touched,
                        asked=attempt.asked)
            attempts.append(attempt)
            if attempt.accepted:
                fixed_this_round.extend(attempt.touched)
                touched.update(attempt.touched)
        rounds.append(RoundResult(round_no, attempts,
                                  sorted(fixed_this_round),
                                  sorted(resolved_elsewhere)))
        if not fixed_this_round:
            return _close(reviser, "no_progress", lines, rounds, flagged,
                          mandate, blueprint, subdivision, assume, profile,
                          input_n=input_n, input_fp=input_fp,
                          pursue=pursue)

    briefs = reviser.brief(lines, mandate, profile=profile,
                           blueprint=blueprint, subdivision=subdivision,
                           assume=assume)
    unresolved = _open_lines(briefs, pursue)
    return _close(reviser, "round_limit", lines, rounds, unresolved, mandate,
                  blueprint, subdivision, assume, profile,
                  input_n=input_n, input_fp=input_fp, pursue=pursue)


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
