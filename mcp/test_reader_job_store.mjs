import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import { ReaderJobStore, READER_LIMITS, decodeStoredObject } from './reader_job_store.js';
import { canonicalJSON, createCatalogResolver } from './reader_scheduler.js';
import { createReaderRouter, signReaderRequest } from './reader_routes.js';
import {
  DISCOVERY_LIMITS,
  DOMAINS,
  buildSegment,
  digestStep,
  domainDigest,
} from './reader_discovery.js';
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

// The strict pause (#656 Step 7): a DISCOVERY_UNAVAILABLE without a cause from
// its set, or with a cause outside its code's, is refused INVALID_PAUSE (500)
// before anything is saved, whoever calls it; the lease stays the caller's,
// so the scheduler's fallback pause can end it (§8).
test('pause: a DISCOVERY_UNAVAILABLE with no cause, or a cause outside its set, is refused INVALID_PAUSE', (t) => {
  const { store } = fixture(t);
  create(store);
  const lease = store.lease();
  const before = fs.readFileSync(path.join(store.directory, 'records', `${lease.id}.json`));
  for (const given of [
    { message: 'worker text' },
    { message: 'worker text', cause: null, log: 'alt_cells' },
    { cause: 'discovery_alt_seen' },
    { cause: 'segment_gone', log: 'seen' },
  ]) {
    assert.throws(
      () =>
        store.pause(lease.id, lease.attempt, lease.fence, {
          code: 'DISCOVERY_UNAVAILABLE',
          requeue: false,
          ...given,
        }),
      (e) => e.code === 'INVALID_PAUSE' && e.status === 500,
      JSON.stringify(given)
    );
    assert.deepEqual(
      fs.readFileSync(path.join(store.directory, 'records', `${lease.id}.json`)),
      before,
      'nothing saved'
    );
  }
  // The lease is still the caller's: the fallback pause ends it.
  const fallback = store.pause(lease.id, lease.attempt, lease.fence, {
    code: 'READER_PROTOCOL',
    message: 'The reader reply could not be recorded: INVALID_PAUSE.',
    requeue: false,
  });
  assert.equal(fallback.state, 'paused');
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
// The Step 5 GC tests plant chains whose log states are named by their
// totals only, which a full read would release: they run with reconciliation
// (Step 6) mocked away, so they stay GC-only (design §C, Step 5).
// Only while the real method is installed: a second mock of the same method
// would capture the first as its original, and restoring both in order would
// leave the first installed for every later test.
const realReconcile = ReaderJobStore.prototype._reconcile;
const gcOnly = (t) => {
  if (ReaderJobStore.prototype._reconcile === realReconcile)
    t.mock.method(ReaderJobStore.prototype, '_reconcile', () => {});
};
function discoveryFixture(t, { state, chains = 2, gzip = false, options = {} } = {}) {
  gcOnly(t);
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
    ['verified naming none of the logs', { ...good, verified: {} }],
    [
      'verified naming a log logs does not',
      { ...good, verified: { ...good.verified, row_seen: EMPTY } },
    ],
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

// A segment replaced by a larger file between _segment's stat (or the mark's,
// passed in) and the read meets _readFile's own size refusal: that is {f6},
// one damaged segment, never the store-wide STORAGE_CORRUPT (BB8 6707363590,
// condition 7). The read itself never opens the larger file.
test('discovery: a segment replaced between the stat and the read is F6', (t) => {
  const f = discoveryFixture(t, { chains: 1 });
  const file = path.join(pagesDir(f.directory), `${f.seen.head}.json`);
  const small = fs.statSync(file).size;
  const big = Buffer.alloc(READER_LIMITS.objectBytes + 1, 0x20);
  const opened = [];
  const readFileSync = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', function (target, ...rest) {
    if (String(target) === file) opened.push(target);
    return readFileSync.call(this, target, ...rest);
  });
  // _segment's own stat sees the small file; the replacement lands after it.
  const statSync = fs.statSync;
  let replaced = false;
  t.mock.method(fs, 'statSync', function (target, ...rest) {
    const stat = statSync.call(this, target, ...rest);
    if (String(target) === file && !replaced) {
      replaced = true;
      fs.writeFileSync(file, big);
    }
    return stat;
  });
  assert.deepEqual(f.store._segment(f.seen.head, null), { f6: true });
  assert.equal(replaced, true, 'replaced after the first stat');
  // A caller's stat passed in, the file already replaced: the same.
  assert.deepEqual(f.store._segment(f.seen.head, { job_id: f.job.record.id }, small), {
    f6: true,
  });
  assert.deepEqual(opened, [], 'the larger file was never read');
  t.mock.restoreAll();
});

// A directory, or any non-regular file, at a segment address is {f6}: a stat
// that is not a regular file, and EISDIR from a read a passed-in stat let
// through (BB8 6707363590). Through the mark it is F6, never a raw EISDIR.
test('discovery: a directory at a segment address is F6, not EISDIR', (t) => {
  const f = discoveryFixture(t, { chains: 1 });
  const file = path.join(pagesDir(f.directory), `${f.seen.head}.json`);
  fs.rmSync(file);
  fs.mkdirSync(file);
  const opened = [];
  const readFileSync = fs.readFileSync;
  const spy = t.mock.method(fs, 'readFileSync', function (target, ...rest) {
    if (String(target) === file) opened.push(target);
    return readFileSync.call(this, target, ...rest);
  });
  // _segment's own stat: {f6} without a read.
  assert.deepEqual(f.store._segment(f.seen.head, null), { f6: true });
  assert.deepEqual(f.store._segment(f.seen.head, { job_id: f.job.record.id }), { f6: true });
  assert.deepEqual(opened, [], 'a non-regular stat is never read');
  // A caller's stat passed in: the read meets EISDIR.
  assert.deepEqual(f.store._segment(f.seen.head, null, fs.statSync(file).size), { f6: true });
  assert.equal(opened.length, 1, 'the passed-in stat reads, and EISDIR is {f6}');
  spy.mock.restore(); // the spy only: the GC stays GC-only
  assert.throws(() => f.store.prune(), corruptAt('F6'));
  assert.ok(pageExists(f.directory, f.orphan.addresses[0]), 'prune swept nothing');
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
  gcOnly(t);
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

// ── persisted discovery, Step 6 (#656 Node-side plan): the full read and
// reconciliation (§5.1, §7.4). The fixtures' records and segments are planted
// as a foreign writer would, so the full read is the real path: a restart's
// first lock entry, or a live instance's next one, reloads and reconciles.
const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'discovery_v1');
const loadFixture = (rel) => JSON.parse(fs.readFileSync(path.join(FIXTURES, rel), 'utf8'));
// The segments a write fixture's frames seal, by address: each log chained
// within its epoch, as the store's write path would build them (§2.5).
function sealedSegments(rel) {
  const fx = loadFixture(rel);
  const owner = { id: fx.job_id, identity_hash: fx.identity_hash };
  const heads = new Map();
  const out = new Map();
  for (const frame of fx.frames) {
    const { epoch, seals } = frame.discovery;
    for (const seal of seals) {
      const key = `${epoch}/${seal.log}`;
      const built = buildSegment(
        owner,
        epoch,
        seal.log,
        heads.get(key) ?? null,
        seal.first,
        seal.entries,
        seal.digest_before,
        seal.digest_after
      );
      out.set(built.address, built.raw);
      heads.set(key, built.address);
    }
  }
  return out;
}
// A fixture's store (README: `segments_from` minus `omit`, `segments` as they
// are, `corrupt` bytes changed in place), as {address: stored} where stored
// is a Buffer, or {size} for an oversized file.
function fixtureStore(spec) {
  const out = spec.segments_from ? sealedSegments(spec.segments_from) : new Map();
  for (const address of spec.omit ?? []) out.delete(address);
  for (const seg of spec.segments ?? []) {
    const raw =
      typeof seg.hex === 'string'
        ? Buffer.from(seg.hex, 'hex')
        : Buffer.from(JSON.stringify(seg), 'utf8');
    out.set(dsha(raw), raw);
  }
  for (const { address, at, byte } of spec.corrupt ?? []) {
    const raw = Buffer.from(out.get(address));
    raw[at] = byte;
    out.set(address, raw);
  }
  for (const { address, bytes } of spec.oversized ?? []) out.set(address, { size: bytes });
  return out;
}
// Writes one stored segment at `address` as the store's pages rule would
// (gzip when smaller, the format marker first), or an oversized file: plain
// spaces, or gzip-marked (1f 8b 08 00, then spaces).
function writeStored(directory, address, stored, gzip) {
  const root = storeDirectory(directory);
  let bytes;
  if (Buffer.isBuffer(stored)) {
    bytes = stored;
    if (gzip) {
      const compressed = zlib.gzipSync(stored);
      if (compressed.length < stored.length) bytes = compressed;
    }
  } else {
    bytes = Buffer.alloc(stored.size, 0x20);
    if (gzip) bytes.set([0x1f, 0x8b, 8, 0]);
  }
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const marker = path.join(root, 'store-format.json');
    if (!fs.existsSync(marker)) fs.writeFileSync(marker, JSON.stringify({ min_reader: 'A' }));
  }
  fs.writeFileSync(path.join(root, 'pages', `${address}.json`), bytes);
}
// Plants a fixture's job into a live store beside the job `base` the store
// created, with the fixture's id, identity_hash, discovery and cursor and the
// given job fields, and its store's segments. A foreign write: the next lock
// entry of any instance reconciles.
function plantFixture(directory, base, fx, { discovery, store, job = {}, gzip = false } = {}) {
  for (const [address, stored] of fixtureStore(store ?? fx.store))
    writeStored(directory, address, stored, gzip);
  const record = {
    ...base,
    id: fx.record.id,
    identity_hash: fx.record.identity_hash,
    cursor: fx.record.cursor ?? base.cursor,
    discovery: clone(discovery ?? fx.record.discovery),
    state: fx.job_state ?? 'queued',
    ...job,
  };
  plantRecord(directory, record);
  return record;
}
const clone = (v) => JSON.parse(JSON.stringify(v));
// The release events a console spy saw, by level.
function releaseLog(t) {
  const seen = { error: [], warn: [] };
  for (const level of ['error', 'warn'])
    t.mock.method(console, level, (line) => {
      try {
        const event = JSON.parse(line);
        if (event.event === 'READER_DISCOVERY_RELEASED') seen[level].push(event);
      } catch {}
    });
  return seen;
}
const releasedOf = (discovery) =>
  Object.fromEntries(Object.entries(discovery.logs).map(([log, st]) => [log, st.head]));
// The record §7.4 gives a release of `before` with `cause` and `log`.
function expectedRelease(before, cause, log) {
  const released = releasedOf(before.discovery);
  const queued = before.state === 'queued';
  return {
    state: queued ? 'paused' : before.state,
    deferred_requeue: false,
    fence: queued ? null : before.fence,
    discovery: {
      version: 1,
      epoch: before.discovery.epoch,
      logs: {},
      verified: {},
      unavailable: { cause, log, released },
    },
    reason:
      before.state === 'running'
        ? before.reason
        : { code: 'DISCOVERY_UNAVAILABLE', cause, log, released },
  };
}
const releaseView = (r) => ({
  state: r.state,
  deferred_requeue: r.deferred_requeue,
  fence: r.fence,
  discovery: r.discovery,
  reason: r.reason,
});
const listsOf = (store, id) =>
  store.chains.has(id) ? Object.fromEntries(store.chains.get(id)) : undefined;
// Each full-read fixture that releases, and what it releases with.
const RELEASING = [
  ['bad/segment_corrupt_at_reconciliation.json', 'segment_corrupt', 'alt_cells', 'F6'],
  ['bad/head_bytes_disagree.json', 'chain_broken', 'alt_cells', 'R2'],
  ['bad/missing_segment.json', 'segment_missing', 'alt_cells', 'missing'],
  ['bad/segment_oversized.json', 'segment_corrupt', 'alt_cells', 'F6'],
];

test('reconciliation: a full-read fixture is released at startup, that job alone, and the store serves on', (t) => {
  for (const [rel, cause, log, rule] of RELEASING)
    for (const gzip of [false, true]) {
      const fx = loadFixture(rel);
      const name = `${rel} gzip=${gzip}`;
      const { directory, store } = fixture(t, { gzip });
      const other = create(store);
      const base = store.records.get(other.record.id);
      const planted = plantFixture(directory, base, fx, { gzip });
      const seen = releaseLog(t);
      const rules = [];
      const fullRead = ReaderJobStore.prototype._fullRead;
      t.mock.method(ReaderJobStore.prototype, '_fullRead', function (...args) {
        const read = fullRead.apply(this, args);
        if (read.rule) rules.push(read.rule);
        return read;
      });
      // A spy on every open of an oversized file (the fixture's F6 by size).
      const big = (fx.store.oversized ?? []).map((o) =>
        path.join(pagesDir(directory), `${o.address}.json`)
      );
      const opened = [];
      for (const fn of ['readFileSync', 'openSync']) {
        const real = fs[fn];
        t.mock.method(fs, fn, function (target, ...rest) {
          if (big.includes(String(target))) opened.push(fn);
          return real.call(this, target, ...rest);
        });
      }
      const restarted = new ReaderJobStore({ directory, gzip });
      t.mock.restoreAll();
      assert.equal(restarted.failure, null, `${name}: the store does not fail`);
      assert.deepEqual(rules, [rule], `${name}: the full read meets ${rule}`);
      const got = restarted.records.get(fx.record.id);
      const want = expectedRelease(planted, cause, log);
      if (fx.expect.reconciliation) assert.deepEqual(want, fx.expect.reconciliation, name);
      assert.deepEqual(releaseView(got), want, `${name}: the release record`);
      for (const key of ['attempt', 'queued_at', 'queue_order', 'cancel_requested'])
        assert.equal(got[key], planted[key], `${name}: keeps ${key}`);
      assert.equal(listsOf(restarted, fx.record.id), undefined, `${name}: no list`);
      // One release event, at error level for segment_corrupt alone.
      const level = cause === 'segment_corrupt' ? 'error' : 'warn';
      assert.deepEqual(
        seen[level],
        [{ event: 'READER_DISCOVERY_RELEASED', job: fx.record.id, cause, log }],
        `${name}: one ${level} line`
      );
      assert.deepEqual(seen[level === 'error' ? 'warn' : 'error'], [], name);
      if (fx.expect.logged) assert.equal(fx.expect.logged, level);
      if (fx.expect.store_fails !== undefined) assert.equal(fx.expect.store_fails, false);
      if (fx.expect.opened) assert.deepEqual(opened, fx.expect.opened, `${name}: never opened`);
      // The released job is never dispatched; the other one leases and commits.
      const lease = restarted.lease();
      assert.equal(lease.id, other.record.id, `${name}: the other job leases`);
      assert.equal(commit(restarted, lease, undefined, { phase: 'more' }).state, 'running');
      assert.equal(restarted.listQueued().length, 0);
    }
});

test('reconciliation: a live instance reconciles at its next lock entry after a foreign write', (t) => {
  const fx = loadFixture('bad/segment_corrupt_at_reconciliation.json');
  const { directory, store } = fixture(t);
  const other = create(store);
  const seen = releaseLog(t);
  const planted = plantFixture(directory, store.records.get(other.record.id), fx);
  // inspect() reads through _cached: the moved generation takes the lock.
  assert.deepEqual(
    releaseView(store.inspect(fx.record.id)),
    expectedRelease(planted, 'segment_corrupt', 'alt_cells')
  );
  assert.equal(seen.error.length, 1);
  assert.equal(store.failure, null);
  // The release is published: another instance's entry reconciles nothing more.
  const second = new ReaderJobStore({ directory });
  assert.deepEqual(
    second.records.get(fx.record.id).discovery,
    store.inspect(fx.record.id).discovery
  );
  assert.equal(seen.error.length, 1, 'a released record is never read again');
});

test("reconciliation: the corrupt fixture's structural control is chain_broken", (t) => {
  const fx = loadFixture('bad/segment_corrupt_at_reconciliation.json');
  for (const c of fx.controls) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const planted = plantFixture(directory, store.records.get(other.record.id), fx, {
      discovery: c.discovery,
      store: c.store,
    });
    const restarted = new ReaderJobStore({ directory });
    assert.deepEqual(
      releaseView(restarted.records.get(fx.record.id)),
      expectedRelease(planted, c.expect.cause, c.expect.log),
      c.name
    );
  }
});

