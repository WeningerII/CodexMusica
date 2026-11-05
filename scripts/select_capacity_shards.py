#!/usr/bin/env python3
"""Pick, for each capacity shard, the evidence from the attempt that ran it.

WHY THIS EXISTS. Each shard uploads `lyrics-capacity-<shard>-<run_attempt>`.
The merge used to download only the current attempt's artifacts, so a
"Re-run failed jobs" could never pass: the shards that were not re-run keep
their earlier attempt's artifact, and the merge refused for want of it (run
41352566807 attempt 2: all four shards under the ceiling, merge REFUSED on a
missing capacity-upper.json).

WHAT DECIDES THE ATTEMPT. Not a job's `run_attempt` and not its id: in a
partial re-run GitHub lists the shards it did not re-run under the new attempt,
with a new job id and `run_attempt` set to the new attempt, but with the
`started_at`/`completed_at` of the attempt that really ran them (recorded in
scripts/fixtures/capacity_rerun_41352566807/). So the attempt that executed a
shard is the one whose `run_started_at` window contains the job's
`started_at`, and that attempt's own job list must hold the same job, with the
same name and timestamps. Every later attempt must list it unchanged.

IT FAILS CLOSED. Missing or contradictory metadata, an ambiguous match, an
execution that did not succeed, and a missing, duplicated or foreign artifact
are each a refusal that names the shard. It never falls back to an older
attempt: a shard re-run in attempt N answers with attempt N's artifact or not
at all. When the metadata cannot be read, a full re-run is the way forward.

The selected files are copied to --out-dir unchanged, so the merger validates
their payload exactly as before; --provenance records which execution and
which artifact each one came from.
"""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import shutil
import sys
import urllib.request

FULL_RERUN = 're-run all jobs of this workflow run'


class Refusal(Exception):
    pass


def when(value, what):
    """-> datetime for an API timestamp, or a refusal naming what lacked one."""
    if not isinstance(value, str) or not value:
        raise Refusal(f'{what} has no timestamp')
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise Refusal(f'{what} has an unreadable timestamp {value!r}') from None


