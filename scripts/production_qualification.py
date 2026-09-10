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
    # THE MUTATION BUDGET MOVED 12000 -> 14400 ON 2026-09-10, AND IT IS THE ONE
    # NUMBER HERE THAT A RUN HAS ACTUALLY DISPROVED. Production-qualification
    # run 34404281269 killed `qualification-mutation-4` at 12,001 s against
    # 12,000 -- `run_component` sets 124 on TimeoutExpired, and that shard is
    # the only one of the four that got it. Its siblings finished inside the
    # bound and failed for a different reason entirely (M-262). A bound a run
    # has hit is not an allowance any more; it is a measured floor, and the
    # floor is above 12,000.
    #
    # HOW MUCH ABOVE IS NOT KNOWN, WHICH IS WHAT A TIMEOUT COSTS YOU: a killed
    # run reports where it stopped, never what it needed. So this is not a
    # fitted number. It is the old one plus the 2,400 s that the shared
    # baseline (the `mutation-baseline` job -- STRUCK the same day it shipped,
    # and production-qualification.yml's head comment carries the disproof)
    # takes OUT of every shard, which is the change that should make the bound
    # comfortable rather than the bound itself. If a shard hits 14,400 too, the
    # answer is not 16,000 -- it is that the shard is too big, and the sweep's
    # own comment already says a shard count cannot fix that while every shard
    # pays the whole-tree baseline.
    if component in COMPONENTS[:4]:
        return ["quality/test_mutation.py", f"--shard={component[-1]}/4"], 14400
    # `song` WAS MOVED 9000 -> 14400 ON 2026-09-10 AND MOVED STRAIGHT BACK THE
    # SAME MORNING, BECAUSE A RUN MEASURED IT WHILE THE CHANGE WAS IN FLIGHT.
    #
    # ~~The argument was: `PROFILE_PRED_MAX` is `{"song": None, "short": 200}`,
    # so song caps nothing and scores every item on the check the module says
    # costs 96% of a cold run; ci.yml's 8,758.6 CPU-s was measured on
    # `song_profile_calibration.py --check`; therefore 9,000 was 1.03x a
    # measured cost.~~ The premise that the 8,758.6 s figure TRANSFERS to this
    # invocation was an inference, and it is now falsified.
    #
    # MEASURED, qualification run 34436960370 at ab5db477, on a PROVABLY COLD
    # memo (its restore missed -- that is M-264 -- and the job logged
    # `predictability memo: 0 line(s)`): `qualification-song` COMPLETED in
    # **4,847 s**, and `qualification-short` in **4,281 s**. So 9,000 was
    # 1.86x, not 1.03x, and this file's own standard (it rejected 1.03x and
    # 1.28x, and accepts ~1.6x) is comfortably met without moving anything.
    #
    # AND THE 1.13x RATIO BETWEEN THEM IS THE SATURATION CURVE AGAIN, not an
    # anomaly. `short` scores 63.6% of the items and `song` 100%, so a
    # per-item cost model predicts 1.57x. It came out 1.13x because the 36.4%
    # of items `song` adds are the LONGEST ones, reached late, when the
    # in-process word cache is already warm and their marginal cost is near
    # the floor.
    #
    # `curves` DOES NOT GET THE SAME TREATMENT, AND THE ASYMMETRY IS THE POINT.
    # `song` has now completed cold and reported a number. `curves` never has:
    # every attempt was killed at 2,400 s mid-population. M-263 records what
    # that costs -- "a killed run reports where it stopped, never what it
    # needed" -- so its bound below is set GENEROUSLY ON PURPOSE, to buy a
    # completed run and a real figure rather than a fourth reading of where a
    # kill landed. `song`'s 4,847 s is the best available proxy for the
    # population phase they share; the curve fit on top of it is unmeasured.
    # When `curves` completes, that measurement is what should size it, and
    # 14,400 should come down.
    if component == "song":
        return ["quality/song_profile_calibration.py", "--check", "--profile=song", "--seeds=200", "--draws=2000"], 9000
    if component == "short":
        return ["quality/song_profile_calibration.py", "--check", "--profile=short", "--seeds=200", "--draws=2000"], 9000
    # THE CURVES BUDGET MOVED 2400 -> 14400 ON 2026-09-10, AND 2,400 WAS NEVER
    # A BUDGET FOR THE WORK THIS COMPONENT DOES. production-qualification.yml
    # said so in its own words -- "THE BUDGETS BELOW ARE WARM-MEMO BUDGETS" --
    # and `curves` is the one component whose warm memo could not arrive: the
    # nightly banks it under a one-entry `path:` list and the qualification
    # restored under a two-entry one, which actions/cache hashes into a
    # different cache VERSION (M-264). So every qualification of every new SHA
    # ran this command cold against a bound sized for a hit.
    #
    # THIS PARAGRAPH WAS DELETED BY ACCIDENT AND IS RESTORED (doctrine 17): the
    # commit that withdrew the `song` repin replaced a text range that reached
    # past its own subject and took the whole curves rationale with it, leaving
    # a bound with no recorded reason in the file that decides it. MISSING.md
    # M-264 kept the record; this is the file that has to carry it.
    #
    # FOUR ONE-PROCESS COLD READINGS BRACKET 6,506-9,072 CPU-s, and 14,400 is
    # 1.59x-2.21x that: ci.yml:3090-3099's TOTAL 8,758.6 (run 33305249323);
    # the band cell's 9,072 for the same arm (`quality/RESULTS_SONG_FLOOR.md`);
    # ~8,450 (`quality/RESULTS_CACHE_IDENTITY.md`); and CI run 34413319893's
    # `population 6,505.6`. `qualification-song` then completed cold in 4,847 s
    # on a real runner, which is the lowest reading yet and the closest in
    # shape -- it shares `population()` with this command.
    #
    # THAT NIGHTLY READING LOOKS WARM AND IS NOT, AND ITS LOG SAYS SO IN WORDS.
    # It was first deduced from `memo: 8663 -> 8545 items (+-118 banked this
    # run)` against ci.yml's shell `"memo: $before -> $after items ..."` -- a
    # DECREASE, and a memo cannot shrink because `PredictabilityCache.put`
    # only assigns. The deduction was right and it did not need to be one: job
    # 102678019020 prints `DISCARDED: comparator fingerprint moved ...
    # recomputing from scratch`, then `hits 0, misses 8545`, then `population
    # 6505.6 6505.3 ... TOTAL 6538.0 6537.8`. The nightly restored 8,663
    # accumulated entries, threw them away on a moved comparator fingerprint,
    # and paid a full cold corpus -- M-264's twin defect, stated outright, in
    # the log of the run that was supposed to be the remedy for it.
    #
    # DO NOT AVERAGE THE FOUR-SHARD FIGURE IN WITH THOSE. An earlier draft
    # called stage B's 4,854 + 5,892 + 4,348 + 5,229 = 20,323 CPU-s a reading
    # that "agrees on ~1.0 CPU-s per item". It does not: 20,323 over 8,545
    # items is 2.38, and `RESULTS_LENGTH_CURVE.md` §8 says why in the same
    # sentence -- "each shard warms its own end-word memo". It measures a
    # DIFFERENT workload and belongs only in the sharding argument.
    #
    # WHY NOT SHARD IT, AND THE ANSWER IS THAT SOMEBODY ALREADY DID AND BANKED
    # THE PRICE. `compute --shard i/K` exists and `read_rows(verify=True)`
    # refuses a missing, duplicated or mixed-K set by name, so a K-way cold
    # population is buildable -- §8 IS one. It cost 20,323 CPU-s against
    # ~9,000 for one process. On four separate runners the win is the largest
    # shard, 5,892 s against 8,764: about a third off a wall this run does not
    # spend, for 2.3x the compute, a new job, an artifact per shard, a
    # reduction, and a check that trusts K saved TSVs instead of re-deriving
    # every item in one process. The `component` matrix already budgets 14,400
    # per mutation shard, so curves at 14,400 does not extend the critical
    # path by a second.
    #
    # AND THE COST UNIT IS THE DISTINCT CALL WORD, NOT THE ITEM, WHICH IS WHY
    # PER-ITEM RATES DISAGREE. `RhymeField.field()` memoises per distinct call
    # word in `self._cache` (`quality/features.py`:277, 283-304), in-process,
    # so an item's marginal cost falls as the run saturates the vocabulary --
    # roughly 10.6 CPU-s per item over the first few dozen against ~0.76
    # averaged over the corpus. This project's dev box cut at 3,000 s with 602
    # items, and run 34436960370's ~8.8 KB of memo in 2,400 s, are the FRONT of
    # that curve, not slower machines doing the same work. A rate read off the
    # front and multiplied out is high by several times -- the 2026-08-20
    # mistake ci.yml records ("a RATE read over two flush intervals and
    # multiplied out"), one axis over. The bound is set from COMPLETED runs.
    #
    # WHAT THIS DOES NOT DECIDE. (1) Whether 14,400 holds on a slow runner: the
    # readings span 1.4x between themselves, so a bad draw plus corpus growth
    # could close 1.59x. production-qualification.yml now prints the memo line
    # count AFTER the component as well as before, so the next run measures the
    # rate rather than leaving it to a ratio of two compressed sizes (doctrine
    # 58); if it is not enough the answer is the shard above, not 20,000.
    # (2) Whether `curves` PASSES. A budget buys it the chance to finish, and
    # finishing may well report MOVED (exit 1) rather than HOLDS: `cmd_check`
    # exits 1 when `len(rows)` differs from the profile's `n_human`, and the
    # comparator fingerprint has moved more than once this week. That is a real
    # answer and a different repair; `curves` has still never returned one.
    # (3) NOTHING ABOUT THE 11,941 PIN, and the flag that stood here is
    # WITHDRAWN. A sweep during this work put the distinct-call-word count at
    # 17,630 against that pin and this comment carried it as stale. It is not:
    # `quality/features.py`:532 gates the scan -- `if not self._pronounceable
    # (call) or not self._pronounceable(answer): continue` -- so a word absent
    # from the pronunciation lexicon never reaches `field()` and costs nothing.
    # 6,251 of the 17,630 are in that class, so the COMPARABLE count is 11,379,
    # 4.7% BELOW the pin rather than 48% above it. A raw total was measured
    # against a gated one. Leaving the flag would have sent somebody to repin a
    # figure that is very nearly right, which is worse than saying nothing.
    if component == "curves":
        return ["quality/length_curve_calibration.py", "check"], 14400
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
