import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import { ReaderJobStore, READER_LIMITS, decodeStoredObject } from './reader_job_store.js';
import { canonicalJSON, createCatalogResolver } from './reader_scheduler.js';
import { createReaderRouter, signReaderRequest } from './reader_routes.js';
import { buildSegment } from './reader_discovery.js';
import { plantRecord, storeDirectory } from './reader_store_test_support.mjs';

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

// #656: a checkpoint object is history and carries no cursor. The record is
// the head and holds the one cursor resume reads, so what a commit stores no
// longer grows with the cursor, and a job keeps one copy of it, not one per
// generation.
function scan(store) {
  // Every byte the quota covers.
  let total = fs.statSync(path.join(store.directory, 'capability-key')).size;
  const marker = path.join(store.directory, 'store-format.json');
  if (fs.existsSync(marker)) total += fs.statSync(marker).size;
  for (const sub of ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
    for (const name of fs.readdirSync(path.join(store.directory, sub)))
      total += fs.statSync(path.join(store.directory, sub, name)).size;
  return total;
}
const objectsOf = (store, kind) => fs.readdirSync(path.join(store.directory, kind)).sort();
const checkpointAt = (store, hash) =>
  JSON.parse(
    decodeStoredObject(fs.readFileSync(path.join(store.directory, 'checkpoints', `${hash}.json`)))
  );
// The committed chain, newest generation first.
function chain(store, id) {
  const nodes = [];
  for (let hash = store.inspect(id).checkpoint_hash; hash; ) {
    const node = checkpointAt(store, hash);
    nodes.push(node);
    hash = node.previous_hash;
  }
  return nodes;
}
function age(store) {
  const old = new Date(Date.now() - 60_000);
  for (const sub of ['pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
    for (const name of fs.readdirSync(path.join(store.directory, sub)))
      fs.utimesSync(path.join(store.directory, sub, name), old, old);
}
const collect = (store) => {
  while (
    store.maintain({ records: 1000, objects: 1000, bytes: 1 << 30, ms: 10_000 }).phase !== 'idle'
  );
};
const CURSOR_BYTES = 500_000;
const bigCursor = (index) => ({ phase: 'pairs', index, frontier: 'x'.repeat(CURSOR_BYTES) });
const SMALL_QUOTA = 2 * 1024 * 1024;

test('many commits with a 500 KB cursor fit a small quota; no checkpoint object carries a cursor', (t) => {
  // With a cursor copy in every generation, 16 commits need about 8 MB and
  // the fourth already passes this quota.
  const { store } = fixture(t, { maxBytes: SMALL_QUOTA });
  const job = create(store),
    lease = store.lease(job.record.id);
  const manifests = [];
  for (let i = 1; i <= 16; i++) {
    const saved = commit(store, lease, [{ id: `evidence-${i}` }], bigCursor(i));
    assert.equal(saved.state, 'running', `commit ${i} paused: ${saved.reason?.code}`);
    assert.equal(saved.generation, i);
    manifests.push(saved.manifest_hash);
  }
  const files = objectsOf(store, 'checkpoints');
  assert.equal(files.length, 16);
  for (const file of files) {
    const raw = fs.readFileSync(path.join(store.directory, 'checkpoints', file), 'utf8');
    assert.equal(raw.includes('cursor'), false, `${file} carries a cursor`);
    assert.ok(raw.length < 4096, `${file} is ${raw.length} B`);
  }
  const nodes = chain(store, lease.id);
  // Every field anything reads back from a checkpoint is still written.
  for (const node of nodes)
    for (const key of [
      'job_id',
      'identity_hash',
      'previous_hash',
      'manifest_hash',
      'page_index_hash',
    ])
      assert.ok(key in node, `checkpoint lacks ${key}`);
  assert.deepEqual(
    nodes.map((node) => node.manifest_hash),
    [...manifests].reverse()
  );
  manifests.forEach((hash, i) =>
    assert.equal(store.readManifest(lease.id, job.capability, 'viewer-a', hash).generation, i + 1)
  );
  assert.equal(store.usage, scan(store));
  assert.ok(store.usage < 2 * CURSOR_BYTES, 'the cursor is stored once, in the record');
});

test('after a restart the worker payload and the next lease carry the last committed cursor', (t) => {
  // With a cursor copy per generation, the fourth commit passes this quota.
  const quota = SMALL_QUOTA;
  const { directory, store } = fixture(t, { maxBytes: quota });
  const job = create(store),
    lease = store.lease(job.record.id);
  for (let i = 1; i <= 8; i++)
    assert.equal(commit(store, lease, [{ id: `evidence-${i}` }], bigCursor(i)).state, 'running');
  const restarted = new ReaderJobStore({ directory, maxBytes: quota });
  assert.equal(restarted.inspect(lease.id).reason.code, 'INTERRUPTED');
  assert.equal(restarted.inspect(lease.id).generation, 8);
  assert.deepEqual(restarted.workerPayload(lease.id).cursor, bigCursor(8));
  assert.equal(
    chain(restarted, lease.id).some((node) => 'cursor' in node),
    false,
    'the record is the only copy of the cursor'
  );
  restarted.resume(lease.id, job.capability, 'viewer-a', identity);
  const next = restarted.lease(lease.id);
  assert.deepEqual(next.cursor, bigCursor(8));
  assert.equal(commit(restarted, next, [{ id: 'after' }], bigCursor(9)).generation, 9);
  assert.deepEqual(restarted.workerPayload(lease.id).cursor, bigCursor(9));
  assert.equal(restarted.usage, scan(restarted));
});

test('a legacy cursor-bearing chain followed by cursor-free checkpoints walks, collects and deletes', (t) => {
  const { store } = fixture(t, { clock: () => 0 });
  const job = create(store),
    lease = store.lease(job.record.id);
  // Exactly what the store wrote before #656: the cursor, in this key order.
  const writeObject = store._blob.bind(store);
  let legacy;
  store._blob = (kind, value) => {
    if (kind !== 'checkpoints') return writeObject(kind, value);
    const { version, job_id, identity_hash, previous_hash, generation, ...rest } = value;
    return writeObject(kind, {
      version,
      job_id,
      identity_hash,
      previous_hash,
      generation,
      cursor: legacy,
      ...rest,
    });
  };
  const saved = [];
  for (let i = 1; i <= 3; i++) {
    legacy = { phase: 'pairs', index: i };
    saved.push(commit(store, lease, [{ id: `legacy-${i}` }], legacy));
  }
  delete store._blob; // the current writer from here on
  for (let i = 4; i <= 6; i++) {
    const cursor = i < 6 ? { phase: 'pairs', index: i } : { phase: 'done', done: true };
    saved.push(commit(store, lease, [{ id: `current-${i}` }], cursor));
  }
  const nodes = chain(store, lease.id);
  assert.deepEqual(
    nodes.map((node) => node.generation),
    [6, 5, 4, 3, 2, 1]
  );
  assert.deepEqual(
    nodes.map((node) => node.cursor ?? null),
    [null, null, null, ...[3, 2, 1].map((index) => ({ phase: 'pairs', index }))]
  );
  // The walk crosses from new nodes into legacy ones, for manifests and pages.
  const read = (hash) => store.readManifest(lease.id, job.capability, 'viewer-a', hash);
  saved.forEach((s, i) => assert.equal(read(s.manifest_hash).generation, i + 1));
  const firstPage = saved[0].page_refs[0].sha256;
  assert.equal(
    store.readPage(lease.id, firstPage, job.capability, 'viewer-a', saved[0].manifest_hash)
      .instances[0].id,
    'legacy-1'
  );
  refused(
    () =>
      store.readPage(
        lease.id,
        saved[5].page_refs.at(-1).sha256,
        job.capability,
        'viewer-a',
        saved[0].manifest_hash
      ),
    'NOT_FOUND'
  );
  const kinds = ['pages', 'indexes', 'checkpoints', 'manifests'];
  const census = () => kinds.map((kind) => objectsOf(store, kind).length);
  const live = census();
  store.prune(); // _collectAll keeps the whole mixed chain
  assert.deepEqual(census(), live);
  assert.equal(store.usage, scan(store));
  age(store);
  collect(store); // and so does the bounded mark-and-sweep
  assert.deepEqual(census(), live);
  assert.equal(store.usage, scan(store));
  assert.equal(finish(store, lease, 6).state, 'completed');
  assert.equal('cursor' in checkpointAt(store, store.inspect(lease.id).checkpoint_hash), false);
  store.delete(lease.id, job.capability, 'viewer-a');
  age(store);
  collect(store);
  assert.deepEqual(census(), [0, 0, 0, 0], 'the deleted chain is reclaimed, legacy nodes too');
  assert.equal(store.usage, scan(store));
});

test('complete() writes a cursor-free checkpoint and the job completes from the record cursor', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const done = { phase: 'done', done: true, frontier: 'x'.repeat(CURSOR_BYTES) };
  const last = commit(store, lease, [{ id: 'only' }], done);
  const final = finish(store, lease);
  assert.equal(final.state, 'completed');
  assert.equal(final.generation, last.generation + 1);
  assert.deepEqual(final.cursor, done, 'the record keeps the exhausted cursor');
  const head = checkpointAt(store, final.checkpoint_hash);
  assert.equal('cursor' in head, false);
  assert.equal(head.previous_hash, last.checkpoint_hash);
  assert.equal(head.manifest_hash, final.manifest_hash);
  assert.equal(store.readManifest(lease.id, job.capability, 'viewer-a').partial, false);
  assert.equal(
    store.readManifest(lease.id, job.capability, 'viewer-a', last.manifest_hash).partial,
    true
  );
  assert.equal(objectsOf(store, 'checkpoints').length, 2);
  assert.ok(store.usage < 2 * CURSOR_BYTES, 'the cursor is stored once, in the record');
  assert.equal(store.usage, scan(store));
});

test('an exact checkpoint retry writes no new checkpoint object', (t) => {
  const { store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const first = commit(store, lease, [{ id: 'once' }], bigCursor(1));
  const before = objectsOf(store, 'checkpoints');
  const usage = store.usage;
  const retry = commit(store, lease, [{ id: 'once' }], bigCursor(1));
  assert.equal(retry.generation, first.generation);
  assert.equal(retry.checkpoint_hash, first.checkpoint_hash);
  assert.deepEqual(retry.added_page_paths, []);
  assert.deepEqual(objectsOf(store, 'checkpoints'), before);
  assert.equal(store.usage, usage);
  assert.deepEqual(before, [`${first.checkpoint_hash}.json`]);
  assert.equal('cursor' in checkpointAt(store, first.checkpoint_hash), false);
});

test('a failed checkpoint write keeps the previous generation and its record cursor', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store),
    lease = store.lease(job.record.id);
  const kept = commit(store, lease, [{ id: 'kept' }], { phase: 'pairs', index: 1 });
  let orphan;
  store.fault = (stage, event) => {
    if (event.kind === 'checkpoints' && stage === 'renamed') {
      orphan = event.file;
      throw new Error('simulated process loss');
    }
  };
  refused(
    () => commit(store, lease, [{ id: 'lost' }], { phase: 'pairs', index: 2 }),
    'STORAGE_UNAVAILABLE'
  );
  assert.equal(fs.existsSync(orphan), true, 'the new checkpoint reached disk');
  assert.equal(fs.readFileSync(orphan, 'utf8').includes('cursor'), false);
  const recovered = new ReaderJobStore({ directory });
  const record = recovered.inspect(lease.id);
  assert.equal(record.generation, 1);
  assert.equal(record.checkpoint_hash, kept.checkpoint_hash);
  assert.equal(record.manifest_hash, kept.manifest_hash);
  assert.deepEqual(recovered.workerPayload(lease.id).cursor, { phase: 'pairs', index: 1 });
  assert.equal(fs.existsSync(orphan), false, 'the uncommitted checkpoint is collected');
  assert.deepEqual(objectsOf(recovered, 'checkpoints'), [`${kept.checkpoint_hash}.json`]);
  assert.equal('cursor' in checkpointAt(recovered, kept.checkpoint_hash), false);
  assert.equal(recovered.usage, scan(recovered));
  recovered.resume(lease.id, job.capability, 'viewer-a', identity);
  const next = recovered.lease(lease.id);
  assert.deepEqual(next.cursor, { phase: 'pairs', index: 1 });
  const saved = commit(recovered, next, [{ id: 'retried' }], { phase: 'pairs', index: 2 });
  assert.equal(saved.generation, 2);
  assert.equal(checkpointAt(recovered, saved.checkpoint_hash).previous_hash, kept.checkpoint_hash);
});

// Startup pauses every running job, and a paused record is a few bytes larger
// than a running one (it gains a reason). Past the record's 16 KiB reservation
// that growth needs a known usage, so startup counts before it pauses; before
// this, every restart of such a store failed with STORE_RECOUNTING.
const RESERVE = 16 * 1024;
const restartsTwice = (directory, maxBytes) => {
  const restarted = new ReaderJobStore({ directory, maxBytes });
  assert.doesNotThrow(() => new ReaderJobStore({ directory, maxBytes }));
  return restarted;
};
test('a restart pauses a running job whose record is past its reservation', (t) => {
  const { directory, store } = fixture(t, { maxBytes: SMALL_QUOTA });
  const job = create(store),
    lease = store.lease(job.record.id);
  commit(store, lease, [{ id: 'first' }], bigCursor(1));
  assert.ok(
    fs.statSync(path.join(directory, 'reader-jobs-v1', 'records', `${lease.id}.json`)).size >
      RESERVE
  );
  const restarted = restartsTwice(directory, SMALL_QUOTA);
  assert.equal(restarted.inspect(lease.id).state, 'paused');
  assert.equal(restarted.inspect(lease.id).reason.code, 'INTERRUPTED');
  assert.deepEqual(restarted.workerPayload(lease.id).cursor, bigCursor(1));
  assert.equal(restarted.usage, scan(restarted));
  // The same path after a crash mid-commit (the record still names the
  // previous generation, and the new checkpoint is an orphan).
  restarted.resume(lease.id, job.capability, 'viewer-a', identity);
  const next = restarted.lease(lease.id);
  assert.equal(commit(restarted, next, [{ id: 'second' }], bigCursor(2)).state, 'running');
  restarted.fault = (stage, event) => {
    if (event.kind === 'checkpoints' && stage === 'renamed')
      throw new Error('simulated process loss');
  };
  refused(() => commit(restarted, next, [{ id: 'lost' }], bigCursor(3)), 'STORAGE_UNAVAILABLE');
  const recovered = restartsTwice(directory, SMALL_QUOTA);
  const record = recovered.inspect(lease.id);
  assert.equal(record.state, 'paused');
  assert.equal(record.reason.code, 'INTERRUPTED');
  assert.equal(record.generation, 2);
  assert.deepEqual(recovered.workerPayload(lease.id).cursor, bigCursor(2));
  assert.equal(objectsOf(recovered, 'checkpoints').length, 2, 'the orphan is collected');
  assert.equal(recovered.usage, scan(recovered));
});

test('a restart collects a killed write before it counts, so a near-full store still pauses', (t) => {
  // A process killed during a record write leaves the new record's temporary
  // beside the old record. No quota check counted it: near a full quota,
  // counting it before collecting it leaves no room for the pause.
  const { directory, store } = fixture(t, { maxBytes: SMALL_QUOTA });
  const job = create(store),
    lease = store.lease(job.record.id);
  // Fill with evidence until under 8 KB is left beyond the job's reservation.
  let generation = 0;
  for (let room = Infinity; room > 0; room = SMALL_QUOTA - store.usage - RESERVE - 8192) {
    const text = 'x'.repeat(Math.min(room, 1_000_000));
    const saved = commit(
      store,
      lease,
      [{ id: `fill-${generation}`, text }],
      bigCursor(++generation)
    );
    assert.equal(saved.state, 'running');
  }
  assert.ok(SMALL_QUOTA - store.usage - RESERVE < 8192, 'the store is near its quota');
  const records = path.join(directory, 'reader-jobs-v1', 'records');
  store.fault = (stage, event) => {
    if (event.kind !== 'record' || stage !== 'temporary_written') return;
    const temp = fs.readdirSync(records).find((name) => name.endsWith('.tmp'));
    // What the kill leaves: the write's own temporary is unlinked as the
    // simulated failure unwinds, so keep a copy under a temporary's name.
    fs.copyFileSync(
      path.join(records, temp),
      path.join(records, `${lease.id}.json.${'0'.repeat(24)}.tmp`)
    );
    throw new Error('simulated process loss');
  };
  refused(
    () => commit(store, lease, [{ id: 'lost' }], bigCursor(generation + 1)),
    'STORAGE_UNAVAILABLE'
  );
  assert.ok(scan(store) > SMALL_QUOTA, 'counted before collection, the store is over quota');
  const recovered = restartsTwice(directory, SMALL_QUOTA);
  const record = recovered.inspect(lease.id);
  assert.equal(record.state, 'paused');
  assert.equal(record.reason.code, 'INTERRUPTED');
  assert.equal(record.generation, generation);
  assert.deepEqual(recovered.workerPayload(lease.id).cursor, bigCursor(generation));
  assert.deepEqual(
    fs.readdirSync(records).filter((name) => name.endsWith('.tmp')),
    [],
    'the temporary is collected'
  );
  assert.equal(recovered.usage, scan(recovered));
  assert.ok(recovered.usage + recovered.slack <= SMALL_QUOTA);
});

// A records/*.tmp file comes off the usage counter only if the full scan
// that set the counter counted it. One that appears with no pending marker
// (planted here as the golden plants it) was never counted; one a recount saw
// was. Every sweep of records/*.tmp, prune(), reopen and maintain()'s bounded
// one, leaves the counter equal to the bytes on disk for both (BB8's ruling:
// prune() took the uncounted one's size off and read 1,000 under the disk).
test('usage equals the bytes on disk after the records/*.tmp sweep, by prune(), reopen and maintain()', async (t) => {
  const { directory, store } = fixture(t);
  const job = create(store);
  commit(store, store.lease());
  assert.equal(store.usage, scan(store), 'counted before the temporary appears');
  const records = path.join(store.directory, 'records');
  let n = 0;
  const leaveTemporary = () => {
    const file = path.join(records, `${job.record.id}.json.${String(n++).padStart(24, '0')}.tmp`);
    fs.writeFileSync(file, '{"partial":'.padEnd(1000, ' '));
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(file, old, old); // older than any mark start, so maintain() may sweep it
    return file;
  };
  for (const counted of [false, true]) {
    const label = counted ? 'a counted temporary' : 'an uncounted temporary';
    let file = leaveTemporary();
    if (counted) assert.equal(await store.recount(), true, 'the recount is accepted');
    const bytes = store.prune().bytes;
    assert.equal(fs.existsSync(file), false, `prune() sweeps ${label}`);
    assert.equal(bytes, scan(store), `prune()'s bytes equal the disk (${label})`);
    assert.equal(store.usage, scan(store), `the counter equals the disk after prune() (${label})`);
    file = leaveTemporary();
    if (counted) assert.equal(await store.recount(), true, 'the recount is accepted');
    collect(store);
    assert.equal(fs.existsSync(file), false, `maintain() sweeps ${label}`);
    assert.equal(
      store.usage,
      scan(store),
      `the counter equals the disk after maintain() (${label})`
    );
  }
  const file = leaveTemporary();
  const reopened = new ReaderJobStore({ directory });
  assert.equal(fs.existsSync(file), false, 'reopen sweeps the temporary');
  assert.equal(reopened.usage, scan(reopened), 'the counter equals the disk after reopen');
});

const readerSha = (value) => createHash('sha256').update(value).digest('hex');
function pronunciationCatalogFixture(t, options = {}) {
  const { directory, store } = fixture(t);
  const catalog = path.join(directory, 'catalog');
  const pronunciationRoot = path.join(directory, 'harness');
  const write = (name, value) => {
    fs.mkdirSync(path.dirname(name), { recursive: true });
    const bytes = JSON.stringify(value);
    fs.writeFileSync(name, bytes);
    return { bytes: Buffer.byteLength(bytes), sha256: readerSha(bytes) };
  };
  const source = {
    reading_unit_id: 'reading_fixture',
    language: 'eng',
    availability: 'readable',
    source_path: 'corpus/library/gutenberg-next-ten/934/eng_gilbert.txt',
    title: 'THE MERRYMAN AND HIS MAID [item: PG934-pg934-030]',
    source_sha256: readerSha('source witness'),
    normalized_sha256: readerSha('A merrymaid sings.\nA popinjay sings.'),
    work_id: 'work_fixture',
    edition_id: 'edition_fixture',
    lines: [
      { kind: 'lyric', text: '  A merrymaid sings.', analysis_text: 'A merrymaid sings.' },
      { kind: 'lyric', text: 'A popinjay sings.' },
    ],
    ...options.source,
  };
  source.reading_revision = readerSha(canonicalJSON(source));
  const binding = {
    reading_revision: source.reading_revision,
    source_sha256: source.source_sha256,
    collection: '934',
    candidate_id: 'pg934-030',
    ...options.binding,
  };
  const pronunciations = [
    {
      line: 'A merrymaid sings.',
      token: 2,
      word: 'merrymaid',
      phones: ['M', 'EH1', 'R', 'IY0', 'M', 'EY2', 'D'],
      basis: 'declared',
      source: 'Fixture performance choice',
    },
    {
      line: 'A popinjay sings.',
      token: 2,
      word: 'popinjay',
      phones: ['P', 'AA1', 'P', 'IH0', 'N', 'JH', 'EY2'],
      basis: 'declared',
      source: 'Fixture performance choice',
    },
  ];
  const files = [];
  const assetPrefix = 'imports/gutenberg-next-ten/pronunciations/';
  for (const book of [
    '13646',
    '1568',
    '27195',
    '3138',
    '40048',
    '50878',
    '51226',
    '58414',
    '69378',
    '934',
  ]) {
    const relative = `${assetPrefix}${book}.json`;
    files.push({
      path: relative,
      ...write(
        path.join(pronunciationRoot, relative),
        book === '934' ? { 'pg934-030': { pronunciations } } : {}
      ),
    });
  }
  const relative = `${assetPrefix}bindings.json`;
  files.push({
    path: relative,
    ...write(
      path.join(pronunciationRoot, relative),
      options.noBinding ? {} : { [options.bindingId ?? source.reading_unit_id]: binding }
    ),
  });
  const registry = {
    version: 1,
    assets: [
      {
        id: 'gutenberg_next_ten_pronunciations',
        base: 'root',
        runtime: true,
        decision: 'approved',
        files,
      },
    ],
  };
  options.registry?.(registry);
  write(path.join(pronunciationRoot, 'data/runtime_assets.json'), registry);
  if (options.corruptFile)
    fs.appendFileSync(
      path.join(pronunciationRoot, `${assetPrefix}${options.corruptFile}.json`),
      ' '
    );
  if (options.missingFile)
    fs.unlinkSync(path.join(pronunciationRoot, `${assetPrefix}${options.missingFile}.json`));
  const sourcePath = `readings/${source.reading_unit_id}.json`;
  const artifacts = {
    [sourcePath]: write(path.join(catalog, sourcePath), source).sha256,
    'index.json': write(path.join(catalog, 'index.json'), { readings: [] }).sha256,
  };
  const manifest = { parser_version: 'fixture', normalizer_version: 'fixture', artifacts };
  manifest.snapshot_id = readerSha(canonicalJSON(manifest));
  write(path.join(catalog, 'manifest.json'), manifest);
  const request = {
    contract_version: 1,
    snapshot_id: manifest.snapshot_id,
    reading_unit_id: source.reading_unit_id,
    reading_revision: source.reading_revision,
    declaration_set: {},
    requested_layers: ['sound'],
  };
  const resolver = createCatalogResolver({
    directory: catalog,
    engineCommit: 'fixture',
    readerScheme: 'v2',
    pronunciationRoot,
  });
  return { directory, store, resolver, request, pronunciations, catalog, pronunciationRoot };
}

test('source-bound defaults attach before identity, preserve other declarations, and do not mutate input', async (t) => {
  const { resolver, request, pronunciations } = pronunciationCatalogFixture(t);
  request.declaration_set = { language: 'eng', meter: { feet: 4 }, source: 'Caller provenance' };
  const before = structuredClone(request);
  const unpreparedIdentity = await resolver.resolveIdentity(request);
  const prepared = await resolver.prepareRequest(request);
  assert.deepEqual(request, before);
  assert.deepEqual(prepared.declaration_set, { ...before.declaration_set, pronunciations });
  const preparedIdentity = await resolver.resolveIdentity(prepared);
  assert.notEqual(preparedIdentity.declaration_hash, unpreparedIdentity.declaration_hash);
  assert.equal(
    preparedIdentity.declaration_hash,
    readerSha(
      canonicalJSON({
        ...before.declaration_set,
        source: true,
        pronunciations: pronunciations.map((p) => ({ ...p, source: true })),
      })
    )
  );
  assert.deepEqual(await resolver.prepareRequest(prepared), prepared);
});

test('caller pronunciation set is authoritative including empty opt-out; non-English declaration skips defaults', async (t) => {
  const { resolver, request } = pronunciationCatalogFixture(t);
  for (const pronunciations of [
    [],
    [
      {
        line: 'A merrymaid sings.',
        token: 2,
        word: 'merrymaid',
        phones: ['M', 'EH1', 'D'],
        basis: 'declared',
        source: 'Caller choice',
      },
    ],
  ]) {
    const explicit = { ...request, declaration_set: { pronunciations, other: 'preserve' } };
    assert.deepEqual(await resolver.prepareRequest(explicit), explicit);
  }
  const finnish = { ...request, declaration_set: { language: 'fin' } };
  assert.deepEqual(await resolver.prepareRequest(finnish), finnish);
});

test('unbound and retained sources receive no defaults', async (t) => {
  for (const options of [
    { noBinding: true },
    { source: { source_path: 'corpus/song/eng_hall_ws_gilbert.txt' }, corruptFile: '934' },
    {
      source: { source_path: 'corpus/library/gutenberg-ten/934/eng_gilbert.txt' },
      corruptFile: '934',
    },
  ]) {
    const { resolver, request } = pronunciationCatalogFixture(t, options);
    assert.deepEqual(await resolver.prepareRequest(request), request);
  }
});

test('source-bound defaults reject stale binding IDs, revisions, source hashes, and changed declaration lines', async (t) => {
  for (const options of [
    { bindingId: 'reading_previous' },
    { binding: { reading_revision: readerSha('old revision') } },
    { binding: { source_sha256: readerSha('old source') } },
    { source: { title: 'THE MERRYMAN AND HIS MAID' } },
    {
      source: {
        lines: [
          { kind: 'lyric', text: 'A different merrymaid sings.' },
          { kind: 'lyric', text: 'A popinjay sings.' },
        ],
      },
    },
  ]) {
    const { resolver, request } = pronunciationCatalogFixture(t, options);
    await assert.rejects(resolver.prepareRequest(request), { code: 'STALE_READING' });
  }
});

test('source-bound defaults verify every asset, not just the requested collection', async (t) => {
  for (const options of [
    { corruptFile: '934' },
    { corruptFile: '13646' },
    { missingFile: 'bindings' },
    { missingFile: '13646' },
    {
      registry: (registry) => {
        registry.assets[0].files[0].bytes += 1;
      },
    },
    {
      registry: (registry) => {
        registry.assets[0].files[0].sha256 = '0'.repeat(64);
      },
    },
    {
      registry: (registry) => {
        registry.assets[0].decision = 'pending';
      },
    },
  ]) {
    const { resolver, request } = pronunciationCatalogFixture(t, options);
    await assert.rejects(resolver.prepareRequest(request), { code: 'READER_UNAVAILABLE' });
  }
});

test('reader route prepares after validation, hashes and stores defaults, and resumes stored choices', async (t) => {
  const { resolver, store, request, pronunciations } = pronunciationCatalogFixture(t);
  const secret = 'reader-default-pronunciations-test-secret';
  const site = 'reader-default-test';
  const calls = [];
  let prepareCalls = 0;
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, bytes) => {
        req.readerRawBody = Buffer.from(bytes);
      },
    })
  );
  app.use(
    createReaderRouter({
      store,
      scheduler: { kick() {} },
      secret,
      site,
      prepareRequest: async (input) => {
        prepareCalls++;
        return resolver.prepareRequest(input);
      },
      resolveIdentity: async (input) => {
        calls.push(structuredClone(input));
        return resolver.resolveIdentity(input);
      },
    })
  );
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  const call = async (route, input, bindings = {}) => {
    const body = JSON.stringify(input);
    const headers = signReaderRequest({
      secret,
      method: 'POST',
      path: route,
      body,
      site,
      viewer: 'viewer-a',
      idempotency: 'create-defaults',
      job: '',
      capability: '',
      attempt: '',
      generation: '',
      ...bindings,
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body,
    });
    return { status: response.status, body: await response.json() };
  };
  const invalid = await call('/internal/reader/jobs', { ...request, contract_version: 2 });
  assert.notEqual(invalid.status, 202);
  assert.equal(prepareCalls, 0);
  const mismatch = await call('/internal/reader/jobs', { ...request, idempotency_key: 'other' });
  assert.equal(mismatch.status, 409);
  assert.equal(prepareCalls, 0);
  const created = await call('/internal/reader/jobs', request);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  assert.equal(prepareCalls, 1);
  assert.deepEqual(calls[0].declaration_set.pronunciations, pronunciations);
  const record = store.inspect(created.body.job.id);
  assert.deepEqual(record.request, calls[0]);
  assert.equal(
    record.identity.declaration_hash,
    (await resolver.resolveIdentity(calls[0])).declaration_hash
  );
  const lease = store.lease(record.id);
  store.pause(lease.id, lease.attempt, lease.fence);
  const resumed = await call(
    `/internal/reader/jobs/${record.id}/resume`,
    {},
    { job: record.id, capability: created.body.capability, idempotency: 'resume-defaults' }
  );
  assert.equal(resumed.status, 202, JSON.stringify(resumed.body));
  assert.equal(prepareCalls, 1);
  assert.deepEqual(calls[1], record.request);
});

