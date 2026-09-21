#!/usr/bin/env node
'use strict';
// Exercise the shipped DOM handlers and catalog, without a browser or rendering.
// Canvas APIs are inert: this suite verifies state transitions, not pixel layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const threads = JSON.parse(read('data/threads.json')).threads;
const routes = JSON.parse(read('data/routes.json')).routes;
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

async function fixture(t) {
  const dom = new JSDOM(read('atlas.html'), {
    url: 'https://codexmusica.com/atlas.html',
    runScripts: 'outside-only',
  });
  const w = dom.window;
  t.after(() => w.close());
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.error));
  t.after(() => assert.deepEqual(errors, [], 'No unhandled DOM handler errors'));
  const timers = new Map();
  let timerId = 0;
  w.setTimeout = (fn) => {
    timers.set(++timerId, fn);
    return timerId;
  };
  w.clearTimeout = (id) => timers.delete(id);
  const tick = () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
  };
  let clock = 0;
  w.performance.now = () => (clock += 1000);
  w.matchMedia = () => ({ matches: true });
  w.requestAnimationFrame = (fn) => {
    fn();
    return 1;
  };
  w.ResizeObserver = class {
    constructor(fn) {
      this.fn = fn;
    }
    observe() {
      this.fn();
    }
  };
  w.Path2D = class {
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
  w.Image = class {
    complete = false;
  };
  const drawing = { curves: 0 };
  const ctx = {};
  for (const name of [
    'setTransform',
    'clearRect',
    'fillRect',
    'save',
    'restore',
    'translate',
    'scale',
    'drawImage',
    'fill',
    'setLineDash',
    'beginPath',
    'moveTo',
    'stroke',
    'arc',
    'fillText',
    'strokeText',
  ])
    ctx[name] = () => {};
  ctx.quadraticCurveTo = () => drawing.curves++;
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  const $ = (selector) => w.document.querySelector(selector);
  $('#canvas-host').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800 });
  $('#canvas-host').setPointerCapture = () => {};
  w.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(read(url)) });
  await flush();
  w.eval(read('src/atlas.js'));
  await flush();
  assert.match($('#loading').textContent, /traditions loaded/);
  const click = (selector) => {
    const el = typeof selector === 'string' ? $(selector) : selector;
    assert.ok(el, 'Missing control: ' + selector);
    el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true }));
    el.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true }));
    el.click();
    tick();
  };
  const query = (value) => {
    $('#search').value = value;
    $('#search').dispatchEvent(new w.Event('input', { bubbles: true }));
    tick();
  };
  const escape = () => {
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    tick();
  };
  const collection = (id = 'drone') => {
    click('#t-threads');
    click('[data-thid="' + id + '"]');
  };
  return { w, $, click, query, escape, collection, drawing, tick };
}

