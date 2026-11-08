import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto, { createHash } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import { ReaderJobStore, READER_LIMITS, decodeStoredObject } from './reader_job_store.js';
import { ReaderScheduler, canonicalJSON, createCatalogResolver } from './reader_scheduler.js';
import { createReaderRouter, signReaderRequest } from './reader_routes.js';
import {
  DISCOVERY_LIMITS,
  DOMAINS,
  buildSegment,
  digestStep,
  domainDigest,
  planDiscovery,
} from './reader_discovery.js';
import {
  plantRecord,
  sealedSegments as sealedOf,
  storeDirectory,
} from './reader_store_test_support.mjs';
import { canonical as sortedCanonical, cursorCase } from './fixtures/discovery_v1/builders.mjs';

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
// The segments a write fixture's frames seal, by address (§2.5).
const sealedSegments = (rel) => sealedOf(loadFixture(rel));
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
// ({log: n}) at `epoch`; `damage(raws)` may change the stored segments.
function plantReal(
  directory,
  base,
  id,
  logs,
  { job = {}, damage = null, gzip = false, epoch = 0 } = {}
) {
  const owner = { ...base, id };
  const discovery = { version: 1, epoch, logs: {}, verified: {}, unavailable: null };
  const stored = [];
  for (const [log, n] of Object.entries(logs)) {
    const c = realChain(owner, log, n, { epoch });
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

// GC races a release (BB8 6710235213, owed before Step 10): two instances on
// one root. A runs maintain() in slices; B releases job X (a pause with code
// DISCOVERY_UNAVAILABLE, U1) at three points around A's lock: between two
// mark slices, after A's mark and before its sweep takes the lock, and while
// A's sweep holds it. What §7.2 and §7.3 promise: a release is one record
// save, and only GC deletes; no segment a surviving record (Y) references is
// ever swept; a collection marked before another instance's write never
// sweeps (A abandons it on entering the lock, so even an orphan it marked
// dead outlives it); a release refused STORE_BUSY because A holds the lock
// writes nothing, and its retry lands; once it has landed, the next full
// collection reclaims X's segments, and X keeps its trace. Every stored
// object is back-dated, so only the mark protects one.
// A release only removes roots, so Y, which never changes, is kept by any
// mark (Step 10 review, F4). So at the same point B also commits a seal on a
// third running job Z (good/seal_sequence_two_logs.json's frame 1): new
// segments A's mark never saw, back-dated at once, so only A's abandon on
// entering the lock keeps them through A's in-flight collection, which runs
// on to its end in every case.
test('GC races a release: two instances, the release lands or is retried, and no surviving segment is swept', async (t) => {
  const FENCE = 'f'.repeat(64);
  const BOUNDS = { records: 1, objects: 1, bytes: 2 * 1024 * 1024, ms: 1e9 };
  const release = (b, x) =>
    b.pause(x, 1, FENCE, {
      code: 'DISCOVERY_UNAVAILABLE',
      message: 'stubbed refusal',
      cause: 'digest_mismatch',
      log: 'seen',
    });
  for (const when of [
    'between mark slices',
    'after the mark, before the sweep',
    'during the sweep',
  ]) {
    gcOnly(t); // only for the collections the instances' own startups run
    const { directory, store: a } = fixture(t);
    const b = new ReaderJobStore({ directory });
    t.mock.restoreAll();
    const other = create(a);
    const base = a.records.get(other.record.id);
    const X = `reader_${'a'.repeat(64)}`;
    const Y = `reader_${'b'.repeat(64)}`;
    const x = plantReal(
      directory,
      base,
      X,
      { seen: 2, alt_cells: 2 },
      {
        job: {
          state: 'running',
          attempt: 1,
          fence: FENCE,
          lease_expires_at: Date.now() + 600_000,
          reason: null,
        },
      }
    );
    const y = plantReal(directory, base, Y, { seen: 3, variants: 1 });
    const seq = loadFixture('good/seal_sequence_two_logs.json');
    const Z = seq.job_id;
    const zLease = { id: Z, attempt: 1, fence: FENCE };
    plantRecord(directory, {
      ...base,
      id: Z,
      identity_hash: seq.identity_hash,
      discovery: clone(seq.record.discovery),
      cursor: clone(seq.record.cursor),
      state: 'running',
      attempt: 1,
      fence: FENCE,
      lease_expires_at: Date.now() + 600_000,
      reason: null,
    });
    const zs = seq.frames[1].expect.segments.map((s) => s.address);
    assert.equal(zs.length, 2);
    const segmentsOf = (record) => {
      const out = [];
      for (const st of Object.values(record.discovery.logs)) {
        let at = st.head;
        while (at) {
          out.push(at);
          at = JSON.parse(
            fs.readFileSync(path.join(pagesDir(directory), `${at}.json`))
          ).previous_hash;
        }
      }
      return out;
    };
    const xs = segmentsOf(x);
    const ys = segmentsOf(y);
    assert.equal(xs.length, 4);
    assert.equal(ys.length, 4);
    // Both instances reconcile the planted records: real chains, kept live.
    assert.equal(a.inspect(X).state, 'running');
    assert.equal(b.inspect(Y).state, 'queued');
    // B's usage known, so its commit can grow; Z's first frame seals nothing.
    assert.equal(await b.recount(), true);
    assert.equal(commitFrame(b, zLease, seq.frames[0]).state, 'running');
    const zFile = path.join(storeDirectory(directory), 'records', `${Z}.json`);
    // B's second write: Z's seal, its segments back-dated once written.
    const seal = () => {
      const saved = commitFrame(b, zLease, seq.frames[1]);
      assert.equal(saved.state, 'running', `${when}: Z's seal is committed`);
      assert.ok(
        zs.every((h) => pageExists(directory, h)),
        `${when}: Z's seal is written`
      );
      backdate(directory);
      return saved;
    };
    let sealed = null;
    const orphan = plantedChain(base, 'row_seen', 1, { tag: 'orphan' });
    writeStored(directory, orphan.addresses[0], orphan.raws[0], false);
    backdate(directory);
    const all = (hashes) => hashes.every((h) => pageExists(directory, h));
    const none = (hashes) => hashes.every((h) => !pageExists(directory, h));
    const file = path.join(storeDirectory(directory), 'records', `${X}.json`);
    let landed = null;
    if (when === 'between mark slices') {
      const first = a.maintain(BOUNDS);
      assert.equal(first.phase, 'mark', `${when}: the mark is under way`);
      landed = release(b, X);
      sealed = seal();
      // A's in-flight collection runs on: its next lock entry abandons it.
      const gc = a._gc;
      assert.equal(maintainAll(a, BOUNDS).phase, 'idle');
      assert.notEqual(gc, null);
      assert.ok(all(zs), `${when}: Z's new segments survive A's collection`);
    } else if (when === 'after the mark, before the sweep') {
      // maintain() takes the lock twice: for expiry, then for the sweep. B
      // releases between A's finished mark and the sweep's lock.
      const open = a._open;
      let calls = 0;
      t.mock.method(a, '_open', function (run) {
        if (calls++ === 1) {
          assert.equal(this._gc?.phase, 'sweep', `${when}: A's mark is done`);
          landed = release(b, X);
          sealed = seal();
        }
        return open.call(this, run);
      });
      const result = a.maintain({ ...BOUNDS, records: 1e6, objects: 1e6 });
      assert.equal(calls, 2, `${when}: the sweep took the lock`);
      assert.ok(landed, `${when}: B released before it`);
      t.mock.restoreAll();
      assert.equal(result.swept, 0, `${when}: the stale collection sweeps nothing`);
      assert.ok(pageExists(directory, orphan.addresses[0]), `${when}: not even the orphan`);
      assert.equal(a._gc, null, `${when}: it is abandoned`);
      assert.ok(all(zs), `${when}: Z's new segments survive A's collection`);
    } else {
      // A's sweep holds the lock: B's release is refused STORE_BUSY and
      // writes nothing; B serves on and retries once A is done.
      const unlink = a._unlinkCounted;
      let refusal = null;
      t.mock.method(a, '_unlinkCounted', function (target) {
        if (refusal === null) {
          const bytes = fs.readFileSync(file);
          const zBytes = fs.readFileSync(zFile);
          try {
            release(b, X);
          } catch (error) {
            refusal = error;
          }
          assert.ok(
            fs.readFileSync(file).equals(bytes),
            `${when}: the refused release wrote nothing`
          );
          assert.throws(() => seal(), { code: 'STORE_BUSY', status: 503 });
          assert.ok(fs.readFileSync(zFile).equals(zBytes), `${when}: nor the refused seal`);
          assert.ok(
            zs.every((h) => !pageExists(directory, h)),
            `${when}: the refused seal wrote no segment`
          );
        }
        return unlink.call(this, target);
      });
      const result = maintainAll(a, { ...BOUNDS, objects: 1e6 });
      t.mock.restoreAll();
      assert.equal(refusal?.code, 'STORE_BUSY', `${when}: refused while A holds the lock`);
      assert.equal(refusal.status, 503);
      assert.equal(b.failure, null, `${when}: B serves on`);
      assert.equal(result.phase, 'idle');
      assert.ok(all(xs), `${when}: X is still live, so its segments stay`);
      assert.equal(pageExists(directory, orphan.addresses[0]), false, `${when}: the orphan swept`);
      // A's sweep wrote, so B recounts before its seal can grow the store.
      assert.equal(await b.recount(), true);
      landed = release(b, X);
      sealed = seal();
    }
    assert.ok(all(ys), `${when}: Y's segments survive the race`);
    assert.equal(landed.state, 'paused', `${when}: the release landed`);
    assert.deepEqual(sealed.discovery, seq.frames[1].expect.record_discovery, `${when}: Z sealed`);
    // The next full collection, on A, reclaims X's segments and keeps Y's.
    backdate(directory);
    assert.equal(maintainAll(a, BOUNDS).phase, 'idle');
    assert.ok(all(ys), `${when}: Y's segments survive the collection`);
    assert.ok(all(zs), `${when}: Z's sealed segments survive the collection`);
    assert.ok(none(xs), `${when}: X's released segments are reclaimed`);
    assert.equal(pageExists(directory, orphan.addresses[0]), false, `${when}: the orphan too`);
    // The release, as both instances and the disk see it: one save, its trace kept.
    const heads = Object.fromEntries(
      Object.entries(x.discovery.logs).map(([log, st]) => [log, st.head])
    );
    const want = {
      version: 1,
      epoch: 0,
      logs: {},
      verified: {},
      unavailable: { cause: 'digest_mismatch', log: 'seen', released: heads },
    };
    for (const [who, got] of [
      ['A', a.inspect(X)],
      ['B', b.inspect(X)],
      ['disk', JSON.parse(fs.readFileSync(file))],
    ]) {
      assert.equal(got.state, 'paused', `${when}: ${who}`);
      assert.deepEqual(got.discovery, want, `${when}: ${who}`);
    }
    // Y is untouched, and its chains still read whole.
    assert.deepEqual(a.inspect(Y).discovery, y.discovery, `${when}: Y unchanged`);
    assert.deepEqual(Object.keys(listsOf(a, Y)).sort(), ['seen', 'variants']);
    assert.equal(listsOf(a, Y).seen.length, 3);
    for (const [who, store] of [
      ['A', a],
      ['B', b],
    ])
      assert.deepEqual(
        store.inspect(Z).discovery,
        seq.frames[1].expect.record_discovery,
        `${when}: Z as ${who} sees it`
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

// The full read's own digest_before link (BB8 6718090169: the clause appears
// twice, here and in the lease walk, and each needs a test that fails without
// it). A segment whose digest_before is not the digest it follows, d0 for the
// oldest, while its own F5 holds (digest_after folds from that digest_before)
// and the record's totals follow the chain: only the link is wrong, so the
// final-state check cannot see it, and the full read is chain_broken by R2.
// The same chain with the right digest_before reads and releases nothing.
test('reconciliation: a digest_before that does not link to the digest before it is chain_broken by R2', (t) => {
  for (const kind of ['oldest', 'second', 'control']) {
    const { directory, store } = fixture(t);
    const other = create(store);
    const base = store.records.get(other.record.id);
    const id = `reader_${'e'.repeat(64)}`;
    const owner = { ...base, id };
    const a = kind === 'oldest' ? null : realChain(owner, 'seen', 1);
    const at = a ? a.state : realChain(owner, 'seen', 0).state;
    const entries = [['link', 0]];
    const before = kind === 'control' ? at.digest : digestStep(at.digest, '"elsewhere"');
    const after = digestStep(before, JSON.stringify(entries[0]));
    const b = buildSegment(owner, 0, 'seen', at.head, at.count, entries, before, after);
    for (const raw of [...(a?.raws ?? []), b.raw]) writeStored(directory, dsha(raw), raw, false);
    const discovery = {
      version: 1,
      epoch: 0,
      logs: {
        seen: {
          head: b.address,
          segments: at.segments + 1,
          count: at.count + 1,
          bytes: at.bytes + Buffer.byteLength(JSON.stringify(entries[0])),
          digest: after,
        },
      },
      verified: { seen: realChain(owner, 'seen', 0).empty },
      unavailable: null,
    };
    const planted = { ...base, id, discovery };
    plantRecord(directory, planted);
    const rules = [];
    const fullRead = ReaderJobStore.prototype._fullRead;
    const spy = t.mock.method(ReaderJobStore.prototype, '_fullRead', function (...args) {
      const read = fullRead.apply(this, args);
      rules.push(read.rule ?? null);
      return read;
    });
    store.inspect(other.record.id);
    spy.mock.restore();
    if (kind === 'control') {
      assert.deepEqual(rules, [null], 'control: the chain reads');
      assert.equal(store.records.get(id).discovery.unavailable, null, 'control: nothing released');
      assert.equal(listsOf(store, id).seen.length, at.segments + 1);
      continue;
    }
    assert.deepEqual(rules, ['R2'], kind);
    assert.deepEqual(
      releaseView(store.records.get(id)),
      expectedRelease(planted, 'chain_broken', 'seen'),
      kind
    );
  }
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
  // The cases are pinned here too, not only by the fixtures suite (BB8
  // 6712649145, pin 2): a case dropped from the fixture fails this suite.
  assert.deepEqual(
    fx.cases.map((c) => c.name),
    ['verified_mismatch', 'wrong_type_key', 'extra_key', 'extra_state_key', 'empty_object']
  );
  assert.deepEqual(
    fx.controls.map((c) => c.name),
    ['null', 'absent']
  );
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
    assert.deepEqual(
      seen.filter((e) => e.event === 'READER_DISCOVERY_RELEASED'),
      [
        {
          level: 'warn',
          event: 'READER_DISCOVERY_RELEASED',
          job: job.id,
          cause: fx.expect.cause,
          log: fx.expect.log,
        },
      ],
      `${c.name}: its release logged once, when its save lands`
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

// BB8's call (3) on Step 7: the fallback above saves without the release
// only if the release is deferred, not lost. Once room is freed, the next
// point usage is known (a lease() on the live instance), the next
// reconciliation (a restart), or the next U2 save that carries it (a
// cancel()) finds the pending release again and completes it in one save,
// with the U2 reason and the release logged once.
test('U2 path: a release a refused save deferred is completed in one save once room is freed: by lease(), after a restart, or by the next U2 save', async (t) => {
  for (const where of ['live', 'restart', 'cancel']) {
    let now = Date.now();
    const job = u2Inputs(t, 'pending', { now: () => now });
    assert.equal(await job.store.recount(), true);
    now += 120_000; // past the lease: _expireLeases' U2 save is refused, the fallback lands
    job.store.lease();
    assert.ok(job.store.pendingRelease.has(job.id), `${where}: deferred by the fallback`);
    assert.deepEqual(job.store.records.get(job.id).discovery, [], `${where}: saved unreleased`);
    job.store.delete(job.other, job.store.capabilityFor(job.other, job.viewer), job.viewer);
    job.store.prune();
    assert.ok(job.store.pendingRelease.has(job.id), `${where}: still pending once room is freed`);
    const seen = eventsOf(t);
    const saves = []; // the saves that land (a refused one throws)
    const save = ReaderJobStore.prototype._save;
    t.mock.method(ReaderJobStore.prototype, '_save', function (input, ...rest) {
      const saved = save.call(this, input, ...rest);
      if (input.id === job.id) saves.push(clone(input));
      return saved;
    });
    let store = job.store;
    if (where === 'live') assert.doesNotThrow(() => store.lease(), 'lease() never throws');
    else if (where === 'restart')
      store = new ReaderJobStore({ directory: job.directory, now: () => now });
    else store.cancel(job.id, store.capabilityFor(job.id, job.viewer), job.viewer);
    for (let i = 0; i < 2; i++) store.lease(); // later points find nothing left to do
    store.inspect(job.id);
    t.mock.restoreAll();
    assert.equal(store.failure, null);
    assert.equal(saves.length, 1, `${where}: one save`);
    assert.deepEqual(saves[0].discovery, malformedRelease(0, {}), `${where}: the release`);
    assert.deepEqual(saves[0].reason, U2({}), `${where}: the U2 reason`);
    const got = store.records.get(job.id);
    const state = where === 'cancel' ? 'cancelled' : 'paused';
    assert.equal(got.state, state, `${where}: ${state}`);
    assert.equal(got.deferred_requeue, false);
    assert.deepEqual(got.reason, U2({}), `${where}: the reason saved`);
    assert.deepEqual(got.discovery, malformedRelease(0, {}), `${where}: the release saved`);
    assert.equal(store.pendingRelease.has(job.id), false, `${where}: nothing left pending`);
    assert.deepEqual(
      seen.filter((e) => e.event === 'READER_DISCOVERY_RELEASED'),
      [
        {
          level: 'warn',
          event: 'READER_DISCOVERY_RELEASED',
          job: job.id,
          cause: 'chain_broken',
          log: null,
        },
      ],
      `${where}: the release logged once`
    );
    const view = store.inspect(job.id);
    assert.deepEqual([view.state, view.reason], [state, U2({})], `${where}: the view`);
  }
});

// ── persisted discovery, Step 8 (#656 Node-side plan): the write path (§4).
// Every frame here goes through the real commitCheckpoint, on a job planted
// with the fixture's id, identity_hash, record.discovery and cursor and then
// leased, so its segments land at the fixture's addresses.
const JOB_ID = /^reader_[a-f0-9]{64}$/;
// A seal written as `entries_range` [a, b) holds the integers a … b − 1.
const expandSeal = ({ entries_range, ...seal }) =>
  entries_range
    ? {
        ...seal,
        entries: Array.from(
          { length: entries_range[1] - entries_range[0] },
          (_, i) => i + entries_range[0]
        ),
      }
    : seal;
const frameDiscovery = (frame) =>
  frame.discovery === undefined || frame.discovery === null
    ? frame.discovery
    : { ...frame.discovery, seals: frame.discovery.seals.map(expandSeal) };
function commitFrame(store, lease, frame) {
  return store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: frame.cursor,
    ...(frame.discovery === undefined ? {} : { discovery: frameDiscovery(frame) }),
    pages: [],
    progress: {},
    coverage,
  });
}
// A store holding one created job and the fixture's job, planted queued as a
// foreign writer would and then leased. `mock` mocks reconciliation away, for
// records that name synthetic chains by their totals (a full read would
// release them).
// The store that leases it is a restart, so usage is known (a foreign write
// leaves it unknown until a recount, and every growth would be refused).
function writeJob(t, fx, { record = fx.record, gzip = false, mock = false, options = {} } = {}) {
  if (mock) gcOnly(t);
  const { directory, store: first } = fixture(t, { gzip, ...options });
  const base = first.records.get(create(first).record.id);
  const id = JOB_ID.test(fx.job_id ?? '') ? fx.job_id : base.id;
  plantRecord(directory, {
    ...base,
    id,
    identity_hash: fx.identity_hash ?? base.identity_hash,
    discovery: clone(record.discovery),
    cursor: clone(record.cursor),
    state: 'queued',
  });
  // A synthetic chain has no segments to mark: the restart's collection is
  // mocked away with reconciliation (design §B2), and only for it.
  const collect = mock ? t.mock.method(ReaderJobStore.prototype, '_collectAll', () => {}) : null;
  const store = new ReaderJobStore({ directory, gzip, ...options });
  collect?.mock.restore();
  const lease = store.lease(id);
  assert.equal(lease?.id, id, 'the fixture job is leased');
  return { directory, store, lease, id };
}
const STORED = ['pages', 'indexes', 'manifests', 'checkpoints'];
// What "nothing written" compares: the object listings, the record's bytes,
// the generation and the job's lists.
function written(store, id) {
  const gen = path.join(store.directory, 'generation');
  return {
    objects: Object.fromEntries(STORED.map((kind) => [kind, objectsOf(store, kind)])),
    record: fs.readFileSync(path.join(store.directory, 'records', `${id}.json`), 'utf8'),
    generation: fs.existsSync(gen) ? fs.readFileSync(gen, 'utf8') : null,
    lists: listsOf(store, id),
  };
}
const protocolRefusal = (rule) => (error) =>
  error.code === 'READER_PROTOCOL' &&
  error.status === 400 &&
  (rule === undefined || error.rule === rule);
// The plain bytes stored at `address`, inflated when gzip stored them.
const storedSegment = (store, address) =>
  decodeStoredObject(fs.readFileSync(path.join(store.directory, 'pages', `${address}.json`)));
// The address lists a fixture's frames give, derived from its segments: a
// chain's list starts at [] where this store saw its head null (a new log, a
// reset, a new epoch, or a planted null head) and holds every segment sealed
// since, oldest first; a planted chain with a head no full read listed has
// none (`mock`).
function listOracle(record, mock) {
  let epoch = record.discovery?.epoch ?? null;
  let lists = {};
  for (const [log, st] of Object.entries(record.discovery?.logs ?? {}))
    lists[log] = st.head === null ? [] : undefined;
  assert.ok(mock || !record.discovery, 'a planted chain is listed only by a full read');
  return (frame) => {
    const fd = frame.discovery;
    if (epoch !== null && fd.epoch !== epoch) lists = {};
    epoch = fd.epoch;
    for (const log of fd.resets) lists[log] = [];
    for (const log of Object.keys(frame.expect.record_discovery.logs))
      if (!Object.hasOwn(lists, log)) lists[log] = [];
    for (const seg of frame.expect.segments) lists[seg.log]?.push(seg.address);
    return Object.fromEntries(Object.entries(lists).filter(([, v]) => v !== undefined));
  };
}
// Replays a write fixture's frames through the real store, holding each to
// its expected record.discovery, segments (by address and plain bytes), the
// cursor saved and the lists.
function replayFixture(t, fx, { gzip = false, mock = false } = {}) {
  const job = writeJob(t, fx, { gzip, mock });
  const oracle = listOracle(fx.record, mock);
  for (const [i, frame] of fx.frames.entries()) {
    const at = `${fx.fixture} frame ${i} gzip=${gzip}`;
    const saved = commitFrame(job.store, job.lease, frame);
    assert.equal(saved.state, 'running', `${at}: accepted`);
    assert.deepEqual(saved.discovery, frame.expect.record_discovery, `${at}: record.discovery`);
    assert.deepEqual(saved.cursor, frame.cursor, `${at}: the cursor`);
    for (const { address, bytes } of frame.expect.segments) {
      const plain = storedSegment(job.store, address);
      assert.equal(plain.length, bytes, `${at}: ${address} bytes`);
      assert.equal(dsha(plain), address, `${at}: the address is the plain bytes' sha256`);
    }
    assert.deepEqual(listsOf(job.store, job.id) ?? {}, oracle(frame), `${at}: the lists`);
  }
  return job;
}
const WRITE_GOOD = [
  ['good/seal_sequence_two_logs.json', false],
  ['good/epoch_jump.json', false],
  ['good/seal_completeness.json', false],
  // Its row_seen chain before frame 1 is synthetic, named by its totals.
  ['good/row_seen_compaction_next_frame.json', true],
];

test('write path: each good write fixture is accepted frame by frame, its segments and lists exact, plain and gzip', (t) => {
  for (const [rel, mock] of WRITE_GOOD)
    for (const gzip of [false, true]) {
      const fx = loadFixture(rel);
      const job = replayFixture(t, fx, { gzip, mock });
      if (gzip) {
        // At least one segment is stored compressed, and still named by its
        // plain bytes (§2.5).
        const addresses = fx.frames.flatMap((f) => f.expect.segments.map((s) => s.address));
        assert.ok(
          addresses.some((a) => {
            const raw = fs.readFileSync(path.join(job.store.directory, 'pages', `${a}.json`));
            return raw[0] === 0x1f && raw[1] === 0x8b;
          }),
          `${rel}: a segment is stored gzipped`
        );
      }
      t.mock.restoreAll();
    }
});

test("write path: the seal sequence leaves good/lease_payload_summary_paths.json's record", (t) => {
  const job = replayFixture(t, loadFixture('good/seal_sequence_two_logs.json'));
  const fx = loadFixture('good/lease_payload_summary_paths.json');
  const saved = job.store.records.get(job.id);
  assert.equal(job.id, fx.record.id);
  assert.equal(saved.identity_hash, fx.record.identity_hash);
  assert.deepEqual(saved.discovery, fx.record.discovery);
  assert.deepEqual(saved.cursor.discovery, fx.record.cursor.discovery);
});

test('write path: a split the worker must never emit is one the store accepts (row_seen compaction)', (t) => {
  const fx = loadFixture('good/row_seen_compaction_next_frame.json');
  for (const kase of fx.worker_must_not_emit) {
    assert.equal(kase.expect.store, 'accepted');
    const job = writeJob(t, fx, { mock: true });
    for (const frame of kase.frames)
      assert.equal(commitFrame(job.store, job.lease, frame).state, 'running', kase.name);
    t.mock.restoreAll();
  }
});

// W4's agreement core, one fault each, on the seal sequence after frame 2
// (seen and alt_cells sealed once, variants a tail): the cursor's `sealed`, a
// log the record holds left out, and a tail that is not open, by its entry
// count and by its entry bytes (§2.4).
test("write path: W4's agreement core refuses each of its faults alone", (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const base = fx.frames[2];
  const frame = (edit) => {
    const f = clone({
      discovery: { epoch: 0, resets: [], seals: [] },
      cursor: fx.frames[1].cursor,
    });
    edit(f.cursor.discovery.logs);
    return f;
  };
  const cases = [
    ['sealed', frame((logs) => (logs.seen.sealed += 1))],
    ['a held log left out', frame((logs) => delete logs.variants)],
    [
      'a tail of SEGMENT_ENTRIES entries',
      frame((logs) => {
        logs.alt_cells.tail = Array.from({ length: 1024 }, (_, i) => i + 4);
      }),
    ],
    [
      'a tail of SEGMENT_BYTES entry bytes',
      frame((logs) => {
        logs.alt_cells.tail = [
          4,
          5,
          'x'.repeat(4094),
          'y'.repeat(4094),
          'z'.repeat(4094),
          'w'.repeat(4092),
        ];
      }),
    ],
  ];
  assert.ok(base, 'the sequence has a third frame');
  for (const [name, f] of cases) {
    const job = writeJob(t, fx);
    commitFrame(job.store, job.lease, fx.frames[0]);
    commitFrame(job.store, job.lease, fx.frames[1]);
    refusedFrame(job, f, 'W4', name);
  }
  // The controls: one entry or one byte short of each bound is open.
  for (const tail of [
    Array.from({ length: 1023 }, (_, i) => i + 4),
    [4, 5, 'x'.repeat(4094), 'y'.repeat(4094), 'z'.repeat(4094), 'w'.repeat(4091)],
  ]) {
    const job = writeJob(t, fx);
    commitFrame(job.store, job.lease, fx.frames[0]);
    commitFrame(job.store, job.lease, fx.frames[1]);
    const f = frame((logs) => (logs.alt_cells.tail = tail));
    assert.equal(commitFrame(job.store, job.lease, f).state, 'running');
  }
});

// W3 alone: a seal whose `first` is not the log's count, its digest_before
// right (bad/reset_unheld_log.json pins W3's reset half).
test("write path: a seal whose first is not its log's count is refused W3", (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  // Frame 2 seals seen and alt_cells, each at count 0.
  for (const [seal, first] of [
    [0, 1],
    [1, 1024],
  ]) {
    const job = writeJob(t, fx);
    commitFrame(job.store, job.lease, fx.frames[0]);
    const frame = clone(fx.frames[1]);
    frame.discovery.seals[seal].first = first;
    refusedFrame(job, frame, 'W3', `seal ${seal} first ${first}`);
  }
});

const WRITE_BAD = [
  ['bad/changed_digest_after.json', 'F5'],
  ['bad/float_entry.json', 'F5'], // node_detects: Node parses 1.0 as 1
  ['bad/over_bound_seal.json', 'F4'],
  ['bad/premature_seal.json', 'F4'],
  ['bad/epoch_backwards.json', 'W2'],
  ['bad/reset_unheld_log.json', 'W3'],
  ['bad/cursor_record_disagreement.json', 'W4'],
  ['bad/current_moved_back.json', 'W4'],
  ['bad/tail_rewritten.json', 'W6'],
];
// Refused READER_PROTOCOL (400) with nothing written; the job stays leased.
function refusedFrame(job, frame, rule, at) {
  const before = written(job.store, job.id);
  assert.throws(() => commitFrame(job.store, job.lease, frame), protocolRefusal(rule), at);
  assert.deepEqual(written(job.store, job.id), before, `${at}: nothing written`);
  assert.equal(job.store.records.get(job.id).state, 'running', `${at}: still leased`);
}

test('write path: each bad write fixture is refused READER_PROTOCOL by its rule, writing nothing', (t) => {
  for (const [rel, rule] of WRITE_BAD) {
    const fx = loadFixture(rel);
    if (fx.expect.node_detects) assert.equal(rule, fx.expect.node_detects);
    else assert.equal(rule, fx.expect.rule);
    assert.deepEqual([fx.expect.code, fx.expect.status], ['READER_PROTOCOL', 400]);
    for (const gzip of [false, true]) {
      const job = writeJob(t, fx, { gzip, mock: true });
      refusedFrame(job, fx.frames[0], rule, `${rel} gzip=${gzip}`);
      t.mock.restoreAll();
    }
  }
});

// F-6 (BB8 6715584092): bad/current_moved_back.json's frame is refused W4
// above; each of its controls commits on the same record.
test('write path: bad/current_moved_back.json, each control accepted', (t) => {
  const fx = loadFixture('bad/current_moved_back.json');
  assert.equal(fx.controls.length, 4);
  for (const c of fx.controls) {
    const job = writeJob(t, fx, { mock: true });
    assert.equal(commitFrame(job.store, job.lease, c.frame).state, 'running', c.name);
    assert.deepEqual(
      job.store.records.get(job.id).cursor.discovery.groups,
      c.frame.cursor.discovery.groups,
      `${c.name}: committed`
    );
    t.mock.restoreAll();
  }
});

test('write path: bad/membership_over_cap.json, each mutant refused W7 and each control accepted', (t) => {
  const fx = loadFixture('bad/membership_over_cap.json');
  assert.deepEqual(fx.expect.store, { code: 'READER_PROTOCOL', status: 400 });
  for (const kase of fx.mutants) {
    const job = writeJob(t, fx, { record: kase.record, mock: true });
    refusedFrame(job, kase.frame, 'W7', kase.name);
    t.mock.restoreAll();
  }
  for (const kase of fx.controls) {
    const job = writeJob(t, fx, { record: kase.record, mock: true });
    assert.equal(commitFrame(job.store, job.lease, kase.frame).state, 'running', kase.name);
    t.mock.restoreAll();
  }
});

test('write path: an entry past ENTRY_DEPTH is refused F1; the same at the depth is accepted', (t) => {
  const fx = loadFixture('bad/entry_over_depth.json');
  assert.deepEqual(fx.expect.store, { code: 'READER_PROTOCOL', status: 400, written: 'nothing' });
  refusedFrame(writeJob(t, fx), fx.frame, 'F1', 'frame');
  const control = writeJob(t, fx);
  assert.equal(commitFrame(control.store, control.lease, fx.control_frame).state, 'running');
});

// A minimal frame on a record with no discovery: an empty cursor.discovery.
const EMPTY_CD = {
  version: 1,
  epoch: 0,
  logs: {},
  inventory: null,
  groups: { through: null, current: null },
};
const minimalFrame = () => ({
  discovery: { epoch: 0, resets: [], seals: [] },
  cursor: {
    contract_version: 2,
    method_index: 0,
    discovery: clone(EMPTY_CD),
    witness: null,
    continuation: {},
  },
});

test("write path: the codec fixture's integer-only frame fields are refused READER_PROTOCOL", (t) => {
  const fx = loadFixture('good/codec_error_mapping.json');
  const cases = fx.integer_fields.filter((c) => c.where === 'frame' || c.where === 'seal');
  assert.ok(cases.length >= 3);
  for (const c of cases) {
    assert.equal(c.rule, 'W1');
    const frame = minimalFrame();
    if (c.where === 'frame') frame.discovery[c.field] = c.value;
    else {
      const entries = [0, 1, 2, 3];
      const d0 = domainDigest(DOMAINS.log('seen'));
      const after = entries.reduce((d, e) => digestStep(d, JSON.stringify(e)), d0);
      frame.discovery.seals = [
        {
          log: 'seen',
          first: 0,
          entries,
          digest_before: d0,
          digest_after: after,
          [c.field]: c.value,
        },
      ];
    }
    // Several rules can fail at once here; only the code is asserted (§2.11).
    refusedFrame(
      writeJob(t, { record: { discovery: null, cursor: null } }),
      frame,
      undefined,
      `${c.where}.${c.field}=${c.value}`
    );
    if (c.where !== 'frame') continue;
    // The same epoch in the cursor's method_index and cursor.discovery too,
    // so W2 agrees: still refused.
    const agreed = minimalFrame();
    agreed.discovery[c.field] = c.value;
    agreed.cursor.method_index = c.value;
    agreed.cursor.discovery.epoch = c.value;
    refusedFrame(
      writeJob(t, { record: { discovery: null, cursor: null } }),
      agreed,
      undefined,
      `${c.field}=${c.value} everywhere`
    );
  }
});

test('write path: a null frame.discovery or cursor.discovery is refused, never read as absent', (t) => {
  const none = { record: { discovery: null, cursor: null } };
  const nullFrame = { ...minimalFrame(), discovery: null };
  refusedFrame(writeJob(t, none), nullFrame, 'W1', 'frame.discovery null');
  const nullCursor = minimalFrame();
  nullCursor.cursor.discovery = null;
  refusedFrame(writeJob(t, none), nullCursor, 'W4', 'cursor.discovery null');
  const both = { ...nullCursor, discovery: null };
  refusedFrame(writeJob(t, none), both, undefined, 'both null');
  // A null frame.discovery with a cursor that has no discovery key is W1:
  // read as absent, the two would agree and the frame would commit.
  const nullFrameBare = { ...minimalFrame(), discovery: null };
  delete nullFrameBare.cursor.discovery;
  refusedFrame(writeJob(t, none), nullFrameBare, 'W1', 'frame.discovery null, cursor bare');
  // One without the other is W1; a record holding discovery with a frame and
  // cursor that have none is W4.
  const noCursor = minimalFrame();
  delete noCursor.cursor.discovery;
  refusedFrame(writeJob(t, none), noCursor, 'W1', 'the frame without its cursor');
  const noFrame = { cursor: minimalFrame().cursor };
  refusedFrame(writeJob(t, none), noFrame, 'W1', 'the cursor without its frame');
  const held = writeJob(t, none);
  commitFrame(held.store, held.lease, minimalFrame());
  refusedFrame(held, { cursor: { phase: 'pairs' } }, 'W4', 'a held record and no discovery');
});

test('write path: a frame and cursor with no discovery on a record with none add no key', (t) => {
  const { store } = fixture(t);
  const lease = store.lease(create(store).record.id);
  const saved = commit(store, lease, [{ id: 'evidence-a', verdict: true }], { phase: 'pairs' });
  assert.equal(Object.hasOwn(saved, 'discovery'), false);
  assert.equal(Object.hasOwn(store.records.get(lease.id), 'discovery'), false);
  assert.equal(store.chains.has(lease.id), false);
});

test('write path: an exact retry of a sealing frame writes nothing', (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const job = writeJob(t, fx);
  commitFrame(job.store, job.lease, fx.frames[0]);
  const first = commitFrame(job.store, job.lease, fx.frames[1]);
  const before = written(job.store, job.id);
  const again = commitFrame(job.store, job.lease, fx.frames[1]);
  assert.deepEqual(again.added_page_paths, []);
  assert.deepEqual(again.discovery, first.discovery);
  assert.deepEqual(written(job.store, job.id), before);
  // The retry digest covers `discovery`: the same cursor with another frame
  // (here one with no seals, which now agrees with the record) is no retry:
  // it commits a new generation.
  const other = { ...fx.frames[1], discovery: { ...fx.frames[1].discovery, seals: [] } };
  const next = commitFrame(job.store, job.lease, other);
  assert.equal(next.generation, first.generation + 1, 'a new commit, not a retry');
  assert.deepEqual(next.discovery, first.discovery);
});

test('write path: a commit refused after one segment landed leaves the record and every list as they were', (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const job = writeJob(t, fx);
  commitFrame(job.store, job.lease, fx.frames[0]);
  const record = job.store.records.get(job.id);
  const lists = listsOf(job.store, job.id);
  const blob = job.store._blob;
  let segments = 0;
  t.mock.method(job.store, '_blob', function (kind, value, ...rest) {
    if (value?.kind === 'reader_discovery_segment' && ++segments === 2)
      throw Object.assign(new Error('quota'), { code: 'RESOURCE_LIMIT', status: 507 });
    return blob.call(this, kind, value, ...rest);
  });
  const paused = commitFrame(job.store, job.lease, fx.frames[1]);
  assert.equal(segments, 2, 'the second segment write was refused');
  assert.equal(paused.state, 'paused');
  assert.equal(paused.reason.code, 'RESOURCE_LIMIT');
  assert.deepEqual(paused.discovery, record.discovery, 'record.discovery as it was');
  assert.deepEqual(paused.cursor, record.cursor, 'the cursor as it was');
  assert.deepEqual(listsOf(job.store, job.id), lists, 'every list as it was');
  const [landed] = fx.frames[1].expect.segments;
  assert.ok(pageExists(job.directory, landed.address), 'the first segment landed, an orphan');
  assert.ok(!Object.values(listsOf(job.store, job.id)).flat().includes(landed.address));
});

test('write path: a held head with no list gets no partial list from a commit', (t) => {
  // Frame 2's record, its seen and alt_cells heads non-null, planted with
  // reconciliation mocked away: no full read listed them.
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const record = { discovery: fx.frames[1].expect.record_discovery, cursor: fx.frames[1].cursor };
  const job = writeJob(t, fx, { record, mock: true });
  assert.equal(listsOf(job.store, job.id), undefined, 'no list before the commit');
  const saved = commitFrame(job.store, job.lease, fx.frames[2]);
  assert.deepEqual(saved.discovery, fx.frames[2].expect.record_discovery);
  // alt_cells was sealed onto a head no list held: it stays without one, so
  // the next lease's R5 refuses it (the lease walk tests). variants' head is null: [].
  assert.deepEqual(listsOf(job.store, job.id), { variants: [] });
});

test('write path: complete() saves discovery null and drops the lists after its save', (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const job = replayFixture(t, fx);
  const last = fx.frames.at(-1);
  commitFrame(job.store, job.lease, {
    discovery: { epoch: 0, resets: [], seals: [] },
    cursor: { ...last.cursor, done: true },
  });
  assert.ok(job.store.chains.has(job.id));
  const done = finish(job.store, job.lease, 0);
  assert.equal(done.state, 'completed');
  assert.equal(done.discovery, null);
  assert.equal(job.store.records.get(job.id).discovery, null);
  assert.equal(job.store.chains.has(job.id), false);
  // A job whose record has no discovery key gains none.
  const { store } = fixture(t);
  const lease = store.lease(create(store).record.id);
  commit(store, lease);
  assert.equal(Object.hasOwn(finish(store, lease), 'discovery'), false);
});

// Review of b35da3722, E2 and E4: a complete() whose save is refused with a
// status is a quota pause, and keeps the lists, as every refused save does;
// they go only once a completing save has returned (§5.1).
test('write path: a complete() refused at its save is a quota pause and keeps the lists', (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const job = replayFixture(t, fx);
  const last = fx.frames.at(-1);
  commitFrame(job.store, job.lease, {
    discovery: { epoch: 0, resets: [], seals: [] },
    cursor: { ...last.cursor, done: true },
  });
  const before = listsOf(job.store, job.id);
  const record = clone(job.store.records.get(job.id));
  assert.ok(before && Object.keys(before).length, 'the job holds lists');
  const save = job.store._save;
  let refused = 0;
  t.mock.method(job.store, '_save', function (input, ...rest) {
    if (input.id === job.id && input.state === 'completed') {
      refused++;
      throw Object.assign(new Error('quota'), { code: 'RESOURCE_LIMIT', status: 507 });
    }
    // The lists are still held while the completing save runs.
    if (input.id === job.id) assert.deepEqual(listsOf(this, job.id), before, 'held at the save');
    return save.call(this, input, ...rest);
  });
  const paused = finish(job.store, job.lease, 0);
  assert.equal(refused, 1, 'the completing save was refused');
  assert.equal(paused.state, 'paused');
  assert.equal(paused.reason.code, 'RESOURCE_LIMIT');
  assert.deepEqual(paused.discovery, record.discovery, 'record.discovery kept');
  assert.deepEqual(listsOf(job.store, job.id), before, 'every list kept');
});

// Review of b35da3722, D-1: complete() is not among a pending release's
// refusers (§7.4), so a running job whose malformed release is pending can
// complete. Its save releases the whole of `discovery` (null), so that save
// completes the release: nothing stays pending, the view is the record, and
// the release is logged once, never again.
test('write path: complete() of a job whose malformed release is pending completes that release, logged once', async (t) => {
  const job = u2Inputs(t, 'pending');
  await job.ready(); // pending at full quota, then room freed: nothing saved it
  const store = job.store;
  assert.ok(store.pendingRelease.has(job.id));
  assert.deepEqual(store.records.get(job.id).discovery, [], 'the malformed value on disk');
  // As a running job whose last commit had a done cursor.
  store.records.get(job.id).cursor = { phase: 'done', done: true };
  const seen = eventsOf(t);
  const done = finish(store, { id: job.id, attempt: 1, fence: job.fence }, 0);
  for (let i = 0; i < 2; i++) store.lease(); // later points find nothing left to do
  t.mock.restoreAll();
  assert.equal(done.state, 'completed');
  assert.equal(done.discovery, null);
  const got = store.records.get(job.id);
  assert.deepEqual([got.state, got.reason, got.discovery], ['completed', null, null]);
  assert.equal(store.pendingRelease.has(job.id), false, 'nothing left pending');
  const view = store.inspect(job.id);
  assert.deepEqual(
    [view.state, view.reason, view.discovery],
    ['completed', null, null],
    'the view is the record'
  );
  assert.deepEqual(
    seen.filter((e) => e.event === 'READER_DISCOVERY_RELEASED'),
    [
      {
        level: 'warn',
        event: 'READER_DISCOVERY_RELEASED',
        job: job.id,
        cause: 'chain_broken',
        log: null,
      },
    ],
    'the release logged once'
  );
  // A job whose release was saved already logged it: its completion adds no line.
  const saved = u2Inputs(t, 'saved');
  assert.equal(await saved.store.recount(), true); // usage known after the planted write
  saved.store.records.get(saved.id).cursor = { phase: 'done', done: true };
  const again = eventsOf(t);
  const out = finish(saved.store, { id: saved.id, attempt: 1, fence: saved.fence }, 0);
  t.mock.restoreAll();
  assert.equal(out.state, 'completed');
  assert.deepEqual(
    again.filter((e) => e.event === 'READER_DISCOVERY_RELEASED'),
    [],
    'no second line'
  );
});

// Q5 (BB8 23:20Z and 6714569541, on Step 8): complete() of a job whose release
// was saved erases its trace (unavailable) with discovery: null. The trace is
// logged once, after that save lands, as READER_DISCOVERY_TRACE_ERASED, with
// the cause, the log and the released heads; a refused completion erases
// nothing and logs nothing, and a job with no saved release logs no such line.
test('Q5: complete() after a saved release logs its trace once, when the erasing save lands', async (t) => {
  const TRACE = 'READER_DISCOVERY_TRACE_ERASED';
  const saved = u2Inputs(t, 'saved');
  assert.equal(await saved.store.recount(), true);
  const before = clone(saved.store.records.get(saved.id).discovery.unavailable);
  assert.ok(before.cause && Object.keys(before.released).length, 'a trace to erase');
  saved.store.records.get(saved.id).cursor = { phase: 'done', done: true };
  // Refused at its save: a quota pause, nothing erased, nothing logged.
  const save = saved.store._save;
  const refuse = t.mock.method(saved.store, '_save', function (input, ...rest) {
    if (input.id === saved.id && input.state === 'completed')
      throw Object.assign(new Error('quota'), { code: 'RESOURCE_LIMIT', status: 507 });
    return save.call(this, input, ...rest);
  });
  let seen = eventsOf(t);
  const paused = finish(saved.store, { id: saved.id, attempt: 1, fence: saved.fence }, 0);
  t.mock.restoreAll();
  refuse.mock.restore();
  assert.equal(paused.state, 'paused');
  assert.deepEqual(saved.store.records.get(saved.id).discovery.unavailable, before, 'kept');
  assert.deepEqual(
    seen.filter((e) => e.event === TRACE),
    [],
    'a refused save logs nothing'
  );
  // A released job is never dispatched again (§8, U2), so the landing save is
  // shown on a second job planted the same way.
  const landed = u2Inputs(t, 'saved');
  assert.equal(await landed.store.recount(), true);
  landed.store.records.get(landed.id).cursor = { phase: 'done', done: true };
  seen = eventsOf(t);
  const out = finish(landed.store, { id: landed.id, attempt: 1, fence: landed.fence }, 0);
  for (let i = 0; i < 2; i++) landed.store.lease(); // later points log nothing more
  t.mock.restoreAll();
  assert.equal(out.state, 'completed');
  assert.equal(landed.store.records.get(landed.id).discovery, null, 'the trace erased');
  assert.deepEqual(
    seen.filter((e) => e.event === TRACE),
    [{ level: 'warn', event: TRACE, job: landed.id, outcome: 'saved', ...before }],
    'logged once, with the cause, the log and the released heads'
  );
  assert.deepEqual(
    seen.map((e) => e.event),
    [TRACE],
    'the one line, and no release line again'
  );
  // No saved release: a pending malformed release completes as a release
  // (logged READER_DISCOVERY_RELEASED), a live state and no discovery at all
  // log no trace line.
  const pending = u2Inputs(t, 'pending');
  await pending.ready();
  pending.store.records.get(pending.id).cursor = { phase: 'done', done: true };
  seen = eventsOf(t);
  finish(pending.store, { id: pending.id, attempt: 1, fence: pending.fence }, 0);
  t.mock.restoreAll();
  assert.deepEqual(
    seen.map((e) => e.event),
    ['READER_DISCOVERY_RELEASED']
  );
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const live = replayFixture(t, fx);
  commitFrame(live.store, live.lease, {
    discovery: { epoch: 0, resets: [], seals: [] },
    cursor: { ...fx.frames.at(-1).cursor, done: true },
  });
  seen = eventsOf(t);
  assert.equal(finish(live.store, live.lease, 0).discovery, null);
  t.mock.restoreAll();
  assert.deepEqual(seen, [], 'a live state completes with no line');
  // Only a validated unavailable is a trace: a value that is not of §2.7's
  // shape, though it holds an `unavailable`, logs none.
  const odd = replayFixture(t, fx);
  commitFrame(odd.store, odd.lease, {
    discovery: { epoch: 0, resets: [], seals: [] },
    cursor: { ...fx.frames.at(-1).cursor, done: true },
  });
  odd.store.records.get(odd.id).discovery = { version: 2, unavailable: clone(before) };
  seen = eventsOf(t);
  assert.equal(finish(odd.store, odd.lease, 0).state, 'completed');
  t.mock.restoreAll();
  assert.deepEqual(
    seen.filter((e) => e.event === TRACE),
    [],
    'a malformed value logs no trace'
  );
  // Inert on main: a record with no discovery logs nothing new.
  const { store } = fixture(t);
  const plain = store.lease(create(store).record.id);
  commit(store, plain);
  seen = eventsOf(t);
  const done = finish(store, plain);
  t.mock.restoreAll();
  assert.equal(Object.hasOwn(done, 'discovery'), false);
  assert.deepEqual(seen, [], 'no line');
});

// Q5, the save that throws without a status (review of b3b2a64f5, F-3): it
// may have landed (§4), and if it did the trace is gone with nothing left to
// log it, so the trace is logged then, once, as of unknown outcome. A throw
// before the save starts (a manifest write) erased nothing and logs nothing.
test('Q5: a completing save that throws without a status logs the trace once, of unknown outcome', async (t) => {
  const TRACE = 'READER_DISCOVERY_TRACE_ERASED';
  const lost = (store, kind, stage) => {
    store.fault = (at, event) => {
      if (event.kind === kind && at === stage) throw new Error('simulated process loss');
    };
  };
  for (const [stage, landed] of [
    ['temporary_written', false],
    ['renamed', true],
  ]) {
    const job = u2Inputs(t, 'saved');
    assert.equal(await job.store.recount(), true);
    const before = clone(job.store.records.get(job.id).discovery.unavailable);
    job.store.records.get(job.id).cursor = { phase: 'done', done: true };
    lost(job.store, 'record', stage);
    const seen = eventsOf(t);
    assert.throws(
      () => finish(job.store, { id: job.id, attempt: 1, fence: job.fence }, 0),
      (e) => e.code === 'STORAGE_UNAVAILABLE' && e.status === 503,
      stage
    );
    t.mock.restoreAll();
    assert.deepEqual(
      seen.filter((e) => e.event === TRACE),
      [{ level: 'warn', event: TRACE, job: job.id, outcome: 'unknown', ...before }],
      `${stage}: logged once, of unknown outcome`
    );
    // What reached disk: the rename landed the null save, the earlier loss did not.
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(storeDirectory(job.directory), 'records', `${job.id}.json`))
    );
    if (landed) assert.equal(onDisk.discovery, null, `${stage}: the trace erased on disk`);
    else assert.deepEqual(onDisk.discovery.unavailable, before, `${stage}: the trace kept`);
  }
  const early = u2Inputs(t, 'saved');
  assert.equal(await early.store.recount(), true);
  early.store.records.get(early.id).cursor = { phase: 'done', done: true };
  lost(early.store, 'manifests', 'renamed');
  const seen = eventsOf(t);
  assert.throws(
    () => finish(early.store, { id: early.id, attempt: 1, fence: early.fence }, 0),
    (e) => e.code === 'STORAGE_UNAVAILABLE' && e.status === 503
  );
  t.mock.restoreAll();
  assert.deepEqual(
    seen.filter((e) => e.event === TRACE),
    [],
    'a throw before the save logs nothing'
  );
});

// Q5, a completing save that throws WITH a status (BB8 6715909159, the
// survivor of the Step 9 review): a status means the save never wrote the
// record (§4), so nothing was erased and no trace line is logged, neither
// unknown nor saved. The trace stays in the record and the store serves on.
test('Q5: a completing save that throws with a status logs no trace line', async (t) => {
  const TRACE = 'READER_DISCOVERY_TRACE_ERASED';
  for (const [code, status] of [
    ['STALE_ATTEMPT', 409],
    ['PAYLOAD_TOO_LARGE', 413],
  ]) {
    const job = u2Inputs(t, 'saved');
    assert.equal(await job.store.recount(), true);
    const before = clone(job.store.records.get(job.id).discovery.unavailable);
    job.store.records.get(job.id).cursor = { phase: 'done', done: true };
    const save = job.store._save;
    t.mock.method(job.store, '_save', function (input, ...rest) {
      if (input.id === job.id && input.state === 'completed')
        throw Object.assign(new Error('refused'), { code, status });
      return save.call(this, input, ...rest);
    });
    const seen = eventsOf(t);
    assert.throws(
      () => finish(job.store, { id: job.id, attempt: 1, fence: job.fence }, 0),
      (e) => e.code === code && e.status === status,
      `${status}: the refusal reaches the caller`
    );
    t.mock.restoreAll();
    assert.deepEqual(
      seen.filter((e) => e.event === TRACE),
      [],
      `${status}: no trace line, neither unknown nor saved`
    );
    assert.equal(job.store.failure, null, `${status}: the store serves on`);
    assert.deepEqual(job.store.records.get(job.id).discovery.unavailable, before, 'kept');
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(storeDirectory(job.directory), 'records', `${job.id}.json`))
    );
    assert.deepEqual(onDisk.discovery.unavailable, before, `${status}: kept on disk`);
  }
});

// Q5's level follows the cause (BB8 6715584092), as the release line's does:
// error for segment_corrupt, warn for any other, for both outcomes. The cause
// is planted on the saved release u2Inputs builds; its shape stays §2.7's.
test('Q5: the trace line is at error level for segment_corrupt, warn otherwise, saved or unknown', async (t) => {
  const TRACE = 'READER_DISCOVERY_TRACE_ERASED';
  for (const [cause, level] of [
    ['segment_corrupt', 'error'],
    ['segment_missing', 'warn'],
    ['digest_mismatch', 'warn'],
  ])
    for (const outcome of ['saved', 'unknown']) {
      const job = u2Inputs(t, 'saved');
      assert.equal(await job.store.recount(), true);
      const record = job.store.records.get(job.id);
      record.discovery.unavailable.cause = cause;
      assert.equal(job.store._discoveryShape(record), 'released', `${cause}: still §2.7's shape`);
      const before = clone(record.discovery.unavailable);
      record.cursor = { phase: 'done', done: true };
      if (outcome === 'unknown')
        job.store.fault = (at, event) => {
          if (event.kind === 'record' && at === 'renamed') throw new Error('simulated loss');
        };
      const seen = eventsOf(t);
      const run = () => finish(job.store, { id: job.id, attempt: 1, fence: job.fence }, 0);
      if (outcome === 'unknown') assert.throws(run, (e) => e.code === 'STORAGE_UNAVAILABLE');
      else assert.equal(run().state, 'completed');
      t.mock.restoreAll();
      assert.deepEqual(
        seen.filter((e) => e.event === TRACE),
        [{ level, event: TRACE, job: job.id, outcome, ...before }],
        `${cause} ${outcome}: one line at ${level}`
      );
    }
});

// And a completion whose save is refused is a quota pause: at full quota its
// U2 save is refused too, so the fallback keeps the release pending, unlogged.
test('write path: a refused complete() of a job whose malformed release is pending keeps it pending', async (t) => {
  const job = u2Inputs(t, 'pending');
  const store = job.store;
  assert.equal(await store.recount(), true);
  assert.ok(store.pendingRelease.has(job.id), 'pending at full quota');
  store.records.get(job.id).cursor = { phase: 'done', done: true };
  const save = store._save;
  t.mock.method(store, '_save', function (input, ...rest) {
    if (input.id === job.id && input.state === 'completed')
      throw Object.assign(new Error('quota'), { code: 'RESOURCE_LIMIT', status: 507 });
    return save.call(this, input, ...rest);
  });
  const seen = eventsOf(t);
  const out = finish(store, { id: job.id, attempt: 1, fence: job.fence }, 0);
  t.mock.restoreAll();
  assert.equal(out.state, 'paused');
  assert.deepEqual(store.records.get(job.id).discovery, [], 'saved unreleased');
  assert.ok(store.pendingRelease.has(job.id), 'still pending');
  assert.equal(seen.filter((e) => e.event === 'READER_DISCOVERY_RELEASED').length, 0);
  assert.equal(store.inspect(job.id).reason.code, 'DISCOVERY_UNAVAILABLE', 'shown released');
});

// Review of b35da3722, C2: a reset, or an epoch advance, starts the log's
// list again at [], even where the log already holds one.
test('write path: a reset of a log that holds a list starts its list again at []', (t) => {
  const fx = loadFixture('good/row_seen_compaction_next_frame.json');
  const job = writeJob(t, fx, { mock: true });
  commitFrame(job.store, job.lease, fx.frames[0]);
  // As a full read would have listed it: the planted row_seen head.
  const head = job.store.records.get(job.id).discovery.logs.row_seen.head;
  job.store.chains.get(job.id).set('row_seen', [head]);
  const frame = fx.frames[1];
  assert.ok(frame.discovery.resets.includes('row_seen'), 'the frame resets row_seen');
  commitFrame(job.store, job.lease, frame);
  const want = frame.expect.segments.filter((s) => s.log === 'row_seen').map((s) => s.address);
  assert.deepEqual(listsOf(job.store, job.id).row_seen, want, 'only its new seals');
});

test("write path: an epoch advance starts a held log's list again at []", (t) => {
  const fx = loadFixture('good/epoch_jump.json');
  const job = writeJob(t, fx);
  commitFrame(job.store, job.lease, fx.frames[0]);
  assert.equal(listsOf(job.store, job.id).variants.length, 1, 'variants holds a list');
  // The same advance, its cursor naming variants with an empty tail, so the
  // new epoch's record holds variants with a null head.
  const frame = clone(fx.frames[1]);
  assert.ok(frame.discovery.epoch > fx.frames[0].discovery.epoch, 'an advance');
  frame.cursor.discovery.logs = {
    ...frame.cursor.discovery.logs,
    variants: {
      sealed: 0,
      sealed_digest: fx.frames[0].expect.record_discovery.verified.variants.digest,
      tail: [],
    },
  };
  const saved = commitFrame(job.store, job.lease, frame);
  assert.equal(saved.state, 'running', 'accepted');
  assert.equal(saved.discovery.logs.variants.head, null);
  assert.deepEqual(listsOf(job.store, job.id).variants, [], 'variants starts again at []');
});

// §5.1's required store test (good/thrown_save_outcome_unknown.json): the
// record of good/lease_after_refused_commit.json, planted with its segments
// (the reconciliation that follows lists them), then the seal sequence's
// frame 3 committed with its record save throwing.
test('write path: a thrown record save, for each outcome, leaves no list in use until the rebuild', (t) => {
  const fx = loadFixture('good/thrown_save_outcome_unknown.json');
  const frame = loadFixture('good/seal_sequence_two_logs.json').frames[2];
  const outcomes = new Set();
  for (const kase of fx.cases) {
    for (const gzip of [false, true]) {
      const at = `${kase.name} gzip=${gzip}`;
      let fault = null;
      const { directory, store: first } = fixture(t, { gzip });
      plantFixture(directory, first.records.get(create(first).record.id), fx, { gzip });
      // A restart, so usage is known; its reconciliation lists the chains.
      const store = new ReaderJobStore({
        directory,
        gzip,
        faultInjector: (stage, info) => fault?.(stage, info),
      });
      const lease = store.lease(fx.record.id);
      assert.deepEqual(listsOf(store, fx.record.id), fx.addresses, `${at}: the lists before`);
      const file = path.join(store.directory, 'records', `${fx.record.id}.json`);
      const old = fs.readFileSync(file);
      if (kase.throws.status) {
        const save = store._save;
        let first = true;
        t.mock.method(store, '_save', function (input, ...rest) {
          if (first && input.id === fx.record.id) {
            first = false;
            throw Object.assign(new Error('quota'), {
              code: kase.throws.code,
              status: kase.throws.status,
            });
          }
          return save.call(this, input, ...rest);
        });
        const paused = commitFrame(store, lease, frame);
        assert.equal(store.failure, null, `${at}: serving`);
        assert.equal(paused.reason.code, kase.throws.code);
        assert.deepEqual(store.records.get(fx.record.id).discovery, kase.durable, `${at}: durable`);
        assert.deepEqual(listsOf(store, fx.record.id), kase.expect.addresses, `${at}: lists`);
        assert.doesNotThrow(() => store.lease(), `${at}: the instance serves`);
        for (const address of kase.expect.orphans) {
          assert.ok(pageExists(directory, address), `${at}: ${address} was written`);
          assert.ok(!Object.values(listsOf(store, fx.record.id)).flat().includes(address));
        }
        outcomes.add('status');
      } else {
        assert.equal(kase.throws.after, 'rename');
        const landed = kase.durable.logs.alt_cells.head === fx.commit.wrote[0];
        fault = (stage, { kind, file: f }) => {
          if (kind !== 'record' || stage !== 'renamed' || f !== file) return;
          fault = null;
          // The save that is lost: its rename never became durable.
          if (!landed) fs.writeFileSync(file, old);
          throw new Error('EIO after the rename');
        };
        assert.throws(
          () => commitFrame(store, lease, frame),
          (e) => e.code === kase.expect.refused_until_restart.code && e.status === 503,
          at
        );
        assert.ok(store.failure, `${at}: the instance failed`);
        // The commit wrote its segment either way (the restart's collection
        // may take an orphan).
        for (const address of fx.commit.wrote) assert.ok(pageExists(directory, address), at);
        assert.equal(store.chains.size, 0, `${at}: no list is kept`);
        for (const call of [
          () => store.lease(),
          () => store.workerPayload(fx.record.id),
          () => commitFrame(store, lease, frame),
        ])
          assert.throws(call, (e) => e.code === 'STORAGE_UNAVAILABLE' && e.status === 503, at);
        // The restart's first lock entry reconciles: a full read from the
        // durable heads, newest first, rebuilds every list.
        const reads = [];
        const segment = ReaderJobStore.prototype._segment;
        // A full read passes `expect`; the collection's mark reads pass null.
        t.mock.method(ReaderJobStore.prototype, '_segment', function (hash, expect, ...rest) {
          if (expect !== null) reads.push(hash);
          return segment.call(this, hash, expect, ...rest);
        });
        const restarted = new ReaderJobStore({ directory, gzip });
        t.mock.restoreAll();
        const durable = restarted.records.get(fx.record.id);
        assert.deepEqual(durable.discovery, kase.durable, `${at}: the durable record`);
        assert.deepEqual(reads, kase.expect.restart.read, `${at}: the full read`);
        assert.deepEqual(
          listsOf(restarted, fx.record.id),
          kase.expect.restart.addresses,
          `${at}: the rebuilt lists`
        );
        for (const [log, list] of Object.entries(kase.expect.restart.addresses))
          assert.equal(
            list.at(-1) ?? null,
            durable.discovery.logs[log].head,
            `${at}: ${log} ends at the head`
          );
        const listed = Object.values(listsOf(restarted, fx.record.id)).flat();
        assert.deepEqual(
          kase.expect.orphans,
          fx.commit.wrote.filter((a) => !listed.includes(a)),
          `${at}: the orphans are the written segments no list holds`
        );
        outcomes.add(landed ? 'landed' : 'lost');
      }
      t.mock.restoreAll();
    }
  }
  assert.deepEqual([...outcomes].sort(), ['landed', 'lost', 'status']);
});

// §3, the record bound (#656 critique c21): the discovery-era fields at their
// bounds leave a record under READER_LIMITS.objectBytes with room for today's
// own fields.
test('write path: a record with its cursor at the §3 bound, a full record.discovery and 250 inline refs encodes under 2 MiB', (t) => {
  const { store } = fixture(t);
  const job = create(store);
  const record = clone(store.records.get(job.record.id));
  const max = Number.MAX_SAFE_INTEGER;
  const state = {
    head: 'f'.repeat(64),
    segments: max,
    count: max,
    bytes: max,
    digest: 'f'.repeat(64),
  };
  record.discovery = {
    version: 1,
    epoch: max,
    logs: Object.fromEntries(
      ['seen', 'row_seen', 'variants', 'alt_cells', 'alt_seen'].map((l) => [l, state])
    ),
    verified: Object.fromEntries(
      ['seen', 'row_seen', 'variants', 'alt_cells', 'alt_seen'].map((l) => [l, state])
    ),
    unavailable: null,
  };
  // §3: the whole cursor is at most 235,483 canonical bytes.
  record.cursor = { pad: 'x'.repeat(235_483 - '{"pad":""}'.length) };
  assert.equal(Buffer.byteLength(JSON.stringify(record.cursor)), 235_483);
  const ref = { sha256: 'f'.repeat(64), bytes: READER_LIMITS.objectBytes, count: 250 };
  record.page_refs = Array.from({ length: 250 }, () => ref);
  record.page_count = 250;
  record.generation = max;
  record.updated_at = max;
  record.record_digest = 'f'.repeat(64);
  const bytes = Buffer.byteLength(JSON.stringify(record));
  // Neither declaration_set nor control_receipts has a store bound of its own:
  // a request is held only to READER_LIMITS.objectBytes at create. So the
  // test states the room they keep: more than 1.7 MiB.
  const room = READER_LIMITS.objectBytes - bytes;
  assert.ok(room > 1.7 * 1024 * 1024, `the record is ${bytes} bytes`);
  record.request = { layers: ['sound'], declaration_set: { pad: 'd'.repeat(1024 * 1024) } };
  record.control_receipts = Array.from({ length: 2000 }, (_, i) => ({
    key: 'f'.repeat(64),
    action: 'resume',
    digest: 'f'.repeat(64),
    payload_hash: 'f'.repeat(64),
    at: max - i,
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(record)) < READER_LIMITS.objectBytes);
});

// One field wider than the bound: the record save's own `encoded` refuses
// 413 inside the try, after the pages, indexes, manifest, checkpoint and
// segments were written (§4 accepts that: only orphans changed).
test('write path: a record one field past 2 MiB is refused 413 at its save; only unreferenced objects are new, and maintain() sweeps them', (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const job = writeJob(t, fx);
  const { store, directory } = job;
  commitFrame(store, job.lease, fx.frames[0]);
  // The request grows the record to just under the bound; frame 2's record
  // passes it.
  const current = store.records.get(fx.job_id);
  const size = Buffer.byteLength(JSON.stringify(current));
  const pad = READER_LIMITS.objectBytes - size - 64;
  store._open(() =>
    store._save({ ...current, request: { ...current.request, pad: 'p'.repeat(pad) } }, true)
  );
  const before = written(store, fx.job_id);
  const record = clone(store.records.get(fx.job_id));
  assert.throws(
    () => commitFrame(store, job.lease, fx.frames[1]),
    (e) => e.code === 'RESOURCE_LIMIT' && e.status === 413
  );
  const after = store.records.get(fx.job_id);
  assert.deepEqual(after.discovery, record.discovery, 'record.discovery unchanged');
  assert.deepEqual(after, record, 'the record unchanged');
  assert.deepEqual(listsOf(store, fx.job_id), before.lists, 'the lists unchanged');
  const added = Object.fromEntries(
    STORED.map((kind) => [
      kind,
      objectsOf(store, kind).filter((f) => !before.objects[kind].includes(f)),
    ])
  );
  const segments = fx.frames[1].expect.segments.map((s) => `${s.address}.json`);
  for (const name of segments) assert.ok(added.pages.includes(name), `${name} was written`);
  assert.ok(added.manifests.length === 1 && added.checkpoints.length === 1);
  // None of them is referenced: a full maintain() sweeps them all.
  backdate(directory);
  // The scheduler's catch would pause it; here the lease ends by expiry.
  store._open(() =>
    store._save({ ...store.records.get(fx.job_id), state: 'paused', fence: null }, true)
  );
  maintainAll(store);
  for (const kind of STORED)
    for (const name of added[kind])
      assert.ok(!fs.existsSync(path.join(store.directory, kind, name)), `${kind}/${name} swept`);
  for (const kind of STORED)
    for (const name of before.objects[kind])
      if (kind !== 'pages' || !segments.includes(name))
        assert.ok(fs.existsSync(path.join(store.directory, kind, name)), `${kind}/${name} kept`);
});

// ── W4's shape and bound checks (#656 Step 9; §2.8, §3, §3.1, §3.2) ───────
// A fresh job (no discovery, no cursor) that takes the frames given in turn:
// each but the last must be accepted, and the last is refused W4 or accepted.
const FRESH = { record: { discovery: null, cursor: null } };
// sortedCanonical is the store's canonical() (sorted keys, no whitespace),
// from builders.mjs.
const cbytes = (v) => Buffer.byteLength(sortedCanonical(v));
// Each frame's cursor.candidate is its index, unless the case sets it, so a
// frame that repeats the one before is a commit, never an exact retry.
function shapeCase(t, frames, outcome, name) {
  const job = writeJob(t, FRESH);
  frames = frames.map((f, k) => {
    const g = clone(f);
    if (frames.length > 1 && !Object.hasOwn(g.cursor, 'candidate')) g.cursor.candidate = k;
    return g;
  });
  for (const f of frames.slice(0, -1))
    assert.equal(commitFrame(job.store, job.lease, f).state, 'running', `${name}: a setup frame`);
  const last = frames.at(-1);
  if (outcome === 'W4') refusedFrame(job, last, 'W4', name);
  else {
    assert.equal(commitFrame(job.store, job.lease, last).state, 'running', name);
    assert.deepEqual(job.store.records.get(job.id).cursor, last.cursor, `${name}: committed`);
  }
}
// minimalFrame() edited, at epoch `epoch` (frame, method_index and
// cursor.discovery agree, W2).
function shapeFrame(edit = () => {}, epoch = 0) {
  const f = minimalFrame();
  f.discovery.epoch = epoch;
  f.cursor.method_index = epoch;
  f.cursor.discovery.epoch = epoch;
  edit(f.cursor, f.cursor.discovery);
  return f;
}
const WITNESS = (epoch = 0) => ({
  version: 1,
  epoch,
  method_id: 'schema:end_rhyme',
  fields: ['method_id', 'id', 'verdict', 'a.token_ids', 'b.token_ids'],
  count: 4,
  digest: 'f'.repeat(64),
});
// n string entries of exactly `bytes` canonical bytes together.
function entriesOf(n, bytes) {
  const each = Math.floor(bytes / n);
  return Array.from({ length: n }, (_, i) => {
    const want = i < n - 1 ? each : bytes - (n - 1) * each;
    return 'k'.repeat(want - 2);
  });
}

test('W4: bad/cursor_over_bound.json, built from builders.mjs: the controls accepted, each mutant refused', (t) => {
  const fx = loadFixture('bad/cursor_over_bound.json');
  assert.deepEqual(
    [fx.expect.rule, fx.expect.code, fx.expect.status],
    ['W4', 'READER_PROTOCOL', 400]
  );
  assert.deepEqual(
    fx.controls.map((c) => c.name),
    ['largest', 'at_the_bound']
  );
  assert.deepEqual(
    fx.mutants.map((m) => m.name),
    [
      'one_byte_over',
      'refusal_one_byte_over',
      'integer_past_the_safe_range',
      'integer_below_zero',
      'number_not_an_integer',
    ]
  );
  // The frame the validator gives each cursor (cursorFrame there): the
  // cursor's own epoch, no logs, an empty continuation.
  const frameOf = (rest) => ({
    discovery: { epoch: rest.method_index, resets: [], seals: [] },
    cursor: {
      ...clone(rest),
      discovery: { ...clone(EMPTY_CD), epoch: rest.method_index },
      continuation: {},
    },
  });
  const built = (c) => {
    const rest = cursorCase(fx.inputs, c.name, DISCOVERY_LIMITS.CURSOR_BYTES);
    // By the store's sorted canonical(), byte for byte the fixture's.
    assert.equal(cbytes(rest), c.bytes, `${c.name}: its canonical bytes`);
    const digest = createHash('sha256').update(sortedCanonical(rest)).digest('hex');
    assert.equal(digest, c.sha256, `${c.name}: its digest`);
    return rest;
  };
  for (const c of fx.controls) {
    const job = writeJob(t, FRESH);
    const saved = commitFrame(job.store, job.lease, frameOf(built(c)));
    assert.equal(saved.state, 'running', c.name);
  }
  assert.equal(fx.controls[1].bytes, DISCOVERY_LIMITS.CURSOR_BYTES);
  assert.equal(fx.mutants[0].bytes, DISCOVERY_LIMITS.CURSOR_BYTES + 1);
  for (const m of fx.mutants) refusedFrame(writeJob(t, FRESH), frameOf(built(m)), 'W4', m.name);
});

test("W4: the codec fixture's cursor integer fields are refused; good/witness_cursor_option2.json's cursor is accepted", (t) => {
  const fx = loadFixture('good/codec_error_mapping.json');
  const cases = fx.integer_fields.filter((c) => c.where === 'cursor');
  assert.equal(cases.length, 2);
  const at = (cursor, field, value) => {
    const keys = field.split('.');
    let v = cursor;
    for (const k of keys.slice(0, -1)) v = v[k] ??= {};
    v[keys.at(-1)] = value;
  };
  for (const c of cases) {
    assert.deepEqual([c.tag, c.rule], ['INTEGER_FIELD', 'W4']);
    shapeCase(
      t,
      [shapeFrame((cursor) => at(cursor, c.field, c.value))],
      'W4',
      `${c.field}=${c.value}`
    );
  }
  // The control: the same field at an integer.
  shapeCase(t, [shapeFrame((cursor) => at(cursor, cases[0].field, 0))], 'accepted', 'control');
  const wx = loadFixture('good/witness_cursor_option2.json');
  const epoch = wx.cursor.method_index;
  shapeCase(
    t,
    [{ discovery: { epoch, resets: [], seals: [] }, cursor: clone(wx.cursor) }],
    'accepted',
    'witness_cursor_option2'
  );
});

test('W4: cursor.discovery, its logs, inventory, groups and groups.current hold exactly their keys', (t) => {
  const log = (cd) => {
    cd.logs.seen = { sealed: 0, sealed_digest: domainDigest(DOMAINS.log('seen')), tail: [] };
  };
  const cases = [
    ['cursor.discovery with a key more', (c, cd) => (cd.extra = 0)],
    ['cursor.discovery without inventory', (c, cd) => delete cd.inventory],
    ['cursor.discovery without groups', (c, cd) => delete cd.groups],
    ['cursor.discovery of version 2', (c, cd) => (cd.version = 2)],
    ['a log with a key more', (c, cd) => (log(cd), (cd.logs.seen.extra = 0))],
    ['groups with a key more', (c, cd) => (cd.groups.extra = null)],
    ['groups without current', (c, cd) => delete cd.groups.current],
    [
      'groups.current with a key more',
      (c, cd) => (cd.groups.current = { lines: [0, 1], keys: [], extra: 0 }),
    ],
    ['groups.current without keys', (c, cd) => (cd.groups.current = { lines: [0, 1] })],
    [
      'inventory with a key more',
      (c, cd) => (cd.inventory = { count: 1, digest: 'a'.repeat(64), x: 0 }),
    ],
    ['inventory without its digest', (c, cd) => (cd.inventory = { count: 1 })],
    [
      'inventory with a short digest',
      (c, cd) => (cd.inventory = { count: 1, digest: 'a'.repeat(63) }),
    ],
    [
      'inventory with a string count',
      (c, cd) => (cd.inventory = { count: '1', digest: 'a'.repeat(64) }),
    ],
    ['inventory not an object', (c, cd) => (cd.inventory = [1, 'a'.repeat(64)])],
  ];
  for (const [name, edit] of cases) shapeCase(t, [shapeFrame(edit)], 'W4', name);
  // The controls: each object with exactly its keys.
  shapeCase(
    t,
    [
      shapeFrame((c, cd) => {
        log(cd);
        cd.inventory = { count: 1, digest: 'a'.repeat(64) };
        cd.groups.current = { lines: [0, 1], keys: [] };
      }),
    ],
    'accepted',
    'every object with exactly its keys'
  );
});

test('W4: groups hold line pairs, current after through, within GROUP_KEYS and GROUP_BYTES', (t) => {
  const groups = (through, current) => (c, cd) => {
    cd.groups = { through, current };
  };
  const cur = (lines, keys = []) => ({ lines, keys });
  const refusedCases = [
    ['through of one line', groups([3, 3], null)],
    ['through out of order', groups([4, 3], null)],
    ['through of one number', groups([3], null)],
    ['through of three numbers', groups([1, 2, 3], null)],
    ['through not an array', groups({ 0: 1, 1: 2 }, null)],
    ['through a float', groups([1.5, 2], null)],
    ['current of one line', groups(null, cur([2, 2]))],
    ['current out of order', groups(null, cur([2, 1]))],
    ['current lines a string', groups(null, cur(['1', 2]))],
    ['current keys not an array', groups(null, { lines: [0, 1], keys: 'k' })],
    ['current at through', groups([1, 2], cur([1, 2]))],
    ['current before through', groups([1, 3], cur([1, 2]))],
    ['current before through, an earlier first line', groups([2, 3], cur([1, 4]))],
    [
      'GROUP_KEYS + 1 keys',
      groups(
        null,
        cur(
          [0, 1],
          Array.from({ length: 33 }, (_, i) => i)
        )
      ),
    ],
    ['GROUP_BYTES + 1 bytes', groups(null, cur([0, 1], entriesOf(4, 8193)))],
  ];
  assert.equal(DISCOVERY_LIMITS.GROUP_KEYS, 32);
  assert.equal(DISCOVERY_LIMITS.GROUP_BYTES, 8192);
  for (const [name, edit] of refusedCases) shapeCase(t, [shapeFrame(edit)], 'W4', name);
  const accepted = [
    ['through and current null', groups(null, null)],
    ['through alone', groups([0, 1], null)],
    ['current alone', groups(null, cur([0, 1]))],
    ['current after through, the same first line', groups([1, 2], cur([1, 3]))],
    ['current after through, a later first line', groups([1, 5], cur([2, 3]))],
    [
      'GROUP_KEYS keys',
      groups(
        null,
        cur(
          [0, 1],
          Array.from({ length: 32 }, (_, i) => i)
        )
      ),
    ],
    ['GROUP_BYTES bytes', groups(null, cur([0, 1], entriesOf(4, 8192)))],
  ];
  for (const [name, edit] of accepted) shapeCase(t, [shapeFrame(edit)], 'accepted', name);
});

test('W4: within an epoch, through never moves back and a non-null inventory is fixed, against record.cursor', (t) => {
  const through = (pair, epoch = 0) =>
    shapeFrame((c, cd) => (cd.groups = { through: pair, current: null }), epoch);
  shapeCase(t, [through([1, 2]), through([0, 5])], 'W4', 'through moved back');
  shapeCase(t, [through([1, 2]), through([1, 1])], 'W4', 'through moved back to one line');
  shapeCase(t, [through([1, 2]), through(null)], 'W4', 'through moved back to null');
  shapeCase(t, [through([1, 2]), through([1, 2])], 'accepted', 'through held');
  shapeCase(t, [through([1, 2]), through([1, 3])], 'accepted', 'through moved on');
  shapeCase(t, [through(null), through([0, 1])], 'accepted', 'through set');
  // Nor does the current group, even with through null (BB8 6715584092,
  // F-6), narrowed (BB8 6717719856) to frames where both the record's cursor
  // and the frame have a current group: the frame's current.lines is at or
  // after the previous one. A group dropped without retiring, and a through
  // behind the previous group, are accepted for now, PENDING 3PO's #721
  // confirmation that the worker never makes either: widen if confirmed, and
  // the `pending` cases below become W4 again.
  const groups = (g, epoch = 0) => shapeFrame((c, cd) => (cd.groups = g), epoch);
  const cur = (lines) => ({ lines, keys: [] });
  const at34 = groups({ through: null, current: cur([3, 4]) });
  for (const [name, g] of [
    ['current moved back, through null', { through: null, current: cur([1, 2]) }],
    ['current moved back, a later second line', { through: null, current: cur([2, 9]) }],
    ['retired before it, the next open behind it', { through: [1, 2], current: cur([2, 3]) }],
  ])
    shapeCase(t, [at34, groups(g)], 'W4', name);
  for (const [name, g] of [
    ['current dropped, nothing retired', { through: null, current: null }],
    ['retired behind the previous current', { through: [2, 5], current: null }],
  ])
    shapeCase(t, [at34, groups(g)], 'accepted', `pending #721: ${name}`);
  const at35 = groups({ through: null, current: cur([3, 5]) });
  shapeCase(
    t,
    [at35, groups({ through: null, current: cur([3, 4]) })],
    'W4',
    'current moved back, the same first line'
  );
  shapeCase(
    t,
    [at35, groups({ through: [3, 4], current: null })],
    'accepted',
    'pending #721: retired behind the previous current, the same first line'
  );
  for (const [name, g] of [
    ['current held', { through: null, current: cur([3, 4]) }],
    ['current moved on', { through: null, current: cur([3, 5]) }],
    ['current retired', { through: [3, 4], current: null }],
    ['current retired, the next open', { through: [3, 4], current: cur([5, 6]) }],
  ])
    shapeCase(t, [at34, groups(g)], 'accepted', name);
  // The previous current.lines bounds the frame whatever the previous
  // through was, not only when it was null (Step 10 review, F1): a record
  // cursor with a retired group [1,2] and the current group [5,6].
  const at56 = groups({ through: [1, 2], current: cur([5, 6]) });
  shapeCase(
    t,
    [at56, groups({ through: [1, 2], current: cur([3, 4]) })],
    'W4',
    'current moved back, through held'
  );
  shapeCase(
    t,
    [at56, groups({ through: [3, 4], current: null })],
    'accepted',
    'pending #721: retired behind the previous current, through not null'
  );
  shapeCase(
    t,
    [at56, groups({ through: [1, 2], current: cur([5, 7]) })],
    'accepted',
    'current moved on, through held'
  );
  shapeCase(
    t,
    [at56, groups({ through: [5, 6], current: null })],
    'accepted',
    'current retired, through not null before'
  );
  shapeCase(
    t,
    [at34, groups({ through: null, current: cur([1, 2]) }, 1)],
    'accepted',
    'a new epoch, an earlier current'
  );
  // An epoch advance starts again (W2: the record's epoch goes up).
  shapeCase(t, [through([5, 6]), through(null, 1)], 'accepted', 'a new epoch, through null');
  shapeCase(t, [through([5, 6]), through([0, 1], 1)], 'accepted', 'a new epoch, through earlier');
  const inv = (value, epoch = 0) => shapeFrame((c, cd) => (cd.inventory = value), epoch);
  const A = { count: 3, digest: 'a'.repeat(64) };
  const B = { count: 3, digest: 'b'.repeat(64) };
  shapeCase(t, [inv(A), inv(B)], 'W4', 'the inventory changed');
  shapeCase(t, [inv(A), inv({ ...A, count: 4 })], 'W4', 'the inventory count changed');
  shapeCase(t, [inv(A), inv(null)], 'W4', 'the inventory went back to null');
  shapeCase(
    t,
    [inv(A), inv({ digest: A.digest, count: A.count })],
    'accepted',
    'the inventory held'
  );
  shapeCase(t, [inv(null), inv(A)], 'accepted', 'the inventory set');
  shapeCase(t, [inv(A), inv(B, 1)], 'accepted', 'a new epoch, a new inventory');
  shapeCase(t, [inv(A), inv(null, 1)], 'accepted', 'a new epoch, no inventory yet');
});

test("W4: the witness is null or well formed, of the frame's epoch, its fields dot paths within WITNESS_FIELDS", (t) => {
  const witness = (edit, epoch = 3) =>
    shapeFrame((c) => {
      c.witness = WITNESS(epoch);
      edit(c.witness);
    }, epoch);
  const refusedCases = [
    ['absent', shapeFrame((c) => delete c.witness)],
    ['not an object', shapeFrame((c) => (c.witness = []))],
    ['another epoch', witness((w) => (w.epoch = 2))],
    ['version 2', witness((w) => (w.version = 2))],
    ['a method_id not a string', witness((w) => (w.method_id = 1))],
    ['fields not an array', witness((w) => (w.fields = 'id'))],
    [
      'WITNESS_FIELDS + 1 fields',
      witness((w) => (w.fields = Array.from({ length: 17 }, (_, i) => `f${i}`))),
    ],
    ['a field of 65 bytes', witness((w) => (w.fields = ['a'.repeat(65)]))],
    ['a field not a string', witness((w) => (w.fields = [1]))],
    ['a field with a capital', witness((w) => (w.fields = ['A.b']))],
    ['a field with an empty name', witness((w) => (w.fields = ['a..b']))],
    ['a field with a leading dot', witness((w) => (w.fields = ['.a']))],
    ['a field with a trailing dot', witness((w) => (w.fields = ['a.']))],
    ['a field with a quote', witness((w) => (w.fields = ['a"b']))],
    ['a field with a letter past ASCII', witness((w) => (w.fields = ['a.é']))],
    ['a count not an integer', witness((w) => (w.count = 1.5))],
    ['a count below zero', witness((w) => (w.count = -1))],
    ['a count that is a string', witness((w) => (w.count = '4'))],
    ['a short digest', witness((w) => (w.digest = 'f'.repeat(63)))],
    ['an uppercase digest', witness((w) => (w.digest = 'F'.repeat(64)))],
  ];
  assert.equal(DISCOVERY_LIMITS.WITNESS_FIELDS, 16);
  for (const [name, f] of refusedCases) shapeCase(t, [f], 'W4', `witness ${name}`);
  const accepted = [
    ['null', shapeFrame((c) => (c.witness = null))],
    ['the five fields of v1', witness(() => {})],
    [
      'WITNESS_FIELDS fields',
      witness((w) => (w.fields = Array.from({ length: 16 }, (_, i) => `f${i}`))),
    ],
    ['a field of 64 bytes', witness((w) => (w.fields = [`${'a'.repeat(31)}.${'b'.repeat(32)}`]))],
    ['no fields', witness((w) => (w.fields = []))],
  ];
  for (const [name, f] of accepted) shapeCase(t, [f], 'accepted', `witness ${name}`);
});

// The witness holds exactly §2.8's six keys (BB8 6715584092), on both sides:
// the validator's W4 makes the same check. Each key missing in turn, and one
// key more (null, an object, a key that only differs by case); the control
// is the six keys, in any order.
test('W4: the witness holds exactly the keys of §2.8', (t) => {
  const KEYS = ['version', 'epoch', 'method_id', 'fields', 'count', 'digest'];
  assert.deepEqual(Object.keys(WITNESS(3)), KEYS);
  const witness = (edit) =>
    shapeFrame((c) => {
      c.witness = WITNESS(3);
      edit(c.witness);
    }, 3);
  for (const key of KEYS)
    shapeCase(t, [witness((w) => delete w[key])], 'W4', `witness without ${key}`);
  for (const [name, edit] of [
    ['a key more', (w) => (w.extra = 0)],
    ['a null key more', (w) => (w.extra = null)],
    ['an object key more', (w) => (w.detail = {})],
    ['a key more that differs by case', (w) => (w.Count = 4)],
  ])
    shapeCase(t, [witness(edit)], 'W4', `witness with ${name}`);
  shapeCase(t, [witness(() => {})], 'accepted', 'witness with exactly its keys');
  shapeCase(
    t,
    [
      shapeFrame((c) => {
        c.witness = Object.fromEntries(Object.entries(WITNESS(3)).reverse());
      }, 3),
    ],
    'accepted',
    'witness with exactly its keys, in another order'
  );
});

test('W4: continuation within CONTINUATION_BYTES; methods[*] with no terminal input and each refusal within REFUSAL_BYTES', (t) => {
  const continuation = (n) => {
    const c = { x: '' };
    c.x = 'c'.repeat(n - cbytes(c));
    assert.equal(cbytes(c), n);
    return c;
  };
  assert.equal(DISCOVERY_LIMITS.CONTINUATION_BYTES, 8192);
  const C = DISCOVERY_LIMITS.CONTINUATION_BYTES;
  shapeCase(
    t,
    [shapeFrame((c) => (c.continuation = continuation(C + 1)))],
    'W4',
    'continuation + 1'
  );
  shapeCase(t, [shapeFrame((c) => delete c.continuation)], 'W4', 'no continuation');
  shapeCase(t, [shapeFrame((c) => (c.continuation = null))], 'W4', 'a null continuation');
  shapeCase(t, [shapeFrame((c) => (c.continuation = []))], 'W4', 'an array continuation');
  shapeCase(t, [shapeFrame((c) => (c.continuation = continuation(C)))], 'accepted', 'continuation');
  // The byte count, not the sort: sorted and unsorted JSON of one object have
  // the same length, so no byte bound can show which form measured it (the
  // inventory comparison, which can, is pinned in its own test).
  const sorted = continuation(C);
  shapeCase(
    t,
    [shapeFrame((c) => (c.continuation = { z: 1, ...sorted }))],
    'W4',
    'continuation + 6, its keys out of order'
  );
  for (const key of ['domain_true', 'domain_undecided', 'alt_cells'])
    shapeCase(
      t,
      [shapeFrame((c) => (c.methods = { m: { candidates: 0, [key]: 0 } }))],
      'W4',
      `methods[m].${key}`
    );
  const fx = loadFixture('bad/cursor_over_bound.json');
  const refusal = clone(fx.inputs.refusal);
  assert.equal(cbytes(refusal), DISCOVERY_LIMITS.REFUSAL_BYTES);
  const withRefusal = (r) => shapeFrame((c) => (c.methods = { m: { candidates: 0, refusal: r } }));
  shapeCase(t, [withRefusal(refusal)], 'accepted', 'a refusal of REFUSAL_BYTES');
  shapeCase(
    t,
    [withRefusal({ ...refusal, detail: `${refusal.detail}x` })],
    'W4',
    'REFUSAL_BYTES + 1'
  );
  shapeCase(
    t,
    [shapeFrame((c) => (c.methods = { m: { candidates: 0, coverage: 'answered' } }))],
    'accepted',
    'a method with no refusal and no terminal input'
  );
});

test('W4: every cursor number outside the entries and continuation is an integer from 0 to 2^53 - 1', (t) => {
  const refusedCases = [
    ['sequence', (c) => (c.sequence = 2 ** 53)],
    ['candidate', (c) => (c.candidate = -1)],
    ['counters.true', (c) => (c.counters = { true: 1.5 })],
    ['methods.m.figure_counts.true', (c) => (c.methods = { m: { figure_counts: { true: -2 } } })],
    ['incomplete', (c) => (c.incomplete = { s: 0.25 })],
    ['refused_schemas', (c) => (c.refused_schemas = ['s', -1])],
    ['a nested array', (c) => (c.extra = [[[[0.5]]]])],
    ['inventory.count', (c, cd) => (cd.inventory = { count: -1, digest: 'a'.repeat(64) })],
    ['witness.count', (c) => (c.witness = { ...WITNESS(0), count: 2 ** 53 })],
    ['groups.current.lines', (c, cd) => (cd.groups.current = { lines: [-1, 1], keys: [] })],
  ];
  for (const [name, edit] of refusedCases) shapeCase(t, [shapeFrame(edit)], 'W4', name);
  // The entries are F1's: a negative integer there is an entry (§2.1). And
  // continuation is opaque: any finite number.
  const accepted = [
    [
      'a negative integer in a tail',
      (c, cd) =>
        (cd.logs.seen = {
          sealed: 0,
          sealed_digest: domainDigest(DOMAINS.log('seen')),
          tail: [-1, [-2]],
        }),
    ],
    [
      'a negative integer in a group key',
      (c, cd) => (cd.groups.current = { lines: [0, 1], keys: [-1] }),
    ],
    ['a float in continuation', (c) => (c.continuation = { position: 0.5, row: [-1] })],
    ['the largest integer', (c) => (c.sequence = Number.MAX_SAFE_INTEGER)],
  ];
  for (const [name, edit] of accepted) shapeCase(t, [shapeFrame(edit)], 'accepted', name);
});

test('W4: the shape and bound checks apply only when the frame carries discovery', (t) => {
  // Today's frames, with no discovery: a cursor W4 would refuse commits as
  // today, byte for byte.
  const { store } = fixture(t);
  const lease = store.lease(create(store).record.id);
  const fx = loadFixture('bad/cursor_over_bound.json');
  const over = cursorCase(fx.inputs, 'one_byte_over', DISCOVERY_LIMITS.CURSOR_BYTES);
  for (const cursor of [
    { phase: 'pairs', counters: { true: 1.5 }, sequence: -1 },
    { phase: 'pairs', methods: { m: { domain_true: 3, refusal: { detail: 'x'.repeat(600) } } } },
    { phase: 'pairs', continuation: { x: 'c'.repeat(9000) }, witness: { epoch: 'any' } },
    over,
  ]) {
    const saved = commit(store, lease, [{ id: `e-${cbytes(cursor)}`, verdict: true }], cursor);
    assert.equal(saved.state, 'running');
    assert.equal(Object.hasOwn(saved, 'discovery'), false);
    assert.deepEqual(store.records.get(lease.id).cursor, cursor);
  }
});

// Review of b3b2a64f5: F-1 (contract_version), F-2 and F-4 (methods[*] of any
// shape, as the validator walks them), and the survivors M27 and M29.
test('W4: the cursor contract_version is 2', (t) => {
  for (const [name, edit] of [
    ['contract_version 3', (c) => (c.contract_version = 3)],
    ['contract_version 1', (c) => (c.contract_version = 1)],
    ['contract_version a string', (c) => (c.contract_version = '2')],
    ['no contract_version', (c) => delete c.contract_version],
  ])
    shapeCase(t, [shapeFrame(edit)], 'W4', name);
  shapeCase(t, [shapeFrame((c) => (c.contract_version = 2))], 'accepted', 'contract_version 2');
});

test('W4: every member of methods is checked, whatever methods is; a member not an object holds nothing', (t) => {
  // An array's members are its entries: a terminal input there is refused.
  shapeCase(t, [shapeFrame((c) => (c.methods = [{ domain_true: 1 }]))], 'W4', 'an array methods');
  const fx = loadFixture('bad/cursor_over_bound.json');
  const over = { ...clone(fx.inputs.refusal), detail: `${fx.inputs.refusal.detail}x` };
  shapeCase(
    t,
    [shapeFrame((c) => (c.methods = [{ candidates: 0, refusal: over }]))],
    'W4',
    'an array methods, a refusal past REFUSAL_BYTES'
  );
  // Members that are not objects, as the validator accepts them (F-4: without
  // the guard, null would throw a TypeError, a 500, not a W4).
  for (const [name, methods] of [
    ['a null member', { m: null }],
    ['a number member', { m: 5 }],
    ['a string member', { m: 'domain_true' }],
    ['an array of null', [null]],
    ['methods null', null],
    ['methods a string', 'domain_true'],
  ])
    shapeCase(t, [shapeFrame((c) => (c.methods = methods))], 'accepted', name);
  shapeCase(
    t,
    [shapeFrame((c) => (c.methods = [{ candidates: 0 }]))],
    'accepted',
    'an array, clean'
  );
});

test("W4: planDiscovery needs the store's canonical()", () => {
  const record = { discovery: null, cursor: null };
  const frame = shapeFrame();
  assert.throws(() => planDiscovery(record, frame), TypeError);
  assert.throws(() => planDiscovery(record, frame, 'canonical'), TypeError);
  assert.ok(planDiscovery(record, frame, sortedCanonical), 'with it, the plan');
});

test("W4: a record cursor.discovery with no inventory holds none, so the frame's is accepted", (t) => {
  // Only a record cursor accepted before Step 9 can lack it: planted here.
  const job = writeJob(t, FRESH);
  assert.equal(commitFrame(job.store, job.lease, shapeFrame()).state, 'running');
  delete job.store.records.get(job.id).cursor.discovery.inventory;
  const frame = shapeFrame((c, cd) => (cd.inventory = { count: 3, digest: 'a'.repeat(64) }));
  frame.cursor.candidate = 1;
  assert.equal(commitFrame(job.store, job.lease, frame).state, 'running');
  assert.deepEqual(job.store.records.get(job.id).cursor, frame.cursor, 'committed');
});

// ── persisted discovery, Step 10 (#656 Node-side plan): the lease's walk
// (§5.1) in workerPayload, under the writer lock. Each walk fixture's record
// and segments are planted as a foreign writer would, and a second instance
// constructed on the store: its startup reconciliation builds the lists (the
// real path), or, for a lease-only case whose full read would release the
// job, design §B2's seam installs the fixture's list instead.
// The fixture's `/store` paths, in this store.
const atStore = (store, value) =>
  JSON.parse(JSON.stringify(value).replaceAll('"/store/', `"${store.directory}/`));
// The fixture's address lists, as `this.chains` holds them (§B2: `prebuilt`).
const prebuilt = (id, addresses) => new Map([[id, new Map(Object.entries(clone(addresses)))]]);
// A second instance on `directory`. With `lists`, design §B2's seam, for its
// constructor only: _reconcile installs them in place of the full read, and,
// with `collect: false`, _collectAll does nothing (its mark read decodes
// fatally, so a segment failing F3 would fail the constructor).
function walkStore(t, directory, { gzip = false, lists = null, collect = true } = {}) {
  const mocks = [];
  if (lists)
    mocks.push(
      t.mock.method(ReaderJobStore.prototype, '_reconcile', function () {
        this.chains = lists();
      })
    );
  if (!collect) mocks.push(t.mock.method(ReaderJobStore.prototype, '_collectAll', () => {}));
  try {
    return new ReaderJobStore({ directory, gzip });
  } finally {
    for (const m of mocks) m.mock.restore();
  }
}
// One walk: what it stats (and does not read), what it reads through _segment
// with an expect, whether the record file changed, and the payload or the
// refusal.
function walkOnce(t, store, id) {
  const file = path.join(store.directory, 'records', `${id}.json`);
  const before = fs.readFileSync(file);
  const generation = fs.readFileSync(path.join(store.directory, 'generation'), 'utf8');
  const lists = listsOf(store, id);
  const pages = path.join(store.directory, 'pages') + path.sep;
  const stats = [];
  const reads = [];
  const stat = fs.statSync;
  const segment = ReaderJobStore.prototype._segment;
  const spies = [
    t.mock.method(fs, 'statSync', function (target, ...rest) {
      const name = String(target);
      if (name.startsWith(pages)) stats.push(path.basename(name, '.json'));
      return stat.call(this, target, ...rest);
    }),
    t.mock.method(ReaderJobStore.prototype, '_segment', function (hash, expect, ...rest) {
      if (expect !== null) reads.push(hash);
      return segment.call(this, hash, expect, ...rest);
    }),
  ];
  let payload = null;
  let error = null;
  try {
    payload = store.workerPayload(id);
  } catch (thrown) {
    error = thrown;
  } finally {
    for (const s of spies) s.mock.restore();
  }
  const after = fs.readFileSync(file);
  return {
    payload,
    error,
    stat: [...new Set(stats)].filter((a) => !reads.includes(a)),
    read: reads,
    saved: !after.equals(before),
    generationMoved:
      fs.readFileSync(path.join(store.directory, 'generation'), 'utf8') !== generation,
    listsBefore: lists,
    record: store.records.get(id),
  };
}
// Plants a walk fixture beside a created job and leases it on a second
// instance: by the real path (reconciliation lists it), or by the seam.
function leaseFixture(t, fx, { gzip = false, seam = false, store: spec, job } = {}) {
  const { directory, store: first } = fixture(t, { gzip });
  const base = first.records.get(create(first).record.id);
  const planted = plantFixture(directory, base, fx, { gzip, store: spec, job });
  const store = walkStore(t, directory, {
    gzip,
    lists: seam ? () => prebuilt(fx.record.id, fx.addresses) : null,
  });
  assert.equal(store.failure, null);
  const lease = store.lease(fx.record.id);
  assert.equal(lease?.id, fx.record.id, 'the fixture job is leased');
  return { directory, store, lease, planted, base };
}
// A refused walk: STORAGE_CORRUPT 503, by `rule`, nothing released, saved or
// listed anew (§5.1, "A mismatch on a lease").
function assertWalkRefused(walk, rule, name) {
  assert.equal(walk.error?.code, 'STORAGE_CORRUPT', `${name}: ${walk.error?.message}`);
  assert.equal(walk.error.status, 503, name);
  assert.equal(walk.error.rule, rule, `${name}: the rule`);
  assert.equal(Object.keys(walk.error).includes('rule'), false, `${name}: rule not enumerable`);
  assert.equal(JSON.stringify(walk.error).includes('"rule"'), false, `${name}: never serialised`);
  for (const key of ['cause', 'log'])
    assert.equal(walk.error[key], undefined, `${name}: no ${key}, so its pause carries none`);
  assert.equal(walk.saved, false, `${name}: nothing saved`);
  assert.equal(walk.generationMoved, false, `${name}: nothing written`);
  assert.equal(walk.record.discovery.unavailable, null, `${name}: nothing released`);
}
const WALK_LEASES = ['good/lease_incremental_walk.json', 'good/lease_after_refused_commit.json'];

test("lease walk: each good walk fixture's expect.lease and next_lease, through the real store, plain and gzip", (t) => {
  for (const rel of WALK_LEASES)
    for (const gzip of [false, true])
      for (const seam of [false, true]) {
        const fx = loadFixture(rel);
        const name = `${rel} gzip=${gzip} seam=${seam}`;
        const { store, lease } = leaseFixture(t, fx, { gzip, seam });
        assert.deepEqual(listsOf(store, fx.record.id), fx.addresses, `${name}: the lists`);
        const walk = walkOnce(t, store, fx.record.id);
        assert.equal(walk.error, null, `${name}: ${walk.error?.message}`);
        const want = fx.expect.lease;
        assert.deepEqual(walk.stat, want.stat, `${name}: stats the verified prefix`);
        assert.deepEqual(walk.read, want.read, `${name}: reads what was appended since`);
        assert.equal(walk.saved, want.saved, `${name}: saved`);
        assert.deepEqual(walk.record.discovery.verified, want.verified, `${name}: verified`);
        const durable = JSON.parse(
          fs.readFileSync(path.join(store.directory, 'records', `${fx.record.id}.json`))
        );
        assert.deepEqual(durable.discovery.verified, want.verified, `${name}: verified on disk`);
        assert.deepEqual(walk.payload.discovery, atStore(store, want.payload), `${name}: payload`);
        // The payload is the record without its discovery, then the built one.
        const { discovery: _d, ...rest } = walk.record;
        for (const [key, value] of Object.entries(rest))
          assert.deepEqual(walk.payload[key], value, `${name}: payload ${key}`);
        assert.equal(walk.payload.state, 'running');
        assert.equal(walk.payload.fence, lease.fence);
        assert.deepEqual(listsOf(store, fx.record.id), fx.addresses, `${name}: lists unchanged`);
        if (fx.orphans)
          for (const orphan of fx.orphans)
            assert.ok(!JSON.stringify(walk.payload).includes(orphan), `${name}: no orphan`);
        // The next lease: the job yields, requeues and is leased again.
        store.pause(lease.id, lease.attempt, lease.fence, {
          code: 'YIELD',
          message: 'yield',
          requeue: true,
        });
        assert.equal(store.lease(fx.record.id)?.id, fx.record.id, `${name}: leased again`);
        const next = walkOnce(t, store, fx.record.id);
        assert.equal(next.error, null, name);
        const wantNext = fx.expect.next_lease ?? {
          stat: [...want.stat, ...want.read],
          read: [],
          saved: false,
        };
        assert.deepEqual(
          { stat: next.stat, read: next.read, saved: next.saved },
          wantNext,
          `${name}: the next lease reads and saves nothing`
        );
        assert.deepEqual(next.payload.discovery, walk.payload.discovery, `${name}: same payload`);
      }
});

test("lease walk: the seal sequence's record leases good/lease_payload_summary_paths.json's payload exactly", (t) => {
  for (const gzip of [false, true]) {
    const job = replayFixture(t, loadFixture('good/seal_sequence_two_logs.json'), { gzip });
    const fx = loadFixture('good/lease_payload_summary_paths.json');
    const walk = walkOnce(t, job.store, job.id);
    assert.equal(walk.error, null);
    assert.deepEqual(walk.payload.discovery, atStore(job.store, fx.payload.discovery));
    // Every segment was sealed by this instance and never verified: all read.
    assert.deepEqual(
      walk.read.sort(),
      Object.values(fx.payload.discovery.paths)
        .flat()
        .map((p) => path.basename(p, '.json'))
        .sort()
    );
    assert.deepEqual(
      walk.record.discovery.verified,
      fx.record.discovery.logs,
      'verified at the heads'
    );
    t.mock.restoreAll();
  }
});

// Each R5 fixture of the walk: refused before any read (the record and the
// list alone show it) or at the junction, nothing released or saved.
const WALK_REFUSED = [
  ['bad/verified_ahead_of_head.json', 'R5', []],
  ['bad/verified_bytes_ahead.json', 'R5', null],
  ['bad/verified_bytes_disagree.json', 'R5', null],
];

test('lease walk: the bad verified fixtures are refused R5, STORAGE_CORRUPT, nothing released or saved, plain and gzip', (t) => {
  for (const [rel, rule, read] of WALK_REFUSED)
    for (const gzip of [false, true])
      for (const seam of [false, true]) {
        const fx = loadFixture(rel);
        const name = `${rel} gzip=${gzip} seam=${seam}`;
        assert.deepEqual(
          [fx.expect.rule, fx.expect.code, fx.expect.status, fx.expect.released],
          [rule, 'STORAGE_CORRUPT', 503, null]
        );
        const { store } = leaseFixture(t, fx, { gzip, seam });
        const walk = walkOnce(t, store, fx.record.id);
        assertWalkRefused(walk, rule, name);
        assert.deepEqual(walk.read, read ?? fx.expect.lease.read, `${name}: what was read`);
        if (fx.expect.lease) assert.equal(walk.saved, fx.expect.lease.saved);
        assert.deepEqual(listsOf(store, fx.record.id), walk.listsBefore, `${name}: lists kept`);
        assert.deepEqual(
          walk.record.discovery,
          fx.record.discovery,
          `${name}: the job keeps its chains`
        );
      }
});

test("lease walk: head_bytes_disagree.expect.lease, by design §B2's seam, is R5's junction", (t) => {
  const fx = loadFixture('bad/head_bytes_disagree.json');
  const want = fx.expect.lease;
  for (const gzip of [false, true]) {
    const { store } = leaseFixture(t, fx, { gzip, seam: true });
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, want.rule, `gzip=${gzip}`);
    assert.deepEqual([walk.error.code, walk.error.status], [want.code, want.status]);
    assert.deepEqual(walk.read, want.read);
    assert.equal(walk.saved, want.saved);
    assert.equal(want.released, null);
  }
});

test("lease walk: §B2's control: with only _reconcile mocked, every lease-only case constructs and the GC sweeps nothing reachable", (t) => {
  for (const rel of [
    'bad/head_bytes_disagree.json',
    'bad/verified_ahead_of_head.json',
    'bad/verified_bytes_ahead.json',
    'bad/verified_bytes_disagree.json',
  ])
    for (const gzip of [false, true]) {
      const fx = loadFixture(rel);
      const { directory, store: first } = fixture(t, { gzip });
      const base = first.records.get(create(first).record.id);
      plantFixture(directory, base, fx, { gzip });
      const store = walkStore(t, directory, {
        gzip,
        lists: () => prebuilt(fx.record.id, fx.addresses),
      });
      assert.equal(store.failure, null, `${rel}: constructs`);
      // Every segment the installed lists hold is a root: none is swept.
      for (const address of Object.values(fx.addresses).flat())
        assert.ok(pageExists(directory, address), `${rel}: ${address} kept`);
      assert.deepEqual(store.records.get(fx.record.id).discovery, fx.record.discovery);
    }
  // And the one case the _collectAll mock hides a GC failure in: the 0xFF
  // read_back, whose mark read meets F3 (Step 5's own test).
  const codec = loadFixture('good/codec_error_mapping.json');
  const rb = codec.persisted_bytes.find((p) => p.read_back).read_back;
  const { directory, store: first } = fixture(t);
  const { base, address } = plantReadBack(directory, first, rb);
  refused(
    () => walkStore(t, directory, { lists: () => prebuilt(base.id, { seen: [address] }) }),
    'STORAGE_CORRUPT'
  );
});

test('lease walk: nothing in mcp/ outside the tests references prebuilt or mocks _reconcile or _collectAll', () => {
  const root = import.meta.dirname;
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'fixtures'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(c|m)?js$/.test(entry.name) && !/^test_/.test(entry.name)) files.push(full);
    }
  };
  visit(root);
  assert.ok(files.some((f) => f.endsWith('reader_job_store.js')));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    // The seam's helper, as code (a message may say the word: library_export_routes.js).
    assert.equal(/\bprebuilt\s*\(/.test(text), false, `${file} calls prebuilt`);
    assert.equal(
      /mock\.method\([^)]*['"](_reconcile|_collectAll)['"]/.test(text),
      false,
      `${file} mocks the seam`
    );
  }
});

// A read-back fixture's one segment, re-addressed under a created job's id
// (its fixture job id is not a store id), planted as that job's chain.
function plantReadBack(directory, store, rb) {
  const base = store.records.get(create(store).record.id);
  const [stored] = fixtureStore(rb.store).values();
  const raw = Buffer.from(
    stored.toString('latin1').replace(`"job_id":"${rb.record.id}"`, `"job_id":"${base.id}"`),
    'latin1'
  );
  assert.notDeepEqual(raw, stored, 're-addressed');
  const address = dsha(raw);
  const [log] = Object.keys(rb.record.discovery.logs);
  const discovery = clone(rb.record.discovery);
  discovery.logs[log].head = address;
  writeStored(directory, address, raw, false);
  plantRecord(directory, { ...base, identity_hash: rb.record.identity_hash, discovery });
  return { base, address, log, discovery };
}

test("lease walk: the read-back fixtures are F3 on a lease, STORAGE_CORRUPT, and a replacing decoder is not F3 (§2.11's required test)", (t) => {
  const depth = loadFixture('bad/entry_over_depth.json');
  const codec = loadFixture('good/codec_error_mapping.json');
  const cases = [
    ['entry_over_depth read_back', depth.read_back, depth.expect.read_back],
    ['entry_over_depth read_back_control', depth.read_back_control, null],
    ...codec.persisted_bytes
      .filter((p) => p.read_back)
      .map((p) => [`persisted_bytes ${p.name}`, p.read_back, p.expect]),
  ];
  assert.ok(cases.length >= 3);
  for (const [name, rb, want] of cases)
    for (const replacing of [false, true]) {
      const label = `${name} replacing=${replacing}`;
      const { directory, store: first } = fixture(t);
      const { base, address, log } = plantReadBack(directory, first, rb);
      // §B2: the list installed without the full read that would release the
      // job; _collectAll mocked for the 0xFF segment, whose mark read is F3.
      const store = walkStore(t, directory, {
        lists: () => prebuilt(base.id, { [log]: [address] }),
        collect: !name.startsWith('persisted_bytes'),
      });
      assert.equal(store.failure, null, label);
      store.lease(base.id);
      if (replacing)
        t.mock.method(ReaderJobStore.prototype, '_segmentText', (buf) => buf.toString('utf8'));
      const walk = walkOnce(t, store, base.id);
      t.mock.restoreAll();
      assert.deepEqual(walk.read, [address], `${label}: the one segment is read`);
      if (want === null) {
        assert.equal(walk.error, null, `${label}: passes`);
        const payload = atStore(store, rb.payload.discovery);
        payload.summary.logs[log].head = address;
        payload.paths[log] = [path.join(store.directory, 'pages', `${address}.json`)];
        assert.deepEqual(walk.payload.discovery, payload, `${label}: the payload`);
        assert.equal(walk.saved, true, `${label}: verified advanced`);
        continue;
      }
      assert.deepEqual(
        [want.lease_walk.code, want.lease_walk.status, want.lease_walk.released],
        ['STORAGE_CORRUPT', 503, false]
      );
      if (!replacing) {
        assertWalkRefused(walk, 'F3', label);
      } else if (name.startsWith('persisted_bytes')) {
        // The replacing decode reads U+FFFD: no F3, so the fault the fatal
        // decode finds is invisible to it, and the walk meets the bytes the
        // head names instead (R5's).
        assert.notEqual(walk.error?.rule, 'F3', `${label}: a replacing decode is not F3`);
        assert.ok(walk.error, `${label}: and still refused`);
      }
    }
});

test("lease walk: bad/segment_corrupt_at_reconciliation.json's expect.lease, corrupted after this instance reconciled", (t) => {
  const fx = loadFixture('bad/segment_corrupt_at_reconciliation.json');
  const want = fx.expect.lease;
  for (const gzip of [false, true]) {
    const { directory, store } = leaseFixture(t, fx, { gzip, store: { ...fx.store, corrupt: [] } });
    assert.deepEqual(listsOf(store, fx.record.id), fx.addresses, 'reconciled and listed');
    // The byte changed in place, with no foreign write: no reload follows.
    const [{ address }] = fx.store.corrupt;
    writeStored(directory, address, fixtureStore(fx.store).get(address), gzip);
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, want.rule, `gzip=${gzip}`);
    assert.deepEqual([walk.error.code, walk.error.status], [want.code, want.status]);
    assert.deepEqual(walk.read, want.read);
    assert.equal(walk.saved, want.saved);
    assert.equal(want.released, null);
  }
});

