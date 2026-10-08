import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ReaderJobStore, READER_LIMITS } from './reader_job_store.js';

const identity = {
  snapshot: 'snapshot-a',
  revision: 'revision-a',
  engine: 'engine-a',
  declarations: 'none',
};
const coverage = {
  partial: false,
  certified: true,
  requested_methods: 1,
  answered_methods: 1,
  refused_methods: 0,
  not_requested_methods: 0,
  pending_methods: 0,
  refused_obligations: [],
};
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new ReaderJobStore({ directory, ...options });
  return { directory, store };
}
function create(store, viewer = 'viewer-a', key = 'request-a', request = { layers: ['sound'] }) {
  return store.create({ viewer, idempotency_key: key, identity, request });
}
const refused = (fn, code) => assert.throws(fn, (error) => error.code === code);
function commit(
  store,
  lease,
  instances = [{ id: 'evidence-a', verdict: true }],
  cursor = { phase: 'done', done: true }
) {
  return store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor,
    pages: [{ instances }],
    progress: { candidates: 1 },
    coverage,
  });
}
function finish(store, lease, count = 1) {
  return store.complete(lease.id, lease.attempt, lease.fence, {
    exhausted: true,
    census_reconciled: true,
    coverage,
    summary: {
      coverage,
      counters: { evidence_records: count },
      methods: [{ method_id: 'sound', coverage: 'answered' }],
    },
    provider_calls: 0,
  });
}

test('durable storage is mandatory and lease may not exceed 600 seconds', (t) => {
  refused(() => new ReaderJobStore(), 'DURABILITY_REQUIRED');
  const { directory } = fixture(t);
  refused(() => new ReaderJobStore({ directory, leaseMs: 600_001 }), 'INVALID_CONFIGURATION');
});

test('same exact create retry survives restart, changed input and viewer cannot read', (t) => {
  const { directory, store } = fixture(t);
  const original = create(store);
  const restarted = new ReaderJobStore({ directory });
  const retry = create(restarted);
  assert.equal(retry.created, false);
  assert.equal(retry.record.id, original.record.id);
  assert.equal(retry.capability, original.capability);
  refused(
    () => create(restarted, 'viewer-a', 'request-a', { layers: ['form'] }),
    'IDEMPOTENCY_CONFLICT'
  );
  refused(() => restarted.get(original.record.id, original.capability, 'viewer-b'), 'NOT_FOUND');
  refused(() => restarted.get(original.record.id, '0'.repeat(64), 'viewer-a'), 'NOT_FOUND');
  assert.equal(JSON.stringify(retry.record).includes(retry.capability), false);
});

test('one active lease, at most 16 queued and two outstanding per viewer', (t) => {
  const { store } = fixture(t);
  const first = create(store),
    second = create(store, 'viewer-a', 'second');
  refused(() => create(store, 'viewer-a', 'third'), 'QUEUE_FULL');
  const lease = store.lease(first.record.id);
  assert.equal(store.lease(second.record.id), null);
  for (let i = 0; i < 15; i++) create(store, `viewer-${i}`, `queued-${i}`);
  assert.equal(store.listQueued().length, 16);
  refused(() => create(store, 'another-viewer', 'overflow'), 'QUEUE_FULL');
  store.pause(lease.id, lease.attempt, lease.fence);
  assert.equal(store.inspect(lease.id).state, 'paused');
});

test('immutable partial generations, exact page order, final census and trusted paths', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const first = commit(store, lease, [{ id: 'first' }], { phase: 'pairs', index: 1 });
  assert.equal(first.added_page_paths.length, 1);
  assert.equal(first.added_page_paths[0].startsWith(directory), true);
  assert.equal('added_page_paths' in store.inspect(lease.id), false);
  const second = commit(store, lease, [{ id: 'second' }]);
  const final = finish(store, lease, 2);
  assert.equal(final.state, 'completed');
  assert.equal(
    store.readManifest(lease.id, job.capability, 'viewer-a', first.manifest_hash).partial,
    true
  );
  assert.equal(store.readManifest(lease.id, job.capability, 'viewer-a').partial, false);
  const refs = store.readManifestPage(lease.id, job.capability, 'viewer-a').page_refs;
  assert.equal(refs.length, 2);
  assert.deepEqual(
    refs.map((r) => store.readPage(lease.id, r.sha256, job.capability, 'viewer-a').instances[0].id),
    ['first', 'second']
  );
  refused(
    () => store.readPage(lease.id, refs[1].sha256, job.capability, 'viewer-a', first.manifest_hash),
    'NOT_FOUND'
  );
  assert.equal(store.workerPayload(lease.id).page_paths.length, 2);
  assert.equal(second.generation + 1, final.generation);
});

