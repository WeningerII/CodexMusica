// The reader store's inertness golden (#656 persisted discovery, Node-side
// plan Step 2). Captured on the store, the scheduler and the bridge's reader
// frame as they were BEFORE any discovery change, so every later step can show
// that with C1 off and no frame carrying `discovery`, behaviour is unchanged:
// the same files with the same bytes, the same record key sets and public job
// views, the same lease and pause transitions, the same return values and
// refusals, the same store calls the scheduler makes and what it logs, and the
// same request objects and reader replies that cross the bridge.
//
// Seven halves, each on a fresh directory with fresh deterministic sources:
// the store driven directly, and the same store driven through
// ReaderScheduler with a scripted fake bridge, each plain and with gzip; the
// scheduler driven through the REAL python_bridge.js, whose warm worker is a
// scripted Node process speaking the reader protocol (plain only: the bridge
// never touches the store's encoding); packReaderPages at exactly its 2 MiB
// and 250-instance page limits and one past each; and createCatalogResolver
// over a minimal pinned catalog, recording the request identity it computes
// and leasing a job through it.
//
// Boundaries the store half holds on purpose: a lease read 1 ms before and
// AT lease_expires_at (expiry is `<=`), and maintain()'s mark window, with
// one orphan page aged 1 ms inside it (swept) and one exactly on its edge
// (kept).
//
// Determinism (nothing is left to the host):
// - the store's `now` and `clock` are injected and advance 1000 ms once per
//   RECORDED STEP, never per call, so a later step that reads the clock more
//   often (an expiry or reconciliation check) leaves the golden where it was;
//   `now` also takes explicit jumps (lease expiry, retention expiry);
// - crypto.randomBytes draws come from deterministicRandomBytes(), one counter
//   per draw size, so a later step that takes the lock more often (12- and
//   16-byte draws, never persisted) leaves every persisted 32-byte draw where
//   it was;
// - Date is mocked to FIXED_DATE and never ticked, so maintain()'s mtime
//   sweep (startedAt = Date.now() - 1000) and _blob's mtime refresh
//   (new Date()) decide the same way on every host. The scheduler halves
//   start the store's `now` 100 s before FIXED_DATE, so the scheduler's
//   lease_ms clamp (lease_expires_at - Date.now() - 1000) takes its
//   non-default branch and the value it computes is recorded.
//
// Normalisations, each applied explicitly below and listed in the golden:
//   N1 every absolute path under the test's directory is rewritten to
//      `<store>` (the store's own directory) or `<dir>` (its parent);
//   N2 a stored object in gzip form is listed as `gzip:<sha256 of its
//      inflated bytes>` rather than the sha256 of its compressed bytes,
//      which depend on the zlib build;
//   N3 every store usage count (store.usage, prune().bytes, readiness().bytes)
//      is first asserted equal to the bytes on disk the store counts; in the
//      gzip halves only, it then reads `<on-disk-bytes>` (the plain halves
//      record the number);
//   N4 the listing leaves out writer.lock, *.tmp names and readiness-probe
//      (transient), and every mtime;
//   N5 the real bridge's reply drops `ms` and `tool_deadline.elapsed_ms`
//      (wall time), and the worker's request frame lists its `env` keys only
//      (a per-call token and a wall-clock deadline).
//   N6 maintain().bytes is what a slice swept, not a usage count; the gzip
//      halves read `<swept-bytes>` where it is not 0 (compressed sizes).
//
// READER_INERT_GOLDEN_UPDATE=1 node --test mcp/test_reader_store_inert.mjs
// rewrites the golden, and nothing else does; under CI the variable fails the
// file instead. A commit that changes the golden states the behaviour change
// it intends. A step never records a failed assertion of this file as a
// refusal: it fails the test.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { after, test } from 'node:test';
import { createPythonBridge } from './python_bridge.js';
import { ReaderJobStore } from './reader_job_store.js';
import { publicReaderJob } from './reader_routes.js';
import {
  ReaderScheduler,
  canonicalJSON,
  createCatalogResolver,
  packReaderPages,
} from './reader_scheduler.js';
import {
  FIXED_DATE,
  deterministicRandomBytes,
  storeDirectory,
} from './reader_store_test_support.mjs';

const GOLDEN = new URL('./fixtures/reader_store_inert/golden.json', import.meta.url);
const UPDATE = process.env.READER_INERT_GOLDEN_UPDATE === '1';
// A stray update setting must never turn the gate into a rewrite in CI.
if (process.env.READER_INERT_GOLDEN_UPDATE && process.env.CI)
  throw new Error(
    'READER_INERT_GOLDEN_UPDATE is set under CI: the inertness golden is compared in CI, never rewritten.'
  );