test('lease walk: a segment missing outside reconciliation is STORAGE_CORRUPT (bad/missing_segment.json), read or statted', (t) => {
  const fx = loadFixture('bad/missing_segment.json');
  assert.deepEqual(fx.expect.store_outside_reconciliation, {
    code: 'STORAGE_CORRUPT',
    status: 503,
  });
  for (const gzip of [false, true]) {
    // Its record verifies nothing, so the walk reads the omitted segment.
    const { directory, store } = leaseFixture(t, fx, { gzip, store: { ...fx.store, omit: [] } });
    for (const address of fx.store.omit)
      fs.unlinkSync(path.join(pagesDir(directory), `${address}.json`));
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, 'missing', `read gzip=${gzip}`);
    assert.equal(walk.read.includes(fx.store.omit[0]), true);
    // The incremental walk's record, missing a verified segment it only stats.
    const inc = loadFixture('good/lease_incremental_walk.json');
    const again = leaseFixture(t, inc, { gzip });
    const seen = inc.addresses.seen[0];
    fs.unlinkSync(path.join(pagesDir(again.directory), `${seen}.json`));
    const statted = walkOnce(t, again.store, inc.record.id);
    assertWalkRefused(statted, 'missing', `statted gzip=${gzip}`);
    assert.deepEqual(statted.read, [], 'refused at the stat, before any read');
  }
});

