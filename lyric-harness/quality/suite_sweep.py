#!/usr/bin/env python3
"""IS THE WHOLE SUITE TREE GREEN, AND WHERE DOES THE TIME GO?

Every suite under `quality/` answers that question for itself when you run it.
Nothing asked all of them at once, so for most of this project's life the
question was answered by a shell loop in somebody's scratch directory --
rewritten from memory each sitting, and wrong in a different way each time.
Standing rule 3 is the rule this module exists under: an improvised script
used twice is a defect report, not a convenience.

    python3 quality/suite_sweep.py                 every suite
    python3 quality/suite_sweep.py --only 'test_p*' a subset, by filename glob
    python3 quality/suite_sweep.py --json          machine-readable

IT TAKES OVER AN HOUR AND THAT IS A PROPERTY, NOT A BUG -- said here so nobody
discovers it by waiting.  MEASURED 2026-08-22 on the scratch loop this module
replaces: 58 suites in 4,001s, of which FIVE suites carry 3,265s of it
(`test_discriminate` 890s, `test_capacity` 430s, `test_loop` 436s,
`test_revise` 309s, and `test_mutation`, which did not finish inside a 1,200s
bound at all).  Every suite's own runtime is printed beside its verdict, so a
caller can see where the hour goes rather than guess.

THREE COUNTS AND THEY ARE NEVER SUMMED (doctrine 79):

  PASS        the suite ran and every check in it passed.
  FAIL        the suite ran and something in it is red.  This is the answer
              the sweep exists to give, and it is the instrument working.
  CANNOT RUN  the suite could not answer: it exceeded its bound, or the
              harness could not start it.  Doctrine 20 -- inconclusive by
              construction, never added to PASS, which is exactly what
              "everything passed" would do to it.

THE BOUND IS THE REASON THIS MODULE EXISTS RATHER THAN THE SHELL LOOP.
The loop this replaces printed `FAIL(0 rc=124)` for a suite its own
`timeout(1)` had killed: a suite that RAN OUT OF TIME rendered in the same
column, the same colour and the same summary line as a suite with a red
check in it, distinguishable only by a bare `0` a reader had to know how to
interpret.  That is `MISSING.md` M-21's shape one layer over -- an instrument
that found nothing and an instrument that never looked producing identical
output -- and it is the defect this repo spent a sitting fixing in
`quality/pin_sweep.py` while the loop watching that fix carried it untouched.

IT REPAIRS NOTHING, and the contract is mechanical rather than promised:
`quality/test_suite_sweep.py` asserts by AST that no live string literal in
this module contains `--write`, `--rebaseline`, `--adopt`, `--fix` or
`--repair`, the same guard `test_pin_sweep.py` holds over its own module.
A sweep that repaired would launder thirty green suites at once.

THE POPULATION IS FROZEN WHEN THE SWEEP STARTS, AND IT SAYS SO AT THE END.
Found by this module's own first measurement: the scratch loop globbed once,
reported `60/60`, and had silently never covered `quality/test_pin_sweep.py`
-- committed by the same session forty minutes into its own hour-long run.
`60 of 60` is a true sentence about a population that stopped being the tree.
`main` re-reads the tree after the last suite and NAMES anything that
appeared, because a complete-looking count over a stale population is the
thing a reader trusts most and should trust least.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import signal
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

#: The population, as a glob relative to the repo root.  `test_*.py` under
#: `quality/` is the whole of it and has been since the first suite: `git
#: ls-files` finds test files in NO other directory, and the two top-level
#: runners (`battery.py`, `lyric_harness.py`) are not suites -- see EXCLUDED.
SUITE_GLOB = "quality/test_*.py"

#: RUNNERS THAT ARE NOT SUITES, named with the reason each is out.  A sweep
#: that silently skips is a sweep whose coverage is a matter of opinion; the
#: exclusions are a table so a reader can disagree with one (doctrine 58 -- an
#: exclusion nobody writes down is a threshold nobody wrote down).
EXCLUDED = {
    "battery.py":
        "the sonnet/limerick ORACLE, not a suite. It prints measurements "
        "(mandated/judged/refused/violations) that a reader compares against "
        "the pinned baseline by hand; it has no pass/fail of its own to "
        "read, so a verdict here would be this module inventing one.",
    "quality/negative_control.py":
        "the negative control. Same shape as the battery: it reports a rate "
        "against a null, and a rate is not a verdict.",
    "quality/pin_sweep.py":
        "the OTHER sweep, and it asks a different question -- which committed "
        "FIGURES moved, not which CHECKS are red. It takes over an hour of "
        "its own and running it inside this one would hide two hours behind "
        "one progress line. `quality/test_pin_sweep.py` IS in this "
        "population; the hour-long sweep it tests is not.",
}

#: PER-SUITE BOUNDS, in seconds, with the reason for anything above the
#: default.  A bound is a declared coordinate: a suite that exceeds it comes
#: back CANNOT RUN, which is an honest refusal, and raising the bound to make
#: a refusal go away is the move this table exists to make visible.
DEFAULT_TIMEOUT = 1200
SUITE_TIMEOUT = {
    "quality/test_verbs.py": 2400,
    # MEASURED 2026-08-22: 1,442s and EXIT 0. The first sweep gave it the
    # 1,200s default, killed it, and reported `FAIL(1 rc=124)` -- and the `1`
    # was a REAL red check it had printed before the bound (the ci.yml orphan
    # check, since fixed). So one run carried a true finding and an
    # inconclusive verdict at once, which is why `run_one` now reads the
    # partial buffer instead of discarding it. The bound is 2,400s: 1.66x the
    # measurement, because this suite forks ~300 CLI subprocesses and each
    # pays a full lexicon load, so its wall clock moves with machine load far
    # more than a single-process suite's does.
    "quality/test_mutation.py": 7200,
    # MEASURED 2026-08-22: it plants 57 mutations and runs a declared subset
    # of the suite against each, so its runtime is roughly the sweep's own.
    # At the 1,200s default it returns CANNOT RUN every time -- correct, and
    # useless. `--static` (~0.3s) is NOT what the sweep runs: that arm's own
    # last line reads "the SWEEP was not run", and calling it a PASS would be
    # the exact substitution this module is written to refuse.
}

#: A suite's own check lines.  Every suite in this repo prints `  PASS  name`
#: / `  FAIL  name` from its own `check()` helper, and most print a closing
#: `N FAILING: ...` roll-up.  Read as EVIDENCE, never as the verdict on its
#: own -- see `run_one`.
_FAIL_LINE = re.compile(r"^  FAIL\b.*$", re.M)
_FAILING_ROLLUP = re.compile(r"^\s*\d+ FAILING:.*$", re.M)

#: A traceback or an import error: the suite did not run, it crashed.  That is
#: a FAIL (something in this tree is broken) and not a CANNOT RUN (the sweep
#: could not ask), and the two are kept apart because the remedies are.
_TRACEBACK = re.compile(r"^Traceback \(most recent call last\):", re.M)


def head_revision(root=ROOT):
    """-> the short commit this tree is at, or `""` when it cannot be read.

    A SWEEP OVER A MOVING TREE IS NOT A MEASUREMENT OF ANY ONE COMMIT, and
    this module found that out by being used: the first full run of it took
    about ninety minutes while its own author kept committing, so suite 5 was
    graded against a tree that suite 55 never saw. The population disclosure
    below already reports a tree that GREW; nothing reported a tree that
    CHANGED, and that is the more misleading of the two — the count still
    reads N of N.

    Stderr is captured, because a probe that fails must not leave a line for
    some later reader to mistake for a cause (`MISSING.md` M-30's seventh).
    """
    try:
        p = subprocess.run(["git", "-C", root, "rev-parse", "--short", "HEAD"],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                           text=True, timeout=30)
        return p.stdout.strip() if p.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


def discover(root=ROOT, only=None):
    """-> [rel, ...] sorted.  The population, read from the tree RIGHT NOW.

    Returned rather than cached, so `main` can ask twice and report a tree
    that grew under a running sweep.
    """
    d = os.path.join(root, os.path.dirname(SUITE_GLOB))
    pat = os.path.basename(SUITE_GLOB)
    found = []
    for name in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if not fnmatch.fnmatch(name, pat):
            continue
        rel = os.path.join(os.path.dirname(SUITE_GLOB), name)
        if rel in EXCLUDED:
            continue
        if only and not fnmatch.fnmatch(name, only):
            continue
        found.append(rel)
    return found


def _as_text(buf):
    """-> str.  `TimeoutExpired.stdout` is `str` under `text=True` on some
    Pythons and `bytes` on others, and it is `None` when nothing was read."""
    if buf is None:
        return ""
    return buf if isinstance(buf, str) else buf.decode("utf-8", "replace")


def evidence(out, cap=4):
    """-> [line, ...]  The suite's own FAIL lines, its words, truncated."""
    lines = [l.strip() for l in _FAIL_LINE.findall(out)]
    if not lines:
        lines = [l.strip() for l in _FAILING_ROLLUP.findall(out)]
    if not lines and _TRACEBACK.search(out):
        tail = [l for l in out.strip().splitlines() if l.strip()]
        lines = tail[-2:]
    return lines[:cap]


def run_one(rel, root=ROOT, timeout=None):
    """-> dict.  Runs ONE suite and reads its answer.

    NO ARGUMENTS ARE PASSED.  A suite's default arm is the arm CI runs, and a
    sweep that quietly ran a cheaper one would report a pass for a question
    nobody asked (`test_mutation.py --static` says so in its own last line).

    THE EXIT CODE AND THE PRINTED CHECKS ARE TWO READINGS OF ONE QUESTION, and
    this function reports when they disagree instead of picking (doctrine 1).
    A suite that prints `  FAIL` and exits 0 does not fail its own build, so
    CI is green while the tree is red -- that is a defect IN THE SUITE, it is
    named in the evidence, and the verdict follows the FAIL lines, because the
    checks are what a reader believes.
    """
    bound = timeout if timeout is not None else SUITE_TIMEOUT.get(
        rel, DEFAULT_TIMEOUT)
    t0 = time.time()
    try:
        p = subprocess.run([sys.executable, rel], cwd=root,
                           capture_output=True, text=True, timeout=bound)
        out = (p.stdout or "") + (p.stderr or "")
        code = p.returncode
        timed_out = False
    except subprocess.TimeoutExpired as e:
        # THE PARTIAL OUTPUT IS EVIDENCE AND IT IS NOT THROWN AWAY. Measured
        # 2026-08-22 on the real tree: `quality/test_verbs.py` printed a red
        # check and THEN exceeded its bound. Discarding the buffer would have
        # returned a bare CANNOT RUN and lost a true finding -- the sweep
        # would have said "I could not tell" about a suite that had already
        # told it.
        out = _as_text(e.stdout) + _as_text(e.stderr)
        code, timed_out = None, True
    except OSError as e:                                   # pragma: no cover
        out, code, timed_out = str(e), None, False
    secs = time.time() - t0

    n_fail = len(_FAIL_LINE.findall(out))
    disagrees = False
    if timed_out and n_fail:
        # TWO FACTS, AND THE SWEEP REPORTS BOTH RATHER THAN AVERAGING THEM.
        # The suite RAN a check and that check was red -- that is knowledge,
        # and it is FAIL. The bound only limits how much MORE the sweep
        # learned, so the incompleteness is named in the evidence instead of
        # being allowed to demote a real finding to "inconclusive".
        verdict = "FAIL"
        lines = ["printed %d FAIL line(s) BEFORE exceeding the %ds bound -- "
                 "this much is red, and the REST of the suite is unknown"
                 % (n_fail, bound)] + evidence(out)
    elif timed_out:
        verdict = "CANNOT RUN"
        lines = ["exceeded the %ds bound with no check printed red -- "
                 "inconclusive, NOT a pass (doctrine 20)" % bound]
    elif code is None:
        verdict, lines = "CANNOT RUN", [out[:200]]
    elif n_fail or code != 0:
        verdict, lines = "FAIL", evidence(out)
        if n_fail and code == 0:
            disagrees = True
            lines = ["this suite printed %d FAIL line(s) AND EXITED 0 -- CI "
                     "would not have caught it" % n_fail] + lines
        elif code != 0 and not n_fail:
            lines = lines or ["exit %d with no FAIL line -- it crashed rather "
                              "than failed a check" % code]
    else:
        verdict, lines = "PASS", []
    return {"suite": rel, "exit": code, "verdict": verdict,
            "seconds": round(secs, 1), "bound": bound, "fail_lines": n_fail,
            "disagrees": disagrees, "evidence": lines}


def sweep(root=ROOT, only=None, timeout=None, progress=None):
    """-> [row, ...] the whole sweep.  `main` calls THIS rather than walking
    the suites itself -- one question, one reading (doctrine 1), and
    `pin_sweep` shipped with that defect for ten minutes before its own
    `counters.py --check` named the second walk.

    `progress` is called with `(i, n, rel)` BEFORE each suite runs and with
    `(i, n, rel, row)` after, so a caller can say which suite is running and
    how long the last one took.  A sweep that prints only at the end is
    indistinguishable from a stalled one.
    """
    rows = []
    found = discover(root, only)
    for i, rel in enumerate(found, 1):
        if progress:
            progress(i, len(found), rel)
        row = run_one(rel, root=root, timeout=timeout)
        rows.append(row)
        if progress:
            progress(i, len(found), rel, row)
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Is the whole suite tree green, and where does the time "
                    "go? Runs every suite's default arm. Repairs nothing.")
    ap.add_argument("--only", help="filename glob, e.g. 'test_p*'")
    ap.add_argument("--timeout", type=int, default=None,
                    help="override EVERY per-suite bound, in seconds")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)

    found = discover(ROOT, a.only)
    started_at = time.time()
    head_at_start = head_revision()
    if not a.json:
        print("SUITE SWEEP -- %d suite(s), each running its own default arm"
              % len(found))
        print("  (this repairs nothing; a FAIL is read and fixed by hand)\n")

    def note(i, n, rel, row=None):
        if a.json:
            return
        if row is None:
            print("  [%2d/%2d] %-40s " % (i, n, os.path.basename(rel)),
                  end="", flush=True)
            return
        print("%-11s %5.0fs   total %6.0fs"
              % (row["verdict"], row["seconds"], time.time() - started_at),
              flush=True)
        for l in row["evidence"]:
            print("          | %s" % l[:110])

    rows = []

    def _summarise(partial):
        counts = {k: sum(1 for r in rows if r["verdict"] == k)
                  for k in ("PASS", "FAIL", "CANNOT RUN")}
        ran = {r["suite"] for r in rows}
        unreached = [f for f in found if f not in ran]
        # THE POPULATION IS RE-READ HERE, NOT REUSED. See the module docstring:
        # the loop this replaces reported 60 of 60 over a population that had
        # stopped being the tree forty minutes earlier.
        appeared = [f for f in discover(ROOT, a.only) if f not in found]
        head_now = head_revision()
        moved = bool(head_at_start and head_now and head_now != head_at_start)
        if a.json:
            print(json.dumps({"counts": counts, "rows": rows,
                              "partial": partial, "not_reached": unreached,
                              "appeared_during_run": appeared,
                              "head_at_start": head_at_start,
                              "head_at_end": head_now,
                              "tree_moved_during_run": moved,
                              "excluded": EXCLUDED}, indent=2))
            return counts
        print("\n" + "=" * 70)
        if partial:
            print("  INTERRUPTED after %d of %d suite(s). The counts below "
                  "are over what RAN." % (len(rows), len(found)))
            print("  NOT REACHED (%d): %s"
                  % (len(unreached),
                     ", ".join(os.path.basename(u) for u in unreached[:6])))
        print("  PASS       %3d   the suite ran and every check passed"
              % counts["PASS"])
        print("  FAIL       %3d   the suite ran and something is red -- read "
              "it and fix it" % counts["FAIL"])
        print("  CANNOT RUN %3d   inconclusive by construction, NOT a pass "
              "(doctrine 20)" % counts["CANNOT RUN"])
        print("  three counts, never summed (doctrine 79)")
        if moved:
            print("\n  THE TREE MOVED UNDER THIS RUN: %s -> %s. Every verdict "
                  "above is against WHATEVER WAS ON DISK when that suite ran, "
                  "so this is not a reading of either commit — the early "
                  "suites and the late ones did not grade the same code."
                  % (head_at_start, head_now))
        elif head_at_start:
            print("\n  tree: %s throughout" % head_at_start)
        if appeared:
            print("\n  THE TREE GREW UNDER THIS RUN and these were never "
                  "covered by it (%d):" % len(appeared))
            for f in appeared:
                print("    %s" % f)
        slow = sorted(rows, key=lambda r: -r["seconds"])[:5]
        if slow and slow[0]["seconds"] > 0:
            print("\n  WHERE THE TIME WENT (slowest 5 of %d):" % len(rows))
            for r in slow:
                print("    %-40s %5.0fs" % (os.path.basename(r["suite"]),
                                            r["seconds"]))
        if EXCLUDED:
            print("\n  NOT IN THIS POPULATION (%d), each with its reason in "
                  "`EXCLUDED`: %s" % (len(EXCLUDED), ", ".join(EXCLUDED)))
        return counts

    def _on_signal(_sig, _frm):
        _summarise(partial=True)
        sys.exit(2)

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, _on_signal)
        except (ValueError, OSError):        # not the main thread
            pass

    rows.extend(sweep(ROOT, only=a.only, timeout=a.timeout, progress=note))
    counts = _summarise(partial=False)
    if counts["FAIL"]:
        return 1
    return 2 if counts["CANNOT RUN"] else 0


if __name__ == "__main__":
    sys.exit(main())
