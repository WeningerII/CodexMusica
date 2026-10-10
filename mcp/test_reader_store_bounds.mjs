// Bounded reader-store maintenance and quiescent usage accounting
// (docs/library-native-design.md, "Analysis and identity": store bounds).
//
// The public Library tab polls analysis jobs far more often than the old
// Site's single Worker relay did, so the store no longer scans every record
// and evidence object on each read. These tests pin the contract that replaced
// the scans:
//   - usage is an exact counter, maintained by deltas under the writer lock;
//   - a verification scan is accepted only if nothing mutated across it;
//   - while usage is unknown, allocating or growing writes fail closed
//     (503 STORE_RECOUNTING) and cleanup still proceeds;
//   - every mutation is bracketed by a pending marker and a generation bump,
//     so another instance, or a crash, is detected;
//   - retention slides in memory on every read and durably at most hourly;
//   - expiry binds at read time; collection runs off the request path in
//     bounded slices and never sweeps an object written or re-referenced
//     after its mark began;
//   - object readers accept plain and gzip bytes (phase A), bounded and
//     verified against the uncompressed hash.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ReaderJobStore, READER_LIMITS, decodeStoredObject } from './reader_job_store.js';

const identity = { snapshot: 's', revision: 'r', engine: 'e', declarations: 'none' };
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
const sha = (b) => createHash('sha256').update(b).digest('hex');
const refused = (fn, code) => assert.throws(fn, (error) => error.code === code);

function dir(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-bounds-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}
function scan(store) {
  // The ground truth the counter must equal: every byte the quota covers.
  let total = fs.statSync(path.join(store.directory, 'capability-key')).size;
  for (const sub of ['records', 'pages', 'indexes', 'checkpoints', 'manifests'])
    for (const name of fs.readdirSync(path.join(store.directory, sub)))
      total += fs.statSync(path.join(store.directory, sub, name)).size;
  return total;
}
function create(store, viewer = 'viewer-a', key = 'k-a') {
  return store.create({ viewer, idempotency_key: key, identity, request: { layers: ['sound'] } });
}
function commit(store, lease, tag = 'x') {
  return store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: { phase: 'done', done: true },
    pages: [{ instances: [{ id: `evidence-${tag}`, verdict: true }] }],
    progress: { candidates: 1 },
    coverage,
  });
}
function finish(store, lease) {
  return store.complete(lease.id, lease.attempt, lease.fence, {
    exhausted: true,
    census_reconciled: true,
    coverage,
    summary: {
      coverage,
      counters: { evidence_records: 1 },
      methods: [{ method_id: 'sound', coverage: 'answered' }],
    },
    provider_calls: 0,
  });
}
function run(store, viewer, key, tag) {
  const job = create(store, viewer, key);
  const lease = store.lease(job.record.id);
  commit(store, lease, tag);
  finish(store, lease);
  return job;
}

test('the delta counter equals a full scan after a randomized mix of operations', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  assert.equal(store.usage, scan(store));
  // A fixed pseudo-random sequence (deterministic, so a failure reproduces).
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31);
  const jobs = [];
  for (let i = 0; i < 40; i++) {
    const op = next() % 5;
    if (op <= 1 && jobs.length < 14) jobs.push(run(store, `v${i % 7}`, `k${i}`, `t${i}`));
    else if (op === 2 && jobs.length) {
      const j = jobs.splice(next() % jobs.length, 1)[0];
      // A job past retention is refused, as main refuses an expired one.
      try {
        store.delete(j.record.id, j.capability, j.record.viewer);
      } catch (error) {
        if (error.code !== 'RESULT_EXPIRED') throw error;
      }
    } else if (op === 3) {
      now += READER_LIMITS.retentionMs / 3;
      store.prune();
    } else store.maintain();
    assert.equal(store.usage, scan(store), `counter drifted at step ${i} (op ${op})`);
  }
});