test('refusal completion requires exhausted committed cursor and reconciled method/record census', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  commit(store, lease, [{ id: 'unknown' }], { phase: 'pairs', index: 2 });
  refused(() => finish(store, lease), 'INCOMPLETE_TRAVERSAL');
  store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: { phase: 'done', done: true },
    pages: [],
    coverage,
  });
  refused(
    () =>
      store.complete(lease.id, lease.attempt, lease.fence, {
        exhausted: false,
        census_reconciled: true,
        coverage,
      }),
    'INCOMPLETE_TRAVERSAL'
  );
  refused(() => finish(store, lease, 9), 'CENSUS_MISMATCH');
  const badCoverage = { ...coverage, answered_methods: 0 };
  refused(
    () =>
      store.complete(lease.id, lease.attempt, lease.fence, {
        exhausted: true,
        census_reconciled: true,
        coverage: badCoverage,
      }),
    'CENSUS_MISMATCH'
  );
  const unknown = {
    ...coverage,
    certified: false,
    answered_methods: 0,
    refused_methods: 1,
    refused_obligations: ['sound'],
  };
  const result = store.complete(lease.id, lease.attempt, lease.fence, {
    exhausted: true,
    census_reconciled: true,
    coverage: unknown,
    summary: {
      methods: [{ method_id: 'sound', coverage: 'refused' }],
      counters: { evidence_records: 1 },
    },
  });
  assert.equal(result.state, 'completed_with_refusals');
});

test('restart pauses running job and fences out even the old live store instance', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store),
    old = store.lease(job.record.id);
  const saved = commit(store, old, [{ id: 'before-crash' }], { phase: 'pairs', index: 17 });
  const restarted = new ReaderJobStore({ directory });
  assert.equal(restarted.inspect(old.id).reason.code, 'INTERRUPTED');
  assert.deepEqual(restarted.inspect(old.id).cursor, saved.cursor);
  refused(() => commit(store, old), 'STALE_ATTEMPT');
  refused(
    () => restarted.resume(old.id, job.capability, 'viewer-a', { ...identity, engine: 'changed' }),
    'STALE_READING'
  );
  restarted.resume(old.id, job.capability, 'viewer-a', identity);
  const next = restarted.lease(old.id);
  assert.equal(next.attempt, 2);
  assert.notEqual(next.fence, old.fence);
  refused(
    () =>
      restarted.commitCheckpoint(old.id, old.attempt, old.fence, {
        cursor: { done: true },
        pages: [],
      }),
    'STALE_ATTEMPT'
  );
});

test('cancel running retains fence until safe checkpoint; resume retry cannot restart a later interrupted attempt', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const cancellation = store.cancel(lease.id, job.capability, 'viewer-a', {
    idempotency_key: 'cancel-a',
  });
  assert.equal(cancellation.state, 'running');
  assert.equal(cancellation.fence, lease.fence);
  commit(store, lease, [{ id: 'safe-point' }], { phase: 'pairs', index: 9 });
  assert.equal(
    store.pause(lease.id, lease.attempt, lease.fence, { requeue: true }).state,
    'cancelled'
  );
  store.resume(lease.id, job.capability, 'viewer-a', identity, { idempotency_key: 'resume-a' });
  const next = store.lease(lease.id);
  const restarted = new ReaderJobStore({ directory });
  assert.equal(restarted.inspect(lease.id).state, 'paused');
  const replay = restarted.resume(lease.id, job.capability, 'viewer-a', identity, {
    idempotency_key: 'resume-a',
  });
  assert.equal(replay.state, 'paused');
  assert.equal(replay.attempt, next.attempt);
  refused(
    () =>
      restarted.resume(lease.id, job.capability, 'viewer-a', identity, {
        idempotency_key: 'resume-a',
        digest: 'a'.repeat(64),
      }),
    'IDEMPOTENCY_CONFLICT'
  );
});

