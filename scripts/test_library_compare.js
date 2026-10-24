#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const head = (id) => ({
  reading_unit_id: id,
  title: id,
  page_index: 0,
  lines: [['lyric', id, 0, 1, 1, [0, id.length]]],
  work_readings: [],
});
function fixture(t) {
  const dom = new JSDOM('<div id="surface-library"></div>', {
    url: 'https://example.test/#library/read/left',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  w.esc = (value) =>
    String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  w.icon = () => '';
  const timers = new Map();
  let timerId = 0;
  w.setTimeout = (callback) => {
    timers.set(++timerId, callback);
    return timerId;
  };
  w.clearTimeout = (id) => timers.delete(id);
  const api = w.eval(
    `(function () {${fs.readFileSync(path.join(__dirname, '../src/library/compare.js'), 'utf8')}\n})()`
  );
  const readings = new Map(),
    searches = [];
  const lib = {
    reading: (id) => {
      if (id === 'left') return Promise.resolve(head(id));
      if (!readings.has(id)) readings.set(id, deferred());
      return readings.get(id).promise;
    },
    get: () => {
      const request = deferred();
      searches.push(request);
      return request.promise;
    },
  };
  const handle = api.mount(w.document.querySelector('div'), { left: head('left'), lib });
  t.after(() => {
    handle.close();
    w.close();
  });
  return {
    handle,
    readings,
    searches,
    document: w.document,
    input(value) {
      const input = w.document.querySelector('input[type=search]');
      input.value = value;
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
    },
    flushTimers() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((fn) => fn());
    },
  };
}

test('picker input does not cancel a pending comparison', async (t) => {
  const f = fixture(t);
  f.handle.choose('right');
  f.input('another');
  f.flushTimers();
  f.readings.get('right').resolve(head('right'));
  await settle();
  assert.equal(f.document.querySelectorAll('.lib-cmp-rows > div').length, 1);
  assert.doesNotMatch(f.document.querySelector('.lib-cmp-body').textContent, /Loading both/);
});

test('choosing a comparison does not cancel a pending picker search', async (t) => {
  const f = fixture(t);
  f.input('another');
  f.flushTimers();
  f.handle.choose('right');
  f.searches[0].resolve({ items: [{ reading_unit_id: 'found', title: 'Found work' }] });
  await settle();
  assert.ok(f.document.querySelector('[data-pick="found"]'));
});

test('clearing the search ignores a late error', async (t) => {
  const f = fixture(t);
  f.input('another');
  f.flushTimers();
  f.input('');
  f.searches[0].reject(new Error('stale search failure'));
  await settle();
  assert.doesNotMatch(
    f.document.querySelector('.lib-cmp-picker').textContent,
    /stale search failure/
  );
});

test('only the most recently chosen comparison renders', async (t) => {
  const f = fixture(t);
  f.handle.choose('older');
  f.handle.choose('newer');
  f.readings.get('newer').resolve(head('newer'));
  await settle();
  f.readings.get('older').resolve(head('older'));
  await settle();
  assert.equal(f.document.querySelector('.lib-cmp-heads h3:last-child').textContent, 'newer');
});

test('new search results survive a late response to an older query', async (t) => {
  const f = fixture(t);
  f.input('older');
  f.flushTimers();
  f.input('newer');
  f.flushTimers();
  f.searches[1].resolve({ items: [{ reading_unit_id: 'new', title: 'New result' }] });
  await settle();
  f.searches[0].resolve({ items: [{ reading_unit_id: 'old', title: 'Old result' }] });
  await settle();
  assert.ok(f.document.querySelector('[data-pick="new"]'));
  assert.equal(f.document.querySelector('[data-pick="old"]'), null);
});