def http_fetch(api, token):
    def fetch(path):
        request = urllib.request.Request(f'{api}{path}', headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'Bearer {token}',
            'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    return fetch


def paged(fetch, path, key):
    """Every item of a paginated list, or a refusal if the count never closes."""
    items, page = [], 1
    while True:
        body = fetch(f'{path}{"&" if "?" in path else "?"}per_page=100&page={page}')
        batch, total = body.get(key), body.get('total_count')
        if not isinstance(batch, list) or not isinstance(total, int):
            raise Refusal(f'{path}: response has no {key} list and total_count')
        items += batch
        if len(items) >= total or not batch:
            break
        page += 1
    if len(items) != total:
        raise Refusal(f'{path}: read {len(items)} of {total} {key}')
    return items


def shard_job(jobs, shard, where):
    """The one job running `cells <shard>` in a job list (caller prefix allowed)."""
    pattern = re.compile(rf'(^|/ )cells {re.escape(shard)}$')
    found = [job for job in jobs if pattern.search(job.get('name') or '')]
    if len(found) != 1:
        raise Refusal(f'shard {shard}: {len(found)} jobs named "cells {shard}" in {where}')
    return found[0]


def select(fetch, repo, run_id, attempt, sha, shards, artifacts_dir):
    """-> provenance list, one entry per shard, in `shards` order."""
    base = f'/repos/{repo}/actions/runs/{run_id}'
    starts, jobs = {}, {}
    for a in range(1, attempt + 1):
        meta = fetch(f'{base}/attempts/{a}')
        if meta.get('id') != run_id or meta.get('run_attempt') != a:
            raise Refusal(f'attempt {a}: metadata names run {meta.get("id")} attempt {meta.get("run_attempt")}')
        if meta.get('head_sha') != sha:
            raise Refusal(f'attempt {a} ran {meta.get("head_sha")}, not {sha}')
        starts[a] = when(meta.get('run_started_at'), f'attempt {a}')
        if a > 1 and not starts[a] > starts[a - 1]:
            raise Refusal(f'attempt {a} did not start after attempt {a - 1}')
        jobs[a] = paged(fetch, f'{base}/attempts/{a}/jobs', 'jobs')
        for job in jobs[a]:
            if job.get('run_id') not in (None, run_id):
                raise Refusal(f'attempt {a} lists job {job.get("id")} of run {job.get("run_id")}')

    artifacts = paged(fetch, f'{base}/artifacts', 'artifacts')
    provenance = []
    for shard in shards:
        lookup = shard_job(jobs[attempt], shard, f'attempt {attempt}')
        started = when(lookup.get('started_at'), f'shard {shard} job {lookup.get("id")} start')
        completed = when(lookup.get('completed_at'), f'shard {shard} job {lookup.get("id")} end')
        if completed < started:
            raise Refusal(f'shard {shard}: job {lookup.get("id")} ended before it started')
        ran = [a for a in starts if starts[a] <= started and (a == attempt or started < starts[a + 1])]
        if len(ran) != 1:
            raise Refusal(f'shard {shard}: its start {lookup["started_at"]} falls in no single attempt')
        ran = ran[0]
        # Every record from the executing attempt to the current one must
        # describe the same execution AND agree that it succeeded: one that
        # keeps the timestamps but says failed, cancelled or running is
        # contradictory metadata, never a licence to use the older artifact.
        for a in range(ran, attempt + 1):
            same = shard_job(jobs[a], shard, f'attempt {a}')
            if (same.get('started_at'), same.get('completed_at')) != (lookup['started_at'], lookup['completed_at']):
                raise Refusal(f'shard {shard}: attempt {a} lists a different execution '
                              f'({same.get("started_at")}..{same.get("completed_at")}) than attempt {attempt} '
                              f'({lookup["started_at"]}..{lookup["completed_at"]})')
            if same.get('status') != 'completed' or same.get('conclusion') != 'success':
                raise Refusal(f'shard {shard}: its latest execution (attempt {ran}) is recorded in attempt {a} '
                              f'as job {same.get("id")}, {same.get("status")}/{same.get("conclusion")}, '
                              f'not completed/success')
        execution = shard_job(jobs[ran], shard, f'attempt {ran}')

        name = f'lyrics-capacity-{shard}-{ran}'
        named = [art for art in artifacts if art.get('name') == name]
        if len(named) != 1:
            raise Refusal(f'shard {shard}: {len(named)} artifacts named {name} in run {run_id}')
        artifact = named[0]
        if artifact.get('expired'):
            raise Refusal(f'shard {shard}: artifact {name} has expired')
        origin = artifact.get('workflow_run') or {}
        if origin.get('id') != run_id or origin.get('head_sha') != sha:
            raise Refusal(f'shard {shard}: artifact {name} comes from run {origin.get("id")} '
                          f'at {origin.get("head_sha")}, not run {run_id} at {sha}')
        source = Path(artifacts_dir) / name / f'capacity-{shard}.json'
        if not source.is_file():
            raise Refusal(f'shard {shard}: {source} was not downloaded')
        provenance.append({
            'shard': shard, 'executed_attempt': ran,
            'execution_job_id': execution.get('id'), 'lookup_job_id': lookup.get('id'),
            'lookup_attempt': attempt, 'started_at': lookup['started_at'],
            'completed_at': lookup['completed_at'], 'artifact': name,
            'artifact_id': artifact.get('id'), 'file': str(source)})
    return provenance


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--repo', required=True)
    ap.add_argument('--run-id', type=int, required=True)
    ap.add_argument('--attempt', type=int, required=True)
    ap.add_argument('--sha', required=True)
    ap.add_argument('--shards', required=True, help='comma-separated shard names')
    ap.add_argument('--artifacts-dir', required=True, help='one folder per downloaded artifact')
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--provenance', required=True)
    args = ap.parse_args(argv)
    shards = [s for s in args.shards.split(',') if s]
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        print(f'REFUSED — no GITHUB_TOKEN to read this run\'s attempts; {FULL_RERUN}', file=sys.stderr)
        return 2
    fetch = http_fetch(os.environ.get('GITHUB_API_URL', 'https://api.github.com'), token)
    try:
        if args.attempt < 1 or len(set(shards)) != len(shards) or not shards:
            raise Refusal(f'attempt {args.attempt} and shards {shards} do not describe a matrix')
        provenance = select(fetch, args.repo, args.run_id, args.attempt, args.sha, shards, args.artifacts_dir)
    except Refusal as error:
        print(f'REFUSED — {error}; {FULL_RERUN}', file=sys.stderr)
        return 2
    except (OSError, ValueError) as error:
        print(f'REFUSED — reading this run\'s attempts failed: {error}; {FULL_RERUN}', file=sys.stderr)
        return 2
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for entry in provenance:
        shutil.copyfile(entry['file'], out / f'capacity-{entry["shard"]}.json')
    Path(args.provenance).write_text(json.dumps({
        'run_id': args.run_id, 'attempt': args.attempt, 'head_sha': args.sha,
        'shards': provenance}, indent=2, sort_keys=True) + '\n')
    for entry in provenance:
        print(f'{entry["shard"]}: attempt {entry["executed_attempt"]} job {entry["execution_job_id"]} '
              f'artifact {entry["artifact"]} ({entry["artifact_id"]})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
