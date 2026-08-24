#!/usr/bin/env python3
"""WHICH FINDINGS CAN REFUSE ANYTHING — the census, not the claim.

THE OWNER'S STANDING RULE, 2026-08-23: *"I fucking hate seeing prose, flags,
notes, etc... and I refuse to finish work unless we have the appropriate gate,
band, constraint."* A note is a RECORD; only a gate is an ENFORCEMENT, and
work that ends in a note has not closed its loop.

The rule is easy to state and impossible to keep by memory across the finding
codes this tree can emit — which is doctrine 48's own subject. This module
makes it a command: for every code this harness can emit, can ANYTHING refuse
on it? The size of the problem is MEASURED by the run rather than asserted
here, because a count written into prose is a threshold nobody wrote down
(doctrine 58) and this file's first draft carried one that was wrong in both
coordinates at once — "55 codes in eleven modules" against a measured 67 codes
constructed in FOUR files (`quality/revise.py`, `fit.py`, `floor.py`,
`grid.py`). `PINNED` below is the figure, and `--check` is what re-derives it.

WHAT COUNTS AS A GATE, enumerated so the answer is checkable rather than
argued. A code is GATED when at least one of these can act on it:

  1. SEVERITY FLAG — `verify()` gates acceptance on `new_flags`, and
     `song`/`revise` exit 3 while one stands. A code that can be constructed
     with severity "flag" is gated by construction.
  2. MANDATORY_PURSUE / `--pursue` — `quality/loop.py` holds a line open on a
     pursued NOTE until it clears, and the CLI exits nonzero if it does not.
     This is the mechanism doctrine 9 needed and the reason a note is not
     automatically toothless.
  3. LENGTH_GATE_CODES — `quality/floor.py` names the codes a verb may not
     exit 0 on. A whole-draft note the aggregate refuses to certify past.

Anything else is DISCLOSED-ONLY: emitted, printed, and unable to stop
anything.

THREE COUNTS, NEVER SUMMED (doctrine 79). GATED / DISCLOSED-ONLY /
UNDECIDABLE, and an undecidable code is not quietly counted as gated — that
would be this census answering its own question in the direction that flatters
it.

UNDECIDABLE IS 0 SINCE 2026-08-23, and getting there corrected this instrument
as much as it corrected the tree. A severity can be DECLARED in four
spellings, and a census that knows only the first reports decided codes as
open — over-reporting in its OWN flattering direction, because a bigger
UNDECIDABLE makes the tree look worse and this module look more necessary:

  a `severity` FIELD    `floor.Finding` / `readability.Finding`, read at the
                        index the dataclass actually declares it at, never a
                        position this file assumes (four classes in this tree
                        are called `Finding` and they do not share a layout).
  ANOTHER FIELD NAME    `FitFinding.satisfiable` — False means the declaration
                        CANNOT BE MET, which is a contradiction and therefore
                        a flag. 18 codes, decided at the emitter the whole
                        time, read as undecidable until this census learned
                        the word. `SEVERITY_SPELLING` declares the mapping.
  a PER-CODE TABLE      `grid.SEVERITY` rules on all 21 shape codes in the
                        module that defines them. It used to be one inline
                        conditional in `revise._function_findings`, which is
                        why the whole SHAPE layer was unreadable from its own
                        emitter. `_declared_tables` reads it as data.
  a DOWNGRADE CEILING   `floor.py` writes `sev("flag")`, whose body is
                        `default if exact else "note"` — so the argument is
                        the strongest severity reachable, and a code that can
                        reach "flag" under a calibrated profile CAN refuse.
                        `_ceiling_severity` resolves it, including through a
                        local (`rsev` takes "note" on one branch and "flag" on
                        another; the honest answer is that flag is REACHABLE),
                        and REFUSES rather than guessing on any other shape.

AND A DISCLOSED-ONLY CODE IS NOT AUTOMATICALLY A DEFECT. Doctrine 6 is the
counterweight and it is load-bearing: a CONVENTION a writer may depart from
cannot be the thing that fails a check, so the shape layer's notes
(`DOWNBEAT_LOCKED`, `QUATRAIN_LOCK`) are notes ON PURPOSE and promoting them
would be the error. What this census produces is the LIST, so the question
"should this one gate?" is asked of each code by a person rather than
answered by whoever last edited the file.

Run:   python3 quality/gate_census.py
Check: python3 quality/gate_census.py --check     (exit 3 if the census moved)
Test:  python3 quality/test_gate_census.py
"""

import ast
import collections
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

__all__ = ["census", "summarize", "PINNED", "FINDING_CONSTRUCTORS"]