test('reconciliation: a chain that reads installs its lists, in read order, and saves nothing', (t) => {
  const cases = [
    ['good/lease_incremental_walk.json', (fx) => fx.expect.full],
    ['bad/verified_ahead_of_head.json', (fx) => fx.expect.resume],
    ['bad/verified_bytes_ahead.json', (fx) => fx.expect.resume],
    ['bad/verified_bytes_disagree.json', (fx) => fx.expect.resume],
  ];
  for (const [rel, expectOf] of cases)
    for (const gzip of [false, true]) {
      const fx = loadFixture(rel);
      const name = `${rel} gzip=${gzip}`;
      const { directory, store } = fixture(t, { gzip });
      const other = create(store);
      plantFixture(directory, store.records.get(other.record.id), fx, { gzip });
      const file = path.join(storeDirectory(directory), 'records', `${fx.record.id}.json`);
      const before = fs.readFileSync(file);
      const read = [];
      const segment = ReaderJobStore.prototype._segment;
      t.mock.method(ReaderJobStore.prototype, '_segment', function (hash, expect, ...rest) {
        if (expect !== null) read.push(hash);
        return segment.call(this, hash, expect, ...rest);
      });
      // A live instance's next entry: no startup pass pauses or sweeps.
      store.inspect(other.record.id);
      t.mock.restoreAll();
      const want = expectOf(fx);
      assert.deepEqual(read, want.read, `${name}: read from each head back`);
      assert.deepEqual(listsOf(store, fx.record.id), want.addresses, `${name}: the lists`);
      assert.ok(fs.readFileSync(file).equals(before), `${name}: nothing is saved`);
      assert.equal(store.records.get(fx.record.id).discovery.unavailable, null);
    }
});

test('reconciliation: the read-back fixtures are chain_broken by F3, and a replacing decoder is not', (t) => {
  // An entry past ENTRY_DEPTH (bad/entry_over_depth.json) and a lone 0xFF
  // byte (good/codec_error_mapping.json's persisted_bytes): address-valid
  // segments whose content fails F3. Their fixture job ids are not store ids,
  // so each segment is re-addressed under the planted job's id.
  const depth = loadFixture('bad/entry_over_depth.json');
  const codec = loadFixture('good/codec_error_mapping.json');
  const cases = [
    ['entry_over_depth read_back', depth.read_back, 'F3'],
    ['entry_over_depth read_back_control', depth.read_back_control, null],
    ...codec.persisted_bytes
      .filter((p) => p.read_back)
      .map((p) => [`persisted_bytes ${p.name}`, p.read_back, 'F3']),
  ];
  assert.ok(cases.length >= 3);
  for (const [name, rb, rule] of cases)
    for (const replacing of [false, true]) {
      const { directory, store } = fixture(t);
      const other = create(store);
      const base = store.records.get(other.record.id);
      const [stored] = fixtureStore(rb.store).values();
      const raw = Buffer.from(
        stored.toString('latin1').replace(`"job_id":"${rb.record.id}"`, `"job_id":"${base.id}"`),
        'latin1'
      );
      assert.notDeepEqual(raw, stored, `${name}: re-addressed`);
      const [log] = Object.keys(rb.record.discovery.logs);
      const discovery = clone(rb.record.discovery);
      discovery.logs[log].head = dsha(raw);
      writeStored(directory, dsha(raw), raw, false);
      plantRecord(directory, {
        ...base,
        identity_hash: rb.record.identity_hash,
        discovery,
      });
      if (replacing)
        t.mock.method(ReaderJobStore.prototype, '_segmentText', (buf) => buf.toString('utf8'));
      const rules = [];
      const fullRead = ReaderJobStore.prototype._fullRead;
      t.mock.method(ReaderJobStore.prototype, '_fullRead', function (...args) {
        const read = fullRead.apply(this, args);
        rules.push(read.rule ?? null);
        return read;
      });
      store.inspect(base.id);
      t.mock.restoreAll();
      const got = store.records.get(base.id).discovery;
      if (rule === null) {
        assert.deepEqual(rules, [null], `${name}: passes`);
        assert.equal(got.unavailable, null);
        continue;
      }
      if (!replacing) {
        assert.deepEqual(rules, ['F3'], `${name}: F3 under the fatal decode`);
        assert.equal(got.unavailable.cause, 'chain_broken');
        assert.equal(got.unavailable.log, log);
      } else if (name.startsWith('persisted_bytes')) {
        // The replacing decoder reads U+FFFD: no F3, so the fault the fatal
        // decode found is invisible to it (it meets R2's bytes instead).
        assert.notDeepEqual(rules, ['F3'], `${name}: a replacing decode is not F3`);
      }
    }
});

test('reconciliation: a failed bounded inflation is segment_corrupt', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const { directory, store } = fixture(t, { gzip: true });
  const other = create(store);
  const planted = plantFixture(directory, store.records.get(other.record.id), fx, {
    gzip: true,
  });
  // alt_cells' head, as a gzip member whose deflate stream is cut short.
  const head = fx.record.discovery.logs.alt_cells.head;
  const file = path.join(pagesDir(directory), `${head}.json`);
  const whole = fs.readFileSync(file);
  assert.equal(whole[0], 0x1f, 'stored gzip');
  fs.writeFileSync(file, Buffer.concat([whole.subarray(0, 20), whole.subarray(whole.length - 8)]));
  store.inspect(other.record.id);
  assert.deepEqual(
    releaseView(store.records.get(fx.record.id)),
    expectedRelease(planted, 'segment_corrupt', 'alt_cells')
  );
});

// A real chain of `n` segments of `log` for `record`: entries, digests and
// byte totals as the write path builds them, so its full read passes.
function realChain(record, log, n, { epoch = 0 } = {}) {
  let state = {
    head: null,
    segments: 0,
    count: 0,
    bytes: 0,
    digest: domainDigest(DOMAINS.log(log)),
  };
  const raws = [];
  for (let i = 0; i < n; i++) {
    const entries = [0, 1, 2, 3].map((k) => [`${log}-${i}`, k]);
    let digest = state.digest;
    let bytes = 0;
    for (const entry of entries) {
      digest = digestStep(digest, JSON.stringify(entry));
      bytes += Buffer.byteLength(JSON.stringify(entry));
    }
    const built = buildSegment(
      record,
      epoch,
      log,
      state.head,
      state.count,
      entries,
      state.digest,
      digest
    );
    raws.push(built.raw);
    state = {
      head: built.address,
      segments: state.segments + 1,
      count: state.count + entries.length,
      bytes: state.bytes + bytes,
      digest,
    };
  }
  return {
    raws,
    state,
    empty: { head: null, segments: 0, count: 0, bytes: 0, digest: domainDigest(DOMAINS.log(log)) },
  };
}
// A record of `base`'s job planted under `id` with real chains of `logs`
// ({log: n}); `damage(raws)` may change the stored segments.
function plantReal(directory, base, id, logs, { job = {}, damage = null, gzip = false } = {}) {
  const owner = { ...base, id };
  const discovery = { version: 1, epoch: 0, logs: {}, verified: {}, unavailable: null };
  const stored = [];
  for (const [log, n] of Object.entries(logs)) {
    const c = realChain(owner, log, n);
    discovery.logs[log] = c.state;
    discovery.verified[log] = c.empty;
    stored.push(...c.raws.map((raw) => [dsha(raw), raw]));
  }
  for (const [address, raw] of damage ? damage(stored) : stored)
    writeStored(directory, address, raw, gzip);
  const record = { ...base, id, discovery, ...job };
  plantRecord(directory, record);
  return record;
}

