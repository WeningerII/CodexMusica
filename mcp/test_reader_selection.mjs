// Synthetic artifact bytes: these checks do not qualify the held producer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { verifyReaderSelection, selectedReaderBootstrap } from './reader_selection.js';
import { ReaderScheduler } from './reader_scheduler.js';
import { ReaderJobStore } from './reader_job_store.js';
const hash = (s) => createHash('sha256').update(s).digest('hex');
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reader-selection-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const workerPath = path.join(dir, 'worker.py'),
    producerPath = path.join(dir, 'analysis.py');
  await writeFile(workerPath, 'synthetic worker');
  await writeFile(producerPath, 'synthetic producer');
  const calls = [];
  const bridge = {
    capacity: () => ({}),
    runReaderLease: async (payload) => {
      calls.push(payload);
      return { code: 1, error_code: 'INTERRUPTED', stderr: 'test stop' };
    },
  };
  const descriptor = {
    version: 1,
    discovery_version: 1,
    cursor_version: 2,
    worker_sha256: hash('synthetic worker'),
    producer_sha256: hash('synthetic producer'),
  };
  return { dir, workerPath, producerPath, bridge, descriptor, calls };
}
const unavailable = (fn) => assert.throws(fn, { code: 'READER_UNAVAILABLE' });

test('descriptor verifies both real byte bindings and refuses malformed or spoofed selection', async (t) => {
  const f = await fixture(t);
  const token = verifyReaderSelection(f);
  for (const descriptor of [
    {},
    { ...f.descriptor, version: 2 },
    { ...f.descriptor, discovery_version: 2 },
    { ...f.descriptor, cursor_version: 1 },
    { ...f.descriptor, extra: true },
    { ...f.descriptor, worker_sha256: '0'.repeat(64) },
    { ...f.descriptor, producer_sha256: '0'.repeat(64) },
  ])
    unavailable(() => verifyReaderSelection({ ...f, descriptor }));
  for (const fake of [{}, JSON.parse(JSON.stringify(token)), f.descriptor, 'v2'])
    unavailable(() => selectedReaderBootstrap(fake, f.bridge, {}));
  unavailable(() => selectedReaderBootstrap(token, { ...f.bridge }, {}));
  for (const filename of [f.workerPath, f.producerPath]) {
    const original = filename === f.workerPath ? 'synthetic worker' : 'synthetic producer';
    await writeFile(filename, 'replacement');
    unavailable(() => selectedReaderBootstrap(token, f.bridge, {}));
    await writeFile(filename, original);
  }
  await rm(f.producerPath);
  unavailable(() => selectedReaderBootstrap(token, f.bridge, {}));
});

test('actual scheduler defaults unchanged; only verified server selection bootstraps fresh job', async (t) => {
  const f = await fixture(t);
  for (const selected of [false, true]) {
    const store = new ReaderJobStore({ directory: path.join(f.dir, String(selected)) });
    const identity = { engine: 'synthetic' };
    store.create({
      viewer: 'a',
      idempotency_key: 'a',
      identity,
      request: { declaration_set: {}, discoverySelection: f.descriptor, reader_scheme: 'v2' },
    });
    const scheduler = new ReaderScheduler({
      store,
      bridge: f.bridge,
      readerScheme: 'v2',
      resolveIdentity: async () => identity,
      resolveSource: async () => ({ source: {} }),
      ...(selected ? { discoverySelection: verifyReaderSelection(f) } : {}),
    });
    t.after(() => scheduler.stop());
    await scheduler.pump();
    scheduler.stop();
    const sent = f.calls.at(-1);
    if (selected) {
      assert.deepEqual(sent.discovery, { version: 1, summary: { epoch: 0, logs: {} }, paths: {} });
      assert.equal(typeof sent.discovery_job_id, 'string');
    } else assert.equal(sent.discovery, undefined);
  }
  assert.equal(f.calls.length, 2);
});

test('verified selection preserves restore identity and refuses stale or lost cursor', async (t) => {
  const f = await fixture(t),
    token = verifyReaderSelection(f);
  const discovery = { version: 1, summary: { epoch: 3, logs: {} }, paths: {} };
  const record = {
    id: 'job',
    cursor: { contract_version: 2, discovery: { version: 1, epoch: 3, logs: {} } },
    discovery,
  };
  assert.equal(selectedReaderBootstrap(token, f.bridge, record).discovery, discovery);
  for (const bad of [
    { ...record, cursor: { contract_version: 1 } },
    { ...record, cursor: null },
  ])
    assert.throws(() => selectedReaderBootstrap(token, f.bridge, bad), { code: 'STALE_READING' });
  assert.equal(selectedReaderBootstrap(null, f.bridge, record), null);
});
