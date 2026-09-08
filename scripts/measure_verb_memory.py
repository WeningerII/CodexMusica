#!/usr/bin/env python3
"""measure_verb_memory.py — peak RSS of the connector's own harness calls (M-157).

WHY THIS IS A COMMITTED SCRIPT AND NOT A SHELL ONE-LINER: standing rule 3
(NO PRIVATE INSTRUMENTS). The 2026-08-28 sitting that found the deployed
service OOM-killing on every battery round measured the peaks with a scratch
wait4 wrapper used four times in one afternoon — which is that rule's exact
defect. This file is that wrapper, given a name, an argv, and a caller.

WHAT IT MEASURES: Linux child ru_maxrss for the connector's exact heavy
argv: `lyric_grade`'s `song` step against a filled blueprint, and the first
`finish --propose=defer:` call on a fresh journal. The current capacity gate
is scripts/check_lyrics_capacity.py; this instrument supplies its evidence.
The draft is deterministic filler sized to the generated plan. This measures
grade and initial deferred repair, not writer answers, accepted edits, or
multi-round convergence. Earlier flat-memory observations are not a proof of
the current implementation's cost: the declared cold/warm matrix must run.

WHAT IT DOES NOT DO: it does not declare production isolation by itself.
Exit 3 and 4 count only with the corresponding structured result and valid
journal; a typed result can still contain honest coverage refusals. The gate
requires the deferred proposal stage to be reached. Missing live worker RSS
remains missing evidence. ru_maxrss is the child's high water mark, not a
simultaneous sum of worker plus connector memory; the gate also checks the
actual cgroup limits and OOM counter.

Usage:
  python3 scripts/measure_verb_memory.py --seed=N [--lines=N] [--verb=grade|revise|both] [--json=PATH]
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
import hashlib
import secrets
import os
import re
import queue
import threading
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.join(ROOT, "lyric-harness")
CALL_TIMEOUT_S = 600
REPORT = {"version": 1, "rows": [], "ok": False}
JSON_PATH = None
CONTROL_TOKEN = secrets.token_hex(24)
CONTROL_LINE_BYTES = 8 * 1024 * 1024  # the production python_bridge control cap


class WorkerCapture:
    """Bound diagnostic tails separately from complete authenticated records.

    Worker output is fragmented. Truncating it to a 128-KiB tail before
    parsing discarded the prefix of valid larger grade records. Only stdout
    control lines can supply a result; stderr and ordinary prose remain
    diagnostics, even when they contain something shaped like a receipt.
    """
    def __init__(self):
        self.tail = ""
        self.pending = ""
        self.pending_bytes = 0
        self.result_line = ""

    def _line(self):
        if _machine_result(self.pending):
            self.result_line = self.pending
        self.pending = ""
        self.pending_bytes = 0

    def append(self, stream, text):
        self.tail = (self.tail + text)[-131072:]
        if stream != "stdout":
            return
        parts = text.split("\n")
        for i, part in enumerate(parts):
            self.pending_bytes += len(part.encode("utf-8"))
            if self.pending_bytes > CONTROL_LINE_BYTES:
                raise RuntimeError("worker output/control line exceeds the 8-MiB cap")
            self.pending += part
            if i < len(parts) - 1:
                self._line()

    def finish(self):
        if self.pending:
            self._line()


def _machine_result(output):
    records = []
    for line in output.splitlines():
        if line.startswith("  lyric result: "):
            try:
                value = json.loads(line.split("  lyric result: ", 1)[1])
            except ValueError:
                continue
            if (isinstance(value, dict) and type(value.get("version")) is int and
                    value.get("version") == 1 and value.get("transport_token") == CONTROL_TOKEN):
                records.append(value)
    return records[-1] if records else {}


def assessment_coverage_valid(coverage):
    """A completed assessment accounts for every requested obligation, including refusals."""
    if not isinstance(coverage, dict) or coverage.get("scope") != "requested_layers":
        return False
    counts = [coverage.get(k) for k in ("pairs_mandated", "pairs_judged", "pairs_refused")]
    if any(type(n) is not int or n < 0 for n in counts) or counts[0] != counts[1] + counts[2]:
        return False
    obligations, refused = coverage.get("obligations"), coverage.get("refused_obligations")
    if not isinstance(obligations, list) or not obligations or not isinstance(refused, list):
        return False
    if any(not isinstance(row, dict) or not isinstance(row.get("id"), str) or
           row.get("status") not in ("answered", "refused", "not_requested") for row in obligations):
        return False
    ids = [row["id"] for row in obligations]
    actual = [row["id"] for row in obligations if row["status"] == "refused"]
    return (len(set(ids)) == len(ids) and actual == refused and
            type(coverage.get("certified")) is bool and coverage["certified"] == (not refused))


def _checkpoint_valid(state, code, machine, expected_lines):
    """Validate the real journal's resumable/finished shape and accepted artifact."""
    if not isinstance(state, dict) or type(state.get("version")) is not int or state.get("version") != 1:
        return False
    accepted = state.get("accepted_lines")
    if not isinstance(accepted, list) or len(accepted) != expected_lines or not all(isinstance(x, str) and x for x in accepted):
        return False
    answered = state.get("answered")
    if not isinstance(answered, dict) or any(not isinstance(answered.get(k), list) for k in ("propose", "propose_group")):
        return False
    if state.get("new_run_required"):
        return False
    fingerprint = hashlib.md5("\n".join(accepted).encode()).hexdigest()[:12]
    pending, complete = state.get("pending"), state.get("complete")
    if code == 4:
        if machine.get("status") != "suspended" or machine.get("exit") != 4 or machine.get("plan_lines") != expected_lines:
            return False
        if not isinstance(pending, dict) or complete is not None or pending.get("answer") is not None:
            return False
        if not isinstance(pending.get("prompt"), str) or not pending["prompt"].strip():
            return False
        record = pending.get("record")
        if not isinstance(record, dict):
            return False
        kind = pending.get("kind")
        if kind == "propose":
            if record.get("draft") != fingerprint or record.get("text") is not None:
                return False
            members = [record.get("line")]
        elif kind == "propose_batch":
            records = record.get("records")
            if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
                return False
            if any(r.get("draft") != fingerprint or r.get("text") is not None for r in records):
                return False
            members = [r.get("line") for r in records]
        elif kind == "propose_group":
            members = record.get("members")
        else:
            return False
        valid_members = bool(isinstance(members, list) and members and
                    all(type(i) is int and 1 <= i <= expected_lines for i in members) and
                    len(set(members)) == len(members))
        return valid_members and (kind != "propose_group" or
            (record.get("texts") == [accepted[i-1] for i in members] and record.get("new") is None))
    if code in (0, 3):
        return bool(machine.get("status") == "finished" and machine.get("exit") == code and
                    machine.get("accepted_lines") == accepted and machine.get("final_draft") == accepted and
                    pending is None and isinstance(complete, dict) and complete.get("exit") == code and
                    isinstance(complete.get("stop"), str) and complete["stop"] and
                    complete.get("final") == fingerprint and
                    machine.get("stop") == complete["stop"] and
                    isinstance(machine.get("coverage"), dict))
    return False


