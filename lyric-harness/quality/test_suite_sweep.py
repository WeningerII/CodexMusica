#!/usr/bin/env python3
"""Regressions for the suite sweep (quality/suite_sweep.py).

    python3 quality/test_suite_sweep.py

Sections:
  1  the sweep repairs nothing, and that is on the AST
  2  discovery is a scan, and every exclusion carries its reason
  3  the three verdicts are each REACHABLE, on constructed suites
  4  a bound is CANNOT RUN and a crash is FAIL -- the defect this replaces
  5  a suite that prints FAIL and exits 0 is caught and NAMED
  6  `main` calls `sweep()`, and the population is re-read at the end

THE CONSTRUCTED SUITES ARE THE POINT.  A sweep tested only against this
repo's real suites can be tested only against whatever they happen to do
today -- and today they all pass, so PASS would be the only verdict any
check here could reach and the other two would be doctrine 20's empty
population wearing a green tick.  Sections 3-5 write throwaway suites that
fail, crash, hang and lie, because those are the four answers the sweep
exists to tell apart and none of them is in the tree.
"""

import ast
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import suite_sweep as SS  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


#: Same list `test_pin_sweep.py` holds over the other sweep. A sweep that can
#: repair launders every suite it touches at once.
WRITING_FLAGS = ("--write", "--rebaseline", "--adopt", "--fix", "--repair")


