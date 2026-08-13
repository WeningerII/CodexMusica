#!/usr/bin/env python3
"""The regression that makes M1 impossible to repeat SILENTLY.

    python3 quality/test_mutation.py            # every mutation, declared subsets
    python3 quality/test_mutation.py --core     # M1 and the two controls only
    python3 quality/test_mutation.py --full     # every mutation vs every green test

WHAT THIS FILE ASSERTS
----------------------
That `quality/mutate.py`'s SURVIVING set is empty, or is exactly the allowlist
declared below with a written reason per entry.

BACKLOG 1.1's acceptance condition is "M1 is caught, and the runner's
surviving-mutation list is empty or explicitly declared". M1 is the head/tail
alignment revert: the most consequential fix in the project, changing the
band's verdict on 79.9% of unequal-length anchor pairs on the 152 sonnets, run
against all 23 test files and `battery.py` on 2026-08-11, and SURVIVED. This
file is what fails if that ever becomes true again.

It is a test ABOUT THE TESTS, and it fails for two quite different reasons that
must not be confused:

  SURVIVED   a planted defect ran the whole suite and nothing went red. That is
             a hole, and the fix is a new assertion, never a shorter list.
  STALE      a mutation's anchor text is no longer in the file it targets. That
             is not a hole; the code moved and the LIST needs updating. Reported
             separately for exactly that reason -- collapsing the two would let
             a hole be closed by deleting the mutation that found it.

There is a THIRD outcome, added 2026-08-13, and it asserts nothing on purpose:

  INDETERMINATE  a test in scope never finished, even on an isolated re-run, so
             this run has no verdict on that mutation. It is neither a
             detection nor a hole, it is a REFUSAL (doctrine 79), and it is
             printed with its own count. Asserting on it would make this file
             red because the machine was busy, which teaches a reader to ignore
             the one signal it exists to carry.

WHY THE ALLOWLIST HAS TO CARRY PROSE
------------------------------------
An allowlist of mutation names is a list of defects this project has agreed not
to detect. That is sometimes the right answer -- a mutation can be equivalent,
or can target behaviour the repo has deliberately left undecided -- but it is
never the cheap answer, and a bare name gives the next reader no way to tell
"we decided" from "we gave up". Each entry is a sentence saying which.
"""

import argparse
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, HERE)

import mutate  # noqa: E402

# ---------------------------------------------------------------------------
# THE ALLOWLIST. Empty is the target and empty is what it is.
#
# Format: name -> the reason this project accepts that no test detects it.
# A mutation belongs here only if detecting it would be WRONG, not if writing
# the detector would be work.
# ---------------------------------------------------------------------------
ALLOWLIST = {
    "M4": (
        "EQUIVALENT MUTANT, proved rather than assumed. M4 deletes doctrine "
        "25's tripwire from `channel_agreement` -- the `1.0 if (not ca and "
        "not cb)` clause that makes two ABSENT codas AGREE -- and the "
        "behaviour does not move: over 4,000 random CMUdict anchor pairs, "
        "1,206 of which have at least one both-absent aligned coda, "
        "`channel_agreement` differs on 0 and the resulting RELATION differs "
        "on 0. The reason is that `cluster_sim` opens with its own `if not a "
        "and not b: return 1.0`, so the band's clause RESTATES a guarantee "
        "the comparator already gives. No test can distinguish the two "
        "programs, because they are the same program.\n"
        "        The finding is not 'this is untested' but 'the tripwire is "
        "one layer DOWN from where the record puts it'. CLAUDE.md doctrine "
        "25 says the both-empty case was 'registered as the tripwire and "
        "checked first', which reads as though the band implements it; the "
        "line that actually implements it is in `cluster_sim`, and THAT is "
        "protected -- mutation M11 turns `cluster_sim([], [])` into 0.0 and "
        "is caught. So the property has a detector and the duplicate does "
        "not need one. The clause should stay: it documents the predicate at "
        "the place a reader looks for it, and it would become load-bearing "
        "again the moment `cluster_sim` changed -- at which point M11 fails "
        "and M4 stops being equivalent."),
}

