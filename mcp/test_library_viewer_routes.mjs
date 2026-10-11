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
  isViewerPath,
  viewerOf,
  VIEWER_COOKIE,
} from './library_viewer_routes.js';
import { LIBRARY_LIMITS } from './ratelimit.js';

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

async function setup(t, { now: clock } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-viewer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let now = clock ?? 1_000_000;
  const store = new ReaderJobStore({ directory: dir, now: () => now });
  const kicks = [];
  const app = express();
  app.use(express.json());
  app.use(
    '/library/v1',
    libraryViewerRouter({
      store,
      scheduler: { kick: () => kicks.push(1) },
      prepareRequest: async (request) => request,
      resolveIdentity: async (r) => ({
        snapshot: r.snapshot_id,
        revision: r.reading_revision,
        engine: 'e',
        declarations: 'none',
      }),
      unitOf: (id) => UNITS[id] ?? null,
      snapshotId: () => 'a'.repeat(64),
      ipOf: (req) => req.headers['x-test-ip'] || 'ip-1',
      now: () => now,
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
  return {
    store,
    kicks,
    browser,
    advance: (ms) => (now += ms),
  };
}

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
    created.body.job.identity.snapshot,
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