def _live_string_constants(path):
    """-> [str, ...] every string literal that is NOT a docstring.

    Docstrings are excluded BY NODE IDENTITY and never by comparing text:
    `ast.get_docstring` returns a CLEANED value (dedented, stripped) that does
    not equal the raw `Constant.value`, so a value comparison excludes nothing
    and the check then fails on the module's own prose. `test_pin_sweep.py`
    §1 and `test_declared_inputs.py` §15 both record paying for that once.
    """
    tree = ast.parse(open(path, encoding="utf-8").read())
    doc_nodes = set()
    for n in ast.walk(tree):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)):
            body = getattr(n, "body", None)
            if (body and isinstance(body[0], ast.Expr)
                    and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                doc_nodes.add(id(body[0].value))
    return [n.value for n in ast.walk(tree)
            if isinstance(n, ast.Constant) and isinstance(n.value, str)
            and id(n) not in doc_nodes]


def _write_suite(d, name, body):
    p = os.path.join(d, "quality", name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(body)
    return "quality/" + name


def test_the_sweep_cannot_repair():
    print("\n1. the sweep repairs nothing, and that is mechanical")
    live = _live_string_constants(SS.__file__)
    for flag in WRITING_FLAGS:
        offenders = [s for s in live if flag in s]
        check("no live string literal contains %r" % flag,
              not offenders, str(offenders[:3]))
    # AND THE NON-VACUITY HALF: the guard must be reading something. An empty
    # `live` would pass every check above while examining nothing.
    check("the guard examined a real body of literals",
          len(live) > 30, "%d live string constants" % len(live))
    # THE MODULE PASSES NO ARGUMENTS AT ALL, which is the stronger contract:
    # a suite's default arm is the arm CI runs, and running a cheaper one
    # would report a pass for a question nobody asked.
    # DECLARED, WITH THE REASON, rather than a looser rule. The guard's point
    # is that NOTHING is passed to a SUITE, and a blanket "no `--` literals"
    # is how that is made mechanical — so an exception is admitted by being
    # written down, not by widening the test. This one is the git probe that
    # names the revision the sweep graded, which runs `git`, never a suite.
    ALLOWED = {
        "--only": "this module's own flag",
        "--timeout": "this module's own flag",
        "--json": "this module's own flag",
        "--short": "`git rev-parse --short HEAD` in `head_revision`, which "
                   "runs GIT and never a suite (added 2026-08-22 with the "
                   "tree-moved disclosure)",
    }
    argv_literals = [x for x in live if x.startswith("--") and x not in ALLOWED]
    check("every `--` literal in the module is declared, and none of them "
          "reaches a suite", not argv_literals, str(argv_literals[:4]))
    check("...and the declaration is not padding: every allowed flag is "
          "actually present in the module",
          all(f in live for f in ALLOWED),
          str([f for f in ALLOWED if f not in live]))


def test_discovery_and_exclusions():
    print("\n2. discovery is a scan, and every exclusion carries its reason")
    found = SS.discover()
    check("the sweep finds a substantial population -- an empty one would "
          "make every check below pass on nothing (doctrine 20)",
          len(found) >= 40, "%d suites" % len(found))
    check("every discovered suite exists on disk",
          all(os.path.exists(os.path.join(SS.ROOT, f)) for f in found))
    # A TABLE NAMING A FILE THAT IS NOT THERE IS ROT, and it rots silently:
    # the exclusion keeps excluding a path nobody has any more.
    missing = [k for k in SS.EXCLUDED
               if not os.path.exists(os.path.join(SS.ROOT, k))]
    check("every EXCLUDED key names a file that exists", not missing,
          str(missing))
    check("every exclusion carries a written reason, not a bare name",
          all(len(v) > 60 for v in SS.EXCLUDED.values()),
          str([k for k, v in SS.EXCLUDED.items() if len(v) <= 60]))
    check("nothing is both discovered and excluded",
          not (set(found) & set(SS.EXCLUDED)))
    # SAME FOR THE BOUNDS TABLE: an override on a suite that has been renamed
    # is a declared coordinate pointing at nothing.
    bad = [k for k in SS.SUITE_TIMEOUT
           if not os.path.exists(os.path.join(SS.ROOT, k))]
    check("every SUITE_TIMEOUT key names a file that exists", not bad,
          str(bad))
    check("this suite is itself in the population -- a sweep that skips its "
          "own regressions is the shape it exists to find",
          "quality/test_suite_sweep.py" in found)


def test_three_verdicts_are_reachable():
    print("\n3. the three verdicts are each reachable, on constructed suites")
    d = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(d, "quality"))
        ok = _write_suite(d, "test_zz_ok.py",
                          "print('  PASS  a thing')\n")
        red = _write_suite(d, "test_zz_red.py",
                           "print('  FAIL  a thing')\n"
                           "raise SystemExit(1)\n")
        # SLEEPS LONG AND IS NEVER WAITED OUT: every call below bounds it,
        # so the sleeper's own number costs the suite nothing. It was 30s and
        # one call forgot the bound, which cost this section 30 seconds on
        # every run for exactly no assertion.
        slow = _write_suite(d, "test_zz_slow.py",
                            "import time\ntime.sleep(600)\n")
        r_ok = SS.run_one(ok, root=d, timeout=60)
        r_red = SS.run_one(red, root=d, timeout=60)
        r_slow = SS.run_one(slow, root=d, timeout=1)
        check("a clean suite is PASS", r_ok["verdict"] == "PASS",
              str(r_ok["verdict"]))
        check("a red suite is FAIL and its OWN words are the evidence",
              r_red["verdict"] == "FAIL"
              and any("a thing" in l for l in r_red["evidence"]),
              str(r_red["evidence"]))
        check("a suite that exceeds its bound is CANNOT RUN, NOT FAIL",
              r_slow["verdict"] == "CANNOT RUN", str(r_slow["verdict"]))
        # THE DEFECT THIS MODULE REPLACES, STATED AS AN INEQUALITY. The shell
        # loop rendered the bound case as `FAIL(0 rc=124)` -- same column,
        # same summary line, distinguishable from a real failure only by a
        # bare `0`. If these two ever return the same verdict the module has
        # regressed to the loop.
        check("a bound and a red check do not return the same verdict",
              r_slow["verdict"] != r_red["verdict"],
              "%s vs %s" % (r_slow["verdict"], r_red["verdict"]))
        check("the bound is NAMED in the evidence, with its size",
              any("bound" in l and str(r_slow["bound"]) in l
                  for l in r_slow["evidence"]), str(r_slow["evidence"]))
        # AND THE THREE COUNTS ARE NEVER SUMMED: the sweep over all three
        # reports 1/1/1 and not 3.  The bound is passed EXPLICITLY -- the
        # first draft let `sweep()` take the 1,200s default, so the sleeper
        # simply finished and the section reported PASS 2 / FAIL 1 / CANNOT
        # RUN 0.  A check whose third verdict is unreachable is doctrine 20
        # inside the section written to keep the three apart.
        rows = SS.sweep(root=d, timeout=3)
        counts = {k: sum(1 for r in rows if r["verdict"] == k)
                  for k in ("PASS", "FAIL", "CANNOT RUN")}
        check("a sweep of all three reports one of each, kept apart",
              counts == {"PASS": 1, "FAIL": 1, "CANNOT RUN": 1}, str(counts))
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_red_before_the_bound_is_still_red():
    """THE CASE THE REAL TREE HANDED THIS MODULE, and no constructed fixture
    would have suggested it: `quality/test_verbs.py` printed a red check and
    THEN exceeded its bound (measured 2026-08-22, the first full sweep). A
    `run_one` that discards the partial buffer answers CANNOT RUN and loses a
    true finding -- the sweep saying "I could not tell" about a suite that had
    already told it."""
    print("\n3b. a red check printed BEFORE the bound is still red")
    d = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(d, "quality"))
        both = _write_suite(
            d, "test_zz_red_then_slow.py",
            "import sys, time\n"
            "print('  FAIL  a check that ran and was red')\n"
            "sys.stdout.flush()\n"
            "time.sleep(600)\n")
        r = SS.run_one(both, root=d, timeout=3)
        check("a suite that printed FAIL and then timed out is FAIL, not "
              "CANNOT RUN", r["verdict"] == "FAIL", str(r["verdict"]))
        check("the suite's own red check survives the bound as evidence",
              any("a check that ran and was red" in l for l in r["evidence"]),
              str(r["evidence"]))
        # DOCTRINE 79: two facts, and the second is not allowed to disappear
        # into the first. The reader is told the rest is unknown.
        check("and the run is disclosed as INCOMPLETE, not merely failed",
              any("REST of the suite is unknown" in l for l in r["evidence"]),
              str(r["evidence"]))
        # THE CONTROL: a bound with NOTHING printed red must still be CANNOT
        # RUN, or the fix above has quietly turned every timeout into a
        # failure -- the exact defect this module replaces, inverted.
        quiet = _write_suite(d, "test_zz_quiet_slow.py",
                             "import time\ntime.sleep(600)\n")
        r2 = SS.run_one(quiet, root=d, timeout=3)
        check("a silent timeout is still CANNOT RUN",
              r2["verdict"] == "CANNOT RUN", str(r2["verdict"]))
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_a_crash_is_not_a_refusal():
    print("\n4. a crash is FAIL; only the sweep's own blindness is CANNOT RUN")
    d = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(d, "quality"))
        boom = _write_suite(d, "test_zz_boom.py",
                            "import quality_module_that_is_not_there\n")
        r = SS.run_one(boom, root=d, timeout=60)
        # THE TWO REMEDIES ARE DIFFERENT AND THAT IS WHY THE VERDICTS ARE.
        # A crashing suite means something in this tree is broken and a person
        # must fix it. A bound means the sweep could not ask, and nothing is
        # known either way. Collapsing them sends the reader to the wrong job.
        check("an import error is FAIL, not CANNOT RUN",
              r["verdict"] == "FAIL", str(r["verdict"]))
        check("it says it CRASHED rather than failed a check, since no check "
              "was ever printed",
              any("crash" in l.lower() or "Error" in l for l in r["evidence"]),
              str(r["evidence"]))
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_a_suite_that_lies_about_its_own_exit_code():
    print("\n5. a suite that prints FAIL and exits 0 is caught and named")
    d = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(d, "quality"))
        liar = _write_suite(d, "test_zz_liar.py",
                            "print('  FAIL  something real')\n")
        r = SS.run_one(liar, root=d, timeout=60)
        # THE EXIT CODE AND THE PRINTED CHECKS ARE TWO READINGS OF ONE
        # QUESTION (doctrine 1). CI reads the exit code, a person reads the
        # checks, and here they disagree -- so CI is green while the tree is
        # red. The verdict follows the checks, and the disagreement is not
        # swallowed into a plain FAIL: it is a defect in THAT SUITE, and a
        # reader who is told only "FAIL" will go looking in the wrong file.
        check("the printed check wins over the exit code",
              r["verdict"] == "FAIL", "%s at exit %s" % (r["verdict"],
                                                         r["exit"]))
        check("the disagreement is recorded as its own fact", r["disagrees"])
        check("and the evidence says CI would have missed it",
              any("EXITED 0" in l for l in r["evidence"]), str(r["evidence"]))
        # THE CONTROL: an ordinary red suite must NOT be marked as lying.
        honest = _write_suite(d, "test_zz_honest.py",
                              "print('  FAIL  something real')\n"
                              "raise SystemExit(1)\n")
        r2 = SS.run_one(honest, root=d, timeout=60)
        check("an honestly-failing suite is not flagged as disagreeing",
              r2["verdict"] == "FAIL" and not r2["disagrees"])
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_the_tree_it_graded_is_disclosed():
    """A SWEEP OVER A MOVING TREE IS NOT A MEASUREMENT OF ANY ONE COMMIT.

    Found by USING this module: its own first full run took about ninety
    minutes while its author kept committing, so suite 5 was graded against a
    tree suite 55 never saw — and the summary still read `N of N`. The
    population disclosure already reports a tree that GREW; nothing reported a
    tree that CHANGED, which is the more misleading of the two because the
    count looks complete either way.
    """
    print("\n7. the sweep says WHICH tree it graded, not only how many")
    head = SS.head_revision()
    # CONDITIONAL, AND THE CONDITION IS THE SECTION'S OWN SUBJECT. The first
    # draft asserted this unconditionally and went red inside the shadow tree
    # `quality/mutate.py` builds — which is not a checkout, which is the exact
    # thing the next check is about. A section that demands a checkout in
    # order to test a probe designed to survive not having one is the
    # checkout assumption this whole sitting has been removing
    # (`MISSING.md` M-30), committed inside the check written against it.
    # Found by the mutation sweep, on the commit that added it.
    if head:
        check("read from a checkout, the revision is a short hash",
              6 <= len(head) <= 12 and " " not in head, repr(head))
    else:
        print("  REFUSED  the revision is readable from a checkout")
        print("          not a git work tree, so there is no revision to "
              "read. The probe answering '' IS the behaviour the next two "
              "checks pin (doctrine 20).")
    # A PROBE THAT FAILS MUST LEAVE NO LINE FOR A LATER READER TO MISREAD
    # (`MISSING.md` M-30's seventh, where exactly such a line became the
    # published cause of an unrelated failure). Outside a checkout this must
    # answer "" QUIETLY.
    d = tempfile.mkdtemp()
    try:
        import subprocess
        code = ("import sys; sys.path.insert(0, %r)\n"
                "from quality import suite_sweep as SS\n"
                "print(repr(SS.head_revision(%r)))\n"
                % (os.path.join(HERE, ".."), d))
        p = subprocess.run([sys.executable, "-c", code], capture_output=True,
                           text=True, timeout=60)
        check("outside a checkout it answers '' rather than raising",
              p.returncode == 0 and p.stdout.strip() == "''",
              "%r / %r" % (p.stdout.strip(), p.stderr.strip()[:60]))
        check("...and it writes NOTHING to stderr — a failed probe must not "
              "leave a line a later reader can mistake for a cause",
              not p.stderr.strip(), repr(p.stderr.strip()[:80]))
    finally:
        shutil.rmtree(d, ignore_errors=True)
    # AND THE SUMMARY MUST BE ABLE TO SAY IT, or the reading is computed and
    # dropped — this repo's most-filed defect.
    live = _live_string_constants(SS.__file__)
    check("the summary can say the tree MOVED under the run",
          any("TREE MOVED" in s for s in live))


