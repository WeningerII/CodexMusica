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
    dealt = sorted(set(re.findall(r"TEST_([A-Z]+)_SHARD:", ci)))
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
        writers, readers = {}, {}
        for fn in tree.body:
            if not (isinstance(fn, ast.FunctionDef)
                    and fn.name.startswith("test_")):
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
    dealt = sorted(set(re.findall(r"TEST_([A-Z]+)_SHARD:", ci)))
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


def test_a_duplicate_push_run_skips_rather_than_cancelling():
    print("\n6. a push run that a pull_request run already covers SKIPS every "
          "job -- skipped is NEUTRAL on the PR where cancelled is not "
          "(`MISSING.md` M-250)")
    # THE DEFECT THIS PINS, 2026-09-06. A push to a branch with an open PR
    # starts two runs and the concurrency group cancels one within seconds, by
    # design. That left ~15 CANCELLED check runs on the PR's head, so a PR
    # whose real run was entirely green read "some checks were not successful"
    # and sat at mergeable_state `unstable` -- twice in one day, PR #236 and
    # PR #237, each cleared only by re-running the dead twin BY HAND.
    path = os.path.join(HERE, "..", "..", ".github", "workflows", "ci.yml")
    ci = open(path, encoding="utf-8").read()
    check("the workflow may ASK whether a PR covers this commit "
          "(`pull-requests: read`)", "pull-requests: read" in ci)
    jobs = _ci_jobs()
    check("gate publishes the answer as an output every job can read",
          "covered_by_pr:" in jobs.get("gate", ""), sorted(jobs))
    # DERIVED, never a list: a job added tomorrow without the guard fails here.
    GUARD = "needs.gate.outputs.covered_by_pr != 'true'"
    def guarded(txt):
        return GUARD in txt
    def needs_gate(txt):
        return re.search(r"^    needs: (gate\b|\[gate\b)", txt, re.M) is not None
    downstream = sorted(n for n, t in jobs.items() if needs_gate(t))
    check("every job that runs off `gate` carries the guard",
          downstream and all(guarded(jobs[n]) for n in downstream),
          f"{len(downstream)} downstream: "
          + ", ".join(n for n in downstream if not guarded(jobs[n])) or "all guarded")
    # The jobs that do NOT need the guard must be unable to run on a push at
    # all -- otherwise "no guard" is an omission wearing an exemption's coat.
    for n, t in sorted(jobs.items()):
        if n == "gate" or needs_gate(t):
            continue
        check(f"{n} needs no guard because it cannot run on a push",
              "workflow_dispatch" in t and "schedule" in t)
    # DENY BY DEFAULT: the step decides `false` first and only a parsed answer
    # moves it, so an unanswered question never skips a run (the
    # six-uncovered-commits defect the `branches: ['**']` filter prevents).
    gate = jobs.get("gate", "")
    check("the check starts at false, so a failed or unparseable answer RUNS",
          re.search(r"^\s+covered=false$", gate, re.M) is not None
          and gate.count("an unanswered question is not a yes") >= 2)
    check("and it never skips a push to the production branch",
          'github.ref_name }}" != "main"' in gate)
    # THE CHECK CAN FAIL: strip one job's guard and the sweep must catch it.
    victim = downstream[0]
    planted = dict(jobs)
    planted[victim] = planted[victim].replace(GUARD, "true")
    check("PLANTED: a downstream job whose guard was dropped IS caught",
          not all(guarded(planted[n]) for n in downstream), victim)


if __name__ == "__main__":
    for fn in (test_the_deal_is_exactly_once, test_a_bad_coordinate_refuses,
               test_run_sections_times_and_gates,
               test_every_dealt_suite_calls_the_one_idiom,
               test_no_section_reads_what_another_section_wrote,
               test_a_duplicate_push_run_skips_rather_than_cancelling):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("one deal, exactly once, timed, everywhere it is used")