test('shrink-before-scan: a scan that overlaps a mutation is discarded, and the next one is exact', async (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  // Force the slow path, then mutate (a record rewrite that shrinks it: the
  // tombstone) while the recount is between slices.
  const pass = store.recount({ attempts: 1, slice: 1 });
  store.delete(job.record.id, job.capability, 'viewer-a');
  assert.equal(await pass, false, 'a scan overlapping a mutation must not be accepted');
  assert.equal(await store.recount(), true);
  assert.equal(store.usage, scan(store));
});

test('grow, delete and create interleavings during a scan never publish a mixed total', async (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const a = run(store, 'viewer-a', 'k-a', 'a');
  for (const mutate of [
    () => run(store, 'viewer-b', 'k-b', 'b'),
    () => store.delete(a.record.id, a.capability, 'viewer-a'),
    () => store.prune(),
  ]) {
    const pass = store.recount({ attempts: 1, slice: 1 });
    mutate();
    const accepted = await pass;
    if (accepted) assert.equal(store.usage, scan(store));
    assert.equal(await store.recount(), true);
    assert.equal(store.usage, scan(store));
  }
});

test('cross-writer growth: writer B refuses growth after A commits, until B recounts', async (t) => {
  const d = dir(t);
  let now = 1000;
  const a = new ReaderJobStore({ directory: d, now: () => now });
  const b = new ReaderJobStore({ directory: d, now: () => now });
  run(a, 'viewer-a', 'k-a', 'a');
  // B's next locked operation sees A's generation: its counter is in doubt.
  refused(() => create(b, 'viewer-b', 'k-b'), 'STORE_RECOUNTING');
  assert.equal(b.usage, null);
  assert.equal(await b.recount(), true);
  assert.equal(b.usage, scan(b));
  run(b, 'viewer-b', 'k-b', 'b');
  assert.equal(b.usage, scan(b));
});

test('a crash after a page object is written but before its record commits', async (t) => {
  const d = dir(t);
  let now = 1000;
  const a = new ReaderJobStore({ directory: d, now: () => now });
  run(a, 'viewer-a', 'k-a', 'a');
  // Simulate another writer that died mid-commit: its intent marker and an
  // orphan page are on disk, its record never was.
  const orphan = Buffer.from(JSON.stringify({ instances: [{ id: 'orphan' }] }));
  fs.writeFileSync(path.join(a.directory, 'pages', `${sha(orphan)}.json`), orphan);
  fs.writeFileSync(path.join(a.directory, 'pending'), JSON.stringify({ generation: 99 }));
  // The running instance finds the pending marker on taking the lock.
  refused(() => create(a, 'viewer-b', 'k-b'), 'STORE_RECOUNTING');
  assert.equal(a.usage, null);
  assert.equal(
    fs.existsSync(path.join(a.directory, 'pending')),
    false,
    'the stale intent is cleared'
  );
  assert.equal(await a.recount(), true);
  a.prune(); // collection reclaims the orphan
  assert.equal(fs.existsSync(path.join(a.directory, 'pages', `${sha(orphan)}.json`)), false);
  assert.equal(a.usage, scan(a));
  run(a, 'viewer-b', 'k-b', 'b');
  assert.equal(a.usage, scan(a));
  // A fresh instance opening the same directory starts exact.
  const fresh = new ReaderJobStore({ directory: d, now: () => now });
  assert.equal(fresh.usage, scan(fresh));
});

test('unknown usage: a create fails closed, a delete still succeeds', async (t) => {
  const d = dir(t);
  let now = 1000;
  const a = new ReaderJobStore({ directory: d, now: () => now });
  const job = run(a, 'viewer-a', 'k-a', 'a');
  fs.writeFileSync(path.join(a.directory, 'pending'), JSON.stringify({ generation: 5 }));
  refused(() => create(a, 'viewer-b', 'k-b'), 'STORE_RECOUNTING');
  const deleted = a.delete(job.record.id, job.capability, 'viewer-a');
  assert.equal(deleted.state, 'deleted');
  assert.equal(await a.recount(), true);
  assert.equal(a.usage, scan(a));
});

