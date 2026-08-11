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

import copy
import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (NEAR_RELATIONS, NO_ANCHOR,  # noqa: E402
                           CandidateEngine, Declaration, Lexicon, admits,
                           best_score, bron_kerbosch, line_anchors,
                           readability_records, refusals_for_pairs)
from quality import schemes as SC  # noqa: E402
from quality.floor import Finding, SlopFloor  # noqa: E402
from quality.schemes import Mandate, NoMandate  # noqa: E402

#: `Mandate` and `NoMandate` are re-exported: a caller of this loop should not
#: have to import two modules to declare what a draft is held to, or to catch
#: the refusal when it declares nothing.
__all__ = ["Brief", "Mandate", "NoMandate", "ReviseDeclaration", "Reviser",
           "RHYME_FINDINGS", "THETA_COLLISION"]

#: Findings that mean "this line's RHYME needs replacing". Each earns a
#: candidate field with the modal region excluded.
RHYME_FINDINGS = {"SCHEME_VIOLATION", "CLICHE_PAIR", "PREDICTABLE_RHYME",
                  "SHARED_SUFFIX", "REPEAT_IN_VERSE"}

#: Score at or above which two lines that share NO group are reported as an
#: unintended rhyme. Same constant the spine's `check_scheme` uses, kept equal
#: on purpose: the two must not drift.
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
    joint_conflict: bool = False

    def __str__(self):
        out = [f"L{self.line_no}: {self.text}"]
        for f in self.findings:
            out.append(f"    - {f.code}: {f.message}")
        for lab, mem, calls in self.must_answer:
            shown = ", ".join(f"L{n} ({w!r})" for n, w in calls)
            out.append(f"    must answer group {lab} {mem}: {shown}")
        if self.must_answer and len(self.must_answer) > 1:
            out.append(f"    L{self.line_no} is a PIVOT — it is in "
                       f"{len(self.must_answer)} groups and must answer every "
                       f"one of them (conjunctive; doctrine 2)")
        if self.joint_conflict:
            out.append("    NO JOINT CANDIDATE: nothing in the lexicon "
                       "answers all of those groups at once. The mandate, not "
                       "the line, is what needs revising.")
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

    def inspect(self, lines, mandate=None, profile=None):
        """-> {line_no: [Finding]} plus a 'whole' key for item-level findings.

        Two sources, deliberately kept apart: the CORRECTNESS engine says
        whether a mandated rhyme holds, the SLOP FLOOR says whether the writing
        is outside the range human verse occupied. They fail for different
        reasons and a caller should see which is which.
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
        for c in rep["collisions"]:
            i, j = c["lines"]
            add(j, Finding(
                "SCHEME_COLLISION", "note",
                f"L{i} and L{j} rhyme but share no mandated group",
                f"unintended rhyme across groups (score {c['score']:.3f}; "
                f"{c['endwords'][0]!r} ~ {c['endwords'][1]!r})", [i, j]))
        return {"per_line": per, "whole": whole, "mandate": m, "grade": rep}

    # -- the brief --------------------------------------------------------

    def _field(self, calls):
        """-> ordered band-passing candidate words for each call word."""
        fields = []
        for w in calls:
            res = self.engine.candidates(w, n=200)
            passing = [c["word"] for c in res.get("candidates", [])
                       if c["score"] >= self.decl.theta_rhyme]
            fields.append(passing)
        return fields

    def joint_field(self, calls, exclude=()):
        """-> (offered, forbidden). The candidate field that answers EVERY
        call word, with the most frequent members forbidden as modal.

        For a single call this is `modal_field` and behaves exactly as it did.
        For a PIVOT — a line in two groups — it is the intersection, and the
        intersection can be EMPTY. That is not a failure of the writer; it is
        the mandate reporting that its own conjunction is unsatisfiable at
        this line, which is a sentence a letter scheme cannot form because it
        cannot put a line in two classes to begin with.

        Ties are broken on (frequency rank, position in the first field) and
        never on set iteration order — doctrine 66, a tie broken by iterating
        a set is a result that does not reproduce.
        """
        fields = self._field(calls)
        if not fields or not fields[0]:
            return [], []
        common = set(fields[0])
        for f in fields[1:]:
            common &= set(f)
        order = {w: i for i, w in enumerate(fields[0])}
        ranked = sorted(common,
                        key=lambda w: (self.lex.freq_rank.get(w, 10 ** 9),
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

    def modal_field(self, call_word, exclude=()):
        """-> (offered, forbidden). The forbidden set is the MOST FREQUENT
        band-passing candidates, which are the most predictable ones.

        `CandidateEngine` sorts by score then frequency rank, so its head is
        precisely the modal region. Handing that head to a writer is handing
        them fire/desire.
        """
        return self.joint_field([call_word], exclude=exclude)

    def brief(self, lines, mandate=None, profile=None):
        """-> [Brief], one per line that needs work. Lines with no findings are
        absent, because the loop revises FLAGGED LINES ONLY.

        RAISES `NoMandate` when handed nothing to check against. It used to
        return `[]`, which a caller printed as "nothing flagged".
        """
        found = self.inspect(lines, mandate, profile=profile)
        m = found["mandate"]
        _, endwords, _, _ = self._matrix(lines, profile=profile)
        briefs = []
        for ln in sorted(found["per_line"]):
            fs = found["per_line"][ln]
            b = Brief(line_no=ln, text=lines[ln - 1], findings=fs,
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
                        calls, exclude=(cur,))
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
               profile=None):
        """Did the revision earn its acceptance? -> dict, never a score.

        `targeted` is the set of line numbers the caller claimed to revise.
        Lines outside it must be untouched: the loop revises flagged lines
        only, and a model that quietly rewrites the whole draft has replaced
        the work rather than revised it.

        RAISES `NoMandate` with no mandate. Accepting a revision on the
        strength of the slop floor alone, with no rhyme requirement declared,
        is the same vacuous pass `brief` used to print.
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
        f_before = self.inspect(before, m, profile=profile)
        f_after = self.inspect(after, m, profile=profile)

        def codes(f):
            return {(ln, x.code) for ln, fs in f["per_line"].items()
                    for x in fs} | {(0, x.code) for x in f["whole"]}

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

    def report(self, lines, mandate=None, stream=sys.stdout, profile=None):
        briefs = self.brief(lines, mandate, profile=profile)
        found = self.inspect(lines, mandate, profile=profile)
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
        print(f"\nREVISION BRIEF — {len(briefs)} line(s) flagged of "
              f"{len(lines)}", file=stream)
        for f in found["whole"]:
            print(f"  [whole draft] {f.code}: {f.message}", file=stream)
        for b in briefs:
            print(b, file=stream)
        if not briefs and not found["whole"]:
            print("  nothing flagged; the draft passes the floor and every "
                  f"one of the {rep['pairs_mandated']} pair(s) the declared "
                  f"mandate requires", file=stream)
        print("\n  The loop does not write. Revise the flagged lines, then "
              "call verify(before, after, mandate, targeted=...).",
              file=stream)
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