test('lease walk: a planted head with no list gets no partial list from a commit, and the next lease refuses R5', (t) => {
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const record = { discovery: fx.frames[1].expect.record_discovery, cursor: fx.frames[1].cursor };
  const job = writeJob(t, fx, { record, mock: true });
  commitFrame(job.store, job.lease, fx.frames[2]);
  assert.deepEqual(listsOf(job.store, job.id), { variants: [] }, 'no partial list');
  const walk = walkOnce(t, job.store, job.id);
  assertWalkRefused(walk, 'R5', 'a non-null head with no list');
  assert.deepEqual([walk.read, walk.stat], [[], []], 'refused before any stat or read');
  // A log whose head is null and that has no list holds the empty one.
  t.mock.restoreAll(); // writeJob's mock of reconciliation
  const inc = loadFixture('good/lease_incremental_walk.json');
  const { store } = leaseFixture(t, inc);
  store.chains.get(inc.record.id).delete('variants');
  const passed = walkOnce(t, store, inc.record.id);
  assert.equal(passed.error, null, 'a null head with no list passes R5');
  assert.deepEqual(passed.payload.discovery.paths.variants, []);
  assert.deepEqual(passed.read, inc.expect.lease.read);
});

// R5 on a one-segment chain (Step 10 review, F3): a non-null head with no
// list is R5 though the head alone would make a list of the right length
// ending at the head. seen, in the incremental walk's record, is one segment
// and verified at its head.
test('lease walk: a one-segment non-null head with no list is R5, before any stat or read', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const seen = fx.record.discovery.logs.seen;
  assert.equal(seen.segments, 1);
  assert.notEqual(seen.head, null);
  assert.deepEqual(fx.record.discovery.verified.seen, seen, 'verified at its head');
  for (const gzip of [false, true]) {
    const { store } = leaseFixture(t, fx, { gzip });
    store.chains.get(fx.record.id).delete('seen');
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, 'R5', `gzip=${gzip}`);
    assert.deepEqual([walk.read, walk.stat], [[], []], `gzip=${gzip}: nothing stat'ed or read`);
  }
});

