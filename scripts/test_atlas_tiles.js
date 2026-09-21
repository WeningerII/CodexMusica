#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/atlas-tiles.js'), 'utf8');
const manifest = {
  version: 1,
  projection: 'Equal Earth',
  tileSize: 512,
  gutter: 1,
  extent: [-2.70663, -1.317363, 2.70663, 1.317363],
  levels: Array.from({ length: 7 }, (_, z) => ({
    width: 1350 * 2 ** z,
    height: 657 * 2 ** z,
    rows: Array.from({ length: Math.ceil((657 * 2 ** z) / 512) }, () => [
      0,
      Math.ceil((1350 * 2 ** z) / 512) - 1,
    ]),
  })),
};
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function fixture() {
  const requests = [],
    timers = new Map(),
    bitmaps = [];
  let id = 0;
  const context = {
    window: {},
    AbortController,
    Set,
    Map,
    setTimeout(fn, ms) {
      const key = ++id;
      timers.set(key, { fn, ms });
      return key;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
    requestAnimationFrame(fn) {
      const key = ++id;
      timers.set(key, { fn, ms: 16 });
      return key;
    },
    cancelAnimationFrame(key) {
      timers.delete(key);
    },
    fetch(url, options) {
      if (url.endsWith('manifest.json'))
        return Promise.resolve({ ok: true, json: async () => manifest });
      return new Promise((resolve, reject) => {
        const r = { url, options, resolve, reject };
        requests.push(r);
        options.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    },
    createImageBitmap: async () => {
      const bitmap = {
        width: 514,
        height: 514,
        closed: false,
        close() {
          this.closed = true;
        },
      };
      bitmaps.push(bitmap);
      return bitmap;
    },
  };
  vm.runInNewContext(source, context);
  const renderer = new context.window.AtlasTiles(() => {});
  return {
    renderer,
    requests,
    bitmaps,
    timers,
    tick(ms) {
      for (const [key, t] of [...timers])
        if (t.ms === ms) {
          timers.delete(key);
          t.fn();
        }
    },
    complete() {
      for (const r of requests)
        if (!r.done) {
          r.done = true;
          r.resolve({ ok: true, blob: async () => ({}) });
        }
    },
  };
}

test('overview needs no tiles; retina/zoom selects detail; off-world view is empty', async () => {
  const f = fixture();
  await flush();
  const r = f.renderer;
  r.update({ cx: 0, cy: 0, scale: 200 }, 1100, 550, 1);
  f.tick(100);
  assert.equal(f.requests.length, 0);
  r.update({ cx: 0, cy: 0, scale: 200 }, 1100, 550, 2);
  f.tick(100);
  assert.equal(f.requests.length, 6);
  assert(r.wanted.every((t) => t.z === 1));
  r.update({ cx: 50, cy: 0, scale: 200 }, 1100, 550, 1);
  assert.equal(r.wanted.length, 0);
  assert(f.requests.every((q) => q.options.signal.aborted));
  r.dispose();
  await flush();
});

test('rapid zoom skips intermediate levels and caps requests/cache; disposal releases pixels', async () => {
  const f = fixture();
  await flush();
  const r = f.renderer;
  r.update({ cx: 0, cy: 0, scale: 900 }, 1200, 700, 2);
  r.update({ cx: 0, cy: 0, scale: 9000 }, 1200, 700, 2);
  assert.equal(f.requests.length, 0);
  f.tick(100);
  assert.equal(r.active.size, 6);
  assert(f.requests.every((q) => q.url.includes('/6/')));
  for (let j = 0; j < 16; j++) {
    r.update({ cx: -2 + j / 4, cy: 0, scale: 9000 }, 1200, 700, 2);
    f.tick(100);
    await flush();
    for (let k = 0; k < 15; k++) {
      f.complete();
      await flush();
      assert(r.active.size <= 6);
    }
    assert(r.cache.size <= 64);
  }
  assert(f.bitmaps.some((b) => b.closed));
  r.dispose();
  await flush();
  assert(f.bitmaps.every((b) => b.closed));
});

test('404 and timeout retain fallback without repeated attempts', async () => {
  const f = fixture();
  await flush();
  const r = f.renderer;
  r.update({ cx: 0, cy: 0, scale: 1500 }, 600, 400, 1);
  f.tick(100);
  const first = f.requests[0];
  first.done = true;
  first.resolve({ ok: false });
  await flush();
  assert(r.failed.has(r.wanted[0].key));
  f.tick(15000);
  await flush();
  for (let k = 0; k < 10; k++) {
    f.tick(15000);
    await flush();
  }
  const urls = f.requests.map((q) => q.url);
  assert.equal(new Set(urls).size, urls.length);
  r.dispose();
  await flush();
});

test('drawing uses the same Equal Earth extent and retains loaded parents during zoom', async () => {
  const f = fixture();
  await flush();
  const r = f.renderer;
  r.update({ cx: 0, cy: 0, scale: 400 }, 1000, 500, 1);
  f.tick(100);
  for (let i = 0; i < 5; i++) {
    f.complete();
    await flush();
  }
  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    translate(...a) {
      calls.push(['translate', ...a]);
    },
    scale() {},
    drawImage(...a) {
      calls.push(['image', ...a]);
    },
  };
  r.draw(ctx, { cx: 0, cy: 0, scale: 800 }, 1000, 500, 1);
  assert(calls.some((c) => c[0] === 'image'));
  assert.deepEqual(calls[0], ['translate', -2.70663, 1.317363]);
  r.dispose();
  await flush();
});

test('large displays keep complete viewport coverage within the tile budget', async () => {
  const f = fixture();
  await flush();
  const selected = f.renderer.selection({ cx: 0, cy: 0, scale: 700 }, 3840, 2160, 2);
  assert(selected.length <= 64);
  const z = selected[0].z,
    level = manifest.levels[z];
  const columns = Math.ceil(level.width / 512),
    rows = Math.ceil(level.height / 512);
  assert.equal(selected.length, columns * rows);
  assert(selected.some((t) => t.x === 0 && t.y === 0));
  assert(selected.some((t) => t.x === columns - 1 && t.y === rows - 1));
  f.renderer.dispose();
  await flush();
});
