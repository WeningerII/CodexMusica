#!/usr/bin/env python3
"""Tests for select_capacity_shards.py on recorded and constructed API responses.

The base case is the real partial re-run, run 41352566807: attempt 2 re-ran
pole and rest only, and GitHub lists upper and middle under attempt 2 with new
job ids and run_attempt 2 but attempt 1's timestamps.
"""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import select_capacity_shards as sel  # noqa: E402
import merge_lyrics_capacity as merger  # noqa: E402

FIX = HERE / 'fixtures' / 'capacity_rerun_41352566807'
REPO, RUN, SHA = 'WeningerII/CodexMusica', 41352566807, '5d052e77c1cb5c6e49c6ef1904432590891b5c06'
SHARDS = ['pole', 'upper', 'middle', 'rest']


def recorded():
    """-> {'attempts': {n: meta}, 'jobs': {n: [job]}, 'artifacts': [artifact]}"""
    load = lambda name: json.loads((FIX / name).read_text())
    return {'attempts': {1: load('attempt1.json'), 2: load('attempt2.json')},
            'jobs': {1: load('jobs1.json')['jobs'], 2: load('jobs2.json')['jobs']},
            'artifacts': load('artifacts.json')['artifacts']}


def fetcher(api, page_size=100, short=False):
    """A fetch over `api`, paginated like GitHub; `short` loses the last item."""
    base = f'/repos/{REPO}/actions/runs/{RUN}'
    calls = []

    def page_of(items, query, key):
        params = dict(part.split('=') for part in query.split('&'))
        size, page = min(int(params['per_page']), page_size), int(params['page'])
        shown = items[:-1] if short else items
        return {'total_count': len(items), key: shown[(page - 1) * size: page * size]}

    def fetch(path):
        calls.append(path)
        route, _, query = path.partition('?')
        rest = route[len(base):]
        if rest == '/artifacts':
            return page_of(api['artifacts'], query, 'artifacts')
        parts = rest.strip('/').split('/')
        if parts[:1] == ['attempts'] and len(parts) == 2:
            return api['attempts'][int(parts[1])]
        if parts[:1] == ['attempts'] and parts[2:] == ['jobs']:
            return page_of(api['jobs'][int(parts[1])], query, 'jobs')
        raise AssertionError(f'unexpected path {path}')
    fetch.calls = calls
    return fetch


def downloaded(tmp, api, corrupt=()):
    """Write one folder per artifact, as download-artifact does without merge-multiple."""
    root = Path(tmp) / 'downloaded'
    for art in api['artifacts']:
        name = art['name']
        if not name.startswith('lyrics-capacity-'):
            continue
        shard = name.split('-')[2]
        folder = root / name
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f'capacity-{shard}.json').write_text(
            '{not json' if name in corrupt else json.dumps({'from': name}))
    return root


def job(name, attempt, start, end, conclusion='success', status='completed', ident=None):
    return {'id': ident or hash((name, attempt, start)) % 10**9, 'run_id': RUN, 'run_attempt': attempt,
            'name': f'capacity-matrix / cells {name}', 'status': status, 'conclusion': conclusion,
            'started_at': start, 'completed_at': end}


def artifact(name, ident, run=RUN, sha=SHA, expired=False):
    return {'id': ident, 'name': name, 'expired': expired, 'workflow_run': {'id': run, 'head_sha': sha}}


def ladder(n):
    """`n` attempts, attempt k starting at hour k; every shard ran in attempt 1 and passed."""
    api = {'attempts': {}, 'jobs': {}, 'artifacts': []}
    for k in range(1, n + 1):
        api['attempts'][k] = {'id': RUN, 'run_attempt': k, 'head_sha': SHA,
                              'run_started_at': f'2026-11-01T{k:02d}:00:00Z', 'status': 'completed'}
        api['jobs'][k] = [job(s, k, '2026-11-01T01:00:05Z', '2026-11-01T01:30:00Z') for s in SHARDS]
    api['artifacts'] = [artifact(f'lyrics-capacity-{s}-1', 100 + i) for i, s in enumerate(SHARDS)]
    return api


def rerun(api, shard, attempt, conclusion='success', status='completed', upload=True):
    """Re-execute `shard` in `attempt`; every later attempt inherits that execution."""
    hour = int(api['attempts'][attempt]['run_started_at'][11:13])
    fresh = job(shard, attempt, f'2026-11-01T{hour:02d}:00:05Z', f'2026-11-01T{hour:02d}:30:00Z',
                conclusion, status)
    for k in api['jobs']:
        if k >= attempt:
            api['jobs'][k] = [j for j in api['jobs'][k] if not j['name'].endswith(f'cells {shard}')]
            api['jobs'][k].append({**fresh, 'id': fresh['id'] + k, 'run_attempt': k})
    if upload:
        api['artifacts'].append(artifact(f'lyrics-capacity-{shard}-{attempt}', 1000 + attempt))
    return api


