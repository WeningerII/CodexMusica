#!/usr/bin/env python3
"""Pins for `quality/pin_sweep.py` -- `MISSING.md` M-21's answer.

The sweep's one dangerous property is that it runs thirty instruments as
subprocesses, so the thing worth asserting mechanically is what it CANNOT do:
repair. `counters.py`'s own docstring records why a remedy that writes is a
laundering path, and a sweep that repaired would inherit that hole across every
instrument at once. That contract is checked on the AST here, not read off the
prose, because a promise in a docstring gets kept exactly as often as someone
remembers it (doctrine 48).

    python3 quality/test_pin_sweep.py
"""

from __future__ import annotations

import ast
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import pin_sweep as PS                       # noqa: E402

FAILURES = []


def check(label, ok, detail=""):
    print("  %-5s %s" % ("PASS" if ok else "FAIL", label))
    if detail:
        print("          %s" % (detail,))
    if not ok:
        FAILURES.append(label)


#: Every flag that makes an instrument in this tree WRITE. The sweep may never
#: emit one. Listed rather than pattern-matched so a new writing flag is a
#: deliberate addition to this test and not something a regex might happen to
#: catch (doctrine 58).
WRITING_FLAGS = ("--write", "--rebaseline", "--adopt", "--fix", "--repair")


