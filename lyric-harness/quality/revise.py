#!/usr/bin/env python3
"""The revision loop — spec, draft, check, revise flagged lines, re-check.

CLAUDE.md has specified this since the first commit and it has never been
built. It is the thing that makes the rest of the project usable for writing
rather than for measuring.

WHAT THIS IS NOT

It does not generate text. "The model proposes; these tools grade" is the whole
architecture, so this module produces a BRIEF and then VERIFIES a response. A
caller — an MCP client, a person, a model — does the writing. Nothing here
writes a line of verse.

THE THREE RULES IT ENFORCES

1. **The model never self-certifies.** `verify()` decides whether a revision is
   accepted, by re-running the checks. A revision that claims to fix line 4 is
   accepted only if line 4's finding is actually gone.

2. **A revision may not introduce a new defect.** This is the one a naive loop
   always breaks: a model told "line 4's rhyme is weak" rewrites line 4, fixes
   the rhyme, and silently breaks the metre or repeats a word from line 2.
   `verify()` diffs the finding sets and rejects a net-negative revision even
   when the targeted finding is gone.

3. **THE BRIEF PUSHES AWAY FROM THE OPTIMUM.** Doctrine 9, and the reason this
   module is not trivial:

       "Optimizing toward the phonetic maximum is the slop direction. Handing a
       model 'L2-L4 below theta' makes it reach for the highest-scoring rhyme,
       which is the most predictable one. A revision protocol must push away
       from the optimum: pass the band, but not by taking the modal candidate."

   So when a rhyme needs fixing, the brief does not say "make it rhyme better".
   It supplies the candidate field, and then NAMES THE MOST FREQUENT MEMBERS OF
   THAT FIELD AS FORBIDDEN. Passing the band by taking `fire`/`desire` is
   exactly the failure the whole quality layer was built to detect, and a
   revision loop that recommends it would manufacture the slop the floor
   rejects.

   `verify()` enforces the exclusion: a revision that lands on a modal
   candidate is REJECTED even though it passes the band.

WHAT IT IS GRADED AGAINST — and the defect that was here until 2026-08-11

`brief(lines, scheme)` and `verify(before, after, scheme, targeted)` took
`scheme` as a LETTER STRING and nothing else, which put this module in direct
contradiction with doctrine 2. The doctrine says the pairwise graph is the
primary object, that letter schemes are LOSSY PROJECTIONS of it, and that
maximal cliques may OVERLAP — giving structures with NO LETTER REPRESENTATION
AT ALL. So the loop could grade only the projections the doctrine calls lossy,
and the projection is exactly the thing that sometimes does not exist.

Both halves reproduce on any real draft whose rhyme graph's maximal cliques
overlap: `partition` reports NO LETTER SCHEME EXISTS, and `brief` on the same
file with no scheme declared reports "nothing flagged" — not because the
draft is clean, but because nothing was mandated for it to violate.
NOTHING WAS MANDATED,
so it passed VACUOUSLY — doctrine 20 in a new place, inconclusive by
construction dressed as a pass. A grader whose answer to "check this against
nothing" is "looks fine" is worse than no grader, because it prints a
certificate.

So the loop now grades against a `quality.schemes.Mandate`, which a caller may
declare as a letter string, a list of line groups, a `Cover`, or a canonical
RGS code — and which REFUSES when it is handed none of them. The letter string
survives as one input among four, correctly labelled as the lossy one.

Read `quality/schemes.py` for what a mandate MEANS on an overlapping cover.
The short version, because it is a declaration and not a detail: a line in k
groups must answer ALL k of them, and every finding says which group it is
about.
"""

import collections
import copy
import hashlib
import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (NEAR_RELATIONS, NO_ANCHOR,  # noqa: E402
                           RHYME_RELATIONS, THETA_COLLISION,
                           CandidateEngine, Declaration,
                           Lexicon, admits, best_score, bron_kerbosch,
                           line_anchors, readability_records,
                           refusals_for_pairs, spans_note, spelled_rime,
                           theta_for)
from quality import fit as FT  # noqa: E402
from quality import grid as GR  # noqa: E402
from quality import frequency as FREQ  # noqa: E402
from quality import readability as RD  # noqa: E402
from quality import sentencehood as SH  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality import slots as _SL  # noqa: E402
from quality.floor import Finding, SlopFloor  # noqa: E402
from quality.schemes import Mandate, NoMandate  # noqa: E402

#: `Mandate` and `NoMandate` are re-exported: a caller of this loop should not
#: have to import two modules to declare what a draft is held to, or to catch
#: the refusal when it declares nothing.
__all__ = ["Brief", "Mandate", "NoMandate", "ReviseDeclaration", "Reviser",
           "COLLISION_FINDINGS", "RHYME_FINDINGS", "SATISFACTION_FINDINGS",
           "THETA_COLLISION", "draft_fingerprint"]

#: Findings that mean "this line's RHYME needs replacing". Each earns a
#: candidate field with the modal region excluded.
#:
#: NO COLLISION CODE IS IN HERE, AND THAT IS A DECISION RATHER THAN AN
#: OVERSIGHT — see `Reviser.brief`'s "WHY A COLLISION EARNS NO FIELD".
RHYME_FINDINGS = {"SCHEME_VIOLATION", "CLICHE_PAIR", "PREDICTABLE_RHYME",
                  "SHARED_SUFFIX", "REPEAT_IN_VERSE", "MODAL_RHYME",
                  "HOMEOTELEUTON"}

#: Findings whose PRESENCE records that a requirement or a licence HOLDS.
#: Everything else in the finding set names something WRONG, so its
#: disappearance is a repair; these name something RIGHT, so their
#: disappearance is a REGRESSION and can never be one.
#:
#: `verify()` diffed every code alike until 2026-08-14, which paid a
#: revision for breaking a chorus. Measured, on a four-section blueprint
#: whose two chorus instances are verbatim, changing one interior word of a
#: chorus line the mandate leaves free:
#:
#:     accepted : True
#:     fixed    : [(0, 'RETURN_LOCKED')]
#:     new_flags: []          new_notes: []
#:     reasons  : ['fixed 1, introduced 0, changed only [7]']
#:
#: `RETURN_LOCKED` is `grid.py` saying "every chorus return is verbatim in
#: an identical slot". The revision destroyed that, and destroying it was
#: the entire evidence that the revision fixed anything.
#:
#: THE DECLARED HALF WAS NEVER EXPOSED, and saying so is the point of
#: naming the population: break a return the writer DECLARED with
#: `schemes.Return(verbatim=True)` and `returns_check` raises
#: `RETURN_NOT_VERBATIM`, a FLAG, which the net-new gate rejects on. Only
#: the CONVENTION-measured half is reachable, because `grid.py`'s only flag
#: is `HOOK_ABSENT` -- so this is the doctrine 6 region, where a writer may
#: depart and the harness may not fail them for it.
#:
#: WHICH IS WHY BREAKING ONE IS DISCLOSED AND NOT REJECTED. A revision that
#: repairs a real flag and incidentally ends a strophic return is accepted,
#: and says so. A revision whose ONLY accomplishment is ending one now
#: reports "nothing was fixed", because nothing was.
#:
#: `MANDATE_EXCUSED_BY_OVERLAP` is deliberately NOT here: it records a pair
#: that FAILED its group and was excused, so its disappearance means the
#: pair stopped failing, which is a real repair. The test is what the
#: finding's own message asserts about the draft, not whether it is a note.
SATISFACTION_FINDINGS = {"REFRAIN_REPEAT", "RETURN_LOCKED", "RADIF_LICENSED"}

#: What a band-passing pair that shares no mandated group can BE.
#: One code said all of it until 2026-08-11 and its message said "rhyme" for
#: every one of them; doctrine 3 says identity is not rhyme and a near-relation
#: is not rhyme, and doctrine 24 says a rule that would delete a category must
#: relabel instead. Measured on this repo's two songs: of 38 collisions, 15
#: (39.5%) are ASSONANCE — pairs THIS MODULE'S OWN `grade()` calls a violation
#: when they are mandated — and 8 are REPEAT. So the single code was making a
#: claim the same module contradicts three functions away.
#:
#: `COLLISION_UNDECLARED` IS THE FOURTH AND IT IS NOT A RELATION — it is the
#: MANDATE'S OWN ANSWER, added 2026-08-13. The first three all assert that the
#: mandate had something to say here and this pair is outside it ("share no
#: mandated group"); a mandate with a declared `Mandate.scope` says of some
#: lines that it does not speak about them AT ALL, and `Mandate.requirement`
#: answers `UNDECLARED` — "cannot tell" — rather than `FREE`. It is a member of
#: this set because it IS a collision report and a caller partitioning findings
#: into collisions and non-collisions must not lose it; it is a separate CODE
#: because the other three name a defect-or-not on a question that was asked.
COLLISION_FINDINGS = {"SCHEME_COLLISION", "NEAR_COLLISION",
                      "REPEAT_ACROSS_GROUPS", "COLLISION_UNDECLARED"}

#: Score at or above which two lines that share NO group are reported as an
#: unintended rhyme. IMPORTED from `lyric_harness` since 2026-08-16 rather
#: than re-declared here: this comment already said "the two must not
#: drift" and a second `= 0.9` is not a mechanism, it is a promise. The SET
#: this module reports is still exactly `check_scheme`'s, and now it cannot
#: stop being. Re-exported below so every existing `from quality.revise
#: import THETA_COLLISION` keeps working (doctrine 58 — typing a finding is
#: not moving a threshold, and neither is moving where it is written).


def draft_fingerprint(lines):
    """-> 12 hex chars identifying WHAT was graded. md5 over the joined lines.

    A report that prints counts and verdicts but nothing identifying its
    input produces figures that cannot be tied back to their draft by anyone
    holding only the output. That is not hypothetical: on 2026-08-16 a
    41-line fixture was graded in place of the 41-line song a RESULTS
    document is about, the 41-character mandate bound cleanly to the wrong
    draft, and the run returned a complete, plausible report whose
    `collisions 69` was then recorded as a drift in a figure that had never
    moved (`BACKLOG.md` §4.7, `RESULTS_REVISION_LOOP.md`'s ledger). A length
    that matches is not an identity that matches, and nothing in the output
    could show it. Every report surface now prints this fingerprint beside
    its line count, so a pinned figure NAMES the text it came from and two
    same-length drafts are distinguishable on the page.

    THE HASH IS OVER THE LINES AS THE GRADER RECEIVED THEM — `"\\n".join`,
    UTF-8 — not over the file: a loader that strips markers or a caller that
    filters blanks has already changed the graded population, and the
    fingerprint must answer for what was GRADED, not what was on disk
    (doctrine 91: a count is a coordinate of the rendering; the input is a
    coordinate of the count). md5 because this is an IDENTITY CHECK against
    accident, not an integrity check against an adversary — the repo already
    speaks md5 for exactly this use (`c9b9e7bf4bd2` and kin) — and 12 hex
    chars because that is the citation width those records established.
    Doctrine 58 note: 12 is a written-down width; anyone re-deriving a
    fingerprint by hand must truncate to the same 12 or the comparison fails
    in the direction that LOOKS like a wrong draft.

    THE IDENTITY IS THE PAIR (line count, hash), NOT THE HASH ALONE, and
    every surface prints both — measured, not assumed: `"\\n".join` is not
    injective over line LISTS, so `["one line\\nsecond line"]` and
    `["one line", "second line"]` hash identically and differ only in the
    count printed beside it (probe: both give `83de3eefe6d4`; 1 line(s) vs
    2 line(s)). Unreachable from any CLI surface — every loader splits on
    newlines, so no element can carry one — but a direct library caller can
    construct it, and a rule with a known collision that relies on a second
    printed field must SAY so where the rule is stated. The alternative (a
    length-prefixed join making the hash injective) was considered and
    rejected: it would break the one property the incident showed matters,
    that a reader can re-derive the hash BY HAND from the stated rule.
    """
    return hashlib.md5(
        "\n".join(lines).encode("utf-8")).hexdigest()[:12]


@dataclass
class ReviseDeclaration:
    """Coordinates of the loop, declared so a disagreement lands in one."""
    #: How many of the band-passing candidates, ranked by FREQUENCY, are
    #: forbidden as modal. This is doctrine 9 as a number. Raise it to push
    #: harder away from the obvious; set it to 0 to disable the rule and get a
    #: loop that optimises toward the phonetic maximum, which is the slop
    #: direction and is why 0 is not the default.
    modal_exclusion: int = 6
    #: candidates offered per flagged rhyme, after the modal ones are removed
    offered: int = 24

    #: WHICH NOTE CODES THE LOOP KEEPS WORKING ON, beyond the flags it always
    #: pursues. ~~EMPTY IS THE DEFAULT and reproduces every run this loop has
    #: ever made.~~ STRUCK 2026-08-17: empty now ADDS nothing, and is no
    #: longer a way to run without pursuit — `quality/loop.py` unions this
    #: set with its own `MANDATORY_PURSUE` (owner's standing order; see the
    #: constant), so `MODAL_RHYME` is pursued on every run and no value of
    #: this field can switch that off. This field is the ADDITIVE half only.
    #:
    #: THE DEFECT THIS EXISTS FOR, found by writing a song through the loop.
    #: `MODAL_RHYME` and `PREDICTABLE_RHYME` are in `RHYME_FINDINGS`, so
    #: `brief()` hands a line carrying one a COMPLETE candidate field with the
    #: modal words marked FORBIDDEN — the machinery to fix them is built and
    #: reachable. And both are NOTES, while every stop condition in
    #: `quality/loop.py` reads `severity == "flag"`, so the loop declared
    #: SUCCESS and stopped before ever asking. MEASURED on a 33-line draft:
    #: `revise` converged after ONE answer and reported SUCCESS; `song` on the
    #: byte-identical draft reported four `MODAL_RHYME` and
    #: `PREDICTABLE_RHYME` at 3 of 3, 100% of pairs above 0.90. Doctrine 9 is
    #: this project's central claim and its own loop could not enforce it.
    #:
    #: A DECLARED COORDINATE AND NOT A PROMOTION. Re-typing `MODAL_RHYME` as a
    #: flag was the wrong fix twice over: doctrine 7 says a floor may not
    #: order the region it already passed, and a pair that rhymes IS inside
    #: that region; and `verify()`'s gate reads flags, so a promoted note
    #: would start REJECTING revisions for introducing one — the exact
    #: regression `new_flags` was split out to end.
    #:
    #: SO PURSUING CHANGES WHAT THE LOOP ASKS FOR AND NEVER WHAT IT REJECTS.
    #: `verify()` is untouched and still gates on `new_flags` alone. The pair
    #: composes into doctrine 9 end to end: the loop now ASKS for a non-modal
    #: word, and `verify()`'s pre-existing `modal_taken` rejection refuses an
    #: answer that takes one.
    pursue: frozenset = frozenset()

    #: HOW DEEP INTO THE SCORE-ORDERED POOL THE FIELD IS READ. `None` is the
    #: COMPLETE pool and is the default. This was a bare `n=200` inside
    #: `_field` — an undeclared literal that decided (a) which words the
    #: modal exclusion forbids, (b) which words are offered, and (c) whether
    #: a pivot reports its conjunction unsatisfiable. Measured on this repo's
    #: own song (`quality/RESULTS_REVISION_LOOP.md` §3): the modal-6 differs
    #: between depth 200 and the complete pool on 10 of 11 of the song's call
    #: words, and at depth 200 the pivot at L1/L14/L34 printed NO JOINT
    #: CANDIDATE — "the mandate, not the line, is what needs revising" —
    #: while six words answer all five of its calls. Doctrine 58/91: a count
    #: is a coordinate of a setting, and this one was never written down.
    field_depth: int = None

    #: WHICH PREDICATE DEFINES THE FIELD. "grader" is `admits()` — the scalar
    #: clears `theta_rhyme` AND the relation is a rhyme relation — which is
    #: exactly what `grade()` requires of a mandated pair. "scalar" is the
    #: scalar alone, which is what `_field` used to do, and it puts the brief
    #: in disagreement with the verdict that follows it: 17.3% of the words
    #: offered on this song's flagged lines were ones `grade()` rejects, so
    #: taking one MANUFACTURES the violation the brief was written to remove
    #: (doctrine 3/24 — a NEAR_RELATION is a named member of the taxonomy and
    #: it is not a rhyme). "scalar" stays reachable so the defect is
    #: demonstrable rather than a sentence nobody can check (doctrine 84,
    #: same argument as `modal_exclusion=0`); it is not the default.
    field_band: str = "grader"

    #: How many full write-check-fix ROUNDS `quality/loop.py` runs before it
    #: stops and hands back whatever is still flagged, regardless of the
    #: reason. Declared since the first commit of this file and unread by
    #: anything until `quality/loop.py`: a bound on effort has to exist
    #: before the loop that spends it does, or the loop's own author decides
    #: it ad hoc the day it is finally driven end to end.
    max_rounds: int = 4
    #: a revision is rejected if it introduces MORE new findings than it fixes
    allow_net_new: int = 0

    #: TIER 1's retry budget, per flagged line, per round. `quality/loop.py`
    #: proposes a replacement, and if `verify()` rejects it, tries again —
    #: up to this many times — before moving on to the next flagged line
    #: rather than exhausting the whole candidate field on one.
    attempts_per_line: int = 3
    #: TIER 2's search width. A joint-conflict pivot is backtracked by trying
    #: a NEW word for the anchor line and seeing whether the pivot's OTHER
    #: groups then have a non-empty field — this is the number of anchor
    #: candidates AND the number of pivot candidates per anchor tried before
    #: giving up on one 2-member group and moving to the next. Bounded
    #: because the search is O(width^2) `joint_field`/`modal_field` calls per
    #: group, not because a wider search is wrong.
    backtrack_width: int = 5

    #: WHAT A MANDATE MEANS WHERE THE GROUPS OVERLAP. "conjunctive" — a line
    #: in k groups must answer ALL k. "disjunctive" — answering one of them
    #: excuses the rest. The argument for the default is in schemes.py, and
    #: the short form is that the disjunctive reading gets WEAKER the more
    #: structure you declare, which is the vacuous pass this module exists to
    #: close. The alternative stays reachable so the choice is measurable
    #: rather than settled by fiat (the shape of doctrine 82/84).
    #:
    #: "disjunctive" is read PER LINE, which is how the sentence above is
    #: written: EVERY line of a failing pair must answer another of its OWN
    #: groups before the pair is excused, so a line in exactly one group is
    #: never excused from it. See `grade()` for the predicate and
    #: `test_revise.py` test 31 for what reading it per PAIR did instead.
    overlap_rule: str = "conjunctive"

    #: Doctrine 3: REPEAT is a violation inside a verse and the REQUIREMENT
    #: across chorus instances. The loop does not guess which; the caller
    #: declares it. "unlicensed" keeps parity with `check_scheme`, which calls
    #: an identical end word inside a mandated pair a violation. "refrain"
    #: licenses it and says, in the finding, that the licence was DECLARED and
    #: not earned by measurement — doctrine 18 requires a count and a fraction
    #: before a repetend is a form, and this loop measures neither.
    repeat_licence: str = "unlicensed"

    #: Anchor promotion used by the grader. Defaults to the spine's
    #: `Declaration.final_promotion` so this module reproduces `check_scheme`
    #: pair for pair; naming it here means the derived-cover path can use the
    #: SAME setting, which is what makes a derived cover an exact fixed point
    #: of this grader rather than approximately one.
    promote: bool = None

    #: WHERE A WHOLESALE COLLISION BETWEEN TWO GROUPS IS REPORTED. "report" —
    #: when EVERY cross pair of two disjoint mandated groups is a collision
    #: AND the union would satisfy the mandate as one group, the loop says
    #: that once, about the MANDATE, instead of N times about N lines.
    #: "off" — every edge is reported on its own line, which is what this
    #: module did until 2026-08-11 and which is kept reachable so the defect
    #: is demonstrable rather than a sentence nobody can check (doctrine 84,
    #: the same argument as `modal_exclusion=0` and `field_band='scalar'`).
    #:
    #: It ABSORBS AND NEVER ADDS: a merge is only reported over edges the
    #: loop was already emitting, so no setting of this makes the loop say
    #: something about a pair it was previously silent on. That guard is not
    #: cosmetic — without it the rule fires on two DECLARED groups whose end
    #: words happen to satisfy the mandate jointly and are NOT collisions,
    #: and the loop would be volunteering an opinion about a rhyme the
    #: writer did not make on a draft that otherwise passes clean.
    group_merge: str = "report"          # "report" | "off"


@dataclass
class SlotField:
    """The candidate field at ONE of a line's binding places (M-184)."""
    slot: object                 # None (the end) or the `Slot`
    labels: tuple                # the groups that bind this line here
    calls: tuple                 # the words this place must answer
    incumbent: str               # the word there now
    offered: list
    forbidden: list
    violated: bool               # a finding on this line names one of `labels`
    joint_conflict: bool         # 2+ calls here and NOTHING answers them all
    dropped: tuple = ()          # RHYME-typed words the symmetric screen refused
    #: THE PER-CALL FIELDS, computed ONLY when the joint above came back
    #: empty (`MISSING.md` M-202). `((call, (word, ...)), ...)` in `calls`
    #: order, one entry per call that anything answers.
    #:
    #: WHY IT EXISTS. The joint field is a CONJUNCTION over every call at
    #: this place, and `grade()` flags PAIRS. When a mandate binds a line
    #: against partners that do not rhyme with each other, the conjunction
    #: is empty BY CONSTRUCTION while the grader is still flagging one
    #: pair that one ordinary word closes -- so the brief offered nothing
    #: and told the writer the search was finished, on a line whose
    #: violated pair had 40 answers in the pool. Measured 2026-09-03 on
    #: seed 443 L5 (calls `Walk`, `gait`, `here`; only the `Walk` pair
    #: flagged): the joint was empty, and `Talk down at the stair` was
    #: ACCEPTED by `verify()` first try, fixing the SCHEME_VIOLATION and
    #: introducing no flag.
    #:
    #: IT IS A SEPARATE FIELD AND NOT A WIDER `offered` (doctrine 79): a
    #: word here answers ONE call and leaves the others unanswered, which
    #: is a different fact from the joint offer's "answers all of them".
    #: Folding the two into one list would tell the writer a partial
    #: answer is a whole one, and where the unanswered pair currently
    #: HOLDS, taking one is a new flag and a rejection.
    by_call: tuple = ()