// F3 on the walk holds each listed segment to the record's own epoch (Step
// 10 review, F2): a real chain at epoch 1 walks clean, and a listed segment
// of epoch 0, otherwise a whole chain ending at the head the record names,
// is F3.
test('lease walk: at epoch 1 a listed segment of another epoch is F3; the epoch-1 chain walks clean', (t) => {
  for (const gzip of [false, true]) {
    const at = `gzip=${gzip}`;
    const { directory, store: first } = fixture(t, { gzip });
    const base = first.records.get(create(first).record.id);
    const planted = plantReal(directory, base, base.id, { seen: 2 }, { epoch: 1, gzip });
    const store = walkStore(t, directory, { gzip });
    assert.equal(store.failure, null, `${at}: the epoch-1 chain reconciles`);
    assert.equal(store.lease(base.id)?.id, base.id);
    const clean = walkOnce(t, store, base.id);
    assert.equal(clean.error, null, `${at}: ${clean.error?.message}`);
    assert.deepEqual(clean.read, listsOf(store, base.id).seen, `${at}: both segments read`);
    assert.deepEqual(clean.record.discovery.verified, planted.discovery.logs);
    // The same log's chain at epoch 0, listed and named as the head.
    const old = realChain({ ...base, id: base.id }, 'seen', 1, { epoch: 0 });
    const address = dsha(old.raws[0]);
    writeStored(directory, address, old.raws[0], gzip);
    const live = store.records.get(base.id);
    store.records.set(base.id, {
      ...live,
      discovery: {
        ...live.discovery,
        logs: { seen: old.state },
        verified: { seen: old.empty },
      },
    });
    store.chains.get(base.id).set('seen', [address]);
    const walk = walkOnce(t, store, base.id);
    assertWalkRefused(walk, 'F3', `${at}: another epoch`);
    assert.deepEqual(walk.read, [address], `${at}: read, then refused`);
  }
});