const NORMALISATIONS = [
  'N1 absolute paths under the test directory read <store> (the store directory) or <dir> (its parent)',
  'N2 a stored object in gzip form is listed as gzip:<sha256 of its inflated bytes>',
  'N3 every usage count is asserted equal to the bytes on disk the store counts; gzip halves then read <on-disk-bytes>',
  'N4 the listing leaves out writer.lock, *.tmp, readiness-probe and every mtime',
  "N5 the real bridge's reply drops ms and tool_deadline.elapsed_ms; the worker's request frame lists its env keys only",
  'N6 maintain().bytes is the bytes a slice swept (not a usage count); gzip halves read <swept-bytes> where it is not 0',
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

// The store's `now` and `clock`: frozen within a recorded step, advanced
// 1000 ms by the Recorder at the start of each one (`tick`), and `now` can
// be jumped. The number of times the store reads either never matters.
function steppedClocks(start) {
  let t = start,
    c = 0;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  now.set = (ms) => {
    t = ms;
  };
  const clock = () => c;
  const tick = () => {
    t += 1000;
    c += 1000;
  };
  return { now, clock, tick };
}

// The bytes the store's usage counter stands for (reader_job_store.js
// _metadataBytes and _usage): capability-key, store-format.json, and every
// file under records/ and the object directories.
const COUNTED_DIRS = ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'];
function diskBytes(root) {
  let total = fs.statSync(path.join(root, 'capability-key')).size;
  const marker = path.join(root, 'store-format.json');
  if (fs.existsSync(marker)) total += fs.statSync(marker).size;
  for (const dir of COUNTED_DIRS)
    for (const name of fs.readdirSync(path.join(root, dir)))
      total += fs.statSync(path.join(root, dir, name)).size;
  return total;
}

function hasKeyDeep(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (!Array.isArray(value) && Object.hasOwn(value, key)) return true;
  return Object.values(value).some((child) => hasKeyDeep(child, key));
}

class Recorder {
  constructor(dir, gzip, tick) {
    this.dir = dir;
    this.root = storeDirectory(dir);
    this.gzip = gzip;
    this.tick = tick;
    this.previous = new Map();
    this.steps = [];
    // Per-step extras, drained into the step that produced them: bridge
    // requests, the store calls the scheduler made, what it logged, and the
    // frames the real bridge's worker received.
    this.extras = { bridge: [], store_calls: [], logged: [], worker: [] };
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
  // N3, applied by the operations that report usage. Unknown usage (null)
  // is recorded as is.
  usage(value) {
    if (value === null) return null;
    assert.equal(value, diskBytes(this.root), 'the usage counter equals the bytes on disk');
    return this.gzip ? '<on-disk-bytes>' : value;
  }
  // N6: maintain().bytes is what a slice swept, not a usage count.
  swept(value) {
    return this.gzip && value > 0 ? '<swept-bytes>' : value;
  }
  step(op, run) {
    this.tick();
    let result;
    try {
      result = { value: this.norm(run()) };
    } catch (error) {
      if (!error.code || error instanceof assert.AssertionError) throw error;
      result = {
        error: { code: error.code, status: error.status ?? null, message: error.message },
      };
    }
    this.record(op, result);
    return result.value;
  }
  async stepAsync(op, run) {
    this.tick();
    let result;
    try {
      result = { value: this.norm(await run()) };
    } catch (error) {
      if (!error.code || error instanceof assert.AssertionError) throw error;
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
    for (const [key, list] of Object.entries(this.extras))
      if (list.length) entry[key] = list.splice(0);
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
function open(dir, gzip, now, clock, faultInjector = null) {
  return new ReaderJobStore({
    directory: dir,
    maxBytes: MAX_BYTES,
    now,
    clock,
    ttlMs: TTL_MS,
    leaseMs: LEASE_MS,
    gzip,
    faultInjector,
  });
}
// The scheduler halves: every store call the scheduler's lease makes, with
// the pause reason it asked for and the code of any refusal, in order.
function spyStore(store, rec) {
  for (const method of ['commitCheckpoint', 'pause', 'complete']) {
    const original = store[method].bind(store);
    store[method] = (...args) => {
      const call = { method };
      if (method === 'pause') call.reason = rec.norm(args[3]);
      try {
        const out = original(...args);
        rec.extras.store_calls.push({ ...call, outcome: 'ok' });
        return out;
      } catch (error) {
        rec.extras.store_calls.push({ ...call, refused: error.code ?? null });
        throw error;
      }
    };
  }
  return store;
}
// The scheduler halves: what reaches console.error and console.warn. Node's
// own process warnings (the MockTimers ExperimentalWarning, printed once per
// process by whichever test is running) are not the code's and are left out.
function spyConsole(t, rec) {
  for (const level of ['error', 'warn'])
    t.mock.method(console, level, (...args) => {
      if (/^\(node:\d+\) \w*Warning:/.test(String(args[0]))) return;
      rec.extras.logged.push({ level, args: rec.norm(args.map(String)) });
    });
}
// A fault injector that fails the next atomic write of one kind, once.
function armableFault() {
  const fault = (stage, { kind }) => {
    if (stage !== 'temporary_written' || fault.next !== kind) return;
    fault.next = null;
    throw new Error(`injected ${kind} write fault`);
  };
  fault.next = null;
  return fault;
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
  const { now, clock, tick } = steppedClocks(FIXED_DATE);
  const rec = new Recorder(dir, gzip, tick);
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
  const maintainFull = () => {
    const rounds = [];
    for (let i = 0; i < 8; i++) {
      const out = store.maintain(FULL);
      rounds.push({ ...out, bytes: rec.swept(out.bytes), usage: rec.usage(store.usage) });
      if (out.phase === 'idle') break;
    }
    assert.equal(rounds.at(-1).phase, 'idle', 'maintain() finished its collection');
    return rounds;
  };
  rec.step('maintain (full)', maintainFull);
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
  const leaseC = rec.step('lease C after resume', () => store.lease());

  // 7. The lease-expiry boundary: one ms before lease_expires_at the lease
  //    holds (a lease() and a commit both see it running); AT lease_expires_at
  //    it has expired (_expireLeases: lease_expires_at <= now), so the same
  //    commit is refused and the job reads paused INTERRUPTED.
  rec.step('lease boundary: 1 ms before, then at, lease_expires_at', () => {
    const at = leaseC.lease_expires_at;
    now.set(at - 1);
    const before = { lease: store.lease(), commit: null };
    before.commit = commit(store, leaseC, { phase: 'pairs', index: 1 }, pages([{ id: 'c-1' }]));
    before.C = store.inspect(leaseC.id);
    now.set(at);
    let refused = null;
    try {
      commit(store, leaseC, { phase: 'pairs', index: 2 }, pages([{ id: 'c-2' }]));
    } catch (error) {
      if (!error.code) throw error;
      refused = error.code;
    }
    return {
      before,
      at: { commit_refused: refused, lease: store.lease(), C: store.inspect(leaseC.id) },
    };
  });

  // 8. maintain()'s mark window: the sweep deletes an unreferenced object only
  //    when its mtime is before startedAt = Date.now() - 1000 (FIXED_DATE -
  //    1000; Date is never ticked). Two orphan pages from a 507 are aged one
  //    just inside the window (FIXED_DATE - 1001: swept) and one just outside
  //    it (exactly FIXED_DATE - 1000: kept).
  const e = rec.step('create E', () => created(make('viewer-e', 'key-e')));
  const leaseE = rec.step('lease E', () => store.lease(e.record.id));
  const pagesDir = path.join(rec.root, 'pages');
  const pagesBefore = new Set(fs.readdirSync(pagesDir));
  rec.step('commit E 507 (two orphan pages)', () =>
    commit(
      store,
      leaseE,
      { phase: 'pairs', index: 1 },
      pages(
        [{ id: 'orphan-1', blob: filler('orphan-1', 200_000) }],
        [{ id: 'orphan-2', blob: filler('orphan-2', 200_000) }],
        [{ id: 'big-3', blob: filler('big-3', 1_300_000) }]
      )
    )
  );
  const orphans = fs
    .readdirSync(pagesDir)
    .filter((name) => !pagesBefore.has(name))
    .sort();
  assert.equal(orphans.length, 2, 'the 507 left two orphan pages');
  const [inside, outside] = orphans;
  rec.step('age the orphans either side of the mark window', () => {
    fs.utimesSync(
      path.join(pagesDir, inside),
      (FIXED_DATE - 1001) / 1000,
      (FIXED_DATE - 1001) / 1000
    );
    fs.utimesSync(
      path.join(pagesDir, outside),
      (FIXED_DATE - 1000) / 1000,
      (FIXED_DATE - 1000) / 1000
    );
    return { inside: `pages/${inside}`, outside: `pages/${outside}` };
  });
  rec.step('maintain (an orphan inside the mark window, one outside)', () => ({
    rounds: maintainFull(),
    inside_kept: fs.existsSync(path.join(pagesDir, inside)),
    outside_kept: fs.existsSync(path.join(pagesDir, outside)),
  }));
  return rec;
}

// ── the scheduler half ───────────────────────────────────────────────────
// A fake bridge whose `runReaderLease` follows a script, one entry per lease,
// and records each request object and call timeout as the scheduler built
// them, every value its shouldStop returned (called at the lease's start and
// after each sink reply), and what each sink call returned.
function fakeBridge(rec, script) {
  let at = 0;
  return {
    capacity: () => ({ active: 0, admitted: 0, queued: 0 }),
    async runReaderLease(req, options) {
      const entry = {
        request: rec.norm(req),
        timeoutMs: options.timeoutMs,
        should_stop: [],
        sink: [],
      };
      assert.equal(hasKeyDeep(req, 'discovery'), false, 'a bridge request names discovery');
      rec.extras.bridge.push(entry);
      const shouldStop = () => {
        const reason = options.shouldStop();
        entry.should_stop.push(reason);
        return reason;
      };
      const sink = async (step) => {
        try {
          const reply = await options.onReaderCheckpoint(step);
          entry.sink.push({ reply: rec.norm(reply) });
          shouldStop();
          return reply;
        } catch (error) {
          entry.sink.push({ thrown: { code: error.code ?? null, message: error.message } });
          throw error;
        }
      };
      const plan = script[at++];
      if (!plan) throw new Error('fake bridge: no scripted lease left');
      shouldStop();
      return plan(sink, shouldStop);
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
  // 100 s before FIXED_DATE: the lease_ms clamp takes its computed branch.
  const { now, clock, tick } = steppedClocks(FIXED_DATE - 100_000);
  const rec = new Recorder(dir, gzip, tick);
  spyConsole(t, rec);
  const fault = armableFault();
  let store;
  rec.step('construct', () => {
    store = spyStore(open(dir, gzip, now, clock, fault), rec);
    return { usage: rec.usage(store.usage) };
  });
  const caps = new Map();
  const make = (viewer, key) => {
    const out = store.create({ viewer, idempotency_key: key, identity, request });
    caps.set(out.record.id, { capability: out.capability, viewer });
    return out;
  };
  const ctl = (id) => [id, caps.get(id).capability, caps.get(id).viewer];
  let scheduler, C, D;
  const script = [
    // lease 1 (A): two checkpoints, the first sent twice (an exact retry), then a yield.
    async (sink) => {
      const one = step({ phase: 'pairs', index: 1 }, [{ id: 'evidence-1', verdict: true }], 1);
      await sink(one);
      await sink(one);
      await sink(step({ phase: 'pairs', index: 2 }, [{ id: 'evidence-2' }], 2));
      return { code: 0, reader_result: { status: 'yielded', reason: 'YIELD' } };
    },
    // lease 2 (B): a checkpoint past the quota, packed as two pages (250
    // small records, then one large): the first lands as an orphan, the
    // second is refused 507 and the job pauses inside the sink; the worker
    // stops, and the scheduler's own pause and its catch-pause both meet
    // STALE_ATTEMPT (two pause calls, nothing logged).
    async (sink) => {
      const small = Array.from({ length: 250 }, (_, i) => ({
        id: `small-${i}`,
        blob: filler(`small-${i}`, 1200),
      }));
      const reply = await sink(
        step(
          { phase: 'pairs', index: 1 },
          [...small, { id: 'big-2', blob: filler('big-2', 1_300_000) }],
          251
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
    // lease 7 (C): the job is cancelled while it runs; shouldStop says
    // CANCELLED and the worker stops with that reason.
    async (_sink, shouldStop) => {
      store.cancel(...ctl(C));
      return { code: 0, reader_result: { status: 'stopped', reason: shouldStop() } };
    },
    // lease 8 (D): a checkpoint, then the end-of-lease pause's record write
    // fails (an injected fault): the pause is refused STORAGE_UNAVAILABLE, the
    // catch-pause meets the same refusal and is logged; two pause calls.
    async (sink) => {
      await sink(step({ phase: 'pairs', index: 1 }, [{ id: 'evidence-d' }], 1));
      fault.next = 'record';
      return { code: 0, reader_result: { status: 'yielded', reason: 'YIELD' } };
    },
    // lease 9 (D, after the restart): the scheduler is stopped while the
    // lease runs; shouldStop says INTERRUPTED.
    async (_sink, shouldStop) => {
      scheduler.stop();
      return { code: 0, reader_result: { status: 'stopped', reason: shouldStop() } };
    },
  ];
  const bridge = fakeBridge(rec, script);
  const schedule = () => {
    scheduler = new ReaderScheduler({
      store,
      bridge,
      resolveSource: async () => ({ source: 'inert source text' }),
      resolveIdentity: async () => identity,
      leaseMs: LEASE_MS,
    });
    // pump()'s finally kicks a timer that would pump again on its own; the
    // test pumps explicitly instead, so every lease lands in the step that
    // caused it.
    t.mock.method(scheduler, 'kick', () => {});
  };
  schedule();
  const a = rec.step('create A', () => make('viewer-a', 'key-a'));
  const b = rec.step('create B', () => make('viewer-b', 'key-b'));
  rec.step('create A again (idempotent replay)', () => make('viewer-a', 'key-a'));
  const A = a.record.id,
    B = b.record.id;
  // Each job as the store holds it; a store that refuses reads (after the
  // write fault) is recorded as its refusal code.
  const inspect = (id) => {
    try {
      return store.inspect(id);
    } catch (error) {
      if (!error.code) throw error;
      return { refused: error.code };
    }
  };
  const jobs = () =>
    Object.fromEntries(
      [
        ['A', A],
        ['B', B],
        ['C', C],
        ['D', D],
      ]
        .filter(([, id]) => id)
        .map(([k, id]) => [k, inspect(id)])
    );
  const pump = (label) =>
    rec.stepAsync(label, async () => {
      await scheduler.pump();
      return { ...jobs(), active: scheduler.active };
    });
  await pump('pump 1: A checkpoints and yields');
  await pump('pump 2: B over quota (orphan page), stale pauses');
  await pump('pump 3: A worker error');
  rec.step('resume A', () => store.resume(...ctl(A), identity));
  await pump('pump 4: A bridge killed');
  rec.step('resume A again', () => store.resume(...ctl(A), identity));
  await pump('pump 5: A sink refusal');
  rec.step('resume A once more', () => store.resume(...ctl(A), identity));
  await pump('pump 6: A completes');
  await pump('pump 7: nothing queued');
  C = rec.step('create C', () => make('viewer-c', 'key-c')).record.id;
  await pump('pump 8: C cancelled while running');
  D = rec.step('create D', () => make('viewer-d', 'key-d')).record.id;
  await pump('pump 9: D end-of-lease pause write fails');
  rec.step('readiness after the write fault', () => {
    const out = scheduler.readiness();
    return { ...out, bytes: rec.usage(out.bytes) };
  });
  rec.step('restart', () => {
    store = spyStore(open(dir, gzip, now, clock, fault), rec);
    schedule();
    return { usage: rec.usage(store.usage), ...jobs() };
  });
  rec.step('resume D', () => store.resume(...ctl(D), identity));
  await pump('pump 10: D, scheduler stopped while running');
  rec.step('readiness', () => {
    const out = scheduler.readiness();
    return { ...out, bytes: rec.usage(out.bytes) };
  });
  return rec;
}

// ── the real-bridge half ─────────────────────────────────────────────────
// The scheduler through python_bridge.js itself. Its warm worker is this
// scripted Node process (spawned as `python workerPath`): it logs every frame
// it receives, sends a scenario's checkpoint frames one at a time, honours
// each ack, and ends with the scenario's final frame. The scenario is the
// lease's `source`.
const WORKER = (scenarios) => `import fs from 'node:fs';
import readline from 'node:readline';
const SCENARIOS = ${JSON.stringify(scenarios)};
const log = (o) => fs.appendFileSync(process.env.INERT_WORKER_LOG, JSON.stringify(o) + '\\n');
const send = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
let run = null;
const finish = (frame) => {
  send({ id: run.id, ...frame });
  run = null;
};
const next = () => {
  const s = run.scenario;
  if (run.at < s.checkpoints.length)
    send({ id: run.id, event: 'reader_checkpoint', data: s.checkpoints[run.at++] });
  else finish(s.final);
};
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const frame = JSON.parse(line);
  if (frame.event === 'reader_ack') {
    log({ ack: frame });
    if (!run) return;
    if (frame.continue) return next();
    return finish(
      frame.reason === 'COMPLETE'
        ? { code: 0, reader_result: { status: 'complete' } }
        : { code: 0, reader_result: { status: 'stopped', reason: frame.reason } }
    );
  }
  const { env, ...rest } = frame;
  log({ request: { ...rest, env_keys: Object.keys(env || {}).sort() } });
  run = { id: frame.id, scenario: SCENARIOS[frame.reader.source], at: 0 };
  next();
});
`;
const SCENARIOS = {
  // two checkpoints, each acknowledged to continue, then a yield
  yield: {
    checkpoints: [
      step({ phase: 'pairs', index: 1 }, [{ id: 'evidence-1', verdict: true }], 1),
      step({ phase: 'pairs', index: 2 }, [{ id: 'evidence-2' }], 2),
    ],
    final: { code: 0, reader_result: { status: 'yielded', reason: 'YIELD' } },
  },
  // the worker's own error reply: a code, an error_code and stderr
  error: {
    checkpoints: [],
    final: { code: 1, error_code: 'READER_ERROR', stderr: 'reader worker failed\n' },
  },
  // a checkpoint frame that names a provider call: the bridge kills the worker
  protocol: {
    checkpoints: [{ ...step({ phase: 'pairs', index: 1 }, [], 0), provider_calls: 1 }],
    final: { code: 0, reader_result: { status: 'complete' } },
  },
  // the job is cancelled before the worker runs: the ack carries CANCELLED
  cancel: {
    checkpoints: [step({ phase: 'pairs', index: 1 }, [{ id: 'evidence-c' }], 1)],
    final: { code: 0, reader_result: { status: 'complete' } },
  },
  // the done checkpoint: the ack says COMPLETE and the job completes
  done: {
    checkpoints: [step({ phase: 'done', done: true }, [{ id: 'evidence-3' }], 3, true)],
    final: { code: 0, reader_result: { status: 'complete' } },
  },
};
// N5: the reply the scheduler receives, without wall time.
function bridgeReply(result) {
  const { ms: _ms, tool_deadline, ...rest } = result;
  const { elapsed_ms: _elapsed, ...deadline } = tool_deadline || {};
  return { ...rest, tool_deadline: deadline };
}

async function runBridgeHalf(t) {
  const dir = setup(t);
  const { now, clock, tick } = steppedClocks(FIXED_DATE - 100_000);
  const rec = new Recorder(dir, false, tick);
  spyConsole(t, rec);
  const workerPath = path.join(dir, 'inert_reader_worker.mjs');
  const workerLog = path.join(dir, 'inert_reader_worker.log');
  fs.writeFileSync(workerPath, WORKER(SCENARIOS));
  fs.writeFileSync(workerLog, '');
  const real = createPythonBridge({
    python: process.execPath,
    harnessDir: dir,
    workerPath,
    harnessEnv: () => ({ PATH: process.env.PATH ?? '', INERT_WORKER_LOG: workerLog }),
    timeoutMs: 605_000,
    maxOutputBytes: 1024 * 1024,
  });
  t.after(() => real.internals.kill());
  let logged = 0;
  const bridge = {
    capacity: () => real.capacity(),
    async runReaderLease(req, options) {
      assert.equal(hasKeyDeep(req, 'discovery'), false, 'a bridge request names discovery');
      const entry = { request: rec.norm(req), timeoutMs: options.timeoutMs };
      rec.extras.bridge.push(entry);
      const result = await real.runReaderLease(req, options);
      entry.reply = rec.norm(bridgeReply(result));
      return result;
    },
  };
  let store;
  rec.step('construct', () => {
    store = spyStore(open(dir, false, now, clock), rec);
    return { usage: rec.usage(store.usage) };
  });
  const caps = new Map();
  const make = (viewer, key) => {
    const out = store.create({ viewer, idempotency_key: key, identity, request });
    caps.set(out.record.id, { capability: out.capability, viewer });
    return out.record.id;
  };
  const ctl = (id) => [id, caps.get(id).capability, caps.get(id).viewer];
  const ids = {};
  for (const name of ['A', 'B', 'C', 'D'])
    ids[name] = rec.step(`create ${name}`, () => make(`viewer-${name}`, `key-${name}`));
  const sources = ['yield', 'error', 'protocol', 'cancel', 'done'];
  const scheduler = new ReaderScheduler({
    store,
    bridge,
    resolveSource: async () => {
      const source = sources.shift();
      if (source === 'cancel') store.cancel(...ctl(ids.D));
      return { source };
    },
    resolveIdentity: async () => identity,
    leaseMs: LEASE_MS,
  });
  t.mock.method(scheduler, 'kick', () => {});
  const pump = (label) =>
    rec.stepAsync(label, async () => {
      await scheduler.pump();
      const lines = fs.readFileSync(workerLog, 'utf8').split('\n').filter(Boolean);
      for (const line of lines.slice(logged)) {
        const frame = JSON.parse(line);
        assert.equal(hasKeyDeep(frame, 'discovery'), false, 'a worker frame names discovery');
        rec.extras.worker.push(rec.norm(frame));
      }
      logged = lines.length;
      return {
        ...Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, store.inspect(id)])),
        active: scheduler.active,
      };
    });
  await pump('pump 1: A checkpoints twice and yields');
  await pump('pump 2: B worker error reply');
  await pump('pump 3: C provider call, the bridge kills the worker');
  await pump('pump 4: D cancelled, the ack stops it');
  await pump('pump 5: A completes');
  await pump('pump 6: nothing queued');
  return rec;
}

// ── the page packer at its limits ────────────────────────────────────────
// packReaderPages, which the scheduler's sink runs on every checkpoint, at
// exactly its two page limits and one past each: a page holds at most 250
// instances and 2 MiB, counted as 16 bytes plus each record's JSON bytes + 1,
// and one record past the page limit on its own is refused RESOURCE_LIMIT.
const PAGE_BYTES = 2 * 1024 * 1024;
// A record whose packed size (JSON bytes + 1) is exactly `size`.
function sized(id, size) {
  const base = Buffer.byteLength(JSON.stringify({ id, pad: '' })) + 1;
  const record = { id, pad: 'x'.repeat(size - base) };
  assert.equal(Buffer.byteLength(JSON.stringify(record)) + 1, size, `${id} is ${size} bytes`);
  return record;
}
function runPackHalf() {
  const steps = [];
  const pack = (op, records) => {
    let entry;
    try {
      entry = {
        op,
        value: packReaderPages(records).map((page) => ({
          instances: page.instances.length,
          first: page.instances[0].id,
          last: page.instances.at(-1).id,
        })),
      };
    } catch (error) {
      if (!error.code || error instanceof assert.AssertionError) throw error;
      entry = { op, error: { code: error.code, message: error.message } };
    }
    steps.push(entry);
  };
  const tiny = (n, label) => Array.from({ length: n }, (_, i) => sized(`${label}-${i}`, 64));
  pack('250 records: one page', tiny(250, 't'));
  pack('251 records: 250, then 1', tiny(251, 't'));
  pack('500 records: 250, 250', tiny(500, 't'));
  pack('two records filling a page exactly (16 + a + b = 2 MiB)', [
    sized('a', 1024),
    sized('b', PAGE_BYTES - 16 - 1024),
  ]);
  pack('two records one byte past a page (16 + a + b = 2 MiB + 1)', [
    sized('a', 1024),
    sized('b', PAGE_BYTES - 16 - 1024 + 1),
  ]);
  const many = Array.from({ length: 249 }, (_, i) => sized(`m-${i}`, 8000));
  const rest = PAGE_BYTES - 16 - 249 * 8000;
  pack('250 records filling a page exactly, then one more', [
    ...many,
    sized('m-249', rest),
    sized('m-250', 64),
  ]);
  pack('250 records one byte past a page, then one more', [
    ...many,
    sized('m-249', rest + 1),
    sized('m-250', 64),
  ]);
  pack('one record exactly at the page limit (16 + a = 2 MiB)', [sized('one', PAGE_BYTES - 16)]);
  pack('one record one byte past the page limit (RESOURCE_LIMIT)', [
    sized('one', PAGE_BYTES - 16 + 1),
  ]);
  return { steps };
}

// ── the catalog resolver ─────────────────────────────────────────────────
// createCatalogResolver over a minimal pinned catalog written here (one
// readable, non-collection reading, so no pronunciation asset and no method
// registry is read): the request identity it computes (contract_version,
// parser_version and every other field), the reading it resolves, its probe,
// and the scheduler leasing a job through it, so that identity is the one the
// store persists, the lease re-checks and the bridge receives; and a job whose
// stored identity differs, which the lease refuses STALE_READING.
function writeCatalog(catalog) {
  const write = (name, value) => {
    const file = path.join(catalog, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const bytes = JSON.stringify(value);
    fs.writeFileSync(file, bytes);
    return sha(bytes);
  };
  const source = {
    reading_unit_id: 'reading_inert',
    language: 'eng',
    availability: 'readable',
    source_path: 'corpus/inert/reading.txt',
    title: 'Inert reading',
    source_sha256: sha('inert source witness'),
    normalized_sha256: sha('A line that sings.\nA line that rings.'),
    work_id: 'work_inert',
    edition_id: 'edition_inert',
    lines: [
      { kind: 'lyric', text: 'A line that sings.' },
      { kind: 'lyric', text: 'A line that rings.' },
    ],
  };
  source.reading_revision = sha(canonicalJSON(source));
  const reading = `readings/${source.reading_unit_id}.json`;
  const artifacts = {
    [reading]: write(reading, source),
    'index.json': write('index.json', { readings: [] }),
  };
  const manifest = {
    parser_version: 'parser-inert',
    normalizer_version: 'normalizer-inert',
    artifacts,
  };
  manifest.snapshot_id = sha(canonicalJSON(manifest));
  write('manifest.json', manifest);
  return {
    contract_version: 1,
    snapshot_id: manifest.snapshot_id,
    reading_unit_id: source.reading_unit_id,
    reading_revision: source.reading_revision,
    declaration_set: {},
    requested_layers: ['sound'],
  };
}
async function runResolverHalf(t) {
  const dir = setup(t);
  const { now, clock, tick } = steppedClocks(FIXED_DATE - 100_000);
  const rec = new Recorder(dir, false, tick);
  spyConsole(t, rec);
  const catalog = path.join(dir, 'catalog');
  const readerRequest = writeCatalog(catalog);
  let store, resolver;
  rec.step('construct', () => {
    store = spyStore(open(dir, false, now, clock), rec);
    resolver = createCatalogResolver({
      directory: catalog,
      engineCommit: 'engine-inert',
      resourceFingerprint: 'resources-inert',
      readerScheme: 'v2',
      pronunciationRoot: path.join(dir, 'no-pronunciations'),
      methodsPath: path.join(dir, 'no-methods.json'),
    });
    return { usage: rec.usage(store.usage), resolver: Object.keys(resolver).sort() };
  });
  await rec.stepAsync('probe', () => resolver.probe());
  const resolved = await rec.stepAsync('resolveIdentity', () =>
    resolver.resolveIdentity(readerRequest)
  );
  await rec.stepAsync('prepareRequest (no collection: unchanged)', () =>
    resolver.prepareRequest(readerRequest)
  );
  await rec.stepAsync('resolveSource', () => resolver.resolveSource(readerRequest));
  await rec.stepAsync('resolveEntry', () => resolver.resolveEntry(readerRequest));
  const caps = new Map();
  const make = (viewer, key, id) => {
    const out = store.create({
      viewer,
      idempotency_key: key,
      identity: id,
      request: readerRequest,
    });
    caps.set(out.record.id, out.capability);
    return out.record.id;
  };
  const A = rec.step('create A with the resolved identity', () =>
    make('viewer-a', 'key-a', resolved)
  );
  const B = rec.step('create B with another engine commit', () =>
    make('viewer-b', 'key-b', { ...resolved, engine_commit: 'engine-other' })
  );
  const bridge = fakeBridge(rec, [
    async (sink) => {
      await sink(step({ phase: 'done', done: true }, [{ id: 'evidence-a' }], 1, true));
      return { code: 0, reader_result: { status: 'complete' } };
    },
  ]);
  const scheduler = new ReaderScheduler({
    store,
    bridge,
    resolveSource: resolver.resolveSource,
    resolveIdentity: resolver.resolveIdentity,
    readerScheme: resolver.readerScheme,
    leaseMs: LEASE_MS,
  });
  t.mock.method(scheduler, 'kick', () => {});
  const pump = (label) =>
    rec.stepAsync(label, async () => {
      await scheduler.pump();
      return { A: store.inspect(A), B: store.inspect(B), active: scheduler.active };
    });
  await pump('pump 1: A leased through the resolver, completes');
  await pump('pump 2: B identity differs (STALE_READING)');
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
test('inertness golden: the scheduler through the real bridge', async (t) =>
  check('bridge/plain', await runBridgeHalf(t)));
test('inertness golden: the page packer at its limits', () => check('pack/limits', runPackHalf()));
test('inertness golden: the catalog resolver and its request identity', async (t) =>
  check('resolver/plain', await runResolverHalf(t)));

test('the golden pins the record key sets and no discovery anywhere', () => {
  if (UPDATE) return;
  for (const [name, steps] of Object.entries(golden.halves)) {
    if (name === 'pack/limits') continue; // a pure function: no store, no records
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
      for (const frame of entry.worker || [])
        assert.equal(hasKeyDeep(frame, 'discovery'), false, `${name} ${entry.op}`);
    }
    assert.ok(keys.size > 0, `${name} records no record key set`);
  }
});

// Written as the repository's prettier formats it, so format:check holds the
// file as committed; the comparison above reads it parsed either way.
after(async () => {
  if (!UPDATE) return;
  const order = [
    'store/plain',
    'store/gzip',
    'scheduler/plain',
    'scheduler/gzip',
    'bridge/plain',
    'pack/limits',
    'resolver/plain',
  ];
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