test('reconciliation: one bad chain among good ones releases that job only', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const ids = ['a', 'b', 'c', 'd'].map((c) => `reader_${c.repeat(64)}`);
  const planted = ids.map((id, i) =>
    plantReal(
      directory,
      base,
      id,
      { seen: 2, alt_cells: 3 },
      {
        // the second job's alt_cells head is missing from the store
        damage: i === 1 ? (stored) => stored.filter((_, k) => k !== stored.length - 1) : null,
      }
    )
  );
  const seen = releaseLog(t);
  const restarted = new ReaderJobStore({ directory });
  assert.equal(restarted.failure, null);
  assert.deepEqual(
    releaseView(restarted.records.get(ids[1])),
    expectedRelease(planted[1], 'segment_missing', 'alt_cells')
  );
  assert.equal(seen.warn.length, 1);
  for (const i of [0, 2, 3]) {
    assert.equal(restarted.records.get(ids[i]).discovery.unavailable, null, ids[i]);
    assert.deepEqual(Object.keys(listsOf(restarted, ids[i])), ['seen', 'alt_cells']);
    assert.equal(listsOf(restarted, ids[i]).alt_cells.length, 3);
    assert.equal(
      listsOf(restarted, ids[i]).alt_cells.at(-1),
      planted[i].discovery.logs.alt_cells.head
    );
  }
});

test("reconciliation: good/release_fencing.json's releases, by one instance during another's lease", (t) => {
  const fx = loadFixture('good/release_fencing.json');
  const walk = loadFixture('good/lease_incremental_walk.json');
  for (const c of fx.cases) {
    const ev = c.events[0];
    assert.equal(ev.by, 'reconciliation');
    const { directory, store: a } = fixture(t);
    const b = new ReaderJobStore({ directory });
    const other = create(a);
    // The cause the event names, made real: alt_cells' oldest segment gone
    // (segment_missing), or its count off by one from its chain (chain_broken).
    const discovery = clone(fx.record.discovery);
    const spec = clone(walk.store);
    if (ev.cause === 'segment_missing') spec.omit = [walk.addresses.alt_cells[0]];
    else if (ev.cause === 'chain_broken') discovery.logs.alt_cells.count -= 1;
    else assert.fail(`no setup for ${ev.cause}`);
    const planted = plantFixture(directory, a.records.get(other.record.id), fx, {
      discovery,
      store: spec,
      job: c.job,
    });
    // Instance A's next lock entry releases; B holds the lease (its fields
    // are the record's) and makes no write.
    a.inspect(fx.record.id);
    const [want] = c.expect;
    assert.equal(want.saved, true);
    const got = b.inspect(fx.record.id);
    for (const [key, value] of Object.entries(want.job))
      assert.deepEqual(got[key], value, `${c.name}: ${key}`);
    assert.deepEqual(
      releaseView(got),
      { ...expectedRelease({ ...planted, discovery: fx.record.discovery }, ev.cause, ev.log) },
      c.name
    );
  }
});

test('reconciliation: a paused job deferred to requeue is released without it, and never requeued', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'e'.repeat(64)}`;
  const planted = plantReal(
    directory,
    base,
    id,
    { seen: 1 },
    {
      job: {
        state: 'paused',
        deferred_requeue: true,
        reason: { code: 'STORE_RECOUNTING', message: 'Reader storage usage is being recounted.' },
      },
      damage: () => [],
    }
  );
  store.inspect(other.record.id);
  const got = store.records.get(id);
  assert.deepEqual(releaseView(got), expectedRelease(planted, 'segment_missing', 'seen'));
  assert.equal(got.deferred_requeue, false);
  // The other job leases; the released one is never promoted to the queue.
  assert.equal(store.lease().id, other.record.id);
  assert.equal(store.records.get(id).state, 'paused');
  assert.equal(store.listQueued().length, 0);
});

test('reconciliation: a throw part way is retried at the next lock entry, after the generation is published', async (t) => {
  for (const kind of ['status', 'no status']) {
    const { directory, store } = fixture(t);
    const root = storeDirectory(directory);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const ids = ['1', '2'].map((c) => `reader_${c.repeat(64)}`);
    for (const id of ids) plantReal(directory, base, id, { seen: 1 }, { damage: () => [] });
    const fullRead = ReaderJobStore.prototype._fullRead;
    let thrown = 0;
    // The first job's release lands, then the second job's full read throws once.
    t.mock.method(ReaderJobStore.prototype, '_fullRead', function (record, ...rest) {
      if (record.id === ids[1] && !thrown++)
        throw kind === 'status'
          ? Object.assign(new Error('busy'), { code: 'STORE_BUSY', status: 503 })
          : new Error('EIO');
      return fullRead.call(this, record, ...rest);
    });
    const warnings = [];
    t.mock.method(console, 'warn', (line) => warnings.push(JSON.parse(line)));
    const onDisk = () =>
      JSON.parse(fs.readFileSync(path.join(root, 'generation'), 'utf8')).generation;
    const unavailable = (id) => store.records.get(id).discovery.unavailable?.cause ?? null;
    if (kind === 'status') {
      // A status error from inside the hold: _open rethrows it unchanged.
      assert.throws(() => store.inspect(other.record.id), { code: 'STORE_BUSY' });
      assert.equal(store.failure, null, 'a status error does not fail the store');
      assert.equal(fs.existsSync(path.join(root, 'pending')), false, 'pending is cleared');
      assert.equal(store.generation, -1, 'the next entry reloads');
      const published = onDisk();
      assert.equal(unavailable(ids[0]), 'segment_missing', 'the first release landed');
      assert.equal(unavailable(ids[1]), null);
      store.inspect(other.record.id);
      assert.equal(unavailable(ids[1]), 'segment_missing', 'reconciled at the next entry');
      assert.ok(onDisk() > published);
      assert.equal(store.generation, onDisk());
    } else {
      // Inside recount()'s own _locked: logged as READER_RECOUNT_FAILED and
      // retried; never this.failure.
      assert.equal(await store.recount(), true);
      assert.equal(store.failure, null, 'no failure');
      assert.ok(
        warnings.some((w) => w.event === 'READER_RECOUNT_FAILED' && w.message === 'EIO'),
        'the recount logged it'
      );
      assert.equal(unavailable(ids[0]), 'segment_missing');
      assert.equal(unavailable(ids[1]), 'segment_missing', 'the retry reconciled the rest');
      assert.equal(fs.existsSync(path.join(root, 'pending')), false);
      assert.equal(store.generation, onDisk());
      assert.equal(store.usage, store._usage(), 'the accepted recount is exact');
    }
    t.mock.restoreAll();
  }
});

test('reconciliation: every release of a fixture record, at its widest queue fields, is no larger', (t) => {
  // §7.4's property, on the store: each well-formed fixture record, in every
  // §7.1 state, its attempt, fence, lease and queue fields at their widest,
  // released with each cause a full read gives. The size is asserted before
  // the save; a release that grows is refused without a status and saves nothing.
  const rels = [
    'good/lease_incremental_walk.json',
    'bad/segment_corrupt_at_reconciliation.json',
    'bad/missing_segment.json',
    'bad/head_bytes_disagree.json',
    'bad/segment_oversized.json',
    'bad/verified_ahead_of_head.json',
    'good/release_fencing.json',
  ];
  const WIDE = Number.MAX_SAFE_INTEGER;
  gcOnly(t); // _release is called directly, on records reconciliation never saw
  const { directory, store } = fixture(t, { maxBytes: 1024 * 1024 * 1024 });
  const other = create(store);
  const base = store.records.get(other.record.id);
  let n = 0;
  for (const rel of rels)
    for (const state of ['queued', 'running', 'paused', 'cancelled'])
      for (const cause of ['segment_missing', 'segment_corrupt', 'chain_broken']) {
        const fx = loadFixture(rel);
        const id = `reader_${(n++).toString(16).padStart(64, '0')}`;
        const running = state === 'running';
        const record = {
          ...base,
          id,
          identity_hash: fx.record.identity_hash,
          discovery: clone(fx.record.discovery),
          state,
          attempt: WIDE,
          fence: running ? 'f'.repeat(64) : null,
          lease_expires_at: running ? WIDE : null,
          queued_at: WIDE,
          queue_order: WIDE,
          cancel_requested: running,
          deferred_requeue: state === 'paused',
          reason: running ? null : { code: 'INTERRUPTED', message: 'x' },
        };
        plantRecord(directory, record);
        store._open(() => {
          const before = store.recordBytes.get(id);
          // Lists as a full read would have installed them: a release drops
          // them after its save (BB8 6710235213, the _release survivor).
          store.chains.set(id, new Map([['alt_cells', ['0'.repeat(64)]]]));
          const saved = store._release(store.records.get(id), { cause, log: 'alt_cells' });
          assert.ok(store.recordBytes.get(id) < before, `${rel} ${state} ${cause}`);
          assert.equal(store.chains.has(id), false, `${rel} ${state} ${cause}: no lists`);
          assert.equal(saved.discovery.unavailable.cause, cause);
        });
      }
  // A growth is this image's defect: thrown without a status before the save.
  const fx = loadFixture('good/lease_incremental_walk.json');
  const id = `reader_${'9'.repeat(64)}`;
  plantRecord(directory, { ...base, id, discovery: clone(fx.record.discovery) });
  const file = path.join(storeDirectory(directory), 'records', `${id}.json`);
  const before = fs.readFileSync(file);
  assert.throws(
    () =>
      store._open(() => {
        store.recordBytes.set(id, 100);
        store._release(store.records.get(id), { cause: 'chain_broken', log: 'seen' });
      }),
    { code: 'STORAGE_UNAVAILABLE' }
  );
  assert.ok(fs.readFileSync(file).equals(before), 'nothing saved');
  assert.match(store.failure, /would grow its record from 100 to/);
});

test('reconciliation: the full read covers exactly the records the GC roots', (t) => {
  // Every §7.1 and other state × every shape (none, null, live, released,
  // malformed): the records _reconcile full-reads and the records the
  // startup mark roots are the same set, both from _liveDiscovery.
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const shapes = {
    absent: undefined,
    null: null,
    live: 'live',
    released: 'released',
    malformed: {},
  };
  let n = 0;
  const live = new Set();
  for (const state of ['queued', 'running', 'paused', 'cancelled', 'completed', 'expired'])
    for (const [shape, value] of Object.entries(shapes)) {
      const id = `reader_${(n++).toString(16).padStart(64, 'a')}`;
      if (value === 'live' || value === 'released') {
        const r = plantReal(directory, base, id, { seen: 1 }, { job: { state } });
        if (value === 'released')
          plantRecord(directory, {
            ...r,
            discovery: {
              ...r.discovery,
              logs: {},
              verified: {},
              unavailable: { cause: 'chain_broken', log: null, released: {} },
            },
          });
        else if (['queued', 'running', 'paused', 'cancelled'].includes(state)) live.add(id);
      } else {
        const record = { ...base, id, state };
        if (shape !== 'absent') record.discovery = value;
        plantRecord(directory, record);
      }
    }
  const read = new Set();
  const rooted = new Set();
  const fullRead = ReaderJobStore.prototype._fullRead;
  t.mock.method(ReaderJobStore.prototype, '_fullRead', function (record, ...rest) {
    read.add(record.id);
    return fullRead.call(this, record, ...rest);
  });
  const roots = ReaderJobStore.prototype._discoveryRoots;
  t.mock.method(ReaderJobStore.prototype, '_discoveryRoots', function (record) {
    const out = roots.call(this, record);
    if (out.length) rooted.add(record.id);
    return out;
  });
  const asked = { reconcile: 0, roots: 0 };
  const liveOf = ReaderJobStore.prototype._liveDiscovery;
  let where = null;
  t.mock.method(ReaderJobStore.prototype, '_liveDiscovery', function (record) {
    if (where) asked[where]++;
    return liveOf.call(this, record);
  });
  const reconcile = ReaderJobStore.prototype._reconcile;
  t.mock.method(ReaderJobStore.prototype, '_reconcile', function () {
    where = 'reconcile';
    try {
      return reconcile.call(this);
    } finally {
      where = 'roots';
    }
  });
  const restarted = new ReaderJobStore({ directory });
  t.mock.restoreAll();
  assert.equal(restarted.failure, null);
  assert.deepEqual([...read].sort(), [...live].sort(), 'the full read reads the live records');
  assert.deepEqual([...rooted].sort(), [...live].sort(), 'and the GC roots the same ones');
  assert.ok(asked.reconcile > 0 && asked.roots > 0, 'both ask _liveDiscovery');
});

test('reconciliation: a job drops its lists when it is deleted, expires, completes or reloads', async (t) => {
  const { directory, store } = fixture(t, { ttlMs: 10 ** 9 });
  const other = create(store);
  const base = store.records.get(other.record.id);
  const ids = ['5', '6', '7'].map((c) => `reader_${c.repeat(64)}`);
  for (const id of ids) plantReal(directory, base, id, { seen: 2 });
  store.inspect(other.record.id);
  for (const id of ids) assert.equal(listsOf(store, id).seen.length, 2, id);
  // delete (a tombstone)
  store.delete(ids[0], store.capabilityFor(ids[0], base.viewer), base.viewer);
  assert.equal(listsOf(store, ids[0]), undefined, 'deleted');
  // expiry (a tombstone): _pruneExpired at its expiry
  store._open(() => store._tombstone(store.records.get(ids[1]), 'expired'));
  assert.equal(listsOf(store, ids[1]), undefined, 'expired');
  // complete()
  store._open(() =>
    store._save({ ...store.records.get(ids[2]), cursor: { phase: 'done', done: true } })
  );
  assert.equal(await store.recount(), true); // usage known, so completion can write
  const lease = store.lease(ids[2]);
  assert.equal(listsOf(store, ids[2]).seen.length, 2);
  assert.equal(finish(store, lease, 0).state, 'completed');
  assert.equal(listsOf(store, ids[2]), undefined, 'completed');
  // _reload clears every list; the reconciliation after it rebuilds the live ones.
  const id = `reader_${'8'.repeat(64)}`;
  const planted = plantReal(directory, base, id, { seen: 1 });
  store.inspect(other.record.id);
  assert.equal(listsOf(store, id).seen.length, 1, 'a foreign write reconciles');
  plantRecord(directory, planted); // another foreign write
  store._enterLock();
  assert.equal(store.chains.size, 0, '_reload clears them');
  store._leaveLock();
  store.inspect(other.record.id);
  assert.equal(listsOf(store, id), undefined, 'an equal generation does not reconcile');
  store.generation = -1;
  store.inspect(other.record.id);
  assert.equal(listsOf(store, id).seen.length, 1, 'the next reload reconciles');
});

test('reconciliation: a gap in `first` between two linked segments is chain_broken by R2', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'f'.repeat(64)}`;
  const owner = { ...base, id };
  // Two linked segments whose second starts one entry late; the record's
  // totals follow the chain, so only the link between them is wrong.
  const a = realChain(owner, 'seen', 1);
  const entries = [['gap', 0]];
  const after = digestStep(a.state.digest, JSON.stringify(entries[0]));
  const b = buildSegment(
    owner,
    0,
    'seen',
    a.state.head,
    a.state.count + 1,
    entries,
    a.state.digest,
    after
  );
  for (const raw of [...a.raws, b.raw]) writeStored(directory, dsha(raw), raw, false);
  const discovery = {
    version: 1,
    epoch: 0,
    logs: {
      seen: {
        head: b.address,
        segments: 2,
        count: a.state.count + 2,
        bytes: a.state.bytes + Buffer.byteLength(JSON.stringify(entries[0])),
        digest: after,
      },
    },
    verified: { seen: a.empty },
    unavailable: null,
  };
  const planted = { ...base, id, discovery };
  plantRecord(directory, planted);
  const rules = [];
  const fullRead = ReaderJobStore.prototype._fullRead;
  t.mock.method(ReaderJobStore.prototype, '_fullRead', function (...args) {
    const read = fullRead.apply(this, args);
    rules.push(read.rule ?? null);
    return read;
  });
  store.inspect(other.record.id);
  assert.deepEqual(rules, ['R2']);
  assert.deepEqual(
    releaseView(store.records.get(id)),
    expectedRelease(planted, 'chain_broken', 'seen')
  );
});