// B2: a checkpoint is bound to its job's identity_hash, and the identity now
// records the reader's word-cut scheme. A paused job whose checkpoint was
// committed under one scheme cannot be resumed from it under another, nor
// from an identity that predates the field; under its own scheme it can.
test('a committed checkpoint is refused after the reader scheme changes', async (t) => {
  const { store, resolver, request, catalog, pronunciationRoot } = pronunciationCatalogFixture(t);
  const prepared = await resolver.prepareRequest(request);
  const v2 = await resolver.resolveIdentity(prepared);
  assert.equal(v2.reader_scheme, 'v2');
  const v1 = await createCatalogResolver({
    directory: catalog,
    engineCommit: 'fixture',
    readerScheme: 'v1',
    pronunciationRoot,
  }).resolveIdentity(prepared);
  assert.deepEqual({ ...v1, reader_scheme: 'v2' }, v2, 'only the scheme differs');
  const { reader_scheme: _dropped, ...unrecorded } = v2;
  const job = store.create({
    viewer: 'viewer-a',
    idempotency_key: 'scheme-a',
    identity: v2,
    request: prepared,
  });
  const lease = store.lease(job.record.id);
  const saved = commit(store, lease, [{ id: 'counted-under-v2' }], { phase: 'pairs', index: 3 });
  store.pause(lease.id, lease.attempt, lease.fence, {
    code: 'INTERRUPTED',
    message: 'fixture',
    requeue: false,
  });
  const checkpoint = store.inspect(job.record.id).checkpoint_hash;
  assert.ok(checkpoint);
  for (const changed of [v1, unrecorded])
    refused(
      () => store.resume(job.record.id, job.capability, 'viewer-a', changed),
      'STALE_READING'
    );
  const paused = store.inspect(job.record.id);
  assert.equal(paused.state, 'paused');
  assert.equal(paused.checkpoint_hash, checkpoint, 'the refused resume leaves the checkpoint');
  store.resume(job.record.id, job.capability, 'viewer-a', v2);
  const next = store.lease(job.record.id);
  assert.deepEqual(next.cursor, saved.cursor);
});

