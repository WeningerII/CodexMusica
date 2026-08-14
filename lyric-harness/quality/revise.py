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
import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (NEAR_RELATIONS, NO_ANCHOR,  # noqa: E402
                           RHYME_RELATIONS, CandidateEngine, Declaration,
                           Lexicon, admits, best_score, bron_kerbosch,
                           line_anchors, readability_records,
                           refusals_for_pairs)
from quality import fit as FT  # noqa: E402
from quality import grid as GR  # noqa: E402
from quality import frequency as FREQ  # noqa: E402
from quality import readability as RD  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.floor import Finding, SlopFloor  # noqa: E402
from quality.schemes import Mandate, NoMandate  # noqa: E402

#: `Mandate` and `NoMandate` are re-exported: a caller of this loop should not
#: have to import two modules to declare what a draft is held to, or to catch
#: the refusal when it declares nothing.
__all__ = ["Brief", "Mandate", "NoMandate", "ReviseDeclaration", "Reviser",
           "COLLISION_FINDINGS", "RHYME_FINDINGS", "THETA_COLLISION"]

#: Findings that mean "this line's RHYME needs replacing". Each earns a
#: candidate field with the modal region excluded.
#:
#: NO COLLISION CODE IS IN HERE, AND THAT IS A DECISION RATHER THAN AN
#: OVERSIGHT — see `Reviser.brief`'s "WHY A COLLISION EARNS NO FIELD".
RHYME_FINDINGS = {"SCHEME_VIOLATION", "CLICHE_PAIR", "PREDICTABLE_RHYME",
                  "SHARED_SUFFIX", "REPEAT_IN_VERSE", "MODAL_RHYME"}

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
#: unintended rhyme. Same constant the spine's `check_scheme` uses, kept equal
#: on purpose: the two must not drift — and the SET this module reports is
#: still exactly `check_scheme`'s. What changed is only what each member is
#: CALLED. Typing a finding is not moving a threshold (doctrine 58).
THETA_COLLISION = 0.9


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
class Brief:
    """What a caller is asked to do. Line-scoped, never whole-draft."""
    line_no: int
    text: str
    findings: list = field(default_factory=list)
    must_rhyme_with: tuple = None       # (line_no, endword) — the FIRST group
    candidates: list = field(default_factory=list)
    forbidden_modal: list = field(default_factory=list)
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
    #: The `(field_depth, field_band)` the candidate field was read at, as a
    #: printable string. A count with no setting beside it is the defect
    #: doctrine 58 is about, and this flag is a count of zero.
    field_declaration: str = "field_depth=?, field_band=?"

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
            out.append(f"    must answer group {lab} {mem}: {shown}")
        if self.must_answer and len(self.must_answer) > 1:
            out.append(f"    L{self.line_no} is a PIVOT — it is in "
                       f"{len(self.must_answer)} groups and must answer every "
                       f"one of them (conjunctive; doctrine 2)")
        if self.joint_conflict:
            out.append(f"    NO JOINT CANDIDATE at {self.field_declaration}: "
                       f"nothing in the lexicon answers all of those groups "
                       f"at once. The mandate, not the line, is what needs "
                       f"revising.")
        if self.must_rhyme_with and not self.must_answer:
            n, w = self.must_rhyme_with
            out.append(f"    must rhyme with L{n} ({w!r})")
        if self.forbidden_modal:
            out.append(f"    FORBIDDEN (modal — passing the band by taking "
                       f"these is the slop direction): "
                       f"{', '.join(self.forbidden_modal)}")
        if self.candidates:
            out.append(f"    offered: {', '.join(self.candidates[:12])}"
                       + (" ..." if len(self.candidates) > 12 else ""))
        if self.keep:
            out.append(f"    keep unchanged: {', '.join(map(str, self.keep))}")
        return "\n".join(out)