test('panels close and switch consistently; genre filters stay visible and clearable', async (t) => {
  const f = await fixture(t);
  const { $, click, escape } = f;
  assert.equal($('#t-density'), null);
  click('#t-territories');
  const group = $('[data-root]').dataset.root;
  click('[data-root="' + group + '"]');
  assert.equal($('#legend-panel').hidden, false, 'Replacing a row must not dismiss its panel');
  assert.equal($('#t-territories').dataset.active, 'true');
  assert.equal($('#t-territories-badge').textContent, ' · 1');
  assert.equal($('#active-filters').hidden, false);
  click('#t-threads');
  assert.equal($('#legend-panel').hidden, true);
  assert.equal($('#t-territories').getAttribute('aria-expanded'), 'false');
  assert.equal($('#t-territories').dataset.active, 'true');
  escape();
  assert.equal($('#threads-panel').hidden, true);
  assert.equal(f.w.document.activeElement, $('#t-threads'));
  click('#clear-filters');
  assert.equal($('#active-filters').hidden, true);
  assert.equal($('#t-territories').dataset.active, 'false');
  click('#t-territories');
  click('[data-act="close-panel"]');
  assert.equal($('#legend-panel').hidden, true);
  click('#t-threads');
  $('#search').dispatchEvent(new f.w.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal($('#threads-panel').hidden, true);
});

test('every collection opens real members, no editorial blurb or implied migration line', async (t) => {
  const f = await fixture(t);
  for (const thread of threads) {
    f.collection(thread.id);
    assert.equal(f.$('#thread-card h2').textContent, thread.title);
    assert.equal(f.$('#thread-card p'), null);
    assert.equal(thread.blurb, undefined);
    const ids = [...f.w.document.querySelectorAll('#thread-card [data-tid]')].map(
      (e) => e.dataset.tid
    );
    assert.deepEqual(ids, thread.stops);
    assert.equal(f.$('#t-threads').getAttribute('aria-expanded'), 'false');
    assert.equal(f.$('#t-threads').dataset.active, 'true');
    f.click('[data-act="exit-thread"]');
    assert.equal(f.$('#t-threads').dataset.active, 'false');
    assert.equal(f.$('#thread-card').hidden, true);
  }
  assert.equal(f.drawing.curves, 0, 'Collection membership alone draws no migration curves');
});

test('focusing empty search preserves a collection; typing replaces it without stale controls', async (t) => {
  const f = await fixture(t);
  f.collection();
  const before = f.$('#count').textContent;
  f.$('#search').focus();
  f.tick();
  assert.equal(f.$('#count').textContent, before);
  assert.equal(f.$('#t-threads').dataset.active, 'true');
  f.query('Delta blues');
  assert.equal(f.$('#thread-card').hidden, true);
  assert.equal(f.$('#t-threads').dataset.active, 'false');
  assert.ok(f.$('#results [data-tid="delta_blues"]'));
  f.click('#results [data-tid="delta_blues"]');
  assert.equal(f.$('#active-filters').hidden, true);
  assert.equal(f.$('[data-act="back-thread"]'), null);
  await flush();
});

test('switching from collection to genre group clears the hidden collection constraint', async (t) => {
  const f = await fixture(t);
  f.collection();
  f.click('#t-territories');
  f.click('[data-root="functionalSong"]');
  assert.equal(f.$('#t-threads').dataset.active, 'false');
  assert.equal(f.$('#thread-card').hidden, true);
  assert.equal(f.$('#filter-summary').textContent, '1 genre group');
  assert.match(f.$('#list').textContent, /traditions|Africa|Europe|America|Asia/);
  f.click('[data-act="clear-roots"]');
  assert.equal(f.$('#active-filters').hidden, true);
});

test('search with no results explains the empty map and can be cleared', async (t) => {
  const f = await fixture(t);
  f.query('zzzzunmatchablezzzz');
  assert.equal(f.$('#results').hidden, false);
  assert.match(f.$('#results').textContent, /No matching/);
  assert.match(f.$('#count').textContent, /^0 in view/);
  f.click('#clear-filters');
  assert.equal(f.$('#results').hidden, true);
  assert.equal(f.$('#active-filters').hidden, true);
  assert.doesNotMatch(f.$('#count').textContent, /^0 in view/);
});

test('routes expose all catalogued links and clickable genre endpoints, with a real off action', async (t) => {
  const f = await fixture(t);
  f.collection();
  f.click('#t-routes');
  assert.equal(f.w.document.querySelectorAll('[data-route]').length, routes.length);
  for (let i = 0; i < routes.length; i++) {
    f.click('[data-route="' + i + '"]');
    assert.equal(f.$('#routes-panel').hidden, false);
    assert.equal(f.$('#active-filters').hidden, true);
    assert.equal(f.$('[data-route="' + i + '"]').getAttribute('aria-current'), 'true');
    for (const end of [routes[i].a, routes[i].b]) {
      if (typeof end === 'string') assert.ok(f.$('#routes-panel [data-tid="' + end + '"]'));
      else assert.ok(f.$('.route-ends').textContent.includes(end[2]));
    }
  }
  f.click('[data-route="5"]');
  f.click('#routes-panel [data-tid="delta_blues"]');
  assert.equal(f.$('#routes-panel').hidden, true);
  assert.match(f.$('#card h2').textContent, /Delta blues/i);
  await flush();
  f.click('#t-routes');
  f.click('[data-act="hide-routes"]');
  assert.equal(f.$('#t-routes').dataset.active, 'false');
  assert.equal(f.$('#routes-panel').hidden, true);
  assert.equal(f.$('#t-routes').getAttribute('aria-expanded'), 'false');
});

test('collection detail can return, close, and clear without a stale back button', async (t) => {
  const f = await fixture(t);
  f.collection();
  f.click('#thread-card [data-tid="old_time"]');
  await flush();
  assert.equal(f.$('#card').hidden, false);
  f.click('[data-act="back-thread"]');
  assert.equal(f.$('#thread-card').hidden, false);
  f.click('#thread-card [data-tid="old_time"]');
  await flush();
  f.click('#canvas-host');
  assert.equal(f.$('#thread-card').hidden, false, 'Dismissing a detail restores its collection');
  f.click('#thread-card [data-tid="old_time"]');
  await flush();
  f.click('#clear-filters');
  assert.equal(f.$('[data-act="back-thread"]'), null);
  f.escape();
  assert.equal(f.$('#thread-card').hidden, true);
});
