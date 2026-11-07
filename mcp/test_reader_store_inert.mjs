// The reader store's inertness golden (#656 persisted discovery, Node-side
// plan Step 2). Captured on the store, the scheduler and the bridge contract
// as they were BEFORE any discovery change, so every later step can show that
// with C1 off and no frame carrying `discovery`, behaviour is unchanged: the
// same files with the same bytes, the same record key sets and public job
// views, the same lease and pause transitions, the same return values and
// refusals, and the same request objects handed to the bridge.
//
// Four halves, each on a fresh directory with fresh deterministic sources:
// the store driven directly, and the same store driven through
// ReaderScheduler with a scripted fake bridge, each plain and with gzip.
//
// Determinism (nothing is left to the host):
// - the store's `now` and `clock` are injected counters, 1000 ms per call;
//   `now` also takes explicit jumps (lease expiry, retention expiry);
// - crypto.randomBytes draws come from deterministicRandomBytes(), one counter
//   per draw size, so a later step that takes the lock more often (12- and
//   16-byte draws, never persisted) leaves every persisted 32-byte draw where
//   it was;
// - Date is mocked to FIXED_DATE and never ticked, so maintain()'s mtime
//   sweep (startedAt = Date.now() - 1000) and _blob's mtime refresh
//   (new Date()) decide the same way on every host.
//
// Normalisations, each applied explicitly below and listed in the golden:
//   N1 every absolute path under the test's directory is rewritten to
//      `<store>` (the store's own directory) or `<dir>` (its parent);
//   N2 a stored object in gzip form is listed as `gzip:<sha256 of its
//      inflated bytes>` rather than the sha256 of its compressed bytes,
//      which depend on the zlib build;
//   N3 in the gzip halves only, store usage byte counts that include
//      compressed sizes (prune().bytes, readiness().bytes, maintain().bytes)
//      read `<gzip-bytes>`;
//   N4 the bridge request's `lease_ms` and the call's `timeoutMs` read
//      `<lease_ms>` and `<timeout_ms>` (fixed under the Date mock already; a
//      second guard);
//   N5 the listing leaves out writer.lock, *.tmp names and readiness-probe
//      (transient), and every mtime.
//
// READER_INERT_GOLDEN_UPDATE=1 node --test mcp/test_reader_store_inert.mjs
// rewrites the golden, and nothing else does. A commit that changes the
// golden states the behaviour change it intends.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { after, test } from 'node:test';
import { ReaderJobStore } from './reader_job_store.js';
import { publicReaderJob } from './reader_routes.js';
import { ReaderScheduler } from './reader_scheduler.js';
import {
  FIXED_DATE,
  counterClock,
  deterministicRandomBytes,
  storeDirectory,
} from './reader_store_test_support.mjs';

const GOLDEN = new URL('./fixtures/reader_store_inert/golden.json', import.meta.url);
const UPDATE = process.env.READER_INERT_GOLDEN_UPDATE === '1';
const NORMALISATIONS = [
  'N1 absolute paths under the test directory read <store> (the store directory) or <dir> (its parent)',
  'N2 a stored object in gzip form is listed as gzip:<sha256 of its inflated bytes>',
  'N3 gzip halves only: prune().bytes, readiness().bytes and maintain().bytes read <gzip-bytes>',
  "N4 the bridge request's lease_ms and the call's timeoutMs read <lease_ms> and <timeout_ms>",
  'N5 the listing leaves out writer.lock, *.tmp, readiness-probe and every mtime',
];
const MAX_BYTES = 1024 * 1024;
const LEASE_MS = 600_000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FULL = { objects: 1e9, bytes: 1e12, records: 1e9, ms: 1e15 };

const identity = {
  snapshot: 'snapshot-inert',
  revision: 'revision-inert',
  engine: 'engine-inert',
  declarations: 'none',
};
const request = { requested_layers: ['sound'], declaration_set: { returns: [] } };
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
const summary = (count) => ({
  coverage,
  counters: { evidence_records: count },
  methods: [{ method_id: 'sound', coverage: 'answered' }],
});
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