// DISCOVERY_V1 §8, the pause (#656 Step 4): store.pause accepts a cause, a
// log and C1's reply_code, field and value, and stores a reason with a named
// cause without a message.
test('pause: a named cause is stored without a message; C1 fields are kept; others as before', (t) => {
  const { store } = fixture(t);
  const cases = [
    [
      { code: 'RESOURCE_LIMIT', message: 'worker text', cause: 'resident_capacity' },
      { code: 'RESOURCE_LIMIT', cause: 'resident_capacity' },
    ],
    // A log beside a RESOURCE_LIMIT cause is not stored.
    [
      {
        code: 'RESOURCE_LIMIT',
        message: 'worker text',
        cause: 'discovery_chain_segments',
        log: 'seen',
      },
      { code: 'RESOURCE_LIMIT', cause: 'discovery_chain_segments' },
    ],
    [
      { code: 'DISCOVERY_UNAVAILABLE', message: 'm', cause: 'segment_missing', log: 'alt_cells' },
      { code: 'DISCOVERY_UNAVAILABLE', cause: 'segment_missing', log: 'alt_cells' },
    ],
    [
      { code: 'DISCOVERY_UNAVAILABLE', message: 'm', cause: 'cursor_disagrees' },
      { code: 'DISCOVERY_UNAVAILABLE', cause: 'cursor_disagrees', log: null },
    ],
    // No causeless DISCOVERY_UNAVAILABLE is refused yet (Step 7 does that):
    // it is stored as code and message.
    [
      { code: 'DISCOVERY_UNAVAILABLE', message: 'worker text' },
      { code: 'DISCOVERY_UNAVAILABLE', message: 'worker text' },
    ],
    [
      {
        code: 'READER_PROTOCOL',
        message: 'The reader worker replied RESOURCE_LIMIT with no cause.',
        reply_code: 'RESOURCE_LIMIT',
        field: 'error_cause',
        value: null,
      },
      {
        code: 'READER_PROTOCOL',
        reply_code: 'RESOURCE_LIMIT',
        field: 'error_cause',
        value: null,
        message: 'The reader worker replied RESOURCE_LIMIT with no cause.',
      },
    ],
    [
      { code: 'READER_ERROR', message: 'worker text' },
      { code: 'READER_ERROR', message: 'worker text' },
    ],
  ];
  cases.forEach(([given, stored], i) => {
    create(store, `viewer-${i}`, `request-${i}`);
    const lease = store.lease();
    const paused = store.pause(lease.id, lease.attempt, lease.fence, { ...given, requeue: false });
    assert.equal(paused.state, 'paused', given.code);
    assert.deepEqual(store.inspect(lease.id).reason, stored, JSON.stringify(given));
  });
});

