#!/usr/bin/env python3
"""Run all fixed evidence, or one complete fixed partition, on at most four CPUs.

Every selected command runs after another fails. Two CI partitions retain the
whole literal inventory; their required fan-in verifies complete outcomes bound
to the same source, checkout, workflow run and attempt without dependencies.
"""
import argparse
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import threading
import time


# Long commands start first; this changes scheduling, never their work.
COMMANDS = (
    ("e5-canon", ("python3", "quality/e5_coda_adoption.py", "--part=canon")),
    ("meter-bands", ("python3", "quality/meter_bands.py", "--check")),
    ("chance-rate", ("python3", "quality/chance_rate.py", "--check")),
    ("schema-end-reading", ("python3", "quality/schema_end_reading.py", "--check")),
    ("schema-window", ("python3", "quality/schema_window.py", "--check")),
    ("song-profile-calibration", ("python3", "quality/expected_drift.py", "song_profile_calibration-fast")),
    ("e5-random-1", ("python3", "quality/e5_coda_adoption.py", "--part=random-1/4")),
    ("e5-random-2", ("python3", "quality/e5_coda_adoption.py", "--part=random-2/4")),
    ("e5-random-3", ("python3", "quality/e5_coda_adoption.py", "--part=random-3/4")),
    ("e5-random-4", ("python3", "quality/e5_coda_adoption.py", "--part=random-4/4")),
    ("search-null", ("python3", "quality/search_null.py", "--check")),
    ("door-census", ("python3", "quality/door_census.py", "--check")),
)
_PARTITIONS = (
    ("e5-canon", "e5-random-1", "e5-random-2", "e5-random-3", "e5-random-4", "search-null", "door-census"),
    ("meter-bands", "chance-rate", "schema-end-reading", "schema-window", "song-profile-calibration"),
)
_ROOT = Path(__file__).resolve().parents[1]
_HARNESS = _ROOT / "lyric-harness"
_OUTPUT = threading.Lock()
_SCHEMA_VERSION = 2
_KIND = "suite-evidence"


def _print(message):
    with _OUTPUT:
        print(message, flush=True)


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def _inventory():
    return [{"name": name, "argv": list(argv)} for name, argv in COMMANDS]


def _selected(part):
    all_names = Counter(name for name, _ in COMMANDS)
    if (len(all_names) != len(COMMANDS) or any(n != 1 for n in all_names.values())
            or Counter(name for group in _PARTITIONS for name in group) != all_names):
        raise ValueError("fixed evidence partitions do not cover the complete inventory exactly once")
    if part["count"] == 1:
        return list(COMMANDS)
    if part["count"] != 2 or part["index"] not in (1, 2):
        raise ValueError("evidence partition wants 1/2 or 2/2")
    chosen = set(_PARTITIONS[part["index"] - 1])
    return [command for command in COMMANDS if command[0] in chosen]


def _workers(value):
    number = int(value)
    if not 1 <= number <= 4:
        raise argparse.ArgumentTypeError("workers must be in 1..4")
    return number


def _shard(value):
    match = re.fullmatch(r"([12])/2", value)
    if not match:
        raise argparse.ArgumentTypeError("shard wants 1/2 or 2/2")
    return {"index": int(match.group(1)), "count": 2}


def _git(*args):
    return subprocess.check_output(["git", *args], cwd=_ROOT, stderr=subprocess.PIPE).decode().strip()


def _source_fingerprint():
    # Complete tracked harness code, corpora and recorded inputs, plus this
    # orchestration contract. Runtime downloads are verified by their tracked
    # release-asset pins; the dependency-free fan-in need not stage them again.
    raw = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "lyric-harness", "scripts/run_suite_evidence.py",
         "scripts/test_run_suite_evidence.py", ".github/workflows/ci.yml"], cwd=_ROOT)
    paths = sorted(p.decode("utf-8", "surrogateescape") for p in raw.split(b"\0") if p)
    if not paths:
        raise ValueError("cannot bind evidence to an empty source inventory")
    digest = hashlib.sha256()
    for relative in paths:
        path = _ROOT / relative
        digest.update(relative.encode("utf-8", "surrogateescape") + b"\0")
        if path.is_symlink():
            digest.update(b"link\0" + os.readlink(path).encode("utf-8", "surrogateescape"))
        else:
            with path.open("rb") as source:
                digest.update(b"file\0" + hashlib.file_digest(source, "sha256").digest())
        digest.update(b"\0")
    return {"scope_version": 1, "file_count": len(paths), "sha256": digest.hexdigest()}


