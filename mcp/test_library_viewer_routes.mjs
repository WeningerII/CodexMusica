// /library/v1 viewer routes (library_viewer_routes.js): the HttpOnly viewer
// cookie, per-viewer isolation, private no-store responses, strict routing,
// the request contract, and owner decision 4's limits at their boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { ReaderJobStore } from './reader_job_store.js';
import {
  libraryViewerRouter,
  libraryErrorHandler,
  isViewerPath,
  viewerOf,
  VIEWER_COOKIE,
} from './library_viewer_routes.js';
import { LIBRARY_LIMITS } from './ratelimit.js';
import { ExportStore, buildExportStore, zipChunks } from './library_exports.js';
import { reading, writeExport, readZip, sha } from './test_library_fixtures.mjs';
import { createAdmission } from './library_admission.js';
import { createReaderRouter, signReaderRequest } from './reader_routes.js';

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
const UNITS = {
  short: { availability: 'readable', revision: 'rev_short', lines: 20 },
  other: { availability: 'readable', revision: 'rev_other', lines: 30 },
  long: { availability: 'readable', revision: 'rev_long', lines: 22_795 },
  long2: { availability: 'readable', revision: 'rev_long2', lines: 6_000 },
  held: { availability: 'held', revision: 'rev_held', lines: 10 },
};

async function setup(t, { now: clock, router = {}, identityDelay = 0, bridge = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-viewer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let now = clock ?? 1_000_000;
  const store = new ReaderJobStore({ directory: dir, now: () => now });
  const kicks = [];
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, bytes) => {
        req.readerRawBody = Buffer.from(bytes);
      },
    })
  );
  // A real await before store.create, as production's filesystem reads are,
  // so concurrent requests interleave there.
  const resolveIdentity = async (r) => {
    if (identityDelay) await new Promise((resolve) => setTimeout(resolve, identityDelay));
    // The production identity's fields (reader_scheduler.resolveIdentity).
    return {
      contract_version: 1,
      snapshot_id: r.snapshot_id,
      reading_unit_id: r.reading_unit_id,
      reading_revision: r.reading_revision,
      engine_commit: 'engine-1',
      resource_fingerprint: 'fp-1',
      declaration_hash: 'none',
      requested_layers: r.requested_layers,
    };
  };
  const unitOf = (id) => UNITS[id] ?? null;
  // One admission state shared with the private bridge, as server_http.js wires it.
  const admission = createAdmission({
    store,
    unitOf,
    now: () => now,
    fail: (code, message, status, extra) =>
      Object.assign(new Error(message), { code, status, extra }),
  });
  app.use(
    '/library/v1',
    libraryViewerRouter({
      store,
      scheduler: { kick: () => kicks.push(1) },
      prepareRequest: async (request) => request,
      resolveIdentity,
      unitOf,
      snapshotId: () => 'a'.repeat(64),
      ipOf: (req) => req.headers['x-test-ip'] || 'ip-1',
      now: () => now,
      admission,
      ...router,
    })
  );
  app.use('/library/v1', libraryErrorHandler);
  if (bridge)
    app.use(
      createReaderRouter({
        store,
        scheduler: { kick: () => kicks.push(1) },
        secret: BRIDGE_SECRET,
        site: 'library-test',
        resolveIdentity,
        admission,
      })
    );
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/library/v1`;
  // A browser: its own cookie jar and network address.
  const browser = (ip = 'ip-1') => {
    let cookie = null;
    const call = async (method, p, { body, headers = {} } = {}) => {
      const res = await fetch(base + p, {
        method,
        headers: {
          'x-test-ip': ip,
          ...(cookie ? { cookie: `${VIEWER_COOKIE}=${cookie}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = /__Host-cm_library=([^;]+)/.exec(set)[1];
      const text = await res.text();
      return { res, status: res.status, body: text ? JSON.parse(text) : null, set };
    };
    return {
      call,
      base,
      headers: () => ({
        'x-test-ip': ip,
        ...(cookie ? { cookie: `${VIEWER_COOKIE}=${cookie}` } : {}),
      }),
      get cookie() {
        return cookie;
      },
      analyse: (unit = 'short', key = `k-${Math.random()}`, extra = {}) =>
        call('POST', '/analyses', {
          body: {
            contract_version: 1,
            reading_unit_id: unit,
            reading_revision: UNITS[unit]?.revision ?? 'rev_x',
            idempotency_key: key,
            ...extra,
          },
        }),
    };
  };
  // The old Site's signed private bridge.
  const bridgeCall = async (
    method,
    route,
    {
      input,
      viewer = 'site-viewer',
      idempotency = '',
      job = '',
      capability = '',
      attempt = '',
      generation = '',
    } = {}
  ) => {
    const body = input === undefined ? '' : JSON.stringify(input);
    const res = await fetch(base.replace(/\/library\/v1$/, '') + route, {
      method,
      headers: {
        ...signReaderRequest({
          secret: BRIDGE_SECRET,
          method,
          path: route,
          body,
          site: 'library-test',
          viewer,
          job,
          capability,
          attempt: String(attempt),
          generation: String(generation),
          idempotency,
        }),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
    });
    return { status: res.status, body: await res.json() };
  };
  const bridgeCreate = (unit, viewer, key) =>
    bridgeCall('POST', '/internal/reader/jobs', {
      viewer,
      idempotency: key,
      input: {
        contract_version: 1,
        snapshot_id: 'a'.repeat(64),
        reading_unit_id: unit,
        reading_revision: UNITS[unit].revision,
        declaration_set: {},
        requested_layers: ['sound'],
      },
    });
  return {
    store,
    kicks,
    browser,
    bridgeCreate,
    bridgeCall,
    admission,
    base,
    advance: (ms) => (now += ms),
  };
}
const BRIDGE_SECRET = 'b'.repeat(48);