#: The constructors that MAKE a finding. Named rather than pattern-matched so
#: a new one is added deliberately; a constructor missing from this tuple
#: makes its codes invisible to the census, which is the shape of defect this
#: module exists to find in other layers.
#:
#: `GridFinding` JOINED ON THE FIRST RUN, and it is the census catching its
#: own version of the defect: the first draft named two constructors, measured
#: 46 codes, and silently omitted the SHAPE layer's entirely — `HOOK_ABSENT`,
#: `QUATRAIN_LOCK`, `DOWNBEAT_LOCKED` and the rest of `quality/grid.py`, which
#: are the findings CLAUDE.md's own gap 10 calls "the only checks in the repo
#: that ask about the song as a whole SHAPE". A census blind to a whole layer
#: reports that layer as fully gated, which is the flattering direction.
FINDING_CONSTRUCTORS = ("Finding", "FitFinding", "GridFinding")

#: Modules whose findings are not part of the writing path's answer — the
#: one-shot corpus instruments. Declared, because an exclusion nobody writes
#: down is a threshold nobody wrote down (doctrine 58).
SKIP_PREFIX = ("test_", "audit_", "mutate", "redteam")


#: CONSTRUCTORS THAT DECLARE THEIR SEVERITY UNDER ANOTHER NAME.
#:
#: A class with no field called `severity` has not necessarily left the
#: question open — it may have answered it in its own vocabulary, and reading
#: only the literal spelling would report a DECIDED code as undecidable. That
#: is this census failing in its own flattering direction: an inflated
#: UNDECIDABLE makes the tree look worse than it is and this instrument look
#: more necessary than it is.
#:
#: `FitFinding.satisfiable` is the live case and it cost 18 codes. `False`
#: means the DECLARATION CANNOT BE MET — a contradiction, not a style call —
#: which `quality/fit.py` has always treated as a hard flag and
#: `quality/revise.py` has always mapped that way. The first census read the
#: field NAME, found nothing, and filed all 18 as undecidable; they were
#: decided at the emitter the whole time, and 6 of them GATE.
#:
#: A per-code table (`grid.SEVERITY`) needs no entry here: those codes carry
#: their severity in a mapping this census reads directly, via
#: `_declared_tables`.
SEVERITY_SPELLING = {
    "FitFinding": ("satisfiable", {False: "flag", True: "note"}, True),
}


def _spelled_severity(call, spelling):
    """-> the severity a call declares under a non-`severity` field name.

    `spelling` is (field, mapping, default) where `default` is the value the
    dataclass itself defaults to when the keyword is absent — so an omitted
    keyword is read as the DECLARED DEFAULT rather than as silence. Reading it
    as silence would put every call that accepts the default back into
    UNDECIDABLE, which is the same over-reporting one layer in.
    """
    field, mapping, default = spelling
    for kw in call.keywords:
        if kw.arg == field:
            if isinstance(kw.value, ast.Constant):
                return mapping.get(kw.value.value, "computed")
            return "computed"
    return mapping.get(default, "computed")


#: THE DOWNGRADE WRAPPER. `quality/floor.py` writes `sev("flag")`, whose body
#: is `return default if exact else "note"` — so the ARGUMENT IS A CEILING and
#: the downgrade is a declared condition (an extrapolated measurement may not
#: carry a rejection, doctrine 15). A code whose ceiling is "flag" CAN refuse,
#: under a profile whose range actually covers the draft, so reporting it as
#: undecidable understates what the tree enforces.
CEILING_CALLS = ("sev",)


def _ceiling_severity(expr, scope):
    """-> the highest severity an expression can reach, or None if unreadable.

    Resolves exactly two shapes and REFUSES on anything else, because a
    resolver that guesses is worse than one that declines (doctrine 20):

      `sev("flag")`   a wrapper whose literal argument is the ceiling.
      a bare NAME     a local assigned in the same function; every assignment
                      to it is collected and the strongest wins. `floor.py`'s
                      `rsev` takes "note" on one branch and "flag" on another,
                      and the honest answer is that "flag" is REACHABLE.
    """
    if isinstance(expr, ast.Call) and isinstance(expr.func, ast.Name) \
            and expr.func.id in CEILING_CALLS and expr.args \
            and isinstance(expr.args[0], ast.Constant):
        return expr.args[0].value
    if isinstance(expr, ast.Name):
        reach = set()
        for a in scope:
            if not (isinstance(a, ast.Assign) and len(a.targets) == 1
                    and isinstance(a.targets[0], ast.Name)
                    and a.targets[0].id == expr.id):
                continue
            got = _ceiling_severity(a.value, ())
            if got is None and isinstance(a.value, ast.Constant):
                got = a.value.value
            if got is None:
                return None            # one unreadable branch voids the answer
            reach.add(got)
        if reach:
            return "flag" if "flag" in reach else sorted(reach)[0]
    return None