test('reconciliation: a release of a record already released saves nothing (the first trace wins)', (t) => {
  gcOnly(t);
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'0'.repeat(63)}1`;
  const released = {
    version: 1,
    epoch: 0,
    logs: {},
    verified: {},
    unavailable: { cause: 'segment_missing', log: 'seen', released: { seen: null } },
  };
  plantRecord(directory, { ...base, id, discovery: released });
  const file = path.join(storeDirectory(directory), 'records', `${id}.json`);
  store.inspect(id);
  const before = fs.readFileSync(file);
  store._open(() => store._release(store.records.get(id), { cause: 'chain_broken', log: null }));
  assert.ok(fs.readFileSync(file).equals(before));
  assert.equal(store.records.get(id).discovery.unavailable.cause, 'segment_missing');
});

// ── a malformed record.discovery (§2.7, §7.4; BB8 6700200435, condition 4):
// released chain_broken, log null, from the reconciliation that finds it;
// saved at once when _capacity admits it, otherwise pending and shown.
const U2 = (released) => ({
  code: 'DISCOVERY_UNAVAILABLE',
  cause: 'chain_broken',
  log: null,
  released,
});
const malformedRelease = (epoch, released) => ({
  version: 1,
  epoch,
  logs: {},
  verified: {},
  unavailable: { cause: 'chain_broken', log: null, released },
});
function eventsOf(t) {
  const seen = [];
  for (const level of ['error', 'warn'])
    t.mock.method(console, level, (line) => {
      try {
        seen.push({ level, ...JSON.parse(line) });
      } catch {}
    });
  return seen;
}
const H = 'a'.repeat(64);
const goodState = { head: H, segments: 1, count: 4, bytes: 16, digest: 'b'.repeat(64) };
const MALFORMED = [
  ['an empty object', {}, 0, {}],
  ['a string', 'x', 0, {}],
  ['an array', [], 0, {}],
  [
    'a log name outside §2.3',
    {
      version: 1,
      epoch: 3,
      logs: { seen: goodState, alt_cellz: goodState },
      verified: {},
      unavailable: null,
    },
    3,
    { seen: H },
  ],
  [
    'a head that is not 64-hex',
    {
      version: 1,
      epoch: 2,
      logs: { seen: { ...goodState, head: 'ABC' } },
      verified: {},
      unavailable: null,
    },
    2,
    { seen: null },
  ],
  [
    'a non-integer epoch',
    { version: 1, epoch: 1.5, logs: { seen: goodState }, verified: {}, unavailable: null },
    0,
    { seen: H },
  ],
];

test('malformed discovery: a queued record inside its reservation is saved paused at startup, before usage is known', (t) => {
  for (const [name, discovery, epoch, released] of MALFORMED) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const id = `reader_${'c'.repeat(64)}`;
    plantRecord(directory, { ...base, id, discovery });
    const seen = eventsOf(t);
    const usage = [];
    const save = ReaderJobStore.prototype._save;
    t.mock.method(ReaderJobStore.prototype, '_save', function (input, ...rest) {
      if (input.id === id) usage.push(this.usage);
      return save.call(this, input, ...rest);
    });
    const restarted = new ReaderJobStore({ directory });
    t.mock.restoreAll();
    assert.equal(restarted.failure, null, name);
    assert.deepEqual(usage, [null], `${name}: saved once, while usage was unknown`);
    const got = restarted.records.get(id);
    assert.equal(got.state, 'paused', name);
    assert.equal(got.fence, null);
    assert.equal(got.deferred_requeue, false);
    assert.deepEqual(got.reason, U2(released), name);
    assert.deepEqual(got.discovery, malformedRelease(epoch, released), name);
    assert.equal(restarted.pendingRelease.size, 0);
    assert.deepEqual(
      seen.filter((e) => e.event === 'READER_DISCOVERY_MALFORMED'),
      [{ level: 'error', event: 'READER_DISCOVERY_MALFORMED', job: id }],
      `${name}: logged once, at error level`
    );
    const view = restarted.get(id, restarted.capabilityFor(id, base.viewer), base.viewer);
    assert.equal(view.state, 'paused');
    assert.deepEqual(view.reason, U2(released));
    assert.equal(restarted.lease().id, other.record.id, `${name}: the next job leases`);
  }
});

test('malformed discovery: past its reservation with usage unknown, the release is pending, shown and refused, until the recount saves it', async (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'d'.repeat(64)}`;
  const padded = {
    ...base,
    id,
    request: { ...base.request, pad: 'p'.repeat(20_000) },
    discovery: {},
  };
  plantRecord(directory, padded);
  const seen = eventsOf(t);
  const capability = store.capabilityFor(id, base.viewer);
  // A live instance's next entry: the foreign write leaves usage unknown.
  const view = store.get(id, capability, base.viewer);
  assert.equal(store.usage, null);
  assert.ok(store.pendingRelease.has(id), 'pending');
  assert.ok(
    seen.some(
      (e) => e.event === 'READER_REPAIR_DEFERRED' && e.job === id && e.code === 'STORE_RECOUNTING'
    ),
    'the refused save is logged'
  );
  const file = path.join(storeDirectory(directory), 'records', `${id}.json`);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).discovery, {}, 'nothing saved yet');
  for (const shown of [view, store.inspect(id)]) {
    assert.equal(shown.state, 'paused');
    assert.deepEqual(shown.reason, U2({}));
    assert.deepEqual(shown.discovery, malformedRelease(0, {}));
  }
  const unavailable = (e) =>
    e.code === 'DISCOVERY_UNAVAILABLE' &&
    e.status === 409 &&
    e.cause === 'chain_broken' &&
    e.log === null;
  assert.throws(() => store.resume(id, capability, base.viewer, identity), unavailable);
  assert.throws(() => store.workerPayload(id), unavailable);
  assert.equal(store.lease(id), null, 'never leased by id');
  assert.equal(
    store.listQueued().some((r) => r.id === id),
    false
  );
  assert.equal(store.lease().id, other.record.id, 'lease() skips it');
  assert.equal(seen.filter((e) => e.event === 'READER_DISCOVERY_MALFORMED').length, 1);
  // The recount's acceptance is the first point usage is known: it saves.
  assert.equal(await store.recount(), true);
  assert.equal(store.pendingRelease.has(id), false);
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  const strip = ({ updated_at: _u, record_digest: _d, ...rest }) => rest;
  assert.deepEqual(strip(disk), strip(view), 'the saved record is the one the view showed');
});

