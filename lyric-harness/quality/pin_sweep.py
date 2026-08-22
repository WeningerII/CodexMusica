#!/usr/bin/env python3
"""WHICH COMMITTED FIGURES DOES THIS WORKING TREE MOVE?  --  `MISSING.md` M-21.

Every instrument under `quality/` that pins a figure answers that question for
its OWN figure, through its own `--check`.  Nothing asked all of them at once,
so the question was answered by CI instead: one failing step per round, one
round per pin, at about twelve minutes a round.  M-21 was filed after paying
that cost TWICE IN ONE SITTING for a single fact -- the number of `MISSING.md`
entries, pinned once as a markdown table cell that `counters.py --write`
repairs and once as a Python dict literal that a person edits, sharing no
string, no spelling and no repair command, so NO GREP FINDS BOTH.

This is the question, not the answer.

    python3 quality/pin_sweep.py                 every instrument
    python3 quality/pin_sweep.py --only 'audit*' a subset, by filename glob
    python3 quality/pin_sweep.py --json          machine-readable

IT TAKES OVER AN HOUR AND THAT IS A PROPERTY, NOT A BUG -- SAID HERE SO
NOBODY DISCOVERS IT BY WAITING.  MEASURED 2026-08-22 on the first full run:
29 of the 30 instruments in 3,600s, killed by its own outer bound before the
30th.  The time is real work -- `capacity.py` re-derives 12,387 rhyme
families, the meter-band check re-derives its two bands over 264,082 corpus
lines, `audit_fwer_fpr.py` takes 70s
-- and every instrument's own runtime is printed beside its verdict so a
caller can see where it goes.  THE CONSEQUENCE IS THE USE: this is a
BEFORE-YOU-PUSH-A-BIG-CHANGE command, not a per-commit one, and `--only` is
how you ask a subset.  A tool nobody runs because it takes an hour is the
same shape as a pin nobody asks -- which is the defect this module exists to
find, so it is written down rather than left for the next reader.

IT REPAIRS NOTHING, AND THAT IS A CONTRACT RATHER THAN AN OMISSION.
`counters.py`'s own docstring records why a remedy that writes is a laundering
path; a sweep that repaired would inherit that hole across thirty instruments
at once instead of one.  `quality/test_pin_sweep.py` asserts by AST that this
module never emits `--write`, `--rebaseline` or `--adopt` in a subprocess
argument list, so the contract is mechanical and not a promise in prose
(doctrine 48).

THREE COUNTS AND THEY ARE NEVER SUMMED (doctrine 79):

  HOLDS       the instrument ran and its committed figures reproduce.
  MOVED       the instrument ran and says a figure moved.  This is the answer
              the sweep exists to give, and it is NOT a failure of the
              instrument -- it is the instrument working.
  CANNOT RUN  the instrument could not answer: it needs a tree that is not
              here, a network, or it exceeded the time bound.  Doctrine 20 --
              this is inconclusive by construction and must never be added to
              HOLDS, which is what "everything passed" would do to it.

THE VERDICT IS THE EXIT CODE AND THE VOCABULARY IS EACH INSTRUMENT'S OWN.
They do not share one: `audit_register.py` is 0 pass / 1 a figure moved / 2
cannot tell, `corpus_manifest.py` exits 3 for a drifted snapshot, and
`audit_corpus.py --verify-shape` is 0/1.  Imposing a single meaning on those
would be this module inventing a vocabulary the instruments do not have
(doctrine 1), so `EXIT_MEANING` is a DECLARED per-instrument table and an
instrument absent from it gets the conservative reading: non-zero is MOVED,
because an instrument that has gone quiet must not read as one that passed.
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

#: Where an instrument may live.  Discovery is MECHANICAL on purpose: a
#: hand-written list is a population nobody wrote down, and the failure mode is
#: silent -- a new instrument added next week would simply not be swept, and
#: the sweep would keep printing a clean bill over a shrinking fraction of the
#: pins.  See `discover`.
SEARCH_DIRS = ("quality", "quality/phonology", ".")

#: A file is an instrument if its source spells the `--check` flag.
_CHECK_FLAG = re.compile(r"""["']--check["']""")

#: DECLARED EXCLUSIONS, each with its reason.  Being a table rather than a
#: filter is the point: an exclusion nobody wrote down is a threshold nobody
#: wrote down (doctrine 58).
EXCLUDED = {
    "quality/pin_sweep.py":
        "this module. Sweeping the sweep would recurse.",
}

#: A TEST IS NOT AN INSTRUMENT, and this is a RULE rather than a list of
#: filenames because the list was wrong within an hour of being written: it
#: named `test_corpus_taxonomy.py` (which mentions `--check` because it RUNS
#: `corpus_manifest.py --check`, so sweeping it would run one pin twice and
#: report one moved figure as two) and then `test_pin_sweep.py` appeared,
#: mentioning `--check` for its own reasons, and was swept. A per-file list
#: has to be remembered; a rule does not.
_IS_TEST = re.compile(r"(^|/)test_[^/]*\.py$")

#: THE PIN-CHECK INVOCATION, where it is not a bare `--check`.  DECLARED, and
#: the first full run is what earned this table: `audit_corpus.py --check`
#: takes a VALUE (a check letter, `--check H`), so a bare `--check` is an
#: argparse error at exit 2 and the sweep filed a MANUFACTURED MOVED against
#: an instrument that was never asked its question.  Its pin flag is
#: `--verify-shape`.  Discovery finds a file by the STRING `--check`; that
#: string does not promise the flag means "check your pins", and this is where
#: the difference is written down.
CHECK_ARGV = {
    "quality/audit_corpus.py": ["--verify-shape"],
    #: `expected_drift.py --check` needs the INSTRUMENT to check; bare, it
    #: refuses with `no instrument '--check' is declared`. Found the same way
    #: as the row above -- by the first full run -- and it was worth finding:
    #: the invocation below is what surfaced a REAL drift in a calibrated
    #: floor threshold that no test suite saw (`mattr` 0.7128 -> 0.7118,
    #: moved by the 2026-08-21 tokeniser repertoire fix).
    "quality/expected_drift.py": ["song_profile_calibration-fast"],
}

#: An instrument's OWN word for "I could not answer".  Read from its output,
#: because several of them say it in as many words and then exit non-zero:
#: `audit_joint_auc_null.py --check` prints `RESULT: REFUSED (not a pass, not
#: a failure -- doctrine 20)` when its feature cache is cold, and the sweep's
#: conservative default read that as MOVED.  THAT IS THE EXACT COLLAPSE THIS
#: MODULE'S DOCSTRING FORBIDS, pointed the other way: the default exists so a
#: red instrument is not filed as inconclusive, and here it filed an
#: explicitly inconclusive one as red.  An instrument that states its own
#: verdict is believed over a code table (doctrine 1 -- the instrument owns
#: its vocabulary).
_SAYS_REFUSED = re.compile(
    r"RESULT:\s*(REFUSED|UNREACHABLE|CANNOT)|cannot tell|"
    r"not a pass, not a failure|NOT REACHABLE|needs a tree that is not here",
    re.I)

#: argparse's own failure, which is a fact about the SWEEP's invocation and
#: never about the instrument's figures.
_USAGE_ERROR = re.compile(r"^usage: .*\n(.|\n)*?: error: ", re.M)

#: Per-instrument exit-code vocabulary, DECLARED because the instruments do
#: not share one.  A code absent from an entry falls through to the default
#: reading below it.
EXIT_MEANING = {
    "quality/audit_register.py": {0: "HOLDS", 1: "MOVED", 2: "CANNOT RUN"},
    "quality/corpus_manifest.py": {0: "HOLDS", 3: "MOVED"},
    "quality/audit_corpus.py": {0: "HOLDS", 1: "MOVED"},
    "quality/counters.py": {0: "HOLDS", 1: "MOVED"},
    # 2 ADDED 2026-08-22 with `triage.NotAGitCheckout`. That module scans the
    # register through `git ls-files`, and outside a work tree it now REFUSES
    # at 2 rather than answering that the whole register is UNGUARDED
    # (`MISSING.md` M-30). Without this row the conservative default below
    # reads a 2 as MOVED — a figure moved — which is precisely the collapse
    # of "cannot tell" into an answer that this sweep exists to prevent.
    # Found by the mutation sweep, which runs the suites in a SHADOW TREE.
    "quality/triage.py": {0: "HOLDS", 1: "MOVED", 2: "CANNOT RUN"},
}

#: THE CONSERVATIVE DEFAULT, and the direction it errs in is the whole
#: argument: an instrument this table does not know about is read as MOVED on
#: any non-zero exit.  Reading it as CANNOT RUN would let an instrument that
#: has genuinely gone red be filed under "inconclusive", which is the exact
#: collapse doctrine 20 forbids, pointed the other way.
_DEFAULT_MEANING = {0: "HOLDS"}

#: Lines worth showing under a MOVED verdict.  BEST EFFORT AND SAID SO: the
#: instruments word a moved figure differently and this module does not get to
#: normalise them.  When nothing matches, the sweep prints the instrument's
#: own tail rather than nothing, because an empty evidence block under a
#: MOVED verdict reads like a verdict with no reason.
_EVIDENCE = re.compile(
    r"\[FAIL\]|committed .*measured|figure\(s\) moved|CHANGED |"
    r"^\s*FAIL\b|no longer describes|does not reproduce|DRIFT", re.M)

#: The time bound, per instrument.  MEASURED rather than guessed: the slowest
#: pins in this tree re-derive a calibration over the whole corpus
#: (`meter_bands.py --check` reads 264,082 lines), so a bound tight enough to
#: be convenient would turn a working instrument into a CANNOT RUN and the
#: sweep would report the tree cleaner than it is.
DEFAULT_TIMEOUT = 900


def discover(root=ROOT, only=None):
    """-> [rel_path, ...] every instrument that spells `--check`.

    Sorted, so a run is reproducible (doctrine 66: a tie broken by iterating a
    set is a result that does not reproduce).
    """
    found = []
    for d in SEARCH_DIRS:
        full = os.path.join(root, d)
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if not name.endswith(".py"):
                continue
            rel = os.path.normpath(os.path.join(d, name)).replace(os.sep, "/")
            if rel in EXCLUDED or _IS_TEST.search(rel):
                continue
            path = os.path.join(root, rel)
            try:
                with open(path, encoding="utf-8", errors="replace") as f:
                    src = f.read()
            except OSError:
                continue
            if _CHECK_FLAG.search(src):
                found.append(rel)
    found = sorted(set(found))
    if only:
        found = [f for f in found
                 if fnmatch.fnmatch(os.path.basename(f), only)
                 or fnmatch.fnmatch(f, only)]
    return found


def verdict_for(rel, code):
    table = EXIT_MEANING.get(rel, _DEFAULT_MEANING)
    if code in table:
        return table[code]
    return "HOLDS" if code == 0 else "MOVED"


def evidence(out, cap=4):
    hits = [l.rstrip() for l in out.splitlines() if _EVIDENCE.search(l)]
    if hits:
        return hits[:cap], "matched"
    tail = [l.rstrip() for l in out.splitlines() if l.strip()][-cap:]
    return tail, "tail (nothing matched the declared evidence patterns)"


def run_one(rel, root=ROOT, timeout=DEFAULT_TIMEOUT):
    """-> dict.  Runs ONE instrument's own `--check` and reads its answer.

    `--check` is the ONLY argument passed.  Nothing here may add `--write`.
    """
    argv = [sys.executable, rel] + CHECK_ARGV.get(rel, ["--check"])
    t0 = time.time()
    try:
        p = subprocess.run(argv, cwd=root, capture_output=True, text=True,
                           timeout=timeout)
        out = (p.stdout or "") + (p.stderr or "")
        code = p.returncode
        timed_out = False
    except subprocess.TimeoutExpired:
        out, code, timed_out = "", None, True
    except OSError as e:                                  # pragma: no cover
        out, code, timed_out = str(e), None, False
    secs = time.time() - t0
    if timed_out:
        v = "CANNOT RUN"
        lines, how = ["exceeded the %ds bound" % timeout], "bound"
    elif code is None:
        v = "CANNOT RUN"
        lines, how = [out[:200]], "error"
    elif _USAGE_ERROR.search(out):
        # The sweep asked the wrong question. That is never a statement about
        # the instrument's figures, and calling it MOVED would manufacture a
        # finding -- which this repository has paid 30 FAILs to learn once
        # already (`audit_corpus._COUNT_FIELDS`).
        v = "CANNOT RUN"
        lines = ["this instrument's pin check is not a bare `--check`; add "
                 "its real invocation to `CHECK_ARGV`"]
        how = "usage error"
    elif _SAYS_REFUSED.search(out):
        # THE INSTRUMENT'S OWN WORD WINS. It said inconclusive; the exit code
        # is not entitled to overrule it (doctrine 1, doctrine 20).
        v = "CANNOT RUN"
        lines, how = evidence(out)
    else:
        v = verdict_for(rel, code)
        lines, how = evidence(out) if v != "HOLDS" else ([], "")
    return {"instrument": rel, "exit": code, "verdict": v,
            "seconds": round(secs, 1), "evidence": lines, "evidence_kind": how}


def sweep(root=ROOT, only=None, timeout=DEFAULT_TIMEOUT, progress=None):
    """-> [row, ...] the whole sweep.  `main` calls THIS rather than walking
    the instruments itself.

    IT WAS TWO WALKS FOR ABOUT TEN MINUTES, and the sweep's own first run is
    what said so: `counters.py --check` reported `quality.pin_sweep.sweep`
    named by nothing while `main` re-implemented the identical loop beside it.
    One question, two readings, in one file (doctrine 1) -- caught by the
    instrument this module was written to be, on the module itself.

    `progress` is called with `(i, n, rel)` BEFORE each instrument runs, so a
    caller can say which pin is being asked and how long the last one took.
    A sweep that prints only at the end is indistinguishable from a stalled
    one, which is the same shape as reporting nothing on a clean run.
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
        description="Which committed figures does this working tree move? "
                    "Runs every instrument's own --check. Repairs nothing.")
    ap.add_argument("--only", help="filename glob, e.g. 'audit*'")
    ap.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                    help="per-instrument bound in seconds (default %d)"
                         % DEFAULT_TIMEOUT)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)

    found = discover(ROOT, a.only)
    if not a.json:
        print("PIN SWEEP -- %d instrument(s), each answering its own "
              "`--check`" % len(found))
        print("  (this repairs nothing; a MOVED figure is repinned by hand, "
              "with the reason)\n")

    def note(i, n, rel, row=None):
        if a.json:
            return
        if row is None:
            print("  [%2d/%2d] %-44s " % (i, n, rel), end="", flush=True)
            return
        print("%-12s %5.1fs" % (row["verdict"], row["seconds"]), flush=True)
        for l in row["evidence"]:
            print("          | %s" % l[:110])

    # A KILLED SWEEP MUST NOT LOOK LIKE A CLEAN ONE. The first full run took
    # longer than its own outer bound and was killed at instrument 29 of 30,
    # printing NO SUMMARY AT ALL -- so the transcript of a sweep that had
    # found four real drifts was indistinguishable from a sweep that found
    # nothing. That is this module's own subject turned on itself (doctrine
    # 20), and it is why the partial summary below exists: on SIGTERM or
    # SIGINT the counts are printed over what actually RAN, with the
    # unreached instruments named as unreached rather than silently absent.
    rows = []

    def _summarise(partial):
        counts = {k: sum(1 for r in rows if r["verdict"] == k)
                  for k in ("HOLDS", "MOVED", "CANNOT RUN")}
        if a.json:
            print(json.dumps({"counts": counts, "rows": rows,
                              "partial": partial,
                              "not_reached": [f for f in found
                                              if f not in {r["instrument"]
                                                           for r in rows}]},
                             indent=2))
            return counts
        print("\n" + "=" * 70)
        if partial:
            unreached = [f for f in found
                         if f not in {r["instrument"] for r in rows}]
            print("  INTERRUPTED after %d of %d instrument(s). The counts "
                  "below are over what RAN." % (len(rows), len(found)))
            print("  NOT REACHED (%d): %s" % (len(unreached),
                                              ", ".join(unreached[:6])))
        print("  HOLDS      %3d   the committed figures reproduce"
              % counts["HOLDS"])
        print("  MOVED      %3d   a figure moved -- repin it BY HAND, with "
              "the date and the reason" % counts["MOVED"])
        print("  CANNOT RUN %3d   inconclusive by construction, NOT a pass "
              "(doctrine 20)" % counts["CANNOT RUN"])
        print("  three counts, never summed (doctrine 79)")
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

    counts = {k: sum(1 for r in rows if r["verdict"] == k)
              for k in ("HOLDS", "MOVED", "CANNOT RUN")}
    _summarise(partial=False)
    return 1 if counts["MOVED"] else 0


if __name__ == "__main__":
    sys.exit(main())
