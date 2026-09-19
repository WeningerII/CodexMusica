#!/usr/bin/env python3
"""The one dealing-and-timing idiom, held to its arithmetic.

`quality/shard.py` is what every dealt suite calls (`MISSING.md` M-244). A
suite that is dealt wrong fails in two silent ways: a section run by NO
shard passes by omission, and a shard that runs everything looks like a
shard that ran its share. Both are pinned here on the arithmetic, not on a
sample run.

Run: python3 quality/test_shard.py
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from quality import shard as S  # noqa: E402

FAILURES = []


def check(name, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(name)


def _env(val):
    if val is None:
        os.environ.pop("TEST_SHARD_PROBE", None)
    else:
        os.environ["TEST_SHARD_PROBE"] = val


def test_the_deal_is_exactly_once():
    print("\n1. every section runs EXACTLY ONCE across a full k=1..n matrix, "
          "for every n that CI uses or might")
    sections = tuple(f"s{i}" for i in range(53))
    for n in (1, 2, 3, 4, 5, 6, 8, 12):
        seen = []
        for k in range(1, n + 1):
            _env(f"{k}/{n}")
            chosen, kn = S.dealt(sections, "TEST_SHARD_PROBE")
            seen.extend(chosen)
            check(f"n={n} k={k}: the shard reports its coordinate and holds "
                  f"only indices ≡ {k - 1} (mod {n})",
                  kn == (k, n)
                  and all(sections.index(c) % n == k - 1 for c in chosen))
        check(f"n={n}: the union of the shards is the whole tuple, each "
              f"section once, in tuple order within a shard",
              sorted(seen) == sorted(sections) and len(seen) == len(sections))
    _env(None)
    chosen, kn = S.dealt(sections, "TEST_SHARD_PROBE")
    check("unset runs everything, in order, and reports no coordinate — "
          "the local command nobody has to relearn",
          chosen == list(sections) and kn is None)
    _env("")
    chosen, kn = S.dealt(sections, "TEST_SHARD_PROBE")
    check("an EMPTY value is unset, not a refusal",
          chosen == list(sections) and kn is None)


def test_a_bad_coordinate_refuses():
    print("\n2. a malformed or out-of-range coordinate REFUSES rather than "
          "running the whole suite as if it were its share")
    for bad in ("0/4", "5/4", "2", "a/b", "1/0"):
        _env(bad)
        try:
            S.dealt(("a", "b"), "TEST_SHARD_PROBE")
            refused = False
        except SystemExit as e:
            refused = "refuses" in str(e)
        check(f"{bad!r} refuses by name", refused)
    _env(None)


def test_run_sections_times_and_gates():
    print("\n3. run_sections times every section it ran, prints them slowest "
          "first, runs `always` on every shard, and gates on the failures "
          "list AFTER the sections ran")
    ran = []

    def mk(name):
        def fn():
            ran.append(name)
        fn.__name__ = name
        return fn
    secs = tuple(mk(f"sec{i}") for i in range(5))
    always = (mk("everywhere"),)
    fails = []
    for k in (1, 2):
        ran.clear()
        _env(f"{k}/2")
        out = io.StringIO()
        rc = S.run_sections(secs, "TEST_SHARD_PROBE", fails, "footer text",
                            always=always, out=out)
        text = out.getvalue()
        check(f"shard {k}/2: exit 0 on an empty failures list and the footer "
              f"is the last line", rc == 0 and text.rstrip().endswith("footer text"))
        check(f"shard {k}/2: `always` ran here too, first",
              ran and ran[0] == "everywhere")
        check(f"shard {k}/2: the dealt sections are the residue class",
              [r for r in ran[1:]] == [f"sec{i}" for i in range(5)
                                       if i % 2 == k - 1])
        check(f"shard {k}/2: SECTION COST names every section that ran and "
              f"the TOTAL counts them (dealt + always)",
              "SECTION COST" in text
              and all(r in text for r in ran)
              and f"TOTAL, this shard ({len(ran)} of {len(secs) + 1} "
                  f"sections)" in text)
    _env(None)
    out = io.StringIO()
    rc = S.run_sections(secs, "TEST_SHARD_PROBE", ["a check that failed"],
                        "footer text", out=out)
    check("a non-empty failures list exits 1 and prints FAILING, never the "
          "footer", rc == 1 and "1 FAILING: a check that failed" in out.getvalue()
          and "footer text" not in out.getvalue())
    check("...and unset ran all five", ran[-5:] == [f"sec{i}" for i in range(5)])


def test_every_dealt_suite_calls_the_one_idiom():
    print("\n4. every suite CI deals calls `quality.shard.run_sections` and "
          "keeps no residue arithmetic of its own (doctrine 1)")
    import re
    ci = open(os.path.join(HERE, "..", "..", ".github", "workflows",
                           "ci.yml"), encoding="utf-8").read()
    dealt = sorted(set(re.findall(r"TEST_([A-Z_]+)_SHARD:", ci)))
    check("ci.yml deals at least the five suites this entry moved",
          {"VERBS", "PLAN", "REVISE", "LOOP", "CAPACITY"} <= set(dealt),
          str(dealt))
    for name in dealt:
        path = os.path.join(HERE, f"test_{name.lower()}.py")
        src = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        # CODE, not comments: a suite may EXPLAIN the deal in prose beside
        # the call ("index ≡ k-1 (mod n)"); what it may not do is compute it.
        code = "\n".join(l for l in src.splitlines()
                         if not l.lstrip().startswith("#"))
        check(f"test_{name.lower()}.py calls run_sections and spells no "
              f"`% n ==` residue of its own (in code; comments may explain it)",
              "from quality.shard import run_sections" in src
              and f'"TEST_{name}_SHARD"' in src
              and not re.search(r"% *n *== *k *- *1", code),
              path)


def test_no_section_reads_what_another_section_wrote():
    print("\n5. in a dealt suite no section READS module state another section "
          "WROTE -- a verdict that depends on section order is a verdict "
          "that depends on the deal (doctrine 66)")
    # THE DEFECT THIS PINS, 2026-09-05 (`MISSING.md` M-244): test_loop §16
    # compared its own run to a (width, count) pair §13 had appended to a
    # module-level list. Serial, always green. The first dealt CI run put
    # §13 and §16 in different shards and §16 read an empty list:
    # `width ? -> ? pair(s)`, red. Every section a shard may run alone must
    # carry its own evidence, so this walks each dealt suite's AST for a
    # module-level container mutated inside one `test_*` function and read
    # inside a DIFFERENT one. `FAILURES` is the one shared sink and is
    # exempt by name: it is written by `check()` and read by the runner.
    import ast
    import re
    MUT = {"append", "extend", "add", "update", "clear", "insert", "pop",
           "remove", "setdefault", "discard"}

    def handoffs(path):
        tree = ast.parse(open(path, encoding="utf-8").read())
        shared = set()
        for n in tree.body:
            if not isinstance(n, ast.Assign):
                continue
            v = n.value
            container = (isinstance(v, (ast.List, ast.Dict, ast.Set,
                                        ast.ListComp, ast.DictComp))
                         or (isinstance(v, ast.Call)
                             and isinstance(v.func, ast.Name)
                             and v.func.id in ("list", "dict", "set")))
            if container:
                shared |= {t.id for t in n.targets if isinstance(t, ast.Name)}
        shared.discard("FAILURES")
        sections = set()
        for node in tree.body:
            if (isinstance(node, ast.Assign)
                    and any(isinstance(t, ast.Name) and t.id == "_SECTIONS"
                            for t in node.targets)
                    and isinstance(node.value, (ast.Tuple, ast.List))):
                sections.update(x.id for x in node.value.elts if isinstance(x, ast.Name))
        writers, readers = {}, {}
        for fn in tree.body:
            if not (isinstance(fn, ast.FunctionDef)
                    and (fn.name.startswith("test_") or fn.name in sections)):
                continue
            for node in ast.walk(fn):
                if (isinstance(node, ast.Call)
                        and isinstance(node.func, ast.Attribute)
                        and node.func.attr in MUT
                        and isinstance(node.func.value, ast.Name)
                        and node.func.value.id in shared):
                    writers.setdefault(node.func.value.id, set()).add(fn.name)
                if (isinstance(node, ast.Subscript)
                        and isinstance(node.ctx, ast.Store)
                        and isinstance(node.value, ast.Name)
                        and node.value.id in shared):
                    writers.setdefault(node.value.id, set()).add(fn.name)
                if (isinstance(node, ast.Name) and node.id in shared
                        and isinstance(node.ctx, ast.Load)):
                    readers.setdefault(node.id, set()).add(fn.name)
        return sorted((name, sorted(ws), sorted(readers.get(name, set()) - ws))
                      for name, ws in writers.items()
                      if readers.get(name, set()) - ws)

    ci = open(os.path.join(HERE, "..", "..", ".github", "workflows",
                           "ci.yml"), encoding="utf-8").read()
    dealt = sorted(set(re.findall(r"TEST_([A-Z_]+)_SHARD:", ci)))
    for name in dealt:
        path = os.path.join(HERE, f"test_{name.lower()}.py")
        found = handoffs(path) if os.path.exists(path) else [("(missing)", [], [])]
        check(f"test_{name.lower()}.py: no section reads a container another "
              f"section mutated", not found, str(found))
    # THE CHECK CAN FAIL: the shape it refuses, planted in a scratch module.
    planted = os.path.join(os.environ.get("TMPDIR", "/tmp"),
                           "shard_planted_handoff.py")
    with open(planted, "w", encoding="utf-8") as fh:
        fh.write("_SEEN = []\n"
                 "def test_a():\n    _SEEN.append(1)\n"
                 "def test_b():\n    assert _SEEN\n"
                 "def test_c():\n    local = []\n    local.append(2)\n")
    try:
        got = handoffs(planted)
    finally:
        os.remove(planted)
    check("PLANTED: a list one section appends and another reads IS found, "
          "named by writer and reader; a section-local list is not",
          got == [("_SEEN", ["test_a"], ["test_b"])], str(got))


def _ci_jobs():
    """-> `{job name: its block text}` from `.github/workflows/ci.yml`.

    TEXT, not YAML: the harness declares no third-party package (CI's own
    `record` job asserts it), so this reads the two-space job headers and the
    deeper-indented lines under them rather than importing a parser.
    """
    path = os.path.join(HERE, "..", "..", ".github", "workflows", "ci.yml")
    lines = open(path, encoding="utf-8").read().splitlines()
    jobs, name, buf, in_jobs = {}, None, [], False
    for ln in lines:
        if ln == "jobs:":
            in_jobs = True
            continue
        if not in_jobs:
            continue
        m = re.match(r"^  ([a-z][a-z0-9-]*):\s*$", ln)
        if m:
            if name:
                jobs[name] = "\n".join(buf)
            name, buf = m.group(1), []
        elif name is not None:
            buf.append(ln)
    if name:
        jobs[name] = "\n".join(buf)
    return jobs


def test_each_ci_event_owns_completed_evidence():
    print("\n6. every CI event owns completed evidence; push/PR twins "
          "cannot cancel the only run doing work (BCI-07)")
    # THE TWO DEFECTS THIS PINS, both 2026-09-06, both counted over the last
    # 30 pushes to one branch.
    #
    # M-250, THE TWIN. A push to a branch with an open PR starts two runs and
    # the concurrency group cancels one within seconds, by design; 17 of those
    # 30 ended `cancelled`. That left ~15 CANCELLED check runs on the PR's
    # head, so a PR whose real run was entirely green read "some checks were
    # not successful" and sat at mergeable_state `unstable` -- twice in one
    # day, PR #236 and PR #237, each cleared only by re-running the twin BY
    # HAND.
    #
    # M-251, THE MERGE MIRROR. Restarting the branch from the default branch
    # after a merge pushes the merge commit itself back onto the branch; that
    # run and the default branch's own run share a sha but not a concurrency
    # group, so BOTH do the full matrix on one tree. It fired on all five
    # merges in that window and finished twice over in three of them
    # (a247c11a: run 34038632516 on main, run 34038762057 on the branch, ~20
    # min and ~44 jobs each). The first question cannot see it -- the PR has
    # just closed -- so there is a second question.
    path = os.path.join(HERE, "..", "..", ".github", "workflows", "ci.yml")
    ci = open(path, encoding="utf-8").read()
    check("the workflow may ASK whether a PR covers this commit "
          "(`pull-requests: read`)", "pull-requests: read" in ci)
    # Question 2 reads workflow RUNS, which is a different scope. Without it
    # the endpoint answers 403, deny-by-default keeps the duplicate, and the
    # fix is decorative -- so the permission is pinned, not assumed.
    check("and whether the default branch already ran it (`actions: read`)",
          "actions: read" in ci)
    jobs = _ci_jobs()
    check("`dup` publishes the answer as an output every job can read",
          "already_covered:" in jobs.get("dup", ""), sorted(jobs))
    # THE ANSWER HAS ITS OWN JOB, and that is M-252's whole point: a job's
    # outputs land when the JOB ends, `gate` measured 57 s, and the
    # concurrency cancellation arrived at 4 s and 40 s on the two twins. So
    # `dup` carries no checkout and no toolchain -- if it grows one it stops
    # beating the cancel and the guard goes back to being decorative.
    dup = jobs.get("dup", "")
    check("`dup` answers before anything else: it needs nothing",
          re.search(r"^    needs:", dup, re.M) is None)
    check("and it stays fast: no checkout, no setup-node, no npm",
          not any(k in dup for k in ("actions/checkout", "setup-node", "npm ")))
    # DERIVED, never a list: a job added tomorrow without the guard fails here.
    GUARD = "needs.dup.outputs.already_covered != 'true'"
    def guarded(txt):
        return GUARD in txt
    def needs_dup(txt):
        return re.search(r"^    needs: (dup\b|\[dup\b)", txt, re.M) is not None
    downstream = sorted(n for n, t in jobs.items() if needs_dup(t))
    check("`gate` is not exempt from the answer it used to publish",
          guarded(jobs.get("gate", "")))
    check("every job that runs off `dup` carries the guard",
          downstream and all(guarded(jobs[n]) for n in downstream),
          f"{len(downstream)} downstream: "
          + ", ".join(n for n in downstream if not guarded(jobs[n])) or "all guarded")
    # The jobs that do NOT need the guard must be unable to run on a push at
    # all -- otherwise "no guard" is an omission wearing an exemption's coat.
    for n, t in sorted(jobs.items()):
        if n == "dup" or needs_dup(t):
            continue
        check(f"{n} needs no guard because it cannot run on a push",
              "workflow_dispatch" in t and "schedule" in t)
    # ~~2026-09-08 BCI-07: the earlier open-PR/green-push inference was
    # unsafe: event ordering could leave only the run that skipped its work.
    # Every event now owns its evidence, and event-specific concurrency keeps
    # the push and PR runs from cancelling one another. Exercise the real
    # output command; a PR's existence cannot stand in for completed checks.~~
    #
    # STRUCK 2026-09-16 (doctrine 17) AND KEPT. THE BASIS IS THE OWNER'S
    # RULING of that date, given on a pull-request list carrying a red X on
    # every open PR, verbatim: "land the dup fix". MISSING.md had reserved
    # this call for them in as many words -- "whether the pull-request run
    # should be the only run on such a branch is the owner's call" -- and
    # they made it. The argument beneath the ruling is that the reasoning
    # struck above is right and its premise stopped being true IN THE SAME
    # COMMIT. BCI-07's hazard needs the push and PR runs to be able to
    # cancel one another; a75da39f put `github.event_name` into the
    # concurrency group key, so they cannot.
    # MEASURED 2026-09-16 on `1f6e987c`: push run 35068060877 (35 jobs) and
    # pull_request run 35068064645 (39 jobs) BOTH ran to completion on the one
    # sha, and the PR run's job-name set is a strict superset of the push
    # run's. The struck paragraph's own last clause is the proof: "event-
    # specific concurrency keeps the push and PR runs from cancelling one
    # another" is exactly the condition under which deferring is safe.
    #
    # WHAT THIS SECTION NOW PINS, and it is a different claim from the one it
    # replaced. Not "no lookup happens" -- that pinned the STUB, and a stub is
    # what M-250/M-251/M-252 spent three entries proving was not a fix -- but
    # THE SHAPE OF THE ANSWER: exactly one question, about pull requests;
    # deny-by-default on every other path. The transport is stubbed (`gh` on
    # PATH) and the FILTER is run for real when `jq` is installed, which is
    # the same division M-250 used. `jq`'s absence is reported, never skipped
    # (doctrine 20: cannot run is not pass).
    import subprocess
    import tempfile

    body = re.search(r"^        run: \|\n((?:(?: {10}.*)?\n)+)", dup, re.M)
    check("coverage is produced by an explicit local command", body is not None)
    script = ""
    if body is not None:
        script = "\n".join(l[10:] for l in body.group(1).splitlines())

    # ~~ONE QUESTION, AND IT IS THE PULL-REQUEST ONE. Pinned on the endpoint
    # and on both halves of the filter: an ancestor commit of an open PR is
    # NOT its head, and a closed PR is not an open one.~~
    #
    # STRUCK 2026-09-19 (M-301, doctrine 17) AND THE STRIKE IS THE FINDING.
    # That question was asked TWELVE SECONDS BEFORE THE FACT IT ASKS ABOUT
    # BECOMES TRUE, so it answered `false` on every branch push this
    # repository has made since M-250 shipped. MEASURED on run 2256
    # (`ed089796`): `dup` completed at 14:33:52 with `no OPEN pull request has
    # this commit at its head`, PR #358 was created at 14:33:58 with that very
    # sha at its head, and the push run went on to run 37 jobs to success over
    # 17 minutes beside the pull_request run doing the same work. Doctrine 48
    # in its purest form: the mechanism was real, reachable, correct, and
    # unable to fire, and a guard that cannot fire reads exactly like a guard
    # that is working. The owner's instruction was "fix that too for me
    # please", on the duplicate they had just been shown.
    #
    # WHAT IS PINNED NOW, and it is three claims rather than one. (a) The
    # subject is THE BRANCH, not the commit — an open pull request whose head
    # REF is this branch is sent a `synchronize` for this push, which is true
    # the moment the pull request exists, where its head SHA lags. (b) There
    # is a SECOND question, the merge mirror, answered from the default
    # branch's REF and not from its workflow runs, because a sha is a fact and
    # a run's conclusion is an inference about jobs that may all have skipped
    # — which is why `actions:` is still absent from this script. (c) The wait
    # is REAL: §6 drives the loop with a stub that answers late and requires
    # the script to come back and find it.
    check("`dup` asks the pull-request question, by endpoint",
          "/pulls?state=open" in script)
    check("...about THIS BRANCH, whose ref is true the moment the pull "
          "request exists, and not about the head SHA, which lags the push",
          ".head.ref == $ENV.BRANCH" in script
          and ".head.sha == $ENV.GITHUB_SHA" not in script)
    check("...and only a pull request on THIS repository: a fork's branch may "
          "carry the same name and is a different pull request",
          ".head.repo.full_name == $ENV.GITHUB_REPOSITORY" in script)
    check("`dup` asks the merge-mirror question from the default branch's REF",
          "git/ref/heads/$DEFAULT_BRANCH" in script)
    check("...and asks nothing else: no workflow-runs question (M-251 is "
          "answered from a sha, not from a run that can conclude success "
          "having skipped every job)",
          "workflow_runs" not in script and "/actions/" not in script)
    # THE TWO WAITS ARE DECLARED COORDINATES, not literals buried in the
    # script: a wait nobody wrote down is a threshold nobody wrote down
    # (doctrine 58), and this section could not ask the question without
    # paying 90 s a case if they were not settable.
    check("the deadline and the interval are declared in the step's `env:`",
          "WAIT_SECONDS:" in dup and "POLL_SECONDS:" in dup)

    def answer(stub, event="push", branch="fix/x", default="trunk",
               wait="0", poll="1"):
        """-> (rc, GITHUB_OUTPUT lines) for the real script over a stubbed `gh`.

        The fixture's default branch is NOT called `main`, on purpose and
        twice over. It proves the script COMPARES `$BRANCH` with
        `$DEFAULT_BRANCH` rather than matching a hard-coded name -- and a bare
        `"main"` string constant in this file would make `shard.main`
        REFUSED (dynamic) in `quality/counters.py`'s reach analysis, moving a
        counter this change has no business moving.
        """
        with tempfile.TemporaryDirectory() as temporary:
            bindir = os.path.join(temporary, "bin")
            os.makedirs(bindir)
            fake = os.path.join(bindir, "gh")
            io.open(fake, "w", encoding="utf-8").write(stub)
            os.chmod(fake, 0o755)
            output = os.path.join(temporary, "output")
            io.open(output, "w", encoding="utf-8").write("")
            run = subprocess.run(
                ["bash", "-e", "-c", script],
                env={"PATH": bindir + os.pathsep + os.environ.get("PATH", ""),
                     "GITHUB_OUTPUT": output, "GH_TOKEN": "t",
                     "GITHUB_REPOSITORY": "o/r", "GITHUB_SHA": "a" * 40,
                     "EVENT_NAME": event, "BRANCH": branch,
                     "DEFAULT_BRANCH": default,
                     # A DEADLINE OF ZERO ASKS ONCE. The cases below are about
                     # the ANSWER, and paying the production wait for each of
                     # them would put ~20 minutes into a 0.5 s section; the
                     # wait itself is asked for separately, below, where it is
                     # the subject rather than the overhead.
                     "WAIT_SECONDS": wait, "POLL_SECONDS": poll},
                capture_output=True, text=True, timeout=180)
            got = [l for l in io.open(output, encoding="utf-8").read().splitlines() if l]
            return run.returncode, got

    def says(stub, want, **kw):
        rc, got = answer(stub, **kw)
        # THE EXIT CODE IS PART OF THE ANSWER. `dup` is the root of the graph;
        # a non-zero exit here fails every job that `needs:` it, which is
        # deny-by-default inverted -- an unanswerable question would STOP CI.
        return rc == 0 and got == ["already_covered=%s" % want]

    def const(text, rc=0):
        return "#!/bin/bash\nprintf '%%s\\n' %r\nexit %d\n" % (text, rc)

    if script:
        SELF = "a" * 40  # the fixture's own GITHUB_SHA, set in `answer()`
        # TWO CASES SAY YES, ONE PER QUESTION.
        check("an OPEN pull request whose head REF is this branch -> true",
              says(const("1"), "true"))
        check("this sha IS the default branch's head -> true (merge mirror)",
              says(const(SELF), "true"))
        # AND EVERY OTHER PATH SAYS RUN IT. This is the 2026-08-14 lesson --
        # six commits with no CI at all -- held as a property of the script.
        for name, stub, kw in [
            ("no open pull request on this branch", const("0"), {}),
            ("the default branch's head is a DIFFERENT sha", const("b" * 40), {}),
            ("HTTP 403 (the permission is missing)", const("", 1), {}),
            ("the network failed (rc 7)", const("", 7), {}),
            ("`gh` is not installed (rc 127)", "#!/bin/bash\nexit 127\n", {}),
            ("the body does not parse as a count", const("<html>502</html>"), {}),
            ("the body is empty", const(""), {}),
            ("the event is a pull_request", const("1"), {"event": "pull_request"}),
            ("the event is a workflow_dispatch", const("1"), {"event": "workflow_dispatch"}),
            ("the event is a schedule", const("1"), {"event": "schedule"}),
            ("the push is to the default branch", const("1"), {"branch": "trunk"}),
        ]:
            check("deny-by-default: %s -> false" % name, says(stub, "false", **kw))

        # THE FILTER ITSELF, run for real. The four cases that separate a head
        # from an ancestor and an open PR from a closed one cannot be asked of
        # a stub that returns a number someone else computed.
        have_jq = subprocess.run(["bash", "-c", "command -v jq"],
                                 capture_output=True).returncode == 0
        check("`jq` is REACHABLE, so the filter cases below are ASKED rather "
              "than skipped (`apt-get install jq`)", have_jq,
              "jq present" if have_jq else "jq missing")
        if have_jq:
            def over(rows, ref=None):
                """A `gh` that answers the REF question and the PULLS question
                separately -- which a single-answer stub cannot do now that
                there are two, and conflating them is how a stub starts
                proving something about itself instead of about the script.
                """
                fd, path = tempfile.mkstemp(suffix=".json")
                with io.open(fd, "w", encoding="utf-8") as fh:
                    fh.write(rows)
                return ('#!/bin/bash\nf=""\np=""\nfor a in "$@"; do\n'
                        '  if [ "$p" = "--jq" ]; then f="$a"; fi\n  p="$a"\n'
                        'done\ncase "$*" in\n'
                        '  *git/ref*) printf \'%%s\\n\' %r ;;\n'
                        '  *) jq "$f" < %s ;;\nesac\n'
                        % (ref or "b" * 40, path))
            MINE = '{"full_name":"o/r"}'
            FORK = '{"full_name":"fork/r"}'
            check("REAL jq: an open PR whose head REF is this branch -> true",
                  says(over('[{"head":{"ref":"fix/x","repo":%s}}]' % MINE), "true"))
            check("REAL jq: an open PR on ANOTHER branch -> false",
                  says(over('[{"head":{"ref":"other","repo":%s}}]' % MINE), "false"))
            # The same branch NAME on a fork is a different pull request, and
            # the push that started this run did not move its head.
            check("REAL jq: the same branch name on a FORK -> false",
                  says(over('[{"head":{"ref":"fix/x","repo":%s}}]' % FORK), "false"))
            check("REAL jq: no open pull request at all -> false",
                  says(over("[]"), "false"))
            check("REAL jq: the ref question alone can say yes",
                  says(over("[]", ref=SELF), "true"))

        # THE WAIT IS THE REPAIR, SO THE WAIT IS ASKED FOR. A deadline of zero
        # answers every case above; none of them can tell a script that polls
        # from a script that asks once and gives up, which is exactly the
        # difference between this job working and M-250's three entries.
        def late():
            """A `gh` answering the PULLS question 0, 0, then 1 -- a pull
            request opened two polls after the push, which is the shape
            MEASURED on every pull request this repository has opened. The
            tally file is written INTO the stub rather than passed through the
            environment, because `answer()` hands the script an explicit env
            and a variable it does not name would silently make this a stub
            that answers 0 forever -- a check that cannot fail.
            """
            fd, path = tempfile.mkstemp(suffix=".n")
            os.close(fd)
            os.remove(path)
            return ('#!/bin/bash\n'
                    'case "$*" in *git/ref*) echo ref ; exit 0 ;; esac\n'
                    'n=$(cat %s 2>/dev/null || echo 0)\n'
                    'n=$((n + 1)); echo "$n" > %s\n'
                    'if [ "$n" -le 2 ]; then echo 0; else echo 1; fi\n'
                    % (path, path))
        check("a pull request that appears AFTER the push is found: two 0s "
              "then a 1, inside the deadline -> true",
              says(late(), "true", wait="6", poll="1"))
        check("...and the deadline is a deadline: the same stub with no room "
              "to reach the 1 -> false (deny-by-default)",
              says(late(), "false", wait="1", poll="1"))
        # AN INTERVAL OF ZERO IS AN INFINITE LOOP unless the script refuses
        # it, and an infinite loop here fails every job in the file -- which
        # is deny-by-default inverted in the most expensive possible way.
        check("a zero interval falls back to the declared one and TERMINATES",
              says(const("0"), "false", wait="2", poll="0"))
        # ASKED WITH A STUB THAT SAYS YES AT ONCE, on purpose: the claim is
        # that a non-numeric deadline is CAUGHT rather than compared -- under
        # `bash -e` an uncaught `[ "" -ge 0 ]` exits 2, which fails `dup` and
        # with it every job in the file. Asking it with a `no` would pay the
        # fallback's own 90 s to learn nothing the case above has not shown.
        check("a deadline that is not a number does not abort the script",
              says(const("1"), "true", wait="", poll="1"))

        # THE CHECK CAN FAIL, and the two planted defects are the two ways
        # this job has actually been wrong: a stub that never asks (BCI-07's,
        # which this section used to REQUIRE), and an answer that starts at
        # `true` so an unanswered question reads as a yes (the inversion of
        # deny-by-default, which is the six-uncovered-commits defect).
        real = script
        try:
            script = "echo 'already_covered=false' >> \"$GITHUB_OUTPUT\""
            check("PLANTED: the stub that never asks IS caught",
                  not says(const("1"), "true"))
            script = real.replace("covered=false", "covered=true", 1)
            check("PLANTED: deny-by-default inverted IS caught",
                  not says(const("", 1), "false"))
        finally:
            script = real
    check("push and PR concurrency groups include the event coordinate",
          "format('{0}@{1}@{2}'," in ci and
          "github.ref_name, github.event_name)" in ci)
    check("production runs are never cancelled by a newer run",
          "cancel-in-progress: ${{ (github.head_ref || github.ref_name) != 'main' }}" in ci)
    # THE CHECK CAN FAIL: strip one job's guard and the sweep must catch it.
    victim = downstream[0]
    planted = dict(jobs)
    planted[victim] = planted[victim].replace(GUARD, "true")
    check("PLANTED: a downstream job whose guard was dropped IS caught",
          not all(guarded(planted[n]) for n in downstream), victim)


CACHE_STEP = re.compile(r"uses:\s*actions/cache(/restore|/save)?@")
FIELD = re.compile(r"^(path|key|restore-keys):\s*(.*)$")


def _cache_steps():
    """-> [(workflow, kind, paths, key, restore_keys)] over `.github/workflows`.

    TEXT, not YAML, for the reason `_ci_jobs` gives one section up: the harness
    declares no third-party package and `yaml` is not in the standard library.

    `kind` is "restore", "save", or "both" for the combined `actions/cache@v4`,
    which is a producer AND a consumer in one step.
    """
    steps = []
    root = os.path.join(HERE, "..", "..", ".github", "workflows")
    for name in sorted(os.listdir(root)):
        if not name.endswith((".yml", ".yaml")):
            continue
        lines = open(os.path.join(root, name), encoding="utf-8").read().splitlines()
        for i, ln in enumerate(lines):
            m = CACHE_STEP.search(ln)
            if not m:
                continue
            kind = (m.group(1) or "/both")[1:]
            indent = len(ln) - len(ln.lstrip())
            paths, key, restore, field = [], None, [], None
            for nxt in lines[i + 1:]:
                if not nxt.strip():
                    continue
                if len(nxt) - len(nxt.lstrip()) < indent or nxt.lstrip().startswith("- "):
                    break
                body = nxt.strip()
                if body.startswith("#"):
                    continue
                got = FIELD.match(body)
                if got:
                    field, rest = got.group(1), got.group(2).strip()
                    if rest in ("", "|", ">"):
                        continue
                    if field == "path":
                        paths.append(rest)
                    elif field == "key":
                        key = rest
                    else:
                        restore.append(rest)
                    field = None
                elif field == "path":
                    paths.append(body)
                elif field == "restore-keys":
                    restore.append(body)
                elif re.match(r"^[a-z][a-z-]*:", body):
                    field = None
            steps.append((name, kind, tuple(paths), key, tuple(restore)))
    return steps


def _unreachable(steps):
    """-> [(consumer, prefix, its paths, producer, its key, its paths)].

    A restore-key names a producer it cannot reach whenever the two steps'
    `path:` LISTS differ.  Pure, so the planted case below can be built by
    editing a parsed list rather than by writing a workflow file.
    """
    savers = [(f, p, k) for (f, kind, p, k, _r) in steps if kind in ("save", "both")]
    out = []
    for consumer, kind, paths, key, restore in steps:
        if kind not in ("restore", "both"):
            continue
        for prefix in restore:
            for producer, spaths, skey in savers:
                if not skey or not skey.startswith(prefix):
                    continue
                if (producer, spaths, skey) == (consumer, paths, key):
                    continue  # the combined step is its own producer
                if spaths != paths:
                    out.append((consumer, prefix, paths, producer, skey, spaths))
    return out


def test_every_cache_restore_key_can_reach_its_producer():
    print("\n7. every cache restore-key prefix names a producer whose `path:` "
          "list is byte-identical, so the entry it names is reachable (M-264)")
    # WHAT THIS PINS, AND WHY A KEY IS NOT AN ADDRESS. `actions/cache` does not
    # look an entry up by its key alone. It computes
    # `version = sha256(paths.join('|') + '|' + compressionMethod + '|1.0')`
    # and sends that ONE version alongside the primary key AND every
    # restore-key -- on the v1 REST path (`cache?keys=...&version=...`) and the
    # v2 twirp path alike -- and there is no version-relaxed fallback. The
    # strings hashed are the RAW `path:` lines: `resolvePaths()` output feeds
    # only `createTar`. So a two-line `path:` is a different version from a
    # one-line `path:` naming the same directory, and a restore-key that names
    # a real, freshly written entry returns NOTHING.
    #
    # THE RUN THAT PAID FOR THIS. ci.yml's nightly banks the predictability
    # memo under `path: ~/.cache/lyric-harness`; production-qualification.yml
    # restored under a TWO-line list and named `lyric-harness-predictability-v1-`
    # as a fallback. Nightly run 34413319893 banked 172,949 bytes at 01:32:47Z.
    # Three hours later qualification run 34436960370 logged `Cache not found
    # for input keys: ..., lyric-harness-predictability-v1-`, reported
    # `predictability memo: 0 line(s)`, and burned its whole 2,400 s budget on
    # a cold memo for exit 124. The comment above that restore had claimed the
    # prefix fixed it; the prefix was never the part that was broken.
    #
    # THIS IS STRING EQUALITY OF THE LIST, NOT PATH EQUIVALENCE. `$HOME/.cache`
    # for `~/.cache`, a trailing slash, or the same two entries in the other
    # order would each still miss, and each would read as a fix.
    steps = _cache_steps()
    check("the sweep found the cache steps to check at all",
          len(steps) >= 8 and any(k == "save" for _f, k, _p, _k, _r in steps),
          f"{len(steps)} step(s): " + ", ".join(sorted({f for f, *_ in steps})))
    bad = _unreachable(steps)
    check("every named producer is reachable from the step that names it",
          not bad,
          "; ".join(f"{c} wants {pre!r} from {prod}: {list(cp)} != {list(pp)}"
                    for c, pre, cp, prod, _sk, pp in bad))
    # THE CHECK CAN FAIL, and the planted defect is the exact one that shipped:
    # add a second path to a consumer and leave the prefix alone.
    planted = []
    for entry in steps:
        name, kind, paths, key, restore = entry
        if kind == "restore" and any(r.startswith("lyric-harness-") for r in restore):
            entry = (name, kind, paths + ("/tmp/mutate-scratch/baseline.json",), key, restore)
        planted.append(entry)
    check("PLANTED: a consumer that grows a second `path:` entry IS caught",
          bool(_unreachable(planted)) and planted != steps)


RESULT_JOB = re.compile(r"^  ([a-z][a-z0-9-]*-result):\s*$")


def _result_gates(text=None):
    """-> `{job name: its `if:` line}` for every `*-result` job in ci.yml.

    TEXT again, and `text=` so the planted case below can be built by editing
    the file's STRING rather than the file.
    """
    if text is None:
        path = os.path.join(HERE, "..", "..", ".github", "workflows", "ci.yml")
        text = open(path, encoding="utf-8").read()
    gates, name = {}, None
    for ln in text.splitlines():
        got = RESULT_JOB.match(ln)
        if got:
            name = got.group(1)
            gates[name] = None
            continue
        if name is None:
            continue
        if ln and not ln.startswith("    "):
            name = None
            continue
        body = ln.strip()
        if body.startswith("if:") and gates.get(name) is None:
            gates[name] = body
    return gates


def test_no_result_gate_calls_a_cancelled_run_a_failure():
    print("\n8. every `*-result` fan-in gates on `!cancelled()`, so a run "
          "somebody superseded is not reported as a defect")
    # WHAT THIS PINS. `always()` INCLUDES THE CANCELLED STATE. A push to a
    # branch with an open PR starts two runs and the concurrency group cancels
    # one; a second push cancels the first. Either way `gate` is cancelled,
    # every job that `needs:` it is SKIPPED, and an `always()` fan-in then runs
    # anyway, reads `skipped`, and paints a RED X on a run that measured
    # nothing. ci.yml's `catalog-result` block carries the original argument
    # and the run that paid for it (#426, `c806457`, red seven seconds in).
    #
    # IT WAS FIXED ON 2026-08-16 AND ONE JOB WAS MISSED, WHICH IS WHY THIS IS A
    # CHECK AND NOT A PARAGRAPH. `capacity-proof-result` kept `always()` for
    # over three weeks, and it took runs 34442739821 and 34442779448 — both at
    # `51de1726`, both cancelled at 05:58:15Z by the next push — to say so.
    # Six jobs agreeing and a seventh not is exactly the shape a reader skims
    # past (doctrine 48).
    #
    # `!cancelled()` AND NOT A NEW ARM, because the gate must not move: a
    # FAILED proof still reports `failure` and a SKIPPED one still reports
    # `skipped`, and both still fail `test "$RESULT" = success`. Only the
    # cancelled case leaves.
    gates = _result_gates()
    check("the sweep found the fan-in jobs to check at all",
          len(gates) >= 6, ", ".join(sorted(gates)))
    missing = sorted(n for n, cond in gates.items() if not cond)
    check("every `*-result` job carries an `if:` at all", not missing, str(missing))
    bad = sorted(n for n, cond in gates.items()
                 if cond and "!cancelled()" not in cond)
    check("and none of them gates on `always()`, which includes cancelled",
          not bad,
          "; ".join(f"{n}: {gates[n]}" for n in bad))
    # THE CHECK CAN FAIL, and the planted defect is the one that shipped:
    # a single job put back on `always()`.
    path = os.path.join(HERE, "..", "..", ".github", "workflows", "ci.yml")
    planted = open(path, encoding="utf-8").read().replace(
        "if: ${{ !cancelled() && needs.dup.outputs.already_covered != 'true' }}",
        "if: always() && needs.dup.outputs.already_covered != 'true'", 1)
    check("PLANTED: one job put back on `always()` IS caught",
          any("!cancelled()" not in (c or "")
              for c in _result_gates(planted).values()))


def test_the_two_qualification_tables_cannot_drift_apart():
    print("\n9. the Python and JavaScript qualification tables agree, "
          "component for component and argument for argument")
    # WHY THERE ARE TWO, AND WHY THAT IS NOT THE DEFECT. `scripts/
    # verify_qualification.mjs` keeps its OWN copy of the component list and
    # of what each component should have run, and re-derives it rather than
    # trusting the receipt's word. That is a deliberate cross-check on the
    # deploy path: a receipt that claims a reduced command is caught by an
    # implementation that never read it.
    #
    # WHAT IS THE DEFECT IS THAT NOTHING COMPARED THEM. Change the shard count
    # in one file and the other keeps the old table; the qualification then
    # runs, passes, uploads, and `validateQualification` rejects it at DEPLOY
    # time -- after four hours of runners, on the one path where a late no is
    # most expensive. Found 2026-09-10 while moving the count 4 -> 8 (M-266),
    # which is exactly the edit that would have caused it.
    #
    # READ FROM BOTH, RESTATED IN NEITHER (doctrine 1): this executes each side
    # and compares, so it cannot go stale against a table it is describing.
    import json
    import subprocess
    root = os.path.join(HERE, "..", "..")
    scripts = os.path.join(root, "scripts")
    sys.path.insert(0, scripts)
    for name in ("production_qualification",):
        sys.modules.pop(name, None)
    import production_qualification as PQ
    py = {"components": list(PQ.COMPONENTS),
          "spec": {c: PQ.spec(c)[0] for c in PQ.COMPONENTS}}
    node = subprocess.run(
        ["node", "--input-type=module", "-e",
         "import {COMPONENTS, expectedCommand} from "
         "'./scripts/verify_qualification.mjs';"
         "console.log(JSON.stringify({components: COMPONENTS,"
         " spec: Object.fromEntries(COMPONENTS.map(c => [c, expectedCommand(c)]))}))"],
        cwd=root, text=True, capture_output=True)
    check("the JavaScript table can be read at all "
          "(it must export COMPONENTS and expectedCommand)",
          node.returncode == 0, (node.stderr or "").strip()[:300])
    if node.returncode != 0:
        return
    js = json.loads(node.stdout)
    check("both sides list the same components, in the same order",
          py["components"] == js["components"],
          f"py {py['components']} vs js {js['components']}")
    differing = sorted(c for c in py["components"]
                       if py["spec"].get(c) != js["spec"].get(c))
    check("and both derive the same command for every one of them",
          not differing,
          "; ".join(f"{c}: py {py['spec'][c]} vs js {js['spec'].get(c)}"
                    for c in differing))
    # AND THE THIRD COPY IS THE WORKFLOW MATRIX, which is where the count is
    # actually spelled out by hand. A matrix short of a component simply never
    # runs it, and `aggregate` then refuses the whole run for a missing
    # receipt -- four hours to learn that a list was edited in two places out
    # of three.
    path = os.path.join(root, ".github", "workflows",
                        "production-qualification.yml")
    matrix = re.search(r"^\s*component:\s*\[([^\]]*)\]\s*$",
                       open(path, encoding="utf-8").read(), re.M)
    check("the workflow declares its component matrix where this can read it",
          matrix is not None)
    if matrix:
        listed = [x.strip() for x in matrix.group(1).split(",") if x.strip()]
        check("and the matrix is exactly the components the table declares",
              listed == py["components"],
              f"matrix {listed} vs table {py['components']}")
    # THE CHECK CAN FAIL, and the planted defect is the one this entry was
    # written during: a shard count moved on one side only.
    planted = dict(js, components=js["components"][:-1])
    check("PLANTED: a table that lost a component IS caught",
          py["components"] != planted["components"])


CRON = re.compile(r"^\s*-\s*cron:\s*'([^']+)'\s*$", re.M)


def _minute_of_day(expr, where):
    """-> minutes past midnight UTC for a `minute hour ...` cron, or None.

    TEXT, not YAML, for the reason `_ci_jobs` gives two sections up: the
    harness declares no third-party package and `yaml` is not in the standard
    library.
    """
    parts = expr.split()
    if len(parts) != 5 or not parts[0].isdigit() or not parts[1].isdigit():
        check(f"{where}'s cron is a plain minute-and-hour schedule "
              f"this can compare", False, expr)
        return None
    return int(parts[1]) * 60 + int(parts[0])


def _gap(qual_min, back_min):
    """-> minutes from the qualification's cron to the backstop's, modulo a day."""
    return (back_min - qual_min) % (24 * 60)


def _same_night(gap):
    """-> True when the backstop follows the qualification within one night."""
    return 0 < gap <= 12 * 60


def _reaches(lookback_hours, gap):
    """-> True when the lookback window reaches back past the primary's cron."""
    return lookback_hours * 60 >= gap