// A deterministic string of `n` base64 characters: compressible, but not by
// much, so the 507 below happens in the plain and the gzip halves alike.
function filler(label, n) {
  const parts = [];
  let length = 0;
  for (let i = 0; length < n; i++) {
    const part = crypto.createHash('sha256').update(`${label}\0${i}`).digest('base64');
    parts.push(part);
    length += part.length;
  }
  return parts.join('').slice(0, n);
}

// The store's `now`: a counter, 1000 ms per call, that a test can jump.
function steppedNow(start) {
  let t = start - 1000;
  const now = () => (t += 1000);
  now.advance = (ms) => {
    t += ms;
  };
  return now;
}

function hasKeyDeep(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (!Array.isArray(value) && Object.hasOwn(value, key)) return true;
  return Object.values(value).some((child) => hasKeyDeep(child, key));
}

class Recorder {
  constructor(dir, gzip) {
    this.dir = dir;
    this.root = storeDirectory(dir);
    this.gzip = gzip;
    this.previous = new Map();
    this.steps = [];
    this.requests = [];
    this.sent = 0;
  }
  // N1: absolute paths, in any string, anywhere in a value.
  norm(value) {
    const root = this.root,
      dir = path.resolve(this.dir);
    const visit = (v) => {
      if (typeof v === 'string') return v.split(root).join('<store>').split(dir).join('<dir>');
      if (Array.isArray(v)) return v.map(visit);
      if (v && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visit(x)]));
      return v;
    };
    return visit(JSON.parse(JSON.stringify(value ?? null)));
  }
  // Every file under the store directory, by relative path, with N2 and N5.
  listing() {
    const files = new Map();
    const walk = (rel) => {
      for (const entry of fs.readdirSync(path.join(this.root, rel), { withFileTypes: true })) {
        const name = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(name);
          continue;
        }
        if (
          entry.name === 'writer.lock' ||
          entry.name === 'readiness-probe' ||
          entry.name.endsWith('.tmp')
        )
          continue;
        const raw = fs.readFileSync(path.join(this.root, name));
        const gz = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;
        files.set(name, gz ? `gzip:${sha(zlib.gunzipSync(raw))}` : sha(raw));
      }
    };
    walk('');
    return files;
  }
  // N3, applied by the operations that report usage.
  usage(value) {
    return this.gzip ? '<gzip-bytes>' : value;
  }
  step(op, run) {
    let result;
    try {
      result = { value: this.norm(run()) };
    } catch (error) {
      if (!error.code) throw error;
      result = {
        error: { code: error.code, status: error.status ?? null, message: error.message },
      };
    }
    this.record(op, result);
    return result.value;
  }
  async stepAsync(op, run) {
    let result;
    try {
      result = { value: this.norm(await run()) };
    } catch (error) {
      if (!error.code) throw error;
      result = {
        error: { code: error.code, status: error.status ?? null, message: error.message },
      };
    }
    this.record(op, result);
    return result.value;
  }
  record(op, result) {
    const files = this.listing();
    const added = {},
      changed = {},
      removed = [],
      record_keys = {},
      public_jobs = {};
    for (const [name, digest] of files) {
      if (!this.previous.has(name)) added[name] = digest;
      else if (this.previous.get(name) !== digest) changed[name] = digest;
    }
    for (const name of this.previous.keys()) if (!files.has(name)) removed.push(name);
    for (const name of files.keys()) {
      if (!name.startsWith('records/') || !name.endsWith('.json')) continue;
      const body = JSON.parse(fs.readFileSync(path.join(this.root, name), 'utf8'));
      assert.equal(Object.hasOwn(body, 'discovery'), false, `${op}: ${name} has a discovery key`);
      if (!(name in added || name in changed)) continue;
      record_keys[name] = Object.keys(body).sort();
      // The job as the routes serialise it, the public response of every job view.
      public_jobs[name] = this.norm(publicReaderJob(body));
    }
    this.previous = files;
    const entry = { op, ...result, files: { added, changed, removed: removed.sort() } };
    if (Object.keys(record_keys).length) Object.assign(entry, { record_keys, public_jobs });
    const requests = this.requests.slice(this.sent);
    this.sent = this.requests.length;
    if (requests.length) entry.bridge = requests;
    this.steps.push(entry);
  }
}

