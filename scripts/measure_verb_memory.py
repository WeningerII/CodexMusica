#!/usr/bin/env python3
"""measure_verb_memory.py — peak RSS of the connector's own harness calls (M-157).

WHY THIS IS A COMMITTED SCRIPT AND NOT A SHELL ONE-LINER: standing rule 3
(NO PRIVATE INSTRUMENTS). The 2026-08-28 sitting that found the deployed
service OOM-killing on every battery round measured the peaks with a scratch
wait4 wrapper used four times in one afternoon — which is that rule's exact
defect. This file is that wrapper, given a name, an argv, and a caller.

WHAT IT MEASURES: the maximum resident set size (ru_maxrss of the reaped
child, so the number includes everything the verb's process tree kept
resident) of the EXACT argv the connector runs for its two heavy tools —
`lyric_grade`'s `song` step (mandate coordinates read off the plan artifact,
the draft graded against the FILLED blueprint, byte-for-byte the argv
mcp/lyric_tools.js builds) and `lyric_revise`'s first call (`finish` with a
fresh `--propose=defer:` state). The draft is DETERMINISTIC FILLER sized to
the seed's own declared line count: the peak is dominated by the
lexicon-wide candidate machinery, not the words (measured 826MB at the
envelope's 22-line floor against 882MB at 50 lines — flat), so filler is the
honest cheap probe and the number is reproducible from the seed alone.

WHAT IT DOES NOT DO: it gates nothing (scripts/check_deploy_memory.js is
the gate and carries the banked figures), and it scores nothing — exit 3
and exit 4 from the verbs are ANSWERS here, not failures. Exit 0 means
every requested measurement ran; exit 2 means the plan itself refused.

Usage:
  python3 scripts/measure_verb_memory.py --seed=N [--verb=grade|revise|both]
  python3 scripts/measure_verb_memory.py --seed=N --verb=grade --heap
  python3 scripts/measure_verb_memory.py --seed=N --worker [--rounds=K] [--verb=...]

THE `--heap` MODE is the finer instrument: WHERE do the megabytes live?
It runs ONE verb in-process (the worker's own cli() swap, so the code path
is the production one) under `tracemalloc`, samples the traced total on a
thread, keeps the snapshot nearest the peak, and prints the top allocation
sites at PEAK and what stays RETAINED after the call returns (the memo
residue the warm worker carries between requests). Two honesty notes are
part of the output: tracemalloc's traced total UNDERCOUNTS the process RSS
(interpreter, allocator slack, anything C-level), so the process VmHWM is
printed beside it as the bracket; and tracing slows the run several-fold,
so `--heap` wall times are not comparable to the plain mode's.

THE `--worker` MODE (M-187) measures the same verbs THROUGH `mcp/worker.py`:
one persistent process serving the connector's whole-song sequence — plan,
fill, then grade and revise repeated `--rounds` times (default 3; every
revise a FIRST call on a fresh `--propose=defer:` state, the cold rows' own
argv, so the two modes do identical work and differ only in the process
doing it). After every reply it reads /proc/<pid>/status: VmRSS is the
RESIDUAL the worker carries into the next request and VmHWM the high-water
mark so far; ru_maxrss at exit is the whole sequence's peak, the statistic
the cold rows report, so the two are comparable. The mode exists because the
2 GB margin scripts/check_deploy_memory.js banks was argued from "worker
measured 181 MB resident after one light call" and the cold peak — never from
the worker at its OWN peak, which until 2026-09-01 no image on Render had
ever reached, because the Dockerfile did not ship the file (M-187).
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.join(ROOT, "lyric-harness")

# Deterministic filler: ten openings crossed with sixty distinct CMUdict-
# readable end words, so any envelope-legal length (22-55 lines) gets a draft
# with no repeated end word and the graders do their full work.
_STARTS = [
    "The morning light fell over the", "I carried every question to the",
    "We waited out the weather by the", "She wrote her answer slowly on the",
    "A cold wind took the paper from the", "The city hummed its warning through the",
    "My brother kept his silence in the", "The garden gave its colors to the",
    "I traded all my silver for the", "The last bus rattled homeward past the",
]
_ENDS = [
    "river", "garden", "station", "window", "harbor", "mountain", "ladder",
    "ocean", "letter", "candle", "shoulder", "winter", "corner", "doorway",
    "meadow", "engine", "anchor", "feather", "lantern", "thunder", "valley",
    "mirror", "curtain", "gravel", "timber", "saddle", "copper", "marble",
    "cellar", "border", "willow", "ember", "hollow", "ribbon", "shadow",
    "summer", "supper", "hammer", "clover", "arrow", "sorrow", "yellow",
    "pillow", "canyon", "chapel", "wagon", "pepper", "cotton", "velvet",
    "salmon", "table", "basket", "bucket", "jacket", "magnet", "petal",
    "signal", "tunnel", "carpet", "planet",
]


def _run_measured(argv, out_path):
    """One child on `argv` under lyric-harness -> (exit, wall_s, peak_mb)."""
    t0 = time.time()
    with open(out_path, "w") as out:
        proc = subprocess.Popen(argv, cwd=HARNESS, stdout=out, stderr=subprocess.STDOUT)
    _, status, ru = os.wait4(proc.pid, 0)
    return os.waitstatus_to_exitcode(status), time.time() - t0, ru.ru_maxrss / 1024.0


def _run_plain(argv):
    r = subprocess.run(argv, cwd=HARNESS, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


WORKER = os.path.join(ROOT, "mcp", "worker.py")


def _proc_mem_mb(pid):
    """(VmRSS, VmHWM) of a LIVE process in MB, off /proc/<pid>/status.

    ru_maxrss speaks only at exit; a warm worker's residual between requests
    and its high-water mark so far are readable only while it runs.
    """
    rss = hwm = None
    try:
        with open(f"/proc/{pid}/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    rss = int(line.split()[1]) / 1024.0
                elif line.startswith("VmHWM:"):
                    hwm = int(line.split()[1]) / 1024.0
    except OSError:
        pass
    return rss, hwm


def _grade_args(plan, bp_path, draft_path):
    """The connector's lyric_grade argv: fill the blueprint, then grade the
    draft against it with the mandate read off the PLAN artifact — the same
    coordinates mcp/lyric_tools.js picks up. One home for both modes."""
    args = ["song", bp_path, draft_path]
    if plan.get("groups"):
        args.append(f"--groups={plan['groups']}")
    if plan.get("returns"):
        args.append(f"--returns={plan['returns']}")
    if plan.get("relation"):
        args.append(f"--relation={plan['relation']}")
    rel = plan.get("relations") or {}
    if rel:
        args.append("--relations=" + ",".join(f"{k}:{rel[k]}" for k in sorted(rel)))
    args += ["--subdivision", str(plan["subdivision"])]
    return args


def _worker_sequence(seed, n_lines, draft_path, td, verb, rounds):
    """The connector's whole-song sequence through ONE mcp/worker.py.

    One row per reply, then a summary carrying the exit-time ru_maxrss (the
    sequence's peak) beside the residual after the LAST call and the residual
    after the FIRST round, so the growth across rounds is on the line. Exit 0
    when every reply arrived; exit 2 when plan or fill refused (nothing to
    measure); exit 1 when the worker died mid-sequence — in production that is
    the cold fallback's case, and this mode has nothing to say about that path.
    """
    plan_path = os.path.join(td, "plan.json")
    bp_path = os.path.join(td, "bp.json")
    err_path = os.path.join(td, "worker.stderr")
    with open(err_path, "w") as err:
        w = subprocess.Popen(
            ["python3", WORKER], cwd=HARNESS, stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=err, text=True, bufsize=1,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )
    rid = 0
    rss_after = []

    def call(argv):
        nonlocal rid
        rid += 1
        t0 = time.time()
        w.stdin.write(json.dumps({"id": rid, "argv": argv}) + "\n")
        w.stdin.flush()
        line = w.stdout.readline()
        if not line:
            raise RuntimeError(f"the worker exited after {rid - 1} replies")
        reply = json.loads(line)
        wall = time.time() - t0
        rss, hwm = _proc_mem_mb(w.pid)
        rss_after.append(rss)
        print(f"worker call={rid} verb={argv[0]} exit={reply.get('code')} wall={wall:.1f}s "
              f"rss_after_mb={rss:.0f} hwm_mb={hwm:.0f}")
        return reply

    code = 0
    try:
        for argv in (["plan", f"--seed={seed}", f"--out={plan_path}"],
                     ["plan", f"--seed={seed}", f"--fill={draft_path}", f"--out={bp_path}"]):
            r = call(argv)
            if r.get("code") != 0:
                print(f"REFUSED — {argv[0]} exited {r.get('code')} in the worker:\n"
                      f"{(r.get('stdout', '') + r.get('stderr', ''))[-500:]}")
                return 2
        plan = json.load(open(plan_path))
        grade = _grade_args(plan, bp_path, draft_path)
        first_round_rss = None
        for i in range(rounds):
            if verb in ("grade", "both"):
                call(grade)
            if verb in ("revise", "both"):
                call(["finish", draft_path, f"--seed={seed}",
                      f"--propose=defer:{os.path.join(td, f'state{i}.json')}"])
            if first_round_rss is None:
                first_round_rss = rss_after[-1]
    except (RuntimeError, ValueError, OSError) as e:
        code = 1
        tail = open(err_path).read()[-800:]
        print(f"worker DIED — {e}\n{tail}")
    finally:
        try:
            w.stdin.close()
        except OSError:
            pass
        _, _status, ru = os.wait4(w.pid, 0)
    if code == 0:
        print(f"worker seed={seed} lines={n_lines} calls={rid} rounds={rounds} verb={verb} "
              f"peak_mb={ru.ru_maxrss / 1024.0:.0f} residual_after_round1_mb={first_round_rss:.0f} "
              f"residual_last_mb={rss_after[-1]:.0f} "
              f"growth_mb={rss_after[-1] - first_round_rss:+.0f}")
    return code


def _vm_hwm_mb():
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmHWM"):
                    return int(line.split()[1]) / 1024.0
    except OSError:
        pass
    return None


def _print_stats(title, snapshot, limit=15):
    print(f"\n{title}")
    for label, key in (("by line", "lineno"), ("by file", "filename")):
        stats = snapshot.statistics(key)
        total = sum(s.size for s in stats)
        print(f"  top {limit} {label} (traced total {total / 1048576:.0f} MB):")
        for s in stats[:limit]:
            frame = s.traceback[0]
            where = f"{os.path.relpath(frame.filename, ROOT)}:{frame.lineno}" if key == "lineno" else os.path.relpath(frame.filename, ROOT)
            print(f"    {s.size / 1048576:7.1f} MB  {s.count:>9} objs  {where}")


def _heap_profile(argv):
    """One in-process verb run under tracemalloc: peak owners + retained."""
    import io
    import threading
    import tracemalloc

    os.chdir(HARNESS)
    sys.path.insert(0, HARNESS)
    import lyric_harness

    # Depth 1: the allocating line alone. statistics('lineno') reads only the
    # top frame, and deeper traces multiply both the tracer's slowdown and
    # every snapshot's own footprint — on a ~650 MB working set that margin
    # is the difference between profiling the box and OOMing it.
    tracemalloc.start(1)
    best = {"bytes": 0, "snap": None}
    stop = threading.Event()

    def sampler():
        while not stop.wait(2.0):
            cur, _ = tracemalloc.get_traced_memory()
            # Snapshot only on a real climb: each snapshot copies the whole
            # trace table, so sampling the NUMBER is cheap and the snapshot
            # is rationed to genuine new peaks.
            if cur > best["bytes"] * 1.10 or (cur > best["bytes"] and best["snap"] is None):
                best["bytes"] = cur
                best["snap"] = tracemalloc.take_snapshot()

    t = threading.Thread(target=sampler, daemon=True)
    t.start()

    old_argv, old_out, old_err = sys.argv, sys.stdout, sys.stderr
    sys.argv = ["lyric_harness.py"] + list(argv)
    sys.stdout, sys.stderr = io.StringIO(), io.StringIO()
    code, t0 = 0, time.time()
    try:
        rc = lyric_harness.cli()
        code = int(rc) if isinstance(rc, int) else 0
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    finally:
        sys.argv, sys.stdout, sys.stderr = old_argv, old_out, old_err
    wall = time.time() - t0
    stop.set()
    t.join()

    retained = tracemalloc.take_snapshot()
    cur, peak = tracemalloc.get_traced_memory()
    hwm = _vm_hwm_mb()
    print(f"verb exit={code} wall={wall:.1f}s (traced — several-fold slower than untraced)")
    print(f"traced: current {cur / 1048576:.0f} MB, peak {peak / 1048576:.0f} MB; process VmHWM {hwm:.0f} MB" if hwm else f"traced: current {cur / 1048576:.0f} MB, peak {peak / 1048576:.0f} MB")
    if best["snap"] is not None:
        _print_stats(f"AT PEAK (best sample, {best['bytes'] / 1048576:.0f} MB traced):", best["snap"])
    _print_stats("RETAINED after the call (what a warm worker keeps):", retained)
    return 0


def main(argv):
    seed, verb, heap, worker, rounds = None, "both", False, False, 3
    for a in argv:
        m = re.fullmatch(r"--rounds=(\d+)", a)
        if m:
            rounds = int(m.group(1))
        if a == "--worker":
            worker = True
        m = re.fullmatch(r"--seed=(\d+)", a)
        if m:
            seed = int(m.group(1))
        m = re.fullmatch(r"--verb=(grade|revise|both)", a)
        if m:
            verb = m.group(1)
        if a == "--heap":
            heap = True
    if seed is None:
        print("REFUSED — --seed=N is required: a measurement with no declared seed is not reproducible")
        return 2
    if heap and verb == "both":
        print("REFUSED — --heap profiles ONE verb per process (the tracer and the memos are process-global); pass --verb=grade or --verb=revise")
        return 2
    if heap and worker:
        print("REFUSED — --heap traces THIS process and --worker measures ANOTHER; they are two instruments, run them separately")
        return 2
    if worker and rounds < 1:
        print("REFUSED — --rounds must be at least 1: a sequence with no heavy call measures the interpreter")
        return 2

    with tempfile.TemporaryDirectory() as td:
        plan_path = os.path.join(td, "plan.json")
        bp_path = os.path.join(td, "bp.json")
        draft_path = os.path.join(td, "draft.txt")

        code, out = _run_plain(["python3", "lyric_harness.py", "plan", f"--seed={seed}", f"--out={plan_path}"])
        if code != 0:
            print(f"REFUSED — plan --seed={seed} exited {code}:\n{out[-500:]}")
            return 2
        m = re.search(r"Write a song: (\d+) lines", out)
        if not m:
            print("REFUSED — the plan report did not declare its line count")
            return 2
        n_lines = int(m.group(1))
        lines = [f"{_STARTS[i % len(_STARTS)]} {_ENDS[i % len(_ENDS)]}" for i in range(n_lines)]
        with open(draft_path, "w") as f:
            f.write("\n".join(lines) + "\n")
        print(f"seed={seed} lines={n_lines} (deterministic filler draft)")

        if worker:
            return _worker_sequence(seed, n_lines, draft_path, td, verb, rounds)

        if verb in ("grade", "both"):
            # The connector's lyric_grade: fill the blueprint, then grade the
            # draft against it with the mandate read off the PLAN artifact —
            # the same three coordinates mcp/lyric_tools.js picks up.
            code, out = _run_plain(
                ["python3", "lyric_harness.py", "plan", f"--seed={seed}", f"--fill={draft_path}", f"--out={bp_path}"]
            )
            if code != 0:
                print(f"REFUSED — plan --fill exited {code}:\n{out[-500:]}")
                return 2
            plan = json.load(open(plan_path))
            args = _grade_args(plan, bp_path, draft_path)
            if heap:
                return _heap_profile(args)
            code, wall, peak = _run_measured(
                ["python3", "lyric_harness.py"] + args, os.path.join(td, "grade.out")
            )
            print(f"verb=grade  seed={seed} lines={n_lines} exit={code} wall={wall:.1f}s peak_mb={peak:.0f}")

        if verb in ("revise", "both"):
            state_path = os.path.join(td, "state.json")
            args = ["finish", draft_path, f"--seed={seed}", f"--propose=defer:{state_path}"]
            if heap:
                return _heap_profile(args)
            code, wall, peak = _run_measured(
                ["python3", "lyric_harness.py"] + args, os.path.join(td, "revise.out")
            )
            print(f"verb=revise seed={seed} lines={n_lines} exit={code} wall={wall:.1f}s peak_mb={peak:.0f}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