test('POST mints the HttpOnly cookie, the job carries no capability, reads slide the cookie', async (t) => {
  const { browser, kicks } = await setup(t);
  const a = browser();
  const created = await a.analyse('short', 'k1');
  assert.equal(created.status, 202);
  assert.match(
    created.set,
    /^__Host-cm_library=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000$/
  );
  assert.equal(created.res.headers.get('cache-control'), 'private, no-store');
  assert.equal('capability' in created.body, false);
  assert.equal(JSON.stringify(created.body).includes('capability'), false);
  assert.equal(
    created.body.job.identity.snapshot_id,
    'a'.repeat(64),
    'the server filled its snapshot'
  );
  assert.equal(kicks.length, 1);
  const id = created.body.job.id;
  const read = await a.call('GET', `/jobs/${id}`);
  assert.equal(read.status, 200);
  assert.ok(read.set, 'a viewer read slides Max-Age');
  // An exact retry is 200 with the same job, and mints nothing new.
  const cookie = a.cookie;
  const retry = await a.analyse('short', 'k1');
  assert.equal(retry.status, 200);
  assert.equal(retry.body.job.id, id);
  assert.equal(a.cookie, cookie);
});

test("another viewer's job, or no cookie, is 404; a GET never mints", async (t) => {
  const { browser } = await setup(t);
  const a = browser();
  const id = (await a.analyse()).body.job.id;
  const b = browser();
  const other = await b.call('GET', `/jobs/${id}`);
  assert.equal(other.status, 404);
  assert.equal(other.set, null, 'no cookie is minted by a GET');
  assert.equal(other.res.headers.get('cache-control'), 'private, no-store');
  assert.equal((await b.call('GET', '/jobs/..%2Fetc')).status, 404);
});

test('the request contract: no client snapshot, a key, JSON only, known units', async (t) => {
  const { browser } = await setup(t);
  const a = browser();
  assert.equal((await a.analyse('short', 'k', { snapshot_id: 'b'.repeat(64) })).status, 400);
  assert.equal((await a.analyse('short', '')).status, 400);
  const notJson = await a.call('POST', '/analyses', {
    headers: { 'content-type': 'text/plain' },
  });
  assert.equal(notJson.status, 415);
  assert.equal((await a.analyse('nope')).status, 404);
  const held = await a.analyse('held');
  assert.equal(held.status, 403);
  assert.equal(held.body.error.code, 'READING_UNAVAILABLE');
  const stale = await a.analyse('short', 'k2', { reading_revision: 'rev_old' });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'STALE_READING');
  assert.equal(stale.body.error.current_revision, 'rev_short');
  assert.equal((await a.analyse('short', 'k3', { requested_layers: ['bogus'] })).status, 400);
});