test('page and checkpoint limits reject without moving durable cursor', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  refused(
    () =>
      commit(
        store,
        lease,
        Array.from({ length: 251 }, (_, i) => ({ id: i }))
      ),
    'RESOURCE_LIMIT'
  );
  refused(
    () => commit(store, lease, [{ text: 'x'.repeat(READER_LIMITS.objectBytes) }]),
    'RESOURCE_LIMIT'
  );
  refused(
    () =>
      store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
        cursor: { frontier: 'x'.repeat(READER_LIMITS.objectBytes) },
        pages: [],
      }),
    'RESOURCE_LIMIT'
  );
  assert.equal(store.inspect(lease.id).generation, 0);
  assert.equal(store.inspect(lease.id).cursor, null);
});

test('quota pauses and preserves the committed cursor and evidence', (t) => {
  const { store } = fixture(t, { maxBytes: 100_000 });
  const job = create(store),
    lease = store.lease(job.record.id);
  const checkpoint = commit(store, lease, [{ id: 'retained' }], { phase: 'pairs', index: 6 });
  const paused = commit(store, lease, [{ text: 'x'.repeat(90_000) }], {
    phase: 'done',
    done: true,
  });
  assert.equal(paused.state, 'paused');
  assert.equal(paused.reason.code, 'RESOURCE_LIMIT');
  assert.deepEqual(paused.cursor, checkpoint.cursor);
  assert.equal(paused.manifest_hash, checkpoint.manifest_hash);
  assert.equal(
    store.readPage(lease.id, checkpoint.page_refs[0].sha256, job.capability, 'viewer-a')
      .instances[0].id,
    'retained'
  );
});

test('crash before pointer commit retains last generation; orphan objects cannot be read', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const saved = commit(store, lease, [{ id: 'retained' }], { phase: 'pairs', index: 8 });
  let orphan;
  store.fault = (stage, event) => {
    if (event.kind === 'manifests' && stage === 'directory_synced') {
      orphan = path.basename(event.file, '.json');
      throw new Error('simulated process loss');
    }
  };
  refused(() => commit(store, lease, [{ id: 'uncommitted' }]), 'STORAGE_UNAVAILABLE');
  const recovered = new ReaderJobStore({ directory });
  assert.equal(recovered.inspect(lease.id).manifest_hash, saved.manifest_hash);
  assert.equal(recovered.inspect(lease.id).page_count, 1);
  refused(() => recovered.readManifest(lease.id, job.capability, 'viewer-a', orphan), 'NOT_FOUND');
});

test('crash after pointer rename recovers exactly the newly committed generation', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  store.fault = (stage, event) => {
    if (event.kind === 'record' && stage === 'directory_synced')
      throw new Error('lost acknowledgement');
  };
  refused(() => commit(store, lease, [{ id: 'committed' }]), 'STORAGE_UNAVAILABLE');
  const recovered = new ReaderJobStore({ directory });
  const record = recovered.inspect(lease.id);
  assert.equal(record.generation, 1);
  assert.equal(record.evidence_count, 1);
  assert.equal(
    recovered.readPage(lease.id, record.page_refs[0].sha256, job.capability, 'viewer-a')
      .instances[0].id,
    'committed'
  );
});

test('manifest index remains bounded and ordered beyond 250 page references', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const pages = Array.from({ length: 301 }, (_, n) => ({ instances: [{ sequence: n }] }));
  const saved = store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: { phase: 'done', done: true },
    pages,
    coverage,
  });
  assert.equal(saved.page_refs.length, 0);
  assert.equal(saved.page_count, 301);
  finish(store, lease, 301);
  const first = store.readManifestPage(lease.id, job.capability, 'viewer-a', null, { limit: 250 });
  const second = store.readManifestPage(lease.id, job.capability, 'viewer-a', first.manifest_hash, {
    offset: first.next_offset,
    limit: 250,
  });
  assert.equal(first.page_refs.length, 250);
  assert.equal(second.page_refs.length, 51);
  assert.equal(second.next_offset, null);
  const paths = store.workerPayload(lease.id).page_paths;
  assert.deepEqual(
    paths.map((file) => JSON.parse(fs.readFileSync(file)).instances[0].sequence),
    Array.from({ length: 301 }, (_, n) => n)
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(store.readManifest(lease.id, job.capability, 'viewer-a'))) <
      READER_LIMITS.objectBytes,
    true
  );
});

