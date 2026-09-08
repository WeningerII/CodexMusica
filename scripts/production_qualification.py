#!/usr/bin/env python3
"""Run/attest the complete maintained mutation and calibration comparisons.

No caller-supplied commands or reduced calibration scopes are accepted. A timeout
is an incomplete receipt, never qualification. This does not attest a fresh
held-out model-adoption study, hosted capacity, or paid song acceptance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "lyric-harness"
COMPONENTS = tuple([f"mutation-{i}" for i in range(1, 5)] + ["song", "short", "curves"])


def spec(component):
    if component in COMPONENTS[:4]:
        return ["quality/test_mutation.py", f"--shard={component[-1]}/4"], 12000
    if component in ("song", "short"):
        return ["quality/song_profile_calibration.py", "--check", f"--profile={component}", "--seeds=200", "--draws=2000"], 9000
    if component == "curves":
        return ["quality/length_curve_calibration.py", "check"], 2400
    raise ValueError("Unknown qualification component")


def inventory():
    sys.path.insert(0, str(HARNESS / "quality"))
    import mutate
    return [m.name for m in mutate.MUTATIONS]


def identity():
    sys.path.insert(0, str(HARNESS / "quality"))
    import mutate
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if subprocess.check_output(["git", "diff", "HEAD", "--name-only"], cwd=ROOT):
        raise ValueError("Tracked source differs from the named commit")
    source = subprocess.check_output(["node", "--input-type=module", "-e", "import {runtimeSourceFingerprint} from './mcp/build_identity.js'; console.log(runtimeSourceFingerprint());"], cwd=ROOT, text=True).strip()
    return {"commit": sha, "source_sha256": source, "inputs_sha256": mutate.source_fingerprint()}


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")
    os.replace(temporary, path)


def terminate(proc):
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    proc.wait()


def run_component(component, out):
    if os.environ.get("LYRIC_MUTATE_ACTIVE"):
        raise ValueError("A nested mutation recursion guard cannot provide qualification")
    command, budget = spec(component)
    before = identity()
    receipt = {"version": 1, "component": component, "command": command,
               "budget_s": budget, "identity": before, "inventory": inventory(),
               "repository": os.environ.get("GITHUB_REPOSITORY"),
               "run_id": int(os.environ.get("GITHUB_RUN_ID", "0")),
               "run_attempt": int(os.environ.get("GITHUB_RUN_ATTEMPT", "0")),
               "status": "running", "exit_code": None}
    save(out, receipt)
    started = time.monotonic()
    proc = None
    try:
        with Path(str(out) + ".log").open("wb") as stream:
            proc = subprocess.Popen([sys.executable, "-u", *command], cwd=HARNESS,
                                    stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = proc.wait(timeout=budget)
            except subprocess.TimeoutExpired:
                terminate(proc)
                code = 124
        after = identity()
        receipt.update(exit_code=code, status="completed" if code == 0 and before == after else "incomplete",
                       identity_after=after, elapsed_s=time.monotonic() - started,
                       log_sha256=hashlib.sha256(Path(str(out) + ".log").read_bytes()).hexdigest())
    finally:
        if proc is not None:
            terminate(proc)
        save(out, receipt)
    print(json.dumps(receipt))
    return 0 if receipt["status"] == "completed" else 1


def aggregate(receipts, *, commit, repository, run_id, run_attempt, names):
    if len(receipts) != len(COMPONENTS) or sorted(r.get("component", "") for r in receipts) != sorted(COMPONENTS):
        raise ValueError("Every one of four unique mutation shards and all three full calibration comparisons is required")
    if not names or len(set(names)) != len(names):
        raise ValueError("Mutation inventory is missing or duplicated")
    common = receipts[0].get("identity")
    for r in receipts:
        command, budget = spec(r["component"])
        if (r.get("version") != 1 or r.get("status") != "completed" or type(r.get("exit_code")) is not int or r["exit_code"] != 0
                or r.get("command") != command or r.get("budget_s") != budget
                or r.get("identity") != common or r.get("identity_after") != common
                or r.get("inventory") != names or r.get("repository") != repository
                or type(r.get("run_id")) is not int or r["run_id"] != run_id or run_id < 1
                or type(r.get("run_attempt")) is not int or r["run_attempt"] != run_attempt or run_attempt < 1):
            raise ValueError("Incomplete, reduced, stale, mismatched or unsuccessful qualification evidence")
        for key in ("source_sha256", "inputs_sha256"):
            if not isinstance(common.get(key), str) or len(common[key]) != 64 or any(c not in "0123456789abcdef" for c in common[key]):
                raise ValueError("Missing source/input fingerprint")
        if common.get("commit") != commit or len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit):
            raise ValueError("Qualification commit mismatch")
    return {"version": 1, "scope": "complete-maintained-mutation-and-calibration-comparisons",
            "completed": True, "identity": common, "repository": repository,
            "run_id": run_id, "run_attempt": run_attempt, "components": list(COMPONENTS),
            "mutation_inventory": names, "receipts": receipts,
            "limitations": ["No fresh held-out model-adoption fit attested", "No hosted capacity or paid song acceptance attested"]}


def capacity_metadata(receipt_bytes, *, commit, repository, run_id, run_attempt):
    if (len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit)
            or not repository or run_id < 1 or run_attempt < 1):
        raise ValueError("Exact capacity proof CI identity is required")
    return {"version": 1, "commit": commit, "repository": repository,
            "run_id": run_id, "run_attempt": run_attempt,
            "receipt_sha256": hashlib.sha256(receipt_bytes).hexdigest()}


def validate_capacity_metadata(value, receipt_bytes, **expected):
    want = capacity_metadata(receipt_bytes, **expected)
    if not isinstance(value, dict) or value != want or any(type(value.get(k)) is not type(v) for k, v in want.items()):
        raise ValueError("Capacity proof belongs to another commit, run, attempt or receipt")


def capacity_artifact(verb, directory):
    directory = Path(directory)
    receipt_path = directory / "capacity_verification.json"
    metadata_path = directory / "identity.json"
    expected = dict(commit=os.environ["GITHUB_SHA"], repository=os.environ["GITHUB_REPOSITORY"],
                    run_id=int(os.environ["GITHUB_RUN_ID"]), run_attempt=int(os.environ["GITHUB_RUN_ATTEMPT"]))
    actual_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if actual_commit != expected["commit"]:
        raise ValueError("Capacity artifact checkout differs from this workflow commit")
    receipt_bytes = receipt_path.read_bytes()
    if verb == "capacity-accept":
        validate_capacity_metadata(json.loads(metadata_path.read_text()), receipt_bytes, **expected)
    sys.path.insert(0, str(HARNESS))
    from quality.capacity import require_current_proof
    require_current_proof(receipt_path=str(receipt_path.resolve()))
    if receipt_path.read_bytes() != receipt_bytes:
        raise ValueError("Capacity artifact changed during verification")
    if verb == "capacity-record":
        save(metadata_path, capacity_metadata(receipt_bytes, **expected))
    else:
        # Deterministic proof bytes alone join the input fingerprint; workflow
        # identity metadata stays outside it. Every consumer verifies its own
        # installed source/table/runtime before making this receipt available.
        destination = ROOT / "mcp" / "capacity_verification.json"
        temporary = destination.with_suffix(".json.tmp")
        temporary.write_bytes(receipt_bytes)
        os.replace(temporary, destination)
    print("Actual-runtime all-family capacity proof accepted for this exact attempt")
    return 0


def main():
    def interrupted(signum, _frame):
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="verb", required=True)
    run = sub.add_parser("run")
    run.add_argument("component", choices=COMPONENTS)
    run.add_argument("--out", required=True)
    check = sub.add_parser("aggregate")
    check.add_argument("directory")
    check.add_argument("--out", required=True)
    for verb in ("capacity-record", "capacity-accept"):
        command = sub.add_parser(verb)
        command.add_argument("directory")
    a = ap.parse_args()
    if a.verb.startswith("capacity-"):
        return capacity_artifact(a.verb, a.directory)
    if a.verb == "run":
        return run_component(a.component, a.out)
    records = [json.loads(p.read_text()) for p in Path(a.directory).rglob("*.json")]
    result = aggregate(records, commit=os.environ["GITHUB_SHA"], repository=os.environ["GITHUB_REPOSITORY"],
                       run_id=int(os.environ["GITHUB_RUN_ID"]), run_attempt=int(os.environ["GITHUB_RUN_ATTEMPT"]), names=inventory())
    save(a.out, result)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError) as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        raise SystemExit(1)