test('retention slides in memory per read and persists at most once an hour', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  const file = path.join(store.directory, 'records', `${job.record.id}.json`);
  const before = fs.readFileSync(file);
  now += 30 * 60 * 1000; // 30 minutes: in memory only
  const read = store.get(job.record.id, job.capability, 'viewer-a');
  assert.equal(read.expires_at, now + READER_LIMITS.retentionMs);
  assert.deepEqual(fs.readFileSync(file), before, 'a read within the hour writes nothing');
  now += 31 * 60 * 1000; // past the hour since the durable touch
  store.get(job.record.id, job.capability, 'viewer-a');
  const after = JSON.parse(fs.readFileSync(file));
  assert.equal(after.expires_at, now + READER_LIMITS.retentionMs, 'the slide is persisted');
});

test('expiry binds at read time, before any sweep has run', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  now += READER_LIMITS.retentionMs + 1;
  refused(() => store.get(job.record.id, job.capability, 'viewer-a'), 'RESULT_EXPIRED');
  refused(() => store.readManifest(job.record.id, job.capability, 'viewer-a'), 'RESULT_EXPIRED');
  assert.notEqual(store.inspect(job.record.id).state, 'expired', 'no sweep ran');
  store.maintain();
  assert.equal(store.inspect(job.record.id).state, 'expired');
});

test('a maintenance slice is bounded, and the sweep spares objects re-referenced after its mark', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const jobs = [];
  for (let i = 0; i < 6; i++) jobs.push(run(store, `v${i}`, `k${i}`, `t${i}`));
  for (const j of jobs) store.delete(j.record.id, j.capability, j.record.viewer);
  const pagesBefore = fs.readdirSync(path.join(store.directory, 'pages')).length;
  // Age the garbage so the sweep may take it.
  const old = new Date(Date.now() - 60_000);
  for (const sub of ['pages', 'indexes', 'checkpoints', 'manifests'])
    for (const f of fs.readdirSync(path.join(store.directory, sub)))
      fs.utimesSync(path.join(store.directory, sub, f), old, old);
  const bounds = { records: 2, objects: 3, bytes: 1 << 30, ms: 10_000 };
  let slices = 0;
  let result;
  do {
    result = store.maintain(bounds);
    assert.ok(result.swept <= bounds.objects, 'a slice sweeps at most its object bound');
    assert.ok(result.marked <= bounds.records, 'a slice marks at most its record bound');
    slices++;
  } while (result.phase !== 'idle' && slices < 50);
  assert.ok(slices > 1, 'the work was spread across slices');
  assert.ok(fs.readdirSync(path.join(store.directory, 'pages')).length < pagesBefore);
  assert.equal(store.usage, scan(store));

  // Re-reference: a page identical to an aged garbage page, written during a
  // mark, is not swept by that collection.
  const revived = run(store, 'viewer-z', 'k-z', 'z');
  const page = store.workerPayload(revived.record.id).page_paths[0];
  fs.utimesSync(page, old, old);
  store.delete(revived.record.id, revived.capability, 'viewer-z');
  store.maintain({ records: 1000, objects: 0, bytes: 1 << 30, ms: 10_000 }); // mark only
  run(store, 'viewer-y', 'k-y', 'z'); // same evidence: re-references the page, refreshing its mtime
  while (store.maintain(bounds).phase !== 'idle');
  assert.equal(fs.existsSync(page), true, 'a page re-referenced after the mark began survives');
  assert.equal(store.usage, scan(store));
});

