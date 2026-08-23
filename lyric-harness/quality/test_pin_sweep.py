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
import time

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
    # AND A CRASH AT IMPORT IS NOT A MOVED PIN — pinned directly 2026-08-23,
    # because the arm in §4 that exercises it only fires on a runner that
    # LACKS the module, so on a machine that has numpy it would prove nothing
    # (doctrine 48: a check with no live instance). Driven here on the
    # classifier itself, so it is alive in both environments.
    _crash = ("Traceback (most recent call last):\n"
              "  File \"quality/kalevala_rate.py\", line 235, in <module>\n"
              "    import numpy as np\n"
              "ModuleNotFoundError: No module named 'numpy'\n")
    check("a ModuleNotFoundError in the output is recognised, and the module "
          "is captured", bool(PS._MISSING_DEP.search(_crash))
          and PS._MISSING_DEP.search(_crash).group(1) == "numpy",
          PS._MISSING_DEP.search(_crash))
    check("...and a clean report does NOT match it, so the rule cannot "
          "swallow an instrument that ran",
          not PS._MISSING_DEP.search(
              "RESULT: PASS\n  [ok  ] committed 84, measured 84"), None)

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
    #
    # THIS ARM USED TO ASSERT `CANNOT RUN` UNCONDITIONALLY, AND THAT WAS A
    # FACT ABOUT A GITIGNORED FILE (found 2026-08-22 by the mutation sweep,
    # which filed it BASELINE-RED). `audit_joint_auc_null.py --check` refuses
    # only when `data/feature_cache.json` is cold or fingerprint-mismatched;
    # warm, it runs and returns a real verdict. The cache is gitignored, so CI
    # is always cold and this assertion was permanently, accidentally green --
    # while anyone who had just run the discrimination suite got a red for a
    # reason that had nothing to do with the sweep. A suite that can only pass
    # in one environment is not testing the thing it names.
    #
    # BOTH ARMS ARE PINNED, AND NEITHER IS A SKIP. The cache state is read
    # FIRST, from the same loader the instrument uses, so this is a prediction
    # and not a tautology: cold MUST refuse (the rule under test -- an
    # instrument's own word for inconclusive beats its exit code), and warm
    # MUST NOT refuse (the rule cannot swallow an instrument that ran).
    from quality.discriminate import cache_identity, load_cache
    _ent, _fp, _status = load_cache(cache_identity())
    warm = _status == "fingerprint match" and bool(_ent)
    print("     (feature cache is %s: %s)"
          % ("WARM" if warm else "COLD", _status))
    row = PS.run_one("quality/audit_joint_auc_null.py", timeout=900)
    if warm:
        check("audit_joint_auc_null RAN — warm, it returns a real verdict "
              "and the refusal rule does NOT swallow it",
              row["verdict"] in ("HOLDS", "MOVED"),
              (row["verdict"], row["evidence"][:1]))
    elif row["evidence_kind"] == "missing dependency":
        # A THIRD ARM, AND CI IS WHERE IT LIVES (2026-08-23). This instrument
        # reaches numpy AND scikit-learn; the harness is stdlib-only and CI
        # installs third-party packages per JOB, so on the `suites` runner it
        # dies at import with ModuleNotFoundError and exit 1 — which
        # `verdict_for` read as MOVED, and this section then failed asserting
        # CANNOT RUN. A figure nobody measured, reported as a figure that
        # changed. `pin_sweep` types it CANNOT RUN now and NAMES the module,
        # and this arm is separate from the refusal arm below because "the
        # instrument said inconclusive" and "the instrument could not start"
        # have different remedies (doctrine 20/44).
        check("a MISSING THIRD-PARTY MODULE reads CANNOT RUN and names the "
              "module — never MOVED, which would be a claim about figures "
              "that were never computed",
              row["verdict"] == "CANNOT RUN" and row["evidence"]
              and "module" in row["evidence"][0],
              (row["verdict"], row["evidence"][:1]))
    elif row["evidence_kind"] == "bound":
        # Same split as §5's: cold, this instrument computes the whole feature
        # set, and under a loaded four-wide pool that can reach the sweep's
        # bound. The bound is the sweep's, so it is reported and not read as
        # the instrument's own word for inconclusive — which is the exact
        # distinction the arm below is testing.
        check("the sweep hit its OWN bound on the cold path — reported as a "
              "fact about the sweep, never as the instrument's refusal",
              row["exit"] is None and row["evidence"]
              and "bound" in row["evidence"][0],
              (row["exit"], row["seconds"], row["evidence"][:1]))
    else:
        check("audit_joint_auc_null reads CANNOT RUN and carries its own "
              "words as the reason",
              row["verdict"] == "CANNOT RUN" and row["evidence"],
              (row["verdict"], row["evidence"][:1]))