test('access refreshes 30-day retention; expiry and deletion do not authorize redispatch', (t) => {
  let now = 1000;
  const { store } = fixture(t, { now: () => now });
  const job = create(store),
    lease = store.lease(job.record.id);
  commit(store, lease);
  finish(store, lease);
  now += READER_LIMITS.retentionMs - 1;
  const touched = store.get(lease.id, job.capability, 'viewer-a');
  assert.equal(touched.expires_at, now + READER_LIMITS.retentionMs);
  now += READER_LIMITS.retentionMs + 1;
  refused(() => store.get(lease.id, job.capability, 'viewer-a'), 'RESULT_EXPIRED');
  refused(() => create(store), 'RESULT_EXPIRED');
  const other = create(store, 'viewer-a', 'new-analysis');
  store.delete(other.record.id, other.capability, 'viewer-a', { idempotency_key: 'delete-a' });
  store.delete(other.record.id, other.capability, 'viewer-a', { idempotency_key: 'delete-a' });
  refused(() => create(store, 'viewer-a', 'new-analysis'), 'RESULT_EXPIRED');
});

test('expired lease is fenced, and modified immutable bytes fail closed', (t) => {
  let now = 10;
  const { store } = fixture(t, { now: () => now });
  const job = create(store),
    lease = store.lease(job.record.id);
  now += 600_000;
  refused(() => commit(store, lease), 'STALE_ATTEMPT');
  assert.equal(store.inspect(lease.id).state, 'paused');
  store.resume(lease.id, job.capability, 'viewer-a', identity);
  const active = store.lease(lease.id);
  const saved = commit(store, active);
  const file = store.workerPayload(lease.id).page_paths[0];
  fs.writeFileSync(file, '{"instances":[]}');
  refused(
    () => store.readPage(lease.id, saved.page_refs[0].sha256, job.capability, 'viewer-a'),
    'STORAGE_CORRUPT'
  );
});

test('checkpoint acknowledgement retry does not duplicate pages or advance generation', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const first = commit(store, lease);
  const retry = commit(store, lease);
  assert.equal(retry.generation, first.generation);
  assert.equal(retry.evidence_count, 1);
  assert.deepEqual(retry.added_page_paths, []);
  refused(
    () =>
      store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
        cursor: { done: true, changed: true },
        pages: [],
        previous_generation: 0,
      }),
    'STALE_ATTEMPT'
  );
});

test('control fencing binds new actions while exact durable replay remains safe', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  refused(
    () =>
      store.cancel(lease.id, job.capability, 'viewer-a', {
        idempotency_key: 'bad',
        expected_attempt: 0,
      }),
    'STALE_ATTEMPT'
  );
  const options = { idempotency_key: 'cancel', expected_attempt: 1, expected_generation: 0 };
  store.cancel(lease.id, job.capability, 'viewer-a', options);
  commit(store, lease, [], { phase: 'pairs', index: 9 });
  store.pause(lease.id, lease.attempt, lease.fence);
  store.resume(lease.id, job.capability, 'viewer-a', identity);
  const later = store.lease(lease.id);
  const replay = store.cancel(lease.id, job.capability, 'viewer-a', options);
  assert.equal(replay.attempt, later.attempt);
  assert.equal(replay.cancel_requested, false);
});

test('successful yield at a full queue resumes automatically at its tail after restart', (t) => {
  let now = 100;
  const { directory, store } = fixture(t, { now: () => now });
  const job = create(store),
    lease = store.lease(job.record.id);
  for (let i = 0; i < 16; i++) {
    now++;
    create(store, `viewer-${i}`, `queued-${i}`);
  }
  now++;
  const pending = store.pause(lease.id, lease.attempt, lease.fence, {
    requeue: true,
    code: 'YIELD',
  });
  assert.equal(pending.deferred_requeue, true);
  assert.equal(pending.reason.code, 'YIELD');
  assert.equal(store.listQueued().length, 16);
  const restarted = new ReaderJobStore({ directory, now: () => now });
  assert.equal(restarted.inspect(lease.id).deferred_requeue, true);
  now++;
  const next = restarted.lease();
  assert.notEqual(next.id, lease.id);
  const queue = restarted.listQueued();
  assert.equal(queue.length, 16);
  assert.equal(queue.at(-1).id, lease.id);
  assert.equal(restarted.inspect(lease.id).deferred_requeue, false);
});

test('FIFO order and yield tail are stable even when all timestamps are identical', (t) => {
  const { store } = fixture(t, { now: () => 10 });
  const first = create(store),
    second = create(store, 'viewer-b', 'second');
  const active = store.lease();
  assert.equal(active.id, first.record.id);
  store.pause(active.id, active.attempt, active.fence, { requeue: true, code: 'YIELD' });
  assert.equal(store.lease().id, second.record.id);
});