def test_main_calls_sweep_and_rereads_the_tree():
    print("\n6. main calls sweep(), and the population is re-read at the end")
    tree = ast.parse(open(SS.__file__, encoding="utf-8").read())
    fns = {n.name: n for n in ast.walk(tree)
           if isinstance(n, ast.FunctionDef)}
    main = fns["main"]
    calls = {n.func.id for n in ast.walk(main)
             if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}
    # `pin_sweep` shipped for ten minutes with `main` re-implementing the
    # walk beside `sweep()` -- one question, two readings, in one file, and
    # its own `counters.py --check` is what named the second walk.
    check("main calls sweep() rather than walking the suites itself",
          "sweep" in calls, str(sorted(calls)))
    # THE POPULATION IS FROZEN AT START, so the summary has to ask the tree
    # again or a `60 of 60` can be true of a population that stopped being
    # the tree -- measured on the loop this replaces, which never covered
    # `quality/test_pin_sweep.py` and said 60 of 60 anyway.
    n_discover = sum(1 for n in ast.walk(main)
                     if isinstance(n, ast.Call)
                     and isinstance(n.func, ast.Name)
                     and n.func.id == "discover")
    check("main asks the tree TWICE -- once to plan, once to disclose",
          n_discover >= 2, "%d discover() calls in main" % n_discover)
    # And the disclosure has to be able to SAY it, or the second read is
    # computed and dropped -- this repo's most-filed defect.
    live = _live_string_constants(SS.__file__)
    check("the summary can say the tree grew under the run",
          any("GREW" in s or "grew" in s for s in live))


for fn in (test_the_sweep_cannot_repair,
           test_discovery_and_exclusions,
           test_three_verdicts_are_reachable,
           test_red_before_the_bound_is_still_red,
           test_a_crash_is_not_a_refusal,
           test_a_suite_that_lies_about_its_own_exit_code,
           test_main_calls_sweep_and_rereads_the_tree,
           test_the_tree_it_graded_is_disclosed):
    fn()

print("\n" + "=" * 70)
if FAILURES:
    print("%d FAILING: %s" % (len(FAILURES), ", ".join(FAILURES)))
    sys.exit(1)
print("the sweep tells a red check, a crash, a bound and a lie apart")