test('two outstanding per viewer, as the old Site allowed', async (t) => {
  const { browser } = await setup(t);
  const a = browser();
  assert.equal((await a.analyse()).status, 202);
  assert.equal((await a.analyse()).status, 202);
  const third = await a.analyse();
  assert.equal(third.status, 429);
});

test('per-address ceiling: 3 viewers x 2 succeed; with 6 viewers x 2 running, the 7th is refused', async (t) => {
  const { browser } = await setup(t);
  const viewers = Array.from({ length: 7 }, () => browser('shared-nat'));
  for (const v of viewers.slice(0, 3)) {
    assert.equal((await v.analyse()).status, 202);
    assert.equal((await v.analyse()).status, 202);
  }
  for (const v of viewers.slice(3, 6)) {
    assert.equal((await v.analyse()).status, 202);
    assert.equal((await v.analyse()).status, 202);
  }
  const seventh = await viewers[6].analyse();
  assert.equal(seventh.status, 429);
  assert.equal(seventh.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(seventh.res.headers.get('retry-after')) >= 1);
  assert.equal((await browser('elsewhere').analyse()).status, 202, 'another address is unaffected');
  assert.equal(LIBRARY_LIMITS.outstandingPerIp, 12);
});

test('creates: 30 an hour per viewer, the 31st waits for Retry-After', async (t) => {
  const { browser, advance } = await setup(t);
  const a = browser();
  for (let i = 0; i < 30; i++) {
    const r = await a.analyse('short', `c${i}`);
    assert.equal(r.status, 202, `create ${i}`);
    await a.call('DELETE', `/jobs/${r.body.job.id}`, { headers: { 'Idempotency-Key': `d${i}` } });
  }
  const over = await a.analyse('short', 'c30');
  assert.equal(over.status, 429);
  assert.equal(over.body.error.code, 'RATE_LIMITED');
  advance(3_600_000);
  assert.equal((await a.analyse('short', 'c31')).status, 202);
});

test('cookie mints: 30 new browsers an hour per address, the 31st waits', async (t) => {
  const { browser } = await setup(t);
  for (let i = 0; i < 30; i++) {
    const b = browser('school');
    const r = await b.analyse();
    assert.equal(r.status, 202, `browser ${i}`);
    await b.call('DELETE', `/jobs/${r.body.job.id}`, { headers: { 'Idempotency-Key': 'd' } });
  }
  const late = await browser('school').analyse();
  assert.equal(late.status, 429);
  assert.equal(late.set, null, 'no cookie is minted when refused');
});

test('long readings: one long job service-wide; short readings are unaffected', async (t) => {
  const { browser } = await setup(t);
  assert.equal((await browser('a').analyse('long')).status, 202);
  const second = await browser('b').analyse('long2');
  assert.equal(second.status, 429);
  assert.equal(second.body.error.code, 'LONG_READING_BUSY');
  assert.ok(Number(second.res.headers.get('retry-after')) >= 1);
  assert.equal((await browser('c').analyse('short')).status, 202);
});