#: BACKLOG 1.1's acceptance triple: the mutation that survived, and the two
#: controls that were caught on the same day. The controls are here so that a
#: run in which everything passes is distinguishable from a run in which the
#: runner is misconfigured and nothing is really being tested.
CORE = ("M1", "M5", "M9")

#: The layer vocabulary is CLAUDE.md's own triage rule, and a mutation runner
#: that only mutates the layer its author was thinking about measures that
#: author, not the suite.
LAYERS = {"ingestion", "projection", "anchor", "comparator", "band",
          "structure", "value"}

#: THE LAYER CHECK ABOVE PASSED FOR MONTHS WHILE COVERAGE WAS 2 FILES OF 64.
#: Every mutation lived in `lyric_harness.py` or `battery.py`, so all seven
#: layers were "covered" and the entire `quality/` tree -- the slop floor, the
#: revision loop's gate, mandate semantics, the bar grid -- had never had a
#: planted defect run at it. A coverage check keyed on LAYER cannot see a
#: coverage gap keyed on FILE, and doctrine 94's whole subject is the rule
#: nobody thought to point an instrument at. These are the modules that carry
#: shipped DECISIONS rather than reports, and each must be mutated by name.
MUST_MUTATE = {
    "lyric_harness.py",
    os.path.join("quality", "floor.py"),
    os.path.join("quality", "revise.py"),
    os.path.join("quality", "schemes.py"),
    os.path.join("quality", "grid.py"),
    os.path.join("quality", "fit.py"),
}

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------
# Static checks — no subprocess, no runtime, and they catch list rot
# ---------------------------------------------------------------------------

def test_the_mutation_list_is_well_formed():
    print("\n1. the mutation list itself")
    muts = mutate.MUTATIONS
    names = [m.name for m in muts]
    check("names are unique", len(set(names)) == len(names))
    check(f"at least 12 mutations ({len(muts)})", len(muts) >= 12)
    covered = {m.layer for m in muts}
    check("every layer of CLAUDE.md's triage rule is mutated",
          covered == LAYERS,
          f"covered {sorted(covered)}; missing {sorted(LAYERS - covered)}; "
          f"unknown {sorted(covered - LAYERS)}")
    for layer in sorted(LAYERS):
        n = sum(1 for m in muts if m.layer == layer)
        check(f"  {layer}: {n} mutation(s)", n >= 1)
    check("every mutation carries a rationale of real length",
          all(len(m.rationale) > 80 for m in muts),
          "a planted defect with no stated reason is a puzzle, not a test")

    # The FILE check the layer check above could not make. See MUST_MUTATE.
    files = {m.file for m in muts}
    unmutated = sorted(MUST_MUTATE - files)
    check("every decision-carrying module is mutated by name",
          not unmutated,
          f"never mutated: {unmutated}. A module whose tests have never been "
          f"run against a planted defect is a module whose tests have no "
          f"measured sensitivity (doctrine 94)."
          if unmutated else
          f"{len(files)} file(s) mutated: {sorted(files)}")

    # Recursion guards. This file drives the runner; the runner must not run
    # this file. Two independent guards because one of them is a list.
    rel = os.path.join("quality", "test_mutation.py")
    check("the runner excludes this file from its test inventory",
          rel in mutate.EXCLUDE_TESTS and rel not in mutate.discover_tests())
    check("...and this file also refuses to run inside the runner",
          os.environ.get("LYRIC_MUTATE_ACTIVE") is None,
          "belt and braces: the environment guard fires even if the list "
          "above is edited")

    # Declared subsets must name real files, or the subset silently shrinks to
    # nothing and every mutation 'survives its subset' and escalates.
    tests = set(mutate.discover_tests())
    for m in muts:
        missing = [t for t in m.subset if t not in tests]
        check(f"{m.name}'s declared subset names existing tests",
              not missing, f"missing {missing}")


def test_every_mutation_still_applies():
    print("\n2. every mutation still applies cleanly (STALE != SURVIVED)")
    stale = []
    for m in mutate.MUTATIONS:
        path = os.path.join(mutate.ROOT, m.file)
        src = open(path, encoding="utf-8").read()
        n = src.count(m.old)
        if n != 1 or m.old == m.new:
            stale.append(f"{m.name}: anchor occurs {n}x in {m.file}")
    check(f"all {len(mutate.MUTATIONS)} anchors are present exactly once",
          not stale,
          "; ".join(stale) if stale else
          "a stale anchor is a finding about this LIST. Update the anchor to "
          "the code's new shape -- do not delete the mutation, because the "
          "mutation is the only record that the defect was ever detectable.")


