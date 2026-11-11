#!/usr/bin/env python3
"""Diagnostic entry point: identical first-search/verification protocol for both images.

Run only through the reviewed same-host experiment. This does not replace the
production qualification entry point or grant production_qualified acceptance.
"""
import os
import time
import check_lyrics_capacity as matrix
from lyrics_capacity_runtime import LIBRARY_LOAD_SECONDS, LIBRARY_STORES, library_evidence_failures


class PairedRuntime(matrix.ResidentRuntime):
    def load_library(self, key):
        if self.library_mode == 'unloaded':
            return super().load_library(key)
        stores = {name: bool(os.environ.get(f'LIBRARY_{name.upper()}_DIR')) for name in LIBRARY_STORES}
        if not all(stores.values()):
            raise RuntimeError('paired experiment requires all Library stores configured')
        started = time.monotonic()
        timing = {}

        def load_and_verify():
            request_started = time.monotonic()
            self.request('GET', '/library/v1/search?limit=1', timeout=LIBRARY_LOAD_SECONDS)
            timing['first_search_s'] = time.monotonic() - request_started
            # Legacy main returns search before its background package hash
            # check finishes. Record that distinction; never call it ready.
            while True:
                state = self.health().get('library') or {}
                if state.get('state') == 'failed' or state.get('corpus') == 'failed':
                    raise RuntimeError('Library verification failed during paired measurement')
                if state.get('state') == 'ready' and state.get('corpus') == 'verified':
                    break
                if time.monotonic() - started >= LIBRARY_LOAD_SECONDS:
                    raise RuntimeError('Library verification exceeded the unchanged load deadline')
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