test('phase A readers: plain and gzip objects both read; bombs and hash mismatches refuse', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  const manifest = store.readManifest(job.record.id, job.capability, 'viewer-a');
  const pageRef = store.readManifestPage(job.record.id, job.capability, 'viewer-a').page_refs[0];
  const file = path.join(store.directory, 'pages', `${pageRef.sha256}.json`);
  const plain = fs.readFileSync(file);
  // The same object stored gzip-compressed reads identically (mixed store).
  fs.writeFileSync(file, zlib.gzipSync(plain));
  assert.deepEqual(
    store.readPage(job.record.id, pageRef.sha256, job.capability, 'viewer-a'),
    JSON.parse(plain)
  );
  assert.ok(manifest.page_count >= 1);
  // A gzip object whose inflation exceeds the object bound is refused.
  const bomb = zlib.gzipSync(Buffer.alloc(READER_LIMITS.objectBytes + 1, 0x20));
  assert.throws(
    () => decodeStoredObject(bomb),
    (e) => e.code === 'STORAGE_CORRUPT'
  );
  // A gzip object that inflates to other bytes fails the uncompressed hash.
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from('{"instances":[]}')));
  refused(
    () => store.readPage(job.record.id, pageRef.sha256, job.capability, 'viewer-a'),
    'STORAGE_CORRUPT'
  );
});

test('capabilityFor derives the same capability the store authorizes, and never for a malformed id', (t) => {
  const store = new ReaderJobStore({ directory: dir(t) });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  assert.equal(store.capabilityFor(job.record.id, 'viewer-a'), job.capability);
  assert.notEqual(store.capabilityFor(job.record.id, 'viewer-b'), job.capability);
  refused(() => store.capabilityFor('../etc', 'viewer-a'), 'NOT_FOUND');
});

// ── #528 review: interleavings that must never lose live evidence ─────────
function age(store) {
  const old = new Date(Date.now() - 60_000);
  for (const sub of ['pages', 'indexes', 'checkpoints', 'manifests'])
    for (const f of fs.readdirSync(path.join(store.directory, sub)))
      fs.utimesSync(path.join(store.directory, sub, f), old, old);
  return old;
}
const markOnly = { records: 1000, objects: 1000, bytes: 1 << 30, ms: 10_000 };

test('a page re-referenced by hash after the mark began is not swept', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const gone = run(store, 'viewer-a', 'k-a', 'shared');
  const page = store.workerPayload(gone.record.id).page_paths[0];
  const hash = path.basename(page, '.json');
  store.delete(gone.record.id, gone.capability, 'viewer-a');
  const old = age(store);
  // Open a collection (its mark began) before the new reference exists.
  store.maintain({ records: 0, objects: 1000, bytes: 1 << 30, ms: 10_000 });
  assert.equal(store._gc?.phase, 'mark');
  // A new job references the old page by hash only (no bytes rewritten).
  const job = create(store, 'viewer-b', 'k-b');
  const lease = store.lease(job.record.id);
  store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: { phase: 'done', done: true },
    pages: [{ sha256: hash }],
    progress: { candidates: 1 },
    coverage,
  });
  finish(store, lease);
  assert.ok(fs.statSync(page).mtimeMs > old.getTime(), 'a by-hash reference refreshes mtime');
  // Even if its mtime were not refreshed, the record save re-marks it.
  fs.utimesSync(page, old, old);
  while (store.maintain(markOnly).phase !== 'idle');
  assert.equal(fs.existsSync(page), true);
  const ref = store.readManifestPage(job.record.id, job.capability, 'viewer-b').page_refs[0];
  assert.equal(ref.sha256, hash);
  assert.ok(store.readPage(job.record.id, hash, job.capability, 'viewer-b'));
  assert.equal(store.usage, scan(store));
});

test('a mark that fails part-way abandons the collection instead of sweeping a partial mark', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const live = run(store, 'viewer-a', 'k-a', 'live');
  const objects = () =>
    ['pages', 'indexes', 'checkpoints', 'manifests'].flatMap((sub) =>
      fs.readdirSync(path.join(store.directory, sub)).map((f) => `${sub}/${f}`)
    );
  const before = objects();
  age(store);
  const real = store._object.bind(store);
  let calls = 0;
  store._object = (kind, hash) => {
    if (kind === 'indexes' && calls++ === 0)
      throw Object.assign(new Error('transient read failure'), { code: 'EIO' });
    return real(kind, hash);
  };
  assert.throws(() => store.maintain(markOnly), /transient read failure/);
  assert.equal(store._gc, null, 'the partial mark is discarded');
  store._object = real;
  while (store.maintain(markOnly).phase !== 'idle');
  assert.deepEqual(objects(), before, 'nothing live was swept');
  assert.ok(store.readManifest(live.record.id, live.capability, 'viewer-a'));
});