def test_M1_is_declared_verbatim():
    print("\n3. M1 is the head/tail alignment revert, verbatim")
    m = next((x for x in mutate.MUTATIONS if x.name == "M1"), None)
    check("M1 exists", m is not None)
    if not m:
        return
    check("M1 reverts the TAIL slice to a HEAD slice",
          "[-n:]" in m.old and "[:n]" in m.new and m.layer == "band",
          f"{m.old.strip()}  ->  {m.new.strip()}")
    check("M1 targets the shipped comparator",
          m.file == "lyric_harness.py")


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------

class SingleInstance:
    """Only one mutation sweep at a time, per scratch base.

    This file is named `test_*.py`, so `for f in quality/test_*.py` runs it,
    and every sibling session has such a loop. Each invocation forks a whole
    mutation sweep. Measured: two sibling invocations plus one audit put load
    average 14 on four cores and nothing finished. A second instance therefore
    stands down rather than piling on -- and it exits 0, because "another
    process is already asserting this" is not a failure of the assertion.

    The lock is a directory (atomic to create) carrying the holder's pid, and a
    stale one whose process is gone is reclaimed.
    """

    def __init__(self, base=None):
        # The lock is GLOBAL, not per scratch base. Measured: a sibling
        # session with MUTATE_SCRATCH unset gets its own base under /tmp, so a
        # per-base lock let two sweeps run against the same four cores while
        # each believed it was alone. What is being shared is the MACHINE.
        import tempfile
        self.path = os.path.join(tempfile.gettempdir(), "lyric-mutate.lock")
        self.held = False

    def __enter__(self):
        for _ in range(2):
            try:
                os.mkdir(self.path)
                with open(os.path.join(self.path, "pid"), "w") as fh:
                    fh.write(str(os.getpid()))
                self.held = True
                return self
            except FileExistsError:
                try:
                    pid = int(open(os.path.join(self.path, "pid")).read())
                    os.kill(pid, 0)          # holder alive -> stand down
                    return self
                except (OSError, ValueError):
                    import shutil as _sh      # stale: reclaim and retry once
                    _sh.rmtree(self.path, ignore_errors=True)
        return self

    def __exit__(self, *exc):
        if self.held:
            import shutil as _sh
            _sh.rmtree(self.path, ignore_errors=True)
        return False


def run_suite(mode, only, jobs, mutation_jobs, confirm_all, timeout=420):
    base = mutate._scratch_base()
    mutate.sweep_scratch(base)
    muts = [m for m in mutate.MUTATIONS if not only or m.name in set(only)]
    tests = mutate.discover_tests()
    t0 = time.time()
    before = mutate.root_hashes()
    bl = mutate.baseline(tests, jobs, os.path.join(base, "baseline.json"),
                         confirm_all=confirm_all, timeout=timeout)
    green = [t for t, r in bl.items() if r["status"] == "PASS"]
    results = []
    import concurrent.futures as futures
    with futures.ThreadPoolExecutor(max_workers=mutation_jobs) as ex:
        fs = {ex.submit(mutate.run_mutation, m, green, jobs, mode, base,
                        confirm_all, timeout): m for m in muts}
        for f in futures.as_completed(fs):
            results.append(f.result())
    order = {m.name: i for i, m in enumerate(muts)}
    results.sort(key=lambda r: order[r["name"]])
    elapsed = time.time() - t0
    survivors = mutate.report(results, bl, elapsed, mode)
    problems, changed, stale_now = mutate.verify_pristine(
        muts, before, mutate.root_hashes())
    if mutate._SNAPSHOT.get("path"):
        import shutil
        shutil.rmtree(mutate._SNAPSHOT["path"], ignore_errors=True)
        mutate._SNAPSHOT.pop("path", None)
    return results, bl, survivors, problems, changed, stale_now, elapsed