test('malformed discovery: at full quota startup succeeds, lease() never throws, and the save lands once room is freed', async (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = clone(store.records.get(other.record.id)); // before it holds evidence
  const lease = store.lease();
  // committed evidence, to free later
  commit(store, lease, [{ id: 'x', blob: 'e'.repeat(40_000) }], { phase: 'more' });
  store.pause(lease.id, lease.attempt, lease.fence, { code: 'INTERRUPTED', message: 'x' });
  const id = `reader_${'b'.repeat(64)}`;
  plantRecord(directory, {
    ...base,
    id,
    state: 'queued',
    request: { pad: 'p'.repeat(20_000) },
    discovery: [],
  });
  // The quota: what _usage counts, every reservation, and 64 bytes, so the
  // release's growth (more than 64 bytes past its reservation) does not fit.
  const root = storeDirectory(directory);
  let usage = fs.statSync(path.join(root, 'capability-key')).size;
  let slack = 0;
  for (const dir of ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
    for (const name of fs.readdirSync(path.join(root, dir))) {
      const size = fs.statSync(path.join(root, dir, name)).size;
      usage += size;
      if (dir === 'records') slack += Math.max(0, RESERVE - size);
    }
  const seen = eventsOf(t);
  const quota = new ReaderJobStore({ directory, maxBytes: usage + slack + 64 });
  assert.equal(quota.failure, null, 'startup succeeds');
  assert.ok(quota.pendingRelease.has(id), 'pending at full quota');
  assert.ok(
    seen.some((e) => e.event === 'READER_REPAIR_DEFERRED' && e.code === 'RESOURCE_LIMIT'),
    'the refused save is logged'
  );
  const shown = () => quota.inspect(id);
  for (let i = 0; i < 3; i++) {
    assert.doesNotThrow(() => quota.lease(), 'lease() never throws');
    assert.equal(shown().state, 'paused');
    assert.deepEqual(shown().reason, U2({}));
  }
  assert.ok(quota.pendingRelease.has(id), 'still pending');
  // Free room: delete the committed job and collect its evidence.
  quota.delete(other.record.id, quota.capabilityFor(other.record.id, base.viewer), base.viewer);
  quota.prune();
  quota.lease();
  assert.equal(quota.pendingRelease.has(id), false, 'saved once room is freed');
  assert.deepEqual(quota.records.get(id).discovery, malformedRelease(0, {}));
});

test('malformed discovery: paused, cancelled and running records keep their state; a running one keeps its lease', (t) => {
  for (const state of ['paused', 'cancelled', 'running']) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const id = `reader_${'e'.repeat(63)}0`;
    const running = state === 'running';
    const job = {
      ...base,
      id,
      state,
      attempt: 2,
      fence: running ? 'f'.repeat(64) : null,
      lease_expires_at: running ? Date.now() + 60_000 : null,
      reason: running ? null : { code: 'INTERRUPTED', message: 'x' },
      discovery: 'x',
    };
    plantRecord(directory, job);
    store.inspect(other.record.id); // a live entry: no startup pause
    const got = store.records.get(id);
    assert.equal(got.state, state);
    assert.equal(got.attempt, 2);
    assert.equal(got.fence, job.fence);
    assert.equal(got.lease_expires_at, job.lease_expires_at);
    assert.deepEqual(got.reason, running ? null : U2({}), state);
    assert.deepEqual(got.discovery, malformedRelease(0, {}));
  }
  // Pending, a running job's view stays running, with the release in
  // discovery only, and its next commit is refused.
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'e'.repeat(63)}1`;
  const fence = 'f'.repeat(64);
  plantRecord(directory, {
    ...base,
    id,
    state: 'running',
    attempt: 1,
    fence,
    lease_expires_at: Date.now() + 60_000,
    request: { pad: 'p'.repeat(20_000) },
    discovery: {},
  });
  const view = store.inspect(id);
  assert.ok(store.pendingRelease.has(id));
  assert.equal(view.state, 'running');
  assert.equal(view.fence, fence);
  assert.equal(view.reason, null);
  assert.deepEqual(view.discovery, malformedRelease(0, {}));
  assert.throws(
    () => store.commitCheckpoint(id, 1, fence, { cursor: { phase: 'more' }, pages: [] }),
    (e) => e.code === 'DISCOVERY_UNAVAILABLE' && e.cause === 'chain_broken' && e.log === null
  );
});

test('malformed discovery: a null or absent discovery is never touched, and a malformed one of a finished job is never read', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const ids = [];
  for (const [i, record] of [
    { ...base, discovery: null },
    { ...base },
    { ...base, state: 'completed', discovery: {} },
    { ...base, state: 'deleted', discovery: 'x' },
  ].entries()) {
    const id = `reader_${String(i).repeat(64)}`;
    ids.push(id);
    plantRecord(directory, { ...record, id });
  }
  const root = path.join(storeDirectory(directory), 'records');
  const before = ids.map((id) => fs.readFileSync(path.join(root, `${id}.json`)));
  const seen = eventsOf(t);
  store.inspect(other.record.id);
  ids.forEach((id, i) =>
    assert.ok(fs.readFileSync(path.join(root, `${id}.json`)).equals(before[i]), id)
  );
  assert.equal(store.pendingRelease.size, 0);
  assert.deepEqual(
    seen.filter((e) => /READER_/.test(e.event ?? '')),
    []
  );
});

test('malformed discovery: a pending paused job deferred to requeue is never promoted, and is logged once across reloads', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'9'.repeat(63)}a`;
  plantRecord(directory, {
    ...base,
    id,
    state: 'paused',
    deferred_requeue: true,
    reason: { code: 'STORE_RECOUNTING', message: 'x' },
    request: { pad: 'p'.repeat(20_000) },
    discovery: { version: 1 },
  });
  const seen = eventsOf(t);
  store.inspect(other.record.id);
  plantRecord(directory, { ...base, id: `reader_${'9'.repeat(63)}b`, state: 'cancelled' }); // another foreign write
  store.inspect(other.record.id);
  assert.ok(store.pendingRelease.has(id), 'pending after both reconciliations');
  assert.equal(seen.filter((e) => e.event === 'READER_DISCOVERY_MALFORMED').length, 1);
  assert.equal(store.lease().id, other.record.id);
  assert.equal(store.records.get(id).state, 'paused', 'never promoted to the queue');
  assert.equal(store.inspect(id).deferred_requeue, false);
});

// ── bad/malformed_record_discovery.json (M1, §2.7; BB8 6709891376, ruling 3) ─
// The fixture's cases and controls on the store: each case once inside its
// reservation, saved at startup before usage is known, and once past it,
// pending on a live instance, shown and refused until the recount saves it.
const MALFORMED_FIXTURE = 'bad/malformed_record_discovery.json';
function plantMalformed(directory, base, fx, c, pad = false) {
  const running = c.start.state === 'running';
  const job = {
    ...base,
    id: fx.record.id,
    ...c.start,
    attempt: 1,
    lease_expires_at: running ? Date.now() + 60_000 : null,
    ...(pad ? { request: { ...base.request, pad: 'p'.repeat(20_000) } } : {}),
    discovery: c.discovery,
  };
  plantRecord(directory, job);
  return job;
}
const refusedM1 = (fx) => (e) =>
  e.code === fx.expect.code &&
  e.status === fx.expect.status &&
  e.cause === fx.expect.cause &&
  e.log === fx.expect.log;

test('malformed discovery: each case of bad/malformed_record_discovery.json is M1, released at startup as the fixture gives', (t) => {
  const fx = loadFixture(MALFORMED_FIXTURE);
  for (const c of fx.cases) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const job = plantMalformed(directory, base, fx, c);
    assert.equal(store._discoveryShape(job), 'malformed', c.name);
    assert.deepEqual(store._discoveryRoots(job), fx.expect.roots, `${c.name}: never a root`);
    const seen = eventsOf(t);
    const saves = [];
    const save = ReaderJobStore.prototype._save;
    t.mock.method(ReaderJobStore.prototype, '_save', function (input, ...rest) {
      if (input.id === job.id) saves.push({ usage: this.usage, record: clone(input) });
      return save.call(this, input, ...rest);
    });
    const restarted = new ReaderJobStore({ directory });
    t.mock.restoreAll();
    assert.equal(restarted.failure !== null, fx.expect.store_fails, `${c.name}: the store serves`);
    // The release is the first save, before usage is known. A running job's
    // release keeps its lease; startup's own INTERRUPTED pause of a running
    // job follows it, once usage is known (Step 7 gives that pause U2).
    const running = c.start.state === 'running';
    assert.deepEqual(
      saves.map((x) => x.usage),
      running ? [null, saves[1]?.usage] : [null],
      `${c.name}: the release is one save, before usage is known`
    );
    if (running) assert.notEqual(saves[1].usage, null);
    const released = saves[0].record;
    assert.deepEqual(releaseView(released), c.expect, `${c.name}: the release`);
    assert.equal(released.attempt, 1, `${c.name}: keeps its attempt`);
    if (running)
      assert.equal(released.lease_expires_at, job.lease_expires_at, `${c.name}: keeps its lease`);
    else assert.deepEqual(releaseView(restarted.records.get(job.id)), c.expect, c.name);
    assert.deepEqual(
      seen.filter((e) => e.event === 'READER_DISCOVERY_MALFORMED'),
      [{ level: fx.expect.logged, event: 'READER_DISCOVERY_MALFORMED', job: job.id }],
      `${c.name}: logged once`
    );
    assert.equal(restarted.lease(job.id), null, `${c.name}: never leased by id`);
    assert.equal(restarted.lease().id, other.record.id, `${c.name}: the next job leases`);
    assert.equal(fx.expect.dispatched, false);
    assert.equal(restarted.pendingRelease.size, 0, `${c.name}: nothing pending`);
  }
});

test('malformed discovery: past its reservation with usage unknown, a fixture release that grows is pending, shown and refused until the recount saves it; one that does not is saved at once', async (t) => {
  const fx = loadFixture(MALFORMED_FIXTURE);
  const strip = ({ updated_at: _u, record_digest: _d, ...rest }) => rest;
  for (const c of fx.cases) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const job = plantMalformed(directory, base, fx, c, true);
    eventsOf(t);
    const view = store.inspect(job.id); // a live instance's next entry
    t.mock.restoreAll();
    assert.equal(store.failure, null, c.name);
    assert.equal(store.usage, null, `${c.name}: usage unknown`);
    assert.deepEqual(releaseView(view), c.expect, `${c.name}: shown as its release`);
    const file = path.join(storeDirectory(directory), 'records', `${job.id}.json`);
    if (c.past_reservation === 'saved') {
      assert.equal(store.pendingRelease.has(job.id), false, `${c.name}: saved at once`);
      assert.deepEqual(releaseView(JSON.parse(fs.readFileSync(file, 'utf8'))), c.expect, c.name);
      continue;
    }
    assert.equal(c.past_reservation, 'pending');
    assert.ok(store.pendingRelease.has(job.id), `${c.name}: pending`);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(file, 'utf8')).discovery,
      c.discovery,
      `${c.name}: nothing saved yet`
    );
    assert.throws(() => store.workerPayload(job.id), refusedM1(fx), c.name);
    if (c.start.state === 'running')
      assert.throws(
        () =>
          store.commitCheckpoint(job.id, 1, c.start.fence, {
            cursor: { phase: 'more' },
            pages: [],
          }),
        refusedM1(fx),
        c.name
      );
    assert.equal(store.lease().id, other.record.id, `${c.name}: lease() skips it`);
    assert.equal(await store.recount(), true);
    assert.equal(store.pendingRelease.has(job.id), false, `${c.name}: saved by the recount`);
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(releaseView(disk), c.expect, `${c.name}: the saved release`);
    assert.deepEqual(strip(disk), strip(store.inspect(job.id)), c.name);
  }
});