def _binding():
    checkout = _git("rev-parse", "HEAD")
    github_sha = os.environ.get("GITHUB_SHA") or checkout
    if github_sha != checkout:
        raise ValueError("GITHUB_SHA differs from the actual evidence checkout")
    return {"github_sha": github_sha, "checkout_sha": checkout,
            "git_tree": _git("rev-parse", "HEAD^{tree}"),
            "github_run_id": os.environ.get("GITHUB_RUN_ID") or "local",
            "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT") or "1",
            "source_fingerprint": _source_fingerprint()}


def _slots(command, capacity):
    # A one-CPU local request retains the original serial canon. CI uses four
    # slots and two independent full-policy workers for this one command.
    return min(2, capacity) if command[0] == "e5-canon" else 1


def _run(command, directory, slots):
    name, argv = command
    state = directory / name
    cache, temporary = state / "cache", state / "tmp"
    cache.mkdir(parents=True)
    temporary.mkdir()
    log = directory / (name + ".log")
    env = dict(os.environ, XDG_CACHE_HOME=str(cache), TMPDIR=str(temporary),
               PYTHONDONTWRITEBYTECODE="1", OMP_NUM_THREADS="1",
               MKL_NUM_THREADS="1", OPENBLAS_NUM_THREADS="1", SWEEP_WORKERS="1",
               SUITE_EVIDENCE_NAME=name)
    env.pop("TEST_E5_CANON_WORKERS", None)
    if name == "e5-canon":
        env["TEST_E5_CANON_WORKERS"] = str(slots)
    started = time.monotonic()
    _print(f"EVIDENCE START {name} ({slots} CPU slots): {shlex.join(argv)}")
    with log.open("w", encoding="utf-8") as output:
        try:
            status = subprocess.run(argv, cwd=_HARNESS, env=env, stdout=output,
                                    stderr=subprocess.STDOUT).returncode
        except OSError as error:
            output.write(f"Could not execute {shlex.join(argv)}: {error}\n")
            status = 127
    elapsed = round(time.monotonic() - started, 3)
    _print(f"EVIDENCE COST {elapsed:.3f}s {name} (exit {status}); log {log}")
    return {"name": name, "argv": list(argv), "exit_code": status,
            "cpu_slots": slots, "elapsed_seconds": elapsed, "log_path": str(log),
            "cache_dir": str(cache), "temporary_dir": str(temporary)}


def _execute(commands, capacity, directory):
    pending, active, results = list(commands), {}, {}
    occupied = 0
    with ThreadPoolExecutor(max_workers=capacity) as pool:
        while pending or active:
            # Reserve the next command's whole allowance before submission;
            # a later two-worker canon cannot slip beside three ordinary jobs.
            while pending and occupied + _slots(pending[0], capacity) <= capacity:
                command = pending.pop(0)
                slots = _slots(command, capacity)
                active[pool.submit(_run, command, directory, slots)] = (command, slots)
                occupied += slots
            done, _ = wait(active, return_when=FIRST_COMPLETED)
            for future in done:
                (name, argv), slots = active.pop(future)
                occupied -= slots
                try:
                    results[name] = future.result()
                except Exception as error:
                    _print(f"EVIDENCE RUNNER ERROR {name}: {error}")
                    results[name] = {"name": name, "argv": list(argv), "cpu_slots": slots,
                                     "exit_code": 1, "elapsed_seconds": None, "error": str(error)}
    return [results[name] for name, _ in commands]


def _seal(record):
    return {**record, "record_sha256": _digest(record)}