def test_the_run(mode, only, jobs, mutation_jobs, confirm_all, timeout=420):
    (results, bl, survivors, problems, changed, stale_now,
     elapsed) = run_suite(mode, only, jobs, mutation_jobs, confirm_all,
                          timeout)

    print(f"\n4. the verdict   ({elapsed:.1f}s wall clock, {mode} mode)")

    stale = [r["name"] for r in results if r.get("stale")] + stale_now
    check("no mutation is STALE", not stale,
          f"{stale} -- the code moved under the list. Fix the anchors; this "
          f"is not a hole in the suite.")

    indet = [r["name"] for r in results if r.get("indeterminate")]
    if indet:
        # REPORTED, NEVER ASSERTED. A test that never finished did not
        # disagree with the mutant; calling that a hole would be doctrine 79
        # inverted, and failing this file for it would make the machine's load
        # the verdict on the suite.
        print(f"  NOTE  {len(indet)} mutation(s) INDETERMINATE — a test in "
              f"scope never finished even alone: {', '.join(indet)}")
        print("        Neither caught nor a hole. Re-run these on a quiet "
              "machine before treating either answer as measured.")

    unexpected = [n for n in survivors if n not in ALLOWLIST]
    check("the surviving set is empty, or exactly the declared allowlist",
          not unexpected,
          # The FILE is named alongside the layer, because a hole is routed by
          # the module whose behaviour went undetected, not by the triage word.
          "SURVIVED and not allowlisted: " + ", ".join(
              f"{n} ({next(r['layer'] for r in results if r['name'] == n)} in "
              f"{next(r['file'] for r in results if r['name'] == n)})"
              for n in unexpected) +
          ". Each one is a defect this suite cannot detect. The fix is a new "
          "assertion in quality/test_mut*.py -- adding the name to ALLOWLIST "
          "is a decision to ship undetectable, and needs the sentence that "
          "says why." if unexpected else
          f"{len(results) - len(survivors) - len(stale)} of {len(results)} "
          f"mutations caught; allowlist has {len(ALLOWLIST)} entr"
          f"{'y' if len(ALLOWLIST) == 1 else 'ies'}")

    dead = [n for n in ALLOWLIST if n not in survivors
            and any(r["name"] == n for r in results)]
    check("the allowlist has no dead entries", not dead,
          f"{dead} are allowlisted but ARE now caught. Remove them: an "
          f"allowlist that outlives its reason is a licence nobody re-read.")

    # An allowlist entry is an argument, and an argument has premises. M4 is
    # excused only because `cluster_sim` already returns 1.0 for two empty
    # clusters, which makes the band's duplicate clause unobservable. That
    # premise is itself a mutation -- M11 -- and if M11 ever stops being
    # caught, the property has NO detector anywhere and M4's excuse is void.
    if "M4" in ALLOWLIST:
        m11 = next((r for r in results if r["name"] == "M11"), None)
        if m11 is not None:
            check("M4's allowlist premise still holds: M11 is caught",
                  not m11["survived"],
                  "M4 is excused as an equivalent mutant BECAUSE cluster_sim "
                  "carries the both-absent rule one layer down. If M11 "
                  "survives, that layer is unprotected too and the "
                  "both-absent predicate -- a quarter of the sonnets' "
                  "mandated pairs -- has no detector at any level.")

    # M1 by name, because it is the acceptance condition of BACKLOG 1.1 and a
    # generic assertion over a list is easy to satisfy by shortening the list.
    m1 = next((r for r in results if r["name"] == "M1"), None)
    if m1 is not None:
        check("M1 -- reverting the head/tail alignment fix -- is CAUGHT",
              not m1["survived"],
              "caught by " + ", ".join(sorted(
                  os.path.basename(t) for t in m1["caught_by"]))
              if m1["caught_by"] else
              "NOTHING CAUGHT IT. This is the exact state of 2026-08-11 and "
              "the reason this file exists.")

    # The controls. If these ever stop being caught, the runner is broken and
    # every 'caught' above is worthless.
    for name, why in (("M5", "the coda channel forced True"),
                      ("M9", "theta_rhyme 0.75 -> 0.50")):
        r = next((x for x in results if x["name"] == name), None)
        if r is not None:
            check(f"CONTROL {name} ({why}) is caught", not r["survived"],
                  "a control that stops being caught means the runner stopped "
                  "running, not that the code got safer")

    check("the working tree is exactly as it was found", not problems,
          "; ".join(problems) if problems else
          "every mutation's original text is intact and no mutant text is "
          "present. Mutations are applied only to shadow copies.")
    if changed:
        print(f"          note: {len(changed)} root .py file(s) changed during "
              f"the run -- a sibling session's edit, not this runner: "
              f"{', '.join(changed)}")

    # ------------------------------------------------------------------
    # Reported, never asserted. Both facts below are blind spots in the
    # instrument, and neither is this file's to fix -- turning them into
    # failures would make `test_mutation.py` permanently red for something
    # another cell owns, which is how a useful signal gets muted.
    # ------------------------------------------------------------------
    print("\n5. blind spots, REPORTED (these are not assertions)")
    red = [t for t, r in bl.items() if r["status"] != "PASS"]
    if red:
        print(f"  NOTE  {len(red)} test file(s) are RED at baseline and were "
              f"excluded from the detector set: {', '.join(red)}")
        print("        A test that fails either way distinguishes nothing, so "
              "whatever it would have caught is undetected for as long as it "
              "stays red. Every 'caught' above was measured WITHOUT them.")
    else:
        print("  NOTE  every test file is green at baseline; the detector set "
              "is the whole suite")
    bat = sum(1 for r in results if "battery.py" in r["caught_by"])
    print(f"  NOTE  battery.py caught {bat} of {len(results)} mutations, AND "
          f"THAT NUMBER MEANS ALMOST NOTHING -- read the next two sentences "
          f"before quoting it.")
    print("        It USED to mean something. Until 9396946 battery.py's "
          "`__main__` printed and returned, so its exit status was 0 whatever "
          "the sonnet numbers said, and the oracle every result in CLAUDE.md "
          "is quoted against had never been an assertion. That is fixed: "
          "battery.py pins the four counts, exits 1 on drift, and `run_test` "
          "decides on returncode -- so it IS a detector now.")
    print("        But the count above is an artifact of the PLAN, not a "
          "measurement of the detector. battery.py is appended last and the "
          "escalation only runs when the declared subset MISSED, so on a run "
          "where the subset catches everything battery.py is never executed "
          "and scores 0. A perfect detector and a useless one produce the "
          "same number here. To measure it, run a mutant against battery.py "
          "alone. quality/test_mut_oracle.py is the standing assertion.")
    return results


