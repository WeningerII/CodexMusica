#!/usr/bin/env python3
"""The regression that makes M1 impossible to repeat SILENTLY.

    python3 quality/test_mutation.py            # every mutation, declared subsets
    python3 quality/test_mutation.py --static   # the list and the anchors, ~0.3s
    python3 quality/test_mutation.py --core     # M1 and the two controls only
    python3 quality/test_mutation.py --full     # every mutation vs every green test
    python3 quality/test_mutation.py --shard=2/4  # one rotation slice of the list

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
import shutil
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

# ---------------------------------------------------------------------------
# THE SIZE OF THE INVENTORY, PINNED -- AND WHAT IT DOES AND DOES NOT CATCH.
#
# This pin was proposed 2026-08-14 on the premise that "a test pinning 57 would
# have gone red the moment QS3's anchor drifted". IT WOULD NOT HAVE, and saying
# so is the point of writing the numbers down beside the reason. When a sibling
# lot folded `Mandate.returns_check`'s `if r.verbatim is not True: continue`
# into a comprehension, `MUTATIONS` still held 57 entries -- QS3 was still
# declared, still carried its rationale, and had simply stopped matching any
# text. `len(MUTATIONS)` did not move by one. What moved was the number that
# APPLY, and `test_every_mutation_still_applies` below already asserts that,
# names the mutation and names the file.
#
# So this pin is a SECOND tripwire for a DIFFERENT failure, and the failure is
# the one the repair instructions warn about in every place they appear: a
# stale anchor closed by DELETING the mutation. That is the one repair this
# instrument cannot survive -- a hole closed by removing the probe that found
# it -- and until now the only guard against it was `len(muts) >= 12` against
# an inventory of 57. Forty-five of the fifty-seven could have been deleted,
# including every mutation in `quality/`, and every check in this file passed:
# the layer check needs one mutation per layer, `MUST_MUTATE` needs one per
# file, and both are satisfied by a skeleton. A floor set to a third of the
# distance to the target is not a pin, it is permission.
#
# PER SERIES, not one total, because the two series erode differently. The 33
# `M*` are the 2026-08-11 band/comparator set in `lyric_harness.py` and
# `battery.py`; the ~~24~~ 25 `Q*` are the quality layer, added 2026-08-13 to close
# doctrine 94's gap, and they are the ones sitting in files five sibling lots
# edit hourly. One total would let the Q block shrink while the M block grew.
#
# A NUMBER THAT MOVES ON PURPOSE. Adding a mutation is progress and retiring
# one with a reason is legitimate; both are supposed to edit this line in the
# same commit that edits the list. That is the entire mechanism -- the
# deliberate repair touches two files, the silent one touches one.
#
# AND THE MECHANISM WORKED, ON THE SITTING THAT WROTE IT. `QR7` was added to
# `quality/mutate.py` on 2026-08-21 and this line was NOT moved in that commit,
# so CI's `test_mutation.py --static` step went red and stayed red across two
# commits saying `declared 58, pinned 57`. That is exactly the report it is
# built to make: the list grew and the pin did not, and no other check in the
# repository would have said so. Moved here on 2026-08-21 with the reason
# attached, which is the half of the ritual the adding commit skipped.
#
# `Q` 24 -> 25 is QR7: it spans BOTH of `revise.py`'s redundant fan-out
# guards -- the per-line `seen` set and `dict.fromkeys` over `f.locations` --
# so removing either alone leaves the other covering it, and only a mutation
# that removes both proves the pair is load-bearing. Caught by
# `test_revise.py` in a bounded 634s subset run.
DECLARED_TOTAL = 58
DECLARED_BY_SERIES = {"M": 33, "Q": 25}

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
    # See DECLARED_TOTAL above for what this catches (a mutation DELETED) and
    # what it does not (an anchor that DRIFTED -- section 2 owns that).
    series = {k: sum(1 for m in muts if m.name.startswith(k))
              for k in DECLARED_BY_SERIES}
    check(f"the declared inventory is exactly {DECLARED_TOTAL} mutations "
          f"({len(muts)})",
          len(muts) == DECLARED_TOTAL,
          f"declared {len(muts)}, pinned {DECLARED_TOTAL}. If you ADDED a "
          f"mutation or RETIRED one with a reason, move DECLARED_TOTAL in the "
          f"same commit. If you did neither, a mutation has gone missing and "
          f"the fix is to restore it: an anchor closed by deleting its "
          f"mutation is a hole closed by removing the probe that found it.")
    check(f"...and by series: M {DECLARED_BY_SERIES['M']}, "
          f"Q {DECLARED_BY_SERIES['Q']}",
          series == DECLARED_BY_SERIES,
          f"declared {series}, pinned {DECLARED_BY_SERIES}. The Q series is "
          f"the quality layer (doctrine 94's gap, closed 2026-08-13) and it "
          f"lives in files sibling lots edit hourly; one combined total would "
          f"let it shrink while the M series grew."
          if series != DECLARED_BY_SERIES else
          "named neither M* nor Q*: %s"
          % (sorted(m.name for m in muts
                    if m.name[0] not in DECLARED_BY_SERIES) or "none"))
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
    """The tripwire that fires on a drifted anchor, and the SECOND one.

    `quality/mutate.py --dry-run` asks this same question of the same predicate
    and exits non-zero on it. This is the independent carrier, in a different
    file: `--dry-run`'s answer reaches the record through
    `quality/counters.py`'s `mutations declared` row, and that row can be
    silenced by `counters.py --write`, which commits the refusal and exits 0.
    An assertion cannot be cleared by writing a file, so the two are not
    redundant -- they fail in different places and only one of them has a
    remedy that makes it stop asking.

    `mutate.survey_anchors` is the shared predicate rather than a fourth
    private copy of `src.count(old) != 1`; the three copies that existed before
    2026-08-14 had already begun to differ in what they reported.
    """
    print("\n2. every mutation still applies cleanly (STALE != SURVIVED)")
    bad = mutate.survey_anchors(mutate.MUTATIONS)
    check(f"all {len(mutate.MUTATIONS)} anchors name exactly one site in the "
          f"file they target",
          not bad,
          "; ".join(f"{n} [{k}] in {f}: {why}" for n, k, f, why in bad)
          if bad else
          "a drifted anchor is a finding about this LIST, not a hole in the "
          "suite. Re-anchor it, or retire the mutation WITH A REASON -- do "
          "not delete it silently, because the mutation is the only record "
          "that the defect was ever detectable.")


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


def test_the_three_way_outcome():
    """3b. SURVIVED IS EARNED, NOT DEFAULTED (added 2026-08-22).

    `survived` was `not caught and not refused`, and `refused` can only hold a
    suite that RAN and then timed out. A suite the BASELINE dropped never runs,
    so it could never enter `refused` — and a mutation whose declared catcher
    was dropped came back SURVIVED, which this file's own report prints under
    the heading *"each one is a hole in the suite"*. A hole manufactured by a
    time bound.

    IT WAS LIVE, NOT HYPOTHETICAL, WHEN WRITTEN: `quality/test_capacity.py`
    ran in 430s against the then-420s default and WAS dropped from every
    baseline on this machine (M-30's own case; that suite carries a 1000s
    table entry now, and the 420 spelling itself is gone — M-178, the
    argparse default deferring to `mutate.DEFAULT_TIMEOUT`'s one
    definition). What kept it harmless is that 0 of the 58 mutations lose
    their WHOLE declared subset to that bound — escalation to the full green
    suite covers the other 7 — so nothing is misreported today, and the reason
    is escalation rather than luck. A staging that slows one more suite makes
    the population non-empty with nothing connecting the two facts.

    THE DECISION IS A PURE FUNCTION NOW so this section costs microseconds.
    It lived inside `run_mutation`, which forks the whole suite once per
    mutation — the only way to exercise the rule was an hour-long sweep, and a
    rule that expensive to test is one that gets reasoned about instead
    (doctrine 48, inside the module written to find exactly that).
    """
    print("\n3b. the three-way outcome — SURVIVED is earned, not defaulted")
    O = mutate.outcome
    check("caught: neither survived nor indeterminate",
          O({"t": "red"}, {}, []) == (False, False))
    check("nothing caught it and every declared catcher ANSWERED -> SURVIVED, "
          "which is the only shape that earns the word 'hole'",
          O({}, {}, []) == (True, False))
    check("a catcher that ran and timed out -> INDETERMINATE",
          O({}, {"q": "TIMEOUT"}, []) == (False, True))
    check("a catcher the BASELINE DROPPED -> INDETERMINATE, not a hole — the "
          "clause that was missing",
          O({}, {}, ["quality/test_capacity.py"]) == (False, True))
    check("both at once is still one verdict, not two",
          O({}, {"q": "TIMEOUT"}, ["quality/test_capacity.py"])
          == (False, True))
    check("a catch OUTRANKS both — a mutation that was detected is detected "
          "however noisy the run was",
          O({"t": "red"}, {"q": "TIMEOUT"}, ["quality/x.py"]) == (False, False))
    # AND THE EXCLUSIVITY, over every combination rather than the six above:
    # nothing may be both, and exactly one of the three must hold.
    bad = []
    for c in ({}, {"t": "red"}):
        for r in ({}, {"q": "TIMEOUT"}):
            for m in ([], ["quality/test_capacity.py"]):
                sv, ind = O(c, r, m)
                if sv and ind:
                    bad.append((bool(c), bool(r), bool(m)))
                if not (bool(c) or sv or ind):
                    bad.append(("none-of-three", bool(r), bool(m)))
    check("over all 8 combinations exactly one of caught/survived/"
          "indeterminate holds", not bad, str(bad))

    # THE POPULATION, MEASURED — so the section reports the risk's size
    # rather than only its shape (doctrine 20: a guard over an empty
    # population must say the population is empty).
    slow = "quality/test_capacity.py"
    touch = [m for m in mutate.MUTATIONS if m.subset and slow in m.subset]
    whole = [m for m in mutate.MUTATIONS
             if m.subset and set(m.subset) <= {slow}]
    print(f"          {len(touch)} mutation(s) declare {slow} in a subset; "
          f"{len(whole)} would lose their WHOLE subset to it")
    check("no mutation currently loses its whole declared subset to the "
          "slowest suite — recorded, because it is what makes the missing "
          "clause harmless TODAY rather than always",
          not whole, str([m.name for m in whole]))


def test_the_reported_cause_is_the_suites_own():
    """3c. A FAILING SUITE'S CAUSE IS ITS OWN VERDICT, NOT STRAY STDERR.

    `run_test` reported `stderr or stdout` as the tail, so ANY line a suite's
    subprocesses wrote to stderr became the stated reason it was red.
    MEASURED 2026-08-22 on this repo's own baseline: `verify_entries.py`'s
    best-effort `git rev-parse` probe did not redirect stderr, so outside a
    checkout every run of it printed `fatal: not a git repository` while
    exiting perfectly normally — and that line was reported as WHY
    `quality/test_verify_entries.py` had failed, sending a reader after a git
    problem that was not the failure. Both ends are fixed: the probe captures
    its stderr, and the tail prefers the suite's own `N FAILING:` roll-up.
    """
    print("\n3c. a failing suite's reported cause is its own verdict")
    import shutil
    import tempfile
    d = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(d, "quality"))
        probe = os.path.join(d, "quality", "test_zz_cause.py")
        with open(probe, "w", encoding="utf-8") as fh:
            fh.write("import sys\n"
                     "sys.stderr.write('fatal: a red herring\\n')\n"
                     "print('  FAIL  the real reason')\n"
                     "print('1 FAILING: the real reason')\n"
                     "sys.exit(1)\n")
        st, _dt, tail = mutate.run_test(d, "quality/test_zz_cause.py",
                                        timeout=60)
        check("a red suite is FAIL", st == "FAIL", st)
        check("its reported cause is its OWN roll-up, not the stray stderr",
              "the real reason" in tail and "red herring" not in tail, tail)

        # THE CONTROL: a suite that CRASHES prints no roll-up, and there
        # stderr IS the evidence — the fix must not blind the ERROR path.
        crash = os.path.join(d, "quality", "test_zz_crash.py")
        with open(crash, "w", encoding="utf-8") as fh:
            fh.write("import quality_module_that_is_not_there\n")
        st2, _d2, tail2 = mutate.run_test(d, "quality/test_zz_crash.py",
                                          timeout=60)
        check("a crash is still ERROR and still reports its traceback",
              st2 == "ERROR" and "ModuleNotFoundError" in tail2, tail2[:70])
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_the_shards_partition_the_list():
    """3e. EVERY SHARD SET IS A PARTITION — nothing dropped, nothing twice.

    `--shard=I/N` exists so the nightly can pay the sweep in slices, and the
    whole value of that is the claim "shards 1..N together are the whole
    sweep". That claim is arithmetic, so it is CHECKED rather than asserted in
    a comment — and it is checked here, in the static half, so `record` proves
    it on every push for 0.0 s rather than only where the sweep runs.

    THE FAILURE THIS FORBIDS IS SILENT. A stride that dropped one mutation per
    round would leave that mutation unasked FOREVER while every night reported
    a clean shard, which is precisely the shape doctrine 20 names: a check
    that cannot run reading exactly like one that passed.
    """
    print("\n3e. the shard sets partition the declared list")
    names = [m.name for m in mutate.MUTATIONS]
    for n in range(1, len(names) + 1):
        union = []
        for i in range(1, n + 1):
            union.extend(names[i - 1::n])
        if sorted(union) != sorted(names):
            check(f"N={n}: shards 1..N are exactly the declared list",
                  False, f"{len(union)} member(s) against {len(names)}")
            return
    check(f"for EVERY N from 1 to {len(names)}, shards 1..N together are "
          f"exactly the {len(names)} declared mutation(s), each once — the "
          f"stride is swept, not spot-checked, so no N can be the one that "
          f"drops a member", True, f"N=1..{len(names)}")
    # AND THE SLICES ARE BALANCED BY COUNT, which is what makes the stride
    # worth preferring over contiguous chunking.
    #
    # ~~so a per-shard time bound means the same thing on every shard~~ —
    # STRUCK 2026-08-26, REFUTED BY CI. Equal COUNTS are not equal TIME, and
    # the two shards of the nightly's own N=2 measured **171m41s (shard 2/2,
    # run #909, exit 0)** against **>200m (shard 1/2, run #966, killed at the
    # bound)** on lists differing by at most one member. A mutation's cost is
    # the cost of the SUITES its detectors live in, and those run from
    # milliseconds to minutes, so the stride balances the cheap coordinate and
    # says nothing about the expensive one. The count claim is still worth
    # pinning; what is gone is the sentence that read a time guarantee off it.
    n = 4
    sizes = [len(names[i - 1::n]) for i in range(1, n + 1)]
    check(f"the round-robin stride balances BY COUNT: at N={n} the slice "
          f"sizes are {sizes}, max-min <= 1 — a claim about how many "
          f"mutations a shard asks, NOT about how long it takes (measured "
          f"171m41s against >200m on two equal-count shards)",
          max(sizes) - min(sizes) <= 1, str(sizes))


def test_the_shadow_reaches_what_the_suites_read():
    """3f. THE SHADOW HAS THE REPO'S SHAPE (`MISSING.md` M-176).

    The shadow was a copy of lyric-harness ALONE, and three suites were red at
    every mutation baseline for reaching what the real tree really has one
    directory up: `test_verbs.py` §24 opens `../.github/workflows/ci.yml`
    (FileNotFoundError -> ERROR), `test_render_form.py` §6 reads
    `../.claude/settings.json` and the hook script beside it (2 FAILING), and
    `verify_entries.py`'s live prose sweep resolves `mcp/lyric_tools.js`
    against the repo root (1 FAILING). A baseline red excludes its suite from
    every mutation, so the reach quietly cost the sweep three detectors a
    night — reported as suite failures when every one was a fact about the
    COPY. Measured 2026-08-30 on run #1165's own shard: all three red in the
    shadow, all three green at head, one cause.

    This drives the REAL `build_shadow` (0.2s, 24 MB measured) and runs the
    two sub-second suites inside it; `test_verbs` is not run here (its own
    bound is 3000s) — the ci.yml existence check below is the coordinate its
    §24 reads.
    """
    print("\n3f. the shadow reaches what the suites read (M-176)")
    import shutil
    base = mutate._scratch_base()
    tree = mutate.build_shadow(base)
    try:
        reaches = ("../.github/workflows/ci.yml", "../.claude/settings.json",
                   "../.claude/render_form_hook.sh", "../mcp/lyric_tools.js",
                   "../mcp/test.mjs")
        missing = [r for r in reaches
                   if not os.path.exists(os.path.normpath(
                       os.path.join(tree, r)))]
        check("every repo-root path the three suites read resolves from the "
              "shadow harness dir", not missing,
              f"missing: {missing or 'none'} of {len(reaches)}")
        hook = os.path.normpath(
            os.path.join(tree, "../.claude/render_form_hook.sh"))
        check("and the Stop hook keeps its executable bit through the mirror",
              os.path.exists(hook) and os.access(hook, os.X_OK), hook)
        for t in (os.path.join("quality", "test_render_form.py"),
                  os.path.join("quality", "test_verify_entries.py")):
            st, dt, tail = mutate.run_test(tree, t, timeout=600)
            check(f"{t} is GREEN inside the shadow, as at head",
                  st == "PASS", f"{st} in {dt}s: {tail[:120]}")
        # The wrapper is what cleanup takes: deleting only the harness copy
        # would strand the siblings for sweep_scratch to find an hour later.
        check("shadow_root names the disposable wrapper, one level up",
              mutate.shadow_root(tree) == os.path.dirname(tree) and
              os.path.basename(mutate.shadow_root(tree)).startswith("mutant-"),
              mutate.shadow_root(tree))
    finally:
        shutil.rmtree(mutate.shadow_root(tree), ignore_errors=True)


def test_the_bounds_are_declared_and_reachable():
    """3d. THE BOUND IS A PER-SUITE TABLE, AND IT MAY ONLY RAISE.

    One global 420s excluded the four most expensive suites in the repository
    and the summary called all four already-red (`MISSING.md` M-30). Raised
    2026-08-22 on measurement rather than by feel: `suite_sweep.py` timed the
    whole tree, the four outliers got bounds at ~2x their serial runtime, and
    the global default moved 420 -> 600 into the real gap between
    `test_revise.py` (309s) and `test_loop.py` (428s).

    A TABLE AND NOT ONE BIG NUMBER: raising the global ceiling to cover
    `test_verbs` would give a genuinely hung two-second suite half an hour to
    hang in, which is the one thing a bound exists to prevent.
    """
    print("\n3d. the bounds are declared per suite, and only ever raise")
    check("every SUITE_TIMEOUT key names a file that exists — a bound on a "
          "renamed suite is a declared coordinate pointing at nothing",
          all(os.path.exists(os.path.join(HERE, "..", k))
              for k in mutate.SUITE_TIMEOUT),
          str([k for k in mutate.SUITE_TIMEOUT
               if not os.path.exists(os.path.join(HERE, "..", k))]))
    check("every entry RAISES above the default, or it is doing nothing",
          all(v > mutate.DEFAULT_TIMEOUT
              for v in mutate.SUITE_TIMEOUT.values()),
          str({k: v for k, v in mutate.SUITE_TIMEOUT.items()
               if v <= mutate.DEFAULT_TIMEOUT}))
    # THE SEMANTICS, which are the part a caller has to be able to predict:
    # `--timeout N` means AT LEAST N FOR EVERYTHING, and a table nobody read
    # can never quietly lower it.
    slow = os.path.join("quality", "test_verbs.py")
    fast = os.path.join("quality", "test_band.py")
    check("a listed suite gets its own, larger bound",
          mutate.bound_for(slow) == mutate.SUITE_TIMEOUT[slow])
    check("an unlisted suite gets the default",
          mutate.bound_for(fast) == mutate.DEFAULT_TIMEOUT)
    check("`--timeout` raises the floor for an unlisted suite",
          mutate.bound_for(fast, 900) == 900)
    check("...and NEVER lowers a listed one below its declared bound",
          mutate.bound_for(slow, 100) == mutate.SUITE_TIMEOUT[slow],
          "%ds" % mutate.bound_for(slow, 100))
    check("a `--timeout` above every entry raises those too",
          mutate.bound_for(slow, 9000) == 9000)

    # AND THE TABLE MUST GO STALE LOUDLY. `suite_sweep` measures the tree; if
    # a suite outgrows its ceiling the mutation sweep silently drops it again,
    # which is the whole of M-30. This does not RE-TIME the tree — that costs
    # an hour — it pins that the suites measured over the default are
    # exactly the ones that carry an entry, so another outgrowing it is a
    # visible edit here rather than a silent exclusion there.
    #
    # AND THE TRIPWIRE FIRED (M-178): `test_plan` and `test_revise` joined
    # 2026-08-30, each measured 767s of CPU — run #1165's shard had reported
    # both UNRUNNABLE at 420s, every isolated re-run timing out too, so the
    # planner's and the loop's own regression suites were out of the sweep.
    # `test_revise` was the 309s example the 600 default was sized against;
    # it grew 2.5x under §40-45 and nothing re-asked the measurement until
    # the shard died over it.
    MEASURED_OVER_DEFAULT = {"test_verbs", "test_discriminate",
                             "test_capacity", "test_loop",
                             "test_plan", "test_revise"}
    listed = {os.path.basename(k)[:-3] for k in mutate.SUITE_TIMEOUT}
    check("the listed suites are exactly the ones measured above the default "
          "(four on 2026-08-22, two more on 2026-08-30) — another is an edit "
          "here, not a silent drop there",
          listed == MEASURED_OVER_DEFAULT, str(listed ^ MEASURED_OVER_DEFAULT))


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


def run_suite(mode, only, jobs, mutation_jobs, confirm_all, timeout=None):
    base = mutate._scratch_base()
    mutate.sweep_scratch(base)
    muts = [m for m in mutate.MUTATIONS if not only or m.name in set(only)]
    tests = mutate.discover_tests()
    t0 = time.time()
    before = mutate.root_hashes()
    # THE BASELINE IS A PHASE AND IT IS BOUNDED TOO — ADDED 2026-08-26 AFTER
    # THE FIRST VERSION OF THIS DISCLOSURE MISSED THE CASE IT WAS WRITTEN FOR.
    # The `k of n` line below sits inside `as_completed`, so it says nothing
    # until the FIRST MUTATION RESOLVES. A kill that lands in the unmutated
    # baseline therefore produced a log with no bound at all — which is the
    # exact archaeology this disclosure exists to end, surviving in the one
    # phase nobody checked. MEASURED, not hypothesised: a local run killed at
    # 1500s cleared the static sections (98 checks) and died with its last
    # line `baseline: running 77 checks unmutated (...)`, carrying no elapsed
    # figure and no phase count.
    # So the phase ANNOUNCES ITSELF and then reports its own cost. Two lines,
    # both flushed: a truncated log now names WHICH PHASE it died in, and a
    # completed baseline hands the next person the baseline's share of the
    # shard budget, which is what sizing N actually turns on.
    print(f"   ... phase 1 of 2: unmutated baseline over {len(tests)} test "
          f"file(s), 0 of {len(muts)} mutation(s) started", flush=True)
    bl = mutate.baseline(tests, jobs, os.path.join(base, "baseline.json"),
                         confirm_all=confirm_all, timeout=timeout)
    print(f"   ... phase 1 of 2 done ({time.time() - t0:.0f}s elapsed); "
          f"phase 2 is {len(muts)} mutation(s)", flush=True)
    green = [t for t, r in bl.items() if r["status"] == "PASS"]
    results = []
    import concurrent.futures as futures
    with futures.ThreadPoolExecutor(max_workers=mutation_jobs) as ex:
        fs = {ex.submit(mutate.run_mutation, m, green, jobs, mode, base,
                        confirm_all, timeout): m for m in muts}
        # A PROGRESS LINE, FLUSHED, SO A KILLED RUN STILL BOUNDS ITSELF.
        # `timeout Nm` leaves no verdict and no wall clock — the sweep banks
        # nothing, correctly (doctrine 20), but until 2026-08-26 it also SAID
        # nothing about how far it got, so the only way to learn that shard
        # 1/2 needed more than 200m was to read a sibling shard's runtime out
        # of a different CI run and subtract. Reconstructing a shard's size
        # from another shard's log is the archaeology this line ends.
        # ~~a truncated log now carries `k of n` and the elapsed seconds at
        # the kill~~ — STRUCK THE SAME DAY IT WAS WRITTEN, because it was
        # true of this LOOP and false of the RUN. This line cannot fire until
        # the first mutation RESOLVES, and the unmutated baseline runs first
        # and is the expensive phase: a local run killed at 1500s never
        # reached here at all, so the log it left carried no bound and the
        # sentence above described a disclosure the run had not made. The
        # baseline announces itself and reports its cost up in `run_suite`
        # now; between the two, every kill lands inside a phase that has
        # already named itself. The claim this comment may make is about the
        # MUTATION phase only.
        for f in futures.as_completed(fs):
            results.append(f.result())
            print(f"   ... {len(results)} of {len(muts)} mutation(s) resolved "
                  f"({time.time() - t0:.0f}s elapsed)", flush=True)
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


def test_the_run(mode, only, jobs, mutation_jobs, confirm_all, timeout=None):
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

    # ------------------------------------------------------------------
    # A SURVIVOR WHOSE OWN DETECTOR WAS EXCLUDED IS "CANNOT TELL", NOT "NO
    # DETECTOR EXISTS". Doctrines 20 and 28: inconclusive by construction is
    # not a null, and the report must distinguish "none" from "cannot tell".
    #
    # THIS FIRED FOR REAL ON 2026-08-14 and the report was wrong in the
    # dangerous direction. The `nightly` job installed numpy and scikit-learn
    # and not nltk, so nine test files went RED AT BASELINE there and green in
    # `suites` on the same commit. `baseline()` excluded the nine -- correctly;
    # a test that fails either way distinguishes nothing -- and the nine
    # included test_floor.py, test_revise.py and test_fit.py. The sweep then
    # reported 14 SURVIVED in floor.py, revise.py and fit.py: the three files
    # whose detectors had just been removed. Every one of the 14 is caught by
    # a test that exists. The verdict was an artifact of a missing pip install
    # wearing the costume of a coverage hole, and the failure text sent the
    # reader to "write a new assertion in quality/test_mut*.py" -- to write
    # tests that were already there and already worked.
    #
    # The mapping below is the repo's file-naming convention, quality/X.py ->
    # quality/test_X.py, and it is a DECLARED heuristic rather than a proof.
    # It is used only to move a survivor from "hole" to "cannot tell", never
    # the other way, so a wrong guess costs a demotion to inconclusive and
    # never a false clean bill. When the detector set is whole -- `red` empty,
    # which is every run this file was written against -- the partition is
    # empty and this assertion grades exactly as it did before.
    def _detector_of(path):
        d, b = os.path.split(path)
        return os.path.join(d, "test_" + b) if not b.startswith("test_") else path

    red = [t for t, r in bl.items() if r["status"] != "PASS"]
    _red = set(red)
    _file_of = {r["name"]: r["file"] for r in results}
    unexpected = [n for n in survivors if n not in ALLOWLIST]
    blocked = [n for n in unexpected
               if _detector_of(_file_of.get(n, "")) in _red]
    unexpected = [n for n in unexpected if n not in set(blocked)]
    if blocked:
        # Doctrine 79: three counts, reported apart and never summed. These are
        # neither caught nor holes, and rolling them into either number is the
        # error this block exists to stop.
        print(f"  NOTE  {len(blocked)} survivor(s) INCONCLUSIVE — the mutated "
              f"file's own detector was RED at baseline and excluded from the "
              f"detector set, so 'survived' here cannot be distinguished from "
              f"'nothing was asked': " + ", ".join(
                  f"{n} ({_file_of.get(n, '?')}, detector "
                  f"{_detector_of(_file_of.get(n, ''))} excluded)"
                  for n in blocked))
        print("        Fix the baseline first, then re-run. Until then this "
              "is a fact about the environment, not about the suite.")
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
    ap.add_argument("--static", action="store_true",
                    help="sections 1-3 only: the checks that read the list "
                         "and the source and fork nothing. ~0.3 s, no sweep")
    ap.add_argument("--core", action="store_true",
                    help=f"only {', '.join(CORE)} -- the acceptance triple")
    ap.add_argument("--full", action="store_true",
                    help="every mutation against every green test")
    # THE SLICE, ADDED 2026-08-24 BECAUSE THE SWEEP OUTGREW ITS NIGHT.
    # MEASURED on the runner, from the Actions API and not from memory: the
    # 2026-08-23 nightly ran this file in 7,627 s (2 h 07 m) and PASSED; the
    # 2026-08-24 nightly was still inside it at 12,949 s (3 h 36 m) when the
    # job's own `timeout-minutes` cancelled the whole thing. Eleven test
    # suites were added between those two runs -- `suites` names "the 54
    # cheap suites" on the first and "the 65" on the second -- and this file
    # re-runs the suite once per mutation, so its cost tracks the suite's and
    # will keep doing so.
    #
    # WHAT THE CANCELLATION COST WAS NOT THE SWEEP. Three later steps never
    # ran, and the `actions/cache` post step that banks the song-profile memo
    # was skipped, so that night's 150-minute slice was computed and thrown
    # away -- the deadlock the nightly's own comment warns about, one level
    # up: "If the JOB hits `timeout-minutes` it is cancelled and the cache's
    # post step can be skipped."
    #
    # A SHARD IS A COMPLETE ANSWER ABOUT ITS OWN MEMBERS, which a truncated
    # sweep is not: every mutation is verified independently, so `MUTATIONS
    # [i-1::n]` is a real verdict on those and says nothing about the rest.
    # The stride is round-robin rather than contiguous ON PURPOSE -- the list
    # is grouped by target file, so a contiguous block would put a whole
    # module's mutations in one shard and leave it unasked for n-1 nights.
    # The verdict line below says which shard ran; it may not say "every
    # declared mutation is caught" when it has only asked a quarter of them
    # (doctrine 20).
    ap.add_argument("--shard", metavar="I/N",
                    help="run mutation slice I of N (1-based, round-robin "
                         "over the declared list). Full coverage takes N "
                         "runs; the verdict names the slice it asked about")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument("--mutation-jobs", type=int, default=2)
    ap.add_argument("--confirm-all", action="store_true")
    ap.add_argument("--timeout", type=int, default=None,
                    help="seconds one test file may take. A timeout is a "
                         "REFUSAL here, not a catch, so a tight limit on a "
                         "loaded machine buys INDETERMINATE results rather "
                         "than wrong ones -- raise it instead of trusting "
                         "them")
    a = ap.parse_args()

    # THE SLICE IS RESOLVED BEFORE ANYTHING RUNS, so a malformed one costs a
    # refusal and not two hours. `--shard` and `--core` name two different
    # subsets and reading both would leave nobody able to say which produced
    # the answer -- the same refusal `plan` makes for `--seed` with `--sweep`.
    shard = None
    if a.shard:
        if a.core:
            print("test_mutation.py: --shard and --core name two different "
                  "subsets; pass one")
            sys.exit(2)
        try:
            _i, _n = (int(x) for x in str(a.shard).split("/"))
        except ValueError:
            print(f"test_mutation.py: --shard={a.shard!r} is not I/N")
            sys.exit(2)
        if _n < 1 or not 1 <= _i <= _n:
            print(f"test_mutation.py: --shard={a.shard!r} is out of range — "
                  f"I/N with N >= 1 and 1 <= I <= N")
            sys.exit(2)
        shard = (_i, _n)

    test_the_mutation_list_is_well_formed()
    test_every_mutation_still_applies()
    test_M1_is_declared_verbatim()
    test_the_three_way_outcome()
    test_the_reported_cause_is_the_suites_own()
    test_the_bounds_are_declared_and_reachable()
    test_the_shards_partition_the_list()
    test_the_shadow_reaches_what_the_suites_read()
    if a.static:
        # 3f built a snapshot this exit path would otherwise strand on a
        # shared disk (the sweep path's own cleanup sits after section 4).
        if mutate._SNAPSHOT.get("path"):
            shutil.rmtree(mutate._SNAPSHOT["path"], ignore_errors=True)
            mutate._SNAPSHOT.pop("path", None)
        # THE TRIPWIRE WAS WELDED TO THE SWEEP, WHICH IS WHY NOBODY RAN IT.
        # Sections 1-3 read the mutation list and seven source files and cost
        # ~0.3 s (3f adds a measured 0.2 s shadow build and two sub-second
        # suites); section 4 forks the whole test suite once per mutation and
        # cost 4,984 s for nineteen mutations on 2026-08-13. Until 2026-08-14
        # there was no way to ask for the first without paying for the second,
        # so the assertion that would have caught QS3's drift the day it
        # happened was, in practice, unreachable -- `--core` does not help,
        # because it still computes the full green baseline before running its
        # three mutations. That is doctrine 48's shape inside the adversary
        # that exists to find it: a check nobody can afford to run gets run
        # exactly as often as somebody remembers to spend an afternoon on it.
        print("=" * 78)
        if FAILURES:
            print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
            sys.exit(1)
        print("the mutation list is well formed and every anchor still "
              "applies — the SWEEP was not run (--static)")
        sys.exit(0)
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
            only = CORE if a.core else None
            if shard:
                i, n = shard
                names = [m.name for m in mutate.MUTATIONS]
                only = names[i - 1::n]
                print(f"\n   SHARD {i}/{n} — {len(only)} of {len(names)} "
                      f"declared mutation(s) this run, round-robin over the "
                      f"list: {', '.join(only)}")
                print(f"        The other {len(names) - len(only)} are NOT "
                      f"asked here and this run says nothing about them; "
                      f"shards 1..{n} together are the whole sweep.")
            test_the_run("full" if a.full else "subset", only,
                         a.jobs, a.mutation_jobs, a.confirm_all, a.timeout)

    print("=" * 78)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    if shard:
        # NOT "every declared mutation is caught" — this run asked a slice,
        # and a line that overclaims is worse than one that reports less.
        print(f"adversary 4 holds ON SHARD {shard[0]}/{shard[1]}: every "
              f"mutation in this slice is caught. The slice is the claim.")
    else:
        print("adversary 4 holds: every declared mutation is caught")