test('malformed discovery: the controls of bad/malformed_record_discovery.json are never touched', (t) => {
  const fx = loadFixture(MALFORMED_FIXTURE);
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const root = path.join(storeDirectory(directory), 'records');
  for (const c of fx.controls) {
    assert.equal(c.expect, 'untouched');
    const { discovery: _d, ...without } = base;
    const job = {
      ...without,
      id: fx.record.id,
      ...(Object.hasOwn(c, 'discovery') ? { discovery: c.discovery } : {}),
    };
    plantRecord(directory, job);
    assert.equal(store._discoveryShape(job), 'none', c.name);
    const before = fs.readFileSync(path.join(root, `${job.id}.json`));
    const seen = eventsOf(t);
    store.inspect(other.record.id);
    t.mock.restoreAll();
    assert.ok(fs.readFileSync(path.join(root, `${job.id}.json`)).equals(before), c.name);
    assert.equal(store.pendingRelease.size, 0, c.name);
    assert.deepEqual(
      seen.filter((e) => /READER_/.test(e.event ?? '')),
      [],
      c.name
    );
  }
});

// ── the Step 6 review (D1, D2, G1, B1) ──────────────────────────────────────
test('review D1: a `verified` that does not name the logs of `logs` is malformed, so its release never fails startup', (t) => {
  const missingHead = { ...goodState, bytes: 4 };
  const tailOnly = (log) => ({
    head: null,
    segments: 2,
    count: 9,
    bytes: 0,
    digest: domainDigest(DOMAINS.log(log)),
  });
  const cases = [
    // BB8's repro: a head with no segment file and verified {} grew 1305 → 1409 bytes.
    ['a head, verified empty', { alt_cells: missingHead }, {}, { alt_cells: H }],
    [
      'tails only, whose counts disagree with a null head, verified empty',
      { seen: tailOnly('seen'), alt_cells: tailOnly('alt_cells') },
      {},
      { seen: null, alt_cells: null },
    ],
    [
      'verified naming one of two logs',
      { seen: goodState, alt_cells: missingHead },
      { seen: { ...EMPTY } },
      { seen: H, alt_cells: H },
    ],
  ];
  for (const [name, logs, verified, released] of cases)
    for (const state of ['queued', 'paused', 'cancelled']) {
      const { directory, store } = fixture(t);
      const other = create(store);
      const base = store.records.get(other.record.id);
      const id = `reader_${'e'.repeat(64)}`;
      const discovery = { version: 1, epoch: 0, logs, verified, unavailable: null };
      assert.equal(store._discoveryShape({ discovery }), 'malformed', name);
      plantRecord(directory, {
        ...base,
        id,
        state,
        reason: state === 'queued' ? null : { code: 'INTERRUPTED', message: 'x' },
        discovery,
      });
      eventsOf(t);
      const restarted = new ReaderJobStore({ directory });
      t.mock.restoreAll();
      assert.equal(restarted.failure, null, `${name}, ${state}: startup succeeds`);
      const got = restarted.records.get(id);
      assert.equal(got.state, state === 'queued' ? 'paused' : state, `${name}, ${state}`);
      assert.deepEqual(got.reason, U2(released), `${name}, ${state}`);
      assert.deepEqual(got.discovery, malformedRelease(0, released), `${name}, ${state}`);
      assert.equal(restarted.lease().id, other.record.id, `${name}, ${state}: the store serves`);
    }
});

test('review D1: a mirrored tail whose counts disagree with its null head is R2, and its release shrinks', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'e'.repeat(63)}f`;
  const tail = {
    head: null,
    segments: 2,
    count: 9,
    bytes: 0,
    digest: domainDigest(DOMAINS.log('alt_cells')),
  };
  const discovery = {
    version: 1,
    epoch: 0,
    logs: { alt_cells: tail },
    verified: { alt_cells: { ...EMPTY, digest: tail.digest } },
    unavailable: null,
  };
  assert.equal(store._discoveryShape({ discovery }), 'live');
  assert.deepEqual(store._fullRead({ ...base, id, discovery }, 'alt_cells'), {
    cause: 'chain_broken',
    rule: 'R2',
  });
  plantRecord(directory, { ...base, id, discovery });
  const file = path.join(storeDirectory(directory), 'records', `${id}.json`);
  const before = fs.statSync(file).size;
  releaseLog(t);
  const restarted = new ReaderJobStore({ directory });
  t.mock.restoreAll();
  assert.equal(restarted.failure, null);
  const got = restarted.records.get(id);
  assert.equal(got.state, 'paused');
  assert.deepEqual(got.discovery.unavailable, {
    cause: 'chain_broken',
    log: 'alt_cells',
    released: { alt_cells: null },
  });
  assert.ok(fs.statSync(file).size < before, 'the release is no larger');
});

test('review D2: deleting a job whose release is pending drops the pending release', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'d'.repeat(63)}e`;
  plantRecord(directory, {
    ...base,
    id,
    request: { ...base.request, pad: 'p'.repeat(20_000) },
    discovery: {},
  });
  eventsOf(t);
  const capability = store.capabilityFor(id, base.viewer);
  assert.equal(store.get(id, capability, base.viewer).state, 'paused');
  assert.ok(store.pendingRelease.has(id), 'pending');
  store.delete(id, capability, base.viewer);
  assert.equal(store.pendingRelease.has(id), false, 'the tombstone drops it');
  const shown = store.inspect(id);
  assert.equal(shown.state, 'deleted');
  assert.equal(shown.reason.code, 'RESULT_EXPIRED');
  assert.equal(shown.discovery, undefined, 'the view is the saved tombstone');
});

test('review G1: a release is exactly one save of its record', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'b'.repeat(63)}c`;
  plantReal(
    directory,
    base,
    id,
    { seen: 2, alt_cells: 3 },
    { damage: (stored) => stored.filter((_, k) => k !== stored.length - 1) }
  );
  releaseLog(t);
  const saves = [];
  const save = ReaderJobStore.prototype._save;
  t.mock.method(ReaderJobStore.prototype, '_save', function (input, ...rest) {
    if (input.id === id) saves.push(clone(input));
    return save.call(this, input, ...rest);
  });
  const restarted = new ReaderJobStore({ directory });
  t.mock.restoreAll();
  assert.equal(restarted.failure, null);
  assert.equal(saves.length, 1, 'one save');
  assert.equal(saves[0].discovery.unavailable.cause, 'segment_missing');
  assert.deepEqual(saves[0].discovery.logs, {});
  assert.deepEqual(saves[0].discovery.verified, {});
});

test('review B1: a head past CHAIN_SEGMENTS is R2 with nothing read', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'b'.repeat(63)}d`;
  const record = plantReal(directory, base, id, { seen: 2 });
  const reads = [];
  const segment = store._segment;
  t.mock.method(store, '_segment', function (...args) {
    reads.push(args[0]);
    return segment.apply(this, args);
  });
  const at = (segments) => ({
    ...record,
    discovery: {
      ...record.discovery,
      logs: { seen: { ...record.discovery.logs.seen, segments } },
    },
  });
  assert.deepEqual(store._fullRead(at(DISCOVERY_LIMITS.CHAIN_SEGMENTS + 1), 'seen'), {
    cause: 'chain_broken',
    rule: 'R2',
  });
  assert.deepEqual(store._fullRead(at(Number.MAX_SAFE_INTEGER), 'seen'), {
    cause: 'chain_broken',
    rule: 'R2',
  });
  assert.deepEqual(reads, [], 'nothing read');
  // At the bound the read runs as before, here ending R2 at the chain's start.
  assert.deepEqual(store._fullRead(at(DISCOVERY_LIMITS.CHAIN_SEGMENTS), 'seen'), {
    cause: 'chain_broken',
    rule: 'R2',
  });
  assert.equal(reads.length, 2, 'the two stored segments, read once each');
  reads.length = 0;
  assert.deepEqual(store._fullRead(record, 'seen').addresses.length, 2);
  assert.equal(reads.length, 2);
});

// ── #656 Step 7: U1 on a pause, U2 on every save that writes a reason, and
// the repair of a queued record whose unavailable is set (§2.7, §7.4, §8).
const PAUSE_FX = 'good/unavailable_pause_reason.json';
// The fixture record's logs made real for a planted job: seen with one
// segment, alt_cells with two and variants with only a tail, as the fixture
// holds them. `swap` rewrites the fixture's heads to the planted ones.
const PAUSE_LOGS = { seen: 1, alt_cells: 2, variants: 0 };
const headSwap = (fx, planted) => (value) => {
  let text = JSON.stringify(value);
  for (const [log, st] of Object.entries(fx.record.discovery.logs))
    if (st.head) text = text.replaceAll(st.head, planted.discovery.logs[log].head);
  return JSON.parse(text);
};
// A foreign writer damages a live job's chain: the oldest segment of `log`
// deleted (segment_missing), or the head's count off by one (chain_broken).
// The store's next lock entry reloads and reconciles.
function damageChain(directory, store, id, cause, log) {
  const record = clone(store.records.get(id));
  if (cause === 'segment_missing') {
    const [oldest] = store.chains.get(id).get(log);
    fs.unlinkSync(path.join(storeDirectory(directory), 'pages', `${oldest}.json`));
  } else if (cause === 'chain_broken') record.discovery.logs[log].count -= 1;
  else assert.fail(`no damage for ${cause}`);
  plantRecord(directory, record);
}
// A released discovery, as U1 leaves it.
const releasedAs = (discovery, cause, log) => ({
  version: 1,
  epoch: discovery.epoch,
  logs: {},
  verified: {},
  unavailable: {
    cause,
    log,
    released: Object.fromEntries(Object.entries(discovery.logs).map(([l, st]) => [l, st.head])),
  },
});
const reasonOf = ({ cause, log, released }) => ({
  code: 'DISCOVERY_UNAVAILABLE',
  cause,
  log,
  released,
});

test('U2: good/unavailable_pause_reason.json, every case through the real store', (t) => {
  const fx = loadFixture(PAUSE_FX);
  for (const c of fx.cases) {
    let now = Date.now();
    const { directory, store } = fixture(t, { now: () => now });
    const other = create(store);
    const base = store.records.get(other.record.id);
    const id = fx.record.id;
    const planted = plantReal(directory, base, id, PAUSE_LOGS, {
      job: {
        state: c.state === 'running' ? 'queued' : c.state,
        reason: c.reason ?? null,
        fence: null,
        lease_expires_at: null,
      },
    });
    const swap = headSwap(fx, planted);
    store.inspect(id); // the full read passes and installs the lists
    assert.ok(store.chains.has(id), `${c.name}: the lists are installed`);
    const lease = c.state === 'running' ? store.lease(id) : null;
    if (lease) assert.equal(lease.id, id);
    for (const ev of c.events) {
      if (ev.by === 'reconciliation') {
        damageChain(directory, store, id, ev.cause, ev.log);
        store.inspect(id);
        assert.equal(store.records.get(id).discovery.unavailable?.cause, ev.cause, c.name);
      } else if (ev.by === 'store.pause') {
        const cause = ev.error_cause ?? ev.cause;
        const log = ev.error_log ?? ev.log;
        if (ev.from === 'sink')
          // The sink's error is the commit's own refusal, from unavailable,
          // before any rule; it writes nothing (§4, §7.4).
          assert.throws(
            () => commit(store, lease),
            (e) =>
              e.code === 'DISCOVERY_UNAVAILABLE' &&
              e.status === 409 &&
              e.cause === cause &&
              e.log === log,
            `${c.name}: the commit is refused from unavailable`
          );
        store.pause(id, lease.attempt, lease.fence, {
          code: ev.code,
          message: 'worker text',
          requeue: ev.requeue,
          cause,
          log,
        });
      } else if (ev.by === 'lease_expiry') {
        now = store.records.get(id).lease_expires_at;
        store.lease();
      } else if (ev.by === 'cancel')
        store.cancel(id, store.capabilityFor(id, base.viewer), base.viewer);
      else assert.fail(`no driver for ${ev.by}`);
    }
    const got = store.inspect(id);
    for (const [key, value] of Object.entries(swap(c.expect)))
      assert.deepEqual(got[key], value, `${c.name}: ${key}`);
    // A released job holds no address lists (BB8 6710235213).
    assert.equal(store.chains.has(id), false, `${c.name}: no lists`);
    assert.notEqual(
      store
        .listQueued()
        .map((r) => r.id)
        .includes(id),
      true
    );
  }
});