def _declared_tables(paths):
    """-> {code: severity} merged from every module-level `SEVERITY` mapping.

    A module that owns a family of codes may rule on them in one table
    (`quality/grid.py`'s `SEVERITY`), which is the shape this census asked for
    and the shape a reader can audit in one screen. Read as data rather than
    imported, so a census run cannot be changed by an import side effect.
    """
    out = {}
    for p in paths:
        try:
            tree = ast.parse(open(p, encoding="utf-8").read())
        except (SyntaxError, OSError):
            continue
        for n in tree.body:
            if not (isinstance(n, ast.Assign) and len(n.targets) == 1
                    and isinstance(n.targets[0], ast.Name)
                    and n.targets[0].id == "SEVERITY"
                    and isinstance(n.value, ast.Dict)):
                continue
            for k, v in zip(n.value.keys, n.value.values):
                if isinstance(k, ast.Constant) and isinstance(v, ast.Constant):
                    out[k.value] = v.value
    return out


def _severities(path, sev_index):
    """-> {code: set of severities as written at the call site}.

    A severity that is not a literal is recorded as `computed`: the call
    passes `sev(...)` or a variable, and reading it would need the profile
    the call runs under. This module does not guess.
    """
    out = collections.defaultdict(set)
    try:
        tree = ast.parse(open(path, encoding="utf-8").read())
    except (SyntaxError, OSError):
        return out
    # EACH CALL'S ENCLOSING FUNCTION BODY, so a severity held in a local can
    # be resolved against the assignments that actually reach it. Built once
    # per file; a call outside any function gets an empty scope and therefore
    # resolves to nothing, which is the refusal and not a guess.
    scope = {}
    for fn in ast.walk(tree):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        stmts = tuple(ast.walk(fn))
        for c in stmts:
            if isinstance(c, ast.Call):
                scope[id(c)] = stmts
    for n in ast.walk(tree):
        if not (isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                and n.func.id in FINDING_CONSTRUCTORS):
            continue
        if not n.args or not isinstance(n.args[0], ast.Constant):
            continue
        code = n.args[0].value
        if not isinstance(code, str):
            continue
        # WHERE THE SEVERITY IS DECIDED — DERIVED FROM THE CONSTRUCTOR'S OWN
        # DATACLASS, never assumed from a position.
        #
        # THE FIRST DRAFT ASSUMED IT AND WAS WRONG, which is the correction
        # this function now carries. It hardcoded "severity is argument 1 for
        # everything except GridFinding", because `floor.Finding` and
        # `readability.Finding` are both `(code, severity, message, ...)`.
        # `FitFinding` is `(code, MESSAGE, evidence, kind, satisfiable, ...)`
        # and HAS NO SEVERITY FIELD AT ALL, so nine of `quality/fit.py`'s
        # codes had their MESSAGE read as a severity, failed the
        # flag/note literal test, and were filed `computed` when the honest
        # answer is `consumer-assigned` — the same bucket as the SHAPE layer.
        # The pinned split shipped wrong because of it.
        #
        # AND `Finding` NAMES FOUR DIFFERENT CLASSES IN THIS TREE
        # (`floor`, `readability`, `audit_corpus`, `rhyme_constraints`), of
        # which `rhyme_constraints.Finding` is `(type_name, verdict, extents,
        # ...)` and is not a coded finding at all. One name over four layouts
        # is doctrine 1's own case, and a census that reads them by position
        # is asserting a shape rather than reading one (doctrine 45).
        pos = sev_index.get(n.func.id, "unknown")
        if pos is None and n.func.id in SEVERITY_SPELLING:
            # THE CONSTRUCTOR DECLARES ITS SEVERITY UNDER ANOTHER NAME, and
            # refusing to read it would report a decided code as undecidable
            # — the census failing in ITS OWN flattering direction, since an
            # inflated UNDECIDABLE makes the tree look worse than it is and
            # the instrument look more necessary than it is.
            sev = _spelled_severity(n, SEVERITY_SPELLING[n.func.id])
        elif pos is None:
            sev = "consumer-assigned"          # the class declares no severity
        else:
            sev = "computed"                   # a field exists; not a literal
            if isinstance(pos, int) and len(n.args) > pos:
                arg = n.args[pos]
                if isinstance(arg, ast.Constant) and arg.value in ("flag", "note"):
                    sev = arg.value
                else:
                    reach = _ceiling_severity(arg, scope.get(id(n), ()))
                    if reach in ("flag", "note"):
                        sev = reach
        for kw in n.keywords:
            if kw.arg == "severity" and isinstance(kw.value, ast.Constant):
                sev = kw.value.value
        out[code].add(sev)
    return out