// A verified segment is stat'ed as the read's own stat holds it (Step 10
// review, F6): a directory, or a stored size over the object bound, at a
// verified address is F6, never read.
test('lease walk: a verified address that is not a regular file, or is over the object bound, is F6 at its stat', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const seen = fx.addresses.seen[0];
  for (const [name, plant] of [
    ['a directory', (file) => fs.mkdirSync(file)],
    [
      'over the object bound',
      (file) => fs.writeFileSync(file, Buffer.alloc(READER_LIMITS.objectBytes + 1)),
    ],
  ]) {
    const { directory, store } = leaseFixture(t, fx);
    const file = path.join(pagesDir(directory), `${seen}.json`);
    fs.unlinkSync(file);
    plant(file);
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, 'F6', name);
    assert.deepEqual(walk.read, [], `${name}: refused at the stat, before any read`);
    assert.equal(store.failure, null, `${name}: the store serves on`);
  }
  // At the bound exactly, the stat passes: a verified segment is not read.
  const { directory, store } = leaseFixture(t, fx);
  fs.writeFileSync(
    path.join(pagesDir(directory), `${seen}.json`),
    Buffer.alloc(READER_LIMITS.objectBytes)
  );
  const walk = walkOnce(t, store, fx.record.id);
  assert.equal(walk.error, null, 'at the bound');
  assert.deepEqual(walk.read, fx.expect.lease.read);
});

