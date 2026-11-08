import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ReaderJobStore } from './reader_job_store.js';
import { prepareReaderBootstrap } from './reader_bootstrap.js';

const fresh = () => ({
  id: 'persisted-job',
  cursor: null,
  generation: 0,
  page_count: 0,
  evidence_count: 0,
  page_index_hash: null,
  checkpoint_hash: null,
  manifest_hash: null,
  page_refs: [],
  page_paths: [],
});
const v2 = (record) => prepareReaderBootstrap({ selectedWorker: 'v2', record });
const stale = (run) => assert.throws(run, { code: 'STALE_READING' });

test('bootstrap requires explicit selection and creates exact isolated empty state', () => {
  const record = fresh();
  assert.equal(prepareReaderBootstrap({ record }), null);
  assert.deepEqual(prepareReaderBootstrap({ selectedWorker: 'legacy', record }), {});
  assert.deepEqual(v2(record), {
    discovery: { version: 1, summary: { epoch: 0, logs: {} }, paths: {} },
    discovery_job_id: record.id,
  });
  const a = v2(record),
    b = v2(record);
  a.discovery.paths.seen = [];
  assert.deepEqual(b.discovery.paths, {});
  assert.deepEqual(record, fresh());
  assert.deepEqual(v2({ ...record, attempt: 4, fence: 'leased' }), b);
  assert.throws(() => prepareReaderBootstrap({ selectedWorker: true, record }), TypeError);
});

test('lost cursor refuses every durable indicator including zero-record checkpoints', () => {
  for (const changed of [
    { generation: 1 },
    { page_count: 1 },
    { evidence_count: 1 },
    { page_index_hash: 'a' },
    { checkpoint_hash: 'a' },
    { manifest_hash: 'a' },
    { page_refs: ['a'] },
    { page_paths: ['/page'] },
    { discovery: { version: 1, summary: { epoch: 0, logs: {} }, paths: {} } },
    { cursor: undefined },
    { id: '' },
  ])
    stale(() => v2({ ...fresh(), ...changed }));
  stale(() => v2({ ...fresh(), cursor: { contract_version: 1 } }));
});

test('v2 restore preserves committed state and rejects cross-version or mismatched payloads', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/discovery_v1/good/lease_incremental_walk.json', import.meta.url)
    )
  );
  const record = structuredClone(fixture.record);
  record.discovery = {
    version: 1,
    summary: { epoch: record.discovery.epoch, logs: record.discovery.logs },
    paths: Object.fromEntries(
      Object.entries(record.discovery.logs).map(([name, st]) => [
        name,
        Array.from(
          { length: st.segments },
          (_, i) => `/pages/${i === st.segments - 1 ? st.head : 'preceding'}.json`
        ),
      ])
    ),
  };
  assert.equal(v2(record).discovery, record.discovery);
  stale(() => prepareReaderBootstrap({ selectedWorker: 'legacy', record }));
  for (const mutate of [
    (r) => {
      r.discovery.summary.epoch++;
    },
    (r) => {
      r.discovery.summary.logs.seen.count++;
    },
    (r) => {
      r.discovery.summary.logs.seen.digest = 'bad';
    },
    (r) => {
      r.discovery.paths.seen = [];
    },
    (r) => {
      r.discovery.paths.seen[0] = 'relative';
    },
    (r) => {
      delete r.discovery.summary.logs.seen;
    },
  ]) {
    const bad = structuredClone(record);
    mutate(bad);
    assert.throws(() => v2(bad), { code: 'DISCOVERY_UNAVAILABLE', cause: 'cursor_disagrees' });
  }
  // A matching later epoch remains a restore, never a fresh empty bootstrap.
  record.cursor.discovery.epoch = record.discovery.summary.epoch = 3;
  assert.equal(v2(record).discovery.summary.epoch, 3);
});

test('production construction does not select discovery or enable C1', async () => {
  const scheduler = await readFile(new URL('./reader_scheduler.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('./server_http.js', import.meta.url), 'utf8');
  assert.doesNotMatch(server, /discoverySelection|verifyReaderSelection/);
  assert.match(scheduler, /READER_REPLY_CAUSES_ENFORCED = false/);
});

test('actual store fresh lease and restart remain fresh; zero-record durable work does not', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'reader-bootstrap-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let store = new ReaderJobStore({ directory });
  const job = store.create({
    viewer: 'a',
    idempotency_key: 'a',
    identity: { snapshot: 'a', revision: 'a', engine: 'a', declarations: 'none' },
    request: { layers: ['sound'] },
  });
  const lease = store.lease(job.record.id);
  const initial = store.workerPayload(lease.id);
  assert.equal(initial.discovery, undefined, 'existing store does not itself select v2');
  assert.deepEqual(v2(initial).discovery, {
    version: 1,
    summary: { epoch: 0, logs: {} },
    paths: {},
  });
  store = new ReaderJobStore({ directory });
  assert.deepEqual(v2(store.workerPayload(lease.id)).discovery, v2(initial).discovery);
  store.resume(lease.id, job.capability, 'a', initial.identity);
  const next = store.lease(lease.id);
  store.commitCheckpoint(next.id, next.attempt, next.fence, {
    cursor: { contract_version: 1 },
    pages: [],
    progress: {},
    coverage: {},
  });
  const durable = store.workerPayload(lease.id);
  assert.equal(durable.evidence_count, 0);
  stale(() => v2(durable));
  stale(() => v2({ ...durable, cursor: null }));
});