class Reviser:
    """Grades a draft, briefs a revision, and verifies the result."""

    def __init__(self, lex=None, decl=None, rdecl=None, floor=None):
        self.lex = lex or Lexicon()
        self.decl = decl or Declaration()
        self.rdecl = rdecl or ReviseDeclaration()
        self.floor = floor or SlopFloor()
        self._engine = None
        self._matrix_cache = {}
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
        """
        return SC.mandate(spec, n_lines=len(lines))

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
        """
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
                if admits(s, theta) or s["relation"] == "REPEAT":
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

    # -- grading the mandate ----------------------------------------------

    def grade(self, lines, mandate=None, profile=None):
        """The mandate, diffed against the graph. -> dict, group-scoped.

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
        refusals = refusals_for_pairs(records, [(i - 1, j - 1)
                                                for i, j, _ in pairs])
        refused = {r["lines"] for r in refusals}
        for r in refusals:
            i, j = r["lines"]
            r["groups"] = [m.labels[k] for k in
                           sorted(set(m.groups_of(i)) & set(m.groups_of(j)))]

        # WHICH (LINE, GROUP) PAIRS WERE NEVER JUDGED. A refusal is not a
        # failure (doctrine 79) and it is not a pass either (doctrine 20), so
        # it is kept apart from `unanswered` below rather than folded into it:
        # the disjunctive excusal may buy nothing with an UNKNOWN, and the
        # reason it may not is different from the reason it may buy nothing
        # with a failure.
        unknown = set()
        verdicts = []
        for (i, j, k) in pairs:
            if (i, j) in refused:
                unknown.add((i, k))
                unknown.add((j, k))
                continue
            s = matrix[i - 1][j - 1]
            rel = s["relation"]
            why = None
            if rel == "REPEAT":
                why = "REPEAT not rhyme (identical word)"
            elif rel in NEAR_RELATIONS:
                why = f"{rel} not rhyme (conjunctive band)"
            elif rel == NO_ANCHOR:
                why = "NO_ANCHOR: nothing to compare (not a rhyme verdict)"
            elif s["total"] < self.decl.theta_rhyme:
                why = f"below theta_rhyme={self.decl.theta_rhyme}"
            verdicts.append({"lines": (i, j), "group": k,
                             "label": m.labels[k],
                             "members": list(m.groups[k]),
                             "endwords": (endwords[i - 1], endwords[j - 1]),
                             "score": s["total"], "relation": rel,
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
                        "undeclared": bool(und),
                        "undeclared_lines": (
                            [ln for ln in (i + 1, j + 1)
                             if not m.in_scope(ln)] if und else [])})
        return {"mandate": m, "endwords": endwords, "readability": records,
                "verdicts": verdicts, "violations": violations,
                "repeats": repeats, "excused": excused,
                "refusals": refusals, "collisions": collisions,
                "pairs_mandated": len(pairs),
                "pairs_refused": len(refusals),
                "pairs_judged": len(pairs) - len(refusals)}

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
                ok = True
                for i, j in cross:
                    s = matrix[i - 1][j - 1]
                    if (i, j) not in edges or not (
                            admits(s, th) or s["relation"] == "REPEAT"):
                        ok = False
                        break
                if not ok:
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

    @staticmethod
    def _collision_code(relation, undeclared=False):
        """One code per RELATION, because they are three different reports.

        `SCHEME_COLLISION`      the pair is a rhyme the mandate did not ask
                                for. The only one of the three the old single
                                code was ever right about.
        `NEAR_COLLISION`        the scalar clears `THETA_COLLISION` and the
                                relation is ASSONANCE or CONSONANCE, so this
                                module's own `grade()` would call it a
                                VIOLATION if the pair were mandated. Calling
                                it an unintended RHYME is the brief and the
                                verdict asking different questions
                                (`RESULTS_REVISION_LOOP.md` §1) surviving in
                                a second place.
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
                    f.code, "flag" if not f.satisfiable else "note",
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
        return per, whole

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
        """
        song, hooks = GR.song_from_blueprint(blueprint)
        for l, text in zip(song.lines, lines):
            l.text = text
        rep = GR.song_function_report(song, hooks=hooks,
                                      rhyme_key=GR.rime_cmudict(self.lex))
        whole = []
        for f in rep["findings"]:
            whole.append(Finding(
                f.code, "flag" if f.code == "HOOK_ABSENT" else "note",
                f.message, f.evidence, []))
        for r in rep["refusals"]:
            whole.append(Finding(r.code, "note", r.message, r.evidence, []))
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
        """
        pairs = m.pairs0()
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

        rep = self.grade(lines, m, profile=profile)
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
                f"{v['endwords'][0]!r} ~ {v['endwords'][1]!r})", [i, j]))
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
            i, j = v["lines"]
            wi, wj = (w.lower() for w in v["endwords"])
            _, forbidden_i = self.modal_field(wi, profile=profile)
            _, forbidden_j = self.modal_field(wj, profile=profile)
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
                f"{self.rdecl.modal_exclusion}; set it to 0 to silence this "
                "the same way it silences the reactive check. Doctrine 9's "
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
                    f"{c['score']:.3f} {c['relation']}")
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
                ev = (f"scalar {c['score']:.3f} >= {THETA_COLLISION} (the "
                      f"collision cut) but `admits()` is FALSE (the mandate "
                      f"cut), so this same module would call the pair a "
                      f"VIOLATION if L{i} and L{j} were mandated together. "
                      f"See the whole-draft note below")
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
                f"when `admits()` does: the scalar AND a relation in "
                f"RHYME_RELATIONS. So the two halves of this module ask "
                f"different questions about the same pair, which is the "
                f"defect `RESULTS_REVISION_LOOP.md` §1 found in `_field` and "
                f"fixed there, surviving here. The SET is not changed: it is "
                f"still exactly `check_scheme`'s, and the two constants must "
                f"not drift. What is changed is that each member is now "
                f"typed, because doctrine 24 says a rule that would delete a "
                f"category must relabel instead — an ASSONANCE running across "
                f"a song is a real sonic event and deleting it would be the "
                f"worse defect. `lyric_harness.check_scheme` carries the same "
                f"untyped message and is not this cell's file", []))
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
        # `blueprint_declared` is NOT a Finding. Meter/function are an OPT-IN
        # third source (see this method's own docstring) and omitting them is
        # the ordinary, common case, not a defect on the draft -- so it does
        # not belong in `whole`, which callers scan for things WRONG with the
        # song. It exists because `per_line`/`whole` being silent about meter
        # is indistinguishable from meter having been checked and found
        # clean, and a caller reading this dict alone (the CLI already prints
        # its own disclosure separately; see `_say_blueprint` in
        # lyric_harness.py) has no other way to tell the two apart.
        return {"per_line": per, "whole": whole, "mandate": m, "grade": rep,
                "merges": merges, "blueprint_declared": blueprint is not None}

    # -- the brief --------------------------------------------------------

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

        THE BRIEF AND THE VERDICT HAVE TO ASK THE SAME QUESTION. `grade()`
        accepts a mandated pair when `admits()` does: the scalar clears
        `theta_rhyme` AND the relation is in `RHYME_RELATIONS`. This function
        used to keep the first half and drop the second, so it offered a
        writer words that the verdict following the brief calls ASSONANCE or
        CONSONANCE and counts as a violation. Measured on this repo's own
        song, that was 58 of 336 offered words (17.3%) — concentrated on the
        cluster codas, `ones` at 15/24 and `went`/`sent` at 7/24 — and it is
        the same defect in two directions, because the FORBIDDEN list is the
        head of this same population: 29 of 101 forbidden entries were words
        no writer could have taken.

        `CandidateEngine` scores with `score()` on one pronunciation; the
        grader scores with `best_score()` over every variant of both sides.
        The check below uses `best_score`, so the field agrees with the
        verdict rather than with the engine — which is what makes an offered
        word a promise instead of a suggestion.
        """
        return [self._field_one(w, profile=profile) for w in calls]

    def _field_one(self, word, profile=None):
        rd = self.rdecl
        key = (word, self._promote(), rd.field_depth, rd.field_band, profile,
               self.decl.theta_rhyme)
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
                if admits(s, self.decl.theta_rhyme):
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
        fields = self._field(calls, profile=profile)
        if not fields or not fields[0]:
            return [], []
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
        k = self.rdecl.modal_exclusion
        forbidden = ranked[:k]
        drop = set(forbidden) | {w.lower() for w in exclude if w}
        rest = []
        for w in ranked[k:]:
            if w in drop:
                continue
            # single letters are lexicon artifacts, not words a writer can use
            if len(w) < 2 and w not in ("a", "i"):
                continue
            rest.append(w)
            if len(rest) >= self.rdecl.offered:
                break
        return rest, forbidden

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
            # ANY rhyme-implicating finding earns a candidate field, not just
            # a broken scheme. The cliche and predictable-rhyme cases are
            # precisely where a writer reaches for the obvious replacement, so
            # they are precisely where the modal exclusion has to be applied.
            wants = any(f.code in RHYME_FINDINGS for f in fs)
            groups = m.partners(ln)
            if wants and groups:
                # EVERY group, not one. The old `_partner` picked the first
                # mate of the line's single letter, which is all a letter
                # scheme can express and is wrong for a pivot by construction.
                for k, mates in groups:
                    b.must_answer.append(
                        (m.labels[k], list(m.groups[k]),
                         [(x, endwords[x - 1]) for x in mates]))
                calls = [endwords[x - 1] for _, mates in groups for x in mates]
                calls = [c for c in dict.fromkeys(calls) if c]
                first = groups[0][1]
                if first:
                    b.must_rhyme_with = (first[0], endwords[first[0] - 1])
                cur = self.floor.qf._endword(lines[ln - 1])
                if calls:
                    b.candidates, b.forbidden_modal = self.joint_field(
                        calls, exclude=(cur,), profile=profile)
                    b.joint_conflict = (len(calls) > 1
                                        and not b.candidates
                                        and not b.forbidden_modal)
                # the word currently there is itself excluded: it is what was
                # flagged, so re-proposing it is not a revision
                if cur and cur not in b.forbidden_modal:
                    b.forbidden_modal.append(cur)
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
        fixed, new = set(cb - ca), set(ca - cb)
        out["fixed"] = sorted(fixed)
        out["new"] = sorted(new)
        sev = severities(f_before)
        sev.update(severities(f_after))
        new_flags = {k for k in new if sev.get(k) == "flag"}
        out["new_flags"] = sorted(new_flags)
        out["new_notes"] = sorted(new - new_flags)
        out["mandate"] = m
        out["independent"] = m.independent()

        # RULE 3 — the modal exclusion, enforced rather than merely suggested
        modal_hits = []
        for ln in changed:
            b = b_before.get(ln)
            if not b or not b.forbidden_modal:
                continue
            got = self.floor.qf._endword(after[ln - 1])
            if got in b.forbidden_modal:
                modal_hits.append((ln, got))
        if modal_hits:
            out["reasons"].append(
                "; ".join(f"L{ln} took the modal candidate {w!r}"
                          for ln, w in modal_hits)
                + " — it passes the band and it is the most predictable word "
                  "in the field, which is the slop direction (doctrine 9)")
            out["modal_violations"] = modal_hits
            return out

        if not fixed:
            out["reasons"].append("nothing was fixed")
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
        out["reasons"].append(
            f"fixed {len(fixed)}, introduced {len(new_flags)}{note_disclosure}, "
            f"changed only {sorted(changed)}")
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
        print(f"  mandated {rep['pairs_mandated']}   "
              f"judged {rep['pairs_judged']}   "
              f"refused {rep['pairs_refused']}   "
              f"violations {len(rep['violations'])}   "
              f"collisions {len(rep['collisions'])}", file=stream)
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