test('U1: a DISCOVERY_UNAVAILABLE pause releases in its own save, drops the lists, and logs the release', (t) => {
  const fx = loadFixture(PAUSE_FX);
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = fx.record.id;
  const planted = plantReal(directory, base, id, PAUSE_LOGS, { job: { state: 'queued' } });
  store.inspect(id);
  const lease = store.lease(id);
  assert.ok(store.chains.has(id));
  const saves = [];
  const save = ReaderJobStore.prototype._save;
  t.mock.method(store, '_save', function (input, ...rest) {
    if (input.id === id) saves.push(clone(input));
    return save.call(this, input, ...rest);
  });
  const seen = releaseLog(t);
  store.pause(id, lease.attempt, lease.fence, {
    code: 'DISCOVERY_UNAVAILABLE',
    requeue: true,
    cause: 'segment_corrupt',
    log: 'alt_cells',
  });
  assert.equal(saves.length, 1, 'one save');
  const want = releasedAs(planted.discovery, 'segment_corrupt', 'alt_cells');
  assert.deepEqual(saves[0].discovery, want);
  assert.deepEqual(saves[0].reason, reasonOf(want.unavailable));
  assert.equal(saves[0].state, 'paused', 'never requeued');
  assert.equal(store.chains.has(id), false, 'the lists are dropped');
  assert.deepEqual(seen.error, [
    { event: 'READER_DISCOVERY_RELEASED', job: id, cause: 'segment_corrupt', log: 'alt_cells' },
  ]);
  // A record that holds no discovery has nothing to release: its reason is
  // {code, cause, log}, and no discovery key appears (as on main).
  const plain = store.lease();
  assert.equal(plain.id, other.record.id);
  store.pause(plain.id, plain.attempt, plain.fence, {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'segment_missing',
    log: 'seen',
  });
  const after = store.inspect(plain.id);
  assert.equal(Object.hasOwn(after, 'discovery'), false);
  assert.deepEqual(after.reason, {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'segment_missing',
    log: 'seen',
  });
});

// good/release_fencing.json's pause events: the holder's commit after another
// instance's release, and the pause that follows it.
test("U2: good/release_fencing.json's commit and pause events, on the lease's own instance", (t) => {
  const fx = loadFixture('good/release_fencing.json');
  const walk = loadFixture('good/lease_incremental_walk.json');
  const NOW = 1793318000000; // before the fixture's lease_expires_at
  for (const c of fx.cases) {
    const [first, ...rest] = c.events;
    const { directory, store: a } = fixture(t, { now: () => NOW });
    const b = new ReaderJobStore({ directory, now: () => NOW });
    const other = create(a);
    const discovery = clone(fx.record.discovery);
    const spec = clone(walk.store);
    if (first.cause === 'segment_missing') spec.omit = [walk.addresses.alt_cells[0]];
    else discovery.logs.alt_cells.count -= 1;
    plantFixture(directory, a.records.get(other.record.id), fx, {
      discovery,
      store: spec,
      job: c.job,
    });
    a.inspect(fx.record.id);
    const file = path.join(storeDirectory(directory), 'records', `${fx.record.id}.json`);
    rest.forEach((ev, i) => {
      const want = c.expect[i + 1];
      const before = fs.readFileSync(file);
      if (ev.by === 'commitCheckpoint') {
        assert.throws(
          () =>
            b.commitCheckpoint(fx.record.id, ev.attempt, ev.fence, {
              cursor: { phase: 'next' },
              pages: [],
            }),
          (e) => Object.entries(want.refused).every(([k, v]) => e[k] === v),
          `${c.name}: refused`
        );
        assert.equal(want.written, 'nothing');
        assert.ok(fs.readFileSync(file).equals(before), `${c.name}: nothing written`);
      } else if (ev.by === 'store.pause') {
        assert.equal(ev.from, 'sink');
        b.pause(fx.record.id, ev.attempt, ev.fence, {
          code: ev.code,
          message: 'stubbed refusal',
          cause: ev.cause,
          log: ev.log,
        });
        assert.equal(want.saved, true);
      } else assert.fail(`no driver for ${ev.by}`);
      const got = b.inspect(fx.record.id);
      for (const [key, value] of Object.entries(want.job))
        assert.deepEqual(got[key], value, `${c.name} event ${i + 1}: ${key}`);
    });
  }
});

// Q6 (BB8 6700200435, on R2's question 6): an older image's resume() or
// _promoteDeferred can leave a released record queued, or paused with
// deferred_requeue. Planted as such an image would leave it.
function plantOlderQueued(directory, base, id, extra = {}) {
  const fx = loadFixture(PAUSE_FX);
  const discovery = fx.cases.find((c) => c.name === 'worker_refusal').expect.discovery;
  return plantRecord(directory, {
    ...base,
    id,
    state: 'queued',
    attempt: 2,
    // A fence no lease holds: the repair sets it null, as a release does.
    fence: 'e'.repeat(64),
    lease_expires_at: null,
    queued_at: 5,
    queue_order: 9,
    cancel_requested: false,
    deferred_requeue: false,
    reason: null,
    discovery,
    ...extra,
  }).record;
}
const repairedView = (r) => ({
  state: r.state,
  fence: r.fence,
  deferred_requeue: r.deferred_requeue,
  attempt: r.attempt,
  queued_at: r.queued_at,
  queue_order: r.queue_order,
  reason: r.reason,
});

test('repair: a queued record whose unavailable is set is paused with the U2 reason at startup, and holds no waiting slot', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'7'.repeat(64)}`;
  const planted = plantOlderQueued(directory, base, id);
  const want = {
    state: 'paused',
    fence: null,
    deferred_requeue: false,
    attempt: 2,
    queued_at: 5,
    queue_order: 9,
    reason: reasonOf(planted.discovery.unavailable),
  };
  // A live instance, usage unknown after the foreign write: the view shows
  // the repair it has decided, nothing dispatches it, and lease(id) is null.
  assert.deepEqual(repairedView(store.inspect(id)), want, 'shown repaired');
  assert.equal(store.records.get(id).state, 'queued', 'not saved while usage is unknown');
  assert.equal(store.lease(id), null, 'lease(id) never hands it out');
  assert.deepEqual(
    store.listQueued().map((r) => r.id),
    [other.record.id]
  );
  // A restart repairs it beside the INTERRUPTED pauses, usage known.
  const restarted = new ReaderJobStore({ directory });
  assert.deepEqual(repairedView(restarted.records.get(id)), want, 'saved repaired');
  assert.deepEqual(restarted.records.get(id).discovery, planted.discovery, 'discovery kept');
  // It holds no waiting slot: fifteen more jobs fill the queue beside `other`.
  for (let i = 0; i < READER_LIMITS.waiting - 1; i++) create(restarted, `viewer-${i}`, `key-${i}`);
  refused(() => create(restarted, 'viewer-x', 'key-x'), 'QUEUE_FULL');
  assert.notEqual(restarted.lease().id, id);
});

test('repair: on a live instance, lease() with usage known repairs it', async (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'8'.repeat(64)}`;
  const planted = plantOlderQueued(directory, base, id);
  assert.equal(store.lease(id), null);
  assert.equal(store.records.get(id).state, 'queued');
  assert.equal(await store.recount(), true);
  const leased = store.lease();
  assert.equal(leased.id, other.record.id, 'the next job leases');
  assert.deepEqual(
    repairedView(store.records.get(id)).reason,
    reasonOf(planted.discovery.unavailable)
  );
  assert.equal(store.records.get(id).state, 'paused');
});

