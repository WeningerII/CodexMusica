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

Both halves reproduced on the song this repo wrote:

    python3 lyric_harness.py partition examples/never_been_to_a_scene.txt
        -> 41 lines, the cliques OVERLAP, NO LETTER SCHEME EXISTS
    python3 lyric_harness.py brief examples/never_been_to_a_scene.txt
        -> "nothing flagged"

The second is not a clean draft. With no scheme declared NOTHING WAS MANDATED,
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
from quality import frequency as FREQ  # noqa: E402
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
                  "SHARED_SUFFIX", "REPEAT_IN_VERSE"}

#: The three things a band-passing pair that shares no mandated group can BE.
#: One code said all three until 2026-08-11 and its message said "rhyme" for
#: every one of them; doctrine 3 says identity is not rhyme and a near-relation
#: is not rhyme, and doctrine 24 says a rule that would delete a category must
#: relabel instead. Measured on this repo's two songs: of 38 collisions, 15
#: (39.5%) are ASSONANCE — pairs THIS MODULE'S OWN `grade()` calls a violation
#: when they are mandated — and 8 are REPEAT. So the single code was making a
#: claim the same module contradicts three functions away.
COLLISION_FINDINGS = {"SCHEME_COLLISION", "NEAR_COLLISION",
                      "REPEAT_ACROSS_GROUPS"}

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

    max_rounds: int = 4
    #: a revision is rejected if it introduces MORE new findings than it fixes
    allow_net_new: int = 0

    #: WHAT A MANDATE MEANS WHERE THE GROUPS OVERLAP. "conjunctive" — a line
    #: in k groups must answer ALL k. "disjunctive" — answering one of them
    #: excuses the rest. The argument for the default is in schemes.py, and
    #: the short form is that the disjunctive reading gets WEAKER the more
    #: structure you declare, which is the vacuous pass this module exists to
    #: close. The alternative stays reachable so the choice is measurable
    #: rather than settled by fiat (the shape of doctrine 82/84).
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
    #: cosmetic — without it the rule fires on `cherokee_bill`'s C[5,6] and
    #: H[15,16] (`man`~`gun` at 0.878), which satisfy the mandate jointly and
    #: are NOT collisions, and the loop would be volunteering an opinion about
    #: a rhyme the writer did not make on a song that passes 14/14.
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

        verdicts, satisfied = [], {k: True for k in range(len(m.groups))}
        for (i, j, k) in pairs:
            if (i, j) in refused:
                satisfied[k] = None if satisfied[k] else satisfied[k]
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
            if why:
                satisfied[k] = False

        # Doctrine 3, resolved by DECLARATION rather than by guess.
        licensed = self.rdecl.repeat_licence == "refrain"
        violations = [v for v in verdicts if v["why"] and
                      not (licensed and v["relation"] == "REPEAT")]
        repeats = [v for v in verdicts if v["relation"] == "REPEAT"]

        # The DISJUNCTIVE reading, kept reachable so the default is a measured
        # choice. A pivot's failure in one group is excused when it fully
        # satisfies another group it belongs to.
        excused = []
        if self.rdecl.overlap_rule == "disjunctive":
            keep = []
            for v in violations:
                out_ = False
                for ln in v["lines"]:
                    others = [k2 for k2 in m.groups_of(ln)
                              if k2 != v["group"] and satisfied.get(k2)]
                    if others:
                        out_ = True
                        break
                (excused if out_ else keep).append(v)
            violations = keep

        # A pair that band-passes while sharing NO group. Under a letter
        # scheme this was "unintended rhyme across scheme letters"; under a
        # cover it is the same statement without the letters.
        collisions = []
        n = len(lines)
        for i in range(n):
            for j in range(i + 1, n):
                if set(m.groups_of(i + 1)) & set(m.groups_of(j + 1)):
                    continue
                s = matrix[i][j]
                if s["total"] >= THETA_COLLISION:
                    collisions.append({
                        "lines": (i + 1, j + 1),
                        "endwords": (endwords[i], endwords[j]),
                        "score": s["total"], "relation": s["relation"]})
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
        across groups, the identity the projection was forced to hide. On
        `never_been_to_a_scene` that is 16 of 26 collisions and on
        `cherokee_bill` 4 of 12: one true sentence about the mandate,
        rendered as twenty accusations against sixteen innocent lines.

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
    def _collision_code(relation):
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
        """
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
        for i, (p, text) in enumerate(zip(places, lines)):
            ln = i + 1
            lf = FT.fit_line(text, p, subdivision=subdivision, assume=assume,
                             line_index=i)
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
        if self.rdecl.repeat_licence == "refrain":
            for v in rep["repeats"]:
                i, j = v["lines"]
                add(j, Finding(
                    "REFRAIN_REPEAT", "note",
                    f"L{i} and L{j} are the same end word inside group "
                    f"{v['label']}, licensed as a refrain",
                    "the licence was DECLARED (repeat_licence='refrain'), not "
                    "earned: doctrine 18 wants a count AND a declared fraction "
                    "of the item's pairs before a repetend is a form, and this "
                    "loop measures neither", [i, j]))
        for v in rep["excused"]:
            i, j = v["lines"]
            add(j, Finding(
                "MANDATE_EXCUSED_BY_OVERLAP", "note",
                f"L{i}/L{j} fail group {v['label']} and were EXCUSED because "
                f"overlap_rule='disjunctive'",
                f"{v['why']}. Under the declared default (conjunctive) this "
                f"is a violation. The disjunctive reading gets weaker the "
                f"more structure you declare, which is why it is reachable "
                f"and not the default.", [i, j]))
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
            code = self._collision_code(c["relation"])
            pair = (f"{c['endwords'][0]!r} ~ {c['endwords'][1]!r} "
                    f"{c['score']:.3f} {c['relation']}")
            gi = ", ".join(m.labels[k] for k in m.groups_of(i)) or "free"
            gj = ", ".join(m.labels[k] for k in m.groups_of(j)) or "free"
            if code == "SCHEME_COLLISION":
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
                near += 1
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
        if blueprint is not None:
            m_per, m_whole = self._meter_findings(lines, blueprint,
                                                   subdivision, assume)
            for ln, fs in m_per.items():
                for f in fs:
                    add(ln, f)
            whole.extend(m_whole)
        return {"per_line": per, "whole": whole, "mandate": m, "grade": rep,
                "merges": merges}

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
        `inspect()` — see there for what they add. A line whose only findings
        are meter (no rhyme finding) is still briefed, with an empty
        candidate field: `wants` below only checks `RHYME_FINDINGS`, and a
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
        """
        out = {"accepted": False, "reasons": []}
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
            """The finding set, keyed so a diff can tell two of a kind apart.

            A whole-draft finding used to key on `(0, code)` alone. That was
            right while every one of them was unique per draft
            (`OUT_OF_CALIBRATED_LENGTH`, `MANDATE_NOT_INDEPENDENT`), and it
            stopped being right when a draft could carry FOUR
            `MANDATE_GROUPS_INDISTINGUISHABLE` at once: dissolving one of the
            four would leave the code present and `verify` would report
            "nothing was fixed" about a revision that fixed something. So a
            whole finding that carries locations keys on its FIRST line —
            still a 2-tuple, still sorts, and now one key per finding.
            Doctrine 47: a loop that cannot see the change it asked for is a
            rubber stamp in the other direction.
            """
            return {(ln, x.code) for ln, fs in f["per_line"].items()
                    for x in fs} | {(min(x.locations) if x.locations else 0,
                                     x.code) for x in f["whole"]}

        cb, ca = codes(f_before), codes(f_after)
        fixed, new = cb - ca, ca - cb
        out["fixed"] = sorted(fixed)
        out["new"] = sorted(new)
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
        if len(new) > self.rdecl.allow_net_new:
            out["reasons"].append(
                f"introduced {len(new)} new finding(s) {sorted(new)} while "
                f"fixing {len(fixed)}; a revision may not trade one defect "
                f"for another")
            return out
        out["accepted"] = True
        out["reasons"].append(
            f"fixed {len(fixed)}, introduced {len(new)}, "
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
        # A NOTE IS NOT A FLAG, and this header counted them the same. On the
        # mandate `never_been_to_a_scene` was written to, it printed "17
        # line(s) flagged" while every one of the 17 carried nothing but
        # severity-"note" collisions and not one earned a candidate field — a
        # certificate of 17 problems on a draft with zero. Doctrine 79's shape
        # one layer up: report the counts SEPARATELY rather than summing
        # things that ask different things of a writer.
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
