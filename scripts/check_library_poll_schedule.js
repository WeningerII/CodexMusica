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
const source = fs.readFileSync(path.join(__dirname, '../src/library/analysis.js'), 'utf8');
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

async function fixture(t, initial = { state: 'queued' }) {
  const dom = new JSDOM('<div id="surface-library"><main></main></div>', {
    url: 'https://example.test/#library/read/poll-test',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  w.CMLyricTokens = require('../src/lyric-tokens.js');
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
  const lib = {
    json: async () => ({ methods: [] }),
    device: { read: async (_key, fallback) => fallback, write: async () => {} },
    viewer: async (url, opts = {}) => {
      requests.push({ url, method: opts.method || 'GET', at: now });
      if (url === '/analyses') {
        const job = { id: `job-${++nextJob}`, ...initial };
        jobs.set(job.id, job);
        return { job: { ...job } };
      }
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
      return requests.filter((r) => r.method === 'GET');
    },
    get delay() {
      assert.equal(timers.size, 1, 'exactly one poll timer');
      return [...timers.values()][0].due - now;
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