test('pause: a requeue that meets a full queue stores QUEUE_FULL without the cause', (t) => {
  const { store } = fixture(t);
  create(store);
  const lease = store.lease();
  for (let i = 0; i < 16; i++) create(store, `viewer-${i}`, `queued-${i}`);
  const paused = store.pause(lease.id, lease.attempt, lease.fence, {
    code: 'RESOURCE_LIMIT',
    message: 'worker text',
    cause: 'resident_capacity',
    requeue: true,
  });
  assert.equal(paused.state, 'paused');
  assert.deepEqual(store.inspect(lease.id).reason, {
    code: 'QUEUE_FULL',
    message: 'Queue is full; committed work is retained.',
  });
});

test('pause: an argument outside every set is refused INVALID_PAUSE (500) and saves nothing', (t) => {
  const { store } = fixture(t);
  create(store);
  const lease = store.lease();
  const before = store.inspect(lease.id);
  for (const extra of [
    { code: 'DISCOVERY_UNAVAILABLE', cause: 'not_a_cause' },
    { code: 'DISCOVERY_UNAVAILABLE', cause: 7 },
    { code: 'DISCOVERY_UNAVAILABLE', cause: { cause: 'chain_broken' } },
    { code: 'DISCOVERY_UNAVAILABLE', cause: 'segment_missing', log: 'alt_cellz' },
    { code: 'DISCOVERY_UNAVAILABLE', cause: 'segment_missing', log: 3 },
    // A cause of the wrong family (BB8 6705927389): refused, never dropped.
    { code: 'DISCOVERY_UNAVAILABLE', cause: 'discovery_alt_seen' },
    { code: 'RESOURCE_LIMIT', cause: 'chain_broken' },
    { code: 'RESOURCE_LIMIT', cause: 'chain_broken', log: 'alt_cells' },
    { code: 'STALE_READING', cause: 'chain_broken', log: 'seen' },
    { code: 'READER_ERROR', cause: 'resident_capacity' },
    { code: 'READER_PROTOCOL', cause: 'chain_broken' },
    { code: 'READER_PROTOCOL', reply_code: 'RESOURCE_LIMIT', field: 7, value: null },
    { code: 'READER_PROTOCOL', reply_code: 4, field: 'error_cause', value: null },
    { code: 'READER_PROTOCOL', reply_code: 'RESOURCE_LIMIT', field: 'error_cause', value: 9 },
  ])
    // A requeue stores no reason, so the check before the save is the only
    // guard there; both are refused before anything is saved.
    for (const requeue of [false, true])
      assert.throws(
        () =>
          store.pause(lease.id, lease.attempt, lease.fence, { message: 'm', requeue, ...extra }),
        (error) => error.code === 'INVALID_PAUSE' && error.status === 500,
        JSON.stringify({ requeue, ...extra })
      );
  assert.deepEqual(store.inspect(lease.id), before, 'nothing saved; the lease is held');
  // A stale lease is refused STALE_ATTEMPT first.
  assert.throws(
    () => store.pause(lease.id, lease.attempt, 'not-the-fence', { cause: 7 }),
    (error) => error.code === 'STALE_ATTEMPT'
  );
  // A valid pause still ends the lease.
  store.pause(lease.id, lease.attempt, lease.fence, { code: 'READER_ERROR', message: 'm' });
  assert.equal(store.inspect(lease.id).state, 'paused');
});

