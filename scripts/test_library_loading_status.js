const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

function fixture(t) {
  const dom = new JSDOM('<div id="library-live" role="status" aria-live="polite"></div>', {
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window,
    timers = new Map(),
    calls = [];
  w.LIBRARY = { sub: '/works' };
  w.setTimeout = (f) => {
    const id = {};
    timers.set(id, f);
    return id;
  };
  w.clearTimeout = (id) => timers.delete(id);
  w.fetch = (url, init) =>
    url.startsWith('library/data/')
      ? Promise.reject(Error('static catalog intentionally absent in service-status fixture'))
      : new Promise((resolve, reject) => calls.push({ resolve, reject, url, init }));
  w.console.warn = () => {};
  const works = w.eval(`(function () {${fs.readFileSync('src/library/works.js', 'utf8')}\n})()`);
  w.libraryChunk = async (name) => {
    assert.equal(name, 'works');
    return works;
  };
  const { lib } = w.eval(`(function () {${fs.readFileSync('src/library/core.js', 'utf8')}\n})()`);
  return {
    w,
    deferredLib: lib,
    lib: { get: (...args) => works.api(lib.api, ...args) },
    calls,
    live: w.document.getElementById('library-live'),
    tick() {
      const jobs = [...timers.values()];
      timers.clear();
      jobs.forEach((f) => f());
    },
  };
}
const ok = () => ({ ok: true, text: async () => '{"items":[]}' });

test('concurrent slow searches share one visible polite loading status until all settle', async (t) => {
  const f = fixture(t);
  const a = f.lib.get('/search?q=a'),
    b = f.lib.get('/search?q=b');
  assert.equal(f.live.textContent, '');
  f.tick();
  assert.equal(f.live.textContent, 'Loading the Library…');
  assert.ok(f.live.classList.contains('lib-loading'));
  f.calls[0].resolve(ok());
  await a;
  assert.equal(f.live.textContent, 'Loading the Library…');
  f.calls[1].resolve(ok());
  await b;
  assert.equal(f.live.textContent, '');
  assert.equal(f.live.classList.contains('lib-loading'), false);
});

test('quick results never announce loading; errors clear loading and retry can announce again', async (t) => {
  const f = fixture(t);
  const fast = f.lib.get('/search');
  f.calls[0].resolve(ok());
  await fast;
  f.tick();
  assert.equal(f.live.textContent, '');
  const failed = f.lib.get('/search');
  f.tick();
  f.calls[1].reject(Error('offline'));
  await assert.rejects(failed);
  assert.equal(f.live.textContent, '');
  const retry = f.lib.get('/search');
  f.tick();
  assert.equal(f.live.textContent, 'Loading the Library…');
  f.live.textContent = 'A newer status';
  f.calls[2].resolve(ok());
  await retry;
  assert.equal(f.live.textContent, 'A newer status');
});

test('navigation before the delay suppresses stale loading status', async (t) => {
  const f = fixture(t);
  const a = f.lib.get('/search');
  f.w.LIBRARY.sub = '/rights';
  f.tick();
  assert.equal(f.live.textContent, '');
  f.calls[0].resolve(ok());
  await a;
});

test('overlapping query navigation gives the current request its own loading status', async (t) => {
  const f = fixture(t);
  const old = f.lib.get('/search?q=a');
  f.w.LIBRARY.sub = '/works?q=ab';
  const current = f.lib.get('/search?q=ab');
  f.tick();
  assert.equal(f.live.textContent, 'Loading the Library…');
  f.calls[0].resolve(ok());
  await old;
  assert.equal(f.live.textContent, 'Loading the Library…');
  f.calls[1].resolve(ok());
  await current;
  assert.equal(f.live.textContent, '');
});

test('core defers service transport and shares it for public and private requests', async (t) => {
  const f = fixture(t);
  let loads = 0;
  const load = f.w.libraryChunk;
  f.w.libraryChunk = (name) => {
    loads++;
    return load(name);
  };
  assert.equal(loads, 0, 'static core initialization does not load Works');
  const publicRequest = f.deferredLib.get('/search');
  const privateRequest = f.deferredLib.viewer('/jobs');
  await new Promise(setImmediate);
  assert.equal(loads, 2);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls[0].url.endsWith('/search'));
  assert.equal(f.calls[0].init.credentials, 'omit');
  assert.ok(f.calls[1].url.endsWith('/jobs'));
  assert.equal(f.calls[1].init.credentials, 'include');
  f.tick();
  assert.equal(f.live.textContent, 'Loading the Library…');
  f.calls[0].resolve(ok());
  await publicRequest;
  assert.equal(f.live.textContent, 'Loading the Library…');
  f.calls[1].resolve(ok());
  await privateRequest;
  assert.equal(f.live.textContent, '');
});