class Select(unittest.TestCase):
    def run_select(self, api, attempt=None, corrupt=(), **fetch_options):
        attempt = attempt or max(api['attempts'])
        with tempfile.TemporaryDirectory() as tmp:
            root = downloaded(tmp, api, corrupt)
            return sel.select(fetcher(api, **fetch_options), REPO, RUN, attempt, SHA, SHARDS, root)

    def refuses(self, api, needle, **kwargs):
        with self.assertRaises(sel.Refusal) as caught:
            self.run_select(api, **kwargs)
        self.assertIn(needle, str(caught.exception))

    # --- the recorded partial re-run ---------------------------------------
    def test_recorded_partial_rerun_takes_each_shards_executing_attempt(self):
        got = {p['shard']: p for p in self.run_select(recorded())}
        self.assertEqual({s: got[s]['executed_attempt'] for s in SHARDS},
                         {'pole': 2, 'rest': 2, 'upper': 1, 'middle': 1})
        self.assertEqual({s: got[s]['artifact'] for s in SHARDS},
                         {'pole': 'lyrics-capacity-pole-2', 'rest': 'lyrics-capacity-rest-2',
                          'upper': 'lyrics-capacity-upper-1', 'middle': 'lyrics-capacity-middle-1'})
        # The inherited listing's id and run_attempt are not the execution's.
        self.assertEqual(got['upper']['lookup_job_id'], 125001935371)
        self.assertEqual(got['upper']['execution_job_id'], 124985732599)
        self.assertEqual(got['middle']['execution_job_id'], 124985732593)
        self.assertEqual(got['pole']['lookup_job_id'], got['pole']['execution_job_id'])

    def test_recorded_attempt_one_refuses_its_failed_shards(self):
        self.refuses(recorded(), 'failure, not completed/success', attempt=1)

    # --- full and partial re-runs, constructed -----------------------------
    def test_full_rerun_takes_the_new_attempt_for_every_shard(self):
        api = ladder(2)
        for s in SHARDS:
            rerun(api, s, 2)
        self.assertEqual({p['executed_attempt'] for p in self.run_select(api)}, {2})

    def test_missing_shard_job_refuses(self):
        api = ladder(1)
        api['jobs'][1] = [j for j in api['jobs'][1] if not j['name'].endswith('cells rest')]
        self.refuses(api, '0 jobs named "cells rest"')

    def test_newer_failure_does_not_fall_back_to_older_success(self):
        self.refuses(rerun(ladder(2), 'pole', 2, conclusion='failure'), 'shard pole')

    def test_newer_cancelled_or_incomplete_execution_refuses(self):
        self.refuses(rerun(ladder(2), 'pole', 2, conclusion='cancelled'), 'cancelled')
        self.refuses(rerun(ladder(2), 'pole', 2, conclusion=None, status='in_progress'), 'in_progress')

    def test_newer_execution_without_artifact_refuses(self):
        self.refuses(rerun(ladder(2), 'pole', 2, upload=False), '0 artifacts named lyrics-capacity-pole-2')

    def test_artifact_listed_but_not_downloaded_refuses(self):
        api = ladder(1)
        with tempfile.TemporaryDirectory() as tmp:
            root = downloaded(tmp, api)
            (root / 'lyrics-capacity-upper-1' / 'capacity-upper.json').unlink()
            with self.assertRaises(sel.Refusal) as caught:
                sel.select(fetcher(api), REPO, RUN, 1, SHA, SHARDS, root)
        self.assertIn('was not downloaded', str(caught.exception))

    def test_duplicate_artifacts_or_jobs_refuse(self):
        api = ladder(1)
        api['artifacts'].append(artifact('lyrics-capacity-pole-1', 999))
        self.refuses(api, '2 artifacts named lyrics-capacity-pole-1')
        api = ladder(1)
        api['jobs'][1].append(job('pole', 1, '2026-11-01T01:00:06Z', '2026-11-01T01:31:00Z'))
        self.refuses(api, '2 jobs named "cells pole"')

    def test_mismatched_provenance_refuses(self):
        api = ladder(1)
        api['artifacts'][0] = artifact('lyrics-capacity-pole-1', 100, run=RUN + 1)
        self.refuses(api, f'comes from run {RUN + 1}')
        api = ladder(1)
        api['artifacts'][0] = artifact('lyrics-capacity-pole-1', 100, sha='0' * 40)
        self.refuses(api, 'not run')
        api = ladder(2)
        api['attempts'][2]['head_sha'] = '0' * 40
        self.refuses(api, f'attempt 2 ran {"0" * 40}')
        api = ladder(1)
        api['attempts'][1]['run_attempt'] = 3
        self.refuses(api, 'metadata names run')
        api = ladder(1)
        api['artifacts'][0] = artifact('lyrics-capacity-pole-1', 100, expired=True)
        self.refuses(api, 'has expired')

    def test_attempt_ten_against_nine_is_numeric(self):
        api = ladder(10)
        rerun(api, 'pole', 9)
        rerun(api, 'upper', 10)
        api['artifacts'].append(artifact('lyrics-capacity-pole-10', 4242))  # stale-looking name, never chosen
        api['artifacts'].append(artifact('lyrics-capacity-upper-9', 4343))
        got = {p['shard']: p['artifact'] for p in self.run_select(api)}
        self.assertEqual(got, {'pole': 'lyrics-capacity-pole-9', 'upper': 'lyrics-capacity-upper-10',
                               'middle': 'lyrics-capacity-middle-1', 'rest': 'lyrics-capacity-rest-1'})

    # --- contradictory or ambiguous metadata --------------------------------
    def test_intermediate_attempt_with_a_different_execution_refuses(self):
        api = ladder(3)
        api['jobs'][2] = [dict(j, started_at='2026-11-01T02:00:05Z') if j['name'].endswith('cells rest') else j
                          for j in api['jobs'][2]]
        self.refuses(api, 'attempt 2 lists a different execution')

    def test_inherited_record_contradicting_success_refuses(self):
        """Same timestamps as attempt 1's passing execution, but a later record
        says it did not succeed: contradictory, so refuse, never use pole-1."""
        def contradict(api, k, **change):
            api['jobs'][k] = [dict(j, **change) if j['name'].endswith('cells pole') else j
                              for j in api['jobs'][k]]
            return api
        self.refuses(contradict(ladder(2), 2, conclusion='failure'), 'recorded in attempt 2')
        self.refuses(contradict(ladder(2), 2, conclusion='cancelled'), 'cancelled')
        self.refuses(contradict(ladder(2), 2, status='in_progress', conclusion=None), 'in_progress')
        self.refuses(contradict(ladder(3), 2, conclusion='failure'), 'recorded in attempt 2')
        # The recorded partial re-run's inherited records really are success.
        api = recorded()
        contradict(api, 2, conclusion='failure')
        self.refuses(api, 'shard pole')

    def test_start_outside_every_attempt_or_missing_timestamps_refuse(self):
        api = ladder(2)
        for k in (1, 2):
            api['jobs'][k] = [dict(j, started_at='2026-11-01T00:59:00Z') if j['name'].endswith('cells pole') else j
                              for j in api['jobs'][k]]
        self.refuses(api, 'falls in no single attempt')
        api = ladder(1)
        api['jobs'][1][0]['completed_at'] = None
        self.refuses(api, 'has no timestamp')
        api = ladder(1)
        api['jobs'][1][0]['completed_at'] = '2026-11-01T00:00:00Z'
        self.refuses(api, 'ended before it started')

    def test_attempts_out_of_order_refuse(self):
        api = ladder(2)
        api['attempts'][2]['run_started_at'] = api['attempts'][1]['run_started_at']
        self.refuses(api, 'did not start after attempt 1')

    def test_pagination_reads_every_page_and_refuses_a_short_read(self):
        api = ladder(1)
        got = self.run_select(api, page_size=1)
        self.assertEqual(len(got), 4)
        self.refuses(api, 'read 3 of 4', short=True)