// workerPayload takes the writer lock (Step 10 review, F5): while another
// process holds it, with nothing pending, the payload is refused STORE_BUSY
// before anything is stat'ed or read, for a job with discovery and for one
// with none (before Step 10 the second was served from the cache). The store
// serves on, and the payload is built once the lock is free.
test('lease walk: a live foreign writer lock refuses workerPayload STORE_BUSY, reading nothing, with or without discovery', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const { store } = leaseFixture(t, fx);
  const plain = create(store, 'viewer-b', 'request-plain').record.id;
  assert.notEqual(plain, fx.record.id);
  assert.equal(Object.hasOwn(store.records.get(plain), 'discovery'), false);
  const lock = path.join(store.directory, 'writer.lock');
  for (const id of [fx.record.id, plain]) {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, nonce: 'f'.repeat(32) }));
    let walk;
    try {
      walk = walkOnce(t, store, id);
    } finally {
      fs.unlinkSync(lock);
    }
    assert.deepEqual([walk.error?.code, walk.error?.status], ['STORE_BUSY', 503], id);
    assert.deepEqual(
      [walk.read, walk.stat, walk.saved, walk.generationMoved],
      [[], [], false, false],
      `${id}: nothing read or written`
    );
    assert.equal(store.failure, null, `${id}: the store serves on`);
  }
  const walk = walkOnce(t, store, fx.record.id);
  assert.equal(walk.error, null);
  assert.deepEqual(walk.read, fx.expect.lease.read, 'the lock freed, the walk runs');
  assert.equal(Object.hasOwn(walkOnce(t, store, plain).payload, 'discovery'), false);
});

test('lease walk: the refusals before the walk, in order: a pending release, then unavailable, reading nothing', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const { store } = leaseFixture(t, fx);
  store.pendingRelease.set(fx.record.id, true);
  let walk = walkOnce(t, store, fx.record.id);
  assert.deepEqual(
    [walk.error?.code, walk.error?.status, walk.error?.cause, walk.error?.log],
    ['DISCOVERY_UNAVAILABLE', 409, 'chain_broken', null],
    'a pending release refuses exactly as after its save'
  );
  assert.deepEqual([walk.read, walk.stat, walk.saved], [[], [], false]);
  store.pendingRelease.delete(fx.record.id);
  // A running job's release keeps its lease; its next workerPayload refuses.
  store._open(() =>
    store._release(store.records.get(fx.record.id), { cause: 'segment_missing', log: 'alt_cells' })
  );
  walk = walkOnce(t, store, fx.record.id);
  assert.deepEqual(
    [walk.error?.code, walk.error?.status, walk.error?.cause, walk.error?.log],
    ['DISCOVERY_UNAVAILABLE', 409, 'segment_missing', 'alt_cells']
  );
  assert.deepEqual([walk.read, walk.stat, walk.saved], [[], [], false]);
  // Expiry still comes first, as before the walk.
  const { store: other } = leaseFixture(t, fx);
  const live = other.records.get(fx.record.id);
  other.records.set(fx.record.id, { ...live, expires_at: 0 });
  refused(() => other.workerPayload(fx.record.id), 'RESULT_EXPIRED');
});

test('lease walk: a job holding no discovery is never walked, and gains no key; one with discovery null keeps null', (t) => {
  const { store } = fixture(t);
  const job = create(store);
  const lease = store.lease(job.record.id);
  let walk = walkOnce(t, store, lease.id);
  assert.equal(walk.error, null);
  assert.equal(Object.hasOwn(walk.payload, 'discovery'), false, 'no key, as today');
  assert.deepEqual(
    [walk.read, walk.stat, walk.saved, walk.generationMoved],
    [[], [], false, false]
  );
  store._open(() => store._save({ ...store.records.get(lease.id), discovery: null }, true));
  walk = walkOnce(t, store, lease.id);
  assert.equal(walk.payload.discovery, null);
  assert.deepEqual([walk.read, walk.saved], [[], false]);
});

test('lease walk: the verified save is skipped on STORE_RECOUNTING or RESOURCE_LIMIT, never refusing the lease; the next walk reads again', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  for (const [code, status, skipped] of [
    ['STORE_RECOUNTING', 503, true],
    ['RESOURCE_LIMIT', 507, true],
    ['RESOURCE_LIMIT', 413, false],
    ['STORE_RECOUNTING', 507, false],
  ]) {
    const name = `${code} ${status}`;
    const { store } = leaseFixture(t, fx);
    const capacity = t.mock.method(store, '_capacity', () => {
      throw Object.assign(new Error(name), { code, status });
    });
    const walk = walkOnce(t, store, fx.record.id);
    capacity.mock.restore();
    assert.equal(capacity.mock.callCount(), 1, `${name}: the save was attempted once`);
    assert.equal(walk.saved, false, `${name}: nothing saved`);
    assert.deepEqual(walk.record.discovery.verified, fx.record.discovery.verified, name);
    if (!skipped) {
      assert.equal(walk.error?.code, code, `${name}: any other refusal is the lease's`);
      continue;
    }
    assert.equal(walk.error, null, `${name}: the lease is not refused`);
    assert.deepEqual(walk.payload.discovery, atStore(store, fx.expect.lease.payload), name);
    const next = walkOnce(t, store, fx.record.id);
    assert.deepEqual(next.read, fx.expect.lease.read, `${name}: the next walk reads from there`);
    assert.equal(next.saved, true);
    assert.deepEqual(next.record.discovery.verified, fx.expect.lease.verified);
  }
});

test('lease walk: walk then commit (c15): one walk save before the first commit; the commit sees the saved record; a quota pause keeps the walked verified', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  for (const gzip of [false, true]) {
    const { store, lease } = leaseFixture(t, fx, { gzip });
    const saves = [];
    const save = store._save;
    t.mock.method(store, '_save', function (input, ...rest) {
      const out = save.call(this, input, ...rest);
      saves.push(out.discovery?.verified);
      return out;
    });
    const walk = walkOnce(t, store, fx.record.id);
    assert.deepEqual(
      saves,
      [fx.expect.lease.verified],
      'one save, the walk’s, which read something'
    );
    assert.equal(walk.saved, true);
    // The saved record keeps the lease and the result generation.
    const leased = store.records.get(fx.record.id);
    assert.deepEqual(
      [leased.fence, leased.attempt, leased.generation, leased.last_checkpoint_digest],
      [lease.fence, lease.attempt, lease.generation, lease.last_checkpoint_digest]
    );
    const frame = {
      cursor: fx.record.cursor,
      discovery: { epoch: 0, resets: [], seals: [] },
      previous_generation: leased.generation,
    };
    const payload = { ...frame, pages: [], progress: {}, coverage };
    const committed = store.commitCheckpoint(lease.id, lease.attempt, lease.fence, payload);
    assert.equal(committed.state, 'running', 'previous_generation sees the saved record');
    assert.equal(committed.generation, leased.generation + 1);
    assert.deepEqual(
      committed.discovery.verified,
      fx.expect.lease.verified,
      'a commit never moves verified'
    );
    assert.equal(saves.length, 2, 'then the commit’s save');
    const again = store.commitCheckpoint(lease.id, lease.attempt, lease.fence, payload);
    assert.deepEqual(again.added_page_paths, [], 'an exact retry');
    assert.equal(again.generation, committed.generation);
    assert.equal(saves.length, 2, 'the retry writes nothing');
    // A commit refused at full quota is a _quotaPause, from the record as saved.
    const blob = store._blob;
    t.mock.method(store, '_blob', function (kind, ...rest) {
      if (kind === 'pages')
        throw Object.assign(new Error('quota'), { code: 'RESOURCE_LIMIT', status: 507 });
      return blob.call(this, kind, ...rest);
    });
    const paused = store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
      ...payload,
      previous_generation: committed.generation,
      pages: [{ instances: [{ id: 'x' }] }],
    });
    assert.equal(paused.state, 'paused');
    assert.equal(paused.reason.code, 'RESOURCE_LIMIT');
    assert.deepEqual(
      paused.discovery.verified,
      fx.expect.lease.verified,
      'the walked verified kept'
    );
    t.mock.restoreAll();
  }
});

