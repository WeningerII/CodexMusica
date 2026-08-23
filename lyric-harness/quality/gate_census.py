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
it. Undecidable has TWO causes and they are reported apart, because they ask
different things of whoever fixes them:
  `computed`           the severity is `sev(...)` at the call site — a
                       profile downgrade — and reading it needs the profile
                       the call runs under.
  `consumer-assigned`  the constructor has NO severity field at all.
                       `GridFinding` is `(code, message, evidence)`, so every
                       finding of the SHAPE layer takes its severity from
                       whoever folds it in (`revise._function_findings`).
                       A severity that cannot be read from the emitter is a
                       finding of its own, and it is the reason this census
                       reports the cause rather than a single total.

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


def _severities(path):
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
    for n in ast.walk(tree):
        if not (isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                and n.func.id in FINDING_CONSTRUCTORS):
            continue
        if not n.args or not isinstance(n.args[0], ast.Constant):
            continue
        code = n.args[0].value
        if not isinstance(code, str):
            continue
        # WHERE THE SEVERITY IS DECIDED, which is not the same question for
        # every constructor and the difference is a finding of its own.
        # `Finding` and `FitFinding` take it as their second argument, so it
        # is readable here. `GridFinding` is `(code, message, evidence)` and
        # has NO severity field — the SHAPE layer's severity is assigned by
        # its consumer (`revise._function_findings`: everything a note except
        # HOOK_ABSENT). A severity that cannot be read from the emitter is
        # exactly the kind of thing this census exists to surface, so it gets
        # its own label rather than being folded into "computed".
        sev = ("consumer-assigned" if n.func.id == "GridFinding"
               else "computed")
        if n.func.id != "GridFinding" and len(n.args) > 1 \
                and isinstance(n.args[1], ast.Constant) \
                and n.args[1].value in ("flag", "note"):
            sev = n.args[1].value
        for kw in n.keywords:
            if kw.arg == "severity" and isinstance(kw.value, ast.Constant):
                sev = kw.value.value
        out[code].add(sev)
    return out


def _gate_sets():
    """-> (pursued codes, length-gate codes). Read from the modules that
    OWN them, never respelled here: a second copy of a gate set is how a
    census starts disagreeing with the thing it is counting (doctrine 1)."""
    from quality.loop import MANDATORY_PURSUE
    from quality.floor import LENGTH_GATE_CODES
    return set(MANDATORY_PURSUE), set(LENGTH_GATE_CODES)


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
    for p in paths:
        for code, sevs in _severities(p).items():
            found[code]["severities"] |= sevs
            found[code]["files"].add(os.path.basename(p))
    out = {}
    for code, rec in found.items():
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


#: THE PINNED CENSUS — what this tree measured when the instrument was built
#: (2026-08-23): of 67 finding codes, **8 can definitely refuse something, 15
#: definitely cannot, and 44 depend on where they are constructed** — 23 whose
#: severity is computed at the call site and 21 whose constructor has no
#: severity field at all. That is the honest size of the owner's complaint,
#: measured rather than asserted, and it is the list the next sitting works
#: from. `--check` re-derives it and exits 3 on drift, so a finding
#: added without a gate MOVES A NUMBER instead of joining a list nobody reads.
#:
#: It is a pin on the THREE COUNTS and not on the membership, deliberately:
#: the useful signal is "the enforcing fraction changed", and pinning every
#: code's name would make every new finding a merge conflict rather than a
#: question.
PINNED = {'codes': 67, 'gated': 8, 'disclosed_only': 15, 'undecidable': 44, 'computed': 23, 'consumer_assigned': 21}


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
        print("\nA DISCLOSED-ONLY CODE IS NOT AUTOMATICALLY A DEFECT: "
              "doctrine 6 says a CONVENTION a writer may depart from cannot "
              "be what fails a check, so the shape layer's notes are notes "
              "on purpose. This list is the QUESTION, asked of each code by "
              "a person, not an answer.")
        return 0
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
