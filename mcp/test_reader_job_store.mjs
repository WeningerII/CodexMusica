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

// A store at exactly its quota, holding a running job past its reservation.
// A commit always leaves a reservation's headroom, so the quota here is the
// one the store restarts under: what it holds, as after the quota is lowered
// or a gzip store is inflated (mcp/READER_RUNTIME.md).
const STARTUP_REASON = {
  code: 'INTERRUPTED',
  message: 'Worker interrupted; explicitly resume the committed cursor.',
};
function atQuota(t, { cancel = false } = {}) {
  const { directory, store } = fixture(t, { maxBytes: SMALL_QUOTA });
  const job = create(store),
    lease = store.lease(job.record.id);
  assert.equal(commit(store, lease, [{ id: 'kept' }], bigCursor(1)).state, 'running');
  if (cancel) store.cancel(lease.id, job.capability, 'viewer-a', { idempotency_key: 'cancel' });
  const record = path.join(directory, 'reader-jobs-v1', 'records', `${lease.id}.json`);
  assert.ok(fs.statSync(record).size > RESERVE, 'the record is past its reservation');
  return { directory, store, job, lease, record, quota: store.usage + store.slack };
}
for (const cancel of [false, true])
  test(`a restart at exactly its quota still ${cancel ? 'cancels' : 'pauses'} its running job`, (t) => {
    // A store that cannot record its own interruption cannot start, and then
    // every request fails. The pause grows the record by a few bytes, past a
    // full quota; a requested cancellation's longer reason is replaced, so
    // that record shrinks.
    const { directory, job, lease, quota, record } = atQuota(t, { cancel });
    const running = fs.statSync(record).size;
    const restarted = restartsTwice(directory, quota);
    const paused = restarted.inspect(lease.id);
    assert.equal(paused.state, cancel ? 'cancelled' : 'paused');
    assert.deepEqual(paused.reason, STARTUP_REASON);
    assert.equal(paused.cancel_requested, false);
    // Counted exactly: the pause is the only overage, and only by its bytes.
    const grown = fs.statSync(record).size - running;
    if (!cancel) assert.ok(grown > 0, 'the pause grows the record');
    assert.equal(restarted.usage, scan(restarted));
    assert.equal(restarted.usage + restarted.slack, quota + grown);
    // Reads work.
    assert.equal(restarted.get(lease.id, job.capability, 'viewer-a').state, paused.state);
    assert.deepEqual(restarted.workerPayload(lease.id).cursor, bigCursor(1));
    const [ref] = restarted.readManifestPage(lease.id, job.capability, 'viewer-a').page_refs;
    assert.equal(
      restarted.readPage(lease.id, ref.sha256, job.capability, 'viewer-a').instances[0].id,
      'kept'
    );
    // Growth is refused as usual, and admitted again once a delete frees room:
    // a new job (the per-record reservation check), and the paused record
    // growing past its reservation by a control receipt (the slack check).
    refused(() => create(restarted, 'viewer-b', 'after-restart'), 'RESOURCE_LIMIT');
    assert.equal(restarted.usage, scan(restarted));
    const pausedBytes = fs.readFileSync(record);
    refused(
      () => restarted.cancel(lease.id, job.capability, 'viewer-a', { idempotency_key: 'late' }),
      'RESOURCE_LIMIT'
    );
    assert.deepEqual(fs.readFileSync(record), pausedBytes);
    assert.equal(restarted.inspect(lease.id).state, paused.state);
    assert.equal(restarted.usage, scan(restarted));
    assert.equal(restarted.usage + restarted.slack, quota + grown);
    restarted.delete(lease.id, job.capability, 'viewer-a');
    assert.equal(create(restarted, 'viewer-b', 'after-delete').created, true);
    assert.equal(restarted.usage, scan(restarted));
    assert.ok(restarted.usage + restarted.slack <= quota);
  });
test('outside startup, the same pause at its quota is still refused', (t) => {
  const { store, lease, quota, record } = atQuota(t);
  store.maxBytes = quota; // the live store's quota, lowered to what it holds
  const before = fs.readFileSync(record);
  refused(
    () => store.pause(lease.id, lease.attempt, lease.fence, STARTUP_REASON),
    'RESOURCE_LIMIT'
  );
  assert.equal(store.inspect(lease.id).state, 'running');
  assert.deepEqual(fs.readFileSync(record), before);
  assert.equal(store.usage, scan(store));
  assert.equal(store.usage + store.slack, quota);
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