test('repair: at full quota startup succeeds, lease() never throws, it stays skipped and shown paused, and the repair lands once room is freed', (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = clone(store.records.get(other.record.id));
  const lease = store.lease();
  commit(store, lease, [{ id: 'x', blob: 'e'.repeat(40_000) }], { phase: 'more' });
  store.pause(lease.id, lease.attempt, lease.fence, { code: 'INTERRUPTED', message: 'x' });
  const id = `reader_${'9'.repeat(64)}`;
  // Past its reservation, so the repair's growth (the U2 reason) needs quota.
  plantOlderQueued(directory, base, id, { request: { pad: 'p'.repeat(20_000) } });
  const root = storeDirectory(directory);
  let usage = fs.statSync(path.join(root, 'capability-key')).size;
  let slack = 0;
  for (const dir of ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
    for (const name of fs.readdirSync(path.join(root, dir))) {
      const size = fs.statSync(path.join(root, dir, name)).size;
      usage += size;
      if (dir === 'records') slack += Math.max(0, RESERVE - size);
    }
  const seen = eventsOf(t);
  const quota = new ReaderJobStore({ directory, maxBytes: usage + slack + 64 });
  assert.equal(quota.failure, null, 'startup succeeds');
  assert.equal(quota.records.get(id).state, 'queued', 'the repair did not fit');
  assert.ok(
    seen.some(
      (e) => e.event === 'READER_REPAIR_DEFERRED' && e.job === id && e.code === 'RESOURCE_LIMIT'
    ),
    'the refused repair is logged'
  );
  for (let i = 0; i < 3; i++) {
    assert.doesNotThrow(() => quota.lease(), 'lease() never throws');
    assert.equal(quota.inspect(id).state, 'paused', 'shown paused');
    assert.equal(quota.records.get(id).state, 'queued', 'still skipped');
    assert.equal(quota.lease(id), null);
  }
  quota.delete(other.record.id, quota.capabilityFor(other.record.id, base.viewer), base.viewer);
  quota.prune();
  quota.lease();
  assert.equal(quota.records.get(id).state, 'paused', 'repaired once room is freed');
  assert.equal(quota.records.get(id).reason.code, 'DISCOVERY_UNAVAILABLE');
});

test('repair: a paused record with deferred_requeue and unavailable set is never requeued', async (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const id = `reader_${'6'.repeat(64)}`;
  const planted = plantOlderQueued(directory, base, id, {
    state: 'paused',
    fence: null,
    deferred_requeue: true,
    reason: reasonOf(loadFixture(PAUSE_FX).cases[0].expect.discovery.unavailable),
  });
  await store.recount();
  const file = path.join(storeDirectory(directory), 'records', `${id}.json`);
  const bytes = fs.readFileSync(file);
  for (const s of [store, new ReaderJobStore({ directory })])
    for (let i = 0; i < 3; i++) {
      // Each call that promotes (lease(), listQueued()) leaves it as it was:
      // never queued, never saved, its flag and queue fields untouched.
      s.lease();
      assert.equal(s.records.get(id).state, 'paused', `lease ${i}`);
      assert.ok(!s.listQueued().some((r) => r.id === id), 'never promoted');
      assert.equal(s.records.get(id).state, 'paused', `listQueued ${i}`);
      assert.ok(fs.readFileSync(file).equals(bytes), 'never saved');
      assert.deepEqual(s.records.get(id).discovery, planted.discovery);
    }
});

// Every U2 save path, one test each, over three inputs: a well-formed release
// already saved, a malformed record.discovery whose release is pending (at
// full quota on a live instance, then room freed, so the save lands with the
// release in it), and a record with no discovery (the control: the reason it
// writes today).
function u2Inputs(t, kind, { state = 'running', now = () => Date.now() } = {}) {
  const { directory, store: seed } = fixture(t, { now });
  const other = create(seed);
  const base = clone(seed.records.get(other.record.id));
  const lease = seed.lease();
  commit(seed, lease, [{ id: 'x', blob: 'e'.repeat(40_000) }], { phase: 'more' });
  seed.pause(lease.id, lease.attempt, lease.fence, { code: 'INTERRUPTED', message: 'x' });
  const id = `reader_${'c'.repeat(64)}`;
  const running = state === 'running';
  const fence = running ? 'f'.repeat(64) : null;
  const fx = loadFixture(PAUSE_FX);
  const released = fx.cases.find((c) => c.name === 'worker_refusal').expect.discovery;
  const job = {
    ...base,
    id,
    state,
    attempt: 1,
    fence,
    lease_expires_at: running ? now() + 60_000 : null,
    cancel_requested: false,
    deferred_requeue: false,
    reason: running ? null : { code: 'INTERRUPTED', message: 'x' },
    ...(kind === 'pending' ? { request: { pad: 'p'.repeat(20_000) }, discovery: [] } : {}),
    ...(kind === 'saved' ? { discovery: released } : {}),
  };
  let store = seed;
  if (kind === 'pending') {
    // The quota: what the store counts with the job planted, and 64 bytes.
    plantRecord(directory, job);
    const root = storeDirectory(directory);
    let usage = fs.statSync(path.join(root, 'capability-key')).size;
    let slack = 0;
    for (const dir of ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'])
      for (const name of fs.readdirSync(path.join(root, dir))) {
        const size = fs.statSync(path.join(root, dir, name)).size;
        usage += size;
        if (dir === 'records') slack += Math.max(0, RESERVE - size);
      }
    fs.unlinkSync(path.join(root, 'records', `${id}.json`));
    store = new ReaderJobStore({ directory, maxBytes: usage + slack + 64, now });
  }
  plantRecord(directory, job);
  store.inspect(id); // reconciliation: saved, or pending
  return {
    directory,
    store,
    id,
    fence,
    viewer: base.viewer,
    other: other.record.id,
    async ready() {
      if (kind !== 'pending') return;
      assert.ok(store.pendingRelease.has(id), 'pending on the live instance');
      assert.equal(await store.recount(), true);
      assert.ok(store.pendingRelease.has(id), 'still pending at full quota');
      store.delete(other.record.id, store.capabilityFor(other.record.id, base.viewer), base.viewer);
      store.prune();
      assert.ok(store.pendingRelease.has(id), 'pending until a save that writes it');
    },
    want(todays) {
      if (kind === 'none') return { reason: todays, discovery: undefined };
      if (kind === 'saved') return { reason: reasonOf(released.unavailable), discovery: released };
      return { reason: U2({}), discovery: malformedRelease(0, {}) };
    },
  };
}
const U2_KINDS = ['saved', 'pending', 'none'];
const assertU2 = (store, id, want, label) => {
  const got = store.records.get(id);
  assert.deepEqual(got.reason, want.reason, `${label}: reason`);
  assert.deepEqual(got.discovery, want.discovery, `${label}: discovery`);
  assert.equal(store.pendingRelease.has(id), false, `${label}: no release left pending`);
  assert.equal(store.inspect(id).state, got.state, `${label}: the view is the record`);
};

test('U2 path: store.pause, a requeuing YIELD pauses instead and writes the copied reason', async (t) => {
  for (const kind of U2_KINDS) {
    const job = u2Inputs(t, kind);
    await job.ready();
    job.store.pause(job.id, 1, job.fence, { code: 'YIELD', message: 'yield', requeue: true });
    const got = job.store.records.get(job.id);
    if (kind === 'none') assert.equal(got.state, 'queued', 'a control requeues as today');
    else {
      assert.equal(got.state, 'paused', `${kind}: never requeued`);
      assert.equal(got.deferred_requeue, false);
      assertU2(job.store, job.id, job.want(null), kind);
    }
  }
});

test('U2 path: _quotaPause forces deferred_requeue false and writes the copied reason', async (t) => {
  for (const kind of U2_KINDS) {
    const job = u2Inputs(t, kind);
    await job.ready();
    const error = Object.assign(new Error('recounting'), { code: 'STORE_RECOUNTING', status: 503 });
    job.store._open(() => job.store._quotaPause(job.store.records.get(job.id), error));
    const got = job.store.records.get(job.id);
    assert.equal(got.state, 'paused');
    assert.equal(got.deferred_requeue, kind === 'none', `${kind}: deferred_requeue`);
    assertU2(
      job.store,
      job.id,
      job.want({ code: 'STORE_RECOUNTING', message: 'recounting' }),
      kind
    );
  }
});

test('U2 path: _expireLeases writes the copied reason', async (t) => {
  for (const kind of U2_KINDS) {
    let now = Date.now();
    const job = u2Inputs(t, kind, { now: () => now });
    await job.ready();
    now += 120_000;
    job.store._open(() => job.store._expireLeases());
    assert.equal(job.store.records.get(job.id).state, 'paused');
    assertU2(
      job.store,
      job.id,
      job.want({
        code: 'INTERRUPTED',
        message: 'Lease expired; resume the last durable checkpoint explicitly.',
      }),
      kind
    );
  }
});

test('U2 path: cancel() writes the copied reason, a running job keeping its lease', async (t) => {
  for (const state of ['running', 'paused'])
    for (const kind of U2_KINDS) {
      const job = u2Inputs(t, kind, { state });
      await job.ready();
      job.store.cancel(job.id, job.store.capabilityFor(job.id, job.viewer), job.viewer);
      const got = job.store.records.get(job.id);
      assert.equal(got.state, state === 'running' ? 'running' : 'cancelled');
      assert.equal(got.fence, job.fence, 'a running lease is kept');
      assertU2(
        job.store,
        job.id,
        job.want({
          code: 'CANCELLED',
          message:
            state === 'running'
              ? 'Cancellation requested; worker stops at its next committed safe point.'
              : 'Cancelled; committed evidence is retained.',
        }),
        `${state} ${kind}`
      );
    }
});

test("U2 path: startup's INTERRUPTED pause writes the copied reason", (t) => {
  for (const kind of ['saved', 'malformed', 'none']) {
    const job = u2Inputs(t, kind === 'malformed' ? 'none' : kind);
    if (kind === 'malformed') {
      // A small malformed record: its release is saved at startup's
      // reconciliation, and the INTERRUPTED pause then copies it.
      const record = clone(job.store.records.get(job.id));
      plantRecord(job.directory, { ...record, discovery: {} });
    }
    const restarted = new ReaderJobStore({ directory: job.directory });
    const got = restarted.records.get(job.id);
    assert.equal(got.state, 'paused');
    const want =
      kind === 'malformed'
        ? { reason: U2({}), discovery: malformedRelease(0, {}) }
        : job.want({
            code: 'INTERRUPTED',
            message: 'Worker interrupted; explicitly resume the committed cursor.',
          });
    assertU2(restarted, job.id, want, kind);
  }
});

test("U2 path: reconciliation's own release of a queued, paused or cancelled job writes the copied reason; a running job's is left to its lease", (t) => {
  for (const state of ['queued', 'paused', 'cancelled', 'running']) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const id = `reader_${'d'.repeat(64)}`;
    const running = state === 'running';
    const planted = plantReal(directory, base, id, PAUSE_LOGS, {
      job: {
        state,
        fence: running ? 'f'.repeat(64) : null,
        lease_expires_at: running ? Date.now() + 60_000 : null,
        reason: running ? null : { code: 'INTERRUPTED', message: 'x' },
      },
      damage: (stored) => stored.slice(1),
    });
    store.inspect(id);
    const got = store.records.get(id);
    const want = releasedAs(planted.discovery, 'segment_missing', 'seen');
    assert.deepEqual(got.discovery, want, state);
    assert.deepEqual(got.reason, running ? null : reasonOf(want.unavailable), state);
    assert.equal(got.state, state === 'queued' ? 'paused' : state);
  }
});

// No record that is not dispatched is ever shown queued (§7.4): every state ×
// every discovery shape, a malformed one's release saved or pending, a
// released queued one's repair saved or not yet.
test('the view: every record _dispatchable skips is shown paused or cancelled with a reason, or as its own state', async (t) => {
  const { directory, store } = fixture(t);
  const other = create(store);
  const base = store.records.get(other.record.id);
  const released = loadFixture(PAUSE_FX).cases[0].expect.discovery;
  const planted = [];
  let n = 0;
  for (const state of ['queued', 'running', 'paused', 'cancelled', 'completed'])
    for (const shape of ['none', 'live', 'released', 'malformed'])
      for (const pad of [false, true]) {
        const id = `reader_${(++n).toString(16).padStart(64, '0')}`;
        const running = state === 'running';
        const job = {
          state,
          fence: running ? 'f'.repeat(64) : null,
          lease_expires_at: running ? Date.now() + 60_000 : null,
          reason: ['queued', 'running'].includes(state)
            ? null
            : { code: 'INTERRUPTED', message: 'x' },
          ...(pad ? { request: { pad: 'p'.repeat(20_000) } } : {}),
        };
        if (shape === 'live') plantReal(directory, base, id, { seen: 1 }, { job });
        else
          plantRecord(directory, {
            ...base,
            id,
            ...job,
            ...(shape === 'released' ? { discovery: released } : {}),
            ...(shape === 'malformed' ? { discovery: {} } : {}),
          });
        planted.push(id);
      }
  const check = (label) => {
    const dispatchable = new Set(store._open(() => store._dispatchable().map((r) => r.id)));
    for (const id of [other.record.id, ...planted]) {
      const view = store.inspect(id);
      if (view.state === 'queued')
        assert.ok(dispatchable.has(id), `${label} ${id}: shown queued, dispatchable`);
      if (dispatchable.has(id)) assert.equal(view.state, 'queued', `${label} ${id}`);
      else if (store.records.get(id).state === 'queued') {
        assert.ok(['paused', 'cancelled'].includes(view.state), `${label} ${id}: ${view.state}`);
        assert.ok(view.reason?.code, `${label} ${id}: with a reason`);
      }
    }
  };
  store.inspect(other.record.id); // reconciles: small releases saved, padded ones pending
  assert.ok(store.pendingRelease.size > 0, 'some releases pending');
  check('usage unknown');
  await store.recount();
  check('after the recount');
  store.lease();
  check('after a lease');
});

// A U2 save of a pending job that _capacity refuses is made without the
// release, with today's reason, and logged; the release stays pending and
// shown, and lease() never throws (§7.4, §8 U2).
test('U2 path: a refused save of a pending job is made without its release, and lease() never throws', async (t) => {
  let now = Date.now();
  const job = u2Inputs(t, 'pending', { now: () => now });
  assert.equal(await job.store.recount(), true);
  assert.ok(job.store.pendingRelease.has(job.id), 'pending at full quota');
  const seen = eventsOf(t);
  now += 120_000; // past the lease
  assert.doesNotThrow(() => job.store.lease(), 'lease() never throws');
  const got = job.store.records.get(job.id);
  assert.equal(got.state, 'paused');
  assert.deepEqual(got.reason, {
    code: 'INTERRUPTED',
    message: 'Lease expired; resume the last durable checkpoint explicitly.',
  });
  assert.deepEqual(got.discovery, [], 'the malformed value, unreleased');
  assert.ok(job.store.pendingRelease.has(job.id), 'still pending');
  assert.ok(
    seen.some(
      (e) => e.event === 'READER_REPAIR_DEFERRED' && e.job === job.id && e.code === 'RESOURCE_LIMIT'
    ),
    'the refused save is logged'
  );
  const view = job.store.inspect(job.id);
  assert.deepEqual([view.state, view.reason], ['paused', U2({})], 'shown as its release');
});
