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
"""

import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (NEAR_RELATIONS, CandidateEngine,  # noqa: E402
                           Declaration, Lexicon, check_scheme)
from quality.floor import Finding, SlopFloor  # noqa: E402

#: Findings that mean "this line's RHYME needs replacing". Each earns a
#: candidate field with the modal region excluded.
RHYME_FINDINGS = {"SCHEME_VIOLATION", "CLICHE_PAIR", "PREDICTABLE_RHYME",
                  "SHARED_SUFFIX", "REPEAT_IN_VERSE"}


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


@dataclass
class Brief:
    """What a caller is asked to do. Line-scoped, never whole-draft."""
    line_no: int
    text: str
    findings: list = field(default_factory=list)
    must_rhyme_with: tuple = None       # (line_no, endword)
    candidates: list = field(default_factory=list)
    forbidden_modal: list = field(default_factory=list)
    keep: list = field(default_factory=list)

    def __str__(self):
        out = [f"L{self.line_no}: {self.text}"]
        for f in self.findings:
            out.append(f"    - {f.code}: {f.message}")
        if self.must_rhyme_with:
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

    @property
    def engine(self):
        if self._engine is None:          # expensive; built on first need
            self._engine = CandidateEngine(self.lex, self.decl)
        return self._engine

    # -- inspection -------------------------------------------------------

    def inspect(self, lines, scheme=None):
        """-> {line_no: [Finding]} plus a 'whole' key for item-level findings.

        Two sources, deliberately kept apart: the CORRECTNESS engine says
        whether a mandated rhyme holds, the SLOP FLOOR says whether the writing
        is outside the range human verse occupied. They fail for different
        reasons and a caller should see which is which.
        """
        per, whole = {}, []
        for f in self.floor.check(lines, scheme):
            if f.locations:
                for ln in f.locations:
                    per.setdefault(ln, []).append(f)
            else:
                whole.append(f)
        if scheme and len(scheme) == len(lines):
            rep = check_scheme(self.lex, lines, scheme, self.decl)
            for (i, j, total, why) in rep["violations"]:
                per.setdefault(j, []).append(Finding(
                    "SCHEME_VIOLATION", "flag",
                    f"L{i} and L{j} are both '{scheme[i - 1]}' but do not rhyme",
                    f"{why} (score {total:.3f})", [i, j]))
            for (i, j, total, why) in rep["collisions"]:
                per.setdefault(j, []).append(Finding(
                    "SCHEME_COLLISION", "note",
                    f"L{i} and L{j} rhyme but are different scheme letters",
                    f"{why} (score {total:.3f})", [i, j]))
        return {"per_line": per, "whole": whole}

    @staticmethod
    def _partner(ln, n_lines, scheme, finding):
        """Which line does `ln` have to answer? The scheme knows; failing that,
        the finding's own locations do."""
        if scheme and len(scheme) == n_lines:
            letter = scheme[ln - 1].upper()
            mates = [i + 1 for i, c in enumerate(scheme)
                     if c.upper() == letter and i + 1 != ln]
            if mates:
                return mates[0]
        others = [x for x in finding.locations if x != ln]
        return others[0] if others else None

    # -- the brief --------------------------------------------------------

    def modal_field(self, call_word, exclude=()):
        """-> (offered, forbidden). The forbidden set is the MOST FREQUENT
        band-passing candidates, which are the most predictable ones.

        `CandidateEngine` sorts by score then frequency rank, so its head is
        precisely the modal region. Handing that head to a writer is handing
        them fire/desire.
        """
        res = self.engine.candidates(call_word, n=200)
        cands = res.get("candidates", [])
        passing = [c for c in cands if c["score"] >= self.decl.theta_rhyme]
        if not passing:
            return [], []
        # rank order is frequency order inside the engine's own index; recover
        # it by asking the lexicon directly so the rule does not depend on the
        # engine's sort staying stable
        ranked = sorted(passing,
                        key=lambda c: self.lex.freq_rank.get(c["word"], 10 ** 9))
        k = self.rdecl.modal_exclusion
        forbidden = [c["word"] for c in ranked[:k]]
        drop = set(forbidden) | {w.lower() for w in exclude}
        rest = []
        for c in ranked[k:]:
            w = c["word"]
            if w in drop:
                continue
            # single letters are lexicon artifacts, not words a writer can use
            if len(w) < 2 and w not in ("a", "i"):
                continue
            rest.append(w)
            if len(rest) >= self.rdecl.offered:
                break
        return rest, forbidden

    def brief(self, lines, scheme=None):
        """-> [Brief], one per line that needs work. Lines with no findings are
        absent, because the loop revises FLAGGED LINES ONLY."""
        found = self.inspect(lines, scheme)
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
            partner = None
            for f in fs:
                if f.code in RHYME_FINDINGS and len(f.locations) >= 1:
                    partner = self._partner(ln, len(lines), scheme, f)
                    if partner:
                        break
            if partner:
                call = self.floor.qf._endword(lines[partner - 1])
                # the word currently there is itself excluded: it is what was
                # flagged, so re-proposing it is not a revision
                cur = self.floor.qf._endword(lines[ln - 1])
                b.must_rhyme_with = (partner, call)
                b.candidates, b.forbidden_modal = self.modal_field(
                    call, exclude=(cur,))
                if cur and cur not in b.forbidden_modal:
                    b.forbidden_modal.append(cur)
            briefs.append(b)
        return briefs

    # -- verification -----------------------------------------------------

    def verify(self, before, after, scheme=None, targeted=None):
        """Did the revision earn its acceptance? -> dict, never a score.

        `targeted` is the set of line numbers the caller claimed to revise.
        Lines outside it must be untouched: the loop revises flagged lines
        only, and a model that quietly rewrites the whole draft has replaced
        the work rather than revised it.
        """
        out = {"accepted": False, "reasons": []}
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
        b_before = {b.line_no: b for b in self.brief(before, scheme)}
        f_before = self.inspect(before, scheme)
        f_after = self.inspect(after, scheme)

        def codes(f):
            return {(ln, x.code) for ln, fs in f["per_line"].items()
                    for x in fs} | {(0, x.code) for x in f["whole"]}

        cb, ca = codes(f_before), codes(f_after)
        fixed, new = cb - ca, ca - cb
        out["fixed"] = sorted(fixed)
        out["new"] = sorted(new)

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
        return out

    # -- reporting --------------------------------------------------------

    def report(self, lines, scheme=None, stream=sys.stdout):
        briefs = self.brief(lines, scheme)
        found = self.inspect(lines, scheme)
        print(f"\nREVISION BRIEF — {len(briefs)} line(s) flagged of "
              f"{len(lines)}", file=stream)
        for f in found["whole"]:
            print(f"  [whole draft] {f.code}: {f.message}", file=stream)
        for b in briefs:
            print(b, file=stream)
        if not briefs and not found["whole"]:
            print("  nothing flagged; the draft passes the floor and the "
                  "declared scheme", file=stream)
        print("\n  The loop does not write. Revise the flagged lines, then "
              "call verify(before, after, scheme, targeted=...).", file=stream)
        return briefs


if __name__ == "__main__":
    r = Reviser()
    demo = ["The candle burned and set the room on fire",
            "He said the word and then he turned to go",
            "And all night long she nursed a small desire",
            "She never asked the thing she had to know"]
    r.report(demo, "ABAB")