if __name__ == "__main__":
    if os.environ.get("LYRIC_MUTATE_ACTIVE"):
        print("test_mutation.py: refusing to run inside a mutation run "
              "(recursion guard)")
        sys.exit(0)
    ap = argparse.ArgumentParser()
    ap.add_argument("--core", action="store_true",
                    help=f"only {', '.join(CORE)} -- the acceptance triple")
    ap.add_argument("--full", action="store_true",
                    help="every mutation against every green test")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument("--mutation-jobs", type=int, default=2)
    ap.add_argument("--confirm-all", action="store_true")
    ap.add_argument("--timeout", type=int, default=420,
                    help="seconds one test file may take. A timeout is a "
                         "REFUSAL here, not a catch, so a tight limit on a "
                         "loaded machine buys INDETERMINATE results rather "
                         "than wrong ones -- raise it instead of trusting "
                         "them")
    a = ap.parse_args()

    test_the_mutation_list_is_well_formed()
    test_every_mutation_still_applies()
    test_M1_is_declared_verbatim()
    with SingleInstance(mutate._scratch_base()) as lock:
        if not lock.held:
            print("\n4. the verdict")
            print("  SKIP  another mutation sweep is already running in this "
                  "scratch base")
            print("        The static checks above ran and passed. Piling a "
                  "second sweep on top measures the scheduler, not the suite "
                  "-- and this file is `test_*.py`, so every sibling's "
                  "`for f in quality/test_*.py` invokes it.")
        else:
            test_the_run("full" if a.full else "subset",
                         CORE if a.core else None,
                         a.jobs, a.mutation_jobs, a.confirm_all, a.timeout)

    print("=" * 78)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("adversary 4 holds: every declared mutation is caught")