@dataclass
class Brief:
    """What a caller is asked to do. Line-scoped, never whole-draft."""
    line_no: int
    text: str
    findings: list = field(default_factory=list)
    #: WHERE IN THIS LINE THE REQUIREMENT BINDS (`quality/slots.py`), and the
    #: field that keeps this brief from naming the wrong word. `None` means
    #: the default slot — the end of the line — which is what every brief
    #: meant before the coordinate existed.
    #:
    #: THE COST OF NOT HAVING IT, which is why it is a field and not a
    #: renderer's guess: `grade()` can flag a binding at a line's HEAD, and
    #: every word in this object — `must_rhyme_with`, the candidate `calls`,
    #: the incumbent — was read off `endwords[x - 1]`. A writer told to fix
    #: L3's opening would have been handed L3's ENDING, its rhyme partners
    #: and a field computed against the wrong call word: one question, two
    #: readings, with the loop acting on the wrong one (doctrine 1). The
    #: loop's own move follows it through `loop.swap_at_slot`.
    slot: object = None
    #: ~~True when this line binds at DIFFERENT places in different groups, so
    #: no single word swap can answer them all. Reported rather than resolved
    #: — the same shape `joint_conflict` has, one axis over: it is a fact
    #: about the MANDATE, and the loop has no move for it.~~ **STRUCK
    #: 2026-09-01 (`MISSING.md` M-184): that reading was inverted.** A line
    #: bound at its end in one group and at its T2 word in another is asked
    #: for TWO words, one per place, and each place is answered by its own
    #: swap — nothing about that is a fact about the mandate. What the old
    #: flag did was send every such line to the "the MANDATE is what needs
    #: revising" sentence while `brief()` intersected the two places' rhyme
    #: fields into one empty list (129 of 155 mandated lines on seed 88291
    #: bind at more than one place, so on a drawn plan this was the
    #: ordinary flagged line). True NOW when more than one of this line's
    #: binding places is VIOLATED, so a single swap at `slot` cannot close
    #: the line; `fields_by_slot` carries the other places' fields.
    slot_conflict: bool = False
    #: ONE FIELD PER BINDING PLACE (M-184): `{slot_key: SlotField}` where the
    #: key is `None` for the line's end and the slot's own spelling
    #: otherwise. `candidates`/`forbidden_modal`/`forbidden_incumbent`/
    #: `joint_conflict` below are the entry at `slot` — the place the
    #: findings on this line name — copied out so every existing reader
    #: keeps its meaning; the dict is for a renderer that has to say what
    #: the OTHER places want and whether they hold.
    fields_by_slot: dict = field(default_factory=dict)
    #: `{label: slot_key}` — where this line binds in each of its groups.
    group_slots: dict = field(default_factory=dict)
    #: The labels of the groups a finding on this line names as VIOLATED;
    #: empty when no finding can be attributed to a group (a many-line note
    #: such as PREDICTABLE_RHYME), in which case `slot` is the first group's.
    violated_groups: tuple = ()
    #: The labels of the groups that bind at `slot` — the groups a tier-2
    #: backtrack may rewrite for this pivot. Tier 2 used to walk EVERY group
    #: of the line and intersect their calls across places.
    slot_groups: tuple = ()
    #: RHYME-typed words the offer PASSED OVER at `slot` because taking them
    #: files MODAL_RHYME from the word's own side — the call sits in the
    #: word's own modal head (`MISSING.md` M-185). Printed with the offer so
    #: a writer knows the menu is short because the ban is, not the lexicon:
    #: for a call in the top ranks of its own family that is EVERY rhyme.
    screened_out: tuple = ()
    #: THE ROUND THIS BRIEF WAS ISSUED IN, stamped by `quality/loop.py`
    #: (0 outside the loop). A recorded answer belongs to the QUESTION it
    #: answered, and the question is (line, attempt, round): `attempt`
    #: restarts at 0 every round, so without this coordinate a line's
    #: round-1 answers were replayed as its answers in every later round and
    #: a stuck line was never asked twice (`MISSING.md` M-183). It rides the
    #: brief rather than the `propose()` contract so no proposer's signature
    #: moves.
    round_no: int = 0
    must_rhyme_with: tuple = None       # (line_no, endword) — the FIRST group
    candidates: list = field(default_factory=list)
    #: THE MODAL HEAD, AND NOTHING ELSE — doctrine 9's own set: the most
    #: frequent band-passing answers to this line's call words, which a
    #: revision may not LAND ON.
    #:
    #: IT CARRIED A SECOND RULE UNTIL 2026-08-16 and no consumer could tell
    #: the two apart. `brief()` appended the INCUMBENT — the word already at
    #: the end of the line — under a different argument entirely ("re-
    #: proposing what is there is not a revision"), so one list answered two
    #: questions and every renderer labelled the whole of it doctrine 9.
    #: MEASURED, on the pair that exposed it: `modal_field('four')` is
    #: `['door','more','before','shore','sore','or']` with and without the
    #: exclusion, so `stairs` was on the list under the second rule alone and
    #: `verify()` still rejected it as "the modal candidate".
    forbidden_modal: list = field(default_factory=list)
    #: THE WORD ALREADY AT THE END OF THIS LINE, carried separately since
    #: 2026-08-16. Empty when the line has no field.
    #:
    #: A STRING AND NOT A LIST, because there is exactly one of them and a
    #: one-element list invites the same summing the split exists to end.
    #:
    #: POPULATED FROM `self.floor.qf._endword(...)` AND FROM NOTHING ELSE,
    #: and that is load-bearing rather than incidental: `verify()`'s RULE 3
    #: compares against `_endword(before[ln - 1])`, so the two must be the
    #: same function or the corollary that makes "took the modal candidate"
    #: true by construction stops holding. `_endword` lowercases and strips
    #: boundary apostrophes and hyphens — it is not a raw byte compare, and
    #: anything populating this field by another route would silently
    #: reintroduce the defect.
    #:
    #: THIS IS THE THIRD SPELLING OF THE INCUMBENT RULE IN THIS REPO AND
    #: SAYING SO IS THE POINT (doctrine 1). The other two are `brief()`'s
    #: own `joint_field(calls, exclude=(cur,))` — which drops it from the
    #: OFFER — and `quality/loop.py`'s tier-2 `exclude=(pivot_current,)`/
    #: `exclude=(anchor_current,)`, which does the same for the backtrack
    #: search. All three say "do not re-propose the word that is there";
    #: none of them is derived from the others, and a change to the rule has
    #: to visit all three.
    #:
    #: AND THEY ARE BUILT FROM DIFFERENT FUNCTIONS THAT DISAGREE — MEASURED
    #: 2026-08-16, over 881 real lines of `corpus/song/eng_*`. This field
    #: and `verify()`'s RULE 3 use `QualityFeatures._endword`; `loop.py`'s
    #: tier-2 pivot uses `raw_final_token` and its anchor uses
    #: `line_anchors`'s last token. `raw_final_token` and `line_anchors`
    #: agree with each other on **0.00%** — they are one spelling in two
    #: places — but both differ from `_endword` on **7.83%** (69 of 881),
    #: and the axis is CASE: `_endword` lowercases and they do not
    #: (`'Lee'`/`'lee'`, `'Victory'`/`'victory'`).
    #:
    #: IT IS LATENT AND NOT LIVE, and saying which is the point of measuring
    #: rather than asserting: `joint_field` lowercases its own argument
    #: (`{w.lower() for w in exclude if w}`), so the case difference is
    #: absorbed at the one site that consumes tier 2's values. Nothing is
    #: broken today. What is true is that a change moving the incumbent rule
    #: off `_endword` — or a caller reading these values for anything but
    #: `exclude=` — meets a 7.83% disagreement with no test between it and
    #: the writer. `quality/test_revise.py` §42's precision check pins THIS
    #: field to `_endword`; nothing pins the other two.
    forbidden_incumbent: str = ""
    #: WHICH of `must_answer`'s groups are RETURNS rather than rhymes —
    #: the group LABELS whose `Mandate.requirement` is `REQUIRE_RETURN`.
    #: Added 2026-08-16 (defect E of the coverage experiment, rung 3).
    #:
    #: `must_answer` carries every group a line is in and NO requirement kind,
    #: so a declared RETURN — where the two lines must be THE SAME LINE —
    #: rendered identically to an ordinary rhyme group, and both renderers
    #: said *"this line must rhyme with"*. That is the WRONG requirement and
    #: a strictly WEAKER one: a writer who supplies a different line that
    #: rhymes has done exactly what they were told and broken the return.
    #:
    #: MEASURED on rung 3's draft, where L7 is a chorus line in three groups:
    #: `requirement(7, 8)` and `requirement(7, 3)` are `REQUIRE_RHYME` and
    #: `requirement(7, 19)` is `REQUIRE_RETURN`, and all three printed the
    #: same sentence. The mandate has always known; the brief never asked.
    #:
    #: A SET OF LABELS RATHER THAN A FOURTH TUPLE FIELD, deliberately:
    #: `must_answer`'s 3-tuple is read by `quality/loop.py`'s tier-2 search,
    #: by `propose.py` and by `__str__`, and widening it would make one
    #: rendering fix a four-site refactor. The label is the key those sites
    #: already carry.
    return_groups: tuple = ()
    #: Was the modal head COMPUTED at all for this line? Added 2026-08-16,
    #: because an EMPTY `forbidden_modal` means two different things and a
    #: renderer had no way to ask which.
    #:
    #: `quality/propose.py`'s empty-head branch printed *"(none — no modal
    #: head was computed for this line)"*, and that is FALSE wherever the
    #: head ran and came back empty. Two reachable populations, both
    #: measured: a JOINT-CONFLICT pivot, where `joint_field` searched over
    #: every call word and returned nothing — on `SILVER_MIND` L3 the same
    #: prompt says *"nothing in the lexicon answers all of those groups at
    #: once"* eleven lines above, so it contradicted itself — and
    #: `modal_exclusion=0`, where `ranked[:0]` is empty on EVERY line while
    #: the field itself is fully computed (2 of 2 briefed lines on `CLICHE`,
    #: each with 24 candidates offered).
    #:
    #: THE SPLIT CREATED THE SECOND HALF OF THIS AND IS WHY IT IS HERE.
    #: Before it, `forbidden_modal` also carried the incumbent, so on both
    #: populations the list was non-empty and the branch never fired — it
    #: printed the incumbent under "the most predictable answers in this
    #: field" instead, which was the OTHER false sentence. One false
    #: sentence was traded for another until this field existed to tell the
    #: two apart.
    field_computed: bool = False
    keep: list = field(default_factory=list)

    #: Every group this line belongs to: [(label, [lines], [(line, endword)])].
    #: A letter string can carry at most one of these per line, which is why
    #: `must_rhyme_with` alone was never enough to brief a pivot.
    must_answer: list = field(default_factory=list)
    #: True when no single word in the lexicon answers every group this line
    #: is in. Not a defect in the draft — a report that the CONJUNCTION of the
    #: declared groups is unsatisfiable at this line, which is information no
    #: letter scheme could ever produce because it cannot state the conjunction.
    #: It is ALSO a coordinate of `field_depth` and `field_band`, which is why
    #: `field_declaration` is carried beside it and printed with it: at the
    #: old undeclared depth of 200 this flag was TRUE and WRONG on three of
    #: this repo's own song's lines (doctrine 58).
    joint_conflict: bool = False
    #: WHAT EACH CALL CAN BE ANSWERED BY WHEN THE CONJUNCTION ABOVE IS EMPTY
    #: (`MISSING.md` M-202) — `((call, (word, ...)), ...)`, the `by_call`
    #: field of the SlotField at `slot`, copied out the same way
    #: `candidates` is. Empty whenever `joint_conflict` is False.
    #:
    #: A PARTIAL ANSWER IS NOT A SECOND-CLASS OFFER, it is a DIFFERENT
    #: OFFER, and the two are never merged: `candidates` answers every call
    #: at this place, an entry here answers exactly one. The renderers say
    #: which call each list answers and which calls it leaves standing,
    #: because taking one where the unanswered pair currently HOLDS
    #: introduces a flag and is rejected — and where that pair is ALREADY
    #: violated or unreadable, nothing is traded and the grader accepts.
    partial_by_call: tuple = ()
    #: The `(field_depth, field_band)` the candidate field was read at, as a
    #: printable string. A count with no setting beside it is the defect
    #: doctrine 58 is about, and this flag is a count of zero.
    field_declaration: str = "field_depth=?, field_band=?"
    #: THE DOOR THE FIELD WAS READ AT, as a printable string, carried beside
    #: the depth/band the same way and for a harder reason (`MISSING.md`
    #: M-139). `grade()` accepts a mandated pair on `admits(...)` OR on the
    #: 77 schemas; `_field_one` holds one WORD and the 77 judge LINE PAIRS,
    #: so the second half is unaskable at that site -- and until this field
    #: existed the brief said NOTHING about it, which reads as "asked, and
    #: nothing else could answer" (doctrine 20).
    #:
    #: THREE STATES AND `None` IS THE POINT, exactly as `field_computed`
    #: three fields up: `relations.SCHEMA_ROUTE_NOTE` = the route is open and
    #: this field did not consult it; `""` = the route is SHUT for every
    #: group this line is in (the caller narrowed `decl.admit`, or every
    #: group declares its own relation or structure), so the field's door IS
    #: the whole verdict door and there is nothing to disclose; `None` =
    #: nobody asked. A `bool` here would make ABSENCE mean SHUT and collapse
    #: the last two, which is the collapse this field exists to end.
    #:
    #: A STRING AND NOT A FLAG, AND THAT IS FORCED RATHER THAN PREFERRED.
    #: `quality/propose.py` renders this at three of the six sites, and
    #: `quality/test_propose.py`'s module-surface section asserts ON THE
    #: SOURCE that its import set is exactly `{"re"}` -- so the obvious
    #: design, a `bool` here plus `from quality.relations import
    #: SCHEMA_ROUTE_NOTE` at each renderer, is not merely against that
    #: module's docstring: it turns an existing check RED. (`relations` also
    #: reads `canon_index.tsv` at import, which is a filesystem access in a
    #: module that declares it has none.) So the sentence travels as DATA,
    #: exactly as `field_declaration` does. What stops that becoming a
    #: second copy is that its ONE definition is the constant in the module
    #: that owns the judge, and `quality/test_propose.py` §7e pins that
    #: `propose.py` contains no substring of it.
    schema_route_note: str = None

    def __str__(self):
        out = [f"L{self.line_no}: {self.text}"]
        for f in self.findings:
            # THE EVIDENCE IS THE PART A WRITER CAN ACT ON, and it was not
            # printed. A brief that says `SCHEME_VIOLATION: L15 and L19 do not
            # rhyme` withholds the score, the two words and the reason —
            # everything the finding actually measured — and a reader cannot
            # tell a 0.74 from a 0.20 or a refusal from a miss. Doctrine 6:
            # what comes back is a location and a measurement, never a mark.
            out.append(f"    - [{f.severity}] {f.code}: {f.message}")
            if f.evidence:
                out.append(f"        {f.evidence}")
        for lab, mem, calls in self.must_answer:
            shown = ", ".join(f"L{n} ({w!r})" for n, w in calls)
            # WHERE, AND WHETHER IT HOLDS (M-184): a group at a non-default
            # place names the place, and once any group on the line is
            # attributed a violation, every group says which side it is on.
            _sk = self.group_slots.get(lab, None) if self.group_slots else None
            place = f" at {_sk}" if _sk is not None else ""
            standing = ""
            if self.violated_groups:
                standing = (" — VIOLATED" if lab in self.violated_groups
                            else " — HOLDS")
            if lab in self.return_groups:
                out.append(f"    group {lab} {mem} is a RETURN: this line "
                           f"must BE {shown} — the same line, word for word, "
                           f"not merely a rhyme")
            else:
                out.append(f"    must answer group {lab} {mem}{place}: "
                           f"{shown}{standing}")
        if self.must_answer and len(self.must_answer) > 1:
            _places = {self.group_slots.get(lab) for lab, _m, _c in
                       self.must_answer} if self.group_slots else {None}
            if len(_places) > 1:
                out.append(f"    L{self.line_no} binds at {len(_places)} "
                           f"PLACES — each place is its own word answering "
                           f"its own group(s) (M-184)")
            else:
                out.append(f"    L{self.line_no} is a PIVOT — it is in "
                           f"{len(self.must_answer)} groups and must answer "
                           f"every one of them (conjunctive; doctrine 2)")
        if self.joint_conflict:
            out.append(f"    NO JOINT CANDIDATE at {self.field_declaration}: "
                       f"nothing in the lexicon answers all of those groups "
                       f"at once. ~~The mandate, not the line, is what needs "
                       f"revising.~~ STRUCK 2026-09-03 (M-202) — see below: "
                       f"the grader flags PAIRS, so a word answering the "
                       f"VIOLATED one is accepted.")
            for _c1, _ws in (self.partial_by_call or ()):
                out.append(f"      answers {_c1!r} ALONE ({len(_ws)}): "
                           f"{', '.join(_ws[:12])}"
                           + (" ..." if len(_ws) > 12 else ""))
            if not self.partial_by_call:
                out.append("      and no call here is answerable on its "
                           "own either — every one of them was asked "
                           "separately and the pool came back empty.")
        if self.must_rhyme_with and not self.must_answer:
            n, w = self.must_rhyme_with
            out.append(f"    must rhyme with L{n} ({w!r})")
        # TWO LINES, TWO RULES. Printing one list under one sentence is what
        # made this renderer state doctrine 9 about a word that was only ever
        # the incumbent. Each line now names the rule it is stating, and the
        # consequences differ: landing on a modal word is a RULE 3 rejection
        # on its own, while keeping the incumbent is not rejected here at all
        # (`verify()` RULE 3 asks whether a word was TAKEN) and is caught, if
        # at all, by RULE 4's "nothing was fixed".
        if self.forbidden_modal:
            out.append(f"    FORBIDDEN (modal — passing the band by taking "
                       f"these is the slop direction): "
                       f"{', '.join(self.forbidden_modal)}")
        if self.screened_out:
            out.append(f"    NOT OFFERED ({len(self.screened_out)} rhyme(s) "
                       f"the ban refuses from the OTHER side — the call "
                       f"word sits in their own modal head, so taking one "
                       f"re-opens the line as MODAL_RHYME): "
                       f"{', '.join(self.screened_out[:8])}"
                       + (" …" if len(self.screened_out) > 8 else ""))
        if self.forbidden_incumbent:
            # THE SECOND RENDERER OF THE SAME SENTENCE (`MISSING.md` M-91).
            # It said "end word" whatever `self.slot` bound; `slots
            # .word_phrase` is the one definition and answers "end word" for
            # every default member, so this line is byte-identical on every
            # mandate written before placement existed.
            out.append(f"    ALREADY THERE (not a modal word — re-proposing "
                       f"the {_SL.word_phrase(self.slot)} that is already on "
                       f"this line is not a revision): "
                       f"{self.forbidden_incumbent}")
        if self.candidates:
            out.append(f"    offered: {', '.join(self.candidates[:12])}"
                       + (" ..." if len(self.candidates) > 12 else ""))
            # RENDER SITE 1 OF 6 (`MISSING.md` M-139). Every site reads the
            # note off the brief; none of them writes prose about the 77.
            out.extend(schema_route_lines(self.schema_route_note, "    "))
        if self.keep:
            out.append(f"    keep unchanged: {', '.join(map(str, self.keep))}")
        return "\n".join(out)



def schema_route_lines(note, indent="  "):
    """-> [str], the door disclosure for ONE rendered candidate field.

    THE ONE READER of `Brief.schema_route_note` in this module and in
    `lyric_harness.py`, and the one place its three states are turned into
    lines. `None` -> the UNKNOWN sentence; `""` -> nothing, BECAUSE THE
    ROUTE IS SHUT and the field's door is the whole verdict door; anything
    else -> that sentence. Collapsing the first two is doctrine 20 (see the
    field's own docstring), and this function is where that collapse would
    be written if anyone wrote it.

    THE IMPORT IS LAZY for the reason every `quality` import in this file is:
    `relations` reads `canon_index.tsv` at import, and only the UNKNOWN arm
    needs it.

    WRAPPED AT THE SAME COLUMN EVERY OTHER BLOCK IN THIS FILE IS. The
    constant is stored unwrapped because the indent is the caller's, and a
    500-character line dropped into a hand-wrapped report is a rendering
    regression in the one artifact this disclosure exists to improve.
    `textwrap.fill` is deterministic and takes no argument this function does
    not hold, so doctrine 66 is untouched.
    """
    import textwrap
    if note is None:
        from quality.relations import SCHEMA_ROUTE_UNKNOWN as _U
        note = _U
    if not note:
        return []
    return textwrap.fill(note, width=76, initial_indent=indent,
                         subsequent_indent=indent).splitlines()


def _relation_phonology():
    """-> the phonology the declared-relation judge reads.

    `Reviser` carries NO language coordinate — checked 2026-08-22, it has no
    `lang`/`language` attribute anywhere — so this resolves English, exactly
    as `structures.Structure.judge` already does with `phon or PH.get("eng")`.

    IT IS A NAMED FUNCTION RATHER THAN AN INLINE DEFAULT ON PURPOSE. Doctrine
    45 says language is a coordinate and a checker silently picking one is
    the bug; this path does pick one, and putting the pick behind a name
    makes it a single visible site to fix when `Reviser` learns a language,
    instead of a literal buried in a branch. `MISSING.md` M-4 owns the
    coordinate itself. Recorded rather than hidden: a mandate declaring
    `cynghanedd lusg` on a Welsh draft is being judged by the English
    phonology today, and that is wrong in a way this comment is the only
    warning of.
    """
    from quality import phonology as _PH
    return _PH.get("eng")


def _schema_name_of(_RT, want):
    """-> the canonical schema name `want` declares, or "" if it declares a
    class or a named type.

    ASKED THROUGH THE VOCABULARY RATHER THAN BY PREFIX-MATCHING `"schema:"`.
    A stored relation is namespaced (M-49) so the prefix IS reliable today,
    but the namespace spelling is `resolve_relation`'s to own and a second
    module deciding it by string surgery is how the two drift apart
    (doctrine 1). A name that refuses here returns "" and the per-pair judge
    raises the vocabulary's own refusal a moment later, in the one place
    that already turns it into a `refusals` row.
    """
    try:
        canon, kind = _RT.resolve_relation(want)
    except Exception:
        return ""
    return canon if kind == "schema" else ""