// One half's deterministic sources: randomBytes per size, the fixed Date, a
// fresh directory removed after the test.
function setup(t) {
  t.mock.method(crypto, 'randomBytes', deterministicRandomBytes());
  t.mock.timers.enable({ apis: ['Date'], now: FIXED_DATE });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-inert-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function open(dir, gzip, now, clock) {
  return new ReaderJobStore({
    directory: dir,
    maxBytes: MAX_BYTES,
    now,
    clock,
    ttlMs: TTL_MS,
    leaseMs: LEASE_MS,
    gzip,
  });
}
const pages = (...instances) => instances.map((list) => ({ instances: list }));
const commit = (store, lease, cursor, list) =>
  store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor,
    pages: list,
    progress: { candidates: list.length },
    coverage,
  });
const complete = (store, lease, count) =>
  store.complete(lease.id, lease.attempt, lease.fence, {
    exhausted: true,
    census_reconciled: true,
    coverage,
    summary: summary(count),
    provider_calls: 0,
  });

// ── the store half ───────────────────────────────────────────────────────
function runStoreHalf(t, gzip) {
  const dir = setup(t);
  const now = steppedNow(FIXED_DATE),
    clock = counterClock(0, 1000);
  const rec = new Recorder(dir, gzip);
  let store;
  rec.step('construct', () => {
    store = open(dir, gzip, now, clock);
    return { usage: rec.usage(store.usage) };
  });
  const make = (viewer, key) => store.create({ viewer, idempotency_key: key, identity, request });
  const caps = new Map();
  const created = (out) => {
    caps.set(out.record.id, { capability: out.capability, viewer: out.record.viewer });
    return out;
  };
  // 1. Two jobs, one keyed create replayed.
  const a = rec.step('create A', () => created(make('viewer-a', 'key-a')));
  const b = rec.step('create B', () => created(make('viewer-b', 'key-b')));
  rec.step('create A again (idempotent replay)', () => make('viewer-a', 'key-a'));
  const A = a.record.id,
    B = b.record.id;
  const ctl = (id) => [id, caps.get(id).capability, caps.get(id).viewer];

  // 2. Lease, payload, three commits (one an exact retry); no frame names discovery.
  let lease = rec.step('lease', () => store.lease());
  assert.equal(lease.id, A);
  rec.step('workerPayload A', () => store.workerPayload(A));
  const first = [[{ id: 'evidence-1', verdict: true }]];
  rec.step('commit 1', () => commit(store, lease, { phase: 'pairs', index: 1 }, pages(...first)));
  rec.step('commit 1 again (exact retry)', () =>
    commit(store, lease, { phase: 'pairs', index: 1 }, pages(...first))
  );
  rec.step('commit 2', () =>
    commit(store, lease, { phase: 'pairs', index: 2 }, pages([{ id: 'evidence-2' }]))
  );
  rec.step('workerPayload A after commits', () => store.workerPayload(A));

  // 3. A commit refused 507: the first page lands (an orphan), the second does
  //    not fit, and _quotaPause pauses the job with its cursor unchanged.
  rec.step('commit 507 (quota pause)', () =>
    commit(
      store,
      lease,
      { phase: 'pairs', index: 3 },
      pages(
        [{ id: 'big-1', blob: filler('big-1', 300_000) }],
        [{ id: 'big-2', blob: filler('big-2', 1_300_000) }]
      )
    )
  );
  rec.step('commit after the quota pause (stale)', () =>
    commit(store, lease, { phase: 'pairs', index: 4 }, pages([{ id: 'late' }]))
  );

  // 4. Resume, fill the queue, pause with requeue into a full queue (deferred),
  //    promote it on the next lease, lease again and complete.
  rec.step('resume A', () => store.resume(...ctl(A), identity));
  rec.step('create 14 fillers', () => {
    const ids = [];
    for (let i = 0; i < 14; i++) ids.push(created(make(`filler-${i}`, `fill-${i}`)).record.id);
    return ids;
  });
  lease = rec.step('lease A by id', () => store.lease(A));
  rec.step('create filler 14 (queue full)', () => created(make('filler-14', 'fill-14')).record.id);
  rec.step('create one more (QUEUE_FULL)', () => make('overflow', 'overflow'));
  rec.step('pause A with requeue into a full queue (deferred)', () =>
    store.pause(lease.id, lease.attempt, lease.fence, {
      code: 'YIELD',
      message: 'Reader lease yielded at a durable checkpoint.',
      requeue: true,
    })
  );
  const leaseB = rec.step('lease B (promotes A)', () => store.lease());
  assert.equal(leaseB.id, B);
  rec.step('listQueued', () => store.listQueued().map((r) => [r.id, r.queue_order]));
  rec.step('commit B done', () =>
    commit(store, leaseB, { phase: 'done', done: true }, pages([{ id: 'evidence-b' }]))
  );
  rec.step('complete B', () => complete(store, leaseB, 1));
  lease = rec.step('lease A again', () => store.lease(A));
  rec.step('commit A done', () =>
    commit(store, lease, { phase: 'done', done: true }, pages([{ id: 'evidence-3' }]))
  );
  rec.step('complete A with a wrong count (CENSUS_MISMATCH)', () => complete(store, lease, 99));
  rec.step('complete A', () => complete(store, lease, 3));
  rec.step('get A', () => store.get(...ctl(A)));
  rec.step('readManifestPage A', () => store.readManifestPage(...ctl(A)));

  // 5. Cancel, resume, delete, a cancelled lease, lease expiry, a full
  //    maintain(), then retention expiry through prune().
  const fillers = [...caps.keys()].filter((id) => caps.get(id).viewer.startsWith('filler-'));
  const [f0, f1, f2] = fillers;
  rec.step('cancel filler 0 (queued)', () => store.cancel(...ctl(f0)));
  rec.step('resume filler 0', () => store.resume(...ctl(f0), identity));
  rec.step('delete filler 1 (tombstone)', () => store.delete(...ctl(f1)));
  rec.step('delete filler 1 again', () => store.delete(...ctl(f1)));
  const leaseF2 = rec.step('lease filler 2', () => store.lease(f2));
  rec.step('cancel filler 2 (running)', () => store.cancel(...ctl(f2)));
  rec.step('pause filler 2 (cancel requested)', () =>
    store.pause(leaseF2.id, leaseF2.attempt, leaseF2.fence, { code: 'CANCELLED', requeue: false })
  );
  const leased = rec.step('lease next', () => store.lease());
  rec.step('lease expiry (jump past leaseMs, lease())', () => {
    now.advance(LEASE_MS + 1000);
    return { next: store.lease(), expired: store.inspect(leased.id) };
  });
  rec.step('maintain (full)', () => {
    const rounds = [];
    for (let i = 0; i < 8; i++) {
      const out = store.maintain(FULL);
      rounds.push({ ...out, bytes: rec.usage(out.bytes) });
      if (out.phase === 'idle') break;
    }
    return rounds;
  });
  rec.step('readiness', () => {
    const out = store.readiness();
    return { ...out, bytes: rec.usage(out.bytes) };
  });
  rec.step('retention expiry (jump past ttl, prune())', () => {
    now.advance(TTL_MS + 1000);
    const out = store.prune();
    return { bytes: rec.usage(out.bytes) };
  });
  rec.step('get A after expiry (RESULT_EXPIRED)', () => store.get(...ctl(A)));
  rec.step('create A again after expiry (RESULT_EXPIRED)', () => make('viewer-a', 'key-a'));

  // 6. A restart with a job running: the new instance pauses it INTERRUPTED.
  const c = rec.step('create C', () => created(make('viewer-c', 'key-c')));
  rec.step('lease C', () => store.lease(c.record.id));
  rec.step('restart', () => {
    store = open(dir, gzip, now, clock);
    return { usage: rec.usage(store.usage), C: store.inspect(c.record.id) };
  });
  rec.step('lease after restart', () => store.lease());
  rec.step('resume C', () => store.resume(...ctl(c.record.id), identity));
  rec.step('lease C after resume', () => store.lease());
  return rec;
}

