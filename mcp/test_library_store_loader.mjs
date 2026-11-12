import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryStoreLoader } from './library_store_loader.js';

const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const store = () => ({ snapshotId: 'a'.repeat(64) });

test('health is inert; concurrent first callers share one load and see no partial data', async () => {
  let calls = 0;
  const gate = defer();
  const loader = createLibraryStoreLoader({
    search: () => {
      calls++;
      return store();
    },
    corpus: () => ({ ...store(), verify: () => gate.promise }),
  });
  assert.equal(loader.health().state, 'not_loaded');
  assert.equal(calls, 0);
  const a = loader.load(),
    b = loader.load();
  assert.equal(a, b);
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  assert.equal(loader.health().state, 'loading');
  assert.equal(loader.stores, null);
  gate.resolve([]);
  assert.equal(await a, await b);
  assert.deepEqual(loader.health(), { state: 'ready', failures: [], corpus: 'verified' });
  assert.equal(await loader.load(), await a);
  assert.equal(calls, 1);
});

test('all waiters fail; explicit retry rebuilds, shares a fresh load and clears failure', async () => {
  let calls = 0;
  const loader = createLibraryStoreLoader({
    search: () => {
      if (++calls === 1) throw Error('private path must not escape');
      return store();
    },
  });
  const a = loader.load(),
    b = loader.load();
  const results = await Promise.allSettled([a, b]);
  assert.ok(results.every((r) => r.status === 'rejected' && r.reason.status === 503));
  assert.equal(loader.health().state, 'failed');
  assert.equal(loader.stores, null);
  assert.equal(calls, 1, 'health does not retry');
  const retry = loader.load();
  assert.notEqual(retry, a);
  assert.equal(retry, loader.load());
  await retry;
  assert.equal(calls, 2);
  assert.deepEqual(loader.health(), { state: 'ready', failures: [], corpus: 'absent' });
});

for (const verify of [() => ['bad.zip'], () => Promise.reject(Error('hash read')), () => null]) {
  test('unverified corpus cannot become ready or expose stores', async () => {
    const loader = createLibraryStoreLoader({
      search: store,
      corpus: () => ({ ...store(), verify }),
    });
    await assert.rejects(loader.load(), { status: 503 });
    assert.equal(loader.health().corpus, 'failed');
    assert.equal(loader.health().state, 'failed');
    assert.equal(loader.stores, null);
  });
}

test('mismatched search/export snapshots fail even without corpus', async () => {
  const loader = createLibraryStoreLoader({
    search: store,
    exports: () => ({ snapshotId: 'b'.repeat(64) }),
  });
  await assert.rejects(loader.load());
  assert.deepEqual(loader.health().failures, ['snapshot']);
});

test('health returns independent failures and absent is never ready', async () => {
  const loader = createLibraryStoreLoader({});
  assert.equal(loader.health().state, 'absent');
  loader.health().failures.push('fake');
  await loader.load();
  assert.deepEqual(loader.health(), { state: 'absent', failures: [], corpus: 'absent' });
});

test('failed attempts close constructed stores before each explicit retry', async () => {
  let opened = 0,
    closed = 0;
  const loader = createLibraryStoreLoader({
    search: () => ({
      ...store(),
      close() {
        closed++;
      },
      id: ++opened,
    }),
    corpus: () => {
      throw Error('unavailable');
    },
  });
  for (let i = 1; i <= 3; i++) {
    await assert.rejects(loader.load());
    assert.equal(opened, i);
    assert.equal(closed, i);
    assert.equal(loader.stores, null);
  }
});