def severity_fields(paths):
    """-> {constructor: index of its `severity` field, or None if it has none}.

    READ off each dataclass's own field list. A constructor that gains or
    loses the field moves this map by itself, so the census cannot go on
    believing a layout the tree has stopped having.

    A name defined more than once (this tree has FOUR classes called
    `Finding`) resolves to the layout that actually declares a severity, and
    the disagreement is reported by `name_collisions` rather than silently
    resolved — two classes with one name is the thing to surface, not to pick
    between.
    """
    seen = collections.defaultdict(list)
    for p in paths:
        try:
            tree = ast.parse(open(p, encoding="utf-8").read())
        except (SyntaxError, OSError):
            continue
        for n in ast.walk(tree):
            if not isinstance(n, ast.ClassDef) or n.name not in FINDING_CONSTRUCTORS:
                continue
            fields = [b.target.id for b in n.body
                      if isinstance(b, ast.AnnAssign)
                      and isinstance(b.target, ast.Name)]
            idx = fields.index("severity") if "severity" in fields else None
            seen[n.name].append((os.path.basename(p), idx, tuple(fields)))
    out = {}
    for name, defs in seen.items():
        withsev = [d for d in defs if d[1] is not None]
        out[name] = withsev[0][1] if withsev else None
    return out, dict(seen)


def _gate_sets():
    """-> (pursued codes, length-gate codes). Read from the modules that
    OWN them, never respelled here: a second copy of a gate set is how a
    census starts disagreeing with the thing it is counting (doctrine 1)."""
    from quality.loop import MANDATORY_PURSUE
    from quality.floor import LENGTH_GATE_CODES
    return set(MANDATORY_PURSUE), set(LENGTH_GATE_CODES)


def _table_owner(paths, code):
    """-> the basename of the module whose `SEVERITY` table rules on `code`."""
    for p in paths:
        try:
            tree = ast.parse(open(p, encoding="utf-8").read())
        except (SyntaxError, OSError):
            continue
        for n in tree.body:
            if (isinstance(n, ast.Assign) and len(n.targets) == 1
                    and isinstance(n.targets[0], ast.Name)
                    and n.targets[0].id == "SEVERITY"
                    and isinstance(n.value, ast.Dict)
                    and any(isinstance(k, ast.Constant) and k.value == code
                            for k in n.value.keys)):
                return os.path.basename(p)
    return "?"


def census(root=None):
    """-> {code: {'severities', 'gates', 'verdict', 'files'}}."""
    root = root or HERE
    pursued, length_gate = _gate_sets()
    found = collections.defaultdict(lambda: {"severities": set(),
                                             "files": set()})
    paths = [os.path.join(root, f) for f in sorted(os.listdir(root))
             if f.endswith(".py")
             and not f.startswith(SKIP_PREFIX)]
    paths.append(os.path.join(os.path.dirname(root), "lyric_harness.py"))
    # DERIVE the layouts first: which constructor carries a severity, and where.
    sev_index, _defs = severity_fields(paths)
    ruled = _declared_tables(paths)
    for p in paths:
        for code, sevs in _severities(p, sev_index).items():
            found[code]["severities"] |= sevs
            found[code]["files"].add(os.path.basename(p))
    # A DECLARED TABLE IS ALSO AN EXISTENCE CLAIM. A code constructed with a
    # VARIABLE first argument is invisible to a scan for literals — the same
    # blindness that lost a whole constructor on this module's first run, one
    # argument in. `quality/grid.py`'s placement layer reaches `GridFinding`
    # through exactly one such site, so `SECTION_AT_EDGE` and its three
    # siblings were emitted by this tree and counted by nothing. The table
    # names them, so the census can too: a ruled code that no literal call
    # constructs is REAL and is folded in, attributed to the module whose
    # table declares it.
    for code, sev in ruled.items():
        if code not in found:
            found[code]["severities"].add(sev)
            found[code]["files"].add(_table_owner(paths, code))
    out = {}
    for code, rec in found.items():
        # A MODULE-LEVEL RULING OUTRANKS "the emitter said nothing". The
        # table IS the emitter's answer for these codes — `GridFinding.
        # severity` reads the very same mapping at run time — so a code the
        # table rules on is decided, not consumer-assigned.
        if code in ruled:
            rec["severities"] = {ruled[code]}
        gates = []
        if "flag" in rec["severities"]:
            gates.append("severity flag")
        if code in pursued:
            gates.append("MANDATORY_PURSUE")
        if code in length_gate:
            gates.append("LENGTH_GATE_CODES")
        if gates:
            verdict = "GATED"
        elif rec["severities"] == {"note"}:
            verdict = "DISCLOSED-ONLY"
        else:
            verdict = "UNDECIDABLE"
        out[code] = {"severities": sorted(rec["severities"]),
                     "gates": gates, "verdict": verdict,
                     "files": sorted(rec["files"])}
    return out