// ── persisted discovery, Step 5 (#656 Node-side plan): the predicates, the
// segment reader and the GC roots, before any segment write. Nothing writes
// a chain yet, so the chains are planted as a foreign writer would
// (reader_store_test_support.mjs), and prune() / maintain() reload them.
const dsha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const EMPTY = { head: null, segments: 0, count: 0, bytes: 0, digest: dsha('d0') };
// A chain of `n` linked segments of `log` for `record`, oldest first.
function plantedChain(record, log, n, { epoch = 0, tag = log } = {}) {
  const raws = [];
  let previous = null;
  for (let i = 0; i < n; i++) {
    const { raw, address } = buildSegment(
      record,
      epoch,
      log,
      previous,
      i * 4,
      [`${tag}-${i}-a`, `${tag}-${i}-b`, `${tag}-${i}-c`, `${tag}-${i}-d`],
      dsha(`${tag}-before-${i}`),
      dsha(`${tag}-after-${i}`)
    );
    raws.push(raw);
    previous = address;
  }
  const addresses = raws.map((raw) => dsha(raw));
  return { raws, addresses, head: previous };
}
const stateFor = (head, segments) => ({
  head,
  segments,
  count: segments * 4,
  bytes: segments * 40,
  digest: dsha(`state-${head}`),
});
function liveDiscoveryOf(chains) {
  const logs = {};
  const verified = {};
  for (const [log, c] of Object.entries(chains)) {
    logs[log] = stateFor(c.head, c.addresses.length);
    verified[log] = EMPTY;
  }
  return { version: 1, epoch: 0, logs, verified, unavailable: null };
}
const pagesDir = (directory) => path.join(storeDirectory(directory), 'pages');
const pageExists = (directory, hash) =>
  fs.existsSync(path.join(pagesDir(directory), `${hash}.json`));