test("lease walk: §6.9's store promise: page_paths yield the committed records in commit order, with their multiplicity", (t) => {
  // 20 records over 16 ids across three commits: ids repeat within a page,
  // across pages of one commit and across commits.
  const commits = [
    [
      ['a', 'b', 'c', 'a'],
      ['d', 'e'],
    ],
    [
      ['f', 'g', 'b'],
      ['h', 'i'],
    ],
    [
      ['j', 'k', 'l', 'm', 'n', 'c'],
      ['o', 'p', 'a'],
    ],
  ];
  const ids = commits.flat(2);
  assert.deepEqual([ids.length, new Set(ids).size], [20, 16]);
  for (const gzip of [false, true]) {
    const { store } = fixture(t, { gzip });
    const lease = store.lease(create(store).record.id);
    let n = 0;
    for (const pages of commits)
      store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
        cursor: { phase: 'pairs', index: n++ },
        pages: pages.map((page) => ({
          instances: page.map((id, i) => ({ id, verdict: i % 2 === 0 })),
        })),
        progress: {},
        coverage,
      });
    const payload = store.workerPayload(lease.id);
    assert.deepEqual(payload.committed_page_paths, payload.page_paths);
    // As the worker's read_page_object reads them: bounded, inflated, a
    // strict UTF-8 decode, then the parse.
    const read = payload.page_paths.flatMap((file) => {
      const raw = fs.readFileSync(file);
      assert.ok(raw.length <= READER_LIMITS.objectBytes);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(decodeStoredObject(raw));
      return JSON.parse(text).instances.map((r) => r.id);
    });
    assert.deepEqual(read, ids, `gzip=${gzip}: no redelivery, deduplication or reordering`);
    assert.equal(payload.page_paths.length, 6);
  }
});

test('lease walk: the bridge request carries the walk’s discovery, with no verified and no unavailable key (c14); a job with none sends none', async (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  for (const kind of ['walked', 'no key', 'null']) {
    const held = kind === 'walked';
    const { directory, store: first } = fixture(t);
    let id = create(first).record.id;
    let store = first;
    // A discovery of null, as complete() saves it: the payload's is null, never sent.
    if (kind === 'null')
      first._open(() => first._save({ ...first.records.get(id), discovery: null }, true));
    if (held) {
      // At the head of the queue, ahead of the created job.
      plantFixture(directory, first.records.get(id), fx, { job: { queue_order: 0 } });
      store = walkStore(t, directory);
      id = fx.record.id;
    }
    const requests = [];
    const scheduler = new ReaderScheduler({
      store,
      bridge: {
        capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
        runReaderLease: async (request) => {
          requests.push(JSON.stringify(request));
          return { code: 0, reader_result: { status: 'yield', reason: 'YIELD' } };
        },
      },
      resolveIdentity: async () => identity,
      resolveSource: async () => ({ source: { text: 'line' } }),
    });
    t.mock.method(scheduler, 'kick', () => {});
    try {
      await scheduler.pump();
    } finally {
      scheduler.stop();
    }
    assert.equal(requests.length, 1, `${kind}: one lease`);
    const request = JSON.parse(requests[0]);
    assert.equal(/"(verified|unavailable)"/.test(requests[0]), false, 'never the store’s own');
    if (!held) {
      assert.equal(Object.hasOwn(request, 'discovery'), false, `${kind}: no key, as today`);
      continue;
    }
    assert.deepEqual(request.discovery, atStore(store, fx.expect.lease.payload));
    assert.deepEqual(store.records.get(id).discovery.verified, fx.expect.lease.verified, 'walked');
    assert.deepEqual(Object.keys(request.discovery).sort(), ['paths', 'summary', 'version']);
    assert.equal(store.records.get(id).state, 'queued', 'the yield requeued it');
  }
});

// F5 (BB8 6717719856): a STORE_BUSY at workerPayload requeues, never pauses.
// The lease ends, the job goes back to `queued` in its place with its attempt
// uncounted and no reason, and the next pump, one interval later (`later`,
// never `kick`), leases it and walks. Run through the real scheduler, for a
// job holding discovery and for one holding none.
function busyScheduler(t, store, { onLease } = {}) {
  const requests = [];
  const scheduler = new ReaderScheduler({
    store,
    bridge: {
      capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
      runReaderLease: async (request, options) => {
        requests.push(request);
        if (onLease) return onLease(request, options);
        return { code: 0, reader_result: { status: 'yield', reason: 'YIELD' } };
      },
    },
    resolveIdentity: async () => identity,
    resolveSource: async () => ({ source: { text: 'line' } }),
  });
  const kicks = t.mock.method(scheduler, 'kick', () => {});
  const laters = t.mock.method(scheduler, 'later', () => {});
  t.after(() => scheduler.stop());
  return { scheduler, requests, kicks, laters };
}
function busyJobs(t) {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const { directory, store: first } = fixture(t);
  const plain = create(first, 'viewer-b', 'request-plain').record.id;
  plantFixture(directory, first.records.get(plain), fx, { job: { queue_order: 0 } });
  const store = walkStore(t, directory);
  assert.equal(store.failure, null);
  return { fx, store, directory, plain };
}
const plantLock = (store) =>
  fs.writeFileSync(
    path.join(store.directory, 'writer.lock'),
    JSON.stringify({ pid: process.pid, nonce: 'f'.repeat(32) })
  );
const freeLock = (store) => fs.rmSync(path.join(store.directory, 'writer.lock'), { force: true });
const durable = (store, id) =>
  JSON.parse(fs.readFileSync(path.join(store.directory, 'records', `${id}.json`)));

test('F5: a STORE_BUSY at workerPayload requeues the job in its place with its attempt uncounted, never paused; the next lease walks', async (t) => {
  const { fx, store, plain } = busyJobs(t);
  for (const id of [fx.record.id, plain]) {
    const { scheduler, requests, kicks, laters } = busyScheduler(t, store);
    const before = store.records.get(id);
    assert.equal(before.state, 'queued');
    // Only this job is dispatchable, so the pump leases it.
    const other = id === plain ? fx.record.id : plain;
    store._open(() => store._save({ ...store.records.get(other), state: 'paused' }, true));
    // The foreign writer holds the lock only while the payload is built, so
    // the return lands at once.
    const payload = store.workerPayload;
    t.mock.method(store, 'workerPayload', function (...args) {
      plantLock(store);
      try {
        return payload.apply(this, args);
      } finally {
        freeLock(store);
      }
    });
    await scheduler.pump();
    store.workerPayload.mock.restore();
    assert.equal(requests.length, 0, `${id}: the worker never started`);
    const after = store.records.get(id);
    assert.deepEqual(
      [after.state, after.attempt, after.reason, after.fence, after.lease_expires_at],
      ['queued', before.attempt, null, null, null],
      `${id}: queued, not paused, with the attempt uncounted`
    );
    assert.deepEqual(
      [after.queued_at, after.queue_order, after.deferred_requeue],
      [before.queued_at, before.queue_order, false],
      `${id}: in the place it held`
    );
    assert.deepEqual(durable(store, id).state, 'queued', `${id}: saved`);
    if (id === fx.record.id)
      assert.deepEqual(after.discovery, before.discovery, `${id}: discovery untouched`);
    assert.equal(scheduler.busyLease, null, `${id}: settled`);
    assert.deepEqual(
      [laters.mock.callCount(), kicks.mock.callCount()],
      [1, 0],
      `${id}: the next pump is one interval later`
    );
    // The lock free, the next lease takes the job and walks.
    await scheduler.pump();
    assert.equal(requests.length, 1, `${id}: leased again`);
    const walked = store.records.get(id);
    assert.equal(walked.attempt, before.attempt + 1, `${id}: one attempt, for the lease that ran`);
    assert.equal(walked.state, 'queued', `${id}: the yield requeued it`);
    if (id === fx.record.id) {
      assert.deepEqual(requests[0].discovery, atStore(store, fx.expect.lease.payload));
      assert.deepEqual(walked.discovery.verified, fx.expect.lease.verified, 'the walk ran');
    } else assert.equal(Object.hasOwn(requests[0], 'discovery'), false);
    store._open(() => store._save({ ...store.records.get(other), state: 'queued' }, true));
  }
});

test('F5: while the foreign lock stays held the return waits, one try per pump, never a loop; freed, the job is requeued uncounted and the next lease walks', async (t) => {
  const { fx, store, plain } = busyJobs(t);
  store._open(() => store._save({ ...store.records.get(plain), state: 'paused' }, true));
  const id = fx.record.id;
  const before = store.records.get(id);
  const { scheduler, requests, laters, kicks } = busyScheduler(t, store);
  // The lock is taken after the lease, before the payload, and kept.
  const source = scheduler.resolveSource;
  scheduler.resolveSource = async (...args) => {
    plantLock(store);
    return source(...args);
  };
  t.after(() => freeLock(store));
  const returns = t.mock.method(store, 'returnLease');
  await scheduler.pump();
  scheduler.resolveSource = source;
  assert.equal(requests.length, 0);
  assert.equal(returns.mock.callCount(), 1, 'one return, refused STORE_BUSY');
  assert.equal(returns.mock.calls[0].error?.code, 'STORE_BUSY');
  assert.deepEqual(scheduler.busyLease, {
    id,
    attempt: before.attempt + 1,
    fence: store.records.get(id).fence,
  });
  assert.equal(durable(store, id).state, 'running', 'nothing written while the lock is held');
  assert.equal(store.failure, null, 'the store serves on');
  assert.deepEqual([laters.mock.callCount(), kicks.mock.callCount()], [1, 0]);
  // A pump while it is still held tries the return once more, leases nothing,
  // and waits another interval.
  await scheduler.pump();
  assert.equal(returns.mock.callCount(), 2);
  assert.equal(requests.length, 0);
  assert.equal(laters.mock.callCount(), 2);
  assert.equal(durable(store, id).attempt, before.attempt + 1);
  // Freed: the return lands, queued and uncounted, and the same pump leases
  // the job again and walks.
  freeLock(store);
  let seen = null;
  const lease = store.lease;
  t.mock.method(store, 'lease', function (...args) {
    seen ??= clone(this.records.get(id));
    return lease.apply(this, args);
  });
  await scheduler.pump();
  assert.equal(returns.mock.callCount(), 3);
  assert.equal(scheduler.busyLease, null);
  assert.deepEqual(
    [seen.state, seen.attempt, seen.reason, seen.queue_order],
    ['queued', before.attempt, null, before.queue_order],
    'requeued, not paused, the attempt uncounted, before the next lease'
  );
  assert.equal(requests.length, 1, 'the next lease ran');
  assert.deepEqual(requests[0].discovery, atStore(store, fx.expect.lease.payload));
  const walked = store.records.get(id);
  assert.deepEqual(walked.discovery.verified, fx.expect.lease.verified, 'and walked');
  assert.equal(walked.attempt, before.attempt + 1, 'one attempt counted in all');
});

test('F5: only workerPayload requeues; a STORE_BUSY from the checkpoint sink pauses the job as before, its attempt counted', async (t) => {
  const { fx, store, plain } = busyJobs(t);
  store._open(() => store._save({ ...store.records.get(plain), state: 'paused' }, true));
  const id = fx.record.id;
  const before = store.records.get(id);
  const { scheduler, laters, kicks } = busyScheduler(t, store, {
    onLease: async (_request, options) => {
      plantLock(store);
      try {
        await assert.rejects(
          options.onReaderCheckpoint({ provider_calls: 0, checkpoint: {}, records: [] }),
          { code: 'STORE_BUSY', status: 503 }
        );
      } finally {
        freeLock(store);
      }
      return { code: -1 };
    },
  });
  const returns = t.mock.method(store, 'returnLease');
  await scheduler.pump();
  assert.equal(returns.mock.callCount(), 0, 'no return');
  assert.equal(scheduler.busyLease, null);
  const after = store.records.get(id);
  assert.deepEqual(
    [after.state, after.attempt, after.reason?.code],
    ['paused', before.attempt + 1, 'STORE_BUSY'],
    'paused, as any other refusal there'
  );
  assert.deepEqual([laters.mock.callCount(), kicks.mock.callCount()], [0, 1]);
});

// The store's half (returnLease): only the lease's holder returns it; a cancel
// asked for meanwhile lands cancelled; a job released meanwhile is paused with
// the U2 reason, never requeued; with no queue room it is paused to return when
// a slot opens. The attempt is uncounted in each.
test('F5: returnLease ends only its own lease, and keeps cancel, U2 and the queue bound', (t) => {
  const cases = ['stale', 'cancel', 'released', 'full'];
  for (const kind of cases) {
    const fx = loadFixture('good/lease_incremental_walk.json');
    const { store, lease } = leaseFixture(t, fx);
    const id = fx.record.id;
    if (kind === 'stale') {
      refused(() => store.returnLease(id, lease.attempt, 'f'.repeat(64)), 'STALE_ATTEMPT');
      refused(() => store.returnLease(id, lease.attempt - 1, lease.fence), 'STALE_ATTEMPT');
      assert.equal(store.records.get(id).state, 'running', `${kind}: the lease stands`);
      continue;
    }
    if (kind === 'cancel')
      store._open(() => store._save({ ...store.records.get(id), cancel_requested: true }, true));
    if (kind === 'released')
      store._open(() =>
        store._release(store.records.get(id), { cause: 'segment_missing', log: 'alt_cells' })
      );
    if (kind === 'full')
      for (let n = store.listQueued().length; n < READER_LIMITS.waiting; n++)
        create(store, `viewer-${n}`, `full-${n}`);
    const back = store.returnLease(id, lease.attempt, lease.fence);
    assert.equal(back.attempt, lease.attempt - 1, `${kind}: uncounted`);
    assert.deepEqual([back.fence, back.lease_expires_at], [null, null], `${kind}: the lease ended`);
    if (kind === 'cancel')
      assert.deepEqual([back.state, back.reason?.code], ['cancelled', 'STORE_BUSY']);
    if (kind === 'released') {
      assert.deepEqual(
        [back.state, back.reason?.code, back.reason?.cause, back.deferred_requeue],
        ['paused', 'DISCOVERY_UNAVAILABLE', 'segment_missing', false],
        'U2: never requeued'
      );
    }
    if (kind === 'full') {
      assert.deepEqual(
        [back.state, back.reason?.code, back.deferred_requeue],
        ['paused', 'STORE_BUSY', true],
        'no room: back by itself when a slot opens, never QUEUE_FULL'
      );
      const first = [...store.records.values()].find((r) => r.state === 'queued');
      store._open(() => store._save({ ...first, state: 'paused' }, true));
      store.listQueued();
      assert.equal(store.records.get(id).state, 'queued', 'promoted once a slot opened');
    }
  }
});

// The mutation pass: each clause of R5 refuses on its own, as the validator's
// R5 test holds its model to, before any read where the record and the list
// alone show it, and the junction is R5, never R2. The record or the lists are
// changed in memory on the leased instance, as this image's own bookkeeping
// would be wrong.
test('lease walk: each clause of R5 refuses on its own, as STORAGE_CORRUPT, R5 and never R2', (t) => {
  const fx = loadFixture('good/lease_incremental_walk.json');
  const rd = fx.record.discovery;
  const alt0 = rd.verified.alt_cells;
  const [a0, a1] = fx.addresses.alt_cells;
  const empty = (log) => ({
    head: null,
    segments: 0,
    count: 0,
    bytes: 0,
    digest: domainDigest(DOMAINS.log(log)),
  });
  const cases = [
    // [name, verified alt_cells, alt_cells list, what is read]
    ['count ahead of the head', { ...alt0, count: rd.logs.alt_cells.count + 1 }, null, []],
    ['segments ahead of the head', { ...rd.logs.alt_cells, segments: 3 }, null, []],
    ['at the head with another digest', { ...rd.logs.alt_cells, digest: alt0.digest }, null, []],
    ['empty but not the empty state', { ...empty('alt_cells'), count: 1 }, null, []],
    ['a head the list does not hold there', { ...alt0, head: rd.logs.seen.head }, null, []],
    ['a list that skips the verified head', alt0, [a1], []],
    ['a list that skips its oldest, nothing verified', empty('alt_cells'), [a1], []],
    ['a list that does not end at the head', alt0, [a0, a0], []],
    ['a list past the head', alt0, [a0, a1, a1], []],
    ['the junction count', { ...alt0, count: 1000 }, null, [a1]],
    ['the junction digest', { ...alt0, digest: rd.logs.seen.digest }, null, [a1]],
  ];
  for (const [name, verified, list, read] of cases) {
    const { store } = leaseFixture(t, fx);
    const live = store.records.get(fx.record.id);
    store.records.set(fx.record.id, {
      ...live,
      discovery: {
        ...live.discovery,
        verified: { ...live.discovery.verified, alt_cells: verified },
      },
    });
    if (list) store.chains.get(fx.record.id).set('alt_cells', list);
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, 'R5', name);
    assert.deepEqual(walk.read, read, `${name}: what was read before the refusal`);
  }
});

test('lease walk: a listed segment whose successor names another address is R2, though its first and digests continue', (t) => {
  // alt_cells#0 stored a second time with other spacing: the same fields, so
  // its first, digests and entry bytes continue the chain, at another
  // address. A list holding that copy, then alt_cells#1 (whose previous_hash
  // names the original), passes every R5 clause; only the link refuses.
  const fx = loadFixture('good/lease_incremental_walk.json');
  for (const gzip of [false, true]) {
    const { directory, store } = leaseFixture(t, fx, { gzip });
    const [a0, a1] = fx.addresses.alt_cells;
    const copy = Buffer.from(JSON.stringify(JSON.parse(storedSegment(store, a0)), null, 1));
    const twin = dsha(copy);
    assert.notEqual(twin, a0);
    writeStored(directory, twin, copy, gzip);
    const live = store.records.get(fx.record.id);
    store.records.set(fx.record.id, {
      ...live,
      discovery: {
        ...live.discovery,
        verified: {
          ...live.discovery.verified,
          alt_cells: {
            head: null,
            segments: 0,
            count: 0,
            bytes: 0,
            digest: domainDigest(DOMAINS.log('alt_cells')),
          },
        },
      },
    });
    store.chains.get(fx.record.id).set('alt_cells', [twin, a1]);
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, 'R2', `gzip=${gzip}`);
    assert.deepEqual(walk.read, [twin, a1], 'the copy reads clean; its successor does not link');
  }
});

test('lease walk: past the junction a link that fails is R2, not R5', (t) => {
  // A real three-segment chain, its first verified; the list holds a copy of
  // the second at another address (same fields, other spacing), so the
  // junction passes and the third's previous_hash names the original.
  const { directory, store: first } = fixture(t);
  const base = first.records.get(create(first).record.id);
  const planted = plantReal(directory, base, base.id, { seen: 3 });
  const store = walkStore(t, directory);
  store.lease(base.id);
  const [s0, s1, s2] = listsOf(store, base.id).seen;
  const copy = Buffer.from(JSON.stringify(JSON.parse(storedSegment(store, s1)), null, 1));
  const twin = dsha(copy);
  writeStored(directory, twin, copy, false);
  const live = store.records.get(base.id);
  store.records.set(base.id, {
    ...live,
    discovery: {
      ...live.discovery,
      verified: { seen: realChain({ ...base, id: base.id }, 'seen', 1).state },
    },
  });
  assert.equal(store.records.get(base.id).discovery.verified.seen.head, s0);
  store.chains.get(base.id).set('seen', [s0, twin, s2]);
  const walk = walkOnce(t, store, base.id);
  assertWalkRefused(walk, 'R2', 'the second segment read');
  assert.deepEqual([walk.stat, walk.read], [[s0], [twin, s2]]);
  assert.equal(planted.discovery.logs.seen.head, s2);
});

test("lease walk: a head whose count or digest the chain does not end at is R2 after the read (the corrupt fixture's control)", (t) => {
  const fx = loadFixture('bad/segment_corrupt_at_reconciliation.json');
  const [control] = fx.controls;
  const counted = {
    ...fx,
    record: { ...fx.record, discovery: control.discovery },
    store: control.store,
  };
  const digested = clone(counted);
  digested.record.discovery = clone(fx.record.discovery);
  digested.record.discovery.logs.alt_cells.digest = fx.record.discovery.logs.seen.digest;
  for (const [name, kase] of [
    ['count', counted],
    ['digest', digested],
  ]) {
    // By the seam: a full read would release the job (R2, chain_broken).
    const { store } = leaseFixture(t, kase, { seam: true });
    const walk = walkOnce(t, store, fx.record.id);
    assertWalkRefused(walk, 'R2', name);
    assert.deepEqual(walk.read, [fx.addresses.alt_cells[1]], `${name}: read, then refused`);
  }
});

test('lease walk: the verified save is a reserved save: at full quota, a growth inside the record’s reservation lands', (t) => {
  // good/lease_payload_summary_paths.json's record verifies nothing yet, so
  // its walk's save grows the record (each null head becomes 64 hex), inside
  // its 16 KiB reservation.
  const fx = loadFixture('good/lease_payload_summary_paths.json');
  const { store } = leaseFixture(t, { ...fx, addresses: undefined });
  assert.notEqual(store.usage, null, 'usage known');
  store.maxBytes = store.usage + store.slack; // exactly full
  const walk = walkOnce(t, store, fx.record.id);
  assert.equal(walk.error, null);
  assert.equal(walk.saved, true, 'the reserved save lands at full quota');
  assert.deepEqual(walk.record.discovery.verified, fx.record.discovery.logs);
  assert.deepEqual(walk.payload.discovery, atStore(store, fx.payload.discovery));
});