def summarize(c):
    """The three counts, never summed."""
    v = collections.Counter(r["verdict"] for r in c.values())
    und = [r for r in c.values() if r["verdict"] == "UNDECIDABLE"]
    return {"codes": len(c), "gated": v["GATED"],
            "disclosed_only": v["DISCLOSED-ONLY"],
            "undecidable": v["UNDECIDABLE"],
            "computed": sum(1 for r in und
                            if "computed" in r["severities"]),
            "consumer_assigned": sum(
                1 for r in und
                if "consumer-assigned" in r["severities"]
                and "computed" not in r["severities"])}


#: WHY EACH TOOTHLESS CODE IS TOOTHLESS — the DISPOSITION, ruled one at a time.
#:
#: The census's own sentence was *"what this census produces is the LIST, so
#: the question 'should this one gate?' is asked of each code by a person
#: rather than answered by whoever last edited the file."* A list nobody
#: answers is the defect one level up, so here are the answers.
#:
#: WHY THIS TABLE LIVES HERE AND NOT WITH THE CODES, which is the opposite of
#: where `grid.SEVERITY` had to go. A severity is CONSUMED at run time —
#: `revise.py` reads it to build a `Finding` — so it had to sit with the codes
#: or two layers would hold opinions. A disposition is consumed by NOBODY at
#: run time: it is a claim about the taxonomy, and its whole value is being
#: auditable in ONE screen. Split across four modules it would be 51 rulings
#: nobody can read side by side, which is how a taxonomy drifts.
#:
#: THE VOCABULARY IS CLOSED, and every entry carries the doctrine that
#: licenses it. `PROMOTE_CANDIDATE` is the one that is WORK rather than a
#: settled answer.
DISPOSITIONS = {
    # THE CITATION IS A COROLLARY AND IS WRITTEN AS ONE. This rule is
    # quoted as "doctrine 6" at 22 sites in this repository and doctrine 6
    # does not say it: 6 is "no weighted quality score, ever" and its check
    # (`test_floor.py`) verifies the floor emits a VECTOR and never a score.
    # The rule follows from 6 AND 7 together — taste belongs in a declaration
    # (6), and a floor may not order the region it already passed (7) — so a
    # convention, being a declared taste rather than a floor, may not reject.
    # It has NO NUMBER OF ITS OWN, and therefore no registry row and no
    # check, while governing 51 of 71 codes. `MISSING.md` M-78.
    "CONVENTION":  "a corollary of doctrines 6 and 7, not doctrine 6 alone — "
                   "measured against a labelled convention a writer is free "
                   "to depart from, so a flag would be the error and not the "
                   "fix",
    "REFUSAL":     "doctrine 79/20 — the harness could not answer. A refusal "
                   "is not a failure and putting it in a numerator charges "
                   "the wrong layer",
    "DISCLOSURE":  "a fact about the CALL or the MANDATE, not about the "
                   "draft. No rewrite moves it, so there is nothing for a "
                   "gate to demand",
    "SATISFIED":   "the finding records a requirement being MET. Gating it "
                   "would fail a draft for doing what it was asked",
    "NO_MOVE":     "a fact about the DECLARATION (bars, placement, span). "
                   "The loop's only move is a word swap on a named line, so a "
                   "flag would spend every round of `max_rounds` and report "
                   "ROUND_LIMIT — the `uncovered_bars` precedent verbatim",
    "UNCALIBRATED": "a count with no measured threshold. Its CALIBRATED "
                   "sibling already gates; this one cannot until somebody "
                   "measures the band (doctrine 16/58)",
    "PROMOTE_CANDIDATE": "factual, with no convention in it, and arguably "
                   "should gate. NOT promoted here: changing what refuses a "
                   "draft is the owner's call, and this table's job is to "
                   "put the question, not to answer it by editing",
}