test('a mark slice reads at most its object bound, resuming mid-chain', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = create(store, 'viewer-a', 'k-a');
  let lease = store.lease(job.record.id);
  // A long chain on ONE record: several checkpoints, each with an index node.
  for (let i = 0; i < 5; i++) {
    store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
      cursor: { phase: 'p', at: i },
      pages: [{ instances: [{ id: `e${i}` }] }],
      progress: { candidates: i + 1 },
      coverage,
    });
  }
  const bounds = { records: 1000, objects: 2, bytes: 1 << 30, ms: 10_000 };
  let total = 0;
  for (let r = store.maintain(bounds); ; r = store.maintain(bounds)) {
    assert.ok(r.read <= bounds.objects, `a slice read ${r.read} objects`);
    total += r.read;
    if (r.phase !== 'mark') break;
  }
  assert.ok(total >= 10, 'the whole chain was marked across slices');
  void lease;
});

test('while usage is unknown, reserved transitions cannot grow a record past its reservation', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = create(store, 'viewer-a', 'k-a');
  fs.writeFileSync(path.join(store.directory, 'pending'), JSON.stringify({ generation: 9 }));
  const grow = (n) =>
    store._open(() =>
      store._save({ ...store.records.get(job.record.id), pad: 'x'.repeat(n) }, true)
    );
  grow(100); // a small transition inside the record's 16 KiB reservation
  grow(10_000); // still inside it
  assert.equal(store.usage, null);
  // Each step adds under 16 KiB, but the record would outgrow its reservation.
  refused(() => grow(20_000), 'STORE_RECOUNTING');
});

test('expired work is never dispatched, promoted or continued', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const queued = create(store, 'viewer-a', 'k-a');
  now += READER_LIMITS.retentionMs + 1;
  assert.equal(store.lease(), null);
  assert.equal(store.lease(queued.record.id), null);
  assert.equal(store.inspect(queued.record.id).state, 'expired');
  assert.deepEqual(store.listQueued(), []);

  const running = create(store, 'viewer-b', 'k-b');
  const lease = store.lease(running.record.id);
  now += READER_LIMITS.retentionMs + 1;
  refused(
    () =>
      store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
        cursor: { phase: 'done', done: true },
        pages: [],
        progress: { candidates: 0 },
        coverage,
      }),
    'STALE_ATTEMPT'
  );
  assert.equal(store.inspect(running.record.id).state, 'expired');
});

test('a recount that throws is a failed attempt: the store stays usable and a later recount succeeds', async (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  fs.writeFileSync(path.join(store.directory, 'pending'), JSON.stringify({ generation: 3 }));
  refused(() => create(store, 'viewer-b', 'k-b'), 'STORE_RECOUNTING');
  const readdir = fs.readdirSync;
  fs.readdirSync = () => {
    throw Object.assign(new Error('EIO'), { code: 'EIO' });
  };
  let accepted;
  try {
    accepted = await store.recount({ attempts: 2 });
  } finally {
    fs.readdirSync = readdir;
  }
  assert.equal(accepted, false);
  assert.equal(store.failure, null, 'a scan error never marks the store failed');
  assert.ok(store.get(job.record.id, job.capability, 'viewer-a'), 'reads still work');
  assert.equal(await store.recount(), true);
  assert.equal(store.usage, scan(store));
});