def _measurement_row(verb, code, wall, peak=None, retained=None, output="", state_path=None,
                     machine_output=None):
    """Record structured answers and real journals; an exit code alone is not evidence."""
    machine = _machine_result(output if machine_output is None else machine_output)
    present = bool(state_path and os.path.isfile(state_path))
    valid, stop = False, None
    if present:
        try:
            with open(state_path) as handle:
                state = json.load(handle)
            valid = _checkpoint_valid(state, code, machine, REPORT.get("lines"))
            stop = ("needs_proposal" if code == 4 else machine.get("stop")) if valid else "invalid_checkpoint"
        except (ValueError, OSError, TypeError):
            stop = "invalid_checkpoint"
    coverage = machine.get("coverage")
    if verb == "grade":
        valid_grade = (machine.get("status") == "graded" and assessment_coverage_valid(coverage) and
                       isinstance(machine.get("final_draft"), list) and
                       len(machine["final_draft"]) == REPORT.get("lines"))
        stop = "graded" if valid_grade else "missing_grade"
        typed = (code in (0, 3) or (code == 2 and isinstance(coverage, dict) and coverage.get("certified") is False)) and valid_grade
    elif verb in ("plan", "fill"):
        stop = "ready" if code == 0 else "refused"
        typed = (code == 0 and machine.get("status") == "planned" and
                 machine.get("exit") == 0 and type(machine.get("plan_lines")) is int and
                 machine["plan_lines"] > 0 and
                 (REPORT.get("lines") is None or machine["plan_lines"] == REPORT["lines"]))
    else:
        typed = code in (0, 3, 4) and valid
    row = {"verb": verb, "exit_code": code, "wall_s": wall,
           "peak_mb": peak, "retained_mb": retained, "stop": stop,
           "coverage": coverage, "machine_status": machine.get("status"),
           "authenticated": bool(machine),
           "quality_certified": coverage.get("certified") if isinstance(coverage, dict) else None,
           "refusals": len(coverage.get("refused_obligations", [])) if isinstance(coverage, dict) else None,
           "checkpoint_present": present, "checkpoint_valid": valid,
           "typed": typed}
    if machine_output is not None:
        row["control_record_bytes"] = len(machine_output.encode("utf-8"))
    if not typed:
        row["output_tail"] = output[-2000:]
    REPORT["rows"].append(row)
    return typed


