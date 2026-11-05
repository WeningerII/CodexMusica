#!/usr/bin/env node
'use strict';
// #661: real mounted analysis chunk, fake browser clock and viewer transport.
// Run: node --test scripts/check_library_poll_schedule.js
// Source contract: src/library/analysis.js schedulePoll/tick/onVisibility
// (main blob 128dea504f2736d6324a78f6906e9e6624a2bfea, lines 1549–1595).
// At exactly 120 s the next delay is still 3 s; >60 s hidden reauthorizes
// immediately. A hidden tick consumes its timer without calling the API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { createHash, webcrypto } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../src/library/analysis.js'), 'utf8');
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

async function fixture(t, initial = { state: 'queued' }) {
  const dom = new JSDOM('<div id="surface-library"><main></main></div>', {
    url: 'https://example.test/#library/read/poll-test',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  w.CMLyricTokens = require('../src/lyric-tokens.js');
  // Real hashes with an immediately resolved promise: no worker-pool timing
  // races in fake-clock evidence tests (production still uses Web Crypto).
  Object.defineProperty(w, 'crypto', {
    value: {
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
      subtle: {
        digest: async (algorithm, bytes) =>
          Uint8Array.from(
            createHash(algorithm.toLowerCase().replace('-', '')).update(bytes).digest()
          ).buffer,
      },
    },
  });
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  const announcements = [];
  w.libraryAnnounce = (message) => announcements.push(message);
  // Zero would collide with pollStarted/hiddenAt's unset sentinel.
  let now = 1_000_000,
    nextTimer = 0,
    hidden = false,
    nextJob = 0;
  const timers = new Map(),
    requests = [],
    jobs = new Map();
  w.Date.now = () => now;
  w.setTimeout = (fn, delay) => {
    const id = ++nextTimer;
    timers.set(id, { fn, due: now + delay });
    return id;
  };
  w.clearTimeout = (id) => timers.delete(id);
  Object.defineProperty(w.document, 'hidden', { get: () => hidden });
  w.esc = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;');
  w.icon = w.showToast = w.uiDownload = () => '';
  w.uiEmptyState = () => '';
  w.uiTabIndex = () => -1;
  const chunk = w.eval(`(function () {${source}\n})()`);
  const container = w.document.querySelector('main');
  let respond = (id) => ({ job: { ...jobs.get(id) } });
  let createError = null;
  let evidence = async (url) => {
    throw Error(`unexpected evidence request ${url}`);
  };
  const lib = {
    json: async () => ({ methods: [] }),
    device: { read: async (_key, fallback) => fallback, write: async () => {} },
    viewer: async (url, opts = {}) => {
      requests.push({ url, method: opts.method || 'GET', at: now });
      if (url === '/analyses') {
        if (createError) throw createError;
        const job = { id: `job-${++nextJob}`, ...initial };
        jobs.set(job.id, job);
        return { job: { ...job } };
      }
      const control = /^\/jobs\/(job-\d+)\/(cancel|resume)$/.exec(url);
      if (control) {
        jobs.get(control[1]).state = control[2] === 'cancel' ? 'cancelled' : 'running';
        return { job: { ...jobs.get(control[1]) } };
      }
      if (opts.method === 'DELETE') return {};
      if (url.includes('/manifests/') || url.includes('/pages/')) return evidence(url, opts);
      const match = /^\/jobs\/(job-\d+)$/.exec(url);
      assert.ok(match, `unexpected viewer request ${url}`);
      return respond(match[1]);
    },
  };
  const input = {
    reading: { reading_unit_id: 'poll-test', reading_revision: 'revision', lines: [] },
    lib,
  };
  let handle = chunk.mount(container, input);
  t.after(() => {
    handle.destroy();
    w.close();
  });
  await settle();
  const f = {
    container,
    w,
    announcements,
    timers,
    requests,
    jobs,
    get handle() {
      return handle;
    },
    get now() {
      return now;
    },
    get reads() {
      return requests.filter((r) => r.method === 'GET' && /^\/jobs\/job-\d+$/.test(r.url));
    },
    get delay() {
      assert.equal(timers.size, 1, 'exactly one poll timer');
      return [...timers.values()][0].due - now;
    },
    setCreateError(error) {
      createError = error;
    },
    setEvidence(fn) {
      evidence = fn;
    },
    async click(act, focus = false) {
      const button = container.querySelector(`[data-act="${act}"]`);
      assert.ok(button && !button.disabled, `${act} is available`);
      if (focus) button.focus();
      button.click();
      await settle();
    },
    async withEvidence() {
      const identity = {};
      const manifest = {
        job_id: 'job-1',
        identity_hash: createHash('sha256').update('{}').digest('hex'),
        partial: true,
        coverage: {},
      };
      const bytes = Buffer.from(JSON.stringify(manifest));
      const hash = createHash('sha256').update(bytes).digest('hex');
      Object.assign(jobs.get('job-1'), { identity, manifest_hash: hash });
      evidence = async (url) =>
        url.includes('/pages?')
          ? { manifest_hash: hash, page_refs: [] }
          : { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
      await handle.activate();
      assert.ok(
        container.querySelector('[data-act="export"]'),
        'real verified manifest exposes Export'
      );
    },
    respond(fn) {
      respond = fn;
    },
    async advance(ms) {
      const end = now + ms;
      let count = 0;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) break;
        assert.ok(++count < 1000, 'bounded fake-clock work');
        now = next[1].due;
        timers.delete(next[0]);
        next[1].fn();
        await settle();
      }
      now = end;
      await settle();
    },
    async visible(value) {
      hidden = !value;
      w.document.dispatchEvent(new w.Event('visibilitychange'));
      await settle();
    },
    async create() {
      const button = container.querySelector('[data-act="analyze"]');
      assert.ok(button && !button.disabled, 'analysis action is available');
      button.click();
      await settle();
      assert.equal(requests.at(-1).url, '/analyses');
    },
    async remount() {
      handle = chunk.mount(container, input);
      await settle();
    },
  };
  await f.create();
  return f;
}

test('3 s polls include exactly 120 s; only subsequent scheduling backs off to 15 s', async (t) => {
  const f = await fixture(t);
  const start = f.now;
  assert.equal(f.delay, 3000);
  await f.advance(2999);
  assert.equal(f.reads.length, 0);
  await f.advance(1);
  assert.deepEqual(
    f.reads.map((r) => r.at - start),
    [3000]
  );
  await f.advance(117000);
  assert.equal(f.reads.length, 40);
  assert.equal(f.delay, 3000, 'strictly greater than 120 s, not greater-or-equal');
  await f.advance(3000);
  assert.equal(f.reads.length, 41);
  assert.equal(f.delay, 15000);
  await f.advance(14999);
  assert.equal(f.reads.length, 41);
  await f.advance(1);
  assert.equal(f.reads.at(-1).at - start, 138000);
});

for (const state of ['completed', 'completed_with_refusals', 'paused', 'cancelled', 'failed']) {
  test(`${state} response stops polling`, async (t) => {
    const f = await fixture(t);
    f.jobs.get('job-1').state = state;
    await f.advance(3000);
    assert.equal(f.reads.length, 1);
    assert.equal(f.timers.size, 0);
    assert.equal(
      f.container.querySelector('[data-slot="status"] strong').textContent,
      state.replaceAll('_', ' ')
    );
    await f.advance(180000);
    assert.equal(f.reads.length, 1);
  });
}

for (const initial of [
  { state: 'running' },
  { state: 'deferred_requeue' },
  { state: 'paused', deferred_requeue: true },
]) {
  test(`${JSON.stringify(initial)} keeps polling until deferred requeue clears`, async (t) => {
    const f = await fixture(t, initial);
    await f.advance(6000);
    assert.equal(f.reads.length, 2);
    assert.equal(f.delay, 3000);
    Object.assign(f.jobs.get('job-1'), { state: 'paused', deferred_requeue: false });
    await f.advance(3000);
    assert.equal(f.reads.length, 3);
    assert.equal(f.timers.size, 0);
  });
}

for (const duration of [60000, 60001]) {
  test(`hidden for ${duration} ms: pause and ${duration > 60000 ? 'immediate authorization' : 'scheduled resume'}`, async (t) => {
    const f = await fixture(t);
    await f.visible(false);
    await f.advance(duration);
    assert.equal(f.reads.length, 0, 'hidden ticks make no viewer call');
    assert.equal(f.timers.size, 0, 'hidden tick does not spin');
    await f.visible(true);
    assert.equal(f.reads.length, duration > 60000 ? 1 : 0);
    assert.equal(f.delay, 3000);
    await f.advance(3000);
    assert.equal(f.reads.length, duration > 60000 ? 2 : 1);
  });
}

test('long hidden return retains elapsed-time backoff', async (t) => {
  const f = await fixture(t);
  await f.visible(false);
  await f.advance(120001);
  await f.visible(true);
  assert.equal(f.reads.length, 1);
  assert.equal(f.delay, 15000);
});

for (const action of ['destroy', 'disconnect']) {
  test(`${action} prevents pending ticks and visibility changes from reading jobs`, async (t) => {
    const f = await fixture(t);
    if (action === 'destroy') f.handle.destroy();
    else f.container.remove();
    await f.advance(3000);
    assert.equal(f.reads.length, 0);
    assert.equal(f.timers.size, 0);
    await f.visible(false);
    await f.advance(60001);
    await f.visible(true);
    assert.equal(f.reads.length, 0);
  });
}

test('destroy during an outstanding poll ignores its result', async (t) => {
  const f = await fixture(t);
  const pending = deferred();
  f.respond(() => pending.promise);
  await f.advance(3000);
  assert.equal(f.reads.length, 1);
  f.handle.destroy();
  pending.resolve({ job: { id: 'job-1', state: 'running' } });
  await settle();
  assert.equal(f.container.innerHTML, '');
  assert.equal(f.timers.size, 0);
});

test('a late old-job poll cannot replace a newly created job or its timer', async (t) => {
  const f = await fixture(t);
  const pending = deferred();
  f.respond((id) => (id === 'job-1' ? pending.promise : { job: { ...f.jobs.get(id) } }));
  await f.advance(3000);
  await f.create();
  await f.advance(1000);
  pending.resolve({ job: { id: 'job-1', state: 'failed' } });
  await settle();
  assert.equal(f.container.querySelector('[data-slot="status"] strong').textContent, 'queued');
  assert.equal(f.delay, 2000, 'stale response must not replace the new timer');
  await f.advance(2000);
  assert.equal(f.reads.at(-1).url, '/jobs/job-2');
});

test('new analysis resets the slow polling interval', async (t) => {
  const f = await fixture(t);
  await f.advance(123000);
  assert.equal(f.delay, 15000);
  await f.create();
  assert.equal(f.delay, 3000);
  await f.advance(3000);
  assert.equal(f.reads.at(-1).url, '/jobs/job-2');
});

test('remount retires the old timer and reauthorizes the remembered job', async (t) => {
  const f = await fixture(t);
  const oldTimer = [...f.timers.keys()][0];
  await f.remount();
  assert.equal(f.reads.length, 1);
  assert.equal(f.timers.has(oldTimer), false);
  assert.equal(f.delay, 3000);
  await f.advance(3000);
  assert.equal(f.reads.length, 2);
});

// Jony Ives #736: bounded retry acceptance. These assertions exercise real DOM
// focus in JSDOM; browser keyboard and assistive-technology checks are separate.
const unavailable = 'The analysis service is unavailable. We couldn’t confirm the current status.';
const error = (status, retryAfter, message = 'Service unavailable') =>
  Object.assign(new Error(message), { status, retryAfter });
const heading = (f) => f.container.querySelector('[data-poll-heading]');
const message = (f) => f.container.querySelector('[data-poll-message]');
const button = (f) => f.container.querySelector('[data-act="recheck"]');
const healthy = (f) => f.respond((id) => ({ job: { ...f.jobs.get(id) } }));
async function failing(t, status = 503, retryAfter) {
  const f = await fixture(t, { state: 'running' });
  f.announcements.length = 0;
  f.respond(() => Promise.reject(error(status, retryAfter)));
  await f.advance(3000);
  return f;
}
async function exhaust(f) {
  for (const delay of [5000, 10000, 20000, 40000, 60000]) {
    assert.equal(f.delay, delay);
    await f.advance(delay);
  }
}

test('one 503 retries at 5 s, clears only the poll message, and resumes normal cadence', async (t) => {
  const f = await failing(t);
  assert.equal(f.delay, 5000);
  assert.equal(heading(f).textContent, 'Last confirmed: running');
  assert.equal(message(f).getAttribute('role'), 'status');
  assert.equal(
    message(f).textContent,
    "Can't reach the analysis service. Trying again automatically."
  );
  healthy(f);
  await f.advance(4999);
  assert.equal(f.reads.length, 1);
  await f.advance(1);
  assert.equal(f.reads.length, 2);
  assert.equal(message(f), null);
  assert.equal(button(f), null);
  assert.equal(heading(f).textContent, 'running');
  assert.equal(f.delay, 3000);
});

test('six failed reads exhaust exactly five automatic retries and leave an honest alert', async (t) => {
  const f = await failing(t);
  await exhaust(f);
  assert.deepEqual(
    f.reads.map((r) => r.at - f.reads[0].at),
    [0, 5000, 15000, 35000, 75000, 135000]
  );
  assert.equal(f.timers.size, 0);
  assert.equal(heading(f).textContent, 'Last confirmed: running');
  assert.equal(message(f).getAttribute('role'), 'alert');
  assert.equal(message(f).textContent, unavailable);
  assert.equal(button(f).textContent, 'Check again');
  for (const action of ['cancel', 'delete'])
    assert.equal(f.container.querySelector(`[data-act="${action}"]`).disabled, false);
  await f.advance(600000);
  assert.equal(f.reads.length, 6);
});

for (const [header, delay] of [
  ['30', 30000],
  ['600', 300000],
  ['garbage', 5000],
  ['', 5000],
  ['-4', 5000],
  ['0.5', 5000],
  ['30.5', 30500],
]) {
  test(`429 Retry-After ${JSON.stringify(header)} chooses ${delay} ms`, async (t) => {
    const f = await failing(t, 429, header);
    assert.equal(f.delay, delay);
    assert.equal(
      message(f).textContent,
      `The analysis service is busy. Trying again in ${Math.ceil(delay / 1000)} s.`
    );
    healthy(f);
    await f.advance(delay - 1);
    assert.equal(f.reads.length, 1);
    await f.advance(1);
    assert.equal(f.reads.length, 2);
  });
}

for (const offset of [-30000, 30000]) {
  test(`429 supports HTTP-date ${offset} ms from failure, with step fallback for past dates`, async (t) => {
    const f = await fixture(t, { state: 'running' });
    f.respond(() => Promise.reject(error(429, new Date(f.now + offset).toUTCString())));
    await f.advance(3000);
    assert.equal(f.delay, Math.max(5000, offset));
  });
}

test('429 retry respects the normal 15 s cadence after 120 s even with a short header', async (t) => {
  const f = await fixture(t, { state: 'running' });
  await f.advance(123000);
  f.respond(() => Promise.reject(error(429, '1')));
  await f.advance(15000);
  assert.equal(f.delay, 15000, 'max(cadence, step, Retry-After), capped at 300 s');
});

for (const status of [0, 502, 504]) {
  test(`transport/status ${status} gets a bounded retry`, async (t) => {
    const f = await failing(t, status);
    assert.equal(f.delay, 5000);
  });
}

test('Check again coalesces repeated requests, stays disabled in flight, then focuses the heading', async (t) => {
  const f = await failing(t);
  const pending = deferred();
  f.respond(() => pending.promise);
  await f.click('recheck', true);
  assert.equal(f.reads.length, 2);
  assert.equal(f.timers.size, 0);
  assert.equal(button(f).disabled, true);
  assert.equal(button(f).textContent, 'Checking…');
  button(f).click();
  await f.visible(false);
  await f.visible(true);
  assert.equal(f.reads.length, 2, 'manual/tab return must coalesce with the in-flight request');
  for (const action of ['cancel', 'delete'])
    assert.equal(f.container.querySelector(`[data-act="${action}"]`).disabled, false);
  pending.resolve({ job: { ...f.jobs.get('job-1') } });
  await settle();
  assert.equal(button(f), null);
  assert.equal(f.w.document.activeElement, heading(f));
  assert.notEqual(f.w.document.activeElement, f.w.document.body);
});

test('failed manual Check again retains focus and starts a fresh run of five', async (t) => {
  const f = await failing(t);
  await f.advance(15000); // already consumed two automatic retries
  const before = f.reads.length;
  await f.click('recheck', true);
  assert.equal(f.reads.length, before + 1);
  assert.equal(f.delay, 5000);
  assert.equal(button(f).disabled, false);
  assert.equal(f.w.document.activeElement, button(f));
  await exhaust(f);
  assert.equal(f.reads.length, before + 6);
  assert.equal(f.timers.size, 0);
});

test('manual recovery does not steal focus that moved outside the inspector', async (t) => {
  const f = await failing(t);
  const pending = deferred();
  f.respond(() => pending.promise);
  await f.click('recheck', true);
  const elsewhere = f.w.document.createElement('button');
  f.w.document.body.append(elsewhere);
  elsewhere.focus();
  pending.resolve({ job: { ...f.jobs.get('job-1') } });
  await settle();
  assert.equal(f.w.document.activeElement, elsewhere);
});

for (const duration of [60000, 60001]) {
  test(`hidden retry for ${duration} ms makes no reads and returns with one immediate read`, async (t) => {
    const f = await failing(t);
    await f.visible(false);
    await f.advance(duration);
    assert.equal(f.reads.length, 1);
    assert.equal(f.timers.size, 0);
    // First return fails: it is free, and starts five new automatic retries.
    await f.visible(true);
    assert.equal(f.reads.length, 2);
    assert.equal(f.delay, 5000);
    await exhaust(f);
    assert.equal(f.reads.length, 7);
    assert.equal(f.timers.size, 0);
  });
}

for (const status of [404, 410]) {
  test(`${status} during a retry deliberately loses the job and cannot retry on tab return`, async (t) => {
    const f = await failing(t);
    f.respond(() => Promise.reject(error(status)));
    await f.advance(5000);
    assert.equal(f.timers.size, 0);
    assert.equal(button(f), null);
    assert.equal(message(f), null);
    assert.equal(f.container.querySelector('[data-act="cancel"]'), null);
    assert.match(
      f.container.textContent,
      status === 404 ? /earlier browser session/ : /expired or was deleted/
    );
    await f.visible(false);
    await f.advance(60001);
    await f.visible(true);
    assert.equal(f.reads.length, 2);
  });
}

for (const status of [400, 401, 403, 422]) {
  test(`${status} never auto-retries, even a generic HTTP message`, async (t) => {
    const f = await fixture(t, { state: 'running' });
    f.respond(() => Promise.reject(error(status, null, `HTTP ${status}`)));
    await f.advance(3000);
    assert.equal(f.timers.size, 0);
    assert.ok(button(f));
    assert.equal(message(f).getAttribute('role'), 'alert');
    assert.equal(message(f).textContent, `HTTP ${status}`);
    await f.advance(300000);
    assert.equal(f.reads.length, 1);
  });
}

test('a nontransient server message is shown unchanged with Check again', async (t) => {
  const f = await fixture(t, { state: 'running' });
  f.respond(() => Promise.reject(error(403, null, 'Access is restricted.')));
  await f.advance(3000);
  assert.equal(message(f).textContent, 'Access is restricted.');
  assert.equal(f.timers.size, 0);
});

for (const action of ['destroy', 'replace', 'cancel', 'delete']) {
  test(`${action} retires a pending retry without reading the old job`, async (t) => {
    const f = await failing(t);
    if (action === 'destroy') f.handle.destroy();
    else if (action === 'replace') await f.create();
    else await f.click(action);
    healthy(f);
    await f.advance(6000);
    assert.equal(f.reads.filter((r) => r.url === '/jobs/job-1').length, 1);
    if (action === 'replace') assert.equal(f.reads.at(-1).url, '/jobs/job-2');
    else assert.equal(f.timers.size, 0);
  });
}

for (const action of ['replace', 'cancel', 'destroy']) {
  for (const rejection of [false, true]) {
    test(`late ${rejection ? '404 rejection' : 'success'} after ${action} cannot overwrite newer ownership`, async (t) => {
      const f = await failing(t);
      const pending = deferred();
      f.respond(() => pending.promise);
      await f.click('recheck');
      if (action === 'replace') await f.create();
      else if (action === 'cancel') await f.click('cancel');
      else f.handle.destroy();
      const snapshot = f.container.textContent;
      if (rejection) pending.reject(error(404));
      else pending.resolve({ job: { id: 'job-1', state: 'running' } });
      await settle();
      assert.equal(f.container.textContent, snapshot);
      if (action !== 'replace') assert.equal(f.timers.size, 0);
      if (action === 'destroy') {
        healthy(f);
        await f.remount();
        assert.equal(
          heading(f).textContent,
          'running',
          'late response must not erase remembered job'
        );
        assert.equal(f.delay, 3000);
      }
    });
  }
}

for (const duration of [1, 60001]) {
  test(`export error survives successful ${duration > 60000 ? 'authorization' : 'poll'} recovery`, async (t) => {
    const f = await fixture(t, { state: 'running' });
    await f.withEvidence();
    f.w.fetch = async () => ({ status: 500 });
    await f.click('export');
    const exportMessage = 'The analysis export is unavailable (HTTP 500).';
    assert.match(f.container.textContent, /The analysis export is unavailable \(HTTP 500\)/);
    f.respond(() => Promise.reject(error(503)));
    await f.advance(3000);
    healthy(f);
    await f.visible(false);
    await f.advance(duration);
    await f.visible(true);
    assert.equal(message(f), null);
    assert.ok(f.container.textContent.includes(exportMessage));
    assert.ok(
      f.container.querySelector('[data-act="export"]'),
      'long return reauthorizes evidence'
    );
  });
}

test('an analyze error also survives successful background recovery', async (t) => {
  const f = await failing(t);
  f.setCreateError(error(422, null, 'Analysis request rejected.'));
  await f.create();
  healthy(f);
  await f.advance(5000);
  assert.equal(message(f), null);
  assert.ok(f.container.textContent.includes('Analysis request rejected.'));
});

for (const state of ['running', 'completed']) {
  test(`exactly first-failure, give-up and recovery announcements; recovered state ${state}`, async (t) => {
    const f = await failing(t, 429, '1');
    assert.equal(
      message(f).getAttribute('aria-live'),
      'off',
      'shared live region owns announcements, not changing delay notes'
    );
    await exhaust(f);
    assert.equal(f.announcements.length, 2);
    assert.equal(f.announcements[0], 'The analysis service is busy. Trying again automatically.');
    assert.equal(f.announcements[1], unavailable);
    f.jobs.get('job-1').state = state;
    healthy(f);
    await f.click('recheck');
    assert.equal(f.announcements.length, 3);
    assert.equal(f.announcements[2], `Reconnected. Analysis ${state}.`);
  });
}

for (const mode of ['transport', 'hash']) {
  test(`evidence ${mode} failure is separate from the GET /jobs retry policy`, async (t) => {
    const f = await fixture(t, { state: 'running' });
    Object.assign(f.jobs.get('job-1'), { identity: {}, manifest_hash: 'a'.repeat(64) });
    f.setEvidence(async () => {
      if (mode === 'transport') throw error(503);
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    });
    await f.advance(3000);
    await settle();
    assert.equal(message(f), null, 'evidence error must not be a poll error');
    assert.equal(button(f), null);
    assert.equal(f.timers.size, 0, 'preserves existing evidence-error stop semantics');
    assert.ok(f.container.querySelector('[role="alert"]'));
    // A later successful job read must not clear the separate evidence error.
    delete f.jobs.get('job-1').manifest_hash;
    const alert = f.container.querySelector('[role="alert"]').textContent;
    await f.visible(false);
    await f.advance(60001);
    await f.visible(true);
    assert.equal(f.container.querySelector('[role="alert"]').textContent, alert);
  });
}

test('replacement during awaited evidence cannot resume the old poll or clear a new in-flight check', async (t) => {
  const f = await fixture(t, { state: 'running' });
  const evidence = deferred();
  Object.assign(f.jobs.get('job-1'), { identity: {}, manifest_hash: 'a'.repeat(64) });
  f.setEvidence(() => evidence.promise);
  await f.advance(3000);
  await f.create();
  f.respond(() => Promise.reject(error(503)));
  await f.advance(3000);
  const next = deferred();
  f.respond(() => next.promise);
  await f.click('recheck', true);
  evidence.reject(error(404));
  await settle();
  assert.equal(button(f).disabled, true, 'obsolete catch/finally cannot clear new request state');
  assert.equal(heading(f).textContent, 'Last confirmed: running');
  next.resolve({ job: { ...f.jobs.get('job-2') } });
  await settle();
  assert.equal(f.w.document.activeElement, heading(f));
  assert.equal(f.delay, 3000);
});

// Independent review regressions: failed authorization and same-job evidence races.
test('adversarial: successful automatic retry after long-return authorization restores evidence access', async (t) => {
  const f = await fixture(t, { state: 'running' });
  await f.withEvidence();
  f.respond(() => Promise.reject(error(503)));
  await f.visible(false);
  await f.advance(60001);
  await f.visible(true);
  assert.equal(f.delay, 5000);
  healthy(f);
  await f.advance(5000);
  assert.equal(message(f), null);
  assert.ok(
    f.container.querySelector('[data-act="export"]'),
    'successful retry must reauthorize pinned evidence'
  );
});

test('adversarial: Check again after failed long-return authorization restores evidence access', async (t) => {
  const f = await fixture(t, { state: 'running' });
  await f.withEvidence();
  f.respond(() => Promise.reject(error(503)));
  await f.visible(false);
  await f.advance(60001);
  await f.visible(true);
  healthy(f);
  await f.click('recheck');
  assert.ok(
    f.container.querySelector('[data-act="export"]'),
    'successful manual retry must reauthorize pinned evidence'
  );
});

test('adversarial: stale evidence from pre-cancel poll cannot attach to cancelled same-id job', async (t) => {
  const f = await fixture(t, { state: 'running' });
  const bytes = Buffer.from(
    JSON.stringify({
      job_id: 'job-1',
      identity_hash: createHash('sha256').update('{}').digest('hex'),
      partial: true,
      coverage: { marker: 'obsolete checkpoint' },
    })
  );
  const hash = createHash('sha256').update(bytes).digest('hex');
  Object.assign(f.jobs.get('job-1'), { identity: {}, manifest_hash: hash });
  const pending = deferred();
  f.setEvidence((url) =>
    url.includes('/pages?') ? { manifest_hash: hash, page_refs: [] } : pending.promise
  );
  await f.advance(3000);
  delete f.jobs.get('job-1').manifest_hash; // the authoritative Cancel has no checkpoint
  await f.click('cancel');
  assert.equal(heading(f).textContent, 'cancelled');
  assert.equal(f.container.querySelector('[data-act="export"]'), null);
  pending.resolve({ ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
  await settle();
  await settle();
  f.handle.setLens('sources');
  f.handle.setLens('summary');
  assert.equal(
    f.container.querySelector('[data-act="export"]'),
    null,
    'obsolete in-flight evidence must not be installed after authoritative Cancel'
  );
});

for (const recover of [true, false]) {
  test(`terminal job authorization retries truthfully, then ${recover ? 'stops on success' : 'exhausts the bound'}`, async (t) => {
    const f = await fixture(t, { state: 'completed' });
    f.respond(() => Promise.reject(error(503)));
    await f.handle.activate();
    assert.equal(f.delay, 5000);
    assert.equal(message(f).getAttribute('role'), 'status');
    if (recover) {
      healthy(f);
      await f.advance(5000);
      assert.equal(message(f), null);
      assert.equal(heading(f).textContent, 'completed');
      assert.equal(f.reads.length, 2);
    } else {
      await exhaust(f);
      assert.equal(f.reads.length, 6);
      assert.equal(message(f).textContent, unavailable);
    }
    assert.equal(f.timers.size, 0);
  });
}

for (const status of [0, 503]) {
  test(`explicit status ${status} retries despite a misleading NOT_FOUND body code`, async (t) => {
    const f = await fixture(t, { state: 'running' });
    f.respond(() => Promise.reject(Object.assign(error(status), { code: 'NOT_FOUND' })));
    await f.advance(3000);
    assert.equal(f.delay, 5000);
    assert.equal(message(f).getAttribute('role'), 'status');
    assert.doesNotMatch(message(f).textContent, /earlier browser session/);
  });
}

test('an overflowing positive numeric Retry-After is capped instead of becoming a short retry', async (t) => {
  const f = await failing(t, 429, '9'.repeat(400));
  assert.equal(f.delay, 300000);
});

for (const rejected of [false, true]) {
  test(`long-hidden return supersedes a pre-hide read and ignores its late ${rejected ? 'rejection' : 'success'}`, async (t) => {
    const f = await fixture(t, { state: 'running' });
    await f.withEvidence();
    const old = deferred(),
      fresh = deferred();
    let count = 0;
    f.respond(() => (++count === 1 ? old.promise : fresh.promise));
    await f.advance(3000);
    const before = f.reads.length;
    await f.visible(false);
    await f.advance(60001);
    await f.visible(true);
    assert.equal(
      f.reads.length,
      before + 1,
      'return must send a fresh authorized read immediately'
    );
    assert.equal(
      f.container.querySelector('[data-act="export"]'),
      null,
      'evidence waits for fresh authority'
    );
    if (rejected) old.reject(error(410));
    else old.resolve({ job: { id: 'job-1', state: 'failed' } });
    await settle();
    assert.equal(
      heading(f).textContent,
      'running',
      'old completion must not change current status'
    );
    assert.equal(
      f.timers.size,
      0,
      'obsolete finally must not schedule or finish the fresh request'
    );
    fresh.resolve({ job: { ...f.jobs.get('job-1') } });
    await settle();
    assert.ok(f.container.querySelector('[data-act="export"]'));
    assert.equal(f.delay, 3000);
  });
}

test('long-hidden return with poll error also supersedes an outstanding Check again', async (t) => {
  const f = await fixture(t, { state: 'running' });
  await f.withEvidence();
  f.respond(() => Promise.reject(error(503)));
  await f.advance(3000);
  const old = deferred(),
    fresh = deferred();
  let count = 0;
  f.respond(() => (++count === 1 ? old.promise : fresh.promise));
  await f.click('recheck', true);
  const before = f.reads.length;
  assert.ok(f.container.querySelector('[data-act="export"]'));
  await f.visible(false);
  await f.advance(60001);
  await f.visible(true);
  assert.equal(f.reads.length, before + 1);
  assert.equal(f.container.querySelector('[data-act="export"]'), null);
  old.reject(error(404));
  await settle();
  assert.equal(button(f).disabled, true);
  fresh.resolve({ job: { ...f.jobs.get('job-1') } });
  await settle();
  assert.equal(f.w.document.activeElement, heading(f));
  assert.equal(message(f), null);
  assert.ok(f.container.querySelector('[data-act="export"]'));
});

for (const slow of [false, true]) {
  test(`recovered heading keeps focus through the next ${slow ? '15' : '3'} s status redraw`, async (t) => {
    const f = await failing(t);
    if (slow) await f.advance(120001);
    healthy(f);
    await f.click('recheck', true);
    assert.equal(f.w.document.activeElement, heading(f));
    await f.advance(slow ? 15000 : 3000);
    assert.equal(f.w.document.activeElement, heading(f));
    assert.notEqual(f.w.document.activeElement, f.w.document.body);
    const elsewhere = f.w.document.createElement('button');
    f.w.document.body.append(elsewhere);
    elsewhere.focus();
    await f.advance(slow ? 15000 : 3000);
    assert.equal(
      f.w.document.activeElement,
      elsewhere,
      'later redraw must respect user focus movement'
    );
  });
}