test('controls need an Idempotency-Key; routing is strict; delete then read is 410', async (t) => {
  const { browser } = await setup(t);
  const a = browser();
  const id = (await a.analyse()).body.job.id;
  assert.equal((await a.call('POST', `/jobs/${id}/cancel`)).status, 400);
  const cancelled = await a.call('POST', `/jobs/${id}/cancel`, {
    headers: { 'Idempotency-Key': 'x1' },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.job.state, 'cancelled');
  assert.equal((await a.call('GET', `/jobs/${id}/cancel`)).status, 404, 'no GET-as-read quirk');
  assert.equal((await a.call('PUT', `/jobs/${id}`)).status, 404);
  const resumed = await a.call('POST', `/jobs/${id}/resume`, {
    headers: { 'Idempotency-Key': 'x2' },
  });
  assert.equal(resumed.status, 202);
  assert.equal(
    (await a.call('DELETE', `/jobs/${id}`, { headers: { 'Idempotency-Key': 'x3' } })).status,
    200
  );
  assert.equal((await a.call('GET', `/jobs/${id}`)).status, 410);
});

test('controls: 120 an hour per viewer', async (t) => {
  const { browser } = await setup(t);
  const a = browser();
  const id = (await a.analyse()).body.job.id;
  let last;
  for (let i = 0; i <= LIBRARY_LIMITS.controlsPerViewerPerHour; i++)
    last = await a.call('POST', `/jobs/${id}/cancel`, { headers: { 'Idempotency-Key': `k${i}` } });
  assert.equal(last.status, 429);
});

test('evidence reads are private, re-hashed and carry X-Library-SHA256', async (t) => {
  const { browser, store } = await setup(t);
  const a = browser();
  const id = (await a.analyse()).body.job.id;
  const lease = store.lease(id);
  store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: { phase: 'done', done: true },
    pages: [{ instances: [{ id: 'e1', verdict: true }] }],
    progress: { candidates: 1 },
    coverage,
  });
  store.complete(lease.id, lease.attempt, lease.fence, {
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
  const job = (await a.call('GET', `/jobs/${id}`)).body.job;
  const manifest = await a.call('GET', `/jobs/${id}/manifests/${job.manifest_hash}`);
  assert.equal(manifest.status, 200);
  assert.equal(manifest.res.headers.get('x-library-sha256'), job.manifest_hash);
  assert.equal(manifest.res.headers.get('cache-control'), 'private, no-store');
  const refs = await a.call('GET', `/jobs/${id}/manifests/${job.manifest_hash}/pages?limit=10`);
  assert.equal(refs.status, 200);
  const sha = refs.body.page_refs[0].sha256;
  const page = await a.call('GET', `/jobs/${id}/pages/${sha}?manifest=${job.manifest_hash}`);
  assert.equal(page.status, 200);
  assert.equal(page.res.headers.get('x-library-sha256'), sha);
  assert.equal(
    (await a.call('GET', `/jobs/${id}/manifests/${job.manifest_hash}/pages?limit=251`)).status,
    400
  );
  assert.equal(
    (await browser().call('GET', `/jobs/${id}/pages/${sha}?manifest=${job.manifest_hash}`)).status,
    404
  );
});

test('credentialed CORS applies to the viewer paths only; the viewer id is a hash', () => {
  assert.equal(isViewerPath('/library/v1/analyses'), true);
  assert.equal(isViewerPath('/library/v1/jobs/reading_x'), true);
  assert.equal(isViewerPath('/library/v1/jobs?x'), true);
  assert.equal(isViewerPath('/library/v1/search?q=x'), false);
  assert.equal(isViewerPath('/library/v1/metadata/x'), false);
  assert.equal(isViewerPath('/library/v1/jobsx'), false);
  assert.match(viewerOf('v'.repeat(43)), /^lv1:[a-f0-9]{64}$/);
});

test('creates: 120 an hour per address across viewers, the 121st waits', async (t) => {
  const { browser } = await setup(t);
  const viewers = Array.from({ length: 5 }, () => browser('office'));
  let n = 0;
  for (const v of viewers.slice(0, 4))
    for (let i = 0; i < 30; i++, n++) {
      const r = await v.analyse('short', `o${n}`);
      assert.equal(r.status, 202, `create ${n}`);
      await v.call('DELETE', `/jobs/${r.body.job.id}`, { headers: { 'Idempotency-Key': `d${n}` } });
    }
  const over = await viewers[4].analyse('short', 'o-last');
  assert.equal(over.status, 429);
  assert.equal(over.body.error.code, 'RATE_LIMITED');
});

test('job reads: 600 a minute per address', async (t) => {
  const { browser, advance } = await setup(t);
  const a = browser();
  const id = (await a.analyse()).body.job.id;
  for (let i = 0; i < 600; i++) assert.equal((await a.call('GET', `/jobs/${id}`)).status, 200);
  assert.equal((await a.call('GET', `/jobs/${id}`)).status, 429);
  advance(60_000);
  assert.equal((await a.call('GET', `/jobs/${id}`)).status, 200);
});

// Admission is checked and held where a job enters the queue
// (library_admission.js): concurrent requests cannot share a slot, a resume
// is admitted like a create, and the private bridge shares the long rule.
test('two concurrent creates cannot both take the last per-address slot', async (t) => {
  const { browser } = await setup(t, { identityDelay: 30 });
  for (let i = 0; i < 11; i++)
    assert.equal((await browser('nat').analyse()).status, 202, `job ${i}`);
  const [a, b] = await Promise.all([browser('nat').analyse(), browser('nat').analyse()]);
  assert.deepEqual([a.status, b.status].sort(), [202, 429]);
  assert.equal([a, b].find((r) => r.status === 429).body.error.code, 'RATE_LIMITED');
});

test('two concurrent long creates from different addresses: one runs, one waits', async (t) => {
  const { browser } = await setup(t, { identityDelay: 30 });
  const [a, b] = await Promise.all([browser('a').analyse('long'), browser('b').analyse('long2')]);
  assert.deepEqual([a.status, b.status].sort(), [202, 429]);
  assert.equal([a, b].find((r) => r.status === 429).body.error.code, 'LONG_READING_BUSY');
});

test('a resume is admitted like a create: the per-address ceiling', async (t) => {
  const { browser } = await setup(t);
  const owner = browser('nat');
  const a = await owner.analyse();
  const id = a.body.job.id;
  await owner.call('POST', `/jobs/${id}/cancel`, { headers: { 'Idempotency-Key': 'c' } });
  for (let i = 0; i < 12; i++)
    assert.equal((await browser('nat').analyse()).status, 202, `fill ${i}`);
  const resumed = await owner.call('POST', `/jobs/${id}/resume`, {
    headers: { 'Idempotency-Key': 'r' },
  });
  assert.equal(resumed.status, 429);
  assert.equal(resumed.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(resumed.res.headers.get('retry-after')) >= 1);
});

test('a resume is admitted like a create: one long reading service-wide', async (t) => {
  const { browser } = await setup(t);
  const a = browser('a');
  const first = await a.analyse('long');
  const id = first.body.job.id;
  await a.call('POST', `/jobs/${id}/cancel`, { headers: { 'Idempotency-Key': 'c' } });
  assert.equal((await browser('b').analyse('long2')).status, 202);
  const resumed = await a.call('POST', `/jobs/${id}/resume`, {
    headers: { 'Idempotency-Key': 'r' },
  });
  assert.equal(resumed.status, 429);
  assert.equal(resumed.body.error.code, 'LONG_READING_BUSY');
});

test('the private bridge shares the long-reading rule, in both orders', async (t) => {
  {
    const { browser, bridgeCreate } = await setup(t, { bridge: true });
    assert.equal((await browser('a').analyse('long')).status, 202);
    const refused = await bridgeCreate('long2', 'site-viewer', 'k1');
    assert.equal(refused.status, 429);
    assert.equal(refused.body.error.code, 'LONG_READING_BUSY');
    assert.equal((await bridgeCreate('short', 'site-viewer', 'k2')).status, 202);
  }
  {
    const { browser, bridgeCreate } = await setup(t, { bridge: true });
    assert.equal((await bridgeCreate('long', 'site-viewer', 'k1')).status, 202);
    const refused = await browser('a').analyse('long2');
    assert.equal(refused.status, 429);
    assert.equal(refused.body.error.code, 'LONG_READING_BUSY');
  }
});

test('departed addresses are forgotten, not kept forever', async (t) => {
  const { browser, admission, store } = await setup(t);
  const a = browser('passing-through');
  const r = await a.analyse();
  assert.ok(admission.jobsByIp.has('passing-through'));
  await a.call('DELETE', `/jobs/${r.body.job.id}`, { headers: { 'Idempotency-Key': 'd' } });
  assert.equal(store.inspect(r.body.job.id).state, 'deleted');
  await browser('someone-else').analyse();
  assert.equal(admission.jobsByIp.has('passing-through'), false);
  assert.equal(admission.reservations.size, 0, 'no reservation outlives its request');
});

test('a body that does not parse answers the JSON, uncached refusal', async (t) => {
  const { base } = await setup(t);
  const res = await fetch(base + '/analyses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"contract_version": 1,',
  });
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.ok((await res.json()).error.code);
});