class Workflow(unittest.TestCase):
    def test_merge_uses_the_selector_and_reads_every_attempt(self):
        text = (HERE.parent / '.github' / 'workflows' / 'capacity-matrix.yml').read_text()
        merge = text[text.index('\n  merge:'):]
        self.assertIn('pattern: lyrics-capacity-*-*', merge)
        self.assertNotIn('lyrics-capacity-*-${{ github.run_attempt }}', merge)
        self.assertNotIn('merge-multiple: true', merge)
        self.assertIn('scripts/select_capacity_shards.py', merge)
        self.assertIn('actions: read', merge)
        self.assertIn('--provenance=', merge)
        caller = (HERE.parent / '.github' / 'workflows' / 'production-qualification.yml').read_text()
        call = caller[caller.index('\n  capacity-matrix:'):caller.index('\n  capacity-matrix-result:')]
        self.assertIn('actions: read', call)


class Merge(unittest.TestCase):
    def test_corrupt_selected_shard_is_refused_by_the_unchanged_merger(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / 'capacity-pole.json'
            bad.write_text('{not json')
            self.assertEqual(merger.main([str(bad), '--out', str(Path(tmp) / 'out.json')]), 2)

    def test_unreadable_provenance_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            shard = Path(tmp) / 'capacity-pole.json'
            shard.write_text('{}')
            missing = Path(tmp) / 'nope.json'
            self.assertEqual(merger.main([str(shard), '--out', str(Path(tmp) / 'o.json'),
                                          f'--provenance={missing}']), 2)


if __name__ == '__main__':
    unittest.main()