// A store holding one created job, planted again with `discovery` and the
// chains' segments (and optionally a state), plus one orphan segment that
// nothing references.
function discoveryFixture(t, { state, chains = 2, gzip = false, options = {} } = {}) {
  const { directory, store } = fixture(t, options);
  const job = create(store);
  const base = store.records.get(job.record.id);
  const seen = plantedChain(base, 'seen', chains);
  const alt = plantedChain(base, 'alt_cells', 1);
  const orphan = plantedChain(base, 'variants', 1, { tag: 'orphan' });
  const record = {
    ...base,
    ...(state ? { state } : {}),
    discovery: liveDiscoveryOf({ seen, alt_cells: alt }),
  };
  plantRecord(directory, record, [...seen.raws, ...alt.raws, ...orphan.raws], { gzip });
  return { directory, store, job, record, seen, alt, orphan };
}
// Back-dates every stored object, so maintain()'s mtime sweep can take them.
function backdate(directory) {
  const old = new Date(Date.now() - 60_000);
  for (const kind of ['pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
    for (const file of fs.readdirSync(path.join(storeDirectory(directory), kind)))
      fs.utimesSync(path.join(storeDirectory(directory), kind, file), old, old);
}
function maintainAll(store, bounds = undefined) {
  for (let i = 0; i < 1000; i++) {
    const result = store.maintain(bounds);
    if (result.phase === 'idle') return result;
  }
  throw new Error('maintain() did not finish');
}
const corruptAt = (rule) => (error) =>
  error.code === 'STORAGE_CORRUPT' &&
  error.status === 503 &&
  error.rule === rule &&
  !Object.keys(error).includes('rule');

test('discovery: _discoveryShape and _liveDiscovery read §2.7 exactly', (t) => {
  const { store } = fixture(t);
  const good = liveDiscoveryOf({ seen: { head: dsha('h'), addresses: [dsha('h')] } });
  const shape = (discovery) => store._discoveryShape({ discovery });
  assert.equal(store._discoveryShape({}), 'none', 'absent, as every record on main');
  assert.equal(shape(null), 'none', 'null, as complete() saves it');
  assert.equal(shape(good), 'live');
  assert.equal(shape({ ...good, logs: {}, verified: {} }), 'live', 'no logs yet');
  const released = {
    ...good,
    logs: {},
    verified: {},
    unavailable: { cause: 'chain_broken', log: null, released: { seen: dsha('h') } },
  };
  assert.equal(shape(released), 'released');
  for (const [name, bad] of [
    ['an empty object', {}],
    ['a string', 'discovery'],
    ['an array', [good]],
    ['a number', 1],
    ['version 2', { ...good, version: 2 }],
    ['an extra key', { ...good, extra: 1 }],
    ['a missing key', (({ verified: _v, ...rest }) => rest)(good)],
    ['a log outside §2.3', { ...good, logs: { alt_cellz: good.logs.seen } }],
    ['a head that is not 64-hex', { ...good, logs: { seen: { ...good.logs.seen, head: 'ABC' } } }],
    ['a non-integer epoch', { ...good, epoch: 1.5 }],
    ['a negative epoch', { ...good, epoch: -1 }],
    ['a string count', { ...good, logs: { seen: { ...good.logs.seen, count: '4' } } }],
    ['a state with an extra key', { ...good, logs: { seen: { ...good.logs.seen, x: 0 } } }],
    ['a bad digest', { ...good, verified: { seen: { ...EMPTY, digest: 'd0' } } }],
    ['an unknown cause', { ...released, unavailable: { ...released.unavailable, cause: 'x' } }],
    [
      'an unavailable log outside §2.3',
      { ...released, unavailable: { ...released.unavailable, log: 'alt_cellz' } },
    ],
    [
      'a released head',
      { ...released, unavailable: { ...released.unavailable, released: { seen: 1 } } },
    ],
    ['logs an array', { ...good, logs: [] }],
  ])
    assert.equal(shape(bad), 'malformed', name);
  // Only §7.1's four states hold a live discovery.
  for (const state of ['queued', 'running', 'paused', 'cancelled'])
    assert.equal(store._liveDiscovery({ state, discovery: good }), true, state);
  for (const state of ['completed', 'completed_with_refusals', 'expired', 'deleted'])
    assert.equal(store._liveDiscovery({ state, discovery: good }), false, state);
  assert.equal(store._liveDiscovery({ state: 'queued', discovery: released }), false);
  assert.equal(store._liveDiscovery({ state: 'queued', discovery: {} }), false, 'malformed');
  assert.equal(store._liveDiscovery({ state: 'queued', discovery: null }), false);
  assert.equal(store._liveDiscovery({ state: 'queued' }), false);
  // The roots: one per non-null head, of a live record only.
  const twoLogs = {
    ...good,
    logs: { ...good.logs, row_seen: EMPTY },
    verified: { ...good.verified, row_seen: EMPTY },
  };
  assert.deepEqual(store._discoveryRoots({ state: 'paused', discovery: twoLogs }), [
    ['discovery', dsha('h')],
  ]);
  assert.deepEqual(store._discoveryRoots({ state: 'completed', discovery: twoLogs }), []);
  assert.deepEqual(store._discoveryRoots({ state: 'queued', discovery: { logs: good.logs } }), []);
});

test('discovery: a record with discovery absent or null roots nothing, and its stray segments are swept', (t) => {
  for (const discovery of [undefined, null]) {
    const { directory, store } = fixture(t);
    const job = create(store);
    const base = store.records.get(job.record.id);
    const stray = plantedChain(base, 'seen', 2);
    const record = { ...base };
    if (discovery === null) record.discovery = null;
    plantRecord(directory, record, stray.raws);
    assert.deepEqual(store._discoveryRoots(store.records.get(job.record.id)), []);
    store.prune();
    for (const hash of stray.addresses) assert.equal(pageExists(directory, hash), false);
    assert.equal(store.inspect(job.record.id).state, 'queued');
  }
});

test('discovery: prune() and a full maintain() keep every segment of a live record, and sweep the orphan', (t) => {
  for (const state of ['queued', 'running', 'paused', 'cancelled'])
    for (const gzip of [false, true]) {
      const f = discoveryFixture(t, { state, gzip });
      f.store.prune();
      for (const hash of [...f.seen.addresses, ...f.alt.addresses])
        assert.ok(pageExists(f.directory, hash), `${state} gzip=${gzip}: prune keeps ${hash}`);
      assert.equal(pageExists(f.directory, f.orphan.addresses[0]), false, 'the orphan is swept');
      // And maintain(), in slices of one object, on a fresh orphan.
      plantRecord(f.directory, f.record, f.orphan.raws, { gzip });
      backdate(f.directory);
      const result = maintainAll(f.store, {
        records: 1,
        objects: 1,
        bytes: 2 * 1024 * 1024,
        ms: 1e9,
      });
      assert.equal(result.phase, 'idle');
      for (const hash of [...f.seen.addresses, ...f.alt.addresses])
        assert.ok(pageExists(f.directory, hash), `${state}: maintain keeps ${hash}`);
      assert.equal(pageExists(f.directory, f.orphan.addresses[0]), false, 'maintain sweeps it');
    }
});

test('discovery: startup marks the live chains and sweeps the rest', (t) => {
  const f = discoveryFixture(t);
  const restarted = new ReaderJobStore({ directory: f.directory });
  assert.equal(restarted.failure, null);
  for (const hash of [...f.seen.addresses, ...f.alt.addresses])
    assert.ok(pageExists(f.directory, hash));
  assert.equal(pageExists(f.directory, f.orphan.addresses[0]), false);
});

test("discovery: a mark read takes the mark's stat, adds only _readFile's own, and reads once", (t) => {
  const f = discoveryFixture(t, { chains: 3 });
  const dir = pagesDir(f.directory);
  const stats = new Map();
  const reads = new Map();
  const count = (map) => (file) => {
    const name = String(file);
    if (name.startsWith(dir)) map.set(name, (map.get(name) ?? 0) + 1);
  };
  const statSync = fs.statSync;
  const readFileSync = fs.readFileSync;
  t.mock.method(fs, 'statSync', function (file, ...rest) {
    count(stats)(file);
    return statSync.call(this, file, ...rest);
  });
  t.mock.method(fs, 'readFileSync', function (file, ...rest) {
    count(reads)(file);
    return readFileSync.call(this, file, ...rest);
  });
  // _markRecord directly, so nothing else (the sweep, a recount) stats pages.
  const live = {
    pages: new Set(),
    indexes: new Set(),
    checkpoints: new Set(),
    manifests: new Set(),
    definitions: new Set(),
  };
  f.store._reload();
  f.store._markRecord(f.store.records.get(f.job.record.id), live, { objects: 0 });
  t.mock.restoreAll();
  for (const hash of [...f.seen.addresses, ...f.alt.addresses]) {
    const file = path.join(dir, `${hash}.json`);
    // The mark's stat is passed in, so _segment never stats again; the only
    // other is _readFile's own size check, which every stored read makes.
    assert.equal(stats.get(file), 2, `the mark's stat and _readFile's of ${hash}`);
    assert.equal(reads.get(file), 1, `one read of ${hash}`);
    assert.ok(live.pages.has(hash), 'marked in live.pages');
  }
  assert.equal(stats.has(path.join(dir, `${f.orphan.addresses[0]}.json`)), false);
});

test('discovery: a completed or tombstoned record is never marked, even holding a swept head', (t) => {
  // A completed record that an older image's complete() left holding its
  // discovery (its spread keeps the field), its head already swept.
  for (const state of ['completed', 'completed_with_refusals', 'expired', 'deleted']) {
    const { directory, store } = fixture(t);
    const job = create(store);
    const base = store.records.get(job.record.id);
    const swept = plantedChain(base, 'seen', 2);
    const kept = plantedChain(base, 'alt_cells', 1);
    plantRecord(
      directory,
      { ...base, state, discovery: liveDiscoveryOf({ seen: swept, alt_cells: kept }) },
      kept.raws
    );
    // startup neither fails nor marks; GC sweeps what the record names.
    const restarted = new ReaderJobStore({ directory });
    assert.equal(restarted.failure, null, state);
    assert.equal(pageExists(directory, kept.addresses[0]), false, `${state}: swept at startup`);
    plantRecord(directory, restarted.records.get(job.record.id), kept.raws);
    restarted.prune();
    assert.equal(pageExists(directory, kept.addresses[0]), false, `${state}: prune sweeps it`);
    plantRecord(directory, restarted.records.get(job.record.id), kept.raws);
    backdate(directory);
    assert.equal(maintainAll(restarted).phase, 'idle');
    assert.equal(pageExists(directory, kept.addresses[0]), false, `${state}: maintain sweeps it`);
  }
});

test('discovery: a deleted job drops its discovery, and its segments are swept', (t) => {
  const f = discoveryFixture(t);
  f.store.delete(f.job.record.id, f.job.capability, 'viewer-a');
  assert.equal(Object.hasOwn(f.store.records.get(f.job.record.id), 'discovery'), false);
  f.store.prune();
  for (const hash of [...f.seen.addresses, ...f.alt.addresses, ...f.orphan.addresses])
    assert.equal(pageExists(f.directory, hash), false);
});

test('discovery: a dirty re-mark keeps a segment the record took during an open collection', (t) => {
  const f = discoveryFixture(t, { chains: 1 });
  // A second seen segment exists on disk, old, and nothing names it yet.
  const id = f.job.record.id;
  const { record } = f;
  const next = buildSegment(
    record,
    0,
    'seen',
    f.seen.head,
    4,
    ['n-a', 'n-b', 'n-c', 'n-d'],
    dsha('b'),
    dsha('a')
  );
  plantRecord(f.directory, record, [next.raw]);
  backdate(f.directory);
  // Mark everything with the record as it is: one slice whose object bound
  // is exactly the two live segments, so the mark has passed the record and
  // the sweep has not begun. The new segment is unmarked.
  const bounds = { records: 1, objects: 2, bytes: 64 * 1024 * 1024, ms: 1e9 };
  let result = f.store.maintain(bounds);
  const gc = f.store._gc;
  assert.equal(gc.phase, 'mark');
  assert.equal(gc.at, gc.ids.length, 'every record has been marked');
  assert.ok(
    gc.stack.every(([, hash]) => hash === null),
    'only ended links are left'
  );
  assert.ok(gc.live.pages.has(f.seen.head));
  assert.equal(gc.live.pages.has(next.address), false);
  // The record takes the segment as its head in a save while the collection is open.
  f.store._open(() =>
    f.store._save({
      ...f.store.records.get(id),
      discovery: {
        ...record.discovery,
        logs: { ...record.discovery.logs, seen: stateFor(next.address, 2) },
      },
    })
  );
  assert.ok(f.store._gc.dirty.has(id));
  result = maintainAll(f.store, bounds);
  assert.equal(result.phase, 'idle');
  assert.ok(pageExists(f.directory, next.address), 'the re-mark kept it');
  assert.ok(pageExists(f.directory, f.seen.head), 'and the chain behind it');
  assert.equal(pageExists(f.directory, f.orphan.addresses[0]), false);
});

test('discovery: a missing live segment abandons the collection and sweeps nothing', (t) => {
  for (const which of ['head', 'interior']) {
    const f = discoveryFixture(t, { chains: 3 });
    const gone = which === 'head' ? f.seen.head : f.seen.addresses[0];
    fs.unlinkSync(path.join(pagesDir(f.directory), `${gone}.json`));
    assert.throws(
      () => f.store.prune(),
      (e) => e.code === 'STORAGE_CORRUPT' && e.status === 503
    );
    assert.ok(pageExists(f.directory, f.orphan.addresses[0]), `${which}: prune swept nothing`);
    backdate(f.directory);
    assert.throws(
      () => maintainAll(f.store),
      (e) => e.code === 'STORAGE_CORRUPT' && e.status === 503
    );
    assert.equal(f.store._gc, null, 'abandoned');
    assert.ok(pageExists(f.directory, f.orphan.addresses[0]), `${which}: maintain swept nothing`);
    assert.equal(f.store._segment(gone, null).missing, true);
  }
});

test('discovery: an oversized live segment is F6 without being opened, plain and gzip-marked', (t) => {
  for (const gzip of [false, true]) {
    const f = discoveryFixture(t, { chains: 1 });
    // The record's head is replaced by a file one byte over the bound.
    const big = Buffer.alloc(READER_LIMITS.objectBytes + 1, 0x20);
    if (gzip) big.set([0x1f, 0x8b, 8, 0]);
    const file = path.join(pagesDir(f.directory), `${f.seen.head}.json`);
    fs.writeFileSync(file, big);
    const opened = [];
    for (const name of ['readFileSync', 'openSync']) {
      const real = fs[name];
      t.mock.method(fs, name, function (target, ...rest) {
        if (String(target) === file) opened.push(name);
        return real.call(this, target, ...rest);
      });
    }
    assert.deepEqual(f.store._segment(f.seen.head, null), { f6: true });
    assert.deepEqual(f.store._segment(f.seen.head, { job_id: f.job.record.id }), { f6: true });
    assert.throws(() => f.store.prune(), corruptAt('F6'));
    assert.ok(pageExists(f.directory, f.orphan.addresses[0]), `gzip=${gzip}: prune swept nothing`);
    backdate(f.directory);
    // The smallest legal byte bound: an oversized segment can never fit it,
    // and it is refused rather than deferred forever.
    assert.throws(
      () =>
        maintainAll(f.store, {
          records: 100,
          objects: 500,
          bytes: READER_LIMITS.objectBytes,
          ms: 1e9,
        }),
      corruptAt('F6')
    );
    assert.equal(f.store._gc, null, 'abandoned');
    assert.ok(
      pageExists(f.directory, f.orphan.addresses[0]),
      `gzip=${gzip}: maintain swept nothing`
    );
    assert.deepEqual(opened, [], `gzip=${gzip}: the file was never opened`);
    t.mock.restoreAll();
  }
});

// The bound is inclusive: a segment of exactly objectBytes is read, through
// _segment and through a full maintain() whose byte bound is that size.
test('discovery: a live segment of exactly objectBytes is read, not F6', (t) => {
  const f = discoveryFixture(t, { chains: 1 });
  // The head's own bytes, padded with JSON whitespace to the bound.
  const raw = f.seen.raws[0];
  const padded = Buffer.concat([raw, Buffer.alloc(READER_LIMITS.objectBytes - raw.length, 0x20)]);
  assert.equal(padded.length, READER_LIMITS.objectBytes);
  const head = dsha(padded);
  const record = {
    ...f.record,
    discovery: liveDiscoveryOf({ seen: { head, addresses: [head] }, alt_cells: f.alt }),
  };
  plantRecord(f.directory, record, [padded]);
  assert.equal(fs.statSync(path.join(pagesDir(f.directory), `${head}.json`)).size, padded.length);
  const read = f.store._segment(head, null);
  assert.ok(read.segment, `read at the bound: ${JSON.stringify(read)}`);
  assert.equal(read.segment.previous_hash, null);
  assert.ok(read.bytes.equals(padded));
  backdate(f.directory);
  // Each slice reads at most its byte bound: the segment at the bound is
  // deferred past the small objects marked before it, not read beside them.
  const bounds = { records: 100, objects: 500, bytes: READER_LIMITS.objectBytes, ms: 1e9 };
  let sliceBytes = 0;
  const readFile = ReaderJobStore.prototype._readFile;
  t.mock.method(ReaderJobStore.prototype, '_readFile', function (...args) {
    const bytes = readFile.apply(this, args);
    sliceBytes += bytes.length;
    return bytes;
  });
  let result;
  for (let i = 0; i < 1000; i++) {
    sliceBytes = 0;
    result = f.store.maintain(bounds);
    assert.ok(sliceBytes <= bounds.bytes, `slice ${i} read ${sliceBytes} bytes`);
    if (result.phase === 'idle') break;
  }
  t.mock.restoreAll();
  assert.equal(result.phase, 'idle');
  assert.ok(pageExists(f.directory, head), 'the segment at the bound is kept');
  assert.equal(pageExists(f.directory, f.orphan.addresses[0]), false, 'the orphan is swept');
});

test('discovery: _segment reads F6 and F3 apart, and its decode is fatal', (t) => {
  const f = discoveryFixture(t, { chains: 2 });
  const record = f.record;
  const dir = pagesDir(f.directory);
  const expect = { job_id: record.id, identity_hash: record.identity_hash, epoch: 0, log: 'seen' };
  const read = f.store._segment(f.seen.head, expect);
  assert.equal(read.segment.previous_hash, f.seen.addresses[0]);
  assert.ok(read.bytes.equals(f.seen.raws[1]));
  assert.ok(f.store._segment(f.seen.head, null).segment, 'a mark read');
  // An address that is not 64-hex names no file: F3, never a path.
  for (const bad of ['../records/x', 'A'.repeat(64), '', 7])
    assert.deepEqual(f.store._segment(bad, null), { f3: 'FIELD' }, String(bad));
  // F6: bytes that do not match the address, and a failed bounded inflation.
  const changed = dsha('changed');
  fs.writeFileSync(path.join(dir, `${changed}.json`), f.seen.raws[0]);
  assert.deepEqual(f.store._segment(changed, null), { f6: true });
  const inflation = dsha('inflation');
  fs.writeFileSync(
    path.join(dir, `${inflation}.json`),
    Buffer.from([0x1f, 0x8b, 8, 0, ...Buffer.alloc(20)])
  );
  assert.deepEqual(f.store._segment(inflation, null), { f6: true });
  // F3 against `expect`: another job's segment, another log.
  assert.deepEqual(f.store._segment(f.seen.head, { ...expect, job_id: 'reader_other' }), {
    f3: 'FIELD',
  });
  assert.deepEqual(f.store._segment(f.alt.head, expect), { f3: 'FIELD' });
  // Invalid UTF-8 (the 0xFF read_back): address-valid, F3 under the fatal decode.
  const ff = Buffer.from(f.seen.raws[0].toString('latin1').replace('"seen-0-a"', '"ÿ"'), 'latin1');
  assert.equal(ff.includes(0xff), true);
  const ffHash = dsha(ff);
  fs.writeFileSync(path.join(dir, `${ffHash}.json`), ff);
  assert.deepEqual(f.store._segment(ffHash, null), { f3: 'JSON' });
  assert.deepEqual(f.store._segment(ffHash, expect), { f3: 'JSON' });
  // A replacing decoder passes those bytes, so the refusal is the fatal decoder's.
  t.mock.method(ReaderJobStore.prototype, '_segmentText', (buf) => buf.toString('utf8'));
  assert.ok(f.store._segment(ffHash, null).segment, 'a replacing decode passes the bytes');
  t.mock.restoreAll();
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(ff), TypeError);
});

test('discovery: a live F3 segment abandons the collection and sweeps nothing', (t) => {
  const f = discoveryFixture(t, { chains: 1 });
  // The head is replaced by an address-valid segment holding a lone 0xFF byte.
  const record = f.record;
  const ff = Buffer.from(f.seen.raws[0].toString('latin1').replace('"seen-0-a"', '"ÿ"'), 'latin1');
  const discovery = {
    ...record.discovery,
    logs: { ...record.discovery.logs, seen: stateFor(dsha(ff), 1) },
  };
  plantRecord(f.directory, { ...record, discovery }, [ff]);
  assert.throws(() => f.store.prune(), corruptAt('F3'));
  assert.ok(pageExists(f.directory, f.orphan.addresses[0]), 'prune swept nothing');
  backdate(f.directory);
  assert.throws(() => maintainAll(f.store), corruptAt('F3'));
  assert.ok(pageExists(f.directory, f.orphan.addresses[0]), 'maintain swept nothing');
  // With a replacing decoder the same collection passes: the fatal decode refuses.
  t.mock.method(ReaderJobStore.prototype, '_segmentText', (buf) => buf.toString('utf8'));
  f.store.prune();
  t.mock.restoreAll();
  assert.equal(pageExists(f.directory, f.orphan.addresses[0]), false);
});

test('discovery: a malformed previous_hash is STORAGE_CORRUPT at the mark, never 400', (t) => {
  for (const previous of ['ABC', 'z'.repeat(64), 7, 'A'.repeat(64)]) {
    const f = discoveryFixture(t, { chains: 1 });
    const record = f.record;
    const { raw, address } = buildSegment(
      record,
      0,
      'seen',
      previous,
      0,
      ['x', 'y', 'z', 'w'],
      dsha('b'),
      dsha('a')
    );
    const discovery = {
      ...record.discovery,
      logs: { ...record.discovery.logs, seen: stateFor(address, 1) },
    };
    plantRecord(f.directory, { ...record, discovery }, [raw]);
    assert.deepEqual(f.store._segment(address, null), { f3: 'FIELD' });
    assert.throws(() => f.store.prune(), corruptAt('F3'), JSON.stringify(previous));
    assert.ok(pageExists(f.directory, f.orphan.addresses[0]));
  }
});

test('discovery: readPage refuses a segment address with 404', (t) => {
  const { directory, store } = fixture(t);
  const job = create(store);
  const lease = store.lease();
  commit(store, lease, [{ id: 'evidence-a', verdict: true }], { phase: 'more' });
  const base = store.records.get(job.record.id);
  const seen = plantedChain(base, 'seen', 1);
  plantRecord(directory, { ...base, discovery: liveDiscoveryOf({ seen }) }, seen.raws);
  assert.throws(
    () => store.readPage(job.record.id, seen.head, job.capability, 'viewer-a'),
    (error) => error.code === 'NOT_FOUND' && error.status === 404
  );
  // The segment is live and on disk: it is refused by membership, not absence.
  store.prune();
  assert.ok(pageExists(directory, seen.head));
});