#: One ruling per disclosed-only code. `--check` FAILS on an unruled one, so a
#: new note cannot join the silent majority without somebody deciding it
#: should — which is the gate this list did not have.
DISPOSITION = {
    # --- quality/grid.py: the SHAPE layer. Conventions, near enough entire.
    "DOWNBEAT_LOCKED": "CONVENTION",
    "METER_LOCKED": "CONVENTION",
    "PHRASE_LENGTH_LOCKED": "CONVENTION",
    "QUATRAIN_LOCK": "CONVENTION",
    "SECTION_LENGTH_LOCKED": "CONVENTION",
    "UNIFORM_ANACRUSIS": "CONVENTION",
    "RETURN_LENGTH_DRIFT": "CONVENTION",
    "RETURN_METER_DRIFT": "CONVENTION",
    "RETURN_SCHEME_DRIFT": "CONVENTION",
    "RETURN_SLOT_DRIFT": "CONVENTION",
    "RETURN_LOCKED": "CONVENTION",
    "RETURNS_WITH_SAME_WORDS": "CONVENTION",
    "BRIDGE_IS_A_VERSE": "CONVENTION",
    "CROSS_FUNCTION_REPRISE": "CONVENTION",
    "SINGLE_USE_RECURRED": "CONVENTION",
    "HOOK_CONFINED": "CONVENTION",
    # The placement layer (M-54): DEFINITIONAL, not conventional — a prechorus
    # with no chorus is mislabelled, not novel. It still cannot gate, and
    # M-54 settled why in those words: a section's position is a fact about
    # the declaration, no rewrite moves it, and a flag spends max_rounds.
    "SECTION_AT_EDGE": "NO_MOVE",
    "SECTION_NOT_ADJACENT": "NO_MOVE",
    "SECTION_NOT_AT_BOUNDARY": "NO_MOVE",
    "SECTION_REQUIREMENT_ABSENT": "NO_MOVE",
    "RETURN_NEVER_RETURNS": "NO_MOVE",
    "ELABORATION_UNGROUNDED": "NO_MOVE",
    # THE TWO THAT ARE NOT SETTLED, and they are the reason this table has a
    # seventh word. `HOOK_ABSENT` is a FLAG on the argument that the writer
    # supplied the exact hook TEXT and its presence is factual with no
    # convention in it. These two are about the SAME declared text and are
    # equally factual — "occurs once, so it is a line and not a hook" is
    # arguably definitional rather than conventional, and a title absent from
    # its own hook is a fact, not a taste. Promoting either changes what
    # refuses a draft, which is not this table's decision to make.
    "HOOK_DOES_NOT_RECUR": "PROMOTE_CANDIDATE",
    "TITLE_NOT_IN_HOOK": "PROMOTE_CANDIDATE",

    # --- quality/fit.py: counts against a DECLARED meter. `satisfiable=True`
    # is fit.py's own statement that these are measurements and not
    # contradictions, so none is a defect by itself.
    "CROWDED": "UNCALIBRATED",
    "SPARSE": "UNCALIBRATED",
    "PROMINENCE_EXCEEDS_HEADS": "UNCALIBRATED",
    "PROMINENCE_OFF_HEAD": "UNCALIBRATED",
    "HEADS_EXCEED_UNITS": "UNCALIBRATED",
    "PROMINENCE_CANNOT_ALIGN": "UNCALIBRATED",
    "EVEN_DIVISION_LANDINGS": "UNCALIBRATED",
    "ANACRUSIS": "NO_MOVE",
    "LATE_ENTRY": "NO_MOVE",
    "TUPLET_REQUIRED": "NO_MOVE",
    "UNCOVERED_BARS": "NO_MOVE",
    "OVERLAPPING_SPANS": "NO_MOVE",

    # --- quality/floor.py
    "EXTRAPOLATED_LENGTH": "DISCLOSURE",
    "UNIFORM_LINE_LENGTH": "CONVENTION",
    "RADIF_LICENSED": "SATISFIED",
    # SHARED_SUFFIX names the SAME phenomenon `HOMEOTELEUTON` names, and that
    # one is GATED through MANDATORY_PURSUE. One repository, two answers about
    # one sonic event — the tier-1 ban is unskippable at the mandate layer and
    # silent at the floor. That asymmetry may be right (the floor speaks about
    # a draft nobody mandated) and it is not obviously right, so it is a
    # question and not a ruling.
    "SHARED_SUFFIX": "PROMOTE_CANDIDATE",

    # --- quality/revise.py: almost none of these is about the DRAFT.
    "BAND_UNJUDGED": "REFUSAL",
    "SCHEME_UNREADABLE": "REFUSAL",
    "COLLISION_CUT_IS_SCALAR_ONLY": "DISCLOSURE",
    "MANDATE_EXCUSED_BY_OVERLAP": "DISCLOSURE",
    "MANDATE_GROUPS_INDISTINGUISHABLE": "DISCLOSURE",
    "MANDATE_NOT_INDEPENDENT": "DISCLOSURE",
    "MANDATE_SCOPE_DECLARED": "DISCLOSURE",
    "STRUCTURE_UNCALIBRATED": "DISCLOSURE",
    "REFRAIN_REPEAT": "SATISFIED",
    "GROUPS_DECLARED_RETURN": "SATISFIED",
    "RETURN_OUT_OF_RANGE": "NO_MOVE",
}