// ── the scheduler half ───────────────────────────────────────────────────
// A fake bridge whose `runReaderLease` follows a script, one entry per lease,
// and records each request object (N4) and what each sink call returned.
function fakeBridge(rec, script) {
  let at = 0;
  return {
    capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
    async runReaderLease(req, options) {
      const entry = {
        request: rec.norm({ ...req, lease_ms: '<lease_ms>' }),
        timeoutMs: '<timeout_ms>',
        sink: [],
      };
      assert.equal(hasKeyDeep(req, 'discovery'), false, 'a bridge request names discovery');
      rec.requests.push(entry);
      const sink = async (step) => {
        try {
          const reply = await options.onReaderCheckpoint(step);
          entry.sink.push({ reply: rec.norm(reply) });
          return reply;
        } catch (error) {
          entry.sink.push({ thrown: { code: error.code ?? null, message: error.message } });
          throw error;
        }
      };
      const plan = script[at++];
      if (!plan) throw new Error('fake bridge: no scripted lease left');
      return plan(sink, options);
    },
  };
}
const step = (checkpoint, records, count, done = false) => ({
  provider_calls: 0,
  checkpoint,
  records,
  summary: { progress: { candidates: records.length }, ...summary(count) },
  done,
});

async function runSchedulerHalf(t, gzip) {
  const dir = setup(t);
  const now = steppedNow(FIXED_DATE),
    clock = counterClock(0, 1000);
  const rec = new Recorder(dir, gzip);
  let store;
  rec.step('construct', () => {
    store = open(dir, gzip, now, clock);
    return { usage: rec.usage(store.usage) };
  });
  const script = [
    // lease 1 (A): two checkpoints, the first sent twice (an exact retry), then a yield.
    async (sink) => {
      const one = step({ phase: 'pairs', index: 1 }, [{ id: 'evidence-1', verdict: true }], 1);
      await sink(one);
      await sink(one);
      await sink(step({ phase: 'pairs', index: 2 }, [{ id: 'evidence-2' }], 2));
      return { code: 0, reader_result: { status: 'yielded', reason: 'YIELD' } };
    },
    // lease 2 (B): a checkpoint past the quota pauses the job inside the sink;
    // the worker stops, and the scheduler's own pause meets STALE_ATTEMPT.
    async (sink) => {
      const reply = await sink(
        step(
          { phase: 'pairs', index: 1 },
          [
            { id: 'big-1', blob: filler('big-1', 300_000) },
            { id: 'big-2', blob: filler('big-2', 1_300_000) },
          ],
          2
        )
      );
      return { code: 0, reader_result: { status: 'stopped', reason: reply.stop_reason } };
    },
    // lease 3 (A): the worker exits non-zero with a code and stderr.
    async () => ({ code: 1, error_code: 'READER_ERROR', stderr: 'reader worker failed' }),
    // lease 4 (A, resumed): the bridge itself fails (a kill), with no code.
    async () => {
      throw new Error('reader bridge killed');
    },
    // lease 5 (A, resumed): a sink refusal (a provider call) reaches the catch.
    async (sink) => {
      await sink({ ...step({ phase: 'pairs', index: 3 }, [], 2), provider_calls: 1 });
      return { code: 0, reader_result: { status: 'complete' } };
    },
    // lease 6 (A, resumed): the done checkpoint and a complete result.
    async (sink) => {
      await sink(step({ phase: 'done', done: true }, [{ id: 'evidence-3' }], 3, true));
      return { code: 0, reader_result: { status: 'complete' } };
    },
  ];
  const bridge = fakeBridge(rec, script);
  const scheduler = new ReaderScheduler({
    store,
    bridge,
    resolveSource: async () => ({ source: 'inert source text' }),
    resolveIdentity: async () => identity,
    leaseMs: LEASE_MS,
  });
  // pump()'s finally kicks a timer that would pump again on its own; the test
  // pumps explicitly instead, so every lease lands in the step that caused it.
  t.mock.method(scheduler, 'kick', () => {});
  const caps = new Map();
  const make = (viewer, key) => {
    const out = store.create({ viewer, idempotency_key: key, identity, request });
    caps.set(out.record.id, { capability: out.capability, viewer });
    return out;
  };
  const a = rec.step('create A', () => make('viewer-a', 'key-a'));
  const b = rec.step('create B', () => make('viewer-b', 'key-b'));
  rec.step('create A again (idempotent replay)', () => make('viewer-a', 'key-a'));
  const A = a.record.id,
    B = b.record.id;
  const ctl = (id) => [id, caps.get(id).capability, caps.get(id).viewer];
  const pump = (label) =>
    rec.stepAsync(label, async () => {
      await scheduler.pump();
      return { A: store.inspect(A), B: store.inspect(B), active: scheduler.active };
    });
  await pump('pump 1: A checkpoints and yields');
  await pump('pump 2: B over quota, stale pause');
  await pump('pump 3: A worker error');
  rec.step('resume A', () => store.resume(...ctl(A), identity));
  await pump('pump 4: A bridge killed');
  rec.step('resume A again', () => store.resume(...ctl(A), identity));
  await pump('pump 5: A sink refusal');
  rec.step('resume A once more', () => store.resume(...ctl(A), identity));
  await pump('pump 6: A completes');
  await pump('pump 7: nothing queued');
  rec.step('readiness', () => {
    const out = scheduler.readiness();
    return { ...out, bytes: rec.usage(out.bytes) };
  });
  rec.step('restart', () => {
    store = open(dir, gzip, now, clock);
    return { usage: rec.usage(store.usage), A: store.inspect(A), B: store.inspect(B) };
  });
  return rec;
}