def _verify_reports(directory, count, binding):
    paths = sorted(directory.rglob("*.json"))
    if count != 2 or len(paths) != count:
        raise ValueError(f"expected exactly two evidence reports, found {len(paths)}")
    parts, commands = {}, []
    inventory_digest = _digest(_inventory())
    for path in paths:
        report = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(report, dict):
            raise ValueError(f"evidence report is not an object: {path}")
        sealed = dict(report)
        checksum = sealed.pop("record_sha256", None)
        if checksum != _digest(sealed):
            raise ValueError(f"evidence report integrity differs: {path}")
        if report.get("schema_version") != _SCHEMA_VERSION or report.get("kind") != _KIND:
            raise ValueError(f"unsupported evidence report: {path}")
        if report.get("binding") != binding:
            raise ValueError(f"evidence source, checkout, run or attempt differs: {path}")
        if report.get("inventory_sha256") != inventory_digest:
            raise ValueError(f"evidence full inventory differs: {path}")
        part = report.get("part")
        if (not isinstance(part, dict) or set(part) != {"index", "count"}
                or type(part["index"]) is not int or part["index"] not in (1, 2)
                or type(part["count"]) is not int or part["count"] != count):
            raise ValueError(f"invalid evidence partition: {path}")
        if part["index"] in parts:
            raise ValueError(f"duplicate evidence partition: {part['index']}")
        expected = _selected(part)
        rows = report.get("commands")
        if (not isinstance(rows, list) or len(rows) != len(expected)
                or type(report.get("command_count")) is not int
                or report["command_count"] != len(expected)
                or type(report.get("completed_count")) is not int
                or report["completed_count"] != len(expected)):
            raise ValueError(f"incomplete evidence outcomes: {path}")
        capacity = report.get("workers")
        if type(capacity) is not int or not 1 <= capacity <= 4:
            raise ValueError(f"invalid evidence CPU allowance: {path}")
        for row, command in zip(rows, expected):
            name, argv = command
            if (not isinstance(row, dict) or row.get("name") != name
                    or row.get("argv") != list(argv)
                    or type(row.get("cpu_slots")) is not int
                    or row["cpu_slots"] != _slots(command, capacity)):
                raise ValueError(f"wrong evidence command, arguments or CPU allowance: {path}")
            if type(row.get("exit_code")) is not int or row["exit_code"] != 0:
                raise ValueError(f"failed evidence command {name}: {path}")
        if report.get("success") is not True or report.get("errors") != []:
            raise ValueError(f"failed evidence partition: {path}")
        parts[part["index"]] = {"path": str(path), "record_sha256": checksum,
                                 "commands": len(rows)}
        commands.extend((row["name"], tuple(row["argv"])) for row in rows)
    if set(parts) != {1, 2} or Counter(commands) != Counter(COMMANDS):
        raise ValueError("evidence global inventory is not complete and exactly once")
    return {"schema_version": _SCHEMA_VERSION, "kind": "suite-evidence-fan-in",
            "binding": binding, "inventory_sha256": inventory_digest,
            "shards": count, "command_count": len(COMMANDS), "success": True,
            "parts": [parts[index] for index in (1, 2)]}


def _main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=_workers, default=4)
    parser.add_argument("--logs-dir", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--list-json", action="store_true")
    parser.add_argument("--shard", type=_shard)
    parser.add_argument("--verify-reports", type=Path)
    parser.add_argument("--shards", type=int, choices=(2,), default=2)
    args = parser.parse_args(argv)
    if args.verify_reports:
        if args.shard or args.list_json or args.logs_dir:
            parser.error("report verification cannot also execute or list evidence")
        if args.report and args.report.resolve().is_relative_to(args.verify_reports.resolve()):
            parser.error("write the fan-in report outside its input directory")
        try:
            verified = _verify_reports(args.verify_reports, args.shards, _binding())
        except (ValueError, OSError, subprocess.SubprocessError) as error:
            _print(f"REFUSED EVIDENCE REPORTS: {error}")
            return 1
        text = json.dumps(verified, indent=2) + "\n"
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(text, encoding="utf-8")
        print(text, end="", flush=True)
        return 0
    part = args.shard or {"index": 1, "count": 1}
    commands = _selected(part)
    if args.list_json:
        print(json.dumps({"count": len(COMMANDS), "commands": _inventory(),
                          "partitions": [{"shard": f"{k}/2", "names": list(group)}
                                         for k, group in enumerate(_PARTITIONS, 1)],
                          "selected_count": len(commands),
                          "selected_names": [name for name, _ in commands]}))
        return 0
    try:
        binding = _binding()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        _print(f"REFUSED EVIDENCE SOURCE: {error}")
        return 1
    if args.logs_dir:
        args.logs_dir.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix="suite-evidence-", dir=args.logs_dir)).resolve()
    default_report = "report.json" if part["count"] == 1 else f"suite-evidence-{part['index']}.json"
    report_path = (args.report or directory / default_report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    ordered = _execute(commands, args.workers, directory)
    failed = [row for row in ordered if row["exit_code"] != 0]
    errors = []
    try:
        if _binding() != binding:
            errors.append("evidence source or execution binding changed during the run")
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        errors.append(f"evidence source could not be rechecked: {error}")
    report = _seal({"schema_version": _SCHEMA_VERSION, "kind": _KIND,
                    "binding": binding, "inventory_sha256": _digest(_inventory()),
                    "part": part, "workers": args.workers, "command_count": len(commands),
                    "completed_count": len(ordered), "success": not failed and not errors,
                    "errors": errors, "elapsed_seconds": round(time.monotonic() - started, 3),
                    "logs_dir": str(directory), "commands": ordered})
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for result in failed:
        _print(f"FAILING EVIDENCE {result['name']} (exit {result['exit_code']})")
        if "log_path" in result:
            _print("\n".join(Path(result["log_path"]).read_text(
                encoding="utf-8", errors="replace").splitlines()[-60:]))
    for error in errors:
        _print(f"FAILING EVIDENCE SOURCE: {error}")
    _print(f"EVIDENCE TOTAL {report['elapsed_seconds']:.3f}s: "
           f"{len(ordered)} completed, {len(failed)} failed; report {report_path}")
    return 1 if failed or errors else 0


if __name__ == "__main__":
    raise SystemExit(_main())