def test_the_backstop_can_still_reach_what_it_backs_up():
    print("\n10. the qualification backstop fires after the qualification, "
          "names a workflow that exists, and looks back far enough to see it")
    # WHY THIS FILE HAS A GUARD AT ALL. `qualification-backstop.yml` exists
    # because on 2026-09-17 GitHub dropped the 01:23 schedule outright -- the
    # cron was intact on main, no commit had touched it, and the workflow had
    # no `schedule`-event run at all. The backstop asks one question an hour
    # and a half later: did a qualification start tonight? If not, it
    # dispatches one.
    #
    # AND WHY THE GUARD IS NOT OPTIONAL: EVERY WAY THIS BREAKS IS SILENT. The
    # backstop stands down by DOING NOTHING and reporting success, so all
    # three drifts below produce a green check on a night with no
    # qualification -- or a duplicate every night -- and neither shows up
    # anywhere until somebody asks why the connector stopped tracking main.
    root = os.path.join(HERE, "..", "..")
    wf = os.path.join(root, ".github", "workflows")
    back = io.open(os.path.join(wf, "qualification-backstop.yml"),
                   encoding="utf-8").read()

    # (1) IT MUST NAME A WORKFLOW THAT EXISTS. `TARGET:` is a bare filename in
    # an env block; nothing resolves it until the dispatch is attempted, and a
    # dispatch against a missing workflow is a 404 at 02:47 with no reader.
    target = re.search(r"^\s*TARGET:\s*(\S+)\s*$", back, re.M)
    check("the backstop declares the workflow it dispatches", target is not None)
    if not target:
        return
    named = target.group(1)
    check("and that workflow is a file in .github/workflows",
          os.path.isfile(os.path.join(wf, named)), named)

    # (2) IT MUST FIRE AFTER THE RUN IT IS BACKING UP. Reversed, the backstop
    # asks its question BEFORE the primary was due, finds nothing every single
    # night, and dispatches a duplicate every single night -- the failure that
    # looks like the feature working.
    qual = io.open(os.path.join(wf, named), encoding="utf-8").read()
    q_crons = CRON.findall(qual)
    b_crons = CRON.findall(back)
    check("both workflows carry exactly one cron this can compare",
          len(q_crons) == 1 and len(b_crons) == 1, f"{q_crons} vs {b_crons}")
    if len(q_crons) != 1 or len(b_crons) != 1:
        return
    q_min = _minute_of_day(q_crons[0], named)
    b_min = _minute_of_day(b_crons[0], "the backstop")
    if q_min is None or b_min is None:
        return
    gap = _gap(q_min, b_min)
    # `_gap` IS MODULAR, AND THAT IS WHY THE BOUND IS HERE. A backstop 30
    # minutes BEFORE the qualification does not read as a negative gap -- it
    # reads as 1410 minutes, which any bare `> 0` test waves through. The
    # window is what makes "before" fail: the backstop covers THIS night, so a
    # gap that has wrapped most of the way round the clock is the reversed
    # order, not a late one.
    check("the backstop fires after the qualification and on the same night",
          _same_night(gap), f"{q_crons[0]} vs {b_crons[0]} -> {gap} min")

    # (3) NEITHER FIRES AT :00. ci.yml states the rule: GitHub queues cron runs
    # globally and the top of the hour is the most contended minute there is.
    # A backstop delayed by that contention is self-defeating.
    check("neither cron sits on the contended top of the hour",
          q_min % 60 != 0 and b_min % 60 != 0, f"{q_crons[0]} vs {b_crons[0]}")

    # (4) THE LOOKBACK MUST REACH BACK PAST THE PRIMARY. This is the subtle
    # one. The backstop counts qualifications started within LOOKBACK_HOURS; if
    # that window is shorter than the gap between the two crons, a primary that
    # ran perfectly is invisible to it and it dispatches a second one anyway.
    look = re.search(r"^\s*LOOKBACK_HOURS:.*?\|\|\s*'(\d+)'", back, re.M)
    check("the backstop declares a default lookback", look is not None)
    if not look:
        return
    check("and the lookback window reaches back past the qualification's cron",
          _reaches(int(look.group(1)), gap),
          f"lookback {look.group(1)}h vs a {gap}-minute gap")

    # (5) WITHOUT `actions: write` EVERY DISPATCH IS A 403. The job reports
    # that one loudly rather than silently -- it is one of the two failures
    # this workflow is allowed to go red for -- but a guard that catches it
    # here catches it before a night is lost rather than after.
    check("the backstop holds the one permission a dispatch requires",
          re.search(r"^\s*actions:\s*write\s*$", back, re.M) is not None)

    # THE CHECKS CAN FAIL, and each planted defect runs THE SAME PREDICATE the
    # live check above ran, over a mutated value -- the shape section 9 uses.
    # A planted case that asserts something about a name nobody used would
    # prove only that the name was unused.
    check("PLANTED: the target test applied to a renamed workflow refuses",
          not os.path.isfile(os.path.join(wf, named[:-4] + "-renamed.yml")),
          named[:-4] + "-renamed.yml")
    check("PLANTED: a backstop 30 minutes BEFORE the qualification IS caught",
          not _same_night(_gap(q_min, q_min - 30)),
          f"gap would read {_gap(q_min, q_min - 30)} min")
    check("PLANTED: a lookback too short to see the primary IS caught",
          not _reaches(1, gap), f"1h vs a {gap}-minute gap")


