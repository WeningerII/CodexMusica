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
    seed, verb, heap = None, "both", False
    for a in argv:
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