// ── golden comparison ────────────────────────────────────────────────────
const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : null;
const captured = {};
function check(name, rec) {
  captured[name] = rec.steps;
  if (UPDATE) return;
  assert.ok(golden, `missing ${GOLDEN.pathname}; capture it with READER_INERT_GOLDEN_UPDATE=1`);
  assert.deepEqual(golden.normalisations, NORMALISATIONS, 'the golden lists other normalisations');
  const expected = golden.halves[name];
  assert.ok(expected, `the golden has no ${name} half`);
  const n = Math.max(expected.length, rec.steps.length);
  for (let i = 0; i < n; i++)
    assert.deepEqual(rec.steps[i], expected[i], `${name}, step ${i}: ${expected[i]?.op}`);
}
for (const gzip of [false, true]) {
  const label = gzip ? 'gzip' : 'plain';
  test(`inertness golden: the store, ${label}`, (t) =>
    check(`store/${label}`, runStoreHalf(t, gzip)));
  test(`inertness golden: the scheduler, ${label}`, async (t) =>
    check(`scheduler/${label}`, await runSchedulerHalf(t, gzip)));
}

test('the golden pins the record key sets and no discovery anywhere', () => {
  if (UPDATE) return;
  for (const [name, steps] of Object.entries(golden.halves)) {
    const keys = new Set();
    for (const entry of steps) {
      for (const list of Object.values(entry.record_keys || {})) {
        assert.equal(list.includes('discovery'), false, `${name} ${entry.op}`);
        keys.add(JSON.stringify(list));
      }
      for (const job of Object.values(entry.public_jobs || {}))
        assert.equal(hasKeyDeep(job, 'discovery'), false, `${name} ${entry.op}`);
      for (const req of entry.bridge || [])
        assert.equal(hasKeyDeep(req, 'discovery'), false, `${name} ${entry.op}`);
    }
    assert.ok(keys.size > 0, `${name} records no record key set`);
  }
});

// Written as the repository's prettier formats it, so format:check holds the
// file as committed; the comparison above reads it parsed either way.
after(async () => {
  if (!UPDATE) return;
  const order = ['store/plain', 'store/gzip', 'scheduler/plain', 'scheduler/gzip'];
  assert.deepEqual(Object.keys(captured).sort(), [...order].sort(), 'every half ran');
  const out = {
    about:
      'Reader store inertness golden (#656 Step 2), written by mcp/test_reader_store_inert.mjs under READER_INERT_GOLDEN_UPDATE=1; compared parsed, never by hand.',
    normalisations: NORMALISATIONS,
    halves: Object.fromEntries(order.map((name) => [name, captured[name]])),
  };
  const prettier = await import('prettier');
  const options = await prettier.resolveConfig(GOLDEN.pathname);
  const text = await prettier.format(JSON.stringify(out), { ...options, parser: 'json' });
  fs.mkdirSync(new URL('.', GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, text);
});
