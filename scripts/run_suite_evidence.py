#!/usr/bin/env python3
"""Run the complete fixed suites evidence inventory on at most four CPUs.

Each command is an independent process with its original arguments. Every
command runs after failures, and the final exit is nonzero if any failed.
Separate cache and temporary directories retain enabled cache behavior while
preventing the calibration's SQLite field store from sharing a writer.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
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
_HARNESS = Path(__file__).resolve().parents[1] / "lyric-harness"
_OUTPUT = threading.Lock()


def _print(message):
    with _OUTPUT:
        print(message, flush=True)


def _workers(value):
    number = int(value)
    if not 1 <= number <= 4:
        raise argparse.ArgumentTypeError("workers must be in 1..4")
    return number


def _run(command, directory):
    name, argv = command
    state = directory / name
    cache, temporary = state / "cache", state / "tmp"
    cache.mkdir(parents=True)
    temporary.mkdir()
    log = directory / (name + ".log")
    env = dict(os.environ, XDG_CACHE_HOME=str(cache), TMPDIR=str(temporary),
               PYTHONDONTWRITEBYTECODE="1", OMP_NUM_THREADS="1",
               MKL_NUM_THREADS="1", OPENBLAS_NUM_THREADS="1", SWEEP_WORKERS="1")
    started = time.monotonic()
    _print(f"EVIDENCE START {name}: {shlex.join(argv)}")
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
            "elapsed_seconds": elapsed, "log_path": str(log),
            "cache_dir": str(cache), "temporary_dir": str(temporary)}


def _main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=_workers, default=4)
    parser.add_argument("--logs-dir", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--list-json", action="store_true")
    args = parser.parse_args(argv)
    inventory = [{"name": name, "argv": list(command)} for name, command in COMMANDS]
    if args.list_json:
        print(json.dumps({"count": len(inventory), "commands": inventory}))
        return 0
    if args.logs_dir:
        args.logs_dir.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix="suite-evidence-", dir=args.logs_dir)).resolve()
    report_path = (args.report or directory / "report.json").resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    results = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(_run, command, directory): command for command in COMMANDS}
        for future in as_completed(futures):
            name, command = futures[future]
            try:
                results[name] = future.result()
            except Exception as error:
                # A runner error is a failed check, and still cannot hide the
                # other submitted commands. The report retains the cause.
                _print(f"EVIDENCE RUNNER ERROR {name}: {error}")
                results[name] = {"name": name, "argv": list(command),
                                 "exit_code": 1, "elapsed_seconds": None,
                                 "error": str(error)}
    ordered = [results[name] for name, _ in COMMANDS]
    failed = [result for result in ordered if result["exit_code"] != 0]
    report = {"workers": args.workers, "command_count": len(COMMANDS),
              "completed_count": len(ordered), "success": not failed,
              "elapsed_seconds": round(time.monotonic() - started, 3),
              "logs_dir": str(directory), "commands": ordered}
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for result in failed:
        _print(f"FAILING EVIDENCE {result['name']} (exit {result['exit_code']})")
        if "log_path" in result:
            _print("\n".join(Path(result["log_path"]).read_text(
                encoding="utf-8", errors="replace").splitlines()[-60:]))
    _print(f"EVIDENCE TOTAL {report['elapsed_seconds']:.3f}s: "
           f"{len(ordered)} completed, {len(failed)} failed; report {report_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_main())