test('a private-bridge resume shares the long-reading rule, in both orders', async (t) => {
  {
    // Bridge long A cancelled; public long B runs; the bridge resumes A: refused.
    const { browser, bridgeCreate, bridgeCall } = await setup(t, { bridge: true });
    const a = await bridgeCreate('long', 'site-viewer', 'k1');
    assert.equal(a.status, 202);
    const binding = {
      job: a.body.job.id,
      capability: a.body.capability,
      attempt: 0,
      generation: 0,
    };
    const route = `/internal/reader/jobs/${a.body.job.id}`;
    assert.equal(
      (await bridgeCall('POST', `${route}/cancel`, { ...binding, idempotency: 'c' })).status,
      200
    );
    assert.equal((await browser('x').analyse('long2')).status, 202);
    const resumed = await bridgeCall('POST', `${route}/resume`, { ...binding, idempotency: 'r' });
    assert.equal(resumed.status, 429);
    assert.equal(resumed.body.error.code, 'LONG_READING_BUSY');
  }
  {
    // Public long A cancelled; bridge long B runs; the public route resumes A: refused.
    const { browser, bridgeCreate } = await setup(t, { bridge: true });
    const owner = browser('x');
    const a = await owner.analyse('long');
    await owner.call('POST', `/jobs/${a.body.job.id}/cancel`, {
      headers: { 'Idempotency-Key': 'c' },
    });
    assert.equal((await bridgeCreate('long2', 'site-viewer', 'k1')).status, 202);
    const resumed = await owner.call('POST', `/jobs/${a.body.job.id}/resume`, {
      headers: { 'Idempotency-Key': 'r' },
    });
    assert.equal(resumed.status, 429);
    assert.equal(resumed.body.error.code, 'LONG_READING_BUSY');
  }
});