# Deterministic filler: ten openings crossed with sixty distinct CMUdict-
# readable end words, so every declared capacity workload (18/24/31 lines)
# gets a draft with no repeated end word. Planning and grading remain real.
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
    """One bounded child; wait4 preserves actual child peak RSS."""
    t0 = time.monotonic()
    with open(out_path, "w") as out:
        proc = subprocess.Popen(argv, cwd=HARNESS, stdout=out, stderr=subprocess.STDOUT,
                                env={**os.environ, "LYRIC_CONTROL_TOKEN": CONTROL_TOKEN})
    while True:
        pid, status, ru = os.wait4(proc.pid, os.WNOHANG)
        if pid:
            proc.returncode = os.waitstatus_to_exitcode(status)
            return proc.returncode, time.monotonic()-t0, ru.ru_maxrss/1024.0
        if time.monotonic()-t0 > CALL_TIMEOUT_S:
            proc.kill()
            _, status, ru = os.wait4(proc.pid,0)
            proc.returncode = os.waitstatus_to_exitcode(status)
            return 124, time.monotonic()-t0, ru.ru_maxrss/1024.0
        time.sleep(.05)


def _run_plain(argv):
    r = subprocess.run(argv, cwd=HARNESS, capture_output=True, text=True, timeout=CALL_TIMEOUT_S,
                       env={**os.environ, "LYRIC_CONTROL_TOKEN": CONTROL_TOKEN})
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
    """Cold then warm calls through the real streamed worker protocol."""
    plan_path, bp_path = os.path.join(td,"plan.json"), os.path.join(td,"bp.json")
    err_path = os.path.join(td,"worker.stderr")
    with open(err_path,"w") as err:
        w = subprocess.Popen([sys.executable,WORKER], cwd=HARNESS,
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,bufsize=1,
            env={**os.environ,"PYTHONDONTWRITEBYTECODE":"1", "LYRIC_CONTROL_TOKEN": CONTROL_TOKEN})
    replies = queue.Queue()
    def read_frames():
        for line in w.stdout:
            replies.put(line)
        replies.put(None)
    threading.Thread(target=read_frames,daemon=True).start()
    rid, first_round_rss, last_rss, code = 0, None, None, 0
    round_rss = []
    def call(argv, verb_name, state_path=None):
        nonlocal rid,last_rss
        rid += 1
        t0 = time.monotonic()
        w.stdin.write(json.dumps({"id":rid,"argv":argv,
                                 "env":{"LYRIC_CONTROL_TOKEN":CONTROL_TOKEN}})+"\n"); w.stdin.flush()
        captured = WorkerCapture()
        while True:
            line = replies.get(timeout=max(.001,CALL_TIMEOUT_S-(time.monotonic()-t0)))
            if line is None:
                raise RuntimeError("worker exited before its result frame")
            reply = json.loads(line)
            if reply.get("id") != rid:
                raise RuntimeError("worker reply ID mismatch")
            if reply.get("event") == "output":
                captured.append(reply.get("stream", "stdout"), reply.get("data", ""))
                continue
            captured.append("stdout", reply.get("stdout", ""))
            captured.append("stderr", reply.get("stderr", ""))
            break
        captured.finish()
        output = captured.tail
        rss,hwm = _proc_mem_mb(w.pid); last_rss=rss
        wall = time.monotonic()-t0
        typed = _measurement_row(verb_name,reply.get("code"),wall,hwm,rss,output,state_path,
                                 machine_output=captured.result_line)
        print(f"worker call={rid} verb={verb_name} exit={reply.get('code')} wall={wall:.1f}s rss={rss} peak={hwm}",flush=True)
        if not typed:
            raise RuntimeError(f"untyped or refused {verb_name}: {output[-800:]}")
    try:
        base=[f"--seed={seed}",f"--lines={n_lines}"]
        call(["plan",*base,f"--out={plan_path}"],"plan")
        call(["plan",*base,f"--fill={draft_path}",f"--out={bp_path}"],"fill")
        plan=json.load(open(plan_path)); grade=_grade_args(plan,bp_path,draft_path)
        for i in range(rounds):
            if verb in ("grade","both"):
                call(grade,"grade")
            if verb in ("revise","both"):
                state_path=os.path.join(td,f"state{i}.json")
                call(["finish",draft_path,*base,f"--propose=defer:{state_path}"],"revise",state_path)
            round_rss.append(last_rss)
            if first_round_rss is None:
                first_round_rss=last_rss
    except (RuntimeError,ValueError,OSError,queue.Empty) as exc:
        code=1
        REPORT["error"]=str(exc) or "worker call deadline exceeded"
        print("worker FAILED:",REPORT["error"],flush=True)
        if w.poll() is None:
            w.kill()
    finally:
        try:
            w.stdin.close()
        except (OSError,BrokenPipeError):
            pass
        if w.returncode is None:
            _,status,ru=os.wait4(w.pid,0)
            w.returncode=os.waitstatus_to_exitcode(status)
            peak=ru.ru_maxrss/1024.0
        else:
            peak=max((row.get("peak_mb") or 0 for row in REPORT["rows"]),default=0)
        REPORT.update(peak_mb=peak,residual_mb=last_rss, round_retained_mb=round_rss,
            growth_mb=(max([first_round_rss] + [row["retained_mb"] for row in REPORT["rows"][2 + (2 if verb == "both" else 1):]]) - first_round_rss
                       if first_round_rss is not None and all(row.get("retained_mb") is not None for row in REPORT["rows"]) else None))
        if w.returncode != 0:
            code=1
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
    global JSON_PATH
    seed, verb, heap, worker, rounds = None, "both", False, False, 3
    requested_lines = None
    for a in argv:
        if a.startswith("--json="):
            JSON_PATH = a.split("=",1)[1]
        if a.startswith("--lines="):
            requested_lines = int(a.split("=",1)[1])
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

    REPORT.update(seed=seed,mode="worker" if worker else "cold",rounds=rounds if worker else 1)
    line_flags = [f"--lines={requested_lines}"] if requested_lines is not None else []
    with tempfile.TemporaryDirectory() as td:
        plan_path = os.path.join(td, "plan.json")
        bp_path = os.path.join(td, "bp.json")
        draft_path = os.path.join(td, "draft.txt")

        started = time.monotonic()
        code, out = _run_plain([sys.executable, "lyric_harness.py", "plan", f"--seed={seed}", *line_flags, f"--out={plan_path}"])
        if not worker:
            _measurement_row("plan",code,time.monotonic()-started,output=out)
        if code != 0:
            print(f"REFUSED — plan --seed={seed} exited {code}:\n{out[-500:]}")
            return 2
        m = re.search(r"Write a song: (\d+) lines", out)
        if not m:
            print("REFUSED — the plan report did not declare its line count")
            return 2
        n_lines = int(m.group(1))
        REPORT["lines"] = n_lines
        with open(plan_path) as handle:
            actual_plan = json.load(handle)
        if actual_plan.get("total_lines") != n_lines:
            raise RuntimeError("plan artifact and declared line count disagree")
        REPORT["plan_version"] = actual_plan.get("plan_version")
        if requested_lines is not None and n_lines != requested_lines:
            raise RuntimeError("plan changed the requested workload length")
        lines = [f"{_STARTS[i % len(_STARTS)]} {_ENDS[i % len(_ENDS)]}" for i in range(n_lines)]
        REPORT["draft_sha256"] = hashlib.sha256("\n".join(lines).encode()).hexdigest()
        REPORT["scope"] = "grade and initial deferred repair on deterministic filler; no writer answers or convergence claim"
        with open(draft_path, "w") as f:
            f.write("\n".join(lines) + "\n")
        print(f"seed={seed} lines={n_lines} (deterministic filler draft)")

        if worker:
            return _worker_sequence(seed, n_lines, draft_path, td, verb, rounds)

        if verb in ("grade", "both"):
            # The connector's lyric_grade: fill the blueprint, then grade the
            # draft against it with the mandate read off the PLAN artifact —
            # the same three coordinates mcp/lyric_tools.js picks up.
            started = time.monotonic()
            code, out = _run_plain(
                [sys.executable, "lyric_harness.py", "plan", f"--seed={seed}", *line_flags, f"--fill={draft_path}", f"--out={bp_path}"]
            )
            _measurement_row("fill",code,time.monotonic()-started,output=out)
            if code != 0:
                print(f"REFUSED — plan --fill exited {code}:\n{out[-500:]}")
                return 2
            plan = json.load(open(plan_path))
            args = _grade_args(plan, bp_path, draft_path)
            if heap:
                return _heap_profile(args)
            code, wall, peak = _run_measured(
                [sys.executable, "lyric_harness.py"] + args, os.path.join(td, "grade.out")
            )
            if not _measurement_row("grade",code,wall,peak,output=open(os.path.join(td,"grade.out")).read()):
                return 1
            print(f"verb=grade  seed={seed} lines={n_lines} exit={code} wall={wall:.1f}s peak_mb={peak:.0f}",flush=True)

        if verb in ("revise", "both"):
            state_path = os.path.join(td, "state.json")
            args = ["finish", draft_path, f"--seed={seed}", *line_flags, f"--propose=defer:{state_path}"]
            if heap:
                return _heap_profile(args)
            code, wall, peak = _run_measured(
                [sys.executable, "lyric_harness.py"] + args, os.path.join(td, "revise.out")
            )
            if not _measurement_row("revise",code,wall,peak,
                    output=open(os.path.join(td,"revise.out")).read(),state_path=state_path):
                return 1
            print(f"verb=revise seed={seed} lines={n_lines} exit={code} wall={wall:.1f}s peak_mb={peak:.0f}",flush=True)
    REPORT.update(peak_mb=max((row.get("peak_mb") or 0 for row in REPORT["rows"]),default=0),
                  residual_mb=None,growth_mb=None)
    return 0


if __name__ == "__main__":
    code = 1
    try:
        code = main(sys.argv[1:])
    except Exception as exc:
        REPORT["error"] = str(exc)
        print("MEASUREMENT FAILED:",str(exc),file=sys.stderr)
    finally:
        REPORT["ok"] = code == 0
        if JSON_PATH:
            with open(JSON_PATH,"w") as handle:
                json.dump(REPORT,handle,indent=2)
    sys.exit(code)
