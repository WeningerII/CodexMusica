#!/usr/bin/env python3
"""Diagnostic entry point: identical first-search/verification protocol for both images.

Run only through the reviewed same-host experiment. This does not replace the
production qualification entry point or grant production_qualified acceptance.
"""
import os
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlencode
import time
import check_lyrics_capacity as matrix
from lyrics_capacity_runtime import HEALTH_SECONDS, LIBRARY_LOAD_SECONDS, LIBRARY_STORES, library_evidence_failures


# Startup and recovery are distinct fresh server processes. Pin a useful query
# and a long no-match control; neither may silently become an empty browse.
SEARCH_QUERIES = {'library': 'love', 'library_recovery': 'codexmusica612nomatch7c14e59b3a8042f1'}


def search_evidence(key, response):
    query = SEARCH_QUERIES[key]
    if (not isinstance(response, dict) or not isinstance(response.get('snapshot_id'), str)
            or type(response.get('total')) is not int or not isinstance(response.get('items'), list)):
        raise RuntimeError('malformed paired search result')
    if key == 'library' and (response['total'] <= 0 or not response['items']):
        raise RuntimeError('representative query returned no result')
    if key == 'library_recovery' and (response['total'] != 0 or response['items']):
        raise RuntimeError('no-match control unexpectedly matched')
    return {'query': query, 'result_sha256': hashlib.sha256(json.dumps(response,
            sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest(),
            'total': response['total'], 'snapshot_id': response['snapshot_id']}


def fixture_files(root):
    root = Path(root)
    manifest = json.loads((root / 'manifest.json').read_text())
    files = manifest.get('files')
    if not isinstance(files, dict) or not files:
        raise RuntimeError('missing shared fixture inventory')
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p != root / 'manifest.json'}
    if actual != set(files):
        raise RuntimeError('shared fixture inventory differs')
    for name, digest in files.items():
        rel = Path(name)
        if rel.is_absolute() or '..' in rel.parts or (root / rel).is_symlink():
            raise RuntimeError('invalid shared fixture path')
        if hashlib.sha256((root / rel).read_bytes()).hexdigest() != digest:
            raise RuntimeError('shared fixture bytes differ')
    required = {'prepared-runs.json', 'prepared-runs.json.sha256', 'receipts.json'}
    if not required <= set(files) or not any(p.startswith('jobs/') for p in files):
        raise RuntimeError('incomplete shared fixture inventory')
    return files


class PairedRuntime(matrix.ResidentRuntime):
    def _prepare(self, command):
        # Never generate independent random payloads in a measured arm. Each
        # arm gets a private writable copy of one hash-verified shared fixture.
        root = Path(os.environ['PAIRED_CAPACITY_FIXTURES'])
        files = fixture_files(root)
        self.record['paired_fixture_sha256'] = files
        script = Path(command[1]).name
        if script == 'seed_lyrics_capacity_receipts.mjs':
            shutil.copytree(root / 'jobs', command[2])
            shutil.copyfile(root / 'receipts.json', command[3])
        elif script == 'lyrics_capacity_server.mjs' and command[-1] == '--prepare':
            shutil.copyfile(root / 'prepared-runs.json', command[3])
            shutil.copyfile(root / 'prepared-runs.json.sha256', command[3] + '.sha256')
        else:
            raise RuntimeError('unexpected paired fixture preparation command')
        return subprocess.CompletedProcess(command, 0, '', '')

    def request(self, method, path, body=None, timeout=HEALTH_SECONDS):
        deadline = getattr(self, '_pair_deadline', None)
        if deadline is not None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError('Library verification exceeded the unchanged load deadline')
            timeout = min(timeout, remaining)
        value = super().request(method, path, body=body, timeout=timeout)
        if deadline is not None and time.monotonic() >= deadline:
            raise RuntimeError('Library verification exceeded the unchanged load deadline')
        return value

    def load_library(self, key):
        self._pair_deadline = time.monotonic() + LIBRARY_LOAD_SECONDS
        try:
            return self._load_library(key)
        finally:
            self._pair_deadline = None

    def _load_library(self, key):
        if self.library_mode == 'unloaded':
            return super().load_library(key)
        stores = {name: bool(os.environ.get(f'LIBRARY_{name.upper()}_DIR')) for name in LIBRARY_STORES}
        if not all(stores.values()):
            raise RuntimeError('paired experiment requires all Library stores configured')
        started = time.monotonic()
        timing = {}

        def load_and_verify():
            request_started = time.monotonic()
            response = self.request('GET', '/library/v1/search?' + urlencode({'q': SEARCH_QUERIES[key], 'limit': 1}), timeout=LIBRARY_LOAD_SECONDS)
            timing['first_search_s'] = time.monotonic() - request_started
            timing['search_result'] = search_evidence(key, response)
            # Legacy main returns search before its background package hash
            # check finishes. Record that distinction; never call it ready.
            while True:
                state = self.health().get('library') or {}
                if state.get('state') == 'failed' or state.get('corpus') == 'failed':
                    raise RuntimeError('Library verification failed during paired measurement')
                if time.monotonic() >= self._pair_deadline:
                    raise RuntimeError('Library verification exceeded the unchanged load deadline')
                if state.get('state') == 'ready' and state.get('corpus') == 'verified':
                    break
                time.sleep(.05)
            timing['verified_ready_s'] = time.monotonic() - started

        if self.library_load_probe:
            self.library_load_probe(key, load_and_verify)
        else:
            load_and_verify()
        library = self.request('GET', '/library/v1/health', timeout=LIBRARY_LOAD_SECONDS)
        state = self.health().get('library') or {}
        self.record[key] = dict(configured=True, stores=stores, state=state.get('state'),
                                failures=state.get('failures'), corpus=state.get('corpus'),
                                search_ready=library.get('search_ready') is True,
                                load_s=time.monotonic() - started,
                                first_search_scope='cold request including store load',
                                **timing)
        errors = library_evidence_failures(self.record[key], key, library_mode='loaded')
        if errors:
            raise RuntimeError('; '.join(errors))
        self.sample()


if __name__ == '__main__':
    matrix.ResidentRuntime = PairedRuntime
    raise SystemExit(matrix.main())
