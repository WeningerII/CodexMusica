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
    # 2026-09-08 BCI-07: the earlier open-PR/green-push inference was
    # unsafe: event ordering could leave only the run that skipped its work.
    # Every event now owns its evidence, and event-specific concurrency keeps
    # the push and PR runs from cancelling one another. Exercise the real
    # output command; a PR's existence cannot stand in for completed checks.
    import subprocess
    import tempfile

    command = re.search(r"^        run: (.*)$", dup, re.M)
    check("coverage is produced by an explicit local command", command is not None)
    if command is not None:
        def owns_evidence(script):
            with tempfile.TemporaryDirectory() as temporary:
                output = os.path.join(temporary, "output")
                run = subprocess.run(["bash", "-e", "-c", script],
                                     env={**os.environ, "GITHUB_OUTPUT": output},
                                     capture_output=True, text=True, timeout=5)
                value = open(output).read().splitlines() if os.path.exists(output) else []
                return run.returncode == 0 and value == ["already_covered=false"]

        check("the actual command assigns this event its own work",
              owns_evidence(command.group(1)))
        check("PLANTED: claiming another run covers this event is rejected",
              not owns_evidence("echo 'already_covered=true' >> \"$GITHUB_OUTPUT\""))
        check("PLANTED: missing or failed output cannot prove coverage",
              not owns_evidence("true") and not owns_evidence("exit 1"))
    check("the coverage job performs no PR/run API lookup",
          not any(word in dup for word in ("gh api", "curl ", "pull_request", "workflow_runs")))
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


if __name__ == "__main__":
    for fn in (test_the_deal_is_exactly_once, test_a_bad_coordinate_refuses,
               test_run_sections_times_and_gates,
               test_every_dealt_suite_calls_the_one_idiom,
               test_no_section_reads_what_another_section_wrote,
               test_each_ci_event_owns_completed_evidence,
               test_every_cache_restore_key_can_reach_its_producer,
               test_no_result_gate_calls_a_cancelled_run_a_failure):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("one deal, exactly once, timed, everywhere it is used")
