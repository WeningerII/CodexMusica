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
    # baseline (see production-qualification.yml's `mutation-baseline` job)
    # takes OUT of every shard, which is the change that should make the bound
    # comfortable rather than the bound itself. If a shard hits 14,400 too, the
    # answer is not 16,000 -- it is that the shard is too big, and the sweep's
    # own comment already says a shard count cannot fix that while every shard
    # pays the whole-tree baseline.
    if component in COMPONENTS[:4]:
        return ["quality/test_mutation.py", f"--shard={component[-1]}/4"], 14400
    # `song` MOVED 9000 -> 14400 ON 2026-09-10 AND `short` DID NOT, because the
    # two run the same command over different fractions of the corpus.
    # `PROFILE_PRED_MAX` is `{"song": None, "short": 200}` -- song "caps
    # nothing", in that table's own words, so it scores every item on the check
    # the module says costs 96% of a cold run. The 8,758.6 CPU-s in
    # ci.yml:3090-3099 was measured on THIS command (`song_profile_calibration
    # .py --check`, run 33305249323, `hits 4, misses 8663`), so 9,000 was
    # **1.03x a measured cost** -- and this file already rejected that shape
    # twice, at "146 of 150 minutes is not headroom" and at the CI guard that
    # fired on a fully green run. `short` stays at 9,000: MEASURED over the
    # banked rows at quality/results/production_data_2026-09-08/, 5,432 of
    # 8,545 items are <= 200 tokens, so its predictability arm is 63.6% of
    # song's, ~5,570 s, and 9,000 is 1.62x -- the same headroom 14,400 gives
    # the uncapped ones.
    #
    # NOT WAITING TO BE BITTEN, AND THAT IS A DEPARTURE WORTH NAMING. The
    # mutation repin above moved only after a run hit 12,001 s, on the rule
    # that a bound a run has hit is a measured floor. Nothing has yet hit
    # 9,000 here. The measurement that matters already exists and was taken on
    # this exact command; qualification run 34436960370 had `song` running on a
    # provably cold memo (M-264) toward that bound while this was written, and
    # a budget known to be 1.03x is a defect whether or not the next run is
    # unlucky enough to prove it.
    if component == "song":
        return ["quality/song_profile_calibration.py", "--check", "--profile=song", "--seeds=200", "--draws=2000"], 14400
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
    # 14,400 IS THE MEASURED COLD COST PLUS HEADROOM, NOT A ROUND NUMBER.
    # ci.yml:3090-3099 carries the measurement and the two times it was wrong
    # before: the 2026-08-30 nightly (run 33305249323) DISCARDED its memo on a
    # fingerprint move and recomputed the whole corpus, and its own PHASE COST
    # table reads `hits 4, misses 8663`, population 8,718.7 CPU-s, TOTAL
    # 8,758.6 CPU-s, with the step taking 8,764 s -- ~1.0 CPU-s per item over
    # 8,667 items. 14,400 is 1.64x that. The two superseded figures (2.0-2.2
    # CPU-hours over a 4,930-item corpus; ~18 CPU-hours from a rate read over
    # two flush intervals and multiplied out) are why this cites a run's table
    # rather than a rate.
    #
    # FOUR ONE-PROCESS COLD READINGS BRACKET 6,506-9,072 CPU-s, and 14,400 is
    # 1.59x-2.21x that: ci.yml's TOTAL 8,758.6 above (run 33305249323); the
    # band cell's 9,072 for the same arm (`quality/RESULTS_SONG_FLOOR.md`);
    # ~8,450 (`quality/RESULTS_CACHE_IDENTITY.md`); and the most recent, CI run
    # 34413319893's `population 6,505.6`.
    #
    # THAT LAST ONE LOOKS WARM AND IS NOT, WHICH IS THE WHOLE READING. Its step
    # printed `memo: 8663 -> 8545 items (+-118 banked this run)`, and ci.yml's
    # own shell is `"memo: $before -> $after items (+$((after - before)) ..."`,
    # so that is a DECREASE of 118 and the `+-` is the format, not a typo. A
    # memo cannot shrink: `PredictabilityCache.put` only assigns. It shrinks
    # only when `open()` DISCARDED the file and `flush()` rewrote it with
    # exactly what that run computed. So the nightly restored 8,663 accumulated
    # entries, threw them away on a moved comparator fingerprint, and paid a
    # full cold corpus -- which is this defect's twin sitting in the log that
    # was supposed to be the remedy for it.
    #
    # DO NOT AVERAGE THE FOUR-SHARD FIGURE IN WITH THOSE. An earlier draft of
    # this comment called stage B's 4,854 + 5,892 + 4,348 + 5,229 = 20,323
    # CPU-s a third reading that "agrees on ~1.0 CPU-s per item". It does not:
    # 20,323 over 8,545 items is 2.38, and §8 says why in the same sentence --
    # "each shard warms its own end-word memo". It is a reading of a DIFFERENT
    # workload and belongs only in the sharding argument below.
    #
    # AND THE COST UNIT IS NOT THE ITEM, WHICH IS WHY PER-ITEM RATES DISAGREE.
    # `RhymeField.field()` memoises per distinct call word in `self._cache`
    # (quality/features.py:277, 283-304), in-process, so the marginal cost of
    # an item falls as the run saturates the vocabulary -- roughly 10.6 CPU-s
    # per item over the first few dozen against ~0.76 averaged over the whole
    # corpus. Any rate read off the FRONT of a cold run and multiplied out is
    # high by several times, which is the 2026-08-20 mistake ci.yml records
    # ("a RATE read over two flush intervals and multiplied out"). This is the
    # same trap one axis over, and it is why the bound below is set from
    # completed runs only.
    #
    # WHY NOT SHARD IT INSTEAD, AND THE ANSWER IS THAT SOMEBODY ALREADY DID.
    # `compute --shard i/K` + `check --rows` exists, and `read_rows(verify=
    # True)` refuses a missing, duplicated or mixed-K set by name, so a K-way
    # cold population is buildable and was built. §8 above is what it cost:
    # 20,323 CPU-s against ~9,000 for one process -- 2.3x the CPU, "because
    # each shard warms its own end-word memo" -- for 7,276 s wall on four
    # SHARED cores. On four separate runners the win is the largest shard,
    # 5,892 s against 8,764: a third off the wall, for 2.3x the compute, a new
    # job, an artifact per shard, and a reduction. And it would trade a check
    # that re-derives all 8,667 items in one process for one that trusts K
    # saved TSVs. The `component` matrix already budgets 14,400 s per mutation
    # shard, so curves at 14,400 does not extend this run's critical path by a
    # second, and that third of a wall is not spent anywhere.
    #
    # THE TWO READINGS THAT LOOKED LIKE CONTRADICTIONS ARE THE SATURATION CURVE
    # SEEN FROM ITS EXPENSIVE END. M-260 measured a cold run on this project's
    # dev box cut at 3,000 s with 602 items banked (~5 CPU-s each), and
    # qualification run 34436960370 banked ~8.8 KB of memo in 2,400 s where a
    # 0.76 CPU-s average predicts nearer 48 KB. Neither is a slower machine
    # doing the same work: both are the FIRST few percent of a run, where the
    # word cache is empty and almost every end word is a miss. In the invariant
    # unit -- CPU-s per DISTINCT call word -- they agree with the completed
    # runs. So the earlier note here calling that gap UNEXPLAINED is withdrawn;
    # it is explained, and not by the bound being wrong.
    #
    # WHAT THIS STILL DOES NOT DECIDE. (1) Whether 14,400 holds on a slow
    # runner: the four readings above span 1.4x between themselves, so a bad
    # draw plus corpus growth could close 1.59x. production-qualification.yml
    # now prints the memo line count AFTER the component as well as before, so
    # the next run measures the rate rather than leaving it to a ratio of two
    # compressed sizes (doctrine 58). If it is not enough the answer is the
    # shard below, not 20,000. (2) `song_profile_calibration.py` pins "11,941
    # distinct call words" and does arithmetic on it in the same docstring; a
    # sweep during this work put the true count near 17,630. NOT REPINNED HERE
    # and NOT independently confirmed: that is a set of derived figures across
    # a docstring and two modules (doctrine 58), and it is not a change to make
    # in the middle of a production drive.
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