class Reviser:
    """Grades a draft, briefs a revision, and verifies the result."""

    def __init__(self, lex=None, decl=None, rdecl=None, floor=None):
        self.lex = lex or Lexicon()
        self.decl = decl or Declaration()
        self.rdecl = rdecl or ReviseDeclaration()
        self.floor = floor or SlopFloor()
        self._engine = None
        self._matrix_cache = {}
        #: per-PAIR scores for declared slots. Separate from
        #: `_matrix_cache` because the matrix is an n x n object
        #: over LINES and a slot pair is not a cell of it; only a
        #: mandate that declares a slot ever fills this.
        self._slot_cache = {}
        self._field_cache = {}
        self._anchor_cache = {}

    @property
    def engine(self):
        if self._engine is None:          # expensive; built on first need
            self._engine = CandidateEngine(self.lex, self.decl)
        return self._engine

    # -- the mandate ------------------------------------------------------

    def mandate(self, lines, spec):
        """-> `Mandate`, or RAISE. There is no third outcome, on purpose.

        `spec=None` used to fall through to "no scheme declared", which
        mandated nothing and reported nothing flagged. Doctrine 20: that is a
        refusal wearing a pass, and it is now a refusal that says so.

        A BLANK LINE IN THE DRAFT IS THE SECOND REFUSAL, and it is the same
        defect one coordinate over: the mandate and the draft disagree about
        WHICH LINES THEY ARE TALKING ABOUT rather than about how many there
        are. `n_lines=len(lines)` below commits this whole class to "the list
        handed in IS the line list" — `_matrix` builds an n x n matrix over
        it, `grade()` reads `matrix[i - 1][j - 1]`, `brief()` reads
        `lines[ln - 1]`, and `verify(targeted=...)` takes the CALLER's own
        1-based numbers into it. `Mandate.pairs0()` is 0-based against that
        same list. TWO LAYERS UNDERNEATH DISAGREE, correctly and on purpose:
        `SlopFloor.check` opens with `lines = [l for l in lines if l.strip()]`
        and `QualityFeatures.extract` does the same, because a stanza break
        must not become a datapoint (`quality/test_floor.py` test 2 pins that
        and is right). So the two halves of `inspect()` count lines
        differently and neither says so.

        MEASURED, on a 5-line draft with a blank at L2 and groups 1,3;4,5
        (reachable through a plain letter scheme, `inspect(RAW, 'AXABB')` —
        not only through a hand-built `Cover`):

          - `pairs0()` is [(0, 2), (3, 4)]. Against the floor's own 4-element
            list, (3, 4) is out of range and the guard in
            `SlopFloor._relation_findings` DROPS it, so the mandated pair
            L4/L5 is never graded. On the blank-free draft that pair carries
            a `REPEAT_IN_VERSE` FLAG — something `verify()` can reject on.
          - (0, 2) is graded, as stripped[0]/stripped[2] = RAW L1/L4, a pair
            the mandate never groups. An UNDECLARED pair, silently judged.
          - Every floor finding's `locations` is `enumerate()`d over the
            STRIPPED list and filed by `inspect()` as RAW line numbers. On a
            5-line draft with a LEADING blank, `ANAPHORA_OVERLOAD` comes back
            at [1, 2, 3, 4] when the true raw lines are [2, 3, 4, 5], so
            `brief()` briefs the EMPTY LINE and never reaches the last real
            one. It is not only an off-by-one into another real line: on the
            same shape with a CLICHE_PAIR, a FLAG lands on the blank, and
            `revise_loop` then returns `stop_reason=no_progress` with its
            first attempt logged as `line 1 tier 1 accepted=False, "no
            candidates offered"` — the loop asking for a better end word
            for "".

        REFUSED RATHER THAN STRIPPED, and stripping was the obvious-looking
        fix. `SlopFloor._pairs` ALREADY carries the guard that would have
        caught this (`if scheme and len(scheme) == len(lines)`) and
        `_floor_for` goes around it with a lambda that ignores both
        arguments — but re-arming it would only turn a wrong answer into a
        silent fallback to adjacent couplets, which is a different wrong
        answer. Stripping here would silently RENUMBER THE WRITER'S
        DECLARATION: `[[4, 5]]` means raw L4/L5, and after a strip it would
        mean two different lines. It would also break two coordinates that
        are not ours to move — `verify()`'s `targeted={4}` is the caller's
        line numbering, and a pre-built `Mandate` carries `n_lines` from the
        raw draft, so a strip would make this method refuse it for a length
        mismatch it did not have. An index map in both directions was the
        third option and it repairs only the floor's half: the blank line is
        still a real line to `_matrix`, to `readability.report`, to
        `fit.py`'s bar placement and to `grid.py`'s rebuilt `Song`, and it is
        still a briefable line with no text in it.

        `NoMandate` is the same instrument `SC.mandate` already uses for the
        sibling defect one line apart, for the reason written there: silently
        ignoring a length mismatch is how the old loop dropped a declared
        scheme on the floor and passed vacuously.

        NOT REACHABLE FROM THE CLI, which is why it survived:
        `load_lyric_lines` and `parse_lyric_sections` both drop blanks and all
        four verbs route through one of them. Fully reachable from the Python
        API, on every entry — `grade`, `group_merges`, `inspect`, `brief`
        (via `inspect`) and `verify` (via `inspect` on BOTH drafts, so a blank
        at the same index in before and after — which passes verify's own
        length gate — is caught here rather than nowhere).
        """
        self._refuse_blank(lines)
        return SC.mandate(spec, n_lines=len(lines))

    @staticmethod
    def blank_lines(lines):
        """-> the 1-based numbers of the lines this class cannot grade.

        ONE SPELLING OF "BLANK", and it is deliberately the same predicate
        the two layers that disagree with this one use: `SlopFloor.check`'s
        `[l for l in lines if l.strip()]`, `QualityFeatures.extract`'s copy of
        it, and `lyric_harness.load_lyric_lines`'s `if l.strip()`. A refusal
        keyed on a NARROWER test than the strip it is protecting against
        would let exactly the drafts that skew the indices through.
        """
        return [i + 1 for i, l in enumerate(lines) if not str(l).strip()]

    @classmethod
    def _refuse_blank(cls, lines):
        """RAISE `NoMandate` if the draft carries a line the floor will drop.

        Called from BOTH mandate constructors. `mandate()` is the choke point
        every grading path routes through (`grade`, `group_merges`,
        `inspect`, and so `brief`/`verify`); `mandate_from_graph` is the one
        builder that does not go through it, and it reaches `_matrix` — so
        without this it would spend a full n x n pass over a line list it
        cannot number before the refusal arrived from somewhere else.
        """
        blank = cls.blank_lines(lines)
        if blank:
            raise NoMandate(
                f"line{'s' if len(blank) > 1 else ''} "
                f"{', '.join('L%d' % b for b in blank)} of this "
                f"{len(lines)}-line draft "
                f"{'are' if len(blank) > 1 else 'is'} blank, and a blank line "
                f"is not a line this loop can grade.\n"
                f"This is a REFUSAL, not a pass, and not a defect in the "
                f"writing: it is the mandate and the draft disagreeing about "
                f"WHICH LINES they name.\n"
                f"A Reviser takes the list it is handed AS the line list — "
                f"`mandate()` is `n_lines=len(lines)`, `Mandate.pairs0()` is "
                f"0-based into it, `verify(targeted=...)` and `Brief.line_no` "
                f"are the caller's own 1-based numbers into it. "
                f"`SlopFloor.check` and `QualityFeatures.extract` are not: "
                f"both open by dropping blank lines, because a stanza break "
                f"must not become a datapoint. Handed a draft with a blank, "
                f"those two halves of `inspect()` number lines differently — "
                f"a mandated pair falls off the end and is dropped in "
                f"silence, an undeclared pair is graded in its place, and "
                f"every floor finding's `locations` is filed one or more "
                f"lines short of where it was measured.\n"
                f"Stripping the blanks here would silently RENUMBER the "
                f"declaration you just made, so the draft is handed back "
                f"instead. Drop the blank lines yourself before you call — "
                f"`lyric_harness.load_lyric_lines` is what every CLI verb "
                f"uses and is why none of them can reach this — and renumber "
                f"the mandate to match.")

    def mandate_from_graph(self, lines, theta=None, profile=None,
                           origin=None):
        """The song's OWN structure as a mandate: maximal cliques of the rhyme
        graph, overlaps and all. -> a DERIVED `Mandate`.

        This is the object doctrine 2 calls primary and nothing had ever been
        able to grade, because the only thing the loop accepted was the
        projection that here does not exist.

        It is built from THIS module's matrix rather than by calling
        `rhyme_graph`, for one reason: `rhyme_graph` reads anchors with
        `promote=False` and `check_scheme` reads them with
        `promote=decl.final_promotion`, which is True. Deriving a cover under
        one setting and grading it under the other would make the cover an
        approximate fixed point of the grader and the tautology below
        approximately true, which is the least useful state for it to be in.

        AND IT IS NOT INDEPENDENT OF THE GRADER. Every maximal clique is a set
        of mutually band-passing lines BY CONSTRUCTION, so grading it against
        the same band at the same theta cannot produce a rhyme violation. That
        is doctrine 14 — a control may not be defined in terms of the quantity
        it controls — and the returned mandate carries `source="derived"` so
        the brief and the verdict say it out loud instead of reporting a pass.
        What such a mandate CAN say non-trivially is everything the band did
        not decide: unreadable lines, REPEAT edges the graph admits and a
        mandate rejects, the slop floor, and the joint candidate field at a
        pivot. And a cover derived at one theta is a perfectly ordinary
        independent mandate when graded at another.

        A BLANK LINE IS REFUSED HERE TOO, by the same `_refuse_blank` the
        declared path uses — the cover this returns is 1-based against the
        list it was handed, so it carries the same numbering the floor will
        not agree with. See `mandate()`.
        """
        self._refuse_blank(lines)
        theta = self.decl.theta_rhyme if theta is None else theta
        _, _, records, matrix = self._matrix(lines, profile=profile)
        n = len(lines)
        adj = {i: set() for i in range(n)}
        for i in range(n):
            for j in range(i + 1, n):
                if records[i]["final_unreadable"] or \
                        records[j]["final_unreadable"]:
                    continue
                s = matrix[i][j]
                if admits(s, theta, relations=frozenset(self.decl.admit)) \
                        or s["relation"] == "REPEAT":
                    adj[i].add(j)
                    adj[j].add(i)
        cliques = []
        bron_kerbosch(set(), set(range(n)), set(), adj, cliques)
        cov = SC.Cover(n_lines=n,
                       groups=[sorted(x + 1 for x in c) for c in cliques])
        return SC.mandate(
            cov, n_lines=n, source="derived",
            origin=origin or (f"maximal cliques of the rhyme graph at "
                              f"theta={theta}, promote={self._promote()}"))

    def _promote(self):
        p = self.rdecl.promote
        return self.decl.final_promotion if p is None else p

    # -- the graph, once --------------------------------------------------

    @staticmethod
    def _attribution(s, word_a, word_b):
        """-> the provenance note, but ONLY when the two words a finding is
        about are not what produced the number. "" otherwise.

        BACKLOG 1.2, the half `check_scheme` closed and the WRITER-FACING
        half that did not. `best_score` takes a max over k span pairs and has
        carried an `Attribution` naming the winner since adversary 7;
        `check_scheme` prints it through `spans_note`, and `inspect()`'s
        findings — the ones that reach a writer through `brief()` and
        `quality/propose.py` — printed `'break' ~ 'ear'` and the number and
        nothing else. Two words and a number on one line is an ASSERTION
        (doctrine 45), and `Attribution.claims` is that assertion evaluated.

        GATED ON `claims`, NOT PRINTED ALWAYS, and the gate is the whole
        design. MEASURED on rung 3's own 26-line draft: 325 of 325 pairs have
        a provenance note, 208 of them name something other than the two end
        words, and 4 of the 13 MANDATED pairs do. Appending the note to every
        finding would bury the four cases that matter under 200 that say
        `scored on: humming ~ coming`. A report says the extra sentence
        exactly when the ordinary one would be false.
        """
        sp = getattr(s, "spans", None)
        if sp is None or sp.claims(word_a, word_b):
            return ""
        return " — NAMED PAIR IS NOT THE EVIDENCE: " + spans_note(s)

    def _matrix(self, lines, profile=None):
        """-> (anchors, endwords, readability records, full pair matrix).

        The full pairwise score matrix IS the primary object (doctrine 2), so
        it is computed once and every view — mandated pairs, collisions,
        cliques — is read off it rather than recomputed with its own
        conventions. Cached because `verify` needs three passes over two
        drafts.
        """
        key = (tuple(lines), self._promote(), profile)
        hit = self._matrix_cache.get(key)
        if hit is not None:
            return hit
        anchors, endwords = [], []
        for line in lines:
            ancs, last, _ = line_anchors(self.lex, line,
                                         promote=self._promote())
            anchors.append(ancs)
            endwords.append(last)
        records = readability_records(self.lex, lines, anchors)
        n = len(lines)
        matrix = [[None] * n for _ in range(n)]
        for i in range(n):
            for j in range(i + 1, n):
                s = best_score(anchors[i], anchors[j], self.decl,
                               endwords[i], endwords[j], profile=profile)
                matrix[i][j] = matrix[j][i] = s
        out = (anchors, endwords, records, matrix)
        if len(self._matrix_cache) > 8:
            self._matrix_cache.clear()
        self._matrix_cache[key] = out
        return out

    def _incumbent(self, lines, line_no, slot):
        """-> the word `line_no` carries NOW at `slot` (M-184).

        THE ONE DEFINITION `brief()` and `verify()`'s RULE 3 share: the end
        word through `qf._endword` at the default slot — byte-identical to
        what both read before — and the resolved span's label otherwise.
        RULE 3 used to read `_endword` whatever the brief's slot was, so a
        line briefed at its T2 word was checked for "took the modal
        candidate" at its END, where nothing had moved.
        """
        if slot is None or _SL.is_default(slot):
            return self.floor.qf._endword(lines[line_no - 1])
        return _SL.resolve(self.lex, lines[line_no - 1], slot)[1]

    @staticmethod
    def _violated_groups(m, ln, groups, findings):
        """-> the group indexes a finding on `ln` NAMES as violated (M-184).

        Read off the finding's own `locations` — a pair finding names its
        two lines, and the group is the one that holds both — with the
        finding's message consulted only to break a tie between two groups
        holding the same pair at different places. A finding that names no
        pair (PREDICTABLE_RHYME lists every obvious line) attributes to no
        group, and a line whose findings attribute to none falls back to
        the first group's place, which is what every brief did before.
        """
        out = set()
        for f in findings:
            if f.code not in RHYME_FINDINGS:
                continue
            locs = list(getattr(f, "locations", ()) or ())
            if len(locs) != 2 or ln not in locs:
                continue
            other = locs[0] if locs[1] == ln else locs[1]
            holding = [k for k, mates in groups if other in mates]
            if len(holding) > 1:
                named = [k for k in holding
                         if f"group {m.labels[k]} " in (f.message or "")
                         or (f.message or "").endswith(f"group {m.labels[k]}")]
                if named:
                    holding = named
            out.update(holding)
        return out

    def _slot_word(self, lines, m, k, line, endwords):
        """-> the word one LINE carries at its binding site in one GROUP.

        The end word when the group binds at the default slot — read off the
        `endwords` array the caller already holds, so the ordinary path costs
        nothing and is byte-identical — and the resolved span's own label
        otherwise. One definition, so `must_answer`, `must_rhyme_with` and the
        candidate field's call words cannot disagree about which word this
        line is being asked about (doctrine 1).
        """
        if not m.slots_declared():
            return endwords[line - 1]
        slot = m.slot_of(k, line)
        if _SL.is_default(slot):
            return endwords[line - 1]
        return _SL.resolve(self.lex, lines[line - 1], slot)[1]

    def _slot_score(self, lines, slot_a, slot_b, profile=None):
        """-> (score, label_a, label_b) for one DECLARED-SLOT pair.

        THE SAME COMPARATOR, A DIFFERENT SPAN. `best_score` is what the band
        and every threshold in this repository were calibrated on, so a
        binding that is not at a line's end is scored by it too — the
        placement moves, the judge does not. Anything else would put a
        second comparator behind one verdict (doctrine 1), and the whole
        point of the slot coordinate is that WHERE is declared while WHAT
        COUNTS stays one answer.

        NOT FOLDED INTO `_matrix`, which is a per-LINE object: the matrix is
        n x n over lines and a slot pair is not a cell of it. It is computed
        per pair and cached on the pair, because only a mandate that declares
        a slot pays for one — an ordinary end-rhyme mandate never reaches
        this method.

        The two labels are what a finding NAMES. For a default slot that is
        the line's end word, byte-identically; for any other it is the words
        the resolved span actually covers, so a report about a mid-line
        binding quotes text a reader can find in the line rather than a
        syllable index.
        """
        key = (tuple(lines), slot_a, slot_b, self._promote(), profile)
        hit = self._slot_cache.get(key)
        if hit is not None:
            return hit
        anc_a, lab_a, _ = _SL.resolve(self.lex, lines[slot_a.line - 1],
                                      slot_a, promote=self._promote())
        anc_b, lab_b, _ = _SL.resolve(self.lex, lines[slot_b.line - 1],
                                      slot_b, promote=self._promote())
        s = best_score(anc_a, anc_b, self.decl, lab_a, lab_b, profile=profile)
        out = (s, lab_a, lab_b)
        if len(self._slot_cache) > 512:
            self._slot_cache.clear()
        self._slot_cache[key] = out
        return out

    # -- grading the mandate ----------------------------------------------

    def grade(self, lines, mandate=None, profile=None, sections=None):
        """The mandate, diffed against the graph. -> dict, group-scoped.

        `sections` IS THE STANZA GROUND AND IT IS PASSED, NEVER INVENTED
        (2026-08-22). Five registry schemas declare `frame="stanza"` —
        `analysed rhyme`, `blues AAB stanza`, `dvitiyakshara-prasa`, `monai`,
        `monorhyme / leash` — and every one refuses without it. `grade()` is
        handed lines with the blank lines already stripped, so it has NO
        ground of its own, and handing `build_stream` an all-zero stanza
        vector to make `supply('stanza')` say `present` is precisely the
        defect `MISSING.md` M-39(b) closed: a frame asserted where there is
        none, letting five schemas quantify over one stanza and report the
        result as measurement. So the ground comes from the CALLER — a
        per-line section list, which `inspect()` derives from the blueprint
        the writer declared. No blueprint, no sections, and the five schemas
        go on refusing, which is the honest answer and not a gap.

        This is `check_scheme` generalised off letters. Same primitives, same
        order of tests, same constants — deliberately, because the two must
        agree pair for pair wherever a letter scheme exists, and
        `test_revise.py` asserts that on the sonnet scheme and on the song's
        own 41-character mandate. What is new is that every verdict carries
        the GROUP it is about, so a pivot in two groups produces two verdicts
        rather than one, and `pairs_mandated / pairs_judged / pairs_refused`
        stay three separate counts (doctrine 79).
        """
        m = self.mandate(lines, mandate)
        _, endwords, records, matrix = self._matrix(lines, profile=profile)
        pairs = m.pairs()
        refusals = refusals_for_pairs(records, sorted({(i - 1, j - 1)
                                                       for i, j, _ in pairs}))
        # M-149(b): THE SKIP SET IS KEYED PER (PAIR, GROUP), NEVER PER PAIR.
        # It held bare `(i, j)` keys, so a refusal minted while judging ONE
        # group's reading of a pair silenced every sibling group's DIFFERENT
        # reading of the same two lines — measured on the first full plan the
        # repaired schema judge graded: groups H (`schema:perfect rhyme`) and
        # I (`schema:anaphora`) on lines (6, 7) were never judged at all,
        # because group J's slot refusal on the same pair landed first. That
        # sharing predates slots and was harmless while every group read the
        # same two end words; a slot web puts several groups on one pair
        # reading different words, and a refusal about one reading is not an
        # answer about another (doctrine 79, at the key's own granularity).
        #
        # A SCALAR end-word refusal poisons exactly the groups that READ the
        # end word: the member's slot is DEFAULT on a line whose end word is
        # unreadable. A group binding the same pair at readable declared
        # tokens keeps its question. The record keeps one entry per pair for
        # rendering and its `groups` names ONLY the poisoned groups — naming
        # a group whose question survived would claim a refusal nobody made.
        # A pair whose unreadable end word no group reads mints NO record.
        refused = set()                     # (i, j, k) triples
        _slotted_scalar = m.slots_declared()
        _kept_refusals = []
        for r in refusals:
            i, j = r["lines"]
            ks = sorted(set(m.groups_of(i)) & set(m.groups_of(j)))
            hit = []
            for k in ks:
                if _slotted_scalar:
                    reads_bad = (
                        (records[i - 1]["final_unreadable"]
                         and _SL.is_default(m.slot_of(k, i)))
                        or (records[j - 1]["final_unreadable"]
                            and _SL.is_default(m.slot_of(k, j))))
                    if not reads_bad:
                        continue
                refused.add((i, j, k))
                hit.append(k)
            if hit:
                r["groups"] = [m.labels[k] for k in hit]
                _kept_refusals.append(r)
        refusals = _kept_refusals

        # AND A DECLARED SLOT THAT RESOLVES TO NO ANCHOR IS ALSO A REFUSAL,
        # and it was counted as JUDGED until 2026-08-26 (`MISSING.md` M-144).
        # `refusals_for_pairs` asks the readability record of the END WORD,
        # which is the right question for a group binding at the default slot
        # and THE WRONG WORD for one binding at `1.T5` — `slots.resolve`'s own
        # comment says "the honest answer is NO ANCHOR, the same answer an
        # unreadable end word already gets, and the readability layer already
        # reports", and the readability layer does not report it here because
        # it is looking somewhere else.
        #
        # MEASURED on `songs/crooked_waltz.txt` before the repair: 12 of its
        # 45 binding sites resolve to NO ANCHOR (L1 `T5` is `by`, a function
        # word the phonology cannot anchor), **22 of 47 mandated pairs touch
        # one**, and the triple read `mandated 47, judged 47, refused 0`.
        # `songs/README.md` records that line. A refusal in the JUDGED column
        # is doctrine 79's own error, in a shipped headline count.
        #
        # KEYED PER (PAIR, GROUP), because a slot is a coordinate OF THE GROUP:
        # the same two lines can bind at their ends in one group and at an
        # unanchorable token in another, and those are different questions.
        # Resolution is memoised per (group, line) so a group of nine costs
        # nine resolves and not thirty-six.
        if m.slots_declared():
            _seen, _slot_ref = {}, []

            def _anchorless(k, line):
                key = (k, line)
                if key not in _seen:
                    slot = m.slot_of(k, line)
                    if _SL.is_default(slot):
                        _seen[key] = None
                    else:
                        anc, label, _ = _SL.resolve(self.lex,
                                                    lines[line - 1], slot)
                        _seen[key] = None if (anc and label) else slot
                return _seen[key]

            for i, j, k in pairs:
                bad = [(ln, sl) for ln, sl in
                       ((i, _anchorless(k, i)), (j, _anchorless(k, j))) if sl]
                if not bad:
                    continue
                refused.add((i, j, k))     # this GROUP's reading, M-149(b)
                _slot_ref.append({
                    "lines": (i, j),
                    "endwords": (endwords[i - 1], endwords[j - 1]),
                    "unreadable": [str(sl) for _, sl in bad],
                    "slot_refusal": True,
                    "groups": [m.labels[k]],
                    "reason": (
                        f"the declared slot resolves to NO ANCHOR on "
                        f"{', '.join('L%d' % ln for ln, _ in bad)} — the "
                        f"token that slot names is a word this phonology "
                        f"cannot anchor, so the pair was never compared. "
                        f"NOT a violation and NOT a pass (doctrine 20/79); "
                        f"the end words are shown for orientation and are "
                        f"NOT what this group asked about"),
                })
            refusals.extend(_slot_ref)

        # WHICH (LINE, GROUP) PAIRS WERE NEVER JUDGED. A refusal is not a
        # failure (doctrine 79) and it is not a pass either (doctrine 20), so
        # it is kept apart from `unanswered` below rather than folded into it:
        # the disjunctive excusal may buy nothing with an UNKNOWN, and the
        # reason it may not is different from the reason it may buy nothing
        # with a failure.
        unknown = set()
        verdicts = []
        # THE DECLARED-STRUCTURE ROUTE (phases A/B wired 2026-08-18). A
        # group may declare a catalog row (quality/structures.py) and its
        # pairs are then judged by THAT row's judge — a skothending by its
        # coda demand at its own anchors, alliteration at the head — never
        # by the scalar comparator, whose thresholds and admit set are
        # END-RHYME instruments. The import is paid only when a mandate
        # actually declares one: every mandate that never learned the
        # coordinate takes the byte-identical old path.
        _ST = None
        if getattr(m, "structures", ()) and any(m.structures):
            from quality import structures as _ST_mod
            _ST = _ST_mod
        # THE DECLARED RELATION, same lazy discipline: a mandate that never
        # learned the coordinate pays nothing and takes the byte-identical
        # old path. A NAMED relation costs one `classify_pair` per pair
        # (~1.3 ms, measured 2026-08-22); a coarse CLASS is answered from the
        # score that was computed anyway.
        #
        # THE GATE ASKS BOTH COORDINATES (2026-08-22, owner's instruction
        # "wire Mandate.relations as the default route"). It read
        # `m.relations` alone, and `Mandate.default_relation` — the SAME
        # declaration made once for the whole song instead of once per group
        # — left this None, so `want` was "" on every pair and a mandate
        # that declared its relation at the mandate level was graded by the
        # coarse `admit` set in silence. A declared coordinate read by
        # nothing is the defect this whole route exists to end, and shipping
        # the field without this line would have re-created it in the act of
        # closing it.
        _RT = None
        if ((getattr(m, "relations", ()) and any(m.relations))
                or getattr(m, "default_relation", "")):
            from quality import rhyme_types as _RT_mod
            _RT = _RT_mod

        # THE SCHEMA ROUTE (2026-08-22, owner ruling "everything in the
        # default"). A `schema:` relation is evaluated by
        # `relations.realise()` over the WHOLE DRAFT, so it is realised ONCE
        # here — where the lines are — and handed to the per-pair judge as a
        # set of line pairs. The alternative, calling `realise()` inside the
        # pair loop, would re-enumerate every span in the song for every
        # mandated pair.
        #
        # THE COST IS PAID ONLY BY A MANDATE THAT DECLARES ONE. `_schema_of`
        # returns "" for every class and named relation, so a mandate that
        # never says `schema:` does not import `relations`, does not build a
        # stream, and takes the byte-identical old path — the same lazy
        # discipline the structure and named-relation routes above take.
        _sch_pairs, _stream, _R_ref = {}, None, None

        def _grade_stream(_RRm):
            # ONE stream builder for BOTH schema routes — the declared route
            # below and the whole-vocabulary default fan after the pair loop
            # (owner ruling 2026-08-25, M-116). Two spellings of the stanza
            # derivation is how the two routes would drift (doctrine 1).
            return _RRm.build_stream(
                lines, _relation_phonology(),
                sections=sections,
                stanzas=_RRm.stanzas_from_sections(sections),
                stanza_source="declared_sections" if sections else "",
                declaration={"language": "eng"})
        if _RT is not None:
            _wants = {w for w in
                      (list(getattr(m, "relations", ()) or [])
                       + [getattr(m, "default_relation", "")]) if w}
            _schemas = [w for w in _wants if _schema_name_of(_RT, w)]
            if _schemas:
                from quality import relations as _R_mod
                # SECTIONS -> STANZAS, and the derivation is named rather
                # than implied. `build_stream` reads its stanza frame from
                # `stanzas=` (a per-line index), NOT from `sections=`, which
                # only labels units — measured: passing sections alone leaves
                # `supply('stanza')` at `absent`, source `none`. A contiguous
                # run of one declared section IS a stanza boundary, so the
                # index is derived from the runs and `stanza_source` says
                # `declared_sections` so the provenance survives into every
                # report (M-39: a declared list gets a source name, and the
                # name is what tells a reader this was not blank lines).
                _stream = _grade_stream(_R_mod)
                _R_ref = _R_mod
                # THE REFRAIN-TAIL FRAME, DERIVED FROM THE DECLARATION AND
                # NOT FROM A DEFAULT. `epistrophe / radif` and
                # `qafiya (before the radif)` refuse without
                # `frames.refrain_tail`, and `mark_refrain_tail` computes it
                # from the song — but its own docstring records that running
                # it with `lines=None` over a ghazal answers ZERO on 495 of
                # 495, because the fraction is taken over lines that never
                # carried the rhyme. `lines` is documented as "the declared
                # rhyme-bearing subset AS LINE INDICES", and a mandate is
                # exactly that subset, spelled by the writer. So it is passed
                # rather than defaulted: the union of the mandated groups,
                # 0-based. A mandate that declares no schema needing the
                # frame never calls this (doctrine 45 — the coordinate comes
                # from the declaration, not from the checker's guess).
                if any(c == "refrain_tail"
                       for w in _schemas
                       for c in _R_mod.REGISTRY[
                           _schema_name_of(_RT, w)].capabilities()):
                    _bearing = sorted({ln - 1 for g in m.groups for ln in g
                                       if 1 <= ln <= len(lines)})
                    if _bearing:
                        _R_mod.mark_refrain_tail(_stream, lines=_bearing)
                for w in _schemas:
                    _canon = _schema_name_of(_RT, w)
                    _sch_pairs[w] = _R_mod.line_pairs_for(
                        _R_mod.REGISTRY[_canon], _stream)
        # THE SLOT PATH, and it is entered only by a mandate that declares
        # one. `slots_declared()` is False for every mandate written before
        # the coordinate existed and for every ordinary end-rhyme mandate, so
        # those runs take the cached `matrix` exactly as they always have —
        # byte-identical, and cheaply, since the matrix is computed once per
        # draft while a slot pair is scored per pair.
        _slotted = m.slots_declared()
        for (i, j, k) in pairs:
            if (i, j, k) in refused:
                unknown.add((i, k))
                unknown.add((j, k))
                continue
            # WHERE THIS PAIR BINDS. Default slots read the precomputed
            # matrix; a declared slot is resolved and scored on its own span,
            # through the SAME comparator — `best_score` — so a mid-line or
            # line-initial binding is judged by the instrument the band was
            # calibrated on rather than by a second reading invented for it.
            slot_i = slot_j = None
            if _slotted:
                slot_i, slot_j = m.slot_of(k, i), m.slot_of(k, j)
            if slot_i is not None and not (_SL.is_default(slot_i)
                                           and _SL.is_default(slot_j)):
                s, ew_i, ew_j = self._slot_score(
                    lines, slot_i, slot_j, profile=profile)
            else:
                s = matrix[i - 1][j - 1]
                ew_i, ew_j = endwords[i - 1], endwords[j - 1]
            rel = s["relation"]
            why = None
            struct = m.structure_of(k) if _ST is not None else None
            want = m.relation_of(k) if _RT is not None else ""
            if rel == "REPEAT" and not (want and _schema_name_of(_RT, want)):
                # Identity is its own question under EVERY structure — the
                # returns/licence machinery owns it, and an identical word
                # trivially "satisfying" an alliteration demand is exactly
                # the laziness that machinery exists to adjudicate.
                # EXCEPT WHERE THE GROUP DECLARED A SCHEMA (M-124,
                # 2026-08-25): a `RelationSchema` carries its own
                # `IdentityRule`, which IS the declared identity ruling for
                # that group — anaphora's is token-AGREE, so identical bound
                # words are the requirement, not the laziness, and charging
                # REPEAT here made the grader refuse exactly what the
                # mandate asked for (one repository, two answers about one
                # pair — the M-59 shape at the identity coordinate). And a
                # Differ-identity schema judged on SEARCHED spans (internal
                # rhyme) reads nothing off the bound words at all, so the
                # pre-emption was answering a question the schema does not
                # ask there. The schema route below adjudicates identity on
                # the schema's own spans through `realise()`'s IdentityRule;
                # a BARE group and a class/type relation keep this branch
                # byte-identically (doctrine 3 stands: REPEAT is still not
                # rhyme where nothing declared otherwise).
                why = "REPEAT not rhyme (identical word)"
            elif want:
                # THE GROUP DECLARED WHAT RELATION IT WANTS. This is the
                # coordinate `admits()` could never carry: `admits()` is ONE
                # global set answering "what satisfies ANY mandate", so
                # widening it makes every requirement looser. Asked per
                # group, the same question is STRICTER — a group declaring
                # ASSONANCE is not satisfied by a perfect rhyme.
                #
                # POSITION IS DECLARED, NOT ASSUMED. 31 of the 49 named types
                # require one and `classify_pair` cannot know it (M-34).
                # ~~A mandate's groups are end-rhyme groups by construction,
                # so 'end' is the honest value here and is passed explicitly
                # — a checker picking it silently would be the bug (doctrine
                # 45), and it is exactly the wrong value for the internal,
                # head, leonine, cross and holorhyme relations, which this
                # path therefore cannot yet mandate.~~
                # SUPERSEDED 2026-08-23 (doctrine 17, the strike stays
                # visible): the first clause stopped being true when
                # `Mandate.loci` shipped, and the sentence's own second half
                # is the specification it was superseded by. A group's
                # members now DECLARE where they bind, so the position comes
                # from the declaration — `slots.position_of` — and 'end' is
                # what a default slot resolves to rather than what every
                # group is assumed to be. The head, internal and cross
                # relations this comment named as unreachable are reachable
                # by declaring the placement their own definitions require.
                # M-148 (P2): A SCHEMA RELATION AT A DECLARED SLOT IS JUDGED
                # AT THE DECLARED TOKENS. The instances route below hands the
                # judge `line_pairs_for`'s answer, and `realise()` enumerates
                # spans at the schema's OWN loci — measured (M-148 E2), the
                # CLASS route reads a `1.T2`-to-`2.end` binding correctly
                # while the schema route judged placements the writer never
                # declared. `relations.pair_satisfies` keeps the schema's own
                # anchors, channels and identity rules and takes only WHICH
                # word from the slot; a default-slot mandate keeps the
                # instances route, whose loci for an end-anchored schema ARE
                # the declared placement.
                _sch_name = _schema_name_of(_RT, want)
                _via_pair = bool(
                    _sch_name and _stream is not None and slot_i is not None
                    and not (_SL.is_default(slot_i)
                             and _SL.is_default(slot_j)))
                if _via_pair:
                    _ti = _SL.token_of(slot_i)
                    _tj = _SL.token_of(slot_j)
                    if _ti is None or _tj is None:
                        refusals.append({
                            "lines": (i, j),
                            "endwords": (ew_i, ew_j),
                            "unreadable": [],
                            "groups": [m.labels[k]],
                            "reason": (f"the declared relation {want!r} is a "
                                       f"schema and a member's slot binds no "
                                       f"single token (a whole-line slot), "
                                       f"so the declared-token route cannot "
                                       f"bind it — REFUSED, not failed "
                                       f"(doctrine 79)")})
                        refused.add((i, j, k))
                        unknown.add((i, k))
                        unknown.add((j, k))
                        continue
                    _out = _R_ref.pair_satisfies(
                        _R_ref.REGISTRY[_sch_name], _stream,
                        (i - 1, _ti), (j - 1, _tj))
                    if isinstance(_out, _R_ref.Refusal):
                        refusals.append({
                            "lines": (i, j),
                            "endwords": (ew_i, ew_j),
                            "unreadable": [],
                            "groups": [m.labels[k]],
                            "reason": (f"the declared relation {want!r} "
                                       f"cannot be judged at the declared "
                                       f"tokens: {_out.detail} — REFUSED, "
                                       f"not failed (doctrine 79)")})
                        refused.add((i, j, k))
                        unknown.add((i, k))
                        unknown.add((j, k))
                        continue
                    ok = _out
                else:
                    try:
                        ok = _RT.satisfies_relation(
                            want, rel, ew_i, ew_j,
                            _relation_phonology(),
                            position=_SL.position_of(slot_i or i),
                            lines=(i, j), instances=_sch_pairs.get(want))
                    except _RT.RelationRefused as e:
                        refusals.append({
                            "lines": (i, j),
                            "endwords": (ew_i, ew_j),
                            "unreadable": [],
                            "groups": [m.labels[k]],
                            "reason": (f"the declared relation {want!r} "
                                       f"cannot be judged here: {e} — "
                                       f"REFUSED, not failed "
                                       f"(doctrine 79)")})
                        refused.add((i, j, k))
                        unknown.add((i, k))
                        unknown.add((j, k))
                        continue
                if ok is None:
                    # The phonology could not read a member, or the
                    # classification is indeterminate. A refusal, never a no
                    # — reading it as a failure charges the writer for a word
                    # the engine cannot pronounce (doctrine 79).
                    refusals.append({
                        "lines": (i, j),
                        "endwords": (ew_i, ew_j),
                        "unreadable": [],
                        "groups": [m.labels[k]],
                        "reason": (f"the declared relation {want!r} has no "
                                   f"coordinates in this pair (a member the "
                                   f"phonology refuses, or an indeterminate "
                                   f"classification) — REFUSED, not failed "
                                   f"(doctrine 79)")})
                    refused.add((i, j, k))
                    unknown.add((i, k))
                    unknown.add((j, k))
                    continue
                if not ok:
                    why = (f"does not satisfy the declared relation {want!r} "
                           + (f"— judged by the schema's own channels at the "
                              f"DECLARED tokens "
                              f"(relations.pair_satisfies), not at the "
                              f"schema's own loci"
                              if _via_pair else
                              f"— judged by the named-type engine at that "
                              f"relation's own coordinate, not by the scalar "
                              f"comparator's admit set"))
            elif _ST is not None and struct != _ST.DEFAULT:
                sv = _ST.judge(struct, ew_i, ew_j)
                if sv is None:
                    refusals.append({
                        "lines": (i, j),
                        "endwords": (ew_i, ew_j),
                        "unreadable": [],
                        # The scalar refusals get their "groups" annotated
                        # in one pass above, BEFORE this loop runs — a
                        # record minted here must carry its own or the
                        # SCHEME_UNREADABLE renderer KeyErrors. This one
                        # names group k alone, deliberately: the refusal
                        # is about THIS group's declared structure, not
                        # about every group the pair happens to share.
                        "groups": [m.labels[k]],
                        "reason": (f"the declared structure {struct!r} has "
                                   f"no coordinates in this pair (a "
                                   f"refused anchor or an unreadable "
                                   f"member) — REFUSED, not failed "
                                   f"(doctrine 79)")})
                    refused.add((i, j, k))
                    unknown.add((i, k))
                    unknown.add((j, k))
                    continue
                if not sv:
                    why = (f"does not satisfy the declared structure "
                           f"{struct!r} — judged by the catalog's own "
                           f"{_ST.get(struct).kind} judge at that "
                           f"structure's anchors, not by the scalar "
                           f"comparator")
            elif rel in NEAR_RELATIONS and rel not in self.decl.admit:
                # An ADMITTED near relation falls through to `admits()` and
                # satisfies on its scalar — `Declaration.admit`, the owner's
                # declared widening. Undeclared, this branch is byte-for-byte
                # the old one.
                why = (f"{rel} not rhyme (conjunctive band; not in the "
                       f"declared admit set)")
            elif rel == NO_ANCHOR:
                why = "NO_ANCHOR: nothing to compare (not a rhyme verdict)"
            elif s["total"] < theta_for(s, self.decl):
                # PER RELATION SINCE 2026-09-02 (`MISSING.md` M-138, priced).
                # `check_scheme` is the other reader of this same chain and
                # its own comment says the two must move together; they do
                # here, in one commit, phrased the same way.
                _th = theta_for(s, self.decl)
                why = (f"below theta_rhyme={self.decl.theta_rhyme}"
                       if _th == self.decl.theta_rhyme else
                       f"below theta({rel})={_th} "
                       f"(theta_rhyme={self.decl.theta_rhyme}; the near "
                       f"relations carry their own priced cut, M-138)")
            elif not admits(s, theta_for(s, self.decl),
                            relations=frozenset(self.decl.admit)):
                # NO_RELATION FELL THROUGH ALL FOUR BRANCHES — FIXED
                # 2026-08-15. The chain above is an ENUMERATED blacklist, and
                # `NO_RELATION` — the band's STRONGEST rejection, set when
                # NEITHER channel agrees — is in none of its sets: it is not
                # REPEAT, not in `NEAR_RELATIONS` (which is only ASSONANCE and
                # CONSONANCE), not `NO_ANCHOR`, and its scalar can sit ABOVE
                # `theta_rhyme` because the scalar is a weighted channel mean
                # and the conjunctive band is a separate predicate. So a
                # mandated pair the band flatly refuses came back `why=None`,
                # which is the same value a clean rhyme returns.
                #
                # MEASURED at a3536ce: `debenture`/`thermco`, total 0.788
                # against theta 0.75, flags "conjunctive band: neither channel
                # agrees" — and `brief FILE --groups=1,2` on those two lines
                # reported `0 FLAG` and `nothing on any line carries a flag`.
                #
                # THE FIX IS TO END THE CHAIN POSITIVELY rather than to add
                # `NO_RELATION` to a set. An enumerated blacklist is wrong in
                # the same way every time a new relation is named — this asks
                # `admits()`, the ONE predicate `grade()` is supposed to agree
                # with, so a relation added tomorrow is refused by default
                # instead of admitted by omission. The four branches above are
                # untouched and still own their own messages, so nothing that
                # was already reported changes wording (doctrine 1).
                why = f"{rel} not rhyme (conjunctive band)"
            verdicts.append({"lines": (i, j), "group": k,
                             "label": m.labels[k],
                             "members": list(m.groups[k]),
                             "endwords": (ew_i, ew_j),
                             "score": s["total"], "relation": rel,
                             # BACKLOG 1.2 — "" unless the two end words this
                             # verdict names are NOT what produced the score.
                             "attribution": self._attribution(
                                 s, ew_i, ew_j),
                             # WHICH JUDGE ANSWERED. A catalog row name when
                             # the mandate declared the coordinate (the
                             # DEFAULT name for its undeclared groups), and
                             # None when the mandate never learned it at all
                             # — in which case the catalog default applies BY
                             # DEFINITION, and the default's spelling is not
                             # repeated here because `structures.DEFAULT` is
                             # its one statement (doctrine 1) and paying the
                             # catalog import on every structureless grade()
                             # is what the lazy gate above exists to avoid.
                             "structure": struct,
                             # THE COMPARATOR'S OWN DISCLOSURES, CARRIED
                             # (2026-09-02, E-5 / M-136): `score()` says
                             # on its flags what it never asked or could
                             # not hear (`identity: not asked`,
                             # `conjunctive band: off`, `coda: no
                             # evidence`), and a verdict that dropped them
                             # read exactly like one with nothing to say.
                             # A copy of the record, gating nothing.
                             "flags": list(s.get("flags") or []),
                             "why": why})

        # Doctrine 3, resolved PER PAIR by the mandate's own declaration
        # first, and by the song-wide `repeat_licence` switch only where the
        # mandate does not decide. A `Return` object says, per pair, whether
        # an identical word there is REQUIRED (a verbatim return), LICENSED
        # (a declared-but-not-verbatim return), or neither -- and a pair the
        # mandate never put in a `Return` at all (a plain letter scheme, or
        # a `Cover` with no returns) is UNDECLARED for this question on every
        # pair, which is exactly the switch's old blanket behaviour and
        # keeps every caller that never declared a return unaffected.
        # BEFORE THIS FIX: the switch applied to every REPEAT in the song at
        # once, so a declared VERBATIM return -- required to repeat by the
        # mandate itself -- was flagged as a violation under the default
        # "unlicensed" setting, and `revise_loop` would then try to "fix" a
        # refrain that was already correct.
        # ALL 77 SCHEMAS ARE IN THE DEFAULT — 2026-08-25, OWNER RULING, the
        # second half of the instruction whose first half widened the admit
        # set to all four classes on 2026-08-22 (`MISSING.md` M-116, task
        # #86). A mandated pair that declared NO relation and NO structure is
        # satisfied when its two lines stand in ANY schema the vocabulary
        # names, judged by the SAME instrument the declared route uses —
        # `relations.line_pairs_for` over one shared stream — so there is no
        # second judge to drift from (doctrine 1). Declaring a relation
        # remains the NARROWING move and is untouched: a group that says
        # `class:ASSONANCE` or `schema:pararhyme` is satisfied by exactly
        # that. REPEAT is excluded — identity has its own licence machinery
        # (doctrine 3) and this ruling is about rhyme relations. LAZY: a
        # draft whose every undeclared pair already satisfies the scalar
        # door pays nothing — no import, no stream, no realise. LAZINESS AT
        # THESE RELATIONS IS UNCALIBRATED: a rescue records WHICH schemas
        # answered (`satisfied_by`), because a pass under a relation with no
        # measured modal regime must be tellable from a calibrated pass
        # (the `STRUCTURE_UNCALIBRATED` contract, one layer over).
        # ...AND ONLY UNDER THE DEFAULT DOOR (2026-08-25): a caller who
        # NARROWED `Declaration.admit` has declared what satisfies them,
        # and the rescue does not override a declaration.
        # `lyric_harness.admit_is_default` is the one definition of this
        # gate, shared with `check_scheme` (doctrine 1) -- and it is read
        # through `self.schema_route_open` since 2026-08-26.
        # THE GROUP-LEVEL GATE IS `self.schema_route_open` AND NOTHING ELSE
        # (`MISSING.md` M-139). It was spelled inline here -- the admit gate,
        # the group's declared relation and the group's structure, three
        # conditions -- and `brief()` had to answer the SAME question to
        # disclose that the candidate field skips this route. Two spellings
        # of one gate is the drift `_field`'s own docstring is named after,
        # so the import moved into the method with the gate.
        _fan = [v for v in verdicts
                if v["why"] and v["relation"] != "REPEAT"
                and self.schema_route_open(m, v["group"])]
        if _fan:
            from quality import relations as _RF
            # ONE JUDGE FOR BOTH READERS: `relations.whole_vocabulary_pairs`
            # is the same call `lyric_harness.check_scheme` makes, so the
            # two graders cannot drift about which pair the default
            # satisfies (doctrine 1).
            _wvp = _RF.whole_vocabulary_pairs(
                lines, _relation_phonology(), sections=sections,
                bearing={ln - 1 for g in m.groups for ln in g
                         if 1 <= ln <= len(lines)})
            for v in _fan:
                _hit = _wvp.get(tuple(sorted(v["lines"])))
                if _hit:
                    v["why"] = None
                    v["satisfied_by"] = sorted(_hit)

        default_licensed = self.rdecl.repeat_licence == "refrain"
        violations = []
        for v in verdicts:
            if not v["why"]:
                continue
            if v["relation"] == "REPEAT":
                i, j = v["lines"]
                # GATED ON THE MANDATE HAVING DECLARED ANY RETURN AT ALL --
                # fixed 2026-08-13, and the comment below was already claiming
                # this. A mandated pair under a plain LETTER scheme is
                # REQUIRE_RHYME, whose declared=True/violation=True means
                # decided() answers before the fallback is ever consulted, so
                # `repeat_licence="refrain"` was INERT on every letter scheme:
                # measured on AABB with two identical-word pairs, "refrain"
                # used to LICENSE the repeat and had come to charge it.
                # A letter cannot STATE this question -- two states for a
                # question with five answers -- so REQUIRE_RHYME's True there
                # is schemes.py's DEFAULT, not the writer's declaration, and
                # doctrine 1 says a declared coordinate is not silently
                # outranked by another layer's default. NOT fixed by weakening
                # REQUIRE_RHYME: that value is doctrine 3 and three sections of
                # quality/test_mandate_language.py rest on it.
                declared, is_violation = (
                    (False, None) if not m.returns
                    else m.requirement(i, j).decided("repeat_is_violation"))
                if not (is_violation if declared else not default_licensed):
                    continue
            violations.append(v)
        repeats = [v for v in verdicts if v["relation"] == "REPEAT"]

        # The DISJUNCTIVE reading, kept reachable so the default is a measured
        # choice. THE CONDITION IS PER LINE, and it is stated per line in
        # every place this repo writes it down: `ReviseDeclaration.
        # overlap_rule` ("a line in k groups must answer ALL k" /
        # "answering one of them excuses the rest") and `quality/schemes.py`'s
        # own argument for the default ("adding a group to a cover can only
        # ever give an OVERLAPPING LINE another way to be excused"). So a line
        # is excused from group k exactly when it belongs to another group it
        # ANSWERS -- every one of its own pairs there judged and passing.
        #
        # A PAIR IS THE REPORTING SHAPE, NOT THE OBLIGATION, and reading it as
        # the obligation was the defect here until 2026-08-13: the excusal
        # fired when EITHER endpoint had another satisfied group, so a line in
        # exactly ONE group -- with no other group to answer and no "rest" to
        # be excused from -- had its ONLY mandated obligation dropped because
        # its PARTNER happened to be a pivot. That line then answered nothing
        # at all and the loop said so nowhere: doctrine 20's vacuous pass, one
        # level down, inside the module written to close it. Both endpoints
        # must be excused, because a violation on (i, j) in group k is the only
        # evidence either line failed k.
        excused = []
        if self.rdecl.overlap_rule == "disjunctive":
            # WHETHER A **LINE** ANSWERS A **GROUP**, per (line, group). The
            # old rule read `satisfied[k]` -- one boolean per GROUP -- and a
            # group-wide flag cannot state a per-line fact: a pivot that
            # rhymes with every other member of group k has ANSWERED k even
            # when two OTHER members of k fail each other, and the flag said
            # it had not. Read off `violations` rather than off the raw `why`
            # for the same reason `violations` exists: a REPEAT the MANDATE
            # requires is the form and not a failure, so it must not count
            # against the line that carries it (doctrine 3, per pair).
            unanswered = set()
            for v in violations:
                unanswered.add((v["lines"][0], v["group"]))
                unanswered.add((v["lines"][1], v["group"]))

            def answers_another(ln, k):
                """-> the OTHER groups of `ln` that `ln` answers in full."""
                return [k2 for k2 in m.groups_of(ln)
                        if k2 != k and (ln, k2) not in unanswered
                        and (ln, k2) not in unknown]

            keep = []
            for v in violations:
                i, j = v["lines"]
                by_i = answers_another(i, v["group"])
                by_j = answers_another(j, v["group"])
                if by_i and by_j:
                    v = dict(v)
                    # WHICH line was excused BY WHICH group. The finding used
                    # to say only that the pair "was excused", which names
                    # neither -- and on an overlapping cover the whole point
                    # is that a line has more than one group to be talked
                    # about (doctrine 2).
                    v["excused_by"] = {ln: [m.labels[k2] for k2 in got]
                                       for ln, got in ((i, by_i), (j, by_j))}
                    excused.append(v)
                else:
                    keep.append(v)
            violations = keep

        # A pair that band-passes while sharing NO group. Under a letter
        # scheme this was "unintended rhyme across scheme letters"; under a
        # cover it is the same statement without the letters.
        #
        # AND SINCE 2026-08-13 IT ASKS WHETHER THE MANDATE SPEAKS ABOUT THE
        # PAIR AT ALL. "Shares no mandated group" is a statement the mandate
        # can only make about lines it REACHES: `Mandate.scope` declares which
        # those are, and `Mandate.requirement` answers `UNDECLARED` — 'cannot
        # tell' — for a pair touching a line outside it, which is a DIFFERENT
        # answer from `FREE`'s 'nothing required here' (doctrine 28). This loop
        # never asked, so on this repo's own 41-line fixture scoped to its
        # chorus, 49 of 73 collisions were reported against a mandate that says
        # it does not speak about them, and the rendered finding called those
        # lines `free` — the one word doctrine 28 exists to keep separate.
        # MEASURED: `inspect()` on that fixture was BYTE-IDENTICAL scope-on and
        # scope-off, same 73 collisions, same 97 per-line findings.
        #
        # THE SET DOES NOT CHANGE, the LABEL does (doctrine 24: relabel, never
        # delete). Suppressing the 49 would make a scoped run indistinguishable
        # from one where those pairs were checked and came back clean, which is
        # doctrine 20's collapse pointed the other way — and an unmandated
        # rhyme is quite often the best thing in a song, so deleting the report
        # costs the writer a real sonic event to spare them a mislabel. See
        # `inspect()` for what the fourth code says.
        #
        # GATED ON `scope` BEING DECLARED AT ALL, the same shape the repeat
        # licence above is gated on `m.returns`, and for two reasons that are
        # both load-bearing: `UNDECLARED` is reachable through scope and
        # nothing else (`quality/test_mandate_language.py` §11 pins that), so
        # the gate cannot change an answer; and every production mandate has an
        # empty scope, so the default path runs the identical code it ran
        # before rather than a new branch measured to agree with it.
        # ============================================================
        # THE COLLISION CUT IS THE SCALAR ALONE, AND IT MUST STAY THAT
        # WAY. VERDICT RECORDED 2026-08-16, MEASURED, NOT ARGUED.
        # ============================================================
        # `COLLISION_CUT_IS_SCALAR_ONLY` (below, in `inspect()`) says this
        # cut and `grade()`'s ask "different questions about the same
        # pair" and calls that "the defect ... surviving here". Read
        # quickly, that is an invitation to unify them — to make this line
        # `s["total"] >= THETA_COLLISION and admits(s, THETA_COLLISION)`,
        # matching what `grade()` accepts. DO NOT. The disclosure is
        # naming a difference that is CORRECT and deliberate; it is not a
        # TODO. The unification was built on a symlinked copy of the tree
        # and measured, and it costs two things, neither recoverable:
        #
        # (1) `NEAR_COLLISION` BECOMES UNREACHABLE. `admits()` requires a
        #     relation in `RHYME_RELATIONS`, so a pair that is not a rhyme
        #     could never enter this set, and `_collision_code` would only
        #     ever return `SCHEME_COLLISION`. MEASURED on a four-line
        #     fixture whose cross pairs are `wall`~`floor` at 0.996
        #     ASSONANCE: per-line findings went from
        #     `{2:[MODAL_RHYME], 3:[NEAR_COLLISION x2], 4:[MODAL_RHYME,
        #     NEAR_COLLISION x2]}` to `{2:[MODAL_RHYME],
        #     4:[MODAL_RHYME]}` — four findings deleted and the 0.996
        #     pair reported NOWHERE. Doctrine 24: a rule that would delete
        #     a category must relabel instead. An assonance running across
        #     a song is a real sonic event.
        #
        # (2) THE REFRAIN MERGE SILENTLY STOPS FIRING, on exactly the case
        #     it exists for. `group_merges` condition (a) requires every
        #     cross edge to be IN this set and then separately allows
        #     `admits(...) or relation == "REPEAT"` — so it is BUILT to
        #     accept REPEAT edges, and REPEAT is precisely what `admits()`
        #     rejects. MEASURED on a 4-line refrain (two lines returning
        #     verbatim, mandate `[[1,2],[3,4]]`): HEAD reports 4
        #     collisions — `(1,3) REPEAT`, `(1,4) RHYME`, `(2,3) RHYME`,
        #     `(2,4) REPEAT` — and fires `MANDATE_GROUPS_INDISTINGUISHABLE`;
        #     the patched tree reports 2 and the finding is GONE. A
        #     refrain-detection feature disabled by a change to a
        #     threshold two functions away, with no error anywhere.
        #
        # THE TEST CHURN IS NOT THE COST AND WAS THE ONLY THING THAT LOOKED
        # LIKE ONE. `quality/test_revise.py` goes 280 PASS / 0 FAIL ->
        # 265 / 15, all in one file, and `test_loop.py`, `test_coda.py` and
        # `test_mandate_language.py` do not move. 15 cheap checks is what a
        # deliberate change should cost; the two deletions above are what it
        # actually costs. The failing checks say so in their own names --
        # "some of them are outright REPEAT, the refrain itself" and "a
        # near-relation is no longer reported as an unintended RHYME".
        #
        # WHAT THE TWO CUTS SHARE IS THE CONSTANT, NOT THE PREDICATE:
        # `THETA_COLLISION` is imported from `lyric_harness` rather than
        # re-declared (that is the 2026-08-16 fix), so the two cannot drift
        # on the NUMBER while staying free to differ on the QUESTION.
        collisions = []
        n = len(lines)
        scoped = bool(getattr(m, "scope", ()))
        for i in range(n):
            for j in range(i + 1, n):
                if set(m.groups_of(i + 1)) & set(m.groups_of(j + 1)):
                    continue
                s = matrix[i][j]
                if s["total"] >= THETA_COLLISION:
                    # The CLASSIFICATION comes from `requirement()` — the
                    # mandate's own five-value answer, so this loop and the
                    # grader cannot drift about what UNDECLARED means. The
                    # DETAIL (which endpoint is outside) comes from
                    # `in_scope()`, because a writer told "the mandate does not
                    # speak about this pair" is owed which half of it.
                    und = scoped and m.requirement(i + 1,
                                                   j + 1) is SC.UNDECLARED
                    collisions.append({
                        "lines": (i + 1, j + 1),
                        "endwords": (endwords[i], endwords[j]),
                        "score": s["total"], "relation": s["relation"],
                        # BACKLOG 1.2, the same gate as `verdicts` above: a
                        # collision is reported as two end words and a
                        # number, and a near-relation collision is exactly
                        # where an interior reach is likeliest to be what
                        # scored.
                        "attribution": self._attribution(
                            s, endwords[i], endwords[j]),
                        "undeclared": bool(und),
                        "undeclared_lines": (
                            [ln for ln in (i + 1, j + 1)
                             if not m.in_scope(ln)] if und else [])})
        return {"mandate": m, "endwords": endwords, "readability": records,
                "verdicts": verdicts, "violations": violations,
                "repeats": repeats, "excused": excused,
                "refusals": refusals, "collisions": collisions,
                # M-149(b): THE COUNTS READ THE TRIPLE SET, NOT THE RECORD
                # LIST. A record exists for rendering and can cover several
                # groups (the scalar end-word case) or share a triple with a
                # sibling cause; the (pair, group) triples are what the loop
                # actually skipped, so they are the only honest denominator
                # complement — `mandated = judged + refused` holds by
                # construction instead of by coincidence.
                "pairs_mandated": len(pairs),
                "pairs_refused": len(refused),
                "pairs_judged": len(pairs) - len(refused),
                # THE WHOLE-VOCABULARY DEFAULT'S OWN COUNT (M-116): pairs the
                # scalar door failed and a schema satisfied, with the names.
                # Not summed into any other count (doctrine 79) — a schema
                # pass is a pass, and this key is what makes it TELLABLE.
                "pairs_schema_satisfied": [
                    {"lines": v["lines"], "label": v["label"],
                     "satisfied_by": v["satisfied_by"]}
                    for v in verdicts if v.get("satisfied_by")]}

    # -- the collision set, partitioned -----------------------------------

    def _declared_return(self, m, a, b):
        """Does the MANDATE ITSELF say groups `a` and `b` are one section
        coming back? -> (bool, how it was learnt).

        IT READS `Mandate.returns`, WHICH IS THE SIBLING CONTRACT AND NOT ONE
        THIS MODULE INVENTED. A return class is a set of line numbers that are
        THE SAME LINE — `quality/schemes.py`'s generalisation of
        `RefrainScheme.refrains` off a single line class. Two groups are one
        section coming back exactly when return classes LINK them: some member
        of `a` is the same line as some member of `b`. On this song's chorus
        that is L13=L33 and L17=L37, and it is the fact no letter scheme can
        hold.

        WHY IT ASKS AT ALL, rather than deciding. Whether a wholesale
        collision between two groups is a REFRAIN is a fact about the song's
        FORM, and the graph cannot know it: a section returning and a rhyme
        sound reused by accident are the same picture in a score. So when the
        mandate states it the finding says DECLARED and stops being an
        accusation; when it does not, the merge is DERIVED from the graph and
        the finding NAMES BOTH READINGS and asks. A harness that guessed
        "refrain" because two groups rhyme would be reading intent out of a
        number, which is the one thing this project refuses to do.

        A `Mandate` with no `returns` — every mandate written before the
        coordinate existed — is read exactly as it was, and the older
        duck-typed shapes are still accepted so this does not become a second
        place where the two modules can disagree about a name.
        """
        ga, gb = set(m.groups[a]), set(m.groups[b])
        classes = getattr(m, "returns", None)
        if classes and not callable(classes):
            linked = []
            for cls in classes:
                s = set(cls)
                if s & ga and s & gb:
                    linked.append(sorted(s))
            if linked:
                return True, (f"the mandate's own return class(es) "
                              f"{linked} — lines the mandate says are THE "
                              f"SAME LINE, linking the two groups")
        elif callable(classes):                  # older shape: returns(a, b)
            try:
                if classes(a, b) or classes(b, a):
                    return True, "the mandate's own `returns(a, b)`"
            except Exception:                    # a mandate that cannot say
                pass                             # is a mandate that does not
        pairs = getattr(m, "group_returns", None)
        if pairs:
            try:
                want = {(a, b), (b, a)}
                if any(tuple(p) in want for p in pairs):
                    return True, "the mandate's own `group_returns`"
            except TypeError:
                pass
        return False, ""

    def group_merges(self, lines, mandate=None, profile=None):
        """-> [merge], the group pairs the MANDATE splits and the GRAPH does
        not. A statement about the mandate, never about a line.

        A merge is reported for two DISJOINT mandated groups X and Y when

          (a) every cross pair (x, y) is already a COLLISION — it clears
              `THETA_COLLISION` and shares no group — and
          (b) every cross pair would SATISFY the mandate: `admits()` or
              REPEAT, which is exactly what `grade()` requires of a mandated
              pair.

        Together those say something a reader can check in one step: *merge
        these two groups into one and the mandate still holds.* (a) is what
        keeps the rule honest — the merge only ever re-describes findings the
        loop was already emitting, so turning it on cannot make the loop
        speak about a pair it was silent on.

        WHY THIS IS THE SHAPE. Doctrine 2: the graph is the object and a
        letter scheme is a lossy projection. A letter is a property of a
        LINE, so a scheme cannot say "these two groups are the same words
        coming back" — it is FORCED to spend two letters on one returning
        section, and the collision detector then reports, as unintended rhyme
        across groups, the identity the projection was forced to hide: one
        true sentence about the mandate, rendered as an accusation against
        an innocent line.

        AND IT DOES NOT DECIDE WHETHER THE RETURN WAS INTENDED. Two groups
        being indistinguishable in the graph is compatible with a refrain and
        with an accidentally reused rhyme sound, and nothing in a score
        separates them. So the finding names the alternative and stops. When
        the mandate can state the return itself (`_declared_return`), the
        finding says the licence was DECLARED — the shape `REFRAIN_REPEAT`
        already uses, and doctrine 18's requirement that a licence granted by
        pattern be earned rather than assumed.
        """
        m = self.mandate(lines, mandate)
        if self.rdecl.group_merge == "off":
            return []
        if self.rdecl.group_merge != "report":
            raise ValueError(
                f"ReviseDeclaration.group_merge must be 'report' or 'off', "
                f"got {self.rdecl.group_merge!r}")
        rep = self.grade(lines, m, profile=profile)
        _, endwords, _, matrix = self._matrix(lines, profile=profile)
        edges = {tuple(c["lines"]) for c in rep["collisions"]}
        th = self.decl.theta_rhyme
        out = []
        for a in range(len(m.groups)):
            for b in range(a + 1, len(m.groups)):
                ga, gb = m.groups[a], m.groups[b]
                if set(ga) & set(gb):
                    continue
                cross = sorted({(min(i, j), max(i, j))
                                for i in ga for j in gb})
                if not cross:
                    continue
                # CONDITION (a) AND CONDITION (b), SEPARATED — 2026-08-26
                # (`MISSING.md` M-139). They used to be one `or` and one
                # `break`, which made the SCHEMA half of the default
                # unaskable here: (b) asked `decl.admit` alone, four
                # relations, while `grade()` accepts on those OR on any of
                # the 77 schemas since M-116.
                #
                # (a) IS THE CHEAP ONE AND IT IS CHECKED FIRST. A pair that
                # is not a collision fails outright and no rescue applies --
                # the merge only ever re-describes findings the loop was
                # already emitting, which is the honesty argument this
                # method's docstring makes.
                #
                # THE 77 ARE ASKED ONLY FOR (b)'s SURVIVORS, and MEASURED
                # that is almost never: over 400,000 random CMUdict pairs
                # (seed 20260810) 2,576 clear `THETA_COLLISION`, and of
                # those exactly **2 (0.08%)** type NO_RELATION -- which is
                # the ONLY way (b) can fail once (a) holds, since all four
                # named relations are in `decl.admit` and REPEAT is allowed
                # explicitly. So the stream is built for a branch that fires
                # on roughly one collision pair in twelve hundred, and
                # `inspect()` -- which calls this every round of the loop --
                # pays nothing on a draft that never reaches it.
                ok, unresolved = True, []
                for i, j in cross:
                    s = matrix[i - 1][j - 1]
                    if (i, j) not in edges:
                        ok = False          # (a) fails: not a collision
                        break
                    if not (admits(s, th,
                                   relations=frozenset(self.decl.admit))
                            or s["relation"] == "REPEAT"):
                        unresolved.append((i, j))
                if not ok:
                    continue
                if unresolved and not self._schema_satisfies(
                        lines, m, unresolved):
                    continue
                declared, how = self._declared_return(m, a, b)
                out.append({
                    "groups": (a, b),
                    "labels": (m.labels[a], m.labels[b]),
                    "members": (list(ga), list(gb)),
                    "lines": sorted(set(ga) | set(gb)),
                    "edges": [(i, j, matrix[i - 1][j - 1]["total"],
                               matrix[i - 1][j - 1]["relation"],
                               endwords[i - 1], endwords[j - 1])
                              for i, j in cross],
                    "declared": declared,
                    "how": how or ("derived from the rhyme graph; the mandate "
                                   "cannot state a return")})
        return out

    def _schema_satisfies(self, lines, m, pairs):
        """Do ALL these mandated line pairs stand in some registered schema?

        THE 77-SCHEMA HALF OF THE DEFAULT (owner ruling 2026-08-25, M-116),
        reached from `group_merges` since 2026-08-26 (`MISSING.md` M-139).
        `relations.whole_vocabulary_pairs` is the ONE judge both graders
        already consult, so this cannot become a third opinion about which
        pair the default satisfies (doctrine 1) -- it is the same call
        `grade()` and `lyric_harness.check_scheme` make, with the same
        `bearing` derived from the mandate's own groups.

        MEMOISED PER (draft, mandate). The stream costs 2.94s over 14 lines
        and 14.73s over 56, and a draft can offer several candidate merges;
        building one stream per candidate would multiply a rare cost by the
        square of the group count. Keyed on the draft's identity and the
        mandate's groups because those are what the answer depends on.

        AND ONLY UNDER THE DEFAULT DOOR, the same gate `grade()` uses: a
        caller who NARROWED `Declaration.admit` has declared what satisfies
        them, and the rescue does not override a declaration.
        `lyric_harness.admit_is_default` is the one definition.
        """
        from lyric_harness import admit_is_default as _AID
        if not _AID(self.decl):
            return False
        key = (id(lines), len(lines),
               tuple(tuple(g) for g in getattr(m, "groups", ())))
        hit = getattr(self, "_wvp_cache", None)
        if hit is None:
            hit = self._wvp_cache = {}
        if key not in hit:
            from quality import relations as _RF
            if len(hit) > 8:
                hit.clear()
            hit[key] = _RF.whole_vocabulary_pairs(
                lines, _relation_phonology(),
                bearing={ln - 1 for g in getattr(m, "groups", ())
                         for ln in g if 1 <= ln <= len(lines)})
        wvp = hit[key]
        return all(tuple(sorted(p)) in wvp for p in pairs)

    @staticmethod
    def _collision_code(relation, undeclared=False):
        """One code per RELATION, because they are three different reports.

        `SCHEME_COLLISION`      the pair is a rhyme the mandate did not ask
                                for. The only one of the three the old single
                                code was ever right about.
        `NEAR_COLLISION`        the scalar clears `THETA_COLLISION` and the
                                relation is NOT a rhyme, so this module's own
                                `grade()` would call it a VIOLATION if the
                                pair were mandated. Calling it an unintended
                                RHYME is the brief and the verdict asking
                                different questions
                                (`RESULTS_REVISION_LOOP.md` §1) surviving in
                                a second place.

                                STATED AS THE FALL-THROUGH IT IS, REPINNED
                                2026-08-16 from ~~"the relation is ASSONANCE
                                or CONSONANCE"~~. This is the `return` under
                                every other branch, so it takes the COMPLEMENT
                                of `RHYME_RELATIONS | {REPEAT}` -- today
                                ASSONANCE, CONSONANCE **and `NO_RELATION`**,
                                plus any relation a later lot adds. Naming two
                                members of an open set is the exact shape that
                                cost this file `grade()`'s NO_RELATION bug
                                (fixed 2026-08-15, see the comment there): an
                                ENUMERATION written where a RULE was meant,
                                and the band's strongest rejection falling
                                through every name in it. The enumeration in
                                the gloss outlived the enumeration in the
                                code by a day.

                                `NO_ANCHOR` routes here too and is
                                UNREACHABLE IN PRACTICE, by measurement and
                                not by construction: an unanchored pair scores
                                `total` **0.0**, so it cannot clear a cut of
                                0.9. That is a fact about the SCORER, not
                                about this function -- if a later lot ever
                                gives an unreadable pair a non-zero scalar,
                                "nothing to compare" starts being reported as
                                a near-collision with no branch changed here.
        `REPEAT_ACROSS_GROUPS`  the same word twice. Doctrine 3's first
                                sentence: identity is not rhyme.

        AND ONE THAT IS NOT A RELATION AT ALL, which is why it is a parameter
        and not a fourth branch of the same `if`:

        `COLLISION_UNDECLARED`  `Mandate.requirement` answers `UNDECLARED` for
                                this pair — the mandate's `scope` does not
                                reach one of its lines. It OUTRANKS the
                                relation, because the other three each say
                                what an ANSWERED question answered, and this
                                one says the question was never asked
                                (doctrine 20). The relation is not lost: the
                                finding names the code this pair WOULD have
                                carried, which is this same function called
                                without the flag.

        `undeclared` defaults False, so every existing caller — including
        `quality/test_revise.py` test 23, which calls this with one positional
        argument — reads exactly as it did.
        """
        if undeclared:
            return "COLLISION_UNDECLARED"
        if relation in RHYME_RELATIONS:
            return "SCHEME_COLLISION"
        if relation == "REPEAT":
            return "REPEAT_ACROSS_GROUPS"
        return "NEAR_COLLISION"

    # -- meter --------------------------------------------------------------

    def _meter_findings(self, lines, blueprint, subdivision, assume=None):
        """-> ({line_no: [Finding]}, [Finding]). The syllable-fits-the-bar
        layer (`quality/fit.py`), folded into the SAME shape `inspect()`
        already uses for rhyme, so `verify()`'s existing "did not break
        something else" diff (doctrine 47) covers meter for free — this
        method adds no new veto rule of its own.

        `blueprint` is REQUIRED to opt in at all: with none, this method is
        simply not called and the loop behaves exactly as it always has.
        `subdivision` is a `quality.fit.Subdivision` — a real declared
        choice, not a default — and it MAY be `None`: `fit.py` itself then
        refuses the subdivision-dependent findings per line, and this method
        folds that refusal into one whole-draft note rather than one per
        line (the same move `COLLISION_CUT_IS_SCALAR_ONLY` makes for a fact
        that is a property of the CUT, not of any one line).

        SEVERITY IS NOT RE-DECIDED HERE. `FitFinding.satisfiable` already
        distinguishes "the declaration cannot be met" from "a count worth
        knowing" (fit.py's own doctrine 6 argument), so a finding is a hard
        `flag` exactly when fit.py itself marked it unsatisfiable, and a soft
        `note` otherwise. This method does not maintain a second opinion.

        Correlates blueprint lines to `lines` BY POSITION, and REFUSES
        (raises) on a length mismatch rather than silently misaligning — the
        same shape `verify()` already enforces on `before`/`after`. The
        blueprint's OWN stored text is NOT required to match: `Placement`
        carries WHERE a line sits (bar, beat, duration, section), which does
        not move when a revision changes the WORDS, so a revised draft is
        graded against the same placements with its own current text —
        exactly the object `verify()` needs to check `after` against.
        """
        secs, places = FT.from_blueprint(blueprint)
        if len(places) != len(lines):
            raise ValueError(
                f"blueprint declares {len(places)} line(s), {len(lines)} "
                f"were handed to the loop -- meter checking correlates by "
                f"POSITION and a mismatched count would silently misalign "
                f"every line after the first difference. They must be the "
                f"same draft.")
        per, refusals = {}, {}
        fits = [FT.fit_line(text, p, subdivision=subdivision, assume=assume,
                            line_index=i, strip_parens=self.lex.strip_parens)
                for i, (p, text) in enumerate(zip(places, lines))]
        # OVERLAPPING_SPANS IS A RELATION BETWEEN LINES, so `fit_line` cannot
        # see it from inside one line, and this loop reported nothing about it
        # for as long as it has existed -- while the `fit` verb, which calls
        # `fit_song`, has always printed it on the same blueprint. Measured
        # 2026-08-13 on one file: `fit` prints `over 1` and two findings;
        # `song` printed five meter findings and never mentioned the overlap.
        # `fit.overlap_findings` takes exactly this flat list, which is the
        # object BOTH callers already hold, so the two surfaces now share ONE
        # check rather than one surface having a check and the other not.
        # NO SEVERITY DECISION IS MADE HERE, per this method's own docstring:
        # fit.py marks an overlap satisfiable (two vocal parts is legal), so
        # the rule below files it as a `note`, which is correct.
        for i, fs in FT.overlap_findings(fits).items():
            fits[i].findings.extend(fs)
        for i, lf in enumerate(fits):
            ln = i + 1
            for f in lf.findings:
                ev = f.evidence
                if f.conditional_on:
                    ev += f" CONDITIONAL ON: {f.conditional_on}"
                per.setdefault(ln, []).append(Finding(
                    f.code, f.severity,
                    f.message, ev, [ln]))
            for r in lf.refusals:
                refusals.setdefault(r.code, []).append((ln, r))
        whole = []
        for code, hits in refusals.items():
            lns = [ln for ln, _ in hits]
            _, sample = hits[0]
            whole.append(Finding(
                code, "note",
                f"meter: {sample.question} — not answered on "
                f"{len(hits)} of {len(lines)} line(s)",
                f"{sample.missing}. {sample.detail} Said once, about the "
                f"SETTING, not once per line it happens to fall on "
                f"(the same move COLLISION_CUT_IS_SCALAR_ONLY makes).",
                sorted(lns)))
        # A BAR NO LINE COVERS IS THE SAME SHAPE OF GAP `overlap_findings`
        # WAS, ONE RELATION FURTHER OUT, AND IT SURVIVED THE SAME WAY.
        # Coverage is a relation between a SECTION and the lines declared in
        # it, so `fit_line` cannot see it from inside one line — and
        # `SectionFit.uncovered_bars` was left as a method on the object this
        # method never builds, so the `fit` verb printed an `empty bars`
        # column while `inspect`/`brief`/`verify`/`revise`/`song` said nothing
        # about it at all. MEASURED on one blueprint before the wiring: `fit`
        # printed `4 3..6` and `2 11..12` on two sections and `inspect()`
        # returned eleven distinct codes, none of them about a bar nobody
        # sings. `fit.uncovered_bar_findings` takes the SAME flat list
        # `overlap_findings` does, plus the declared section list, which is
        # the only way a section with NO LINES — the archetypal empty
        # instrumental — can be seen at all.
        #
        # WHOLE-DRAFT, WITH NO LOCATIONS, AND THAT IS THE CHARGE DECISION.
        # A per-line finding here would name lines that are individually
        # correct: their bar/beat/duration are exactly what the writer
        # declared, and no rewrite of their WORDS moves the answer — the loop
        # is a word swap on a named line and has no move for this. That is
        # the shape whose price this method's sibling block already measured
        # (see `inspect`: a flag with no move "returns NO_PROGRESS after 1
        # round with L4 permanently unresolved ... the cost is a destroyed
        # SUCCESS"), and it is why the finding names a SECTION and no line.
        #
        # SEVERITY IS STILL NOT RE-DECIDED HERE — the same `satisfiable`
        # rule the per-line loop above uses. `fit.py` marks UNCOVERED_BARS
        # satisfiable (an empty bar is a rest, a break, or a melisma this
        # layer cannot see), so it lands as a `note`, and the argument for
        # that lives in `fit.py` beside `crowded` and `fighting`, which are
        # counts and not verdicts for the same reason.
        for f in FT.uncovered_bar_findings(fits, secs):
            whole.append(Finding(
                f.code, f.severity,
                f.message, f.evidence, []))
        return per, whole

    # -- the calibrated bands ----------------------------------------------

    def _band_findings(self, lines, runs_out=None):
        """-> {line_no: [Finding]}. The ADOPTED meter bands, enforced.

        `runs_out` (M-115): pass a dict and it is filled with
        {line_no: (longest prominent run, longest weak run)} for EVERY
        line, read off the same `LineUnits` the counts are — the
        adjacency the band cannot see, captured here so the caller does
        not pay a second full read of the draft. Never a Finding and
        never charged: whether a stress clot or a weak string is a
        defect is a band question needing its own corpus measurement,
        stated as an FPR (doctrine 22), and until that calibration
        exists the runs are disclosed and nothing more.

        DENSITY [5, 12] syllables/line and PROMINENCE [2, 7] prominent/line
        — measured over 139,694 sung English lines, adopted by the
        registered rule (quality/RESULTS_METER_BANDS_READER.md), shipped as
        `meter_bands.ADOPTED`, and re-derived against the corpus by
        `python3 quality/meter_bands.py --check` so drift fails loud. Out of
        band in EITHER direction is a per-line FLAG: too much and too little
        are both refused, which is the whole reason these are bands and not
        directions — a directional pursuit converges on empty lines or
        stress-cram and fights the uniformity checks (the second sitting's
        founding argument, recorded in METER_BANDS_PREREGISTRATION.md).

        THE READER IS THE CALIBRATION'S READER, by registered condition:
        `meter_bands.reader(ADOPTED_READER)` — the eng phonology with the
        declared G2P fallback — through the same `fit.read_line` seam the
        sweep used. Enforcing [5, 12] through any other reader would enforce
        a different instrument's numbers.

        NEEDS NO BLUEPRINT AND NO SUBDIVISION. The bands are pigeonhole
        counts of the TEXT — no placement, no meter, no isochrony anywhere
        in their derivation — so unlike `_meter_findings` this check runs on
        every inspect, and its silence genuinely means clean.

        A LINE THE READER CANNOT FULLY READ IS JUDGED ASYMMETRICALLY
        (doctrine 79, the lower-bound rule): every count on such a line is a
        LOWER BOUND, so a count already ABOVE the ceiling is a violation no
        missing token can undo — that flags, with the refusal named in the
        evidence — while a count below the floor proves nothing, and the
        line gets a BAND_UNJUDGED note naming the channel and the tokens
        instead of a flag it might not deserve. An undecided prominence
        reading is the same shape one channel narrower: syllables still
        judge both ways, prominence only upward.
        """
        from quality import meter_bands as MB
        phon = MB.reader(MB.ADOPTED_READER)
        d_lo, d_hi = MB.ADOPTED["DENSITY"]
        p_lo, p_hi = MB.ADOPTED["PROMINENCE"]
        basis = (f"band adopted at reader {MB.ADOPTED_READER!r} over "
                 f"139,694 corpus lines (RESULTS_METER_BANDS_READER.md; "
                 f"re-derive: python3 quality/meter_bands.py --check)")
        per = {}
        for i, text in enumerate(lines):
            ln = i + 1
            lu = FT.read_line(text, phon=phon)
            syl, prom = lu.syllables, len(lu.prominent)
            undecided = len(lu.prominence_undecided)
            if runs_out is not None:
                runs_out[ln] = lu.prominence_runs
            refused = [r.token for r in lu.refused]
            complete = not refused and bool(lu.units)
            fs = []
            if complete and not (d_lo <= syl <= d_hi):
                fs.append(Finding(
                    "DENSITY_OUT_OF_BAND", "flag",
                    f"{syl} syllable(s) — outside the calibrated "
                    f"[{d_lo}, {d_hi}] band for a sung English line",
                    f"{basis}. Fewer than {d_lo} and more than {d_hi} are "
                    f"both refused; the fix is a rewrite of THIS line, not "
                    f"a nudge in a direction.", [ln]))
            elif not complete and syl > d_hi:
                fs.append(Finding(
                    "DENSITY_OUT_OF_BAND", "flag",
                    f"at least {syl} syllable(s) — already over the "
                    f"calibrated [{d_lo}, {d_hi}] band on the readable "
                    f"tokens alone",
                    f"{basis}. The count is a LOWER BOUND ({len(refused)} "
                    f"token(s) refused: {', '.join(refused[:4])}"
                    f"{'…' if len(refused) > 4 else ''}) and a lower bound "
                    f"over the ceiling is a violation no missing token can "
                    f"undo.", [ln]))
            prom_certain = complete and not undecided
            # M-115: the runs beside the count, on the finding a diluting
            # repair is aimed at — "and the" strung as padding shows up
            # here as the weak run the count cannot see.
            _rp, _rw = lu.prominence_runs
            _adj = (f" Adjacency, disclosed and uncalibrated: longest "
                    f"stress run {_rp}, longest weak run {_rw} — the "
                    f"band counts and cannot hear a clot or padding "
                    f"(M-115).")
            if prom_certain and not (p_lo <= prom <= p_hi):
                fs.append(Finding(
                    "PROMINENCE_OUT_OF_BAND", "flag",
                    f"{prom} prominent syllable(s) — outside the calibrated "
                    f"[{p_lo}, {p_hi}] band for a sung English line",
                    f"{basis}. Too few and too many are both refused, for "
                    f"the reason above." + _adj, [ln]))
            elif not prom_certain and prom > p_hi:
                fs.append(Finding(
                    "PROMINENCE_OUT_OF_BAND", "flag",
                    f"at least {prom} prominent syllable(s) — already over "
                    f"the calibrated [{p_lo}, {p_hi}] band on what could be "
                    f"read with certainty",
                    f"{basis}. A lower bound over the ceiling is a "
                    f"violation no refused token or undecided reading can "
                    f"undo." + _adj, [ln]))
            if not complete or undecided:
                why = []
                if refused:
                    why.append(f"{len(refused)} token(s) unread: "
                               + ", ".join(refused[:4])
                               + ("…" if len(refused) > 4 else ""))
                if not lu.units:
                    why.append("no unit read at all")
                if undecided:
                    why.append(f"{undecided} prominence reading(s) "
                               f"undecided")
                fs.append(Finding(
                    "BAND_UNJUDGED", "note",
                    "this line's band verdicts are partial — counts are "
                    "lower bounds, so only over-the-ceiling could be judged",
                    f"{'; '.join(why)}. {basis}. A refusal is not a pass "
                    f"(doctrine 20) and not a violation (doctrine 79); it "
                    f"is said here so silence stays meaningful.", [ln]))
            if fs:
                per[ln] = fs
        return per

    # -- section function ---------------------------------------------------

    def _function_findings(self, lines, blueprint):
        """-> [Finding], all whole-draft. `quality/grid.py`'s FUNCTION layer
        (verse/chorus/bridge/hook/return) read off the SAME blueprint
        `_meter_findings` already requires.

        A blueprint section has always been able to carry `"function"`, and
        a blueprint has always been able to carry a top-level `"hooks"`
        list, and until now NOTHING past `quality/fit.py` read either field.
        `fit.py` has no reason to: it places lines in bars and time, and
        does not know or need to know what a section is FOR. This is that
        gap closed, on the same opt-in coordinate — pass no `blueprint` and
        this method is not called, exactly like `_meter_findings`.

        Rebuilds the blueprint's `Song` with THIS DRAFT'S current words,
        not the blueprint's own stored text: `compare_returns` and
        `hook_occurrences` both read `Line.text`, and grading the
        blueprint's ORIGINAL wording would silently stop reacting to every
        revision after the first. Lines correlate to the blueprint by
        POSITION, the same correlation `_meter_findings` enforces with its
        own length check — call this only after that one has already
        passed (`inspect()` always does, in that order).

        SEVERITY: everything here is a `note` except `HOOK_ABSENT`, which
        is a `flag`. The rest — RETURN_LOCKED, BRIDGE_IS_A_VERSE,
        RETURN_LENGTH_DRIFT and the like — are measurements against
        `POPULAR_SONG`, a CONVENTION (`grid.FormConvention`, explicitly
        labelled one, the same move `Meter.conventional_grouping` makes),
        not a mandate the writer declared; doctrine 6 says this loop does
        not turn a convention into a score, and a convention a writer is
        free to depart from cannot be the thing that fails `verify()`.
        `HOOK_ABSENT` is different in kind: the writer supplied the exact
        hook TEXT, and it is a factual question — found in the draft's own
        words or not — with no convention in it at all, the same shape as
        `RETURN_NOT_VERBATIM` being a flag while `RETURN_LENGTH_DRIFT`'s
        sibling `RETURN_OUT_OF_RANGE` is a note.

        `RETURN_SCHEME_DRIFT` (added 2026-08-14) is the note most likely to
        be promoted by a later reader and must not be, because it is ABOUT
        RHYME and rhyme is what the mandate flags. It is not a mandate:
        `grid.return_findings` is never handed one, so its every answer is
        measured against `POPULAR_SONG` and nothing it says is a requirement
        the writer declared. THE FLAG FOR THIS ALREADY EXISTS ONE LAYER
        DOWN — a writer who REQUIRES a return declares it as
        `schemes.Return(verbatim=True)` and `Mandate.returns_check` breaks it
        as `RETURN_NOT_VERBATIM`, a flag, above — so promoting it would fail
        an undeclared return on a convention AND fail a declared one twice
        under two names. The argument in full is at the finding's own site in
        `quality/grid.py`.
        """
        song, hooks = GR.song_from_blueprint(blueprint)
        for l, text in zip(song.lines, lines):
            l.text = text
        rep = GR.song_function_report(song, hooks=hooks,
                                      rhyme_key=GR.rime_cmudict(self.lex))
        whole = []
        for f in rep["findings"]:
            whole.append(Finding(
                f.code, f.severity,
                f.message, f.evidence, []))
        for r in rep["refusals"]:
            whole.append(Finding(r.code, "note", r.message, r.evidence, []))

        # THE SHAPE LAYER, JOINED 2026-08-14, and it names the one defect this
        # harness was built for and could not see from here. `grid.stanza_lock`
        # says so in its own docstring: "THE SPECIFIC CLICHE THIS NAMES:
        # sixteen bars of 4/4 carrying four lines, repeated. Nothing in this
        # repo could see that before -- the rhyme checker would certify it as
        # clean, because every check it had was about words." It was reachable
        # from `lyric_harness.py`'s `grid` verb and from NOTHING that grades a
        # draft: `song_function_report` never calls it, so all six codes --
        # METER_LOCKED, SECTION_LENGTH_LOCKED, QUATRAIN_LOCK, DOWNBEAT_LOCKED,
        # UNIFORM_ANACRUSIS, PHRASE_LENGTH_LOCKED -- were computed by a
        # function no grading path reached. Same shape as OVERLAPPING_SPANS
        # (known gap 9) and as `song_function_report` itself before
        # 2026-08-11: built, tested, and wired to the wrong surface.
        #
        # NOT folded into `song_function_report`. That function's contract is
        # "every FUNCTION-dependent question, asked once", and it keeps a
        # doctrine-79 asked/answered/refused triple over questions of ONE
        # kind. `stanza_lock` reads bars, meters and line placement and never
        # touches `Section.function`, so counting it there would inflate a
        # triple whose own docstring records it already going negative once.
        #
        # NOTES, never flags, on the argument the docstring above makes for
        # RETURN_LOCKED: this is a measurement against a CONVENTION at an
        # uncalibrated 0.90 threshold (doctrine 16, and UNIFORM_ANACRUSIS's
        # own evidence says n=1 song is not a calibration, doctrine 72). 5/4
        # and an 11-bar bridge are choices, not repairs, so this may not be
        # the thing that fails `verify()` (doctrine 6).
        #
        # A PROPERTY OF THE DECLARED GRID, NOT OF THE WORDS, and the evidence
        # says so rather than leaving a reader to infer it: `uniformity` reads
        # sections, bars, meters and beats, so alone among everything this
        # method returns, the answer does NOT move when the draft is revised.
        # It is surfaced anyway because the writer is being told what container
        # they are writing into, which no per-line finding can say.
        for f in GR.stanza_lock(song):
            whole.append(Finding(
                f.code, "note", f.message,
                f.evidence + "  [SHAPE: read off the DECLARED grid — bars, "
                "meters and line placement — so unlike every other finding "
                "here it does not move when the words are revised.]", []))
        return whole

    # -- inspection -------------------------------------------------------

    def _floor_for(self, m):
        """A copy of the slop floor whose mandated pairs come from the MANDATE.

        `SlopFloor._pairs` and `QualityFeatures.extract` both route through
        `pairs_from_scheme`, which groups the scheme string by CHARACTER — so
        it reads X as a rhyme class. That is the fourth site of the defect
        CLAUDE.md records at `check_scheme`: on this repo's own song, 24 lines
        declared free became one 276-pair rhyme class and the brief demanded
        that `mailboxes` rhyme with `does`. Those files are not owned here, so
        the pairs are supplied instead of the string, on per-call SHALLOW
        COPIES — nothing the caller handed in is mutated, and the defect
        itself is still reachable through `SlopFloor` directly for whoever
        fixes it there.

        A DECLARED RETURN IS SUBTRACTED, because the floor would charge the
        writer for obeying the mandate. Doctrine 3's inversion is exactly this:
        where a return is REQUIRED, repetition IS the requirement, and
        `RefrainScheme.check_identity`'s own docstring already says handing
        these pairs to a rhyme grader "would flag every correct refrain".
        `to_mandate` acts on that by keeping identity out of `Mandate.groups`
        -- but an A-1 mark also carries a rhyme LETTER, so `to_mandate` builds
        groups from `blocks(self.code)` and the return pairs come back in
        through the rhyme half. `--returns=` is blunter still: it passes the
        same group list as both `groups` and `returns`. So on every path a
        writer actually uses, the floor was seeing the returns after all.

        WHAT THAT COST, measured on this repo's own villanelle fixture -- a
        formally perfect one:

            SHIPPED   pairs=93   REPEAT_IN_VERSE=1   ("carried by 6 of 93
                                 pairs, under the declared 50% needed to read
                                 it as a refrain")
            SUBTRACT  pairs=81   REPEAT_IN_VERSE=0

        while `returns_check` on the same draft returns [] -- the returns are
        perfect and the layer that understands them says so. Two layers, one
        draft, opposite verdicts, and the one that was wrong is the one that
        does not know what a refrain is. Before today's severity split those
        were FLAGS; the demotion masked this and never named it.

        SUBTRACT RATHER THAN LICENSE-IN-PLACE, which was the obvious-looking
        fix and is inverted. Licensing would route a 2x chorus into the
        one-off branch (`seen == 1`) and flag it as "recurs NOWHERE"; a 3x
        chorus would land on the recurring branch and be handed the
        refrain-licence disclosure (~~93.5%~~ 94.7% as of the 2026-08-14
        re-derivation -- see `SlopFloor.radif_min_pair_fraction`), which was
        measured on recurring rhyme REPETENDS and says nothing about a
        declared identity. There is no threshold that fixes
        it, because a return's pair-density is a fact about how many times the
        chorus repeats -- song structure, not craft.

        `return_pairs()` and not `identity_pairs()`: `requirement()` answers
        LICENSE_REPEAT for non-verbatim and UNKNOWN returns too, so an
        identical word is not a defect there either.

        SECOND-ORDER, AND THE REASON THIS IS NOT ONLY A SEVERITY QUESTION: the
        return pairs were also inflating `npairs`, the denominator every real
        radif is licensed against, so they could push a genuine refrain under
        `radif_min_pair_fraction` and un-license it. They leave the numerator
        and the denominator together.

        This changes the pair set the FEATURE layer sees as well, not just the
        relation layer -- `PREDICTABLE_RHYME`'s denominator moves on a draft
        with returns. That is defensible (a returned line's rhyme was already
        scored at its first instance, so those pairs were double-counted) but
        it is a change beyond the relation checks and is said out loud here
        rather than slipped in.
        """
        ident = {(i - 1, j - 1) for i, j, *_ in m.return_pairs()}
        pairs = [p for p in m.pairs0() if p not in ident]
        qf = copy.copy(self.floor.qf)
        qf.pairs_from_scheme = staticmethod(lambda _s, _p=pairs: list(_p))
        fl = copy.copy(self.floor)
        fl.qf = qf
        fl._pairs = lambda _lines, _s, _p=pairs: list(_p)
        return fl, "?" * m.n_lines

    def inspect(self, lines, mandate=None, profile=None, blueprint=None,
                subdivision=None, assume=None):
        """-> {line_no: [Finding]} plus a 'whole' key for item-level findings.

        Two sources, deliberately kept apart: the CORRECTNESS engine says
        whether a mandated rhyme holds, the SLOP FLOOR says whether the writing
        is outside the range human verse occupied. They fail for different
        reasons and a caller should see which is which.

        A THIRD SOURCE, OPT-IN. `blueprint` (a `quality/fit.py` path or dict)
        adds the syllable-fits-the-bar layer to the SAME finding set, which is
        what lets `verify()`'s existing net-negative rule catch a revision
        that fixes a rhyme and breaks the meter, without a new rule. Omit it
        and nothing changes — meter is not checked unless asked for.
        `subdivision` is a `quality.fit.Subdivision`, a real declared choice;
        without one, `_meter_findings` still runs and reports (once, not per
        line) that the subdivision-dependent findings were not answered,
        rather than silently skipping the layer.

        THE SAME `blueprint` ALSO ADDS `quality/grid.py`'s FUNCTION layer —
        does the chorus return the same shape, does the bridge contrast, does
        the declared hook actually recur. Not a fourth parameter: a
        blueprint's sections have always been able to declare `"function"`
        and a blueprint has always been able to carry top-level `"hooks"`,
        and nothing before this read either. See `_function_findings`.

        The returned dict's `"blueprint_declared"` key is `blueprint is not
        None`, restated in the data rather than left implicit in whatever the
        caller happened to pass — omitting meter/function is the ordinary
        case and NOT a Finding (a caller who never asked for that layer is
        not shown a note about not having asked), but a caller reading this
        dict alone, later, without the call site in view, has no other way
        to tell "meter is clean" from "meter was never asked."

        A FOURTH SOURCE, ALWAYS ASKED AND NEEDING NO PARAMETER —
        `quality/readability.py`'s own report, over EVERY line. The mandate's
        refusals (`SCHEME_UNREADABLE`) only ever covered pairs the mandate
        puts TOGETHER, so an unreadable end word on a line the mandate leaves
        FREE produced nothing at all, though `_matrix` computes the record for
        it on every run. Every one of those findings arrives as a NOTE even
        where `readability.report` calls it a flag — see the block itself for
        why, and for why that asymmetry resolves in this direction.

        A DECLARED `Mandate.scope` IS A Finding, and the difference from the
        paragraph above is the whole of doctrine 20. An omitted blueprint is a
        layer the caller declined to ask for; a declared scope is the caller
        DECLARING that the mandate does not speak about certain lines, and
        every collision touching one of them is then `UNDECLARED` rather than
        an unintended rhyme. Those come back as `COLLISION_UNDECLARED` per
        line plus one whole-draft `MANDATE_SCOPE_DECLARED`, both notes. With
        no scope — every mandate this repo builds from the CLI — neither is
        ever emitted and every finding here is bit-for-bit what it was.
        """
        m = self.mandate(lines, mandate)
        per, whole = {}, []
        seen = {}

        def add(ln, f):
            """One Finding per line, once. A floor finding carries every line
            it touches in `locations`, so a 18-pair SHARED_SUFFIX used to be
            appended to line 1 six times and printed six identical blocks
            (BACKLOG 1.5) — which does not hide a finding, it hides the OTHER
            findings underneath it."""
            bucket = seen.setdefault(ln, set())
            key = (f.code, f.message, f.evidence, tuple(f.locations))
            if key in bucket:
                return
            bucket.add(key)
            per.setdefault(ln, []).append(f)

        fl, pseudo = self._floor_for(m)
        for f in fl.check(lines, pseudo):
            if f.locations:
                for ln in dict.fromkeys(f.locations):
                    add(ln, f)
            else:
                whole.append(f)

        # THE STANZA GROUND, FROM THE BLUEPRINT THE WRITER DECLARED. See
        # `grade`'s own docstring for why this is passed and never derived
        # here: an all-zero stanza vector is M-39(b)'s defect. `blueprint`
        # already carries a per-line section (it is what `_function_findings`
        # reads), so a writer who declared one has already supplied the
        # ground, and a writer who did not gets refusals from the five
        # `frame="stanza"` schemas rather than a manufactured frame.
        _sections = None
        if blueprint is not None:
            try:
                _song, _ = GR.song_from_blueprint(blueprint)
                _sections = [l.section for l in _song.lines][:len(lines)]
                if len(_sections) < len(lines):
                    _sections = None      # a partial map is not a ground
            except Exception:
                _sections = None
        rep = self.grade(lines, m, profile=profile, sections=_sections)
        # A DECLARED STRUCTURE WITH NO LAZINESS DATA IS SAID OUT LOUD, ONCE
        # PER DRAFT (doctrine 48: silence about it would read as clean).
        # `Structure.calibrated` is True only where a preregistered
        # calibration has ADOPTED a measured laziness regime under THAT
        # structure's own pairing relation — today exactly the comparator
        # sentinel. Every other declared row grades CORRECTNESS (its judge
        # answers true/false/refused) and cannot grade LAZINESS: the modal
        # table and the spelled-rime class are end-rhyme instruments, and
        # the pair check above skips these verdicts for exactly that
        # reason. One NOTE for the whole draft, not one per pair — the fact
        # is about the DECLARATION, not about any line's words, and a
        # per-pair charge would be the inflation `song_function_report`'s
        # counting docstring records (one fact, N records).
        if getattr(m, "structures", ()) and any(m.structures):
            from quality import structures as _STw
            # LANGUAGE-AWARE since the Kalevala adoption (2026-08-18):
            # `calibrated` is a tuple of language codes, and this Reviser
            # grades ENGLISH drafts, so the note fires unless the row's
            # regime covers "eng" — a Finnish-measured table declared on
            # an English draft is doctrine 8's case, disclosed rather
            # than silently borrowed.
            _uncal = sorted({name for name in m.structures
                             if name
                             and "eng" not in _STw.get(name).calibrated})
            if _uncal:
                whole.append(Finding(
                    "STRUCTURE_UNCALIBRATED", "note",
                    f"declared structure(s) {', '.join(repr(x) for x in _uncal)} "
                    f"have no measured laziness tier FOR THIS DRAFT'S "
                    f"LANGUAGE (eng) — correctness is graded "
                    f"by the catalog's own judge, laziness is NOT graded",
                    f"Structure.calibrated is False for these rows: no "
                    f"preregistered calibration has adopted a predictability "
                    f"table or a lazy class under their own pairing "
                    f"relation, so the two-tier ban (HOMEOTELEUTON / "
                    f"MODAL_RHYME) does not apply to their pairs and nothing "
                    f"stands in for it. The meter-band pattern is the road: "
                    f"register -> measure -> adopt -> CI re-derives.", []))
        if not m.independent():
            whole.append(Finding(
                "MANDATE_NOT_INDEPENDENT", "note",
                "this mandate was DERIVED from the rhyme graph, so its groups "
                "band-pass by construction and an empty rhyme-violation list "
                "is an identity rather than a verdict",
                f"{m.origin}. Doctrine 14: a control may not be defined in "
                f"terms of the quantity it controls. What is still evidence "
                f"here: refusals, REPEAT edges the graph admits and a mandate "
                f"rejects, the slop floor, and grading this cover at a "
                f"DIFFERENT theta from the one that produced it.", []))

        for v in rep["violations"]:
            i, j = v["lines"]
            add(j, Finding(
                "SCHEME_VIOLATION", "flag",
                f"L{i} and L{j} are both in group {v['label']} "
                f"{v['members']} but do not rhyme",
                f"{v['why']} (score {v['score']:.3f}; "
                f"{v['endwords'][0]!r} ~ {v['endwords'][1]!r})"
                f"{v.get('attribution', '')}", [i, j]))
        # DOCTRINE 9, ASKED OF A PAIR THAT ALREADY PASSES, NOT ONLY ONE THAT
        # FAILED. `modal_field` has existed since the candidate field was
        # built, and every caller of it -- `joint_field`'s own candidate
        # offer, `verify()`'s `modal_taken` rejection -- only ever consults
        # it once a pair has ALREADY been flagged and a replacement is being
        # searched for. A pair that rhymes cleanly on the FIRST draft is
        # never asked whether the word it landed on was the single most
        # predictable answer to its partner, because nothing routes a
        # passing pair through this method at all. FOUND BY MEASURING, NOT
        # ARGUING: two real songs' worth of pairs that all passed `grade()`
        # cleanly, checked against `modal_field` after the fact, turned out
        # to BE the #1 or #2 ranked candidate for half of them -- claim/name,
        # word/heard, stopped/dropped, night/right were all the single most
        # frequent realised partner for their call word; trial/denial was
        # second. Nothing before this line had ever asked the question of a
        # pair that was never broken.
        for v in rep["verdicts"]:
            if v["why"] or v["relation"] == "REPEAT":
                continue          # a violation, or a declared identity
            # A PAIR JUDGED UNDER A DECLARED NON-DEFAULT STRUCTURE IS NOT
            # ASKED THIS QUESTION. Both tiers below are END-RHYME laziness
            # instruments — `spelled_rime` reads the spelled ENDING and the
            # modal table ranks END-RHYME partners over eng-song pairs — so
            # asking them of a skothending (coda-only, line-internal
            # anchors) or a Kalevala alliteration (word ONSETS) would grade
            # the wrong axis with the wrong corpus and call the answer
            # doctrine 9. The structure's own laziness regime arrives only
            # by preregistered calibration (Structure.calibrated), and until
            # one adopts, the honest state is DISCLOSED once per draft by
            # the uncalibrated-structure note rather than faked per pair
            # here (doctrine 20). `structure` is None on every mandate that
            # never learned the coordinate, so this line is unreachable on
            # every pre-catalog path.
            _vs = v.get("structure")
            if _vs is not None:
                from quality import structures as _STm
                if _vs != _STm.DEFAULT:
                    continue
            i, j = v["lines"]
            wi, wj = (w.lower() for w in v["endwords"])
            # TIER 1 FIRST — HOMEOTELEUTON (owner's rule, 2026-08-18): the
            # pair's own SPELLINGS decide, no field consulted, so a
            # same-rime partner outside the finite field cannot slip
            # through. hAIR/chAIR, stOVE/cOVE, sOWN/grOWN: the rhyme was
            # found by pattern-matching the ending, and it is banned
            # whatever the corpus frequency says. Symmetric by
            # construction, and pursued mandatorily (loop.MANDATORY_PURSUE)
            # — the two-tier ban exists because a reviser iterating
            # candidates until the modal check passed was landing at rank 7
            # of the same predictability list, and same-spelled endings are
            # rank zero: the ones a search finds without even hearing them.
            ri, rj = self._spelled_rime(wi), self._spelled_rime(wj)
            if ri and ri == rj:
                add(j, Finding(
                    "HOMEOTELEUTON", "note",
                    f"L{i}/L{j} rhyme on the SAME SPELLED ENDING "
                    f"({v['endwords'][0]!r}/{v['endwords'][1]!r}, both "
                    f"-{ri}) — the laziest class, banned before any "
                    f"frequency judgment",
                    f"spelled rime {ri!r} on both sides. The near "
                    f"relations the taxonomy names (declared via "
                    f"Declaration.admit) are the palette that keeps this "
                    f"ban from closing the class: reach for a "
                    f"differently-spelled partner or a declared near "
                    f"rhyme, not the next word in the same spelling "
                    f"family.", [i, j]))
                continue
            # TIER 2 — the frequency ban over the differently-spelled
            # remainder (`joint_field` composes the same two tiers for the
            # OFFERS, so menu and verdict agree).
            # THE HEAD ONLY (M-185): `modal_field` also builds the offer,
            # and the offer now screens its words by their own heads.
            forbidden_i = self.modal_head(wi, profile=profile)
            forbidden_j = self.modal_head(wj, profile=profile)
            hits = []
            if wj in forbidden_i:
                hits.append(f"{v['endwords'][1]!r} is one of the "
                            f"{self.rdecl.modal_exclusion} most-predictable "
                            f"answers to {v['endwords'][0]!r}")
            if wi in forbidden_j:
                hits.append(f"{v['endwords'][0]!r} is one of the "
                            f"{self.rdecl.modal_exclusion} most-predictable "
                            f"answers to {v['endwords'][1]!r}")
            if not hits:
                continue
            add(j, Finding(
                "MODAL_RHYME", "note",
                f"L{i}/L{j} rhyme, but the pair is one this word's own "
                f"forbidden-modal set would exclude if either line were "
                f"being revised",
                "; ".join(hits) + ". modal_exclusion="
                f"{self.rdecl.modal_exclusion} over the differently-spelled "
                "remainder (the same-spelled class is banned outright as "
                "HOMEOTELEUTON); set it to 0 to silence this the same way "
                "it silences the reactive check. Doctrine 9's "
                "exclusion is otherwise only consulted when fixing an "
                "already-flagged line; this asks the same question of a "
                "pair that never failed anything, because a first draft "
                "can reach for the predictable rhyme exactly as easily as "
                "a revision can.", [i, j]))
        default_licensed = self.rdecl.repeat_licence == "refrain"
        for v in rep["repeats"]:
            i, j = v["lines"]
            # Same gate as `grade()` above, and for the same reason: without
            # it a letter scheme's REQUIRE_RHYME answers before the switch is
            # read, and the REFRAIN_REPEAT notes below drop to zero at
            # repeat_licence="refrain".
            declared, is_violation = (
                (False, None) if not m.returns
                else m.requirement(i, j).decided("repeat_is_violation"))
            if declared:
                if is_violation:
                    continue          # SCHEME_VIOLATION already covers it
                req = m.requirement(i, j)
                ev = (f"the MANDATE requires this: {req.gloss}. Doctrine 18's "
                      f"count-and-fraction test does not apply here — this "
                      f"is not a claim earned by measurement, it is a "
                      f"declared `Return`.")
            elif default_licensed:
                ev = ("the licence was DECLARED (repeat_licence='refrain'), "
                      "not earned: doctrine 18 wants a count AND a declared "
                      "fraction of the item's pairs before a repetend is a "
                      "form, and this loop measures neither")
            else:
                continue              # unlicensed and undeclared: a violation
            add(j, Finding(
                "REFRAIN_REPEAT", "note",
                f"L{i} and L{j} are the same end word inside group "
                f"{v['label']}, licensed as a refrain", ev, [i, j]))
        # A DECLARED VERBATIM RETURN THAT DID NOT COME BACK VERBATIM. This is
        # the other half of the fix above: `grade()` now correctly stops
        # flagging a CORRECT refrain as a violation, and this is what makes
        # `verify()` able to see a BROKEN one -- without it, a revision that
        # rewrites a return's words and leaves its rhyme intact introduces no
        # finding at all, and the net-negative diff (doctrine 47) has nothing
        # to catch. Doctrine 24: named as the KIND of variation
        # (`quality.grid.compare_returns`), not a bare "changed" boolean, so a
        # word-order shift and a dropped line are not the same finding.
        from quality.grid import _KIND_GLOSS
        for label, i, j, kind, msg in m.returns_check(lines):
            ev = _KIND_GLOSS.get(kind, "")
            if kind == "OUT_OF_RANGE":
                # `OUT_OF_RANGE` IS NOT A VARIATION KIND and `_KIND_GLOSS` has
                # no row for it -- it is the one member of `returns_check`'s
                # output that reports a mandate that could not be READ rather
                # than a return that came back wrong, so `ev` was the empty
                # string and this was the only Finding in this method shipped
                # with no evidence at all (doctrine 79: a count with no
                # coordinate, and here not even a count).
                #
                # WHAT REACHES THIS LINE, PRECISELY. Not the case the message
                # from `quality/schemes.py` names -- "the mandate declares N
                # lines and M were given" cannot happen here, because
                # `Reviser.mandate` is `SC.mandate(spec, n_lines=len(lines))`
                # and every constructor path in it REFUSES a length mismatch
                # with `NoMandate` several frames earlier. What can: a
                # `Mandate` assembled by hand (`dataclasses.replace`, direct
                # construction) carrying a `Return` whose line lies outside
                # its OWN 1..n_lines -- the one input `_normalise_returns`
                # exists to raise on, reached by going around it. The
                # evidence says which, since the message says the other.
                whole.append(Finding(
                    "RETURN_OUT_OF_RANGE", "note", msg,
                    f"return {label or '(unlabelled)'} declares L{i} and L{j} "
                    f"the SAME LINE and the draft has {len(lines)}, so this "
                    f"return's verbatim requirement was NOT CHECKED — "
                    f"unasked, not answered clean (doctrine 20). A mandate "
                    f"built through `quality.schemes.mandate` cannot get "
                    f"here: it refuses an out-of-range return line, and it "
                    f"refuses a draft whose length disagrees with the "
                    f"mandate's. This one was built around that constructor.",
                    [x for x in (i, j) if x <= len(lines)]))
                continue
            add(j, Finding("RETURN_NOT_VERBATIM", "flag", msg,
                           f"{kind}: {ev}" if ev else kind, [i, j]))
        for v in rep["excused"]:
            i, j = v["lines"]
            # WHICH GROUP EXCUSED WHICH LINE. `grade()` grants the excuse per
            # LINE and both endpoints have to earn it separately, so a finding
            # that named neither was reporting the conclusion and withholding
            # the whole of the reason -- on the one reading where a line
            # having more than one group is the entire subject (doctrine 2).
            by = "; ".join(f"L{ln} answers {', '.join(labs)}"
                           for ln, labs in sorted(v.get("excused_by",
                                                        {}).items()))
            add(j, Finding(
                "MANDATE_EXCUSED_BY_OVERLAP", "note",
                f"L{i}/L{j} fail group {v['label']} and were EXCUSED because "
                f"overlap_rule='disjunctive'",
                f"{v['why']}. {by}. EVERY line of the pair had to answer "
                f"another of its OWN groups in full — a line in one group "
                f"has nothing else to answer and is never excused here, "
                f"which is doctrine 20 held at the line: an obligation "
                f"dropped with nothing answered in its place is a vacuous "
                f"pass. Under the declared default (conjunctive) this is a "
                f"violation. The disjunctive reading gets weaker the more "
                f"structure you declare, which is why it is reachable and "
                f"not the default.", [i, j]))
        # A REFUSAL IS NOT A VIOLATION. Before the readability fix these
        # arrived as violations and this loop briefed a model to rewrite
        # lines that rhyme perfectly well -- Barnes's Dorset `drong`/`zong`
        # among them. Now they arrive separately and the brief says the
        # harness could not read the line, which is a different instruction
        # to a writer than "this does not rhyme".
        for r in rep["refusals"]:
            i, j = r["lines"]
            for ln in (i, j):
                add(ln, Finding(
                    "SCHEME_UNREADABLE", "note",
                    f"L{i}/L{j} are mandated together (group(s) "
                    f"{', '.join(r['groups']) or '-'}) and the harness could "
                    f"not read an end word, so this rhyme is UNKNOWN rather "
                    f"than absent",
                    r["reason"], [i, j]))
        # THE READABILITY REPORT, JOINED — AND IT IS THE SAME LAYER AS THE
        # BLOCK ABOVE, WHICH IS WHY IT SITS HERE.
        #
        # `refusals_for_pairs` (above) is scoped to pairs the MANDATE puts
        # together, so an unreadable end word on a line the mandate leaves
        # FREE produced NOTHING AT ALL — while `_matrix` had already computed
        # a `readability_records` entry for that very line, on every run, and
        # thrown it away. MEASURED on a 4-line draft with `zzzqx` at the end
        # of L4 and only L1/L2 mandated: `readability.report` says
        # UNREADABLE_END_WORD on L4 and `inspect()` said nothing whatsoever.
        # Put the identical word on a MANDATED line and SCHEME_UNREADABLE
        # fires — so the defect is invisible to exactly the input a reader
        # reaches for first.
        #
        # ONE DEFINITION, TWO SURFACES, the same move `fit.overlap_findings`
        # makes for meter: `readability.report` is what the `readability` verb
        # prints, and calling it is a call rather than a second copy of the
        # by_token/by_piece partition and its evidence prose. Its records are
        # recomputed rather than handed `_matrix`'s, because `report(lex,
        # lines)` is that module's signature and this cell does not own that
        # file — and the two CANNOT disagree about the only field these
        # findings read: `final_unreadable` is `not line_anchors(...)`, and
        # `promote` — the one coordinate `_matrix` passes and `report` does
        # not — flips it on 0 of 4,784 real corpus lines and 0 of 41 fixture
        # lines, at BOTH of the boolean's values. Pinned in test_revise.py
        # test 34 rather than left as a hope. Warm cost 0.009s against
        # inspect()'s tens of seconds.
        #
        # SEVERITY IS RE-DECIDED HERE, AND THAT IS THE DECISION — the one
        # place this method departs from `_meter_findings`'s "severity is not
        # re-decided here", so it owes a reason. `readability.report` calls
        # UNREADABLE_END_WORD and UNREADABLE_END_WORD_PIECE **flags**; every
        # one of them arrives here as a **note**.
        #
        #  - A REFUSAL IS NOT A VIOLATION, and this loop has already paid for
        #    getting that backwards once: the comment above this block records
        #    that these arrived as violations before the readability fix and
        #    the loop "briefed a model to rewrite lines that rhyme perfectly
        #    well — Barnes's Dorset `drong`/`zong` among them". The gap is the
        #    LEXICON'S, not the poet's (doctrine 79 — a refusal in the
        #    numerator charges the wrong layer), and `verify()`'s gate is the
        #    numerator: it rejects on `new_flags` alone.
        #  - INTERNAL CONSISTENCY DECIDES IT EVEN IF THE ABOVE DID NOT.
        #    `SCHEME_UNREADABLE` — the SAME refusal, on a pair the mandate
        #    DECLARED — is a note. Importing these as flags would make an
        #    unreadable word on a line nobody mandated fail HARDER than the
        #    identical word on a line the mandate put in a group. There is no
        #    reading of doctrine 6/7 under which that is coherent.
        #  - WHY fit.py'S SEVERITY IS KEPT AND THIS ONE IS NOT: `FitFinding.
        #    satisfiable` answers a LOOP question — the writer's own
        #    declaration contradicts itself and only the writer can resolve
        #    it. `readability.py`'s severity answers a REPORT question — does
        #    this hole invalidate the rate being printed — and that module's
        #    own `Finding` docstring says it is shaped so "a caller that
        #    already renders floor findings renders these with no new code".
        #    It is built for RENDERING, not for gating.
        #  - AND THE LOOP HAS NO MOVE. None of these codes is in
        #    RHYME_FINDINGS, so `brief()` hands the line back with an EMPTY
        #    candidate field. As a flag each one would be briefed, attempted
        #    and never resolved. MEASURED both ways on a 4-line draft whose
        #    only defect is `zzzqx` ending a FREE line: as a note the loop
        #    returns SUCCESS in 0 rounds; kept at `readability.report`'s own
        #    `flag` it returns NO_PROGRESS after 1 round with L4 permanently
        #    `unresolved`. Add a genuinely fixable SCHEME_VIOLATION on L1/L2
        #    and the flag variant returns NO_PROGRESS after 2 rounds, still
        #    unresolved on L4. NOT `ROUND_LIMIT`: the loop notices a round
        #    that fixed nothing before it exhausts `max_rounds`, so the cost
        #    is a destroyed SUCCESS rather than a burnt budget — which is the
        #    same conclusion `quality/loop.py`'s docstring reaches about
        #    promoting the three whole-draft flags, arrived at one stop
        #    condition earlier.
        #
        # NO NEW OPT-OUT, and the reason is that one already exists AT THE
        # RIGHT LAYER. `modal_exclusion=0`, `field_band='scalar'` and the rest
        # are switches on a JUDGEMENT with two defensible answers. This is not
        # a judgement: CMUdict either has the word or it does not, and the
        # declared coordinate that moves that answer is `Lexicon(fallback=
        # "high"|"low")` (doctrine 1). MEASURED: `viewest` at the end of a
        # free line reports UNREADABLE_END_WORD at the shipped default and
        # CLEAN at both `high` and `low`. A second switch in `ReviseDeclara-
        # tion` would be a second place to change one answer, which is the
        # thing doctrine 1 forbids.
        #
        # THE BLAST RADIUS IS AT `verify()`, AND IT MOVES BOTH WAYS — MEASURED
        # on the same 4-line draft, join on against join off:
        #   unreadable -> readable   was accepted=False, fixed=[] ("nothing
        #                            was fixed" — a real repair called a
        #                            no-op); is now accepted=True with
        #                            fixed=[(4, UNREADABLE_END_WORD)]
        #   readable -> unreadable   was accepted=True with new_notes=[] —
        #                            the loop could not see the regression AT
        #                            ALL; is now accepted=True with the code
        #                            in `new_notes` and never in `new_flags`
        # So the join lets `verify()` see a change it was blind to in both
        # directions, and — because every one of these is a note — it still
        # cannot REJECT on one. That is doctrine 7 exactly: the loop discloses
        # the refusal and does not order the writer around it.
        #
        # AND ONE MORE CODE JOINED THE SAME CALL 2026-08-14, WITH NO SECOND
        # WIRE. `readability.substitution_report` — the sharper half by its
        # own docstring, "the substituted word is a plausible English word and
        # nothing about the output looks wrong" — sat 100 lines below
        # `report` in that module with two callers: its own `main()`, which
        # prints a COUNT and never a word, and one test. It is now folded
        # into `report`'s own finding list as `SUBSTITUTED_END_WORD`, so this
        # loop reaches it through the call it already makes rather than
        # through a second one (the same "one definition, two surfaces" the
        # paragraph above states).
        # WHAT IT ADDS IS NARROWER THAN THE CODE COUNT SUGGESTS, MEASURED:
        # over the 143 English song files 8,840 of 8,842 substitution lines
        # are ALREADY `UNREADABLE_END_WORD` — the LINE was never silent, only
        # the WORD was — so this is the actionable half of a finding that
        # already existed, not a newly visible population. The exception is
        # real and small: 2 lines whose end token READS and yields no
        # syllable (`...on the turf,[mm]`) are anchored on the previous word,
        # reported readable, and reached by NOTHING else in either module.
        # It arrives a NOTE from `report` itself and needs no downgrade.
        # COST, warm, on the 16-line `quality/fixtures/song.txt`: `report`
        # goes 0.0181s -> 0.0260s, of which 0.0079s is the new call, against
        # `inspect()`'s tens of seconds on the same draft.
        #
        # PER LINE, NOT WHOLE-DRAFT: these findings NAME the lines they are
        # about, so they follow the floor's own branch at the top of this
        # method — one Finding appended to each line in its `locations`, which
        # is what lets `verify()`'s multiset diff see ONE line stop being
        # unreadable while the others still are. As per-line NOTES they are
        # briefed and disclosed and start no round: `revise_loop`'s `flagged`
        # filter reads severity, so SUCCESS, NO_PROGRESS and ROUND_LIMIT all
        # mean exactly what they meant before this block existed.
        _downgraded = (
            " SEVERITY: `readability.report` calls this a FLAG; the revision "
            "loop files it as a NOTE. A refusal is not a violation "
            "(doctrine 79), and `SCHEME_UNREADABLE` — the same refusal on a "
            "pair the mandate DECLARED — is already a note, so a flag here "
            "would fail an unmandated line harder than a mandated one. The "
            "lexicon cannot read the word; the line is not thereby wrong. "
            "`Lexicon(fallback='high'|'low')` is the declared coordinate that "
            "changes what is readable (doctrine 1) — there is no second "
            "switch for it in `ReviseDeclaration`.")
        for f in RD.report(self.lex, lines)["findings"]:
            ev = f.evidence + (_downgraded if f.severity == "flag" else "")
            note = Finding(f.code, "note", f.message, ev, list(f.locations))
            if note.locations:
                for ln in dict.fromkeys(note.locations):
                    add(ln, note)
            else:
                whole.append(note)
        # THE SENTENCEHOOD LAYER (2026-08-25, `MISSING.md` M-110) — the one
        # question no sound layer asks: is this line an utterance or a stack
        # of nouns. `quality/sentencehood.py` owns the predicate and the
        # calibration; severities are CONSTRUCTED there and not re-decided
        # here (`STACKED_LINE` a per-line note, `STACKED_DRAFT` a whole-draft
        # flag of the floor's own species — it fails `song` and rejects a
        # regressing revision through `new_flags`, and it cannot stop the
        # loop, exactly as `FUNCTION_WORD_HEAVY` cannot). An environment
        # with no tagger gets `sentencehood_checked=False` and ZERO findings
        # — a disclosed refusal, never a silent pass, the same shape
        # `blueprint_declared` already has (doctrine 20).
        try:
            _sh = SH.report(lines)
        except Exception:                                 # noqa: BLE001
            _sh = {"available": False, "findings": []}
        _sh_checked = bool(_sh.get("available"))
        for f in _sh["findings"]:
            g = Finding(f.code, f.severity, f.message, f.evidence,
                        list(f.locations))
            if g.locations:
                for ln in dict.fromkeys(g.locations):
                    add(ln, g)
            else:
                whole.append(g)
        # THE COLLISION SET, PARTITIONED. Two moves and neither changes the
        # SET: it is still every pair at or above `THETA_COLLISION` sharing no
        # group, still exactly `check_scheme`'s. What changes is which LAYER
        # each member is charged to, which is this repo's own triage rule
        # (ingestion / projection / anchor / comparator / band / structure /
        # value) applied to the only output the loop has on a passing song.
        merges = self.group_merges(lines, m, profile=profile)
        absorbed = {(i, j) for mg in merges for i, j, *_ in mg["edges"]}
        near = 0
        for mg in merges:
            la, lb = mg["labels"]
            ma, mb = mg["members"]
            ev = "; ".join(f"L{i}~L{j} {wa!r}~{wb!r} {sc:.3f} {rel}"
                           for i, j, sc, rel, wa, wb in mg["edges"])
            if mg["declared"]:
                whole.append(Finding(
                    "GROUPS_DECLARED_RETURN", "note",
                    f"groups {la} {ma} and {lb} {mb} are the same section "
                    f"returning, and the mandate SAYS SO, so the "
                    f"{len(mg['edges'])} cross pair(s) below are the form "
                    f"and not a defect",
                    f"{mg['how']}. Reported once, about the mandate, rather "
                    f"than once per line: {ev}", list(mg["lines"])))
            else:
                whole.append(Finding(
                    "MANDATE_GROUPS_INDISTINGUISHABLE", "note",
                    f"groups {la} {ma} and {lb} {mb} would pass as ONE group "
                    f"— every cross pair rhymes — so the mandate splits a "
                    f"group the graph does not, and each of the "
                    f"{len(mg['edges'])} cross pairs is reported as a "
                    f"collision purely because the letters differ",
                    f"{mg['how']} (doctrine 2: a letter is a property of a "
                    f"LINE, so no letter scheme can say 'these two groups are "
                    f"the same words coming back'). THIS DOES NOT SAY WHICH "
                    f"IT IS: a section returning and a rhyme sound reused by "
                    f"accident are the same picture in the graph, and the "
                    f"loop does not read intent out of a score. If it is a "
                    f"return, declare it and these stop being findings; if it "
                    f"is not, one of the two groups needs a different sound. "
                    f"Edges: {ev}", list(mg["lines"])))
        for c in rep["collisions"]:
            i, j = c["lines"]
            if (i, j) in absorbed:
                continue
            code = self._collision_code(c["relation"], c.get("undeclared"))
            pair = (f"{c['endwords'][0]!r} ~ {c['endwords'][1]!r} "
                    f"{c['score']:.3f} {c['relation']}"
                    f"{c.get('attribution', '')}")
            gi = ", ".join(m.labels[k] for k in m.groups_of(i)) or "free"
            gj = ", ".join(m.labels[k] for k in m.groups_of(j)) or "free"
            if c["relation"] not in RHYME_RELATIONS and \
                    c["relation"] != "REPEAT":
                # COUNTED OFF THE RELATION, not off which code was emitted.
                # `COLLISION_CUT_IS_SCALAR_ONLY` is a statement about the CUT,
                # and the cut is applied identically to every pair in the set,
                # so an undeclared near-relation belongs in this count exactly
                # as much as a declared one — and its denominator is the whole
                # collision set either way. On a mandate with no scope nothing
                # is undeclared and this is the same number the `else` branch
                # below used to increment.
                near += 1
            if code == "COLLISION_UNDECLARED":
                out = c.get("undeclared_lines") or []
                which = " and ".join(f"L{x}" for x in out) or f"L{i}/L{j}"
                is_are = "is" if len(out) == 1 else "are"
                would = self._collision_code(c["relation"])
                msg = (f"L{i} and L{j} collide — {pair} — and the mandate "
                       f"DOES NOT SPEAK about {which}: UNDECLARED, not an "
                       f"unintended rhyme")
                ev = (f"`Mandate.scope` declares {len(m.scope)} of "
                      f"{m.n_lines} line(s) and {which} {is_are} outside it, "
                      f"so "
                      f"`requirement(L{i}, L{j})` is UNDECLARED — 'cannot "
                      f"tell' — and NOT `FREE`'s 'nothing required here' "
                      f"(doctrine 28). Reported rather than SUPPRESSED, "
                      f"because those two are also both different from "
                      f"silence: dropping this pair would make a scoped run "
                      f"indistinguishable from one where these lines were "
                      f"checked and came back clean, which is doctrine 20's "
                      f"collapse pointed the other way. It would be reported "
                      f"as {would} if the mandate reached these lines. "
                      f"Whether the collision is a defect is not a question "
                      f"this mandate asked, so the loop states the sonic "
                      f"fact and charges nothing")
            elif code == "SCHEME_COLLISION":
                msg = (f"L{i} ({gi}) and L{j} ({gj}) RHYME and share no "
                       f"mandated group — {pair}")
                ev = ("an unintended rhyme across groups. Whether that is a "
                      "defect is the writer's call and the loop does not "
                      "take it: an unmandated rhyme is quite often the best "
                      "thing in a song, and doctrine 7 makes this a floor "
                      "rather than a ranking. It is reported because it is "
                      "the one thing here that IS about the writing")
            elif code == "REPEAT_ACROSS_GROUPS":
                msg = (f"L{i} ({gi}) and L{j} ({gj}) END ON THE SAME WORD and "
                       f"share no mandated group — {pair}")
                ev = ("REPEAT, not rhyme. Doctrine 3's first sentence, and "
                      "the relation that inverts by context: a violation "
                      "inside a verse, the REQUIREMENT across chorus "
                      "instances, licensed as radif or refrain. Nothing in a "
                      "score separates those, so the loop names the relation "
                      "and stops")
            else:
                msg = (f"L{i} ({gi}) and L{j} ({gj}) collide as "
                       f"{c['relation']}, WHICH IS NOT A RHYME — {pair}")
                # ASKED, NOT ASSERTED — 2026-08-22. This sentence used to
                # state `admits()` is FALSE (the mandate cut)` as a fixed
                # fact, which was true only while the DEFAULT admit set was
                # the two rhyme relations. The default now admits all four,
                # so for an ASSONANCE or CONSONANCE collision the two cuts
                # AGREE and the old text told the writer their clean pair
                # would be charged. Doctrine 45's shape, in prose rather
                # than in a checker: a sentence that silently picks one
                # answer to a question the declaration decides.
                _adm = c["relation"] in self.decl.admit
                ev = (f"scalar {c['score']:.3f} >= {THETA_COLLISION} (the "
                      f"collision cut) and `admits()` is "
                      f"{'TRUE' if _adm else 'FALSE'} (the mandate cut, "
                      f"under this run's declared admit set "
                      f"{tuple(self.decl.admit)}), so this same module "
                      + (f"would ACCEPT the pair if L{i} and L{j} were "
                         f"mandated together — it is reported here because "
                         f"the collision detector's cut is the SCALAR "
                         f"alone and says nothing about whether the "
                         f"relation was wanted"
                         if _adm else
                         f"would call the pair a VIOLATION if L{i} and "
                         f"L{j} were mandated together")
                      + ". See the whole-draft note below")
            add(j, Finding(code, "note", msg, ev, [i, j]))
        if near:
            # Said ONCE. The argument is a property of the cut, not of any
            # one pair, and repeating it under every line is the shape of the
            # duplicate-findings defect BACKLOG 1.5 was about: it does not
            # hide a finding, it hides the OTHER findings underneath it.
            whole.append(Finding(
                "COLLISION_CUT_IS_SCALAR_ONLY", "note",
                f"{near} of the {len(rep['collisions'])} collision(s) on this "
                f"draft are NOT rhymes under this harness's own band, and the "
                f"collision detector reported them anyway",
                f"the collision cut is `total >= {THETA_COLLISION}` — the "
                f"SCALAR alone — while `grade()` accepts a mandated pair only "
                f"when `admits()` does: the scalar AND a relation in the "
                f"DECLARED admit set — ~~RHYME_RELATIONS~~, which was this "
                f"sentence's answer while the default was the two rhyme "
                f"relations and stopped being it on 2026-08-22, when the "
                f"default widened to every admittable relation (doctrine "
                f"17: the superseded value stays visible). This run "
                f"declared {tuple(self.decl.admit)}. So the two halves of "
                f"this module ask "
                f"different questions about the same pair, which is the "
                f"defect `RESULTS_REVISION_LOOP.md` §1 found in `_field` and "
                f"fixed there, surviving here. The SET is not changed: it is "
                f"still exactly `check_scheme`'s, and the two constants must "
                f"not drift. What is changed is that each member is now "
                f"typed, because doctrine 24 says a rule that would delete a "
                f"category must relabel instead — an ASSONANCE running across "
                f"a song is a real sonic event and deleting it would be the "
                f"worse defect. `lyric_harness.check_scheme` TYPES ITS OWN "
                f"members too, since 2026-08-11 — this sentence said it "
                f"carried an untyped message until 2026-08-16, which was "
                f"true when written and stopped being true five days "
                f"later, in a finding whose whole subject is a claim two "
                f"modules make about one set (doctrine 17). What they "
                f"share now is the CUT, and it is ONE constant: "
                f"`lyric_harness.THETA_COLLISION`, imported here rather "
                f"than re-declared, so the two cannot drift. AND THE TWO "
                f"QUESTIONS SHOULD NOT BE MADE ONE — that was MEASURED on "
                f"2026-08-16 and the verdict is recorded beside the cut "
                f"itself in `Reviser._matrix`: adding `admits()` here "
                f"makes NEAR_COLLISION unreachable and silently stops the "
                f"refrain merge firing. This sentence names a deliberate "
                f"difference, not an open defect", []))
        if getattr(m, "scope", ()):
            # SAID ONCE, ABOUT THE MANDATE, and only when the coordinate was
            # DECLARED — a mandate with no scope speaks about every line and
            # has nothing to disclose, which is why the default path never
            # reaches this branch. Doctrine 1: an analysis states its
            # assumptions, and "which lines am I even talking about" is the
            # assumption every collision above rests on. Doctrine 79: the
            # counts are kept SEPARATE rather than summed, because "collides
            # inside what the mandate speaks about" and "collides where it
            # does not" ask different things of a writer.
            und = [c for c in rep["collisions"] if c.get("undeclared")]
            outside = sorted(i for i in range(1, m.n_lines + 1)
                             if not m.in_scope(i))
            whole.append(Finding(
                "MANDATE_SCOPE_DECLARED", "note",
                f"this mandate SPEAKS ABOUT {len(m.scope)} of {m.n_lines} "
                f"line(s); of its {len(rep['collisions'])} collision(s), "
                f"{len(rep['collisions']) - len(und)} are inside that scope "
                f"and {len(und)} touch a line it does not speak about",
                f"the {len(und)} are reported as COLLISION_UNDECLARED and "
                f"charged to nobody: `Mandate.requirement` answers UNDECLARED "
                f"there, which is 'cannot tell' and not `FREE`'s 'nothing "
                f"required' (doctrine 28). Lines outside the scope: "
                f"{outside}. "
                f"They are still graded by every mandate-INDEPENDENT layer in "
                f"this loop — the slop floor, the readability refusals, meter "
                f"and song function if a blueprint was declared — because "
                f"none of those consults a mandate at all (doctrine 6/7: two "
                f"sources, deliberately kept apart). A scope narrows what the "
                f"MANDATE claims, never what the draft is measured on",
                outside))
        if blueprint is not None:
            m_per, m_whole = self._meter_findings(lines, blueprint,
                                                   subdivision, assume)
            for ln, fs in m_per.items():
                for f in fs:
                    add(ln, f)
            whole.extend(m_whole)
            whole.extend(self._function_findings(lines, blueprint))
        # The calibrated bands run UNCONDITIONALLY — no blueprint, no
        # subdivision, no mandate in their derivation, so unlike the meter
        # block above there is no opt-in coordinate to disclose and their
        # silence genuinely means the draft's lines sit inside what 139,694
        # sung English lines do (see `_band_findings`).
        _prom_runs = {}
        for ln, fs in self._band_findings(lines, runs_out=_prom_runs).items():
            for f in fs:
                add(ln, f)
        # `blueprint_declared` is NOT a Finding. Meter/function are an OPT-IN
        # third source (see this method's own docstring) and omitting them is
        # the ordinary, common case, not a defect on the draft -- so it does
        # not belong in `whole`, which callers scan for things WRONG with the
        # song. It exists because `per_line`/`whole` being silent about meter
        # is indistinguishable from meter having been checked and found
        # clean, and a caller reading this dict alone (the CLI already prints
        # its own disclosure separately; see `_say_blueprint` in
        # lyric_harness.py) has no other way to tell the two apart.
        # `mixed_span_groups` is call metadata on the same argument (M-114):
        # a DEFAULT-relation group mixing front-of-word spans with rime
        # spans is a fact about the DECLARATION — the writer must know that
        # `21.endword` asks the spelling-class question while its siblings
        # ask the rhyme question — and it is not a defect on the draft, so
        # it is a key and never a Finding.
        # `prominence_runs` (M-115) is the same kind of key: per line, the
        # (longest stress run, longest weak run) the band's COUNT cannot
        # see — captured off the same read the band findings made, disclosed
        # and uncalibrated, never a Finding and never charged.
        return {"per_line": per, "whole": whole, "mandate": m, "grade": rep,
                "merges": merges, "blueprint_declared": blueprint is not None,
                "sentencehood_checked": _sh_checked,
                "mixed_span_groups": (m.mixed_span_groups()
                                      if hasattr(m, "mixed_span_groups")
                                      else []),
                "prominence_runs": _prom_runs}

    # -- the brief --------------------------------------------------------

    def schema_route_open(self, m, group_index):
        """Is the 77-schema half of the default LIVE for one GROUP?

        THE ONE DEFINITION OF THE FAN'S GROUP-LEVEL GATE (M-116/M-139).
        `grade()`'s rescue turns on three facts about a GROUP -- the
        declaration sits at the default door, the group declares no relation
        of its own, and it declares no non-default structure -- and `brief()`
        must answer that same question to say whether the candidate field
        skipped the route. Two spellings of one gate is exactly how the brief
        and the verdict come to disagree, which is the defect `_field`'s own
        docstring is named after (doctrine 1).

        THE PER-PAIR HALF STAYS IN `grade()`: `v["why"]` and
        `relation != "REPEAT"` are facts about a PAIR, and a brief has no
        pair to ask them of.

        LAZY EXACTLY AS `grade()` IS -- a mandate declaring no structure
        anywhere never imports `quality.structures`, which is what that
        gate is for there.
        """
        from lyric_harness import admit_is_default as _AID
        if not _AID(self.decl):
            return False
        if (m.relation_of(group_index)
                if hasattr(m, "relation_of") else ""):
            return False
        if not any(getattr(m, "structures", ()) or ()):
            return True
        from quality import structures as _ST_mod
        return m.structure_of(group_index) == _ST_mod.DEFAULT

    def field_note(self, m, groups):
        """-> `Brief.schema_route_note` for one line's groups.

        ANY open group is enough, and that is the honest reading: ~~the field
        is ONE list answering every group at once (`joint_field` intersects
        them)~~ the field at each PLACE answers every group bound there
        (M-184 split the list per place, 2026-09-01), so a single group
        leaving the route open means a list was built without the 77 for a
        pair the grader will apply them to.
        """
        from quality.relations import SCHEMA_ROUTE_NOTE as _N
        return _N if any(self.schema_route_open(m, k)
                         for k, _mates in groups) else ""

    def field_declaration(self):
        """The candidate field's own coordinates, as one printable string.

        Doctrine 1: every analysis states its assumptions. Doctrine 58: a
        bare count is a coordinate of a setting nobody wrote down, and the
        counts this loop prints — how many words are offered, how many are
        forbidden, whether a pivot has any joint candidate at all — are all
        coordinates of these two.
        """
        d = self.rdecl.field_depth
        return (f"field_depth={'complete pool' if d is None else d}, "
                f"field_band={self.rdecl.field_band!r}")

    def _word_anchors(self, word):
        key = (word, self._promote())
        hit = self._anchor_cache.get(key)
        if hit is None:
            ancs, last, _ = line_anchors(self.lex, word,
                                         promote=self._promote())
            hit = self._anchor_cache[key] = (ancs, last)
        return hit

    def _field(self, calls, profile=None):
        """-> ordered candidate words for each call word, under the GRADER'S
        OWN PREDICATE.

        THE BRIEF AND THE VERDICT HAVE TO ASK THE SAME QUESTION. ~~`grade()`
        accepts a mandated pair when `admits()` does: the scalar clears
        `theta_rhyme` AND the relation is in `RHYME_RELATIONS`.~~ This function
        used to keep the first half and drop the second, so it offered a
        writer words that the verdict following the brief calls ASSONANCE or
        CONSONANCE and counts as a violation. Measured on this repo's own
        song, that was 58 of 336 offered words (17.3%) — concentrated on the
        cluster codas, `ones` at 15/24 and `went`/`sent` at 7/24 — and it is
        the same defect in two directions, because the FORBIDDEN list is the
        head of this same population: 29 of 101 forbidden entries were words
        no writer could have taken.

        **THE STRIKE IS 2026-08-26 AND THE INVARIANT IS THE SAME ONE — THE
        VERDICT MOVED TWICE AND THIS FUNCTION MOVED NEITHER TIME
        (`MISSING.md` M-139).** `RHYME_RELATIONS` stopped being the verdict's
        door on 2026-08-22, when M-59's owner ruling widened
        `Declaration.admit` to all four; and it stopped being the whole
        question at all on 2026-08-25, when M-116 put ALL 77 SCHEMAS in the
        default, so `grade()` accepts a mandated pair on
        `admits(s, theta, decl.admit)` **OR** on
        `relations.whole_vocabulary_pairs`. This function kept spelling the
        pre-widening set — `admits(s, theta)` with `relations=` OMITTED,
        whose own docstring says None means the historical two — under a
        paragraph claiming it asks the verdict's question. The paragraph was
        the promise and the call was the defect, which is the ONLY reason
        this reads as a regression rather than as a policy.

        **THE TWO HALVES ARE NOT THE SAME KIND OF GAP AND ARE NOT CLOSED THE
        SAME WAY.** The RELATION half is a coordinate this function can carry
        and now does: the check below reads `self.decl.admit`, so a caller
        who NARROWS the door narrows the field with it and a later per-
        relation ruling (`MISSING.md` M-138) flows here for free rather than
        needing a second edit. The SCHEMA half is not expressible here at
        all — `whole_vocabulary_pairs` judges a LINE PAIR over a built
        stream and this function holds one WORD — ~~so it is DISCLOSED
        rather than silently dropped (`Brief.field_declaration`, and
        doctrine 20: a field that stays quiet about a whole acceptance route
        reads as though nothing else could answer)~~.

        **THAT LAST CLAUSE WAS FALSE WHEN IT WAS WRITTEN AND IS STRUCK THE
        SAME DAY — 2026-08-26.** `Brief.field_declaration` renders
        `field_depth=..., field_band=...` and NOTHING about the schema
        route; grep it and every renderer prints those two coordinates
        alone. So the sentence asserted a disclosure that was never built,
        which is doctrine 48 inside the docstring of the function this
        entry's own repair is about — a principle living only in prose,
        written by the lot that had just finished naming that failure mode.

        ~~The schema half is at present SILENTLY DROPPED here.~~ **THE
        DISCLOSURE SHIPPED 2026-08-26, ON ITS OWN COORDINATE AND NOT ON
        `field_declaration`'s.** `Brief.schema_route_note` carries it,
        `relations.SCHEMA_ROUTE_NOTE` is its ONE definition (the module that
        owns the judge owns the sentence), and every one of the SIX sites
        that renders a candidate field prints it — `Brief.__str__`,
        `Reviser.report`, `propose._offered_block` from its three call sites,
        and `lyric_harness._print_brief_report`, which restates
        `Brief.__str__` rather than calling it and would otherwise have lost
        the rule in the verb a writer actually runs.

        WHAT IT CLAIMS IS BOUNDED BY WHAT WAS MEASURED. The field is
        per-WORD and the schema route is per-LINE-PAIR, so the disclosure can
        never list words: it names the ROUTE and says a pair may satisfy
        without any offered word being taken. MEASURED over
        `quality/fixtures/` and `songs/` — 15 drafts under their own
        committed mandates, 452 mandated pairs — **15 pairs (3.32%) on 3
        drafts are accepted ONLY by the 77**, and of the 10 whose bound spans
        both read, **0 are offerable** from complete-pool fields
        1,434–3,981 words deep, every one scoring BELOW `theta_rhyme` 0.75
        (0.395–0.705). So the route is refused ON THE SCALAR and no depth
        reaches it, which is why the sentence must not imply the field is
        merely incomplete.

        AND THE GATE IS ONE FUNCTION NOW, WHICH IS THE OTHER HALF OF THIS
        DOCSTRING'S OWN PROMISE. `Reviser.schema_route_open` is read by
        `grade()`'s rescue fan and by `brief()`'s disclosure alike, so the
        brief cannot say the route is open on a pair the verdict treats as
        closed (`MISSING.md` M-139).

        `CandidateEngine` scores with `score()` on one pronunciation; the
        grader scores with `best_score()` over every variant of both sides.
        The check below uses `best_score`, so the field agrees with the
        verdict rather than with the engine — which is what makes an offered
        word a promise instead of a suggestion.
        """
        return [self._field_one(w, profile=profile) for w in calls]

    def _field_one(self, word, profile=None):
        rd = self.rdecl
        # `decl.admit` IS PART OF THE KEY since 2026-08-26 (M-139). It became
        # a coordinate of this function's answer the moment the check below
        # started reading it, and a cache keyed on the old tuple would serve
        # one door's field to the other's caller — the silent comparator
        # substitution doctrine 1 exists for.
        key = (word, self._promote(), rd.field_depth, rd.field_band, profile,
               self.decl.theta_rhyme, frozenset(self.decl.admit))
        hit = self._field_cache.get(key)
        if hit is not None:
            return hit
        depth = rd.field_depth
        if depth is None:                 # the COMPLETE pool, not a literal
            depth = len(self.engine.index) + 1
        res = self.engine.candidates(word, n=depth)
        pool = [c["word"] for c in res.get("candidates", [])
                if c["score"] >= self.decl.theta_rhyme]
        if rd.field_band == "scalar":
            passing = pool
        elif rd.field_band == "grader":
            anc_q, w_q = self._word_anchors(word)
            passing = []
            for cand in pool:
                anc_c, w_c = self._word_anchors(cand)
                s = best_score(anc_q, anc_c, self.decl, w_q, w_c,
                               profile=profile)
                # `decl.admit`, NOT the omitted default. Omitting it spelled
                # the pre-M-59 two-name door in the one function whose
                # docstring promises it asks the verdict's question (M-139).
                # AND `theta_for`, NOT `theta_rhyme`, since 2026-09-02 for
                # the same reason one layer on: the near relations carry
                # their own priced cut (M-138), and a FIELD built at 0.75
                # would offer the writer partners the GRADE then charges.
                if admits(s, theta_for(s, self.decl),
                          relations=frozenset(self.decl.admit)):
                    passing.append(cand)
        else:
            # An undeclared value must be loud, not silently one of the two.
            raise ValueError(
                f"ReviseDeclaration.field_band must be 'grader' or 'scalar', "
                f"got {rd.field_band!r}")
        if len(self._field_cache) > 64:
            self._field_cache.clear()
        self._field_cache[key] = passing
        return passing

    def _spelled_rime(self, word):
        """`lyric_harness.spelled_rime` anchored at the RHYMING syllable —
        the same anchor rule the comparator declares (last primary stress),
        read from this Reviser's own lexicon. silver/deliver anchor at
        SIL/LIV and spell 'ilver'/'iver' — different, NOT homeoteleuton —
        where the bare last-group form would merge the entire feminine -er
        space into one banned class, which is exactly the "closing rhyme
        classes" the owner ruled out. An OOV word falls back to the bare
        form: for a monosyllabic or last-group-stressed word (all 19 argued
        cases) the two agree exactly."""
        phones, oov = self.lex.transcribe_word(word)
        if oov or not phones:
            return spelled_rime(word)
        vowels = [p for p in phones if p[-1:].isdigit()]
        if not vowels:
            return spelled_rime(word)
        anchor = None
        for want in ("1", "2"):
            for idx in range(len(vowels) - 1, -1, -1):
                if vowels[idx].endswith(want):
                    anchor = idx
                    break
            if anchor is not None:
                break
        if anchor is None:
            anchor = len(vowels) - 1
        return spelled_rime(word, stress_from_end=len(vowels) - anchor)

    def joint_field(self, calls, exclude=(), profile=None):
        """-> (offered, forbidden). The candidate field that answers EVERY
        call word, with the most PREDICTABLE members forbidden as modal.

        For a single call this is `modal_field` and behaves exactly as it did.
        For a PIVOT — a line in two groups — it is the intersection, and the
        intersection can be EMPTY. That is not a failure of the writer; it is
        the mandate reporting that its own conjunction is unsatisfiable at
        this line, which is a sentence a letter scheme cannot form because it
        cannot put a line in two classes to begin with.

        AN EMPTY INTERSECTION IS A COORDINATE OF `field_depth`, and saying so
        is the whole of doctrine 58. At the old hard-coded depth of 200 this
        song's own pivot — L14/L34, which must answer `does`, `five`,
        `drive`, `of` and `alive` at once — reported the conjunction
        unsatisfiable and told the writer to revise the MANDATE. Six words
        (`love`, `above`, `thereof`, `buzz`, `glove`, `gov`) answer all five
        under the grader's own predicate; they were simply below rank 200 in
        three of the five score-ordered pools. The claim was not wrong about
        the lexicon, it was a claim about a constant.

        WHAT "PREDICTABLE" IS RANKED OVER, WIRED 2026-08-11. Primarily the
        CONDITIONAL, P(partner | call) measured over corpus/song/
        (`quality/frequency.py`'s `eng-song` cell, `scoring=UNSEEN` because a
        freshly drafted line is in no corpus), summed over every call the
        line must answer — the instrument doctrine 9 actually names, not a
        global word count. Measured leave-one-author-out
        (`quality/RESULTS_SONG_FREQUENCY.md`): the six words this ranks
        highest cover 63.2% of what a held-out writer actually reached for,
        against 16.9% for the web list this field used to rank on. The
        conditional is SPARSE (76.1% of end-word types have fewer than 6
        realised partners, `data/sources.tsv`'s row for
        `song_rhymepair_en.tsv`), so a candidate with zero observed count for
        every call falls back to `lex.freq_rank`, a global spoken-register
        list — not a claim that it is unpredictable, only that this table has
        no evidence either way.

        Ties are broken on (frequency rank, position in the first field) and
        never on set iteration order — doctrine 66, a tie broken by iterating
        a set is a result that does not reproduce.
        """
        offered, forbidden, _dropped = self.joint_field_screened(
            calls, exclude=exclude, profile=profile)
        return offered, forbidden

    def modal_head(self, call_word, profile=None):
        """-> the FORBIDDEN head of one call word's field and nothing else —
        the two tiers (`joint_field`'s own composition) with no offer built.

        THE GRADER'S ACCESSOR (M-185, 2026-09-01). `grade()`'s MODAL_RHYME
        check needs only the head; it used to take it off `modal_field`,
        which also builds the OFFER, and the offer now screens each of its
        words by asking for THAT word's head — a recursion the grader has no
        use for and would pay on every satisfied pair. Same ranking, same
        two tiers, same answer as `modal_field(...)[1]`; `test_revise.py`
        pins the identity.
        """
        _, forbidden, _ = self._rank_field([call_word], profile=profile)
        return forbidden

    def _rank_field(self, calls, profile=None):
        """-> (rest_ranked, forbidden, fields): the two-tier ranking over the
        conjunction of `calls`' fields, with the ban applied and NO offer
        chosen. The one ranking `joint_field_screened` and `modal_head`
        share (doctrine 1)."""
        fields = self._field(calls, profile=profile)
        if not fields or not fields[0]:
            return [], [], fields
        common = set(fields[0])
        for f in fields[1:]:
            common &= set(f)
        order = {w: i for i, w in enumerate(fields[0])}
        cond = collections.Counter()
        for call in calls:
            cond.update(FREQ.LAYER.conditional(
                "eng-song", call.lower(), scoring=FREQ.UNSEEN))
        ranked = sorted(common,
                        key=lambda w: (-cond.get(w, 0),
                                       self.lex.freq_rank.get(w, 10 ** 9),
                                       order.get(w, 10 ** 9), w))
        # THE TWO-TIER BAN (owner's rule, 2026-08-18). Tier 1: HOMEOTELEUTON
        # — a candidate whose SPELLED RIME equals any call word's
        # (`lyric_harness.spelled_rime`) was found by pattern-matching the
        # ending, the laziest class there is. Ranked beneath everything and
        # banned whatever the corpus says. Tier 2: the top
        # `modal_exclusion` most-predictable of the DIFFERENTLY-SPELLED
        # remainder. Before the split, the class words and the frequency
        # words competed for the same k slots — 'hair' spent two of six on
        # air/fair, and 'prayer' (rank 7) walked through the gap; a reviser
        # iterating candidates until the checker passed landed on rank 7
        # EVERY time. The tiers close the gap from both sides, and the
        # OFFERS below are built from what survives both, ~~so the menu and
        # the verdict cannot disagree~~ — STRUCK 2026-09-01 (M-185): they
        # disagreed in the OTHER direction, the call sitting in the offered
        # word's own head, and `joint_field_screened` closes that side.
        call_rimes = {self._spelled_rime(c) for c in calls}
        homeo = [w for w in ranked if self._spelled_rime(w) in call_rimes]
        rest_ranked = [w for w in ranked
                       if self._spelled_rime(w) not in call_rimes]
        k = self.rdecl.modal_exclusion
        forbidden = homeo + rest_ranked[:k]
        return rest_ranked[k:], forbidden, fields

    def joint_field_screened(self, calls, exclude=(), profile=None):
        """-> (offered, forbidden, dropped): `joint_field` with its third
        count exposed — the words the offer PASSED OVER because taking them
        would re-open the line (M-185).

        THE MENU AND THE VERDICT DISAGREED, and the sentence above this
        function said they could not. The MODAL_RHYME note `grade()` files
        is SYMMETRIC — `wj in head(wi) OR wi in head(wj)` — while the offer
        was screened in ONE direction only, the head of the CALLS' field.
        MEASURED on the 2026-09-01 audit's probe: every one of the first
        six words offered for the call `door` (lenore, bore, gore, yore,
        implore, wore) has `door` in ITS OWN head, so taking any of them
        filed MODAL_RHYME, the loop pursued it (`MANDATORY_PURSUE`), and the
        line the writer had just fixed re-opened at exit 3. `_offer_reopens`
        asks the other direction of each candidate before it is offered;
        the words it drops are counted and returned, never folded into the
        offer or the head (doctrine 79).
        """
        rest_ranked, forbidden, fields = self._rank_field(calls,
                                                          profile=profile)
        if not fields or not fields[0]:
            return [], [], []
        drop = set(forbidden) | {w.lower() for w in exclude if w}
        # RHYMES BEFORE NEAR RELATIONS, in the OFFER only. The ranking is
        # doctrine 9's (partner count given the calls, then frequency) and
        # it decides the HEAD; the head is untouched here. But once the
        # screen below removes the observed partners of a common call — for
        # `door` every one of them has `door` in its own head — the ranking's
        # tail is the menu, and the tail of a zero-evidence tier ordered by
        # global frequency is `i, on, was, are`: function words the widened
        # admit door (M-59; priced at M-138) types as ASSONANCE or CONSONANCE.
        # A menu headed by them is a menu no writer can use. So every
        # candidate is first TYPED by its relation to every call, read off
        # the comparator itself (`best_score(...)["relation"]`, the object
        # `grade()` reads), and the RHYME-typed candidates are screened and
        # offered first in their doctrine-9 order; the near-typed ones fill
        # whatever the menu still has room for, in theirs. A partition, not a
        # re-ranking: within each part the order is what it always was.
        anc_calls = [self._word_anchors(c) for c in calls]
        rhymes, nears = [], []
        for w in rest_ranked:
            if w in drop:
                continue
            # single letters are lexicon artifacts, not words a writer can use
            if len(w) < 2 and w not in ("a", "i"):
                continue
            anc_w, lab_w = self._word_anchors(w)
            typed = all(
                best_score(anc_c, anc_w, self.decl, lab_c, lab_w,
                           profile=profile)["relation"] in RHYME_RELATIONS
                for anc_c, lab_c in anc_calls)
            (rhymes if typed else nears).append(w)
        # THE SCREEN, bounded: each screen scores a few dozen pairs, and a
        # common call's near-typed tier runs to hundreds of words, so at most
        # `_SCREEN_SCAN` × `offered` candidates of each part are screened.
        # `dropped` is the RHYME-typed words the screen refused — the count
        # that says whether this call can be rhymed cleanly at all.
        limit = self._SCREEN_SCAN * self.rdecl.offered
        rest, dropped = [], []
        for w in rhymes[:limit]:
            if len(rest) >= self.rdecl.offered:
                break
            if self._offer_reopens(w, calls, fields, profile=profile):
                dropped.append(w)
                continue
            rest.append(w)
        for w in nears[:limit]:
            if len(rest) >= self.rdecl.offered:
                break
            if self._offer_reopens(w, calls, fields, profile=profile):
                continue
            rest.append(w)
        return rest, forbidden, dropped

    #: How far past the menu's own length the screen scans EACH part, in
    #: multiples of `ReviseDeclaration.offered` — a bound on cost, not a
    #: coordinate of any verdict (the head is cut before this runs).
    #: MEASURED 2026-09-01 on the call `door`: 32 rhyme-typed candidates
    #: dropped, 24 survivors reached in 3.6 s cold, so 8× the menu covers
    #: the common case.
    _SCREEN_SCAN = 8

    def _offer_reopens(self, w, calls, fields, profile=None):
        """Would taking `w` file MODAL_RHYME against one of `calls` from
        `w`'s OWN side — is some call in `w`'s head? (M-185)

        EXACT WOULD COST A LEXICON PASS PER OFFERED WORD. `modal_head(w)`
        scores every entry against `w` (`engine.candidates`, ~2.7 s cold,
        43,250 `score` calls — profiled 2026-09-01), and a 25-line drawn
        plan briefs ~15 lines × 12 offers per round with a 64-entry field
        cache, so the exact form is minutes per brief. This answers the
        same question CONSERVATIVELY: `w`'s head is the top
        `modal_exclusion` of its band-passing, differently-spelled field
        ranked by (partner count given `w`, frequency rank), so a call `c`
        is OUTSIDE it exactly when at least `modal_exclusion` words outrank
        `c` there. Outrankers are counted only where they can be proven —
        `w`'s observed partners and the call's own family (both already in
        hand), each scored against `w` by the grader's own predicate — so
        every counted outranker is real, the count can only be LOW, and a
        low count DROPS the word. A dropped word was therefore never
        offered wrongly; a kept word has `modal_exclusion` proven
        outrankers and cannot be in the head. The words this cannot see
        (a rhyme of `w` outside the call's family and unobserved beside it)
        cost offers, never verdicts. Ties at the frequency floor (both
        words absent from the list) are not counted as outrankers for the
        same reason — `joint_field`'s tie-break there is field order,
        which this does not rebuild.
        """
        k = self.rdecl.modal_exclusion
        if k <= 0:
            return False
        rime_w = self._spelled_rime(w)
        anc_w, lab_w = self._word_anchors(w)
        cond_w = FREQ.LAYER.conditional("eng-song", w.lower(),
                                        scoring=FREQ.UNSEEN)
        for c, cfield in zip(calls, fields):
            c = c.lower()
            cond_c = cond_w.get(c, 0)
            fr_c = self.lex.freq_rank.get(c, 10 ** 9)
            pool = set(cond_w) | set(cfield)
            pool.discard(c)
            pool.discard(w)
            outrank = 0
            for x in sorted(pool):
                cx = cond_w.get(x, 0)
                fx = self.lex.freq_rank.get(x, 10 ** 9)
                if not (cx > cond_c or (cx == cond_c and fx < fr_c)):
                    continue
                if len(x) < 2 and x not in ("a", "i"):
                    continue
                if self._spelled_rime(x) == rime_w:
                    continue                    # homeo: ranked beneath the head
                anc_x, lab_x = self._word_anchors(x)
                if not anc_x:
                    continue
                sc = best_score(anc_w, anc_x, self.decl, lab_w, lab_x,
                                profile=profile)
                if admits(sc, self.decl.theta_rhyme,
                          relations=frozenset(self.decl.admit)):
                    outrank += 1
                    if outrank >= k:
                        break
            if outrank < k:
                return True
        return False

    def modal_field(self, call_word, exclude=(), profile=None):
        """-> (offered, forbidden). The forbidden set is the MOST PREDICTABLE
        band-passing candidates — what a writer is most likely to reach for
        GIVEN this call word, not merely the commonest words in English.

        The population it is the head of is `_field_one`'s — the words the
        GRADER would accept, over the COMPLETE pool. Both halves of that are
        load-bearing and both were wrong: ranked over the scalar-only pool at
        depth 200, `ones` had five of its six forbidden words outside its own
        field, so the exclusion was spent on words nobody could take.

        WHAT THE RANKING IS OVER, said out loud because it decides which way
        this pushes, and WIRED 2026-08-11 to answer doctrine 9 properly.
        Primarily the CONDITIONAL, P(partner | call) measured over
        corpus/song/ (`quality/frequency.py`'s `eng-song` cell): `night`'s
        realised partners are `light`, `sight`, `right`, `bright` — not
        `that`, `not`, `at`, `but`, which is where any global unigram rank
        spends the head of a rhyme field, because the head of any unigram
        list is function words. A call word the table has no data for falls
        back to `lex.freq_rank`, now `data/opensubtitles_en_50k.tsv` — a
        spoken-register global rank that replaced the 2006 web crawl this
        used to read (`software` was rank 151, `weep` was absent entirely).
        `quality/RESULTS_SONG_FREQUENCY.md` measures both steps: +4.5pp from
        the register fix alone, and the conditional itself covers 63.2% of
        what a held-out writer reached for against 16.9% for the old web
        list. See `joint_field` for the exact ranking and the sparsity it
        falls back on.
        """
        return self.joint_field([call_word], exclude=exclude, profile=profile)

    def brief(self, lines, mandate=None, profile=None, blueprint=None,
              subdivision=None, assume=None):
        """-> [Brief], one per line that needs work. Lines with no findings are
        absent, because the loop revises FLAGGED LINES ONLY.

        RAISES `NoMandate` when handed nothing to check against. It used to
        return `[]`, which a caller printed as "nothing flagged".

        `blueprint`/`subdivision`/`assume` pass straight through to
        `inspect()` — see there for what they add, and for
        `"blueprint_declared"`, which this method does NOT surface (a
        `Brief` is a per-LINE record and whether meter was asked at all is a
        whole-draft fact); call `inspect()` directly for that. A line whose
        only findings are meter (no rhyme finding) is still briefed, with an
        empty candidate field: `wants` below only checks `RHYME_FINDINGS`, and a
        meter code is never in it, so a meter-only line is never handed a
        list of rhyme words it has no use for.

        WHY A COLLISION EARNS NO FIELD — asked as an open question and
        answered by measurement rather than by taste.

        The proposal was that the collision codes join `RHYME_FINDINGS` so
        they get a candidate field like the rest. They do not, and the reason
        is mechanical rather than aesthetic: **a candidate field is generated
        from a POSITIVE call.** `joint_field` intersects the rhyme fields of
        the words a line must ANSWER, which is why it is small enough to hand
        to a writer — on this song's own lines the intersection runs from 1
        word to a few dozen. A collision is the opposite constraint: do NOT
        rhyme with this word. Measured against the shipped lexicon of 18,010
        entries, the satisfying set of that constraint is

            does   17,713 words (98.35%)      will   17,795 (98.81%)
            ear    17,873 (99.24%)            floor  17,878 (99.27%)

        so a "candidate field" for a collision is not a field, it is a copy of
        the dictionary with a rhyme class deleted. And doctrine 9's mechanism
        on top of it is worse than useless: the modal head of 98% of English
        is `you, i, the, to, a, 's` — the six commonest words in
        `data/opensubtitles_en_50k.tsv`, `lex.freq_rank`'s source — so the
        exclusion that exists to push a writer off the predictable RHYME
        would be forbidding the six commonest words in the language. The
        mechanism is aimed at a positive field; a negative constraint has no
        modal head worth excluding, at any distribution. (Which is also why
        wiring `joint_field` to the call-conditional table in `modal_field`
        does not change this either: a collision has no call word to
        condition on, so there is no conditional to consult. The defect is
        the POLARITY of the constraint, not the ranking over it.)

        The second reason is doctrine 7, and it is the one that decides what
        the loop IS. The loop is a floor: rejection, not selection. A
        collision on a draft with zero violations is not a rejection — the
        mandate was satisfied — so offering replacement words would be
        ordering the permitted region, which is the one thing the floor is
        forbidden to do. It would also be the harness deciding that an
        unmandated rhyme is a defect, and an unmandated rhyme is quite often
        the best thing in a song.

        So the collision half of the brief is made useful the other way: by
        PARTITIONING it and naming the layer each part belongs to
        (`group_merges`, `_collision_code`), which is what this harness
        promises on its first page — locate the defect, name the layer, hand
        the line back. On this repo's two songs that takes 38 undifferentiated
        "unintended rhyme" notes down to 3 that are about the writing.
        """
        found = self.inspect(lines, mandate, profile=profile,
                             blueprint=blueprint, subdivision=subdivision,
                             assume=assume)
        m = found["mandate"]
        _, endwords, _, _ = self._matrix(lines, profile=profile)
        briefs = []
        for ln in sorted(found["per_line"]):
            fs = found["per_line"][ln]
            b = Brief(line_no=ln, text=lines[ln - 1], findings=fs,
                      field_declaration=self.field_declaration(),
                      keep=[i for i in range(1, len(lines) + 1)
                            if i not in found["per_line"]])
            groups = m.partners(ln)
            # ===============================================================
            # THE MANDATE BLOCK IS GATED ON THE MANDATE. THE CANDIDATE FIELD
            # IS GATED ON THE FINDING SET. THEY ARE TWO GATES — FIXED
            # 2026-08-16, FOUND BY WRITING A SONG THROUGH `--propose=defer:`.
            # ===============================================================
            # Both used to sit behind `wants and groups`, so a line flagged
            # for METER ALONE while sitting in a mandated group was briefed
            # with NO `must_answer` at all — and `quality/propose.py`'s
            # `_mandate_block`, finding nothing to print, fell through to its
            # default sentence: `(no rhyme group declared for this line)`.
            #
            # THAT SENTENCE IS ABOUT THE MANDATE AND THE CONDITION WAS ABOUT
            # THE FINDINGS. Doctrine 1: one question, two readings, and the
            # rendered one was FALSE. MEASURED on a two-line draft
            # (fingerprint `385ff1e4055e`, mandate `AA`, 2 bars of 4/4 at
            # `--subdivision 2`): L1 carries `SLOTS_EXCEEDED` and no rhyme
            # finding, `m.groups_of(1)` is `[0]` label `A` and
            # `m.requirement(1, 2)` is `REQUIRE_RHYME` — and the tier-1 prompt
            # told the writer no group was declared.
            #
            # THE COST IS NOT THE SENTENCE, IT IS WHAT A WRITER DOES NEXT.
            # Told no group existed, the writer fixed the meter by shortening
            # the line — `the kitchen light still burns` — and moved the end
            # word `four` -> `burns`. `verify()` ACCEPTED it, correctly by its
            # own rules (a flag fixed, none introduced), and the word the
            # OTHER half of the only mandated pair has to answer had silently
            # changed. Recorded in full at
            # `quality/COVERAGE_PREREGISTRATION.md`, rung 1.
            #
            # THE FIELD STAYS BEHIND `wants`, and this method's own docstring
            # is why: "a meter-only line is never handed a list of rhyme words
            # it has no use for". That argument is about the OFFER and it
            # still holds — a line whose rhyme is satisfied needs the
            # CONSTRAINT stated and needs no replacement words. It also keeps
            # `verify()`'s RULE 3 honest by construction: the modal exclusion
            # is enforced off `b.forbidden_modal` — the brief's own list — so
            # a line offered no field is a line the rule does not enforce
            # against, and the writer is never rejected for taking a word
            # nobody forbade.
            #
            # `joint_conflict` STAYS INSIDE THE FIELD BRANCH, deliberately:
            # it reports that the CONJUNCTION of a pivot's groups is
            # unsatisfiable, which is a fact about a search that was run, and
            # it is what `quality/loop.py` dispatches tier 2 on. Setting it
            # from a branch that computes no field would make it a claim about
            # a search nobody performed (doctrine 20).
            #
            # EVERY group, not one. The old `_partner` picked the first
            # mate of the line's single letter, which is all a letter
            # scheme can express and is wrong for a pivot by construction.
            # THE BINDING SITE, resolved once for this line and read by
            # every word this brief names. A line in several groups that
            # declare DIFFERENT places cannot be answered by one swap, and
            # that is reported (`slot_conflict`) rather than resolved by
            # picking the first — picking would hand the writer a rewrite
            # that satisfies one group and silently breaks the other.
            # ONE PLACE, ONE FIELD (M-184, 2026-09-01). Every group the line
            # is in is resolved to the place it binds THIS line at; the
            # groups are bucketed by place; and the finding(s) on the line
            # say which places are VIOLATED. The old code took the first
            # group's slot as `b.slot`, handed EVERY group's calls to one
            # `joint_field` (an intersection across places, which is empty
            # whenever the places' families differ), and told the writer
            # "the MANDATE is what needs revising" about a line that needed
            # one ordinary swap at its T2 word.
            _slotted = m.slots_declared()
            _slot_of = {k: (m.slot_of(k, ln) if _slotted else None)
                        for k, _ in groups}
            _skey = {k: (None if _SL.is_default(sl) else str(sl))
                     for k, sl in _slot_of.items()}
            b.group_slots = {m.labels[k]: _skey[k] for k, _ in groups}
            _violated = self._violated_groups(m, ln, groups, fs)
            b.violated_groups = tuple(m.labels[k] for k, _ in groups
                                      if k in _violated)
            _by_slot = {}
            for k, _mates in groups:
                _by_slot.setdefault(_skey[k], []).append(k)
            _viol_slots = [sk for sk in _by_slot
                           if any(k in _violated for k in _by_slot[sk])]
            # THE PRIMARY PLACE: the violated one; the first violated one
            # when several are (and `slot_conflict` says so); the first
            # group's place when no finding can name one — which is exactly
            # the old choice, kept for that case alone.
            _primary = (_viol_slots[0] if _viol_slots
                        else (_skey[groups[0][0]] if groups else None))
            b.slot = (_slot_of[_by_slot[_primary][0]]
                      if groups else None)
            b.slot_conflict = len(_viol_slots) > 1
            b.slot_groups = tuple(m.labels[k]
                                  for k in _by_slot.get(_primary, ()))
            _returns = []
            for k, mates in groups:
                b.must_answer.append(
                    (m.labels[k], list(m.groups[k]),
                     [(x, self._slot_word(lines, m, k, x, endwords))
                      for x in mates]))
                # WHICH KIND OF REQUIREMENT THIS GROUP IS. Asked of the
                # MANDATE, never inferred from the words: `Mandate.
                # requirement` is the one object that holds both kinds, and
                # a renderer that guessed from `returns` membership would be
                # a second statement of it (doctrine 1).
                if any(getattr(m.requirement(ln, x), "name", "")
                       == "REQUIRE_RETURN" for x in mates):
                    _returns.append(m.labels[k])
            b.return_groups = tuple(_returns)
            if groups and groups[0][1]:
                _first = groups[0][1]
                b.must_rhyme_with = (
                    _first[0],
                    self._slot_word(lines, m, groups[0][0], _first[0],
                                    endwords))
            # ANY rhyme-implicating finding earns a candidate field, not just
            # a broken scheme. The cliche and predictable-rhyme cases are
            # precisely where a writer reaches for the obvious replacement, so
            # they are precisely where the modal exclusion has to be applied.
            wants = any(f.code in RHYME_FINDINGS for f in fs)
            if wants and groups:
                # ONE `joint_field` PER PLACE. On an ordinary end-rhyme
                # mandate there is one place, so this is the one call it
                # always was, over the same calls in the same order —
                # byte-identical (test_revise.py pins the field).
                for sk, ks in _by_slot.items():
                    _sl = _slot_of[ks[0]]
                    _calls = [self._slot_word(lines, m, k, x, endwords)
                              for k in ks for x in dict(groups)[k]]
                    _calls = [c for c in dict.fromkeys(_calls) if c]
                    _cur = self._incumbent(lines, ln, _sl)
                    if _calls:
                        _off, _forb, _drop = self.joint_field_screened(
                            _calls, exclude=(_cur,), profile=profile)
                    else:
                        _off, _forb, _drop = [], [], []
                    _jc = (len(_calls) > 1 and not _off and not _forb)
                    # THE PER-CALL FALLBACK (`MISSING.md` M-202). Run ONLY
                    # when the conjunction came back empty at a place with
                    # more than one call, and run through the SAME screened
                    # door the joint offer uses, so a word reachable here is
                    # a word the joint offer would have been allowed to name.
                    # A call nothing answers contributes NO entry rather than
                    # an empty one: "asked and nothing came back" and "not
                    # asked" are the same answer here, because every call is
                    # asked, and an empty tuple in the list would be read as
                    # a menu (doctrine 20 is satisfied by the count of
                    # entries against the count of calls, printed by the
                    # renderers).
                    _bycall = []
                    if _jc:
                        for _c1 in _calls:
                            _o1, _f1, _d1 = self.joint_field_screened(
                                [_c1], exclude=(_cur,), profile=profile)
                            if _o1:
                                _bycall.append((_c1, tuple(_o1)))
                    b.fields_by_slot[sk] = SlotField(
                        slot=_sl, labels=tuple(m.labels[k] for k in ks),
                        calls=tuple(_calls), incumbent=_cur or "",
                        offered=_off, forbidden=_forb,
                        violated=sk in _viol_slots,
                        joint_conflict=_jc,
                        dropped=tuple(_drop),
                        by_call=tuple(_bycall))
                _pf = b.fields_by_slot.get(_primary)
                calls = list(_pf.calls) if _pf else []
                # THE INCUMBENT AT THIS LINE'S OWN BINDING SITE — the
                # PRIMARY place. For a default slot this is `qf._endword`
                # exactly as before — which `verify()`'s RULE 3 compares
                # against, so the two must stay the same function or the
                # corollary that makes "took the modal candidate" true of
                # every entry stops holding.
                cur = self._incumbent(lines, ln, b.slot)
                if calls:
                    b.candidates, b.forbidden_modal = (list(_pf.offered),
                                                       list(_pf.forbidden))
                    b.screened_out = tuple(_pf.dropped)
                    # SET HERE AND NOWHERE ELSE — this is the one statement
                    # that `joint_field` ran, so an EMPTY head can be told
                    # apart from a head nobody asked for. See the field.
                    b.field_computed = True
                    # THE DOOR THE FIELD WAS READ AT, SET WHERE THE FIELD IS
                    # SET AND NOWHERE ELSE (`MISSING.md` M-139) -- the same
                    # discipline `field_computed` one line up is under.
                    b.schema_route_note = self.field_note(m, groups)
                    # A CONJUNCTION IS EMPTY AT ONE PLACE, never across
                    # places (M-184): two families at two places are two
                    # questions, and neither is unsatisfiable for the
                    # other's sake.
                    b.joint_conflict = _pf.joint_conflict
                    # M-202 — carried out of the SlotField beside the flag
                    # it is conditional on, so no reader can have one
                    # without the other.
                    b.partial_by_call = _pf.by_call
                # THE WORD CURRENTLY THERE, ON ITS OWN FIELD SINCE
                # 2026-08-16. It used to be APPENDED to `forbidden_modal`,
                # which put two rules in one list under doctrine 9's name —
                # see the two fields' own comments. `joint_field` above has
                # already dropped it from the OFFER via `exclude=(cur,)`;
                # this records it so a renderer can state the second rule
                # instead of mislabelling it as the first.
                #
                # NOT SUBTRACTED FROM THE HEAD, deliberately. A word can be
                # the incumbent AND genuinely modal — measured on this repo's
                # own `MODAL_DRAFT`, where BOTH briefed lines sit on a word
                # that is already inside their own head — and removing it
                # from `forbidden_modal` would make `verify()` stop rejecting
                # a revision that MOVES a different line onto it. The two
                # fields overlap on purpose; what they no longer do is answer
                # for each other.
                b.forbidden_incumbent = cur or ""
            briefs.append(b)
        return briefs

    # -- verification -----------------------------------------------------

    def verify(self, before, after, mandate=None, targeted=None,
               profile=None, blueprint=None, subdivision=None, assume=None):
        """Did the revision earn its acceptance? -> dict, never a score.

        `targeted` is the set of line numbers the caller claimed to revise.
        Lines outside it must be untouched: the loop revises flagged lines
        only, and a model that quietly rewrites the whole draft has replaced
        the work rather than revised it.

        RAISES `NoMandate` with no mandate. Accepting a revision on the
        strength of the slop floor alone, with no rhyme requirement declared,
        is the same vacuous pass `brief` used to print.

        `blueprint`/`subdivision`/`assume` pass through to `inspect()` on
        BOTH `before` and `after`, against the SAME placements (a line's bar
        and beat do not move when its words do) — so a revision that fixes
        the flagged rhyme and breaks the meter is caught by the diff below
        exactly the way one that fixes the rhyme and breaks another rhyme
        already is. No separate meter-specific rejection rule exists.

        `out["blueprint_declared"]` says whether meter/function were asked at
        all — see `inspect()`'s own key of the same name. `fixed`/`new` are
        unaffected either way: a finding that is absent because it was never
        asked is absent from BOTH `before` and `after` identically and
        cancels out of the diff, same as one that is absent because it is
        genuinely clean.
        """
        out = {"accepted": False, "reasons": [],
               "blueprint_declared": blueprint is not None}
        m = self.mandate(before, mandate)
        if len(before) != len(after):
            out["reasons"].append(
                f"line count changed {len(before)} -> {len(after)}; the loop "
                f"revises lines, it does not restructure the draft")
            return out
        changed = {i + 1 for i in range(len(before))
                   if before[i].strip() != after[i].strip()}
        if targeted is not None:
            stray = changed - set(targeted)
            if stray:
                out["reasons"].append(
                    f"lines {sorted(stray)} were changed but not targeted; "
                    f"revise flagged lines only")
                return out
        b_before = {b.line_no: b for b in self.brief(before, m,
                                                    profile=profile)}
        f_before = self.inspect(before, m, profile=profile,
                                blueprint=blueprint, subdivision=subdivision,
                                assume=assume)
        f_after = self.inspect(after, m, profile=profile,
                               blueprint=blueprint, subdivision=subdivision,
                               assume=assume)

        def codes(f):
            """The finding MULTISET, keyed so a diff can tell two of a kind
            apart AND count how many of each it holds.

            A whole-draft finding used to key on `(0, code)` alone. That was
            right while every one of them was unique per draft
            (`OUT_OF_CALIBRATED_LENGTH`, `MANDATE_NOT_INDEPENDENT`), and it
            stopped being right when a draft could carry FOUR
            `MANDATE_GROUPS_INDISTINGUISHABLE` at once: dissolving one of the
            four would leave the code present and `verify` would report
            "nothing was fixed" about a revision that fixed something. So a
            whole finding that carries locations keys on its FIRST line —
            still a 2-tuple, still sorts, and now one key per finding.

            A PIVOT LINE HAS THE SAME SHAPE OF BUG, FOUND THE SAME WAY THE
            FIRST ONE WAS: measuring, not assuming. A line answering two
            mandated groups at once can carry TWO `SCHEME_VIOLATION`
            findings — one per group — and a revision that fixes one while
            breaking the OTHER still shows the same `(line, "SCHEME_
            VIOLATION")` key before and after, so a plain set diff reports
            it as neither fixed nor new: a real regression, invisible. This
            key stays a bare 2-tuple on purpose (three real call sites
            outside this module test per-line membership as `(line, code)
            in res["new"]`, and every one of those codes is genuinely
            singular per line) — the multiplicity is carried in the COUNT
            returned here instead, and the caller below diffs it as a
            multiset rather than a set. Doctrine 47 again: a loop that
            cannot see the change it asked for is a rubber stamp in the
            other direction, and that is exactly as true of a count as it
            is of a key.
            """
            return ([(ln, x.code) for ln, fs in f["per_line"].items()
                     for x in fs]
                    + [(min(x.locations) if x.locations else 0, x.code)
                       for x in f["whole"]])

        def severities(f):
            """(loc, code) -> severity, over the same keys `codes()` mints.

            A NOTE IS NOT A FLAG here either — `report()` already draws this
            line for what a WRITER sees; the acceptance gate below drew it
            nowhere, and MODAL_RHYME (doctrine 9 asked of a pair that
            already passes) is what exposed it: a tier-2 backtrack that
            fixes a real SCHEME_VIOLATION by landing on `mind`'s own most
            conventional rhyme was rejected outright for "introducing" a
            finding whose entire declared purpose is to be disclosed, not
            enforced (doctrine 7 — a floor may not order the permitted
            region, and blocking a correct fix on a NOTE is ordering it).
            """
            d = {}
            for ln, fs in f["per_line"].items():
                for x in fs:
                    d[(ln, x.code)] = x.severity
            for x in f["whole"]:
                d[(min(x.locations) if x.locations else 0,
                   x.code)] = x.severity
            return d

        cb, ca = collections.Counter(codes(f_before)), collections.Counter(
            codes(f_after))
        # Counter subtraction keeps only the POSITIVE remainder per key: a
        # key whose count is unchanged (2 before, 2 after) nets to zero on
        # both sides and lands in neither -- exactly a plain set diff's
        # behaviour, and where the count genuinely moves this is the fix.
        gone, new = set(cb - ca), set(ca - cb)
        # A finding that named something RIGHT cannot have been FIXED by its
        # own removal (`SATISFACTION_FINDINGS`). Split rather than dropped:
        # doctrine 24 says a rule that would delete a category must relabel,
        # and the whole defect here was a regression wearing a repair's name.
        broken = {k for k in gone if k[1] in SATISFACTION_FINDINGS}
        fixed = gone - broken
        out["fixed"] = sorted(fixed)
        out["broken"] = sorted(broken)
        out["new"] = sorted(new)
        sev = severities(f_before)
        sev.update(severities(f_after))
        new_flags = {k for k in new if sev.get(k) == "flag"}
        out["new_flags"] = sorted(new_flags)
        out["new_notes"] = sorted(new - new_flags)
        out["mandate"] = m
        out["independent"] = m.independent()

        # RULE 3 — the modal exclusion, enforced rather than merely suggested
        # ===============================================================
        # TAKING REQUIRES A CHANGE — FIXED 2026-08-16, FOUND BY RUNNING
        # `verify` ON A DRAFT `revise` HAD JUST CONVERGED ON.
        # ===============================================================
        # `revise` returned SUCCESS and this method, handed the SAME
        # before/after pair with the same mandate, blueprint and
        # subdivision, returned `REJECTED — L2 took the modal candidate
        # 'stairs'`. One question, two answers, from two surfaces of one
        # module (doctrine 1), and the rejection's own sentence is FALSE:
        # L2 did not TAKE 'stairs', L2 already ended on 'stairs' and was
        # revised somewhere else in the line.
        #
        # `forbidden_modal` CARRIED TWO RULES AT ONCE — the modal region
        # (doctrine 9, do not pass the band by reaching for the most
        # predictable word) and `brief()`'s incumbent clause, *"the word
        # currently there is itself excluded"*. MEASURED on the pair that
        # exposed this: `modal_field('four')` is `['door','more','before',
        # 'shore','sore','or']` with and without the exclusion, so
        # **`stairs` is not a modal candidate for `four` under any
        # spelling** — it was on the list only as the incumbent.
        #
        # ~~The LAST entry is `brief()`'s incumbent clause~~ — STRUCK
        # 2026-08-16, THE SAME DAY IT WAS WRITTEN, and it was this comment's
        # own sentence. There is no positional convention: the incumbent was
        # appended only `if cur not in b.forbidden_modal`, so whenever the
        # word already there is ALSO genuinely modal it was never appended
        # at all and no entry was "last". That is not a corner case —
        # measured on this repo's `MODAL_DRAFT`, BOTH briefed lines are in
        # it, which is exactly why `quality/test_verbs.py` §22's equality
        # passed. Nothing indexed `[-1]`, so the code was never wrong; the
        # prose was, and a future reader could have implemented against it.
        #
        # THE RULES ARE TWO FIELDS NOW (`forbidden_modal` /
        # `forbidden_incumbent`) and this block reads each from its own,
        # so neither branch can answer for the other.
        #
        # THE END-WORD TEST IS THE WHOLE FIX, and it is a statement about
        # what this rule ASKS. Doctrine 9 is about REACHING for the
        # obvious answer; a line whose end word is byte-identical before
        # and after reached for nothing. So a revision that leaves the end
        # word alone and repairs the line elsewhere — the meter, the
        # phrasing — is outside this rule entirely, and charging it here
        # states a taking that did not happen.
        #
        # IT DOES NOT WEAKEN THE RULE, because the incumbent clause's real
        # work is done by RULE 4 one block below: a line that keeps its
        # end word keeps its rhyme finding, so "nothing was fixed" refuses
        # it unless the revision repaired something ELSE — which is
        # precisely the case this guard exists to let through. And
        # doctrine 7 is the reason it must be let through: a line already
        # sitting on a conventional word may still have its METER fixed,
        # and blocking that would be the floor ordering the region it
        # already passed (`MODAL_RHYME` is a NOTE for the same reason).
        #
        # THE FIELD IS STILL READ OFF `before` AND THAT IS DELIBERATE.
        # Recomputing it against `after` was the other candidate fix and
        # it is doctrine 48: a revision that repairs the rhyme clears the
        # finding, so `brief(after)` offers no field, so the rule could
        # never fire on any accepted revision. The field belongs to the
        # state in which the line was flagged and a replacement was being
        # searched for — which is also the field the WRITER was shown, so
        # the offer and the enforcement stay the same object.
        #
        # THE SKIP IS DISCLOSED, NOT SWALLOWED (doctrine 20): a line that
        # kept a forbidden end word is a different outcome from a line
        # that was never on the list, and `modal_endword_unchanged` keeps
        # the two apart in the returned dict.
        modal_hits = []
        modal_kept = []
        for ln in changed:
            b = b_before.get(ln)
            # BOTH FIELDS, OR THE DISCLOSURE IS DELETED BY THE SPLIT. Gating
            # on `forbidden_modal` alone would `continue` past every line
            # whose only exclusion is its incumbent — which is the exact
            # shape of the pair defect C was found on — and
            # `modal_endword_unchanged` would silently go empty.
            if not b or not (b.forbidden_modal or b.forbidden_incumbent):
                continue
            # AT THE BRIEF'S OWN PLACE (M-184): `_endword` at the default
            # slot, exactly as before, and the bound span otherwise.
            got = self._incumbent(after, ln, b.slot)
            was = self._incumbent(before, ln, b.slot)
            if got == was:
                # KEPT, not taken. `was` IS `b.forbidden_incumbent` here —
                # both are `_endword` of the same `before` line — so the
                # equality is an INVARIANT and testing it at run time would
                # be a check that cannot fail (doctrine 48, and the audit
                # caught this branch's first draft doing exactly that). The
                # invariant is asserted where it belongs, in
                # `quality/test_revise.py` §42's precision check, which is
                # what would go red if the field were ever populated from
                # anything but `_endword`. Only `got`'s truthiness is a real
                # condition: an unreadable end word is empty on both sides.
                if got:
                    modal_kept.append((ln, got))
                continue
            if got in b.forbidden_modal:
                modal_hits.append((ln, got))
        out["modal_endword_unchanged"] = modal_kept
        if modal_hits:
            out["reasons"].append(
                "; ".join(f"L{ln} took the modal candidate {w!r}"
                          for ln, w in modal_hits)
                + " — it passes the band and it is the most predictable word "
                  "in the field, which is the slop direction (doctrine 9)")
            out["modal_violations"] = modal_hits
            return out

        if not fixed:
            out["reasons"].append(
                "nothing was fixed"
                + (f" — the only finding(s) removed were {sorted(broken)}, "
                   f"which record a requirement or licence HOLDING, so "
                   f"ending one is a regression and not a repair"
                   if broken else ""))
            return out
        if len(new_flags) > self.rdecl.allow_net_new:
            out["reasons"].append(
                f"introduced {len(new_flags)} new flagged finding(s) "
                f"{sorted(new_flags)} while fixing {len(fixed)}; a revision "
                f"may not trade one defect for another")
            return out
        out["accepted"] = True
        note_disclosure = (f", disclosing {len(out['new_notes'])} new "
                            f"note(s) {out['new_notes']}"
                            if out["new_notes"] else "")
        # DISCLOSED, NOT REJECTED ON. These are convention-measured (doctrine
        # 6), and the declared half already has a flag of its own.
        note_disclosure += (
            f", and ENDING {len(broken)} holding requirement/licence "
            f"{sorted(broken)}" if broken else "")
        out["reasons"].append(
            f"fixed {len(fixed)}, introduced {len(new_flags)}{note_disclosure}, "
            f"changed only {sorted(changed)}")
        # RULE 3's SKIP, SAID OUT LOUD. Appended rather than folded into the
        # line above so the existing sentence is byte-identical wherever this
        # is empty, which is every revision that moved its end word.
        if modal_kept:
            out["reasons"].append(
                "; ".join(f"L{ln} KEPT its end word {w!r} — the INCUMBENT, "
                          f"not a modal candidate"
                          + ("; it is also in this line's modal head"
                             if w in (b_before[ln].forbidden_modal
                                      if ln in b_before else ()) else "")
                          for ln, w in modal_kept)
                + " — RULE 3 asks whether a modal candidate was TAKEN, and a "
                  "byte-identical end word took nothing. Disclosed because "
                  "'kept the word already there' and 'was never excluded at "
                  "all' are different outcomes (doctrine 20)")
        if not m.independent():
            out["reasons"].append(
                "the mandate was DERIVED from the rhyme graph, so this "
                "acceptance is not independent evidence about the rhyme "
                "structure (doctrine 14); it is evidence about the floor, the "
                "refusals and the untouched lines")
        return out

    # -- reporting --------------------------------------------------------

    def report(self, lines, mandate=None, stream=sys.stdout, profile=None,
               blueprint=None, subdivision=None, assume=None):
        briefs = self.brief(lines, mandate, profile=profile,
                            blueprint=blueprint, subdivision=subdivision,
                            assume=assume)
        found = self.inspect(lines, mandate, profile=profile,
                             blueprint=blueprint, subdivision=subdivision,
                             assume=assume)
        m, rep = found["mandate"], found["grade"]
        print("\n" + m.describe(), file=stream)
        # WHAT WAS GRADED, before one figure about it. This header's counts
        # get quoted into RESULTS documents and pinned; without this line
        # they name no input, and a same-length wrong draft produces a
        # plausible report nobody can tell apart from the right one — see
        # `draft_fingerprint`'s docstring for the day that happened.
        print(f"  draft: {len(lines)} line(s), md5 "
              f"{draft_fingerprint(lines)}", file=stream)
        # COLLISIONS ARE FOUR COUNTS TOO, AND THIS LINE PRINTED ONE — 2026-08-16.
        # Two lines of this same header keep `mandated`/`judged`/`refused`
        # apart for doctrine 79, and the paragraph forty lines down makes the
        # argument in full ("report the counts SEPARATELY rather than summing
        # things that ask different things of a writer") — and then the last
        # field on the same line summed a set whose members this class already
        # splits into three codes on purpose. `_collision_code` exists because
        # SCHEME_COLLISION, NEAR_COLLISION and REPEAT_ACROSS_GROUPS "are three
        # different reports": an unintended RHYME the mandate did not ask for,
        # a pair that IS NOT A RHYME under this harness's own band, and the
        # same word twice. A writer does something different about each, and
        # `collisions 4` said nothing about which.
        #
        # MEASURED on the four-line refrain fixture: `collisions 4` was two
        # REPEATs and two rhymes, reported as one integer. The breakdown is
        # built from the SAME call the per-line findings use, so the header
        # and the findings below it cannot disagree about a pair's kind.
        _ccounts = {}
        for _c in rep["collisions"]:
            _code = self._collision_code(_c["relation"], _c.get("undeclared"))
            _ccounts[_code] = _ccounts.get(_code, 0) + 1
        _cshort = {"SCHEME_COLLISION": "unasked-rhyme",
                   "NEAR_COLLISION": "not-a-rhyme",
                   "REPEAT_ACROSS_GROUPS": "same-word",
                   "COLLISION_UNDECLARED": "undeclared"}
        _cbits = "  ".join(
            f"{_cshort[k]} {_ccounts[k]}"
            for k in ("SCHEME_COLLISION", "NEAR_COLLISION",
                      "REPEAT_ACROSS_GROUPS", "COLLISION_UNDECLARED")
            if _ccounts.get(k))
        print(f"  mandated {rep['pairs_mandated']}   "
              f"judged {rep['pairs_judged']}   "
              f"refused {rep['pairs_refused']}   "
              f"violations {len(rep['violations'])}", file=stream)
        # ON ITS OWN LINE, and NOT summed with the mandate counts above: a
        # collision is a pair the mandate did NOT ask about, so it shares no
        # denominator with `mandated`/`judged`/`refused` and putting it at the
        # end of that row invited exactly that reading. The total is still
        # printed — it is the size of one set and that is a real quantity —
        # but never alone.
        print(f"  collisions {len(rep['collisions'])}"
              + (f" — {_cbits}" if _cbits else
                 " (none; the kinds are not listed because there is nothing "
                 "to attribute)"), file=stream)
        flagged = {b.line_no for b in briefs}
        piv = m.overlapping_lines()
        if piv:
            # A pivot that carries no finding is not a line with nothing to
            # say about it: it is a line ANSWERING TWO GROUPS AT ONCE and
            # succeeding, which is the only thing in this report that a letter
            # scheme could not have stated at all. `brief` stays flagged-lines-
            # only, so the fact is reported here rather than manufactured into
            # a finding.
            for ln in piv:
                labs = [m.labels[k] for k in m.groups_of(ln)]
                state = "FLAGGED" if ln in flagged else "answers all of them"
                print(f"  PIVOT L{ln} in groups {', '.join(labs)} — {state}",
                      file=stream)
        # A NOTE IS NOT A FLAG, and this header used to count them the same:
        # a draft could have every one of its flagged-looking lines carry
        # nothing but severity-"note" collisions and not one candidate
        # field, and still be printed as N problems when the true count of
        # things a writer must revise was zero. Doctrine 79's shape one
        # layer up: report the counts SEPARATELY rather than summing things
        # that ask different things of a writer.
        revise_me = sorted(b.line_no for b in briefs
                           if any(f.severity == "flag" for f in b.findings))
        noted = [b.line_no for b in briefs if b.line_no not in set(revise_me)]
        print(f"\nREVISION BRIEF — {len(revise_me)} line(s) TO REVISE, "
              f"{len(noted)} carrying notes only, of {len(lines)}",
              file=stream)
        if not revise_me and noted:
            print(f"  NO LINE REQUIRES REVISION. The draft satisfies every "
                  f"one of the {rep['pairs_mandated']} pair(s) its mandate "
                  f"declares. The {len(noted)} line(s) below carry NOTES — "
                  f"things the loop observed and does not ask you to change. "
                  f"None of them earns a candidate field and that is a "
                  f"decision, not a gap: see `brief`'s 'WHY A COLLISION "
                  f"EARNS NO FIELD'.", file=stream)
        # RENDER SITE 2 OF 6 -- the REPORT-level statement of what the
        # field is, beside the coordinates it was read at. Whole-report and
        # therefore DECLARATION-level: the report cannot speak for one line's
        # groups, so it states the half a report can state and says so by
        # asking group 0. A report with no group says nothing.
        for _l in schema_route_lines(
                self.field_note(m, [(0, ())]) if m.groups else None, "  "):
            print(_l, file=stream)
        print(f"  candidate field: {self.field_declaration()}; "
              f"modal_exclusion={self.rdecl.modal_exclusion}; "
              f"group_merge={self.rdecl.group_merge!r}; "
              f"frequency source eng-song conditional, falling back to "
              f"data/opensubtitles_en_50k.tsv (see `modal_field`)",
              file=stream)
        for f in found["whole"]:
            loc = (f" (lines {', '.join(map(str, f.locations))})"
                   if f.locations else "")
            print(f"  [whole draft] {f.code}: {f.message}{loc}", file=stream)
            if f.locations:
                print(f"      {f.evidence}", file=stream)
        for b in briefs:
            print(b, file=stream)
        if not briefs and not found["whole"]:
            print("  nothing flagged; the draft passes the floor and every "
                  f"one of the {rep['pairs_mandated']} pair(s) the declared "
                  f"mandate requires", file=stream)
        if revise_me:
            print(f"\n  The loop does not write. Revise lines {revise_me}, "
                  f"then call verify(before, after, mandate, targeted=...).",
                  file=stream)
        else:
            print("\n  The loop does not write, and here it is not asking "
                  "you to. Nothing above is a line to revise.", file=stream)
        return briefs


if __name__ == "__main__":
    r = Reviser()
    demo = ["The candle burned and set the room on fire",
            "He said the word and then he turned to go",
            "And all night long she nursed a small desire",
            "She never asked the thing she had to know"]
    r.report(demo, "ABAB")

    print("\n" + "=" * 70)
    print("THE SAME FOUR LINES UNDER AN OVERLAPPING COVER")
    print("Line 3 is put in two groups at once: it must answer L1 AND L2.")
    print("There is no letter string for that — a letter is a property of a")
    print("LINE, and this is a property of a RELATION (doctrine 2).")
    print("=" * 70)
    r.report(demo, SC.Cover(n_lines=4, groups=[[1, 3], [2, 3]]))

    print("\n" + "=" * 70)
    print("AND WITH NO MANDATE AT ALL — the vacuous pass, refused")
    print("=" * 70)
    try:
        r.brief(demo)
    except NoMandate as e:
        print(f"NoMandate: {e}")