def test_it_runs_one_instrument_end_to_end():
    """Doctrine 94: a positive-case suite cannot find a rule that is too
    generous. Drive a real instrument and read a real verdict."""
    print("\n5. one real instrument, end to end")
    row = PS.run_one("quality/triage.py", timeout=300)
    check("the row carries the instrument, an exit code, a verdict and a time",
          set(row) >= {"instrument", "exit", "verdict", "seconds"}
          and row["verdict"] in ("HOLDS", "MOVED", "CANNOT RUN"), row)
    # THE VERDICT DEPENDS ON WHETHER THIS IS A CHECKOUT, and pinning HOLDS
    # unconditionally made this section red inside the SHADOW TREE that
    # `quality/mutate.py` builds to grade the suites — where `triage.py`
    # cannot read its own population and now REFUSES at 2 rather than
    # reporting the whole register UNGUARDED (`MISSING.md` M-30). Asserting
    # HOLDS there demands a checkout in order to test a sweep whose entire
    # subject is telling a refusal from an answer. Both arms are pinned, so
    # neither environment is the one nobody checked.
    # CANNOT RUN HAS TWO CAUSES AND THIS BRANCH READ ONLY ONE — SPLIT
    # 2026-08-23. `run_one` returns CANNOT RUN both when the instrument
    # REFUSED with its own exit 2 and when the SWEEP'S OWN BOUND was hit, and
    # on a bound `exit` is None, not 2. So under load — four suites wide on a
    # four-vCPU runner, which is what CI is — a slow `triage.py` failed this
    # check while the message blamed "outside a checkout", a state that was
    # not the case. Two states in one branch, and the report naming the wrong
    # one: this file's own subject (doctrine 20/79), inside the suite for the
    # tool that exists to keep those apart.
    #
    # A BOUND IS NOT A STATEMENT ABOUT THE INSTRUMENT. It is reported and the
    # only things asserted are what a bound actually implies; charging it to
    # triage would manufacture a finding about figures nobody measured.
    if row["evidence_kind"] == "bound":
        check("the sweep hit its OWN bound, which is a fact about the sweep "
              "and not about triage.py's figures — reported, not charged",
              row["exit"] is None and row["evidence"]
              and "bound" in row["evidence"][0],
              (row["exit"], row["seconds"], row["evidence"][:1]))
    elif row["verdict"] == "CANNOT RUN":
        check("outside a checkout triage REFUSES and the sweep reads it as "
              "CANNOT RUN — not MOVED, which is what the conservative "
              "default would have made of exit 2",
              row["exit"] == 2 and row["evidence"], (row["exit"], row["evidence"][:1]))
    else:
        check("triage.py's committed figures reproduce at HEAD",
              row["verdict"] == "HOLDS", (row["verdict"], row["exit"]))
        check("a HOLDS row carries no evidence — evidence is for what moved",
              row["evidence"] == [], row["evidence"])


def test_an_interrupted_sweep_reports_what_it_ran():
    """A KILLED SWEEP MUST NOT LOOK LIKE A CLEAN ONE.

    The first full run took longer than its own outer bound and was killed at
    instrument 29 of 30, printing NO SUMMARY AT ALL -- so the transcript of a
    sweep that had already found four real drifts was indistinguishable from
    a sweep that found nothing. This module's own subject, turned on itself
    (doctrine 20). On SIGTERM/SIGINT the counts are printed over what RAN,
    and the instruments never reached are NAMED as unreached rather than
    silently absent."""
    print("\n7. an interrupted sweep reports what it ran")
    import signal as _sig
    import subprocess as _sp
    import tempfile as _tf
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = _tf.NamedTemporaryFile("w+", suffix=".log", delete=False)
    # THE KILL IS FIRED ON A MARKER, NOT ON A CLOCK -- CHANGED 2026-08-23.
    # This read `time.sleep(4)` under the argument that *"`meter_bands.py
    # --check` re-derives over 264,082 lines, so it is reliably still running
    # four seconds in"*. That is a claim about a MACHINE, and it was measured
    # on one: a CI runner takes those four seconds to import and open the
    # corpus, so the signal can land before `sweep()` has begun the
    # instrument at all -- and then there is no interrupted instrument to
    # report and every check in this section reads the wrong state. A race a
    # test can lose on a slower box is a test that certifies the box.
    #
    # `sweep()` prints `  [ 1/ 1] <instrument>` BEFORE it starts each one
    # (that is check 8's own subject), so the marker says exactly what the
    # sleep was guessing at: the instrument is RUNNING and the summary has
    # not been reached. Poll for it, then signal. The outer bound is a named
    # failure rather than a hang, because "the marker never appeared" and
    # "the interrupt was mishandled" are different findings (doctrine 20).
    p = _sp.Popen([sys.executable, "quality/pin_sweep.py",
                   "--only", "meter_bands.py"],
                  cwd=root, stdout=out, stderr=_sp.STDOUT)
    started, deadline = False, time.time() + 180
    while time.time() < deadline:
        if p.poll() is not None:
            break            # it finished on its own -- checked below
        if "meter_bands.py" in open(out.name, encoding="utf-8").read():
            started = True
            break
        time.sleep(0.2)
    check("the sweep announced the instrument BEFORE running it, so the "
          "interrupt lands mid-instrument rather than racing the summary",
          started and p.poll() is None,
          ("announced" if started else "no marker within 180s",
           "still running" if p.poll() is None else "exited %s" % p.poll()))
    p.send_signal(_sig.SIGTERM)
    try:
        p.wait(timeout=120)
    except _sp.TimeoutExpired:
        p.kill()
        p.wait(timeout=30)
    out.flush()
    text = open(out.name, encoding="utf-8").read()
    check("the interrupted run still prints a summary",
          "HOLDS" in text and "CANNOT RUN" in text, text[-120:])
    check("it says INTERRUPTED and how far it got",
          "INTERRUPTED after 0 of 1" in text, text[-200:])
    check("and it NAMES what it never reached — an unrun instrument is not "
          "an instrument that passed",
          "NOT REACHED" in text and "meter_bands.py" in text, text[-200:])
    check("the exit code is 2, not 0: an interrupted sweep has not certified "
          "anything", p.returncode == 2, p.returncode)


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
               test_an_interrupted_sweep_reports_what_it_ran,
               test_sweep_is_the_one_walk):
        fn()
    print("=" * 66)
    if FAILURES:
        print("%d FAILING: %s" % (len(FAILURES), ", ".join(FAILURES)))
        sys.exit(1)
    print("all pin-sweep regressions pass")