def test_the_sweep_cannot_repair():
    """THE CONTRACT, ON THE AST. Every string constant anywhere in the module
    is examined, so a writing flag cannot reach a subprocess by being built up
    in a variable, passed as a default, or sitting in a table."""
    print("\n1. the sweep repairs nothing, and that is mechanical")
    src = open(PS.__file__, encoding="utf-8").read()
    tree = ast.parse(src)
    # THE DOCSTRINGS NAME THE FORBIDDEN FLAGS ON PURPOSE, so they are excluded
    # -- BY NODE IDENTITY and not by comparing text. `ast.get_docstring`
    # returns a CLEANED string (dedented, stripped) which does not equal the
    # raw `Constant.value`, so a value comparison silently excludes nothing
    # and the check fails on the module's own prose. Same shape as
    # `test_declared_inputs.py` excluding an `AnnAssign` target by identity:
    # the first draft of this check did the value comparison and reported
    # three offenders that were all its own documentation.
    doc_nodes = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)):
            body = getattr(n, "body", None)
            if (body and isinstance(body[0], ast.Expr)
                    and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                doc_nodes.add(id(body[0].value))
    live = [n.value for n in ast.walk(tree)
            if isinstance(n, ast.Constant) and isinstance(n.value, str)
            and id(n) not in doc_nodes]
    for flag in WRITING_FLAGS:
        offenders = [s for s in live if flag in s]
        check("no live string literal contains %r" % flag,
              not offenders, offenders[:3])

    # AND THE POSITIVE HALF: it must actually pass `--check`, or it is asking
    # each instrument the wrong question and every answer is about a default
    # run rather than a pin.
    check("`--check` IS among the live literals",
          any(s == "--check" for s in live), None)


def test_discovery_is_mechanical_and_the_exclusions_are_declared():
    """A hand-written instrument list is a population nobody wrote down, and
    its failure mode is silent: a new instrument would simply not be swept and
    the sweep would keep printing a clean bill over a shrinking fraction of
    the pins."""
    print("\n2. discovery is a scan, and every exclusion carries its reason")
    found = PS.discover()
    check("the sweep finds a substantial population -- an empty one would "
          "make every check below pass on nothing (doctrine 20)",
          len(found) > 20, "%d instrument(s)" % len(found))
    for known in ("quality/audit_register.py", "quality/counters.py",
                  "quality/meter_bands.py", "quality/corpus_manifest.py"):
        check("%s is swept" % known, known in found)
    check("this module's own suite is not swept as an instrument",
          "quality/test_pin_sweep.py" not in found)
    check("every declared exclusion carries a REASON, not just a name",
          all(isinstance(v, str) and len(v) > 20
              for v in PS.EXCLUDED.values()), sorted(PS.EXCLUDED))
    check("and the exclusions are actually excluded",
          not (set(PS.EXCLUDED) & set(found)),
          sorted(set(PS.EXCLUDED) & set(found)))
    check("`--only` narrows by basename glob",
          PS.discover(only="counters.py") == ["quality/counters.py"],
          PS.discover(only="counters.py"))


def test_the_exit_vocabulary_is_per_instrument():
    """The instruments do not share one. `audit_register` is 0/1/2,
    `corpus_manifest` exits 3 for a drifted snapshot. Imposing a single
    meaning would be this module inventing a vocabulary they do not have."""
    print("\n3. the exit vocabulary is each instrument's own")
    check("audit_register 2 is CANNOT RUN, not MOVED — 'cannot tell' and "
          "'a figure moved' are different answers (doctrine 20)",
          PS.verdict_for("quality/audit_register.py", 2) == "CANNOT RUN",
          PS.verdict_for("quality/audit_register.py", 2))
    check("corpus_manifest 3 is MOVED — its own documented drift code",
          PS.verdict_for("quality/corpus_manifest.py", 3) == "MOVED")
    check("0 is HOLDS everywhere",
          all(PS.verdict_for(k, 0) == "HOLDS" for k in PS.EXIT_MEANING))
    # THE CONSERVATIVE DEFAULT, and the direction is the argument.
    check("an UNKNOWN instrument's non-zero exit reads MOVED, never CANNOT "
          "RUN — an instrument that has gone red must not be filed under "
          "inconclusive",
          PS.verdict_for("quality/not_in_the_table.py", 1) == "MOVED",
          PS.verdict_for("quality/not_in_the_table.py", 1))
    check("...and its zero still reads HOLDS",
          PS.verdict_for("quality/not_in_the_table.py", 0) == "HOLDS")


def test_evidence_is_never_empty_under_a_moved_verdict():
    """An empty evidence block under a MOVED verdict reads like a verdict with
    no reason, which is the shape this whole sitting has been removing."""
    print("\n4. a MOVED verdict always carries evidence")
    lines, how = PS.evidence("  [FAIL] public symbols\n  ok  something else")
    check("a declared pattern is matched and labelled `matched`",
          lines and "[FAIL]" in lines[0] and how == "matched", (lines, how))
    lines, how = PS.evidence("nothing here looks like a moved figure\nlast")
    check("and when nothing matches it falls back to the tail and SAYS so, "
          "rather than printing nothing",
          lines and "tail" in how, (lines, how))


def test_the_two_false_verdicts_the_first_full_run_produced():
    """Both were the sweep's own defect, both were found by running it over
    all thirty, and they are OPPOSITE errors — which is why one fix would not
    have caught the other.

    (a) `audit_corpus.py --check` takes a VALUE (a check letter). A bare
        `--check` is an argparse error at exit 2, and the sweep filed a
        MANUFACTURED MOVED against an instrument it had never asked. Its pin
        flag is `--verify-shape`. Discovery finds a file by the STRING
        `--check`, and that string does not promise the flag means "check
        your pins".

    (b) `audit_joint_auc_null.py --check` prints `RESULT: REFUSED (not a
        pass, not a failure -- doctrine 20)` when its feature cache is cold,
        and exits non-zero. The conservative default read that as MOVED —
        the exact collapse this module's docstring forbids, pointed the other
        way. The default exists so a RED instrument is not filed as
        inconclusive; here it filed an explicitly INCONCLUSIVE one as red."""
    print("\n5. the two false verdicts the first full run produced")
    check("audit_corpus's real pin invocation is DECLARED, not guessed",
          PS.CHECK_ARGV.get("quality/audit_corpus.py") == ["--verify-shape"],
          PS.CHECK_ARGV.get("quality/audit_corpus.py"))
    usage = ("usage: audit_corpus.py [-h] [--check CHECK]\n"
             "audit_corpus.py: error: argument --check: expected one argument")
    check("an argparse usage error is CANNOT RUN, never MOVED — the sweep "
          "asked the wrong question and that says nothing about the figures",
          bool(PS._USAGE_ERROR.search(usage)), usage[:50])
    refused = ("  a warm cache is needed\n"
               "RESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
    check("an instrument's OWN word for inconclusive is believed over the "
          "exit code (doctrine 1 — the instrument owns its vocabulary)",
          bool(PS._SAYS_REFUSED.search(refused)), refused[-40:])
    check("...and a clean report does NOT match the refusal patterns, so the "
          "rule cannot swallow a real MOVED",
          not PS._SAYS_REFUSED.search(
              "RESULT: FAIL\n  [FAIL] committed 84, measured 86"), None)
    # END TO END, on the two real instruments.
    row = PS.run_one("quality/audit_joint_auc_null.py", timeout=300)
    check("audit_joint_auc_null reads CANNOT RUN and carries its own words "
          "as the reason", row["verdict"] == "CANNOT RUN" and row["evidence"],
          (row["verdict"], row["evidence"][:1]))


def test_it_runs_one_instrument_end_to_end():
    """Doctrine 94: a positive-case suite cannot find a rule that is too
    generous. Drive a real instrument and read a real verdict."""
    print("\n5. one real instrument, end to end")
    row = PS.run_one("quality/triage.py", timeout=300)
    check("the row carries the instrument, an exit code, a verdict and a time",
          set(row) >= {"instrument", "exit", "verdict", "seconds"}
          and row["verdict"] in ("HOLDS", "MOVED", "CANNOT RUN"), row)
    check("triage.py's committed figures reproduce at HEAD",
          row["verdict"] == "HOLDS", (row["verdict"], row["exit"]))
    check("a HOLDS row carries no evidence — evidence is for what moved",
          row["evidence"] == [], row["evidence"])


def test_sweep_is_the_one_walk():
    """`main` calls `sweep`; it does not re-implement the loop.

    IT WAS TWO WALKS FOR ABOUT TEN MINUTES AND THE SWEEP FOUND IT ITSELF, on
    its own first run: `counters.py --check` reported
    `quality.pin_sweep.sweep` as named by nothing while `main` walked the
    instruments beside it. One question, two readings, in one file (doctrine
    1) -- found by the instrument written to find exactly that."""
    print("\n6. `main` calls `sweep` rather than walking the list again")
    src = open(PS.__file__, encoding="utf-8").read()
    tree = ast.parse(src)
    main = next(n for n in ast.walk(tree)
                if isinstance(n, ast.FunctionDef) and n.name == "main")
    calls = {n.func.id for n in ast.walk(main)
             if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}
    check("main() calls sweep()", "sweep" in calls, sorted(calls))
    check("main() does NOT call run_one directly — that would be the second "
          "walk again", "run_one" not in calls, sorted(calls))
    rows = PS.sweep(only="triage.py", timeout=300)
    check("sweep() returns one row per instrument",
          len(rows) == 1 and rows[0]["instrument"] == "quality/triage.py",
          rows)
    seen = []
    PS.sweep(only="triage.py", timeout=300,
             progress=lambda i, n, rel, row=None: seen.append(row is None))
    check("progress is called BEFORE and AFTER each instrument, so a caller "
          "can distinguish slow from stalled",
          seen == [True, False], seen)


if __name__ == "__main__":
    for fn in (test_the_sweep_cannot_repair,
               test_discovery_is_mechanical_and_the_exclusions_are_declared,
               test_the_exit_vocabulary_is_per_instrument,
               test_evidence_is_never_empty_under_a_moved_verdict,
               test_the_two_false_verdicts_the_first_full_run_produced,
               test_it_runs_one_instrument_end_to_end,
               test_sweep_is_the_one_walk):
        fn()
    print("=" * 66)
    if FAILURES:
        print("%d FAILING: %s" % (len(FAILURES), ", ".join(FAILURES)))
        sys.exit(1)
    print("all pin-sweep regressions pass")