def test_panel_sections_keep_the_pool_inventory_and_failure_gate():
    """Execute CI's actual pool shell with cheap, observable child processes."""
    import ast
    import collections
    import subprocess
    import tempfile
    import textwrap
    print("\n11. M-244 panel sections partition inside the existing pool, failures still gate")
    job = _ci_jobs()["suites"]
    bodies = re.findall(r"^        run: \|\n((?:(?: {10}.*)?\n)+)", job, re.M)
    script = next(textwrap.dedent(b) for b in bodies if "for f in relations_null " in b)
    names = re.search(r"for f in (.*?); do", script, re.S).group(1).replace("\\", "").split()
    env_value = re.search(r"TEST_RELATIONS_NULL_SHARD: (.*)", job).group(1)
    n = int(env_value.rsplit("/", 1)[1])
    check("panel coordinate uses this matrix's shard", "${{ matrix.shard }}" in env_value)
    panel_tree = ast.parse(open(os.path.join(HERE, "test_relations_null.py"), encoding="utf-8").read())
    declared = {node.name for node in panel_tree.body if isinstance(node, ast.FunctionDef)
                and re.match(r"s\d+_", node.name)}
    assignment = next(node for node in panel_tree.body if isinstance(node, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == "_SECTIONS" for t in node.targets))
    sections = [x.id for x in assignment.value.elts]
    check("every panel section is declared once", len(sections) == len(declared)
          and set(sections) == declared)
    seen, section_seen = [], []
    with tempfile.TemporaryDirectory(prefix="m244-pool-") as tmp:
        stub = os.path.join(tmp, "python3")
        with open(stub, "w", encoding="utf-8") as f:
            f.write('#!/bin/sh\nprintf "CALLED %s\\n" "$1"\n'
                    '[ "$1" != "$FAIL_SUITE" ]\n')
        os.chmod(stub, 0o755)
        for k in range(1, n + 1):
            local = script.replace("/tmp/suites-failed", os.path.join(tmp, "failed"))
            local = local.replace("/tmp/suite-logs", os.path.join(tmp, "logs"))
            env = dict(os.environ, PATH=tmp + os.pathsep + os.environ.get("PATH", ""),
                       SUITES_SHARD=str(k), SUITES_SHARDS=str(n), FAIL_SUITE="")
            run = subprocess.run(["bash", "-c", local], env=env, capture_output=True, text=True)
            called = re.findall(r"^CALLED quality/test_(\w+)\.py$", run.stdout, re.M)
            check(f"pool shard {k}/{n} executes and includes its panel partition",
                  run.returncode == 0 and called.count("relations_null") == 1,
                  run.stderr[-300:])
            seen.extend(called)
            _env(f"{k}/{n}")
            section_seen.extend(S.dealt(sections, "TEST_SHARD_PROBE")[0])
        counts = collections.Counter(seen)
        expected = collections.Counter(names)
        expected["relations_null"] = n
        check("the actual shell runs every other suite once, the panel once per shard", counts == expected)
        check("the panel's union contains every section exactly once",
              collections.Counter(section_seen) == collections.Counter(declared))
        env["FAIL_SUITE"] = "quality/test_relations_null.py"
        run = subprocess.run(["bash", "-c", local], env=env, capture_output=True, text=True)
        check("a failed panel partition fails the real pool gate and names the suite",
              run.returncode == 1 and "FAILING SUITES" in run.stdout
              and "quality/test_relations_null.py" in run.stdout)
    _env(None)


if __name__ == "__main__":
    for fn in (test_the_deal_is_exactly_once, test_a_bad_coordinate_refuses,
               test_run_sections_times_and_gates,
               test_every_dealt_suite_calls_the_one_idiom,
               test_no_section_reads_what_another_section_wrote,
               test_each_ci_event_owns_completed_evidence,
               test_every_cache_restore_key_can_reach_its_producer,
               test_no_result_gate_calls_a_cancelled_run_a_failure,
               test_the_two_qualification_tables_cannot_drift_apart,
               test_the_backstop_can_still_reach_what_it_backs_up,
               test_panel_sections_keep_the_pool_inventory_and_failure_gate):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("one deal, exactly once, timed, everywhere it is used")