// ── analysis exports ──────────────────────────────────────────────────────
function exportStoreOf(t, revision = 'rev_short') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-analysis-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeExport(path.join(root, 'export'), [
    reading('short', { revision }),
    reading('other', { revision: 'rev_other' }),
  ]);
  buildExportStore(path.join(root, 'export'), path.join(root, 'store'));
  return new ExportStore(path.join(root, 'store'));
}
const METHODS = Buffer.from('{"methods":"as analysed"}\n');
const SCHEMA = Buffer.from('{"schema":"as analysed"}\n');
async function completedJob(env, browser, unit = 'short') {
  const id = (await browser.analyse(unit)).body.job.id;
  const lease = env.store.lease(id);
  env.store.commitCheckpoint(lease.id, lease.attempt, lease.fence, {
    cursor: { phase: 'done', done: true },
    pages: [
      { instances: [{ id: 'e1', verdict: true }] },
      { instances: [{ id: 'e2', verdict: false }] },
    ],
    progress: { candidates: 2 },
    coverage,
  });
  env.store.complete(lease.id, lease.attempt, lease.fence, {
    exhausted: true,
    census_reconciled: true,
    coverage,
    summary: {
      coverage,
      counters: { evidence_records: 2 },
      methods: [{ method_id: 'sound', coverage: 'answered' }],
    },
    provider_calls: 0,
  });
  return (await browser.call('GET', `/jobs/${id}`)).body.job;
}
async function download(browser, job) {
  const res = await fetch(browser.base + `/jobs/${job.id}/exports/${job.manifest_hash}.zip`, {
    headers: browser.headers(),
  });
  return { res, bytes: Buffer.from(await res.arrayBuffer()) };
}