def unruled(c=None):
    """-> disclosed-only codes with no declared disposition.

    THE GATE. A note that nobody has ruled on is indistinguishable from a note
    somebody decided to leave alone, and the second is a position while the
    first is an oversight (doctrine 20). `--check` fails on a non-empty list.
    """
    c = c if c is not None else census()
    return sorted(k for k, v in c.items()
                  if v["verdict"] == "DISCLOSED-ONLY"
                  and k not in DISPOSITION)


def by_disposition(c=None):
    """-> {disposition: [codes]}, the ruling as a reader sees it."""
    c = c if c is not None else census()
    out = collections.defaultdict(list)
    for k, v in c.items():
        if v["verdict"] == "DISCLOSED-ONLY":
            out[DISPOSITION.get(k, "UNRULED")].append(k)
    return {k: sorted(v) for k, v in out.items()}


#: THE PINNED CENSUS — 2026-08-23, AFTER THE 44 WERE DECIDED.
#: Of 71 finding codes: **20 can refuse something, 51 cannot, and 0 are
#: undecidable.**
#:
#: ~~67 codes~~ THE TOTAL WAS SHORT BY FOUR, and the cause is this module's
#: own blindness one argument in from the one it already confessed to. It
#: scans for a call whose FIRST ARGUMENT IS A STRING LITERAL; `quality/grid.
#: py`'s placement layer builds `GridFinding(code, ...)` from a variable at
#: exactly one site, so `SECTION_AT_EDGE`, `SECTION_NOT_ADJACENT`,
#: `SECTION_NOT_AT_BOUNDARY` and `SECTION_REQUIREMENT_ABSENT` were emitted by
#: this tree and counted by nothing. A declared table is an EXISTENCE claim as
#: well as a severity, so those four are now folded in from `grid.SEVERITY`.
#:
#: ~~8 gated, 15 disclosed-only, 44 undecidable (23 computed, 21
#: consumer-assigned)~~ — THE FIRST READING, and it was wrong in two
#: directions at once (doctrine 17 keeps it visible):
#:
#:   * THE SPLIT WAS AN ARTEFACT. `FitFinding` is `(code, MESSAGE, ...)` with
#:     no severity field, and the census read argument 1 as a severity for
#:     every constructor but `GridFinding`. Eighteen of `fit.py`'s codes had
#:     their MESSAGE tested against "flag"/"note", failed, and were filed
#:     `computed`. The true split at that moment was 5 / 39, not 23 / 21.
#:   * AND 39 OF THE 44 WERE NEVER UNDECIDED. `fit.py` has always declared
#:     severity as `satisfiable` and `floor.py` as a CEILING passed to
#:     `sev()`; the census knew neither spelling, so it reported DECIDED
#:     codes as undecidable — over-reporting in its own flattering direction,
#:     since a bigger number makes the tree look worse and the instrument
#:     look more necessary.
#:
#: WHAT ACTUALLY CHANGED IN THE TREE, kept apart from what changed in the
#: reading, because merging them would let a documentation fix look like an
#: enforcement win: `grid.SEVERITY` now rules on all 21 shape codes in the
#: module that defines them (it was one inline conditional in a consumer),
#: `FitFinding.severity` and `GridFinding.severity` are the one definition of
#: mappings `revise.py` held three copies of, and `severity_of` REFUSES an
#: unruled code instead of defaulting it. **No draft grades differently** —
#: every table was proven equivalent to the expression it replaced before it
#: shipped. The 20 gated codes were gated all along; only 0 of them are newly
#: enforced, and all 12 of the newly-VISIBLE gates were already firing.
#:
#: It is a pin on the THREE COUNTS and not on the membership, deliberately:
#: the useful signal is "the enforcing fraction changed", and pinning every
#: code's name would make every new finding a merge conflict rather than a
#: question.
#: REPINNED 2026-08-23, ~~'gated': 20, 'disclosed_only': 51~~ -> 21 / 50, and
#: the code that moved is `HOOK_DOES_NOT_RECUR` (`MISSING.md` M-84, owner's
#: ruling *"promote HOOK_DOES_NOT_RECUR to a flag"*). It is the FIRST code
#: this instrument's own list caused to be promoted: M-77 produced the
#: disclosed-only roster precisely so "should this one gate?" is asked of each
#: code by a person rather than answered by whoever last edited the file, and
#: this is that question being answered.
#:
#: WHY IT IS NOT DOCTRINE 6's CASE, which is the objection M-77 raised against
#: promoting the shape layer's notes. `DOWNBEAT_LOCKED` and `QUATRAIN_LOCK`
#: measure a draft against `POPULAR_SONG` at an uncalibrated threshold — a
#: CONVENTION a writer may depart from, and a convention cannot be what fails
#: a check. `HOOK_DOES_NOT_RECUR` is definitional in M-54's own sense: apply
#: that entry's per-row test — *violate it, is the result a NOVEL SONG or a
#: MISLABELLED SECTION?* — and a hook occurring once is not an experimental
#: song, it is a phrase somebody called a hook. The finding's own message has
#: said so all along: *"A hook is defined by RETURN; one occurrence is a
#: phrase."* It joins `HOOK_ABSENT`, whose flag rests on the same footing —
#: a factual question with no convention in it.
#:
#: The count moves and NO DRAFT NEWLY FAILS from the promotion alone: the
#: planner emitted a hook into a section it drew once in 219 of 400 seeds, and
#: that derivation is repaired in the same commit, so the flag's live target
#: is a hand-written blueprint or a recovered song rather than a plan.
PINNED = {'codes': 71, 'gated': 21, 'disclosed_only': 50, 'undecidable': 0,
          'computed': 0, 'consumer_assigned': 0}