test('gzip objects are exactly one member: concatenations and trailing bytes refuse', () => {
  const body = Buffer.from('{"instances":[]}');
  assert.deepEqual(decodeStoredObject(zlib.gzipSync(body)), body);
  const corrupt = (raw) =>
    assert.throws(
      () => decodeStoredObject(raw),
      (e) => e.code === 'STORAGE_CORRUPT'
    );
  corrupt(Buffer.concat([zlib.gzipSync(Buffer.alloc(0)), zlib.gzipSync(body)]));
  corrupt(Buffer.concat([zlib.gzipSync(body), zlib.gzipSync(body)]));
  corrupt(Buffer.concat([zlib.gzipSync(body), Buffer.from('xyz')]));
  corrupt(zlib.gzipSync(body).subarray(0, -3));
  const badCrc = Buffer.from(zlib.gzipSync(body));
  badCrc[badCrc.length - 8] ^= 1;
  corrupt(badCrc);
});

// ── #528 verdict at 89a5f4b6: quota, measurement, contention, bounds ──────
test('the quota holds across two instances under unknown usage (per-record reservations)', async (t) => {
  const d = dir(t);
  let now = 1000;
  const maxBytes = 48 * 1024;
  const a = new ReaderJobStore({ directory: d, now: () => now, maxBytes });
  const job = create(a, 'viewer-a', 'k-a');
  const cancelUntilRefused = (store, prefix) => {
    for (let i = 0; i < 5000; i++) {
      try {
        store.cancel(job.record.id, job.capability, 'viewer-a', {
          idempotency_key: `${prefix}-${i}`,
        });
      } catch (error) {
        return error.code;
      }
      assert.ok(scan(store) <= maxBytes, `quota exceeded at ${prefix}-${i}`);
    }
    return 'never refused';
  };
  assert.equal(cancelUntilRefused(a, 'a'), 'RESOURCE_LIMIT');
  const b = new ReaderJobStore({ directory: d, now: () => now, maxBytes });
  // Another writer commits (what a foreign commit leaves behind): B's view is stale.
  const generation = path.join(a.directory, 'generation');
  const g = JSON.parse(fs.readFileSync(generation, 'utf8')).generation;
  fs.writeFileSync(generation, JSON.stringify({ generation: g + 1 }));
  assert.equal(cancelUntilRefused(b, 'b'), 'STORE_RECOUNTING');
  assert.ok(scan(b) <= maxBytes);
  await b.recount();
  assert.equal(cancelUntilRefused(b, 'b2'), 'RESOURCE_LIMIT');
  assert.ok(scan(b) <= maxBytes);
});

test('a recount whose measurement fails is never accepted, even with an unchanged generation', async (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  run(store, 'viewer-a', 'k-a', 'a');
  const truth = scan(store);
  store.usage = null;
  const stat = fs.statSync;
  let failed = false;
  fs.statSync = (file, ...rest) => {
    if (!failed && String(file).includes(`${path.sep}pages${path.sep}`)) {
      failed = true;
      throw Object.assign(new Error('EIO'), { code: 'EIO' });
    }
    return stat(file, ...rest);
  };
  let accepted;
  try {
    accepted = await store.recount({ attempts: 1 });
  } finally {
    fs.statSync = stat;
  }
  assert.equal(failed, true);
  assert.equal(accepted, false, 'an undercount is never published');
  assert.equal(store.usage, null);
  assert.equal(await store.recount(), true);
  assert.equal(store.usage, truth);
});

test('lock contention during recount acceptance is retried, never a permanent failure', async (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = run(store, 'viewer-a', 'k-a', 'a');
  store.usage = null;
  const locked = store._locked.bind(store);
  let busy = true;
  store._locked = (fn) => {
    if (busy) {
      busy = false;
      throw Object.assign(new Error('busy'), { code: 'STORE_BUSY', status: 503 });
    }
    return locked(fn);
  };
  assert.equal(await store.recount({ attempts: 2 }), true);
  assert.equal(store.failure, null);
  assert.ok(store.get(job.record.id, job.capability, 'viewer-a'));
});