test('an analysis export: the reading byte-identical to a json selection, then provenance and ANALYSIS/', async (t) => {
  const exports = exportStoreOf(t);
  let definitions = { methods: METHODS, result_schema: SCHEMA };
  const env = await setup(t, {
    router: { exports, definitions: () => definitions, resourceFingerprint: () => 'fp-1' },
  });
  const a = env.browser();
  const job = await completedJob(env, a);
  definitions = { methods: Buffer.from('{"methods":"a later image"}'), result_schema: SCHEMA };
  const head = await fetch(a.base + `/jobs/${job.id}/exports/${job.manifest_hash}.zip`, {
    method: 'HEAD',
    headers: a.headers(),
  });
  assert.equal(head.status, 200);
  const { res, bytes } = await download(a, job);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(bytes.length, Number(head.headers.get('content-length')));
  const entries = readZip(bytes);
  const names = entries.map((e) => e.name);
  const selection = readZip(
    Buffer.concat([
      ...zipChunks(
        exports.directory,
        exports.layout(['short'], 'json'),
        'json',
        exports.snapshotId
      ),
    ])
  ).filter((e) => !['PROVENANCE.json', 'ATTRIBUTION.txt'].includes(e.name));
  assert.deepEqual(
    entries.slice(0, selection.length).map((e) => [e.name, sha(e.data)]),
    selection.map((e) => [e.name, sha(e.data)]),
    "the reading entries are exactly the selection export's"
  );
  assert.deepEqual(names.slice(selection.length), [
    'PROVENANCE.json',
    'ATTRIBUTION.txt',
    'ANALYSIS/MANIFEST.json',
    'ANALYSIS/REQUEST.json',
    'ANALYSIS/METHODS.json',
    'ANALYSIS/RESULT_SCHEMA.json',
    'ANALYSIS/EVIDENCE/00000000.json',
    'ANALYSIS/EVIDENCE/00000001.json',
  ]);
  const byName = Object.fromEntries(entries.map((e) => [e.name, e.data]));
  const provenance = JSON.parse(byName['PROVENANCE.json']);
  assert.equal(provenance.scope, 'whole_reading_unit_analysis');
  assert.equal(provenance.analysis_manifest_hash, job.manifest_hash);
  assert.equal(provenance.snapshot_id, 'a'.repeat(64), "the job's own snapshot");
  assert.equal(sha(byName['ANALYSIS/MANIFEST.json']), job.manifest_hash);
  assert.deepEqual(
    byName['ANALYSIS/METHODS.json'],
    METHODS,
    "the retained definitions, not the later image's"
  );
  assert.equal(JSON.parse(byName['ANALYSIS/REQUEST.json']).reading_unit_id, 'short');
  assert.equal(JSON.parse(byName['ANALYSIS/EVIDENCE/00000001.json']).instances[0].id, 'e2');
});

test('analysis export refusals are attachments: changed reading, missing definitions, another viewer', async (t) => {
  const changed = await setup(t, {
    router: { exports: exportStoreOf(t, 'rev_newer'), resourceFingerprint: () => 'fp-1' },
  });
  const a = changed.browser();
  const job = await completedJob(changed, a);
  const refused = await download(a, job);
  assert.equal(refused.res.status, 409);
  assert.equal(
    refused.res.headers.get('content-disposition'),
    'attachment; filename="library-download-error.txt"'
  );
  assert.equal(JSON.parse(refused.bytes).error.code, 'EXPORT_READING_CHANGED');

  // A job created without retained definitions: allowed only on the same fingerprint.
  let fingerprint = 'fp-other';
  let current = null; // none when the job is created
  const env = await setup(t, {
    router: {
      exports: exportStoreOf(t),
      definitions: () => current,
      resourceFingerprint: () => fingerprint,
    },
  });
  const b = env.browser();
  const bare = await completedJob(env, b);
  current = { methods: METHODS, result_schema: SCHEMA };
  const unavailable = await download(b, bare);
  assert.equal(unavailable.res.status, 409);
  assert.equal(JSON.parse(unavailable.bytes).error.code, 'EXPORT_DEFINITIONS_UNAVAILABLE');
  fingerprint = 'fp-1'; // the job's own fingerprint: the current definitions are the ones it ran with
  const allowed = await download(b, bare);
  assert.equal(allowed.res.status, 200);
  assert.deepEqual(
    readZip(allowed.bytes).find((e) => e.name === 'ANALYSIS/METHODS.json').data,
    METHODS
  );
  const other = await download(env.browser(), bare);
  assert.equal(other.res.status, 404);
  assert.equal(
    other.res.headers.get('content-disposition'),
    'attachment; filename="library-download-error.txt"'
  );
});