def main(argv):
    c = census()
    s = summarize(c)
    check = "--check" in argv
    print(f"FINDING CODES: {s['codes']}")
    print(f"  GATED            {s['gated']:3d}  something can refuse on it")
    print(f"  DISCLOSED-ONLY   {s['disclosed_only']:3d}  emitted, and unable "
          f"to stop anything")
    print(f"  UNDECIDABLE      {s['undecidable']:3d}  "
          f"({s['computed']} computed at the call site, "
          f"{s['consumer_assigned']} with NO severity field on the "
          f"constructor at all); NOT counted as gated — this census does "
          f"not answer its own question in the flattering direction")
    print("  three counts, never summed (doctrine 79)")
    if not check:
        for verdict in ("DISCLOSED-ONLY", "UNDECIDABLE", "GATED"):
            print(f"\n{verdict}")
            for code in sorted(k for k, v in c.items()
                               if v["verdict"] == verdict):
                r = c[code]
                extra = (" via " + ", ".join(r["gates"])) if r["gates"] else ""
                print(f"  {code:28s} {'/'.join(r['severities']):9s}"
                      f"{extra}  [{', '.join(r['files'])}]")
        print("\nWHY EACH DISCLOSED-ONLY CODE IS TOOTHLESS — RULED ONE AT A "
              "TIME, never assumed:")
        for _k, _v in sorted(by_disposition(c).items()):
            print(f"  {_k:20s} {len(_v):3d}  {DISPOSITIONS.get(_k, '?')[:86]}")
        print("\nA DISCLOSED-ONLY CODE IS NOT AUTOMATICALLY A DEFECT — a "
              "CONVENTION a writer may depart from cannot be what fails a "
              "check, so the shape layer's notes are notes on purpose. That "
              "rule is a COROLLARY OF DOCTRINES 6 AND 7 and is quoted across "
              "this tree as doctrine 6 alone, which says something else "
              "entirely; it has no number of its own and therefore no check, "
              "while governing most of this table (`MISSING.md` M-78).")
        return 0
    u = unruled(c)
    if u:
        print(f"\nCHECK FAILED — {len(u)} disclosed-only code(s) carry no "
              f"declared disposition: {', '.join(u)}. A note nobody has ruled "
              f"on is indistinguishable from a note somebody decided to leave "
              f"alone, and the second is a position while the first is an "
              f"oversight (doctrine 20). Add a DISPOSITION row naming which "
              f"of the {len(DISPOSITIONS)} kinds it is.")
        return 3
    _bad = sorted({d for d in DISPOSITION.values() if d not in DISPOSITIONS})
    if _bad:
        print(f"\nCHECK FAILED — disposition(s) outside the closed "
              f"vocabulary: {_bad}. The set is closed so a new kind is added "
              f"deliberately, not by somebody typing a new string.")
        return 3
    if s != PINNED:
        print(f"\nCHECK FAILED — the census moved: pinned {PINNED}, "
              f"measured {s}. A finding added without a gate moves "
              f"`disclosed_only`; one that gained one moves `gated`. Repin "
              f"deliberately, naming which code moved and why.")
        return 3
    print("\nCHECK PASSED — the census is where it was pinned")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