test('an expired job cannot be handed to the worker', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const job = create(store, 'viewer-a', 'k-a');
  store.lease(job.record.id);
  now += READER_LIMITS.retentionMs + 1;
  refused(() => store.workerPayload(job.record.id), 'RESULT_EXPIRED');
});

test('a slice examines at most its bound: expiry, mark and sweep enumeration all resume', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  for (let i = 0; i < 8; i++) {
    const j = run(store, `v${i}`, `k${i}`, `t${i}`);
    if (i % 2) store.delete(j.record.id, j.capability, j.record.viewer);
  }
  age(store);
  now += READER_LIMITS.retentionMs + 1; // everything left is due to expire
  const bounds = { records: 2, objects: 3, bytes: 1 << 30, ms: 10_000 };
  let slices = 0;
  let result;
  do {
    result = store.maintain(bounds);
    assert.ok(result.expired <= bounds.records);
    assert.ok(result.examined <= bounds.records, `expiry examined ${result.examined} records`);
    assert.ok(result.read <= bounds.objects + 0, `a slice examined ${result.read} entries`);
    slices++;
  } while ((result.phase !== 'idle' || result.expired) && slices < 500);
  assert.ok(slices > 5, 'the work was spread across many slices');
  for (const id of store.records.keys())
    assert.ok(['expired', 'deleted'].includes(store.inspect(id).state));
  assert.equal(store.usage, scan(store));
});

test("one job's growth never consumes another job's reservation", (t) => {
  let now = 1000;
  const maxBytes = 64 * 1024;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now, maxBytes });
  const first = create(store, 'viewer-a', 'k-a');
  const second = create(store, 'viewer-b', 'k-b');
  let refusedWith;
  for (let i = 0; i < 5000 && !refusedWith; i++) {
    try {
      store.cancel(first.record.id, first.capability, 'viewer-a', { idempotency_key: `f-${i}` });
    } catch (error) {
      refusedWith = error.code;
    }
  }
  assert.equal(refusedWith, 'RESOURCE_LIMIT');
  // The second job's own transitions still fit: its reservation was kept.
  for (let i = 0; i < 5; i++)
    store.cancel(second.record.id, second.capability, 'viewer-b', { idempotency_key: `s-${i}` });
  assert.ok(scan(store) <= maxBytes);
});

test('the dirty re-mark stays inside the slice bound and withholds the sweep until it completes', (t) => {
  let now = 1000;
  const store = new ReaderJobStore({ directory: dir(t), now: () => now });
  const gone = run(store, 'viewer-g', 'k-g', 'gone');
  store.delete(gone.record.id, gone.capability, 'viewer-g');
  age(store);
  // Open a collection, then save a record with a long new chain.
  store.maintain({ records: 0, objects: 1000, bytes: 1 << 30, ms: 10_000 });
  const job = create(store, 'viewer-a', 'k-a');
  const lease = store.lease(job.record.id);
  for (let i = 0; i < 6; i++)
    store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
      cursor: { phase: 'p', at: i },
      pages: [{ instances: [{ id: `d${i}` }] }],
      progress: { candidates: i + 1 },
      coverage,
    });
  // Backdate everything, so only the re-mark (not mtime) protects the new chain.
  age(store);
  const bounds = { records: 1000, objects: 2, bytes: 1 << 30, ms: 10_000 };
  let withheld = 0;
  for (let i = 0; i < 200; i++) {
    const r = store.maintain(bounds);
    assert.ok(r.read <= bounds.objects, `a slice read ${r.read} objects`);
    if (r.phase === 'sweep' && r.swept === 0 && store._gc?.stack.length) withheld++;
    if (r.phase === 'idle') break;
  }
  assert.ok(withheld > 0, 'the sweep waited for the re-mark');
  assert.equal(store._gc, null);
  for (const p of store.workerPayload(job.record.id).page_paths)
    assert.equal(fs.existsSync(p), true);
  assert.equal(store.usage, scan(store));
});