test('lease walk: a finished record’s discovery is never read: a completed one is not walked', (t) => {
  // Only a writer other than the store leaves a live discovery on a finished
  // record (complete() saves null); §7.1 never reads one, and neither does the
  // walk: its payload's discovery is null and nothing is statted or read.
  const fx = loadFixture('good/lease_incremental_walk.json');
  for (const state of ['completed', 'completed_with_refusals']) {
    const { directory, store: first } = fixture(t);
    const base = first.records.get(create(first).record.id);
    plantFixture(directory, base, fx, { job: { state } });
    const store = walkStore(t, directory, { lists: () => new Map() });
    const walk = walkOnce(t, store, fx.record.id);
    assert.equal(walk.error, null, `${state}: ${walk.error?.message}`);
    assert.equal(walk.payload.discovery, null, `${state}: not built`);
    assert.deepEqual([walk.stat, walk.read, walk.saved], [[], [], false], state);
  }
});

// ── persisted discovery, Step 11 (#656 Node-side plan): resume()'s full read
// (§5.1). A lease's walk that fails is STORAGE_CORRUPT and the scheduler
// pauses the job with that reason; resume() then decides by a full read of
// every log, which uses neither `verified` nor the address list. A pass
// queues the job with `verified` at the heads in resume's own save and the
// lists rebuilt; a failure releases the job (U1), from the record and not
// the control, and refuses DISCOVERY_UNAVAILABLE with the cause and the log.
const STORAGE_PAUSE = {
  code: 'STORAGE_CORRUPT',
  message: 'Reader discovery state failed its lease walk.',
};
// A walk fixture leased on a second instance (leaseFixture), with `mutate`
// applied to the store after its reconciliation and no foreign write, its
// walk refused, and the job paused STORAGE_CORRUPT as the scheduler's catch
// pauses it; then `state` 'cancelled' cancels the paused job.
function pausedFixture(t, fx, { gzip = false, seam = false, store: spec, mutate, state } = {}) {
  const leased = leaseFixture(t, fx, { gzip, seam, store: spec });
  if (mutate) mutate(leased.directory);
  const walk = walkOnce(t, leased.store, fx.record.id);
  assert.equal(walk.error?.code, 'STORAGE_CORRUPT', `the walk refuses: ${walk.error?.message}`);
  const { lease, store } = leased;
  store.pause(lease.id, lease.attempt, lease.fence, STORAGE_PAUSE);
  const capability = store.capabilityFor(fx.record.id, leased.base.viewer);
  if (state === 'cancelled') store.cancel(fx.record.id, capability, leased.base.viewer);
  const paused = clone(store.records.get(fx.record.id));
  assert.equal(paused.state, state ?? 'paused');
  return { ...leased, capability, paused, viewer: leased.base.viewer };
}
// The fixtures name an identity_hash and not the identity it hashes, so a
// resume of a fixture job passes this marker identity, and for that call
// alone the store's sha256 of the marker's canonical JSON reads as the hash
// it names. No other digest changes, and the store holds no seam for it.
const fixtureIdentity = (hash) => ({ fixture_identity_hash: hash });
const FIXTURE_IDENTITY = /^\{"fixture_identity_hash":"([0-9a-f]{64})"\}$/;
function mapFixtureIdentity(t) {
  const real = crypto.createHash;
  return t.mock.method(crypto, 'createHash', function (...args) {
    const hash = real.apply(this, args);
    const update = hash.update.bind(hash);
    const digest = hash.digest.bind(hash);
    let data = '';
    hash.update = (value, ...rest) => {
      data = typeof value === 'string' && data !== null ? data + value : null;
      update(value, ...rest);
      return hash;
    };
    hash.digest = (encoding) => {
      const marker = data !== null && encoding === 'hex' && FIXTURE_IDENTITY.exec(data);
      return marker ? marker[1] : digest(encoding);
    };
    return hash;
  });
}
// One resume: what its full read reads (_segment with an expect) and the
// rules _fullRead returns, the record saves it makes, and the record or the
// refusal. `who` null is the fixture job's own identity.
function resumeOnce(t, store, id, capability, viewer, options = {}, who = null) {
  const file = path.join(store.directory, 'records', `${id}.json`);
  const before = fs.readFileSync(file);
  const reads = [];
  const rules = [];
  const saves = [];
  const segment = ReaderJobStore.prototype._segment;
  const fullRead = ReaderJobStore.prototype._fullRead;
  const save = ReaderJobStore.prototype._save;
  const spies = [
    ...(who === null ? [mapFixtureIdentity(t)] : []),
    t.mock.method(ReaderJobStore.prototype, '_segment', function (hash, expect, ...rest) {
      if (expect !== null) reads.push(hash);
      return segment.call(this, hash, expect, ...rest);
    }),
    t.mock.method(ReaderJobStore.prototype, '_fullRead', function (...args) {
      const read = fullRead.apply(this, args);
      rules.push(read.rule ?? 'pass');
      return read;
    }),
    t.mock.method(ReaderJobStore.prototype, '_save', function (record, ...rest) {
      if (record.id === id) saves.push(clone(record));
      return save.call(this, record, ...rest);
    }),
  ];
  let record = null;
  let error = null;
  try {
    const as = who ?? fixtureIdentity(store.records.get(id).identity_hash);
    record = store.resume(id, capability, viewer, as, options);
  } catch (thrown) {
    error = thrown;
  } finally {
    for (const s of spies) s.mock.restore();
  }
  return {
    record,
    error,
    read: reads,
    rules,
    saves,
    saved: !fs.readFileSync(file).equals(before),
    disk: JSON.parse(fs.readFileSync(file, 'utf8')),
  };
}
// The refusal a failed full read, or a saved release, gives (§8).
function assertResumeRefused(got, want, name) {
  assert.deepEqual(
    {
      code: got.error?.code,
      status: got.error?.status,
      cause: got.error?.cause,
      log: got.error?.log,
    },
    want,
    `${name}: ${got.error?.message}`
  );
}
// The verified fixtures' resume halves: plain and gzip, the lists built by
// the real path (reconciliation) and by design §B2's seam.
const RESUME_PASSES = [
  'bad/verified_ahead_of_head.json',
  'bad/verified_bytes_ahead.json',
  'bad/verified_bytes_disagree.json',
];

test("resume: the bad verified fixtures' expect.resume: the full read passes, and resume's own save carries verified at the heads", (t) => {
  for (const rel of RESUME_PASSES)
    for (const gzip of [false, true])
      for (const seam of [false, true])
        for (const state of ['paused', 'cancelled']) {
          const fx = loadFixture(rel);
          const want = fx.expect.resume;
          const name = `${rel} gzip=${gzip} seam=${seam} ${state}`;
          const job = pausedFixture(t, fx, { gzip, seam, state });
          const got = resumeOnce(t, job.store, fx.record.id, job.capability, job.viewer, {
            idempotency_key: 'resume-step-11',
          });
          assert.equal(got.error, null, `${name}: ${got.error?.message}`);
          assert.deepEqual(got.read, want.read, `${name}: read from each head back`);
          assert.deepEqual(got.rules, ['pass', 'pass', 'pass'], `${name}: every log read`);
          assert.deepEqual(listsOf(job.store, fx.record.id), want.addresses, `${name}: lists`);
          // One save, resume's own, carries the queued state and verified.
          assert.equal(got.saves.length, 1, `${name}: one save`);
          assert.deepEqual(got.saves[0].discovery.verified, want.verified, `${name}: verified`);
          assert.deepEqual(want.verified, fx.record.discovery.logs, `${name}: at the heads`);
          for (const r of [got.record, got.disk, job.store.records.get(fx.record.id)]) {
            assert.equal(r.state, 'queued', name);
            assert.equal(r.reason, null, name);
            assert.deepEqual(
              r.discovery,
              { ...fx.record.discovery, verified: want.verified },
              `${name}: only verified moves`
            );
          }
          assert.equal(got.disk.control_receipts.length, job.paused.control_receipts.length + 1);
          // The next lease's walk stats every segment and reads none.
          const lease = job.store.lease(fx.record.id);
          assert.equal(lease?.id, fx.record.id, `${name}: leased again`);
          const walk = walkOnce(t, job.store, fx.record.id);
          assert.equal(walk.error, null, `${name}: ${walk.error?.message}`);
          assert.deepEqual(walk.read, [], `${name}: nothing appended since, nothing read`);
          assert.deepEqual(walk.stat.sort(), [...want.read].sort(), `${name}: all stat'ed`);
          assert.equal(walk.saved, false, `${name}: nothing to advance`);
        }
});

test('resume: after a pass, the next lease walks only what was appended since', (t) => {
  // good/seal_sequence_two_logs.json's frames 0 and 1 seal on a live job; the
  // job is paused, resumed (verified at frame 1's heads), and frame 2 seals:
  // the next walk reads frame 2's seals alone.
  const fx = loadFixture('good/seal_sequence_two_logs.json');
  const job = writeJob(t, fx);
  commitFrame(job.store, job.lease, fx.frames[0]);
  commitFrame(job.store, job.lease, fx.frames[1]);
  job.store.pause(job.lease.id, job.lease.attempt, job.lease.fence, STORAGE_PAUSE);
  const record = job.store.records.get(job.id);
  const capability = job.store.capabilityFor(job.id, record.viewer);
  const got = resumeOnce(t, job.store, job.id, capability, record.viewer);
  assert.equal(got.error, null, got.error?.message);
  const sealed = got.read;
  assert.ok(sealed.length > 0, 'something was sealed');
  assert.deepEqual(
    [...sealed].sort(),
    [...job.store.chains.get(job.id).values()].flat().sort(),
    'the full read reads every listed segment, and the lists are what it read'
  );
  assert.deepEqual(got.disk.discovery.verified, got.disk.discovery.logs);
  const lease = job.store.lease(job.id);
  commitFrame(job.store, lease, fx.frames[2]);
  const walk = walkOnce(t, job.store, job.id);
  assert.equal(walk.error, null, walk.error?.message);
  const lists = [...job.store.chains.get(job.id).values()].flat();
  assert.deepEqual(
    walk.read.sort(),
    lists.filter((a) => !sealed.includes(a)).sort(),
    'only the segments frame 2 sealed are read'
  );
  assert.ok(walk.read.length > 0, 'frame 2 sealed something');
  assert.equal(walk.saved, true, 'and the walk advances verified past them');
  assert.deepEqual(walk.stat.sort(), [...sealed].sort(), 'the resumed verified ones are stat');
});

// The resume halves of the fixtures whose full read fails: by the real path
// with the fault made after reconciliation (missing, corrupt), or by the
// seam (head_bytes_disagree, whose reconciliation would release the job).
const RESUME_FAILS = [
  {
    rel: 'bad/missing_segment.json',
    rule: 'missing',
    want: (fx) => ({
      code: fx.expect.code,
      status: fx.expect.status,
      cause: fx.expect.cause,
      log: 'alt_cells',
    }),
    store: (fx) => ({ ...fx.store, omit: [] }),
    mutate: (fx) => (directory) => {
      for (const address of fx.store.omit)
        fs.unlinkSync(path.join(pagesDir(directory), `${address}.json`));
    },
  },
  {
    rel: 'bad/segment_corrupt_at_reconciliation.json',
    rule: 'F6',
    want: (fx) => fx.expect.resume,
    store: (fx) => ({ ...fx.store, corrupt: [] }),
    mutate: (fx, gzip) => (directory) => {
      const [{ address }] = fx.store.corrupt;
      writeStored(directory, address, fixtureStore(fx.store).get(address), gzip);
    },
  },
  {
    rel: 'bad/head_bytes_disagree.json',
    rule: 'R2',
    seam: true,
    want: (fx) => fx.expect.resume,
  },
];

test('resume: a full read that fails releases the job from its record and refuses DISCOVERY_UNAVAILABLE with the cause and the log', (t) => {
  for (const kase of RESUME_FAILS)
    for (const gzip of [false, true])
      for (const state of ['paused', 'cancelled']) {
        const fx = loadFixture(kase.rel);
        const want = kase.want(fx);
        const name = `${kase.rel} gzip=${gzip} ${state}`;
        const job = pausedFixture(t, fx, {
          gzip,
          seam: kase.seam,
          store: kase.store?.(fx),
          mutate: kase.mutate?.(fx, gzip),
          state,
        });
        const seen = releaseLog(t);
        const got = resumeOnce(t, job.store, fx.record.id, job.capability, job.viewer, {
          idempotency_key: 'resume-step-11',
        });
        t.mock.restoreAll();
        assertResumeRefused(got, want, name);
        // seen, then alt_cells: the first log passes, the second is the fault.
        assert.deepEqual(got.rules, ['pass', kase.rule], `${name}: the full read's rules`);
        // One save, the release, from the record: no receipt, the state kept.
        assert.equal(got.saves.length, 1, `${name}: the release alone`);
        const release = expectedRelease(job.paused, want.cause, want.log);
        if (fx.expect.reconciliation)
          assert.deepEqual(
            release.discovery,
            fx.expect.reconciliation.discovery,
            `${name}: §7.4's release`
          );
        assert.deepEqual(releaseView(got.disk), release, `${name}: the release record`);
        assert.deepEqual(got.disk.control_receipts, job.paused.control_receipts, name);
        for (const key of ['attempt', 'queued_at', 'queue_order', 'generation'])
          assert.equal(got.disk[key], job.paused[key], `${name}: keeps ${key}`);
        assert.equal(listsOf(job.store, fx.record.id), undefined, `${name}: lists dropped`);
        const level = want.cause === 'segment_corrupt' ? 'error' : 'warn';
        assert.deepEqual(
          seen[level],
          [{ event: 'READER_DISCOVERY_RELEASED', job: fx.record.id, ...pick(want) }],
          `${name}: one ${level} line`
        );
        assert.deepEqual(seen[level === 'error' ? 'warn' : 'error'], [], name);
        assert.equal(job.store.failure, null, `${name}: the store does not fail`);
        // The same key again, and a new one, refuse from unavailable at once.
        for (const options of [{ idempotency_key: 'resume-step-11' }, {}]) {
          const again = resumeOnce(t, job.store, fx.record.id, job.capability, job.viewer, options);
          assertResumeRefused(again, want, `${name}: again`);
          assert.deepEqual([again.rules, again.read, again.saved], [[], [], false], name);
        }
        // The store serves on: the other job leases and commits.
        const other = job.store.lease();
        assert.equal(other?.id, job.base.id, `${name}: the other job leases`);
        assert.equal(commit(job.store, other, undefined, { phase: 'more' }).state, 'running');
      }
});
const pick = ({ cause, log }) => ({ cause, log });

test('resume: a release reconciliation saved refuses at once, with its cause and log, before the identity and state checks', (t) => {
  for (const [rel, cause, log] of RELEASING)
    for (const gzip of [false, true]) {
      const fx = loadFixture(rel);
      const name = `${rel} gzip=${gzip}`;
      const { directory, store: first } = fixture(t, { gzip });
      const base = first.records.get(create(first).record.id);
      plantFixture(directory, base, fx, { gzip });
      const store = new ReaderJobStore({ directory, gzip });
      const record = store.records.get(fx.record.id);
      assert.equal(record.discovery.unavailable.cause, cause);
      const capability = store.capabilityFor(fx.record.id, base.viewer);
      const want = { code: 'DISCOVERY_UNAVAILABLE', status: 409, cause, log };
      if (fx.expect.resume) assert.deepEqual(fx.expect.resume, want, name);
      for (const who of [identity, { ...identity, engine: 'changed' }]) {
        const got = resumeOnce(t, store, fx.record.id, capability, base.viewer, {}, who);
        assertResumeRefused(got, want, name);
        assert.deepEqual([got.rules, got.read, got.saved], [[], [], false], name);
      }
    }
  // A running record holding unavailable (released after its lease began)
  // refuses DISCOVERY_UNAVAILABLE, not INVALID_JOB_STATE.
  const fx = loadFixture('bad/head_bytes_disagree.json');
  const { directory, store: first } = fixture(t);
  const base = first.records.get(create(first).record.id);
  const planted = plantFixture(directory, base, fx, { job: { state: 'running' } });
  const store = new ReaderJobStore({ directory });
  assert.equal(store.records.get(planted.id).discovery.unavailable.cause, 'chain_broken');
  const got = resumeOnce(
    t,
    store,
    planted.id,
    store.capabilityFor(planted.id, base.viewer),
    base.viewer
  );
  assertResumeRefused(got, fx.expect.resume, 'running');
});

test('resume: a record with no discovery resumes exactly as before: nothing read, no discovery key', (t) => {
  for (const discovery of [undefined, null]) {
    const name = `discovery=${discovery}`;
    const { directory, store } = fixture(t);
    const job = create(store);
    const lease = store.lease();
    store.pause(lease.id, lease.attempt, lease.fence, STORAGE_PAUSE);
    if (discovery === null) {
      plantRecord(directory, { ...store.records.get(job.record.id), discovery: null });
      store.inspect(job.record.id);
    }
    const before = clone(store.records.get(job.record.id));
    const got = resumeOnce(t, store, job.record.id, job.capability, 'viewer-a', {}, identity);
    assert.equal(got.error, null, name);
    assert.deepEqual([got.rules, got.read, got.saves.length], [[], [], 1], name);
    assert.equal(Object.hasOwn(got.disk, 'discovery'), discovery === null, name);
    if (discovery === null) assert.equal(got.disk.discovery, null, name);
    assert.equal(store.chains.has(job.record.id), false, `${name}: no list`);
    const { updated_at: _u, record_digest: _d, ...kept } = got.saves[0];
    assert.deepEqual(
      Object.keys(kept).sort(),
      Object.keys(before)
        .filter((k) => !['updated_at', 'record_digest'].includes(k))
        .sort(),
      `${name}: no key gained`
    );
  }
});

test('resume: a status-less host error at the full read (EACCES, EIO, ENOTDIR) stops the store and releases nothing', (t) => {
  const fx = loadFixture('bad/verified_ahead_of_head.json');
  const [stat, read] = ['statSync', 'readFileSync'];
  for (const code of ['EACCES', 'EIO', 'ENOTDIR'])
    for (const fn of [stat, read]) {
      const name = `${code} at ${fn}`;
      const job = pausedFixture(t, fx);
      const file = path.join(job.store.directory, 'records', `${fx.record.id}.json`);
      const before = fs.readFileSync(file);
      const pages = path.join(job.store.directory, 'pages') + path.sep;
      const real = fs[fn];
      t.mock.method(fs, fn, function (target, ...rest) {
        if (String(target).startsWith(pages))
          throw Object.assign(new Error(`${code}: planted`), { code });
        return real.call(this, target, ...rest);
      });
      const seen = releaseLog(t);
      const got = resumeOnce(t, job.store, fx.record.id, job.capability, job.viewer);
      const { error } = got;
      t.mock.restoreAll();
      assert.deepEqual([error?.code, error?.status], ['STORAGE_UNAVAILABLE', 503], name);
      assert.ok(job.store.failure, `${name}: the store stops`);
      assert.ok(fs.readFileSync(file).equals(before), `${name}: nothing saved`);
      assert.deepEqual([seen.error, seen.warn], [[], []], `${name}: nothing released`);
      // A restart reconciles the unchanged chain and the resume passes.
      const restarted = new ReaderJobStore({ directory: job.directory });
      assert.equal(restarted.failure, null, name);
      const again = resumeOnce(t, restarted, fx.record.id, job.capability, job.viewer);
      assert.equal(again.error, null, `${name}: ${again.error?.message}`);
      assert.deepEqual(again.disk.discovery.verified, fx.expect.resume.verified, name);
    }
});

test('resume: a dead chain is refused before the queue checks, and a QUEUE_FULL after a pass saves nothing', (t) => {
  const full = () => {
    throw Object.assign(new Error('The durable reader queue is full.'), {
      code: 'QUEUE_FULL',
      status: 429,
    });
  };
  // A dead chain: the full read releases it though the queue is full.
  const dead = loadFixture('bad/head_bytes_disagree.json');
  const job = pausedFixture(t, dead, { seam: true });
  t.mock.method(job.store, '_queueRoom', full);
  const got = resumeOnce(t, job.store, dead.record.id, job.capability, job.viewer);
  assertResumeRefused(got, dead.expect.resume, 'dead chain, queue full');
  t.mock.restoreAll();
  // A chain that reads: QUEUE_FULL, nothing saved; the lists are the full
  // read's, which hold for the unchanged heads.
  const fx = loadFixture('bad/verified_ahead_of_head.json');
  const live = pausedFixture(t, fx, { seam: true });
  t.mock.method(live.store, '_queueRoom', full);
  const refusedFull = resumeOnce(t, live.store, fx.record.id, live.capability, live.viewer);
  t.mock.restoreAll();
  assert.equal(refusedFull.error?.code, 'QUEUE_FULL');
  assert.deepEqual([refusedFull.saves, refusedFull.saved], [[], false]);
  assert.deepEqual(refusedFull.read, fx.expect.resume.read);
  assert.deepEqual(listsOf(live.store, fx.record.id), fx.expect.resume.addresses);
  assert.deepEqual(live.store.records.get(fx.record.id), live.paused, 'unchanged');
  // Room again: the resume passes.
  const passed = resumeOnce(t, live.store, fx.record.id, live.capability, live.viewer);
  assert.equal(passed.error, null, passed.error?.message);
  assert.deepEqual(passed.disk.discovery.verified, fx.expect.resume.verified);
});
