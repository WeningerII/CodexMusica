'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const ID = 'reading_12345678-1234-5678-9012-123456789012';
async function fixture(t) {
  const dom = new JSDOM('<div id="surface-library"><main></main></div>', {
    url: 'https://example.test/#library/works',
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window,
    timers = new Map(),
    routes = [];
  let clock = 0;
  w.setTimeout = (fn) => {
    timers.set(++clock, fn);
    return clock;
  };
  w.clearTimeout = (id) => timers.delete(id);
  w.esc = (s) =>
    String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;');
  w.icon = () => '';
  w.uiEmptyState = ({ title, text = '', actions = '' }) => `<p>${title}: ${text}</p>${actions}`;
  const source = fs.readFileSync(path.join(__dirname, '../src/library/works.js'), 'utf8');
  const api = w.eval(`(function () { ${source}\n})()`);
  const row = [
    ID,
    'a'.repeat(16) + '-' + 'b'.repeat(12),
    'Reading',
    [],
    'eng',
    'readable',
    'complete',
  ];
  const lib = {
    go: (route) => routes.push(route),
    json: async () => ({ rows: [row], total: 1 }),
    get: async () => ({ items: [], total: 0 }),
    icon: () => '',
    catalog: async () => ({ languages: ['eng'] }),
  };
  const main = w.document.querySelector('main');
  const view = api.show(main, '/works', lib);
  await view.load();
  const input = (text) => {
    view.input.value = text;
    view.input.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  const tick = async () => {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach((f) => f());
    await new Promise((resolve) => setImmediate(resolve));
  };
  const click = (action) => main.querySelector(`[data-lw="${action}"]`).click();
  return { main, view, w, routes, input, tick, click, timers, api, lib };
}

for (const clear of [false, true])
  test(`opening a reading cancels pending query navigation${clear ? ' after Clear' : ''}`, async (t) => {
    const f = await fixture(t);
    f.input('x');
    if (clear) {
      f.click('clear-q');
      await new Promise((resolve) => setImmediate(resolve));
    }
    f.click('open');
    const opened = f.routes.at(-1);
    assert.match(opened, /\/read\//);
    // Keep the old view connected to cover asynchronous reader mounting too.
    await f.tick();
    assert.equal(f.routes.at(-1), opened);
  });

test('Clear commits once and removes the pending typed query', async (t) => {
  const f = await fixture(t);
  f.input('x');
  f.click('clear-q');
  assert.deepEqual(f.routes, ['/works']);
  await f.tick();
  assert.deepEqual(f.routes, ['/works']);
});

for (const action of ['dispose', 'disconnect', 'update'])
  test(`pending query cannot navigate after ${action}`, async (t) => {
    const f = await fixture(t);
    f.input('stale');
    if (action === 'dispose') f.view.dispose();
    if (action === 'disconnect') f.main.innerHTML = '<p>Reader</p>';
    if (action === 'update') f.api.show(f.main, '/works?q=current', f.lib);
    await f.tick();
    assert.deepEqual(f.routes, []);
  });

test('ordinary typing still debounces to the newest query', async (t) => {
  const f = await fixture(t);
  f.input('older');
  f.input('newer');
  assert.equal(f.routes.length, 0);
  await f.tick();
  assert.deepEqual(f.routes, ['/works?q=newer']);
});

test('Enter commits immediately once; a no-input Open remains open', async (t) => {
  const f = await fixture(t);
  f.input('typed');
  f.view.input.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await f.tick();
  assert.deepEqual(f.routes, ['/works?q=typed']);
  const other = await fixture(t);
  other.click('open');
  const route = other.routes.at(-1);
  await other.tick();
  assert.deepEqual(other.routes, [route]);
});

// Top-level navigation keeps the old root connected while an update can be
// awaiting the language catalog. Disposal must invalidate that update too.
test('a disposed view cannot rewrite navigation after its catalog resolves', async (t) => {
  const f = await fixture(t);
  let release;
  f.lib.catalog = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const updating = f.view.update('/works?language=eng');
  f.view.dispose();
  assert.equal(f.view.root.isConnected, true);
  release({ languages: ['fra'] });
  await updating;
  assert.deepEqual(f.routes, []);
});
